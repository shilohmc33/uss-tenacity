// Wave A/B/C/D Lt activities (Oct 30): meals/cards/quests, duty/repair/mentor/log, show-in/spar, DS9 shore evenings + away missions.
// Real-day slots via localDate + badClock; never advances while away/idle; speakers use crew-talk presence.
import { G } from "./state.js";
import { PROG, addHardener, localDate, opinionOf, nudge, spend, canAfford, awardXP, addr } from "./progression.js";
import { badClock, BAD_CLOCK_WHY } from "./clock.js";
import { isPresent, idlePaused } from "./pacing.js";
import { toast, log } from "./bus.js";
import { inviteChance, inviteWord } from "./holodeck.js";
import { needsOf } from "./needs.js";
import { addEntry } from "./plog.js";
import { SLOTMAP } from "./roster.js";
import { beginSpeaker, endApproach, speakerPresence, speakerNpc } from "./crew-talk.js";
import { holdAtSeat, clearLtActHold, seatWalkArrived, npcOf, seatedOn, ambient } from "./npc-ambient.js";
import { NODEMAP, DECKS, CREW_SPAR_SHEETS, CREW_SPAR_XSHIFT, CHAR_FRAMES, LT2_DIRS, LT2_CELL, LT2_STAND_H, OWN_SHEETS, PHASER_SHEET, CHAR_SHEETS } from "./data.js";
import { IMG } from "./assets.js";
import { findPath } from "./path.js";
import { sendUse } from "./crew.js";
import { atDS9, C as careC } from "./crewcare.js";
import { hasQ } from "./mood.js";
import { fixKit } from "./crewlife.js";
import { DECOR as decorOfMap } from "./cabin-data.js";
const decorOf = id => decorOfMap[id] || null;

const P = () => G.prog;
const occ = id => P().crew && P().crew.occ[id];
const injured = () => new Set(((P().med && P().med.inj) || []).map(x => x.id));
const aboard = () => Object.values(P().crew.slots || {}).filter(id => id && occ(id));
const dOf = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const rnd = a => a[Math.floor(Math.random() * a.length)];

export const MEAL_COST = { rations: 20 };
export const CARD_ANTE = { rations: 8 };
export const MEAL_XP = 4, CARD_XP = 3, QUEST_XP = 12;
export const DUTY_XP = 6, MENTOR_XP = 5, LOG_XP = 2, REPAIR_CALL_XP = 5;
export const SHOW_XP = 4, SPAR_XP = 5;
export const SHORE_XP = 8, AWAY_XP = 14, PHASER_XP = 4;
export const sparArtOn = () => !!(PROG.ltAct && PROG.ltAct.sparArt);
export const gymRoomOn = () => !!(PROG.ltAct && PROG.ltAct.gymRoom);
export const decorArtOn = () => !!(PROG.ltAct && PROG.ltAct.decorArt);
export const awayArtOn = () => !!(PROG.ltAct && PROG.ltAct.awayArt);
export const ds9ArtOn = () => !!(PROG.ltAct && PROG.ltAct.ds9Art);
export const crewSparArtOn = () => !!(PROG.ltAct && PROG.ltAct.crewSparArt);
export const phaserArtOn = () => !!(PROG.ltAct && PROG.ltAct.phaserArt);

/** Register lt phaser CHAR_FRAMES when IMG[lt-phaser-v1] is loaded (no IMAGES preload — flag OFF until approved). */
export function ensureLtPhaserFrames() {
  const P = PHASER_SHEET; if (!P || !IMG[P.img] || !IMG[P.img].width) return false;
  const F = CHAR_FRAMES.lt || (CHAR_FRAMES.lt = {});
  if (F.phaser && F.phaser.down) return true;
  const C = P.cell || LT2_CELL;
  // Append as next action row index after existing lt actions on this sheet alone
  F.phaser = {};
  LT2_DIRS.forEach((dir, col) => {
    F.phaser[dir] = [0, 1, 2].map(k => ({ img: P.img, x: col * C.w, y: k * C.h,
      w: C.w, h: C.h, ax: C.ax, ay: C.ay, refH: LT2_STAND_H }));
  });
  // Also stash on CHAR_SHEETS for tooling (does not affect IMAGES — already built)
  try { if (CHAR_SHEETS.lt && !CHAR_SHEETS.lt[P.img]) CHAR_SHEETS.lt[P.img] = [P.action]; } catch (e) {}
  return true;
}
export function phaserMuzzle(dir = "down") {
  const P = PHASER_SHEET; const m = P && P.muzzle_px && P.muzzle_px[dir];
  return m ? { x: m[0], y: m[1] } : { x: 80, y: 200 };
}
// Sparring stand-in: open floor west of Mess tables (lounge). Gym deck gated behind gymRoom.
const SPAR_SPOT_LOUNGE = { deck: "lounge", x: 0.18, y: 0.58, face: "right", guestFace: "left" };
// Gym mat centre (gym_spots.json spar_mat_px 288,212-622,488 → mid 455,350)
const SPAR_SPOT_GYM = { deck: "gym", x: 455 / 960, y: 350 / 640, face: "right", guestFace: "left" };
export function sparSpot() { return gymRoomOn() ? SPAR_SPOT_GYM : SPAR_SPOT_LOUNGE; }
/** @deprecated use sparSpot() — kept as live getter for checks that read .deck/.x */
export const SPAR_SPOT = new Proxy({}, { get: (_, k) => sparSpot()[k] });

/** Adjacent south-facing lounge seats for meal/cards guests (Lt keeps mess / their node). */
export function pickGuestSeat(ltNode = "mess") {
  const pref = {
    mess: ["table1", "table3", "table5", "table6", "table4"],
    table1: ["mess", "table3", "table4", "table5"],
    table3: ["mess", "table1", "table6", "table5"],
    table4: ["table1", "mess", "table5", "table6"],
    table5: ["table4", "table6", "mess", "table1"],
    table6: ["table5", "table3", "mess", "table4"],
    bar: ["table1", "table3", "mess", "table5", "table6"],
  };
  const order = pref[ltNode] || pref.mess;
  const taken = new Set();
  for (const a of ambient) {
    if (a && a._ltActHold && a._ltActHold.seat) taken.add(a._ltActHold.seat);
    if (a && a.spot && a.spot.seat && a.mode === "dwell") taken.add(a.spot.seat);
  }
  const L = G.lt; if (L && L.mode === "use" && L.node) taken.add(L.node);
  for (const id of order) {
    if (taken.has(id)) continue;
    const nd = NODEMAP[id]; if (nd && nd.seat) return id;
  }
  for (const id of TABLE_NODES) { const nd = NODEMAP[id]; if (nd && nd.seat && id !== ltNode) return id; }
  return "table1";
}

function guestSeatReady(id) {
  const n = npcOf(id); if (!n || !n._ltActHold) return false;
  if (n.mode === "walk" && n.next === "ltActSeat") return false;
  return seatWalkArrived(id) || (n.mode === "dwell" && n.spot && n.spot.seat === n._ltActHold.seat);
}


/** Wave C: pin show-in guest on the quarters south-facing guest chair. */
export function seatGuestForShow(id) {
  const nd = NODEMAP.guest;
  if (!nd || !nd.seat || nd.deck !== "quarters") return { mode: "comm", why: "no-seat" };
  const st = nd.seat.stand;
  const n = npcOf(id);
  if (!n) return { mode: "comm", why: "missing" };
  if (injured().has(id)) return { mode: "comm", why: "injured" };
  // Bring onto quarters if needed
  if (n.deck !== "quarters") { n.deck = "quarters"; n.x = null; n.y = null; }
  const r = holdAtSeat(id, "guest", "talk");
  if (!r || !r.ok) return { mode: "comm", why: "no-seat" };
  if (r.arrived) return { mode: "near", seat: "guest" };
  // Snap if already nearby
  if (n.x != null) {
    const dist = Math.hypot((n.x - st[0]) * 960, (n.y - st[1]) * 640);
    if (dist <= 160) {
      holdAtSeat(id, "guest", "talk");
      const n2 = npcOf(id);
      if (n2) {
        n2.x = st[0]; n2.y = st[1]; n2.path = null; n2.mode = "dwell"; n2.t = 1e9; n2.dir = "down";
        n2.spot = { id: "ltact-guest", x: st[0], y: st[1], face: "down", action: "talk", seat: "guest", t: [1e9, 1e9] };
        n2.action = "talk"; n2.next = null;
      }
      return { mode: "near", seat: "guest" };
    }
  }
  return { mode: "approaching", seat: "guest" };
}

/** Walk guest to a south-facing table seat; only COMM if unreachable (no path / injured / missing). */
export function seatGuestForAct(id, kind = "meal") {
  const n = npcOf(id);
  if (!n) return { mode: "skip", why: "not aboard" };
  if (injured().has(id)) return { mode: "comm", why: "injured" };
  const L = G.lt;
  if (!L || L.lift) return { mode: "comm", why: "lt-in-lift" };
  // Meals/cards happen in the Mess — bring guest onto lounge if needed
  if (n.deck !== "lounge") {
    const lf = DECKS.lounge.lift;
    n.deck = "lounge"; n.hidden = false; n.arrive = false; n.path = null;
    n.x = lf.mx || lf.x; n.y = lf.my || lf.y;
  }
  const ltNode = (L.deck === "lounge" && L.mode === "use" && TABLE_NODES.includes(L.node)) ? L.node
    : (kind === "cards" ? "bar" : "mess");
  // Ensure Lt is seated at mess (meals) — cards: prefer a table if at bar
  if (kind === "meal" && L.deck === "lounge") {
    try { if (L.mode !== "use" || L.node !== "mess") sendUse("mess"); } catch (e) {}
  }
  const seatId = pickGuestSeat(ltNode === "bar" ? "mess" : ltNode);
  const nd = NODEMAP[seatId];
  const st = nd.seat.stand;
  const distSeat = Math.hypot((n.x - st[0]) * 960, (n.y - st[1]) * 640);
  const distLt = Math.hypot((n.x - L.x) * 960, (n.y - L.y) * 640);
  const path = findPath("lounge", n.x, n.y, st[0], st[1]);
  if ((!path || !path.length) && distSeat > 80) {
    return { mode: "comm", why: "no-path" };
  }
  // Already near the Mess / seat: snap into the chair facing south (no COMM soft-fallback)
  if (distSeat <= 160 || distLt <= 120) {
    const r = holdAtSeat(id, seatId, kind === "cards" ? "talk" : "eat");
    if (!r || !r.ok) return { mode: "comm", why: "no-seat" };
    const n2 = npcOf(id);
    if (n2) {
      n2.x = st[0]; n2.y = st[1]; n2.path = null; n2.mode = "dwell"; n2.t = 1e9; n2.dir = "down";
      n2.spot = { id: "ltact-" + seatId, x: st[0], y: st[1], face: "down", action: kind === "cards" ? "talk" : "eat", seat: seatId, t: [1e9, 1e9] };
      n2.action = kind === "cards" ? "talk" : "eat"; n2.next = null;
    }
    return { mode: "near", seat: seatId };
  }
  const r = holdAtSeat(id, seatId, kind === "cards" ? "talk" : "eat");
  if (!r || !r.ok) return { mode: "comm", why: "no-seat" };
  if (r.arrived) return { mode: "near", seat: seatId };
  return { mode: "approaching", seat: seatId };
}

function releaseActSeats(s) {
  const who = s && (s.guest || s.who); if (who) { clearLtActHold(who); endApproach(who, "finished"); }
}


const TABLE_NODES = ["mess", "table1", "table3", "table4", "table5", "table6"];
export const WATCH_NODES = {
  bridge: ["conn", "ops", "tactical"],
  engineering: ["core", "shield"],
  medical: ["biobed"],
};
export const nodeFamily = node => {
  for (const [fam, nodes] of Object.entries(WATCH_NODES)) if (nodes.includes(node)) return fam;
  return null;
};
export const OWNER_BY_FAMILY = { bridge: "tren", engineering: "okafor", medical: "orvin" };

export const freshLtAct = () => ({
  meal: { d: "", n: 0, invite: null },
  cards: { d: "", n: 0, invite: null, game: null },
  quest: { active: null, done: {}, offer: null },
  duty: { d: "", fams: {} },          // fams[family] = n used today
  repair: { d: "", n: 0, active: null }, // active = { id, item, who } accepted call
  mentor: { d: "", n: 0, invite: null },
  log: { d: "", n: 0 },
  show: { d: "", n: 0, invite: null }, // quarters show-in
  spar: { d: "", n: 0, invite: null }, // sparring bout
  shore: { d: "", n: 0, invite: null, pick: null, visitDone: false }, // DS9 shore evening
  away: { d: "", n: 0, invite: null, mission: null }, // present away team
  phaser: { d: "", n: 0 }, // gym phaser range
  writes: [],                         // Lt-authored log scraps
  everDS9: false,
  n: { meals: 0, cards: 0, quests: 0, duty: 0, repairs: 0, mentor: 0, logs: 0, shows: 0, spars: 0, shores: 0, aways: 0, phasers: 0 },
  session: null,
});

export const A = () => { const p = P(); if (!p.ltAct || typeof p.ltAct !== "object") p.ltAct = freshLtAct(); return p.ltAct; };

