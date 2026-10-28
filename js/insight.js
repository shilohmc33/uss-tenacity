// Personal Log phase 3: INSIGHT (memo §4 "Intelligence and hints"; the player-facing name is Insight, per Shiloh). Save v11 = memo "v9".
// Earned by being with people (chats, gifts, first-seen reactions, every 5 Lt levels, chess / holo-library in quarters).
// It buys knowledge, never opinion: hint rolls that reveal hidden tastes (partial = category, full = item), the ⚠ warning on
// chat-choice beats, and the opinion NUMBER in the Personal Log / CREW RELATIONS at Insight 3+. No effect on readiness or promotion.
import { G } from "./state.js";
import { log, toast } from "./bus.js";
import { PROG, hooks, nudge, opinionOf, insightLevel, freshInsight, addr } from "./progression.js";
import { GIFT, CAT_LABEL, CREW_TASTES } from "./gift-data.js";
import { knowOf, tastesFor } from "./gifts.js";
import { addEntry } from "./plog.js";
import { pr, Pr } from "./roster.js";
import { BEAT_EXTRA, beginSpeaker, tickApproach, endApproach, fillTalk, startChatSession, chatView, answerChat, dismissChat, pickChat, tickTalk, T as talkState } from "./crew-talk.js";

const P = () => G.prog, K = () => PROG.insight;
export const I = () => P().insight || (P().insight = freshInsight());
const rnd = () => Math.random();
const RX = { delighted: "d", pleased: "p", polite: "c", uncomfortable: "u" };

// ---- level and chances ----
export const level = () => I().lvl;
export function xpBand() { const L = K().levels, l = level(), lo = l ? L[l - 1] : 0, hi = L[l]; return { xp: I().xp, lo, hi: hi == null ? null : hi, frac: hi == null ? 1 : (I().xp - lo) / (hi - lo) }; }
export const hintChance = (l = level()) => K().hint.base + K().hint.per * l;
export const fullChance = (l = level()) => Math.min(1, K().hint.fullPer * l);
export const warnChance = (l = level()) => Math.min(K().beat.warnMax, K().beat.warnBase + K().beat.warnPer * l);
export const numbersShown = () => K().enabled && level() >= K().numbersAt;
export function unlocks(l = level()) {
  return [
    { at: 0, text: `Hints in conversation: ${Math.round(hintChance(l) * 100)}% a chat` },
    { at: 1, text: `Full reveals (the exact gift, not just the kind): ${Math.round(fullChance(l) * 100)}% of hints` },
    { at: 0, text: `⚠ spotted before you say the wrong thing: ${Math.round(warnChance(l) * 100)}%` },
    { at: K().numbersAt, text: "Standing shown as a number in the log and CREW RELATIONS" },
    { at: K().hint.upgradeAt, text: "A later hint turns a half-known taste into the exact gift" },
  ].map(u => ({ ...u, on: l >= u.at }));
}

function addXP(n, src) {
  const i = I(); if (!K().enabled || !n) return;
  const cap = K().dayCap[src];
  if (cap != null) {   // chats and gifts: capped per ship's day (PROG.insight.dayCap)
    if (!i.today || i.today.d !== P().day) i.today = { d: P().day, chat: 0, gift: 0 };
    n = Math.min(n, cap - i.today[src]); if (n <= 0) return; i.today[src] += n;
  }
  i.xp += n; i.n[src] = (i.n[src] || 0) + n;
  const l = insightLevel(i.xp);
  if (l > i.lvl) {
    i.lvl = l;
    const extra = l === K().numbersAt ? " You can read where you stand with people now (numbers in the log)." : l === K().hint.upgradeAt ? " Half-guesses about people sharpen into certainties." : "";
    log(`INSIGHT ${l}. You read the crew a little better.${extra}`, "good"); toast(`Insight ${l}`, "good");
  }
}
const isEmpath = id => K().empaths.includes(id) || K().empathSpecies.includes((P().crew.occ[id] || {}).species);

