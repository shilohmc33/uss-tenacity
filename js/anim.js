// Character animation helpers shared by the Lt (crew.js), T'Ren (npc.js) and the ambient crew (npc-ambient.js), drawn by
// render/deck.js. Pass 08 (animation audit 2026-10-18). Runtime-only state lives in a WeakMap, never in the save.
import { dDist, clamp } from "./util.js";

// ---- 1. step distance: design px per step (one half walk cycle, contact to contact), PER CHARACTER and PER DIRECTION,
// measured from the art at the shared draw scale so the planted foot stays put. Keys are the sheet character
// ("lt", "tren", or an ambient sheet such as "crew-gold" / "andorian"); anything missing falls back to default.
// The walk frame advances by distance (walkPhase += moved / step * PI), so a faster walk (level bonus, low energy)
// changes the CADENCE with the speed and the feet never slide.
// Option A (2026-10-18): FIG_H 83. Steps set from tools/foot-slide.js (foot travel per step on the contact frames A / B
// x the draw scale; shots/foot-slide-{before,after}.json): Lt side 173/207 heel-to-heel sheet px x 0.163 = 31.0, down
// 99/105 x 0.1515 = 15.5, up 84/73 x 0.1548 = 12.2; T'Ren (and every crewmate on her body) side 170/227 x 0.1522 = 30.2,
// down (walkfix_v1) 53 x 0.329 = 17.5, up 46 x 0.329 = 15.2. Rounded to the nearest px: drift <= 0.8 design px per step.
export const STEP = {
  default: { side: 30, up: 15, down: 18 },   // crew drawn on T'Ren's body
  lt: { side: 31, up: 13, down: 15 },        // lt_walk_v2 (all 4 directions)
  tren: { side: 30, up: 15, down: 18 },      // tren_walk_v2 side + tren_walkfix_v1 up/down
  // art batch 1 (tools/foot-slide.js on the packed masters, 0.329 design px per cell px): Thelev side 77-79/98-99 -> 29,
  // down 44/49 -> 15.3, up 28/19 -> 7.7; male crew base side 73/105 -> 29.4, down 43/48 -> 15, up 28/22 -> 8.2. The up
  // walk is drawn with a short visible stride, so its no-slide step is short (quicker cadence going up-screen).
  andorian: { side: 29, up: 8, down: 15 },   // Thelev (thelev-v1)
  "crew-male-v1": { side: 29, up: 8, down: 15 },   // male crew tint base
  // art batch 2 (foot-slide on okafor-v2): side 76-77/90 -> 27.4, down 44/45 -> 14.7, up 29/28 -> 9.4
  okafor: { side: 27, up: 9, down: 15 },   // Cmdr Okafor (okafor-v2)
  // suite 20 (foot-slide on crew-female-v1; walkA's trailing foot is on its toes, measured in the 20% band): side 51/96 -> 24.2,
  // down 49/29 -> 12.8, up 35/6 -> 6.8. The Betazoid sheet is the same body (hair-only composite), so it shares these.
  "crew-female-v1": { side: 24, up: 7, down: 13 },   // female crew tint base
  "crew-betazoid-v1": { side: 24, up: 7, down: 13 },   // Betazoid crewwoman (crew_female_v1 body)
  // Bolian: the crew_male_v1 body below the head (bald scalp only), so the male steps. foot-slide down 15 / up 8.2 match; side reads
  // 31 only because the bald head is 3 px shorter, so the 10% foot band misses the trailing toe and the 20% retry measures 82/106.
  "crew-bolian-v1": { side: 29, up: 8, down: 15 },   // Bolian crewman
  // wrap-up species set (foot-slide 'species' run): human m2 = crew_male_v1 body (side reads 30.8/31.1 for the same short-head
  // band artifact as the Bolian; down/up identical to the male base) -> male steps; human f2 and Trill v2 = crew_female_v1 body
  // (all four directions identical to the female base); Vulcan m = T'Ren's rig rescaled to male heights: 30.5 / 14.5 / 9.6.
  "crew-human-m2-v1": { side: 29, up: 8, down: 15 },
  "crew-human-f2-v1": { side: 24, up: 7, down: 13 },
  "crew-trill-v2": { side: 24, up: 7, down: 13 },
  "crew-vulcan-m-v1": { side: 30, up: 10, down: 15 },
};
export function stepLen(who, dir) {
  const s = STEP[who] || STEP.default, d = STEP.default;
  return dir === "up" ? (s.up ?? d.up) : dir === "down" ? (s.down ?? d.down) : (s.side ?? d.side);
}

