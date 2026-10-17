// NEW-07 verification: minutes of ACTIVE play (player present, no battles) from a full bar to "fumes" (15) and to 0.
// NODE_PATH=/workspace/pwtools/node_modules node tools/pt02-energy-sim.js [base]
const { chromium } = require('playwright-core');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '?reset=1');
  await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 30000 });
  const out = {};
  for (const scen of ['console', 'mix']) {
    out[scen] = await p.evaluate(async scen => {
      window.__noSave = true; __T.app.paused = true;
      const St = await import('/js/state.js'), sim = await import('/js/sim.js'), F = await import('/js/faults.js'), P = await import('/js/pacing.js');
      St.resetState(); const G = St.G, S = G.ship; S.energy = 100; S.parts = 20; G.sp.cap.decideT = 1e9;
      // active player who never rests: console = man the warp core; mix = rotate core/torpedo bay/shields/locker
      // every 90 s and repair every fault the moment it appears (ambient faults on, ~every 5-9 min)
      const rota = scen === 'console' ? ['core'] : ['core', 'torpbay', 'shield', 'locker'];
      let t = 0, fumes = null, zero = null, idx = 0, nextSwap = 0, modeT = {};
      while (t < 3 * 3600 && zero === null) {
        P.playerInput(); G.sp.lastBattleT = S.elapsed;   // present, and no battles
        S.parts = 20;
        const fk = Object.keys(S.faults)[0];
        if (fk && G.lt.mode !== 'repair' && !(G.lt.mode === 'walk' && G.lt.intent && G.lt.intent.kind === 'repair')) __T.sendRepair(fk);
        else if (!fk && t >= nextSwap && G.lt.mode !== 'walk') { __T.sendUse(rota[idx++ % rota.length], { force: true }); nextSwap = t + 90; }
        sim.stepSim(0.1); t += 0.1;
        modeT[G.lt.mode] = (modeT[G.lt.mode] || 0) + 0.1;
        if (fumes === null && S.energy <= 15) fumes = t;
        if (S.energy <= 0) zero = t;
      }
      const tot = Object.values(modeT).reduce((a, b) => a + b, 0);
      return { fumesMin: fumes && +(fumes / 60).toFixed(1), zeroMin: zero && +(zero / 60).toFixed(1), repairs: G.stats.repairs, timeShare: Object.fromEntries(Object.entries(modeT).map(([k, v]) => [k, Math.round(v / tot * 100) + '%'])) };
    }, scen);
  }
  console.log(BASE, JSON.stringify(out), 'errors', JSON.stringify(errs));
  await b.close();
})();
