// Bridge sliding doors (js/doors-data.js + render/doors.js) and the Berthing v3 plate, at 390x844, 844x390, 1280x800:
// shots/doors-closed-<size>.png (Lt just outside the port lift trigger, doors closed), doors-mid-<size>.png (caught
// mid-slide while opening), doors-open-<size>.png (Lt on the port lift spot, both lifts checked), berthing-v3-<size>.png.
// NODE_PATH=/workspace/pwtools/node_modules node tools/doors-shots.js [base]
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const rep = { errors: {}, info: {} }; let fail = 0;
  for (const [w, h, m] of [[390, 844, true], [844, 390, true], [1280, 800, false]]) {
    const tag = `${w}x${h}`, errs = [], I = rep.info[tag] = {};
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: m, hasTouch: m });
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
    await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(600);
    await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); });
    const place = (deck, x, y) => p.evaluate(([deck, x, y]) => { const Lt = __T.G.lt; Lt.deck = deck; Lt.lift = null; Lt.x = x; Lt.y = y; Lt.mode = 'idle'; Lt.path = null; Lt.intent = null; __T.cam.snap = true; __T.cam.manualT = 0; }, [deck, x, y]);
    const state = () => p.evaluate(async () => { const D = await import('/js/render/doors.js'); return D.doorState('bridge'); });
    const loaded = await p.evaluate(async () => { const A = await import('/js/assets.js'), DD = await import('/js/doors-data.js'); return DD.DOOR_IMAGES.filter(k => !A.IMG[k]); });
    if (loaded.length) { I.missing = loaded; fail++; }
    // closed: Lt 90 design px below the port lift centre (outside the 70 px radius)
    await place('bridge', 202 / 960, 266 / 640); await sleep(1600);
    I.closed = await state(); await p.screenshot({ path: OUT + `doors-closed-${tag}.png` });
    if (I.closed[0].state !== 'closed') fail++;
    // mid-slide: step onto the lift spot and freeze the first frame with the port door between 0.3 and 0.75 open
    await place('bridge', 0.2104, 0.275);
    I.mid = await p.evaluate(async () => { const D = await import('/js/render/doors.js');
      return new Promise(res => { let n = 0; const f = () => { const s = D.doorState('bridge')[0]; if ((s.open > 0.3 && s.open < 0.75) || ++n > 120) { __T.app.paused = true; res(D.doorState('bridge')); } else requestAnimationFrame(f); }; requestAnimationFrame(f); }); });
    await p.screenshot({ path: OUT + `doors-mid-${tag}.png` });
    await p.evaluate(() => { __T.app.paused = false; }); await sleep(900);
    I.open = await state(); await p.screenshot({ path: OUT + `doors-open-${tag}.png` });
    if (I.open[0].state !== 'open') fail++;
    // starboard lift too, then walk away: port closes after delay + close time
    await place('bridge', 0.7854, 0.2625); await sleep(1500);
    I.stbd = await state(); if (I.stbd[1].state !== 'open' || I.stbd[0].state !== 'closed') fail++;
    await place('berthing', 0.5, 0.6); await sleep(1500); await p.screenshot({ path: OUT + `berthing-v3-${tag}.png` });
    I.berthPlate = await p.evaluate(async () => { const A = await import('/js/assets.js'); const im = A.IMG['deck-berthing']; return im ? [im.width, im.height] : null; });
    rep.errors[tag] = errs; fail += errs.length; await c.close();
  }
  fs.writeFileSync(OUT + 'doors-shots.json', JSON.stringify(rep, null, 1));
  console.log(JSON.stringify(rep)); console.log(fail ? 'DOORS FAIL ' + fail : 'DOORS PASS');
  await b.close();
})();
