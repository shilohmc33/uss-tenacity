// Phase 6: crew injuries and (rare, fair) deaths — built to the tester memo's safeguards (playtest/2026-10-17-
// design-progression.md §2 "Making deaths fair"). Tuning: PROG.deaths. Save: G.prog.med (v7).
//  1. No death before day 14 of play or before the player reaches Lt.
//  2. Tied to events only: a hull hit in battle while a CRITICAL fault is open, or a hazard event. The quiet daily
//     roll (crewlife.dailyRoll) never touches anyone's health.
//  3. Injured first, always: the crew member goes to a sickbay biobed (drawn on the Medical deck), shows 'Injured' on
//     the CREW sheet and gets a log line. Most injuries are minor and simply heal. A SERIOUS injury is tied to a ship's
//     system (the fault the hit opened, else coolant / EPS = sickbay power); fixing it inside the warning window saves
//     them (opinion jumps). Visiting them in sickbay and Excellent repairs meanwhile lower the risk if it isn't fixed.
//     Only an unresolved serious injury can end in a death.
//  4. Senior staff (T'Ren, Okafor, Diallo, Hale) are never killed (T'Ren is never hurt; the others: minor injuries only).
//  5. Favourites: the 2 regular crew with the highest opinion of you (or the 2 you pin on the CREW sheet) can't die —
//     worst case 'badly injured, transferred to a starbase hospital' (feeds Fleet Reputation like any transfer).
//  6. Memorial: a short Mess & Bar scene (T'Ren's eulogy, Hale's story, a plaque); attending raises the friends' opinion.
//  7. Gentle mode (CREW sheet, offered on first boot): a death becomes 'critically injured, evacuated to a hospital
//     ship' — same story, nobody is lost.
//  8. Caps: at most 1 death per PROG.deaths.gap days of play, and deaths count toward the crew-event caps
//     (PROG.crewEvents.perDay / perWeek), which they must fit inside.
//  Pass 06 HARD RULE: a death only ever resolves while the player is PRESENT (app visible, not offline, input in the
//  last 60 s) and is shown live on screen (the sickbay scene), never as a shift-report bullet.
//   (a) the clock starts only once the player has seen the alert (input after it appeared, or tapping it);
//   (b) it counts present time only: paused while hidden / locked / backgrounded / idle >= 60 s (night mode too);
//   (c) away or offline, the night crew + doctor ALWAYS stabilise the patient (no roll); if the system is still down
//       when the player returns, the window restarts fresh (180 s, needs seeing again);
//   (d) red medical alert pill with a cross + live countdown, vibrate + a short tone where available;
//   (e) window 180 s of present time.
//  Rate: when the system is restored live, Dr. Orvin operates (a short scene); a small chance she can't save them.
import { G } from "./state.js";
import { log, toast } from "./bus.js";
import { PROG, hooks, crewList, crewTouch, opinionOf, nudge, fullName, rankOf, addr, freshMed } from "./progression.js";
import { SLOTMAP, SPECIES, POSTINGS, pr, Pr } from "./roster.js";
import { SYSTEMS } from "./data.js";
import { PACE_RT, nightActive, isPresent, presentIdle } from "./pacing.js";
import { spawnFault } from "./faults.js";
import { transferOff, crewNote, crewCapsOk, medFx } from "./crewlife.js";
const secs = n => `${n} second${n === 1 ? "" : "s"}`;   // pass 08 (7)

