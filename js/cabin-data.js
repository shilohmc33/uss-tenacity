// Phase 4: the Lt's Quarters (berthing, own turbolift stop) and the decor catalogue. Pure data / config.
// Coordinates are fractions of the 960x640 design plate (same convention as data.js DECKS).
//
// ART HOOK-UP: each tier has `plate` / `mask` = null until the artist delivers. Set them to the delivered asset keys
// ("cabin-lt", "walk-cabin-lt") and the files are preloaded and used; until then a simple room is drawn in code
// (js/cabin.js placeholderPlate) and the walk grid comes from `floor` / `blocks` rectangles.
const R = (x0, y0, x1, y1) => [x0, y0, x1, y1];

// Slot types: wall, shelf, desk, corner, floor, window, large, replicator.
// Slot anchors: x,y = the item's foot/centre point on the plate; w,h = its placeholder box (design fractions).
export const CABIN_TIERS = {
  ltjg: {
    rank: 0, name: "Shared bunk room", blurb: "Two racks, two lockers, one bunkmate who snores in Bolian.",
    plate: null, mask: null,
    floor: [R(0.22, 0.42, 0.78, 0.93)], blocks: [R(0.22, 0.42, 0.40, 0.66), R(0.60, 0.42, 0.78, 0.66)],
    lift: { x: 0.50, y: 0.86, mx: 0.50, my: 0.93 },
    bed: { x: 0.31, y: 0.70, mx: 0.31, my: 0.56, lie: [0.31, 0.545], lieRot: -Math.PI / 2, lieLen: 120 },
    rest: 6.5,
    beds: [R(0.23, 0.44, 0.39, 0.64), R(0.61, 0.44, 0.77, 0.64)],     // placeholder drawing: the Lt's rack + the bunkmate's
    slots: [
      { id: "wall1", type: "wall", x: 0.50, y: 0.30, w: 0.10, h: 0.10 },
      { id: "shelf1", type: "shelf", x: 0.31, y: 0.37, w: 0.07, h: 0.06 },
      { id: "corner1", type: "corner", x: 0.74, y: 0.80, w: 0.06, h: 0.10 },
      { id: "replicator", type: "replicator", x: 0.25, y: 0.82, w: 0.06, h: 0.09 },
    ],
  },
  lt: {
    rank: 1, name: "Small private cabin", blurb: "A door that closes. A desk. Your own rack.",
    plate: null, mask: null,
    floor: [R(0.18, 0.40, 0.82, 0.93)], blocks: [R(0.18, 0.40, 0.40, 0.62), R(0.62, 0.40, 0.82, 0.50)],
    lift: { x: 0.50, y: 0.86, mx: 0.50, my: 0.93 },
    bed: { x: 0.29, y: 0.67, mx: 0.29, my: 0.52, lie: [0.29, 0.51], lieRot: -Math.PI / 2, lieLen: 140 },
    rest: 8,
    beds: [R(0.19, 0.42, 0.39, 0.60)],
    slots: [
      { id: "wall1", type: "wall", x: 0.42, y: 0.28, w: 0.10, h: 0.10 },
      { id: "wall2", type: "wall", x: 0.60, y: 0.28, w: 0.10, h: 0.10 },
      { id: "shelf1", type: "shelf", x: 0.27, y: 0.35, w: 0.07, h: 0.06 },
      { id: "desk1", type: "desk", x: 0.72, y: 0.46, w: 0.07, h: 0.06 },
      { id: "corner1", type: "corner", x: 0.78, y: 0.82, w: 0.06, h: 0.10 },
      { id: "floor1", type: "floor", x: 0.55, y: 0.68, w: 0.16, h: 0.08 },
      { id: "replicator", type: "replicator", x: 0.22, y: 0.82, w: 0.06, h: 0.09 },
    ],
  },
  ltcmdr: {
    rank: 2, name: "Cabin with a viewport", blurb: "Stars going by at warp. Room for a guest chair.",
    plate: null, mask: null,
    floor: [R(0.12, 0.38, 0.88, 0.93)], blocks: [R(0.12, 0.38, 0.34, 0.60), R(0.66, 0.38, 0.88, 0.48), R(0.74, 0.60, 0.88, 0.76)],
    lift: { x: 0.50, y: 0.86, mx: 0.50, my: 0.93 },
    bed: { x: 0.23, y: 0.65, mx: 0.23, my: 0.50, lie: [0.23, 0.49], lieRot: -Math.PI / 2, lieLen: 150 },
    rest: 9, window: R(0.40, 0.08, 0.64, 0.26),
    beds: [R(0.13, 0.40, 0.33, 0.58)],
    slots: [
      { id: "wall1", type: "wall", x: 0.30, y: 0.27, w: 0.09, h: 0.09 },
      { id: "wall2", type: "wall", x: 0.74, y: 0.27, w: 0.09, h: 0.09 },
      { id: "window1", type: "window", x: 0.52, y: 0.34, w: 0.07, h: 0.07 },
      { id: "shelf1", type: "shelf", x: 0.18, y: 0.33, w: 0.07, h: 0.06 },
      { id: "shelf2", type: "shelf", x: 0.86, y: 0.33, w: 0.07, h: 0.06 },
      { id: "desk1", type: "desk", x: 0.77, y: 0.44, w: 0.07, h: 0.06 },
      { id: "corner1", type: "corner", x: 0.84, y: 0.86, w: 0.06, h: 0.10 },
      { id: "floor1", type: "floor", x: 0.50, y: 0.66, w: 0.18, h: 0.09 },
      { id: "large1", type: "large", x: 0.81, y: 0.70, w: 0.12, h: 0.13 },
      { id: "replicator", type: "replicator", x: 0.16, y: 0.84, w: 0.06, h: 0.09 },
    ],
  },
  cmdr: {
    rank: 3, name: "Commander's suite", blurb: "A sitting room, a sleeping alcove, and a long viewport. You could host the senior staff.",
    plate: null, mask: null,
    floor: [R(0.06, 0.36, 0.94, 0.94)], blocks: [R(0.06, 0.36, 0.26, 0.58), R(0.70, 0.36, 0.94, 0.46), R(0.80, 0.58, 0.94, 0.76), R(0.06, 0.70, 0.16, 0.86)],
    lift: { x: 0.50, y: 0.87, mx: 0.50, my: 0.94 },
    bed: { x: 0.16, y: 0.63, mx: 0.16, my: 0.48, lie: [0.16, 0.47], lieRot: -Math.PI / 2, lieLen: 160 },
    rest: 10, window: R(0.32, 0.07, 0.68, 0.25),
    beds: [R(0.07, 0.38, 0.25, 0.56)],
    slots: [
      { id: "wall1", type: "wall", x: 0.22, y: 0.26, w: 0.08, h: 0.09 },
      { id: "wall2", type: "wall", x: 0.78, y: 0.26, w: 0.08, h: 0.09 },
      { id: "wall3", type: "wall", x: 0.90, y: 0.26, w: 0.07, h: 0.09 },
      { id: "window1", type: "window", x: 0.42, y: 0.33, w: 0.07, h: 0.07 },
      { id: "shelf1", type: "shelf", x: 0.10, y: 0.32, w: 0.06, h: 0.06 },
      { id: "shelf2", type: "shelf", x: 0.60, y: 0.32, w: 0.06, h: 0.06 },
      { id: "shelf3", type: "shelf", x: 0.67, y: 0.32, w: 0.06, h: 0.06 },
      { id: "desk1", type: "desk", x: 0.82, y: 0.42, w: 0.07, h: 0.06 },
      { id: "corner1", type: "corner", x: 0.90, y: 0.88, w: 0.06, h: 0.10 },
      { id: "corner2", type: "corner", x: 0.30, y: 0.44, w: 0.06, h: 0.10 },
      { id: "floor1", type: "floor", x: 0.46, y: 0.62, w: 0.18, h: 0.09 },
      { id: "floor2", type: "floor", x: 0.66, y: 0.80, w: 0.16, h: 0.08 },
      { id: "large1", type: "large", x: 0.87, y: 0.68, w: 0.12, h: 0.13 },
      { id: "large2", type: "large", x: 0.62, y: 0.52, w: 0.12, h: 0.12 },
      { id: "window2", type: "window", x: 0.50, y: 0.33, w: 0.07, h: 0.07 },
      { id: "replicator", type: "replicator", x: 0.11, y: 0.78, w: 0.06, h: 0.09 },
    ],
  },
};
export const CABIN_ORDER = ["ltjg", "lt", "ltcmdr", "cmdr"];
export const SLOT_NAMES = { wall: "Wall", shelf: "Shelf", desk: "Desk", corner: "Corner", floor: "Floor", window: "Viewport sill", large: "Large floor space", replicator: "Replicator" };

