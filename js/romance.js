// Personal Log phase 4: ROMANCE (memo §5; save v12 = the memo's "v10"). Shiloh's rules: opt-in (asked once, off until answered),
// the crewmate signals interest first, "I'd rather stay friends" costs nothing, any gender, everyone except T'Ren and Okafor,
// per-crew Friends only, the outranking disclosure, a transfer turns it into a letter thread, partners are NOT protected from
// deaths (normal safeguards only; heavier memorial + a log entry), PG and fade to black.
// Anti-farm lives in progression.js (romanceCap: readiness social credit and transfer Fleet Rep see at most +50 from a partner).
import { G } from "./state.js";
import { log, toast, cheer, cheerLog, cheerToast, cheerful } from "./bus.js";   // pass 09 (4): light romance lines go through the ONE quiet-period gate
import { PROG, hooks, nudge, opinionOf, crewList, spend, canAfford, addr, freshRomance, romAuthority } from "./progression.js";
import { SLOTMAP, POSTINGS, pr, Pr } from "./roster.js";
import { addEntry, nextDateVariant } from "./plog.js";
import { favourites } from "./injuries.js";

const P = () => G.prog, K = () => PROG.romance;
// pass 12 HOLD 1: romance lines in the SHIP log carry tag "rom" and are hidden while romance is off (the opt-out's own line and
// closeThread's neutral "lost touch" line stay). Saves from before the tag: the same lines are recognised by their wording.
const ROM = "rom";
const ROM_RX = /^An evening with |^Personal log: romantic storylines allowed\.|lingers after the conversation, as if there's something else|^You say yes|^'I'd rather stay friends\.'|is no longer auto-protected as a favourite|^Disclosure (filed|to the captain filed)|'I think we're better as friends|you'd rather be friends\. |^A last letter from |^A letter from .+\(Personal Log\)$|'Write to me\.'|^Personal log, supplemental\. There isn't a regulation|you've been thinking about what .+ asked\.$|^It's a quiet evening\. |^A quiet evening with |keeps you company for an hour after shift|^An early night\. .+ says goodnight at the door/;
export const isRomLog = e => !!e && (e.tag === ROM || (!e.tag && typeof e.msg === "string" && ROM_RX.test(e.msg)));
export const romLogHidden = e => R().opt !== true && isRomLog(e);
export const R = () => P().romance || (P().romance = freshRomance());
const rnd = () => Math.random();
const fill = (t, o, x = {}) => t.replace(/\{S\}/g, o.short).replace(/\{lt\}/g, addr()).replace(/\{X\}/g, x.X || "")
  .replace(/\{(sub|obj|pos|Sub|Obj|Pos)\}/g, (_, f) => f[0] === f[0].toUpperCase() ? Pr(o, f.toLowerCase()) : pr(o, f)).replace(/\{is\}/g, pr(o, "is")).replace(/\{has\}/g, pr(o, "has")).replace(/\{s\}/g, pr(o, "s"));
const ACTIVE = ["interested", "courting", "together"];
export const STAGE_LABEL = { interested: "Interested", courting: "Courting", together: "Together", ended: "Friends (it ended gently)", letters: "Letters", lost: "In memoriam" };

