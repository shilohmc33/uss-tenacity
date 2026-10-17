// Lt v3 sprite verification: puts the Lieutenant into each mode and screenshots shots/lt2_*.png.
// Usage: (server on :8765)  NODE_PATH=/workspace/pwtools/node_modules node tools/lt2-shots.js
const { chromium } = require('playwright-core');
const SH = '/workspace/tenacity/shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  p.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  p.on('requestfailed', r => errors.push(`requestfailed: ${r.url()}`));
  await p.goto('http://localhost:8765/?debug=1&reset=1');
  const s0 = Date.now();
  while (Date.now() - s0 < 30000 && !(await p.evaluate(() => !!window.__T && document.querySelector('#loading').classList.contains('done')))) await sleep(150);
  await sleep(500);
  const info = await p.evaluate(async () => {
    const A = await import('/js/assets.js');
    const { G } = __T; G.ship.nextFault = 1e9; G.ship.faults = {}; G.sp.ev.nextT = 1e9; G.sp.ev.active = null;
    window.__F = await import('/js/faults.js');
    return { missing: A.missing, lt2: !!A.IMG['lt-v3'], size: A.IMG['lt-v3'] && [A.IMG['lt-v3'].naturalWidth, A.IMG['lt-v3'].naturalHeight] };
  });
  console.log('assets', JSON.stringify(info));
  // teleport next to a target on a deck, then issue the real command so crew.js logic sets mode/facing
  const setup = (fn, arg) => p.evaluate(fn, arg);
  const tele = `(deck, x, y) => { const L = __T.G.lt; L.lift = null; L.deck = deck; L.x = x; L.y = y; L.mode = 'idle'; L.path = null; L.node = null; L.repairSys = null; __T.cam.snap = true; __T.cam.manualT = 0; }`;
  const zoom = z => p.evaluate(z => { __T.cam.zoom = z; __T.cam.snap = true; window.dispatchEvent(new Event('resize')); }, z);
  const state = () => p.evaluate(() => { const L = __T.G.lt; return { deck: L.deck, mode: L.mode, node: L.node, dir: L.dir, sys: L.repairSys, x: +L.x.toFixed(3), y: +L.y.toFixed(3) }; });
  const shot = async (name, ms = 400) => { await sleep(ms); await p.screenshot({ path: SH + name }); console.log(name, JSON.stringify(await state())); };
  await zoom(3.6);
  const scenarios = [
    ['lt2_repair_weld.png', `() => { (${tele})('engineering', 0.45, 0.60); __T.G.ship.parts = 9; __F.spawnFault('ambient', 'warpcore', 'med'); __T.sendRepair('warpcore'); }`],
    ['lt2_repair_weld_side.png', `() => { __T.G.ship.faults = {}; (${tele})('engineering', 0.75, 0.42); __T.G.ship.parts = 9; __F.spawnFault('ambient', 'phasers', 'med'); __T.sendRepair('phasers'); }`],
    ['lt2_console_shield.png', `() => { __T.G.ship.faults = {}; (${tele})('engineering', 0.305, 0.47); __T.sendUse('shield'); }`],
    ['lt2_console_msd.png', `() => { (${tele})('bridge', 0.50, 0.335); __T.sendUse('msd'); }`],
    ['lt2_mess_eat.png', `() => { (${tele})('lounge', 0.527, 0.515); __T.sendUse('mess'); }`],
    ['lt2_mess_eat_north.png', `() => { (${tele})('lounge', 0.527, 0.405); __T.sendUse('mess'); }`],
    ['lt2_bunk_lying.png', `() => { (${tele})('berthing', 0.752, 0.16); __T.sendUse('bunk'); }`],
    ['lt2_bar_talk.png', `() => { (${tele})('lounge', 0.42, 0.345); __T.sendUse('bar'); }`],
  ];
  for (const [name, fn] of scenarios) { await p.evaluate(`(${fn})()`); await shot(name, 700); }
  // walking in each direction (real pathing); capture mid-stride
  const walks = [['right', 'engineering', [0.34, 0.68], [0.67, 0.68]], ['left', 'engineering', [0.67, 0.68], [0.34, 0.68]],
    ['down', 'lounge', [0.30, 0.40], [0.30, 0.92]], ['up', 'lounge', [0.30, 0.92], [0.30, 0.40]]];
  for (const [dir, deck, a, b] of walks) {
    await p.evaluate(`(${tele})('${deck}', ${a[0]}, ${a[1]})`);
    await p.evaluate(([x, y]) => __T.sendTo(x, y, { kind: 'walk' }), b);
    await shot(`lt2_walking_${dir}.png`, 1000);
  }
  // all four directions per action, sim frozen (timeScale 0 => render runs, crew logic doesn't override dir)
  const strip = [];
  await zoom(3.2);
  for (const mode of ['idle', 'walkA', 'walkB', 'computer', 'eat', 'talk', 'weld']) for (const dir of ['up', 'down', 'right', 'left']) {
    await p.evaluate(([mode, dir, tele]) => {
      const L = __T.G.lt; __T.app.timeScale = 0; eval(tele)('engineering', 0.45, 0.66); L.dir = dir; __T.cam.snap = true; L.moving = false;
      if (mode === 'idle') return;
      if (mode.startsWith('walk')) { L.moving = true; L.swingAmp = 1; L.walkPhase = mode === 'walkA' ? 0.1 : Math.PI + 0.1; return; }
      if (mode === 'weld') { L.mode = 'repair'; L.repairSys = 'warpcore'; __T.G.ship.faults.warpcore = { t: 0, sev: 'med', cost: 1, escT: 0 }; L.repairT = 0; return; }
      L.mode = 'use'; L.node = mode === 'computer' ? 'core' : mode === 'eat' ? 'mess' : 'bar';
    }, [mode, dir, tele]);
    await sleep(250);
    const file = `/tmp/lt2_${mode}_${dir}.png`;
    const c = await p.evaluate(() => { const L = __T.G.lt, cam = __T.cam, r = document.querySelector('#deck').getBoundingClientRect();
      return { x: r.left + (L.x * 960 - cam.x) * cam.scale + cam.w / 2, y: r.top + (L.y * 640 - cam.y) * cam.scale + cam.h / 2 }; });
    await p.screenshot({ path: file, clip: { x: Math.round(c.x - 80), y: Math.round(c.y - 230), width: 160, height: 250 } });
    strip.push(file);
  }
  await p.evaluate(() => { __T.app.timeScale = 1; __T.G.ship.faults = {}; __T.G.lt.mode = 'idle'; });
  require('fs').writeFileSync('/tmp/lt2_strip.json', JSON.stringify(strip));
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
