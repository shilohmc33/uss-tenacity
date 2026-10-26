// Core progression (phase 1 of 4): XP, levels, level effects, repair quality rolls, manual vs automated credit,
// ship's day counter. ALL progression tuning lives in PROG below (one config). Phases 2-4 hang off the stubs at
// the bottom (ranks / relationships / daily rolls / fleet rep / boards / specialisations).
import { hardenBattle } from "./ships.js";
import { hardenNeeds } from "./needs.js";
import { hardenSkills } from "./mood.js";
import { hardenInc } from "./incidents.js";
import { G } from "./state.js";
import { pushMoment } from "./moments.js";   // Bigger wins #11 (moments.js only calls the hoisted addHardener at load)
import { log, toast, fx, cheerful, cheer, cheerToast } from "./bus.js";
import { clamp } from "./util.js";
import { PACE_RT, TRAVEL_SCALE } from "./pacing.js";
import { NODEMAP, HEAD_Y } from "./data.js";
import { CREW_ROSTER, SLOTMAP, START_CREW, LADDERS, DEPTS, SPECIES, POSTINGS, PRONOUNS, pr } from "./roster.js";
import { GIFT } from "./gift-data.js";
import { CABIN_TIERS, CABIN_ORDER, DECOR } from "./cabin-data.js";

