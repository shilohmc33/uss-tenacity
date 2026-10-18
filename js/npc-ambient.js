// Ambient crew NPCs: one per occupied CREW_ROSTER slot (js/roster.js), except T'Ren (js/npc.js draws her). Visual
// only: runtime state lives here, is never saved and is not simulated offline. Only the Lt's current deck is ticked and
// drawn, at most PROG.roster.maxVisible per deck (T'Ren counts on the bridge). Persisted bits: chat-line / perk stamps
// in G.npc[occupantId] (ship-elapsed seconds). The roster itself (who is aboard) lives in G.prog.crew (crewlife.js).
// Behaviour: drift between the slot's spots (A* on the deck walk mask), dwell playing the spot's action; hold the post
// (first spot) during red alert. Social: when the Lt uses one of the slot's chat nodes nearby, one crew member at a time
// comes over and both play "talk" (PROG.roster cooldowns). A newcomer (intro pending) crosses the deck to introduce
// themself the first time the Lt is on their deck. Slot "mess-regular-1" keeps Thelev's hand-made config (AMBIENT_NPCS).
import { G } from "./state.js";
import { AMBIENT_NPCS, NODEMAP, CHAR_SHEETS, DECKS, TREN, CONSOLES } from "./data.js";
import { walkStep, walkSettle, keepPace, animSeed, pathNear, blockedAhead, faceDir as faceTo, AVOID } from "./anim.js";
import { tren, trenHooks } from "./npc.js";
import { tintBaseFor } from "./art-hooks.js";
import { CREW_ROSTER, SLOTMAP, SPECIES, DEPTS, TAGS, prFill } from "./roster.js";
import { findPath, isWalkable, nearestWalkable, cellCenter } from "./path.js";
import { clamp, dDist } from "./util.js";
import { log, fx, cheerful } from "./bus.js";
import { PROG, chatXP, addr, fullName } from "./progression.js";
import { introDone } from "./crewlife.js";

