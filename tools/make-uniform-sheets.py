# Department uniform variants of the generic crew sheet (T'Ren's tren-v1, command red) for phase-3 roster NPCs.
# Recolours only the saturated red uniform panels (not skin/lips: they fail the saturation + r/g test) to ops/eng gold
# and sci/med blue, keeping shading. Output: assets/crew-gold-v1.webp, assets/crew-blue-v1.webp (same v3 grid).
# python3 tools/make-uniform-sheets.py
import numpy as np
from PIL import Image
src = Image.open("assets/tren-v1.webp").convert("RGBA")
a = np.asarray(src).astype(np.float32) / 255.0
rgb, alpha = a[..., :3], a[..., 3:]
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
mx, mn = rgb.max(-1), rgb.min(-1)
sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
mask = (r >= mx - 1e-6) & (sat > 0.62) & (r > 2.7 * g) & (r > 2.0 * b) & (mx > 0.12)
# soften the edge a little: partial weight for borderline saturation
w = np.clip((sat - 0.62) / 0.1, 0, 1) * mask
lum = mx  # value channel carries the folds
def tint(hue_rgb, gain):
    out = rgb.copy()
    col = np.array(hue_rgb, np.float32)
    new = np.clip(col[None, None, :] * (lum[..., None] / 0.62) * gain, 0, 1)
    out = out * (1 - w[..., None]) + new * w[..., None]
    return Image.fromarray((np.concatenate([out, alpha], -1) * 255).round().astype(np.uint8), "RGBA")
tint((0.86, 0.66, 0.16), 1.0).save("assets/crew-gold-v1.webp", quality=88, method=6)
tint((0.20, 0.52, 0.80), 1.0).save("assets/crew-blue-v1.webp", quality=88, method=6)
print("mask px", int(mask.sum()))