export const PROG = {
  // Baseline: tester's design memo (playtest/2026-10-17-design-progression.md), adopted by the manager.
  // ---- XP curve: XP from level L to L+1 = 25 * L^1.5, rounded to 5 (memo §1) ----
  curve: { base: 25, exp: 1.5, round: 5 },
  // ---- XP sources (memo §1 "XP sources"): targets active ~15 XP/min : auto ~6 : offline ~1 ----
  xp: {
    repair: { low: 10, med: 20, crit: 35 },    // MANUAL repair XP by severity at completion
    task: 25,                                  // deck task completed with the bonus (manual)
    stationEvery: 10,                          // station work: 1 XP per 10 s on a working console (active rate)
    chat: 3, chatCooldown: 120,                // a chat (ambient crew, the chair, the bar): 3 XP (+social points in phase 2)
    milestone: { firstRepair: 50, firstTask: 50, firstArrival: 50 },   // one-time session-1 milestones (phase 3: first repair back to 50 so L4 lands ~10 min with rested x1.25)
    rested: { mult: 1.25, first: 900 },        // rested bonus: x1.25 (manager: trimmed from 1.5) live XP in the first 15 min of each session
  },
  // manual (player-directed) vs automated: same actions at 40% XP and 50% rep  =>  manual = 2.5x XP, 2x rep
  manual: { xp: 1.0, rep: 2.0 },
  auto: { xp: 0.7, rep: 1.0 },                 // pt04: live hands-off (app open, idle) raised 0.4 -> 0.7 so automated play lands ~6 XP/min
  // ---- pt04: odd jobs between repairs (js/oddjobs.js): only while the ship is quiet and the player is at the controls ----
  jobs: { enabled: true, firstAt: 60, gap: [60, 100], work: [10, 16], expire: Math.round(150 * TRAVEL_SCALE) /* pass 18: 150 s x TRAVEL_SCALE (walk to the node is inside) */, xp: 17, rep: 1, opinion: 3, requestShare: 0.4 },   // gap: quiet seconds before the next job; work: s at the console; xp: manual XP (x0.7 if the Lt drifts there on his own)
  // ---- repair rewards (moved here from pacing.js) ----
  repairRep: { low: 1, med: 2, crit: 3 },      // x manual.rep / auto.rep
  repairParts: { low: 0, med: 1, crit: 1 },    // salvage after MED / CRIT; +1 on each of the first five repairs
  firstArrival: { rep: 5, parts: 4 },          // T'Ren's commendation + DS9's welcome-aboard crate (memo §1, §5.7)
  // ---- quality check per Lt repair: Standard / Good / Excellent (memo §1) ----
  quality: {
    excellent: { base: 0.10, perLevel: 0.005, capAuto: 0.35, capManual: 0.50, manualBonus: 0.15 },  // manualBonus = the timing tap (hook; flat for now)
    standard: { base: 0.35, perLevel: -0.01, floor: 0.15 },
    marginal: { chance: 0.05, fromDay: 8 },    // AUTO repairs only, never in week 1: re-opens the fault as LOW
    tier: {
      marginal: { xp: 0.5, rep: -9, parts: -9 },
      standard: { xp: 0.8, rep: 0, parts: 0 },
      good: { xp: 1.0, rep: 0, parts: 0 },
      excellent: { xp: 1.5, rep: 1, parts: 0, partsMedCrit: 2 },  // +2 salvage on an Excellent MED / CRIT
    },
  },
  // ---- level effects (per level above 1, capped; memo §1) ----
  effects: {
    repairSpeed: { per: 0.015, cap: 0.40 },
    taskSpeed: { per: 0.015, cap: 0.40 },      // station output (locker, torpedo build, recharge) + deck task progress
    walkSpeed: { per: 0.01, cap: 0.25 },
  },
  // ---- ship's day: 16 h of game time (two 8 h watches; the night crew has the third). Offline catch-up is capped at
  // 8 h per gap, so a regular player (2 x 20 min + two offline stretches) accrues ~16.7 h/real day => ~1 ship's day
  // per real day of play; a week away still only advances 8 h ("roll only on days with play", memo §5.4).
  dayLength: 16 * 3600,
  playDayGapH: 20,                         // pass 06 (f): at least 20 h of real time between two counted play days
  playDayPresentS: 180,                    // pass 07 (1): ... AND ~3 min of PRESENT play (in-session timer, not the device clock) once the day is due
  playDayPerPresentS: 600,                 // pass 08 (1): AND playDays never exceeds 1 + presentTotal / 600 (10 min of real present play per day), so a clock step can't add a day
  // ---- rank track (data-driven; append to extend). guaranteeDay = days of play (real calendar days with a session),
  // null = no safety net (Shiloh: only the first promotion is guaranteed; later ranks come from readiness + call-up);
  // socialFull = average positive crew opinion that counts as full social credit; repFull = lifetime rep earned since
  // the last promotion that counts as full rep credit. Promotion timing is pending Shiloh: one-constant changes here.
  ranks: [
    { id: "ltjg", name: "Lieutenant (junior grade)", short: "Lt jg", addr: "Lieutenant", minLevel: 1 },
    { id: "lt", name: "Lieutenant", short: "Lt", addr: "Lieutenant", minLevel: 8, guaranteeDay: 7, socialFull: 17, repFull: 600 },   // pt04: socialFull 20 -> 17 (readiness 100 ~day 3-4; with the 65% board, Lt lands ~day 4-5)
    { id: "ltcmdr", name: "Lieutenant Commander", short: "Lt Cmdr", addr: "Commander", minLevel: 21, guaranteeDay: null, socialFull: 45, repFull: 2500 },   // pt04: minLevel 18 -> 21 (XP is faster now; Lt Cmdr day 15-18)
    { id: "cmdr", name: "Commander", short: "Cmdr", addr: "Commander", minLevel: 31, guaranteeDay: null, socialFull: 75, repFull: 7000 },   // pt04: minLevel 28 -> 31 (keeps Cmdr around day 40-50)
  ],
  // ---- board readiness (0-100; memo §5.1): 50% performance, 30% social, 20% lifetime rep (+ a slow service bonus) ----
  readiness: {
    perf: 0.5, social: 0.3, rep: 0.2, showAtLevel: 3,
    earlyCall: 0.0005,                         // early call-up chance per ship's day = readiness x 0.05% (3% at 60)
    perfFull: 0.60,                            // performance score that counts as full marks (0.7 x quality + 0.3 x response); pt04: 0.70 -> 0.60
    quality: { marginal: 0, standard: 0.5, good: 0.8, excellent: 1.0 }, ema: 0.08,   // pt04: standard 0.4 -> 0.5, good 0.7 -> 0.8
    respGood: 90, respBad: 900,                // pt04: 60/600 -> 90/900 s (walking from the far deck no longer costs the marks)                // fault age (s) when the Lt starts the repair: <=60 s full marks, >=600 s none
    servicePer: 0.1, serviceCap: 5,            // every repair / deck task / chat: +0.1 readiness, at most +5 per rank
    socialTop: 6,                              // phase 3 (18 crew): social credit = average of your 6 best positive opinions (your circle)
    // a failed board (phase 4) leaves the meter at this fraction of full; nothing in phase 2 (rep losses, a dip in
    // performance) can push it below min(peak this rank, floor) either -- so readiness never resets
    failedBoardFloor: 0.6,
  },
  // ---- random reputation events (rare; good and bad). Rolled once per ship's day and on each Lt repair / deck task.
  // goodShare is the base share of good events, shifted by average crew opinion (+-0.15 at +-100) and performance.
  repEvents: {
    perDay: 0.2, perTask: 0.006, goodShare: 0.65,
    good: [
      { id: "commendation", rep: 25, weight: 2, toast: "Commendation", lines: [
        "Starfleet Command forwards a commendation for the Tenacity's engineering record — with the Lieutenant's name on it.",
        "A commendation from the convoy's lead freighter master: 'Whoever keeps that old ship running, buy them a drink.'"] },
      { id: "improvisation", rep: 12, weight: 3, toast: "Clever improvisation", lines: [
        "The Lieutenant's improvised bypass makes it into the shift notes. Okafor adds it to the standard procedures.",
        "A jury-rigged coupling from the Lieutenant's last repair holds through a power surge. Diallo logs it as 'inelegant but correct'."] },
      { id: "praise", rep: 10, weight: 3, crew: "best", opinion: 1, toast: "Praised to the captain", lines: [
        "{crew} mentions the Lieutenant's work to T'Ren at the morning briefing. T'Ren raises one eyebrow — approval.",
        "{crew} puts in a good word with the captain: 'Reliable. Shows up before the alarm does.'"] },
    ],
    bad: [
      { id: "report", rep: -12, weight: 3, toast: "Bungled report", lines: [
        "The Lieutenant's maintenance report reaches the bridge with the wrong stardates. T'Ren returns it without comment, which is worse.",
        "A transposed figure in the Lieutenant's parts report has DS9 shipping coolant instead of couplings."] },
      { id: "complaint", rep: -15, weight: 2, crew: "worst", opinion: -1, toast: "Departmental complaint", lines: [
        "{crew} files a complaint about the Lieutenant's crews tracking conduit dust through {pos} section.",
        "{crew} complains to the XO that the Lieutenant 'reroutes power like it's his personal property'."] },
      { id: "blamed", rep: -20, weight: 1, toast: "Blamed for a fault", lines: [
        "A fault review lands on the Lieutenant's desk: the last outage is pinned on his repair, fairly or not.",
        "Someone has to take the blame for yesterday's EPS cascade. The duty roster says it's the Lieutenant."] },
    ],
  },
  // ---- relationships (memo §5.6): opinion of the Lt per crew member, -100..100, small capped steps ----
  opinion: {
    start: { tren: 0, okafor: 10, diallo: 5, hale: 0, thelev: 5, tull: 5, mollo: 5, delgado: 5, rhovan: 3 }, startDefault: 0,
    gainMult: 0.4,                             // phase 3: every positive step x0.4 so typical opinions top out ~day 75-90 (was ~45)
    chat: 2,                                   // chatting with them (ambient chat, reporting at the chair)
    task: 2,                                   // a deck task completed in their area
    station: { every: 300, gain: 1 },          // +1 per 5 min of station work in their area
    repair: { excellent: 3, good: 1, standard: 0, marginal: -3 },  // Lt repairs on their systems
    battleRepair: 1,                           // T'Ren: a gate system repaired during battle
    ignored: { after: 300, low: -1, med: -1, crit: -2 },          // a fault in their area left open 5 min while you're on watch
    dayUp: 4, dayDown: 6,                      // per crew member per ship's day: at most +4 / -6 (favours and gifts bypass the daily cap)
    soft: 125,                                 // diminishing returns: gains x (1 - opinion/125) above 0
    labels: [[-60, "Hostile"], [-20, "Cool"], [20, "Neutral"], [50, "Friendly"], [80, "Trusted"], [101, "Devoted"]],
  },
  // ---- phase 3: roster / daily crew roll / fleet reputation / favours (memo §2 "Making deaths fair", §3, §5.4) ----
  roster: {
    maxVisible: 6,                             // crew drawn per deck (incl. T'Ren on the bridge); only the Lt's deck is simulated
    chatEvery: 300,                            // s (ship time) before the same crew member comes over for another chat
    chatGap: 45,                               // s after any crew chat before someone else comes over
    joinRange: 330, introRange: 2000,          // design px: they come over from this far (a newcomer crosses the whole deck to introduce themself)
    speed: 0.056,                              // walk speed (deck fraction / s; option A scale: 0.09 x 0.62)
  },
  crewEvents: {
    // the daily crew roll: once per ship's day, and only on a ship's day that falls on a new day of play (a week away
    // still rolls once). 15% a day for the first 14 days of play (positive results only: friendly transfers and
    // promotions), then 20%. Caps: 1 a day, 2 per 7 days of play.
    baseEarly: 0.15, base: 0.26, earlyDays: 7, perDay: 1, perWeek: 2,   // pt04: base 0.20 -> 0.26 and positive-only window 14 -> 7 days (target ~1.25 events/week after week 1)
    weights: { transfer: 0.6, promotion: 0.4, demotion: 0.1 },   // memo: ~0.6 / 0.4 / 0.1 a week after week 2
    negHalfAt: 40,                             // a demotion is half as likely for crew whose opinion of you is >= +40
    minTenure: 5,                              // days of play aboard before a random transfer can pick them
    introExpire: 3,                            // a newcomer's 'new crewmate' intro waits this many days of play for the Lt, then they just settle in
    replaceAfter: [900, 2400],                 // s (ship time) until the replacement reports aboard
    promoteOpinion: 2,                         // a promoted crew member who likes you (>= +20) credits your example
    // scripted early friendly transfer (memo §1: "so Fleet Reputation has a first contact within the week")
    scripted: { slot: "engineer-2", playDay: 2, posting: "utopia" },
    // (phase 6 moved deaths to PROG.deaths below)
  },
  fleet: {
    perOpinion: 10,                            // a leaver adds +1 Fleet Reputation standing per 10 points of positive opinion
    diplomatic: 2,                             // +2 standing per diplomatic visit (Earth, Vulcan, Qo'noS, Romulus)
    diplomaticEvery: 3,                        // ...credited at most once per 3 days of play (this voyage loop calls at homeworlds many times a day)
    contactMin: 30,                            // an ex-shipmate must think at least this well of you to do you a favour
    newcomer: { perFleetRep: 0.5, max: 15, lineAt: 3 },   // newcomers start neutral + 0.5 per standing (max +15): "heard good things"
    alumPromoteEvery: 20,                      // ex-shipmate officers gain a rank every 20 days of play at their new posting
    perks: {
      // passive perks (working examples): a friendly ex-shipmate's standing does you good without spending anything
      quartermaster: { postings: ["utopia", "ds9ops", "sb375"], min: 30, ds9Every: 10 },   // DS9 pallets every 10 s (was 15)
      goodword: { min: 40, readiness: 2, cap: 6, callup: 0.25, callupCap: 2, careReadyMax: 2, careCallupMax: 0.25 },   // pt07 m7: care-made good words count at 50% and add at most +2 / x1.25             // +2 readiness each (max +6), call-up odds x1.25 each (max x2)
    },
  },
  // favours cost spendable rep (never readiness / lifetime rep). contact = posting that names the favour's contact
  // (any friendly ex-shipmate can pull the strings if nobody is posted there). cd: ship's days; "dock": once per DS9 visit;
  // "rank": once per rank. Crew favours (who = a roster slot) need that crew member aboard and at +10 or better.
  // ---- phase 6: injuries and deaths (js/injuries.js; memo §2 'Making deaths fair'). Times in ship-elapsed seconds. ----
  // ---- Personal Log phase 1 (memo phase A, save v8; js/plog.js). The memo sets no log rates; these are the caps ----
  plog: {
    hist: 5,            // "What moved it": last N reasons per crewmate (consecutive same reasons merge, ×n)
    perCrew: 20,        // journal entries kept per crewmate (oldest of theirs dropped first) — also the page's display cap
    journal: 360,       // journal entries kept in total (18 pages x perCrew); over a cap, the oldest ROUTINE entry goes first
    seed: 60,           // v7 -> v8: entries seeded from crew.log (its own cap is 60)
    snaps: 8,           // daily opinion snapshots kept (trend arrow)
    trendDays: 7,       // trend = opinion now vs. the snapshot this many ship's days ago (or the oldest one)
    trendDead: 1.5,     // |change| below this shows as steady
    routine: ["chat", "oddjob"],   // everyday entries: throttled per crewmate and evicted before real events (transfers, sickbay...)
    routineEvery: 3,    // at most one routine entry per crewmate per this many ship's days (sim v1 without it: ~96 entries/week, mostly chats + odd jobs)
  },
  // ---- Personal Log phase 2: gifts (memo §2 tiers and caps exactly; save v9 = the memo's v8; js/gifts.js, js/gift-data.js) ----
  gifts: {
    tiers: {   // price in rations, base opinion (effective = base x gainMult 0.4 x soft cap, through nudge(raw))
      token: { name: "Token", cost: 10, base: 2, loved: false, src: "galley" },
      thoughtful: { name: "Thoughtful", cost: 30, base: 4, loved: true, src: "galley" },
      personal: { name: "Personal", cost: 75, base: 7, loved: true, src: "promenade" },   // DS9 Promenade, while docked
      treasured: { name: "Treasured", cost: 180, base: 12, loved: true, src: "homeworld", minRank: 1 },   // Lt+, at the item's homeworld
    },
    care: { cost: 60, base: 5, max: 10 },   // care package to an ex-shipmate: +10 opinion in total at most; Fleet Reputation already banked is unchanged
    liked: 1.5, loved: 2, disliked: -4,     // loved = the exact liked item, already fully known (Token has no loved column)
    cap: 70,                                // gifts can't push opinion above +70 (Devoted has to be earned)
    cooldown: 2,                            // one gift per person per 2 ship's days
    sameItem: [1, 0.5, 0.25],               // the same item to the same person: x0.5 the 2nd time, x0.25 after that
    shipFull: 3, shipAfter: 0.5,            // ship-wide: the first 3 gifts each ship's day at full value, then x0.5
    occasion: 1.5, promoDays: 3, year: 60, homesickDays: 3, homesickEvery: 15,   // pt07 m3: homesick = a 3-day spell every 15 ship's days (seeded), not forever
     // x1.5 on a birthday (seeded per save; one every `year` ship's days), within 3 ship's days of their promotion, or homesick
    invMax: 6,                              // gift locker: Personal / Treasured items bought ashore, given later
    readinessShare: 0.5,                    // the gift-driven part of an opinion counts at 50% in the top-6 social average
    fleetShare: 0.5,                        // ... and at 50% in the Fleet Reputation banked on a transfer
  },
  // Personal Log phase 3 (memo §4 "Intelligence and hints", player-facing name INSIGHT per Shiloh; save v11 = the memo's v9).
  // Insight XP -> levels 0-10. It never touches readiness, promotion or opinion pacing directly (the memo gives it no such link).
  insight: {
    enabled: true,
    levels: [10, 25, 45, 70, 100, 140, 190, 250, 320, 400],   // memo thresholds (XP to reach Insight 1..10)
    xp: { chat: 1, chatEmpath: 2, gift: 2, firstReaction: 3, per5Levels: 5, decorDay: 1 },   // memo table
    // sim tuning (shots/plog3-sim.txt): the memo's pace (Insight 3 by day 3, 5 ~day 8, 8 ~day 20, 10 ~day 30) assumes ~10 chats
    // and ~1 gift a day. The regular sim player chats ~12x and gives ~3.7 gifts a day and hit Insight 10 on day 14, so XP from
    // chats and gifts is capped per ship's day (first reactions, levels and decor are not).
    dayCap: { chat: 8, gift: 2 },            // XP a ship's day: chats (empath chats count 2), gifts (= the first gift of the day)
    empaths: ["rhovan", "delgado"], empathSpecies: ["betazoid"],   // memo: Rhovan (Betazoid empath) and Delgado (gossip hub) chats +2; judgment: generated Betazoids too
    decor: ["chess", "holoLib"],             // memo: 3-D chess set / holo-novel library placed: +1 a day each
    hint: { base: 0.04, per: 0.03, fullPer: 0.10, upgradeAt: 8 },   // per chat with hidden tastes: 4% + 3% x Insight; full = Insight x 10%; Insight 8+ upgrades a partial
    numbersAt: 3,                            // memo §1: the opinion number is shown at Insight 3+
    beat: { chance: 0.18, perDay: 2, expire: 240, warnBase: 0.20, warnPer: 0.06, warnMax: 0.80, good: 1, misstep: -2, apology: 2, apologyDays: 2 },   // chat-choice beats with the ⚠ warning; misstep -2 raw; an apology (from the next ship's day, for 2 days) gives back what the misstep cost, up to 2
    notes: 16,                               // remembered insights (Insight page)
  },
  // Personal Log phase 4: ROMANCE (memo §5; save v12 = the memo's "v10"). Opt-in (asked once when the log first opens), any gender,
  // everyone except T'Ren and Okafor, per-crew Friends only, the crewmate signals first, declining costs nothing. PG, fade to black.
  romance: {
    excluded: ["tren", "okafor"],            // the CO and the Lt's direct superior / board chair (Shiloh)
    signalAt: 45, moments: 3,                // pass 11 PACING: 45 (was Trusted +50; casual players met it ~day 47) and 3 shared moments (chats max 1 a ship's day each, dinners, a well-received gift)
    signalChance: 0.3, signalGap: 5,         // per qualifying chat; at least 5 ship's days between signals (any crewmate)
    dateEvery: 2, dateOpinion: 2,            // one date per 2 ship's days; +2 raw (gainMult and the soft cap still apply)
    dateCost: { dinner: 40, holosuite: 30, promenade: 0 },   // rations (replicator dinner / holosuite time); the Promenade walk is free (docked at DS9)
    journalEvery: 5,                         // pass 11 m1: evenings get a journal line on the 1st, on a stage change and every 5th
    courtAt: 2, togetherAt: 5, togetherDays: 5,   // Interested -> Courting after 2 dates; -> Together after 5 dates and 5 ship's days of courting
    // anti-farm: a partner's opinion counts at most at friendship level (+50) in readiness social credit and in the Fleet Rep banked
    // on a transfer; once the Lt outranks the partner as Lt Cmdr (station authority, memo "chain of command") it counts 0 for readiness
    friendCap: 50, authorityRank: 2,
    endOpinion: -3, endBelow: 20,            // a gentle ending: -3 (normal nudge, daily cap); the partner ends it below +20
    protectDays: 14,                         // no random transfer for 14 ship's days after it starts (memo)
    letterEvery: 3, letterMiss: 2, letterGain: 1, letters: 24,   // long-distance thread after a transfer / evacuation: a letter every ~3 play days; 2 unanswered = it ends warmly
    griefDays: 14, quietAfterEnd: 14,        // pass 11 m4: quietAfterEnd is global too (r.lastEnd): no new signal from anyone for 14 days after any ending        // after a partner is lost: no romance prompts for 14 ship's days; after an ending, that crewmate waits 14 days
  },
  deaths: {
    enabled: true,                           // retune v2 (Shiloh): ON by default; Gentle mode (CREW > Crew safety) is the opt-out. false = no injuries, no deaths, no safety UI
    noDeathsBefore: 14, minRank: 1,          // memo: never before day 14 of play or before the player is a Lt
    gap: 21,                                 // memo: at most 1 death per 21 days of play (and inside PROG.crewEvents caps)
    minPresentH: 3, gapPresentH: 3,          // pass 07 (1) defence in depth: deaths also need 3 h of PRESENT play in total and 3 h since the last death
    presentPerDayEst: 1200,                  //   (in-session timer; a stepped device clock can't fake it). v13 migration estimate: 20 min per past play day
    protectFavourites: 2,                    // the 2 regulars with the highest opinion (or the player's 2 pins) can't die
    gentle: false,                           // default for gentle mode (player setting G.prog.med.gentle overrides)
    injury: {
      battleHit: 0.12, perBattle: 1,         // chance per hull hit (shields down) to injure someone; at most 1 per battle
      hazard: 0.40, hazardBonusMult: 0.4,   // pass 07 tune: was 0.30 (the fast-fix loss fell from ~32% to ~12%, so exposure rises to keep ~1 loss / 4 months)
         // per hazard event (ion storm shear, hulk intruder); x0.4 if the Lt rode it out at the core
      maxOpen: 2, perPlayDay: 2,             // at most 2 in sickbay at once, 2 new injuries per day of play
      deckWeight: 3,                         // crew on the deck that was hit are 3x as likely to be the one hurt
      never: ["co"], seniorMinorOnly: true,  // T'Ren is never hurt; Okafor, Diallo, Hale only ever minor injuries
    },
    serious: { battleCrit: 0.9, battle: 0.45, hazard: 0.85 },   // pass 07 tune (was 0.8 / 0.3 / 0.65);   // serious share (retune v2: 0.6 / 0.15 / 0.45 -> 0.8 / 0.3 / 0.65; phase 6 final was 0.45 / 0 / 0.30 -> 1.2 serious/month and no deaths in 120 days); only serious can end in a death, and battle deaths still need a CRITICAL fault open (memo)
    linkSystems: ["coolant", "eps"],         // a serious injury needs this system (or the fault the hit opened) stable
    window: 180 * TRAVEL_SCALE,              // pass 06: warning window = 180 s of PRESENT time (was 120 s of 'seen' time); pass 17 P2: x TRAVEL_SCALE (279 s) for the slower walk
    returnFloor: 30 * TRAVEL_SCALE,   // pass 17 P2: x TRAVEL_SCALE (46.5 s);                       // pass 08 (3) + pass 10 (1): back from AWAY with the system still down: the clock is at least min(clock at leave, 30 s), once per injury - never more than you left with; re-tap still needed
    presentIdle: 60,                         // pass 06: 'present' = app visible, not offline, and input within the last 60 s; the clock only runs then
    offlineMinSeen: 60,                      // (legacy, unused since pass 06: nothing about an injury ever runs while away)
    heal: { minor: [7200, 14400], serious: [21600, 36000], pulled: [36000, 57600] },
    deathChance: 1.0, visitMult: 0.6, excellentMult: 0.85, excellentMax: 3, epsOpenMult: 1.25, maxChance: 1.0,   // retune v2 (Shiloh: ~1 death / 4 months, regular): was 0.6 / 0.5 / 0.8
    crewStabilise: 1.0,                      // pass 06: ALWAYS. Offline / away the night crew + doctor stabilise every patient (no roll, no death); retune v2's 0.0 is what broke the safeguard
    // pass 06 RATE: a live outcome roll the player watches. When a serious patient's system is restored while the player is
    // present, Dr. Orvin operates (a short sickbay scene, 'scene' s of present time); a small chance she can't save them.
    // Fast repairs (inside 'fastS' s of the alert being seen), Excellent repairs and a sickbay visit lower it.
    // Every death safeguard still applies at the moment of the outcome (day 14 / Lt, gap, caps, favourites, gentle, seniors, protected, battle = critical fault).
    // pass 07 (4): base 0.30 x fast-fix 0.4 (~12% after a fast fix, ~9% if the Lt also assists); a crew fix or a slow fix
    // ~30% ('touch and go'); EPS open too ~38% ('grim'). Odds shown as a band: <= bands.good / <= bands.touch / above.
    // pass 08 (4): the fast-fix bonus is smooth, not one step at 60 s: the full x0.4 up to fastFullS (20 s: the 12-16 s
    // walk + lift + repair plus a reaction, so a prompt fix still lands at the 12% target), then easing linearly to x1.0 at
    // fastEndS (90 s). fastS (60) only labels a fix as 'fast' in the text.
    surgery: { scene: 8, chance: 0.30, fastS: 60 * TRAVEL_SCALE, fastMult: 0.4, fastFullS: 20 * TRAVEL_SCALE, fastEndS: 90 * TRAVEL_SCALE,   /* pass 17 P2: the fast-fix bands x TRAVEL_SCALE (93 / 31 / 139.5 s) */ excellentMult: 0.7, excellentMax: 2, visitMult: 0.7, epsOpenMult: 1.25, max: 0.55, assistMult: 0.75, bands: { good: 0.15, touch: 0.35 } },   // v3 sim (21 runs each): 0.2 -> regular p50 0 mean 0.57; 0.35 -> p50 0 mean 0.67 (11/21 zero); 0.5 -> regular p50 1 mean 1.05, casual p50 0 mean 0.48 (shipped)
    hush: 600,                               // pass 06 m1: ~10 min of ship time after a death: no cheerful ambient lines, no floaters
    memorialDelay: 600,                      // ... and the Mess & Bar service waits at least this long after the death
    gentlePromptAt: 12,                      // pass 06 m5: one-time Crew safety prompt from play day 12 (deaths are possible from day 14)
    alert: { vibrate: [220, 90, 220], tone: true },   // pass 06 (d): medical alert haptics + a short tone where the device allows it
    savedOpinion: 10, visitOpinion: 3,       // saving them is a flat opinion jump (+10, no soft cap); a sickbay visit helps a little
    replaceAfter: [21600, 36000],            // a transfer-in replacement arrives 6-10 h of ship time later
    memorialDays: 3, memorialOpinion: 4, memorialFriendAt: 30,   // service at the Mess & Bar: friends = same department or opinion >= 30
    fleetRep: 0,                             // judgment: a death never converts opinion into Fleet Reputation
  },
  favours: [
    { id: "shipment", name: "Parts shipment", contact: "utopia", fr: 5, cost: { rep: 40 }, cd: 1, desc: "up to +6 parts at the next DS9 dock (charged per part)" },
    { id: "dock", name: "Priority dock slot", contact: "ds9ops", fr: 12, cost: { rep: 50 }, cd: "dock", desc: "DS9 resupply twice as fast next dock" },
    { id: "intel", name: "Intel tip", contact: "intel", fr: 18, cost: { rep: 60 }, cd: 2, desc: "next battle starts pre-scanned" },
    { id: "ordnance", name: "Klingon ordnance swap", contact: "qonos", fr: 22, cost: { rep: 50 }, cd: 2, desc: "+2 torpedoes now (25 rep each)" },
    { id: "calibration", name: "Vulcan calibration notes", contact: "vsa", fr: 28, cost: { rep: 70 }, cd: 3, desc: "+10% Excellent chance for 24 h" },
    { id: "letter", name: "Letter of recommendation", contact: null, fr: 35, cost: { rep: 120 }, cd: "rank", needRank: 3, desc: "+20 board readiness" },
    // repeatable late-game rep sink: fund an Academy scholarship in the Tenacity's name -> +1 Fleet Reputation (standing
    // never drops; at most maxTimes sponsorships, one per cd ship's days). Contact: your friendliest ex-shipmate.
    { id: "cadet", name: "Sponsor an Academy cadet", contact: null, fr: 40, cost: { rep: 600 }, cd: 5, fleet: 1, maxTimes: 20, desc: "+1 Fleet Reputation (a scholarship in the Tenacity's name)" },
    { id: "ear", name: "Captain's ear", contact: "ship", fr: 50, cost: { rep: 150 }, cd: 7, stub: true, desc: "suggest T'Ren's next destination (away-mission phase)" },
    // crew favours aboard (rep sinks from day 1)
    { id: "round", name: "Stand the mess a round", who: "steward", cost: { rep: 25 }, cd: 2, opinion: 2, desc: "+1 opinion with everyone aboard" },
    { id: "dcteam", name: "Borrow a damage-control team", who: "chief-engineer", cost: { rep: 30 }, cd: 0, dur: 900, repair: 0.3, desc: "your repairs +30% faster for 15 min" },
  ],
  favourFx: { shipmentParts: 6, shipmentMin: 2,   // shipment: delivers min(6, locker room) at 40 rep x n/6; refused below 2 spaces (pt04 m3)
     dockMult: 0.5, ordnance: 2, calibration: 0.10, calibrationDur: 24 * 3600, letter: 20 },
  // ---- rep sinks: locker expansion requisition (memo §3: 150 rep, parts cap 20 -> 25 -> 30). Spending never lowers
  // lifetime rep (readiness uses lifetime). Quarters / favours come in phase 3.
  sinks: {
    locker: [{ rep: 150, cap: 25 }, { rep: 300, cap: 30 }],
    // phase 3 parts sinks (the cabin / quarters upgrades and Federation Rations come in phase 4)
    overhaul: { parts: 4, delay: 300, cd: 1800, opinion: 1 },   // preventive overhaul: next ambient fault 5 min later, Okafor +1
    casing: { parts: 3, torps: 1 },                              // hand-built torpedo casing: 3 parts -> +1 torpedo
    kit: { parts: 2, opinion: 4, perDay: 1, max: 2 },            // a crewmate's personal kit needs fixing: 2 parts -> +4 opinion
  },
  // ---- phase 4: currency. The display name is config (alternative: "Requisition Credits"). Held in the generic wallet
  // under the key "rations"; separate from Reputation, which stays the standing stat for promotion.
  currency: { name: "Federation Rations", short: "RATIONS", hud: "FR", unit: "rations", icon: "◈", alt: "Requisition Credits (hud CR)" },   // Shiloh: "Federation Rations" / FR (Fleet Reputation is never abbreviated FR in player-facing text: "Fleet Reputation" / "Fleet Rep")
  // ---- latinum (Ferengi gold-pressed latinum): PREP ONLY for later phases (Ferengi trader, black market). It has a wallet key
  // and a save field (v6, starts at 0) but is hidden from the HUD and NOTHING earns or spends it yet. ----
  latinum: { name: "Gold-pressed latinum", short: "LATINUM", unit: "bars", icon: "◆", start: 0, hidden: true },
  rations: {
    start: 20,
    repair: { marginal: 1, standard: 2, good: 3, excellent: 5 },   // per repair, by quality
    autoMult: 0.5,                             // repairs the Lt does on his own initiative (hands-off) pay half
    task: 4,                                   // a deck task completed
    chat: 1, chatPerDay: 12,                   // a chat (cap per ship's day)
    shift: 15,                                 // a ship's day (shift) completed -- also while away
    trade: { parts: 5, rations: 2, perDay: 120 },   // trade-in: spares -> rations at a deliberately poor rate; the quartermaster takes at most 120 parts per ship's day
                                               // (uncapped, DS9/Earth pallets refilling the locker would turn into an endless ration tap)
  },
  // ---- phase 4: the Lt's Quarters (CABIN_TIERS / DECOR_ITEMS live in js/cabin-data.js) ----
  cabin: {
    floorSlotTap: 18,                                  // pt04 m5: screen-px tap radius for a placed item on walkable floor (elsewhere on the floor = walk)
    caps: { comfort: 0.60, social: 0.08, readiness: 4 },   // decor bonus totals (placed items only)
    rest: { ltjg: 7, lt: 8.5, ltcmdr: 10, cmdr: 11 },  // energy/s on his own rack, x (1 + comfort). Biobed 10, berthing bunk 6.5, mess 5
    refreshed: { at: 95, dur: 1200, drain: 0.8 },      // slept in his own rack to 95%+: energy drains x0.8 for 20 min x (1 + comfort)
    dinner: { cost: { rations: 150 }, cd: 3, guests: 3, opinion: 4, minRank: 1, noSeniors: true, sellBack: false },   // gifts phase (memo §2): opinion 2 -> 4 to stay competitive with gifts. repeatable rations sink: host the 3 crew who like you least (Lt+; every 3 ship's days)
    restOffline: false,                        // (future) let offline rest use the cabin rate
  },
  // ---- phase 5: promotion boards. Near a rank threshold (readiness 100, early call-up or the Lt guarantee) the board sits
  // instead of a silent promotion: Okafor chairs the engineering-track boards, T'Ren the command one. The board never
  // resolves while you're away: it waits (queued) and opens when you're back. Odds come from readiness:
  //   pass = clamp(pass100 - (100 - readiness) x perPoint, passMin, pass100); of the rest, deferShare defer, the remainder fail.
  boards: {
    chairs: { lt: "okafor", ltcmdr: "okafor", cmdr: "tren" },
    odds: { pass100: 0.65, perPoint: 0.0125, passMin: 0.10, deferShare: 0.6 },   // 100: 65% · 90: 53% · 80: 40% · 70: 28% · 60: 15% · min 10%
    failCd: 4, deferCd: 2,                     // ship's days before the next board may sit (the Lt guarantee ignores both)
    failMalusDecay: 8,                         // a fail drops readiness to readiness.failedBoardFloor; the penalty fades 8 points / ship's day
    waitInBattle: true,                        // the board waits for the all-clear before it opens
  },
  // ---- phase 5: specialisations. At each level in `picks` the Lt picks a focus (tier 1) or upgrades one he has (up to
  // maxTier). A focus speeds the Lt's repairs on its systems and nudges Excellent odds there. Damage Control also helps
  // a little with any repair at red alert (battleAll x its bonus). Data-driven: add a focus / tier / pick level here.
  specs: {
    picks: [10, 20, 30],
    maxTier: 2,
    tiers: [{ speed: 0.20, quality: 0.03 }, { speed: 0.40, quality: 0.06 }],   // tier 1, tier 2 (cumulative, not additive)
    focus: {
      warp: { name: "Warp Systems", icon: "⚛", systems: ["warpcore", "eps", "coolant"], desc: "warp core, EPS conduits, coolant lines" },
      weapons: { name: "Weapons", icon: "◎", systems: ["phasers", "loader"], desc: "torpedo launcher and loader" },
      damage: { name: "Damage Control", icon: "✚", systems: ["shields", "transporter"], battleAll: 0.5, desc: "shield generator, transporter; half the bonus on any repair at red alert" },
    },
  },

};