// ---- hint rolls (memo: 4% + 3% x Insight per chat with someone who still has hidden tastes) ----
const FIELDS = ["like1", "like2", "dislike", "avoid"];
function hidden(id) {
  const o = P().crew.occ[id]; if (!o) return [];
  const t = tastesFor(o), k = knowOf(id), up = level() >= K().hint.upgradeAt;
  return FIELDS.filter(f => (f !== "avoid" || t.avoid) && (k[f] === 0 || (k[f] === 1 && up && f !== "dislike")));
}
function note(id, t) { const i = I(); i.notes.push({ id, t, d: P().day }); if (i.notes.length > K().notes) i.notes.splice(0, i.notes.length - K().notes); }
export function rollHint(id, force = false) {
  const hid = hidden(id); if (!hid.length || (!force && rnd() >= hintChance())) return null;
  const o = P().crew.occ[id], t = tastesFor(o), k = knowOf(id), i = I();
  const f = hid[Math.floor(rnd() * hid.length)], was = k[f];
  const full = f === "dislike" || was === 1 || rnd() < fullChance();
  k[f] = full ? 2 : 1; i.n.hints++; if (full) i.n.full++; if (was === 1) i.n.upgrades++;
  let txt;
  if (f === "dislike") txt = `${o.short} doesn't care for ${CAT_LABEL[t.dislike]}`;
  else if (f === "avoid") txt = full ? `${o.short} bristles at ${t.avoid}` : `there's a subject ${o.short} would rather avoid`;
  else txt = full ? `${o.short} would love ${GIFT[t[f].item].a}` : `${o.short} would value ${CAT_LABEL[t[f].cat]}`;
  note(id, txt);
  log(`Insight: ${txt}.`, "good");
  addEntry(id, "hint", txt);
  return { f, full, txt };
}

