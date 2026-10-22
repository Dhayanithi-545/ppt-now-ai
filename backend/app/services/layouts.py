"""Layout library (from app/spec/layouts.json): per-layout Gemini schemas + sanitising of model output.

All layouts share one flat content shape (see frontend/src/design/types.ts SlideContent); each layout uses a subset.
"""

import json
import re
from enum import Enum
from functools import lru_cache
from typing import Any

from pydantic import BaseModel, Field, create_model

from ..config import APP_DIR

# Layout + design spec. The frontend keeps an identical copy in frontend/src/design/ (a test enforces this).
DESIGN = json.loads((APP_DIR / "spec" / "design.json").read_text(encoding="utf-8"))
SPEC: dict[str, dict] = json.loads((APP_DIR / "spec" / "layouts.json").read_text(encoding="utf-8"))["layouts"]
LAYOUT_IDS = list(SPEC)
ICONS: list[str] = DESIGN["icons"]
ICON_SET = set(ICONS)
FALLBACK_LAYOUT = "title-bullets"

LayoutId = Enum("LayoutId", {lid.replace("-", "_"): lid for lid in LAYOUT_IDS}, type=str)


class ChartType(str, Enum):
    bar = "bar"
    hbar = "hbar"
    line = "line"
    area = "area"
    pie = "pie"
    donut = "donut"


class Series(BaseModel):
    name: str
    values: list[float]


class Chart(BaseModel):
    type: ChartType
    categories: list[str]
    series: list[Series]
    unit: str | None = Field(None, description='Unit for values, e.g. "%", "$M", "users". Short.')


class Table(BaseModel):
    headers: list[str]
    rows: list[list[str]]


class ImageQuery(BaseModel):
    query: str = Field(description="3-6 concrete keywords for a stock-photo search, e.g. 'runner sunrise city street'")
    alt: str = Field(description="Short alt text describing the image")


STR_FIELDS = {"eyebrow", "title", "subtitle", "body", "highlight", "meta", "quote", "author", "role"}
ITEM_STR_FIELDS = {"title", "text", "value", "label", "delta"}
OPTIONAL_FIELDS = {"meta"}


def _desc(name: str, rule: dict) -> str:
    hints = {
        "eyebrow": "Tiny overline label above the title (1-3 words)",
        "highlight": "An exact substring of the title to emphasise",
        "value": "Short figure, e.g. '2.4M', '68%', '$12B', '2026'",
        "delta": "Change vs previous period, signed, e.g. '+18%' or '-4%'",
        "label": "Short label",
        "icon": "Icon name from the allowed list",
        "meta": "Leave empty unless the user gave presenter/date details",
    }
    parts = [hints.get(name, "")]
    if "max" in rule:
        parts.append(f"max {rule['max']} characters")
    if "itemMax" in rule:
        parts.append(f"{rule.get('min', 0)}-{rule['max']} entries, each max {rule['itemMax']} characters")
    elif "min" in rule and "max" in rule:
        parts.append(f"{rule['min']}-{rule['max']} entries")
    return "; ".join(p for p in parts if p)


def _bullets_type(rule: dict):
    return list[str], Field(..., description=_desc("bullets", rule)) if rule.get("min", 0) > 0 else Field(None, description=_desc("bullets", rule))


@lru_cache
def slide_schema(layout: str) -> type[BaseModel]:
    """Flat pydantic model Gemini fills for one slide of `layout` (+ speaker notes)."""
    fields: dict[str, Any] = {}
    for name, rule in SPEC[layout]["fields"].items():
        if name in STR_FIELDS:
            req = name not in OPTIONAL_FIELDS
            fields[name] = (str if req else str | None, Field(... if req else None, description=_desc(name, rule)))
        elif name == "bullets":
            typ, fld = _bullets_type(rule)
            fields[name] = (typ if rule.get("min", 0) > 0 else typ | None, fld)
        elif name == "items":
            item_fields: dict[str, Any] = {}
            for iname, irule in rule["fields"].items():
                if iname == "icon":
                    # Plain string: a 140-value enum exceeds Vertex's schema limits. Validated in sanitize().
                    item_fields[iname] = (str, Field(..., description="Icon name from the allowed list, e.g. 'rocket'"))
                elif iname == "bullets":
                    typ, fld = _bullets_type(irule)
                    item_fields[iname] = (typ if irule.get("min", 0) > 0 else typ | None, fld)
                elif iname == "highlight":
                    item_fields[iname] = (bool | None, Field(None, description="True for the one recommended option"))
                else:
                    item_fields[iname] = (str, Field(..., description=_desc(iname, irule)))
            item_model = create_model(f"Item_{layout.replace('-', '_')}", **item_fields)
            fields[name] = (list[item_model], Field(..., description=_desc("items", rule)))
        elif name == "chart":
            fields[name] = (Chart, Field(..., description=f"Max {rule['maxCategories']} categories and {rule['maxSeries']} series; every series has exactly one value per category. pie/donut use one series."))
        elif name == "table":
            fields[name] = (Table, Field(..., description=f"Max {rule['maxCols']} columns and {rule['maxRows']} rows; cells max {rule['cellMax']} characters"))
        elif name == "image":
            fields[name] = (ImageQuery, Field(...))
    fields["notes"] = (str, Field(..., description="Speaker notes: 2-4 natural sentences the presenter can say"))
    return create_model(f"Slide_{layout.replace('-', '_')}", **fields)


