// Battles: the officers fight the ship; the deck decides what they can do.
import { G, saveSoon } from "./state.js";
import { DESTS, SYSTEMS } from "./data.js";
import { clamp, rand } from "./util.js";
import { log, toast, shipNews, redAlertCard } from "./bus.js";
import { moodAll, moodlet, addSkillXp, cdRate, stationEff, ltRepairSkill, AB_OWNER } from "./mood.js";
import { MOOD } from "./pacing.js";
const MOOD_XP = MOOD.skill;

import { chooseEncounter, chooseWingmen, noteEncounter, noteBcEnd } from "./encounters.js";
import { spawnFault, FAULT_RT, impairing, shieldCap, medFrozen, medDepends } from "./faults.js";
import { playerInEngineering, cancelRepairIf } from "./crew.js";
import { PACE, PACE_RT, oddsWord, isPresent } from "./pacing.js";
import { hooks } from "./progression.js";
import { suspendPrompt } from "./background.js";
import { pushMoment } from "./moments.js";   // Bigger wins #11   // Q1b #1: the Academy prompt steps aside for a red alert / battle
import { fxTimeScale, deathTotal, clearShipFx } from "./render/shipfx.js";
import { SHIPS, makeAlly, makeEnemy, foe, liveOf, shipOf, gunOf, gunGap, hullPct, SLOTS } from "./ships.js";
import { endApproachesOnAlert } from "./crew-talk.js";

// Battle groundwork: G.sp.battle = { ctx, enterT, dying, cd, startedAt, inflight, injN, allies: [combatant], enemies: [combatant],
// target } (js/ships.js). Still one-on-one: the officers fight foe(B) (enemies[target]) with the Tenacity, whose live
// hull / shields / power stay on G.ship. Every number the old fight used now comes from SHIPS (the Galor = the old enemy).
// transient presentation state (not saved)
export const SFX = { beams: [], shots: [], booms: [], floaters: [], smoke: [], flares: [], shieldFlare: null, shakeT: 0,
  jink: { x: 0, y: 0, tx: 0, ty: 0, next: 1.4 }, tenRect: { x: 0.02, y: 0.45, w: 0.58, h: 0.17 }, jemRect: { x: 0.6, y: 0.2, w: 0.36, h: 0.19 }, evasiveGraze: false };
export const BR = { tren: "Has the conn" };
// per-combatant one-shot animation state for the renderer (firing / shieldsHit / explode), keyed by combatant id: { state, t }
SFX.anim = {}; SFX.rects = {};
const setAnim = (id, state) => { if (id) SFX.anim[id] = { state, t: 0 }; };
const TEN = SHIPS.tenacity, PHASER = TEN.weapons.find(w => w.id === "phaser"), TORP = TEN.weapons.find(w => w.id === "torpedo");
const tenPoint = (fx, fy) => { const r = SFX.tenRect; return [r.x + fx * r.w, r.y + fy * r.h]; };
const tenHp = k => tenPoint(...TEN.hp[k]);
// points on the enemy's box; hardpoints are authored facing right and the enemy faces left, so x mirrors
const jemPoint = (fx, fy) => { const r = SFX.jemRect; return [r.x + fx * r.w + SFX.jink.x, r.y + fy * r.h + SFX.jink.y]; };
// multi-ship P1: a point on ANY combatant's drawn box (render/space.js SFX.rects, jink included); before the first frame the
// slot-0 boxes stand in. hpOf mirrors x for enemies (authored facing right, drawn facing left).
const ptOf = (c, fx, fy) => { if (!c || c.ref === "ship") return tenPoint(fx, fy); const r = SFX.rects[c.id]; if (!r) return c.side === "enemy" ? jemPoint(fx, fy) : tenPoint(fx, fy); return [r.x + fx * r.w, r.y + fy * r.h]; };
const hpOf = (c, k) => { const h = (c && c.ref === "ship" ? TEN.hp[k] : shipOf(c).hp[k]) || [0.5, 0.5]; return ptOf(c, c && c.side === "enemy" ? 1 - h[0] : h[0], h[1]); };
const jemHp = (E, k) => hpOf(E, k);
// who a combatant shoots (multi-ship P1). Enemies: the Tenacity 40% (the player's ship stays in the fight), the weakest ally 40%,
// any ally 20%. Allies: the Tenacity's target 60% (focus fire), the weakest enemy 25%, any 15%. One live foe = no roll.
const pctOf = c => c.ref === "ship" ? G.ship.hull : hullPct(c);
export function pickTarget(c, B = G.sp.battle, rnd = Math.random) {
  if (!B || !c) return null; const pool = liveOf(c.side === "enemy" ? B.allies : B.enemies); if (pool.length < 2) return pool[0] || null;
  const weakest = pool.reduce((a, x) => pctOf(x) < pctOf(a) ? x : a), r = rnd();
  const A = PACE.allies.aim;   // P3: tunable in pacing.js
  if (c.side === "enemy") { const pr = B.mission && !B.mission.failed && pool.find(x => x.ship === B.mission.protect);
    if (pr && rnd() < A.protectP) return pr;
    return r < A.enemy.ship ? (pool.find(x => x.ref === "ship") || weakest) : r < A.enemy.ship + A.enemy.weakest ? weakest : pool[Math.floor(rnd() * pool.length)]; }
  return r < A.ally.focus ? foe(B) : r < A.ally.focus + A.ally.weakest ? weakest : pool[Math.floor(rnd() * pool.length)];
}
// P2: a wingman (slot 1-2) is a lighter escort: PACE.encounter.groups.wing scales her hull now, her damage and volley gap when she fires
const WING = () => (PACE.encounter.groups && PACE.encounter.groups.wing) || { hull: 1, dmg: 1, gap: 1 };
function wingOf(e, i, on = true) { if (i > 0 && on) { e.wing = true; e.max = e.hull = Math.max(1, Math.round(e.hull * WING().hull)); e.volleyT *= WING().gap; } return e; }   // P25: her first volley waits the stretched gap too
// ---- Q1 #4: T'Ren's threat read. Strength of a side = sum over its live combatants of effective hp x dps (every weapon; the
// Tenacity's torpedoes only with torps aboard; enemy pierce and evasion count). p = logistic(a ln(ours / theirs) + b), worded
// with the story odds words. Sums over B.enemies / B.allies: no ship is hard-coded beyond the Tenacity's live stats.
const mean = r => Array.isArray(r) ? (r[0] + r[1]) / 2 : +r || 0;
function sideStrength(list, enemy) {
  let sum = 0;
  for (const c of liveOf(list)) {
    const d = shipOf(c), me = c.ref === "ship", hp = me ? G.ship.hull + G.ship.shields : (c.hull || 0) + (c.shields || 0);
    let dps = 0; for (const w of d.weapons || []) { if (me && w.ammo === "torps" && !(G.ship.torps > 0)) continue; const gap = w.every ? mean(w.every) : w.cd || 0; if (gap > 0) dps += mean(w.dmg) * (c.wing ? WING().dmg : 1) / (gap * (c.wing ? WING().gap : 1)) * (1 + (w.pierce || 0)); }
    sum += hp / (1 - Math.min(0.6, d.evade || 0)) * dps;
  }
  return sum;
}
const PILL_TAG = { jh_battlecruiser: "Jem'Hadar BC", jh_fighter: "Jem'Hadar fighter", galor: "Galor" };
export function threatRead(B = G.sp.battle) {
  if (!B || !Array.isArray(B.enemies)) return null;
  const us = sideStrength(B.allies, false), them = sideStrength(B.enemies, true); if (!(them > 0)) return null;
  const T = PACE.threat, p = 1 / (1 + Math.exp(-(T.a * Math.log(Math.max(1e-6, us) / them) + T.b))), lead = shipOf(foe(B)), live = liveOf(B.enemies).length;
  const nm = /^[A-Z]/.test(lead.short) ? lead.short : lead.name;
  const tag = `${PILL_TAG[foe(B).ship] || nm}${live > 1 ? ` +${live - 1}` : ""}`;   // Q1b #3: the short name for the pill / banner (the odds word always shows)
  return { p, word: oddsWord(p).word, us, them, tag, label: `${nm}${live > 1 ? ` +${live - 1}` : ""} — ${oddsWord(p).word}` };
}
// P3: the mission a fight belongs to (allies + objective): opts.mission (tests, drills), the convoy route, or Qo'noS joint ops
function missionOf(kind, opts) {
  const M = PACE.allies.missions, SP = G.sp, T = SP.travel;
  if (opts.mission) return M[opts.mission] ? opts.mission : null; if (kind === "debug") return null;
  if (kind === "convoy" || (SP.location === "convoy" && !SP.escortDone && !T)) return "convoy";
  if (SP.location === "qonos" || (T && (T.dest === "qonos" || T.from === "qonos"))) return "jointop";
  const E = M.escort;   // the Federation escort: sometimes on patrol / transit fights
  if (E && E.kinds.includes(kind) && (G.prog.playDays | 0) >= E.minPlayDays && Math.random() < E.chance) return "escort";
  return null;
}
const fillM = (s, d) => s.replace("{name}", d.name).replace("{short}", d.short);
export const missionText = (B, long = false) => { const m = B && B.mission, M = m && PACE.allies.missions[m.id]; if (!M) return "";
  const d = SHIPS[m.lead] || SHIPS[M.allies[0]] || {}; return fillM(long ? M.objective : M.short, { name: d.name || "", short: d.short || "" }); };
