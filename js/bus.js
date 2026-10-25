// Log + toast + ship-news bus. UI subscribes; sim only emits.
// Two status lines: the Lt line is derived every frame from G.lt (crew.js ltStatus), and ship news (orders, red
// alert, deck tasks, arrivals) goes through shipNews() into its own line, so news never overwrites the Lt's activity.
import { G } from "./state.js";
const subs = { log: [], toast: [], news: [], fx: [], alert: [] };
export const on = (k, fn) => subs[k].push(fn);
export function log(msg, cls = "", tag = null) {   // pass 12 HOLD 1: tag "rom" = a romance line (hidden from the ship log while romance is off)
  const e = { sd: G.ship.stardate.toFixed(1), msg, cls, t: Math.round(G.ship.elapsed) }; if (tag) e.tag = tag;
  G.log.push(e);
  if (G.log.length > 250) G.log.splice(0, G.log.length - 250);
  subs.log.forEach(f => f(e));
}
export function toast(msg, kind = "") { subs.toast.forEach(f => f(msg, kind)); }
// encounter weighting: the battlecruiser's red-alert card. A danger alert, so it is NOT behind the cheerful() quiet gate;
// Nothing about it is saved.
export function redAlertCard(card) { subs.alert.forEach(f => f(card)); }
export function shipNews(html) { G.news = { html, sd: G.ship.stardate.toFixed(1) }; subs.news.forEach(f => f(G.news)); }
// pass 06 m1: ~10 min of ship time after a death (G.prog.med.hushUntil): no floaters and no cheerful ambient lines
export const hushed = () => { const m = G.prog && G.prog.med; return !!(m && G.ship && G.ship.elapsed < (m.hushUntil || 0)); };
// pass 09 (4): THE quiet-period gate. Every light / cheerful line, toast and floater goes through it, so a new line
// can't leak into the quiet period: cheerful() is the one test, cheer(text, sober) picks the line or its sober variant
// (null = say nothing), cheerLog / cheerToast log or toast through it, and fx() drops floaters + milestone toasts.
// tools/cheer-scan.js fails if code outside bus.js calls hushed() itself or a known light line skips cheer().
export const cheerful = () => !hushed();
export const cheer = (text, sober = null) => hushed() ? sober : text;
export function cheerLog(text, cls = "comm", sober = null, tag = null) { const t = cheer(text, sober); if (t) log(t, cls, tag); return t; }
export function cheerToast(text, kind = "good", sober = null) { const t = cheer(text, sober); if (t) toast(t, kind); return t; }
const CHEER_FX = new Set(["floater", "milestone", "levelUp", "promotion"]);   // pass 10 (2): + the level-up / promotion gold burst, big floater and tile flash
export function fx(kind, data) { if (CHEER_FX.has(kind) && hushed()) return; subs.fx.forEach(f => f(kind, data)); }
