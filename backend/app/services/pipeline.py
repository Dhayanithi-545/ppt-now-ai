"""Deck generation pipeline on Gemini: clarify -> (research) -> outline -> parallel slides -> images.

Every step returns plain dicts in the frontend's Deck shape (frontend/src/design/types.ts).
One bad slide never fails the deck: retry, then fall back to a simpler layout, then to a minimal slide.
"""

import asyncio
import json
import logging
from collections.abc import AsyncIterator

from . import capabilities, images
from ..db import new_id
from .layouts import DESIGN, FALLBACK_LAYOUT, ICONS, LAYOUT_IDS, SPEC, layout_brief, sanitize, slide_schema, to_fallback
from .llm import generate_json, generate_text
from ..schemas import Brief, ClarifyResult, EditOp, EditPlan, OutlineItem, OutlineLLM, QA

log = logging.getLogger(__name__)

COVERS = {"cover-hero", "cover-split", "cover-editorial"}
WRITER = """You are a world-class presentation writer and information designer (think McKinsey clarity, Apple restraint).
Write crisp, concrete, specific copy. No markdown, no emojis, no numbering inside text, no trailing periods in titles or
short labels. Stay strictly within the character limits given. Prefer strong verbs and concrete numbers.
Never present invented statistics as real facts: use round, plausible figures and mention in the speaker notes when
figures are illustrative. Never write placeholders like [Company Name] or [Your Name]: if a name is needed and
none was given, invent a short plausible one and use it consistently. Write in the requested language."""


def _brief_text(b: Brief, answers: list[QA] | None = None) -> str:
    parts = [f"Request:\n<<<\n{b.prompt}\n>>>", f"Slides: {b.slide_count}", f"Language: {b.language}"]
    if b.audience:
        parts.append(f"Audience: {b.audience}")
    if b.purpose:
        parts.append(f"Purpose: {b.purpose}")
    if b.tone:
        parts.append(f"Tone: {b.tone}")
    for qa in answers or []:
        if qa.answer.strip():
            parts.append(f"{qa.question} -> {qa.answer}")
    return "\n".join(parts)


# ---------------------------------------------------------------- clarify


async def clarify(brief: Brief) -> ClarifyResult:
    # A detailed request needs no questions; save the round trip.
    if len(brief.prompt) > 220 or (brief.audience and brief.tone):
        return ClarifyResult(needs_clarification=False, questions=[])
    system = """You help users brief a presentation. Decide if the request is too vague to produce an excellent deck
(e.g. just a topic with no audience or goal). If it is clear enough, return needs_clarification=false and no questions.
Otherwise ask at most 3 short questions (audience, purpose/goal, tone or depth), each with 2-4 short suggested answers."""
    return await generate_json(_brief_text(brief), ClarifyResult, system, temperature=0.3, what="clarify")


# ---------------------------------------------------------------- research (Google Search grounding)


async def research(brief: Brief, answers: list[QA]) -> str | None:
    if not brief.research or not (await capabilities.get())["grounding"]:
        return None
    system = "You are a research assistant. Use Google Search. Be factual and cite sources by name and year."
    prompt = (
        f"{_brief_text(brief, answers)}\n\nCollect 10-15 concise, current facts and statistics useful for this presentation. "
        "One fact per line, each with its source and year in parentheses. Plain text, no markdown."
    )
    try:
        return (await generate_text(prompt, system, grounded=True, what="research"))[:6000]
    except Exception as e:
        log.warning("research failed: %s", e)
        return None


# ---------------------------------------------------------------- outline


def _catalog() -> str:
    return "\n".join(f"- {lid}: {SPEC[lid]['use']}" for lid in LAYOUT_IDS)


OUTLINE_SYSTEM = f"""You are a senior presentation strategist. Plan a deck with a clear narrative arc
(hook -> context -> substance -> evidence -> takeaway / call to action).
Pick one layout per slide from this library:
{_catalog()}

Layout rules (follow strictly):
- Slide 1 is a cover (cover-hero, cover-split or cover-editorial). The last slide is `closing`.
- Make the deck visually varied: never use the same layout more than 2 times in a row, and use at least
  {"{min_layouts}"} different layouts overall.
- Use data layouts (stats-big-numbers, kpi-cards, chart-insight, chart-full, market-size, table) wherever numbers fit.
- Use icon layouts (icon-grid-3/4/6, process-steps) for parallel ideas or steps instead of plain bullets.
- Use image layouts (image-text-left/right, full-bleed-image, cover-split) for emotional or illustrative moments.
- Use big-statement or quote for a memorable insight (at most once each).
- title-bullets at most twice. agenda only for 8+ slides. section-divider only for 12+ slides, at most 1 per 5 slides.
- Pitch decks: problem-solution, market-size, pricing-tiers or team-grid where relevant.
- Titles are short (max ~8 words) and specific; they read like headlines, not labels.
- Never use placeholders like [Startup Name]; if the product has no name, invent a short brandable one."""


