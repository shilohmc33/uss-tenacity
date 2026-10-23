// Ship death explosion, reusable for every ship (EXPLOSION / FX_SHEET in data.js; bigBoom ships use the big profile).
// Sequence: staggered chain blasts across the hull -> detonation (white flash, hit-stop, screen shake) -> flat Praxis ring,
// the painted wreck sections (ship-states.js) drifting and spinning apart from their exact offsets with a cooling glow,
// painted debris, fireball -> smoke, embers, specks. Fallback when the wreck art is missing: the ship's drawn art cut into wedges.
// Big ships add a blue-white warp-core-breach flash (sheet row stretched sideways plus a code streak) and a bigger ring.
// The artist's sheet is the primary look; procedural gradients stand in only when a sheet image is missing.
// Allocation happens only when a death starts (chunk canvases, cached per class+size); particles are pooled.
import { IMG } from "../assets.js";
import { EXPLOSION, FX_SHEET } from "../data.js";
import { SHIPS } from "../ships.js";
import { SHIP_STATES } from "../ship-states.js";
import { SHIP_SHEET } from "../data.js";

const deaths = new Map();              // key -> death state
const chunkCache = new Map();          // `${ship}|${w}|${h}|${mirror}` -> [{ img, glow, ang }]
const LITE_AT = 3, STAG = 0.3, LITE_K = 0.4;   // P2 particle budget (see startShipDeath)
const POOL = 160, parts = Array.from({ length: POOL }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 1, r: 1, kind: 0 }));
let flashT = 0, flashDur = 1, flashBlue = false, hitStopUntil = 0, hitScale = 1, shakeT = 0, shakeDur = 1, shakeAmp = 0;
const R = (a, b) => a + Math.random() * (b - a);
const profileOf = ship => EXPLOSION[(SHIPS[ship] && SHIPS[ship].bigBoom) ? "big" : "default"];

// hit-stop is a real-time deadline, so it always ends even when space isn't being drawn (P21 #1)
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
export const fxTimeScale = () => (now() < hitStopUntil ? hitScale : 1);
const done = new Set();   // deaths already started this battle: never replayed after clearShipFx (P21 #2)
export const fxShake = () => { if (shakeT <= 0) return [0, 0]; const a = shakeAmp * (shakeT / shakeDur); return [(Math.random() - 0.5) * 2 * a, (Math.random() - 0.5) * 2 * a]; };
export const shipFxHidden = key => { const d = deaths.get(key); return d ? d.t >= d.P.det : done.has(key); };
export const shipFxActive = () => deaths.size > 0;
export const deathTotal = ship => profileOf(ship).total;

