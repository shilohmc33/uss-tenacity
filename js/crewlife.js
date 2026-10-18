// Phase 3: crew life aboard. Daily crew roll (transfers off, promotions, demotions; NO deaths yet), replacements with a
// 'new crewmate' intro, Fleet Reputation from ex-shipmates, passive perks, favours and the phase-3 rep / parts sinks.
// Data: js/roster.js (slots, species, tags, postings). Tuning: PROG.roster / crewEvents / fleet / favours / sinks.
// Runs inside stepSim (so the offline catch-up rolls days and lands arrivals too); the npc-ambient layer only draws.
import { G } from "./state.js";
import { log, toast, fx } from "./bus.js";
import { PROG, hooks, crewList, crewTouch, opinionOf, nudge, rankOf, fullName, perkFx, spend, canAfford, addr, costText, computeReadiness } from "./progression.js";
import { SLOTMAP, SPECIES, TAGS, TAG_KEYS, POSTINGS, LADDERS, DEPTS } from "./roster.js";
import { PACE_RT, nightActive } from "./pacing.js";

const P = () => G.prog;
const C = () => G.prog.crew;
const rnd = ([a, b]) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const wpick = (items, w) => { const tot = items.reduce((t, x) => t + w(x), 0); let r = Math.random() * tot; for (const x of items) { r -= w(x); if (r <= 0) return x; } return items[items.length - 1]; };
const ORIGINS = ["Starbase 211", "the USS Sentinel", "Starfleet Academy", "the USS Aldebaran", "Starbase 97", "the USS Kestrel", "Utopia Planitia", "a Bajoran relief convoy"];
const KIT = ["tricorder that keeps losing calibration", "family holo-projector that flickers", "padd that won't hold a charge", "music player with a dead speaker", "mag-boots with a failed coil", "reading lamp that sparks", "travel replicator that only makes broth", "chess clock that runs backwards"];

