// Ambient crew NPCs: one per occupied CREW_ROSTER slot (js/roster.js), except T'Ren (js/npc.js draws her). Visual
// only: runtime state lives here, is never saved and is not simulated offline. Only the Lt's current deck is ticked and
// drawn, at most PROG.roster.maxVisible per deck (T'Ren counts on the bridge). Persisted bits: chat-line / perk stamps
// in G.npc[occupantId] (ship-elapsed seconds). The roster itself (who is aboard) lives in G.prog.crew (crewlife.js).
// Behaviour: drift between the slot's spots (A* on the deck walk mask), dwell playing the spot's action; hold the post
// (first spot) during red alert. Social: when the Lt uses one of the slot's chat nodes nearby, one crew member at a time
// comes over and both play "talk" (PROG.roster cooldowns). A newcomer (intro pending) crosses the deck to introduce
// themself the first time the Lt is on their deck. Slot "mess-regular-1" keeps Thelev's hand-made config (AMBIENT_NPCS).
import { G } from "./state.js";
import { AMBIENT_NPCS, NODEMAP, STEP_LEN, CHAR_SHEETS, DECKS } from "./data.js";
import { CREW_ROSTER, SLOTMAP, SPECIES, DEPTS, TAGS, prFill } from "./roster.js";
import { findPath, isWalkable, nearestWalkable, cellCenter } from "./path.js";
import { clamp, dDist } from "./util.js";
import { log, fx, hushed } from "./bus.js";
import { PROG, chatXP, addr, fullName } from "./progression.js";
import { introDone } from "./crewlife.js";

const rnd = ([a, b]) => a + Math.random() * (b - a);
const faceDir = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
const CUSTOM = Object.fromEntries(AMBIENT_NPCS.map(c => [c.id, c]));
const NEAR = [{ dx: 0.075, dy: 0 }, { dx: -0.075, dy: 0 }, { dx: 0, dy: 0.11 }, { dx: 0, dy: -0.1 }];
// resolve a config spot (absolute or node-relative) and snap it onto the walk mask; snap = px it had to move
function resolve(deck, s) {
  let x = s.x, y = s.y;
  if (s.near && NODEMAP[s.near]) { x = NODEMAP[s.near].x + (s.dx || 0); y = NODEMAP[s.near].y + (s.dy || 0); }
  const x0 = x, y0 = y;
  if (!isWalkable(deck, x, y)) [x, y] = cellCenter(...nearestWalkable(deck, x, y));
  return { x, y, snap: dDist(x, y, x0, y0) };
}
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
function pickSpot(cfg, notId) {
  const busy = new Set(ambient.filter(a => a.deck === cfg.deck && a.spot).map(a => a.spot.id));   // spread out: avoid spots others hold
  let pool = cfg.spots.filter(s => s.id !== notId && !busy.has(s.id)); if (!pool.length) pool = cfg.spots.filter(s => s.id !== notId);
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
  return { id: o.id, deck: sl.deck, speed: R.speed, seed: (o.id.length * 1.7) % 6, spots: sl.spots, name: fullName(o), short: o.short, pronoun: o.pronoun,
    social: { nodes, maxSnap: 28, joinRange: R.joinRange, chatRange: 150, chatDur: [12, 20], lingerT: [3, 6], lineCooldown: 0, lines: linesFor(o) } };
}
export const ambient = [];
let syncV = -1, syncC = null;
const ORDER = ["mess-regular-1", ...CREW_ROSTER.map(s => s.slot).filter(s => s !== "mess-regular-1")];   // Thelev's slot first (tools use ambient[0])
function makeNpc(sl, o, atLift) {
  const cfg = cfgFor(sl, o), s0 = (cfg.start && cfg.spots.find(s => s.id === cfg.start)) || cfg.spots[0] || { id: "lift", x: DECKS[sl.deck].lift.x, y: DECKS[sl.deck].lift.y, t: [5, 10] };
  const n = { slot: sl.slot, occId: o.id, cfg, who: sheetFor(o, sl), seed: cfg.seed || 0, deck: sl.deck, x: null, y: null, dir: s0.face || "down",
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
    else { n.cfg = cfgFor(sl, o); n.who = sheetFor(o, sl); }
    keep.push(n);
  }
  ambient.length = 0; ambient.push(...keep);
}
function home(n) { const p = resolve(n.deck, n.spot); n.x = p.x; n.y = p.y; }
function goTo(n, target, mode, spot = null) {
  const p = findPath(n.deck, n.x, n.y, target.x, target.y);
  n.path = (p || []).concat([[target.x, target.y]]); n.pathI = 0; n.mode = "walk"; n.walkDist = 0; n.next = mode; n.target = target;
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
  if (hushed()) return;   // pass 06 m1: the ship goes quiet for a while after a death
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
    const px = n.x, py = n.y;
    let remain = 0, rx = n.x, ry = n.y;
    for (let i = n.pathI; i < n.path.length; i++) { remain += dDist(n.path[i][0], n.path[i][1], rx, ry); rx = n.path[i][0]; ry = n.path[i][1]; }
    const sf = clamp(Math.min(remain, n.walkDist + 12) / 80, 0.22, 1);
    let guard = 0;
    while (n.pathI < n.path.length && guard++ < 8) {
      const wp = n.path[n.pathI], dxp = (wp[0] - n.x) * 960, dyp = (wp[1] - n.y) * 640, dist = Math.hypot(dxp, dyp);
      const step = n.cfg.speed * sf * 960 * dt;
      if (dist <= Math.max(step, 2)) { n.x = wp[0]; n.y = wp[1]; n.pathI++; continue; }
      n.x += (dxp / dist) * step / 960; n.y += (dyp / dist) * step / 640;
      n.dir = faceDir(dxp, dyp); n.moving = true;
      break;
    }
    const moved = dDist(n.x, n.y, px, py);
    if (moved > 0) { n.walkPhase += moved / STEP_LEN * Math.PI; n.walkDist += moved; }
    if (n.pathI >= n.path.length) {
      n.path = null;
      if (n.next === "intro") { if (L.deck === n.deck && !L.lift && dDist(n.x, n.y, L.x, L.y) <= 160) startChat(n, "intro"); else { n.mode = "dwell"; n.t = 1; n.spot = { id: "linger", face: n.dir, action: null }; } }
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
  } else {   // dwell at a spot; red alert = back to the post
    const post = n.cfg.spots[0];
    if (G.sp.battle && post && n.spot !== post) { goTo(n, resolve(n.deck, post), "dwell", post); }
    else {
      n.action = n.spot.action || null; if (n.spot.face) n.dir = n.spot.face;
      n.t -= dt;
      if (n.t <= 0 && !(G.sp.battle && n.spot === post) && n.cfg.spots.length) { const s = pickSpot(n.cfg, n.spot.id); goTo(n, resolve(n.deck, s), "dwell", s); }
    }
  }
  n.swingAmp += clamp((n.moving ? 1 : 0) - n.swingAmp, -dt / 0.16, dt / 0.16);
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
