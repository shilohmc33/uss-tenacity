// Encounter weighting: checks + shots at 390x844, 844x390 and 1280x800 -> shots/enc-*.png, shots/enc-report.json.
// The battlecruiser comes through the REAL path (startBattle('enroute') -> encounters.js table, Math.random pinned high so
// the roll lands on her) once the gates are open; the card must show, fit the viewport, and stay readable.
// node tools/enc-shots.js [base] [outDir]
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
    const boot = async () => { await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(600); };
    // set up a ship where the battlecruiser is allowed: Lt, play day 20, healthy, out of the session calm
    const ready = (o = {}) => p.evaluate(async o => {
      window.__noSave = true; const G = __T.G, P = await import('/js/pacing.js'), E = await import('/js/encounters.js');
      G.prog.rank = 1; G.prog.playDays = o.pd != null ? o.pd : 20; G.prog.day = Math.max(G.prog.day, 25); G.ship.hull = 100; G.ship.power = 90; G.ship.torps = 2; G.ship.faults = {}; for (const a of Object.values(G.ab)) if (a && typeof a === 'object') a.cd = 30;   // abilities cooling, 2 tubes: a mid-fight look (a ready torpedo spread ends any fight in a second)
      G.sp.enc = E.freshEnc(); G.sp.lastBattleT = -1e9; P.PACE_RT.sessionT = 1e5; P.PACE_RT.idleT = 0; P.PACE_RT.offline = false;
      if (__T.MD && __T.MD.answerGentlePrompt) __T.MD.answerGentlePrompt(false); const sp = document.querySelector('#safetyPanel'); if (sp) sp.hidden = true;   // the day-14 crew-safety prompt (answered: standard)
      if (o.worn) G.ship.hull = 55; if (o.hush) G.prog.med.hushUntil = G.ship.elapsed + 600;
    }, o);
    // the real path with the roll pinned to the top of the table (the battlecruiser is its last row)
    const fight = (pin = 0.999, kind = 'enroute') => p.evaluate(async ({ pin, kind }) => {
      const BT = await import('/js/battle.js'), G = __T.G, mr = Math.random, n0 = G.log.length; Math.random = () => pin; let ok; try { ok = BT.startBattle(kind); } finally { Math.random = mr; }
      // pass 13: the sensor line (log + toast) comes first, the card ~1.2 s later
      const card = document.querySelector('#bcCard'), cardAt0 = !!card && !card.hidden, msgs = G.log.slice(n0).map(e => e.msg), toastTxt = document.querySelector('#toasts') ? document.querySelector('#toasts').innerText : '';
      const sI = msgs.findIndex(m => /capital-class contact/.test(m)), oI = msgs.findIndex(m => /Red alert!|weapons hot!|opens fire/.test(m));
      await new Promise(r => setTimeout(r, 1400));
      return { ok, enemy: G.sp.battle && G.sp.battle.enemies[0].ship, card: !!card && !card.hidden, cardAt0, sensorLog: sI >= 0, sensorFirst: sI >= 0 && (oI < 0 || sI < oI), sensorToast: /capital-class contact/.test(toastTxt), enc: JSON.parse(JSON.stringify(G.sp.enc)) };
    }, { pin, kind });
    const cardBox = () => p.evaluate(() => { const c = document.querySelector('#bcCard'); if (!c || c.hidden) return null; const r = c.getBoundingClientRect(), t = c.querySelector('.t'), l = c.querySelector('.l p');
      const fs = el => parseFloat(getComputedStyle(el).fontSize); const scr = [c, t].every(el => el.scrollWidth <= el.clientWidth + 1);
      const bn = document.querySelector('#redBanner'), br = bn && !bn.hidden ? bn.getBoundingClientRect() : null, hitsBanner = !!br && br.width > 0 && !(br.bottom <= r.top || br.top >= r.bottom || br.right <= r.left || br.left >= r.right);
      return { hitsBanner, x: r.left, y: r.top, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, title: t.textContent, tfs: fs(t), lfs: fs(l), kfs: fs(c.querySelector('.k')), tapfs: fs(c.querySelector('.tap')), noOverflow: scr, z: getComputedStyle(c).zIndex }; });
    await boot();
    // 1) gates (pure table, 4000 rolls each)
    const gates = await p.evaluate(async () => { const E = await import('/js/encounters.js'), G = __T.G, ok = { hull: 100, power: 90, torps: 6, faults: {} };
      const roll = (prog, ship, enc) => { let n = 0; for (let i = 0; i < 4000; i++) if (E.chooseEncounter('enroute', { prog, ship, enc }).id === 'jh_battlecruiser') n++; return n; };
      const enc = E.freshEnc(), after = { ...E.freshEnc(), last: 'jh_battlecruiser', since: 0, lastBcPD: 20 };
      return { ensign: roll({ rank: 0, day: 40 }, ok, enc), day20: roll({ rank: 1, day: 20 }, ok, enc), open: roll({ rank: 1, day: 21 }, ok, enc), twice: roll({ rank: 2, day: 30 }, ok, after),
        oneBetween: roll({ rank: 2, day: 30, playDays: 30 }, ok, { ...after, last: 'galor', since: 1, lastBcPD: 20 }),   // pass 13: 1 fight between is not enough (gapBattles 2)
        twoBetween: roll({ rank: 2, day: 30, playDays: 22 }, ok, { ...after, last: 'galor', since: 2, lastBcPD: 20 }),   // 2 fights + 2 play days: open
        oneDay: roll({ rank: 2, day: 30, playDays: 21 }, ok, { ...after, last: 'galor', since: 9, lastBcPD: 20 }),      // many fights but only 1 play day: closed
        // pass 13: blocked ONLY for a crippled ship (hull < 60 or an open crit fault); power / torpedoes / med faults no longer hold her
        hull59: roll({ rank: 1, day: 30 }, { ...ok, hull: 59 }, enc), hull60: roll({ rank: 1, day: 30 }, { ...ok, hull: 60 }, enc), power10: roll({ rank: 1, day: 30 }, { ...ok, power: 10 }, enc), torps0: roll({ rank: 1, day: 30 }, { ...ok, torps: 0 }, enc),
        crit: roll({ rank: 1, day: 30 }, { ...ok, faults: { weapons: { sev: 'crit' } } }, enc),
        impairing: roll({ rank: 1, day: 30 }, { ...ok, faults: { weapons: { sev: 'med' } } }, enc), lowFault: roll({ rank: 1, day: 30 }, { ...ok, faults: { weapons: { sev: 'low' } } }, enc),
        shadow: E.chooseEncounter('shadow', { prog: { rank: 3, day: 90 }, ship: ok, enc }).id, defector: E.chooseEncounter('defector', { prog: { rank: 3, day: 90 }, ship: ok, enc }).id,
        table: E.encounterTable({ rank: 1, day: 21 }, ok, enc) }; });
    ck(tag, 'gates: none before Lt / ship\'s day 21, twice in a row, < 2 fights or < 2 play days since her, or against a crippled ship (hull < 60 / crit fault); open at hull 60, low power, no torps, med fault; ~10% once open', ['ensign', 'day20', 'twice', 'oneBetween', 'oneDay', 'hull59', 'crit'].every(k => gates[k] === 0) && gates.open > 300 && gates.open < 500 && ['twoBetween', 'lowFault', 'impairing', 'hull60', 'power10', 'torps0'].every(k => gates[k] > 300) && gates.shadow === 'jh_fighter' && gates.defector === 'galor', gates);
    // 2) the real path: battlecruiser + card, then the next fight can't be her
    await ready(); const r1 = await fight();
    ck(tag, 'pass 13: capital-class sensor line first (log before the opener + toast), the card follows ~1.2 s later', r1.sensorLog && r1.sensorFirst && r1.sensorToast && !r1.cardAt0 && r1.card, r1);
    ck(tag, 'real path: enroute roll -> battlecruiser + red-alert card', r1.ok && r1.enemy === 'jh_battlecruiser' && r1.card && r1.enc.last === 'jh_battlecruiser' && r1.enc.since === 0 && r1.enc.lastBcPD === 20, r1);
    const box = await cardBox();
    ck(tag, 'card fits the viewport, clear of the WATCH BATTLE banner, and reads (title >= 18 px, body >= 13 px, "TAP TO DISMISS" >= 12 px, no clipping)', box && box.tapfs >= 12 && box.x >= 0 && box.y >= 0 && box.x + box.w <= box.vw && box.y + box.h <= box.vh && box.tfs >= 18 && box.lfs >= 13 && box.kfs >= 12 && box.noOverflow && !box.hitsBanner, box);
    await sleep(500); let f = OUT + `enc-bc-warning-${tag}.png`; await p.screenshot({ path: f }); rep.shots.push(f.replace(/^.*shots\//, 'shots/'));
    // the same moment in the space view (WATCH BATTLE)
    await p.click('#watchBattle', { timeout: 3000 }).catch(() => {}); await sleep(900); const box2 = await cardBox();
    ck(tag, 'card visible + fits in the space view', box2 && box2.y + box2.h <= box2.vh && box2.x + box2.w <= box2.vw, box2);
    f = OUT + `enc-bc-space-${tag}.png`; await p.screenshot({ path: f }); rep.shots.push(f.replace(/^.*shots\//, 'shots/'));
    // tap dismisses; it also auto-hides (7 s)
    if (box2) await p.click('#bcCard', { timeout: 3000 }).catch(() => {}); const gone = await p.evaluate(() => document.querySelector('#bcCard').hidden);
    ck(tag, 'tap dismisses the card', gone, gone);
    const r2 = await p.evaluate(async () => { const G = __T.G, E = await import('/js/encounters.js'); G.sp.battle = null; G.prog.playDays = 40; let n = 0; for (let i = 0; i < 2000; i++) if (E.chooseEncounter('enroute', { prog: G.prog, ship: { hull: 100, power: 90, torps: 6, faults: {} }, enc: G.sp.enc }).id === 'jh_battlecruiser') n++; return n; });
    ck(tag, 'never twice in a row (saved enc after a battlecruiser)', r2 === 0, r2);
    // 3) a fighter / Galor: no card, the plain RED ALERT toast as before
    await boot(); await ready(); const r3 = await fight(0.05); const toast = await p.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent));
    ck(tag, 'fighter: plain toast, no card', r3.ok && r3.enemy === 'jh_fighter' && !r3.card && toast.some(t => /RED ALERT — Jem'Hadar fighter/.test(t)), { r3, toast });
    if (tag === '390x844') { await sleep(300); f = OUT + `enc-fighter-${tag}.png`; await p.screenshot({ path: f }); rep.shots.push(f.replace(/^.*shots\//, 'shots/')); }
    // 4) crippled ship (pass 13: hull < 60): the roll that would have been the battlecruiser falls back to the top open row (a Galor)
    await boot(); await ready({ worn: true }); const r4 = await fight();
    ck(tag, 'crippled ship (hull 55): falls back to a Galor, no card, counted as held', r4.ok && r4.enemy === 'galor' && !r4.card && r4.enc.held === 1, r4);
    // 5) the death-hush quiet gate does NOT hold back the danger card; offline catch-up (bus quiet) does
    await boot(); await ready({ hush: true }); const r5 = await fight();
    ck(tag, 'hushed (quiet period): card still shows (danger alert, not a cheerful line)', r5.enemy === 'jh_battlecruiser' && r5.card, r5);
    await boot(); await ready(); const r6 = await p.evaluate(async () => { const BU = await import('/js/bus.js'), BT = await import('/js/battle.js'), G = __T.G, mr = Math.random; Math.random = () => 0.999; BU.setQuiet(true); let ok; try { ok = BT.startBattle('enroute'); } finally { BU.setQuiet(false); Math.random = mr; }
      return { ok, enemy: G.sp.battle && G.sp.battle.enemies[0].ship, card: !document.querySelector('#bcCard').hidden, logged: G.log.slice(-4).some(e => /battlecruiser/.test(e.msg)) }; });
    ck(tag, 'offline catch-up (bus quiet): no card, the log still records it', r6.enemy === 'jh_battlecruiser' && !r6.card && r6.logged, r6);
    rep.errors[tag] = errs; ck(tag, 'zero console errors', !errs.length, errs); await c.close();
  }
  fs.writeFileSync(OUT + 'enc-report.json', JSON.stringify(rep, null, 1));
  console.log(rep.fails.length ? 'ENC FAIL\n' + rep.fails.join('\n') : 'ENC PASS', Object.keys(rep.checks).length, 'checks', rep.shots.length, 'shots', JSON.stringify(rep.errors));
  await b.close();
})();
