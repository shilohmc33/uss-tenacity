// Bigger wins #12: the DS9 arrival card (#promCard): the painted Promenade and four links into systems that already exist, so
// stored rations get spent. Non-modal (it never holds a story, the strip or a fight); shown once per dock visit when present and
// nothing else is up (after any Shift Report). G.sp.promDue is set on arrival (voyage.js), G.sp.promSeen once shown; both are
// cleared when the ship leaves (crewcare.js tickCare). Buttons: Gifts -> the Personal Log's GIFT LOCKER, Shore leave ->
// crewcare.shoreLeave(), Holosuite -> openHolo("lt"), Letters home -> the Personal Log at the ex-shipmates (care packages).
import { G, saveSoon } from "../state.js";
import { PROG } from "../progression.js";
import { CARE, isPresent } from "../pacing.js";
import { toast } from "../bus.js";
import * as CC from "../crewcare.js";
import * as GF from "../gifts.js";
import * as ST from "../story.js";
import { artKey, artReady, picImg } from "./story.js";
import { openHolo } from "./holo.js";
import { promUI } from "./next.js";

export const PROM_ART = "story_promenade";
export const promHooks = { locker: null, letters: null };   // set by ui/hud.js (the Personal Log views)
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function el() {
  let m = $("#promCard");
  if (!m) { m = document.createElement("div"); m.id = "promCard"; m.hidden = true; m.setAttribute("role", "dialog"); m.setAttribute("aria-label", "The Promenade"); ($("#stage") || document.body).appendChild(m); }
  return m;
}
const alumni = () => (Array.isArray(G.prog.alumni) ? G.prog.alumni : []);
export function promRows() {
  const st = CC.shoreState(), al = alumni(), okN = al.filter(a => GF.careState(a.id).ok).length, cur = PROG.currency.short;
  return [
    { k: "gifts", label: "Gifts", sub: `Promenade shop · locker ${GF.lockerCount()}/${PROG.gifts.invMax}`, ok: true },
    { k: "shore", label: "Shore leave", sub: st.ok ? `${CARE.shoreRep} rep if granted · ${CC.shoreOdds()}` : st.why, ok: st.ok },
    { k: "holo", label: "Holosuite", sub: `Quark's holosuites · programs in ${cur}`, ok: true },
    { k: "letters", label: "Letters home", sub: !al.length ? "no ex-shipmates yet" : okN ? `${okN} ex-shipmate${okN > 1 ? "s" : ""} would love a package` : "care packages · see who's due", ok: al.length > 0 },
  ];
}
export function render() {
  const m = el(), k = artKey(PROM_ART);
  m.innerHTML = `<div class="pcpic${k ? "" : " none"}"></div><button class="pcx" data-prom="close" aria-label="Close">✕</button>
    <div class="pcbody"><b class="pct">THE PROMENADE · DEEP SPACE NINE</b><p class="pcl">${PROG.currency.name}: <b>${G.prog.rations}</b> · the Promenade is open while we're docked.</p>
    <div class="pcbtns">${promRows().map(r => `<button class="pcb" data-prom="${r.k}"${r.ok ? "" : ` disabled aria-disabled="true"`}><b>${esc(r.label)} ▸</b><small>${esc(r.sub)}</small></button>`).join("")}</div></div>`;
  m.dataset.art = k || ""; if (k) m.querySelector(".pcpic").appendChild(picImg(k));   // fix (b): a failed load falls back (stand-in, then no picture)
}
export const promShown = () => !!$("#promCard") && !$("#promCard").hidden;
export function openProm() { render(); el().hidden = false; artReady().then(() => { if (promShown() && el().dataset.art !== (artKey(PROM_ART) || "")) render(); }); }
export function hideProm() { const m = $("#promCard"); if (m) m.hidden = true; }
const canShow = () => isPresent() && !G.sp.battle && !G.sp.alert && !ST.storyOpen() && ![...document.querySelectorAll(".modal")].some(x => !x.hidden);
// called from updateHud
export function tickProm() {
  const SP = G.sp;
  if (!CC.atDS9()) { if (promShown()) hideProm(); return; }
  if ((SP.battle || SP.alert) && promShown()) hideProm();
  if (SP.promDue && !SP.promSeen && canShow()) { SP.promDue = false; SP.promSeen = true; openProm(); saveSoon("prom"); }
}
promUI.open = openProm; promUI.shown = promShown;
document.addEventListener("click", e => {
  const b = e.target.closest("#promCard [data-prom]"); if (!b || b.disabled) return;
  const k = b.dataset.prom;
  if (k === "close") { hideProm(); return; }
  if (k === "shore") { const r = CC.shoreLeave(); if (!r.ok && !r.denied && r.why) toast(r.why, "warn"); render(); return; }
  hideProm();
  if (k === "gifts" && promHooks.locker) promHooks.locker();
  else if (k === "holo") openHolo("lt");
  else if (k === "letters" && promHooks.letters) promHooks.letters();
});
