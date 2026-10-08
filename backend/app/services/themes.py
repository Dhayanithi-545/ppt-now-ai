"""Custom themes from a style prompt: Gemini returns tokens only; we validate and auto-fix them."""

import re
import uuid
from enum import Enum

from pydantic import BaseModel, Field

from .layouts import DESIGN
from .llm import generate_json

FontName = Enum("FontName", {re.sub(r"\W", "_", f): f for f in DESIGN["fonts"]}, type=str)
BackgroundStyle = Enum("BackgroundStyle", {v: v for v in DESIGN["backgroundStyles"]}, type=str)
Motif = Enum("Motif", {v: v for v in DESIGN["motifs"]}, type=str)
CardStyle = Enum("CardStyle", {v: v for v in DESIGN["cardStyles"]}, type=str)
EyebrowStyle = Enum("EyebrowStyle", {v: v for v in DESIGN["eyebrowStyles"]}, type=str)
ShadowStyle = Enum("ShadowStyle", {v: v for v in DESIGN["shadowStyles"]}, type=str)
ImageTreatment = Enum("ImageTreatment", {v: v for v in DESIGN["imageTreatments"]}, type=str)
HeroFill = Enum("HeroFill", {v: v for v in DESIGN["heroFills"]}, type=str)


class Mode(str, Enum):
    light = "light"
    dark = "dark"


HEX = "6-digit hex color like #1A2B3C"


class ThemeTokens(BaseModel):
    """Flat token set Gemini fills (no CSS, no HTML)."""

    name: str = Field(description="Short evocative theme name, 2-3 words")
    description: str = Field(description="One sentence describing the look")
    mode: Mode
    bg: str = Field(description=f"Slide background, {HEX}")
    surface: str = Field(description=f"Card/panel color, slightly different from bg, {HEX}")
    primary: str = Field(description=f"Main brand color, {HEX}")
    secondary: str = Field(description=f"Second brand color, {HEX}")
    accent: str = Field(description=f"Small highlights, {HEX}")
    text: str = Field(description=f"Main text color with strong contrast on bg, {HEX}")
    muted: str = Field(description=f"Secondary text color, {HEX}")
    on_primary: str = Field(description=f"Text color drawn on primary, {HEX}")
    gradient_from: str = Field(description=HEX)
    gradient_via: str = Field(description=HEX)
    gradient_to: str = Field(description=HEX)
    gradient_angle: int = Field(description="0-360")
    heading_font: FontName
    body_font: FontName
    heading_weight: int = Field(description="300-900; serif display fonts look best at 400-600")
    heading_uppercase: bool
    heading_tracking: float = Field(description="Letter spacing in em, between -0.05 and 0.05")
    background: BackgroundStyle
    motif: Motif
    card_style: CardStyle
    eyebrow_style: EyebrowStyle
    shadow: ShadowStyle
    image_treatment: ImageTreatment
    hero_fill: HeroFill = Field(description="Color that floods cover/divider/closing slides, or none")
    radius: int = Field(description="Corner radius in px, 0-32")
    gradient_text: bool = Field(description="Use gradient fill for big numbers")


# ------------------------------------------------------------- color math (mirrors frontend/src/design/color.ts)


def _rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    n = int(h[:6], 16)
    return (n >> 16) & 255, (n >> 8) & 255, n & 255


def _hex(rgb) -> str:
    return "#" + "".join(f"{max(0, min(255, round(v))):02X}" for v in rgb)


def mix(a: str, b: str, t: float) -> str:
    x, y = _rgb(a), _rgb(b)
    return _hex(tuple(x[i] + (y[i] - x[i]) * t for i in range(3)))


