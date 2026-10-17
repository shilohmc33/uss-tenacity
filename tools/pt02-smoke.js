// quick boot smoke at the three viewports: console errors + layout numbers
const { chromium } = require('playwright-core');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [w, h, m] of [[390, 844, 1], [844, 390, 1], [1280, 800, 0]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: !!m, hasTouch: !!m });
    const p = await ctx.newPage(); const errs = [];
    p.on('console', x => { if (['error', 'warning'].includes(x.type())) errs.push(x.text()); }); p.on('pageerror', e => errs.push('pageerror ' + e.message));
    await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 30000 });
    await sleep(800);
    const r = await p.evaluate(() => { const q = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }; return { stage: q('#stage'), stats: q('#stats'), lines: q('#lines'), chips: q('#chipsPlay'), sheets: q('.sheetBtns'), top: q('#topbar'), zoom: __T.cam.zoom, scale: __T.cam.scale }; });
    console.log(w + 'x' + h, JSON.stringify(r), 'errs', JSON.stringify(errs));
    await p.screenshot({ path: '/tmp/smoke-' + w + '.png' });
    await ctx.close();
  }
  await b.close();
})();
