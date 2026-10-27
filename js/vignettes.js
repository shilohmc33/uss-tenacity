// Oct 26 batch D/E: ambient space-window vignettes. A cosmetic lane, separate from the event and story slots: now and then
// a ship (or debris) drifts across the space window while 2-3 officers comment in text bubbles (also logged). No painted
// scenes (Shiloh, Oct 26): just the object sprite moving plus the bubbles. Never during a battle, a held red alert, a story
// event, a damage-control call, a deck task, the quiet period after a death, an idle pause or a hidden tab; it ticks from
// the main loop with the sim, so it freezes with it. About 1 in 4 offers a small tap bonus (+5 XP or +1 rep, never items).
// Saved (G.prog.vig): present-play clock, the hour's start times, the wait and the last bonus, so a reload cannot reset
// the 4-per-hour cap or farm the bonus. Bubbles / the running vignette itself are not saved.
import { ltNamed } from "./ltname.js";
import { G } from "./state.js";
import { cheerful, cheerLog } from "./bus.js";   // the ONE quiet-period gate (cheer-scan)
import { awardXP, addHardener } from "./progression.js";
import { isPresent, idlePaused } from "./pacing.js";
import { storyOpen, storyUI } from "./story.js";
import { dcPaused } from "./dc.js";
import { SHIPS } from "./ships.js";
import { IMG } from "./assets.js";
import { drawShip } from "./render/ships.js";
import { badClock } from "./clock.js";   // R2: no bonus on a bad clock

