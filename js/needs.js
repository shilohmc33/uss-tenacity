// Crew needs phase N1 (notes/2026-10-22-crew-needs-plan.md): five needs per crewmember (0-100), a shift (alpha / beta /
// gamma on the 16 h ship's day) and the current activity: duty | sleep | eat | fun. npc-ambient turns the activity into
// walking (cabins, mess tables, the bar). Simulated for the whole roster in stepSim, offline too (needs floor at
// NEEDS.offlineFloor while away). Saved in G.prog.needs[occupantId] (save v15). Mood and incidents are N2/N3.
import { G } from "./state.js";
import { NEEDS, PACE_RT } from "./pacing.js";
import { PROG } from "./progression.js";
import { quirksOf, tickMood, hardenMood, moodlet, skillLvl } from "./mood.js";

export const NEED_KEYS = ["rest", "food", "fun", "social", "comfort"];
export const NEED_LABEL = { rest: "Rest", food: "Food", fun: "Fun", social: "Social", comfort: "Comfort" };
export const SHIFT_NAME = ["alpha", "beta", "gamma"];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const hash = id => { let h = 2166136261; for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const fresh = id => ({ n: { ...NEEDS.start }, shift: quirksOf(id).includes("nightowl") ? 2 : hash(id) % 3, act: "duty" });   // N2: night owls take gamma
const all = () => { const p = G.prog; if (!p.needs || typeof p.needs !== "object" || Array.isArray(p.needs)) p.needs = {}; return p.needs; };
export function needsOf(id) { const A = all(); return A[id] || (A[id] = fresh(id)); }
// load: junk values take defaults; records of crew no longer aboard are dropped
export function hardenNeeds(p) {
  if (!p) return;
  const src = p.needs && typeof p.needs === "object" && !Array.isArray(p.needs) ? p.needs : {}, out = {};
  const C = p.crew, aboard = new Set(C && C.slots ? Object.values(C.slots).filter(Boolean) : Object.keys(src));
  for (const id of aboard) {
    const r = src[id], f = fresh(id); if (!r || typeof r !== "object") { if (src[id] !== undefined) out[id] = f; continue; }
    const n = {}; for (const k of NEED_KEYS) { const v = r.n && r.n[k]; n[k] = typeof v === "number" && Number.isFinite(v) ? clamp(v, 0, 100) : f.n[k]; }
    out[id] = { n, shift: [0, 1, 2].includes(r.shift) ? r.shift : f.shift, act: ["duty", "sleep", "eat", "fun", "holo"].includes(r.act) ? r.act : "duty", ...(r.nap === true ? { nap: true } : {}) };
    hardenMood(out[id], r);   // N2
  }
  p.needs = out;
}
export const shiftNow = () => Math.floor((G.prog.dayT || 0) / PROG.dayLength * 3) % 3;
export const onShift = id => needsOf(id).shift === shiftNow();
export const activityOf = id => (G.prog && G.prog.needs && G.prog.needs[id] ? G.prog.needs[id].act : "duty");
function comfortTarget() {
  const c = NEEDS.comfort, S = G.ship, SP = G.sp;
  let t = c.base + (SP.location && !SP.travel ? c.docked : 0) - Math.min(c.faultMax, Object.keys(S.faults || {}).length * c.perFault);
  if (S.hull < c.lowHullAt) t -= c.lowHull; if (SP.battle) t -= c.alert;
  return clamp(t, 0, 100);
}
export function choose(r, id) {
  const n = r.n, T = NEEDS.th, A = r.act, on = r.shift === shiftNow();
  { const b = G.prog.holo && G.prog.holo.busy && G.prog.holo.busy[id || ""]; if (b && b.endT > ((G.ship && G.ship.elapsed) || 0)) return "holo"; }   // N4: on the holodeck (off the visible deck)
  if (r.argue) { if (r.argue > ((G.ship && G.ship.elapsed) || 0) && !r.unwell) return "fun"; if (!(r.argue > ((G.ship && G.ship.elapsed) || 0))) delete r.argue; }   // N3: arguing in the Mess & Bar
  if (r.unwell) { if (r.unwell > ((G.ship && G.ship.elapsed) || 0)) return n.food < T.wakeToEat ? "eat" : "sleep"; delete r.unwell; }   // N3: signed off duty (not an injury): rests in quarters
  if (A === "eat" && n.food < 99) return "eat";   // finish the meal
  if (A === "sleep" && !PACE_RT.offline && n.food < T.wakeToEat) { r.nap = true; return "eat"; }   // P27: hunger wakes a sleeper (online)
  if (r.nap) { delete r.nap; if (!on && n.rest < T.wake) return "sleep"; }   // ...who goes back to bed after the meal
  if (on) return n.food < T.mealBreak ? "eat" : "duty";
  if (A === "sleep" && n.rest < T.wake) return "sleep";
  if (A === "fun" && n.fun < T.funDone) return "fun";
  if (n.rest < T.sleep) return "sleep";
  if (n.food < T.eat) return "eat";
  if (n.fun < T.fun) return "fun";
  return "duty";   // off shift, nothing pressing: potters about their usual spots
}
let acc = 0;
export function tickNeeds(dt) {
  acc += dt; if (acc < NEEDS.stepS) return;
  const h = acc / 3600; acc = 0;
  const p = G.prog, C = p && p.crew; if (!C || !C.slots) return;
  const alert = !!G.sp.battle, floor = PACE_RT.offline ? NEEDS.offlineFloor : 0, ct = comfortTarget(), D = NEEDS.decay, Gn = NEEDS.gain;
  const inj = new Set(((p.med && p.med.inj) || []).map(x => x.id));
  for (const id of Object.values(C.slots)) {
    if (!id || !C.occ[id] || inj.has(id)) continue;   // sickbay: needs on hold
    const r = needsOf(id), n = r.n, A = r.act, q = quirksOf(id), sh = shiftNow();
    // N2 quirks + Fitness: drain multipliers
    let mRest = 1 - 0.02 * skillLvl(id, "fitness"), mFun = 1, mSoc = 1, gSoc = 1, cAdj = 0;
    if (q.includes("nightowl")) mRest *= sh === 2 ? 0.75 : sh === 0 ? 1.25 : 1;
    if (q.includes("workaholic")) { mFun *= 0.5; mRest *= 1.2; }
    if (q.includes("devout")) mFun *= 0.75;
    if (q.includes("loner")) { mSoc *= 0.25; gSoc = 0.5; }
    if (q.includes("butterfly")) mSoc *= 2;
    if (q.includes("homesick") && !(G.sp.location === "ds9" && !G.sp.travel)) cAdj = -8;
    n.rest += (A === "sleep" ? Gn.sleep : -D.rest * mRest) * h;
    n.food += (A === "eat" ? Gn.eat : -D.food) * h;
    n.fun += (A === "fun" || A === "holo" ? Gn.fun : -D.fun * mFun) * h;
    n.social += (A === "eat" || A === "fun" ? Gn.socialGroup * gSoc : -D.social * mSoc) * h;
    n.comfort += clamp(clamp(ct + cAdj, 0, 100) - n.comfort, -NEEDS.comfort.rate * h, NEEDS.comfort.rate * h);
    for (const k of NEED_KEYS) n[k] = clamp(n[k], floor, 100);
    { const lk = G.prog.holo && G.prog.holo.lock && G.prog.holo.lock[id]; if (lk > ((G.ship && G.ship.elapsed) || 0)) n.comfort = Math.max(n.comfort, 90); }   // N4: Risa keeps Comfort high for a day
    r.act = alert ? "duty" : choose(r, id);
    tickMood(id, r, h, r.shift === sh);   // N2: mood, stress, skills XP, minor incidents
  }
}
export function chatNeed(id) { const r = needsOf(id), q = quirksOf(id); r.n.social = clamp(r.n.social + NEEDS.gain.chat * (q.includes("butterfly") ? 2 : q.includes("loner") ? 0.5 : 1), 0, 100); moodlet(id, "chat"); }
export const ACT_LABEL = { duty: "on duty", sleep: "asleep", eat: "at the mess", fun: "off duty · unwinding", holo: "on the holodeck" };
export const statusOf = id => { const r = needsOf(id); return r.act === "duty" && r.shift !== shiftNow() ? "off duty" : ACT_LABEL[r.act]; };
