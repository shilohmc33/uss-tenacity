// P21 repro: (1) DECK during the hit-stop must not slow the battle; (2) leaving space mid-explosion must not replay it;
// (3) the damaged crossfade must not carry into the next battle of the same class. Runs at 390x844, 844x390, 1280x800.
const { chromium } = require('playwright-core');
const BASE = 'http://localhost:8765/'; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  let fail = 0; const errs = [];
  for (const [w, h] of [[390, 844], [844, 390], [1280, 800]]) {
    const c = await br.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage();
    p.on('console', m => { if (m.type() === 'error') errs.push(`${w}: ${m.text()}`); }); p.on('pageerror', e => errs.push(`${w}: ${e.message}`));
    await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(400);
    await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); document.querySelector('#btnView').click(); });
    const start = s => p.evaluate(async s => { const BT = await import('/js/battle.js'); for (const a of Object.values(__T.G.ab)) a.cd = 30; BT.startBattle('debug', { enemy: s }); const b = document.querySelector('#bcCard'); if (b) b.hidden = true; return __T.G.sp.battle.startedAt; }, s);
    const kill = () => p.evaluate(async () => { const BT = await import('/js/battle.js'); BT.debugKillEnemy(); });
    // (1)
    await sleep(500); await start('galor'); await sleep(1500); await kill();
    const hs = await p.evaluate(() => new Promise(async r => { const F = await import('/js/render/shipfx.js'); const t0 = performance.now(); const f = () => { if (F.fxTimeScale() < 1) { document.querySelector('#btnView').click(); r(performance.now() - t0); } else if (performance.now() - t0 > 3000) r(-1); else requestAnimationFrame(f); }; f(); }));
    const t1 = Date.now(); await p.waitForFunction(() => !__T.G.sp.battle, null, { timeout: 30000 }).catch(() => {}); const won = (Date.now() - t1) / 1000;
    const ts = await p.evaluate(async () => (await import('/js/render/shipfx.js')).fxTimeScale());
    const ok1 = hs > 0 && won < 3 && ts === 1; if (!ok1) fail++;
    // (2)
    await p.evaluate(() => document.querySelector('#btnView').click()); await start('galor'); await sleep(1500); await kill(); await sleep(400);
    await p.evaluate(() => document.querySelector('#btnView').click());   // to deck mid-explosion
    await p.waitForFunction(() => !__T.G.sp.battle, null, { timeout: 30000 }).catch(() => {});
    await p.evaluate(() => document.querySelector('#btnView').click()); await sleep(600);   // back to space
    const replay = await p.evaluate(async () => (await import('/js/render/shipfx.js')).shipFxActive());
    if (replay) fail++;
    // (3)
    const k1 = await start('galor'); await sleep(1500);
    await p.evaluate(() => { const E = __T.G.sp.battle.enemies[0]; E.hull = Math.round(E.max * 0.3); }); await sleep(1000); await kill();
    await p.waitForFunction(() => !__T.G.sp.battle, null, { timeout: 30000 }).catch(() => {});
    const k2 = await start('galor'); await sleep(800);
    const mix = await p.evaluate(async () => { const S = await import('/js/render/ships.js'), B = __T.G.sp.battle, E = B.enemies[0], cv = document.createElement('canvas'); cv.width = 300; cv.height = 120;
      const r = S.drawShip(cv.getContext('2d'), E.ship, 0, 0, 260, 100, { pct: 100, key: B.startedAt + '|' + E.id, t: performance.now() / 1000 }); return r && r.damaged || 0; });
    const ok3 = k1 !== k2 && mix === 0; if (!ok3) fail++;
    console.log(`${w}x${h}: (1) hit-stop at ${Math.round(hs)}ms, DECK, victory in ${won.toFixed(1)}s, timeScale ${ts} ${ok1 ? 'OK' : 'FAIL'} | (2) replay on return: ${replay} ${replay ? 'FAIL' : 'OK'} | (3) next-battle damaged mix ${mix} ${ok3 ? 'OK' : 'FAIL'}`);
    await c.close();
  }
  await br.close(); console.log(errs.length ? 'ERRORS\n' + errs.join('\n') : '0 console errors'); console.log(fail ? `P21 FX REPRO: ${fail} FAIL` : 'P21 FX REPRO: PASS');
})();
