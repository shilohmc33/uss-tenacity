// Battle groundwork: the SHIP DEFINITIONS table and the combatant model.
// A battle (G.sp.battle, saved) holds combatant arrays by side: battle.allies[] and battle.enemies[]. Battles are still
// ONE-ON-ONE (the Tenacity vs one enemy); the multi-ship hooks at the bottom (targeting, HUD rows, formation slots) are
// stubbed and unused. Pure data + helpers: no imports, so state.js can harden saved battles at load.
//
// SHIPS[id]: name / short / a (with article) / cls (class line) / faction (FACTIONS key) / side (default side) /
//   hull (max hull points; enemy hull is shown as a %) / shields (max %; enemies 0 = no separate shield bar, every hit lands
//   on the hull % exactly as the pre-groundwork enemy did - a future shielded enemy sets it and battle.js learns to drain it) / speed (1 = baseline: entry time,
//   evasive jinking) / sprite (SHIP_ART key in data.js) / aspect (the drawn box's length : height) / size (drawn length
//   relative to the Miranda) / death (the kill line) /
//   weapons[]: { id, name, kind: beam|torpedo, dmg: [min, max], ... } - ally guns: cd (s), power, ammo; enemy guns:
//   every: [min, max] s between volleys, first (s to the first volley) / parting: [min, max] (the volley that chases a
//   disengage) / salvage (parts on a win) / rep (reputation on a win, on top of the convoy's) / evade (chance each of
//   the Tenacity's shots misses: a fast ship jinks clear) / (spawn odds and gates: js/encounters.js, PACE.encounter) /
//   hp: hardpoints as fractions of the ship's box, drawn FACING RIGHT (enemies are mirrored): fire (gun muzzle), torp,
//   hit (where incoming fire lands), boom (explosion centre).
// The Galor carries the pre-groundwork enemy's numbers exactly (hull 100, 10-18 every 3.0-3.8 s, first at 2.0 s,
// parting 8-14, salvage 3): that is the BASELINE. The fighter is fast and fragile; the battlecruiser tough and rare.
export const FACTIONS = {
  starfleet: { name: "Starfleet", hull: "#c8d2df", shade: "#8996a8", trim: "#4f86d4", glow: "#9fdcff", label: "#cfe6ff" },
  civilian: { name: "Federation civilian", hull: "#b8b09e", shade: "#7f7868", trim: "#d29a3a", glow: "#ffd9a0", label: "#f2ddb0" },
  klingon: { name: "Klingon Empire", hull: "#7f8c68", shade: "#535e43", trim: "#a33a28", glow: "#ff7048", label: "#ffbba3" },
  dominion: { name: "Dominion", hull: "#8670b0", shade: "#56457e", trim: "#c3a6ff", glow: "#d0a8ff", label: "#dccbff" },
  cardassian: { name: "Cardassian Union", hull: "#b3a473", shade: "#7a6f4a", trim: "#d98c3a", glow: "#ffd070", label: "#f3e0a6" },
};
export const SHIPS = {
  // ---- allies ----
  tenacity: { name: "USS Tenacity", short: "Tenacity", a: "the Tenacity", cls: "Miranda class", faction: "starfleet", side: "ally", hull: 100, shields: 100, speed: 1, sprite: "tenacity", aspect: 3.5, size: 1, bigBoom: true,
    weapons: [{ id: "phaser", name: "phaser strike from the saucer banks", kind: "beam", dmg: [10, 16], cd: 2.5, cdImpaired: 5, power: 8, col: "255,150,60" },
      { id: "torpedo", name: "Photon torpedo", kind: "torpedo", dmg: [22, 30], cd: 4, ammo: "torps" }],
    hp: { fire: [0.9, 0.45], torp: [0.42, 0.18], hit: [0.6, 0.45], miss: [0.1, 0.2], boom: [0.6, 0.45] } },
  freighter: { name: "SS Kerala", short: "Kerala", a: "the convoy freighter", cls: "Convoy freighter", faction: "civilian", side: "ally", hull: 70, shields: 40, speed: 0.6, sprite: "freighter", aspect: 3.2, size: 0.9,
    weapons: [], hp: { fire: [0.8, 0.5], torp: [0.5, 0.3], hit: [0.5, 0.5], miss: [0.1, 0.2], boom: [0.5, 0.5] } },
  klingon_bop: { name: "IKS Ch'Tang", short: "Ch'Tang", a: "the Bird-of-Prey", cls: "Klingon Bird-of-Prey", faction: "klingon", side: "ally", hull: 80, shields: 70, speed: 1.4, sprite: "klingon_bop", aspect: 2.0, size: 0.6,
    weapons: [{ id: "disruptor", name: "Disruptor cannons", kind: "beam", dmg: [9, 14], cd: 2.8, power: 0, col: "120,255,90" }],
    hp: { fire: [0.96, 0.64], torp: [0.6, 0.5], hit: [0.5, 0.5], miss: [0.1, 0.2], boom: [0.5, 0.5] } },   // batch2 polish: nose emitter
  // ---- enemies ----
  jh_fighter: { name: "Jem'Hadar fighter", short: "fighter", a: "a Jem'Hadar fighter", cls: "Jem'Hadar attack ship", faction: "dominion", side: "enemy", hull: 60, shields: 0, speed: 1.6, evade: 0.15, sprite: "jh_fighter", aspect: 2.1, size: 0.44,
    weapons: [{ id: "polaron", name: "Polaron volley", kind: "beam", dmg: [7, 12], every: [2.1, 2.7], first: 1.3, col: "190,140,255", hits: "a polaron hit" }],
    parting: [6, 10], salvage: 2, death: "The Jem'Hadar fighter breaks apart — secondary explosions walking her spine. She's gone.",
    hp: { fire: [0.92, 0.55], hit: [0.55, 0.5], boom: [0.5, 0.5] } },
  galor: { name: "Cardassian Galor", short: "Galor", a: "a Cardassian Galor", cls: "Galor-class warship", faction: "cardassian", side: "enemy", hull: 100, shields: 0, speed: 1, sprite: "galor", aspect: 2.6, size: 0.68,
    weapons: [{ id: "disruptor", name: "Spiral-wave disruptor volley", kind: "beam", dmg: [10, 18], every: [3.0, 3.8], first: 2.0, col: "255,190,80", hits: "a disruptor hit" }],
    parting: [8, 14], salvage: 3, death: "The Galor's spine buckles — her reactor goes, and the wreck tumbles away dark. She's gone.",
    hp: { fire: [0.97, 0.8], hit: [0.55, 0.5], boom: [0.5, 0.5] } },   // batch2 polish: nose emitter
  jh_battlecruiser: { name: "Jem'Hadar battlecruiser", short: "battlecruiser", a: "a Jem'Hadar battlecruiser", cls: "Dominion capital ship",   // pass 12 m7: was the name again (label read 'Jem'Hadar battlecruiser / Jem'Hadar battlecruiser')
    faction: "dominion", side: "enemy", hull: 170, shields: 0, speed: 0.7, sprite: "jh_battlecruiser", bigBoom: true, aspect: 2.3, size: 0.9,
    weapons: [{ id: "polaron", name: "Heavy polaron barrage", kind: "beam", dmg: [12, 20], every: [3.4, 4.2], first: 2.4, pierce: 0.5, col: "200,120,255", hits: "a heavy polaron hit" }],   // pass 13 tuning (gated start, battle-sim): hull 150 -> 170, pierce 0.5 = half of each absorbed hit bleeds to the hull
    parting: [10, 16], salvage: 5, rep: 1, death: "The battlecruiser's shields fail all at once; a chain of detonations tears her open from the bow back. She's gone.",   // rare and gated: js/encounters.js + PACE.encounter
    hp: { fire: [0.95, 0.52], hit: [0.5, 0.5], boom: [0.5, 0.5] } },
};
export const BASELINE_ENEMY = "galor";
export const ENEMY_IDS = Object.keys(SHIPS).filter(k => SHIPS[k].side === "enemy");
export const ALLY_IDS = Object.keys(SHIPS).filter(k => SHIPS[k].side === "ally");
// battle contexts that fix the enemy (the story already named it): the defector trap is a Galor, the shadow a fighter;
// debug drills fight the baseline unless a test asks for a type
export const CTX_ENEMY = { defector: "galor", shadow: "jh_fighter", debug: BASELINE_ENEMY };
// combatants. Allies: the Tenacity's live hull/shields stay on G.ship (ref: "ship"); other allies would carry their own.
// Enemies carry hull / max (points) and their volley clock.
// multi-ship P1: every gun has a first-volley delay and a gap. Enemy guns carry every: [lo, hi]; ally guns (Tenacity table style)
// carry cd only (P23: ally weapons had no 'every' - battle.js read it blind). gunFirst / gunGap cover both.
export const gunFirst = g => g ? (g.first ?? (g.cd ? g.cd * 0.6 : 2)) : 99;
export const gunGap = (g, rnd = Math.random) => !g ? 99 : g.every ? g.every[0] + rnd() * (g.every[1] - g.every[0]) : g.cd ? g.cd * (0.9 + rnd() * 0.25) : 99;
export function makeAlly(ship, slot = 0) { const d = SHIPS[ship]; return ship === "tenacity" ? { id: "tenacity", ship, side: "ally", slot, ref: "ship" } : { id: ship + "-" + slot, ship, side: "ally", slot, hull: d.hull, max: d.hull, shields: d.shields, volleyT: gunFirst(d.weapons[0]) }; }
export function makeEnemy(ship, slot = 0) { const d = SHIPS[ship]; return { id: ship + "-" + slot, ship, side: "enemy", slot, hull: d.hull, max: d.hull, volleyT: gunFirst(d.weapons[0]) }; }
export const shipOf = c => SHIPS[c && c.ship] || SHIPS[BASELINE_ENEMY];
export const gunOf = c => shipOf(c).weapons[0] || null;
// the enemy the Tenacity is fighting: the selected target while it lives, else the first live enemy; once every enemy is dead
// (the victory countdown) the last target, so the victory / record code still reads the ship that went down
export function foe(B) { if (!B || !Array.isArray(B.enemies) || !B.enemies.length) return null; const t = B.enemies[B.target | 0]; if (t && !t.dead) return t; return B.enemies.find(e => !e.dead) || t || B.enemies[0]; }
export const liveOf = list => (list || []).filter(c => c && !c.dead);
export const hullPct = c => c ? Math.max(0, Math.round(c.hull / (c.max || 1) * 100)) : 0;
// ---- save: v14 migration (pre-groundwork battle -> combatants) + hardening for any loaded battle ----
// a v13 battle kept the single enemy's hull / max / volley clock on the battle itself; it becomes a Galor (the baseline
// type: identical numbers, so the fight in progress plays on unchanged)
export function migrateBattle14(sp) {
  const B = sp && sp.battle; if (!B || typeof B !== "object" || Array.isArray(B)) return;
  if (!Array.isArray(B.enemies)) {
    const e = makeEnemy(BASELINE_ENEMY, 0); e.hull = B.hull; e.max = B.max || 100; if (typeof B.volleyT === "number") e.volleyT = B.volleyT;
    if (typeof B.lastVolleyAt === "number") e.lastVolleyAt = B.lastVolleyAt; if (typeof B.volleyGap === "number") e.volleyGap = B.volleyGap;
    B.enemies = [e];
  }
  if (!Array.isArray(B.allies)) B.allies = [makeAlly("tenacity", 0)];
  for (const k of ["hull", "max", "volleyT", "lastVolleyAt", "volleyGap"]) delete B[k];
  if (typeof B.target !== "number") B.target = 0;
}
const fin = (v, d, lo = -Infinity, hi = Infinity) => typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
// returns false when the battle is beyond repair (the caller drops it: the ship simply isn't at red alert any more)
export function hardenBattle(sp) {
  const B = sp && sp.battle; if (!B) return true;
  if (typeof B !== "object" || Array.isArray(B)) { sp.battle = null; return false; }
  migrateBattle14(sp);
  B.enemies = B.enemies.filter(e => e && typeof e === "object" && !Array.isArray(e));
  for (const e of B.enemies) {
    if (!SHIPS[e.ship] || SHIPS[e.ship].side !== "enemy") e.ship = BASELINE_ENEMY;
    const d = SHIPS[e.ship]; e.max = e.max >= 1 ? fin(e.max, d.hull, 1, 1000) : d.hull; e.hull = fin(e.hull, e.max, 0, e.max); e.volleyT = fin(e.volleyT, (gunOf(e) || { first: 2 }).first, 0, 60);
    if (typeof e.id !== "string") e.id = e.ship + "-0"; e.side = "enemy"; e.slot = fin(e.slot, 0, 0, SLOTS - 1) | 0;
    e.wing = e.wing === true && e.slot > 0; e.dead = e.dead === true || e.hull <= 0; e.dying = e.dead ? fin(e.dying, 0, 0, 30) : 0;
  }
  if (!B.enemies.length) { sp.battle = null; return false; }
  B.allies = B.allies.filter(a => a && typeof a === "object" && SHIPS[a.ship] && SHIPS[a.ship].side === "ally");
  if (!B.allies.some(a => a.ship === "tenacity")) B.allies.unshift(makeAlly("tenacity", 0));
  for (const a of B.allies) { if (a.ship === "tenacity") { a.id = "tenacity"; a.ref = "ship"; a.slot = 0; delete a.dead; continue; }
    const d = SHIPS[a.ship]; a.max = fin(a.max, d.hull, 1, 1000); a.hull = fin(a.hull, a.max, 0, a.max); a.shields = fin(a.shields, d.shields, 0, 1000);
    a.volleyT = fin(a.volleyT, gunFirst(d.weapons[0]), 0, 99); if (typeof a.id !== "string") a.id = a.ship + "-" + (a.slot | 0); a.side = "ally"; a.slot = fin(a.slot, 1, 1, SLOTS - 1) | 0;
    a.dead = a.dead === true || a.hull <= 0; a.dying = a.dead ? fin(a.dying, 0, 0, 30) : 0; }
  if (B.enemies.every(e => e.dead) && !(B.dying > 0)) B.dying = 0.1;   // every enemy already down: the victory fires next tick
  B.target = fin(B.target, 0, 0, B.enemies.length - 1) | 0;
  B.live = B.live === true;   // pass 16 B1 (v14-compatible additive field): pre-fix saves mid-fight keep the old (away) rules
  if (!B.cd || typeof B.cd !== "object" || Array.isArray(B.cd)) B.cd = {};
  for (const k of ["phaser", "torp", "evasive", "divert"]) B.cd[k] = fin(B.cd[k], 0, 0, 60);
  B.allyDying = fin(B.allyDying, 0, 0, SLOTS) | 0;
  for (const k of ["enterT", "dying", "inflight", "injN"]) if (B[k] !== undefined) B[k] = fin(B[k], 0, 0, k === "inflight" ? 1000 : 100);
  return true;
}

