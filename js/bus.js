// Log + toast + ship-news bus. UI subscribes; sim only emits.
// Two status lines: the Lt line is derived every frame from G.lt (crew.js ltStatus), and ship news (orders, red
// alert, deck tasks, arrivals) goes through shipNews() into its own line, so news never overwrites the Lt's activity.
import { G } from "./state.js";
const subs = { log: [], toast: [], news: [], fx: [] };
export const on = (k, fn) => subs[k].push(fn);
export let quiet = false; // set during offline catch-up
export function setQuiet(q) { quiet = q; }
export const capture = { list: null };
export function log(msg, cls = "") {
  const e = { sd: G.ship.stardate.toFixed(1), msg, cls, t: Math.round(G.ship.elapsed) };
  G.log.push(e);
  if (G.log.length > 250) G.log.splice(0, G.log.length - 250);
  if (capture.list) capture.list.push(e);
  if (!quiet) subs.log.forEach(f => f(e));
}
export function toast(msg, kind = "") { if (!quiet) subs.toast.forEach(f => f(msg, kind)); }
export function shipNews(html) { G.news = { html, sd: G.ship.stardate.toFixed(1) }; if (!quiet) subs.news.forEach(f => f(G.news)); }
export function fx(kind, data) { if (!quiet) subs.fx.forEach(f => f(kind, data)); }
