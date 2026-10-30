// Wave A–D UI: meal/cards/quest, duty/repair/mentor/log, show/spar, shore evening + away team.
import { G } from "../state.js";
import { toast } from "../bus.js";
import * as LA from "../lt-act.js";
import { sendUse, rideLiftTo } from "../crew.js";
import { DECKS } from "../data.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function modal(id) {
  let m = document.getElementById(id);
  if (!m) { m = document.createElement("div"); m.id = id; m.className = "modal"; m.hidden = true; document.body.appendChild(m); }
  return m;
}

function closeAll() {
  for (const id of ["ltActPanel", "ltActChat"]) { const m = document.getElementById(id); if (m) m.hidden = true; }
}

function goTable() {
  const L = G.lt;
  if (L.deck !== "lounge") { rideLiftTo("lounge", { kind: "use", node: "mess" }); return; }
  if (!LA.nearTable()) sendUse("mess");
}

export function openMeal() {
  const why = LA.blockedWhy(); if (why) { toast(why, "warn"); return; }
  if (LA.mealLeft() <= 0) { toast("Already shared a meal today", "warn"); return; }
  goTable();
  renderInvite("meal");
}

export function openCards() {
  const why = LA.blockedWhy(); if (why) { toast(why, "warn"); return; }
  if (LA.cardsLeft() <= 0) { toast("Already played cards today", "warn"); return; }
  if (G.lt.deck !== "lounge") rideLiftTo("lounge", { kind: "use", node: "bar" });
  renderInvite("cards");
}

function renderInvite(kind) {
  const m = modal("ltActPanel");
  const targets = LA.inviteTargets(kind);
  const left = kind === "meal" ? LA.mealLeft() : LA.cardsLeft();
  const title = kind === "meal" ? "SHARE A MEAL" : "CARD NIGHT";
  const cost = kind === "meal" ? `${LA.MEAL_COST.rations} rations` : `${LA.CARD_ANTE.rations} rations ante`;
  const games = kind === "cards" ? `<p class="cnote">Game:
    <button type="button" class="holoinv hasart" data-ltact-game="poker"><img class="chipart" src="assets/chip-cards.webp" alt="">Poker</button>
    <button type="button" class="holoinv hasart${LA.tongoUnlocked() ? "" : " done"}" data-ltact-game="tongo" ${LA.tongoUnlocked() ? "" : "disabled"}><img class="chipart" src="assets/chip-tongo.webp" alt="">Tongo${LA.tongoUnlocked() ? "" : " · dock at DS9"}</button>
  </p>` : "";
  const btns = targets.map(t => `<button type="button" class="holoinv" data-ltact-ask="${esc(t.id)}" data-kind="${kind}" style="min-height:44px;width:100%;text-align:left">${esc(t.short)} · ${esc(t.word)}</button>`).join("");
  m.innerHTML = `<div class="card holocard ltactcard"><div class="holobody"><h3>${title}</h3>
    <p class="cnote">${left} left today · ${cost}. Guests sit at the table (south). Blocked in red alert / away.</p>
    ${games}
    <div class="plsec">INVITE · ${targets.length} aboard</div>
    <div class="holoinvs ltact-invlist">${btns || "<p class='cnote'>Nobody free right now.</p>"}
    <button type="button" class="holoinv solo" data-ltact-solo="${kind}" style="min-height:44px;width:100%">Go solo</button></div>
    <p class="cnote" id="ltActNote"></p>
  </div><div class="holofoot">
    <button class="close" data-ltact-start="${kind}" style="min-height:44px">${kind === "meal" ? "Sit & eat" : "Deal in"}</button>
    <button class="close" data-ltact-close="1" style="min-height:44px">CLOSE</button>
  </div></div>`;
  m.hidden = false;
  m.dataset.kind = kind;
  m.dataset.game = "poker";
}

