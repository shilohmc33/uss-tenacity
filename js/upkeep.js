// D (notes/2026-10-25-no-offline-quests-plan.md §4, option A, approved): ORDERED UPKEEP. One UPKEEP order = one round the Lt
// runs by himself: shields -> main power -> parts locker, each only when below its target. Unlocked at Lieutenant (rank 1).
// Nothing repeats and nothing starts without the order. The round stops when it is done, or on any interruption: a fault on
// another system, a red alert / battle, or any new order from the player. A fault on the console he is working is taken as
// part of the round (Q5: the crew fix consoles only by order or inside an upkeep round), then he goes back to the step.
import { G, saveSoon } from "./state.js";
import { NODEMAP } from "./data.js";
import { sendUse, sendRepair, playerOrder, ltNote } from "./crew.js";
import { shieldCap } from "./faults.js";
import { log, toast } from "./bus.js";
import { addHardener } from "./progression.js";

export const UPKEEP = { minRank: 1, lockerTo: 0.75, steps: ["shield", "core", "locker"] };
const LABEL = { shield: "shields", core: "main power", locker: "parts locker" };
const U = () => { const p = G.prog; if (!p.upkeep || typeof p.upkeep !== "object") p.upkeep = { order: null, n: 0 }; return p.upkeep; };
const target = k => k === "shield" ? shieldCap() : k === "core" ? 100 : Math.ceil(G.ship.partsCap * UPKEEP.lockerTo);
const level = k => k === "shield" ? G.ship.shields : k === "core" ? G.ship.power : G.ship.parts;
export const stepDone = k => level(k) >= target(k);
export const upkeepUnlocked = () => (G.prog.rank | 0) >= UPKEEP.minRank;
export const upkeepActive = () => !!U().order;
export function upkeepState() {
  const o = U().order;
  return { unlocked: upkeepUnlocked(), active: !!o, step: o ? o.steps[o.i] : null, steps: o ? o.steps.slice() : [], n: U().n | 0 };
}
function go() { const o = U().order; if (!o) return; playerOrder(() => sendUse(o.steps[o.i], { force: true })); }
// the player's order (the UPKEEP chip). Tapping it again while a round runs calls the round off.
export function orderUpkeep() {
  if (!upkeepUnlocked()) { toast("UPKEEP unlocks at Lieutenant"); return false; }
  if (U().order) { cancelUpkeep("called off"); return false; }
  if (G.sp.battle || G.sp.alert) { toast("Not during red alert"); return false; }
  const steps = UPKEEP.steps.filter(k => !stepDone(k));
  if (!steps.length) { toast("Nothing needs topping up"); log("Upkeep: shields, power and the parts locker are already where they should be.", "comm"); return false; }
  U().order = { steps, i: 0, fix: null };
  log(`Upkeep round ordered: ${steps.map(k => LABEL[k]).join(" → ")}. The Lieutenant works through it himself.`, "comm");
  ltNote(`<b>Upkeep round</b> — ${steps.map(k => LABEL[k]).join(" → ")}. Any new order calls it off.`);
  go(); saveSoon("upkeep"); return true;
}
export function cancelUpkeep(why = "interrupted") {
  if (!U().order) return false;
  U().order = null; log(`Upkeep round stopped — ${why}.`, "comm"); return true;
}
const nodeOf = it => it ? (it.kind === "use" ? it.node : it.then && it.then.kind === "use" ? it.then.node : null) : null;
const sysOf = it => it ? (it.kind === "repair" ? it.sys : it.then && it.then.kind === "repair" ? it.then.sys : null) : null;
// called by faults.spawnFault for every new fault
export function upkeepFault(id) {
  const o = U().order; if (!o) return;
  const L = G.lt, k = o.steps[o.i], n = NODEMAP[k];
  if (n && n.system === id && L.mode === "use" && L.node === k) { o.fix = id; log(`Upkeep: a fault on the ${LABEL[k]} console — he takes it as part of the round.`, "comm"); playerOrder(() => sendRepair(id)); return; }
  cancelUpkeep("a new fault needs your call");
}
export function tickUpkeep() {
  const o = U().order; if (!o) return;
  if (G.sp.battle || G.sp.alert) { cancelUpkeep("red alert"); return; }
  const L = G.lt, k = o.steps[o.i], sys = NODEMAP[k] && NODEMAP[k].system;
  const fixing = sys && ((L.mode === "repair" && L.repairSys === sys) || sysOf(L.intent) === sys || (L.lift && sysOf(L.lift.then) === sys));
  if (fixing) { o.fix = sys; return; }
  const bound = (L.mode === "use" && L.node === k) || (L.mode === "walk" && nodeOf(L.intent) === k) || (L.lift && nodeOf(L.lift.then) === k);
  if (!bound) {
    if (o.fix && L.mode === "idle" && !L.path && !L.lift && !G.ship.faults[o.fix]) { o.fix = null; go(); return; }   // fixed: back to the step
    cancelUpkeep(o.fix && G.ship.faults[o.fix] ? "the repair stalled" : "new orders"); return;
  }
  if (!(L.mode === "use" && L.node === k) || !stepDone(k)) return;
  o.i++; while (o.i < o.steps.length && stepDone(o.steps[o.i])) o.i++;
  if (o.i >= o.steps.length) {
    U().order = null; U().n = (U().n | 0) + 1;
    log(`Upkeep round complete — shields ${Math.round(G.ship.shields)}%, power ${Math.round(G.ship.power)}%, locker ${G.ship.parts}/${G.ship.partsCap}.`, "good");
    ltNote("Upkeep round complete. Awaiting orders."); saveSoon("upkeep"); return;
  }
  go();
}
export function hardenUpkeep(p) {
  const u = p.upkeep, o = u && typeof u === "object" ? u.order : null;
  const ok = o && typeof o === "object" && Array.isArray(o.steps) && o.steps.length && o.steps.every(k => UPKEEP.steps.includes(k)) && Number.isInteger(o.i) && o.i >= 0 && o.i < o.steps.length;
  p.upkeep = { order: ok ? { steps: o.steps.slice(0, 3), i: o.i, fix: typeof o.fix === "string" ? o.fix : null } : null, n: u && Number.isFinite(u.n) ? Math.max(0, Math.floor(u.n)) : 0 };
}
addHardener(hardenUpkeep);
