// Personal Log phase 1 (design memo 2026-10-17 "phase A", save v8 here; the memo calls it v7).
// The Lt's own log: one read-only page per crewmate — standing (bar + label + 7-day trend; the number stays hidden, memo §1),
// "What moved it" (last PROG.plog.hist reasons, fed by nudge(why)), and a stardated journal in the Lt's voice built from
// crew events, sickbay, chats, dinners, kit fixes and odd jobs. Former shipmates (alumni) and the fallen keep their pages.
// State: G.prog.plog (see freshPlog / hardenPlog in progression.js). Text is rendered at read time (pronoun-aware).
// Phase B (gifts, dinner +4), C (Insight: shows the number) and D (romance) are NOT built here.
import { G } from "./state.js";
import { PROG, hooks, crewList, opinionOf, opinionLabel, rankOf, freshPlog } from "./progression.js";
import { START_CREW, POSTINGS, pr, Pr } from "./roster.js";
import { SYSTEMS } from "./data.js";
import { GIFT } from "./gift-data.js";

const P = () => G.prog;
const K = () => PROG.plog;
const L = () => { const p = P(); if (!p.plog || typeof p.plog !== "object") p.plog = freshPlog(); return p.plog; };
const sd = () => Math.round((G.ship && G.ship.stardate || 0) * 10) / 10;

// ---- who a page belongs to: aboard, alumni, fallen, or the start roster (pronoun + names) ----
export function whoOf(id) {
  const p = P(), o = p.crew && p.crew.occ[id]; if (o) return { ...o, where: "aboard" };
  const a = (p.alumni || []).slice().reverse().find(x => x.id === id); if (a) return { ...a, where: "alum" };
  const m = ((p.med || {}).memorial || []).find(x => x.id === id); if (m) return { ...m, where: "lost" };
  const s = START_CREW.find(x => x.id === id); return s ? { ...s, where: "none" } : { id, name: id, short: id, pronoun: "they", where: "none" };
}
// pass 12 m6: {X} that opens a sentence is capitalised ("Said goodbye to Doru. The USS Bellerophon's bridge ...")
const fill = (t, o, x = "") => t.replace(/\{S\}/g, o.short || o.name || "?").replace(/\{N\}/g, o.n || o.name || o.short || "?").replace(/(^|[.!?] )\{X\}/g, (_, a) => a + String(x).charAt(0).toUpperCase() + String(x).slice(1)).replace(/\{X\}/g, x)
  .replace(/\{(sub|obj|pos|ref|Sub|Obj|Pos|Ref)\}/g, (_, f) => f[0] === f[0].toUpperCase() ? Pr(o, f.toLowerCase()) : pr(o, f))
  .replace(/\{has\}/g, pr(o, "has")).replace(/\{is\}/g, pr(o, "is")).replace(/\{s\}/g, pr(o, "s"));

