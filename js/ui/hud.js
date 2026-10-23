// DOM HUD: stat bar, alert chip, orders, duty list, crew cards, chips, log, toasts, lift panel, report.
import { G } from "../state.js";
import { NEED_KEYS, NEED_LABEL, SHIFT_NAME, needsOf, statusOf } from "../needs.js";
import { moodOf, bandOf, bandLabel, effOf, quirkNames, SKILL_KEYS, SKILL_LABEL, skillLvl } from "../mood.js";
const skillLine = id => SKILL_KEYS.map(k => `${SKILL_LABEL[k]} ${skillLvl(id, k)}`).join(" · ");
// P27: phones have no hover - tapping a crew row (or its bars) toggles the exact need values
const openNeeds = new Set();
document.addEventListener("click", e => { const row = e.target.closest && e.target.closest("#relations .rel"); if (!row || e.target.closest("button")) return; const nd = row.querySelector("[data-needs]"); if (!nd) return; const id = nd.dataset.needs; if (openNeeds.has(id)) openNeeds.delete(id); else openNeeds.add(id); nd.classList.toggle("open", openNeeds.has(id)); }, true);
import { addr, xpToNext, rankName, rankShort, nextRank, rankEligible, computeReadiness, readinessVisible, readinessHint, crewList, opinionOf, opinionLabel, socialPoints, lockerOffer, buyLocker, PROG, costText, canAfford } from "../progression.js";
import { CREW_ROSTER, DEPTS, DEPT_ORDER, POSTINGS, SPECIES, LADDERS, SLOTMAP, pr } from "../roster.js";
const PRON = p => pr({ pronoun: p || "they" });   // pt07 m1: the patient's own pronoun
import { favourState, callFavour, perkState, alumRankShort, overhaulState, doOverhaul, casingOk, buildCasing, fixKit } from "../crewlife.js";
import { DECKS, DECK_ORDER, SYSTEMS, NODEMAP, SEV_LABEL, PRI_LABEL, OFFICERS, DESTS } from "../data.js";
import { on, log } from "../bus.js";
import { dutyItems, shieldCap } from "../faults.js";
import { voyageView } from "../voyage.js";
import * as CB from "../cabin.js";
import * as BD from "../boards.js";
import * as MD from "../injuries.js";
import * as PL from "../plog.js";
import * as GF from "../gifts.js";
import * as IN from "../insight.js";
import * as RM from "../romance.js";
import { GIFT, GIFT_ITEMS } from "../gift-data.js";
import { sendUse, sendRepair, sendLiftPanel, rideLiftTo, playerInEngineering, ltStatus } from "../crew.js";
import { BR, missionText } from "../battle.js";
import { foe, shipOf, hullPct, combatantRows, FACTIONS } from "../ships.js";
let hudRowsKey = "";
import * as CC from "../crewcare.js";
import { careHtml, holoChips } from "./holo.js";
import { ltScreenFrac } from "../render/deck.js";

