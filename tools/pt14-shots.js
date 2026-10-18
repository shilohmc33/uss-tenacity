// Pass 15 proof shots + checks at 390x844, 844x390, 1280x800 -> shots/pt14-*.png, shots/pt14-report.json
//   cardtoast - the battlecruiser through the REAL path (startBattle('enroute'), roll pinned to her row), ~1.6 s in: the red-alert card
//               AND Hale's "capital-class contact" sensor toast both visible, no overlap (also re-checked at ~4.5 s: the toast is held
//               while the card is up); new copy (no "No outrunning her", no "casualties")
//   report    - an AWAY battlecruiser (offline steady state from catchUp, then she is rolled while away -> the night watch has the bridge)
//               fought out in real sim.catchUp: the return report headline leads with a real hull cost
//   journal   - a REAL build09 save (tools/fixtures/rom-build09-lostpartner.json) with romance OFF: the lost partner's journal shows ONE
//               death entry (was two)
// node tools/pt14-shots.js [base] [outDir]
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const OUT = process.argv[3] || __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SIZES = [[390, 844, true], [844, 390, true], [1280, 800, false]];
const B09 = fs.readFileSync(path.join(__dirname, 'fixtures', 'rom-build09-lostpartner.json'), 'utf8');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const rep = { errors: {}, checks: {}, shots: [], fails: [] };
  const ck = (tag, name, ok, info) => { rep.checks[tag + ' ' + name] = { ok: !!ok, info }; if (!ok) rep.fails.push(tag + ' ' + name + ' ' + JSON.stringify(info)); };
  for (const [w, h, m] of SIZES) {
    const tag = `${w}x${h}`, errs = [];
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: m, hasTouch: m });
    await c.addInitScript(() => { window.__TENACITY_TEST_DEATHS = true; });
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
    const shot = async name => { const f = OUT + `pt14-${name}-${tag}.png`; await p.screenshot({ path: f }); rep.shots.push(f.replace(/^.*shots\//, 'shots/')); };
    const loaded = () => p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
    const boot = async () => { await p.goto(BASE + '?reset=1'); await loaded(); await sleep(600); };
    const ready = () => p.evaluate(async () => {
      window.__noSave = true; const G = __T.G, P = await import('/js/pacing.js'), E = await import('/js/encounters.js');
      G.prog.rank = 1; G.prog.playDays = 20; G.prog.day = Math.max(G.prog.day, 25); G.ship.hull = 100; G.ship.power = 90; G.ship.torps = 2; G.ship.faults = {}; for (const a of Object.values(G.ab)) if (a && typeof a === 'object') a.cd = 30;
      G.sp.enc = E.freshEnc(); G.sp.lastBattleT = -1e9; P.PACE_RT.sessionT = 1e5; P.PACE_RT.idleT = 0; P.PACE_RT.offline = false;
      if (__T.MD && __T.MD.answerGentlePrompt) __T.MD.answerGentlePrompt(false); const sp = document.querySelector('#safetyPanel'); if (sp) sp.hidden = true; });
    const geo = () => p.evaluate(() => { const R = e => { const x = e.getBoundingClientRect(); return { l: x.left, t: x.top, r: x.right, b: x.bottom }; }, c = document.querySelector('#bcCard');
      const card = c.hidden ? null : R(c), ts = [...document.querySelectorAll('#toasts .toast')].map(t => ({ text: t.textContent, ...R(t) })), sensor = ts.find(t => /capital-class contact/.test(t.text)) || null;
      const ov = (a, b2) => a && b2 && a.l < b2.r && a.r > b2.l && a.t < b2.b && a.b > b2.t;
      const ban = document.querySelector('#redBanner'), banner = ban && !ban.hidden ? R(ban) : null;
      return { card, sensor, toastsCovered: ts.filter(t => ov(card, t)).map(t => t.text), bannerCovered: !!ov(card, banner), text: c.innerText, fits: !!card && card.l >= 0 && card.t >= 0 && card.r <= innerWidth && card.b <= innerHeight, sensorIn: !!sensor && sensor.l >= 0 && sensor.r <= innerWidth && sensor.t >= 0 && sensor.b <= innerHeight }; });
    // 1) card + sensor toast together (the battle runs live: the RED ALERT banner and other toasts are up as in play)
    await boot(); await ready();
    await p.evaluate(async () => { const BT = await import('/js/battle.js'), mr = Math.random; Math.random = () => 0.999; try { BT.startBattle('enroute'); } finally { Math.random = mr; } });
    await sleep(1600); const g1 = await geo(); await p.evaluate(() => { __T.app.paused = true; }); await shot('cardtoast');
    ck(tag, 'card + sensor toast both visible at ~1.6 s, the card covers no toast and not the RED ALERT banner', g1.card && g1.sensor && g1.sensorIn && g1.fits && !g1.toastsCovered.length && !g1.bannerCovered, g1);
    ck(tag, "card copy: no 'No outrunning her', no 'casualties'; 'break off' + 'hull damage'", !/outrunning/i.test(g1.text) && !/casualties/i.test(g1.text) && /break off/i.test(g1.text) && /hull damage/i.test(g1.text), g1.text);
    await sleep(2900); const g2 = await geo();
    ck(tag, 'sensor toast held while the card is up (~4.5 s), still uncovered', g2.card && g2.sensor && !g2.toastsCovered.length, g2);
    // 2) the return report after an AWAY battlecruiser (the night watch has the bridge)
    await boot(); await ready();
    const s3 = await p.evaluate(async () => { const BT = await import('/js/battle.js'), SIM = await import('/js/sim.js'), HUD = await import('/js/ui/hud.js'), PC = await import('/js/pacing.js'), G = __T.G; __T.app.paused = true;
      let r = null, tries = 0, nw = false; const all = [];
      for (; tries < 6; tries++) {
        SIM.catchUp(3 * 3600); G.sp.battle = null; G.sp.lastBattleT = -1e9; G.ship.hull = Math.max(G.ship.hull, 90); G.ship.torps = Math.max(G.ship.torps, 2); G.ship.power = Math.max(G.ship.power, 60);
        PC.PACE_RT.offline = true; let ok; try { ok = BT.startBattle('enroute', { enemy: 'jh_battlecruiser' }); } finally { PC.PACE_RT.offline = false; }
        nw = G.log.slice(-60).some(e => /night watch has the bridge/.test(e.msg)); document.querySelector('#bcCard').hidden = true;
        r = SIM.catchUp(1800); const f = r.bcFights[0]; all.push(f ? f.lost : null); if (ok && f && f.lost >= 10) break;
      }
      HUD.showReport(r); const body = document.querySelector('#reportBody'), first = body.firstElementChild; document.querySelector('#bcCard').hidden = true;
      return { tries: tries + 1, all, nw, bc: r.bcFights, firstIsHead: !!first && first.classList.contains('bcHead'), head: first ? first.innerText : '', shown: !document.querySelector('#report').hidden }; });
    await sleep(400); await shot('report');
    ck(tag, 'return report: an away battlecruiser fought by the night watch is the headline, with a real hull cost (>= 10%)', s3.shown && s3.nw && s3.bc.length >= 1 && s3.firstIsHead && /While you were off watch: a Jem'Hadar battlecruiser/.test(s3.head) && s3.bc[0].lost >= 10 && /in the fight/.test(s3.head), s3);
    // 3) build09 save, romance OFF: one death entry in the lost partner's journal
    await p.evaluate(r => { window.__noSave = true; const d = JSON.parse(r); d.savedAt = Date.now(); localStorage.setItem('tenacity.save.v1', JSON.stringify(d)); }, B09);
    await p.goto(BASE); await loaded(); await sleep(600);
    const s4 = await p.evaluate(async () => { window.__noSave = true; __T.app.paused = true; const RM = __T.RM, HUD = await import('/js/ui/hud.js'); RM.setOpt(false);
      __T.MD.closeScene && __T.MD.closeScene(); for (const s of ['#report', '#safetyPanel', '#medPanel']) { const e = document.querySelector(s); if (e) e.hidden = true; }
      HUD.openPlog('tull'); const js = [...document.querySelectorAll('#plogBody .plj')]; const last = js[0]; if (last) last.scrollIntoView({ block: 'center' });
      const texts = js.map(e => e.innerText.replace(/^SD [\d.]+\s*/, ''));
      return { texts, deaths: texts.filter(t => /^We lost .+ today\.|is gone\. I wrote the letter home|I don't have words/.test(t)).length, romantic: texts.filter(t => /said yes|Not as shipmates|don't have words/.test(t)) }; });
    await sleep(400); await shot('journal');
    ck(tag, 'build09 save, romance off: ONE death entry in the lost partner journal, no romance line', s4.deaths === 1 && !s4.romantic.length, s4);
    rep.errors[tag] = errs; ck(tag, 'zero console errors', !errs.length, errs); await c.close();
  }
  fs.writeFileSync(OUT + 'pt14-report.json', JSON.stringify(rep, null, 1));
  console.log(rep.fails.length ? 'PT14 FAIL\n' + rep.fails.join('\n') : 'PT14 PASS', Object.keys(rep.checks).length, 'checks', rep.shots.length, 'shots', JSON.stringify(rep.errors));
  await b.close(); process.exit(rep.fails.length ? 1 : 0);
})();
