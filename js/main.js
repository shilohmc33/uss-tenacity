// Boot, main loop (delta time, pause when hidden), input, view modes, save/load, debug.
import { G, resetState, saveGame, loadGame, wipeSave } from "./state.js";
import { preload, missing } from "./assets.js";
import { on, log, setStatus } from "./bus.js";
import { stepSim, catchUp } from "./sim.js";
import { drawDeck, resizeCam, hitTest, screenToDeck, setZoom, panBy, cam, deckFx } from "./render/deck.js";
import { drawSpace } from "./render/space.js";
import { buildHud, wireHud, updateHud, openLiftPanel, showReport, closeSheet, renderLog } from "./ui/hud.js";
import { sendTo, sendUse, sendRepair, sendLiftPanel, retrigger } from "./crew.js";
import { setupDebug } from "./debug.js";

const $ = s => document.querySelector(s);
const deckCv = $("#deck"), spaceCv = $("#space"), dctx = deckCv.getContext("2d"), sctx = spaceCv.getContext("2d");
export const app = { view: "deck", mode: "info", timeScale: 1, paused: false };

function resize() {
  const st = $("#stage"), w = st.clientWidth, h = st.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  for (const c of [deckCv, spaceCv]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  resizeCam(w, h);
  document.documentElement.style.setProperty('--pb', $("#playbar").offsetHeight + 'px');
}
function setView(v) {
  app.view = v;
  document.body.classList.toggle("view-deck", v === "deck"); document.body.classList.toggle("view-space", v === "space");
  $("#btnView").textContent = v === "deck" ? "SPACE ▸" : "◂ DECK";
}
function setMode(m) {
  app.mode = m;
  document.body.classList.toggle("mode-info", m === "info"); document.body.classList.toggle("mode-play", m === "play");
  $("#btnWindow").classList.toggle("on", m === "info"); $("#btnFull").classList.toggle("on", m === "play");
  closeSheet();
  cam.zoom = m === "play" ? 2.3 : 2.0; cam.snap = true;
  requestAnimationFrame(resize);
}
// ---------- input: tap / drag-pan / pinch / wheel ----------
const ptrs = new Map(); let gesture = null;
deckCv.addEventListener("pointerdown", e => {
  deckCv.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY, sx: e.offsetX, sy: e.offsetY });
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; gesture = { pinch: Math.hypot(a.x - b.x, a.y - b.y), zoom: cam.zoom }; }
  else gesture = { moved: false };
});
deckCv.addEventListener("pointermove", e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  const dx = e.offsetX - p.x, dy = e.offsetY - p.y; p.x = e.offsetX; p.y = e.offsetY;
  if (ptrs.size === 2 && gesture && gesture.pinch) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    setZoom(gesture.zoom * d / gesture.pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
  } else if (ptrs.size === 1 && gesture) {
    if (Math.hypot(e.offsetX - p.sx, e.offsetY - p.sy) > 10) gesture.moved = true;
    if (gesture.moved) panBy(dx, dy);
  }
});
const endPtr = e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  ptrs.delete(e.pointerId);
  if (gesture && !gesture.pinch && !gesture.moved && ptrs.size === 0 && e.type === "pointerup") tapDeck(p.sx, p.sy);
  if (ptrs.size === 0) gesture = null;
};
deckCv.addEventListener("pointerup", endPtr); deckCv.addEventListener("pointercancel", endPtr);
deckCv.addEventListener("wheel", e => { e.preventDefault(); setZoom(cam.zoom * Math.exp(-e.deltaY * 0.0015), e.offsetX, e.offsetY); }, { passive: false });
function tapDeck(sx, sy) {
  if (G.lt.lift) return;
  const [fx, fy] = screenToDeck(sx, sy);
  cam.manualT = 0;
  const h = hitTest(fx, fy);
  if (!h) { if (fx >= 0 && fy >= 0 && fx <= 1 && fy <= 1) { sendTo(fx, fy, { kind: "walk" }); deckFx("pulse", { x: fx, y: fy }); } return; }
  if (h.kind === "lift") sendLiftPanel();
  else if (h.kind === "repair") sendRepair(h.id);
  else sendUse(h.id);
}
spaceCv.addEventListener("click", () => {});
// ---------- buttons ----------
$("#btnView").onclick = () => setView(app.view === "deck" ? "space" : "deck");
$("#watchBattle").onclick = () => setView("space");
$("#btnWindow").onclick = () => setMode("info");
$("#btnFull").onclick = () => setMode("play");
$("#zoomCtl").onclick = e => { const b = e.target.closest("[data-z]"); if (b) setZoom(cam.zoom * (b.dataset.z === "+" ? 1.25 : 0.8), cam.w / 2, cam.h / 2); };
document.querySelectorAll("[data-sheet]").forEach(b => b.onclick = () => {
  const name = b.dataset.sheet, open = document.body.classList.contains("sheet-" + name);
  closeSheet();
  if (!open) { document.body.classList.add("sheet-open", "sheet-" + name); $("#sheetTitle").textContent = b.textContent.replace(/\d+/g, "").trim(); }
});
$("#sheetClose").onclick = closeSheet;
window.addEventListener("resize", resize);
document.addEventListener("gesturestart", e => e.preventDefault());
document.addEventListener("touchmove", e => { if (!e.target.closest("#panels,.chips,.card")) e.preventDefault(); }, { passive: false });
on("fx", (k, d) => { if (k === "openLift") openLiftPanel(); else deckFx(k, d); });

