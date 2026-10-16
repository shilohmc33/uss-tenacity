// The Lieutenant: movement, intents, station work, repair, rest, turbolift.
import { G } from "./state.js";
import { DECKS, NODEMAP, SYSTEMS, STEP_LEN, CHAIR_LINES, BAR_LINES, ENG_ROOM } from "./data.js";
import { clamp, dDist, inRect } from "./util.js";
import { findPath, nearestWalkable, cellCenter } from "./path.js";
import { log, setStatus, toast, fx } from "./bus.js";
import { faultPriority, shieldCap } from "./faults.js";

export const ZONE = 34;          // activation radius, design px (~68px tap zone)
export const LIFT_T = 1.3;       // turbolift transit seconds
const lt = () => G.lt;

export const playerInEngineering = () => G.lt.deck === "engineering" && inRect(G.lt.x, G.lt.y, ENG_ROOM);
function setFacing(d) { G.lt.dir = d; }
function faceToward(tx, ty) {
  const L = lt(), dx = tx - L.x, dy = (ty - L.y) * 1.5;
  setFacing(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
}
export function sendTo(tx, ty, intent) {
  const L = lt();
  if (L.lift) return false;
  const c = cellCenter(...nearestWalkable(L.deck, tx, ty));
  const path = findPath(L.deck, L.x, L.y, c[0], c[1]);
  L.intent = intent || { kind: "walk" };
  L.repairSys = null; L.node = null; L.seatSide = null;
  if (!path || !path.length) { L.path = null; arrive(); return true; }
  L.path = path; L.pathI = 0; L.mode = "walk"; L.walkDist = 0;
  return true;
}
function intentTarget(it) {
  if (!it) return null;
  if (it.kind === "use") { const n = NODEMAP[it.node]; return it.seat === "north" ? [n.seatN.x, n.seatN.y] : [n.x, n.y]; }
  if (it.kind === "repair") return [SYSTEMS[it.sys].x, SYSTEMS[it.sys].y];
  if (it.kind === "liftPanel" || it.kind === "liftRide") return [DECKS[G.lt.deck].lift.x, DECKS[G.lt.deck].lift.y];
  return null;
}
// cross-deck aware: ride the lift first, then continue
export function sendUse(nodeId, opts = {}) {
  const L = lt(), n = NODEMAP[nodeId];
  if (n.deck !== L.deck) return rideLiftTo(n.deck, { kind: "use", node: nodeId });
  if (L.mode === "use" && L.node === nodeId && !opts.force) { retrigger(nodeId); return; }
  if (nodeId === "mess") {
    const north = L.y <= n.my, seat = north ? n.seatN : n;
    return sendTo(seat.x, seat.y, { kind: "use", node: nodeId, seat: north ? "north" : "south" });
  }
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
  sendTo(lf.x, lf.y, { kind: "liftRide", dest: deckId, then: then || null });
}
function dispatchIntent(it) {
  if (it.kind === "use") sendUse(it.node, { force: true });
  else if (it.kind === "repair") sendRepair(it.sys);
}
function beginLift(dest, then) {
  const L = lt();
  L.mode = "lift"; L.path = null; L.intent = null;
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
    setStatus(`Arrived on <b>${DECKS[L.deck].name}</b>.`);
    if (then) dispatchIntent(then);
  }
}
export function retrigger(nodeId) {
  const n = NODEMAP[nodeId];
  fx("pulse", { x: n.x, y: n.y });
  if (nodeId === "chair") log(CHAIR_LINES[G.lines.chair++ % CHAIR_LINES.length], "comm");
  else if (nodeId === "bar") log(BAR_LINES[G.lines.bar++ % BAR_LINES.length], "comm");
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
  mess: "Seated at a <b>Mess Table</b> — mug in hand, trading mess-hall talk. Energy recovering.",
  bunk: "Off his feet in <b>Berthing</b> — rack time in his own bunk.",
  locker: "At the <b>Parts Locker</b> — fabricating spares from stock.",
  pads: "Standing by the <b>Transporter Pads</b> — pattern buffers warm.",
  msd: "At the <b>Master Systems Display</b> — sensor support for Diallo.",
  chair: "At the <b>Captain's Chair</b> — reporting to T'Ren in person.",
  bar: "At the <b>Bar Counter</b> — off duty for exactly one drink.",
};
function arrive() {
  const L = lt(), it = L.intent;
  L.intent = null; L.path = null;
  if (!it || it.kind === "walk") { L.mode = "idle"; setStatus("Holding position. Tap a console, room, or open floor."); return; }
  if (it.kind === "liftPanel") { L.mode = "idle"; fx("openLift"); return; }
  if (it.kind === "liftRide") { beginLift(it.dest, it.then); return; }
  if (it.kind === "use") {
    const n = NODEMAP[it.node];
    if (n.system && G.ship.faults[n.system]) { beginRepair(n.system); return; }
    L.mode = "use"; L.node = it.node;
    faceToward(n.mx, n.my);
    if (it.node === "mess") { L.seatSide = it.seat || "south"; setFacing(L.seatSide === "north" ? "down" : "up"); }
    setStatus(USE_STATUS[it.node] || `At the <b>${n.name}</b>.`);
    if (it.node === "msd") msdReport();
    if (it.node === "chair") log(CHAIR_LINES[G.lines.chair++ % CHAIR_LINES.length], "comm");
    if (it.node === "bar") log(BAR_LINES[G.lines.bar++ % BAR_LINES.length], "comm");
    fx("pulse", { x: n.x, y: n.y });
    return;
  }
  if (it.kind === "repair") beginRepair(it.sys);
}
export function beginRepair(sysId) {
  const L = lt(), s = SYSTEMS[sysId], f = G.ship.faults[sysId];
  if (!f) { L.mode = "idle"; setStatus(`${s.name} is already nominal.`); return; }
  if (G.ship.parts < f.cost) {
    L.mode = "idle";
    log(`Repair stalled — ${s.name} needs ${f.cost} spare part(s). Fabricate more at the parts locker.`, "fault");
    toast(`Need ${f.cost} part(s) — visit the Parts Locker`, "med");
    setStatus(`<b>${s.name}</b> repair needs ${f.cost} spare part(s) — send him to the <b>Parts Locker</b> first.`);
    return;
  }
  G.ship.parts -= f.cost;
  L.mode = "repair"; L.repairSys = sysId; L.repairT = 0; L.path = null;
  faceToward(s.mx, s.my);
  log(`Repairing ${s.name} — ${f.cost} spare part(s) committed.`);
  setStatus(`Repairing <b>${s.name}</b>…`);
}
export const engSpeed = () => (G.ship.energy < 15 ? 0.058 : 0.115);

