// Fixed-order simulation step. Pure state → state; rendering is elsewhere.
import { G } from "./state.js";
import { clamp } from "./util.js";
import { log, setQuiet, capture } from "./bus.js";
import { tickFaults, impairing, syncFaultEffects, tickNightCrew, nightHandover } from "./faults.js";
import { stepLt } from "./crew.js";
import { tickBattle } from "./battle.js";
import { tickEvents } from "./events.js";
import { tickJobs } from "./oddjobs.js";
import { tickVoyage } from "./voyage.js";
import { PACE, PACE_RT, nightActive, offRules } from "./pacing.js";
import { tickDay, offlineXP, tickProg, rankShort } from "./progression.js";
import { tickNeeds } from "./needs.js";
import { tickCrew, endOffline } from "./crewlife.js";
import { tickCabin } from "./cabin.js";
import { tickMed } from "./injuries.js";
import { romLogHidden } from "./romance.js";

export function stepSim(dt) {
  const S = G.ship, SP = G.sp, L = G.lt;
  S.elapsed += dt;
  S.stardate += dt * 0.022;
  tickDay(dt);   // ship's day
  tickCabin(dt); // phase 4: quarters tier sync, Refreshed buff, standing-order trade-in of a full locker while away
  tickMed(dt);   // phase 6: sickbay (injury warning windows, recoveries, memorial); offline rules inside
  tickCrew(dt);  // phase 3: replacement crew arriving (crewlife.js; the daily crew roll hangs off the ship's day)
  tickNeeds(dt); // crew needs N1 (needs.js): whole roster, offline too
  tickProg(dt);  // relationships (ignored faults, station help), readiness, promotion checks (progression.js PROG.dayLength); offline catch-up advances it too
  PACE_RT.idleT += dt;
  PACE_RT.liveFight = !!(SP.battle && SP.battle.live);   // pass 16 B1
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
  if (offRules()) S.power = Math.max(S.power, SP.battle ? PACE.powerFloorBattle : PACE.powerFloor);
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
  tickJobs(dt);   // pt04: odd jobs between repairs
  tickVoyage(dt);
  applyNightFloors();
}
// NEW-06: the night crew's floors are hard floors. Re-applied after the whole step, so drains that land after the
// power-grid update (events, phaser fire, tows, voyage) can't leave power below the floor; offline, damage control
// also keeps the hull above PACE.offlineHullFloor.
function applyNightFloors() {
  const S = G.ship;
  if (offRules()) S.power = Math.max(S.power, G.sp.battle ? PACE.powerFloorBattle : PACE.powerFloor);
  // pass-03 N-2: the same hull floor while the tab is open but idle (no input for PACE.idleAfter s); pass 16 B1: never in a live-started fight
  if (offRules()) S.hull = Math.max(S.hull, PACE.offlineHullFloor);
}
const NODE_REST = L => L.node === "bunk" || L.node === "biobed" || L.node === "mess" || L.node === "bar" || L.node === "rack";

