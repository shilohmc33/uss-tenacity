// Ship painted-art regression shots: space view, a Jem'Hadar fighter battle, and a damaged + shield-hit frame
// at 390x844, 844x390, 1280x800 -> shots/shipart-<label>-{space,battle,damaged}-<size>.png (+ draw info json).
// NODE_PATH=/workspace/pwtools/node_modules node tools/shipart-shots.js <before|after> [base]
const { chromium } = require('playwright-core');
const fs = require('fs');
const LABEL = process.argv[2] || 'after', BASE = process.argv[3] || 'http://127.0.0.1:8765/';
const OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const rep = { errors: {}, info: {} };
  for (const [w, h, m] of [[390, 844, true], [844, 390, true], [1280, 800, false]]) {
    const tag = `${w}x${h}`, errs = [];
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: m, hasTouch: m });
    await c.addInitScript(() => { window.__TENACITY_TEST_DEATHS = true; });
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
    await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(600);
    await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); });
    await p.evaluate(() => document.querySelector('#btnView').click()); await sleep(900);
    const shot = n => p.screenshot({ path: OUT + `shipart-${LABEL}-${n}-${tag}.png` });
    await shot('space');
    rep.info['loaded@' + tag] = await p.evaluate(async () => { const A = await import('/js/assets.js'); return { ten: !!A.IMG['ship-tenacity'], jem: !!A.IMG['ship-jemhadar'] }; });
    await p.evaluate(async () => { let s = 4242; Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      const BT = await import('/js/battle.js'), G = __T.G; G.ship.torps = 2; G.ship.shields = 80; for (const a of Object.values(G.ab)) a.cd = 30;
      BT.startBattle('debug', { enemy: 'jh_fighter' }); const B = G.sp.battle; if (B && B.enemies) for (const e of B.enemies) { e.max = (e.max || 60) * 20; e.hull = e.max; } });   // keep the fighter alive for the shots
    await p.waitForSelector('#watchBattle', { state: 'visible', timeout: 3000 }).then(() => p.click('#watchBattle')).catch(() => {});
    await sleep(2600); await p.evaluate(() => { __T.app.paused = true; }); await shot('battle');
    await p.evaluate(async () => { const BT = await import('/js/battle.js'), G = __T.G, B = G.sp.battle;
      G.ship.hull = 25; if (B && B.enemies) for (const e of B.enemies) e.hull = Math.round(e.max * 0.2);
      BT.SFX.shieldFlare = { t: 0.1, dur: 0.65 }; if (B && B.enemies) BT.SFX.anim[B.enemies[0].id] = { state: 'shieldsHit', t: 0 };
      __T.app.paused = false; });
    await p.evaluate(() => new Promise(r => { let n = 0; const f = () => (++n < 30 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }));
    await p.evaluate(() => { __T.app.paused = true; }); await sleep(150);
    rep.info['damaged@' + tag] = await p.evaluate(() => { const B = __T.G.sp.battle; return { hull: Math.round(__T.G.ship.hull), enemyPct: B && B.enemies ? Math.round(B.enemies[0].hull / B.enemies[0].max * 100) : null }; });
    await shot('damaged');
    // direct drawShip check: painted vs vector, damaged pixels darker than healthy, enemy mirror flips the image
    if (tag === '1280x800') rep.info.direct = await p.evaluate(async () => { const RS = await import('/js/render/ships.js');
      const cv = document.createElement('canvas'); cv.width = 500; cv.height = 300; const x = cv.getContext('2d');
      const lum = () => { const d = x.getImageData(0, 0, 500, 300).data; let s = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { s += d[i] + d[i + 1] + d[i + 2]; n++; } return n ? Math.round(s / n) : 0; };
      const out = {};
      for (const [id, asp] of [['tenacity', 3.5], ['jh_fighter', 2.1], ['galor', 2.6], ['jh_battlecruiser', 2.3]]) {
        x.clearRect(0, 0, 500, 300); const r = RS.drawShip(x, id, 25, 50, 450, 450 / asp, { pct: 100 }); const L100 = lum();
        x.clearRect(0, 0, 500, 300); RS.drawShip(x, id, 25, 50, 450, 450 / asp, { pct: 20 }); const L20 = lum();
        out[id] = { ret: r, lum100: L100, lum20: L20 }; }
      return out; });
    rep.errors[tag] = errs; await c.close();
  }
  fs.writeFileSync(OUT + `shipart-${LABEL}.json`, JSON.stringify(rep, null, 1));
  console.log(JSON.stringify(rep));
  await b.close();
})();
