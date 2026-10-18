// Ambient Andorian crewwoman (stand-in T'Ren sheet) verification -> shots/andor-*.png, shots/andor-report.json
// NODE_PATH=/workspace/pwtools/node_modules node tools/andor-shots.js [base]
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const OUT = process.env.OUTDIR || (__dirname + '/../shots/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const report = { issues: {} };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [w, h, mobile, tag] of [[390, 844, true, 'phone'], [1280, 800, false, 'desk'], [844, 390, true, 'land']]) {
    const key = `${w}x${h}`, iss = report.issues[key] = [];
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const p = await ctx.newPage();
    p.on('console', m => { if (['error', 'warning'].includes(m.type())) iss.push(`console.${m.type()}: ${m.text()}`); });
    p.on('pageerror', e => iss.push(`pageerror: ${e.message} @ ${(e.stack || '').split('\n').slice(1, 3).join(' | ')}`));
    p.on('requestfailed', r => iss.push(`requestfailed: ${r.url()}`));
    p.on('response', r => { if (r.status() >= 400) iss.push(`HTTP ${r.status()} ${r.url()}`); });
    await p.goto(BASE + '?debug=1&reset=1');
    await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 30000 });
    await p.evaluate(() => { const G = __T.G; G.sp.cap.decideT = 1e9; G.ship.nextFault = 1e9; G.sp.ev.nextT = -1; document.querySelector('#debug').hidden = true; __T.app.timeScale = 3; });
    await p.evaluate(async () => { const C = await import('/js/crew.js'); C.rideLiftTo('lounge'); });
    await p.waitForFunction(() => __T.G.lt.deck === 'lounge' && !__T.G.lt.lift, null, { timeout: 60000 });
    if (tag === 'land') {   // smoke only: one chat, errors
      await p.evaluate(() => __T.sendUse('mess'));
      await p.waitForFunction(() => __T.ambient[0].mode === 'chat', null, { timeout: 60000 });
      await sleep(800); await ctx.close(); continue;
    }
    // 1) alone: she drifts; camera parked on her (Lt by the lift, out of the chat nodes)
    await p.evaluate(() => { __T.ambientTo('thelev', 'window'); });
    await p.waitForFunction(() => __T.ambient[0].mode === 'dwell' && __T.ambient[0].spot.id === 'window', null, { timeout: 60000 });
    await p.evaluate(() => { __T.app.timeScale = 1; const n = __T.ambient[0], c = __T.cam; c.manualT = 60; c.x = n.x * 960; c.y = n.y * 640 - 60; });
    await sleep(700);
    await p.screenshot({ path: OUT + `andor-alone-${tag}.png` });
    // wander check at x5 for ~60 s of sim time: her feet stay on the walk mask
    report[tag] = { wander: await p.evaluate(async () => {
      const P = await import('/js/path.js'), n = __T.ambient[0]; __T.app.timeScale = 5; __T.cam.manualT = 0;
      const seen = new Set(); let off = 0, samples = 0;
      for (let i = 0; i < 120; i++) { await new Promise(r => setTimeout(r, 100)); samples++; if (!P.isWalkable('lounge', n.x, n.y)) off++; if (n.mode === 'dwell') seen.add(n.spot.id + ':' + (n.action || 'idle')); }
      __T.app.timeScale = 3; return { samples, offMask: off, dwells: [...seen] };
    }) };
    // 2) mess chat
    const log0 = await p.evaluate(() => __T.G.log.length);
    await p.evaluate(() => { __T.G.ship.energy = 60; __T.sendUse('mess'); });
    await p.waitForFunction(() => __T.ambient[0].mode === 'chat' && __T.G.lt.mode === 'use', null, { timeout: 60000 });
    await p.evaluate(() => { __T.app.timeScale = 1; }); await sleep(1300);
    report[tag].mess = await p.evaluate(l0 => { const n = __T.ambient[0], L = __T.G.lt, D = (ax, ay, bx, by) => Math.round(Math.hypot((ax - bx) * 960, (ay - by) * 640));
      const tbl = [0.5275, 0.47];   // middle front-row high-top (centre of its walk-mask block), the Lt's mess table
      return { distLt: D(n.x, n.y, L.x, L.y), distTable: D(n.x, n.y, tbl[0], tbl[1]), distBarSpot: D(n.x, n.y, 0.4425, 0.3375), ltStatus: document.querySelector('#ltBarTxt').innerText || document.querySelector('#statusTxt').innerText, npc: [+n.x.toFixed(3), +n.y.toFixed(3)], npcDir: n.dir, npcAction: n.action, lt: [L.x, L.y], ltNode: L.node, energy: Math.round(__T.G.ship.energy), newLog: __T.G.log.slice(l0).map(e => e.msg) }; }, log0);
    await p.screenshot({ path: OUT + `andor-chat-mess-${tag}.png` });
    // 3) bar chat (inside the line and perk cooldowns: no new line, no perk)
    const log1 = await p.evaluate(() => __T.G.log.length);
    await p.evaluate(() => { __T.app.timeScale = 3; __T.sendUse('bar'); });
    await p.waitForFunction(() => __T.G.lt.node === 'bar' && __T.G.lt.mode === 'use' && __T.ambient[0].mode === 'chat', null, { timeout: 60000 });
    await p.evaluate(() => { __T.app.timeScale = 1; }); await sleep(1300);
    report[tag].bar = await p.evaluate(l1 => { const n = __T.ambient[0], L = __T.G.lt; return { ltStatus: document.querySelector('#ltBarTxt').innerText || document.querySelector('#statusTxt').innerText, npc: [+n.x.toFixed(3), +n.y.toFixed(3)], npcDir: n.dir, npcAction: n.action, lt: [L.x, L.y], newLog: __T.G.log.slice(l1).map(e => e.msg), mem: __T.G.npc }; }, log1);
    await p.screenshot({ path: OUT + `andor-chat-bar-${tag}.png` });
    // 4) after cooldowns: jump ship time past them, leave and come back -> a fresh line + perk
    await p.evaluate(() => { __T.app.timeScale = 3; __T.G.ship.elapsed += 400; __T.G.ship.energy = 50; __T.sendTo(0.33, 0.6, { kind: 'walk' }); });
    await p.waitForFunction(() => __T.G.lt.mode === 'idle', null, { timeout: 60000 });
    const log2 = await p.evaluate(() => __T.G.log.length);
    await p.evaluate(() => __T.sendUse('bar'));
    await p.waitForFunction(() => __T.ambient[0].mode === 'chat' && __T.G.lt.node === 'bar', null, { timeout: 60000 });
    await sleep(300);
    report[tag].afterCooldown = await p.evaluate(l2 => ({ newLog: __T.G.log.slice(l2).map(e => e.msg), energy: Math.round(__T.G.ship.energy) }), log2);
    // 5) chat ends after chatDur and she drifts on; the Lt goes back to his bar loop
    await p.evaluate(() => { __T.app.timeScale = 5; });
    await p.waitForFunction(() => __T.ambient[0].mode !== 'chat', null, { timeout: 60000 });
    report[tag].chatEnded = await p.evaluate(() => ({ mode: __T.ambient[0].mode, doneNode: __T.ambient[0].doneNode }));
    await ctx.close();
  }
  fs.writeFileSync(OUT + 'andor-report.json', JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
  await b.close();
})().catch(e => { console.error('FAILED', e); console.log(JSON.stringify(report, null, 1)); process.exit(1); });