export const LEVEL_LINES = [
  "The Lieutenant's hands know this ship a little better now.",
  "Okafor notices the Lieutenant reaching for the right tool before she names it.",
  "T'Ren adds a line to the duty roster: the Lieutenant is getting quick.",
];
export const QUALITY_LINES = {
  marginal: [
    "It holds — barely. Okafor flags the junction: it will need doing again.",
    "A marginal job. The readings flicker back toward amber within the hour.",
  ],
  standard: [
    "It holds. Standard work — Okafor initials the job card without looking up.",
    "Functional, if not pretty. The readings settle.",
    "Back in tolerance. Okafor: 'It'll do, Lieutenant.'",
  ],
  good: [
    "Clean work, by the book.",
    "Tolerances nominal. Okafor gives a short nod.",
    "Solid repair — the deck hums properly again.",
  ],
  excellent: [
    "Okafor: 'Textbook. Better than textbook — that one goes in my training file.'",
    "Okafor: 'She's running sweeter than when she left the yard. Nice hands, Lieutenant.'",
    "Okafor: 'Diallo says the section reads cleaner than spec. Show-off.'",
  ],
};

export function freshProg() {
  return {
    level: 1, xp: 0,                    // xp = progress inside the current level
    totalXp: 0, xpManual: 0, xpAuto: 0, xpOffline: 0,   // lifetime split
    quality: { marginal: 0, standard: 0, good: 0, excellent: 0 },
    qByLevel: {},                       // level -> [marginal, standard, good, excellent] (pacing analysis)
    stationAcc: 0, chatT: -1e9,
    milestones: {},                     // one-time session-1 milestones (firstRepair, firstTask, firstArrival)
    repLifetime: 0, repSeen: null,      // lifetime rep EARNED (spending never lowers it; feeds phase-2 readiness)
    needs: {},                          // v15 crew needs (needs.js), keyed by occupant id
    skills: {}, moodInc: { last: -1e9, n: 0 }, inc: { lastMed: -1e12, lastMaj: -1e12, n: { medium: 0, major: 0, helped: 0 } },   // N2: skills XP (mood.js) per occupant + "lt"; minor-incident cap
    day: 1, dayT: 0,                    // ship's day counter (phase 2-3 daily rolls hang off onNewDay)
    playDays: 0, lastPlayDate: null, lastPlayAt: null, dayPresent: 0, presentTotal: 0,   // pass 07: dayPresent = present s since the day became due    // real calendar days with play (memo: scale rolls / guarantees by days of play)
    rank: 0,                            // index into PROG.ranks
    readiness: 0, readyParts: { perf: 0, social: 0, rep: 0, service: 0 },   // board-readiness meter (0-100) + components
    promo: { pending: false },          // a promotion handed to hooks.promotionDue (phase-4 board) and not yet applied
    perf: { q: 0.5, resp: 0.5, n: 0 },  // performance EMAs: repair quality score, response-time score
    service: 0,                         // slow readiness bonus from every repair / task / chat (capped per rank)
    rankSince: { rep: 0, lost: 0, day: 1, playDays: 0 },  // baseline at the last promotion
    history: [],                        // promotions: { rank, day, playDays, level, reason }
    social: 0, opinions: {}, opDay: {}, opStation: {},  // relationships: opinion -100..100 per crew id, daily caps, station time
    lockerTier: 0,                      // locker expansion requisitions bought
    repLost: 0, readyPeak: 0,           // rep lost to bad events (counts against readiness); readiness peak this rank (floor)
    repEv: { good: 0, bad: 0, net: 0 }, // random reputation events tally
    fleetRep: 0, alumni: [],            // phase 3: transferred crew carry their opinion into the fleet (standing never drops)
    crew: freshCrew(),                  // phase 3: roster slots -> occupants, pending arrivals, daily-roll bookkeeping
    fav: { cd: {}, used: {}, fx: {} },  // phase 3: favour cooldowns (ship's day / dock count / rank) and active effects
    readyBonus: 0,                      // phase 3: readiness from a letter of recommendation (cleared on promotion)
    requests: [], reqDay: 0,            // phase 3: crewmates' kit repairs (parts sink)
    sinks: { overhaulAt: -1e9, spent: { rep: 0, parts: 0 }, n: {} },   // phase 3: sink bookkeeping (sim + report)
    upkeep: { order: null, n: 0 },   // v18 D: the Lt's ordered UPKEEP round (upkeep.js); never automatic
    restT: 0,                        // rested window used (s of play, saved): only a real absence (PACE.backAfter) resets it, so a reload never restarts the bonus
    vig: { pt: 0, st: [], w: null, bt: -1e9 },   // Oct 26 fix: the vignette lane (vignettes.js), saved so reloads cannot reset the cap
    away: { d: "", xp: 0 },         // Oct 26 B: away happenings (away.js): the real day and the XP paid on it (cap 40)
    maxSeen: 0,                      // the latest Date.now() ever seen on watch (main.js): absences are measured from it
    lastSeen: 0,                     // v18: real time (ms) the player was last on watch (main.js; the BACK ON WATCH card)
    rations: PROG.rations.start, rationsLife: PROG.rations.start, rationsBy: {}, chatRR: { day: 0, n: 0 },   // phase 4: currency
    cabin: { tier: "ltjg", owned: [], placed: {}, log: [] },   // phase 4: quarters (owned decor ids, slot id -> item id)
    spec: {}, specPicks: 0, specOffered: 0,   // phase 5: focus id -> tier (1..maxTier); picks made; picks the picker has offered
    board: null, boardLog: [], boardCd: 0, boardMalus: 0,   // phase 5: the board in session (queued while away), results, next-board day, failed-board penalty
    latinum: PROG.latinum.start, latinumBy: {},   // v6: hidden prep currency (Ferengi trader later); never earned or spent yet
    plog: freshPlog(),                  // v8 / Personal Log phase 1 (js/plog.js)
    insight: freshInsight(),            // v11 / Personal Log phase 3: Insight (js/insight.js)
    romance: freshRomance(),            // v12 / Personal Log phase 4: romance (js/romance.js)
    gifts: freshGifts(), know: {},      // v9 / Personal Log phase 2: gifts + what the Lt knows of each crewmate's tastes (js/gifts.js)
    med: freshMed(),                    // v7 / phase 6: sickbay (injuries), In Memoriam, gentle mode, pinned favourites (js/injuries.js)
  };
}
// Personal Log (js/plog.js): hist = { id: [{ w: why, d: total delta, day, n }] } ("what moved it"), journal = [{ id, n: name,
// k: kind, d: ship's day, sd: stardate|null, v: variant, x: extra }], snap = [{ day, op: { id: opinion } }] (trend), chat = { id: last routine-entry day }, n = { kind: count }
export function freshPlog() { return { hist: {}, journal: [], snap: [], chat: {}, n: {} }; }   // n: lifetime entries written, by kind (stats)
const plogKinds = ["signal", "accepted", "declined", "date", "together", "disclosure", "parted", "letter", "losttouch", "lostpartner", "hint", "beat", "apology", "gift", "care", "arrival", "promotion", "demotion", "transfer", "death", "injured", "stable", "healed", "visit", "memorial", "chat", "dinner", "kit", "oddjob", "praise", "complaint", "note"];
export function hardenPlog(p) {
  const K = PROG.plog, f = freshPlog(), L = isObj(p.plog) ? p.plog : {};
  const str = (v, n = 80) => typeof v === "string" ? v.slice(0, n) : "";
  const hist = {};
  if (isObj(L.hist)) for (const [id, a] of Object.entries(L.hist)) if (Array.isArray(a) && id.length <= 40) {
    const v = a.filter(e => isObj(e) && typeof e.w === "string" && Number.isFinite(e.d)).slice(-K.hist).map(e => ({ w: str(e.w), d: clamp(e.d, -200, 200), day: Math.max(0, Math.floor(num(e.day, 0))), n: clamp(Math.floor(num(e.n, 1)), 1, 9999) }));
    if (v.length) hist[id] = v;
  }
  const journal = (Array.isArray(L.journal) ? L.journal : []).filter(e => isObj(e) && typeof e.id === "string" && plogKinds.includes(e.k)).slice(-K.journal)
    .map(e => ({ id: str(e.id, 40), n: str(e.n), k: e.k, d: Math.max(0, Math.floor(num(e.d, 0))), sd: Number.isFinite(e.sd) ? e.sd : null, v: Math.max(0, Math.floor(num(e.v, 0))) % 64, x: str(e.x) }));
  const snap = (Array.isArray(L.snap) ? L.snap : []).filter(s => isObj(s) && isObj(s.op) && Number.isFinite(s.day)).slice(-K.snaps)
    .map(s => { const op = {}; for (const [id, v] of Object.entries(s.op)) if (Number.isFinite(v)) op[id] = clamp(Math.round(v), -100, 100); return { day: Math.floor(s.day), op }; });
  const chat = {}; if (isObj(L.chat)) for (const [id, d] of Object.entries(L.chat)) if (Number.isFinite(d)) chat[id] = Math.floor(d);
  const n = {}; if (isObj(L.n)) for (const k of plogKinds) if (Number.isFinite(L.n[k])) n[k] = clamp(Math.floor(L.n[k]), 0, SANE_MAX);
  p.plog = Object.assign(f, { hist, journal, snap, chat, n });
}
// Personal Log phase 2 (v9; memo "v8": gifts { last, count, giftOp }, know { id: { like1, like2, dislike, avoid } }). Here gifts also
// holds day (ship-wide count today), inv (gift locker), care (care-package opinion per alum), lastR (last gift + reaction per person),
// seed (birthdays) and n (lifetime stats). know values: 0 unknown, 1 partial (category), 2 full (the item).
export function freshInsight() { return { xp: 0, lvl: 0, today: { d: -1, chat: 0, gift: 0 }, n: { chat: 0, gift: 0, react: 0, level: 0, decor: 0, hints: 0, full: 0, upgrades: 0, beats: 0, missteps: 0, warned: 0, apologies: 0 }, seen: {}, beat: { day: -1, n: 0, pending: null }, apol: {}, l2: {}, notes: [] }; }
export const insightLevel = xp => { let l = 0; for (const t of PROG.insight.levels) if (xp >= t) l++; return l; };
export function hardenInsight(p) {
  const f = freshInsight(), I = isObj(p.insight) ? p.insight : {}, K = PROG.insight;
  const out = { xp: clamp(num(I.xp, 0), 0, SANE_MAX), n: { ...f.n }, seen: {}, beat: { day: -1, n: 0, pending: null }, apol: {}, l2: {}, notes: [] };
  out.lvl = insightLevel(out.xp);
  out.today = isObj(I.today) ? { d: Math.floor(num(I.today.d, -1)), chat: clamp(num(I.today.chat, 0), 0, K.dayCap.chat), gift: clamp(num(I.today.gift, 0), 0, K.dayCap.gift) } : { ...f.today };
  if (isObj(I.n)) for (const k of Object.keys(f.n)) out.n[k] = clamp(Math.floor(num(I.n[k], 0)), 0, SANE_MAX);
  if (isObj(I.seen)) for (const [id, v] of Object.entries(I.seen)) if (typeof v === "string") out.seen[id] = v.replace(/[^dpcu]/g, "").slice(0, 4);
  if (isObj(I.beat)) { out.beat.day = Math.floor(num(I.beat.day, -1)); out.beat.n = clamp(Math.floor(num(I.beat.n, 0)), 0, K.beat.perDay); const b = I.beat.pending;
    if (isObj(b) && typeof b.id === "string" && p.crew && p.crew.occ[b.id] && Array.isArray(b.order) && b.order.length === 3 && b.order.every(x => [0, 1, 2].includes(x)) && new Set(b.order).size === 3) out.beat.pending = { id: b.id, at: num(b.at, 0), warn: !!b.warn, order: b.order.slice() }; }
  if (isObj(I.apol)) for (const [id, a] of Object.entries(I.apol)) if (p.crew && p.crew.occ[id] && isObj(a) && Number.isFinite(+a.d)) out.apol[id] = { d: Math.floor(+a.d), v: clamp(num(a.v, 0), 0, -K.beat.misstep) };
  if (isObj(I.l2)) for (const [id, v] of Object.entries(I.l2)) if ([0, 1, 2].includes(v)) out.l2[id] = v;
  if (Array.isArray(I.notes)) out.notes = I.notes.filter(x => isObj(x) && typeof x.id === "string" && typeof x.t === "string").slice(-K.notes).map(x => ({ id: x.id, t: x.t.slice(0, 160), d: Math.floor(num(x.d, 0)) }));
  p.insight = out;
  if (isObj(p.know)) for (const k of Object.values(p.know)) if (isObj(k)) k.avoid = clamp(Math.floor(num(k.avoid, 0)), 0, 2);
}
// v10 -> v11: Insight starts at 0. Seeded second likes: anyone whose second like the Lt already learned (gifts phase) keeps it (pool 0)
export function migrateProg11(prog) {
  const p = isObj(prog) ? prog : freshProg(); p.insight = freshInsight();
  if (isObj(p.know)) for (const [id, k] of Object.entries(p.know)) if (isObj(k) && num(k.like2, 0) > 0) p.insight.l2[id] = 0;
  return p;
}
export function freshRomance() { return { opt: null, partner: null, bond: {}, fo: {}, declined: {}, moments: {}, signal: null, disc: null, letters: [], thread: null, grief: null, lastSignal: -99, lastEnd: -99, n: { signals: 0, accepted: 0, declined: 0, dates: 0, together: 0, ended: 0, letters: 0, replies: 0, lost: 0, disclosures: 0 } }; }
const STAGES = ["interested", "courting", "together", "ended", "letters", "lost"];
export function hardenRomance(p) {
  const f = freshRomance(), R = isObj(p.romance) ? p.romance : {}, occ = (p.crew && p.crew.occ) || {}, out = f, K = PROG.romance;
  const arr = v => Array.isArray(v) ? v : [], alum = arr(p.alumni), mem = arr(isObj(p.med) ? p.med.memorial : null);
  const known = id => typeof id === "string" && !!(occ[id] || alum.some(a => a && a.id === id) || mem.some(m => m && m.id === id));
  out.opt = R.opt === true ? true : R.opt === false ? false : null;
  if (isObj(R.n)) for (const k of Object.keys(f.n)) out.n[k] = clamp(Math.floor(num(R.n[k], 0)), 0, SANE_MAX);
  if (isObj(R.bond)) for (const [id, b] of Object.entries(R.bond)) if (known(id) && !K.excluded.includes(id) && isObj(b) && STAGES.includes(b.stage))
    out.bond[id] = { stage: b.stage, since: Math.floor(num(b.since, 0)), dates: clamp(Math.floor(num(b.dates, 0)), 0, 9999), last: Math.floor(num(b.last, -99)), courtAt: Math.floor(num(b.courtAt, -1)), disclosed: ["senior", "outrank"].includes(b.disclosed) ? b.disclosed : null, protectUntil: Math.floor(num(b.protectUntil, 0)) };
  for (const k of ["fo", "declined"]) if (isObj(R[k])) for (const [id, v] of Object.entries(R[k])) if (typeof id === "string" && !K.excluded.includes(id) && v != null && v !== false) out[k][id] = k === "fo" ? true : Math.floor(num(v, 0));
  if (isObj(R.moments)) for (const [id, m] of Object.entries(R.moments)) if (occ[id] && isObj(m)) out.moments[id] = { n: clamp(Math.floor(num(m.n, 0)), 0, 999), last: Math.floor(num(m.last, -1)) };
  // exactly one partner, aboard, at an active stage
  const act = id => out.bond[id] && ["interested", "courting", "together"].includes(out.bond[id].stage);
  out.partner = typeof R.partner === "string" && occ[R.partner] && act(R.partner) ? R.partner : null;
  for (const [id, b] of Object.entries(out.bond)) if (["interested", "courting", "together"].includes(b.stage) && id !== out.partner) b.stage = occ[id] ? "ended" : "letters";
  if (out.partner && out.fo[out.partner]) delete out.fo[out.partner];
  const sg = R.signal; if (out.opt && isObj(sg) && occ[sg.id] && !out.partner && !K.excluded.includes(sg.id) && !out.fo[sg.id]) out.signal = { id: sg.id, day: Math.floor(num(sg.day, 0)), line: typeof sg.line === "string" ? sg.line.slice(0, 300) : "" };
  const dc = R.disc; if (isObj(dc) && dc.id === out.partner && ["senior", "outrank"].includes(dc.kind)) out.disc = { id: dc.id, kind: dc.kind };
  if (Array.isArray(R.letters)) out.letters = R.letters.filter(l => isObj(l) && known(l.id) && typeof l.t === "string" && ["them", "you"].includes(l.from)).slice(-K.letters).map(l => ({ id: l.id, d: Math.floor(num(l.d, 0)), from: l.from, t: l.t.slice(0, 400) }));
  const th = R.thread; if (isObj(th) && typeof th.id === "string" && alum.some(a => a && a.id === th.id)) out.thread = { id: th.id, next: Math.floor(num(th.next, 0)), n: clamp(Math.floor(num(th.n, 0)), 0, 999), waiting: !!th.waiting, miss: clamp(Math.floor(num(th.miss, 0)), 0, K.letterMiss), ended: !!th.ended };
  const gr = R.grief; if (isObj(gr) && typeof gr.id === "string") out.grief = { id: gr.id, until: Math.floor(num(gr.until, 0)) };
  out.lastSignal = Math.floor(num(R.lastSignal, -99)); out.lastEnd = Math.floor(num(R.lastEnd, -99));
  // pass 11 m7: storylines not allowed (null / off / a corrupt value) = no partner, signal, disclosure or open letter thread
  if (out.opt !== true) { out.signal = null; out.disc = null; if (out.partner) { out.bond[out.partner].stage = "ended"; out.partner = null; } if (out.thread) out.thread.ended = true; }
  p.romance = out;
}
// v12 -> v13 (pass 07): present-time play days. The first day after the update must count, so the present-time
// requirement starts already met (the date + 20 h marks still apply; lastPlayAt is never moved to 'now')
export function migrateProg13(prog) {
  const p = isObj(prog) ? prog : freshProg(), pd = Math.max(0, Math.floor(num(p.playDays, 0)));
  p.dayPresent = PROG.playDayPresentS;
  p.presentTotal = pd * PROG.deaths.presentPerDayEst;   // no record of present time before v13: assume a modest 20 min per play day
  if (isObj(p.med) && p.med.lastDeathPD != null) p.med.lastDeathPT = Math.max(0, p.presentTotal - Math.max(0, pd - num(p.med.lastDeathPD, pd)) * PROG.deaths.presentPerDayEst);
  return p;
}
// v11 -> v12: romance starts unasked (opt null = off until the player answers), no bonds. Chain: v11 -> v12 (romance,
// memo 'v10') -> v13 (pass 07 present time); romance was committed (v12) before pass 07 took v13, so no renumbering.
export function migrateProg12(prog) { const p = isObj(prog) ? prog : freshProg(); p.romance = freshRomance(); return p; }
// anti-farm (Shiloh): a partner's opinion never counts above friendship (+50) for readiness or Fleet Rep, and 0 for readiness once
// the Lt holds station authority over the partner (Lt Cmdr, partner not a senior officer: memo "chain of command")
export function romAuthority(id) { const p = P(), o = p.crew && p.crew.occ[id]; return !!o && p.rank >= PROG.romance.authorityRank && !SLOTMAP[o.slot]?.senior; }
export function romanceCap(id, v, kind = "ready") {
  const R = P().romance; if (!R || R.partner !== id) return v;
  if (kind === "ready" && romAuthority(id)) return 0;
  return Math.min(v, PROG.romance.friendCap);
}
export function freshGifts() { return { last: {}, count: {}, giftOp: {}, day: { d: 0, n: 0 }, inv: {}, care: {}, lastR: {}, seed: Math.floor(Math.random() * 1e6), n: { given: 0, spent: 0, care: 0, careSpent: 0, opinion: 0 } }; }
const REACTIONS = ["delighted", "pleased", "polite", "uncomfortable"];
export function hardenGifts(p) {
  const f = freshGifts(), g = isObj(p.gifts) ? p.gifts : {}, idOk = k => typeof k === "string" && k.length <= 40;
  const numMap = (m, lo, hi, intg) => { const o = {}; if (isObj(m)) for (const [k, v] of Object.entries(m)) if (idOk(k) && Number.isFinite(v)) o[k] = clamp(intg ? Math.floor(v) : v, lo, hi); return o; };
  const out = { last: numMap(g.last, -1e6, 1e7, true), giftOp: numMap(g.giftOp, 0, 100), care: numMap(g.care, 0, PROG.gifts.care.max), inv: {}, count: {}, lastR: {},
    day: isObj(g.day) ? { d: Math.floor(num(g.day.d, 0)), n: clamp(Math.floor(num(g.day.n, 0)), 0, 999) } : f.day,
    seed: Number.isFinite(g.seed) ? Math.floor(g.seed) % 1e6 : f.seed, n: Object.assign(f.n, numMap(g.n, 0, SANE_MAX)) };
  let inv = 0; if (isObj(g.inv)) for (const [k, v] of Object.entries(g.inv)) if (GIFT[k] && Number.isFinite(v) && v >= 1) { const c = Math.min(Math.floor(v), PROG.gifts.invMax - inv); if (c > 0) { out.inv[k] = c; inv += c; } }
  if (isObj(g.count)) for (const [id, m] of Object.entries(g.count)) if (idOk(id)) { const c = {}; if (isObj(m)) for (const [k, v] of Object.entries(m)) if (GIFT[k] && Number.isFinite(v)) c[k] = clamp(Math.floor(v), 0, 999); if (Object.keys(c).length) out.count[id] = c; }
  if (isObj(g.lastR)) for (const [id, r] of Object.entries(g.lastR)) if (idOk(id) && isObj(r) && (GIFT[r.item] || r.item === "care") && REACTIONS.includes(r.r)) out.lastR[id] = { item: r.item, r: r.r, day: Math.floor(num(r.day, 0)), d: clamp(num(r.d, 0), -100, 100) };
  for (const [id, v] of Object.entries(out.giftOp)) out.giftOp[id] = Math.min(v, Math.max(0, num((p.opinions || {})[id], 0)));   // the gift share never exceeds the opinion itself
  p.gifts = out;
  const know = {}; if (isObj(p.know)) for (const [id, k] of Object.entries(p.know)) if (idOk(id) && isObj(k)) know[id] = { like1: clamp(Math.floor(num(k.like1, 0)), 0, 2), like2: clamp(Math.floor(num(k.like2, 0)), 0, 2), dislike: num(k.dislike, 0) >= 1 ? 2 : 0, avoid: clamp(Math.floor(num(k.avoid, 0)), 0, 2) };
  p.know = know;
}
// v8 -> v9: gifts. Nothing to infer from older saves: empty gift state, nothing known (the dinner +4 is a tuning change, not save data)
// v9 -> v10 (pass 06): presence-based injury clock + play-day high-water mark. Open warnings restart fresh (180 s of
// present time, unacknowledged); the play-day clock anchors at 'now' (no extra day); the gentle-mode prompt is still owed.
export function migrateProg10(prog) {
  const p = isObj(prog) ? prog : freshProg(), m = isObj(p.med) ? p.med : (p.med = freshMed());
  if (Array.isArray(m.inj)) for (const x of m.inj) if (isObj(x) && x.state === "warning") { x.left = PROG.deaths.window; x.ack = false; x.pendT = 0; x.away = false; }
  m.hushUntil = 0; m.prompt12 = false; m.scene = null;
  p.lastPlayAt = null;   // pass 07 m8: was 'now', which made the first day after the update not count (the date high-water mark still guards)
  return p;
}
export function migrateProg9(prog) { const p = isObj(prog) ? prog : freshProg(); p.gifts = freshGifts(); p.know = {}; return p; }
// v7 -> v8: the log + pronouns. Seed the journal from crew.log (last 60); occupants / alumni / memorial gain a pronoun in hardenCrew
export function migrateProg8(prog) {
  const p = isObj(prog) ? prog : freshProg(), cl = isObj(p.crew) && Array.isArray(p.crew.log) ? p.crew.log : [];
  p.plog = freshPlog();
  for (const e of cl.slice(-PROG.plog.seed)) if (isObj(e) && typeof e.id === "string" && plogKinds.includes(e.kind))
    p.plog.journal.push({ id: e.id, n: typeof e.name === "string" ? e.name : "", k: e.kind, d: Math.max(0, Math.floor(num(e.day, 0))), sd: null, v: 0, x: typeof e.posting === "string" ? e.posting : typeof e.cause === "string" ? e.cause : "" });
  return p;
}
// phase 6 sickbay state (js/injuries.js): open injuries, memorial roll, last death (day of play), gentle-mode setting
// (null = PROG.deaths.gentle default), pinned favourites, the pending Mess & Bar memorial, safeguard audit, tallies
export function freshMed() {
  return { inj: [], memorial: [], lastDeathPD: null, gentle: null, asked: false, pins: [], memPending: null, day: { pd: -1, n: 0 }, audit: [], hushUntil: 0, prompt12: false, scene: null,
    n: { injuries: 0, minor: 0, serious: 0, saved: 0, recovered: 0, pulled: 0, deaths: 0, evac: 0, hospital: 0, offlineInj: 0 } };
}

