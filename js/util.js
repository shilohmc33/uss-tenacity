export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const inRect = (fx, fy, r) => fx >= r[0] && fx <= r[2] && fy >= r[1] && fy <= r[3];
// distance in 960x640 design px
export const dDist = (x1, y1, x2, y2) => Math.hypot((x1 - x2) * 960, (y1 - y2) * 640);
// P31 / E1: a number from a save or a stat, or d when it is junk (NaN, a string, null, an object); then clamped to lo..hi
export const numIn = (v, lo, hi, d = lo) => (typeof v === "number" && Number.isFinite(v) ? (v < lo ? lo : v > hi ? hi : v) : d);
// Real local calendar days (Oct 26 batch A): "YYYY-MM-DD" keys for cooldowns that read "N days" to the player. Stored as an
// UNTIL date (active while today < until); writers keep the later of old and new, so a clock moved back never shortens one.
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const isDay = s => typeof s === "string" && /^\d{4}-\d\d-\d\d$/.test(s);
export const addDays = (s, n) => { const [y, m, d] = s.split("-").map(Number); return dayKey(new Date(y, m - 1, d + n)); };
export const laterDay = (a, b) => (isDay(a) ? a : "") > (isDay(b) ? b : "") ? a : (isDay(b) ? b : "");
export const dayActive = (until, at = new Date()) => isDay(until) && dayKey(at) < until;
export const daysUntil = (until, at = new Date()) => dayActive(until, at) ? Math.round((new Date(until + "T00:00:00") - new Date(dayKey(at) + "T00:00:00")) / 864e5) : 0;
// an old ship-time end (seconds of play, `end` vs `now`) as an until date: the play days left, at most `cap` real days
export const shipToDay = (end, now, dayLen, cap) => { const left = end - now; return Number.isFinite(left) && left > 0 ? addDays(dayKey(), Math.min(cap, Math.max(1, Math.ceil(left / dayLen)))) : undefined; };
