from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
source = ROOT / "girl-pet-repo" / "spritesheet.webp"
output = ROOT / "girl-pet-out" / "spritesheet.webp"
cell_w, cell_h = 192, 208
cols, rows = 8, 9

sheet = Image.open(source).convert("RGBA")
assert sheet.size == (1536, 2288), f"unexpected source size: {sheet.size}"
# The DSH renderer consumes only the first six frames for idle. The existing
# two spare cells are transparent; use copies of the intermediate breathing
# poses to add cadence without inventing or distorting character details.
for row, frames in ((0, ((1, 2), (3, 4))),):
    for destination, origin in frames:
        box = (origin * cell_w, row * cell_h, (origin + 1) * cell_w, (row + 1) * cell_h)
        target = (destination * cell_w, row * cell_h)
        sheet.paste(sheet.crop(box), target)

cropped = sheet.crop((0, 0, cols * cell_w, rows * cell_h))
assert cropped.size == (1536, 1872)
output.parent.mkdir(parents=True, exist_ok=True)
cropped.save(output, format="WEBP", lossless=True, quality=100, method=6)
check = Image.open(output)
assert check.size == (1536, 1872) and check.mode == "RGBA"
print(f"Wrote {output} ({output.stat().st_size} bytes), size={check.size}, mode={check.mode}")
