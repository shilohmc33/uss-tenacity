import { questDutyItem, repairDutyItem } from "./lt-act.js";
import { G } from "./state.js";
import { SYSTEMS, SEV_LABEL, SEV_RANK, OKAFOR_SHORT, GATE_SYSTEMS } from "./data.js";
import { pick } from "./util.js";
import { log, shipNews, toast } from "./bus.js";
import { PACE, rr, isPresent } from "./pacing.js";
import { activeJob } from "./oddjobs.js";
import { bindSpawn } from "./incidents.js";
import { upkeepFault } from "./upkeep.js";
// phase 6: systems a seriously injured crewmate depends on (G.prog.med; read directly to avoid an import cycle with injuries.js)
// pass 13 HOLD 2: every system an injured crewmate's clock or surgery depends on (warning or surgery, seen or not, present or not):
// Miracle Worker never fixes these - the Lt does (memo "the Lt fixes it"); away and stay are treated alike.
export const medDepends = () => { const m = G.prog && G.prog.med; return m && m.inj ? m.inj.filter(x => (x.state === "warning" || x.state === "surgery") && x.sys).map(x => x.sys) : []; };
// pass 11 HOLD 3: away must never beat staying. A patient the player has seen live (seenT > 0) has their clock frozen
// while the player is away / idle / hidden; the repair of their system is frozen with it (no night-crew fix, no
// progress), so it resumes on return with exactly the odds the player left with.
// pass 12 HOLD 2: ... and it stays frozen after the player returns until the clock really runs again: a patient back from away
// waits for a re-ack (inj.reack, ~1 s of input) with the clock held, so the Lt's walk / repair and every crew fix wait too.
export const medFrozen = () => { const m = G.prog && G.prog.med, pres = isPresent(); if (!m || !m.inj) return [];
  return m.inj.filter(x => x.state === "warning" && x.sys && x.seenT > 0 && (!pres || x.away || x.paused || (x.reack && !x.ack))).map(x => x.sys); };   // away / paused: the first tick back, before tickMed clears them

