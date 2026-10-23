// Phase 4: the Lt's Quarters. Tier follows rank (promotion moves him and his decor), decor catalogue with gates,
// comfort-scaled rest on his own rack, decor bonuses (capped), trade-in of spares for rations, decor drops.
import { G } from "./state.js";
import { log, toast, fx } from "./bus.js";
import { moodlet } from "./mood.js";
import { needsOf } from "./needs.js";
import { PROG, hooks, spend, canAfford, costText, cabinFx, earnRations, addr, crewList, nudge } from "./progression.js";
import { DECKS, DW, DH } from "./data.js";
import { rectGrid, sampleMask, snapToFloor } from "./path.js";
import { IMG } from "./assets.js";
import { nightActive } from "./pacing.js";
import { CABIN_TIERS, CABIN_ORDER, DECOR_ITEMS, DECOR, SLOT_NAMES } from "./cabin-data.js";

const P = () => G.prog, C = () => G.prog.cabin;
export const tierIdFor = rank => CABIN_ORDER[Math.max(0, Math.min(CABIN_ORDER.length - 1, rank | 0))];
export const tier = () => CABIN_TIERS[C().tier] || CABIN_TIERS.ltjg;
export const slots = () => tier().slots.filter(s => !s.hidden);   // hidden = no decor art for that slot yet (cabin_v4)
export const slotById = id => slots().find(s => s.id === id);
const RANK_SHORT = ["Lt jg", "Lt", "Lt Cmdr", "Cmdr"];

// ---------------- bonuses ----------------
export function totals() {
  const K = PROG.cabin.caps, t = { comfort: 0, social: 0, readiness: 0 };
  for (const id of Object.values(C().placed)) { const d = DECOR[id]; if (!d) continue; for (const k of Object.keys(t)) t[k] += (d.bonus && d.bonus[k]) || 0; }
  return { comfort: Math.min(K.comfort, t.comfort), social: Math.min(K.social, t.social), readiness: Math.min(K.readiness, t.readiness), raw: t };
}
export const rackRest = () => (PROG.cabin.rest[C().tier] ?? tier().rest) * (1 + totals().comfort);
cabinFx.social = () => totals().social;
cabinFx.readiness = () => totals().readiness;
// "Refreshed": slept to 95%+ on his own rack -> slower energy drain for a while (crew.js stepLt)
export const drainMult = () => (C().refreshedUntil || 0) > G.ship.elapsed ? PROG.cabin.refreshed.drain : 1;

// ---------------- tier: plate, walk grid, lift, rack ----------------
export function applyTier() {
  const T = tier(), dk = DECKS.quarters, id = C().tier;
  dk.plate = T.plate && IMG[T.plate] ? T.plate : placeholderPlate(id);
  dk.lift = { ...T.lift }; dk.base = T.floor; dk.blocks = T.blocks;
  if (T.mask && IMG[T.mask]) { dk.walk = sampleMask(IMG[T.mask]); dk.walkSrc = "mask"; } else { dk.walk = rectGrid(T.floor, T.blocks); dk.walkSrc = "rects"; }
  const rack = dk.nodes.rack;
  Object.assign(rack, T.bed); rack.rest = rackRest();
  if (dk.nodes.desk && T.desk) Object.assign(dk.nodes.desk, T.desk);
  reseatDecor();
  rack.name = id === "ltjg" ? "Your Rack (shared room)" : id === "cmdr" ? "Sleeping Alcove" : "Your Rack";
  dk.name = `Lt's Quarters`; dk._tier = id;
  if (G.lt && G.lt.deck === "quarters" && !G.lt.lift && G.lt.mode !== "use") snapToFloor(G.lt);
}
// art batch 2: slot ids/types changed with cabin_v4 and some slots are hidden. Anything placed in a slot that no longer
// takes it moves to a free matching slot, or into storage (still owned; placeable again later).
function reseatDecor() {
  const c = C(); if (!c || !c.placed) return;
  const vis = slots(), placed = {};
  const ok = (sid, d) => vis.some(s => s.id === sid && s.type === d.slot);
  for (const [sid, id] of Object.entries(c.placed)) { const d = DECOR[id]; if (d && ok(sid, d) && !placed[sid]) placed[sid] = id; }
  for (const [sid, id] of Object.entries(c.placed)) {
    const d = DECOR[id]; if (!d || placed[sid] === id) continue;
    const free = vis.find(s => s.type === d.slot && !placed[s.id]); if (free) placed[free.id] = id;
  }
  c.placed = placed;
}
export const refreshRest = () => { DECKS.quarters.nodes.rack.rest = rackRest(); };

