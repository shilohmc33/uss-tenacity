// Static game data, ported from the Muse prototype (reference/game.html).
// All deck coordinates are fractions of a 960x640 design plate.
// Walkable floor comes from the painted walk masks assets/walk-<deck>.png (see tools/make-walk-masks.py, sampled into the
// 60x40 grid by path.js). The base/blocks rectangles below are only a coarse fallback if a mask fails to load.
// Node x,y = where the Lt's feet stand (always on mask floor); mx,my = what he faces / where markers sit.
import { CABIN_TIERS } from "./cabin-data.js";
export const DW = 960, DH = 640;
export const COLS = 60, ROWS = 40;
const R = (x0, y0, x1, y1) => [x0, y0, x1, y1];

export const DECK_ORDER = ["bridge", "engineering", "medical", "berthing", "quarters", "lounge"];
export const CREW_DECKS = ["bridge", "engineering", "medical", "berthing", "lounge"];   // decks with painted plates + walk masks
export const DECKS = {
  bridge: {
    name: "Bridge", plate: "deck-bridge", glow: [0.50, 0.255, "140,180,255"],
    lift: { x: 0.49, y: 0.1625, mx: 0.49, my: 0.105 },
    base: [R(0.105, 0.055, 0.895, 0.60)],
    blocks: [R(0.40, 0.185, 0.60, 0.32), R(0.44, 0.345, 0.55, 0.455), R(0.27, 0.46, 0.44, 0.645), R(0.56, 0.46, 0.72, 0.645),
      R(0.06, 0.235, 0.225, 0.665), R(0.765, 0.235, 0.94, 0.65), R(0.315, 0.05, 0.385, 0.16), R(0.615, 0.05, 0.685, 0.16)],
    nodes: {
      msd: { name: "Master Systems Display", chip: "Master Systems", x: 0.425, y: 0.3375, mx: 0.47, my: 0.26 },
      chair: { name: "Captain's Chair", chip: "Captain's Chair", x: 0.495, y: 0.49, mx: 0.495, my: 0.395 },
    },
  },
  engineering: {
    name: "Engineering", plate: "deck-engineering", glow: [0.45, 0.30, "120,200,255"],
    lift: { x: 0.86, y: 0.875, mx: 0.855, my: 0.79 },
    base: [R(0.06, 0.03, 0.275, 0.30), R(0.095, 0.255, 0.79, 0.775), R(0.03, 0.775, 0.755, 0.975), R(0.755, 0.725, 0.98, 0.975)],
    blocks: [R(0.265, 0.115, 0.64, 0.44), R(0.315, 0.44, 0.615, 0.585), R(0.19, 0.31, 0.295, 0.60), R(0.615, 0.31, 0.715, 0.595),
      R(0.775, 0.055, 0.95, 0.725), R(0.695, 0.125, 0.765, 0.275), R(0.10, 0.11, 0.25, 0.20), R(0.06, 0.03, 0.275, 0.085),
      R(0.04, 0.79, 0.28, 0.92), R(0.40, 0.79, 0.75, 0.92), R(0.77, 0.755, 0.815, 0.905), R(0.115, 0.715, 0.27, 0.78),
      R(0.69, 0.64, 0.78, 0.765), R(0.05, 0.38, 0.125, 0.76), R(0.06, 0.235, 0.115, 0.275), R(0.205, 0.235, 0.275, 0.275),
      R(0.03, 0.755, 0.29, 0.79), R(0.37, 0.755, 0.755, 0.79)],
    nodes: {
      core: { name: "Warp Core Console", chip: "Warp Core", x: 0.455, y: 0.59, mx: 0.455, my: 0.505, system: "warpcore" },
      shield: { name: "Shield Console", chip: "Shields", x: 0.335, y: 0.50, mx: 0.29, my: 0.50, system: "shields" },
      torpbay: { name: "Torpedo Bay", chip: "Torpedo Bay", x: 0.755, y: 0.42, mx: 0.86, my: 0.42, system: "phasers" },
      locker: { name: "Parts Locker", chip: "Parts Locker", x: 0.58, y: 0.92, mx: 0.58, my: 0.85 },
      pads: { name: "Transporter Pads", chip: "Transporter", x: 0.16, y: 0.27, mx: 0.16, my: 0.20 },
    },
  },
  medical: {
    name: "Medical", plate: "deck-medical", glow: [0.185, 0.475, "120,255,215"],
    lift: { x: 0.51, y: 0.7625, mx: 0.51, my: 0.83 },
    base: [R(0.105, 0.23, 0.35, 0.845), R(0.35, 0.44, 0.665, 0.775), R(0.665, 0.44, 0.875, 0.815), R(0.55, 0.23, 0.79, 0.315),
      R(0.595, 0.295, 0.67, 0.445), R(0.105, 0.76, 0.875, 0.865)],
    blocks: [R(0.115, 0.235, 0.295, 0.315), R(0.115, 0.335, 0.29, 0.41), R(0.11, 0.435, 0.28, 0.515), R(0.105, 0.55, 0.27, 0.64),
      R(0.10, 0.685, 0.255, 0.775), R(0.345, 0.29, 0.605, 0.695), R(0.685, 0.315, 0.875, 0.51), R(0.69, 0.575, 0.805, 0.695),
      R(0.86, 0.46, 0.96, 0.815), R(0.535, 0.03, 0.815, 0.225)],
    nodes: {
      biobed: { name: "Biobed", chip: "Biobed", x: 0.308, y: 0.4375, mx: 0.205, my: 0.435, lie: [0.205, 0.433], lieRot: -Math.PI / 2, lieLen: 150, rest: 10 },
    },
  },
  berthing: {
    name: "Berthing", plate: "deck-berthing", glow: [0.80, 0.16, "255,196,110"],
    lift: { x: 0.555, y: 0.89, mx: 0.555, my: 0.79 },
    base: [R(0.045, 0.385, 0.96, 0.515), R(0.735, 0.045, 0.955, 0.29), R(0.79, 0.29, 0.965, 0.905), R(0.44, 0.83, 0.80, 0.97)],
    blocks: [R(0.775, 0.095, 0.825, 0.235), R(0.835, 0.095, 0.925, 0.185), R(0.855, 0.315, 0.935, 0.405), R(0.875, 0.535, 0.94, 0.64),
      R(0.445, 0.82, 0.51, 0.94), R(0.705, 0.82, 0.775, 0.94)],
    nodes: {
      bunk: { name: "Bunk", chip: "Bunk", x: 0.80, y: 0.2625, mx: 0.80, my: 0.16, lie: [0.80, 0.162], lieLen: 96, rest: 6.5 },
    },
  },
  // phase 4: the Lt's Quarters (a berthing cabin with its own turbolift stop). Plate, walk grid, lift and the rack are
  // re-pointed to the current rank's CABIN_TIERS entry by js/cabin.js applyTier(); these are the Lt jg defaults.
  quarters: {
    name: "Lt's Quarters", plate: "cabin-ph-ltjg", glow: [0.50, 0.30, "255,205,140"], cabin: true,
    lift: { ...CABIN_TIERS.ltjg.lift },
    base: CABIN_TIERS.ltjg.floor, blocks: CABIN_TIERS.ltjg.blocks,
    nodes: {
      rack: { name: "Your Rack", chip: "Rest (quarters)", ...CABIN_TIERS.ltjg.bed, rest: CABIN_TIERS.ltjg.rest, quarters: true },
    },
  },
  lounge: {
    name: "Mess & Bar", plate: "deck-lounge", glow: [0.42, 0.27, "255,190,110"],
    lift: { x: 0.145, y: 0.6625, mx: 0.145, my: 0.555 },
    base: [R(0.25, 0.20, 0.815, 0.945), R(0.035, 0.45, 0.235, 0.745), R(0.235, 0.615, 0.285, 0.685)],
    blocks: [R(0.225, 0.205, 0.625, 0.36), R(0.25, 0.015, 0.645, 0.205), R(0.365, 0.415, 0.43, 0.485), R(0.495, 0.415, 0.56, 0.485),
      R(0.62, 0.41, 0.685, 0.48), R(0.37, 0.585, 0.435, 0.655), R(0.515, 0.58, 0.58, 0.65), R(0.66, 0.575, 0.725, 0.645),
      R(0.485, 0.73, 0.855, 0.955)],
    nodes: {
      // standing high-top tables (v2 art): the Lt eats standing just north of the middle top-row table, facing it
      mess: { name: "Mess Table", chip: "Mess Table", x: 0.525, y: 0.4125, mx: 0.521, my: 0.448, rest: 5, face: "down" },
      bar: { name: "Bar Counter", chip: "Bar Counter", x: 0.4425, y: 0.3375, mx: 0.4425, my: 0.27, rest: 2.5 },
    },
  },
};
// Per-deck light on the crew (playtest-02 NEW-08 / S6). Retune here when the new deck art lands.
//   tint:  "r,g,b" multiplied into crew sprites at strength a (0.10-0.15 = subtle cast of the room's light)
//   The low-power darkening (power < 20) is applied after the characters, so it dims them with the deck.
export const DECK_LIGHT = {
  bridge:      { tint: "190,205,255", a: 0.10 },   // cool console light
  engineering: { tint: "120,200,255", a: 0.12 },   // warp-core blue
  medical:     { tint: "120,255,215", a: 0.13 },   // dim sickbay teal
  berthing:    { tint: "255,196,110", a: 0.14 },   // warm amber cabin light
  lounge:      { tint: "255,190,110", a: 0.15 },   // warm bar amber
  quarters:    { tint: "255,214,160", a: 0.10 },   // warm cabin lamp
};
export const NODEMAP = {};
for (const d of DECK_ORDER) for (const [id, n] of Object.entries(DECKS[d].nodes)) { n.deck = d; n.id = id; NODEMAP[id] = n; }

