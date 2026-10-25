const { chromium } = require('playwright-core');
const tag = process.argv[2];
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const out = {};
  for (const [w, h] of [[390, 844], [844, 390], [1280, 800]]) {
    const p = await (await (async () => { const cx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1.2 }); await cx.addInitScript(() => { window.__TENACITY_SKIP_NAME = true; window.__TENACITY_SKIP_BG = true; window.__TENACITY_NO_IDLE = true; }); /* v18: skip the name prompt; no idle pause */ return cx; })()).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto('http://127.0.0.1:8765/?reset=1');
    await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 30000 });
    await p.evaluate(() => { window.__noSave = true; });
    if (w === 1280) await p.click('#btnFull');
    await p.waitForTimeout(400);
    const res = {};
    for (const s of ['orders', 'duty', 'crew', 'log']) {
      await p.evaluate(s => { document.body.classList.remove('sheet-open', 'sheet-orders', 'sheet-duty', 'sheet-crew', 'sheet-log'); document.querySelector(`[data-sheet="${s}"]`).click(); }, s);
      await p.waitForTimeout(450);
      await p.evaluate(() => { document.querySelector('#panels').scrollTop = 160; });
      await p.waitForTimeout(200);
      res[s] = await p.evaluate(() => {
        const hd = document.querySelector('#panels .sheetHead').getBoundingClientRect(), pn = document.querySelector('#panels').getBoundingClientRect();
        const pts = [[0.15, 0.5], [0.35, 0.5], [0.15, 0.95], [0.35, 0.05]].map(([fx, fy]) => { const el = document.elementFromPoint(hd.left + hd.width * fx, hd.top + hd.height * fy); return !!(el && el.closest('.sheetHead')); });
        return { headTop: Math.round(hd.top - pn.top), covered: pts.every(Boolean), pts, gapAbove: Math.round(hd.top - pn.top) };
      });
      if (s === 'crew') await p.screenshot({ path: `/workspace/tenacity/shots/prog4-crewtitle-${tag}${w === 390 ? '' : '-' + w + 'x' + h}.png` });
    }
    out[`${w}x${h}`] = { res, errs };
    await p.close();
  }
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
