// Crew needs phase N2 (notes/2026-10-22-crew-needs-plan.md §2-5, §8 skills): mood from needs + quirks + timed moodlets,
// bands with hysteresis, stress hours, minor incidents (Strained or worse; online only, capped ship-wide), station
// efficiency 0.85-1.05 (feeds repair speed), bridge officers' cooldown speed (at most -10%) and the four skills.
// Everything rides on the needs record (G.prog.needs[id]: mood, band, stress, ml, wins, slip) and G.prog.skills (save v15,
// additive; hardenNeeds / hardenSkills fill defaults). Quirks are derived (START_QUIRKS / tags), never saved.
import { G } from "./state.js";
import { MOOD, HOLO, isPresent } from "./pacing.js";
import { PROG } from "./progression.js";
import { QUIRKS, START_QUIRKS, TAG_QUIRK, SLOTMAP } from "./roster.js";
import { needsOf, NEED_KEYS } from "./needs.js";
import { log, cheerful } from "./bus.js";
import { rollIncident } from "./incidents.js";

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const hash = id => { let h = 2166136261; for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const now = () => (G.ship && G.ship.elapsed) || 0;
const occ = id => G.prog && G.prog.crew && G.prog.crew.occ ? G.prog.crew.occ[id] : null;
const aboard = () => { const C = G.prog && G.prog.crew; return C && C.slots ? Object.values(C.slots).filter(id => id && C.occ[id]) : []; };
const injured = () => new Set(((G.prog.med && G.prog.med.inj) || []).map(x => x.id));

// ---- quirks ----
const qCache = new Map();
export function quirksOf(id) {
  const o = occ(id); if (!o) return [];
  if (Array.isArray(o.quirks)) return o.quirks.filter(q => QUIRKS[q]);
  if (START_QUIRKS[id]) return START_QUIRKS[id];
  if (qCache.has(id)) return qCache.get(id);
  const h = hash(id), tq = (o.tags || []).map(t => TAG_QUIRK[t]).filter(Boolean), keys = Object.keys(QUIRKS);
  const a = tq[0] || keys[h % keys.length], b = tq[1] && tq[1] !== a ? tq[1] : keys[(h >>> 8) % keys.length];
  const out = (h >>> 16) % 2 && b !== a ? [a, b] : [a]; qCache.set(id, out); return out;
}
export const hasQ = (id, q) => quirksOf(id).includes(q);
export const quirkNames = id => quirksOf(id).map(q => QUIRKS[q].name);

// ---- skills (0-10): the Lt ("lt") and every crewmember ----
export const SKILL_KEYS = ["tactical", "engineering", "fitness", "composure"];
export const SKILL_LABEL = { tactical: "Tactical", engineering: "Engineering", fitness: "Fitness", composure: "Composure" };
const allSkills = () => { const p = G.prog; if (!p.skills || typeof p.skills !== "object" || Array.isArray(p.skills)) p.skills = {}; return p.skills; };
const skillRec = id => { const S = allSkills(); return S[id] || (S[id] = { tactical: 0, engineering: 0, fitness: 0, composure: 0 }); };
export const levelOfXp = xp => { let L = 0; while (L < MOOD.skill.max && xp >= 50 * (L + 1) * (L + 2)) L++; return L; };
export const skillLvl = (id, k) => { const S = G.prog && G.prog.skills, r = S && S[id]; return r ? levelOfXp(r[k] || 0) : 0; };
export function addSkillXp(id, k, n) {
  if (!id || !SKILL_KEYS.includes(k) || !(n > 0)) return;
  const r = skillRec(id), L0 = levelOfXp(r[k]); r[k] = Math.min(r[k] + n, 50 * MOOD.skill.max * (MOOD.skill.max + 1));
  const L1 = levelOfXp(r[k]);
  if (L1 > L0 && id === "lt") log(`Your ${SKILL_LABEL[k]} skill rises to ${L1}.`, "good");
}
export function hardenSkills(p) {
  if (!p) return;
  const src = p.skills && typeof p.skills === "object" && !Array.isArray(p.skills) ? p.skills : {}, out = {};
  const keep = new Set(["lt", ...(p.crew && p.crew.slots ? Object.values(p.crew.slots).filter(Boolean) : [])]);
  const cap = 50 * MOOD.skill.max * (MOOD.skill.max + 1);
  for (const [id, r] of Object.entries(src)) {
    if (!keep.has(id) || !r || typeof r !== "object") continue;
    out[id] = {}; for (const k of SKILL_KEYS) { const v = r[k]; out[id][k] = typeof v === "number" && Number.isFinite(v) ? clamp(Math.floor(v), 0, cap) : 0; }
  }
  p.skills = out;
}
const DEPT_SKILL = { eng: "engineering", sec: "tactical", command: "tactical", ops: "composure", sci: "composure", med: "composure", svc: "composure" };

// ---- moodlets ----
// value scaled by quirks when added: Vulcan calm x0.5; Green x1.5 for battle (until the 3rd win); Old hand x0.6 for battle/loss
const BATTLE = new Set(["win", "disengage", "tow", "injury", "death", "allyLost", "keralaLost"]);
export function moodlet(id, key, opts = {}) {
  const def = MOOD.mlet[key]; if (!def || !occ(id)) return;
  const r = needsOf(id), q = quirksOf(id); let v = opts.v != null ? opts.v : def[0];
  if (key === "win" && q.includes("shortfuse")) v = 10;
  if (BATTLE.has(key)) { if (q.includes("green") && (r.wins || 0) < 3) v *= 1.5; if (q.includes("oldhand") && v < 0) v *= 0.6; }   // P28: Old hand dampens the bad, not the good
  if (key === "chat" && q.includes("butterfly")) v *= 2;
  if (q.includes("vulcan")) v *= 0.5;
  const t0 = now(), t1 = t0 + def[1] * PROG.dayLength;
  r.ml = (Array.isArray(r.ml) ? r.ml : []).filter(m => m.k !== key);
  r.ml.push({ k: key, v: Math.round(v * 10) / 10, t0, t1 });
  if (r.ml.length > MOOD.maxMlets) r.ml.splice(0, r.ml.length - MOOD.maxMlets);
}
export function moodAll(key, opts = {}) {
  const inj = injured();
  for (const id of aboard()) { if (opts.skip && opts.skip.includes(id)) continue; if (opts.skipInjured !== false && inj.has(id) && key !== "death") continue;
    moodlet(id, key, opts); if (key === "win") { const r = needsOf(id); r.wins = (r.wins || 0) + 1; } }
}
const mletSum = r => { if (!Array.isArray(r.ml) || !r.ml.length) return 0; const t = now(); let s = 0;
  r.ml = r.ml.filter(m => t < m.t1); for (const m of r.ml) s += m.v * clamp(1 - (t - m.t0) / Math.max(1, m.t1 - m.t0), 0, 1); return s; };

// ---- mood, band, efficiency ----
export function moodValue(id, r = needsOf(id)) {
  const q = quirksOf(id), W = MOOD.w; let sw = 0, s = 0;
  for (const k of NEED_KEYS) { let w = W[k]; if (k === "food" && q.includes("gourmand")) w *= 1.5; if (k === "social" && q.includes("loner")) w *= 0.5; sw += w; s += w * r.n[k]; }
  let m = s / sw + mletSum(r);
  if (q.includes("devout")) m += 5;
  if (q.includes("oldhand") || q.includes("green")) { const want = q.includes("oldhand") ? "green" : "oldhand"; if (aboard().some(o => o !== id && hasQ(o, want))) m += 2; }   // mentoring
  return clamp(m, 0, 100);
}
const rawBand = m => { const B = MOOD.bands; let b = 0; while (b < B.length && m < B[b]) b++; return b; };
function nextBand(prev, m) {
  const raw = rawBand(m); if (prev == null || raw >= prev) return raw;   // worsening applies at once
  let b = prev; while (b > 0 && m >= MOOD.bands[b - 1] + MOOD.hyst) b--;   // improving needs +5 over the line
  return b;
}
export const bandOf = id => { const r = G.prog && G.prog.needs && G.prog.needs[id]; return r && r.band != null ? r.band : 0; };
export const moodOf = id => { const r = G.prog && G.prog.needs && G.prog.needs[id]; return r && typeof r.mood === "number" ? r.mood : moodValue(id); };
export const bandLabel = b => MOOD.label[b] || MOOD.label[0];
export function effOf(id) {
  const E = MOOD.eff, m = moodOf(id);
  return m >= 60 ? 1 + (E.hi - 1) * clamp((m - 60) / 40, 0, 1) : E.lo + (1 - E.lo) * clamp(m / 60, 0, 1);
}
// which roster slots man each engineering system (all faults are on the engineering deck)
export const STATION_CREW = { warpcore: ["chief-engineer", "engineer-1"], coolant: ["engineer-1", "engineer-2"], eps: ["engineer-2", "chief-engineer"],
  shields: ["engineer-1", "tactical"], phasers: ["tactical", "security"], loader: ["security", "engineer-2"], transporter: ["transporter"] };
const holoBuff = (id, sys, t) => { const b = G.prog.holo && G.prog.holo.buffs && G.prog.holo.buffs[id]; if (!b || !(b.t1 > t)) return 0;   // N4 holodeck buffs (no stacking: one per person)
  return b.k === "sharp" ? HOLO.sharp : b.k === "drilled" && HOLO.drilledSys.includes(sys) ? HOLO.drilled : 0; };
export function stationEff(sys) {
  const C = G.prog && G.prog.crew, slots = STATION_CREW[sys]; if (!C || !C.slots || !slots) return 1;
  const inj = injured(), t = now(); let s = 0, n = 0, slip = 0;
  for (const sl of slots) { const id = C.slots[sl]; if (!id || !C.occ[id] || inj.has(id)) continue; const r = G.prog.needs && G.prog.needs[id]; s += holoBuff(id, sys, t) + effOf(id) * (r && r.unwell > t ? MOOD.medium.unwellEff : r && r.refuse > t ? MOOD.medium.refuseEff : 1); n++;   /* P29 #9: off duty counts at half */ if (r && r.slip > t) slip++; }   // N3: refusing an order -> 70%
  return n ? clamp(s / n - slip * MOOD.eff.slip, MOOD.medium.unwellEff * MOOD.eff.lo - MOOD.eff.slip, MOOD.eff.hi) : 1;
}
// bridge officers' ability cooldown speed (battle.js tickAbilities): mood 0.9-1.05, +1% per Tactical level, max 1.1
export const AB_OWNER = { pattern: "co", scan: "science", spread: "tactical", miracle: "chief-engineer" };
export function cdRate(ab) {
  const C = G.prog && G.prog.crew, id = C && C.slots ? C.slots[AB_OWNER[ab]] : null; if (!id || !C.occ[id]) return 1;
  const D = MOOD.cd, e = (effOf(id) - MOOD.eff.lo) / (MOOD.eff.hi - MOOD.eff.lo);
  return clamp((D.lo + (D.hi - D.lo) * e) * (1 + 0.01 * skillLvl(id, "tactical")), D.lo, D.max);
}
export const ltRepairSkill = () => (1 + 0.02 * skillLvl("lt", "engineering")) * (holoBuff("lt", "", now()) ? 1 + HOLO.sharp : 1);   // N4: "Sharp" from the warp core drill

// ---- minor incidents (Strained or worse) ----
const GRUMBLE = ["{n} is heard grumbling about the replicator coffee.", "{n} snaps at a console that wasn't doing anything wrong.", "{n} mutters that this tour will never end.",
  "{n} sighs loudly through the whole duty briefing."];
const SLACK = ["{n} turns up late to post, looking worn out.", "{n} lingers in the corridor instead of reporting to station."];
const SLIP = ["{n} fumbles a routine calibration; the station runs a little rough for an hour.", "{n} misses a step in a diagnostic and has to start over."];
const pick = a => a[Math.floor(Math.random() * a.length)];
function minorIncident(id, r) {
  const o = occ(id), name = o ? o.short : "A crewmember", roll = Math.random(), t = now(), I = G.prog.moodInc || (G.prog.moodInc = { last: -1e9, n: 0 });
  I.last = t; I.n = (I.n || 0) + 1;
  if (roll < 0.4) log(pick(GRUMBLE).replace("{n}", name), "comm");
  else { r.slip = t + MOOD.minor.slipS; log(pick(roll < 0.7 ? SLACK : SLIP).replace("{n}", name), "warn"); }
}

// ---- the step (called from needs.js tickNeeds every NEEDS.stepS, h = hours of ship time) ----
export function tickMood(id, r, h, on) {
  const m = moodValue(id, r); r.mood = Math.round(m * 10) / 10; r.band = nextBand(r.band, m);
  const S = MOOD.stress;
  if (m < S.below) r.stress = (r.stress || 0) + h * (1 - 0.04 * skillLvl(id, "composure")); else if (r.stress) r.stress = Math.max(0, r.stress - h * S.decay);
  const o = occ(id), dept = o && SLOTMAP[o.slot] ? SLOTMAP[o.slot].dept : null;
  if (r.act === "duty" && on) addSkillXp(id, DEPT_SKILL[dept] || "composure", MOOD.skill.duty * h);
  else if (r.act === "fun") addSkillXp(id, "fitness", MOOD.skill.fun * h);
  rollIncident(id, r, h);   // N3: medium / major (own gates and caps)
  if (!isPresent() || !cheerful() ||   // P28: nothing bad happens unseen (idle / away)
      r.band < 2 || G.sp.battle) return;
  const I = G.prog.moodInc; if (I && now() - I.last < MOOD.minor.gapS) return;
  if (Math.random() < MOOD.minor.perHour * h) minorIncident(id, r);
}
export function hardenMood(r, src) {
  if (typeof src.mood === "number" && Number.isFinite(src.mood)) r.mood = clamp(src.mood, 0, 100);
  if ([0, 1, 2, 3, 4].includes(src.band)) r.band = src.band;
  if (typeof src.stress === "number" && Number.isFinite(src.stress)) r.stress = clamp(src.stress, 0, MOOD.stress.cap);
  if (Number.isInteger(src.wins) && src.wins >= 0) r.wins = Math.min(src.wins, 9999);
  for (const k of ["slip", "refuse", "unwell", "argue"]) if (typeof src[k] === "number" && Number.isFinite(src[k])) r[k] = Math.min(src[k], now() + MOOD.major.breakdownS);   // N3 timers
  if (Array.isArray(src.ml)) r.ml = src.ml.filter(m => m && MOOD.mlet[m.k] && [m.v, m.t0, m.t1].every(x => typeof x === "number" && Number.isFinite(x)) && m.t1 > m.t0)
    .slice(-MOOD.maxMlets).map(m => { const d = MOOD.mlet[m.k], mx = Math.abs(d[0]) * 2, dur = Math.min(m.t1 - m.t0, d[1] * PROG.dayLength);   // P28: clamp to the defined max (x2 covers quirks)
      return { k: m.k, v: clamp(m.v, -mx, mx), t0: m.t0, t1: m.t0 + dur }; });
}
