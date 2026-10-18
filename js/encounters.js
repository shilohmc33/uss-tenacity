// Encounter weighting: the data-driven table that picks WHICH enemy a battle brings (replaces the old SHIPS[].mix roll).
// Order of precedence: a forced type (tests, debug buttons) > a story context that names the enemy (ships.js CTX_ENEMY:
// the defector trap is a Galor, the shadow a fighter, a debug drill the baseline) > the weighted table below.
// The table: PACE.encounter.weights (fighter > Galor >> battlecruiser), and the battlecruiser's gates (PACE.encounter.bc):
// rank + ship's day (the groundwork's Lt + day 21, kept), a spacing rule (never twice in a row; pass 13: >= gapBattles other fights AND >= gapPlayDays play days), and a "crippled ship" check. A closed gate drops the battlecruiser
// from the roll, so the odds renormalise over fighter / Galor (50:40) - their individual fights are untouched.
// G.sp.enc (saved, additive to the v14 shape; hardened at load): { last, since, lastBcPD, n: { type: count }, held }.
import { PACE } from "./pacing.js";
import { SHIPS, ENEMY_IDS, CTX_ENEMY, BASELINE_ENEMY } from "./ships.js";

const BC = "jh_battlecruiser";
export const freshEnc = () => ({ last: null, since: 99, lastBcPD: -1, n: Object.fromEntries(ENEMY_IDS.map(k => [k, 0])), held: 0 });
// the ship is "crippled" (pass 13 manager call: the ONLY condition that holds her back): hull below minHull or an open fault of
// blockSev (crit). Power, torpedoes and lesser faults no longer matter - she is an event, and a passing ship should feel it.
export function shipCrippled(ship) {
  const c = PACE.encounter.bc, S = ship || {};
  if (!(S.hull >= c.minHull)) return true;
  return !!(S.faults && Object.values(S.faults).some(f => f && f.sev === c.blockSev));
}
export const shipWorn = shipCrippled;   // pass 12 name, kept for the tools
// why the battlecruiser can't come up right now (null = she can)
export function bcBlock(prog, ship, enc) {
  const c = PACE.encounter.bc, p = prog || {}, e = enc || freshEnc();
  if ((p.rank | 0) < c.minRank) return "rank";
  if ((p.day || 0) < c.minShipDay) return "day";
  if (e.last === BC || (e.since | 0) < c.gapBattles) return "gap";   // never twice running, and at least gapBattles other fights between ...
  if (e.lastBcPD >= 0 && (p.playDays | 0) - e.lastBcPD < c.gapPlayDays) return "gap";   // ... AND at least gapPlayDays play days (pass 13)
  if (shipCrippled(ship)) return "crippled";
  return null;
}
// the table as rows (for the README / sim / tests): [{ id, w, open, why }]
export function encounterTable(prog, ship, enc) {
  const W = PACE.encounter.weights, blk = bcBlock(prog, ship, enc);
  return ENEMY_IDS.filter(id => W[id] > 0).map(id => ({ id, w: W[id], open: id !== BC || !blk, why: id === BC ? blk : null }));
}
// -> { id, src: "forced" | "ctx" | "table", held: true when the battlecruiser was rolled out only by the crippled-ship check }
export function chooseEncounter(ctx, { prog, ship, enc, forced, rnd = Math.random } = {}) {
  if (forced && SHIPS[forced] && SHIPS[forced].side === "enemy") return { id: forced, src: "forced" };
  if (CTX_ENEMY[ctx]) return { id: CTX_ENEMY[ctx], src: "ctx" };
  const rows = encounterTable(prog, ship, enc), pool = rows.filter(r => r.open);
  const tot = pool.reduce((a, r) => a + r.w, 0); let x = rnd() * tot, id = BASELINE_ENEMY;
  for (const r of pool) { x -= r.w; if (x < 0) { id = r.id; break; } }
  const bcRow = rows.find(r => r.id === BC);
  return { id, src: "table", held: !!(bcRow && bcRow.why === "crippled") };
}
// book-keeping after a battle starts (debug drills don't count: they are not encounters)
export function noteEncounter(SP, id, ctx, playDays, held) {
  if (ctx === "debug") return;
  const e = SP.enc = hardenEnc(SP.enc);
  e.last = id; e.n[id] = (e.n[id] | 0) + 1;
  if (held) e.held++;
  if (id === BC) { e.since = 0; e.lastBcPD = playDays | 0; } else e.since = Math.min(999, (e.since | 0) + 1);
}
// load-time hardening: junk -> defaults, never throws
export function hardenEnc(v) {
  const f = freshEnc(); if (!v || typeof v !== "object" || Array.isArray(v)) return f;
  const int = (x, d, lo, hi) => Number.isFinite(+x) && x !== null && x !== "" && typeof x !== "boolean" ? Math.max(lo, Math.min(hi, Math.floor(+x))) : d;
  const n = v.n && typeof v.n === "object" && !Array.isArray(v.n) ? v.n : {};
  return { last: typeof v.last === "string" && ENEMY_IDS.includes(v.last) ? v.last : null, since: int(v.since, 99, 0, 999), lastBcPD: int(v.lastBcPD, -1, -1, 1e6),
    n: Object.fromEntries(ENEMY_IDS.map(k => [k, int(n[k], 0, 0, 1e6)])), held: int(v.held, 0, 0, 1e6) };
}
// pass 13: keep the encounter memory through migration. A save from before G.sp.enc existed (or with a junk one) has no memory,
// so "never twice running" would reset on the first load after updating. Rebuild what the save can tell us: a battle in
// progress names the current enemy, and the ship log's red-alert openers (newest last, capped at 250 lines) name recent ones.
// A battlecruiser seen there counts as fought "today" (log lines carry no play day), so the 2-play-day spacing holds from load.
const OPENER = /Red alert!|weapons hot!|opens fire\./, typeOf = msg => /battlecruiser/i.test(msg) ? BC : /Galor/.test(msg) ? "galor" : /fighter/i.test(msg) ? "jh_fighter" : null;
export function seedEnc(sp, prog, log) {
  const e = freshEnc(), seen = [];
  for (const x of Array.isArray(log) ? log : []) { const m = x && typeof x.msg === "string" ? x.msg : ""; if (!OPENER.test(m) || /^Simulation drill/.test(m)) continue; const t = typeOf(m); if (t) seen.push(t); }
  const B = sp && sp.battle, cur = B && Array.isArray(B.enemies) && B.enemies[0] && B.enemies[0].ship;
  if (cur && ENEMY_IDS.includes(cur) && B.ctx !== "debug" && seen[seen.length - 1] !== cur) seen.push(cur);
  if (!seen.length) return e;
  for (const t of seen) e.n[t]++;
  e.last = seen[seen.length - 1]; const bi = seen.lastIndexOf(BC);
  if (bi >= 0) { e.since = Math.min(999, seen.length - 1 - bi); e.lastBcPD = Math.max(0, Math.floor(+(prog && prog.playDays) || 0)); }
  return e;
}