const P = () => G.prog;
const C = PROG.curve;
export const xpToNext = L => Math.round(C.base * Math.pow(L, C.exp) / C.round) * C.round;
export const xpForLevel = L => { let t = 0; for (let i = 1; i < L; i++) t += xpToNext(i); return t; };   // cumulative to reach L
export const rankName = () => (PROG.ranks[P().rank] || PROG.ranks[0]).name;

// ---- level effects: multipliers, capped ----
const eff = (e, L) => 1 + Math.min(e.cap, e.per * Math.max(0, L - 1));
export const repairMult = sysId => eff(PROG.effects.repairSpeed, P().level) * specMult(sysId) * perkFx.repairSpeed();
export const taskMult = () => eff(PROG.effects.taskSpeed, P().level);
export const walkMult = () => eff(PROG.effects.walkSpeed, P().level);
export function qualityOdds(level, manual = true, day = 1, energy = 100) {
  const q = PROG.quality, Lx = Math.max(0, level - 1);
  let ex = Math.min(manual ? q.excellent.capManual : q.excellent.capAuto, q.excellent.base + q.excellent.perLevel * Lx + (manual ? q.excellent.manualBonus : 0));
  if (energy < 15) ex *= 0.5;                                    // tired hands: half the Excellent chance
  const marginal = !manual && day >= q.marginal.fromDay ? q.marginal.chance : 0;
  const standard = Math.max(q.standard.floor, q.standard.base + q.standard.perLevel * Lx);
  return { marginal, standard, excellent: ex, good: Math.max(0, 1 - marginal - standard - ex) };
}
const TIERS = ["marginal", "standard", "good", "excellent"];
export function rollQuality(level, manual, day, energy, sysId = null) {
  const o = qualityOdds(level, manual, day, energy); let r = Math.random();
  const sq = sysId ? specFx(sysId).quality : 0;   // phase 5: focus nudges Excellent, taken from marginal first, then standard
  if (sq > 0) { let left = sq; for (const t of ["marginal", "standard", "good"]) { const take = Math.min(left, o[t]); o[t] -= take; left -= take; } o.excellent += sq - left; }
  const bx = perkFx.excellent(); if (bx > 0) { const add = Math.min(bx, o.good); o.excellent += add; o.good -= add; }   // Vulcan calibration notes
  for (const t of ["excellent", "marginal", "standard"]) { if (r < o[t]) return t; r -= o[t]; }
  return "good";
}

