// Bridge crew on the deck: Captain T'Ren (visual only, never saved; re-homes on load).
// Behaviour: stands beside the Captain's Chair, now and then walks to a console and works it (computer loop),
// then returns. Talks (talk loop, facing them) while the Lt reports at the chair or stands next to her, and
// holds at the chair talking (issuing orders) during battle. Walk/idle use the same rules as the Lt.
import { G } from "./state.js";
import { TREN, STEP_LEN } from "./data.js";
import { findPath, isWalkable } from "./path.js";
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
  const p = findPath(TREN.deck, tren.x, tren.y, spot.x, spot.y);
  tren.spot = spot; tren.next = mode;
  tren.path = (p || []).concat([[spot.x, spot.y]]); tren.pathI = 0; tren.mode = "walk"; tren.walkDist = 0;
}
function arrive() {
  const s = tren.spot; tren.x = s.x; tren.y = s.y; tren.dir = s.face; tren.path = null;
  tren.mode = tren.next; tren.t = rnd(tren.mode === "home" ? TREN.homeT : TREN.stationT);
}
// Who she should be talking to right now (null = nobody)
function chatPartner() {
  const L = G.lt;
  if (L.deck !== TREN.deck || L.lift) return null;
  if (L.mode === "use" && L.node === "chair") return L;
  if (!L.moving && L.mode !== "walk" && dDist(L.x, L.y, tren.x, tren.y) < 100) return L;
  return null;
}
export function tickTren(dt) {
  const L = G.lt, battle = !!G.sp.battle;
  const wantHome = battle || (L.deck === TREN.deck && L.mode === "use" && L.node === "chair");
  if (wantHome && tren.mode === "station") goTo(TREN.home, "home");
  if (wantHome && tren.mode === "walk" && tren.spot !== TREN.home) goTo(TREN.home, "home");
  tren.moving = false; tren.action = null; tren.talkTo = null;
  if (tren.mode === "walk") {
    const px = tren.x, py = tren.y;
    let remain = 0, rx = tren.x, ry = tren.y;
    for (let i = tren.pathI; i < tren.path.length; i++) { remain += dDist(tren.path[i][0], tren.path[i][1], rx, ry); rx = tren.path[i][0]; ry = tren.path[i][1]; }
    const sf = clamp(Math.min(remain, tren.walkDist + 12) / 80, 0.22, 1);
    let guard = 0;
    while (tren.pathI < tren.path.length && guard++ < 8) {
      const wp = tren.path[tren.pathI], dxp = (wp[0] - tren.x) * 960, dyp = (wp[1] - tren.y) * 640, dist = Math.hypot(dxp, dyp);
      const step = TREN.speed * sf * 960 * dt;
      if (dist <= Math.max(step, 2)) { tren.x = wp[0]; tren.y = wp[1]; tren.pathI++; continue; }
      tren.x += (dxp / dist) * step / 960; tren.y += (dyp / dist) * step / 640;
      tren.dir = faceDir(dxp, dyp); tren.moving = true;
      break;
    }
    if (tren.pathI >= tren.path.length) arrive();
    const moved = dDist(tren.x, tren.y, px, py);
    if (moved > 0) { tren.walkPhase += moved / STEP_LEN * Math.PI; tren.walkDist += moved; }
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
      if (tren.t <= 0) goTo(TREN.stations[Math.floor(Math.random() * TREN.stations.length)], "station");
    }
  }
  tren.swingAmp += clamp((tren.moving ? 1 : 0) - tren.swingAmp, -dt / 0.16, dt / 0.16);
}
// debug / screenshots: put her somewhere specific
export function trenTo(kind, i = 0) {
  if (kind === "home") goTo(TREN.home, "home");
  else goTo(TREN.stations[i % TREN.stations.length], "station");
}
export const trenOnFloor = () => isWalkable(TREN.deck, tren.x, tren.y);
