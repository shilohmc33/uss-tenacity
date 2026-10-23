// P32 #1: one playing tab. The owner writes a heartbeat to localStorage every second and answers on a BroadcastChannel; a
// second tab finds a fresh lock held by someone else and goes READ-ONLY (no sim, no saves) behind an 'Open in another tab'
// overlay. 'Use this tab' takes over: it claims the lock with a higher epoch, the old owner saves and goes read-only (at once
// over BroadcastChannel, or on its next heartbeat check when only localStorage works), then this tab reloads the fresh save.
// P32b: a fresh tab id every page load (Duplicate Tab / window.open copy sessionStorage); only the takeover epoch lives in sessionStorage. Tests: __T.TL.
import { TAB_RT, saveGame } from "./state.js";

const KEY = "tenacity.tablock", STALE = 3500, BEAT = 1000, WAIT = 1300;
let id = "", ep = 0, bc = null, timer = null;
const now = () => Date.now();
const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && typeof v.id === "string" ? v : null; } catch (e) { return null; } };
const write = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} };
const fresh = l => l && now() - (+l.t || 0) < STALE;
const beats = (l, myEp) => (+l.ep || 0) > myEp || ((+l.ep || 0) === myEp && l.id < id);   // does another tab's claim win over mine?
export const TL = { get id() { return id; }, get ep() { return ep; }, ro: () => TAB_RT.ro, takeover, check };
function goRO(why, saveFirst) {
  if (TAB_RT.ro) return;
  if (saveFirst) saveGame();   // the taker reloads from this save
  TAB_RT.ro = true; TAB_RT.why = why; showOverlay();
}
function own() { TAB_RT.ro = false; write({ id, ep, t: now() }); }
export function check() {   // every heartbeat (and on visibility return): yield to a winning claim, else refresh mine
  const l = read();
  if (TAB_RT.ro) return;
  if (l && l.id !== id && fresh(l) && beats(l, ep)) { goRO("another tab took over", !!l.pending); return; }
  own();
}
export function takeover() {
  const l = read(); ep = Math.max(ep, l ? (+l.ep || 0) : 0) + 1;
  write({ id, ep, t: now(), pending: true });
  try { sessionStorage.setItem("tenacity.tabEp", String(ep)); sessionStorage.setItem("tenacity.tabTake", id); } catch (e) {}
  if (bc) bc.postMessage({ type: "takeover", id, ep });
  const btn = document.querySelector("#tabLock button"); if (btn) { btn.disabled = true; btn.textContent = "Taking over…"; }
  setTimeout(() => location.reload(), WAIT);   // the old owner has saved by now; load that fresh save here
}
function showOverlay() {
  let m = document.getElementById("tabLock");
  if (!m) { m = document.createElement("div"); m.id = "tabLock"; m.className = "modal tablock"; document.body.appendChild(m); }
  m.innerHTML = `<div class="card"><h3>OPEN IN ANOTHER TAB</h3><p>The Tenacity is running in another tab or window. This tab is read-only, so the two can't overwrite each other's save.</p><button data-tab-take="1">Use this tab</button></div>`;
  m.hidden = false;
}
export function initTabLock() {
  try { id = now().toString(36) + Math.random().toString(36).slice(2, 8); ep = +(sessionStorage.getItem("tenacity.tabEp") || 0) || 0; } catch (e) { id = id || Math.random().toString(36).slice(2); }
  let take = ""; try { take = sessionStorage.getItem("tenacity.tabTake") || ""; sessionStorage.removeItem("tenacity.tabTake"); } catch (e) {}
  const l = read();
  if (l && take && l.id === take && l.pending) id = take;   /* P32b: this tab's own takeover, finishing after its reload (ids are fresh per load) */
  if (l && l.id !== id && fresh(l) && (+l.ep || 0) >= ep) { TAB_RT.ro = true; TAB_RT.why = "open elsewhere"; showOverlay(); }   // first come keeps it; a takeover (higher epoch) wins
  if (!TAB_RT.ro) { if (l && l.id !== id) ep = Math.max(ep, +l.ep || 0); own(); }
  try { bc = new BroadcastChannel("tenacity.tab"); bc.onmessage = e => { const d = e.data || {}; if (d.id === id) return;
    if (d.type === "takeover" && !TAB_RT.ro) goRO("another tab took over", true);
    else if (d.type === "hello" && !TAB_RT.ro) bc.postMessage({ type: "owned", id, ep });
    else if (d.type === "owned" && !TAB_RT.ro && beats({ id: d.id, ep: d.ep }, ep)) goRO("open elsewhere", false); };
    bc.postMessage({ type: "hello", id, ep }); } catch (e) { bc = null; }
  timer = setInterval(check, BEAT);
  window.addEventListener("pagehide", () => { const x = read(); if (!TAB_RT.ro && x && x.id === id) { try { localStorage.removeItem(KEY); } catch (e) {} } });
  document.addEventListener("click", e => { if (e.target.closest("[data-tab-take]") && TAB_RT.ro) takeover(); });
  return !TAB_RT.ro;
}