export function stepLt(dt) {
  const L = lt(), S = G.ship, eTempo = G.sp.battle ? 1 : 0.35;
  tickLift(dt);
  if (L.mode === "walk" && L.path) {
    const zt = intentTarget(L.intent);
    if (zt && dDist(L.x, L.y, zt[0], zt[1]) <= ZONE) { arrive(); }
  }
  L.moving = false;
  if (L.mode === "walk" && L.path) {
    let remain = 0, rx = L.x, ry = L.y;
    for (let i = L.pathI; i < L.path.length; i++) { remain += dDist(L.path[i][0], L.path[i][1], rx, ry); rx = L.path[i][0]; ry = L.path[i][1]; }
    const sf = clamp(Math.min(remain, L.walkDist + 8) / 52, 0.22, 1);
    const px = L.x, py = L.y;
    let guard = 0;
    while (L.pathI < L.path.length && guard++ < 8) {
      const wp = L.path[L.pathI], dxp = (wp[0] - L.x) * 960, dyp = (wp[1] - L.y) * 640, dist = Math.hypot(dxp, dyp);
      const step = engSpeed() * sf * 960 * dt;
      if (dist <= Math.max(step, 2)) { L.x = wp[0]; L.y = wp[1]; L.pathI++; if (L.pathI >= L.path.length) { arrive(); break; } continue; }
      L.x += (dxp / dist) * step / 960; L.y += (dyp / dist) * step / 640;
      setFacing(Math.abs(dxp) > Math.abs(dyp) ? (dxp > 0 ? "right" : "left") : (dyp > 0 ? "down" : "up"));
      L.moving = true;
      S.energy = clamp(S.energy - 0.5 * eTempo * dt, 0, 100);
      break;
    }
    const moved = dDist(L.x, L.y, px, py);
    if (moved > 0) { L.walkPhase += moved / STEP_LEN * Math.PI; L.walkDist += moved; }
  } else if (L.mode === "repair") {
    const sys = SYSTEMS[L.repairSys];
    if (!sys || !S.faults[L.repairSys]) { L.mode = "idle"; L.repairSys = null; }
    else {
      L.repairT += dt * (S.energy < 10 ? 0.55 : 1);
      S.energy = clamp(S.energy - 1.4 * eTempo * dt, 0, 100);
      faceToward(sys.mx, sys.my);
      if (Math.random() < dt * 14) fx("spark", { x: L.x, y: L.y - 0.02 });
      if (L.repairT >= sys.dur) finishRepair();
    }
  } else if (L.mode === "use") {
    const nd = NODEMAP[L.node];
    if (!nd.lie && L.node !== "mess") faceToward(nd.mx, nd.my);
    if (nd.rest) S.energy = clamp(S.energy + nd.rest * dt, 0, 100);
    else {
      S.energy = clamp(S.energy - 0.7 * eTempo * dt, 0, 100);
      if (L.node === "locker") {
        S.lockerT += dt;
        if (S.lockerT >= 2.5) {
          S.lockerT = 0;
          if (S.parts < S.partsCap) { S.parts++; fx("floater", { x: L.x, y: L.y - 0.08, text: "+1 PART", color: "#e6b8ff" }); }
          else fx("floater", { x: L.x, y: L.y - 0.08, text: "LOCKER FULL", color: "#93a5c4" });
        }
      }
    }
  } else if (L.mode !== "lift") {
    S.energy = clamp(S.energy - 0.12 * eTempo * dt, 0, 100);
  }
  L.swingAmp += clamp((L.moving ? 1 : 0) - L.swingAmp, -dt / 0.16, dt / 0.16);
  tickRecharge(dt);
  tickReplication(dt);
}
function finishRepair() {
  const L = lt(), id = L.repairSys, sys = SYSTEMS[id];
  const pri = faultPriority(id);
  delete G.ship.faults[id];
  L.repairSys = null;
  G.stats.repairs++;
  log(`Repairs complete — ${sys.name} back to full function.`, "good");
  fx("floater", { x: L.x, y: L.y - 0.08, text: "REPAIRED", color: "#9fe8b1" });
  if (pri === 1) log("T'Ren: 'Noted, Lieutenant. The bridge has its ship back.'", "comm");
  else if (pri === 2) log("Okafor: 'Good work, Lieutenant. That's how my deck runs.'", "comm");
  const n = sys.node ? NODEMAP[sys.node] : null;
  if (n && n.deck === L.deck && dDist(L.x, L.y, n.x, n.y) <= ZONE) {
    L.mode = "use"; L.node = sys.node; faceToward(n.mx, n.my);
    setStatus(`${sys.name} repaired. Resuming at the <b>${n.name}</b>.`);
  } else if (id === "loader" && L.resumeTorp) {
    L.resumeTorp = false; L.mode = "idle"; sendUse("torpbay", { force: true });
  } else { L.mode = "idle"; setStatus(`${sys.name} repaired. Awaiting orders.`); }
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
  while (rc.acc >= 1.6) {
    rc.acc -= 1.6;
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
  S.charge = clamp(S.charge + dt * (100 / TORP_BUILD_T), 0, 100);
  if (S.charge >= 100) {
    S.charge = 0; S.torps++; S.tubeFlash = S.elapsed; G.stats.torpsBuilt++;
    log(`Torpedo replicated and loaded. (${S.torps} of ${S.torpCap})`, "good");
    fx("floater", { x: L.x, y: L.y - 0.08, text: "+1 TORPEDO", color: "#ffb36b" });
    if (S.torps >= S.torpCap) rp.fullNoted = true;
  }
}