// ---- chat-choice beats (memo: avoid ⚠ 20% + 6% x Insight, capped 80%; misstep -2 raw; apology next day repairs it) ----
export const BEATS = {
  tren: { q: "T'Ren sets down a padd. 'Your last repair: the sequence was unorthodox. Explain your reasoning.'", good: ["Walk her through the steps, one by one.", "Admit it was a gamble and show her the numbers."], bad: "'I had a hunch.'" },
  okafor: { q: "Okafor frowns at a coupling you both know is marginal. 'Do we re-seat it now, or after shift?'", good: ["'Now. I'll hold the light.'", "'After shift, and I'll log it so it's not forgotten.'"], bad: "'It's good enough.'" },
  diallo: { q: "Diallo taps a flicker on her console. 'There it is again. Third time this week.'", good: ["'Show me the logs. Let's run it down.'", "'Flag it to the science lab, with your name on it.'"], bad: "'It's just a sensor ghost.'" },
  hale: { q: "Hale is halfway through the torpedo story again. The yield has gone up since last time.", good: ["Laugh in the right places.", "Ask what happened to the gunner's mate."], bad: "Point out the numbers have changed." },
  orvin: { q: "Orvin pauses mid-sentence, a hand on the console. 'Sometimes I remember things I never did.'", good: ["'What do you remember?'", "'That sounds like a lot to carry. I'm listening.'"], bad: "'So... are you joined?'" },
  tull: { q: "Tull leans on the bench. 'Did I tell you about the time I almost got married on Risa?'", good: ["'No. Start from the beginning.'", "Pull up a stool."], bad: "'Can we skip the story?'" },
  kovac: { q: "The captain is praising the plasma-relay fix. Kovac did the hard part. The captain is looking at you.", good: ["'That was Kovac's work, sir.'", "'Kovac found it. I held the torch.'"], bad: "Accept the praise." },
  seo: { q: "Seo is staring at a picture of a harbour on her console. 'Busan. It's spring there.'", good: ["'Tell me about it.'", "'Want to replicate something from home at lunch?'"], bad: "'You'll get over missing home.'" },
  doru: { q: "Doru adjusts the small candle at his station. 'The wormhole passed close today. I felt it.'", good: ["'What did it feel like?'", "Ask him what the Prophets mean to him."], bad: "'The wormhole aliens, you mean?'" },
  rhovan: { q: "Rhovan studies you a moment. 'You're tired. You don't have to say you aren't.'", good: ["'I'm tired. Thank you for noticing.'", "Tell her what's actually on your mind."], bad: "'I'm fine, really.' (You aren't.)" },
  grevv: { q: "Grevv slams a tool down. 'Your plan for the EPS run is foolish. Defend it.'", good: ["Defend it, bluntly.", "'It is foolish. Give me a better one.'"], bad: "'With respect, if you'd be so kind, perhaps...'" },
  mollo: { q: "Mollo sighs. 'My sister wrote. Four pages. About my cousin's wedding seating.'", good: ["'Where did they put you?'", "'Read me the worst bit.'"], bad: "'Your family sounds exhausting.'" },
  vardock: { q: "Vardock has laid out a twelve-step procedure for a two-step job.", good: ["Go through it with them, step by step.", "'Which step worries you most?'"], bad: "'Just wing it.'" },
  natarajan: { q: "Natarajan straightens a stack of padds. 'Somebody in engineering called me the Captain's secretary.'", good: ["'Nothing on this ship moves without you.'", "'Want me to have a word?'"], bad: "'Well, a yeoman isn't really Starfleet.'" },
  rmira: { q: "R'Mira is tuning a stringed instrument in the mess, ears flat with concentration.", good: ["Ask her to play something.", "Sit and listen without a word."], bad: "Make a cat joke." },
  thelev: { q: "Thelev's antennae swing toward the comm panel before it chimes. 'Bridge. Wait for it.'", good: ["'Good ears. What's coming?'", "Wait for it."], bad: "Comment on her antennae." },
  delgado: { q: "Delgado slides a bowl across the counter. 'Real tomatoes. Hydroponics finally came through.'", good: ["Taste it properly and tell him why it's good.", "Ask for the recipe."], bad: "'The replicator does it better.'" },
  sorvan: { q: "Sorvan reports the experiment failed. Their voice is very even.", good: ["'What did the failure teach you?'", "'Walk me through the data.'"], bad: "'How do you feel about it?'" },
};
export const pending = () => {
  const tp = talkState().pending; if (tp && P().crew.occ[tp.who]) return { id: tp.who, chat: true, mode: tp.mode, reason: tp.reason || null };
  const b = I().beat.pending; return b && P().crew.occ[b.id] ? b : null;
};
function maybeBeat(id) {
  const i = I(), B = K().beat, day = P().day;
  if (!BEATS[id] || !P().crew.occ[id] || i.beat.pending || talkState().pending) return false;
  if (i.beat.day !== day) i.beat = { day, n: 0, pending: null };
  if (i.beat.n >= B.perDay || rnd() >= B.chance) return false;
  const order = [0, 1, 2].sort(() => rnd() - 0.5);
  // ~35% of beats become a multi-exchange chat when one exists for this crewmate (presence gated inside startChatSession)
  if (pickChat(id) && rnd() < 0.35) {
    const sess = startChatSession(id);
    if (sess) {
      i.beat.n++;
      if (sess.mode === "comm") toast(`📶 ${P().crew.occ[id].short} on comm — something on ${pr(P().crew.occ[id], "pos")} mind`, "info");
      else if (sess.mode === "near") toast(`💬 ${P().crew.occ[id].short} has something on ${pr(P().crew.occ[id], "pos")} mind`, "info");
      // approaching: beginSpeaker already toasted "coming over"
      return true;
    }
  }
  const gate = beginSpeaker(id);
  if (gate.mode === "skip") return false;
  const variant = Math.floor(rnd() * (1 + (BEAT_EXTRA[id] || []).length));
  i.beat.pending = { id, at: day, warn: rnd() < warnChance(), order, mode: gate.mode, reason: gate.reason || null, wait: gate.wait || 0, variant }; i.beat.n++;
  if (gate.mode === "comm") toast(`📶 ${P().crew.occ[id].short} on comm — something on ${pr(P().crew.occ[id], "pos")} mind`, "info");
  else if (gate.mode === "near") toast(`💬 ${P().crew.occ[id].short} has something on ${pr(P().crew.occ[id], "pos")} mind`, "info");
  return true;
}
export function startBeat(id) {
  const i = I();
  const oldB = i.beat.pending; if (oldB) endApproach(oldB.id, "replaced");
  const oldT = talkState().pending; if (oldT) endApproach(oldT.who, "replaced");
  i.beat.pending = null; talkState().pending = null; i.beat.n = 0; i.beat.day = P().day;
  return maybeBeatForced(id);
}   // tests / debug
function maybeBeatForced(id) {
  const i = I(); if (!BEATS[id] || !P().crew.occ[id]) return false;
  const gate = beginSpeaker(id);
  if (gate.mode === "skip") return false;
  const variant = Math.floor(rnd() * (1 + (BEAT_EXTRA[id] || []).length));
  i.beat.pending = { id, at: P().day, warn: rnd() < warnChance(), order: [0, 1, 2].sort(() => rnd() - 0.5), mode: gate.mode, reason: gate.reason || null, wait: gate.wait || 0, variant };
  i.beat.n++; return true;
}
/** Advance approaching beats (chats tick via tickTalk). */
export function tickBeats(dt) {
  tickTalk(dt);
  const b = I().beat.pending;
  if (b && b.mode === "approaching") {
    const m = tickApproach(b, dt);
    if (m === "skip") { endApproach(b.id, "skip"); iClearBeat(); }
  }
}
function iClearBeat() { I().beat.pending = null; }
// the modal: q + 3 replies (index 2 in BEATS terms is the avoid reply). warn: the ⚠ shows on the risky one
function beatDef(id, variant) {
  const base = BEATS[id]; if (!base) return null;
  const extra = (BEAT_EXTRA[id] || []);
  const all = [base, ...extra];
  return all[((variant % all.length) + all.length) % all.length];
}
export function beatView() {
  const b = I().beat.pending; if (!b || !P().crew.occ[b.id]) return null;
  const o = P().crew.occ[b.id];
  if (b.mode === "approaching") return { id: b.id, who: o, mode: "approaching", reason: b.reason || null, warn: false, q: null, replies: [], wait: b.wait || 0 };
  const B = beatDef(b.id, b.variant || 0) || BEATS[b.id];
  const opts = [B.good[0], B.good[1], B.bad].map(t => fillTalk(t, o));
  const mode = b.mode || "near";
  return { id: b.id, who: o, q: fillTalk(B.q, o), warn: b.warn, mode, reason: b.reason || null,
    replies: b.order.map(j => ({ j, text: opts[j], risky: j === 2, flag: j === 2 && b.warn })) };
}
export function answerBeat(j) {
  const b = pending(); if (!b) return null; const i = I(), B = K().beat, o = P().crew.occ[b.id], k = knowOf(b.id), t = tastesFor(o);
  endApproach(b.id, "finished"); i.beat.pending = null; i.n.beats++; if (b.warn) { i.n.warned++; k.avoid = 2; }
  if (j !== 2) {
    nudge(b.id, B.good, "beat|good");
    addEntry(b.id, "beat", "", 0);
    log(`${o.short} relaxes a little. You read that one right.`, "good");
    return { ok: true, good: true };
  }
  i.n.missteps++; k.avoid = 2;
  const lost = nudge(b.id, B.misstep, `misstep|${t.avoid || ""}`, true);
  i.apol[b.id] = { d: P().day, v: Math.round(-lost * 100) / 100 };
  addEntry(b.id, "beat", t.avoid || "", 1);
  note(b.id, `${o.short} bristles at ${t.avoid}`);
  log(`Wrong thing to say. ${o.short} goes quiet. (Tomorrow, you could apologise: Personal Log.)`, "fault");
  return { ok: true, good: false };
}
export function dismissBeat() { const b = I().beat.pending; if (b) endApproach(b.id, "dismiss"); I().beat.pending = null; }
// apology: available from the next ship's day for PROG.insight.beat.apologyDays days
export function apologyState(id) {
  const a = I().apol[id]; if (!a || !P().crew.occ[id]) return null; const day = P().day, d = a.d;
  if (day <= d) return { ok: false, why: "give it until tomorrow" };
  if (day - d > K().beat.apologyDays) return null;
  return { ok: true };
}
export function apologise(id) {
  const st = apologyState(id); if (!st || !st.ok) return { ok: false, why: st ? st.why : "nothing to apologise for" };
  const o = P().crew.occ[id], back = Math.min(I().apol[id].v, K().beat.apology); delete I().apol[id]; I().n.apologies++;
  // memo: "an apology the next day repairs it" -> the misstep's cost comes back in full (not through the gain pace / soft cap)
  if (back > 0) { G.prog.opinions[id] = Math.min(100, opinionOf(id) + back); for (const f of hooks.nudged) f(id, back, "apology"); }
  addEntry(id, "apology", "", 0);
  log(`You find ${o.short} and apologise. ${Pr(o)} accept${pr(o, "s")} it, ${addr()}... and mean${pr(o, "s")} it.`, "good");
  return { ok: true };
}