def fix_outline(items: list[OutlineItem], count: int) -> list[OutlineItem]:
    """Enforce structure and variety the model may have missed."""
    items = [i for i in items if i.title.strip()][:count]
    if not items:
        return items
    layouts = [i.layout.value for i in items]
    if layouts[0] not in COVERS:
        layouts[0] = "cover-hero"
    if len(layouts) > 2 and layouts[-1] != "closing":
        layouts[-1] = "closing"
    alt = {
        "title-bullets": "icon-grid-3", "icon-grid-3": "icon-grid-4", "icon-grid-4": "process-steps",
        "image-text-left": "image-text-right", "image-text-right": "image-text-left", "stats-big-numbers": "kpi-cards",
        "kpi-cards": "chart-insight", "chart-insight": "stats-big-numbers", "big-statement": "image-text-right",
    }
    for i in range(1, len(layouts) - 1):
        if layouts[i] in COVERS or layouts[i] == "closing":
            layouts[i] = "big-statement"
        if i >= 2 and layouts[i] == layouts[i - 1] == layouts[i - 2]:
            layouts[i] = alt.get(layouts[i], "icon-grid-3")
        if layouts[i] == "section-divider" and count < 10:
            layouts[i] = "big-statement"
    from .layouts import LayoutId

    return [OutlineItem(title=it.title.strip(), layout=LayoutId(lay), intent=it.intent.strip()) for it, lay in zip(items, layouts)]


async def outline(brief: Brief, answers: list[QA], research_notes: str | None) -> tuple[str, list[OutlineItem]]:
    prompt = _brief_text(brief, answers) + f"\n\nPlan exactly {brief.slide_count} slides."
    if research_notes:
        prompt += f"\n\nResearch notes (use where relevant):\n{research_notes}"
    system = OUTLINE_SYSTEM.replace("{min_layouts}", str(min(brief.slide_count - 1, 7)))
    res = await generate_json(prompt, OutlineLLM, system, temperature=0.7, what="outline", thinking=1024)
    items = [OutlineItem(title=s.title, layout=s.layout, intent=s.intent) for s in res.slides]
    return res.title.strip(), fix_outline(items, brief.slide_count)


# ---------------------------------------------------------------- slides


def _slide_prompt(deck: dict, index: int, item: dict, extra: str | None = None, current: dict | None = None) -> str:
    b = deck.get("brief") or {}
    lines = [
        f"Deck title: {deck.get('title')}",
        f"Audience: {b.get('audience') or 'general'} | Tone: {b.get('tone') or 'confident, clear'} | Language: {b.get('language', 'English')}",
        f"Original request: {(b.get('prompt') or '')[:1500]}",
        "Deck outline:",
        *[f"  {i + 1}. {o['title']}" + ("   <- THIS SLIDE" if i == index else "") for i, o in enumerate(deck.get("outline") or [])],
        "",
        f"Write slide {index + 1}: \"{item['title']}\"",
        f"Intent: {item.get('intent') or ''}",
        layout_brief(item["layout"]),
    ]
    fields = SPEC[item["layout"]]["fields"]
    if "items" in fields and "icon" in fields["items"]["fields"]:
        lines.append("Allowed icons: " + ", ".join(ICONS))
    if "image" in fields:
        lines.append("image.query: concrete, photographable subject for a stock photo search (no abstract words like 'innovation').")
    if "chart" in fields:
        lines.append("chart: realistic data that supports the title; categories are short labels; keep units consistent.")
    if deck.get("research"):
        lines.append("Research notes (prefer these facts):\n" + deck["research"][:3000])
    if current:
        lines.append("Current slide content (JSON) to revise:\n" + json.dumps(current, ensure_ascii=False)[:3000])
    if extra:
        lines.append(f"Instruction: {extra}")
    lines.append("Keep the title close to the outline title unless the instruction says otherwise.")
    return "\n".join(lines)


async def _fill(deck: dict, index: int, item: dict, extra: str | None, current: dict | None) -> tuple[dict, str] | None:
    layout = item["layout"]
    schema = slide_schema(layout)
    feedback = extra
    for attempt in range(2):
        try:
            res = await generate_json(_slide_prompt(deck, index, item, feedback, current), schema, WRITER, what=f"slide {index + 1}")
        except Exception as e:
            log.warning("slide %d (%s) attempt %d failed: %s", index + 1, layout, attempt + 1, e)
            continue
        raw = res.model_dump(mode="json")
        content, problems = sanitize(layout, raw)
        if not problems:
            return content, raw.get("notes") or ""
        log.info("slide %d (%s) unusable: %s", index + 1, layout, problems)
        feedback = (extra + "\n" if extra else "") + "Previous attempt was invalid: " + "; ".join(problems)
    return None


