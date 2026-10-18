# Compose /workspace/anim-strips/<TAG>/<vp>/<scenario>/f*.png into shots/anim-<TAG>-<vp>-<scenario>.png filmstrips,
# character-centred, with a floor ruler fixed to the world every 10 design px (red every 50). Usage: python3 tools/anim-strip-sheet.py before
import json, glob, os, sys
from PIL import Image, ImageDraw
TAG = sys.argv[1] if len(sys.argv) > 1 else 'before'
ROOT = f'/workspace/anim-strips/{TAG}/'
OUT = '/workspace/tenacity/shots/'
DSF = {'phone': 2, 'desk': 1}
SUBJ = {'tren-walk': 'tren', 'crew-walk': 'kovac'}
OFF = {'phone': (0, 301), 'desk': (7, 116)}   # deck canvas offset for logs without cam.r (audit numbers)
FIXED = {'biobed-liedown': (0.26, 0.44), 'biobed-getup': (0.30, 0.47), 'bunk-liedown': (0.78, 0.22)}
for vp in DSF:
    for d in sorted(glob.glob(f'{ROOT}{vp}/*/')):
        sc = os.path.basename(d.rstrip('/')); log = json.load(open(d + 'log.json')); files = sorted(glob.glob(d + 'f*.png'))
        if not files: continue
        cells = []
        pick = files if len(files) <= 16 else [files[round(k * (len(files) - 1) / 15)] for k in range(16)]
        for fn in pick:
            i = int(os.path.basename(fn)[1:4]); f = log[i]; cam = f['cam']; s = cam['s'] * DSF[vp]
            who = SUBJ.get(sc, 'lt'); c = next((c for c in f['ch'] if c['id'] == who), f['ch'][0])
            wx, wy = (FIXED[sc][0] * 960, FIXED[sc][1] * 640) if sc in FIXED else (c['x'] * 960, c['y'] * 640)
            if sc == 'chair' or sc == 'overlap': wy = c['y'] * 640
            ox, oy = cam.get('r', OFF[vp]); sx = ((wx - cam['x']) * cam['s'] + cam['w'] / 2 + ox) * DSF[vp]; sy = ((wy - cam['y']) * cam['s'] + cam['h'] / 2 + oy) * DSF[vp]
            h = 150 * s; im = Image.open(fn).convert('RGB')
            box = (int(sx - h * 0.55), int(sy - h * 1.0), int(sx + h * 0.55), int(sy + h * 0.15)); cimg = im.crop(box); dr = ImageDraw.Draw(cimg)
            if sc not in FIXED:
                base = sy - box[1]; dr.line((0, base, cimg.width, base), fill=(60, 255, 60))
                k0 = int((wx - 90) // 10) * 10
                for x in range(k0, int(wx + 90), 10):
                    X = ((x - cam['x']) * cam['s'] + cam['w'] / 2 + ox) * DSF[vp] - box[0]
                    dr.line((X, base + 2, X, base + (12 if x % 50 == 0 else 6)), fill=(255, 60, 60) if x % 50 == 0 else (255, 200, 60))
            dr.text((3, 3), f'{TAG} {round(i * 33.3)}ms {c.get("dir", "")}', fill=(255, 255, 255))
            cells.append(cimg.resize((160, int(160 * cimg.height / max(1, cimg.width)))))
        W, H = cells[0].size; cols = 8; rows = (len(cells) + cols - 1) // cols
        out = Image.new('RGB', (cols * W, rows * H), (0, 0, 0))
        for j, cimg in enumerate(cells): out.paste(cimg.resize((W, H)), ((j % cols) * W, (j // cols) * H))
        out.save(f'{OUT}anim-{TAG}-{vp}-{sc}.png'); print(f'{OUT}anim-{TAG}-{vp}-{sc}.png')
