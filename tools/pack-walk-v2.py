# Scale integration (option A): pack the approved walk_v2 HI-RES masters (assets/walk_v2/*/hires, copied from the
# read-only sprites folder) into lossless webp sheets the preloader can load, plus department-colour copies of T'Ren's
# side walk for the generic crew (same recolour as tools/make-uniform-sheets.py: only the saturated red uniform panels).
#   assets/lt-walk-v2.webp        cells 360x860, feet (180,842), columns up/down/right/left, rows A/M/B
#   assets/tren-walk-v2.webp      cells 346x831, feet (173,813), columns right/left, rows A/M/B  (her up/down stay walkfix_v1)
#   assets/crew-gold-walk-v2.webp / crew-blue-walk-v2.webp   the same, ops/eng gold and sci/med blue
# python3 tools/pack-walk-v2.py
import numpy as np
from PIL import Image
def sheet(src, dirs, w, h):
    s = Image.new("RGBA", (w * len(dirs), h * 3), (0, 0, 0, 0))
    for c, d in enumerate(dirs):
        for r, k in enumerate("AMB"):
            im = Image.open(f"assets/walk_v2/{src}/hires/walk{k}_{d}.png").convert("RGBA")
            assert im.size == (w, h), (src, d, k, im.size)
            s.paste(im, (c * w, r * h))
    return s
def recolour(img, hue):
    a = np.asarray(img).astype(np.float32) / 255.0
    rgb, alpha = a[..., :3], a[..., 3:]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    mask = (r >= mx - 1e-6) & (sat > 0.62) & (r > 2.7 * g) & (r > 2.0 * b) & (mx > 0.12)
    w = np.clip((sat - 0.62) / 0.1, 0, 1) * mask
    new = np.clip(np.array(hue, np.float32)[None, None, :] * (mx[..., None] / 0.62), 0, 1)
    out = rgb * (1 - w[..., None]) + new * w[..., None]
    return Image.fromarray((np.concatenate([out, alpha], -1) * 255).round().astype(np.uint8), "RGBA"), int(mask.sum())
lt = sheet("lt", ["up", "down", "right", "left"], 360, 860); lt.save("assets/lt-walk-v2.webp", lossless=True, method=6)
tr = sheet("tren", ["right", "left"], 346, 831); tr.save("assets/tren-walk-v2.webp", lossless=True, method=6)
g, n1 = recolour(tr, (0.86, 0.66, 0.16)); g.save("assets/crew-gold-walk-v2.webp", lossless=True, method=6)
b, n2 = recolour(tr, (0.20, 0.52, 0.80)); b.save("assets/crew-blue-walk-v2.webp", lossless=True, method=6)
print("lt", lt.size, "tren", tr.size, "recoloured px", n1, n2)
