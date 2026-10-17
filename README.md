# USS Tenacity — deck game (rebuild)

Static ES-module build. There's no build step.

    cd /workspace/tenacity && python3 -m http.server 8765
    open http://localhost:8765/            (play)
    open http://localhost:8765/?debug=1    (debug menu: battle / faults / events / x1-x5-x20 / offline sim / wipe)
    ?reset=1 wipes the save.

## Layout
- index.html, css/style.css: phone-first shell (WINDOW info view / FULL slim play view, SPACE/DECK).
- js/data.js: decks, nodes, walk rects, systems, destinations, officers, lines, and the sprite atlas frame defs with anchors.
  The Lieutenant uses assets/lt-v3.webp (LT2_SHEETS / LT2_FRAMES: walk, talk, eat, computer, kneel, weld x up/down/right/left x A/M/B,
  160x384 cells, feet at 80,376, refH 252 -> FIG_H). Only the bunk/biobed lying pose still comes from crew-atlas.
  Sheets are per character (CHAR_SHEETS / CHAR_FRAMES / charFrame): Captain T'Ren uses assets/tren-v1.webp (same grid and scale).
- js/npc.js: Captain T'Ren on the Bridge (visual only, not saved): stands beside the chair, works consoles, talks when the Lt
  reports at the chair or stands beside her, holds at the chair in battle. Spots in data.js TREN.
- js/state.js: the single serialisable state G, plus save/load (localStorage).
- js/path.js: per-deck 60x40 grid and A*.
- js/crew.js: the Lieutenant (intents, zones, walk, repair, rest, recharge, torpedo replication, turbolift).
- js/faults.js: severity, priority chain, duty list, capability gates.
- js/voyage.js: T'Ren's autonomous voyage, arrivals, docks, and the single voyage view-model.
- js/events.js: the 9 random events, timed deck tasks (10 s warning and expiry).
- js/battle.js: the battle, officer AI, abilities, tow to DS9, and space FX state.
- js/sim.js: the fixed-order step and offline catch-up.
- js/render/deck.js: the camera (follow, zoom, pan), plates, sprites, rings, and the turbolift overlay.
- js/render/space.js: backdrop crossfade, ships, beams, torpedoes, shields, and explosions.
- js/ui/hud.js: the DOM HUD. Landscape phones (orientation landscape, height <= 500px) get their own layout in css/style.css:
  stats column | deck | side column (alert, modes, stations, sheet buttons), one merged LT/SHIP line, sheets as a right drawer.
- js/main.js: loop, input, modes, visibility, and boot.
- js/debug.js
- assets/: harvested art. Ships are pre-keyed from magenta to alpha.
- reference/: original HTML, assets, and attachments.
- tools/: Playwright e2e scripts (tools/lt2-shots.js: Lt sprite screenshots -> shots/lt2_*.png; tools/tren-shots.js: T'Ren -> shots/tren_*.png).

## Playtest-02 fixes (2026-10-17)
- Pacing knobs added to js/pacing.js: firstLegTime, nightFaultCap, offlineHullFloor, ltDrain/ltDrainBattle, repairRep/repairParts.
- Per-deck crew light tint: DECK_LIGHT in js/data.js (retune when the new deck art lands).
- Verification tools (NODE_PATH=/workspace/pwtools/node_modules):
  tools/pt02-shots.js [base] [tag] -> shots/pt02-*-<tag>.png + shots/pt02-report-<tag>.json (390x844, 844x390, 1280x800)
  tools/pt02-offline-sim.js [base] [runs] [out.json] (real catchUp, fresh + crisis starts) ·
  tools/pt02-energy-sim.js [base] · tools/pt02-checks.js [base] · tools/pt02-tint-check.js · tools/pt02-smoke.js
