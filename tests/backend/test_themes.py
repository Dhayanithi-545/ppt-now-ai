"""Custom themes from a prompt: WCAG contrast validation and auto-fixing of Gemini's tokens."""

import re

import pytest

from conftest import FRONTEND

from app.services.layouts import DESIGN
from app.services.themes import ThemeTokens, contrast, ensure_contrast, luminance, mix, norm_hex, validate_tokens


def tokens(**kw) -> ThemeTokens:
    base = dict(
        name="Test", description="d", mode="light", bg="#FFFFFF", surface="#F4F4F4", primary="#1747D4",
        secondary="#0B2A6F", accent="#F59E0B", text="#111111", muted="#5E5E5E", on_primary="#FFFFFF",
        gradient_from="#1747D4", gradient_via="#3B82F6", gradient_to="#0B2A6F", gradient_angle=400,
        heading_font="Inter", body_font="Inter", heading_weight=1200, heading_uppercase=False, heading_tracking=-0.3,
        background="mesh", motif="dots", card_style="filled", eyebrow_style="pill", shadow="soft",
        image_treatment="rounded", hero_fill="none", radius=99, gradient_text=False,
    )
    base.update(kw)
    return ThemeTokens.model_validate(base)


def test_contrast_reference_values():
    assert contrast("#000000", "#FFFFFF") == pytest.approx(21, rel=1e-3)
    assert contrast("#777777", "#777777") == pytest.approx(1)
    assert luminance("#FFFFFF") == pytest.approx(1)
    assert mix("#000000", "#FFFFFF", 0.5) in ("#7F7F7F", "#808080")


@pytest.mark.parametrize("fg,bg,need", [("#999999", "#FFFFFF", 4.5), ("#333333", "#000000", 7), ("#FF0000", "#FF3333", 4.5)])
def test_ensure_contrast_reaches_target(fg, bg, need):
    assert contrast(ensure_contrast(fg, bg, need), bg) >= need


def test_validate_fixes_low_contrast_and_clamps_numbers():
    theme, fixes = validate_tokens(tokens(text="#DDDDDD", muted="#EEEEEE", on_primary="#2040C0"))
    c = theme["colors"]
    assert contrast(c["text"], c["bg"]) >= 7
    assert contrast(c["muted"], c["bg"]) >= 4.5
    assert contrast(c["onPrimary"], c["primary"]) >= 4.5
    assert len(fixes) >= 3
    assert theme["radius"] == 32 and theme["fonts"]["headingWeight"] == 900
    assert theme["fonts"]["headingTracking"] == -0.05 and theme["gradient"]["angle"] == 40
    assert theme["id"].startswith("custom-") and theme["custom"] is True


def test_mode_follows_background():
    theme, fixes = validate_tokens(tokens(bg="#0A0A0A", text="#F5F5F5", muted="#AAAAAA", surface="#151515", mode="light"))
    assert theme["mode"] == "dark"
    assert any("mode" in f for f in fixes)


def test_bad_hex_falls_back():
    assert norm_hex("blue", "#123456") == "#123456"
    assert norm_hex("#abc", "#000000") == "#AABBCC"


def test_fonts_and_enums_are_constrained():
    with pytest.raises(Exception):
        tokens(heading_font="Comic Sans MS")
    with pytest.raises(Exception):
        tokens(background="glitter")
    theme, _ = validate_tokens(tokens(body_font="JetBrains Mono"))
    assert theme["fonts"]["body"] == "Inter"  # mono body text is replaced for readability
    assert theme["fonts"]["heading"] in DESIGN["fonts"]


def test_builtin_themes_have_readable_text():
    src = (FRONTEND / "src" / "design" / "themes.ts").read_text(encoding="utf-8")
    found = 0
    for m in re.finditer(r"bg: '(#\w+)'.*?text: '(#\w+)', muted: '(#\w+)'", src, re.S):
        bg, text, muted = m.groups()
        found += 1
        assert contrast(text, bg) >= 7, (bg, text)
        assert contrast(muted, bg) >= 4.0, (bg, muted)
    assert found >= 10
