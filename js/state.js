// Single source of truth: everything that matters lives in G and is JSON-serialisable.
import { migrateBattle14, hardenBattle } from "./ships.js";
import { freshEnc, hardenEnc, seedEnc } from "./encounters.js";
import { DECKS, NODEMAP, SYSTEMS, DESTS } from "./data.js";
import { freshProg, migrateProg, migrateProg3, migrateProg4, migrateProg5, migrateProg6, migrateProg7, migrateProg8, migrateProg9, migrateProg10, migrateProg11, migrateProg12, migrateProg13, clampProg, clampResources } from "./progression.js";
export const SAVE_KEY = "tenacity.save.v1";   // key kept; the schema version lives in G.version
export const SAVE_VERSION = 14;               // v2: progression (G.prog); v3: relationships, readiness, rank track, locker tiers; v4: crew roster, fleet rep, favours; v5: rations + quarters; v6: latinum (hidden) + boards + specialisations; v7: sickbay / In Memoriam / gentle mode (G.prog.med); v8: Personal Log (G.prog.plog) + crew pronouns (memo 'v7'; memo v8/v9/v10 -> v9/v10/v11); v9: gifts + tastes known (G.prog.gifts / G.prog.know; memo 'v8'); v10: pass 06 presence-based injury clock, surgery outcome, play-day high-water mark (memo 'v9' Insight is now v11); v11: Insight (G.prog.insight, memo 'v9'), seeded second likes, avoid known; v12: romance (G.prog.romance, memo 'v10'); v13: pass 07 present-time play days (G.prog.dayPresent), paused surgery + assist; v14: battle combatants (G.sp.battle.allies[] / enemies[] / target, js/ships.js)
export const G = {};
export function freshState() {
  return {
    version: SAVE_VERSION,
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
      location: "ds9", travel: null, travelPaused: false, encAcc: 0, battle: null, awayDefer: 0, evasiveT: 0, rep: 0, lastBattleT: -1e9, torpT: 0,
      escortT: 0, escortDone: true, escortChecked: false, resupT: 0, visit: null, preScanned: false, enc: freshEnc(),   // enc: encounter weighting (additive, v14 shape)
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
    night: { sys: null, t: 0, fixes: 0, battleTimes: [], avoided: 0 },
    prog: freshProg(),   // progression.js: level/XP, quality tallies, ship's day, phase 2-4 slots
    npc: {},             // ambient crew (npc-ambient.js): only chat-line / perk cooldown stamps per NPC id   // off-screen night-shift crew (pacing.js)
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
    // ---- migrations ----
    if (!(data.version >= 2)) { data.prog = migrateProg(data.stats, data.sp && data.sp.rep); data.version = 2; }
    if (data.version < 3) { data.prog = migrateProg3(data.prog); data.version = 3; }
    if (data.version < 4) { data.prog = migrateProg4(data.prog); data.version = 4; }
    if (data.version < 5) { data.prog = migrateProg5(data.prog); data.version = 5; }
    if (data.version < 6) { data.prog = migrateProg6(data.prog); data.version = 6; }
    if (data.version < 7) { data.prog = migrateProg7(data.prog); data.version = 7; }
    if (data.version < 8) { data.prog = migrateProg8(data.prog); data.version = 8; }
    if (data.version < 9) { data.prog = migrateProg9(data.prog); data.version = 9; }
    if (data.version < 10) { data.prog = migrateProg10(data.prog); data.version = 10; }
    if (data.version < 11) { data.prog = migrateProg11(data.prog); data.version = 11; }
    if (data.version < 12) { data.prog = migrateProg12(data.prog); data.version = 12; }
    if (data.version < 13) { data.prog = migrateProg13(data.prog); data.version = 13; }
    if (data.version < 14) { migrateBattle14(data.sp); data.version = 14; }   // battle groundwork: a saved battle's single enemy -> battle.enemies[] / allies[]
    // pass 13: a save without encounter memory (pre-encounter builds, or a junk value) rebuilds it from its battle + ship log; a valid one is kept as-is
    if (data.sp && typeof data.sp === "object" && !Array.isArray(data.sp) && !(data.sp.enc && typeof data.sp.enc === "object" && !Array.isArray(data.sp.enc))) data.sp.enc = seedEnc(data.sp, data.prog, data.log);
    for (const k of Object.keys(G)) delete G[k];
    // shallow-merge each section so new fields get defaults
    for (const k of Object.keys(base)) {
      const v = data[k];
      const bo = base[k] && typeof base[k] === "object", ba = Array.isArray(base[k]);
      if (v && typeof v === "object" && !Array.isArray(v) && bo && !ba) G[k] = Object.assign(base[k], v);
      else if (bo && (v === null || typeof v !== "object" || Array.isArray(v) !== ba)) G[k] = base[k];   // pt04 m1: wrong type -> default
      else if (typeof base[k] === "number" && !(typeof v === "number" && Number.isFinite(v))) G[k] = base[k];
      else G[k] = v !== undefined ? v : base[k];
    }
    sanitize(base);
    if (G.lt && !['up', 'down', 'left', 'right'].includes(G.lt.dir)) G.lt.dir = 'down';   // pt07 fuzz: a junk facing broke the sprite lookup
    clampProg();
    clampResources();   // pass 05 m1-a
    G.version = SAVE_VERSION;   // pt04 m1: a stray/future version number never sticks
    return true;
  } catch (e) {
    // pass 05 m1-b: a save that can't be read at all (truncated / invalid JSON, or a load that throws) is kept aside byte
    // for byte as tenacity.save.v1.corrupt before the fresh shift can overwrite it; bootGame tells the player.
    try { const raw = localStorage.getItem(SAVE_KEY); if (raw) { localStorage.setItem(SAVE_KEY + ".corrupt", raw); sessionStorage.setItem("tenacity.recovered", String(e && e.message || e)); } } catch (e2) {}
    return false;
  }
}
// Fall back gracefully when a save references decks/nodes/systems/destinations this build doesn't have
// (renamed or removed content): reset just the broken piece instead of crashing the boot.
function sanitize(base) {
  // pt04 m1: one level down in every section, a field of the wrong type (null opinions, NaN parts...) takes its default
  const ref = freshState();   // pristine defaults (base's section objects were merged into G and now hold the save's values)
  for (const sec of Object.keys(ref)) {
    const b = ref[sec], g = G[sec]; if (!b || typeof b !== "object" || Array.isArray(b) || !g || typeof g !== "object") continue;
    for (const k of Object.keys(b)) {
      const d = b[k], v = g[k]; if (v === undefined) continue;
      if (typeof d === "number" && !(typeof v === "number" && Number.isFinite(v))) g[k] = typeof v === "string" && v.trim() && Number.isFinite(+v) ? +v : d;
      else if (d && typeof d === "object" && (v === null || typeof v !== "object" || Array.isArray(d) !== Array.isArray(v))) g[k] = d;
    }
  }
  const L = G.lt, fl = base.lt;
  if (!L || !DECKS[L.deck] || typeof L.x !== "number" || typeof L.y !== "number" || !isFinite(L.x + L.y)) { G.lt = fl; return sanitize(freshState()); }
  if (L.lift && !DECKS[L.lift.dest]) L.lift = null;
  if (L.node && !NODEMAP[L.node]) { L.node = null; L.mode = "idle"; }
  if (L.repairSys && !SYSTEMS[L.repairSys]) { L.repairSys = null; L.mode = "idle"; }
  const badIntent = it => it && ((it.node && !NODEMAP[it.node]) || (it.sys && !SYSTEMS[it.sys]) || (it.dest && !DECKS[it.dest]));
  if (badIntent(L.intent) || (L.intent && badIntent(L.intent.then))) { L.intent = null; L.path = null; L.mode = "idle"; }
  if (L.lift && badIntent(L.lift.then)) L.lift.then = null;
  if (L.mode === "walk" && !L.path) L.mode = "idle";
  if (G.ship && G.ship.faults) for (const k of Object.keys(G.ship.faults)) { const f = G.ship.faults[k]; if (!SYSTEMS[k] || !f || typeof f !== "object" || !["low", "med", "crit"].includes(f.sev)) delete G.ship.faults[k]; else { if (!Number.isFinite(f.t)) f.t = 0; if (!Number.isFinite(f.cost)) f.cost = 1; if (!Number.isFinite(f.escT)) f.escT = 0; } }
  const SP = G.sp;
  if (SP) {
    if (SP.location != null && !DESTS[SP.location]) SP.location = "ds9";
    if (SP.travel && !DESTS[SP.travel.dest]) { SP.travel = null; SP.travelPaused = false; }
    if (SP.cap && SP.cap.dest && !DESTS[SP.cap.dest]) SP.cap.dest = null;
    SP.enc = hardenEnc(SP.enc);   // encounter weighting: last encounter / spacing (missing in older v14 saves -> fresh)
    { const d = +SP.awayDefer; SP.awayDefer = Number.isFinite(d) && d > 0 ? Math.min(d, 7 * 86400) : 0; }   // pass 16 B1: catch-up held behind a live fight
    hardenBattle(SP);   // battle groundwork: combatant arrays (v14), junk enemy types / hulls (pass-03 N-3: never a negative enemy hull)
    if (SP.ev && SP.ev.active && SP.ev.active.task && !NODEMAP[SP.ev.active.task.node]) SP.ev.active = null;
  }
  if (!Array.isArray(G.log)) G.log = [];
}
export function wipeSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