// Idle-game catch-up: simulate time away (up to PACE.offlineMaxSim) with the night crew on, and summarise it.
export function catchUp(seconds) {
  const S = G.ship, before = { hull: S.hull, parts: S.parts, torps: S.torps, rep: G.sp.rep, energy: S.energy, stats: { ...G.stats }, loc: G.sp.location, fixes: G.night.fixes || 0, avoided: G.night.avoided || 0,
    lvl: G.prog.level, xp: G.prog.totalXp, xpM: G.prog.xpManual, xpA: G.prog.xpAuto, day: G.prog.day, rank: G.prog.rank, crewN: G.prog.crew.evN || 0, maint: G.prog.sinks.n.maintain || 0, trades: G.prog.sinks.n.autoTrade || 0, rr: G.prog.rationsLife };
  // pass 16 B1: a live-started fight is never resolved or advanced offline. While one is open the whole catch-up
  // waits (deferred into G.sp.awayDefer, run by main.js once the fight is over): running the rest of the night
  // "around" a frozen fight isn't safe - faults, power, hull, voyage legs and the night crew all touch the ship
  // the fight is using. The fight itself stayed frozen while hidden (app.paused) and resumes live.
  const deferred = !!(G.sp.battle && G.sp.battle.live);
  if (deferred) G.sp.awayDefer = Math.min(PACE.offlineMaxSim, (+G.sp.awayDefer || 0) + seconds);
  const sim = deferred ? 0 : Math.min(seconds, PACE.offlineMaxSim);
  const entries = [];
  setQuiet(true); capture.list = entries; PACE_RT.offline = !deferred;
  if (!deferred) applyNightFloors();   // clamp straight after load: a save taken at 7% power comes back at the floor
  const step = 0.25; let minPower = S.power, minHull = S.hull, powerZeroS = 0, battleWasOn = !!G.sp.battle;
  // pass 13: every battlecruiser fought during catch-up (outcome + hull after), for the return report's headline
  const bcFights = []; let bcCur = null; const isBc = () => { const B = G.sp.battle; return !!(B && B.enemies && B.enemies[0] && B.enemies[0].ship === "jh_battlecruiser" && B.ctx !== "debug"); };
  const bcEnd = () => { const st = G.stats; bcFights.push({ out: st.wins > bcCur.w ? "won" : st.tows > bcCur.t ? "towed" : "disengaged", hull: Math.round(S.hull), lost: Math.max(0, Math.round(bcCur.hull - S.hull)) }); bcCur = null; };
  try {
    for (let t = 0; t < sim; t += step) {
      if (!bcCur && isBc()) bcCur = { w: G.stats.wins, t: G.stats.tows, hull: S.hull };
      stepSim(step);
      if (!bcCur && isBc()) bcCur = { w: G.stats.wins, t: G.stats.tows, hull: S.hull };   // started this step (the hull before her first volley)
      else if (bcCur && !isBc()) bcEnd();
      if (S.power < minPower) minPower = S.power;
      if (S.hull < minHull) minHull = S.hull;
      if (S.power < 1) powerZeroS += step;
    }
    if (!deferred) nightHandover();   // the night crew hands over at most PACE.nightFaultCap open faults
    if (!deferred) endOffline(sim);   // phase 3: a Starbase 375 loaner team covers one offline stretch
    offlineXP(sim);    // progression: watch-officer XP for the night crew's work (1/min first 2 h, then 0.25/min)
  } finally { setQuiet(false); capture.list = null; PACE_RT.offline = false; PACE_RT.idleT = 0; }
  if (bcCur) bcFights.push({ out: "ongoing", hull: Math.round(S.hull), lost: Math.max(0, Math.round(bcCur.hull - S.hull)) });
  const st = G.stats;
  // highlights: keep the latest copy of each repeated line, listed in chronological order
  const seen = new Map();
  // non-actionable noise stays out of the report (NEW-06): routine resupply pallets, task countdowns, handover chores
  const ROUTINE = /^(Torpedo replicated|Spare part fabricated|Deep Space Nine ordnance crews begin|Quartermaster's pallet|Spacedock quartermaster|Deck task|Shift handover|Night watch: the damage-control team clears|Reputation \+|\+\d+ XP)/;
  entries.forEach((e, i) => {
    if ((e.cls === "good" || e.cls === "fault") && !ROUTINE.test(e.msg) && !romLogHidden(e)) seen.set(e.msg.replace(/[\d.%]+/g, "#").slice(0, 40), i);
  });
  const highlights = [...seen.values()].sort((a, b) => a - b).slice(-8).map(i => entries[i]);
  return {
    away: seconds, simulated: sim, battleWasOn, deferred,
    legs: st.legs - before.stats.legs, battles: st.battles - before.stats.battles, wins: st.wins - before.stats.wins,
    events: st.events - before.stats.events, repairs: st.repairs - before.stats.repairs, torpsBuilt: st.torpsBuilt - before.stats.torpsBuilt, tows: st.tows - before.stats.tows,
    crewFixes: (G.night.fixes || 0) - before.fixes, avoided: (G.night.avoided || 0) - before.avoided,
    d: { hull: S.hull - before.hull, parts: S.parts - before.parts, torps: S.torps - before.torps, rep: G.sp.rep - before.rep, energy: S.energy - before.energy },
    prog: { xp: G.prog.totalXp - before.xp, auto: G.prog.xpAuto - before.xpA, manual: G.prog.xpManual - before.xpM, from: before.lvl, to: G.prog.level, days: G.prog.day - before.day, promoted: G.prog.rank > before.rank ? rankShort() : null, crew: (G.prog.crew.evN || 0) > before.crewN ? G.prog.crew.log.slice(-((G.prog.crew.evN || 0) - before.crewN)) : [] },
    maint: (G.prog.sinks.n.maintain || 0) - before.maint, trades: (G.prog.sinks.n.autoTrade || 0) - before.trades, rations: Math.round(G.prog.rationsLife - before.rr),
    faults: Object.keys(S.faults).length, minPower, minHull, powerZeroS, highlights, bcFights,
  };
}