// ---------- loop ----------
let last = performance.now(), saveT = 0, hudT = 0, rt = 0;
const MAX_DT = 0.1;
function frame(now) {
  requestAnimationFrame(frame);
  if (app.paused) { last = now; return; }
  let dt = Math.min(MAX_DT, (now - last) / 1000); last = now;
  rt += dt;
  let simDt = dt * app.timeScale;
  while (simDt > 0) { const s = Math.min(0.05, simDt); stepSim(s); simDt -= s; }
  if (app.view === "deck") drawDeck(dctx, rt, dt); else drawSpace(sctx, rt, dt);
  hudT -= dt; if (hudT <= 0) { hudT = 0.12; updateHud(); }
  saveT += dt; if (saveT > 5) { saveT = 0; saveGame(); }
}
// pause when hidden; on return, run idle catch-up for the gap
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { app.paused = true; hiddenAt = Date.now(); if (!window.__noSave) saveGame(); }
  else {
    const gap = (Date.now() - hiddenAt) / 1000;
    if (hiddenAt && gap > 30) { const r = catchUp(gap); renderLog(); showReport(r); }
    app.paused = false; last = performance.now();
  }
});
window.addEventListener("pagehide", () => { if (!window.__noSave) saveGame(); });

async function boot() {
  resize();
  await preload(p => { $("#loadBar").style.width = Math.round(p * 100) + "%"; });
  const params = new URLSearchParams(location.search);
  if (params.has("reset")) wipeSave();
  const had = loadGame();
  if (!had) {
    resetState();
    log("Shift begins. The Lieutenant reports to Main Engineering — CDR Okafor's deck. The bridge has the ship; your post is below.", "comm");
    setStatus("You are a junior engineer aboard the <b>USS Tenacity</b>. Tap consoles, faults, or open floor to send the Lieutenant. The officers run the ship.");
  }
  buildHud(); wireHud();
  setMode(innerWidth >= 900 ? "info" : "play"); setView("deck");
  if (had && G.savedAt) {
    const gap = (Date.now() - G.savedAt) / 1000;
    if (gap > 30) { const r = catchUp(gap); renderLog(); showReport(r); }
  }
  if (missing.length) log("Missing art (placeholders drawn): " + missing.join(", "), "fault");
  $("#loading").classList.add("done");
  if (params.has("debug")) setupDebug(app, { setView, setMode });
  window.__T = { G, app, cam, sendUse, sendRepair, sendTo, saveGame, catchUp, retrigger };
  updateHud();
  requestAnimationFrame(t => { last = t; frame(t); });
}
boot();
