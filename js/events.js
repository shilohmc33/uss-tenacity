// Random voyage events between legs; about half hand the Lt a timed deck task.
import { G } from "./state.js";
import { NODEMAP, DESTS, DECKS } from "./data.js";
import { clamp, rand, dDist } from "./util.js";
import { log, toast, setStatus } from "./bus.js";
import { spawnFault } from "./faults.js";
import { startBattle } from "./battle.js";
import { ZONE } from "./crew.js";

export const EV_POOL = [
  { id: "distress", w: 14, name: "Distress call" }, { id: "refugee", w: 12, name: "Refugee convoy" }, { id: "defector", w: 12, name: "Cardassian defector" },
  { id: "anomaly", w: 13, name: "Sensor anomaly" }, { id: "storm", w: 12, name: "Ion storm" }, { id: "ferengi", w: 11, name: "Ferengi trader" },
  { id: "shadow", w: 10, name: "Jem'Hadar shadow" }, { id: "warnews", w: 8, name: "War news" }, { id: "crewmoment", w: 8, name: "Mess birthday / mail call" },
];
export function evResetLeg(dest) {
  const ev = G.sp.ev;
  ev.legTarget = Math.random() < 0.5 ? 1 : 2; ev.legFired = 0; ev.nextT = DESTS[dest].time * rand(0.22, 0.42);
}
function pickEvent() {
  const ev = G.sp.ev, pool = EV_POOL.filter(e => e.id !== ev.lastId);
  let r = Math.random() * pool.reduce((a, e) => a + e.w, 0);
  for (const e of pool) { r -= e.w; if (r <= 0) return e.id; }
  return "crewmoment";
}
function evTask(nodeId, need, dur, label) {
  const n = NODEMAP[nodeId];
  return { x: n.x, y: n.y, deck: n.deck, node: nodeId, need, acc: 0, t: dur, dur, label, done: false, warned: false };
}
function evBegin(id, task) {
  const ev = G.sp.ev;
  ev.lastId = id; ev.legFired++; G.stats.events++;
  if (task) {
    ev.active = { id, task, trap: false };
    toast(`Captain's deck task: ${task.label} (${task.dur}s)`, "task");
    setStatus(`<b>Ship's business — optional deck task.</b> ${task.label}. Bonus if he makes it in time; no harm if he doesn't.`);
  }
}
function evScheduleNext() {
  const SP = G.sp;
  SP.ev.nextT = SP.travel && !SP.travelPaused && SP.ev.legFired < SP.ev.legTarget ? rand(6, 11) : -1;
}
export function fireEvent(id) {
  const SP = G.sp;
  if (SP.ev.active || SP.battle) return false;
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
      log("Diallo coordinates the hand-off: replicator stock, medical supplies, shields spread over the convoy. Power −12. The colonists' elder names a newborn for the ship: reputation +2.", "good");
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
      evBegin(id, null);
      log("Bridge: A Ferengi marauder hails — DaiMon Pesk. His opening offer for two spare parts is 'one Miranda-class starship, slightly used.'", "comm");
      if (Math.random() < 0.5) { const got = Math.min(2, S.partsCap - S.parts); S.parts += got; log(`T'Ren negotiates for eleven minutes in perfect Ferengi, quoting Rule of Acquisition 190 back at him: +${got} spare parts.`, "good"); }
      else log("T'Ren declines the final offer with arctic courtesy. Pesk: 'Call me when you're desperate, Captain. Everyone does.'", "comm");
      evScheduleNext(); break;
    }
    case "shadow":
      evBegin(id, null);
      S.alertT = Math.max(S.alertT, 5);
      log("Hale: 'Contact — Jem'Hadar fighter, extreme range, matching course and speed. She's not closing. She's just… watching.'", "comm");
      if (Math.random() < 0.12) { log("T'Ren: 'Twelve percent, Mr. Hale. Watch it come due.'", "fault"); evScheduleNext(); startBattle("shadow"); return true; }
      log("T'Ren: 'Probability she commits: 12%. Hold course, shields warm, no provocation.' The shadow peels off. Nobody aboard breathes normally for an hour.", "comm");
      evScheduleNext(); break;
    case "warnews":
      evBegin(id, null);
      if (Math.random() < 0.5) { SP.rep += 1; log("Subspace dispatch: the Seventh Fleet has retaken the Tyra system. Reputation +1.", "comm"); }
      else { SP.rep = Math.max(0, SP.rep - 1); log("Subspace dispatch: a task group has fallen back from the Kalandra sector, losses 'regretted.' Reputation −1.", "comm"); }
      evScheduleNext(); break;
    default:
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
  if (act) {
    if (act.task && !SP.battle) {
      const tk = act.task;
      tk.t -= dt;
      if (!tk.warned && tk.t <= 10 && tk.acc < tk.need) {
        tk.warned = true;
        log(`Deck task — 10 seconds left: ${tk.label}.`, "fault");
        toast(`10s left: ${DECKS[tk.deck].name} — ${NODEMAP[tk.node].name}`, "warn");
      }
      if (L.deck === tk.deck && !L.lift && dGood(L, tk)) {
        tk.acc += dt;
        if (tk.acc >= tk.need) { tk.done = true; toast("Deck task complete — bonus earned", "good"); resolveEvent(true); return; }
      }
      if (tk.t <= 0) {
        log(`Deck task window closed — ${tk.label.split(" — ")[0]}. The bridge handles it without the bonus.`, "comm");
        toast("Deck task expired — no bonus", "warn");
        resolveEvent(false);
      }
    }
    return;
  }
  if (!SP.travel || SP.travelPaused || SP.battle) return;
  if (ev.legFired >= ev.legTarget || ev.nextT < 0) return;
  ev.nextT -= dt;
  if (ev.nextT <= 0 && SP.travel.t < SP.travel.dur - 3) fireEvent(pickEvent());
}
const dGood = (L, tk) => dDist(L.x, L.y, tk.x, tk.y) <= ZONE;
function resolveEvent(bonus) {
  const SP = G.sp, act = SP.ev.active, S = G.ship;
  if (!act) return;
  SP.ev.active = null;
  if (act.id === "distress") {
    if (bonus) { SP.rep += 3; log("The Lieutenant's regulator goes over by transporter — the Kestrel Wind's life support steadies. Reputation +3, not one spare part spent. The log credits the Lieutenant by name.", "good"); }
    else if (S.parts >= 2) { S.parts -= 2; SP.rep += 3; log("The Tenacity's own spares patch the freighter's life support — 2 parts out of the locker. Reputation +3.", "good"); }
    else { S.power = clamp(S.power - 20, 0, 100); SP.rep += 1; log("No spares to give — the rescue runs slow and hungry instead. Power −20. Reputation +1.", "comm"); }
  } else if (act.id === "defector") {
    if (act.trap) { log("The galor's transporter signal was a targeting lock wearing a costume — the 'defector' was bait.", "fault"); startBattle("defector"); return; }
    SP.rep += bonus ? 3 : 2; SP.preScanned = true;
    log(`Gul Revan beams aboard${bonus ? " onto a pad the Lieutenant had prepped and swept" : ""}; his intelligence checks out. Asylum granted: reputation +${bonus ? 3 : 2}. The next fighter we meet starts pre-scanned.`, "good");
  } else if (act.id === "anomaly") {
    if (bonus) { SP.rep += 3; log("The sweep closes with the Lieutenant at the Master Systems Display — the data set is beautiful and complete. Reputation +3.", "good"); }
    else { SP.rep += 1; log("Diallo archives the anomaly with half the readings she'd have liked. Reputation +1.", "comm"); }
  } else if (act.id === "storm") {
    if (bonus) { S.shields = clamp(S.shields - 15, 0, 100); log("The Tenacity rides the shear with the Lieutenant's hands on the core — shields −15 only. Okafor: 'My Lieutenant weathered that. Personally.'", "good"); spawnFault("hazard"); }
    else { S.shields = clamp(S.shields - 35, 0, 100); log("The shear hits like a fist — shields −35, and the deck reports fresh damage.", "fault"); spawnFault("hazard"); if (Math.random() < 0.5) spawnFault("hazard"); }
  }
  evScheduleNext();
}