// Optional per-system repairPose: "kneel" (floor-level work) — default repair animation is "weld".
export const SYSTEMS = {
  warpcore: { name: "Warp Core", fault: "Warp core instability", deck: "engineering", x: 0.455, y: 0.59, mx: 0.45, my: 0.30, node: "core", dur: 6 },
  shields: { name: "Shield Generator", fault: "Shield emitter failure", deck: "engineering", x: 0.335, y: 0.50, mx: 0.29, my: 0.47, node: "shield", dur: 5 },
  phasers: { name: "Torpedo Launcher", fault: "Launcher misalignment", deck: "engineering", x: 0.755, y: 0.42, mx: 0.86, my: 0.20, node: "torpbay", dur: 5 },
  eps: { name: "EPS Conduit", fault: "EPS fault — locker conduit", deck: "engineering", x: 0.47, y: 0.92, mx: 0.47, my: 0.83, node: null, dur: 5 },
  coolant: { name: "Coolant Line", fault: "Coolant leak", deck: "engineering", x: 0.455, y: 0.59, mx: 0.565, my: 0.28, node: null, dur: 6 },
  transporter: { name: "Transporter", fault: "Transporter buffer fault", deck: "engineering", x: 0.16, y: 0.27, mx: 0.175, my: 0.19, node: null, dur: 4 },
  loader: { name: "Torpedo Loader", fault: "Torpedo loader jam", deck: "engineering", x: 0.755, y: 0.55, mx: 0.815, my: 0.575, node: null, dur: 4 },
};
export const OKAFOR_SHORT = { warpcore: "core", shields: "shield generator", phasers: "launcher", eps: "EPS conduit",
  coolant: "coolant line", transporter: "transporter", loader: "loader" };
