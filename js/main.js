// Boot, main loop (delta time, pause when hidden), input, view modes, save/load, debug.
import { G, resetState, saveGame, loadGame, wipeSave, SAVE_KEY, TAB_RT, SAVE_GUARD, MIG_RT } from "./state.js";
import { initTabLock, TL, check as tabCheck } from "./tablock.js";   // P32 #1: one playing tab
import { preload, missing, IMG } from "./assets.js";
import { applyWalkMasks, snapToFloor } from "./path.js";
import { applyArtHooks } from "./art-hooks.js";
import { PACE, PACE_RT, playerInput, isPresent, idlePaused } from "./pacing.js";
import { on, log, shipNews } from "./bus.js";
import { ltNote } from "./crew.js";
import { stepSim } from "./sim.js";
import { tickTren, tren, trenTo } from "./npc.js";
import { tickAmbient, ambient, ambientTo, npcOf, visibleOn } from "./npc-ambient.js";
import * as CL from "./crewlife.js";
import { drawDeck, resizeCam, hitTest, screenToDeck, setZoom, panBy, cam, deckFx } from "./render/deck.js";
import { drawSpace } from "./render/space.js";
import { clearShipFx } from "./render/shipfx.js";
import { buildHud, wireHud, updateHud, openLiftPanel, closeLiftPanel, showBackOnWatch, closeSheet, renderLog, flashLevel, openDecor } from "./ui/hud.js";
import * as CB from "./cabin.js";
import * as BD from "./boards.js";
import * as MD from "./injuries.js";
import * as PL from "./plog.js";   // Personal Log phase 1 (hooks register on import)
import * as GF from "./gifts.js";   // Personal Log phase 2: gifts
import * as IN from "./insight.js";   // Personal Log phase 3: Insight (hooks register on import)
import * as RM from "./romance.js";   // Personal Log phase 4: romance (hooks register on import)
import { sendTo, sendUse, sendRepair, sendLiftPanel, retrigger, ORDER, playerOrder } from "./crew.js";
import { awardXP, PROG, qualityOdds, markPlayDay, tickPlayDay } from "./progression.js";
// phase 6 test override: tools force deaths ON (DEATHS=1) or OFF (DEATHS=0) via an init script; default = PROG.deaths.enabled (true since retune v2)
if (typeof window !== "undefined" && typeof window.__TENACITY_TEST_DEATHS === "boolean") PROG.deaths.enabled = window.__TENACITY_TEST_DEATHS;
import { setupDebug } from "./debug.js";
import * as ST from "./story.js";
import { rollAway } from "./away.js";
import { badClock, clockCheck, clockHooks } from "./clock.js";   // R2 / B1: bad-clock (re-sync) mode and its acceptance
import * as VG from "./vignettes.js";   // Oct 26 D: the ambient vignette lane   // Oct 26 B: away happenings (small XP on return)   // E1 story events; the overlay (ui/story.js) registers on import
import "./ui/story.js";
import { settleInflightTorps } from "./battle.js";

const $ = s => document.querySelector(s);
const deckCv = $("#deck"), spaceCv = $("#space"), dctx = deckCv.getContext("2d"), sctx = spaceCv.getContext("2d");
export const app = { view: "deck", mode: "info", timeScale: 1, paused: false };
const PLAY_ZOOM = 1.8, INFO_ZOOM = 1.45, LAND_ZOOM = 1.6;
// landscape phone (NEW-04): the stage is now ~360 px tall; frame a little wider so the 2x Lt is ~1/3 of it
const landPhone = () => matchMedia("(orientation: landscape) and (max-height: 500px)").matches;
// option A scale (FIG_H 83): phones start this much tighter than the plain framing so the figure is ~85-90 css px tall
// (portrait 390x844: 71 -> 87 px; landscape 844x390: 69 -> 88 px). Desktop / tablet keep 1 (figure ~114 px at 1280x800).
const PHONE_BOOST = 1.22, PHONE_BOOST_LAND = 1.28;
// pass 17 P5: short landscape phones (667x375: viewport under 380 px tall, stage 325x317) start a further x1.26 tighter -
// the figure was 57 css px there, now ~72 (844x390 and taller keep PHONE_BOOST_LAND: 88 px)
const SHORT_LAND_BOOST = 1.26;
const shortLand = () => landPhone() && innerHeight < 380;
const phoneBoost = () => landPhone() ? PHONE_BOOST_LAND * (shortLand() ? SHORT_LAND_BOOST : 1) : matchMedia("(max-width: 520px)").matches ? PHONE_BOOST : 1;
const modeZoom = () => app.mode === "play" ? (landPhone() ? LAND_ZOOM : PLAY_ZOOM) : INFO_ZOOM;
// any real input counts as the player being present (the night crew stands down)
for (const ev of ["pointerdown", "keydown", "wheel"]) window.addEventListener(ev, () => playerInput(), { passive: true, capture: true });
// progression: orders issued while handling a tap / click / key are MANUAL (crew.js ORDER); the flag is dropped at
// the start of every frame, so the sim's own decisions are always AUTOMATED
for (const ev of ["pointerup", "click", "keydown"]) window.addEventListener(ev, () => { ORDER.manual = true; setTimeout(() => { ORDER.manual = false; }, 0); }, { passive: true, capture: true });

