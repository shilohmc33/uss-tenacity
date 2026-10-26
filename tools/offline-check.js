// No offline quests check (notes/2026-10-25-no-offline-quests-plan.md, approved Oct 25; save v18). Per size:
//  1. close-and-reopen after a simulated 8 h gap (v18 save): nothing advanced (sim clock, voyage leg, held red alert, fault
//     timer, odd job, injury, hull / parts / XP / rep / ship's day), the BACK ON WATCH card (non-modal, crew line by name, no
//     opinion reward), no 'held station' line; the rested bonus is the only reward (x1.25 XP in the new session)
//  2. the same with a v17 save (night / awayDefer / alert.away / maintainOn / welcome): migrated to v18, timers preserved,
//     exactly one 'held station' line, the card
//  3. hidden tab for a 'long' time (Date.now pushed 2 h): frozen while hidden, the card on return
//  3b. rested window: reload at 0 / 15 min keeps it as it was; 30+ min away (reload or hidden tab) grants it; <30 min hidden doesn't
//  4. idle-tab pause: no input for PACE.idleAfter s -> the overlay, the sim (and a held alert) frozen; the tap resumes and
//     never lands on the deck
//  5. play-day calendar: the ship's day turns once per real play day, never on sim time
//  6. the UPKEEP order: locked before Lieutenant; one tap = one round (shields -> power -> locker), never repeats or starts by
//     itself; any new order or a fault elsewhere stops it; a fault on the console he is working is fixed inside the round
//  7. no crew self-repair (no night crew, no own-initiative repair at his console)
// 390x844, 844x390, 1280x800; 0 console errors, 0 failed requests.
// Usage: node tools/offline-check.js   (SHOTS=0 skips shots/offline-backonwatch-*.png, offline-paused-390x844.png, upkeep-order-390x844.png)
const { chromium } = require('playwright-core'); const BASE = process.env.BASE || 'http://127.0.0.1:8765/', OUT = __dirname + '/../shots/', KEY = 'tenacity.save.v1';
const sleep = ms => new Promise(r => setTimeout(r, ms)), SHOTS = process.env.SHOTS !== '0';
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [], net = [], fails = [], J = JSON.stringify, host = new URL(BASE).host, ok = (c, m) => { if (!c) fails.push(m); else console.log('ok ' + m.split(' {')[0].split(' [')[0]); };
  for (const [w, h] of [[390, 844], [844, 390], [1280, 800]]) {
    const tag = `${w}x${h}`, c = await br.newContext({ viewport: { width: w, height: h } }); await c.addInitScript(() => { window.__TENACITY_SKIP_NAME = true; });
    const p = await c.newPage(), R = {};
    p.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); }); p.on('pageerror', e => errs.push(`${tag}: ${e.message}`));
    p.on('response', r => { if (r.status() >= 400) net.push(`${tag}: ${r.status()} ${r.url()}`); });
    p.on('requestfailed', r => { if (new URL(r.url()).host === host) net.push(`${tag}: failed ${r.url()} ${r.failure() && r.failure().errorText}`); });
    const ready = () => p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
    // ---- set up a ship with every kind of in-flight timer, save it, push its clocks 8 h back, reopen ----
    const SETUP = async () => {
      const BT = await import('/js/battle.js'), MD = await import('/js/injuries.js'), OJ = await import('/js/oddjobs.js'), T = __T, G = T.G, S = G.ship;
      document.querySelectorAll('.modal').forEach(m => { m.hidden = true; });
      T.PACE_RT.idleT = 0; T.PACE_RT.sessionT = 1e6; G.prog.story.pilot.done = true; G.prog.background = G.prog.background || 'none'; G.prog.bgDone = true;
      G.sp.battle = null; G.sp.alert = null; G.sp.lastBattleT = -1e9; S.nextFault = 1e6; S.faults = { eps: { t: 12, sev: 'low', cost: 1, escT: 0 } };
      G.sp.location = null; G.sp.travel = { dest: 'convoy', t: 100, dur: 600 }; G.sp.travelPaused = false;
      const held = BT.startBattle('enroute'); if (G.sp.alert) G.sp.alert.t = 40;
      OJ.J().active = { kind: 'errand', node: 'msd', deck: 'bridge', label: 'Test errand', t: 200, dur: 200, need: 12, acc: 0, xp: 17, id: 999 };
      const inj = MD.injure('hazard', { sev: 'minor' });
      S.hull = 77; S.parts = 6; G.sp.rep = 42;
      return { held, inj: !!inj };
    };
    const SNAP = () => { const G = __T.G, S = G.ship, a = G.sp.alert, j = G.prog.jobs && G.prog.jobs.active, m = G.prog.med.inj[0];
      return { el: S.elapsed, sd: S.stardate, travel: G.sp.travel && G.sp.travel.t, paused: G.sp.travelPaused, alert: a ? Math.round(a.t * 10) / 10 : null, alertEn: a ? a.enemies.join() : null, fault: S.faults.eps ? S.faults.eps.t : null, nf: Object.keys(S.faults).length,
        job: j ? j.t : null, inj: m ? { id: m.id, heal: m.healAt, state: m.state } : null, hull: S.hull, parts: S.parts, torps: S.torps, xp: G.prog.totalXp, rep: G.sp.rep, day: G.prog.day, pd: G.prog.playDays, energy: Math.round(S.energy), op: JSON.stringify(G.prog.opinion), battle: !!G.sp.battle, v: G.version }; };
    const close = (sp, ver) => p.evaluate(([k, sp, ver]) => { window.__noSave = true; __T.saveGame && (window.__noSave = false); __T.saveGame(); window.__noSave = true;
      const d = JSON.parse(localStorage.getItem(k)), back = Date.now() - 8 * 3600e3; d.savedAt = back; d.prog.lastSeen = back; d.prog.maxSeen = d.prog.lastSeen;
      if (ver === 17) { d.version = 17; d.night = { sys: 'eps', t: 50, fixes: 3, battleTimes: [1, 2], avoided: 1 }; d.sp.awayDefer = 500; if (d.sp.alert) d.sp.alert.away = 120; d.prog.sinks.maintainOn = true; d.prog.sinks.maintT = 30; d.prog.welcome = { due: true, away: 99999 }; delete d.prog.upkeep; delete d.prog.lastSeen; delete d.prog.maxSeen; delete d.prog.restT; }
      localStorage.setItem(k, JSON.stringify(d)); localStorage.setItem(k + '.bak', JSON.stringify(d)); return true; }, [KEY, sp, ver]);
    const reopen = async () => { await p.reload(); await ready(); await sleep(300); };
    const card = () => p.evaluate(() => { const e = document.querySelector('#wbCard'); const r = e.getBoundingClientRect(), im = e.querySelector('.rpic img');
      return { shown: !e.hidden && e.classList.contains('bow'), k: (e.querySelector('.k') || {}).textContent, away: (e.querySelector('.bowAway') || {}).textContent, line: (e.querySelector('.bowLine') || {}).textContent || '', modal: e.classList.contains('modal'), inView: r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1, img: im ? im.naturalWidth > 0 : null, name: __T.G.lt.name ? (__T.G.lt.name.last || '') : '', modals: [...document.querySelectorAll('.modal')].filter(m => !m.hidden).map(m => m.id) }; });
    const held = () => p.evaluate(() => __T.G.log.filter(l => /held station while you were away/.test(l.msg)).length);
    // ---- 1. v18 save, 8 h gap ----
    await p.goto(BASE + '?reset=1'); await ready(); await sleep(400);
    R.setup = await p.evaluate(SETUP); const s0 = await p.evaluate(SNAP);
    await close(null, 18); await reopen();
    const s1 = await p.evaluate(SNAP); R.card1 = await card(); R.held1 = await held();
    R.rested = await p.evaluate(() => { const T = __T, a = T.G.prog.totalXp; T.awardXP(100, 'manual', 'test'); const g = T.G.prog.totalXp - a; T.PACE_RT.sessionT = 1e6; const b = T.G.prog.totalXp; T.awardXP(100, 'manual', 'test'); return { fresh: g, later: T.G.prog.totalXp - b }; });
    if (SHOTS) await p.screenshot({ path: OUT + `offline-backonwatch-${tag}.png` });
    R.s0 = s0; R.s1 = s1;
    // ---- 2. a v17 save (night state, awayDefer, alert.away, maintainOn, welcome), 8 h gap ----
    await p.evaluate(() => { document.querySelector('#wbCard').hidden = true; __T.G.prog.totalXp = 0; });
    await p.evaluate(SETUP); const t0 = await p.evaluate(SNAP);
    await close(null, 17); await reopen();
    const t1 = await p.evaluate(SNAP); R.card2 = await card(); R.held2 = await held();
    R.mig = await p.evaluate(k => { const G = __T.G; return { v: G.version, night: 'night' in G, defer: 'awayDefer' in G.sp, aAway: G.sp.alert ? 'away' in G.sp.alert : null, maint: G.prog.sinks.maintainOn, maintT: 'maintT' in G.prog.sinks, welcome: 'welcome' in G.prog, upkeep: J(G.prog.upkeep), lastSeen: G.prog.lastSeen > 0 }; function J(x) { return JSON.stringify(x); } }, KEY);
    R.t0 = t0; R.t1 = t1;
    // ---- 3. hidden tab, 'two hours' later ----
    R.hidden = await p.evaluate(async () => { const T = __T, G = T.G; document.querySelector('#wbCard').hidden = true;
      const real = Date.now, hid = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden'), vis = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
      const setHidden = v => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => v }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v ? 'hidden' : 'visible' }); document.dispatchEvent(new Event('visibilitychange')); };
      window.__noSave = true; const e0 = G.ship.elapsed, tr0 = G.sp.travel && G.sp.travel.t; setHidden(true); await new Promise(z => setTimeout(z, 1200));
      const e1 = G.ship.elapsed; const off = 2 * 3600e3; Date.now = () => real.call(Date) + off; setHidden(false); await new Promise(z => setTimeout(z, 300));
      const el = document.querySelector('#wbCard'), o = { frozen: Math.abs(e1 - e0) < 0.01, travelHeld: Math.abs((G.sp.travel && G.sp.travel.t) - tr0) < 0.5, card: !el.hidden && el.classList.contains('bow'), away: (el.querySelector('.bowAway') || {}).textContent };
      Date.now = real; delete document.hidden; delete document.visibilityState; return o; });
    // ---- 3b. the rested window: a reload never restarts or extends it; only a real absence (PACE.backAfter, 30 min) grants a
    //      fresh one, on reload and on a hidden-tab return alike; a negative gap (clock set back) grants nothing ----
    const XPG = () => p.evaluate(() => { const T = __T, a = T.G.prog.totalXp; T.awardXP(100, 'manual', 'test'); return { g: T.G.prog.totalXp - a, restT: Math.round(T.G.prog.restT) }; });
    const reload = async (restT, gapMin) => { await p.evaluate(([k, restT, gapMin]) => { document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); __T.G.prog.restT = restT; window.__noSave = false; __T.saveGame(); window.__noSave = true;
      const d = JSON.parse(localStorage.getItem(k)), t = Date.now() - gapMin * 60e3; d.savedAt = t; d.prog.lastSeen = t; d.prog.maxSeen = d.prog.lastSeen; localStorage.setItem(k, JSON.stringify(d)); localStorage.setItem(k + '.bak', JSON.stringify(d)); return true; }, [KEY, restT, gapMin]); await reopen(); return XPG(); };
    R.rest = { in0: await reload(300, 0), out0: await reload(1000, 0), in15: await reload(300, 15), out15: await reload(1000, 15), back31: await reload(1000, 31), neg: await reload(1000, -60) };
    const hideFor = min => p.evaluate(async min => { const T = __T, G = T.G; document.querySelector('#wbCard').hidden = true; G.prog.restT = 1000; T.PACE_RT.sessionT = 1e6; G.prog.maxSeen = G.prog.lastSeen = Date.now();   // section 3's mocked +2 h clock is behind us (maxSeen never moves back by itself)
      const real = Date.now, setHidden = v => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => v }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v ? 'hidden' : 'visible' }); document.dispatchEvent(new Event('visibilitychange')); };
      window.__noSave = true; setHidden(true); await new Promise(z => setTimeout(z, 300)); Date.now = () => real.call(Date) + min * 60e3; setHidden(false); await new Promise(z => setTimeout(z, 300));
      const a = G.prog.totalXp; T.awardXP(100, 'manual', 'test'); const o = { g: G.prog.totalXp - a, restT: Math.round(G.prog.restT) }; Date.now = real; delete document.hidden; delete document.visibilityState; document.querySelector('#wbCard').hidden = true; return o; }, min);
    R.rest.hid31 = await hideFor(31); R.rest.hid20 = await hideFor(20);
    // (a) a save from before restT gets one full rested window on its first load (then it is saved like any other)
    // (b) clock set back 2 days, played, then put right: the gap counts from the latest time ever seen (maxSeen): no card, no window
    const reloadMut = async mut => { await p.evaluate(([k, mut]) => { document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); document.querySelector('#wbCard').hidden = true; window.__noSave = false; __T.saveGame(); window.__noSave = true;
      const d = JSON.parse(localStorage.getItem(k)); (new Function('d', mut))(d); localStorage.setItem(k, JSON.stringify(d)); localStorage.setItem(k + '.bak', JSON.stringify(d)); return true; }, [KEY, mut]); await reopen();
      return { ...(await XPG()), card: await p.evaluate(() => { const e = document.querySelector('#wbCard'); return !e.hidden && e.classList.contains('bow') ? (e.querySelector('.bowAway') || {}).textContent : null; }) }; };
    R.rest.oldSave = await reloadMut("delete d.prog.restT; d.savedAt = d.prog.lastSeen = d.prog.maxSeen = Date.now();");
    R.rest.oldSave2 = await reloadMut("d.prog.restT = 1000; d.savedAt = d.prog.lastSeen = d.prog.maxSeen = Date.now();");
    R.rest.clockBack = await reloadMut("d.prog.restT = 1000; d.savedAt = d.prog.lastSeen = Date.now() - 2 * 86400e3; d.prog.maxSeen = Date.now() - 5 * 60e3;");
    // ---- 4. idle-tab pause + tap to resume ----
    R.idle = await p.evaluate(async () => { const T = __T, G = T.G, PC = await import('/js/pacing.js'), wait = ms => new Promise(z => setTimeout(z, ms)); document.querySelector('#wbCard').hidden = true;
      if (!G.sp.alert) { const BT = await import('/js/battle.js'); G.sp.lastBattleT = -1e9; BT.startBattle('enroute'); }
      if (G.sp.alert) G.sp.alert.t = 30;
      T.PACE_RT.idleT = PC.PACE.idleAfter; await wait(300);
      const ov = document.querySelector('#idlePause'), e0 = G.ship.elapsed, a0 = G.sp.alert && G.sp.alert.t, mode0 = G.lt.mode, x0 = G.lt.x; await wait(1500);
      return { up: !ov.hidden && T.idle.up(), frozen: Math.abs(G.ship.elapsed - e0) < 0.01, alertHeld: G.sp.alert ? Math.abs(G.sp.alert.t - a0) < 0.01 : null, e0, mode0, x0, cover: (() => { const r = ov.getBoundingClientRect(); return r.width >= innerWidth - 1 && r.height >= innerHeight - 1; })() }; });
    if (SHOTS && w === 390) await p.screenshot({ path: OUT + 'offline-paused-390x844.png' });
    const vp = p.viewportSize(); await p.mouse.click(Math.round(vp.width * 0.5), Math.round(vp.height * 0.45)); await sleep(1200);
    R.resume = await p.evaluate(e0 => { const T = __T, G = T.G; return { hidden: document.querySelector('#idlePause').hidden, up: T.idle.up(), runs: G.ship.elapsed > e0 + 0.5, noWalk: !(G.lt.path && G.lt.path.length) && G.lt.mode !== 'walk' }; }, R.idle.e0);
    // ---- 5. play-day calendar ----
    R.cal = await p.evaluate(async () => { const PG = await import('/js/progression.js'), G = __T.G, p = G.prog; let fired = 0; PG.hooks.newDay.push(() => { fired++; });
      const d0 = p.day; PG.tickDay(PG.PROG.dayLength * 3); const afterSim = p.day;
      p.lastPlayDate = '2000-01-01'; p.lastPlayAt = 0; p.presentTotal = 1e7; const ok1 = PG.markPlayDay(new Date(), 999); const after1 = p.day, pd1 = p.playDays;
      const ok2 = PG.markPlayDay(new Date(), 999); return { d0, afterSim, ok1, after1, pd1, ok2, after2: p.day, fired, dayT: p.dayT < PG.PROG.dayLength }; });
    // ---- 6. the UPKEEP order ----
    R.up = await p.evaluate(async () => { const T = __T, G = T.G, S = G.ship, U = await import('/js/upkeep.js'), SIM = await import('/js/sim.js'), FT = await import('/js/faults.js'), CR = await import('/js/crew.js'), HUD = await import('/js/ui/hud.js'), o = {};
      window.__noSave = true; document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); document.querySelector('#wbCard').hidden = true; if (T.idle.up()) T.idle.resume();
      G.sp.battle = null; G.sp.alert = null; G.sp.travel = null; G.sp.location = 'ds9'; G.sp.lastBattleT = 1e12; S.nextFault = 1e9; S.faults = {}; G.prog.jobs.active = null; G.prog.jobs.next = 1e9; G.prog.story.pilot.done = true;
      const run = (sec, f) => { for (let t = 0; t < sec; t += 0.25) { T.PACE_RT.idleT = 0; G.sp.lastBattleT = S.elapsed; S.nextFault = 1e9; if (G.sp.ev) G.sp.ev.active = null; SIM.stepSim(0.25); if (f && f()) return t; } return sec; };
      const chip = () => { HUD.updateHud(); const b = document.querySelector('#chipsPlay [data-upkeep]') || document.querySelector('#chipsInfo [data-upkeep]'); return b ? b.textContent : null; };
      const clickChip = () => { const b = [...document.querySelectorAll('[data-upkeep]')].find(x => x.offsetParent); if (b) b.click(); return !!b; };
      // locked before Lieutenant
      G.prog.rank = 0; o.lockChip = chip(); o.lockClick = clickChip(); o.lockOrder = U.upkeepState().active;
      // never automatic: low shields / power / locker and an idle Lt for 5 min -> nothing happens
      G.prog.rank = 1; S.shields = 40; S.power = 50; S.parts = 1; CR.playerOrder(() => CR.sendUse('mess')); run(60); const sh0 = S.shields;
      run(300); o.noAuto = { active: U.upkeepState().active, n: U.upkeepState().n, shields: S.shields, sh0, node: G.lt.node };
      // one order = one round
      S.shields = 40; S.power = 50; S.parts = 1; o.chip = chip(); o.click = clickChip(); o.steps = U.upkeepState().steps; o.chipOn = chip();
      const seen = []; run(900, () => { if (G.lt.mode === 'use' && seen[seen.length - 1] !== G.lt.node) seen.push(G.lt.node); if (!seen.includes('core')) S.power = Math.min(S.power, 50); return !U.upkeepState().active; });   // the grid's own regen held back until he reaches the core
      o.seen = seen; o.done = { active: U.upkeepState().active, n: U.upkeepState().n, shields: Math.round(S.shields), cap: FT.shieldCap(), power: Math.round(S.power), parts: S.parts, cap2: S.partsCap, node: G.lt.node, log: G.log.filter(l => /Upkeep round complete/.test(l.msg)).length };
      S.shields = 30; run(300); o.after = { active: U.upkeepState().active, n: U.upkeepState().n, shields: Math.round(S.shields), ordered: G.log.filter(l => /Upkeep round ordered/.test(l.msg)).length };
      // a new order calls it off
      S.power = 40; U.orderUpkeep(); run(2); CR.playerOrder(() => CR.sendUse('mess')); run(1); o.newOrder = { active: U.upkeepState().active, log: (G.log.filter(l => /Upkeep round stopped/.test(l.msg)).pop() || {}).msg };
      // a fault elsewhere calls it off
      S.power = 40; U.orderUpkeep(); run(2); FT.spawnFault('ambient', 'transporter', 'low'); run(1); o.fault = { active: U.upkeepState().active, log: (G.log.filter(l => /Upkeep round stopped/.test(l.msg)).pop() || {}).msg, open: !!S.faults.transporter };
      S.faults = {};
      // a fault on the console he is working is fixed inside the round, then the round goes on
      S.shields = 30; S.power = 40; U.orderUpkeep(); run(300, () => G.lt.mode === 'use' && G.lt.node === 'shield'); const pre = S.parts;
      FT.spawnFault('ambient', 'shields', 'low'); const t = run(400, () => !S.faults.shields && G.lt.mode === 'use' && G.lt.node !== 'shield');
      o.inRound = { cleared: !S.faults.shields, active: U.upkeepState().active || U.upkeepState().n >= 2, line: G.log.some(l => /as part of the round/.test(l.msg)), node: G.lt.node, t };
      run(900, () => !U.upkeepState().active); o.inRoundDone = { active: U.upkeepState().active, n: U.upkeepState().n };
      // 7. no crew self-repair: a fault at the console he stands at (no order) and faults left alone for 10 min stay open
      CR.playerOrder(() => CR.sendUse('core')); run(120, () => G.lt.mode === 'use' && G.lt.node === 'core');
      FT.spawnFault('ambient', 'warpcore', 'low'); FT.spawnFault('ambient', 'transporter', 'low'); run(600);
      o.selfFix = { mode: G.lt.mode, node: G.lt.node, warpcore: !!S.faults.warpcore, transporter: !!S.faults.transporter, nightFixes: G.stats.nightFixes || 0 };
      S.faults = {}; return o; });
    if (SHOTS && w === 390) { await p.evaluate(async () => { const T = __T, G = T.G, S = G.ship, U = await import('/js/upkeep.js'), CR = await import('/js/crew.js'); CR.playerOrder(() => CR.sendUse('mess')); S.shields = 35; S.power = 45; S.parts = 1; U.orderUpkeep(); }); await sleep(1500); await p.screenshot({ path: OUT + 'upkeep-order-390x844.png' }); await p.evaluate(async () => { const U = await import('/js/upkeep.js'); U.cancelUpkeep('test'); }); }
    // ---- asserts ----
    const near = (a, b, d) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= d;
    const same = (a, b, lbl) => {
      ok(near(b.el, a.el, 3) && near(b.travel, a.travel, 0.01) && b.paused === a.paused, `${tag} ${lbl}: sim clock / voyage leg held ` + J([a.el, b.el, a.travel, b.travel]));
      ok(a.alert != null && b.alert != null && near(b.alert, a.alert, 3) && b.alertEn === a.alertEn && !b.battle, `${tag} ${lbl}: held red alert still held, clock frozen ` + J([a.alert, b.alert, b.battle]));
      ok(near(b.fault, a.fault, 3) && b.nf === a.nf, `${tag} ${lbl}: fault timer resumes ` + J([a.fault, b.fault, a.nf, b.nf]));
      ok(near(b.job, a.job, 3), `${tag} ${lbl}: odd job kept, timer held ` + J([a.job, b.job]));
      ok(!a.inj || (b.inj && b.inj.id === a.inj.id && b.inj.heal === a.inj.heal && b.inj.state === a.inj.state), `${tag} ${lbl}: injury held ` + J([a.inj, b.inj]));
      ok(near(b.hull, a.hull, 0.5) && b.parts === a.parts && b.torps === a.torps && b.xp === a.xp && b.rep === a.rep && b.day === a.day && b.pd === a.pd && near(b.energy, a.energy, 1) && b.op === a.op, `${tag} ${lbl}: no progress at all ` + J([a, b]));
    };
    same(s0, s1, 'v18 8h'); same(t0, t1, 'v17 8h');
    for (const [k, C] of [['v18', R.card1], ['v17', R.card2]]) ok(C.shown && C.k === 'BACK ON WATCH' && /^Away 8h 0m\. Everything held as you left it\.$/.test(C.away) && !C.modal && C.inView && C.img !== false && (!C.line || C.line.includes(C.name)) && !C.modals.length, `${tag} BACK ON WATCH card (${k}) ` + J(C));
    ok(R.held1 === 0 && R.held2 === 1, `${tag} 'held station' line only for the v17 save, once ` + J([R.held1, R.held2]));
    ok(R.rested.fresh === 125 && R.rested.later === 100, `${tag} rested bonus is the only return reward ` + J(R.rested));
    const M = R.mig; ok(M.v === 18 && !M.night && !M.defer && M.aAway === false && M.maint === false && !M.maintT && !M.welcome && M.upkeep === J({ order: null, n: 0 }) && M.lastSeen, `${tag} v17 -> v18 migration ` + J(M));
    { const X = R.rest, near = (x, v) => x.restT >= v && x.restT <= v + 5;
      ok(X.in0.g === 125 && near(X.in0, 300) && X.out0.g === 100 && near(X.out0, 1000), `${tag} reload at 0 min keeps the rested window as it was ` + J([X.in0, X.out0]));
      ok(X.in15.g === 125 && near(X.in15, 300) && X.out15.g === 100 && near(X.out15, 1000), `${tag} reload at 15 min neither resets nor extends it ` + J([X.in15, X.out15]));
      ok(X.back31.g === 125 && X.back31.restT <= 5, `${tag} reload after 31 min grants a fresh window ` + J(X.back31));
      ok(X.neg.g === 100 && near(X.neg, 1000), `${tag} negative gap (clock back) grants nothing ` + J(X.neg));
      ok(X.hid31.g === 125 && X.hid31.restT <= 1, `${tag} hidden tab 31 min grants it ` + J(X.hid31));
      ok(X.hid20.g === 100 && X.hid20.restT >= 1000, `${tag} hidden tab 20 min does not ` + J(X.hid20));
      ok(X.oldSave.g === 125 && X.oldSave.restT <= 5 && X.oldSave2.g === 100, `${tag} (a) a save without restT gets one rested window, once ` + J([X.oldSave, X.oldSave2]));
      ok(X.clockBack.g === 100 && X.clockBack.restT >= 1000 && X.clockBack.card === null, `${tag} (b) clock back then forward: gap from maxSeen, no window, no 'Away 2d' card ` + J(X.clockBack)); }
    ok(R.hidden.frozen && R.hidden.travelHeld && R.hidden.card && /^Away 2h 0m\./.test(R.hidden.away || ''), `${tag} hidden tab frozen, card on return ` + J(R.hidden));
    ok(R.idle.up && R.idle.frozen && R.idle.alertHeld === true && R.idle.cover, `${tag} idle pause: overlay, sim + alert frozen ` + J(R.idle));
    ok(R.resume.hidden && !R.resume.up && R.resume.runs && R.resume.noWalk, `${tag} tap to resume (the tap never reaches the deck) ` + J(R.resume));
    const CA = R.cal; ok(CA.afterSim === CA.d0 && CA.ok1 && CA.after1 === CA.d0 + 1 && CA.pd1 >= 1 && !CA.ok2 && CA.after2 === CA.after1 && CA.fired === 1 && CA.dayT, `${tag} ship's day = real play day ` + J(CA));
    const U = R.up;
    ok(/🔒/.test(U.lockChip || '') && U.lockClick && U.lockOrder === false, `${tag} upkeep locked before Lieutenant ` + J([U.lockChip, U.lockClick, U.lockOrder]));
    ok(!U.noAuto.active && U.noAuto.n === 0 && near(U.noAuto.shields, U.noAuto.sh0, 0.01) && U.noAuto.node === 'mess', `${tag} upkeep never automatic ` + J(U.noAuto));
    ok(/Upkeep ▸/.test(U.chip || '') && U.click && J(U.steps) === J(['shield', 'core', 'locker']) && /Upkeep ■/.test(U.chipOn || ''), `${tag} upkeep order (chip) ` + J([U.chip, U.steps, U.chipOn]));
    ok(J(U.seen.filter(n => ['shield', 'core', 'locker'].includes(n))) === J(['shield', 'core', 'locker']) && !U.done.active && U.done.n === 1 && U.done.shields >= U.done.cap && U.done.power >= 100 && U.done.parts >= Math.ceil(U.done.cap2 * 0.75) && U.done.log === 1, `${tag} one round: shields -> power -> locker ` + J([U.seen, U.done]));
    ok(!U.after.active && U.after.n === 1 && U.after.shields === 30 && U.after.ordered === 1, `${tag} the round never repeats ` + J(U.after));
    ok(!U.newOrder.active && /new orders/.test(U.newOrder.log || ''), `${tag} a new order stops the round ` + J(U.newOrder));
    ok(!U.fault.active && /new fault/.test(U.fault.log || '') && U.fault.open, `${tag} a fault elsewhere stops the round (and stays for the player) ` + J(U.fault));
    ok(U.inRound.cleared && U.inRound.line && U.inRound.active && !U.inRoundDone.active && U.inRoundDone.n >= 2, `${tag} a fault at his console is fixed inside the round ` + J([U.inRound, U.inRoundDone]));
    ok(U.selfFix.mode === 'use' && U.selfFix.node === 'core' && U.selfFix.warpcore && U.selfFix.transporter && U.selfFix.nightFixes === 0, `${tag} no crew self-repair ` + J(U.selfFix));
    console.log(tag, J({ setup: R.setup, card: R.card1.line.slice(0, 60) }));
    // (d) tab lock: a tab that died without pagehide, then the clock moved back -> its lock is stamped in the future; the
    //     reopened game must not start read-only behind 'Open in another tab'
    await p.close(); const p2 = await c.newPage(); p2.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); }); p2.on('pageerror', e => errs.push(`${tag}: ${e.message}`));
    p2.on('response', r => { if (r.status() >= 400) net.push(`${tag}: ${r.status()} ${r.url()}`); });
    await p2.addInitScript(() => { if (!sessionStorage.getItem('__lk')) { sessionStorage.setItem('__lk', '1'); localStorage.setItem('tenacity.tablock', JSON.stringify({ id: '0dead', ep: 9, t: Date.now() + 3600e3 })); } });
    await p2.goto(BASE); await p2.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(1500);
    R.lock = await p2.evaluate(() => ({ ro: !!__T.TAB_RT.ro, overlay: !!document.querySelector('#tabLock:not([hidden])') }));
    ok(!R.lock.ro, `${tag} (d) a future-stamped dead tab lock (clock moved back) doesn't lock the game ` + J(R.lock));
    await c.close();
  }
  ok(!errs.length, 'console errors ' + J(errs)); ok(!net.length, 'failed / 4xx requests ' + J(net));
  console.log(fails.length ? 'FAIL\n' + fails.join('\n') : 'PASS · offline-check · 3 sizes · 0 console errors · 0 failed requests');
  await br.close(); process.exit(fails.length ? 1 : 0);
})();
