"""Contact sheet of a deck's slide screenshots: python tests/e2e/contact_sheet.py tests/output/e2e/<KEY>"""
import sys
from pathlib import Path

from PIL import Image


def sheet(folder: Path, cols: int = 3, w: int = 640) -> Path:
    files = sorted((folder / "slides").glob("*.png"))
    h = w * 9 // 16
    rows = (len(files) + cols - 1) // cols
    s = Image.new("RGB", (cols * (w + 12) + 12, rows * (h + 12) + 12), (30, 30, 34))
    for i, f in enumerate(files):
        s.paste(Image.open(f).convert("RGB").resize((w, h), Image.LANCZOS), (12 + (i % cols) * (w + 12), 12 + (i // cols) * (h + 12)))
    out = folder.parent / f"_sheet_{folder.name}.jpg"
    s.save(out, quality=88)
    return out


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        print(sheet(Path(arg)))
