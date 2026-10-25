// E1 story events (notes/2026-10-23-story-events-plan.md sections 3 to 6). An illustrated scene, a 2 to 4 sentence blurb that
// reacts to the lead's relationship with the Lt, and 2 to 3 choices (one always a safe no-roll option). A roll gives three
// bands (success < 0.6p, partial < p, else fail); the outcome is applied and saved at once. Seen only, capped, never lethal.
// Hook-ins: events.js (a leg's event slot, the DS9 dock tick, the leg counter); the overlay is js/ui/story.js and the sim
// pauses while one is open (main.js frame). Save: G.prog.story (v16), hardened through addHardener (no static import from
// progression's graph).
import { G, saveSoon } from "./state.js";
import { addScrap, scrapList, SCRAP_MAX } from "./scrapbook.js";   // Q1 #10
import { STORY, MOOD, isPresent, offRules, storyShare, storyPerDay, oddsWord } from "./pacing.js";
import { addHardener, nudge, opinionOf, spend, canAfford, awardXP, addr, costText } from "./progression.js";
import { pr, SLOTMAP } from "./roster.js";
import { log, cheerful } from "./bus.js";
import { skillLvl, addSkillXp, moodlet, SKILL_LABEL } from "./mood.js";
import { SYSTEMS, SEV_LABEL, OKAFOR_SHORT } from "./data.js";
import { spawnFault } from "./faults.js";
import { injure, gentle, isInjured } from "./injuries.js";
import { atDS9 } from "./crewcare.js";
import { isHolo } from "./holodeck.js";
import { numIn, clamp, pick } from "./util.js";
import { startBattle, battleAllowed } from "./battle.js";
import { pushMoment } from "./moments.js";   // #11 the Shift Report's best moment   // E3: S4 hand-off (battle.js never imports story.js)

const P = () => G.prog;
const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
export const freshStory = () => ({ last: null, seen: {}, legsSince: 99, dayCount: { d: 0, n: 0 }, chain: null, step: null, passed: null, fight: null, pilot: { t: 0, done: false, repairT: -1 }, n: { fired: 0, success: 0, partial: 0, fail: 0, careful: 0 } });
export const S = () => { const p = P(); if (!isObj(p.story)) p.story = freshStory(); return p.story; };
const occ = id => P().crew && P().crew.occ[id];
const nm = id => id === "lt" ? "you" : occ(id) ? occ(id).short : "someone";
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
const busy = () => { const a = P().jobs && P().jobs.active; return a && a.who ? a.who : null; };
// who can be in a scene: aboard, not the captain, not in sickbay, on the holodeck or in an incident
const free = id => !!(id && occ(id) && occ(id).slot !== "co" && !isInjured(id) && !isHolo(id) && busy() !== id);
const slotIds = slots => slots.map(s => P().crew.slots[s]).filter(free);
const crewFree = (ex = []) => Object.values(P().crew.slots).filter(id => free(id) && !ex.includes(id));
const juniors = (ex = []) => { const all = crewFree(ex), j = all.filter(id => !(SLOTMAP[occ(id).slot] || {}).senior); return j.length ? j : all; };
const slotName = (slot, d) => { const id = P().crew.slots[slot]; return id && occ(id) ? occ(id).short : d; };
export const kit = { fill: (t, c) => fill(t, c), slotIds, juniors, nm, occ, free, slotName };   // RA(b): the damage-control calls (dc.js) reuse the story machinery

