// Pass 13 HOLD proof shots + checks at 390x844, 844x390, 1280x800 -> shots/pt13-*.png, shots/pt13-report.json
//   sensor   - the battlecruiser through the REAL path (startBattle('enroute'), roll pinned to her row): the "capital-class contact"
//              sensor toast + Hale log line show first, the red-alert card is not up yet
//   card     - ~1.4 s later: the red-alert card with the pass 13 copy (matches the real danger; no disengage option)
//   report   - a battlecruiser fought during offline catch-up (real sim.catchUp) is the FIRST thing in the return report
//   memorial - romance OFF: the IN MEMORIAM row of a lost partner reads '· a close friend' (no ♥, no 'partner')
// node tools/pt13-shots.js [base] [outDir]
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const OUT = process.argv[3] || __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SIZES = [[390, 844, true], [844, 390, true], [1280, 800, false]];
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const rep = { errors: {}, checks: {}, shots: [], fails: [] };
  const ck = (tag, name, ok, info) => { rep.checks[tag + ' ' + name] = { ok: !!ok, info }; if (!ok) rep.fails.push(tag + ' ' + name + ' ' + JSON.stringify(info)); };
  for (const [w, h, m] of SIZES) {
    const tag = `${w}x${h}`, errs = [];
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: m, hasTouch: m });
    await c.addInitScript(() => { window.__TENACITY_TEST_DEATHS = true; });
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
    const shot = async name => { const f = OUT + `pt13-${name}-${tag}.png`; await p.screenshot({ path: f }); rep.shots.push(f.replace(/^.*shots\//, 'shots/')); };
    const boot = async () => { await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(600); };
    const ready = () => p.evaluate(async () => {
      window.__noSave = true; const G = __T.G, P = await import('/js/pacing.js'), E = await import('/js/encounters.js');
      G.prog.rank = 1; G.prog.playDays = 20; G.prog.day = Math.max(G.prog.day, 25); G.ship.hull = 100; G.ship.power = 90; G.ship.torps = 2; G.ship.faults = {}; for (const a of Object.values(G.ab)) if (a && typeof a === 'object') a.cd = 30;
      G.sp.enc = E.freshEnc(); G.sp.lastBattleT = -1e9; P.PACE_RT.sessionT = 1e5; P.PACE_RT.idleT = 0; P.PACE_RT.offline = false;
      if (__T.MD && __T.MD.answerGentlePrompt) __T.MD.answerGentlePrompt(false); const sp = document.querySelector('#safetyPanel'); if (sp) sp.hidden = true; });
    // 1) sensor line, then 2) the card
    await boot(); await ready();
    const s1 = await p.evaluate(async () => { const BT = await import('/js/battle.js'), G = __T.G, mr = Math.random, n0 = G.log.length; Math.random = () => 0.999; let ok; try { ok = BT.startBattle('enroute'); } finally { Math.random = mr; }
      __T.app.paused = true;   // hold the fight still for the captures
      const msgs = G.log.slice(n0).map(e => e.msg); return { ok, enemy: G.sp.battle && G.sp.battle.enemies[0].ship, card: !document.querySelector('#bcCard').hidden, toasts: [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent), sensor: msgs.find(m => /capital-class contact/.test(m)) || null, first: /capital-class contact/.test(msgs[0] || '') }; });
    await sleep(250); await shot('sensor');
    ck(tag, 'sensor line first: toast + Hale log line, no card yet', s1.ok && s1.enemy === 'jh_battlecruiser' && !s1.card && s1.first && s1.toasts.some(t => /capital-class contact/.test(t)), s1);
    await sleep(1300);
    const s2 = await p.evaluate(() => { const c = document.querySelector('#bcCard'), r = c.getBoundingClientRect(); return { card: !c.hidden, text: c.innerText, fits: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, tap: parseFloat(getComputedStyle(c.querySelector('.tap')).fontSize), buttons: c.querySelectorAll('button').length }; });
    await shot('card');
    ck(tag, 'card: pass 13 copy (outguns us / hull damage / casualties / no outrunning her), fits, TAP >= 12 px, no disengage button', s2.card && /outguns us/i.test(s2.text) && /casualties/i.test(s2.text) && /no outrunning her/i.test(s2.text) && !/Half again/i.test(s2.text) && !/disengage/i.test(s2.text) && s2.buttons === 0 && s2.fits && s2.tap >= 12, s2);
    // 3) the return-report headline after an offline battlecruiser
    await boot(); await ready();
    const s3 = await p.evaluate(async () => { const BT = await import('/js/battle.js'), SIM = await import('/js/sim.js'), HUD = await import('/js/ui/hud.js'), G = __T.G; __T.app.paused = true;
      const hid = document.querySelector('#bcCard'); const ok = BT.startBattle('enroute', { enemy: 'jh_battlecruiser' }); hid.hidden = true;
      const r = SIM.catchUp(1800); HUD.showReport(r); const body = document.querySelector('#reportBody'), first = body.firstElementChild;
      document.querySelector('#bcCard').hidden = true; return { ok, bc: r.bcFights, battles: r.battles, firstIsHead: !!first && first.classList.contains('bcHead'), head: first ? first.innerText : '', shown: !document.querySelector('#report').hidden }; });
    await sleep(400); await shot('report');
    ck(tag, 'return report: the offline battlecruiser is the headline (first element), with outcome + hull', s3.ok && s3.shown && s3.bc.length >= 1 && s3.firstIsHead && /While you were off watch: a Jem'Hadar battlecruiser/.test(s3.head) && /hull \d+%|towed/.test(s3.head), s3);
    // 4) memorial row, romance OFF
    await boot();
    const s4 = await p.evaluate(async () => { window.__noSave = true; const G = __T.G, P = G.prog, RM = __T.RM, HUD = await import('/js/ui/hud.js'); __T.app.paused = true; RM.setOpt(false);
      P.med.memorial.push({ id: 'kovac_mem', name: 'PO Mara Kovac', short: 'Kovac', role: 'Damage control', day: 30, sd: '51500.0', partner: true });
      HUD.openPlog(); const el = [...document.querySelectorAll('#plogBody .plrow.lost')].pop(); if (el) el.scrollIntoView({ block: 'center' }); return { row: el ? el.innerText : '' }; });
    await sleep(400); await shot('memorial-off');
    ck(tag, "memorial row with romance off: '· a close friend', no ♥ / 'partner'", /a close friend/.test(s4.row) && !/partner|♥/.test(s4.row), s4);
    rep.errors[tag] = errs; ck(tag, 'zero console errors', !errs.length, errs); await c.close();
  }
  fs.writeFileSync(OUT + 'pt13-report.json', JSON.stringify(rep, null, 1));
  console.log(rep.fails.length ? 'PT13 FAIL\n' + rep.fails.join('\n') : 'PT13 PASS', Object.keys(rep.checks).length, 'checks', rep.shots.length, 'shots', JSON.stringify(rep.errors));
  await b.close(); process.exit(rep.fails.length ? 1 : 0);
})();