// placeholder plate: a simple drawn room per tier, used only if the cabin_v4 plate fails to load
export function placeholderPlate(id) {
  const key = "cabin-ph-" + id;
  if (IMG[key]) return key;
  if (typeof document === "undefined") return key;
  const T = CABIN_TIERS[id], c = document.createElement("canvas"); c.width = DW; c.height = DH;
  const x = c.getContext("2d"), fl = T.floor[0];
  const X = f => f * DW, Y = f => f * DH;
  x.fillStyle = "#070a12"; x.fillRect(0, 0, DW, DH);
  const wallTop = 0.04, fy0 = Math.min(...T.floor.map(r => r[1]));
  // back wall
  const wg = x.createLinearGradient(0, Y(wallTop), 0, Y(fy0)); wg.addColorStop(0, "#1c2335"); wg.addColorStop(1, "#2c3550");
  x.fillStyle = wg; x.fillRect(X(fl[0]), Y(wallTop), X(fl[2] - fl[0]), Y(fy0 - wallTop));
  x.strokeStyle = "rgba(150,170,210,0.18)"; x.lineWidth = 2;
  for (let px = fl[0] + 0.06; px < fl[2]; px += 0.12) { x.beginPath(); x.moveTo(X(px), Y(wallTop + 0.02)); x.lineTo(X(px), Y(fy0 - 0.01)); x.stroke(); }
  x.fillStyle = "#e7a33e"; x.fillRect(X(fl[0]), Y(fy0) - 10, X(fl[2] - fl[0]), 4);              // LCARS trim strip
  x.fillStyle = "#9b7fd0"; x.fillRect(X(fl[0]), Y(wallTop), X(0.08), 8);
  // viewport
  if (T.window) {
    const [a, b, cc, d] = T.window;
    x.fillStyle = "#02040a"; x.fillRect(X(a), Y(b), X(cc - a), Y(d - b));
    for (let i = 0; i < 70; i++) { const sx = X(a) + ((i * 97) % 1000) / 1000 * X(cc - a), sy = Y(b) + ((i * 61) % 1000) / 1000 * Y(d - b); x.fillStyle = `rgba(220,230,255,${0.3 + (i % 5) / 7})`; x.fillRect(sx, sy, 6 + (i % 4) * 4, 1.5); }
    x.strokeStyle = "#8a93a8"; x.lineWidth = 6; x.strokeRect(X(a), Y(b), X(cc - a), Y(d - b));
  }
  // floor (carpet)
  for (const r of T.floor) { x.fillStyle = "#5b4b45"; x.fillRect(X(r[0]), Y(r[1]), X(r[2] - r[0]), Y(r[3] - r[1])); }
  x.strokeStyle = "rgba(0,0,0,0.12)"; x.lineWidth = 1;
  for (let gx = fl[0]; gx < fl[2]; gx += 0.04) { x.beginPath(); x.moveTo(X(gx), Y(fy0)); x.lineTo(X(gx), Y(fl[3])); x.stroke(); }
  for (let gy = fy0; gy < fl[3]; gy += 0.05) { x.beginPath(); x.moveTo(X(fl[0]), Y(gy)); x.lineTo(X(fl[2]), Y(gy)); x.stroke(); }
  // side walls
  x.fillStyle = "#151b2a"; x.fillRect(X(fl[0]) - 18, Y(wallTop), 18, Y(fl[3] - wallTop)); x.fillRect(X(fl[2]), Y(wallTop), 18, Y(fl[3] - wallTop));
  // furniture blocks (beds drawn as racks)
  for (const r of T.blocks) { x.fillStyle = "#33384a"; x.fillRect(X(r[0]), Y(r[1]), X(r[2] - r[0]), Y(r[3] - r[1])); x.strokeStyle = "#555d75"; x.lineWidth = 3; x.strokeRect(X(r[0]), Y(r[1]), X(r[2] - r[0]), Y(r[3] - r[1])); }
  for (const r of T.beds || []) {
    x.fillStyle = "#3c4258"; x.fillRect(X(r[0]), Y(r[1]), X(r[2] - r[0]), Y(r[3] - r[1]));
    x.fillStyle = "#2f5b8f"; x.fillRect(X(r[0]) + 8, Y(r[1]) + Y(0.07), X(r[2] - r[0]) - 16, Y(r[3] - r[1]) - Y(0.07) - 8);
    x.fillStyle = "#d9dde6"; x.fillRect(X(r[0]) + 14, Y(r[1]) + 10, X(r[2] - r[0]) - 28, Y(0.045));
  }
  // turbolift doors
  const lf = T.lift; x.fillStyle = "#1d2232"; x.fillRect(X(lf.x) - 50, Y(fl[3]) - 6, 100, 30);
  x.fillStyle = "#e7a33e"; x.fillRect(X(lf.x) - 54, Y(fl[3]) - 8, 108, 5);
  x.fillStyle = "rgba(200,210,235,0.55)"; x.font = "600 13px Antonio, sans-serif";
  x.fillText(`PLACEHOLDER ROOM · ${T.name.toUpperCase()} · artist plate cabin-${id}.webp (960×640)`, X(fl[0]) + 6, Y(wallTop) + 26);
  IMG[key] = c;
  return key;
}