// ---- the events (E1: S2, S6, S7, S11). Tokens: {lead} {other} {sub} {obj} {pos} {s} {is} {has} {does} (the lead's pronouns),
// {osub} {oobj} {opos} (the other's), {chief} {captain} {addr}; a capitalised token is capitalised. No fixed she / her in any line.
// E2: vars = blurb lines and after = outcome lines per band, each with partner / friend / rival / solo (picked 3/2/1/1, no
// immediate repeat; the partner only with romance on). An outcome's lines.{injured,unhurt,fault,parts,power} are appended
// only when that effect really happened ({fsys} = the system the fault landed on, {lost} / {pw} = the real amounts), so the
// text always matches the chips. grisk = the risk line in gentle mode (the fail band capped at a moodlet).
export const EV = {
  coolant_cascade: {
    title: "Coolant cascade", art: "story_coolant", type: "ship", gentle: false, where: ["leg", "dock"], w: 1,
    cast: () => { const l = slotIds(["engineer-1", "engineer-2", "crewman", "transporter", "security"]); const a = l.length ? l : juniors(); return a.length ? { lead: pick(a) } : null; },
    blurb: "Red alert lighting in Main Engineering: a plasma coolant line has split along a weld seam, and green vapour is rolling across the deck plates. {lead} was working the junction behind it and is pinned in the alcove, with the leak between {obj} and the door. {Chief} has the emergency bulkhead on a two-minute countdown.",
    vars: {
      partner: ["{lead}'s voice comes over the comm, steady right up until {sub} say{s} your name."],
      friend: ["{lead} spots you through the haze and lifts a hand; {sub} trust{s} you to get {obj} out."],
      rival: ["{lead} waves you off through the haze, as if {sub}'d rather wait than owe you one."],
      solo: ["Through the haze you can just make out {lead}, back to the bulkhead, breathing through a sleeve.", "{lead} is on the comm, voice tight: the vapour is thickening and the alcove has no vents."],
    },
    after: {
      success: { partner: ["Later, {lead} finds you in the corridor and holds on a moment longer than regulations strictly allow."], friend: ["{lead} claps you on the shoulder on the way to sickbay for a check-up."], rival: ["{lead} manages a stiff nod in your direction, which from {obj} is practically a medal."], solo: ["Damage control logs it as a clean recovery."] },
      partial: { partner: ["{lead} squeezes your hand once, still coughing."], friend: ["{lead} jokes, hoarsely, that you owe {obj} a new uniform."], rival: ["{lead} says nothing, but {sub} {does}n't complain either."], solo: ["The engineering log calls it a messy save, which is still a save."] },
      fail: { partner: ["{lead} tells you it wasn't your fault; neither of you quite believes it yet."], friend: ["{lead} insists you did everything right, which helps less than it should."], rival: ["{lead} doesn't say I told you so. {Sub} {does}n't have to."], solo: ["The incident report is short and unhappy."] },
      safe: { partner: ["{lead} finds you afterwards, sheepish, to thank you for not doing anything reckless."], friend: ["{lead} grins at you through the soot."], rival: ["{lead} seems almost disappointed there were no heroics to complain about."], solo: ["The repair crews have it logged before the end of the watch."] },
    },
    choices: [
      { k: "seal", label: "Seal the split line by hand", skill: "engineering", act: "sealing a split plasma line by hand", risk: "a fault in Engineering, and {lead} could be hurt", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 60, rep: 3, op: 2, sxp: 30, mlet: "storyGood" }, text: "You clamp a field patch over the seam and lean on the wrench until the vapour thins to nothing. {lead} walks out under {pos} own power, and {chief} logs the repair under your name." },
        partial: { fx: { xp: 30, rep: 1, op: 1, sxp: 15, parts: -4 }, text: "The patch holds on the third try, and {lead} comes out coughing and grateful.", lines: { parts: "It eats {lost} from the locker." } },
        fail: { fx: { op: -1, fault: "med", sys: "coolant", injure: "a plasma coolant burn" }, text: "The seam tears wider under the wrench and the line drops into a full leak.",
          lines: { injured: "{Chief}'s team drags {lead} clear with a burn across one arm.", unhurt: "{Chief}'s team drags {lead} clear, shaken but unhurt.", fault: "The surge leaves a fault in the {fsys} for the repair crews." } } } },
      { k: "crawl", label: "Talk {lead} through the crawlway", skill: "composure", help: true, act: "talking {lead} through the crawlway", risk: "a small fault in Engineering, and {lead} shaken", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 40, rep: 2, op: 2, sxp: 20, mlet: "storyGood" }, text: "You keep your voice level and walk {obj} through the Jefferies tube one junction at a time. {lead} drops out of the far hatch filthy and fine, and the bulkhead seals behind {obj}." },
        partial: { fx: { xp: 20, op: 1, sxp: 10, power: -8 }, text: "{lead} freezes halfway, and {chief} has to bleed the EPS grid to vent the tube. It works.", lines: { power: "The ship is {pw} percent down on power for the trouble." } },
        fail: { fx: { fault: "low", sys: "coolant", mlet: "storyRough" }, text: "{lead} loses {pos} nerve in the tube and backs out into the vapour before damage control can pull {obj} free. Nobody is hurt, but {lead} is shaken.", lines: { fault: "The vapour leaves a small fault in the {fsys}." } } } },
      { k: "wait", label: "Seal the bulkhead and wait for damage control", safe: true, res: {
        safe: { fx: {}, text: "You seal the bulkhead and let damage control do it by the book. Twenty minutes later they cut {lead} out, unhurt and embarrassed, and the line is patched before the next watch." } } },
      { k: "manifold", bonus: true, label: "Reroute the coolant through the backup manifold", skill: "engineering", act: "rerouting coolant under pressure", risk: "a small fault in the coolant system", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 80, rep: 4, op: 2, sxp: 35, mlet: "storyGood" }, text: "You reroute the flow through the backup manifold in one clean sequence, the leak dies, and {lead} walks out before the bulkhead even moves." },
        partial: { fx: { xp: 40, sxp: 15, power: -6 }, text: "The reroute works on the second pass, and {lead} walks out coughing.", lines: { power: "Rerouting costs the ship {pw} percent of its power." } },
        fail: { fx: { fault: "low", sys: "coolant", mlet: "storyRough" }, text: "The backup manifold kicks when you open it, and {lead} has to wait for damage control after all.", lines: { fault: "The pressure spike leaves a small fault in the {fsys}." } } } },
    ],
  },
  mess_hall_feud: {
    title: "Mess hall feud", art: "story_messhall", type: "crew", gentle: true, where: ["leg", "dock"], w: 1,
    cast: () => { const a = juniors(); if (a.length < 2) return null; const lead = pick(a), b = a.filter(x => x !== lead); return { lead, other: pick(b) }; },
    blurb: "The mess hall goes quiet when you walk in. {lead} and {other} are on their feet over a lost bet: a week of replicator rations on whether the Defiant would beat the Tenacity back to Deep Space Nine. Half the duty shift has already picked a side, and the next watch starts in an hour.",
    vars: {
      partner: ["{lead} catches your eye across the table, and {sub} would rather this not be the night you two disagree."],
      friend: ["{lead} looks to you first; {sub} trust{s} you to call it fair."],
      rival: ["{lead} folds {pos} arms before you've said a word."],
      solo: ["{lead} glances at your pips and goes on arguing anyway.", "Nobody wants to be the first to back down in front of the shift."],
    },
    after: {
      success: { partner: ["{lead} bumps your shoulder on the way out, pleased with you."], friend: ["{lead} tells the whole mess you're the fairest officer aboard."], rival: ["Even {lead} admits, grudgingly, that it was a fair call."], solo: ["The next watch starts on time and in one piece."] },
      partial: { partner: ["{lead} gives you a look that says you'll hear more about this later, fondly."], friend: ["{lead} lets it go, for your sake."], rival: ["{lead} accepts it, though {sub} clearly think{s} you got it wrong."], solo: ["It holds, mostly."] },
      fail: { partner: ["{lead} is quiet with you for the rest of the evening."], friend: ["{lead} looks more hurt than angry, which is worse."], rival: ["{lead} takes it as proof of everything {sub} already thought about you."], solo: ["The shift chief adds a note about the mood in the mess."] },
      safe: { partner: ["{lead} tells you later it was the right call to stay out of it."], friend: ["{lead} gives you a rueful shrug across the room."], rival: ["{lead} seems to have expected nothing better from you."], solo: ["By the next day, nobody can quite remember who won the bet."] },
    },
    choices: [
      { k: "hear", label: "Hear them both out", skill: "composure", help: true, act: "hearing them both out", risk: "both of them sore at you", grisk: "both of them sore", res: {
        success: { fx: { xp: 40, op: 2, op2: 2, mlet: "storyGood", mlet2: "storyGood" }, text: "You make each of them tell it start to finish, and by the end the bet sounds as silly as it is. {lead} and {other} shake on a draw, and the mess hall goes back to its replicated coffee." },
        partial: { fx: { xp: 20, op: 1, mlet2: "storyFeud" }, text: "{lead} accepts your ruling with good grace. {other} accepts it with a face like a Cardassian tax audit, which is still better than a brawl." },
        fail: { fx: { op: -1, op2: -1, mlet: "storyFeud", mlet2: "storyFeud" }, text: "Your ruling satisfies nobody, and both of them leave sure you took the other's side. The shift splits along the old lines for a day or two." } } },
      { k: "round", label: "Buy the next round and make them shake on it", skill: "composure", act: "brokering a handshake over drinks", cost: { rations: 15 }, risk: "the argument just gets louder", res: {
        success: { fx: { xp: 30, op: 2, op2: 2, mlet: "storyGood", mlet2: "storyGood" }, text: "A round of synthehol and a toast to the Defiant's terrible luck does what logic couldn't. {lead} and {other} shake on it, and someone starts a dom-jot game." },
        partial: { fx: { xp: 15, op: 1 }, text: "They take the drinks and the handshake, if not each other's company. The shift settles; the bet stays an open subject." },
        fail: { fx: { op2: -1, mlet: "storyFeud", mlet2: "storyFeud" }, text: "They take the drinks and keep arguing between sips. You have bought the shift a louder evening and nothing else." } } },
      { k: "leave", label: "Leave it to the shift chief", safe: true, res: {
        safe: { fx: {}, text: "You leave it to the shift chief, who splits {lead} and {other} onto different duty rosters for the week. The argument fizzles out on its own, slowly." } } },
      { k: "spar", bonus: true, label: "Settle it in the gym: a sparring bout with each of them", skill: "fitness", act: "sparring in front of the whole shift", risk: "a bruised ego, and the feud goes on", grisk: "both of them sore", res: {
        success: { fx: { xp: 50, op: 2, op2: 2, sxp: 25, mlet: "storyGood", mlet2: "storyGood" }, text: "You turn the feud into a sparring tournament, hold your own against both of them, and by the end {lead} and {other} are cheering each other on." },
        partial: { fx: { xp: 25, op: 1, sxp: 10 }, text: "You win one bout and lose one, and the feud loses its heat somewhere in the middle." },
        fail: { fx: { mlet: "storyFeud" }, text: "You go down in the first round, and they go back to arguing over who would have done better." } } },
    ],
  },
  letter_home: {
    title: "A letter home", art: "story_letter", type: "crew", gentle: true, where: ["leg", "dock"], w: 1,
    cast: () => { const a = juniors(); return a.length ? { lead: pick(a) } : null; },
    blurb: "{lead} catches you after shift with a PADD that has clearly been rewritten a dozen times. An Academy friend went down with the USS Sentinel at the Battle of Tyra, and {lead} wants to write to the family before the next courier buoy. {Sub} {is} asking you to help find the words.",
    vars: {
      partner: ["{lead} sits close beside you on the bunk, and the PADD shakes a little in {pos} hands."],
      friend: ["{lead} says you are the only one aboard {sub}'d trust to read it."],
      rival: ["{lead} asks stiffly, as if it costs {obj} something to ask you of all people."],
      solo: ["The candle on the desk is regulation issue and flickers anyway.", "{lead} won't quite meet your eyes."],
    },
    after: {
      success: { partner: ["{lead} leans against you for a long moment, and neither of you says anything."], friend: ["{lead} tells you {sub}'ll owe you for this one."], rival: ["{lead} thanks you, and for once {sub} sound{s} like {sub} mean{s} it."], solo: ["The letter goes out with the morning courier."] },
      partial: { partner: ["{lead} keeps hold of your hand until the candle gutters."], friend: ["{lead} says it's good enough, and that you helped."], rival: ["{lead} nods once and leaves it at that."], solo: ["The courier buoy takes it at the start of the next watch."] },
      fail: { partner: ["{lead} tells you gently that some things {sub} need{s} to do alone."], friend: ["{lead} thanks you anyway, and means it."], rival: ["{lead} seems to regret asking."], solo: ["The PADD stays on the desk, the cursor blinking."] },
      safe: { partner: ["{lead} brings the draft to you later anyway, and you read it together."], friend: ["{lead} says {sub}'ll show you the draft once it's done."], rival: ["{lead} seems relieved not to have to say any more to you."], solo: ["The counselor's office logs a request for an appointment the next morning."] },
    },
    choices: [
      { k: "words", label: "Help {obj} find the words", skill: "composure", act: "finding the words for a condolence letter", risk: "a stiff letter, and {lead} low", res: {
        success: { fx: { xp: 50, op: 3, mlet: "storyGood" }, text: "You cut the official phrases and keep the story about the night the Sentinel's crew stole the Academy parrises squares trophy. {lead} reads it back twice, then sends it before {sub} can change a word." },
        partial: { fx: { xp: 25, op: 1, mlet: "storyRough" }, text: "The letter is honest, if a little stiff in the middle. {lead} sends it, and sits quietly for a while afterwards." },
        fail: { fx: { op: -1, mlet: "storyRough" }, text: "Every draft comes out sounding like a Starfleet form letter, and you both know it. {lead} thanks you and says {sub}'ll finish it alone." } } },
      { k: "share", label: "Tell {obj} about someone you lost", skill: "composure", help: true, act: "telling {obj} about your own loss", risk: "it lands too close, and {lead} pulls away", res: {
        success: { fx: { xp: 40, op: 4, mlet: "heard" }, text: "You tell {obj} about a classmate of your own, and what you wish you had written then. {lead} listens, then writes the letter in one sitting." },
        partial: { fx: { xp: 20, op: 2 }, text: "It helps some. {lead} keeps the letter short and true, and thanks you for staying." },
        fail: { fx: { op: -1, mlet: "storyRough" }, text: "Your story lands wrong, too close to {pos} own. {lead} goes quiet and asks to be alone." } } },
      { k: "guide", label: "Point {obj} to the counselor's guide", safe: true, res: {
        safe: { fx: {}, text: "You send {obj} the counselor's guide to condolence letters and an offer to read the draft later. {lead} thanks you, a little formally." } } },
      { k: "voice", bonus: true, label: "Help {obj} record it as a voice letter instead", skill: "composure", act: "coaching a voice letter", risk: "{lead} low", res: {
        success: { fx: { xp: 60, op: 4, sxp: 30, mlet: "heard" }, text: "You suggest {lead} just talk, and coach {obj} through it like a conversation. The recording is warm and true, and it goes out without a second take." },
        partial: { fx: { xp: 30, op: 2, sxp: 15 }, text: "The recording takes six tries; the last one is good enough." },
        fail: { fx: { mlet: "storyRough" }, text: "Hearing {pos} own voice undoes {obj}, and {lead} stops the recording halfway." } } },
    ],
  },
  ferengi_salvage: {
    title: "Ferengi salvage", art: "story_ferengi", type: "ship", gentle: true, where: ["leg"], w: 1,
    cast: () => { const l = slotIds(["tactical", "security", "ops", "conn"]); const a = l.length ? l : juniors(); return a.length ? { lead: l.length ? l[0] : pick(a) } : null; },
    blurb: "The warp coil {chief} jettisoned after the last overload is drifting off the starboard bow, and so is a Ferengi shuttle. DaiMon Pesk hails, all teeth: under Ferengi salvage law, anything that leaves your hull is his. The coil is still worth a few spare parts if you can get it back.",
    vars: {
      partner: ["{lead} glances back from the tactical station with a look that says {sub}'d enjoy this."],
      friend: ["{lead} is already warming the tractor emitters and waiting for your word."],
      rival: ["{lead} mutters that {sub} could handle this without your help."],
      solo: ["Pesk has his lobes pressed to the viewscreen pickup.", "On the viewscreen, Pesk is already polishing the coil in his imagination."],
    },
    after: {
      success: { partner: ["{lead} catches your eye from tactical and doesn't bother hiding the grin."], friend: ["{lead} declares it the best entertainment since the last shore leave."], rival: ["{lead} allows that you handled Pesk well, for an officer of your rank."], solo: ["The bridge crew will be retelling this one for a week."] },
      partial: { partner: ["{lead} murmurs that you'll get the rest next time."], friend: ["{lead} calls it a draw and a moral victory."], rival: ["{lead} points out that Pesk got the better half."], solo: ["Pesk leaves looking only half as pleased as he hoped."] },
      fail: { partner: ["{lead} tells you Pesk cheats at everything, and that you were magnificent anyway."], friend: ["{lead} swears to get the coil back the next time Pesk shows his lobes."], rival: ["{lead} is clearly composing the story for the mess hall already."], solo: ["Pesk's shuttle departs at a jaunty, irritating speed."] },
      safe: { partner: ["{lead} admits you were right not to give Pesk the satisfaction of a fight."], friend: ["{lead} shrugs: it was only a coil, and Pesk can choke on it."], rival: ["{lead} grumbles that you let a Ferengi win."], solo: ["Somebody in the mess starts a pool on how long Pesk's shuttle stays in one piece."] },
    },
    choices: [
      { k: "argue", label: "Argue salvage law with him", skill: "composure", act: "arguing Ferengi salvage law", risk: "lose 3 parts", grisk: "Pesk gloats", res: {
        success: { fx: { xp: 40, rep: 2, parts: 4 }, text: "You point out that Rule of Acquisition 17 says a contract binds only between Ferengi, and the Tenacity never signed one. Pesk sputters and sulks off, and the coil comes aboard.", lines: { gain: "It yields {got} for the locker." } },
        partial: { fx: { xp: 20, rep: 1, parts: 2 }, text: "Pesk agrees to split the difference, which in Ferengi means you get the casing and he gets the good half.", lines: { gain: "The casing yields {got}." } },
        fail: { fx: { parts: -3 }, text: "Pesk out-talks you, then bills you for his time.", lines: { parts: "To keep him from filing a claim with the Ferengi Commerce Authority, you hand over {lost}." } } } },
      { k: "tractor", label: "Ask {lead} to lock a tractor beam while you time it to Pesk's grapple", skill: "tactical", act: "timing the tractor lock against Pesk's grapple", risk: "a fault in Engineering", grisk: "Pesk gloats", res: {
        success: { fx: { xp: 30, rep: 1, parts: 4, sxp: 20, mlet: "storyGood" }, text: "You call the moment, {lead} snaps the tractor onto the coil a heartbeat before Pesk's grapple, and the coil comes in with a flourish. Pesk's outraged face on the viewscreen comes free.", lines: { gain: "The coil yields {got}." } },
        partial: { fx: { xp: 15, parts: 2, power: -8 }, text: "You win the tug-of-war, but you hold the beam on too long and the tractor runs hot.", lines: { gain: "The coil yields {got}.", power: "The ship is {pw} percent down on power." } },
        fail: { fx: { fault: "low", sys: "shields" }, text: "Pesk's grapple bites first, and he warps away with the coil.", lines: { fault: "The backwash trips the Tenacity's emitters and leaves a fault in the {fsys}." } } } },
      { k: "let", label: "Let him have it", safe: true, res: {
        safe: { fx: {}, text: "You let Pesk have the coil. He thanks you with a short speech about generosity being a disease, and his shuttle wobbles away under the weight." } } },
      { k: "lock", bonus: true, label: "Remote-trigger the coil's magnetic lock before he grabs it", skill: "engineering", act: "hacking the coil's magnetic lock", risk: "a small shield fault", grisk: "Pesk gloats", res: {
        success: { fx: { xp: 60, rep: 3, parts: 5, sxp: 30 }, text: "You wake the coil's own magnetic lock from the bridge, and it slams onto the Tenacity's hull plating with Pesk's grapple a metre short.", lines: { gain: "It yields {got} for the locker." } },
        partial: { fx: { xp: 30, parts: 2, sxp: 15 }, text: "The lock catches the coil half-turned, and you lose the casing but keep the core.", lines: { gain: "The core yields {got}." } },
        fail: { fx: { fault: "low", sys: "shields" }, text: "The lock fires and pulls the coil straight into Pesk's grapple.", lines: { fault: "The pulse leaves a small fault in the {fsys}." } } } },
    ],
  },
  // ---- E3: multi-step events (nodes = steps, in order; a choice's next maps a band to the next step, else the event ends) and
  // the chain follow-ups (chainOnly: they fire only from S().chain, 1 to 3 seen legs later). notes/story-choice-art.md is the
  // binding list (labels, order, art). Choice art for steps: <ckey>_s<step>_c<n>.
  kestrel_derelict: {
    title: "The Kestrel", art: "story_kestrel_a", ckey: "story_kestrel", type: "away", gentle: false, where: ["leg"], w: 1,
    cast: () => { const l = slotIds(["security", "tactical", "ops", "conn"]); const a = l.length ? l : juniors(); return a.length ? { lead: pick(a) } : null; },
    nodes: [
      { title: "Board the freighter", art: "story_kestrel_a",
        blurb: "Long-range sensors find the Bajoran freighter Kestrel adrift at the edge of the Badlands: running lights dead, hull scored by phaser fire. There are faint life signs aboard, though the hull is cold enough that nobody should still be breathing. {lead} has the boarding kit laid out before you ask.",
        vars: { partner: ["{lead} checks the seal on your suit twice, then pretends {sub} didn't."], friend: ["{lead} tosses you a wrist-light: same as the Academy drills, just colder."], rival: ["{lead} suggests, not quietly, that the Lieutenant might prefer to wait on the bridge."], solo: ["The freighter turns slowly on the viewscreen, a tumble of dark windows.", "The Kestrel's distress beacon is still running, on a battery that is nearly gone."] },
        after: {
          success: { partner: ["{lead} stays a step behind you the whole way, close enough to touch."], friend: ["{lead} gives you a thumbs-up through two visors."], rival: ["{lead} admits, grudgingly, that you know your way around a dead ship."], solo: ["The life signs are stronger here."] },
          partial: { partner: ["{lead} squeezes your glove once: you're through."], friend: ["{lead} calls it ugly but effective."], rival: ["{lead} says nothing, which is almost a compliment."], solo: ["It's slower than you'd like, but you're aboard."] },
          fail: { partner: ["{lead} won't let go of your arm for a while afterwards."], friend: ["{lead} says it could have been worse, and means it."], rival: ["{lead} doesn't say it was a mistake. {Sub} {does}n't need to."], solo: ["The team regroups at the hold door."] },
          safe: { partner: ["{lead} looks relieved, and a little disappointed."], friend: ["{lead} nods: the careful call."], rival: ["{lead} mutters that Starfleet used to have explorers."], solo: ["The Kestrel's beacon fades behind you."] } },
        choices: [
          { k: "board", label: "Lead the boarding party through the airlock", skill: "fitness", act: "leading a boarding party through a dead ship", risk: "{lead} could be hurt in the dark", grisk: "{lead} shaken", next: { success: 1, partial: 1, fail: 1 }, res: {
            success: { fx: { xp: 40, rep: 1, op: 1, sxp: 20 }, text: "You lead the team through the airlock and down the dead corridors, wrist-lights finding the way. Past the wreckage, a cargo hold is sealed from the inside, and the life signs are behind it." },
            partial: { fx: { xp: 20, sxp: 10, power: -6 }, text: "The airlock fights you, but you get aboard and find the sealed hold where the life signs are.", lines: { power: "Cycling it costs the Tenacity {pw} percent of its power." } },
            fail: { fx: { op: -1, injure: "a gash from a buckled deck plate" }, text: "A deck plate gives way in the dark and the team goes down in a tangle of debris. You reach the sealed hold anyway, slower and sorer.",
              lines: { injured: "{lead} has a gash across one shoulder, patched on the spot.", unhurt: "{lead} is shaken but unhurt." } } } },
          { k: "sweep", label: "Lead a security sweep ahead, {lead} on your flank", skill: "tactical", act: "leading a sweep through a booby-trapped ship", risk: "{lead} could be hurt by a booby trap", grisk: "{lead} shaken", next: { success: 1, partial: 1, fail: 1 }, res: {
            success: { fx: { xp: 30, rep: 1, sxp: 20, mlet: "storyGood" }, text: "You sweep the freighter deck by deck with {lead} on your flank, call it clear in under ten minutes, and find a cargo hold sealed from the inside." },
            partial: { fx: { xp: 15, sxp: 10, parts: -2 }, text: "You get the team through to the sealed hold, but a booby-trapped hatch you missed eats a tricorder on the way.", lines: { parts: "Replacing it costs {lost}." } },
            fail: { fx: { op: -1, injure: "a plasma burn from a booby-trapped hatch" }, text: "A booby-trapped hatch you didn't spot goes off as {lead} reaches it. The sweep still makes it to the sealed hold.",
              lines: { injured: "{lead} has a plasma burn across one hand.", unhurt: "{lead} is shaken but unhurt." } } } },
          { k: "scan", label: "Scan from the Tenacity and keep your distance", safe: true, careful: { next: 1, text: "You hold the Tenacity at a safe distance and sweep the Kestrel properly first: the hull is stable, the corridors are clear of traps, and the life signs are behind a cargo hold sealed from the inside. Only then do you take a team across, slowly and by the book." }, res: {
            safe: { fx: {}, text: "You hold the Tenacity at a safe distance, log the Kestrel for the Bajoran Militia and pass on the life signs. A Bajoran rescue ship is on its way." } } },
          { k: "eva", bonus: true, label: "Spacewalk to the bridge hatch and restore power from outside", skill: "fitness", act: "a spacewalk across a tumbling hull", risk: "{lead} shaken", grisk: "{lead} shaken", next: { success: 1, partial: 1, fail: 1 }, res: {
            success: { fx: { xp: 60, rep: 2, sxp: 30 }, text: "You cross the Kestrel's hull in mag boots and bring the emergency power up from the bridge hatch. The corridors light, and the way to the sealed hold is clear." },
            partial: { fx: { xp: 30, sxp: 15 }, text: "You get the emergency lighting on, though the tumble costs you time on the hull." },
            fail: { fx: { mlet: "storyRough" }, text: "The tumble throws you off the hull on your tether, and {lead} has to reel you in before the team goes in the hard way." } } },
        ] },
      { title: "The sealed hold", art: "story_kestrel_b", careful: ["You came in slow and by the book; the frost on the hold door has had longer to thicken."],
        blurb: "The cargo hold door is frosted over and welded shut from the inside. Through it, faintly, someone is tapping a Bajoran prayer rhythm on the bulkhead. {lead} reads eleven life signs, most of them small.",
        vars: { partner: ["{lead} stands close enough that your shoulders touch."], friend: ["{lead} raises an eyebrow: your call, {addr}."], rival: ["{lead} is already reaching for the cutter, waiting to see if you'll stop {obj}."], solo: ["The tapping stops, then starts again, slower."] },
        after: {
          success: { partner: ["{lead} looks at you the way {sub} did the first time."], friend: ["{lead} is handing out ration bars before you can ask."], rival: ["{lead} allows that it went well."], solo: ["A child peers out at the lights."] },
          partial: { partner: ["{lead} wraps a blanket round the smallest child and won't hear of anyone else doing it."], friend: ["{lead} jokes that you owe {obj} a new pair of gloves."], rival: ["{lead} says it could have been quicker."], solo: ["Nobody is lost."] },
          fail: { partner: ["{lead} stays at your side while the refugees warm up."], friend: ["{lead} tells you that you got them out, and that's what counts."], rival: ["{lead} has opinions, and keeps them for later."], solo: ["The refugees huddle together, wary of the uniforms."] },
          safe: { partner: ["{lead} tells you later it was the right call."], friend: ["{lead} agrees it was the safest way."], rival: ["{lead} sighs at the paperwork."], solo: ["The starbase sends a curt thank-you."] } },
        choices: [
          { k: "cut", label: "Cut the hold seal", skill: "engineering", act: "cutting a frozen hold seal", risk: "{lead} could be hurt, and spare parts lost", grisk: "{lead} shaken", next: { success: 2, partial: 2, fail: 2 }, res: {
            success: { fx: { xp: 40, rep: 2, sxp: 20 }, text: "The cutter bites clean and the door swings open on eleven frightened Bajorans, alive and wrapped in every blanket they own." },
            partial: { fx: { xp: 20, sxp: 10, parts: -3 }, text: "The seal fights you, but the door opens on eleven Bajoran refugees, cold and alive.", lines: { parts: "It burns through cutter heads worth {lost}." } },
            fail: { fx: { op: -1, injure: "a flash burn from the cutter" }, text: "The seal flashes back along the cutter and the hold vents a gout of frozen air before it opens. The refugees inside are frightened but alive.",
              lines: { injured: "{lead} has a flash burn on one forearm.", unhurt: "{lead} is shaken but unhurt." } } } },
          { k: "knock", label: "Knock and talk them out", skill: "composure", act: "talking frightened people through a door", risk: "{lead} shaken, the refugees frightened", grisk: "{lead} shaken", next: { success: 2, partial: 2, fail: 2 }, res: {
            success: { fx: { xp: 40, rep: 2, op: 1, sxp: 20, mlet: "storyGood" }, text: "You answer the prayer rhythm with the next line, and after a long minute the seal hisses open from inside. Eleven refugees, cold and wary, and alive." },
            partial: { fx: { xp: 20, sxp: 10, power: -5 }, text: "It takes an hour of talking through the door, but they open up.", lines: { power: "Keeping the corridor warm costs the ship {pw} percent of its power." } },
            fail: { fx: { op: -1, mlet: "storyRough" }, text: "Your words come out wrong and someone inside starts to cry. In the end they open the door only because the cold leaves them no choice." } } },
          { k: "tow", label: "Seal the hold and tow the freighter to a starbase", safe: true, careful: { next: 2, text: "You leave the seal alone, lock a tractor beam on the Kestrel and warm the hold through the hull while the right cutting gear comes up from stores. It takes hours. When the door finally opens, eleven Bajoran refugees step out cold, wary and alive." }, res: {
            safe: { fx: {}, text: "You leave the hold sealed, put a tractor beam on the Kestrel and tow it to the nearest starbase, where a Bajoran team opens the hold with the right gear. Everyone inside lives." } } },
          { k: "press", bonus: true, label: "Repressurise the corridor first, then open the seal gently", skill: "engineering", act: "repressurising a dead corridor", risk: "the refugees frightened", grisk: "{lead} shaken", next: { success: 2, partial: 2, fail: 2 }, res: {
            success: { fx: { xp: 60, rep: 3, sxp: 30, mlet: "storyGood" }, text: "You bring the corridor up to pressure and temperature before you touch the seal, and when it opens the refugees step out into warm air instead of vacuum frost." },
            partial: { fx: { xp: 30, sxp: 15, power: -5 }, text: "The corridor holds pressure just long enough to open the hold.", lines: { power: "It costs the Tenacity {pw} percent of its power." } },
            fail: { fx: { mlet: "storyRough" }, text: "The corridor bleeds air faster than you can feed it, and you open the hold in the cold after all." } } },
        ] },
      { title: "The refugees", art: "story_kestrel_b", careful: ["The careful approach cost time, but nobody aboard the Kestrel is any colder for it."],
        blurb: "The refugees fled a Cardassian-held colony across the Badlands; the phaser scars are from the patrol that chased them in. Their elder, a thin, grey-haired Bajoran called Mehra, asks only where they are going now. A Bajoran transport could meet you in six hours, or the Tenacity could take them to Deep Space Nine.",
        vars: { partner: ["{lead} is sharing {pos} ration bar with the smallest of the children."], friend: ["{lead} has given the elder {pos} jacket without being asked."], rival: ["{lead} mutters that the Tenacity is not a passenger liner, but not loudly."], solo: ["A child is staring at your rank pips as if they were jewels."] },
        after: {
          success: { partner: ["That night {lead} finds you in the mess and says, simply, that {sub} {is} proud of you."], friend: ["{lead} says this is why {sub} joined Starfleet."], rival: ["{lead} offers you a handshake. It's a start."], solo: ["Mehra's thanks reach the bridge in a long, formal Bajoran message."] },
          partial: { partner: ["{lead} rests {pos} head on your shoulder for a moment on the way back."], friend: ["{lead} calls it a good day's work."], rival: ["{lead} admits it went better than {sub} expected."], solo: ["The log calls it a successful rescue."] },
          fail: { partner: ["{lead} tells you they're safe, and that's what matters."], friend: ["{lead} reminds you that everyone lived."], rival: ["{lead} files a short, pointed report."], solo: ["The rescue is logged, without much ceremony."] },
          safe: { partner: ["{lead} waves the transport off with you."], friend: ["{lead} agrees it was by the book."], rival: ["{lead} says by the book is still a book."], solo: ["The refugees are someone else's to look after now."] } },
        choices: [
          { k: "escort", label: "Escort them to Deep Space Nine yourselves", skill: "tactical", act: "plotting an escort course along the Badlands", risk: "a shield fault if the patrol finds you", grisk: "{lead} shaken", res: {
            success: { fx: { xp: 60, rep: 4, op: 2, sxp: 30, mlet: "storyGood" }, chain: "kestrel_thanks", text: "You plot a course along the Badlands, {lead} on tactical, and keep the Tenacity between the Kestrel and the Cardassian border all the way home. The Kestrel docks at Deep Space Nine to cheers on the Promenade." },
            partial: { fx: { xp: 30, rep: 2, sxp: 15, power: -8 }, chain: "kestrel_thanks", text: "A Cardassian patrol shadows you for an hour before it gives up, but the Kestrel docks safely at Deep Space Nine.", lines: { power: "Holding the shields up costs {pw} percent of the ship's power." } },
            fail: { fx: { fault: "low", sys: "shields", mlet: "storyRough" }, text: "A Cardassian patrol catches you at the edge of the Badlands and fires a warning volley before a Bajoran cruiser warns it off. The refugees finish the trip aboard the cruiser.", lines: { fault: "The volley leaves a fault in the {fsys}." } } } },
          { k: "handoff", label: "Hand them to the Bajoran transport", skill: "composure", act: "handing frightened refugees over to strangers", risk: "{lead} sore, the refugees unsettled", grisk: "{lead} shaken", res: {
            success: { fx: { xp: 40, rep: 3, op: 1, sxp: 20 }, text: "The transport crew greets the refugees like family, and Mehra presses a Bajoran earring into your hand before beaming across." },
            partial: { fx: { xp: 20, rep: 1, sxp: 10 }, text: "The handoff is slow and the transport captain is short with you, but everyone gets across." },
            fail: { fx: { op: -1, mlet: "storyRough" }, text: "The transport is late, the refugees are frightened, and Mehra tells you quietly that the refugees expected more of Starfleet. They get across in the end." } } },
          { k: "hold", label: "Call Starfleet and hold position", safe: true, careful: { chain: "kestrel_thanks", text: "You call it in and hold position, and keep the refugees fed and warm until a Starfleet transport arrives. Before beaming across, Mehra asks which ship found them, and writes the name down." }, res: {
            safe: { fx: {}, text: "You call it in and hold position until a Starfleet transport arrives to take them on. It's slow and correct, and nobody is in danger." } } },
          { k: "sanctuary", bonus: true, label: "Win them sanctuary on Deep Space Nine over subspace", skill: "composure", act: "making a case to the Bajoran Militia", risk: "the refugees disappointed", grisk: "{lead} shaken", res: {
            success: { fx: { xp: 60, rep: 5, sxp: 30, mlet: "storyGood" }, chain: "kestrel_thanks", text: "You put the case to the Bajoran Militia over subspace with Mehra beside you, and by the time the Kestrel reaches Deep Space Nine there are quarters waiting." },
            partial: { fx: { xp: 30, rep: 2, sxp: 15 }, chain: "kestrel_thanks", text: "The Militia grants temporary quarters and a hearing. It's a start." },
            fail: { fx: { mlet: "storyRough" }, text: "The Militia officer on duty refers you to a form, and the refugees go to a transit camp instead." } } },
        ] },
    ],
  },
  subspace_echo: {
    title: "Subspace echo", art: "story_echo_a", ckey: "story_echo", type: "mystery", gentle: false, where: ["leg"], w: 1,
    cast: () => { const l = slotIds(["tactical", "ops", "conn", "security"]); const a = l.length ? l : juniors(); return a.length ? { lead: pick(a) } : null; },
    nodes: [
      { title: "The echo", art: "story_echo_a",
        blurb: "Ops flags a ghost on long-range sensors: a second warp signature sitting on top of the Tenacity's own, a few seconds behind. {lead} thinks it's a sensor echo. {Chief} points out that echoes don't change course when you do.",
        vars: { partner: ["{lead} catches your eye across the bridge: this one is for the two of you."], friend: ["{lead} already has the anomaly up on a split screen, grinning."], rival: ["{lead} is sure it's nothing, and says so twice."], solo: ["The echo holds station, patient as a shadow.", "Nobody on the bridge likes the way it moves."] },
        after: {
          success: { partner: ["{lead} murmurs that you're good at this."], friend: ["{lead} whistles low at the readout."], rival: ["{lead} concedes it was not nothing."], solo: ["The bridge goes very quiet."] },
          partial: { partner: ["{lead} squeezes your shoulder: it's enough."], friend: ["{lead} says half a picture beats none."], rival: ["{lead} says the data is thin. It is."], solo: ["It's a start."] },
          fail: { partner: ["{lead} tells you nobody could have caught it."], friend: ["{lead} swears it'll be back."], rival: ["{lead} says sensor ghosts are a known issue."], solo: ["The log calls it an unexplained anomaly."] },
          safe: { partner: ["{lead} watches the plot long after it's gone."], friend: ["{lead} flags it for the next watch anyway."], rival: ["{lead} approves, for once."], solo: ["Starfleet's analysts will get to it eventually."] } },
        choices: [
          { k: "analyse", label: "Run a full sensor analysis", skill: "engineering", act: "running a deep sensor analysis", risk: "a small fault in the EPS grid", grisk: "{lead} shaken", next: { success: 1, partial: 1 }, res: {
            success: { fx: { xp: 40, rep: 2, sxp: 20 }, pend: "probe_maker", text: "You strip the echo out of the sensor noise one layer at a time. It's a cloaked probe, Breen by the hull harmonics, riding your warp wake, and now you have its signature." },
            partial: { fx: { xp: 20, sxp: 10, power: -5 }, text: "It's enough: something is riding your warp wake under a cloak.", lines: { power: "The deep scan costs {pw} percent of the ship's power." } },
            fail: { fx: { fault: "low", sys: "eps" }, text: "The deep scan overloads a sensor relay, and by the time it comes back up the echo is gone.", lines: { fault: "The overload leaves a small fault in the {fsys}." } } } },
          { k: "grid", label: "Sweep with a tachyon detection grid, {lead} on the emitters", skill: "tactical", act: "laying a tachyon detection grid", risk: "a small shield fault, and {lead} shaken", grisk: "{lead} shaken", next: { success: 1, partial: 1 }, res: {
            success: { fx: { xp: 30, rep: 1, sxp: 20, mlet: "storyGood" }, pend: "probe_maker", text: "You fan a tachyon grid out behind the Tenacity, {lead} tuning the emitters, and something flickers in it: a cloaked Breen probe, pinned and painted." },
            partial: { fx: { xp: 15, sxp: 10, parts: -2 }, text: "The grid catches a ripple, enough to prove a cloaked probe is riding your wake.", lines: { parts: "It burns out an emitter coil worth {lost}." } },
            fail: { fx: { fault: "low", sys: "shields", mlet: "storyRough" }, text: "The grid flares, the echo slides away into the noise, and you're left staring at an empty plot.", lines: { fault: "The feedback leaves a small fault in the {fsys}." } } } },
          { k: "log", label: "Log it and keep course", safe: true, careful: { next: 1, text: "You log the anomaly and keep course, with a passive watch on it and nothing else. Three hours later the echo makes one mistake, a course change a beat too late, and for a second a squat cloaked hull shows through. Enough to find it again." }, res: {
            safe: { fx: {}, text: "You log the anomaly for Starfleet's sensor analysts and keep course. The echo fades a few hours later." } } },
          { k: "harmonics", bonus: true, label: "Recalibrate the deflector to read the cloak's harmonics", skill: "engineering", act: "recalibrating the deflector on the fly", risk: "a small shield fault", grisk: "{lead} shaken", next: { success: 1, partial: 1 }, res: {
            success: { fx: { xp: 60, rep: 3, sxp: 30 }, pend: "probe_maker", text: "You retune the deflector to the cloak's harmonic and the probe lights up on the plot like a lantern: Breen, and now fully catalogued." },
            partial: { fx: { xp: 30, sxp: 15, power: -6 }, text: "The recalibration is rough, but the probe's outline shows through the cloak.", lines: { power: "It costs {pw} percent of the ship's power." } },
            fail: { fx: { fault: "low", sys: "shields" }, text: "The deflector shudders off-tune and the echo is gone.", lines: { fault: "The strain leaves a small fault in the {fsys}." } } } },
        ] },
      { title: "The Breen probe", art: "story_echo_b", careful: ["The patience paid off: the probe never noticed you watching."],
        blurb: "Pinned in the sensor beam, the probe drops its cloak: a squat Breen hull bristling with antennae, quietly copying every transmission the Tenacity makes. It has been listening for a while. It is also, very clearly, talking to someone.",
        vars: { partner: ["{lead} touches your hand once under the console, then is all business."], friend: ["{lead} cracks {pos} knuckles: time to find out who's listening."], rival: ["{lead} watches to see whether you'll take the obvious shot."], solo: ["The probe's lights blink in a slow, unbothered rhythm."] },
        after: {
          success: { partner: ["{lead} is still grinning about it at the end of the watch."], friend: ["{lead} wants a copy of the log for {pos} scrapbook."], rival: ["{lead} admits that was well done."], solo: ["Starfleet Intelligence sends its thanks, in triplicate."] },
          partial: { partner: ["{lead} tells you it was close enough."], friend: ["{lead} calls it a draw."], rival: ["{lead} calls it a draw, in a tone."], solo: ["It's logged as a partial success."] },
          fail: { partner: ["{lead} says the Breen cheat."], friend: ["{lead} says next time."], rival: ["{lead} says nothing, pointedly."], solo: ["The log entry is short."] },
          safe: { partner: ["{lead} agrees it's someone else's war tonight."], friend: ["{lead} sighs, but agrees."], rival: ["{lead} thinks you've missed a chance."], solo: ["The probe whispers on behind you."] } },
        choices: [
          { k: "jam", label: "Jam its sensor feed", skill: "engineering", act: "jamming the probe's feed", risk: "a small fault in the EPS grid", grisk: "{lead} shaken", res: {
            success: { fx: { xp: 50, rep: 3, sxp: 25 }, text: "You flood its feed with junk telemetry until its antennae go dark, then tractor it aboard for Starfleet Intelligence." },
            partial: { fx: { xp: 25, rep: 1, sxp: 10, power: -6 }, text: "The probe goes deaf and drifts.", lines: { power: "Holding the jamming costs {pw} percent of the ship's power." } },
            fail: { fx: { fault: "low", sys: "eps" }, text: "The probe burns out its own core before you can blind it.", lines: { fault: "The feedback leaves a small fault in the {fsys}." } } } },
          { k: "track", label: "Track it back to its maker, {lead} on the sensors", skill: "tactical", act: "riding the probe's carrier wave home", risk: "{lead} shaken; if it works, maybe a fight", grisk: "{lead} shaken", res: {
            success: { fx: { xp: 50, rep: 3, sxp: 25 }, battle: true, text: "You ride the probe's carrier wave back across a light-year of static, {lead} calling the bearings, and at the end of it a Jem'Hadar fighter, the probe's handler, swings about to meet you. Red alert.",
              alt: { fx: { xp: 50, rep: 3, sxp: 25, mlet: "storyGood" }, text: "You ride the probe's carrier wave back to a Jem'Hadar fighter running dark at the edge of sensor range. It sees you looking and goes to warp before anyone can fire, and the trace goes to Starfleet Intelligence." } },
            partial: { fx: { xp: 25, sxp: 10 }, text: "You follow the trace halfway before it dissolves into static. Somewhere out there, someone knows you looked." },
            fail: { fx: { op: -1, mlet: "storyRough" }, text: "The probe spots your trace and destroys itself, and {lead} takes it personally." } } },
          { k: "leave", label: "Log it and leave", safe: true, careful: { chain: "probe_maker", text: "You log the probe's position and signature and leave it whispering to itself, but you pass its carrier frequency to Starfleet Intelligence with a note to keep watching the lane." }, res: {
            safe: { fx: {}, text: "You log the probe's position and signature and leave it whispering to itself. Starfleet Intelligence sends a curt acknowledgement." } } },
          { k: "spoof", bonus: true, label: "Feed the probe false telemetry for its makers", skill: "engineering", act: "spoofing a Breen telemetry feed", risk: "a small fault in the EPS grid", grisk: "{lead} shaken", res: {
            success: { fx: { xp: 80, rep: 5, sxp: 35 }, text: "You feed the probe a convincing picture of a Starfleet convoy that doesn't exist, and somewhere out there the Breen redeploy against it." },
            partial: { fx: { xp: 40, rep: 2, sxp: 15 }, text: "The probe swallows half the false picture before it shuts itself down." },
            fail: { fx: { fault: "low", sys: "eps" }, text: "The probe recognises the spoof and fires a feedback burst before it dies.", lines: { fault: "The burst leaves a small fault in the {fsys}." } } } },
        ] },
    ],
  },
  kestrel_thanks: {
    title: "The Kestrel's thanks", art: "story_quarks", ckey: "story_kthanks", type: "crew", gentle: true, chainOnly: true, where: ["dock"], w: 1, careful: ["Mehra remembers the ship that waited with them, and says so."],
    cast: () => { const a = crewFree(); return a.length ? { lead: pick(a) } : null; },
    blurb: "The Kestrel's refugees have found their feet on Deep Space Nine, and their elder Mehra has found you, with a basket of hasperat and a request. The Militia wants papers they don't have, and the Promenade wants to throw them a dinner. {lead} came along to see them again.",
    vars: { partner: ["{lead} slips {pos} hand into yours as Mehra talks."], friend: ["{lead} is already sampling the hasperat."], rival: ["{lead} is pretending not to be pleased to see them."], solo: ["The children have found the Promenade's railing and are counting ships."] },
    after: {
      success: { partner: ["{lead} walks you back to the airlock the long way."], friend: ["{lead} calls it the best shore leave in months."], rival: ["{lead} admits, at the airlock, that it was a good evening."], solo: ["Mehra's people wave from the upper Promenade."] },
      partial: { partner: ["{lead} says it was lovely anyway."], friend: ["{lead} laughs about it all the way back."], rival: ["{lead} smirks, but kindly."], solo: ["It's a warm evening, mostly."] },
      fail: { partner: ["{lead} tells you Mehra liked you, whatever happened."], friend: ["{lead} promises never to mention it, then mentions it."], rival: ["{lead} is going to tell everyone."], solo: ["The refugees are gracious about it."] },
      safe: { partner: ["{lead} squeezes your hand on the way back to the ship."], friend: ["{lead} saves you a piece of hasperat."], rival: ["{lead} rolls {pos} eyes at the work ethic."], solo: ["Mehra bows and lets you go."] } },
    choices: [
      { k: "meal", label: "Join them for a meal on the Promenade", skill: "composure", help: true, act: "trading toasts at a Bajoran dinner", risk: "an awkward evening", grisk: "an awkward evening", res: {
        success: { fx: { xp: 30, rep: 2, op: 2, mlet: "storyGood" }, text: "The dinner runs late, the hasperat is fierce, and Mehra tells the whole Promenade how the Tenacity came for them." },
        partial: { fx: { xp: 15, op: 1 }, text: "It's a long meal full of toasts in a dialect you half follow, but you leave full and welcome." },
        fail: { fx: { mlet: "storyRough" }, text: "The hasperat is so fierce you cry in front of the whole Promenade, and the toasts are very much at your expense." } } },
      { k: "petition", label: "Help their elder petition the Bajoran Militia", skill: "composure", act: "working the Militia's paperwork", risk: "a wasted afternoon", grisk: "a wasted afternoon", res: {
        success: { fx: { xp: 40, rep: 3, sxp: 20 }, text: "You walk Mehra through the Militia office and vouch for every name. By evening the refugees have papers and quarters." },
        partial: { fx: { xp: 20, rep: 1, sxp: 10 }, text: "The clerk takes half the names today and promises the rest. Mehra calls that a Bajoran miracle." },
        fail: { fx: { mlet: "storyRough" }, text: "The Militia clerk wants forms that need other forms, and the afternoon goes nowhere. Mehra pats your hand and says they'll manage." } } },
      { k: "thank", label: "Thank them and get back to work", safe: true, res: {
        safe: { fx: {}, text: "You thank Mehra, accept a jar of hasperat for the crew and get back to the ship. The basket is empty by the next watch." } } },
    ],
  },
  probe_maker: {
    title: "The probe's maker", art: "story_generic_space", ckey: "story_maker", type: "mystery", gentle: true, chainOnly: true, where: ["leg"], w: 1, careful: ["Starfleet Intelligence passed your note along; the lane has been watched ever since."],
    cast: () => { const l = slotIds(["tactical", "ops", "conn", "security"]); const a = l.length ? l : juniors(); return a.length ? { lead: pick(a) } : null; },
    blurb: "The Breen signature you logged turns up again, faint and steady: a ship running dark along the lane the probe was watching. It hasn't seen the Tenacity. Yet. {lead} has it on the plot.",
    vars: { partner: ["{lead} glances back at you, eyes bright."], friend: ["{lead} whispers, as if the Breen could hear: there it is."], rival: ["{lead} says the smart move is to leave."], solo: ["The bridge is quiet enough to hear the consoles hum."] },
    after: {
      success: { partner: ["{lead} kisses your cheek in the turbolift, very quickly."], friend: ["{lead} is telling the story in the mess by dinner."], rival: ["{lead} says, fine, that was worth it."], solo: ["Starfleet Intelligence asks for a full report."] },
      partial: { partner: ["{lead} says it was still a good hunt."], friend: ["{lead} calls it a score draw."], rival: ["{lead} says half a result is half a result."], solo: ["The log is careful about what it claims."] },
      fail: { partner: ["{lead} tells you there'll be another chance."], friend: ["{lead} says the Breen are slippery."], rival: ["{lead} says {sub} said so."], solo: ["The signature is gone."] },
      safe: { partner: ["{lead} agrees it isn't worth the risk."], friend: ["{lead} sends the report off with a flourish."], rival: ["{lead} approves."], solo: ["The ship slides away into the dark."] } },
    choices: [
      { k: "hail", label: "Hail it on the probe's frequency", skill: "composure", act: "hailing a Breen ship cold", risk: "{lead} shaken", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 40, rep: 2, sxp: 20 }, text: "The screen fills with static and a helmet half forms in it. A synthesised voice says one word, a Breen word for noted, and the ship turns for home." },
        partial: { fx: { xp: 20, sxp: 10 }, text: "You get a burst of static that might be an answer and might be a laugh. The ship leaves." },
        fail: { fx: { mlet: "storyRough" }, text: "The hail goes out and the ship is gone at once. {lead} says what everyone is thinking: now they know you know." } } },
      { k: "shadow", label: "Run silent and shadow it, {lead} at the helm", skill: "tactical", act: "running silent behind a Breen ship", risk: "a small shield fault", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 40, rep: 3, sxp: 20, mlet: "storyGood" }, text: "You kill the running lights and, with {lead} at the helm, tail it for six hours, all the way to a Breen listening post nobody knew was there." },
        partial: { fx: { xp: 20, sxp: 10, power: -6 }, text: "You keep it in sight for an hour before it slips away, long enough to chart its heading.", lines: { power: "Running silent costs {pw} percent of the ship's power." } },
        fail: { fx: { fault: "low", sys: "shields" }, text: "The Breen ship spots you and sweeps the lane with a tachyon pulse before it vanishes.", lines: { fault: "The pulse leaves a small fault in the {fsys}." } } } },
      { k: "report", label: "Report it to Starfleet Intelligence and move on", safe: true, res: {
        safe: { fx: {}, text: "You send the signature to Starfleet Intelligence and leave the lane to them. A runabout is detailed to watch it." } } },
    ],
  },
  // ---- E4: the remaining six (notes/story-choice-art.md order and art binding; labels reworded so the Lt acts, P34) + their follow-ups ----
  vorta_offer: {
    title: "The Vorta's offer", art: "story_vorta", type: "mystery", gentle: false, where: ["leg"], w: 1,
    cast: () => { const l = slotIds(["ops", "conn", "tactical", "science"]); const a = l.length ? l : juniors(); return a.length ? { lead: pick(a) } : null; },
    blurb: "A private channel opens on the bridge, routed around the comm logs: a Vorta in a plain grey tunic, smiling the way they do. He asks to speak only to the engineer, by which he seems to mean you, and he has an offer about the Tenacity's warp core. {lead} is at the comm station, very still.",
    vars: { partner: ["{lead} glances at you once, and you know {sub} will back whatever you decide."], friend: ["{lead} mouths across the bridge: don't trust him."], rival: ["{lead} looks as if {sub} expect{s} you to take the bait."], solo: ["The Vorta's eyes are a very pale violet, and they never seem to blink.", "Nobody on the bridge moves while he talks."] },
    after: {
      success: { partner: ["{lead} lets out a breath when the channel closes and grins at you."], friend: ["{lead} says that was the coolest thing {sub} {has} seen all year."], rival: ["{lead} concedes you didn't flinch."], solo: ["Starfleet Intelligence asks for the full recording."] },
      partial: { partner: ["{lead} tells you quietly that you did fine."], friend: ["{lead} calls it a draw with a Vorta, which is a win."], rival: ["{lead} says the Vorta got more than you did."], solo: ["The log entry is careful."] },
      fail: { partner: ["{lead} squeezes your shoulder: nobody beats a Vorta at talking."], friend: ["{lead} says he'd have run rings round anyone."], rival: ["{lead} says nothing, and doesn't need to."], solo: ["The recording is filed, and nobody wants to watch it twice."] },
      safe: { partner: ["{lead} looks relieved."], friend: ["{lead} nods: the smart call."], rival: ["{lead} says it was the only sane option."], solo: ["The channel stays closed."] } },
    choices: [
      { k: "hear", label: "Hear the Vorta out, on a recorded channel", skill: "composure", act: "playing a Vorta at his own game", risk: "{lead} uneasy, and the Vorta gets the better of you", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 50, rep: 3, sxp: 25 }, chain: "vorta_returns", text: "You keep him talking and give him nothing. He offers coordinates for a Dominion supply depot in exchange for a small favour later, and every word goes into the recording for Starfleet Intelligence." },
        partial: { fx: { xp: 25, sxp: 10, mlet: "storyRough" }, chain: "vorta_returns", text: "You get the recording, and the Vorta gets a good look at how you think. He signs off promising to call again." },
        fail: { fx: { op: -1, mlet: "storyRough" }, text: "He turns every question back on you, and by the end the recording shows a Starfleet officer being politely outplayed. He closes the channel smiling." } } },
      { k: "trace", label: "Trace the signal yourself while {lead} keeps him talking", skill: "engineering", act: "tracing a Dominion signal", risk: "a small fault in the EPS grid", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 50, rep: 3, sxp: 25 }, text: "You run the trace while {lead} asks the Vorta about the weather on Kurill Prime, and the spiderweb closes on a Dominion listening post two sectors over. Starfleet is very interested." },
        partial: { fx: { xp: 25, sxp: 10, power: -6 }, text: "The trace narrows to a sector before the Vorta notices and drops the channel.", lines: { power: "The trace costs {pw} percent of the ship's power." } },
        fail: { fx: { fault: "low", sys: "eps" }, text: "The Vorta notices the trace almost at once and sends a spike back down the line before he goes.", lines: { fault: "The spike leaves a small fault in the {fsys}." } } } },
      { k: "refuse", label: "Refuse and log the contact", safe: true, careful: { chain: "vorta_returns", text: "You close the channel without a word, then log every second of it for Starfleet Intelligence, carrier frequency and all. The Vorta's smile is the last thing on the screen, and you have a feeling it won't be the last time you see it." }, res: {
        safe: { fx: {}, text: "You close the channel without a word and log the contact for Starfleet Intelligence. The Vorta's smile is the last thing on the screen." } } },
      { k: "bluff", bonus: true, label: "Bluff a Jem'Hadar intercept to flush his ship out", skill: "tactical", act: "running a bluff on a Vorta", risk: "{lead} uneasy", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 70, rep: 4, sxp: 30 }, text: "You fake a Jem'Hadar fleet code on a side channel, and the Vorta's ship, much closer than he claimed, breaks cover and runs. Its course goes straight to Starfleet." },
        partial: { fx: { xp: 35, sxp: 15 }, text: "The bluff makes him nervous enough to cut the channel, and his ship's wake gives you a heading." },
        fail: { fx: { mlet: "storyRough" }, text: "The Vorta laughs, politely, and recites your fake code back to you before he closes the channel." } } },
    ],
  },
  vorta_returns: {
    title: "The Vorta returns", art: "story_vorta", ckey: "story_vreturn", type: "mystery", gentle: true, chainOnly: true, where: ["leg"], w: 1, careful: ["He sounds amused that you logged him. 'So careful, Lieutenant.'"],
    cast: () => { const l = slotIds(["ops", "conn", "tactical", "science"]); const a = l.length ? l : juniors(); return a.length ? { lead: pick(a) } : null; },
    blurb: "The same private channel opens again, and the same pale smile. The Vorta says he has a gift: the name of the Cardassian officer who has been selling the Tenacity's patrol routes. The price, he says, is only a conversation. {lead} is back at the comm station.",
    vars: { partner: ["{lead} reaches for your hand under the console, briefly."], friend: ["{lead} murmurs: round two."], rival: ["{lead} says this time you should let {obj} talk."], solo: ["The Vorta waits, perfectly patient."] },
    after: {
      success: { partner: ["{lead} is still smiling about it at dinner."], friend: ["{lead} wants to frame the arrest report."], rival: ["{lead} admits you've learned his game."], solo: ["The arrest goes through quietly."] },
      partial: { partner: ["{lead} says it was more than anyone else would have got."], friend: ["{lead} calls it even."], rival: ["{lead} calls it half a win."], solo: ["The log notes a partial result."] },
      fail: { partner: ["{lead} tells you he cheats."], friend: ["{lead} says the Vorta are born doing this."], rival: ["{lead} says {sub} told you so."], solo: ["The name leads nowhere."] },
      safe: { partner: ["{lead} agrees some gifts aren't worth opening."], friend: ["{lead} approves."], rival: ["{lead} shrugs."], solo: ["The channel closes for good."] } },
    choices: [
      { k: "price", label: "Hear his price, on the record", skill: "composure", act: "bargaining with a Vorta", risk: "{lead} uneasy", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 50, rep: 4, sxp: 20 }, text: "You let him talk himself in circles and give away nothing. The name checks out, and a Cardassian liaison on Deep Space Nine is quietly arrested." },
        partial: { fx: { xp: 25, sxp: 10 }, text: "You get the name and he gets an hour of your time, and neither of you is sure who came out ahead." },
        fail: { fx: { mlet: "storyRough" }, text: "He spends the hour learning more about you than you learn about him, and the name turns out to belong to a dead man." } } },
      { k: "retrace", label: "Trace him this time, before he can drop the channel", skill: "engineering", act: "running the trace", risk: "{lead} uneasy", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 50, rep: 3, sxp: 25 }, text: "You have the trace ready this time. It closes on a Vorta shuttle hiding in a comet's tail, and a runabout is sent to collect it." },
        partial: { fx: { xp: 25, sxp: 10 }, text: "The trace gets a sector before he notices. It's more than last time." },
        fail: { fx: { mlet: "storyRough" }, text: "He drops the channel the moment your trace starts, as if he'd been waiting for it." } } },
      { k: "close", label: "Close the channel", safe: true, res: {
        safe: { fx: {}, text: "You close the channel before he finishes his first sentence. Some gifts aren't worth opening." } } },
    ],
  },
  bajoran_relic: {
    title: "The shrine on the moon", art: "story_relic", type: "away", gentle: false, where: ["leg"], w: 1,
    cast: () => { const l = slotIds(["security", "ops", "science", "tactical"]); const a = l.length ? l : juniors(); return a.length ? { lead: pick(a) } : null; },
    blurb: "A Bajoran refugee ship hails with a plea: their village shrine was hidden in an abandoned moon base before the Occupation ended, and the base is about to be strip-mined. The moon is grey dust and old Cardassian tunnels. {lead} already has the survey scans up.",
    vars: { partner: ["{lead} squeezes your hand once, out of sight of the viewscreen."], friend: ["{lead} says the refugees remind {obj} of {pos} grandmother's village."], rival: ["{lead} points out that rescuing furniture is not in the mission profile."], solo: ["On the viewscreen, the refugees' vedek bows low and waits."] },
    after: {
      success: { partner: ["{lead} watches the refugees sing and leans into your shoulder."], friend: ["{lead} says that's the best thing the Tenacity has done all month."], rival: ["{lead} admits it was worth the detour."], solo: ["The vedek sends a blessing for the whole crew."] },
      partial: { partner: ["{lead} tells you it was beautiful anyway."], friend: ["{lead} says they'll mend the panel."], rival: ["{lead} says it could have been worse."], solo: ["The refugees are grateful, if a little anxious."] },
      fail: { partner: ["{lead} stays close while you watch their shuttle go down."], friend: ["{lead} says they got it in the end, and that counts."], rival: ["{lead} says the tunnels were always a bad idea."], solo: ["The log records a partial recovery by the refugees themselves."] },
      safe: { partner: ["{lead} says it was the kind thing to do."], friend: ["{lead} wishes them luck over the comm."], rival: ["{lead} approves of the caution."], solo: ["The refugees make it, on their own."] } },
    choices: [
      { k: "carry", label: "Lead a team down to recover the shrine", skill: "fitness", act: "hauling a shrine ark across moon dust", risk: "{lead} could be hurt in the tunnels", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 60, rep: 4, op: 2, sxp: 30, mlet: "storyGood" }, text: "You lead the team through the tunnels in low gravity and carry the draped ark out between you. The refugees sing when it beams aboard their ship." },
        partial: { fx: { xp: 30, sxp: 15, power: -6 }, text: "You get the ark out, though a tunnel collapse forces a long way round.", lines: { power: "Holding the transporter lock costs the Tenacity {pw} percent of its power." } },
        fail: { fx: { op: -1, injure: "a wrenched knee in a tunnel collapse" }, text: "A tunnel ceiling gives way behind you and the team has to dig out. The ark comes up later, on the refugees' own shuttle.",
          lines: { injured: "{lead} has a wrenched knee from the collapse.", unhurt: "{lead} is shaken but unhurt." } } } },
      { k: "beam", label: "Beam the shrine up piece by piece, {lead} on the pad", skill: "engineering", act: "beaming up a fragile relic", risk: "a small fault in the transporter", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 50, rep: 3, sxp: 25 }, text: "You lock on to each fragment in turn, holding the patterns steady through the moon's ore interference, and the shrine rematerialises whole on the refugees' pad." },
        partial: { fx: { xp: 25, sxp: 10, parts: -3 }, text: "Most of the shrine comes through cleanly; one carved panel arrives in two pieces.", lines: { parts: "Boosting the pattern buffers costs {lost}." } },
        fail: { fx: { fault: "low", sys: "transporter" }, text: "The ore in the moon's crust scrambles the lock, and you abort before the patterns degrade. The refugees go down for it themselves.", lines: { fault: "The interference leaves a small fault in the {fsys}." } } } },
      { k: "medkit", label: "Give the refugees the coordinates and a medkit", safe: true, res: {
        safe: { fx: {}, text: "You send the refugees the tunnel maps, a medkit and a quiet word of luck. They go down for the shrine themselves, and they make it." } } },
      { k: "vedek", bonus: true, label: "Ask the vedek to guide you to the shrine's hidden entrance", skill: "composure", act: "earning a vedek's trust", risk: "the refugees disappointed", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 70, rep: 5, sxp: 30, mlet: "storyGood" }, text: "The vedek tells you of a monks' passage the Cardassians never found, and you walk the shrine out through it without a scratch." },
        partial: { fx: { xp: 35, sxp: 15 }, text: "The vedek half trusts you, and the passage gets you most of the way." },
        fail: { fx: { mlet: "storyRough" }, text: "The vedek decides an outsider should not see the passage, and the refugees go alone." } } },
    ],
  },
  cardassian_codes: {
    title: "The isolinear rod", art: "story_rod", type: "ship", gentle: false, where: ["leg"], w: 1,
    cast: () => { const l = slotIds(["security", "tactical", "science", "ops"]); const a = l.length ? l : juniors(); return a.length ? { lead: pick(a) } : null; },
    blurb: "The defector picked up at the last waypoint had an isolinear rod sewn into his coat lining. He swears it holds Obsidian Order codes. {Chief} swears it could just as easily hold a virus. {lead} has it in a force-field box on the engineering bench.",
    vars: { partner: ["{lead} stays close enough to grab your arm if the rod so much as sparks."], friend: ["{lead} grins: the most interesting thing to happen all week."], rival: ["{lead} thinks you should space it, and says so."], solo: ["The rod glows a faint amber inside the field."] },
    after: {
      success: { partner: ["{lead} kisses your temple in the corridor, quickly."], friend: ["{lead} wants to know how you did it."], rival: ["{lead} admits it was well done."], solo: ["Starfleet Intelligence sends a rare thank-you."] },
      partial: { partner: ["{lead} says half the codes is still a lot of codes."], friend: ["{lead} says it's a good haul."], rival: ["{lead} says the rest is probably lost."], solo: ["The codes go to Starfleet with a caveat."] },
      fail: { partner: ["{lead} tells you nobody saw that trap coming."], friend: ["{lead} says it was a nasty piece of work."], rival: ["{lead} reminds you of the airlock option."], solo: ["The defector is moved to a smaller cabin."] },
      safe: { partner: ["{lead} agrees it's someone else's problem now."], friend: ["{lead} labels the box with a skull."], rival: ["{lead} approves."], solo: ["The stasis box ships out at the next waypoint."] } },
    choices: [
      { k: "decrypt", label: "Isolate the rod and decrypt it", skill: "engineering", act: "decrypting an Obsidian Order rod", risk: "a medium fault in the EPS grid", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 60, rep: 4, sxp: 30 }, text: "You build an isolated sandbox on a spare core and walk the rod through it one layer at a time. It's real: patrol codes for three Cardassian sectors." },
        partial: { fx: { xp: 30, sxp: 15, power: -6 }, text: "You get two layers open before the encryption locks itself; the codes you have are still useful.", lines: { power: "The isolated core draws {pw} percent of the ship's power." } },
        fail: { fx: { fault: "med", sys: "eps" }, text: "The rod's outer layer was bait, and something is through the sandbox before you see it.", lines: { fault: "A virus gets into the {fsys} before you can cut the link." } } } },
      { k: "question", label: "Question the defector about it, with {lead} at your side", skill: "composure", help: true, act: "questioning a Cardassian defector", risk: "{lead} sore", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 50, rep: 3, op: 2, sxp: 25 }, text: "You and {lead} take turns being patient, and the defector finally gives up the rod's access phrase. It opens clean." },
        partial: { fx: { xp: 25, sxp: 10 }, text: "He gives you half the phrase and a long story about his mother. The rod opens partly." },
        fail: { fx: { op: -1, mlet: "storyRough" }, text: "He senses he has the upper hand and spends an hour telling you nothing, then asks for a better cabin." } } },
      { k: "stasis", label: "Seal it in a stasis box for Starfleet Intelligence", safe: true, res: {
        safe: { fx: {}, text: "You seal the rod in a stasis box, unopened, and send it to Starfleet Intelligence with the defector's statement." } } },
      { k: "tell", bonus: true, label: "Spot the Obsidian Order's tell in his story", skill: "tactical", act: "reading a Cardassian cover story", risk: "{lead} uneasy", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 70, rep: 5, sxp: 30 }, text: "You catch the slip: his unit was disbanded a year before he claims he served in it. Confronted, he admits the rod is a trap and gives you the real codes to save himself." },
        partial: { fx: { xp: 35, sxp: 15 }, text: "You're sure he's lying about something, and the rod's trap layer is right where you thought it would be." },
        fail: { fx: { mlet: "storyRough" }, text: "You accuse him of the wrong lie, and he spends the rest of the voyage offended." } } },
    ],
  },
  jemhadar_wreck: {
    title: "The Jem'Hadar wreck", art: "story_jemhadar", type: "away", gentle: false, where: ["leg"], w: 1,
    cast: () => { const l = slotIds(["security", "tactical", "nurse", "ops"]); const a = l.length ? l : juniors(); return a.length ? { lead: pick(a) } : null; },
    blurb: "A Jem'Hadar fighter lies broken in a jungle clearing on an uncharted moon, its green glow fading. One soldier is still alive, armour cracked, and out of ketracel-white: without it, withdrawal will kill him within the day, and he knows it. {lead} has a phaser on him and a question in {pos} eyes.",
    vars: { partner: ["{lead} moves without thinking to stand between you and the soldier."], friend: ["{lead} murmurs that this is above both your pay grades."], rival: ["{lead} says the Dominion wouldn't do the same for you."], solo: ["The soldier watches you without blinking. He has not asked for anything."] },
    after: {
      success: { partner: ["{lead} holds you a moment longer than usual on the way back up."], friend: ["{lead} says {sub}'ll never forget that salute."], rival: ["{lead} says it was the right thing, which costs {obj} something."], solo: ["The log calls it a humanitarian contact."] },
      partial: { partner: ["{lead} tells you that you did what you could."], friend: ["{lead} says it was enough."], rival: ["{lead} says it was a risk."], solo: ["The beacon blinks behind you."] },
      fail: { partner: ["{lead} stays at your side all the way back."], friend: ["{lead} says no one could have done more."], rival: ["{lead} says this is what {sub} warned you about."], solo: ["It's a quiet trip back to the ship."] },
      safe: { partner: ["{lead} looks back once at the beacon."], friend: ["{lead} says his people will come."], rival: ["{lead} approves of the distance."], solo: ["The flight recorder goes to Starfleet."] } },
    choices: [
      { k: "treat", label: "Treat the soldier's withdrawal in the field", skill: "composure", act: "talking a Jem'Hadar through withdrawal", risk: "{lead} could be hurt if he lashes out", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 60, rep: 3, sxp: 30 }, chain: "debt_repaid", text: "You kneel and talk to him, soldier to soldier, while a sedative from the field kit takes the edge off the withdrawal. He lives, and before the Dominion rescue beacon collects him he says your name once, as if filing it." },
        partial: { fx: { xp: 30, sxp: 15, mlet: "storyRough" }, chain: "debt_repaid", text: "He fights the sedative and the field kit is half spent before he settles, but he lives to be collected." },
        fail: { fx: { op: -1, injure: "a blow from a soldier in withdrawal" }, text: "The withdrawal takes hold mid-sentence and he lashes out before the sedative finally drops him. A Dominion beacon collects him; the rest is out of your hands.",
          lines: { injured: "{lead} has a cracked rib from the blow.", unhurt: "{lead} is shaken but unhurt." } } } },
      { k: "secure", label: "Secure the wreck's weapons first, {lead} covering you", skill: "tactical", act: "stripping a Jem'Hadar weapons rack", risk: "the wreck's beacon could bring a fighter", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 50, rep: 3, sxp: 25 }, text: "You strip the polaron rifles from the rack while {lead} covers the soldier, and the wreck is no danger to anyone now. His own people collect him later." },
        partial: { fx: { xp: 25, sxp: 10, parts: -2 }, text: "You get most of the weapons clear; one rack is trapped and goes up in a puff of green smoke.", lines: { parts: "It takes {lost} of your kit with it." } },
        fail: { fx: { mlet: "storyRough" }, battle: "story_wreck", text: "While you work the weapons rack, you trip the wreck's distress beacon, and a Jem'Hadar fighter answers it. Red alert.",
          alt: { fx: { mlet: "storyRough" }, text: "While you work the weapons rack, you trip the wreck's distress beacon. A Jem'Hadar fighter answers, circles the clearing once, and leaves you to it." } } } },
      { k: "beacon", label: "Beam up the flight recorder and leave a comm beacon", safe: true, careful: { chain: "debt_repaid", text: "You beam up the flight recorder and leave a comm beacon on the soldier's frequency, with a field med kit set down within his reach. He says nothing as you go, but his eyes follow the med kit." }, res: {
        safe: { fx: {}, text: "You beam up the flight recorder and leave a comm beacon on the soldier's frequency. His own people will come for him, one way or another." } } },
      { k: "white", bonus: true, label: "Rig the fighter's own synthesiser to make ketracel-white", skill: "engineering", act: "coaxing a Dominion synthesiser back to life", risk: "{lead} uneasy", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 70, rep: 4, sxp: 30 }, chain: "debt_repaid", text: "You bring the fighter's synthesiser back up long enough to fill one vial. The soldier drinks, stands, and salutes you, which no one aboard the Tenacity has ever seen a Jem'Hadar do." },
        partial: { fx: { xp: 35, sxp: 15 }, chain: "debt_repaid", text: "The synthesiser gives up half a vial before it dies. It's enough to keep him alive until his people come." },
        fail: { fx: { mlet: "storyRough" }, text: "The synthesiser sparks and dies, and the soldier watches you try with something like pity." } } },
    ],
  },
  debt_repaid: {
    title: "A debt repaid", art: "story_debt", ckey: "story_debt", type: "mystery", gentle: true, chainOnly: true, where: ["leg"], w: 1, careful: ["The med kit you left him is clipped to his armour."],
    cast: () => { const l = slotIds(["tactical", "security", "ops", "conn"]); const a = l.length ? l : juniors(); return a.length ? { lead: pick(a) } : null; },
    blurb: "A Jem'Hadar fighter drops out of warp off the bow and does not raise its weapons. On the viewscreen is the soldier from the wreck, alive, armour mended. He says he has a warning for the officer who spared him, and only for that officer. {lead} has a hand hovering over the red alert.",
    vars: { partner: ["{lead} doesn't take {pos} eyes off you."], friend: ["{lead} whispers that this is not in any manual."], rival: ["{lead} wants shields up, and says so."], solo: ["The fighter holds perfectly still."] },
    after: {
      success: { partner: ["{lead} says that's twice now you've surprised {obj}."], friend: ["{lead} says the mess will never believe this."], rival: ["{lead} admits mercy paid off."], solo: ["Starfleet confirms the warning a day later."] },
      partial: { partner: ["{lead} says half a warning is still a warning."], friend: ["{lead} calls it a fair trade."], rival: ["{lead} calls it a lucky break."], solo: ["The log is cautious."] },
      fail: { partner: ["{lead} says at least he didn't fire."], friend: ["{lead} says the debt is paid either way."], rival: ["{lead} says that's how it goes with the Dominion."], solo: ["The fighter is gone."] },
      safe: { partner: ["{lead} squeezes your hand once you're clear."], friend: ["{lead} watches the fighter go."], rival: ["{lead} approves."], solo: ["Nobody fires."] } },
    choices: [
      { k: "warning", label: "Hear his warning", skill: "composure", act: "listening to a Jem'Hadar's warning", risk: "{lead} uneasy", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 60, rep: 5, sxp: 25 }, text: "He tells you, flatly, that a Cardassian minefield is waiting at the next waypoint. You change course, and Starfleet later finds the mines exactly where he said." },
        partial: { fx: { xp: 30, sxp: 10 }, text: "He gives you a sector and a time, then a Vorta's voice cuts in and the channel drops." },
        fail: { fx: { mlet: "storyRough" }, text: "You press him too hard on where he's been, and he decides the debt is paid by not firing. The fighter leaves." } } },
      { k: "standoff", label: "Hold position, shields up, and let him speak first", skill: "tactical", act: "holding a standoff with a Jem'Hadar fighter", risk: "{lead} uneasy", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 50, rep: 4, sxp: 25 }, text: "You hold position, shields up but weapons cold, and he respects it. He gives you the warning, a nod, and a clean departure." },
        partial: { fx: { xp: 25, sxp: 10, power: -6 }, text: "The standoff drags on, but he speaks in the end.", lines: { power: "Holding the shields costs {pw} percent of the ship's power." } },
        fail: { fx: { mlet: "storyRough" }, text: "He reads the raised shields as distrust, which they are, and leaves without a word." } } },
      { k: "withdraw", label: "Raise shields and withdraw", safe: true, res: {
        safe: { fx: {}, text: "You raise shields and withdraw. The fighter watches you go, and then it's gone too." } } },
    ],
  },
  holo_ghost: {
    title: "The holodeck ghost", art: "story_hologhost", type: "mystery", gentle: true, where: ["leg", "dock"], w: 1,
    cast: () => { const a = juniors(); return a.length ? { lead: pick(a) } : null; },
    blurb: "A 1940s private detective, fedora and all, keeps appearing in the corridors on deck four after his holonovel ends. He asks the night shift about a missing dame and a stolen ruby, then flickers out. {lead} has seen him twice and has stopped sleeping well.",
    vars: { partner: ["{lead} admits, a little sheepishly, that {sub}'d feel better with you there."], friend: ["{lead} thinks it's the best thing that's happened aboard in months."], rival: ["{lead} says it's a maintenance problem, not a mystery."], solo: ["Somewhere down the corridor, a saxophone plays three notes and stops."] },
    after: {
      success: { partner: ["{lead} sleeps through the night, and says so, pointedly, at breakfast."], friend: ["{lead} wants a copy of the program."], rival: ["{lead} admits it was oddly touching."], solo: ["Deck four is quiet again."] },
      partial: { partner: ["{lead} says it's better, mostly."], friend: ["{lead} says he'll be back for the sequel."], rival: ["{lead} logs a maintenance ticket anyway."], solo: ["He's seen once more, then not again."] },
      fail: { partner: ["{lead} laughs about it, eventually."], friend: ["{lead} says the crew will be telling this one for years."], rival: ["{lead} says this is why {sub} said maintenance."], solo: ["The night shift starts a betting pool."] },
      safe: { partner: ["{lead} walks you back past the dark emitters."], friend: ["{lead} is a little disappointed."], rival: ["{lead} approves."], solo: ["The corridor stays dark until morning."] } },
    choices: [
      { k: "talk", label: "Talk to the character", skill: "composure", act: "interviewing a fictional detective", risk: "{lead} unsettled", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 40, rep: 2, sxp: 20, mlet: "storyGood" }, text: "You play along, and he tells you about the case he never got to finish. You help him solve it in two scenes, and he tips his hat and fades for good." },
        partial: { fx: { xp: 20, sxp: 10 }, text: "You get half the story out of him before he flickers; he appears less often after that." },
        fail: { fx: { mlet: "storyRough" }, text: "You break character and tell him he isn't real, and he takes it badly, turning up outside {lead}'s quarters to say so." } } },
      { k: "purge", label: "Purge the holo-emitter buffers, {lead} watching the corridor", skill: "engineering", act: "purging the holo-emitter buffers", risk: "a small fault in the EPS grid", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 40, rep: 2, sxp: 20 }, text: "You trace the leak to a buffer that never cleared after the program ended and purge it while {lead} calls the flickers. The corridor is quiet that night." },
        partial: { fx: { xp: 20, sxp: 10, power: -5 }, text: "The purge takes two attempts, and he shows up once more, looking reproachful, before he's gone.", lines: { power: "The purge costs {pw} percent of the ship's power." } },
        fail: { fx: { fault: "low", sys: "eps" }, text: "The purge misfires, and the detective is now in two corridors at once.", lines: { fault: "The surge leaves a small fault in the {fsys}." } } } },
      { k: "dark", label: "Shut the corridor emitters down for the night", safe: true, res: {
        safe: { fx: {}, text: "You shut down the deck four emitters for the night and flag the buffer for {chief}. The detective doesn't come back, and nobody is quite sure whether to be relieved." } } },
      { k: "chase", bonus: true, label: "Chase him through the Jefferies tubes to the buffer he's hiding in", skill: "fitness", act: "chasing a hologram through the Jefferies tubes", risk: "{lead} unsettled", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 50, rep: 2, sxp: 25, mlet: "storyGood" }, text: "You chase the flicker through two decks of Jefferies tubes and catch him at the buffer node where he's been hiding in a maintenance loop. A clean shutdown, and the crew cheer you at breakfast." },
        partial: { fx: { xp: 25, sxp: 10 }, text: "You find the right node, out of breath, a minute after he's moved on. It's enough to shut him down at the next appearance." },
        fail: { fx: { mlet: "storyRough" }, text: "He leads you a merry chase and loses you somewhere around deck six." } } },
    ],
  },
  shore_trouble: {
    title: "Trouble at Quark's", art: "story_quarks", type: "crew", gentle: false, where: ["dock"], w: 1,
    cast: () => { const a = juniors(); return a.length ? { lead: pick(a) } : null; },
    blurb: "Station security calls: {lead} is being held at Quark's after a misunderstanding at the dabo table. Quark says {lead} accused his wheel of being rigged and knocked over a tray of drinks. {lead} says the wheel is rigged. Odo's deputy would like someone to come and collect {obj}.",
    vars: { partner: ["{lead} looks up as you walk in, relieved and embarrassed in equal parts."], friend: ["{lead} waves at you from the holding bench, entirely unrepentant."], rival: ["{lead} looks as if {sub}'d rather be collected by anyone but you."], solo: ["Quark is already polishing a glass and smiling at the size of the bill."] },
    after: {
      success: { partner: ["{lead} buys you a drink with Quark's refund, which is the best part."], friend: ["{lead} tells the story all the way back to the ship."], rival: ["{lead} thanks you, stiffly, and means it."], solo: ["Quark's dabo wheel is out of service for a week."] },
      partial: { partner: ["{lead} promises to stay away from dabo, mostly."], friend: ["{lead} says it was worth it."], rival: ["{lead} says {sub} could have handled it."], solo: ["The incident report is short."] },
      fail: { partner: ["{lead} says you tried, and that's what counts."], friend: ["{lead} shrugs: Quark always wins."], rival: ["{lead} seems to have expected nothing else."], solo: ["The bill arrives at the Tenacity the next morning."] },
      safe: { partner: ["{lead} comes back sheepish and finds you waiting."], friend: ["{lead} turns up at breakfast with a story."], rival: ["{lead} seems relieved you didn't come."], solo: ["Station security sends a polite note."] } },
    choices: [
      { k: "haggle", label: "Negotiate with Quark", skill: "composure", act: "haggling with Quark", risk: "{lead} sore, and Quark smug", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 40, rep: 3, op: 2, sxp: 20, mlet: "storyGood" }, text: "You point out, politely, how a Starfleet complaint about his dabo wheel might read to the Bajoran gaming authority. Quark drops the charges and throws in a round." },
        partial: { fx: { xp: 20, op: 1, sxp: 10 }, text: "Quark drops the charges for a promise that the Tenacity's crew will drink elsewhere for a week." },
        fail: { fx: { op: -1, mlet: "storyRough" }, text: "Quark talks circles round you, and {lead} leaves with a bill and a ban from the dabo table." } } },
      { k: "footage", label: "Ask station security to review the dabo footage", skill: "tactical", act: "picking a cheat out of security footage", risk: "{lead} sore", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 50, rep: 3, op: 2, sxp: 25 }, text: "You sit in with station security, go through the footage frame by frame and find the magnet under the wheel. {lead} is released with an apology, and Quark with a fine." },
        partial: { fx: { xp: 25, sxp: 10 }, text: "The footage is grainy; you find enough to get {lead} released, if not enough to fine Quark." },
        fail: { fx: { op: -1 }, text: "You spend an hour on the footage and find nothing, and {lead} pays for the drinks." } } },
      { k: "selfsort", label: "Leave {lead} to sort it out with station security", safe: true, res: {
        safe: { fx: {}, text: "You leave {lead} to sort it out with station security. {Sub} {is} back aboard by morning, poorer and wiser." } } },
      { k: "wheel", bonus: true, label: "Show Quark you know exactly how his wheel is rigged", skill: "engineering", act: "spotting a rigged dabo wheel", risk: "{lead} sore, and Quark smug", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 60, rep: 4, op: 3, sxp: 30, mlet: "storyGood" }, text: "One look at the wheel's base and you name the magnet, its frequency and the controller in Quark's pocket. He refunds everyone at the table before Odo's deputy can ask." },
        partial: { fx: { xp: 30, op: 1, sxp: 15 }, text: "You can't prove the rig, but you describe it well enough that Quark decides not to press charges." },
        fail: { fx: { mlet: "storyRough" }, text: "You're sure it's a magnet; it turns out to be a warped floor plate. Quark is delighted." } } },
    ],
  },
  // ---- Bigger wins #7: the day-1 pilot story (notes/2026-10-24-bigger-wins-plan.md). pilot: never in a pool (poolFor); fired once by
  // pilotTick ~15 min of present play after the first repair (pilot.repairT). Gentle: no fault, no injury, no bonus lock. Careful choices carry on (#8).
  first_watch: {
    title: "First watch", art: "story_firstwatch_a", ckey: "story_firstwatch", type: "ship", gentle: true, pilot: true, where: ["pilot"], w: 0,
    cast: () => { const l = slotIds(["engineer-1", "engineer-2", "crewman", "transporter"]); const a = l.length ? l : juniors(); if (!a.length) return null; const ch = slotIds(["chief-engineer"]).filter(x => !a.includes(x)); const lead = pick(a); return ch.length ? { lead, other: ch[0] } : { lead }; },
    nodes: [
      { title: "A whine in the deck plates", art: "story_firstwatch_a",
        blurb: "Halfway through your first watch, {lead} waves you over to a junction in Main Engineering. There's a whine in the deck plates, thin and high, that only comes when the warp core cycles. {Chief} hasn't noticed it yet, and {lead} would very much like it fixed before {chief} does.",
        vars: { partner: ["{lead} stands a little closer than the junction strictly needs."], friend: ["{lead} grins: your first watch, and already a mystery."], rival: ["{lead} says {sub} could find it alone, but doesn't move away."], solo: ["The core hums, the deck plates sing, and nobody else seems to hear it.", "{lead} taps the deck with a boot: there, hear it?"] },
        after: {
          success: { partner: ["{lead} bumps your shoulder, pleased."], friend: ["{lead} says {sub} knew you'd hear it too."], rival: ["{lead} allows that you have good ears."], solo: ["The whine leads somewhere now."] },
          partial: { partner: ["{lead} says slow is fine."], friend: ["{lead} says it's a start."], rival: ["{lead} says {sub}'d have been quicker."], solo: ["It takes a while, but you have a direction."] },
          fail: { partner: ["{lead} laughs with you, not at you."], friend: ["{lead} says every engineer chases a ghost once."], rival: ["{lead} hides a smile, badly."], solo: ["You end up where you started, a little wiser."] },
          safe: { partner: ["{lead} says it can wait for {chief}."], friend: ["{lead} shrugs: tomorrow's problem."], rival: ["{lead} says that's one way to do it."], solo: ["The whine goes into the log."] } },
        choices: [
          { k: "trace", label: "Trace the whine with a tricorder", skill: "engineering", act: "tracing a harmonic through the deck plates", risk: "a little embarrassment", grisk: "a little embarrassment", next: { success: 1, partial: 1, fail: 1 }, res: {
            success: { fx: { xp: 30, op: 1, sxp: 15 }, text: "You sweep the tricorder along the seams until the harmonic peaks behind an access panel, and the readout points you straight into the Jefferies tube." },
            partial: { fx: { xp: 15, sxp: 8 }, text: "The tricorder picks up three echoes before it finds the real one, but you end up at the right Jefferies tube hatch." },
            fail: { fx: { mlet: "storyRough" }, text: "You chase the echo round the junction twice before {lead} points out the hatch it's coming from." } } },
          { k: "crawl", label: "Crawl into the Jefferies tube and listen", skill: "fitness", act: "crawling a Jefferies tube by ear", risk: "a bumped head", grisk: "a bumped head", next: { success: 1, partial: 1, fail: 1 }, res: {
            success: { fx: { xp: 30, op: 1, sxp: 15 }, text: "You squeeze into the tube and follow the sound with your palm flat on the conduit, until it's singing right under your hand." },
            partial: { fx: { xp: 15, sxp: 8 }, text: "It's a tight fit and a slow crawl, but you find where the whine is loudest." },
            fail: { fx: { mlet: "storyRough" }, text: "You crack your head on a junction box and lose the sound for a minute. {lead} talks you back to it." } } },
          { k: "plans", label: "Pull up the deck schematics first", safe: true, careful: { next: 1, text: "You call the deck schematics up on the nearest console and match the whine to the core's cycle. It only takes a few minutes, and it points you at one coupling in the Jefferies tube." }, res: {
            safe: { fx: {}, text: "You log the whine for {chief} to look at after the watch. It can wait." } } },
        ] },
      { title: "The Jefferies tube", art: "story_firstwatch_b", careful: ["Because you checked the schematics, you already know which coupling it is."],
        blurb: "The whine comes from a coupling in the Jefferies tube behind the junction, cracked hairline-thin and singing every time the core cycles. {lead} is in there with you, trying hard not to look nervous about the live conduit an inch from {pos} elbow.",
        vars: { partner: ["{lead} hands you the spanner before you ask, fingers brushing yours."], friend: ["{lead} whispers that this is the most fun {sub} {has} had all week."], rival: ["{lead} says {sub}'ll do it if you'd rather watch."], solo: ["The tube is warm and close, and the coupling hums like a tuning fork."] },
        after: {
          success: { partner: ["{lead} lets out a breath and laughs."], friend: ["{lead} high-fives you, awkwardly, in a space built for one."], rival: ["{lead} says, fine, that was neat."], solo: ["The whine is gone."] },
          partial: { partner: ["{lead} says it's holding, and so are you."], friend: ["{lead} says it'll do till the next refit."], rival: ["{lead} says it'll hold. Probably."], solo: ["It holds, with a faint hum."] },
          fail: { partner: ["{lead} squeezes your arm: nobody's hurt, that's what matters."], friend: ["{lead} says the next shift can finish it."], rival: ["{lead} sighs and reaches for the clamp."], solo: ["It needs another pair of hands."] },
          safe: { partner: ["{lead} backs out of the tube with you."], friend: ["{lead} says the next shift owes you one."], rival: ["{lead} says it'll still be there tomorrow."], solo: ["The coupling waits for the next shift."] } },
        choices: [
          { k: "fix", label: "Clamp and reseal the coupling in place", skill: "engineering", act: "resealing a live coupling", risk: "a little embarrassment", grisk: "a little embarrassment", next: { success: 2, partial: 2, fail: 2 }, res: {
            success: { fx: { xp: 30, op: 1, sxp: 15 }, text: "You clamp the coupling, bleed the pressure and reseal it in one clean pass. The core cycles again and the tube is silent." },
            partial: { fx: { xp: 15, sxp: 8 }, text: "The seal takes two tries and still hums faintly, but the crack has stopped growing." },
            fail: { fx: { mlet: "storyRough" }, text: "The clamp slips and the coupling has to be isolated after all. Nothing breaks except your pride." } } },
          { k: "talk", label: "Talk {lead} through the repair", skill: "composure", help: true, act: "talking a nervous crewmate through a repair", risk: "{lead} rattled", grisk: "{lead} rattled", next: { success: 2, partial: 2, fail: 2 }, res: {
            success: { fx: { xp: 30, op: 2, sxp: 15, mlet: "storyGood" }, text: "You hold the light and talk {lead} through it step by step. {Sub} reseal{s} the coupling with steady hands, and looks quietly proud of it." },
            partial: { fx: { xp: 15, op: 1, sxp: 8 }, text: "{lead} fumbles the first clamp, but your voice steadies {obj} and the second one holds." },
            fail: { fx: { mlet: "storyRough" }, text: "{lead} freezes with the clamp half on, and you finish it yourself. {Sub} apologise{s} twice on the way out." } } },
          { k: "isolate", label: "Isolate the coupling and tag it for the next shift", safe: true, careful: { next: 2, text: "You isolate the coupling, hang a bright warning tag on it and write it up properly, with the readings attached. The next shift reseals it in ten minutes." }, res: {
            safe: { fx: {}, text: "You isolate the coupling and leave a note for the next shift. Your watch ends quietly." } } },
        ] },
      { title: "Okafor's verdict", art: "story_firstwatch_c", careful: ["Your write-up is already on the PADD."],
        blurb: "By the end of the watch {chief} has heard about it, the way chiefs always do, and asks the two of you into the office off Main Engineering. The repair log is up on a PADD on the desk. {lead} stands very straight beside you.",
        vars: { partner: ["{lead}'s hand finds yours for a second behind your backs, then lets go."], friend: ["{lead} gives you a tiny nod: we've got this."], rival: ["{lead} looks as if {sub} expect{s} you to take the credit."], solo: ["The office smells of coffee and coolant.", "{Chief} reads the log without looking up."] },
        after: {
          success: { partner: ["{lead} walks you to the turbolift and doesn't hurry."], friend: ["{lead} tells the mess hall all about it."], rival: ["{lead} says you did all right, for a first watch."], solo: ["{Chief} adds a line to your record."] },
          partial: { partner: ["{lead} says {chief} liked you. {Sub} could tell."], friend: ["{lead} says that went fine."], rival: ["{lead} says it could have gone worse."], solo: ["It's a fair start."] },
          fail: { partner: ["{lead} tells you {chief} is like that with everyone."], friend: ["{lead} says {chief} grumbles at everybody on day one."], rival: ["{lead} doesn't say anything, which is kind of {obj}."], solo: ["{Chief} sends you off with a grunt."] },
          safe: { partner: ["{lead} walks out with you."], friend: ["{lead} says it was a good first watch."], rival: ["{lead} shrugs."], solo: ["The watch ends."] } },
        choices: [
          { k: "own", label: "Own the slip you made on the way", skill: "composure", act: "owning a mistake in front of the chief", risk: "an awkward minute", grisk: "an awkward minute", res: {
            success: { fx: { xp: 35, rep: 1, op: 1, op2: 1, sxp: 15, mlet: "storyGood" }, text: "You tell {chief} exactly where you went wrong and how you fixed it. {Chief} looks at you for a long moment, then says that's the kind of engineer {chief} can work with." },
            partial: { fx: { xp: 18, sxp: 8 }, text: "You explain the slip, a little too long. {Chief} cuts you off, not unkindly: noted, next time." },
            fail: { fx: { mlet: "storyRough" }, text: "You trip over the explanation, and {chief} says to put it in writing instead." } } },
          { k: "data", label: "Walk {chief} through the readings", skill: "engineering", act: "presenting the repair data", risk: "an awkward minute", grisk: "an awkward minute", res: {
            success: { fx: { xp: 35, rep: 1, op: 1, op2: 1, sxp: 15, mlet: "storyGood" }, text: "You put the before-and-after readings side by side, and the harmonic is simply gone. {Chief} nods slowly, and tells {lead} to keep an eye on how you work." },
            partial: { fx: { xp: 18, sxp: 8 }, text: "The readings make the case, though {chief} finds one number you can't explain." },
            fail: { fx: { mlet: "storyRough" }, text: "You pull up the wrong log first, and by the time you find the right one {chief} has moved on." } } },
          { k: "report", label: "Hand over a neat written report", safe: true, careful: { text: "You hand {chief} a short, neat written report: what you heard, what you found, what you did. {Chief} reads it twice, initials it and files it, and says it's a good first watch." }, res: {
            safe: { fx: {}, text: "You hand over the log without comment. {Chief} grunts and files it." } } },
        ] },
    ],
  },
};
export const IDS = Object.keys(EV);
// E3: the step a scene is on (single-step events are their own only step)
export const nodeOf = (c = cur) => { const E = EV[c.id]; return E.nodes ? E.nodes[clamp(c.node | 0, 0, E.nodes.length - 1)] : E; };
export const stepsOf = id => (EV[id].nodes ? EV[id].nodes.length : 1);
export const titleOf = (c = cur) => { const E = EV[c.id]; return E.nodes ? `${E.title} · ${nodeOf(c).title}` : E.title; };
const safeOf = N => N.choices.find(c => c.safe);