// ---- who, and where things stand ----
export const enabled = () => R().opt === true;
export const eligible = id => !K().excluded.includes(id);
export const partner = () => { const id = R().partner; return id && P().crew.occ[id] ? id : null; };
export const bondOf = id => R().bond[id] || null;
export const isSenior = id => { const o = P().crew.occ[id]; return !!o && !!(SLOTMAP[o.slot] || {}).senior; };
export function setOpt(on) {
  const r = R(); r.opt = !!on;
  if (!on) { r.signal = null; if (r.partner) endIt(r.partner, "optout"); closeThread(); }
  // pass 13 minor: the "allowed" line is a romance line (ROM tag), so turning romance off later hides it from the ship log too
  if (on) log("Personal log: romantic storylines allowed. Someone may let you know, in their own time. Mark anyone 'Friends only' from their page.", "comm", ROM);
  else log("Personal log: no romantic storylines. Friendships carry on exactly as before.", "comm");
}
export function setFriendsOnly(id, on) {
  const r = R(); if (!eligible(id)) return;
  if (on) { r.fo[id] = true; if (r.signal && r.signal.id === id) r.signal = null; if (r.partner === id) endIt(id, "friendsonly"); }
  else delete r.fo[id];
}
function moment(id) { const r = R(), d = P().day, m = r.moments[id] || (r.moments[id] = { n: 0, last: -1 }); if (m.last === d) return; m.last = d; m.n = Math.min(999, m.n + 1); }
const quiet = id => { const r = R(), d = P().day, b = r.bond[id]; if (r.grief && d < r.grief.until) return true; return !!b && b.stage === "ended" && d - b.since < K().quietAfterEnd; };
export function canSignal(id) {
  const r = R(), o = P().crew.occ[id];
  return enabled() && cheerful() && !!o && eligible(id) && !r.fo[id] && r.declined[id] == null && !r.partner && !r.signal && !(r.thread && !r.thread.ended)
    && P().day - r.lastSignal >= K().signalGap && !quiet(id) && P().day - (Number.isFinite(r.lastEnd) ? r.lastEnd : -99) >= K().quietAfterEnd && opinionOf(id) >= K().signalAt && ((r.moments[id] || {}).n || 0) >= K().moments
    && !(P().med && P().med.inj.some(x => x.id === id)) && !["lost", "letters"].includes((r.bond[id] || {}).stage);
}
// ---- the signal: the crewmate asks first (memo: "Walk the Promenade with me at the next dock? Not as shipmates.") ----
const SIGNALS = {
  diallo: "Diallo closes her console. 'There's a nebula on the long-range scans nobody else cares about. Watch it with me tonight? Not as a briefing.'",
  hale: "Hale clears his throat, which he never does. 'I've got a table at Quark's when we dock. I'd like you at it. Not as my junior officer.'",
  orvin: "Orvin holds your gaze a beat longer than usual. 'Several lifetimes of experience, and I still don't know how to say this. Dinner? Just us.'",
  tull: "Tull leans on the counter, suddenly not joking. 'Walk the Promenade with me at the next dock? Not as shipmates.'",
  kovac: "Kovac wipes her hands on a rag far longer than they need. 'I'd like to have dinner with you. A real one. You can say no.'",
  seo: "Seo blurts it out between diagnostics: 'Would you have dinner with me? As in — not as crewmates. Sorry. As in yes, that.'",
  doru: "Doru turns the candle a quarter turn. 'The Prophets favour the bold, they say. So: walk with me on the Promenade at the next dock?'",
  rhovan: "Rhovan smiles before you've said anything. 'You've been wondering. So have I. Shall we stop wondering? Dinner, the two of us.'",
  grevv: "Grevv snorts. 'I'll say it plainly, since you won't. I enjoy your company. Dinner. If you refuse, I'll argue about it, briefly.'",
  mollo: "Mollo beams. 'On Denobula this would involve a great many relatives. Here, it's just me asking: dinner? Just the two of us?'",
  vardock: "Vardock's breathing apparatus hisses. 'I have prepared a procedure for asking this. Step one: would you like to share a meal? Not as colleagues.'",
  natarajan: "Natarajan straightens a stack of padds that doesn't need it. 'I've cleared an evening in your schedule. And in mine. If you'd like it to be ours.'",
  rmira: "R'Mira's tail curls. 'The holosuite has a program with long grass and two moons. Come run it with me? Not as shipmates.'",
  thelev: "Thelev's antennae tilt toward you. 'Andorians don't waste words. I want to see you off duty. Promenade, next dock?'",
  delgado: "Delgado sets down two plates instead of one. 'I've been cooking for the whole ship for a year. I'd like to cook for you. Just you.'",
  sorvan: "Sorvan folds their hands. 'I have concluded, after some deliberation, that I would like to spend an evening with you. Not as colleagues.'",
};
const GENERIC = ["{S} hesitates at the end of the conversation. 'Walk the Promenade with me at the next dock? Not as shipmates.'", "{S} catches your sleeve. 'I'd like to have dinner with you sometime. Just the two of us. You can say no.'"];
function maybeSignal(id) {
  if (!canSignal(id) || rnd() >= K().signalChance) return false;
  const r = R(), o = P().crew.occ[id];
  r.signal = { id, day: P().day, line: fill(SIGNALS[id] || GENERIC[Math.floor(rnd() * GENERIC.length)], o) };
  r.lastSignal = P().day; r.n.signals++;
  addEntry(id, "signal");
  cheerToast(`💌 ${o.short} would like a word`, "info");   // canSignal already refuses in the quiet period; the gate is belt and braces
  cheerLog(`${o.short} lingers after the conversation, as if there's something else. (Personal Log)`, "comm", null, ROM);
  return true;
}
export const pendingSignal = () => { const s = R().signal; return s && P().crew.occ[s.id] && enabled() ? s : null; };
export function forceSignal(id) { const r = R(); delete r.declined[id]; r.lastSignal = -99; r.signal = null; (r.moments[id] = r.moments[id] || { n: 0, last: -1 }).n = Math.max(K().moments, r.moments[id].n); const c0 = K().signalChance; K().signalChance = 1; const ok = maybeSignal(id); K().signalChance = c0; return ok; }   // tests / debug
export function answerSignal(yes) {
  const r = R(), s = pendingSignal(); if (!s) return null; const o = P().crew.occ[s.id]; r.signal = null;
  if (!eligible(s.id) || r.fo[s.id] || r.partner) return null;   // pass 11 m6: a forged / stale signal (T'Ren, Friends only, already a partner) is dropped
  if (!yes) {   // memo + Shiloh: no opinion change, never asked again unless the player reopens it from the log
    r.declined[s.id] = P().day; r.n.declined++;
    addEntry(s.id, "declined");
    log(`'I'd rather stay friends.' ${o.short} nods, and means it: 'Then that's what we are. Nothing changes.' Nothing does.`, "comm", ROM);
    return { ok: true, yes: false, line: `${o.short} nods. 'Then that's what we are. Nothing changes.' Nothing does.` };
  }
  const d = P().day;
  const wasFav = favourites().includes(s.id) && !((P().med && P().med.pins) || []).includes(s.id);   // pass 12 m4: the notice only if they WERE an AUTO-protected favourite; pass 13: a hand-pinned partner stays protected - no notice
  r.partner = s.id; r.n.accepted++;
  r.bond[s.id] = { stage: "interested", since: d, dates: 0, last: -99, courtAt: -1, disclosed: null, protectUntil: d + K().protectDays };
  addEntry(s.id, "accepted", "", cheerful() ? 0 : 1);   // a signal asked before a loss and answered in the quiet period gets the sober entry
  cheerLog(`You say yes. ${o.short} looks relieved and then, briefly, delighted. Off duty, the two of you are something new. (Personal Log ▸ ${o.short})`, "good", `You say yes, quietly; it isn't the week for anything louder, and ${o.short} understands that. Off duty, the two of you are something new. (Personal Log ▸ ${o.short})`, ROM);
  // pass 11 DECISION (Shiloh): partners lose the auto-favourite protection as designed - say so once, and how to pin them
  const note = PROG.deaths.enabled && !isSenior(s.id) && wasFav ? `${o.short} is no longer auto-protected as a favourite in sickbay. You can still pin ${pr(o, "obj")} by hand (☆ on the crew list).` : null;
  if (note) log(note, "comm", ROM);
  return { ok: true, yes: true, note, line: cheer(`${o.short} lets out a breath. 'Good. Then — soon?' (Personal Log ▸ ${o.short})`, `${o.short} takes your hand for a moment. 'When things are quieter. I'm not going anywhere.' (Personal Log ▸ ${o.short})`) };
}
// the player reopens a declined signal from the log; the crewmate asks again at the next chance (if they still feel the same)
export function reopen(id) { const r = R(); if (r.declined[id] == null) return false; delete r.declined[id]; r.lastSignal = -99; log(`You find a moment to tell ${P().crew.occ[id].short} you've been thinking about what ${pr(P().crew.occ[id])} asked.`, "comm", ROM); return true; }

