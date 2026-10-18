// Ship art hook check (battle groundwork): injects generated stand-in ship sheets at runtime (no files are added) in the
// SHIP_SHEET format (512x256 cells, pivot (256,128), facing right; rows idle / firing / damaged / shieldsHit / explode /
// engine) and proves the hook: SHIP_ART[key].img -> the sheet is drawn instead of the vector placeholder, the right row
// per state, loops vs one-shots, the engine row additive, enemies mirrored, a short sheet (idle row only) falls back to
// idle, and a missing image or img: null falls back to the placeholder with no errors. Live: a battle with stand-in art
// on the Tenacity and the Galor draws through the space renderer. Shots: shots/ship-hook-<vp>-{art,fallback}.png
// NODE_PATH=/workspace/pwtools/node_modules node tools/ship-hook-check.js [base]
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = {}; let fail = 0;
  for (const [vp, w, h, m] of [['phone', 390, 844, true], ['desk', 1280, 800, false]]) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: m, hasTouch: m });
    await c.addInitScript(() => { window.__TENACITY_TEST_DEATHS = true; window.__SD = [];
      const P = CanvasRenderingContext2D.prototype, o = P.drawImage;
      P.drawImage = function (img, ...a) { if (img && img.__tag) { const t = this.getTransform(); window.__SD.push({ tag: img.__tag, canvas: this.canvas.id || 'off', sx: a.length >= 8 ? a[0] : null, sy: a.length >= 8 ? a[1] : null, op: this.globalCompositeOperation, mirror: t.a < 0 }); } return o.call(this, img, ...a); }; });
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
    await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(600);
    const r = await p.evaluate(async () => {
      window.__noSave = true;
      const D = await import('/js/data.js'), A = await import('/js/assets.js'), RS = await import('/js/render/ships.js');
      const [CW, CH] = D.SHIP_SHEET.cell, rows = D.SHIP_SHEET.rows;
      // stand-in sheet: every cell a facing-right arrow hull in the row's colour, frame number, pivot crosshair
      const COL = ['#4f86d4', '#ffb340', '#a0522d', '#7fd3ff', '#ff4a2a', '#ffffff'];
      const mk = (tag, nRows, tint) => { const cv = document.createElement('canvas'); cv.width = CW * 8; cv.height = CH * nRows; const x = cv.getContext('2d');
        for (let ri = 0; ri < nRows; ri++) { const rw = rows[ri]; for (let f = 0; f < rw.frames; f++) { const ox = f * CW, oy = ri * CH;
          if (rw.state === 'engine') { x.fillStyle = 'rgba(120,220,255,0.8)'; x.beginPath(); x.arc(ox + 60, oy + 128, 30 + f * 6, 0, 7); x.fill(); continue; }
          x.fillStyle = tint; x.beginPath(); x.moveTo(ox + 32, oy + 88); x.lineTo(ox + 380, oy + 88); x.lineTo(ox + 480, oy + 128); x.lineTo(ox + 380, oy + 168); x.lineTo(ox + 32, oy + 168); x.closePath(); x.fill();
          x.fillStyle = COL[ri]; x.fillRect(ox + 60, oy + 104, 300, 48);
          x.fillStyle = '#000'; x.font = 'bold 36px sans-serif'; x.fillText(rw.state[0].toUpperCase() + f, ox + 150, oy + 142);
          x.strokeStyle = '#0f0'; x.lineWidth = 3; x.beginPath(); x.moveTo(ox + 256, oy + 108); x.lineTo(ox + 256, oy + 148); x.moveTo(ox + 236, oy + 128); x.lineTo(ox + 276, oy + 128); x.stroke(); } }
        cv.__tag = tag; return cv; };
      A.IMG['test-ship-full'] = mk('test-ship-full', rows.length, '#c8d2df');
      A.IMG['test-ship-idle'] = mk('test-ship-idle', 1, '#b3a473');
      const out = {}, off = document.createElement('canvas'); off.width = 600; off.height = 300; const ctx = off.getContext('2d');
      const draw = (ship, opts) => { window.__SD.length = 0; const ret = RS.drawShip(ctx, ship, 50, 50, 448, 448 / 3.5, opts); return { ret, calls: window.__SD.slice() }; };
      // 1) no art: vector placeholder, no sheet draws
      out.fallbackNull = draw('galor', { t: 0 }); 
      // 2) full sheet on the Galor
      D.SHIP_ART.galor.img = 'test-ship-full';
      const rowOf = st => rows.findIndex(r => r.state === st);
      const S = {};
      S.idle = draw('galor', { t: 0.2, pct: 100 }); S.idleLater = draw('galor', { t: 0.55, pct: 100 });
      S.firing = draw('galor', { t: 1, pct: 100, anim: { state: 'firing', t: 0.1 } });
      S.firingDone = draw('galor', { t: 1, pct: 100, anim: { state: 'firing', t: 5 } });
      S.damaged = draw('galor', { t: 1, pct: 20 });
      S.shields = draw('galor', { t: 1, pct: 100, anim: { state: 'shieldsHit', t: 0.05 } });
      S.explode = draw('galor', { t: 1, pct: 0, dying: true, anim: { state: 'explode', t: 0.45 } });
      S.explodeEnd = draw('galor', { t: 1, pct: 0, dying: true, anim: { state: 'explode', t: 9 } });
      S.mirror = draw('galor', { t: 0, pct: 100, mirror: true });
      const main = x => x.calls.find(c => c.op !== 'lighter') || {}, eng = x => x.calls.find(c => c.op === 'lighter');
      out.rows = Object.fromEntries(Object.entries(S).map(([k, v]) => [k, { row: main(v).sy / CH, frame: main(v).sx / CW, engine: !!eng(v), mirror: !!main(v).mirror, art: v.ret && v.ret.art }]));
      const R = out.rows;
      out.ok = {
        fallbackNull: out.fallbackNull.ret && out.fallbackNull.ret.art === false && out.fallbackNull.calls.length === 0,
        idle: R.idle.row === rowOf('idle') && R.idle.frame === 1 && R.idleLater.frame === 3 && R.idle.art,   // 6 fps loop: t 0.2 -> frame 1, t 0.55 -> frame 3
        firing: R.firing.row === rowOf('firing') && R.firing.frame === 1 && R.firingDone.row === rowOf('idle'),   // one-shot, then back to idle
        damaged: R.damaged.row === rowOf('damaged'), shieldsHit: R.shields.row === rowOf('shieldsHit'),
        explode: R.explode.row === rowOf('explode') && R.explode.frame === 4 && R.explodeEnd.frame === 7,   // 10 fps; holds the last frame
        engine: Object.values(R).every(x => x.engine), mirror: R.mirror.mirror && !R.idle.mirror,
      };
      // 3) a sheet with only the idle row: every state falls back to idle, no engine overlay
      D.SHIP_ART.galor.img = 'test-ship-idle';
      const sh = ['idle', 'firing', 'damaged', 'explode'].map(st => draw('galor', { t: 0.2, pct: st === 'damaged' ? 10 : 100, dying: st === 'explode', anim: st === 'idle' || st === 'damaged' ? null : { state: st, t: 0.05 } }));
      out.ok.shortSheet = sh.every(x => x.calls.length === 1 && x.calls[0].sy === 0);
      // 4) a missing image key: placeholder, no throw
      D.SHIP_ART.galor.img = 'no-such-ship-art';
      out.missing = draw('galor', { t: 0 }); out.ok.missing = out.missing.ret && out.missing.ret.art === false && out.missing.calls.length === 0;
      // 5) live: stand-in art on the Tenacity and the Galor in a real battle
      D.SHIP_ART.galor.img = 'test-ship-full'; D.SHIP_ART.tenacity.img = 'test-ship-full';
      const BT = await import('/js/battle.js'); for (const a of Object.values(__T.G.ab)) a.cd = 30; __T.G.ship.torps = 0; BT.startBattle('debug', { enemy: 'galor' });
      window.__SD.length = 0;
      return out;
    });
    await p.waitForSelector('#watchBattle', { state: 'visible' }); await p.click('#watchBattle'); await sleep(2600);
    const live = await p.evaluate(() => { const L = window.__SD.filter(c => c.canvas === 'space'); return { draws: L.length, mirrored: L.filter(c => c.mirror).length, unmirrored: L.filter(c => !c.mirror).length, rows: [...new Set(L.map(c => c.sy / 256))].sort() }; });
    await p.evaluate(() => { __T.app.paused = true; }); await sleep(120);
    await p.screenshot({ path: OUT + `ship-hook-${vp}-art.png` });
    r.ok.live = live.draws > 20 && live.mirrored > 0 && live.unmirrored > 0;   // both ships through the sheet; the enemy mirrored
    r.live = live;
    // fallback shot: art removed mid-battle -> vector placeholders again
    await p.evaluate(async () => { const D = await import('/js/data.js'); D.SHIP_ART.galor.img = null; D.SHIP_ART.tenacity.img = null; window.__SD.length = 0; __T.app.paused = false; });
    await sleep(500); const after = await p.evaluate(() => window.__SD.filter(c => c.canvas === 'space').length); await p.evaluate(() => { __T.app.paused = true; }); await sleep(120);
    await p.screenshot({ path: OUT + `ship-hook-${vp}-fallback.png` });
    r.ok.liveFallback = after === 0;
    r.errors = errs; r.ok.noErrors = errs.length === 0;
    delete r.fallbackNull; delete r.missing;
    res[vp] = r; if (Object.values(r.ok).some(v => !v)) fail++;
    await c.close();
  }
  fs.writeFileSync(OUT + 'ship-hook-report.json', JSON.stringify(res, null, 1));
  for (const [vp, r] of Object.entries(res)) console.log(vp, JSON.stringify(r.ok), JSON.stringify(r.live));
  console.log(fail ? 'SHIP HOOK FAIL' : 'SHIP HOOK PASS');
  await b.close();
})();