async def generate_slide(deck: dict, index: int, item: dict, extra: str | None = None, current: dict | None = None, slide_id: str | None = None) -> dict:
    """Content for one slide. Retry -> simpler layout -> minimal slide; never raises."""
    sid = slide_id or new_id()
    got = await _fill(deck, index, item, extra, current)
    layout = item["layout"]
    if got is None and layout != FALLBACK_LAYOUT:
        log.warning("slide %d falling back from %s to %s", index + 1, layout, FALLBACK_LAYOUT)
        layout = FALLBACK_LAYOUT
        got = await _fill(deck, index, {**item, "layout": layout}, extra, current)
    if got is None:
        content = {"title": item["title"], "subtitle": item.get("intent") or "", "bullets": [item.get("intent") or item["title"]]}
        return {"id": sid, "layout": FALLBACK_LAYOUT, "content": content, "notes": "", "error": True}
    content, notes = got
    return {"id": sid, "layout": layout, "content": content, "notes": notes}


async def attach_image(slide: dict) -> bool:
    """Resolve the slide's image query to a real image (stock -> generated). False = keep illustration."""
    img = slide["content"].get("image")
    if not img or img.get("url") or not img.get("query"):
        return False
    found = await images.resolve_slide_image(img["query"])
    if not found:
        return False
    slide["content"]["image"] = {**img, **found}
    return True


def sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def generate_deck(deck: dict, concurrency: int) -> AsyncIterator[tuple[str, dict]]:
    """Fill every slide in parallel (bounded) and yield events as each finishes."""
    outline_items = deck["outline"]
    sem = asyncio.Semaphore(concurrency)
    queue: asyncio.Queue = asyncio.Queue()

    async def one(i: int, item: dict):
        async with sem:
            slide = await generate_slide(deck, i, item, slide_id=deck["slides"][i]["id"])
        deck["slides"][i] = slide
        await queue.put(("slide", {"index": i, "slide": slide}))
        if await attach_image(slide):
            await queue.put(("slide", {"index": i, "slide": slide}))

    tasks = [asyncio.create_task(one(i, it)) for i, it in enumerate(outline_items)]
    done = asyncio.gather(*tasks, return_exceptions=True)
    while not (done.done() and queue.empty()):
        try:
            yield await asyncio.wait_for(queue.get(), 0.25)
        except TimeoutError:
            continue
    for r in done.result():
        if isinstance(r, Exception):
            log.error("slide task crashed: %s", r)


# ---------------------------------------------------------------- auto-fit (shorten)


async def shorten_slide(deck: dict, index: int, slide: dict, attempt: int) -> dict:
    pct = {1: 25, 2: 40, 3: 50}[attempt]
    item = {"title": slide["content"].get("title") or "", "layout": slide["layout"], "intent": ""}
    instruction = (
        f"The text overflows the slide. Rewrite it about {pct}% shorter: tighter wording, same meaning, same number of "
        "items, same numbers. Keep the speaker notes."
    )
    new = await generate_slide(deck, index, item, instruction, current=slide["content"], slide_id=slide["id"])
    if new.get("error") or new["layout"] != slide["layout"]:
        return slide
    # Keep the resolved image and the old notes if the model dropped them.
    if slide["content"].get("image"):
        new["content"]["image"] = slide["content"]["image"]
    new["notes"] = new.get("notes") or slide.get("notes", "")
    return new


# ---------------------------------------------------------------- regenerate / chat edits


async def regenerate_slide(deck: dict, index: int, instruction: str | None, layout: str | None) -> dict:
    cur = deck["slides"][index]
    lay = layout or cur["layout"]
    outline_item = (deck.get("outline") or [{}] * len(deck["slides"]))[index] if index < len(deck.get("outline") or []) else {}
    item = {"title": cur["content"].get("title") or cur["content"].get("quote") or outline_item.get("title", "Slide"), "layout": lay,
            "intent": outline_item.get("intent", "")}
    extra = instruction or "Write a fresh, stronger version of this slide."
    new = await generate_slide(deck, index, item, extra, current=cur["content"], slide_id=cur["id"])
    old_img = cur["content"].get("image")
    if "image" in new["content"] and old_img and old_img.get("url") and not instruction:
        new["content"]["image"] = old_img
    else:
        await attach_image(new)
    return new


