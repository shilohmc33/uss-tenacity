# Swap the artist's interim walk frames into the v3 sheets (pass 08). Sources are COPIES in assets/walkfix/<who>/
# (walk{A,M,B}_{up,down,right,left}.png, 160x384 cells, feet anchor (80,376)), copied verbatim from
#   sprites/lt_walkfix_v1/out/   -> assets/walkfix/lt/    (all four directions; the _up set is the swayless Job 3 version)
#   sprites/tren_walkfix_v1/out/ -> assets/walkfix/tren/  (up/down only; her side walk is unchanged)
# The artist's folders are never written. Whatever files exist in assets/walkfix/<who>/ replace the matching walk cells
# (rows 0-2 = A, M, B; columns up, down, right, left) of that character's sheet; missing files leave the cell alone.
# Re-run after re-copying newer frames:  python3 tools/apply-walkfix.py && python3 tools/make-uniform-sheets.py
import os
from PIL import Image
SHEETS = {"lt": "assets/lt-v3.webp", "tren": "assets/tren-v1.webp"}
DIRS = ["up", "down", "right", "left"]; ROWS = {"A": 0, "M": 1, "B": 2}; W, H = 160, 384
for who, path in SHEETS.items():
    sheet = Image.open(path).convert("RGBA"); n = 0
    for fr, row in ROWS.items():
        for col, d in enumerate(DIRS):
            f = f"assets/walkfix/{who}/walk{fr}_{d}.png"
            if not os.path.exists(f): continue
            cell = Image.open(f).convert("RGBA")
            assert cell.size == (W, H), (f, cell.size)
            sheet.paste(cell, (col * W, row * H)); n += 1   # paste replaces the whole cell, alpha included
    sheet.save(path, lossless=True, method=6); print(path, n, "cells")
