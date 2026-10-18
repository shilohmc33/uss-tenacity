// DOM HUD: stat bar, alert chip, orders, duty list, crew cards, chips, log, toasts, lift panel, report.
import { G } from "../state.js";
import { xpToNext, rankName, rankShort, nextRank, rankEligible, computeReadiness, readinessVisible, readinessHint, crewList, opinionOf, opinionLabel, socialPoints, lockerOffer, buyLocker, PROG, costText, canAfford } from "../progression.js";
import { CREW_ROSTER, DEPTS, DEPT_ORDER, POSTINGS, SPECIES, LADDERS } from "../roster.js";
import { favourState, callFavour, perkState, alumRankShort, overhaulState, doOverhaul, casingOk, buildCasing, fixKit } from "../crewlife.js";
import { DECKS, DECK_ORDER, SYSTEMS, NODEMAP, SEV_LABEL, PRI_LABEL, OFFICERS, DESTS } from "../data.js";
import { on } from "../bus.js";
import { dutyItems, shieldCap } from "../faults.js";
import { voyageView } from "../voyage.js";
import * as CB from "../cabin.js";
import * as BD from "../boards.js";
import * as MD from "../injuries.js";
import { sendUse, sendRepair, sendLiftPanel, rideLiftTo, playerInEngineering, ltStatus } from "../crew.js";
import { BR } from "../battle.js";
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
  $("#p-crew").insertAdjacentHTML("beforeend", `<div id="career"></div><div id="quarters"></div><div id="relations"></div><div id="memoriam"></div><div id="fleet"></div><div id="favours"></div><div id="safety"></div>`);
  $("#p-duty").insertAdjacentHTML("beforeend", `<div id="reqBox"></div>`);
  document.body.insertAdjacentHTML("beforeend", `<div id="decorPanel" class="modal" hidden><div class="card"><h3 id="decorTitle">QUARTERS</h3><div id="decorList"></div><button class="close" data-close="decorPanel">CLOSE</button></div></div>`);
  $("#decorList").addEventListener("click", decorClick);
  // phase 5: promotion board + specialisation picker (modals over everything; fit 390x844, 844x390, 1280x800)
  document.body.insertAdjacentHTML("beforeend", `<div id="boardPanel" class="modal" hidden><div class="card"><div id="boardBody"></div></div></div><div id="specPanel" class="modal" hidden><div class="card"><h3 id="specTitle">SPECIALISATION</h3><div id="specList"></div><button class="close" data-spec="later">DECIDE LATER</button></div></div>`);
  $("#boardPanel").addEventListener("click", boardClick);
  $("#specPanel").addEventListener("click", specClick);
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
  if (items.length) {
    const top = items[0];
    pill.textContent = top.kind === "task" ? `CAPTAIN — Deck task · ${Math.ceil(top.task.t)}s` : top.kind === "job" ? `ODD JOB — ${top.job.label}` : `${PRI_LABEL[top.pri]} — ${SYSTEMS[top.id].name} · ${SEV_LABEL[top.sev]}`;
    pill.className = "alert-pill pri-" + top.pri + (top.kind === "task" ? " sev-task" : "") + (top.kind === "job" ? " job" : "");
    pill.onclick = () => top.kind === "task" ? sendUse(top.task.node) : top.kind === "job" ? sendUse(top.job.node) : sendRepair(top.id);
  } else { pill.textContent = "All systems nominal"; pill.className = "alert-pill"; pill.onclick = null; }
  $("#dutyBadge").textContent = items.length || "";
  // duty list
  const dk = items.map(i => i.kind + i.id + i.sev + i.pri + (i.task ? Math.ceil(i.task.t) : "") + (i.job ? Math.round(i.job.acc / i.job.need * 10) : "")).join("|") + L.mode + L.repairSys + (G.prog.med ? G.prog.med.inj.map(x => x.id + x.state).join() : "");
  if (dk !== lastDuty) {
    lastDuty = dk;
    $("#dutyBody").innerHTML = items.length ? items.map(i => {
      if (i.kind === "job") { const j = i.job, there = L.node === j.node && L.mode === "use"; return `<div class="duty job"><span class="pri p4">ODD JOB</span><span class="what">${j.label}${j.deck !== L.deck ? " · " + DECKS[j.deck].name : ""} · <b>+${Math.round(j.xp)} XP</b>${there ? ` · working ${Math.round(j.acc / j.need * 100)}%` : ""}</span><button data-task="${j.node}">GO</button></div>`; }
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
    const t = e.target.closest("[data-node],[data-lift],[data-fix],[data-task],[data-close],[data-req],[data-fav],[data-sink],[data-kit],[data-slot],[data-spec=open],[data-board-open],[data-pin],[data-gentle]");
    if (!t) return;
    if (t.dataset.spec === "open") { openSpec(); return; }
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
  const fmt = s => s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m` : `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`;
  const d = (v, u = "") => (v >= 0 ? "+" : "") + Math.round(v) + u;
  const vv = voyageView(), SP = G.sp;
  const where = SP.battle ? "at red alert — the bridge has the fight" : SP.travel ? `at warp for ${DESTS[SP.travel.dest].name}` : SP.location ? `at ${DESTS[SP.location].name}` : "holding position in deep space";
  const fights = r.battles === 0 ? "No contact with the Jem'Hadar." : `${r.battles} engagement${r.battles === 1 ? "" : "s"} (won ${r.wins})${r.tows ? ` · towed to DS9 ×${r.tows}` : ""}.`;
  $("#reportBody").innerHTML = `<p><b>Okafor's night-watch log.</b> You were off watch for <b>${fmt(r.away)}</b>${r.simulated < r.away ? ` (the log covers the first ${fmt(r.simulated)}; after that she held station)` : ""}. The Tenacity kept flying — she's ${where}.</p>
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
      <div class="rparts"><span${wk && wk.k === "perf" ? ' class="weak"' : ""}>Performance ${rp.perf}/${Math.round(RD.perf * 100)}</span><span${wk && wk.k === "social" ? ' class="weak"' : ""}>Social ${rp.social}/${Math.round(RD.social * 100)}</span><span${wk && wk.k === "rep" ? ' class="weak"' : ""}>Reputation ${rp.rep}/${Math.round(RD.rep * 100)}</span>${rp.service ? `<span${wk && wk.k === "service" ? ' class="weak"' : ""}>Service +${rp.service}</span>` : ""}</div>${wk && r < 100 ? `<p class="rhint">▲ Weakest: <b>${wk.label} ${wk.have}/${wk.max}</b> — ${wk.hint}.</p>` : ""}<p class="cnote">${note}</p></div>`;
  }
  const sl = BD.specLabel(), sp = BD.specPending(), nextPick = PROG.specs.picks.find(l => l > p.level);
  const specRow = `<div class="specRow"><span class="k">SPECIALISATION</span>${sl.length ? sl.map(x => `<span class="schip">${x}</span>`).join("") : `<span class="cnote">none yet</span>`}${sp ? `<button class="spb" data-spec="open">CHOOSE (${sp})</button>` : nextPick ? `<small>next pick at level ${nextPick}</small>` : ""}</div>`;
  const lastB = p.boardLog[p.boardLog.length - 1], cd = BD.boardCdLeft();
  const boardRow = p.board ? `<div class="bstat wait">Promotion board convened — <button class="spb" data-board-open="1">FACE THE BOARD</button></div>`
    : lastB && lastB.outcome !== "pass" && lastB.to === (n && n.id) ? `<div class="bstat">${lastB.outcome === "fail" ? "Last board: not recommended" : "Last board: deferred"}${cd ? ` · next board from ship's day ${p.boardCd}` : " · the board may sit again"}${p.boardMalus ? ` · readiness penalty −${Math.round(p.boardMalus)} (fading)` : ""}</div>` : "";
  setHtml("career", `<h4>SERVICE RECORD</h4><div class="rankRow"><b>${rankName()}</b> · Level ${p.level} · ${p.xp}/${xpToNext(p.level)} XP${p.history.length ? ` · promoted ${p.history.length}×` : ""}</div>${specRow}${boardRow}${ready}`, force);
  renderQuarters(force);
  // ---- crew relations: all 18 roster slots grouped by department (vacant slots show the replacement en route) ----
  const list = crewList(), byId = Object.fromEntries(list.map(c => [c.slot, c])), favs = MD.favourites();
  const rowOf = c => {
    const v = Math.round(opinionOf(c.id)), w = Math.abs(v) / 2;
    const face = c.img ? `<img src="assets/${c.img}.webp" alt="">` : `<span class="badge" style="background:${c.color}">${c.short.replace(/[^A-Za-z]/g, "").slice(0, 2)}</span>`;
    const inj = MD.injuryOf(c.id), fav = favs.includes(c.id), pinned = G.prog.med.pins.includes(c.id);
    const injTag = inj ? ` <em class="injb${inj.state === "warning" ? " crit" : ""}">${inj.state === "warning" ? "INJURED · SERIOUS" : "INJURED"}</em>` : "";
    const injNote = inj ? (inj.state === "warning" ? `in sickbay — needs the ${SYSTEMS[inj.sys].name} fixed (${Math.max(0, Math.ceil(inj.left))}s${inj.seen ? "" : ", waiting for you"})` : `in sickbay — recovering${inj.healAt ? `, back in ~${Math.max(1, Math.round((inj.healAt - G.ship.elapsed) / 3600))} h` : ""}`) : "";
    const pin = (c.senior || !PROG.deaths.enabled) ? `<span class="pin0"></span>` : `<button class="pin${pinned ? " on" : ""}${fav ? " fav" : ""}" data-pin="${c.id}" title="${pinned ? "Pinned favourite (protected)" : fav ? "Favourite — protected (tap to pin)" : "Pin as a protected favourite"}">${pinned || fav ? "★" : "☆"}</button>`;
    return `<div class="rel${inj ? " inj" : ""}">${face}<div class="nm">${c.rankShort} ${c.short}${c.intro ? ` <em class="newb">NEW</em>` : ""}${injTag}<small>${inj ? injNote : `${c.speciesName} · ${c.role}`}</small></div>${pin}<div class="opbar"><i class="${v >= 0 ? "pos" : "neg"}" style="width:${w}%"></i></div><b class="${v >= 0 ? "pos" : "neg"}">${v > 0 ? "+" : ""}${v}</b><small class="lab">${opinionLabel(v)}</small></div>`;
  };
  const pend = G.prog.crew.pending;
  const groups = DEPT_ORDER.map(d => {
    const slots = CREW_ROSTER.filter(s => s.dept === d); if (!slots.length) return "";
    const rows = slots.map(s => byId[s.slot] ? rowOf(byId[s.slot]) : `<div class="rel vac"><span class="badge" style="background:#2a3348">–</span><div class="nm">Vacant<small>${s.role} · replacement en route${pend.some(p => p.slot === s.slot) ? "" : ""}</small></div></div>`).join("");
    return `<div class="dgrp"><div class="dh" style="--dc:${DEPTS[d].color}">${DEPTS[d].name.toUpperCase()}</div>${rows}</div>`;
  }).join("");
  const injN = G.prog.med.inj.length;
  setHtml("relations", `<h4>CREW RELATIONS <small>${list.length} aboard${injN ? ` · ${injN} in sickbay` : ""} · social points ${socialPoints()}</small></h4>${groups}`, force);
  // ---- phase 6: In Memoriam (only once someone has been lost) + crew safety settings ----
  const mem = G.prog.med.memorial;
  setHtml("memoriam", mem.length ? `<h4>IN MEMORIAM</h4>${mem.slice().reverse().map(e => `<div class="mem"><span class="mcross">✦</span><div><b>${e.name}</b><small>${e.species} · ${e.role} · lost on ship's day ${e.day} (SD ${e.sd})${e.plaque ? " · plaque by the lounge viewport" : ""}</small></div></div>`).join("")}<p class="cnote">Remembered by the crew of the Tenacity.</p>` : "", force);
  const gm = MD.gentle(), fn = favs.map(id => (list.find(c => c.id === id) || {}).short).filter(Boolean).join(" and ");
  if (!PROG.deaths.enabled) setHtml("safety", "", force); else setHtml("safety", `<h4>CREW SAFETY</h4><div class="req"><div>Gentle mode<small>${gm ? "On — if the worst happens, a crewmate is critically injured and evacuated to a hospital ship. Nobody is lost." : "Off — a serious injury left unresolved can, rarely, cost a life (never before day 14, never senior staff, at most one in 21 days of play)."}</small></div><button data-gentle="${gm ? "off" : "on"}">${gm ? "ON" : "OFF"}</button></div><p class="cnote">Protected favourites: ${fn || "—"} (★; tap ☆ on a crew row to pin up to ${PROG.deaths.protectFavourites}). Senior staff are always protected.</p>`, force);
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
function renderQuarters(force) {
  if (!$("#quarters")) return;
  const T = CB.tier(), tt = CB.totals(), c = G.prog.cabin, cur = PROG.currency;
  const rows = T.slots.map(sl => { const id = c.placed[sl.id], d = id && CB.DECOR[id]; return `<button class="slotb${d ? " full" : ""}" data-slot="${sl.id}">${d ? `<i>${d.icon}</i>${d.name}` : `<i>＋</i>${CB.SLOT_NAMES[sl.type]}`}</button>`; }).join("");
  const st = CB.storage();
  setHtml("quarters", `<h4>LT'S QUARTERS <small>${T.name}</small></h4>
    <p class="cnote">Rest on your rack: <b>${CB.rackRest().toFixed(1)}</b> energy/s (comfort +${pct(tt.comfort)}%) · social +${pct(tt.social)}% · readiness +${tt.readiness} · catalogue ${pct(CB.completion())}% · ${cur.name} <b>${G.prog.rations}</b>${st.length ? ` · ${st.length} in storage` : ""}</p>
    <div class="slots">${rows}</div>${(() => { const ds = CB.dinnerState(), K = PROG.cabin.dinner; return `<div class="req fav${ds.ok ? "" : " off"}"><div>Host a dinner in your quarters<small>+opinion with the ${K.guests} crew who like you least${ds.ok ? "" : ` · ${ds.why}`}</small></div><button data-sink="dinner" ${ds.ok ? "" : "disabled"}>${costText(K.cost)}</button></div>`; })()}${G.lt.deck !== "quarters" ? `<button class="goq" data-node="rack">Go to quarters ▸</button>` : ""}`, force);
}
let decorSlot = null;
// ---- phase 5: promotion board modal + specialisation picker ----
let boardResult = null;
function autoModals() {
  const busy = !$("#report").hidden || !$("#decorPanel").hidden || !$("#liftPanel").hidden;
  if (!busy && $("#boardPanel").hidden && BD.boardWaiting()) openBoard();
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
    return `<div class="req dec${!s.owned && !s.gate.ok ? " off" : ""}"><i class="ico">${d.icon}</i><div>${d.name}<small>${bon(d)}${note ? ` · ${note}` : ""}</small></div>${btn}</div>`;
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
