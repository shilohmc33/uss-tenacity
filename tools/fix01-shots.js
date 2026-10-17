// fix01 verification + screenshots -> shots/fix01_*.png, shots/fix01_report.json
// NODE_PATH=/workspace/pwtools/node_modules node tools/fix01-shots.js [base] [origBase]
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/', ORIG = process.argv[3] || 'http://127.0.0.1:8766/';
const OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const issues = [], report = {};
async function mk(b, w, h, mobile, tag) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) issues.push(`[${tag}] console.${m.type()}: ${m.text()}`); });
  p.on('pageerror', e => issues.push(`[${tag}] pageerror: ${e.message}`));
  p.on('requestfailed', r => issues.push(`[${tag}] requestfailed: ${r.url()}`));
  p.on('response', r => { if (r.status() >= 400) issues.push(`[${tag}] HTTP ${r.status()} ${r.url()}`); });
  return p;
}
async function boot(p, base, q) {
  await p.goto(base + q);
  await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 30000 });
  await sleep(400);
}
const calm = p => p.evaluate(() => { const G = __T.G; G.sp.cap.decideT = 1e9; G.ship.nextFault = 1e9; G.sp.ev.nextT = -1; const d = document.querySelector('#debug'); if (d) d.hidden = true; });
async function goDeck(p, deck) {
  await p.evaluate(async d => { if (__T.G.lt.deck !== d) { const C = await import('/js/crew.js'); C.rideLiftTo(d); } }, deck);
  await p.waitForFunction(d => __T.G.lt.deck === d && !__T.G.lt.lift && __T.G.lt.mode !== 'walk', deck, { timeout: 90000 });
}
async function useNode(p, node) {
  await p.evaluate(n => __T.sendUse(n), node);
  await p.waitForFunction(n => __T.G.lt.mode === 'use' && __T.G.lt.node === n, node, { timeout: 90000 });
  await sleep(500);
}
async function walkTo(p, fx, fy) {
  await p.evaluate(([x, y]) => __T.sendTo(x, y, { kind: 'walk' }), [fx, fy]);
  await p.waitForFunction(() => __T.G.lt.mode !== 'walk', null, { timeout: 90000 });
  return p.evaluate(async () => { const P = await import('/js/path.js'); const L = __T.G.lt; return { x: +L.x.toFixed(3), y: +L.y.toFixed(3), onFloor: P.isWalkable(L.deck, L.x, L.y) }; });
}
const measure = p => p.evaluate(() => {
  const sel = { chips: '#chipsPlay .chip', sheetBtns: '.sheetBtns button', seg: '.seg button', view: '#btnView', zoom: '#zoomCtl button', alert: '#alertPill', sheetX: '#sheetClose' };
  const o = {};
  for (const [k, s] of Object.entries(sel)) o[k] = [...document.querySelectorAll(s)].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
  return o;
});
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  let p = await mk(b, 390, 844, true, 'phone');
  await boot(p, BASE, '?debug=1&reset=1&walk=1');
  report.urlAfterReset = p.url();
  await calm(p); await p.evaluate(() => { __T.app.timeScale = 4; });
  const probes = [['engineering', 0.35, 0.63], ['engineering', 0.25, 0.63], ['engineering', 0.32, 0.77], ['lounge', 0.77, 0.40], ['lounge', 0.40, 0.45], ['bridge', 0.16, 0.10], ['berthing', 0.93, 0.62], ['medical', 0.60, 0.84]];
  report.probes = [];
  for (const [d, x, y] of probes) { await goDeck(p, d); const r = await walkTo(p, x, y); report.probes.push({ deck: d, tap: [x, y], stoppedAt: [r.x, r.y], onFloor: r.onFloor }); }
  report.nodes = [];
  for (const n of ['core', 'shield', 'torpbay', 'locker', 'pads', 'msd', 'chair', 'biobed', 'bunk', 'mess', 'bar']) {
    const t0 = Date.now(); let ok = true;
    try { await useNode(p, n); } catch (e) { ok = false; }
    report.nodes.push({ node: n, ok, secs: +((Date.now() - t0) / 1000).toFixed(1), at: await p.evaluate(() => [__T.G.lt.deck, +__T.G.lt.x.toFixed(3), +__T.G.lt.y.toFixed(3)]) });
  }
  report.soak = {};
  await p.evaluate(() => { __T.app.timeScale = 10; });
  for (const d of ['engineering', 'bridge', 'medical', 'berthing', 'lounge']) {
    await goDeck(p, d); let bad = 0, stalls = 0;
    for (let i = 0; i < 25; i++) {
      const x = Math.random(), y = Math.random();
      await p.evaluate(([x, y]) => __T.sendTo(x, y, { kind: 'walk' }), [x, y]);
      const ok = await p.waitForFunction(() => __T.G.lt.mode !== 'walk', null, { timeout: 30000 }).then(() => true, () => false);
      if (!ok) stalls++;
      const f = await p.evaluate(async () => { const P = await import('/js/path.js'); const L = __T.G.lt; return P.isWalkable(L.deck, L.x, L.y); });
      if (!f) bad++;
    }
    report.soak[d] = { taps: 25, offFloor: bad, stalls };
  }
  await p.evaluate(() => { __T.app.timeScale = 4; });
  for (const [d, n] of [['engineering', 'core'], ['bridge', 'chair'], ['medical', 'biobed'], ['berthing', 'bunk'], ['lounge', 'mess']]) {
    await useNode(p, n); await sleep(600);
    await p.screenshot({ path: `${OUT}fix01_phone_walkmask_${d}.png` });
  }
  await p.evaluate(async () => { const R = await import('/js/render/deck.js'); R.DBG.walk = false; });
  await useNode(p, 'torpbay');
  await p.evaluate(async () => { const V = await import('/js/voyage.js'); __T.G.sp.cap.decideT = 1e9; __T.G.sp.location = 'convoy'; V.captainOrder('nebula', 'Task-force orders divert us to exploration: the Omarion Nebula.'); });
  await sleep(1200);
  report.statusPhone = await p.evaluate(() => ({ lt: document.querySelector('#ltBarTxt').innerText, ship: document.querySelector('#newsBarTxt').innerText }));
  await p.screenshot({ path: `${OUT}fix01_phone_status_lines.png` });
  await p.evaluate(async () => { const B = await import('/js/battle.js'); B.startBattle('debug'); }); await sleep(1500);
  report.statusPhoneBattle = await p.evaluate(() => ({ lt: document.querySelector('#ltBarTxt').innerText, ship: document.querySelector('#newsBarTxt').innerText }));
  await p.tap('[data-sheet=orders]'); await sleep(600);
  await p.screenshot({ path: `${OUT}fix01_phone_orders_sheet_two_lines.png` });
  report.buttonsPhone = await measure(p);
  await p.tap('#sheetClose'); await sleep(300);
  await p.evaluate(() => { __T.G.sp.battle = null; });
  await sleep(300);
  await p.screenshot({ path: `${OUT}fix01_phone_buttons.png` });
  await useNode(p, 'locker');
  await p.evaluate(() => __T.saveGame()); await p.reload();
  await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 30000 }); await sleep(800);
  report.afterReload = await p.evaluate(() => ({ url: location.href, lt: document.querySelector('#ltBarTxt').innerText, ship: document.querySelector('#newsBarTxt').innerText, parts: __T.G.ship.parts }));
  await boot(p, BASE, '?debug=1&reset=1');
  await p.evaluate(() => { const d = document.querySelector('#debug'); d.hidden = true; const G = __T.G; G.ship.nextFault = 1e9; G.ship.torps = 0; G.sp.location = 'convoy'; G.sp.escortDone = true; G.sp.cap.decideT = 0.1; G.sp.ev.nextT = -1; __T.app.timeScale = 1; });
  await p.waitForFunction(() => __T.G.sp.travel && __T.G.sp.travel.dest === 'ds9', null, { timeout: 20000 });
  await p.evaluate(async () => { const V = await import('/js/voyage.js'); V.arriveAtDest(); __T.app.timeScale = 20; });
  await p.waitForFunction(() => __T.G.ship.torps >= 8 || __T.G.sp.travel, null, { timeout: 60000 });
  await p.evaluate(() => { __T.app.timeScale = 0; });
  report.ds9 = await p.evaluate(() => ({ torps: __T.G.ship.torps, cap: __T.G.ship.torpCap, travel: __T.G.sp.travel && __T.G.sp.travel.dest, lines: __T.G.log.filter(e => /rearm|ordnance|torpedo/i.test(e.msg)).slice(-5).map(e => e.msg) }));
  await p.tap('[data-sheet=log]'); await sleep(600);
  await p.screenshot({ path: `${OUT}fix01_phone_ds9_rearm.png` });
  await p.close();
  p = await mk(b, 1280, 800, false, 'desk');
  await boot(p, BASE, '?debug=1&reset=1&walk=1');
  await calm(p); await p.evaluate(() => { __T.app.timeScale = 4; });
  for (const [d, n] of [['engineering', 'shield'], ['lounge', 'bar'], ['bridge', 'msd']]) { await useNode(p, n); await sleep(500); await p.screenshot({ path: `${OUT}fix01_desk_walkmask_${d}.png` }); }
  await p.evaluate(async () => { const R = await import('/js/render/deck.js'); R.DBG.walk = false; });
  await useNode(p, 'torpbay');
  await p.evaluate(async () => { const V = await import('/js/voyage.js'); __T.G.sp.location = 'convoy'; V.captainOrder('hulk', 'Task-force orders divert us to the derelict hulk, for salvage.'); }); await sleep(1000);
  report.statusDesk = await p.evaluate(() => ({ lt: document.querySelector('#statusTxt').innerText, ship: document.querySelector('#newsTxt').innerText }));
  await p.screenshot({ path: `${OUT}fix01_desk_status_lines.png` });
  report.buttonsDesk = await measure(p);
  await p.click('#btnFull'); await sleep(600); await p.screenshot({ path: `${OUT}fix01_desk_full_buttons.png` });
  report.buttonsDeskFull = await measure(p);
  await p.evaluate(() => { __T.G.savedAt = Date.now() - 3 * 3600 * 1000; localStorage.setItem('tenacity.save.v1', JSON.stringify(__T.G)); window.__noSave = true; });
  await p.reload(); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 30000 }); await sleep(800);
  report.offlineReport = await p.evaluate(() => document.querySelector('#reportBody').innerText);
  await p.screenshot({ path: `${OUT}fix01_desk_offline_3h_report.png` });
  await p.close();
  for (const [tag, base] of [['before', ORIG], ['after', BASE]]) {
    const q = await mk(b, 390, 844, true, 'scale-' + tag);
    await boot(q, base, '?reset=1'); await calm(q); await q.evaluate(() => { __T.app.timeScale = 4; });
    for (const [d, n] of [['engineering', 'core'], ['lounge', 'mess'], ['lounge', 'bar'], ['berthing', 'bunk'], ['bridge', 'chair']]) {
      await useNode(q, n); await sleep(700);
      await q.screenshot({ path: `${OUT}fix01_scale_${tag}_${d}_${n}.png` });
    }
    await q.close();
  }
  p = await mk(b, 390, 844, true, 'baddeck');
  await boot(p, BASE, '?reset=1');
  await p.evaluate(() => { const G = JSON.parse(JSON.stringify(__T.G)); G.lt.deck = 'shuttlebay'; G.savedAt = Date.now(); localStorage.setItem('tenacity.save.v1', JSON.stringify(G)); window.__noSave = true; });
  await p.reload(); const okBoot = await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 15000 }).then(() => true, () => false);
  report.badDeckSave = { booted: okBoot, deck: okBoot ? await p.evaluate(() => __T.G.lt.deck) : null };
  await p.close();
  report.issues = issues;
  fs.writeFileSync(OUT + 'fix01_report.json', JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
  await b.close();
})().catch(e => { console.error('FAILED', e); console.log(JSON.stringify(report, null, 1)); console.log(JSON.stringify(issues)); process.exit(1); });
