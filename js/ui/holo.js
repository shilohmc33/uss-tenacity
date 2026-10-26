// N4 UI: the Holodeck panel (no walkable room: a list of programs, a target, then a full-screen scene with the story blurb),
// the lounge / DS9 chips, and the Personal Log "Lately" line + CREW CARE tools.
import { G } from "../state.js";
import { PROG } from "../progression.js";
import { HOLO, CARE } from "../pacing.js";
import { toast } from "../bus.js";
import * as HD from "../holodeck.js";
import * as CC from "../crewcare.js";
import { level as insightLvl } from "../insight.js";
import { openPlog } from "./hud.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const FR = () => PROG.currency.short;
const occ = id => G.prog.crew.occ[id];
const DESC = {
  tactical_sim: "Tactical drill · Tactical XP · Drilled: faster phasers and torpedo loading for 4 h",
  warp_core_breach: "Engineering drill · Engineering XP · Sharp: faster repairs for 4 h",
  klingon_calisthenics: "Bat'leth forms · Fitness XP · Rest +10",
  vulcan_garden: "Meditation · Composure XP · stress halved",
  dixon_hill: "Holonovel · Fun to full · a good mood for a day",
  captain_proton: "Group serial (up to 4) · Fun and Social · +2 opinion each",
  vics_lounge: "Group night out (up to 4) · Social to full",
  risa_beach: "Premium · every need 90+ · stress cleared · once per 5 days",
};
export function holoChips(deck) {
  let h = deck === "lounge" ? `<button class="chip holoc" data-holo-open="1">Holodeck ▸</button>` : "";
  if (CC.atDS9() && !CC.C().shoreUsed) h += `<button class="chip shorec" data-shore="1">Request shore leave<small>${CARE.shoreRep} rep if granted · ${CC.shoreOdds()}</small></button>`;
  return h;
}
// ---- Personal Log section ----
export function careHtml(id) {
  const L = CC.lately(id), ts = CC.toolState(id), hs = HD.isHolo(id), w = occ(id);
  const btn = (k, label, st) => `<button data-care-tool="${k}" data-care-id="${id}" ${st.ok ? "" : "disabled"} title="${esc(st.why || "")}">${label}</button>`;
  const row = (title, sub, k, label, st) => `<div class="req"><div>${title}<small>${sub}${st.ok ? "" : ` · ${esc(st.why)}`}</small></div>${btn(k, label, st)}</div>`;
  return `<div class="plsec">LATELY</div><p class="lately"><i class="tr">${L.trend.a}</i> ${esc(L.text)} <small>(${L.trend.w}${hs ? " · on the holodeck now" : ""})</small></p>
<div class="plsec">CREW CARE</div>${ts.direct ? row("Order rest", "Four hours off duty, on your authority · once a ship's day", "rest", "ORDER", ts.rest) : row("Request rest", `Ask the captain for four hours off duty · ${ts.odds} · no cost if denied`, "rest", "REQUEST", ts.rest)}${row("Counselor visit", `Clears stress · every ${CARE.counselGapDays} ship's days`, "counsel", "ASK", ts.counsel)}${ts.direct ? row("Order a shift swap", `Move ${esc(w.short)} to ${ts.swap.to} shift · once a ship's day`, "swap", "ORDER", ts.swap) : row("Request a shift swap", `Ask the captain to move ${esc(w.short)} to ${ts.swap.to} shift · ${ts.odds}`, "swap", "REQUEST", ts.swap)}${row("Book the holodeck", "Pick a program for them, on your Rations · +1 opinion a day", "holo", "BOOK", { ok: !hs, why: hs ? "already in a session" : "" })}`;
}
// ---- the panel ----
let target = "lt";
function modal(id) {
  let m = document.getElementById(id);
  if (!m) { m = document.createElement("div"); m.id = id; m.className = "modal"; m.hidden = true; document.body.appendChild(m); }
  return m;
}
function renderPanel(note = "") {   // note: the reason a tapped row can't book (shown at the top of the panel, over which toasts can't be seen)
  const m = modal("holoPanel"), lvl = insightLvl();
  const crew = Object.values(G.prog.crew.slots).filter(id => id && occ(id));
  if (target !== "lt" && !occ(target)) target = "lt";
  const opts = [`<option value="lt"${target === "lt" ? " selected" : ""}>You</option>`].concat(crew.map(id => `<option value="${id}"${id === target ? " selected" : ""}>${esc(occ(id).short)}</option>`)).join("");
  const rows = HD.PROG_IDS.map(pid => {
    const pg = HD.PROGS[pid], st = HD.bookState(pid, target, true), fit = target !== "lt" && lvl >= CARE.insightQuirk1 && HD.fits(target, pid);
    return `<div class="req holorow${st.ok ? "" : " off"}"><img class="holothumb" src="assets/holodeck/holo_${pid}.webp" alt=""><div>${esc(pg.name)}${fit ? ` <b class="holofit" title="suits their quirks">♥</b>` : ""}<small>${pg.min} min · ${DESC[pid]}${st.ok ? "" : ` · ${esc(st.why)}`}</small></div><button data-holo-book="${pid}"${st.ok ? "" : ' aria-disabled="true"'}>${pg.fr} ${FR()}</button></div>`;
  }).join("");
  const used = target === "lt" && HD.ltLeft() <= 0, lim = used ? `<p class="hololimit${note ? " flash" : ""}" role="${note ? "alert" : "status"}"><b>UNAVAILABLE TODAY</b> You've had your holodeck time today. ${esc(HD.ltNextText())}.</p>` : target === "lt" ? `<p class="cnote hololeft">Your holodeck time: ${HD.ltLeft()} session${HD.ltLeft() === 1 ? "" : "s"} left today (resets at midnight). Bookings for crewmates don't count.</p>` : "", why = note && !used ? `<p class="hololimit flash" role="alert"><b>CAN'T BOOK THAT</b> ${esc(note)}</p>` : "";
  m.innerHTML = `<div class="card holocard"><h3>HOLODECK</h3>${lim}${why}<p class="cnote">${G.prog.rations} ${FR()} on hand. Booking for <select id="holoFor">${opts}</select>${lvl < CARE.insightQuirk1 ? " · Insight 2 shows which programs suit someone" : ""}</p>${rows}<button class="close" data-holo-close="1">CLOSE</button></div>`;
}
export function openHolo(forId = "lt") { target = forId || "lt"; renderPanel(); modal("holoPanel").hidden = false; }
function showScene(pid, res) {
  const m = modal("holoScene");
  m.className = "modal holoscene";
  const who = res.who.filter(x => x !== "lt").map(x => occ(x).short);
  m.innerHTML = `<div class="holoframe" data-holo-scene-close="1"><img src="assets/holodeck/holo_${pid}.webp" alt="${esc(HD.PROGS[pid].name)}"><div class="holoblurb"><b>${esc(HD.PROGS[pid].name.toUpperCase())}${who.length ? ` · ${esc(who.join(", "))}` : ""}</b><p>${esc(res.blurb)}</p><small>Tap to close${res.loved ? " · they loved it" : ""}</small></div></div>`;
  m.hidden = false;
  const bl = m.querySelector(".holoblurb"), pp = bl.querySelector("p"); bl.classList.toggle("more", pp.scrollHeight > pp.clientHeight + 1);   // P30: a scroll cue when the text overflows
}
function act(e) {
  const t = e.target.closest("[data-holo-open],[data-holo-book],[data-holo-close],[data-holo-scene-close],[data-shore],[data-care-tool]");
  if (!t || t.disabled) return;
  const D = t.dataset;
  if (D.holoOpen) { openHolo(D.holoFor || "lt"); return; }
  if (D.holoClose) { modal("holoPanel").hidden = true; return; }
  if (D.holoSceneClose) { modal("holoScene").hidden = true; return; }
  if (D.holoBook) {
    const r = HD.book(D.holoBook, target, true);
    if (!r.ok) { toast(r.used ? `Holodeck unavailable — ${HD.ltNextText()}` : r.why, "warn"); renderPanel(r.why); const c = modal("holoPanel").querySelector(".card"); if (c) c.scrollTop = 0; return; }   // a greyed row still answers a tap with the reason
    modal("holoPanel").hidden = true; showScene(D.holoBook, r); refreshPlog(); return;
  }
  if (D.shore) { const r = CC.shoreLeave(); if (!r.ok) toast(r.why, "warn"); return; }
  if (D.careTool) {
    const id = D.careId;
    if (D.careTool === "holo") { openHolo(id); return; }
    const r = ({ rest: CC.orderRest, counsel: CC.counsel, swap: CC.shiftSwap })[D.careTool](id);
    toast(r.ok ? r.line : r.why, r.ok ? "good" : "warn"); refreshPlog(id);
  }
}
function refreshPlog(id) {
  const p = document.getElementById("plogPanel"); if (!p || p.hidden) return;
  const card = p.querySelector(".card"), y = card ? card.scrollTop : 0, cur = id || (document.querySelector("[data-care-id]") || {}).dataset?.careId;
  if (!cur) return; openPlog(cur); if (card) card.scrollTop = y;
}
document.addEventListener("click", act);
document.addEventListener("change", e => { if (e.target && e.target.id === "holoFor") { target = e.target.value; renderPanel(); } });
