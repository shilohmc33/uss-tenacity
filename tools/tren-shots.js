// Captain T'Ren sprite verification -> shots/tren_*.png (server on :8765)
// NODE_PATH=/workspace/pwtools/node_modules node tools/tren-shots.js
const { chromium } = require('playwright-core');
const SH = '/workspace/tenacity/shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [], out = {};
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const mk = async (w, h, mobile, tag) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${tag}] ${m.type()}: ${m.text()}`); });
    p.on('pageerror', e => errors.push(`[${tag}] pageerror: ${e.message}`));
    p.on('requestfailed', r => errors.push(`[${tag}] requestfailed: ${r.url()}`));
    p.on('response', r => { if (r.status() >= 400) errors.push(`[${tag}] HTTP ${r.status()} ${r.url()}`); });
    await p.goto('http://127.0.0.1:8765/?reset=1');
    await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 30000 });
    await sleep(500);
    await p.evaluate(() => { const G = __T.G; G.ship.nextFault = 1e9; G.ship.faults = {}; G.sp.ev.nextT = 1e9; G.sp.ev.active = null; G.sp.cap.decideT = 1e9; });
    return p;
  };
  const tele = `(deck, x, y) => { const L = __T.G.lt; L.lift = null; L.deck = deck; L.x = x; L.y = y; L.mode = 'idle'; L.path = null; L.node = null; L.repairSys = null; L.moving = false; __T.cam.snap = true; __T.cam.manualT = 0; }`;
  const zoom = (p, z) => p.evaluate(z => { __T.cam.zoom = z; __T.cam.snap = true; window.dispatchEvent(new Event('resize')); }, z);
  const st = p => p.evaluate(() => { const T = __T.tren, L = __T.G.lt; return { tren: { mode: T.mode, action: T.action, dir: T.dir, x: +T.x.toFixed(3), y: +T.y.toFixed(3), moving: T.moving }, lt: { deck: L.deck, mode: L.mode, node: L.node, dir: L.dir, x: +L.x.toFixed(3), y: +L.y.toFixed(3) } }; });
  const shot = async (p, name, ms = 500) => { await sleep(ms); await p.screenshot({ path: SH + name }); out[name] = await st(p); console.log(name, JSON.stringify(out[name])); };

  // ---------- desktop ----------
  let p = await mk(1280, 800, false, 'desk');
  out.assets = await p.evaluate(async () => { const A = await import('/js/assets.js'); return { missing: A.missing, tren: A.IMG['tren-v1'] && [A.IMG['tren-v1'].naturalWidth, A.IMG['tren-v1'].naturalHeight] }; });
  console.log('assets', JSON.stringify(out.assets));
  // her usual spot: beside the Captain's Chair, Lt across the bridge at the MSD
  await p.evaluate(`(${tele})('bridge', 0.43, 0.34)`); await p.evaluate(() => __T.sendUse('msd'));
  await zoom(p, 2.2); await shot(p, 'tren_desk_bridge_home.png', 1200);
  // Lt reports at the chair -> she turns to him and talks
  await p.evaluate(() => __T.sendUse('chair'));
  await p.waitForFunction(() => __T.G.lt.mode === 'use' && __T.G.lt.node === 'chair', null, { timeout: 30000 });
  await zoom(p, 3.0); await shot(p, 'tren_desk_chair_talk_with_lt.png', 900);
  // Lt leaves the chair for the MSD, she sets off to a console: walking, then working it
  await p.evaluate(() => { __T.sendUse('msd'); __T.trenTo('station', 1); });
  await zoom(p, 2.2); await shot(p, 'tren_desk_walking.png', 1300);
  await p.waitForFunction(() => __T.tren.mode === 'station', null, { timeout: 30000 });
  await zoom(p, 3.0); await p.evaluate(() => { __T.cam.manualT = 99; const T = __T.tren; __T.cam.x = T.x * 960; __T.cam.y = T.y * 640 - 60; });
  await shot(p, 'tren_desk_station_computer.png', 900);
  // port console + MSD end
  for (const i of [0, 2]) {
    await p.evaluate(i => __T.trenTo('station', i), i);
    await p.waitForFunction(() => __T.tren.mode === 'station', null, { timeout: 40000 });
    await p.evaluate(() => { __T.cam.manualT = 99; const T = __T.tren; __T.cam.x = T.x * 960; __T.cam.y = T.y * 640 - 60; });
    await shot(p, `tren_desk_station_${i}.png`, 700);
  }
  // scale: Lt standing right beside her, both idle facing down
  await p.evaluate(() => __T.trenTo('home'));
  await p.waitForFunction(() => __T.tren.mode === 'home', null, { timeout: 40000 });
  await p.evaluate(`(${tele})('bridge', 0.64, 0.42)`);
  await p.evaluate(() => { __T.app.timeScale = 0; const T = __T.tren; T.action = null; T.dir = 'down'; __T.G.lt.dir = 'down'; __T.cam.manualT = 99; __T.cam.x = 0.61 * 960; __T.cam.y = 0.42 * 640 - 70; });
  await zoom(p, 4.0); await p.evaluate(() => { __T.cam.manualT = 99; __T.cam.x = 0.61 * 960; __T.cam.y = 0.42 * 640 - 70; });
  await shot(p, 'tren_desk_scale_next_to_lt.png', 400);
  // she then turns and talks to him (sim running)
  await p.evaluate(() => { __T.app.timeScale = 1; }); await zoom(p, 3.4);
  await p.evaluate(() => { __T.cam.manualT = 99; __T.cam.x = 0.61 * 960; __T.cam.y = 0.42 * 640 - 70; });
  await shot(p, 'tren_desk_talk_beside_lt.png', 900);
  // battle: holds at the chair, issuing orders (talk loop)
  await p.evaluate(async () => { const B = await import('/js/battle.js'); B.startBattle('debug'); __T.app.view = 'deck'; });
  await sleep(300);
  await p.evaluate(() => { if (__T.app.view !== 'deck') __T.app.view = 'deck'; });
  await zoom(p, 2.6); await shot(p, 'tren_desk_battle_orders.png', 1200);
  await p.evaluate(() => { __T.G.sp.battle = null; });
  // 4 directions x {idle, walk A, walk B, computer, talk}: sim frozen, crops composed into a grid by python
  await zoom(p, 4.0);
  await p.evaluate(`(${tele})('engineering', 0.45, 0.66)`);   // Lt off the bridge so only she is drawn
  await p.evaluate(`(${tele})('bridge', 0.30, 0.25)`);
  const cells = [];
  for (const mode of ['idle', 'walkA', 'walkB', 'computer', 'talk', 'eat', 'weld', 'kneel']) for (const dir of ['up', 'down', 'right', 'left']) {
    await p.evaluate(([mode, dir]) => {
      __T.app.timeScale = 0; const T = __T.tren; T.mode = 'home'; T.x = 0.578; T.y = 0.42; T.dir = dir; T.moving = false; T.swingAmp = 0; T.action = null;
      if (mode.startsWith('walk')) { T.moving = true; T.swingAmp = 1; T.walkPhase = mode === 'walkA' ? 0.1 : Math.PI + 0.1; }
      else if (mode !== 'idle') T.action = mode;
      __T.cam.manualT = 99; __T.cam.x = 0.578 * 960; __T.cam.y = 0.42 * 640 - 67;
    }, [mode, dir]);
    await sleep(120);
    const f = `/tmp/tren_cell_${mode}_${dir}.png`;
    await p.screenshot({ path: f, clip: { x: 365 - 110, y: 340 - 230, width: 220, height: 330 } });
    cells.push([mode, dir, f]);
  }
  out.cells = cells;
  await p.close();

  // ---------- phone ----------
  p = await mk(390, 844, true, 'phone');
  await p.evaluate(`(${tele})('bridge', 0.43, 0.34)`); await p.evaluate(() => __T.sendUse('chair'));
  await p.waitForFunction(() => __T.G.lt.mode === 'use' && __T.G.lt.node === 'chair', null, { timeout: 30000 });
  await shot(p, 'tren_phone_chair_talk_with_lt.png', 1000);
  await p.evaluate(() => { __T.sendUse('msd'); __T.trenTo('station', 0); });
  await shot(p, 'tren_phone_walking.png', 1500);
  // a few minutes of natural behaviour at 10x: she must stay on the floor and keep cycling
  const trace = await p.evaluate(async () => {
    __T.sendTo(0.30, 0.45, { kind: 'walk' }); __T.app.timeScale = 10;
    const N = await import('/js/npc.js'); const seen = {}; let off = 0;
    for (let i = 0; i < 120; i++) { await new Promise(r => setTimeout(r, 250)); const k = N.tren.mode + ':' + (N.tren.action || '-'); seen[k] = (seen[k] || 0) + 1; if (!N.trenOnFloor()) off++; }
    __T.app.timeScale = 1; return { seen, offFloorSamples: off };
  });
  out.soak = trace; console.log('soak', JSON.stringify(trace));
  await p.close();
  out.errors = errors;
  require('fs').writeFileSync(SH + 'tren_report.json', JSON.stringify(out, null, 1));
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch(e => { console.error('FAILED', e); console.log('ERRORS', JSON.stringify(errors)); process.exit(1); });