# ---------------------------------------------------------------- arrangements (variants)


def variants(layout: str) -> list[dict]:
    return SPEC.get(layout, {}).get("variants") or []


def normalize_variant(layout: str, v: str | None) -> str | None:
    """A valid arrangement id for `layout` (the default when `v` is missing or unknown)."""
    vs = variants(layout)
    ids = [x["id"] for x in vs]
    v = (v or "").strip().lower()
    return v if v in ids else (ids[0] if ids else None)


def variant_pos(layout: str, v: str | None) -> str:
    v = normalize_variant(layout, v)
    return next((x["pos"] for x in variants(layout) if x["id"] == v), "top")


def pick_variant(layout: str, avoid_pos: set[str], prefer: str | None = None) -> str | None:
    """Keep `prefer` unless its title position repeats a neighbour's; then the first arrangement that doesn't."""
    vs = variants(layout)
    if not vs:
        return None
    cur = normalize_variant(layout, prefer)
    if variant_pos(layout, cur) not in avoid_pos:
        return cur
    return next((x["id"] for x in vs if x["pos"] not in avoid_pos), cur)


def variants_brief(layout: str) -> str:
    return " | ".join(f"{x['id']}: {x['use']}" for x in variants(layout))


def layout_brief(layout: str) -> str:
    """Human-readable field limits for the prompt."""
    lines = [f"Layout `{layout}` ({SPEC[layout]['name']}): {SPEC[layout]['use']}"]
    if SPEC[layout].get("roles"):
        lines.append("Item roles: " + SPEC[layout]["roles"])
    for name, rule in SPEC[layout]["fields"].items():
        if name == "items":
            sub = ", ".join(f"{k}{'≤' + str(v['max']) if 'max' in v else ''}" for k, v in rule["fields"].items())
            lines.append(f"- items: {rule['min']}-{rule['max']} entries, each with {sub} characters")
        elif "max" in rule:
            lines.append(f"- {name}: max {rule['max']} chars")
        elif "itemMax" in rule:
            lines.append(f"- {name}: {rule.get('min', 0)}-{rule['max']} bullets, each ≤{rule['itemMax']} chars")
    return "\n".join(lines)


# ---------------------------------------------------------------- sanitising

_MD = re.compile(r"(\*\*|__|`|^#+\s*|^[-•*]\s+)", re.M)


def clean_text(s: Any) -> str:
    if s is None:
        return ""
    s = _MD.sub("", str(s)).strip()
    return re.sub(r"\s+", " ", s)


def clip(s: str, n: int, slack: float = 1.4) -> str:
    """Hard cap at slack×limit; the browser's auto-fit + Gemini shorten step handle smaller overflows.

    Never ends mid-sentence silently: cut at a sentence end if one keeps most of the text, else add an ellipsis."""
    cap = int(n * slack)
    if len(s) <= cap:
        return s
    head = s[:cap]
    end = max(head.rfind(". "), head.rfind("! "), head.rfind("? "))
    if end >= cap * 0.5:
        return head[: end + 1]
    return head.rsplit(" ", 1)[0].rstrip(",;:—-– ") + "…"


def normalize_icon(name) -> str:
    n = re.sub(r"[\s_]+", "-", str(name or "").strip().lower())
    if n in ICON_SET:
        return n
    for cand in (n.removesuffix("s"), n + "s", n.split("-")[0]):
        if cand in ICON_SET:
            return cand
    return "sparkles"


def _clip_list(xs: list | None, rule: dict) -> list[str]:
    xs = [clean_text(x) for x in (xs or []) if clean_text(x)]
    xs = xs[: rule.get("max", len(xs))]
    if "itemMax" in rule:
        xs = [clip(x, rule["itemMax"]) for x in xs]
    return xs


