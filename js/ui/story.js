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
// Story choice art: assets/story/manifest.json (tools/story-art-manifest.py) lists the images that exist, so optional art
// (<main>_v2, <base>_c<n>) is only requested when present: no 404s, no console errors, no broken image. Preload = this event only.
let MAN = null;
const manP = (typeof fetch === "function" ? fetch("assets/story/manifest.json", { cache: "no-cache" }).then(r => (r.ok ? r.json() : [])).catch(() => []) : Promise.resolve([]))
  .then(a => { MAN = new Set(Array.isArray(a) ? a.map(String) : []); return MAN; });
export const artReady = () => manP;
export const hasArt = k => !!MAN && MAN.has(k);   // RA(b): the damage-control call card (ui/dccall.js)
const has = k => !!MAN && MAN.has(k);
const url = k => `assets/story/${k}.webp`;
const pre = {};
const preload = k => { if (!pre[k]) { const i = new Image(); i.src = url(k); pre[k] = i; } };
const mainKey = a => (has(a.main + "_v2") ? a.main + "_v2" : a.main);
// P33 fix 5: fb = the event's main scene. A _v2 or choice image that fails to load (stale manifest, bad file) falls back to it.
function setArt(frame, k, fade, fb) {   // fade: crossfade (~400 ms, css) from the shown layer to k once it has loaded
  const L = [...frame.querySelectorAll("img.sl")], on = L.find(x => x.classList.contains("on")) || L[0], off = L.find(x => x !== on);
  if (fb) frame.dataset.fb = fb; fb = frame.dataset.fb;
  if (frame.dataset.art === k) return;
  const fail = () => { frame.dataset.err = k; if (fb && k !== fb) { frame.dataset.art = ""; frame.dataset.want = ""; setArt(frame, fb, false); } };
  if (!fade) { on.onerror = () => { if (frame.dataset.art === k) fail(); }; on.src = url(k); on.classList.add("on"); off.classList.remove("on"); frame.dataset.art = k; return; }
  frame.dataset.want = k;
  const swap = () => { if (frame.dataset.want !== k) return; off.classList.add("on"); on.classList.remove("on"); frame.dataset.art = k; };
  off.onload = swap; off.onerror = () => { if (frame.dataset.want !== k) return; frame.dataset.want = ""; frame.dataset.err = k; if (!on.complete || !on.naturalWidth) fail(); };   // keeps the shown scene (or falls back to the main one)
  if (off.getAttribute("src") === url(k) && off.complete && off.naturalWidth) swap(); else off.src = url(k);
}
function buildFrame(m, c, E, fkey) {
  m.innerHTML = `<div class="storywrap"><div class="storyframe" data-for="${esc(fkey)}"><img class="sl on" alt="${esc(ST.titleOf(c))}"><img class="sl" alt=""><button class="storyx" data-story-close="1"></button></div><div class="storypanel"></div></div>`;
  const fr = m.querySelector(".storyframe"), a = ST.artOf(c);
  setArt(fr, mainKey(a), false, a.main); preload(mainKey(a));
  const more = () => { for (const ch of ST.choicesOf(c)) if (!ch.safe && has(`${a.cbase}_c${ch.n}`)) preload(`${a.cbase}_c${ch.n}`); };
  if (MAN) more(); else manP.then(() => { if (fr.isConnected && fr.dataset.for === fkey) { more(); if (!ST.current() || !ST.current().res) setArt(fr, mainKey(a), true); } });
  return fr;
}
function render() {
  const c = ST.current(), m = modal();
  if (!c) { m.hidden = true; document.body.classList.remove("story-open"); return; }
  const E = ST.EV[c.id], r = c.res, fkey = c.id + ":" + (c.node || "") + ":" + (c.at || 0);
  let fr = m.querySelector(".storyframe");
  if (!fr || fr.dataset.for !== fkey || m.hidden) fr = buildFrame(m, c, E, fkey);
  const body = r
    ? `<p class="sttext">${r.word ? `<i class="band">${esc(r.word)}</i> ` : ""}${esc(r.text)}</p><small class="stmore">▾ scroll for more</small><div class="stchips">${r.chips.length ? r.chips.map(([k, t]) => `<span class="stchip ${k}">${esc(t)}</span>`).join("") : `<span class="stchip">no change</span>`}</div><button class="stcont" data-story-continue="1">${r.next != null ? "Continue ▸" : r.battle ? "Red alert" : "Continue"}</button>`
    : `<p class="sttext">${esc(c.text)}</p><small class="stmore">▾ scroll for more</small><div class="stchoices">${ST.choicesOf(c).map(ch => `<button class="stc${ch.safe ? " safe" : ""}${ch.bonus ? " bonus" : ""}${ch.locked ? " locked" : ""}" data-story-pick="${ch.k}"${ch.ok ? "" : ` disabled aria-disabled="true" title="${esc(ch.why || "")}"`}><span>${ch.bonus ? "★ " : ""}${esc(ch.label)}</span><small>${esc(ch.sub)}${ch.ok || ch.locked ? "" : ` · ${esc(ch.why)}`}</small>${ch.risk ? `<small class="risk">risk: ${esc(ch.risk)}</small>` : ""}</button>`).join("")}</div>`;
  const x = fr.querySelector(".storyx"); x.textContent = "✕"; const xl = r && r.next == null ? "Close" : r ? "Close: the next step counts as the safe choice" : "Close: same as the safe choice"; x.setAttribute("aria-label", xl); x.title = xl;
  const pn = m.querySelector(".storypanel"); pn.className = "storypanel" + (r ? " out " + r.band : ""); pn.innerHTML = `<b class="sttitle">${esc(ST.titleOf(c).toUpperCase())}${E.nodes ? ` <i class="ststep">${(c.node | 0) + 1}/${E.nodes.length}</i>` : ""}</b>${body}`;
  m.hidden = false; document.body.classList.add("story-open");
  if (r && r.band !== "safe") { const a = ST.artOf(c), ch = ST.choicesOf(c).find(z => z.k === r.k), k = ch && `${a.cbase}_c${ch.n}`; if (k && has(k)) setArt(fr, k, true); }   // the chosen approach's art under the outcome
  const p = pn.querySelector(".sttext"); pn.classList.toggle("more", p.scrollHeight > p.clientHeight + 1);   // P30 cue
}
ST.storyUI.show = render;
ST.storyUI.blocked = () => [...document.querySelectorAll(".modal")].some(m => !m.hidden);   // P34b: any panel, modal or overlay (Shift Report, holo, tab lock...) holds a saved fight
ST.storyUI.hide = () => { modal().hidden = true; document.body.classList.remove("story-open"); };
document.addEventListener("click", e => {
  const t = e.target.closest("[data-story-pick],[data-story-continue],[data-story-close]");
  if (!t || t.disabled) return;
  if (t.dataset.storyPick) { const r = ST.choose(t.dataset.storyPick); if (r && !r.ok) toast(r.why, "warn"); render(); return; }
  if (t.dataset.storyContinue && ST.next()) return;   // E3: on to the next step
  ST.closeStory();
});
window.addEventListener("resize", () => { if (ST.current()) render(); });
