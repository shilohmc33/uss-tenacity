// Oct 26 R2 + B1: BAD CLOCK / re-sync mode. When the wall clock is more than BAD_CLOCK_DAYS past maxSeen (the latest real
// time ever seen on watch; only moves forward), the new time is not trusted yet: gameplay continues, but nothing is granted
// from it (no away XP / happenings, no rested window, no holodeck booking, no counselor, no vignette bonus, no play day)
// and none of its dates are stored (maxSeen, lastSeen, savedAt, slot and cooldown dates stay as they were).
// ACCEPTANCE (B1: an honest month-plus absence must not lock the save): the new time is accepted, with no prompt, once the
// clock has been seen CONSISTENT for at least ACCEPT_S of real time:
//   - within one session: the monotonic clock (performance.now) shows >= 1 h elapsed since the first bad reading of this
//     session, and the wall clock moved by the same amount within +-DRIFT_S (5 min);
//   - across loads / sessions: a stored candidate { wall, off } (the first bad reading and its offset from maxSeen) and a
//     later reading 1 h .. BAD_CLOCK_DAYS after it (never earlier). A reading earlier than the candidate or further than that
//     replaces the candidate (the clock jumped again), and 0 .. 1 h keeps waiting.
// On acceptance: the gap from the old maxSeen pays at most ONE normal absence (main.js: <= 3 happenings, 24 XP cap, one
// rested window), maxSeen = now, the candidate is cleared, and normal date handling resumes. A clock moved BACK is never bad
// (stored dates just stay used). While the clock is back within BAD_CLOCK_DAYS of maxSeen the mode is off and the candidate
// is dropped. A clock trip therefore has to hold its new time for an hour of real time before it pays, and then pays one
// normal absence, with its dates staying used after the trip back (borrowed, not gained).
import { G } from "./state.js";
import { log } from "./bus.js";
export const BAD_CLOCK_DAYS = 30, ACCEPT_S = 3600, DRIFT_S = 300;
const BAD_MS = BAD_CLOCK_DAYS * 864e5;
export const badClock = (now = Date.now()) => { const ms = +(G.prog && G.prog.maxSeen) || 0; return ms > 0 && now > ms + BAD_MS; };
export const BAD_CLOCK_WHY = "re-syncing ship's chronometer";
export const clockHooks = { accept: null };   // main.js: pays the one absence
const RT = { perf0: null, wall0: null, told: 0 };
const cand = () => G.prog && G.prog.clockCand;
// call on boot, on a return to the tab and about once a minute; returns "ok" | "wait" | "accepted"
export function clockCheck(now = Date.now(), perf = (typeof performance !== "undefined" ? performance.now() : 0)) {
  const p = G.prog; if (!p) return "ok";
  if (!badClock(now)) { if (p.clockCand) delete p.clockCand; RT.perf0 = RT.wall0 = null; return "ok"; }
  let ok = false;
  const c = cand();
  if (c && Number.isFinite(c.wall)) { const el = now - c.wall; if (el >= ACCEPT_S * 1e3 && el <= BAD_MS) ok = true; else if (el < 0 || el > BAD_MS) p.clockCand = null; }
  if (!ok && RT.perf0 != null) { const pe = perf - RT.perf0, we = now - RT.wall0; if (pe >= ACCEPT_S * 1e3 && Math.abs(we - pe) <= DRIFT_S * 1e3) ok = true; else if (Math.abs(we - pe) > DRIFT_S * 1e3) { RT.perf0 = perf; RT.wall0 = now; } }
  if (!cand()) p.clockCand = { wall: now, off: now - (+p.maxSeen || 0) };
  if (RT.perf0 == null) { RT.perf0 = perf; RT.wall0 = now; }
  if (!ok) { noteBadClock(); return "wait"; }
  const gap = Math.max(0, (now - (+p.maxSeen || 0)) / 1000);
  p.maxSeen = now; delete p.clockCand; RT.perf0 = RT.wall0 = null;
  log("Ship's chronometer re-synced. Welcome back.", "comm");
  if (clockHooks.accept) clockHooks.accept(gap);
  return "accepted";
}
export const clockRT = RT;
export function noteBadClock() { if (!badClock() || Date.now() - RT.told < 600e3) return; RT.told = Date.now();
  log("Re-syncing ship's chronometer… Holodeck, counselor and away reports resume once it settles.", "comm"); }
