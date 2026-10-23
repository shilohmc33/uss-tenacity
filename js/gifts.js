// Personal Log phase 2: gifts (design memo 2026-10-17 §2, phase B; save v9 here, the memo's "v8").
// Tiers and caps are the memo's, in PROG.gifts: Token 10 FR / base 2, Thoughtful 30 / 4, Personal 75 / 7 (DS9 Promenade while
// docked), Treasured 180 / 12 (Lt+, at a homeworld), care package 60 / 5 to an ex-shipmate (+10 in total at most).
// Effect = base x taste (liked x1.5 / loved x2 / disliked: -4 raw) x same item (1, 0.5, 0.25) x ship-wide (x0.5 after 3 a day)
// x occasion (x1.5), through nudge(raw): no daily cap, but gainMult 0.4 and the soft cap apply, and a gift stops at +70.
// One gift per person per 2 ship's days. A reaction always reveals the taste it touched (partial = category, full = the item).
// The gift-driven part of an opinion (gifts.giftOp) counts 50% toward board readiness and the Fleet Reputation of a transfer.
import { G } from "./state.js";
import { log, toast } from "./bus.js";
import { moodlet } from "./mood.js";
import { PROG, hooks, nudge, opinionOf, spend, canAfford, addr, crewTouch } from "./progression.js";
import { GIFT, GIFT_ITEMS, CAT_LABEL, tastesOf, L2_ALT } from "./gift-data.js";
import { pr, Pr, POSTINGS } from "./roster.js";
import { DESTS } from "./data.js";

const P = () => G.prog, K = () => PROG.gifts, Gs = () => P().gifts;
export const tierOf = it => K().tiers[it.tier];
export const priceOf = it => tierOf(it).cost;
hooks.gift = hooks.gift || [];

