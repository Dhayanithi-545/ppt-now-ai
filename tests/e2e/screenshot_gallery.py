"""Capture every theme x layout from /gallery at native 1280x720 and build contact sheets.

Usage (frontend dev server + backend running):
    .venv\\Scripts\\python scripts\\screenshot_gallery.py [--base http://localhost:5173] [--themes midnight,swiss] [--layouts cover-hero]
Output: tests/output/gallery/<theme>/<layout>.png and tests/output/gallery/_sheet_<theme>.jpg
"""

import argparse
import asyncio
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from playwright.async_api import async_playwright

REPO = Path(__file__).resolve().parents[2]
OUTPUT = REPO / "tests" / "output"
LAYOUTS = list(json.loads((REPO / "backend" / "app" / "spec" / "layouts.json").read_text(encoding="utf-8"))["layouts"])
THEMES = ["midnight", "swiss", "editorial", "neon", "pastel", "luxury", "earth", "brutalist", "corporate", "playful", "sunset", "mono"]


async def capture(base: str, themes: list[str], layouts: list[str], out: Path, photos: bool) -> dict:
    report: dict[str, dict[str, dict]] = {}
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 720}, device_scale_factor=1)
        for theme in themes:
            url = f"{base}/gallery?native=1&theme={theme}&photos={'1' if photos else '0'}"
            if len(layouts) == 1:
                url += f"&layout={layouts[0]}"
            await page.goto(url, wait_until="networkidle")
            await page.evaluate("document.fonts.ready")
            await page.wait_for_timeout(400)
            (out / theme).mkdir(parents=True, exist_ok=True)
            report[theme] = {}
            for layout in layouts:
                el = page.locator(f"#slide-{layout}")
                await el.screenshot(path=str(out / theme / f"{layout}.png"))
                sl = el.locator(".sl")
                report[theme][layout] = {
                    "fit": float(await sl.get_attribute("data-fit") or 1),
                    "overflow": (await sl.get_attribute("data-overflow")) == "true",
                }
        await browser.close()
    return report


def contact_sheet(out: Path, theme: str, layouts: list[str], cols: int = 4, w: int = 640) -> Path:
    h = w * 9 // 16
    pad, label = 16, 28
    rows = (len(layouts) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (w + pad) + pad, rows * (h + pad + label) + pad + 40), (24, 24, 28))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("arial.ttf", 18)
        big = ImageFont.truetype("arialbd.ttf", 24)
    except OSError:
        font = big = ImageFont.load_default()
    d.text((pad, 10), f"Theme: {theme}", fill=(240, 240, 240), font=big)
    for i, layout in enumerate(layouts):
        img = Image.open(out / theme / f"{layout}.png").convert("RGB").resize((w, h), Image.LANCZOS)
        x = pad + (i % cols) * (w + pad)
        y = 44 + (i // cols) * (h + pad + label)
        sheet.paste(img, (x, y))
        d.text((x, y + h + 4), layout, fill=(190, 190, 200), font=font)
    path = out / f"_sheet_{theme}.jpg"
    sheet.save(path, quality=86)
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:5173")
    ap.add_argument("--themes", default=",".join(THEMES))
    ap.add_argument("--layouts", default=",".join(LAYOUTS))
    ap.add_argument("--out", default=str(OUTPUT / "gallery"))
    ap.add_argument("--no-photos", action="store_true")
    ap.add_argument("--no-sheets", action="store_true")
    a = ap.parse_args()
    out = Path(a.out)
    themes = a.themes.split(",")
    layouts = a.layouts.split(",")
    report = asyncio.run(capture(a.base, themes, layouts, out, not a.no_photos))
    bad = [(t, l, r["fit"]) for t, by in report.items() for l, r in by.items() if r["overflow"] or r["fit"] < 1]
    for t, l, f in bad:
        print(f"  fit {f:.2f}{' OVERFLOW' if report[t][l]['overflow'] else ''}: {t}/{l}")
    if not a.no_sheets and len(layouts) > 1:
        for t in themes:
            print("sheet:", contact_sheet(out, t, layouts))
    (out / "_report.json").write_text(json.dumps(report, indent=1))
    print(f"captured {len(themes)} themes x {len(layouts)} layouts -> {out}")


if __name__ == "__main__":
    main()
