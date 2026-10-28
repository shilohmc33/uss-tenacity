// N4 Holodeck (plan section 8): a Rations sink. No walkable room: a panel (js/ui/holo.js) opened from the lounge chips, the
// Lt's quarters and a crewmember's Personal Log page. Booking spends FR, applies the program's effect at once, shows the
// scene picture + a story blurb picked by the Lt's relationships (romance partner / close friend / rival / nobody close;
// the last 3 blurbs per program never repeat), and the booked crew leave the visible deck for the session (needs act "holo").
// Diminishing returns: skill XP halves on each repeat in a ship's day; buffs don't stack (newest replaces); one booking per
// person at a time; Risa once per 5 ship's days per person. Holonovel addicts: x1.5 novel effect, >2 sessions a day = overuse
// (late to post: a minor slip; the novel's mood halves for 2 days). Crew also use it on their own, free, cheap programs only,
// one self-booked slot at a time, and only while the sim runs (v18: never while he is away).
import { G } from "./state.js";
import { HOLO, MOOD } from "./pacing.js";
import { PROG, addHardener, nudge, opinionOf, spend, canAfford, addr, localDate } from "./progression.js";
import { SLOTMAP, PRONOUNS } from "./roster.js";
import { log, toast } from "./bus.js";
import { needsOf, NEED_KEYS, shiftNow } from "./needs.js";
import { dayKey, addDays, laterDay, dayActive, daysUntil, isDay, shipToDay } from "./util.js";
import { badClock, BAD_CLOCK_WHY } from "./clock.js";   // R2: no booking (and no dates stored) on a bad clock   // Oct 26 A(b): real-day cooldowns
import { quirksOf, moodlet, addSkillXp } from "./mood.js";
import { ltNamed } from "./ltname.js";
import { STORIES } from "./holo-stories.js";
export { STORIES } from "./holo-stories.js";

