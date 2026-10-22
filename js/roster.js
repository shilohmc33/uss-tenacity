// Phase 3 crew roster (data only; logic in crewlife.js, tuning in PROG.crewEvents / PROG.fleet / PROG.favours).
// CREW_ROSTER = SLOTS (jobs aboard). Each slot holds one OCCUPANT with a stable id; opinions, daily caps and station
// time are keyed by the occupant id, so a transfer frees the slot, the leaver keeps their opinion (fleet reputation)
// and the replacement gets a new id and a fresh opinion. ~18 visible crew; the wider ~200 complement lives in log text.
//   dept:    command | eng | sec | ops | sci | med | svc  -> uniform tint (DEPTS) and CREW-sheet grouping
//   deck:    where they work and wander (only the Lt's current deck is simulated/rendered; max PROG.roster.maxVisible)
//   areas:   nodes / systems / decks where the Lt's help, repairs and ignored faults move this crew member's opinion
//   spots:   ambient wander spots (deck fractions; snapped to the walk mask at runtime). The first spot is their post
//            (they hold it during red alert). action: computer | talk | eat | null; t: [min,max] s; w: pick weight
//   chat:    Lt nodes on this deck where they come over for a word (npc-ambient). Seniors without a sheet still wander.
//   ladder:  "officer" | "enlisted" (promotion / demotion track); senior: protected from the daily crew roll
//   npc:     false = drawn elsewhere (T'Ren, js/npc.js) - she is still on the roster for opinions and the CREW sheet
export const DEPTS = {
  command: { name: "Command", tint: "red", color: "#c8463c" },
  eng: { name: "Engineering", tint: "gold", color: "#d4a72c" },
  sec: { name: "Security / Tactical", tint: "gold", color: "#c99a2e" },
  ops: { name: "Operations", tint: "gold", color: "#e0b440" },
  sci: { name: "Science", tint: "blue", color: "#3d8fc4" },
  med: { name: "Medical", tint: "blue", color: "#3aa6a0" },
  svc: { name: "Ship's Services", tint: "gold", color: "#b08a4a" },
};
export const DEPT_ORDER = ["command", "eng", "sec", "ops", "sci", "med", "svc"];
export const LADDERS = {
  officer: [["Ensign", "Ens"], ["Lieutenant (jg)", "Lt jg"], ["Lieutenant", "Lt"], ["Lieutenant Commander", "Lt Cmdr"], ["Commander", "Cmdr"], ["Captain", "Capt"]],
  enlisted: [["Crewman", "Crewman"], ["Petty Officer", "PO"], ["Chief Petty Officer", "CPO"], ["Senior Chief", "SCPO"]],
};
// ---- shared wander spots per deck (absolute deck fractions; clear of the Lt's node stand spots and the lifts) ----
const S = (id, x, y, face, action, t, w = 1) => ({ id, x, y, face, action, t, w });
// art batch 2 (deck_bridge_v3): the pilots SIT at conn / ops (seat: node id -> npc-ambient sits them with SEAT_ART when
// their sheet has seat art, else they stand at the seat's stand spot); the rest work the v3 stations (data.js CONSOLES).
// Ids kept from the old plate (helm / msd-aft / msd-port ...) so saved spots and tools still resolve.
const BR = {
  helm: { ...S("helm", 0.376, 0.6219, "down", null, [30, 60], 3), seat: "conn" }, ops: { ...S("ops", 0.6156, 0.6219, "down", null, [30, 60], 3), seat: "ops" },
  portUp: S("port-upper", 0.1417, 0.55, "left", "computer", [20, 40], 2), stbdUp: S("stbd-upper", 0.7979, 0.4094, "right", "computer", [20, 40], 2),   // science aft / engineering fwd
  msdAft: S("msd-aft", 0.7625, 0.5328, "down", "computer", [15, 30], 1), msdPort: S("msd-port", 0.2354, 0.5328, "down", "computer", [15, 30], 1),   // environment / mission ops
  floorP: S("floor-port", 0.27, 0.34, "down", null, [8, 16], 1), floorS: S("floor-stbd", 0.73, 0.34, "down", null, [8, 16], 1),
};
const EN = {
  portCon: S("port-console", 0.17, 0.42, "right", "computer", [25, 50], 3), stbdCon: S("stbd-console", 0.71, 0.53, "left", "computer", [25, 50], 3),
  southW: S("south-west", 0.36, 0.67, "up", "computer", [20, 40], 2), southE: S("south-east", 0.56, 0.67, "up", "computer", [20, 40], 2),
  lockerW: S("locker-west", 0.30, 0.925, "up", "computer", [15, 30], 2), lockerE: S("locker-east", 0.44, 0.925, "up", null, [10, 20], 1),
  pads: S("pads", 0.16, 0.20, "up", "computer", [25, 50], 3), padsDoor: S("pads-door", 0.22, 0.31, "down", null, [10, 20], 1),
  racks: S("torpedo-racks", 0.72, 0.30, "right", "computer", [25, 50], 3), corridor: S("corridor-west", 0.12, 0.58, "down", null, [8, 16], 1),
};
const MD = {
  bedN: S("bedside-north", 0.30, 0.30, "left", "computer", [25, 50], 3), bedS: S("bedside-south", 0.30, 0.60, "left", "computer", [25, 50], 3),
  surgery: S("surgery", 0.3771, 0.6906, "up", "computer", [20, 40], 2), office: S("office", 0.62, 0.24, "up", "computer", [25, 50], 2),
  lab: S("lab-bench", 0.72, 0.53, "up", "computer", [25, 50], 3), labIdle: S("lab-floor", 0.66, 0.70, "down", null, [8, 16], 1),
  hall: S("hall", 0.50, 0.25, "down", null, [8, 16], 1),
};
const BE = {
  doorW: S("cabin-west", 0.20, 0.44, "up", null, [20, 40], 2), doorM: S("cabin-mid", 0.45, 0.44, "up", null, [20, 40], 2),
  doorE: S("cabin-east", 0.64, 0.44, "up", null, [15, 30], 1), aft: S("aft-hall", 0.82, 0.62, "right", null, [15, 30], 2),
  lounge: S("seating", 0.72, 0.86, "down", "talk", [20, 40], 2),
};
const LO = {
  planters: S("hydroponics", 0.56, 0.69, "down", "computer", [30, 60], 3), plantersE: S("hydroponics-east", 0.70, 0.69, "down", "computer", [25, 50], 2),
  windowS: S("viewport", 0.70, 0.55, "right", null, [15, 30], 1), tableW: S("table-west", 0.33, 0.56, "down", "eat", [25, 45], 2),
  galley: S("galley-pass", 0.30, 0.36, "up", "computer", [20, 40], 3), barEnd: S("bar-west", 0.33, 0.35, "up", "talk", [20, 35], 2),
};
export const CREW_ROSTER = [
  // ---- senior staff (protected from the daily roll; their battle abilities depend on them) ----
  { slot: "co", role: "Commanding Officer", dept: "command", deck: "bridge", senior: true, npc: false, ladder: "officer",
    areas: { nodes: ["chair"], decks: ["bridge"], systems: [] }, spots: [], chat: [] },
  { slot: "chief-engineer", role: "Chief Engineer", dept: "eng", deck: "engineering", senior: true, ladder: "officer",
    areas: { nodes: ["core", "shield", "locker"], decks: ["engineering"], systems: ["warpcore", "shields", "eps", "coolant"] },
    spots: [EN.southE, EN.southW, EN.portCon, EN.stbdCon, EN.lockerE], chat: ["core", "shield"] },
  { slot: "science", role: "Science Officer", dept: "sci", deck: "bridge", senior: true, ladder: "officer",
    areas: { nodes: ["msd", "pads"], decks: [], systems: ["transporter"] }, spots: [BR.stbdUp, BR.msdAft, BR.floorS], chat: ["msd"] },
  { slot: "tactical", role: "Security / Tactical", dept: "sec", deck: "bridge", senior: true, ladder: "officer",
    areas: { nodes: ["torpbay"], decks: [], systems: ["phasers", "loader"] }, spots: [BR.portUp, BR.msdPort, BR.floorP], chat: ["msd"] },
  // ---- department regulars ----
  { slot: "doctor", role: "Ship's Doctor", dept: "med", deck: "medical", ladder: "officer",
    areas: { nodes: ["biobed"], decks: ["medical"], systems: [] }, spots: [MD.bedN, MD.office, MD.surgery, MD.hall], chat: ["biobed"] },
  { slot: "nurse", role: "Nurse", dept: "med", deck: "medical", ladder: "officer",
    areas: { nodes: ["biobed"], decks: ["medical"], systems: [] }, spots: [MD.bedS, MD.surgery, MD.labIdle, MD.hall], chat: ["biobed"] },
  { slot: "engineer-1", role: "Warp Specialist · under Okafor", dept: "eng", deck: "engineering", ladder: "officer",
    areas: { nodes: ["core"], decks: ["engineering"], systems: ["warpcore", "coolant", "eps"] }, spots: [EN.southW, EN.portCon, EN.lockerW, EN.corridor], chat: ["core", "locker"] },
  { slot: "engineer-2", role: "Systems Engineer · under Okafor", dept: "eng", deck: "engineering", ladder: "officer",
    areas: { nodes: ["shield", "locker"], decks: ["engineering"], systems: ["shields", "eps"] }, spots: [EN.stbdCon, EN.lockerW, EN.southE, EN.lockerE], chat: ["shield", "locker"] },
  { slot: "conn", role: "Conn Officer", dept: "command", deck: "bridge", ladder: "officer",
    areas: { nodes: ["chair"], decks: ["bridge"], systems: [] }, spots: [BR.helm, BR.floorP, BR.msdPort], chat: ["chair", "msd"] },
  { slot: "ops", role: "Operations Officer", dept: "ops", deck: "bridge", ladder: "officer",
    areas: { nodes: ["msd"], decks: ["bridge"], systems: [] }, spots: [BR.ops, BR.floorS, BR.msdAft], chat: ["msd"] },
  { slot: "security", role: "Security Chief · torpedo bay", dept: "sec", deck: "engineering", ladder: "enlisted",
    areas: { nodes: ["torpbay"], decks: [], systems: ["phasers", "loader"] }, spots: [EN.racks, EN.stbdCon, EN.corridor], chat: ["torpbay"] },
  // ---- regular crew ----
  { slot: "transporter", role: "Transporter Chief", dept: "ops", deck: "engineering", ladder: "enlisted",
    areas: { nodes: ["pads"], decks: [], systems: ["transporter"] }, spots: [EN.pads, EN.padsDoor, EN.corridor], chat: ["pads"] },
  { slot: "science-tech", role: "Science Technician · medical lab", dept: "sci", deck: "medical", ladder: "officer",
    areas: { nodes: [], decks: ["medical"], systems: [] }, spots: [MD.lab, MD.labIdle, MD.office], chat: ["biobed"] },
  { slot: "yeoman", role: "Captain's Yeoman", dept: "command", deck: "berthing", ladder: "enlisted",
    areas: { nodes: ["bunk"], decks: ["berthing"], systems: [] }, spots: [BE.doorW, BE.doorM, BE.aft, BE.lounge], chat: ["bunk"] },
  { slot: "crewman", role: "Crewman · damage control", dept: "ops", deck: "berthing", ladder: "enlisted",
    areas: { nodes: ["bunk"], decks: ["berthing"], systems: [] }, spots: [BE.lounge, BE.doorE, BE.doorM, BE.aft], chat: ["bunk"] },
  { slot: "mess-regular-1", role: "Crewman · Mess hall regular", dept: "svc", deck: "lounge", ladder: "enlisted", ambient: "thelev",
    areas: { nodes: ["mess", "bar"], decks: ["lounge"], systems: [] }, spots: [], chat: ["mess", "bar"] },
  { slot: "steward", role: "Mess Steward", dept: "svc", deck: "lounge", ladder: "enlisted",
    areas: { nodes: ["mess", "bar"], decks: ["lounge"], systems: [] }, spots: [LO.galley, LO.barEnd, LO.tableW], chat: ["bar"] },
  { slot: "botanist", role: "Botanist · hydroponics", dept: "sci", deck: "lounge", ladder: "officer",
    areas: { nodes: [], decks: ["lounge"], systems: [] }, spots: [LO.planters, LO.plantersE, LO.windowS], chat: ["mess"] },
];
export const SLOTMAP = Object.fromEntries(CREW_ROSTER.map(s => [s.slot, s]));

