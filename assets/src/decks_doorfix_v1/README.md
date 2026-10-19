# decks_doorfix_v1 — taller doors (berthing cabin doors and lift; medical front-wall lift)

The originals in /workspace/tenacity/assets are untouched. Every file here is a new version.

## Files
- deck-berthing.png / .webp: all five cabin doorways on the corridor wall and the turbolift are taller.
- deck-medical.png / .webp: the front-wall turbolift is taller and meets the target.
- deck-medical-d50.png / .webp: a gentler medical option at half the raise (see the walk-mask note).
- Before/after previews:
  - before_after_*_full.png: the whole plate at 0.5x.
  - before_after_*_1x.png: 1:1 crops of each edited area.
- scale_check_lt_vs_doors.png: the Lt walk_v2 frame at the final draw size (FIG_H 83 design = 166 art px), standing at
  the cabin door and the medical lift, before and after.
- measurements.json, plus scripts in work/.

## How
- No generation. These are careful pixel edits of the existing plate, so style, palette and every other object stay
  exactly as painted.
- The wall cap and the upper wall face (door tops, arches, lamps, the lift frame and light bar) are moved up as they
  are.
- Only a plain band low on the doors is stretched vertically. In that band, door jambs, pilasters and door leaves are
  vertical, so the stretch doesn't show on them.
- For the lifts the raise ramps smoothly to zero over the angled or curved side walls, so the alcoves still meet the
  unchanged main walls.
- Geometrically this is a taller front wall. It covers more of the floor behind it, as a taller wall would with this
  camera tilt.

## Result (person 83 design px)
| door | before | after | person / door after |
|---|---|---|---|
| berthing cabin doorways | 47 | 97 | 0.86 |
| berthing turbolift | 53 | 98 | 0.85 |
| medical front-wall lift | 49 | 96.5 | 0.86 |
| medical lift, d50 variant | 49 | 74 | 1.12 |

## Honest flaws / integration notes
- **Berthing:**
  - The taller cabin wall now hides the lower part of each cabin: rugs, desks and chairs. Bunks and lockers stay
    visible.
  - Three desk lamps peek over the new wall cap.
  - The stretched band shows as slightly smeared floor texture inside the open doorways. The fifth doorway's red rug
    became a tall red panel.
  - The lamp glow on the pilasters runs longer than before.
  - The lift edit covers the bottom of the two shower stalls. Its bench backs and wall lamps are a little stretched.
  - Walk mask: nothing walkable changed.
- **Medical (full raise):**
  - The curved side walls show stretched panel and light streaks.
  - The alcove now reaches the operating-room front wall at the centre. This closes the bottom strip of the walk ring
    under the OR, where the lift node currently sits (y 0.7625 is now on the wall).
  - Before using it, move the lift node and stand point about 0.07 up, and re-route or trim walk-medical.png. If that
    is not acceptable, use deck-medical-d50: it reaches 1.12 instead of 0.86 but keeps a thin walkway.
- **Not done:**
  - Other short doors in the report (the engineering lift at 0.38; the medical aft door at 1.15) were outside this brief.
  - Nothing is wired into data.js, and the webp files are not copied into assets/.
