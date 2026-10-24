// Random voyage events between legs; about half hand the Lt a timed deck task.
import { G } from "./state.js";
import { awardXP, taskMult, PROG, milestone, taskDone, hooks } from "./progression.js";
import { NODEMAP, DESTS, DECKS, HEAD_Y } from "./data.js";
import { clamp, rand, dDist } from "./util.js";
import { log, toast, shipNews, fx, cheerful, cheer } from "./bus.js";
import { spawnFault } from "./faults.js";
import { ZONE } from "./crew.js";
import { startBattle as _sb, battleAllowed } from "./battle.js";
import { PACE, PACE_RT, rr, travelS, STORY } from "./pacing.js";
import { legStory, tickStoryDock, storyLeg, storyTick } from "./story.js";   // E1 story events (story.js never imports events.js)

// pass 09 (4): light events skipped in the quiet period after a death (bus.js cheerful gate)
const LIGHT_EVENTS = ["crewmoment", "ferengi"];
export const EV_POOL = [
  { id: "distress", w: 14, name: "Distress call" }, { id: "refugee", w: 12, name: "Refugee convoy" }, { id: "defector", w: 12, name: "Cardassian defector" },
  { id: "anomaly", w: 13, name: "Sensor anomaly" }, { id: "storm", w: 12, name: "Ion storm" }, { id: "ferengi", w: 11, name: "Ferengi trader" },
  { id: "shadow", w: 10, name: "Jem'Hadar shadow" }, { id: "warnews", w: 8, name: "War news" }, { id: "crewmoment", w: 8, name: "Mess birthday / mail call" },
];
export function evResetLeg(dest) {
  const ev = G.sp.ev;
  const dur = G.sp.travel ? G.sp.travel.dur : 600;
  ev.legTarget = Math.round(rr(PACE.eventsPerLeg)); ev.legFired = 0; ev.nextT = dur * rr(PACE.eventAt);
  storyLeg();   // E1: legs since the last story event
}
// E1: a story event can take this voyage event slot (PACE / STORY.legChance, gated in story.js); it uses the slot like any event
function storySlot() {
  if (!legStory()) return false;
  G.sp.ev.legFired++; G.stats.events++; evScheduleNext(); return true;
}
function pickEvent() {
  const ev = G.sp.ev, pool = EV_POOL.filter(e => e.id !== ev.lastId && !(LIGHT_EVENTS.includes(e.id) && !cheerful()));   // pass 08 (5): no birthday / mail call in the quiet period after a death
  const wOf = e => e.w * (STORY.textWeight[e.id] ?? 1);   // P34: halved where a story version exists
  let r = Math.random() * pool.reduce((a, e) => a + wOf(e), 0);
  for (const e of pool) { r -= wOf(e); if (r <= 0) return e.id; }
  return cheerful() ? "crewmoment" : "warnews";
}
function evTask(nodeId, need, dur, label) {
  const n = NODEMAP[nodeId]; dur = travelS(dur);   // pass 18: the window includes the walk there (x TRAVEL_SCALE); need = console s, unscaled
  return { x: n.x, y: n.y, deck: n.deck, node: nodeId, need, acc: 0, t: dur, dur, label, done: false, warned: false };
}
function evBegin(id, task) {
  const ev = G.sp.ev;
  ev.lastId = id; ev.legFired++; G.stats.events++;
  if (task) {
    ev.active = { id, task, trap: false };
    toast(`Captain's deck task: ${task.label} (${task.dur}s)`, "task");
    shipNews(`<b>Ship's business — optional deck task.</b> ${task.label}. Bonus if he makes it in time; no harm if he doesn't.`);
  }
}
function evScheduleNext() {
  const SP = G.sp;
  SP.ev.nextT = SP.travel && !SP.travelPaused && SP.ev.legFired < SP.ev.legTarget ? Math.max(20, SP.travel.dur * rr(PACE.eventAt)) : -1;
}
export function fireEvent(id) {
  const SP = G.sp;
  if (SP.ev.active || SP.battle || SP.alert) return false;
  const S = G.ship;
  switch (id) {
    case "distress":
      evBegin(id, evTask("locker", 2, 30, "Fabricate a regulator at the Parts Locker — ENGINEERING"));
      log("Bridge: Distress call — the freighter Kestrel Wind, life support failing. T'Ren alters course to intercept without being asked twice.", "comm");
      log("T'Ren: 'We render aid, Lieutenant. It is not a policy — it is the point. A fabricated regulator would spare our own stores.'", "comm");
      break;
    case "refugee":
      evBegin(id, null);
      log("Diallo: Captain — a refugee convoy out of the Bajoran colonies requests escort and supplies. Six hundred colonists.", "comm");
      S.power = clamp(S.power - 12, 0, 100); SP.rep += 2;
      log("Diallo coordinates the hand-off: replicator stock, medical supplies, shields spread over the convoy. Power −12. " + cheer("The colonists' elder names a newborn for the ship: reputation +2.", "Reputation +2."), "good");
      evScheduleNext(); break;
    case "defector":
      evBegin(id, evTask("pads", 2.5, 30, "Prep the Transporter Pads for the defector's beam-in — ENGINEERING"));
      SP.ev.active.trap = Math.random() < 0.18;
      log("Bridge: A Cardassian galor hails — Gul Revan, requesting asylum, claiming intelligence on Dominion fleet dispositions.", "comm");
      log("T'Ren: 'Probability the intelligence is genuine: 82%. Probability this is a trap: 18%. The Federation does not refuse a defector over eighteen percent. Prep the transporter — carefully.'", "comm");
      break;
    case "anomaly":
      evBegin(id, evTask("msd", 4, 26, "Stand sensor support at the Master Systems Display — BRIDGE"));
      log("Diallo: 'Captain — subspace phenomenon bearing 041, something I have genuinely never seen. Requesting a full sensor sweep while it holds.'", "comm");
      break;
    case "storm":
      evBegin(id, evTask("core", 6, 26, "Hold the Warp Core Console through the shear — ENGINEERING"));
      log("Diallo: 'Ion shear building dead ahead, Captain.' T'Ren: 'All hands, brace. Okafor — your deck, your storm.'", "comm");
      break;
    case "ferengi": {
      if (!cheerful()) { evScheduleNext(); break; }   // pass 09 (4): a comic event: not in the quiet period
      evBegin(id, null);
      log("Bridge: A Ferengi marauder hails — DaiMon Pesk. His opening offer for two spare parts is 'one Miranda-class starship, slightly used.'", "comm");   // cheer-gated: the ferengi case opens with cheerful()
      if (Math.random() < 0.5) { const got = Math.min(2, S.partsCap - S.parts); S.parts += got; log(`T'Ren negotiates for eleven minutes in perfect Ferengi, quoting Rule of Acquisition 190 back at him${got > 0 ? `: +${got} spare parts` : " (the locker is already full)"}.`, "good"); }
      else log("T'Ren declines the final offer with arctic courtesy. Pesk: 'Call me when you're desperate, Captain. Everyone does.'", "comm");
      evScheduleNext(); break;
    }
    case "shadow":
      evBegin(id, null);
      S.alertT = Math.max(S.alertT, 5);
      log("Hale: 'Contact — Jem'Hadar fighter, extreme range, matching course and speed. She's not closing. She's just… watching.'", "comm");
      if (Math.random() < 0.12 && battleAllowed("shadow")) { log("T'Ren: 'Twelve percent, Mr. Hale. Watch it come due.'", "fault"); evScheduleNext(); _sb("shadow"); return true; }
      log("T'Ren: 'Probability she commits: 12%. Hold course, shields warm, no provocation.' The shadow peels off. Nobody aboard breathes normally for an hour.", "comm");
      evScheduleNext(); break;
    case "warnews":
      evBegin(id, null);
      if (Math.random() < 0.5) { SP.rep += 1; log("Subspace dispatch: the Seventh Fleet has retaken the Tyra system. Reputation +1.", "comm"); }
      else { SP.rep = Math.max(0, SP.rep - 1); log("Subspace dispatch: a task group has fallen back from the Kalandra sector, losses 'regretted.' Reputation −1.", "comm"); }
      evScheduleNext(); break;
    default:
      if (!cheerful()) { evScheduleNext(); break; }   // pass 08 (5): never cheerful during the hush
      evBegin("crewmoment", null);
      log(Math.random() < 0.5 ? "The mess hall, off-watch: Ensign Park's birthday — replicated cake and an off-key rendition led by Hale. The Lieutenant is dragged in for one verse. It helps more than it should."
        : "Mail call: a letter from home catches up by courier buoy — three weeks old, read in one sitting. It helps more than it should.", "comm");
      S.energy = clamp(S.energy + 10, 0, 100);
      evScheduleNext();
  }
  return true;
}
export function tickEvents(dt) {
  const SP = G.sp, ev = SP.ev, act = ev.active, L = G.lt;
  storyTick();   // E3: one 'the moment passed' line for a story step dropped at load
  if (act) {
    // NEW-06: offline nobody can answer a deck task, so the bridge handles it at once (same outcome as letting it
    // expire, without the countdown warning or the "window closed" line cluttering the shift report)
    if (act.task && PACE_RT.offline) { resolveEvent(false); return; }
    if (act.task && !SP.battle) {
      const tk = act.task;
      tk.t -= dt;
      if (!tk.warned && tk.t <= 10 && tk.acc < tk.need && !PACE_RT.offline) {   // no "10 seconds left" noise offline
        tk.warned = true;
        log(`Deck task — 10 seconds left: ${tk.label}.`, "fault");
        toast(`10s left: ${DECKS[tk.deck].name} — ${NODEMAP[tk.node].name}`, "warn");
      }
      if (L.deck === tk.deck && !L.lift && dGood(L, tk)) {
        tk.acc += dt * taskMult();
        if (tk.acc >= tk.need) {
          tk.done = true;
          const man = !!L.useManual, xp = awardXP(PROG.xp.task * (man ? PROG.manual.xp : PROG.auto.xp), man ? "manual" : "auto", "task");
          milestone("firstTask", "First deck task");
          taskDone(tk.node, tk.deck);   // phase 2: opinion of the area's crew + readiness service
          toast(`Deck task complete — bonus earned · +${xp} XP`, "good");
          fx("floater", { x: L.x, y: L.y - HEAD_Y, text: `+${xp} XP`, color: "#8fd8ff", delay: 0.8, life: 2.2 });
          resolveEvent(true); return;
        }
      }
      if (tk.t <= 0) {
        log(`Deck task window closed — ${tk.label.split(" — ")[0]}. The bridge handles it without the bonus.`, "comm");
        toast("Deck task expired — no bonus", "warn");
        resolveEvent(false);
      }
    }
    return;
  }
  if (!SP.travel && !SP.battle) { tickStoryDock(dt); return; }   // E1: docked at DS9, a modest chance of a story event (story.js gates)
  if (!SP.travel || SP.travelPaused || SP.battle) return;
  if (ev.legFired >= ev.legTarget || ev.nextT < 0) return;
  ev.nextT -= dt;
  if (ev.nextT <= 0 && SP.travel.t < SP.travel.dur - 20 && !storySlot()) fireEvent(pickEvent());
}
const dGood = (L, tk) => L.mode === "use" && L.node === tk.node && dDist(L.x, L.y, tk.x, tk.y) <= ZONE;   // must man it, not walk past
export function resolveEvent(bonus) {   // exported for tools (pt07 hush checks)
  const SP = G.sp, act = SP.ev.active, S = G.ship;
  if (!act) return;
  SP.ev.active = null;
  const rep0 = SP.rep;
  resolveEffects(act, bonus, SP, S);
  // visible reward: the bonus reputation floats up over the Lieutenant at the task console
  if (bonus && SP.rep > rep0) fx("floater", { x: G.lt.x, y: G.lt.y - HEAD_Y, text: `+${SP.rep - rep0} REP`, color: "#ffaa77", delay: 0.2, life: 2.2 });
}
function resolveEffects(act, bonus, SP, S) {
  if (act.id === "distress") {
    if (bonus) { SP.rep += 3; log("The Lieutenant's regulator goes over by transporter — the Kestrel Wind's life support steadies. Reputation +3, not one spare part spent. The log credits the Lieutenant by name.", "good"); }
    else if (S.parts >= 2) { S.parts -= 2; SP.rep += 3; log("The Tenacity's own spares patch the freighter's life support — 2 parts out of the locker. Reputation +3.", "good"); }
    else { S.power = clamp(S.power - 20, 0, 100); SP.rep += 1; log("No spares to give — the rescue runs slow and hungry instead. Power −20. Reputation +1.", "comm"); }
  } else if (act.id === "defector") {
    if (act.trap && battleAllowed("defector")) { log("The galor's transporter signal was a targeting lock wearing a costume — the 'defector' was bait.", "fault"); _sb("defector"); return; }
    if (act.trap) { log("Diallo catches it at the last second: the galor's transporter signal is a targeting lock wearing a costume. T'Ren drops the beam-in and the 'defector' runs before Hale can return the favour.", "comm"); evScheduleNext(); return; }
    SP.rep += bonus ? 3 : 2; SP.preScanned = true;
    log(`Gul Revan beams aboard${bonus ? " onto a pad the Lieutenant had prepped and swept" : ""}; his intelligence checks out. ${cheer("Asylum granted: reputation", "Reputation")} +${bonus ? 3 : 2}. The next fighter we meet starts pre-scanned.`, "good");
  } else if (act.id === "anomaly") {
    if (bonus) { SP.rep += 3; log("The sweep closes with the Lieutenant at the Master Systems Display — the data set is beautiful and complete. Reputation +3.", "good"); }
    else { SP.rep += 1; log("Diallo archives the anomaly with half the readings she'd have liked. Reputation +1.", "comm"); }
  } else if (act.id === "storm") {
    if (bonus) { S.shields = clamp(S.shields - 15, 0, 100); log("The Tenacity rides the shear with the Lieutenant's hands on the core — shields −15 only." + cheer(" Okafor: 'My Lieutenant weathered that. Personally.'", ""), "good"); const id = spawnFault("hazard"); hooks.hazard.forEach(f => f({ kind: "storm", sys: id, bonus: true })); }
    else { S.shields = clamp(S.shields - 35, 0, 100); log("The shear hits like a fist — shields −35, and the deck reports fresh damage.", "fault"); const id = spawnFault("hazard"); if (Math.random() < 0.5) spawnFault("hazard"); hooks.hazard.forEach(f => f({ kind: "storm", sys: id, bonus: false })); }
  }
  evScheduleNext();
}
