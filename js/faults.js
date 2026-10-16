import { G } from "./state.js";
import { SYSTEMS, SEV_LABEL, SEV_RANK, OKAFOR_SHORT, GATE_SYSTEMS, NODEMAP } from "./data.js";
import { pick } from "./util.js";
import { log, setStatus, toast } from "./bus.js";
import { sendRepair } from "./crew.js";

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
  setStatus(`<b>${s.fault} [${SEV_LABEL[sev]}].</b> ` + (sev === "low" ? `${s.name} runs a little under par — nothing bleeds. Fix it when convenient.` : `Send the Lieutenant to the ${s.name} to repair.`));
  const lt = G.lt;
  if (lt.mode === "use" && lt.node && NODEMAP[lt.node].system === id) sendRepair(id);
  return id;
}
export function tickFaults(dt) {
  const S = G.ship;
  S.nextFault -= dt;
  if (S.nextFault <= 0) { spawnFault(G.sp.battle ? "battle" : "ambient"); S.nextFault = 180 + Math.random() * 120; }
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
