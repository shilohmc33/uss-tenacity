// Fixed-order simulation step. Pure state → state; rendering is elsewhere.
import { G } from "./state.js";
import { clamp } from "./util.js";
import { log } from "./bus.js";
import { tickFaults, impairing, syncFaultEffects } from "./faults.js";
import { stepLt } from "./crew.js";
import { tickBattle, tickAlert } from "./battle.js";
import { tickDC, dcPaused } from "./dc.js";   // RA(b)
import { tickEvents } from "./events.js";
import { tickJobs } from "./oddjobs.js";
import { tickVoyage } from "./voyage.js";
import { PACE, PACE_RT } from "./pacing.js";
import { tickDay, tickProg } from "./progression.js";
import { tickNeeds } from "./needs.js";
import { tickCrew } from "./crewlife.js";
import { tickCabin } from "./cabin.js";
import { tickMed } from "./injuries.js";
import { tickHolo } from "./holodeck.js";
import { tickCare } from "./crewcare.js";
import { tickUpkeep } from "./upkeep.js";

// No offline quests (notes/2026-10-25-no-offline-quests-plan.md): the sim only ever runs while the game is open, visible and
// not idle-paused (main.js frame). There is no catch-up, no night crew and no away rules: a closed, hidden or idle game is
// frozen exactly where it stood and resumes on return.
export function stepSim(dt) {
  const S = G.ship, SP = G.sp, L = G.lt;
  S.elapsed += dt;
  S.stardate += dt * 0.022;
  tickDay(dt);   // lifetime rep + the shift clock (the ship's day itself turns on real play days: progression.js markPlayDay)
  tickCabin(dt); // phase 4: quarters tier sync, Refreshed buff
  tickMed(dt);   // phase 6: sickbay (injury warning windows, recoveries, memorial)
  tickCrew(dt);  // phase 3: replacement crew arriving (crewlife.js; the daily crew roll hangs off the ship's day)
  tickNeeds(dt); // crew needs N1 (needs.js): whole roster
  tickProg(dt);  // relationships (ignored faults, station help), readiness, promotion checks
  PACE_RT.idleT += dt;
  PACE_RT.liveFight = !!(SP.battle && SP.battle.live);   // pass 16 B1
  PACE_RT.sessionT += dt; if (G.prog) G.prog.restT = (+G.prog.restT || 0) + dt;   // rested window used (saved; reset only after a real absence)
  tickFaults(dt);
  stepLt(dt);
  tickUpkeep(dt);   // D: the Lt's ordered UPKEEP round (upkeep.js; only ever started by the player's order)
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
  if (S.power <= 0.5 && !S.powerWarned) { S.powerWarned = true; log("Power grid critical — output cannot meet load. Man the warp core console or shed load.", "fault"); }
  if (S.power > 12) S.powerWarned = false;
  if (impairing("shields")) S.shields = clamp(S.shields - (SP.battle ? 2 : 0.3) * dt, 0, 100);
  if (impairing("coolant")) {
    S.hull = Math.max(5, S.hull - (SP.battle ? 0.45 : PACE.coolantHullDrain) * dt);
    if (S.hull <= 5.2 && !S.hullFloorWarned) { S.hullFloorWarned = true; log("Emergency bulkheads holding, Captain. The Tenacity refuses to die.", "comm"); }
  } else if (S.power >= 25 && S.hull < 100) S.hull = clamp(S.hull + 0.12 * dt, 0, 100);
  if (S.hull > 12) S.hullFloorWarned = false;
  if (S.energy < 15 && !S.energyWarned) { S.energyWarned = true; log("The Lieutenant is running on fumes — biobed, mess hall, or his bunk will put him right.", "fault"); }
  if (S.energy > 40) S.energyWarned = false;
  if (SP.battle) S.alertT = Math.max(S.alertT, 2); else S.alertT = Math.max(0, S.alertT - dt);
  if (!dcPaused()) tickBattle(dt);   // RA(b): the fight holds while a damage-control call is open
  tickDC(dt);
  tickAlert(dt);   // RA(a): a held red alert (T'Ren engages after 90 s present; it waits, however long, while you aren't)
  syncFaultEffects();
  tickEvents(dt);
  tickJobs(dt);   // pt04: odd jobs between repairs
  tickHolo(dt / 3600); tickCare();   // N4: crew self-booked holodeck sessions; shore leave resets per dock
  tickVoyage(dt);
}
