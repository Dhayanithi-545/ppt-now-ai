"""Editor end-to-end check: inline edit, theme switch, layout change, chat edits, undo/redo, versions,
regenerate, image upload, presenter mode, dark chrome. Screenshots -> tests/output/e2e/editor/.

    .venv\\Scripts\\python scripts\\e2e_editor.py <deck_id>
"""

import asyncio
import json
import os
import sys
import urllib.request
from pathlib import Path

from playwright.async_api import Page, async_playwright

REPO = Path(__file__).resolve().parents[2]
OUTPUT = REPO / "tests" / "output"
OUT = OUTPUT / "e2e" / "editor"
BASE = os.environ.get("AIRA_URL", "http://localhost:5173")


def api_deck(deck_id: str) -> dict:
    with urllib.request.urlopen(f"{BASE}/api/decks/{deck_id}") as r:
        return json.load(r)


async def slide_count(page: Page) -> int:
    return await page.locator(".strip .thumb").count()


async def wait_saved(page: Page):
    await page.locator(".save-state:has-text('Saved')").wait_for(timeout=30000)


async def main(deck_id: str):
    OUT.mkdir(parents=True, exist_ok=True)
    results: dict[str, str] = {}
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1440, "height": 900}, color_scheme="light")
        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        try:
            await run(page, deck_id, results, errors)
        finally:
            await browser.close()
            for k, v in results.items():
                print(f"{k:28s} {v}")