export function hardenLtAct(p) {
  const s = p.ltAct && typeof p.ltAct === "object" ? p.ltAct : {}, f = freshLtAct();
  const today = localDate();
  const day = (o) => {
    const d = dOf(o && o.d) || "";
    const n = clamp(Math.floor(+(o && o.n) || 0), 0, 99);
    let invite = null;
    // Keep same-day invite rolls across harden/reload (Wave A NO-SHIP #3)
    if (d && d >= today && o && o.invite && typeof o.invite === "object") {
      const rolls = {};
      if (o.invite.rolls && typeof o.invite.rolls === "object") {
        for (const [k, v] of Object.entries(o.invite.rolls)) if (occ(k) || k === "solo") rolls[k] = !!v;
      }
      const guest = o.invite.guest === "solo" ? "solo" : (o.invite.guest && occ(o.invite.guest) ? o.invite.guest : null);
      invite = { rolls, nos: clamp(Math.floor(+(o.invite.nos) || 0), 0, 9), guest };
    }
    return { d, n, invite };
  };
  f.meal = day(s.meal); f.cards = Object.assign(day(s.cards), { game: null });
  f.mentor = day(s.mentor); f.log = { d: dOf(s.log && s.log.d) || "", n: clamp(Math.floor(+(s.log && s.log.n) || 0), 0, 99) };
  f.show = day(s.show); f.spar = day(s.spar);
  f.shore = Object.assign(day(s.shore), { pick: null, visitDone: !!(s.shore && s.shore.visitDone) });
  f.away = Object.assign(day(s.away), { mission: null });
  f.phaser = { d: dOf(s.phaser && s.phaser.d) || "", n: clamp(Math.floor(+(s.phaser && s.phaser.n) || 0), 0, 99) };
  f.duty = { d: dOf(s.duty && s.duty.d) || "", fams: {} };
  if (s.duty && s.duty.fams && typeof s.duty.fams === "object") {
    for (const [k, v] of Object.entries(s.duty.fams)) if (WATCH_NODES[k]) f.duty.fams[k] = clamp(Math.floor(+v || 0), 0, 9);
  }
  f.repair = { d: dOf(s.repair && s.repair.d) || "", n: clamp(Math.floor(+(s.repair && s.repair.n) || 0), 0, 9), active: null };
  if (s.repair && s.repair.active && typeof s.repair.active === "object" && occ(s.repair.active.who)) {
    f.repair.active = { who: s.repair.active.who, item: String(s.repair.active.item || "kit").slice(0, 80) };
  }
  f.everDS9 = !!s.everDS9;
  const nn = s.n || {};
  f.n = { meals: clamp(Math.floor(+nn.meals || 0), 0, 1e6), cards: clamp(Math.floor(+nn.cards || 0), 0, 1e6), quests: clamp(Math.floor(+nn.quests || 0), 0, 1e6),
    duty: clamp(Math.floor(+nn.duty || 0), 0, 1e6), repairs: clamp(Math.floor(+nn.repairs || 0), 0, 1e6), mentor: clamp(Math.floor(+nn.mentor || 0), 0, 1e6), logs: clamp(Math.floor(+nn.logs || 0), 0, 1e6),
    shows: clamp(Math.floor(+nn.shows || 0), 0, 1e6), spars: clamp(Math.floor(+nn.spars || 0), 0, 1e6),
    shores: clamp(Math.floor(+nn.shores || 0), 0, 1e6), aways: clamp(Math.floor(+nn.aways || 0), 0, 1e6),
    phasers: clamp(Math.floor(+nn.phasers || 0), 0, 1e6) };
  const done = {};
  if (s.quest && s.quest.done && typeof s.quest.done === "object") {
    for (const [k, v] of Object.entries(s.quest.done)) if (dOf(v)) done[k] = v;
  }
  let active = null;
  if (s.quest && s.quest.active && typeof s.quest.active === "object" && QUESTS[s.quest.active.id] && occ(s.quest.active.who)) {
    active = { id: s.quest.active.id, who: s.quest.active.who, step: clamp(Math.floor(+s.quest.active.step || 0), 0, 8) };
  }
  f.quest = { active, done, offer: null };
  f.writes = Array.isArray(s.writes) ? s.writes.filter(w => w && typeof w.text === "string").slice(-20).map(w => ({ d: dOf(w.d) || "", text: String(w.text).slice(0, 280), who: w.who && occ(w.who) ? w.who : null })) : [];
  f.session = null;
  p.ltAct = f;
}
addHardener(hardenLtAct);

function daySlot(rec, at = new Date()) {
  const d = localDate(at);
  if (dOf(rec.d) && dOf(rec.d) >= d) return rec;
  rec.d = d; rec.n = 0; rec.invite = null; if ("game" in rec) rec.game = null;
  return rec;
}
export const mealLeft = (at) => { const r = daySlot(A().meal, at); return Math.max(0, 1 - (r.n | 0)); };
export const cardsLeft = (at) => { const r = daySlot(A().cards, at); return Math.max(0, 1 - (r.n | 0)); };

export function tickLtAct() {
  if (atDS9()) A().everDS9 = true;
  else if (A().shore) A().shore.visitDone = false;   // new dock visit gets a fresh evening
  // LOW: undock / under way aborts an in-progress away mission cleanly
  const s = A().session;
  if (s && s.kind === "away") {
    const underway = !!(G.sp && (G.sp.travel || G.sp.battle || G.sp.alert || !G.sp.location));
    if (underway) abortAway("Ship under way — away team recalled.");
  }
  // Pin spar guest on the mat so they stay in frame with the Lt
  if (s && s.kind === "spar" && s.phase === "chat" && s.mode === "near" && s.guest) pinSparGuest(s.guest);
  // no offline accrual — present-only; session freezes when not present
}

export function abortAway(why = "Away team recalled.") {
  const s = A().session; if (!s || s.kind !== "away") return;
  const who = s.guest; if (who) endApproach(who, "abort");
  log(why, "warn"); toast(why, "warn");
  daySlot(A().away).invite = null; A().away.mission = null; A().session = null;
}

function dayRec(rec, at = new Date()) {
  const d = localDate(at);
  if (dOf(rec.d) && dOf(rec.d) >= d) return rec;
  rec.d = d; rec.n = 0;
  if (rec.fams) rec.fams = {};
  if ("invite" in rec) rec.invite = null;
  if ("active" in rec && rec.n === 0) { /* keep active call across midnight? drop */ rec.active = null; }
  return rec;
}


export function blockedWhy() {
  if (badClock()) return BAD_CLOCK_WHY;
  if (G.sp && (G.sp.battle || G.sp.alert)) return "not during red alert";
  if (!isPresent() || idlePaused()) return "come back on watch";
  return null;
}

export function nearTable() {
  const L = G.lt; if (!L || L.deck !== "lounge" || L.lift) return false;
  if (L.mode === "use" && TABLE_NODES.includes(L.node)) return true;
  // near any table stand spot
  for (const id of TABLE_NODES) {
    const n = DECKS.lounge.nodes[id]; if (!n) continue;
    const dx = (L.x - n.x) * 960, dy = (L.y - n.y) * 640;
    if (Math.hypot(dx, dy) <= 70) return true;
  }
  return false;
}
export function nearBar() {
  const L = G.lt; if (!L || L.deck !== "lounge" || L.lift) return false;
  const n = DECKS.lounge.nodes.bar; if (!n) return L.mode === "use" && L.node === "bar";
  if (L.mode === "use" && L.node === "bar") return true;
  return Math.hypot((L.x - n.x) * 960, (L.y - n.y) * 640) <= 80;
}

export function mealChipOk() {
  return !blockedWhy() && mealLeft() > 0 && nearTable() && canAfford(MEAL_COST);
}
export function cardsChipOk() {
  return !blockedWhy() && cardsLeft() > 0 && (nearBar() || nearTable()) && canAfford(CARD_ANTE);
}

export function inviteTargets(kind = "meal") {
  const inj = injured();
  const ids = aboard().filter(id => occ(id) && !inj.has(id));
  // Prefer off-shift / awake, but never empty the list if everyone is on duty
  const ranked = ids.map(id => {
    const r = needsOf(id); let score = 0;
    if (r.act !== "sleep") score += 2;
    if (r.act === "eat" || r.act === "fun") score += 2;
    if (r.shift !== undefined) score += 1;
    return { id, score };
  }).sort((a, b) => b.score - a.score);
  return ranked.map(({ id }) => {   // Wave A NO-SHIP: full eligible list (scrollable UI), not top-10
    const p = inviteChance(id);
    return { id, short: occ(id).short, p, word: inviteWord(p), senior: !!SLOTMAP[occ(id).slot]?.senior };
  });
}

function ensureInvite(rec) {
  if (!rec.invite || typeof rec.invite !== "object") rec.invite = { rolls: {}, nos: 0, guest: null };
  return rec.invite;
}

const DECLINES = [
  "{S}: 'Not tonight. Find another chair.'",
  "{S}: 'Tempting. Still a no.'",
  "{S}: 'Ask me when the week owes me less.'",
  "{S}: 'Pass. Dignity intact, for once.'",
];
function declineLine(id) {
  return rnd(DECLINES).replace(/\{S\}/g, occ(id).short);
}

export function rollInvite(kind, id, rndFn = Math.random) {
  const why = blockedWhy(); if (why) return { ok: false, why };
  const rec = kind === "meal" ? daySlot(A().meal)
    : kind === "mentor" ? daySlot(A().mentor)
    : kind === "show" ? daySlot(A().show)
    : kind === "spar" ? daySlot(A().spar)
    : kind === "shore" ? daySlot(A().shore)
    : kind === "away" ? daySlot(A().away)
    : daySlot(A().cards);
  if (kind !== "mentor" && (rec.n | 0) >= 1) return { ok: false, why: "already used today's slot" };
  if (kind === "mentor" && (rec.n | 0) >= 1) return { ok: false, why: "already mentored today" };
  if (kind === "show" && (rec.n | 0) >= 1) return { ok: false, why: "already showed someone in today" };
  if (kind === "spar" && (rec.n | 0) >= 1) return { ok: false, why: "already sparred today" };
  if (kind === "shore" && ((rec.n | 0) >= 1 || A().shore.visitDone)) return { ok: false, why: "already took a shore evening" };
  if (kind === "away" && (rec.n | 0) >= 1) return { ok: false, why: "already ran an away team today" };
  const st = ensureInvite(rec);
  if (st.guest) return { ok: false, why: st.guest === "solo" ? "going solo" : `${occ(st.guest).short} already said yes` };
  if ((st.nos | 0) >= 2) { st.guest = "solo"; return { ok: true, yes: false, forced: true, guest: "solo", line: null }; }
  const okTarget = kind === "mentor"
    ? mentorJuniorIds().includes(id)
    : inviteTargets(kind === "mentor" ? "meal" : kind).some(t => t.id === id);
  if (!okTarget) return { ok: false, why: "not available" };
  if (Object.prototype.hasOwnProperty.call(st.rolls, id)) return { ok: false, why: "already asked", prior: st.rolls[id] };
  const p = inviteChance(id), yes = rndFn() < p;
  st.rolls[id] = yes;
  if (yes) {
    st.guest = id;
    const cur = opinionOf(id), want = cur < 20 ? 6 : 4;
    nudge(id, want / 0.55, `${kind}-invite`, true);
    return { ok: true, yes: true, guest: id, p, word: inviteWord(p) };
  }
  st.nos = (st.nos | 0) + 1; nudge(id, -1, `${kind}-no`);
  const line = declineLine(id), forced = st.nos >= 2; if (forced) st.guest = "solo";
  return { ok: true, yes: false, guest: st.guest, nos: st.nos, line, forced, p, word: inviteWord(p) };
}

export function pickSolo(kind) {
  const rec = kind === "meal" ? daySlot(A().meal) : daySlot(A().cards);
  ensureInvite(rec).guest = "solo";
  return { ok: true, guest: "solo" };
}
export function pickSoloAway() {
  const st = ensureInvite(daySlot(A().away));
  st.guest = "solo"; st.nos = Math.max(st.nos | 0, 2);
  return { ok: true, guest: "solo" };
}

// ---- Meal session ----
const MEAL_BEATS = {
  thelev: [
    { q: "{short}: 'Sit. The stew is almost edible today, and I am almost in a mood to share it.'", choices: [
      { t: "'I will take almost. Pass the pepper.'", op: 1 },
      { t: "'Almost is my specialty.'", op: 1 },
      { t: "'If this is a trap, the stew is bait.'", op: 0 },
    ]},
    { q: "{short}'s antennae tip forward. 'That means you are not boring company. Do not spoil it.'", choices: [
      { t: "Eat in companionable quiet.", op: 1 },
      { t: "'Spoil it how — by liking you?'", op: 1, rom: true },
      { t: "'No promises.'", op: 0 },
    ]},
    { q: "{short}: 'Fifteen minutes where the war is smaller. I will take it.'", end: true },
  ],
  default: [
    { q: "{short} sits across from you. 'Did not expect company. Not complaining.'", choices: [
      { t: "'Good. I brought an appetite.'", op: 1 },
      { t: "'Replicator or real?'", op: 1 },
      { t: "'I can leave.'", op: -1 },
    ]},
    { q: "{short}: 'Ship still exists. Food still exists. That is enough for one meal.'", choices: [
      { t: "Clink cups.", op: 1 },
      { t: "'Tell me something that is not the war.'", op: 1 },
      { t: "'Back to it, then.'", op: 0 },
    ]},
    { q: "{short} nods once. 'Same time tomorrow? Or whenever the Dominion permits.'", end: true },
  ],
};

function fill(s, id) {
  const o = occ(id) || { short: "Crew" };
  return String(s).replace(/\{short\}/g, o.short).replace(/\{lt\}/g, addr());
}

