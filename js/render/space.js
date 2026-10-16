// Space view: location backdrop (crossfade), Miranda + Jem'Hadar, beams, torpedoes, shields, booms, floaters.
import { G } from "../state.js";
import { IMG } from "../assets.js";
import { SFX } from "../battle.js";
import { voyageView } from "../voyage.js";
import { clamp } from "../util.js";

const bg = { cur: null, prev: null, f: 1 };
const stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random() }));
function cover(ctx, img, w, h, alpha, drift) {
  if (!img) { ctx.fillStyle = "#03050c"; ctx.fillRect(0, 0, w, h); return; }
  const s = Math.max(w / img.width, h / img.height) * 1.06, iw = img.width * s, ih = img.height * s;
  ctx.globalAlpha = alpha; ctx.drawImage(img, (w - iw) / 2 + drift, (h - ih) / 2, iw, ih); ctx.globalAlpha = 1;
}
export function drawSpace(ctx, t, dt) {
  const w = ctx.canvas.clientWidth, h = ctx.canvas.clientHeight, dpr = ctx.canvas.width / w;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const vv = voyageView(), SP = G.sp, B = SP.battle;
  if (vv.bg !== bg.cur) { bg.prev = bg.cur; bg.cur = vv.bg; bg.f = bg.prev ? 0 : 1; }
  bg.f = Math.min(1, bg.f + dt / 1.0);
  const drift = Math.sin(t * 0.05) * 8;
  if (bg.prev && bg.f < 1) cover(ctx, IMG[bg.prev], w, h, 1, drift);
  cover(ctx, IMG[bg.cur], w, h, bg.prev ? bg.f : 1, drift);
  // warp streaks while travelling
  const warp = SP.travel && !SP.travelPaused;
  for (const s of stars) {
    if (warp) { s.x -= dt * (0.4 + s.z * 1.6); if (s.x < 0) { s.x = 1; s.y = Math.random(); } }
    const len = warp ? 20 + s.z * 70 : 1.5;
    ctx.strokeStyle = `rgba(200,220,255,${0.25 + s.z * 0.5})`; ctx.lineWidth = warp ? 1.2 : 1.6;
    ctx.beginPath(); ctx.moveTo(s.x * w, s.y * h); ctx.lineTo(s.x * w + len, s.y * h); ctx.stroke();
  }
  // layout
  const portrait = w / h < 1;
  let tw = portrait ? w * 0.82 : Math.min(w * 0.52, h * 1.35), th = tw / 3.5;
  let tx, ty;
  if (B) { tx = w * (portrait ? 0.03 : 0.04); ty = h * (portrait ? 0.6 : 0.5); }
  else { tx = (w - tw) / 2; ty = h * 0.5 - th / 2; }
  const bob = Math.sin(t * 0.9) * h * 0.006;
  const dip = SP.evasiveT > 0 ? Math.sin((3 - SP.evasiveT) / 3 * Math.PI) * h * 0.08 : 0;
  ty += bob + dip;
  if (SFX.shakeT > 0) { tx += (Math.random() - 0.5) * 8; ty += (Math.random() - 0.5) * 6; }
  SFX.tenRect = { x: tx / w, y: ty / h, w: tw / w, h: th / h };
  const jw = portrait ? w * 0.52 : Math.min(w * 0.32, h * 0.8), jh = jw / 1.96;
  const enter = B ? 1 - Math.pow(1 - B.enterT, 3) : 0;
  const jx = w * (portrait ? 0.46 : 0.62) + (1 - enter) * w * 0.6, jy = h * (portrait ? 0.2 : 0.16);
  SFX.jemRect = { x: jx / w, y: jy / h, w: jw / w, h: jh / h };
  // ships
  if (IMG["ship-tenacity"]) ctx.drawImage(IMG["ship-tenacity"], tx, ty, tw, th);
  if (warp) { ctx.fillStyle = "rgba(140,190,255,0.25)"; ctx.fillRect(tx - 60, ty + th * 0.75, 60, 3); }
  if (SFX.shieldFlare) {
    const p = SFX.shieldFlare.t / SFX.shieldFlare.dur, a = (1 - p) * 0.65;
    ctx.save(); ctx.translate(tx + tw / 2, ty + th / 2); ctx.scale(1, th * 0.95 / (tw * 0.58));
    const g = ctx.createRadialGradient(0, 0, tw * 0.4, 0, 0, tw * 0.6); g.addColorStop(0, "rgba(90,170,255,0)"); g.addColorStop(0.8, `rgba(120,200,255,${a})`); g.addColorStop(1, "rgba(120,200,255,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, tw * 0.6, 0, 6.29); ctx.fill(); ctx.restore();
  }
  if (B && IMG["ship-jemhadar"]) {
    ctx.save(); const jxx = jx + SFX.jink.x * w, jyy = jy + SFX.jink.y * h;
    if (B.dying) ctx.globalAlpha = clamp(B.dying / 1.3, 0, 1);
    ctx.drawImage(IMG["ship-jemhadar"], jxx, jyy, jw, jh); ctx.restore();
  }
  // smoke/flame
  for (const s of SFX.smoke) {
    const p = s.t / s.life, x = s.x * w, y = s.y * h, r = s.r * w * (s.kind === "smoke" ? 1 + p * 2 : 1);
    ctx.fillStyle = s.kind === "smoke" ? `rgba(70,70,80,${0.5 * (1 - p)})` : s.kind === "flame" ? `rgba(255,${140 - p * 80},40,${1 - p})` : `rgba(255,220,140,${1 - p})`;
    ctx.beginPath(); ctx.arc(x, y, Math.max(1, r), 0, 6.29); ctx.fill();
  }
  // beams
  ctx.lineCap = "round";
  for (const b of SFX.beams) {
    const a = 1 - b.t / b.dur;
    ctx.strokeStyle = `rgba(${b.col},${a * 0.35})`; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(b.x0 * w, b.y0 * h); ctx.lineTo(b.x1 * w, b.y1 * h); ctx.stroke();
    ctx.strokeStyle = `rgba(255,250,235,${a})`; ctx.lineWidth = 2.2; ctx.stroke();
  }
  for (const f of SFX.flares) { const a = 1 - f.t / f.dur, g = ctx.createRadialGradient(f.x * w, f.y * h, 0, f.x * w, f.y * h, 26); g.addColorStop(0, `rgba(${f.col},${a})`); g.addColorStop(1, `rgba(${f.col},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x * w, f.y * h, 26, 0, 6.29); ctx.fill(); }
  // torpedoes
  for (const s of SFX.shots) {
    if (s.t < 0) continue;
    const p = s.t / s.dur, x = (s.x0 + (s.x1 - s.x0) * p) * w, y = (s.y0 + (s.y1 - s.y0) * p) * h - Math.sin(p * Math.PI) * h * 0.04;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 14); g.addColorStop(0, "rgba(255,240,220,1)"); g.addColorStop(0.3, "rgba(255,90,60,0.9)"); g.addColorStop(1, "rgba(255,60,40,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 14, 0, 6.29); ctx.fill();
  }
  // booms
  for (const b of SFX.booms) {
    const p = b.t / b.dur, r = (b.big ? 110 : 34) * (0.3 + p), x = b.x * w, y = b.y * h;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,255,220,${1 - p})`); g.addColorStop(0.35, `rgba(255,160,60,${0.9 * (1 - p)})`); g.addColorStop(1, "rgba(200,40,10,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.29); ctx.fill();
  }
  ctx.font = "bold 16px Antonio, sans-serif"; ctx.textAlign = "center";
  for (const f of SFX.floaters) { ctx.globalAlpha = 1 - f.t / 1.2; ctx.fillStyle = f.color; ctx.fillText(f.text, f.x * w, f.y * h - f.t * 30); }
  ctx.globalAlpha = 1; ctx.textAlign = "left";
  if (B) { ctx.fillStyle = `rgba(255,0,0,${0.08 + 0.05 * Math.sin(t * 6)})`; ctx.fillRect(0, 0, w, h); }
}
