// Bigger wins #11: the Shift Report's best moment. G.prog.moments = a ring of the last MAX moments { k, t, txt, art, n }, pushed
// live and during the offline catch-up (battle won, battlecruiser beaten, rescue, story success, level up, promotion, crew
// arrival); the report leads with the best one since the last report (G.prog.reportT). A tow is never pushed (never a "win").
// Save: G.prog.moments / G.prog.reportT (v17, additive), hardened here. Imports only state + the hoisted addHardener (no cycles).
import { G } from "./state.js";
import { addHardener } from "./progression.js";

export const MAX = 12;
export const RANK = { bc: 7, promo: 6, story: 5, rescue: 4, win: 3, levelup: 2, arrival: 1 };   // best first
export const KINDS = Object.keys(RANK);
// the plan's art table names; resolved only through assets/story/manifest.json (js/ui/art.js), with an approved fallback scene
export const MOMENT_ART = { bc: "story_report_bcwin", promo: "story_report_promo", story: "story_report_story", rescue: "story_report_rescue", win: "story_report_win",
  levelup: "story_report_levelup", arrival: "story_report_arrival", quiet: "story_report_quiet" };
export const MOMENT_TAG = { bc: "BATTLECRUISER BEATEN", promo: "PROMOTED", story: "STORY", rescue: "RESCUE", win: "BATTLE WON", levelup: "LEVEL UP", arrival: "NEW CREW", quiet: "QUIET WATCH" };
const ART_RE = /^story_[a-z0-9_]{1,40}$/;
export const moments = () => { const p = G.prog; if (!Array.isArray(p.moments)) p.moments = []; return p.moments; };
export function pushMoment(k, txt, o = {}) {
  if (!RANK[k] || !G.prog || !G.ship) return false;
  const L = moments(); L.push({ k, t: Math.round((G.ship.elapsed || 0) * 10) / 10, txt: String(txt || "").slice(0, 160), art: typeof o.art === "string" && ART_RE.test(o.art) ? o.art : null, n: Math.max(0, Math.min(99, o.n | 0)) });
  while (L.length > MAX) L.shift();
  return true;
}
// best since the last report: rank, then more enemies (n), then the most recent
export function bestMoment(since = G.prog.reportT || 0) {
  const L = moments().filter(m => m.t > since); if (!L.length) return null;
  return L.slice().sort((a, b) => RANK[b.k] - RANK[a.k] || (b.n | 0) - (a.n | 0) || b.t - a.t)[0];
}
export function markReported() { G.prog.reportT = Math.round((G.ship.elapsed || 0) * 10) / 10; }
addHardener(p => {
  p.moments = (Array.isArray(p.moments) ? p.moments : []).filter(m => m && typeof m === "object" && RANK[m.k] && Number.isFinite(m.t))
    .map(m => ({ k: m.k, t: Math.max(0, +m.t), txt: typeof m.txt === "string" ? m.txt.slice(0, 160) : "", art: typeof m.art === "string" && ART_RE.test(m.art) ? m.art : null, n: Math.max(0, Math.min(99, m.n | 0)) })).slice(-MAX);
  p.reportT = Number.isFinite(p.reportT) && p.reportT >= 0 ? p.reportT : 0;
});
