# Suite 20: sharpness of before/after crops = variance of the Laplacian (higher = crisper), per file pair.
#   python3 tools/shot-sharpness.py shots/art2-bridgehr-dais-{before,after}-1280x800.png ...
import sys
import numpy as np
from PIL import Image
def lapvar(f):
    g = np.asarray(Image.open(f).convert("L")).astype(float)
    l = 4 * g[1:-1, 1:-1] - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:]
    return float(l.var())
for f in sys.argv[1:]: print(f"{lapvar(f):9.1f}  {f}")
