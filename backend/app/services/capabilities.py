"""Detects optional services once at startup: stock photos, image generation, Google Search grounding."""

import asyncio
import logging

from ..config import get_settings
from .llm import generate_text, get_client

log = logging.getLogger(__name__)

_caps: dict | None = None
_lock = asyncio.Lock()


async def _probe_grounding() -> bool:
    if not get_settings().enable_grounding:
        return False
    try:
        await asyncio.wait_for(generate_text("Reply with the word ok.", "Be brief.", grounded=True, what="grounding-probe"), 30)
        return True
    except Exception as e:
        log.info("grounding unavailable: %s", str(e)[:200])
        return False


async def _probe_image_generation() -> bool:
    s = get_settings()
    if not s.enable_image_generation:
        return False
    try:
        await asyncio.wait_for(get_client(s.image_location).aio.models.get(model=s.image_model), 20)
        return True
    except Exception as e:
        log.info("image generation (%s) unavailable: %s", s.image_model, str(e)[:160])
        return False


async def get(refresh: bool = False) -> dict:
    global _caps
    async with _lock:
        if _caps is None or refresh:
            s = get_settings()
            grounding, imagen = await asyncio.gather(_probe_grounding(), _probe_image_generation())
            _caps = {
                "stockPhotos": bool(s.unsplash_access_key or s.pexels_api_key),
                "stockProvider": "unsplash" if s.unsplash_access_key else "pexels" if s.pexels_api_key else None,
                "imageGeneration": imagen,
                "imageModel": s.image_model if imagen else None,
                "grounding": grounding,
                "model": s.gemini_model,
            }
            log.info("capabilities: %s", _caps)
        return _caps