// ---------------- catalogue ----------------
export const owned = id => C().owned.includes(id);
export const placedIn = id => Object.keys(C().placed).find(k => C().placed[k] === id) || null;
export function gateState(d) {
  const g = d.gate; if (!g) return { ok: true };
  if (g.rank != null && P().rank < g.rank) return { ok: false, why: `${RANK_SHORT[g.rank]} and up${g.fr != null ? ` · Fleet Reputation ${g.fr}` : ""}` };   // rank and Fleet Rep may combine
  if (g.fr != null && P().fleetRep < g.fr) return { ok: false, why: `Fleet Reputation ${g.fr}` };
  if (g.rank != null || g.fr != null) return { ok: true };
  if (g.drop) return { ok: false, drop: true, why: g.drop.startsWith("favour:") ? "found through a favour" : "found on an away mission (coming later)" };
  return { ok: true };
}
export function itemState(id) {
  const d = DECOR[id], o = owned(id), g = gateState(d);
  return { d, owned: o, placed: placedIn(id), gate: g, canBuy: !o && g.ok && !!d.cost && canAfford(d.cost) };
}
export const completion = () => C().owned.filter(id => DECOR[id]).length / DECOR_ITEMS.length;
export const storage = () => C().owned.filter(id => !placedIn(id));
export function buyItem(id, slotId = null) {
  const st = itemState(id); if (!st.canBuy) return false;
  if (!spend(st.d.cost, "decor")) return false;
  C().owned.push(id);
  log(`Quartermaster's chit signed: ${st.d.name} (−${costText(st.d.cost)}).`, "good");
  toast(`${st.d.name} — −${costText(st.d.cost)}`, "good");
  if (slotId) placeItem(id, slotId);
  return true;
}
export function placeItem(id, slotId) {
  const sl = slotById(slotId), d = DECOR[id];
  if (!sl || !d || !owned(id) || d.slot !== sl.type) return false;
  const was = placedIn(id); if (was) delete C().placed[was];
  C().placed[slotId] = id; refreshRest();
  if (G.lt.deck === "quarters") fx("floater", { x: sl.x, y: sl.y - 0.05, text: d.name.toUpperCase(), color: "#ffd9a0", life: 1.8 });
  return true;
}
export function removeItem(slotId) { if (!C().placed[slotId]) return false; delete C().placed[slotId]; refreshRest(); return true; }
export const slotsFor = type => slots().filter(s => s.type === type);
export const itemsForSlot = type => DECOR_ITEMS.filter(d => d.slot === type);