export function startMeal() {
  const why = blockedWhy(); if (why) return { ok: false, why };
  if (mealLeft() <= 0) return { ok: false, why: "already shared a meal today" };
  if (!canAfford(MEAL_COST)) return { ok: false, why: "not enough rations" };
  const rec = daySlot(A().meal), st = ensureInvite(rec);
  const guest = st.guest && st.guest !== "solo" ? st.guest : null;
  if (guest) {
    const seat = seatGuestForAct(guest, "meal");
    if (seat.mode === "skip") return { ok: false, why: seat.why || "guest not aboard" };
    if (seat.mode === "approaching") {
      A().session = { kind: "meal", phase: "approach", guest, step: 0, wait: 0, seat: seat.seat };
      toast(`${occ(guest).short} is walking to the table…`, "info");
      return { ok: true, approaching: true, guest };
    }
    if (seat.mode === "comm") {
      // Only when genuinely unreachable (injured / no path) — not a soft timeout
      A().session = { kind: "meal", phase: "chat", guest, step: 0, mode: "comm" };
      if (!spend(MEAL_COST, "meal")) { A().session = null; return { ok: false, why: "not enough rations" }; }
      rec.n = 1; A().n.meals++;
      toast(`Meal with ${occ(guest).short} over COMM (${seat.why || "unreachable"})`, "info");
      return { ok: true, guest, mode: "comm" };
    }
    // near — seated
  }
  if (!spend(MEAL_COST, "meal")) return { ok: false, why: "not enough rations" };
  rec.n = 1; A().n.meals++;
  A().session = { kind: "meal", phase: "chat", guest, step: 0, mode: guest ? "near" : "solo", seat: guest ? (npcOf(guest) && npcOf(guest)._ltActHold && npcOf(guest)._ltActHold.seat) : null };
  if (guest) {
    const r = needsOf(guest); r.n.food = Math.min(100, r.n.food + 35); r.n.social = Math.min(100, r.n.social + 25);
    // re-pin in case ambient raced
    if (A().session.seat) holdAtSeat(guest, A().session.seat, "eat");
  }
  try { if (G.lt.deck === "lounge") sendUse("mess"); } catch (e) {}
  toast(guest ? `Meal with ${occ(guest).short}` : "Solo meal", "info");
  return { ok: true, guest, mode: A().session.mode };
}

export function mealView() {
  const s = A().session; if (!s || s.kind !== "meal" || s.phase !== "chat") return null;
  const id = s.guest || "lt";
  const pack = (s.guest && MEAL_BEATS[s.guest]) || MEAL_BEATS.default;
  const beat = pack[Math.min(s.step, pack.length - 1)];
  const romOn = !!(P().romance && P().romance.opt === true);
  const choices = (beat.choices || []).filter(c => !c.rom || (romOn && P().romance.partner === s.guest))
    .map((c, j) => ({ j, text: fill(c.t, s.guest || id), op: c.op }));
  return {
    kind: "meal", guest: s.guest, mode: s.mode || "near",
    q: fill(beat.q, s.guest || id), end: !!beat.end, choices, step: s.step,
  };
}

export function answerMeal(j) {
  const s = A().session; if (!s || s.kind !== "meal") return null;
  const pack = (s.guest && MEAL_BEATS[s.guest]) || MEAL_BEATS.default;
  const beat = pack[s.step];
  if (beat.end) return finishMeal();
  const ch = (beat.choices || []).filter(c => !c.rom || (P().romance && P().romance.opt && P().romance.partner === s.guest))[j];
  if (ch && s.guest && ch.op) nudge(s.guest, ch.op, "meal-chat", true);
  s.step++;
  if (pack[s.step] && pack[s.step].end) return { done: false, showEnd: true };
  if (s.step >= pack.length) return finishMeal();
  return { done: false };
}

function finishMeal() {
  const s = A().session; if (!s) return { done: true };
  awardXP(MEAL_XP, "manual", "meal");
  if (s.guest) { addEntry(s.guest, "dinner"); clearLtActHold(s.guest); endApproach(s.guest, "finished"); }
  log(s.guest ? `Shared a meal with ${occ(s.guest).short} in the Mess.` : "Ate alone in the Mess. Still counts.", "good");
  A().session = null;
  const rec = daySlot(A().meal); rec.invite = null;
  return { done: true };
}

export function dismissSession() {
  const s = A().session; if (!s) return;
  const who = s.guest || s.who;
  if (who) { clearLtActHold(who); endApproach(who, "dismiss"); }
  if (s.kind === "duty" && s.phase === "watch") { /* abandon watch — no credit */ }
  A().session = null;
}

// ---- Card nights ----
const CARD_HANDS = [
  { q: "{short}: 'Ante up. I already know your tell.'", choices: [
    { t: "Fold", op: 0, pot: 0 },
    { t: "Call", op: 1, pot: 1 },
    { t: "Bluff", op: 1, pot: 2 },
  ]},
  { q: "The next hand looks thin. {short} does not blink.", choices: [
    { t: "Fold clean", op: 0, pot: 0 },
    { t: "Call anyway", op: 1, pot: 1 },
    { t: "Raise on nothing", op: 0, pot: 2 },
  ]},
  { q: "{short}: 'Last hand. Make it interesting.'", choices: [
    { t: "Conservative call", op: 1, pot: 1 },
    { t: "All-in bluff", op: 1, pot: 2 },
    { t: "Fold and laugh", op: 1, pot: 0 },
  ]},
];

export function tongoUnlocked() { return !!A().everDS9; }

export function startCards(game = "poker") {
  const why = blockedWhy(); if (why) return { ok: false, why };
  if (cardsLeft() <= 0) return { ok: false, why: "already played tonight" };
  if (game === "tongo" && !tongoUnlocked()) return { ok: false, why: "tongo after you have docked at DS9" };
  if (!canAfford(CARD_ANTE)) return { ok: false, why: "not enough rations" };
  const rec = daySlot(A().cards), st = ensureInvite(rec);
  const guest = st.guest && st.guest !== "solo" ? st.guest : null;
  if (guest) {
    const seat = seatGuestForAct(guest, "cards");
    if (seat.mode === "skip") return { ok: false, why: seat.why || "guest not aboard" };
    if (seat.mode === "approaching") {
      A().session = { kind: "cards", phase: "approach", guest, step: 0, wait: 0, game, pot: 0, seat: seat.seat };
      toast(`${occ(guest).short} is walking to the table…`, "info");
      return { ok: true, approaching: true, guest };
    }
    if (seat.mode === "comm") {
      A().session = { kind: "cards", phase: "chat", guest, step: 0, mode: "comm", game, pot: 0 };
      if (!spend(CARD_ANTE, "cards")) { A().session = null; return { ok: false, why: "not enough rations" }; }
      rec.n = 1; A().n.cards++; A().session.pot = CARD_ANTE.rations;
      toast(`Cards with ${occ(guest).short} over COMM`, "info");
      return { ok: true, guest, mode: "comm" };
    }
  }
  if (!spend(CARD_ANTE, "cards")) return { ok: false, why: "not enough rations" };
  rec.n = 1; A().n.cards++;
  A().session = { kind: "cards", phase: "chat", guest, step: 0, mode: guest ? "near" : "solo", game, pot: CARD_ANTE.rations,
    seat: guest && npcOf(guest) && npcOf(guest)._ltActHold ? npcOf(guest)._ltActHold.seat : null };
  if (guest && A().session.seat) holdAtSeat(guest, A().session.seat, "talk");
  toast(`${game === "tongo" ? "Tongo" : "Poker"} night${guest ? ` with ${occ(guest).short}` : ""}`, "info");
  return { ok: true, guest };
}

// Reuse tickSession approach path for cards too (kind check in spend)
export function cardsView() {
  const s = A().session; if (!s || s.kind !== "cards" || s.phase !== "chat") return null;
  if (s.step >= CARD_HANDS.length) return { kind: "cards", end: true, guest: s.guest, mode: s.mode, q: "Hands over. Cash out.", choices: [], pot: s.pot || 0 };
  const beat = CARD_HANDS[s.step];
  const id = s.guest || "lt";
  return {
    kind: "cards", guest: s.guest, mode: s.mode || "near", game: s.game,
    q: fill(beat.q, id), end: false, step: s.step,
    choices: beat.choices.map((c, j) => ({ j, text: c.t, op: c.op, pot: c.pot })),
  };
}

export function answerCards(j) {
  const s = A().session; if (!s || s.kind !== "cards") return null;
  if (s.step >= CARD_HANDS.length) return finishCards();
  const beat = CARD_HANDS[s.step];
  const ch = beat.choices[j]; if (!ch) return null;
  if (s.guest && ch.op) nudge(s.guest, ch.op, "cards-hand", true);
  s.pot = (s.pot || 0) + (ch.pot || 0) * 2;
  s.step++;
  if (s.step >= CARD_HANDS.length) return finishCards();
  return { done: false };
}

function finishCards() {
  const s = A().session; if (!s) return { done: true };
  const win = (s.pot || 0) >= 12;
  const gain = win ? Math.min(16, Math.floor((s.pot || 0) / 2)) : 0;
  if (gain) { P().rations = (P().rations || 0) + gain; }
  awardXP(CARD_XP, "manual", "cards");
  if (s.guest) {
    nudge(s.guest, win ? 3 : 1, "cards-night", true);
    const r = needsOf(s.guest); r.n.fun = Math.min(100, r.n.fun + 30); r.n.social = Math.min(100, r.n.social + 20);
    clearLtActHold(s.guest); endApproach(s.guest, "finished");
    addEntry(s.guest, "chat");
  }
  log(`${s.game === "tongo" ? "Tongo" : "Poker"} night${s.guest ? ` with ${occ(s.guest).short}` : ""}${gain ? ` · +${gain} rations` : " · broke even"}.`, "good");
  A().session = null; daySlot(A().cards).invite = null;
  return { done: true, gain };
}

export function tickLtSession(dt) {
  const s = A().session; if (!s) return;
  if (s.kind === "phaser" && s.phase === "range") { tickPhaserRange(dt); return; }
  if (!isPresent() || idlePaused() || badClock()) return;
  if (G.sp && (G.sp.battle || G.sp.alert)) {
    const who = s.guest || s.who; if (who) { clearLtActHold(who); endApproach(who, "alert"); }
    A().session = null; toast("Activity cancelled — red alert", "warn"); return;
  }
  // Keep meal/cards/show guests pinned in their south-facing seats for the whole bout
  if ((s.kind === "meal" || s.kind === "cards" || s.kind === "show") && s.phase === "chat" && s.mode === "near" && s.guest && s.seat) {
    const n = npcOf(s.guest);
    const act = s.kind === "meal" ? "eat" : "talk";
    if (!n || !n._ltActHold || n._ltActHold.seat !== s.seat) holdAtSeat(s.guest, s.seat, act);
  }
  // Duty watch timer (present-only)
  if (s.kind === "duty" && s.phase === "watch") {
    const L = G.lt, still = L && L.mode === "use" && nodeFamily(L.node) === s.fam;
    if (!still) { /* paused while off station — no tick */ return; }
    s.t = (s.t || 0) + dt;
    if (!s.checked && s.t >= s.need * 0.45 && s.guest) {
      s.checked = true;
      const pr = speakerPresence(s.guest);
      if (pr.mode === "approach" || pr.mode === "near") beginSpeaker(s.guest);
    }
    if (s.t >= s.need) {
      if (s.guest) {
        const pr = speakerPresence(s.guest);
        s.phase = "chat"; s.step = 0; s.mode = pr.mode === "near" ? "near" : "comm";
        if (pr.mode === "approach") beginSpeaker(s.guest);
      } else {
        // no owner — finish quietly
        const r = dayRec(A().duty); r.fams[s.fam] = (r.fams[s.fam] | 0) + 1; A().n.duty++;
        awardXP(DUTY_XP, "manual", "duty-watch");
        log(`Stood a ${s.fam} watch at ${s.node}.`, "good");
        A().session = null; toast("Watch complete", "good");
      }
    }
    return;
  }
  const who = s.guest || s.who;
  if (s.phase !== "approach" || !who) return;
  s.wait = (s.wait || 0) + dt;

  // Show-in: wait for quarters guest-chair arrival
  if (s.kind === "show") {
    if (!(npcOf(who) && npcOf(who)._ltActHold) && s.seat) holdAtSeat(who, s.seat, "talk");
    const seated = guestSeatReady(who);
    if (seated) {
      const rec = daySlot(A().show); if (!(rec.n | 0)) { rec.n = 1; A().n.shows++; }
      s.phase = "chat"; s.mode = "near"; s.step = 0;
      toast(`Showing ${occ(who).short} in`, "info");
      return;
    }
    if (s.wait >= 20) {
      clearLtActHold(who); endApproach(who, "timeout");
      const rec = daySlot(A().show); if (!(rec.n | 0)) { rec.n = 1; A().n.shows++; }
      s.phase = "chat"; s.mode = "comm"; s.step = 0;
      toast(`📶 ${occ(who).short} on COMM — could not reach the chair`, "info");
    }
    return;
  }

  // Meals / cards: wait for south-facing seat arrival (not generic beside-Lt COMM)
  if (s.kind === "meal" || s.kind === "cards") {
    if (!(npcOf(who) && npcOf(who)._ltActHold) && s.seat) holdAtSeat(who, s.seat, s.kind === "cards" ? "talk" : "eat");
    const seated = guestSeatReady(who);
    const budget = 20; // walk-ins get time to reach the table
    if (seated) {
      const cost = s.kind === "meal" ? MEAL_COST : CARD_ANTE;
      if (!spend(cost, s.kind)) { clearLtActHold(who); A().session = null; toast("Not enough rations", "warn"); return; }
      const rec = s.kind === "meal" ? daySlot(A().meal) : daySlot(A().cards);
      rec.n = 1; A().n[s.kind === "meal" ? "meals" : "cards"]++;
      if (s.kind === "meal") { const r = needsOf(who); r.n.food = Math.min(100, r.n.food + 35); r.n.social = Math.min(100, r.n.social + 25); }
      if (s.kind === "cards") s.pot = CARD_ANTE.rations;
      s.phase = "chat"; s.mode = "near"; s.step = 0;
      try { if (s.kind === "meal" && G.lt.deck === "lounge") sendUse("mess"); } catch (e) {}
      toast(s.kind === "meal" ? `Meal with ${occ(who).short}` : `Cards with ${occ(who).short}`, "info");
      return;
    }
    if (s.wait >= budget) {
      // Still not seated — only then COMM (unreachable)
      clearLtActHold(who); endApproach(who, "timeout");
      const cost = s.kind === "meal" ? MEAL_COST : CARD_ANTE;
      if (!spend(cost, s.kind)) { A().session = null; toast("Not enough rations", "warn"); return; }
      const rec = s.kind === "meal" ? daySlot(A().meal) : daySlot(A().cards);
      rec.n = 1; A().n[s.kind === "meal" ? "meals" : "cards"]++;
      if (s.kind === "cards") s.pot = CARD_ANTE.rations;
      s.phase = "chat"; s.mode = "comm"; s.step = 0;
      toast(`📶 ${occ(who).short} on COMM — could not reach the table`, "info");
    }
    return;
  }

  const pr = speakerPresence(who);
  if (pr.mode === "near" || s.wait >= 8) {
    const mode = pr.mode === "near" ? "near" : "comm";
    if (mode !== "near") endApproach(who, "timeout");
    if (s.kind === "show") {
      const rec = daySlot(A().show); if (!(rec.n | 0)) { rec.n = 1; A().n.shows++; }
    } else if (s.kind === "spar") {
      const rec = daySlot(A().spar); if (!(rec.n | 0)) { rec.n = 1; A().n.spars++; }
      s.art = sparArtOn();
    }
    s.phase = "chat"; s.mode = mode; s.step = 0;
  } else if (pr.mode === "approach") beginSpeaker(who);
}
// ---- Personal quests ----
export const QUESTS = {
  diallo_array: {
    id: "diallo_array", who: "diallo", title: "Quiet array",
    needOp: 15, steps: [
      { deck: "lounge", q: "{short}: 'I need a second pair of eyes on this sweep. Preferably eyes that will not report me for enthusiasm.'", choices: [
        { t: "'Define enthusiasm.'", next: 1 },
        { t: "'If it is illegal, say so.'", next: 1 },
        { t: "'Not my problem.'", next: -1 },
      ]},
      { deck: "bridge", q: "{short}: 'Pointing the array at a place Starfleet politely asked us not to notice. Come on.'", choices: [
        { t: "Help aim — carefully.", next: 2, op: 2 },
        { t: "'We log nothing. We look once.'", next: 2, op: 1 },
        { t: "'Walk away. Now.'", next: -1, op: -1 },
      ]},
      { deck: "bridge", q: "{short}: 'Data is ugly and useful. Thank you for not being the captain.'", end: true, op: 3 },
    ],
  },
  thelev_spice: {
    id: "thelev_spice", who: "thelev", title: "Andorian spice",
    needOp: 10, steps: [
      { deck: "lounge", q: "{short}: 'The galley \"lost\" my Andorian spice again. Help me interrogate a replicator.'", choices: [
        { t: "'Lead on.'", next: 1 },
        { t: "'Is this a metaphor?'", next: 1 },
        { t: "'I am busy.'", next: -1 },
      ]},
      { deck: "lounge", q: "You find a mis-filed cartridge behind the bar. {short}'s antennae flatline, then rise.", choices: [
        { t: "Hand it over without a speech.", next: 2, op: 2 },
        { t: "'Only if I get a taste.'", next: 2, op: 1 },
        { t: "'Tax: one favour.'", next: 2, op: 0 },
      ]},
      { deck: "lounge", q: "{short}: 'Acceptable. You may live.'", end: true, op: 3 },
    ],
  },
  orvin_quiet: {
    id: "orvin_quiet", who: "orvin", title: "Quiet errand",
    needOp: 20, steps: [
      { deck: "medical", q: "{short}: 'A memorial candle for someone who is not in the records. I need a witness, not a report.'", choices: [
        { t: "'I can do quiet.'", next: 1 },
        { t: "'Whose name?'", next: 1 },
        { t: "'Official channels only.'", next: -1 },
      ]},
      { deck: "berthing", q: "A small light. No speech. {short} does not look at you, which is trust.", choices: [
        { t: "Stand with them.", next: 2, op: 2 },
        { t: "Say a name you do not know.", next: 2, op: 1, rom: false },
        { t: "Leave early.", next: -1, op: -1 },
      ]},
      { deck: "berthing", q: "{short}: 'That is all. Go be loud somewhere else.'", end: true, op: 4 },
    ],
  },
};