const glowCache = new Map();
function glowOf(im, key) {   // orange soft rim just outside the piece edges, for the cooling-hot glow on wreck pieces
  if (key && glowCache.has(key)) return glowCache.get(key);
  const pad = 8, c = document.createElement("canvas"); c.width = im.width + pad * 2; c.height = im.height + pad * 2; const g = c.getContext("2d");
  g.shadowColor = "rgba(255,150,40,1)"; g.shadowBlur = 6; g.drawImage(im, pad, pad); g.shadowBlur = 0;
  g.globalCompositeOperation = "source-in"; g.fillStyle = "rgb(255,140,40)"; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = "destination-out"; g.drawImage(im, pad, pad);   // keep only the rim outside the torn edges: the painted hull stays untinted
  const o = { c, pad }; if (key) glowCache.set(key, o); return o;
}
// painted wreck pieces for a class, placed in death-box px relative to the ship centre (null if the art isn't loaded)
function wreckOf(ship, w, mirror, P) {
  const d = SHIPS[ship], ss = d && SHIP_STATES.ships[d.sprite]; if (!ss) return null;
  const ok = p => { const im = IMG[p.img]; return im && im.width > 0; };
  if (!ss.sections.every(ok)) return null;
  const k = w / SHIP_SHEET.len, m = mirror ? -1 : 1, [px, py] = SHIP_STATES.pivot, W = P.wreck;
  const mk = (p, sec) => { const pv = p.pivot || [p.size[0] / 2, p.size[1] / 2], dr = sec ? W.drift : W.debrisDrift;
    return { im: IMG[p.img], gl: sec ? glowOf(IMG[p.img], p.img) : null, k, m, pv, sz: p.size, sec,
      x: (p.off[0] + pv[0] - px) * k * m, y: (p.off[1] + pv[1] - py) * k, vx: p.vel[0] * k * m * dr * R(0.85, 1.15), vy: p.vel[1] * k * dr * R(0.85, 1.15),
      rot: 0, vr: p.spin * Math.PI / 180 * m * (sec ? W.spin : 1), life: sec ? W.life : R(W.debrisLife[0], W.debrisLife[1]) }; };
  return [...ss.sections.map(p => mk(p, true)), ...ss.debris.filter(ok).map(p => mk(p, false))];
}
// FALLBACK: cut the ship's drawn art into wedge chunks (radial cuts from a jittered centre), each with a glow silhouette
function cutChunks(ship, w, h, mirror, n, drawFn) {
  const key = `${ship}|${Math.round(w)}|${Math.round(h)}|${mirror ? 1 : 0}|${n}`;
  if (chunkCache.has(key)) return chunkCache.get(key);
  const pad = 12, cw = Math.ceil(w + pad * 2), ch = Math.ceil(h + pad * 2);
  const src = document.createElement("canvas"); src.width = cw; src.height = ch;
  drawFn(src.getContext("2d"), pad, pad, w, h);
  const cx = cw / 2 + R(-0.06, 0.06) * w, cy = ch / 2 + R(-0.1, 0.1) * h, out = [];
  const angs = []; for (let i = 0; i < n; i++) angs.push((i + R(0.15, 0.85)) / n * Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const a0 = angs[i], a1 = angs[(i + 1) % n] + (i === n - 1 ? Math.PI * 2 : 0), big = Math.max(cw, ch) * 2;
    const c = document.createElement("canvas"); c.width = cw; c.height = ch; const g = c.getContext("2d");
    g.beginPath(); g.moveTo(cx, cy); for (let k = 0; k <= 4; k++) { const a = a0 + (a1 - a0) * k / 4; g.lineTo(cx + Math.cos(a) * big, cy + Math.sin(a) * big); } g.closePath();
    g.save(); g.clip(); g.drawImage(src, 0, 0); g.restore();
    const gl = document.createElement("canvas"); gl.width = cw; gl.height = ch; const gg = gl.getContext("2d");
    gg.shadowColor = "rgba(255,150,40,1)"; gg.shadowBlur = 7; gg.drawImage(c, 0, 0); gg.shadowBlur = 0;
    gg.globalCompositeOperation = "source-in"; gg.fillStyle = "rgb(255,140,40)"; gg.fillRect(0, 0, cw, ch);
    out.push({ img: c, glow: gl, ang: (a0 + a1) / 2, ox: cx - cw / 2, oy: cy - ch / 2 });
  }
  chunkCache.set(key, out); if (chunkCache.size > 24) chunkCache.delete(chunkCache.keys().next().value);
  return out;
}

