// Phase 4: the Lt's Quarters (berthing, own turbolift stop) and the decor catalogue. Pure data / config.
// Coordinates are fractions of the 960x640 design plate (same convention as data.js DECKS).
//
// ART: art batch 2 wires sprites/cabin_v4 (plates, walk masks, beds, desk stand, slots) for all four tiers. If a plate or
// mask fails to load, js/cabin.js placeholderPlate draws a simple room and the walk grid comes from `floor` / `blocks`.
const R = (x0, y0, x1, y1) => [x0, y0, x1, y1];

// Slot types: wall, shelf, desk, corner, floor, window, large, replicator.
// Slot anchors: x,y = the slot's centre on the plate; w,h = its true-scale box (design fractions, cabin_v4 JSON).
// hidden: a slot the plate has room for but no decor art yet (large1/2, window2, shelf3): not drawn, not offered.
// desk = the tier's stand node at the desk (DECKS.quarters.nodes.desk); every tier has one desk1 slot on the desk top.
// bed.lieLen = the plate's mattress length in design px (cabin_v4 JSON); lieRot 0 = head up, -pi/2 = head left (Cmdr).
// The Lt's lying body is 84.6 design px, so he lies at full size on every bed (tools/lie-seat-fit.js).
export const CABIN_TIERS = {
  ltjg: {
    rank: 0, name: "Shared bunk room", blurb: "Two racks, two lockers, one bunkmate who snores in Bolian.",
    plate: "cabin-ltjg", mask: "walk-cabin-ltjg",   // cabin_v4 (sprites/cabin_v4/out/cabin-ltjg.json)
    floor: [R(0.049, 0.2844, 0.9531, 0.5031), R(0.2896, 0.5031, 0.9531, 0.8984), R(0.3979, 0.2469, 0.6042, 0.2859)],
    blocks: [R(0.0396, 0.1031, 0.1667, 0.3812), R(0.1854, 0.1625, 0.3063, 0.3187), R(0.2125, 0.2844, 0.2698, 0.3766), R(0.3438, 0.0312, 0.4, 0.2906), R(0.6021, 0.0312, 0.6396, 0.2906), R(0.5583, 0.1688, 0.6188, 0.3063), R(0.6854, 0.1625, 0.8094, 0.325), R(0.7115, 0.2844, 0.7646, 0.3766), R(0.8292, 0.1031, 0.9583, 0.3812), R(0.4167, 0.4281, 0.576, 0.6031), R(0.5604, 0.6937, 0.7229, 0.8656), R(0.3312, 0.7453, 0.4552, 0.8656), R(0, 0.4938, 0.2917, 1), R(0.8729, 0.8063, 0.9396, 0.9062)],
    lift: { x: 0.501, y: 0.2969, mx: 0.4979, my: 0.1641 },
    bed: { x: 0.1771, y: 0.3937, mx: 0.1042, my: 0.2219, lie: [0.1042, 0.2219], lieRot: 0, lieLen: 107 },
    desk: { x: 0.3229, y: 0.325, mx: 0.2417, my: 0.2, face: "left" },
    guest: { x: 0.72, y: 0.68, mx: 0.72, my: 0.64, face: "down",
      seat: { at: [0.72, 0.64], face: "down", hip: { down: [0, 0], up: [0, 0] }, stand: [0.72, 0.68] } },
    rest: 6.5,
    beds: [R(0.049, 0.1172, 0.1594, 0.3719), R(0.8365, 0.1172, 0.951, 0.3719)],
    slots: [
      { id: "wall1", type: "wall", x: 0.6729, y: 0.1344, w: 0.0479, h: 0.0391 },
      { id: "shelf1", type: "shelf", x: 0.3667, y: 0.7835, w: 0.0292, h: 0.033 },
      { id: "corner1", type: "corner", x: 0.9062, y: 0.85, w: 0.0555, h: 0.0813 },
      { id: "replicator", type: "replicator", x: 0.3208, y: 0.1478, w: 0.0458, h: 0.0706 },
      { id: "desk1", type: "desk", x: 0.2885, y: 0.2313, w: 0.0146, h: 0.0375 },
    ],
  },
  lt: {
    rank: 1, name: "Small private cabin", blurb: "A door that closes. A desk. Your own rack.",
    plate: "cabin-lt", mask: "walk-cabin-lt",   // cabin_v4 (sprites/cabin_v4/out/cabin-lt.json)
    floor: [R(0.0125, 0.2891, 0.9771, 0.5234), R(0.2729, 0.5234, 0.9771, 0.9344), R(0.3979, 0.2578, 0.6208, 0.2922)],
    blocks: [R(0.0104, 0.0969, 0.1521, 0.4156), R(0.1479, 0.2125, 0.2135, 0.3344), R(0.3396, 0.0437, 0.3979, 0.3094), R(0.6208, 0.0437, 0.6708, 0.3094), R(0.6896, 0.1719, 0.8396, 0.3344), R(0.7167, 0.3094, 0.7979, 0.4281), R(0.8458, 0.0688, 0.9979, 0.375), R(0.7083, 0.5188, 0.8187, 0.7094), R(0.6771, 0.6719, 0.7458, 0.7875), R(0, 0.5203, 0.275, 1), R(0.9, 0.8406, 0.9667, 0.9375), R(0.5667, 0.1875, 0.6125, 0.275), R(0.6104, 0.5219, 0.7125, 0.7156)],
    lift: { x: 0.4958, y: 0.3063, mx: 0.4958, my: 0.175 },
    bed: { x: 0.175, y: 0.3719, mx: 0.0813, my: 0.2156, lie: [0.0813, 0.2156], lieRot: 0, lieLen: 140 },
    desk: { x: 0.6771, y: 0.3469, mx: 0.7583, my: 0.2344, face: "right" },
    guest: { x: 0.661, y: 0.74, mx: 0.661, my: 0.7, face: "down",
      seat: { at: [0.661, 0.7], face: "down", hip: { down: [0, 0], up: [0, 0] }, stand: [0.661, 0.74] } },
    rest: 8,
    beds: [R(0.0156, 0.1031, 0.1469, 0.4125)],
    slots: [
      { id: "wall1", type: "wall", x: 0.0833, y: 0.0844, w: 0.0479, h: 0.0391 },
      { id: "wall2", type: "wall", x: 0.6833, y: 0.1281, w: 0.0479, h: 0.0391 },
      { id: "shelf1", type: "shelf", x: 0.2833, y: 0.2, w: 0.0292, h: 0.0328 },
      { id: "desk1", type: "desk", x: 0.8187, y: 0.2375, w: 0.0146, h: 0.0375 },
      { id: "corner1", type: "corner", x: 0.9333, y: 0.8906, w: 0.0552, h: 0.0813 },
      { id: "floor1", type: "floor", x: 0.4479, y: 0.6562, w: 0.1167, h: 0.1 },
      { id: "replicator", type: "replicator", x: 0.3177, y: 0.1484, w: 0.0458, h: 0.0703 },
    ],
  },
  ltcmdr: {
    rank: 2, name: "Cabin with a viewport", blurb: "Stars going by at warp. Room for a guest chair.",
    plate: "cabin-ltcmdr", mask: "walk-cabin-ltcmdr",   // cabin_v4 (sprites/cabin_v4/out/cabin-ltcmdr.json)
    floor: [R(0.0146, 0.2969, 0.9771, 0.6875), R(0.2083, 0.25, 0.9771, 0.2969), R(0.3125, 0.6875, 0.8125, 0.7625), R(0.4375, 0.2281, 0.5625, 0.2594)],
    blocks: [R(0.0104, 0.0969, 0.1521, 0.3688), R(0.1437, 0.175, 0.2083, 0.3), R(0.3438, 0.0469, 0.4, 0.2781), R(0.5979, 0.0469, 0.6479, 0.2781), R(0.6833, 0.1844, 0.8771, 0.3047), R(0.7969, 0.1844, 0.8771, 0.4656), R(0.7083, 0.3063, 0.7979, 0.4406), R(0.8562, 0.0938, 0.9792, 0.2969), R(0.1875, 0.3844, 0.3229, 0.6094), R(0.3833, 0.4562, 0.6125, 0.6062), R(0.4333, 0.6062, 0.5625, 0.7719), R(0.0125, 0.5281, 0.1437, 0.6594), R(0.9073, 0.6078, 0.9635, 0.6891)],
    lift: { x: 0.5, y: 0.2844, mx: 0.5, my: 0.1562 },
    bed: { x: 0.1792, y: 0.3656, mx: 0.0813, my: 0.25, lie: [0.0813, 0.25], lieRot: 0, lieLen: 108 },
    desk: { x: 0.6771, y: 0.375, mx: 0.7521, my: 0.2188, face: "right" },
    guest: { x: 0.7, y: 0.58, mx: 0.7, my: 0.54, face: "down",
      seat: { at: [0.7, 0.54], face: "down", hip: { down: [0, 0], up: [0, 0] }, stand: [0.7, 0.58] } },
    rest: 9,
    beds: [R(0.0187, 0.1, 0.1458, 0.3656)],
    slots: [
      { id: "wall1", type: "wall", x: 0.0917, y: 0.075, w: 0.0479, h: 0.0391 },
      { id: "wall2", type: "wall", x: 0.326, y: 0.1125, w: 0.0479, h: 0.0391 },
      { id: "window1", type: "window", x: 0.1833, y: 0.7438, w: 0.0542, h: 0.0469 },
      { id: "shelf1", type: "shelf", x: 0.9167, y: 0.1344, w: 0.0292, h: 0.0328 },
      { id: "shelf2", type: "shelf", x: 0.1896, y: 0.2094, w: 0.025, h: 0.0312 },
      { id: "desk1", type: "desk", x: 0.8458, y: 0.2313, w: 0.0146, h: 0.0375 },
      { id: "corner1", type: "corner", x: 0.9354, y: 0.6484, w: 0.0552, h: 0.0813 },
      { id: "floor1", type: "floor", x: 0.7917, y: 0.5813, w: 0.1167, h: 0.1 },
      { id: "large1", type: "large", x: 0.0833, y: 0.5938, w: 0.1198, h: 0.1297, hidden: true },
      { id: "replicator", type: "replicator", x: 0.675, y: 0.125, w: 0.0458, h: 0.0703 },
    ],
  },
  cmdr: {
    rank: 3, name: "Commander's suite", blurb: "A sitting room, a sleeping alcove, and a long viewport. You could host the senior staff.",
    plate: "cabin-cmdr", mask: "walk-cabin-cmdr",   // cabin_v4 (sprites/cabin_v4/out/cabin-cmdr.json)
    floor: [R(0.3563, 0.2344, 0.9062, 0.3469), R(0.1333, 0.3469, 0.9427, 0.7344), R(0.0333, 0.4688, 0.1333, 0.7344), R(0.1771, 0.2, 0.3312, 0.35), R(0.0833, 0.35, 0.1771, 0.4031), R(0.3125, 0.7344, 0.6771, 0.7656)],
    blocks: [R(0.0458, 0.1469, 0.1771, 0.35), R(0.0354, 0.3312, 0.0813, 0.3937), R(0.0292, 0.3969, 0.1333, 0.4688), R(0.35, 0.0469, 0.3979, 0.25), R(0.6021, 0.0469, 0.6521, 0.25), R(0.6854, 0.1406, 0.9062, 0.2344), R(0.7812, 0.1844, 0.8458, 0.3156), R(0.7208, 0.25, 0.8854, 0.4219), R(0.0312, 0.5437, 0.1354, 0.7125), R(0.6833, 0.5031, 0.8354, 0.75), R(0.3083, 0.7625, 0.6813, 0.875), R(0.1375, 0.5516, 0.2583, 0.6828), R(0.8458, 0.5312, 0.9354, 0.7031), R(0.8875, 0.2781, 0.9417, 0.3625), R(0.2781, 0.2, 0.3312, 0.275), R(0.8354, 0.7, 0.9437, 0.7688), R(0.8458, 0.2281, 0.9437, 0.2812)],
    lift: { x: 0.5, y: 0.2719, mx: 0.5, my: 0.1437 },
    bed: { x: 0.2083, y: 0.3, mx: 0.1115, my: 0.2422, lie: [0.1115, 0.2422], lieRot: -Math.PI / 2, lieLen: 106 },
    desk: { x: 0.6958, y: 0.3344, mx: 0.7708, my: 0.3312, face: "right" },
    guest: { x: 0.48, y: 0.58, mx: 0.48, my: 0.54, face: "down",
      seat: { at: [0.48, 0.54], face: "down", hip: { down: [0, 0], up: [0, 0] }, stand: [0.48, 0.58] } },
    rest: 10,
    beds: [R(0.05, 0.15, 0.175, 0.3469)],
    slots: [
      { id: "wall1", type: "wall", x: 0.2417, y: 0.1781, w: 0.0479, h: 0.0375 },
      { id: "wall2", type: "wall", x: 0.3167, y: 0.1625, w: 0.0229, h: 0.0469 },
      { id: "wall3", type: "wall", x: 0.2729, y: 0.4, w: 0.0521, h: 0.0375 },
      { id: "window1", type: "window", x: 0.1667, y: 0.7438, w: 0.0542, h: 0.0469 },
      { id: "window2", type: "window", x: 0.8229, y: 0.7656, w: 0.0542, h: 0.0469, hidden: true },
      { id: "shelf1", type: "shelf", x: 0.0833, y: 0.5969, w: 0.0292, h: 0.0328 },
      { id: "shelf2", type: "shelf", x: 0.7292, y: 0.1812, w: 0.0292, h: 0.0328 },
      { id: "shelf3", type: "shelf", x: 0.875, y: 0.1812, w: 0.0292, h: 0.0328, hidden: true },
      { id: "desk1", type: "desk", x: 0.7438, y: 0.2875, w: 0.0146, h: 0.0375 },
      { id: "corner1", type: "corner", x: 0.9146, y: 0.3203, w: 0.0521, h: 0.0813 },
      { id: "corner2", type: "corner", x: 0.3042, y: 0.2375, w: 0.0521, h: 0.075 },
      { id: "floor1", type: "floor", x: 0.5, y: 0.3094, w: 0.1167, h: 0.0781 },
      { id: "floor2", type: "floor", x: 0.2417, y: 0.3203, w: 0.1083, h: 0.0875 },
      { id: "large1", type: "large", x: 0.1979, y: 0.6172, w: 0.1198, h: 0.1297, hidden: true },
      { id: "large2", type: "large", x: 0.8906, y: 0.6172, w: 0.0885, h: 0.1688, hidden: true },
      { id: "replicator", type: "replicator", x: 0.6771, y: 0.15, w: 0.0458, h: 0.0703 },
    ],
  },
};
export const CABIN_ORDER = ["ltjg", "lt", "ltcmdr", "cmdr"];
export const SLOT_NAMES = { wall: "Wall", shelf: "Shelf", desk: "Desk", corner: "Corner", floor: "Floor", window: "Viewport sill", large: "Large floor space", replicator: "Replicator" };