// ---- dates (fade to black) ----
export function dateOptions(id) {
  const r = R(), b = r.bond[id], SP = G.sp, docked = !!SP && !SP.travel && !SP.battle && SP.location === "ds9";   // pass 11 MAJOR: docked = the gift shop's test (not at warp, not in battle)
  if (r.partner !== id || !b) return [];
  const cd = b.last + K().dateEvery - P().day, C = K().dateCost;
  const base = cd > 0 ? `next evening together in ${cd} ship's day${cd > 1 ? "s" : ""}` : "";
  return [
    { k: "dinner", label: "Dinner in your quarters", cost: C.dinner, ok: !base && canAfford({ rations: C.dinner }), why: base || (canAfford({ rations: C.dinner }) ? "" : `${C.dinner} rations needed`) },
    { k: "promenade", label: "Walk the Promenade", cost: C.promenade, ok: !base && docked, why: base || (docked ? "" : "while docked at DS9") },
    { k: "holosuite", label: "A holosuite program", cost: C.holosuite, ok: !base && docked && canAfford({ rations: C.holosuite }), why: base || (docked ? (canAfford({ rations: C.holosuite }) ? "" : `${C.holosuite} rations needed`) : "at a DS9 dock") },
  ];
}
const DATES = {
  dinner: [["The replicator does its best with {pos} favourite dish. {S} pretends not to notice it's slightly wrong, then laughs when you admit it.", "The conversation wanders: home, the ship, a story {sub} {has}n't told anyone else."],
    ["{S} brings dessert. Neither of you mentions the duty roster once.", "At some point the lights dim on their own timer, and neither of you gets up to fix them."]],
  promenade: [["You walk the Promenade end to end. {S} buys you a hasperat from a stall and watches you try it.", "At the upper level you stop by the windows and the wormhole opens, blue and gold, just for a moment."]],
  holosuite: [["The program is a lakeside at dusk. {S} skips a stone eleven times and is insufferable about it.", "You sit by the water until the program's sun goes down."]],
};
// the quiet period after a death (bus.js cheer gate): the evening still happens, without the light lines
const DATE_SOBER = ["It's a quiet evening. {S} doesn't ask you to talk about the loss; {sub} just sit{s} with you.", "Neither of you says much. It helps anyway."];
// pass 12 m5: the ship-log line for a quiet-period evening varies (never the same twice running) instead of repeating DATE_SOBER[0]
const DATE_SOBER_LOG = ["It's a quiet evening. {S} doesn't ask you to talk about the loss; {sub} just sit{s} with you.", "A quiet evening with {S}. Neither of you says much. It helps anyway.",
  "{S} keeps you company for an hour after shift. Nobody fills the silence, and nobody needs to.", "An early night. {S} walks you back to your quarters and says goodnight at the door."];
