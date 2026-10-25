// RETIRED in v18 (no offline quests, notes/2026-10-25-no-offline-quests-plan.md): this tool exercised the removed offline catch-up /
// night crew / Shift Report (sim.catchUp, PACE_RT.offline, #report). The v18 behaviour is covered by tools/offline-check.js.
if (!process.env.RUN_RETIRED) { console.log('RETIRED in v18 (offline catch-up removed): see tools/offline-check.js'); process.exit(0); }
// Pass 16 B1 exploit check: does looking away during a LIVE fight beat watching it?
// Runs the REAL battle + catch-up code headless (paused rAF, stepSim at 1/20 s, seeded Math.random per run, so every
// mode of a run fights the same dice up to the moment the player looks away). Passive Lt (nobody repairs), present
// player while watching. Per enemy x start x mode: win / disengage / tow %, hull lost (p50, mean), hull hits, injuries.
// Modes (the player looks away IN s into the fight; default 1 s):
//   watch    - stays on the page to the end
//   hide31   - tab hidden 31 s: frozen while hidden (app.paused = no steps), then the visibility handler's catchUp(31)
//   hide300  - tab hidden 5 min: catchUp(300)
//   reopen   - closes the tab and reopens 2 min later: saveGame() (the pagehide exit save) -> loadGame() -> catchUp(120)
//              (bootGame's path). In-page emulation; REAL page reloads are checked separately (RELOADS, below).
// After the look-away the player is back and present (live steps to the end); any catch-up deferred behind the fight
// (G.sp.awayDefer, pass 16) runs after it as main.js does, and is reported separately (it is not part of the fight).
// Starts: ready = full ship, 4 torpedoes, abilities ready, no faults (the tester's 'abilities ready');
//         gated = battle-sim's START=gated legal mix (60% well kept / 40% mid-voyage);
//         worst = the battlecruiser's worst legal start (hull minHull, power minPower, shields 20, minTorps, one MED fault, cooldowns x1.5).
// NODE_PATH=/workspace/pwtools/node_modules node tools/pt16-livefight.js [base] [runs] [label]   env: TYPES, STARTS, MODES, IN, RELOADS
//   -> shots/pt16-livefight-<label>.json (rewritten after every cell)
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const RUNS = +(process.argv[3] || 600);
const LABEL = process.argv[4] || 'after';
const TYPES = (process.env.TYPES || 'jh_battlecruiser,galor').split(',');
const STARTS = (process.env.STARTS || 'ready,gated,worst').split(',');
const MODES = (process.env.MODES || 'watch,hide31,hide300,reopen').split(',');
const IN = +(process.env.IN || 1), RELOADS = +(process.env.RELOADS || 12), NODEFER = process.env.NODEFER === '1';   // NODEFER=1: don't run the deferred catch-up after the fight (diagnostic)
const OUT = __dirname + `/../shots/pt16-livefight-${LABEL}.json`;
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { window.__TENACITY_TEST_DEATHS = true; });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(BASE + '?reset=1');
  await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
  const out = { base: BASE, runs: RUNS, label: LABEL, lookAwayAt: IN, lt: 'passive', cells: {}, reloads: null, errors: errs };
  const save = () => fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  for (const type of TYPES) for (const start of STARTS) for (const mode of MODES) {
    const key = `${type}|${start}|${mode}`; const t0 = Date.now();
    out.cells[key] = await p.evaluate(async ({ type, start, mode, RUNS, IN, NODEFER }) => {
      window.__noSave = true; __T.app.paused = true;
      const sim = await import('/js/sim.js'), BT = await import('/js/battle.js'), DA = await import('/js/data.js'), P = await import('/js/pacing.js'), St = await import('/js/state.js'), G = __T.G;
      const orig = Math.random, runs = [];
      const snapshot = window.__snap || (window.__snap = JSON.stringify(G));   // every run of every cell starts from the same booted shift (taken once: a cell's last deferred catch-up must not leak into the next cell's start - injury safeguards)
      for (let r = 0; r < RUNS; r++) {
        localStorage.setItem('tenacity.save.v1', snapshot); St.loadGame();
        let s = 424243 + r * 7919; Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
        let S = G.ship; const gc = P.PACE.encounter.bc;
        S.faults = {};
        if (start === 'worst') {
          Object.assign(S, { hull: gc.minHull, shields: 20, power: gc.minPower }); S.torps = gc.minTorps;
          const sys = Object.keys(DA.SYSTEMS), k = sys[Math.floor(Math.random() * sys.length)]; S.faults[k] = { sev: 'med', cost: 2, t: 0, escT: 0 };
          for (const a of Object.values(G.ab)) { a.cd = Math.random() * (a.cdMax || 60) * 1.5; a.active = 0; }
        } else if (start === 'gated') {   // battle-sim's START=gated legal mix: 60% well kept, 40% mid-voyage (passes the gate)
          const R = (a, b) => a + Math.random() * (b - a), fresh = Math.random() < 0.6;
          Object.assign(S, fresh ? { hull: R(85, 100), shields: R(60, 100), power: R(60, 100) } : { hull: R(gc.minHull, Math.max(85, gc.minHull)), shields: R(30, 80), power: R(gc.minPower, Math.max(80, gc.minPower)) }); S.torps = fresh ? 2 + Math.floor(Math.random() * 7) : 2 + Math.floor(Math.random() * 5);
          const sys = Object.keys(DA.SYSTEMS); for (const [pr, sev] of [[fresh ? 0.25 : 0.5, 'low'], [fresh ? 0.1 : 0.35, 'med']]) if (Math.random() < pr) { const k = sys[Math.floor(Math.random() * sys.length)]; if (!S.faults[k]) S.faults[k] = { sev, cost: sev === 'med' ? 2 : 1, t: 0, escT: 0 }; }
          for (const a of Object.values(G.ab)) { a.cd = Math.random() * (a.cdMax || 60) * (fresh ? 1 : 1.5); a.active = 0; }
        } else { Object.assign(S, { hull: 100, shields: 100, power: 100 }); S.torps = 4; for (const a of Object.values(G.ab)) { a.cd = 0; a.active = 0; } }
        G.sp.battle = null; G.sp.awayDefer = 0; G.sp.evasiveT = 0; G.sp.travel = null; G.sp.travelPaused = false; G.sp.lastBattleT = -1e9; G.sp.preScanned = false;
        if (G.prog.med) { G.prog.med.inj = []; G.prog.med.hushUntil = 0; }
        P.PACE_RT.offline = false; P.PACE_RT.idleT = 0; P.PACE_RT.sessionT = 1e5; P.PACE_RT.hidden = false;
        G.lt.mode = 'idle'; G.lt.repairSys = null; G.lt.intent = null; G.lt.path = null;
        const st0 = { ...G.stats }, hull0 = S.hull, inj0 = 0;
        BT.startBattle('debug', { enemy: type });
        const live = G.sp.battle ? G.sp.battle.live : undefined;
        let seenLog = new WeakSet(G.log); let hits = 0, steps = 0, looked = false, cu = null, endHull = null, endStats = null, injEnd = 0;
        const scan = () => { for (let i = G.log.length - 1; i >= 0; i--) { const e = G.log[i]; if (seenLog.has(e)) break; seenLog.add(e); if (/the hull takes/.test(e.msg || '')) hits++; } };
        const lookAway = () => {
          looked = true; P.PACE_RT.hidden = true;   // frozen: no steps while hidden (app.paused)
          if (mode === 'hide31') cu = sim.catchUp(31);
          else if (mode === 'hide300') cu = sim.catchUp(300);
          else if (mode === 'reopen') { St.saveGame(); St.loadGame(); S = G.ship; seenLog = new WeakSet(G.log); P.PACE_RT.sessionT = 0; cu = sim.catchUp(120); P.PACE_RT.sessionT = 0; }
          P.PACE_RT.hidden = false; P.playerInput(); scan();
        };
        const t0 = S.elapsed;
        while (G.sp.battle && steps < 12000) {
          if (!looked && mode !== 'watch' && S.elapsed - t0 >= IN) { lookAway(); if (!G.sp.battle) break; }
          P.PACE_RT.idleT = 0; sim.stepSim(0.05); steps++; scan();
        }
        scan(); endHull = S.hull; endStats = { ...G.stats }; injEnd = (G.prog.med.inj || []).length;
        let deferredRan = null;
        if (!NODEFER && G.sp.awayDefer > 0 && !G.sp.battle) { const sec = G.sp.awayDefer; G.sp.awayDefer = 0; const r2 = sim.catchUp(sec); deferredRan = { sec, battles: r2.battles, hull: Math.round(G.ship.hull) }; }
        const out = endStats.tows > st0.tows ? 'tow' : endStats.wins > st0.wins ? 'win' : 'disengage';
        runs.push({ out, live, hullLost: Math.max(0, hull0 - (out === 'tow' ? 0 : endHull)), hits, inj: injEnd - inj0 > 0 ? 1 : 0, extraBattles: endStats.battles - st0.battles - 1,
          deferred: !!(cu && cu.deferred), resolvedOffline: !!(cu && !cu.deferred && cu.simulated > 0 && looked), deferredRan });
        G.sp.battle = null; S.faults = {};
      }
      Math.random = orig;
      const n = runs.length, pct = f => Math.round(runs.filter(f).length / n * 1000) / 10, avg = k => Math.round(runs.reduce((a, x) => a + x[k], 0) / n * 10) / 10;
      const q = (k, f, sel) => { const a = runs.filter(sel || (() => true)).map(x => x[k]).sort((x, y) => x - y); return a.length ? Math.round(a[Math.floor(f * (a.length - 1))] * 10) / 10 : null; };
      return { n, winPct: pct(x => x.out === 'win'), disPct: pct(x => x.out === 'disengage'), towPct: pct(x => x.out === 'tow'), hullLostP50: q('hullLost', 0.5), hullLostMean: avg('hullLost'),
        wonHullLostP50: q('hullLost', 0.5, x => x.out === 'win'), hullHits: avg('hits'), injuryPct: pct(x => x.inj), liveFlag: pct(x => x.live === true),
        deferredPct: pct(x => x.deferred), resolvedOfflinePct: pct(x => x.resolvedOffline), extraBattles: runs.reduce((a, x) => a + Math.max(0, x.extraBattles), 0),
        deferredRan: runs.filter(x => x.deferredRan).length };
    }, { type, start, mode, RUNS, IN, NODEFER });
    out.cells[key].secs = Math.round((Date.now() - t0) / 1000);
    console.log(key, JSON.stringify(out.cells[key])); save();
  }
  // REAL page reloads mid-fight (the exit save, then a fresh page boot with the save 2 min old): the same fight must come back live
  if (RELOADS > 0) {
    const rl = [];
    for (let i = 0; i < RELOADS; i++) {
      await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
      const a = await p.evaluate(async (i) => {
        const BT = await import('/js/battle.js'), P = await import('/js/pacing.js'), G = __T.G, S = G.ship;
        document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
        Object.assign(S, { hull: 100, shields: 100, power: 100 }); S.torps = 4; S.faults = {}; G.sp.lastBattleT = -1e9;
        P.PACE_RT.idleT = 0; BT.startBattle('debug', { enemy: i % 2 ? 'galor' : 'jh_battlecruiser' });
        __T.app.paused = false; return null;
      }, i);
      await p.waitForTimeout(1200);
      const pre = await p.evaluate(() => { const B = __T.G.sp.battle; __T.saveGame(); const raw = JSON.parse(localStorage.getItem('tenacity.save.v1')); raw.savedAt = Date.now() - 120000; localStorage.setItem('tenacity.save.v1', JSON.stringify(raw)); window.__noSave = true;
        return B ? { enemy: B.enemies[0].ship, ehull: Math.round(B.enemies[0].hull), hull: Math.round(__T.G.ship.hull), live: B.live, started: B.startedAt } : null; });
      await p.goto(BASE); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
      const post = await p.evaluate(() => { const B = __T.G.sp.battle; return { battle: !!B, enemy: B && B.enemies[0].ship, ehull: B && Math.round(B.enemies[0].hull), hull: Math.round(__T.G.ship.hull), live: B && B.live, started: B && B.startedAt, awayDefer: Math.round(__T.G.sp.awayDefer || 0), reportOpen: !!document.querySelector('#report:not(.hidden), #reportModal:not(.hidden)') }; });
      await p.waitForTimeout(1500);
      const later = await p.evaluate(() => { const B = __T.G.sp.battle; return { battle: !!B, ehull: B && Math.round(B.enemies[0].hull) }; });
      rl.push({ pre, post, later, sameFight: !!(pre && post.battle && post.started === pre.started && post.enemy === pre.enemy && post.hull === pre.hull), progressedLive: !!(later.battle ? later.ehull < post.ehull : true) });
      await p.evaluate(() => { localStorage.clear(); });
    }
    out.reloads = { n: rl.length, sameFight: rl.filter(x => x.sameFight).length, progressedLive: rl.filter(x => x.progressedLive).length, runs: rl };
    console.log('reloads', JSON.stringify({ n: out.reloads.n, sameFight: out.reloads.sameFight, progressedLive: out.reloads.progressedLive }));
  }
  // REAL visibility path (main.js handler, not the in-page emulation): hide the tab mid-fight (document.hidden + visibilitychange),
  // 'come back' 5 min later (Date.now shifted), the fight must still be on (same hull), the catch-up deferred, and the
  // shift report must open by itself once the fight ends.
  if (RELOADS > 0) {
    const vr = [];
    for (const enemy of ['jh_battlecruiser', 'galor']) {
      await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
      const r = await p.evaluate(async (enemy) => {
        const BT = await import('/js/battle.js'), P = await import('/js/pacing.js'), G = __T.G, S = G.ship; window.__noSave = true;
        document.querySelectorAll('.modal:not(.hidden)').forEach(m => { m.hidden = true; });
        Object.assign(S, { hull: 100, shields: 100, power: 100 }); S.torps = 4; S.faults = {}; G.sp.lastBattleT = -1e9; P.PACE_RT.sessionT = 1e5; P.PACE_RT.idleT = 0;
        BT.startBattle('debug', { enemy }); await new Promise(r => setTimeout(r, 1500));
        const sl = ms => new Promise(r => setTimeout(r, ms)), B = G.sp.battle, pre = { hull: S.hull, ehull: B.enemies[0].hull, el: S.elapsed };
        let hid = true; Object.defineProperty(document, 'hidden', { configurable: true, get: () => hid }); document.dispatchEvent(new Event('visibilitychange'));
        await sl(400); const frozen = { hull: S.hull, ehull: B.enemies[0].hull, el: S.elapsed };
        const now0 = Date.now, shift = 300000; Date.now = () => now0() + shift; hid = false; document.dispatchEvent(new Event('visibilitychange'));
        const back = { battle: !!G.sp.battle, same: G.sp.battle === B || (G.sp.battle && G.sp.battle.startedAt === B.startedAt), hull: S.hull, ehull: G.sp.battle && G.sp.battle.enemies[0].hull, awayDefer: Math.round(G.sp.awayDefer || 0), reportOpen: !document.querySelector('#report').hidden };
        __T.app.timeScale = 4; let t = 0; while (G.sp.battle && t < 60000) { P.playerInput(); await sl(250); t += 250; }
        await sl(600); const after = { battle: !!G.sp.battle, awayDefer: G.sp.awayDefer, reportOpen: !document.querySelector('#report').hidden, reportHead: (document.querySelector('#reportBody') || {}).innerText ? document.querySelector('#reportBody').innerText.slice(0, 140) : '' };
        Date.now = now0; __T.app.timeScale = 1;
        return { enemy, pre, frozen, back, after, ok: frozen.el === pre.el && back.battle && back.same && Math.abs(back.hull - frozen.hull) < 0.01 && back.awayDefer >= 299 && !back.reportOpen && !after.battle && after.awayDefer === 0 && after.reportOpen };
      }, enemy);
      vr.push(r); console.log('realvis', JSON.stringify(r));
    }
    out.realVisibility = vr;
  }
  save(); console.log('ERRORS', errs.length, errs.slice(0, 3));
  await b.close();
})();