export const SEV_LABEL = { low: "LOW", med: "MEDIUM", crit: "CRITICAL" };
export const SEV_RANK = { crit: 0, med: 1, low: 2 };
export const PRI_LABEL = { 1: "CAPTAIN", 2: "CHIEF", 3: "ROUTINE", 4: "ODD JOB" };
export const GATE_SYSTEMS = { warpcore: 1, loader: 1, eps: 1, shields: 1 };
// main engine room rect (Okafor's "supported" zone)
export const ENG_ROOM = R(0.26, 0.06, 0.68, 0.73);

export const DESTS = {
  ds9: { name: "Deep Space Nine", time: 18, col: "#99ccff", meta: "Safe harbor", bg: "bg-ds9" },
  convoy: { name: "Convoy Route", time: 26, col: "#ff9900", meta: "Escort duty", bg: "bg-convoy" },
  nebula: { name: "Omarion Nebula", time: 34, col: "#cc99cc", meta: "Exploration", bg: "space-backdrop" },
  hulk: { name: "Derelict Hulk", time: 30, col: "#ffcc66", meta: "Salvage", bg: "bg-derelict" },
  earth: { name: "Earth", time: 64, col: "#99ccff", meta: "Diplomatic — Starfleet Command", bg: "bg-earth", visit: 30 },
  qonos: { name: "Qo'noS", time: 70, col: "#ff9966", meta: "Diplomatic — joint operations", bg: "bg-qonos", visit: 26 },
  romulus: { name: "Romulus", time: 76, col: "#9fe8b1", meta: "Diplomatic — intelligence exchange", bg: "bg-romulus", visit: 26 },
  vulcan: { name: "Vulcan", time: 58, col: "#ffcc99", meta: "Diplomatic — Science Academy", bg: "bg-vulcan", visit: 24 },
};
export const isHomeworld = id => !!(DESTS[id] && DESTS[id].visit);

