// Fixed-order simulation step. Pure state → state; rendering is elsewhere.
import { G } from "./state.js";
import { clamp } from "./util.js";
import { log, setQuiet, capture } from "./bus.js";
import { tickFaults, impairing, syncFaultEffects } from "./faults.js";
import { stepLt } from "./crew.js";
import { tickBattle } from "./battle.js";
import { tickEvents } from "./events.js";
import { tickVoyage } from "./voyage.js";

export function stepSim(dt) {
  const S = G.ship, SP = G.sp, L = G.lt;
  S.elapsed += dt;
  S.stardate += dt * 0.022;
  tickFaults(dt);
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
  S.gen = gen; S.load = load;
  S.power = clamp(S.power + (gen - load) * dt, 0, 100);
  if (S.power <= 0.5 && !S.powerWarned) { S.powerWarned = true; log("Power grid critical — output cannot meet load. Man the warp core console or shed load.", "fault"); }
  if (S.power > 12) S.powerWarned = false;
  if (impairing("shields")) S.shields = clamp(S.shields - (SP.battle ? 2 : 0.3) * dt, 0, 100);
  if (impairing("coolant")) {
    S.hull = Math.max(5, S.hull - (SP.battle ? 0.45 : 0.08) * dt);
    if (S.hull <= 5.2 && !S.hullFloorWarned) { S.hullFloorWarned = true; log("Emergency bulkheads holding, Captain. The Tenacity refuses to die.", "comm"); }
  } else if (S.power > 25 && S.hull < 100) S.hull = clamp(S.hull + 0.12 * dt, 0, 100);
  if (S.hull > 12) S.hullFloorWarned = false;
  if (S.energy < 15 && !S.energyWarned) { S.energyWarned = true; log("The Lieutenant is running on fumes — biobed, mess hall, or his bunk will put him right.", "fault"); }
  if (S.energy > 40) S.energyWarned = false;
  if (SP.battle) S.alertT = Math.max(S.alertT, 2); else S.alertT = Math.max(0, S.alertT - dt);
  tickBattle(dt);
  syncFaultEffects();
  tickEvents(dt);
  tickVoyage(dt);
}

// Idle-game catch-up: simulate time away in coarse steps and summarise it.
export function catchUp(seconds) {
  const S = G.ship, before = { hull: S.hull, parts: S.parts, torps: S.torps, rep: G.sp.rep, energy: S.energy, stats: { ...G.stats }, loc: G.sp.location };
  const sim = Math.min(seconds, 2 * 3600);
  const entries = [];
  setQuiet(true); capture.list = entries;
  const step = 0.25;
  for (let t = 0; t < sim; t += step) stepSim(step);
  setQuiet(false); capture.list = null;
  const st = G.stats;
  return {
    away: seconds, simulated: sim,
    legs: st.legs - before.stats.legs, battles: st.battles - before.stats.battles, wins: st.wins - before.stats.wins,
    events: st.events - before.stats.events, repairs: st.repairs - before.stats.repairs, torpsBuilt: st.torpsBuilt - before.stats.torpsBuilt, tows: st.tows - before.stats.tows,
    d: { hull: S.hull - before.hull, parts: S.parts - before.parts, torps: S.torps - before.torps, rep: G.sp.rep - before.rep, energy: S.energy - before.energy },
    faults: Object.keys(S.faults).length, highlights: [...new Map(entries.filter(e => e.cls === "good" || e.cls === "fault").map(e => [e.msg.slice(0, 40), e])).values()].slice(-8),
  };
}
