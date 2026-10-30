const { chromium } = require('playwright-core');
const path = require('path');
const OUT = path.resolve(__dirname, '..', 'shots') + '/';
try { require('fs').mkdirSync(OUT, { recursive: true }); } catch (e) {}
(async () => { const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const out = {};
for (const [w, h, m] of [[390, 844, 1], [844, 390, 1], [1280, 800, 0]]) { const tag = w + 'x' + h;
const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: !!m, hasTouch: !!m, deviceScaleFactor: m ? 2 : 1 })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
await p.goto('http://127.0.0.1:8765/?reset=1&debug=1&walk=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
const r = await p.evaluate(async () => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
  const P = await import('/js/path.js'), { DECKS } = await import('/js/data.js'); const lf = DECKS.berthing.lift, Lt = __T.G.lt; Lt.deck = 'berthing'; Lt.lift = null; Lt.x = 0.45; Lt.y = 0.6; Lt.mode = 'idle'; __T.cam.snap = true;
  return { walkM: P.isWalkable('berthing', lf.mx, lf.my), path: !!P.findPath('berthing', 0.45, 0.6, lf.mx, lf.my) }; });
await new Promise(r => setTimeout(r, 800));
await p.evaluate(async () => { const { DECKS } = await import('/js/data.js'); const lf = DECKS.berthing.lift, Lt = __T.G.lt; Lt.x = lf.mx; Lt.y = lf.my + 0.01; __T.cam.snap = true; });
await new Promise(r => setTimeout(r, 1200)); if (w === 1280) await p.screenshot({ path: OUT + 'p22-berthing-lift-1280x800.png' });
out[tag] = { ...r, errs }; await p.close(); }
console.log(JSON.stringify(out)); await b.close(); })();