let lastSoberLog = -1;
const soberLogLine = o => { let i = Math.floor(rnd() * DATE_SOBER_LOG.length); if (i === lastSoberLog) i = (i + 1) % DATE_SOBER_LOG.length; lastSoberLog = i; return fill(DATE_SOBER_LOG[i], o); };
const FADE = { dinner: "Later, at the cabin door, {S} takes your hand. The door slides shut.", promenade: "You walk back to the ship slowly, hands not quite apart.", holosuite: "When the program ends, neither of you calls for the exit straight away." };   // cheer-gated: goOnDate returns the fade only while cheerful() (pass 11 HOLD 2)
export function goOnDate(id, k) {
  const r = R(), b = r.bond[id], o = P().crew.occ[id], opt = dateOptions(id).find(x => x.k === k);
  if (!opt || !opt.ok) return { ok: false, why: opt ? opt.why : "not now" };
  if (opt.cost && !spend({ rations: opt.cost }, "date")) return { ok: false, why: "rations" };
  b.dates++; b.last = P().day; r.n.dates++;
  const d = nudge(id, K().dateOpinion, `date|${k}`, true); moment(id);
  const set = DATES[k], pick = set[Math.floor(rnd() * set.length)], lines = (cheerful() ? pick : DATE_SOBER).map(t => fill(t, o)), was = b.stage;
  if (b.stage === "interested" && b.dates >= K().courtAt) { b.stage = "courting"; b.courtAt = P().day; }
  else if (b.stage === "courting" && b.dates >= K().togetherAt && P().day - b.courtAt >= K().togetherDays) { b.stage = "together"; r.n.together++; addEntry(id, "together"); if (isSenior(id) && !b.disclosed) r.disc = { id, kind: "senior" }; }
  // pass 11 m1: a journal line only for the first evening, a stage change and every 5th evening (varied by type, never the
  // same twice running; the sober date_quiet line in the quiet period) - not one per evening
  if (b.dates === 1 || was !== b.stage || b.dates % K().journalEvery === 0) { const dx = cheerful() ? k : "quiet"; addEntry(id, "date", dx, nextDateVariant(id, dx)); }
  cheerLog(`An evening with ${o.short}. ${lines[0]}`, "good", cheerful() ? null : soberLogLine(o), ROM);   // pass 11 m3: the sober line already opens "It's a quiet evening. {S} ..."
  return { ok: true, k, lines, fade: cheerful() ? fill(FADE[k], o) : null, stage: b.stage, up: was !== b.stage ? b.stage : null, d };
}
// ---- disclosure (memo "chain of command" + senior officers outside the board chain) ----
export const pendingDisc = () => { const dc = R().disc; return dc && R().partner === dc.id && P().crew.occ[dc.id] ? dc : null; };
export function checkDisclosure() {
  const r = R(), id = partner(); if (!id || r.disc) return;
  const b = r.bond[id]; if (b.disclosed === "outrank") return;
  if (romAuthority(id) && b.stage !== "interested") r.disc = { id, kind: "outrank" };
  else if (isSenior(id) && b.stage === "together" && !b.disclosed) r.disc = { id, kind: "senior" };
}
// pass 11 PACING: Together usually lands after Lt Cmdr, so the outrank disclosure is the normal path, not a penalty - Okafor says so
export const OUTRANK_OK = "Okafor, signing it: 'Most officers who make Lieutenant Commander file one of these sooner or later. It's paperwork, not a mark against you.'";
export function fileDisclosure() {
  const r = R(), dc = pendingDisc(); if (!dc) return null; const o = P().crew.occ[dc.id], b = r.bond[dc.id];
  b.disclosed = dc.kind; r.disc = null; r.n.disclosures++;
  addEntry(dc.id, "disclosure", dc.kind, dc.kind === "outrank" ? 1 : 0);
  log(dc.kind === "outrank" ? `Disclosure filed: you now hold station authority over ${o.short}. ${Pr(o, "pos")} evaluations go to Commander Okafor, and ${pr(o, "pos")} opinion of you no longer counts toward your board readiness. ${OUTRANK_OK}` : `Disclosure to the captain filed. T'Ren reads it once. 'Noted, ${addr()}. Keep it off my bridge.'`, "comm", ROM);
  return { ok: true, kind: dc.kind };
}
// ---- ending (either side; gentle; at most -5 softened by the daily cap) ----
export function endIt(id, why = "player") {
  const r = R(), b = r.bond[id], o = P().crew.occ[id]; if (!b || !ACTIVE.includes(b.stage)) return null;
  b.stage = "ended"; b.since = P().day; r.lastEnd = P().day; if (r.partner === id) r.partner = null;   // pass 11 m4: lastEnd = the global pause
  if (r.disc && r.disc.id === id) r.disc = null;   // pass 12 m3: this line was swallowed by the comment above (stale disclosure blocked the next partner's prompt)
  r.n.ended++;
  if (why !== "partner") nudge(id, K().endOpinion, "parted");
  addEntry(id, "parted", why, why === "partner" ? 1 : 0);
  log(why === "partner" ? `${o.short} finds you after shift. 'I think we're better as friends. I'm sorry.' It's gentle, and it's true.` : `You tell ${o.short} gently that you'd rather be friends. ${Pr(o)} take${pr(o, "s")} a breath. 'All right. Thank you for telling me straight.'`, "comm", ROM);
  return { ok: true };
}
// ---- letters (after a transfer or an evacuation) ----
const LETTERS = ["The posting at {X} is everything they promised, except you aren't here. I keep turning to tell you things.", "{X} has a viewport over the stars like ours, almost. I saved you a seat at it in my head.",
  "Long shifts here. I read your last letter twice on the worst one.", "Someone here tells the same terrible jokes Hale does. I laughed, then missed the ship so much I had to step out.",
  "I've been thinking about that evening, the one with the dessert. Write when you can.", "They say there's a chance of shore leave near DS9 next year. I'm only mentioning it."];