// start a death once per key. box in px (x, y, w, h) of the drawn ship; vw, vh: viewport px. drawFn(ctx, x, y, w, h) draws the ship.
export function startShipDeath(key, ship, box, vw, vh, mirror, drawFn) {
  if (deaths.has(key) || done.has(key)) return;
  done.add(key); if (done.size > 64) done.delete(done.values().next().value);
  const P = profileOf(ship), [x, y, w, h] = box, L = w;
  const n = Math.round(R(P.chain.n[0], P.chain.n[1] + 0.99) - 0.49), chain = [];
  for (let i = 0; i < n; i++) chain.push({ t: (i + R(0, 0.6)) / n * P.chain.over, x: x + w * R(0.18, 0.82), y: y + h * R(0.3, 0.7), s: L * P.chain.size * R(0.75, 1.15) });
  const wreck = wreckOf(ship, w, mirror, P);
  const chunks = wreck ? [] : cutChunks(ship, w, h, mirror, P.chunks.n, drawFn).map(c => ({ c, dx: 0, dy: 0, rot: 0,
    vx: Math.cos(c.ang) * L * P.chunks.speed * R(0.5, 1.1), vy: Math.sin(c.ang) * L * P.chunks.speed * R(0.4, 0.9) * 0.6, vr: R(-1, 1) * P.chunks.spin }));
  // multi-ship P2 budget: 3+ deaths/wrecks on screen -> every one goes LITE (painted debris dropped, no wreck glow, at most 2 chain
  // blasts, 0.4x embers/specks); and at most 2 detonations start per STAG s (later ones wait, keeping the frame and the particle pool sane)
  const recent = [...deaths.values()].filter(o => o.t < STAG).length, lite = deaths.size >= LITE_AT - 1;
  if (lite) { if (chain.length > 2) chain.length = 2; for (const o of deaths.values()) { o.lite = true; o.wreck = o.wreck.filter(p => p.sec); } }
  deaths.set(key, { P, t: recent >= 2 ? -STAG * (recent - 1) : 0, cx: x + w / 2, cy: y + h / 2, w, h, L, vw, vh, chain, chunks,
    wreck: (wreck || []).filter(p => !lite || p.sec), boomed: false, lite });
}

function spawn(d, kind, n, speed, life) {
  for (let i = 0, j = 0; i < n && j < POOL; j++) { const p = parts[j]; if (p.on) continue; i++;
    const a = R(0, Math.PI * 2), s = d.L * speed * R(0.2, 1);
    Object.assign(p, { on: true, kind, x: d.cx + R(-0.15, 0.15) * d.w, y: d.cy + R(-0.2, 0.2) * d.h, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, t: 0, life: R(life[0], life[1]), r: kind ? R(1, 2.2) : R(1.2, 2.8) });
  }
}

