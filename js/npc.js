// Bridge crew on the deck: Captain T'Ren (visual only, never saved; re-homes on load).
// Behaviour: stands beside the Captain's Chair, now and then walks to a console and works it (computer loop),
// then returns. Talks (talk loop, facing them) while the Lt reports at the chair or stands next to her, and
// holds at the chair talking (issuing orders) during battle. Walk/idle use the same rules as the Lt.
import { G } from "./state.js";
import { TREN, DECKS, COLS, ROWS, NODEMAP } from "./data.js";
import { seatArt } from "./art-hooks.js";
import { walkStep, walkSettle, keepPace, pathNear, blockedAhead, AVOID } from "./anim.js";
import { findPath, isWalkable, cellOf, cellCenter } from "./path.js";
import { clamp, dDist } from "./util.js";

const rnd = ([a, b]) => a + Math.random() * (b - a);
export const tren = {
  x: TREN.home.x, y: TREN.home.y, dir: TREN.home.face, mode: "home", spot: TREN.home,
  t: rnd(TREN.homeT), path: null, pathI: 0, walkPhase: 0, swingAmp: 0, moving: false, walkDist: 0,
  action: null, talkTo: null,
};
const faceDir = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
function faceToward(x, y) { tren.dir = faceDir((x - tren.x) * 960, (y - tren.y) * 640); }
function goTo(spot, mode) {
  const p = findPath(TREN.deck, tren.x, tren.y, spot.x, spot.y); tren.detour = false;
  tren.spot = spot; tren.next = mode;
  const pace = tren.mode === "walk" && keepPace(tren);
  tren.path = (p || []).concat([[spot.x, spot.y]]); tren.pathI = 0; tren.mode = "walk"; if (!pace) tren.walkDist = 0;
}
function arrive() {
  const s = tren.spot; tren.detour = false; tren.x = s.x; tren.y = s.y; tren.dir = s.face; tren.path = null;
  tren.mode = tren.next; tren.t = tren.mode === "aside" ? 4 : rnd(tren.mode === "home" ? TREN.homeT : TREN.stationT);
}
// Who she should be talking to right now (null = nobody)
function chatPartner() {
  const L = G.lt;
  if (L.deck !== TREN.deck || L.lift) return null;
  if (L.mode === "use" && L.node === "chair") return L;
  if (!L.moving && L.mode !== "walk" && dDist(L.x, L.y, tren.x, tren.y) < 100) return L;
  return null;
}
// pass-03 N-1: where the Lt is headed on the bridge (end of his path), or null
function ltTarget() {
  const L = G.lt;
  if (L.deck !== TREN.deck || L.lift || L.mode !== "walk" || !L.path || !L.path.length) return null;
  return L.path[L.path.length - 1];
}
// step aside: the nearest walkable spot ~45-70 px from where she stands that is clear of his target
function asideSpot(tx, ty) {
  let best = null;
  for (const [dx, dy] of [[0.06, 0], [-0.06, 0], [0, 0.09], [0, -0.09], [0.06, 0.07], [-0.06, 0.07], [0.06, -0.07], [-0.06, -0.07]]) {
    const x = tren.x + dx, y = tren.y + dy;
    if (!isWalkable(TREN.deck, x, y) || dDist(x, y, tx, ty) < STEP_ASIDE_R + 14) continue;
    const d = dDist(x, y, tren.x, tren.y);
    if (!best || d < best.d) best = { x, y, d };
  }
  return best && { x: best.x, y: best.y, face: faceDir((tx - best.x) * 960, (ty - best.y) * 640), aside: true };
}
// someone stands at (or is walking to) (x, y) on the bridge: the Lt, or visible ambient crew (registered by npc-ambient.js)
export const trenHooks = { standers: () => [] };
function standersNear(x, y, r = 20) {
  const L = G.lt, pts = trenHooks.standers();
  if (L.deck === TREN.deck && !L.lift) { const e = L.mode === "walk" && L.path && L.path.length ? L.path[L.path.length - 1] : [L.x, L.y]; pts.push({ x: e[0], y: e[1] }); }
  return pts.some(p => dDist(p.x, p.y, x, y) < r);
}
const STEP_ASIDE_R = 34;   // design px: his destination this close to her = she makes room
// pass 09 (4): blocked by the Lt standing in her way for AVOID.yieldMaxS, she re-paths around him (A* with the cells
// around him blocked; the route must keep clear of him); with no way round she simply keeps waiting.
// She never walks through him.
// the route never gets closer to him than she already is, nor than DETOUR_CLEAR px (she may squeeze past his shoulder in a
// narrow passage, never through him: the overlap probe counts < 12 px)
const DETOUR_CLEAR = 20;
// pass 10 (4): while she waits on him she is never a statue: after 0.6 s a fidget cycle (a word to him, facing him, then a
// look back the way she is going), and after TREN_REROUTE_S of waiting with no way round she goes somewhere else instead:
// heading for a console -> back to the chair; heading for the chair (he's standing on it) -> a free console; else she keeps
// fidgeting until he moves
const TREN_REROUTE_S = 4.5;
function waitFidget(L) {
  if (tren.waitT < 0.6) return;
  const ph = (tren.waitT - 0.6) % 2.4, wp = tren.path && tren.path[tren.pathI];
  if (ph < 1.1) { tren.action = "talk"; faceToward(L.x, L.y); }   // a word to him (no talkTo: his seated talk rows stay his own)
  else if (wp) faceToward(wp[0], wp[1]);
}
function reroute() {
  tren.destWait = 0;
  const alt = tren.next === "home" ? TREN.stations.filter(st => st !== tren.spot && !standersNear(st.x, st.y))[0] : TREN.home;
  if (!alt || alt === tren.spot || standersNear(alt.x, alt.y)) return false;
  tren.waitT = 0; goTo(alt, alt === TREN.home ? "home" : "station"); return true;
}
function routeClear(path, L) { const d0 = dDist(tren.x, tren.y, L.x, L.y); return pathNear({ x: tren.x, y: tren.y, path, pathI: 0, mode: "walk" }, L.x, L.y, 1e4).d >= Math.min(DETOUR_CLEAR, d0 - 1); }
function detour(L) {
  const end = tren.path[tren.path.length - 1];
  if (dDist(end[0], end[1], L.x, L.y) < AVOID.yieldR + 4) return null;   // he stands on her destination: wait for him to move
  // A* on a copy of the walk grid with the cells around him blocked (her own cell stays open), then put the grid back
  const dk = DECKS[TREN.deck], W0 = dk.walk, W = W0.slice(), mine = cellOf(tren.x, tren.y), R = DETOUR_CLEAR + 2;
  for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
    const [fx, fy] = cellCenter(cx, cy);
    if (dDist(fx, fy, L.x, L.y) < R && !(cx === mine[0] && cy === mine[1])) W[cy * COLS + cx] = 0;
  }
  let p = null;
  try { dk.walk = W; p = findPath(TREN.deck, tren.x, tren.y, end[0], end[1]); } finally { dk.walk = W0; }
  if (!p) return null;
  const path = p.concat([[end[0], end[1]]]).filter((q, i) => i > 0 || dDist(q[0], q[1], tren.x, tren.y) > 8);
  return routeClear(path, L) ? path : null;
}
export function tickTren(dt) {
  const L = G.lt, battle = !!G.sp.battle;
  const tgt = ltTarget();
  if (tgt && tren.mode !== "walk" && dDist(tgt[0], tgt[1], tren.x, tren.y) < STEP_ASIDE_R) {
    const sp = asideSpot(tgt[0], tgt[1]);
    if (sp) { tren.resume = tren.mode === "station" ? tren.spot : TREN.home; goTo(sp, "aside"); }
  } else if (tgt && tren.mode !== "walk" && tren.mode !== "aside" && L.deck === TREN.deck) {   // pass 08: his path runs through her
    const pn = pathNear(L, tren.x, tren.y);
    if (pn.d < AVOID.asideR) { const sp = asideSpot(pn.px, pn.py); if (sp) { tren.resume = tren.mode === "station" ? tren.spot : TREN.home; goTo(sp, "aside"); } }
  }
  const wantHome = battle || (L.deck === TREN.deck && L.mode === "use" && L.node === "chair");
  if (wantHome && (tren.mode === "station" || (tren.mode === "aside" && battle))) goTo(TREN.home, "home");
  if (wantHome && tren.mode === "walk" && tren.spot !== TREN.home) goTo(TREN.home, "home");
  tren.moving = false; tren.action = null; tren.talkTo = null;
  if (tren.mode === "walk") {
    // give way to the Lt when he is right in front of her; after AVOID.yieldMaxS re-path around him, or keep waiting
    const ltHere = L.deck === TREN.deck && !L.lift ? [L] : [];
    // on a detour route (checked clear of him) she only stops if he steps right into her way
    if (tren.detour ? blockedAhead(tren, ltHere, 16) : blockedAhead(tren, ltHere)) {
      tren.yieldT = (tren.yieldT || 0) + dt; tren.waitT = (tren.waitT || 0) + dt;
      waitFidget(L);   // pass 10 (4): never a frozen wait
      if (tren.yieldT >= AVOID.yieldMaxS && !L.moving) {
        const p = detour(L); tren.yieldT = 0;
        if (p) { tren.path = p; tren.pathI = 0; tren.destWait = 0; tren.detour = true; tren.waitT = 0; }
        else if ((tren.destWait = (tren.destWait || 0) + AVOID.yieldMaxS) >= TREN_REROUTE_S) reroute();   // no way round: somewhere else to be
      }
      else if (tren.yieldT >= AVOID.yieldMaxS) { tren.yieldT = 0; if ((tren.destWait = (tren.destWait || 0) + AVOID.yieldMaxS) >= TREN_REROUTE_S) reroute(); }   // he's walking about in her way: hold, then give up on it too
    } else { tren.yieldT = 0; tren.waitT = 0; if (walkStep(tren, "tren", TREN.speed * 960, dt)) arrive(); }
  } else if (tren.mode === "aside") {
    // made room for the Lt: wait (facing him) until he has moved on from her old spot, then go back
    const back = tren.resume || TREN.home, who = chatPartner();
    if (who) { tren.action = "talk"; tren.talkTo = who; faceToward(who.x, who.y); }
    tren.t -= dt;
    const clear = L.deck !== TREN.deck || dDist(L.x, L.y, back.x, back.y) > STEP_ASIDE_R + 20;
    if (tren.t <= 0 && clear && !ltTarget()) { tren.resume = null; goTo(back, back === TREN.home ? "home" : "station"); }
  } else if (tren.mode === "station") {
    tren.action = "computer"; tren.dir = tren.spot.face;
    tren.t -= dt; if (tren.t <= 0) goTo(TREN.home, "home");
  } else {   // home: beside the chair
    const who = chatPartner();
    if (battle) { tren.action = "talk"; tren.dir = TREN.home.face; }
    else if (who) { tren.action = "talk"; tren.talkTo = who; faceToward(who.x, who.y); }
    else {
      tren.dir = TREN.home.face;
      tren.t -= dt;
      if (tren.t <= 0) {   // pass 09 (4): only a console nobody is standing at (or heading for)
        const free = TREN.stations.filter(st => !standersNear(st.x, st.y));
        if (free.length) goTo(free[Math.floor(Math.random() * free.length)], "station"); else tren.t = 3;
      }
    }
  }
  tren.swingAmp += clamp((tren.moving ? 1 : 0) - tren.swingAmp, -dt / 0.16, dt / 0.16);
  walkSettle(tren, dt);
}
// debug / screenshots: put her somewhere specific
export function trenTo(kind, i = 0) {
  if (kind === "home") goTo(TREN.home, "home");
  else goTo(TREN.stations[i % TREN.stations.length], "station");
}
// art batch 2: at home she sits in the first officer's seat (TREN.home.seat) with SEAT_ART.tren, facing the viewscreen;
// she talks from the seat (seated talk rows). Off the spot, walking, stepped aside or the Lt in that seat: standing.
export function trenSeat() {
  const nd = TREN.home.seat && NODEMAP[TREN.home.seat], L = G.lt;
  if (!nd || !nd.seat || tren.mode !== "home" || !seatArt("tren")) return null;
  if (L.deck === TREN.deck && L.node === TREN.home.seat && (L.mode === "use" || L.mode === "walk")) return null;
  return dDist(tren.x, tren.y, TREN.home.x, TREN.home.y) <= 4 ? nd : null;
}
export const trenOnFloor = () => isWalkable(TREN.deck, tren.x, tren.y);
