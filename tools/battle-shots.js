const { chromium } = require('playwright-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errs = [];
  for (const [w, h, m, tag] of [[390, 844, true, 'phone'], [1280, 800, false, 'desk']]) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: m, hasTouch: m });
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
    await p.goto('http://localhost:8765/?debug=1&reset=1'); await sleep(2500);
    await p.screenshot({ path: `/workspace/tenacity/shots/${tag}_00_initial.png` });
    await p.evaluate(() => { __T.G.ship.torps = 1; __T.G.ab.spread.cd = 99; __D.Battle(); });
    await p.click('#watchBattle');
    for (let i = 0; i < 4; i++) { await sleep(1100); await p.screenshot({ path: `/workspace/tenacity/shots/${tag}_battle_space_${i}.png` }); }
  }
  console.log('ERR', errs);
  await b.close();
})();
