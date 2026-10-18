// Battles: the officers fight the ship; the deck decides what they can do.
import { G } from "./state.js";
import { DESTS, SYSTEMS } from "./data.js";
import { clamp, rand } from "./util.js";
import { log, toast, shipNews, redAlertCard } from "./bus.js";
import { chooseEncounter, noteEncounter } from "./encounters.js";
import { spawnFault, impairing, shieldCap, medFrozen, medDepends } from "./faults.js";
import { playerInEngineering, cancelRepairIf } from "./crew.js";
import { PACE, PACE_RT, nightActive } from "./pacing.js";
import { hooks } from "./progression.js";
import { SHIPS, makeAlly, makeEnemy, foe, shipOf, gunOf, hullPct } from "./ships.js";

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
const jemHp = (E, k) => { const h = shipOf(E).hp[k] || [0.5, 0.5]; return jemPoint(1 - h[0], h[1]); };
const the = d => "the " + d.name;

// opening lines: {A} = "A Jem'Hadar fighter" etc., {a} lower-case, {short} = fighter / Galor / battlecruiser
const OPEN = { convoy: "{A} breaks from the convoy's shadow — weapons free! Red alert!",
  nebula: "Ambush — {a} decloaks out of the nebula cloud, weapons hot!",
  hulk: "Ambush from the hulk's shadow — {a} was holding station in the wreck's blind spot. Red alert!",
  defector: "Trap sprung — {a} drops out of warp. T'Ren: 'Eighteen percent, Lieutenant. We drew it.' Red alert!",
  shadow: "The shadow commits — the tailing {short} turns in and opens fire. Red alert!",
  debug: "Simulation drill — {a} engaging. Red alert!" };
const openLine = (kind, d) => (OPEN[kind] || "Long-range sensors scream — {a} on an attack vector, dropping us out of warp. Red alert!")
  .replace("{A}", d.a.charAt(0).toUpperCase() + d.a.slice(1)).replace("{a}", d.a).replace("{short}", d.short);