// ---- text ----
function fill(t, c) {
  const L = occ(c.lead), O = c.other ? occ(c.other) : null, co = P().crew.slots.co;
  const m = { lead: nm(c.lead), other: O ? O.short : "someone", sub: pr(L, "sub"), obj: pr(L, "obj"), pos: pr(L, "pos"), s: pr(L, "s"), is: pr(L, "is"), has: pr(L, "has"), does: pr(L, "s") ? "does" : "do",
    osub: pr(O, "sub"), oobj: pr(O, "obj"), opos: pr(O, "pos"), chief: slotName("chief-engineer", "the chief engineer"), captain: co && occ(co) ? occ(co).short : "the captain", addr: addr(), ...(c.x || {}) };
  return String(t).replace(/\{(\w+)\}/g, (all, k) => { const v = m[k.toLowerCase()]; return v == null ? all : k[0] !== k[0].toLowerCase() ? cap1(v) : v; });
}
// relationship band of the lead with the Lt (the holodeck relations() approach; the partner only when romance is on)
export function relBands(lead) {
  const R = P().romance, partner = R && R.opt === true ? R.partner : null, o = numIn(opinionOf(lead), -100, 100, 0), out = [];
  if (partner && partner === lead) out.push(["partner", 3]); else if (o >= 60) out.push(["friend", 2]); else if (o <= -20) out.push(["rival", 1]);
  out.push(["solo", 1]); return out;
}
const lastVar = {};
function variant(table, key, lead) {   // holodeck-style: the relationship line (partner 3 / friend 2 / rival 1) vs solo 1, no immediate repeat
  const pool = []; for (const [cat, w] of relBands(lead)) ((table || {})[cat] || []).forEach((t, i) => { for (let k = 0; k < w; k++) pool.push([cat + i, t]); });
  if (!pool.length) return { key: "", t: "" };
  const keys = new Set(pool.map(x => x[0])), use = keys.size > 1 ? pool.filter(x => x[0] !== lastVar[key]) : pool, [k, t] = pick(use);
  lastVar[key] = k; return { key: k, t };
}
// ---- odds (plan section 4) ----
export function oddsP(skill, opinion, tier) {
  const O = STORY.odds, m = tier === "friend" ? O.friend : tier === "rival" ? O.rival : tier === "partner" ? O.partner : 0;
  return numIn(O.base + O.skill * numIn(skill, 0, 10, 0) + O.rel * numIn(opinion, -100, 100, 0) / 100 + m, O.min, O.max, O.base);
}
// P32 #6: the story odds word describes FULL success (0.6p), with a 'partial likely' hint when not failing is likely
export function storyOdds(p) {
  const O = STORY.odds, W = O.words, { word, full: sc } = oddsWord(numIn(p, O.min, O.max, O.base));   // Q1: shared with the battle threat read
  return { word, hint: word !== "likely" && numIn(p, 0, 1, 0) >= W.partialHint ? "partial or better likely" : "", full: sc };
}
export function bandOf(p, r) { const O = STORY.odds; p = numIn(p, O.min, O.max, O.base); r = numIn(r, 0, 1, 0.999); return r < O.success * p ? "success" : r < p ? "partial" : "fail"; }
// P34: the Lt acts in every choice and every roll is an Lt skill. help: a crewmate's help matters -> the Lt's people skill
// (composure) blended with that crewmate's opinion of the Lt through the formula's opinion term (+ the friend / rival / partner
// tier); a solo Lt choice rolls the skill alone. The odds formula and thresholds are unchanged (oddsP).
const roller = () => "lt";
export const ltSkill = k => skillLvl("lt", k);
export const tierOf = lvl => (lvl >= STORY.tier.high ? "high" : lvl <= STORY.tier.low ? "low" : "mid");   // Lt skill tier for the outcome text
export const bonusAt = (id, node) => { const B = STORY.bonus; return numIn(B[`${id}:${(node | 0) + 1}`] ?? B[id] ?? B.default, 0, 10, 6); };
export function choiceP(c, ch) {
  if (!ch || ch.safe) return null;
  const sk = ltSkill(ch.help ? "composure" : ch.skill);
  const p = ch.help ? oddsP(sk, opinionOf(c.cast.lead), c.tier) : oddsP(sk, 0, null);
  return c && EV[c.id] && EV[c.id].pilot ? pilotP(p) : p;   // fix 4: the day-1 pilot only (oddsP and every other story unchanged)
}
// fix 4 (Oct 24): the First Watch pilot's rolled choices never read worse than STORY.pilotOdds.floor (full success ~51%,
// 'likely'); a stronger Lt keeps his own better odds (still capped at STORY.odds.max)
export function pilotP(p) { const O = STORY.odds, F = STORY.pilotOdds || {}; return Math.min(O.max, Math.max(numIn(p, O.min, O.max, O.base), numIn(F.floor, 0, O.max, 0))); }
// ---- gates (plan section 6) ----
let cur = null, seq = 0;
export const current = () => cur;
export const storyOpen = () => !!cur;
export const storyUI = { show: null, hide: null, blocked: null, panelWhy: null };   // set by js/ui/story.js
export function gateWhy(where = "leg") {   // P33 fix 1: follow-ups obey every gate too (the quiet-leg gap, one per DS9 visit)
  if (cur) return "open";
  if (!isPresent()) return "away";
  if (offRules()) return "night";
  if (G.sp.battle) return "battle";
  if (G.sp.alert) return "alert";   // RA(a): a held red alert
  if (S().fight) return "fight pending";   // P34c: no new story (voyage, dock or follow-up) while a story fight waits
  if (P().jobs && P().jobs.active) return "job";
  if (G.sp.ev && G.sp.ev.active) return "task";
  if (!cheerful()) return "hushed";
  if (where === "pilot") return storyUI.panelWhy ? storyUI.panelWhy() : null;   // #7: no grace, day cap, leg gap or travel rule; any panel, sheet or the Shift Report holds it
  if (numIn(P().playDays, 0, 1e9, 0) < STORY.graceDays) return "grace";
  const s = S(); if (s.dayCount.d === P().day && s.dayCount.n >= storyPerDay(P().playDays)) return "day cap";   // P33: 1 a ship's day on play days 2-4, then STORY.perDay
  if (where === "dock") { if (!atDS9()) return "not docked"; if (s.legsSince < 1) return "this dock"; }
  else { if (!G.sp.travel) return "not travelling"; if (s.legsSince < STORY.minLegs) return "leg gap"; }
  return null;
}
export const poolFor = where => IDS.filter(id => !EV[id].chainOnly && !EV[id].pilot && EV[id].where.includes(where) && (EV[id].gentle || numIn(P().playDays, 0, 1e9, 0) >= STORY.gentleUntil));
export function pickStory(where) {
  let pool = poolFor(where); if (pool.length > 1) pool = pool.filter(id => id !== S().last);
  let r = Math.random() * pool.reduce((a, id) => a + EV[id].w, 0);
  for (const id of pool) { r -= EV[id].w; if (r <= 0) return id; }
  return pool[0] || null;
}
// events.js: a voyage event slot comes up -> a story event takes it 35% of the time (returns the id, or null)
export function legStory() {
  if (Math.random() >= storyShare(P().playDays) || gateWhy("leg")) return null;   // P33 ramp: 0 / 0.10 / 0.20 / 0.35 of the slots
  const due = chainDue("leg"); if (due) return startStory(due, { where: "leg", chain: true }) ? due : null;   // P33 fix 1: a due follow-up is eligible (it takes a slot a story won), never forced
  const id = pickStory("leg"); return id && startStory(id, { where: "leg" }) ? id : null;
}
// events.js: docked at DS9, a modest dt-scaled chance (at most one per dock visit: legsSince resets on firing)
export function tickStoryDock(dt) {
  if (cur || !atDS9() || !(Math.random() < numIn(dt, 0, 3600, 0) * STORY.dockPerHour * storyShare(P().playDays) / STORY.legChance / 3600) || gateWhy("dock")) return null;   // P34: the dock chance follows the STORY.ramp share too
  const due = chainDue("dock"); if (due) return startStory(due, { where: "dock", chain: true }) ? due : null;   // P33 fix 1: the DS9 follow-up takes a dock story's chance, within the one-per-visit rule
  const id = pickStory("dock"); return id && startStory(id, { where: "dock" }) ? id : null;
}
// events.js evResetLeg: a new leg starts. A pending follow-up counts SEEN legs only (present, not the night / offline rules:
// frozen while away) and expires after STORY.chain.expire of them.
export function storyLeg() {
  const s = S(); s.legsSince = Math.min(99, s.legsSince + 1);
  const ch = s.chain; if (!ch) return;
  if (!isPresent() || offRules()) return;
  ch.legs++;
  // P33 fix 3: expiry counts only legs where the due follow-up could have fired (all gates open; for the DS9 one, all but being docked)
  if (ch.legs >= ch.wait && EV[ch.id]) { const why = gateWhy(EV[ch.id].where[0]); if (why === null || why === "not docked" || why === "not travelling") ch.el = (ch.el | 0) + 1; }
  if ((ch.el | 0) >= STORY.chain.expire) { s.chain = null; s.n.expired = (s.n.expired || 0) + 1; }
}
// ---- E3 chains: at most one pending; due once its wait (1 to 3 seen legs) has passed ----
export function chainDue(where) { const ch = S().chain; return ch && EV[ch.id] && ch.legs >= ch.wait && EV[ch.id].where.includes(where) ? ch.id : null; }
export function setChain(id, ctx = {}) {
  const s = S(); if (!EV[id] || s.chain) return false;
  const C = STORY.chain; s.chain = { id, wait: C.min + Math.floor(Math.random() * (C.max - C.min + 1)), legs: 0, el: 0, ctx: { lead: typeof ctx.lead === "string" ? ctx.lead : null, careful: ctx.careful === true } }; return true;
}
// a step left half-finished at load (hardenStory drops it = the safe choice): one quiet log line on the next tick
export function storyTick() { const s = S(); if (s.fight && fightReady(s.fight)) { log("The story fight you left is still waiting for you. Red alert!", "fault"); startFight(s.fight); } if (s.passed) { const E = EV[s.passed]; s.passed = null; if (E) log(`${E.title}: the moment passed, and the ship moves on.`, "comm"); } }
// #7 the day-1 pilot: present seconds count up (t); the first repair stamps repairT = t, and it fires STORY.pilot.at present seconds later
// (or at STORY.pilot.fallback without a repair), through gateWhy("pilot"). One time: done is set (and saved) when it opens.
export const PILOT_ID = "first_watch";
export function pilotTick(dt) {
  const s = S(), pl = s.pilot; if (pl.done) return false;
  const PP = STORY.pilot, ms = P().milestones || {};
  if (ms.firstRepair && !(pl.repairT >= 0)) pl.repairT = pl.t;   // fix 2: the 15 min start at the first repair (stamped in present seconds)
  if (cur) return false;
  if (isPresent() && !offRules()) pl.t = Math.min(1e6, pl.t + numIn(dt, 0, 60, 0));
  if (!((pl.repairT >= 0 && pl.t - pl.repairT >= PP.at) || pl.t >= PP.fallback)) return false;   // fallback: 30 min of present play from the start
  if (gateWhy("pilot")) return false;
  return startStory(PILOT_ID, { where: "pilot" });
}
// ---- run one ----
export function startStory(id, opts = {}) {
  const E = EV[id]; if (!E || cur) return false;
  const s = S(), cl = opts.chain && s.chain && s.chain.id === id && s.chain.ctx ? s.chain.ctx.lead : null;
  const cast = opts.cast && occ(opts.cast.lead) ? opts.cast : cl && free(cl) ? { lead: cl } : E.cast(); if (!cast || !occ(cast.lead)) return false;
  const bands = relBands(cast.lead), tier = bands[0][0];
  const half = !!(s.chain && s.chain.id === id && s.chain.ctx && s.chain.ctx.careful);   // #8: a follow-up earned by a careful choice pays half
  cur = { id, cast, tier, node: 0, pend: null, where: opts.where || "debug", res: null, at: ++seq, half, careful: half }; enterNode(cur, 0);
  const d = P().day; if (opts.chain || (s.chain && s.chain.id === id)) s.chain = null;
  seedScrap(); s.last = id; s.seen[id] = (s.seen[id] || 0) + 1; s.legsSince = 0; if (E.pilot) { s.pilot.done = true; } else { if (s.dayCount.d !== d) s.dayCount = { d, n: 0 }; s.dayCount.n++; } s.n.fired++; s.step = { id, node: 0, pend: null };   // #7: the pilot never counts toward the day cap
  log(`${E.title}: ${fill("{lead}", cast)} needs a decision from you.`, "comm");
  if (E.pilot) saveSoon("story");   // #7: once only, even across a reload
  if (storyUI.show) storyUI.show(cur);
  return true;
}
function enterNode(c, node) { const N = nodeOf({ id: c.id, node }), v = variant(N.vars, c.id + ":" + node, c.cast.lead), cl = c.careful && Array.isArray(N.careful) && N.careful.length ? " " + pick(N.careful) : ""; c.node = node; c.vkey = v.key; c.text = fill(N.blurb + " " + v.t + cl, c.cast); c.res = null; }   // #8: the careful thread's line
const gentleFail = (band) => band === "fail" && gentle();
// story choice art (notes/story-choice-art.md): the main scene and the base for <base>_c<n> choice images
export function artOf(c = cur) { if (!c) return null; const E = EV[c.id], N = nodeOf(c); return { main: N.art || E.art, cbase: E.nodes ? `${E.ckey || E.art}_s${(c.node | 0) + 1}` : E.ckey || E.art }; }
export function choicesOf(c = cur) {
  if (!c) return []; const N = nodeOf(c), g = gentle();
  // n = the choice's place in the event's list (the art binding, notes/story-choice-art.md); shown rolled first, the safe one last
  const out = N.choices.map((ch, i) => {
    if (ch.safe) return { k: ch.k, n: i + 1, safe: true, careful: !!ch.careful, label: fill(ch.label, c.cast), sub: ch.careful ? "no roll · careful · carries on" : "no roll · safe", risk: null, ok: true, cost: null, p: null };
    const k = ch.help ? "composure" : ch.skill, lvl = ltSkill(k), sk = `${SKILL_LABEL[k]} ${lvl}`, label = fill(ch.label, c.cast);
    if (ch.bonus) { const need = bonusAt(c.id, c.node); if (lvl < need) { const why = `needs ${SKILL_LABEL[k]} ${need}`; return { k: ch.k, n: i + 1, safe: false, bonus: true, locked: true, label, sub: why, risk: null, ok: false, why, cost: null, p: null, skill: k, lvl, need }; } }
    const p = choiceP(c, ch), o = storyOdds(p), helper = ch.help ? `with ${nm(c.cast.lead)}` : null;
    const cost = ch.cost ? costText(ch.cost) : null, ok = !ch.cost || canAfford(ch.cost), risk = g && ch.grisk ? ch.grisk : ch.risk;
    return { k: ch.k, n: i + 1, safe: false, bonus: !!ch.bonus, label, sub: [sk, helper, o.word, o.hint, cost].filter(Boolean).join(" · "), risk: risk ? fill(risk, c.cast) : null, ok, why: ok ? null : `${cost} needed`, cost, p, word: o.word, hint: o.hint, skill: k, lvl };
  });
  return [...out.filter(x => !x.safe), ...out.filter(x => x.safe)];
}
const MWORD = { storyGood: "in good spirits", storyRough: "shaken", storyFeud: "sore", heard: "feels heard" };
const NUMW = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const partsW = n => `${NUMW[n] || n} spare part${n === 1 ? "" : "s"}`;
// gentle mode caps the fail band at a moodlet: no injury, fault, lost parts or power, no opinion drop
function capGentle(fx) {
  const o = { ...fx }; delete o.injure; delete o.fault; if (o.parts < 0) delete o.parts; if (o.power < 0) delete o.power; if (o.op < 0) delete o.op; if (o.op2 < 0) delete o.op2;
  if (!o.mlet) o.mlet = "storyRough"; return o;
}
function applyFx(c, ch, fx) {
  const out = [], did = {}, S_ = G.ship, lead = c.cast.lead, other = c.cast.other, sgn = n => (n > 0 ? "+" : "−") + Math.abs(n);
  if (fx.xp) { const x = awardXP(fx.xp, "auto", "story"); if (x) out.push(["good", `+${x} XP`]); }
  if (fx.rep) { G.sp.rep += fx.rep; out.push(["good", `+${fx.rep} rep`]); }
  if (fx.parts > 0) { const got = Math.max(0, Math.min(fx.parts, S_.partsCap - S_.parts)); S_.parts += got; did.got = got; out.push(["good", got ? `+${got} parts` : "parts locker full"]); }
  if (fx.parts < 0) { const lost = Math.min(-fx.parts, Math.max(0, S_.parts)); S_.parts -= lost; did.lost = lost; if (lost) out.push(["bad", `−${lost} parts`]); }
  if (fx.power) { const b = S_.power; S_.power = clamp(b + fx.power, 0, 100); did.pw = Math.round(Math.abs(S_.power - b)); if (S_.power !== b) out.push([fx.power > 0 ? "good" : "bad", `${sgn(Math.round(S_.power - b))} power`]); }
  for (const [k, id] of [["op", lead], ["op2", other]]) if (fx[k] && id && occ(id)) { const d = nudge(id, fx[k], "story"), n = Math.round(numIn(d, -10, 10, fx[k]) * 10) / 10; if (n) out.push([n > 0 ? "good" : "bad", `${sgn(n)} opinion · ${nm(id)}`]); }
  if (fx.sxp) { const k = ch.help ? "composure" : ch.skill; addSkillXp("lt", k, fx.sxp); out.push(["good", `+${fx.sxp} ${SKILL_LABEL[k]} XP`]); }
  for (const [k, id] of [["mlet", lead], ["mlet2", other]]) if (fx[k] && id && occ(id) && MOOD.mlet[fx[k]]) { moodlet(id, fx[k]); out.push([MOOD.mlet[fx[k]][0] > 0 ? "good" : "bad", `${nm(id)} ${MWORD[fx[k]] || "moved"}`]); }
  if (fx.fault) { const sev = fx.fault === "med" ? "med" : "low", id = spawnFault("story", fx.sys, sev); if (id) { did.fault = id; out.push(["bad", `${SEV_LABEL[sev]} fault · ${SYSTEMS[id].name}`]); } }   // LOW / MEDIUM only, never CRIT; the text names the system it landed on
  if (fx.injure && lead && occ(lead)) {
    const inj = gentle() ? null : injure("hazard", { id: lead, sev: "minor", what: fx.injure, src: "story" });   // the non-lethal minor path; gentle mode never injures
    if (inj) { did.injured = true; out.push(["bad", `${nm(lead)} minor injury`]); }
    else { did.unhurt = true; if (!fx.mlet) moodlet(lead, "storyRough"); out.push(["bad", `${nm(lead)} shaken`]); }
  }
  return { chips: out, did };
}
// the outcome line: base text + the clauses for effects that really happened + the relationship after-line
// P34: the Lt's part, by the Lt's skill tier: success credits the skill, partial / fail are the Lt's own misstep (low = inexperience,
// high = bad luck despite doing it right). {act} = the choice's action ("sealing a split plasma line by hand"); you-only lines.
const WHY = {
  engineering: { fail: { low: "You've had little practice at {act}, and a beginner's slip in the sequence undoes it.", mid: "You know your way around {act}, but you skip one check you shouldn't have.", high: "You do everything right while {act}, and the hardware gives out anyway; sometimes it does." },
    partial: { low: "{Act} takes you three tries; you're still learning the hardware.", mid: "You're steady while {act}, but you misjudge one reading.", high: "You're textbook while {act}, and a tired component takes some of the shine off." } },
  tactical: { fail: { low: "You're green at {act}, and the first surprise catches you flat-footed.", mid: "You're sound at {act}, but you make one call a beat too late.", high: "Your read is right and you're textbook while {act}; the numbers just fall the other way." },
    partial: { low: "You second-guess yourself while {act}, and it costs you.", mid: "{Act} mostly goes to plan, apart from one call you'd take back.", high: "You're clean while {act}; luck only gives you half of it." } },
  fitness: { fail: { low: "You're not in shape yet for {act}, and your footing goes first.", mid: "You push hard while {act}, but one bad step costs you.", high: "You're in the best shape of your life and {act} goes cleanly, until the deck shifts at the worst moment." },
    partial: { low: "{Act} leaves you winded and slow.", mid: "You manage {act}, a little slower than you'd like.", high: "You're strong and quick while {act}; a stroke of bad luck slows you down." } },
  composure: { fail: { low: "You've had little practice at {act}, and your nerves show in every word.", mid: "You hold steady through most of {act}, then say one thing wrong.", high: "You say all the right things while {act}; it just isn't the moment for them." },
    partial: { low: "{Act} comes out halting; you're still finding your voice.", mid: "You get through {act}, though you fumble one line.", high: "You're graceful while {act}; it only half lands, through no fault of yours." } },
};
const CREDIT = { low: "Your {skill} is still green, but it's enough.", mid: "Your {skill} training carries it.", high: "Years of {skill} make it look easy." };
export function ltLine(ch, band, lvl, cast) {
  if (!ch || ch.safe || band === "safe") return "";
  const k = ch.help ? "composure" : ch.skill, t = tierOf(lvl), act = fill(ch.act || "the attempt", cast), x = { act, skill: SKILL_LABEL[k] };
  return fill(band === "success" ? CREDIT[t] : WHY[k][band][t], { ...cast, x });
}
function outcomeText(c, N, band, o, did, ch) {
  const L = o.lines || {}, lt = ltLine(ch, band, ltSkill(ch && ch.help ? "composure" : ch && ch.skill), c.cast), parts = band === "success" ? [o.text, lt] : [lt, o.text].filter(Boolean);
  if (did.injured && L.injured) parts.push(L.injured); if (did.unhurt && L.unhurt) parts.push(L.unhurt);
  if (did.got && L.gain) parts.push(L.gain); if (did.lost && L.parts) parts.push(L.parts); if (did.pw && L.power) parts.push(L.power); if (did.fault && L.fault) parts.push(L.fault);
  const a = variant((N.after || {})[band], c.id + ":" + (c.node | 0) + ":" + band, c.cast.lead); if (a.t) parts.push(a.t);
  const x = { fsys: did.fault ? (OKAFOR_SHORT[did.fault] || SYSTEMS[did.fault].name.toLowerCase()) : "", lost: partsW(did.lost || 0), got: partsW(did.got || 0), pw: String(did.pw || 0) };
  return { text: fill(parts.join(" "), { ...c.cast, x }), akey: a.key };
}
const BANDWORD = { success: "Success.", partial: "Partly.", fail: "It goes wrong.", safe: "", careful: "Carefully." };
// #8: a careful choice pays about STORY.careful.xp of the step's rolled success XP (no rep, no skill XP)
export function carefulFx(N) { const xs = N.choices.filter(c => !c.safe && !c.bonus && c.res.success && c.res.success.fx).map(c => c.res.success.fx.xp || 0); return { xp: xs.length ? Math.max(1, Math.round(STORY.careful.xp * xs.reduce((a, b) => a + b, 0) / xs.length)) : 0 }; }
const halfFx = fx => { const o = { ...fx }; for (const k of ["xp", "rep", "sxp"]) if (o[k] > 0) o[k] = Math.max(1, Math.round(o[k] * STORY.careful.half)); return o; };
export const hasCareful = (c = cur) => !!(c && nodeOf(c).choices.some(x => x.safe && x.careful));
export function choose(k, opts = {}) {
  if (!cur || cur.res) return null;
  const E = EV[cur.id], N = nodeOf(cur), ch = N.choices.find(x => x.k === k) || safeOf(N);
  if (ch.bonus && ltSkill(ch.help ? "composure" : ch.skill) < bonusAt(cur.id, cur.node)) return { ok: false, why: `needs ${SKILL_LABEL[ch.help ? "composure" : ch.skill]} ${bonusAt(cur.id, cur.node)}` };   // P34: a locked bonus choice
  if (ch.cost && !spend(ch.cost, "story")) return { ok: false, why: `${costText(ch.cost)} needed` };   // the cost is on the button and charged only when picked
  let band = "safe", p = null, r = null;
  if (!ch.safe) { p = choiceP(cur, ch); r = Math.random(); band = bandOf(p, r); }
  else if (ch.careful && !opts.stop) band = "careful";   // #8: picked = careful and carries on; the ✕ (stop) = today's safe ending
  let o = band === "careful" ? { fx: carefulFx(N), text: ch.careful.text, chain: ch.careful.chain } : ch.res[band], battle = false;
  if (o.battle) { const ctx = typeof o.battle === "string" ? o.battle : "story_echo"; if (!gentleFail(band) && !G.sp.battle && G.sp.travel && battleAllowed(ctx)) battle = ctx; else o = o.alt; }   // E3/E4: the hand-off (CTX tag) only when a fight is allowed (never a gentle-mode fail), else the non-battle outcome (decided now, so the text is honest)
  let fx = gentleFail(band) ? capGentle(o.fx || {}) : (o.fx || {}); if (cur.half && (band === "success" || band === "partial")) fx = halfFx(fx);
  const chips = ch.cost ? [["bad", `−${costText(ch.cost)}`]] : [];
  const A = applyFx(cur, ch, fx); chips.push(...A.chips);
  const nb = band === "careful" ? ch.careful.next : ch.next && ch.next[band], T = outcomeText(cur, N, band, o, A.did, ch), nx = nb != null && E.nodes && E.nodes[nb] ? nb : null;
  if (o.pend) cur.pend = o.pend;
  if (o.chain) { if (band === "careful" && cur.pend !== o.chain) cur.pendCareful = true; else if (band !== "careful") cur.pendCareful = false; cur.pend = o.chain; }
  cur.careful = band === "careful";   // the next step's careful line
  if (battle) chips.push(["bad", "red alert: one Jem'Hadar fighter"]);
  cur.res = { k: ch.k, band, p, r, text: T.text, akey: T.akey, did: A.did, word: BANDWORD[band], chips, next: nx, battle };
  const s = S(); if (band !== "safe") s.n[band] = (s.n[band] || 0) + 1;
  if (band === "success") pushMoment("story", `${E.title}: ${firstSentence(T.text)}`, { art: artOf(cur).main });   // #11
  if (nx != null) s.step = { id: cur.id, node: nx, pend: cur.pend, careful: !!cur.pendCareful };   // saved with the roll: a reload drops this step (= its safe choice)
  else { s.step = null; if (cur.pend && !battle) setChain(cur.pend, { ...cur.cast, careful: !!cur.pendCareful }); }
  if (battle) s.fight = battle;   // P33 fix 2: the hand-off is saved with the roll. P34c: only ever set here; cleared only when the battle starts
  log(`${titleOf(cur)}: ${T.text}`, band === "fail" ? "fault" : band === "safe" ? "comm" : "good");
  addScrap({ id: cur.id, title: titleOf(cur), art: artOf(cur).main, label: fill(ch.label, cur.cast), band, res: firstSentence(T.text), day: P().day, sd: G.ship.stardate });   // Q1 #10
  saveSoon("story");   // right after the roll (P31 rule): no reload reroll
  return { ok: true, ...cur.res };
}
// closing with no choice = the safe option; after an outcome it just closes
// E3: Continue on a step with a next one moves on (next()); closing early = the safe choice of the step on screen, and closing
// an outcome whose next step is waiting = that step's safe choice. A battle hand-off starts once the scene is closed.
export function next() { if (!cur || !cur.res || cur.res.next == null) return false; enterNode(cur, cur.res.next); cur.at = ++seq; if (storyUI.show) storyUI.show(cur); return true; }
const firstSentence = t => { const m = String(t || "").match(/^.*?[.!?](\s|$)/); return (m ? m[0] : String(t || "")).trim().slice(0, 200); };
// Q1 #10: the scrapbook (newest first). An old save is seeded once from the seen counts (no choice recorded for those).
// Q1b #4: seeded BEFORE the first new story starts (startStory), so the seen counts are only pre-scrapbook stories: a story that was
// played and later dropped by the cap never comes back as "Choice not recorded". Deduped by id, then capped at SCRAP_MAX.
export function seedScrap() {
  const p = P(), L = scrapList(); if (p.scrapSeeded === true) return; p.scrapSeeded = true;
  const have = new Set(L.map(e => e.id)), old = Object.keys(S().seen || {}).filter((id, i, a) => EV[id] && !have.has(id) && a.indexOf(id) === i);
  L.unshift(...old.map(id => ({ id, title: EV[id].title, art: EV[id].nodes ? (EV[id].nodes[0].art || EV[id].art) : EV[id].art, label: null, band: null, res: null, day: null, sd: null, old: true })));
  while (L.length > SCRAP_MAX) L.shift();
}
export function scrapbook() { seedScrap(); return scrapList().slice().reverse(); }
export function closeStory() {
  if (!cur) return;
  if (cur.res && cur.res.next != null) next();
  if (!cur.res) choose(safeOf(nodeOf(cur)).k, { stop: true });   // #8: the ✕ = stop here (today's safe ending, never the careful branch)
  const bt = cur.res && cur.res.battle; cur = null; if (storyUI.hide) storyUI.hide();
  if (bt && !startFight(bt) && S().fight) log(PENDING_LINE[S().fight] || PENDING_LINE.story_echo, "comm");   // P34c: once, when it goes pending
}
const PENDING_LINE = { story_echo: "Sensors still tracking the echo contact. The fighter will come to you when it can.", story_wreck: "The wreck's beacon is still calling. Somewhere out there, a Jem'Hadar fighter is listening." };
// one-on-one, soft: faults capped at MEDIUM, minor injuries only. P34b: never forced. The saved fight waits (saved, hardened, never expiring)
// until the player can see it and a fight is normally allowed: present, not under the night rules, no panel / modal / overlay open
// (story scene, Shift Report, holo, tab lock...), travelling (not docked), out of the post-load calm, battleAllowed.
export const FIGHTS = ["story_echo", "story_wreck"];
export const fightReady = ctx => !cur && !G.sp.battle && !G.sp.alert && isPresent() && !offRules() && !(storyUI.blocked && storyUI.blocked()) && !!G.sp.travel && !atDS9() && battleAllowed(ctx);
function startFight(ctx) { if (!fightReady(ctx)) return false; const ok = startBattle(ctx, { enemies: ["jh_fighter"], mission: "none", soft: true });   // RA(a): present -> a held (soft) red alert
  if (ok === "held" && G.sp.alert) S().fight = null; else if (ok && G.sp.battle) { G.sp.battle.soft = true; S().fight = null; } saveSoon("story"); return !!ok; }