export function whoOf(id) {
  const p = P(), o = p.crew.occ[id]; if (o) return { o, alum: false };
  const a = p.alumni.slice().reverse().find(x => x.id === id); return a ? { o: a, alum: true } : null;
}
// memo §4: the second like is seeded per save (pool of 3), assigned lazily; v11 migration pins pool 0 where it was already learned
export function l2Of(id) { const I = P().insight; if (!I || !L2_ALT[id]) return 0; if (I.l2[id] == null) I.l2[id] = hash(`${Gs().seed}:l2:${id}`) % 3; return I.l2[id]; }
export const tastesFor = o => o ? tastesOf(o, l2Of(o.id)) : null;
export function knowOf(id) { const k = P().know; return k[id] || (k[id] = { like1: 0, like2: 0, dislike: 0, avoid: 0 }); }
// what the Lt knows, for the log page: [{ state 0/1/2, text }] x2 likes + the dislike
export function knownTastes(id) {
  const w = whoOf(id); if (!w) return null; const t = tastesFor(w.o), k = P().know[id] || {};
  const like = f => k[f] === 2 ? { state: 2, text: GIFT[t[f].item].name } : k[f] === 1 ? { state: 1, text: CAT_LABEL[t[f].cat] } : { state: 0, text: "unknown" };
  const avoid = !t.avoid ? null : k.avoid === 2 ? { state: 2, text: t.avoid } : k.avoid === 1 ? { state: 1, text: "a sore subject (not sure what)" } : { state: 0, text: "unknown" };   // phase 3: Insight hints / ⚠ / missteps
  return { likes: [like("like1"), like("like2")], dislike: k.dislike ? { state: 2, text: CAT_LABEL[t.dislike] } : { state: 0, text: "unknown" }, avoid };
}
export function cooldownLeft(id) { const l = Gs().last[id]; return l == null ? 0 : Math.max(0, K().cooldown - (P().day - l)); }
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
export const birthdayOf = id => hash(`${Gs().seed}:${id}`) % K().year;   // a ship's day of the (60-day) year
export function occasionOf(o) {
  const p = P(), Y = K().year;
  const mk = (why, text, note) => ({ mult: K().occasion, why, text, note });
  if (p.day % Y === birthdayOf(o.id)) return mk("birthday", `${pr(o, "pos")} birthday`, `It's ${pr(o, "pos")} birthday`);
  if ((p.crew.log || []).some(e => e && e.kind === "promotion" && e.id === o.id && p.day - e.day <= K().promoDays && p.day >= e.day)) return mk("promotion", `${pr(o, "pos")} promotion`, `It's ${pr(o, "pos")} promotion`);
  // pt07 m3: homesick is a spell, not a permanent occasion: K().homesickDays ship's days in every K().homesickEvery (seeded per save + crewmate)
  if ((o.tags || []).includes("homesick") && homesickNow(o.id)) { const S = Pr(o); return mk("homesick", `${pr(o, "pos")} homesick spell`, `${S}${S === "They" ? "'re" : "'s"} missing home`); }   // pt07 m2: "She's missing home."
  return null;
}
export const homesickNow = id => { const E = K().homesickEvery, ph = hash(`${Gs().seed}:home:${id}`) % E; return ((P().day - ph) % E + E) % E < K().homesickDays; };
// ---- where gifts come from ----
export function shopState() {
  const SP = G.sp, here = SP && !SP.travel && !SP.battle ? SP.location : null;
  return { docked: here === "ds9", homeworld: here && DESTS[here] && DESTS[here].visit ? here : null };
}
export const lockerCount = () => Object.values(Gs().inv).reduce((a, b) => a + b, 0);
export function buyState(it) {   // Personal / Treasured into the gift locker (galley tiers are bought as you give them)
  const T = tierOf(it), sh = shopState();
  if (T.src === "galley") return { ok: false, why: "from the galley, as you give it" };
  if (T.src === "promenade" && !sh.docked) return { ok: false, why: "DS9 Promenade, while docked" };
  if (T.src === "homeworld") {
    if (P().rank < (T.minRank || 0)) return { ok: false, why: "Lt and up" };
    if (sh.homeworld !== it.at) return { ok: false, why: `on a visit to ${DESTS[it.at].name}` };
  }
  if (lockerCount() >= K().invMax) return { ok: false, why: `gift locker full (${K().invMax})` };
  if (!canAfford({ rations: T.cost })) return { ok: false, why: `${T.cost} ${PROG.currency.short} needed` };
  return { ok: true };
}
export function buyForLocker(itemId) {
  const it = GIFT[itemId]; if (!it || !buyState(it).ok || !spend({ rations: priceOf(it) }, "gift")) return false;
  const g = Gs(); g.inv[itemId] = (g.inv[itemId] || 0) + 1; g.n.spent += priceOf(it);
  toast(`${it.name} → gift locker (−${priceOf(it)} ${PROG.currency.short})`, "good"); return true;
}
// what giving `it` to `id` would be, from what the Lt KNOWS (never from hidden data): "loved" / "liked" / "disliked" / null
export function knownHint(id, it) {
  const w = whoOf(id); if (!w) return null; const t = tastesFor(w.o), k = P().know[id] || {};
  if (k.dislike && it.cats.includes(t.dislike)) return "disliked";
  for (const f of ["like1", "like2"]) if (k[f] === 2 && t[f].item === it.id) return tierOf(it).loved ? "loved" : "liked";
  for (const f of ["like1", "like2"]) if (k[f] >= 1 && it.cats.includes(t[f].cat)) return "liked";
  return null;
}
export function giftOptions(id) {
  const g = Gs(), out = [];
  for (const it of GIFT_ITEMS) {
    const T = tierOf(it), inLocker = g.inv[it.id] || 0;
    const ok = inLocker > 0 || (T.src === "galley" && canAfford({ rations: T.cost }));
    out.push({ it, tier: T, inLocker, src: inLocker ? "locker" : T.src, ok, hint: knownHint(id, it), price: inLocker ? 0 : T.cost,
      why: ok ? "" : T.src === "galley" ? `${T.cost} ${PROG.currency.short} needed` : buyState(it).why });
  }
  return out;
}
export function giveState(id) {
  const w = whoOf(id); if (!w || w.alum) return { ok: false, why: "not aboard" };
  const cd = cooldownLeft(id); if (cd > 0) return { ok: false, why: `next gift in ${cd} ship's day${cd > 1 ? "s" : ""}` };
  return { ok: true };
}
const LINES = {
  delighted: "{S} turns {A} over twice. '{lt}... you remembered.' {Sub} {is} delighted.",
  pleased: "{S} smiles at {A}. 'That's thoughtful, {lt}. Thank you.' {Sub} {is} pleased.",
  polite: "{S} thanks you for {A}, politely, and sets it aside.",
  uncomfortable: "{S} looks at {A} a moment too long. 'That's... kind.' {Sub} {is} uncomfortable.",
};
const fillL = (t, o, it) => t.replace(/\{S\}/g, o.short).replace(/\{A\}/g, it.a).replace(/\{lt\}/g, addr()).replace(/\{Sub\}/g, Pr(o)).replace(/\{is\}/g, pr(o, "is"));
export function giveGift(id, itemId) {
  const it = GIFT[itemId], st = giveState(id); if (!it || !st.ok) return { ok: false, why: st.why || "unknown gift" };
  const g = Gs(), K_ = K(), T = tierOf(it), o = P().crew.occ[id], p = P();
  // pay: the gift locker first, else the galley replicator
  if ((g.inv[itemId] || 0) > 0) { if (--g.inv[itemId] <= 0) delete g.inv[itemId]; }
  else if (T.src !== "galley" || !spend({ rations: T.cost }, "gift")) return { ok: false, why: T.src === "galley" ? `${T.cost} ${PROG.currency.short} needed` : buyState(it).ok ? "buy it for the gift locker first" : buyState(it).why };
  else g.n.spent += T.cost;
  const t = tastesFor(o), k = knowOf(id), learned = [];
  let r, mult = 1, reveal = false;
  if (it.cats.includes(t.dislike)) { r = "uncomfortable"; if (!k.dislike) { k.dislike = 2; learned.push(`${o.short} doesn't care for ${CAT_LABEL[t.dislike]}`); } }
  else {
    const hits = ["like1", "like2"].map(f => ({ f, L: t[f], exact: t[f].item === it.id, cat: it.cats.includes(t[f].cat) })).filter(h => h.exact || h.cat);
    if (hits.some(h => h.exact && k[h.f] === 2) && T.loved) { r = "delighted"; mult = K_.loved; }
    else if (hits.length) { r = "pleased"; mult = K_.liked; }
    else r = "polite";
    reveal = !!T.loved && r !== "delighted" && hits.some(h => h.exact && k[h.f] < 2);   // pt07 m5: this gift reveals a loved item
    for (const h of hits) { const nv = h.exact ? 2 : 1; if (k[h.f] < nv) { k[h.f] = nv; learned.push(nv === 2 ? `${o.short} would love ${GIFT[h.L.item].a}` : `${o.short} would value ${CAT_LABEL[h.L.cat]}`); } }
  }
  const cnt = (g.count[id] = g.count[id] || {}), n0 = cnt[itemId] || 0, same = K_.sameItem[Math.min(n0, K_.sameItem.length - 1)];
  if (g.day.d !== p.day) g.day = { d: p.day, n: 0 };
  const ship = g.day.n >= K_.shipFull ? K_.shipAfter : 1, occ = occasionOf(o);
  const why = `gift|${itemId}|${r}`;
  const d = r === "uncomfortable" ? nudge(id, K_.disliked, why, true) : nudge(id, T.base * mult * same * ship * (occ ? occ.mult : 1), why, true, K_.cap);
  if (d > 0) g.giftOp[id] = Math.min((g.giftOp[id] || 0) + d, Math.max(0, opinionOf(id)));
  moodlet(id, r === "uncomfortable" ? "giftBad" : r === "delighted" ? "giftLoved" : "gift");   // N2
  if (!reveal) cnt[itemId] = n0 + 1;   // pt07 m5: the gift that reveals a loved item doesn't start the repeat decay, so the first 'loved ×2' gift is full value
  g.day.n++; g.last[id] = p.day; g.n.given++; g.n.opinion += Math.max(0, d);
  g.lastR[id] = { item: itemId, r, day: p.day, d: Math.round(d * 10) / 10 };
  let line = fillL(LINES[r], o, it);
  if (n0 && r !== "uncomfortable") line += ` '${n0 === 1 ? "You gave me one of these already." : "Another one? I'll find a place for it."}'`;
  if (occ && r !== "uncomfortable") line += ` (${occ.note}.)`;
  if (d === 0 && r !== "uncomfortable" && opinionOf(id) >= K_.cap - 0.5) line += " Gifts won't take you any closer; the rest has to be earned.";
  log(line + (learned.length ? ` You learned: ${learned.join("; ")}.` : ""), r === "uncomfortable" ? "fault" : "good");
  toast(`${o.short}: ${r}`, r === "uncomfortable" ? "warn" : "good");
  hooks.gift.forEach(f => f({ id, item: itemId, r, d, care: false }));
  crewTouch();
  return { ok: true, r, d, line, learned, occ: occ && occ.why };
}
// ---- care package to an ex-shipmate (memo §1/§2): raises the frozen alumni opinion, never the Fleet Reputation already banked ----
export function careState(id) {
  const w = whoOf(id); if (!w || !w.alum) return { ok: false, why: "not an ex-shipmate" };
  const left = K().care.max - (Gs().care[id] || 0); if (left <= 0.05) return { ok: false, why: `${w.o.short} has had all the care packages that help (+${K().care.max})` };
  const cd = cooldownLeft(id); if (cd > 0) return { ok: false, why: `next package in ${cd} ship's day${cd > 1 ? "s" : ""}` };
  if (!canAfford({ rations: K().care.cost })) return { ok: false, why: `${K().care.cost} ${PROG.currency.short} needed` };
  return { ok: true, left };
}
export function sendCare(id) {
  const st = careState(id); if (!st.ok || !spend({ rations: K().care.cost }, "gift")) return { ok: false, why: st.why };
  const g = Gs(), a = whoOf(id).o, k = P().know[id] || {}, O = PROG.opinion;
  const liked = k.like1 >= 1 || k.like2 >= 1;   // the Lt packs what they know the ex-shipmate likes
  let d = K().care.base * (liked ? K().liked : 1) * (O.gainMult ?? 1) * Math.max(0.1, 1 - Math.max(0, a.opinion) / O.soft);
  d = Math.round(Math.min(d, st.left, 100 - a.opinion) * 10) / 10;
  for (const al of P().alumni) if (al.id === id) al.opinion = Math.round((al.opinion + d) * 10) / 10;
  g.care[id] = (g.care[id] || 0) + d; g.last[id] = P().day; g.n.care++; g.n.careSpent += K().care.cost;
  const r = liked ? "pleased" : "polite";
  g.lastR[id] = { item: "care", r, day: P().day, d };
  log(`Care package to ${a.short} at ${(POSTINGS[a.posting] || {}).name || "the new posting"}: ${liked ? `packed with the things ${pr(a)} like${pr(a, "s")}. A reply comes back the same day.` : "a reply comes back, polite and brief."}`, "good");
  toast(`Care package → ${a.short} (−${K().care.cost} ${PROG.currency.short})`, "good");
  hooks.gift.forEach(f => f({ id, item: "care", r, d, care: true }));
  return { ok: true, d, r };
}