// ---- "What moved it": a reason per nudge(why). Second person, as in the memo ("You left the coolant leak open") ----
function reason(w, o) {
  const [key, arg] = String(w).split("|"), sys = arg && SYSTEMS[arg];
  const sn = sys ? sys.name.toLowerCase() : "ship's systems";
  const R = {
    "excellent repair": `Excellent repair on the ${sn}`, "good repair": `Good repair on the ${sn}`, "standard repair": `Repair on the ${sn}`, "marginal repair": `A rushed patch on the ${sn}`,
    "ignored fault": sys ? `You left the ${sys.fault.toLowerCase()} open` : "You left a fault open in {pos} section",
    chat: "You stopped to talk", "deck task": "You handled a deck task in {pos} area", "station work": "Your hours at {pos} station",
    "battle repair": "You kept the ship fighting in battle", "odd job": "You helped with an odd job", memorial: "You came to the memorial",
    visit: "You visited {obj} in sickbay", dinner: "Dinner in your quarters", promoted: "You were glad for {pos} promotion",
    "a round on the Lt": "You bought the ship a round", overhaul: "You overhauled the engine room", kit: `You fixed {pos} ${arg || "kit"}`,
    praise: "{Sub} praised you to the captain", complaint: "{Sub} filed a complaint about your crews",
    date: "An evening together", parted: "You agreed to be friends",
    beat: "You listened when it mattered", misstep: `You said the wrong thing (${arg || "a sore subject"})`, apology: "You apologised",
    gift: `Your gift, ${(GIFT[arg] || { a: "a gift" }).a} (${String(w).split("|")[2] || "given"})`, "care package": `Your care package (${arg || "sent"})`,
  };
  const t = R[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : "Something you did");
  return fill(t, o);
}
const romOn = () => !!(P().romance && P().romance.opt === true);
const ROM_WHY = ["date", "parted"];   // pass 11 HOLD 1: hidden while romance is off
export function moved(id) { const on = romOn(); return (L().hist[id] || []).filter(e => on || !ROM_WHY.includes(String(e.w).split("|")[0])).slice().reverse().map(e => ({ text: reason(e.w, whoOf(id)), up: e.d > 0, dir: e.d > 0 ? 1 : e.d < 0 ? -1 : 0, n: e.n, day: e.day })); }

