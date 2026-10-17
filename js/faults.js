import { G } from "./state.js";
import { SYSTEMS, SEV_LABEL, SEV_RANK, OKAFOR_SHORT, GATE_SYSTEMS, NODEMAP } from "./data.js";
import { pick } from "./util.js";
import { log, shipNews, toast } from "./bus.js";
import { sendRepair, cancelRepairIf } from "./crew.js";
import { PACE, rr, nightActive } from "./pacing.js";

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
  if (G.sp.battle && GATE_SYSTEMS[id] && f.sev !== "low") return 1;
  return f.sev === "low" ? 3 : 2;
}
export function dutyItems() {
  const items = Object.entries(G.ship.faults).map(([id, f]) => ({ kind: "fault", id, pri: faultPriority(id), sev: f.sev, t: f.t }));
  const act = G.sp.ev.active;
  if (act && act.task) items.push({ kind: "task", id: act.id, pri: 1, sev: null, t: 0, task: act.task });
  items.sort((a, b) => a.pri - b.pri || (a.sev ? SEV_RANK[a.sev] : -1) - (b.sev ? SEV_RANK[b.sev] : -1) || b.t - a.t);
  return items;
}
export function spawnFault(src = "ambient", forceId, forceSev) {
  const free = Object.keys(SYSTEMS).filter(k => !G.ship.faults[k]);
  if (!free.length) return null;
  const id = forceId && free.includes(forceId) ? forceId : pick(free);
  const sev = forceSev || rollSeverity(src);
  G.ship.faults[id] = { t: 0, sev, cost: sevCost(sev), escT: 0 };
  const s = SYSTEMS[id];
  log(`${s.fault} — ${s.name} degrading. [${SEV_LABEL[sev]}]`, "fault");
  if (sev !== "low") {
    log(sev === "crit" ? `Okafor: 'Drop what you're doing, Lieutenant — the ${OKAFOR_SHORT[id]} is critical. Now.'`
      : `Okafor: 'Lieutenant — the ${OKAFOR_SHORT[id]}, now.'`, "comm");
    toast(`${sev === "crit" ? "CRITICAL" : "CHIEF"}: ${s.name} fault`, sev);
  }
  shipNews(`<b>${s.fault} [${SEV_LABEL[sev]}].</b> ` + (sev === "low" ? `${s.name} runs a little under par — nothing bleeds. Fix it when convenient.` : `Send the Lieutenant to the ${s.name} to repair.`));
  const lt = G.lt;
  if (lt.mode === "use" && lt.node && NODEMAP[lt.node].system === id) sendRepair(id);
  return id;
}
export function tickFaults(dt) {
  const S = G.ship;
  S.nextFault -= dt;
  if (S.nextFault <= 0) {
    // NEW-06: while the night crew has the deck, the ambient roll is skipped once the backlog reaches the cap
    if (!(nightActive() && !G.sp.battle && Object.keys(S.faults).length >= PACE.nightFaultCap)) spawnFault(G.sp.battle ? "battle" : "ambient");
    S.nextFault = rr(PACE.faultEvery);
  }
  for (const [k, f] of Object.entries(S.faults)) {
    f.t += dt;
    if (f.sev === "crit") {
      f.escT += dt;
      if (f.escT >= 150) {
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

// ---- shift handover (end of an offline catch-up): the night crew works the backlog down to PACE.nightFaultCap,
// LOW faults first, then MEDIUM (a spare each when the locker has one), stabilising CRITICALs to MEDIUM. Returns fixes.
export function nightHandover() {
  const S = G.ship, L = G.lt, rank = { low: 0, med: 1, crit: 2 };
  let fixes = 0;
  const open = () => Object.entries(S.faults).filter(([k]) => !(L.mode === "repair" && L.repairSys === k));
  for (let guard = 0; guard < 12 && Object.keys(S.faults).length > PACE.nightFaultCap; guard++) {
    const list = open().sort((a, b) => rank[a[1].sev] - rank[b[1].sev] || b[1].t - a[1].t);
    if (!list.length) break;
    const [k, f] = list[0], s = SYSTEMS[k];
    if (f.sev === "crit") { f.sev = "med"; f.cost = 1; f.escT = 0; continue; }
    if (f.sev === "med" && S.parts >= PACE.nightMedParts) S.parts -= PACE.nightMedParts;
    delete S.faults[k]; cancelRepairIf(k); fixes++;
    G.night.fixes = (G.night.fixes || 0) + 1; G.stats.nightFixes = (G.stats.nightFixes || 0) + 1;
    log(`Shift handover: Okafor's night crew clears the ${s.name} fault (${SEV_LABEL[f.sev]}) before you come on watch.`, "good");
  }
  return fixes;
}
// ---- night-shift crew: while the player is away (offline catch-up, or idle), an off-screen damage-control team
// under Okafor works the duty list one fault at a time: LOW faults quickly, MED slowly (spares if the locker has
// them), CRITICAL ones get stabilised to MED. Never touches the fault the Lt is repairing. Tunables: PACE.nightFix.
export function tickNightCrew(dt) {
  const S = G.ship, N = G.night, L = G.lt;
  if (!nightActive()) { N.sys = null; N.t = 0; return; }
  if (N.sys && !S.faults[N.sys]) { N.sys = null; N.t = 0; }
  if (!N.sys) {
    // triage: anything bleeding hull/power first (impairing coolant / warp core / EPS), then quick LOW fixes,
    // then stabilising CRITICALs, then the remaining MEDIUMs; oldest first within a tier
    const tier = ([k, f]) => (f.sev !== "low" && (k === "coolant" || k === "warpcore" || k === "eps")) ? 0 : f.sev === "low" ? 1 : f.sev === "crit" ? 2 : 3;
    const order = Object.entries(S.faults).filter(([k]) => !(L.mode === "repair" && L.repairSys === k))
      .sort((a, b) => tier(a) - tier(b) || b[1].t - a[1].t);
    if (!order.length) return;
    N.sys = order[0][0]; N.t = 0;
  }
  const f = S.faults[N.sys], need = f.sev === "low" ? PACE.nightFix.low : f.sev === "crit" ? PACE.nightFix.critToMed
    : PACE.nightFix.med * (S.parts >= PACE.nightMedParts ? 1 : 2);
  N.t += dt * (G.sp.battle ? 0.5 : 1);
  if (N.t < need) return;
  const s = SYSTEMS[N.sys];
  if (f.sev === "crit") { f.sev = "med"; f.cost = 1; f.escT = 0; log(`Night watch: Okafor's damage-control team stabilises the ${s.name} — down from CRITICAL to MEDIUM.`, "good"); }
  else {
    if (f.sev === "med" && S.parts >= PACE.nightMedParts) S.parts -= PACE.nightMedParts;
    delete S.faults[N.sys]; cancelRepairIf(N.sys);
    N.fixes = (N.fixes || 0) + 1; G.stats.nightFixes = (G.stats.nightFixes || 0) + 1;
    log(`Night watch: the damage-control team clears the ${s.name} fault (${SEV_LABEL[f.sev]}).`, "good");
  }
  N.sys = null; N.t = 0;
}
