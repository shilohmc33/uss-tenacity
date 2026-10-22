// Wrap-up smoke: deck tour (every crew deck, ambient crew running ~3 s, Lt walks a short path) + one Galor battle watched
// for ~10 s, at 390x844, 844x390 and 1280x800. Zero console errors expected. -> shots/smoke-wrapup.json (+ a deck shot per size)
const L = require('/workspace/playtest-scripts/lib.js'); const fs = require('fs');
const URL = process.argv[2] || 'http://127.0.0.1:8765/';
(async () => {
  const b = await L.launch(); const rep = { url: URL, vp: {}, errors: {} };
  for (const [vp, w, h, m] of [['390x844', 390, 844, 1], ['844x390', 844, 390, 1], ['1280x800', 1280, 800, 0]]) {
    const errs = []; const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: !!m, hasTouch: !!m }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message)); p.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
    await p.goto(URL + '?reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(800);
    await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); });
    const R = rep.vp[vp] = { decks: {} };
    for (const deck of ['bridge', 'engineering', 'medical', 'berthing', 'lounge']) {
      await p.evaluate(deck => { const Lt = __T.G.lt; Lt.deck = deck; Lt.lift = null; Lt.x = 0.5; Lt.y = 0.66; Lt.mode = 'idle'; Lt.path = null; __T.cam.snap = true; __T.cam.manualT = 0; }, deck);
      await L.sleep(3000);
      R.decks[deck] = await p.evaluate(deck => __T.ambient.filter(a => a.deck === deck).map(a => `${a.occId}:${a.who}:${a.mode}`), deck);
      if (deck === 'engineering') await p.screenshot({ path: `shots/smoke-wrapup-engineering-${vp}.png` });
    }
    R.battle = await p.evaluate(async () => { const BT = await import('/js/battle.js'); BT.startBattle('debug', { enemy: 'galor' }); const B = __T.G.sp.battle; return B && B.enemies ? B.enemies.map(e => e.ship) : 'legacy'; });
    await p.waitForSelector('#watchBattle', { state: 'visible', timeout: 5000 }); await p.click('#watchBattle'); await L.sleep(10000);
    R.battleAfter = await p.evaluate(() => { const B = __T.G.sp.battle; return B ? { over: !!B.over, hull: Math.round(__T.G.ship.hull) } : 'ended'; });
    await p.screenshot({ path: `shots/smoke-wrapup-battle-${vp}.png` });
    rep.errors[vp] = errs; await ctx.close();
  }
  fs.writeFileSync('shots/smoke-wrapup.json', JSON.stringify(rep, null, 1));
  const n = Object.values(rep.errors).flat().length; console.log(JSON.stringify(rep.errors)); console.log(n ? 'SMOKE FAIL ' + n : 'SMOKE PASS'); await b.close();
})();