// ---------------- promotion: move quarters, remap decor ----------------
export function moveQuarters(toId = tierIdFor(P().rank)) {
  const c = C(), from = c.tier; if (from === toId) return null;
  const old = c.placed, T = CABIN_TIERS[toId], placed = {}, stored = [];
  for (const [sid, id] of Object.entries(old)) {
    const d = DECOR[id]; if (!d) continue;
    const vis = T.slots.filter(s => !s.hidden);
    const same = vis.find(s => s.id === sid && s.type === d.slot && !placed[s.id]);
    const any = same || vis.find(s => s.type === d.slot && !placed[s.id]);
    if (any) placed[any.id] = id; else stored.push(id);
  }
  c.placed = placed; c.tier = toId; c.log.push({ day: P().day, from, to: toId, stored });
  applyTier();
  log(`Quarters reassigned: the ${addr()} moves into a ${T.name.toLowerCase()}. Your things come along${stored.length ? `; ${stored.map(i => DECOR[i].name).join(", ")} went into storage (no slot for ${stored.length > 1 ? "them" : "it"} here)` : ""}.`, "good");
  toast(`New quarters — ${T.name}`, "good");
  const unlocked = DECOR_ITEMS.filter(d => d.gate && d.gate.rank === P().rank);
  if (unlocked.length) log(`New decor available at your rank: ${unlocked.map(d => d.name).join(", ")}.`, "comm");
  return { from, to: toId, stored };
}
hooks.promoted.push(() => moveQuarters());

// ---------------- drops (favours now; away missions later) ----------------
export function cabinDrop(source) {
  const d = DECOR_ITEMS.find(x => x.gate && x.gate.drop === source && !owned(x.id));
  if (!d) return null;
  C().owned.push(d.id);
  log(`A crate with your name on it comes aboard: ${d.name}. It's in storage — find it a place in your quarters.`, "good");
  toast(`Decor found — ${d.name}`, "good");
  (hooks.decorDrop || []).forEach(h => h(d, source));
  return d;
}
hooks.decorDrop = hooks.decorDrop || [];
hooks.favourUsed = hooks.favourUsed || [];
hooks.favourUsed.push(id => cabinDrop("favour:" + id));
// away missions (later phase) call cabinDrop("away:<id>")

// ---------------- repeatable sink: host a dinner in your quarters ----------------
export function dinnerState() {
  const K = PROG.cabin.dinner, p = P(), left = (C().dinnerDay ?? -99) + K.cd - p.day;
  if (p.rank < K.minRank) return { ok: false, why: "a shared bunk room is no place for dinner guests (Lt and up)" };
  if (left > 0) return { ok: false, why: `next dinner in ${left} ship's day${left > 1 ? "s" : ""}` };
  if (!canAfford(K.cost)) return { ok: false, why: `${costText(K.cost)} needed` };
  return { ok: true };
}
export function hostDinner() {
  const K = PROG.cabin.dinner; if (!dinnerState().ok || !spend(K.cost, "dinner")) return false;
  const guests = crewList().filter(c => c.id !== "tren" && !(K.noSeniors && c.senior) && !(P().med && P().med.inj.some(x => x.id === c.id))).sort((a, b) => (P().opinions[a.id] ?? 0) - (P().opinions[b.id] ?? 0)).slice(0, K.guests);
  for (const g of guests) { nudge(g.id, K.opinion, "dinner", true); moodlet(g.id, "dinner"); const r = needsOf(g.id); r.n.food = Math.min(100, r.n.food + 50); r.n.social = Math.min(100, r.n.social + 40); }   // N4: a shared meal fills Food and Social   // N2 moodlet
  C().dinnerDay = P().day; C().dinners = (C().dinners || 0) + 1;
  log(`Dinner in the ${addr()}'s quarters: ${guests.map(g => `${g.rankShort} ${g.short}`).join(", ")}. The replicator earns its keep; the conversation runs late. (−${costText(K.cost)})`, "good");
  toast(`Dinner for ${guests.length} — −${costText(K.cost)}`, "good");
  return true;
}

// ---------------- trade-in: spares -> rations (poor rate) ----------------
const tradeDay = () => { const s = P().sinks; if (!s.trade || s.trade.day !== P().day) s.trade = { day: P().day, parts: 0 }; return s.trade; };
export const tradeAutoToday = () => tradeDay().auto || 0;
export const tradeLeft = () => Math.max(0, PROG.rations.trade.perDay - tradeDay().parts);
export const tradeOk = () => canAfford({ parts: PROG.rations.trade.parts }) && tradeLeft() >= PROG.rations.trade.parts;
export function tradeParts(quiet = false) {
  const T = PROG.rations.trade; if (!tradeOk() || !spend({ parts: T.parts }, "trade")) return false;
  tradeDay().parts += T.parts; if (quiet) tradeDay().auto = (tradeDay().auto || 0) + T.parts;   // pt04 m6: the standing order shares the 120/day cap
  earnRations(T.rations, "trade");
  if (!quiet) { log(`Traded ${T.parts} spare parts to the quartermaster for ${T.rations} ${PROG.currency.unit}. He drives a hard bargain.`, "comm"); toast(`−${T.parts} parts · +${T.rations} ${PROG.currency.unit}`, "good"); }
  return true;
}

