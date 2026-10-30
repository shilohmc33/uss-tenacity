// Medical v2 light A/B: the same crew under the old teal wash (120,255,215 @0.13), the artist's warm white (255,244,228 @0.08)
// and no tint, on the new plate. shots/medv2-tint-<variant>.png (1280x800 @2x crop of the west aisle).   node tools/medv2-tint.js [url]
const L = require('/workspace/playtest-scripts/lib.js');
const path = require('path');
const OUT = path.resolve(__dirname, '..', 'shots') + '/';
try { require('fs').mkdirSync(OUT, { recursive: true }); } catch (e) {}
const URL = process.argv[2] || 'http://127.0.0.1:8765/';
(async () => {
  const b = await L.launch(), errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 }); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message)); p.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
  await p.goto(URL + '?reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(800);
  await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
    const G = __T.G; G.ship.nextFault = 1e9; const Lt = G.lt; Lt.deck = 'medical'; Lt.lift = null; Lt.path = null; Lt.node = null; Lt.x = 0.30; Lt.y = 0.47; Lt.mode = 'idle'; Lt.dir = 'down';
    let k = 0; for (const a of __T.ambient) { if (k < 2) { a.deck = 'medical'; a.x = [0.30, 0.31][k]; a.y = [0.36, 0.58][k]; a.mode = 'dwell'; a.path = null; a.t = 999; a.dir = 'down'; a.spot = { id: 'linger', face: 'down', action: null }; } else a.deck = 'nowhere'; k++; }
    __T.cam.snap = true; __T.cam.manualT = 0; });
  for (const [v, tint, a] of [['old-teal', '120,255,215', 0.13], ['warm-white', '255,244,228', 0.08], ['none', '255,255,255', 0]]) {
    await p.evaluate(async ([tint, a]) => { const D = await import('/js/data.js'); D.DECK_LIGHT.medical.tint = tint; D.DECK_LIGHT.medical.a = a; }, [tint, a]);
    await L.sleep(700);
    const cl = await p.evaluate(() => { const c = __T.cam, rc = document.querySelector('#deck').getBoundingClientRect(), s = c.scale; const X0 = 220, X1 = 380, Y0 = 170, Y1 = 400;
      const sx = rc.left + c.w / 2 + (X0 - c.x) * s, sy = rc.top + c.h / 2 + (Y0 - c.y) * s; const x = Math.max(rc.left, sx), y = Math.max(rc.top, sy);
      return { x, y, width: Math.min((X1 - X0) * s, rc.right - x), height: Math.min((Y1 - Y0) * s, rc.bottom - y) }; });
    await p.screenshot({ path: `${OUT}medv2-tint-${v}.png`, clip: cl }); }
  console.log(errs.length ? 'TINT FAIL' : 'TINT PASS', errs); await b.close();
})();
