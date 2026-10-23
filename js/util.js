export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const inRect = (fx, fy, r) => fx >= r[0] && fx <= r[2] && fy >= r[1] && fy <= r[3];
// distance in 960x640 design px
export const dDist = (x1, y1, x2, y2) => Math.hypot((x1 - x2) * 960, (y1 - y2) * 640);
// P31 / E1: a number from a save or a stat, or d when it is junk (NaN, a string, null, an object); then clamped to lo..hi
export const numIn = (v, lo, hi, d = lo) => (typeof v === "number" && Number.isFinite(v) ? (v < lo ? lo : v > hi ? hi : v) : d);
