// Q1 #10: the story scrapbook. G.prog.scrap = [{ id, title, art, label, band, res, day, sd, old }], newest last, capped.
// story.js adds an entry on every roll (each step of a multi-step story is its own entry); old saves are seeded once from
// G.prog.story.seen (story.js scrapbook(): those entries have no choice recorded).
import { G } from "./state.js";
import { addHardener } from "./progression.js";

export const SCRAP_MAX = 40;
const BANDS = ["success", "partial", "fail", "safe", "careful"];
const str = (v, n) => typeof v === "string" ? v.slice(0, n) : null;
function clean(e) {
  if (!e || typeof e !== "object" || typeof e.id !== "string" || !/^[a-z0-9_]{1,40}$/.test(e.id)) return null;
  return { id: e.id, title: str(e.title, 90) || e.id, art: typeof e.art === "string" && /^story_[a-z0-9_]{1,40}$/.test(e.art) ? e.art : null, label: str(e.label, 160), band: BANDS.includes(e.band) ? e.band : null,
    res: str(e.res, 200), day: Number.isFinite(e.day) ? Math.max(1, Math.floor(e.day)) : null, sd: Number.isFinite(e.sd) ? +e.sd.toFixed(1) : null, old: !!e.old };
}
export const scrapList = () => { const p = G.prog; if (!Array.isArray(p.scrap)) p.scrap = []; return p.scrap; };
export function addScrap(e) { const c = clean(e); if (!c) return false; const L = scrapList(); L.push(c); while (L.length > SCRAP_MAX) L.shift(); return true; }
addHardener(p => { p.scrap = (Array.isArray(p.scrap) ? p.scrap : []).map(clean).filter(Boolean).slice(-SCRAP_MAX); p.scrapSeeded = p.scrapSeeded === true; });