// ---- journal: entry -> a line in the Lt's voice ----
const J = {
  arrival: ["{N} came aboard today. Firm handshake. I think {sub}'ll fit in.", "Met {N} off the transport. First question: where the good coffee is. Good instincts."],
  promotion: ["{S} got {pos} promotion today. I made sure I was the first to say it.", "Promotion for {S}. {Sub} pretended not to grin, and failed."],
  demotion: ["{S} lost a pip after the hearing. I'm giving {obj} room, and keeping an eye out."],
  transfer: ["{S} shipped out to {X}. I carried {pos} kit bag to the transporter room.", "Said goodbye to {S}. {X} is getting a good one."],
  death: ["We lost {S} today. I keep walking past {pos} station.", "{S} is gone. I wrote the letter home myself; it took all night."],
  injured: ["{S} took a knock ({X}). {Sub}'ll be fine; I checked twice.", "{S} was badly hurt ({X}). Sickbay needs that system stable, and so do I."],
  stable: ["{S} pulled through the night in sickbay. I breathed properly for the first time in hours."],
  healed: ["{S} is back at {pos} post. Good."],
  visit: ["Sat with {S} in sickbay for a while. We didn't talk about the injury."],
  memorial: ["Stood with {S} at the memorial service. Neither of us said much."],
  chat: ["Caught {S} between shifts; we talked longer than either of us meant to.", "{S} told me about {pos} last posting. I mostly listened.",
    "Coffee with {S}. {Sub} {has} strong opinions about replicator settings.", "Swapped stories with {S} on the deck. {Sub} won."],
  dinner: ["{S} came to dinner in my quarters. The replicator did its best; the company did better."],
  kit: ["Fixed {S}'s {X}. {Sub} looked at me like I'd done surgery."],
  oddjob: ["Lent {S} a hand with an odd job. {Sub} won't forget it."],
  praise: ["Heard {S} put in a good word for me with the captain."],
  complaint: ["{S} filed a complaint about my crews. Fair or not, I'll mend it."],
  note: ["{X}"],
  // phase 2: v = reaction index (delighted / pleased / polite / uncomfortable), x = item id|reaction
  gift: ["Gave {S} {X}. {Sub} lit up: 'You remembered.'", "Gave {S} {X}. {Sub} smiled and said thank you twice.", "Gave {S} {X}. {Sub} thanked me politely. Noted.", "Gave {S} {X}. Wrong call; {sub} tried not to show it."],
  // phase 4: romance (PG; the log stays discreet)
  signal: ["{S} said something today I keep turning over. Not as shipmates, {sub} said."],
  accepted: ["I said yes to {S}. I've been smiling at consoles all afternoon, apparently. Hale noticed.", "I said yes to {S}. Not the week for it, maybe, but {sub} understood that before I did."],   // cheer-gated: romance.js answerSignal picks [1] when !cheerful()
  declined: ["{S} asked; I said I'd rather we stayed friends. {Sub} smiled and meant it. Nothing's changed between us, and I'm glad."],
  date: ["An evening with {S}. I'm not writing the rest down.", "An evening with {S}. I think this is what they mean by 'together'."],   // legacy entries (no date type)
  // romance evenings by type (romance.js picks a variant that isn't the last one used for this crewmate; journalOf also collapses
  // exact repeats); date_quiet = an evening in the quiet period after a death (bus.js cheer gate)
  date_dinner: ["Dinner with {S} in my quarters. The replicator got {pos} favourite almost right; {sub} said it was perfect anyway.", "{S} came to dinner and stayed for the conversation. I'm not writing the rest down.",
    "Dinner for two. {S} told me a story about home I'd never heard. I want to hear the rest.", "Another dinner with {S}. We forgot the food was getting cold.", "{S} brought dessert to dinner again. I'm starting to think it's a tradition."],
  date_holosuite: ["A holosuite evening with {S}: a lakeside at dusk. {Sub} won the stone-skipping, and won't let me forget it.", "{S} picked the holosuite program tonight. I'd never have chosen it, and it was wonderful.",
    "Holosuite with {S}. We let the program's sun go down and didn't call for the exit.", "A holosuite program with {S}. Somewhere in the middle I stopped thinking about the ship."],
  date_promenade: ["Walked the Promenade with {S}. {Sub} made me try a hasperat; my eyes are still watering.", "The Promenade with {S}. We watched the wormhole open from the upper level.",
    "{S} and I walked the Promenade end to end, twice, without noticing.", "An evening on the Promenade with {S}. Quark tried to sell us something. {S} haggled him down for fun."],
  date_quiet: ["A quiet evening with {S}. We didn't talk much about the loss. {Sub} just stayed, and that helped.", "{S} sat with me tonight. No plans, no program. Just company.",
    "An evening with {S}, mostly in silence. It was the right kind of silence."],
  together: ["{S} and I aren't pretending it's casual any more."],
  disclosure: ["Filed the disclosure about {S} with the captain. Short, honest, done.", "Filed the disclosure: I hold station authority over {S} now. Okafor will write {pos} evaluations. It's right."],
  parted: ["{S} and I talked, and we're friends again. Only friends. It's all right; it really is.", "{S} ended it, gently. It was the right call, and {S} was kind about it."],
  letter: ["A letter from {S}. I read it on the observation deck.", "{S}'s last letter. I'll keep it.", "{S} is gone to a new posting. We promised to write."],
  losttouch: ["{S} and I have lost touch. It happens with postings."],   // pass 11 HOLD 1: neutral (shown with romance off)
  lostpartner: ["We lost {S}. I don't have words for the log.", "We lost {S}. I don't have words for the log. I'm keeping {pos} letters. All of them."],   // pass 11 m2: [no letters, letters]
  // phase 3: Insight
  hint: ["Noticed today: {X}.", "Something small, worth keeping: {X}."],
  beat: ["{S} brought up something that matters to {obj}. I think I got it right.", "Put my foot in it with {S} ({X}). I owe {obj} an apology."],
  apology: ["Apologised to {S}. {Sub} accepted it, and meant it."],
  care: ["Sent {S} a care package. {Sub} wrote back the same day.", "Sent {S} a care package. A short, polite reply came back."],
};
const RX = ["delighted", "pleased", "polite", "uncomfortable"];
function xText(e) {
  if (e.k === "transfer") return (POSTINGS[e.x] || {}).name || "a new posting";
  if (e.k === "injured") return e.x || "an accident";
  if (e.k === "hint" || e.k === "beat") return e.x || "a sore subject";
  if (e.k === "gift") return (GIFT[e.x.split("|")[0]] || { a: "a gift" }).a;
  return e.x || "kit";
}
export const dateTable = x => J["date_" + x] || null;   // romance evenings by type (dinner / holosuite / promenade / quiet)
export function lineOf(e) {
  const o = { ...whoOf(e.id), n: e.n }, t = (e.k === "date" && dateTable(e.x)) || J[e.k] || J.note, v = e.k === "injured" ? (e.v ? 1 : 0) : (e.v || 0) % t.length;
  return fill(t[v], o, xText(e));
}
// newest first; an entry with exactly the text of the one just after it (e.g. older saves' repeated evenings) is collapsed
// pass 11 HOLD 1: romance journal lines are hidden while romantic storylines are off (or never allowed)
export const ROM_KINDS = ["signal", "accepted", "declined", "date", "together", "disclosure", "parted", "letter", "lostpartner"];
// pass 13 minor: with romance OFF a lost partner's journal still records the death - their "lostpartner" entry (a romance kind) reads
// as the normal crewmate death entry instead of vanishing (crewEvent skips the plain one for a partner). Render-time, so old saves too.
const asOff = e => e.k === "lostpartner" ? { ...e, k: "death", v: 0 } : e;
export function journalOf(id, n = K().perCrew) { const out = [], on = romOn(); for (const e of L().journal.filter(e => e.id === id).map(e => on ? e : asOff(e)).filter(e => on || !ROM_KINDS.includes(e.k)).slice(-n).reverse()) { const text = lineOf(e); if (out.length && out[out.length - 1].text === text) continue; out.push({ day: e.d, sd: e.sd, text }); } return out; }
// the next variant for a romance evening of type x with crewmate id: none of the last two used (so any 3 evenings in a row differ)
export function nextDateVariant(id, x) {
  const t = dateTable(x); if (!t) return 0;
  const recent = L().journal.filter(e => e.id === id && e.k === "date" && e.x === x).slice(-Math.min(2, t.length - 1)).map(e => e.v % t.length);
  const ok = t.map((_, i) => i).filter(i => !recent.includes(i)); return ok[Math.floor(Math.random() * ok.length)] ?? 0;
}
export const journalCount = () => L().journal.length;
export function addEntry(id, k, x = "", v = null) {
  const lg = L(), k2 = K(), o = whoOf(id), n = o.where === "aboard" ? `${rankOf(o)} ${o.name}` : o.name || o.short || id;
  const vv = v == null ? Math.floor(Math.random() * (J[k] || J.note).length) : v;
  lg.n = lg.n || {}; lg.n[k] = (lg.n[k] || 0) + 1;
  lg.journal.push({ id, n, k, d: P().day, sd: sd(), v: vv, x: String(x || "").slice(0, 80) });
  const evict = list => { const r = list.find(e => k2.routine.includes(e.k)) || list[0]; lg.journal.splice(lg.journal.indexOf(r), 1); };   // routine first
  const mine = lg.journal.filter(e => e.id === id); if (mine.length > k2.perCrew) evict(mine);
  while (lg.journal.length > k2.journal) evict(lg.journal);
}

