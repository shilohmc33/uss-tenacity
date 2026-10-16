const { chromium } = require('playwright-core');
const SH = '/workspace/tenacity/shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const errors = [];
  async function mk(w, h, mobile) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${w}] ${m.type()}: ${m.text()}`); });
    p.on('pageerror', e => errors.push(`[${w}] pageerror: ${e.message}`));
    return p;
  }
  const ev = (p, f, a) => p.evaluate(f, a);
  const waitFor = async (p, fn, t = 30000) => { const s = Date.now(); while (Date.now() - s < t) { if (await p.evaluate(fn)) return true; await sleep(150); } return false; };
  const res = {};
  // ---------- phone ----------
  const p = await mk(390, 844, true);
  await p.goto('http://localhost:8765/?debug=1&reset=1');
  await waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done'));
  await sleep(600);
  await p.screenshot({ path: SH + 'phone_01_start_engineering.png' });
  // walk by tapping the canvas floor
  const box = await p.locator('#deck').boundingBox();
  await p.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.75);
  await sleep(700);
  res.walking = await ev(p, () => __T.G.lt.mode);
  await p.screenshot({ path: SH + 'phone_02_walking.png' });
  await ev(p, () => __D.x5());
  // replication resume
  await ev(p, () => __T.sendUse('torpbay'));
  await waitFor(p, () => __T.G.lt.mode === 'use' && __T.G.lt.node === 'torpbay' && __T.G.ship.charge > 15);
  await p.screenshot({ path: SH + 'phone_03_torpedo_bay_replicating.png' });
  await ev(p, () => __T.sendUse('locker'));
  await waitFor(p, () => __T.G.lt.node === 'locker');
  const c1 = await ev(p, () => __T.G.ship.charge);
  await sleep(1500);
  const c2 = await ev(p, () => __T.G.ship.charge);
  await ev(p, () => __T.sendUse('torpbay'));
  await waitFor(p, () => __T.G.lt.node === 'torpbay' && __T.G.lt.mode === 'use');
  const c3 = await ev(p, () => __T.G.ship.charge);
  res.replication = { leftAt: c1, whileAway: c2, onReturn: c3, resumeOK: Math.abs(c1 - c2) < 0.01 && c3 >= c1 && c3 - c1 < 5 };
  // re-tap current station
  await ev(p, () => __T.sendUse('torpbay'));
  await sleep(300);
  await p.screenshot({ path: SH + 'phone_04_retap_feedback.png' });
  // recharge
  await ev(p, () => { __T.G.ship.shields = 40; __T.sendUse('shield'); });
  await waitFor(p, () => __T.G.lt.node === 'shield' && __T.G.lt.mode === 'use');
  const s1 = await ev(p, () => __T.G.ship.shields); await sleep(2500); const s2 = await ev(p, () => __T.G.ship.shields);
  res.recharge = { s1, s2, ok: s2 > s1 };
  await p.screenshot({ path: SH + 'phone_05_shield_recharge.png' });
  // repair
  await ev(p, () => { __T.G.ship.parts = 10; __D['Fault MED'](); });
  const fid = await ev(p, () => Object.keys(__T.G.ship.faults)[0]);
  await ev(p, id => __T.sendRepair(id), fid);
  await waitFor(p, () => __T.G.lt.mode === 'repair');
  await sleep(500);
  await p.screenshot({ path: SH + 'phone_06_repair_kneeling.png' });
  await p.evaluate(id => { window.__fid = id; }, fid);
  res.repair = await waitFor(p, () => !__T.G.ship.faults[window.__fid], 20000);
  // turbolift to mess
  await ev(p, () => __T.sendUse('mess'));
  await waitFor(p, () => !!__T.G.lt.lift && __T.G.lt.lift.t > 0.15);
  await ev(p, () => __D.x1());
  await waitFor(p, () => __T.G.lt.lift && __T.G.lt.lift.t > 0.5);
  await p.screenshot({ path: SH + 'phone_07_turbolift_transition.png' });
  await ev(p, () => __D.x5());
  await waitFor(p, () => __T.G.lt.node === 'mess' && __T.G.lt.mode === 'use');
  await sleep(500);
  res.lift = await ev(p, () => __T.G.lt.deck);
  await p.screenshot({ path: SH + 'phone_08_mess_seated.png' });
  // bunk + biobed
  await ev(p, () => __T.sendUse('biobed'));
  await waitFor(p, () => __T.G.lt.node === 'biobed' && __T.G.lt.mode === 'use');
  await sleep(400);
  await p.screenshot({ path: SH + 'phone_09_biobed.png' });
  // event with deck task (anomaly -> bridge MSD)
  await ev(p, () => __D['Ev anomaly']());
  await sleep(300);
  await ev(p, () => __D.x1());
  await ev(p, () => __T.sendUse('chair'));
  await waitFor(p, () => __T.G.lt.deck === 'bridge' && !__T.G.lt.lift);
  await sleep(800);
  await p.screenshot({ path: SH + 'phone_10_event_task_bridge.png' });
  await ev(p, () => __D.x5());
  await ev(p, () => __T.sendUse('msd'));
  res.event = await waitFor(p, () => !__T.G.sp.ev.active, 20000);
  // task expiry test
  await ev(p, () => __D['Ev storm']());
  await ev(p, () => { __T.G.sp.ev.active.task.t = 11; });
  await sleep(500);
  await p.screenshot({ path: SH + 'phone_11_task_10s_warning.png' });
  res.expiry = await waitFor(p, () => !__T.G.sp.ev.active, 15000);
  // battle
  await ev(p, () => { __D.x1(); __T.G.ship.torps = 5; __D.Battle(); });
  await sleep(1200);
  await p.screenshot({ path: SH + 'phone_12_red_alert_deck.png' });
  await p.click('#watchBattle');
  for (let i = 0; i < 5; i++) { await sleep(1300); await p.screenshot({ path: SH + `phone_13_battle_${i}.png` }); }
  await ev(p, () => __D.x5());
  res.battle = await waitFor(p, () => !__T.G.sp.battle, 60000);
  await p.screenshot({ path: SH + 'phone_14_after_battle_space.png' });
  // sheets
  await ev(p, () => __D.x1());
  await p.click('#btnView');
  await p.click('[data-sheet="duty"]'); await sleep(400);
  await p.screenshot({ path: SH + 'phone_15_duty_sheet.png' });
  await p.click('[data-sheet="crew"]'); await sleep(400);
  await p.screenshot({ path: SH + 'phone_16_crew_sheet.png' });
  await p.click('#sheetClose');
  // save / reload
  const before = await ev(p, () => { __T.saveGame(); return { deck: __T.G.lt.deck, torps: __T.G.ship.torps, sd: __T.G.ship.stardate, log: __T.G.log.length }; });
  await p.goto('http://localhost:8765/?debug=1');
  await waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done'));
  const after = await ev(p, () => ({ deck: __T.G.lt.deck, torps: __T.G.ship.torps, sd: __T.G.ship.stardate, log: __T.G.log.length }));
  res.save = { before, after, ok: before.deck === after.deck && Math.abs(before.sd - after.sd) < 1 };
  // offline catch-up: rewind savedAt
  await ev(p, () => { __T.saveGame(); const d = JSON.parse(localStorage.getItem('tenacity.save.v1')); d.savedAt -= 20 * 60 * 1000; localStorage.setItem('tenacity.save.v1', JSON.stringify(d)); window.__noSave = true; __T.app.paused = true; });
  await p.goto('http://localhost:8765/');
  await waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done'));
  await sleep(500);
  res.report = await ev(p, () => !document.querySelector('#report').hidden);
  await p.screenshot({ path: SH + 'phone_17_offline_shift_report.png' });
  res.scroll = await ev(p, () => ({ sh: document.documentElement.scrollHeight, ih: innerHeight }));
  // ---------- desktop ----------
  const d = await mk(1280, 800, false);
  await d.goto('http://localhost:8765/?debug=1&reset=1');
  await waitFor(d, () => !!window.__T && document.querySelector('#loading').classList.contains('done'));
  await sleep(800);
  await d.screenshot({ path: SH + 'desk_01_info_engineering.png' });
  await d.mouse.move(400, 450); await d.mouse.wheel(0, 400); await sleep(400);
  await d.screenshot({ path: SH + 'desk_02_zoomed_out.png' });
  await d.evaluate(() => { __D.Battle(); });
  await d.click('#btnView'); await sleep(2500);
  await d.screenshot({ path: SH + 'desk_03_battle_space.png' });
  await d.evaluate(() => __D['Fault CRIT']());
  await d.click('#btnView'); await d.click('#btnFull'); await sleep(800);
  await d.screenshot({ path: SH + 'desk_04_fullscreen_deck_redalert.png' });
  await d.evaluate(() => { __D.Depart && 0; }); 
  console.log(JSON.stringify(res, null, 1));
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
