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
import { PACE_RT, nightActive } from "./pacing.js";

const P = () => G.prog;
const K = () => PROG.jobs;
const rr = ([a, b]) => a + Math.random() * (b - a);
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
export const J = () => P().jobs || (P().jobs = { next: K().firstAt, active: null, n: 0, done: 0, xp: 0, expired: 0 });
export const activeJob = () => { const j = J().active; return j && NODEMAP[j.node] ? j : null; };
function quiet() {
  const S = G.ship;
  return !PACE_RT.offline && !nightActive() && !G.sp.battle && !Object.keys(S.faults).length && !(G.sp.ev.active && G.sp.ev.active.task) && !G.lt.lift;
}
function spawn() {
  const k = K(), L = G.lt;
  let job = null;
  if (Math.random() < k.requestShare) {
    const opts = JOBS.request.filter(r => NODEMAP[r.node]).map(r => ({ r, who: crewList().filter(c => c.deck === r.deck && !c.senior && !(G.prog.med && G.prog.med.inj.some(x => x.id === c.id))) })).filter(o => o.who.length);
    if (opts.length) { const o = pick(opts), c = pick(o.who); job = { kind: "request", node: o.r.node, deck: o.r.deck, who: c.id, short: c.short, label: `${c.short} asks for a hand with ${o.r.thing}${cheer(o.r.quip || "", "")}` }; }
  }
  if (!job) { const opts = JOBS.console.filter(j => NODEMAP[j.node] && j.node !== L.node); const j = pick(opts); job = { kind: "console", node: j.node, deck: NODEMAP[j.node].deck, label: j.label }; }
  Object.assign(job, { t: k.expire, dur: k.expire, need: rr(k.work), acc: 0, xp: k.xp, id: ++J().n });
  J().active = job;
  const who = job.kind === "request" ? job.short : "Okafor";
  log(job.kind === "request" ? `${job.short}: '${addr()}, have you got a minute? ${job.label.split(" with ")[1].replace(/^./, c => c.toUpperCase())}.'` : `Okafor: 'Quiet minute, ${addr()}? ${job.label}, if you would.'`, "comm");
  toast(`Odd job (${who}) — ${DECKS[job.deck].name}: ${job.label}`, "task");
}
export function tickJobs(dt) {
  const k = K(); if (!k || !k.enabled) return;
  const j = J(), L = G.lt, a = activeJob();
  if (a) {
    if (PACE_RT.offline) { j.active = null; j.next = rr(k.gap); return; }   // errands don't survive a break
    a.t -= dt;
    if (L.deck === a.deck && !L.lift && L.mode === "use" && L.node === a.node) {
      a.acc += dt * taskMult();
      if (a.acc >= a.need) {
        const man = !!L.useManual, xp = awardXP(a.xp * (man ? PROG.manual.xp : PROG.auto.xp), man ? "manual" : "auto", "job");
        G.sp.rep += k.rep;
        if (a.kind === "request" && a.who) nudge(a.who, k.opinion, "odd job");
        taskDone(a.node, a.deck);
        j.done++; j.xp += xp; j.active = null; j.next = rr(k.gap);
        log(a.kind === "request" ? `${a.short} — sorted.${cheer(` 'I owe you one, ${addr()}.'`, "")} (+${xp} XP)` : `Odd job done — ${a.label.replace(/^./, c => c.toLowerCase())}. (+${xp} XP)`, "good");
        toast(`Odd job done · +${xp} XP${k.rep > 0 ? ` · +${k.rep} rep` : ""}`, "good");
        fx("floater", { x: L.x, y: L.y - HEAD_Y, text: `+${xp} XP`, color: "#8fd8ff", delay: 0.3, life: 2 });
      }
    }
    if (j.active && a.t <= 0) { j.active = null; j.expired++; j.next = rr(k.gap); }   // quietly picked up by the crew, no penalty
    return;
  }
  if (!quiet() || PACE_RT.sessionT < k.firstAt) return;
  j.next -= dt;
  if (j.next <= 0) spawn();
}
