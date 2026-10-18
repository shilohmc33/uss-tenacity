// Battle groundwork shots: one battle per enemy type at 390x844, 844x390 and 1280x800 -> shots/battle-<type>-<size>.png.
// On a pre-groundwork build pass label 'before' (the type is ignored) -> shots/battle-before-<size>.png.
// Also a formation preview (stubbed multi-ship slots, every ship class on its side) -> shots/battle-roster-<size>.png.
// NODE_PATH=/workspace/pwtools/node_modules node tools/battle-shots2.js [base] [types,comma|before] [outDir]
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const TYPES = (process.argv[3] || 'jh_fighter,galor,jh_battlecruiser').split(',');
const OUT = process.argv[4] || __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SIZES = [[390, 844, true], [844, 390, true], [1280, 800, false]];
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const rep = { errors: {}, shots: [], info: {} };
  for (const [w, h, m] of SIZES) {
    const tag = `${w}x${h}`, errs = [];
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: m, hasTouch: m });
    await c.addInitScript(() => { window.__TENACITY_TEST_DEATHS = true; });
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
    const shoot = async (type, roster) => {
      await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(600);
      const info = await p.evaluate(async ({ type, roster }) => {
        window.__noSave = true; let s = 4242; Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
        const BT = await import('/js/battle.js'), G = __T.G; G.ship.torps = 2; G.ship.shields = 80; for (const a of Object.values(G.ab)) a.cd = 30;   // a mid-fight look, abilities cooling
        BT.startBattle('debug', { enemy: type });
        if (roster) { const SH = await import('/js/ships.js'); SH.previewFormation(G.sp.battle, ['tenacity', 'freighter', 'klingon_bop'], ['jh_fighter', 'galor', 'jh_battlecruiser']); }
        const B = G.sp.battle; return B && B.enemies ? { enemy: B.enemies.map(e => e.ship), allies: B.allies.map(a => a.ship) } : { enemy: 'legacy' };
      }, { type, roster });
      await p.waitForSelector('#watchBattle', { state: 'visible', timeout: 5000 }); await p.click('#watchBattle');
      await sleep(2600); await p.evaluate(() => { __T.app.paused = true; const c = document.querySelector('#bcCard'); if (c) c.hidden = true; });   // encounter weighting: the battlecruiser's red-alert card has its own shots (enc-shots.js) await sleep(150);
      const f = OUT + (type === 'before' ? `battle-before-${tag}.png` : roster ? `battle-roster-${tag}.png` : `battle-${type}-${tag}.png`);
      await p.screenshot({ path: f }); rep.shots.push(f.replace(/^.*shots\//, 'shots/')); rep.info[type + (roster ? '+roster' : '') + '@' + tag] = info;
    };
    for (const t of TYPES) await shoot(t, false);
    if (TYPES[0] !== 'before') await shoot('galor', true);
    rep.errors[tag] = errs; await c.close();
  }
  fs.writeFileSync(OUT + (TYPES[0] === 'before' ? 'battle-shots-before.json' : 'battle-shots-report.json'), JSON.stringify(rep, null, 1));
  console.log(JSON.stringify(rep.errors), rep.shots.length, 'shots');
  await b.close();
})();
