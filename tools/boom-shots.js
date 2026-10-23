// Ship damaged / destroyed shots: Galor + battlecruiser damaged (hull 30%) at 1280x800; destroyed ~2 s after the kill for the
// fighter, Galor, battlecruiser at 1280x800 and the battlecruiser at 390x844.
const { chromium } = require('playwright-core');
const BASE = 'http://localhost:8765/', OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const errs = [];
  const runs = process.env.RUNS ? process.env.RUNS.split(' ').map(r => { const [s, wh] = r.split('@'), [w, h] = wh.split('x'); return [s, +w, +h]; })   // RUNS='galor@1280x800 freighter@390x844'
    : [['jh_fighter', 1280, 800], ['galor', 1280, 800], ['jh_battlecruiser', 1280, 800], ['jh_battlecruiser', 390, 844]];   // damaged + destroyed (~2 s after the kill)
  for (const [ship, w, h] of runs.filter(r => !process.env.ONLY || process.env.ONLY === `${r[0]}@${r[1]}`)) {   // ONLY=galor@1280 for one run
    const c = await br.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage();
    p.on('console', m => { if (m.type() === 'error') errs.push(`${ship}@${w}: ${m.text()}`); }); p.on('pageerror', e => errs.push(`${ship}@${w}: ${e.message}`));
    await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(500);
    await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); document.querySelector('#btnView').click(); });
    await sleep(700);
    await p.evaluate(async s => { const BT = await import('/js/battle.js'); for (const a of Object.values(__T.G.ab)) a.cd = 30; BT.startBattle('debug', { enemy: s }); }, ship);
    await sleep(2200); await p.evaluate(() => { const b = document.querySelector('#bcCard'); if (b) b.hidden = true; document.querySelectorAll('#toasts > *').forEach(t => t.remove()); });
    const tag = `${ship}-%s-${w}x${h}`, snap = async ph => { await p.evaluate(() => { __T.app.paused = true; }); await p.screenshot({ path: OUT + 'boom-' + tag.replace('%s', ph) + '.png' }); await p.evaluate(() => { __T.app.paused = false; }); };
    if (ship !== 'jh_fighter') {   // damaged: hull to 30%, let the painted damaged cell crossfade in
      await p.evaluate(() => { const B = __T.G.sp.battle, E = B.enemies[0]; E.hull = Math.round(E.max * 0.3); });
      await sleep(1200); await snap('damaged');
    }
    await p.evaluate(async () => { const BT = await import('/js/battle.js'); BT.debugKillEnemy(); });
    await sleep(2000); await snap('destroyed');
    await sleep(2500);
    const end = await p.evaluate(() => ({ battle: !!__T.G.sp.battle }));
    console.log(ship, w, 'battle cleared:', !end.battle);
    await c.close();
  }
  await br.close(); console.log(errs.length ? 'ERRORS\n' + errs.join('\n') : 'boom-shots: 0 console errors');
})();