export function questOfferFor(id) {
  const a = A().quest;
  if (a.active) return null;
  if (dOf(a.done[id]) && dOf(a.done[id]) >= localDate()) return null; // cooldown same real day
  const inj = injured(); if (inj.has(id) || !occ(id)) return null;
  for (const q of Object.values(QUESTS)) {
    if (q.who !== id) continue;
    if (opinionOf(id) < (q.needOp || 0) && !(SLOTMAP[occ(id).slot] && !SLOTMAP[occ(id).slot].senior && opinionOf(id) >= 0)) continue;
    return q;
  }
  // juniors: allow any matching who, or soft match if id is junior and quest who missing
  return null;
}

export function listQuestOffers() {
  const out = [];
  for (const id of aboard()) {
    const q = questOfferFor(id);
    if (q) out.push({ ...q, who: id, short: occ(id).short });
  }
  // also offer if quest.who aboard even when scanning other ids failed
  for (const q of Object.values(QUESTS)) {
    if (!occ(q.who) || injured().has(q.who)) continue;
    if (A().quest.active) continue;
    if (dOf(A().quest.done[q.who]) && dOf(A().quest.done[q.who]) >= localDate()) continue;
    if (opinionOf(q.who) < (q.needOp || 0)) continue;
    if (!out.some(o => o.id === q.id)) out.push({ ...q, short: occ(q.who).short });
  }
  return out;
}

export function acceptQuest(qid) {
  const why = blockedWhy(); if (why) return { ok: false, why };
  if (A().quest.active) return { ok: false, why: "finish the one you have" };
  const q = QUESTS[qid]; if (!q || !occ(q.who)) return { ok: false, why: "unknown quest" };
  if (dOf(A().quest.done[q.who]) && dOf(A().quest.done[q.who]) >= localDate()) return { ok: false, why: "cooldown" };
  A().quest.active = { id: q.id, who: q.who, step: 0 };
  toast(`Quest: ${q.title} · ${occ(q.who).short}`, "info");
  log(`Personal ask from ${occ(q.who).short}: ${q.title}.`, "comm");
  return { ok: true };
}

export function questDutyItem() {
  const a = A().quest.active; if (!a) return null;
  const q = QUESTS[a.id]; if (!q) return null;
  const st = q.steps[a.step] || q.steps[q.steps.length - 1];
  return { kind: "quest", id: a.id, pri: 2, who: a.who, title: q.title, deck: st.deck, step: a.step };
}

export function questView() {
  const a = A().quest.active; if (!a) return null;
  const q = QUESTS[a.id]; if (!q) return null;
  const st = q.steps[a.step]; if (!st) return null;
  const L = G.lt;
  const here = L && !L.lift && L.deck === st.deck;
  const romOn = !!(P().romance && P().romance.opt === true);
  // must be present in the room; try approach if guest elsewhere same ship
  let mode = "near";
  if (here) {
    const pr = speakerPresence(a.who);
    if (pr.mode === "near") mode = "near";
    else if (pr.mode === "approach") { beginSpeaker(a.who); mode = "approaching"; }
    else mode = pr.mode === "comm" ? "comm" : "wait";
  } else mode = "wrong-deck";
  const choices = (st.choices || []).filter(c => !c.rom || romOn).map((c, j) => ({ j, text: fill(c.t, a.who), next: c.next, op: c.op }));
  return {
    id: a.id, who: a.who, title: q.title, step: a.step, deck: st.deck, here, mode,
    q: fill(st.q, a.who), end: !!st.end, choices,
  };
}

export function answerQuest(j) {
  const a = A().quest.active; if (!a) return null;
  const q = QUESTS[a.id]; const st = q.steps[a.step];
  if (st.end) return finishQuest(st.op || 0);
  const romOn = !!(P().romance && P().romance.opt === true);
  const ch = (st.choices || []).filter(c => !c.rom || romOn)[j];
  if (!ch) return null;
  if (ch.op) nudge(a.who, ch.op, "quest|" + q.id, true);
  if (ch.next < 0) {
    log(`${occ(a.who).short}'s ask ends early. No hard feelings filed.`, "warn");
    A().quest.done[a.who] = localDate(); A().quest.active = null;
    endApproach(a.who, "quest-abort");
    return { done: true, aborted: true };
  }
  a.step = ch.next;
  const nxt = q.steps[a.step];
  if (nxt && nxt.end) {
    if (nxt.op) nudge(a.who, nxt.op, "quest|" + q.id, true);
    return finishQuest(nxt.op || 0);
  }
  return { done: false };
}

function finishQuest(op) {
  const a = A().quest.active; if (!a) return { done: true };
  const q = QUESTS[a.id];
  awardXP(QUEST_XP, "manual", "quest");
  A().n.quests++;
  A().quest.done[a.who] = localDate();
  addEntry(a.who, "note", q.title);
  endApproach(a.who, "finished");
  log(`Personal quest done: ${q.title} (${occ(a.who).short}).`, "good");
  A().quest.active = null;
  return { done: true };
}


// ===================== WAVE B =====================
export function dutyLeft(fam, at) {
  const r = dayRec(A().duty, at);
  return Math.max(0, 1 - (r.fams[fam] | 0));
}
export function atWatchNode() {
  const L = G.lt; if (!L || L.lift || L.mode !== "use") return null;
  const fam = nodeFamily(L.node); return fam ? { fam, node: L.node } : null;
}
export function dutyChipOk() {
  const w = atWatchNode(); if (!w || blockedWhy()) return false;
  return dutyLeft(w.fam) > 0;
}

const DUTY_BEATS = {
  tren: [
    { q: "{short}: 'You are early. Either the universe is ending, or you finally read the board.'", choices: [
      { t: "'Board looked lonely.'", op: 1 }, { t: "'Figured I would keep it company.'", op: 1 }, { t: "'Just passing through.'", op: 0 },
    ]},
    { q: "{short}: 'Stay for the full watch. Consistency over heroics.'", end: true, op: 1 },
  ],
  okafor: [
    { q: "{short}: 'Core likes steady hands. Yours will do.'", choices: [
      { t: "'Talk me through the board.'", op: 1 }, { t: "'I have it.'", op: 1 }, { t: "'Make it quick.'", op: 0 },
    ]},
    { q: "{short}: 'Not bad. Do not get cocky.'", end: true, op: 1 },
  ],
  orvin: [
    { q: "{short}: 'Sickbay is quiet. Keep it that way.'", choices: [
      { t: "Check the biobed readouts.", op: 1 }, { t: "'Anyone I should worry about?'", op: 1 }, { t: "'I will stay out of the way.'", op: 0 },
    ]},
    { q: "{short}: 'Acceptable. Go before I invent a patient.'", end: true, op: 1 },
  ],
  default: [
    { q: "A crewmate nods from across the console. 'Long watch?'", choices: [
      { t: "'Long enough.'", op: 1 }, { t: "'Quiet is good.'", op: 1 }, { t: "Shrug and work.", op: 0 },
    ]},
    { q: "They leave you to it.", end: true },
  ],
};

export function startDutyWatch() {
  const why = blockedWhy(); if (why) return { ok: false, why };
  const w = atWatchNode(); if (!w) return { ok: false, why: "stand a station first" };
  if (dutyLeft(w.fam) <= 0) return { ok: false, why: "already stood this watch family today" };
  const owner = OWNER_BY_FAMILY[w.fam];
  const guest = owner && occ(owner) && !injured().has(owner) ? owner : null;
  A().session = { kind: "duty", phase: "watch", fam: w.fam, node: w.node, guest, t: 0, need: 70 + Math.floor(Math.random() * 21), checked: false, step: 0 };
  toast(`Standing watch · ${w.fam}`, "info");
  return { ok: true, fam: w.fam, guest };
}

export function dutyView() {
  const s = A().session; if (!s || s.kind !== "duty") return null;
  if (s.phase === "watch") {
    const pct = Math.min(100, Math.round((s.t / s.need) * 100));
    return { kind: "duty", phase: "watch", fam: s.fam, node: s.node, pct, guest: s.guest, q: `Standing ${s.fam} watch… ${pct}%`, choices: [], end: false };
  }
  if (s.phase === "chat") {
    const pack = DUTY_BEATS[s.guest] || DUTY_BEATS.default;
    const beat = pack[Math.min(s.step, pack.length - 1)];
    const choices = (beat.choices || []).map((c, j) => ({ j, text: fill(c.t, s.guest), op: c.op }));
    return { kind: "duty", phase: "chat", guest: s.guest, mode: s.mode || "near", q: fill(beat.q, s.guest), choices, end: !!beat.end, step: s.step };
  }
  return null;
}

export function answerDuty(j) {
  const s = A().session; if (!s || s.kind !== "duty" || s.phase !== "chat") return null;
  const pack = DUTY_BEATS[s.guest] || DUTY_BEATS.default;
  const beat = pack[s.step];
  if (beat.end) return finishDuty();
  const ch = (beat.choices || [])[j];
  if (ch && s.guest && ch.op) nudge(s.guest, ch.op, "duty-watch", true);
  s.step++;
  if (pack[s.step] && pack[s.step].end) {
    if (pack[s.step].op && s.guest) nudge(s.guest, pack[s.step].op, "duty-watch", true);
    return finishDuty();
  }
  if (s.step >= pack.length) return finishDuty();
  return { done: false };
}

function finishDuty() {
  const s = A().session; if (!s || s.kind !== "duty") return { done: true };
  const r = dayRec(A().duty); r.fams[s.fam] = (r.fams[s.fam] | 0) + 1;
  A().n.duty++;
  awardXP(DUTY_XP, "manual", "duty-watch");
  if (s.guest) { endApproach(s.guest, "finished"); addEntry(s.guest, "chat"); }
  log(`Stood a ${s.fam} watch at ${s.node}.`, "good");
  A().session = null;
  return { done: true };
}

export function repairLeft(at) { const r = dayRec(A().repair, at); return Math.max(0, 2 - (r.n | 0)); }

