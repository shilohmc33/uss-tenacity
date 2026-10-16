export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const inRect = (fx, fy, r) => fx >= r[0] && fx <= r[2] && fy >= r[1] && fy <= r[3];
// distance in 960x640 design px
export const dDist = (x1, y1, x2, y2) => Math.hypot((x1 - x2) * 960, (y1 - y2) * 640);