// ---- trend: daily snapshots; now vs. ~7 ship's days ago (or the oldest snapshot we have) ----
function snapshot() {
  const lg = L(), op = {}; for (const c of crewList()) op[c.id] = Math.round(opinionOf(c.id));
  const day = P().day, last = lg.snap[lg.snap.length - 1];
  if (last && last.day === day) last.op = op; else lg.snap.push({ day, op });
  if (lg.snap.length > K().snaps) lg.snap.splice(0, lg.snap.length - K().snaps);
}
export function trendOf(id) {
  const lg = L(), day = P().day, now = opinionOf(id);
  const s = lg.snap.filter(x => x.day <= day - K().trendDays && x.op[id] != null).pop() || lg.snap.find(x => x.op[id] != null && x.day < day);
  if (!s) return { dir: 0, label: "new page", arrow: "•" };
  const d = now - s.op[id], span = day - s.day;
  return d > K().trendDead ? { dir: 1, arrow: "▲", label: `warming (${span}d)` } : d < -K().trendDead ? { dir: -1, arrow: "▼", label: `cooling (${span}d)` } : { dir: 0, arrow: "▬", label: `steady (${span}d)` };
}
export function standing(id) { const v = opinionOf(id); return { v, label: opinionLabel(Math.round(v)), trend: trendOf(id) }; }