function resize() {
  const st = $("#stage"), w = st.clientWidth, h = st.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  for (const c of [deckCv, spaceCv]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  if (cam.prefZoom != null) cam.prefZoom = modeZoom();
  cam.boost = phoneBoost();
  resizeCam(w, h);
  document.documentElement.style.setProperty('--pb', $("#playbar").offsetHeight + 'px');
}
function setView(v) {
  if (v !== app.view) clearShipFx();   // P21 #1/#2: no hit-stop or half-played explosion survives a view change
  app.view = v;
  document.body.classList.toggle("view-deck", v === "deck"); document.body.classList.toggle("view-space", v === "space");
  $("#btnView").textContent = v === "deck" ? "SPACE ▸" : "◂ DECK";
}
function setMode(m) {
  app.mode = m;
  document.body.classList.toggle("mode-info", m === "info"); document.body.classList.toggle("mode-play", m === "play");
  $("#btnWindow").classList.toggle("on", m === "info"); $("#btnFull").classList.toggle("on", m === "play");
  closeSheet();
  cam.prefZoom = modeZoom(); cam.zoom = cam.prefZoom; cam.snap = true;   // 2x characters: frame a wider slice of deck
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
  else if (h.kind === "slot") openDecor(h.id);
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
  if (!open) { document.body.classList.add("sheet-open", "sheet-" + name); $("#sheetTitle").textContent = name.toUpperCase(); if (name === "duty" || name === "crew") MD.ackInjury(); }   // pass 06 (a): opening DUTY / CREW = alert seen
});
$("#sheetClose").onclick = closeSheet;
window.addEventListener("resize", resize);
document.addEventListener("gesturestart", e => e.preventDefault());
document.addEventListener("touchmove", e => { if (!e.target.closest("#panels,.chips,.card,.storypanel")) e.preventDefault(); }, { passive: false });
on("fx", (k, d) => { if (k === "openLift") openLiftPanel(); else if (k === "closeLift") closeLiftPanel(); else { if (k === "levelUp" || k === "promotion") flashLevel(); deckFx(k, d); } });

