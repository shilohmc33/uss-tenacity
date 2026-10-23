#!/usr/bin/env python3
# Regenerate js/ship-states.js (+ assets/ss-*.webp for the named ships) from the artist's ships_states_v1/out/states.json.
# Usage: python3 tools/gen-ship-states.py galor freighter ...   (no args: rewrite the JS only)
import json, sys, shutil, os
from PIL import Image
SRC = "/home/box/Desktop/USS Tenacity Game Data/sprites/ships_states_v1/out"
d = json.load(open(f"{SRC}/states.json")); shutil.copy(f"{SRC}/states.json", "assets/src/ships_states_v1/states.json")
conv = set(sys.argv[1:])
def webp(png, name, lossy):
    if conv and name.split("-")[1] in conv:
        im = Image.open(f"{SRC}/{png}").convert("RGBA")
        im.save(f"assets/{name}.webp", lossless=not lossy, quality=90 if lossy else 100, method=6)
    return Image.open(f"{SRC}/{png}").size
out = {"cell": d["cell"], "pivot": d["pivot"], "ships": {}}
for k, v in d["ships"].items():
    s = {"damaged": f"ss-{k}-damaged", "sections": [], "debris": []}; webp(v["damaged"], s["damaged"], True)
    for i, p in enumerate(v["sections"]):
        n = f"ss-{k}-wreck-{i}"; webp(p["file"], n, False)
        s["sections"].append({"img": n, "off": p["offset_px"], "size": p["size"], "pivot": p["pivot_in_piece_px"], "vel": p["suggest"]["vel_px_s"], "spin": p["suggest"]["spin_deg_s"]})
    for i, p in enumerate(v["debris"]):
        n = f"ss-{k}-debris-{i}"; sz = webp(p["file"], n, False)
        s["debris"].append({"img": n, "off": p["offset_px"], "size": list(p.get("size", sz)), "vel": p["suggest"]["vel_px_s"], "spin": p["suggest"]["spin_deg_s"]})
    out["ships"][k] = s
hdr = open("js/ship-states.js").read().split("export const SHIP_STATES")[0]
js = hdr + "export const SHIP_STATES = " + json.dumps(out, separators=(",", ":")) + ";\n" + \
  "export const SHIP_STATE_IMAGES = Object.values(SHIP_STATES.ships).flatMap(s => [s.damaged, ...s.sections.map(p => p.img), ...s.debris.map(p => p.img)]);\n"
open("js/ship-states.js", "w").write(js)
for k, s in out["ships"].items(): print(k, len(s["sections"]), len(s["debris"]))
