# seat_v1 — SEAT_ART (seated person, no chair)

Follows the hook in js/data.js: `SEAT_ART[who] = { img, ax?, ay?, talk? }`. The grid is 160x384 with COLUMNS
[up, down] and ROWS idle A, idle B, talk A, talk B. Each sheet is 320x1536, so set `talk: true`. The hip anchor is
the default (80, 300). Only the person is drawn; the bridge chair is painted on the deck.

Suggested data.js entries (convert to .webp):
```
SEAT_ART.lt = { img: "seat-lt", talk: true };
SEAT_ART.tren = { img: "seat-tren", talk: true };
```
Single frames are `out/<who>_<row>_<up|down>.png`. Masters are in `out/hires/`.

## Scale
Same game scale as the standing sets. The scale per view comes from idle A: the mean of
(standing head width / seated head width) and (standing head height / seated head height). The standing references
were measured on the lt_walk_v2 and tren_topdown_v1 walk frames: Lt head 43.8x41 (down) and 43.2x46 (up); T'Ren
about 35x37.
| who | view | hires -> game | seated bbox height (game px) |
|---|---|---|---|
| lt | up | 0.3932 | 141-146 |
| lt | down | 0.2659 | 164-166 |
| tren | up | 0.2876 | 144-145 |
| tren | down | 0.3010 | 190-191 |
- Hip: hip y = head top + k x head height, with k set by eye on idle A (top of the thighs / seat contact):
  lt down 2.75, up 2.55; tren down 3.10, up 3.15. Hip x = alpha-weighted centre of the leg/seat rows.
- Hires masters: a fixed 640x1536 cell (4x the game cell), hip at (320, 1200), at source resolution, never upscaled.
- Below the hip, the down frames use 59 px (Lt) and 78 px (T'Ren) of the 84 px available, so nothing is clipped.

## Rows
- idle A: generated.
- idle B: synthesised breathing (the upper body stretches 1.2% upward about the hip, about 1-2 px).
- talk A/B, down: generated edits of idle A (one hand raised, then the other hand lifted, mouth open).
- talk A, up: generated edit of idle A up (one hand raised beside the shoulder). talk B up is talk A mirrored.
  The back view has no badge, so mirroring is safe.
- Lt up talk: the gesture hand overran the 160 cell by a few px, so the arm beyond the shoulder was squeezed
  horizontally (x0.9-ish, recorded in measurements.json).

## Process / generation count
- 19 generations in total:
  - Accepted (10 used): lt down idle/talkA/talkB, lt up idle/talkA, tren down idle/talkA/talkB, tren up idle/talkA.
  - Rejected, 9 (in raw/rejected/ where saved): 6 low-camera down views (lt and tren idle/talkA/talkB; at the
    standing-set scale their legs were too long and overflowed the hip-300 cell); 1 tren steep-camera try with
    identity drift; and 2 lt up tries (a squat, and a standing/cropped image; not saved).
- Keying, despill and gap cleaning are the same as lie_v1. Scripts are in work/. preview_2x.png shows all frames at
  2x on dark grey next to the standing walk frame at the same game scale, with the hip anchor marked.
