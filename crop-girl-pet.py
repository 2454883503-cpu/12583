"""Crop the Codex-v2 DeepSeek-girl spritesheet down to the DSH 9-row format.

DSH expects 1536x1872 (8 cols x 9 rows, 192x208 cells).
The source pet is 1536x2288 (8 x 11): rows 0-8 are the standard animation
states (identical row order to DSH), rows 9-10 are Codex-only "look direction"
rows that DSH never addresses.
"""

from pathlib import Path

from PIL import Image

SRC = Path(r"D:\AA12583\dsh\组件\girl-pet-repo\spritesheet.webp")
OUT_DIR = Path(r"D:\AA12583\dsh\组件\girl-pet-out")
OUT_SHEET = OUT_DIR / "spritesheet.webp"
OUT_JSON = OUT_DIR / "pet.json"

CELL_W, CELL_H = 192, 208
COLS, DSH_ROWS, SRC_ROWS = 8, 9, 11

im = Image.open(SRC)
print(f"source : {im.size} mode={im.mode} format={im.format}")
assert im.size == (COLS * CELL_W, SRC_ROWS * CELL_H), "unexpected source geometry"

# Rows 0..8 map 1:1 onto DSH rows 0..8; drop the two look-direction rows.
cropped = im.crop((0, 0, COLS * CELL_W, DSH_ROWS * CELL_H))
print(f"cropped: {cropped.size}")
assert cropped.size == (COLS * CELL_W, DSH_ROWS * CELL_H) == (1536, 1872)

OUT_DIR.mkdir(parents=True, exist_ok=True)
# Lossless WebP keeps the alpha channel the transparent cells need.
cropped.save(OUT_SHEET, format="WEBP", lossless=True, quality=100, method=6)
print(f"wrote  : {OUT_SHEET} ({OUT_SHEET.stat().st_size} bytes)")

# Verify by reading the written file back.
chk = Image.open(OUT_SHEET)
print(f"verify : {chk.size} mode={chk.mode} format={chk.format}")
assert chk.size == (1536, 1872), "written sheet has wrong size"

manifest = """{
  "id": "deepseek",
  "displayName": "DeepSeek娘",
  "description": "蓝发鲸鱼女仆，温柔可爱；由 Codex Pet v2 精灵图裁剪为 DSH 9 行格式。",
  "spritesheetPath": "spritesheet.webp"
}
"""
OUT_JSON.write_text(manifest, encoding="utf-8")
print(f"wrote  : {OUT_JSON}")