// the officers retarget the weakest live enemy when theirs goes down
function retarget(B) { const live = liveOf(B.enemies); if (!live.length) return; const w = live.reduce((a, x) => hullPct(x) < hullPct(a) ? x : a); B.target = B.enemies.indexOf(w); }
const the = d => "the " + d.name;

// opening lines: {A} = "A Jem'Hadar fighter" etc., {a} lower-case, {short} = fighter / Galor / battlecruiser
const OPEN = { convoy: "{A} breaks from the convoy's shadow — weapons free! Red alert!",
  nebula: "Ambush — {a} decloaks out of the nebula cloud, weapons hot!",
  hulk: "Ambush from the hulk's shadow — {a} was holding station in the wreck's blind spot. Red alert!",
  defector: "Trap sprung — {a} drops out of warp. T'Ren: 'Eighteen percent, Lieutenant. We drew it.' Red alert!",
  shadow: "The shadow commits — the tailing {short} turns in and opens fire. Red alert!",
  debug: "Simulation drill — {a} engaging. Red alert!",
  story_wreck: "The wreck's beacon brings {a} out of warp, weapons hot. Red alert!",   // E4: S9's hand-off (a soft fight)
  story_echo: "The probe's handler — {a} — comes about out of the static, weapons hot. Red alert!" };   // E3: S4's hand-off (story.js; a soft fight)
const openLine = (kind, d) => (OPEN[kind] || "Long-range sensors scream — {a} on an attack vector, dropping us out of warp. Red alert!")
  .replace("{A}", d.a.charAt(0).toUpperCase() + d.a.slice(1)).replace("{a}", d.a).replace("{short}", d.short);
