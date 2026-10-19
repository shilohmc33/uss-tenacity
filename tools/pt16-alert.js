// Pass 16 B2/B3 checks: the battlecruiser's red-alert card vs anything already open, and its 7 s auto-hide.
// Real path: startBattle('enroute', { enemy: 'jh_battlecruiser' }) on a live, rested ship (the card follows the sensor toast at 1.2 s).
//   board   - a prompt already up (promotion board): it steps aside (hidden, still owed), the card is on top (elementFromPoint), shot
//   plog    - a panel the PLAYER opened (personal log): it stays open, the card sits above it, shot
//   sheet   - phones: the play-mode bottom sheet open: the card is on top, shot
//   hidden  - the tab goes hidden 0.3 s after the card shows, for 10 s: the card is still up on return (seen-time frozen), then hides ~7 s later
//   covered - something covers the card for 10 s: it does not count; uncovered it hides ~7 s later
//   plain   - nothing open: hides 7 s (+-0.6) after it shows
//   strip   - B3 (360x640 / 667x375, capped card): the pinned TAP TO DISMISS strip is opaque (computed background alpha 1), shots at scroll top and bottom
// node tools/pt16-alert.js [base] -> shots/pt16-alert-*.png, shots/pt16-alert-report.json
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SIZES = (process.env.SIZES ? process.env.SIZES.split(",").map(s => { const [w, h] = s.split("x").map(Number); return [w, h, w < 900, (w === 360 || w === 667) ? "small" : undefined]; }) : [[390, 844, true], [844, 390, true], [1280, 800, false], [360, 640, true, "small"], [667, 375, true, "small"]]);
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const rep = { errors: {}, checks: {}, shots: [], fails: [] };
  const ck = (tag, name, ok, info) => { rep.checks[tag + ' ' + name] = { ok: !!ok, info }; if (!ok) rep.fails.push(tag + ' ' + name + ' ' + JSON.stringify(info)); };
  for (const [w, h, m, small] of SIZES) {
    const tag = `${w}x${h}`, errs = [];
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: m, hasTouch: m });
    await c.addInitScript(() => { window.__TENACITY_TEST_DEATHS = true; let hid = false; Object.defineProperty(document, 'hidden', { configurable: true, get: () => hid }); window.__setHidden = v => { hid = v; }; });
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
    const shot = async name => { const f = OUT + `pt16-alert-${name}-${tag}.png`; await p.screenshot({ path: f }); rep.shots.push(f.replace(/^.*shots\//, 'shots/')); };
    const boot = async () => { await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(500);
      await p.evaluate(async () => { window.__noSave = true; const G = __T.G, P = await import('/js/pacing.js'), E = await import('/js/encounters.js');
        G.prog.rank = 1; G.prog.playDays = 20; G.prog.day = Math.max(G.prog.day, 25); G.ship.hull = 100; G.ship.power = 90; G.ship.torps = 4; G.ship.faults = {}; for (const a of Object.values(G.ab)) if (a && typeof a === 'object') { a.cd = 0; a.active = 0; }
        G.sp.enc = E.freshEnc(); G.sp.lastBattleT = -1e9; P.PACE_RT.sessionT = 1e5; P.PACE_RT.idleT = 0; P.PACE_RT.offline = false;
        if (__T.MD && __T.MD.answerGentlePrompt) __T.MD.answerGentlePrompt(false); document.querySelectorAll('.modal').forEach(x => { x.hidden = true; }); }); };
    const fight = () => p.evaluate(async () => { const BT = await import('/js/battle.js'); return BT.startBattle('enroute', { enemy: 'jh_battlecruiser' }); });
    const st = () => p.evaluate(async () => { const H = await import('/js/ui/hud.js'); return { ...H.alertCardState(), board: !document.querySelector('#boardPanel').hidden, plog: !document.querySelector('#plogPanel').hidden, battle: !!__T.G.sp.battle }; });
    const waitShown = async () => { for (let i = 0; i < 40; i++) { const s = await st(); if (s.shown) return Date.now(); await sleep(100); } return null; };
    const waitGone = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const s = await st(); if (!s.shown) return Date.now(); await sleep(100); } return null; };
    // board pre-open
    await boot(); await p.evaluate(() => { const bp = document.querySelector('#boardPanel'); document.querySelector('#boardBody').innerHTML = '<h3>PROMOTION BOARD</h3><p>The board is ready to sit.</p><div class="mbtns"><button class="close" data-board="face">FACE THE BOARD</button></div>'; bp.hidden = false; });
    await fight(); await waitShown(); await sleep(400); { const s = await st(); ck(tag, 'board: card on top, board stepped aside', s.shown && s.visible && !s.board, s); } await shot('board');
    // player-opened panel
    await boot(); await p.evaluate(() => { document.querySelector('#plogPanel').hidden = false; });
    await fight(); await waitShown(); await sleep(400); { const s = await st(); ck(tag, 'plog: card on top, plog kept open', s.shown && s.visible && s.plog, s); } await shot('plog');
    if (m) { await boot(); await p.evaluate(() => { document.body.classList.add('sheet-open'); });
      await fight(); await waitShown(); await sleep(400); { const s = await st(); ck(tag, 'sheet: card on top of the open sheet', s.shown && s.visible, s); } await shot('sheet'); }
    if (!small) {
      // hidden tab
      await boot(); await fight(); const t1 = await waitShown(); await sleep(300); await p.evaluate(() => { window.__setHidden(true); });
      await sleep(10000); const sh = await st(); await p.evaluate(() => { window.__setHidden(false); }); const tb = Date.now(); const gone = await waitGone(9000);
      ck(tag, 'hidden 10 s: still up on return, then hides ~7 s later', sh.shown && sh.seenMs <= 750 && gone && (gone - tb) > 5500 && (gone - tb) < 8000, { seenAtReturn: sh.seenMs, hideAfterReturnMs: gone && gone - tb });
      // covered
      await boot(); await fight(); await waitShown(); await p.evaluate(() => { const d = document.createElement('div'); d.id = '__cover'; d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.4)'; document.body.appendChild(d); });
      await sleep(10000); const sc = await st(); await p.evaluate(() => document.getElementById('__cover').remove()); const tu = Date.now(); const gone2 = await waitGone(9000);
      ck(tag, 'covered 10 s: not counted, hides ~7 s after uncovered', sc.shown && sc.seenMs <= 250 && gone2 && (gone2 - tu) > 6000 && (gone2 - tu) < 8000, { seenWhileCovered: sc.seenMs, hideAfterUncoverMs: gone2 && gone2 - tu });
      // plain
      await boot(); await fight(); const t3 = await waitShown(); const gone3 = await waitGone(10000);
      ck(tag, 'plain: hides 7 s after it shows', gone3 && Math.abs(gone3 - t3 - 7000) < 700, { ms: gone3 && gone3 - t3 });
    } else {
      // B3: capped card, pinned strip opaque; scroll top / bottom shots
      await boot(); await fight(); await waitShown(); await sleep(500);
      const s3 = await p.evaluate(() => { const c = document.querySelector('#bcCard'), t = c.querySelector('.tap'); const bg = getComputedStyle(t).backgroundColor; const m = bg.match(/rgba?\(([^)]+)\)/); const a = m ? (m[1].split(',')[3] == null ? 1 : +m[1].split(',')[3]) : 0; return { clamp: c.classList.contains('clamp'), bg, alpha: a, scrollMax: c.scrollHeight - c.clientHeight }; });
      ck(tag, 'strip: capped card, opaque TAP strip', s3.clamp && s3.alpha === 1, s3); await shot('strip-top');
      await p.evaluate(() => { const c = document.querySelector('#bcCard'); c.scrollTop = 9999; }); await sleep(200); await shot('strip-bottom');
      await p.evaluate(() => { const c = document.querySelector('#bcCard'); c.scrollTop = 14; }); await sleep(200); await shot('strip-mid');
    }
    rep.errors[tag] = errs; ck(tag, 'zero console errors', errs.length === 0, errs.slice(0, 3));
    await c.close();
  }
  fs.writeFileSync(OUT + 'pt16-alert-report.json', JSON.stringify(rep, null, 1));
  console.log('fails', rep.fails.length, rep.fails); await b.close();
})();
