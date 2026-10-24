// RA(a): the held red alert's button and the battle view (a bottom sheet over the space view; not a .modal, so it never holds
// anything else). Contacts from enemies[] / allies[] (the held roster, or the live battle), T'Ren's read (Q1 threat odds word),
// the Lt's station, ENGAGE. A live fight opens the same view; #raCall is the hook for batch (b)'s damage-control call.
import { G } from "../state.js";
import { PACE, isPresent } from "../pacing.js";
import { DECKS } from "../data.js";
import { threatRead, alertBattle, engageAlert } from "../battle.js";
import { liveOf, shipOf, hullPct, foe } from "../ships.js";
import * as DCM from "../dc.js";   // RA(b): a queued damage-control call shows when the Lt opens the view

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
let open = false, lastKey = "";
export const raHook = { call: null };   // batch (b): fills #raCall during a live fight
export const viewOpen = () => open;
// the button works only when the player is present, nothing modal is up and the Shift Report is closed (RESUME DUTY)
// Q1b-RA #2: ...or any panel / sheet: the play-mode ORDERS / DUTY / CREW / LOG sheet (#panels, body.sheet-open; in the info layout
// the panels are docked beside the stage, not a sheet) and the lift panel
export const sheetOpen = () => { const b = document.body.classList; return b.contains("mode-play") && b.contains("sheet-open"); };
export const uiBlocked = (except = null) => sheetOpen() || [...document.querySelectorAll(".modal")].some(m => !m.hidden && m.id !== except);
export const canRespond = () => isPresent() && !uiBlocked();
export function initRedAlert() {
  $("#redBanner").insertAdjacentHTML("afterend", `<button id="raBtn" hidden type="button"></button>`);
  document.body.insertAdjacentHTML("beforeend", `<div id="raSheet" hidden role="dialog" aria-label="Red alert"><div class="ra-card"><div id="raBody"></div></div></div>`);
  $("#raBtn").addEventListener("click", () => { if (canRespond()) openView(); });
  for (const sel of ["#redBanner span", "#redThreat", "#battleHud"]) { const el = $(sel); if (el) { el.style.cursor = "pointer"; el.addEventListener("click", () => { if (G.sp.battle && canRespond()) openView(); }); } }   // a live fight: tap to open the view
  $("#raSheet").addEventListener("click", e => { const b = e.target.closest("[data-ra]"); if (!b) return;
    if (b.dataset.ra === "engage") { engageAlert("lt"); lastKey = ""; render(); } else closeView(); });
}
const B = () => G.sp.battle || alertBattle();
const word = w => w.charAt(0).toUpperCase() + w.slice(1);
export function trenLine(Bt = B()) {
  const tr = threatRead(Bt); if (!tr) return "";
  const lead = shipOf(foe(Bt)), m = /^(.*?-class)/.exec(lead.cls || ""), nm = m ? m[1] : lead.name, more = liveOf(Bt.enemies).length - 1;
  return `T'Ren: '${nm}${more > 0 ? `, and ${more} more` : ""}. ${word(tr.word)}, Lieutenant.'`;
}
function station() {
  const L = G.lt, dk = (DECKS[L.deck] || {}).name || "the deck";
  return L.deck === "engineering" ? `${dk}: keep her systems alive and her tubes loaded.` : L.deck === "bridge" ? `${dk}: back up the bridge officers; the deck still needs you.` : `${dk}. Your post is Main Engineering: get down there.`;
}
const row = (c, me) => { const d = shipOf(c), p = me ? Math.round(G.ship.hull) : hullPct(c);
  return `<div class="ra-row${c.dead ? " dead" : ""}"><span class="nm">${esc(me ? "USS Tenacity" : d.name)}<small>${esc(d.cls || "")}</small></span><span class="hb"><i style="width:${Math.max(0, Math.min(100, p))}%"></i></span><b>${c.dead ? "—" : p + "%"}</b></div>`; };