// DECOR_ITEMS: cost in the generic wallet ({ rations: n } or { rep: n }); gate = { rank: index } | { fr: n } | { drop: source };
// bonus = { comfort (rest-rate multiplier share), social (positive-opinion gain share), readiness (flat points) }.
// Totals are capped in PROG.cabin.caps. art = [w, h] design px of assets/decor-<id>.webp (cabin_v4 measurements.json decor_sizes): drawn at that size centred
// in its slot, never stretched. Items without art keep their emoji icon as a placeholder.
export const DECOR_ITEMS = [
  { id: "diploma", name: "Academy diploma", slot: "wall", cost: { rations: 40 }, gate: null, art: [20, 15.2], icon: "📜", bonus: { comfort: 0.02 } },
  { id: "plant", name: "Potted Bajoran lily", slot: "corner", cost: { rations: 60 }, gate: null, art: [53.3, 52], icon: "🪴", bonus: { comfort: 0.04 } },
  { id: "lamp", name: "Desk lamp", slot: "desk", cost: { rations: 80 }, gate: null, art: [14, 24], icon: "💡", bonus: { comfort: 0.04 } },
  { id: "holophoto", name: "Holo-photo frame", slot: "shelf", cost: { rations: 120 }, gate: null, art: [14, 14.2], icon: "🖼️", bonus: { comfort: 0.03, social: 0.01 } },
  { id: "rug", name: "Woven rug", slot: "floor", cost: { rations: 150 }, gate: null, art: [112, 47.2], icon: "🟫", bonus: { comfort: 0.06 } },
  { id: "painting", name: "Painting: Risa at dusk", slot: "wall", cost: { rations: 220 }, gate: null, art: [46, 25], icon: "🌅", bonus: { comfort: 0.03, social: 0.01 } },
  { id: "shipmodel", name: "Model of the Tenacity", slot: "shelf", cost: { rations: 300 }, gate: null, art: [28, 21.1], icon: "🚀", bonus: { readiness: 1 } },
  { id: "chess", name: "3-D chess set", slot: "desk", cost: { rations: 350 }, gate: null, art: [20, 16.8], icon: "♟️", bonus: { social: 0.02 } },
  { id: "batleth", name: "Klingon bat'leth", slot: "wall", cost: { rations: 450 }, gate: { fr: 15 }, art: [50, 23.9], icon: "⚔️", bonus: { readiness: 1 } },
  { id: "replicator", name: "Replicator upgrade (gourmet patterns)", slot: "replicator", cost: { rations: 500 }, gate: { rank: 1 }, art: [44, 45.2], icon: "🍲", bonus: { comfort: 0.08 } },
  { id: "vulcanlamp", name: "Vulcan meditation lamp", slot: "desk", cost: { rations: 260 }, gate: { rank: 1 }, art: [14.6, 16], icon: "🕯️", bonus: { comfort: 0.06 } },
  { id: "andorian",art: [15.8, 22.0],  name: "Andorian ice sculpture", slot: "shelf", cost: { rations: 650 }, gate: { fr: 25 }, icon: "🧊", bonus: { social: 0.02 } },
  { id: "targ",art: [74.1, 52.0],  name: "Targ-hide rug", slot: "floor", cost: { rations: 600 }, gate: { fr: 30 }, icon: "🐗", bonus: { comfort: 0.05, social: 0.01 } },
  { id: "telescope",art: [21.8, 34.0],  name: "Antique brass telescope", slot: "window", cost: { rations: 700 }, gate: { rank: 2 }, icon: "🔭", bonus: { comfort: 0.04, readiness: 1 } },
  { id: "brandy",art: [34.7, 52.0],  name: "Saurian brandy cabinet", slot: "corner", cost: { rations: 800 }, gate: { rank: 2 }, icon: "🍷", bonus: { social: 0.03 } },
  { id: "fishtank",art: [76.7, 80.0],  name: "Fish tank", slot: "large", cost: { rations: 900 }, gate: { rank: 2 }, icon: "🐠", bonus: { comfort: 0.10 } },
  { id: "bonsai",art: [48.1, 52.0],  name: "Century-old Vulcan bonsai", slot: "corner", cost: { rations: 1200 }, gate: { fr: 20 }, icon: "🌳", bonus: { comfort: 0.05 } },
  { id: "dabo",art: [66.3, 80.0],  name: "Dabo wheel (retired from Quark's)", slot: "large", cost: { rations: 1500 }, gate: { fr: 40 }, icon: "🎡", bonus: { social: 0.03 } },
  { id: "holowindow", name: "Holo-window: Earth sunrise", slot: "window", cost: { rations: 450 }, gate: { rank: 2 }, art: [52, 29.4], icon: "🌄", bonus: { comfort: 0.04 } },
  { id: "naiskos",art: [15.3, 22.0],  name: "Kurlan naiskos", slot: "shelf", cost: { rations: 3000 }, gate: { fr: 60 }, icon: "🏺", bonus: { social: 0.03, readiness: 1 } },
  { id: "shipbottle",art: [24.0, 16.9],  name: "Enterprise-D in a bottle", slot: "shelf", cost: { rations: 1800 }, gate: { rank: 3 }, icon: "🍾", bonus: { comfort: 0.03 } },
  { id: "jukebox",art: [51.8, 80.0],  name: "Vintage Earth jukebox", slot: "large", cost: { rations: 2000 }, gate: { fr: 45 }, icon: "🎵", bonus: { social: 0.03 } },
  { id: "holoLib",art: [20.0, 14.8],  name: "Personal holo-novel library", slot: "desk", cost: { rations: 2400 }, gate: { fr: 50 }, icon: "📚", bonus: { comfort: 0.05 } },
  // prestige pieces paid in reputation (a real rep sink; spending rep never lowers the board record)
  { id: "portrait",art: [36.9, 30.0],  name: "Commissioned portrait of the senior staff", slot: "wall", cost: { rep: 1500 }, gate: { rank: 2 }, icon: "🎨", bonus: { social: 0.03 } },
  { id: "galaxymodel",art: [24.0, 19.6],  name: "Galaxy-class display model, 1:350", slot: "shelf", cost: { rep: 2500 }, gate: { fr: 35 }, icon: "🛸", bonus: { readiness: 1 } },
  // phase 5 follow-up: late-game rep prestige (rank + Fleet Rep gates), placeholder emoji until the artist delivers
  { id: "idic",art: [17.2, 22.0],  name: "Vulcan IDIC pendant in a display case", slot: "shelf", cost: { rep: 1200 }, gate: { fr: 45 }, icon: "🔺", bonus: { comfort: 0.02, social: 0.02 } },
  { id: "phaser1",art: [17.2, 20.0],  name: "Type-1 hand phaser, Kirk's era (deactivated)", slot: "desk", cost: { rep: 1800 }, gate: { rank: 2, fr: 45 }, icon: "📟", bonus: { readiness: 1 } },
  { id: "dressuniform",art: [24.0, 30.0],  name: "Framed admiral's dress uniform, a gift from the fleet", slot: "wall", cost: { rep: 2200 }, gate: { rank: 3, fr: 50 }, icon: "🎖️", bonus: { social: 0.03 } },
  { id: "batlethorder",art: [22.2, 30.0],  name: "Order of the Bat'leth (honorary, from Qo'noS)", slot: "wall", cost: { rep: 3000 }, gate: { rank: 3, fr: 60 }, icon: "🏵️", bonus: { readiness: 1, social: 0.02 } },
  { id: "captainchair",art: [80.0, 79.7],  name: "Captain's chair replica", slot: "large", cost: { rep: 4000 }, gate: { rank: 3 }, icon: "🪑", bonus: { comfort: 0.05, readiness: 1 } },
  // drop only: found, not bought (favours now; away missions in a later phase)
  { id: "yardplaque",art: [27.2, 18.0],  name: "Utopia Planitia yard plaque", slot: "wall", cost: null, gate: { drop: "favour:shipment" }, icon: "🏅", bonus: { readiness: 1 } },
  { id: "flute",art: [14.8, 10.0],  name: "Ressikan flute", slot: "shelf", cost: null, gate: { drop: "away:kataan" }, icon: "🪈", bonus: { comfort: 0.04, social: 0.02 } },
  { id: "tribble",art: [15.9, 16.0],  name: "Tribble (sterile, honest)", slot: "corner", cost: null, gate: { drop: "away:k7" }, icon: "🟤", bonus: { social: 0.02 } },
];
export const DECOR = Object.fromEntries(DECOR_ITEMS.map(d => [d.id, d]));
