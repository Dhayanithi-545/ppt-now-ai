"""Layout spec, per-layout Gemini schemas and sanitising of model output."""

import pytest

from conftest import FRONTEND

from app.services.layouts import (
    DESIGN, FALLBACK_LAYOUT, LAYOUT_IDS, SPEC, clip, layout_brief, normalize_icon, sanitize, slide_schema, to_fallback,
)


def test_at_least_25_layouts_and_shared_with_frontend():
    assert len(LAYOUT_IDS) >= 25
    samples = (FRONTEND / "src" / "slides" / "samples.ts").read_text(encoding="utf-8")
    registry = (FRONTEND / "src" / "slides" / "registry.tsx").read_text(encoding="utf-8")
    for lid in LAYOUT_IDS:
        key = f"'{lid}'" if "-" in lid else f"{lid}:"
        assert key in registry, f"{lid} missing from the React registry"
        assert key in samples, f"{lid} missing from samples"


@pytest.mark.parametrize("layout", LAYOUT_IDS)
def test_schema_builds_without_large_enums(layout):
    schema = slide_schema(layout).model_json_schema()
    assert "notes" in schema["required"]
    # Vertex rejects schemas with too much branching (e.g. a 140-value icon enum).
    for d in schema.get("$defs", {}).values():
        assert len(d.get("enum", [])) <= 40
    for prop in schema["properties"].values():
        assert len(prop.get("enum", [])) <= 40
    assert layout_brief(layout).startswith(f"Layout `{layout}`")


def test_every_layout_has_a_required_field():
    for lid, spec in SPEC.items():
        assert [k for k, v in spec["fields"].items() if v.get("required")], lid


def test_allowed_icons_exist_in_frontend_icon_map():
    icon_map = (FRONTEND / "src" / "design" / "iconMap.ts").read_text(encoding="utf-8")
    for name in DESIGN["icons"]:
        assert f'"{name}":' in icon_map, name


def test_clip_prefers_sentence_end_and_marks_cuts():
    s = "First sentence is here. Second sentence goes on and on and on for a long time."
    assert clip(s, 30) == "First sentence is here."
    out = clip(("word " * 40).strip(), 20)
    assert out.endswith("…") and len(out) <= 30
    assert clip("short", 10) == "short"


def test_normalize_icon():
    assert normalize_icon("rocket") == "rocket"
    assert normalize_icon("Trending Up") == "trending-up"
    assert normalize_icon("rockets") == "rocket"
    assert normalize_icon("not-an-icon-xyz") == "sparkles"


def test_sanitize_strips_markdown_clamps_items_and_drops_unknown_keys():
    raw = {
        "eyebrow": "**Why**", "title": "Three things", "subtitle": "x",
        "items": [{"icon": "Brain", "title": f"T{i}", "text": "- body"} for i in range(5)],
        "unknown": "dropped",
    }
    out, problems = sanitize("icon-grid-3", raw)
    assert not problems
    assert out["eyebrow"] == "Why"
    assert len(out["items"]) == 3
    assert out["items"][0] == {"icon": "brain", "title": "T0", "text": "body"}
    assert "unknown" not in out


def test_sanitize_reports_too_few_items():
    _, problems = sanitize("icon-grid-4", {"title": "x", "items": [{"icon": "x", "title": "a", "text": "b"}]})
    assert problems and "needs 4 items" in problems[0]


def test_sanitize_repairs_chart():
    raw = {
        "title": "Chart",
        "chart": {"type": "donut", "categories": ["A", "B", "C"],
                  "series": [{"name": "s1", "values": [1, "2"]}, {"name": "s2", "values": [3, 4, 5]}]},
        "items": [{"value": "+3%", "text": "insight"}],
    }
    out, problems = sanitize("chart-insight", raw)
    assert not problems
    # pie/donut keep a single series; missing values are padded with 0
    assert out["chart"]["series"] == [{"name": "s1", "values": [1.0, 2.0, 0.0]}]


def test_sanitize_rejects_unusable_chart_and_table():
    _, p1 = sanitize("chart-full", {"title": "x", "chart": {"type": "bar", "categories": ["only"], "series": []}})
    _, p2 = sanitize("table", {"title": "x", "table": {"headers": ["one"], "rows": []}})
    assert "invalid chart" in p1 and "invalid table" in p2


def test_sanitize_table_pads_and_trims_rows():
    out, problems = sanitize("table", {"title": "T", "table": {"headers": ["a", "b"], "rows": [["1"], ["1", "2", "3"]]}})
    assert not problems
    assert out["table"]["rows"] == [["1", ""], ["1", "2"]]


def test_big_statement_highlight_must_be_in_title():
    out, _ = sanitize("big-statement", {"title": "Do less, better", "highlight": "nowhere", "eyebrow": "x"})
    assert "highlight" not in out
    out, _ = sanitize("big-statement", {"title": "Do less, better", "highlight": "better", "eyebrow": "x"})
    assert out["highlight"] == "better"


def test_image_query_falls_back_to_title():
    out, _ = sanitize("image-text-left", {"title": "Mountain at dawn", "body": "b", "image": None})
    assert out["image"]["query"] == "Mountain at dawn"


def test_to_fallback_maps_items_to_bullets():
    fb = to_fallback({"title": "T", "items": [{"value": "2M", "text": "users"}, {"title": "Fast", "bullets": ["a", "b"]}]})
    assert fb["title"] == "T"
    assert fb["bullets"] == ["2M: users", "Fast", "a", "b"]
    _, problems = sanitize(FALLBACK_LAYOUT, fb)
    assert not problems
