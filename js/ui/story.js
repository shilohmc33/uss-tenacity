// E1: the story scene overlay (#storyScene), modelled on the holodeck scene (ui/holo.js): a 1080x1920 painted frame, the
// blurb panel with the P30 'scroll for more' cue, 44 px choice buttons (approach, skill, who rolls, odds word, any cost up
// front, the risk line), then an outcome card (band, line, reward / cost chips, Continue). Closing early = the safe choice.
import * as ST from "../story.js";
import { toast } from "../bus.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function modal() {
  let m = document.getElementById("storyScene");
  if (!m) { m = document.createElement("div"); m.id = "storyScene"; m.className = "modal storyscene"; m.hidden = true; document.body.appendChild(m); }
  return m;
}
function render() {
  const c = ST.current(), m = modal();
  if (!c) { m.hidden = true; document.body.classList.remove("story-open"); return; }
  const E = ST.EV[c.id], r = c.res;
  const body = r
    ? `<p class="sttext">${r.word ? `<i class="band">${esc(r.word)}</i> ` : ""}${esc(r.text)}</p><small class="stmore">▾ scroll for more</small><div class="stchips">${r.chips.length ? r.chips.map(([k, t]) => `<span class="stchip ${k}">${esc(t)}</span>`).join("") : `<span class="stchip">no change</span>`}</div><button class="stcont" data-story-continue="1">Continue</button>`
    : `<p class="sttext">${esc(c.text)}</p><small class="stmore">▾ scroll for more</small><div class="stchoices">${ST.choicesOf(c).map(ch => `<button class="stc${ch.safe ? " safe" : ""}" data-story-pick="${ch.k}"${ch.ok ? "" : ` disabled title="${esc(ch.why || "")}"`}><span>${esc(ch.label)}</span><small>${esc(ch.sub)}${ch.ok ? "" : ` · ${esc(ch.why)}`}</small>${ch.risk ? `<small class="risk">risk: ${esc(ch.risk)}</small>` : ""}</button>`).join("")}</div>`;
  m.innerHTML = `<div class="storywrap"><div class="storyframe"><img src="assets/story/${E.art}.webp" alt="${esc(E.title)}"><button class="storyx" data-story-close="1" aria-label="${r ? "Close" : "Close (same as the safe choice)"}" title="${r ? "Close" : "Close: same as the safe choice"}">✕</button></div><div class="storypanel${r ? " out " + r.band : ""}"><b class="sttitle">${esc(E.title.toUpperCase())}</b>${body}</div></div>`;
  m.hidden = false; document.body.classList.add("story-open");
  const pn = m.querySelector(".storypanel"), p = pn.querySelector(".sttext"); pn.classList.toggle("more", p.scrollHeight > p.clientHeight + 1);   // P30 cue
}
ST.storyUI.show = render;
ST.storyUI.hide = () => { modal().hidden = true; document.body.classList.remove("story-open"); };
document.addEventListener("click", e => {
  const t = e.target.closest("[data-story-pick],[data-story-continue],[data-story-close]");
  if (!t || t.disabled) return;
  if (t.dataset.storyPick) { const r = ST.choose(t.dataset.storyPick); if (r && !r.ok) toast(r.why, "warn"); render(); return; }
  ST.closeStory();
});
window.addEventListener("resize", () => { if (ST.current()) render(); });
