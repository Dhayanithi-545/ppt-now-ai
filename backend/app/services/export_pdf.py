"""PDF export: headless Chromium (Playwright) prints the frontend's /print/{id} route, 1280×720 px per page.

The print route renders the exact same React slide components as the editor, so the PDF is pixel-identical
to the preview.
"""

import asyncio
import logging

from playwright.async_api import Browser, async_playwright

from ..config import get_settings

log = logging.getLogger(__name__)

_pw = None
_browser: Browser | None = None
_lock = asyncio.Lock()


async def _get_browser() -> Browser:
    global _pw, _browser
    async with _lock:
        if _browser is None or not _browser.is_connected():
            _pw = await async_playwright().start()
            _browser = await _pw.chromium.launch()
        return _browser


async def render_pdf(deck_id: str) -> bytes:
    browser = await _get_browser()
    page = await browser.new_page(viewport={"width": 1280, "height": 720})
    try:
        url = f"{get_settings().frontend_url.rstrip('/')}/print/{deck_id}"
        await page.goto(url, wait_until="networkidle", timeout=60000)
        await page.wait_for_function("window.__PRINT_READY === true", timeout=60000)
        return await page.pdf(width="1280px", height="720px", print_background=True, margin={"top": "0", "right": "0", "bottom": "0", "left": "0"})
    finally:
        await page.close()


async def shutdown() -> None:
    global _pw, _browser
    if _browser:
        await _browser.close()
    if _pw:
        await _pw.stop()
    _browser = _pw = None
