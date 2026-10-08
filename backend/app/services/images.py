"""Images: stock photos (Unsplash / Pexels) -> image generation (Imagen on Vertex) -> None.

None means the frontend draws a theme-colored illustration, so a slide never shows a broken or blank image.
Every chosen image is cached under data/media and served from /media (same origin keeps PDF/PPTX export simple).
"""

import asyncio
import hashlib
import logging

import httpx
from google.genai import types

from . import capabilities
from ..config import get_settings
from .llm import get_client

log = logging.getLogger(__name__)
TIMEOUT = httpx.Timeout(12.0)


def _media_url(name: str) -> str:
    return f"/media/{name}"


def _save(data: bytes, ext: str) -> str:
    s = get_settings()
    s.media_dir.mkdir(parents=True, exist_ok=True)
    name = hashlib.sha1(data).hexdigest()[:20] + "." + ext
    path = s.media_dir / name
    if not path.exists():
        path.write_bytes(data)
    return _media_url(name)


async def save_bytes(data: bytes, ext: str) -> str:
    return await asyncio.to_thread(_save, data, ext)


async def search_stock(query: str, n: int = 12) -> list[dict]:
    """Search the configured stock provider. Returns [] when no key is set or the call fails."""
    s = get_settings()
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            if s.unsplash_access_key:
                r = await client.get(
                    "https://api.unsplash.com/search/photos",
                    params={"query": query, "per_page": n, "orientation": "landscape", "content_filter": "high"},
                    headers={"Authorization": f"Client-ID {s.unsplash_access_key}", "Accept-Version": "v1"},
                )
                r.raise_for_status()
                return [
                    {
                        "url": p["urls"]["regular"], "thumb": p["urls"]["small"], "source": "unsplash",
                        "credit": f"Photo: {p['user']['name']} / Unsplash", "alt": p.get("alt_description") or query,
                    }
                    for p in r.json().get("results", [])
                ]
            if s.pexels_api_key:
                r = await client.get(
                    "https://api.pexels.com/v1/search",
                    params={"query": query, "per_page": n, "orientation": "landscape"},
                    headers={"Authorization": s.pexels_api_key},
                )
                r.raise_for_status()
                return [
                    {
                        "url": p["src"]["large2x"], "thumb": p["src"]["medium"], "source": "pexels",
                        "credit": f"Photo: {p['photographer']} / Pexels", "alt": p.get("alt") or query,
                    }
                    for p in r.json().get("photos", [])
                ]
    except Exception as e:  # network / quota / bad key: degrade silently
        log.warning("stock search failed: %s", str(e)[:200])
    return []


async def cache_remote(url: str) -> str | None:
    """Download a remote image into the media cache and return its /media URL."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
            r = await client.get(url)
            r.raise_for_status()
        ctype = r.headers.get("content-type", "")
        ext = "png" if "png" in ctype else "webp" if "webp" in ctype else "jpg"
        return await save_bytes(r.content, ext)
    except Exception as e:
        log.warning("image download failed: %s", str(e)[:200])
        return None


async def generate_image(prompt: str) -> str | None:
    """Generate one 16:9 image with Imagen (or a Gemini image model). Returns a /media URL or None."""
    s = get_settings()
    if not (await capabilities.get())["imageGeneration"]:
        return None
    full = f"{prompt}. Editorial photograph, natural light, rich detail, professional composition, no text, no watermark."
    try:
        client = get_client(s.image_location)
        if s.image_model.startswith("imagen"):
            resp = await client.aio.models.generate_images(
                model=s.image_model, prompt=full,
                config=types.GenerateImagesConfig(number_of_images=1, aspect_ratio="16:9", person_generation="allow_adult"),
            )
            data = resp.generated_images[0].image.image_bytes
        else:
            resp = await client.aio.models.generate_content(
                model=s.image_model, contents=full,
                config=types.GenerateContentConfig(response_modalities=["IMAGE"], image_config=types.ImageConfig(aspect_ratio="16:9")),
            )
            data = next(p.inline_data.data for p in resp.candidates[0].content.parts if p.inline_data)
        return await save_bytes(data, "png")
    except Exception as e:
        log.warning("image generation failed: %s", str(e)[:200])
        return None


async def resolve_slide_image(query: str) -> dict | None:
    """Best available image for a slide: stock -> generated -> None (frontend illustration)."""
    results = await search_stock(query, n=3)
    for res in results:
        url = await cache_remote(res["url"])
        if url:
            return {"url": url, "credit": res["credit"], "alt": res["alt"], "query": query}
    gen = await generate_image(query)
    if gen:
        return {"url": gen, "credit": "AI-generated image", "alt": query, "query": query}
    return None