// ---- multi-ship hooks (P1: combatants fight; formation, target selection, HUD rows) ----
// Formation slots. Slot 0 on each side is the one-on-one position (render/space.js computes it per orientation, unchanged
// from the pre-groundwork layout); slots 1-2 are wingmen: box centre (cx, cy) as fractions of the space view and s = scale
// vs the one-on-one size. portrait / landscape tables: upright, allies hold the lower half and enemies the upper; sideways,
// allies the left and enemies the right.
export const FORMATION = {
  portrait: { ally: [null, { cx: 0.27, cy: 0.47, s: 0.5 }, { cx: 0.76, cy: 0.47, s: 0.5 }], enemy: [null, { cx: 0.22, cy: 0.21, s: 0.5 }, { cx: 0.72, cy: 0.13, s: 0.45 }] },   // P2: below the red-alert banner, clear of the lead
  landscape: { ally: [null, { cx: 0.15, cy: 0.2, s: 0.46 }, { cx: 0.38, cy: 0.22, s: 0.4 }], enemy: [null, { cx: 0.84, cy: 0.66, s: 0.5 }, { cx: 0.6, cy: 0.12, s: 0.36 }] },
};
export const SLOTS = 3;   // per side
// target selection (stub): one-on-one always targets enemies[0]; a future UI calls this when the player taps a ship
export function selectTarget(B, id) { if (!B || !Array.isArray(B.enemies)) return false; const i = B.enemies.findIndex(e => e.id === id && !(e.hull <= 0)); if (i < 0) return false; B.target = i; return true; }
export const targetOf = B => foe(B);
// per-combatant HUD rows (stub): what a multi-ship HUD would list, one row per combatant; hud.js renders them into a
// hidden #combatantRows list today (the visible HUD is still the single enemy bar)
export function combatantRows(B, ship) {
  if (!B) return [];
  const row = (c, i, side) => { const d = shipOf(c), self = c.ref === "ship";
    return { id: c.id, side, name: d.name, cls: d.cls, faction: d.faction, pct: self ? Math.round(ship ? ship.hull : 100) : hullPct(c), shields: self && ship ? Math.round(ship.shields) : c.shields ?? null, targeted: side === "enemy" && i === (B.target | 0), slot: c.slot | 0 }; };
  return [...(B.allies || []).map((c, i) => row(c, i, "ally")), ...(B.enemies || []).map((c, i) => row(c, i, "enemy"))];
}
// formation preview (tests / artist review only): fills the side arrays with extra ships in slots 1-2. Since multi-ship P1
// they fight like any combatant (battle.js startBattle opts.enemies / opts.allies is the real route).
export function previewFormation(B, allies, enemies) {
  if (!B) return;
  B.allies = allies.map((s, i) => makeAlly(s, i)); B.enemies = enemies.map((s, i) => makeEnemy(s, i)); B.target = 0; B.preview = true;
}