export function pendingKitCalls() {
  const reqs = P().requests || [];
  return reqs.filter(r => occ(r.id) && !injured().has(r.id)).map(r => ({ who: r.id, item: r.item, short: occ(r.id).short }));
}

export function repairDutyItem() {
  const a = A().repair.active; if (!a || !occ(a.who)) return null;
  return { kind: "repair-call", id: "repair-" + a.who, pri: 3, who: a.who, title: `Fix ${occ(a.who).short}'s kit`, item: a.item };
}

export function acceptRepairCall(who) {
  const why = blockedWhy(); if (why) return { ok: false, why };
  if (repairLeft() <= 0) return { ok: false, why: "two calls today already" };
  const req = (P().requests || []).find(r => r.id === who); if (!req) return { ok: false, why: "no open kit request" };
  if (A().repair.active) return { ok: false, why: "finish the open call first" };
  A().repair.active = { who, item: req.item };
  toast(`${occ(who).short} needs a hand — walk to them`, "info");
  return { ok: true };
}

export function startRepairScene() {
  const why = blockedWhy(); if (why) return { ok: false, why };
  const a = A().repair.active; if (!a) return { ok: false, why: "no accepted call" };
  const pr = speakerPresence(a.who);
  if (pr.mode === "skip") return { ok: false, why: "not aboard" };
  if (pr.mode === "approach" || pr.mode === "comm") {
    const gate = beginSpeaker(a.who);
    if (gate.mode === "approaching") {
      A().session = { kind: "repair", phase: "approach", who: a.who, item: a.item, wait: 0, step: 0 };
      return { ok: true, approaching: true };
    }
  }
  A().session = { kind: "repair", phase: "chat", who: a.who, item: a.item, step: 0, mode: pr.mode === "near" ? "near" : "comm" };
  return { ok: true };
}

function repairBeats(s) {
  return [
    { q: `{short}: '${s.item}. I could force it. I would rather not explain force to T'Ren.'`, choices: [
      { t: "'Hold the interlock. I will walk it.'", next: 1, op: 1 },
      { t: "'Parts locker. Two minutes.'", next: 1, op: 1 },
      { t: "'Later.'", next: -1 },
    ]},
    { q: "{short}: 'Knew I liked you for a reason. Do not tell Diallo I said that.'", end: true, op: 1 },
  ];
}

export function repairView() {
  const s = A().session; if (!s || s.kind !== "repair" || s.phase !== "chat") return null;
  const beats = repairBeats(s); s._beats = beats;
  const beat = beats[Math.min(s.step | 0, beats.length - 1)];
  if (!beat) return null;
  const choices = (beat.choices || []).map((c, j) => ({ j, text: fill(c.t, s.who), next: c.next, op: c.op }));
  return { kind: "repair", who: s.who, item: s.item, mode: s.mode || "near", q: fill(beat.q, s.who), choices, end: !!beat.end, step: s.step | 0 };
}

export function answerRepair(j) {
  const s = A().session; if (!s || s.kind !== "repair") return null;
  const beats = s._beats && s._beats.length ? s._beats : repairBeats(s);
  s._beats = beats;
  const beat = beats[s.step | 0];
  if (!beat) return finishRepair();
  if (beat.end) return finishRepair();
  const ch = (beat.choices || [])[j]; if (!ch) return null;
  if (ch.next < 0) {
    endApproach(s.who, "dismiss"); A().session = null; A().repair.active = null;
    toast("Call dropped", "warn"); return { done: true, aborted: true };
  }
  if (ch.op) nudge(s.who, ch.op, "repair-call", true);
  s.step = ch.next;
  if (beats[s.step] && beats[s.step].end) return finishRepair();
  return { done: false };
}

function finishRepair() {
  const s = A().session; if (!s) return { done: true };
  let fixed = false;
  try { fixed = !!fixKit(s.who); } catch (e) { fixed = false; }
  if (!fixed) {
    const K = PROG.sinks && PROG.sinks.kit;
    if (K && canAfford({ parts: K.parts }) && spend({ parts: K.parts }, "kit")) {
      P().requests = (P().requests || []).filter(r => r.id !== s.who);
      nudge(s.who, K.opinion, `kit|${s.item}`, true);
      fixed = true;
    }
  }
  const r = dayRec(A().repair); r.n = (r.n | 0) + 1; A().n.repairs++;
  A().repair.active = null;
  if (fixed) { awardXP(REPAIR_CALL_XP, "manual", "repair-call"); addEntry(s.who, "kit", s.item); log(`Repair call done — ${occ(s.who).short}'s ${s.item}.`, "good"); }
  else toast("Could not finish the kit fix (parts?)", "warn");
  endApproach(s.who, "finished");
  A().session = null;
  return { done: true, fixed };
}

export function mentorLeft(at) { return Math.max(0, 1 - (dayRec(A().mentor, at).n | 0)); }
export function mentorJuniorIds() {
  const inj = injured();
  return aboard().filter(id => {
    if (!occ(id) || inj.has(id)) return false;
    const sl = SLOTMAP[occ(id).slot];
    return !(sl && sl.senior);
  });
}
export function mentorDeckOk() {
  const L = G.lt; return !!(L && !L.lift && (L.deck === "bridge" || L.deck === "engineering"));
}

export function mentorJuniors() {
  const rec = daySlot(A().mentor), st = ensureInvite(rec);
  return mentorJuniorIds().map(id => {
    const p = inviteChance(id);
    const rolled = Object.prototype.hasOwnProperty.call(st.rolls, id);
    const declined = rolled && !st.rolls[id];
    const locked = declined; // persisted for the real day via invite.rolls
    return {
      id, short: occ(id).short, p, word: declined ? "Declined" : inviteWord(p),
      green: hasQ(id, "green"), declined, locked, rolled, yes: rolled ? !!st.rolls[id] : null,
    };
  });
}

export function startMentor(id) {
  const why = blockedWhy(); if (why) return { ok: false, why };
  if (!mentorDeckOk()) return { ok: false, why: "meet them on the Bridge or in Engineering" };
  if (mentorLeft() <= 0) return { ok: false, why: "already mentored today" };
  if (!mentorJuniorIds().includes(id)) return { ok: false, why: "not a junior" };
  // invite roll (reuse meal/cards math via dedicated rolls on mentor slot)
  const rec = daySlot(A().mentor);
  const st = ensureInvite(rec);
  if (!Object.prototype.hasOwnProperty.call(st.rolls, id)) {
    const p = inviteChance(id), yes = Math.random() < p;
    st.rolls[id] = yes;
    if (!yes) {
      st.nos = (st.nos | 0) + 1; nudge(id, -1, "mentor-no");
      return { ok: true, yes: false, line: `${occ(id).short}: 'Not today, Lieutenant.'`, nos: st.nos };
    }
    st.guest = id; nudge(id, 3, "mentor-invite", true);
  } else if (!st.rolls[id]) return { ok: false, why: "already declined" };
  const gate = beginSpeaker(id);
  if (gate.mode === "approaching") {
    A().session = { kind: "mentor", phase: "approach", who: id, wait: 0, step: 0 };
    return { ok: true, yes: true, approaching: true };
  }
  if (gate.mode === "skip") return { ok: false, why: "unavailable" };
  A().session = { kind: "mentor", phase: "chat", who: id, step: 0, mode: gate.mode === "near" ? "near" : "comm" };
  return { ok: true, yes: true };
}

const MENTOR_BEATS = [
  { q: "{short}: 'Lieutenant — if I reverse the polarity here, does the core thank me or vaporize me?'", choices: [
    { t: "'Neither, if you stop at the checklist step you are skipping. Show me your hands.'", op: 2 },
    { t: "'Walk it with me. Slow.'", op: 2 },
    { t: "'Guess.'", op: -1 },
  ]},
  { q: "{short} mirrors your hands. A little less green already.", choices: [
    { t: "'Again. Then you sign the log.'", op: 1 },
    { t: "'Good. Trust the board, not the panic.'", op: 1 },
    { t: "'Do not make me regret this.'", op: 0 },
  ]},
  { q: "{short}: 'Logged. Thank you — I mean it.'", end: true, op: 2 },
];

export function mentorView() {
  const s = A().session; if (!s || s.kind !== "mentor" || s.phase !== "chat") return null;
  const beat = MENTOR_BEATS[Math.min(s.step, MENTOR_BEATS.length - 1)];
  const romOn = !!(P().romance && P().romance.opt === true);
  const choices = (beat.choices || []).filter(c => !c.rom || romOn).map((c, j) => ({ j, text: fill(c.t, s.who), op: c.op }));
  return { kind: "mentor", who: s.who, mode: s.mode || "near", q: fill(beat.q, s.who), choices, end: !!beat.end, step: s.step };
}

export function answerMentor(j) {
  const s = A().session; if (!s || s.kind !== "mentor") return null;
  const beat = MENTOR_BEATS[s.step];
  if (beat.end) return finishMentor();
  const ch = (beat.choices || [])[j]; if (!ch) return null;
  if (ch.op) nudge(s.who, ch.op, "mentor", true);
  s.step++;
  if (MENTOR_BEATS[s.step] && MENTOR_BEATS[s.step].end) {
    if (MENTOR_BEATS[s.step].op) nudge(s.who, MENTOR_BEATS[s.step].op, "mentor", true);
    return finishMentor();
  }
  return { done: false };
}

function finishMentor() {
  const s = A().session; if (!s) return { done: true };
  dayRec(A().mentor).n = 1; A().n.mentor++;
  awardXP(MENTOR_XP, "manual", "mentor");
  const r = needsOf(s.who); r.n.fun = Math.min(100, r.n.fun + 15); r.n.social = Math.min(100, r.n.social + 20);
  try { hasQ(s.who, "green"); } catch (e) {}
  addEntry(s.who, "note", "mentoring");
  endApproach(s.who, "finished");
  log(`Mentored ${occ(s.who).short} through a drill.`, "good");
  daySlot(A().mentor).invite = null;
  A().session = null;
  return { done: true };
}

// ---- Personal log (mad-libs at desk) ----
export function logLeft(at) { return Math.max(0, 1 - (dayRec(A().log, at).n | 0)); }
export function atDesk() {
  const L = G.lt; return !!(L && L.deck === "quarters" && !L.lift && L.mode === "use" && L.node === "desk");
}
export function logChipOk() { return !blockedWhy() && atDesk() && logLeft() > 0; }

export function logPrompts() {
  const opens = [], closes = [];
  const n = A().n;
  if (n.meals) opens.push("Shared a table in the Mess.");
  if (n.cards) opens.push("Lost (or won) a few hands after hours.");
  if (n.quests) opens.push("Helped someone with a personal ask.");
  if (n.duty) opens.push("Stood a quiet watch.");
  if (n.repairs) opens.push("Fixed a kit that should have been simple.");
  if (n.mentor) opens.push("Walked a junior through a drill.");
  if (n.shores) opens.push("Spent an evening on the Promenade.");
  if (n.aways) opens.push("Took an away team down.");
  if (G.sp && G.sp.battle) opens.push("Red alert still humming behind my eyes.");
  if (!opens.length) opens.push("Another shift on the Tenacity.");
  opens.push("The Dominion is still out there.");
  opens.push("Ship's quiet. Too quiet, maybe.");
  closes.push("I am starting to believe fifteen quiet minutes are enough.");
  closes.push("Tomorrow we do it again.");
  closes.push("Do not apologize for writing it down.");
  // Romance close must be selectable when romance is ON (do not let slice(0,3) drop it)
  if (P().romance && P().romance.opt === true && P().romance.partner && occ(P().romance.partner)) {
    closes.unshift(`Thinking of ${occ(P().romance.partner).short}. Discreetly.`);
  }
  return { opens: opens.slice(0, 3), closes: closes.slice(0, 3) };
}

export function writeLog({ open, close, who = null }) {
  const why = blockedWhy(); if (why) return { ok: false, why };
  if (!atDesk()) return { ok: false, why: "sit at your desk" };
  if (logLeft() <= 0) return { ok: false, why: "already wrote today" };
  const text = `${String(open || "").slice(0, 120)} ${String(close || "").slice(0, 120)}`.trim();
  if (!text) return { ok: false, why: "empty" };
  const romOn = !!(P().romance && P().romance.opt === true);
  let dedicate = who && occ(who) ? who : null;
  if (dedicate && romOn && P().romance.partner === dedicate) {
    // romance line already available in closes
  }
  dayRec(A().log).n = 1; A().n.logs++;
  A().writes.push({ d: localDate(), text, who: dedicate });
  if (A().writes.length > 20) A().writes.splice(0, A().writes.length - 20);
  awardXP(LOG_XP, "manual", "lt-log");
  if (dedicate) addEntry(dedicate, "note", "your log");
  log("Personal log filed.", "comm");
  return { ok: true, text };
}


// ============================== Wave C: quarters show-in + sparring ==============================
export function showLeft(at) { return Math.max(0, 1 - (daySlot(A().show, at).n | 0)); }
export function sparLeft(at) { return Math.max(0, 1 - (daySlot(A().spar, at).n | 0)); }

export function inQuarters() {
  const L = G.lt; return !!(L && L.deck === "quarters" && !L.lift);
}
export function atDecorNode() {
  const L = G.lt; return !!(L && L.deck === "quarters" && !L.lift && L.mode === "use" && (L.node === "desk" || L.node === "rack"));
}
export function decorChipOk() { return !blockedWhy() && atDecorNode(); }
export function showChipOk() { return !blockedWhy() && inQuarters() && showLeft() > 0; }
export function nearSparSpot() {
  const L = G.lt, sp = SPAR_SPOT;
  if (!L || L.lift || L.deck !== sp.deck) return false;
  return Math.hypot(L.x - sp.x, L.y - sp.y) <= 0.12;
}
export function sparChipOk() {
  if (blockedWhy() || sparLeft() <= 0) return false;
  const L = G.lt; if (!L || L.lift) return false;
  if (gymRoomOn()) return L.deck === "gym";
  return L.deck === "lounge" || L.deck === "berthing";
}

