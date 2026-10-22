#!/usr/bin/env python3
"""Author the per-deck walk masks (assets/walk-<deck>.png, 960x640, white = floor where the Lt's FEET may stand).

The game samples each mask into its 60x40 path grid at load (a cell is walkable when >= 50% of its 16x16 px are white),
so an artist can also just paint the PNGs directly. This script is the reproducible source: shapes are in deck fractions
(0..1 of the 960x640 design plate). 'add' paints floor, 'sub' carves furniture/walls out. Order matters.

  python3 tools/make-walk-masks.py            -> writes assets/walk-*.png
  python3 tools/make-walk-masks.py --preview  -> also writes shots/walkmask_<deck>.png (mask + grid over the plate)
"""
import sys, os
from PIL import Image, ImageDraw
W, H = 960, 640
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def R(x0, y0, x1, y1): return ('rect', (x0, y0, x1, y1))
def P(*pts): return ('poly', pts)
def E(cx, cy, rx, ry): return ('ell', (cx, cy, rx, ry))

DECKS = {
  # Bridge: open floor ring between the side stations and the helm arc; a threshold strip in front of the
  # turbolift doors (between the doors and the MSD table). Back wall, table, chair dais, consoles and viewscreen are out.
  # Bridge v3 (art batch 2): the artist's mask (sprites/deck_bridge_v3/out/walk-bridge.png, copied to assets/src) is the base;
  # code edits go on top. Prop-collision audit #7: keep feet off the aft wall face behind tactical (y .14-.175, x .36-.62).
  # On the v3 plate the wall base sits at ~y .165 and the artist's walkway already starts at row 7 (y .175), so this carve
  # is a guard (no pixel changes today) that keeps a future artist mask from walking crew up the wall.
  'bridge': [
    ('base', 'assets/src/deck_bridge_v3/walk-bridge-artist.png'),
    ('sub', R(0.360, 0.140, 0.620, 0.1745)),
  ],
  # Engineering FINAL (sprites/deck_engineering_v1/out, copied to assets/src/deck_engineering_v1): the artist's mask is the base
  # (floor rects minus prop footprints dilated +-12 x / +-4 y; the lift is reached through the new east passage, so the old
  # col-22 locker slot and the cabinet / vestibule wall crossings, prop-collision #1/#2, are gone). Code edit on top: the floor
  # directly north of the warp-core light column (the north aisle between x 410-512) is blocked so nobody stands "inside" the
  # beam (previews/crew_87px_full.png); the aisle is still walked round the core's west and east ring bands.
  'engineering': [
    ('base', 'assets/src/deck_engineering_v1/walk-engineering-artist.png'),
    ('sub', R(410 / 960, 90 / 640, 512 / 960, 200 / 640)),
  ],
  # Medical v2 FINAL (sprites/deck_medical_v2/out, copied to assets/src/deck_medical_v2): the artist's U-layout mask as is
  # (single-file aisles, minimum 28 px on every route from the lift; mask_checks.json). The old ward / surgery / lab rects
  # and the prop-collision #4 office cabinet carve belonged to the v1 plate.
  'medical': [
    ('base', 'assets/src/deck_medical_v2/walk-medical-artist.png'),
  ],
  # Berthing: the long corridor, the bunk room (foot of the bed), the starboard corridor around the lockers, and the
  # lift vestibule between its benches (entered past the top of the starboard bench).
  'berthing': [
    ('add', R(0.060, 0.392, 0.860, 0.505)),       # main corridor
    ('add', R(0.735, 0.240, 0.855, 0.400)),       # bunk room (rug at the foot of the bed)
    ('add', R(0.765, 0.230, 0.840, 0.250)),
    ('add', P((0.855, 0.405), (0.880, 0.430), (0.885, 0.505), (0.860, 0.505))),
    ('add', R(0.720, 0.505, 0.800, 0.690)),       # starboard corridor (west of the locker unit)
    ('add', R(0.690, 0.660, 0.900, 0.925)),       # starboard bay
    # prop-collision audit #3: the turbolift alcove's angled east wall sat inside the bay rect; carve its polygon out of the bay
    ('sub', P((0.690, 0.660), (0.760, 0.660), (0.760, 0.850), (0.690, 0.850))),
    ('add', R(0.495, 0.840, 0.610, 0.945)),       # lift vestibule between the benches
    ('sub', R(0.835, 0.820, 0.900, 0.930)),       # cabinet + lamp
    # cleaned plate (sprites/decks_berthing_fix_v1, walk-berthing_PROPOSED.png): the starboard bench and the alcove wall are
    # squashed up into y 420-537, leaving an opening (744,534,42,61) from the vestibule into the starboard bay. The temporary
    # entry strip past the bench top, the crate and the pass-18 wall-diagonal carve are gone.
    ('sub', P((676 / 960, 420 / 640), (706 / 960, 420 / 640), (782 / 960, 500 / 640), (782 / 960, 537 / 640), (676 / 960, 537 / 640))),   # bench + wall end
    ('add', R(0.600, 538 / 640, 791 / 960, 595 / 640)),   # the opening and the former bench floor, joined to the vestibule over the open carpet
    ('add', R(776 / 960, 520 / 640, 836 / 960, 568 / 640)),   # lower bay floor where the removed cabinet stood
    ('sub', P((0.880, 0.660), (0.900, 0.660), (0.900, 0.760), (0.870, 0.760))),
  ],
  # Mess & Bar (v2 art: standing tables, no chairs): open floor between the bar stools, the window bulkhead and the
  # planters; the turbolift lobby to the west. Six high-top tables (top + pedestal) are carved out.
  'lounge': [
    ('add', P((0.255, 0.355), (0.690, 0.335), (0.715, 0.450), (0.740, 0.600), (0.755, 0.715), (0.485, 0.715),
              (0.485, 0.955), (0.255, 0.955))),
    ('add', R(0.300, 0.330, 0.660, 0.360)),       # in front of the stools
    ('add', R(0.433, 0.322, 0.452, 0.345)),       # bar spot (gap between two stools)
    ('add', R(0.040, 0.625, 0.240, 0.740)),       # turbolift lobby
    ('add', R(0.235, 0.630, 0.260, 0.705)),       # lobby doorway
    # prop-collision audit #5: the lift-lobby east pillar / door frame (col 15, rows 15-24); the lobby doorway below (rows 25+) stays
    ('sub', R(15 / 60, 15 / 40, 16 / 60, 25 / 40)),
  ],
}
# six standing tables (px centres on the 1920x1280 art, from the artist): tabletop ellipse + pedestal/base footprint.
TABLES = [(758, 576, 54, 40), (1001, 573, 54, 40), (1245, 567, 55, 40), (770, 794, 59, 46), (1047, 790, 60, 45), (1328, 782, 61, 46)]
for (px, py, rx, ry) in TABLES:
    cx, cy, fx, fy = px / 1920, py / 1280, rx / 1920, ry / 1280
    DECKS['lounge'].append(('sub', E(cx, cy + 0.006, fx + 0.006, fy + 0.000)))          # tabletop (north edge stays open)
    DECKS['lounge'].append(('sub', R(cx - fx * 0.75, cy, cx + fx * 0.75, cy + fy + 0.050)))  # pedestal + base