export const OFFICERS = [
  { id: "pattern", who: "Capt Soval T'Ren", role: "Commanding Officer · Vulcan", ability: "Attack Pattern Analysis", desc: "Incoming damage halved 20s", img: "crew-captain" },
  { id: "miracle", who: "CDR Okafor", role: "Chief Engineer · your boss", ability: "Miracle Worker", desc: "Instant fault fix + hull +8% (75s). Empowered +14%/45s with you in Engineering", img: "crew-engineer" },
  { id: "scan", who: "Lt Cmdr Amara Diallo", role: "Science Officer", ability: "Weak-Point Scan", desc: "Weapon damage +50% 15s", img: "crew-science" },
  { id: "spread", who: "Lt Cmdr Viktor Hale", role: "Security / Tactical", ability: "Torpedo Spread", desc: "Fires all loaded torpedoes", img: "crew-security" },
];

// ---- crew roster: moved to js/roster.js in phase 3 (CREW_ROSTER slots + occupants, SPECIES, TAGS, POSTINGS) ----

export const CHAIR_LINES = [
  "T'Ren, standing at the chair's shoulder, eyes still on the viewscreen: 'Probability, Lieutenant, is simply honesty with numbers attached.'",
  "T'Ren: 'The chair is heavier than it looks, Lieutenant. That is not a metaphor about mass.'",
  "T'Ren: 'You stand where I can see you, Lieutenant. That is not sentiment. It is supervision.'",
  "T'Ren: 'Every captain hears the ship differently. I hear her arithmetic.'",
  "T'Ren: 'Probability we speak of this moment again: low. See that it stays that way — keep her flying.'",
];
export const BAR_LINES = [
  "The bar runs on ship's gossip: apparently the Tenacity is 'too old to die and too stubborn to scrap.' The barkeep pours the Lieutenant something amber and entirely synthahol.",
  "A yeoman at the bar is telling the torpedo story again — the one where Hale's spread 'came back with souvenirs.' It gets better every telling and less true.",
  "Bar talk: someone has started a pool on when the old girl's hull next sees a spacedock. The smart money, the barkeep says, is 'she'll outlive the pool.'",
  "The barkeep slides the Lieutenant a drink 'on the Captain's tab — she doesn't know she has one.' Somewhere below, the core hums through the deckplates.",
];