// ---- XP sources (memo table) ----
hooks.social.push(who => {
  if (!P() || !P().insight || !K().enabled) return;
  const X = K().xp, aboard = who && P().crew.occ[who];
  addXP(aboard && isEmpath(who) ? X.chatEmpath : X.chat, "chat");
  if (aboard) { rollHint(who); maybeBeat(who); }
});
hooks.gift.push(({ id, r, care }) => {
  if (!P() || !P().insight || care || !K().enabled) return;
  const X = K().xp, s = I().seen[id] || "", c = RX[r];
  addXP(X.gift, "gift");
  if (c && !s.includes(c)) { I().seen[id] = s + c; addXP(X.firstReaction, "react"); }
});
hooks.levelUp.push(L => { if (P() && P().insight && K().enabled && L % 5 === 0) addXP(K().xp.per5Levels, "level"); });
hooks.newDay.push(() => {
  if (!P() || !P().insight) return;
  const i = I(); if (i.beat.pending && i.beat.pending.at < P().day) { endApproach(i.beat.pending.id, "day-lapse"); i.beat.pending = null; }   // a beat lapses with the ship's day
  for (const [id, a] of Object.entries(i.apol)) if (P().day - a.d > K().beat.apologyDays || !P().crew.occ[id]) delete i.apol[id];
  const placed = Object.values((P().cabin || {}).placed || {});
  if (K().enabled) for (const d of K().decor) if (placed.includes(d)) addXP(K().xp.decorDay, "decor");
});

export { chatView, answerChat, dismissChat, startChatSession, tickTalk, endApproach, scrubSavedApproach, NEAR_PX, APPROACH_TIMEOUT } from "./crew-talk.js";
