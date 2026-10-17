// Deck renderer: plate + camera (follow, pinch/wheel zoom, drag pan), Lt sprites, rings, fx, turbolift overlay.
import { G } from "../state.js";
import { DECKS, NODEMAP, SYSTEMS, DW, DH, COLS, ROWS, CREW_FRAMES, FIG_H, LIE_LEN, CHAR_SCALE, LT2_LOOP, LT2_IDLE, CHAR_FRAMES, charFrame, DECK_LIGHT } from "../data.js";
import { tren } from "../npc.js";
import { IMG } from "../assets.js";
import { clamp, dDist } from "../util.js";
import { ZONE, LIFT_T } from "../crew.js";
import { TORP_BUILD_T } from "../crew.js";

// debug overlay (?debug=1: "Walk grid" button, or ?debug=1&walk=1)
export const DBG = { walk: /[?&]walk=1/.test(location.search) && /[?&]debug=1/.test(location.search), light: true };   // light:false = no crew tint (screenshots)
const PAN_HOLD = 10;   // BUG-18: a manual pan/zoom holds this long (or until the next order) before easing back to the Lt
const K = CHAR_SCALE;   // characters (and their shadows, labels, rings) are drawn at 2x
export const cam = { x: 0.45 * DW, y: 0.62 * DH, zoom: 2.2, scale: 1, fit: 1, w: 0, h: 0, manualT: 0, snap: true };
const fxl = { sparks: [], floaters: [], pulses: [] };
export function deckFx(kind, d) {
  if (kind === "spark") for (let i = 0; i < 2; i++) fxl.sparks.push({ x: d.x * DW, y: d.y * DH, vx: (Math.random() - 0.5) * 90, vy: -Math.random() * 80, t: 0, life: 0.4 + Math.random() * 0.3 });
  if (kind === "floater") fxl.floaters.push({ x: d.x * DW, y: d.y * DH, text: d.text, color: d.color, t: -(d.delay || 0), life: d.life || 1.4 });
  if (kind === "pulse") fxl.pulses.push({ x: d.x * DW, y: d.y * DH, t: 0 });
  if (kind === "deckChanged") { fxl.sparks.length = 0; fxl.floaters.length = 0; cam.snap = true; cam.manualT = 0; }
  if (kind === "recenter") cam.manualT = 0;
}
export function resizeCam(w, h) {
  cam.w = w; cam.h = h;
  cam.fit = Math.min(w / DW, h / DH);
  // never zoom out past "plate covers the stage" (no black letterbox bars in portrait)
  // (BUG-18: portrait may pinch out a little past "cover" to see more width; the margin is filled with the plate's edge colour)
  const cover = Math.max(w / DW, h / DH) / cam.fit;
  cam.minZoom = Math.max(1, h > w ? cover * 0.85 : cover);
  // the mode's default framing never starts below "cover" (no margins unless the player pinches out)
  if (cam.prefZoom != null) cam.zoom = Math.max(cam.prefZoom, Math.max(1, cover));
  cam.zoom = clamp(cam.zoom, cam.minZoom, 4.5);
  cam.scale = cam.fit * cam.zoom;
}
export function setZoom(z, ax, ay) {
  const old = cam.scale;
  cam.prefZoom = null;   // the player has taken the zoom
  cam.zoom = clamp(z, cam.minZoom || 1, 4.5);
  cam.scale = cam.fit * cam.zoom;
  if (ax !== undefined) { // keep anchor point fixed
    const wx = cam.x + (ax - cam.w / 2) / old, wy = cam.y + (ay - cam.h / 2) / old;
    cam.x = wx - (ax - cam.w / 2) / cam.scale; cam.y = wy - (ay - cam.h / 2) / cam.scale;
    cam.manualT = PAN_HOLD;
  }
}
export function screenToDeck(sx, sy) { return [(cam.x + (sx - cam.w / 2) / cam.scale) / DW, (cam.y + (sy - cam.h / 2) / cam.scale) / DH]; }
export function panBy(dx, dy) { cam.x -= dx / cam.scale; cam.y -= dy / cam.scale; cam.manualT = PAN_HOLD; }
// NEW-03: the camera may scroll past the plate edge far enough to keep the whole Lt in view (head above the top
// edge at the Bridge lift, feet near the bottom). The margin is painted with the plate's edge colour (drawEdges).
const HEAD_PAD = 10, FEET_PAD = 8;
function ltBox() {
  const L = G.lt, nd = L.mode === "use" && L.node && NODEMAP[L.node];
  if (nd && nd.lie) return null;
  return { top: L.y * DH - FIG_H - HEAD_PAD, bottom: L.y * DH + FEET_PAD };
}
function clampCam() {
  const hw = cam.w / 2 / cam.scale, hh = cam.h / 2 / cam.scale, b = ltBox();
  cam.x = hw * 2 >= DW ? DW / 2 : clamp(cam.x, hw, DW - hw);
  if (hh * 2 >= DH) { cam.y = DH / 2; if (b && b.top < cam.y - hh) cam.y = b.top + hh; return; }
  let lo = hh, hi = DH - hh;
  if (b && cam.manualT <= 0) { lo = Math.min(lo, b.top + hh); hi = Math.max(hi, b.bottom - hh); }
  cam.y = clamp(cam.y, lo, hi);
}
// where the Lt stands on screen (0 = top of the stage, 1 = bottom); the HUD keeps toasts on the other half (BUG-08)
export function ltScreenFrac() {
  const L = G.lt; if (!cam.h) return 0.5;
  return clamp((cam.h / 2 + (L.y * DH - FIG_H * 0.5 - cam.y) * cam.scale) / cam.h, 0, 1);
}
export function updateCam(dt) {
  const L = G.lt;
  let tx = L.x * DW, ty = L.y * DH - FIG_H * 0.45;
  const nd = L.mode === "use" && L.node && NODEMAP[L.node];
  if (nd && nd.lie) { tx = nd.lie[0] * DW; ty = nd.lie[1] * DH; }
  if (cam.manualT > 0) cam.manualT -= dt;
  else if (cam.snap) { cam.x = tx; cam.y = ty; }
  else { const k = 1 - Math.exp(-dt * 5); cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; }
  cam.snap = false;
  clampCam();
}
// hit test: returns {kind, id} in design space with ~68 screen-px zones
export function hitTest(fx, fy) {
  const L = G.lt, dk = DECKS[L.deck], r = Math.max(ZONE, 34 / cam.scale);
  const cands = [];
  const act = G.sp.ev.active;
  if (act && act.task && act.task.deck === L.deck) cands.push({ kind: "use", id: act.task.node, x: act.task.x, y: act.task.y });
  for (const [k, f] of Object.entries(G.ship.faults)) { const s = SYSTEMS[k]; if (s.deck === L.deck) { cands.push({ kind: "repair", id: k, x: s.mx, y: s.my }); cands.push({ kind: "repair", id: k, x: s.x, y: s.y }); } }
  for (const [id, n] of Object.entries(dk.nodes)) { cands.push({ kind: "use", id, x: n.x, y: n.y }); cands.push({ kind: "use", id, x: n.mx, y: n.my }); }
  cands.push({ kind: "lift", x: dk.lift.x, y: dk.lift.y }, { kind: "lift", x: dk.lift.mx, y: dk.lift.my });
  let best = null, bd = Infinity;
  for (const c of cands) { const d = dDist(fx, fy, c.x, c.y); if (d < r && d < bd - 4) { bd = d; best = c; } }
  return best;
}

