// RETIRED in v18 (no offline quests, notes/2026-10-25-no-offline-quests-plan.md): this tool exercised the removed offline catch-up /
// night crew / Shift Report (sim.catchUp, PACE_RT.offline, #report). The v18 behaviour is covered by tools/offline-check.js.
if (!process.env.RUN_RETIRED) { console.log('RETIRED in v18 (offline catch-up removed): see tools/offline-check.js'); process.exit(0); }
// Headless idle/offline pacing sim (adapted from playtest-scripts/10-longsim.js).
// Usage: NODE_PATH=/workspace/pwtools/node_modules node tools/pacing-sim.js [baseUrl] [runsPerPosture] [outJson]
const { chromium } = require('playwright-core');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const RUNS = +(process.argv[3] || 4);
const OUT = process.argv[4];
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const boot = async () => { await p.goto(BASE + '?reset=1'); for (let i = 0; i < 200; i++) { if (await p.evaluate(() => !!window.__T && document.querySelector('#loading').classList.contains('done'))) break; await new Promise(r => setTimeout(r, 150)); } };
  const res = { live2h: [], offline3h: [], errs };
  // A) 2h of live stepSim per posture (the same loop catch-up uses)
  for (const scen of ['idle', 'bunk', 'core']) for (let run = 0; run < RUNS; run++) {
    await boot();
    res.live2h.push(await p.evaluate(async scen => {
      window.__noSave = true; __T.app.paused = true;
      const G = __T.G, sim = await import('/js/sim.js');
      if (scen !== 'idle') { __T.sendUse(scen); for (let i = 0; i < 4000 && G.lt.mode !== 'use'; i++) sim.stepSim(0.05); }
      const legDur = []; let curLeg = null;
      let pz = 0, plow = 0, psum = 0, tz = 0, minHull = 100, firstBattle = null, n = 0, b0 = G.stats.battles;
      const dests = {};
      for (let t = 0; t < 7200; t += 0.25) {
        sim.stepSim(0.25); n++;
        const S = G.ship; psum += S.power; if (S.power < 1) pz++; if (S.power < 10) plow++; if (S.torps === 0) tz++; if (S.hull < minHull) minHull = S.hull;
        if (firstBattle === null && G.stats.battles > b0) firstBattle = Math.round(t);
        const tr = G.sp.travel; if (tr && tr !== curLeg) { curLeg = tr; legDur.push(tr.dur); dests[tr.dest] = (dests[tr.dest] || 0) + 1; }
        if (!tr) curLeg = null;
      }
      const S = G.ship;
      return { scen, battles: G.stats.battles, wins: G.stats.wins, tows: G.stats.tows, legs: G.stats.legs, events: G.stats.events, repairs: G.stats.repairs,
        nightRepairs: G.stats.nightFixes || 0, powerZeroPct: +(pz / n * 100).toFixed(1), powerUnder10Pct: +(plow / n * 100).toFixed(1), meanPower: Math.round(psum / n),
        torpZeroPct: Math.round(tz / n * 100), minHull: Math.round(minHull), endHull: Math.round(S.hull), endPower: Math.round(S.power), endFaults: Object.keys(S.faults).length,
        torps: S.torps, parts: S.parts, rep: G.sp.rep, firstBattleS: firstBattle, legMin: legDur.length ? +(Math.min(...legDur) / 60).toFixed(1) : null, legMax: legDur.length ? +(Math.max(...legDur) / 60).toFixed(1) : null,
        diplo: ['earth', 'qonos', 'romulus', 'vulcan'].reduce((a, k) => a + (dests[k] || 0), 0), ds9: dests.ds9 || 0 };
    }, scen));
    console.log(JSON.stringify(res.live2h[res.live2h.length - 1]));
  }
  // B) 3h offline through the real catchUp() (what the Shift Report shows)
  for (let run = 0; run < RUNS * 2; run++) {
    await boot();
    res.offline3h.push(await p.evaluate(async run => {
      window.__noSave = true; __T.app.paused = true;
      const G = __T.G; if (run % 2) { __T.sendUse('bunk'); const sim = await import('/js/sim.js'); for (let i = 0; i < 4000 && G.lt.mode !== 'use'; i++) sim.stepSim(0.05); }
      const t0 = performance.now(); const r = __T.catchUp(3 * 3600); const ms = Math.round(performance.now() - t0);
      const S = G.ship;
      return { posture: run % 2 ? 'bunk' : 'idle', ms, simulatedH: +(r.simulated / 3600).toFixed(2), legs: r.legs, events: r.events, battles: r.battles, wins: r.wins, tows: r.tows, repairs: r.repairs, crewFixes: r.crewFixes,
        dHull: Math.round(r.d.hull), dParts: r.d.parts, dTorps: r.d.torps, dRep: r.d.rep, faultsAwaiting: r.faults, endPower: Math.round(S.power), endHull: Math.round(S.hull), minPower: r.minPower != null ? Math.round(r.minPower) : null, powerZeroMin: r.powerZeroS != null ? +(r.powerZeroS / 60).toFixed(1) : null,
        reportText: document.querySelector('#reportBody') ? null : null };
    }, run));
    console.log(JSON.stringify(res.offline3h[res.offline3h.length - 1]));
  }
  const avg = (arr, k) => { const v = arr.map(r => r[k]).filter(x => typeof x === 'number'); return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null; };
  const summary = {};
  for (const scen of ['idle', 'bunk', 'core']) { const a = res.live2h.filter(r => r.scen === scen); summary['2h_' + scen] = Object.fromEntries(['battles', 'wins', 'tows', 'legs', 'events', 'powerZeroPct', 'powerUnder10Pct', 'meanPower', 'torpZeroPct', 'endHull', 'endFaults', 'diplo', 'firstBattleS', 'nightRepairs', 'minHull'].map(k => [k, avg(a, k)])); summary['2h_' + scen].legRangeMin = [Math.min(...a.map(r => r.legMin)), Math.max(...a.map(r => r.legMax))]; }
  summary.offline3h = Object.fromEntries(['simulatedH', 'legs', 'events', 'battles', 'wins', 'tows', 'repairs', 'crewFixes', 'dHull', 'dRep', 'faultsAwaiting', 'endPower', 'endHull', 'minPower', 'powerZeroMin', 'ms'].map(k => [k, avg(res.offline3h, k)]));
  res.summary = summary;
  console.log('SUMMARY', JSON.stringify(summary, null, 1)); console.log('ERRORS', JSON.stringify(errs));
  if (OUT) require('fs').writeFileSync(OUT, JSON.stringify(res, null, 1));
  await b.close();
})();