const ENDLETTER = "I think we both know the distance is winning. I'll always be glad of us. Look after yourself, {lt}. — {S}";
export const thread = () => R().thread;
export const lettersOf = id => R().letters.filter(l => l.id === id);
// pass 11 m8: a letter always starts with a capital ("{X} has..." openers)
function pushLetter(id, from, t) { const r = R(); t = t.charAt(0).toUpperCase() + t.slice(1); r.letters.push({ id, d: P().day, from, t: t.slice(0, 400) }); if (r.letters.length > K().letters) r.letters.splice(0, r.letters.length - K().letters); if (from === "them") r.n.letters++; }
const alumOf = id => P().alumni.slice().reverse().find(a => a.id === id);
// pass 11 HOLD 1: turning romance off closes an open letter thread: one neutral line, then nothing romantic while off
// (no letters, no envelope toasts, no journal lines; it stays closed if romance is turned back on)
function closeThread() {
  const r = R(), th = r.thread; if (!th || th.ended) return;
  th.ended = true; th.waiting = false; th.closed = "optout";
  const a = alumOf(th.id); if (!a) return;
  addEntry(a.id, "losttouch");
  log(`Personal log: you and ${a.short} have lost touch. It happens with postings.`, "comm");
}
function letterArrives() {
  if (!enabled()) return;   // pass 11 HOLD 1: never while romance is off
  const r = R(), th = r.thread; if (!th || th.ended) return; const a = alumOf(th.id); if (!a) { th.ended = true; return; }
  if (P().playDays < th.next) return;
  if (!cheerful()) return;   // pass 11 HOLD 2: the quiet period after a death defers the letter (next / miss untouched): it comes once the gate opens
  if (th.waiting) { th.miss++; if (th.miss >= K().letterMiss) { th.ended = true; pushLetter(a.id, "them", fill(ENDLETTER, a)); addEntry(a.id, "letter", "", 1); cheerLog(`A last letter from ${a.short}: the distance won, warmly. (Personal Log)`, "comm", null, ROM); return; } }
  pushLetter(a.id, "them", fill(LETTERS[th.n % LETTERS.length], a, { X: (POSTINGS[a.posting] || { name: "the new posting" }).name }));
  th.n++; th.waiting = true; th.next = P().playDays + K().letterEvery;
  addEntry(a.id, "letter", "", 0); cheerToast(`✉ A letter from ${a.short}`, "info"); cheerLog(`A letter from ${a.short} at ${(POSTINGS[a.posting] || { name: "a new posting" }).name}. (Personal Log)`, "comm", null, ROM);
}
export function replyLetter(kind) {
  if (!enabled()) return null;   // pass 11 HOLD 1
  const r = R(), th = r.thread; if (!th || th.ended || !th.waiting) return null; const a = alumOf(th.id); if (!a) return null;
  if (kind === "end") { th.ended = true; th.waiting = false; pushLetter(a.id, "you", "You write the hard letter, kindly: you'll always be glad of what you had."); pushLetter(a.id, "them", fill(ENDLETTER, a)); addEntry(a.id, "letter", "", 1); return { ok: true, ended: true }; }
  th.waiting = false; th.miss = 0; r.n.replies++;
  pushLetter(a.id, "you", kind === "warm" ? "You write back that evening, longer than you meant to, and you mean every line." : "You write back: ship's gossip, a joke about Hale, and a promise to write again soon.");
  if (a.opinion < K().friendCap) a.opinion = Math.min(K().friendCap, a.opinion + K().letterGain);   // keeps a contact warm; never past friendship, never Fleet Rep
  return { ok: true };
}
export function letterState() { const th = R().thread; if (!enabled() || !th || th.ended) return null; return { id: th.id, waiting: th.waiting, next: th.next }; }

