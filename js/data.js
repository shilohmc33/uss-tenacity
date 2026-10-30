// Static game data, ported from the Muse prototype (reference/game.html).
// All deck coordinates are fractions of a 960x640 design plate.
// Walkable floor comes from the painted walk masks assets/walk-<deck>.png (see tools/make-walk-masks.py, sampled into the
// 60x40 grid by path.js). The base/blocks rectangles below are only a coarse fallback if a mask fails to load.
// Node x,y = where the Lt's feet stand (always on mask floor); mx,my = what he faces / where markers sit.
import { CABIN_TIERS, DECOR_ITEMS } from "./cabin-data.js";
export const DW = 960, DH = 640;
export const COLS = 60, ROWS = 40;
const R = (x0, y0, x1, y1) => [x0, y0, x1, y1];

export const DECK_ORDER = ["bridge", "engineering", "medical", "berthing", "quarters", "lounge", "gym"];
export const CREW_DECKS = ["bridge", "engineering", "medical", "berthing", "lounge", "gym"];   // decks with painted plates + walk masks
export const DECKS = {
  bridge: {
    // Bridge v4b (sprites/deck_bridge_v4b, assets/src/deck_bridge_v4b): the v4 plate with the lift interiors painted behind open
    // doorways; the door leaves are separate panels (js/doors-data.js DECK_DOORS, render/doors.js). Geometry / mask / spots / fg = v4.
    // Bridge v4 (sprites/deck_bridge_v4, assets/src/deck_bridge_v4): LCARS screens + sliding lift doors on the v3 geometry; plate and
    // fg-bridge ship together (fg RGB refreshed from v4, alpha identical; fg re-encoded webp q92 from the artist PNG, alpha exact).
    // art batch 2: sprites/deck_bridge_v3 layout, plate + fg from sprites/deck_bridge_v3_hires (same geometry, 1920x1280 = 2 art
    // px per design px like the other plates; v3 was 1080x720) drawn at DW x DH; walk-bridge.png; seats / stations / lift from out/bridge_spots.json. Viewscreen at the BOTTOM:
    // every seat faces down. fg-bridge.webp = the console fronts drawn over seated figures (DECK_OCCL.bridge, render/occluders.js).
    name: "Bridge", plate: "deck-bridge", glow: [0.50, 0.86, "150,180,255"],
    lift: { x: 0.2104, y: 0.275, mx: 0.2094, my: 0.1484 },
    // starboard aft turbolift (clear opening 712-795 x 44-142 px): a second boarding point for the same lift system
    lift2: { x: 0.7854, y: 0.2625, mx: 0.7854, my: 0.1453 },
    // fallback grid only (the mask normally loads): the walk-bridge.png floor cells as 40 rectangles, exact on the 60x40 grid
    base: [
      R(0.2833, 0.175, 0.7167, 0.275), R(0.2833, 0.55, 0.7167, 0.625), R(0.2, 0.225, 0.3, 0.525), R(0.7167, 0.225, 0.8, 0.525),
      R(0.45, 0.525, 0.55, 0.775), R(0.1333, 0.45, 0.2, 0.7), R(0.8, 0.45, 0.8667, 0.7), R(0.7167, 0.625, 0.8333, 0.75),
      R(0.2, 0.625, 0.2833, 0.75), R(0.6167, 0.45, 0.7167, 0.625), R(0.3, 0.45, 0.3833, 0.625), R(0.7, 0.275, 0.7167, 0.675),
      R(0.2667, 0.2, 0.4167, 0.3), R(0.4667, 0.475, 0.5333, 0.775), R(0.4167, 0.625, 0.5833, 0.675), R(0.2833, 0.525, 0.3333, 0.675),
      R(0.6, 0.275, 0.8, 0.3), R(0.65, 0.625, 0.8667, 0.675), R(0.1667, 0.25, 0.8333, 0.275), R(0.35, 0.4, 0.4167, 0.425),
      R(0.5833, 0.4, 0.65, 0.425), R(0.2667, 0.525, 0.4333, 0.55), R(0.1667, 0.7, 0.2833, 0.75), R(0.3, 0.3, 0.35, 0.325),
      R(0.65, 0.3, 0.8, 0.325), R(0.5667, 0.525, 0.7167, 0.625), R(0.4333, 0.675, 0.55, 0.75), R(0.35, 0.425, 0.3833, 0.625),
      R(0.6167, 0.425, 0.65, 0.625), R(0.45, 0.475, 0.55, 0.5), R(0.25, 0.75, 0.2833, 0.775), R(0.7167, 0.75, 0.75, 0.775),
      R(0.7167, 0.2, 0.7333, 0.525), R(0.3, 0.325, 0.3167, 0.35), R(0.6833, 0.325, 0.8, 0.35), R(0.5833, 0.375, 0.6, 0.425),
      R(0.3833, 0.5, 0.4, 0.625), R(0.6, 0.5, 0.8667, 0.525), R(0.15, 0.7, 0.2833, 0.725), R(0.8333, 0.7, 0.85, 0.725)],
    blocks: [],
    nodes: {
      // the plate has no Master Systems Display any more: the "msd" node (id kept for tasks, odd jobs, saves) is the
      // forward port science station (v2/v3 notes: retarget msd here)
      msd: { name: "Master Systems Display", chip: "Master Systems", x: 0.2042, y: 0.4094, mx: 0.15, my: 0.4094, face: "left" },
      chair: { name: "Captain's Chair", chip: "Captain's Chair", x: 0.499, y: 0.4813, mx: 0.499, my: 0.4234, face: "down",
        seat: { at: [0.499, 0.4234], face: "down", hip: { down: [0, 0], up: [0, 0] }, stand: [0.499, 0.4813] } },
      fo: { name: "First Officer's Seat", x: 0.4625, y: 0.4813, mx: 0.4448, my: 0.4328, face: "down",
        seat: { at: [0.4448, 0.4328], face: "down", hip: { down: [0, 0], up: [0, 0] }, stand: [0.4625, 0.4813] } },
      counsel: { name: "Counsellor's Seat", x: 0.5354, y: 0.4813, mx: 0.5531, my: 0.4328, face: "down",
        seat: { at: [0.5531, 0.4328], face: "down", hip: { down: [0, 0], up: [0, 0] }, stand: [0.5354, 0.4813] } },
      conn: { name: "Conn", chip: "Conn", x: 0.376, y: 0.6219, mx: 0.376, my: 0.6984, face: "down",
        seat: { at: [0.376, 0.6984], face: "down", hip: { down: [0, 0], up: [0, 0] }, stand: [0.376, 0.6219] } },
      ops: { name: "Ops", chip: "Ops", x: 0.6156, y: 0.6219, mx: 0.6156, my: 0.6984, face: "down",
        seat: { at: [0.6156, 0.6984], face: "down", hip: { down: [0, 0], up: [0, 0] }, stand: [0.6156, 0.6219] } },
      tactical: { name: "Tactical", chip: "Tactical", x: 0.499, y: 0.2672, mx: 0.499, my: 0.2984, face: "down" },
      science2: { name: "Science Station (aft)", x: 0.1417, y: 0.55, mx: 0.09, my: 0.55, face: "left" },
      engineering: { name: "Engineering Station", x: 0.7979, y: 0.4094, mx: 0.85, my: 0.4094, face: "right" },
      engineering2: { name: "Engineering Station (aft)", x: 0.8625, y: 0.55, mx: 0.915, my: 0.55, face: "right" },
      mission_ops: { name: "Mission Ops", x: 0.2354, y: 0.5219, mx: 0.235, my: 0.585, face: "down" },
      environment: { name: "Environment", x: 0.7625, y: 0.5219, mx: 0.763, my: 0.585, face: "down" },
      lift2: { name: "Starboard Turbolift", x: 0.7854, y: 0.2625, mx: 0.7854, my: 0.1453, face: "up", liftDoor: true },
    },
  },
  engineering: {
    name: "Engineering", plate: "deck-engineering", glow: [0.479, 0.32, "120,200,255"],
    // FINAL art (sprites/deck_engineering_v1/out, copied to assets/src/deck_engineering_v1): every spot below is the
    // artist's engineering_spots.json new_frac/marker_frac (old names kept). The walk mask is the artist's (plus the
    // no-standing-in-the-beam block north of the core, tools/make-walk-masks.py); base/blocks are the matching fallback
    // from solid_props.json (floor rects; footprints dilated +-12 x, +-4 y; the core ellipse as an inscribed rect).
    lift: { x: 0.8646, y: 0.925, mx: 0.8646, my: 0.8406 },
    base: [R(0.104, 0.133, 0.255, 0.203), R(0.13, 0.2, 0.196, 0.391), R(0.115, 0.383, 0.214, 0.766), R(0.279, 0.152, 0.753, 0.261),
      R(0.276, 0.234, 0.76, 0.383), R(0.208, 0.383, 0.76, 0.762), R(0.729, 0.148, 0.911, 0.277), R(0.729, 0.148, 0.794, 0.692),
      R(0.794, 0.148, 0.911, 0.692), R(0.719, 0.688, 0.797, 0.984), R(0.047, 0.886, 0.729, 0.98), R(0.783, 0.88, 0.943, 0.97)],
    blocks: [R(0.06, 0.087, 0.158, 0.155), R(0.201, 0.087, 0.273, 0.155), R(0.092, 0.431, 0.14, 0.483), R(0.045, 0.416, 0.135, 0.767),
      R(0.273, 0.147, 0.325, 0.194), R(0.304, 0.138, 0.377, 0.178), R(0.357, 0.138, 0.414, 0.17), R(0.699, 0.131, 0.745, 0.18),
      R(0.209, 0.381, 0.286, 0.473), R(0.627, 0.306, 0.731, 0.416), R(0.194, 0.498, 0.328, 0.672), R(0.619, 0.503, 0.744, 0.68),
      R(0.407, 0.588, 0.552, 0.675), R(0.805, 0.142, 0.911, 0.281), R(0.781, 0.275, 0.933, 0.569), R(0.392, 0.311, 0.567, 0.47),
      R(410 / 960, 90 / 640, 512 / 960, 200 / 640)],   // last: north of the core column (nobody stands inside the beam)
    nodes: {
      core: { name: "Warp Core Console", chip: "Warp Core", x: 0.4792, y: 0.6969, mx: 0.4792, my: 0.5156, system: "warpcore" },   // south of the MSD, facing the core
      shield: { name: "Shield Console", chip: "Shields", x: 0.3354, y: 0.5625, mx: 0.3021, my: 0.5625, system: "shields" },
      torpbay: { name: "Torpedo Bay", chip: "Torpedo Bay", x: 0.7615, y: 0.4203, mx: 0.8333, my: 0.4203, system: "phasers" },
      locker: { name: "Parts Locker", chip: "Parts Locker", x: 0.5802, y: 0.9203, mx: 0.5802, my: 0.85 },
      pads: { name: "Transporter Pads", chip: "Transporter", x: 0.1771, y: 0.1719, mx: 0.1771, my: 0.1437 },
    },
  },
  medical: {
    name: "Medical", plate: "deck-medical", glow: [0.2, 0.46, "255,236,210"],   // v2: warm white over the biobeds (the old mint glow greened the cream walls)
    // Medical v2 FINAL (sprites/deck_medical_v2/out, copied to assets/src/deck_medical_v2; datajs_changes.json applied). The
    // walk mask is the artist's U layout as is (tools/make-walk-masks.py); base below is that mask's grid as rects (fallback).
    lift: { x: 0.51, y: 0.6875, mx: 0.51, my: 0.755 },   // unchanged in v2
    base: [R(0.3, 0.225, 0.4667, 0.275), R(0.5833, 0.25, 0.7333, 0.275), R(0.3, 0.275, 0.3333, 0.325),
      R(0.5833, 0.275, 0.7167, 0.3), R(0.6333, 0.3, 0.6667, 0.375), R(0.2833, 0.325, 0.3333, 0.675),
      R(0.6167, 0.375, 0.6667, 0.5), R(0.6167, 0.5, 0.6833, 0.525), R(0.6167, 0.525, 0.7667, 0.55),
      R(0.6167, 0.55, 0.75, 0.575), R(0.6167, 0.575, 0.6667, 0.675), R(0.2833, 0.675, 0.6667, 0.7),
      R(0.2833, 0.7, 0.7667, 0.725), R(0.2833, 0.725, 0.3667, 0.75), R(0.6, 0.725, 0.7667, 0.75), R(0.3, 0.75, 0.35, 0.775),
      R(0.6167, 0.75, 0.7667, 0.8)],
    blocks: [],
    nodes: {
      // v2: stand unchanged; mx/my + lie on bed 3's mattress centre in the final art (205,293), nudged 3 px west so the head sits on the pillow
      biobed: { name: "Biobed", chip: "Biobed", x: 0.295, y: 0.4375, mx: 0.2104, my: 0.4578, lie: [0.2104, 0.4578], lieRot: -Math.PI / 2, lieLen: 150, rest: 10 },
    },
  },
  berthing: {
    name: "Berthing", plate: "deck-berthing", glow: [0.80, 0.16, "255,196,110"],
    lift: { x: 0.612, y: 0.89, mx: 0.612, my: 0.79 },   // P22: the painted turbolift door seam on the Berthing v2 plate (x 1175/1920)
    // cleaned plate (decks_berthing_fix_v1): the starboard bench + alcove wall end now sit at y .665-.837 (block) and the floor
    // under them, with the opening (744,534,42,61) into the starboard bay, is walkable (base)
    base: [R(0.045, 0.385, 0.96, 0.515), R(0.735, 0.045, 0.955, 0.29), R(0.79, 0.29, 0.965, 0.905), R(0.44, 0.83, 0.80, 0.97),
      R(0.704, 0.84, 0.87, 0.93)],
    blocks: [R(0.775, 0.095, 0.825, 0.235), R(0.835, 0.095, 0.925, 0.185), R(0.855, 0.315, 0.935, 0.405), R(0.875, 0.535, 0.94, 0.64),
      R(0.445, 0.82, 0.51, 0.94), R(0.705, 0.665, 0.81, 0.837)],
    nodes: {
      bunk: { name: "Bunk", chip: "Bunk", x: 0.80, y: 0.2625, mx: 0.80, my: 0.16, lie: [0.80, 0.162], lieLen: 96, rest: 6.5 },   // lie: bed centre; the figure is scaled to the 96 px bunk (pass 09)
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
      desk: { name: "Desk", chip: "Desk", ...CABIN_TIERS.ltjg.desk, quarters: true },   // art batch 2: cabin_v4 desk stand (applyTier re-points it per tier)
      guest: { name: "Guest Chair", ...CABIN_TIERS.ltjg.guest, quarters: true },   // Wave C: south-facing show-in seat (applyTier re-points per tier)
    },
  },
  lounge: {
    name: "Mess & Bar", plate: "deck-lounge", glow: [0.42, 0.27, "255,190,110"],
    lift: { x: 0.145, y: 0.6625, mx: 0.145, my: 0.555 },
    base: [R(0.25, 0.20, 0.815, 0.945), R(0.035, 0.45, 0.235, 0.745), R(0.235, 0.615, 0.285, 0.685)],
    // Lounge v2 (sprites/deck_lounge_v2/out/lounge_spots.json): the six tables are blocks_norm_tables (chair carves included); bar, galley, planters kept
    blocks: [R(0.225, 0.205, 0.625, 0.36), R(0.25, 0.015, 0.645, 0.205), R(0.3583, 0.3797, 0.4292, 0.525), R(0.4854, 0.3797, 0.5563, 0.525),
      R(0.6125, 0.375, 0.6833, 0.5203), R(0.3656, 0.5516, 0.4365, 0.6969), R(0.5094, 0.5469, 0.5802, 0.6922), R(0.6552, 0.5422, 0.726, 0.6875),
      R(0.485, 0.73, 0.855, 0.955)],
    nodes: {
      // Lounge v2: six seated tables, every chair faces down (south). The mess node is table 2's chair (sit and eat); the other
      // five are chip-less tap-only seats (ambient crew sit in them via spot.seat). x/y = stand spot, mx/my = hip.
      mess: { name: "Mess Table", chip: "Mess Table", x: 0.5667, y: 0.4281, mx: 0.5208, my: 0.4156, rest: 5, face: "down",
        seat: { at: [0.5208, 0.4156], face: "down", hip: { down: [0, 0], up: [0, 0] }, stand: [0.5667, 0.4281] } },
      table1: { name: "Table 1", x: 0.4396, y: 0.4281, mx: 0.3937, my: 0.4156, face: "down",
        seat: { at: [0.3937, 0.4156], face: "down", hip: { down: [0, 0], up: [0, 0] }, stand: [0.4396, 0.4281] } },
      table3: { name: "Table 3", x: 0.6937, y: 0.4234, mx: 0.6479, my: 0.4109, face: "down",
        seat: { at: [0.6479, 0.4109], face: "down", hip: { down: [0, 0], up: [0, 0] }, stand: [0.6937, 0.4234] } },
      table4: { name: "Table 4", x: 0.4469, y: 0.6, mx: 0.401, my: 0.5875, face: "down",
        seat: { at: [0.401, 0.5875], face: "down", hip: { down: [0, 0], up: [0, 0] }, stand: [0.4469, 0.6] } },
      table5: { name: "Table 5", x: 0.5906, y: 0.5953, mx: 0.5448, my: 0.5828, face: "down",
        seat: { at: [0.5448, 0.5828], face: "down", hip: { down: [0, 0], up: [0, 0] }, stand: [0.5906, 0.5953] } },
      table6: { name: "Table 6", x: 0.6448, y: 0.5906, mx: 0.6906, my: 0.5781, face: "down",
        seat: { at: [0.6906, 0.5781], face: "down", hip: { down: [0, 0], up: [0, 0] }, stand: [0.6448, 0.5906] } },
      bar: { name: "Bar Counter", chip: "Bar Counter", x: 0.4425, y: 0.3375, mx: 0.4425, my: 0.27, rest: 2.5 },
    },
  },
  // Gym (sprites/deck_gym_v1): same lobby/doors geometry as the lounge; spar mat 288,212-622,488; hanging bag blocked in mask; no seats.
  gym: {
    name: "Gym", plate: "deck-gym", glow: [0.40, 0.28, "255,200,140"],
    lift: { x: 0.145, y: 0.6625, mx: 0.145, my: 0.555 },   // same lobby boarding spot as lounge
    // coarse fallback until walk-gym.png loads (open floor + lobby; mat is walkable; bag blocked by mask)
    base: [R(0.25, 0.20, 0.815, 0.945), R(0.035, 0.45, 0.235, 0.745), R(0.235, 0.615, 0.285, 0.685),
      R(288 / 960, 212 / 640, 622 / 960, 488 / 640)],
    blocks: [R(0.225, 0.205, 0.625, 0.36), R(0.25, 0.015, 0.645, 0.205), R(0.485, 0.73, 0.855, 0.955),
      R(100 / 960, 120 / 640, 160 / 960, 200 / 640)],   // hanging bag approx (mask is authoritative)
    nodes: {
      mat: { name: "Sparring Mat", chip: "Sparring Mat", x: 455 / 960, y: 400 / 640, mx: 455 / 960, my: 350 / 640, face: "right" },
    },
  },
};
// Per-deck light on the crew (playtest-02 NEW-08 / S6). Retune here when the new deck art lands.
//   tint:  "r,g,b" multiplied into crew sprites at strength a (0.10-0.15 = subtle cast of the room's light)
//   The low-power darkening (power < 20) is applied after the characters, so it dims them with the deck.
export const DECK_LIGHT = {
  bridge:      { tint: "255,220,175", a: 0.07 },   // art batch 2: warm amber plate (deck_bridge_v2/v3 light notes)
  engineering: { tint: "120,200,255", a: 0.12 },   // warp-core blue
  medical:     { tint: "255,244,228", a: 0.08 },   // Medical v2: bright TNG sickbay, warm white (the teal wash greyed the cream plate)
  berthing:    { tint: "255,196,110", a: 0.14 },   // warm amber cabin light
  lounge:      { tint: "255,190,110", a: 0.15 },   // warm bar amber
  gym:         { tint: "255,200,140", a: 0.12 },   // warm gym lights
  quarters:    { tint: "255,214,160", a: 0.10 },   // warm cabin lamp
};
export const NODEMAP = {};
for (const d of DECK_ORDER) for (const [id, n] of Object.entries(DECKS[d].nodes)) { n.deck = d; n.id = id; NODEMAP[id] = n; }