def to_px(x, y): return (x * W, y * H)
def render(deck):
    im = Image.new('L', (W, H), 0); d = ImageDraw.Draw(im)
    for op, sh in DECKS[deck]:
        if op == 'base': im.paste(Image.open(os.path.join(ROOT, sh)).convert('L').resize((W, H)), (0, 0)); d = ImageDraw.Draw(im); continue
        kind, c = sh
        col = 255 if op == 'add' else 0
        if kind == 'rect': d.rectangle([to_px(c[0], c[1]), to_px(c[2], c[3])], fill=col)
        elif kind == 'poly': d.polygon([to_px(*p) for p in c], fill=col)
        elif kind == 'ell': cx, cy, rx, ry = c; d.ellipse([to_px(cx - rx, cy - ry), to_px(cx + rx, cy + ry)], fill=col)
    return im

def grid(im):  # same rule as js/path.js: cell walkable when >= 50% of its pixels are white
    px = im.load(); cw, ch = W // 60, H // 40; g = []
    for cy in range(40):
        row = []
        for cx in range(60):
            n = sum(1 for y in range(cy * ch, cy * ch + ch) for x in range(cx * cw, cx * cw + cw) if px[x, y] > 127)
            row.append(n * 2 >= cw * ch)
        g.append(row)
    return g

if __name__ == '__main__':
    os.makedirs(os.path.join(ROOT, 'shots'), exist_ok=True)
    for deck in DECKS:
        im = render(deck)
        out = os.path.join(ROOT, 'assets', f'walk-{deck}.png')
        same = os.path.exists(out) and Image.open(out).convert('L').point(lambda v: 255 if v > 127 else 0).tobytes() == im.point(lambda v: 255 if v > 127 else 0).tobytes()
        if not same: im.convert('1').save(out, optimize=True)   # pixel-identical masks are left alone (no byte churn)
        if '--preview' in sys.argv:
            plate = Image.open(os.path.join(ROOT, 'assets', f'deck-{deck}.webp')).convert('RGBA').resize((W * 2, H * 2))
            ov = Image.new('RGBA', plate.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
            g = grid(im)
            for cy in range(40):
                for cx in range(60):
                    if g[cy][cx]: d.rectangle([cx * 32, cy * 32, cx * 32 + 31, cy * 32 + 31], fill=(0, 255, 120, 70), outline=(0, 255, 120, 160))
            Image.alpha_composite(plate, ov).convert('RGB').save(os.path.join(ROOT, 'shots', f'walkmask_{deck}.png'))
    print('ok')
