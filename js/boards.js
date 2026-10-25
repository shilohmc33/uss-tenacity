// Phase 5: promotion boards + specialisations.
// Boards: hooks.promotionDue is intercepted -- near a rank threshold (readiness 100, early call-up, the Lt guarantee)
// Okafor (engineering track) or T'Ren (command) convenes a short review instead of a silent promotion. The board
// never resolves while the player is away: it is queued and the HUD opens it on return. Outcome odds come from
// readiness (PROG.boards.odds); a pass runs the normal promote() flow (quarters move, rank unlocks).
// Specs: at each PROG.specs.picks level the Lt picks a focus (or upgrades one); progression.specFx applies it.
import { G } from "./state.js";
import { log, toast, fx, cheer } from "./bus.js";
import { PROG, hooks, promote, nextRank, computeReadiness, addr, rankName, crewList, opinionOf } from "./progression.js";

const P = () => G.prog;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CHAIR = {
  okafor: { name: "Cmdr Okafor", title: "Chief Engineer", img: "crew-engineer", she: true },
  tren: { name: "Captain T'Ren", title: "Commanding Officer", img: "crew-captain", she: true },
};
// in-character lines: {addr} = how the Lt is addressed now, {rank} = the rank under review, {friend} = the crewmate
// who likes him most, {lvl} = level. open: 2 lines are drawn; pass / defer / fail: 1 line each.
export const BOARD_LINES = {
  okafor: {
    open: [
      "Okafor drops a padd on the table. 'Your repair logs, {addr}. All of them. I read every one — even the ones you hoped I'd skip.'",
      "'Diallo and Hale sat in. Don't look at them, look at me.'",
      "'{friend} put in a word for you. Unprompted. That doesn't happen on my deck.'",
      "'Level {lvl}. Your hands are fine. The question is whether you can run a section when I'm not watching.'",
      "Okafor taps the table twice. 'You know what this is. Promotion to {rank}. Make your case by standing there and not fidgeting.'",
      "'I've seen you crawl into the coolant manifold at 0300 without being asked. I've also seen you leave a conduit half-sealed.'",
    ],
    pass: ["Okafor almost smiles. 'Recommended. Unanimously, before you ask. Go and tell T'Ren before I change my mind, {rank}.'",
      "'Approved. You'll get your pips at the chair. And {rank}? Don't make me regret it.'"],
    defer: ["'Not no. Not yet. Another couple of shifts like last week and we sit again.'",
      "Okafor closes the padd. 'Deferred. The board wants one more look at you under pressure. So do I.'"],
    fail: ["'Not this time. Your numbers dipped and the board noticed. So did I. Fix it and we'll talk.'",
      "Okafor exhales. 'I argued for you. I lost. Go and earn it so I win next time.'"],
  },
  tren: {
    open: [
      "T'Ren folds her hands. 'This board considers your fitness for {rank}. Logic suggests you are ready. Logic is not the only member of this board.'",
      "'Commander Okafor's report is thorough. It is also, for her, unusually warm.'",
      "'{friend} speaks well of you. The crew's regard is data. I weigh it accordingly.'",
      "'Your service record at level {lvl} is adequate. Adequate is not the standard for {rank}.'",
      "T'Ren studies you for a long moment. 'Tell me about the last fault you could not fix. Briefly.'",
    ],
    pass: ["'The board finds you fit for {rank}. Congratulations are customary. Consider them offered.'",
      "T'Ren inclines her head. 'Approved. The ship is better for it, {rank}.'"],
    defer: ["'The board defers its decision. This is not a rebuke. It is a request for more data.'",
      "'Deferred. Return when the record speaks for itself. It nearly does.'"],
    fail: ["'The board does not recommend promotion at this time. You will have other opportunities. Use them.'",
      "'Not yet, {addr}. Performance under pressure is the deciding factor. Yours has slipped.'"],
  },
};
const pick = a => a[Math.floor(Math.random() * a.length)];
const fill = (s, ctx) => s.replace(/\{(\w+)\}/g, (m, k) => ctx[k] ?? m);