// ---------------- per step ----------------
let tradeAcc = 0;
export function tickCabin(dt) {
  const L = G.lt, S = G.ship, c = C();
  if (c.tier !== tierIdFor(P().rank)) moveQuarters();          // promotion (or a migrated save) -> right tier
  if (DECKS.quarters._tier !== c.tier) applyTier();
  // Refreshed: woke on his own rack at 95%+
  if (L.deck === "quarters" && L.mode === "use" && L.node === "rack") {
    if (S.energy >= PROG.cabin.refreshed.at && !((c.refreshedUntil || 0) > S.elapsed + 60)) {
      c.refreshedUntil = S.elapsed + PROG.cabin.refreshed.dur * (1 + totals().comfort);
      if (!c.refreshedNoted || c.refreshedNoted < S.elapsed - 600) { c.refreshedNoted = S.elapsed; fx("floater", { x: L.x, y: L.y - 0.2, text: "REFRESHED", color: "#9ff0e0", life: 2 }); log(`The ${addr()} wakes in his own rack, properly rested. (Refreshed: energy drains slower for a while.)`, "comm"); }
    }
  }
  // standing order: with the locker full while away, surplus spares go to the quartermaster at the trade-in rate
  if (P().sinks.maintainOn && nightActive() && S.parts >= S.partsCap) {
    tradeAcc += dt;
    if (tradeAcc >= PROG.rations.autoTradeEvery) { tradeAcc = 0; if (tradeParts(true)) P().sinks.n.autoTrade = (P().sinks.n.autoTrade || 0) + 1; }
  } else tradeAcc = 0;
}

// ---------------- drawing (render/deck.js calls this on the quarters deck) ----------------
export function drawCabin(ctx, t, showEmpty) {
  const c = C();
  ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const sl of slots()) {
    const id = c.placed[sl.id], d = id && DECOR[id];
    const w = sl.w * DW, h = sl.h * DH, x = sl.x * DW - w / 2, y = sl.y * DH - h / 2;
    if (d) {
      const art = IMG["decor-" + d.id];
      if (art && d.art) {   // art batch 2: true size (cabin_v4 decor_sizes), centred in the slot, never stretched
        const k = decorScale(d, sl), aw = d.art[0] * k, ah = d.art[1] * k;
        ctx.drawImage(art, sl.x * DW - aw / 2, sl.y * DH - ah / 2, aw, ah); continue;
      }
      ctx.fillStyle = sl.type === "floor" ? "rgba(120,80,50,0.55)" : "rgba(14,20,34,0.82)";
      rr(ctx, x, y, w, h, 6); ctx.fill();
      ctx.strokeStyle = "rgba(255,210,150,0.7)"; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = `${Math.round(Math.min(w, h) * 0.62)}px "Noto Color Emoji", "Apple Color Emoji", sans-serif`;
      ctx.fillStyle = "#fff"; ctx.fillText(d.icon || "★", sl.x * DW, sl.y * DH + 1);
    } else if (showEmpty) {
      ctx.setLineDash([5, 4]); ctx.strokeStyle = `rgba(160,200,255,${0.35 + 0.15 * Math.sin(t * 2 + sl.x * 9)})`; ctx.lineWidth = 1.5;
      rr(ctx, x, y, w, h, 6); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "rgba(160,200,255,0.6)"; ctx.font = "600 16px Antonio, sans-serif"; ctx.fillText("+", sl.x * DW, sl.y * DH);
    }
  }
  ctx.restore();
}
// Own size (1.0) whenever the art is within 1.5x the slot box (e.g. the 20 px chess set on the 14 px desk slot, as the
// artist's previews show it); a far-too-big item (a 46 px painting on the Cmdr's 22 px diploma wall) shrinks to the box.
export function decorScale(d, sl) {
  const w = sl.w * DW, h = sl.h * DH;
  return d.art[0] <= w * 1.5 && d.art[1] <= h * 1.5 ? 1 : Math.min(w / d.art[0], h / d.art[1]);
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
export { CABIN_TIERS, CABIN_ORDER, DECOR_ITEMS, DECOR, SLOT_NAMES };
