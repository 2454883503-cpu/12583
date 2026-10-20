from PIL import Image
im = Image.open(r"D:\AA12583\dsh\组件\girl-pet-out\spritesheet.webp")
# Contact sheet: one row per animation state, first 2 frames each, labelled.
rows = ["idle","running-right","running-left","waving","jumping","failed","waiting","running","review"]
CELL_W, CELL_H = 192, 208
cols = 2
out = Image.new("RGBA", (cols*CELL_W, len(rows)*CELL_H), (24,24,28,255))
for r in range(len(rows)):
    for c in range(cols):
        cell = im.crop((c*CELL_W, r*CELL_H, (c+1)*CELL_W, (r+1)*CELL_H))
        out.paste(cell, (c*CELL_W, r*CELL_H), cell)
out.convert("RGB").save(r"D:\AA12583\dsh\组件\girl-pet-rows.png")
print("rows montage:", out.size)
# Also render the idle row alone at full size for a clear look.
im.crop((0,0,cols*CELL_W,CELL_H)).convert("RGB").save(r"D:\AA12583\dsh\组件\girl-pet-idle.png")
print("idle preview written")
