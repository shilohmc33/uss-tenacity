// Oct 26 batch B/C: away happenings. Nothing is simulated while the player is away (v18 stands); on return after an absence
// of AWAY.minGap s or more, 1-3 small shipboard happenings are picked, each worth a little XP (src "away": no rested
// multiplier, no milestone). Caps: AWAY.perAbsence per return, AWAY.perDay per real local day. The day key never moves back,
// so a clock set back cannot open a second day's allowance. The gap is measured by main.js from maxSeen (then maxSeen = now).
import { G } from "./state.js";
import { log } from "./bus.js";
import { addHardener, awardXP, crewList } from "./progression.js";
import { dayKey, laterDay, isDay } from "./util.js";
import { badClock } from "./clock.js";

export const AWAY = { minGap: 1800, stepS: 7200, max: 3, xpEach: 8, perAbsence: 24, perDay: 40 };
const LINES = [
  "Diallo ran a long-range sensor sweep of the sector. Nothing out there but dust and a very bored comet.",
  "CDR Okafor flushed the plasma manifold on the night watch. The readings came back cleaner than they have in a month.",
  "Hale ran a quiet security drill on Deck 4. Nobody got stunned; Hale counts that as a win.",
  "Captain T'Ren logged a course correction of 0.3 degrees. 'Precision is a habit, not an event.'",
  "A Bajoran transport hailed in passing and traded star charts. Diallo calls them 'pleasantly out of date'.",
  "The night shift recalibrated the deflector array. The shields hum a half-tone higher now.",
  "Sickbay finished its inventory. Every hypospray accounted for, and one mysterious extra.",
  "{crew} rewired a flickering ODN junction in the Jefferies tube without being asked.",
  "{crew} reorganized the parts locker by size, then by color, then back by size.",
  "Okafor left a PADD on your console: three things to look at, one of them underlined twice.",
  "A Starfleet courier passed at warp and sent a cheerful hail. The comms officer pretended not to be pleased.",
  "{crew} and Hale argued about the replicator's raktajino settings. The replicator won.",
];
const A = () => { const p = G.prog; if (!p.away || typeof p.away !== "object") p.away = { d: "", xp: 0 }; return p.away; };
export const awayCount = gap => !(gap >= AWAY.minGap) ? 0 : Math.min(AWAY.max, 1 + Math.floor(gap / AWAY.stepS));
// pick and pay the happenings for an absence of `gap` s; returns [{line, xp}] (empty for a short, zero or negative gap)
export function rollAway(gap, rnd = Math.random) {
  const n = badClock() ? 0 : awayCount(gap); if (!n) return [];   // R2: nothing from a bad clock
  const a = A(), d = laterDay(dayKey(new Date(Math.max(Date.now(), +G.prog.maxSeen || 0))), a.d);   // R1: keyed off the latest time ever seen (maxSeen) and the stored day: never backwards
  if (d !== a.d) { a.d = d; a.xp = 0; }
  // {crew}: a junior crewmate (never the captain or a senior officer doing odd jobs), not in sickbay, not already named in
  // the line ('Hale and Hale') and not picked twice in one return
  const inj = new Set(((G.prog.med && G.prog.med.inj) || []).map(x => x.id)), used = new Set();
  const crew = crewList().filter(c => c.short && c.slot !== "co" && !c.senior && !inj.has(c.id)), pool = LINES.slice(), out = [];
  const pick = line => { const ok = crew.filter(c => !used.has(c.id) && !line.includes(c.short)); if (!ok.length) return "A crewman"; const c = ok[Math.floor(rnd() * ok.length)]; used.add(c.id); return c.short; };
  let paid = 0;
  for (let i = 0; i < n && pool.length; i++) {
    const raw = pool.splice(Math.floor(rnd() * pool.length), 1)[0], line = raw.includes("{crew}") ? raw.replace(/\{crew\}/g, pick(raw)) : raw;
    const want = Math.max(0, Math.min(AWAY.xpEach, AWAY.perAbsence - paid, AWAY.perDay - a.xp));
    const xp = want ? awardXP(want, "away", "away") : 0;
    paid += xp; a.xp += xp; out.push({ line, xp });
    log(`While you were away: ${line}${xp ? ` (+${xp} XP)` : ""}`, "comm");
  }
  return out;
}
addHardener(p => { const s = p.away && typeof p.away === "object" ? p.away : {}, x = Math.floor(Number(s.xp));
  p.away = { d: isDay(s.d) ? s.d : "", xp: Number.isFinite(x) ? Math.max(0, Math.min(AWAY.perDay, x)) : 0 }; });   // kept as stored (never pulled back; a bad clock never writes one: clock.js)