const $ = s => document.querySelector(s);
const STATS = [
  { k: "hull", label: "HULL", c: "#9fe8b1" }, { k: "shields", label: "SHIELDS", c: "#99ccff", tap: "shield" },
  { k: "power", label: "POWER", c: "#ffcc66", tap: "core" }, { k: "parts", label: "PARTS", c: "#cc99cc", tap: "locker" },
  { k: "torps", label: "TORPEDOES", short: "TORPS", c: "#ff9966", tap: "torpbay" }, { k: "energy", label: "LT ENERGY", short: "ENERGY", c: "#66e0d0" },
  { k: "level", label: "LT LEVEL", short: "LEVEL", c: "#ffd75e" },
  { k: "rep", label: "REPUTATION", short: "REP", c: "#ffaa77" },
  { k: "rations", label: PROG.currency.short, short: PROG.currency.hud, c: "#9ff0c8" },   // phase 4 currency (name in PROG.currency)
];
const compact = v => v >= 10000 ? Math.round(v / 1000) + "k" : v >= 1000 ? (v / 1000).toFixed(1) + "k" : String(Math.round(v));
export function buildHud() {
  $("#stats").innerHTML = STATS.map(s => `<div class="stat ${s.tap ? "tap" : ""}" data-stat="${s.k}" style="--c:${s.c}"><div class="k">${s.short ? `<span class="lf">${s.label}</span><span class="ls">${s.short}</span>` : s.label}</div><div class="v" id="v-${s.k}"></div>${s.k === "torps" ? `<div class="pips" id="pips"></div>` : `<div class="m"><i id="m-${s.k}"></i></div>`}</div>`).join("");
  $("#stats").addEventListener("click", e => {
    const el = e.target.closest(".stat"); if (!el) return;
    const s = STATS.find(x => x.k === el.dataset.stat); if (s && s.tap) sendUse(s.tap);
  });
  $("#p-crew").insertAdjacentHTML("beforeend", `<div id="career"></div><div id="quarters"></div><div id="plogBox"></div><div id="relations"></div><div id="memoriam"></div><div id="fleet"></div><div id="favours"></div><div id="safety"></div>`);
  $("#p-duty").insertAdjacentHTML("beforeend", `<div id="reqBox"></div>`);
  document.body.insertAdjacentHTML("beforeend", `<div id="plogPanel" class="modal" hidden><div class="card"><div id="plogBody"></div><button class="close" data-close="plogPanel">CLOSE</button></div></div>`);
  $("#plogPanel").addEventListener("click", plogClick);
  document.body.insertAdjacentHTML("beforeend", `<div id="decorPanel" class="modal" hidden><div class="card"><h3 id="decorTitle">QUARTERS</h3><div id="decorList"></div><button class="close" data-close="decorPanel">CLOSE</button></div></div>`);
  $("#decorList").addEventListener("click", decorClick);
  // phase 5: promotion board + specialisation picker (modals over everything; fit 390x844, 844x390, 1280x800)
  document.body.insertAdjacentHTML("beforeend", `<div id="boardPanel" class="modal" hidden><div class="card"><div id="boardBody"></div></div></div><div id="specPanel" class="modal" hidden><div class="card"><h3 id="specTitle">SPECIALISATION</h3><div id="specList"></div><button class="close" data-spec="later">DECIDE LATER</button></div></div>`);
  $("#boardPanel").addEventListener("click", boardClick);
  // pass 06: live sickbay scene (surgery + outcome) and the one-time Crew safety prompt
  document.body.insertAdjacentHTML("beforeend", `<div id="medPanel" class="modal" hidden><div class="card med"><div id="medBody"></div></div></div><div id="safetyPanel" class="modal" hidden><div class="card med"><div id="safetyBody"></div></div></div>`);
  $("#medPanel").addEventListener("click", e => { if (e.target.closest("[data-med=assist]")) { MD.assistSurgery(); medKey = ""; renderMedScene(); return; } if (e.target.closest("[data-med=close]")) { MD.closeScene(); $("#medPanel").hidden = true; medKey = ""; } });
  $("#safetyPanel").addEventListener("click", e => { const b = e.target.closest("[data-safety]"); if (!b) return; MD.answerGentlePrompt(b.dataset.safety === "gentle"); $("#safetyPanel").hidden = true; });
  // Personal Log phase 3: a chat-choice beat (three replies; Insight may flag the risky one with ⚠)
  document.body.insertAdjacentHTML("beforeend", `<div id="beatPanel" class="modal" hidden><div class="card beat"><div id="beatBody"></div></div></div>`);
  $("#beatPanel").addEventListener("click", beatClick);
  // Personal Log phase 4: romance scenes (the signal, a date with the fade, the disclosure)
  document.body.insertAdjacentHTML("beforeend", `<div id="romPanel" class="modal" hidden><div class="card beat rom"><div id="romBody"></div></div></div>`);
  $("#romPanel").addEventListener("click", romClick);
  $("#specPanel").addEventListener("click", specClick);
  $("#crewBar").innerHTML = OFFICERS.map(o => `<div class="crew" id="crew-${o.id}"><img src="assets/${o.img}.webp" alt="${o.who}"><div><div class="n">${o.who}</div><div class="r">${o.role}</div><div class="a">${o.ability} — <span class="r">${o.desc}</span></div><div class="s" id="cs-${o.id}"></div></div></div>`).join("");
  on("log", addLogLine);
  on("toast", showToast);
  // encounter weighting: the battlecruiser's red-alert card (non-modal; tap or wait ~7 s)
  $("#toasts").insertAdjacentHTML("afterend", `<div id="bcCard" hidden role="alert"><div class="k"></div><div class="t"></div><div class="c"></div><div class="l"></div><div class="tap">TAP TO DISMISS</div></div>`);
  $("#bcCard").addEventListener("click", hideAlertCard);
  on("alert", showAlertCard);
  on("news", renderNews);
  renderLog(); renderNews();
  const row = $("#chipsPlay"); row.addEventListener("scroll", chipHint, { passive: true }); window.addEventListener("resize", chipHint);
}
// ship news line (orders, red alert, deck tasks...). The Lt line is separate and re-derived every HUD tick.
function renderNews() {
  const n = G.news, html = n ? n.html : "The bridge officers have the ship.";
  $("#newsTxt").innerHTML = html; $("#newsBarTxt").innerHTML = html;
}
let lastLt = "";
function renderLt() {
  const h = ltStatus(); if (h === lastLt) return; lastLt = h;
  $("#statusTxt").innerHTML = h; $("#ltBarTxt").innerHTML = h;
}
// scroll hint on the chip row: fade + chevron while there are chips off to the right
function chipHint() {
  const r = $("#chipsPlay");   // horizontal row (portrait) or vertical column (landscape phone)
  r.parentElement.classList.toggle("has-more", r.scrollWidth - r.clientWidth - r.scrollLeft > 6 || r.scrollHeight - r.clientHeight - r.scrollTop > 6);
}
// pass 12 HOLD 1: romance lines (RM.romLogHidden: tagged, or legacy wording) never show in the ship log while romance is off
export function renderLog() { const ol = $("#log"); ol.innerHTML = ""; for (const e of G.log.slice(-120)) addLogLine(e); }
function addLogLine(e) {
  if (RM.romLogHidden(e)) return;
  const ol = $("#log"), li = document.createElement("li");
  li.className = e.cls || ""; li.innerHTML = `<span class="sd">${e.sd}</span>`; li.appendChild(document.createTextNode(e.msg));
  ol.prepend(li);
  while (ol.children.length > 150) ol.lastChild.remove();
}
let alertTimer = 0;
export function showAlertCard(c) {
  const el = $("#bcCard"); if (!el) return;
  // pass 13: c.delay (ms) lets the "capital-class contact" sensor toast read first; the card follows (a newer card replaces a pending one)
  clearTimeout(alertTimer); if (c.delay > 0) { alertTimer = setTimeout(() => showAlertCard({ ...c, delay: 0 }), c.delay); return; }
  el.querySelector(".k").textContent = "⚠ " + (c.kicker || "RED ALERT");
  el.querySelector(".t").textContent = c.title || "";
  el.querySelector(".c").textContent = c.cls || "";
  el.querySelector(".l").innerHTML = (c.lines || []).map(x => `<p>${x.replace(/[<>&]/g, "")}</p>`).join("");
  el.hidden = false; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
  // pass 15: the sensor (crit) toast stays up alongside the card, and the card never covers a toast
  document.querySelectorAll("#toasts .toast.crit").forEach(t => t.classList.add("hold"));
  // pass 16 B2: an auto-opened prompt that was already up (promotion board, specialisation, crew-safety prompt, romance
  // disclosure) steps aside for red alert - it is still owed and autoModals brings it back after the fight. Anything the
  // player opened stays open; the card sits above it (css z-index 56: above every modal and the play-mode sheet).
  holdPromptsForAlert(); liftAlertCard(true);
  fitAlertCard();
  clearTimeout(alertTimer); armAlertTimer();
}
// pass 16 B2: the 7 s auto-hide counts only time the card is actually SEEN - the page visible and the card on top at its
// centre (elementFromPoint) - so it can never time out under a modal or in a hidden tab. Ticks every 250 ms.
let alertSeen = 0, alertTick = 0;
export const ALERT_SHOW_MS = 7000;
function alertVisible() {
  const el = $("#bcCard"); if (!el || el.hidden || document.hidden) return false;
  const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return false;
  const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, r.top + Math.min(r.height / 2, 40)));
  const hit = document.elementFromPoint(x, y); return !!(hit && el.contains(hit));
}
function armAlertTimer() {
  alertSeen = 0; clearInterval(alertTick);
  alertTick = setInterval(() => { if (alertVisible()) alertSeen += 250; if (alertSeen >= ALERT_SHOW_MS) hideAlertCard(); }, 250);
}
export const alertCardState = () => ({ shown: !$("#bcCard").hidden, seenMs: alertSeen, visible: alertVisible() });
// pass 16 B2: #app is position:fixed (its own stacking context, under every body-level modal at z 50), so no z-index inside
// the stage can lift the card over a modal. While it is up the card moves into #alertLayer: a body-level fixed box laid exactly
// over #stage (z 56, clips like the stage, pointer-events only on the card), so fitAlertCard's stage-relative geometry is unchanged.
function syncAlertLayer() {
  const lay = $("#alertLayer"), st = $("#stage"); if (!lay || !st) return;
  const r = st.getBoundingClientRect(), cs = getComputedStyle(st);
  Object.assign(lay.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", borderRadius: cs.borderRadius });
}
function liftAlertCard(up) {
  const el = $("#bcCard"); if (!el) return;
  let lay = $("#alertLayer");
  if (up) { if (!lay) { lay = document.createElement("div"); lay.id = "alertLayer"; document.body.appendChild(lay); } syncAlertLayer(); if (el.parentElement !== lay) lay.appendChild(el); lay.hidden = false; }
  else { const box = $("#toasts"); if (box && el.parentElement !== box.parentElement) box.after(el); if (lay) lay.hidden = true; }
}
function holdPromptsForAlert() {
  // pass 17 P3: the spec picker counted itself 'offered' when it opened (specOffered), so a picker hidden here never came back;
  // un-count it so autoModals re-shows it once after the card / fight (board, safety and disclosure re-derive from their own state)
  if (!$("#specPanel").hidden) G.prog.specOffered = 0;
  for (const id of ["specPanel", "safetyPanel"]) if (!$("#" + id).hidden) $("#" + id).hidden = true;
  if (!$("#boardPanel").hidden && !boardResult) $("#boardPanel").hidden = true;   // a board RESULT already on screen stays (the card covers it)
  if (!$("#romPanel").hidden && romView && romView.mode === "disc") { $("#romPanel").hidden = true; romView = null; }
}
function hideAlertCard() {
  const el = $("#bcCard"); if (el) { el.hidden = true; el.style.top = ""; el.style.maxHeight = ""; el.classList.remove("side", "clamp"); } clearTimeout(alertTimer); clearInterval(alertTick);
  liftAlertCard(false);
  const box = $("#toasts"); if (box) { box.classList.remove("side"); box.style.top = ""; box.style.bottom = ""; box.querySelectorAll(".toast.hold").forEach(t => t.remove()); }
}
// pass 15: keep every toast clear of the red-alert card - below the toast stack if the card fits there (phone portrait), else the
// card steps left and the toasts right (landscape: a 390 px tall stage has no room below, and above it would cover the RED ALERT banner). Card geometry from offsetTop / offsetHeight (the bcin scale
// animation would shrink getBoundingClientRect).
function fitAlertCard() {
  const el = $("#bcCard"), box = $("#toasts"); if (!el || el.hidden || !box) return;
  syncAlertLayer();
  el.style.top = ""; el.style.maxHeight = ""; el.classList.remove("side", "clamp"); box.classList.remove("side"); box.style.top = ""; box.style.bottom = "";
  const par = el.offsetParent; if (!par) return;
  const pr = par.getBoundingClientRect(), floor = Math.min(pr.bottom, innerHeight) - 6;   // pass 15 L1: the card must end inside the stage
  const geo = () => { const l = pr.left + el.offsetLeft - (el.classList.contains("side") ? 0 : el.offsetWidth / 2); const t = pr.top + el.offsetTop; return { top: t, bottom: t + el.offsetHeight, left: l, right: l + el.offsetWidth }; };
  const ts = () => [...box.querySelectorAll(".toast")].map(t => t.getBoundingClientRect());
  const hit = (c, list) => list.some(r => r.left < c.right && r.right > c.left && r.top < c.bottom && r.bottom > c.top);
  const setTop = y => { el.style.top = (y - pr.top) + "px"; };
  // pass 15 L1: still too tall (small phones: 360x640, 667x375) -> cap the height; the copy scrolls and TAP TO DISMISS stays pinned (css .clamp)
  const clamp = () => { const c = geo(); if (c.bottom > floor) { el.style.maxHeight = Math.max(90, floor - c.top) + "px"; el.classList.add("clamp"); } };
  let list = ts();
  if (!hit(geo(), list)) { clamp(); return; }
  const below = Math.max(...list.map(r => r.bottom)) + 8;
  if (below + el.offsetHeight <= floor) { setTop(below); return; }
  if (innerWidth > innerHeight) {   // landscape: card to the left, toasts to its right at the card's top (css: clear of the zoom buttons, capped at 40%)
    box.classList.add("side"); el.classList.add("side"); clamp(); return;
  }
  // portrait with no room below the toasts (small phones): the card keeps its place under the banner, height capped to leave room, and the
  // toast stack moves to just below it
  const th = list.reduce((a, r) => a + r.height + 4, 0), c0 = geo();
  el.style.maxHeight = Math.max(120, floor - c0.top - th - 8) + "px"; el.classList.add("clamp");
  box.style.top = (geo().bottom + 6 - pr.top) + "px"; box.style.bottom = "auto";
}
// pass 15 L2: rotating / resizing while the card is up re-lays it out - now, next frame, and once the layout (toast flip, stage) has settled
const refit = () => { fitAlertCard(); requestAnimationFrame(() => fitAlertCard()); setTimeout(fitAlertCard, 200); };
addEventListener("resize", refit); addEventListener("orientationchange", refit);
export function showToast(msg, kind = "") {
  const box = $("#toasts"), d = document.createElement("div");
  d.className = "toast " + kind; d.textContent = msg; box.appendChild(d);
  while (box.children.length > 3) (box.querySelector(".toast:not(.crit)") || box.firstChild).remove();   // pass 15: crit toasts (sensor, alpha strike) go last
  setTimeout(() => { if (!d.classList.contains("hold")) d.remove(); }, 3200);
  fitAlertCard();
}
let lastChips = "", lastDuty = "";
export function updateHud() {
  const S = G.ship, SP = G.sp, L = G.lt;
  const val = { hull: S.hull, shields: S.shields, power: S.power, parts: S.parts, torps: S.torps, energy: S.energy, rep: SP.rep, level: G.prog.level, rations: G.prog.rations };
  for (const s of STATS) {
    const v = val[s.k];
    $("#v-" + s.k).textContent = s.k === "parts" ? `${v}/${S.partsCap}` : s.k === "torps" ? `${v}/${S.torpCap}` : s.k === "rep" || s.k === "rations" ? compact(v) : s.k === "level" ? `Lv ${v}` : Math.round(v) + "%";
    const m = $("#m-" + s.k);
    if (m) m.style.width = (s.k === "parts" ? v / S.partsCap * 100 : s.k === "rep" ? Math.min(100, v * 3) : s.k === "rations" ? Math.min(100, v / 10) : s.k === "level" ? G.prog.xp / xpToNext(G.prog.level) * 100 : s.k === "shields" ? v / shieldCap() * 100 : v) + "%";
  }
  $("#pips").textContent = "●".repeat(S.torps) + "○".repeat(S.torpCap - S.torps) + (S.charge > 0 && S.torps < S.torpCap ? ` ${Math.round(S.charge)}%` : "");
  // alert chip = duty list top item
  renderLt();
  // NEW-05: the turbolift panel belongs to the deck it was opened on; close it once he rides or changes deck
  const lp = $("#liftPanel");
  if (!lp.hidden && (L.lift || L.deck !== liftPanelDeck)) closeLiftPanel();
  // BUG-08: toasts sit on the half of the stage the Lt isn't on (top in the space view, clear of the battle HUD)
  const tb = $("#toasts"), up = document.body.classList.contains("view-space") || ltScreenFrac() > 0.5;
  tb.classList.toggle("top", up);
  const items = dutyItems(), pill = $("#alertPill");
  const mi = MD.alertInjury(), ms = MD.sceneOf();
  if (mi) {   // pass 06 (d): red medical alert with a cross and a live countdown (frozen while unseen / not present)
    const t = Math.max(0, Math.ceil(mi.left)), mmss = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
    pill.innerHTML = `<b class="mx">✚</b><b class="cd">${mmss}</b> ${mi.ack ? "" : "MEDICAL ALERT · "}${mi.short.toUpperCase()} — ${SYSTEMS[mi.sys].name}${mi.ack ? "" : " · TAP"}`;   // countdown first: it must survive the ellipsis on a phone
    pill.className = "alert-pill med" + (mi.ack ? "" : " unseen") + (t <= 30 ? " last" : "");
    pill.onclick = () => { MD.ackInjury(mi.id); sendRepair(mi.sys); };
  } else if (ms && ms.phase === "surgery") {
    pill.innerHTML = `<b class="mx">✚</b> SURGERY — ${ms.short.toUpperCase()} · sickbay`; pill.className = "alert-pill med";
    pill.onclick = () => { $("#medPanel").hidden = false; };
  } else if (items.length) {
    const top = items[0];
    pill.textContent = top.kind === "task" ? `CAPTAIN — Deck task · ${Math.ceil(top.task.t)}s` : top.kind === "job" ? `${top.job.kind === "incident" ? "INCIDENT" : "ODD JOB"} — ${top.job.label}` : `${PRI_LABEL[top.pri]} — ${SYSTEMS[top.id].name} · ${SEV_LABEL[top.sev]}`;
    pill.className = "alert-pill pri-" + top.pri + (top.kind === "task" ? " sev-task" : "") + (top.kind === "job" ? " job" : "");
    pill.onclick = () => top.kind === "task" ? sendUse(top.task.node) : top.kind === "job" ? sendUse(top.job.node) : sendRepair(top.id);
  } else { pill.textContent = "All systems nominal"; pill.className = "alert-pill"; pill.onclick = null; }
  $("#dutyBadge").textContent = items.length || "";
  // duty list
  const dk = items.map(i => i.kind + i.id + i.sev + i.pri + (i.task ? Math.ceil(i.task.t) : "") + (i.job ? Math.round(i.job.acc / i.job.need * 10) : "")).join("|") + L.mode + L.repairSys + (G.prog.med ? G.prog.med.inj.map(x => x.id + x.state).join() : "");
  if (dk !== lastDuty) {
    lastDuty = dk;
    $("#dutyBody").innerHTML = items.length ? items.map(i => {
      if (i.kind === "job") { const j = i.job, there = L.node === j.node && L.mode === "use"; return `<div class="duty job"><span class="pri p4">${j.kind === "incident" ? "INCIDENT" : "ODD JOB"}</span><span class="what">${j.label}${j.deck !== L.deck ? " · " + DECKS[j.deck].name : ""}${j.kind === "incident" ? "" : ` · <b>+${Math.round(j.xp)} XP</b>`}${there ? ` · working ${Math.round(j.acc / j.need * 100)}%` : ""}</span><button data-task="${j.node}">GO</button></div>`; }
      if (i.kind === "task") return `<div class="duty"><span class="pri p1">CAPTAIN</span><span class="what">${i.task.label} · <b>${Math.ceil(i.task.t)}s</b></span><button data-task="${i.task.node}">GO</button></div>`;
      const f = G.ship.faults[i.id], s = SYSTEMS[i.id], busy = L.mode === "repair" && L.repairSys === i.id;
      const life = G.prog.med && G.prog.med.inj.find(x => x.state === "warning" && x.sys === i.id);   // phase 6: someone in sickbay depends on it
      return `<div class="duty${life ? " life" : ""}"><span class="pri p${i.pri}">${PRI_LABEL[i.pri]}</span><span class="what">${s.fault} <span class="sev ${i.sev}">${SEV_LABEL[i.sev]}</span> · ${f.cost} part${f.cost === 1 ? "" : "s"}${s.deck !== L.deck ? " · " + DECKS[s.deck].name : ""}${life ? ` <em class="lifeTag">✚ ${life.short} in sickbay depends on it</em>` : ""}</span><button data-fix="${i.id}">${busy ? "…" : "REPAIR"}</button></div>`;
    }).join("") : `<div class="empty">No outstanding work. Okafor is, for once, quiet.</div>`;
  }
  // orders (single voyage view-model)
  const vv = voyageView();
  $("#ordersHead").textContent = vv.headline;
  $("#ordersWhy").textContent = vv.reason;
  $("#ordersProg").style.width = (vv.progress != null ? vv.progress * 100 : 0) + "%";
  $("#sceneTag").textContent = vv.scene;
  $("#deckTag").textContent = `${DECKS[L.deck].name} · SD ${S.stardate.toFixed(1)} · Day ${G.prog.day}`;
  const lv = document.querySelector('.stat[data-stat="level"]');
  if (lv) {
    const rd = readinessVisible() ? ` · board readiness ${G.prog.readiness}%${rankEligible() ? "" : ` (eligible at level ${nextRank().minLevel})`}` : "";
    const sl = BD.specLabel(), sp = BD.specPending();
    lv.title = `${rankName()} · level ${G.prog.level} · ${G.prog.xp}/${xpToNext(G.prog.level)} XP to level ${G.prog.level + 1}${rd}${sl.length ? ` · specialisation: ${sl.join(", ")}` : ""}${sp ? ` · ${sp} specialisation pick waiting (CREW)` : ""}${G.prog.board ? " · promotion board waiting" : ""}`;
    lv.classList.toggle("flag", !!(sp || G.prog.board));
    const sv = $("#v-level"); if (sv) sv.dataset.spec = Object.entries(G.prog.spec || {}).map(([id, t]) => (PROG.specs.focus[id] || {}).icon + (t > 1 ? "²" : "")).join("");
    const rs = rankShort().toUpperCase(), lf = lv.querySelector(".lf"), ls = lv.querySelector(".ls");
    if (lf && lf.textContent !== `${rs} · LEVEL`) { lf.textContent = `${rs} · LEVEL`; ls.textContent = rs; }
  }
  renderCareer();
  autoModals();
  // chips
  const bp = IN.pending(), sg = RM.pendingSignal(), ck = L.deck + L.mode + L.node + Object.keys(S.faults).join() + (bp ? bp.id : "") + (sg ? "s" + sg.id : "") + holoChips(L.deck);
  if (ck !== lastChips) {
    lastChips = ck;
    // Turbolift leads the row (and is pinned in FULL mode) so the deck-change button is never off-screen
    const html = `<button class="chip lift" data-lift="1">Turbolift ▸</button>` + holoChips(L.deck) + (sg ? `<button class="chip romc" data-rom-open="1">💌 ${esc(G.prog.crew.occ[sg.id].short)}</button>` : "") + (bp ? `<button class="chip beatc" data-beat-open="1">💬 ${esc(G.prog.crew.occ[bp.id].short)}</button>` : "") + Object.entries(DECKS[L.deck].nodes).filter(([, n]) => n.chip).map(([id, n], i) => {   // art batch 2: chip-less nodes (bridge side stations, seats) are tap-only
     
      const bad = n.system && S.faults[n.system];
      return `<button class="chip ${i % 2 ? "c2" : ""} ${L.mode === "use" && L.node === id ? "on" : ""} ${bad ? "bad" : ""}" data-node="${id}">${n.chip}</button>`;
    }).join("");
    $("#chipsPlay").innerHTML = html; $("#chipsInfo").innerHTML = html; $("#deckName").textContent = DECKS[L.deck].name;
    requestAnimationFrame(chipHint);
  }
  // task pill
  const act = SP.ev.active, tp = $("#taskPill");
  if (act && act.task) { tp.hidden = false; tp.textContent = `TASK ${Math.ceil(act.task.t)}s · ${NODEMAP[act.task.node].chip}`; tp.classList.toggle("low", act.task.t <= 10); tp.onclick = () => sendUse(act.task.node); }
  else tp.hidden = true;
  // battle
  const B = SP.battle;
  $("#redBanner").hidden = !B || document.body.classList.contains("view-space");
  $("#battleHud").hidden = !B || !document.body.classList.contains("view-space");
  if (B) { const E = foe(B), d = shipOf(E), p = hullPct(E); $("#enemyName").textContent = d.name.toUpperCase(); $("#enemyPct").textContent = p + "%"; $("#enemyBar").style.width = p + "%"; $("#enemyBar").style.background = (FACTIONS[d.faction] || {}).trim || "";
    // battle groundwork: the per-combatant HUD rows (stub): rendered into the hidden #combatantRows list, unused by the one-on-one HUD
    const rows = combatantRows(B, S), rk = rows.map(r => r.id + r.pct + (r.targeted ? "*" : "")).join("|");
    if (rk !== hudRowsKey) { hudRowsKey = rk; $("#combatantRows").innerHTML = rows.map(r => `<li data-cid="${r.id}" data-side="${r.side}"${r.targeted ? ' class="target"' : ""}>${r.name} · ${r.pct}%</li>`).join(""); } $("#bridgeOrders").textContent = (B.mission ? `Objective: ${missionText(B)}${B.mission.failed ? " — FAILED" : ""} · ` : "") + `T'Ren: ${BR.tren} · Hale: phasers ${B.cd.phaser > 0 ? "cycling" : "ready"}, torpedoes ${G.gates.loader ? "OFFLINE" : S.torps}`; }
  // crew cards
  const ab = G.ab;
  $("#crewState").textContent = B ? (B.dying ? "Target destroyed" : "Officers acting — red alert") : "Stand by — officers act on their own judgment";
  $("#crewState").classList.toggle("armed", !!B);
  for (const o of OFFICERS) {
    const a = ab[o.id], el = $("#crew-" + o.id), active = a.active > 0;
    el.classList.toggle("active", active); el.classList.toggle("cooling", a.cd > 0 && !active);
    $("#cs-" + o.id).textContent = active ? `Active — ${Math.ceil(a.active)}s` : a.cd > 0 ? `Recharging ${Math.ceil(a.cd)}s` : (B ? "Ready" : "Stand by") + (a.last ? ` · Last: ${a.last}` : "");
  }
  const sup = playerInEngineering(), sb = $("#supBadge");
  sb.classList.toggle("lit", sup); sb.textContent = sup ? "Okafor supported — Lt on station in Engineering (Miracle Worker empowered)" : "Okafor unsupported — no engineer on station in Main Engineering";
}
export function wireHud() {
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-rom-open],[data-beat-open],[data-plog-open],[data-node],[data-lift],[data-fix],[data-task],[data-close],[data-req],[data-fav],[data-sink],[data-kit],[data-slot],[data-spec=open],[data-board-open],[data-pin],[data-gentle]");
    if (!t) return;
    if (t.dataset.spec === "open") { openSpec(); return; }
    if (t.dataset.plogOpen) { openPlog(); return; }
    if (t.dataset.beatOpen) { openBeat(); return; }
    if (t.dataset.romOpen) { openRom({ mode: "signal" }); return; }   // Personal Log (the CREW sheet stays open behind it)
    if (t.dataset.boardOpen) { if (BD.boardWaiting()) openBoard(); return; }
    if (t.dataset.pin) { MD.togglePin(t.dataset.pin); renderCareer(true); return; }   // phase 6: pin a protected favourite
    if (t.dataset.gentle) { MD.setGentle(t.dataset.gentle === "on"); renderCareer(true); return; }
    if (t.dataset.node) sendUse(t.dataset.node);
    else if (t.dataset.lift) sendLiftPanel();
    else if (t.dataset.req) { if (t.dataset.req === "locker") buyLocker(); renderCareer(true); }
    else if (t.dataset.fav) { callFavour(t.dataset.fav); renderCareer(true); }
    else if (t.dataset.sink) { if (t.dataset.sink === "overhaul") doOverhaul(); else if (t.dataset.sink === "casing") buildCasing(); else if (t.dataset.sink === "maintain") G.prog.sinks.maintainOn = !G.prog.sinks.maintainOn; else if (t.dataset.sink === "trade") CB.tradeParts(); else if (t.dataset.sink === "dinner") CB.hostDinner(); renderCareer(true); }
    else if (t.dataset.slot) openDecor(t.dataset.slot);
    else if (t.dataset.kit) { fixKit(t.dataset.kit); renderCareer(true); }
    else if (t.dataset.fix) sendRepair(t.dataset.fix);
    else if (t.dataset.task) sendUse(t.dataset.task);
    else if (t.dataset.close) $("#" + t.dataset.close).hidden = true;
    // buying from the CREW / DUTY sheets keeps the sheet open (several purchases in a row; the toast confirms each)
    if (t.closest("#panels") && document.body.classList.contains("mode-play") && !t.dataset.close && !t.closest("[data-req],[data-fav],[data-sink],[data-kit],[data-slot]")) closeSheet();
  });
}
export function closeSheet() { document.body.className = document.body.className.replace(/\s?sheet-\w+/g, ""); }
let liftPanelDeck = null;
export function closeLiftPanel() { $("#liftPanel").hidden = true; liftPanelDeck = null; }
export function openLiftPanel() {
  const L = G.lt, list = $("#liftList");
  if (L.lift) return;
  liftPanelDeck = L.deck;
  list.innerHTML = DECK_ORDER.map(d => {
    const alert = Object.entries(G.ship.faults).some(([k]) => SYSTEMS[k].deck === d) || (G.sp.ev.active && G.sp.ev.active.task && G.sp.ev.active.task.deck === d);
    return `<button data-deck="${d}" class="${d === L.deck ? "here" : ""}"><span>${DECKS[d].name}</span>${d === L.deck ? "<span>YOU ARE HERE</span>" : alert ? `<span class="bd">ALERT</span>` : ""}</button>`;
  }).join("");
  list.onclick = e => { const b = e.target.closest("[data-deck]"); if (!b) return; closeLiftPanel(); if (b.dataset.deck !== G.lt.deck) rideLiftTo(b.dataset.deck); };
  $("#liftPanel").hidden = false;
}
export function showReport(r) {
  // pass 16 B1: a live-started fight was on - nothing was simulated; the fight resumes live and the report waits for it
  if (r && r.deferred) { log("Back on watch — red alert is still on. The fight held while you were away; the night crew's report waits until it's over.", "comm"); return; }
  const fmt = s => s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m` : `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`;
  const d = (v, u = "") => (v >= 0 ? "+" : "") + Math.round(v) + u;
  const vv = voyageView(), SP = G.sp;
  const where = SP.battle ? "at red alert — the bridge has the fight" : SP.travel ? `at warp for ${DESTS[SP.travel.dest].name}` : SP.location ? `at ${DESTS[SP.location].name}` : "holding position in deep space";
  const nB = r.battles + (r.battleWasOn ? 1 : 0);   // pass 13: a fight already on when you left counts (the headline names it too)
  // pass 17 P4: a report deferred behind a live fight names that fight (enemy + outcome) instead of "No contact with the Jem'Hadar"
  const LFO = { won: (a, h) => `${a} — beaten off, hull ${h}%`, disengaged: (a, h) => `${a} — T'Ren broke off and ran, hull ${h}%`, towed: a => `${a} — she crippled us; towed to Deep Space Nine` };
  const lf = r.afterFight, lfTxt = lf ? (LFO[lf.out] || LFO.won)(lf.a.charAt(0).toUpperCase() + lf.a.slice(1), lf.hull) : "";
  const fights = nB === 0 ? (lf ? `The fight that held the report: ${lfTxt}. No further contact while you were off watch.` : "No contact with the Jem'Hadar.")
    : `${nB} engagement${nB === 1 ? "" : "s"} (won ${r.wins})${r.tows ? ` · towed to DS9 ×${r.tows}` : ""}.`;
  // pass 13: a battlecruiser fought while away is the night's headline - first thing in the report
  const BCO = { won: h => `beaten off — hull ${h}%`, towed: () => "she crippled us; the Tenacity was towed to Deep Space Nine", disengaged: h => `T'Ren broke off and ran — hull ${h}%`, ongoing: h => `still fighting her now — hull ${h}%` };
  const bcHead = (r.bcFights || []).length ? `<div class="bcHead" role="alert"><b>⚠ While you were off watch: ${r.bcFights.length === 1 ? "a Jem'Hadar battlecruiser" : `${r.bcFights.length} Jem'Hadar battlecruisers`}</b> — ${r.bcFights.map(f => `${(BCO[f.out] || BCO.won)(f.hull)}${f.lost && f.out !== "towed" ? ` (−${f.lost}% in the fight)` : ""}`).join(" · ")}.</div>` : "";
  $("#reportBody").innerHTML = `${bcHead}<p><b>Okafor's night-watch log.</b> You were off watch for <b>${fmt(r.away)}</b>${r.simulated < r.away ? ` (the log covers the first ${fmt(r.simulated)}; after that she held station)` : ""}. The Tenacity kept flying — she's ${where}.</p>
  <ul><li>Voyage: ${r.legs} leg${r.legs === 1 ? "" : "s"} completed · ${r.events} event${r.events === 1 ? "" : "s"}</li>
  <li>${fights}${r.avoided ? ` T'Ren steered around ${r.avoided} patrol${r.avoided === 1 ? "" : "s"}.` : ""}</li>
  <li>Night watch cleared <b>${r.crewFixes || 0}</b> fault${r.crewFixes === 1 ? "" : "s"}${r.repairs ? ` · your repairs: ${r.repairs}` : ""}${r.torpsBuilt ? ` · torpedoes replicated: ${r.torpsBuilt}` : ""}</li>
  ${r.prog ? `<li>Lieutenant: <b>+${r.prog.xp} XP</b> watch-officer credit for the night crew's work${r.prog.to > r.prog.from ? ` · <b>level ${r.prog.from} → ${r.prog.to}</b>` : ` · level ${r.prog.to}`}${r.prog.days ? ` · ${r.prog.days} ship's day${r.prog.days === 1 ? "" : "s"} passed` : ""}${r.prog.promoted ? ` · <b>promoted to ${r.prog.promoted}</b>` : ""}</li>` : ""}
  ${r.prog && r.prog.crew && r.prog.crew.length ? `<li>Crew: ${r.prog.crew.map(e => e.kind === "transfer" ? `${e.name} transferred to ${POSTINGS[e.posting].name}` : e.kind === "arrival" ? `${e.name} reported aboard` : e.kind === "death" ? `${e.name} was lost` : `${e.name} ${e.kind === "promotion" ? "promoted" : "reduced in rank"}`).join(" · ")}</li>` : ""}
  ${r.rations ? `<li>${PROG.currency.name}: +${r.rations}${r.trades ? ` (incl. ${r.trades * PROG.rations.trade.rations} for ${r.trades * PROG.rations.trade.parts} surplus spares traded)` : ""}</li>` : ""}
  ${r.maint ? `<li>Night watch used ${r.maint} surplus spare${r.maint === 1 ? "" : "s"} on preventive maintenance (standing order)</li>` : ""}
  ${(() => { const inj = G.prog.med.inj.filter(x => x.at >= G.ship.elapsed - r.simulated - 1); return inj.length ? `<li><b>Sickbay:</b> ${inj.map(x => `${x.name} — ${x.sev === "serious" && x.state === "warning" ? `seriously injured; the ${SYSTEMS[x.sys].name} needs you (the doctor is holding them until you're back)` : x.state === "stable" ? "out of danger" : "minor injury, recovering"}`).join(" · ")}</li>` : ""; })()}
  <li>Hull ${d(r.d.hull, "%")} · Parts ${d(r.d.parts)} · Torpedoes ${d(r.d.torps)} · Reputation ${d(r.d.rep)}</li>
  <li>Faults awaiting you: <b>${r.faults}</b>${r.faults ? " — see DUTY." : " — the deck is clean."}</li>
  ${G.prog.board ? `<li><b>A promotion board is waiting for you</b> — ${BD.CHAIR[G.prog.board.chair].name} convened it while you were off watch. It sits when you resume duty.</li>` : ""}${BD.specPending() ? `<li>Specialisation pick waiting (level ${G.prog.level}).</li>` : ""}</ul>
  ${r.highlights.length ? `<p><b>Log highlights</b></p><ul>${r.highlights.map(e => `<li>SD ${e.sd} — ${e.msg.replace(/</g, "&lt;")}</li>`).join("")}</ul>` : ""}`;
  $("#report").hidden = false;
}
// progression: flash the LT LEVEL tile on a level-up
export function flashLevel() {
  const el = document.querySelector('.stat[data-stat="level"]'); if (!el) return;
  el.classList.remove("lvlup"); void el.offsetWidth; el.classList.add("lvlup");
}

// ---- phase 2: service record (rank, level, board readiness), crew relations, requisitions ----
const _cache = {};
function setHtml(id, html, force) { if (force || _cache[id] !== html) { _cache[id] = html; $("#" + id).innerHTML = html; } }
export function renderCareer(force = false) {
  if (!$("#career")) return;
  const p = G.prog, n = nextRank(), r = computeReadiness(), rp = p.readyParts, RD = PROG.readiness;
  let ready;
  if (!n) ready = `<p class="cnote">No further rank on the track yet.</p>`;
  else if (!readinessVisible()) ready = `<p class="cnote">Okafor opens your fitness report at level ${RD.showAtLevel}.</p>`;
  else {
    const elig = rankEligible(), wk = readinessHint();
    const note = elig ? `Eligible for <b>${n.name}</b> — the promotion board sits at 100%.${n.guaranteeDay ? ` Guaranteed by day ${n.guaranteeDay} of play (today: day ${p.playDays}).` : " No guaranteed date at this rank — readiness and the occasional early call-up decide."}`
      : `Eligible for <b>${n.name}</b> at level ${n.minLevel} (you are level ${p.level}). The meter keeps filling meanwhile.`;
    ready = `<div class="ready${elig ? " elig" : ""}"><div class="rk">BOARD READINESS → ${n.short.toUpperCase()} <b>${r}%</b></div><div class="rmeter"><i style="width:${r}%"></i></div>
      <div class="rparts" title="board points; Reputation counts rep EARNED since your last promotion (not the REP you can spend)"><span${wk && wk.k === "perf" ? ' class="weak"' : ""}>Performance ${rp.perf}/${Math.round(RD.perf * 100)}</span><span${wk && wk.k === "social" ? ' class="weak"' : ""}>Social ${rp.social}/${Math.round(RD.social * 100)}</span><span${wk && wk.k === "rep" ? ' class="weak"' : ""}>Rep earned this rank ${rp.rep}/${Math.round(RD.rep * 100)}</span>${rp.service ? `<span${wk && wk.k === "service" ? ' class="weak"' : ""}>Service +${rp.service}</span>` : ""}</div>${wk && (r < 100 || wk.k === "level") ? `<p class="rhint">▲ ${wk.k === "board" || wk.k === "level" ? `Holding you back: <b>${wk.label}</b>` : `Weakest: <b>${wk.label} ${wk.have}/${wk.max} board pts</b>`} (${wk.unit}) — ${wk.act}.</p>` : ""}<p class="cnote">${note}</p></div>`;
  }
  const sl = BD.specLabel(), sp = BD.specPending(), nextPick = PROG.specs.picks.find(l => l > p.level);
  const specRow = `<div class="specRow"><span class="k">SPECIALISATION</span>${sl.length ? sl.map(x => `<span class="schip">${x}</span>`).join("") : `<span class="cnote">none yet</span>`}${sp ? `<button class="spb" data-spec="open">CHOOSE (${sp})</button>` : nextPick ? `<small>next pick at level ${nextPick}</small>` : ""}</div>`;
  const lastB = p.boardLog[p.boardLog.length - 1], cd = BD.boardCdLeft();
  const boardRow = p.board ? `<div class="bstat wait">Promotion board convened — <button class="spb" data-board-open="1">FACE THE BOARD</button></div>`
    : lastB && lastB.outcome !== "pass" && lastB.to === (n && n.id) ? `<div class="bstat">${lastB.outcome === "fail" ? "Last board: not recommended" : "Last board: deferred"}${cd ? ` · next board from ship's day ${p.boardCd}` : " · the board may sit again"}${p.boardMalus ? ` · readiness penalty −${Math.round(p.boardMalus)} (fading)` : ""}</div>` : "";
  setHtml("career", `<h4>SERVICE RECORD</h4><div class="rankRow"><b>${rankName()}</b> · Level ${p.level} · ${p.xp}/${xpToNext(p.level)} XP${p.history.length ? ` · promoted ${p.history.length}×` : ""}</div>${specRow}${boardRow}${ready}<div class="ltSkills"><small>Skills: ${skillLine("lt")}</small></div>`, force);
  renderQuarters(force);
  setHtml("plogBox", `<h4>PERSONAL LOG</h4><div class="req"><div>Your own notes on the crew<small>standing, what moved it, journal · ${PL.journalCount()} entr${PL.journalCount() === 1 ? "y" : "ies"}</small></div><button data-plog-open="1">OPEN LOG</button></div>`, force);
  // ---- crew relations: all 18 roster slots grouped by department (vacant slots show the replacement en route) ----
  PL.ensureSnapshot();
  const list = crewList(), byId = Object.fromEntries(list.map(c => [c.slot, c])), favs = MD.favourites();
  const rowOf = c => {
    const v = Math.round(opinionOf(c.id)), w = Math.abs(v) / 2, st = PL.standing(c.id);
    const face = c.img ? `<img src="assets/${c.img}.webp" alt="">` : `<span class="badge" style="background:${c.color}">${c.short.replace(/[^A-Za-z]/g, "").slice(0, 2)}</span>`;
    const inj = MD.injuryOf(c.id), fav = favs.includes(c.id), pinned = G.prog.med.pins.includes(c.id);
    const injTag = inj ? ` <em class="injb${inj.state === "warning" || inj.state === "surgery" ? " crit" : ""}">${inj.state === "warning" ? "INJURED · SERIOUS" : inj.state === "surgery" ? "IN SURGERY" : "INJURED"}</em>` : "";
    const injNote = inj ? (inj.state === "surgery" ? (inj.held ? `in surgery — held stable until you're back on watch` : `in surgery — ${MD.docName(inj.id).replace(/^The /, "the ")} operating`) : inj.state === "warning" ? `in sickbay — needs the ${SYSTEMS[inj.sys].name} fixed (${Math.max(0, Math.ceil(inj.left))}s${!inj.ack ? " · waiting for you — the clock starts when you respond" : MD.isPresentNow() ? " left · clock running" : " left · paused while you're away"})` : `in sickbay — recovering${inj.healAt ? `, back in ~${Math.max(1, Math.round((inj.healAt - G.ship.elapsed) / 3600))} h` : ""}`) : "";
    const pin = (c.senior || !PROG.deaths.enabled) ? `<span class="pin0"></span>` : `<button class="pin${pinned ? " on" : ""}${fav ? " fav" : ""}" data-pin="${c.id}" title="${pinned ? "Pinned favourite (protected)" : fav ? "Favourite — protected (tap to pin)" : "Pin as a protected favourite"}"><i>${pinned || fav ? "★" : "☆"}</i></button>`;
    const nr = inj ? null : needsOf(c.id), needs = nr ? `<div class="needs${openNeeds.has(c.id) ? " open" : ""}" data-needs="${c.id}" title="${SHIFT_NAME[nr.shift]} shift · ${statusOf(c.id)}">${CC.barsShown() ? NEED_KEYS.map(k => { const v = Math.round(nr.n[k]); return `<i title="${NEED_LABEL[k]} ${v}"><b class="${v < 25 ? "lo" : v < 50 ? "mid" : ""}" style="width:${v}%"></b></i>`; }).join("") : ""}<span>${statusOf(c.id)} · <em class="md b${bandOf(c.id)}">${bandLabel(bandOf(c.id))}</em></span><small class="nv">${SHIFT_NAME[nr.shift]} shift · ${CC.barsShown() ? NEED_KEYS.map(k => `${NEED_LABEL[k]} ${Math.round(nr.n[k])}`).join(" · ") : "needs: readable at Insight 3"}<br>Mood ${Math.round(moodOf(c.id))} (${bandLabel(bandOf(c.id))}) · station efficiency ${Math.round(effOf(c.id) * 100)}%<br>Quirks: ${quirkLine(c.id)}<br>Skills: ${skillLine(c.id)}</small></div>` : "";
    return `<div class="rel${inj ? " inj" : ""}">${face}<div class="nm">${c.rankShort} ${c.short}${c.intro ? ` <em class="newb">NEW</em>` : ""}${injTag}<small>${inj ? injNote : `${c.speciesName} · ${c.role}`}</small></div>${pin}<div class="opbar"><i class="${v >= 0 ? "pos" : "neg"}" style="width:${w}%"></i></div><small class="lab" title="7-day trend: ${st.trend.label}">${st.label}${IN.numbersShown() ? ` <b class="opn">${sgn(v)}</b>` : ""}<i class="tr t${st.trend.dir}">${st.trend.arrow}</i></small>${needs}</div>`;   // plog1 follow-up: label + trend, number hidden (as in the Personal Log)
  };
  const pend = G.prog.crew.pending;
  const groups = DEPT_ORDER.map(d => {
    const slots = CREW_ROSTER.filter(s => s.dept === d); if (!slots.length) return "";
    const rows = slots.map(s => byId[s.slot] ? rowOf(byId[s.slot]) : `<div class="rel vac"><span class="badge" style="background:#2a3348">–</span><div class="nm">Vacant<small>${s.role} · replacement en route${pend.some(p => p.slot === s.slot) ? "" : ""}</small></div></div>`).join("");
    return `<div class="dgrp"><div class="dh" style="--dc:${DEPTS[d].color}">${DEPTS[d].name.toUpperCase()}</div>${rows}</div>`;
  }).join("");
  const injN = G.prog.med.inj.length;
  setHtml("relations", `<h4>CREW RELATIONS <small>${list.length} aboard${injN ? ` · ${injN} in sickbay` : ""} · social points ${socialPoints()}</small></h4><div class="needsKey">Bars: rest · food · fun · social · comfort</div>${groups}`, force);
  // ---- phase 6: In Memoriam (only once someone has been lost) + crew safety settings ----
  const mem = G.prog.med.memorial;
  setHtml("memoriam", mem.length ? `<h4>IN MEMORIAM</h4>${mem.slice().reverse().map(e => `<div class="mem"><span class="mcross">✦</span><div><b>${e.name}</b><small>${e.species} · ${e.role} · lost on ship's day ${e.day} (SD ${e.sd})${e.plaque ? " · plaque by the lounge viewport" : ""}</small></div></div>`).join("")}<p class="cnote">Remembered by the crew of the Tenacity.</p>` : "", force);
  const gm = MD.gentle(), fn = favs.map(id => (list.find(c => c.id === id) || {}).short).filter(Boolean).join(" and ");
  if (!PROG.deaths.enabled) setHtml("safety", "", force); else setHtml("safety", `<h4>CREW SAFETY</h4><div class="req"><div>Gentle mode<small>${gm ? "On — if the worst happens, a crewmate is critically injured and evacuated to a hospital ship. Nobody is lost." : "Off — a serious injury can, rarely, cost a life: if the system stays down for 3 minutes after you've seen the alert, or on the operating table after the fix (never before day 14, never senior staff, at most one in 21 days of play)."}</small></div><button data-gentle="${gm ? "off" : "on"}">${gm ? "ON" : "OFF"}</button></div><p class="cnote">Protected favourites: ${fn || "—"} (★; tap ☆ on a crew row to pin up to ${PROG.deaths.protectFavourites}). Senior staff are always protected.</p>`, force);
  // ---- fleet reputation: ex-shipmates carry their opinion into the fleet ----
  const al = G.prog.alumni, ps = perkState();
  const perks = [ps.quartermaster ? `<li>Quartermaster's friend — ${alumRankShort(ps.quartermaster)} ${ps.quartermaster.short} (${POSTINGS[ps.quartermaster.posting].name}): DS9 pallets come faster</li>` : "",
    ps.goodword ? `<li>A good word — ${ps.goodword} ex-shipmate${ps.goodword > 1 ? "s" : ""} at +${PROG.fleet.perks.goodword.min}: board readiness +${ps.readiness}, early call-up odds ×${ps.callup.toFixed(2)}</li>` : ""].join("");
  const alRows = al.slice(-6).reverse().map(a => `<div class="alum"><span class="badge" style="background:${(SPECIES[a.species] || SPECIES.human).color}">${a.short.replace(/[^A-Za-z]/g, "").slice(0, 2)}</span><div>${alumRankShort(a)} ${a.short} <small>${POSTINGS[a.posting].name}</small></div><b class="${a.opinion >= 0 ? "pos" : "neg"}">${a.opinion > 0 ? "+" : ""}${a.opinion}</b></div>`).join("");
  setHtml("fleet", `<h4>FLEET REPUTATION <b class="frv">${G.prog.fleetRep}</b></h4><p class="cnote">${al.length ? `${al.length} ex-shipmate${al.length > 1 ? "s" : ""} serving elsewhere. Crew who leave carry their opinion of you into the fleet (+1 standing per 10 points); diplomatic visits add +${PROG.fleet.diplomatic}. Standing never goes down.` : "No ex-shipmates yet. Crew who transfer off carry their opinion of you into the fleet; friends there can do you favours."}</p>${perks ? `<ul class="perks">${perks}</ul>` : ""}${alRows}`, force);
  // ---- favours: spend reputation (never readiness) ----
  const favRows = PROG.favours.map(f => {
    const st = favourState(f.id);
    if (st.locked && !f.who && G.prog.fleetRep + 10 < f.fr) return "";                              // far-off favours stay hidden
    const who = f.who ? (st.who ? st.who.short : "crew") : st.contact ? `${alumRankShort(st.contact)} ${st.contact.short}` : "a fleet contact";
    return `<div class="req fav${st.ok ? "" : " off"}"><div>${f.name} <small>${f.desc} · ${who}${st.ok ? "" : ` · ${st.why}`}</small></div><button data-fav="${f.id}" ${st.ok ? "" : "disabled"}>${costText(st.cost || f.cost)}</button></div>`;
  }).join("");
  setHtml("favours", `<h4>FAVOURS</h4>${favRows}<p class="cnote">Reputation ${G.sp.rep} to spend · spending never lowers your board record</p>`, force);
  // ---- requisitions + parts sinks (DUTY sheet) ----
  const o = lockerOffer(), S = G.ship, K = PROG.sinks, ov = overhaulState();
  const kits = G.prog.requests.map(r => { const c = list.find(x => x.id === r.id); return c ? `<div class="req"><div>Fix ${c.short}'s ${r.item}<small>+${Math.max(1, Math.round(K.kit.opinion * (PROG.opinion.gainMult ?? 1)))} opinion with ${c.short} · their own kit, not ship's stores</small></div><button data-kit="${r.id}" ${canAfford({ parts: K.kit.parts }) ? "" : "disabled"}>${K.kit.parts} PARTS</button></div>` : ""; }).join("");
  setHtml("reqBox", `<h4>REQUISITIONS</h4>${o ? `<div class="req"><div>Parts locker expansion<small>capacity ${S.partsCap} → ${o.cap} spares · spending never lowers your board record</small></div><button data-req="locker" ${G.sp.rep >= o.rep ? "" : "disabled"}>${o.rep} REP</button></div>` : `<div class="req"><div>Parts locker fully expanded<small>capacity ${S.partsCap} spares</small></div></div>`}
    <div class="req"><div>Preventive overhaul<small>${ov.left ? `crew rested in ${Math.ceil(ov.left / 60)} min` : "the next fault comes 5 min later · Okafor approves"}</small></div><button data-sink="overhaul" ${ov.ok ? "" : "disabled"}>${K.overhaul.parts} PARTS</button></div>
    <div class="req"><div>Machine a torpedo casing<small>+1 torpedo (${S.torps}/${S.torpCap})</small></div><button data-sink="casing" ${casingOk() ? "" : "disabled"}>${K.casing.parts} PARTS</button></div>${kits}
    <div class="req"><div>Trade spares to the quartermaster<small>${PROG.rations.trade.parts} parts → ${PROG.rations.trade.rations} ${PROG.currency.unit} (a poor rate — he knows you're overstocked) · he takes up to ${PROG.rations.trade.perDay} parts a ship's day — ${CB.tradeLeft()} left today${CB.tradeAutoToday() ? ` (${CB.tradeAutoToday()} went on the standing order)` : ""} · ${PROG.currency.name} ${G.prog.rations}</small></div><button data-sink="trade" ${CB.tradeOk() ? "" : "disabled"}>${PROG.rations.trade.parts} PARTS</button></div>
    <div class="req"><div>Standing order: night-watch maintenance<small>while you're away, Okafor's crew spends spares above ${Math.round(K.maintain.above * 100)}% of the locker on preventive work (fewer faults waiting), and a full locker's surplus goes to the quartermaster at the trade-in rate${G.prog.sinks.n.maintain ? ` · ${G.prog.sinks.n.maintain} used so far` : ""}</small></div><button data-sink="maintain">${G.prog.sinks.maintainOn ? "ON" : "OFF"}</button></div>
    <p class="cnote">Reputation ${G.sp.rep} to spend · ${Math.round(G.prog.repLifetime)} earned in total · parts ${S.parts}/${S.partsCap}</p>`, force);
}

// ---- phase 4: the Lt's Quarters (CREW sheet box) + decor chooser (tap a slot on the deck, or a slot button here) ----
const pct = v => Math.round(v * 100);
// art batch 2: decor with cabin_v4 art shows its sprite; the rest keep the emoji placeholder
const decorIcon = d => d.art ? `<img class="dart" src="assets/decor-${d.id}.webp" alt="">` : d.icon;
function renderQuarters(force) {
  if (!$("#quarters")) return;
  const T = CB.tier(), tt = CB.totals(), c = G.prog.cabin, cur = PROG.currency;
  const rows = CB.slots().map(sl => { const id = c.placed[sl.id], d = id && CB.DECOR[id]; return `<button class="slotb${d ? " full" : ""}" data-slot="${sl.id}">${d ? `<i>${decorIcon(d)}</i>${d.name}` : `<i>＋</i>${CB.SLOT_NAMES[sl.type]}`}</button>`; }).join("");
  const st = CB.storage();
  setHtml("quarters", `<h4>LT'S QUARTERS <small>${T.name}</small></h4>
    <p class="cnote">Rest on your rack: <b>${CB.rackRest().toFixed(1)}</b> energy/s (comfort +${pct(tt.comfort)}%) · social +${pct(tt.social)}% · readiness +${tt.readiness} · catalogue ${pct(CB.completion())}% · ${cur.name} <b>${G.prog.rations}</b>${st.length ? ` · ${st.length} in storage` : ""}</p>
    <div class="slots">${rows}</div><div class="req fav"><div>Holodeck<small>Book a program for yourself or a crewmate (Rations)</small></div><button data-holo-open="1">OPEN</button></div>${(() => { const ds = CB.dinnerState(), K = PROG.cabin.dinner; return `<div class="req fav${ds.ok ? "" : " off"}"><div>Host a dinner in your quarters<small>+opinion with the ${K.guests} crew who like you least${ds.ok ? "" : ` · ${ds.why}`}</small></div><button data-sink="dinner" ${ds.ok ? "" : "disabled"}>${costText(K.cost)}</button></div>`; })()}${G.lt.deck !== "quarters" ? `<button class="goq" data-node="rack">Go to quarters ▸</button>` : ""}`, force);
}
let decorSlot = null;
// ---- phase 5: promotion board modal + specialisation picker ----
let boardResult = null;
// pass 06: the sickbay scene is shown live, over everything, while it runs; outcome stays until dismissed
let medKey = "";
function renderMedScene() {
  const sc = MD.sceneOf(), P = $("#medPanel"); if (!P) return;
  if (!sc) { if (!P.hidden) P.hidden = true; medKey = ""; return; }
  const left = MD.surgeryLeft(), total = PROG.deaths.surgery.scene, od = MD.surgeryOdds(), key = sc.phase + sc.id + (sc.phase === "surgery" ? Math.ceil(left * 2) + (od ? od.band + od.assist + od.held : "") : "");
  if (key === medKey && !P.hidden) return;
  medKey = key;
  const doc = MD.docName(sc.id);   // pass 08 leftover: never the patient as their own surgeon
  const head = `<div class="mhead"><b class="mx">✚</b><div><h3>SICKBAY</h3><small>${sc.name}</small></div></div>`;
  let body = "";
  if (sc.phase === "surgery") {
    const f = [sc.fast ? "✓ system restored fast" : sc.by === "crew" ? "· restored by the crew" : "· system restored", sc.exc ? `✓ Excellent repair${sc.exc > 1 ? ` ×${sc.exc}` : ""}` : "", sc.visited ? "✓ you sat with them" : "", od && od.assist ? "✓ you assisted" : ""].filter(Boolean);
    const band = od ? od.band : "touch and go", bc = band === "good chance" ? "good" : band === "grim" ? "grim" : "touch";
    // pass 07 (2)/(4): the odds as a band, a one-tap assist, and a line that never suggests stepping away helps
    body = `<p class="mline">${doc} works over the biobed. The monitors chirp, steady, then not, then steady again.</p>
      <div class="mbar"><i style="width:${Math.round((1 - left / total) * 100)}%"></i></div><p class="mfac">${f.join(" · ")}</p>
      <p class="odds ${bc}">${doc}: <b>${band}</b></p>
      ${od && !od.assist ? `<button class="assist" data-med="assist">ASSIST ${doc.toUpperCase()}</button>` : od ? `<p class="cnote">You're at ${doc.replace(/^The /, "the ")}'s side, holding the power steady.</p>` : ""}
      <p class="cnote">${od && od.held ? `${doc} is holding ${sc.short} stable on the table until you're back on watch — nothing changes while you're away.` : `The faster the repair, and every hand you lend, the better the odds.`}</p>`;
  } else if (sc.phase === "saved") body = `<div class="bres good">${sc.short.toUpperCase()} WILL LIVE</div><p class="mline">${doc}: '${sc.short} is going to make it.'${sc.close ? ` It was closer than ${sc.docPr || "they"} ${(sc.docPr || "they") === "they" ? "let" : "lets"} on.` : ""}</p><p class="cnote">${sc.short}'s opinion of you +${sc.d || 1}</p><button class="close" data-med="close">BACK TO DUTY</button>`;
  else if (sc.phase === "lost") body = `<div class="bres bad lost">IN MEMORIAM</div><p class="mline"><b>${sc.name}</b>, ${String(sc.role || "").toLowerCase()}.</p><p class="mline">${sc.why}</p>${sc.orvin ? `<p class="mline orvin">${sc.orvin}</p>` : ""}<p class="cnote">The crew will hold a service in the Mess &amp; Bar.</p><button class="close" data-med="close">STAND DOWN</button>`;
  else if (sc.phase === "evac" || sc.phase === "hospital") body = `<div class="bres warn">${sc.phase === "evac" ? "EVACUATED" : "HOSPITAL TRANSFER"}</div><p class="mline">${sc.short} is beamed to ${sc.post}. ${sc.phase === "evac" ? "Critically injured, but alive and in the best hands in the quadrant." : `Badly hurt; ${PRON(sc.pron)}'ll recover there.`}</p><button class="close" data-med="close">BACK TO DUTY</button>`;
  else if (sc.phase === "expired") body = `<div class="bres warn">PULLED THROUGH</div><p class="mline">${doc} never left the biobed. ${sc.short} will live, but recovery will take a while.</p><button class="close" data-med="close">BACK TO DUTY</button>`;
  $("#medBody").innerHTML = head + body;
  P.hidden = false;
}
function renderSafetyPrompt() {
  const id = G.prog.crew.slots.doctor, o = id && G.prog.crew.occ[id], doc = o ? `Dr. ${o.short}` : "the duty medic";
  $("#safetyBody").innerHTML = `<div class="mhead"><b class="mx sh">⛨</b><div><h3>CREW SAFETY</h3><small>A choice before it matters</small></div></div>
    <p class="mline">From day 14 of play, a seriously injured crewmate can — rarely — be lost, in one of two ways: the system sickbay needs stays down for the full 3 minutes after you've seen the alert, or ${doc} loses them on the table after the fix (a fast fix makes that unlikely). It only ever happens while you're here: the clock and any surgery pause whenever you're away, and a patient you never saw is always stabilised by the night crew and ${doc}.</p>
    <p class="mline"><b>Gentle mode</b>: if the worst happens, they are critically injured and evacuated to a hospital ship instead. Nobody is lost.</p>
    <p class="cnote">You can change this any time in CREW ▸ Crew safety.</p>
    <div class="mbtns"><button class="close" data-safety="standard">KEEP STANDARD</button><button class="close alt" data-safety="gentle">GENTLE MODE</button></div>`;
  $("#safetyPanel").hidden = false;
}
function autoModals() {
  renderMedScene();
  const busy = !$("#report").hidden || !$("#plogPanel").hidden || !$("#decorPanel").hidden || !$("#liftPanel").hidden || !$("#medPanel").hidden || !$("#safetyPanel").hidden || !$("#beatPanel").hidden || !$("#romPanel").hidden
    || !$("#bcCard").hidden;   // pass 15 L3: the safety prompt / board / spec / disclosure wait while the red-alert card is up (dismissed or auto-hidden after 7 s)
  if (!busy && $("#boardPanel").hidden && $("#specPanel").hidden && !G.sp.battle && MD.gentlePromptDue()) { renderSafetyPrompt(); return; }
  if (!busy && $("#boardPanel").hidden && $("#specPanel").hidden && !G.sp.battle && RM.pendingDisc()) { openRom({ mode: "disc" }); return; }
  if (!busy && $("#boardPanel").hidden && BD.boardWaiting() && !G.sp.battle) openBoard();   // pass 16 B2: never mid-fight (it waits for the all-clear, like the others)
  if (!busy && $("#boardPanel").hidden && $("#specPanel").hidden && BD.specPending() && (G.prog.specOffered || 0) < BD.specOwed() && !G.sp.battle) { G.prog.specOffered = BD.specOwed(); openSpec(); }
}
const mood = o => o.pass >= 0.7 ? "favourable" : o.pass >= 0.4 ? "uncertain" : "an uphill climb";
export function openBoard() {
  const s = BD.boardSummary(); if (!s) return;
  boardResult = null;
  const rows = s.rows.map(([k, v, d]) => `<div class="brow"><b>${k}</b><span>${v}</span><small>${d}</small></div>`).join("");
  $("#boardBody").innerHTML = `<div class="bhead"><img src="assets/${s.chair.img}.webp" alt=""><div><h3>PROMOTION BOARD</h3><small>${G.prog.rank >= 0 ? rankName() : ""} → <b>${s.to.name}</b> · chaired by ${s.chair.name}</small></div></div>
    ${s.queued ? `<p class="cnote bq">The board convened while you were off watch. It waited for you.</p>` : ""}
    <div class="bready"><span>Board readiness <b>${s.readiness}%</b></span><div class="rmeter"><i style="width:${s.readiness}%"></i></div></div>
    <div class="bsum">${rows}</div>
    <div class="blines">${s.lines.map(l => `<p>${l}</p>`).join("")}</div>
    <p class="cnote">${s.forced ? "Time in grade served — this board is a formality." : `The board's mood: <b>${mood(s.odds)}</b>${s.reason === "callup" ? " (an early call-up — the bar is the same)" : ""}.`}</p>
    <button class="close bface" data-board="face">FACE THE BOARD</button>`;
  $("#boardPanel").hidden = false;
}
function showBoardResult(r) {
  const head = { pass: ["RECOMMENDED", "good"], defer: ["DEFERRED", "warn"], fail: ["NOT RECOMMENDED", "bad"] }[r.outcome];
  $("#boardBody").innerHTML = `<div class="bhead"><img src="assets/${r.chair.img}.webp" alt=""><div><h3>PROMOTION BOARD</h3><small>${r.rank.name} · chaired by ${r.chair.name}</small></div></div>
    <div class="bres ${head[1]}">${head[0]}</div><div class="blines"><p>${r.line}</p></div><p class="cnote">${r.effect}</p>
    <button class="close" data-board="close">DISMISSED</button>`;
}
function boardClick(e) {
  const b = e.target.closest("[data-board]"); if (!b) return;
  if (b.dataset.board === "face") { const r = BD.resolveBoard(); if (r) { boardResult = r; showBoardResult(r); renderCareer(true); } else $("#boardPanel").hidden = true; }
  else { $("#boardPanel").hidden = true; boardResult = null; }
}
export function openSpec() {
  const n = BD.specPending(), lvl = PROG.specs.picks[(G.prog.specPicks || 0)] || G.prog.level;
  $("#specTitle").textContent = `SPECIALISATION · LEVEL ${lvl}`;
  const rows = BD.specOptions().map(o => {
    const tierTxt = o.tier ? `tier ${"I".repeat(o.tier)} now` : "";
    const eff = o.ok ? `${o.next > 1 ? `Tier ${"I".repeat(o.next)}: ` : ""}repairs +${Math.round(o.speed * 100)}% faster, Excellent +${Math.round(o.quality * 100)}%` : "fully trained";
    return `<div class="req dec spec${o.ok ? "" : " off"}"><i class="ico">${o.f.icon}</i><div>${o.f.name}${tierTxt ? ` <em class="tier">${tierTxt}</em>` : ""}<small>${o.f.desc} · ${eff}</small></div><button data-spick="${o.id}" ${o.ok && n ? "" : "disabled"}>${!o.ok ? "MAX" : o.tier ? "UPGRADE" : "PICK"}</button></div>`;
  }).join("");
  $("#specList").innerHTML = `<p class="cnote">${n ? `Okafor wants you to pick a lane. ${n > 1 ? `${n} picks waiting. ` : ""}A focus speeds your own repairs on its systems; pick it again later to upgrade it.` : "No pick waiting. Next pick at level " + (PROG.specs.picks.find(l => l > G.prog.level) || "—") + "."}</p>${rows}`;
  $("#specPanel").hidden = false;
}
function specClick(e) {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.spick) { if (BD.pickSpec(b.dataset.spick)) { renderCareer(true); if (BD.specPending()) openSpec(); else $("#specPanel").hidden = true; } }
  else if (b.dataset.spec === "later") $("#specPanel").hidden = true;
}
export function openDecor(slotId) {
  const sl = CB.slotById(slotId); if (!sl) return;
  decorSlot = slotId; renderDecor(); $("#decorPanel").hidden = false;
}
function renderDecor() {
  const sl = CB.slotById(decorSlot); if (!sl) return;
  const c = G.prog.cabin, curId = c.placed[sl.id], cur = curId && CB.DECOR[curId];
  $("#decorTitle").textContent = `${CB.SLOT_NAMES[sl.type].toUpperCase()} · QUARTERS`;
  const bon = d => Object.entries(d.bonus || {}).map(([k, v]) => k === "readiness" ? `readiness +${v}` : `${k} +${pct(v)}%`).join(", ");
  const items = CB.itemsForSlot(sl.type).map(d => {
    const s = CB.itemState(d.id);
    let btn;
    if (curId === d.id) btn = `<button data-dremove="1">REMOVE</button>`;
    else if (s.owned) btn = `<button data-dplace="${d.id}">${s.placed ? "MOVE HERE" : "PLACE"}</button>`;
    else if (!s.gate.ok) btn = `<button disabled>${s.gate.drop ? "FIND" : "LOCKED"}</button>`;
    else btn = `<button data-dbuy="${d.id}" ${s.canBuy ? "" : "disabled"}>${costText(d.cost)}</button>`;
    const note = s.owned ? (s.placed ? (curId === d.id ? "here now" : "placed elsewhere") : "in storage") : !s.gate.ok ? s.gate.why : "";
    return `<div class="req dec${!s.owned && !s.gate.ok ? " off" : ""}"><i class="ico">${decorIcon(d)}</i><div>${d.name}<small>${bon(d)}${note ? ` · ${note}` : ""}</small></div>${btn}</div>`;
  }).join("");
  $("#decorList").innerHTML = `<p class="cnote">${cur ? `Here now: <b>${cur.name}</b>.` : "Empty."} ${PROG.currency.name} <b>${G.prog.rations}</b> · Reputation <b>${G.sp.rep}</b></p>${items}`;
}
function decorClick(e) {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.dbuy) CB.buyItem(b.dataset.dbuy, decorSlot);
  else if (b.dataset.dplace) CB.placeItem(b.dataset.dplace, decorSlot);
  else if (b.dataset.dremove) CB.removeItem(decorSlot);
  else return;
  renderDecor(); renderCareer(true);
}

// ============================== Personal Log (phase 1: read-only) ==============================
let plogView = null;   // null = index, else { id }
const initials = o => (o.short || o.name || "?").replace(/[^A-Za-z]/g, "").slice(0, 2);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function plogFace(o, color) { return o.img ? `<img src="assets/${o.img}.webp" alt="">` : `<span class="badge" style="background:${color}">${esc(initials(o))}</span>`; }
export function openPlog(id = null) { PL.ensureSnapshot(); plogView = id ? { id } : null; renderPlog(); $("#plogPanel").hidden = false; $("#plogPanel .card").scrollTop = 0; }
function plogClick(e) {
  const b = e.target.closest("[data-pl],[data-pl-gift],[data-pl-give],[data-pl-buy],[data-pl-care],[data-pl-apol],[data-pl-beat],[data-rm]"); if (!b || b.disabled) return;
  const D = b.dataset, card = $("#plogPanel .card");
  if (D.plBeat) { openBeat(); return; }
  if (D.rm) { romAct(D.rm, D.rmId, D.rmK); return; }
  if (D.plApol) { const id = D.plApol, r = IN.apologise(id); plogView = { id, result: r.ok ? { line: `You apologised to ${G.prog.crew.occ[id].short}. It was accepted.` } : { why: r.why } }; renderPlog(); card.scrollTop = 0; renderCareer(true); return; }
  if (D.plGift) { plogView = { id: D.plGift, mode: "gift" }; renderPlog(); card.scrollTop = 0; return; }
  if (D.plGive) { const id = plogView.id, r = GF.giveGift(id, D.plGive); plogView = { id, result: r.ok ? r : { why: r.why } }; renderPlog(); card.scrollTop = 0; renderCareer(true); return; }
  if (D.plBuy) { GF.buyForLocker(D.plBuy); renderPlog(); renderCareer(true); return; }
  if (D.plCare) { const r = GF.sendCare(D.plCare); plogView = { id: D.plCare, result: r.ok ? { line: `Care package sent. ${r.r === "pleased" ? "Packed with things you know they like." : "A reply comes back, polite and brief."}` } : { why: r.why } }; renderPlog(); card.scrollTop = 0; renderCareer(true); return; }
  if (D.pl === "index") openPlog(); else if (D.pl === "insight") { plogView = { mode: "insight" }; renderPlog(); card.scrollTop = 0; } else if (D.pl === "locker") { plogView = { mode: "locker" }; renderPlog(); card.scrollTop = 0; } else openPlog(D.pl);
}
// ---- Personal Log phase 2: gift screens ----
const FR = () => PROG.currency.short;
const HINT = { loved: `<em class="gh love">♥ loves</em>`, liked: `<em class="gh like">♥ likes</em>`, disliked: `<em class="gh dis">✗ dislikes</em>` };
function giftRow(o, attr, label) {
  const it = o.it, T = o.tier;
  return `<button class="gift${o.ok ? "" : " off"}" ${attr}="${it.id}" ${o.ok ? "" : "disabled"}><span class="gi">${it.icon}</span><span class="nm">${esc(it.name)}${o.hint ? HINT[o.hint] : ""}<small>${T.name}${o.ok ? "" : ` · ${esc(o.why)}`}</small></span><span class="gp">${label}</span></button>`;
}
function renderGiftPicker(body, id) {
  const w = PL.whoOf(id), opts = GF.giftOptions(id), g = G.prog.gifts, occ = GF.occasionOf(w), shipN = g.day.d === G.prog.day ? g.day.n : 0;
  const locker = opts.filter(o => o.inLocker).map(o => giftRow(o, "data-pl-give", `×${o.inLocker}`)).join("");
  const galley = opts.filter(o => !o.inLocker && o.tier.src === "galley").map(o => giftRow(o, "data-pl-give", `${o.price} ${FR()}`)).join("");
  const ashore = opts.filter(o => !o.inLocker && o.tier.src !== "galley").map(o => giftRow({ ...o, ok: false, why: GF.buyState(o.it).ok ? "buy it in the gift locker first" : GF.buyState(o.it).why }, "data-pl-give", `${o.tier.cost} ${FR()}`)).join("");
  body.innerHTML = `<button class="plback" data-pl="${id}">‹ BACK</button><h3>A GIFT FOR ${esc(w.short.toUpperCase())}</h3>
    <p class="cnote">${G.prog.rations} ${FR()} · ship-wide today ${Math.min(shipN, PROG.gifts.shipFull)} of ${PROG.gifts.shipFull} at full value${occ ? ` · <b class="occ">${esc(occ.note)} (×${PROG.gifts.occasion})</b>` : ""}. ♥ marks what you know ${pr(w)} like${pr(w, "s")}.</p>
    ${locker ? `<div class="plh">FROM YOUR GIFT LOCKER</div>${locker}` : ""}<div class="plh">DELGADO'S GALLEY REPLICATOR</div>${galley}<div class="plh">ASHORE (VIA THE GIFT LOCKER)</div>${ashore}`;
}
function renderLocker(body) {
  const sh = GF.shopState(), inv = G.prog.gifts.inv, n = GF.lockerCount();
  const invRows = Object.entries(inv).map(([k, v]) => `<div class="req"><div>${GIFT[k].icon} ${esc(GIFT[k].name)} <small>${PROG.gifts.tiers[GIFT[k].tier].name} · ×${v}</small></div></div>`).join("");
  const shopRow = it => { const st = GF.buyState(it); return giftRow({ it, tier: PROG.gifts.tiers[it.tier], ok: st.ok, why: st.why, hint: null }, "data-pl-buy", `${PROG.gifts.tiers[it.tier].cost} ${FR()}`); };
  const where = sh.docked ? "Docked at Deep Space Nine: the Promenade shops are open." : sh.homeworld ? `In orbit of ${DESTS[sh.homeworld].name}: treasured gifts for sale (Lt and up).` : "Underway. The Promenade opens when we dock at DS9; treasured gifts are bought on homeworld visits.";
  body.innerHTML = `<button class="plback" data-pl="index">‹ BACK</button><h3>GIFT LOCKER</h3><p class="cnote">${esc(where)} ${G.prog.rations} ${FR()} · locker ${n}/${PROG.gifts.invMax}.</p>
    <div class="plh">IN THE LOCKER</div>${invRows || `<p class="plnote">Empty. Galley gifts are replicated as you give them.</p>`}
    <div class="plh">DS9 PROMENADE · PERSONAL</div>${GIFT_ITEMS.filter(i => i.tier === "personal").map(shopRow).join("")}
    <div class="plh">HOMEWORLDS · TREASURED</div>${GIFT_ITEMS.filter(i => i.tier === "treasured").map(shopRow).join("")}`;
}
function giftSections(id, w, aboard) {
  const g = G.prog.gifts, kt = GF.knownTastes(id); if (!kt) return "";
  const known = `<div class="plsec">KNOWN TASTES</div><div class="plfacts tastes"><div>Likes<b class="k${kt.likes[0].state}">${esc(kt.likes[0].text)}</b></div><div>Also likes<b class="k${kt.likes[1].state}">${esc(kt.likes[1].text)}</b></div><div>Dislikes<b class="k${kt.dislike.state}">${esc(kt.dislike.text)}</b></div>${kt.avoid ? `<div class="wide">Sore subject<b class="k${kt.avoid.state}">${esc(kt.avoid.text)}</b></div>` : ""}</div>
    ${kt.likes.every(x => !x.state) && !kt.dislike.state ? `<p class="plnote">You'll learn ${pr(w, "pos")} tastes from how ${pr(w)} react${pr(w, "s")} to gifts, and from what you notice in conversation (Insight).</p>` : ""}`;
  const lr = g.lastR[id], last = lr ? `Last: ${lr.item === "care" ? "a care package" : esc(GIFT[lr.item].name.toLowerCase())}, ${lr.r} (ship's day ${lr.day})` : "No gifts yet.";
  if (aboard) {
    const st = GF.giveState(id), occ = GF.occasionOf(w);
    return `<div class="plsec">GIFTS</div><div class="req"><div>${last}<small>${st.ok ? "Ready" : esc(st.why)}${occ ? ` · <b class="occ">${esc(occ.note)}</b>` : ""} · one gift every ${PROG.gifts.cooldown} ship's days</small></div><button data-pl-gift="${id}" ${st.ok ? "" : "disabled"}>GIVE A GIFT</button></div>${known}`;
  }
  if (w.where !== "alum") return "";
  const st = GF.careState(id), sent = Math.round((g.care[id] || 0) * 10) / 10;
  return `<div class="plsec">CARE PACKAGE</div><div class="req"><div>${last}<small>${sent ? `+${sent} of +${PROG.gifts.care.max} so far` : `Up to +${PROG.gifts.care.max} opinion in total`} · Fleet Reputation already banked stays as it is${st.ok ? "" : ` · ${esc(st.why)}`}</small></div><button data-pl-care="${id}" ${st.ok ? "" : "disabled"}>SEND · ${PROG.gifts.care.cost} ${FR()}</button></div>${known}`;
}
// ---- Personal Log phase 3: Insight ----
const quirkLine = id => { const all = quirkNames(id), sh = CC.quirksShown(id); if (!all.length) return IN.level() >= 2 ? "none" : "unknown until Insight 2";
  return sh.length ? sh.join(", ") + (sh.length < all.length ? " · more at Insight 3" : "") : "unknown until Insight 2"; };
const sgn = v => { const r = Math.round(v); return r > 0 ? `+${r}` : `${r}`; };
function insightBar() { const x = IN.xpBand(); return `<div class="inbar"><i style="width:${Math.round(x.frac * 100)}%"></i></div>`; }
function insightRow() {
  if (!PROG.insight.enabled) return "";
  const l = IN.level(), x = IN.xpBand(), b = IN.pending(), o = b && G.prog.crew.occ[b.id];
  const apols = Object.keys(G.prog.insight.apol).filter(id => (IN.apologyState(id) || {}).ok);
  return `<button class="plrow insb" data-pl="insight"><span class="badge" style="background:#7a5fc0">◉</span><span class="nm">INSIGHT ${l}<small>${x.hi == null ? "the most you can read people" : `${x.xp - x.lo}/${x.hi - x.lo} to Insight ${l + 1}`} · hints ${Math.round(IN.hintChance() * 100)}% a chat</small></span><span class="pls">${insightBar()}</span></button>`
    + (o ? `<button class="plrow beatr" data-pl-beat="1"><span class="badge" style="background:#3a6f8a">💬</span><span class="nm">${esc(o.short)} has something on ${pr(o, "pos")} mind<small>a conversation, today only</small></span><span class="pls">›</span></button>` : "")
    + apols.map(id => { const c = G.prog.crew.occ[id]; return `<button class="plrow apolr" data-pl="${id}"><span class="badge" style="background:#8a5a3a">✎</span><span class="nm">Make it right with ${esc(c.short)}<small>an apology is still welcome</small></span><span class="pls">›</span></button>`; }).join("");
}
function insightActs(id, w) {
  const b = IN.pending(), ap = IN.apologyState(id); let h = "";
  if (b && b.id === id) h += `<div class="req"><div>${esc(w.short)} has something on ${pr(w, "pos")} mind<small>a conversation, today only</small></div><button data-pl-beat="1">💬 TALK</button></div>`;
  if (ap) h += `<div class="req"><div>You said the wrong thing<small>${ap.ok ? "an apology now would mend it" : esc(ap.why)}</small></div><button data-pl-apol="${id}" ${ap.ok ? "" : "disabled"}>APOLOGISE</button></div>`;
  return h;
}
function renderInsight(body) {
  const I = G.prog.insight, l = IN.level(), x = IN.xpBand(), X = PROG.insight.xp;
  const un = IN.unlocks().map(u => `<li class="${u.on ? "on" : "off"}"><i>${u.on ? "✓" : "🔒"}</i>${esc(u.text)}${u.on ? "" : ` <small>Insight ${u.at}</small>`}</li>`).join("");
  const src = [[`Talking with the crew`, `+${X.chat} a chat · +${X.chatEmpath} with Rhovan or Delgado`, I.n.chat], [`Giving gifts`, `+${X.gift} a gift · +${X.firstReaction} the first time you see a reaction`, I.n.gift + I.n.react],
    [`Experience`, `+${X.per5Levels} every 5 levels`, I.n.level], [`Your quarters`, `+${X.decorDay} a day each for a 3-D chess set or holo-novel library`, I.n.decor]]
    .map(([a, b, n]) => `<li><b>${a}</b> <small>${b}</small><span>${n}</span></li>`).join("");
  const notes = I.notes.slice().reverse().map(e => `<p class="plj"><small>Day ${e.d}</small>${esc(e.t)}.</p>`).join("");
  body.innerHTML = `<button class="plback" data-pl="index">‹ BACK</button><h3>INSIGHT ${l}</h3>
    <div class="inhead">${insightBar()}<small>${x.hi == null ? `${x.xp} · maximum` : `${x.xp - x.lo} / ${x.hi - x.lo} to Insight ${l + 1}`}</small></div>
    <p class="cnote">How well you read people. It never changes how they feel about you; it changes what you notice.</p>
    <div class="plsec">WHAT IT GIVES YOU</div><ul class="inul">${un}</ul>
    <div class="plsec">HOW IT GROWS</div><ul class="inul src">${src}</ul>
    <div class="plsec">THINGS YOU'VE NOTICED</div>${notes || `<p class="plnote">Nothing yet. Stop and talk to people.</p>`}
    <p class="plnote">Hints ${I.n.hints} (${I.n.full} exact) · conversations ${I.n.beats} · missteps ${I.n.missteps} · apologies ${I.n.apologies}</p>`;
}
let beatRes = null;
export function openBeat() { if (!IN.pending()) return; beatRes = null; renderBeat(); $("#beatPanel").hidden = false; }
function renderBeat() {
  const v = IN.beatView(), el = $("#beatBody");
  if (beatRes) { el.innerHTML = `<div class="bres ${beatRes.good ? "good" : "bad"}">${beatRes.good ? "WELL READ" : "WRONG THING TO SAY"}</div><p class="mline">${esc(beatRes.line)}</p><button class="close" data-beat="close">BACK TO DUTY</button>`; return; }
  if (!v) { $("#beatPanel").hidden = true; return; }
  const o = v.who, face = o.img ? `<img src="assets/${o.img}.webp" alt="">` : `<span class="badge" style="background:${(SPECIES[o.species] || SPECIES.human).color}">${esc(o.short.slice(0, 2))}</span>`;
  el.innerHTML = `<div class="bhd">${face}<div><h3>${esc(o.short.toUpperCase())}</h3><small>a moment between shifts</small></div></div><p class="mline">${esc(v.q)}</p>
    <div class="breps">${v.replies.map(r => `<button class="brep${r.flag ? " warn" : ""}" data-beat="${r.j}">${r.flag ? `<b class="wf">⚠</b>` : ""}${esc(r.text)}${r.flag ? `<small>Your Insight: this would land badly</small>` : ""}</button>`).join("")}</div>
    <button class="close" data-beat="later">NOT NOW</button>`;
}
function beatClick(e) {
  const b = e.target.closest("[data-beat]"); if (!b) return; const k = b.dataset.beat;
  if (k === "close" || k === "later") { $("#beatPanel").hidden = true; beatRes = null; return; }
  const v = IN.beatView(); if (!v) return; const o = v.who, r = IN.answerBeat(+k); if (!r) return;
  beatRes = { good: r.good, line: r.good ? `${o.short} relaxes. 'Thank you, ${addr()}.' (+opinion)` : `${o.short} goes quiet. (−opinion) Tomorrow you can apologise from the Personal Log.` };
  renderBeat(); renderCareer(true); lastChips = "";
}
// ---- Personal Log phase 4: romance ----
function romanceRows() {
  const r = G.prog.romance, sg = RM.pendingSignal(), ls = RM.letterState();
  let h = "";
  if (r.opt === null) h += `<div class="romask"><b>Allow romantic storylines?</b><small>Off unless you say yes. Someone may then let you know they're interested; saying no never costs anything. PG, and you can change this any time here.</small><div class="mbtns"><button data-rm="opt" data-rm-k="0">NOT FOR ME</button><button class="alt" data-rm="opt" data-rm-k="1">ALLOW</button></div></div>`;
  if (sg) { const o = G.prog.crew.occ[sg.id]; h += `<button class="plrow romr" data-rm="signal"><span class="badge" style="background:#9a4a6a">💌</span><span class="nm">${esc(o.short)} would like a word<small>something personal</small></span><span class="pls">›</span></button>`; }
  if (ls && ls.waiting) { const a = PL.whoOf(ls.id); h += `<button class="plrow romr" data-pl="${ls.id}"><span class="badge" style="background:#6a5a9a">✉</span><span class="nm">A letter from ${esc(a.short)}<small>waiting for your reply</small></span><span class="pls">›</span></button>`; }
  if (r.opt !== null) h += `<button class="plrow romt" data-rm="opt" data-rm-k="${r.opt ? 0 : 1}"><span class="badge" style="background:#4a3a5a">♡</span><span class="nm">Romantic storylines: ${r.opt ? "ON" : "OFF"}<small>${r.opt ? (RM.partner() ? `with ${esc(G.prog.crew.occ[RM.partner()].short)}` : "anyone may let you know they're interested") : "friendships only"}</small></span><span class="pls">${r.opt ? "TURN OFF" : "TURN ON"}</span></button>`;
  return h;
}
function bondSection(id, w, aboard) {
  const v = RM.bondView(id); if (!v.eligible || v.opt === null) return v.stage === "lost" || (w.where === "alum" && RM.lettersOf(id).length) ? lettersSection(id, w) : "";
  if (!aboard) return lettersSection(id, w);
  if (!v.opt && !v.partner) return "";
  let h = `<div class="plsec">BOND</div>`;
  const st = v.partner ? RM.STAGE_LABEL[v.stage] : v.fo ? "Friends only" : v.stage === "ended" ? RM.STAGE_LABEL.ended : v.declined ? "Friends (you said you'd rather stay friends)" : "Friends";
  h += `<div class="req"><div>${esc(st)}${v.partner && v.b ? `<small>${v.b.dates} evening${v.b.dates === 1 ? "" : "s"} together${v.b.disclosed ? ` · disclosure filed (${v.b.disclosed === "outrank" ? "Okafor writes the evaluations" : "the captain knows"})` : ""}</small>` : `<small>${v.fo ? `${esc(w.short)} will never be asked about romance` : "friendship counts exactly as it always has"}</small>`}</div>
    <button class="fo${v.fo ? " on" : ""}" data-rm="fo" data-rm-id="${id}" data-rm-k="${v.fo ? 0 : 1}">${v.fo ? "☑" : "☐"} FRIENDS ONLY</button></div>`;
  if (v.signal) h += `<div class="req"><div>${esc(w.short)} would like a word<small>something personal</small></div><button data-rm="signal">💌 LISTEN</button></div>`;
  if (v.declined && !v.fo) h += `<div class="req"><div>Changed your mind?<small>${esc(w.short)} won't ask again unless you reopen it</small></div><button data-rm="reopen" data-rm-id="${id}">REOPEN</button></div>`;
  if (v.partner) {
    h += `<div class="plh">SPEND TIME TOGETHER</div>` + RM.dateOptions(id).map(o => `<div class="req"><div>${o.label}<small>${o.ok ? (o.cost ? `${o.cost} rations` : "free") : esc(o.why)}</small></div><button data-rm="date" data-rm-id="${id}" data-rm-k="${o.k}" ${o.ok ? "" : "disabled"}>GO</button></div>`).join("");
    h += `<div class="req"><div>Opinion counts at most +${PROG.romance.friendCap} toward your board readiness${G.prog.rank >= PROG.romance.authorityRank && !RM.isSenior(id) ? " (0 now: you hold authority)" : ""}<small>a partner is never a readiness shortcut</small></div><button data-rm="end" data-rm-id="${id}">END IT GENTLY</button></div>`;
  }
  return h;
}
function lettersSection(id, w) {
  if (!RM.enabled()) return "";   // pass 11 HOLD 1: no letters on show while romantic storylines are off
  const L = RM.lettersOf(id), ls = RM.letterState(); if (!L.length && !(ls && ls.id === id)) return "";
  const rows = L.slice().reverse().map(l => `<p class="pll ${l.from}"><small>Day ${l.d} · ${l.from === "them" ? esc(w.short) : "you"}</small>${esc(l.t)}</p>`).join("");
  const act = ls && ls.id === id && ls.waiting ? `<div class="mbtns lbtns"><button data-rm="letter" data-rm-k="warm">WRITE BACK, WARMLY</button><button data-rm="letter" data-rm-k="light">KEEP IT LIGHT</button><button class="alt2" data-rm="letter" data-rm-k="end">LET IT END WARMLY</button></div>` : ls && ls.id === id ? `<p class="plnote">Next letter in about ${Math.max(1, ls.next - G.prog.playDays)} day${ls.next - G.prog.playDays > 1 ? "s" : ""} of play.</p>` : "";
  return `<div class="plsec">${w.where === "lost" ? "LETTERS, KEPT" : "LETTERS"}</div>${act}${rows}`;
}
function romAct(k, id, x) {
  const card = $("#plogPanel .card");
  if (k === "opt") { RM.setOpt(x === "1"); renderPlog(); renderCareer(true); renderLog(); return; }
  if (k === "signal") { openRom({ mode: "signal" }); return; }
  if (k === "fo") { RM.setFriendsOnly(id, x === "1"); renderPlog(); return; }
  if (k === "reopen") { RM.reopen(id); renderPlog(); return; }
  if (k === "end") { RM.endIt(id); plogView = { id, result: { line: `You and ${G.prog.crew.occ[id].short} are friends again.` } }; renderPlog(); card.scrollTop = 0; renderCareer(true); return; }
  if (k === "date") { const r = RM.goOnDate(id, x); if (!r.ok) { plogView = { id, result: { why: r.why } }; renderPlog(); return; } openRom({ mode: "date", id, r }); renderPlog(); renderCareer(true); return; }
  if (k === "letter") { RM.replyLetter(x); renderPlog(); return; }
}
let romView = null;
function romFace(o) { return o.img ? `<img src="assets/${o.img}.webp" alt="">` : `<span class="badge" style="background:${(SPECIES[o.species] || SPECIES.human).color}">${esc(o.short.slice(0, 2))}</span>`; }
export function openRom(v) { romView = v; renderRom(); }
function renderRom() {
  const el = $("#romBody"), v = romView, P = $("#romPanel"); if (!v) { P.hidden = true; return; }
  if (v.mode === "signal") {
    const s = RM.pendingSignal(); if (!s && !v.res) { P.hidden = true; return; }
    if (v.res) { el.innerHTML = `<div class="bres ${v.res.yes ? "good rom" : ""}">${v.res.yes ? "SOMETHING NEW" : "FRIENDS"}</div><p class="mline">${esc(v.res.line)}</p>${v.res.note ? `<p class="cnote">${esc(v.res.note)}</p>` : ""}<button class="close" data-rom="close">BACK TO DUTY</button>`; P.hidden = false; return; }
    const o = G.prog.crew.occ[s.id];
    el.innerHTML = `<div class="bhd">${romFace(o)}<div><h3>${esc(o.short.toUpperCase())}</h3><small>off duty, a quiet corner</small></div></div><p class="mline">${esc(s.line)}</p>
      <div class="breps"><button class="brep yes" data-rom="yes">Yes. I'd like that.</button><button class="brep" data-rom="no">I'd rather stay friends.<small>Nothing changes between you, and ${esc(o.short)} won't ask again.</small></button></div><button class="close" data-rom="close">LATER</button>`;
  } else if (v.mode === "date") {
    const o = G.prog.crew.occ[v.id], r = v.r;
    el.innerHTML = `<div class="bhd">${romFace(o)}<div><h3>${esc(o.short.toUpperCase())}</h3><small>${{ dinner: "dinner in your quarters", promenade: "the Promenade, DS9", holosuite: "holosuite 3" }[r.k]}</small></div></div>
      ${r.lines.map(t => `<p class="mline">${esc(t)}</p>`).join("")}${r.fade ? `<div class="fade"><p>${esc(r.fade)}</p></div>` : ""}${r.up ? `<p class="cnote rup">${{ courting: "You're courting now.", together: "You're together now." }[r.up] || ""}</p>` : ""}<button class="close" data-rom="close">GOOD NIGHT</button>`;
  } else if (v.mode === "disc") {
    const d = RM.pendingDisc(); if (!d && !v.done) { P.hidden = true; return; }
    if (v.done) { el.innerHTML = `<div class="bres good">DISCLOSURE FILED</div><p class="mline">${esc(v.done)}</p><button class="close" data-rom="close">BACK TO DUTY</button>`; P.hidden = false; return; }
    const o = G.prog.crew.occ[d.id];
    el.innerHTML = `<div class="mhead"><b class="mx sh">⚖</b><div><h3>DISCLOSURE</h3><small>${d.kind === "outrank" ? "chain of command" : "to the captain"}</small></div></div>
      <p class="mline">${d.kind === "outrank" ? `As a Lieutenant Commander you now assign stations, and that includes ${esc(o.short)}'s. Starfleet asks for one thing: say so.` : `${esc(o.short)} is a senior officer outside your board chain. A short note to Captain T'Ren keeps everything above board.`}</p>
      <p class="cnote">${d.kind === "outrank" ? `${esc(o.short)}'s evaluations go to Commander Okafor, and ${pr(o, "pos")} opinion of you stops counting toward your board readiness. This is the normal path, not a penalty.</p><p class="cnote">Okafor: 'Most officers who make Lieutenant Commander file one of these sooner or later. It's paperwork, not a mark against you.'` : `Nothing else changes: ${pr(o, "pos")} opinion still counts at most +${PROG.romance.friendCap}, like any friend's.`}</p>
      <button class="close" data-rom="file">FILE THE DISCLOSURE</button>`;
  }
  P.hidden = false;
}
function romClick(e) {
  const b = e.target.closest("[data-rom]"); if (!b) return; const k = b.dataset.rom;
  if (k === "close") { $("#romPanel").hidden = true; romView = null; lastChips = ""; if (!$("#plogPanel").hidden) renderPlog(); return; }
  if (k === "yes" || k === "no") { const s = RM.pendingSignal(), o = s && G.prog.crew.occ[s.id], r = RM.answerSignal(k === "yes"); if (!r) return;
    romView = { mode: "signal", res: { yes: r.yes, line: r.line, note: r.note } };   /* the line comes from romance.js, through the quiet-period gate */ renderRom(); lastChips = ""; renderCareer(true); return; }
  if (k === "file") { const d = RM.pendingDisc(), o = d && G.prog.crew.occ[d.id], r = RM.fileDisclosure(); if (!r) return; romView = { mode: "disc", done: r.kind === "outrank" ? `Okafor countersigns it without comment, then adds: 'Good. That's how it's done.' ${o.short}'s evaluations are hers now.` : `T'Ren reads it once. 'Noted, ${addr()}. Keep it off my bridge.'` }; renderRom(); renderCareer(true); }
}
const bar = (v, frozen) => `<div class="opbar${frozen ? " frozen" : ""}"><i class="${v >= 0 ? "pos" : "neg"}" style="width:${Math.abs(v) / 2}%"></i></div>`;
function renderPlog() {
  const body = $("#plogBody"); if (!body) return;
  if (!plogView) {
    const list = crewList(), al = G.prog.alumni.slice().reverse(), mem = G.prog.med.memorial.slice().reverse();
    const seen = new Set(), alU = al.filter(a => !seen.has(a.id) && !list.some(c => c.id === a.id) && seen.add(a.id));
    const rows = DEPT_ORDER.flatMap(d => list.filter(c => c.dept === d)).map(c => { const s = PL.standing(c.id);
      return `<button class="plrow" data-pl="${c.id}">${plogFace(c, c.color)}<span class="nm">${c.rankShort} ${esc(c.short)}<small>${c.role.split(" ·")[0]}</small></span><span class="pls">${s.label}<i class="tr t${s.trend.dir}">${s.trend.arrow}</i></span></button>`; }).join("");
    const alRows = alU.map(a => `<button class="plrow alum" data-pl="${a.id}">${plogFace(a, (SPECIES[a.species] || SPECIES.human).color)}<span class="nm">${alumRankShort(a)} ${esc(a.short)}<small>${POSTINGS[a.posting].name}</small></span><span class="pls">${opinionLabel(a.opinion)}${a.opinion >= PROG.fleet.contactMin ? ' <i class="ok">✓</i>' : ""}</span></button>`).join("");
    const memRows = mem.map(m => `<button class="plrow lost" data-pl="${m.id}"><span class="badge" style="background:#3a4560">${m.partner && RM.enabled() ? "♥" : "✦"}</span><span class="nm">${esc(m.name)}<small>${m.role} · lost ship's day ${m.day}${m.partner ? (RM.enabled() ? " · your partner" : " · a close friend") : ""}</small></span><span class="pls"></span></button>`).join("");
    body.innerHTML = `<h3>PERSONAL LOG</h3><p class="cnote">Stardate ${G.ship.stardate.toFixed(1)}. My own notes on the people I serve with. Tap a name.</p>
      <button class="plrow lockerb" data-pl="locker"><span class="badge" style="background:#3a4f7a">🎁</span><span class="nm">GIFT LOCKER<small>${GF.lockerCount()}/${PROG.gifts.invMax} · ${GF.shopState().docked ? "the DS9 Promenade is open" : GF.shopState().homeworld ? "homeworld shops open" : "Promenade and homeworld gifts"}</small></span><span class="pls">›</span></button>
      ${romanceRows()}${insightRow()}
      <div class="plh">ABOARD · ${list.length}</div>${rows}
      ${alRows ? `<div class="plh">FORMER SHIPMATES · ${alU.length}</div>${alRows}` : ""}${memRows ? `<div class="plh">IN MEMORIAM</div>${memRows}` : ""}`;
    return;
  }
  if (plogView.mode === "locker") return renderLocker(body);
  if (plogView.mode === "insight") return renderInsight(body);
  if (plogView.mode === "gift") return renderGiftPicker(body, plogView.id);
  const id = plogView.id, w = PL.whoOf(id), aboard = w.where === "aboard", c = aboard ? crewList().find(x => x.id === id) : null;
  const sl = SLOTMAP[w.slot] || {}, dept = DEPTS[sl.dept || w.dept] || { color: "#5a6a8a", name: "" }, sp = (SPECIES[w.species] || {}).name || w.species || "";
  const title = aboard ? `${c.rankShort} ${esc(w.name)}` : w.where === "alum" ? `${alumRankShort(w)} ${esc(w.name)}` : esc(w.name);
  const head = `<div class="plhead" style="--dc:${dept.color}">${plogFace(w, aboard ? c.color : (SPECIES[w.species] || SPECIES.human).color)}<div><b>${title}</b><small>${esc(sp)} · ${esc((sl.role || w.role || "").split(" ·")[0])}${dept.name ? ` · ${dept.name}` : ""} · ${pr(w)}/${pr(w, "obj")}</small></div></div>`;
  let stand = "";
  if (aboard) { const s = PL.standing(id); stand = `<div class="plsec">STANDING</div><div class="plstand">${bar(s.v)}<span>${s.label}${IN.numbersShown() ? ` <b class="opn">${sgn(s.v)}</b>` : ""}</span><i class="tr t${s.trend.dir}">${s.trend.arrow} ${s.trend.label}</i></div>${insightActs(id, w)}`; }
  else if (w.where === "alum") {
    const ok = w.opinion >= PROG.fleet.contactMin;
    stand = `<div class="plsec">STANDING · FROZEN WHEN ${pr(w).toUpperCase()} LEFT</div><div class="plstand">${bar(w.opinion, true)}<span>${opinionLabel(w.opinion)}</span></div>
      <div class="plfacts"><div>Posting<b>${POSTINGS[w.posting].name}</b></div><div>Rank now<b>${alumRankShort(w)}</b></div><div>Favour contact<b class="${ok ? "ok" : ""}">${ok ? "✓ will help" : "not yet"}</b></div><div>Left<b>ship's day ${w.leftDay}</b></div></div>`;
  } else if (w.where === "lost") stand = `<div class="plsec">IN MEMORIAM</div><p class="plnote">Lost on ship's day ${w.day} (SD ${w.sd})${w.plaque ? ". A plaque hangs by the lounge viewport." : "."}</p>${w.partner && RM.enabled() ? `<p class="plhw">Personal log, supplemental. ${esc(w.short)} and I were together. I don't have a regulation for this, and I don't want one. I'm keeping ${RM.lettersOf(id).length ? "the letters, and " : ""}the mug, and the habit of looking for ${pr(w, "obj")} in the mess.</p>` : ""}`;
  const hw = w.where === "alum" && PL.HANDWRITTEN[id] ? `<div class="plsec">PERSONAL LOG, SUPPLEMENTAL</div>${PL.HANDWRITTEN[id].map(t => `<p class="plhw">${esc(t)}</p>`).join("")}` : "";
  const mv = PL.moved(id);
  const moved = aboard || mv.length ? `<div class="plsec">WHAT MOVED IT</div>${mv.length ? `<ul class="plmv">${mv.map(m => `<li class="${m.dir > 0 ? "up" : m.dir < 0 ? "dn" : "eq"}"><i>${m.dir > 0 ? "▲" : m.dir < 0 ? "▼" : "•"}</i>${esc(m.text)}${m.n > 1 ? ` <small>×${m.n}</small>` : ""}</li>`).join("")}</ul>` : `<p class="plnote">Nothing yet. Fix ${pr(w, "pos")} systems, share a deck, stop to talk.</p>`}` : "";
  const jr = PL.journalOf(id);
  const journal = `<div class="plsec">JOURNAL</div>${jr.length ? jr.map(j => `<p class="plj"><small>${j.sd != null ? `SD ${j.sd.toFixed(1)}` : `Day ${j.day}`}</small>${esc(j.text)}</p>`).join("") : `<p class="plnote">No entries yet.</p>`}`;
  const res = plogView.result, banner = res ? `<div class="plres${res.why ? " bad" : res.r === "uncomfortable" ? " dis" : ""}">${esc(res.why || res.line)}${res.learned && res.learned.length ? `<small>You learned: ${esc(res.learned.join("; "))}</small>` : ""}</div>` : "";
  body.innerHTML = `<button class="plback" data-pl="index">‹ BACK</button>${banner}${head}${stand}${aboard ? careHtml(id) : ""}${bondSection(id, w, aboard)}${giftSections(id, w, aboard)}${hw}${moved}${journal}`;
}