function render() {
  const A = G.sp.alert, Bt = B(); if (!Bt) { closeView(); return; }
  const held = !!A && !G.sp.battle, left = held ? Math.max(0, Math.ceil(PACE.alert.holdPresent - A.t)) : 0;
  const key = [held, left, ...Bt.enemies.map(e => e.ship + ":" + Math.round(e.hull) + (e.dead ? "x" : "")), ...Bt.allies.map(a => a.ship + ":" + Math.round(a.ref === "ship" ? G.ship.hull : a.hull)), G.lt.deck, G.sp.battle && G.sp.battle.dc ? JSON.stringify(G.sp.battle.dc.buf) : ""].join("|");
  if (key === lastKey) return; lastKey = key;
  $("#raBody").innerHTML = `<div class="ra-h"><b>⚠ RED ALERT</b><small>${held ? "Contact holding at range · all stop" : "Battle stations"}</small></div>
    <div class="ra-sec">CONTACTS</div>${Bt.enemies.map(e => row(e, false)).join("")}
    <div class="ra-sec">WITH US</div>${Bt.allies.map(a => row(a, a.ref === "ship")).join("")}
    <p class="ra-tren">${esc(trenLine(Bt))}</p><p class="ra-st"><i>Your station</i> ${esc(station())}</p><div id="raCall"></div>
    ${held ? `<p class="ra-left">T'Ren engages in ${left} s if you don't.</p>` : ""}
    <div class="ra-btns">${held ? `<button class="ra-go" data-ra="engage">ENGAGE</button><button class="ra-x" data-ra="close">STAND BY</button>` : `<button class="ra-x" data-ra="close">BACK TO THE FIGHT</button>`}</div>`;
  if (!held) { const d = G.sp.battle && G.sp.battle.dc, el = $("#raCall"), bf = d ? [d.buf.eps && "shields rerouted", d.buf.core && "core held"].filter(Boolean) : [];
    if (el) el.innerHTML = bf.length ? `<small class="ra-buf">Damage control: ${bf.join(" · ")}</small>` : "";
    if (raHook.call) raHook.call(el); }
}
export function openView() {
  if (!B() || uiBlocked()) return false;   // never over a sheet or panel
  if (!document.body.classList.contains("view-space")) { const v = $("#btnView"); if (v) v.click(); }
  open = true; lastKey = ""; $("#raSheet").hidden = false; render();
  if (G.sp.battle) DCM.onViewOpen();
  return true;
}
export function closeView() { open = false; const s = $("#raSheet"); if (s) s.hidden = true; }
// hud.js updateHud, every frame
export function updateRedAlert() {
  const btn = $("#raBtn"); if (!btn) return;
  const A = G.sp.alert;
  if (A && !G.sp.battle) {
    const tr = threatRead(alertBattle(A)), ok = canRespond(), left = Math.max(0, Math.ceil(PACE.alert.holdPresent - A.t));
    btn.hidden = false; btn.disabled = !ok; btn.setAttribute("aria-disabled", String(!ok));
    const t = `<b>⚠ RED ALERT</b><span>${esc(tr ? tr.label : shipOf({ ship: A.enemies[0] }).name)}</span><small>${ok ? `RESPOND ▸ · T'Ren in ${left} s` : "hold"}</small>`;
    if (btn.dataset.t !== t) { btn.innerHTML = t; btn.dataset.t = t; }
  } else btn.hidden = true;
  document.body.classList.toggle("ra-held", !btn.hidden); if (!btn.hidden) { const h = btn.offsetHeight + 24 + "px"; if (document.body.style.getPropertyValue("--ra-h") !== h) document.body.style.setProperty("--ra-h", h); }   // RA-a #5: the toasts stack above the button
  if (open) { if ((!G.sp.alert && !G.sp.battle) || uiBlocked("dcCard")) closeView(); else render(); }   // a sheet or panel opening over it closes the view
}
