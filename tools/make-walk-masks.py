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
  'bridge': [
    ('add', P((0.300, 0.230), (0.375, 0.230), (0.375, 0.330), (0.625, 0.330), (0.625, 0.230), (0.700, 0.230),
              (0.760, 0.300), (0.770, 0.400), (0.800, 0.430), (0.790, 0.560), (0.735, 0.620), (0.700, 0.560),
              (0.300, 0.560), (0.255, 0.620), (0.200, 0.560), (0.195, 0.430), (0.230, 0.400), (0.240, 0.300))),
    ('add', R(0.350, 0.150, 0.650, 0.178)),       # threshold in front of the lift doors
    ('add', R(0.350, 0.150, 0.385, 0.240)),       # gap between back wall and left MSD side console
    ('add', R(0.615, 0.150, 0.650, 0.240)),       # ... and the right one
    ('sub', R(0.455, 0.330, 0.540, 0.448)),       # captain's chair (the dais and its steps are walkable)
    ('sub', P((0.255, 0.445), (0.335, 0.445), (0.395, 0.530), (0.500, 0.560), (0.605, 0.530), (0.665, 0.445),
              (0.745, 0.445), (0.735, 0.640), (0.500, 0.680), (0.265, 0.640))),   # helm/ops arc
    ('sub', P((0.100, 0.240), (0.240, 0.290), (0.215, 0.400), (0.160, 0.470), (0.150, 0.640), (0.050, 0.640), (0.050, 0.240))),  # port stations
    ('sub', P((0.900, 0.240), (0.760, 0.290), (0.785, 0.400), (0.840, 0.470), (0.850, 0.640), (0.950, 0.640), (0.950, 0.240))),  # starboard stations
  ],
  # Engineering: west corridor + transporter room, the lower deck band, the core aisle, the inner platforms
  # (reached by the two stairs), the east floor by the torpedo racks, the locker corridor (through the
  # green-lit service door between the lockers) and the turbolift vestibule.
  'engineering': [
    ('add', R(0.095, 0.150, 0.250, 0.292)),       # transporter room floor (pads are walkable)
    ('add', R(0.130, 0.280, 0.195, 0.345)),       # transporter room doorway
    ('add', R(0.115, 0.330, 0.200, 0.735)),       # west corridor
    ('add', R(0.115, 0.585, 0.250, 0.735)),       # lower floor west of the left stair
    ('add', P((0.262, 0.545), (0.335, 0.545), (0.280, 0.735), (0.215, 0.735))),   # left stair treads
    ('add', R(0.300, 0.440, 0.355, 0.590)),       # left inner platform (shield console)
    ('add', R(0.215, 0.700, 0.420, 0.728)),       # strip along the bottom wall, under the lower-left console
    ('add', R(0.415, 0.540, 0.500, 0.735)),       # core aisle
    ('add', R(0.490, 0.700, 0.700, 0.735)),       # strip under the lower-right console / stair foot
    ('add', P((0.540, 0.545), (0.620, 0.545), (0.700, 0.735), (0.635, 0.735))),   # right stair treads
    ('add', R(0.505, 0.440, 0.555, 0.590)),       # right inner platform
    ('add', R(0.680, 0.540, 0.735, 0.735)),       # floor between right stair and the deck machinery
    ('add', P((0.700, 0.275), (0.785, 0.275), (0.785, 0.665), (0.735, 0.665), (0.715, 0.560), (0.700, 0.440))),  # east floor by the torpedo racks
    ('add', R(0.600, 0.170, 0.700, 0.290)),       # floor between the core gantry and the crates
    ('add', R(0.700, 0.255, 0.765, 0.300)),
    ('add', R(0.367, 0.700, 0.384, 0.905)),       # service door between the lockers (green-lit slot)
    ('add', R(0.060, 0.895, 0.745, 0.950)),       # locker corridor
    ('add', R(0.740, 0.895, 0.800, 0.950)),       # corridor -> lift vestibule
    ('add', R(0.795, 0.825, 0.935, 0.935)),       # turbolift vestibule
    ('sub', R(0.270, 0.462, 0.312, 0.540)),       # shield console pedestal
    ('sub', R(0.540, 0.470, 0.600, 0.535)),       # starboard pedestal console
  ],
  # Medical: ward aisle beside the biobeds, the top passage, the aisle east of surgery, the lab floor around the
  # island, the lower corridor and the lift landing. Beds, surgery suite, counters and bottom wall are out.
  'medical': [
    ('add', R(0.290, 0.205, 0.362, 0.800)),       # ward aisle
    ('add', R(0.290, 0.205, 0.600, 0.280)),       # passage north of the surgery suite
    ('add', R(0.600, 0.270, 0.668, 0.290)),       # office threshold (desk chair stays out)
    ('add', R(0.555, 0.235, 0.610, 0.290)),
    ('add', R(0.610, 0.280, 0.668, 0.800)),       # aisle east of surgery
    ('add', R(0.668, 0.520, 0.790, 0.800)),       # lab floor
    # art batch 1 (decks_doorfix_v1, full raise): the taller front-wall turbolift alcove now reaches the surgery suite's
    # front wall at the centre, so the lower corridor is only the strip under the OR (y .665-.700, feet on the alcove rim
    # as before) and the alcove itself is carved out; the lift node moved up .075 to y .6875 (data.js)
    ('add', R(0.362, 0.665, 0.668, 0.700)),       # strip under the OR, in front of the lift alcove
    ('add', R(0.230, 0.290, 0.300, 0.305)),       # bed-foot gaps (between beds)
    ('add', R(0.240, 0.375, 0.300, 0.392)),
    ('sub', R(0.700, 0.560, 0.800, 0.705)),       # lab island
    ('sub', R(0.760, 0.450, 0.880, 0.830)),       # lab side cabinets
    ('sub', R(0.390, 0.780, 0.415, 0.830)),       # cart by the lift
    ('sub', P((0.440, 0.800), (0.460, 0.780), (0.560, 0.780), (0.580, 0.800), (0.580, 0.860), (0.440, 0.860))),  # lift housing
    ('sub', P((0.372, 0.860), (0.380, 0.760), (0.400, 0.725), (0.440, 0.702), (0.580, 0.702), (0.620, 0.725), (0.640, 0.760), (0.648, 0.860))),  # taller lift alcove (doorfix)
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
    ('add', R(0.495, 0.840, 0.610, 0.945)),       # lift vestibule between the benches
    ('add', R(0.600, 0.825, 0.700, 0.852)),       # past the top of the starboard bench
    ('sub', R(0.700, 0.840, 0.745, 0.905)),       # crate
    ('sub', R(0.835, 0.820, 0.900, 0.930)),       # cabinet + lamp
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
    for op, (kind, c) in DECKS[deck]:
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
        im.convert('1').save(os.path.join(ROOT, 'assets', f'walk-{deck}.png'), optimize=True)
        if '--preview' in sys.argv:
            plate = Image.open(os.path.join(ROOT, 'assets', f'deck-{deck}.webp')).convert('RGBA').resize((W * 2, H * 2))
            ov = Image.new('RGBA', plate.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
            g = grid(im)
            for cy in range(40):
                for cx in range(60):
                    if g[cy][cx]: d.rectangle([cx * 32, cy * 32, cx * 32 + 31, cy * 32 + 31], fill=(0, 255, 120, 70), outline=(0, 255, 120, 160))
            Image.alpha_composite(plate, ov).convert('RGB').save(os.path.join(ROOT, 'shots', f'walkmask_{deck}.png'))
    print('ok')
