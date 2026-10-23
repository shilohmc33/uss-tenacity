// N4 player crew-care tools (plan section 6). P31: rest / swap / shore leave are requests to the captain until Lt Cmdr.
// Order rest (4 h off duty, once per ship's day per crewmember), a counselor visit (stress reset, every 3 ship's days),
// a shift swap (Okafor approves engineering, T'Ren the rest; once per ship's day), shore leave at DS9 (ship-wide, once
// per dock, 10 rep). Plus the Personal Log "Lately" line and the Insight gates for quirks / need bars.
import { G } from "./state.js";
import { CARE, MOOD } from "./pacing.js";
import { PROG, addHardener, nudge, spend, canAfford, addr, opinionOf } from "./progression.js";
import { SLOTMAP, pr } from "./roster.js";
import { log, toast } from "./bus.js";
import { needsOf, NEED_KEYS, SHIFT_NAME } from "./needs.js";
import { moodlet, moodAll, quirkNames, bandOf } from "./mood.js";
import { level as insightLvl } from "./insight.js";
import { isHolo } from "./holodeck.js";

const now = () => (G.ship && G.ship.elapsed) || 0;
const P = () => G.prog;
const occ = id => P().crew.occ[id];
const nm = id => occ(id) ? occ(id).short : "someone";
const day = () => P().day;
export const C = () => { const p = P(); if (!p.care || typeof p.care !== "object") p.care = freshCare(); return p.care; };
export const freshCare = () => ({ rest: {}, counsel: {}, swap: {}, deny: {}, shoreUsed: false, n: { rest: 0, counsel: 0, swap: 0, shore: 0, denied: 0 } });
const injured = () => new Set(((P().med && P().med.inj) || []).map(x => x.id));
const slotOf = id => occ(id) && SLOTMAP[occ(id).slot];
// who signs off: Okafor for engineering, T'Ren for the rest; never the person it's about (falls back to another senior)
function approver(id) {
  const sl = slotOf(id), order = (sl && sl.dept === "eng" ? ["chief-engineer", "co"] : ["co", "chief-engineer"]).concat(["tactical", "science"]);
  for (const s of order) { const a = P().crew.slots[s]; if (a && a !== id && occ(a) && !injured().has(a)) return nm(a); }
  return "The duty officer";
}
function doctor(id) { for (const s of ["doctor", "nurse"]) { const a = P().crew.slots[s]; if (a && a !== id && occ(a) && !injured().has(a)) return nm(a); } return approver(id); }
const common = id => {
  if (!occ(id)) return "not aboard";
  if (injured().has(id)) return `${nm(id)} is in sickbay`;
  if (G.sp.battle) return "not during battle";
  if (isHolo(id)) return `${nm(id)} is on the holodeck`;
  return null;
};
// ---- P31: the captain's call. Below Lt Cmdr, rest / swap / shore leave are requests; the CO approves on a roll that rises
// with the crewmember's stress and worst need and with the CO's opinion of the Lt. A no costs nothing; 1-day cooldown.
const R = CARE.req;
export const direct = () => (P().rank || 0) >= R.directRank;
const capId = () => { const a = P().crew.slots.co; return a && occ(a) && !injured().has(a) ? a : null; };
const capName = () => capId() ? nm(capId()) : "The duty officer";
const parts = ids => {
  let st = 0, nd = 0;
  for (const id of ids) { const r = needsOf(id), w = Math.min(...NEED_KEYS.map(k => r.n[k] ?? 100)); st += Math.min(1, (r.stress || 0) / R.stressFull); nd += Math.max(0, Math.min(1, (R.needOk - w) / R.needOk)); }
  const n = Math.max(1, ids.length), op = capId() ? opinionOf(capId()) : 0;
  return { st: st / n, nd: nd / n, op: Math.max(-1, Math.min(1, op / 100)) };
};
export function chance(ids) { const f = parts(ids); return Math.max(R.min, Math.min(R.max, R.base + R.stressW * f.st + R.needW * f.nd + R.opW * f.op)); }
export const oddsWord = p => p >= 0.75 ? "likely" : p >= 0.5 ? "fair odds" : p >= 0.3 ? "a long shot" : "unlikely";
const denyLeft = (id, k) => { const t = (C().deny[id] || {})[k]; return t != null ? t + R.denyDays * PROG.dayLength - now() : 0; };
const hrs = s => { const h = Math.ceil(s / 3600); return `${h} h`; };
function noReason(ids, f) {   // one reason, the weakest factor
  const who = ids.length === 1 ? nm(ids[0]) : "The crew";
  if (f.st + f.nd < 0.3) return `${who} appear${ids.length === 1 ? "s" : ""} fit for duty. Request denied.`;
  if (f.op < 0.1) return "I will need a stronger record from you before I grant that, Lieutenant.";
  return "Not this watch. We cannot spare the hands.";
}
// roll the captain's answer; returns { ok, said }
function askCaptain(ids) {
  const f = parts(ids), p = chance(ids), yes = Math.random() < p;
  const said = yes ? `${capName()}: "Approved."` : `${capName()}: "${noReason(ids, f)}"`;
  return { ok: yes, said, p };
}
function deny(id, k, said) { (C().deny[id] = C().deny[id] || {})[k] = now(); C().n.denied++; log(said, "warn"); return { ok: false, denied: true, why: said, line: said }; }
export function toolState(id) {
  const c = C(), r = needsOf(id), co = occ(id) && occ(id).slot === "co", base = common(id);
  const rest = base || (co ? "you can't order the captain to bed" : r.unwell > now() ? `${nm(id)} is already off duty` : c.rest[id] === day() ? "once per ship's day" : null);
  const lastC = c.counsel[id], cd = lastC != null ? Math.max(0, Math.ceil(CARE.counselGapDays - (now() - lastC) / PROG.dayLength)) : 0;
  const counsel = base || (cd > 0 ? `again in ${cd} ship's day${cd === 1 ? "" : "s"}` : null);
  const swap = base || (co ? "the captain sets her own watch" : c.swap[id] === day() ? "once per ship's day" : null);
  const dl = k => !direct() && denyLeft(id, k) > 0 ? `the captain said no · ask again in ${hrs(denyLeft(id, k))}` : null;
  const restW = rest || dl("rest"), swapW = swap || dl("swap"), d = direct(), odds = d ? null : oddsWord(chance([id]));
  return { direct: d, odds, rest: { ok: !restW, why: restW }, counsel: { ok: !counsel, why: counsel }, swap: { ok: !swapW, why: swapW, to: SHIFT_NAME[(r.shift + 1) % 3] } };
}
export function orderRest(id) {
  const st = toolState(id).rest; if (!st.ok) return { ok: false, why: st.why };
  const a = direct() ? null : askCaptain([id]); if (a && !a.ok) return deny(id, "rest", a.said);
  const r = needsOf(id); r.unwell = now() + CARE.restS; C().rest[id] = day(); C().n.rest++; moodlet(id, "rested");
  const line = `${a ? a.said + " " : "You order it on your own authority: "}${nm(id)} is relieved for four hours of rest. ${pr(occ(id), "sub").replace(/^./, c => c.toUpperCase())} ${pr(occ(id), "s") ? "doesn't" : "don't"} argue.`;
  log(line, "good"); return { ok: true, line };
}
export function counsel(id) {
  const st = toolState(id).counsel; if (!st.ok) return { ok: false, why: st.why };
  const r = needsOf(id); r.stress = 0; C().counsel[id] = now(); C().n.counsel++; moodlet(id, "counsel"); nudge(id, 1, "counselor");
  const line = `You ask ${doctor(id)} to make time for ${nm(id)}. An hour in the counselor's office, and ${pr(occ(id), "sub")} come${pr(occ(id), "s")} out standing straighter.`;
  log(line, "good"); return { ok: true, line };
}
export function shiftSwap(id) {
  const st = toolState(id).swap; if (!st.ok) return { ok: false, why: st.why };
  const a = direct() ? null : askCaptain([id]); if (a && !a.ok) return deny(id, "swap", a.said);
  const r = needsOf(id); r.shift = (r.shift + 1) % 3; C().swap[id] = day(); C().n.swap++; moodlet(id, "swap");
  const line = `${a ? a.said + " " : "You sign the swap yourself: "}${nm(id)} moves to ${SHIFT_NAME[r.shift]} shift.`;
  log(line, "good"); return { ok: true, line };
}
const shipIds = () => Object.values(P().crew.slots).filter(id => id && occ(id) && !injured().has(id) && occ(id).slot !== "co");
export const shoreOdds = () => oddsWord(chance(shipIds()));
export const atDS9 = () => G.sp.location === "ds9" && !G.sp.travel;
export function shoreState() {
  if (!atDS9()) return { ok: false, why: "only while docked at DS9" };
  if (C().shoreUsed) return { ok: false, why: C().shoreDenied ? "the captain said no · once per visit" : "once per visit" };
  if (G.sp.battle) return { ok: false, why: "not during battle" };
  if (!canAfford({ rep: CARE.shoreRep })) return { ok: false, why: `${CARE.shoreRep} rep needed` };
  return { ok: true };
}
export function shoreLeave() {
  const st = shoreState(); if (!st.ok) return st;
  const ids = shipIds(), a = askCaptain(ids); C().shoreUsed = true;
  if (!a.ok) { C().shoreDenied = true; C().n.denied++; log(a.said, "warn"); return { ok: false, denied: true, why: a.said, line: a.said }; }
  spend({ rep: CARE.shoreRep }, "shore"); C().shoreDenied = false; C().n.shore++;
  moodAll("shore");
  for (const id of Object.values(P().crew.slots)) if (id && occ(id) && !injured().has(id)) { const r = needsOf(id); for (const k of ["fun", "social", "comfort"]) r.n[k] = Math.min(100, r.n[k] + CARE.shoreFill); r.stress = (r.stress || 0) * 0.5; }
  const line = `${a.said} ${capName()} grants shore leave on DS9. Quark's is loud, the Promenade is crowded, and the crew come back lighter.`;
  log(line, "good"); toast("Shore leave granted", "good"); return { ok: true, line };
}
export function tickCare() { if (!atDS9() && C().shoreUsed) { C().shoreUsed = false; C().shoreDenied = false; } }   // a new dock, a new shore leave
// ---- Insight gates (plan section 5) ----
export const barsShown = () => insightLvl() >= CARE.insightBars;
export function quirksShown(id) { const l = insightLvl(), q = quirkNames(id); return l >= CARE.insightQuirks ? q : l >= CARE.insightQuirk1 ? q.slice(0, 1) : []; }
// ---- the Personal Log "Lately" line ----
const LATELY = {
  death: "hasn't been the same since the memorial", keralaLost: "hasn't slept well since the Kerala", allyLost: "keeps going back over the escort we lost",
  tow: "is still smarting over the tow back", injury: "has been jumpy since the casualty reports", disengage: "doesn't like how that last fight ended",
  scuffle: "is sulking after the scuffle in the Mess", win: "is still riding the last win", shore: "came back from shore leave grinning",
  giftLoved: "keeps your gift where everyone can see it", gift: "mentioned your gift twice", giftBad: "hasn't said much about your gift", dinner: "still talks about your dinner",
  talked: "seems lighter since your talk", heard: "has been steadier since you sat with them", counsel: "has been steadier since the counselor visit",
  rested: "looks better for the rest", swap: "seems happier on the new shift", chat: "has been chatty lately",
  holoCal: "has been bragging about bat'leth forms", holoZen: "has been unusually calm", holoNovel: "keeps quoting Dixon Hill", holoProton: "keeps humming the Captain Proton theme",
  holoVic: "has been humming Sinatra", holoRisa: "is still sunburnt from Risa", holoCrowd: "wants a little less company", holoLoved: "loved that holodeck booking",
};
const BAND_LINE = ["seems settled", "seems steady enough", "seems strained", "is clearly stressed", "is close to breaking"];
export function lately(id) {
  const r = needsOf(id), t = now(), ml = (r.ml || []).filter(m => m.t1 > t);
  const top = ml.slice().sort((a, b) => Math.abs(b.v) - Math.abs(a.v))[0], sum = ml.reduce((s, m) => s + m.v * Math.max(0, (m.t1 - t) / (m.t1 - m.t0)), 0);
  const name = nm(id), what = top && LATELY[top.k] ? LATELY[top.k] : BAND_LINE[bandOf(id)] || BAND_LINE[1];
  const trend = sum > 2 ? { a: "▲", w: "mood rising" } : sum < -2 ? { a: "▼", w: "mood falling" } : { a: "•", w: "mood steady" };
  return { text: `${name} ${what.replace("them", pr(occ(id), "obj"))}.`, trend };
}
export function hardenCare(p) {
  const s = p.care && typeof p.care === "object" ? p.care : {}, out = freshCare(), t = (G.ship && G.ship.elapsed) || 0;
  const ok = id => !!(p.crew && p.crew.occ && p.crew.occ[id]);
  for (const k of ["rest", "swap"]) if (s[k] && typeof s[k] === "object") for (const [id, v] of Object.entries(s[k])) if (ok(id) && Number.isInteger(v) && v <= (p.day || 0)) out[k][id] = v;
  if (s.counsel && typeof s.counsel === "object") for (const [id, v] of Object.entries(s.counsel)) if (ok(id) && typeof v === "number" && Number.isFinite(v)) out.counsel[id] = Math.min(v, t);
  out.shoreUsed = !!s.shoreUsed; out.shoreDenied = !!s.shoreDenied && out.shoreUsed;
  if (s.deny && typeof s.deny === "object") for (const [id, v] of Object.entries(s.deny)) if (ok(id) && v && typeof v === "object") { const o = {}; for (const k of ["rest", "swap"]) if (typeof v[k] === "number" && Number.isFinite(v[k])) o[k] = Math.min(v[k], t); if (Object.keys(o).length) out.deny[id] = o; }
  if (s.n && typeof s.n === "object") for (const k of Object.keys(out.n)) if (Number.isFinite(s.n[k])) out.n[k] = Math.max(0, Math.floor(s.n[k]));
  p.care = out;
}
addHardener(hardenCare);
