// Log + toast + status bus. UI subscribes; sim only emits.
import { G } from "./state.js";
const subs = { log: [], toast: [], status: [], fx: [] };
export const on = (k, fn) => subs[k].push(fn);
export let quiet = false; // set during offline catch-up
export function setQuiet(q) { quiet = q; }
export const capture = { list: null };
export function log(msg, cls = "") {
  const e = { sd: G.ship.stardate.toFixed(1), msg, cls };
  G.log.push(e);
  if (G.log.length > 250) G.log.splice(0, G.log.length - 250);
  if (capture.list) capture.list.push(e);
  if (!quiet) subs.log.forEach(f => f(e));
}
export function toast(msg, kind = "") { if (!quiet) subs.toast.forEach(f => f(msg, kind)); }
export function setStatus(html) { G.status = html; if (!quiet) subs.status.forEach(f => f(html)); }
export function fx(kind, data) { if (!quiet) subs.fx.forEach(f => f(kind, data)); }