// ---------------- boards ----------------
export const chairOf = rankId => PROG.boards.chairs[rankId] || "tren";
export const boardOdds = (r = computeReadiness()) => {
  const O = PROG.boards.odds, pass = clamp(O.pass100 - (100 - r) * O.perPoint, O.passMin, O.pass100);
  return { pass, defer: (1 - pass) * O.deferShare, fail: (1 - pass) * (1 - O.deferShare) };
};
const guaranteed = (n, reason) => reason === "guaranteed" || (n.guaranteeDay && P().playDays >= n.guaranteeDay);
export const boardCdLeft = () => Math.max(0, (P().boardCd || 0) - P().day);
// gate: no board while the cooldown runs -- except the Lt guarantee
hooks.promotionGate.push((n, reason) => guaranteed(n, reason) || !((P().boardCd || 0) > P().day));
hooks.promotionDue.push((n, reason) => { scheduleBoard(n, reason); return true; });
export function scheduleBoard(n, reason) {
  const p = P(), ch = chairOf(n.id), friend = crewList().filter(c => c.id !== ch).sort((a, b) => opinionOf(b.id) - opinionOf(a.id))[0];
  const ctx = { addr: addr(), rank: n.name, friend: friend ? friend.short : "Diallo", lvl: p.level };
  const L = BOARD_LINES[ch] || BOARD_LINES.tren, opener = [...L.open].sort(() => Math.random() - 0.5).slice(0, 2).map(s => fill(s, ctx));
  p.board = { to: n.id, reason, chair: ch, day: p.day, playDays: p.playDays, queued: false, lines: opener, ctx };
  const C = CHAIR[ch];
  log(`${C.name} convenes a promotion board: ${n.name}.${p.board.queued ? " It will sit when you're back aboard." : ""}`, "comm");
  toast(`Promotion board — ${n.short}`, "info"); fx("board", { to: n.id });
}
// the summary the modal shows (and the sim logs)
export function boardSummary() {
  const p = P(), b = p.board, n = b && PROG.ranks.find(r => r.id === b.to), r = computeReadiness(), rp = p.readyParts, RD = PROG.readiness;
  if (!b || !n) return null;
  const top = crewList().filter(c => c.id !== b.chair).sort((a, b2) => opinionOf(b2.id) - opinionOf(a.id)).slice(0, 3);
  return {
    chair: CHAIR[b.chair], to: n, reason: b.reason, queued: b.queued, readiness: r, odds: boardOdds(r), forced: !!guaranteed(n, b.reason),
    rows: [
      ["Performance", `${rp.perf}/${Math.round(RD.perf * 100)}`, `repair quality ${Math.round(p.perf.q * 100)}% · response ${Math.round(p.perf.resp * 100)}%`],
      ["Social", `${rp.social}/${Math.round(RD.social * 100)}`, top.map(c => `${c.short} ${Math.round(opinionOf(c.id)) > 0 ? "+" : ""}${Math.round(opinionOf(c.id))}`).join(" · ")],
      ["Reputation", `${rp.rep}/${Math.round(RD.rep * 100)}`, `${Math.round(p.repLifetime - p.rankSince.rep)} earned at this rank`],
      ["Level", `${p.level}`, `${G.stats.repairs || 0} repairs logged · ${p.quality.excellent || 0} excellent`],
    ],
    lines: b.lines,
  };
}
// the player faces the board (modal button; the sim calls it when the player is present). Never offline.
export function resolveBoard(force = null) {
  const p = P(), b = p.board; if (!b) return null;
  const n = nextRank(); if (!n || n.id !== b.to) { p.board = null; p.promo.pending = false; return null; }
  const r = computeReadiness(), o = boardOdds(r), forcedPass = !!guaranteed(n, b.reason);
  let outcome = force;
  if (!outcome) { const x = Math.random(); outcome = forcedPass || x < o.pass ? "pass" : x < o.pass + o.defer ? "defer" : "fail"; }
  const ctx = { ...b.ctx, addr: addr(), rank: n.short }, L = BOARD_LINES[b.chair] || BOARD_LINES.tren, C = CHAIR[b.chair];
  const line = fill(pick(L[outcome]), outcome === "pass" ? { ...ctx, rank: n.addr } : ctx);
  const K = PROG.boards, rec = { to: n.id, day: p.day, playDays: p.playDays, reason: b.reason, queued: b.queued, readiness: r, pPass: +o.pass.toFixed(2), outcome, forced: forcedPass };
  p.boardLog.push(rec); if (p.boardLog.length > 60) p.boardLog.shift();
  p.board = null; p.promo.pending = false;
  let effect;
  if (outcome === "pass") {
    p.boardMalus = 0; p.boardCd = 0;
    log(`Promotion board (${C.name}): recommended for ${n.name}. ${line}`, "good");
    promote(b.reason);   // existing flow: T'Ren at the chair, toast, quarters move, rank unlocks
    effect = `Promoted to ${n.name}. New quarters and rank items are waiting.`;
  } else if (outcome === "defer") {
    p.boardCd = p.day + K.deferCd;
    log(`Promotion board (${C.name}): decision deferred. ${line} (next board from ship's day ${p.boardCd})`, "comm");
    toast(`Board deferred — again from day ${p.boardCd}`, "info");
    effect = `Readiness stays where it is. The board can sit again from ship's day ${p.boardCd}.`;
  } else {
    const floor = Math.round(PROG.readiness.failedBoardFloor * 100);
    p.boardMalus = Math.max(0, r - floor); p.boardCd = p.day + K.failCd; computeReadiness();
    log(`Promotion board (${C.name}): not recommended. ${line} (readiness ${r}%${p.boardMalus ? ` → ${p.readiness}%` : ""}; next board from ship's day ${p.boardCd})`, "bad");
    toast(`Board: not this time — readiness ${p.readiness}%`, "bad");
    effect = `${p.boardMalus ? `Readiness drops to ${p.readiness}% and recovers ${K.failMalusDecay} points a ship's day.` : `Readiness stays at ${p.readiness}% (already below the ${floor}% floor).`} Next board from ship's day ${p.boardCd}.`;
  }
  return { ...rec, line, effect, chair: C, rank: n };
}
// failed-board penalty fades daily
hooks.newDay.push(() => { const p = P(); if (p.boardMalus > 0) { p.boardMalus = Math.max(0, p.boardMalus - PROG.boards.failMalusDecay); computeReadiness(); } });
export const boardWaiting = () => !!(P().board && !(PROG.boards.waitInBattle && G.sp.battle));

// ---------------- specialisations ----------------
const SK = () => PROG.specs;
export const specOwed = () => SK().picks.filter(l => P().level >= l).length;
export const specPending = () => Math.max(0, specOwed() - (P().specPicks || 0));
export function specOptions() {
  const sp = P().spec || {};
  return Object.entries(SK().focus).map(([id, f]) => {
    const tier = sp[id] || 0, next = tier + 1, t = SK().tiers[next - 1];
    return { id, f, tier, next, ok: next <= SK().maxTier && !!t, speed: t ? t.speed : 0, quality: t ? t.quality : 0, cur: tier ? SK().tiers[tier - 1] : null };
  });
}
export function pickSpec(id) {
  const p = P(), o = specOptions().find(x => x.id === id);
  if (!specPending() || !o || !o.ok) return false;
  p.spec[id] = o.next; p.specPicks = (p.specPicks || 0) + 1;
  const what = o.next > 1 ? `${o.f.name} upgraded to tier ${o.next}` : `${o.f.name} focus`;
  log(`Specialisation: ${what}. ${cheer("Okafor signs it off: 'About time you picked a lane.' ", "Okafor signs it off without a word. ")}(repairs on ${o.f.desc} +${Math.round(o.speed * 100)}% speed, Excellent +${Math.round(o.quality * 100)}%)`, "good");
  toast(`Specialisation — ${what}`, "good");
  return true;
}
export const specLabel = () => Object.entries(P().spec || {}).map(([id, t]) => { const f = SK().focus[id]; return f ? `${f.icon} ${f.name}${t > 1 ? ` ${"I".repeat(t)}` : ""}` : ""; }).filter(Boolean);
hooks.levelUp.push(L => { if (SK().picks.includes(L)) { toast("Specialisation available", "good"); fx("spec", { level: L }); } });
export { CHAIR, rankName };