function renderQuestOffer() {
  const m = modal("ltActPanel");
  const offers = LA.listQuestOffers();
  const rows = offers.map(o => `<div class="req"><div>${esc(o.title)}<small>${esc(o.short)} · present-only · 2–3 beats</small></div>
    <button data-ltact-accept="${esc(o.id)}" style="min-height:44px">ACCEPT</button></div>`).join("");
  m.innerHTML = `<div class="card holocard ltactcard"><div class="holobody"><h3>PERSONAL ASK</h3>
    <p class="cnote">One active quest. Finishing starts a real-day cooldown for that crewmate. Nothing advances while you are away.</p>
    ${rows || "<p class='cnote'>No asks right now (need Friendly opinion or a matching hook).</p>"}
  </div><div class="holofoot"><button class="close" data-ltact-close="1">CLOSE</button></div></div>`;
  m.hidden = false;
}

function renderChat() {
  const meal = LA.mealView(), cards = LA.cardsView(), quest = LA.questView();
  const duty = LA.dutyView(), repair = LA.repairView(), mentor = LA.mentorView(), show = LA.showView(), spar = LA.sparView();
  const shore = LA.shoreView(), away = LA.awayView();
  const v = meal || cards || duty || repair || mentor || show || spar || shore || away || (quest && quest.here && quest.mode !== "wrong-deck" && quest.mode !== "approaching" ? quest : null);
  const m = modal("ltActChat");
  if (!v) {
    if (quest && quest.mode === "approaching") {
      m.innerHTML = `<div class="card holocard ltactcard"><div class="holobody"><h3>QUEST</h3><p class="cnote">${esc(quest.title)} — ${esc(quest.who)} is coming over…</p></div>
        <div class="holofoot"><button class="close" data-ltact-close="1">CLOSE</button></div></div>`;
      m.hidden = false; return;
    }
    if (quest && !quest.here) {
      m.innerHTML = `<div class="card holocard ltactcard"><div class="holobody"><h3>${esc(quest.title)}</h3>
        <p class="cnote">Meet them on ${esc(quest.deck)}.</p></div>
        <div class="holofoot"><button class="close" data-ltact-goto="${esc(quest.deck)}" style="min-height:44px">GO</button>
        <button class="close" data-ltact-close="1">CLOSE</button></div></div>`;
      m.hidden = false; return;
    }
    m.hidden = true; return;
  }
  const tag = v.mode === "comm" ? "📶 " : "";
  const choices = (v.choices || []).map(c => `<button class="holoinv" data-ltact-ans="${c.j}" style="min-height:44px;width:100%;text-align:left">${esc(c.text)}</button>`).join("");
  const endBtn = v.end ? `<button class="close" data-ltact-ans="0" style="min-height:44px">Done</button>` : "";
  const art = v.art ? `<div class="ltact-still" data-art="${esc(v.art)}"><img alt="" src="assets/story/${esc(v.art)}.webp" onerror="this.parentNode.classList.add('none')"></div>` : "";
  m.innerHTML = `<div class="card holocard ltactcard"><div class="holobody"><h3>${tag}${esc((v.title || v.kind || "CHAT").toString().toUpperCase())}</h3>
    ${art}
    <p class="mline">${esc(v.q)}</p>
    <div class="holoinvs" style="flex-direction:column">${choices}</div>
  </div><div class="holofoot">${endBtn}<button class="close" data-ltact-dismiss="1" style="min-height:44px">NOT NOW</button></div></div>`;
  m.hidden = false;
}

export function openQuest() {
  if (LA.A().quest.active) { renderChat(); return; }
  renderQuestOffer();
}

export function refreshLtAct() {
  const s = LA.A().session;
  if (s && s.phase === "chat") renderChat();
  else if (s && s.phase === "watch") renderChat();
  else if (s && s.phase === "approach") {
    const m = modal("ltActChat");
    const title = ({ meal: "MEAL", cards: "CARDS", repair: "REPAIR", mentor: "MENTOR", duty: "WATCH" })[s.kind] || "WAIT";
    m.innerHTML = `<div class="card holocard ltactcard"><div class="holobody"><h3>${title}</h3>
      <p class="cnote">They are coming over…</p></div>
      <div class="holofoot"><button class="close" data-ltact-dismiss="1">CANCEL</button></div></div>`;
    m.hidden = false;
  }
}