// ---------- drawing ----------
function drawFrame(ctx, img, f, px, py, s) { ctx.drawImage(img, f.x, f.y, f.w, f.h, px - f.ax * s, py - f.ay * s, f.w * s, f.h * s); }
// Which Lt action loop is playing right now; null = standing / walking (walk sheet).
function ltAction(L, nd) {
  if (L.mode === "repair") { const sy = SYSTEMS[L.repairSys]; return (sy && sy.repairPose) || "weld"; }
  if (L.mode === "use" && nd) {
    if (L.node === "mess") return "eat";
    if (L.node === "bar") return "talk";
    if (!nd.rest) return "computer";
  }
  return null;
}
const charReady = (who, action) => { const F = CHAR_FRAMES[who]; return !!(F && F[action] && IMG[F[action].down[0].img]); };
// Crew sprites take the room's light (DECK_LIGHT): the frame is composed on a scratch canvas, multiplied by the deck
// tint at strength a, its alpha restored, then drawn. One scratch canvas, reused (no per-frame caches).
let scratch = null;
export function tintedFrame(img, f) {   // exported for tools/pt02-tint-check.js
  const lt = DBG.light && DECK_LIGHT[G.lt.deck];
  if (!lt || !lt.a) return null;
  if (!scratch) scratch = document.createElement("canvas");
  if (scratch.width < f.w || scratch.height < f.h) { scratch.width = Math.max(scratch.width, f.w); scratch.height = Math.max(scratch.height, f.h); }
  const c = scratch.getContext("2d"), [r, g, b] = lt.tint.split(",").map(Number), a = lt.a;
  c.globalCompositeOperation = "source-over"; c.clearRect(0, 0, f.w, f.h);
  c.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  c.globalCompositeOperation = "multiply";
  c.fillStyle = `rgb(${Math.round(255 - (255 - r) * a)},${Math.round(255 - (255 - g) * a)},${Math.round(255 - (255 - b) * a)})`;
  c.fillRect(0, 0, f.w, f.h);
  c.globalCompositeOperation = "destination-in"; c.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  c.globalCompositeOperation = "source-over";
  return scratch;
}
function drawFrameLit(ctx, img, f, px, py, s) {
  const t = tintedFrame(img, f);
  if (!t) return drawFrame(ctx, img, f, px, py, s);
  ctx.drawImage(t, 0, 0, f.w, f.h, px - f.ax * s, py - f.ay * s, f.w * s, f.h * s);
}
function drawChar2(ctx, f, x, y) { drawFrameLit(ctx, IMG[f.img], f, x, y, FIG_H / f.refH); }
// A standing/walking/working character from a v3-format sheet. c = {x, y, dir, moving, swingAmp, walkPhase};
// act = action loop name (computer/talk/eat/weld/kneel) or null for walk/idle.
function drawWalker(ctx, who, c, act, t, seed = 0) {
  const px = c.x * DW, py = c.y * DH;
  ctx.fillStyle = "rgba(20,10,0,0.38)"; ctx.beginPath(); ctx.ellipse(px, py - 1, 13 * K, 4.2 * K, 0, 0, 6.29); ctx.fill();
  if (!charReady(who, "walk")) { ctx.fillStyle = "#c9a14a"; ctx.fillRect(px - 8 * K, py - FIG_H, 16 * K, FIG_H); return; }   // art missing
  const F = CHAR_FRAMES[who];
  // action loops (weld/kneel, computer, eat, talk): A, M, B, M on a timer. No seated poses.
  if (act && charReady(who, act)) { drawChar2(ctx, charFrame(who, act, c.dir, t + seed), px, py); return; }
  // walk: frame advance tied to distance (walkPhase += moved/STEP_LEN*PI) so feet don't skate;
  // one quadrant (PI/2) per frame -> A, M, B, M = two steps per cycle. Idle = walk M + breathing.
  const idle = !c.moving, striding = !idle && c.swingAmp >= 0.35;
  const q = Math.floor(c.walkPhase / (Math.PI / 2)) % 4;
  const bob = -Math.abs(Math.cos(c.walkPhase)) * 1.2 * K * c.swingAmp;
  const tt = t + seed, breath = idle ? Math.sin(tt * 1.7) * 0.7 * K : 0, sway = idle ? Math.sin(tt * 0.45) * 0.8 * K : 0;
  const f = striding ? F.walk[c.dir][LT2_LOOP[q]] : F[LT2_IDLE[0]][c.dir][LT2_IDLE[1]];
  drawChar2(ctx, f, px + sway, py + bob + breath);
}
function drawLt(ctx, t) {
  const L = G.lt, nd = L.mode === "use" && L.node ? NODEMAP[L.node] : null;
  if (nd && nd.lie && IMG["crew-atlas"]) {   // lying pose: legacy crew-atlas frame (no v3 equivalent)
    const len = Math.min(LIE_LEN, nd.lieLen || LIE_LEN);   // 2x, clamped to the bed painted in the plate
    const f = CREW_FRAMES.lying, s = len / f.refH;
    ctx.save(); ctx.translate(nd.lie[0] * DW, nd.lie[1] * DH); ctx.rotate(nd.lieRot || 0);
    ctx.fillStyle = "rgba(20,10,0,0.3)"; ctx.beginPath(); ctx.ellipse(0, 2, len * 0.17, len * 0.52, 0, 0, 6.29); ctx.fill();
    const b = 1 + Math.sin(t * 1.5) * 0.006; ctx.scale(b, b);
    drawFrameLit(ctx, IMG["crew-atlas"], f, 0, 0, s); ctx.restore();
    zzz(ctx, nd.lie[0] * DW + 12 * K, nd.lie[1] * DH - 20 * K, t);
    return;
  }
  drawWalker(ctx, "lt", L, ltAction(L, nd), t);
}
// Captain T'Ren (bridge only; js/npc.js drives her)
function drawTren(ctx, t) { drawWalker(ctx, "tren", tren, tren.action, t, 1.3); }
function zzz(ctx, x, y, t) { ctx.fillStyle = "rgba(200,220,255,0.8)"; ctx.font = `bold ${11 * K}px Antonio, sans-serif`; for (let i = 0; i < 3; i++) { const p = (t * 0.5 + i / 3) % 1; ctx.globalAlpha = 1 - p; ctx.fillText("z", x + p * 10 * K, y - p * 26 * K); } ctx.globalAlpha = 1; }
function speech(ctx, x, y, t) { if ((t % 6) > 3.5) return; ctx.fillStyle = "rgba(255,240,210,0.92)"; rr(ctx, x, y, 26, 14, 6); ctx.fill(); ctx.fillStyle = "#333"; const n = 1 + Math.floor(t * 3) % 3; ctx.fillText("•".repeat(n), x + 6, y + 11); }
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
function ring(ctx, x, y, rx, frac, col, lw = 2.5) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.34);
  ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = lw * 2.4; ctx.beginPath(); ctx.arc(0, 0, rx, 0, 6.283); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = lw * 2.4; ctx.beginPath(); ctx.arc(0, 0, rx, -Math.PI / 2, -Math.PI / 2 + 6.283 * clamp(frac, 0, 1)); ctx.stroke();
  ctx.restore();
}
function marker(ctx, x, y, sev, t) {
  const col = sev === "crit" ? "#ff5147" : sev === "med" ? "#ffb03a" : "#a8c8ee";
  const p = 0.5 + 0.5 * Math.sin(t * (sev === "crit" ? 7 : 3.2));
  const g = ctx.createRadialGradient(x, y, 2, x, y, 30); g.addColorStop(0, col + "aa"); g.addColorStop(1, col + "00");
  ctx.fillStyle = g; ctx.globalAlpha = 0.5 + 0.5 * p; ctx.beginPath(); ctx.arc(x, y, 30, 0, 6.29); ctx.fill(); ctx.globalAlpha = 1;
  const yy = y - 4 - p * 3;
  ctx.fillStyle = col; ctx.strokeStyle = "#1a0d00"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, yy - 12); ctx.lineTo(x + 11, yy + 7); ctx.lineTo(x - 11, yy + 7); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#1a0d00"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.fillText("!", x, yy + 5); ctx.textAlign = "left";
}
function lighting(ctx, t) {
  const S = G.ship, dk = DECKS[G.lt.deck], gl = dk.glow;
  if (gl) {
    const unstable = !!S.faults.warpcore && G.lt.deck === "engineering";
    const pulse = 0.5 + 0.5 * Math.sin(t * (unstable ? 7 : 2.2)), col = unstable ? "255,110,80" : gl[2];
    const g = ctx.createRadialGradient(gl[0] * DW, gl[1] * DH, 0, gl[0] * DW, gl[1] * DH, 220);
    g.addColorStop(0, `rgba(${col},${0.10 + 0.08 * pulse})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g; ctx.fillRect(0, 0, DW, DH); ctx.globalCompositeOperation = "source-over";
  }
  if (S.power < 20) { ctx.fillStyle = `rgba(0,0,10,${(20 - S.power) / 20 * 0.42})`; ctx.fillRect(0, 0, DW, DH); }
}
export function drawDeck(ctx, t, dt) {
  const L = G.lt, dk = DECKS[L.deck];
  updateCam(dt);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#05070d"; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const dpr = ctx.canvas.width / cam.w;
  ctx.setTransform(cam.scale * dpr, 0, 0, cam.scale * dpr, (cam.w / 2 - cam.x * cam.scale) * dpr, (cam.h / 2 - cam.y * cam.scale) * dpr);
  const plate = IMG[dk.plate];
  if (plate) { drawEdges(ctx, plate, dk); ctx.drawImage(plate, 0, 0, DW, DH); } else { ctx.fillStyle = "#1b2233"; ctx.fillRect(0, 0, DW, DH); ctx.fillStyle = "#8af"; ctx.fillText(dk.name + " (plate missing)", 20, 30); }
  // node rings
  for (const [id, n] of Object.entries(dk.nodes)) {
    const active = L.mode === "use" && L.node === id;
    if (active && id === "torpbay") ring(ctx, n.x * DW, n.y * DH, 15 * K, G.ship.charge / 100, "#ffb36b");
    else ring(ctx, n.x * DW, n.y * DH, 15 * K, active ? 1 : 0, active ? "#7fe0ff" : "rgba(160,200,255,0.4)", active ? 2.5 : 1.5);
  }
  // lift glow
  const lf = dk.lift, near = dDist(L.x, L.y, lf.x, lf.y) < ZONE * 1.6;
  const lg = ctx.createRadialGradient(lf.mx * DW, lf.my * DH, 0, lf.mx * DW, lf.my * DH, 40);
  lg.addColorStop(0, `rgba(255,170,60,${near ? 0.45 : 0.18 + 0.08 * Math.sin(t * 2)})`); lg.addColorStop(1, "rgba(255,170,60,0)");
  ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(lf.mx * DW, lf.my * DH, 40, 0, 6.29); ctx.fill();
  ctx.fillStyle = "rgba(255,200,120,0.9)"; ctx.font = "600 10px Antonio, sans-serif"; ctx.textAlign = "center"; ctx.fillText("TURBOLIFT", lf.mx * DW, lf.my * DH - 22); ctx.textAlign = "left";
  // in-range rings under the fault work spots (the "!" markers are drawn after lighting, below)
  for (const [k] of Object.entries(G.ship.faults)) {
    const s = SYSTEMS[k]; if (s.deck !== L.deck) continue;
    if (dDist(L.x, L.y, s.x, s.y) <= ZONE * 2) ring(ctx, s.x * DW, s.y * DH, 20 * K, 0.5 + 0.5 * Math.sin(t * 3.2), "rgba(255,180,90,0.8)", 1.5);
  }
  // event task ring with countdown
  const act = G.sp.ev.active;
  if (act && act.task && act.task.deck === L.deck) {
    const tk = act.task, x = tk.x * DW, y = tk.y * DH, low = tk.t <= 10;
    ring(ctx, x, y, 26 * K, tk.t / tk.dur, low ? "#ff5a4a" : "#ff9900", 3);
    ring(ctx, x, y, 20 * K, tk.acc / tk.need, "#9fe8b1", 3);
    ctx.fillStyle = low ? "#ff6a5a" : "#ffb347"; ctx.font = "bold 13px Antonio, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(`TASK ${Math.ceil(tk.t)}s`, x, y - 12 * K); ctx.textAlign = "left";
  }
  // repair progress ring
  if (L.mode === "repair" && L.repairSys) ring(ctx, L.x * DW, L.y * DH + 2, 16 * K, L.repairT / SYSTEMS[L.repairSys].dur, "#ffb27a", 3);
  // destination marker
  if (L.mode === "walk" && L.path && L.path.length) { const e = L.path[L.path.length - 1]; ring(ctx, e[0] * DW, e[1] * DH, 8 * K, 1, "rgba(127,224,255,0.6)", 1.5); }
  if (DBG.walk) drawWalkGrid(ctx, dk);
  // characters, back to front by feet y
  if (L.deck === "bridge" && !L.lift) {
    const ltY = (L.mode === "use" && L.node && NODEMAP[L.node] && NODEMAP[L.node].lie) ? NODEMAP[L.node].lie[1] : L.y;
    if (tren.y < ltY) { drawTren(ctx, t); drawLt(ctx, t); } else { drawLt(ctx, t); drawTren(ctx, t); }
  } else drawLt(ctx, t);
  // NEW-08: room glow and low-power darkening go over the characters too, so the Lt dims with his deck
  lighting(ctx, t);
  // fault markers stay readable over the lighting. BUG-14: the "!" floats above the spot where the Lt actually
  // works (it used to sit on the gantry top, up to 171 px from the welding sparks); facing still uses mx/my.
  for (const [k, f] of Object.entries(G.ship.faults)) {
    const s = SYSTEMS[k]; if (s.deck !== L.deck) continue;
    marker(ctx, s.x * DW, Math.max(16, s.y * DH - FIG_H - 14), f.sev, t);
  }
  // fx
  for (let i = fxl.sparks.length - 1; i >= 0; i--) { const p = fxl.sparks[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; if (p.t > p.life) { fxl.sparks.splice(i, 1); continue; } ctx.fillStyle = `rgba(255,210,122,${1 - p.t / p.life})`; ctx.fillRect(p.x, p.y, 2, 2); }
  for (let i = fxl.pulses.length - 1; i >= 0; i--) { const p = fxl.pulses[i]; p.t += dt; if (p.t > 0.7) { fxl.pulses.splice(i, 1); continue; } ctx.globalAlpha = 1 - p.t / 0.7; ring(ctx, p.x, p.y, 18 + p.t * 50, 1, "#7fe0ff", 2); ctx.globalAlpha = 1; }
  ctx.font = `bold ${12 * K}px Antonio, sans-serif`; ctx.textAlign = "center";
  for (let i = fxl.floaters.length - 1; i >= 0; i--) {
    const p = fxl.floaters[i], life = p.life || 1.4; p.t += dt;
    if (p.t > life) { fxl.floaters.splice(i, 1); continue; }
    if (p.t < 0) continue;   // staggered reward floaters wait their turn
    const a = p.t < 0.15 ? p.t / 0.15 : 1 - Math.max(0, p.t - life * 0.45) / (life * 0.55);
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.lineWidth = 4; ctx.strokeStyle = "rgba(5,8,16,0.75)"; ctx.strokeText(p.text, p.x, p.y - p.t * 22 * K);
    ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y - p.t * 22 * K);
  }
  ctx.globalAlpha = 1; ctx.textAlign = "left";
  // screen-space overlays
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (G.ship.alertT > 0) {
    const a = clamp(G.ship.alertT / 2, 0, 1) * (0.12 + 0.08 * Math.sin(t * 6.2));
    const g = ctx.createRadialGradient(cam.w / 2, cam.h / 2, Math.min(cam.w, cam.h) * 0.3, cam.w / 2, cam.h / 2, Math.max(cam.w, cam.h) * 0.75);
    g.addColorStop(0, "rgba(255,0,0,0)"); g.addColorStop(1, `rgba(255,20,20,${a * 2.5})`); ctx.fillStyle = g; ctx.fillRect(0, 0, cam.w, cam.h);
  }
  drawLiftOverlay(ctx, t);
}
// NEW-03 / BUG-18: when the camera shows past the plate, paint the margin with the plate's own edge colour
// (average of its outer rows/columns, sampled once per plate; near-white borders fall back to the dark hull colour).
const edgeCache = new Map();
function edgeColours(plate, key) {
  if (edgeCache.has(key)) return edgeCache.get(key);
  let out = { top: "#0b0f18", bottom: "#0b0f18", left: "#0b0f18", right: "#0b0f18" };
  try {
    const c = document.createElement("canvas"); c.width = 96; c.height = 64;
    const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(plate, 0, 0, 96, 64);
    const avg = (sx, sy, w, h) => {
      const d = x.getImageData(sx, sy, w, h).data; let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i] + d[i + 1] + d[i + 2] > 660) continue; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      if (n < (w * h) / 3) return "#0b0f18";
      const k = 0.7;   // a touch darker than the edge so the plate border still reads
      return `rgb(${Math.round(r / n * k)},${Math.round(g / n * k)},${Math.round(b / n * k)})`;
    };
    out = { top: avg(0, 0, 96, 2), bottom: avg(0, 62, 96, 2), left: avg(0, 0, 2, 64), right: avg(94, 0, 2, 64) };
  } catch (e) { /* tainted or not ready: keep the dark fallback */ }
  edgeCache.set(key, out);
  return out;
}
function drawEdges(ctx, plate, dk) {
  const hw = cam.w / 2 / cam.scale, hh = cam.h / 2 / cam.scale;
  const x0 = cam.x - hw, x1 = cam.x + hw, y0 = cam.y - hh, y1 = cam.y + hh;
  if (x0 >= 0 && y0 >= 0 && x1 <= DW && y1 <= DH) return;
  const e = edgeColours(plate, dk.plate), m = 2;
  if (y0 < 0) { ctx.fillStyle = e.top; ctx.fillRect(x0 - m, y0 - m, x1 - x0 + 2 * m, -y0 + m); }
  if (y1 > DH) { ctx.fillStyle = e.bottom; ctx.fillRect(x0 - m, DH, x1 - x0 + 2 * m, y1 - DH + m); }
  if (x0 < 0) { ctx.fillStyle = e.left; ctx.fillRect(x0 - m, Math.max(0, y0), -x0 + m, Math.min(DH, y1) - Math.max(0, y0)); }
  if (x1 > DW) { ctx.fillStyle = e.right; ctx.fillRect(DW, Math.max(0, y0), x1 - DW + m, Math.min(DH, y1) - Math.max(0, y0)); }
}
// debug: the 60x40 walk grid (green = floor the Lt's feet may use), node stand spots (cyan) and the lift (amber)
function drawWalkGrid(ctx, dk) {
  const cw = DW / COLS, ch = DH / ROWS, W = dk.walk;
  ctx.fillStyle = "rgba(0,255,120,0.22)"; ctx.strokeStyle = "rgba(0,255,120,0.45)"; ctx.lineWidth = 0.5;
  for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) if (W[cy * COLS + cx]) { ctx.fillRect(cx * cw, cy * ch, cw, ch); ctx.strokeRect(cx * cw, cy * ch, cw, ch); }
  const dot = (x, y, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x * DW, y * DH, 4, 0, 6.29); ctx.fill(); };
  for (const n of Object.values(dk.nodes)) dot(n.x, n.y, "#00e5ff");
  dot(dk.lift.x, dk.lift.y, "#ffb000");
  ctx.fillStyle = "#fff"; ctx.font = "bold 10px sans-serif"; ctx.fillText(`walk: ${dk.walkSrc}`, 6, 14);
}
// Turbolift transition: LCARS doors close over the old deck, open on the new one. Never black.
function drawLiftOverlay(ctx) {
  const lf = G.lt.lift; if (!lf) return;
  const half = LIFT_T / 2, p = lf.t < half ? lf.t / half : 1 - (lf.t - half) / half;
  const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2, w = cam.w, h = cam.h, dw = (w / 2) * Math.min(1, e * 1.08);
  const door = (x, dir) => {
    const g = ctx.createLinearGradient(x, 0, x + dw * dir, 0); g.addColorStop(0, "#2a3346"); g.addColorStop(1, "#4b5876");
    ctx.fillStyle = g; ctx.fillRect(dir > 0 ? 0 : w - dw, 0, dw, h);
    ctx.fillStyle = "#ff9900"; ctx.fillRect(dir > 0 ? dw - 6 : w - dw, 0, 6, h);
    ctx.fillStyle = "rgba(255,255,255,0.08)"; for (let y = 20; y < h; y += 46) ctx.fillRect(dir > 0 ? 10 : w - dw + 16, y, dw - 26, 3);
  };
  door(0, 1); door(w, -1);
  if (e > 0.85) {
    ctx.fillStyle = "#ffcc66"; ctx.font = "600 20px Antonio, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("TURBOLIFT", w / 2, h / 2 - 12); ctx.fillStyle = "#cfe3ff"; ctx.font = "600 26px Antonio, sans-serif";
    ctx.fillText(DECKS[lf.dest].name.toUpperCase(), w / 2, h / 2 + 22); ctx.textAlign = "left";
  }
}
