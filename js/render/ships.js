// Battle groundwork: ship drawing. drawShip() uses the artist's sheet when SHIP_ART[sprite].img is loaded (format: data.js
// SHIP_SHEET, notes/ship-sprite-spec.md) and otherwise a clean vector placeholder per class in faction colours.
// Every ship is authored FACING RIGHT inside its box (x, y, w, h); mirror = true flips it to face left (the enemy side).
import { SHIP_ART, SHIP_SHEET } from "../data.js";
import { IMG } from "../assets.js";
import { SHIPS, FACTIONS } from "../ships.js";

export const shipArt = sprite => { const a = SHIP_ART[sprite], im = a && a.img ? IMG[a.img] : null; return im ? { a, im } : null; };
// the sheet's rows with any per-ship overrides; index = row on the sheet
export function sheetRows(a) { return SHIP_SHEET.rows.map(r => ({ ...r, ...((a && a.rows && a.rows[r.state]) || {}) })); }
// which state / frame a ship shows: anim = { state, t } (a one-shot started t seconds ago) from battle.js SFX.anim
export function shipState(anim, pct, dying) {
  if (dying) return { state: "explode", t: anim && anim.state === "explode" ? anim.t : 0 };
  if (anim && anim.state && anim.state !== "explode") { const r = SHIP_SHEET.rows.find(x => x.state === anim.state); if (r && anim.t < r.frames / r.fps) return anim; }
  return { state: pct < 35 ? "damaged" : "idle", t: null };
}
function drawSheet(ctx, art, st, t, w, h) {
  const { a, im } = art, rows = sheetRows(a), [cw, chh] = SHIP_SHEET.cell, [px, py] = a.pivot || SHIP_SHEET.pivot;
  const k = w / (a.len || SHIP_SHEET.len), have = i => im.height >= (i + 1) * chh;
  let ri = rows.findIndex(r => r.state === st.state); if (ri < 0 || !have(ri)) ri = 0;   // a state the sheet doesn't have: idle
  const frameOf = (r, tt) => { const n = Math.max(1, Math.min(r.frames, Math.floor(im.width / cw))); return r.loop ? Math.floor(tt * r.fps) % n : Math.min(n - 1, Math.floor(tt * r.fps)); };
  const r = rows[ri], f = frameOf(r, st.t != null ? st.t : t);
  const dx = w / 2 - px * k, dy = h / 2 - py * k;
  ctx.drawImage(im, f * cw, ri * chh, cw, chh, dx, dy, cw * k, chh * k);
  const ei = rows.findIndex(x => x.state === "engine");
  if (a.engine !== false && ei >= 0 && have(ei)) { const er = rows[ei]; ctx.save(); ctx.globalCompositeOperation = er.blend || "lighter"; ctx.drawImage(im, frameOf(er, t) * cw, ei * chh, cw, chh, dx, dy, cw * k, chh * k); ctx.restore(); }
  return { frame: f, row: ri, state: r.state };
}
// ---- vector placeholders: unit-box polygons (0..1 of w and h), facing right ----
const poly = (ctx, w, h, pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)); ctx.closePath(); };
const ell = (ctx, w, h, cx, cy, rx, ry, a0 = 0, a1 = Math.PI * 2) => { ctx.beginPath(); ctx.ellipse(cx * w, cy * h, rx * w, ry * h, 0, a0, a1); };
const rrect = (ctx, w, h, x0, y0, x1, y1, r) => { ctx.beginPath(); ctx.roundRect(x0 * w, y0 * h, (x1 - x0) * w, (y1 - y0) * h, r * h); };
function fillStroke(ctx, fill, stroke, lw) { ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } }
const glowDot = (ctx, x, y, r, col, a) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.35, hexA(col, a)); g.addColorStop(1, hexA(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.29); ctx.fill(); };
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
const VECTOR = {
  tenacity(ctx, w, h, F, pulse) {   // Miranda: saucer, roll bar, two nacelles slung below and aft
    const lw = Math.max(1, h * 0.025);
    poly(ctx, w, h, [[0.44, 0.40], [0.40, 0.42], [0.31, 0.70], [0.38, 0.70], [0.50, 0.46]]); fillStroke(ctx, F.shade, null);   // pylons
    poly(ctx, w, h, [[0.54, 0.44], [0.50, 0.46], [0.43, 0.70], [0.50, 0.70], [0.60, 0.46]]); fillStroke(ctx, F.shade, null);
    rrect(ctx, w, h, 0.03, 0.66, 0.52, 0.86, 0.1); fillStroke(ctx, F.hull, F.shade, lw);                                     // nacelle
    rrect(ctx, w, h, 0.06, 0.725, 0.47, 0.795, 0.035); ctx.fillStyle = hexA(F.glow, 0.55 + 0.35 * pulse); ctx.fill();         // nacelle grille
    glowDot(ctx, 0.515 * w, 0.76 * h, h * 0.11, "#ff6a4a", 0.7 + 0.3 * pulse);                                               // bussard
    poly(ctx, w, h, [[0.28, 0.30], [0.42, 0.28], [0.44, 0.52], [0.30, 0.50]]); fillStroke(ctx, F.shade, null);                // aft hull
    rrect(ctx, w, h, 0.40, 0.04, 0.68, 0.13, 0.04); fillStroke(ctx, F.hull, F.shade, lw);                                     // roll bar
    rrect(ctx, w, h, 0.45, 0.10, 0.475, 0.30, 0); ctx.fillStyle = F.shade; ctx.fill(); rrect(ctx, w, h, 0.60, 0.10, 0.625, 0.30, 0); ctx.fill();
    ell(ctx, w, h, 0.66, 0.40, 0.32, 0.14); fillStroke(ctx, F.hull, F.shade, lw);                                             // saucer
    ell(ctx, w, h, 0.66, 0.42, 0.32, 0.10, 0, Math.PI); fillStroke(ctx, F.shade, null);                                       // underside
    ell(ctx, w, h, 0.64, 0.27, 0.08, 0.08, Math.PI, 0); fillStroke(ctx, F.hull, F.shade, lw);                                // bridge dome
    ctx.strokeStyle = F.trim; ctx.lineWidth = Math.max(1, h * 0.03); ctx.beginPath(); ctx.moveTo(0.40 * w, 0.37 * h); ctx.lineTo(0.94 * w, 0.37 * h); ctx.stroke();   // registry stripe
  },
  freighter(ctx, w, h, F, pulse) {   // boxy spine, a row of cargo pods, bridge forward, engine block aft
    const lw = Math.max(1, h * 0.02);
    rrect(ctx, w, h, 0.10, 0.42, 0.88, 0.58, 0.05); fillStroke(ctx, F.shade, null);
    for (let i = 0; i < 5; i++) { const x = 0.17 + i * 0.13; rrect(ctx, w, h, x, 0.22, x + 0.11, 0.78, 0.06); fillStroke(ctx, F.hull, F.shade, lw); ctx.fillStyle = F.trim; ctx.fillRect((x + 0.005) * w, 0.46 * h, 0.1 * w, 0.08 * h); }
    poly(ctx, w, h, [[0.86, 0.28], [0.98, 0.40], [0.98, 0.60], [0.86, 0.68]]); fillStroke(ctx, F.hull, F.shade, lw);
    ctx.fillStyle = hexA(F.glow, 0.9); ctx.fillRect(0.92 * w, 0.41 * h, 0.03 * w, 0.06 * h);
    rrect(ctx, w, h, 0.02, 0.30, 0.14, 0.70, 0.08); fillStroke(ctx, F.hull, F.shade, lw);
    glowDot(ctx, 0.02 * w, 0.5 * h, h * 0.22, F.glow, 0.55 + 0.35 * pulse);
  },
  klingon_bop(ctx, w, h, F, pulse) {   // head on a long neck, wings swept down, disruptors at the tips
    const lw = Math.max(1, h * 0.02);
    poly(ctx, w, h, [[0.36, 0.40], [0.56, 0.42], [0.62, 0.86], [0.54, 0.88], [0.40, 0.52]]); fillStroke(ctx, F.shade, null);    // far wing
    poly(ctx, w, h, [[0.30, 0.36], [0.52, 0.40], [0.74, 0.94], [0.64, 0.97], [0.36, 0.56]]); fillStroke(ctx, F.hull, F.shade, lw);   // near wing
    ctx.fillStyle = F.trim; poly(ctx, w, h, [[0.40, 0.48], [0.52, 0.47], [0.66, 0.86], [0.62, 0.88]]); ctx.fill();
    rrect(ctx, w, h, 0.64, 0.92, 0.80, 0.98, 0.02); ctx.fillStyle = F.shade; ctx.fill();                                      // wingtip cannon
    ell(ctx, w, h, 0.36, 0.42, 0.18, 0.17); fillStroke(ctx, F.hull, F.shade, lw);                                             // body
    poly(ctx, w, h, [[0.50, 0.36], [0.80, 0.33], [0.80, 0.45], [0.50, 0.50]]); fillStroke(ctx, F.hull, F.shade, lw);          // neck
    poly(ctx, w, h, [[0.78, 0.26], [0.99, 0.34], [0.97, 0.48], [0.78, 0.52]]); fillStroke(ctx, F.hull, F.shade, lw);          // head
    ctx.fillStyle = hexA(F.glow, 0.8); ctx.fillRect(0.90 * w, 0.37 * h, 0.05 * w, 0.04 * h);
    poly(ctx, w, h, [[0.04, 0.40], [0.22, 0.32], [0.22, 0.52]]); fillStroke(ctx, F.shade, null);                              // tail
    glowDot(ctx, 0.2 * w, 0.42 * h, h * 0.14, F.glow, 0.5 + 0.4 * pulse);
  },
  jh_fighter(ctx, w, h, F, pulse) {   // beetle hull, forward pincers above and below, deflector glow amidships
    const lw = Math.max(1, h * 0.025);
    poly(ctx, w, h, [[0.60, 0.30], [0.99, 0.12], [0.92, 0.28], [0.72, 0.38]]); fillStroke(ctx, F.shade, F.trim, lw);
    poly(ctx, w, h, [[0.60, 0.70], [0.99, 0.88], [0.92, 0.72], [0.72, 0.62]]); fillStroke(ctx, F.shade, F.trim, lw);
    poly(ctx, w, h, [[0.06, 0.50], [0.26, 0.28], [0.68, 0.26], [0.90, 0.50], [0.68, 0.74], [0.26, 0.72]]); fillStroke(ctx, F.hull, F.shade, lw);
    poly(ctx, w, h, [[0.06, 0.50], [0.90, 0.50], [0.68, 0.74], [0.26, 0.72]]); ctx.fillStyle = F.shade; ctx.globalAlpha = 0.6; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = F.trim; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(0.22 * w, 0.40 * h); ctx.lineTo(0.70 * w, 0.38 * h); ctx.stroke();
    ell(ctx, w, h, 0.52, 0.50, 0.12, 0.09); ctx.fillStyle = hexA(F.glow, 0.55 + 0.4 * pulse); ctx.fill();                     // deflector
    glowDot(ctx, 0.07 * w, 0.5 * h, h * 0.2, F.glow, 0.5 + 0.4 * pulse);
  },
  galor(ctx, w, h, F, pulse) {   // long tail spine, mid bulb, the broad forward 'hood'
    const lw = Math.max(1, h * 0.02);
    poly(ctx, w, h, [[0.02, 0.46], [0.52, 0.38], [0.52, 0.62], [0.02, 0.54]]); fillStroke(ctx, F.shade, F.hull, lw);
    poly(ctx, w, h, [[0.50, 0.16], [0.78, 0.06], [0.99, 0.38], [0.99, 0.62], [0.78, 0.94], [0.50, 0.84], [0.60, 0.50]]); fillStroke(ctx, F.hull, F.shade, lw);
    poly(ctx, w, h, [[0.60, 0.50], [0.99, 0.50], [0.99, 0.62], [0.78, 0.94], [0.50, 0.84]]); ctx.fillStyle = F.shade; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = F.trim; ctx.lineWidth = lw * 1.4; ctx.beginPath(); ctx.moveTo(0.62 * w, 0.20 * h); ctx.lineTo(0.90 * w, 0.42 * h); ctx.moveTo(0.62 * w, 0.80 * h); ctx.lineTo(0.90 * w, 0.58 * h); ctx.stroke();
    ell(ctx, w, h, 0.46, 0.50, 0.10, 0.17); fillStroke(ctx, F.hull, F.shade, lw);
    glowDot(ctx, 0.95 * w, 0.5 * h, h * 0.16, F.glow, 0.6 + 0.35 * pulse);                                                   // forward emitter
    glowDot(ctx, 0.03 * w, 0.5 * h, h * 0.14, F.glow, 0.45 + 0.35 * pulse);
  },
  jh_battlecruiser(ctx, w, h, F, pulse) {   // broad armoured hull, swept forward claws, a long deflector band
    const lw = Math.max(1, h * 0.02);
    poly(ctx, w, h, [[0.52, 0.22], [0.98, 0.04], [0.90, 0.22], [0.70, 0.32]]); fillStroke(ctx, F.shade, F.trim, lw);
    poly(ctx, w, h, [[0.52, 0.78], [0.98, 0.96], [0.90, 0.78], [0.70, 0.68]]); fillStroke(ctx, F.shade, F.trim, lw);
    poly(ctx, w, h, [[0.03, 0.44], [0.22, 0.20], [0.64, 0.16], [0.90, 0.32], [1.0, 0.50], [0.90, 0.68], [0.64, 0.84], [0.22, 0.80], [0.03, 0.56]]); fillStroke(ctx, F.hull, F.shade, lw);
    poly(ctx, w, h, [[0.03, 0.50], [1.0, 0.50], [0.90, 0.68], [0.64, 0.84], [0.22, 0.80], [0.03, 0.56]]); ctx.fillStyle = F.shade; ctx.globalAlpha = 0.6; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = F.trim; ctx.lineWidth = lw; for (const y of [0.30, 0.70]) { ctx.beginPath(); ctx.moveTo(0.2 * w, y * h); ctx.lineTo(0.8 * w, (y + (y < 0.5 ? 0.04 : -0.04)) * h); ctx.stroke(); }
    rrect(ctx, w, h, 0.28, 0.46, 0.86, 0.54, 0.04); ctx.fillStyle = hexA(F.glow, 0.5 + 0.4 * pulse); ctx.fill();               // deflector band
    for (const y of [0.38, 0.62]) glowDot(ctx, 0.05 * w, y * h, h * 0.12, F.glow, 0.45 + 0.35 * pulse);
  },
};
function drawVector(ctx, d, w, h, t, pct) {
  const F = FACTIONS[d.faction] || FACTIONS.starfleet, pulse = 0.5 + 0.5 * Math.sin(t * 3.1);
  (VECTOR[d.sprite] || VECTOR.galor)(ctx, w, h, F, pulse);
  if (pct < 35) {   // damaged: scorch and a flicker
    ctx.save(); ctx.globalCompositeOperation = "source-atop";
    for (const [x, y, r] of [[0.35, 0.45, 0.22], [0.62, 0.38, 0.18], [0.5, 0.6, 0.15]]) { const g = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * h * 1.6); g.addColorStop(0, "rgba(20,12,8,0.75)"); g.addColorStop(1, "rgba(20,12,8,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
    ctx.restore();
  }
}
// Placeholder rim (phone tidy-up): the vector ship is drawn once into an offscreen canvas at device resolution, then
// stamped with a soft glow in its faction colour, so a dark hull (the Cardassian khaki, the Klingon hull) still reads
// against the DS9 / planet backdrops. One shadowed drawImage = a clean outline, not a halo per shape.
let VC = null;
function drawVectorRim(ctx, d, w, h, t, pct) {
  const F = FACTIONS[d.faction] || FACTIONS.starfleet, m = ctx.getTransform(), sc = Math.max(1, Math.min(4, Math.hypot(m.a, m.b) || 1));
  const px = w * 0.1, py = h * 0.2, cw = Math.ceil((w + 2 * px) * sc), ch = Math.ceil((h + 2 * py) * sc);
  if (typeof document === "undefined" || cw > 4096 || ch > 4096) { drawVector(ctx, d, w, h, t, pct); return; }
  if (!VC) VC = document.createElement("canvas");
  if (VC.width < cw || VC.height < ch) { VC.width = Math.max(VC.width, cw); VC.height = Math.max(VC.height, ch); }
  const o = VC.getContext("2d"); o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, cw, ch); o.setTransform(sc, 0, 0, sc, px * sc, py * sc);
  drawVector(o, d, w, h, t, pct);
  ctx.save(); ctx.shadowColor = hexA(F.glow, 0.85); ctx.shadowBlur = Math.max(4, Math.min(12, h * sc * 0.1));
  ctx.drawImage(VC, 0, 0, cw, ch, -px, -py, w + 2 * px, h + 2 * py); ctx.restore();
}
// Draw one ship into its box. opts: { mirror, t (seconds, for loops), pct (hull %), anim ({ state, t }), dying, alpha }.
// Returns what was drawn ({ art: true, state, frame } or { art: false }) for tests.
export function drawShip(ctx, shipId, x, y, w, h, opts = {}) {
  const d = SHIPS[shipId]; if (!d || !(w > 0) || !(h > 0)) return null;
  const pct = opts.pct ?? 100, art = shipArt(d.sprite);
  ctx.save(); ctx.translate(x, y); if (opts.mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  let res;
  if (art) res = { art: true, ...drawSheet(ctx, art, shipState(opts.anim, pct, opts.dying), opts.t || 0, w, h) };
  else { ctx.beginPath(); ctx.rect(-w * 0.1, -h * 0.2, w * 1.2, h * 1.4); ctx.clip(); drawVectorRim(ctx, d, w, h, opts.t || 0, pct); res = { art: false, state: shipState(opts.anim, pct, opts.dying).state }; }
  ctx.restore();
  return res;
}
// Name label under (or over) a ship box: the ship's name over its class, in the faction's label colour, on a dark pill.
export function drawShipLabel(ctx, shipId, cx, y, opts = {}) {
  const d = SHIPS[shipId]; if (!d) return;
  const F = FACTIONS[d.faction] || FACTIONS.starfleet, big = opts.big ?? 13, small = Math.round(big * 0.8);
  ctx.save(); if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  ctx.font = `bold ${big}px Antonio, sans-serif`; const w1 = ctx.measureText(d.name).width; ctx.font = `${small}px Antonio, sans-serif`; const w2 = ctx.measureText(d.cls).width;
  const bw = Math.max(w1, w2) + 14, bh = big + small + 9, x0 = Math.round(cx - bw / 2), y0 = Math.round(opts.above ? y - bh : y);
  ctx.fillStyle = "rgba(4,7,14,0.72)"; ctx.beginPath(); ctx.roundRect(x0, y0, bw, bh, 6); ctx.fill();
  ctx.fillStyle = F.trim; ctx.fillRect(x0, y0 + 4, 2.5, bh - 8);
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.fillStyle = F.label; ctx.font = `bold ${big}px Antonio, sans-serif`; ctx.fillText(d.name, cx, y0 + 3);
  ctx.fillStyle = "rgba(220,228,240,0.78)"; ctx.font = `${small}px Antonio, sans-serif`; ctx.fillText(d.cls, cx, y0 + 4 + big);
  ctx.restore();
  return { x: x0, y: y0, w: bw, h: bh };
}
