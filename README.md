# USS Tenacity — deck game (rebuild)

Static ES-module build. There's no build step.

    cd /workspace/tenacity && python3 -m http.server 8765
    open http://localhost:8765/            (play)
    open http://localhost:8765/?debug=1    (debug menu: battle / faults / events / x1-x5-x20 / offline sim / wipe)
    ?reset=1 wipes the save.

## Layout
- index.html, css/style.css: phone-first shell (WINDOW info view / FULL slim play view, SPACE/DECK).
- js/data.js: decks, nodes, walk rects, systems, destinations, officers, lines, and the sprite atlas frame defs with anchors.
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
- js/ui/hud.js: the DOM HUD.
- js/main.js: loop, input, modes, visibility, and boot.
- js/debug.js
- assets/: harvested art. Ships are pre-keyed from magenta to alpha.
- reference/: original HTML, assets, and attachments.
- tools/: Playwright e2e scripts.