// ---- hashing / seeded randomness (C3: seed from the whole id, never its length) ----
export function fnv1a(str) {
  let h = 0x811c9dc5; const s = String(str);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// per-character tempo x0.85-1.15 and phase offset 0-10 s, both from the id hash
export const animSeed = id => { const h = fnv1a(id); return { seed: h, tempo: 0.85 + 0.3 * ((h >>> 8) % 1000) / 999, offset: (h % 10000) / 1000 }; };

// ---- 2. action loops: per-action frame timing with holds and random rests (no metronomes) ----
// frames: [min, max] seconds for A, M, B, M (played in that order); rest: after every `every` [min,max] cycles hold
// frame `frame` (0 A, 1 M, 2 B) for `dur` [min,max] seconds. Values from the audit (C2). Tune here.
export const ACTION_TIMING = {
  eat: { frames: [[0.45, 0.55], [0.25, 0.35], [0.9, 1.1], [0.25, 0.35]], rest: { every: [1, 1], dur: [1.5, 3.0], frame: 1 } },
  talk: { frames: [[0.3, 0.7], [0.3, 0.7], [0.3, 0.7], [0.3, 0.7]], rest: { every: [2, 4], dur: [1.0, 2.0], frame: 1 } },
  computer: { frames: [[0.16, 0.30], [0.16, 0.30], [0.16, 0.30], [0.16, 0.30]], rest: { every: [3, 6], dur: [1.0, 3.0], frame: 1 } },
  weld: { frames: [[0.12, 0.18], [0.12, 0.18], [0.12, 0.18], [0.12, 0.18]] },
  kneel: { frames: [[0.2, 0.26], [0.2, 0.26], [0.2, 0.26], [0.2, 0.26]], rest: { every: [3, 5], dur: [0.6, 1.2], frame: 1 } },
  seated: { frames: [[1.4, 2.4], [1.4, 2.4]], order: [0, 1] },   // seated idle breathing A/B (art hook)
  lying: { frames: [[1.2, 1.6], [1.2, 1.6]], order: [0, 1] },    // lying breathing A/B (art hook)
};
const ORDER4 = [0, 1, 2, 1];
const TL = new Map();   // cached timelines: key action|seed -> { ends: Float32Array, frames: Uint8Array, total }
function timeline(action, seed) {
  const key = action + "|" + seed; let tl = TL.get(key); if (tl) return tl;
  const T = ACTION_TIMING[action] || ACTION_TIMING.kneel, rnd = mulberry(seed ^ fnv1a(action)), r = ([a, b]) => a + rnd() * (b - a);
  const order = T.order || ORDER4, ends = [], frames = []; let t = 0, nextRest = T.rest ? Math.round(r(T.rest.every)) : Infinity;
  for (let cyc = 0; cyc < 40; cyc++) {
    order.forEach((fr, i) => { t += r(T.frames[i % T.frames.length]); ends.push(t); frames.push(fr); });
    if (T.rest && --nextRest <= 0) { t += r(T.rest.dur); ends.push(t); frames.push(T.rest.frame); nextRest = Math.round(r(T.rest.every)); }
  }
  tl = { ends: Float32Array.from(ends), frames: Uint8Array.from(frames), total: t };
  if (TL.size > 400) TL.clear();
  TL.set(key, tl); return tl;
}
// frame index (0 A, 1 M, 2 B) of an action loop at time t for a character seeded with animSeed()
export function actionFrame(action, t, as) {
  const tl = timeline(action, as.seed), tt = (((t * as.tempo + as.offset) % tl.total) + tl.total) % tl.total;
  let lo = 0, hi = tl.ends.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (tl.ends[mid] < tt) lo = mid + 1; else hi = mid; }
  return tl.frames[lo];
}