// ---------- loop ----------
let last = performance.now(), saveT = 0, hudT = 0, rt = 0, roDraw = -1e9, seenT = 0, idleUp = false;
// v18: the idle-pause overlay (index.html #idlePause)
function showIdle() { idleUp = true; const o = document.getElementById("idlePause"); if (o) o.hidden = false; if (!window.__noSave) saveGame(); }
function resumeIdle() { if (!idleUp) return; idleUp = false; const o = document.getElementById("idlePause"); if (o) o.hidden = true; playerInput(); last = performance.now(); }
{ const o = document.getElementById("idlePause"); if (o) o.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); resumeIdle(); }); }
window.addEventListener("keydown", () => { if (idleUp) resumeIdle(); });
const MAX_DT = 0.1;
function frame(now) {
  requestAnimationFrame(frame);
  ORDER.manual = false;
  if (TAB_RT.ro) { if (now - roDraw > 1000) { roDraw = now; try { if (app.view === "deck") drawDeck(dctx, rt, 0); else drawSpace(sctx, rt, 0); } catch (e) {} } last = now; return; }   /* P32b #4: a read-only tab still shows the deck, still, no sim */
  if (app.paused || ST.storyOpen()) { last = now; return; }   // P32 #1: a read-only tab runs no sim   // E1: the sim pauses while a story scene is open
  // v18 (no offline quests, approved Q1): no input for PACE.idleAfter s pauses everything behind a 'tap to resume' overlay.
  // The overlay stays up until it is tapped (or a key is pressed), so the resuming tap never lands on the deck.
  if (idleUp || idlePaused()) { if (!idleUp) showIdle(); last = now; return; }
  let dt = Math.min(MAX_DT, (now - last) / 1000); last = now;
  rt += dt;
  tickPlayDay(dt, isPresent());   // pass 07 (1): ~3 min of present play once a new play day is due
  let simDt = dt * app.timeScale;
  while (simDt > 0) { const s = Math.min(0.05, simDt); stepSim(s); tickTren(s); tickAmbient(s); VG.tickVig(s); simDt -= s; }
  seenT -= dt; if (seenT <= 0 && isPresent()) { seenT = 1; if (badClock()) clockCheck(); else { G.prog.lastSeen = Date.now(); G.prog.maxSeen = Math.max(+G.prog.maxSeen || 0, G.prog.lastSeen); } }   // R2: a bad clock stores no time; v18: the last moment on watch (BACK ON WATCH)
  if (app.view === "deck") drawDeck(dctx, rt, dt); else drawSpace(sctx, rt, dt);
  hudT -= dt; if (hudT <= 0) { hudT = 0.12; updateHud(); }
  saveT += dt; if (saveT > 5) { saveT = 0; saveGame(); }
}
// pause when hidden; v18: on return nothing is simulated - the game resumes exactly where it was (BACK ON WATCH after a long break)
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  PACE_RT.hidden = document.hidden;   // pass 06: never 'present' while hidden
  if (document.hidden) { app.paused = true; hiddenAt = Date.now(); if (G.prog && !badClock()) G.prog.maxSeen = Math.max(+G.prog.maxSeen || 0, hiddenAt); if (!window.__noSave) saveGame(); }
  else {
    tabCheck();   // P32 #1: yield first if another tab took over while this one was hidden
    if (TAB_RT.ro) return;
    const bad = badClock() && clockCheck() !== "accepted";   /* R2: nothing granted, nothing stored (B1: unless the new time is accepted now; the hook paid the one absence) */
    const gap = bad ? 0 : Math.max(0, (Date.now() - Math.max(hiddenAt, (G.prog && +G.prog.maxSeen) || 0)) / 1000);   // never a negative gap; measured from the latest time seen
    if (hiddenAt && gap >= PACE.backAfter) { const haps = rollAway(gap); showBackOnWatch(gap, haps); G.prog.restT = 0; }
    if (hiddenAt && G.prog && !bad) G.prog.maxSeen = Math.max(+G.prog.maxSeen || 0, Date.now());   /* Oct 26 B: the absence is spent: a reload cannot claim it again */   // same rule as a reload: rested only after a real absence
    if (hiddenAt && gap > 600) { PACE_RT.sessionT = 0; markPlayDay(); }   // back after a real break = a new session (calm opening again)
    playerInput();
    app.paused = false; last = performance.now();
  }
});
window.addEventListener("pagehide", () => { if (!window.__noSave) saveGame(); });