EDIT_SYSTEM = f"""You edit an existing slide deck based on the user's chat message. Return a short reply and a list of
operations. Slide numbers are 1-based and refer to the deck AS GIVEN (before your operations).
Operations:
- update_slide: rewrite slide `slide` following `instruction` (optionally switch `layout`). Use for "make slide 4 more
  visual" (pick a more visual layout such as icon-grid, stats, image or chart layouts), "shorten", "add data", etc.
- insert_slide: new slide AFTER slide `slide` (0 = very beginning) with `title`, `layout` and `instruction`.
- delete_slide, move_slide (slide -> to).
- update_all: apply `instruction` to every slide (tone, language, audience changes).
- set_theme: switch to a built-in theme id: {", ".join(t["id"] + " (" + t["name"] + ")" for t in DESIGN["builtinThemes"])}.
- rename_deck: new deck `title`.
Layouts available: {", ".join(LAYOUT_IDS)}.
Only do what the user asked. If the request is unclear, return no operations and ask a question in `reply`."""


def _deck_summary(deck: dict, current: int | None) -> str:
    lines = [f"Deck: {deck.get('title')} | theme: {deck.get('themeId')}"]
    for i, s in enumerate(deck["slides"]):
        c = s["content"]
        mark = "  <- user is viewing" if current == i else ""
        lines.append(f"{i + 1}. [{s['layout']}] {c.get('title') or c.get('quote', '')[:60]}{mark}")
    return "\n".join(lines)


async def chat_edit(deck: dict, message: str, current: int | None) -> tuple[dict, str, list[str]]:
    plan = await generate_json(
        f"{_deck_summary(deck, current)}\n\nUser message: {message}", EditPlan, EDIT_SYSTEM, temperature=0.3, what="chat-edit"
    )
    slides = list(deck["slides"])
    by_pos = {i + 1: s["id"] for i, s in enumerate(slides)}
    jobs: list[tuple[str, dict, str | None]] = []  # (slide_id, outline item, instruction)
    changed: list[str] = []
    outline_by_id = {s["id"]: o for s, o in zip(deck["slides"], deck.get("outline") or [])}

    def pos(sid: str) -> int:
        return next(i for i, s in enumerate(slides) if s["id"] == sid)

    for op in plan.operations:
        sid = by_pos.get(op.slide or 0)
        if op.op == EditOp.update_slide and sid:
            cur = slides[pos(sid)]
            lay = op.layout.value if op.layout else cur["layout"]
            jobs.append((sid, {"title": cur["content"].get("title") or "Slide", "layout": lay, "intent": outline_by_id.get(sid, {}).get("intent", "")}, op.instruction))
        elif op.op == EditOp.insert_slide:
            new = {"id": new_id(), "layout": (op.layout.value if op.layout else "icon-grid-3"), "content": {"title": op.title or "New slide"}, "notes": ""}
            at = 0 if not sid else pos(sid) + 1
            slides.insert(at, new)
            jobs.append((new["id"], {"title": op.title or "New slide", "layout": new["layout"], "intent": op.instruction or ""}, op.instruction))
        elif op.op == EditOp.delete_slide and sid and len(slides) > 1:
            slides.pop(pos(sid))
            changed.append(sid)
        elif op.op == EditOp.move_slide and sid and op.to:
            s = slides.pop(pos(sid))
            slides.insert(max(0, min(len(slides), op.to - 1)), s)
            changed.append(sid)
        elif op.op == EditOp.update_all:
            for s in slides:
                jobs.append((s["id"], {"title": s["content"].get("title") or "Slide", "layout": s["layout"], "intent": ""}, op.instruction))
        elif op.op == EditOp.set_theme and op.theme_id:
            deck["themeId"] = op.theme_id.value
            deck.pop("theme", None)
            changed.append("theme")
        elif op.op == EditOp.rename_deck and op.title:
            deck["title"] = op.title.strip()

    # Regenerate affected slides in parallel against the new order.
    deck["slides"] = slides
    deck["outline"] = [{"title": s["content"].get("title") or "", "layout": s["layout"], "intent": outline_by_id.get(s["id"], {}).get("intent", "")} for s in slides]

    async def run(sid: str, item: dict, instruction: str | None):
        i = pos(sid)
        cur = slides[i]
        has_content = len(cur["content"]) > 1
        new = await generate_slide(deck, i, item, instruction, current=cur["content"] if has_content else None, slide_id=sid)
        if cur["content"].get("image", {}).get("url") and "image" in new["content"]:
            new["content"]["image"] = cur["content"]["image"]
        else:
            await attach_image(new)
        slides[pos(sid)] = new
        changed.append(sid)

    sem = asyncio.Semaphore(6)

    async def bounded(*a):
        async with sem:
            await run(*a)

    seen: set[str] = set()
    uniq = [j for j in jobs if not (j[0] in seen or seen.add(j[0]))]
    await asyncio.gather(*(bounded(*j) for j in uniq))
    deck["slides"] = slides
    return deck, plan.reply, changed
