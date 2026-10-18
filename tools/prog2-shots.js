// Progression phase 2 verification + proof shots -> shots/prog2-*.png, shots/prog2-report.json
// NODE_PATH=/workspace/pwtools/node_modules node tools/prog2-shots.js [base]
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const issues = {}, R = {};
async function mk(b, w, h, mobile) {
  const tag = `${w}x${h}`; issues[tag] = issues[tag] || [];
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) issues[tag].push(`console.${m.type()}: ${m.text()}`); });
  p.on('pageerror', e => issues[tag].push(`pageerror: ${e.message}`));
  p.on('response', r => { if (r.status() >= 400) issues[tag].push(`HTTP ${r.status()} ${r.url()}`); });
  return p;
}
async function boot(p, q = '?debug=1&reset=1') {
  await p.goto(BASE + q);
  await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
  await sleep(400);
  await p.evaluate(() => { const G = __T.G; G.sp.cap.decideT = 1e9; G.ship.nextFault = 1e9; G.sp.ev.nextT = -1; const d = document.querySelector('#debug'); if (d) d.hidden = true; });
}
const shot = (p, name) => p.screenshot({ path: OUT + `prog2-${name}.png` });
// a mid-career Lt jg: level 9 (eligible for Lt), mixed opinions, some rep
const career = p => p.evaluate(async () => {
  const PR = await import('/js/progression.js'), G = __T.G;
  PR.awardXP(2200, 'manual');
  Object.assign(G.prog.opinions, { tren: 34, okafor: 58, diallo: 12, hale: -18, thelev: 71 });
  G.prog.perf.q = 0.74; G.prog.perf.resp = 0.8; G.prog.service = 3.4; G.sp.rep = 210; G.prog.repLifetime = 420; G.prog.repSeen = 210;
  return PR.computeReadiness();
}).then(async r => { await sleep(4500); return r; });   // let the level-up toasts clear
const openSheet = async (p, name) => { await p.evaluate(n => document.querySelector(`.sheetBtns [data-sheet="${n}"]`).click(), name); await sleep(400); };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  // ---------- portrait ----------
  let p = await mk(b, 390, 844, true);
  await boot(p);
  R.readinessPortrait = await career(p);
  await openSheet(p, 'crew'); await p.evaluate(() => document.querySelector('#career').scrollIntoView());
  await shot(p, 'crew-portrait');
  R.crewText = await p.evaluate(() => document.querySelector('#relations').innerText.replace(/\n+/g, ' | '));
  R.careerText = await p.evaluate(() => document.querySelector('#career').innerText.replace(/\n+/g, ' | '));
  await p.locator('#career').screenshot({ path: OUT + 'prog2-readiness.png' });
  // locker expansion from the DUTY sheet: tap the requisition button
  await openSheet(p, 'duty'); await p.evaluate(() => document.querySelector('#reqBox').scrollIntoView());
  await shot(p, 'locker-before');
  R.lockerBefore = await p.evaluate(() => ({ cap: __T.G.ship.partsCap, rep: __T.G.sp.rep, lifetime: __T.G.prog.repLifetime }));
  await p.locator('#reqBox button[data-req="locker"]').click(); await sleep(500);
  R.lockerAfter = await p.evaluate(async () => { const PR = await import('/js/progression.js'); return { cap: __T.G.ship.partsCap, rep: __T.G.sp.rep, lifetime: __T.G.prog.repLifetime, readiness: PR.computeReadiness(), next: document.querySelector('#reqBox').innerText.replace(/\n+/g, ' | ') }; });
  await shot(p, 'locker-after');
  await p.evaluate(() => document.querySelector('#sheetClose').click()); await sleep(300);
  // random reputation events (forced): a good one, then a bad one
  R.repGood = await p.evaluate(async () => { const PR = await import('/js/progression.js'); const r0 = __T.G.sp.rep; const e = PR.repEvent('good', 'praise'); return { id: e.id, d: __T.G.sp.rep - r0, log: __T.G.log.slice(-1)[0].msg }; });
  await sleep(700); await shot(p, 'repevent-good');
  await sleep(2500);
  R.repBad = await p.evaluate(async () => { const PR = await import('/js/progression.js'); const r0 = __T.G.sp.rep; const e = PR.repEvent('bad', 'blamed'); return { id: e.id, d: __T.G.sp.rep - r0, log: __T.G.log.slice(-1)[0].msg, lost: __T.G.prog.repLost }; });
  await sleep(700); await shot(p, 'repevent-bad');
  // readiness floor: a run of heavy losses can't push the meter below min(peak, failedBoardFloor)
  R.floor = await p.evaluate(async () => { const PR = await import('/js/progression.js'), G = __T.G; const before = PR.computeReadiness(); G.prog.repLost += 5000; G.prog.perf.q = 0; G.prog.perf.resp = 0; const after = PR.computeReadiness(); return { before, peak: G.prog.readyPeak, after, floor: PR.readinessFloor(), floorConst: __T.PROG.readiness.failedBoardFloor }; });
  await p.evaluate(() => { __T.G.prog.perf.q = 0.74; __T.G.prog.perf.resp = 0.8; __T.G.prog.repLost = 0; });
  // opinion rules: daily cap, diminishing returns, ignored fault
  R.opinion = await p.evaluate(async () => {
    const PR = await import('/js/progression.js'), F = await import('/js/faults.js'), sim = await import('/js/sim.js'), P = await import('/js/pacing.js'), G = __T.G;
    G.prog.opDay = {}; const d0 = PR.opinionOf('diallo'); for (let i = 0; i < 20; i++) PR.nudge('diallo', 3, 'test'); const capGain = +(PR.opinionOf('diallo') - d0).toFixed(2);
    const t0 = PR.opinionOf('thelev'); G.prog.opDay = {}; PR.nudge('thelev', 3, 'test'); const dimGain = +(PR.opinionOf('thelev') - t0).toFixed(2);
    G.prog.opDay = {}; const o0 = PR.opinionOf('okafor'); F.spawnFault('ambient', 'eps', 'low'); G.ship.faults.eps.t = 299; __T.app.paused = true; P.playerInput(); sim.stepSim(2); P.playerInput(); sim.stepSim(2); __T.app.paused = false;
    return { dailyCapGain_20x3: capGain, dayUp: __T.PROG.opinion.dayUp, dimGainAt71_from3: dimGain, okaforIgnored: +(PR.opinionOf('okafor') - o0).toFixed(2) };
  });
  await sleep(3000);   // let the rep-event floaters clear
  // promotion (level 9, eligible): readiness path via the promotionDue hook chain
  R.promotion = await p.evaluate(async () => { const PR = await import('/js/progression.js'); const ok = PR.promotionDue('readiness'); return { ok, rank: PR.rankName(), hist: __T.G.prog.history, tile: document.querySelector('.stat[data-stat="level"] .k').innerText }; });
  await sleep(900); await shot(p, 'promotion-toast');
  R.tileAfter = await p.evaluate(() => document.querySelector('.stat[data-stat="level"]').innerText.replace(/\n/g, ' '));
  // phase-4 interception hook: a handler returning true takes over (pending), no promotion applied
  R.hook = await p.evaluate(async () => { const PR = await import('/js/progression.js'); PR.awardXP(30000, 'manual'); PR.hooks.promotionDue.push(() => true); const r = PR.promotionDue('readiness'); const out = { handled: r, pending: __T.G.prog.promo.pending, rank: PR.rankName() }; PR.hooks.promotionDue.length = 0; __T.G.prog.promo.pending = false; return out; });
  // migrations: v2 save (phase-1 prog, no phase-2 fields) and v1 save (no prog at all)
  for (const v of [2, 1]) {
    await p.evaluate(async v => {
      const St = await import('/js/state.js'); const old = JSON.parse(JSON.stringify(__T.G)); old.version = v; old.savedAt = Date.now();
      if (v === 1) { delete old.version; delete old.prog; old.stats.repairs = 40; old.stats.nightFixes = 60; }
      else { const q = old.prog; for (const k of ['opinions', 'opDay', 'opStation', 'perf', 'service', 'rankSince', 'history', 'crewExtra', 'lockerTier', 'readyParts', 'promo', 'repLost', 'readyPeak', 'repEv']) delete q[k]; q.rank = 0; q.level = 9; q.xp = 10; }
      localStorage.setItem(St.SAVE_KEY, JSON.stringify(old)); window.__noSave = true;
    }, v);
    await p.goto(BASE + '?debug=1');
    await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
    await sleep(1500);
    R['migrate_v' + v] = await p.evaluate(() => ({ version: __T.G.version, level: __T.G.prog.level, rank: __T.G.prog.rank, opinions: __T.G.prog.opinions, readiness: __T.G.prog.readiness, cap: __T.G.ship.partsCap }));
  }
  // ---------- landscape ----------
  p = await mk(b, 844, 390, true);
  await boot(p); await career(p);
  await openSheet(p, 'crew'); await p.evaluate(() => document.querySelector('#relations').scrollIntoView({ block: 'end' }));
  await shot(p, 'crew-landscape');
  R.landscapeVisible = await p.evaluate(() => { const r = document.querySelector('#relations').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x) }; });
  // ---------- desktop ----------
  p = await mk(b, 1280, 800, false);
  await boot(p); await career(p);
  await p.evaluate(() => document.querySelector('#career').scrollIntoView());
  await shot(p, 'crew-desktop');
  R.desktopVisible = await p.evaluate(() => { const r = document.querySelector('#relations').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x) }; });
  R.issues = issues;
  fs.writeFileSync(OUT + 'prog2-report.json', JSON.stringify(R, null, 1));
  console.log(JSON.stringify(R, null, 1));
  await b.close();
})();