export function openDuty() {
  const s = LA.A().session;
  if (s && s.kind === "duty") { refreshLtAct(); return; }
  const r = LA.startDutyWatch();
  if (!r.ok) { toast(r.why, "warn"); return; }
  refreshLtAct();
}
export function openRepair() {
  const active = LA.A().repair.active;
  if (active) {
    const r = LA.startRepairScene();
    if (!r.ok) toast(r.why, "warn"); else refreshLtAct();
    return;
  }
  const calls = LA.pendingKitCalls();
  const m = modal("ltActPanel");
  const rows = calls.map(c => `<div class="req"><div>Fix ${esc(c.short)}'s ${esc(c.item)}<small>In-room scene · uses existing kit parts cost</small></div>
    <button data-ltact-repair="${esc(c.who)}" style="min-height:44px">ACCEPT</button></div>`).join("");
  m.innerHTML = `<div class="card holocard ltactcard"><div class="holobody"><h3>REPAIR CALL</h3>
    <p class="cnote">${LA.repairLeft()} left today. Present-only; never resolves while away.</p>
    ${rows || "<p class='cnote'>No kit requests open. Check CREW ▸ favours later.</p>"}
  </div><div class="holofoot"><button class="close" data-ltact-close="1">CLOSE</button></div></div>`;
  m.hidden = false;
}
export function openMentor() {
  const why = LA.blockedWhy(); if (why) { toast(why, "warn"); closeAll(); return; }
  if (!LA.mentorDeckOk()) { toast("Meet them on the Bridge or in Engineering", "warn"); closeAll(); return; }
  if (LA.mentorLeft() <= 0) { toast("Already mentored today", "warn"); closeAll(); return; }
  const list = LA.mentorJuniors();
  const m = modal("ltActPanel");
  const rows = list.map(j => {
    const dis = j.locked ? " disabled" : "";
    const cls = j.locked ? " holodone done" : "";
    return `<button type="button" class="holoinv${cls}" data-ltact-mentor="${esc(j.id)}" style="min-height:44px;width:100%;text-align:left" ${j.locked ? "disabled aria-disabled=\"true\"" : ""}>${esc(j.short)}${j.green ? " · Green" : ""} · ${esc(j.word)}${j.locked ? " · locked today" : ""}</button>`;
  }).join("");
  m.innerHTML = `<div class="card holocard ltactcard"><div class="holobody"><h3>MENTORING</h3>
    <p class="cnote">One session per real day on Bridge / Engineering. Declined invites stay locked today. ${list.length} juniors.</p>
    <div class="holoinvs ltact-invlist">${rows || "<p class='cnote'>No juniors aboard.</p>"}</div>
  </div><div class="holofoot"><button class="close" data-ltact-close="1">CLOSE</button></div></div>`;
  m.hidden = false;
}
export function openLog() {
  const pr = LA.logPrompts();
  const crew = Object.values(G.prog.crew.slots || {}).filter(id => id && G.prog.crew.occ[id]);
  const opts = [`<option value="">(no dedicate)</option>`].concat(crew.map(id => `<option value="${esc(id)}">${esc(G.prog.crew.occ[id].short)}</option>`)).join("");
  const m = modal("ltActPanel");
  m.innerHTML = `<div class="card holocard ltactcard"><div class="holobody"><h3>WRITE A LOG</h3>
    <p class="cnote">Mad-libs · one entry per real day · prompts from things you did while present.</p>
    <label class="cnote">Opening</label>
    <select id="ltLogOpen" style="min-height:44px;width:100%">${pr.opens.map(t => `<option>${esc(t)}</option>`).join("")}</select>
    <label class="cnote">Closing</label>
    <select id="ltLogClose" style="min-height:44px;width:100%">${pr.closes.map(t => `<option>${esc(t)}</option>`).join("")}</select>
    <label class="cnote">Dedicate (optional)</label>
    <select id="ltLogWho" style="min-height:44px;width:100%">${opts}</select>
  </div><div class="holofoot">
    <button class="close" data-ltact-logwrite="1" style="min-height:44px">FILE</button>
    <button class="close" data-ltact-close="1">CLOSE</button>
  </div></div>`;
  m.hidden = false;
}


