// Sliding doors (data: js/doors-data.js DECK_DOORS). Each door: state closed / opening / open / closing and a linear
// progress p (0..1) eased with easeInOutCubic into the drawn open fraction. Opens while any crew feet are within the
// trigger radius (design px); closes once nobody has been inside for timing.delay. Drawn right after the plate (under
// every figure and fg-bridge): each panel offset by slide x open fraction, clipped to the doorway polygon.
// Cheap: state objects and clip Path2Ds are built once per deck; update/draw allocate nothing per frame.
import { DECK_DOORS } from "../doors-data.js";
import { DW, DH } from "../data.js";
import { IMG } from "../assets.js";

const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const ST = {};   // deck -> [{ d, p, state, away, clip }]
let lastDeck = null;
function doorsOf(deck) {
  if (ST[deck] !== undefined) return ST[deck];
  const L = DECK_DOORS[deck];
  if (!L || typeof Path2D === "undefined") return (ST[deck] = null);
  return (ST[deck] = L.map(d => { const clip = new Path2D(); d.clip.forEach(([x, y], i) => i ? clip.lineTo(x, y) : clip.moveTo(x, y)); clip.closePath();
    return { d, p: 0, state: "closed", away: 1e9, clip }; }));
}
// feet: an array of { x, y } in deck fractions (0..1 of DW / DH); n = how many to read (no slicing)
export function updateDoors(deck, dt, feet, n = feet.length) {
  const S = doorsOf(deck); if (!S) return;
  const snap = deck !== lastDeck; lastDeck = deck;   // arriving on a deck: doors take their state at once, no slide
  for (const s of S) {
    const { c, r } = s.d.trigger, T = s.d.timing; let inside = false;
    for (let i = 0; i < n && !inside; i++) { const f = feet[i], dx = f.x * DW - c[0], dy = f.y * DH - c[1]; inside = dx * dx + dy * dy <= r * r; }
    s.away = inside ? 0 : s.away + dt;
    const want = inside || s.away < T.delay;
    if (snap) { s.p = want ? 1 : 0; s.state = want ? "open" : "closed"; continue; }
    if (want && s.p < 1) { s.p = Math.min(1, s.p + dt / T.open); s.state = s.p >= 1 ? "open" : "opening"; }
    else if (!want && s.p > 0) { s.p = Math.max(0, s.p - dt / T.close); s.state = s.p <= 0 ? "closed" : "closing"; }
  }
}
export function drawDoors(ctx, deck) {
  const S = doorsOf(deck); if (!S) return;
  for (const s of S) {
    const k = ease(s.p);
    ctx.save(); ctx.clip(s.clip);
    for (const pn of s.d.panels) { const im = IMG[pn.img]; if (!im) continue; const [x0, y0, x1, y1] = pn.rect;
      ctx.drawImage(im, x0 + pn.slide[0] * k, y0 + pn.slide[1] * k, x1 - x0, y1 - y0); }
    ctx.restore();
  }
}
// tests / debug: [{ id, state, p, open }]
export const doorState = deck => (doorsOf(deck) || []).map(s => ({ id: s.d.id, state: s.state, p: +s.p.toFixed(3), open: +ease(s.p).toFixed(3) }));