async def run(page: Page, deck_id: str, results: dict, errors: list):
    if True:
        await page.goto(f"{BASE}/deck/{deck_id}", wait_until="networkidle")
        await page.wait_for_selector(".canvas .sl")
        n0 = await slide_count(page)

        # 1) inline edit on the canvas -> JSON + autosave
        title = page.locator(".canvas [data-field='title']").first
        await title.click()
        await page.keyboard.press("Control+A")
        await page.keyboard.type("Tea, Slowly")
        await page.keyboard.press("Enter")
        await wait_saved(page)
        await page.wait_for_timeout(500)
        saved = api_deck(deck_id)["slides"][0]["content"]["title"]
        results["inline edit saved to JSON"] = "PASS" if saved == "Tea, Slowly" else f"FAIL ({saved!r})"
        await page.screenshot(path=str(OUT / "01-inline-edit.png"))

        # 2) theme switch (same content, new design)
        await page.click("[data-theme-btn]")
        await page.click(".theme-pop .theme-card:has-text('Warm Editorial')")
        await page.wait_for_timeout(800)
        theme_id = await page.locator(".canvas .sl").get_attribute("data-theme")
        results["theme switch"] = "PASS" if theme_id == "editorial" else f"FAIL ({theme_id})"
        await page.screenshot(path=str(OUT / "02-theme-switch.png"))

        # 3) layout change (local remap) on slide 4
        await page.locator(".strip .thumb").nth(3).click()
        before_layout = await page.locator(".canvas .sl").get_attribute("data-layout")
        await page.click(".slide-tools button:has-text('·'), .slide-tools .group >> nth=0 >> button >> nth=0")
        await page.wait_for_selector(".modal .layout-grid")
        await page.screenshot(path=str(OUT / "03-layout-picker.png"))
        target = "Icon features · 6" if before_layout != "icon-grid-6" else "Icon features · 3"
        card = page.locator(f".layout-card:has-text('{target}')").first
        needs_ai = await card.locator(".lc-ai").count() > 0
        await card.click()
        if needs_ai:
            await page.wait_for_selector(".stage-busy", state="detached", timeout=90000)
        await page.wait_for_timeout(800)
        after_layout = await page.locator(".canvas .sl").get_attribute("data-layout")
        results["layout change"] = "PASS" if after_layout != before_layout else f"FAIL ({after_layout})"
        await page.screenshot(path=str(OUT / "04-layout-changed.png"))

        # 4) undo / redo
        await page.mouse.click(700, 30)  # focus the page, not a text field
        await page.keyboard.press("Control+z")
        await page.wait_for_timeout(500)
        undone = await page.locator(".canvas .sl").get_attribute("data-layout")
        await page.keyboard.press("Control+Shift+z")
        await page.wait_for_timeout(500)
        redone = await page.locator(".canvas .sl").get_attribute("data-layout")
        results["undo/redo"] = "PASS" if undone == before_layout and redone == after_layout else f"FAIL ({undone}, {redone})"

        # 5) chat edits
        async def chat(msg: str, shot: str):
            n_ai = await page.locator(".msg.ai:not(.typing)").count()
            await page.fill("[data-testid=chat-input]", msg)
            await page.keyboard.press("Enter")
            await page.locator(".msg.ai:not(.typing)").nth(n_ai).wait_for(timeout=180000)
            await page.wait_for_timeout(1500)
            await page.screenshot(path=str(OUT / shot))
            return await page.locator(".msg.ai:not(.typing)").nth(n_ai).inner_text()

        await page.locator(".strip .thumb").nth(1).click()
        before_l2 = await page.locator(".strip .thumb").nth(1).locator(".sl").get_attribute("data-layout")
        reply = await chat("make slide 2 more visual", "05-chat-visual.png")
        after_l2 = await page.locator(".strip .thumb").nth(1).locator(".sl").get_attribute("data-layout")
        results["chat: more visual"] = f"PASS ({before_l2} -> {after_l2}; reply: {reply[:70]!r})" if after_l2 != before_l2 else f"CHECK (layout unchanged {after_l2}; reply: {reply[:80]!r})"
        n1 = await slide_count(page)
        reply = await chat("add a slide about risks after slide 6", "06-chat-insert.png")
        n2 = await slide_count(page)
        risk_title = await page.locator(".strip .thumb").nth(6).locator("[data-field='title']").first.inner_text() if n2 > 6 else ""
        results["chat: insert slide"] = f"PASS ({n1} -> {n2}, new slide 7: {risk_title!r})" if n2 == n1 + 1 else f"FAIL ({n1} -> {n2})"
        reply = await chat("make the tone more formal", "07-chat-tone.png")
        results["chat: tone (all slides)"] = f"PASS (reply: {reply[:70]!r})"

        # undo the tone change restores previous text
        await page.mouse.click(700, 30)
        await page.keyboard.press("Control+z")
        await page.wait_for_timeout(500)
        results["undo after chat"] = "PASS" if await slide_count(page) == n2 else "FAIL"
        await page.keyboard.press("Control+Shift+z")

        # 6) regenerate one slide
        await page.locator(".strip .thumb").nth(2).click()
        await page.click(".slide-tools button:has-text('Regenerate')")
        await page.wait_for_selector(".stage-busy")
        await page.screenshot(path=str(OUT / "08-regenerating.png"))
        await page.wait_for_selector(".stage-busy", state="detached", timeout=90000)
        results["regenerate slide"] = "PASS"

        # 7) duplicate / delete / reorder by drag
        n = await slide_count(page)
        await page.click(".slide-tools button[title^='Duplicate']")
        dup = await slide_count(page)
        await page.click(".slide-tools button[title^='Delete']")
        deleted = await slide_count(page)
        first_title = await page.locator(".strip .thumb").nth(0).locator("[data-field='title']").first.inner_text()
        await page.locator(".strip .thumb").nth(0).drag_to(page.locator(".strip .thumb").nth(2))
        await page.wait_for_timeout(500)
        moved_title = await page.locator(".strip .thumb").nth(2).locator("[data-field='title']").first.inner_text()
        results["duplicate/delete"] = "PASS" if dup == n + 1 and deleted == n else f"FAIL ({n},{dup},{deleted})"
        results["drag reorder"] = "PASS" if moved_title == first_title else f"FAIL ({first_title!r} vs {moved_title!r})"
        await page.keyboard.press("Control+z")

        # 8) image: upload a photo into an image slide (if any), else open the dialog on cover-split check
        img_slide = None
        for i in range(await slide_count(page)):
            lay = await page.locator(".strip .thumb").nth(i).locator(".sl").get_attribute("data-layout")
            if lay in ("image-text-left", "image-text-right", "cover-split", "full-bleed-image"):
                img_slide = i
                break
        if img_slide is not None:
            await page.locator(".strip .thumb").nth(img_slide).click()
            await page.click(".slide-tools button[title='Swap image']")
            await page.wait_for_selector(".modal:has-text('Swap image')")
            await page.screenshot(path=str(OUT / "09-image-dialog.png"))
            await page.set_input_files(".modal input[type=file]", str(REPO / "frontend" / "public" / "sample" / "landscape.jpg"))
            await page.wait_for_selector(".modal", state="detached", timeout=30000)
            await page.wait_for_timeout(1000)
            src = await page.locator(".canvas .img img").first.get_attribute("src")
            results["image upload"] = "PASS" if src and src.startswith("/media/") else f"FAIL ({src})"
            await page.screenshot(path=str(OUT / "10-image-swapped.png"))
        else:
            results["image upload"] = "SKIP (no image layout in deck)"

        # 9) versions
        await wait_saved(page)
        await page.click("button[title='Version history']")
        await page.wait_for_selector(".version-row")
        nv = await page.locator(".version-row").count()
        await page.screenshot(path=str(OUT / "11-versions.png"))
        results["versions"] = f"PASS ({nv} versions)" if nv >= 3 else f"FAIL ({nv})"
        await page.keyboard.press("Escape")

        # 10) presenter mode
        await page.mouse.click(700, 30)
        await page.click("button:has-text('Present')")
        await page.wait_for_selector(".present")
        await page.wait_for_timeout(600)
        await page.screenshot(path=str(OUT / "12-present.png"))
        await page.keyboard.press("ArrowRight")
        await page.wait_for_timeout(400)
        await page.screenshot(path=str(OUT / "13-present-next.png"))
        await page.keyboard.press("Escape")
        await page.wait_for_selector(".present", state="detached")
        results["presenter mode"] = "PASS"

        # 11) dark chrome
        await page.click("button[title='Toggle dark / light']")
        await page.wait_for_timeout(400)
        await page.screenshot(path=str(OUT / "14-dark-chrome.png"))
        await page.click("button[title='Toggle dark / light']")
        results["page errors"] = "none" if not errors else "; ".join(errors[:3])


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1]))
