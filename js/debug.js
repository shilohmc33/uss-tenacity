// ?debug=1 — force battle/fault/event, time-scale, offline sim.
import { G, saveGame, wipeSave } from "./state.js";
import { spawnFault } from "./faults.js";
import { startBattle, towToDS9 } from "./battle.js";
import { foe } from "./ships.js";
import { fireEvent, EV_POOL } from "./events.js";
import { arriveAtDest, captainOrder } from "./voyage.js";
import { showBackOnWatch, renderLog } from "./ui/hud.js";
import { DESTS } from "./data.js";
import { DBG } from "./render/deck.js";
import { forceStory, EV as STORY_EV } from "./story.js";
export function setupDebug(app, ui) {
  const el = document.getElementById("debug");
  el.hidden = false;
  const sid = new URLSearchParams(location.search).get("story");   // E1: ?debug=1&story=<id> forces a story event (no gates)
  if (sid) setTimeout(() => { if (!STORY_EV[sid]) console.warn("unknown story id: " + sid + " (" + Object.keys(STORY_EV).join(", ") + ")"); else forceStory(sid); }, 300);
  const btn = (label, fn) => `<button data-a="${label}">${label}</button>`;
  const acts = {
    "Battle": () => startBattle("debug"),
    "Fault LOW": () => spawnFault("ambient", null, "low"), "Fault MED": () => spawnFault("ambient", null, "med"), "Fault CRIT": () => spawnFault("battle", null, "crit"),
    "Kill enemy": () => { const E = foe(G.sp.battle); if (E) E.hull = 1; },
    "Battle fighter": () => startBattle("debug", { enemy: "jh_fighter" }), "Battle Galor": () => startBattle("debug", { enemy: "galor" }), "Battle cruiser": () => startBattle("debug", { enemy: "jh_battlecruiser" }),
    "Tow": () => towToDS9(), "Arrive": () => { if (G.sp.travel) arriveAtDest(); },
    "Depart": () => captainOrder(G.sp.location === "convoy" ? "nebula" : "convoy", "Debug order."),
    "x1": () => app.timeScale = 1, "x5": () => app.timeScale = 5, "x20": () => app.timeScale = 20,
    "Save": () => saveGame(), "Back on watch": () => showBackOnWatch(8 * 3600),
    "Wipe": () => { window.__noSave = true; wipeSave(); location.href = location.pathname + "?debug=1&reset=1"; },
    "Walk grid": () => { DBG.walk = !DBG.walk; },
    "Idle now": () => { __T.PACE_RT.idleT = 1e6; },
  };
  for (const e of EV_POOL) acts["Ev " + e.id] = () => { if (G.sp.ev.active) G.sp.ev.active = null; fireEvent(e.id); };
  el.innerHTML = `<div class="t">DEBUG ▸</div><div class="b" hidden>${Object.keys(acts).map(btn).join("")}</div>`;
  el.onclick = e => {
    if (e.target.classList.contains("t")) { const b = el.querySelector(".b"); b.hidden = !b.hidden; return; }
    const a = e.target.dataset.a; if (a && acts[a]) acts[a]();
  };
  window.__D = acts;
}