export function placedDecorSummary() {
  const placed = Object.values((P().cabin && P().cabin.placed) || {});
  return placed.filter(id => decorOf(id)).map(id => {
    const d = decorOf(id);
    return { id, name: d.name, hasArt: !!d.art };
  });
}

export function showReactionLines(guest) {
  const placed = Object.values((P().cabin && P().cabin.placed) || {});
  const withArt = placed.filter(id => decorOf(id) && decorOf(id).art);
  const op = opinionOf(guest);
  const romOn = !!(P().romance && P().romance.opt === true && P().romance.partner === guest);
  const lines = [];
  if (!placed.length) {
    lines.push(`{short}: 'Sparse. Honest. A little lonely — or you have not unpacked yet.'`);
  } else if (withArt.length) {
    const d = decorOf(withArt[0]);
    lines.push(`{short}: 'You put the ${d.name.toLowerCase()} where the light hits it. That is either science or sentiment.'`);
  } else {
    lines.push(`{short}: 'I like what you have done with the place. It looks lived-in, not staged.'`);
  }
  if (op >= 40) lines.push(`{short}: 'I approve. Do not tell Hale — he will requisition a phaser rack for the opposite wall.'`);
  else if (op >= 0) lines.push(`{short}: 'Not bad for a junior officer's digs. The rack still looks regulation-stiff.'`);
  else lines.push(`{short}: 'Hmm. I have seen worse. Barely.'`);
  if (romOn) lines.push(`{short}: '…I like being invited in. Keep that between us.'`);
  return lines;
}

export function startShowIn() {
  const why = blockedWhy(); if (why) return { ok: false, why };
  if (!inQuarters()) return { ok: false, why: "show them your quarters" };
  if (showLeft() <= 0) return { ok: false, why: "already showed someone in today" };
  const rec = daySlot(A().show), st = ensureInvite(rec);
  const guest = st.guest && st.guest !== "solo" ? st.guest : null;
  if (!guest) return { ok: false, why: "invite someone first" };
  if (!NODEMAP.guest || !NODEMAP.guest.seat) return { ok: false, why: "no guest chair" };
  const seat = seatGuestForShow(guest);
  if (seat.mode === "approaching") {
    A().session = { kind: "show", phase: "approach", guest, step: 0, wait: 0, seat: seat.seat };
    toast(`${occ(guest).short} is walking to the chair…`, "info");
    return { ok: true, approaching: true, guest, seat: seat.seat };
  }
  if (seat.mode === "comm") {
    // injured / unreachable — COMM tour (no seat pin)
    rec.n = 1; A().n.shows++;
    A().session = { kind: "show", phase: "chat", guest, step: 0, mode: "comm" };
    toast(`📶 Showing ${occ(guest).short} in on COMM`, "info");
    return { ok: true, guest, mode: "comm" };
  }
  rec.n = 1; A().n.shows++;
  A().session = { kind: "show", phase: "chat", guest, step: 0, mode: "near", seat: seat.seat };
  toast(`Showing ${occ(guest).short} in`, "info");
  return { ok: true, guest, seat: seat.seat };
}

export function showView() {
  const s = A().session; if (!s || s.kind !== "show" || s.phase !== "chat") return null;
  const lines = showReactionLines(s.guest);
  const romOn = !!(P().romance && P().romance.opt === true && P().romance.partner === s.guest);
  const beats = [
    { q: fill(lines[0], s.guest), choices: [
      { t: "'Science. Obviously.'", op: 1 },
      { t: "'Sentiment. Do not spread it around.'", op: 1, rom: false },
      { t: romOn ? "'I wanted you to see it first.'" : "'Just making it mine.'", op: romOn ? 2 : 1, rom: romOn },
    ]},
    { q: fill(lines[Math.min(1, lines.length - 1)], s.guest), choices: [
      { t: "'Stay a minute.'", op: 1 },
      { t: "'Tour's over — duty calls.'", op: 0 },
      { t: "'Tell me what you would move.'", op: 1 },
    ]},
    { q: fill(lines[Math.min(2, lines.length - 1)], s.guest), end: true, op: 1 },
  ];
  // Filter romance-only choice text when romance off — keep choice but swap text already handled
  const beat = beats[Math.min(s.step | 0, beats.length - 1)];
  s._beats = beats;
  const choices = (beat.choices || []).map((c, j) => ({ j, text: c.t, op: c.op }));
  return { kind: "show", guest: s.guest, mode: s.mode || "near", q: beat.q, choices, end: !!beat.end, step: s.step | 0 };
}

export function answerShow(j) {
  const s = A().session; if (!s || s.kind !== "show") return null;
  const beats = s._beats || [];
  const beat = beats[s.step | 0];
  if (!beat || beat.end) return finishShow();
  const ch = (beat.choices || [])[j]; if (!ch) return null;
  if (ch.op) nudge(s.guest, ch.op, "show-in", true);
  s.step = (s.step | 0) + 1;
  if (beats[s.step] && beats[s.step].end) {
    if (beats[s.step].op) nudge(s.guest, beats[s.step].op, "show-in", true);
    return finishShow();
  }
  return { done: false };
}

function finishShow() {
  const s = A().session; if (!s) return { done: true };
  awardXP(SHOW_XP, "manual", "show-in");
  const r = needsOf(s.guest); r.n.social = Math.min(100, r.n.social + 20); r.n.fun = Math.min(100, r.n.fun + 10);
  addEntry(s.guest, "note", "saw your quarters");
  clearLtActHold(s.guest); endApproach(s.guest, "finished");
  log(`Showed ${occ(s.guest).short} your quarters.`, "good");
  daySlot(A().show).invite = null;
  A().session = null;
  return { done: true };
}

export function sparTargets() {
  return inviteTargets("spar").map(t => {
    // Hale loves this; fitness-minded get a tiny word nudge in UI via green flag reuse
    const love = t.id === "hale" || t.id === "okafor";
    return { ...t, love };
  });
}

export function startSpar(id) {
  const why = blockedWhy(); if (why) return { ok: false, why };
  if (sparLeft() <= 0) return { ok: false, why: "already sparred today" };
  if (!sparChipOk()) {
    return { ok: false, why: gymRoomOn() ? "meet in the Gym" : "meet in the Mess or Berthing" };
  }
  // invite roll
  const rec = daySlot(A().spar);
  const st = ensureInvite(rec);
  if (!Object.prototype.hasOwnProperty.call(st.rolls, id)) {
    const p = inviteChance(id), yes = Math.random() < p;
    st.rolls[id] = yes;
    if (!yes) {
      st.nos = (st.nos | 0) + 1; nudge(id, -1, "spar-no");
      return { ok: true, yes: false, line: `${occ(id).short}: 'Not today — find another sparring partner.'`, nos: st.nos };
    }
    st.guest = id; nudge(id, 3, "spar-invite", true);
  } else if (!st.rolls[id]) return { ok: false, why: "already declined" };
  const guest = st.guest;
  if (!guest || guest === "solo") return { ok: false, why: "need a partner" };
  const gate = beginSpeaker(guest);
  if (gate.mode === "approaching") {
    A().session = { kind: "spar", phase: "approach", who: guest, guest, step: 0, wait: 0, wins: 0 };
    return { ok: true, yes: true, approaching: true };
  }
  if (gate.mode === "skip") return { ok: false, why: "unavailable" };
  rec.n = 1; A().n.spars++;
  const spot = sparSpot();
  try {
    if (G.lt && G.lt.deck === spot.deck) { G.lt.x = spot.x; G.lt.y = spot.y; G.lt.dir = spot.face; G.lt.mode = "idle"; G.lt.node = null; }
  } catch (e) {}
  const gWho = guestSparWho(guest);
  A().session = { kind: "spar", phase: "chat", who: guest, guest, step: 0, mode: gate.mode === "near" ? "near" : "comm", wins: 0, art: sparArtOn(), pose: sparArtOn() ? "punch" : null, guestSparWho: gWho, guestArt: !!gWho };
  if (gate.mode === "near") pinSparGuest(guest);
  toast(`Sparring with ${occ(guest).short}${sparArtOn() ? "" : " · stand-in poses"}${gWho ? "" : (crewSparArtOn() ? " · partner stand-in" : "")}`, "info");
  return { ok: true, yes: true };
}

const SPAR_BEATS = [
  { q: "{short}: 'Rules: no faces, no rank, no crying to Orvin when I win.'", choices: [
    { t: "Aggressive open", style: "agg", op: 1 },
    { t: "Measured guard", style: "meas", op: 1 },
    { t: "Show-off flourish", style: "show", op: 0 },
  ]},
  { q: "Footwork scrapes the deck. {short} grins.", choices: [
    { t: "Press the attack", style: "agg", op: 1 },
    { t: "Wait them out", style: "meas", op: 1 },
    { t: "Taunt and spin", style: "show", op: 0 },
  ]},
  { q: "{short}: 'Last exchange. Try to keep up with the war for once.'", choices: [
    { t: "All-in rush", style: "agg", op: 1 },
    { t: "Patient counter", style: "meas", op: 1 },
    { t: "Flashy finish", style: "show", op: 0 },
  ]},
];

export function sparView() {
  const s = A().session; if (!s || s.kind !== "spar" || s.phase !== "chat") return null;
  if ((s.step | 0) >= SPAR_BEATS.length) {
    return { kind: "spar", who: s.guest, mode: s.mode || "near", q: sparResultLine(s), choices: [], end: true, step: s.step, win: !!s.ltWin, sparArt: !!s.art };
  }
  const beat = SPAR_BEATS[s.step | 0];
  return {
    kind: "spar", who: s.guest, mode: s.mode || "near", sparArt: !!s.art,
    q: fill(beat.q, s.guest), end: false, step: s.step | 0,
    choices: beat.choices.map((c, j) => ({ j, text: c.t, style: c.style, op: c.op })),
  };
}

function sparResultLine(s) {
  return s.ltWin
    ? fill("{short}: 'Lucky. Rematch when my pride recovers.'", s.guest)
    : fill("{short}: 'Told you. Tap out and hydrate.'", s.guest);
}

export function answerSpar(j) {
  const s = A().session; if (!s || s.kind !== "spar") return null;
  if ((s.step | 0) >= SPAR_BEATS.length) return finishSpar();
  const beat = SPAR_BEATS[s.step | 0];
  const ch = beat.choices[j]; if (!ch) return null;
  if (ch.op) nudge(s.guest, ch.op, "spar-bout", true);
  // light random: measured slightly favored; opinion helps Lt
  const op = opinionOf(s.guest);
  let pWin = 0.45 + Math.max(-0.1, Math.min(0.15, op / 400));
  if (ch.style === "meas") pWin += 0.08;
  if (ch.style === "agg") pWin += 0.02;
  if (ch.style === "show") pWin -= 0.05;
  if (s.art) s.pose = ch.style === "meas" ? "block" : "punch";
  if (s.guest && s.mode === "near") pinSparGuest(s.guest);
  // holodeck fitness buff synergy if present
  try {
    const buffs = (P().holo && P().holo.buffs && P().holo.buffs.lt) || (G.prog.holo && G.prog.holo.buffs && G.prog.holo.buffs.lt);
    if (buffs && buffs.k === "fit") pWin += 0.1;
  } catch (e) {}
  if (Math.random() < pWin) s.wins = (s.wins | 0) + 1;
  s.step = (s.step | 0) + 1;
  if (s.step >= SPAR_BEATS.length) {
    s.ltWin = (s.wins | 0) >= 2;
    return finishSpar();
  }
  return { done: false };
}

function finishSpar() {
  const s = A().session; if (!s) return { done: true };
  if (s.ltWin == null) s.ltWin = (s.wins | 0) >= 2;
  awardXP(SPAR_XP, "manual", "spar");
  nudge(s.guest, s.ltWin ? 3 : 2, "spar-done", true);
  const r = needsOf(s.guest); r.n.fun = Math.min(100, r.n.fun + 25); r.n.social = Math.min(100, r.n.social + 10);
  // Never injures — flavour bruise only
  addEntry(s.guest, "note", s.ltWin ? "spar — you edged it" : "spar — they edged it");
  endApproach(s.guest, "finished");
  log(`Sparred with ${occ(s.guest).short}${s.ltWin ? " — you took it" : " — they took it"}. No injuries.`, "good");
  daySlot(A().spar).invite = null;
  const win = s.ltWin;
  A().session = null;
  return { done: true, win };
}


/** Active card-night table prop (poker/tongo) centred on the round lounge table; covers the table lamp. */
const TABLE_FG = {
  table1: [346, 273, 411, 315], mess: [468, 273, 533, 315], table3: [590, 270, 655, 312],
  table4: [353, 383, 418, 425], table5: [491, 380, 556, 422], table6: [631, 377, 696, 419],
};
export function cardTableProp() {
  const s = A().session;
  if (!s || s.kind !== "cards" || (s.phase !== "chat" && s.phase !== "approach")) return null;
  const seat = s.seat || (G.lt && G.lt.node) || "mess";
  const key = seat === "bar" ? "mess" : (TABLE_FG[seat] ? seat : "mess");
  const box = TABLE_FG[key]; if (!box) return null;
  const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2;
  const src = s.game === "tongo" ? "prop-lounge-tongo" : "prop-lounge-poker";
  // 112px wide props; height from native aspect (poker 81, tongo 88)
  const pw = 112, ph = s.game === "tongo" ? 88 : 81;
  return {
    src, table: key,
    box: [cx - pw / 2, cy - ph / 2, cx + pw / 2, cy + ph / 2],
    baseY: box[3],
    hideLamp: true,
  };
}
export function cardsLampHidden() { return !!cardTableProp(); }


// ============================== Wave D: DS9 shore evenings + away missions ==============================
export function shoreLeft(at) {
  const r = daySlot(A().shore, at);
  if (A().shore.visitDone) return 0;
  return Math.max(0, 1 - (r.n | 0));
}
export function awayLeft(at) { return Math.max(0, 1 - (daySlot(A().away, at).n | 0)); }

