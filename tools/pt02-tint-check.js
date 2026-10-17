// NEW-08: mean colour of the Lt's opaque sprite pixels with and without each deck's DECK_LIGHT tint (game code path)
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'));
  const r = await p.evaluate(async () => {
    const R = await import('/js/render/deck.js'), D = await import('/js/data.js'), A = await import('/js/assets.js');
    const f = D.CHAR_FRAMES.lt.walk.down[1], img = A.IMG[f.img], out = {};
    const mean = (src, sx, sy) => { const c = document.createElement('canvas'); c.width = f.w; c.height = f.h; const x = c.getContext('2d'); x.drawImage(src, sx, sy, f.w, f.h, 0, 0, f.w, f.h); const d = x.getImageData(0, 0, f.w, f.h).data; let s = [0, 0, 0], n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; n++; } return s.map(v => +(v / n).toFixed(1)); };
    out.untinted = mean(img, f.x, f.y);
    for (const dk of Object.keys(D.DECK_LIGHT)) { __T.G.lt.deck = dk; const t = R.tintedFrame(img, f); out[dk] = mean(t, 0, 0); }
    __T.G.lt.deck = 'engineering';
    return out;
  });
  console.log(JSON.stringify(r), 'errors', JSON.stringify(errs)); await b.close();
})();