export function rollSeverity(src) {
  const r = Math.random();
  if (src === "battle") return r < 0.22 ? "low" : r < 0.62 ? "med" : "crit";
  if (src === "hazard") return r < 0.45 ? "low" : r < 0.85 ? "med" : "crit";
  return r < 0.70 ? "low" : r < 0.95 ? "med" : "crit";
}
export const sevCost = sev => (sev === "crit" ? 2 : sev === "med" ? 1 : Math.random() < 0.5 ? 0 : 1);
export const impairing = id => { const f = G.ship.faults[id]; return !!f && f.sev !== "low"; };
export const shieldCap = () => (impairing("shields") ? 50 : 100);
export function faultPriority(id) {
  const f = G.ship.faults[id];
  if (!f) return 3;
  if (G.prog.med && G.prog.med.inj.some(x => x.state === "warning" && x.sys === id)) return 1;   // phase 6: a life hangs on it
  if (G.sp.battle && GATE_SYSTEMS[id] && f.sev !== "low") return 1;
  return f.sev === "low" ? 3 : 2;
}
export function dutyItems() {
  const items = Object.entries(G.ship.faults).map(([id, f]) => ({ kind: "fault", id, pri: faultPriority(id), sev: f.sev, t: f.t }));
  const act = G.sp.ev.active;
  if (act && act.task) items.push({ kind: "task", id: act.id, pri: 1, sev: null, t: 0, task: act.task });
  const job = activeJob(); if (job && !G.sp.battle && !G.sp.alert) items.push({ kind: "job", id: job.id, pri: job.kind === "incident" ? 3 : 4, sev: null, t: 0, job });   // pt04: odd jobs sit below every fault
  try { const q = questDutyItem(); if (q) items.push(q); const rc = repairDutyItem(); if (rc) items.push(rc); } catch (e) {}
  items.sort((a, b) => a.pri - b.pri || (a.sev ? SEV_RANK[a.sev] : -1) - (b.sev ? SEV_RANK[b.sev] : -1) || b.t - a.t);
  return items;
}
export const FAULT_RT = { soft: false };   // E3: set by towToDS9 while it faults the ship after a soft fight
export function spawnFault(src = "ambient", forceId, forceSev) {
  const hold = G.sp && G.sp.battle && G.sp.battle.dc && G.sp.battle.dc.buf && G.sp.battle.dc.buf.core;   // RA(b): 'Hold the core' won - no core fault for the rest of the fight
  const free = Object.keys(SYSTEMS).filter(k => !G.ship.faults[k] && !(hold && k === "warpcore"));
  if (!free.length) return null;
  const id = forceId && free.includes(forceId) ? forceId : pick(free);
  let sev = forceSev || rollSeverity(src);
  if (sev === "crit" && !forceSev && ((G.sp.battle && G.sp.battle.soft) || FAULT_RT.soft)) sev = "med";   // E3: a soft (story) fight never makes a CRIT fault
  G.ship.faults[id] = { t: 0, sev, cost: sevCost(sev), escT: 0 };
  const s = SYSTEMS[id];
  log(`${s.fault} — ${s.name} degrading. [${SEV_LABEL[sev]}]`, "fault");
  if (sev !== "low") {
    log(sev === "crit" ? `Okafor: 'Drop what you're doing, Lieutenant — the ${OKAFOR_SHORT[id]} is critical. Now.'`
      : `Okafor: 'Lieutenant — the ${OKAFOR_SHORT[id]}, now.'`, "comm");
    toast(`${sev === "crit" ? "CRITICAL" : "CHIEF"}: ${s.name} fault`, sev);
  }
  shipNews(`<b>${s.fault} [${SEV_LABEL[sev]}].</b> ` + (sev === "low" ? `${s.name} runs a little under par — nothing bleeds. Fix it when convenient.` : `Send the Lieutenant to the ${s.name} to repair.`));
  upkeepFault(id);   // v18 (Q5): no repair on his own initiative - only by order, or inside an ordered UPKEEP round (upkeep.js)
  return id;
}
export function tickFaults(dt) {
  const S = G.ship;
  S.nextFault -= dt;
  if (S.nextFault <= 0) {
    spawnFault(G.sp.battle ? "battle" : "ambient");
    S.nextFault = rr(PACE.faultEvery);
  }
  for (const [k, f] of Object.entries(S.faults)) {
    f.t += dt;
    if (f.sev === "crit") {
      f.escT += dt;
      if (f.escT >= PACE.critKnockOnS) {
        f.escT = 0;
        const lows = Object.keys(S.faults).filter(o => o !== k && S.faults[o].sev === "low");
        if (lows.length) {
          const up = pick(lows);
          S.faults[up].sev = "med"; S.faults[up].cost = 1;
          log(`Knock-on strain from the ${SYSTEMS[k].name} fault worsens the ${SYSTEMS[up].name} — now MEDIUM.`, "fault");
          log(`Okafor: 'Lieutenant — the ${OKAFOR_SHORT[up]}, now.'`, "comm");
        }
      }
    }
  }
}
// capability gates: deck damage → bridge capability, logged on change
export function syncFaultEffects() {
  const S = G.ship, C = G.gates;
  const now = { loader: impairing("loader"), eps: impairing("eps"), shields: impairing("shields"), warpcore: impairing("warpcore") };
  if (now.loader !== C.loader) log(now.loader ? "Torpedo Loader fault — torpedoes OFFLINE. Hale cannot fire a single tube until the Lieutenant clears the jam on deck." : "Torpedo Loader repaired — torpedoes back ONLINE. Hale has his tubes again.", now.loader ? "fault" : "good");
  if (now.eps !== C.eps) log(now.eps ? "EPS fault — phaser damage and fire rate halved. The bridge feels every conduit the deck loses." : "EPS conduit repaired — phasers back to full damage and fire rate.", now.eps ? "fault" : "good");
  if (now.shields !== C.shields) {
    if (now.shields) { if (S.shields > 50) S.shields = 50; log("Shield Generator fault — shield capacity HALVED until repaired. T'Ren notes the thinner margin and flies accordingly.", "fault"); }
    else log("Shield Generator repaired — full shield capacity restored.", "good");
  }
  if (now.warpcore !== C.warpcore) log(now.warpcore ? "Warp Core fault — evasive unavailable and disengage blocked. The bridge is committed to this fight." : "Warp Core repaired — evasive patterns and disengage available to the bridge again.", now.warpcore ? "fault" : "good");
  G.gates = now;
}

bindSpawn(spawnFault);   // N3: mis-set console incidents spawn an ordinary fault
