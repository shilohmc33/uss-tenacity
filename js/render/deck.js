// Deck renderer: plate + camera (follow, pinch/wheel zoom, drag pan), Lt sprites, rings, fx, turbolift overlay.
import { G } from "../state.js";
import { DECKS, NODEMAP, SYSTEMS, DW, DH, CREW_FRAMES, WORK_FRAMES, REPAIR_FRAMES, SOCIAL_FRAMES, FIG_H, LIE_LEN, socialPose } from "../data.js";
import { IMG } from "../assets.js";
import { clamp, dDist } from "../util.js";
import { ZONE, LIFT_T } from "../crew.js";
import { TORP_BUILD_T } from "../crew.js";

export const cam = { x: 0.45 * DW, y: 0.62 * DH, zoom: 2.2, scale: 1, fit: 1, w: 0, h: 0, manualT: 0, snap: true };
const fxl = { sparks: [], floaters: [], pulses: [] };
export function deckFx(kind, d) {
  if (kind === "spark") for (let i = 0; i < 2; i++) fxl.sparks.push({ x: d.x * DW, y: d.y * DH, vx: (Math.random() - 0.5) * 90, vy: -Math.random() * 80, t: 0, life: 0.4 + Math.random() * 0.3 });
  if (kind === "floater") fxl.floaters.push({ x: d.x * DW, y: d.y * DH, text: d.text, color: d.color, t: 0 });
  if (kind === "pulse") fxl.pulses.push({ x: d.x * DW, y: d.y * DH, t: 0 });
  if (kind === "deckChanged") { fxl.sparks.length = 0; fxl.floaters.length = 0; cam.snap = true; }
}
export function resizeCam(w, h) {
  cam.w = w; cam.h = h;
  cam.fit = Math.min(w / DW, h / DH);
  cam.scale = cam.fit * cam.zoom;
}
export function setZoom(z, ax, ay) {
  const old = cam.scale;
  cam.zoom = clamp(z, 1, 4.5);
  cam.scale = cam.fit * cam.zoom;
  if (ax !== undefined) { // keep anchor point fixed
    const wx = cam.x + (ax - cam.w / 2) / old, wy = cam.y + (ay - cam.h / 2) / old;
    cam.x = wx - (ax - cam.w / 2) / cam.scale; cam.y = wy - (ay - cam.h / 2) / cam.scale;
    cam.manualT = 2.5;
  }
}
export function screenToDeck(sx, sy) { return [(cam.x + (sx - cam.w / 2) / cam.scale) / DW, (cam.y + (sy - cam.h / 2) / cam.scale) / DH]; }
export function panBy(dx, dy) { cam.x -= dx / cam.scale; cam.y -= dy / cam.scale; cam.manualT = 2.5; }
function clampCam() {
  const hw = cam.w / 2 / cam.scale, hh = cam.h / 2 / cam.scale;
  cam.x = hw * 2 >= DW ? DW / 2 : clamp(cam.x, hw, DW - hw);
  cam.y = hh * 2 >= DH ? DH / 2 : clamp(cam.y, hh, DH - hh);
}
export function updateCam(dt) {
  const L = G.lt;
  let tx = L.x * DW, ty = L.y * DH - 30;
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
  for (const [id, n] of Object.entries(dk.nodes)) { cands.push({ kind: "use", id, x: n.x, y: n.y }); cands.push({ kind: "use", id, x: n.mx, y: n.my }); if (n.seatN) cands.push({ kind: "use", id, x: n.seatN.x, y: n.seatN.y }); }
  cands.push({ kind: "lift", x: dk.lift.x, y: dk.lift.y }, { kind: "lift", x: dk.lift.mx, y: dk.lift.my });
  let best = null, bd = Infinity;
  for (const c of cands) { const d = dDist(fx, fy, c.x, c.y); if (d < r && d < bd - 4) { bd = d; best = c; } }
  return best;
}