// ---- audit for the sim (anti-farm): what a partner adds to readiness / would bank on a transfer ----
export function farmAudit() {
  const id = partner(); if (!id) return null; const op = Math.max(0, opinionOf(id));
  return { id, op: Math.round(op * 10) / 10, cap: K().friendCap, authority: romAuthority(id) };
}

// ---- hooks ----
hooks.social.push(who => { if (!P() || !P().romance || !who || !P().crew.occ[who] || !eligible(who)) return; moment(who); maybeSignal(who); });
hooks.nudged.push((id, d, why) => { if (!P() || !P().romance || !P().crew.occ[id]) return; if (String(why) === "dinner" && d > 0) moment(id); });
hooks.gift.push(({ id, r, care }) => { if (!P() || !P().romance || care || !P().crew.occ[id]) return; if (r === "delighted" || r === "pleased") moment(id); });
hooks.newDay.push(() => {
  if (!P() || !P().romance) return; const r = R(), id = partner();
  if (r.signal && !P().crew.occ[r.signal.id]) r.signal = null;
  if (id && opinionOf(id) < K().endBelow) endIt(id, "partner");
  checkDisclosure();
  letterArrives();
  if (r.grief && P().day >= r.grief.until) r.grief = null;
});
hooks.crewEvent = hooks.crewEvent || [];
hooks.crewEvent.push((kind, id) => {
  const r = P() && P().romance; if (!r) return;
  if (r.signal && r.signal.id === id && (kind === "transfer" || kind === "death")) r.signal = null;
  if (r.partner !== id) return;
  const b = r.bond[id]; r.partner = null; if (r.disc && r.disc.id === id) r.disc = null; if (!b) return;   // defensive: hardenRomance keeps a partner's bond
  if (kind === "transfer") {   // includes medical evacuations: the romance becomes a letter thread
    b.stage = "letters"; r.thread = { id, next: P().playDays + 1, n: 0, waiting: false, miss: 0, ended: false };
    addEntry(id, "letter", "", 2);
    log(`Before the transporter takes ${whoShort(id)}, there's a moment that's only yours. 'Write to me.' You promise. (Personal Log ▸ letters)`, "comm", ROM);
  } else if (kind === "death") {
    b.stage = "lost"; r.n.lost++; r.grief = { id, until: P().day + K().griefDays };
    addEntry(id, "lostpartner", "", lettersOf(id).length ? 1 : 0);   // pass 11 m2: the letters line only when there are letters
    log(`Personal log, supplemental. There isn't a regulation for this. The crew seems to know anyway: people keep finding reasons to stop by.`, "comm", ROM);
  }
});
const whoShort = id => (alumOf(id) || P().crew.occ[id] || { short: "them" }).short;
// fresh-look helpers for the UI
export function bondView(id) {
  const r = R(), b = r.bond[id];
  return { opt: r.opt, eligible: eligible(id), fo: !!r.fo[id], declined: r.declined[id] != null, stage: b ? b.stage : null, b, partner: r.partner === id, signal: !!(r.signal && r.signal.id === id), disc: pendingDisc() && pendingDisc().id === id ? pendingDisc().kind : null };
}