// Optional per-system repairPose: "kneel" (floor-level work) — default repair animation is "weld".
export const SYSTEMS = {
  warpcore: { name: "Warp Core", fault: "Warp core instability", deck: "engineering", x: 0.4792, y: 0.6969, mx: 0.4792, my: 0.5156, node: "core", dur: 6 },
  shields: { name: "Shield Generator", fault: "Shield emitter failure", deck: "engineering", x: 0.3354, y: 0.5625, mx: 0.3021, my: 0.5625, node: "shield", dur: 5 },
  phasers: { name: "Torpedo Launcher", fault: "Launcher misalignment", deck: "engineering", x: 0.7615, y: 0.4203, mx: 0.8333, my: 0.4203, node: "torpbay", dur: 5 },
  eps: { name: "EPS Conduit", fault: "EPS fault — locker conduit", deck: "engineering", x: 0.4698, y: 0.9203, mx: 0.4698, my: 0.83, node: null, dur: 5 },
  coolant: { name: "Coolant Line", fault: "Coolant leak", deck: "engineering", x: 0.4792, y: 0.6969, mx: 0.5208, my: 0.5156, node: null, dur: 6 },
  transporter: { name: "Transporter", fault: "Transporter buffer fault", deck: "engineering", x: 0.1771, y: 0.1719, mx: 0.1771, my: 0.1437, node: null, dur: 4 },
  loader: { name: "Torpedo Loader", fault: "Torpedo loader jam", deck: "engineering", x: 0.776, y: 0.2188, mx: 0.83, my: 0.2188, node: null, dur: 4 },   // final art: the loader / launcher hatch at the north end of the bay (745,140)
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
// SCALE (Shiloh picked option A, 2026-10-18, shots/scale-report.md): one global character scale, the standing figure is
// FIG_H = 83 design px (0.62 x the old 134, which was 1.5-2.9x the painted door heights). FIG_K = 83/134 scales
// everything sized to the BODY (steps, walk speeds, shadows, lying length, seat/lie art, head offsets). UI drawn with
// CHAR_SCALE (rings, labels, name tags, task rings) and the tap zones stay at their old size on purpose.
// (history) Characters were drawn at 2x (Shiloh, 2026-10-17): standing Lt ~134 design px tall (was 67). STEP_LEN is the
// distance per walk half-cycle (scaled with the figure, slightly under 2x because walk speed went up 1.35x).
// node.lieLen: the painted bed's length. The lying figure is LIE_FIG = 86 (render/deck.js, 138 x FIG_K) and is scaled
// down to lieLen on any shorter bed so it never overhangs (pass 09). At the option-A scale every bed is longer (bunk 96,
// biobed 150, quarters racks >= 138), so nobody is shrunk any more.
// LIE_LEN is legacy (unused).
export const FIG_H = 83, FIG_K = FIG_H / 134, LIE_LEN = 178, STEP_LEN = 70;
// floaters start just above the Lt's head: deck fractions above his feet (FIG_H 83 / 640 = 0.13 + a little air; was 0.235)
export const HEAD_Y = 0.155;   // STEP_LEN: legacy, unused since pass 08 (per-character, per-direction steps live in js/anim.js STEP)
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
// cell is ~252px (walkM/talk rows measure 247-254), so refH = 252 renders the standing Lt at FIG_H (83; was 134) on screen.
// Walk/idle, station work, eating, bar talk, kneel and weld all come from this sheet; only the berth/biobed
// lying pose still uses CREW_FRAMES.lying from crew-atlas (v3 has no lying frame).
export const LT2_CELL = { w: 160, h: 384, ax: 80, ay: 376 };
export const LT2_DIRS = ["up", "down", "right", "left"];
export const LT2_STAND_H = 252;
export const LT2_LOOP = [0, 1, 2, 1];                  // A, M, B, M
export const LT2_FRAME_T = { walk: 0.20, default: 0.22 }; // s/frame (walk is normally driven by walkPhase)
export const LT2_IDLE = ["walk", 1];                    // standing idle = walk M (feet together, neutral)
// ---- ART HOOKS (pass 08): new poses switch on when the files are in assets/ AND an entry is added here ----
// Nothing is listed yet, so nothing extra is loaded and the current render is used (legacy lying frame, standing at the
// conn panel, T'Ren-recolour crew). One shared draw scale everywhere: 252 sheet px of standing height = FIG_H (83 design px,
// 0.329 design px per sheet px; option A). ARTIST SIZE GUIDE (option A): on screen the standing figure is ~114 css px at
// 1280x800 and ~87-88 css px on phones (390x844 / 844x390, with the phone zoom boost), i.e. up to ~230 device px on a
// dpr-2 screen. The 160x384 grid (252 px standing) stays the delivery format and is already enough; hi-res masters (e.g.
// walk_v2 at ~509-548 px standing) are welcome and are drawn downscaled through WALK_V2-style entries (refH = 252 / the
// master's hires -> 160x384 factor). Hip offsets (seat.hip) and anchors are in design px / cell px and need no change.
// LIE_ART[who] = { img, ax?, ay? }: assets/<img>.webp, ONE ROW of two 384x160 cells (A, B breathing; B optional), the
//   figure lying horizontal with the HEAD AT THE LEFT, anchored at the hip centre (ax, ay) = (192, 80) by default.
//   who: "lt", "patient-red" / "patient-gold" / "patient-blue" (by uniform), or "patient" (any patient). Drawn centred on
//   the bed's lie point, rotated with the bed (lieRot), breathing A/B on anim.js ACTION_TIMING.lying; cross-fades like now.
export const LIE_ART = {
  // art batch 1 (sprites/lie_v1, 2026-10-18): body ~257 cell px -> 84.7 design px at ART_SCALE (option A), fits every bed
  lt: { img: "lie-lt" }, patient: { img: "lie-patient" },
  "patient-red": { img: "lie-patient-red" }, "patient-gold": { img: "lie-patient-gold" }, "patient-blue": { img: "lie-patient-blue" },
};
// SEAT_ART[who] = { img, ax?, ay?, talk? }: assets/<img>.webp in the 160x384 grid, COLUMNS [up, down], rows seated idle
//   A, B (+ seated talk A, B when talk: true), anchored at the hip centre (ax, ay) = (80, 300) by default.
//   Where a character sits is per seat spot, on the node: seat: { at: [x, y] hip point (deck fractions), face: "up"|"down",
//   hip: { up: [dx, dy], down: [dx, dy] } fine offset in design px per facing, stand: [x, y] where he walks to (feet) }.
//   With the art present the Lt walks to seat.stand and sits; without it he keeps the interim stand spot.
export const SEAT_ART = {
  // art batch 1 (sprites/seat_v1): seated idle A/B + talk A/B, columns up/down, hip (80,300), no chair drawn
  lt: { img: "seat-lt", talk: true },
  tren: { img: "seat-tren", talk: true },   // art batch 2: T'Ren sits in the first officer's seat at home (TREN.home.seat)
  // art batch 2 NPC seat hook: crew drawn on T'Ren's body sit with her seated cells, recoloured like their walk sheets
  // (tools/make-uniform-sheets.py seat). Sheets without seat art (male base, Thelev, Okafor) stand at the seat instead.
  "crew-red": { img: "seat-tren", talk: true }, "crew-gold": { img: "seat-crew-gold", talk: true }, "crew-blue": { img: "seat-crew-blue", talk: true },
};
// TINT_BASES[key] = { img, pronoun: "he", actions: [...] }: a crew sheet in the v3 grid (walk/talk/eat/computer/kneel/weld
//   rows like tren-v1) whose uniform panels are MID-GREY (about rgb 128,128,128, low saturation). Department colour
//   (roster.js DEPTS[dept].color) is multiplied into the grey at draw time (cached per colour), so one sheet serves every
//   department. Optional mask: "<img>-mask" (white = tint) when the auto grey detection catches hair or metal.
//   Crew with that pronoun and no own/species sheet use it instead of the T'Ren recolour.
export const TINT_BASES = {
  // art batch 1 (crew_male_v1): generic male crewman, grey yoke + mask; every "he" crewmate without his own / species sheet
  // wears it in his department colour (replaces T'Ren's body for the men). Packed from the hi-res masters (tools/pack-masters.py).
  "crew-male-v1": { img: "crew-male-v1", pronoun: "he", mask: "crew-male-v1-mask" },
  // suite 20 (crew_female_v1): generic crewwoman, grey yoke + mask; every "she" crewmate without her own / species sheet wears
  // it in her department colour (replaces T'Ren's recoloured body for the women). Packed from the hi-res masters like the male base.
  "crew-female-v1": { img: "crew-female-v1", pronoun: "she", mask: "crew-female-v1-mask" },
  // suite 20 (species_betazoid_v1): Betazoid crewwoman = crew_female_v1 body + Betazoid hair (hair-only composite), tinted like
  // the bases. species: a SPECIES-ONLY base (picked through SPECIES_SHEETS below, never as a pronoun fallback).
  "crew-betazoid-v1": { img: "crew-betazoid-v1", pronoun: "she", mask: "crew-betazoid-v1-mask", species: "betazoid" },
  // suite 20 (species_bolian_v1): Bolian crewman = crew_male_v1 body, bald scalp kit + blue skin + centre ridge, tinted like the bases
  "crew-bolian-v1": { img: "crew-bolian-v1", pronoun: "he", mask: "crew-bolian-v1-mask", species: "bolian" },
  // wrap-up (approved species set): human variants on the male / female bodies (hair + skin-tone composites), the Trill v2
  // crewwoman (crew_female_v1 body, leopard spot bands), a male Vulcan (T'Ren's rig + male head, scaled to crew_male heights)
  "crew-human-m2-v1": { img: "crew-human-m2-v1", pronoun: "he", mask: "crew-human-m2-v1-mask", species: "human" },
  "crew-human-f2-v1": { img: "crew-human-f2-v1", pronoun: "she", mask: "crew-human-f2-v1-mask", species: "human" },
  "crew-trill-v2": { img: "crew-trill-v2", pronoun: "she", mask: "crew-trill-v2-mask", species: "trill" },
  "crew-vulcan-m-v1": { img: "crew-vulcan-m-v1", pronoun: "he", mask: "crew-vulcan-m-v1-mask", species: "vulcan" },
};
// species -> sheet (CHAR_SHEETS key), data-driven: adding a species' art = one asset + one entry here (+ a TINT_BASES entry if
// it is a grey tint base). Sheet precedence for a crewmate (npc-ambient.js sheetFor): own sheet (o.sheet / OWN_SHEETS) ->
// SPECIES_SHEETS[species] -> gender base (TINT_BASES by pronoun) -> T'Ren's department recolour. A species sheet whose
// TINT_BASES entry has a pronoun only serves crew with that pronoun (a Betazoid man keeps the male base).
// Keys are species ids (roster.js SPECIES) or VARIANT keys: a species with several looks lists its variant keys in
// SPECIES_VARIANTS; a crewmate gets CREW_SHEET_PICK[id] if listed (null = no variant: the plain gender base), otherwise a
// stable hash of their id picks among the pronoun-eligible variants AND the plain base (so not every human looks alike, and
// a crewmate keeps the same look across saves and roster changes). "they" crew (no gender base of their own; they otherwise
// wear T'Ren's recolour) may use a species sheet of either pronoun; he/she crew only use a sheet with their pronoun.
export const SPECIES_SHEETS = { betazoid: "crew-betazoid-v1", bolian: "crew-bolian-v1", trill: "crew-trill-v2", vulcan: "crew-vulcan-m-v1",
  human_m2: "crew-human-m2-v1", human_f2: "crew-human-f2-v1" };
export const SPECIES_VARIANTS = { human: ["human_m2", "human_f2"] };
export const CREW_SHEET_PICK = { hale: "human_m2", seo: "human_f2", diallo: null, kovac: null, natarajan: null, delgado: null };
// Sheets packed from hi-res masters by tools/pack-masters.py use a larger cell (no clipped weld sparks), same draw scale
// (standing ~252 cell px -> FIG_H): img -> { w, h, ax, ay }. Anything not listed uses LT2_CELL (160x384, feet 80,376).
// crewmates with their OWN sheet, by roster id (checked before species / tint-base / uniform fallbacks; works for old saves too)
export const OWN_SHEETS = { thelev: "andorian", okafor: "okafor" };
// Crew spar sheets (same layout as lt-spar-v1: 160×384, feet (80,376), cols up/down/right/left, rows punchA/M/B then blockA/M/B).
// Per-crew asset when drawn; else department/species generic key. Flag PROG.ltAct.crewSparArt gates use; missing IMG → idle/talk.
// x offsets applied like lt-spar (right −12, left +4) via applyCrewSparXShift below once frames exist.
export const CREW_SPAR_SHEETS = {
  // Named crew (artist delivering per-person sheets for Shiloh review)
  hale: "hale-spar-v1",
  okafor: "okafor-spar-v1",
  thelev: "thelev-spar-v1",
  diallo: "diallo-spar-v1",
  orvin: "orvin-spar-v1",
  tren: "tren-spar-v1",
  // Department / species generics (fallback when no personal sheet)
  _dept_gold: "crew-spar-gold-v1",
  _dept_blue: "crew-spar-blue-v1",
  _dept_red: "crew-spar-red-v1",
  _species_andorian: "crew-spar-andorian-v1",
  _species_vulcan: "crew-spar-vulcan-v1",
  _species_bolian: "crew-spar-bolian-v1",
  _species_trill: "crew-spar-trill-v1",
  _species_betazoid: "crew-spar-betazoid-v1",
};
export const CREW_SPAR_XSHIFT = { right: -12, left: 4 }; // ax' = ax - shift (same as lt-spar-v1)
// Lt phaser sheet (lt_phaser_v1 — Artist delivered, Shiloh not yet approved → phaserArt OFF, not in IMAGES).
// 640×1152, 160×384 cells, cols U/D/R/L, 3 rows phaserA=draw / phaserM=aim / phaserB=fire. NO x shift.
// muzzle_px: cell-local tip of the emitter (from frames_info.json). Beam emitter at x=0 of fx-phaser-beam (512×32).
export const PHASER_SHEET = {
  img: "lt-phaser-v1",
  beam: "fx-phaser-beam",
  hit: "fx-phaser-hit",
  cell: { w: 160, h: 384, ax: 80, ay: 376 },
  action: "phaser",           // single action, frames A=draw M=aim B=fire
  xShift: null,               // none
  muzzle_px: { up: [115, 129], down: [72, 148], right: [153, 138], left: [6, 138] },
  beamSize: { w: 512, h: 32, emitterX: 0, centreY: 16 },
  hitSize: { w: 96, h: 96, frames: 3, fps: 12, cx: 48, cy: 48 },
};

   // art batch 1: Thelev sh'Zarath -> thelev-v1; art batch 2: Cmdr Okafor -> okafor-v2
export const SHEET_CELL = {
  "thelev-v1": { w: 240, h: 288, ax: 120, ay: 280 },
  "okafor-v2": { w: 240, h: 288, ax: 120, ay: 280 },
  "crew-male-v1": { w: 240, h: 288, ax: 120, ay: 280 },
  "crew-female-v1": { w: 240, h: 288, ax: 120, ay: 280 },
  "crew-betazoid-v1": { w: 240, h: 288, ax: 120, ay: 280 },
  "crew-bolian-v1": { w: 240, h: 288, ax: 120, ay: 280 },
  "crew-human-m2-v1": { w: 240, h: 288, ax: 120, ay: 280 },
  "crew-human-f2-v1": { w: 240, h: 288, ax: 120, ay: 280 },
  "crew-trill-v2": { w: 240, h: 288, ax: 120, ay: 280 },
  "crew-vulcan-m-v1": { w: 240, h: 288, ax: 120, ay: 280 },
};
// Per-character sheets: character -> { sheet asset (assets/<key>.webp) -> actions in row order (3 rows each: A, M, B) }.
// Every v3-format set shares the grid above (160x384, feet 80,376, cols up/down/right/left, A,M,B,M playback) and
// the same draw scale (refH 252 -> FIG_H 83), so characters of matching height stand at matching size.
// Adding a character = one asset + one entry here.
export const CHAR_SHEETS = {
  ...Object.fromEntries(Object.entries(TINT_BASES).map(([k, b]) => [k, { [b.img]: b.actions || ["walk", "talk", "eat", "computer", "kneel", "weld"] }])),
  lt: {
    "lt-v3": ["walk", "talk", "eat", "computer", "kneel", "weld"],      // sprites/lt_topdown_v3; walk rows = lt_walkfix_v1
    "lt-spar-v1": ["punch", "block"],   // Wave C: 640x2304, 160x384 cells, feet (80,376); rows punchA/M/B then blockA/M/B; play A,M,B,M
  },
  tren: { "tren-v1": ["walk", "talk", "eat", "computer", "kneel", "weld"] },  // sprites/tren_topdown_v1 (Captain T'Ren); up/down walk = tren_walkfix_v1
  // Andorian crewwoman (mess hall ambient NPC, AMBIENT_NPCS below). STAND-IN: her art is delayed, so she borrows
  // T'Ren's sheet. When assets/andorian-v1.webp lands, change the key "tren-v1" on the next line to "andorian-v1"
  // (one-line swap; it is preloaded automatically via IMAGES). The new sheet must use the same v3 layout: 160x384
  // cells, feet anchor (80,376), columns up/down/right/left, rows walk/talk/eat/computer/kneel/weld x A/M/B
  // (played A,M,B,M), standing height ~252 px in the cell (refH LT2_STAND_H). Fewer actions = shorten the list.
  andorian: { "thelev-v1": ["walk", "talk", "eat", "computer", "kneel", "weld"] },   // art batch 1: Thelev's own sheet (thelev_v1 masters; gold, not tinted)
  // art batch 2: Commander Okafor (Chief Engineer, she/her) - sprites/okafor_v2 masters packed by tools/pack-masters.py
  // (replaces the old male okafor_topdown_v1 strips, which were never wired: she drew on the generic gold crew sheet)
  okafor: { "okafor-v2": ["walk", "talk", "eat", "computer", "kneel", "weld"] },
  // phase 3 roster fallbacks (own sheet -> species base sheet -> these): the generic crew sheet is T'Ren's for now, in
  // department uniform colours (tools/make-uniform-sheets.py recolours only the red shoulder panels).
  // When a species gets real art, add its sheet here (or to TINT_BASES) and map it in SPECIES_SHEETS above.
  "crew-red": { "tren-v1": ["walk", "talk", "eat", "computer", "kneel", "weld"] },
  "crew-gold": { "crew-gold-v1": ["walk", "talk", "eat", "computer", "kneel", "weld"] },
  "crew-blue": { "crew-blue-v1": ["walk", "talk", "eat", "computer", "kneel", "weld"] },
};
// Pass 09 (5): per-sheet, per-action, per-direction draw scale so the Lt's crown sits at one height in every standing
// frame. Measured from assets/lt-v3.webp (crown = first row with >= 3 opaque px, above the feet anchor at 376): front/back
// walk 253 sheet px; side walk (lt_walkfix_v1) 236 (17 px / ~9 design px short: his head dropped whenever he turned
// side-on); eat / computer 238-245 and weld up/down 246 (the "head duck" on starting work). Each row with a gap over the
// artist's +-6 px tolerance is scaled to 253 about the feet (feet stay planted); talk (gap 4) and kneel (a real crouch)
// are left alone. STEP.lt.side (js/anim.js) grows with the side-walk scale. Drop an entry once the art is redrawn.
export const DIR_SCALE = { "lt-v3": {
  walk: { right: 1.071, left: 1.072 },   // (unused since option A: the walk rows come from WALK_V2)
  eat: { up: 1.034, down: 1.06, right: 1.033, left: 1.038 },
  computer: { up: 1.034, down: 1.062, right: 1.031, left: 1.035 },
  weld: { up: 1.028, down: 1.027 },
} };
// CHAR_FRAMES[who][action][dir] = [A, M, B]; each frame also carries `img` (its sheet key).
export const CHAR_FRAMES = {};
for (const [who, sheets] of Object.entries(CHAR_SHEETS)) {
  const F = CHAR_FRAMES[who] = {};
  for (const [img, actions] of Object.entries(sheets)) actions.forEach((action, ai) => {
    F[action] = {};
    LT2_DIRS.forEach((dir, col) => {
      const C = SHEET_CELL[img] || LT2_CELL;
      F[action][dir] = [0, 1, 2].map(k => ({ img, x: col * C.w, y: (ai * 3 + k) * C.h,
        w: C.w, h: C.h, ax: C.ax, ay: C.ay, refH: LT2_STAND_H / ((DIR_SCALE[img] && DIR_SCALE[img][action] && DIR_SCALE[img][action][dir]) || 1) }));
    });
  });
}

// Wave C spar sheet: right column shifted 12px left, left column 4px right (frames_info.json x_shift_by_dir).
// ax' = ax - shift so feet stay planted when the cell content was nudged in the sheet.
(function applySparXShift() {
  const shift = { right: -12, left: 4 };
  const F = CHAR_FRAMES.lt; if (!F) return;
  for (const act of ["punch", "block"]) {
    if (!F[act]) continue;
    for (const [dir, dax] of Object.entries(shift)) {
      if (!F[act][dir]) continue;
      F[act][dir] = F[act][dir].map(fr => ({ ...fr, ax: fr.ax - dax }));
    }
  }
})();


// back-compat names for the Lieutenant
export const LT2_SHEETS = CHAR_SHEETS.lt;
export const LT2_FRAMES = CHAR_FRAMES.lt;
// time-driven A,M,B,M loop at a fixed 0.22 s/frame (legacy tools only; the game uses anim.js actionFrame with per-action
// timing, holds and seeded rests)
export const charFrame = (who, action, dir, t) =>
  CHAR_FRAMES[who][action][dir][LT2_LOOP[Math.floor(t / (LT2_FRAME_T[action] || LT2_FRAME_T.default)) % 4]];
export const lt2Frame = (action, dir, t) => charFrame("lt", action, dir, t);
// ---- walk_v2 (approved 2026-10-18; option A): the walk rows come from the HI-RES masters, downscaled at draw time ----
// tools/pack-walk-v2.py packs sprites/{lt,tren}_walk_v2/out/hires into lossless sheets (rows A/M/B, columns as below).
// refH = the master's standing height in master px = 252 / (the artist's hires -> 160x384 factor), so a walk frame
// stands exactly FIG_H tall like every other row. The Lt gets all 4 directions; T'Ren and every crewmate drawn on her
// body (crew-red, the Andorian stand-in, the gold / blue department recolours made by the same script) get the side
// walk; their up / down walk stays tren_walkfix_v1 (already in tren-v1 / crew-*-v1).
export const WALK_V2 = {
  lt:   { img: "lt-walk-v2", w: 360, h: 860, ax: 180, ay: 842, dirs: { up: [0, 0.47], down: [1, 0.46], right: [2, 0.495], left: [3, 0.495] } },
  tren: { img: "tren-walk-v2", w: 346, h: 831, ax: 173, ay: 813, dirs: { right: [0, 0.462], left: [1, 0.462] } },
};
const V2_BODY = { lt: ["lt", "lt-walk-v2"], tren: ["tren", "tren-walk-v2"], "crew-red": ["tren", "tren-walk-v2"],
  "crew-gold": ["tren", "crew-gold-walk-v2"], "crew-blue": ["tren", "crew-blue-walk-v2"] };
for (const [who, [body, img]] of Object.entries(V2_BODY)) {
  const V = WALK_V2[body], W = CHAR_FRAMES[who] && CHAR_FRAMES[who].walk; if (!W) continue;
  for (const [dir, [col, k]] of Object.entries(V.dirs)) W[dir] = [0, 1, 2].map(r => ({ img, x: col * V.w, y: r * V.h, w: V.w, h: V.h, ax: V.ax, ay: V.ay, refH: LT2_STAND_H / k }));
}

// ---- Captain T'Ren on the Bridge (visual crew, not saved) ----
// art batch 2 (deck_bridge_v3): home = the first officer's seat beside the Captain's Chair - she walks to its stand spot
// and sits (SEAT_ART.tren, facing the viewscreen at the bottom); stations = consoles she works, clear of the Lt's msd
// (science) stand: tactical behind the rail, the aft engineering station, the aft science station.
export const TREN = {
  deck: "bridge",
  home: { x: 0.4625, y: 0.4813, face: "down", seat: "fo" },
  stations: [
    { x: 0.499, y: 0.2672, face: "down" },    // tactical (479,171)
    { x: 0.8625, y: 0.55, face: "right" },    // engineering, aft station (828,352)
    { x: 0.1417, y: 0.55, face: "left" },     // science, aft station (136,352)
  ],
  homeT: [25, 50], stationT: [15, 30], speed: 0.062,   // s at home, s at a console, walk speed (deck fraction/s; option A: 0.10 x FIG_K)
};

// ---- foreground occluders (pass 18: render/occluders.js) ----
// DECK_OCCL[deck] = { src?, items: [{ id, box: [x0, y0, x1, y1] | poly: [[x, y], ...], baseY, seats?, src?, crop?, alpha? }] }, design px (960x640).
// crop: src is the prop's own cutout for exactly box (not plate-aligned). alpha: draw opacity (default 1).
// src: a plate-aligned image to cut from (default the deck plate itself, "deck-<deck>"). baseY: the prop's footprint line on the
// floor; the item sorts with the characters at that y, so a figure whose feet are above it is drawn under the prop. seats: the
// item is also drawn whenever someone sits in one of these seats. Long diagonal props are split into pieces, each with its own baseY.
// Bridge: art batch 2 console fronts (sprites/deck_bridge_v3_hires/out/fg-bridge.json; fg-bridge.webp 1920x1280, plate-aligned).
export const DECK_OCCL = {
  bridge: { src: "fg-bridge", items: [
    { id: "conn_console", box: [283, 438, 411, 505], baseY: 505, seats: ["conn"] },
    { id: "arm_console_L", box: [389, 272, 426, 322], baseY: 322, seats: ["fo"] },
    { id: "ops_console", box: [541, 438, 669, 505], baseY: 505, seats: ["ops"] },
    { id: "arm_console_R", box: [532, 272, 569, 322], baseY: 322, seats: ["counsel"] },
    // pass 18 3b: cut from the plate (src on the item): the tactical console and the dais rail, split along its curve into three
    // pieces a side (each piece sorts at its own base line, so crew on the dais in front of the rail draw over it)
    { id: "tactical", src: "deck-bridge", poly: [[447, 174], [512, 174], [512, 200], [502, 224], [455, 224], [447, 200]], baseY: 224 },
    { id: "rail_L1", src: "deck-bridge", poly: [[294, 237], [310, 228], [330, 218], [338, 236], [338, 270], [298, 270], [292, 248]], baseY: 270 },
    { id: "rail_L2", src: "deck-bridge", poly: [[330, 218], [345, 211], [360, 205], [375, 201], [390, 197], [390, 241], [338, 256]], baseY: 250 },
    { id: "rail_L3", src: "deck-bridge", poly: [[390, 197], [405, 193], [420, 190], [435, 188], [450, 187], [450, 228], [390, 241]], baseY: 236 },
    { id: "rail_R3", src: "deck-bridge", poly: [[508, 187], [523, 188], [538, 190], [553, 193], [568, 197], [568, 241], [508, 228]], baseY: 236 },
    { id: "rail_R2", src: "deck-bridge", poly: [[568, 197], [583, 201], [598, 205], [613, 211], [628, 218], [620, 256], [568, 241]], baseY: 250 },
    { id: "rail_R1", src: "deck-bridge", poly: [[628, 218], [648, 228], [664, 237], [666, 248], [660, 270], [620, 270], [620, 236]], baseY: 270 },
  ] },
  // Berthing: no items. Checked on the plate with the walk grid: corridor feet stop at y ~320 (row 19 centres 312), north of the
  // washroom wall caps (~315-322 + face); the vestibule and the starboard corridor only run BESIDE the benches and the shower wall
  // (a y-sorted prop beside a walker must not cover him); the bunk-room rug lies south of the bed, chair and desk. Nothing on this
  // deck is ever between a walker and the camera, so an occluder here would never draw. Re-checked on the cleaned plate
  // (decks_berthing_fix_v1): the squashed starboard bench sits in the alcove with only wall north of it, and the new alcove wall
  // end (y 533) has the opening below it (walkers in front) and the starboard corridor / bay beside it, so it stays uncut too.
  berthing: { items: [] },
  // Lounge (cut from deck-lounge): the south jamb of the lobby doorway. Lobby feet reach y ~472, past the jamb's top (~465), so it
  // hides the feet of a walker behind it (Lounge v2: the artist's hires cut, plus the six table fronts over the seated legs). Elsewhere the masks keep feet north of (or beside) the props: the six tables' carve
  // keeps feet off the tabletops (row 16 centres 4 px short of the top edge), the planters' leaves start ~12 px below the floor's
  // south edge, the bar stools and the lift-lobby pillar / door leaf are only ever beside a walker.
  gym: { items: [
    // same lobby doorway as lounge (deck_gym_v1 shares lobby geometry)
    { id: "lobby_jamb", src: "fg-lounge-lobby_jamb", crop: true, box: [202, 459, 246, 502], baseY: 495 },
  ] },
  lounge: { items: [
    { id: "lobby_jamb", src: "fg-lounge-lobby_jamb", crop: true, box: [202, 459, 246, 502], baseY: 495 },
    { id: "table1", src: "fg-lounge-table1", crop: true, box: [346, 273, 411, 315], baseY: 315, seats: ["table1"] },
    { id: "table2", src: "fg-lounge-table2", crop: true, box: [468, 273, 533, 315], baseY: 315, seats: ["mess"] },
    { id: "table3", src: "fg-lounge-table3", crop: true, box: [590, 270, 655, 312], baseY: 312, seats: ["table3"] },
    { id: "table4", src: "fg-lounge-table4", crop: true, box: [353, 383, 418, 425], baseY: 425, seats: ["table4"] },
    { id: "table5", src: "fg-lounge-table5", crop: true, box: [491, 380, 556, 422], baseY: 422, seats: ["table5"] },
    { id: "table6", src: "fg-lounge-table6", crop: true, box: [631, 377, 696, 419], baseY: 419, seats: ["table6"] },
  ] },
  // Medical v2 (sprites/deck_medical_v2/out/fg-medical.json): the artist's cutouts (hires, lossless webp assets/fg-med-*.webp). The
  // office glass panes carry their glass at alpha 0.5 in the pixels (frames opaque), so the items draw at alpha 1: an item alpha
  // (occluders.js) would also fade the frames and halve the glass again. Replaces the v1 arch_W/C/E plate cuts.
  medical: { items: [
    { id: "lift_cap", src: "fg-med-lift_cap", crop: true, box: [376, 436, 586, 476], baseY: 470 },
    { id: "office_glass_W", src: "fg-med-office_glass_W", crop: true, box: [500, 150, 607, 251], baseY: 248 },
    { id: "office_glass_E", src: "fg-med-office_glass_E", crop: true, box: [633, 156, 750, 251], baseY: 248 },
  ] },
  // Engineering FINAL (sprites/deck_engineering_v1/out/fg-engineering.json): the artist's per-prop cutouts (hires crops of the
  // plate, converted to lossless webp as assets/fg-eng-*.webp), pasted at rect with the artist's base lines. core-column is the
  // translucent light column (baseline 250); the floor north of it is off the walk mask so nobody stands inside the beam.
  engineering: { items: [
    { id: "console-w", src: "fg-eng-console-w", crop: true, box: [212, 213, 264, 300], baseY: 299 },
    { id: "console-ne", src: "fg-eng-console-ne", crop: true, box: [613, 165, 691, 261], baseY: 262 },
    { id: "console-bank-sw", src: "fg-eng-console-bank-sw", crop: true, box: [197, 292, 304, 427], baseY: 426 },
    { id: "console-bank-se", src: "fg-eng-console-bank-se", crop: true, box: [607, 300, 703, 432], baseY: 431 },
    { id: "msd", src: "fg-eng-msd", crop: true, box: [404, 369, 517, 427], baseY: 428 },
    { id: "torpedo-loader", src: "fg-eng-torpedo-loader", crop: true, box: [765, 31, 865, 179], baseY: 176 },
    { id: "torpedo-racks", src: "fg-eng-torpedo-racks", crop: true, box: [761, 175, 885, 362], baseY: 360 },
    // P19: the front railing curves (its bottom edge runs y 263 at the ends -> 309 mid), so one base line at 305 drew it over crew
    // on the ring floor at the SW / SE corners. Split code-only into vertical strips of the same cutout (same src + box, each
    // clipped to its x range) with the strip's own base line = the rail's bottom edge at the strip's HIGHER end (so crew
    // standing in front of any part of a strip win; capped at the artist's 305). Nothing walkable sits behind the corner strips.
    ...[[371, 377, 243], [377, 383, 263], [383, 389, 273], [389, 395, 280], [395, 401, 286], [401, 407, 290], [407, 413, 295],
      [413, 419, 298], [419, 425, 301], [425, 431, 303], [431, 437, 305], [437, 443, 305], [443, 479, 305], [479, 485, 305],
      [485, 491, 304], [491, 497, 302], [497, 503, 300], [503, 509, 297], [509, 515, 294], [515, 521, 290], [521, 527, 284],
      [527, 533, 278], [533, 539, 270], [539, 545, 258], [545, 550, 243]].map(([a, b, y]) =>
      ({ id: "railing-front-" + a, src: "fg-eng-railing-front", crop: true, box: [371, 235, 550, 310], polys: [[[a, 235], [b, 235], [b, 310], [a, 310]]], baseY: y })),
    { id: "core-column", src: "fg-eng-core-column", crop: true, box: [415, 0, 506, 238], baseY: 250 },
  ] },
};

// ---- work spots: where a crewmember can actually type (pass 08, audit C11) ----
// [x, y, face] in design px (960x640): feet position in front of a real console, bench or bed, facing it. An ambient
// spot with action "computer" plays the typing loop only if it snaps within 20 px of one of these (it is then moved
// exactly onto it); anywhere else the crewmember stands idle instead. Checked against the plates on 2026-10-18.
// Spots left out on purpose (open floor): engineering pads (on the pad) / torpedo-racks. Bridge: the 7 v3 stations
// (bridge_spots.json consoles_for_ambient); the conn / ops pilots sit (SEAT_ART) instead of typing.
export const CONSOLES = {
  bridge: [[479, 171, "down"], [226, 334, "down"], [732, 334, "down"], [196, 262, "left"], [136, 352, "left"], [766, 262, "right"], [828, 352, "right"]],   // tactical, mission ops, environment, science x2, engineering x2 (pass 18 A: mission ops / environment 341 -> 334: the artist's y 341 sits in grid row 21, a blocked cell; row 20 is floor)
  engineering: [[420, 446, "up"], [500, 446, "up"], [196, 275, "right"], [722, 360, "left"], [288, 592, "up"], [652, 282, "up"]],   // final art: core W/E (facing the MSD), port console, stbd bank (artist 718 -> 722: the 718 grid cell is blocked), storage panel, NE console (new optional neCon)
  medical: [[288, 192, "left"], [288, 384, "left"], [576, 165, "up"], [404, 446, "up"], [691, 339, "up"]],   // bedsides, office desk, surgery terminal (Medical v2: the LCARS panel on the bay front, x 388-420), lab bench
  lounge: [[288, 230, "up"], [552, 440, "down"], [696, 440, "down"], [588, 224, "up"]],   // galley pass, hydroponics x2, replicator
  gym: [],   // spar mat only; no typing consoles
  berthing: [],
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
    deck: "lounge", speed: 0.056, start: "mess-east",   // speed: option A, 0.09 x FIG_K
    spots: [
      { id: "mess-east", x: 0.6938, y: 0.4234, seat: "table3", face: "down", action: "eat", t: [25, 45], w: 3 },   // Lounge v2: table 3 chair (east of the Lt's)
      { id: "mess-west", x: 0.4396, y: 0.4281, seat: "table1", face: "down", action: "eat", t: [25, 45], w: 2 },   // Lounge v2: table 1 chair (west)
      { id: "bar", near: "bar", dx: 0.10, dy: 0.0, face: "up", action: "talk", t: [20, 35], w: 3 },              // a stool along from the Lt's
      { id: "replicator", near: "bar", dx: 0.17, dy: 0.01, face: "up", action: "computer", t: [8, 14], w: 2 },  // replicator slot, bar's east end
      { id: "window", x: 0.70, y: 0.55, face: "right", action: null, t: [15, 30], w: 1 },                         // idle by the viewports
      { id: "floor", x: 0.33, y: 0.56, face: "down", action: null, t: [8, 16], w: 1 },                           // idle mid-room
    ],
    social: {
      // chat spot candidates per Lt node, tried in order; the first whose walkable snap moves it <= maxSnap design px wins.
      // mess: across the table from him (the side away from the bar; the Lt's mess spot sits between table and bar),
      // then beside him to the east. bar: a stool along to the east.
      nodes: { mess: [{ dx: 0.02, dy: 0.035 }, { dx: 0.075, dy: 0.0 }], bar: [{ dx: 0.075, dy: 0.0 }] }, maxSnap: 28,
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

// ---- SHIP ART HOOK (battle groundwork; spec: notes/ship-sprite-spec.md and README "Ship sprites") ----
// SHIP_ART[sprite key] (the key is SHIPS[id].sprite in js/ships.js) = { img, len, ... }. img: an asset key, preloaded like
// every plate (assets/<img>.webp); null = no art yet -> the vector placeholder (render/ships.js). A missing file falls back
// to the placeholder too. Optional per ship: len (the ship's nose-to-tail length in cell px; default SHIP_SHEET.len),
// pivot ([x, y] in cell px; default SHIP_SHEET.pivot), rows (override frame counts / fps per state), engine (false = no
// engine-glow row on this sheet).
// SHIP_SHEET: one horizontal strip per state, all cells the same size; the ship FACES RIGHT (+x) in every cell; enemies are
// mirrored at draw time. The pivot is the ship's visual centre; the drawn box (the ship's length x its class aspect) is
// centred on it. Frames advance at fps; loop rows repeat, one-shot rows hold their last frame.
export const SHIP_SHEET = {
  cell: [512, 256], pivot: [256, 128], len: 448, facing: "right",
  rows: [   // row order on the sheet, top to bottom
    { state: "idle", frames: 4, fps: 6, loop: true },        // drifting, running lights
    { state: "firing", frames: 4, fps: 12, loop: false },    // muzzle flash / torpedo launch (beams and torpedoes are drawn by the game)
    { state: "damaged", frames: 4, fps: 6, loop: true },     // replaces idle below 35% hull: scorching, venting plasma
    { state: "shieldsHit", frames: 4, fps: 14, loop: false }, // the shield bubble lighting up (allies' shields; optional for enemies)
    { state: "explode", frames: 8, fps: 10, loop: false },   // the kill: breaking apart; the game fades the ship out over 1.3 s
    { state: "engine", frames: 4, fps: 8, loop: true, blend: "lighter" },   // OPTIONAL overlay: engine / nacelle glow only, drawn additively over every state
  ],
};
// SHIP_ART_BATCH2: the artist's ships batch 2 sheets (sprites/ships_batch2, not yet approved by Shiloh). false = those
// classes fall back to painted/vector. Revert: set false, or git revert the commit that added this.
export const SHIP_ART_BATCH2 = true;
const B2 = id => (SHIP_ART_BATCH2 ? { img: "ship-" + id, engine: false } : { img: null });
export const SHIP_ART = {
  tenacity: { img: null }, freighter: B2("freighter"), klingon_bop: B2("klingon_bop"), fed_saber: { img: "ship-fed_saber", engine: false },
  jh_fighter: { img: null }, galor: B2("galor"), jh_battlecruiser: B2("jh_battlecruiser"),
};
// FX_SHEET: the artist's explosion sheets (sprites/fx_explosion_v1/fx.json). 256px cells, pivot (128,128).
// fx-explosion: normal blend, straight alpha. fx-additive: 'lighter' on black. Used by render/shipfx.js; a missing sheet
// falls back to procedural gradients.
export const FX_SHEET = { cell: 256, sheets: {
  explosion: { img: "fx-explosion", blend: "source-over", rows: { fireball: { row: 0, frames: 8, fps: 14 }, smoke: { row: 1, frames: 6, fps: 8 } } },
  additive: { img: "fx-additive", blend: "lighter", rows: { warpBreach: { row: 0, frames: 6, fps: 12 }, sparks: { row: 1, frames: 6, fps: 14 } } },
} };
// EXPLOSION: ship death sequence (render/shipfx.js). Sizes are in units of the ship's drawn length. Ships with
// bigBoom: true (js/ships.js) use the big profile. total = B.dying (victory fires when it runs out).
export const EXPLOSION = {
  default: { total: 2.4, chain: { n: [3, 4], over: 1.0, size: 0.32 }, det: 1.05, flash: 0.07, hitStop: { dur: 0.1, scale: 0.08 },
    shake: { dur: 0.45, amp: 9 }, ring: { dur: 0.9, r: 1.15, squash: 0.22, width: 3 }, chunks: { n: 6, speed: 0.55, spin: 3.5, life: 1.35, glow: 0.9 },
    wreck: { drift: 3, spin: 1.5, life: 2.6, glow: 0.3, debrisDrift: 4, debrisLife: [1.4, 2.4] },
    fireball: { size: 0.95 }, smoke: { size: 1.25, delay: 0.32 }, embers: { n: 26, speed: 0.7, life: [0.6, 1.3] }, specks: { n: 18, life: [1.0, 1.4] }, breach: null },
  big: { total: 2.7, chain: { n: [4, 4], over: 1.1, size: 0.26 }, det: 1.15, flash: 0.09, hitStop: { dur: 0.12, scale: 0.06 },
    shake: { dur: 0.6, amp: 13 }, ring: { dur: 0.8, r: 1.7, squash: 0.2, width: 4 }, chunks: { n: 9, speed: 0.45, spin: 2.6, life: 1.5, glow: 1 },
    wreck: { drift: 2.5, spin: 1.2, life: 2.9, glow: 0.35, debrisDrift: 3.5, debrisLife: [1.6, 2.6] },
    fireball: { size: 0.8 }, smoke: { size: 1.1, delay: 0.3 }, embers: { n: 40, speed: 0.8, life: [0.7, 1.5] }, specks: { n: 26, life: [1.1, 1.5] },
    breach: { size: 0.9, stretch: 3.2 } },
};
// SHIP_PAINTED[sprite key] = { img, facing }: the legacy single painted image per class (pre-groundwork art), used by
// render/ships.js when the class has no SHIP_ART sheet loaded, before the vector placeholder. img: asset key (preloaded
// via IMAGES below); facing: the image's native nose direction ("right" or "left"), so enemies mirror to face the player.
// The image keeps its own aspect, fitted (contain, centred) into the class's drawn box. Classes not listed stay vector.
export const SHIP_PAINTED = {
  tenacity: { img: "ship-tenacity", facing: "right" },     // 1400x400, saucer forward on the right
  jh_fighter: { img: "ship-jemhadar", facing: "left" },    // 1400x715, prongs forward on the left (the old enemy, drawn unmirrored)
};
import { DOOR_IMAGES } from "./doors-data.js";
import { SHIP_STATE_IMAGES } from "./ship-states.js";
export const IMAGES = [...new Set([...DOOR_IMAGES, ...SHIP_STATE_IMAGES,
  "ship-bajoran_transport", "ship-bajoran_transport-damaged", "ship-ferengi_marauder", "ship-runabout", "ship-comet", "ship-comet-tail",   // Oct 27: vignettes_v1 (Shiloh approved)
  "deck-bridge", "fg-bridge", "deck-engineering", "deck-medical", "deck-berthing", "deck-lounge", "deck-gym",
  "chip-meal", "chip-cards", "chip-tongo", "prop-lounge-poker", "prop-lounge-tongo",
  "crew-atlas", "crew-captain", "crew-engineer", "crew-science", "crew-security", "lt-walk-v2", "tren-walk-v2", "crew-gold-walk-v2", "crew-blue-walk-v2",
  "space-backdrop", "bg-ds9", "bg-convoy", "bg-derelict", "bg-travel", "bg-earth", "bg-qonos", "bg-romulus", "bg-vulcan",
  ...Object.values(SHIP_ART).map(a => a.img).filter(Boolean), ...Object.values(SHIP_PAINTED).map(a => a.img), ...Object.values(FX_SHEET.sheets).map(x => x.img), ...Object.values(CHAR_SHEETS).flatMap(o => Object.keys(o)),
  ...[LIE_ART, SEAT_ART].flatMap(o => Object.values(o).map(a => a.img)), ...Object.values(TINT_BASES).map(b => b.mask).filter(Boolean),
  ...Object.values(CABIN_TIERS).map(t => t.plate).filter(Boolean), ...DECOR_ITEMS.filter(d => d.art).map(d => "decor-" + d.id),
  ...Object.values(DECK_OCCL).flatMap(T => T.items.map(it => it.src)).filter(Boolean)])];   // cabin plates join once the artist delivers them   // deduped (stand-in sheets share keys)
// walk masks (PNG, white = floor), loaded alongside the plates
export const WALK_MASKS = [...CREW_DECKS.map(d => "walk-" + d), ...Object.values(CABIN_TIERS).map(t => t.mask).filter(Boolean)];
