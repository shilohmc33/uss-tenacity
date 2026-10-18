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
- js/npc-ambient.js: generic ambient crew NPCs from AMBIENT_NPCS (data.js). First one: Crewman Thelev sh'Zarath, an Andorian crewwoman (she/her) in the
  Mess & Bar, using CHAR_SHEETS.andorian (stand-in: T'Ren's tren-v1 sheet until assets/andorian-v1.webp exists). tools/andor-shots.js verifies.
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
- js/injuries.js (phase 6, WIP — off: PROG.deaths.enabled = false until it is finished): crew injuries and rare, fair deaths, built to the design memo's safeguards (§2). Injuries only come
  from battle hull hits and hazard events, never the daily crew roll. The injured crew member lies on a sickbay biobed
  (render/deck.js) with an INJURED status on the CREW sheet. A serious injury hangs on a ship's system (coolant / EPS, or the
  fault the hit opened). Fixing it inside the warning window saves them. Deaths: never before day 14 of play or before Lt; never
  senior staff; never the 2 favourites (or the player's 2 pins), who are transferred to a starbase hospital instead. Gentle mode
  (CREW > Crew safety) turns a death into an evacuation. At most 1 death per 21 days of play, inside the crew-event caps. Offline
  outcomes wait until the player has seen the warning. On a death: a memorial log line, a Mess & Bar service, In Memoriam on the
  CREW sheet, and a transfer-in replacement. Tuning: PROG.deaths. Save: G.prog.med (v7). Proof: tools/prog6-shots.js, prog-sim `deaths` mode.
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

## Tester pass 04 fixes (2026-10-17)
- BUG-05 regression: every control is at least 44 px (css/style.css: the pt04 block at the end). Phone stat tiles sit on 2 rows; landscape tiles use 2 columns.
  tools/tap44-check.js measures every visible control in every sheet and modal at 390x844, 844x390 and 1280x800, and fails on anything under 44 px.
- Saves: every load is type-checked and clamped (state.js sanitize, progression.js clampProg/hardenCrew). If a save still breaks the boot, it is kept
  as tenacity.save.v1.corrupt and a fresh shift starts. tools/save-fuzz.js boots the game from ~120 corrupted saves.
- The play day uses the local date (progression.js localDate). The shipment and ordnance favours charge per item and never overflow the locker.
  Decor slots never take a tap that lands on walkable floor. The trade cap is 120. Crew can carry a per-occupant `protected` flag (Thelev):
  never a random transfer, never seriously hurt or killed.
- Pacing: odd jobs between repairs (js/oddjobs.js, PROG.jobs), live hands-off auto XP x0.7 (PROG.auto) with offline auto repairs kept at x0.4
  (PROG.autoOffline), a loosened performance score, and a readiness hint naming the weakest component. Proof: tools/pt04-shots.js -> shots/pt04-*.png.
- 120-day sim (tools/prog-sim.js, 4 runs, after 6060ad1): shots/pt04-sim.txt. Regular player: active 14-16 XP/min, auto ~5.4, offline 1.0; L15 day 7, L27 day 30;
  Lt day 4 [3-7] by readiness, Lt Cmdr day 21 [16-23] (earlier runs 16), Cmdr day 43; ~1.24 crew events/week after week 1; Fleet Rep 30 at day 30.