const rnd = ([a, b]) => a + Math.random() * (b - a);
const faceDir = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
const CUSTOM = Object.fromEntries(AMBIENT_NPCS.map(c => [c.id, c]));
const NEAR = [{ dx: 0.075, dy: 0 }, { dx: -0.075, dy: 0 }, { dx: 0, dy: 0.11 }, { dx: 0, dy: -0.1 }];
// resolve a config spot (absolute or node-relative) and snap it onto the walk mask; snap = px it had to move
// a "computer" spot snaps exactly onto a console work spot within 20 px (data.js CONSOLES), else it stays put and the
// crewmember will stand idle there instead of typing in mid-air
const CON = Object.fromEntries(Object.entries(CONSOLES).map(([d, l]) => [d, l.map(([x, y, face]) => ({ x: x / 960, y: y / 640, face }))]));
export function consoleNear(deck, x, y, face, r = 20) { return (CON[deck] || []).find(c => (!face || c.face === face) && dDist(c.x, c.y, x, y) <= r) || null; }
function resolve(deck, s) {
  let x = s.x, y = s.y;
  if (s.near && NODEMAP[s.near]) { x = NODEMAP[s.near].x + (s.dx || 0); y = NODEMAP[s.near].y + (s.dy || 0); }
  const x0 = x, y0 = y;
  if (!isWalkable(deck, x, y)) [x, y] = cellCenter(...nearestWalkable(deck, x, y));
  if (s.action === "computer") { const c = consoleNear(deck, x0, y0, s.face) || consoleNear(deck, x, y, s.face); if (c) { x = c.x; y = c.y; } }
  return { x, y, snap: dDist(x, y, x0, y0) };
}
// the loop a dwelling crewmember plays: typing only at a console, never on open floor
const workAction = n => { const a = n.spot.action || null; return a === "computer" && !consoleNear(n.deck, n.x, n.y, n.spot.face, 6) ? null : a; };
// chat spot beside the Lt at a social node: first candidate whose snap stays within maxSnap (else the least-moved one)
function chatSpot(n, node) {
  const so = n.cfg.social, cands = [].concat(so.nodes[node] || NEAR).map(o => resolve(n.deck, { near: node, dx: o.dx, dy: o.dy }));
  return cands.find(c => c.snap <= (so.maxSnap ?? 28)) || cands.sort((a, b) => a.snap - b.snap)[0];
}
// a spot beside wherever the Lt stands (newcomer intros)
function besideLt(n) {
  const L = G.lt, c = NEAR.map(o => resolve(n.deck, { x: L.x + o.dx, y: L.y + o.dy })).filter(c => c.snap <= 28);
  return (c.length ? c : NEAR.map(o => resolve(n.deck, { x: L.x + o.dx, y: L.y + o.dy }))).sort((a, b) => dDist(a.x, a.y, n.x, n.y) - dDist(b.x, b.y, n.x, n.y))[0];
}
// where everyone else on n's deck stands, or is about to stand (a walker's destination): the Lt, T'Ren, other crew
function claims(n) {
  const L = G.lt, out = [];
  if (L.deck === n.deck && !L.lift) { const e = L.mode === "walk" && L.path && L.path.length ? L.path[L.path.length - 1] : [L.x, L.y]; out.push({ x: e[0], y: e[1] }); }
  if (n.deck === TREN.deck && L.deck === TREN.deck) out.push(tren.mode === "walk" && tren.spot ? tren.spot : tren);
  for (const a of ambient) if (a !== n && a.deck === n.deck && a.x !== null) out.push(a.mode === "walk" && a.target ? a.target : a.mode === "aside" && a.asideFrom ? a.asideFrom : a);
  return out;
}
const claimed = (n, x, y, r = AVOID.standR) => claims(n).some(c => dDist(c.x, c.y, x, y) < r);
// pass 09 (4): somebody is standing on n (within standR): the Lt or T'Ren standing still, or a standing crewmate with an
// earlier id (so only one of two crew moves). n then moves to another free spot instead of sharing it for seconds.
function crowded(n) {
  const L = G.lt, r = AVOID.standR;
  if (L.deck === n.deck && !L.lift && !L.moving && L.mode !== "walk" && dDist(L.x, L.y, n.x, n.y) < r) return true;
  if (n.deck === TREN.deck && L.deck === TREN.deck && tren.mode !== "walk" && dDist(tren.x, tren.y, n.x, n.y) < r) return true;
  return ambient.some(a => a !== n && a.deck === n.deck && a.x !== null && a.mode !== "walk" && a.occId < n.occId && dDist(a.x, a.y, n.x, n.y) < r);
}
// T'Ren picks only a console nobody stands at or is heading for (npc.js)
trenHooks.standers = () => ambient.filter(a => a.deck === TREN.deck && a.x !== null && visibleOn(TREN.deck).includes(a)).map(a => a.mode === "walk" && a.target ? a.target : a);
function pickSpot(cfg, notId, n = null) {
  const busy = new Set(ambient.filter(a => a.deck === cfg.deck && a.spot && a !== n).map(a => a.spot.id));   // spread out: avoid spots others hold
  const free = s => !busy.has(s.id) && (!n || !claimed(n, ...Object.values(resolve(cfg.deck, s)).slice(0, 2)));   // pass 09: nor where anyone stands / is headed
  let pool = cfg.spots.filter(s => s.id !== notId && free(s)); if (!pool.length) pool = cfg.spots.filter(s => s.id !== notId && !busy.has(s.id)); if (!pool.length) pool = cfg.spots.filter(s => s.id !== notId);
  if (!pool.length) return cfg.spots[0];
  const tot = pool.reduce((a, s) => a + (s.w || 1), 0);
  let r = Math.random() * tot;
  for (const s of pool) { r -= s.w || 1; if (r <= 0) return s; }
  return pool[0];
}
// sprite: own sheet -> species base sheet -> generic crew sheet in the department's uniform colour
export function sheetFor(o, sl) {
  if (o.sheet && CHAR_SHEETS[o.sheet]) return o.sheet;
  const sp = SPECIES[o.species]; if (sp && sp.sheet && CHAR_SHEETS[sp.sheet]) return sp.sheet;
  const base = tintBaseFor(o.pronoun); if (base) return base;   // art hook: tint-ready grey crew base (data.js TINT_BASES)
  return "crew-" + ((DEPTS[sl.dept] && DEPTS[sl.dept].tint) || "red");
}
function linesFor(o) {
  const L = []; for (const t of o.tags || []) L.push(...(TAGS[t] || []));
  return L.length ? L : TAGS.warm;
}
// per-occupant config: the slot's spots / chat nodes, the occupant's lines; Thelev's slot keeps her hand-made config
function cfgFor(sl, o) {
  const R = PROG.roster;
  if (sl.ambient && CUSTOM[sl.ambient]) {
    const c = CUSTOM[sl.ambient], mine = o.id === c.id;
    return { ...c, id: o.id, rank: "", name: fullName(o), short: o.short, pronoun: o.pronoun, custom: true, social: { ...c.social, lines: mine ? c.social.lines : linesFor(o) } };
  }
  const nodes = {}; for (const nd of sl.chat || []) nodes[nd] = NEAR;
  return { id: o.id, deck: sl.deck, speed: R.speed, spots: sl.spots, name: fullName(o), short: o.short, pronoun: o.pronoun,
    social: { nodes, maxSnap: 28, joinRange: R.joinRange, chatRange: 150, chatDur: [12, 20], lingerT: [3, 6], lineCooldown: 0, lines: linesFor(o) } };
}
export const ambient = [];
let syncV = -1, syncC = null;
const ORDER = ["mess-regular-1", ...CREW_ROSTER.map(s => s.slot).filter(s => s !== "mess-regular-1")];   // Thelev's slot first (tools use ambient[0])
function makeNpc(sl, o, atLift) {
  const cfg = cfgFor(sl, o), s0 = (cfg.start && cfg.spots.find(s => s.id === cfg.start)) || cfg.spots[0] || { id: "lift", x: DECKS[sl.deck].lift.x, y: DECKS[sl.deck].lift.y, t: [5, 10] };
  const n = { slot: sl.slot, occId: o.id, cfg, who: sheetFor(o, sl), tint: (DEPTS[sl.dept] || {}).color, anim: animSeed(o.id), deck: sl.deck, x: null, y: null, dir: s0.face || "down",
    mode: "dwell", spot: s0, t: rnd(s0.t || [10, 20]), path: null, pathI: 0, walkPhase: 0, swingAmp: 0, moving: false, walkDist: 0,
    action: s0.action || null, chatWith: null, chatT: 0, chatNode: null, chatKind: null, doneNode: null, next: null, lastChat: -1e9 };
  if (atLift) { const lf = DECKS[sl.deck].lift; const p = resolve(sl.deck, { x: lf.x, y: lf.y }); n.x = p.x; n.y = p.y; n.t = 1; }
  return n;
}
// keep one NPC per occupied slot (cheap: only rebuilds when the roster version changes)
export function syncRoster() {
  const C = G.prog && G.prog.crew; if (!C) return;
  if (syncC === C && syncV === C.v) return;
  const first = syncC !== C; syncC = C; syncV = C.v;
  const keep = [];
  for (const slot of ORDER) {
    const sl = SLOTMAP[slot]; if (!sl || sl.npc === false) continue;
    const id = C.slots[slot], o = id && C.occ[id]; if (!o) continue;
    if (G.prog.med && G.prog.med.inj.some(x => x.id === id)) continue;   // phase 6: in sickbay (drawn on a biobed by render/deck.js)
    let n = ambient.find(a => a.slot === slot && a.occId === id);
    if (!n) n = makeNpc(sl, o, !first && !!o.intro);   // a newcomer steps off the turbolift
    else { n.cfg = cfgFor(sl, o); n.who = sheetFor(o, sl); n.tint = (DEPTS[sl.dept] || {}).color; }
    keep.push(n);
  }
  ambient.length = 0; ambient.push(...keep);
}
// ---- pass 08 (audit C5): yield and step aside so nobody walks through anybody ----
// walkers on n's deck other than n: the Lt, T'Ren (bridge) and walking crew
function walkersNear(n) {
  const L = G.lt, out = [];
  if (L.deck === n.deck && !L.lift && L.mode === "walk") out.push(L);
  if (n.deck === TREN.deck && L.deck === TREN.deck && tren.mode === "walk") out.push(tren);
  for (const a of ambient) if (a !== n && a.deck === n.deck && a.x !== null && a.mode === "walk") out.push(a);
  return out;
}
// who a walking crewmate gives way to: the Lt, T'Ren, anyone standing still is handled by them stepping aside;
// between two walking crew the one with the later id waits
function yieldTo(n) {
  const L = G.lt, out = [];
  if (L.deck === n.deck && !L.lift) out.push(L);
  if (n.deck === TREN.deck && L.deck === TREN.deck) out.push(tren);
  for (const a of ambient) if (a !== n && a.deck === n.deck && a.x !== null && a.mode === "walk" && a.occId < n.occId) out.push(a);
  return out;
}
// a walker is about to reach n (its path comes within AVOID.asideR in the next AVOID.asideLook px): step ~32 px off the
// line (the side n is already on), wait, go back. Pass 09 (3): after an aside, AVOID.asideCool s pass before the next one
// unless the walker would walk straight into n (< asideHard), so a wandering Lt no longer sets off hop-swivel-hop loops.
function stepAside(n) {
  const cool = G.ship.elapsed - (n.asideAt ?? -1e9) < AVOID.asideCool;
  for (const w of walkersNear(n)) {
    const pn = pathNear(w, n.x, n.y, AVOID.asideLook);
    if (pn.d >= (cool ? AVOID.asideHard : AVOID.asideR)) continue;
    // nearest walkable spot 32-64 px away that is clear of the walker's path, preferring off to the side n is on
    const wp = w.path[Math.min(w.pathI, w.path.length - 1)], mx = (wp[0] - w.x) * 960, my = (wp[1] - w.y) * 640, ml = Math.hypot(mx, my) || 1;
    let best = null;
    for (const r of [AVOID.asideStep, AVOID.asideStep * 1.5, AVOID.asideStep * 2]) {
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2, ox = Math.cos(a) * r, oy = Math.sin(a) * r, x = n.x + ox / 960, y = n.y + oy / 640;
        if (!isWalkable(n.deck, x, y) || pathNear(w, x, y).d < AVOID.asideR + 4) continue;
        const along = (ox * mx + oy * my) / ml;                    // moving along his path (towards him) costs more
        const score = r + Math.max(0, along) * 0.6 + Math.abs(along) * 0.2;
        if (!best || score < best.s) best = { x, y, s: score };
      }
      if (best) break;
    }
    if (best) { n.asideFrom = { x: n.x, y: n.y, spot: n.spot, dir: n.dir, walker: w }; n.asideAt = G.ship.elapsed; goTo(n, { x: best.x, y: best.y }, "aside"); return true; }
  }
  return false;
}
function home(n) { const p = resolve(n.deck, n.spot); n.x = p.x; n.y = p.y; }
function goTo(n, target, mode, spot = null) {
  const p = findPath(n.deck, n.x, n.y, target.x, target.y);
  const pace = n.mode === "walk" && keepPace(n);
  n.path = (p || []).concat([[target.x, target.y]]); n.pathI = 0; n.mode = "walk"; if (!pace) n.walkDist = 0; n.next = mode; n.target = target;
  if (spot) n.spot = spot;
}
const mem = id => { G.npc = G.npc || {}; return (G.npc[id] = G.npc[id] || { lineAt: -1e9, perkAt: -1e9, lineI: 0 }); };
let lastAnyChat = -1e9;
const lockedBy = n => ambient.find(a => a !== n && a.deck === n.deck && (a.mode === "chat" && a.chatWith || (a.mode === "walk" && (a.next === "chat" || a.next === "intro"))));
function startChat(n, kind = "social") {
  const c = n.cfg, so = c.social, m = mem(c.id), now = G.ship.elapsed, S = G.ship;
  n.mode = "chat"; n.chatKind = kind; n.chatT = rnd(so.chatDur); n.lastChat = now; lastAnyChat = now;
  if (kind === "intro") { introDone(c.id); chatXP(c.id); return; }
  chatXP(c.id);   // progression: 3 XP per chat (shared 2-min cooldown) + opinion
  if (!cheerful()) return;   // pass 06 m1: the ship goes quiet for a while after a death
  if (now - m.lineAt >= so.lineCooldown) {
    m.lineAt = now;
    const line = so.lines[m.lineI++ % so.lines.length].replace("{name}", c.name).replace(/\{short\}/g, c.short).replace(/\{lt\}/g, addr()); const lineP = prFill(line, c);
    log(lineP, "comm");
  }
  if (so.perk && now - m.perkAt >= so.perk.cooldown) {
    m.perkAt = now;
    const before = S.energy; S.energy = clamp(S.energy + so.perk.energy, 0, 100);
    const got = Math.round(S.energy - before);
    if (got > 0) {   // energy already full: the chat still happens, but no "energy +0" line or floater
      log(`A few words with ${c.short} lift the Lieutenant's spirits — energy +${got}.`, "good");
      fx("floater", { x: G.lt.x, y: G.lt.y - 0.235, text: `+${got} ENERGY`, color: "#66e0d0", delay: 0.3, life: 2.2 });
    }
  }
}
// the Lt is "socialising" when he's using one of this NPC's chat nodes on its deck
function ltSocialNode(n) {
  const L = G.lt, so = n.cfg.social;
  if (!so || L.deck !== n.deck || L.lift || L.mode !== "use" || !L.node || !so.nodes[L.node]) return null;
  return L.node;
}
const introPending = n => { const o = G.prog.crew.occ[n.occId]; return !!(o && o.intro); };
function tickOne(n, dt) {
  if (n.x === null) home(n);
  const L = G.lt, so = n.cfg.social, node = ltSocialNode(n), now = G.ship.elapsed, R = PROG.roster;
  if (n.doneNode && node !== n.doneNode) n.doneNode = null;   // he left: may chat again next time
  n.moving = false; n.action = null; n.chatWith = null;
  const busyChat = n.mode === "chat" || (n.mode === "walk" && (n.next === "chat" || n.next === "intro"));
  // a newcomer introduces themself: walk over to wherever he is on this deck
  if (introPending(n) && !busyChat && L.deck === n.deck && !L.lift && !lockedBy(n) && dDist(n.x, n.y, L.x, L.y) <= R.introRange) {
    const sp = besideLt(n);
    if (dDist(n.x, n.y, sp.x, sp.y) <= 24) startChat(n, "intro"); else goTo(n, sp, "intro");
  } else if (node && node !== n.doneNode && !busyChat && !lockedBy(n) && (n.cfg.custom || (now - n.lastChat >= R.chatEvery && now - lastAnyChat >= R.chatGap))) {
    // social trigger: head over to him (or chat in place if already close)
    const spot = chatSpot(n, node);
    if (dDist(n.x, n.y, spot.x, spot.y) <= 24) startChat(n);
    else if (dDist(n.x, n.y, L.x, L.y) <= so.joinRange) { n.chatNode = node; goTo(n, spot, "chat"); }
  }
  if (n.mode === "walk") {
    // an intro walker re-aims when he has moved on
    if (n.next === "intro" && n.target && (L.deck !== n.deck || L.lift)) { n.mode = "dwell"; n.t = 1; n.path = null; }
    else if (n.next === "intro" && n.target && dDist(n.target.x, n.target.y, L.x, L.y) > 90 && (n.reaimT = (n.reaimT || 0) + dt) > 1) { n.reaimT = 0; goTo(n, besideLt(n), "intro"); }
  }
  if (n.mode === "walk") {
    if (n.escapeT > 0) n.escapeT -= dt;   // pass 10 (3): walking off a spot someone stands on: don't give way to whoever is standing on you
    const yi = n.escapeT > 0 ? yieldTo(n).filter(o => dDist(o.x, o.y, n.x, n.y) >= AVOID.standR + 4) : yieldTo(n);
    if (blockedAhead(n, yi) && (n.yieldT = (n.yieldT || 0) + dt) < AVOID.yieldMaxS) { /* give way */ }
    else { if (!blockedAhead(n, yi)) n.yieldT = 0; walkStep(n, n.who, n.cfg.speed * 960, dt); }
    if (n.pathI >= n.path.length) {
      n.path = null;
      if (n.next === "intro") { if (L.deck === n.deck && !L.lift && dDist(n.x, n.y, L.x, L.y) <= 160) startChat(n, "intro"); else { n.mode = "dwell"; n.t = 1; n.spot = { id: "linger", face: n.dir, action: null }; } }
      else if (n.next === "aside") { n.mode = "aside"; n.t = 0.6; n.faceT = 0; const w = n.asideFrom && n.asideFrom.walker; if (w && w.x != null) n.dir = faceTo((w.x - n.x) * 960, (w.y - n.y) * 640); }   // face the walker once
      else if (n.next === "chat") { if (node) startChat(n); else { n.mode = "dwell"; n.t = rnd(so.lingerT); n.spot = { id: "linger", face: n.dir, action: null }; } }
      else { n.mode = "dwell"; n.t = rnd(n.spot.t || [10, 20]); n.dir = n.spot.face || n.dir; }
    }
  } else if (n.mode === "chat") {
    const gone = n.chatKind === "intro" ? (L.deck !== n.deck || L.lift || dDist(n.x, n.y, L.x, L.y) > so.chatRange * 2) : (!node || dDist(n.x, n.y, L.x, L.y) > so.chatRange * 1.4);
    if (gone) {   // he left: linger a moment, then drift on
      n.mode = "dwell"; n.t = rnd(so.lingerT); n.spot = { id: "linger", face: n.dir, action: null };
    } else {
      n.chatWith = L; n.action = "talk"; n.dir = faceDir((L.x - n.x) * 960, (L.y - n.y) * 640);
      n.chatT -= dt;
      if (n.chatT <= 0) { n.doneNode = node; n.mode = "dwell"; n.t = 0; }   // conversation over; no rejoin until he moves on
    }
  } else if (n.mode === "aside") {   // stood aside for a walker: keep the facing (re-face only after AVOID.faceHold s, and only
    const fr = n.asideFrom, w = fr && fr.walker;   // if he has moved to another side), then return once the way is clear
    n.faceT = (n.faceT || 0) + dt;
    if (w && w.x != null && n.faceT >= AVOID.faceHold) { const d = faceTo((w.x - n.x) * 960, (w.y - n.y) * 640); if (d !== n.dir && dDist(w.x, w.y, n.x, n.y) > AVOID.asideR) { n.dir = d; n.faceT = 0; } }
    n.t -= dt;
    const busy = fr && walkersNear(n).some(v => pathNear(v, fr.x, fr.y).d < AVOID.asideR + 8 || dDist(v.x, v.y, fr.x, fr.y) < AVOID.asideR + 8);
    const ltNear = fr && G.lt.deck === n.deck && dDist(G.lt.x, G.lt.y, fr.x, fr.y) < AVOID.asideR + 8;
    // pass 10 (3): someone (the Lt) stops on the spot n stepped aside to: after AVOID.asideOverlapS n moves off - back to its
    // own spot if that's free, else another free spot - instead of sharing it until the aside timer runs out (up to 3.2 s)
    const cr = fr && !G.sp.battle && crowded(n); if (!cr) n.crowdT = 0;
    if (!fr) { n.mode = "dwell"; n.t = 1; }
    else if (cr && (n.crowdT = (n.crowdT || 0) + dt) > AVOID.asideOverlapS) {
      n.crowdT = 0; n.asideFrom = null; n.asideAt = G.ship.elapsed; n.escapeT = 1.2;
      if (claimed(n, fr.x, fr.y)) { const s = pickSpot(n.cfg, fr.spot && fr.spot.id, n); goTo(n, resolve(n.deck, s), "dwell", s); } else goTo(n, { x: fr.x, y: fr.y }, "dwell", fr.spot);
    }
    else if (n.t <= 0 && !busy && !ltNear) {   // go back - unless someone has taken the spot meanwhile: then another free spot
      n.asideFrom = null; n.asideAt = G.ship.elapsed;
      if (claimed(n, fr.x, fr.y)) { const s = pickSpot(n.cfg, fr.spot && fr.spot.id, n); goTo(n, resolve(n.deck, s), "dwell", s); } else goTo(n, { x: fr.x, y: fr.y }, "dwell", fr.spot);
    }
  } else {   // dwell at a spot; red alert = back to the post
    const post = n.cfg.spots[0];
    const cr = !G.sp.battle && crowded(n); if (!cr) n.crowdT = 0;
    if (stepAside(n)) { /* making room */ }
    else if (cr && (n.crowdT = (n.crowdT || 0) + dt) > 0.4) { n.crowdT = 0; n.escapeT = 1.2; const s = pickSpot(n.cfg, n.spot.id, n); goTo(n, resolve(n.deck, s), "dwell", s); }
    else if (G.sp.battle && post && n.spot !== post) { goTo(n, resolve(n.deck, post), "dwell", post); }
    else {
      n.action = workAction(n); if (n.spot.face) n.dir = n.spot.face;
      n.t -= dt;
      if (n.t <= 0 && !(G.sp.battle && n.spot === post) && n.cfg.spots.length) { const s = pickSpot(n.cfg, n.spot.id, n); goTo(n, resolve(n.deck, s), "dwell", s); }
    }
  }
  n.swingAmp += clamp((n.moving ? 1 : 0) - n.swingAmp, -dt / 0.16, dt / 0.16);
  walkSettle(n, dt);
}
// visible crew on a deck: roster order (seniors first), capped (T'Ren takes one bridge place)
export function visibleOn(deck) {
  const cap = PROG.roster.maxVisible - (deck === "bridge" ? 1 : 0);
  return CREW_ROSTER.map(s => ambient.find(a => a.slot === s.slot && a.deck === deck)).filter(Boolean).slice(0, cap);
}
export function tickAmbient(dt) { syncRoster(); for (const n of visibleOn(G.lt.deck)) tickOne(n, dt); }
// renderer helpers
export const ambientOnDeck = deck => visibleOn(deck).filter(n => n.x !== null);
export const ltChatPartner = () => ambient.find(n => n.mode === "chat" && n.chatWith === G.lt && n.deck === G.lt.deck) || null;
export const npcOf = idOrSlot => { syncRoster(); return ambient.find(a => a.occId === idOrSlot || a.slot === idOrSlot) || null; };
// debug / screenshots: send someone to a named spot
export function ambientTo(id, spotId) {
  const n = npcOf(id); if (!n) return;
  if (n.x === null) home(n);
  const s = n.cfg.spots.find(p => p.id === spotId) || n.cfg.spots[0];
  goTo(n, resolve(n.deck, s), "dwell", s);
}
