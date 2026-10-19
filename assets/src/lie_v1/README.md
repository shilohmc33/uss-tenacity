# lie_v1 — LIE_ART (lying figures)

Follows the hook in js/data.js: `LIE_ART[who] = { img, ax?, ay? }`. Each sheet is ONE ROW of two 384x160 cells
(A, then B with a subtle breathing change). The figure lies on its back, seen from above, HEAD AT THE LEFT. The hip
anchor is the default (192, 80), so no ax/ay are needed. `lieArt()` sees width 768 and plays 2 frames.

## Sheets (out/)
| file | key | content |
|---|---|---|
| lie-lt.png | `lt` | the Lieutenant (black uniform, gold shoulder stripes, combadge) |
| lie-patient.png | `patient` | generic, gender-neutral patient in a plain light-grey gown, barefoot |
| lie-patient-red.png / -gold.png / -blue.png | `patient-red` / `patient-gold` / `patient-blue` | DS9 uniform patient; shoulder panel baked with DEPTS command #c8463c, eng #d4a72c, sci #3d8fc4 |
| lie-patient-grey.png + lie-patient-grey-mask.png | (spare) | same uniform patient with a neutral grey panel (mean 128) and a white=tint mask, if med/ops/etc. colours are wanted later. Same formula as tintedSheet. |
Single frames are `out/<key>_A.png` / `_B.png`. Masters are in `out/hires/`.

Suggested data.js entries (assets need converting to .webp):
```
LIE_ART.lt = { img: "lie-lt" };
LIE_ART.patient = { img: "lie-patient" };
LIE_ART["patient-red"] = { img: "lie-patient-red" };
LIE_ART["patient-gold"] = { img: "lie-patient-gold" };
LIE_ART["patient-blue"] = { img: "lie-patient-blue" };
```

## Scale
- The body length (head top to boot or toe tip) is about 257 sheet px for every key. That matches `LIE_FIG` = 86
  design px at ART_SCALE 83/252 (86/0.3294 = 261) and the standing-height convention (252). The brief's "about 140 px"
  is the legacy unit. In design px the berthing bunk (lieLen 96) fits at lieFit 1.0, and so do the biobed (150) and the
  quarters beds. See work/bedfit_check_3x.png.
- Hip rule: hip x = head-left + 0.50 x body length; hip y = torso midline.
- Hires masters: a fixed 1728x720 cell (4.5x the game cell), hip at (864, 360), at source resolution, never upscaled.
  Scale from hires to game: lt 0.2201, patient (gown) 0.2272, uniform patient (all tints) 0.2280. These are in measurements.json.
- B (breathing) is a pixel edit, not a new generation: the chest band widens about 2.8% across the body axis, with a
  Gaussian falloff centred on the chest and a 3% lift highlight. That is about 1-2 game px.

## Process
- Generation: 3 accepted images on magenta (lt; uniform patient with grey yoke; gown patient as a clothing-only edit
  of the uniform patient), plus 1 rejected gown try (different person, eyes open, one arm hidden). 4 generations total.
- Keyed on the sampled background with despill (slice_strips key_strip). Extra passes:
  - Shadowed magenta in the enclosed arm/body and leg gaps (same hue as the bg, darker) is made transparent.
  - Edge-zone magenta and dark-red fringes are neutralised.
- The yoke mask was grown into the lower shoulder tip, which the adaptive detector missed. The masked grey is
  normalised to mean 128 and then tinted with the engine formula.
- Scripts are in work/. preview_2x.png shows every sheet at 2x on dark grey with the hip anchor marked.
