# Ensign Thelev — base sheet v1 (tren_topdown_v1 format)

Andorian woman (she/her): blue skin, white chin-length bob, two antennae, small pointed blue ears. DS9-era uniform with gold (ops/engineering) yoke, gold delta combadge on the left chest, flat black duty boots. The gold is **not** tintable: data.js doesn't ask for it. Intended to replace the `CHAR_SHEETS.andorian` "tren-v1" stand-in, i.e. as "andorian-v1".

## Files (out/)
- `{walk|talk|eat|computer|kneel|weld}{A|M|B}_{up|down|right|left}.png`: 72 frames, 160x384, feet anchor (80,376), sole on row 375.
- `sheet_alpha.png`: 640x6912. 18 rows (walkA, walkM, walkB, talkA … weldB); columns up, down, right, left. Play A,M,B,M.
- `hires/`: the same 72 frames as source-resolution masters (never upscaled). Fixed cell 520x900 with the feet anchor at (260,880). Per-strip `scale_hires_to_game` (0.433–0.473) is in `measurements.json`.
- `preview_contact_2x.png`: 2x contact sheet on dark grey.
- GIFs at 8 fps (A-M-B-M, 2x): `talk_down_AMBM.gif`, `eat_down_AMBM.gif`, `walk_right_AMBM.gif`, plus walk_down, walk_up and walk_left.
- `measurements.json`: heights per frame and per action/direction, hair-top heights (antennae excluded), walk bob and stride, and the scale factors.

## Scale
- Action rows: A strips median height 255 px including antennae. That makes the hair-top height ≈ T'Ren's (talk ~242 vs T'Ren 241–244). M/B are matched to A per direction. Kneel uses the fixed base scale 0.46533.
- Walk: set by hair-top height to the tren_walk_v2 standard: down 250, up 245, side A/B 250, M 252. Side heights match the front.
- Shiloh's final in-game size (~0.62 of the old size against rooms) is an engine draw-scale matter. Cells and masters are unchanged on purpose.

## Method
Each strip is a single-reference GenerateImage edit of T'Ren's approved strip for that action, with the full Thelev description in the prompt. Poses, props and positions therefore match T'Ren frame for frame. The strips were keyed per strip with despill, then given a dark-maroon fringe clean-up and an antenna repair: the thin antenna tips were contaminated by the key, so they were recoloured blue with alpha restored.

Walk:
- **up**: A = walkA col 1; M = walkM col 1 (from T'Ren walkM_raw); B = walkB_col1ok col 1 (a real second pose, not a mirror).
- **down**: A = walkA col 2; M = walkM col 2; B = thelev_downB (a single-figure edit with the other foot forward).
- **right**: A = sideA (from tren_walk_v2 A2); M = sideM2 (from tren_walk_v2's lifted-foot M); B = sideB3 (from tren_walk_v2's leg-depth-swapped B, near arm forward, far arm hidden). This approach reuses the approved pixel-edited T'Ren poses as edit references, so no new leg surgery was needed.
- **left**: a mirror of right, with the combadge moved to a foreshortened sliver at the far chest edge.

Raw files not used: `thelev_sideB.jpg` and `thelev_sideB2.jpg` (arms didn't alternate with A), `thelev_sideM.jpg` (no foot lift; replaced by sideM2), and col 2–4 of `thelev_walkB_col1ok.jpg`.
`work/` holds the scripts: slice_strips.py (with --thelev-fix and --hires), walk_build.py, common.py and assemble.py.

## Known flaws
- The side walk left frames are mirrors, so the near and far arms/legs swap. This is the same standard as the approved T'Ren and Lt walks.
- walkB_down's antennae are thinner than in A/M. They were recoloured, but they can still read slightly lighter or thinner in the loop.
- The talkB yoke has a faint quilted texture; the other strips' yokes are smooth.
- Kneel heads look forward rather than down at the tool, which differs from T'Ren's kneel.
- Antenna length varies about 8–16 px between strips. This is generation variance, and heights are normalised to the hair top.
- weldM/weldB sparks are horizontally compressed at the frame edge in a couple of game frames (flagged in measurements). The hires masters keep the full sparks.