export function openDecorAct() {
  const why = LA.blockedWhy(); if (why) { toast(why, "warn"); return; }
  if (!LA.atDecorNode()) { toast("Use your desk or rack", "warn"); return; }
  // Prefer an empty visible slot, else desk1 / first slot
  import("../cabin.js").then(CB => {
    import("./hud.js").then(H => {
      const empty = CB.slots().find(s => !G.prog.cabin.placed[s.id]);
      const desk = CB.slots().find(s => s.id === "desk1" || s.type === "desk");
      const sl = empty || desk || CB.slots()[0];
      if (!sl) { toast("No decor slots in this cabin yet", "warn"); return; }
      H.openDecor(sl.id);
    });
  });
}

export function openShow() {
  const why = LA.blockedWhy(); if (why) { toast(why, "warn"); return; }
  if (LA.showLeft() <= 0) { toast("Already showed someone in today", "warn"); return; }
  if (!LA.inQuarters()) { toast("Invite them to your quarters", "warn"); return; }
  const s = LA.A().session;
  if (s && s.kind === "show") { refreshLtAct(); return; }
  renderShowInvite();
}

function renderShowInvite() {
  const m = modal("ltActPanel");
  const targets = LA.inviteTargets("show");
  const btns = targets.map(t => `<button type="button" class="holoinv" data-ltact-ask="${esc(t.id)}" data-kind="show" style="min-height:44px;width:100%;text-align:left">${esc(t.short)} · ${esc(t.word)}</button>`).join("");
  m.innerHTML = `<div class="card holocard ltactcard"><div class="holobody"><h3>SHOW SOMEONE IN</h3>
    <p class="cnote">${LA.showLeft()} left today. Guest walks to your quarters (in-room). Romance lines only if romance is on. ${targets.length} aboard.</p>
    <div class="plsec">INVITE</div>
    <div class="holoinvs ltact-invlist">${btns || "<p class='cnote'>Nobody free right now.</p>"}</div>
    <p class="cnote" id="ltActNote"></p>
  </div><div class="holofoot">
    <button class="close" data-ltact-showstart="1" style="min-height:44px">SHOW THEM IN</button>
    <button class="close" data-ltact-close="1" style="min-height:44px">CLOSE</button>
  </div></div>`;
  m.hidden = false;
}

export function openSpar() {
  const why = LA.blockedWhy(); if (why) { toast(why, "warn"); return; }
  if (LA.sparLeft() <= 0) { toast("Already sparred today", "warn"); return; }
  const s = LA.A().session;
  if (s && s.kind === "spar") { refreshLtAct(); return; }
  // MED: gymRoom ON → gym mat (stay if already there); else Mess/Berthing stand-in
  if (LA.gymRoomOn()) {
    if (G.lt.deck !== "gym") rideLiftTo("gym", { kind: "use", node: "mat" });
  } else if (G.lt.deck !== "lounge" && G.lt.deck !== "berthing") {
    rideLiftTo("lounge", null);
  }
  renderSparInvite();
}

function renderSparInvite() {
  const m = modal("ltActPanel");
  const list = LA.sparTargets();
  const art = LA.sparArtOn();
  const rows = list.map(j => `<button type="button" class="holoinv" data-ltact-spar="${esc(j.id)}" style="min-height:44px">${esc(j.short)}${j.love ? " · keen" : ""} · ${esc(j.word)}</button>`).join("");
  m.innerHTML = `<div class="card holocard ltactcard"><div class="holobody"><h3>SPARRING</h3>
    <p class="cnote">One bout per real day. ${art && LA.gymRoomOn() ? "On the Gym mat" : art ? "Spar poses on" : "Open floor in the Mess (stand-in)"}${art ? "" : " — spar sheet gated"}. No injuries.</p>
    <div class="holoinvs">${rows || "<p class='cnote'>No partners free.</p>"}</div>
  </div><div class="holofoot"><button class="close" data-ltact-close="1">CLOSE</button></div></div>`;
  m.hidden = false;
}


