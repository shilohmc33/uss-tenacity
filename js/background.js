// Q1 #9: a starter specialty (the Academy track): Ops, Tactical, Athlete or Diplomat, +2 levels in one story skill, picked once.
// G.prog.background: null = not asked yet (a one-time prompt, fresh and existing saves alike), "none" = declined, else the key.
import { G, saveSoon } from "./state.js";
import { MOOD } from "./pacing.js";
import { addHardener } from "./progression.js";
import { SKILL_KEYS, SKILL_LABEL, levelOfXp } from "./mood.js";
import { log, toast } from "./bus.js";

export const BACKGROUNDS = {
  ops: { name: "Operations", skill: "engineering", blurb: "Four years in the Academy's systems labs. Engineering +2." },
  tactical: { name: "Tactical", skill: "tactical", blurb: "Top of your class at the tactical simulators. Tactical +2." },
  athlete: { name: "Athlete", skill: "fitness", blurb: "Parrises squares captain, and the obstacle-course record. Fitness +2." },
  diplomat: { name: "Diplomat", skill: "composure", blurb: "Debate team and a cultural exchange on Bajor. Composure +2." },
};
export const BONUS_LEVELS = 2;
const xpFor = L => 50 * L * (L + 1);
let askedThisSession = false;   // closed without choosing: asked again next session, never nagged
export const backgroundOf = () => { const b = G.prog && G.prog.background; return BACKGROUNDS[b] ? b : null; };
export const promptDue = () => !!G.prog && G.prog.background == null && G.prog.bgDone !== true && !askedThisSession && !G.sp.battle && !G.sp.alert;
export const markAsked = () => { askedThisSession = true; };
export const _askAgain = () => { askedThisSession = false; };   // tools only (q1-check)
// Q1b #1: a red alert or a battle never sits under the prompt: it is put away (not answered) and asked again once the fight is over
export const bgUI = { shown: () => false, hide: () => {} };   // set by ui/hud.js
export function suspendPrompt() { if (bgUI.shown()) { bgUI.hide(); askedThisSession = false; } }
export function pickBackground(k) {
  const p = G.prog; if (!p || p.background != null || p.bgDone === true) return false;   // one time only (Q1b #6: bgDone survives a hand-edited background)
  if (k === "none") { p.background = "none"; p.bgDone = true; saveSoon("background"); return true; }
  const B = BACKGROUNDS[k]; if (!B) return false;
  const S = p.skills || (p.skills = {}), r = S.lt || (S.lt = Object.fromEntries(SKILL_KEYS.map(x => [x, 0]))), cap = xpFor(MOOD.skill.max);
  const L = Math.min(MOOD.skill.max, levelOfXp(r[B.skill] || 0) + BONUS_LEVELS); r[B.skill] = Math.min(cap, Math.max(r[B.skill] || 0, xpFor(L)));
  p.background = k; p.bgDone = true;
  log(`Academy record: ${B.name} track. ${SKILL_LABEL[B.skill]} ${L}.`, "good"); toast(`${B.name} background · ${SKILL_LABEL[B.skill]} ${L}`, "good");
  saveSoon("background"); return true;
}
addHardener(p => { if (!(p.background === null || p.background === "none" || BACKGROUNDS[p.background])) p.background = null;
  if (p.background != null) p.bgDone = true; else p.bgDone = p.bgDone === true;   // Q1b #6: once picked, the prompt is gone for good
  if (p.bgDone && p.background == null) p.background = "none"; });