// ---- 5. walking: ease, facing with look-ahead + hysteresis, finish-the-step stop, 180-degree turn hold ----
const RT = new WeakMap();
export const rt = c => { let s = RT.get(c); if (!s) { s = { faceT: 0, turnT: 0, turnDir: null, stopT: 0, lastQ: 1, cad: 0, wasMoving: false }; RT.set(c, s); } return s; };
// Walk feel tunables. ease: speed factor ramps up over `easeUp` px (offset easeOff) and down over the last `easeDown` px,
// floor `easeMin`. Facing comes from a point `lookAhead` px along the path; a perpendicular switch needs the new axis
// `hyst` x the old one for `holdS` s. A 180-degree reversal shows the passing frame side-on for `turnHold` s.
export const WALK = { easeUp: 24, easeOff: 8, easeDown: 32, easeMin: 0.5, lookAhead: 40, hyst: 1.25, holdS: 0.15, turnHold: 0.1, finishStep: true, keepPace: true };
export const walkEase = (remain, walked) => clamp(Math.min(remain / WALK.easeDown, (walked + WALK.easeOff) / WALK.easeUp), WALK.easeMin, 1);
export const faceDir = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
const OPP = { up: "down", down: "up", left: "right", right: "left" };
const AXIS = d => (d === "left" || d === "right" ? "x" : "y");
// point ~ahead px further along the path (design px vector from c)
function lookAhead(c, ahead = WALK.lookAhead) {
  let rx = c.x, ry = c.y, left = ahead, vx = 0, vy = 0;
  for (let i = c.pathI; i < c.path.length && left > 0; i++) {
    const dx = (c.path[i][0] - rx) * 960, dy = (c.path[i][1] - ry) * 640, d = Math.hypot(dx, dy);
    if (d <= 0) continue;
    const k = Math.min(1, left / d); vx += dx * k; vy += dy * k; left -= d * k; rx = c.path[i][0]; ry = c.path[i][1];
  }
  return [vx, vy];
}
function updateFacing(c, dt, started) {
  const s = rt(c), [vx, vy] = lookAhead(c);
  if (!vx && !vy) return;
  const want = faceDir(vx, vy);
  if (want === c.dir) { s.faceT = 0; return; }
  if (started) { c.dir = want; s.faceT = 0; return; }                    // first step of a walk: face the way we go
  if (want === OPP[c.dir]) {                                             // 180: one beat on the passing frame, side-on
    if (WALK.turnHold > 0) { s.turnDir = AXIS(c.dir) === "x" ? "down" : (vx >= 0 ? "right" : "left"); s.turnT = WALK.turnHold; }
    c.dir = want; s.faceT = 0; return;
  }
  const cur = AXIS(c.dir) === "x" ? Math.abs(vx) : Math.abs(vy), nw = AXIS(want) === "x" ? Math.abs(vx) : Math.abs(vy);
  if (nw > cur * WALK.hyst) { s.faceT += dt; if (s.faceT >= WALK.holdS) { c.dir = want; s.faceT = 0; } } else s.faceT = 0;
}
// Move walker c along c.path at `speed` design px/s for dt. Returns true when the end of the path was reached.
// Sets c.moving, advances c.walkPhase by distance / stepLen(who, dir) (cadence follows speed), c.walkDist.
export function walkStep(c, who, speed, dt) {
  const s = rt(c), started = !s.wasMoving && !(c.walkDist > 0);
  let remain = 0, rx = c.x, ry = c.y;
  for (let i = c.pathI; i < c.path.length; i++) { remain += dDist(c.path[i][0], c.path[i][1], rx, ry); rx = c.path[i][0]; ry = c.path[i][1]; }
  const px = c.x, py = c.y; let budget = speed * walkEase(remain, c.walkDist || 0) * dt, done = false, guard = 0;
  c.moving = false;
  updateFacing(c, dt, started);
  while (c.pathI < c.path.length && budget > 1e-6 && guard++ < 12) {
    const wp = c.path[c.pathI], dxp = (wp[0] - c.x) * 960, dyp = (wp[1] - c.y) * 640, dist = Math.hypot(dxp, dyp);
    if (dist <= budget || dist < 0.5) { c.x = wp[0]; c.y = wp[1]; c.pathI++; budget -= dist; c.moving = true; continue; }
    c.x += (dxp / dist) * budget / 960; c.y += (dyp / dist) * budget / 640; budget = 0; c.moving = true;
  }
  if (c.pathI >= c.path.length) done = true;
  const moved = dDist(c.x, c.y, px, py);
  if (moved > 0) { c.walkPhase = (c.walkPhase || 0) + moved / stepLen(who, c.dir) * Math.PI; c.walkDist = (c.walkDist || 0) + moved; s.cad = moved / dt / stepLen(who, c.dir) * 2; }
  if (done) c.moving = false;
  return done;
}
// end-of-tick bookkeeping for every walker (moving or not): turn hold, finish-the-step on stop (C10, C13)
export function walkSettle(c, dt) {
  const s = rt(c), q = Math.floor((c.walkPhase || 0) / (Math.PI / 2)) % 4;
  if (s.turnT > 0) s.turnT -= dt;
  if (c.moving) { s.lastQ = q; s.stopT = 0; }
  else if (WALK.finishStep && s.wasMoving && (s.lastQ === 0 || s.lastQ === 2)) s.stopT = Math.min(0.12, s.cad > 0 ? 1 / s.cad : 0.12);   // hold the stride, then M
  else if (s.stopT > 0) s.stopT -= dt;
  s.wasMoving = c.moving;
}
// what the deck should draw for a walker: { frame: "stride", q } | { frame: "idle", dir }
export function walkPose(c) {
  const s = rt(c);
  if (s.turnT > 0) return { idle: true, dir: s.turnDir || c.dir };
  if (c.moving) return { idle: false, q: Math.floor((c.walkPhase || 0) / (Math.PI / 2)) % 4 };
  if (s.stopT > 0) return { idle: false, q: s.lastQ };
  return { idle: true, dir: c.dir };
}
// re-route without losing speed: a new order mid-walk keeps walkDist (C9: re-tap no longer drops to the floor speed)
export const keepPace = c => WALK.keepPace !== false && !!(c.moving || rt(c).wasMoving);

