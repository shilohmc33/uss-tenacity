# Art batch 1 (2026-10-18): pack a T'Ren-format character from its HI-RES masters (assets/src/<set>/hires, copied from
# the read-only sprites folder) into one sheet the engine loads. Each master (cell 520x900, feet 260,880) is downscaled by
# its own per-frame scale_hires_to_game (measurements.json) about the feet - the same size as the artist's 160x384 game
# frames (standing ~252 px), but into a LARGER cell so nothing is clipped (the game frames squash the weld sparks):
#   cell 240x288, feet anchor (120,280), columns up/down/right/left, 18 rows walk/talk/eat/computer/kneel/weld x A/M/B.
# Drawn with refH 252 (data.js SHEET_CELL) -> FIG_H 83 design px like every other sheet. Resampling: premultiplied Lanczos.
#   python3 tools/pack-masters.py thelev_v1 thelev-v1            -> assets/thelev-v1.webp
#   python3 tools/pack-masters.py crew_male_v1 crew-male-v1 mask -> assets/crew-male-v1.webp + assets/crew-male-v1-mask.webp
import json, sys
from PIL import Image
src, key = sys.argv[1], sys.argv[2]; want_mask = len(sys.argv) > 3
CW, CH, AX, AY = 240, 288, 120, 280
ROWS = [a + k for a in ["walk", "talk", "eat", "computer", "kneel", "weld"] for k in "AMB"]; COLS = ["up", "down", "right", "left"]
M = json.load(open(f"assets/src/{src}/measurements.json"))["frames"]
sheet = Image.new("RGBA", (CW * 4, CH * 18), (0, 0, 0, 0)); mask = Image.new("L", sheet.size, 0) if want_mask else None
clip = []
def place(im, s, mode):
    w, h = round(im.width * s), round(im.height * s)
    if mode == "RGBA": im = im.convert("RGBa").resize((w, h), Image.LANCZOS).convert("RGBA")
    else: im = im.resize((w, h), Image.LANCZOS)
    return im, round(AX - 260 * s), round(AY - 880 * s)
for r, row in enumerate(ROWS):
    for c, d in enumerate(COLS):
        name = f"{row}_{d}"; s = M[name]["scale_hires_to_game"]
        im = Image.open(f"assets/src/{src}/hires/{name}.png").convert("RGBA")
        bb = im.getchannel("A").getbbox()
        if bb and ((260 - bb[0]) * s > AX or (bb[2] - 260) * s > CW - AX or (880 - bb[1]) * s > AY): clip.append(name)
        cell = Image.new("RGBA", (CW, CH), (0, 0, 0, 0)); fr, ox, oy = place(im, s, "RGBA"); cell.alpha_composite(fr, (max(0, ox), max(0, oy)), (max(0, -ox), max(0, -oy)))
        sheet.paste(cell, (c * CW, r * CH))
        if want_mask:
            mk = Image.open(f"assets/src/{src}/hires/{name}_mask.png").convert("L"); mc = Image.new("L", (CW, CH), 0); fm, ox, oy = place(mk, s, "L")
            mc.paste(fm.crop((max(0, -ox), max(0, -oy), fm.width, fm.height)), (max(0, ox), max(0, oy))); mask.paste(mc, (c * CW, r * CH))
sheet.save(f"assets/{key}.webp", lossless=True, method=6)
if want_mask: mask.convert("RGB").save(f"assets/{key}-mask.webp", lossless=True, method=6)   # white = tint weight (art-hooks reads the red channel)
print(key, sheet.size, "clipped frames:", clip or "none")
