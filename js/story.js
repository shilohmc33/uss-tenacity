// E1 story events (notes/2026-10-23-story-events-plan.md sections 3 to 6). An illustrated scene, a 2 to 4 sentence blurb that
// reacts to the lead's relationship with the Lt, and 2 to 3 choices (one always a safe no-roll option). A roll gives three
// bands (success < 0.6p, partial < p, else fail); the outcome is applied and saved at once. Seen only, capped, never lethal.
// Hook-ins: events.js (a leg's event slot, the DS9 dock tick, the leg counter); the overlay is js/ui/story.js and the sim
// pauses while one is open (main.js frame). Save: G.prog.story (v16), hardened through addHardener (no static import from
// progression's graph).
import { G, saveSoon } from "./state.js";
import { STORY, MOOD, isPresent, offRules } from "./pacing.js";
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

const P = () => G.prog;
const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
export const freshStory = () => ({ last: null, seen: {}, legsSince: 99, dayCount: { d: 0, n: 0 }, chain: null, step: null, n: { fired: 0, success: 0, partial: 0, fail: 0 } });
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
      { k: "seal", label: "Seal the split line by hand", who: "lt", skill: "engineering", risk: "a fault in Engineering, and {lead} could be hurt", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 60, rep: 3, op: 2, sxp: 30, mlet: "storyGood" }, text: "You clamp a field patch over the seam and lean on the wrench until the vapour thins to nothing. {lead} walks out under {pos} own power, and {chief} logs the repair under your name." },
        partial: { fx: { xp: 30, rep: 1, op: 1, sxp: 15, parts: -4 }, text: "The patch holds on the third try, and {lead} comes out coughing and grateful.", lines: { parts: "It eats {lost} from the locker." } },
        fail: { fx: { op: -1, fault: "med", sys: "coolant", injure: "a plasma coolant burn" }, text: "The seam tears wider under the wrench and the line drops into a full leak.",
          lines: { injured: "{Chief}'s team drags {lead} clear with a burn across one arm.", unhurt: "{Chief}'s team drags {lead} clear, shaken but unhurt.", fault: "The surge leaves a fault in the {fsys} for the repair crews." } } } },
      { k: "crawl", label: "Talk {lead} through the crawlway", who: "lead", skill: "composure", risk: "a small fault in Engineering, and {lead} shaken", grisk: "{lead} shaken", res: {
        success: { fx: { xp: 40, rep: 2, op: 2, sxp: 20, mlet: "storyGood" }, text: "You keep your voice level and walk {obj} through the Jefferies tube one junction at a time. {lead} drops out of the far hatch filthy and fine, and the bulkhead seals behind {obj}." },
        partial: { fx: { xp: 20, op: 1, sxp: 10, power: -8 }, text: "{lead} freezes halfway, and {chief} has to bleed the EPS grid to vent the tube. It works.", lines: { power: "The ship is {pw} percent down on power for the trouble." } },
        fail: { fx: { fault: "low", sys: "coolant", mlet: "storyRough" }, text: "{lead} loses {pos} nerve in the tube and backs out into the vapour before damage control can pull {obj} free. Nobody is hurt, but {lead} is shaken.", lines: { fault: "The vapour leaves a small fault in the {fsys}." } } } },
      { k: "wait", label: "Seal the bulkhead and wait for damage control", safe: true, res: {
        safe: { fx: {}, text: "You seal the bulkhead and let damage control do it by the book. Twenty minutes later they cut {lead} out, unhurt and embarrassed, and the line is patched before the next watch." } } },
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
      { k: "hear", label: "Hear them both out", who: "lead", skill: "rel", risk: "both of them sore at you", grisk: "both of them sore", res: {
        success: { fx: { xp: 40, op: 2, op2: 2, mlet: "storyGood", mlet2: "storyGood" }, text: "You make each of them tell it start to finish, and by the end the bet sounds as silly as it is. {lead} and {other} shake on a draw, and the mess hall goes back to its replicated coffee." },
        partial: { fx: { xp: 20, op: 1, mlet2: "storyFeud" }, text: "{lead} accepts your ruling with good grace. {other} accepts it with a face like a Cardassian tax audit, which is still better than a brawl." },
        fail: { fx: { op: -1, op2: -1, mlet: "storyFeud", mlet2: "storyFeud" }, text: "Your ruling satisfies nobody, and both of them leave sure you took the other's side. The shift splits along the old lines for a day or two." } } },
      { k: "round", label: "Buy the next round and make them shake on it", who: "lt", skill: "composure", cost: { rations: 15 }, risk: "the argument just gets louder", res: {
        success: { fx: { xp: 30, op: 2, op2: 2, mlet: "storyGood", mlet2: "storyGood" }, text: "A round of synthehol and a toast to the Defiant's terrible luck does what logic couldn't. {lead} and {other} shake on it, and someone starts a dom-jot game." },
        partial: { fx: { xp: 15, op: 1 }, text: "They take the drinks and the handshake, if not each other's company. The shift settles; the bet stays an open subject." },
        fail: { fx: { op2: -1, mlet: "storyFeud", mlet2: "storyFeud" }, text: "They take the drinks and keep arguing between sips. You have bought the shift a louder evening and nothing else." } } },
      { k: "leave", label: "Leave it to the shift chief", safe: true, res: {
        safe: { fx: {}, text: "You leave it to the shift chief, who splits {lead} and {other} onto different duty rosters for the week. The argument fizzles out on its own, slowly." } } },
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
      { k: "words", label: "Help {obj} find the words", who: "lt", skill: "composure", risk: "a stiff letter, and {lead} low", res: {
        success: { fx: { xp: 50, op: 3, mlet: "storyGood" }, text: "You cut the official phrases and keep the story about the night the Sentinel's crew stole the Academy parrises squares trophy. {lead} reads it back twice, then sends it before {sub} can change a word." },
        partial: { fx: { xp: 25, op: 1, mlet: "storyRough" }, text: "The letter is honest, if a little stiff in the middle. {lead} sends it, and sits quietly for a while afterwards." },
        fail: { fx: { op: -1, mlet: "storyRough" }, text: "Every draft comes out sounding like a Starfleet form letter, and you both know it. {lead} thanks you and says {sub}'ll finish it alone." } } },
      { k: "share", label: "Tell {obj} about someone you lost", who: "lead", skill: "rel", risk: "it lands too close, and {lead} pulls away", res: {
        success: { fx: { xp: 40, op: 4, mlet: "heard" }, text: "You tell {obj} about a classmate of your own, and what you wish you had written then. {lead} listens, then writes the letter in one sitting." },
        partial: { fx: { xp: 20, op: 2 }, text: "It helps some. {lead} keeps the letter short and true, and thanks you for staying." },
        fail: { fx: { op: -1, mlet: "storyRough" }, text: "Your story lands wrong, too close to {pos} own. {lead} goes quiet and asks to be alone." } } },
      { k: "guide", label: "Point {obj} to the counselor's guide", safe: true, res: {
        safe: { fx: {}, text: "You send {obj} the counselor's guide to condolence letters and an offer to read the draft later. {lead} thanks you, a little formally." } } },
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
      { k: "argue", label: "Argue salvage law with him", who: "lt", skill: "composure", risk: "lose 3 parts", grisk: "Pesk gloats", res: {
        success: { fx: { xp: 40, rep: 2, parts: 4 }, text: "You point out that Rule of Acquisition 17 says a contract binds only between Ferengi, and the Tenacity never signed one. Pesk sputters and sulks off, and the coil comes aboard.", lines: { gain: "It yields {got} for the locker." } },
        partial: { fx: { xp: 20, rep: 1, parts: 2 }, text: "Pesk agrees to split the difference, which in Ferengi means you get the casing and he gets the good half.", lines: { gain: "The casing yields {got}." } },
        fail: { fx: { parts: -3 }, text: "Pesk out-talks you, then bills you for his time.", lines: { parts: "To keep him from filing a claim with the Ferengi Commerce Authority, you hand over {lost}." } } } },
      { k: "tractor", label: "Have {lead} lock a tractor beam on the coil", who: "lead", skill: "tactical", risk: "a fault in Engineering", grisk: "Pesk gloats", res: {
        success: { fx: { xp: 30, rep: 1, parts: 4, sxp: 20, mlet: "storyGood" }, text: "{lead} snaps the tractor onto the coil a heartbeat before Pesk's grapple and reels it in with a flourish. Pesk's outraged face on the viewscreen comes free.", lines: { gain: "The coil yields {got}." } },
        partial: { fx: { xp: 15, parts: 2, power: -8 }, text: "{lead} wins the tug-of-war, but the tractor runs hot doing it.", lines: { gain: "The coil yields {got}.", power: "The ship is {pw} percent down on power." } },
        fail: { fx: { fault: "low", sys: "shields" }, text: "Pesk's grapple bites first, and he warps away with the coil.", lines: { fault: "The backwash trips the Tenacity's emitters and leaves a fault in the {fsys}." } } } },
      { k: "let", label: "Let him have it", safe: true, res: {
        safe: { fx: {}, text: "You let Pesk have the coil. He thanks you with a short speech about generosity being a disease, and his shuttle wobbles away under the weight." } } },
    ],
  },
};
export const IDS = Object.keys(EV);
const safeOf = E => E.choices.find(c => c.safe);

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
  const O = STORY.odds, W = O.words, sc = O.success * numIn(p, O.min, O.max, O.base), word = sc >= W.likely ? "likely" : sc >= W.fair ? "fair odds" : sc >= W.long ? "a long shot" : "unlikely";
  return { word, hint: word !== "likely" && numIn(p, 0, 1, 0) >= W.partialHint ? "partial or better likely" : "", full: sc };
}
export function bandOf(p, r) { const O = STORY.odds; p = numIn(p, O.min, O.max, O.base); r = numIn(r, 0, 1, 0.999); return r < O.success * p ? "success" : r < p ? "partial" : "fail"; }
const roller = (c, ch) => ch.who === "lt" ? "lt" : c.cast[ch.who] || c.cast.lead;
export function choiceP(c, ch) {
  if (!ch || ch.safe) return null;
  const op = opinionOf(c.cast.lead), sk = ch.skill === "rel" ? Math.max(0, numIn(op, -100, 100, 0)) / STORY.relSkillDiv : skillLvl(roller(c, ch), ch.skill);
  return oddsP(sk, op, c.tier);
}
// ---- gates (plan section 6) ----
let cur = null;
export const current = () => cur;
export const storyOpen = () => !!cur;
export const storyUI = { show: null, hide: null };   // set by js/ui/story.js
export function gateWhy(where = "leg") {
  if (cur) return "open";
  if (!isPresent()) return "away";
  if (offRules()) return "night";
  if (G.sp.battle) return "battle";
  if (P().jobs && P().jobs.active) return "job";
  if (G.sp.ev && G.sp.ev.active) return "task";
  if (!cheerful()) return "hushed";
  if (numIn(P().playDays, 0, 1e9, 0) < STORY.graceDays) return "grace";
  const s = S(); if (s.dayCount.d === P().day && s.dayCount.n >= STORY.perDay) return "day cap";
  if (where === "dock") { if (!atDS9()) return "not docked"; if (s.legsSince < 1) return "this dock"; }
  else { if (!G.sp.travel) return "not travelling"; if (s.legsSince < STORY.minLegs) return "leg gap"; }
  return null;
}
export const poolFor = where => IDS.filter(id => EV[id].where.includes(where) && (EV[id].gentle || numIn(P().playDays, 0, 1e9, 0) >= STORY.gentleUntil));
export function pickStory(where) {
  let pool = poolFor(where); if (pool.length > 1) pool = pool.filter(id => id !== S().last);
  let r = Math.random() * pool.reduce((a, id) => a + EV[id].w, 0);
  for (const id of pool) { r -= EV[id].w; if (r <= 0) return id; }
  return pool[0] || null;
}
// events.js: a voyage event slot comes up -> a story event takes it 35% of the time (returns the id, or null)
export function legStory() {
  if (Math.random() >= STORY.legChance || gateWhy("leg")) return null;
  const id = pickStory("leg"); return id && startStory(id, { where: "leg" }) ? id : null;
}
// events.js: docked at DS9, a modest dt-scaled chance (at most one per dock visit: legsSince resets on firing)
export function tickStoryDock(dt) {
  if (cur || !atDS9() || !(Math.random() < numIn(dt, 0, 3600, 0) * STORY.dockPerHour / 3600) || gateWhy("dock")) return null;
  const id = pickStory("dock"); return id && startStory(id, { where: "dock" }) ? id : null;
}
export function storyLeg() { const s = S(); s.legsSince = Math.min(99, s.legsSince + 1); }   // events.js evResetLeg: a new leg starts
// ---- run one ----
export function startStory(id, opts = {}) {
  const E = EV[id]; if (!E || cur) return false;
  const cast = opts.cast && occ(opts.cast.lead) ? opts.cast : E.cast(); if (!cast || !occ(cast.lead)) return false;
  const bands = relBands(cast.lead), tier = bands[0][0], v = variant(E.vars, id, cast.lead);
  cur = { id, cast, tier, vkey: v.key, text: fill(E.blurb + " " + v.t, cast), where: opts.where || "debug", res: null };
  const s = S(), d = P().day; s.last = id; s.seen[id] = (s.seen[id] || 0) + 1; s.legsSince = 0; if (s.dayCount.d !== d) s.dayCount = { d, n: 0 }; s.dayCount.n++; s.n.fired++; s.step = { id, node: 0 };
  log(`${E.title}: ${fill("{lead}", cast)} needs a decision from you.`, "comm");
  if (storyUI.show) storyUI.show(cur);
  return true;
}
const gentleFail = (band) => band === "fail" && gentle();
export function choicesOf(c = cur) {
  if (!c) return []; const E = EV[c.id], g = gentle();
  return E.choices.map(ch => {
    if (ch.safe) return { k: ch.k, safe: true, label: fill(ch.label, c.cast), sub: "no roll · safe", risk: null, ok: true, cost: null, p: null };
    const p = choiceP(c, ch), o = storyOdds(p), who = ch.who === "lt" ? "you" : nm(roller(c, ch)), sk = ch.skill === "rel" ? "Opinion" : SKILL_LABEL[ch.skill];
    const cost = ch.cost ? costText(ch.cost) : null, ok = !ch.cost || canAfford(ch.cost), risk = g && ch.grisk ? ch.grisk : ch.risk;
    return { k: ch.k, safe: false, label: fill(ch.label, c.cast), sub: [sk, who, o.word, o.hint, cost].filter(Boolean).join(" · "), risk: risk ? fill(risk, c.cast) : null, ok, why: ok ? null : `${cost} needed`, cost, p, word: o.word, hint: o.hint };
  });
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
  if (fx.sxp) { const r = roller(c, ch), k = ch.skill === "rel" ? "composure" : ch.skill; addSkillXp(r, k, fx.sxp); out.push(["good", `+${fx.sxp} ${SKILL_LABEL[k]} XP${r === "lt" ? "" : " · " + nm(r)}`]); }
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
function outcomeText(c, E, band, o, did) {
  const L = o.lines || {}, parts = [o.text];
  if (did.injured && L.injured) parts.push(L.injured); if (did.unhurt && L.unhurt) parts.push(L.unhurt);
  if (did.got && L.gain) parts.push(L.gain); if (did.lost && L.parts) parts.push(L.parts); if (did.pw && L.power) parts.push(L.power); if (did.fault && L.fault) parts.push(L.fault);
  const a = variant((E.after || {})[band], c.id + ":" + band, c.cast.lead); if (a.t) parts.push(a.t);
  const x = { fsys: did.fault ? (OKAFOR_SHORT[did.fault] || SYSTEMS[did.fault].name.toLowerCase()) : "", lost: partsW(did.lost || 0), got: partsW(did.got || 0), pw: String(did.pw || 0) };
  return { text: fill(parts.join(" "), { ...c.cast, x }), akey: a.key };
}
const BANDWORD = { success: "Success.", partial: "Partly.", fail: "It goes wrong.", safe: "" };
export function choose(k) {
  if (!cur || cur.res) return null;
  const E = EV[cur.id], ch = E.choices.find(x => x.k === k) || safeOf(E);
  if (ch.cost && !spend(ch.cost, "story")) return { ok: false, why: `${costText(ch.cost)} needed` };   // the cost is on the button and charged only when picked
  let band = "safe", p = null, r = null;
  if (!ch.safe) { p = choiceP(cur, ch); r = Math.random(); band = bandOf(p, r); }
  const o = ch.res[band], fx = gentleFail(band) ? capGentle(o.fx || {}) : (o.fx || {}), chips = ch.cost ? [["bad", `−${costText(ch.cost)}`]] : [];
  const A = applyFx(cur, ch, fx); chips.push(...A.chips);
  const T = outcomeText(cur, E, band, o, A.did);
  cur.res = { k: ch.k, band, p, r, text: T.text, akey: T.akey, did: A.did, word: BANDWORD[band], chips };
  const s = S(); s.step = null; if (band !== "safe") s.n[band]++;
  log(`${E.title}: ${T.text}`, band === "fail" ? "fault" : band === "safe" ? "comm" : "good");
  saveSoon("story");   // right after the roll (P31 rule): no reload reroll
  return { ok: true, ...cur.res };
}
// closing with no choice = the safe option; after an outcome it just closes
export function closeStory() { if (!cur) return; if (!cur.res) choose(safeOf(EV[cur.id]).k); cur = null; if (storyUI.hide) storyUI.hide(); }
// tests: every line of an event filled for a cast (blurb, all variants, labels, risks, outcomes) for the pronoun scan
export function allTexts(id, cast) {
  const E = EV[id], x = { fsys: "coolant line", lost: "three spare parts", got: "two spare parts", pw: "8" }, cx = { ...cast, x }, out = [fill(E.blurb, cx)];
  for (const cat of Object.keys(E.vars)) for (const t of E.vars[cat]) out.push(fill(t, cx));
  for (const b of Object.keys(E.after || {})) for (const cat of Object.keys(E.after[b])) for (const t of E.after[b][cat]) out.push(fill(t, cx));
  for (const ch of E.choices) { out.push(fill(ch.label, cx)); for (const r of [ch.risk, ch.grisk]) if (r) out.push(fill(r, cx)); for (const o of Object.values(ch.res)) { out.push(fill(o.text, cx)); for (const t of Object.values(o.lines || {})) out.push(fill(t, cx)); } }
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
  if (isObj(s.chain) && EV[s.chain.id]) o.chain = { id: s.chain.id, at: Math.floor(numIn(s.chain.at, 0, 5, 0)), ctx: isObj(s.chain.ctx) ? s.chain.ctx : null };
  o.step = null;   // a half-finished scene is dropped: closing counts as the safe choice
  if (isObj(s.n)) for (const k of Object.keys(o.n)) o.n[k] = Math.floor(numIn(s.n[k], 0, 1e9, 0));
  p.story = o;
}
addHardener(hardenStory);