// ============================== daily crew roll ==============================
const weekCount = () => { const pd = P().playDays; return C().rolls.hist.filter(d => d > pd - 7).length; };
const dayCount = () => C().rolls.hist.filter(d => d === P().playDays).length;
const tenure = o => P().playDays - (o.joined || 0);
function eligible(kind, c) {
  if (c.senior) return false;
  if (medFx.isInjured(c.id)) return false;                     // phase 6: nobody is transferred / re-ranked from a biobed                                  // seniors are protected (memo §2.4); newcomers settle in via minTenure
  const sl = SLOTMAP[c.slot], top = LADDERS[sl.ladder].length - 1;
  if (kind === "transfer") return !c.occ.protected && tenure(c.occ) >= PROG.crewEvents.minTenure;   // pt04 m7: protected crew never transfer at random
  if (kind === "promotion") return c.rank < Math.min(top, sl.ladder === "officer" ? 3 : top);   // regulars top out at Lt Cmdr / Senior Chief
  if (kind === "demotion") return c.rank > 0;
  return false;
}
function dailyRoll() {
  const p = P(), cr = C(), E = PROG.crewEvents;
  if (p.playDays <= cr.rolls.lastPD) return;                   // only ship's days that fall on a new day of play
  cr.rolls.lastPD = p.playDays;
  // a newcomer the Lt never met in person settles in after a few days of play (no stale NEW badges)
  for (const o of Object.values(cr.occ)) if (o.intro && p.playDays - (o.joined || 0) >= PROG.crewEvents.introExpire) { o.intro = false; crewTouch(); log(`${fullName(o)} has settled in aboard — you keep passing each other in the corridors.`, "comm"); }
  if (!cr.scripted && p.playDays >= E.scripted.playDay) {      // the memo's early friendly transfer (first fleet contact)
    cr.scripted = true;
    const id = cr.slots[E.scripted.slot];
    if (id) { transferOff(id, E.scripted.posting, "scripted"); return; }
  }
  if (dayCount() >= E.perDay || weekCount() >= E.perWeek) return;
  const early = p.playDays <= E.earlyDays;
  if (Math.random() >= (early ? E.baseEarly : E.base)) return;
  crewEvent(early ? ["transfer", "promotion"] : ["transfer", "promotion", "demotion"]);
}
// one crew event: pick the kind by weight, then someone it can happen to (a demotion is half as likely for crew at >= +40)
export function crewEvent(kinds = ["transfer", "promotion", "demotion"], forceId = null) {
  const E = PROG.crewEvents, list = crewList();
  for (let tries = 0; tries < 4; tries++) {
    const kind = wpick(kinds, k => E.weights[k] || 0);
    const pool = list.filter(c => (forceId ? c.id === forceId : true) && eligible(kind, c));
    if (!pool.length) continue;
    const c = kind === "demotion" ? wpick(pool, x => opinionOf(x.id) >= E.negHalfAt ? 0.5 : 1) : pick(pool);
    if (kind === "transfer") return transferOff(c.id, null, "roll");
    return rankChange(c.id, kind === "promotion" ? 1 : -1);
  }
  return null;
}
export const crewCapsOk = () => dayCount() < PROG.crewEvents.perDay && weekCount() < PROG.crewEvents.perWeek;   // phase 6: deaths must fit the crew-event caps
export function crewNote(kind, id, name, extra = {}) { return note(kind, id, name, extra); }
function note(kind, id, name, extra = {}) {
  const cr = C(); cr.evN = (cr.evN || 0) + 1; if (kind !== "arrival") cr.rolls.hist.push(P().playDays); cr.rolls.n[kind] = (cr.rolls.n[kind] || 0) + 1;
  cr.log.push({ kind, id, name, day: P().day, playDays: P().playDays, ...extra }); if (cr.log.length > 60) cr.log.shift();
  if (cr.rolls.hist.length > 40) cr.rolls.hist.shift();
  hooks.crewEvent && hooks.crewEvent.forEach(f => f(kind, id));
}
export function rankChange(id, dir) {
  const cr = C(), o = cr.occ[id]; if (!o) return null;
  const sl = SLOTMAP[o.slot], L = LADDERS[sl.ladder], before = fullName(o);
  o.rank = Math.max(0, Math.min(L.length - 1, o.rank + dir)); crewTouch();
  const op = opinionOf(id);
  if (dir > 0) {
    const credit = op >= 20 ? ` ${o.short} catches the ${addr()}'s eye across the deck: 'Some of that's yours, you know.'` : "";
    if (op >= 20) nudge(id, PROG.crewEvents.promoteOpinion, "promoted", true);
    log(`Crew news: ${before} is promoted to ${rankOf(o, true)}.${credit}`, "good");
    toast(`Crew promotion — ${fullName(o)}`, "good");
    note("promotion", id, fullName(o));
  } else {
    log(`Crew news: ${before} is reduced in rank to ${rankOf(o, true)} after a disciplinary hearing. ${o.short} keeps their eyes on the deck for a few days.`, "fault");
    toast(`Crew demotion — ${fullName(o)}`, "warn");
    note("demotion", id, fullName(o));
  }
  return { kind: dir > 0 ? "promotion" : "demotion", id };
}
// ============================== transfers, arrivals, intros ==============================
function postingFor(dept) {
  const opts = Object.entries(POSTINGS).filter(([, v]) => v.depts.includes(dept));
  return (opts.length ? pick(opts) : pick(Object.entries(POSTINGS)))[0];
}
export function transferOff(id, posting = null, why = "roll") {
  const p = P(), cr = C(), o = cr.occ[id]; if (!o) return null;
  const sl = SLOTMAP[o.slot], post = posting || postingFor(sl.dept), op = Math.round(opinionOf(id));
  const fr = Math.max(0, Math.floor(op / PROG.fleet.perOpinion));
  const alum = { id, name: o.name, short: o.short, species: o.species, rank: o.rank, ladder: sl.ladder, slot: o.slot, dept: sl.dept, role: sl.role,
    opinion: op, posting: post, leftDay: p.day, leftPD: p.playDays, fr };
  p.alumni.push(alum); p.fleetRep += fr;
  cr.slots[o.slot] = null; delete cr.occ[id]; crewTouch();
  cr.pending.push({ slot: o.slot, at: G.ship.elapsed + rnd(PROG.crewEvents.replaceAfter) });
  const bye = op >= PROG.fleet.contactMin ? `${o.short}, kit bag over one shoulder, stops by the ${addr()}: 'I'll tell them about you. Call if you ever need anything.'`
    : op >= 0 ? `${o.short} shakes the ${addr()}'s hand on the way to the transporter room.` : `${o.short} leaves without a goodbye.`;
  log(`Transfer orders: ${fullName(o)} (${SPECIES[o.species].name}, ${sl.role}) is reassigned to ${POSTINGS[post].name}. ${bye}${fr ? ` Fleet Reputation +${fr}.` : ""} A replacement is en route.`, op >= 0 ? "good" : "fault");
  toast(`Transfer off — ${o.short} to ${POSTINGS[post].name}${fr ? ` · Fleet Rep +${fr}` : ""}`, "info");
  note("transfer", id, fullName(o), { posting: post, opinion: op, fr, why });
  return alum;
}
// transfer-in generator: species by rarity, a name from that species' pool, two personality tags, entry rank
export function genOccupant(slot) {
  const cr = C(), sl = SLOTMAP[slot];
  const taken = new Set(Object.values(cr.occ).map(o => o.name).concat(P().alumni.map(a => a.name)));
  const spId = wpick(Object.keys(SPECIES), k => SPECIES[k].weight), sp = SPECIES[spId];
  let name = "", short = "";
  for (let i = 0; i < 12; i++) {
    if (sp.single) { name = pick(sp.single); short = name.split(" ")[0]; }
    else { const g = pick(sp.given), f = pick(sp.family); name = sp.familyFirst ? `${f} ${g}` : `${g} ${f}`; short = f; }
    if (!taken.has(name)) break;
  }
  const tags = []; const pool = TAG_KEYS.filter(t => t !== "devout" || spId === "bajoran");
  while (tags.length < 2) { const t = pick(pool); if (!tags.includes(t)) tags.push(t); }
  const id = `${spId.slice(0, 3)}${cr.nextId++}`;
  return { id, slot, rank: Math.random() < 0.7 ? 0 : 1, name, short, species: spId, tags, joined: P().playDays, intro: true, from: pick(ORIGINS) };
}
export function arrive(slot, occ = null) {
  const p = P(), cr = C(), sl = SLOTMAP[slot];
  if (cr.slots[slot]) return null;
  const o = occ || genOccupant(slot);
  cr.occ[o.id] = o; cr.slots[slot] = o.id; crewTouch();
  const N = PROG.fleet.newcomer, bonus = Math.min(N.max, Math.floor(p.fleetRep * N.perFleetRep));
  p.opinions[o.id] = PROG.opinion.startDefault + bonus; o.heard = bonus;
  log(`Transfer aboard: ${fullName(o)}, ${SPECIES[o.species].name}, reports from ${o.from} as ${sl.role} (${sl.deck}).${bonus >= N.lineAt ? " Word of the Tenacity's engineer got here first." : ""}`, "good");
  toast(`New crewmate — ${fullName(o)} (${SPECIES[o.species].name})`, "info");
  note("arrival", o.id, fullName(o), { slot });
  return o;
}
// the newcomer's first chat with the Lt (npc-ambient walks them over when he's on their deck)
export function introLine(id) {
  const cr = C(), o = cr.occ[id]; if (!o) return "";
  const sl = SLOTMAP[o.slot], best = friendliestAlum();
  const heard = o.heard >= PROG.fleet.newcomer.lineAt && best ? ` 'Heard good things about you from ${rankOf(best)} ${best.short} at ${POSTINGS[best.posting].name}.'` : "";
  const flav = (TAGS[o.tags[0]] || TAGS.warm)[0].replace(/\{short\}/g, o.short).replace(/\{lt\}/g, addr());
  return `New crewmate: ${fullName(o)} (${SPECIES[o.species].name}) introduces themself — 'Reporting as ${sl.role.split(" ·")[0].toLowerCase()}, ${addr()}. Just in from ${o.from}.'${heard} ${flav}`;
}
export function introDone(id) {
  const o = C().occ[id]; if (!o || !o.intro) return false;
  log(introLine(id), "comm");
  o.intro = false; crewTouch();
  fx("floater", { x: G.lt.x, y: G.lt.y - 0.235, text: `NEW CREWMATE · ${o.short.toUpperCase()}`, color: "#9fd8ff", life: 2.6 });
  return true;
}
export function tickCrew(dt) {
  const cr = C(); if (!cr) return;
  nightMaintenance(dt);
  if (!cr.pending.length) return;
  for (let i = cr.pending.length - 1; i >= 0; i--) if (G.ship.elapsed >= cr.pending[i].at) { const pe = cr.pending.splice(i, 1)[0]; arrive(pe.slot); }
}
// Standing order (parts sink while away): when the locker is above PROG.sinks.maintain.above of its cap, the night
// crew spends one surplus part every `every` s on preventive maintenance, pushing the next ambient fault back a little.
export function nightMaintenance(dt) {
  const K = PROG.sinks.maintain, p = P(), S = G.ship;
  if (!K || !p.sinks.maintainOn || !nightActive() || G.sp.battle) { p.sinks.maintT = 0; return; }
  if (S.parts <= Math.ceil(S.partsCap * K.above)) return;
  p.sinks.maintT = (p.sinks.maintT || 0) + dt;
  if (p.sinks.maintT < K.every) return;
  p.sinks.maintT = 0;
  spend({ parts: 1 }, "maintain");
  if ((S.nextFault || 0) < K.maxAhead) S.nextFault = (S.nextFault || 0) + K.delay;
}
// DEATHS (phase 6, js/injuries.js): never before day 14 / Lt, battle or hazard only, injured-first warning, seniors +
// 2 favourites protected, gentle mode, max 1 per PROG.deaths.gap days of play. injuries.js fills medFx (no import cycle).
export const medFx = { deathCheck: () => ({ ok: false, why: "not loaded" }), isInjured: () => false };
export function deathEligible(id, cause) { return medFx.deathCheck(id, cause).ok; }
hooks.crewInjured = hooks.crewInjured || [];                  // phase 6: injured-first warning (biobed + log line), see injuries.js
// AWAY MISSIONS (stub): a hook for later phases to ask an ex-shipmate / crew member for an away-mission slot
export const awayMission = { requests: [], request(/* kind, who */) { return null; } };