def sanitize(layout: str, raw: dict) -> tuple[dict, list[str]]:
    """Normalise model output to the layout's spec. Returns (content, problems). Problems mean "unusable"."""
    spec = SPEC[layout]["fields"]
    out: dict[str, Any] = {}
    problems: list[str] = []
    for name, rule in spec.items():
        v = raw.get(name)
        if name in STR_FIELDS:
            t = clean_text(v)
            if t:
                out[name] = clip(t, rule["max"]) if "max" in rule else t
            elif rule.get("required"):
                problems.append(f"missing {name}")
        elif name == "bullets":
            xs = _clip_list(v, rule)
            if len(xs) < rule.get("min", 0):
                problems.append("too few bullets")
            if xs:
                out[name] = xs
        elif name == "items":
            items = []
            for it in (v or [])[: rule["max"]]:
                it = it if isinstance(it, dict) else {}
                clean: dict[str, Any] = {}
                for iname, irule in rule["fields"].items():
                    iv = it.get(iname)
                    if iname == "icon":
                        iv = iv.value if isinstance(iv, Enum) else iv
                        clean["icon"] = normalize_icon(iv)
                    elif iname == "bullets":
                        xs = _clip_list(iv, irule)
                        if xs:
                            clean["bullets"] = xs
                    elif iname == "highlight":
                        if iv:
                            clean["highlight"] = True
                    else:
                        t = clean_text(iv)
                        if t:
                            clean[iname] = clip(t, irule["max"]) if "max" in irule else t
                if any(k in clean for k in ("title", "text", "value", "bullets")):
                    items.append(clean)
            if len(items) < rule["min"]:
                problems.append(f"needs {rule['min']} items, got {len(items)}")
            if items:
                out[name] = items
        elif name == "chart":
            ch = _clean_chart(v, rule)
            if ch:
                out[name] = ch
            else:
                problems.append("invalid chart")
        elif name == "table":
            tb = _clean_table(v, rule)
            if tb:
                out[name] = tb
            else:
                problems.append("invalid table")
        elif name == "image":
            v = v or {}
            q = clean_text(v.get("query")) or clean_text(raw.get("title"))
            out[name] = {"query": q[:80], "alt": clean_text(v.get("alt"))[:120] or q[:80]}
    if layout == "big-statement" and out.get("highlight") and out["highlight"].lower() not in out.get("title", "").lower():
        out.pop("highlight")
    return out, problems


def _clean_chart(v: Any, rule: dict) -> dict | None:
    if not isinstance(v, dict):
        return None
    typ = v.get("type")
    typ = typ.value if isinstance(typ, Enum) else typ
    if typ not in {t.value for t in ChartType}:
        typ = "bar"
    cats = [clean_text(c)[:24] for c in (v.get("categories") or [])][: rule["maxCategories"]]
    n = len(cats)
    series = []
    for s in (v.get("series") or [])[: (1 if typ in ("pie", "donut") else rule["maxSeries"])]:
        vals = []
        for x in (s.get("values") or [])[:n]:
            try:
                vals.append(float(x))
            except (TypeError, ValueError):
                vals.append(0.0)
        vals += [0.0] * (n - len(vals))
        series.append({"name": clean_text(s.get("name"))[:40] or "Series", "values": vals})
    if n < 2 or not series:
        return None
    out = {"type": typ, "categories": cats, "series": series}
    if v.get("unit"):
        out["unit"] = clean_text(v["unit"])[:12]
    return out


def _clean_table(v: Any, rule: dict) -> dict | None:
    if not isinstance(v, dict):
        return None
    headers = [clip(clean_text(h), rule["cellMax"]) for h in (v.get("headers") or [])][: rule["maxCols"]]
    w = len(headers)
    if w < 2:
        return None
    rows = []
    for r in (v.get("rows") or [])[: rule["maxRows"]]:
        cells = [clip(clean_text(c), rule["cellMax"]) for c in (r or [])][:w]
        rows.append(cells + [""] * (w - len(cells)))
    if not rows:
        return None
    return {"headers": headers, "rows": rows}


def to_fallback(content: dict) -> dict:
    """Map any content onto the simple title + bullets layout (used when a layout's data is unusable)."""
    bullets = list(content.get("bullets") or [])
    for it in content.get("items") or []:
        line = ": ".join(x for x in (it.get("value") or it.get("title"), it.get("text")) if x)
        if line:
            bullets.append(line)
        bullets += it.get("bullets") or []
    if not bullets and content.get("body"):
        bullets = [s.strip() for s in re.split(r"(?<=[.!?])\s+", content["body"]) if s.strip()]
    if not bullets and content.get("quote"):
        bullets = [content["quote"]]
    rule = SPEC[FALLBACK_LAYOUT]["fields"]["bullets"]
    out = {
        "eyebrow": content.get("eyebrow"),
        "title": content.get("title") or content.get("author") or "Overview",
        "subtitle": content.get("subtitle"),
        "bullets": [clip(b, rule["itemMax"]) for b in bullets[: rule["max"]]],
    }
    return {k: v for k, v in out.items() if v}
