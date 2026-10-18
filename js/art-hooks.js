// Art hooks (pass 08): lying sprites, seated frames and the tint-ready crew base. Data lives in data.js (LIE_ART,
// SEAT_ART, TINT_BASES, node.seat); this module answers "is that art here?" and builds the department-tinted sheets.
import { LIE_ART, SEAT_ART, TINT_BASES, NODEMAP, LT2_STAND_H, FIG_H } from "./data.js";
import { IMG } from "./assets.js";

export const ART_SCALE = FIG_H / LT2_STAND_H;   // every v3-format cell: 252 px of standing height -> 134 design px
// lying art for a character ("lt") or a patient (uniform tint): { img, w, h, ax, ay, frames } or null
export function lieArt(who, tint) {
  for (const k of who === "patient" ? ["patient-" + (tint || "red"), "patient"] : [who]) {
    const a = LIE_ART[k], im = a && IMG[a.img];
    if (im) return { im, w: 384, h: 160, ax: a.ax ?? 192, ay: a.ay ?? 80, frames: im.width >= 768 ? 2 : 1 };
  }
  return null;
}
// seated art: { im, ax, ay, talk } or null
export function seatArt(who) {
  const a = SEAT_ART[who], im = a && IMG[a.img];
  return im ? { im, ax: a.ax ?? 80, ay: a.ay ?? 300, talk: !!a.talk && im.height >= 384 * 4 } : null;
}
export const SEAT_COLS = { up: 0, down: 1 };
// the tint-ready base sheet for a crewmember with this pronoun, if its art is loaded: the CHAR_SHEETS key, else null
export function tintBaseFor(pronoun) {
  for (const [k, b] of Object.entries(TINT_BASES)) if ((!b.pronoun || b.pronoun === pronoun) && IMG[b.img]) return k;
  return null;
}
export const isTintBase = who => !!TINT_BASES[who];
// department colour multiplied into the mid-grey uniform: built once per (sheet, colour) on first draw, then cached
const TINTED = new Map();
export function tintedSheet(img, color) {
  const key = img + "|" + color; if (TINTED.has(key)) return TINTED.get(key);
  const im = IMG[img]; if (!im) return null;
  const base = Object.values(TINT_BASES).find(b => b.img === img), mask = base && base.mask ? IMG[base.mask] : null;
  const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
  const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  let m = null;
  if (mask) { const mc = document.createElement("canvas"); mc.width = c.width; mc.height = c.height; const mx = mc.getContext("2d", { willReadFrequently: true }); mx.drawImage(mask, 0, 0, c.width, c.height); m = mx.getImageData(0, 0, c.width, c.height).data; }
  const tr = parseInt(color.slice(1, 3), 16) / 255, tg = parseInt(color.slice(3, 5), 16) / 255, tb = parseInt(color.slice(5, 7), 16) / 255;
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    const r = p[i] / 255, g = p[i + 1] / 255, b = p[i + 2] / 255, mxv = Math.max(r, g, b), mnv = Math.min(r, g, b), lum = (r + g + b) / 3;
    let w;
    if (m) w = m[i] / 255;
    else { const sat = mxv > 0 ? (mxv - mnv) / mxv : 0; w = sat < 0.12 && lum > 0.28 && lum < 0.82 ? Math.min(1, (0.12 - sat) / 0.04) : 0; }
    if (!w) continue;
    const k = lum / 0.5;   // mid-grey (0.5) -> exactly the department colour; folds keep their shading
    p[i] = Math.round(255 * ((1 - w) * r + w * Math.min(1, tr * k)));
    p[i + 1] = Math.round(255 * ((1 - w) * g + w * Math.min(1, tg * k)));
    p[i + 2] = Math.round(255 * ((1 - w) * b + w * Math.min(1, tb * k)));
  }
  x.putImageData(d, 0, 0);
  TINTED.set(key, c); return c;
}
// After preload: nodes with a seat move the Lt's stand spot to the seat once seated art for him is loaded.
export function applyArtHooks() {
  const on = [];
  if (seatArt("lt")) for (const n of Object.values(NODEMAP)) if (n.seat && n.seat.stand) {
    if (!n.standInterim) n.standInterim = { x: n.x, y: n.y, face: n.face };
    n.x = n.seat.stand[0]; n.y = n.seat.stand[1]; n.face = n.seat.face || n.face; on.push(n.id);
  }
  return on;
}
