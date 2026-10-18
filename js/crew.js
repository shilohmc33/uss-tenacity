// The Lieutenant: movement, intents, station work, repair, rest, turbolift.
import { G } from "./state.js";
import { DECKS, NODEMAP, SYSTEMS, CHAIR_LINES, BAR_LINES, ENG_ROOM } from "./data.js";
import { walkStep, walkSettle, keepPace } from "./anim.js";
import { clamp, dDist, inRect } from "./util.js";
import { findPath, nearestWalkable, cellCenter } from "./path.js";
import { log, toast, fx, shipNews, cheerful, cheerLog } from "./bus.js";
import { faultPriority, shieldCap } from "./faults.js";
import { PACE, PACE_RT, nightActive } from "./pacing.js";
import { ltChatPartner } from "./npc-ambient.js";
import { drainMult } from "./cabin.js";
import { PROG, repairOutcome, awardXP, repairMult, taskMult, walkMult, tickStationXP, chatXP, milestone, addr } from "./progression.js";

// ---- manual vs automated (progression): an order is MANUAL when it is issued from inside a player input event
// (tap / click / key). main.js raises ORDER.manual in capture-phase input listeners and drops it at the start of
// every frame, so anything the sim decides on its own (auto-repair of a fault at his station, the loader fault at
// the torpedo bay, resuming after a repair) is AUTOMATED. The flag is stamped onto the intent and survives lifts.
export const ORDER = { manual: false };
export function playerOrder(fn) { const was = ORDER.manual; ORDER.manual = true; try { return fn(); } finally { ORDER.manual = was; } }

export const ZONE = 40;          // activation radius, design px (tap zones, task proximity, resume-at-station)
export const ARRIVE_R = 3;       // walk all the way to the stand spot (2x figure: early stops looked like clipping)
export const LIFT_T = 1.3;       // turbolift transit seconds
const lt = () => G.lt;
export const HEAD_Y = 0.235;     // floaters: just above the 2x Lt's head (FIG_H 134 / 640 = 0.21)
// put his feet exactly on a stand spot when he's within a cell of it (paths end on cell centres)
function settleAt(x, y) { const L = lt(); if (dDist(L.x, L.y, x, y) <= 24) { L.x = x; L.y = y; } }
// Lt notes: a one-off explanation shown on the Lt line while he's idle (cleared by his next command)
export function ltNote(html) { G.lt.note = html; }

