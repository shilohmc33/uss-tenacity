// ============================================================================================
//  PACING CONFIG: every knob that sets the game's tempo lives here. Times are real seconds at x1.
// ============================================================================================
export const PACE = {
  // --- voyage ---
  legTime: {                       // [min, max] seconds per warp leg (5-20 real minutes)
    ds9: [300, 480], convoy: [360, 660], nebula: [540, 900], hulk: [480, 780],
    earth: [960, 1200], qonos: [960, 1200], romulus: [1020, 1200], vulcan: [900, 1140],
  },
  arriveDwell: [45, 90],           // time on station after arriving before T'Ren evaluates the next leg
  dockDwell: [120, 180],           // minimum stay at Deep Space Nine (repairs, resupply, rearm)
  escortTime: 180,                 // convoy escort clock on station
  visitTime: [150, 240],           // diplomatic visit length
  firstLegTime: [270, 330],        // the very first leg of a new game is short (~5 min) so the first session reaches a destination
  diploEvery: 6,                   // force a diplomatic trip after this many legs without one (never locked out)
  ds9PartEvery: 15,                // DS9 quartermaster: +1 spare part every N s while docked
  quartermasterAllot: 0.6,         // progression phase 2: quartermasters only top the locker up to this share of its cap
                                   // (standard allotment); salvage and fabrication still fill it to the cap
  ds9TorpEvery: 15,                // DS9 ordnance crews: +1 torpedo every N s while docked (T'Ren's "rearm")
  ds9MinTorps: 0.5,                // T'Ren holds at DS9 until the tubes are at least this fraction full
  // --- events ---
  eventsPerLeg: [1, 2],            // small voyage events per leg
  eventAt: [0.2, 0.45],            // first event at this fraction of the leg; the second spaced the same way
  // --- battles (rare set pieces) ---
  sessionCalm: 600,                // no battle in the first 10 minutes of a session
  battleGap: 1200,                 // live: at least 20 minutes between battles
  enrouteChancePerLeg: 0.05,       // chance of an ambush somewhere along any warp leg
  idleBattlesPerHour: 2,           // offline / idle: hard cap on battles in any rolling hour
  idleBattleGap: 1800,             //   ... and at least 30 minutes between them
  // --- faults ---
  faultEvery: [300, 540],          // ambient fault cadence (5-9 minutes)
  coolantHullDrain: 0.03,          // hull %/s lost to an impairing coolant leak out of battle (was 0.08; battle stays 0.45)
  // --- night-shift crew (runs while the player is away: offline catch-up, or no input for idleAfter s) ---
  idleAfter: 180,                  // seconds without input before the night crew takes the deck
  nightFix: { low: 240, med: 600, critToMed: 900 },   // seconds of work per fault (one at a time); crit gets stabilised to MED
  nightMedParts: 1,                // MED fixes use this many spares when the locker has them (else twice as slow)
  powerFloor: 25,                  // night crew keeps main power at or above this out of battle (hard floor, re-applied after every step)
  powerFloorBattle: 25,            //   ... and this during a fight (was 15; playtest-02 saw 7% because post-step drains weren't re-floored)
  nightFaultCap: 3,                // night crew: no new ambient faults while this many are open; catch-up hands over at most this many
  offlineHullFloor: 30,            // offline catch-up: damage control never lets the hull fall below this (no 5% craters while away)
  livePowerTrickle: 1.2,           // live play: emergency reserve trickle (power/s) whenever power < 10 and no battle
  offlineEnergyTarget: 70,         // the Lt is off watch while away: his energy drifts toward this
  offlineMaxSim: 8 * 3600,         // catch-up simulates at most this much time away
  // --- the Lieutenant's energy (per real second at x1, out of battle; battles multiply by ltDrainBattle) ---
  // playtest-02: the old rates (station 0.245/s, repair 0.49/s, walk 0.175/s) emptied a full bar in ~7-9 min of play.
  // These give ~36 min from full to empty (fumes at ~31 min) at a console or in a typical active mix (see tools/pt02-energy-sim.js).
  ltDrain: { walk: 0.042, repair: 0.10, station: 0.046, idle: 0.012 },
  ltDrainBattle: 2.5,
  // --- rewards for the Lt's own repairs (shown as floaters over his head) ---
  // repair rewards (repairRep / repairParts) moved to js/progression.js (PROG) with the quality roll
};
// runtime-only pacing state (not saved)
export const PACE_RT = { offline: false, idleT: 0, sessionT: 0, hidden: false };
export const rr = ([a, b]) => a + Math.random() * (b - a);
export const nightActive = () => PACE_RT.offline || PACE_RT.idleT >= PACE.idleAfter;
export function playerInput() { PACE_RT.idleT = 0; }
// pass 06: the player is PRESENT when the app is visible, not in an offline catch-up, and there was input within the
// last PROG.deaths.presentIdle s (60). Injury clocks, surgery outcomes and deaths only ever run while present.
export const presentIdle = { s: 60 };
export const isPresent = () => !PACE_RT.offline && !PACE_RT.hidden && !(typeof document !== "undefined" && document.hidden) && PACE_RT.idleT < presentIdle.s;
