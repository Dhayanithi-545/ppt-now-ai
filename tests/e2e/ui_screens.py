"""Screenshots of the app chrome on desktop and phone, light and dark, for visual QA.

    backend\\.venv\\Scripts\\python tests\\e2e\\ui_screens.py <deck_id> [--base http://localhost:5173]
Output: tests/output/ui/<device>-<mode>-<screen>.png
"""

import argparse
import asyncio
from pathlib import Path

from playwright.async_api import async_playwright

OUT = Path(__file__).resolve().parents[2] / "tests" / "output" / "ui"
DEVICES = {
    "desktop": dict(viewport={"width": 1440, "height": 900}),
    "phone": dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True),
}


async def shoot(base: str, deck_id: str):
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for dev, opts in DEVICES.items():
            for mode in ("light", "dark"):
                ctx = await browser.new_context(color_scheme=mode, **opts)
                await ctx.add_init_script(f"localStorage.setItem('aira-app-theme', '{mode}')")
                page = await ctx.new_page()
                name = lambda s: str(OUT / f"{dev}-{mode}-{s}.png")  # noqa: E731

                await page.goto(base + "/", wait_until="networkidle")
                await page.wait_for_timeout(600)
                await page.screenshot(path=name("1-home"))
                if dev == "desktop" or mode == "light":
                    await page.screenshot(path=name("1-home-full"), full_page=True)

                # style step (skip clarify by giving audience + tone)
                await page.fill(".composer textarea", "Introduction to quantum computing for college students")
                await page.fill('input[placeholder="e.g. investors"]', "students")
                await page.select_option(".composer-bar select >> nth=1", "Educational")
                await page.click("button:has-text('Continue')")
                await page.locator("h2:has-text('Pick a style'), h2:has-text('A few quick questions')").first.wait_for(timeout=60000)
                if await page.locator("h2:has-text('A few quick questions')").count():
                    await page.click("button:has-text('Choose a style')")
                await page.wait_for_timeout(800)
                await page.screenshot(path=name("2-style"))

                # editor
                await page.goto(f"{base}/deck/{deck_id}", wait_until="networkidle")
                await page.wait_for_selector(".canvas .sl")
                await page.wait_for_timeout(800)
                await page.screenshot(path=name("3-editor"))
                if dev == "phone":
                    await page.click("button[aria-label='AI assistant']")
                    await page.wait_for_timeout(400)
                    await page.screenshot(path=name("4-chat-drawer"))
                    await page.click("button[aria-label='Close assistant']")
                    await page.click("button[aria-label='More actions']")
                    await page.wait_for_timeout(200)
                    await page.screenshot(path=name("5-menu"))
                    await page.keyboard.press("Escape")
                await page.click("[data-testid=open-export]")
                await page.wait_for_timeout(400)
                await page.screenshot(path=name("6-export"))
                await ctx.close()
        await browser.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("deck_id")
    ap.add_argument("--base", default="http://localhost:5173")
    a = ap.parse_args()
    asyncio.run(shoot(a.base, a.deck_id))
    print("screens ->", OUT)
