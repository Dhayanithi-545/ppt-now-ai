"""Outline / slide JSON parsing, outline repair, slide fallbacks and chat-edit operations (Gemini mocked)."""

import asyncio
import json

import pytest

from app.services import layouts, pipeline
from app.services.layouts import LayoutId, slide_schema
from app.schemas import EditPlan, OutlineItem, OutlineLLM


def item(layout: str, title: str = "T") -> OutlineItem:
    return OutlineItem(title=title, layout=LayoutId(layout), intent="i")


# ------------------------------------------------------------ parsing


def test_outline_json_parses():
    raw = json.dumps({"title": "Deck", "slides": [{"title": "Hello", "layout": "cover-hero", "intent": "open"}]})
    o = OutlineLLM.model_validate_json(raw)
    assert o.slides[0].layout.value == "cover-hero"


def test_outline_rejects_unknown_layout():
    with pytest.raises(Exception):
        OutlineLLM.model_validate({"title": "D", "slides": [{"title": "x", "layout": "hologram", "intent": ""}]})


def test_slide_json_parses_per_layout():
    raw = {
        "eyebrow": "E", "title": "Title", "subtitle": "S",
        "items": [{"icon": "rocket", "title": "a", "text": "b"}] * 3,
        "notes": "Say this.",
    }
    m = slide_schema("icon-grid-3").model_validate(raw)
    assert m.model_dump()["items"][0]["icon"] == "rocket"
    with pytest.raises(Exception):
        slide_schema("icon-grid-3").model_validate({"title": "missing items", "notes": ""})


def test_edit_plan_parses_flat_operations():
    plan = EditPlan.model_validate({"reply": "ok", "operations": [
        {"op": "insert_slide", "slide": 6, "layout": "pros-cons", "title": "Risks", "instruction": "risks"},
        {"op": "set_theme", "theme_id": "swiss"},
    ]})
    assert plan.operations[0].layout.value == "pros-cons"
    assert plan.operations[1].theme_id.value == "swiss"


# ------------------------------------------------------------ outline repair


def test_fix_outline_enforces_cover_closing_and_variety():
    items = [item("title-bullets")] + [item("icon-grid-3", f"s{i}") for i in range(4)] + [item("cover-hero"), item("table")]
    fixed = [i.layout.value for i in pipeline.fix_outline(items, 7)]
    assert fixed[0] in pipeline.COVERS
    assert fixed[-1] == "closing"
    for a, b, c in zip(fixed, fixed[1:], fixed[2:]):
        assert not (a == b == c), fixed
    assert "cover-hero" not in fixed[1:-1]


def test_fix_outline_keeps_valid_arrangements_and_varies_neighbours():
    items = [item("cover-hero")] + [item("title-bullets", f"s{i}") for i in range(3)] + [item("closing")]
    items[0].variant = "bottom"
    items[1].variant = "nonsense"
    fixed = pipeline.fix_outline(items, 5)
    assert fixed[0].variant == "bottom"
    ids = {v["id"] for v in layouts.variants("title-bullets")}
    assert all(i.variant in ids for i in fixed[1:4])
    pos = [layouts.variant_pos(i.layout.value, i.variant) for i in fixed]
    for a, b in zip(pos, pos[1:]):
        assert a != b, pos


def test_fix_outline_drops_arrangement_when_layout_is_replaced():
    items = [item("table"), item("cover-hero"), item("closing")]
    items[0].variant = "center"
    fixed = pipeline.fix_outline(items, 3)
    assert fixed[0].layout.value == "cover-hero" and fixed[0].variant in {v["id"] for v in layouts.variants("cover-hero")}


def test_fix_outline_drops_dividers_in_short_decks_and_trims_count():
    items = [item("cover-hero"), item("section-divider"), item("agenda"), item("closing"), item("closing")]
    fixed = [i.layout.value for i in pipeline.fix_outline(items, 4)]
    assert len(fixed) == 4 and "section-divider" not in fixed


# ------------------------------------------------------------ slide generation fallbacks


class FakeResponse:
    def __init__(self, data):
        self.data = data

    def model_dump(self, mode="json"):
        return self.data


def run(coro):
    return asyncio.run(coro)


DECK = {"title": "D", "brief": {"prompt": "p"}, "outline": [{"title": "A", "layout": "icon-grid-3", "intent": ""}], "slides": []}


def test_generate_slide_success(monkeypatch):
    async def fake(prompt, schema, system, **kw):
        return FakeResponse({"eyebrow": "E", "title": "A", "items": [{"icon": "rocket", "title": "x", "text": "y"}] * 3, "notes": "n"})

    monkeypatch.setattr(pipeline, "generate_json", fake)
    s = run(pipeline.generate_slide(DECK, 0, {"title": "A", "layout": "icon-grid-3", "intent": ""}))
    assert s["layout"] == "icon-grid-3" and s["notes"] == "n" and len(s["content"]["items"]) == 3