// ---- hooks ----
// routine entries (chats, odd jobs): one per crewmate per PROG.plog.routineEvery ship's days (lg.chat = last routine day)
function routineOk(id) { const lg = L(), day = P().day, last = lg.chat[id]; if (last != null && day - last < K().routineEvery && day >= last) return false; lg.chat[id] = day; return true; }
const KIND_OF_WHY = { visit: "visit", dinner: "dinner", memorial: "memorial", "odd job": "oddjob", praise: "praise", complaint: "complaint", kit: "kit" };
function pushHist(id, w, d) {
  const lg = L(), h = lg.hist[id] || (lg.hist[id] = []), last = h[h.length - 1];
  if (last && last.w === w) { last.d = Math.round((last.d + d) * 10) / 10; last.n++; last.day = P().day; }
  else { h.push({ w, d: Math.round(d * 10) / 10, day: P().day, n: 1 }); if (h.length > K().hist) h.splice(0, h.length - K().hist); }
}
// phase 2: gifts and care packages (written even when the +70 cap or the soft cap left nothing to add: the reaction still counts)
hooks.gift = hooks.gift || [];
hooks.gift.push(({ id, item, r, d, care }) => {
  if (!P() || !P().plog) return;
  pushHist(id, care ? `care package|${r}` : `gift|${item}|${r}`, d);
  addEntry(id, care ? "care" : "gift", care ? r : `${item}|${r}`, care ? (r === "pleased" ? 0 : 1) : Math.max(0, RX.indexOf(r)));
});
hooks.nudged.push((id, d, why) => {
  if (!P() || !P().plog) return;
  const w = String(why || "").slice(0, 80); if (!w || !d || w.startsWith("gift|")) return;   // gifts are logged by hooks.gift
  pushHist(id, w, d);
  const [key, arg] = w.split("|"), k = KIND_OF_WHY[key];
  if (k && (!K().routine.includes(k) || routineOk(id))) addEntry(id, k, arg || "");
});
hooks.crewEvent = hooks.crewEvent || [];
hooks.crewEvent.push((kind, id) => {
  const cl = P().crew.log, e = cl[cl.length - 1];
  if (!J[kind] || !e || e.id !== id) return;
  if ((kind === "death" || kind === "transfer") && P().romance && P().romance.partner === id) return;   // romance.js writes the partner's own entry (lostpartner / letters), not a second one; with romance off journalOf shows lostpartner as a plain death (pass 13)
  addEntry(id, kind, e.posting || e.cause || "");
});
hooks.crewInjured = hooks.crewInjured || [];
hooks.crewInjured.push(inj => addEntry(inj.id, "injured", inj.what || "", inj.sev === "serious" ? 1 : 0));
hooks.medEvent = hooks.medEvent || [];
hooks.medEvent.push((kind, inj) => { if (kind === "stable" || kind === "healed") addEntry(inj.id, kind); });
hooks.social.push(who => {
  if (!who || !P().crew.occ[who]) return;
  if (routineOk(who)) addEntry(who, "chat");
});
hooks.newDay.push(() => snapshot());
export function ensureSnapshot() { if (!L().snap.length) snapshot(); }

// ---- Seo: the first Former Shipmates page most players see (scripted day-2 transfer), so it is hand-written (memo §1) ----
export const HANDWRITTEN = {
  seo: [
    "Personal log, supplemental. Seo shipped out to Utopia Planitia two days after I came aboard. I barely learned how she takes her tea (milk, which is wrong).",
    "She left a padd on my console: every quirk she'd found in the deck-four EPS taps, three years of crawling through them. 'You'll need these more than I will.' I already have.",
    "She was homesick the whole time she was here, and kind about it. If I ever get to the yards, I owe her a proper drink.",
  ],
};
