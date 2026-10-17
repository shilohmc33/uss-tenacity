// NEW-06 verification: real catchUp() runs, fresh and "left mid-crisis" starts, 2 h and 3.5 h.
// NODE_PATH=/workspace/pwtools/node_modules node tools/pt02-offline-sim.js [base] [runs] [outJson]
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/', RUNS = +(process.argv[3] || 6), OUT = process.argv[4];
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(BASE + '?reset=1');
  await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 30000 });
  const rows = [];
  for (const start of ['fresh', 'crisis']) for (const hrs of [2, 3.5]) for (let i = 0; i < RUNS; i++) {
    rows.push(await p.evaluate(async ([start, hrs]) => {
      window.__noSave = true; __T.app.paused = true;
      const St = await import('/js/state.js'), F = await import('/js/faults.js'), sim = await import('/js/sim.js');
      St.resetState(); const G = St.G;
      if (start === 'crisis') {   // walked away with a mess: 5 faults, low power, battered hull
        G.ship.parts = 3; for (const [k, s] of [['eps', 'med'], ['coolant', 'med'], ['shields', 'low'], ['loader', 'crit'], ['transporter', 'low']]) F.spawnFault('ambient', k, s);
        G.ship.power = 6; G.ship.hull = 34;
      }
      // track minima through property setters (works on any build)
      const S = G.ship; let hull = S.hull, power = S.power, minHull = hull, minPower = power;
      Object.defineProperty(S, 'hull', { get: () => hull, set: v => { hull = v; if (v < minHull) minHull = v; }, enumerable: true, configurable: true });
      Object.defineProperty(S, 'power', { get: () => power, set: v => { power = v; if (v < minPower) minPower = v; }, enumerable: true, configurable: true });
      const power0 = S.power;
      const r = sim.catchUp(hrs * 3600);   // minPower: catchUp's own per-step sample (both builds); minHull: catchUp's (after) or the setter (before)
      const noise = r.highlights.filter(e => /seconds left|pallet|^Deck task/i.test(e.msg)).map(e => e.msg.slice(0, 60));
      return { start, hrs, faults: r.faults, minPower: +r.minPower.toFixed(1), minHull: +(r.minHull != null ? r.minHull : minHull).toFixed(1), startPower: +power0.toFixed(1), endHull: Math.round(hull), endPower: Math.round(power), battles: r.battles, tows: r.tows, crewFixes: r.crewFixes, legs: r.legs, rep: r.d.rep, parts: r.d.parts, highlights: r.highlights.length, noise };
    }, [start, hrs]));
    console.log(JSON.stringify(rows[rows.length - 1]));
  }
  const groups = {};
  for (const r of rows) { const k = `${r.start} ${r.hrs}h`; (groups[k] = groups[k] || []).push(r); }
  const summary = {};
  for (const [k, g] of Object.entries(groups)) {
    const avg = f => +(g.reduce((a, r) => a + r[f], 0) / g.length).toFixed(1), mn = f => Math.min(...g.map(r => r[f])), mx = f => Math.max(...g.map(r => r[f]));
    summary[k] = { n: g.length, faultsAvg: avg('faults'), faultsMax: mx('faults'), minPower: mn('minPower'), minHull: mn('minHull'), endHullAvg: avg('endHull'), tows: g.reduce((a, r) => a + r.tows, 0), battlesAvg: avg('battles'), noiseLines: g.reduce((a, r) => a + r.noise.length, 0), repAvg: avg('rep') };
  }
  console.log('SUMMARY', JSON.stringify(summary, null, 1), 'errors', JSON.stringify(errs));
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ base: BASE, summary, rows, errs }, null, 1));
  await b.close();
})();