// Battles are rare set pieces: none in a session's first 10 minutes and a long gap between fights. Since v18 nothing is ever
// rolled away (the sim only runs while the game is open and not idle-paused). See PACE in pacing.js.
export function battleAllowed(kind) {
  if (kind === "debug") return true;
  const SP = G.sp, now = G.ship.elapsed, last = typeof SP.lastBattleT === "number" ? SP.lastBattleT : -1e9;
  if (PACE_RT.sessionT < PACE.sessionCalm) return false;
  if (now - last < PACE.battleGap) return false;
  return true;
}
// opts.enemy: force an enemy type (tests, debug); otherwise encounters.js (story context, then the gated weighted table)
// RA(a): a battle is ROLLED (allowed now, roster picked up front) and then STARTED. A roll while the player is present (live,
// not the night / offline rules) becomes a held red alert (G.sp.alert; raise/tick/engage below) that waits for ENGAGE or T'Ren's takeover;
// debug drills (and opts.now) start at once. v18: every other roll is held, present or not (it waits while nobody watches). Returns true (started), "held" (an alert is up) or false.
export function startBattle(kind = "enroute", opts = {}) {
  const SP = G.sp;
  if (SP.battle || SP.alert) return false;   // one contact at a time: nothing new rolls while an alert is held
  if (!battleAllowed(kind)) {
    log("Hale: 'Jem'Hadar patrol on long-range sensors, Captain. They haven't seen us.' T'Ren alters course a few degrees. Nobody says anything until it's gone.", "comm");
    return false;
  }
  const Rl = rollBattle(kind, opts);
  if (holdsAlert(kind, opts)) { raiseAlert(Rl, opts); return "held"; }
  return startRolled(Rl, opts);
}
const holdsAlert = (kind, opts) => kind !== "debug" && !opts.now;
function raiseAlert(Rl, opts) {
  suspendPrompt();
  const SP = G.sp; if (SP.travel) SP.travelPaused = true;
  const { away: _aw, ...R0 } = Rl; SP.alert = { ...R0, soft: !!opts.soft, t: 0, at: G.ship.elapsed };
  endApproachesOnAlert();   // E1: approaching crew go to battle stations as soon as the alert is raised
  const tr = threatRead(alertBattle(SP.alert)), d = SHIPS[Rl.enemies[0]];
  log(`Hale: 'Contact — ${d.a}${Rl.enemies.length > 1 ? ` and ${Rl.enemies.length - 1} more` : ""}, holding at range. All stop, shields up.' Red alert: your call, Lieutenant.`, "fault");
  toast(`⚠ RED ALERT — ${d.name}${tr ? ` · T'Ren: ${tr.word}` : ""} · tap to respond`, "crit");
  G.ship.alertT = 7; shipNews("<b>Red alert — holding.</b> Contact at range, all stop. Tap <b>RED ALERT</b> to see it and give the word."); saveSoon("alert");
}
// a battle-shaped preview of a held alert (fresh combatants) for the threat read and the battle view
export function alertBattle(A = G.sp.alert) { if (!A) return null; return { enemies: A.enemies.map((s, i) => wingOf(makeEnemy(s, i), i, A.wing)), allies: [makeAlly("tenacity", 0), ...A.allies.map((s, i) => makeAlly(s, i + 1))], target: 0 }; }
// ENGAGE (by: "lt" from the view, "tren" after the hold). The roll already passed the calm / gap rules, so this never re-checks them.
export function engageAlert(by = "lt") {
  const SP = G.sp, A = SP.alert; if (!A || SP.battle) return false;
  SP.alert = null;
  if (by === "tren") log("T'Ren: 'Engaging, Lieutenant. Join us when you can.'", "comm");
  else log("You call it: 'Engage.' T'Ren nods once. 'All hands, battle stations.'", "comm");
  const ok = startRolled({ ...A, away: false }, {});
  if (ok && SP.battle) SP.battle.by = by === "tren" ? "tren" : "lt";   // RA(b): who gave the word (the Lt is watching only when they did)
  if (ok && SP.battle && A.soft) SP.battle.soft = true;   // a story fight stays soft: faults capped at MEDIUM, minor injuries only
  saveSoon("alert"); return ok;
}
// held: present time counts toward T'Ren's takeover; time not present (idle >= 60 s) freezes it. v18: no break-off - the
// contact waits however long the player is gone (a closed / hidden / idle-paused game runs no sim at all)
export function tickAlert(dt) {
  const SP = G.sp, A = SP.alert; if (!A) return;
  if (SP.battle) { SP.alert = null; return; }
  if (SP.travel) SP.travelPaused = true;
  const K = PACE.alert;
  if (!isPresent()) return;
  A.t += dt;
  if (A.t >= K.holdPresent) engageAlert("tren");
}
function rollBattle(kind, opts) {
  const SP = G.sp;
  SP.lastBattleT = G.ship.elapsed;
  const away = false;   // v18: no away fights (encounters.js keeps the away table for tools/battle-sim only)
  // multi-ship P1: opts.enemies / opts.allies (ship id lists, slot order, max SLOTS a side) force a group (debug drills, tests;
  // real encounters stay one-on-one until P2's group table). P23: an ally id passed as opts.enemy used to become a Galor
  // silently - it now joins the allies (with a console warning) and the enemy rolls as usual.
  const isE = id => SHIPS[id] && SHIPS[id].side === "enemy", isA = id => SHIPS[id] && SHIPS[id].side === "ally" && id !== "tenacity";
  const fE = (Array.isArray(opts.enemies) ? opts.enemies : []).filter(isE).slice(0, SLOTS), fA = (Array.isArray(opts.allies) ? opts.allies : []).filter(isA);
  if (opts.enemy && !isE(opts.enemy)) { console.warn(`startBattle: '${opts.enemy}' is not an enemy ship${isA(opts.enemy) ? " - added as an ally" : ""}`); if (isA(opts.enemy)) fA.unshift(opts.enemy); }
  const pick = chooseEncounter(kind, { prog: G.prog, ship: G.ship, enc: SP.enc, forced: fE[0] || (isE(opts.enemy) ? opts.enemy : null), away }), enemy = pick.id, d = SHIPS[enemy];
  const wings = fE.length ? fE.slice(1) : chooseWingmen(enemy, kind, { prog: G.prog, ship: G.ship, away });   // P2: the groups table (forced lists skip it)
  const mid = missionOf(kind, opts), M = mid && PACE.allies.missions[mid], mA = M && Math.random() < M.p ? M.allies.filter(isA) : [];   // P3: mission allies (P26: only in fights the player watches - none away / offline)
  const aIds = [...fA, ...mA.filter(id => !fA.includes(id))].slice(0, SLOTS - 1);
  const mission = M && aIds.some(id => M.allies.includes(id)) ? { id: mid, lead: aIds.find(id => M.allies.includes(id)), protect: M.protect && aIds.includes(M.protect) ? M.protect : null, failed: false } : null;
  noteEncounter(SP, enemy, kind, G.prog.playDays, pick.held, away);
  return { kind, enemies: [enemy, ...wings], wing: opts.wing !== false, allies: aIds, mission, away };
}
export function startRolled(Rl, opts = {}) {
  clearShipFx(true);   // P21 #2: no explosion carries into a new battle
  const SP = G.sp; if (SP.battle) return false;
  suspendPrompt();
  const kind = Rl.kind, away = !!Rl.away, enemy = Rl.enemies[0], d = SHIPS[enemy];
  const enemies = Rl.enemies.map((s, i) => wingOf(makeEnemy(s, i), i, Rl.wing !== false)), allies = [makeAlly("tenacity", 0), ...(Rl.allies || []).map((s, i) => makeAlly(s, i + 1))];
  const mission = Rl.mission ? { ...Rl.mission, failed: false } : null;
  SP.battle = { ...(enemy === "jh_battlecruiser" && kind !== "debug" ? { bc: { h0: Math.round(G.ship.hull), away, pd: G.prog.playDays | 0 } } : {}), ctx: kind, mission, enterT: 0, dying: 0, cd: { phaser: 0, torp: 0, evasive: 0, divert: 0 }, startedAt: G.ship.elapsed, live: !away, allies, enemies, target: 0, allyDying: 0 };
  PACE_RT.liveFight = !away;   // pass 16 B1: live-started = live rules to the end (saved with the battle)
  G.stats.battles++;
  const alpha = enemy === "jh_battlecruiser" ? alphaStrike() : null;   // pass 15: live (debug drills too: battle-sim) - her opening volley knocks the READY abilities
  SFX.jink = { x: 0, y: 0, tx: 0, ty: 0, next: 1.4 }; SFX.shieldFlare = null; SFX.anim = {}; SFX.smoke.length = 0; SFX.flares.length = 0;
  if (SP.preScanned) { SP.preScanned = false; const E = foe(SP.battle); E.hull = Math.round(E.max * 0.76); log("Diallo: 'The defector's shield frequencies are exact. She starts this fight pre-scanned.'", "comm"); }
  if (SP.travel) SP.travelPaused = true;
  G.ship.alertT = 7;
  if (enemy === "jh_battlecruiser") {   // pass 13: a short sensor warning first (log + toast), the red-alert card ~1.2 s later. A danger alert like
    // the card: never quiet-gated; offline catch-up drops the toast and card, the log keeps the line (and the return report headlines the fight)
    log("Hale: 'Long-range sensors — capital-class contact, Dominion signature, closing fast.'", "fault");
    toast("⚠ SENSORS — capital-class contact", "crit");
    if (alpha && alpha.length) {   // pass 15: the player sees why the officers' abilities are suddenly cooling
      log(`Hale: 'Polaron alpha strike on the bridge! ${alpha.join(", ")} knocked offline — half recharge to bring them back.'`, "fault");
      toast(`⚡ ALPHA STRIKE — ${alpha.length} bridge abilit${alpha.length > 1 ? "ies" : "y"} knocked offline`, "crit");
    }
  }
  log(openLine(kind, d), "fault");
  if (enemies.length > 1) log(`Hale: '${enemies.length} contacts — ${enemies.slice(1).map(e => the(shipOf(e))).join(", ")} with her.'`, "fault");
  for (const a of allies.slice(1)) log(`${shipOf(a).name} forms up on our flank.`, "comm");
  if (mission) log(`Objective: ${missionText(SP.battle, true)}`, "comm");   // P3: who is with us, and what the fight is for
  if (enemy === "jh_battlecruiser") {   // encounter weighting: the capital ship is an EVENT - a red-alert card, not just a toast.
    // Not quiet-gated: the pass 09 gate (bus.js cheerful) holds back light / cheerful lines only, and this is a danger
    // alert (a death-hush must never hide a battle warning). Offline catch-up (bus quiet) skips it like every toast.
    redAlertCard({ delay: 1200, title: d.name.toUpperCase(), cls: d.cls, kicker: "RED ALERT · CAPITAL SHIP",
      // pass 13: the copy matches the real danger (gated start: she wins ~1 fight in 8, and a won fight still costs ~20% hull)
      kicker2: threatRead() ? `T'Ren: ${threatRead().word}` : "", lines: ["She outguns us — if it goes badly, T'Ren will break off. Expect hull damage.", "Her polarons bleed through shields. Keep shields and weapons up, tubes loaded, the deck patched."] });   // pass 15 copy: injuries are ~2% a fight, and disengages happen
    log("Diallo: 'Captain — that's a battlecruiser. She outguns us, and those polarons go straight through shields. All hands, brace.'", "fault");
  } else toast("RED ALERT — " + d.name + (mission ? " · " + missionText(SP.battle) : "") + (threatRead() ? ` · T'Ren: ${threatRead().word}` : ""), "crit");
  shipNews("<b>Red alert.</b> The bridge officers have the fight; your post is the <b>deck</b>: keep her systems alive and her tubes loaded.");
  return true;
}
// E: who was hit (default the Tenacity's target; a dead one passes to the target). by: the ally that fired (null = the Tenacity,
// whose weak-point scan applies)
function damageEnemy(dmg, label, E = null, by = null) {
  const B = G.sp.battle; if (!B || B.dying) return;
  if (!E || E.dead || !B.enemies.includes(E)) E = foe(B);
  if (!E || E.dead) return;
  const d = shipOf(E);
  if (d.evade && Math.random() < d.evade) {   // a fast ship jinks clear (no roll at all for ships without evade: the baseline's dice are untouched)
    const jp = ptOf(E, 0.45, 0.2); SFX.floaters.push({ x: jp[0], y: jp[1], t: 0, text: "MISS", color: "#cfd8e6" }); SFX.jink.next = 0;
    log(`${label} — the ${d.short} jinks clear. Miss.`); return;
  }
  if (!by && G.ab.scan.active > 0) { dmg = Math.round(dmg * 1.5); label += " (weak-point scan: +50%)"; }
  E.hull = Math.max(0, E.hull - dmg);   // pass-03 N-3: never negative
  if (G.sp.battle) setAnim(E.id, "shieldsHit");
  SFX.jink.next = Math.min(SFX.jink.next, 0.4);
  const jp = ptOf(E, 0.45, 0.2);
  SFX.floaters.push({ x: jp[0], y: jp[1], t: 0, text: "−" + dmg, color: "#ffb3ab" });
  log(`${label} — ${d.name} hull at ${hullPct(E)}%.`);
  if (E.hull <= 0) {   // multi-ship P1: each ship dies on its own clock; the battle's victory countdown (B.dying) starts with the LAST enemy
    E.dead = true; E.dying = deathTotal(E.ship); setAnim(E.id, "explode");   // the death visual is render/shipfx.js (EXPLOSION in data.js)
    log(d.death || `The ${d.name} breaks apart — secondary explosions walking her spine. She's gone.`, "good");
    const live = liveOf(B.enemies);
    if (!live.length) B.dying = Math.max(0.1, ...B.enemies.map(e => e.dying || 0)) + (B.enemies.length > 1 ? 0.4 : 0);   // P2: room for the staggered detonations
    else { retarget(B); log(`Hale: 'Target destroyed. Retargeting ${the(shipOf(foe(B)))} — ${live.length} contact${live.length > 1 ? "s" : ""} left.'`, "comm"); toast(`${d.short} destroyed — ${live.length} left`, "good"); }
  }
}
// an escort / ally ship takes a hit: shields (points) first, then the hull. At 0 she dies on her own clock (B.allyDying counts the
// allies whose deaths are playing). The Tenacity is never routed here: she is not destroyable (a loss is the tow, towToDS9).
function damageAlly(A, dmg, label) {
  const B = G.sp.battle; if (!B || !A || A.dead || A.ref === "ship") return;
  const d = shipOf(A), tp = ptOf(A, 0.5, 0.4);
  if (A.shields >= dmg) { A.shields -= dmg; setAnim(A.id, "shieldsHit"); SFX.floaters.push({ x: tp[0], y: tp[1], t: 0, text: "SHIELDS −" + Math.round(dmg), color: "#9cd2ff" }); log(`${label} — ${d.short}'s shields hold at ${Math.round(A.shields)}.`); return; }
  const through = dmg - A.shields; A.shields = 0; A.hull = Math.max(0, A.hull - through); setAnim(A.id, "shieldsHit");
  SFX.booms.push({ x: tp[0], y: tp[1], t: 0, dur: 0.45, big: false }); SFX.floaters.push({ x: tp[0], y: tp[1], t: 0, text: "HULL −" + Math.round(through), color: "#ff8a7a" });
  log(`${label} — ${d.name} hull at ${hullPct(A)}%.`, "fault");
  if (A.hull <= 0) { A.dead = true; A.dying = deathTotal(A.ship); B.allyDying = (B.allyDying | 0) + 1; setAnim(A.id, "explode");
    log(`${d.name} is gone — her warp core lets go and the wreck tumbles out of formation. T'Ren says nothing for a long moment.`, "fault"); toast(`${d.short} lost`, "crit");
    const S = G.ship, mo = PACE.allies.morale, e0 = S.energy; S.energy = clamp(S.energy - mo.energy, 0, 100);   // P3: an ally lost costs morale
    log(`Engineering goes quiet. Nobody says her name. Energy −${Math.round(e0 - S.energy)}.`, "fault");
    moodAll(A.ship === "freighter" ? "keralaLost" : "allyLost");   // N2/P28: the crew takes it hard (the Kerala hardest)
    const m = B.mission; if (m && !m.failed && A.ship === m.lead && A.ship !== m.protect) { m.failed = true; log(`Objective failed — the ${d.short} is lost.`, "fault"); }   // P26: an escort / joint-op ally lost = FAILED too (no rep cost)
    if (m && !m.failed && A.ship === m.protect) { m.failed = true; const SP = G.sp; SP.rep = Math.max(0, SP.rep - PACE.allies.failRep);
      log(`Objective failed — the ${d.short} is lost${m.id === "convoy" ? " and the convoy run with her" : ""}. Reputation −${PACE.allies.failRep}.`, "fault"); toast(`Objective failed — ${d.short} lost`, "crit");
      if (m.id === "convoy" && SP.location === "convoy") { SP.escortDone = true; } } }
}
// pass 15 D2: a battlecruiser fight's record (hull before / after, outcome, whether the player was away) -> G.sp.enc.bcRec
function recBc(B, out, h1) {
  if (B && B.bc) noteBcEnd(G.sp, { pd: B.bc.pd, away: !!B.bc.away, h0: B.bc.h0, h1: Math.round(h1), out });
}
function endBattleVictory() {
  const SP = G.sp, S = G.ship, B0 = SP.battle, kind = B0 ? B0.ctx : null, d = shipOf(foe(B0)), killed = B0 ? B0.enemies.map(shipOf) : [d];
  recBc(SP.battle, "won", S.hull);
  SP.battle = null; SP.evasiveT = 0; G.stats.wins++; clearShipFx();   // P21 #2
  if (B0 && kind !== "debug") { const bc = B0.enemies.some(e => e.ship === "jh_battlecruiser"), n = killed.length, hp = Math.round(S.hull);   // #11: a won fight is a Shift Report moment (a tow never is)
    pushMoment(bc ? "bc" : "win", bc ? `You beat off a Jem'Hadar battlecruiser at ${hp}% hull` : n > 1 ? `You beat off ${n} ships at ${hp}% hull` : `You beat off ${d.a || "an enemy ship"} at ${hp}% hull`, { n }); }
  moodAll("win"); addSkillXp("lt", "tactical", MOOD_XP.win); for (const sl of Object.values(AB_OWNER)) addSkillXp(G.prog.crew && G.prog.crew.slots[sl], "tactical", MOOD_XP.win);   // N2
  const salvage = Math.max(0, Math.min(killed.reduce((a, k) => a + (k.salvage ?? 3), 0), S.partsCap - S.parts)); S.parts += salvage;   // multi-ship P1: every kill's salvage
  log(`Victory. Tractor crews pull ${salvage} usable part(s) from the wreckage.`, "good");
  toast(killed.length > 1 ? `Victory — ${killed.length} ships destroyed` : `Victory — ${d.short} destroyed`, "good");
  for (const k of killed) if (k.rep && k !== d) SP.rep += k.rep;
  if (d.rep) { SP.rep += d.rep; log(`Starfleet Command notes the kill: ${d.a.replace(/^a /, "a ")} doesn't go down every day. Reputation +${d.rep}.`, "comm"); }
  const mf = B0 && B0.mission && B0.mission.failed;   // P3: a lost freighter means no convoy bonus
  const cv = kind === "convoy" || (B0 && B0.mission && B0.mission.id === "convoy");   // P26: the debug mission:'convoy' hook pays like a real convoy fight
  if (cv && !mf) { SP.rep++; log("The convoy is safe — every freighter accounted for. Reputation rising.", "comm"); }   // P26: the run continues - 'Convoy delivered' pays when the escort clock completes
  else if (mf && B0.mission.id === "convoy") { SP.escortDone = true; log("The raiders are dead, but the convoy run is over: the Kerala's cargo went with her.", "comm"); }
  if (SP.travel && SP.travelPaused) { SP.travelPaused = false; log(`Course resumed — back to warp for ${DESTS[SP.travel.dest].name}.`, "comm"); }
  else { SP.cap.decideT = 30; SP.cap.dest = null; SP.cap.reason = `Action resolved at ${SP.location ? DESTS[SP.location].name : "deep space"} — the Captain is evaluating her next orders.`; }
  shipNews("Battle won. Check the <b>deck</b> for damage the fight left behind.");
}
export function damageShip(dmg, label, pierce = 0, src = null) {
  const S = G.ship, SP = G.sp;
  if (G.ab.pattern.active > 0) { dmg *= 0.5; label += " (attack pattern analysis: halved)"; }
  if (SP.evasiveT > 0) { dmg *= 0.35; label += " (evasive pattern sheds most of it)"; }
  S.alertT = 7;
  const tp = tenHp("hit");
  if (S.shields >= dmg) {
    // pass 13: a piercing weapon (the battlecruiser's polarons: weapon.pierce) bleeds part of an absorbed hit through to the hull.
    // Hull only - no fault / injury roll (those stay with real shield breaches). Weapons without pierce (fighter, Galor) are untouched.
    const bleed = pierce > 0 ? Math.min(S.hull, dmg * pierce) : 0;
    S.shields -= dmg - Math.max(0, bleed); setAnim("tenacity", "shieldsHit");
    if (!SFX.evasiveGraze) SFX.shieldFlare = { t: 0, dur: 0.65 };
    SFX.floaters.push({ x: tp[0], y: tp[1] - 0.05, t: 0, text: "SHIELDS −" + Math.round(dmg - Math.max(0, bleed)), color: "#9cd2ff" });
    if (bleed > 0) { S.hull = Math.max(0, S.hull - bleed); SFX.floaters.push({ x: tp[0], y: tp[1] + 0.02, t: 0, text: "HULL −" + Math.round(bleed), color: "#ff8a7a" });
      log(`${label} — shields hold at ${Math.round(S.shields)}%, but the polarons bleed through: hull −${Math.round(bleed)}%, at ${Math.round(S.hull)}%.`, "fault");
      if (S.hull <= 0) towToDS9(); return; }
    log(`${label} — shields absorb it, holding at ${Math.round(S.shields)}%.`);
    return;
  }
  SFX.shakeT = 0.35;
  SFX.booms.push({ x: tp[0], y: tp[1], t: 0, dur: 0.5, big: false });
  for (let i = 0; i < 9; i++) SFX.smoke.push({ x: tp[0] + rand(-0.02, 0.02), y: tp[1] + rand(-0.015, 0.015), vx: rand(-0.05, 0.05), vy: rand(-0.05, 0.02), t: 0, life: rand(0.3, 0.7), r: 0.006, kind: "spark" });
  const through = (dmg - S.shields) * 0.6;
  S.shields = 0; S.hull = Math.max(0, S.hull - through);
  SFX.floaters.push({ x: tp[0], y: tp[1] - 0.05, t: 0, text: "HULL −" + Math.round(through), color: "#ff8a7a" });
  log(`${label} — shields down, the hull takes ${Math.round(through)}%. Hull at ${Math.round(S.hull)}%.`, "fault");
  if (S.hull <= 0) { towToDS9(); return; }
  let id = null;
  if (Math.random() < 0.5) {
    id = spawnFault("battle");
    if (id) log("Damage control: the hit started a fault aboard — it's on the DECK, and the Lieutenant can reach it mid-battle.", "fault");
  }
  const gun = gunOf(src || foe(G.sp.battle));
  hooks.shipHit.forEach(f => f({ sys: id, hit: gun ? gun.hits : null }));   // phase 6: a hull hit can injure someone (js/injuries.js)
}
function enemyFire(E = foe(G.sp.battle)) {
  const B = G.sp.battle, SP = G.sp, gun = gunOf(E);
  if (!B || B.dying || !gun || !E || E.dead) return;
  const T = pickTarget(E, B); if (!T) return;
  if (T.ref !== "ship") {   // she turns her guns on an escort
    const f = hpOf(E, "fire"), to = hpOf(T, "hit"); setAnim(E.id, "firing");
    SFX.beams.push({ x0: f[0], y0: f[1], x1: to[0], y1: to[1], t: 0, dur: 0.4, col: gun.col });
    damageAlly(T, rand(gun.dmg[0], gun.dmg[1]) * (E.wing ? WING().dmg : 1), `${gun.name} from ${the(shipOf(E))}`); return;
  }
  if (E.lastVolleyAt !== undefined) E.volleyGap = G.ship.elapsed - E.lastVolleyAt;
  E.lastVolleyAt = G.ship.elapsed;
  const from = jemHp(E, "fire"), ev = SP.evasiveT > 0;
  const miss = tenHp("miss"), to = ev ? [miss[0] - 0.05, miss[1] - 0.06] : tenPoint(0.72, 0.52);
  SFX.beams.push({ x0: from[0], y0: from[1], x1: to[0], y1: to[1], t: 0, dur: 0.4, col: gun.col });
  SFX.evasiveGraze = ev; setAnim(E.id, "firing");
  damageShip(rand(gun.dmg[0], gun.dmg[1]) * (E.wing ? WING().dmg : 1), `${gun.name} from ${the(shipOf(E))}`, gun.pierce || 0, E);
  SFX.evasiveGraze = false;
  SFX.jink.next = Math.min(SFX.jink.next, 0.25);
}
// an armed ally (the Bird-of-Prey) fires at her pick; the freighter has no guns (volleyT stays 99)
function allyFire(A) {
  const B = G.sp.battle, gun = gunOf(A); if (!B || B.dying || !gun || A.dead) return;
  const T = pickTarget(A, B); if (!T) return;
  const f = hpOf(A, "fire"), to = hpOf(T, "hit"); setAnim(A.id, "firing");
  SFX.beams.push({ x0: f[0], y0: f[1], x1: to[0], y1: to[1], t: 0, dur: 0.35, col: gun.col });
  damageEnemy(Math.round(rand(gun.dmg[0], gun.dmg[1])), `${gun.name} from ${the(shipOf(A))}`, T, A);
}
function haleFirePhaser() {
  const B = G.sp.battle, S = G.ship;
  if (!B || B.dying || B.cd.phaser > 0) return;
  if (S.power < PHASER.power) { B.cd.phaser = 2; log("Hale: 'Phasers are starved, Captain — the grid can't spare the power.' Somebody on deck needs to feed the core.", "fault"); return; }
  const eps = impairing("eps");
  setAnim("tenacity", "firing");
  S.power -= PHASER.power; B.cd.phaser = eps ? PHASER.cdImpaired : PHASER.cd;
  const from = tenHp("fire"), to = jemHp(foe(B), "hit");
  SFX.beams.push({ x0: from[0], y0: from[1], x1: to[0], y1: to[1], t: 0, dur: 0.35, col: PHASER.col });
  SFX.flares.push({ x: to[0], y: to[1], t: 0, dur: 0.42, col: "255,170,80" });
  damageEnemy(Math.round(rand(PHASER.dmg[0], PHASER.dmg[1]) * (eps ? 0.5 : 1)), "Hale: " + PHASER.name + (eps ? " (EPS fault — output halved)" : ""));
}
function launchTorp(delay = 0) {
  const B = G.sp.battle, E = foe(B), from = tenHp("torp"), to = ptOf(E, rand(0.3, 0.6), rand(0.35, 0.65));
  const dmg = Math.round(rand(TORP.dmg[0], TORP.dmg[1]));
  SFX.shots.push({ x0: from[0], y0: from[1], x1: to[0], y1: to[1], t: -delay, dur: 0.5, dmg, tid: E ? E.id : null });
  if (B) B.inflight = (B.inflight || 0) + dmg;   // BUG-17: saved with the battle so a reload doesn't eat the salvo
}
// BUG-17: after a reload, torpedoes that were in flight when the game saved land at once (SFX.shots isn't saved)
export function settleInflightTorps() {
  const B = G.sp.battle;
  if (!B || !(B.inflight > 0)) return;
  const dmg = B.inflight; B.inflight = 0;
  if (!SFX.shots.length) damageEnemy(dmg, "Torpedoes already in flight when the bridge log resumed — they strike home");
}
function haleFireTorp() {
  const B = G.sp.battle, S = G.ship;
  if (!B || B.dying || B.cd.torp > 0 || impairing("loader") || S.torps <= 0) return;
  S.torps--; B.cd.torp = TORP.cd; launchTorp(); setAnim("tenacity", "firing"); S.tubeFlash = S.elapsed;
  log(`Hale: 'Torpedo away.' ${S.torps} left in the tubes.`, "comm");
}
function trenEvasive() {
  const B = G.sp.battle;
  if (!B || B.dying || B.cd.evasive > 0 || impairing("warpcore")) return;
  B.cd.evasive = 9; G.sp.evasiveT = 3; BR.tren = "Evasive ordered";
  log("T'Ren: 'Evasive pattern delta — helm, execute.' The old girl dances; incoming fire will mostly miss.", "comm");
}
function trenDivert() {
  const B = G.sp.battle, S = G.ship;
  if (!B || B.dying || B.cd.divert > 0 || S.power < 10) return;
  S.power -= 10; B.cd.divert = 6;
  const before = S.shields; S.shields = clamp(S.shields + 22, 0, shieldCap());
  BR.tren = "Power diverted to shields";
  log(`T'Ren: 'Divert power to shields.' Shields ${Math.round(before)}% → ${Math.round(S.shields)}%.`, "good");
}
// N1 lever (manager-approved, art batch 2 follow-up): only a CRITICAL warp-core fault denies T'Ren's break-off. An impairing
// LOW / MEDIUM core fault still blocks evasive manoeuvres (it costs the ship agility) but no longer traps her in the fight.
const coreCrit = () => { const f = G.ship.faults.warpcore; return !!f && f.sev === "crit"; };
function trenDisengage() {
  const SP = G.sp, B = SP.battle;
  if (!B || B.dying || coreCrit()) return;
  const enroute = !!(SP.travel && SP.travelPaused), kind = B.ctx;
  SP.battle = null; SP.evasiveT = 0; SP.cap.decideT = 30; clearShipFx();
  if (enroute) { SP.travel = null; SP.travelPaused = false; SP.location = null; }
  if (kind === "convoy") SP.escortDone = true;
  moodAll("disengage");   // N2
  log("T'Ren: 'Helm — emergency warp, disengage.' The Tenacity breaks off and runs.", "comm");
  toast("Disengaged", "warn");
  if (Math.random() < 0.55) { const d = shipOf(foe(B)); log(`A parting volley from ${the(d)} chases her out—`, "fault"); damageShip(rand(d.parting[0], d.parting[1]), "Parting volley"); }
  if (!G.sp.battle) recBc(B, "disengaged", G.ship.hull);
}
function officerOrders() {
  const B = G.sp.battle, S = G.ship, E = foe(B);
  if (!B || B.dying || !E) return;
  haleFirePhaser();
  if (!impairing("loader") && S.torps > 0 && (S.torps >= 2 || E.hull <= E.max * 0.35)) haleFireTorp();
  const hot = !!E.volleyGap && E.volleyGap <= 3.3 && S.elapsed - E.lastVolleyAt < 4.5;
  if (!impairing("warpcore") && B.cd.evasive <= 0 && (S.shields < 35 || hot)) trenEvasive();
  if (B.cd.divert <= 0 && S.shields < 40 && S.power >= 30) trenDivert();
  if (S.hull < 25) {
    if (coreCrit()) { if (!B.deniedLogged) { B.deniedLogged = true; BR.tren = "Disengage denied — warp core critical"; log("T'Ren: 'Disengage denied — the warp core is critical. We hold, Lieutenant. Keep her alive.'", "fault"); } }
    else trenDisengage();
  }
}
export function towToDS9() {
  const SP = G.sp, S = G.ship, soft = !!(SP.battle && SP.battle.soft);
  recBc(SP.battle, "towed", 0);
  SP.battle = null; SP.travel = null; SP.travelPaused = false; SP.evasiveT = 0; SP.visit = null; G.stats.tows++; clearShipFx(); moodAll("tow");
  SP.location = "ds9"; SP.escortDone = true;
  Object.assign(SP.cap, { decideT: PACE.dockDwell[0], dest: "convoy", holdLogged: false, reason: "Towed home to Deep Space Nine — holding for repairs. Departure pending my hull minimum of 40%." });
  S.hull = 20; S.shields = 0; S.power = Math.min(S.power, 30);
  log("The Tenacity goes dark — main power gone, drifting, guns silent. Disabled.", "fault");
  FAULT_RT.soft = soft; try { for (let i = 0; i < 3; i++) spawnFault("battle"); } finally { FAULT_RT.soft = false; }
  log("A runabout out of Deep Space Nine takes her under tow. She'll fly again — Mirandas always do.", "comm");
  toast("Disabled — towed to Deep Space Nine", "crit");
  shipNews("<b>Disabled and towed to Deep Space Nine.</b> Hull at 20%, systems faulted — the Lieutenant has work to do.");
}
// ---- officer abilities (autonomous) ----
// pass 15 (manager call): her opening polaron volley hits the bridge - abilities with less than knockFrac x cdMax left go to it; ones cooling longer are untouched
const AB_NAME = { pattern: "Attack Pattern Analysis", miracle: "Miracle Worker", scan: "Weak-Point Scan", spread: "Torpedo Spread" };   // pass 16 B4: the full ability names (as on the officer cards, js/data.js OFFICERS)
function alphaStrike() {
  const c = PACE.encounter.bcAlpha; if (!c) return null; const hit = [];
  // judged: "ready" includes nearly ready - every ability is raised to at least knockFrac x cdMax; one with more than that left keeps its timer
  for (const [k, a] of Object.entries(G.ab)) { const to = a && typeof a === "object" && a.cdMax ? a.cdMax * c.knockFrac : 0; if (to && a.cd < to && !(a.active > 0)) { a.cd = to; hit.push(AB_NAME[k] || k); } }
  return hit;
}
const armed = a => !!(G.sp.battle && !G.sp.battle.dying && a.cd <= 0 && !(a.active > 0));
function usePattern() { const a = G.ab.pattern; a.cd = a.cdMax; a.active = 20; a.last = "Halved incoming fire — 20s"; log("T'Ren: Attack Pattern Analysis — incoming fire halved for 20 seconds. 'Their firing pattern is a solved equation, Lieutenant.'", "comm"); }
function useMiracle() {
  const a = G.ab.miracle, S = G.ship, sup = playerInEngineering();
  a.cd = sup ? 45 : a.cdMax;
  const patch = sup ? 14 : 8;
  let worst = null, wt = -1;
  const frozen = [...medFrozen(), ...medDepends()];   // pass 11 HOLD 3 + pass 13 HOLD 2: never a system a patient's clock / surgery depends on, present or away
  for (const [k, f] of Object.entries(S.faults)) if (f.t > wt && !frozen.includes(k)) { wt = f.t; worst = k; }
  const before = S.hull; S.hull = clamp(S.hull + patch, 0, 100);
  const gained = Math.round((S.hull - before) * 10) / 10;
  const credit = sup ? "Miracle Worker, empowered by the Lieutenant's support — " : "Okafor: Miracle Worker — ";
  if (worst) {
    const nm = SYSTEMS[worst].name; delete S.faults[worst]; cancelRepairIf(worst);
    log(`${credit}${nm} fault repaired on the spot — no parts spent — ${gained > 0 ? `and hull patched +${gained}%` : "hull already at full strength"}.`, "good");
    a.last = `Repaired ${nm}${gained > 0 ? ` · hull +${gained}%` : ""}${sup ? " · empowered" : ""}`;
  } else { log(`${credit}no active faults — patch teams turn the miracle on the hull${gained > 0 ? `, +${gained}%` : " (already at full strength)"}.`, "good"); a.last = `${gained > 0 ? `Hull +${gained}%` : "Hull already full"}${sup ? " · empowered" : ""}`; }
}
function useScan() { const a = G.ab.scan; a.cd = a.cdMax; a.active = 15; a.last = "Weapon damage +50% — 15s"; log("Diallo: Weak-Point Scan — shield seams and reactor vents mapped. All Tenacity weapon damage +50% for 15 seconds.", "comm"); }
function useSpread() {
  const a = G.ab.spread, S = G.ship;
  if (S.torps <= 0 || impairing("loader")) return;
  a.cd = a.cdMax; const n = S.torps; S.torps = 0;
  for (let i = 0; i < n; i++) launchTorp(i * 0.09);
  S.tubeFlash = S.elapsed; a.last = `Salvo away — ${n} torpedo${n === 1 ? "" : "es"}`;
  log(`Hale: Torpedo Spread — all ${n} loaded torpedo${n === 1 ? "" : "es"} away in a single salvo!`, "comm");
}
function autoFire() {
  const B = G.sp.battle, ab = G.ab, S = G.ship, E = foe(B);
  if (!B || B.dying || !E) return;
  if (armed(ab.pattern) && Math.min(...liveOf(B.enemies).map(e => e.volleyT)) <= 1.5) usePattern();
  if (armed(ab.scan)) useScan();
  if (armed(ab.spread) && ((S.torps >= 2 && E.hull > E.max * 0.5) || S.torps >= 3)) useSpread();
  if (armed(ab.miracle) && (Object.keys(S.faults).length > 0 || S.hull < 60)) useMiracle();
}
function tickAbilities(dt) {
  const ab = G.ab;
  for (const [k, a] of Object.entries(ab)) if (a.cd > 0) a.cd = Math.max(0, a.cd - dt * cdRate(k));   // N2: officer mood / Tactical
  if (ab.pattern.active > 0) { ab.pattern.active -= dt; if (ab.pattern.active <= 0) { ab.pattern.active = 0; if (G.sp.battle) log("Attack Pattern Analysis expired — T'Ren is already recalculating.", "comm"); } }
  if (ab.scan.active > 0) { ab.scan.active -= dt; if (ab.scan.active <= 0) { ab.scan.active = 0; if (G.sp.battle) log("Weak-Point Scan expired — targeting back to standard.", "comm"); } }
}
export function tickBattle(dt) {
  dt *= fxTimeScale();   // death hit-stop (render/shipfx.js)
  tickAbilities(dt);
  autoFire();
  const SP = G.sp, B = SP.battle, E = foe(B), spd = E ? shipOf(E).speed : 1;
  if (B && !E) { SP.battle = null; SP.evasiveT = 0; }   // defensive: a battle with no enemy left just ends (hardenBattle drops these at load)
  else if (B) {
    B.enterT = Math.min(1, B.enterT + dt / 1.4 * Math.max(0.6, spd));   // a fast ship arrives faster
    for (const k of Object.keys(B.cd)) if (B.cd[k] > 0) B.cd[k] = Math.max(0, B.cd[k] - dt);
    if (SP.evasiveT > 0) SP.evasiveT = Math.max(0, SP.evasiveT - dt);
    for (const c of [...B.enemies, ...B.allies]) if (c.dead && c.dying > 0) { c.dying = Math.max(0, c.dying - dt); if (c.dying <= 0 && c.side === "ally") B.allyDying = Math.max(0, (B.allyDying | 0) - 1); }
    if (B.dying) {
      B.dying -= dt;
      if (B.dying <= 0) endBattleVictory();
    } else for (const c of [...B.enemies, ...B.allies]) {   // multi-ship P1: every live gun on its own clock (gunGap: enemy 'every', ally 'cd')
      if (c.ref === "ship" || c.dead || !SP.battle || SP.battle.dying) continue;
      c.volleyT = (typeof c.volleyT === "number" ? c.volleyT : 2) - dt;
      if (c.volleyT <= 0) { c.volleyT = gunGap(gunOf(c)) * (c.wing ? WING().gap : 1); if (c.side === "enemy") enemyFire(c); else allyFire(c); }
    }
    officerOrders();
    const jk = SFX.jink;
    if (SP.battle && !SP.battle.dying) {
      jk.next -= dt;
      const amp = 0.6 + 0.4 * spd;   // jinking: the fighter darts (x1.24), the battlecruiser lumbers (x0.88); the Galor is the old 1.0
      if (jk.next <= 0) { jk.next = rand(1.4, 2.6) / spd; jk.tx = rand(-0.03, 0.03) * amp; jk.ty = rand(-0.05, 0.05) * amp; }
      const f = Math.min(1, dt * 2.2); jk.x += (jk.tx - jk.x) * f; jk.y += (jk.ty - jk.y) * f;
    }
  }
  if (SFX.shakeT > 0) SFX.shakeT -= dt;
  for (const a of Object.values(SFX.anim)) a.t += dt;
  if (SFX.shieldFlare) { SFX.shieldFlare.t += dt; if (SFX.shieldFlare.t >= SFX.shieldFlare.dur) SFX.shieldFlare = null; }
  // smoke when damaged
  const S = G.ship, Bn = SP.battle, En = foe(Bn);
  if (S.hull < 35 && Math.random() < dt * 7) { const p = tenPoint(rand(0.25, 0.45), rand(0.4, 0.6)); SFX.smoke.push({ x: p[0], y: p[1], vx: rand(-0.03, -0.012), vy: rand(-0.02, -0.006), t: 0, life: rand(0.9, 1.7), r: rand(0.012, 0.024), kind: "smoke" }); }
  if (Bn && En) for (const c of [...Bn.enemies, ...Bn.allies]) { if (c.ref === "ship" || (c.dead && !(c.dying > 0))) continue; const hot = c.dead;   // every crippled or dying ship burns
    if ((hot || c.hull < c.max * 0.35) && Math.random() < dt * (hot ? 16 : 8)) { const p = ptOf(c, rand(0.3, 0.65), rand(0.35, 0.65)); SFX.smoke.push({ x: p[0], y: p[1], vx: rand(-0.01, 0.01), vy: rand(-0.03, -0.01), t: 0, life: rand(0.3, 0.6), r: rand(0.01, 0.018), kind: "flame" }); } }
  for (let i = SFX.smoke.length - 1; i >= 0; i--) { const s = SFX.smoke[i]; s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; if (s.t > s.life) SFX.smoke.splice(i, 1); }
  if (SFX.smoke.length > 170) SFX.smoke.splice(0, SFX.smoke.length - 170);
  for (let i = SFX.shots.length - 1; i >= 0; i--) {
    const sh = SFX.shots[i]; sh.t += dt;
    if (sh.t >= sh.dur) { SFX.shots.splice(i, 1); if (SP.battle) SP.battle.inflight = Math.max(0, (SP.battle.inflight || 0) - sh.dmg); SFX.booms.push({ x: sh.x1, y: sh.y1, t: 0, dur: 0.55 }); damageEnemy(sh.dmg, "Photon torpedo — direct hit", SP.battle ? SP.battle.enemies.find(e => e.id === sh.tid) : null); }
  }
  for (const k of ["beams", "booms", "floaters", "flares"]) {
    const arr = SFX[k];
    for (let i = arr.length - 1; i >= 0; i--) { arr[i].t += dt; if (arr[i].t >= (arr[i].dur || 1.2)) arr.splice(i, 1); }
  }
  if (!SP.battle) SFX.shots.length = 0;
}
export const debugKillEnemy = () => { for (let i = 0; i < 30 && G.sp.battle && !G.sp.battle.dying; i++) damageEnemy(1e6, "Debug kill"); };   // tools/boom-shots.js (kills every enemy)
export const debugKillOne = (id, side = "enemy") => { const B = G.sp.battle; if (!B) return; const c = (side === "enemy" ? B.enemies : B.allies).find(x => x.id === id); if (!c) return; for (let i = 0; i < 30 && !c.dead; i++) side === "enemy" ? damageEnemy(1e6, "Debug kill", c) : damageAlly(c, 1e6, "Debug kill"); };   // tools/multiship-shots.js
