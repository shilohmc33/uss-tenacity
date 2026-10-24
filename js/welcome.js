// Q1 #8: a welcome-back crew beat. An absence of PACE.welcomeAfter s or more (sim.js catchUp sets G.prog.welcome) earns one
// short, positive crewmate line once the player is present, the Shift Report is closed (RESUME DUTY) and nothing else is open.
// Purely a reward: a small opinion lift, never a penalty. Names only (no pronouns).
import { G, saveSoon } from "./state.js";
import { PACE, isPresent } from "./pacing.js";
import { addHardener, crewList, opinionOf, nudge, addr } from "./progression.js";
import { log, toast } from "./bus.js";

const LINES = [
  "{short} is waiting by the lift with two raktajinos. 'Welcome back, {addr}. Quiet watch. I saved you the good mug.'",
  "{short} catches you at the door. 'You missed a sunrise over the nebula, {addr}. I took a holo of it for you.'",
  "{short} looks up and actually smiles. 'There you are, {addr}. The deck runs better when you're on it.'",
  "{short} hands you a PADD. 'Night-watch notes, {addr}. Nothing on fire. I checked twice.'",
  "{short}: 'Welcome back, {addr}. We kept the coffee hot and the warp core cold. The right way round, for once.'",
];
export const welcomeDue = () => !!(G.prog && G.prog.welcome && G.prog.welcome.due);
export function noteAbsence(sec) { if (G.prog && sec >= PACE.welcomeAfter) G.prog.welcome = { due: true, away: Math.round(sec) }; }
// returns the line (and shows it) when it fires; ui calls this only with no modal open and the report closed
export function tickWelcome() {
  if (!welcomeDue() || !isPresent() || G.sp.battle) return null;
  const inj = new Set(((G.prog.med && G.prog.med.inj) || []).map(x => x.id));
  const pool = crewList().filter(c => !inj.has(c.id)).sort((a, b) => opinionOf(b.id) - opinionOf(a.id)).slice(0, 3);
  G.prog.welcome = null; if (!pool.length) return null;
  const c = pool[Math.floor(Math.random() * pool.length)], line = LINES[Math.floor(Math.random() * LINES.length)].replace(/\{short\}/g, c.short).replace(/\{addr\}/g, addr());
  nudge(c.id, 1, "welcome back"); log(line, "comm"); saveSoon("welcome");
  return { id: c.id, short: c.short, line };
}
addHardener(p => { const w = p.welcome; p.welcome = w && typeof w === "object" && w.due === true ? { due: true, away: Number.isFinite(w.away) ? Math.max(0, Math.round(w.away)) : 0 } : null; });