const P = () => G.prog;
const K = () => PROG.deaths;
const rnd = ([a, b]) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const num0 = v => (Number.isFinite(+v) ? +v : 0);
export const M = () => P().med || (P().med = freshMed());
export const gentle = () => (M().gentle == null ? !!K().gentle : !!M().gentle);
export const injuryOf = id => M().inj.find(x => x.id === id) || null;
export const isInjured = id => !!injuryOf(id);
const docPron = (patient = null) => { const id = P().crew.slots.doctor, o = id && P().crew.occ[id]; return o && o.id !== patient ? pr(o) : "they"; };   // the duty medic is "they"   // pt07 m1: Orvin is they
export const docName = (patient = null) => { const id = P().crew.slots.doctor, o = id && P().crew.occ[id]; return o && o.id !== patient ? `Dr. ${o.short}` : "The duty medic"; };   // pass 08 (6b): never the patient themself
// the 2 protected favourites: the player's pins first, topped up with the highest opinions (regular crew; seniors are protected anyway)
export function favourites() {
  const list = crewList().filter(c => !c.senior && !c.protected), n = K().protectFavourites, m = M();
  const pinned = m.pins.filter(id => list.some(c => c.id === id)).slice(0, n);
  const partner = P().romance && P().romance.partner;   // phase 4 (Shiloh): a romance partner is NOT auto-protected; the player may still pin them
  const rest = list.filter(c => !pinned.includes(c.id) && c.id !== partner).sort((a, b) => opinionOf(b.id) - opinionOf(a.id)).map(c => c.id);
  return pinned.concat(rest).slice(0, n);
}
export function togglePin(id) {
  const m = M(), i = m.pins.indexOf(id);
  if (i >= 0) m.pins.splice(i, 1); else { m.pins.push(id); if (m.pins.length > K().protectFavourites) m.pins.shift(); }
  crewTouch(); return m.pins.includes(id);
}
export function setGentle(on) {
  const m = M(); m.gentle = !!on; m.asked = true;
  log(on ? "Gentle mode on: if the worst happens, a crewmate is critically injured and evacuated to a hospital ship — nobody is lost." : "Gentle mode off: serious injuries can, rarely, cost a life. Every safeguard stays in place.", "comm");
}
// ---- death eligibility (every safeguard in one place; crewlife.deathEligible delegates here) ----
export function deathCheck(id, cause, inj = null) {
  const p = P(), k = K(), c = crewList().find(x => x.id === id);
  if (!k.enabled) return { ok: false, why: "disabled" };
  if (!c) return { ok: false, why: "not aboard" };
  if (c.senior) return { ok: false, why: "senior" };
  if (c.protected) return { ok: false, why: "protected" };   // pt04 m7
  if (cause !== "battle" && cause !== "hazard") return { ok: false, why: "cause" };      // never the quiet daily roll
  if (inj && !(inj.sev === "serious" && (inj.state === "warning" || inj.state === "surgery"))) return { ok: false, why: "not a serious unresolved injury" };
  if (inj && cause === "battle" && !inj.crit) return { ok: false, why: "no critical fault" };   // memo: a battle death needs a hull hit while a CRITICAL fault was open
  if (p.playDays < k.noDeathsBefore) return { ok: false, why: "too early" };
  if (p.rank < k.minRank) return { ok: false, why: "rank" };
  if (!(num0(p.presentTotal) >= k.minPresentH * 3600)) return { ok: false, why: "too early" };   // pass 07: present hours, not just play days
  if (!isPresent()) return { ok: false, why: "not present" };                  // pass 06 hard rule
  if (inj && !inj.ack) return { ok: false, why: "unseen" };
  if (favourites().includes(id)) return { ok: false, why: "favourite" };
  if (gentle()) return { ok: false, why: "gentle" };
  const m = M(); if (m.lastDeathPD != null && p.playDays - m.lastDeathPD < k.gap) return { ok: false, why: "gap" };
  if (m.lastDeathPD != null && m.lastDeathPT != null && num0(p.presentTotal) - m.lastDeathPT < k.gapPresentH * 3600) return { ok: false, why: "gap" };
  if (!crewCapsOk()) return { ok: false, why: "caps" };
  return { ok: true };
}
medFx.deathCheck = deathCheck;
medFx.isInjured = isInjured;
// ---- injuries ----
function victimPool(deck) {
  return crewList().filter(c => !K().injury.never.includes(c.slot) && !isInjured(c.id)).map(c => ({ c, w: deck && c.deck === deck ? K().injury.deckWeight : 1 }));
}
function wpick(items) { const t = items.reduce((s, x) => s + x.w, 0); let r = Math.random() * t; for (const x of items) { r -= x.w; if (r <= 0) return x.c; } return items.length ? items[items.length - 1].c : null; }
// a serious injury hangs on a ship's system: the fault the hit opened, else coolant / EPS (sickbay power)
function linkSystem(cause, sys) {
  const F = G.ship.faults;
  if (sys && F[sys] && F[sys].sev !== "low") return sys;
  for (const s of K().linkSystems) if (F[s] && !M().inj.some(x => x.sys === s && x.state === "warning")) { if (F[s].sev === "low") { F[s].sev = "med"; F[s].cost = 1; } return s; }
  const free = K().linkSystems.filter(s => !F[s]);
  if (free.length) return spawnFault(cause === "battle" ? "battle" : "hazard", pick(free), "med");
  return null;
}
export function injure(cause, opts = {}) {
  const p = P(), k = K(), I = k.injury, m = M();
  if (!p.crew || !k.enabled) return null;
  if (m.inj.length >= I.maxOpen) return null;
  if (m.day.pd !== p.playDays) m.day = { pd: p.playDays, n: 0 };
  if (m.day.n >= I.perPlayDay) return null;
  const c = opts.id ? crewList().find(x => x.id === opts.id) : wpick(victimPool(opts.deck));
  if (!c || isInjured(c.id) || I.never.includes(c.slot)) return null;
  const S = k.serious;
  let sev = opts.sev || (Math.random() < (cause === "battle" ? (opts.crit ? S.battleCrit : S.battle) : S.hazard) ? "serious" : "minor");
  if ((c.senior && I.seniorMinorOnly) || c.protected) sev = "minor";   // protected crew (Thelev): minor injuries only, so never a hospital transfer either
  let sys = null;
  if (sev === "serious") { sys = linkSystem(cause, opts.sys); if (!sys) sev = "minor"; }
  const now = G.ship.elapsed, live = !PACE_RT.offline && !nightActive();
  const inj = { id: c.id, slot: c.slot, short: c.short, name: c.name, cause, what: opts.what || (cause === "battle" ? "a hit through the shields" : "a hazard"),
    sev, sys, state: sev === "serious" ? "warning" : "recovering", at: now, pd: p.playDays, day: p.day, left: k.window, seen: live, seenT: 0, offline: !!PACE_RT.offline, ack: false, acked: false, pendT: 0, ackT: 0, away: false,
    visited: false, excellent: 0, crewSave: Math.random() < k.crewStabilise, healAt: sev === "minor" ? now + rnd(k.heal.minor) : null, crit: !!opts.crit };
  m.inj.push(inj); m.day.n++; m.n.injuries++; m.n[sev]++; if (inj.offline) m.n.offlineInj++;
  crewTouch();
  const role = SLOTMAP[c.slot].role.split(" ·")[0];
  if (sev === "minor") {
    log(`Medical: ${c.name} (${role}) was hurt by ${inj.what} — ${docName(inj.id)} has ${pr(c, "obj")} on a biobed in sickbay. Minor; back on duty in a few hours.`, "fault");
    toast(`Injured — ${c.short} in sickbay (minor)`, "warn");
  } else {
    const sn = SYSTEMS[sys].name;
    log(`Medical alert: ${c.name} (${role}) was seriously hurt by ${inj.what} and is on a biobed in sickbay. ${docName(inj.id)}: 'I can hold ${pr(c, "obj")}, ${addr()}, but sickbay needs the ${sn} stable. Soon.'`, "fault");
    toast(`MEDICAL ALERT — ${c.short} · restore the ${sn}`, "crit");
    if (isPresent()) alertFx();
  }
  (hooks.crewInjured || []).forEach(f => f(inj));
  return inj;
}
function heal(inj, why) {
  const m = M(); m.inj = m.inj.filter(x => x !== inj); crewTouch();
  m.n.recovered++; (hooks.medEvent || []).forEach(f => f("healed", inj));   // plog journal
  if (P().crew.occ[inj.id]) log(`Medical: ${fullName(P().crew.occ[inj.id])} is discharged from sickbay and back at ${pr(P().crew.occ[inj.id], "pos")} post${why ? ` — ${why}` : ""}.`, "good");
}
// pass 06 (d): haptics + a short tone, only once the page has had a user gesture (no autoplay / vibrate interventions)
let actx = null;
export function alertFx() {
  const A = K().alert, ua = typeof navigator !== "undefined" && navigator.userActivation;
  if (!ua || !ua.hasBeenActive) return false;
  try { if (A.vibrate && navigator.vibrate) navigator.vibrate(A.vibrate); } catch (e) {}
  try {
    if (A.tone && typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext)) {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = actx.currentTime;
      for (const [f, at] of [[880, 0], [660, 0.18]]) { const o = actx.createOscillator(), g = actx.createGain(); o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0 + at); g.gain.exponentialRampToValueAtTime(0.12, t0 + at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.16); o.connect(g).connect(actx.destination); o.start(t0 + at); o.stop(t0 + at + 0.18); }
    }
  } catch (e) {}
  return true;
}
// pass 09 (2): the fast-fix clock starts on the FIRST acknowledgement only. A re-tap after leaving (or after a short
// hide under the return floor) re-arms the patient's clock but never restarts ackT, and ackT keeps running while the Lt
// is away/idle (only the patient's clock pauses), so leaving and re-tapping can never buy back the fast-fix bonus.
function firstAck(x) { if (!x.acked) { x.acked = true; x.ackT = 0; } x.ack = true; }
// the alert has been seen: tapping the pill / opening DUTY or CREW (UI calls this), or any input after it appeared
export function ackInjury(id = null) {
  let n = 0;
  if (!isPresent()) return 0;
  for (const x of M().inj) if (x.state === "warning" && !x.ack && (!id || x.id === id)) { firstAck(x); n++; }
  if (n) crewTouch();
  return n;
}
// the open serious warning the alert pill shows (soonest first)
export function alertInjury() {
  const w = M().inj.filter(x => x.state === "warning" && x.sys && G.ship.faults[x.sys]);
  return w.sort((a, b) => (b.ack - a.ack) || a.left - b.left)[0] || null;
}
function savedFx(inj, by, away) {
  const m = M(), k = K(); inj.state = "stable"; inj.healAt = G.ship.elapsed + rnd(k.heal.serious); inj.savedBy = by; m.n.saved++;
  const o0 = opinionOf(inj.id); P().opinions[inj.id] = Math.min(100, o0 + k.savedOpinion); const d = P().opinions[inj.id] - o0; crewTouch();   // a real jump: no diminishing returns, no daily cap
  return d;
}
// away / offline (c): the night crew restored the system and the doctor stabilised the patient. No roll, nobody lost.
function awaySave(inj) {
  const d = savedFx(inj, "crew", true); M().n.awaySaved = (M().n.awaySaved || 0) + 1;
  log(`While you were away, Okafor's night crew restored the ${SYSTEMS[inj.sys].name} and ${docName(inj.id)} stabilised ${inj.short}. '${inj.short} is going to make it — I kept ${pr(P().crew.occ[inj.id] || inj, "obj")} alive for you.' (${inj.short}'s opinion +${Math.max(1, Math.round(d))})`, "good");
  toast(`${inj.short} will pull through`, "good");
}
// live: the system is back — Dr. Orvin operates while the player watches (the outcome roll, PROG.deaths.surgery)
// pass 08 (4): the fast-fix multiplier eases with the seconds since the alert was answered (no cliff at 60 s)
export function fastMult(sec) {
  const S = K().surgery, a = S.fastFullS ?? S.fastS, b = S.fastEndS ?? S.fastS, u = b > a ? Math.min(1, Math.max(0, (num0(sec) - a) / (b - a))) : (num0(sec) <= a ? 0 : 1);
  return S.fastMult + (1 - S.fastMult) * u;
}
function toSurgery(inj, by) {
  const k = K(), S = k.surgery, F = G.ship.faults;
  let ch = S.chance;
  const own = by === "lt" && inj.ack && isPresent();   // pass 07: only the Lt's own fix, landing while the player is present (an idle / away clock is frozen, so it must not earn "fast")
  const fast = own && inj.ackT <= S.fastS;
  if (own) ch *= fastMult(inj.ackT);
  ch *= Math.pow(S.excellentMult, Math.min(S.excellentMax, inj.excellent || 0));
  if (inj.visited) ch *= S.visitMult;
  if (F.eps && F.eps.sev !== "low" && inj.sys !== "eps") ch *= S.epsOpenMult;
  if (isPresent()) inj.ack = true;   // pass 08 (2): they're watching the surgery scene, so it counts as seen (an auto-fix before the first tap can't leave a patient unkillable); set after 'fast', which still needs the player's own response
  inj.state = "surgery"; inj.surg = S.scene; inj.sx = Math.min(S.max, ch); inj.sx0 = inj.sx; inj.fast = fast; inj.assist = false; inj.savedBy = by; inj.held = !isPresent(); crewTouch();
  M().scene = surgScene(inj);
  log(`${SYSTEMS[inj.sys].name} restored ${by === "lt" ? `by the ${addr()}` : "by Okafor's team"} — sickbay has power. ${docName(inj.id)} takes ${inj.short} straight into surgery.`, "comm");
}
function surgScene(inj) { const o = P().crew.occ[inj.id]; return { id: inj.id, name: o ? fullName(o) : String(inj.name || "a crewmate"), short: o ? o.short : String(inj.short || "the patient"), sys: inj.sys, phase: "surgery", fast: !!inj.fast, exc: inj.excellent || 0, visited: !!inj.visited, by: inj.savedBy, assist: !!inj.assist }; }
// pass 07 (4): the odds as a band (live; updates as factors land)
export function oddsBand(sx) { const B = K().surgery.bands; return sx <= B.good ? "good chance" : sx <= B.touch ? "touch and go" : "grim"; }
export function surgeryOdds() { const s = M().scene, x = s && M().inj.find(i => i.id === s.id && i.state === "surgery"); return x ? { sx: x.sx, band: oddsBand(x.sx), assist: !!x.assist, held: !!x.held } : null; }
// pass 07 (4): one tap to assist Dr. Orvin (hold power to the biobed, hand over instruments): lowers the risk once per surgery
export function assistSurgery() {
  const s = M().scene, x = s && M().inj.find(i => i.id === s.id && i.state === "surgery");
  if (!x || x.assist || !isPresent()) return false;
  x.assist = true; x.sx = Math.min(K().surgery.max, x.sx * K().surgery.assistMult); s.assist = true; M().n.assists = (M().n.assists || 0) + 1; crewTouch();
  log(`The ${addr()} takes the instrument tray and keeps the biobed's power steady. ${docName(x.id)} doesn't look up: 'Good. Stay right there.'`, "comm");
  return true;
}
function surgeryOutcome(inj) {
  const m = M(), grave = Math.random() < inj.sx, chk = deathCheck(inj.id, inj.cause, inj);
  if (grave && chk.ok) { die(inj, "surgery"); return "death"; }
  if (grave && (chk.why === "favourite" || chk.why === "gentle") && crewCapsOk()) { evacuate(inj, chk.why); return "transfer"; }
  const d = savedFx(inj, inj.savedBy || "lt");
  if (grave) m.n.closeCalls = (m.n.closeCalls || 0) + 1;
  m.scene = { ...(m.scene || {}), id: inj.id, name: inj.name, short: inj.short, phase: "saved", d: Math.max(1, Math.round(d)), close: grave, docPr: docPron(inj.id) };
  log(`${docName(inj.id)} steps out of surgery: '${inj.short} is going to make it.'${grave ? ` It was closer than ${docPron(inj.id)} ${docPron(inj.id) === "they" ? "let" : "lets"} on.` : ""} (${inj.short}'s opinion +${Math.max(1, Math.round(d))})`, "good");
  toast(`${inj.short} will pull through`, "good");
  return "saved";
}
function evacuate(inj, why) {
  const m = M(), hosp = why === "favourite" ? "hospital" : "hospitalship";
  m.inj = m.inj.filter(x => x !== inj); m.n[why === "favourite" ? "hospital" : "evac"]++;
  const o = P().crew.occ[inj.id] || inj, S = Pr(o), they = S === "They";   // pt07 m1: the patient's own pronoun
  log(why === "favourite" ? `${inj.name} is badly injured — ${docName(inj.id)} arranges a transfer to ${POSTINGS[hosp].name} for specialist care. ${S}'ll recover there.`
    : `${inj.name} is critically injured and evacuated to ${POSTINGS[hosp].name}. ${docName(inj.id)}: '${S}${they ? "'re" : "'s"} in the best hands in the quadrant now.'`, "comm");
  m.scene = { id: inj.id, name: inj.name, short: inj.short, phase: why === "favourite" ? "hospital" : "evac", post: POSTINGS[hosp].name, pron: o.pronoun || "they" };
  transferOff(inj.id, hosp, why === "favourite" ? "hospital" : "evac");
}
// the warning window ran out with the system still faulted: the outcome (death only if every safeguard allows)
function resolve(inj) {
  const m = M(), k = K(), F = G.ship.faults;
  let ch = k.deathChance * (inj.visited ? k.visitMult : 1) * Math.pow(k.excellentMult, Math.min(k.excellentMax, inj.excellent));
  if (F.eps && F.eps.sev !== "low" && inj.sys !== "eps") ch *= k.epsOpenMult;               // sickbay power down too
  ch = Math.min(k.maxChance, ch);
  const grave = Math.random() < ch, chk = deathCheck(inj.id, inj.cause, inj);
  if (grave && chk.ok) return die(inj, "expired");
  if (grave && (chk.why === "favourite" || chk.why === "gentle") && crewCapsOk()) { evacuate(inj, chk.why); return "transfer"; }
  inj.state = "stable"; inj.healAt = G.ship.elapsed + rnd(k.heal.pulled); m.n.pulled++; crewTouch(); (hooks.medEvent || []).forEach(f => f("stable", inj));
  m.scene = { id: inj.id, name: inj.name, short: inj.short, phase: "expired" };
  log(`${inj.name} pulls through a long night in sickbay — ${docName(inj.id)} never left the biobed. Recovery will take a while.`, "comm");
  return "pulled";
}
const MEMORIAL = [
  "In memoriam: {name}, {role}. {short} served the Tenacity with quiet courage. The duty roster carries {pos} name until the end of the watch.",
  "Ship's log: {name}, {species}, {role} — lost in the line of duty on stardate {sd}. Captain T'Ren records the entry herself.",
  "{name} did not survive {pos} injuries. {crew} leaves a light burning at {short}'s station tonight.",
  "The Tenacity has lost {name}, {role}. The ship goes quiet for a while. Somewhere a letter home is being written, carefully.",
];
// pass 06 m4: the department's own people
const DEPT_CREW = { eng: "Okafor's engineering crew", sec: "The security section", ops: "The operations crew", sci: "The science section", med: "The sickbay staff", svc: "The mess staff", command: "The bridge crew" };
function die(inj, how = "expired") {
  const p = P(), m = M(), k = K(), cr = p.crew, o = cr.occ[inj.id]; if (!o) return null;
  if (!isPresent()) { m.n.blockedAway = (m.n.blockedAway || 0) + 1; return null; }   // pass 06 hard rule backstop (deathCheck already refuses)
  const sl = SLOTMAP[o.slot], sd = G.ship.stardate.toFixed(1), sp = (SPECIES[o.species] || SPECIES.human).name;
  const audit = { pd: p.playDays, day: p.day, rank: p.rank, id: o.id, senior: !!sl.senior, prot: !!o.protected, fav: favourites().includes(o.id), gap: m.lastDeathPD == null ? null : p.playDays - m.lastDeathPD,
    caps: crewCapsOk(), offline: !!PACE_RT.offline, present: isPresent(), hidden: !!(PACE_RT.hidden || (typeof document !== "undefined" && document.hidden)), idleT: Math.round(PACE_RT.idleT), ack: !!inj.ack, seen: inj.seen, seenT: Math.round(inj.seenT), ackT: Math.round(inj.ackT || 0), window: k.window - Math.max(0, inj.left), how, cause: inj.cause, crit: !!inj.crit, injuredAt: inj.pd, gentle: gentle() };
  m.audit.push(audit); if (m.audit.length > 40) m.audit.shift();
  m.inj = m.inj.filter(x => x !== inj);
  cr.slots[o.slot] = null; delete cr.occ[o.id]; crewTouch();
  cr.pending.push({ slot: o.slot, at: G.ship.elapsed + rnd(k.replaceAfter) });
  m.lastDeathPD = p.playDays; m.lastDeathPT = num0(p.presentTotal); m.n.deaths++;
  const partner = !!(p.romance && p.romance.partner === o.id);   // phase 4: a heavier memorial for a romance partner
  const entry = { partner, id: o.id, name: fullName(o), rankLong: rankOf(o, true), short: o.short, pronoun: o.pronoun || "they", species: sp, role: sl.role.split(" ·")[0], dept: sl.dept, day: p.day, pd: p.playDays, sd, cause: inj.cause, what: inj.what, plaque: false };
  m.memorial.push(entry);
  m.memPending = { id: o.id, until: p.playDays + k.memorialDays, notBefore: G.ship.elapsed + k.memorialDelay };
  m.hushUntil = G.ship.elapsed + k.hush;
  const why = how === "surgery" ? `${docName(inj.id)} restored ${pr(o, "pos")} heartbeat twice on the table. The third time, it didn't come back.` : `The ${SYSTEMS[inj.sys] ? SYSTEMS[inj.sys].name : "system"} was still down when the window closed; ${docName(inj.id)} did everything sickbay could do without it.`;
  // pass 07 (4): after a surgery loss the doctor tells the Lt it wasn't them
  const orvin = how === "surgery" ? `${docName(inj.id)}, quietly: 'It wasn't you, ${addr()}.${inj.fast ? ` You got the power back in ${secs(Math.max(1, Math.round(inj.ackT || 0)))}.` : inj.savedBy === "lt" ? " You got sickbay its power back." : ""} Some injuries are past what any of us can do.'` : null;
  m.scene = { id: o.id, name: entry.name, short: o.short, phase: "lost", why, role: entry.role, partner, orvin, how };
  if (orvin) log(orvin, "comm");
  log(why, "fault");
  const line = pick(MEMORIAL).replace(/\{crew\}/g, DEPT_CREW[sl.dept] || "The crew").replace(/\{name\}/g, entry.name).replace(/\{short\}/g, o.short).replace(/\{role\}/g, entry.role.toLowerCase()).replace(/\{species\}/g, sp).replace(/\{sd\}/g, sd).replace(/\{pos\}/g, pr(o, "pos"));
  log(line, "comm");
  toast(`In memoriam — ${entry.name}`, "info");
  crewNote("death", o.id, entry.name, { cause: inj.cause });   // counts toward the crew-event caps
  // Fleet Reputation: deliberately none. A death never pays out standing (see PROG.deaths.fleetRep).
  return "death";
}
const STORIES = [
  "Hale tells the one about {short} and the replicator that only made broth. People laugh, which is the point.",
  "Someone remembers {short} fixing a jammed hatch with a fork and a very long look. The laugh is shaky but real.",
  "A crewmate reads out the last duty-log entry {short} signed. It is two lines long, and entirely like {short}.",
  "Nobody plans the silence that follows; it simply happens, and everyone lets it.",
];
// ---- memorial (memo §2.6): the next time the Lt is at the mess or the bar within memorialDays days of play ----
function memorialScene() {
  const m = M(), mp = m.memPending; if (!mp) return;
  const e = m.memorial.find(x => x.id === mp.id); if (!e) { m.memPending = null; return; }
  if (P().playDays > mp.until) { e.plaque = true; m.memPending = null; log(`The crew held a short service for ${e.short} in the mess while you were on duty elsewhere. A plaque now hangs by the viewport.`, "comm"); return; }
  const L = G.lt; if (PACE_RT.offline || L.mode !== "use" || (L.node !== "mess" && L.node !== "bar")) return;
  if (G.ship.elapsed < (mp.notBefore || 0)) return;   // pass 06 m1: never the same second as the death
  m.memPending = null; e.plaque = true; e.attended = true;
  log(`Mess & Bar — a service for ${e.name}. Captain T'Ren: '${e.short} performed ${pr(e, "pos")} duties with precision and without complaint for as long as ${pr(e)} served. That is the whole of what we ask, and ${pr(e)} gave it.'`, "comm");
  log(`${pick(STORIES).replace(/\{short\}/g, e.short)} A plaque goes up by the viewport: ${e.name}, ${e.role}, SD ${e.sd}.`, "comm");
  if (e.partner) {   // phase 4: the partner's memorial is heavier (memo §5)
    log(`The ${addr()} is asked to speak, and does — not long, and not steadily. Afterwards nobody hurries away. Someone leaves ${e.short}'s favourite mug by the plaque.`, "comm");
    log(`Commander Okafor finds the ${addr()} by the viewport later: 'Take tomorrow's first shift off. That's not a suggestion.' Two of ${e.short}'s friends sit with you until the mess closes.`, "comm");
  }
  const friends = crewList().filter(c => c.dept === e.dept || opinionOf(c.id) >= K().memorialFriendAt);
  let tot = 0; for (const c of friends) tot += nudge(c.id, K().memorialOpinion, "memorial", true) || 0;
  // pass 06 m3: state the real change (after the soft cap), not the nominal +4
  const avg = friends.length ? tot / friends.length : 0;
  log(`You were there. ${friends.length} of ${e.short}'s friends noticed${avg >= 0.05 ? ` (opinion +${avg.toFixed(1)} each on average)` : ""}.`, "comm");
}
// ---- per-step tick (stepSim; runs offline too) ----
export function tickMed(dt) {
  const p = P(); if (!p || !p.crew || !K().enabled) return;
  const m = M(), k = K(), now = G.ship.elapsed, L = G.lt; presentIdle.s = k.presentIdle;
  const pres = isPresent(), away = PACE_RT.offline || nightActive();
  if (pres) p.presentTotal = num0(p.presentTotal) + dt;   // pass 07: present play time (sim seconds while present; never offline / hidden / idle)
  for (const inj of m.inj.slice()) {
    if (!p.crew.occ[inj.id]) { m.inj = m.inj.filter(x => x !== inj); crewTouch(); continue; }   // transferred / gone
    if (pres) { if (!inj.seen) { inj.seen = true; if (inj.offline) log(`Sickbay report: ${inj.name} was hurt while you were off watch (${inj.sev === "serious" ? `serious — the ${SYSTEMS[inj.sys].name} needs you` : "minor"}).`, inj.sev === "serious" ? "fault" : "comm"); } inj.seenT += dt; }
    if (pres && !inj.visited && L.deck === "medical" && !L.lift) {
      inj.visited = true; const d = nudge(inj.id, k.visitOpinion, "visit", true);
      log(`The ${addr()} sits with ${inj.short} in sickbay for a minute. It helps more than either of them says. (opinion +${Math.max(1, Math.round(d))})`, "comm");
    }
    if (inj.state === "warning") {
      if (inj.ack && !inj.acked) { inj.acked = true; inj.ackT = 0; }   // acked by another path (scene watched, tools)
      if (inj.acked) inj.ackT += dt;   // pass 09 (2): fix time since the first ack, present or not (see firstAck)
      // pass 07 (2): looking away never beats watching. Once the player has seen the alert live (seenT > 0), a fix that
      // lands while they're away / idle goes to surgery like any other; the surgery simply waits for them (no free save).
      // Only a patient the player never saw live is stabilised with no roll (the pass-06 safety promise).
      if (!G.ship.faults[inj.sys]) { if ((pres && inj.ack) || inj.seenT > 0) toSurgery(inj, inj.fixBy || (pres && inj.ack ? "lt" : "crew")); else awaySave(inj); continue; }
      if (!pres) { if (away) inj.away = true; inj.paused = true; continue; }   // (b) paused; (c) away = held by the doctor
      if (inj.away) {   // (c) back from away with the system still down: the clock resumes where it paused (pass 07: never a
        inj.away = false; inj.paused = false; inj.ack = false; inj.pendT = 0;   // fresh, full window — that would make leaving pay); it needs seeing again
        // pass 08 (3): ...but never below k.returnFloor (a clock shorter than the fastest fix is unwinnable), once per injury
        if (!inj.floored && inj.left < k.returnFloor) { inj.left = k.returnFloor; inj.floored = true; }
        log(`${docName(inj.id)}: '${inj.short} held while you were off watch, ${addr()}, but sickbay still needs the ${SYSTEMS[inj.sys].name}.' ${secs(Math.max(0, Math.ceil(inj.left)))} on the clock once you're back on it.`, "fault");
        alertFx();
      } else if (inj.paused) {   // pass 08 (3): a short lock / hide / idle (no catch-up): the clock resumes, but under the floor it waits for a re-tap
        inj.paused = false;
        if (inj.ack && inj.left < k.returnFloor) { inj.ack = false; inj.pendT = 0; log(`${docName(inj.id)}: '${inj.short} is still waiting on the ${SYSTEMS[inj.sys].name}, ${addr()}.' ${secs(Math.max(0, Math.ceil(inj.left)))} on the clock once you're back on it.`, "fault"); alertFx(); }
      }
      if (!inj.ack) {   // (a) seen = input after the alert appeared (idleT resets on input)
        inj.pendT += dt;
        if (inj.pendT > 1 && PACE_RT.idleT < inj.pendT - 0.5) { firstAck(inj); crewTouch(); }
        continue;
      }
      inj.left -= dt; if (inj.left <= 0) resolve(inj);
    } else if (inj.state === "surgery") {
      // pass 07 (2): away (hidden, locked, offline, idle >= 60 s) the surgery PAUSES and resumes on return. Never auto-saved.
      if (!pres) { if (!inj.held) { inj.held = true; m.n.held = (m.n.held || 0) + 1; } continue; }
      if (inj.held) { inj.held = false; inj.ack = true; if (!m.scene || m.scene.id !== inj.id) m.scene = surgScene(inj); }   // watching the scene = seen
      inj.surg -= dt; if (inj.surg <= 0) surgeryOutcome(inj);
    } else if (inj.healAt != null && now >= inj.healAt) heal(inj, inj.sev === "serious" ? "a little slower on the stairs, but whole" : "");
  }
  memorialScene();
  if (!m.asked && !PACE_RT.offline) { m.asked = true; log("Crew safety: standard. If you'd rather nobody aboard is ever lost, switch on Gentle mode in CREW ▸ Crew safety (any time).", "comm"); }
}
// pass 06 m5: the one-time Crew safety prompt, from play day 12 (before deaths are possible on day 14); UI shows it while due
export const gentlePromptDue = () => K().enabled && !M().prompt12 && P().playDays >= K().gentlePromptAt && isPresent();
export function answerGentlePrompt(on) { const m = M(); m.prompt12 = true; setGentle(!!on); crewTouch(); }
export const isPresentNow = () => isPresent();
export const hushed = () => G.ship.elapsed < (M().hushUntil || 0);
export const sceneOf = () => M().scene;
export function closeScene() { const m = M(); if (m.scene && m.scene.phase !== "surgery") m.scene = null; }
export function surgeryLeft() { const s = M().scene, x = s && M().inj.find(i => i.id === s.id && i.state === "surgery"); return x ? Math.max(0, x.surg) : 0; }
// ---- event hooks: battle hull hits and hazards ----
hooks.shipHit = hooks.shipHit || [];
hooks.hazard = hooks.hazard || [];
hooks.shipHit.push(({ sys }) => {
  const B = G.sp.battle, I = K().injury; if (!B) return;
  if ((B.injN || 0) >= I.perBattle || Math.random() >= I.battleHit * (nightActive() ? I.nightMult : 1)) return;
  const crit = Object.values(G.ship.faults).some(f => f.sev === "crit");
  const where = sys ? SYSTEMS[sys].deck : pick(["engineering", "bridge", "berthing", "medical", "lounge"]);
  if (injure("battle", { deck: where, sys, crit, what: `a polaron hit that came through the shields on the ${where === "engineering" ? "engineering deck" : where}` })) B.injN = (B.injN || 0) + 1;
});
hooks.hazard.push(({ kind, sys, bonus }) => {
  const I = K().injury; if (Math.random() >= I.hazard * (bonus ? I.hazardBonusMult : 1) * (nightActive() ? I.nightMult : 1)) return;
  injure("hazard", { deck: sys ? SYSTEMS[sys].deck : null, sys, what: kind === "storm" ? "the subspace shear" : kind === "hulk" ? "the intruder loose in the systems" : "a hazard" });
});
hooks.repair.push((tier, sev, manual, sysId) => {
  for (const inj of M().inj) if (inj.state === "warning") { if (tier === "excellent") inj.excellent++; if (sysId === inj.sys) inj.fixBy = "lt"; }
});
