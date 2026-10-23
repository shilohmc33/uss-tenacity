// Crew needs N3 (notes/2026-10-22-crew-needs-plan.md §3): medium and major incidents driven by mood band + stress hours.
// Medium (Stressed, stress >= 1 h): a lounge argument, refusing an order (their station at 70% for 2 h), reporting sick
// ("unwell": off duty resting; NOT an injury, never touches injuries.js). Major (Breaking, stress >= 4 h): a breakdown
// (off duty 1 ship's day), insubordination (an Opinion hit with the Lt, captain's mast), or rarely a deliberately mis-set
// console that spawns an ordinary LOW/MEDIUM fault at their station (never CRITICAL, never an injury).
// Safeguards: seen only (!offRules() && isPresent(), not in battle, not in the quiet period), nothing above minor in the
// first 7 play days, 1 medium per ship's day and 1 major per 5 ship's days ship-wide, gentle mode turns majors off.
// The Lt's response rides the odd-job slot (oddjobs.js, kind "incident"): it shows on the alert pill / DUTY list / deck,
// he walks there and talks it through for ~10 s. Left alone, it plays out (Hale breaks up the scuffle, T'Ren holds mast).
import { G } from "./state.js";
import { MOOD, offRules, isPresent } from "./pacing.js";
import { PROG, nudge, addr } from "./progression.js";
import { SLOTMAP, pr } from "./roster.js";
import { DECKS, NODEMAP } from "./data.js";
import { log, toast, cheerful } from "./bus.js";
import { needsOf } from "./needs.js";
import { quirksOf, hasQ, moodlet, STATION_CREW } from "./mood.js";
// no static import of faults.js / oddjobs.js (their top level touches progression hooks; importing them here broke load order)
export function bindSpawn(f) { bindSpawn.f = f; }   // faults.js registers spawnFault
const spawnFault = (...a) => bindSpawn.f ? bindSpawn.f(...a) : null;
const J = () => G.prog.jobs || (G.prog.jobs = { next: PROG.jobs.firstAt, active: null, n: 0, done: 0, xp: 0, expired: 0 });

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pick = a => a[Math.floor(Math.random() * a.length)];
const rr = ([a, b]) => a + Math.random() * (b - a);
const now = () => (G.ship && G.ship.elapsed) || 0;
const P = () => G.prog;
const occ = id => P().crew.occ[id];
const nm = id => { const o = occ(id); return o ? o.short : "A crewmember"; };
const I = () => { const p = P(); if (!p.inc || typeof p.inc !== "object") p.inc = { lastMed: -1e12, lastMaj: -1e12, n: { medium: 0, major: 0, helped: 0 } }; return p.inc; };
const injured = () => new Set(((P().med && P().med.inj) || []).map(x => x.id));
// where the Lt goes to talk to someone: their usual post
function postOf(id) {
  const o = occ(id), sl = o && SLOTMAP[o.slot]; if (!sl) return "mess";
  const n = sl.deck === "bridge" ? (sl.dept === "sec" ? "tactical" : sl.dept === "sci" ? "science2" : "ops") : sl.deck === "engineering" ? "core" : sl.deck === "medical" ? "biobed" : sl.deck === "lounge" ? "bar" : "mess";
  return NODEMAP[n] ? n : "mess";
}
export const seenGate = () => !offRules() && isPresent() && cheerful() && !G.sp.battle;
export const activeIncident = () => { const a = J().active; return a && a.kind === "incident" ? a : null; };
function post(job) {
  const k = PROG.jobs, j = J();
  Object.assign(job, { kind: "incident", deck: NODEMAP[job.node].deck, t: k.expire, dur: k.expire, need: rr(MOOD.workS), acc: 0, id: ++j.n });
  const old = j.active, L = G.lt;
  if (old && old.kind !== "incident") {   // P29 #6: an incident outranks an odd job; stop his walk to it and say so
    const it = L.intent, toOld = x => x && x.kind === "use" && x.node === old.node;
    if (toOld(it) || (it && it.kind === "liftRide" && toOld(it.then))) { L.intent = null; L.path = null; L.mode = "idle"; }
    if (L.lift && toOld(L.lift.then)) L.lift.then = null;   // P29b: riding the lift to it: arrive and stand by instead
    log(`Odd job dropped — ${old.label.replace(/^./, c => c.toLowerCase())}. A crew incident needs you more.`, "comm");
  }
  j.active = job;
  toast(`Crew incident — ${DECKS[job.deck].name}: ${job.label}`, "warn");
}
// ---- text helpers: each crewmember's own pronouns (P29 #1); a third party is never the subject (P29 #2) ----
const S = id => pr(occ(id), "sub"), O = id => pr(occ(id), "obj"), Ps = id => pr(occ(id), "pos"), V = (id, they, it) => pr(occ(id), "s") ? it : they;
const Cap = t => t.replace(/^./, c => c.toUpperCase());
const ROLE = { security: "tactical", captain: "co", doctor: "doctor", chief: "chief-engineer" };
function respId(role, ...not) {   // the officer who steps in; falls back to another senior when the usual one is involved
  const inj = injured();
  for (const sl of [ROLE[role], "tactical", "co", "chief-engineer", "science", "doctor"]) { const id = P().crew.slots[sl]; if (id && occ(id) && !not.includes(id) && !inj.has(id) && !(needsOf(id).unwell > now())) return id; }
  return null;
}
const resp = (role, ...not) => { const id = respId(role, ...not); return id ? nm(id) : "The duty officer"; };
const MAST = { tren: "'Logical.'", hale: "'Good. I hate paperwork.'", okafor: "'Right. Back to work.'", diallo: "'Noted. We'll say no more about it.'" };   // P29b: flavor per officer
const NO_ARGUE = new Set(["doctor"]);   // P29b: Dr. Orvin never brawls in the Mess
export function checkIncident(a) { return !!(occ(a.who) && (a.inc !== "argument" || occ(a.other))); }   // P29b: the crewmember left the ship -> drop it
// ---- medium ----
function argument(id) {
  const inj = injured(); if (SLOTMAP[occ(id).slot].senior || NO_ARGUE.has(occ(id).slot)) return false;   // seniors don't brawl in the Mess
  const others = Object.values(P().crew.slots).filter(o => o && o !== id && occ(o) && !inj.has(o) && !hasQ(o, "vulcan") && !(needsOf(o).unwell > now()) && !SLOTMAP[occ(o).slot].senior && !NO_ARGUE.has(occ(o).slot));
  if (!others.length) return false;
  const o = pick(others), until = now() + MOOD.major.breakdownS;
  needsOf(id).argue = until; needsOf(o).argue = until;   // both walk to the Mess & Bar (needs.js: act "fun") so the Lt finds them there
  log(`Raised voices in the Mess: ${nm(id)} and ${nm(o)} are squaring up over a spilled tray. It's about more than the tray.`, "warn");
  post({ inc: "argument", who: id, other: o, node: "bar", short: nm(id), label: `Break up ${nm(id)} and ${nm(o)}'s argument` });
  return true;
}
function refuse(id) {
  const r = needsOf(id); r.refuse = now() + MOOD.medium.refuseS;
  log(`${nm(id)} flatly refuses a routine order — 'Find someone else.' ${Cap(Ps(id))} station runs at reduced effort (${Math.round(MOOD.medium.refuseEff * 100)}%).`, "warn");
  post({ inc: "refuse", who: id, node: postOf(id), short: nm(id), label: `Talk ${nm(id)} round` });
  return true;
}
function unwell(id) {
  const r = needsOf(id); r.unwell = now() + MOOD.medium.unwellS;
  log(`${nm(id)} reports to sickbay 'unwell'. ${resp("doctor", id)} finds nothing wrong a few quiet hours won't fix and signs ${O(id)} off duty to rest in ${Ps(id)} quarters.`, "comm");
  post({ inc: "unwell", who: id, node: "bunk", short: nm(id), label: `Look in on ${nm(id)} in ${Ps(id)} quarters` });
  return true;
}
// ---- major ----
function breakdown(id) {
  const r = needsOf(id); r.unwell = now() + MOOD.major.breakdownS;
  log(`${nm(id)} breaks down at ${Ps(id)} post — shaking, unable to go on. ${resp("doctor", id)} takes ${O(id)} off duty for a full ship's day; ${S(id)} ${V(id, "are", "is")} resting in ${Ps(id)} quarters.`, "fault");
  post({ inc: "breakdown", who: id, node: "bunk", short: nm(id), label: `Sit with ${nm(id)} in ${Ps(id)} quarters` });
  return true;
}
function insub(id) {
  if (occ(id).slot === "co") return false;   // nobody holds mast on the captain
  nudge(id, MOOD.major.insubOp, "insubordination", true);
  log(`${nm(id)} tells you exactly what ${S(id)} ${V(id, "think", "thinks")} of junior lieutenants, in front of the whole section. ${resp("captain", id)} will hold captain's mast.`, "fault");
  post({ inc: "insub", who: id, node: postOf(id), short: nm(id), label: `Talk it out with ${nm(id)} before mast` });
  return true;
}
function misset(id) {
  const o = occ(id), sl = o && o.slot, systems = Object.entries(STATION_CREW).filter(([s, sls]) => sls.includes(sl) && !G.ship.faults[s]).map(([s]) => s);
  if (!systems.length) return false;
  const sys = pick(systems); spawnFault("incident", sys, Math.random() < 0.6 ? "low" : "med"); if (!G.ship.faults[sys]) return false;
  if (G.ship.faults[sys].sev === "crit") G.ship.faults[sys].sev = "med";   // belt and braces: never CRITICAL
  log(`${resp("chief", id)}, grim: 'That wasn't wear. Someone mis-set that console on purpose.' The log points to ${nm(id)}.`, "fault");
  post({ inc: "misset", who: id, node: postOf(id), short: nm(id), label: `Find out what's eating ${nm(id)}` });
  return true;
}
// ---- the roll (from mood.js tickMood, after the minor roll; h = ship hours this step) ----
export function rollIncident(id, r, h) {
  if (!seenGate() || activeIncident() || (P().playDays | 0) < MOOD.graceDays) return;
  const inc = I(), t = now(), q = quirksOf(id);
  if (r.unwell > t || r.refuse > t || injured().has(id)) return;
  const gentle = !!(P().med && P().med.gentle);
  if (!gentle && r.band >= 4 && (r.stress || 0) >= MOOD.major.stressH && t - inc.lastMaj >= MOOD.major.gapS && Math.random() < MOOD.major.perHour * h) {
    const roll = Math.random(), ok = (roll < MOOD.major.misset ? misset(id) || insub(id) : roll < 0.55 ? false : insub(id)) || breakdown(id);
    if (ok) { inc.lastMaj = t; inc.n.major++; return; }
  }
  if (r.band >= 3 && (r.stress || 0) >= MOOD.medium.stressH && t - inc.lastMed >= MOOD.medium.gapS && Math.random() < MOOD.medium.perHour * h * (q.includes("shortfuse") ? 2 : 1)) {
    const roll = Math.random(), ok = roll < 0.4 && !q.includes("vulcan") ? argument(id) || refuse(id) : roll < 0.7 ? refuse(id) : unwell(id);
    if (ok) { inc.lastMed = t; inc.n.medium++; }
  }
}
// ---- the Lt's response (oddjobs.js calls these for kind "incident") ----
const calm = id => { const r = needsOf(id); r.stress = (r.stress || 0) * 0.5; };
const unArgue = a => { for (const x of [a.who, a.other]) if (x && P().needs && P().needs[x]) delete P().needs[x].argue; };
export function resolveIncident(a) {
  const id = a.who, r = needsOf(id), A = MOOD.helpOp; I().n.helped++;
  if (a.inc === "argument") { unArgue(a); for (const x of [id, a.other]) { moodlet(x, "talked"); calm(x); nudge(x, A, "incident"); }
    log(`You step between ${nm(id)} and ${nm(a.other)}, get them talking instead of shouting, and buy the next round of raktajino. It's over.`, "good"); }
  else if (a.inc === "refuse") { delete r.refuse; moodlet(id, "talked"); calm(id); nudge(id, A, "incident");
    log(`${nm(id)} hears you out. 'Fine. You're right — it's not the job, it's everything else.' Back at full effort.`, "good"); }
  else if (a.inc === "unwell") { r.unwell = Math.min(r.unwell || 0, now() + 3600); r.stress = 0; moodlet(id, "talked"); nudge(id, A, "incident");
    log(`You sit with ${nm(id)} for a while. Nothing medical, just a long week. ${Cap(S(id))}'ll be back on duty within the hour.`, "good"); }
  else if (a.inc === "breakdown") { r.unwell = Math.min(r.unwell || 0, now() + MOOD.major.breakdownS / 2); r.stress = 0; moodlet(id, "heard"); nudge(id, A + 1, "incident");
    log(`You stay with ${nm(id)} until the shaking stops. ${resp("doctor", id)} halves ${Ps(id)} time off duty: 'Whatever you said, keep saying it, ${addr()}.'`, "good"); }
  else if (a.inc === "insub") { nudge(id, -MOOD.major.insubOp + A, "incident", true); moodlet(id, "heard"); calm(id);
    { const c = respId("captain", id); log(`${nm(id)} apologises before ${c ? nm(c) : "the captain"} has to ask. The mast is dismissed. ${(c && MAST[occ(c).id || c]) || MAST[c] || "'Dismissed.'"}`, "good"); } }
  else if (a.inc === "misset") { moodlet(id, "heard"); calm(id); nudge(id, A, "incident");
    log(`${nm(id)} admits it: ${S(id)} wanted someone to notice how close to the edge ${S(id)} ${V(id, "are", "is")}. You noticed. ${resp("chief", id)} keeps it off the record.`, "good"); }
  toast(`Incident resolved — ${a.short}`, "good");
}
export function expireIncident(a) {
  const id = a.who;
  if (a.inc === "argument") { unArgue(a); for (const x of [id, a.other]) moodlet(x, "scuffle"); log(`${resp("security", id, a.other)} wades in and breaks up ${nm(id)} and ${nm(a.other)} before it turns into a scuffle. Both get extra duty shifts.`, "comm"); }
  else if (a.inc === "insub") { needsOf(id).stress = (needsOf(id).stress || 0) * 0.75; log(`Captain's mast: ${resp("captain", id)} gives ${nm(id)} a formal reprimand. It goes in the record.`, "comm"); }
  else if (a.inc === "refuse") log(`${nm(id)} works the shift out at reduced effort. Nobody says anything; everybody notices.`, "comm");
  else log(`${nm(id)} rests it off alone.`, "comm");
}
const INCS = ["argument", "refuse", "unwell", "breakdown", "insub", "misset"];
export function hardenInc(p) {
  const s = p.inc && typeof p.inc === "object" ? p.inc : {}, n = s.n && typeof s.n === "object" ? s.n : {}, f = v => typeof v === "number" && Number.isFinite(v);
  const t = now(), cd = v => f(v) ? Math.min(v, t) : -1e12, c = v => f(v) ? clamp(Math.floor(v), 0, 1e6) : 0;   // P29 #7: no future cooldowns, no negative counts
  p.inc = { lastMed: cd(s.lastMed), lastMaj: cd(s.lastMaj), n: { medium: c(n.medium), major: c(n.major), helped: c(n.helped) } };
  const j = p.jobs, a = j && j.active, aboard = new Set(p.crew && p.crew.slots ? Object.values(p.crew.slots).filter(Boolean) : []);
  if (a && typeof a === "object" && a.kind === "incident") {   // unknown crew / unknown spot / bad timers: drop it
    const okT = [a.t, a.dur, a.need, a.acc].every(f);
    if (!INCS.includes(a.inc) || !aboard.has(a.who) || (a.inc === "argument" && !aboard.has(a.other)) || !NODEMAP[a.node] || !okT) j.active = null;
    else { a.deck = NODEMAP[a.node].deck; a.dur = clamp(a.dur, 1, PROG.jobs.expire); a.t = clamp(a.t, 0, a.dur); a.need = clamp(a.need, 1, 60); a.acc = clamp(a.acc, 0, a.need); }
  }
}