// ---- species: rarity weight for the transfer-in generator, name pools, badge colour (sprite sheets: data.js SPECIES_SHEETS) ----
// names: "given family" pools (Bajoran: family first; Vulcan / Andorian / Benzite / Caitian use single names).
export const SPECIES = {
  human: { name: "Human", weight: 30, color: "#d9a27a", given: ["Maren", "Priya", "Tomas", "Rosa", "Kofi", "Ines", "Dmitri", "Aiyana", "Liang", "Noor", "Callum", "Sanna", "Mateo", "Hiroko"], family: ["Kovac", "Natarajan", "Delgado", "Abernathy", "Mensah", "Lindqvist", "Oduya", "Raskin", "Halvorsen", "Quispe", "Brennan", "Iwu"] },
  vulcan: { name: "Vulcan", weight: 9, color: "#b9a37a", single: ["Sorvan", "T'Vessa", "Strell", "T'Mira", "Sopek", "T'Lani", "Vossik", "Senna"] },
  andorian: { name: "Andorian", weight: 7, color: "#6fb7ff", single: ["Thelev sh'Zarath", "Ravhis th'Elen", "Shiara ch'Voss", "Tavrel zh'Iren", "Keshra sh'Onel"] },
  bajoran: { name: "Bajoran", weight: 8, color: "#d7a46b", familyFirst: true, given: ["Kalen", "Essa", "Rion", "Taya", "Mevi", "Torel"], family: ["Doru", "Pell", "Varo", "Anyr", "Sela", "Hesh"] },
  betazoid: { name: "Betazoid", weight: 7, color: "#9a7fd1", given: ["Ianna", "Davin", "Mirel", "Tessaly", "Orin"], family: ["Rhovan", "Kestari", "Lenthe", "Vasari"] },
  trill: { name: "Trill", weight: 6, color: "#c99b6f", given: ["Jessa", "Halen", "Corin", "Ysel"], family: ["Orvin", "Tarash", "Belan", "Ketheri"] },
  bolian: { name: "Bolian", weight: 6, color: "#5d8fd6", given: ["Brennik", "Hosa", "Marl", "Tesk"], family: ["Tull", "Garvo", "Pemm", "Obrel"] },
  tellarite: { name: "Tellarite", weight: 5, color: "#b07a5a", given: ["Skarn", "Brega", "Grosh", "Velka"], family: ["Grevv", "Thrass", "Mork", "Delg"] },
  benzite: { name: "Benzite", weight: 4, color: "#5fb3a6", single: ["Vardock", "Zenock", "Merrick", "Tallock", "Ressock"] },
  denobulan: { name: "Denobulan", weight: 5, color: "#c4956b", given: ["Drezz", "Ollo", "Fennix", "Zhara"], family: ["Mollo", "Ruzz", "Pellix", "Avvo"] },
  klingon: { name: "Klingon", weight: 1.5, color: "#a5543a", single: ["Morgath", "K'Valla", "Torvak", "B'Ressa", "Kurrag"] },   // rare
  caitian: { name: "Caitian", weight: 1.5, color: "#d6a650", single: ["R'Mira", "M'Shaal", "Rrenn", "T'Purra", "Shirrah"] },     // rare
};
// personality tags: flavour chat lines and crew-event lines ({short} = their name, {lt} = how they address the Lt)
export const TAGS = {
  gruff: ["{short}: 'If it's not on fire, it can wait. If it is on fire, why are you talking to me?'", "{short} grunts at the readouts. 'Acceptable. Barely. Good work, {lt}.'"],
  chatty: ["{short}: 'Did you hear? Somebody on deck four is growing tomatoes in a torpedo casing.'", "{short} talks for a full minute before getting to the point. The point is: thanks, {lt}."],
  earnest: ["{short}: 'I read your repair notes twice. The second time I understood them.'", "{short}: 'Permission to shadow you on the next CRITICAL, {lt}? For training.'"],
  dry: ["{short}: 'The ship survived another day. I'll alert the historians.'", "{short}, deadpan: 'Lovely work. I almost didn't notice the smoke.'"],
  warm: ["{short}: 'You look tired, {lt}. Sit down a minute — the ship will still be broken in five.'", "{short} smiles. 'Glad you're aboard. Really.'"],
  ambitious: ["{short}: 'One day I'll have a warp core of my own. Until then I'll steal yours.'", "{short}: 'I heard the board likes initiative. Asking for me, not for you.'"],
  calm: ["{short}: 'Breathe. Whatever it is, it was broken before you arrived.'", "{short} works without hurry and finishes first, as usual."],
  homesick: ["{short}: 'My family's orchard is blooming this month. I can smell it if I close my eyes.'", "{short} shows you a holo from home. You make the right noises."],
  curious: ["{short}: 'Why does the Tenacity hum a quarter-tone flat on deck two? I have a theory.'", "{short}: 'Can I see that hyperspanner? I've never seen one wear like that.'"],
  devout: ["{short}: 'The Prophets favour the patient, {lt}. So does a coolant line.'", "{short} murmurs a short blessing over the console. It boots first try."],
  blunt: ["{short}: 'Your last report was wrong in three places. The repair was right. Fix the report.'", "{short}: 'You're good. Don't let it go to your head; your head's big enough.'"],
  playful: ["{short} bats a loose stylus across the console. 'What? It was asking for it.'", "{short}: 'Race you to the turbolift. Loser files the parts report.'"],
  stoic: ["{short} nods once. From {obj}, that's a standing ovation.", "{short}: 'Adequate.' A pause. 'More than adequate.'"],
  musical: ["{short} is humming something from home. It fits the warp core's rhythm exactly.", "{short}: 'Jam session in the mess at 2100. Bring something that makes noise.'"],
};
export const TAG_KEYS = Object.keys(TAGS);
// new postings for crew who transfer off: each feeds one favour contact (PROG.favours[].contact)
export const POSTINGS = {
  utopia: { name: "Utopia Planitia Fleet Yards", depts: ["eng"] },
  sb375: { name: "Starbase 375", depts: ["ops", "eng", "svc"] },
  ds9ops: { name: "Deep Space Nine ops", depts: ["ops", "command", "svc"] },
  intel: { name: "Starfleet Intelligence", depts: ["sec", "command"] },
  qonos: { name: "a Qo'noS liaison posting", depts: ["sec"] },
  vsa: { name: "the Vulcan Science Academy", depts: ["sci", "med"] },
  medical: { name: "Starfleet Medical", depts: ["med"] },
  ship: { name: "the USS Bellerophon's bridge", depts: ["command", "ops"] },
  hospital: { name: "the Starbase 375 hospital", depts: [] },        // phase 6: a favourite's worst case (never a roll posting)
  hospitalship: { name: "the hospital ship USS Pasteur", depts: [] }, // phase 6: gentle mode evacuation
};
// ---- the starting crew (18). id = stable occupant id (seniors keep their phase-2 ids, so v3 opinions carry over) ----
// img: portrait asset (seniors only for now); others show an initials badge in their department colour.
const O = (id, slot, rank, name, short, species, tags, extra = {}) => ({ id, slot, rank, name, short, species, tags, ...extra });
export const START_CREW = [
  O("tren", "co", 5, "Soval T'Ren", "T'Ren", "vulcan", ["stoic", "dry"], { img: "crew-captain", sheet: "tren" }),
  O("okafor", "chief-engineer", 4, "Okafor", "Okafor", "human", ["gruff", "warm"], { img: "crew-engineer" }),
  O("diallo", "science", 3, "Amara Diallo", "Diallo", "human", ["curious", "warm"], { img: "crew-science" }),
  O("hale", "tactical", 3, "Viktor Hale", "Hale", "human", ["blunt", "playful"], { img: "crew-security" }),
  O("orvin", "doctor", 2, "Jessa Orvin", "Orvin", "trill", ["calm", "dry"]),
  O("tull", "nurse", 0, "Brennik Tull", "Tull", "bolian", ["chatty", "warm"]),
  O("kovac", "engineer-1", 1, "Maren Kovac", "Kovac", "human", ["ambitious", "blunt"]),
  O("seo", "engineer-2", 0, "Mirae Seo", "Seo", "human", ["earnest", "homesick"]),
  O("doru", "conn", 1, "Doru Kalen", "Doru", "bajoran", ["devout", "calm"]),
  O("rhovan", "ops", 1, "Ianna Rhovan", "Rhovan", "betazoid", ["warm", "playful"]),
  O("grevv", "security", 1, "Skarn Grevv", "Grevv", "tellarite", ["blunt", "gruff"]),
  O("mollo", "transporter", 2, "Drezz Mollo", "Mollo", "denobulan", ["chatty", "curious"]),
  O("vardock", "science-tech", 0, "Vardock", "Vardock", "benzite", ["earnest", "curious"]),
  O("natarajan", "yeoman", 1, "Priya Natarajan", "Natarajan", "human", ["chatty", "ambitious"]),
  O("rmira", "crewman", 0, "R'Mira", "R'Mira", "caitian", ["playful", "musical"]),
  O("thelev", "mess-regular-1", 0, "Thelev sh'Zarath", "Thelev", "andorian", ["blunt", "warm"]),   // crewwoman, she/her
  O("delgado", "steward", 1, "Rosa Delgado", "Delgado", "human", ["warm", "chatty"]),
  O("sorvan", "botanist", 0, "Sorvan", "Sorvan", "vulcan", ["calm", "curious"]),
];
// pt04 m7: per-occupant 'protected' flag: never picked for a random transfer, never seriously injured or killed (phase 6).
// Thelev is Shiloh's social-test character (named ambient NPC with art and custom lines).
for (const o of START_CREW) if (o.id === "thelev") o.protected = true;
// Personal Log phase 1 (save v8): every crewmate carries a pronoun. Shiloh fixed T'Ren, Okafor, Diallo, Thelev = she and
// Hale = he; the rest are a mix (some they). Generated crew roll one (genOccupant); alumni keep theirs.
export const START_PRONOUNS = { tren: "she", okafor: "she", diallo: "she", hale: "he", orvin: "they", tull: "he", kovac: "she", seo: "she", doru: "he",
  rhovan: "she", grevv: "he", mollo: "he", vardock: "they", natarajan: "she", rmira: "she", thelev: "she", delgado: "she", sorvan: "they" };