def test_generate_slide_falls_back_to_simpler_layout(monkeypatch):
    calls = []

    async def fake(prompt, schema, system, **kw):
        calls.append(schema.__name__)
        if "icon_grid_3" in schema.__name__:
            return FakeResponse({"title": "A", "items": [], "notes": ""})  # unusable: too few items
        return FakeResponse({"title": "A", "bullets": ["one", "two", "three"], "notes": "n"})

    monkeypatch.setattr(pipeline, "generate_json", fake)
    s = run(pipeline.generate_slide(DECK, 0, {"title": "A", "layout": "icon-grid-3", "intent": ""}))
    assert s["layout"] == "title-bullets" and s["content"]["bullets"] == ["one", "two", "three"]
    assert calls.count("Slide_icon_grid_3") == 2  # one retry with feedback before falling back


def test_generate_slide_never_raises(monkeypatch):
    async def boom(*a, **kw):
        raise RuntimeError("vertex down")

    monkeypatch.setattr(pipeline, "generate_json", boom)
    s = run(pipeline.generate_slide(DECK, 0, {"title": "A", "layout": "icon-grid-3", "intent": "why"}))
    assert s["error"] and s["layout"] == "title-bullets" and s["content"]["title"] == "A"


def test_sse_format():
    assert pipeline.sse("slide", {"a": 1}) == 'event: slide\ndata: {"a": 1}\n\n'


# ------------------------------------------------------------ chat edits


def test_chat_edit_applies_structural_operations(monkeypatch):
    deck = {
        "id": "d", "title": "Deck", "themeId": "midnight",
        "slides": [{"id": f"s{i}", "layout": "title-bullets", "content": {"title": f"S{i}", "bullets": ["a", "b", "c"]}, "notes": ""} for i in range(4)],
        "outline": [{"title": f"S{i}", "layout": "title-bullets", "intent": ""} for i in range(4)],
    }
    plan = EditPlan.model_validate({"reply": "Done", "operations": [
        {"op": "insert_slide", "slide": 2, "layout": "pros-cons", "title": "Risks", "instruction": "risks"},
        {"op": "delete_slide", "slide": 4},
        {"op": "set_theme", "theme_id": "swiss"},
        {"op": "rename_deck", "title": "New name"},
    ]})

    async def fake_plan(*a, **kw):
        return plan

    async def fake_slide(deck_, index, item, extra=None, current=None, slide_id=None):
        return {"id": slide_id, "layout": item["layout"], "content": {"title": item["title"]}, "notes": ""}

    async def no_image(slide):
        return False

    monkeypatch.setattr(pipeline, "generate_json", fake_plan)
    monkeypatch.setattr(pipeline, "generate_slide", fake_slide)
    monkeypatch.setattr(pipeline, "attach_image", no_image)
    out, reply, changed = run(pipeline.chat_edit(deck, "add risks after 2, drop slide 4, swiss", 0))
    titles = [s["content"]["title"] for s in out["slides"]]
    assert titles == ["S0", "S1", "Risks", "S2"]
    assert out["slides"][2]["layout"] == "pros-cons"
    assert out["themeId"] == "swiss" and out["title"] == "New name"
    assert reply == "Done" and "theme" in changed


def test_chat_edit_rearrange_moves_things_without_rewriting(monkeypatch):
    deck = {
        "id": "d", "title": "Deck", "themeId": "midnight",
        "slides": [{"id": "s0", "layout": "title-bullets", "variant": "list", "content": {"title": "S0", "bullets": ["a", "b", "c"]}, "notes": ""}],
        "outline": [{"title": "S0", "layout": "title-bullets", "intent": ""}],
    }
    plan = EditPlan.model_validate({"reply": "Moved", "operations": [{"op": "rearrange", "slide": 1, "variant": "split"}]})

    async def fake_plan(*a, **kw):
        return plan

    async def no_rewrite(*a, **kw):
        raise AssertionError("rearrange must not regenerate the slide")

    monkeypatch.setattr(pipeline, "generate_json", fake_plan)
    monkeypatch.setattr(pipeline, "generate_slide", no_rewrite)
    out, _, changed = run(pipeline.chat_edit(deck, "put the title on the side", 0))
    assert out["slides"][0]["variant"] == "split" and out["slides"][0]["content"]["title"] == "S0"
    assert changed == ["s0"]


def test_generate_slide_returns_arrangement(monkeypatch):
    async def fake(prompt, schema, system, **kw):
        assert "Arrangement:" in prompt
        return FakeResponse({"eyebrow": "E", "title": "A", "items": [{"icon": "rocket", "title": "x", "text": "y"}] * 3, "notes": "n"})

    monkeypatch.setattr(pipeline, "generate_json", fake)
    s = run(pipeline.generate_slide(DECK, 0, {"title": "A", "layout": "icon-grid-3", "variant": "open", "intent": ""}))
    assert s["variant"] == "open"