// DECOR_ITEMS: cost in the generic wallet ({ rations: n } or { rep: n }); gate = { rank: index } | { fr: n } | { drop: source };
// bonus = { comfort (rest-rate multiplier share), social (positive-opinion gain share), readiness (flat points) }.
// Totals are capped in PROG.cabin.caps. sprite = the art key the artist will deliver (decor-<id>.webp); icon = placeholder.
export const DECOR_ITEMS = [
  { id: "diploma", name: "Academy diploma", slot: "wall", cost: { rations: 40 }, gate: null, icon: "📜", bonus: { comfort: 0.02 } },
  { id: "plant", name: "Potted Bajoran lily", slot: "corner", cost: { rations: 60 }, gate: null, icon: "🪴", bonus: { comfort: 0.04 } },
  { id: "lamp", name: "Desk lamp", slot: "desk", cost: { rations: 80 }, gate: null, icon: "💡", bonus: { comfort: 0.04 } },
  { id: "holophoto", name: "Holo-photo frame", slot: "shelf", cost: { rations: 120 }, gate: null, icon: "🖼️", bonus: { comfort: 0.03, social: 0.01 } },
  { id: "rug", name: "Woven rug", slot: "floor", cost: { rations: 150 }, gate: null, icon: "🟫", bonus: { comfort: 0.06 } },
  { id: "painting", name: "Painting: Risa at dusk", slot: "wall", cost: { rations: 220 }, gate: null, icon: "🌅", bonus: { comfort: 0.03, social: 0.01 } },
  { id: "shipmodel", name: "Model of the Tenacity", slot: "shelf", cost: { rations: 300 }, gate: null, icon: "🚀", bonus: { readiness: 1 } },
  { id: "chess", name: "3-D chess set", slot: "desk", cost: { rations: 350 }, gate: null, icon: "♟️", bonus: { social: 0.02 } },
  { id: "batleth", name: "Klingon bat'leth", slot: "wall", cost: { rations: 450 }, gate: { fr: 15 }, icon: "⚔️", bonus: { readiness: 1 } },
  { id: "replicator", name: "Replicator upgrade (gourmet patterns)", slot: "replicator", cost: { rations: 500 }, gate: { rank: 1 }, icon: "🍲", bonus: { comfort: 0.08 } },
  { id: "vulcanlamp", name: "Vulcan meditation lamp", slot: "desk", cost: { rations: 260 }, gate: { rank: 1 }, icon: "🕯️", bonus: { comfort: 0.06 } },
  { id: "andorian", name: "Andorian ice sculpture", slot: "shelf", cost: { rations: 650 }, gate: { fr: 25 }, icon: "🧊", bonus: { social: 0.02 } },
  { id: "targ", name: "Targ-hide rug", slot: "floor", cost: { rations: 600 }, gate: { fr: 30 }, icon: "🐗", bonus: { comfort: 0.05, social: 0.01 } },
  { id: "telescope", name: "Antique brass telescope", slot: "window", cost: { rations: 700 }, gate: { rank: 2 }, icon: "🔭", bonus: { comfort: 0.04, readiness: 1 } },
  { id: "brandy", name: "Saurian brandy cabinet", slot: "corner", cost: { rations: 800 }, gate: { rank: 2 }, icon: "🍷", bonus: { social: 0.03 } },
  { id: "fishtank", name: "Fish tank", slot: "large", cost: { rations: 900 }, gate: { rank: 2 }, icon: "🐠", bonus: { comfort: 0.10 } },
  { id: "bonsai", name: "Century-old Vulcan bonsai", slot: "corner", cost: { rations: 1200 }, gate: { fr: 20 }, icon: "🌳", bonus: { comfort: 0.05 } },
  { id: "dabo", name: "Dabo wheel (retired from Quark's)", slot: "large", cost: { rations: 1500 }, gate: { fr: 40 }, icon: "🎡", bonus: { social: 0.03 } },
  { id: "holowindow", name: "Holo-window: Earth sunrise", slot: "window", cost: { rations: 450 }, gate: { rank: 2 }, icon: "🌄", bonus: { comfort: 0.04 } },
  { id: "naiskos", name: "Kurlan naiskos", slot: "shelf", cost: { rations: 3000 }, gate: { fr: 60 }, icon: "🏺", bonus: { social: 0.03, readiness: 1 } },
  { id: "shipbottle", name: "Enterprise-D in a bottle", slot: "shelf", cost: { rations: 1800 }, gate: { rank: 3 }, icon: "🍾", bonus: { comfort: 0.03 } },
  { id: "jukebox", name: "Vintage Earth jukebox", slot: "large", cost: { rations: 2000 }, gate: { fr: 45 }, icon: "🎵", bonus: { social: 0.03 } },
  { id: "holoLib", name: "Personal holo-novel library", slot: "desk", cost: { rations: 2400 }, gate: { fr: 50 }, icon: "📚", bonus: { comfort: 0.05 } },
  // prestige pieces paid in reputation (a real rep sink; spending rep never lowers the board record)
  { id: "portrait", name: "Commissioned portrait of the senior staff", slot: "wall", cost: { rep: 1500 }, gate: { rank: 2 }, icon: "🎨", bonus: { social: 0.03 } },
  { id: "galaxymodel", name: "Galaxy-class display model, 1:350", slot: "shelf", cost: { rep: 2500 }, gate: { fr: 35 }, icon: "🛸", bonus: { readiness: 1 } },
  // phase 5 follow-up: late-game rep prestige (rank + Fleet Rep gates), placeholder emoji until the artist delivers
  { id: "idic", name: "Vulcan IDIC pendant in a display case", slot: "shelf", cost: { rep: 1200 }, gate: { fr: 45 }, icon: "🔺", bonus: { comfort: 0.02, social: 0.02 } },
  { id: "phaser1", name: "Type-1 hand phaser, Kirk's era (deactivated)", slot: "desk", cost: { rep: 1800 }, gate: { rank: 2, fr: 45 }, icon: "📟", bonus: { readiness: 1 } },
  { id: "dressuniform", name: "Framed admiral's dress uniform, a gift from the fleet", slot: "wall", cost: { rep: 2200 }, gate: { rank: 3, fr: 50 }, icon: "🎖️", bonus: { social: 0.03 } },
  { id: "batlethorder", name: "Order of the Bat'leth (honorary, from Qo'noS)", slot: "wall", cost: { rep: 3000 }, gate: { rank: 3, fr: 60 }, icon: "🏵️", bonus: { readiness: 1, social: 0.02 } },
  { id: "captainchair", name: "Captain's chair replica", slot: "large", cost: { rep: 4000 }, gate: { rank: 3 }, icon: "🪑", bonus: { comfort: 0.05, readiness: 1 } },
  // drop only: found, not bought (favours now; away missions in a later phase)
  { id: "yardplaque", name: "Utopia Planitia yard plaque", slot: "wall", cost: null, gate: { drop: "favour:shipment" }, icon: "🏅", bonus: { readiness: 1 } },
  { id: "flute", name: "Ressikan flute", slot: "shelf", cost: null, gate: { drop: "away:kataan" }, icon: "🪈", bonus: { comfort: 0.04, social: 0.02 } },
  { id: "tribble", name: "Tribble (sterile, honest)", slot: "corner", cost: null, gate: { drop: "away:k7" }, icon: "🟤", bonus: { social: 0.02 } },
];
export const DECOR = Object.fromEntries(DECOR_ITEMS.map(d => [d.id, d]));