// B1: the re-sync accepted the new time: the gap from the old maxSeen is ONE normal absence (<= 3 happenings, 24 XP cap,
// one rested window), then normal play
clockHooks.accept = gap => { if (gap >= PACE.backAfter) { const haps = rollAway(gap); showBackOnWatch(gap, haps); G.prog.restT = 0; PACE_RT.sessionT = 0; } markPlayDay(); };
async function boot() {
  resize();
  await preload(p => { $("#loadBar").style.width = Math.round(p * 100) + "%"; });
  const masks = applyWalkMasks(IMG);
  applyArtHooks();   // pass 08: seated / lying / tint-base art switches on when its files loaded (data.js ART HOOKS)
  const params = new URLSearchParams(location.search);
  initTabLock();
  if (params.has("reset") && !TAB_RT.ro) {
    wipeSave();
    // strip ?reset=1 so a refresh doesn't wipe the save again (keep ?debug=1)
    const keep = new URLSearchParams(location.search); keep.delete("reset");
    history.replaceState(null, "", location.pathname + (keep.toString() ? "?" + keep : "") + location.hash);
  }
  try { bootGame(params, masks); try { sessionStorage.removeItem("tenacity.bootTry"); } catch (e) {} }
  catch (e) {
    let tried = false; try { tried = !!sessionStorage.getItem("tenacity.bootTry"); sessionStorage.setItem("tenacity.bootTry", "1"); } catch (e2) {}
    if (tried) throw e;   // a fresh boot failing too is a code bug, not a save problem: no reload loop
    // pt04 m1 backstop: a save that still breaks the boot after sanitising is set aside (never deleted) and the game starts fresh
    try { const raw = localStorage.getItem(SAVE_KEY); if (raw) localStorage.setItem(SAVE_KEY + ".corrupt", raw); sessionStorage.setItem("tenacity.recovered", String(e && e.message || e)); } catch (e2) {}
    SAVE_GUARD.live = false; wipeSave(); location.reload();
  }
}
function bootGame(params, masks) {
  const had = loadGame();
  if (!had) {
    resetState();
    log("Shift begins. The Lieutenant reports to Main Engineering — CDR Okafor's deck. The bridge has the ship; your post is below.", "comm");
    shipNews("Shift begins. The bridge officers have the ship; your post is the <b>deck</b>.");
    ltNote("Reporting to <b>Main Engineering</b>. Tap a console, a fault, or open floor to send him.");
    let rec = null; try { rec = sessionStorage.getItem("tenacity.recovered"); sessionStorage.removeItem("tenacity.recovered"); } catch (e) {}
    if (rec) log("Your previous save couldn't be read, so a fresh shift has started. The old save is kept aside (tenacity.save.v1.corrupt).", "fault");
  }
  SAVE_GUARD.live = true;   // save-loss fix: G is the loaded / fresh state from here on, so the unload and 5 s saves may write
  if (had && SAVE_GUARD.restored) log("The last save was incomplete, so your shift was restored from the last good backup.", "comm");
  if (had) settleInflightTorps();   // BUG-17
  CB.applyTier();   // phase 4: quarters plate / walk grid / rack for the current rank (before any snap to floor)
  if (!G.lt.path && !G.lt.lift && G.lt.mode !== "use") snapToFloor(G.lt);   // saves from older walk grids
  buildHud(); wireHud();
  setMode(innerWidth >= 900 ? "info" : "play"); setView("deck");
  // v18 (no offline quests): no catch-up. A pre-v18 save gets one 'held station' line; any absence of PACE.backAfter s or
  // more opens the BACK ON WATCH card. The only reward for time away is the rested XP bonus of the new session.
  if (had && (G.prog.lastSeen || G.savedAt)) {
    const bad = badClock() && clockCheck() !== "accepted";   /* R2: a bad clock: no card, no happenings, no rested window; maxSeen not advanced (B1: accepted -> the hook paid one absence) */
    const gap = bad ? 0 : Math.max(0, (Date.now() - Math.max(G.prog.lastSeen || 0, G.savedAt || 0, +G.prog.maxSeen || 0)) / 1000);   // from the latest time ever seen: a clock set back then forward adds no absence
    if (MIG_RT.from != null && MIG_RT.from < 18 && gap > 30) log("The ship held station while you were away.", "comm");
    if (gap >= PACE.backAfter) { const haps = rollAway(gap); showBackOnWatch(gap, haps); G.prog.restT = 0; }
    if (!bad) G.prog.maxSeen = Math.max(+G.prog.maxSeen || 0, Date.now());   /* Oct 26 B: measured from maxSeen, then maxSeen = now */   // a real absence: a fresh rested window (a quick reload keeps the old one as it was)
  }
  if (!badClock()) clockCheck();   /* B1: a clock back in range drops any stale candidate */
  PACE_RT.sessionT = 0; PACE_RT.idleT = 0;   // a new session (the rested bonus runs for its first PROG.xp.rested.first s)
  markPlayDay();   // progression: real calendar days with play
  if (missing.length) log("Missing art (placeholders drawn): " + missing.join(", "), "fault");
  if (masks.length < 5) console.warn("Walk masks missing for some decks; using fallback rects.");
  $("#loading").classList.add("done");
  if (params.has("debug")) setupDebug(app, { setView, setMode });
  window.__T = { G, app, cam, sendUse, sendRepair, sendTo, saveGame, retrigger, PACE_RT, idle: { up: () => idleUp, resume: resumeIdle }, tren, trenTo, ambient, ambientTo, npcOf, visibleOn, tickAmbient, CL, CB, BD, MD, PL, GF, IN, RM, playerOrder, ORDER, awardXP, PROG, qualityOdds, ST, TL, TAB_RT, VG, setView: v => setView(v) };
  VG.vigRT.toSpace = () => setView("space");
  updateHud();
  requestAnimationFrame(t => { last = t; frame(t); });
}
boot();