// ---- sprite atlases (harvested, per-frame anchors from the prototype) ----
// Characters are drawn at 2x (Shiloh, 2026-10-17): standing Lt ~134 design px tall (was 67). STEP_LEN is the
// distance per walk half-cycle (scaled with the figure, slightly under 2x because walk speed went up 1.35x).
// LIE_LEN is the 2x default lying length; beds that are shorter in the art clamp it with node.lieLen.
export const FIG_H = 134, LIE_LEN = 178, STEP_LEN = 70;
export const CHAR_SCALE = 2;
export const CREW_FRAMES = {
  "down-idle": { x: 6, y: 6, w: 111, h: 372, ax: 54.8, ay: 372, refH: 372 },
  "down-stepA": { x: 157, y: 6, w: 132, h: 372, ax: 68.0, ay: 372, refH: 372 },
  "down-pass": { x: 329, y: 6, w: 154, h: 372, ax: 65.5, ay: 372, refH: 372 },
  "down-stepB": { x: 523, y: 6, w: 143, h: 372, ax: 68.7, ay: 372, refH: 372 },
  "up-idle": { x: 6, y: 398, w: 135, h: 355, ax: 67.0, ay: 355, refH: 376.9 },
  "up-stepA": { x: 147, y: 398, w: 134, h: 388, ax: 58.0, ay: 388, refH: 374.1 },
  "up-pass": { x: 287, y: 398, w: 120, h: 345, ax: 51.5, ay: 345, refH: 335 },
  "up-stepB": { x: 413, y: 398, w: 120, h: 348, ax: 70.0, ay: 348, refH: 335 },
  "left-idle": { x: 6, y: 798, w: 69, h: 354, ax: 29.5, ay: 354, refH: 354 },
  "left-stepA": { x: 81, y: 798, w: 188, h: 355, ax: 101.0, ay: 355, refH: 355 },
  "left-pass": { x: 275, y: 798, w: 116, h: 365, ax: 46.5, ay: 365, refH: 365 },
  "left-stepB": { x: 397, y: 798, w: 187, h: 365, ax: 95.5, ay: 365, refH: 365 },
  "right-idle": { x: 6, y: 1175, w: 72, h: 369, ax: 39.0, ay: 369, refH: 369 },
  "right-stepA": { x: 84, y: 1175, w: 250, h: 371, ax: 118.5, ay: 371, refH: 371 },
  "right-pass": { x: 340, y: 1175, w: 151, h: 365, ax: 79.5, ay: 365, refH: 365 },
  "right-stepB": { x: 497, y: 1175, w: 246, h: 370, ax: 133.5, ay: 370, refH: 370 },
  "lying": { x: 6, y: 1558, w: 131, h: 425, ax: 65.5, ay: 212.5, refH: 425 },
};
export const WORK_FRAMES = {
  "up-a": { x: 6, y: 23, w: 122, h: 355, ax: 60.4, ay: 355, refH: 376.9 },
  "up-b": { x: 140, y: 23, w: 123, h: 355, ax: 60.6, ay: 355, refH: 376.9 },
  "down-a": { x: 275, y: 6, w: 166, h: 372, ax: 83.0, ay: 372, refH: 372 },
  "down-b": { x: 453, y: 6, w: 166, h: 372, ax: 83.1, ay: 372, refH: 372 },
  "right-a": { x: 631, y: 6, w: 137, h: 369, ax: 34.8, ay: 369, refH: 369 },
  "right-b": { x: 780, y: 6, w: 132, h: 369, ax: 34.6, ay: 369, refH: 369 },
  "left-a": { x: 924, y: 24, w: 152, h: 354, ax: 112.7, ay: 354, refH: 354 },
  "left-b": { x: 1088, y: 24, w: 151, h: 354, ax: 111.6, ay: 354, refH: 354 },
};
export const REPAIR_FRAMES = {
  "up-a": { x: 0, y: 0, w: 240, h: 420, ax: 120.0, ay: 420, refH: 611.7 },
  "up-b": { x: 240, y: 0, w: 263, h: 420, ax: 131.5, ay: 420, refH: 611.7 },
  "down-a": { x: 503, y: 0, w: 281, h: 420, ax: 134.9, ay: 420, refH: 611.7 },
  "down-b": { x: 784, y: 0, w: 281, h: 420, ax: 134.9, ay: 420, refH: 611.7 },
  "right-a": { x: 1065, y: 0, w: 464, h: 420, ax: 185.6, ay: 420, refH: 611.7 },
  "right-b": { x: 1529, y: 0, w: 379, h: 420, ax: 151.6, ay: 420, refH: 611.7 },
  "left-a": { x: 1908, y: 0, w: 422, h: 420, ax: 253.2, ay: 420, refH: 611.7 },
  "left-b": { x: 2330, y: 0, w: 354, h: 420, ax: 212.4, ay: 420, refH: 611.7 },
};
export const SOCIAL_FRAMES = {
  "down-drink-0": { x: 0, y: 0, w: 125, h: 380, ax: 62.1, ay: 380, refH: 482 },
  "down-drink-1": { x: 125, y: 0, w: 134, h: 380, ax: 71.4, ay: 380, refH: 482 },
  "down-drink-2": { x: 259, y: 0, w: 141, h: 380, ax: 77.0, ay: 380, refH: 482 },
  "down-talk-0": { x: 400, y: 0, w: 160, h: 380, ax: 79.5, ay: 380, refH: 482 },
  "down-talk-1": { x: 560, y: 0, w: 163, h: 380, ax: 81.8, ay: 380, refH: 482 },
  "down-talk-2": { x: 723, y: 0, w: 197, h: 380, ax: 109.7, ay: 380, refH: 482 },
  "up-drink-0": { x: 920, y: 0, w: 207, h: 380, ax: 79.8, ay: 380, refH: 482 },
  "up-drink-1": { x: 1127, y: 0, w: 197, h: 380, ax: 94.5, ay: 380, refH: 482 },
  "up-drink-2": { x: 1324, y: 0, w: 174, h: 380, ax: 98.1, ay: 380, refH: 482 },
  "up-talk-0": { x: 1498, y: 0, w: 160, h: 380, ax: 67.6, ay: 380, refH: 482 },
  "up-talk-1": { x: 1658, y: 0, w: 157, h: 380, ax: 73.5, ay: 380, refH: 482 },
  "up-talk-2": { x: 1815, y: 0, w: 182, h: 380, ax: 108.1, ay: 380, refH: 482 },
};
export function socialPose(t) {
  const cyc = ((t % 12) + 12) % 12;
  if (cyc < 6) { const d = cyc; return { loop: "drink", frame: d < 2.2 ? 0 : d < 2.9 ? 1 : d < 3.9 ? 2 : d < 4.5 ? 1 : 0 }; }
  const k = cyc - 6; return { loop: "talk", frame: k < 1.2 ? 0 : k < 2.4 ? 1 : k < 3.8 ? 2 : k < 4.8 ? 1 : 0 };
}
// ---- Lieutenant (v3 near-top-down set, sprites/lt_topdown_v3) ----
// Sheet grid: 160x384 cells, columns up/down/right/left, one row per frame (A, M, B) per action in
// sheet_layout.json order, feet anchored at (80,376), one shared scale for every frame. Standing height in the
// cell is ~252px (walkM/talk rows measure 247-254), so refH = 252 renders the standing Lt at FIG_H (134) on screen.
// Walk/idle, station work, eating, bar talk, kneel and weld all come from this sheet; only the berth/biobed
// lying pose still uses CREW_FRAMES.lying from crew-atlas (v3 has no lying frame).
export const LT2_CELL = { w: 160, h: 384, ax: 80, ay: 376 };
export const LT2_DIRS = ["up", "down", "right", "left"];
export const LT2_STAND_H = 252;
export const LT2_LOOP = [0, 1, 2, 1];                  // A, M, B, M
export const LT2_FRAME_T = { walk: 0.20, default: 0.22 }; // s/frame (walk is normally driven by walkPhase)
export const LT2_IDLE = ["walk", 1];                    // standing idle = walk M (feet together, neutral)
// Per-character sheets: character -> { sheet asset (assets/<key>.webp) -> actions in row order (3 rows each: A, M, B) }.
// Every v3-format set shares the grid above (160x384, feet 80,376, cols up/down/right/left, A,M,B,M playback) and
// the same draw scale (refH 252 -> FIG_H), so characters of matching height stand at matching size.
// Adding a character = one asset + one entry here.
export const CHAR_SHEETS = {
  lt: { "lt-v3": ["walk", "talk", "eat", "computer", "kneel", "weld"] },      // sprites/lt_topdown_v3
  tren: { "tren-v1": ["walk", "talk", "eat", "computer", "kneel", "weld"] },  // sprites/tren_topdown_v1 (Captain T'Ren)
  // Andorian crewwoman (mess hall ambient NPC, AMBIENT_NPCS below). STAND-IN: her art is delayed, so she borrows
  // T'Ren's sheet. When assets/andorian-v1.webp lands, change the key "tren-v1" on the next line to "andorian-v1"
  // (one-line swap; it is preloaded automatically via IMAGES). The new sheet must use the same v3 layout: 160x384
  // cells, feet anchor (80,376), columns up/down/right/left, rows walk/talk/eat/computer/kneel/weld x A/M/B
  // (played A,M,B,M), standing height ~252 px in the cell (refH LT2_STAND_H). Fewer actions = shorten the list.
  andorian: { "tren-v1": ["walk", "talk", "eat", "computer", "kneel", "weld"] },
  // phase 3 roster fallbacks (own sheet -> species base sheet -> these): the generic crew sheet is T'Ren's for now, in
  // department uniform colours (tools/make-uniform-sheets.py recolours only the red shoulder panels).
  // When a species gets real art, add it here and set SPECIES[id].sheet in js/roster.js (Thelev: "andorian" above).
  "crew-red": { "tren-v1": ["walk", "talk", "eat", "computer", "kneel", "weld"] },
  "crew-gold": { "crew-gold-v1": ["walk", "talk", "eat", "computer", "kneel", "weld"] },
  "crew-blue": { "crew-blue-v1": ["walk", "talk", "eat", "computer", "kneel", "weld"] },
};
// CHAR_FRAMES[who][action][dir] = [A, M, B]; each frame also carries `img` (its sheet key).
export const CHAR_FRAMES = {};
for (const [who, sheets] of Object.entries(CHAR_SHEETS)) {
  const F = CHAR_FRAMES[who] = {};
  for (const [img, actions] of Object.entries(sheets)) actions.forEach((action, ai) => {
    F[action] = {};
    LT2_DIRS.forEach((dir, col) => {
      F[action][dir] = [0, 1, 2].map(k => ({ img, x: col * LT2_CELL.w, y: (ai * 3 + k) * LT2_CELL.h,
        w: LT2_CELL.w, h: LT2_CELL.h, ax: LT2_CELL.ax, ay: LT2_CELL.ay, refH: LT2_STAND_H }));
    });
  });
}
// back-compat names for the Lieutenant
export const LT2_SHEETS = CHAR_SHEETS.lt;
export const LT2_FRAMES = CHAR_FRAMES.lt;
// time-driven A,M,B,M loop for any character
export const charFrame = (who, action, dir, t) =>
  CHAR_FRAMES[who][action][dir][LT2_LOOP[Math.floor(t / (LT2_FRAME_T[action] || LT2_FRAME_T.default)) % 4]];
