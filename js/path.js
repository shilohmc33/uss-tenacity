import { DECKS, DECK_ORDER, COLS, ROWS } from "./data.js";
import { clamp, inRect } from "./util.js";
const inAny = (fx, fy, list) => list.some(r => inRect(fx, fy, r));
for (const d of DECK_ORDER) {
  const dk = DECKS[d], g = new Uint8Array(COLS * ROWS);
  for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
    const fx = (cx + 0.5) / COLS, fy = (cy + 0.5) / ROWS;
    g[cy * COLS + cx] = inAny(fx, fy, dk.base) && !inAny(fx, fy, dk.blocks) ? 1 : 0;
  }
  dk.walk = g;
}
export const cellOf = (fx, fy) => [clamp(Math.floor(fx * COLS), 0, COLS - 1), clamp(Math.floor(fy * ROWS), 0, ROWS - 1)];
export const cellCenter = (cx, cy) => [(cx + 0.5) / COLS, (cy + 0.5) / ROWS];
export function isWalkable(deck, fx, fy) { const c = cellOf(fx, fy); return !!DECKS[deck].walk[c[1] * COLS + c[0]]; }
export function nearestWalkable(deck, fx, fy) {
  const W = DECKS[deck].walk, c = cellOf(fx, fy);
  if (W[c[1] * COLS + c[0]]) return c;
  for (let rad = 1; rad < 14; rad++) for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
    const nx = c[0] + dx, ny = c[1] + dy;
    if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS && W[ny * COLS + nx]) return [nx, ny];
  }
  return c;
}
// A* (4-dir, binary-heap-free but small grid: 2400 cells)
export function findPath(deck, fx0, fy0, fx1, fy1) {
  const W = DECKS[deck].walk;
  const s = nearestWalkable(deck, fx0, fy0), g = nearestWalkable(deck, fx1, fy1);
  const si = s[1] * COLS + s[0], gi = g[1] * COLS + g[0];
  if (si === gi) return [];
  const N = COLS * ROWS, came = new Int32Array(N).fill(-1), gs = new Float32Array(N).fill(Infinity),
    fs = new Float32Array(N).fill(Infinity), closed = new Uint8Array(N), open = [si];
  gs[si] = 0; fs[si] = 0;
  const h = i => Math.abs(i % COLS - g[0]) + Math.abs(((i / COLS) | 0) - g[1]);
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (fs[open[i]] < fs[open[bi]]) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur === gi) {
      const path = []; let n = cur;
      while (n !== -1 && n !== si) { path.push(n); n = came[n]; }
      path.reverse();
      const pts = path.map(i => cellCenter(i % COLS, (i / COLS) | 0)), out = [];
      for (let p = 0; p < pts.length; p++) {
        if (p > 0 && p < pts.length - 1) {
          const a = out.length ? out[out.length - 1] : cellCenter(s[0], s[1]), b = pts[p], c2 = pts[p + 1];
          if ((b[0] - a[0]) * (c2[1] - b[1]) === (b[1] - a[1]) * (c2[0] - b[0])) continue;
        }
        out.push(pts[p]);
      }
      return out;
    }
    closed[cur] = 1;
    const cx = cur % COLS, cy = (cur / COLS) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const ni = ny * COLS + nx;
      if (!W[ni] || closed[ni]) continue;
      const ng = gs[cur] + 1;
      if (ng < gs[ni]) { gs[ni] = ng; fs[ni] = ng + h(ni); came[ni] = cur; if (!open.includes(ni)) open.push(ni); }
    }
  }
  return null;
}
