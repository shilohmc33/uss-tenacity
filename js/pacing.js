// ============================================================================================
//  PACING CONFIG: every knob that sets the game's tempo lives here. Times are real seconds at x1.
// ============================================================================================
// pass 17 P2: scale A slowed the walk x0.62 (option A: 0.10 x FIG_K), so a deck-to-deck repair trip takes ~1.55x as long (pass 17
// route17: Bridge -> coolant 11.2 s -> 17.4 s, Medical -> coolant 11.7 -> 18.0, Lounge -> coolant 8.4 -> 12.9). Every injury / rescue
// window that a trip has to fit inside is multiplied by this, so travel takes the same share of the window as in pass 16
// (progression.js PROG.deaths: window, returnFloor, surgery fastS / fastFullS / fastEndS). 1 = the pass 16 seconds.
export const TRAVEL_SCALE = 1.55;
// pass 18: deck-task timers audited the same way. Scaled (a walk to a node is part of the window): the voyage-event deck tasks
// (events.js evTask: 30 / 26 s -> 47 / 40 s), the odd-job expiry (progression.js PROG.jobs.expire 150 -> 233 s) and the CRIT
// knock-on clock below (150 -> 233 s: fix the CRIT before it strains a LOW fault to MEDIUM). Left alone (no Lt travel inside):
// the 10 s 'last call' warning, work seconds at the console (need / jobs.work), cadences and gaps (faultEvery, jobs.gap, events),
// night-crew fix times, idleAfter, intro/beat expiry (days / unused), voyage and battle clocks.
export const travelS = s => Math.round(s * TRAVEL_SCALE);
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
    // multi-ship P2: enemy GROUPS. The lead ship is rolled as above (weights + battlecruiser gates); wingmen then join by progression
    // tier (G.prog.playDays), each rolled at wingP while the group's threat stays within the tier's budget (the lead counts). Wingmen
    // are lighter escorts, not full warships (wing: hull / damage multipliers, volley gap stretch) - battle-sim, worn start + passive Lt.
    // Story contexts that name the enemy (defector, shadow) and debug drills stay one-on-one; a crippled ship (shipCrippled) gets no
    // wingmen; away fights cap at awayMax ships.
    groups: {
      threat: { jh_fighter: 1, galor: 2, jh_battlecruiser: 4 },
      wingmen: { jh_fighter: 70, galor: 30 },          // who can fly wing (never the battlecruiser), by weight
      tiers: [                                          // the highest tier whose minPlayDays is met applies
        { minPlayDays: 0, budget: 2, wingP: 0 },        // early game: one-on-one, as before
        { minPlayDays: 3, budget: 2, wingP: 0.3 },      // a fighter may pick up a fighter wingman (Galor leads stay solo)
        { minPlayDays: 8, budget: 3, wingP: 0.4 },      // Galor + fighter, or up to 3 fighters
        { minPlayDays: 15, budget: 4, wingP: 0.5 },     // Galor + 2 fighters, or 2 Galors. The battlecruiser (threat 4) always flies alone
      ],
      wing: { hull: 0.6, dmg: 0.6, gap: 1.5 },
      max: 3, awayMax: 2, solo: ["defector", "shadow", "debug"],
    },
  },
  // multi-ship P3: ALLIES come from mission context, not the encounter roll. A fight on the convoy route brings the convoy's freighter
  // (no guns; she must survive - losing her fails the convoy run); a fight at / to / from Qo'noS brings a Klingon Bird-of-Prey (joint op).
  // p = chance the mission's ships are in the fight; ids missing from SHIPS are skipped (fed_saber: a Federation escort, ready for when the
  // artist's Saber-class lands - add her SHIPS entry + sheet, then give "escort" a when/p). {name} / {short} = the first ally's names.
  allies: {
    missions: {
      convoy: { allies: ["freighter"], protect: "freighter", p: 1, objective: "Protect the {name} - if she's lost, the convoy run fails.", short: "Protect the {short}" },
      jointop: { allies: ["klingon_bop"], p: 1, objective: "Klingon joint op - the {name} fights alongside us.", short: "Joint op with the {short}" },
      // the Saber-class escort: a chance on ordinary patrol / transit fights (kinds), once the ship has some play days behind her
      escort: { allies: ["fed_saber"], p: 1, chance: 0.25, kinds: ["enroute", "nebula", "hulk"], minPlayDays: 3, objective: "Federation escort - the {name} flies with us.", short: "Escort: the {short}" },
    },
    // who enemies shoot when allies are present: the Tenacity, the weakest ally, else any; protectP = the chance raiders go for the
    // protected ship first (cargo is the prize). Allies: the Tenacity's target (focus fire), the weakest enemy, else any.
    aim: { enemy: { ship: 0.4, weakest: 0.4 }, protectP: 0.2, ally: { focus: 0.6, weakest: 0.25 } },
    morale: { energy: 12 },          // an ally lost costs the Lieutenant's energy (the crew takes it hard)
    failRep: 2,                      // losing the protected ship: reputation lost (and no convoy-delivered bonus)
  },
  // --- faults ---
  faultEvery: [300, 540],          // ambient fault cadence (5-9 minutes)
  critKnockOnS: travelS(150),      // pass 18: an open CRIT strains a random LOW fault to MEDIUM every this many s (was 150; x TRAVEL_SCALE)
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
// Crew needs N1 (notes/2026-10-22-crew-needs-plan.md): per real hour; a ship's day is 16 h (PROG.dayLength), 3 shifts of ~5.3 h
export const NEEDS = {
  stepS: 10,                                   // sim seconds per needs update (cheap; offline catch-up too)
  decay: { rest: 6, food: 9, fun: 4, social: 2 },
  gain: { sleep: 22, eat: 600, fun: 40, socialGroup: 20, chat: 10 },   // eat: about 6 min from hungry to full
  th: { sleep: 40, wake: 95, eat: 45, wakeToEat: 15, mealBreak: 20, fun: 35, funDone: 90 },
  comfort: { base: 65, docked: 25, perFault: 5, faultMax: 20, lowHull: 15, lowHullAt: 50, alert: 10, rate: 10 },
  offlineFloor: 30,                            // away: crew look after themselves (nobody below Strained)
  start: { rest: 85, food: 80, fun: 75, social: 70, comfort: 70 },
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
// crew needs N2: mood, moodlets, minor incidents, station efficiency, combat cooldown, skills (js/mood.js)
export const MOOD = {
  w: { rest: 0.25, food: 0.2, fun: 0.2, social: 0.15, comfort: 0.2 },   // mood = weighted needs + moodlets (+ quirks)
  bands: [60, 40, 25, 10], hyst: 5,                                         // Content 60+ | Steady | Strained 25-39 | Stressed | Breaking <10
  label: ["Content", "Steady", "Strained", "Stressed", "Breaking"],
  day: 57600,                                                                // a ship's day in seconds (PROG.dayLength)
  mlet: { win: [5, 1], disengage: [-4, 1], tow: [-10, 1], injury: [-4, 1], death: [-15, 3], gift: [4, 1], giftLoved: [8, 1], giftBad: [-2, 0.5],
    dinner: [4, 1], shore: [20, 2], chat: [2, 0.25], allyLost: [-6, 2], keralaLost: [-9, 3],
    talked: [6, 1], heard: [10, 1], scuffle: [-3, 0.5],
    holoCal: [6, 0.5], holoZen: [5, 0.5], holoNovel: [10, 1], holoProton: [6, 0.5], holoVic: [8, 0.5], holoRisa: [20, 1], holoCrowd: [-3, 0.5], holoLoved: [4, 1],
    rested: [3, 0.5], counsel: [6, 1], swap: [3, 0.5],
    storyGood: [5, 1], storyRough: [-4, 1], storyFeud: [-3, 0.5] },   // E1 story events (js/story.js)                     // [value, ship's days]; fades linearly to 0
  maxMlets: 8,
  eff: { lo: 0.85, hi: 1.05, slip: 0.03 },                                   // station efficiency from mood; a slip -3% for 1 h
  cd: { lo: 0.9, hi: 1.05, max: 1.1 },                                       // bridge officers' cooldown speed from mood (+1%/Tactical level, capped)
  stress: { below: 25, decay: 0.5, cap: 200 },                                        // hours below 25 (gates N3's major tier); composure -4%/level
  minor: { perHour: 0.35, gapS: 7200, slipS: 3600 },                         // Strained or worse: per-crew chance / h; 1 per 2 h ship-wide; online only
  skill: { duty: 2, fun: 2, repair: 6, win: 12, max: 10 },
  // N3: medium (Stressed + stress hours) and major (Breaking + 4 h stress) incidents; seen-only, capped, never lethal (js/incidents.js)
  medium: { perHour: 0.3, stressH: 1, gapS: 57600, refuseS: 7200, refuseEff: 0.7, unwellEff: 0.5, unwellS: 14400 },
  major: { perHour: 0.2, stressH: 4, gapS: 5 * 57600, breakdownS: 57600, misset: 0.15, insubOp: -4 },
  graceDays: 7, workS: [8, 12], helpOp: 2,                   // XP; level L needs 100 x L more (50 L (L+1) total)
};

// ---- N4: player crew-care tools (js/crewcare.js) and the Holodeck panel (js/holodeck.js, plan section 8) ----
export const CARE = {
  restS: 4 * 3600, restDayCap: 1,          // order rest: off duty 4 h, once per ship's day per crewmember (a senior signs it off)
  counselGapDays: 3,                       // counselor visit: stress reset, 3 ship's days per crewmember
  swapDayCap: 1,                           // shift swap: once per ship's day per crewmember
  shoreRep: 10, shoreFill: 40,             // shore leave at DS9: ship-wide, once per dock, costs 10 rep; fun/social/comfort +40
  insightQuirk1: 2, insightQuirks: 3, insightBars: 3,   // Insight gating: one quirk at 2, all quirks + need bars at 3
  // P31 (Shiloh): rest / swap / shore leave are requests to the captain below Lt Cmdr. chance = base + stress + need + opinion,
  // stress term full at stressFull stress-hours, need term full when the worst need is 0 (none above needOk), opinion = captain's of the Lt / 100
  req: { base: 0.30, stressW: 0.30, stressFull: 8, needW: 0.25, needOk: 60, opW: 0.25, min: 0.05, max: 0.95, denyDays: 1, directRank: 2 },
};
// ---- E1: illustrated story events (js/story.js, notes/2026-10-23-story-events-plan.md sections 4 and 6) ----
export const STORY = {
  legChance: 0.35,          // a voyage event slot becomes a story event at full ramp (the total event rate does not grow: an old text event fills any slot a story doesn't take)
  // P33 frequency ramp by play days: [from playDay, share of voyage event slots, story events per ship's day]. Before the first
  // row (day 0-1) none. Easy to tune: edit the rows.
  ramp: [[2, 0.10, 1], [5, 0.20, 1], [10, 0.35, 2]],   // P33 fix 4: 1 story a ship's day on days 2-9, 2 from day 10
  dockPerHour: 0.6,         // docked at DS9: chance per present ship-hour (dt-scaled roll), at most one per dock visit
  minLegs: 2,               // legs started since the last story event before the next one in travel (one quiet leg between; so at most 1 per leg)
  perDay: 2,                // story events per ship's day (PROG.dayLength)
  graceDays: 2, gentleUntil: 5,   // play days: none before 2, only the gentle pool before 5
  odds: { base: 0.35, skill: 0.06, rel: 0.15, friend: 0.10, rival: -0.05, partner: 0.05, min: 0.10, max: 0.90, success: 0.6,
    words: { likely: 0.5, fair: 0.33, long: 0.15, partialHint: 0.6 } },   // P32 #6: the word is on FULL success (0.6p): likely >= 50% (p >= .834), fair odds >= 33% (p >= .55), a long shot >= 15% (p >= .25), else unlikely; '· partial likely' when p (not failing) >= 60% and the word isn't 'likely'
  chain: { min: 1, max: 3, expire: 5 },   // E3 follow-ups: due 1 to 3 seen legs after the parent, expire after 5 seen legs (frozen while away)
  relSkillDiv: 10,          // (pre-P34 opinion checks; every roll is now an Lt skill)
  tier: { low: 3, high: 7 },   // P34: Lt skill tier for the outcome text: 0-3 low (inexperience), 4-6 mid, 7+ high (bad luck despite doing it right)
  // P34: skill-locked bonus choices (one per event or step, key "<id>" or "<id>:<step>"): the Lt skill level that unlocks it
  bonus: { default: 6, coolant_cascade: 6, mess_hall_feud: 5, letter_home: 6, ferengi_salvage: 6, "kestrel_derelict:1": 6, "kestrel_derelict:2": 6, "kestrel_derelict:3": 5,
    "subspace_echo:1": 6, "subspace_echo:2": 6, vorta_offer: 6, bajoran_relic: 5, cardassian_codes: 6, jemhadar_wreck: 6, holo_ghost: 5, shore_trouble: 6 },
  // P34: old text events with a story version now weigh half (events.js pickEvent)
  textWeight: { distress: 0.5, refugee: 0.5, defector: 0.5, anomaly: 0.5, ferengi: 0.5, crewmoment: 0.5 },          // a relationship check rolls opinion instead of a skill: max(0, opinion) / 10 stands in for the 0-10 skill level
};
// P33: the story share of a voyage event slot / the per-ship's-day cap at a play day (STORY.ramp)
const rampRow = pd => { let r = null; for (const x of STORY.ramp) if ((Number.isFinite(+pd) ? +pd : 0) >= x[0]) r = x; return r; };
export const storyShare = pd => { const r = rampRow(pd); return r ? r[1] : 0; };
export const storyPerDay = pd => { const r = rampRow(pd); return r ? r[2] : 0; };
export const HOLO = {
  // cost FR, min (session length, ship seconds = min x 60), group = up to 4, fit = quirks that love it
  progs: {
    tactical_sim: { name: "Starfleet Tactical Sim", sub: "Kobayashi Maru variant", fr: 20, min: 20, kind: "drill", skill: "tactical", xp: 40, buff: "drilled", fit: ["green", "workaholic"] },
    warp_core_breach: { name: "Warp Core Breach Drill", sub: "engineering sim", fr: 20, min: 20, kind: "drill", skill: "engineering", xp: 40, buff: "sharp", fit: ["workaholic"] },
    klingon_calisthenics: { name: "Klingon Calisthenics", sub: "bat'leth forms", fr: 15, min: 15, kind: "solo", skill: "fitness", xp: 40, fit: ["shortfuse"] },
    vulcan_garden: { name: "Vulcan Meditation Garden", sub: "Kolinahr-lite", fr: 15, min: 30, kind: "solo", skill: "composure", xp: 30, fit: ["vulcan", "devout"] },
    dixon_hill: { name: "Dixon Hill", sub: "holonovel, San Francisco 1941", fr: 30, min: 40, kind: "novel", fit: ["holo"] },
    captain_proton: { name: "Captain Proton", sub: "serial, chapter 7 (group)", fr: 45, min: 40, kind: "group", fit: ["butterfly"] },
    vics_lounge: { name: "Vic's Lounge Night", sub: "Las Vegas 1962 (group)", fr: 35, min: 30, kind: "group", fit: ["butterfly", "nightowl"] },
    risa_beach: { name: "Risa Beach", sub: "premium", fr: 120, min: 120, kind: "premium", fit: ["homesick"], gapDays: 5 },
  },
  buffS: 4 * 3600, drilled: 0.05, sharp: 0.08, drilledSys: ["phasers", "loader"],
  groupMax: 4, opinion: 1, groupOpinion: 2, crewCheapFr: 20, crewPerHour: 0.5,
  overuse: { perDay: 2, days: 2 }, nightOwl: 1.25, addict: 1.5, recent: 3,
};
