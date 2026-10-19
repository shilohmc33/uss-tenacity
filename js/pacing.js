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
  // --- encounter table (js/encounters.js): WHICH enemy a random battle brings. Weights are relative odds among the
  //     types whose gates are open; story contexts (defector, shadow) and forced/debug fights skip the table.
  encounter: {
    weights: { jh_fighter: 50, galor: 40, jh_battlecruiser: 20 },   // pass 15 D2: battlecruiser 10 -> 20 live (she is met live, not on the return report)
    // pass 15 D2: while the player is AWAY (offline catch-up or an idle tab) the battlecruiser is rolled at a much lower weight and needs a
    // much longer gap, so she is mostly met live (target: >= 1/3 of a regular player's battlecruisers live). Fighter : Galor odds unchanged.
    awayWeights: { jh_fighter: 50, galor: 40, jh_battlecruiser: 1 },   // fighters most common, then Galors; the battlecruiser rare (~10% once open, as the groundwork had)
    bc: {                          // the battlecruiser (worn start: 83.8% wins / 14.9% injuries; hard start 9.7% wins) only when ALL hold:
      minRank: 1,                  //   she is a full Lieutenant (rank 1; guaranteed by play day 7, ~day 5 for a regular player) ...
      minShipDay: 21,              //   ... AND ship's day 21+ (the groundwork's gate, kept: pass 12 manager note) ...
      gapBattles: 2,               //   never twice in a row: at least 2 other battles since the last battlecruiser ...
      gapPlayDays: 2,              //   ... AND at least 2 play days since her (pass 13: spaced by battles AND by days)
      awayGapPlayDays: 14,         //   ... and, rolled while away, at least 14 play days since her (pass 15 D2)
      minHull: 60,                 //   and never against a CRIPPLED ship (pass 13 manager call): hull below 60% ...
      blockSev: "crit",            //   ... or an open CRIT fault ...
      minTorps: 2,                 //   ... or fewer than 2 torpedoes (pass 15 D1: 0; pass 15 N1: < 2) ...
      minPower: 30,                //   ... or main power below 30% (pass 15 D1) -> the roll falls back to fighter / Galor. Med / low faults don't hold her.
    },
    // pass 15 D2: an AWAY battlecruiser fight (offline catch-up / idle tab) starts on the night watch: hours away let every officer
    // ability cool down, so she used to walk into Scan + a full Spread and die in one volley (~1-3% hull). The night watch has the
    // bridge instead: each ability starts on cooldown at cdFrac x its cdMax (uniform; >= 36 s, so in practice none in the fight), and the
    // tubes hold at most torpsMax (only the ready rack is loaded).
    bcAway: { cdFrac: [0.8, 1.0], torpsMax: 4 },
    // pass 15 (manager call): LIVE, she opens with a polaron alpha strike at the bridge - every officer ability that is ready (or has less
    // than knockFrac x cdMax left) goes to knockFrac x its cdMax; abilities cooling longer than that keep their timer (never pushed further). A rested bridge used to one-volley
    // her (Scan + Spread) for 0% hull. Away fights skip it: the night watch start (bcAway) already has every ability cooling.
    bcAlpha: { knockFrac: 0.5 },
  },
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
export const PACE_RT = { offline: false, idleT: 0, sessionT: 0, hidden: false, liveFight: false };
export const rr = ([a, b]) => a + Math.random() * (b - a);
export const nightActive = () => PACE_RT.offline || PACE_RT.idleT >= PACE.idleAfter;
// pass 16 B1: a fight that STARTED live (battle.live) stays live until it ends, whatever the player does meanwhile -
// no offline hull floor, no night-crew patching, no x0.006 injury rate, no power floor. PACE_RT.liveFight mirrors
// G.sp.battle.live (set by startBattle, refreshed every stepSim). The away-weighted roll itself still uses nightActive().
export const offRules = () => nightActive() && !PACE_RT.liveFight;
export function playerInput() { PACE_RT.idleT = 0; }
// pass 06: the player is PRESENT when the app is visible, not in an offline catch-up, and there was input within the
// last PROG.deaths.presentIdle s (60). Injury clocks, surgery outcomes and deaths only ever run while present.
export const presentIdle = { s: 60 };
export const isPresent = () => !PACE_RT.offline && !PACE_RT.hidden && !(typeof document !== "undefined" && document.hidden) && PACE_RT.idleT < presentIdle.s;