// Battles are rare set pieces: none in a session's first 10 minutes, a long gap between fights, and a hard
// per-hour cap while the player is away (offline catch-up or idle). See PACE in pacing.js.
export function battleAllowed(kind) {
  if (kind === "debug") return true;
  const SP = G.sp, now = G.ship.elapsed, last = typeof SP.lastBattleT === "number" ? SP.lastBattleT : -1e9;
  if (!PACE_RT.offline && PACE_RT.sessionT < PACE.sessionCalm) return false;
  if (nightActive()) {
    const recent = (G.night.battleTimes || []).filter(t => now - t < 3600 && now >= t);
    if (recent.length >= PACE.idleBattlesPerHour || now - last < PACE.idleBattleGap) return false;
  } else if (now - last < PACE.battleGap) return false;
  return true;
}
// opts.enemy: force an enemy type (tests, debug); otherwise encounters.js (story context, then the gated weighted table)
export function startBattle(kind = "enroute", opts = {}) {
  const SP = G.sp;
  if (SP.battle) return false;
  if (!battleAllowed(kind)) {
    G.night.avoided = (G.night.avoided || 0) + 1;
    log("Hale: 'Jem'Hadar patrol on long-range sensors, Captain. They haven't seen us.' T'Ren alters course a few degrees. Nobody says anything until it's gone.", "comm");
    return false;
  }
  SP.lastBattleT = G.ship.elapsed;
  const bt = (G.night.battleTimes || []).filter(t => G.ship.elapsed - t < 3600 && G.ship.elapsed >= t); bt.push(G.ship.elapsed); G.night.battleTimes = bt;
  const pick = chooseEncounter(kind, { prog: G.prog, ship: G.ship, enc: SP.enc, forced: opts && opts.enemy }), enemy = pick.id, d = SHIPS[enemy];
  noteEncounter(SP, enemy, kind, G.prog.playDays, pick.held);
  SP.battle = { ctx: kind, enterT: 0, dying: 0, cd: { phaser: 0, torp: 0, evasive: 0, divert: 0 }, startedAt: G.ship.elapsed, allies: [makeAlly("tenacity", 0)], enemies: [makeEnemy(enemy, 0)], target: 0 };
  G.stats.battles++;
  SFX.jink = { x: 0, y: 0, tx: 0, ty: 0, next: 1.4 }; SFX.shieldFlare = null; SFX.anim = {}; SFX.smoke.length = 0; SFX.flares.length = 0;
  if (SP.preScanned) { SP.preScanned = false; const E = foe(SP.battle); E.hull = Math.round(E.max * 0.76); log("Diallo: 'The defector's shield frequencies are exact. She starts this fight pre-scanned.'", "comm"); }
  if (SP.travel) SP.travelPaused = true;
  G.ship.alertT = 7;
  if (enemy === "jh_battlecruiser") {   // pass 13: a short sensor warning first (log + toast), the red-alert card ~1.2 s later. A danger alert like
    // the card: never quiet-gated; offline catch-up drops the toast and card, the log keeps the line (and the return report headlines the fight)
    log("Hale: 'Long-range sensors — capital-class contact, Dominion signature, closing fast.'", "fault");
    toast("⚠ SENSORS — capital-class contact", "crit");
  }
  log(openLine(kind, d), "fault");
  if (enemy === "jh_battlecruiser") {   // encounter weighting: the capital ship is an EVENT - a red-alert card, not just a toast.
    // Not quiet-gated: the pass 09 gate (bus.js cheerful) holds back light / cheerful lines only, and this is a danger
    // alert (a death-hush must never hide a battle warning). Offline catch-up (bus quiet) skips it like every toast.
    redAlertCard({ delay: 1200, title: d.name.toUpperCase(), cls: d.cls, kicker: "RED ALERT · CAPITAL SHIP",
      // pass 13: the copy matches the real danger (gated start: she wins ~1 fight in 8, and a won fight still costs ~20% hull)
      lines: ["She outguns us, and her polarons bleed through shields: expect hull damage, maybe casualties.", "No outrunning her. Keep shields and weapons up, tubes loaded, the deck patched."] });
    log("Diallo: 'Captain — that's a battlecruiser. She outguns us, and those polarons go straight through shields. All hands, brace.'", "fault");
  } else toast("RED ALERT — " + d.name, "crit");
  shipNews("<b>Red alert.</b> The bridge officers have the fight; your post is the <b>deck</b>: keep her systems alive and her tubes loaded.");
  return true;
}
function damageEnemy(dmg, label) {
  const B = G.sp.battle, E = foe(B);
  if (!B || B.dying || !E) return;
  const d = shipOf(E);
  if (d.evade && Math.random() < d.evade) {   // a fast ship jinks clear (no roll at all for ships without evade: the baseline's dice are untouched)
    const jp = jemPoint(0.45, 0.2); SFX.floaters.push({ x: jp[0], y: jp[1], t: 0, text: "MISS", color: "#cfd8e6" }); SFX.jink.next = 0;
    log(`${label} — the ${d.short} jinks clear. Miss.`); return;
  }
  if (G.ab.scan.active > 0) { dmg = Math.round(dmg * 1.5); label += " (weak-point scan: +50%)"; }
  E.hull = Math.max(0, E.hull - dmg);   // pass-03 N-3: never negative
  if (G.sp.battle) setAnim(E.id, "shieldsHit");
  SFX.jink.next = Math.min(SFX.jink.next, 0.4);
  const jp = jemPoint(0.45, 0.2);
  SFX.floaters.push({ x: jp[0], y: jp[1], t: 0, text: "−" + dmg, color: "#ffb3ab" });
  log(`${label} — ${d.name} hull at ${hullPct(E)}%.`);
  if (E.hull <= 0) {
    B.dying = 1.3; setAnim(E.id, "explode");
    const p = jemHp(E, "boom");
    SFX.booms.push({ x: p[0], y: p[1], t: 0, dur: 1.3, big: true });
    log(d.death || `The ${d.name} breaks apart — secondary explosions walking her spine. She's gone.`, "good");
  }
}
function endBattleVictory() {
  const SP = G.sp, S = G.ship, kind = SP.battle ? SP.battle.ctx : null, d = shipOf(foe(SP.battle));
  SP.battle = null; SP.evasiveT = 0; G.stats.wins++;
  const salvage = Math.max(0, Math.min(d.salvage ?? 3, S.partsCap - S.parts)); S.parts += salvage;
  log(`Victory. Tractor crews pull ${salvage} usable part(s) from the wreckage.`, "good");
  toast(`Victory — ${d.short} destroyed`, "good");
  if (d.rep) { SP.rep += d.rep; log(`Starfleet Command notes the kill: ${d.a.replace(/^a /, "a ")} doesn't go down every day. Reputation +${d.rep}.`, "comm"); }
  if (kind === "convoy") { SP.rep++; SP.escortDone = true; log("The convoy is safe — every freighter accounted for. Reputation rising.", "comm"); }
  if (SP.travel && SP.travelPaused) { SP.travelPaused = false; log(`Course resumed — back to warp for ${DESTS[SP.travel.dest].name}.`, "comm"); }
  else { SP.cap.decideT = 30; SP.cap.dest = null; SP.cap.reason = `Action resolved at ${SP.location ? DESTS[SP.location].name : "deep space"} — the Captain is evaluating her next orders.`; }
  shipNews("Battle won. Check the <b>deck</b> for damage the fight left behind.");
}
export function damageShip(dmg, label, pierce = 0) {
  const S = G.ship, SP = G.sp;
  if (G.ab.pattern.active > 0) { dmg *= 0.5; label += " (attack pattern analysis: halved)"; }
  if (SP.evasiveT > 0) { dmg *= 0.35; label += " (evasive pattern sheds most of it)"; }
  S.alertT = 7;
  const tp = tenHp("hit");
  if (S.shields >= dmg) {
    // pass 13: a piercing weapon (the battlecruiser's polarons: weapon.pierce) bleeds part of an absorbed hit through to the hull.
    // Hull only - no fault / injury roll (those stay with real shield breaches). Weapons without pierce (fighter, Galor) are untouched.
    const bleed = pierce > 0 ? Math.min(S.hull - (nightActive() ? PACE.offlineHullFloor : 0), dmg * pierce) : 0;
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
  S.shields = 0; S.hull = Math.max(nightActive() ? PACE.offlineHullFloor : 0, S.hull - through);   // offline / idle tab (N-2): damage control holds the line
  SFX.floaters.push({ x: tp[0], y: tp[1] - 0.05, t: 0, text: "HULL −" + Math.round(through), color: "#ff8a7a" });
  log(`${label} — shields down, the hull takes ${Math.round(through)}%. Hull at ${Math.round(S.hull)}%.`, "fault");
  if (S.hull <= 0) { towToDS9(); return; }
  let id = null;
  if (Math.random() < 0.5) {
    id = spawnFault("battle");
    if (id) log("Damage control: the hit started a fault aboard — it's on the DECK, and the Lieutenant can reach it mid-battle.", "fault");
  }
  const gun = gunOf(foe(G.sp.battle));
  hooks.shipHit.forEach(f => f({ sys: id, hit: gun ? gun.hits : null }));   // phase 6: a hull hit can injure someone (js/injuries.js)
}
function enemyFire() {
  const B = G.sp.battle, SP = G.sp, E = foe(B), gun = gunOf(E);
  if (!B || B.dying || !gun) return;
  if (E.lastVolleyAt !== undefined) E.volleyGap = G.ship.elapsed - E.lastVolleyAt;
  E.lastVolleyAt = G.ship.elapsed;
  const from = jemHp(E, "fire"), ev = SP.evasiveT > 0;
  const miss = tenHp("miss"), to = ev ? [miss[0] - 0.05, miss[1] - 0.06] : tenPoint(0.72, 0.52);
  SFX.beams.push({ x0: from[0], y0: from[1], x1: to[0], y1: to[1], t: 0, dur: 0.4, col: gun.col });
  SFX.evasiveGraze = ev; setAnim(E.id, "firing");
  damageShip(rand(gun.dmg[0], gun.dmg[1]), `${gun.name} from ${the(shipOf(E))}`, gun.pierce || 0);
  SFX.evasiveGraze = false;
  SFX.jink.next = Math.min(SFX.jink.next, 0.25);
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
  const from = tenHp("torp"), to = jemPoint(rand(0.3, 0.6), rand(0.35, 0.65));
  const dmg = Math.round(rand(TORP.dmg[0], TORP.dmg[1])), B = G.sp.battle;
  SFX.shots.push({ x0: from[0], y0: from[1], x1: to[0], y1: to[1], t: -delay, dur: 0.5, dmg });
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
function trenDisengage() {
  const SP = G.sp, B = SP.battle;
  if (!B || B.dying || impairing("warpcore")) return;
  const enroute = !!(SP.travel && SP.travelPaused), kind = B.ctx;
  SP.battle = null; SP.evasiveT = 0; SP.cap.decideT = 30;
  if (enroute) { SP.travel = null; SP.travelPaused = false; SP.location = null; }
  if (kind === "convoy") SP.escortDone = true;
  log("T'Ren: 'Helm — emergency warp, disengage.' The Tenacity breaks off and runs.", "comm");
  toast("Disengaged", "warn");
  if (Math.random() < 0.55) { const d = shipOf(foe(B)); log(`A parting volley from ${the(d)} chases her out—`, "fault"); damageShip(rand(d.parting[0], d.parting[1]), "Parting volley"); }
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
    if (impairing("warpcore")) { if (!B.deniedLogged) { B.deniedLogged = true; BR.tren = "Disengage denied — warp core fault"; log("T'Ren: 'Disengage denied — warp core fault. We hold, Lieutenant. Keep her alive.'", "fault"); } }
    else trenDisengage();
  }
}
export function towToDS9() {
  const SP = G.sp, S = G.ship;
  SP.battle = null; SP.travel = null; SP.travelPaused = false; SP.evasiveT = 0; SP.visit = null; G.stats.tows++;
  SP.location = "ds9"; SP.escortDone = true;
  Object.assign(SP.cap, { decideT: PACE.dockDwell[0], dest: "convoy", holdLogged: false, reason: "Towed home to Deep Space Nine — holding for repairs. Departure pending my hull minimum of 40%." });
  S.hull = 20; S.shields = 0; S.power = Math.min(S.power, 30);
  log("The Tenacity goes dark — main power gone, drifting, guns silent. Disabled.", "fault");
  for (let i = 0; i < 3; i++) spawnFault("battle");
  log("A runabout out of Deep Space Nine takes her under tow. She'll fly again — Mirandas always do.", "comm");
  toast("Disabled — towed to Deep Space Nine", "crit");
  shipNews("<b>Disabled and towed to Deep Space Nine.</b> Hull at 20%, systems faulted — the Lieutenant has work to do.");
}
// ---- officer abilities (autonomous) ----
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
  if (armed(ab.pattern) && E.volleyT <= 1.5) usePattern();
  if (armed(ab.scan)) useScan();
  if (armed(ab.spread) && ((S.torps >= 2 && E.hull > E.max * 0.5) || S.torps >= 3)) useSpread();
  if (armed(ab.miracle) && (Object.keys(S.faults).length > 0 || S.hull < 60)) useMiracle();
}
function tickAbilities(dt) {
  const ab = G.ab;
  for (const a of Object.values(ab)) if (a.cd > 0) a.cd = Math.max(0, a.cd - dt);
  if (ab.pattern.active > 0) { ab.pattern.active -= dt; if (ab.pattern.active <= 0) { ab.pattern.active = 0; if (G.sp.battle) log("Attack Pattern Analysis expired — T'Ren is already recalculating.", "comm"); } }
  if (ab.scan.active > 0) { ab.scan.active -= dt; if (ab.scan.active <= 0) { ab.scan.active = 0; if (G.sp.battle) log("Weak-Point Scan expired — targeting back to standard.", "comm"); } }
}
export function tickBattle(dt) {
  tickAbilities(dt);
  autoFire();
  const SP = G.sp, B = SP.battle, E = foe(B), spd = E ? shipOf(E).speed : 1;
  if (B && !E) { SP.battle = null; SP.evasiveT = 0; }   // defensive: a battle with no enemy left just ends (hardenBattle drops these at load)
  else if (B) {
    B.enterT = Math.min(1, B.enterT + dt / 1.4 * Math.max(0.6, spd));   // a fast ship arrives faster
    for (const k of Object.keys(B.cd)) if (B.cd[k] > 0) B.cd[k] = Math.max(0, B.cd[k] - dt);
    if (SP.evasiveT > 0) SP.evasiveT = Math.max(0, SP.evasiveT - dt);
    if (B.dying) {
      B.dying -= dt;
      if (Math.random() < dt * 10) { const p = jemPoint(rand(0.15, 0.8), rand(0.2, 0.8)); SFX.booms.push({ x: p[0], y: p[1], t: 0, dur: 0.5 }); }
      if (B.dying <= 0) endBattleVictory();
    } else {
      E.volleyT -= dt;
      if (E.volleyT <= 0) { const g = gunOf(E); E.volleyT = g ? rand(g.every[0], g.every[1]) : 99; enemyFire(); }
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
  if (Bn && En && (En.hull < En.max * 0.35 || Bn.dying) && Math.random() < dt * (Bn.dying ? 16 : 8)) { const p = jemPoint(rand(0.3, 0.65), rand(0.35, 0.65)); SFX.smoke.push({ x: p[0], y: p[1], vx: rand(-0.01, 0.01), vy: rand(-0.03, -0.01), t: 0, life: rand(0.3, 0.6), r: rand(0.01, 0.018), kind: "flame" }); }
  for (let i = SFX.smoke.length - 1; i >= 0; i--) { const s = SFX.smoke[i]; s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; if (s.t > s.life) SFX.smoke.splice(i, 1); }
  if (SFX.smoke.length > 170) SFX.smoke.splice(0, SFX.smoke.length - 170);
  for (let i = SFX.shots.length - 1; i >= 0; i--) {
    const sh = SFX.shots[i]; sh.t += dt;
    if (sh.t >= sh.dur) { SFX.shots.splice(i, 1); if (SP.battle) SP.battle.inflight = Math.max(0, (SP.battle.inflight || 0) - sh.dmg); SFX.booms.push({ x: sh.x1, y: sh.y1, t: 0, dur: 0.55 }); damageEnemy(sh.dmg, "Photon torpedo — direct hit"); }
  }
  for (const k of ["beams", "booms", "floaters", "flares"]) {
    const arr = SFX[k];
    for (let i = arr.length - 1; i >= 0; i--) { arr[i].t += dt; if (arr[i].t >= (arr[i].dur || 1.2)) arr.splice(i, 1); }
  }
  if (!SP.battle) SFX.shots.length = 0;
}
