# Generic male crewman — tint base v1 (tren_topdown_v1 format)

A human man of average build with short dark-brown hair. He wears a DS9-era uniform: black jumpsuit, NEUTRAL MID-GREY shoulder yoke for department tinting, charcoal undershirt collar, gold combadge on the left chest and black boots/shoes. He is about 3% taller than T'Ren.

## Files (out/)
- **Frames:** 72 frames named `{walk|talk|eat|computer|kneel|weld}{A|M|B}_{up|down|right|left}.png`. Each is 160x384 with the feet anchor at (80,376).
- **`sheet_alpha.png`:** 640x6912, 18 rows (walkA … weldB). Columns are up, down, right, left. Play A,M,B,M.
- **Tint mask (for `TINT_BASES`):**
  - `sheet_mask.png` is 640x6912. White = tint weight, black = keep. It covers the shoulder yoke only; collar, badge, skin, hair, mug, bowl, tools and torch are excluded.
  - Per-frame masks are `{frame}_mask.png` (L) and `hires/{frame}_mask.png`.
  - The yoke pixels are normalised to neutral grey with mean luminance 128. art-hooks.js's `k = lum/0.5` then gives exactly the department colour at the panel mean and keeps the folds.
  - Suggested entry: `TINT_BASES["crew-male-v1"] = { img: "crew-male-v1", pronoun: "he", mask: "crew-male-v1-mask" }`. Export `sheet_alpha` → `crew-male-v1.webp` and `sheet_mask` → `crew-male-v1-mask` in whatever format the engine loads masks in.
- **`hires/`:** source-resolution masters (never upscaled). Fixed cell 520x900 with the feet anchor at (260,880). Per-strip `scale_hires_to_game` (≈0.435–0.483) is listed in `measurements.json`.
- **Previews:**
  - `preview_contact_2x.png`: 2x contact sheet on dark grey.
  - `preview_tint_test.png`: red/gold/blue run through the engine's own tint formula.
- **GIFs** (8 fps, A-M-B-M): talk_down, eat_down and walk_right, plus walk_down, walk_up and walk_left.
- **`measurements.json`:** heights, walk bob and stride, scale factors, and the tint notes.

## Scale
- **Action rows:** the A-strip median height is 249 px (T'Ren talk is ~241–244). M and B are matched to A per direction. Kneel uses the base scale.
- **Walk:** set by hair-top height. Down 257, up 252, side A/B 257, M 259. Side head x is 70 (right) and 90 (left), 2 px further in than T'Ren, so the wide B stride fits.
- **Final in-game size:** Shiloh's figure (~0.62 of the old size against rooms) is engine draw scale. Cells and masters are unchanged.

## Method
Each strip is a single-reference edit of T'Ren's approved strips, with the full description in every prompt and an explicit "recolour the red yoke to neutral mid-grey" line.

The walk uses the same recipe as Thelev:
- **up:** A from walkA col 1, M from walkM col 1, B from Thelev's walkB col 1 (as a pose reference).
- **down:** A from walkA col 2, M from walkM col 2, B from Thelev's downB.
- **right:** A from T'Ren A2, M from T'Ren's lifted-foot M, B from T'Ren's leg-depth-swapped B, with the near arm forward and the far arm hidden.
- **left:** mirror of right, with the combadge moved to the far chest edge.

The mask is an adaptive grey-panel detector: it finds the brightest grey peak in the shoulder band, rejects the bluish/dark collar, and grows into the shaded panel edges. Scripts are in `work/`.

Rejected raws are kept in `raw/` as `rejected_*`. Two other rejects were never saved: a talkM that dropped the mug and pose, and a kneelM that came back with a red yoke.

## Known flaws
- **Footwear:** the generations give low black boots / shoe-like footwear rather than T'Ren's taller boots. It is consistent across all strips.
- **Mask edges:** a few pixels of the darkest outer yoke edge, and the yoke in the shade of hands (e.g. eatB_down, talkB side), stay untinted grey. Mask area varies about ±15% between A/M/B of a row.
- **kneelB yoke:** it was generated darker. Normalisation brings it to the same 128 mean, but its texture is slightly more charcoal.
- **Left walk frames:** these are mirrors, as with T'Ren and the Lt.
- **weldB sparks:** in a couple of game frames the sparks are compressed at the frame edge (flagged). The hires masters keep the full sparks.
