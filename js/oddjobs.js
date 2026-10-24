// pt04 pacing: small between-repair activities ("odd jobs"). When the ship is quiet (no faults, no deck task, no battle)
// and the player is at the controls, Okafor or a crew member hands the Lt a short job at a console: a calibration,
// a diagnostic, an inventory, or a crew request. It shows on the alert pill and the DUTY list (lowest priority, below
// every fault); tap GO, the Lt walks there and works it for ~15 s. Manual XP + a little rep; crew requests also lift
// that crew member's opinion. Never offline or while idle (the night crew doesn't need errands), never during a battle.
// Tuning: PROG.jobs. State: G.prog.jobs (not saved across sessions in a meaningful way; safe to drop).
import { G } from "./state.js";
import { DECKS, NODEMAP, HEAD_Y } from "./data.js";
import { log, toast, fx, cheer } from "./bus.js";
import { PROG, awardXP, taskMult, taskDone, nudge, crewList, opinionOf, addr } from "./progression.js";
import { PACE, PACE_RT, nightActive, isPresent } from "./pacing.js";
import { resolveIncident, expireIncident, checkIncident } from "./incidents.js";

const P = () => G.prog;
const K = () => PROG.jobs;
const rr = ([a, b]) => a + Math.random() * (b - a);
const GAP = () => (PACE.oddjobs && PACE.oddjobs.gap) || K().gap;   // Q1 #5: 3-5 min of quiet between jobs (pacing.js)
const pick = a => a[Math.floor(Math.random() * a.length)];
// console jobs (Okafor's list) and crew requests per deck: {node, label}. Crew requests name someone working that deck.
export const JOBS = {
  console: [
    { node: "msd", label: "Run a level-3 diagnostic on the Master Systems Display" },
    { node: "msd", label: "Cross-check the navigational deflector logs" },
    { node: "core", label: "Calibrate the warp core's plasma injectors" },
    { node: "core", label: "Log the dilithium matrix alignment" },
    { node: "shield", label: "Re-balance the shield grid harmonics" },
    { node: "torpbay", label: "Inspect the torpedo guidance packages" },
    { node: "locker", label: "Inventory and re-tag the parts locker" },
    { node: "pads", label: "Align the transporter pattern buffers" },
    { node: "biobed", label: "Recalibrate the biobed sensor array for sickbay" },
  ],
  request: [
    { deck: "engineering", node: "core", thing: "a stubborn EPS tap reading" },
    { deck: "engineering", node: "shield", thing: "a field-coil test" },
    { deck: "engineering", node: "pads", thing: "a pattern-buffer cycle" },
    { deck: "bridge", node: "msd", thing: "a sensor sweep that won't converge" },
    { deck: "lounge", node: "bar", thing: "the drinks replicator", quip: " (it only makes broth again)" },   // cheer-gated: the quip goes through cheer() in spawn()
    { deck: "lounge", node: "mess", thing: "the galley's food synthesiser" },
    { deck: "medical", node: "biobed", thing: "a tricorder that needs re-syncing" },
  ],
};
// Q1 #5: every PACE.oddjobs.chainEvery-th job is a 2-step mini-chain with one named crewmate (no pronouns needed: names only)
export const CHAINS = [
  { deck: "engineering", a: { node: "core", thing: "a plasma-flow model that won't balance" }, b: { node: "msd", thing: "Check the model against the Master Systems Display on the bridge" },
    pay: "{short} runs the numbers one last time and grins. 'Balanced to the fourth decimal, {addr}. That one's going on the wall.'" },
  { deck: "engineering", a: { node: "shield", thing: "a harmonic drift in the shield grid" }, b: { node: "locker", thing: "Fetch a fresh field coil from the parts locker and seat it" },
    pay: "The grid hums back to a clean note. {short}: 'That drift has been bugging me for a week. Thank you, {addr}.'" },
  { deck: "engineering", a: { node: "torpbay", thing: "a guidance package that keeps failing its self-test" }, b: { node: "pads", thing: "Beam the faulty package to the bench and swap its gyro" },
    pay: "The package passes on the first try. {short} taps it twice for luck. 'Good as new, {addr}. Better, maybe.'" },
  { deck: "lounge", a: { node: "mess", thing: "a galley menu for a homesick crewmate" }, b: { node: "bar", thing: "Coax the bar replicator into the recipe" },
    pay: "The dish comes out right, near enough. {short}: 'That's going to make someone's whole week, {addr}.'" },
  { deck: "medical", a: { node: "biobed", thing: "a biobed that reads every patient two degrees warm" }, b: { node: "core", thing: "Trace the drift to a power-feed spike in Main Engineering" },
    pay: "The biobed settles on the right number. {short}: 'One less thing to second-guess in an emergency. Much appreciated, {addr}.'" },
];
export const J = () => P().jobs || (P().jobs = { next: K().firstAt, active: null, n: 0, done: 0, xp: 0, expired: 0, recent: [] });
const recentOf = () => { const j = J(); if (!Array.isArray(j.recent)) j.recent = []; return j.recent; };
const fresh = key => !recentOf().includes(key);
const remember = key => { const r = recentOf(); r.push(key); while (r.length > ((PACE.oddjobs && PACE.oddjobs.noRepeat) || 6)) r.shift(); };
export const activeJob = () => { const j = J().active; return j && NODEMAP[j.node] ? j : null; };
function quiet() {
  const S = G.ship;
  return !PACE_RT.offline && !nightActive() && !G.sp.battle && !G.sp.alert && !Object.keys(S.faults).length && !(G.sp.ev.active && G.sp.ev.active.task) && !G.lt.lift;
}
const freeCrew = deck => crewList().filter(c => c.deck === deck && !c.senior && !(G.prog.med && G.prog.med.inj.some(x => x.id === c.id)));
function spawnChain() {
  const opts = CHAINS.filter(c => NODEMAP[c.a.node] && NODEMAP[c.b.node] && fresh("chain:" + c.a.thing)).map(c => ({ c, who: freeCrew(c.deck) })).filter(o => o.who.length);
  if (!opts.length) return null;
  const o = pick(opts), c = pick(o.who); remember("chain:" + o.c.a.thing);
  return { kind: "request", node: o.c.a.node, deck: o.c.deck, who: c.id, short: c.short, label: `${c.short} asks for a hand with ${o.c.a.thing}`, chain: { step: 1, of: 2, i: CHAINS.indexOf(o.c) } };
}
function spawn() {
  const k = K(), L = G.lt;
  let job = null;
  const every = (PACE.oddjobs && PACE.oddjobs.chainEvery) || 3;
  const offers = Number.isFinite(J().offers) ? Math.max(0, Math.floor(J().offers)) : 0;   // Q1b #2: fresh offers only (a chain's step 2 is not an offer)
  if ((offers + 1) % every === 0) job = spawnChain();
  if (!job && Math.random() < k.requestShare) {
    const opts = JOBS.request.filter(r => NODEMAP[r.node] && fresh("req:" + r.thing)).map(r => ({ r, who: crewList().filter(c => c.deck === r.deck && !c.senior && !(G.prog.med && G.prog.med.inj.some(x => x.id === c.id))) })).filter(o => o.who.length);
    if (opts.length) { const o = pick(opts), c = pick(o.who); remember("req:" + o.r.thing); job = { kind: "request", node: o.r.node, deck: o.r.deck, who: c.id, short: c.short, label: `${c.short} asks for a hand with ${o.r.thing}${cheer(o.r.quip || "", "")}` }; }
  }
  if (!job) { let opts = JOBS.console.filter(j => NODEMAP[j.node] && j.node !== L.node); const nr = opts.filter(j => fresh("con:" + j.label)); if (nr.length) opts = nr; const j = pick(opts); remember("con:" + j.label); job = { kind: "console", node: j.node, deck: NODEMAP[j.node].deck, label: j.label }; }
  Object.assign(job, { t: k.expire, dur: k.expire, need: rr(k.work), acc: 0, xp: k.xp, id: ++J().n }); J().offers = offers + 1;
  J().active = job;
  if (job.chain) { log(`${job.short}: '${addr()}, have you got a minute? It's ${job.label.split(" with ")[1]}, and it may take two goes.'`, "comm"); toast(`Odd job (${job.short}, step 1/2) — ${DECKS[job.deck].name}: ${job.label}`, "task"); return; }
  const who = job.kind === "request" ? job.short : "Okafor";
  log(job.kind === "request" ? `${job.short}: '${addr()}, have you got a minute? ${job.label.split(" with ")[1].replace(/^./, c => c.toUpperCase())}.'` : `Okafor: 'Quiet minute, ${addr()}? ${job.label}, if you would.'`, "comm");
  toast(`Odd job (${who}) — ${DECKS[job.deck].name}: ${job.label}`, "task");
}
export function tickJobs(dt) {
  const k = K(); if (!k || !k.enabled) return;
  const j = J(), L = G.lt, a = activeJob();
  if (a) {
    if (G.sp.battle || G.sp.alert) return;   // Q1 #6 / RA(a): parked during a battle (clock paused, off the pill and the deck); resumes after
    if (a.kind === "incident" && !checkIncident(a)) { j.active = null; j.next = rr(GAP()); return; }   // P29b: they left the ship
    if (a.kind === "incident" && (PACE_RT.offline || !isPresent())) return;   // P29 #4: frozen while the player is away; the timer resumes when he is back
    if (PACE_RT.offline) { j.active = null; j.next = rr(GAP()); return; }   // errands don't survive a break
    a.t -= dt;
    if (L.deck === a.deck && !L.lift && L.mode === "use" && L.node === a.node) {
      a.acc += dt * taskMult();
      if (a.acc >= a.need && a.kind === "incident") { resolveIncident(a); taskDone(a.node, a.deck); j.active = null; j.next = rr(GAP()); return; }   // N3: the Lt talked it through
      if (a.acc >= a.need) {
        const man = !!L.useManual, xp = awardXP(a.xp * (man ? PROG.manual.xp : PROG.auto.xp), man ? "manual" : "auto", "job");
        G.sp.rep += k.rep;
        if (a.kind === "request" && a.who) nudge(a.who, k.opinion, "odd job");
        taskDone(a.node, a.deck);
        if (a.chain && a.chain.step < a.chain.of && CHAINS[a.chain.i] && NODEMAP[CHAINS[a.chain.i].b.node]) {   // Q1 #5: step 2 of the mini-chain, same crewmate
          const C = CHAINS[a.chain.i], nb = C.b.node; j.xp += xp;
          j.active = { kind: "request", node: nb, deck: NODEMAP[nb].deck, who: a.who, short: a.short, label: `${C.b.thing} for ${a.short}`, chain: { step: 2, of: 2, i: a.chain.i }, t: k.expire, dur: k.expire, need: rr(k.work), acc: 0, xp: k.xp, id: ++j.n };
          log(`${a.short}: 'Halfway there, ${addr()}. ${C.b.thing}, and we're done.' (+${xp} XP)`, "comm"); toast(`Odd job step 2/2 — ${DECKS[NODEMAP[nb].deck].name}: ${C.b.thing}`, "task");
          fx("floater", { x: L.x, y: L.y - HEAD_Y, text: `+${xp} XP`, color: "#8fd8ff", delay: 0.3, life: 2 }); return;
        }
        if (a.chain && CHAINS[a.chain.i]) { j.done++; j.xp += xp; j.active = null; j.next = rr(GAP()); j.chains = (j.chains | 0) + 1;
          log(`${CHAINS[a.chain.i].pay.replace(/\{short\}/g, a.short).replace(/\{addr\}/g, addr())} (+${xp} XP)`, "good"); toast(`Odd job done · ${a.short} is pleased · +${xp} XP`, "good");
          fx("floater", { x: L.x, y: L.y - HEAD_Y, text: `+${xp} XP`, color: "#8fd8ff", delay: 0.3, life: 2 }); return; }
        j.done++; j.xp += xp; j.active = null; j.next = rr(GAP());
        log(a.kind === "request" ? `${a.short} — sorted.${cheer(` 'I owe you one, ${addr()}.'`, "")} (+${xp} XP)` : `Odd job done — ${a.label.replace(/^./, c => c.toLowerCase())}. (+${xp} XP)`, "good");
        toast(`Odd job done · +${xp} XP${k.rep > 0 ? ` · +${k.rep} rep` : ""}`, "good");
        fx("floater", { x: L.x, y: L.y - HEAD_Y, text: `+${xp} XP`, color: "#8fd8ff", delay: 0.3, life: 2 });
      }
    }
    if (j.active && a.t <= 0) { if (a.kind === "incident") expireIncident(a); j.active = null; j.expired++; j.next = rr(GAP()); }   // quietly picked up by the crew, no penalty
    return;
  }
  if (!quiet() || PACE_RT.sessionT < k.firstAt) return;
  j.next -= dt;
  if (j.next <= 0) spawn();
}
