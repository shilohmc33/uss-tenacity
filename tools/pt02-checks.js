// small numeric checks: first-leg length (NEW first-session), manual pan hold (BUG-18), BUG-17 in-flight torps on reload
const { chromium } = require('playwright-core');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const boot = async q => { await p.goto(BASE + q); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 30000 }); await sleep(300); };
  const out = { firstLegs: [] };
  for (let i = 0; i < 5; i++) {
    await boot('?reset=1');
    out.firstLegs.push(await p.evaluate(async () => { __T.app.paused = true; const sim = await import('/js/sim.js'); for (let i = 0; i < 400 && !__T.G.sp.travel; i++) sim.stepSim(0.05); const t = __T.G.sp.travel; return t ? +(t.dur / 60).toFixed(1) : null; }));
  }
  // second leg is back to normal length
  out.secondLeg = await p.evaluate(async () => { const sim = await import('/js/sim.js'), V = await import('/js/voyage.js'); V.arriveAtDest(); __T.G.sp.cap.decideT = 0.1; __T.G.sp.escortDone = true; for (let i = 0; i < 4000 && !__T.G.sp.travel; i++) sim.stepSim(0.05); const t = __T.G.sp.travel; return t ? { dest: t.dest, min: +(t.dur / 60).toFixed(1) } : null; });
  // manual pan hold
  await boot('?reset=1');
  out.pan = await p.evaluate(async () => { const R = await import('/js/render/deck.js'); const c = __T.cam, x0 = c.x; R.panBy(-150, 0); const x1 = c.x; await new Promise(r => setTimeout(r, 5000)); return { moved: Math.round(x1 - x0), after5s: Math.round(c.x - x0) }; });
  // BUG-17: fire a spread, save immediately, reload: damage lands
  await boot('?debug=1&reset=1');
  out.torps = await p.evaluate(async () => { __D.Battle(); const G = __T.G; G.ship.torps = 4; G.sp.battle.volleyT = 99; G.ab.spread.cd = 0; await new Promise(r => setTimeout(r, 300)); return { hullBefore: G.sp.battle && G.sp.battle.hull, inflight: G.sp.battle && G.sp.battle.inflight, torps: G.ship.torps }; });
  await p.evaluate(() => { __T.saveGame(); window.__noSave = true; });
  await p.goto(BASE + '?debug=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'));
  out.torpsAfterReload = await p.evaluate(() => ({ hull: __T.G.sp.battle ? __T.G.sp.battle.hull : 'battle over', inflight: __T.G.sp.battle && __T.G.sp.battle.inflight }));
  console.log(BASE, JSON.stringify(out), 'errors', JSON.stringify(errs));
  await b.close();
})();
