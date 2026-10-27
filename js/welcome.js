// Q1 #8 -> v18 (no offline quests, Batch B): the welcome-back crew line now rides on the BACK ON WATCH card (ui/hud.js
// showBackOnWatch) after an absence of PACE.backAfter s or more. Approved Q6: the line stays, the +1 opinion reward goes
// (nothing is earned by being away). Names only (no pronouns); the line always uses the player's name for the Lt.
import { G } from "./state.js";
import { addHardener, crewList, opinionOf, PROG } from "./progression.js";
import { ltNamed } from "./ltname.js";   // the player's name for the Lt

const LINES = [
  "{short} is waiting by the lift with two raktajinos. 'Welcome back, {addr}. I saved you the good mug.'",
  "{short} catches you at the door. 'There you are, {addr}. The ship held station; so did the coffee.'",
  "{short} looks up and actually smiles. 'There you are, {addr}. The deck runs better when you're on it.'",
  "{short} hands you a PADD. 'Everything's where you left it, {addr}. I checked twice.'",
  "{short}: 'Welcome back, {addr}. We kept the coffee hot and the warp core cold. The right way round, for once.'",
];
// one crewmate (the three who like the Lt best, never someone in sickbay) and one line; no opinion change
export function welcomeLine() {
  const inj = new Set(((G.prog.med && G.prog.med.inj) || []).map(x => x.id));
  const pool = crewList().filter(c => !inj.has(c.id)).sort((a, b) => opinionOf(b.id) - opinionOf(a.id)).slice(0, 3);
  if (!pool.length) return null;
  const c = pool[Math.floor(Math.random() * pool.length)], line = LINES[Math.floor(Math.random() * LINES.length)].replace(/\{short\}/g, c.short).replace(/\{addr\}/g, ltNamed());
  return { id: c.id, short: c.short, line };
}
addHardener(p => { delete p.welcome; const rt = Number(p.restT); p.restT = Number.isFinite(rt) && rt >= 0 ? rt : 0;   // a save from before restT: one full rested window on its first load (the field is saved from then on)
  const t = Number(p.lastSeen), now = Date.now(); p.lastSeen = Number.isFinite(t) && t > 0 ? Math.min(t, now) : 0;
  { const c = p.clockCand; if (!(c && typeof c === "object" && Number.isFinite(c.wall) && Number.isFinite(c.off))) delete p.clockCand; else p.clockCand = { wall: c.wall, off: c.off, cardShown: c.cardShown === true }; }   /* B1 / D1: re-sync candidate + once-per-wait card flag */
  const ms = Number(p.maxSeen); p.maxSeen = Math.max(Number.isFinite(ms) && ms > 0 ? ms : 0, p.lastSeen, Number.isFinite(G.savedAt) ? G.savedAt : 0);   // the latest real time ever seen (never pulled back: a clock moved back then forward measures the true gap)
});