// ============================== fleet reputation, perks ==============================
const alumRank = a => a.ladder === "officer" ? Math.min(LADDERS.officer.length - 1, (a.rank | 0) + Math.max(0, Math.floor((P().playDays - (a.leftPD | 0)) / PROG.fleet.alumPromoteEvery) || 0)) : a.rank | 0;
export const alumRankShort = a => { const L = LADDERS[a.ladder] || LADDERS.officer; return (L[Math.max(0, Math.min(L.length - 1, alumRank(a)))] || L[0])[1]; };
export function friendliestAlum(posting = null) {
  const L = P().alumni.filter(a => a.opinion >= PROG.fleet.contactMin && (!posting || a.posting === posting));
  return L.sort((x, y) => y.opinion - x.opinion)[0] || null;
}
export function addFleetRep(n, why) { if (n > 0) { P().fleetRep += n; log(`Fleet Reputation +${n} — ${why}.`, "good"); } }
export function onDiplomatic(dest) {   // +2 Fleet Reputation per diplomatic visit, credited at most once per PROG.fleet.diplomaticEvery days of play
  const cr = C(), pd = P().playDays;
  if (cr.dipPD != null && pd - cr.dipPD < PROG.fleet.diplomaticEvery) return;
  cr.dipPD = pd; addFleetRep(PROG.fleet.diplomatic, "the Tenacity's diplomatic call is noted fleet-wide");
}
const goodWordN = () => P().alumni.filter(a => a.opinion >= PROG.fleet.perks.goodword.min).length;
export const perkState = () => {
  const K = PROG.fleet.perks, qm = P().alumni.find(a => K.quartermaster.postings.includes(a.posting) && a.opinion >= K.quartermaster.min), n = goodWordN();
  return { quartermaster: qm || null, goodword: n, readiness: Math.min(K.goodword.cap, n * K.goodword.readiness), callup: Math.min(K.goodword.callupCap, 1 + n * K.goodword.callup) };
};
perkFx.readiness = () => perkState().readiness;
perkFx.callup = () => perkState().callup;
perkFx.excellent = () => (G.ship.elapsed < (P().fav.fx.calUntil || 0) ? PROG.favourFx.calibration : 0);
perkFx.repairSpeed = () => { const f = PROG.favours.find(x => x.id === "dcteam"); return G.ship.elapsed < (P().fav.fx.dcUntil || 0) ? 1 + f.repair : 1; };
// DS9 resupply interval multiplier (quartermaster perk; priority dock favour) and the night crew loaner
export function ds9Mult() {
  const fx2 = P().fav.fx; let m = 1;
  if (perkState().quartermaster) m *= PROG.fleet.perks.quartermaster.ds9Every / 15;
  if (fx2.dock === "active") m *= PROG.favourFx.dockMult;
  return m;
}
export const nightFixMult = () => (PACE_RT.offline && P().fav.fx.loaner ? PROG.favourFx.loanerMult : 1);
export function endOffline(seconds) { if (seconds >= 600 && P().fav.fx.loaner) { P().fav.fx.loaner = false; log("The Starbase 375 loaner team signs off — Okafor's night crew is on its own again.", "comm"); } }
export function onDock() {
  const f = P().fav; f.docks = (f.docks || 0) + 1;
  if (f.fx.dock === "pending") { f.fx.dock = "active"; log("DS9 ops waves the Tenacity into a priority slot — the quartermaster's pallets come twice as fast.", "good"); }
  if (f.fx.shipment) {
    const S = G.ship, got = Math.max(0, Math.min(f.fx.shipment, S.partsCap - S.parts)); S.parts += got; f.fx.shipment -= got;   // pt04 m3: anything that doesn't fit waits for the next dock
    if (got) log(`A crate from Utopia Planitia is waiting at the DS9 dock, addressed to the ${addr()}: +${got} spare parts${f.fx.shipment ? ` (${f.fx.shipment} more held at DS9 until the locker has room)` : ""}.`, "good");
  }
}
export function onUndock() { if (P().fav.fx.dock === "active") P().fav.fx.dock = null; }

