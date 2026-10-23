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
export const freshEnc = () => ({ last: null, since: 99, lastBcPD: -1, n: Object.fromEntries(ENEMY_IDS.map(k => [k, 0])), held: 0, off: Object.fromEntries(ENEMY_IDS.map(k => [k, 0])), bcRec: [] });
// pass 15 D2: off = fights rolled while the player was away (offline catch-up / idle tab), by type; bcRec = the last BC_REC battlecruiser
// fights { pd, away, h0, h1, out } (hull before / after; out won | disengaged | towed) - for the sims, the report and tuning.
const BC_REC = 60;
// the ship is "crippled" (pass 13 manager call: the ONLY condition that holds her back): hull below minHull or an open fault of
// blockSev (crit); pass 15 D1: also 0 torpedoes or main power below minPower (the worst legal start was ~0% wins). Lesser faults don't matter.
export function shipCrippled(ship) {
  const c = PACE.encounter.bc, S = ship || {};
  if (!(S.hull >= c.minHull)) return true;
  if (!(S.torps >= c.minTorps) || !(S.power >= c.minPower)) return true;   // pass 15 D1 / N1: fewer than 2 torpedoes or power below 30% count as crippled too
  return !!(S.faults && Object.values(S.faults).some(f => f && f.sev === c.blockSev));
}
export const shipWorn = shipCrippled;   // pass 12 name, kept for the tools
// why the battlecruiser can't come up right now (null = she can)
export function bcBlock(prog, ship, enc, away = false) {
  const c = PACE.encounter.bc, p = prog || {}, e = enc || freshEnc();
  if ((p.rank | 0) < c.minRank) return "rank";
  if ((p.day || 0) < c.minShipDay) return "day";
  if (e.last === BC || (e.since | 0) < c.gapBattles) return "gap";   // never twice running, and at least gapBattles other fights between ...
  if (e.lastBcPD >= 0 && (p.playDays | 0) - e.lastBcPD < c.gapPlayDays) return "gap";   // ... AND at least gapPlayDays play days (pass 13)
  if (away && e.lastBcPD >= 0 && (p.playDays | 0) - e.lastBcPD < c.awayGapPlayDays) return "gap";   // pass 15 D2: while away, a much longer gap
  if (shipCrippled(ship)) return "crippled";
  return null;
}
// the table as rows (for the README / sim / tests): [{ id, w, open, why }]
// pass 15 D2: away = the player isn't watching (offline catch-up or an idle tab): PACE.encounter.awayWeights, the battlecruiser rarer
export function encounterTable(prog, ship, enc, away = false) {
  const W = away ? PACE.encounter.awayWeights : PACE.encounter.weights, blk = bcBlock(prog, ship, enc, away);
  return ENEMY_IDS.filter(id => W[id] > 0).map(id => ({ id, w: W[id], open: id !== BC || !blk, why: id === BC ? blk : null }));
}
// -> { id, src: "forced" | "ctx" | "table", held: true when the battlecruiser was rolled out only by the crippled-ship check }
export function chooseEncounter(ctx, { prog, ship, enc, forced, away = false, rnd = Math.random } = {}) {
  if (forced && SHIPS[forced] && SHIPS[forced].side === "enemy") return { id: forced, src: "forced" };
  if (CTX_ENEMY[ctx]) return { id: CTX_ENEMY[ctx], src: "ctx" };
  const rows = encounterTable(prog, ship, enc, away), pool = rows.filter(r => r.open);
  const tot = pool.reduce((a, r) => a + r.w, 0); let x = rnd() * tot, id = BASELINE_ENEMY;
  for (const r of pool) { x -= r.w; if (x < 0) { id = r.id; break; } }
  const bcRow = rows.find(r => r.id === BC);
  return { id, src: "table", held: !!(bcRow && bcRow.why === "crippled") };
}
// book-keeping after a battle starts (debug drills don't count: they are not encounters)
// multi-ship P2: the wingmen that join a lead ship (ids, slot order). rnd is injectable for the sims.
export function chooseWingmen(lead, ctx, { prog, ship, away = false, rnd = Math.random } = {}) {
  const g = PACE.encounter.groups; const S = ship || {}, bc = PACE.encounter.bc;   // a battered ship (hull below the battlecruiser gate, or a fault at its block severity) meets lone ships; torps/power don't count here
  if (!g || g.solo.includes(ctx) || !(S.hull >= bc.minHull) || (S.faults && Object.values(S.faults).some(f => f && f.sev === bc.blockSev))) return [];
  const pd = (prog && prog.playDays) | 0, tier = g.tiers.filter(t => pd >= t.minPlayDays).pop(); if (!tier || !(tier.wingP > 0)) return [];
  const max = Math.min(g.max, away ? g.awayMax : g.max), out = []; let left = tier.budget - (g.threat[lead] || 1);
  while (out.length + 1 < max && rnd() < tier.wingP) {
    const pool = Object.entries(g.wingmen).filter(([id, w]) => w > 0 && (g.threat[id] || 1) <= left); if (!pool.length) break;
    let x = rnd() * pool.reduce((a, [, w]) => a + w, 0), id = pool[0][0]; for (const [k, w] of pool) { x -= w; if (x < 0) { id = k; break; } }
    out.push(id); left -= g.threat[id] || 1;
  }
  return out;
}
export function noteEncounter(SP, id, ctx, playDays, held, away = false) {
  if (ctx === "debug") return;
  const e = SP.enc = hardenEnc(SP.enc);
  e.last = id; e.n[id] = (e.n[id] | 0) + 1; if (away) e.off[id] = (e.off[id] | 0) + 1;
  if (held) e.held++;
  if (id === BC) { e.since = 0; e.lastBcPD = playDays | 0; } else e.since = Math.min(999, (e.since | 0) + 1);
}
// pass 15 D2: one battlecruiser fight's record (called when she is beaten, T'Ren breaks off, or the Tenacity is towed)
export function noteBcEnd(SP, rec) {
  const e = SP.enc = hardenEnc(SP.enc); e.bcRec.push(rec); if (e.bcRec.length > BC_REC) e.bcRec.splice(0, e.bcRec.length - BC_REC);
}
// load-time hardening: junk -> defaults, never throws
export function hardenEnc(v) {
  const f = freshEnc(); if (!v || typeof v !== "object" || Array.isArray(v)) return f;
  const int = (x, d, lo, hi) => Number.isFinite(+x) && x !== null && x !== "" && typeof x !== "boolean" ? Math.max(lo, Math.min(hi, Math.floor(+x))) : d;
  const n = v.n && typeof v.n === "object" && !Array.isArray(v.n) ? v.n : {}, off = v.off && typeof v.off === "object" && !Array.isArray(v.off) ? v.off : {};
  const nn = Object.fromEntries(ENEMY_IDS.map(k => [k, int(n[k], 0, 0, 1e6)]));
  return { last: typeof v.last === "string" && ENEMY_IDS.includes(v.last) ? v.last : null, since: int(v.since, 99, 0, 999), lastBcPD: int(v.lastBcPD, -1, -1, 1e6),
    n: nn, held: int(v.held, 0, 0, 1e6),
    off: Object.fromEntries(ENEMY_IDS.map(k => [k, Math.min(nn[k], int(off[k], 0, 0, 1e6))])),   // away fights are a subset of all fights
    bcRec: (Array.isArray(v.bcRec) ? v.bcRec : []).filter(r => r && typeof r === "object" && !Array.isArray(r)).slice(-BC_REC)
      .map(r => ({ pd: int(r.pd, 0, 0, 1e6), away: r.away === true, h0: int(r.h0, 0, 0, 100), h1: int(r.h1, 0, 0, 100), out: ["won", "disengaged", "towed"].includes(r.out) ? r.out : "won" })) };
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