// advance with the frame's real dt (hit-stop counts in real time, everything else in scaled time)
export function tickShipFx(rdt) {
  if (shakeT > 0) shakeT -= rdt;
  if (flashT > 0) flashT -= rdt;   // the flash runs in real time, so the hit-stop does not stretch it
  const dt = rdt * fxTimeScale();
  for (const [k, d] of deaths) {
    d.t += dt; const P = d.P;
    if (!d.boomed && d.t >= P.det) {
      d.boomed = true; const lk = d.lite ? LITE_K : 1;   // P2: hit-stop / shake / flash never stack - a new one wins only if it is stronger
      if (now() >= hitStopUntil || P.hitStop.scale < hitScale) { hitStopUntil = now() + P.hitStop.dur * 1000; hitScale = P.hitStop.scale; }
      if (shakeT <= 0 || P.shake.amp > shakeAmp * shakeT / shakeDur) { shakeT = shakeDur = P.shake.dur; shakeAmp = P.shake.amp; }
      if (flashT <= 0 || P.flash > flashT) { flashT = flashDur = P.flash; flashBlue = !!P.breach; }
      spawn(d, 0, Math.round(P.embers.n * lk), P.embers.speed, P.embers.life); spawn(d, 1, Math.round(P.specks.n * lk), P.chunks.speed * 0.6, P.specks.life);
    }
    if (d.boomed) for (const p of d.wreck) { p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
    if (d.boomed) for (const c of d.chunks) { c.dx += c.vx * dt; c.dy += c.vy * dt; c.rot += c.vr * dt; c.vx *= 1 - dt * 0.35; c.vy *= 1 - dt * 0.35; }
    if (d.t > P.total + 1.2) deaths.delete(k);
  }
  for (const p of parts) if (p.on) { p.t += dt; if (p.t >= p.life) { p.on = false; continue; } p.x += p.vx * dt; p.y += p.vy * dt; const f = 1 - dt * (p.kind ? 0.6 : 1.6); p.vx *= f; p.vy *= f; }
}

function cell(ctx, sheet, row, f, x, y, sw, sh, alpha) {
  const S = FX_SHEET.sheets[sheet], im = IMG[S.img], r = S.rows[row];
  if (!im || !im.width) return false;
  const c = FX_SHEET.cell, fr = Math.min(r.frames - 1, Math.max(0, f | 0));
  ctx.globalAlpha = alpha; ctx.globalCompositeOperation = S.blend;
  ctx.drawImage(im, fr * c, r.row * c, c, c, x - sw / 2, y - sh / 2, sw, sh);
  ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; return true;
}
function blob(ctx, x, y, r, p, c0, c1) {   // procedural fallback fireball
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${c0},${1 - p})`); g.addColorStop(0.4, `rgba(${c1},${0.85 * (1 - p)})`); g.addColorStop(1, "rgba(120,30,10,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.29); ctx.fill();
}
const rowDur = (sheet, row) => { const r = FX_SHEET.sheets[sheet].rows[row]; return r.frames / r.fps; };

// draw every active death (call after the ships, before labels). w, h: viewport px.
export function drawShipFx(ctx, w, h) {
  if (!deaths.size && !parts.some(p => p.on)) return;
  ctx.save();
  for (const d of deaths.values()) {
    const P = d.P, t = d.t, kx = w / d.vw, ky = h / d.vh, cx = d.cx * kx, cy = d.cy * ky, L = d.L * kx;
    // 1) chain blasts (before the detonation)
    const fbD = rowDur("explosion", "fireball"), spD = rowDur("additive", "sparks");
    for (const b of d.chain) { const a = t - b.t; if (a < 0 || a > fbD) continue; const s = b.s * kx, bx = b.x * kx, by = b.y * ky;
      if (!cell(ctx, "explosion", "fireball", a * 14, bx, by, s, s, 1)) blob(ctx, bx, by, s * 0.5, a / fbD, "255,250,220", "255,150,50");
      if (a < spD) cell(ctx, "additive", "sparks", a * 14, bx, by, s * 1.3, s * 1.3, 0.9); }
    if (t < P.det) continue;
    const e = t - P.det;
    // 2) chunks
    const cl = P.chunks.life;
    for (const c of d.chunks) { if (e > cl) break; const k = e / cl, al = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4, im = c.c.img;
      ctx.save(); ctx.translate(cx + c.dx * kx, cy + c.dy * ky); ctx.rotate(c.rot); ctx.globalAlpha = al;
      ctx.drawImage(im, -im.width / 2 * kx, -im.height / 2 * kx, im.width * kx, im.height * kx);
      ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = al * P.chunks.glow * Math.max(0, 1 - k * 1.3);
      ctx.drawImage(c.c.glow, -im.width / 2 * kx, -im.height / 2 * kx, im.width * kx, im.height * kx);
      ctx.restore(); }
    // 2b) painted wreck sections and debris, from their exact offsets
    for (const p of d.wreck) { if (e > p.life) continue; const k = e / p.life, fo = p.sec ? 0.65 : 0.3, al = k < fo ? 1 : 1 - (k - fo) / (1 - fo), s = p.k * kx;
      ctx.save(); ctx.translate(cx + p.x * kx, cy + p.y * ky); ctx.rotate(p.rot); ctx.scale(p.m, 1); ctx.globalAlpha = al;
      ctx.drawImage(p.im, -p.pv[0] * s, -p.pv[1] * s, p.sz[0] * s, p.sz[1] * s);
      if (p.gl && !d.lite) { const g = p.gl, hot = P.wreck.glow * Math.max(0, 1 - e / (p.life * 0.35)); if (hot > 0) { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = al * hot;
        ctx.drawImage(g.c, (-p.pv[0] - g.pad) * s, (-p.pv[1] - g.pad) * s, g.c.width * s, g.c.height * s); } }
      ctx.restore(); }
    // 3) smoke (normal blend, after a delay), then the fireball and breach on top
    const smD = rowDur("explosion", "smoke"), se = e - P.smoke.delay;
    if (se > 0 && se < smD * 1.6) { const s = L * P.smoke.size * (1 + se * 0.25); cell(ctx, "explosion", "smoke", se * 8 / 1.6, cx, cy - se * L * 0.04, s, s, Math.min(1, 1.4 - se / (smD * 1.6))); }
    if (e < fbD) { const s = L * P.fireball.size * (0.8 + e * 0.5);
      if (!cell(ctx, "explosion", "fireball", e * 14, cx, cy, s, s, 1)) blob(ctx, cx, cy, s * 0.55, e / fbD, "255,255,235", "255,150,50");
      cell(ctx, "additive", "sparks", e * 14, cx, cy, s * 1.4, s * 1.4, 1); }
    if (P.breach) { const bD = rowDur("additive", "warpBreach");
      if (e < bD) { const s = L * P.breach.size;
        if (!cell(ctx, "additive", "warpBreach", e * 12, cx, cy, s * P.breach.stretch, s, 1)) blob(ctx, cx, cy, s * 0.6, e / bD, "235,245,255", "120,170,255"); }
      if (e < 0.5) { const k = e / 0.5, sw = w * (0.4 + k * 0.9), g = ctx.createLinearGradient(cx - sw / 2, 0, cx + sw / 2, 0);   // code streak (the cell clips it)
        g.addColorStop(0, "rgba(140,190,255,0)"); g.addColorStop(0.5, `rgba(235,245,255,${0.9 * (1 - k)})`); g.addColorStop(1, "rgba(140,190,255,0)");
        ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g; ctx.fillRect(cx - sw / 2, cy - (3 + 5 * (1 - k)), sw, 2 * (3 + 5 * (1 - k))); ctx.globalCompositeOperation = "source-over"; } }
    // 4) the flat shockwave ring
    if (e < P.ring.dur) { const k = e / P.ring.dur, ek = 1 - Math.pow(1 - k, 3), rx = L * P.ring.r * (0.15 + ek), ry = rx * P.ring.squash;
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = P.breach ? `rgba(170,210,255,${0.35 * (1 - k)})` : `rgba(255,190,120,${0.3 * (1 - k)})`; ctx.lineWidth = P.ring.width * 4 * (1 - k * 0.5);
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 6.29); ctx.stroke();
      ctx.strokeStyle = P.breach ? `rgba(235,245,255,${1 - k})` : `rgba(255,240,215,${1 - k})`; ctx.lineWidth = P.ring.width;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 6.29); ctx.stroke(); ctx.globalCompositeOperation = "source-over"; }
  }
  // 5) embers (additive, cooling) and debris specks
  ctx.globalCompositeOperation = "lighter";
  for (const p of parts) { if (!p.on || p.kind) continue; const k = p.t / p.life; ctx.fillStyle = `rgba(255,${(200 - 140 * k) | 0},${(90 - 80 * k) | 0},${1 - k})`; ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r); }
  ctx.globalCompositeOperation = "source-over";
  for (const p of parts) { if (!p.on || !p.kind) continue; const k = p.t / p.life; ctx.fillStyle = `rgba(120,110,105,${0.8 * (1 - k)})`; ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r); }
  // 6) one white (blue-white for a breach) flash over the whole view
  if (flashT > 0) { ctx.globalAlpha = 0.85 * flashT / flashDur; ctx.fillStyle = flashBlue ? "#e6f0ff" : "#fffaf0"; ctx.fillRect(0, 0, w, h); }
  ctx.restore();
}
// clear every death in flight (battle end, view change, new battle). newBattle also forgets the started set.
export function clearShipFx(newBattle = false) { deaths.clear(); for (const p of parts) p.on = false; hitStopUntil = 0; shakeT = 0; flashT = 0; if (newBattle) done.clear(); }
