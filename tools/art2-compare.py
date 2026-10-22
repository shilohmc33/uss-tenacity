# Suite 20: join shots/art2-<name>-before-<vp>.png and -after-<vp>.png side by side -> shots/art2-<name>-compare-<vp>.png
#   python3 tools/art2-compare.py bridgehr-dais female-stand ...   (vp 1280x800 + 390x844)
import sys
from PIL import Image, ImageDraw
for name in sys.argv[1:]:
    for vp in ["1280x800", "390x844"]:
        a = Image.open(f"shots/art2-{name}-before-{vp}.png").convert("RGB"); b = Image.open(f"shots/art2-{name}-after-{vp}.png").convert("RGB")
        h = max(a.height, b.height); c = Image.new("RGB", (a.width + b.width + 12, h + 28), (10, 12, 20)); c.paste(a, (0, 28)); c.paste(b, (a.width + 12, 28))
        d = ImageDraw.Draw(c); d.text((6, 8), "BEFORE", fill=(255, 200, 120)); d.text((a.width + 18, 8), "AFTER", fill=(140, 220, 255))
        c.save(f"shots/art2-{name}-compare-{vp}.png"); print(f"shots/art2-{name}-compare-{vp}.png")