def luminance(h: str) -> float:
    def ch(v):
        s = v / 255
        return s / 12.92 if s <= 0.03928 else ((s + 0.055) / 1.055) ** 2.4

    r, g, b = _rgb(h)
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def contrast(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def ensure_contrast(fg: str, bg: str, minimum: float) -> str:
    """Move fg toward black or white (whichever works) until it meets `minimum` on bg."""
    if contrast(fg, bg) >= minimum:
        return fg
    target = "#FFFFFF" if contrast("#FFFFFF", bg) >= contrast("#000000", bg) else "#000000"
    for i in range(1, 11):
        c = mix(fg, target, i / 10)
        if contrast(c, bg) >= minimum:
            return c
    return target


_HEX_RE = re.compile(r"^#?[0-9a-fA-F]{6}$|^#?[0-9a-fA-F]{3}$")


def norm_hex(v: str, fallback: str) -> str:
    v = (v or "").strip()
    if not _HEX_RE.match(v):
        return fallback
    return _hex(_rgb(v))


def validate_tokens(t: ThemeTokens) -> tuple[dict, list[str]]:
    """Tokens -> frontend Theme dict. Fixes contrast (WCAG AA) and clamps numbers. Returns (theme, fixes)."""
    fixes: list[str] = []
    dark = t.mode == Mode.dark
    bg = norm_hex(t.bg, "#0B0B10" if dark else "#FFFFFF")
    # Mode must agree with the background
    if (luminance(bg) < 0.2) != dark:
        dark = luminance(bg) < 0.2
        fixes.append("mode adjusted to match background")
    c = {
        "bg": bg,
        "surface": norm_hex(t.surface, mix(bg, "#FFFFFF" if dark else "#000000", 0.05)),
        "primary": norm_hex(t.primary, "#6D4AFF"),
        "secondary": norm_hex(t.secondary, "#22D3EE"),
        "accent": norm_hex(t.accent, "#F59E0B"),
        "text": norm_hex(t.text, "#F5F5F5" if dark else "#111111"),
        "muted": norm_hex(t.muted, "#9A9A9A" if dark else "#5E5E5E"),
        "onPrimary": norm_hex(t.on_primary, "#FFFFFF"),
    }
    checks = [("text", "bg", 7.0), ("muted", "bg", 4.5), ("onPrimary", "primary", 4.5)]
    for fg, on, need in checks:
        fixed = ensure_contrast(c[fg], c[on], need)
        if fixed != c[fg]:
            fixes.append(f"{fg} adjusted for contrast on {on} ({contrast(c[fg], c[on]):.1f} → {contrast(fixed, c[on]):.1f})")
            c[fg] = fixed
    # Text must also read on cards
    if contrast(c["text"], c["surface"]) < 4.5:
        c["surface"] = mix(c["bg"], c["text"], 0.06)
        fixes.append("surface adjusted for text contrast")
    theme = {
        "id": "custom-" + uuid.uuid4().hex[:8],
        "name": t.name.strip()[:40] or "Custom",
        "description": t.description.strip()[:160],
        "mode": "dark" if dark else "light",
        "colors": c,
        "gradient": {
            "from": norm_hex(t.gradient_from, c["primary"]),
            "via": norm_hex(t.gradient_via, mix(c["primary"], c["secondary"], 0.5)),
            "to": norm_hex(t.gradient_to, c["secondary"]),
            "angle": int(t.gradient_angle) % 360,
        },
        "fonts": {
            "heading": t.heading_font.value,
            "body": t.body_font.value,
            "headingWeight": max(300, min(900, int(t.heading_weight))),
            "headingUppercase": bool(t.heading_uppercase),
            "headingTracking": max(-0.05, min(0.05, float(t.heading_tracking))),
        },
        "background": t.background.value,
        "motif": t.motif.value,
        "cardStyle": t.card_style.value,
        "eyebrowStyle": t.eyebrow_style.value,
        "shadow": t.shadow.value,
        "imageTreatment": t.image_treatment.value,
        "heroFill": t.hero_fill.value,
        "radius": max(0, min(32, int(t.radius))),
        "gradientText": bool(t.gradient_text),
        "custom": True,
    }
    if DESIGN["fonts"][theme["fonts"]["body"]]["kind"] == "mono":
        theme["fonts"]["body"] = "Inter"
        fixes.append("mono body font replaced with Inter for readability")
    return theme, fixes


SYSTEM = """You are a senior brand and presentation designer. Turn a style description into a cohesive,
premium slide theme. Return design tokens only (no CSS, no HTML).
Guidelines:
- Pick a harmonious palette: one confident primary, a supporting secondary, a sparing accent.
- Text must be highly readable on the background (aim for 10:1), muted text at least 5:1.
- Choose a heading/body font pair from the allowed list that matches the mood (serif for editorial/luxury,
  geometric sans for tech/startup, rounded for playful). Body fonts must be very readable.
- Background style, motif, card style and image treatment must suit the mood; restraint beats decoration.
- radius 0 for strict/brutalist/luxury looks, 12-28 for friendly/modern looks."""


async def theme_from_prompt(prompt: str) -> tuple[dict, list[str]]:
    tokens = await generate_json(f"Style description:\n<<<\n{prompt}\n>>>", ThemeTokens, SYSTEM, temperature=0.8, what="theme")
    return validate_tokens(tokens)
