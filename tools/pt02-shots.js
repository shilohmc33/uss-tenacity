// Playtest-02 fix verification + proof screenshots -> shots/pt02-*-<tag>.png and shots/pt02-report-<tag>.json
// NODE_PATH=/workspace/pwtools/node_modules node tools/pt02-shots.js [base=http://127.0.0.1:8765/] [tag=after]
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/', TAG = process.argv[3] || 'after';
const OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const issues = {}, report = { base: BASE, tag: TAG };
async function mk(b, w, h, mobile) {
  const tag = `${w}x${h}`; issues[tag] = issues[tag] || [];
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript(() => { window.__TENACITY_SKIP_NAME = true; window.__TENACITY_SKIP_BG = true; window.__TENACITY_NO_IDLE = true; });   // v18: skip the name / Academy prompts; no idle pause in long shot runs
  const p = await ctx.newPage();
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) issues[tag].push(`console.${m.type()}: ${m.text()}`); });
  p.on('pageerror', e => issues[tag].push(`pageerror: ${e.message}`));
  p.on('requestfailed', r => issues[tag].push(`requestfailed: ${r.url()}`));
  p.on('response', r => { if (r.status() >= 400) issues[tag].push(`HTTP ${r.status()} ${r.url()}`); });
  return p;
}
async function boot(p, q = '?debug=1&reset=1') {
  await p.goto(BASE + q);
  await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 30000 });
  await sleep(400);
}
// no surprise faults / orders / events; hide the debug box for clean shots
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
const shot = (p, name, opts = {}) => p.screenshot({ path: OUT + `pt02-${name}-${TAG}.png`, ...opts });
// Lt figure on screen (CSS px): head top / feet relative to the stage
const ltFig = p => p.evaluate(async () => {
  const D = await import('/js/data.js'), c = __T.cam, L = __T.G.lt, st = document.querySelector('#stage').getBoundingClientRect();
  const sy = y => c.h / 2 + (y - c.y) * c.scale, sx = x => c.w / 2 + (x - c.x) * c.scale;
  return { headTop: Math.round(sy(L.y * D.DH - D.FIG_H)), feet: Math.round(sy(L.y * D.DH)), x: Math.round(sx(L.x * D.DW)), stageH: Math.round(st.height), stageW: Math.round(st.width), stageX: Math.round(st.x), stageY: Math.round(st.y), figH: Math.round(D.FIG_H * c.scale) };
});
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  // ===== phone portrait 390x844 =====
  let p = await mk(b, 390, 844, true);
  await boot(p); await calm(p);
  await shot(p, 'portrait-default');
  report.portraitDefault = await ltFig(p);
  // sheet in portrait (bottom sheet unchanged)
  await p.click('.sheetBtns [data-sheet=duty]'); await sleep(400); await shot(p, 'portrait-sheet-duty');
  await p.click('#sheetClose'); await sleep(300);
  // 1) NEW-03 Bridge lift head
  await p.evaluate(() => { __T.app.timeScale = 3; });
  await goDeck(p, 'bridge'); await p.evaluate(() => { __T.app.timeScale = 1; }); await sleep(900);
  report.bridgeLift = await ltFig(p);
  await shot(p, 'bridge-lift-phone');
  // 3) NEW-05 lift panel after alert pill
  await p.evaluate(async () => { const C = await import('/js/crew.js'); C.sendLiftPanel(); });
  await p.waitForFunction(() => !document.querySelector('#liftPanel').hidden, null, { timeout: 30000 });
  await sleep(300);
  report.liftPanelOpenBefore = await p.evaluate(() => document.querySelector('#liftList').innerText.replace(/\n/g, ' | '));
  await p.evaluate(async () => { const F = await import('/js/faults.js'); __T.G.ship.parts = 10; F.spawnFault('ambient', 'shields', 'med'); });
  await sleep(300);
  await p.click('#alertPill');
  await p.evaluate(() => { __T.app.timeScale = 3; });
  await p.waitForFunction(() => __T.G.lt.deck === 'engineering' && !__T.G.lt.lift, null, { timeout: 60000 });
  await p.evaluate(() => { __T.app.timeScale = 1; }); await sleep(700);
  report.liftPanelAfterPill = await p.evaluate(() => ({ hidden: document.querySelector('#liftPanel').hidden, text: document.querySelector('#liftPanel').hidden ? '' : document.querySelector('#liftList').innerText.replace(/\n/g, ' | '), deck: __T.G.lt.deck, mode: __T.G.lt.mode }));
  await shot(p, 'liftpanel-after-pill');
  // 7) reward floaters: finish that MEDIUM shield repair
  await p.waitForFunction(() => !__T.G.ship.faults.shields, null, { timeout: 90000 });
  report.afterRepair = await p.evaluate(() => ({ rep: __T.G.sp.rep, parts: __T.G.ship.parts }));
  await sleep(1350);
  await shot(p, 'reward-floaters');
  // toasts vs Lt at the parts locker (BUG-08)
  await useNode(p, 'locker');
  await p.evaluate(async () => { const H = await import('/js/ui/hud.js'); H.showToast('CHIEF: Shield Generator fault', 'med'); H.showToast('Captain\'s orders: Convoy Route', 'info'); H.showToast('Already at the Parts Locker — on station'); });
  await sleep(500);
  report.toastsLocker = await p.evaluate(() => { const t = document.querySelector('#toasts'); const r = t.getBoundingClientRect(); return { top: t.classList.contains('top'), y: Math.round(r.y), h: Math.round(r.height) }; });
  report.toastsLockerLt = await ltFig(p);
  await shot(p, 'toasts-locker');
  await p.context().close();

  // ===== landscape phone 844x390 =====
  p = await mk(b, 844, 390, true);
  await boot(p); await calm(p);
  await useNode(p, 'torpbay');
  report.landDefault = await ltFig(p);
  await shot(p, 'land-default');
  await p.click('.sheetBtns [data-sheet=crew]'); await sleep(450);
  report.landDrawer = await p.evaluate(() => { const r = document.querySelector('#panels').getBoundingClientRect(), s = document.querySelector('#stage').getBoundingClientRect(); return { panel: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], stage: [Math.round(s.x), Math.round(s.y), Math.round(s.width), Math.round(s.height)], deckVisibleW: Math.round(Math.max(0, Math.min(r.x, s.right) - s.x)) }; });
  await shot(p, 'land-drawer-crew');
  await p.click('#sheetClose'); await sleep(350);
  await p.click('.sheetBtns [data-sheet=log]'); await sleep(450); await shot(p, 'land-drawer-log');
  await p.click('#sheetClose'); await sleep(350);
  await shot(p, 'land-drawer-closed');
  await p.click('#btnWindow'); await sleep(500);
  report.landWindow = await ltFig(p);
  await shot(p, 'land-window');
  await p.click('#btnFull'); await sleep(400);
  await p.context().close();

  // ===== desktop 1280x800 =====
  p = await mk(b, 1280, 800, false);
  await boot(p); await calm(p);
  await shot(p, 'desktop-default');
  report.desktopDefault = await ltFig(p);
  // 6) NEW-08 lighting: lounge bar, normal power vs low power, tint on/off
  await p.evaluate(() => { __T.app.timeScale = 3; });
  await goDeck(p, 'lounge');
  await p.evaluate(() => __T.sendTo(0.34, 0.56, { kind: 'walk' }));   // idle standing pose: same frame in every shot
  await p.waitForFunction(() => __T.G.lt.mode === 'idle', null, { timeout: 60000 });
  await p.evaluate(() => { __T.app.timeScale = 0; __T.G.ship.power = 80; });
  report.lightLt = await ltFig(p);
  await sleep(400);
  const clip = async () => { const f = await ltFig(p); return { x: Math.max(0, f.stageX + f.x - 160), y: Math.max(0, f.stageY + f.headTop - 60), width: 320, height: f.figH + 110 }; };
  const c = await clip();
  await shot(p, 'light-lounge-crop', { clip: c });
  await p.evaluate(async () => { const R = await import('/js/render/deck.js'); if ('light' in R.DBG) R.DBG.light = false; });
  await sleep(250); await shot(p, 'light-lounge-tintoff-crop', { clip: c });
  await p.evaluate(async () => { const R = await import('/js/render/deck.js'); if ('light' in R.DBG) R.DBG.light = true; __T.G.ship.power = 2; });
  await sleep(300); await shot(p, 'lowpower-lounge-crop', { clip: c }); await shot(p, 'lowpower-lounge');
  await p.evaluate(() => { __T.G.ship.power = 80; __T.app.timeScale = 1; });
  await p.context().close();

  // ===== offline report (real boot after 3 h away), phone =====
  p = await mk(b, 390, 844, true);
  await boot(p); await calm(p);
  await p.evaluate(() => { const G = __T.G; G.sp.cap.decideT = 3; G.ship.nextFault = 120; G.sp.ev.nextT = -1; G.ship.power = 7; G.ship.hull = 40; window.__noSave = false; __T.saveGame(); const s = JSON.parse(localStorage.getItem('tenacity.save.v1')); s.savedAt = Date.now() - 3 * 3600e3; s.prog.lastSeen = s.savedAt; localStorage.setItem('tenacity.save.v1', JSON.stringify(s)); window.__noSave = true; });
  await p.goto(BASE + '?debug=1');
  await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done') && !!document.querySelector('#wbCard.bow:not([hidden])'), null, { timeout: 60000 });
  await sleep(500);
  report.offlineReport = await p.evaluate(() => ({ text: document.querySelector('#wbCard.bow:not([hidden])').innerText,   /* v18: BACK ON WATCH */ faults: Object.keys(__T.G.ship.faults).length, power: Math.round(__T.G.ship.power), hull: Math.round(__T.G.ship.hull) }));
  await p.evaluate(() => { const d = document.querySelector('#debug'); if (d) d.hidden = true; });
  await shot(p, 'offline-report-3h');
  await p.context().close();

  report.issues = issues;
  fs.writeFileSync(OUT + `pt02-report-${TAG}.json`, JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
  await b.close();
})().catch(e => { console.error('FAILED', e); fs.writeFileSync(OUT + `pt02-report-${TAG}.json`, JSON.stringify({ error: String(e), report, issues }, null, 1)); process.exit(1); });