// ---- 6. avoidance (audit C5): walkers yield, standers step aside, nobody walks through anybody ----
// pass 09 (3): standing crew only step aside for a walker who is about to reach them: its path's closest approach is
// under asideR within the next asideLook px (was the whole 150 px lookPath, so paths far ahead set off shuffles), at
// most once per asideCool s per crewmate unless the walker would walk straight into them (< asideHard px); once aside
// they face the walker once and hold that facing (faceHold s) instead of re-facing every frame.
export const AVOID = { yieldR: 26, yieldMaxS: 1.5, asideR: 24, asideStep: 32, lookPath: 150, asideLook: 60, asideCool: 5, asideHard: 12, faceHold: 1.2, standR: 20, asideOverlapS: 0.4 };   // pass 10 (3): asideOverlapS = longest a crewmate who stepped aside shares the spot with someone standing on it
// closest approach of the walker w's remaining path (next `ahead` px) to the point (x, y): { d, px, py } in design px
export function pathNear(w, x, y, ahead = AVOID.lookPath) {
  let best = { d: dDist(w.x, w.y, x, y), px: w.x, py: w.y };
  if (!w.path || w.mode !== "walk") return best;
  let ax = w.x, ay = w.y, left = ahead;
  for (let i = w.pathI; i < w.path.length && left > 0; i++) {
    const bx = w.path[i][0], by = w.path[i][1], sx = (bx - ax) * 960, sy = (by - ay) * 640, L2 = sx * sx + sy * sy, len = Math.sqrt(L2);
    if (len > 0) {
      const k = clamp((((x - ax) * 960) * sx + ((y - ay) * 640) * sy) / L2, 0, Math.min(1, left / len));
      const qx = ax + (bx - ax) * k, qy = ay + (by - ay) * k, d = dDist(qx, qy, x, y);
      if (d < best.d) best = { d, px: qx, py: qy };
    }
    left -= len; ax = bx; ay = by;
  }
  return best;
}
// is somebody in `others` ({x, y}) within r px and ahead of walker c (towards its next waypoint)?
export function blockedAhead(c, others, r = AVOID.yieldR) {
  if (!c.path || c.pathI >= c.path.length) return false;
  const wp = c.path[c.pathI], mx = (wp[0] - c.x) * 960, my = (wp[1] - c.y) * 640, ml = Math.hypot(mx, my) || 1;
  return others.some(o => { const ox = (o.x - c.x) * 960, oy = (o.y - c.y) * 640, d = Math.hypot(ox, oy); return d > 0.01 && d < r && (ox * mx + oy * my) / ml > d * 0.3; });
}
