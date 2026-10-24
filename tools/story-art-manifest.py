#!/usr/bin/env python3
# Story art manifest: assets/story/manifest.json lists every story image base name (no .webp) so the game only requests
# files that exist (no 404s / console errors when optional _v2 or _c<n> choice art is missing). Run after adding art.
import json, os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "story")
names = sorted(f[:-5] for f in os.listdir(D) if f.endswith(".webp"))
with open(os.path.join(D, "manifest.json"), "w") as fh: fh.write(json.dumps(names, indent=0) + "\n")
print(len(names), "story images in manifest.json")
