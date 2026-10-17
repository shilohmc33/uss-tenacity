// DOM HUD: stat bar, alert chip, orders, duty list, crew cards, chips, log, toasts, lift panel, report.
import { G } from "../state.js";
import { DECKS, DECK_ORDER, SYSTEMS, NODEMAP, SEV_LABEL, PRI_LABEL, OFFICERS, DESTS } from "../data.js";
import { on } from "../bus.js";
import { dutyItems, shieldCap } from "../faults.js";
import { voyageView } from "../voyage.js";
import { sendUse, sendRepair, sendLiftPanel, rideLiftTo, playerInEngineering, ltStatus } from "../crew.js";
import { BR } from "../battle.js";
import { ltScreenFrac } from "../render/deck.js";

const $ = s => document.querySelector(s);
const STATS = [
  { k: "hull", label: "HULL", c: "#9fe8b1" }, { k: "shields", label: "SHIELDS", c: "#99ccff", tap: "shield" },
  { k: "power", label: "POWER", c: "#ffcc66", tap: "core" }, { k: "parts", label: "PARTS", c: "#cc99cc", tap: "locker" },
  { k: "torps", label: "TORPEDOES", c: "#ff9966", tap: "torpbay" }, { k: "energy", label: "LT ENERGY", c: "#66e0d0" },
  { k: "rep", label: "REPUTATION", c: "#ffaa77" },
];
export function buildHud() {
  $("#stats").innerHTML = STATS.map(s => `<div class="stat ${s.tap ? "tap" : ""}" data-stat="${s.k}" style="--c:${s.c}"><div class="k">${s.label}</div><div class="v" id="v-${s.k}"></div>${s.k === "torps" ? `<div class="pips" id="pips"></div>` : `<div class="m"><i id="m-${s.k}"></i></div>`}</div>`).join("");
  $("#stats").addEventListener("click", e => {
    const el = e.target.closest(".stat"); if (!el) return;
    const s = STATS.find(x => x.k === el.dataset.stat); if (s && s.tap) sendUse(s.tap);
  });
  $("#crewBar").innerHTML = OFFICERS.map(o => `<div class="crew" id="crew-${o.id}"><img src="assets/${o.img}.webp" alt="${o.who}"><div><div class="n">${o.who}</div><div class="r">${o.role}</div><div class="a">${o.ability} — <span class="r">${o.desc}</span></div><div class="s" id="cs-${o.id}"></div></div></div>`).join("");
  on("log", addLogLine);
  on("toast", showToast);
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
export function renderLog() { const ol = $("#log"); ol.innerHTML = ""; for (const e of G.log.slice(-120)) addLogLine(e); }
function addLogLine(e) {
  const ol = $("#log"), li = document.createElement("li");
  li.className = e.cls || ""; li.innerHTML = `<span class="sd">${e.sd}</span>`; li.appendChild(document.createTextNode(e.msg));
  ol.prepend(li);
  while (ol.children.length > 150) ol.lastChild.remove();
}
export function showToast(msg, kind = "") {
  const box = $("#toasts"), d = document.createElement("div");
  d.className = "toast " + kind; d.textContent = msg; box.appendChild(d);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => d.remove(), 3200);
}
let lastChips = "", lastDuty = "";
export function updateHud() {
  const S = G.ship, SP = G.sp, L = G.lt;
  const val = { hull: S.hull, shields: S.shields, power: S.power, parts: S.parts, torps: S.torps, energy: S.energy, rep: SP.rep };
  for (const s of STATS) {
    const v = val[s.k];
    $("#v-" + s.k).textContent = s.k === "parts" ? `${v}/${S.partsCap}` : s.k === "torps" ? `${v}/${S.torpCap}` : s.k === "rep" ? v : Math.round(v) + "%";
    const m = $("#m-" + s.k);
    if (m) m.style.width = (s.k === "parts" ? v / S.partsCap * 100 : s.k === "rep" ? Math.min(100, v * 3) : s.k === "shields" ? v / shieldCap() * 100 : v) + "%";
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
  if (items.length) {
    const top = items[0];
    pill.textContent = top.kind === "task" ? `CAPTAIN — Deck task · ${Math.ceil(top.task.t)}s` : `${PRI_LABEL[top.pri]} — ${SYSTEMS[top.id].name} · ${SEV_LABEL[top.sev]}`;
    pill.className = "alert-pill pri-" + top.pri + (top.kind === "task" ? " sev-task" : "");
    pill.onclick = () => top.kind === "task" ? sendUse(top.task.node) : sendRepair(top.id);
  } else { pill.textContent = "All systems nominal"; pill.className = "alert-pill"; pill.onclick = null; }
  $("#dutyBadge").textContent = items.length || "";
  // duty list
  const dk = items.map(i => i.kind + i.id + i.sev + i.pri + (i.task ? Math.ceil(i.task.t) : "")).join("|") + L.mode + L.repairSys;
  if (dk !== lastDuty) {
    lastDuty = dk;
    $("#dutyBody").innerHTML = items.length ? items.map(i => {
      if (i.kind === "task") return `<div class="duty"><span class="pri p1">CAPTAIN</span><span class="what">${i.task.label} · <b>${Math.ceil(i.task.t)}s</b></span><button data-task="${i.task.node}">GO</button></div>`;
      const f = G.ship.faults[i.id], s = SYSTEMS[i.id], busy = L.mode === "repair" && L.repairSys === i.id;
      return `<div class="duty"><span class="pri p${i.pri}">${PRI_LABEL[i.pri]}</span><span class="what">${s.fault} <span class="sev ${i.sev}">${SEV_LABEL[i.sev]}</span> · ${f.cost} part${f.cost === 1 ? "" : "s"}${s.deck !== L.deck ? " · " + DECKS[s.deck].name : ""}</span><button data-fix="${i.id}">${busy ? "…" : "REPAIR"}</button></div>`;
    }).join("") : `<div class="empty">No outstanding work. Okafor is, for once, quiet.</div>`;
  }
  // orders (single voyage view-model)
  const vv = voyageView();
  $("#ordersHead").textContent = vv.headline;
  $("#ordersWhy").textContent = vv.reason;
  $("#ordersProg").style.width = (vv.progress != null ? vv.progress * 100 : 0) + "%";
  $("#sceneTag").textContent = vv.scene;
  $("#deckTag").textContent = `${DECKS[L.deck].name} · SD ${S.stardate.toFixed(1)}`;
  // chips
  const ck = L.deck + L.mode + L.node + Object.keys(S.faults).join();
  if (ck !== lastChips) {
    lastChips = ck;
    // Turbolift leads the row (and is pinned in FULL mode) so the deck-change button is never off-screen
    const html = `<button class="chip lift" data-lift="1">Turbolift ▸</button>` + Object.entries(DECKS[L.deck].nodes).map(([id, n], i) => {
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
  if (B) { const p = Math.max(0, Math.round(B.hull)); $("#enemyPct").textContent = p + "%"; $("#enemyBar").style.width = p + "%"; $("#bridgeOrders").textContent = `T'Ren: ${BR.tren} · Hale: phasers ${B.cd.phaser > 0 ? "cycling" : "ready"}, torpedoes ${G.gates.loader ? "OFFLINE" : S.torps}`; }
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
    const t = e.target.closest("[data-node],[data-lift],[data-fix],[data-task],[data-close]");
    if (!t) return;
    if (t.dataset.node) sendUse(t.dataset.node);
    else if (t.dataset.lift) sendLiftPanel();
    else if (t.dataset.fix) sendRepair(t.dataset.fix);
    else if (t.dataset.task) sendUse(t.dataset.task);
    else if (t.dataset.close) $("#" + t.dataset.close).hidden = true;
    if (t.closest("#panels") && document.body.classList.contains("mode-play") && !t.dataset.close) closeSheet();
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
  const fmt = s => s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m` : `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`;
  const d = (v, u = "") => (v >= 0 ? "+" : "") + Math.round(v) + u;
  const vv = voyageView(), SP = G.sp;
  const where = SP.battle ? "at red alert — the bridge has the fight" : SP.travel ? `at warp for ${DESTS[SP.travel.dest].name}` : SP.location ? `at ${DESTS[SP.location].name}` : "holding position in deep space";
  const fights = r.battles === 0 ? "No contact with the Jem'Hadar." : `${r.battles} engagement${r.battles === 1 ? "" : "s"} (won ${r.wins})${r.tows ? ` · towed to DS9 ×${r.tows}` : ""}.`;
  $("#reportBody").innerHTML = `<p><b>Okafor's night-watch log.</b> You were off watch for <b>${fmt(r.away)}</b>${r.simulated < r.away ? ` (the log covers the first ${fmt(r.simulated)}; after that she held station)` : ""}. The Tenacity kept flying — she's ${where}.</p>
  <ul><li>Voyage: ${r.legs} leg${r.legs === 1 ? "" : "s"} completed · ${r.events} event${r.events === 1 ? "" : "s"}</li>
  <li>${fights}${r.avoided ? ` T'Ren steered around ${r.avoided} patrol${r.avoided === 1 ? "" : "s"}.` : ""}</li>
  <li>Night watch cleared <b>${r.crewFixes || 0}</b> fault${r.crewFixes === 1 ? "" : "s"}${r.repairs ? ` · your repairs: ${r.repairs}` : ""}${r.torpsBuilt ? ` · torpedoes replicated: ${r.torpsBuilt}` : ""}</li>
  <li>Hull ${d(r.d.hull, "%")} · Parts ${d(r.d.parts)} · Torpedoes ${d(r.d.torps)} · Reputation ${d(r.d.rep)}</li>
  <li>Faults awaiting you: <b>${r.faults}</b>${r.faults ? " — see DUTY." : " — the deck is clean."}</li></ul>
  ${r.highlights.length ? `<p><b>Log highlights</b></p><ul>${r.highlights.map(e => `<li>SD ${e.sd} — ${e.msg.replace(/</g, "&lt;")}</li>`).join("")}</ul>` : ""}`;
  $("#report").hidden = false;
}
