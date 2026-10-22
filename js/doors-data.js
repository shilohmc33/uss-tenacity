// Sliding doors per deck (reusable). DECK_DOORS[deck] = [{ id, img: { left, right } asset keys, panels, clip, trigger, timing }].
// All coordinates in design px (960x640, data.js DW x DH), the same space as every other deck coordinate; panel art is the
// 1920 cut (2 art px per design px, like the plates) drawn at its rect. A closed door (open = 0) reproduces the v4 plate
// pixel-for-pixel; the plate itself (v4b) has the lift interiors painted behind the doorways.
// Source: assets/src/deck_bridge_v4b/doors_bridge.json (artist's sprites/deck_bridge_v4b/out): rect_960, slide_vec_design,
// clip_poly_design, trigger center_design / radius_design, timing.
const T = { open: 0.35, close: 0.45, delay: 0.6 };   // seconds; ease: easeInOutCubic
export const DECK_DOORS = {
  bridge: [
    { id: "turbolift", name: "lift_port", clip: [[159, 52], [231, 35], [244, 138], [174, 155]], trigger: { c: [202, 176], r: 70 }, timing: T,
      panels: [
        { img: "door-bridge-turbolift-left", rect: [160, 43, 210, 155], slide: [-36.8, 8.7] },
        { img: "door-bridge-turbolift-right", rect: [196, 35, 244, 147], slide: [35.2, -8.3] }] },
    { id: "turbolift_2", name: "lift_stbd", clip: [[720, 38], [797, 55], [781, 150], [711, 130]], trigger: { c: [754, 168], r: 70 }, timing: T,
      panels: [
        { img: "door-bridge-turbolift-2-left", rect: [711, 38, 762, 141], slide: [-42.3, -9.3] },
        { img: "door-bridge-turbolift-2-right", rect: [749, 47, 796, 150], slide: [34.7, 7.7] }] },
  ],
};
export const DOOR_IMAGES = Object.values(DECK_DOORS).flatMap(L => L.flatMap(d => d.panels.map(p => p.img)));