/** Shore leave already granted this DS9 visit (captain said yes). */
export function shoreGranted() {
  try { const c = careC(); return !!(atDS9() && c.shoreUsed && !c.shoreDenied); } catch (e) { return false; }
}

export function shoreChipOk() {
  return !blockedWhy() && atDS9() && shoreGranted() && shoreLeft() > 0;
}

/** Away team: present, not traveling, not battle — docked or quiet stop. */
export function awayReadyWhy() {
  const w = blockedWhy(); if (w) return w;
  if (!G.sp) return "no voyage";
  if (G.sp.travel) return "wait until you arrive";
  if (!G.sp.location) return "need a stop";
  if (awayLeft() <= 0) return "already ran an away team today";
  return null;
}
export function awayChipOk() { return !awayReadyWhy(); }

// Shore evening picks — REUSE promenade/Quark; temple still gated by ds9Art
export const SHORE_PICKS = {
  quark: {
    id: "quark", title: "Quark's", sub: "dabo · drink · noise",
    art: "story_quarks", // always REUSE
    needGuest: false,
    beats: [
      { q: "Quark's is loud enough to drown a war. {short} eyes the dabo wheel.", choices: [
        { t: "Buy a round", op: 2 }, { t: "Watch one spin", op: 1 }, { t: "'Temple would have been quieter.'", op: 0 },
      ]},
      { q: "A Ferengi dealer grins. {short}: 'Do not bet the ship.'", choices: [
        { t: "Small stake — for pride", op: 1 }, { t: "Sit this one out", op: 1 }, { t: "Bluff a smile", op: 0 },
      ]},
      { q: "{short}: 'We leave before Quark invents a third fee.'", end: true, op: 1 },
    ],
  },
  temple: {
    id: "temple", title: "Temple quiet hour", sub: "Bajoran air · hush",
    art: "story_promenade", // NEW temple still waits on ds9Art; stand-in promenade
    artNew: "story_temple", // gated
    needGuest: false,
    beats: [
      { q: "The temple hush sits heavy after warp. {short} stands without fidgeting.", choices: [
        { t: "Stand in silence", op: 1 }, { t: "Whisper a name you lost", op: 2 }, { t: "'Five minutes. Then Quark.'", op: 0 },
      ]},
      { q: "{short}: 'Bajoran air tastes like someone else's peace treaty. I will take a cup of it anyway.'", choices: [
        { t: "'Temple first. Then Quark.'", op: 2 }, { t: "Nod and breathe", op: 1 }, { t: "'Civilization in the correct order.'", op: 1 },
      ]},
      { q: "You leave quieter than you arrived. The war waits outside.", end: true, op: 1 },
    ],
  },
  walk: {
    id: "walk", title: "Promenade walk", sub: "invite a companion",
    art: "story_promenade",
    needGuest: true,
    beats: [
      { q: "Promenade traffic parts around Starfleet gold. {short} keeps pace.", choices: [
        { t: "Point out a shop", op: 1 }, { t: "Ask how they are — really", op: 2 }, { t: "Walk in companionable quiet", op: 1 },
      ]},
      { q: "{short}: 'Docked means we pretend the frontier has a sidewalk.'", choices: [
        { t: "'I will take the sidewalk.'", op: 1 }, { t: "'Only if you are on it.'", op: 2, rom: true }, { t: "'Until the next order.'", op: 0 },
      ]},
      { q: "You loop back toward the airlock lighter by one evening.", end: true, op: 1 },
    ],
  },
  holo: { id: "holo", title: "Holosuite", sub: "Quark's programs", art: null, needGuest: false, link: "holo" },
  shop: { id: "shop", title: "Shopping", sub: "gift locker · Promenade", art: null, needGuest: false, link: "locker" },
};

export function shoreArtKey(pick) {
  const PICK = SHORE_PICKS[pick]; if (!PICK) return null;
  if (PICK.artNew && ds9ArtOn()) return PICK.artNew;
  return PICK.art || null;
}

export function shorePicksList() {
  return Object.values(SHORE_PICKS).map(p => ({
    id: p.id, title: p.title, sub: p.sub, needGuest: !!p.needGuest, link: p.link || null,
    art: shoreArtKey(p.id),
  }));
}

export function startShoreEvening(pick, { skipInvite = false } = {}) {
  const why = blockedWhy(); if (why) return { ok: false, why };
  if (!atDS9()) return { ok: false, why: "only while docked at DS9" };
  if (!shoreGranted()) return { ok: false, why: "request shore leave first" };
  if (shoreLeft() <= 0) return { ok: false, why: "already took a shore evening this visit" };
  const PICK = SHORE_PICKS[pick]; if (!PICK) return { ok: false, why: "unknown evening" };
  const rec = daySlot(A().shore);
  // Link-outs: holosuite / shopping mark the evening used and hand off
  if (PICK.link) {
    rec.n = 1; A().shore.visitDone = true; A().n.shores++;
    A().shore.pick = pick; daySlot(A().shore).invite = null;
    log(`Shore evening: ${PICK.title}.`, "good");
    awardXP(Math.floor(SHORE_XP / 2), "manual", "shore-" + pick);
    return { ok: true, link: PICK.link, pick };
  }
  let guest = null;
  if (PICK.needGuest || !skipInvite) {
    const st = ensureInvite(rec);
    guest = st.guest && st.guest !== "solo" ? st.guest : null;
    if (PICK.needGuest && !guest) return { ok: false, why: "invite a companion first" };
  }
  rec.n = 1; A().shore.visitDone = true; A().n.shores++;
  A().shore.pick = pick;
  A().session = {
    kind: "shore", phase: "chat", pick, guest, step: 0,
    mode: guest ? "near" : "solo",
    art: shoreArtKey(pick),
  };
  toast(`Shore evening · ${PICK.title}${guest ? ` with ${occ(guest).short}` : ""}`, "info");
  return { ok: true, pick, guest, art: shoreArtKey(pick) };
}

export function shoreView() {
  const s = A().session; if (!s || s.kind !== "shore" || s.phase !== "chat") return null;
  const PICK = SHORE_PICKS[s.pick]; if (!PICK || !PICK.beats) return null;
  const beats = PICK.beats;
  if ((s.step | 0) >= beats.length) {
    return { kind: "shore", title: PICK.title, pick: s.pick, guest: s.guest, mode: s.mode, art: s.art,
      q: "Evening done. Time to head back aboard.", choices: [], end: true, step: s.step };
  }
  const beat = beats[s.step | 0];
  const id = s.guest || "lt";
  const romOn = !!(P().romance && P().romance.opt === true && s.guest && P().romance.partner === s.guest);
  const choices = (beat.choices || []).map((c, j) => {
    let text = c.t;
    if (c.rom && !romOn) text = "'Keep walking.'";
    return { j, text, op: c.op };
  });
  return {
    kind: "shore", title: PICK.title, pick: s.pick, guest: s.guest, mode: s.mode || "solo", art: s.art,
    q: fill(beat.q, id), end: !!beat.end, step: s.step | 0, choices,
  };
}

export function answerShore(j) {
  const s = A().session; if (!s || s.kind !== "shore") return null;
  const PICK = SHORE_PICKS[s.pick]; if (!PICK || !PICK.beats) return finishShore();
  const beat = PICK.beats[s.step | 0];
  if (!beat || beat.end) return finishShore();
  const ch = (beat.choices || [])[j]; if (!ch) return null;
  if (s.guest && ch.op) nudge(s.guest, ch.op, "shore-evening", true);
  s.step = (s.step | 0) + 1;
  if (PICK.beats[s.step] && PICK.beats[s.step].end) {
    if (s.guest && PICK.beats[s.step].op) nudge(s.guest, PICK.beats[s.step].op, "shore-evening", true);
    return finishShore();
  }
  return { done: false };
}

function finishShore() {
  const s = A().session; if (!s) return { done: true };
  awardXP(SHORE_XP, "manual", "shore-" + (s.pick || "eve"));
  if (s.guest) {
    nudge(s.guest, 3, "shore-done", true);
    const r = needsOf(s.guest); r.n.fun = Math.min(100, r.n.fun + 25); r.n.social = Math.min(100, r.n.social + 25);
    addEntry(s.guest, "note", "shore evening on DS9");
    endApproach(s.guest, "finished");
  }
  const title = (SHORE_PICKS[s.pick] || {}).title || "Promenade";
  log(`Shore evening on DS9 · ${title}${s.guest ? ` with ${occ(s.guest).short}` : ""}.`, "good");
  daySlot(A().shore).invite = null;
  A().session = null;
  return { done: true };
}

// ---- Away missions (present-only 3-beat choice cards; war pacing; no ship destroy) ----
export const AWAY_MISSIONS = {
  listen: {
    id: "listen", title: "Listening post",
    blurb: "A quiet sweep of a sensor buoy the Dominion forgot to claim.",
    art: "story_generic_space", artNew: "story_away_listen",
    where: "any",
    beats: [
      { q: "Tricorders tick. {short}: 'Radiation before we glow — that is the deal.'", choices: [
        { t: "Wide sweep, careful", op: 1, style: "care" },
        { t: "Push the array closer", op: 1, style: "bold" },
        { t: "Abort if the buoy sings wrong", op: 0, style: "care" },
      ]},
      { q: "A Dominion handshake ghost flickers and dies. {short} does not blink.", choices: [
        { t: "Log and leave", op: 1, style: "care" },
        { t: "Copy the fragment", op: 2, style: "bold" },
        { t: "Stun the node — tap fire", op: 1, style: "bold", phaser: true },
      ]},
      { q: "Beam-up dust. No hull scrapes. The war is still out there — just not in your bones for one hour.", end: true, op: 1 },
    ],
    reward: { xp: AWAY_XP, parts: 1, rep: 1 },
  },
  supply: {
    id: "supply", title: "Outpost drop",
    blurb: "A short-range run to hand rations to an outpost that still answers Starfleet.",
    art: "story_kestrel_b", artNew: "story_away_supply",
    where: "any",
    beats: [
      { q: "{short}: 'Away team means I bring a type-2 and a bad attitude. You bring the diplomacy.'", choices: [
        { t: "Diplomacy it is", op: 1, style: "care" },
        { t: "Keep the type-2 holstered", op: 1, style: "care" },
        { t: "'Bad attitude optional.'", op: 0, style: "bold" },
      ]},
      { q: "The outpost CO looks thinner than the manifests. {short} shoulders a crate.", choices: [
        { t: "Hand over extra rations", op: 2, style: "care", costR: 15 },
        { t: "Stick to the manifest", op: 1, style: "care" },
        { t: "Ask for intel in trade", op: 1, style: "bold" },
      ]},
      { q: "Return pad hums. No chase. No heroics. A drop that stayed a drop.", end: true, op: 1 },
    ],
    reward: { xp: AWAY_XP, parts: 0, rep: 2 },
  },
  courtesy: {
    id: "courtesy", title: "Courtesy call",
    blurb: "A dockside handshake that keeps a thin alliance from fraying.",
    art: "story_promenade", artNew: "story_away_courtesy",
    where: "dock", // DS9 / homeworld flavour
    beats: [
      { q: "Dress uniforms itch. {short}: 'Smile like the treaty is thicker than it is.'", choices: [
        { t: "Smile on cue", op: 1, style: "care" },
        { t: "Lead with the truth", op: 1, style: "bold" },
        { t: "Let them talk first", op: 2, style: "care" },
      ]},
      { q: "A toast that is not quite Latinum, not quite trust. {short} raises a cup anyway.", choices: [
        { t: "Toast the crews", op: 2, style: "care" },
        { t: "Toast the ceasefire that is not", op: 1, style: "bold" },
        { t: "Keep it short", op: 0, style: "care" },
      ]},
      { q: "You leave with a thinner frown on their side of the table. That counts, this year.", end: true, op: 1 },
    ],
    reward: { xp: AWAY_XP, parts: 0, rep: 3 },
  },
};

export function awayArtKey(mid) {
  const M = AWAY_MISSIONS[mid]; if (!M) return null;
  if (M.artNew && awayArtOn()) return M.artNew;
  return M.art || null;
}

export function listAwayMissions() {
  const dock = atDS9() || (G.sp && !G.sp.travel && G.sp.location && ["ds9", "earth", "vulcan", "qonos", "romulus"].includes(G.sp.location));
  return Object.values(AWAY_MISSIONS).filter(m => m.where === "any" || (m.where === "dock" && dock)).map(m => ({
    id: m.id, title: m.title, blurb: m.blurb, art: awayArtKey(m.id), where: m.where,
  }));
}

export function startAway(missionId) {
  const why = awayReadyWhy(); if (why) return { ok: false, why };
  const M = AWAY_MISSIONS[missionId]; if (!M) return { ok: false, why: "unknown mission" };
  const dock = atDS9() || (G.sp && !G.sp.travel && G.sp.location && ["ds9", "earth", "vulcan", "qonos", "romulus"].includes(G.sp.location));
  if (M.where === "dock" && !dock) return { ok: false, why: "need a dock stop" };
  const rec = daySlot(A().away), st = ensureInvite(rec);
  const guest = st.guest && st.guest !== "solo" ? st.guest : null;
  // Page: pick 1-2 crew — require at least one yes (solo only if forced after 2 nos)
  if (!guest && st.guest !== "solo") return { ok: false, why: "invite at least one teammate" };
  rec.n = 1; A().n.aways++;
  A().away.mission = missionId;
  A().session = {
    kind: "away", phase: "chat", mission: missionId, guest: guest || null, step: 0,
    mode: guest ? "near" : "solo", art: awayArtKey(missionId), bold: 0, care: 0,
  };
  toast(`Away team · ${M.title}${guest ? ` · ${occ(guest).short}` : " · solo"}`, "info");
  return { ok: true, mission: missionId, guest, art: awayArtKey(missionId) };
}