export function openShore() {
  const why = LA.blockedWhy(); if (why) { toast(why, "warn"); return; }
  if (!LA.shoreGranted()) { toast("Request shore leave first", "warn"); return; }
  if (LA.shoreLeft() <= 0) { toast("Already took a shore evening this visit", "warn"); return; }
  const s = LA.A().session;
  if (s && s.kind === "shore") { refreshLtAct(); return; }
  renderShorePick();
}

function renderShorePick() {
  const m = modal("ltActPanel");
  const picks = LA.shorePicksList();
  const targets = LA.inviteTargets("shore");
  const inv = targets.map(t => `<button type="button" class="holoinv" data-ltact-ask="${esc(t.id)}" data-kind="shore" style="min-height:44px;width:100%;text-align:left">${esc(t.short)} · ${esc(t.word)}</button>`).join("");
  const rows = picks.map(p => `<button type="button" class="holoinv" data-ltact-shore="${esc(p.id)}" style="min-height:44px;width:100%;text-align:left"><b>${esc(p.title)}</b><small style="display:block;opacity:.8">${esc(p.sub)}${p.needGuest ? " · invite first" : ""}</small></button>`).join("");
  m.innerHTML = `<div class="card holocard ltactcard"><div class="holobody"><h3>SHORE EVENING · DS9</h3>
    <p class="cnote">${LA.shoreLeft()} left this visit · present-only. Quark / Promenade reuse existing stills; temple art gated. Romance lines only if romance is on.</p>
    <div class="plsec">EVENING</div>
    <div class="holoinvs ltact-invlist">${rows}</div>
    <div class="plsec">OPTIONAL COMPANION</div>
    <div class="holoinvs ltact-invlist">${inv || "<p class='cnote'>Nobody free.</p>"}</div>
    <p class="cnote" id="ltActNote"></p>
  </div><div class="holofoot"><button class="close" data-ltact-close="1">CLOSE</button></div></div>`;
  m.hidden = false;
}

export function openAway() {
  const why = LA.awayReadyWhy(); if (why) { toast(why, "warn"); return; }
  const s = LA.A().session;
  if (s && s.kind === "away") { refreshLtAct(); return; }
  renderAwayPick();
}

function renderAwayPick() {
  const m = modal("ltActPanel");
  const missions = LA.listAwayMissions();
  const targets = LA.inviteTargets("away");
  const inv = targets.map(t => `<button type="button" class="holoinv" data-ltact-ask="${esc(t.id)}" data-kind="away" style="min-height:44px;width:100%;text-align:left">${esc(t.short)} · ${esc(t.word)}</button>`).join("");
  const rows = missions.map(p => `<button type="button" class="holoinv" data-ltact-away="${esc(p.id)}" style="min-height:44px;width:100%;text-align:left"><b>${esc(p.title)}</b><small style="display:block;opacity:.8">${esc(p.blurb)}</small></button>`).join("");
  m.innerHTML = `<div class="card holocard ltactcard"><div class="holobody"><h3>AWAY TEAM</h3>
    <p class="cnote">${LA.awayLeft()} left today · present-only · distinct from idle happenings. Invite 1+ teammate (or solo after two nos). War pacing: no ship kill. New stills gated (awayArt OFF).</p>
    <div class="plsec">INVITE</div>
    <div class="holoinvs ltact-invlist">${inv || "<p class='cnote'>Nobody free.</p>"}
    <button type="button" class="holoinv solo" data-ltact-solo="away" style="min-height:44px;width:100%">Force solo (after declines)</button></div>
    <p class="cnote" id="ltActNote"></p>
    <div class="plsec">MISSION</div>
    <div class="holoinvs ltact-invlist">${rows || "<p class='cnote'>No missions at this stop.</p>"}</div>
  </div><div class="holofoot"><button class="close" data-ltact-close="1">CLOSE</button></div></div>`;
  m.hidden = false;
}