// ---------- drawing ----------
function drawFrame(ctx, img, f, px, py, s) { ctx.drawImage(img, f.x, f.y, f.w, f.h, px - f.ax * s, py - f.ay * s, f.w * s, f.h * s); }
function drawLt(ctx, t) {
  const L = G.lt, nd = L.mode === "use" && L.node ? NODEMAP[L.node] : null;
  if (nd && nd.lie && IMG["crew-atlas"]) {
    const f = CREW_FRAMES.lying, s = LIE_LEN / f.refH;
    ctx.save(); ctx.translate(nd.lie[0] * DW, nd.lie[1] * DH); ctx.rotate(nd.lieRot || 0);
    ctx.fillStyle = "rgba(20,10,0,0.3)"; ctx.beginPath(); ctx.ellipse(0, 2, 15, 46, 0, 0, 6.29); ctx.fill();
    const b = 1 + Math.sin(t * 1.5) * 0.006; ctx.scale(b, b);
    drawFrame(ctx, IMG["crew-atlas"], f, 0, 0, s); ctx.restore();
    zzz(ctx, nd.lie[0] * DW + 18, nd.lie[1] * DH - 30, t);
    return;
  }
  const px = L.x * DW, py = L.y * DH;
  ctx.fillStyle = "rgba(20,10,0,0.38)"; ctx.beginPath(); ctx.ellipse(px, py - 1, 13, 4.2, 0, 0, 6.29); ctx.fill();
  const repairing = L.mode === "repair", seated = L.mode === "use" && L.node === "mess";
  const working = repairing || (L.mode === "use" && nd && !nd.rest);
  const dir = L.dir, ab = Math.floor(t / 0.45) % 2 === 0 ? "-a" : "-b";
  if (seated && IMG["crew-social"]) {
    const sp = socialPose(t), f = SOCIAL_FRAMES[(dir === "up" ? "up" : "down") + "-" + sp.loop + "-" + sp.frame];
    drawFrame(ctx, IMG["crew-social"], f, px, py, FIG_H / f.refH); return;
  }
  if (repairing && IMG["crew-repair"]) { const f = REPAIR_FRAMES[dir + ab]; drawFrame(ctx, IMG["crew-repair"], f, px, py, FIG_H / f.refH); return; }
  if (working && IMG["crew-work"]) { const f = WORK_FRAMES[dir + ab]; drawFrame(ctx, IMG["crew-work"], f, px, py, FIG_H / f.refH); return; }
  const idle = !L.moving;
  let name = dir + "-idle";
  if (!idle && L.swingAmp >= 0.35) { const q = Math.floor(L.walkPhase / (Math.PI / 2)) % 4; name = dir + (q === 0 ? "-stepA" : q === 2 ? "-stepB" : "-pass"); }
  const f = CREW_FRAMES[name];
  if (!IMG["crew-atlas"]) { ctx.fillStyle = "#c9a14a"; ctx.fillRect(px - 8, py - 60, 16, 60); return; }
  const s = FIG_H / f.refH, bob = -Math.abs(Math.cos(L.walkPhase)) * 1.2 * L.swingAmp;
  const breath = idle ? Math.sin(t * 1.7) * 0.7 : 0, sway = idle ? Math.sin(t * 0.45) * 0.8 : 0;
  drawFrame(ctx, IMG["crew-atlas"], f, px + sway, py + bob + breath, s);
  if (L.node === "bar" && L.mode === "use") speech(ctx, px + 14, py - 74, t);
}
function zzz(ctx, x, y, t) { ctx.fillStyle = "rgba(200,220,255,0.8)"; ctx.font = "bold 11px Antonio, sans-serif"; for (let i = 0; i < 3; i++) { const p = (t * 0.5 + i / 3) % 1; ctx.globalAlpha = 1 - p; ctx.fillText("z", x + p * 10, y - p * 26); } ctx.globalAlpha = 1; }
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
  if (plate) ctx.drawImage(plate, 0, 0, DW, DH); else { ctx.fillStyle = "#1b2233"; ctx.fillRect(0, 0, DW, DH); ctx.fillStyle = "#8af"; ctx.fillText(dk.name + " (plate missing)", 20, 30); }
  lighting(ctx, t);
  // node rings
  for (const [id, n] of Object.entries(dk.nodes)) {
    const active = L.mode === "use" && L.node === id;
    if (active && id === "torpbay") ring(ctx, n.x * DW, n.y * DH, 20, G.ship.charge / 100, "#ffb36b");
    else ring(ctx, n.x * DW, n.y * DH, 20, active ? 1 : 0, active ? "#7fe0ff" : "rgba(160,200,255,0.4)", active ? 2.5 : 1.5);
  }
  // lift glow
  const lf = dk.lift, near = dDist(L.x, L.y, lf.x, lf.y) < ZONE * 1.6;
  const lg = ctx.createRadialGradient(lf.mx * DW, lf.my * DH, 0, lf.mx * DW, lf.my * DH, 40);
  lg.addColorStop(0, `rgba(255,170,60,${near ? 0.45 : 0.18 + 0.08 * Math.sin(t * 2)})`); lg.addColorStop(1, "rgba(255,170,60,0)");
  ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(lf.mx * DW, lf.my * DH, 40, 0, 6.29); ctx.fill();
  ctx.fillStyle = "rgba(255,200,120,0.9)"; ctx.font = "600 10px Antonio, sans-serif"; ctx.textAlign = "center"; ctx.fillText("TURBOLIFT", lf.mx * DW, lf.my * DH - 22); ctx.textAlign = "left";
  // fault markers + in-range rings
  for (const [k, f] of Object.entries(G.ship.faults)) {
    const s = SYSTEMS[k]; if (s.deck !== L.deck) continue;
    if (dDist(L.x, L.y, s.x, s.y) <= ZONE * 2) ring(ctx, s.x * DW, s.y * DH, 30, 0.5 + 0.5 * Math.sin(t * 3.2), "rgba(255,180,90,0.8)", 1.5);
    marker(ctx, s.mx * DW, s.my * DH, f.sev, t);
  }
  // event task ring with countdown
  const act = G.sp.ev.active;
  if (act && act.task && act.task.deck === L.deck) {
    const tk = act.task, x = tk.x * DW, y = tk.y * DH, low = tk.t <= 10;
    ring(ctx, x, y, 40, tk.t / tk.dur, low ? "#ff5a4a" : "#ff9900", 3);
    ring(ctx, x, y, 30, tk.acc / tk.need, "#9fe8b1", 3);
    ctx.fillStyle = low ? "#ff6a5a" : "#ffb347"; ctx.font = "bold 13px Antonio, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(`TASK ${Math.ceil(tk.t)}s`, x, y - 26); ctx.textAlign = "left";
  }
  // repair progress ring
  if (L.mode === "repair" && L.repairSys) ring(ctx, L.x * DW, L.y * DH + 2, 22, L.repairT / SYSTEMS[L.repairSys].dur, "#ffb27a", 3);
  // destination marker
  if (L.mode === "walk" && L.path && L.path.length) { const e = L.path[L.path.length - 1]; ring(ctx, e[0] * DW, e[1] * DH, 10, 1, "rgba(127,224,255,0.6)", 1.5); }
  drawLt(ctx, t);
  // fx
  for (let i = fxl.sparks.length - 1; i >= 0; i--) { const p = fxl.sparks[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; if (p.t > p.life) { fxl.sparks.splice(i, 1); continue; } ctx.fillStyle = `rgba(255,210,122,${1 - p.t / p.life})`; ctx.fillRect(p.x, p.y, 2, 2); }
  for (let i = fxl.pulses.length - 1; i >= 0; i--) { const p = fxl.pulses[i]; p.t += dt; if (p.t > 0.7) { fxl.pulses.splice(i, 1); continue; } ctx.globalAlpha = 1 - p.t / 0.7; ring(ctx, p.x, p.y, 18 + p.t * 50, 1, "#7fe0ff", 2); ctx.globalAlpha = 1; }
  ctx.font = "bold 12px Antonio, sans-serif"; ctx.textAlign = "center";
  for (let i = fxl.floaters.length - 1; i >= 0; i--) { const p = fxl.floaters[i]; p.t += dt; if (p.t > 1.4) { fxl.floaters.splice(i, 1); continue; } ctx.globalAlpha = 1 - p.t / 1.4; ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y - p.t * 26); }
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
