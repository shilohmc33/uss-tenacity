// RA(b): the damage-control call card (#dcCard). The fight holds while it is open; the bar counts down to T'Ren's (safe) call.
// The picture: NEUTRAL_ART first, the highlighted choice's picture on hover / focus, the chosen one's on the outcome (crossfade).
// No picture (the manifest lacks it, or the image errors) = the card without its frame (.noart), never a broken image.
import { G } from "../state.js";
import { PACE } from "../pacing.js";
import * as DCM from "../dc.js";
import { hasArt, artReady } from "./story.js";
import { uiBlocked } from "./redalert.js";

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const url = k => `assets/story/${k}.webp`;
let shownKey = "";
function card() {
  let m = $("#dcCard");
  if (!m) { m = document.createElement("div"); m.id = "dcCard"; m.className = "modal dccard"; m.hidden = true; m.setAttribute("role", "dialog"); m.setAttribute("aria-label", "Damage-control call");
    m.innerHTML = `<div class="dcwrap"><div class="dcframe"><img class="sl on" alt=""><img class="sl" alt=""></div><div class="dcpanel"></div></div>`; document.body.appendChild(m); }
  return m;
}
// crossfade to picture k; a missing / failed picture drops the frame (the no-picture fallback)
function setPic(k) {
  const m = card(), fr = m.querySelector(".dcframe"); if (!k) return;
  if (!hasArt(k)) { if (!fr.dataset.art) m.classList.add("noart"); return; }
  if (fr.dataset.art === k || fr.dataset.want === k) return;
  const L = [...fr.querySelectorAll("img.sl")], on = L.find(x => x.classList.contains("on")), off = L.find(x => x !== on);
  fr.dataset.want = k;
  off.onload = () => { if (fr.dataset.want !== k) return; off.classList.add("on"); on.classList.remove("on"); fr.dataset.art = k; m.classList.remove("noart"); };
  off.onerror = () => { if (fr.dataset.want !== k) return; fr.dataset.want = ""; fr.dataset.err = k; if (!fr.dataset.art) m.classList.add("noart"); };
  off.src = url(k);
}
export function render() {
  const o = DCM.dcOpen(), m = card();
  if (!o) { hide(); return; }
  const key = o.i + ":" + (o.res ? o.res.k + o.res.band : "q");
  if (key !== shownKey || m.hidden) {
    shownKey = key; const P = m.querySelector(".dcpanel");
    if (!o.res) {
      if (!m.querySelector(".dcframe").dataset.art) { m.classList.toggle("noart", !hasArt(DCM.NEUTRAL_ART)); setPic(DCM.NEUTRAL_ART); }
      P.innerHTML = `<b class="dctitle">DAMAGE CONTROL · CALL ${o.i}</b><p class="dctext">${o.i === 1 ? `Hull ${Math.round(G.ship.hull)}%, shields ${Math.round(G.ship.shields)}%. Okafor, over the klaxon: <i>"Your call, Lieutenant. EPS, the loader or the core: I can't hold all three."</i>` : `Hull under a third and the deck is burning. Okafor: <i>"One more call, Lieutenant."</i>`} The fight holds for your answer.</p>
        <div class="dcbar"><i></i></div><small class="dcleft"></small>
        <div class="dcchoices">${DCM.choicesOf(o).map(c => `<button class="dcc${c.safe ? " safe" : ""}" data-dc="${c.k}"data-art="${c.art || DCM.NEUTRAL_ART}"><b>${esc(c.label)}</b><small>${esc(c.sub)}</small>${c.risk ? `<em>${esc(c.risk)}</em>` : ""}</button>`).join("")}</div>`;
    } else {
      const r = o.res, ch = DCM.DC[r.k];
      setPic((ch && ch.art) || DCM.NEUTRAL_ART);
      P.innerHTML = `<b class="dctitle">DAMAGE CONTROL · ${esc((ch ? ch.label : "").toUpperCase())}</b><p class="dctext out ${r.band}">${r.word ? `<i class="band">${esc(r.word)}</i> ` : ""}${esc(r.text)}</p>
        <div class="dcchips">${r.chips.length ? r.chips.map(([k, t]) => `<span class="stchip ${k}">${esc(t)}</span>`).join("") : `<span class="stchip">no change</span>`}</div>
        <div class="dcbar out"><i></i></div><button class="dcgo" data-dc-close="1">BACK TO THE FIGHT</button>`;
    }
  }
  m.hidden = false; tick();
}
function tick() {   // the countdown bar (every frame, cheap)
  const o = DCM.dcOpen(), m = $("#dcCard"); if (!o || !m || m.hidden) return;
  const left = Math.max(0, PACE.alert.dc.pause - o.t), bar = m.querySelector(".dcbar i"), sm = m.querySelector(".dcleft");
  if (bar) bar.style.width = `${(left / PACE.alert.dc.pause) * 100}%`; if (sm) sm.textContent = `T'Ren makes the call in ${Math.ceil(left)} s`;
}
export function hide() { const m = $("#dcCard"); if (m) { m.hidden = true; const fr = m.querySelector(".dcframe"); fr.dataset.art = ""; fr.dataset.want = ""; m.querySelectorAll("img.sl").forEach((x, i) => { x.classList.toggle("on", i === 0); x.removeAttribute("src"); }); } shownKey = ""; }
export function updateDC() {   // hud.js updateHud: keep the card in step with the saved state (a reload reopens it)
  const o = DCM.dcOpen(), m = $("#dcCard");
  if (o && (!m || m.hidden)) render(); else if (!o && m && !m.hidden) hide(); else if (o) { const k = o.i + ":" + (o.res ? o.res.k + o.res.band : "q"); if (k !== shownKey) render(); else tick(); }
}
DCM.dcUI.show = render; DCM.dcUI.hide = hide;
DCM.dcUI.blocked = () => uiBlocked("dcCard");   // Q1b-RA #2: sheets too
artReady().then(() => { if (DCM.dcOpen()) { shownKey = ""; render(); } });
document.addEventListener("click", e => {
  const t = e.target.closest("#dcCard [data-dc], #dcCard [data-dc-close]"); if (!t) return;
  if (t.dataset.dcClose) { DCM.closeCall(); return; }
  DCM.choose(t.dataset.dc); render();
});
const hl = e => { const t = e.target.closest && e.target.closest("#dcCard [data-art]"); if (t && DCM.dcOpen() && !DCM.dcOpen().res) setPic(t.dataset.art); };
document.addEventListener("pointerover", hl); document.addEventListener("focusin", hl);