export const lt2Frame = (action, dir, t) => charFrame("lt", action, dir, t);

// ---- Captain T'Ren on the Bridge (visual crew, not saved) ----
// home = standing beside the Captain's Chair (starboard side, on the dais); stations = consoles she works.
// All spots are on the bridge walk mask and clear of the Lt's stand spots (msd 0.425,0.3375 · chair 0.495,0.49).
export const TREN = {
  deck: "bridge",
  home: { x: 0.578, y: 0.42, face: "down" },
  stations: [
    { x: 0.215, y: 0.50, face: "left" },   // port console bank
    { x: 0.785, y: 0.50, face: "right" },  // starboard console bank
    { x: 0.658, y: 0.30, face: "left" },   // Master Systems Display, starboard end
  ],
  homeT: [25, 50], stationT: [15, 30], speed: 0.10,   // s at home, s at a console, walk speed (deck fraction/s)
};

// ---- ambient crew NPCs (js/npc-ambient.js): visual only, never saved or simulated offline ----
// One entry per NPC; adding another crew member = a CHAR_SHEETS entry + one block here. Everything below is a tunable.
//   spots: where she drifts. Either absolute deck fractions {x, y} or {near: <Lt node id>, dx, dy} relative to that
//          node, so they follow the node when the deck art (lounge is being redrawn) moves it. Every spot is snapped
//          to the nearest walkable cell of the deck's walk mask at runtime, so nothing here has to be pixel-exact.
//          action: talk | eat | computer | null (stand idle); t: [min, max] seconds she stays; w: pick weight.
//   social: when the Lt is using one of social.nodes and she is within joinRange (design px), she walks to the chat
//          spot beside him (offset from that node), turns to him and both play "talk" for chatDur seconds.
//          lineCooldown: min seconds between chat lines in the log; perk: small energy bump with its own cooldown
//          (perk/line cooldowns are the only things saved: G.npc[id], in ship-elapsed seconds).
export const AMBIENT_NPCS = [
  {
    // Thelev is a crewwoman (she/her; Shiloh: "a regular crew woman andorian"). "Crewman" is the Starfleet rank title only.
    id: "thelev", who: "andorian", rank: "Crewman", name: "Thelev sh'Zarath", short: "Thelev", pronoun: "she",
    deck: "lounge", speed: 0.09, seed: 2.1, start: "mess-east",
    spots: [
      { id: "mess-east", near: "mess", dx: 0.125, dy: 0.0, face: "down", action: "eat", t: [25, 45], w: 3 },    // next table east of the Lt's
      { id: "mess-west", near: "mess", dx: -0.125, dy: 0.0, face: "down", action: "eat", t: [25, 45], w: 2 },   // next table west
      { id: "bar", near: "bar", dx: 0.10, dy: 0.0, face: "up", action: "talk", t: [20, 35], w: 3 },              // a stool along from the Lt's
      { id: "replicator", near: "bar", dx: 0.17, dy: 0.01, face: "up", action: "computer", t: [8, 14], w: 2 },  // replicator slot, bar's east end
      { id: "window", x: 0.70, y: 0.55, face: "right", action: null, t: [15, 30], w: 1 },                         // idle by the viewports
      { id: "floor", x: 0.33, y: 0.56, face: "down", action: null, t: [8, 16], w: 1 },                           // idle mid-room
    ],
    social: {
      // chat spot candidates per Lt node, tried in order; the first whose walkable snap moves it <= maxSnap design px wins.
      // mess: across the table from him (the side away from the bar; the Lt's mess spot sits between table and bar),
      // then beside him to the east. bar: a stool along to the east.
      nodes: { mess: [{ dx: 0.0, dy: 0.125 }, { dx: 0.075, dy: 0.0 }], bar: [{ dx: 0.075, dy: 0.0 }] }, maxSnap: 28,
      joinRange: 360, chatRange: 150,      // design px: she comes over from up to joinRange; a chat breaks off past 1.4x chatRange
      chatDur: [18, 30], lingerT: [4, 8],  // s of talking per chat; s she lingers after he walks off
      lineCooldown: 90,
      perk: { energy: 8, cooldown: 300 },
      lines: [
        "{name}, antennae tilting toward the Lieutenant: 'Lieutenant. They say you keep the core from eating us. Next raktajino is mine.'",
        "{short}: 'On Andor we'd call this a mild evening.' She taps the frost on her glass. 'You run your ships like greenhouses.'",
        "{short}: 'Okafor chewed you out again? Good. She only shouts at the ones she plans to keep.'",
        "{short}: 'My zhavey wrote. She asks if the Tenacity is a real starship or a museum piece. I told her: both, proudly.'",
        "{short}: 'The Jem'Hadar don't eat, don't sleep, don't laugh. That's why we'll win, Lieutenant.'",
        "{short}, antennae twitching at the hum through the deck: 'Core's sweet tonight. That's you, isn't it?'",
      ],
    },
  },
];

export const IMAGES = [...new Set(["deck-bridge", "deck-engineering", "deck-medical", "deck-berthing", "deck-lounge",
  "crew-atlas", "crew-captain", "crew-engineer", "crew-science", "crew-security",
  "space-backdrop", "bg-ds9", "bg-convoy", "bg-derelict", "bg-travel", "bg-earth", "bg-qonos", "bg-romulus", "bg-vulcan",
  "ship-tenacity", "ship-jemhadar", ...Object.values(CHAR_SHEETS).flatMap(o => Object.keys(o)),
  ...Object.values(CABIN_TIERS).map(t => t.plate).filter(Boolean)])];   // cabin plates join once the artist delivers them   // deduped (stand-in sheets share keys)
// walk masks (PNG, white = floor), loaded alongside the plates
export const WALK_MASKS = [...CREW_DECKS.map(d => "walk-" + d), ...Object.values(CABIN_TIERS).map(t => t.mask).filter(Boolean)];
