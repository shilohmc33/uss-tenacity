// T'Ren runs the voyage. One voyage state (G.sp) feeds every display.
import { G } from "./state.js";
import { PROG, milestone, hooks } from "./progression.js";
import { DESTS, isHomeworld } from "./data.js";
import { clamp, pick, rand } from "./util.js";
import { log, shipNews, toast } from "./bus.js";
import { spawnFault } from "./faults.js";
import { startBattle } from "./battle.js";
import { evResetLeg } from "./events.js";
import { PACE, rr } from "./pacing.js";
import { onDock, onUndock, onDiplomatic, ds9Mult } from "./crewlife.js";

export function captainOrder(dest, reason) {
  const SP = G.sp;
  if (SP.travel || SP.battle || SP.location === dest) return;
  SP.cap.dest = dest; SP.cap.reason = reason; SP.cap.holdLogged = false;
  // first leg of a new career is short (PACE.firstLegTime, ~5 min) so the first session reaches somewhere
  const first = (G.stats.legs || 0) === 0 && !SP.firstLegSet;
  SP.firstLegSet = true;
  if (SP.location === "ds9") onUndock();   // phase 3: a priority dock slot lasts one visit
  SP.travel = { dest, t: 0, dur: Math.round(rr(first ? PACE.firstLegTime : (PACE.legTime[dest] || [300, 600]))), from: SP.location };
  if (isHomeworld(dest)) SP.cap.sinceDiplo = 0; else SP.cap.sinceDiplo = (SP.cap.sinceDiplo || 0) + 1;
  SP.travelPaused = false; SP.encAcc = 0; SP.escortDone = true;
  evResetLeg(dest);
  log(`T'Ren: Orders — set course for ${DESTS[dest].name}. ${reason}`, "comm");
  if (dest === "nebula") log("Diallo: Long-range sensors are already painting the Omarion Nebula, Captain. If there is anything to find in those clouds, I will find it.", "comm");
  if (dest === "hulk") log("Diallo: I have the derelict hulk's signal marked, Captain. Salvage signatures read promising.", "comm");
  if (isHomeworld(dest)) log(`Diallo: Course laid in for ${DESTS[dest].name}, Captain — a long haul, and core alliance space at the far end. What waits there is diplomacy.`, "comm");
  toast(`Captain's orders: ${DESTS[dest].name}`, "info");
  shipNews(`Under <b>Captain's orders</b> — at warp for <b>${DESTS[dest].name}</b>. Your post is the deck.`);
}
function diplomaticOrder() {
  const dest = pick(["earth", "qonos", "romulus", "vulcan"].filter(w => w !== G.sp.cap.lastDiplo));
  G.sp.cap.lastDiplo = dest;
  const reasons = {
    earth: "Starfleet Command requests our presence at Earth — spacedock time, a full quartermaster issue, and shore leave. Probability Command's interest is purely administrative: 31%. We go regardless.",
    qonos: "The Klingon Defense Force requests a joint-operations liaison at Qo'noS. Probability the exchange strengthens the alliance: 78%. Probability someone challenges Hale to a drinking contest: 94%.",
    romulus: "The Romulan Star Empire has agreed to an intelligence exchange at Romulus. Probability their candor proves complete: 38%. Probability the exchange is worth the voyage regardless: 81%.",
    vulcan: "The Vulcan Science Academy requests a diplomatic call at Vulcan. Probability the data strictly required a starship to deliver it: 12%. Probability I will discuss the matter further: zero.",
  };
  captainOrder(dest, reasons[dest]);
}
function captainEvaluate() {
  const S = G.ship, SP = G.sp;
  log(`T'Ren: Evaluating our next movement after ${SP.location ? DESTS[SP.location].name : "deep space"} — hull ${Math.round(S.hull)}%, spare parts ${S.parts}, torpedoes ${S.torps}.`, "comm");
  if (S.hull < 50) return captainOrder("ds9", `Hull at ${Math.round(S.hull)}% — below the 50% threshold I require to remain on the line. We return to Deep Space Nine. Probability a raider tests that weakness on any given leg: 22%.`);
  if (S.parts <= 3) return captainOrder("ds9", `Spare parts at ${S.parts} — insufficient margin for damage control. We return to Deep Space Nine for resupply. Probability of a critical shortage mid-action: 64%.`);
  if (S.torps <= 0) return captainOrder("ds9", "Torpedo tubes empty — Hale has no ordnance. We return to Deep Space Nine to rearm. Probability of attack on an unarmed Miranda: 20% per leg.");
  if ((SP.cap.sinceDiplo || 0) >= PACE.diploEvery && S.hull >= 60) return diplomaticOrder();
  SP.cap.legCount++;
  if (SP.cap.legCount >= 3 || Math.random() < 0.34) {
    SP.cap.legCount = 0;
    return Math.random() < 0.5
      ? captainOrder("nebula", "Task-force orders divert us to exploration: the Omarion Nebula. Probability of a useful find: 58%. Probability something finds us first: 15%.")
      : captainOrder("hulk", "Task-force orders divert us to the derelict hulk, for salvage. Probability her holds still contain usable materiel: 66%.");
  }
  captainOrder("convoy", "Hull, parts, and ordnance within margins. We take another convoy — our assigned duty. Probability of raider contact: 18%.");
}
function tickCaptain(dt) {
  const S = G.ship, SP = G.sp, cap = SP.cap;
  if (SP.battle || SP.travel) return;
  const dockHold = (where, dest, prob) => {
    if (S.hull < 40) {
      cap.dest = dest;
      cap.reason = `Holding at ${where} — hull at ${Math.round(S.hull)}% is below my 40% departure minimum. Patching continues until I am satisfied. Probability of losing this ship if we sail now: ${prob}%.`;
      if (!cap.holdLogged) { cap.holdLogged = true; log("T'Ren: " + cap.reason, "comm"); }
      cap.decideT = 1.2; return true;
    }
    if (cap.holdLogged) { cap.holdLogged = false; log(`T'Ren: Hull at ${Math.round(S.hull)}% — above my minimum. The Tenacity may proceed.`, "comm"); }
    return false;
  };
  if (SP.location === "ds9") {
    if (dockHold("Deep Space Nine", "convoy", 82)) return;
    if (S.torps < Math.ceil(S.torpCap * PACE.ds9MinTorps)) {   // T'Ren doesn't sail with empty tubes: wait for the ordnance crews
      cap.reason = `Docked at Deep Space Nine — ordnance crews are loading the tubes (${S.torps}/${S.torpCap}). Departure once Hale has at least ${Math.ceil(S.torpCap * PACE.ds9MinTorps)}.`;
      cap.decideT = Math.max(cap.decideT, 5); return;
    }
    cap.decideT -= dt;
    if (cap.decideT <= 0) {
      // diplomatic trips can't be locked out: hull >= 60 is the only gate (DS9 re-arms), and they're forced after diploEvery legs
      if (S.hull >= 60 && ((cap.sinceDiplo || 0) >= PACE.diploEvery || Math.random() < 0.3)) diplomaticOrder();
      else captainOrder("convoy", "Convoy escort — the ship's assigned duty. We take the next freighter run off Deep Space Nine. Probability of raider contact en route: 18%.");
    }
    return;
  }
  if (isHomeworld(SP.location)) {
    if (!SP.visit || !SP.visit.done) { cap.decideT = 1; return; }
    if (dockHold(DESTS[SP.location].name, "ds9", 79)) return;
    cap.decideT -= dt;
    if (cap.decideT <= 0) {
      const from = DESTS[SP.location].name; SP.visit = null;
      if (Math.random() < 0.5) captainOrder("ds9", `Our business at ${from} is concluded — we return directly to Deep Space Nine. Probability the alliance is measurably stronger: 71%.`);
      else captainOrder("convoy", `Our business at ${from} is concluded. We pick up the convoy lane on the way back. Probability of raider contact: 18%.`);
    }
    return;
  }
  const resolved = (SP.location === "convoy" && SP.escortDone) || SP.location === "nebula" || SP.location === "hulk" || SP.location === null;
  if (!resolved) return;
  cap.decideT -= dt;
  if (cap.decideT <= 0) captainEvaluate();
}
export function arriveAtDest() {
  const S = G.ship, SP = G.sp, id = SP.travel.dest;
  SP.travel = null; SP.travelPaused = false; SP.location = id; G.stats.legs++;
  SP.cap.decideT = rr(PACE.arriveDwell); SP.cap.dest = null;
  SP.cap.reason = `Arrived at ${DESTS[id].name} — the Captain is evaluating her next orders.`;
  toast(`Arrived: ${DESTS[id].name}`, "info");
  if (!G.prog.milestones.firstArrival) {   // session-1 milestone: T'Ren's commendation + DS9's welcome-aboard crate
    const fa = PROG.firstArrival, got = Math.min(fa.parts, S.partsCap - S.parts);
    SP.rep += fa.rep; S.parts += got;
    log(`T'Ren: 'First arrival logged, Lieutenant. I've noted your conduct in the record.' Reputation +${fa.rep}. DS9's welcome-aboard crate caught up with us: +${got} spare parts.`, "good");
    milestone("firstArrival", "First arrival");
  }
  if (id === "ds9") {
    SP.cap.dest = "convoy";
    SP.cap.decideT = rr(PACE.dockDwell); SP.torpT = 0;
    SP.cap.reason = "Docked at Deep Space Nine — patching, resupply and rearming before the next convoy. Departure pending my hull minimum of 40%.";
    onDock();   // phase 3: favours waiting at the dock (parts shipment, priority slot)
    log(`Docking clamps away — the Tenacity holds station at Deep Space Nine. Station crews begin hull patching; the quartermaster opens resupply${S.torps < S.torpCap ? " and the ordnance crews start loading torpedoes" : ""}.`, "good");
  } else if (id === "convoy") {
    log("Convoy rendezvous made — twelve freighters falling in behind the old girl's shields.");
    if (!(Math.random() < 0.12 && startBattle("convoy"))) { SP.escortT = 0; SP.escortDone = false; SP.escortChecked = false; log("All quiet on the route — for now. Escort clock running.", "comm"); }
  } else if (id === "nebula") {
    log("Entering the Omarion Nebula — sensors half-blind in the clouds, hearts fully awake.", "comm");
    const r = Math.random();
    if (r < 0.16 && startBattle("nebula")) { /* ambush */ }
    else if (r < 0.5) { S.power = clamp(S.power + 25, 0, 100); log("Diallo: Sensor find — a dilithium pocket in the nebula ice. Power reserves +25.", "good"); }
    else { const got = Math.min(3, S.partsCap - S.parts); S.parts += got; log(`Diallo: Sensor find — a dead freighter's cargo pods. Salvaged ${got} spare part(s).`, "good"); }
  } else if (id === "hulk") {
    const haul = Math.min(4 + Math.floor(rand(0, 2)), S.partsCap - S.parts); S.parts += haul;
    log(`Diallo: Alongside the hulk — her holds are intact. Cutting parties strip her: +${haul} spare parts.`, "good");
    if (Math.random() < 0.10 && startBattle("hulk")) { /* ambush */ }
    else if (Math.random() < 0.35) {
      if (Math.random() < 0.5) { log("Something was still aboard the hulk — and it got into the ship's systems before security flushed it out.", "fault"); const id = spawnFault("hazard"); hooks.hazard.forEach(f => f({ kind: "hulk", sys: id })); }
      else { S.hull = Math.max(1, S.hull - 6); log("The hulk's hull gives way as she rolls — debris scrapes the Tenacity's flank. Hull −6%.", "fault"); }
    } else log("The hulk gives up her parts quietly. Nothing aboard but ghosts and good salvage.");
  } else if (isHomeworld(id)) arriveHomeworld(id);
}
function arriveHomeworld(id) {
  const S = G.ship, SP = G.sp;
  SP.visit = { id, t: 0, dur: Math.round(rr(PACE.visitTime)), done: false };
  onDiplomatic(id);   // phase 3: +2 Fleet Reputation per diplomatic visit (memo §3)
  SP.cap.dest = null;
  if (id === "earth") {
    SP.cap.reason = "In spacedock at Earth — yard patching at full rate, resupply, and shore leave.";
    log("Spacedock doors close behind the Tenacity — Earth below, the Moon standing off. Yard crews swarm the hull; shore leave is granted by watch rotation.", "good");
  } else if (id === "qonos") {
    SP.rep += 2; const scarred = S.hull < 70; if (scarred) SP.rep += 1;
    const p = Math.min(3, S.partsCap - S.parts); S.parts += p; const t = Math.min(2, S.torpCap - S.torps); S.torps += t;
    SP.cap.reason = "At Qo'noS — joint-operations liaison with the Klingon Defense Force.";
    { const gifts = [p ? `${p} spare part${p > 1 ? "s" : ""}` : "", t ? `${t} torpedo casing${t > 1 ? "s" : ""}` : ""].filter(Boolean).join(" and ");
      log(`A bird-of-prey escort brings the Tenacity into Qo'noS orbit. Reputation +2${gifts ? ` — and the Klingon yards press ${gifts} on us` : ""}.`, "good"); }
    if (scarred) log("General K'Torv laughs once at our patched hull: 'You fly a ship that has been somewhere.' Reputation +1 more.", "comm");
  } else if (id === "romulus") {
    SP.rep += 2; SP.preScanned = true;
    SP.cap.reason = "At Romulus — intelligence exchange. The next hostile's shields are pre-mapped.";
    log("A warbird shadows the Tenacity into Romulus orbit. The exchange is precise, civil, and impossible to verify: reputation +2 — and the next Jem'Hadar we meet is pre-scanned.", "good");
  } else if (id === "vulcan") {
    SP.rep += 1; const p = Math.min(3, S.partsCap - S.parts); S.parts += p;
    SP.cap.reason = "At Vulcan — Science Academy call; precision components taken aboard.";
    log(`The Science Academy's shuttle delivers ${p} precision component(s) with a manifest and no ceremony. Reputation +1.`, "good");
    log("T'Ren, personal log: Vulcan. The Tenacity is docked. Nothing further.", "comm");
  }
}
export function tickVoyage(dt) {
  const S = G.ship, SP = G.sp;
  if (SP.travel && !SP.travelPaused && !SP.battle) {
    SP.travel.t += dt; SP.encAcc += dt;
    if (SP.encAcc >= 1) {
      SP.encAcc = 0;
      if (Math.random() < 1 - Math.pow(1 - PACE.enrouteChancePerLeg, 1 / SP.travel.dur)) startBattle("enroute");
    }
    if (SP.travel && SP.travel.t >= SP.travel.dur) arriveAtDest();
  }
  if (SP.location === "ds9" && !SP.travel && !SP.battle) {
    S.hull = clamp(S.hull + 0.5 * dt, 0, 100);
    SP.resupT += dt;
    // phase 3: quartermaster perk / priority dock favour shorten the pallet interval (crewlife.ds9Mult)
    if (SP.resupT >= PACE.ds9PartEvery * ds9Mult()) { SP.resupT = 0; if (S.parts < Math.round(S.partsCap * PACE.quartermasterAllot)) { S.parts++; log("Quartermaster's pallet beamed over — +1 spare part from Deep Space Nine stores.", "good"); } }
    // rearm: DS9 ordnance crews load the tubes (what T'Ren's "return to Deep Space Nine to rearm" promises)
    if (S.torps < S.torpCap) {
      SP.torpT = (SP.torpT || 0) + dt;
      if (SP.torpT >= PACE.ds9TorpEvery * (G.prog.fav.fx.dock === "active" ? PROG.favourFx.dockMult : 1)) {
        SP.torpT = 0; S.torps++; S.tubeFlash = S.elapsed;
        if (S.torps >= S.torpCap) log(`Deep Space Nine ordnance crews seal the last tube — torpedoes ${S.torps}/${S.torpCap}. Hale: 'Fully armed, Captain.'`, "good");
        else if (S.torps === 1) log("Deep Space Nine ordnance crews begin loading photon torpedoes into the Tenacity's tubes.", "good");
      }
    } else SP.torpT = 0;
  }
  if (isHomeworld(SP.location) && !SP.travel && !SP.battle) {
    if (SP.location === "earth") {
      S.hull = clamp(S.hull + 1.2 * dt, 0, 100); S.energy = clamp(S.energy + 2.2 * dt, 0, 100);
      SP.resupT += dt;
      if (SP.resupT >= 6) { SP.resupT = 0; if (S.parts < Math.round(S.partsCap * PACE.quartermasterAllot)) { S.parts++; log("Spacedock quartermaster's pallet secured — +1 spare part.", "good"); } }
    }
    if (SP.visit && !SP.visit.done) {
      SP.visit.t += dt;
      if (SP.visit.t >= SP.visit.dur) {
        SP.visit.done = true; SP.cap.decideT = rr(PACE.arriveDwell); SP.cap.dest = null;
        SP.cap.reason = `Visit to ${DESTS[SP.location].name} complete — the Captain is evaluating the run home.`;
        const bye = { earth: "Starfleet Command releases the Tenacity from spacedock with its compliments.", qonos: "The liaison closes the Klingon way: a toast, a warning, an escort to the edge of the system. Qapla'.",
          romulus: "The Romulan delegation withdraws with perfect courtesy and no backward glance.", vulcan: "The Academy's farewell is a single word: 'Adequate.' From Vulcan, that is an ovation." };
        log(bye[SP.location], "comm");
      }
    }
  }
  if (SP.location === "convoy" && !SP.battle && !SP.escortDone) {
    SP.escortT += dt;
    if (!SP.escortChecked && SP.escortT > PACE.escortTime / 2) { SP.escortChecked = true; if (Math.random() < 0.08) startBattle("convoy"); }
    if (!SP.battle && SP.escortT >= PACE.escortTime) {
      SP.escortDone = true; SP.rep++; SP.cap.decideT = rr(PACE.arriveDwell); SP.cap.dest = null;
      SP.cap.reason = "Convoy delivered — the Captain is evaluating her next orders.";
      const sal = Math.min(2, S.partsCap - S.parts); S.parts += sal;
      log(sal > 0 ? `Convoy delivered intact to the transfer point — +${sal} parts change hands. Reputation rising.`
        : "Convoy delivered intact to the transfer point. Reputation rising.", "good");
    }
  }
  tickCaptain(dt);
}
// ---- one voyage view-model for every display ----
export function sceneText() {
  const SP = G.sp;
  if (SP.battle) return "Red alert — Jem'Hadar fighter engaged";
  if (SP.travel) return `At warp — course for ${DESTS[SP.travel.dest].name}${SP.travelPaused ? " · holding for battle" : ""}`;
  const t = { ds9: "Deep Space Nine — holding station", convoy: "Convoy Route — on escort station", nebula: "Omarion Nebula — sensor sweeps",
    hulk: "Derelict Hulk — alongside the wreck", earth: "Earth — in spacedock", qonos: "Qo'noS — in orbit", romulus: "Romulus — in orbit", vulcan: "Vulcan — in orbit" };
  return t[SP.location] || "Deep space — holding position";
}
export function voyageView() {
  const SP = G.sp, cap = SP.cap;
  const dest = SP.travel ? SP.travel.dest : cap.dest;
  const progress = SP.travel ? SP.travel.t / SP.travel.dur : null;
  let headline;
  if (SP.battle) headline = "Battle stations — the bridge is fighting";
  else if (SP.travel) headline = `Proceed to ${DESTS[SP.travel.dest].name} · ${Math.round(progress * 100)}%`;
  else if (cap.dest) headline = `Next: ${DESTS[cap.dest].name} (pending)`;
  else headline = "Evaluating next orders";
  return { headline, reason: cap.reason, dest, progress, location: SP.location, scene: sceneText(),
    bg: SP.travel ? "bg-travel" : SP.location && DESTS[SP.location] ? DESTS[SP.location].bg : "bg-travel" };
}
