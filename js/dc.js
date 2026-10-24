// RA(b): damage-control calls (notes/2026-10-24-red-alert-plan.md section 3). One call per live battle at the first hull / shield
// threshold, an optional second on a long fight (hull < PACE.alert.dc.second). The fight holds while the call card is open; after
// PACE.alert.dc.pause s the safe choice (T'Ren's call) is taken. The Lt makes every roll through the story machinery (oddsP, the
// 0.6p odds word, the odds line, tier text, a named-crew risk, gentle wording). A choice moves the margin, never the outcome class:
// enemy stats are untouched, the Tenacity is never destroyed (hull 0 is still towToDS9), injuries are minor (shaken in gentle mode).
// State: G.sp.battle.dc (ships.js hardenDC), saved with the battle; a reload reopens the SAME call (cast fixed at open).
import { G, saveSoon } from "./state.js";
import { PACE, isPresent } from "./pacing.js";
import * as ST from "./story.js";
import { opinionOf, awardXP } from "./progression.js";
import { skillLvl, addSkillXp, moodlet, SKILL_LABEL } from "./mood.js";
import { spawnFault, shieldCap } from "./faults.js";
import { injure, gentle } from "./injuries.js";
import { log, toast } from "./bus.js";
import { SHIPS } from "./ships.js";
const K = () => PACE.alert.dc, B = () => (G.sp ? G.sp.battle : null), TORP = () => SHIPS.tenacity.weapons.find(w => w.id === "torpedo");
export const dcUI = { show: null, hide: null, viewing: () => false, blocked: () => false };   // set by js/ui/dccall.js
// what each choice is: skill (the Lt's roll), help (whose opinion of the Lt counts), crew (who is at risk / named)
export const DC = {
  eps: { label: "Reroute EPS to shields", skill: "engineering", act: "rerouting the EPS taps under fire", art: "story_dc_eps",
    risk: "{Lead} is on the junction with you: a bad surge burns {obj}.", grisk: "A bad surge rattles {lead}; no harm done.",
    success: "Power slams across from the impulse taps and the shield grid flares back up. It will hold a faster charge for the rest of the fight.",
    partial: "You get some of it across before the coupling trips: a little more shield, no faster charge.",
    fail: "The junction arcs as you close it and the surge blows back down the conduit.", gfail: "The junction arcs as you close it and the coupling trips; nothing gained.",
    injured: "{Lead} takes a burn across one hand: minor, and {sub} stay{s} at the post.", unhurt: "{Lead} is shaken but unhurt." },
  loader: { label: "Clear the jammed loader", skill: "fitness", help: "loader", act: "clearing a jammed torpedo loader by hand", art: "story_dc_loader",
    risk: "A slip costs a volley and bruises {lead}.", grisk: "A slip costs you time and shakes {lead}; the tubes just wait.",
    success: "The jammed casing comes free under your shoulder and the rack cycles clean: tubes loaded, and one more torpedo up.",
    partial: "It frees, slowly: the tube is loaded, nothing more.",
    fail: "The casing kicks back and the rack locks again; Hale loses a volley while you vent it.", gfail: "The casing kicks back and the rack locks again; you clear it a minute later.",
    injured: "{Lead} has a bruised forearm from the kickback: minor.", unhurt: "{Lead} is shaken but unhurt." },
  core: { label: "Hold the core", skill: "composure", help: "core", act: "talking the core back from the redline", art: "story_dc_core",
    risk: "If it slips, the grid sheds load: main power dips.", grisk: "If it slips, {lead} catches it; nothing lost.",
    success: "You talk the core down from the redline with {lead} calling the readings. It holds: no core faults for the rest of the fight.",
    partial: "The core settles, mostly: no promise, but no dip either.",
    fail: "The core runs hot and the grid sheds load to save it: main power dips.", gfail: "The core runs hot; {lead} catches it before the grid sheds anything." },
  tren: { label: "T'Ren's call: hold steady", safe: true, text: "You hold your post and let T'Ren fight her ship. 'Acceptable, Lieutenant.'" },
};
export const NEUTRAL_ART = "story_dc_core";   // the call's first picture (the core room: the heart of the deck the Lt is on)
const occ = ST.kit.occ, nm = ST.kit.nm;
// who is at the junction / the rack / the core (fixed when the call opens; saved)
function castCall() {
  const pickOf = (slots, ex = []) => { const l = ST.kit.slotIds(slots).filter(id => !ex.includes(id)); if (l.length) return l[0]; const j = ST.kit.juniors(ex); return j.length ? j[0] : null; };
  const core = ST.kit.slotIds(["chief-engineer"])[0] || null, loader = ST.kit.slotIds(["security"])[0] || null;
  const eps = pickOf(["engineer-2", "engineer-1", "crewman", "transporter"], [core, loader].filter(Boolean));
  const c = {}; if (eps) c.eps = eps; if (loader) c.loader = loader; if (core) c.core = core; return c;
}
const tierFor = id => { const b = ST.relBands(id)[0][0]; return b === "solo" ? null : b; };
export function pOf(k, cast) {
  const ch = DC[k]; if (!ch || ch.safe) return null;
  const who = ch.help ? cast[k] : null, sk = skillLvl("lt", ch.skill);
  return who && occ(who) ? ST.oddsP(sk, opinionOf(who), tierFor(who)) : ST.oddsP(sk, 0, null);
}
// the card's choices, rolled first, the safe one last (like a story node)
export function choicesOf(o = B() && B().dc && B().dc.open) {
  if (!o) return []; const g = gentle();
  return Object.keys(DC).map(k => {
    const ch = DC[k];
    if (ch.safe) return { k, safe: true, label: ch.label, sub: "no roll · safe", risk: null, art: null };
    const who = o.cast[k], p = pOf(k, o.cast), w = ST.storyOdds(p), lvl = skillLvl("lt", ch.skill);
    const helper = ch.help && who && occ(who) ? `with ${nm(who)}` : null, cast = { lead: who || null };
    const r = g ? ch.grisk : ch.risk, risk = who || !/\{lead\}/i.test(r) ? ST.kit.fill(r, cast) : ST.kit.fill(r.replace(/\{Lead\}|\{lead\}/g, "a crewman").replace(/\{obj\}/g, "them"), cast);
    return { k, safe: false, label: ch.label, sub: [`${SKILL_LABEL[ch.skill]} ${lvl}`, helper, w.word, w.hint].filter(Boolean).join(" · "), risk, p, word: w.word, art: ch.art, lvl };
  });
}
export const dcPaused = () => { const b = B(); return !!(b && b.dc && b.dc.open && !b.dc.open.res); };
export const dcOpen = () => { const b = B(); return b && b.dc && b.dc.open; };
const DCX = b => (b.dc || (b.dc = { n: 0, due: null, open: null, buf: {} }));
const live = b => !!(b && b.live && !b.away);
// the threshold: which call is due now (1 / 2), or 0
export function dueNow(b = B()) {
  if (!live(b) || b.dying) return 0; const d = DCX(b), S = G.ship, k = K(), t = G.ship.elapsed - (b.startedAt || 0);
  if (d.open || d.due) return 0;
  if (d.n === 0 && t >= k.minT && (S.hull <= k.first || S.shields <= k.first)) return 1;
  if (d.n === 1 && t >= k.longFight && S.hull < k.second) return 2;
  return 0;
}
// show a due call: now if the Lt gave the word and is watching, else it waits for the Lt to open the battle view
export function showDue(force = false) {
  const b = B(); if (!live(b)) return false; const d = DCX(b);
  if (!d.due || d.open) return false;
  if (!force && !(b.by === "lt" && isPresent() && !dcUI.blocked())) return false;
  if (!isPresent()) return false;
  d.open = { i: d.due, t: 0, cast: castCall(), res: null }; d.due = null; d.n++;
  log(`Okafor: 'Lieutenant! ${d.open.i === 1 ? "She's taking a beating: your call. EPS, the loader or the core; I can't hold all three." : "Hull's under a third and the deck is burning. One more call, Lieutenant."}'`, "fault");
  if (dcUI.show) dcUI.show(); saveSoon("dc"); return true;
}
export function tickDC(dt) {
  const b = B(); if (!b || !b.dc && !live(b)) return; if (!live(b)) return;
  const d = DCX(b), k = K();
  const n = dueNow(b); if (n) { d.due = n; if (!(b.by === "lt") ) log(`Okafor: 'Damage control could use you, Lieutenant. Whenever you're on the bridge view.'`, "comm"); }
  if (d.due && !d.open) showDue(false);
  if (d.open) { d.open.t += dt; if (d.open.t >= k.pause) { if (!d.open.res) choose("tren", true); else closeCall(); } }
  if (d.buf.eps && !dcPaused()) G.ship.shields = Math.min(shieldCap(), G.ship.shields + k.epsRegen * dt);   // the rerouted grid: a faster charge for the rest of the fight
}
// roll and apply one choice (r: the roll, for tests). The outcome is applied and saved at once; a reload shows it or closes it.
export function choose(key, auto = false, r = Math.random()) {
  const b = B(), o = b && b.dc && b.dc.open; if (!o || o.res) return null;
  const ch = DC[key] || DC.tren, k = DC[key] ? key : "tren", S = G.ship, P = K(), chips = [], g = gentle();
  let band = "safe", text = ch.text || "";
  if (!ch.safe) {
    const p = pOf(k, o.cast), who = o.cast[k] || null, cast = { lead: who }, lvl = skillLvl("lt", ch.skill);
    band = ST.bandOf(p, r); const parts = [];
    const line = ST.ltLine({ skill: ch.skill, act: ch.act }, band, lvl, cast);
    if (band === "success") {
      if (k === "eps") { const b0 = S.shields; S.shields = Math.min(shieldCap(), S.shields + P.epsShields); b.dc.buf.eps = true; chips.push(["good", `+${Math.round(S.shields - b0)} shields`], ["good", "faster shield charge"]); }
      if (k === "loader") { b.cd.torp = 0; const t0 = S.torps; S.torps = Math.min(S.torpCap, S.torps + 1); S.tubeFlash = S.elapsed; chips.push(["good", "tubes reloaded"]); if (S.torps > t0) chips.push(["good", "+1 torpedo"]); }
      if (k === "core") { b.dc.buf.core = true; chips.push(["good", "no core faults this fight"]); }
      parts.push(ST.kit.fill(ch.success, cast), line);
    } else if (band === "partial") {
      if (k === "eps") { const b0 = S.shields; S.shields = Math.min(shieldCap(), S.shields + P.epsPartial); chips.push(["good", `+${Math.round(S.shields - b0)} shields`]); }
      if (k === "loader") { b.cd.torp = 0; chips.push(["good", "tube reloaded"]); }
      parts.push(line, ST.kit.fill(ch.partial, cast));
    } else {   // fail: the margin goes the other way; gentle mode caps it at a moodlet (no injury, fault, power or torpedo lost)
      parts.push(line, ST.kit.fill(g ? ch.gfail : ch.fail, cast));
      if (!g) {
        if (k === "eps" && !S.faults.eps) { const id = spawnFault("dc", "eps", "med"); if (id === "eps") chips.push(["bad", "MEDIUM fault · EPS"]); }
        if (k === "loader") { b.cd.torp = Math.max(b.cd.torp || 0, TORP().cd); if (S.torps > 0) { S.torps--; chips.push(["bad", "−1 torpedo (a lost volley)"]); } else chips.push(["bad", "a lost volley"]); }
        if (k === "core") { const p0 = S.power; S.power = Math.max(0, S.power - P.powerDip); if (S.power < p0) chips.push(["bad", `−${Math.round(p0 - S.power)} power`]); }
      }
      if ((k === "eps" || k === "loader") && who && occ(who)) {
        const inj = g ? null : injure("hazard", { id: who, sev: "minor", what: k === "eps" ? "an EPS burn" : "a kickback from the torpedo loader", src: "dc" });   // minor only; the injury caps apply
        if (inj) { chips.push(["bad", `${nm(who)} minor injury`]); parts.push(ST.kit.fill(ch.injured, cast)); }
        else { moodlet(who, "storyRough"); chips.push(["bad", `${nm(who)} shaken`]); parts.push(ST.kit.fill(ch.unhurt || "{Lead} is shaken but unhurt.", cast)); }
      }
    }
    const [xp, sxp] = P.xp[band] || [0, 0], x = xp ? awardXP(xp, "auto", "story") : 0;
    if (x) chips.push(["good", `+${x} XP`]); if (sxp) { addSkillXp("lt", ch.skill, sxp); chips.push(["good", `+${sxp} ${SKILL_LABEL[ch.skill]} XP`]); }
    text = parts.filter(Boolean).join(" ");
  }
  const word = { success: "Success.", partial: "Partly.", fail: "It goes wrong.", safe: auto ? "No call in time." : "" }[band];
  o.res = { k, band, auto: !!auto, word, text: auto ? "The deck waits too long for an answer, and T'Ren makes the call herself: hold steady." : text, chips };
  o.t = 0;
  log(`Damage control: ${ch.label}${band === "safe" ? "" : " — " + word}`, band === "fail" ? "fault" : "comm");
  if (dcUI.show) dcUI.show(); saveSoon("dc"); return o.res;
}
export function closeCall() { const b = B(), o = b && b.dc && b.dc.open; if (!o) return false; if (!o.res) choose("tren", true); b.dc.open = null; if (dcUI.hide) dcUI.hide(); saveSoon("dc"); return true; }
// the Lt opened the battle view during a live fight: a queued call shows now
export const onViewOpen = () => showDue(true);
