import asyncio
import logging
import re
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import db
from .config import get_settings
from .schemas import (
    Brief, ChatEditRequest, ExportRequest, FitRequest, GenerateRequest, OutlineRequest, RegenerateRequest, ThemePromptRequest,
)
from .services import capabilities, export_pdf, images, pipeline
from .services.themes import theme_from_prompt

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("aira")


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init()
    get_settings().media_dir.mkdir(parents=True, exist_ok=True)
    probe = asyncio.create_task(capabilities.get())  # detect optional services in the background
    yield
    probe.cancel()
    await export_pdf.shutdown()


app = FastAPI(title="Aira PPT API", version="2.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


async def _deck_or_404(deck_id: str) -> dict:
    deck = await db.get_deck(deck_id)
    if not deck:
        raise HTTPException(404, "deck not found")
    return deck


def _check_prompt(text: str):
    if len(text) > get_settings().max_prompt_chars:
        raise HTTPException(413, f"prompt exceeds {get_settings().max_prompt_chars} characters")


def _safe_filename(name: str | None, fallback: str, ext: str) -> str:
    base = re.sub(r'[\\/:*?"<>|\x00-\x1f]', "", (name or fallback)).strip().rstrip(".")[:100] or "presentation"
    return base if base.lower().endswith(ext) else base + ext


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/capabilities")
async def get_capabilities(refresh: bool = False):
    return await capabilities.get(refresh)


# ------------------------------------------------------------------ decks


@app.get("/api/decks")
async def list_decks():
    return await db.list_decks()


@app.post("/api/decks/clarify")
async def clarify(brief: Brief):
    _check_prompt(brief.prompt)
    try:
        return await pipeline.clarify(brief)
    except Exception:
        log.exception("clarify failed")
        return {"needs_clarification": False, "questions": []}


@app.post("/api/decks/outline")
async def create_outline(req: OutlineRequest):
    _check_prompt(req.brief.prompt)
    notes = await pipeline.research(req.brief, req.answers)
    try:
        title, items = await pipeline.outline(req.brief, req.answers, notes)
    except Exception:
        log.exception("outline failed")
        raise HTTPException(502, "Could not create an outline. Please try again.")
    deck = {
        "id": db.new_id(),
        "title": title,
        "themeId": req.theme_id,
        "brief": req.brief.model_dump(),
        "answers": [a.model_dump() for a in req.answers],
        "research": notes,
        "outline": [i.model_dump(mode="json") for i in items],
        "slides": [],
        "status": "outline",
    }
    if req.theme:
        deck["theme"] = req.theme
    await db.save_deck(deck, "outline", version=False)
    return deck


@app.get("/api/decks/{deck_id}")
async def get_deck(deck_id: str):
    return await _deck_or_404(deck_id)


@app.patch("/api/decks/{deck_id}")
async def save_deck(deck_id: str, deck: dict):
    """Save edits from the editor; every save creates a version (pruned to the newest N)."""
    old = await _deck_or_404(deck_id)
    keep = {k: old.get(k) for k in ("brief", "answers", "research") if k in old}
    deck = {**keep, **deck, "id": deck_id}
    return await db.save_deck(deck, deck.pop("_note", None) or "edit")


@app.delete("/api/decks/{deck_id}")
async def delete_deck(deck_id: str):
    await db.delete_deck(deck_id)
    return {"ok": True}


@app.get("/api/decks/{deck_id}/versions")
async def list_versions(deck_id: str):
    return await db.versions(deck_id)


@app.get("/api/decks/{deck_id}/versions/{vid}")
async def get_version(deck_id: str, vid: int):
    v = await db.version(deck_id, vid)
    if not v:
        raise HTTPException(404, "version not found")
    return v


@app.post("/api/decks/{deck_id}/generate")
async def generate(deck_id: str, req: GenerateRequest):
    """Server-sent events: `start`, one `slide` per finished slide (again when its image arrives), `done`."""
    deck = await _deck_or_404(deck_id)
    if req.outline:
        deck["outline"] = [i.model_dump(mode="json") for i in req.outline]
    if req.title:
        deck["title"] = req.title.strip()
    if not deck.get("outline"):
        raise HTTPException(400, "deck has no outline")
    deck["slides"] = [
        {"id": db.new_id(), "layout": o["layout"], "content": {"title": o["title"]}, "notes": "", "pending": True}
        for o in deck["outline"]
    ]
    deck["status"] = "generating"
    await db.save_deck(deck, version=False)

    async def stream():
        yield pipeline.sse("start", {"deck": deck})
        try:
            async for event, data in pipeline.generate_deck(deck, get_settings().slide_concurrency):
                yield pipeline.sse(event, data)
        except Exception:
            log.exception("generation failed")
            yield pipeline.sse("error", {"message": "Generation stopped unexpectedly. Finished slides were kept."})
        deck["status"] = "ready"
        for s in deck["slides"]:
            s.pop("pending", None)
        await db.save_deck(deck, "generated")
        yield pipeline.sse("done", {"deck": deck})

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/api/decks/{deck_id}/chat-edit")
async def chat_edit(deck_id: str, req: ChatEditRequest):
    deck = req.deck or await _deck_or_404(deck_id)
    deck["id"] = deck_id
    try:
        deck, reply, changed = await pipeline.chat_edit(deck, req.message, req.current_slide)
    except Exception:
        log.exception("chat edit failed")
        raise HTTPException(502, "I couldn't apply that edit. Please rephrase or try again.")
    await db.save_deck(deck, f"chat: {req.message[:60]}")
    return {"deck": deck, "reply": reply, "changed": changed}


@app.post("/api/decks/{deck_id}/slides/{n}/regenerate")
async def regenerate(deck_id: str, n: int, req: RegenerateRequest):
    deck = req.deck or await _deck_or_404(deck_id)
    if not 0 <= n < len(deck["slides"]):
        raise HTTPException(404, "slide not found")
    slide = await pipeline.regenerate_slide(deck, n, req.instruction, req.layout.value if req.layout else None)
    return {"index": n, "slide": slide}


@app.post("/api/decks/{deck_id}/slides/{n}/fit")
async def fit(deck_id: str, n: int, req: FitRequest):
    """Auto-fit: the browser measured overflow on this slide; ask Gemini for a shorter version."""
    deck = await _deck_or_404(deck_id)
    slide = req.slide or (deck["slides"][n] if 0 <= n < len(deck["slides"]) else None)
    if not slide:
        raise HTTPException(404, "slide not found")
    return {"index": n, "slide": await pipeline.shorten_slide(deck, n, slide, req.attempt)}


@app.post("/api/decks/{deck_id}/export/pdf")
async def export_pdf_route(deck_id: str, req: ExportRequest):
    if req.deck:
        await db.save_deck({**req.deck, "id": deck_id}, "export", version=False)
    deck = await _deck_or_404(deck_id)
    try:
        data = await export_pdf.render_pdf(deck_id)
    except Exception:
        log.exception("pdf export failed")
        raise HTTPException(500, "PDF export failed. Is Playwright Chromium installed? (python -m playwright install chromium)")
    name = _safe_filename(req.filename, deck.get("title") or "presentation", ".pdf")
    return Response(data, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename*=UTF-8''{_quote(name)}"})


def _quote(s: str) -> str:
    from urllib.parse import quote

    return quote(s)


# ------------------------------------------------------------------ themes


@app.post("/api/themes/from-prompt")
async def theme_prompt(req: ThemePromptRequest):
    try:
        theme, fixes = await theme_from_prompt(req.prompt)
    except Exception:
        log.exception("theme generation failed")
        raise HTTPException(502, "Could not create a theme from that description. Try again.")
    theme["prompt"] = req.prompt
    if req.save:
        await db.save_theme(theme)
    return {"theme": theme, "fixes": fixes}


@app.get("/api/themes")
async def list_themes():
    return await db.list_themes()


@app.post("/api/themes")
async def save_theme(theme: dict):
    if not str(theme.get("id", "")).startswith("custom-"):
        raise HTTPException(400, "custom theme ids start with custom-")
    return await db.save_theme(theme)


@app.delete("/api/themes/{theme_id}")
async def delete_theme(theme_id: str):
    await db.delete_theme(theme_id)
    return {"ok": True}


# ------------------------------------------------------------------ images


@app.get("/api/images/search")
async def image_search(q: str, n: int = 12):
    caps = await capabilities.get()
    return {"results": await images.search_stock(q, min(n, 30)), "stock": caps["stockPhotos"], "generation": caps["imageGeneration"]}


@app.post("/api/images/select")
async def image_select(body: dict):
    """Cache a chosen stock photo locally and return its /media URL."""
    url = await images.cache_remote(str(body.get("url", "")))
    if not url:
        raise HTTPException(502, "Could not download that image")
    return {"url": url}


@app.post("/api/images/generate")
async def image_generate(body: dict):
    prompt = str(body.get("prompt", "")).strip()[:500]
    if not prompt:
        raise HTTPException(400, "prompt required")
    url = await images.generate_image(prompt)
    if not url:
        raise HTTPException(503, "Image generation is not available for this project")
    return {"url": url, "credit": "AI-generated image"}


@app.post("/api/images/upload")
async def image_upload(file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(413, "image too large (max 15 MB)")
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in {"png", "jpg", "jpeg", "webp", "gif"}:
        raise HTTPException(400, "unsupported image type")
    return {"url": await images.save_bytes(data, "jpg" if ext == "jpeg" else ext)}


# ------------------------------------------------------------------ media (cached / uploaded images)


@app.get("/media/{name}", include_in_schema=False)
async def media(name: str):
    """Cached / uploaded images. CORS-enabled so the browser PPTX exporter can rasterize them."""
    root = get_settings().media_dir.resolve()
    f = (root / name).resolve()
    if f.parent != root or not f.is_file():
        raise HTTPException(404, "not found")
    return FileResponse(f, headers={"Cache-Control": "public, max-age=31536000, immutable"})


# Optional single-process mode: serve a built frontend from this API (FRONTEND_DIST_DIR=../frontend/dist).
_dist = get_settings().frontend_dist_dir
if _dist and (_dist / "index.html").exists():
    _dist = _dist.resolve()
    app.mount("/assets", StaticFiles(directory=_dist / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str):
        """Serve the React app (client-side routes fall back to index.html)."""
        f = (_dist / path).resolve()
        if path and f.is_file() and _dist in f.parents:
            return FileResponse(f)
        return FileResponse(_dist / "index.html")
else:

    @app.get("/", include_in_schema=False)
    async def root():
        return {"service": "aira-ppt-api", "docs": "/docs", "health": "/health"}