const now = () => (G.ship && G.ship.elapsed) || 0;
const P = () => G.prog;
const occ = id => P().crew.occ[id];
const nm = id => id === "lt" ? "you" : occ(id) ? occ(id).short : "someone";
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const PROGS = HOLO.progs, PROG_IDS = Object.keys(HOLO.progs);
export const H = () => { const p = P(); if (!p.holo || typeof p.holo !== "object") p.holo = freshHolo(); return p.holo; };
export const freshHolo = () => ({ lt: { d: "", n: 0 }, busy: {}, uses: {}, buffs: {}, recent: {}, risa: {}, over: {}, lock: {}, paid: {}, day: {}, n: { sessions: 0, spent: 0, crew: 0, self: 0 }, invite: null });
const aboard = () => Object.values(P().crew.slots).filter(id => id && occ(id));
const injured = () => new Set(((P().med && P().med.inj) || []).map(x => x.id));
export const busyUntil = id => { const b = H().busy[id]; return b && b.endT > now() ? b.endT : 0; };
export const isHolo = id => busyUntil(id) > 0;
export const buffOf = id => { const b = H().buffs[id]; return b && b.t1 > now() ? b.k : null; };
export const comfortLocked = id => dayActive(H().lock[id]);   // Risa comfort: until the next local midnight
// The Lt's daily slot (HOLO.ltPerDay per real local day, reset at local midnight). His own session is instant: the scene
// plays, the effect lands and he is back on duty, so he never holds a booking timer (the old bug: a busy timer of pg.min
// SHIP minutes, which in v18 only runs while the game does, so "You're already in a session" could last for days of real
// time and survive reloads). A stored date later than today (the clock moved back) counts as today: no extra session.
const dOf = s => typeof s === "string" && /^\d{4}-\d\d-\d\d$/.test(s) ? s : "";
export function ltLeft(at = new Date()) { const u = H().lt || {}, d = localDate(at); return dOf(u.d) && dOf(u.d) >= d ? Math.max(0, HOLO.ltPerDay - (u.n | 0)) : HOLO.ltPerDay; }
export function ltNextAt(at = new Date()) {   // local midnight after the later of today and the stored date
  const u = H().lt || {}, d = localDate(at), base = dOf(u.d) > d ? new Date(u.d + "T00:00:00") : new Date(at.getFullYear(), at.getMonth(), at.getDate());
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
}
export function ltNextText(at = new Date()) {
  const n = ltNextAt(at), tm = n.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), tom = new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1);
  return `Next available: ${n.getTime() === tom.getTime() ? "tomorrow" : n.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", ...(n.getFullYear() !== at.getFullYear() ? { year: "numeric" } : {}) })} ${tm}`;
}
export const ltUsedWhy = (at = new Date()) => `Your holodeck time today is used · ${ltNextText(at)}`;
export const fits = (id, pid) => id !== "lt" && PROGS[pid].fit.some(q => quirksOf(id).includes(q));
// ---- Invite (Shiloh): Lt picks a co-star with a yes/no roll before the session starts ----
// Chance: clamp(0.40 + opinion/150, 0.10, 0.95); romance partner (romance ON) = 0.95. Words: Likely >= 0.65, Maybe >= 0.35, else Long shot.
export const INVITE_YES = { hi: 4, lo: 6, loBelow: 20 };   // stored opinion after gainMult (raw nudge inverted)
export const INVITE_NO = -1;
export const inviteChance = id => {
  const R = P().romance; if (R && R.opt === true && R.partner === id) return 0.95;
  return clamp(0.40 + opinionOf(id) / 150, 0.10, 0.95);
};
export const inviteWord = p => p >= 0.65 ? "Likely" : p >= 0.35 ? "Maybe" : "Long shot";
export const inviteEligible = () => aboard().filter(id => id && occ(id) && !injured().has(id));
const DECLINES = [
  "{S}: 'Not tonight. The week already took its cut.'",
  "{S}: 'Ask me when I'm less tired and less armed.'",
  "{S}: 'Tempting. Still a no.'",
  "{S}: 'I've got a date with my bunk and a bottle that isn't synthehol.'",
  "{S}: 'Pass. Last time nearly killed me — in the fun way. I'm out of fun.'",
  "{S}: 'The captain would notice. So would my better judgment.'",
  "{S}: 'Maybe after the war. Don't hold your breath.'",
  "{S}: 'I like you. I'm still not putting on a costume tonight.'",
  "{S}: 'Hard pass. My shift starts too soon and my dignity ends too fast.'",
  "{S}: 'Not with you. Not today. Don't make it a thing.'",
  "{S}: 'I'll take a rain check that never clears. No hard feelings.'",
  "{S}: 'Find another victim. I'm off the market until further notice.'",
  "{S}: 'No. And if you ask again with that face, I'm logging it.'",
  "{S}: 'Save the holodeck for someone who hasn't seen enough of you this week.'",
];
export const DECLINE_N = DECLINES.length;
function declineLine(id) { return DECLINES[Math.floor(Math.random() * DECLINES.length)].replace(/\{S\}/g, nm(id) === "you" ? "Someone" : occ(id).short); }
export function inviteState(at = new Date()) {
  const h = H(), d = localDate(at);
  if (!h.invite || typeof h.invite !== "object" || h.invite.d !== d) h.invite = { d, rolls: {}, nos: 0, guest: null };
  return h.invite;
}
export function inviteStatus() {
  const st = inviteState(), g = st.guest;
  return { guest: g, nos: st.nos | 0, canInvite: !g && (st.nos | 0) < 2, forcedSolo: g === "solo" && (st.nos | 0) >= 2, rolls: { ...st.rolls } };
}
export function inviteList() {
  const st = inviteState();
  return inviteEligible().map(id => {
    const p = inviteChance(id), rolled = Object.prototype.hasOwnProperty.call(st.rolls, id);
    return { id, short: occ(id).short, p, word: inviteWord(p), rolled, yes: rolled ? st.rolls[id] === true : null };
  });
}
export function pickSolo() {
  const st = inviteState(); st.guest = "solo"; return { ok: true, guest: "solo" };
}
function yesNudge(id) {
  const cur = opinionOf(id), want = cur < INVITE_YES.loBelow ? INVITE_YES.lo : INVITE_YES.hi;
  const O = PROG.opinion, soft = Math.max(0.1, 1 - Math.max(0, cur) / O.soft), raw = want / ((O.gainMult ?? 1) * soft);
  return nudge(id, raw, "holo-invite", true);
}
export function invite(id, rnd = Math.random) {
  if (badClock()) return { ok: false, why: BAD_CLOCK_WHY };
  const st = inviteState();
  if (st.guest) return { ok: false, why: st.guest === "solo" ? "going solo" : `${nm(st.guest)} already said yes`, guest: st.guest };
  if ((st.nos | 0) >= 2) { st.guest = "solo"; return { ok: true, yes: false, forced: true, guest: "solo", line: null }; }
  if (!inviteEligible().includes(id)) return { ok: false, why: "not available" };
  if (Object.prototype.hasOwnProperty.call(st.rolls, id)) return { ok: false, why: "already asked", prior: st.rolls[id], guest: st.guest };
  const p = inviteChance(id), yes = rnd() < p;
  st.rolls[id] = yes;
  if (yes) {
    st.guest = id; const gain = yesNudge(id);
    return { ok: true, yes: true, guest: id, p, word: inviteWord(p), gain, line: null };
  }
  st.nos = (st.nos | 0) + 1; nudge(id, INVITE_NO, "holo-invite-no");
  const line = declineLine(id), forced = st.nos >= 2; if (forced) st.guest = "solo";
  return { ok: true, yes: false, guest: st.guest, nos: st.nos, p, word: inviteWord(p), line, forced };
}
function catForGuest(id) {
  const R = P().romance; if (R && R.opt === true && R.partner === id) return "partner";
  const o = opinionOf(id); if (o <= -20) return "rival"; if (o < 20) return "acquaintance"; return "friend";
}
// can `id` (crew id or "lt") be booked into program `pid`; paid = the Lt pays
export function bookState(pid, id = "lt", paid = true) {
  const pg = PROGS[pid]; if (!pg) return { ok: false, why: "unknown program" };
  if (badClock()) return { ok: false, why: BAD_CLOCK_WHY };   /* R2 */
  if (id !== "lt") {
    if (!occ(id)) return { ok: false, why: "not aboard" };
    if (injured().has(id)) return { ok: false, why: `${nm(id)} is in sickbay` };
    const r = needsOf(id); if (r.unwell > now()) return { ok: false, why: `${nm(id)} is off duty, resting` };
    if (r.argue > now()) return { ok: false, why: `${nm(id)} is in the middle of an argument` };
    const a = P().jobs && P().jobs.active; if (a && a.kind === "incident" && (a.who === id || a.other === id)) return { ok: false, why: `${nm(id)} is caught up in an incident` };   // P30
    if (r.act === "sleep") return { ok: false, why: `${nm(id)} is asleep` };
    if (r.shift === shiftNow()) return { ok: false, why: `${nm(id)} is on shift` };
  }
  if (id === "lt" && ltLeft() <= 0) return { ok: false, why: ltUsedWhy(), used: true };   // the daily slot; crew bookings never touch it
  if (id !== "lt" && isHolo(id)) return { ok: false, why: `${nm(id)} is already in a session` };
  if (pg.gapDays && dayActive(H().risa[id])) { const n = daysUntil(H().risa[id]); return { ok: false, why: `once every ${pg.gapDays} days · again in ${n} day${n === 1 ? "" : "s"}` }; }   // real local days (was ship time: 5 x 16 h of play)
  if (G.sp.battle) return { ok: false, why: "not during battle" };
  if (paid && !canAfford({ rations: pg.fr })) return { ok: false, why: `${pg.fr} ${PROG.currency.hud} needed` };
  return { ok: true };
}
// ---- stories: multi-beat variants in holo-stories.js (tokens {lead}/{leads}/{co}/{Co}/{named}) ----
const Cap = t => t.replace(/^./, c => c.toUpperCase());
function relations(lead) {   // who co-stars, by the Lt's relationships at booking time (for a crew lead the co-star is the Lt)
  const R = P().romance, partner = R && R.opt === true ? R.partner : null, out = [];   // P30: no partner blurbs unless romance is on
  if (lead === "lt") {
    if (partner && occ(partner) && !injured().has(partner)) out.push(["partner", partner, 3]);
    const ids = aboard().filter(id => id !== partner && !injured().has(id));
    const fr = ids.filter(id => opinionOf(id) >= 60), rv = ids.filter(id => opinionOf(id) <= -20);
    if (fr.length) out.push(["friend", pick(fr), 2]); if (rv.length) out.push(["rival", pick(rv), 1]);
  } else {
    const o = opinionOf(lead);
    if (partner === lead) out.push(["partner", "lt", 3]); else if (o >= 60) out.push(["friend", "lt", 2]); else if (o <= -20) out.push(["rival", "lt", 1]);
  }
  out.push(["solo", null, 1]);
  return out;
}
export function blurbFor(pid, lead, forcedCo = null) {   // forcedCo: invite guest id (Lt lead); null/"solo" = existing auto relations
  const S = STORIES[pid], rec = H().recent[pid] = Array.isArray(H().recent[pid]) ? H().recent[pid] : [];
  let rel = relations(lead);
  if (lead === "lt" && forcedCo && forcedCo !== "solo" && occ(forcedCo)) {
    const cat = catForGuest(forcedCo);
    // partner stories only when romance is on (catForGuest already gates); never leak partner text with romance off
    rel = [[cat, forcedCo, 3]];   // invited co-star: never fall through to a solo variant
  }
  const avail = rel.reduce((n, [cat]) => n + ((S[cat] || []).length), 0), block = rec.slice(-Math.min(HOLO.recent, Math.max(0, avail - 1)));
  const pool = [];
  for (const [cat, co, w] of rel) (S[cat] || []).forEach((v, i) => { const key = cat + i; if (!block.includes(key)) for (let k = 0; k < w; k++) pool.push([key, v, co, cat]); });
  const fallback = S.solo[0], pick1 = pool.length ? pick(pool) : ["solo0", fallback, null, "solo"];
  const [key, v, co, cat] = pick1;
  rec.push(key); while (rec.length > HOLO.recent) rec.shift();
  const coName = co === "lt" ? `the ${addr()}` : co ? occ(co).short : "";
  const lt = lead === "lt", named = ltNamed();
  // pronoun packs for co-star / lead (crewmate only; Lt falls back to they). Tokens: {coThey}/{CoThey}/{coIs}/… and {leadThey}/…
  const pack = o => {
    const P = (o && o.pronoun && PRONOUNS[o.pronoun]) ? PRONOUNS[o.pronoun] : PRONOUNS.they;
    const c = w => w.charAt(0).toUpperCase() + w.slice(1);
    const plural = P.sub === "they";
    return { They: c(P.sub), they: P.sub, Them: c(P.obj), them: P.obj, Their: c(P.pos), their: P.pos,
      Theirs: c(P.poss), theirs: P.poss, Themself: c(P.ref), themself: P.ref,
      Is: c(P.is), is: P.is, Has: c(P.has), has: P.has, S: P.s,
      Do: plural ? "Do" : "Does", do: plural ? "do" : "does",
      Dont: plural ? "Don't" : "Doesn't", dont: plural ? "don't" : "doesn't" };
  };
  const coO = (co && co !== "lt" && occ(co)) ? occ(co) : null;
  const leadO = (!lt && occ(lead)) ? occ(lead) : null;
  const coP = pack(coO), leadP = pack(leadO);
  const fill = t => String(t).replace(/\{named\}/g, named).replace(/\{Co\}/g, Cap(coName)).replace(/\{co\}/g, coName)
    .replace(/\{leads\}/g, lt ? "your" : `${occ(lead).short}'s`).replace(/\{lead\}/g, lt ? "you" : occ(lead).short)
    .replace(/\{(co|Co|lead|Lead)(They|Them|Their|Theirs|Themself|Is|Has|S|Do|Dont)\}/g, (_, who, form) => {
      const pack_ = who.toLowerCase() === "co" ? coP : leadP;
      const key = (who[0] === who[0].toUpperCase()) ? form : (form === "S" ? "S" : form.charAt(0).toLowerCase() + form.slice(1));
      return pack_[key] != null ? pack_[key] : "";
    });
  const beats = (v.beats || []).map(fill);
  const talk = (v.talk || []).map(([who, line]) => {
    const w = who === "you" ? (lt ? "You" : occ(lead).short) : fill(who);
    return [w, fill(line)];
  });
  return { text: beats.join(" "), beats, talk, cat: cat || key.replace(/\d+$/, ""), co, key };
}
// ---- effects ----
function applyTo(id, pid, ctx) {
  const pg = PROGS[pid], q = id === "lt" ? [] : quirksOf(id), t = now(), h = H();
  const u = (h.uses[id] = h.uses[id] || {}), d = P().day, rec = u[pid] && u[pid].d === d ? u[pid] : (u[pid] = { d, n: 0 });
  let mult = shiftNow() === 2 && q.includes("nightowl") ? HOLO.nightOwl : 1;
  const xpMult = Math.pow(0.5, rec.n) * (q.includes("workaholic") && pg.kind === "drill" ? 1.5 : 1); rec.n++;
  const dd = (h.day[id] && h.day[id].d === d) ? h.day[id] : (h.day[id] = { d, n: 0 }); dd.n++;
  if (pg.skill) addSkillXp(id, pg.skill, Math.round(pg.xp * xpMult * mult));
  if (pg.buff) h.buffs[id] = { k: pg.buff, t1: t + HOLO.buffS };   // the newest buff replaces the old one
  if (id === "lt") {   // the Lt: XP and buffs as above; leisure tops up his energy
    const S = G.ship, add = { klingon_calisthenics: 10, vulcan_garden: 10, dixon_hill: 15, captain_proton: 15, vics_lounge: 15, risa_beach: 100 }[pid] || 0;
    if (add && typeof S.energy === "number") S.energy = clamp(S.energy + add, 0, 100);
    return;
  }
  const r = needsOf(id), n = r.n, leisure = ["novel", "group", "premium"].includes(pg.kind) || pid === "klingon_calisthenics";
  const funMult = (q.includes("loner") && pg.kind !== "group" ? 2 : 1) * (q.includes("workaholic") && leisure ? 0.5 : 1) * mult;
  if (pid === "klingon_calisthenics") { n.rest = clamp(n.rest + 10 * mult, 0, 100); if (q.includes("shortfuse")) moodlet(id, "holoCal", { v: 6 * mult }); }
  else if (pid === "vulcan_garden") { r.stress = (r.stress || 0) * 0.5; moodlet(id, "holoZen", { v: 5 * mult }); }
  else if (pid === "dixon_hill") {
    const over = dayActive(h.over[id]); n.fun = 100;
    moodlet(id, "holoNovel", { v: 10 * mult * (q.includes("holo") ? HOLO.addict : 1) * (over ? 0.5 : 1) });
    if (q.includes("holo") && dd.n > HOLO.overuse.perDay && !over) {
      h.over[id] = laterDay(h.over[id], addDays(dayKey(), HOLO.overuse.days)); r.slip = t + MOOD.minor.slipS;   // 2 real days
      log(`${nm(id)} is late to post again, still half in 1941. Too many holonovels; the novel's shine wears off for a couple of days.`, "warn");
    }
  }
  else if (pid === "captain_proton") { n.fun = clamp(n.fun + 60 * funMult, 0, 100); n.social = clamp(n.social + 40 * mult, 0, 100); moodlet(id, "holoProton", { v: 6 * mult }); }
  else if (pid === "vics_lounge") { n.social = 100; moodlet(id, "holoVic", { v: 8 * mult }); }
  else if (pid === "risa_beach") { for (const k of NEED_KEYS) n[k] = Math.max(n[k], 90); r.stress = 0; moodlet(id, "holoRisa", { v: 20 * mult }); h.lock[id] = laterDay(h.lock[id], addDays(dayKey(), 1)); }   // comfort held until the next local midnight
  if (pg.kind === "group" && q.includes("loner")) moodlet(id, "holoCrowd");
  if (q.includes("green") && pid === "tactical_sim") r.wins = (r.wins || 0) + 1;   // counts toward the 3-fight threshold
  if (ctx.paid && fits(id, pid)) moodlet(id, "holoLoved");
}
function groupFor(lead) {   // up to 3 more participants: off-shift, free, the best opinion first
  const sh = shiftNow(), inj = injured();
  return aboard().filter(id => id !== lead && !inj.has(id) && !isHolo(id) && !(needsOf(id).unwell > now()) && !(needsOf(id).argue > now()) && !(needsOf(id).refuse > now()) && needsOf(id).shift !== sh && !(SLOTMAP[occ(id).slot] || {}).senior)
    .sort((a, b) => opinionOf(b) - opinionOf(a)).slice(0, HOLO.groupMax - 1);
}
// book `pid` for `lead` ("lt" or a crew id). paid: the Lt pays (false = a crew self-booking, free, cheap programs only)
export function book(pid, lead = "lt", paid = true) {
  const st = bookState(pid, lead, paid); if (!st.ok) return st;
  const pg = PROGS[pid], h = H(), t = now();
  if (paid) { spend({ rations: pg.fr }, "holodeck"); h.n.spent += pg.fr; }
  const inv = lead === "lt" ? inviteState() : null, guest = inv && inv.guest && inv.guest !== "solo" && occ(inv.guest) ? inv.guest : null;
  let extra = pg.kind === "group" ? groupFor(lead) : [];
  if (guest && !extra.includes(guest)) extra = [guest, ...extra.filter(x => x !== guest)].slice(0, HOLO.groupMax - 1);
  const who = [lead, ...extra];
  for (const id of who) { applyTo(id, pid, { paid }); if (id !== "lt") h.busy[id] = { prog: pid, endT: t + pg.min * 60, self: !paid }; if (pg.gapDays) h.risa[id] = laterDay(h.risa[id], addDays(dayKey(), pg.gapDays)); }   // the Lt's own session is instant (no timer)
  if (lead === "lt") { const d = laterDay(localDate(), dOf(h.lt && h.lt.d)), u = h.lt && dOf(h.lt.d) === d ? h.lt : { d, n: 0 }; u.n++; h.lt = u; }   // A(a): the stored date never moves back; refusals never touch this
  const bl = blurbFor(pid, lead, guest);
  if (paid && lead !== "lt") {   // gift-like: +1 opinion, max 1 per person per ship's day
    if (h.paid[lead] !== P().day) { h.paid[lead] = P().day; nudge(lead, HOLO.opinion, "holodeck"); }
    h.n.crew++;
  }
  if (pg.kind === "group" && (lead === "lt" || paid)) for (const id of who) if (id !== "lt" && id !== lead) nudge(id, HOLO.groupOpinion, "holodeck");
  h.n.sessions++; if (!paid) h.n.self++;
  const names = who.filter(id => id !== "lt").map(nm);
  if (paid) log(lead === "lt" ? `Holodeck: ${pg.name}${names.length ? ` with ${names.join(", ")}` : ""}. ${bl.text}` : `You book the holodeck for ${nm(lead)}: ${pg.name}${names.length > 1 ? ` with ${names.slice(1).join(", ")}` : ""}.${fits(lead, pid) ? ` ${nm(lead)} loves it.` : ""}`, "good");
  return { ok: true, pid, who, blurb: bl.text, beats: bl.beats, talk: bl.talk, cat: bl.cat, loved: lead !== "lt" && fits(lead, pid) };
}
// crew on their own: once in a while an off-shift crewmember with low Fun or real stress signs out a cheap program (free)
export function tickHolo(h) {
  const S = H(), t = now();
  for (const id of Object.keys(S.busy)) if (!(S.busy[id].endT > t)) delete S.busy[id];
  if (G.sp.battle || Object.values(S.busy).some(b => b.self)) return;
  if (Math.random() >= HOLO.crewPerHour * h) return;
  const sh = shiftNow(), inj = injured();
  const c = aboard().filter(id => { const r = needsOf(id); return !inj.has(id) && !isHolo(id) && r.shift !== sh && !(r.unwell > t) && !(r.argue > t) && (r.n.fun < 35 || (r.stress || 0) > 2) && r.act !== "sleep"; });
  if (!c.length) return;
  const id = pick(c), cheap = PROG_IDS.filter(p => PROGS[p].fr <= HOLO.crewCheapFr && PROGS[p].kind !== "group"), fav = cheap.filter(p => fits(id, p));
  const pid = pick(fav.length ? fav : cheap), r = book(pid, id, false);
  if (r.ok) log(`${nm(id)} signs out the holodeck: ${PROGS[pid].name}.`, "comm");
}
export function hardenHolo(p) {
  const s = p.holo && typeof p.holo === "object" ? p.holo : {}, f = v => typeof v === "number" && Number.isFinite(v), t = now(), out = freshHolo();
  const ok = id => id === "lt" || !!(p.crew && p.crew.occ && p.crew.occ[id]);
  const map = (src, fn) => { const o = {}; if (src && typeof src === "object") for (const [id, v] of Object.entries(src)) if (ok(id)) { const x = fn(v); if (x !== undefined) o[id] = x; } return o; };
  out.busy = map(s.busy, v => v && PROGS[v.prog] && f(v.endT) ? { prog: v.prog, endT: Math.min(v.endT, t + 120 * 60), self: !!v.self } : undefined);
  delete out.busy.lt;   // pre-fix saves: the Lt's stuck booking timer goes (his sessions are instant now)
  { const today = localDate(), d = s.lt && dOf(s.lt.d); out.lt = d ? { d, n: clamp(Math.floor(+s.lt.n || 0), 0, 99) } : { d: "", n: 0 }; void today; }   // A(a): never pulled back (a clock round trip gave a second session)
  out.buffs = map(s.buffs, v => v && ["drilled", "sharp"].includes(v.k) && f(v.t1) ? { k: v.k, t1: Math.min(v.t1, t + HOLO.buffS) } : undefined);
  { const cap = { risa: (PROGS.risa_beach.gapDays || 5), over: HOLO.overuse.days, lock: 1 };   // A(b): until-dates; an old ship-time number converts to the play days it had left (at most the real-day length)
    for (const k of ["risa", "over", "lock"]) out[k] = map(s[k], v => isDay(v) ? (k === "lock" && v > addDays(dayKey(), 1) ? addDays(dayKey(), 1) : v) : f(v) ? shipToDay(k === "risa" ? v + cap.risa * PROG.dayLength : v, t, PROG.dayLength, cap[k]) : undefined); }
  out.paid = map(s.paid, v => Number.isInteger(v) ? v : undefined);
  out.day = map(s.day, v => v && Number.isInteger(v.d) && f(v.n) ? { d: v.d, n: clamp(Math.floor(v.n), 0, 99) } : undefined);
  out.uses = map(s.uses, v => { if (!v || typeof v !== "object") return undefined; const o = {}; for (const [pid, u] of Object.entries(v)) if (PROGS[pid] && u && Number.isInteger(u.d) && f(u.n)) o[pid] = { d: u.d, n: clamp(Math.floor(u.n), 0, 99) }; return o; });
  if (s.recent && typeof s.recent === "object") for (const pid of PROG_IDS) if (Array.isArray(s.recent[pid])) out.recent[pid] = s.recent[pid].filter(k => typeof k === "string").slice(-HOLO.recent);
  if (s.n && typeof s.n === "object") for (const k of Object.keys(out.n)) if (f(s.n[k])) out.n[k] = clamp(Math.floor(s.n[k]), 0, 1e7);
  { const inv = s.invite; if (inv && typeof inv === "object" && dOf(inv.d)) {
      const rolls = {}; if (inv.rolls && typeof inv.rolls === "object") for (const [id, v] of Object.entries(inv.rolls)) if (ok(id) && (v === true || v === false)) rolls[id] = v;
      const guest = inv.guest === "solo" || (typeof inv.guest === "string" && ok(inv.guest)) ? inv.guest : null;
      out.invite = { d: inv.d, rolls, nos: clamp(Math.floor(+inv.nos || 0), 0, 2), guest };
    } else out.invite = null; }
  p.holo = out;
}
addHardener(hardenHolo);
