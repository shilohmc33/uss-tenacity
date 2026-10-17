// Fixed-order simulation step. Pure state → state; rendering is elsewhere.
import { G } from "./state.js";
import { clamp } from "./util.js";
import { log, setQuiet, capture } from "./bus.js";
import { tickFaults, impairing, syncFaultEffects, tickNightCrew, nightHandover } from "./faults.js";
import { stepLt } from "./crew.js";
import { tickBattle } from "./battle.js";
import { tickEvents } from "./events.js";
import { tickVoyage } from "./voyage.js";
import { PACE, PACE_RT, nightActive } from "./pacing.js";

export function stepSim(dt) {
  const S = G.ship, SP = G.sp, L = G.lt;
  S.elapsed += dt;
  S.stardate += dt * 0.022;
  PACE_RT.idleT += dt;
  if (!PACE_RT.offline) PACE_RT.sessionT += dt;
  tickFaults(dt);
  tickNightCrew(dt);
  stepLt(dt);
  // power grid
  const wf = S.faults.warpcore;
  let gen = wf ? (wf.sev === "low" ? 4.2 : 2.2) : 4.6;
  if (L.mode === "use" && L.node === "core") gen += 4.4;
  let load = 2.3;
  if (S.shields < 100 && !S.faults.shields) load += 1.1;
  if (L.mode === "use" && L.node === "torpbay") load += 2.2;
  if (impairing("eps")) load += SP.battle ? 3.0 : 1.2; else if (S.faults.eps) load += 0.5;
  if (impairing("transporter")) load += SP.battle ? 1.5 : 0.6;
  for (const f of Object.values(S.faults)) if (f.sev === "crit") load += SP.battle ? 2.0 : 1.2;
  // emergency reserve: out of battle, a starved grid sheds non-essential load and trickles back up
  if (!SP.battle && S.power < 10) gen += PACE.livePowerTrickle;
  S.gen = gen; S.load = load;
  S.power = clamp(S.power + (gen - load) * dt, 0, 100);
  // night crew holds a power floor while the player is away
  if (nightActive()) S.power = Math.max(S.power, SP.battle ? PACE.powerFloorBattle : PACE.powerFloor);
  if (S.power <= 0.5 && !S.powerWarned) { S.powerWarned = true; log("Power grid critical — output cannot meet load. Man the warp core console or shed load.", "fault"); }
  if (S.power > 12) S.powerWarned = false;
  if (impairing("shields")) S.shields = clamp(S.shields - (SP.battle ? 2 : 0.3) * dt, 0, 100);
  if (impairing("coolant")) {
    S.hull = Math.max(5, S.hull - (SP.battle ? 0.45 : PACE.coolantHullDrain) * dt);
    if (S.hull <= 5.2 && !S.hullFloorWarned) { S.hullFloorWarned = true; log("Emergency bulkheads holding, Captain. The Tenacity refuses to die.", "comm"); }
  } else if (S.power >= 25 && S.hull < 100) S.hull = clamp(S.hull + 0.12 * dt, 0, 100);
  if (S.hull > 12) S.hullFloorWarned = false;
  // off watch: while the game is closed the Lt sleeps/rests instead of standing at a console for hours
  if (PACE_RT.offline && !(L.mode === "use" && NODE_REST(L))) S.energy += (PACE.offlineEnergyTarget - S.energy) * Math.min(1, dt / 600);
  if (S.energy < 15 && !S.energyWarned) { S.energyWarned = true; log("The Lieutenant is running on fumes — biobed, mess hall, or his bunk will put him right.", "fault"); }
  if (S.energy > 40) S.energyWarned = false;
  if (SP.battle) S.alertT = Math.max(S.alertT, 2); else S.alertT = Math.max(0, S.alertT - dt);
  tickBattle(dt);
  syncFaultEffects();
  tickEvents(dt);
  tickVoyage(dt);
  applyNightFloors();
}
// NEW-06: the night crew's floors are hard floors. Re-applied after the whole step, so drains that land after the
// power-grid update (events, phaser fire, tows, voyage) can't leave power below the floor; offline, damage control
// also keeps the hull above PACE.offlineHullFloor.
function applyNightFloors() {
  const S = G.ship;
  if (nightActive()) S.power = Math.max(S.power, G.sp.battle ? PACE.powerFloorBattle : PACE.powerFloor);
  if (PACE_RT.offline) S.hull = Math.max(S.hull, PACE.offlineHullFloor);
}
const NODE_REST = L => L.node === "bunk" || L.node === "biobed" || L.node === "mess" || L.node === "bar";

// Idle-game catch-up: simulate time away (up to PACE.offlineMaxSim) with the night crew on, and summarise it.
export function catchUp(seconds) {
  const S = G.ship, before = { hull: S.hull, parts: S.parts, torps: S.torps, rep: G.sp.rep, energy: S.energy, stats: { ...G.stats }, loc: G.sp.location, fixes: G.night.fixes || 0, avoided: G.night.avoided || 0 };
  const sim = Math.min(seconds, PACE.offlineMaxSim);
  const entries = [];
  setQuiet(true); capture.list = entries; PACE_RT.offline = true;
  applyNightFloors();   // clamp straight after load: a save taken at 7% power comes back at the floor
  const step = 0.25; let minPower = S.power, minHull = S.hull, powerZeroS = 0, battleWasOn = !!G.sp.battle;
  try {
    for (let t = 0; t < sim; t += step) {
      stepSim(step);
      if (S.power < minPower) minPower = S.power;
      if (S.hull < minHull) minHull = S.hull;
      if (S.power < 1) powerZeroS += step;
    }
    nightHandover();   // the night crew hands over at most PACE.nightFaultCap open faults
  } finally { setQuiet(false); capture.list = null; PACE_RT.offline = false; PACE_RT.idleT = 0; }
  const st = G.stats;
  // highlights: keep the latest copy of each repeated line, listed in chronological order
  const seen = new Map();
  // non-actionable noise stays out of the report (NEW-06): routine resupply pallets, task countdowns, handover chores
  const ROUTINE = /^(Torpedo replicated|Spare part fabricated|Deep Space Nine ordnance crews begin|Quartermaster's pallet|Spacedock quartermaster|Deck task|Shift handover|Night watch: the damage-control team clears|Reputation \+)/;
  entries.forEach((e, i) => {
    if ((e.cls === "good" || e.cls === "fault") && !ROUTINE.test(e.msg)) seen.set(e.msg.replace(/[\d.%]+/g, "#").slice(0, 40), i);
  });
  const highlights = [...seen.values()].sort((a, b) => a - b).slice(-8).map(i => entries[i]);
  return {
    away: seconds, simulated: sim, battleWasOn,
    legs: st.legs - before.stats.legs, battles: st.battles - before.stats.battles, wins: st.wins - before.stats.wins,
    events: st.events - before.stats.events, repairs: st.repairs - before.stats.repairs, torpsBuilt: st.torpsBuilt - before.stats.torpsBuilt, tows: st.tows - before.stats.tows,
    crewFixes: (G.night.fixes || 0) - before.fixes, avoided: (G.night.avoided || 0) - before.avoided,
    d: { hull: S.hull - before.hull, parts: S.parts - before.parts, torps: S.torps - before.torps, rep: G.sp.rep - before.rep, energy: S.energy - before.energy },
    faults: Object.keys(S.faults).length, minPower, minHull, powerZeroS, highlights,
  };
}