export const playerInEngineering = () => G.lt.deck === "engineering" && inRect(G.lt.x, G.lt.y, ENG_ROOM);
function setFacing(d) { G.lt.dir = d; }
function faceToward(tx, ty) {
  const L = lt(), dx = (tx - L.x) * 960, dy = (ty - L.y) * 640;   // compare in design px (was dy x1.5 in deck fractions)
  setFacing(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
}
export function sendTo(tx, ty, intent) {
  const L = lt();
  if (L.lift) return false;
  const c = cellCenter(...nearestWalkable(L.deck, tx, ty));
  const path = findPath(L.deck, L.x, L.y, c[0], c[1]);
  L.intent = intent || { kind: "walk" };
  L.intent.manual = ORDER.manual;
  if (L.intent.kind !== "liftPanel") fx("closeLift");   // NEW-05: a new order supersedes an open turbolift panel
  fx("recenter");                                       // BUG-18: a new order hands the camera back to the Lt
  L.repairSys = null; L.node = null; L.seatSide = null; L.note = null;
  if (!path || !path.length) { L.path = null; arrive(); return true; }
  const pace = L.mode === "walk" && keepPace(L);   // re-tap mid-walk keeps his speed
  L.path = path; L.pathI = 0; L.mode = "walk"; if (!pace) L.walkDist = 0;
  return true;
}
function intentTarget(it) {
  if (!it) return null;
  if (it.kind === "use") { const n = NODEMAP[it.node]; return [n.x, n.y]; }
  if (it.kind === "repair") return [SYSTEMS[it.sys].x, SYSTEMS[it.sys].y];
  if (it.kind === "liftPanel" || it.kind === "liftRide") return [DECKS[G.lt.deck].lift.x, DECKS[G.lt.deck].lift.y];
  return null;
}
// cross-deck aware: ride the lift first, then continue
export function sendUse(nodeId, opts = {}) {
  const L = lt(), n = NODEMAP[nodeId];
  if (n.deck !== L.deck) return rideLiftTo(n.deck, { kind: "use", node: nodeId });
  if (L.mode === "use" && L.node === nodeId && !opts.force) { retrigger(nodeId); return; }
  sendTo(n.x, n.y, { kind: "use", node: nodeId });
}
export function sendRepair(sysId) {
  const L = lt(), s = SYSTEMS[sysId];
  if (s.deck !== L.deck) return rideLiftTo(s.deck, { kind: "repair", sys: sysId });
  if (L.mode === "repair" && L.repairSys === sysId) { toast(`Already repairing the ${s.name}`); return; }
  sendTo(s.x, s.y, { kind: "repair", sys: sysId });
}
export function sendLiftPanel() { const lf = DECKS[lt().deck].lift; sendTo(lf.x, lf.y, { kind: "liftPanel" }); }
export function rideLiftTo(deckId, then) {
  const L = lt();
  if (deckId === L.deck) { if (then) dispatchIntent(then); return; }
  const lf = DECKS[L.deck].lift;
  if (then) then.manual = ORDER.manual;
  sendTo(lf.x, lf.y, { kind: "liftRide", dest: deckId, then: then || null });
}
function dispatchIntent(it) {
  const go = () => { if (it.kind === "use") sendUse(it.node, { force: true }); else if (it.kind === "repair") sendRepair(it.sys); };
  if (it.manual) playerOrder(go); else go();   // a player order keeps its MANUAL credit across the turbolift ride
}
function beginLift(dest, then) {
  const L = lt();
  if (L.lift) return;                                   // NEW-09: never start (and log) a second ride
  L.mode = "lift"; L.path = null; L.intent = null;
  fx("closeLift");
  L.lift = { t: 0, dest, then, swapped: false };
  log(`Turbolift — ${DECKS[dest].name}.`);
}
export function tickLift(dt) {
  const L = lt(), lf = L.lift;
  if (!lf) return;
  lf.t += dt;
  if (!lf.swapped && lf.t >= LIFT_T / 2) {
    lf.swapped = true;
    L.deck = lf.dest;
    const nl = DECKS[L.deck].lift;
    L.x = nl.x; L.y = nl.y; L.dir = "down";
    fx("deckChanged", L.deck);
  }
  if (lf.t >= LIFT_T) {
    const then = lf.then; L.lift = null; L.mode = "idle";
    if (then) dispatchIntent(then);
  }
}
export function retrigger(nodeId) {
  const n = NODEMAP[nodeId];
  fx("pulse", { x: n.x, y: n.y });
  if (nodeId === "chair") { if (cheerful()) log(CHAIR_LINES[G.lines.chair++ % CHAIR_LINES.length], "comm"); }
  else if (nodeId === "bar") { if (cheerful()) log(BAR_LINES[G.lines.bar++ % BAR_LINES.length], "comm"); }
  else if (nodeId === "msd") msdReport();
  const S = G.ship;
  const what = nodeId === "torpbay" ? (S.torps >= S.torpCap ? "complement full" : `torpedo ${Math.round(S.charge)}% built`)
    : nodeId === "shield" ? `shields ${Math.round(S.shields)}%` : nodeId === "core" ? `power ${Math.round(S.power)}%`
    : n.rest ? `energy ${Math.round(S.energy)}%` : "on station";
  toast(`Already at the ${n.name} — ${what}`);
}
function msdReport() {
  const S = G.ship, f = Object.keys(S.faults);
  log(`Master Systems Display — Hull ${Math.round(S.hull)}% · Shields ${Math.round(S.shields)}% · Power ${Math.round(S.power)} · Parts ${S.parts} · Torpedoes ${S.torps} · Faults: ${f.length ? f.map(k => SYSTEMS[k].name).join(", ") : "none"} · Reputation ${G.sp.rep}.`, "comm");
}
const USE_STATUS = {
  core: "Manning the <b>Warp Core Console</b> — power output rising.",
  shield: "At the <b>Shield Console</b> — recharging emitters.",
  torpbay: "In the <b>Torpedo Bay</b> — replicating torpedoes.",
  biobed: "On the <b>Biobed</b> — the doctor's scanner does its work. Energy recovering.",
  mess: "Eating at the <b>Mess Table</b> — standing at a high-top, trading mess-hall talk. Energy recovering.",
  bunk: "Off his feet in <b>Berthing</b> — rack time in his own bunk.",
  rack: "Asleep in <b>his own quarters</b> — the best rest aboard.",
  locker: "At the <b>Parts Locker</b> — fabricating spares from stock.",
  pads: "Standing by the <b>Transporter Pads</b> — pattern buffers warm.",
  msd: "At the <b>Master Systems Display</b> — sensor support for Diallo.",
  chair: "At the <b>Captain's Chair</b> — reporting to T'Ren in person.",
  bar: "At the <b>Bar Counter</b> — off duty for exactly one drink.",
};
// ---- the Lt status line: always derived from what he is doing right now (ship news lives elsewhere) ----
export function ltStatus() {
  const L = lt(), S = G.ship, dk = DECKS[L.deck] ? DECKS[L.deck].name : "the deck";
  if (L.lift) return `In the turbolift — bound for <b>${DECKS[L.lift.dest].name}</b>.`;
  if (L.mode === "walk") {
    const it = L.intent || {};
    if (it.kind === "use") return `Heading to the <b>${NODEMAP[it.node].name}</b>…`;
    if (it.kind === "repair") return `Heading to repair the <b>${SYSTEMS[it.sys].name}</b>…`;
    if (it.kind === "liftRide") return `Walking to the turbolift — bound for <b>${DECKS[it.dest].name}</b>.`;
    if (it.kind === "liftPanel") return "Walking to the turbolift.";
    return `Walking the <b>${dk}</b> deck.`;
  }
  if (L.mode === "repair" && L.repairSys) {
    const sy = SYSTEMS[L.repairSys];
    return `Repairing the <b>${sy.name}</b> — ${Math.min(99, Math.round(L.repairT / sy.dur * 100))}%.`;
  }
  if (L.mode === "use" && L.node && NODEMAP[L.node]) {
    const n = NODEMAP[L.node], base = USE_STATUS[L.node] || `At the <b>${n.name}</b>.`;
    let extra = "";
    if (L.node === "torpbay") extra = S.faults.phasers ? " Launcher fault — replication paused." : S.torps >= S.torpCap ? ` Complement full (${S.torps}/${S.torpCap}).` : ` Torpedo ${Math.round(S.charge)}% built (${S.torps}/${S.torpCap}).`;
    else if (L.node === "core") extra = ` Power ${Math.round(S.power)}%.`;
    else if (L.node === "shield") extra = ` Shields ${Math.round(S.shields)}%.`;
    else if (L.node === "locker") extra = ` Parts ${S.parts}/${S.partsCap}.`;
    else if (n.rest) extra = ` (${Math.round(S.energy)}%)`;
    // ambient crew chatting with him (mess / bar): the chat leads the line so it survives the playbar's ellipsis
    const pal = ltChatPartner();
    if (pal) return `Chatting with <b>${pal.cfg.rank ? pal.cfg.rank + " " : ""}${pal.cfg.name}</b> at the <b>${n.name}</b>.${extra}`;
    return base + extra;
  }
  return L.note || `Standing by on <b>${dk}</b>. Tap a console, room, or open floor.`;
}
function arrive() {
  const L = lt(), it = L.intent;
  L.intent = null; L.path = null;
  if (!it || it.kind === "walk") { L.mode = "idle"; ltNote("Holding position. Tap a console, room, or open floor."); return; }
  if (it.kind === "liftPanel") { L.mode = "idle"; fx("openLift"); return; }
  if (it.kind === "liftRide") { beginLift(it.dest, it.then); return; }
  if (it.kind === "use") {
    const n = NODEMAP[it.node];
    if (n.system && G.ship.faults[n.system]) { beginRepair(n.system, it.manual); return; }
    L.mode = "use"; L.node = it.node; L.useManual = !!it.manual;
    settleAt(n.x, n.y);
    faceToward(n.mx, n.my);
    if (n.face) setFacing(n.face);
    if (it.node === "msd") msdReport();
    if (it.node === "chair") { if (cheerful()) log(CHAIR_LINES[G.lines.chair++ % CHAIR_LINES.length], "comm"); chatXP("tren"); }
    if (it.node === "bar") { if (cheerful()) log(BAR_LINES[G.lines.bar++ % BAR_LINES.length], "comm"); chatXP("bar"); }
    fx("pulse", { x: n.x, y: n.y });
    return;
  }
  if (it.kind === "repair") beginRepair(it.sys, it.manual);
}
export function beginRepair(sysId, manual = false) {
  const L = lt(), s = SYSTEMS[sysId], f = G.ship.faults[sysId];
  if (!f) { L.mode = "idle"; ltNote(`The <b>${s.name}</b> is already nominal. Awaiting orders.`); return; }
  if (G.ship.parts < f.cost) {
    L.mode = "idle";
    log(`Repair stalled — ${s.name} needs ${f.cost} spare part(s). Fabricate more at the parts locker.`, "fault");
    toast(`Need ${f.cost} part(s) — visit the Parts Locker`, "med");
    ltNote(`<b>${s.name}</b> repair needs ${f.cost} spare part(s) — send him to the <b>Parts Locker</b> first.`);
    return;
  }
  G.ship.parts -= f.cost;
  L.mode = "repair"; L.repairSys = sysId; L.repairT = 0; L.path = null; L.repairManual = !!manual; L.repairResp = f.t || 0;
  if (dDist(L.x, L.y, s.x, s.y) < 20) settleAt(s.x, s.y);
  faceToward(s.mx, s.my);
  log(`Repairing ${s.name} — ${f.cost} spare part(s) committed.`);
}
// walk speed (deck fraction of 960 px per s). Pass 08: 110 design px/s (was 149) so his ~45 px side step reads at ~2.4
// steps/s; tired = half. x level walk bonus: the walk frames advance by distance (anim.js stepLen), so the bonus raises
// the cadence with the speed and the feet stay planted.
export const LT_SPEED = 110 / 960, LT_SPEED_TIRED = 55 / 960;
export const engSpeed = () => (G.ship.energy < 15 ? LT_SPEED_TIRED : LT_SPEED) * walkMult();

export function stepLt(dt) {
  const L = lt(), S = G.ship, D = PACE.ltDrain, eTempo = (G.sp.battle ? PACE.ltDrainBattle : 1) * drainMult();   // phase 4: Refreshed (slept in his own quarters)
  tickLift(dt);
  if (L.mode === "walk" && L.path) {
    const zt = intentTarget(L.intent);
    if (zt && dDist(L.x, L.y, zt[0], zt[1]) <= ARRIVE_R) { arrive(); }
  }
  L.moving = false;
  if (L.mode === "walk" && L.path) {
    const done = walkStep(L, "lt", engSpeed() * 960, dt);
    if (L.moving) S.energy = clamp(S.energy - D.walk * eTempo * dt, 0, 100);
    if (done) arrive();
  } else if (L.mode === "repair") {
    const sys = SYSTEMS[L.repairSys];
    if (!sys || !S.faults[L.repairSys]) { L.mode = "idle"; L.repairSys = null; }
    else {
      L.repairT += dt * (S.energy < 10 ? 0.55 : 1) * repairMult(L.repairSys);
      S.energy = clamp(S.energy - D.repair * eTempo * dt, 0, 100);
      faceToward(sys.mx, sys.my);
      if (Math.random() < dt * 14) fx("spark", { x: L.x + (L.dir === "left" ? -0.03 : L.dir === "right" ? 0.03 : 0), y: L.y - 0.07 });
      if (L.repairT >= sys.dur) finishRepair();
    }
  } else if (L.mode === "use") {
    const nd = NODEMAP[L.node];
    if (!nd.lie) { if (nd.face) setFacing(nd.face); else faceToward(nd.mx, nd.my); }
    if (nd.rest) S.energy = clamp(S.energy + nd.rest * dt, 0, 100);
    else {
      S.energy = clamp(S.energy - D.station * eTempo * dt, 0, 100);
      tickStationXP(dt);   // station work: 1 XP / 10 s (40% when hands-off; none offline)
      if (L.node === "locker") {
        S.lockerT += dt;
        if (S.lockerT >= 2.5 / taskMult()) {
          S.lockerT = 0;
          const fillTo = nightActive() ? Math.ceil(S.partsCap * (PROG.sinks.lockerAwayFill ?? 1)) : S.partsCap;   // away: stock the night crew, don't flood the locker
          if (S.parts < fillTo) { S.parts++; fx("floater", { x: L.x, y: L.y - HEAD_Y, text: "+1 PART", color: "#e6b8ff" }); }
          else fx("floater", { x: L.x, y: L.y - HEAD_Y, text: fillTo < S.partsCap ? "STOCKED" : "LOCKER FULL", color: "#93a5c4" });
        }
      }
    }
  } else if (L.mode !== "lift") {
    S.energy = clamp(S.energy - D.idle * eTempo * dt, 0, 100);
  }
  L.swingAmp += clamp((L.moving ? 1 : 0) - L.swingAmp, -dt / 0.16, dt / 0.16);
  walkSettle(L, dt);
  tickRecharge(dt);
  tickReplication(dt);
}
function finishRepair() {
  const L = lt(), id = L.repairSys, sys = SYSTEMS[id];
  const pri = faultPriority(id), f = G.ship.faults[id], sev = f ? f.sev : "low";
  delete G.ship.faults[id];
  L.repairSys = null;
  G.stats.repairs++;
  // progression: quality roll (poor / good / excellent) -> XP, reputation, salvage; manual orders pay more
  const S = G.ship, manual = !!L.repairManual, q = repairOutcome(sev, manual, S.energy, id, L.repairResp || 0);
  const bonusPart = q.tier !== "marginal" && G.stats.repairs <= 5 ? 1 : 0;           // Okafor's welcome-aboard spare (first five)
  const parts = Math.min(q.parts + bonusPart, S.partsCap - S.parts), rep = q.rep;
  G.sp.rep += rep; S.parts += parts;
  const xp = awardXP(q.xp, q.src, "repair");
  L.repairManual = false;
  const TITLE = { marginal: ["MARGINAL — WILL RECUR", "#c9a27a"], standard: ["REPAIRED · STANDARD", "#bfe8c8"], good: ["REPAIRED · GOOD", "#9fe8b1"], excellent: ["EXCELLENT REPAIR!", "#ffe27a"] }[q.tier];
  const H = L.y - HEAD_Y;
  fx("floater", { x: L.x, y: H, text: TITLE[0], color: TITLE[1], life: q.tier === "excellent" ? 2.6 : 2, big: q.tier === "excellent" });
  fx("floater", { x: L.x, y: H, text: `+${xp} XP${manual ? "" : " (auto)"}`, color: "#8fd8ff", delay: 0.55, life: 2.2 });
  if (rep > 0) fx("floater", { x: L.x, y: H, text: `+${rep} REP`, color: "#ffaa77", delay: 1.1, life: 2.2 });
  if (parts > 0) fx("floater", { x: L.x, y: H, text: `+${parts} PART${parts > 1 ? "S" : ""}`, color: "#e6b8ff", delay: 1.65, life: 2.2 });
  if (q.rations > 0) fx("floater", { x: L.x, y: H, text: `+${q.rations} ${PROG.currency.short}`, color: "#9ff0c8", delay: parts > 0 ? 2.2 : 1.65, life: 2.2 });
  const tierWord = { excellent: "Excellent repair", good: "Good repair", standard: "Repairs complete", marginal: "Marginal repair" }[q.tier];
  log(`${tierWord} — ${sys.name} ${q.tier === "marginal" ? "patched" : "back to full function"}${manual ? "" : " (on his own initiative)"}. ${q.line}`, q.tier === "marginal" ? "comm" : "good");
  log(`+${xp} XP${rep > 0 ? ` · reputation +${rep}` : ""}${q.rations ? ` · +${q.rations} ${PROG.currency.unit}` : ""}${parts ? ` · ${parts} spare part${parts > 1 ? "s" : ""} salvaged from the old components` : ""}.`, "good");
  // the SHIP line shouldn't keep announcing a fault he just fixed
  if (G.news && G.news.html && G.news.html.includes(sys.fault)) shipNews(`<b>${sys.name} repaired</b> by the Lieutenant (${q.tier}) — +${xp} XP${rep > 0 ? `, reputation +${rep}` : ""}${parts ? `, +${parts} spare part${parts > 1 ? "s" : ""}` : ""}.`);
  milestone("firstRepair", "First repair");
  if (q.reopen) {   // marginal (auto repairs only, never in week 1): the fault comes back as LOW
    G.ship.faults[id] = { t: 0, sev: "low", cost: 1, escT: 0, reopened: true };
    log(`The ${sys.name} slips back to amber — the marginal patch didn't hold. LOW fault reopened.`, "fault");
  }
  if (pri === 1) log(`T'Ren: 'Noted, ${addr()}. The bridge has its ship back.'`, "comm");
  else if (pri === 2) cheerLog(`Okafor: 'Good work, ${addr()}. That's how my deck runs.'`, "comm");   // pass 08 (5): not in the quiet period
  const n = sys.node ? NODEMAP[sys.node] : null;
  if (n && n.deck === L.deck && dDist(L.x, L.y, n.x, n.y) <= ZONE) {
    L.mode = "use"; L.node = sys.node; faceToward(n.mx, n.my);
  } else if (id === "loader" && L.resumeTorp) {
    L.resumeTorp = false; L.mode = "idle"; sendUse("torpbay", { force: true });
  } else { L.mode = "idle"; ltNote(`<b>${sys.name}</b> repaired. Awaiting orders.`); }
}
// Miracle Worker can finish a repair under him
export function cancelRepairIf(id) { const L = lt(); if (L.mode === "repair" && L.repairSys === id) { L.mode = "idle"; L.repairSys = null; } }

const RECHARGE = {
  shield: { stat: "shields", start: "Lieutenant is recharging the shield grid.", full: "Shield grid at full charge.", already: "Shields already at full charge.", interrupted: "Shield recharge interrupted — battle stations." },
  core: { stat: "power", start: "Lieutenant is topping up main power.", full: "Main power at full.", already: "Power already at full.", interrupted: "Power recharge interrupted — battle stations." },
};
function tickRecharge(dt) {
  const L = lt(), rc = G.rc, S = G.ship;
  const at = L.mode === "use" && (L.node === "shield" || L.node === "core") ? L.node : null;
  if (at !== rc.node) { rc.node = at; rc.acc = 0; rc.phase = "idle"; rc.intNoted = false; }
  if (!at) return;
  const def = RECHARGE[at], cap = at === "shield" ? shieldCap() : 100;
  if (G.sp.battle) { if (rc.phase === "charging" && !rc.intNoted) { log(def.interrupted, "fault"); rc.intNoted = true; } return; }
  rc.intNoted = false;
  if (S[def.stat] >= cap) {
    if (rc.phase === "charging") { log(def.full, "good"); rc.phase = "full"; } else if (rc.phase === "idle") { log(def.already); rc.phase = "full"; }
    rc.acc = 0; return;
  }
  if (rc.phase !== "charging") { log(def.start); rc.phase = "charging"; }
  rc.acc += dt;
  const per = 1.6 / taskMult();
  while (rc.acc >= per) {
    rc.acc -= per;
    S[def.stat] = Math.min(cap, S[def.stat] + 1);
    if (S[def.stat] >= cap) { log(def.full, "good"); rc.phase = "full"; rc.acc = 0; break; }
  }
}
export const TORP_BUILD_T = 60;
function tickReplication(dt) {
  const L = lt(), S = G.ship, rp = G.rp;
  const atBay = L.mode === "use" && L.node === "torpbay";
  if (!atBay) { rp.stay = false; rp.fullNoted = false; return; }
  if (!rp.stay) { rp.stay = true; rp.fullNoted = false; if (S.charge > 0 && S.torps < S.torpCap) log(`Torpedo replication resumes at ${Math.round(S.charge)}%.`); }
  if (S.faults.loader) { L.resumeTorp = true; beginRepair("loader"); return; }
  if (S.faults.phasers) return;
  if (S.torps >= S.torpCap) { if (!rp.fullNoted) { log("Torpedo complement already full."); rp.fullNoted = true; } return; }
  S.charge = clamp(S.charge + dt * (100 / TORP_BUILD_T) * taskMult(), 0, 100);
  if (S.charge >= 100) {
    S.charge = 0; S.torps++; S.tubeFlash = S.elapsed; G.stats.torpsBuilt++;
    log(`Torpedo replicated and loaded. (${S.torps} of ${S.torpCap})`, "good");
    fx("floater", { x: L.x, y: L.y - HEAD_Y, text: "+1 TORPEDO", color: "#ffb36b" });
    if (S.torps >= S.torpCap) rp.fullNoted = true;
  }
}
