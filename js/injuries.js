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
//  Offline: the warning clock only runs once the player has SEEN the injury in a live session (and for at least
//  offlineMinSeen s); an injury that happens while away waits for them, and never resolves into a death unseen.
import { G } from "./state.js";
import { log, toast } from "./bus.js";
import { PROG, hooks, crewList, crewTouch, opinionOf, nudge, fullName, rankOf, addr, freshMed } from "./progression.js";
import { SLOTMAP, SPECIES, POSTINGS } from "./roster.js";
import { SYSTEMS } from "./data.js";
import { PACE_RT, nightActive } from "./pacing.js";
import { spawnFault } from "./faults.js";
import { transferOff, crewNote, crewCapsOk, medFx } from "./crewlife.js";

const P = () => G.prog;
const K = () => PROG.deaths;
const rnd = ([a, b]) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
export const M = () => P().med || (P().med = freshMed());
export const gentle = () => (M().gentle == null ? !!K().gentle : !!M().gentle);
export const injuryOf = id => M().inj.find(x => x.id === id) || null;
export const isInjured = id => !!injuryOf(id);
const docName = () => { const id = P().crew.slots.doctor, o = id && P().crew.occ[id]; return o ? `Dr. ${o.short}` : "The duty medic"; };
// the 2 protected favourites: the player's pins first, topped up with the highest opinions (regular crew; seniors are protected anyway)
export function favourites() {
  const list = crewList().filter(c => !c.senior && !c.protected), n = K().protectFavourites, m = M();
  const pinned = m.pins.filter(id => list.some(c => c.id === id)).slice(0, n);
  const rest = list.filter(c => !pinned.includes(c.id)).sort((a, b) => opinionOf(b.id) - opinionOf(a.id)).map(c => c.id);
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
  if (inj && !(inj.sev === "serious" && inj.state === "warning")) return { ok: false, why: "not a serious unresolved injury" };
  if (p.playDays < k.noDeathsBefore) return { ok: false, why: "too early" };
  if (p.rank < k.minRank) return { ok: false, why: "rank" };
  if (inj && (!inj.seen || (PACE_RT.offline && inj.seenT < k.offlineMinSeen))) return { ok: false, why: "unseen" };
  if (favourites().includes(id)) return { ok: false, why: "favourite" };
  if (gentle()) return { ok: false, why: "gentle" };
  const m = M(); if (m.lastDeathPD != null && p.playDays - m.lastDeathPD < k.gap) return { ok: false, why: "gap" };
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
    sev, sys, state: sev === "serious" ? "warning" : "recovering", at: now, pd: p.playDays, day: p.day, left: k.window, seen: live, seenT: 0, offline: !!PACE_RT.offline,
    visited: false, excellent: 0, healAt: sev === "minor" ? now + rnd(k.heal.minor) : null, crit: !!opts.crit };
  m.inj.push(inj); m.day.n++; m.n.injuries++; m.n[sev]++; if (inj.offline) m.n.offlineInj++;
  crewTouch();
  const role = SLOTMAP[c.slot].role.split(" ·")[0];
  if (sev === "minor") {
    log(`Medical: ${c.name} (${role}) was hurt by ${inj.what} — ${docName()} has them on a biobed in sickbay. Minor; back on duty in a few hours.`, "fault");
    toast(`Injured — ${c.short} in sickbay (minor)`, "warn");
  } else {
    const sn = SYSTEMS[sys].name;
    log(`Medical alert: ${c.name} (${role}) was seriously hurt by ${inj.what} and is on a biobed in sickbay. ${docName()}: 'I can hold them, ${addr()}, but sickbay needs the ${sn} stable. Soon.'`, "fault");
    toast(`INJURED — ${c.short} · fix the ${sn}`, "crit");
  }
  (hooks.crewInjured || []).forEach(f => f(inj));
  return inj;
}
function heal(inj, why) {
  const m = M(); m.inj = m.inj.filter(x => x !== inj); crewTouch();
  m.n.recovered++;
  if (P().crew.occ[inj.id]) log(`Medical: ${fullName(P().crew.occ[inj.id])} is discharged from sickbay and back at their post${why ? ` — ${why}` : ""}.`, "good");
}
function stabilise(inj, by) {
  const m = M(), k = K(); inj.state = "stable"; inj.healAt = G.ship.elapsed + rnd(k.heal.serious); inj.savedBy = by; m.n.saved++;
  const o0 = opinionOf(inj.id); P().opinions[inj.id] = Math.min(100, o0 + k.savedOpinion); const d = P().opinions[inj.id] - o0; crewTouch();   // a real jump: no diminishing returns, no daily cap
  log(`${SYSTEMS[inj.sys].name} restored ${by === "lt" ? `by the ${addr()}` : "by Okafor's team"} — sickbay steadies. ${docName()}: '${inj.short} is going to make it.' (${inj.short}'s opinion +${Math.max(1, Math.round(d))})`, "good");
  toast(`${inj.short} will pull through`, "good");
}
// the warning window ran out with the system still faulted: the outcome (death only if every safeguard allows)
function resolve(inj) {
  const m = M(), k = K(), F = G.ship.faults;
  let ch = k.deathChance * (inj.visited ? k.visitMult : 1) * Math.pow(k.excellentMult, Math.min(k.excellentMax, inj.excellent));
  if (F.eps && F.eps.sev !== "low" && inj.sys !== "eps") ch *= k.epsOpenMult;               // sickbay power down too
  ch = Math.min(k.maxChance, ch);
  const grave = Math.random() < ch, chk = deathCheck(inj.id, inj.cause, inj);
  if (grave && chk.ok) return die(inj);
  if (grave && (chk.why === "favourite" || chk.why === "gentle") && crewCapsOk()) {
    const hosp = chk.why === "favourite" ? "hospital" : "hospitalship";
    m.inj = m.inj.filter(x => x !== inj); m.n[chk.why === "favourite" ? "hospital" : "evac"]++;
    log(chk.why === "favourite" ? `${inj.name} is badly injured — ${docName()} arranges a transfer to ${POSTINGS[hosp].name} for specialist care. They'll recover there.`
      : `${inj.name} is critically injured and evacuated to ${POSTINGS[hosp].name}. ${docName()}: 'They're in the best hands in the quadrant now.'`, "comm");
    transferOff(inj.id, hosp, chk.why === "favourite" ? "hospital" : "evac");
    return "transfer";
  }
  inj.state = "stable"; inj.healAt = G.ship.elapsed + rnd(k.heal.pulled); m.n.pulled++; crewTouch();
  log(`${inj.name} pulls through a long night in sickbay — ${docName()} never left the biobed. Recovery will take a while.`, "comm");
  return "pulled";
}
const MEMORIAL = [
  "In memoriam: {name}, {role}. {short} served the Tenacity with quiet courage. The duty roster carries their name until the end of the watch.",
  "Ship's log: {name}, {species}, {role} — lost in the line of duty on stardate {sd}. Captain T'Ren records the entry herself.",
  "{name} did not survive their injuries. Okafor's crew leaves a light burning at {short}'s station tonight.",
  "The Tenacity has lost {name}, {role}. The ship goes quiet for a while. Somewhere a letter home is being written, carefully.",
];
function die(inj) {
  const p = P(), m = M(), k = K(), cr = p.crew, o = cr.occ[inj.id]; if (!o) return null;
  const sl = SLOTMAP[o.slot], sd = G.ship.stardate.toFixed(1), sp = (SPECIES[o.species] || SPECIES.human).name;
  const audit = { pd: p.playDays, day: p.day, rank: p.rank, id: o.id, senior: !!sl.senior, fav: favourites().includes(o.id), gap: m.lastDeathPD == null ? null : p.playDays - m.lastDeathPD,
    caps: crewCapsOk(), offline: !!PACE_RT.offline, seen: inj.seen, seenT: Math.round(inj.seenT), window: k.window - Math.max(0, inj.left), cause: inj.cause, injuredAt: inj.pd, gentle: gentle() };
  m.audit.push(audit); if (m.audit.length > 40) m.audit.shift();
  m.inj = m.inj.filter(x => x !== inj);
  cr.slots[o.slot] = null; delete cr.occ[o.id]; crewTouch();
  cr.pending.push({ slot: o.slot, at: G.ship.elapsed + rnd(k.replaceAfter) });
  m.lastDeathPD = p.playDays; m.n.deaths++;
  const entry = { id: o.id, name: fullName(o), rankLong: rankOf(o, true), short: o.short, species: sp, role: sl.role.split(" ·")[0], dept: sl.dept, day: p.day, pd: p.playDays, sd, cause: inj.cause, what: inj.what, plaque: false };
  m.memorial.push(entry);
  m.memPending = { id: o.id, until: p.playDays + k.memorialDays };
  const line = pick(MEMORIAL).replace(/\{name\}/g, entry.name).replace(/\{short\}/g, o.short).replace(/\{role\}/g, entry.role.toLowerCase()).replace(/\{species\}/g, sp).replace(/\{sd\}/g, sd);
  log(line, "comm");
  toast(`In memoriam — ${entry.name}`, "info");
  crewNote("death", o.id, entry.name, { cause: inj.cause });   // counts toward the crew-event caps
  // Fleet Reputation: deliberately none. A death never pays out standing (see PROG.deaths.fleetRep).
  return "death";
}
// ---- memorial (memo §2.6): the next time the Lt is at the mess or the bar within memorialDays days of play ----
function memorialScene() {
  const m = M(), mp = m.memPending; if (!mp) return;
  const e = m.memorial.find(x => x.id === mp.id); if (!e) { m.memPending = null; return; }
  if (P().playDays > mp.until) { e.plaque = true; m.memPending = null; log(`The crew held a short service for ${e.short} in the mess while you were on duty elsewhere. A plaque now hangs by the viewport.`, "comm"); return; }
  const L = G.lt; if (PACE_RT.offline || L.mode !== "use" || (L.node !== "mess" && L.node !== "bar")) return;
  m.memPending = null; e.plaque = true; e.attended = true;
  log(`Mess & Bar — a service for ${e.name}. Captain T'Ren: '${e.short} performed their duties with precision and without complaint for as long as they served. That is the whole of what we ask, and they gave it.'`, "comm");
  log(`Hale tells the one about ${e.short} and the replicator that only made broth. People laugh, which is the point. A plaque goes up by the viewport: ${e.name}, ${e.role}, SD ${e.sd}.`, "comm");
  const friends = crewList().filter(c => c.dept === e.dept || opinionOf(c.id) >= K().memorialFriendAt);
  for (const c of friends) nudge(c.id, K().memorialOpinion, "memorial", true);
  log(`You were there. ${friends.length} of ${e.short}'s friends noticed (opinion +${K().memorialOpinion}).`, "good");
}
// ---- per-step tick (stepSim; runs offline too) ----
export function tickMed(dt) {
  const p = P(); if (!p || !p.crew || !K().enabled) return;
  const m = M(), k = K(), now = G.ship.elapsed, live = !PACE_RT.offline && !nightActive(), L = G.lt;
  for (const inj of m.inj.slice()) {
    if (!p.crew.occ[inj.id]) { m.inj = m.inj.filter(x => x !== inj); crewTouch(); continue; }   // transferred / gone
    if (live) { if (!inj.seen) { inj.seen = true; if (inj.offline) log(`Sickbay report: ${inj.name} was hurt while you were off watch (${inj.sev === "serious" ? `serious — the ${SYSTEMS[inj.sys].name} needs you` : "minor"}).`, inj.sev === "serious" ? "fault" : "comm"); } inj.seenT += dt; }
    if (live && !inj.visited && L.deck === "medical" && !L.lift) {
      inj.visited = true; const d = nudge(inj.id, k.visitOpinion, "visit", true);
      log(`The ${addr()} sits with ${inj.short} in sickbay for a minute. It helps more than either of them says. (opinion +${Math.max(1, Math.round(d))})`, "comm");
    }
    if (inj.state === "warning") {
      if (!G.ship.faults[inj.sys]) { stabilise(inj, inj.fixBy || (nightActive() ? "crew" : "lt")); continue; }
      const runs = inj.seen && (!PACE_RT.offline || inj.seenT >= k.offlineMinSeen);
      if (runs) { inj.left -= dt; if (inj.left <= 0) resolve(inj); }
    } else if (inj.healAt != null && now >= inj.healAt) heal(inj, inj.sev === "serious" ? "a little slower on the stairs, but whole" : "");
  }
  memorialScene();
  if (!m.asked && !PACE_RT.offline) { m.asked = true; log("Crew safety: standard. If you'd rather nobody aboard is ever lost, switch on Gentle mode in CREW ▸ Crew safety (any time).", "comm"); }
}
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