export const VIG = { minDay: 2, gap: [[10, 360], [5, 540], [2, 720]], jitter: 0.25, perHour: 4, hourS: 3600, dur: [20, 40], bonusP: 0.25, bonusGapS: 1800, bonus: { xp: 5, rep: 1 }, retryS: 20, recent: 4 };
// New art (batch F/G, not drawn yet): the planned files. ready: false = never requested (no 404); fb = the existing ship
// drawn in its place (null = the vignette is skipped). Flip ready to true when the file lands in assets/.
export const VIG_ART = {
  bajoran_transport: { file: "assets/ship-bajoran_transport.webp", key: "ship-bajoran_transport", aspect: 1400 / 538, ready: true },
  bajoran_transport_damaged: { file: "assets/ship-bajoran_transport-damaged.webp", key: "ship-bajoran_transport-damaged", aspect: 1400 / 538, ready: true },
  ferengi_marauder: { file: "assets/ship-ferengi_marauder.webp", key: "ship-ferengi_marauder", aspect: 1400 / 636, ready: true },
  runabout: { file: "assets/ship-runabout.webp", key: "ship-runabout", aspect: 1400 / 583, ready: true },
  // nucleus is square 512x512; the ion tail (2048x292) is drawn separately, additive, bright end on the RIGHT at the nucleus
  comet: { file: "assets/ship-comet.webp", key: "ship-comet", tail: "assets/ship-comet-tail.webp", tailKey: "ship-comet-tail", aspect: 1, ready: true },
};
// actors: s = SHIPS id | "art:<VIG_ART key>" | "img:<IMG key>"; y = top as a fraction of the window; sz = width as a
// fraction of the Tenacity's width; x0/x1 = start/end x (fractions of the window width, left edge); fx = "cloak" | "decloak" | "dim"
const R2L = { x0: 1.08, x1: -0.35 }, L2R = { x0: -0.35, x1: 1.08 };
export const VIGS = [
  { id: "freighter_hail", actors: [{ s: "img:ss-freighter-damaged", asp: 2, y: 0.16, sz: 0.62, ...R2L, bob: 1 }], lines: [["Diallo", "Freighter off the port bow. Coolant leak, venting plasma."], ["CDR Okafor", "I'm talking her engineer through a bypass. Simple fix, if you have the right spanner."], ["Diallo", "Leak's sealed. They're on their way, and they say thank you."]] },
  { id: "convoy", actors: [{ s: "freighter", y: 0.1, sz: 0.34, ...L2R, lag: 0 }, { s: "freighter", y: 0.2, sz: 0.34, ...L2R, lag: 0.1 }, { s: "freighter", y: 0.3, sz: 0.34, ...L2R, lag: 0.2 }, { s: "fed_saber", y: 0.05, sz: 0.3, ...L2R, lag: -0.08 }], lines: [["Hale", "Convoy crossing ahead. Three freighters and a Saber riding shotgun."], ["Capt T'Ren", "Return their salute, Lieutenant Commander."], ["Hale", "Salute returned. Their escort flashed running lights back."]] },
  { id: "saber_pass", actors: [{ s: "fed_saber", y: 0.14, sz: 0.4, ...R2L, fast: 1 }], lines: [["Diallo", "USS Yeager, passing at high warp. She just dropped out to say hello."], ["Hale", "Yeager sends regards. And a rude joke about our nacelles."]] },
  { id: "bop_decloak", actors: [{ s: "klingon_bop", y: 0.12, sz: 0.4, x0: 0.62, x1: 0.2, fx: "decloak" }], lines: [["Hale", "Decloaking signature, bearing two-one-zero!"], ["Diallo", "It's a Bird-of-Prey. The IKS Ch'Tang. They're... hailing us with a song."], ["Capt T'Ren", "Wish them good hunting. Then let them go back to their singing."]] },
  { id: "cloak_shimmer", actors: [{ s: "klingon_bop", y: 0.18, sz: 0.34, x0: 0.75, x1: 0.15, fx: "cloak" }], lines: [["Hale", "Something just bent the starlight. There, by the nebula edge."], ["Diallo", "Faint tachyon scatter. A cloaked ship, maybe. Or a sensor ghost."], ["Hale", "Gone. I'm logging it anyway."]] },
  { id: "debris_field", actors: [{ s: "img:ss-galor-wreck-0", nat: 1, y: 0.12, sz: 0.5, ...R2L, spin: 0.05 }, { s: "img:ss-galor-wreck-2", nat: 1, y: 0.28, sz: 0.5, ...R2L, lag: 0.12, spin: -0.08 }, { s: "img:ss-jh_fighter-wreck-1", nat: 1, y: 0.06, sz: 0.5, ...R2L, lag: 0.22, spin: 0.06 }, { s: "img:ss-galor-debris-3", nat: 1, y: 0.22, sz: 0.5, ...R2L, lag: 0.05, spin: 0.4 }, { s: "img:ss-jh_fighter-debris-1", nat: 1, y: 0.34, sz: 0.5, ...R2L, lag: 0.3, spin: -0.5 }], lines: [["Diallo", "Debris field. Cardassian and Jem'Hadar hulls, months old."], ["Capt T'Ren", "Reduce speed. We will pass them with care."], ["CDR Okafor", "Somebody's crew. Somebody's ship. Moment of quiet, everyone."]] },
  { id: "galor_far", actors: [{ s: "galor", y: 0.08, sz: 0.2, x0: 0.8, x1: 0.55, fx: "dim" }], lines: [["Hale", "Galor-class at the edge of sensor range. Shields down, weapons cold."], ["Diallo", "She's turning away. Just a patrol, keeping an eye on us."]] },
  { id: "bajoran_transport", actors: [{ s: "art:bajoran_transport", y: 0.16, sz: 0.4, ...L2R }], lines: [["Diallo", "Bajoran transport, pilgrims bound for DS9."], ["Hale", "They asked the Prophets to walk with us. I said we'd take all the help we can get."]] },
  { id: "bajoran_limp", actors: [{ s: "art:bajoran_transport_damaged", y: 0.17, sz: 0.4, ...R2L, bob: 1 }], lines: [["Diallo", "Bajoran transport, scorched hull. A Cardassian patrol took a shot at them near Bajor."], ["CDR Okafor", "Their impulse coils are tired, not dead. I've sent them a patch over subspace."], ["Hale", "They'll make DS9. The pilgrims are singing again."]] },
  { id: "ferengi_hail", actors: [{ s: "art:ferengi_marauder", y: 0.14, sz: 0.45, ...R2L }], lines: [["Diallo", "A Ferengi trader is hailing. He has 'a once-in-a-lifetime deal' on self-sealing stem bolts."], ["Capt T'Ren", "Decline. Politely, and with no counter-offer."], ["Hale", "He says the offer stands. Forever, apparently."]] },
  { id: "comet", actors: [{ s: "art:comet", y: 0.12, sz: 0.28, ...R2L }], lines: [["Diallo", "A comet! Look at that ion tail. Logging it for the science council."], ["CDR Okafor", "She's happier than I've seen her all week."]] },
  { id: "runabout_mail", actors: [{ s: "art:runabout", y: 0.18, sz: 0.22, ...L2R }], lines: [["Hale", "Runabout from DS9, the mail run."], ["Diallo", "Letters for the crew. Someone has a parcel that's ticking. Gently."], ["CDR Okafor", "That'll be my tea. Don't drop it."]] },
  { id: "jh_far", actors: [{ s: "jh_fighter", y: 0.07, sz: 0.1, x0: 0.9, x1: 0.62, fx: "dim" }, { s: "jh_fighter", y: 0.11, sz: 0.1, x0: 0.95, x1: 0.67, fx: "dim", lag: 0.04 }], lines: [["Hale", "Two Jem'Hadar fighters, extreme range. Not closing."], ["Capt T'Ren", "No red alert. They are not interested in us. Today."]] },
  // ---- Oct 27: ~12 new text vignettes (existing art only; Shiloh) ----
  { id: "ferengi_auction", actors: [{ s: "art:ferengi_marauder", y: 0.15, sz: 0.45, ...L2R }], lines: [["Grevv", "Ferengi marauder broadcasting an auction. Opening bid on our spare EPS relays."], ["Diallo", "They have our serial numbers. That is not reassuring."], ["Grevv", "I told them the opening bid is a boot to the airlock. Channel closed."]] },
  { id: "saber_spares", actors: [{ s: "fed_saber", y: 0.14, sz: 0.38, ...L2R }], lines: [["Kovac", "USS Yeager again. They're dumping a crate of isolinear chips our way."], ["CDR Okafor", "Bless that quartermaster. Log it and get them a thank-you on subspace."]] },
  { id: "bop_bloodwine", actors: [{ s: "klingon_bop", y: 0.12, sz: 0.4, x0: 0.7, x1: 0.25, fx: "decloak" }], lines: [["Hale", "Bird-of-Prey decloaking. They're inviting the senior staff for bloodwine."], ["Capt T'Ren", "Convey our respects. And that we are on duty."], ["Hale", "They say next time, then. Loudly."]] },
  { id: "galor_quiet", actors: [{ s: "galor", y: 0.09, sz: 0.22, x0: 0.85, x1: 0.5, fx: "dim" }], lines: [["Diallo", "Galor on a long arc. No transponder, no hail."], ["Hale", "Weapons cold. Whatever they're hunting, it isn't us."], ["Diallo", "Still logging the contact. Quiet ships make me nervous."]] },
  { id: "jh_shadow", actors: [{ s: "jh_fighter", y: 0.08, sz: 0.12, x0: 0.92, x1: 0.6, fx: "dim" }, { s: "jh_fighter", y: 0.14, sz: 0.12, x0: 0.96, x1: 0.64, fx: "dim", lag: 0.05 }], lines: [["Hale", "Jem'Hadar pair at the limb of the sensor envelope."], ["Rhovan", "I can't feel anything from them. Empty, the way they always are."], ["Capt T'Ren", "Hold course. Curiosity is not a virtue today."]] },
  { id: "runabout_samples", actors: [{ s: "art:runabout", y: 0.2, sz: 0.22, ...R2L }], lines: [["Orvin", "Runabout from the Pasteur. Tissue samples for my lab."], ["Tull", "And a crate of something that smells like lemon. Don't ask me."], ["Orvin", "That will be the culture medium. Leave it sealed, Brennik."]] },
  { id: "bajoran_vedek", actors: [{ s: "art:bajoran_transport", y: 0.16, sz: 0.4, ...R2L }], lines: [["Doru", "That transport — the vedek who blessed my earring is aboard."], ["Diallo", "Want me to open a channel?"], ["Doru", "Already did. He says the Prophets walk with {named} too. I said we'd take it."]] },
  { id: "comet_wish", actors: [{ s: "art:comet", y: 0.11, sz: 0.28, ...L2R }], lines: [["R'Mira", "A comet! Do we get a wish, or is that only for planets?"], ["Diallo", "Science says no. I won't tell if you wish anyway."], ["R'Mira", "Too late. I already did."]] },
  { id: "freighter_soup", actors: [{ s: "freighter", y: 0.18, sz: 0.5, ...R2L, bob: 1 }], lines: [["Delgado", "Freighter cook just traded me a plomeek broth recipe over open channel."], ["CDR Okafor", "Sorvan will pretend not to care. Put a pot on anyway."], ["Delgado", "Already simmering. Mess deck smells like Vulcan tonight."]] },
  { id: "cloak_echo", actors: [{ s: "klingon_bop", y: 0.16, sz: 0.32, x0: 0.8, x1: 0.2, fx: "cloak" }], lines: [["Rhovan", "Something brushed the edge of my sense. Cloaked, angry, then gone."], ["Hale", "Tachyon scatter matches a Bird-of-Prey wake. They're not hailing."], ["Rhovan", "Whoever it was, they didn't want to be seen. Least of all by us."]] },
  { id: "debris_nameplate", actors: [{ s: "img:ss-galor-wreck-1", nat: 1, y: 0.14, sz: 0.45, ...L2R, spin: 0.04 }, { s: "img:ss-galor-debris-0", nat: 1, y: 0.3, sz: 0.45, ...L2R, lag: 0.1, spin: -0.3 }], lines: [["Mollo", "Debris. I can read a Cardassian nameplate on that section."], ["Orvin", "Mark the coordinates. Someone will want the name, even years late."], ["Mollo", "Logged. The transporter buffer remembers more than we do."]] },
  { id: "convoy_thanks", actors: [{ s: "freighter", y: 0.12, sz: 0.32, ...L2R, lag: 0 }, { s: "freighter", y: 0.24, sz: 0.32, ...L2R, lag: 0.12 }, { s: "fed_saber", y: 0.06, sz: 0.28, ...L2R, lag: -0.06 }], lines: [["Natarajan", "Convoy on the DS9 run. Their escort asked for {named} by name."], ["Hale", "Yeager's cousin-ship. They remember the plasma leak we walked them through."], ["Natarajan", "I told them the Lieutenant was on watch below. They flashed running lights anyway."]] },
];
const R = { cur: null, recent: [], n: 0, toSpace: null, el: null, lastFor: "" };
const freshVig = () => ({ pt: 0, st: [], w: null, bt: -1e9 });
export const PV = () => { const p = G.prog; if (!p.vig || typeof p.vig !== "object") p.vig = freshVig(); return p.vig; };
export const vigRT = R;
const dayNow = () => Math.max(1, Math.floor(+(G.prog && G.prog.day) || 1));
export const gapFor = (day = dayNow()) => { for (const [d, s] of VIG.gap) if (day >= d) return s; return Infinity; };
// what holds the lane (null = clear). The idle pause and a hidden tab also stop the main loop, so the lane freezes then.
export function vigBlock() {
  const SP = G.sp || {};
  if (SP.battle) return "battle";
  if (SP.alert) return "alert";
  if (storyOpen()) return "story";
  if (dcPaused()) return "dc";
  if (SP.ev && SP.ev.active) return "task";
  if (!cheerful()) return "hushed";   // the quiet period after a death (bus.js gate)
  if (storyUI.panelWhy && storyUI.panelWhy()) return "panel";   // any modal (holodeck, ...) or sheet open
  { const wb = typeof document !== "undefined" && document.getElementById("wbCard"); if (wb && !wb.hidden && wb.classList.contains("bow")) return "card"; }   // BACK ON WATCH up
  if (idlePaused()) return "idle";
  if (typeof document !== "undefined" && document.hidden) return "hidden";
  return null;
}
// art for an actor: [kind, key, aspect, sizeK] or null (skip). A new-art key draws its file once ready, else its fallback ship.
function artOf(a) {
  if (a.s.startsWith("art:")) {
    const m = VIG_ART[a.s.slice(4)]; if (!m || !m.ready) return null;
    const im = (m.key && IMG[m.key]) || m.im; if (!im) { if (!m.im) { m.im = new Image(); m.im.src = m.file; } return null; }
    return ["file", m, m.aspect || (im.naturalWidth / (im.naturalHeight || 1)), 1];
  }
  if (a.s.startsWith("img:")) { const im = IMG[a.s.slice(4)]; return im && im.naturalWidth ? ["img", im, im.naturalWidth / im.naturalHeight, 1] : null; }
  return SHIPS[a.s] ? ["ship", a.s, SHIPS[a.s].aspect, 1] : null;
}
export const playable = v => v.actors.every(a => !!artOf(a));
export function pickVig(rnd = Math.random) {
  const ok = VIGS.filter(v => playable(v)), fresh = ok.filter(v => !R.recent.includes(v.id)), pool = fresh.length ? fresh : ok;
  return pool.length ? pool[Math.floor(rnd() * pool.length)] : null;
}
export function startVig(def, opt = {}) {
  if (!def || R.cur) return null;
  const rnd = opt.rnd || Math.random, D = opt.dur || VIG.dur[0] + rnd() * (VIG.dur[1] - VIG.dur[0]);
  const bonus = opt.bonus !== undefined ? opt.bonus : !badClock() && PV().pt - PV().bt >= VIG.bonusGapS && rnd() < VIG.bonusP ? (rnd() < 0.5 ? "xp" : "rep") : null;
  if (bonus) PV().bt = PV().pt;   /* saved: one bonus offer per 30 min of present play at most */
  const n = def.lines.length, at = n === 2 ? [0.1, 0.4] : [0.08, 0.3, 0.52];   /* all lines while the object is still in the window */
  R.cur = { id: def.id, def, t: 0, D, at: at.map(f => f * D), shown: 0, bonus, took: false };
  PV().st.push(PV().pt); R.recent = [def.id, ...R.recent.filter(x => x !== def.id)].slice(0, VIG.recent); R.n++;
  render(); return R.cur;
}
export function endVig(why = "done") { const c = R.cur; if (!c) return; R.cur = null; PV().w = null; c.end = why; render(); }
export function tickVig(dt) {
  const c = R.cur;
  if (c) {
    const b = vigBlock(); if (b && !["idle", "hidden", "panel", "card"].includes(b)) { endVig("abort:" + b); return; }   /* a panel or the card only holds the start */
    c.t += dt;
    while (c.shown < c.def.lines.length && c.t >= c.at[c.shown]) { const [who, tx] = c.def.lines[c.shown++]; cheerLog(`${who}: "${fillLine(tx)}"`, "comm"); render(); }
    if (c.t >= c.D) endVig("done");
    return;
  }
  const day = dayNow(); if (day < VIG.minDay || !isPresent()) return;   // the lane counts present play only
  PV().pt += dt; PV().st = PV().st.filter(s => s > PV().pt - VIG.hourS);
  if (PV().w == null) PV().w = gapFor(day) * (1 - VIG.jitter + Math.random() * 2 * VIG.jitter);
  PV().w -= dt; if (PV().w > 0) return;
  if (vigBlock() || PV().st.length >= VIG.perHour) { PV().w = VIG.retryS; return; }
  if (!startVig(pickVig())) PV().w = VIG.retryS;
}
export function takeBonus() {
  const c = R.cur; if (!c || !c.bonus || c.took || badClock()) return 0;
  c.took = true;
  if (c.bonus === "xp") { const x = awardXP(VIG.bonus.xp, "vig", "sensor log"); cheerLog(`Sensor contact logged for the science council. +${x} XP`, "good"); }
  else { G.sp.rep = (G.sp.rep || 0) + VIG.bonus.rep; cheerLog(`Contact logged and passed to Starfleet Command. Reputation +${VIG.bonus.rep}.`, "good"); }
  render(); return 1;
}
export const vigChip = () => R.cur ? `<button class="chip vigc" data-vig="1" aria-label="Sensors: switch to the space view">📡 Sensors</button>` : "";
// ---- bubbles: a DOM overlay at the bottom of the space window (shown only in the space view, body.view-space) ----
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const fillLine = tx => String(tx).replace(/\{named\}/g, () => ltNamed());   // a couple of lines name the Lt (escaped at render)
function render() {
  if (typeof document === "undefined") return;
  let el = R.el; const st = document.getElementById("stage");
  if (!el) { if (!st) return; el = R.el = document.createElement("div"); el.id = "vigBox"; el.hidden = true; st.appendChild(el);
    el.addEventListener("click", e => { if (e.target.closest("[data-vigbonus]")) takeBonus(); }); }
  const c = R.cur;
  if (!c) { el.hidden = true; el.innerHTML = ""; el.dataset.id = ""; return; }
  const lines = c.def.lines.slice(0, c.shown).slice(-3);
  const bn = c.bonus && !c.took && c.shown ? `<button class="vbBonus" data-vigbonus="1">📡 Log the contact (${c.bonus === "xp" ? `+${VIG.bonus.xp} XP` : `+${VIG.bonus.rep} rep`})</button>` : "";
  el.innerHTML = lines.map(([who, tx], i) => `<div class="vb${i === lines.length - 1 ? " now" : ""}"><b>${esc(who)}</b> ${esc(fillLine(tx))}</div>`).join("") + bn;
  el.dataset.id = c.id; el.hidden = !lines.length;
}
// ---- the actors (render/space.js, outside battle, behind the Tenacity). w/h = window size, L = the Tenacity's width ----
export function drawVig(ctx, w, h, L, t) {
  const c = R.cur; if (!c) return;
  const u = Math.min(1, c.t / c.D), edge = Math.min(1, c.t / 1.5, (c.D - c.t) / 1.5);
  for (const a of c.def.actors) {
    const art = artOf(a); if (!art) continue;
    const k = Math.min(1, Math.max(0, (u - (a.lag || 0)) / (1 - Math.abs(a.lag || 0)))), uu = a.fast ? Math.min(1, Math.max(0, (k - 0.3) * 2.5)) : k;
    const bw = L * a.sz * art[3], bh = bw / art[2], x = (a.x0 + (a.x1 - a.x0) * uu) * w, y = a.y * h + (a.bob ? Math.sin(t * 1.3) * h * 0.006 : 0);
    let al = edge;
    if (a.fx === "dim") al *= 0.55;
    if (a.fx === "cloak") al *= 0.07 + 0.09 * (0.5 + 0.5 * Math.sin(t * 9)) * (0.6 + 0.4 * Math.sin(t * 2.3));
    if (a.fx === "decloak") { const f = c.t < 3 ? c.t / 3 : c.t > c.D - 3 ? (c.D - c.t) / 3 : 1; al = Math.max(0, f) * (f < 1 ? 0.5 + 0.5 * Math.sin(t * 22) : 1); }
    const mirror = a.x1 < a.x0;
    if (art[0] === "ship") { drawShip(ctx, art[1], x, y, bw, bh, { mirror, alpha: al, t, key: "vig-" + c.id }); continue; }
    const m = art[0] === "file" ? art[1] : null, im = m ? (m.key && IMG[m.key]) || m.im : art[1]; if (!im || !im.complete || !im.naturalWidth) continue;
    const nw = a.nat ? Math.min(bw, im.naturalWidth * (L / 900)) : bw, nh = nw * im.naturalHeight / im.naturalWidth;
    const cx = x + bw / 2, cy = y + bh / 2;
    // comet ion tail: additive, bright end on the RIGHT of the sprite joins the nucleus. Moving left (mirror) flips so the
    // bright end still meets the nucleus and the faint trail trails behind.
    if (m && m.tailKey) {
      const tim = IMG[m.tailKey] || m.tim; if (tim && tim.complete && tim.naturalWidth) {
        const th = nh * 0.55, tw = th * (tim.naturalWidth / tim.naturalHeight);
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = al * 0.95;
        ctx.translate(cx, cy); if (a.spin) ctx.rotate(a.spin * c.t); if (mirror) ctx.scale(-1, 1);
        // bright (right) end at the nucleus centre; the body of the trail extends to the left of the sprite = behind when mirrored for R2L
        ctx.drawImage(tim, -tw + nw * 0.15, -th / 2, tw, th); ctx.restore();
      } else if (m.tail && !m.tim) { m.tim = new Image(); m.tim.src = m.tail; }
    }
    ctx.save(); ctx.globalAlpha = al; ctx.translate(cx, cy);
    if (a.spin) ctx.rotate(a.spin * c.t);
    if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(im, -nw / 2, -nh / 2, nw, nh); ctx.restore();
  }
}
addHardener(p => { const s = p.vig && typeof p.vig === "object" ? p.vig : {}, n = (v, d) => Number.isFinite(+v) && v !== null ? +v : d;
  const pt = Math.max(0, n(s.pt, 0)), st = (Array.isArray(s.st) ? s.st : []).map(Number).filter(x => Number.isFinite(x) && x <= pt && x > pt - VIG.hourS).slice(-VIG.perHour);
  const w = s.w == null ? null : Math.min(Math.max(0, n(s.w, 0)), VIG.gap[VIG.gap.length - 1][1] * (1 + VIG.jitter));
  p.vig = { pt, st, w, bt: Math.min(pt, n(s.bt, -1e9)) }; });