function act(e) {
  const t = e.target.closest("[data-ltact],[data-ltact-ask],[data-ltact-solo],[data-ltact-start],[data-ltact-close],[data-ltact-game],[data-ltact-accept],[data-ltact-ans],[data-ltact-dismiss],[data-ltact-goto],[data-ltact-repair],[data-ltact-mentor],[data-ltact-log],[data-ltact-logwrite],[data-ltact-showstart],[data-ltact-spar],[data-ltact-shore],[data-ltact-away]");
  if (!t || t.disabled) return;
  const D = t.dataset;
  if (D.ltact === "meal") { openMeal(); return; }
  if (D.ltact === "cards") { openCards(); return; }
  if (D.ltact === "quest") { openQuest(); return; }
  if (D.ltact === "quest-offer") { renderQuestOffer(); return; }
  if (D.ltact === "duty") { openDuty(); return; }
  if (D.ltact === "repair" || D.ltact === "repair-offer") { openRepair(); return; }
  if (D.ltact === "mentor") { openMentor(); return; }
  if (D.ltact === "log") { openLog(); return; }
  if (D.ltact === "decor") { openDecorAct(); return; }
  if (D.ltact === "show") { openShow(); return; }
  if (D.ltact === "spar") { openSpar(); return; }
  if (D.ltact === "shore") { openShore(); return; }
  if (D.ltact === "away") { openAway(); return; }
  if (D.ltactClose) { closeAll(); return; }
  if (D.ltactGame) {
    const m = document.getElementById("ltActPanel"); if (m) m.dataset.game = D.ltactGame;
    toast(D.ltactGame === "tongo" ? "Tongo" : "Poker", "info"); return;
  }
  if (D.ltactAsk) {
    const kind = t.getAttribute("data-kind") || "meal";
    const r = LA.rollInvite(kind, D.ltactAsk);
    const note = document.getElementById("ltActNote");
    if (!r.ok) { toast(r.why, "warn"); return; }
    if (r.yes) {
      const short = LA.inviteTargets(kind).find(x => x.id === r.guest)?.short || "Guest";
      toast(`${short} said yes.`, "good");
      if (note) note.textContent = kind === "show" ? "Guest said yes — Show them in when ready." : "Guest said yes — Sit & eat / Deal in when ready.";
    }
    else if (r.line) { toast(r.line, "info"); if (note) note.textContent = r.line; }
    else if (r.forced) { toast("Two declines — going solo.", "warn"); }
    if (kind === "show") renderShowInvite();
    else if (kind === "shore") renderShorePick();
    else if (kind === "away") renderAwayPick();
    else renderInvite(kind); return;
  }
  if (D.ltactSolo) {
    if (D.ltactSolo === "away") { LA.pickSoloAway(); toast("Away team solo.", "info"); renderAwayPick(); return; }
    LA.pickSolo(D.ltactSolo); toast("Going solo.", "info"); renderInvite(D.ltactSolo); return;
  }
  if (D.ltactStart) {
    const kind = D.ltactStart;
    const m = document.getElementById("ltActPanel");
    const game = (m && m.dataset.game) || "poker";
    closeAll();
    const r = kind === "meal" ? LA.startMeal() : LA.startCards(game);
    if (!r.ok) { toast(r.why, "warn"); return; }
    refreshLtAct(); return;
  }
  if (D.ltactAccept) {
    const r = LA.acceptQuest(D.ltactAccept);
    if (!r.ok) toast(r.why, "warn"); else { closeAll(); openQuest(); }
    return;
  }
  if (D.ltactAns != null) {
    const s = LA.A().session;
    if (s && s.kind === "meal") {
      const r = LA.answerMeal(+D.ltactAns);
      if (r && r.done) { closeAll(); toast("Meal done", "good"); } else refreshLtAct();
    } else if (s && s.kind === "cards") {
      const r = LA.answerCards(+D.ltactAns);
      if (r && r.done) { closeAll(); toast(r.gain ? `+${r.gain} rations` : "Card night done", "good"); } else refreshLtAct();
    } else if (s && s.kind === "duty") {
      const r = LA.answerDuty(+D.ltactAns);
      if (r && r.done) { closeAll(); toast("Watch complete", "good"); } else refreshLtAct();
    } else if (s && s.kind === "repair") {
      const r = LA.answerRepair(+D.ltactAns);
      if (r && r.done) { closeAll(); toast(r.aborted ? "Call dropped" : (r.fixed ? "Kit fixed" : "Call closed"), r.aborted ? "warn" : "good"); } else refreshLtAct();
    } else if (s && s.kind === "mentor") {
      const r = LA.answerMentor(+D.ltactAns);
      if (r && r.done) { closeAll(); toast("Mentoring done", "good"); } else refreshLtAct();
    } else if (s && s.kind === "show") {
      const r = LA.answerShow(+D.ltactAns);
      if (r && r.done) { closeAll(); toast("Show-in done", "good"); } else refreshLtAct();
    } else if (s && s.kind === "spar") {
      const r = LA.answerSpar(+D.ltactAns);
      if (r && r.done) { closeAll(); toast(r.win ? "You took the bout" : "They took the bout", "good"); } else refreshLtAct();
    } else if (s && s.kind === "shore") {
      const r = LA.answerShore(+D.ltactAns);
      if (r && r.done) { closeAll(); toast("Shore evening done", "good"); } else refreshLtAct();
    } else if (s && s.kind === "away") {
      const r = LA.answerAway(+D.ltactAns);
      if (r && r.ok === false) toast(r.why, "warn");
      else if (r && r.done) { closeAll(); toast("Away team returned", "good"); } else refreshLtAct();
    } else if (LA.A().quest.active) {
      const r = LA.answerQuest(+D.ltactAns);
      if (r && r.done) { closeAll(); toast(r.aborted ? "Ask dropped" : "Quest done", r.aborted ? "warn" : "good"); } else renderChat();
    }
    return;
  }
  if (D.ltactRepair) {
    const r = LA.acceptRepairCall(D.ltactRepair);
    if (!r.ok) toast(r.why, "warn"); else { closeAll(); toast("Call accepted — find them", "info"); }
    return;
  }
  if (D.ltactMentor) {
    if (t.disabled) return;
    const r = LA.startMentor(D.ltactMentor);
    if (!r.ok) toast(r.why, "warn");
    else if (r.yes === false) { toast(r.line || "Declined", "info"); openMentor(); }
    else { closeAll(); refreshLtAct(); }
    return;
  }
  if (D.ltactShowstart) {
    const r = LA.startShowIn();
    if (!r.ok) toast(r.why, "warn");
    else { closeAll(); refreshLtAct(); }
    return;
  }
  if (D.ltactSpar) {
    const r = LA.startSpar(D.ltactSpar);
    if (!r.ok) toast(r.why, "warn");
    else if (r.yes === false) toast(r.line || "Declined", "info");
    else { closeAll(); refreshLtAct(); }
    return;
  }
  if (D.ltactShore) {
    const r = LA.startShoreEvening(D.ltactShore);
    if (!r.ok) { toast(r.why, "warn"); return; }
    closeAll();
    if (r.link === "holo") {
      import("./holo.js").then(H => H.openHolo("lt"));
      toast("Holosuite — evening counted", "good");
      return;
    }
    if (r.link === "locker") {
      import("./promenade.js").then(PM => { if (PM.promHooks.locker) PM.promHooks.locker(); });
      toast("Gift locker — evening counted", "good");
      return;
    }
    refreshLtAct();
    return;
  }
  if (D.ltactAway) {
    const r = LA.startAway(D.ltactAway);
    if (!r.ok) { toast(r.why, "warn"); return; }
    closeAll(); refreshLtAct();
    return;
  }
  if (D.ltactLogwrite) {
    const open = document.getElementById("ltLogOpen")?.value;
    const close = document.getElementById("ltLogClose")?.value;
    const who = document.getElementById("ltLogWho")?.value || null;
    const r = LA.writeLog({ open, close, who: who || null });
    if (!r.ok) toast(r.why, "warn"); else { closeAll(); toast("Log filed", "good"); }
    return;
  }
  if (D.ltactDismiss) { LA.dismissSession(); closeAll(); return; }
  if (D.ltactGoto) {
    const deck = D.ltactGoto;
    const node = Object.keys((DECKS[deck] && DECKS[deck].nodes) || {})[0];
    rideLiftTo(deck, node ? { kind: "use", node } : null); closeAll(); return;
  }
}

document.addEventListener("click", act);

export function ltActChips() { return LA.chipsHtml(); }
export { LA };
