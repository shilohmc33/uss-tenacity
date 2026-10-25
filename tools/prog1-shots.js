// Progression phase 1 verification + proof shots -> shots/prog1-*.png, shots/prog1-report.json
// NODE_PATH=/workspace/pwtools/node_modules node tools/prog1-shots.js [base]
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const issues = {}, R = {};
async function mk(b, w, h, mobile) {
  const tag = `${w}x${h}`; issues[tag] = issues[tag] || [];
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript(() => { window.__TENACITY_SKIP_NAME = true; window.__TENACITY_SKIP_BG = true; window.__TENACITY_NO_IDLE = true; });   // v18: skip the name / Academy prompts; no idle pause in long shot runs
  const p = await ctx.newPage();
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) issues[tag].push(`console.${m.type()}: ${m.text()}`); });
  p.on('pageerror', e => issues[tag].push(`pageerror: ${e.message}`));
  p.on('response', r => { if (r.status() >= 400) issues[tag].push(`HTTP ${r.status()} ${r.url()}`); });
  return p;
}
async function boot(p, q = '?debug=1&reset=1') {
  await p.goto(BASE + q);
  await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 30000 });
  await sleep(400);
  await p.evaluate(() => { const G = __T.G; G.sp.cap.decideT = 1e9; G.ship.nextFault = 1e9; G.sp.ev.nextT = -1; const d = document.querySelector('#debug'); if (d) d.hidden = true; });
}
const shot = (p, name) => p.screenshot({ path: OUT + `prog1-${name}.png` });
// put the Lt mid-level with a part-filled XP bar
const midLevel = p => p.evaluate(() => { const P = __T.G.prog; __T.awardXP(700, 'manual'); return { level: P.level, xp: P.xp }; });
const tile = p => p.evaluate(() => { const el = document.querySelector('.stat[data-stat="level"]'), r = el.getBoundingClientRect(), m = document.querySelector('#m-level');
  return { text: el.innerText.replace(/\n/g, ' '), visible: r.width > 20 && r.height > 20 && r.bottom <= innerHeight && r.right <= innerWidth, w: Math.round(r.width), h: Math.round(r.height), bar: m.style.width, title: el.title }; });
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  // ---------- portrait phone ----------
  let p = await mk(b, 390, 844, true);
  await boot(p);
  // manual detection: a real tap on the alert pill (player order) vs a fault that appears where he already stands
  await p.evaluate(async () => { const F = await import('/js/faults.js'); F.spawnFault('ambient', 'shields', 'low'); });
  await sleep(300);
  await p.locator('#alertPill').click();
  await p.waitForFunction(() => __T.G.lt.mode === 'repair', null, { timeout: 30000 });
  R.manualTap = await p.evaluate(() => ({ repairManual: __T.G.lt.repairManual, sys: __T.G.lt.repairSys }));
  await p.waitForFunction(() => __T.G.lt.mode !== 'repair', null, { timeout: 30000 });
  R.afterManual = await p.evaluate(() => ({ manualXp: __T.G.prog.xpManual, autoXp: __T.G.prog.xpAuto, level: __T.G.prog.level, milestones: __T.G.prog.milestones }));
  // v18: he's at the shield console; a fault there waits for an order (no own-initiative repair), then he's ordered to it
  await p.evaluate(() => __T.playerOrder(() => __T.sendUse('shield', { force: true })));
  await p.waitForFunction(() => __T.G.lt.mode === 'use' && __T.G.lt.node === 'shield', null, { timeout: 30000 });
  await p.evaluate(async () => { const F = await import('/js/faults.js'); F.spawnFault('ambient', 'shields', 'low'); });
  await sleep(3000); R.noSelfRepair = await p.evaluate(() => ({ mode: __T.G.lt.mode, fault: !!__T.G.ship.faults.shields }));   // v18: no own-initiative repair; the fault waits for an order
  await p.evaluate(() => __T.playerOrder(() => __T.sendRepair('shields')));
  await p.waitForFunction(() => __T.G.lt.mode === 'repair', null, { timeout: 30000 });
  R.autoPickup = await p.evaluate(() => ({ repairManual: __T.G.lt.repairManual }));
  await p.waitForFunction(() => __T.G.lt.mode !== 'repair', null, { timeout: 30000 });
  await sleep(2600);
  await midLevel(p); await sleep(3500);
  R.portrait = await tile(p);
  await shot(p, 'xpbar-portrait');
  // level-up toast: top the bar up to just under the threshold, then one repair-sized award
  await p.evaluate(() => { const P = __T.G.prog; const need = (__T.PROG.curve.base * Math.pow(P.level, 1.5)); P.xp = Math.round(need / 5) * 5 - 6; __T.awardXP(10, 'manual'); });
  await sleep(700);
  R.levelUp = await p.evaluate(() => ({ level: __T.G.prog.level, toasts: [...document.querySelectorAll('#toasts > *')].map(t => t.innerText), flash: document.querySelector('.stat[data-stat="level"]').classList.contains('lvlup') }));
  await shot(p, 'levelup-toast');
  // excellent quality roll (forced odds), manual order through the player-order path
  await p.evaluate(async () => {
    const Q = __T.PROG.quality.excellent; window.__q = { ...Q }; Q.base = 1; Q.capManual = 1; Q.capAuto = 1;
    __T.G.ship.parts = 6; __T.G.prog.chatT = 1e9;
    const F = await import('/js/faults.js'); F.spawnFault('ambient', 'warpcore', 'med');
    __T.playerOrder(() => __T.sendRepair('warpcore'));
  });
  await p.waitForFunction(() => __T.G.lt.mode === 'repair', null, { timeout: 30000 });
  await p.waitForFunction(() => __T.G.lt.mode !== 'repair', null, { timeout: 30000 });
  await sleep(1300);
  await shot(p, 'excellent-floater');
  R.excellent = await p.evaluate(() => { Object.assign(__T.PROG.quality.excellent, window.__q); return { quality: __T.G.prog.quality, log: __T.G.log.slice(-6).map(e => e.msg) }; });
  // offline report with XP: back-date the save by 3 h and reload
  await p.evaluate(async () => { const St = await import('/js/state.js'); __T.G.ship.nextFault = 120; __T.G.sp.cap.decideT = 3; __T.G.sp.ev.nextT = -1; __T.G.savedAt = Date.now() - 3 * 3600e3; __T.G.prog.lastSeen = __T.G.savedAt; localStorage.setItem(St.SAVE_KEY, JSON.stringify(__T.G)); window.__noSave = true; });
  R.beforeOffline = await p.evaluate(() => ({ level: __T.G.prog.level, totalXp: __T.G.prog.totalXp, day: __T.G.prog.day }));
  await p.goto(BASE + '?debug=1');
  await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
  await sleep(600);
  R.offline = await p.evaluate(() => ({ shown: !!document.querySelector('#wbCard.bow:not([hidden])'), line: (document.querySelector('#wbCard.bow:not([hidden])') || {}).innerText || null,   /* v18: BACK ON WATCH, no offline XP */ level: __T.G.prog.level, totalXp: __T.G.prog.totalXp, offlineXp: __T.G.prog.xpOffline, day: __T.G.prog.day }));
  await p.evaluate(() => { const d = document.querySelector('#debug'); if (d) d.hidden = true; });
  await shot(p, 'offline-report');
  // save migration: a v1 save (no version / prog) with a veteran's stats
  await p.evaluate(async () => {
    const St = await import('/js/state.js'); const old = JSON.parse(JSON.stringify(__T.G)); delete old.version; delete old.prog;
    old.stats.repairs = 40; old.stats.nightFixes = 60; old.stats.events = 10; old.stats.legs = 12; old.sp.rep = 120; old.savedAt = Date.now();
    if (old.sp.battle) old.sp.battle.hull = -12;
    localStorage.setItem(St.SAVE_KEY, JSON.stringify(old)); window.__noSave = true;
  });
  await p.goto(BASE + '?debug=1');
  await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
  await sleep(500);
  R.migration = await p.evaluate(() => ({ version: __T.G.version, level: __T.G.prog.level, xp: __T.G.prog.xp, totalXp: __T.G.prog.totalXp, repLifetime: __T.G.prog.repLifetime, milestones: __T.G.prog.milestones, day: __T.G.prog.day, hud: document.querySelector('#v-level').innerText }));
  // N-2: idle tab (no input) hull floor; N-3: enemy hull never negative
  R.n2n3 = await p.evaluate(async () => {
    const sim = await import('/js/sim.js'), B = await import('/js/battle.js'), P = await import('/js/pacing.js'); __T.app.paused = true;
    const G = __T.G; P.PACE_RT.idleT = 1e6; G.ship.hull = 3; sim.stepSim(0.05); const idleHull = G.ship.hull;
    P.PACE_RT.idleT = 0; G.ship.hull = 3; sim.stepSim(0.05); const activeHull = G.ship.hull;
    P.PACE_RT.sessionT = 1e5; G.sp.lastBattleT = -1e9; G.sp.battle = null; const started = B.startBattle('enroute'); let minEnemy = 999;
    for (let i = 0; i < 4000 && G.sp.battle; i++) { if (G.sp.battle.hull > 5) G.sp.battle.hull = 5; sim.stepSim(0.05); if (G.sp.battle) minEnemy = Math.min(minEnemy, G.sp.battle.hull); }
    __T.app.paused = false;
    return { started, idleHull: +idleHull.toFixed(2), activeHull: +activeHull.toFixed(2), floor: P.PACE.offlineHullFloor, minEnemyHull: minEnemy, battleOver: !G.sp.battle };
  });
  // ---------- N-1: T'Ren steps aside when the Lt targets her spot (bridge) ----------
  await boot(p);
  R.n1 = await p.evaluate(async () => { const C = await import('/js/crew.js'); C.rideLiftTo('bridge'); return true; });
  await p.waitForFunction(() => __T.G.lt.deck === 'bridge' && !__T.G.lt.lift && __T.G.lt.mode !== 'walk', null, { timeout: 60000 });
  await p.evaluate(() => { __T.tren.mode = 'home'; __T.tren.t = 1e9; });
  R.n1 = await p.evaluate(() => { const t = __T.tren; const at = { x: t.x, y: t.y }; __T.playerOrder(() => __T.sendTo(t.x, t.y, { kind: 'walk' })); return { trenAt: at }; });
  await p.waitForFunction(() => __T.G.lt.mode !== 'walk', null, { timeout: 30000 });
  await sleep(800);
  R.n1 = await p.evaluate(a => { const t = __T.tren, L = __T.G.lt, d = (x1, y1, x2, y2) => Math.round(Math.hypot((x1 - x2) * 960, (y1 - y2) * 640)); return { ...a, trenMode: t.mode, trenMoved: d(t.x, t.y, a.trenAt.x, a.trenAt.y), ltToTren: d(L.x, L.y, t.x, t.y) }; }, R.n1);
  await shot(p, 'n1-tren-aside');
  // ---------- landscape phone ----------
  p = await mk(b, 844, 390, true);
  await boot(p); await midLevel(p); await sleep(3500);
  R.landscape = await tile(p);
  await shot(p, 'xpbar-landscape');
  // ---------- desktop ----------
  p = await mk(b, 1280, 800, false);
  await boot(p); await midLevel(p); await sleep(3500);
  R.desktop = await tile(p);
  await shot(p, 'xpbar-desktop');
  R.issues = issues;
  fs.writeFileSync(OUT + 'prog1-report.json', JSON.stringify(R, null, 1));
  console.log(JSON.stringify(R, null, 1));
  await b.close();
})();
