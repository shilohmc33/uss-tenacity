// Single source of truth: everything that matters lives in G and is JSON-serialisable.
import { DECKS, NODEMAP, SYSTEMS, DESTS } from "./data.js";
export const SAVE_KEY = "tenacity.save.v1";
export const G = {};
export function freshState() {
  return {
    ship: {
      hull: 100, power: 82, shields: 64, parts: 6, partsCap: 20, torps: 4, torpCap: 8,
      energy: 88, charge: 0, lockerT: 0, gen: 0, load: 0,
      stardate: 51504.2, elapsed: 0, faults: {}, nextFault: 210,
      hullFloorWarned: false, powerWarned: false, energyWarned: false, tubeFlash: -9, alertT: 0,
    },
    lt: {
      deck: "engineering", x: 0.45, y: 0.62, dir: "up", walkPhase: 0, moving: false, walkDist: 0, swingAmp: 0,
      path: null, pathI: 0, intent: null, mode: "idle", node: null, repairSys: null, repairT: 0, seatSide: null,
      resumeTorp: false, note: null,
    },
    sp: {
      location: "ds9", travel: null, travelPaused: false, encAcc: 0, battle: null, evasiveT: 0, rep: 0, lastBattleT: -1e9, torpT: 0,
      escortT: 0, escortDone: true, escortChecked: false, resupT: 0, visit: null, preScanned: false,
      cap: { dest: "convoy", reason: "Convoy escort — the ship's assigned duty, pending departure from Deep Space Nine.", decideT: 3, holdLogged: false, legCount: 0, lastDiplo: null, sinceDiplo: 0 },
      ev: { active: null, lastId: null, nextT: -1, legTarget: 0, legFired: 0 },
    },
    ab: {
      pattern: { cd: 0, cdMax: 60, active: 0, last: "" },
      miracle: { cd: 0, cdMax: 75, last: "" },
      scan: { cd: 0, cdMax: 45, active: 0, last: "" },
      spread: { cd: 0, cdMax: 90, last: "" },
    },
    gates: { loader: false, eps: false, shields: false, warpcore: false },
    rc: { node: null, acc: 0, phase: "idle", intNoted: false },
    rp: { stay: false, fullNoted: false },
    lines: { chair: 0, bar: 0 },
    stats: { battles: 0, wins: 0, legs: 0, events: 0, repairs: 0, torpsBuilt: 0, tows: 0, nightFixes: 0 },
    log: [],
    news: null,          // latest ship news line ({html, sd}); restored on reload
    night: { sys: null, t: 0, fixes: 0, battleTimes: [], avoided: 0 },   // off-screen night-shift crew (pacing.js)
    savedAt: 0,
  };
}
export function resetState() {
  for (const k of Object.keys(G)) delete G[k];
  Object.assign(G, freshState());
}
export function saveGame() {
  try { G.savedAt = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(G)); return true; } catch (e) { return false; }
}
export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    const base = freshState();
    for (const k of Object.keys(G)) delete G[k];
    // shallow-merge each section so new fields get defaults
    for (const k of Object.keys(base)) {
      const v = data[k];
      if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) G[k] = Object.assign(base[k], v);
      else G[k] = v !== undefined ? v : base[k];
    }
    sanitize(base);
    return true;
  } catch (e) { return false; }
}
// Fall back gracefully when a save references decks/nodes/systems/destinations this build doesn't have
// (renamed or removed content): reset just the broken piece instead of crashing the boot.
function sanitize(base) {
  const L = G.lt, fl = base.lt;
  if (!L || !DECKS[L.deck] || typeof L.x !== "number" || typeof L.y !== "number" || !isFinite(L.x + L.y)) { G.lt = fl; return sanitize(freshState()); }
  if (L.lift && !DECKS[L.lift.dest]) L.lift = null;
  if (L.node && !NODEMAP[L.node]) { L.node = null; L.mode = "idle"; }
  if (L.repairSys && !SYSTEMS[L.repairSys]) { L.repairSys = null; L.mode = "idle"; }
  const badIntent = it => it && ((it.node && !NODEMAP[it.node]) || (it.sys && !SYSTEMS[it.sys]) || (it.dest && !DECKS[it.dest]));
  if (badIntent(L.intent) || (L.intent && badIntent(L.intent.then))) { L.intent = null; L.path = null; L.mode = "idle"; }
  if (L.lift && badIntent(L.lift.then)) L.lift.then = null;
  if (L.mode === "walk" && !L.path) L.mode = "idle";
  if (G.ship && G.ship.faults) for (const k of Object.keys(G.ship.faults)) if (!SYSTEMS[k]) delete G.ship.faults[k];
  const SP = G.sp;
  if (SP) {
    if (SP.location != null && !DESTS[SP.location]) SP.location = "ds9";
    if (SP.travel && !DESTS[SP.travel.dest]) { SP.travel = null; SP.travelPaused = false; }
    if (SP.cap && SP.cap.dest && !DESTS[SP.cap.dest]) SP.cap.dest = null;
    if (SP.ev && SP.ev.active && SP.ev.active.task && !NODEMAP[SP.ev.active.task.node]) SP.ev.active = null;
  }
  if (!Array.isArray(G.log)) G.log = [];
}
export function wipeSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