// ============================== favours (rep sinks) ==============================
export function favourState(id) {
  const p = P(), f = PROG.favours.find(x => x.id === id); if (!f) return { ok: false, why: "unknown" };
  let contact = null, who = null;
  if (f.who) {
    const cid = p.crew.slots[f.who]; who = cid && crewList().find(c => c.id === cid);
    if (!who) return { f, ok: false, why: "nobody in that post right now" };
    if (opinionOf(who.id) < 10) return { f, ok: false, who, why: `${who.short} needs to like you a little first (+10)` };
  } else {
    if (p.fleetRep < f.fr) return { f, ok: false, why: `Fleet Reputation ${f.fr} needed`, locked: true };
    contact = (f.contact && friendliestAlum(f.contact)) || friendliestAlum();
    if (!contact) return { f, ok: false, why: `needs an ex-shipmate at +${PROG.fleet.contactMin} or better`, locked: true };
    if (f.needRank && alumRank(contact) < f.needRank) {
      const hi = p.alumni.filter(a => a.opinion >= PROG.fleet.contactMin && alumRank(a) >= f.needRank).sort((a, b) => b.opinion - a.opinion)[0];
      if (!hi) return { f, ok: false, contact, why: "needs a friendly ex-shipmate now Lt Cmdr or above", locked: true };
      contact = hi;
    }
    if (f.stub) return { f, ok: false, contact, why: "comes with away missions" };
  }
  const cd = p.fav.cd[id];
  if (f.cd === "rank" && p.fav.used[id] === p.rank) return { f, ok: false, contact, who, why: "used at this rank" };
  if (f.cd === "dock" && cd != null && cd === (p.fav.docks || 0)) return { f, ok: false, contact, who, why: "already arranged for this dock" };
  if (typeof f.cd === "number" && f.cd > 0 && cd != null && p.day < cd) return { f, ok: false, contact, who, why: `again on ship's day ${cd}` };
  if (id === "dcteam" && G.ship.elapsed < (p.fav.fx.dcUntil || 0)) return { f, ok: false, who, why: "team already working with you" };
  if (id === "cadet" && (p.fav.fx.cadets || 0) >= (f.maxTimes || 1e9)) return { f, ok: false, contact, why: "the scholarship fund is full" };
  if (id === "ordnance" && G.ship.torps >= G.ship.torpCap) return { f, ok: false, contact, why: "tubes are full" };
  // pt04 m3/m4: partial deliveries are charged per item, and a shipment never overflows the locker
  let cost = f.cost, n = null;
  if (id === "shipment") {
    const FX = PROG.favourFx, room = G.ship.partsCap - G.ship.parts - (p.fav.fx.shipment || 0);
    n = Math.min(FX.shipmentParts, room);
    if (n < FX.shipmentMin) return { f, ok: false, contact, why: `locker nearly full (${G.ship.parts}/${G.ship.partsCap})` };
    cost = { rep: Math.ceil(f.cost.rep * n / FX.shipmentParts) };
  }
  if (id === "ordnance") { n = Math.min(PROG.favourFx.ordnance, G.ship.torpCap - G.ship.torps); cost = { rep: Math.ceil(f.cost.rep * n / PROG.favourFx.ordnance) }; }
  if (id === "letter" && !PROG.ranks[p.rank + 1]) return { f, ok: false, contact, why: "no further rank" };
  if (!canAfford(cost)) return { f, ok: false, contact, who, cost, n, why: `${costText(cost)} needed`, poor: true };
  return { f, ok: true, contact, who, cost, n };
}
export function callFavour(id) {
  const st = favourState(id); if (!st.ok) return false;
  const p = P(), f = st.f, FX = PROG.favourFx, S = G.ship, c = st.contact, by = c ? `${alumRankShort(c)} ${c.short} at ${POSTINGS[c.posting].name}` : st.who ? st.who.short : "";
  const cost = st.cost || f.cost;
  if (!spend(cost, "favour:" + id)) return false;
  if (typeof f.cd === "number" && f.cd > 0) p.fav.cd[id] = p.day + f.cd;
  if (f.cd === "dock") p.fav.cd[id] = (p.fav.docks || 0) + (G.sp.location === "ds9" && !G.sp.travel ? 0 : 1);
  if (f.cd === "rank") p.fav.used[id] = p.rank;
  let what = "";
  if (id === "shipment") { const n = st.n; if (G.sp.location === "ds9" && !G.sp.travel) { S.parts += n; what = `+${n} parts beamed over from the DS9 dock`; } else { p.fav.fx.shipment = (p.fav.fx.shipment || 0) + n; what = `+${n} parts waiting at the next DS9 dock`; } }
  else if (id === "loaner") { p.fav.fx.loaner = true; what = "a loaner team joins Okafor's night crew for your next offline stretch"; }
  else if (id === "dock") { p.fav.fx.dock = G.sp.location === "ds9" && !G.sp.travel ? "active" : "pending"; what = "a priority slot at DS9 (resupply twice as fast)"; }
  else if (id === "intel") { G.sp.preScanned = true; what = "the next hostile's shield frequencies"; }
  else if (id === "ordnance") { const got = st.n; S.torps += got; what = `+${got} torpedo${got === 1 ? "" : "es"}, no questions asked`; }
  else if (id === "calibration") { p.fav.fx.calUntil = S.elapsed + FX.calibrationDur; what = "+10% Excellent chance for the next 24 hours"; }
  else if (id === "letter") { p.readyBonus = (p.readyBonus || 0) + FX.letter; computeReadiness(); what = `+${FX.letter} board readiness`; }
  else if (id === "round") { for (const m of crewList()) nudge(m.id, f.opinion, "a round on the Lt", true); what = "the whole ship drinks to the engineer (+opinion with everyone)"; }
  else if (id === "cadet") { p.fav.fx.cadets = (p.fav.fx.cadets || 0) + 1; addFleetRep(f.fleet, `a cadet at the Academy on the Tenacity scholarship (${p.fav.fx.cadets} sponsored)`); what = `a scholarship in the Tenacity's name — cadet #${p.fav.fx.cadets}`; }
  else if (id === "dcteam") { p.fav.fx.dcUntil = S.elapsed + f.dur; what = "two of Okafor's engineers shadow your repairs (+30% speed, 15 min)"; }
  log(`Favour called in — ${f.name}${by ? ` (${by})` : ""}: ${what}. ${costText(cost).replace("REP", "reputation")} spent.`, "good");
  toast(`Favour — ${f.name} · −${costText(cost)}`, "good");
  (hooks.favourUsed || []).forEach(h => h(id));   // phase 4: decor drops (js/cabin.js)
  return true;
}
// ============================== phase-3 parts sinks ==============================
export function overhaulState() { const K = PROG.sinks.overhaul, left = P().sinks.overhaulAt + K.cd - G.ship.elapsed; return { ok: left <= 0 && canAfford({ parts: K.parts }), left: Math.max(0, Math.ceil(left)) }; }
export function doOverhaul() {
  const K = PROG.sinks.overhaul; if (!overhaulState().ok || !spend({ parts: K.parts }, "overhaul")) return false;
  P().sinks.overhaulAt = G.ship.elapsed; G.ship.nextFault = (G.ship.nextFault || 0) + K.delay;
  const ok = P().crew.slots["chief-engineer"]; if (ok) nudge(ok, K.opinion, "overhaul", true);
  log(`Preventive overhaul: the ${addr()} and Okafor's crew strip and refit the worst-worn couplings. The next fault is a while off (−${K.parts} parts).`, "good");
  toast(`Preventive overhaul — −${K.parts} parts`, "good"); return true;
}
export const casingOk = () => G.ship.torps < G.ship.torpCap && canAfford({ parts: PROG.sinks.casing.parts });
export function buildCasing() {
  const K = PROG.sinks.casing; if (!casingOk() || !spend({ parts: K.parts }, "casing")) return false;
  G.ship.torps = Math.min(G.ship.torpCap, G.ship.torps + K.torps); G.ship.tubeFlash = G.ship.elapsed;
  log(`The ${addr()} machines a torpedo casing from spares; Hale loads it personally. Torpedoes ${G.ship.torps}/${G.ship.torpCap} (−${K.parts} parts).`, "good");
  toast(`Torpedo casing built — −${K.parts} parts`, "good"); return true;
}
function newRequests() {
  const p = P(), K = PROG.sinks.kit;
  p.requests = p.requests.filter(r => p.crew.occ[r.id]);
  if (p.reqDay === p.day) return; p.reqDay = p.day;
  for (let i = 0; i < K.perDay && p.requests.length < K.max; i++) {
    const pool = crewList().filter(c => !c.intro && !medFx.isInjured(c.id) && !p.requests.some(r => r.id === c.id));
    if (!pool.length) return;
    const c = pick(pool); p.requests.push({ id: c.id, item: pick(KIT), day: p.day });
  }
}
export function fixKit(id) {
  const p = P(), K = PROG.sinks.kit, r = p.requests.find(x => x.id === id), o = p.crew.occ[id];
  if (!r || !o || !spend({ parts: K.parts }, "kit")) return false;
  p.requests = p.requests.filter(x => x !== r);
  const d = nudge(id, K.opinion, "kit", true);
  log(`The ${addr()} fixes ${o.short}'s ${r.item} — ${o.short} is delighted (opinion +${Math.max(1, Math.round(d))}, −${K.parts} parts).`, "good");
  toast(`Fixed ${o.short}'s kit — −${K.parts} parts`, "good"); return true;
}
// ============================== hooks ==============================
hooks.newDay.push(() => { newRequests(); dailyRoll(); });
