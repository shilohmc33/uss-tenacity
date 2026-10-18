// Pass 07 (playtest-07 narrow HOLD + minors): present-time play days, 'away never beats watching', surgery odds band + assist,
// Orvin's post-loss line, the injury-note countdown state, the fixed phone gift picker, and unit checks for every minor.
// -> shots/pt07-*.png + shots/pt07-report.json     NODE_PATH=/workspace/pwtools/node_modules node tools/pt07-shots.js [base]
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const issues = {}, R = { sizes: {} };
async function mk(b, w, h, mobile) {
  const tag = `${w}x${h}`; issues[tag] = [];
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error') issues[tag].push(`console.error: ${m.text()}`); });
  p.on('pageerror', e => issues[tag].push(`pageerror: ${e.message}`));
  p.on('response', r => { if (r.status() >= 400) issues[tag].push(`HTTP ${r.status()} ${r.url()}`); });
  return p;
}
async function boot(p, reset = true) {
  await p.goto(BASE + (reset ? '?reset=1' : '')); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(400);
  await p.evaluate(async () => {
    const PA = await import('/js/pacing.js'), PR = await import('/js/progression.js'), G = __T.G; window.__PA = PA; window.__noSave = true;
    window.__keepAlive = setInterval(() => PA.playerInput(), 1000);
    G.sp.cap.decideT = 1e9; G.ship.nextFault = 1e9; G.sp.ev.nextT = -1;
    PR.awardXP(9000, 'manual'); G.prog.rank = 1; __T.CB.applyTier(); G.prog.specOffered = 99; G.prog.playDays = 20; G.prog.presentTotal = 1e6; G.prog.day = 24; G.prog.med.asked = true; G.prog.med.prompt12 = true;
    Object.assign(G.prog.opinions, { okafor: 81, diallo: 66, thelev: 77, tull: 52, kovac: 61, rhovan: 70, mollo: 44 });
  });
  await sleep(1500);
}
const shot = (p, name, tag) => p.screenshot({ path: OUT + `pt07-${name}${tag ? '-' + tag : ''}.png` });
const openSheet = async (p, n) => { await p.evaluate(n => document.querySelector(`.sheetBtns [data-sheet="${n}"]`).click(), n); await sleep(450); };
const closeSheet = p => p.evaluate(() => { const c = document.querySelector('#sheetClose'); if (c) c.click(); }).then(() => sleep(300));
const closeMed = p => p.evaluate(() => { const b = document.querySelector('#medPanel [data-med=close]'); if (b) b.click(); }).then(() => sleep(300));
const small = (p, sel) => p.evaluate(sel => [...document.querySelectorAll(sel)].map(x => x.getBoundingClientRect()).filter(r => r.width && (r.width < 44 || r.height < 44)).length, sel);
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [w, h, mob, tag] of [[390, 844, true, ''], [844, 390, true, 'landscape'], [1280, 800, false, 'desktop']]) {
    const p = await mk(b, w, h, mob), S = R.sizes[tag || 'portrait'] = {};
    await boot(p);
    const ids = await p.evaluate(() => { const s = __T.G.prog.crew.slots, fav = __T.MD.favourites(); const reg = Object.values(__T.G.prog.crew.occ).filter(o => !['tren', 'okafor', 'diallo', 'hale', 'thelev'].includes(o.id) && !fav.includes(o.id)).map(o => o.id); return { reg, kovac: 'kovac' }; });
    // 1) injury note: waiting (unacked) -> clock running (acked, present)
    await openSheet(p, 'crew'); await sleep(300);   // open the sheet first: a tap after the alert counts as seeing it
    const sys = await p.evaluate(id => { clearInterval(window.__keepAlive); __PA.PACE_RT.idleT = 5; const i = __T.MD.injure('hazard', { id, sev: 'serious', what: 'the subspace shear' }); return i && i.sys; }, ids.reg[0]);
    await sleep(1500); await p.evaluate(() => { const r = [...document.querySelectorAll('#relations .rel.inj')][0]; if (r) r.scrollIntoView({ block: 'center' }); }); await sleep(300);
    S.noteWaiting = await p.evaluate(() => { const r = document.querySelector('#relations .rel.inj small'); return r ? r.innerText : null; });
    await p.evaluate(() => { __T.MD.ackInjury(); window.__keepAlive = setInterval(() => __PA.playerInput(), 1000); __PA.playerInput(); }); await sleep(1600);
    S.noteRunning = await p.evaluate(() => { const r = document.querySelector('#relations .rel.inj small'); return r ? r.innerText : null; });
    await shot(p, 'injury-note', tag); await closeSheet(p);
    // 2) surgery: odds band + ASSIST (outcome forced safe so the scene stays readable); the Lt's fast fix
    await p.evaluate(() => { window.__sg = { ...__T.PROG.deaths.surgery }; __T.PROG.deaths.surgery.scene = 30; });
    await p.evaluate(s => { __T.G.prog.med.inj[0].fixBy = 'lt'; delete __T.G.ship.faults[s]; }, sys); await sleep(1200);
    S.odds = await p.evaluate(() => ({ phase: (__T.MD.sceneOf() || {}).phase, band: document.querySelector('#medPanel .odds') && document.querySelector('#medPanel .odds').innerText, assistBtn: !!document.querySelector('#medPanel [data-med=assist]'), sx: __T.MD.surgeryOdds() && __T.MD.surgeryOdds().sx, text: document.querySelector('#medBody').innerText }));
    S.oddsSmall = await small(p, '#medPanel button');
    await shot(p, 'surgery-odds', tag);
    await p.evaluate(() => document.querySelector('#medPanel [data-med=assist]').click()); await sleep(500);
    S.assisted = await p.evaluate(() => ({ sx: __T.MD.surgeryOdds() && __T.MD.surgeryOdds().sx, assist: __T.MD.surgeryOdds() && __T.MD.surgeryOdds().assist, btnGone: !document.querySelector('#medPanel [data-med=assist]'), text: document.querySelector('#medBody').innerText }));
    await shot(p, 'surgery-assisted', tag);
    S.noteSurgery = await p.evaluate(() => { const r = document.querySelector('#relations .rel.inj'); return r ? r.textContent : null; });   // pass 08 (6)
    await p.evaluate(() => { const x = __T.G.prog.med.inj.find(i => i.state === 'surgery'); x.sx = 0; x.surg = 0.05; }); await p.waitForFunction(() => (__T.MD.sceneOf() || {}).phase === 'saved', null, { timeout: 20000 }); await sleep(300); await closeMed(p);
    // 3) a loss on the table -> Orvin: 'It wasn't you, Lieutenant.'
    await p.evaluate(() => { Object.assign(__T.PROG.deaths.surgery, { chance: 1, max: 1, fastMult: 1, excellentMult: 1, visitMult: 1, assistMult: 1, scene: 3 }); __T.G.prog.med.day = { pd: -1, n: 0 }; __T.G.prog.crew.rolls.hist = []; __T.G.prog.med.lastDeathPD = null; __T.G.prog.med.lastDeathPT = null; });
    // pass 09 (2): first acked 6 s ago, then off watch: back on deck it needs a re-tap, and the re-tap must not restart the
    // fast-fix clock, so Orvin quotes the true time since the FIRST ack (the old code said ~1 second here)
    const s2 = await p.evaluate(id => { const i = __T.MD.injure('hazard', { id, sev: 'serious' }); i.ack = true; i.acked = true; i.ackT = 6; i.fixBy = 'lt'; i.away = true; return i.sys; }, ids.reg[1]);
    await sleep(300);
    S.retap = await p.evaluate(id => { const i = __T.G.prog.med.inj.find(x => x.id === id); const unacked = !i.ack; __T.MD.ackInjury(id); return { unacked, ackT: +i.ackT.toFixed(2) }; }, ids.reg[1]);
    await p.evaluate(s => { delete __T.G.ship.faults[s]; }, s2);
    await p.waitForFunction(id => { const i = __T.G.prog.med.inj.find(x => x.id === id); return !i || i.state !== 'warning'; }, ids.reg[1], { timeout: 10000 });
    S.retap.atFix = await p.evaluate(id => { const i = __T.G.prog.med.inj.find(x => x.id === id); return i ? +i.ackT.toFixed(2) : null; }, ids.reg[1]);
    await p.waitForFunction(() => { const s = __T.MD.sceneOf(); return s && s.phase !== 'surgery'; }, null, { timeout: 30000 }); await sleep(500);
    S.loss = await p.evaluate(() => ({ phase: __T.MD.sceneOf().phase, orvin: __T.MD.sceneOf().orvin, text: document.querySelector('#medBody').innerText }));
    await shot(p, 'orvin-loss', tag); await closeMed(p);
    await p.evaluate(() => Object.assign(__T.PROG.deaths.surgery, window.__sg));
    // 4) phone gift picker: scrolled to the bottom, nothing shows below CLOSE
    await p.evaluate(() => { __T.G.prog.rations = 900; __T.G.prog.gifts.last = {}; });
    await openSheet(p, 'crew'); await p.evaluate(() => { const b2 = document.querySelector('[data-plog-open], #plogBox button'); if (b2) b2.click(); }); await sleep(500);
    await p.evaluate(() => { const r = document.querySelector('#plogPanel [data-pl="kovac"]'); if (r) r.click(); }); await sleep(400);
    await p.evaluate(() => { const g = document.querySelector('#plogPanel [data-pl-gift]'); if (g) g.click(); }); await sleep(500);
    await p.evaluate(() => { const c = document.querySelector('#plogPanel .card'); c.scrollTop = c.scrollHeight; }); await sleep(400);
    S.picker = await p.evaluate(() => { const c = document.querySelector('#plogPanel .card'), cl = document.querySelector('#plogPanel .close'), cr = c.getBoundingClientRect(), br = cl.getBoundingClientRect();
      // sample the strip under CLOSE: any list row painted there shows through
      const xs = [cr.left + 30, cr.left + cr.width / 2, cr.right - 30], y = Math.min(cr.bottom - 4, br.bottom + 6), hit = xs.map(x => { const e = document.elementFromPoint(x, y); return e && e.closest('#plogBody') ? 1 : 0; });
      return { open: /A GIFT FOR/.test(document.querySelector('#plogBody').innerText), gap: Math.round(cr.bottom - br.bottom), showThrough: hit.reduce((a, b2) => a + b2, 0), scrolled: c.scrollTop > 0 }; });
    await shot(p, 'gift-picker', tag);
    await p.evaluate(() => { const c = document.querySelector('#plogPanel .close'); if (c) c.click(); }); await sleep(300); await closeSheet(p);
    // ---- portrait only: unit checks ----
    if (!tag) R.tests = await p.evaluate(async () => {
      const PR = await import('/js/progression.js'), PA = __PA, SIM = await import('/js/sim.js'), MD = __T.MD, GF = await import('/js/gifts.js'), GD = await import('/js/gift-data.js'), CL = await import('/js/crewlife.js'), G = __T.G, p = G.prog, out = {};
      clearInterval(window.__keepAlive); __T.app.paused = true;
      // (1) play days
      const day = (m, d, h = 12, mi = 0) => new Date(2026, m - 1, d, h, mi);
      const play = (now, s) => { for (let t = 0; t < s; t += 0.5) PR.tickPlayDay(0.5, true, now); };
      const keep = { pd: p.playDays, d: p.lastPlayDate, at: p.lastPlayAt, dp: p.dayPresent };
      p.playDays = 0; p.lastPlayDate = null; p.lastPlayAt = null; p.dayPresent = 0;
      const ptKeep = p.presentTotal; p.presentTotal = 1e7;   // pass 08 (1): the calendar rules first, with the present-time cap out of the way
      const pd = {};
      pd.launchOnly = PR.markPlayDay(day(11, 1)) ? 1 : 0;
      play(day(11, 1), 120); pd.after2min = p.playDays; play(day(11, 1, 12, 3), 70); pd.after3min = p.playDays;
      play(day(11, 1, 18), 900); pd.longSameDay = p.playDays;
      const b13 = p.playDays; for (let k = 2; k <= 14; k++) PR.markPlayDay(day(11, k)); pd.stepLaunch13 = p.playDays - b13;   // the playtest attack: step +1 day, relaunch, x13
      const bf = p.playDays; for (let k = 0; k < 22; k++) PR.markPlayDay(k % 2 ? day(11, 15) : day(12, 20)); pd.flips22 = p.playDays - bf;   // back-and-forth relaunches
      p.lastPlayDate = '2026-11-01'; p.lastPlayAt = day(11, 1).getTime(); p.dayPresent = 0; const s0 = p.playDays;
      for (let d = 2; d <= 8; d++) play(day(11, d, d % 2 ? 9 : 12), 200); pd.shortSessions7 = p.playDays - s0;   // 3 min 20 s a day, play time wandering 3 h
      p.lastPlayDate = '2027-12-01'; p.lastPlayAt = new Date(2027, 11, 1).getTime(); const f0 = p.playDays; PR.clampProg();   // the save is loaded today (real clock)
      const nw = Date.now(); play(new Date(nw), 300); pd.futureSameDay = p.playDays - f0; play(new Date(nw + 26 * 3600e3), 300); pd.futureNextDay = p.playDays - f0; pd.futureDateNow = p.lastPlayDate;
      // pass 08 (1): the clock-stepping attacker (playtest 08 A1): +1 day on the device clock and ~3 min 5 s of play, x20.
      // playDays <= 1 + presentTotal / 600, so 20 x 185 s = 3700 s present buys 1 + 6 days, not 20
      p.playDays = 0; p.lastPlayDate = null; p.lastPlayAt = null; p.dayPresent = 0; p.presentTotal = 0;
      for (let k = 1; k <= 20; k++) { const now = day(10, k, 12); for (let t = 0; t < 185; t += 0.5) { p.presentTotal += 0.5; PR.tickPlayDay(0.5, true, now); } }
      pd.stepper20 = p.playDays; pd.stepperPresent = p.presentTotal;
      // a casual 15-min-a-day player is never held back
      p.playDays = 0; p.lastPlayDate = null; p.lastPlayAt = null; p.dayPresent = 0; p.presentTotal = 0;
      for (let k = 1; k <= 10; k++) { const now = day(10, k, 12); for (let t = 0; t < 900; t += 0.5) { p.presentTotal += 0.5; PR.tickPlayDay(0.5, true, now); } }
      pd.casual10 = p.playDays;
      p.presentTotal = ptKeep;
      out.playday = pd;
      p.playDays = keep.pd; p.lastPlayDate = keep.d; p.lastPlayAt = keep.at; p.dayPresent = keep.dp;
      // present-hours gate on deaths (defence in depth)
      const c = PR.crewList().find(x => !x.senior && !x.protected && !MD.favourites().includes(x.id) && G.prog.crew.occ[x.id]);
      const pt0 = p.presentTotal; p.presentTotal = 3600; out.presentGate = MD.deathCheck(c.id, 'hazard').why || 'ok'; p.presentTotal = pt0;
      // (2) away never beats watching: the same patient, fixed (a) by the present Lt fast, (b) by the crew while the player is hidden,
      //     (c) by the Lt's queued repair landing after 70 s idle, (d) during the surgery the player locks the phone
      const mkInj = () => { G.prog.med.inj = []; G.prog.med.scene = null; G.prog.med.day = { pd: -1, n: 0 }; const i = MD.injure('hazard', { id: c.id, sev: 'serious' }); PA.playerInput(); for (let t = 0; t < 25; t++) { PA.playerInput(); SIM.stepSim(0.1); } return i; };
      const aw = {};
      let i = mkInj(); i.fixBy = 'lt'; delete G.ship.faults[i.sys]; PA.playerInput(); SIM.stepSim(0.1); aw.watchedFast = { state: i.state, sx: +i.sx.toFixed(3) };
      // pass 08 (2): seen but not yet tapped, and the Lt's arrival auto-fix lands: the surgery scene counts as seen (killable), not fast
      { G.prog.med.inj = []; G.prog.med.scene = null; G.prog.med.day = { pd: -1, n: 0 }; PA.playerInput(); const j = MD.injure('hazard', { id: c.id, sev: 'serious' }); SIM.stepSim(0.1); SIM.stepSim(0.1); const ack0 = j.ack;
        j.fixBy = 'lt'; delete G.ship.faults[j.sys]; SIM.stepSim(0.1); aw.autoFixUnacked = { ack0, state: j.state, ack: j.ack, fast: j.fast, why: MD.deathCheck(j.id, j.cause, j).why || 'ok' }; }
      i = mkInj(); PA.PACE_RT.hidden = true; delete G.ship.faults[i.sys]; for (let t = 0; t < 6000; t++) SIM.stepSim(0.1);
      aw.hiddenCrewFix = { state: i.state, held: !!i.held, sx: +(i.sx || 0).toFixed(3), alive: !!G.prog.crew.occ[c.id] };
      PA.PACE_RT.hidden = false; PA.playerInput(); SIM.stepSim(0.1); aw.hiddenResumed = { state: i.state, held: !!i.held, ack: i.ack };
      i = mkInj(); PA.PACE_RT.idleT = 70; G.ship.faults[i.sys] && (i.fixBy = 'lt'); delete G.ship.faults[i.sys]; SIM.stepSim(0.1);
      aw.idle70Fix = { state: i.state, held: !!i.held, sx: +(i.sx || 0).toFixed(3), saved: G.prog.med.inj.find(x => x === i) ? i.state === 'stable' : null };
      i = mkInj(); i.fixBy = 'lt'; delete G.ship.faults[i.sys]; PA.playerInput(); SIM.stepSim(0.1); const surg0 = i.surg; PA.PACE_RT.hidden = true; for (let t = 0; t < 3000; t++) SIM.stepSim(0.1);
      aw.lockDuringSurgery = { state: i.state, surgLeftSame: Math.abs(i.surg - surg0) < 0.11 }; PA.PACE_RT.hidden = false;
      // offline catch-up during a surgery (the playtest's L6: 35 s lock -> catch-up): no auto-save
      PA.playerInput(); const cu = __T.catchUp(35); aw.catchUpDuringSurgery = { state: i.state };
      // window never grows back after being away
      i = mkInj(); i.ack = true; for (let t = 0; t < 400; t++) { PA.playerInput(); SIM.stepSim(0.1); } const lBefore = i.left; G.ship.faults[i.sys].sev = 'crit'; __T.catchUp(600); PA.playerInput(); SIM.stepSim(0.1); aw.windowAfterAway = { before: Math.round(lBefore), after: Math.round(i.left), ack: i.ack, state: i.state };   // crit: the night crew can't finish it inside 10 min 
      // pass 08 (3): back from away near the end: at least 30 s (once per injury), re-tap kept; a short hide under 30 s needs the re-tap too
      { i = mkInj(); i.ack = true; G.ship.faults[i.sys].sev = 'crit'; i.left = 11; __T.catchUp(600); PA.playerInput(); SIM.stepSim(0.1); const first = { left: Math.round(i.left), ack: i.ack, floored: i.floored, state: i.state };
        for (let t = 0; t < 30; t++) { PA.playerInput(); SIM.stepSim(0.1); } i.left = 8; __T.catchUp(600); PA.playerInput(); SIM.stepSim(0.1); const second = { left: Math.round(i.left), ack: i.ack, state: i.state };
        aw.returnFloor = { first, second };
        // pass 10 (1): nobody comes back to more time than they left with: leave (off watch, catch-up) with 5 s / 100 s -> back to 5 s / 100 s
        const lv = sec => { const j = mkInj(); j.ack = true; G.ship.faults[j.sys].sev = 'crit'; j.left = sec; __T.catchUp(600); PA.playerInput(); SIM.stepSim(0.1); return { left: +j.left.toFixed(1), ack: j.ack, state: j.state }; };
        aw.leave5 = lv(5); aw.leave100 = lv(100); aw.leave29 = lv(29);
        const h = mkInj(); h.ack = true; h.left = 12; PA.PACE_RT.hidden = true; for (let t = 0; t < 200; t++) SIM.stepSim(0.1); PA.PACE_RT.hidden = false; PA.playerInput(); SIM.stepSim(0.1);
        aw.shortHide = { left: Math.round(h.left), ack: h.ack, state: h.state };
        const h2 = mkInj(); h2.ack = true; h2.left = 100; PA.PACE_RT.hidden = true; for (let t = 0; t < 200; t++) SIM.stepSim(0.1); PA.PACE_RT.hidden = false; PA.playerInput(); SIM.stepSim(0.1);
        aw.shortHideLong = { left: Math.round(h2.left), ack: h2.ack }; }
      { // pass 09 (2): leaving and re-tapping can't improve the odds. Same fix moment, 40 s of sim time after the first ack (past the flat
        // x0.4 part of the fast-fix curve, so a restarted clock would show as better odds);
        // A stays on it, B leaves for 30 s (off watch: back on deck the alert needs a re-tap), C hides briefly under the return
        // floor (needs a re-tap too). B and C's loss chance must be >= A's and their ackT must be the true time since the first ack.
        const pres = sec => { for (let t = 0; t < Math.round(sec * 10); t++) { PA.playerInput(); SIM.stepSim(0.1); } };
        const fix = i => { i.fixBy = 'lt'; delete G.ship.faults[i.sys]; PA.playerInput(); SIM.stepSim(0.1); return { sx: +i.sx.toFixed(4), ackT: +i.ackT.toFixed(1), fast: !!i.fast, state: i.state }; };
        const first = i => { let t = 0; while (!i.acked && t++ < 50) { PA.playerInput(); SIM.stepSim(0.1); } };
        G.prog.med.inj = []; G.prog.med.scene = null; G.prog.med.day = { pd: -1, n: 0 }; PA.playerInput();
        let a = MD.injure('hazard', { id: c.id, sev: 'serious' }); first(a); a.ackT = 0; pres(40); const A = fix(a);
        G.prog.med.inj = []; G.prog.med.scene = null; G.prog.med.day = { pd: -1, n: 0 };
        let b = MD.injure('hazard', { id: c.id, sev: 'serious' }); first(b); b.ackT = 0; pres(5); PA.PACE_RT.offline = true; for (let t = 0; t < 300; t++) SIM.stepSim(0.1); PA.PACE_RT.offline = false;
        PA.playerInput(); SIM.stepSim(0.1); const bUnacked = !b.ack; const re = MD.ackInjury(b.id); pres(40 - 5 - 30 - 0.1); const B = fix(b); B.unackedOnReturn = bUnacked; B.retapped = re;
        G.prog.med.inj = []; G.prog.med.scene = null; G.prog.med.day = { pd: -1, n: 0 };
        let cc = MD.injure('hazard', { id: c.id, sev: 'serious' }); first(cc); cc.ackT = 0; cc.left = 25; pres(5); PA.PACE_RT.hidden = true; for (let t = 0; t < 250; t++) SIM.stepSim(0.1); PA.PACE_RT.hidden = false;
        PA.playerInput(); SIM.stepSim(0.1); const cUnacked = !cc.ack; MD.ackInjury(cc.id); pres(40 - 5 - 25 - 0.1); const C = fix(cc); C.unackedOnReturn = cUnacked;
        aw.retap = { A, B, C, simAfterFirstAck: 40 };
        G.prog.med.inj = []; G.prog.med.scene = null; }
      // Monte Carlo of the loss roll for the odds each path produced: away must never come out ahead
      const roll = (sx, n = 4000) => { let g = 0; for (let k = 0; k < n; k++) if (Math.random() < sx) g++; return g / n; };
      aw.mc = { watchedFast: roll(aw.watchedFast.sx), hiddenCrewFix: roll(aw.hiddenCrewFix.sx), idle70Fix: roll(aw.idle70Fix.sx) };
      out.away = aw; G.prog.med.inj = []; G.prog.med.scene = null;
      // (4) bands + assist
      { const xs = [0, 10, 20, 30, 45, 59, 61, 75, 90, 120]; out.fastCurve = xs.map(x => +(0.3 * MD.fastMult(x)).toFixed(4)); }   // pass 08 (4)
      out.bands = { fast: MD.oddsBand(0.3 * 0.4), assisted: MD.oddsBand(0.3 * 0.4 * 0.75), slow: MD.oddsBand(0.3), epsOpen: MD.oddsBand(0.3 * 1.25), max: MD.oddsBand(0.55) };
      // minors
      const m = {};
      // m1 pronouns: evacuation line uses the patient's own pronoun (Kovac = she); Orvin = they
      MD.setGentle(true); G.prog.med.day = { pd: -1, n: 0 }; G.prog.crew.rolls.hist = []; const K = PR.PROG.deaths, sg = { ...K.surgery }; Object.assign(K.surgery, { chance: 1, max: 1, fastMult: 1, excellentMult: 1, visitMult: 1, assistMult: 1 });
      if (G.prog.crew.occ.kovac) { G.prog.med.inj = []; const ki = MD.injure('hazard', { id: 'kovac', sev: 'serious' }); if (ki) { ki.ack = true; delete G.ship.faults[ki.sys]; for (let t = 0; t < 120; t++) { PA.playerInput(); SIM.stepSim(0.1); } } m.evacLine = G.log.slice(-8).map(e => e.msg).find(x => x.includes('Kovac') && /is (critically|badly) injured/.test(x)) || null; m.evacScene = (MD.sceneOf() || {}).phase; m.evacLog = G.log.slice(-6).map(e => e.msg.slice(0, 120)); }
      MD.setGentle(false); Object.assign(K.surgery, sg); G.prog.med.scene = null;
      const doc = G.prog.crew.occ[G.prog.crew.slots.doctor]; m.orvinPronoun = doc && doc.pronoun;
      // close call (gap blocks the death) -> "closer than they let on"
      Object.assign(K.surgery, { chance: 1, max: 1, fastMult: 1, excellentMult: 1, visitMult: 1, assistMult: 1 }); G.prog.med.lastDeathPD = G.prog.playDays - 1; G.prog.med.lastDeathPT = G.prog.presentTotal; G.prog.med.day = { pd: -1, n: 0 };
      const cc = PR.crewList().find(x => !x.senior && !x.protected && G.prog.crew.occ[x.id] && !MD.isInjured(x.id));
      const ci = MD.injure('hazard', { id: cc.id, sev: 'serious' }); if (ci) { ci.ack = true; delete G.ship.faults[ci.sys]; for (let t = 0; t < 120; t++) { PA.playerInput(); SIM.stepSim(0.1); } }
      m.closeLine = G.log.slice(-6).map(e => e.msg).find(x => /closer than/.test(x)) || null; Object.assign(K.surgery, sg); G.prog.med.scene = null; G.prog.med.lastDeathPD = null; G.prog.med.lastDeathPT = null;
      // m2/m3 homesick: Seo's note, and the spell expires (days with the occasion out of 60)
      const seo = G.prog.crew.occ.seo; if (seo) { const d0 = p.day; let on = 0, note = null; for (let d = 1; d <= 60; d++) { p.day = d; const o = GF.occasionOf(seo); if (o && o.why === 'homesick') { on++; note = o.note; } } p.day = d0; m.homesick = { daysOf60: on, note }; }
      // m5 loved x2: first full-value 'delighted' gift is not halved as a repeat
      const lv = Object.values(G.prog.crew.occ).map(o => ({ o, t: GF.tastesFor(o) })).find(x => x.t && GD.GIFT[x.t.like1.item] && PR.PROG.gifts.tiers[GD.GIFT[x.t.like1.item].tier].loved && !GD.GIFT[x.t.like1.item].cats.includes(x.t.dislike));
      if (lv) { const id = lv.o.id, it = lv.t.like1.item; p.opinions[id] = 0; p.rations = 9999; G.prog.gifts.inv[it] = 2; G.prog.gifts.last = {}; G.prog.gifts.count[id] = {}; G.prog.gifts.giftOp = {}; G.prog.know[id] = { like1: 0, like2: 0, dislike: 0, avoid: 0 }; G.prog.gifts.day = { d: p.day, n: 0 };
        const r1 = GF.giveGift(id, it); G.prog.gifts.last = {}; p.opinions[id] = 0; G.prog.gifts.day = { d: p.day, n: 0 }; const r2 = GF.giveGift(id, it);
        m.loved = { id, item: it, first: r1.r, second: r2.r, d2: r2.d, repeatLine: /already/.test(r2.line), count: G.prog.gifts.count[id][it] }; } else m.loved = { skipped: true };
      // m4 hush: no cheerful quips
      G.prog.med.hushUntil = G.ship.elapsed + 600; const exc = PR.PROG; let cheer = 0; for (let k = 0; k < 200; k++) { const q = PR.repairOutcome('med', true, 100, null, 0); if (/Show-off|Textbook|sweeter|Nice hands|training file/.test(q.line)) cheer++; } m.hushCheer = cheer;
      { // pass 08 leftover: Dr. Orvin as the patient -> 'the duty medic' in every sickbay line
        const did = G.prog.crew.slots.doctor, n0 = G.log.length; G.prog.med.inj = []; G.prog.med.day = { pd: -1, n: 0 }; PA.playerInput();
        const j = did && MD.injure('hazard', { id: did, sev: 'serious' });
        if (j) { for (let t = 0; t < 25; t++) { PA.playerInput(); SIM.stepSim(0.1); } j.fixBy = 'lt'; delete G.ship.faults[j.sys]; PA.playerInput(); SIM.stepSim(0.1); }
        const lines = G.log.slice(n0).map(e => e.msg).filter(t => /sickbay|surgery/i.test(t));
        m.docPatient = { injured: !!j, lines: lines.length, selfSurgeon: lines.filter(t => /Dr\. Orvin (has|takes|:|steps)/.test(t)).length, duty: lines.filter(t => /duty medic/i.test(t)).length };
        G.prog.med.inj = []; G.prog.med.scene = null; }
      { const EV = await import('/js/events.js'), ev = G.sp.ev, act = ev.active; if (!G.sp.battle) { ev.active = null; EV.fireEvent('crewmoment'); m.hushCrewMoment = !!ev.active; ev.active = act; } else m.hushCrewMoment = false; }   // pass 08 (5)
      { // pass 09 (4): the 7 light lines the playtest still saw in the quiet period, through the shared bus.js gate
        const EV = await import('/js/events.js'), BUS = await import('/js/bus.js'), OJ = await import('/js/oddjobs.js'), ev = G.sp.ev, n0 = G.log.length; let mil = 0; BUS.on('fx', k => { if (k === 'milestone' && BUS.hushed()) mil++; });
        const keepAct = ev.active, keepTorps = G.ship.parts, rnd0 = Math.random; const leak = [];
        if (!G.sp.battle) {
          for (const id of ['refugee', 'ferengi']) { ev.active = null; EV.fireEvent(id); ev.active = null; }
          Math.random = () => 0.99;   // no defector trap, no extra storm damage roll
          for (const id of ['storm', 'defector']) { ev.active = null; if (EV.fireEvent(id) !== false && ev.active) { ev.active.trap = false; EV.resolveEvent(true); } ev.active = null; }
          Math.random = rnd0;
        }
        PR.milestone('pt09_hush_check', 'Hush check'); delete G.prog.milestones.pt09_hush_check;
        const lines = G.log.slice(n0).map(e => e.msg);
        for (const re of [/I owe you one/, /broth/, /names a newborn/, /slightly used/, /Asylum granted/, /Personally/, /crew applauds/]) if (lines.some(t => re.test(t))) leak.push(String(re));
        const req = OJ.JOBS.request.find(r => r.quip); m.hushJobLabel = req ? `${req.thing}${BUS.cheer(req.quip, '')}` : null;
        m.hushLight = { lines: lines.length, leak, milestoneFx: mil, jobLabelSober: !!m.hushJobLabel && !/broth/.test(m.hushJobLabel), sample: lines.slice(0, 6).map(t => t.slice(0, 90)) };
        ev.active = keepAct; G.ship.parts = keepTorps; }
      { // pass 10 (2): level-up, promotion and reputation praise in the quiet period: sober toasts, no gold burst / floater / flash
        const BUS = await import('/js/bus.js'), toasts = [], fxs = []; BUS.on('toast', t => { if (BUS.hushed()) toasts.push(t); }); BUS.on('fx', k => { if (BUS.hushed()) fxs.push(k); });
        const keep = { rank: p.rank, hist: p.history.length, rs: { ...p.rankSince }, service: p.service, peak: p.readyPeak, bonus: p.readyBonus, pending: p.promo.pending };
        PR.awardXP(PR.xpToNext ? PR.xpToNext(p.level) + 1 : 99999, 'manual'); PR.repEvent('good', 'praise'); PR.repEvent('good', 'commendation'); PR.promote('readiness');
        p.rank = keep.rank; p.history.length = keep.hist; p.rankSince = keep.rs; p.service = keep.service; p.readyPeak = keep.peak; p.readyBonus = keep.bonus; p.promo.pending = keep.pending; __T.CB && __T.CB.applyTier && __T.CB.applyTier();
        m.hushGold = { toasts, fxs, cheerful: toasts.filter(t => /LEVEL UP|PROMOTED|Praised|Commendation|Clever improvisation/.test(t)), goldFx: fxs.filter(k => ['levelUp', 'promotion', 'floater'].includes(k)) }; }
      G.prog.med.hushUntil = 0;
      { // pass 10 (6): the Fleet Rep log shows the real change near / at the 100000 cap
        const fr0 = p.fleetRep; p.fleetRep = 99990; const n0 = G.log.length; CL.addFleetRep(50, 'a test commendation'); const l1 = G.log.slice(n0).map(e => e.msg).join(' | '), v1 = p.fleetRep;
        const n1 = G.log.length; CL.addFleetRep(50, 'a test commendation'); const l2 = G.log.slice(n1).map(e => e.msg).join(' | '), v2 = p.fleetRep; p.fleetRep = fr0;
        m.fleetLog = { l1, v1, l2, v2 }; }
      // m7 care packages: 8 alumni at +45 where +10 came from care: count at 50% and capped
      const keepA = G.prog.alumni.slice(), keepC = { ...G.prog.gifts.care };
      G.prog.alumni = Array.from({ length: 8 }, (_, k) => ({ id: 'cp' + k, name: 'Ens Cp' + k, short: 'Cp' + k, species: 'human', rank: 1, ladder: 'officer', slot: 'engineer-2', dept: 'eng', role: 'Engineer', opinion: 45, posting: 'sb375', leftDay: 1, leftPD: 1, fr: 3 }));
      for (let k = 0; k < 8; k++) G.prog.gifts.care['cp' + k] = 10;
      const ps = CL.perkState(); m.care = { readiness: ps.readiness, callup: ps.callup, viaCare: ps.goodwordCare };
      for (let k = 0; k < 8; k++) G.prog.gifts.care['cp' + k] = 0; const ps2 = CL.perkState(); m.careOrganic = { readiness: ps2.readiness, callup: ps2.callup };
      G.prog.alumni = keepA; G.prog.gifts.care = keepC;
      // m10 taste conflict: a 'warm' Vulcan / Klingon / Tellarite never loves a sentimental item
      m.taste = ['vulcan', 'klingon', 'tellarite'].map(sp => { const t = GD.tastesOf({ species: sp, tags: ['warm'] }); return { sp, like2: t.like2.item, clash: GD.GIFT[t.like2.item].cats.includes(t.dislike) }; });
      out.minors = m;
      return out;
    });
    S.errors = issues[`${w}x${h}`].slice();
    await p.close();
  }
  // migration: a v12 save last played ~22 h ago on yesterday's date counts its first day at once after the update
  {
    const p = await mk(b, 390, 844, true); await boot(p);
    R.migration = await p.evaluate(async () => {
      const St = await import('/js/state.js'), PR = await import('/js/progression.js'), G = __T.G;
      G.prog.playDays = 9; clearInterval(window.__keepAlive); window.__noSave = false; St.saveGame(); window.__noSave = true;
      const s = JSON.parse(localStorage.getItem('tenacity.save.v1')); s.version = 12; delete s.prog.dayPresent; delete s.prog.presentTotal;
      const y = new Date(Date.now() - 22 * 3600e3); s.prog.lastPlayDate = PR.localDate(new Date(Date.now() - 26 * 3600e3)); s.prog.lastPlayAt = y.getTime() - 3600e3; s.savedAt = Date.now() - 60e3;
      localStorage.setItem('tenacity.save.v1', JSON.stringify(s)); return { wrote: true, pd: s.prog.playDays };
    });
    await p.evaluate(() => { window.__noSave = true; }); await p.goto(BASE); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(800);
    R.migration.after = await p.evaluate(() => ({ version: __T.G.version, pd: __T.G.prog.playDays, dayPresent: __T.G.prog.dayPresent, lastPlayDate: __T.G.prog.lastPlayDate }));
    await p.close();
  }
  const T = R.tests, sz = Object.values(R.sizes);
  const A = T.away, pd = T.playday, M = T.minors;
  R.asserts = {
    zeroErrors: Object.values(issues).every(a => a.length === 0),
    // (1)
    launchAddsNothing: pd.launchOnly === 0 && pd.stepLaunch13 === 0 && pd.flips22 === 0,
    needs3min: pd.after2min === 0 && pd.after3min === 1 && pd.longSameDay === 1,
    shortSessionsCount: pd.shortSessions7 === 7,
    presentCapStepper: pd.stepper20 <= 1 + Math.floor(pd.stepperPresent / 600) && pd.stepper20 < 10,   // pass 08 (1)
    presentCapCasualFree: pd.casual10 === 10,
    futureDateUnfreezes: pd.futureSameDay === 0 && pd.futureNextDay === 1,
    migrationFirstDay: R.migration.after.version === 14 && R.migration.after.pd === R.migration.pd + 1,   // v14 since battle groundwork (the v12 save still walks the v13 step)
    presentHoursGate: T.presentGate === 'too early',
    // (2)
    awayNoFreeSave: A.hiddenCrewFix.state === 'surgery' && A.hiddenCrewFix.held && A.hiddenCrewFix.alive && A.hiddenResumed.state === 'surgery' && !A.hiddenResumed.held,
    idleNoFreeSave: A.idle70Fix.state === 'surgery',
    autoFixSeen: A.autoFixUnacked.ack0 === false && A.autoFixUnacked.state === 'surgery' && A.autoFixUnacked.ack === true && !A.autoFixUnacked.fast && A.autoFixUnacked.why !== 'unseen',   // pass 08 (2)
    surgeryPausesAway: A.lockDuringSurgery.state === 'surgery' && A.lockDuringSurgery.surgLeftSame && A.catchUpDuringSurgery.state === 'surgery',
    awayNeverBetter: A.hiddenCrewFix.sx >= A.watchedFast.sx && A.idle70Fix.sx >= A.watchedFast.sx && A.mc.hiddenCrewFix >= A.mc.watchedFast - 0.02 && A.mc.idle70Fix >= A.mc.watchedFast - 0.02,
    returnFloorOnce: A.returnFloor.first.state === 'warning' && A.returnFloor.first.left === 11 && A.returnFloor.first.ack === false && A.returnFloor.second.left <= 8 && A.returnFloor.second.ack === false,   // pass 08 (3), pass 10 (1): 11 s left -> 11 s back (was raised to 30)
    returnNeverMore: A.leave5.state === 'warning' && A.leave5.left === 5 && A.leave100.left === 100 && A.leave29.left === 29 && !A.leave5.ack && !A.leave100.ack,   // pass 10 (1)
    shortHideRetap: A.shortHide.state === 'warning' && A.shortHide.left === 12 && A.shortHide.ack === false && A.shortHideLong.ack === true,
    windowNeverGrows: A.windowAfterAway.state === 'warning' && A.windowAfterAway.after <= A.windowAfterAway.before && A.windowAfterAway.ack === false,
    // (4)
    retune: Math.abs(A.watchedFast.sx - 0.12) < 0.001,
    fastSmooth: T.fastCurve[0] === 0.12 && T.fastCurve[2] === 0.12 && Math.abs(T.fastCurve[8] - 0.3) < 1e-9 && T.fastCurve.every((v, i, a) => i === 0 || v >= a[i - 1]) && T.fastCurve[6] - T.fastCurve[5] < 0.01,   // pass 08 (4): no 60 s cliff
    bands: T.bands.fast === 'good chance' && T.bands.assisted === 'good chance' && T.bands.slow === 'touch and go' && T.bands.epsOpen === 'grim',
    oddsShown: sz.every(s => s.odds.phase === 'surgery' && /good chance|touch and go|grim/i.test(s.odds.band) && s.odds.assistBtn && !/only runs while you're here/.test(s.odds.text)),
    assistLowers: sz.every(s => s.assisted.assist && s.assisted.btnGone && s.assisted.sx < s.odds.sx),
    tap44: sz.every(s => s.oddsSmall === 0),
    orvinLine: sz.every(s => s.loss.phase === 'lost' && /It wasn't you/.test(s.loss.orvin || '') && /It wasn't you/.test(s.loss.text)),
    // minors
    noteSurgery: sz.every(s => /IN SURGERY/.test(s.noteSurgery || '') && /in surgery — .* operating/.test(s.noteSurgery || '') && !/recovering/.test(s.noteSurgery || '')),   // pass 08 (6)
    noteCountdown: sz.every(s => /clock starts when you respond/.test(s.noteWaiting || '') && /clock running/.test(s.noteRunning || '')),
    pickerFixed: sz.every(s => s.picker.open && s.picker.showThrough === 0),
    pronouns: (!M.evacLine || /\bShe('ll|'s)\b/.test(M.evacLine)) && (!M.closeLine || /closer than (they let|she lets|he lets) on/.test(M.closeLine)) && M.orvinPronoun === 'they',
    homesick: !M.homesick || (M.homesick.daysOf60 > 0 && M.homesick.daysOf60 <= 15 && /missing home/.test(M.homesick.note) && !/It's her/.test(M.homesick.note)),
    lovedReachable: M.loved.skipped || (M.loved.second === 'delighted' && !M.loved.repeatLine && M.loved.count === 1),
    hushNoCheer: M.hushCheer === 0 && M.hushCrewMoment === false,
    hushLight: !!M.hushLight && M.hushLight.lines >= 3 && M.hushLight.leak.length === 0 && M.hushLight.milestoneFx === 0 && M.hushLight.jobLabelSober,   // pass 09 (4)
    hushGold: !!M.hushGold && M.hushGold.toasts.length >= 3 && M.hushGold.cheerful.length === 0 && M.hushGold.goldFx.length === 0,   // pass 10 (2)
    fleetLogReal: !!M.fleetLog && /Fleet Reputation \+10 /.test(M.fleetLog.l1) && M.fleetLog.v1 === 100000 && !/\+\d/.test(M.fleetLog.l2) && /maximum/.test(M.fleetLog.l2) && M.fleetLog.v2 === 100000,   // pass 10 (6)
    retapNoReset: !!A.retap && A.retap.B.unackedOnReturn && A.retap.C.unackedOnReturn && A.retap.B.sx >= A.retap.A.sx && A.retap.C.sx >= A.retap.A.sx
      && A.retap.B.ackT >= 39.5 && A.retap.C.ackT >= 39.5 && sz.every(s => s.retap && s.retap.unacked && s.retap.ackT >= 6 && s.retap.atFix >= 6 && new RegExp(`in ${Math.max(1, Math.round(s.retap.atFix))} seconds?\\.`).test(s.loss.orvin || '')),   // pass 09 (2)
    dutyMedic: M.docPatient.injured && M.docPatient.selfSurgeon === 0 && M.docPatient.duty >= 2,   // pass 08 leftover
    careCapped: M.care.readiness <= 2 && M.care.callup <= 1.25 && M.careOrganic.readiness === 6 && M.careOrganic.callup === 2,
    tasteNoClash: M.taste.every(t => !t.clash),
  };
  R.issues = issues; R.ok = Object.values(R.asserts).every(Boolean);
  fs.writeFileSync(OUT + 'pt07-report.json', JSON.stringify(R, null, 1));
  console.log(JSON.stringify(R, null, 1));
  console.log(R.ok ? 'PT07 PASS' : 'PT07 FAIL ' + JSON.stringify(Object.entries(R.asserts).filter(([, v]) => !v).map(([k]) => k)));
  if (!R.ok) process.exitCode = 1;
  await b.close();
})();
