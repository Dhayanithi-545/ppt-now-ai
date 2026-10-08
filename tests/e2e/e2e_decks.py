"""End-to-end check through the real UI: create decks, screenshot every slide, export PPTX + PDF.

Requires the frontend on http://localhost:5173 (npm run dev) and the backend with Vertex credentials.
    .venv\\Scripts\\python scripts\\e2e_decks.py            # all three test decks
    .venv\\Scripts\\python scripts\\e2e_decks.py --only a
Output: tests/output/e2e/<deck>/...
"""

import argparse
import asyncio
import json
import shutil
import time
from pathlib import Path

from playwright.async_api import Page, async_playwright

REPO = Path(__file__).resolve().parents[2]
OUTPUT = REPO / "tests" / "output"
OUT = OUTPUT / "e2e"

DECKS = {
    "a": {"prompt": "Pitch deck for a new AI-powered fitness startup", "slides": 12, "theme": "Midnight Gradient", "audience": "Seed investors", "tone": "Persuasive"},
    "b": {"prompt": "Introduction to quantum computing for college students", "slides": 10, "theme": "Clean Swiss", "audience": "", "tone": "Educational"},
    "c": {"prompt": "The Japanese tea ceremony: history, ritual and what it teaches us about mindfulness", "slides": 8,
          "style": "minimal Japanese aesthetic, muted earth tones", "audience": "Design students", "tone": "Inspiring"},
}


async def create(page: Page, key: str, spec: dict, base: str) -> str:
    out = OUT / key
    out.mkdir(parents=True, exist_ok=True)
    await page.goto(base + "/", wait_until="networkidle")
    await page.fill(".composer textarea", spec["prompt"])
    await page.select_option(".composer-bar select >> nth=0", str(spec["slides"]))
    if spec.get("tone"):
        await page.select_option(".composer-bar select >> nth=1", spec["tone"])
    if spec.get("audience"):
        await page.fill('input[placeholder="Audience (optional)"]', spec["audience"])
    await page.screenshot(path=str(out / "01-home.png"))
    await page.click("text=Continue")
    # clarify (optional) -> theme
    await page.locator("h2:has-text('Pick a style'), h2:has-text('A few quick questions')").first.wait_for(timeout=60000)
    if await page.locator("text=A few quick questions").count():
        await page.screenshot(path=str(out / "02-clarify.png"))
        chips = page.locator(".qa .chips")
        for i in range(await chips.count()):
            await chips.nth(i).locator(".chip").first.click()
        await page.click("text=Choose a style")
    await page.wait_for_selector("text=Pick a style")
    if spec.get("style"):
        await page.fill(".custom-theme input", spec["style"])
        await page.click("text=Generate theme")
        await page.wait_for_selector(".theme-card.on >> text=Custom", timeout=90000)
    else:
        await page.click(f".theme-card:has-text('{spec['theme']}')")
    await page.wait_for_timeout(600)
    await page.screenshot(path=str(out / "03-theme.png"))
    await page.click("text=Create outline")
    await page.wait_for_selector(".outline-list", timeout=120000)
    await page.screenshot(path=str(out / "04-outline.png"), full_page=True)
    t0 = time.time()
    await page.click("button:has-text('Generate')")
    await page.wait_for_url("**/deck/**")
    deck_id = page.url.rstrip("/").split("/")[-1]
    await page.wait_for_timeout(2500)
    await page.screenshot(path=str(out / "05-streaming.png"))
    await page.wait_for_selector(".msg.ai >> text=Your deck is ready", timeout=240000)
    gen_s = time.time() - t0
    # let auto-fit requests settle
    for _ in range(60):
        if not await page.locator(".stage-busy, .t-warn:has-text('…')").count():
            break
        await page.wait_for_timeout(1000)
    await page.wait_for_timeout(2500)
    await page.screenshot(path=str(out / "06-editor.png"))
    print(f"[{key}] deck {deck_id} generated in {gen_s:.1f}s")
    return deck_id


async def capture_slides(page: Page, key: str, deck_id: str, base: str) -> dict:
    out = OUT / key / "slides"
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True, exist_ok=True)
    await page.set_viewport_size({"width": 1280, "height": 720})
    await page.goto(f"{base}/print/{deck_id}", wait_until="networkidle")
    await page.wait_for_function("window.__PRINT_READY === true", timeout=60000)
    pages = page.locator(".print-page")
    report = {}
    for i in range(await pages.count()):
        el = pages.nth(i)
        sl = el.locator(".sl")
        layout = await sl.get_attribute("data-layout")
        await el.screenshot(path=str(out / f"{i + 1:02d}-{layout}.png"))
        report[f"{i + 1:02d}-{layout}"] = {"fit": await sl.get_attribute("data-fit"), "overflow": await sl.get_attribute("data-overflow")}
    await page.set_viewport_size({"width": 1440, "height": 900})
    return report


async def export(page: Page, key: str, deck_id: str, base: str):
    out = OUT / key
    await page.goto(f"{base}/deck/{deck_id}", wait_until="networkidle")
    await page.wait_for_selector(".canvas .sl", timeout=60000)
    for fmt in ("pptx", "pdf"):
        await page.click("[data-testid=open-export]")
        await page.fill("[data-testid=export-name]", f"Test deck {key}")
        await page.click(f"[data-testid=fmt-{fmt}]")
        if fmt == "pptx":
            await page.screenshot(path=str(out / "07-export-dialog.png"))
        async with page.expect_download(timeout=180000) as dl:
            await page.click("[data-testid=export-go]")
        d = await dl.value
        path = out / d.suggested_filename
        await d.save_as(str(path))
        print(f"[{key}] exported {path.name} ({path.stat().st_size // 1024} KB)")
        await page.wait_for_timeout(800)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:5173")
    ap.add_argument("--only", default="abc")
    ap.add_argument("--deck", help="skip creation and use this deck id (with a single --only key)")
    a = ap.parse_args()
    summary = {}
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True, color_scheme="light")
        page = await ctx.new_page()
        page.on("pageerror", lambda e: print("  page error:", e))
        for key in a.only:
            deck_id = a.deck or await create(page, key, DECKS[key], a.base)
            report = await capture_slides(page, key, deck_id, a.base)
            await export(page, key, deck_id, a.base)
            summary[key] = {"deck": deck_id, "slides": report}
        await browser.close()
    (OUT / "_summary.json").write_text(json.dumps(summary, indent=1))
    for k, v in summary.items():
        bad = {s: r for s, r in v["slides"].items() if r["overflow"] == "true" or (r["fit"] and float(r["fit"]) < 1)}
        print(k, v["deck"], "shrunk/overflow:", bad or "none")


if __name__ == "__main__":
    asyncio.run(main())