// tests: every line of an event filled for a cast (blurb, all variants, labels, risks, outcomes) for the pronoun scan
export function allTexts(id, cast) {
  const x = { fsys: "coolant line", lost: "three spare parts", got: "two spare parts", pw: "8" }, cx = { ...cast, x }, out = [];
  for (const E of EV[id].nodes || [EV[id]]) {
    out.push(fill(E.blurb, cx));
    for (const cat of Object.keys(E.vars)) for (const t of E.vars[cat]) out.push(fill(t, cx));
    for (const b of Object.keys(E.after || {})) for (const cat of Object.keys(E.after[b])) for (const t of E.after[b][cat]) out.push(fill(t, cx));
    for (const ch of E.choices) { out.push(fill(ch.label, cx)); if (!ch.safe) for (const b of ["success", "partial", "fail"]) for (const lv of [0, 5, 9]) out.push(ltLine(ch, b, lv, cx)); for (const r of [ch.risk, ch.grisk]) if (r) out.push(fill(r, cx)); for (const o0 of Object.values(ch.res)) for (const o of [o0, o0.alt].filter(Boolean)) { out.push(fill(o.text, cx)); for (const t of Object.values(o.lines || {})) out.push(fill(t, cx)); } }
  }
  return out;
}
export function forceStory(id, cast) { if (cur) return false; return startStory(id, { where: "debug", cast }); }   // ?debug=1&story=<id>
// ---- save hardening (v16) ----
export function hardenStory(p) {
  const s = isObj(p.story) ? p.story : {}, o = freshStory(), day = Math.floor(numIn(p.day, 1, 1e9, 1));
  o.last = typeof s.last === "string" && EV[s.last] ? s.last : null;
  if (isObj(s.seen)) for (const [k, v] of Object.entries(s.seen)) if (EV[k]) { const n = Math.floor(numIn(v, 0, 1e6, 0)); if (n) o.seen[k] = n; }
  o.legsSince = Math.floor(numIn(s.legsSince, 0, 99, 99));
  if (isObj(s.dayCount)) { o.dayCount.d = Math.floor(numIn(s.dayCount.d, 0, day, 0)); o.dayCount.n = Math.floor(numIn(s.dayCount.n, 0, STORY.perDay, 0)); }
  const C = STORY.chain, lead = x => (isObj(x) && typeof x.lead === "string" && x.lead.length < 40 ? x.lead : null);
  if (isObj(s.chain) && EV[s.chain.id] && EV[s.chain.id].chainOnly) o.chain = { id: s.chain.id, wait: Math.floor(numIn(s.chain.wait, C.min, C.max, C.min)), legs: Math.floor(numIn(s.chain.legs, 0, 99, 0)), el: Math.floor(numIn(s.chain.el, 0, C.expire - 1, 0)), ctx: { lead: lead(s.chain.ctx), careful: !!(isObj(s.chain.ctx) && s.chain.ctx.careful === true) } };
  // a half-finished step is dropped: it counts as that step's safe choice (no effects), with one 'the moment passed' log line;
  // a follow-up the earlier steps had already earned (S4's good scan) is kept, as the safe ending would keep it
  if (isObj(s.step) && EV[s.step.id]) { o.passed = s.step.id; const pd = s.step.pend; if (!o.chain && typeof pd === "string" && EV[pd] && EV[pd].chainOnly) o.chain = { id: pd, wait: C.min + Math.floor(Math.random() * (C.max - C.min + 1)), legs: 0, el: 0, ctx: { lead: null, careful: s.step.careful === true } }; }
  else if (typeof s.passed === "string" && EV[s.passed]) o.passed = s.passed;
  // P33 fix 2: a story fight saved with its roll starts on load (storyTick), so a reload can't keep the reward and skip it
  o.fight = typeof s.fight === "string" && FIGHTS.includes(s.fight) ? s.fight : null;
  o.step = null;
  // #7: the pilot flag (v17). Missing (an older save): done when the player is past day 1 or has seen any story already
  const pl = isObj(s.pilot) ? s.pilot : null, vet = numIn(p.playDays, 0, 1e9, 0) >= STORY.graceDays || Object.keys(o.seen).length > 0;
  o.pilot = pl ? { t: Math.floor(numIn(pl.t, 0, 1e6, 0)), done: pl.done === true } : { t: 0, done: vet };
  // fix 2: repairT = the present-play second of the first repair (-1 = none yet). Missing or junk with a repair already made
  // (a day-1 v16 save, or an early v17 one): the 15 min start now; never after t
  { const ms = isObj(p.milestones) ? p.milestones : {}, r = pl ? pl.repairT : undefined;
    o.pilot.repairT = typeof r === "number" && Number.isFinite(r) && r >= 0 ? Math.min(Math.floor(r), o.pilot.t) : ms.firstRepair ? o.pilot.t : -1; }
  if (isObj(s.n)) { for (const k of Object.keys(o.n)) o.n[k] = Math.floor(numIn(s.n[k], 0, 1e9, 0)); if (s.n.expired) o.n.expired = Math.floor(numIn(s.n.expired, 0, 1e9, 0)); }
  p.story = o;
}
addHardener(hardenStory);
