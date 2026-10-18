// Pass 06 (deaths HOLD fixes): presence-only injury clock, away stabilise, live surgery outcome, gentle prompt, evacuation
// goodbye, memorial text + the hidden / idle / date-tampering tests, at 390x844 / 844x390 / 1280x800.
// -> shots/pt06-*.png + shots/pt06-report.json     NODE_PATH=/workspace/pwtools/node_modules node tools/pt06-shots.js [base]
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
async function boot(p) {
  await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(400);
  await p.evaluate(async () => {
    const PA = await import('/js/pacing.js'), PR = await import('/js/progression.js'), G = __T.G; window.__PA = PA; window.__noSave = true;
    window.__keepAlive = setInterval(() => PA.playerInput(), 1000);   // an attentive player
    G.sp.cap.decideT = 1e9; G.ship.nextFault = 1e9; G.sp.ev.nextT = -1;
    PR.awardXP(9000, 'manual'); G.prog.rank = 1; __T.CB.applyTier(); G.prog.specOffered = 99; G.prog.playDays = 20; G.prog.presentTotal = 1e6; G.prog.day = 24; G.prog.med.asked = true; G.prog.med.prompt12 = true;
    Object.assign(G.prog.opinions, { okafor: 81, diallo: 66, thelev: 77, tull: 52, kovac: 61, rhovan: 70, mollo: 44 });
  });
  await sleep(2500);
}
const shot = (p, name, tag) => p.screenshot({ path: OUT + `pt06-${name}${tag ? '-' + tag : ''}.png` });
const openSheet = async (p, n) => { await p.evaluate(n => document.querySelector(`.sheetBtns [data-sheet="${n}"]`).click(), n); await sleep(450); if (n === 'log') await p.evaluate(() => { const l = document.querySelector('#p-log'); if (l) l.scrollIntoView({ block: 'start' }); }); await sleep(200); };
const closeSheet = p => p.evaluate(() => { const c = document.querySelector('#sheetClose'); if (c) c.click(); }).then(() => sleep(300));
const closeMed = p => p.evaluate(() => { const b = document.querySelector('#medPanel [data-med=close]'); if (b) b.click(); }).then(() => sleep(300));
const regular = p => p.evaluate(() => { const s = __T.G.prog.crew.slots; return { e1: s['engineer-1'], tc: s.transporter, yeo: s.yeoman, e2: s['engineer-2'], sec: s.security, crewman: s.crewman, favs: __T.MD.favourites() }; });
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [w, h, mob, tag] of [[390, 844, true, ''], [844, 390, true, 'landscape'], [1280, 800, false, 'desktop']]) {
    const p = await mk(b, w, h, mob), S = R.sizes[tag || 'portrait'] = {};
    await boot(p); const ids = await regular(p);
    // 1) the gentle-mode prompt (play day 12, deaths not yet possible)
    await p.evaluate(() => { const G = __T.G; G.prog.playDays = 12; G.prog.med.prompt12 = false; }); await sleep(800);
    S.prompt = await p.evaluate(() => ({ shown: !document.querySelector('#safetyPanel').hidden, text: document.querySelector('#safetyBody').innerText.slice(0, 160), small: [...document.querySelectorAll('#safetyPanel button')].map(x => x.getBoundingClientRect()).filter(r => r.width < 44 || r.height < 44).length }));
    await shot(p, 'gentle-prompt', tag);
    await p.evaluate(() => document.querySelector('#safetyPanel [data-safety=standard]').click()); await sleep(300);
    S.promptAnswered = await p.evaluate(() => ({ prompt12: __T.G.prog.med.prompt12, gentle: __T.MD.gentle(), again: !document.querySelector('#safetyPanel').hidden }));
    await p.evaluate(() => { __T.G.prog.playDays = 20; });
    // 2) the medical alert pill: red cross + live countdown (unseen -> seen by a tap)
    const sys = await p.evaluate(id => { const i = __T.MD.injure('hazard', { id, sev: 'serious', what: 'the subspace shear' }); return i && i.sys; }, ids.e1);
    await sleep(700); S.pillUnseen = await p.evaluate(() => document.querySelector('#alertPill').innerText);
    await p.mouse.move(5, 5); await p.evaluate(() => __PA.playerInput()); await sleep(2600);
    S.pillSeen = await p.evaluate(() => ({ text: document.querySelector('#alertPill').innerText, cls: document.querySelector('#alertPill').className, ack: __T.G.prog.med.inj[0].ack, left: +__T.G.prog.med.inj[0].left.toFixed(1) }));
    await shot(p, 'medical-alert', tag);
    // 3) the live sickbay outcome: the Lt restores the system -> Dr. Orvin operates (scene), saved (chance forced 0)
    await p.evaluate(() => { window.__sc0 = __T.PROG.deaths.surgery.chance; __T.PROG.deaths.surgery.chance = 0; });
    await p.evaluate(s => { delete __T.G.ship.faults[s]; }, sys); await sleep(1800);
    S.surgery = await p.evaluate(() => ({ phase: (__T.MD.sceneOf() || {}).phase, shown: !document.querySelector('#medPanel').hidden, text: document.querySelector('#medBody').innerText.slice(0, 200) }));
    await shot(p, 'sickbay-surgery', tag);
    await p.waitForFunction(() => (__T.MD.sceneOf() || {}).phase === 'saved', null, { timeout: 30000 }); await sleep(400);
    S.saved = await p.evaluate(() => document.querySelector('#medBody').innerText.slice(0, 200));
    S.medSmall = await p.evaluate(() => [...document.querySelectorAll('#medPanel button'), document.querySelector('#alertPill')].map(x => x.getBoundingClientRect()).filter(r => r.width && (r.width < 44 || r.height < 44)).length);
    await shot(p, 'sickbay-saved', tag); await closeMed(p);
    // 4) the live sickbay outcome when Dr. Orvin can't save them (chance forced 1; every safeguard allows it)
    await p.evaluate(() => { const K = __T.PROG.deaths; window.__sg = { ...K.surgery }; Object.assign(K.surgery, { chance: 1, max: 1, fastMult: 1, excellentMult: 1, visitMult: 1 }); __T.G.prog.med.day = { pd: -1, n: 0 }; __T.G.prog.crew.rolls.hist = []; });
    const s2 = await p.evaluate(id => { const i = __T.MD.injure('hazard', { id, sev: 'serious', what: 'the intruder loose in the systems' }); i.ack = true; return i.sys; }, ids.tc);
    await p.evaluate(s => { delete __T.G.ship.faults[s]; }, s2);
    await p.waitForFunction(() => { const s = __T.MD.sceneOf(); return s && s.phase !== 'surgery'; }, null, { timeout: 30000 }); await sleep(500);
    S.lost = await p.evaluate(id => ({ phase: __T.MD.sceneOf().phase, gone: !__T.G.prog.crew.occ[id], text: document.querySelector('#medBody').innerText.slice(0, 260), audit: __T.G.prog.med.audit.slice(-1)[0], hushed: __T.MD.hushed() }), ids.tc);
    await shot(p, 'sickbay-lost', tag); await closeMed(p);
    // hush: a cheerful floater is swallowed; the memorial waits (not the same second)
    S.hush = await p.evaluate(() => !__T.G.prog.med.memPending ? { memNotBefore: -1, hushFor: -1 } : ({ memNotBefore: Math.round(__T.G.prog.med.memPending.notBefore - __T.G.ship.elapsed), hushFor: Math.round(__T.G.prog.med.hushUntil - __T.G.ship.elapsed) }));
    // 5) memorial service text (department crew, real opinion change)
    await p.evaluate(() => { const m = __T.G.prog.med; if (m.memPending) m.memPending.notBefore = __T.G.ship.elapsed + 1; m.hushUntil = 0; __T.sendUse('mess', { force: true }); });
    await p.waitForFunction(() => !__T.G.prog.med.memPending, null, { timeout: 90000 }).catch(() => {}); await sleep(600);
    S.memorial = await p.evaluate(() => __T.G.log.slice(-6).map(e => e.msg).filter(m => /service|plaque|friends noticed|light burning|memoriam|Ship's log|lost|quiet/i.test(m)));
    await openSheet(p, 'log'); await shot(p, 'memorial', tag); await closeSheet(p);
    // 6) gentle mode: evacuation with its own goodbye (not the transfer handshake)
    await p.evaluate(() => { const K = __T.PROG.deaths; __T.MD.setGentle(true); __T.G.prog.med.day = { pd: -1, n: 0 }; __T.G.prog.crew.rolls.hist = []; __T.G.prog.med.lastDeathPT = null; __T.G.prog.med.lastDeathPD = null; });
    const s3 = await p.evaluate(id => { const i = __T.MD.injure('hazard', { id, sev: 'serious' }); i.ack = true; return i.sys; }, ids.sec);
    await p.evaluate(s => { delete __T.G.ship.faults[s]; }, s3);
    await p.waitForFunction(() => { const s = __T.MD.sceneOf(); return s && s.phase === 'evac'; }, null, { timeout: 30000 }).catch(() => {}); await sleep(500);
    S.evac = await p.evaluate(() => ({ phase: (__T.MD.sceneOf() || {}).phase, line: __T.G.log.slice(-4).map(e => e.msg).find(m => /Medical evacuation/.test(m)) || null, handshake: __T.G.log.slice(-4).some(e => /shakes the/.test(e.msg)) }));
    await shot(p, 'evac-scene', tag); await closeMed(p);
    await openSheet(p, 'log'); await shot(p, 'evac-goodbye', tag); await closeSheet(p);
    await p.evaluate(() => { __T.MD.setGentle(false); Object.assign(__T.PROG.deaths.surgery, window.__sg, { chance: window.__sc0 }); });
    // ---- portrait only: presence + tampering tests ----
    if (!tag) R.tests = await p.evaluate(async ids => {
      const MD = __T.MD, G = __T.G, PA = __PA, SIM = await import('/js/sim.js'), PR = await import('/js/progression.js'), out = {};
      clearInterval(window.__keepAlive); __T.app.paused = true;
      G.prog.med.inj = []; G.prog.med.day = { pd: -1, n: 0 }; G.prog.crew.rolls.hist = []; G.prog.med.lastDeathPD = null; G.prog.med.lastDeathPT = null;
      const c = PR.crewList().find(x => !x.senior && !x.protected && !MD.favourites().includes(x.id) && G.prog.crew.occ[x.id]);
      const mk = () => { G.prog.med.inj = []; G.prog.med.day = { pd: -1, n: 0 }; const i = MD.injure('hazard', { id: c.id, sev: 'serious' }); PA.playerInput(); return i; };
      // (a) the clock doesn't start until the alert is seen (no input since it appeared)
      let i = mk(); PA.PACE_RT.idleT = 0.6; for (let t = 0; t < 30; t++) { PA.PACE_RT.idleT = Math.max(PA.PACE_RT.idleT, 0.6); SIM.stepSim(0.1); }
      out.unseenNoClock = { ack: i.ack, left: +i.left.toFixed(1) };
      PA.playerInput(); SIM.stepSim(0.1); SIM.stepSim(0.1); out.seenAfterInput = { ack: i.ack };
      // (b) hidden: document.hidden + visibilitychange -> paused, no matter how long
      const l0 = i.left; Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'));
      for (let t = 0; t < 600; t++) { PA.playerInput(); SIM.stepSim(0.1); }
      out.hiddenPaused = { drop: +(l0 - i.left).toFixed(2), present: PA.isPresent() };
      delete document.hidden; Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); PA.PACE_RT.hidden = false; __T.app.paused = true;
      // (b) idle: the clock runs for the first 60 s without input, then stops (night mode at 180 s too)
      PA.playerInput(); const l1 = i.left; for (let t = 0; t < 3000; t++) SIM.stepSim(0.1);
      out.idlePaused = { drop: Math.round(l1 - i.left), idleT: Math.round(PA.PACE_RT.idleT), night: PA.nightActive(), alive: !!G.prog.crew.occ[c.id] };
      // back from night mode: a fresh window, needs seeing again
      const lN = i.left; PA.playerInput(); SIM.stepSim(0.1); out.freshAfterNight = { left: Math.round(i.left), before: Math.round(lN), ack: i.ack };   // pass 07: the clock RESUMES (never a fresh, longer window), needs seeing again
      // (f) date tampering: backward, repeated, forward jumps
      const p = G.prog, keep = { pd: p.playDays, d: p.lastPlayDate, at: p.lastPlayAt }, day = (y, m, d, h = 12) => new Date(y, m - 1, d, h);
      p.playDays = 10; p.lastPlayDate = null; p.lastPlayAt = null;
      const seq = [], mark = (label, dt, pres = 999) => { PR.markPlayDay(dt, pres); seq.push([label, p.playDays]); };   // pass 07: a day also needs ~3 min of present play (999 = played)
      mark('first day', day(2026, 10, 1)); mark('same date again', day(2026, 10, 1, 20)); mark('backward a week', day(2026, 9, 24));
      mark('next real day', day(2026, 10, 2)); mark('backward again', day(2026, 10, 1, 23)); mark('repeat next day', day(2026, 10, 2, 22));
      mark('forward +30 days', day(2026, 11, 1)); mark('back to real', day(2026, 10, 3));
      for (let k = 0; k < 22; k++) mark(`flip ${k}`, k % 2 ? day(2026, 10, 3) : day(2026, 11, 1), 0);   // pass 07: relaunch-only flips (no present play); with play see pt07-shots
      mark('real days catch up, day after the furthest date', day(2026, 11, 2));
      mark('midnight hop (2 min later, new date)', day(2026, 11, 3, 0));
      out.tamper = { seq: seq.filter(([l]) => !/^flip [1-9]/.test(l) || l === 'flip 21'), final: p.playDays, flipsAdded: seq.find(x => x[0] === 'flip 21')[1] - seq.find(x => x[0] === 'back to real')[1] };
      // the playtest's 22-flip attack: count days gained purely from flips
      p.playDays = keep.pd; p.lastPlayDate = keep.d; p.lastPlayAt = keep.at;
      // (f) an injury from day 13 can't kill until it resolves on day 14 or later
      const K = __T.PROG.deaths, kc = [K.deathChance, K.maxChance]; K.deathChance = 1; K.maxChance = 1;
      p.playDays = 13; G.prog.med.lastDeathPD = null; G.prog.med.lastDeathPT = null; G.prog.crew.rolls.hist = [];
      i = mk(); i.ack = true; i.left = 0.05; for (let t = 0; t < 3; t++) { PA.playerInput(); SIM.stepSim(0.1); }
      out.day13 = { alive: !!G.prog.crew.occ[c.id], state: MD.injuryOf(c.id) && MD.injuryOf(c.id).state };
      G.prog.med.inj = []; p.playDays = 13; i = mk(); i.ack = true; i.left = 30; p.playDays = 14; i.left = 0.05; for (let t = 0; t < 3; t++) { PA.playerInput(); SIM.stepSim(0.1); }
      out.day13to14 = { alive: !!G.prog.crew.occ[c.id], audit: G.prog.med.audit.slice(-1)[0] };
      K.deathChance = kc[0]; K.maxChance = kc[1]; p.playDays = keep.pd;
      return out;
    }, ids);
    await p.close();
  }
  const T = R.tests, P0 = R.sizes.portrait;
  R.asserts = {
    zeroErrors: Object.values(issues).every(a => a.length === 0),
    tap44: Object.values(R.sizes).every(s => s.prompt.small === 0 && s.medSmall === 0),
    prompt: Object.values(R.sizes).every(s => s.prompt.shown && s.promptAnswered.prompt12 && !s.promptAnswered.again),
    pill: Object.values(R.sizes).every(s => /✚/.test(s.pillSeen.text) && /\d:\d\d/.test(s.pillSeen.text) && s.pillSeen.ack && /med/.test(s.pillSeen.cls)),
    surgeryScene: Object.values(R.sizes).every(s => s.surgery.phase === 'surgery' && s.surgery.shown),
    lostLive: Object.values(R.sizes).every(s => s.lost.phase === 'lost' && s.lost.gone && s.lost.audit.present === true && s.lost.audit.how === 'surgery'),
    memorialDelayed: Object.values(R.sizes).every(s => s.hush.memNotBefore >= 590 && s.hush.hushFor >= 590),
    evacGoodbye: Object.values(R.sizes).every(s => s.evac.line && !s.evac.handshake),
    unseenNoClock: T.unseenNoClock.ack === false && T.unseenNoClock.left === 180 && T.seenAfterInput.ack === true,
    hiddenPaused: T.hiddenPaused.drop === 0 && T.hiddenPaused.present === false,
    idlePaused: T.idlePaused.drop <= 61 && T.idlePaused.alive,
    freshAfterNight: T.freshAfterNight.left <= T.freshAfterNight.before && T.freshAfterNight.ack === false,   // pass 07: resumes, not fresh
    tamper: T.tamper.flipsAdded <= 0 && T.tamper.final <= 10 + 4,
    day13: T.day13.alive && !T.day13to14.alive && T.day13to14.audit && T.day13to14.audit.pd >= 14,
  };
  R.issues = issues; R.ok = Object.values(R.asserts).every(Boolean);
  fs.writeFileSync(OUT + 'pt06-report.json', JSON.stringify(R, null, 1));
  console.log(JSON.stringify(R, null, 1));
  console.log(R.ok ? 'PT06 PASS' : 'PT06 FAIL ' + JSON.stringify(R.asserts));
  if (!R.ok) process.exitCode = 1;
  await b.close();
})();