const HUSH_REPAIR = ["The repair holds. Nobody says much today.", "Clean work. Okafor signs the job card without a word.", "Back in tolerance. The deck is quiet."];
const HUSH_PRAISE = ["{crew} notes the work in the log. Nobody makes a fuss today.", "Word of the fix gets around, quietly."];
// ---- XP: the one entry point. src: "manual" | "auto". Returns XP actually granted. ----
export function awardXP(amount, src = "auto", why = "") {
  const p = P();
  let a = amount;
  if (src !== "away" && src !== "vig" && PACE_RT.sessionT < PROG.xp.rested.first && num(p.restT, 0) < PROG.xp.rested.first) a *= PROG.xp.rested.mult;   // rested bonus (v18: the only reward for time away)
  const xp = Math.max(0, Math.round(a));
  if (!xp) return 0;
  p.xp += xp; p.totalXp += xp;
  if (src === "manual") p.xpManual += xp; else p.xpAuto += xp;
  for (let guard = 0; guard < 50 && p.xp >= xpToNext(p.level); guard++) { p.xp -= xpToNext(p.level); levelUp(); }
  return xp;
}
function levelUp() {
  const p = P(), L = ++p.level;
  const r = Math.round((repairMult() - 1) * 100), w = Math.round((walkMult() - 1) * 100), ex = Math.round(qualityOdds(L, true).excellent * 100);
  log(`Level ${L} — ${LEVEL_LINES[(L - 2) % LEVEL_LINES.length]} (repairs +${r}%, walk +${w}%, excellent ${ex}% on your orders)`, "good");
  cheerToast(`LEVEL UP — Lieutenant reaches level ${L} · repairs +${r}% · excellent ${ex}%`, "good", `Level ${L} · repairs +${r}% · excellent ${ex}%`);   // pass 10 (2): sober in the quiet period
  fx("levelUp", { level: L });   // gold burst + big floater + tile flash: dropped in the quiet period (bus.js CHEER_FX)
  hooks.levelUp.forEach(f => f(L)); pushMoment("levelup", `You reached level ${L}`);
}

// ---- repair outcome (called by crew.finishRepair): quality, XP, rep, parts. Pure numbers + flavour line. ----
export function repairOutcome(sev, manual, energy, sysId = null, resp = 0) {
  const p = P(), Q = PROG.quality, tier = rollQuality(p.level, manual, p.day, energy, sysId), T = Q.tier[tier];
  const m = manual ? PROG.manual : PROG.auto;
  const xp = (PROG.xp.repair[sev] || 10) * m.xp * T.xp;
  const rep = Math.max(0, Math.round((PROG.repairRep[sev] || 1) * m.rep) + T.rep);
  const parts = Math.max(0, (PROG.repairParts[sev] || 0) + T.parts + (sev !== "low" && T.partsMedCrit ? T.partsMedCrit : 0));
  p.quality[tier] = (p.quality[tier] || 0) + 1;
  const row = p.qByLevel[p.level] || (p.qByLevel[p.level] = [0, 0, 0, 0]);
  row[TIERS.indexOf(tier)]++;
  const lines = QUALITY_LINES[tier];
  // phase 2: performance record (quality + response time), opinions of whoever owns the system, service bonus
  const RD = PROG.readiness, a = RD.ema;
  p.perf.q += (RD.quality[tier] - p.perf.q) * a;
  p.perf.resp += (clamp(1 - (resp - RD.respGood) / (RD.respBad - RD.respGood), 0, 1) - p.perf.resp) * a;
  p.perf.n++;
  if (sysId) { p.repBySys = p.repBySys || {}; p.repBySys[sysId] = (p.repBySys[sysId] || 0) + 1; }   // phase 5: Lt repairs per system (spec analysis)
  const dOp = PROG.opinion.repair[tier];
  if (sysId && dOp) for (const c of ownersOf({ sys: sysId })) nudge(c.id, dOp, `${tier} repair|${sysId}`);
  if (sysId && G.sp.battle && tier !== "marginal" && ["warpcore", "shields", "loader", "eps"].includes(sysId)) nudge("tren", PROG.opinion.battleRepair, "battle repair");
  addService();
  hooks.repair.forEach(f => f(tier, sev, manual, sysId));
  const rations = earnRations(PROG.rations.repair[tier] * (manual ? 1 : PROG.rations.autoMult), "repair");
  // pt07 m4: no cheerful quips in the quiet period after a death — a sober line instead (marginal / standard lines are already plain)
  const quiet = !cheerful() && (tier === "good" || tier === "excellent"), qline = quiet ? HUSH_REPAIR[Math.floor(Math.random() * HUSH_REPAIR.length)] : lines[Math.floor(Math.random() * lines.length)];
  return { tier, xp, rep, parts, rations, line: qline.replace(/Lieutenant/g, addr()), reopen: tier === "marginal", src: manual ? "manual" : "auto" };
}
// station work trickle: 1 XP / 10 s at a working console (the sim only runs while he is on watch)
export function tickStationXP(dt) {
  const p = P();
  p.stationAcc += dt / PROG.xp.stationEvery * PROG.manual.xp;
  if (p.stationAcc >= 1) { const n = Math.floor(p.stationAcc); p.stationAcc -= n; awardXP(n, "manual", "station"); }
}
// a chat (ambient crew at the mess/bar, reporting at the chair, a drink at the bar): 3 XP, 2-min cooldown
export function chatXP(who) {
  const p = P(), now = G.ship.elapsed;
  if (now - p.chatT < PROG.xp.chatCooldown) return 0;
  p.chatT = now;
  const xp = awardXP(PROG.xp.chat, "manual", "chat");
  if (crewById(who)) nudge(who, PROG.opinion.chat, "chat");
  if (p.chatRR.day !== p.day) p.chatRR = { day: p.day, n: 0 };
  if (p.chatRR.n < PROG.rations.chatPerDay) { p.chatRR.n++; earnRations(PROG.rations.chat, "chat"); }
  addService();
  hooks.social.forEach(f => f(who));
  return xp;
}
// one-time session-1 milestones (PROG.xp.milestone per id)
export function milestone(id, label) {
  const p = P();
  if (p.milestones[id]) return 0;
  p.milestones[id] = true;
  const xp = awardXP(typeof PROG.xp.milestone === "number" ? PROG.xp.milestone : (PROG.xp.milestone[id] ?? 25), "manual", "milestone");
  log(`Milestone — ${label}: +${xp} XP.`, "good");
  fx("milestone", { text: `${label.toUpperCase()} +${xp} XP` });
  return xp;
}
// ---- lifetime rep + the shift clock (called every sim step). C (v18): the ship's day no longer turns on sim time - it
// turns once per real play day (markPlayDay -> onNewDay), so crew rolls, letters and rep events follow the days he plays.
// dayT still runs (mod PROG.dayLength) for the watch / shift of the day (needs.js shiftNow). ----
export function tickDay(dt) {
  const p = P(), rep = G.sp.rep;
  if (p.repSeen == null) p.repSeen = rep;
  if (rep > p.repSeen) p.repLifetime += rep - p.repSeen;
  p.repSeen = rep;
  p.dayT = (num(p.dayT, 0) + dt) % PROG.dayLength;
}
// real calendar days with play (boot / return from a break)
// pt04 m2: the player's LOCAL calendar date (the UTC date rolled over at 7 PM in Chicago)
export const localDate = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
// pass 06 (f) + pass 07 (1): a play day counts when (a) the local date is LATER than the latest date already counted,
// (b) at least PROG.playDayGapH hours have passed on the device clock since the last counted day, AND (c) the player has
// then been PRESENT for PROG.playDayPresentS s (~3 min, measured by the in-session frame timer, which a clock change
// can't move). Present time only accrues while (a)+(b) already hold, so time banked yesterday never pays for a stepped
// clock today: stepping the clock forward and relaunching adds nothing; each extra day needs ~3 min of real play.
// A stored date or time in the future (wrong phone clock) is pulled back to now when the save LOADS (hardenMed10), so a
// save that once saw the future keeps counting from the next real day (pt07 m6); inside a session the high-water marks
// never move back, so flipping the clock back and forth adds nothing.
export function playDayDue(now = new Date()) {
  const p = P(), d = localDate(now), t = now.getTime();
  if (!Number.isFinite(t)) return false;
  if (p.lastPlayDate && d <= p.lastPlayDate) return false;                                  // backward or the same date
  if (p.lastPlayAt != null && t - p.lastPlayAt < PROG.playDayGapH * 3600e3) return false;   // too soon in real time (or clock moved back)
  return true;
}
// present = seconds of present play while the day was due (defaults to the saved accumulator); tests / sims may pass it
export function markPlayDay(now = new Date(), present = null) {
  const p = P();
  { const ms = +p.maxSeen || 0; if (ms > 0 && now.getTime() > ms + 30 * 864e5) return false; }   /* R2: no play day from a bad clock (clock.js) */
  if (!playDayDue(now)) return false;
  const s = present == null ? num(p.dayPresent, 0) : present;
  if (!(s >= PROG.playDayPresentS)) return false;
  if (p.playDays + 1 > 1 + num(p.presentTotal, 0) / PROG.playDayPerPresentS) return false;   // pass 08 (1): cap by total present time (the day stays due)
  p.lastPlayDate = localDate(now); p.lastPlayAt = now.getTime(); p.playDays++; p.dayPresent = 0;
  p.day++; onNewDay(p.day);   // C (v18): one ship's day per real play day
  return true;
}
// main loop (real seconds, not time-scaled): accrue present time only while a new play day is due; count it at ~3 min
let dueT = 0, dueNow = false;
export function tickPlayDay(dt, present, now = null) {
  const p = P(); if (!p) return false;
  dueT -= dt; if (dueT <= 0) { dueT = 1; dueNow = playDayDue(now || new Date()); }
  if (!dueNow || !present) return false;
  p.dayPresent = num(p.dayPresent, 0) + dt;
  if (p.dayPresent >= PROG.playDayPresentS) { const ok = markPlayDay(now || new Date()); dueT = 0; return ok; }
  return false;
}