export function awayView() {
  const s = A().session; if (!s || s.kind !== "away" || s.phase !== "chat") return null;
  const M = AWAY_MISSIONS[s.mission]; if (!M) return null;
  const beats = M.beats;
  if ((s.step | 0) >= beats.length) {
    return { kind: "away", title: M.title, mission: s.mission, guest: s.guest, mode: s.mode, art: s.art,
      q: "Pad locks. Team accounted for. No one left behind.", choices: [], end: true, step: s.step };
  }
  const beat = beats[s.step | 0];
  const id = s.guest || "lt";
  return {
    kind: "away", title: M.title, mission: s.mission, guest: s.guest, mode: s.mode || "solo", art: s.art,
    q: fill(beat.q, id), end: !!beat.end, step: s.step | 0,
    choices: (beat.choices || []).map((c, j) => ({ j, text: c.t, op: c.op, style: c.style, costR: c.costR || 0 })),
  };
}

export function answerAway(j) {
  const s = A().session; if (!s || s.kind !== "away") return null;
  const M = AWAY_MISSIONS[s.mission]; if (!M) return finishAway();
  const beat = M.beats[s.step | 0];
  if (!beat || beat.end) return finishAway();
  const ch = (beat.choices || [])[j]; if (!ch) return null;
  if (ch.costR && !canAfford({ rations: ch.costR })) return { ok: false, why: "not enough rations" };
  if (ch.costR) spend({ rations: ch.costR }, "away-drop");
  if (s.guest && ch.op) nudge(s.guest, ch.op, "away-beat", true);
  if (ch.style === "bold") s.bold = (s.bold | 0) + 1;
  if (ch.style === "care") s.care = (s.care | 0) + 1;
  if (ch.phaser) { s.phaserTap = (s.phaserTap | 0) + 1; toast("Phaser · stun — clean hit", "info"); }
  s.step = (s.step | 0) + 1;
  if (M.beats[s.step] && M.beats[s.step].end) {
    if (s.guest && M.beats[s.step].op) nudge(s.guest, M.beats[s.step].op, "away-beat", true);
    return finishAway();
  }
  return { done: false };
}

function finishAway() {
  const s = A().session; if (!s) return { done: true };
  const M = AWAY_MISSIONS[s.mission] || { title: "Away", reward: { xp: AWAY_XP, parts: 0, rep: 1 } };
  const rw = M.reward || { xp: AWAY_XP, parts: 0, rep: 1 };
  awardXP(rw.xp || AWAY_XP, "manual", "away-" + (s.mission || "run"));
  // War pacing: crumbs only — never hull / permadeath. Careful runs nudge a tiny parts scrap.
  if (rw.parts) G.ship.parts = (G.ship.parts | 0) + rw.parts;
  else if ((s.care | 0) >= 2) G.ship.parts = (G.ship.parts | 0) + 1;
  if (rw.rep) {
    try { P().fleetRep = (P().fleetRep | 0) + rw.rep; } catch (e) {}
  }
  if (s.guest) {
    nudge(s.guest, 4, "away-done", true);
    const r = needsOf(s.guest); r.n.fun = Math.min(100, r.n.fun + 15); r.n.social = Math.min(100, r.n.social + 20);
    addEntry(s.guest, "note", "away team with you");
    endApproach(s.guest, "finished");
  }
  log(`Away team · ${M.title}${s.guest ? ` with ${occ(s.guest).short}` : ""} — returned intact.`, "good");
  daySlot(A().away).invite = null;
  A().away.mission = null;
  A().session = null;
  return { done: true };
}



// ============================== Crew spar sheets + phaser range ==============================
/** Resolve crew spar sheet asset for roster id (personal → species → dept → null). */
export function crewSparAsset(id) {
  if (!id) return null;
  const direct = CREW_SPAR_SHEETS[id];
  if (direct) return direct;
  try {
    const o = occ(id); if (!o) return null;
    const sp = o.species || (OWN_SHEETS[id] === "andorian" ? "andorian" : null);
    if (sp && CREW_SPAR_SHEETS["_species_" + sp]) return CREW_SPAR_SHEETS["_species_" + sp];
    const sl = SLOTMAP[o.slot];
    const dept = sl && sl.dept;
    if (dept === "command") return CREW_SPAR_SHEETS._dept_red || null;
    if (dept === "ops" || dept === "eng" || dept === "sec" || dept === "svc") return CREW_SPAR_SHEETS._dept_gold || null;
    if (dept === "sci" || dept === "med") return CREW_SPAR_SHEETS._dept_blue || null;
  } catch (e) {}
  return null;
}

/** Ensure CHAR_FRAMES["spar:"+asset] exists when IMG is loaded; return who key or null. */
export function ensureCrewSparFrames(asset) {
  if (!asset || !IMG[asset] || !IMG[asset].width) return null;
  const who = "spar:" + asset;
  if (CHAR_FRAMES[who] && CHAR_FRAMES[who].punch) return who;
  const C = LT2_CELL;
  const F = CHAR_FRAMES[who] = {};
  ["punch", "block"].forEach((action, ai) => {
    F[action] = {};
    LT2_DIRS.forEach((dir, col) => {
      F[action][dir] = [0, 1, 2].map(k => ({ img: asset, x: col * C.w, y: (ai * 3 + k) * C.h,
        w: C.w, h: C.h, ax: C.ax, ay: C.ay, refH: LT2_STAND_H }));
    });
  });
  const shift = CREW_SPAR_XSHIFT || { right: -12, left: 4 };
  for (const act of ["punch", "block"]) {
    for (const [dir, dax] of Object.entries(shift)) {
      if (!F[act][dir]) continue;
      F[act][dir] = F[act][dir].map(fr => ({ ...fr, ax: fr.ax - dax }));
    }
  }
  return who;
}

export function guestSparWho(id) {
  if (!crewSparArtOn()) return null;
  const asset = crewSparAsset(id);
  return asset ? ensureCrewSparFrames(asset) : null;
}

export function pinSparGuest(id) {
  const n = npcOf(id); if (!n) return;
  const spot = sparSpot();
  if (n.deck !== spot.deck) { n.deck = spot.deck; }
  const ox = spot.face === "right" ? 0.07 : -0.07;
  n.x = spot.x + ox; n.y = spot.y; n.dir = spot.guestFace || "left";
  n.mode = "idle"; n.path = null; n.next = null; n.action = null;
  n.hidden = false;
  // spar pose override consumed by renderer
  const s = A().session;
  if (s && s.kind === "spar" && s.guestSparWho) {
    n._sparPose = s.pose === "punch" ? "block" : (s.pose === "block" ? "punch" : "talk");
    n._sparWho = s.guestSparWho;
  } else {
    n._sparPose = "talk"; n._sparWho = null;
  }
}

export function phaserLeft(at) { return Math.max(0, 1 - (dayRec(A().phaser, at).n | 0)); }
export function phaserChipOk() {
  if (blockedWhy() || phaserLeft() <= 0) return false;
  const L = G.lt; if (!L || L.lift) return false;
  if (gymRoomOn()) return L.deck === "gym";
  return L.deck === "lounge" || L.deck === "berthing";
}

export function startPhaserRange() {
  const why = blockedWhy(); if (why) return { ok: false, why };
  if (phaserLeft() <= 0) return { ok: false, why: "already on the range today" };
  if (!phaserChipOk()) return { ok: false, why: gymRoomOn() ? "meet in the Gym" : "training deck" };
  const rec = dayRec(A().phaser); rec.n = 1; A().n.phasers++;
  const artOn = phaserArtOn() && ensureLtPhaserFrames();
  A().session = {
    kind: "phaser", phase: "range", t: 0, dur: 25, hits: 0, miss: 0,
    target: randTarget(), art: artOn, nextAt: 0.6, pose: "aim", xpPaid: 0,
  };
  if (A().session.target) A().session.target.born = 0;
  toast("Phaser range · stun setting · tap targets", "info");
  return { ok: true };
}

function randTarget() {
  return { x: 18 + Math.random() * 64, y: 22 + Math.random() * 56, born: 0 };
}

export function tickPhaserRange(dt) {
  const s = A().session; if (!s || s.kind !== "phaser" || s.phase !== "range") return;
  if (!isPresent() || idlePaused() || badClock()) return;
  if (G.sp && (G.sp.battle || G.sp.alert)) { finishPhaser(true); return; }
  s.t = (s.t || 0) + dt;
  if (s.poseUntil != null && s.t >= s.poseUntil) { s.pose = "aim"; s.poseUntil = null; }
  if (!s.pose) s.pose = "aim";
  if (s.t >= s.dur) { finishPhaser(false); return; }
  // expire missed target
  if (s.target && s.t - (s.target.born || 0) > 1.8) {
    s.miss = (s.miss | 0) + 1; s.target = null; s.nextAt = s.t + 0.35;
  }
  if (!s.target && s.t >= (s.nextAt || 0)) {
    s.target = randTarget(); s.target.born = s.t;
  }
  // Live UI: refresh ~8 Hz while range is open
  s._uiAcc = (s._uiAcc || 0) + dt;
  if (s._uiAcc >= 0.12) { s._uiAcc = 0; try { if (phaserUI.refresh) phaserUI.refresh(); } catch (e) {} }
}

export function phaserView() {
  const s = A().session; if (!s || s.kind !== "phaser") return null;
  if (s.phase === "done") {
    return { kind: "phaser", end: true, q: s.summary || "Range closed.", hits: s.hits, miss: s.miss, left: 0 };
  }
  return {
    kind: "phaser", end: false, phaserArt: !!s.art,
    left: Math.max(0, Math.ceil((s.dur || 25) - (s.t || 0))),
    hits: s.hits | 0, miss: s.miss | 0,
    target: s.target ? { x: s.target.x, y: s.target.y } : null,
    pose: s.pose || "aim",
  };
}

export function phaserHit() {
  const s = A().session; if (!s || s.kind !== "phaser" || s.phase !== "range") return null;
  if (!s.target) { s.miss = (s.miss | 0) + 1; return { hit: false }; }
  const tgt = s.target;
  s.hits = (s.hits | 0) + 1; s.lastHit = tgt; s.pose = "fire"; s.poseUntil = (s.t || 0) + 0.35;
  s.target = null; s.nextAt = (s.t || 0) + 0.25;
  return { hit: true, target: tgt };
}

export function answerPhaser() {
  const s = A().session; if (!s || s.kind !== "phaser") return null;
  if (s.phase === "done") { A().session = null; return { done: true, line: s.summary }; }
  return finishPhaser(false);
}

function finishPhaser(aborted) {
  const s = A().session; if (!s || s.kind !== "phaser") return { done: true };
  if (s.phase === "done") return { done: true, line: s.summary, xp: s.xpPaid || 0, hits: s.hits | 0 };
  const hits = s.hits | 0;
  const xp = aborted ? 0 : clamp(3 + Math.min(2, Math.floor(hits / 4)), 0, 5);
  if (xp && !s.xpPaid) { awardXP(xp, "manual", "phaser-range"); s.xpPaid = xp; }
  const line = aborted
    ? "Phaser range cut short — red alert."
    : `Phaser range: ${hits} hit${hits === 1 ? "" : "s"}, stun setting.`;
  log(line, aborted ? "warn" : "good");
  s.phase = "done"; s.summary = line + (xp ? ` · +${xp} XP` : ""); s.xpPaid = s.xpPaid || xp;
  // Notify UI to flip to end card
  try { if (typeof phaserUI !== "undefined" && phaserUI.refresh) phaserUI.refresh(); } catch (e) {}
  return { done: true, line: s.summary, xp: s.xpPaid || 0, hits };
}
export const phaserUI = { refresh: null }; // set by ui/lt-act.js


export function chipsHtml() {
  let h = "";
  if (mealChipOk()) h += `<button class="chip mealc hasart" data-ltact="meal"><img class="chipart" src="assets/chip-meal.webp" alt="">Share a meal ▸</button>`;
  if (cardsChipOk()) h += `<button class="chip cardc hasart" data-ltact="cards"><img class="chipart" src="assets/chip-cards.webp" alt="">Card night ▸</button>`;
  if (dutyChipOk()) h += `<button class="chip dutyc" data-ltact="duty">Stand this watch ▸</button>`;
  if (A().repair.active) h += `<button class="chip repairc" data-ltact="repair">Repair call ▸</button>`;
  else if (pendingKitCalls().length && repairLeft() > 0 && !blockedWhy()) h += `<button class="chip repairc" data-ltact="repair-offer">Repair call ▸</button>`;
  if (mentorLeft() > 0 && mentorJuniorIds().length && !blockedWhy() && mentorDeckOk()) {
    h += `<button class="chip mentorc" data-ltact="mentor">Mentoring ▸</button>`;
  }
  if (logChipOk()) h += `<button class="chip logc" data-ltact="log">Write a log ▸</button>`;
  if (decorChipOk()) h += `<button class="chip decorc" data-ltact="decor">Decorate ▸</button>`;
  if (showChipOk()) h += `<button class="chip showc" data-ltact="show">Show someone in ▸</button>`;
  if (sparChipOk()) h += `<button class="chip sparc" data-ltact="spar">Sparring ▸</button>`;
  if (shoreChipOk()) h += `<button class="chip shoreevec" data-ltact="shore">Shore evening ▸</button>`;
  if (awayChipOk()) h += `<button class="chip awayc" data-ltact="away">Away team ▸</button>`;
  if (phaserChipOk()) h += `<button class="chip phaserc" data-ltact="phaser">Phaser range ▸</button>`;
  if (A().quest.active) {
    const q = QUESTS[A().quest.active.id];
    if (q) h += `<button class="chip questc" data-ltact="quest">Quest: ${q.title} ▸</button>`;
  } else if (listQuestOffers().length && G.lt && G.lt.deck && !blockedWhy()) {
    h += `<button class="chip questc" data-ltact="quest-offer">Personal ask ▸</button>`;
  }
  return h;
}