for (const o of START_CREW) o.pronoun = START_PRONOUNS[o.id] || "they";
export const PRONOUNS = {
  she: { sub: "she", obj: "her", pos: "her", poss: "hers", ref: "herself", is: "is", has: "has", s: "s" },
  he: { sub: "he", obj: "him", pos: "his", poss: "his", ref: "himself", is: "is", has: "has", s: "s" },
  they: { sub: "they", obj: "them", pos: "their", poss: "theirs", ref: "themself", is: "are", has: "have", s: "" },
};
// pr(o, "sub") -> "she"; Pr(o, "sub") -> "She". o: an occupant, alumnus, roster entry or crew-list row (falls back to they)
export const pr = (o, form = "sub") => (PRONOUNS[o && o.pronoun] || PRONOUNS.they)[form];
// fill {sub} {obj} {pos} {ref} (and {Sub} etc. capitalised) in a crew line for crewmate o
export const prFill = (str, o) => str.replace(/\{(sub|obj|pos|poss|ref|Sub|Obj|Pos|Poss|Ref)\}/g, (_, f) => f[0] === f[0].toUpperCase() ? Pr(o, f.toLowerCase()) : pr(o, f));
export const Pr = (o, form = "sub") => { const w = pr(o, form); return w.charAt(0).toUpperCase() + w.slice(1); };