// ================= phase 2-4 hooks / stubs =================
export const hooks = { levelUp: [], newDay: [], repair: [], social: [], promotionDue: [], promotionGate: [], promoted: [], repEvent: [], shipHit: [], hazard: [], crewInjured: [], nudged: [] };
function onNewDay(day) {
  const p = P();
  if (Math.random() < PROG.repEvents.perDay) repEvent();
  if (rankEligible() && !p.promo.pending) {   // tiny early call-up chance, scaling with readiness
    const r = computeReadiness();
    if (Math.random() < r * PROG.readiness.earlyCall * perkFx.callup()) promotionDue("callup");
  }
  // phase 2: board-readiness meter update (perf 50% / social 30% / lifetime rep 20%), early call-up chance,
  //          guaranteed board by PROG.ranks[n].guaranteeDay
  // phase 3: daily crew roll (positive-only until day 14; caps in PROG.crewEvents) + fleet rep from alumni
  hooks.newDay.forEach(f => f(day));
  earnRations(PROG.rations.shift, "shift");   // phase 4: a ship's day of service
}
// phase 5: specialisations. specFx(sysId) -> { speed, quality } summed over the Lt's foci (G.sp.battle: Damage Control's battleAll)
export function specFx(sysId) {
  const K = PROG.specs, out = { speed: 0, quality: 0 }, sp = P().spec || {};
  for (const [id, tier] of Object.entries(sp)) {
    const f = K.focus[id], t = K.tiers[Math.min(tier, K.maxTier) - 1]; if (!f || !t) continue;
    const share = sysId && f.systems.includes(sysId) ? 1 : (f.battleAll && G.sp.battle ? f.battleAll : 0);
    out.speed += t.speed * share; out.quality += t.quality * share;
  }
  return out;
}
export function specMult(sysId) {           // chosen focus speeds its repair types
  return 1 + specFx(sysId).speed;
}
export const nextRank = () => PROG.ranks[P().rank + 1] || null;
export const rankEligible = () => { const n = nextRank(); return !!n && P().level >= n.minLevel; };

