"""Side-by-side: browser render (left) vs PowerPoint render of the exported PPTX (right), plus a diff score.
Usage: python tests/e2e/compare_pptx.py tests/output/e2e/a
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageStat


def compare(folder: Path, w: int = 640) -> None:
    web = sorted((folder / "slides").glob("*.png"))
    ppt = sorted((folder / "pptx-render").glob("*.png"))
    h = w * 9 // 16
    rows = []
    for a, b in zip(web, ppt):
        ia = Image.open(a).convert("RGB").resize((w, h), Image.LANCZOS)
        ib = Image.open(b).convert("RGB").resize((w, h), Image.LANCZOS)
        diff = ImageStat.Stat(ImageChops.difference(ia, ib).convert("L")).mean[0]
        rows.append((ia, ib, a.stem, diff))
        print(f"{a.stem:28s} mean abs diff {diff:5.1f} / 255  (similarity {100 - diff / 2.55:.1f}%)")
    sheet = Image.new("RGB", (2 * w + 36, len(rows) * (h + 12) + 12), (30, 30, 34))
    for i, (ia, ib, _, _) in enumerate(rows):
        y = 12 + i * (h + 12)
        sheet.paste(ia, (12, y))
        sheet.paste(ib, (w + 24, y))
    out = folder.parent / f"_compare_{folder.name}.jpg"
    sheet.save(out, quality=85)
    print(out)


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        compare(Path(arg))
