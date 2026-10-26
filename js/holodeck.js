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
import { SLOTMAP } from "./roster.js";
import { log, toast } from "./bus.js";
import { needsOf, NEED_KEYS, shiftNow } from "./needs.js";
import { quirksOf, moodlet, addSkillXp } from "./mood.js";

const now = () => (G.ship && G.ship.elapsed) || 0;
const P = () => G.prog;
const occ = id => P().crew.occ[id];
const nm = id => id === "lt" ? "you" : occ(id) ? occ(id).short : "someone";
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const PROGS = HOLO.progs, PROG_IDS = Object.keys(HOLO.progs);
export const H = () => { const p = P(); if (!p.holo || typeof p.holo !== "object") p.holo = freshHolo(); return p.holo; };
export const freshHolo = () => ({ lt: { d: "", n: 0 }, busy: {}, uses: {}, buffs: {}, recent: {}, risa: {}, over: {}, lock: {}, paid: {}, day: {}, n: { sessions: 0, spent: 0, crew: 0, self: 0 } });
const aboard = () => Object.values(P().crew.slots).filter(id => id && occ(id));
const injured = () => new Set(((P().med && P().med.inj) || []).map(x => x.id));
export const busyUntil = id => { const b = H().busy[id]; return b && b.endT > now() ? b.endT : 0; };
export const isHolo = id => busyUntil(id) > 0;
export const buffOf = id => { const b = H().buffs[id]; return b && b.t1 > now() ? b.k : null; };
export const comfortLocked = id => (H().lock[id] || 0) > now();
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
  return `Next available: ${n.getTime() === tom.getTime() ? "tomorrow" : n.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} ${tm}`;
}
export const ltUsedWhy = (at = new Date()) => `Your holodeck time today is used · ${ltNextText(at)}`;
export const fits = (id, pid) => id !== "lt" && PROGS[pid].fit.some(q => quirksOf(id).includes(q));
// can `id` (crew id or "lt") be booked into program `pid`; paid = the Lt pays
export function bookState(pid, id = "lt", paid = true) {
  const pg = PROGS[pid]; if (!pg) return { ok: false, why: "unknown program" };
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
  if (pg.gapDays && (H().risa[id] || -1e12) > now() - pg.gapDays * PROG.dayLength) return { ok: false, why: `once every ${pg.gapDays} ship's days` };
  if (G.sp.battle) return { ok: false, why: "not during battle" };
  if (paid && !canAfford({ rations: pg.fr })) return { ok: false, why: `${pg.fr} ${PROG.currency.hud} needed` };
  return { ok: true };
}
// ---- blurbs: {lead} the session's lead as an object ("you" / "Seo"), {leads} possessive, {co} the co-star (always third person) ----
const B = {
  tactical_sim: {
    partner: ["The Kobayashi Maru again. {Co} takes the helm beside {lead} and refuses, flatly, to accept a no-win scenario.", "Three Klingon cruisers decloak. {Co} squeezes {leads} hand once under the console, then calls the evasive pattern."],
    friend: ["{Co} plays the freighter captain begging for rescue, badly enough that the whole bridge crew is laughing by the second volley.", "{Co} takes tactical and calls targets before the sensors do. The sim ends in a draw, which almost never happens."],
    rival: ["The computer casts {co} as the Klingon commander. The gloating is a little too convincing.", "{Co} is the evaluator. Every order gets a note on a padd, and the notes are not kind."],
    solo: ["The Kobayashi Maru, variant 12. The bridge shakes, the console sparks, and nobody gets out alive. Good practice anyway.", "Red alert on a simulated Excelsior. The odds are hopeless; the drill is in losing well.", "A Cardassian ambush in the Badlands, run three times. The third time is almost clean."] },
  warp_core_breach: {
    partner: ["Breach in ninety seconds. {Co} reads the intermix ratios aloud in a calm voice meant only for {lead}.", "The core goes critical and {co} is the one who makes the ejection call. Afterwards, nobody lets go of anybody for a moment."],
    friend: ["{Co} plays the panicking ensign and then quietly fixes the plasma leak while {lead} is busy with the simulated chief.", "Okafor's own scenario, with {co} on the other side of the core. The sim reports 4 seconds to spare."],
    rival: ["{Co} is cast as the inspector from Utopia Planitia, sighing at every coolant valve.", "The scenario has {co} as the ensign who caused the breach. It is very satisfying to watch the sim agree."],
    solo: ["Antimatter containment at 12 percent and falling. Klaxons, steam, a stuck valve. The core holds, barely.", "The Utopia Planitia drill: three cascading faults and one right answer.", "A coolant rupture on a simulated Ambassador-class. The hands remember what the mind forgets."] },
  klingon_calisthenics: {
    partner: ["{Co} turns up in the training hall with a bat'leth and a grin, and the forms become a duel. Nobody keeps score.", "Bat'leth forms with {co}, slow and close. The holographic Klingons look politely away."],
    friend: ["{Co} joins the forms and loses three bouts in a row with tremendous dignity.", "The holo-instructor singles out {co} for praise. {Co} will be insufferable about it for days."],
    rival: ["The computer hands {co} a d'k tahg and the role of the challenger. It ends with both of them on the mat.", "{Co} watches from the edge of the hall, arms folded, unimpressed. The forms get done twice as hard."],
    solo: ["Mok'bara at dawn in a stone hall, the instructor shouting in Klingon. Every muscle complains; the mind goes quiet.", "Bat'leth forms until the arms burn. The holo-warriors bang their mugs at the end.", "The Klingon calisthenics program, level 3. The safeties are on, which is the only reason anyone walks out."] },
  vulcan_garden: {
    partner: ["Sand, stone and silence. {Co} sits beside {lead} on the warm rock and says nothing for an hour, which is exactly right.", "The garden at dusk. {Co} arranges the stones wrong on purpose, just to make {lead} smile."],
    friend: ["{Co} tries meditation for the first time and falls asleep in eleven minutes. It still counts.", "{Co} rakes the sand in long patient lines beside {lead}. The red sky does the talking."],
    rival: ["The computer has cast {co} as a disapproving Vulcan master who corrects {leads} posture. Repeatedly.", "{Co} turns up mid-meditation to complain about the duty roster. Even the garden can't fix that."],
    solo: ["Red sands under a white sun, a gong somewhere far off. The breath slows; the week falls away.", "A Vulcan garden on a ridge above ShiKahr. Stones, sand, and the long silence after.", "The meditation program counts breaths in a quiet voice. By two hundred the shoulders have dropped."] },
  dixon_hill: {
    partner: ["Dixon Hill's office, 1941. The door opens and {co} walks in as the mysterious client, all trouble and good shoes.", "Rain on the window, a jazz record, and {co} as the stranger who knows more than anyone should. The case is solved; the evening isn't over."],
    friend: ["{Co} plays the hapless police lieutenant who arrests the wrong man twice. The case still gets solved.", "{Co} is the bartender at the Little Sparrow, and has opinions about every suspect."],
    rival: ["The villain is Cyrus Redblock, played by {co}, with a cigar and a terrible accent.", "{Co} plays the crooked city councilman. The handcuffs at the end feel well earned."],
    solo: ["San Francisco, 1941. A missing necklace, a fat man with a gun, and a fedora that fits just right.", "Dixon Hill and the case of the green sedan. The fog rolls in off the Bay right on cue.", "A holonovel night: trench coat, rain, and a client who lies in the first sentence."] },
  captain_proton: {
    partner: ["Chapter 7. {Co} plays Captain Proton's co-pilot, and absolutely refuses to need rescuing.", "{Co} plays the ruler of the Spider People, and steals every scene from Captain Proton."],
    friend: ["{Co} plays Buster Kincaid with enormous enthusiasm and a tinfoil helmet.", "{Co} is the narrator, reading the chapter cards in a booming voice. The crew in the Mess can hear it."],
    rival: ["Doctor Chaotica is played by {co}, who has clearly been waiting for this role all year.", "{Co} plays Lonzak, the cackling henchman. The death ray misfires on schedule."],
    solo: ["Black and white, rocket ships on strings, and Doctor Chaotica's death ray aimed at Earth. Again.", "Captain Proton, chapter 7: the Fortress of Doom. The satan robot walks very slowly.", "A grayscale serial with cardboard rockets and real laughter."] },
  vics_lounge: {
    partner: ["Vic sees {co} arrive and drops the tempo for a slow number. 'For the lovebirds,' he says.", "A corner booth at Vic's, a martini, and {co} humming along to 'The Best Is Yet To Come'."],
    friend: ["{Co} gets talked onto the stage by Vic for one song. It goes better than anyone expected.", "Vic deals blackjack and {co} wins four hands in a row. The house is very gracious about it."],
    rival: ["{Co} heckles the band and Vic handles it smoothly: 'Pal, every room's got one.'", "Vic seats {co} at the next table, which is either a joke or a lesson."],
    solo: ["Las Vegas, 1962. The band swings, the lights are low, and Vic asks about {leads} week like he means it.", "Vic's lounge on a quiet night, one song after another. Nobody is in a hurry.", "Fly Me to the Moon, a good chair, and a hologram who always knows what to say."] },
  risa_beach: {
    partner: ["Warm sand, blue water, and {co} with a horga'hn and a straight face. Two hours that feel like a week.", "Sunset on Risa. {Co} reads aloud under the umbrella until the light goes."],
    friend: ["{Co} builds an outrageous sandcastle in the shape of the Tenacity. The computer is asked to keep it.", "{Co} challenges {lead} to a swim to the buoy and loses gracefully."],
    rival: ["{Co} has claimed the best lounger and won't budge. Even on Risa.", "The computer puts {co} at the next umbrella with a loud tricorder. Paradise has a flaw."],
    solo: ["Risa: white sand, warm water and absolutely no alarms. The kind of quiet that resets a person.", "Two hours of sun on Risa. The shoulders unknot; the war is a rumor.", "A hammock between palms, the surf, and nothing to fix."] },
};
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
export function blurbFor(pid, lead) {
  const rec = H().recent[pid] = Array.isArray(H().recent[pid]) ? H().recent[pid] : [], rel = relations(lead);
  const avail = rel.reduce((n, [cat]) => n + B[pid][cat].length, 0), block = rec.slice(-Math.min(HOLO.recent, avail - 1));   // never repeat the last 3 (fewer if fewer exist)
  const pool = []; for (const [cat, co, w] of rel) B[pid][cat].forEach((t, i) => { const key = cat + i; if (!block.includes(key)) for (let k = 0; k < w; k++) pool.push([key, t, co]); });
  const [key, t, co] = pool.length ? pick(pool) : ["solo0", B[pid].solo[0], null];
  rec.push(key); while (rec.length > HOLO.recent) rec.shift();
  const coName = co === "lt" ? `the ${addr()}` : co ? occ(co).short : "";
  const lt = lead === "lt";
  let s = t.replace(/\{Co\}/g, Cap(coName)).replace(/\{co\}/g, coName).replace(/\{leads\}/g, lt ? "your" : `${occ(lead).short}'s`).replace(/\{lead\}/g, lt ? "you" : occ(lead).short);
  return { text: s, cat: key.replace(/\d+$/, ""), co };
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
    const over = (h.over[id] || 0) > t; n.fun = 100;
    moodlet(id, "holoNovel", { v: 10 * mult * (q.includes("holo") ? HOLO.addict : 1) * (over ? 0.5 : 1) });
    if (q.includes("holo") && dd.n > HOLO.overuse.perDay && !over) {
      h.over[id] = t + HOLO.overuse.days * PROG.dayLength; r.slip = t + MOOD.minor.slipS;
      log(`${nm(id)} is late to post again, still half in 1941. Too many holonovels; the novel's shine wears off for a couple of days.`, "warn");
    }
  }
  else if (pid === "captain_proton") { n.fun = clamp(n.fun + 60 * funMult, 0, 100); n.social = clamp(n.social + 40 * mult, 0, 100); moodlet(id, "holoProton", { v: 6 * mult }); }
  else if (pid === "vics_lounge") { n.social = 100; moodlet(id, "holoVic", { v: 8 * mult }); }
  else if (pid === "risa_beach") { for (const k of NEED_KEYS) n[k] = Math.max(n[k], 90); r.stress = 0; moodlet(id, "holoRisa", { v: 20 * mult }); h.lock[id] = t + PROG.dayLength; }
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
  const who = [lead, ...(pg.kind === "group" ? groupFor(lead) : [])];
  for (const id of who) { applyTo(id, pid, { paid }); if (id !== "lt") h.busy[id] = { prog: pid, endT: t + pg.min * 60, self: !paid }; if (pg.gapDays) h.risa[id] = t; }   // the Lt's own session is instant (no timer)
  if (lead === "lt") { const d = localDate(), u = h.lt && dOf(h.lt.d) === d ? h.lt : { d, n: 0 }; u.n++; h.lt = u; }
  const bl = blurbFor(pid, lead);
  if (paid && lead !== "lt") {   // gift-like: +1 opinion, max 1 per person per ship's day
    if (h.paid[lead] !== P().day) { h.paid[lead] = P().day; nudge(lead, HOLO.opinion, "holodeck"); }
    h.n.crew++;
  }
  if (pg.kind === "group" && (lead === "lt" || paid)) for (const id of who) if (id !== "lt" && id !== lead) nudge(id, HOLO.groupOpinion, "holodeck");
  h.n.sessions++; if (!paid) h.n.self++;
  const names = who.filter(id => id !== "lt").map(nm);
  if (paid) log(lead === "lt" ? `Holodeck: ${pg.name}${names.length ? ` with ${names.join(", ")}` : ""}. ${bl.text}` : `You book the holodeck for ${nm(lead)}: ${pg.name}${names.length > 1 ? ` with ${names.slice(1).join(", ")}` : ""}.${fits(lead, pid) ? ` ${nm(lead)} loves it.` : ""}`, "good");
  return { ok: true, pid, who, blurb: bl.text, cat: bl.cat, loved: lead !== "lt" && fits(lead, pid) };
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
  { const today = localDate(), d = s.lt && dOf(s.lt.d); out.lt = d ? { d: d > today ? today : d, n: clamp(Math.floor(+s.lt.n || 0), 0, 99) } : { d: "", n: 0 }; }   // a future date (wrong clock) is pulled back to today
  out.buffs = map(s.buffs, v => v && ["drilled", "sharp"].includes(v.k) && f(v.t1) ? { k: v.k, t1: Math.min(v.t1, t + HOLO.buffS) } : undefined);
  for (const k of ["risa", "over", "lock"]) out[k] = map(s[k], v => f(v) ? Math.min(v, t + (k === "risa" ? 0 : k === "lock" ? PROG.dayLength : HOLO.overuse.days * PROG.dayLength)) : undefined);
  out.paid = map(s.paid, v => Number.isInteger(v) ? v : undefined);
  out.day = map(s.day, v => v && Number.isInteger(v.d) && f(v.n) ? { d: v.d, n: clamp(Math.floor(v.n), 0, 99) } : undefined);
  out.uses = map(s.uses, v => { if (!v || typeof v !== "object") return undefined; const o = {}; for (const [pid, u] of Object.entries(v)) if (PROGS[pid] && u && Number.isInteger(u.d) && f(u.n)) o[pid] = { d: u.d, n: clamp(Math.floor(u.n), 0, 99) }; return o; });
  if (s.recent && typeof s.recent === "object") for (const pid of PROG_IDS) if (Array.isArray(s.recent[pid])) out.recent[pid] = s.recent[pid].filter(k => typeof k === "string").slice(-HOLO.recent);
  if (s.n && typeof s.n === "object") for (const k of Object.keys(out.n)) if (f(s.n[k])) out.n[k] = clamp(Math.floor(s.n[k]), 0, 1e7);
  p.holo = out;
}
addHardener(hardenHolo);