// ---- save migration (v1 -> v2): retro-credit a veteran save from its lifetime stats so it doesn't restart at L1 ----
export function migrateProg(stats, rep) {
  const p = freshProg(), s = stats || {};
  p.xpManual = Math.round((s.repairs || 0) * PROG.xp.repair.low * 1.5 + (s.events || 0) * 5);
  p.xpOffline = Math.round((s.nightFixes || 0) * 2);
  p.totalXp = p.xpManual + p.xpOffline;
  p.milestones = { firstRepair: (s.repairs || 0) > 0, firstArrival: (s.legs || 0) > 0 };
  p.repLifetime = Math.max(0, rep || 0); p.repSeen = rep || 0;
  let left = p.totalXp;
  while (left >= xpToNext(p.level) && p.level < 200) { left -= xpToNext(p.level); p.level++; }
  p.xp = left;
  return p;
}
// pt04 m1: every load goes through here, so a hand-edited or half-written save can never hang the boot.
// Type-check every top-level field against freshProg (wrong type -> default), clamp ranks/numbers, repair the roster,
// alumni, cabin and opinions. Unknown ids are repaired to safe defaults rather than dropped where that keeps history.
const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v, d, lo = -Infinity, hi = Infinity) => { const n = +v; return Number.isFinite(n) ? clamp(n, lo, hi) : d; };
// recursive type check against a pristine default (objects / arrays / numbers / booleans); unknown extra keys are left alone
function fixTypes(t, ref, depth) {
  if (depth <= 0 || !isObj(t) || !isObj(ref)) return;
  for (const k of Object.keys(ref)) {
    const d = ref[k], v = t[k]; if (v === undefined) { t[k] = d; continue; }
    if (typeof d === "number" && !(typeof v === "number" && Number.isFinite(v))) t[k] = d;
    else if (Array.isArray(d) && !Array.isArray(v)) t[k] = d;
    else if (isObj(d) && !isObj(v)) t[k] = d;
    else if (isObj(d)) fixTypes(v, d, depth - 1);
  }
}
function hardenCrew(p) {
  const fc = freshCrew();
  if (!isObj(p.crew) || !isObj(p.crew.slots) || !isObj(p.crew.occ)) { p.crew = fc; return; }
  const C = p.crew;
  for (const [id, o] of Object.entries(C.occ)) {
    if (!isObj(o) || !SLOTMAP[o.slot] || typeof o.name !== "string") { delete C.occ[id]; continue; }
    o.id = id; if (!SPECIES[o.species]) o.species = "human";
    if (typeof o.short !== "string" || !o.short) o.short = o.name.split(" ").slice(-1)[0] || "Crew";
    const L = LADDERS[SLOTMAP[o.slot].ladder || "officer"]; o.rank = clamp(Math.floor(num(o.rank, 0)), 0, L.length - 1);
    if (!Array.isArray(o.tags)) o.tags = [];
    const sc = START_CREW.find(s => s.id === id);
    if (sc) o.pronoun = sc.pronoun; else if (!PRONOUNS[o.pronoun]) o.pronoun = "they";   // plog phase 1 (v8): the start crew's pronouns are fixed
    o.protected = !!(sc && sc.protected && sc.slot === o.slot);   // pt04 m7 (older saves gain the flag)
    if (o.img != null && !START_CREW.some(s => s.img && s.img === o.img)) o.img = null;   // only portraits that ship with the build
    if (o.color != null && (typeof o.color !== "string" || !/^#[0-9a-f]{3,8}$/i.test(o.color))) o.color = null;
  }
  for (const sl of CREW_ROSTER) { const id = C.slots[sl.slot]; if (id != null && (!C.occ[id] || C.occ[id].slot !== sl.slot)) C.slots[sl.slot] = null; if (!(sl.slot in C.slots)) C.slots[sl.slot] = null; }
  for (const k of Object.keys(C.slots)) if (!SLOTMAP[k]) delete C.slots[k];
  for (const [id, o] of Object.entries(C.occ)) if (C.slots[o.slot] !== id) delete C.occ[id];   // orphans
  // the senior staff are always aboard: restore any missing start-crew senior into an empty slot
  for (const o of START_CREW) if (SLOTMAP[o.slot].senior && !C.slots[o.slot] && !C.occ[o.id]) { C.occ[o.id] = { ...o, tags: [...o.tags], joined: 0, intro: false }; C.slots[o.slot] = o.id; }
  if (!Array.isArray(C.pending)) C.pending = []; C.pending = C.pending.filter(x => isObj(x) && SLOTMAP[x.slot]);
  if (!Array.isArray(C.log)) C.log = []; C.nextId = Math.max(1, Math.floor(num(C.nextId, 1)));
  C.rolls = Object.assign(fc.rolls, isObj(C.rolls) ? C.rolls : {}); if (!Array.isArray(C.rolls.hist)) C.rolls.hist = [];
  C.rolls.n = Object.assign(freshCrew().rolls.n, isObj(C.rolls.n) ? C.rolls.n : {});
}
// pass 05 m1-a: every resource and stat back inside its cap / valid range after a load (a hand-edited save showed
// PARTS 1000000000/30). Caps that the game derives (locker size from the requisition tier, torpedo complement) are
// recomputed rather than trusted; open-ended currencies get a generous sanity ceiling.
export const SANE_MAX = 1e7;
export function addHardener(f) { (addHardener.list = addHardener.list || []).push(f); }   // hoisted: safe to call from any module top level
export function clampResources() {
  const S = G.ship, p = P(), int = (v, lo, hi, d = lo) => clamp(Math.floor(num(v, d)), lo, hi);
  if (!isObj(S)) return;
  const lk = PROG.sinks.locker;
  p.lockerTier = Math.max(int(p.lockerTier, 0, lk.length), lk.findIndex(t => t.cap === S.partsCap) + 1);   // an older save that bought the racks keeps them
  S.partsCap = p.lockerTier ? lk[p.lockerTier - 1].cap : 20;
  S.parts = int(S.parts, 0, S.partsCap);
  S.torpCap = 8; S.torps = int(S.torps, 0, S.torpCap);
  for (const k of ["hull", "power", "shields", "energy", "charge"]) S[k] = num(S[k], 0, 0, 100);
  if (S.faults && S.faults.shields && S.shields > 50) S.shields = 50;   // a shield fault halves capacity
  S.elapsed = Math.max(0, num(S.elapsed, 0)); S.lockerT = Math.max(0, num(S.lockerT, 0));
  if (isObj(G.sp)) G.sp.rep = int(G.sp.rep, 0, SANE_MAX);
  if (G.sp && G.sp.battle) hardenBattle(G.sp);   // battle groundwork: combatant arrays (js/ships.js)
  p.level = int(p.level, 1, 999, 1); p.xp = int(p.xp, 0, Math.max(0, xpToNext(p.level) - 1));
  p.rations = int(p.rations, 0, SANE_MAX); p.rationsLife = int(p.rationsLife, p.rations, 10 * SANE_MAX, p.rations);
  p.repLifetime = Math.max(0, Math.min(10 * SANE_MAX, num(p.repLifetime, 0))); p.repLost = Math.max(0, Math.min(p.repLifetime, num(p.repLost, 0)));
  p.fleetRep = int(p.fleetRep, 0, 100000); p.latinum = int(p.latinum, 0, SANE_MAX);
  p.service = num(p.service, 0, 0, PROG.readiness.serviceCap || 100); p.readyBonus = num(p.readyBonus, 0, 0, 100); p.boardMalus = num(p.boardMalus, 0, 0, 100);
  if (isObj(p.sinks) && isObj(p.sinks.trade)) { const T = PROG.rations.trade; p.sinks.trade.parts = int(p.sinks.trade.parts, 0, T.perDay); p.sinks.trade.auto = int(p.sinks.trade.auto, 0, p.sinks.trade.parts); }
  if (isObj(G.stats)) for (const k of Object.keys(G.stats)) if (typeof G.stats[k] === "number") G.stats[k] = int(G.stats[k], 0, SANE_MAX);
}
export const clampProg = () => {
  if (!isObj(G.prog)) G.prog = freshProg();
  const p = P(), f = freshProg();
  for (const k of Object.keys(f)) {
    const d = f[k], v = p[k];
    if (v === undefined) p[k] = d;
    else if (typeof d === "number" && !(typeof v === "number" && Number.isFinite(v))) p[k] = typeof v === "string" && v.trim() && Number.isFinite(+v) ? +v : d;
    else if (Array.isArray(d) && !Array.isArray(v)) p[k] = d;
    else if (isObj(d) && !isObj(v)) p[k] = d;
    else if (typeof d === "boolean" && typeof v !== "boolean") p[k] = !!v;
  }
  { const ref = freshProg(); delete ref.crew; fixTypes(p, ref, 3); }   // (the roster has its own repair: hardenCrew)
  p.rank = clamp(Math.floor(num(p.rank, 0)), 0, PROG.ranks.length - 1);
  for (const [id, v] of Object.entries(p.opinions)) { const n = +v; if (!Number.isFinite(n)) delete p.opinions[id]; else p.opinions[id] = clamp(n, -100, 100); }
  for (const k of ["opDay", "opStation", "qByLevel", "milestones", "readyParts", "promo", "perf", "rankSince", "repEv"]) if (!isObj(p[k])) p[k] = f[k];
  p.perf = Object.assign(f.perf, p.perf); p.readyParts = Object.assign(f.readyParts, p.readyParts); p.rankSince = Object.assign(f.rankSince, p.rankSince);
  p.readiness = num(p.readiness, 0, 0, 100); p.playDays = Math.max(0, Math.floor(num(p.playDays, 0))); p.day = Math.max(1, Math.floor(num(p.day, 1)));
  p.fleetRep = Math.max(0, num(p.fleetRep, 0)); p.repLifetime = Math.max(0, num(p.repLifetime, 0));
  hardenCrew(p);
  p.quality = Object.assign(f.quality, p.quality);
  p.level = clamp(Math.floor(p.level) || 1, 1, 999); if (!(p.xp >= 0)) p.xp = 0;
  if (!p.crew || !p.crew.slots || !p.crew.occ) p.crew = freshCrew();
  p.crew = Object.assign(freshCrew(), p.crew); p.crew.rolls = Object.assign(freshCrew().rolls, p.crew.rolls);
  p.fav = Object.assign(f.fav, p.fav); p.fav.fx = p.fav.fx || {}; p.sinks = Object.assign(freshProg().sinks, p.sinks);
  if (!Array.isArray(p.alumni)) p.alumni = []; if (!Array.isArray(p.requests)) p.requests = [];
  p.alumni = p.alumni.filter(a => isObj(a) && typeof a.name === "string");
  for (const a of p.alumni) {   // repair rather than drop: unknown posting / species / slot fall back to safe values
    a.tags = Array.isArray(a.tags) ? a.tags.filter(t => typeof t === "string").slice(0, 4) : [];   // v9: tastes of generated alumni
    if (!POSTINGS[a.posting]) a.posting = "sb375"; if (!SPECIES[a.species]) a.species = "human";
    { const sc = START_CREW.find(s => s.id === a.id); if (sc) a.pronoun = sc.pronoun; else if (!PRONOUNS[a.pronoun]) a.pronoun = "they"; }
    if (!SLOTMAP[a.slot]) { a.slot = null; a.ladder = "officer"; } if (!LADDERS[a.ladder]) a.ladder = "officer";
    a.rank = clamp(Math.floor(num(a.rank, 0)), 0, LADDERS[a.ladder].length - 1); a.opinion = num(a.opinion, 0, -100, 100); a.fr = Math.max(0, num(a.fr, 0));
    a.leftPD = Math.max(0, Math.floor(num(a.leftPD, p.playDays))); a.leftDay = Math.max(1, Math.floor(num(a.leftDay, p.day))); if (typeof a.id !== "string") a.id = "alum" + Math.floor(Math.random() * 1e6);
    if (typeof a.short !== "string" || !a.short) a.short = a.name.split(" ").slice(-1)[0];
    if (typeof a.role !== "string") a.role = "crew"; if (!DEPTS[a.dept]) a.dept = Object.keys(DEPTS)[0];
  }
  p.requests = p.requests.filter(r => isObj(r) && p.crew.occ[r.id]);
  p.rations = Math.max(0, +p.rations || 0); p.rationsLife = Math.max(p.rations, +p.rationsLife || 0);
  p.cabin = Object.assign(f.cabin, isObj(p.cabin) ? p.cabin : {}); if (!Array.isArray(p.cabin.owned)) p.cabin.owned = [];
  if (!CABIN_TIERS[p.cabin.tier]) p.cabin.tier = CABIN_ORDER[clamp(p.rank, 0, CABIN_ORDER.length - 1)];   // pt04 m1: unknown tier -> the rank's quarters
  if (!p.cabin.placed || typeof p.cabin.placed !== "object") p.cabin.placed = {}; if (!Array.isArray(p.cabin.log)) p.cabin.log = [];
  p.cabin.owned = [...new Set(p.cabin.owned.filter(id => DECOR[id]))];
  for (const [s, id] of Object.entries(p.cabin.placed)) if (!DECOR[id] || !p.cabin.owned.includes(id)) delete p.cabin.placed[s];
  p.latinum = Math.max(0, +p.latinum || 0);
  if (!p.spec || typeof p.spec !== "object" || Array.isArray(p.spec)) p.spec = {};
  for (const k of Object.keys(p.spec)) if (!PROG.specs.focus[k]) delete p.spec[k]; else p.spec[k] = clamp(p.spec[k] | 0, 1, PROG.specs.maxTier);
  p.specPicks = Math.max(+p.specPicks || 0, 0); if (!Array.isArray(p.boardLog)) p.boardLog = []; p.boardMalus = Math.max(0, +p.boardMalus || 0);
  if (p.board && !PROG.ranks.some(r => r.id === p.board.to)) p.board = null;
  if (p.promo && p.promo.pending && !p.board) p.promo.pending = false;   // a held promotion always has a board behind it
  const fm = freshMed(); p.med = Object.assign(fm, p.med && typeof p.med === "object" ? p.med : {}); p.med.n = Object.assign(freshMed().n, p.med.n);
  for (const k of ["inj", "memorial", "pins", "audit"]) if (!Array.isArray(p.med[k])) p.med[k] = [];
  p.med.memorial = p.med.memorial.filter(isObj); for (const e of p.med.memorial) { const sc = START_CREW.find(s => s.id === e.id); if (sc) e.pronoun = sc.pronoun; else if (!PRONOUNS[e.pronoun]) e.pronoun = "they"; }
  hardenPlog(p);   // v8
  hardenGifts(p);  // v9
  hardenInsight(p);  // v11
  hardenRomance(p);  // v12
  hardenNeeds(p);  // v15 crew needs
  hardenSkills(p);  // N2 skills (additive to v15)
  hardenInc(p);     // N3 incident caps
  for (const f of addHardener.list || []) f(p);   // N4: holodeck, crew care (registered by their modules; no static import, load order)
  if (!p.moodInc || typeof p.moodInc !== "object" || !Number.isFinite(p.moodInc.last)) p.moodInc = { last: -1e9, n: 0 };
  p.med.inj = p.med.inj.filter(x => x && p.crew.occ[x.id] && (x.sev !== "serious" || typeof x.sys === "string"));
  hardenMed10(p);  // v10
};
// pass 06: presence clock fields, surgery state, hush, the one-time prompt, the play-day high-water mark, prog.rep >= 0
function hardenMed10(p) {
  const m = p.med, K = PROG.deaths;
  m.inj = m.inj.filter(x => isObj(x) && ["warning", "surgery", "stable", "recovering"].includes(x.state));
  for (const x of m.inj) {
    const oc = p.crew && p.crew.occ && p.crew.occ[x.id];   // pt07 fuzz: names the scenes print always come from the crewmate
    if (typeof x.short !== "string") x.short = oc && typeof oc.short === "string" ? oc.short : "the patient";
    if (typeof x.name !== "string") x.name = oc ? fullName(oc) : x.short;
    x.left = clamp(num(x.left, K.window), 0, K.window); x.ack = !!x.ack; x.pendT = Math.max(0, num(x.pendT, 0)); x.ackT = Math.max(0, num(x.ackT, 0)); x.acked = !!x.acked || x.ack || x.ackT > 0;   /* pass 09 (2): first-ack flag; older saves: acked if ever acked */ x.away = !!x.away; x.paused = !!x.paused; x.floored = !!x.floored; x.leftAtLeave = Number.isFinite(x.leftAtLeave) ? clamp(x.leftAtLeave, 0, K.window) : null;   /* pass 10 (1): clock at leave, optional */   // pass 08 (3): optional flags, default false (no version bump)
    if (x.state === "surgery") { x.surg = clamp(num(x.surg, K.surgery.scene), 0, K.surgery.scene); x.sx = clamp(num(x.sx, K.surgery.chance), 0, K.surgery.max); x.assist = x.assist === true; x.held = x.held === true; x.fast = x.fast === true; }
    if (x.state !== "warning" && x.state !== "surgery" && x.healAt == null) x.healAt = 0;
    x.src = typeof x.src === "string" ? x.src.slice(0, 32) : "";   // pass 15: death attribution (enemy / hazard kind)
  }
  m.hushUntil = Math.max(0, num(m.hushUntil, 0)); m.prompt12 = !!m.prompt12;
  m.scene = isObj(m.scene) && typeof m.scene.name === "string" && ["surgery", "saved", "lost", "evac", "hospital", "expired", "away"].includes(m.scene.phase) ? m.scene : null;
  if (m.memPending && !isObj(m.memPending)) m.memPending = null;
  if (m.memPending) m.memPending.notBefore = Math.max(0, num(m.memPending.notBefore, 0));
  const t = num(p.lastPlayAt, NaN); p.lastPlayAt = Number.isFinite(t) && t > 0 ? Math.min(t, Date.now()) : null;   // pass 07 m8: junk -> null (the date mark still guards), never 'now'
  if (typeof p.lastPlayDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(p.lastPlayDate)) p.lastPlayDate = null;
  if (p.lastPlayDate && p.lastPlayDate > localDate()) p.lastPlayDate = localDate();   // pass 07 m6: a future date never freezes play days
  p.dayPresent = clamp(num(p.dayPresent, 0), 0, PROG.playDayPresentS);
  p.presentTotal = clamp(num(p.presentTotal, 0), 0, 1e9); if (m.lastDeathPT != null) m.lastDeathPT = clamp(num(m.lastDeathPT, 0), 0, p.presentTotal);
  if ("rep" in p) p.rep = Math.max(0, num(p.rep, 0));   // pass 06 m6 (nit): a stray prog.rep never stays negative
}


// ======================= phase 2: relationships, readiness, rank track, rep sink =======================
export const addr = () => (PROG.ranks[P().rank] || PROG.ranks[0]).addr;
export const rankShort = () => (PROG.ranks[P().rank] || PROG.ranks[0]).short;
// ---- phase 3 roster: occupants in CREW_ROSTER slots (crewlife.js runs the transfers) ----
export function freshCrew() {
  const occ = {}, slots = {};
  for (const sl of CREW_ROSTER) slots[sl.slot] = null;
  for (const o of START_CREW) { occ[o.id] = { ...o, tags: [...o.tags], joined: 0, intro: false }; slots[o.slot] = o.id; }
  return { slots, occ, pending: [], rolls: { lastPD: 0, hist: [], n: { transfer: 0, promotion: 0, demotion: 0, arrival: 0 } }, nextId: 1, scripted: false, log: [], v: 0 };
}
export const rankOf = (o, long = false) => { const sl = SLOTMAP[o.slot], L = LADDERS[(sl && sl.ladder) || "officer"]; const r = L[Math.max(0, Math.min(L.length - 1, o.rank | 0))]; return long ? r[0] : r[1]; };
export const fullName = o => `${rankOf(o)} ${o.name}`;
// crew view used everywhere (opinions, CREW sheet, events): one entry per occupied slot, cached until the roster changes
let _cl = null, _clKey = null;
export function crewList() {
  const C = P().crew; if (!C) return [];
  if (_cl && _clKey === C && _cl.v === C.v) return _cl.list;
  const list = [];
  for (const sl of CREW_ROSTER) {
    const id = C.slots[sl.slot], o = id && C.occ[id]; if (!o) continue;
    const sp = SPECIES[o.species] || SPECIES.human, d = DEPTS[sl.dept];
    list.push({ id: o.id, slot: sl.slot, short: o.short, name: fullName(o), role: sl.role, dept: sl.dept, deck: sl.deck, senior: !!sl.senior,
      species: o.species, speciesName: sp.name, protected: !!o.protected, pronoun: o.pronoun || "they", rank: o.rank, rankShort: rankOf(o), tags: o.tags, img: o.img || null, color: o.color || d.color, intro: !!o.intro, areas: sl.areas, occ: o });
  }
  _cl = { v: C.v, list }; _clKey = C;
  return list;
}
export const crewTouch = () => { const C = P().crew; if (C) C.v = (C.v || 0) + 1; };
export const crewById = id => crewList().find(c => c.id === id) || null;
// passive-perk / favour effects, filled in by crewlife.js (kept as late-bound functions: no import cycle)
export const perkFx = { readiness: () => 0, callup: () => 1, excellent: () => 0, repairSpeed: () => 1 };
// ---- generic wallet (phase 4 adds Federation Rations as another key; latinum is a prepared, unused key): cost = { rep, parts, ... } ----
const WALLET = { rations: { get: () => P().rations, set: v => { P().rations = v; } }, latinum: { get: () => P().latinum || 0, set: v => { P().latinum = v; } }, rep: { get: () => G.sp.rep, set: v => { G.sp.rep = v; P().repSeen = v; } }, parts: { get: () => G.ship.parts, set: v => { G.ship.parts = v; } }, torps: { get: () => G.ship.torps, set: v => { G.ship.torps = v; } } };
export const walletKeys = () => Object.keys(WALLET);
// phase 4: decor bonuses, late-bound by js/cabin.js (progression never imports cabin)
export const cabinFx = { social: () => 0, readiness: () => 0 };
export function earnRations(n, why) {
  const p = P(); n = Math.max(0, Math.round(n)); if (!n) return 0;
  p.rations += n; p.rationsLife += n; p.rationsBy[why] = (p.rationsBy[why] || 0) + n;
  return n;
}
export const balance = k => (WALLET[k] ? WALLET[k].get() : 0);
// generic add (any wallet key). Latinum: prepared for the Ferengi trader / black market; no caller earns it yet.
export function walletAdd(k, n, why = "") {
  if (!WALLET[k] || !(n > 0)) return 0; n = Math.round(n); WALLET[k].set(WALLET[k].get() + n);
  if (k === "latinum") { const p = P(); p.latinumBy = p.latinumBy || {}; if (why) p.latinumBy[why] = (p.latinumBy[why] || 0) + n; }
  return n;
}
export const latinum = { get: () => balance("latinum"), add: (n, why) => walletAdd("latinum", n, why), spend: (n, why) => spend({ latinum: n }, why) };   // hidden; unused until a Ferengi trader exists
export const canAfford = cost => Object.entries(cost || {}).every(([k, v]) => WALLET[k] && WALLET[k].get() >= v);
export function spend(cost, why = "") {   // spending never lowers lifetime rep or readiness
  if (!canAfford(cost)) return false;
  const sp = P().sinks.spent;
  for (const [k, v] of Object.entries(cost)) { WALLET[k].set(WALLET[k].get() - v); sp[k] = (sp[k] || 0) + v; }
  if (why) P().sinks.n[why] = (P().sinks.n[why] || 0) + 1;
  return true;
}
export const costText = cost => Object.entries(cost || {}).map(([k, v]) => `${v} ${k === "rep" ? "REP" : k === "parts" ? "PARTS" : k === "rations" ? PROG.currency.short : k === "latinum" ? PROG.latinum.short : k.toUpperCase()}`).join(" + ");
export function opinionOf(id) {
  const o = P().opinions;
  if (o[id] === undefined) o[id] = PROG.opinion.start[id] ?? PROG.opinion.startDefault;
  return o[id];
}
export const opinionLabel = v => PROG.opinion.labels.find(([t]) => v < t)[1];
// who cares about this place / system (generic: any roster entry whose areas match)
export function ownersOf({ sys, node, deck }) {
  return crewList().filter(c => { const a = c.areas || {}; return (sys && (a.systems || []).includes(sys)) || (node && (a.nodes || []).includes(node)) || (deck && !node && !sys && (a.decks || []).includes(deck)); });
}
// one opinion step: diminishing returns above 0, per-ship's-day caps both ways, clamped to -100..100
export function nudge(id, delta, why = "", raw = false, max = null) {   // raw: favours / gifts (no daily cap; gainMult still applies); max: gifts stop at +70
  const p = P(), O = PROG.opinion;
  if (!delta) return 0;
  const cur = opinionOf(id);
  const dd = p.opDay[id] && p.opDay[id].day === p.day ? p.opDay[id] : (p.opDay[id] = { day: p.day, up: 0, down: 0 });
  let d = delta;
  if (d > 0 && raw) d *= (O.gainMult ?? 1) * Math.max(0.1, 1 - Math.max(0, cur) / O.soft);   // gifts skip the daily cap, not the pace
  else if (d > 0) { d *= (O.gainMult ?? 1) * (1 + cabinFx.social()) * Math.max(0.1, 1 - Math.max(0, cur) / O.soft); d = Math.min(d, O.dayUp - dd.up); if (d <= 0) return 0; dd.up += d; }
  else { d = Math.max(d, -(O.dayDown - dd.down)); if (d >= 0) return 0; dd.down -= d; }
  if (d > 0 && max != null) { d = Math.min(d, max - cur); if (d <= 0) return 0; }
  p.opinions[id] = clamp(cur + d, -100, 100);
  for (const f of hooks.nudged) f(id, d, why);   // plog: "what moved it"
  return d;
}
// gifts phase: the gift-driven part of an opinion (never more than the positive opinion itself); counts 50% toward readiness / Fleet Rep
export const giftShare = id => { const g = P().gifts; return g && g.giftOp[id] ? Math.min(g.giftOp[id], Math.max(0, opinionOf(id))) : 0; };
export function socialPoints() { return Math.round(crewList().reduce((t, c) => t + Math.max(0, opinionOf(c.id)), 0)); }
// social credit: the average of your best PROG.readiness.socialTop positive opinions (18 crew: your circle, not the census)
// romance anti-farm: the partner's OPINION is capped first (+50, or 0 under station authority), then the usual gift discount
// applies to that capped value, exactly as for a friend at +50. (Capping after the discount let opinion above +50 soak up the
// gift discount: up to +1 readiness over the friendship counterfactual, the da943e7 sim finding.)
export const socialCredit = id => { const op = romanceCap(id, Math.max(0, opinionOf(id))); return Math.max(0, op - (1 - PROG.gifts.readinessShare) * Math.min(giftShare(id), op)); };
const avgPositive = () => { const v = crewList().map(c => socialCredit(c.id)).sort((a, b) => b - a).slice(0, PROG.readiness.socialTop || 99); return v.reduce((t, x) => t + x, 0) / Math.max(1, v.length); };
function addService() {
  if (Math.random() < PROG.repEvents.perTask) repEvent(); const p = P(); p.service = Math.min(PROG.readiness.serviceCap, p.service + PROG.readiness.servicePer); }
// deck task done (events.js) -> opinion of the area's owners + service
export function taskDone(node, deck) {
  for (const c of ownersOf({ node })) nudge(c.id, PROG.opinion.task, "deck task");
  if (!ownersOf({ node }).length) for (const c of ownersOf({ deck })) nudge(c.id, PROG.opinion.task, "deck task");
  earnRations(PROG.rations.task, "task");
  addService();
}
// pt04: the weakest readiness component and how to raise it (CREW sheet meter + board card)
export const READY_HINTS = {
  perf: "land Good or Excellent repairs and start on faults quickly (within ~90 s): fix on your own orders, rested, and the odds go up",
  social: "spend time with the crew: chat in the Mess & Bar, take their odd-job requests, host a dinner in your quarters",
  rep: "repairs, deck tasks and odd jobs all earn rep (spending it never lowers this)",
  service: "every repair, deck task, odd job and chat adds a little service credit",
};
// pass 05 m3: the hint names the component in board points AND in the units the player sees elsewhere (rep earned since the
// last promotion, average crew opinion, repair score), with how much more is needed and a concrete action. Always one line.
export function readinessHint() {
  const p = P(), RD = PROG.readiness, rp = p.readyParts || {}, n = nextRank();
  if (!n) return null;
  const parts = [["perf", "Performance", rp.perf || 0, Math.round(RD.perf * 100)], ["social", "Social", rp.social || 0, Math.round(RD.social * 100)], ["rep", "Rep earned this rank", rp.rep || 0, Math.round(RD.rep * 100)]];
  const gaps = parts.map(([k, label, have, max]) => ({ k, label, have, max, miss: max - have, frac: have / max })).filter(x => x.miss > 0).sort((a, b) => a.frac - b.frac || b.miss - a.miss);
  const detail = k => {
    if (k === "rep") { const got = Math.max(0, Math.floor(p.repLifetime - p.rankSince.rep - (p.repLost - (p.rankSince.lost || 0)))), need = Math.max(0, n.repFull - got);
      return { unit: `${got} / ${n.repFull} rep earned since your last promotion`, act: `earn ${need} more rep at this rank — ${READY_HINTS.rep}` }; }
    if (k === "social") { const avg = Math.round(avgPositive()), need = Math.max(1, Math.ceil(n.socialFull - avgPositive()));
      return { unit: `average crew opinion +${avg} of +${n.socialFull}`, act: `raise it ${need} more — ${READY_HINTS.social}` }; }
    if (k === "perf") { const sc = Math.round(Math.min(1, 0.7 * p.perf.q + 0.3 * p.perf.resp) * 100), tgt = Math.round(RD.perfFull * 100);
      return { unit: `repair score ${sc}% of ${tgt}%`, act: READY_HINTS.perf }; }
    const sv = Math.round((rp.service || 0) * 10) / 10, more = Math.ceil(((RD.serviceCap - (rp.service || 0)) / (RD.servicePer || 0.1)) - 1e-6);
    return { unit: `service +${sv} of +${RD.serviceCap}`, act: `about ${more} more pieces of work — ${READY_HINTS.service}` };
  };
  if (gaps.length) { const w = gaps[0], d = detail(w.k); return { ...w, ...d, hint: d.act }; }
  if ((rp.service || 0) < RD.serviceCap && p.readiness < 100) { const d = detail("service"); return { k: "service", label: "Service", have: rp.service || 0, max: RD.serviceCap, miss: RD.serviceCap - (rp.service || 0), ...d, hint: d.act }; }
  if (p.readiness < 100 && (p.boardMalus || 0) > 0) { const m = Math.round(p.boardMalus), days = Math.ceil(m / PROG.boards.failMalusDecay);
    return { k: "board", label: "Failed board", have: -m, max: 0, miss: m, unit: `−${m} readiness after the last board`, act: `it fades ${PROG.boards.failMalusDecay} points a ship's day (about ${days} day${days > 1 ? "s" : ""}) — keep the other components full meanwhile`, hint: "" }; }
  if (p.readiness >= 100 && p.level < n.minLevel) { const xp = Math.max(0, xpToNext(p.level) - p.xp);
    return { k: "level", label: "Level", have: p.level, max: n.minLevel, miss: n.minLevel - p.level, unit: `level ${p.level} of ${n.minLevel}`, act: `reach level ${n.minLevel} (${xp} XP to the next level) — repairs, deck tasks and odd jobs`, hint: "" }; }
  return null;
}
// readiness 0-100 toward the NEXT rank (0 when there is none)
export function computeReadiness() {
  const p = P(), n = nextRank(), RD = PROG.readiness;
  if (!n) { p.readiness = 0; return 0; }
  const perf = Math.min(1, (0.7 * p.perf.q + 0.3 * p.perf.resp) / RD.perfFull);
  const social = clamp(avgPositive() / n.socialFull, 0, 1);
  const rep = clamp((p.repLifetime - p.rankSince.rep - (p.repLost - (p.rankSince.lost || 0))) / n.repFull, 0, 1);
  p.readyParts = { perf: Math.round(perf * RD.perf * 100), social: Math.round(social * RD.social * 100), rep: Math.round(rep * RD.rep * 100), service: Math.round(p.service * 10) / 10 };
  p.readyParts.bonus = Math.round((p.readyBonus || 0) + perkFx.readiness() + cabinFx.readiness());
  const raw = Math.min(100, Math.round((perf * RD.perf + social * RD.social + rep * RD.rep) * 100 + p.service + p.readyParts.bonus));
  p.readyPeak = Math.max(p.readyPeak || 0, raw);
  p.readyParts.board = -Math.round(p.boardMalus || 0);   // phase 5: failed-board penalty (fades daily)
  p.readiness = Math.max(raw - Math.round(p.boardMalus || 0), readinessFloor());   // never below the failed-board floor once it has been reached
  p.social = socialPoints();
  return p.readiness;
}
export const readinessFloor = () => Math.min(P().readyPeak || 0, Math.round(PROG.readiness.failedBoardFloor * 100));
export const readinessVisible = () => P().level >= PROG.readiness.showAtLevel && !!nextRank();
// promotion: readiness 100, guaranteed day (days of play) or the daily early call-up. Phase 4's board intercepts via
// hooks.promotionDue: a handler returning true takes over (and later calls promote(reason)).
export function promotionDue(reason) {
  const p = P(), n = nextRank();
  if (!n || p.promo.pending || !rankEligible()) return false;
  if (hooks.promotionGate.some(g => g(n, reason) === false)) return false;   // phase 5: board cooldowns
  for (const h of hooks.promotionDue) if (h(n, reason) === true) { p.promo.pending = true; return true; }
  promote(reason);
  return true;
}
export function promote(reason = "readiness") {
  const p = P(), n = nextRank();
  if (!n) return false;
  p.rank++; p.promo.pending = false;
  p.history.push({ rank: n.id, day: p.day, playDays: p.playDays, level: p.level, reason });
  p.rankSince = { rep: p.repLifetime, lost: p.repLost, day: p.day, playDays: p.playDays }; p.service = 0; p.readyPeak = 0; p.readyBonus = 0;
  const why = reason === "callup" ? "The board called early." : reason === "guaranteed" ? "Time in grade served." : "Your fitness report is complete.";
  log(`T'Ren, at the chair, without preamble: 'By order of Starfleet Command, you are promoted to ${n.name}. ${why} Carry on, ${n.addr}.'${cheer(" The crew applauds — Hale loudest.", "")}`, "good");
  cheerToast(`PROMOTED — ${n.name}`, "good", `Promoted to ${n.name}`);   // pass 10 (2): sober in the quiet period (the promotion itself still happens)
  fx("promotion", { name: n.name, short: n.short });
  hooks.promoted.forEach(f => f(n, reason)); pushMoment("promo", `You were promoted to ${n.name}`);
  computeReadiness();
  return true;
}
// per-step bookkeeping (sim.js): ignored faults, station help, readiness + promotion checks (once a second)
let acc = 0;
export function tickProg(dt) {
  const p = P(), S = G.ship, L = G.lt, O = PROG.opinion;
  if (!(G.sp.rep >= 0)) G.sp.rep = 0; if ("rep" in p && !(p.rep >= 0)) p.rep = 0;   // pass 06 m6: rep never negative at runtime either
  for (const [k, f] of Object.entries(S.faults)) {
    if (f.ign || f.t < O.ignored.after) continue;
    if (L.mode === "repair" && L.repairSys === k) continue;
    f.ign = true;
    for (const c of ownersOf({ sys: k })) nudge(c.id, O.ignored[f.sev] || -1, `ignored fault|${k}`);
  }
  if (L.mode === "use" && L.node && NODEMAP[L.node] && !NODEMAP[L.node].rest) {
    for (const c of ownersOf({ node: L.node })) {
      p.opStation[c.id] = (p.opStation[c.id] || 0) + dt;
      if (p.opStation[c.id] >= O.station.every) { p.opStation[c.id] -= O.station.every; nudge(c.id, O.station.gain, "station work"); }
    }
  }
  acc += dt;
  if (acc < 1) return;
  acc = 0;
  const r = computeReadiness(), n = nextRank();
  if (n && rankEligible() && !p.promo.pending) {
    if (r >= 100) promotionDue("readiness");
    else if (n.guaranteeDay && p.playDays >= n.guaranteeDay) promotionDue("guaranteed");
  }
}
// ---- rep sink: locker expansion requisition ----
export const lockerOffer = () => PROG.sinks.locker[P().lockerTier] || null;
export function buyLocker() {
  const t = lockerOffer(), S = G.ship;
  if (!t || !spend({ rep: t.rep }, "locker")) return false;   // spending never lowers lifetime rep
  S.partsCap = Math.max(S.partsCap, t.cap); P().lockerTier++;
  log(`Requisition approved — Okafor's crew fits new racks in the parts locker. Capacity ${t.cap} spares (−${t.rep} reputation).`, "good");
  toast(`Locker expanded — parts cap ${t.cap}`, "good");
  return true;
}

// ---- save migration v2 -> v3: phase-2 fields with defaults; opinions start from PROG.opinion.start; rank stays Lt jg
// (an old save that is already level >= 8 becomes eligible and is promoted by readiness / guaranteed day as normal)
export function migrateProg3(prog) {
  const f = freshProg(), p = Object.assign(f, prog || {});
  for (const k of ["perf", "rankSince", "promo", "readyParts"]) p[k] = Object.assign(freshProg()[k], (prog || {})[k]);
  p.opinions = Object.assign({}, PROG.opinion.start, (prog || {}).opinions);
  p.rank = Math.max(0, Math.min(PROG.ranks.length - 1, p.rank | 0));
  return p;
}

// ---- save migration v3 -> v4: phase-3 roster. The four seniors and Thelev keep their ids (opinions carry over); the
// other 13 starting crew join with their PROG.opinion.start values; v3 crewExtra (unused) is dropped.
export function migrateProg4(prog) {
  const f = freshProg(), p = Object.assign(f, prog || {});
  p.crew = freshCrew(); p.fav = freshProg().fav; p.sinks = freshProg().sinks; p.requests = []; p.readyBonus = 0;
  if (!Array.isArray(p.alumni)) p.alumni = [];
  p.fleetRep = Math.max(0, +p.fleetRep || 0);
  delete p.crewExtra;
  return p;
}

// ---- save migration v4 -> v5: phase-4 currency + quarters. Rations start at PROG.rations.start; the cabin tier
// follows the current rank (an old Lt Cmdr save moves straight into the viewport cabin, empty).
export function migrateProg5(prog) {
  const f = freshProg(), p = Object.assign(f, prog || {});
  p.cabin = Object.assign(freshProg().cabin, (prog || {}).cabin);
  return p;
}
// ---- save migration v5 -> v6: latinum (hidden, 0); phase 5 promotion boards + specialisations ----
// v6 -> v7 (phase 6): sickbay / memorial state starts empty; gentle mode unset (first boot line offers it)
export function migrateProg7(prog) { prog.med = freshMed(); return prog; }
export function migrateProg6(prog) {
  const p = Object.assign(freshProg(), prog || {});
  p.latinum = 0; p.latinumBy = {};
  // phase 5: spec was an (unused) array -> { focus: tier }; picks owed for the current level appear as pending on load
  const old = Array.isArray((prog || {}).spec) ? prog.spec : [];
  p.spec = {}; for (const id of old) if (PROG.specs.focus[id]) p.spec[id] = 1;
  p.specPicks = Object.keys(p.spec).length; p.specOffered = 0;
  p.board = null; p.boardLog = []; p.boardCd = 0; p.boardMalus = 0;
  p.promo = { pending: false };   // nothing could hold a promotion before v6
  return p;
}

// ---- random reputation events ----
export function repEvent(forceKind = null, forceId = null) {
  const p = P(), E = PROG.repEvents, L = crewList();
  const avg = L.reduce((t, c) => t + opinionOf(c.id), 0) / Math.max(1, L.length);
  const share = clamp(E.goodShare + avg / 100 * 0.15 + (p.perf.q - 0.6) * 0.3, 0.4, 0.85);
  const kind = forceKind || (Math.random() < share ? "good" : "bad");
  const list = E[kind], pool = forceId ? list.filter(e => e.id === forceId) : list;
  let r = Math.random() * pool.reduce((t, e) => t + e.weight, 0), ev = pool[0];
  for (const e of pool) { r -= e.weight; if (r <= 0) { ev = e; break; } }
  let who = null;
  if (ev.crew) {
    const sorted = L.slice().sort((a, b) => opinionOf(b.id) - opinionOf(a.id));
    who = ev.crew === "best" ? sorted[0] : sorted[sorted.length - 1];
    if (ev.crew === "best" && opinionOf(who.id) < 10) return repEvent("good", "improvisation");   // nobody likes him enough to praise him yet
  }
  const before = G.sp.rep;
  G.sp.rep = Math.max(0, G.sp.rep + ev.rep);
  const d = G.sp.rep - before;
  if (ev.rep < 0) p.repLost += -ev.rep;            // the full loss counts against readiness (floored), even at 0 balance
  if (who && ev.opinion) nudge(who.id, ev.opinion, ev.id);
  p.repEv[kind]++; p.repEv.net += ev.rep;
  const evLines = kind === "good" && !cheerful() ? HUSH_PRAISE : ev.lines;   // pt07 m4
  const line = evLines[Math.floor(Math.random() * evLines.length)].replace("{crew}", who ? who.short : "Someone").replace("{pos}", who ? pr(who, "pos") : "their").replace(/Lieutenant/g, addr());
  log(`${line} Reputation ${ev.rep > 0 ? "+" : ""}${ev.rep}.`, kind === "good" ? "good" : "fault");
  if (kind === "good") cheerToast(`${ev.toast} — reputation +${ev.rep}`, "good", `Reputation +${ev.rep}`);   // pass 10 (2): praise toasts sober in the quiet period
  else toast(`${ev.toast} — reputation ${ev.rep}`, "warn");
  fx("floater", { x: G.lt.x, y: G.lt.y - HEAD_Y, text: `${ev.rep > 0 ? "+" : ""}${ev.rep} REP`, color: ev.rep > 0 ? "#ffaa77" : "#ff8a7a", life: 2.4, big: true });
  hooks.repEvent.forEach(f => f(ev, d));
  return ev;
}
