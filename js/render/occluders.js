// Pass 18 (3a): per-prop foreground occluders in the deck y-sort. data.js DECK_OCCL[deck] = { src, items: [{ id, box | poly | polys,
// baseY, seats? }] } in design px (960x640). Each item is cut ONCE (first draw after its source image loads) from its source
// (the deck plate by default, or a plate-aligned fg layer such as fg-bridge) into an offscreen canvas at the source's own
// resolution, clipped to its polygon (crop: true items use a per-prop cutout image sized to the box instead). Every frame the items join the character cast as entries sorted at baseY (the prop's
// footprint line on the floor): figures whose feet are above it draw first and the prop covers them; figures below it draw
// over the prop. An item is only drawn when a figure behind it overlaps its box (or someone sits in one of its seats), so
// an empty room costs nothing and the plate shows through unchanged.
import { DECK_OCCL, DW, DH, FIG_H } from "../data.js";
import { IMG } from "../assets.js";
const cache = {};   // deck -> [{ ...item, box, cv }]
export const OCCL_STATS = { built: 0, buildMs: 0, frames: 0, draws: 0, ms: 0 };   // tools: cost per frame = ms / frames
export const occlDrawn = [];   // ids drawn in the last frame (tools)
const polysOf = it => it.polys || (it.poly ? [it.poly] : null);
export function occluderBox(it) {
  if (it.box) return it.box;
  const pts = polysOf(it).flat(), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return [Math.floor(Math.min(...xs)), Math.floor(Math.min(...ys)), Math.ceil(Math.max(...xs)), Math.ceil(Math.max(...ys))];
}
function build(deck) {
  const T = DECK_OCCL[deck]; if (!T) return [];
  const srcOf = it => IMG[it.src || T.src || "deck-" + deck];
  if (T.items.some(it => { const im = srcOf(it); return !im || !im.width; })) return null;   // not loaded yet: try again next frame
  const t0 = performance.now(), out = [];
  for (const it of T.items) {
    const src = srcOf(it), box = occluderBox(it), [x0, y0, x1, y1] = box;
    // crop: the source is already the prop's own cutout for exactly this box (any resolution), not a plate-aligned layer
    const sx = it.crop ? src.width / (x1 - x0) : src.width / DW, sy = it.crop ? src.height / (y1 - y0) : src.height / DH;
    const w = Math.max(1, Math.round((x1 - x0) * sx)), h = Math.max(1, Math.round((y1 - y0) * sy));
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const c = cv.getContext("2d");
    const P = polysOf(it);
    if (P) { c.beginPath(); for (const poly of P) { poly.forEach(([x, y], i) => i ? c.lineTo((x - x0) * sx, (y - y0) * sy) : c.moveTo((x - x0) * sx, (y - y0) * sy)); c.closePath(); } c.clip(); }
    c.drawImage(src, it.crop ? 0 : x0 * sx, it.crop ? 0 : y0 * sy, w, h, 0, 0, w, h);
    // crop items with polys: box = the cutout's frame, hit = the polygons' bounds (a strip of a shared cutout only answers for its own part)
    const hit = it.box && P ? occluderBox({ polys: P }) : box;
    out.push({ ...it, box, hit, cv });
  }
  OCCL_STATS.built += out.length; OCCL_STATS.buildMs += performance.now() - t0;
  return out;
}
export function occluders(deck) { if (!cache[deck]) { const b = build(deck); if (b) cache[deck] = b; } return cache[deck] || []; }
// a cast entry's on-screen body in design px: standing ~38 x FIG_H above the feet; seated / lying entries pass their own
function bodyOf(c) { return c.body || [c.x * DW - 19, c.y * DH - FIG_H, c.x * DW + 19, c.y * DH]; }
// cast entries for this deck's occluders (call after the characters are in the cast, before sorting)
export function occluderCast(ctx, deck, cast) {
  OCCL_STATS.frames++; occlDrawn.length = 0;
  const L = occluders(deck); if (!L.length) return [];
  const people = cast.slice();
  return L.map(o => ({ y: o.baseY / DH, x: (o.box[0] + o.box[2]) / 2 / DW, id: "~occl:" + o.id, occl: true, draw: () => drawOccl(ctx, o, people) }));
}
function drawOccl(ctx, o, people) {
  const t0 = performance.now(), [x0, y0, x1, y1] = o.box, [hx0, hy0, hx1, hy1] = o.hit;
  const hit = people.some(c => (c.seat && o.seats && o.seats.includes(c.seat)) ||
    (!c.seat && c.y * DH < o.baseY && (() => { const b = bodyOf(c); return b[2] > hx0 && b[0] < hx1 && b[3] > hy0 && b[1] < hy1; })()));
  if (hit) {
    const a = o.alpha == null ? 1 : o.alpha; if (a < 1) { ctx.save(); ctx.globalAlpha *= a; }   // per-item opacity (e.g. a glass pane cut from an opaque plate)
    ctx.drawImage(o.cv, x0, y0, x1 - x0, y1 - y0); if (a < 1) ctx.restore();
    OCCL_STATS.draws++; occlDrawn.push(o.id);
  }
  OCCL_STATS.ms += performance.now() - t0;
}
