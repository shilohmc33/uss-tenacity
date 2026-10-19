// Pass 15 proof shots + checks at 390x844, 844x390, 1280x800 -> shots/pt15-alpha-*.png, shots/pt15-alpha-report.json
//   toast - the battlecruiser through the REAL path with a RESTED bridge (every ability ready): her polaron alpha strike knocks them to
//           half recharge; ~1.6 s in the "ALPHA STRIKE" toast, Hale's sensor toast and the red-alert card are all visible, no toast covered
//   log   - the rendered SHIFT LOG shows Hale's alpha-strike line (which abilities, why they are cooling)
//   away  - the same fight rolled while away: the night watch start, no alpha strike line (no double penalty)
// node tools/pt15-shots.js [base] [outDir]
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const OUT = process.argv[3] || __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SIZES = [[390, 844, true], [844, 390, true], [1280, 800, false], [360, 640, true, 'small'], [667, 375, true, 'small']];   // pass 15 L1: small phones (card checks only)
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const rep = { errors: {}, checks: {}, shots: [], fails: [] };
  const ck = (tag, name, ok, info) => { rep.checks[tag + ' ' + name] = { ok: !!ok, info }; if (!ok) rep.fails.push(tag + ' ' + name + ' ' + JSON.stringify(info)); };
  for (const [w, h, m, small] of SIZES) {
    const tag = `${w}x${h}`, errs = [];
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: m, hasTouch: m });
    await c.addInitScript(() => { window.__TENACITY_TEST_DEATHS = true; });
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
    const shot = async name => { const f = OUT + `pt15-alpha-${name}-${tag}.png`; await p.screenshot({ path: f }); rep.shots.push(f.replace(/^.*shots\//, 'shots/')); };
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
    // 1) rested bridge, live: alpha strike toast + sensor toast + card
    await boot(); await ready();
    const a1 = await p.evaluate(async () => { const BT = await import('/js/battle.js'), G = __T.G; for (const a of Object.values(G.ab)) if (a && typeof a === 'object') { a.cd = 0; a.active = 0; }
      const mr = Math.random; Math.random = () => 0.999; try { BT.startBattle('enroute'); } finally { Math.random = mr; }
      return { enemy: G.sp.battle && G.sp.battle.enemies[0].ship, cds: Object.fromEntries(Object.entries(G.ab).map(([k, a]) => [k, +(a.cd / a.cdMax).toFixed(2)])) }; });
    await sleep(1600); const g1 = await geo(); const tl = await p.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent)); await p.evaluate(() => { __T.app.paused = true; }); await shot('toast');
    ck(tag, 'alpha strike: every ready ability knocked to 0.5 x cdMax', a1.enemy === 'jh_battlecruiser' && Object.values(a1.cds).every(f => Math.abs(f - 0.5) < 0.02), a1);
    const alphaR = await p.evaluate(() => { const c = document.querySelector('#bcCard'), t = [...document.querySelectorAll('#toasts .toast')].find(x => /ALPHA STRIKE/.test(x.textContent)); if (!t) return null; const r = t.getBoundingClientRect(), k = c.hidden ? null : c.getBoundingClientRect();
      return { text: t.textContent, inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, covered: !!k && r.left < k.right && r.right > k.left && r.top < k.bottom && r.bottom > k.top }; });
    ck(tag, 'ALPHA STRIKE toast + sensor toast visible with the card up, neither covered, card clear of the banner', alphaR && alphaR.inView && !alphaR.covered && g1.card && g1.sensor && g1.sensorIn && !g1.toastsCovered.length && !g1.bannerCovered, { alphaR, g1, tl });
    // pass 15 L1: the whole card is inside the stage and TAP TO DISMISS is visible (copy scrolls if the height had to be capped)
    const fit = await p.evaluate(() => { const c = document.querySelector('#bcCard'), st = c.offsetParent.getBoundingClientRect(), r = c.getBoundingClientRect(), t = c.querySelector('.tap').getBoundingClientRect();
      return { card: [r.top, r.bottom].map(Math.round), stage: [st.top, st.bottom].map(Math.round), tap: [t.top, t.bottom].map(Math.round), clamp: c.classList.contains('clamp'), inStage: r.top >= st.top - 1 && r.bottom <= Math.min(st.bottom, innerHeight) + 1, tapVisible: t.top >= r.top - 1 && t.bottom <= r.bottom + 1 && t.bottom <= innerHeight && t.height > 8 }; });
    ck(tag, 'L1: card inside the stage, TAP TO DISMISS visible', fit.inStage && fit.tapVisible, fit);
    if (small) { await shot('fit'); rep.errors[tag] = errs; ck(tag, 'zero console errors', !errs.length, errs); await c.close(); continue; }
    // 2) the shift log line
    const lg = await p.evaluate(() => { const card = document.querySelector('#bcCard'); card.hidden = true; const b2 = document.querySelector('button[data-sheet="log"]'); if (b2) b2.click();
      const li = [...document.querySelectorAll('#log li')].find(x => /alpha strike/i.test(x.textContent)); if (li) { li.scrollIntoView({ block: 'center' }); li.style.outline = '2px solid #ff6b5e'; } return { found: !!li, text: li ? li.textContent : '' }; });
    await sleep(400); await shot('log');
    ck(tag, "shift log shows Hale's alpha-strike line naming the abilities", lg.found && /Polaron alpha strike/.test(lg.text) && /Weak-Point Scan/.test(lg.text), lg);
    // 3) away: night watch, no alpha strike
    await boot(); await ready();
    const a3 = await p.evaluate(async () => { const BT = await import('/js/battle.js'), PC = await import('/js/pacing.js'), G = __T.G; __T.app.paused = true; for (const a of Object.values(G.ab)) if (a && typeof a === 'object') { a.cd = 0; a.active = 0; }
      PC.PACE_RT.offline = true; try { BT.startBattle('enroute', { enemy: 'jh_battlecruiser' }); } finally { PC.PACE_RT.offline = false; }
      const msgs = G.log.slice(-12).map(e => e.msg); return { nw: msgs.some(m => /night watch has the bridge/.test(m)), alpha: msgs.some(m => /alpha strike/i.test(m)), cds: Object.fromEntries(Object.entries(G.ab).map(([k, a]) => [k, +(a.cd / a.cdMax).toFixed(2)])) }; });
    ck(tag, 'away fight: night watch start (0.8-1.0 x cdMax), no alpha strike on top', a3.nw && !a3.alpha && Object.values(a3.cds).every(f => f >= 0.79), a3);
    rep.errors[tag] = errs; ck(tag, 'zero console errors', !errs.length, errs); await c.close();
  }
  // pass 15 L2: rotate while the card is up (390x844 <-> 844x390): the card re-lays out, no toast covered, still inside the stage
  { const errs = [], tag = 'rotate'; const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await c.addInitScript(() => { window.__TENACITY_TEST_DEATHS = true; });
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
    await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(600);
    await p.evaluate(async () => { window.__noSave = true; const G = __T.G, P = await import('/js/pacing.js'), E = await import('/js/encounters.js'), BT = await import('/js/battle.js');
      G.prog.rank = 1; G.prog.playDays = 20; G.prog.day = 25; Object.assign(G.ship, { hull: 100, power: 90, torps: 2 }); G.ship.faults = {}; G.sp.enc = E.freshEnc(); G.sp.lastBattleT = -1e9; P.PACE_RT.sessionT = 1e5; P.PACE_RT.idleT = 0;
      if (__T.MD && __T.MD.answerGentlePrompt) __T.MD.answerGentlePrompt(false); const mr = Math.random; Math.random = () => 0.999; try { BT.startBattle('enroute'); } finally { Math.random = mr; } });
    const chk = () => p.evaluate(() => { const c = document.querySelector('#bcCard'), r = c.getBoundingClientRect(), st = c.offsetParent.getBoundingClientRect(), ts = [...document.querySelectorAll('#toasts .toast')].map(t => t.getBoundingClientRect());
      return { card: !c.hidden, covered: ts.filter(t => t.left < r.right && t.right > r.left && t.top < r.bottom && t.bottom > r.top).length, inStage: r.top >= st.top - 1 && r.bottom <= Math.min(st.bottom, innerHeight) + 1, toasts: ts.length }; });
    await sleep(1600); const r0 = await chk();
    await p.setViewportSize({ width: 844, height: 390 }); await sleep(450); const r1 = await chk(); await p.screenshot({ path: OUT + 'pt15-rotate-landscape.png' }); rep.shots.push('shots/pt15-rotate-landscape.png');
    await p.setViewportSize({ width: 390, height: 844 }); await sleep(450); const r2 = await chk(); await p.screenshot({ path: OUT + 'pt15-rotate-portrait.png' }); rep.shots.push('shots/pt15-rotate-portrait.png');
    ck(tag, 'L2: rotating mid-card re-lays it out (portrait -> landscape -> portrait): no toast covered, card inside the stage', [r0, r1, r2].every(r => r.card && !r.covered && r.inStage && r.toasts >= 1), { r0, r1, r2 });
    rep.errors[tag] = errs; ck(tag, 'zero console errors', !errs.length, errs); await c.close(); }
  // pass 15 L3: the one-time crew-safety prompt waits while the card is up, and opens once it is dismissed
  for (const [w, h, m] of [[390, 844, true], [844, 390, true], [1280, 800, false]]) { const errs = [], tag = `${w}x${h} safety`; const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: m, hasTouch: m }); await c.addInitScript(() => { window.__TENACITY_TEST_DEATHS = true; });
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
    await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(600);
    const a = await p.evaluate(async () => { window.__noSave = true; const G = __T.G, BUS = await import('/js/bus.js'); G.sp.battle = null;
      BUS.redAlertCard({ title: "JEM'HADAR BATTLECRUISER", cls: 'Dominion capital ship', kicker: 'RED ALERT · CAPITAL SHIP', lines: ['She outguns us — if it goes badly, T\'Ren will break off. Expect hull damage.', 'Her polarons bleed through shields.'] });
      G.prog.playDays = 12; G.prog.med.prompt12 = false; return { due: __T.MD.gentlePromptDue ? __T.MD.gentlePromptDue() : null }; });
    await sleep(1200); const during = await p.evaluate(() => ({ card: !document.querySelector('#bcCard').hidden, prompt: !document.querySelector('#safetyPanel').hidden }));
    await p.screenshot({ path: OUT + `pt15-safety-queued-${w}x${h}.png` }); rep.shots.push(`shots/pt15-safety-queued-${w}x${h}.png`);
    await p.evaluate(() => document.querySelector('#bcCard').click()); await sleep(1200);
    const after = await p.evaluate(() => ({ card: !document.querySelector('#bcCard').hidden, prompt: !document.querySelector('#safetyPanel').hidden }));
    await p.screenshot({ path: OUT + `pt15-safety-after-${w}x${h}.png` }); rep.shots.push(`shots/pt15-safety-after-${w}x${h}.png`);
    ck(tag, 'L3: safety prompt queued while the card is up, opens after it is dismissed', a.due !== false && during.card && !during.prompt && !after.card && after.prompt, { a, during, after });
    rep.errors[tag] = errs; ck(tag, 'zero console errors', !errs.length, errs); await c.close(); }
  fs.writeFileSync(OUT + 'pt15-alpha-report.json', JSON.stringify(rep, null, 1));
  console.log(rep.fails.length ? 'PT15 FAIL\n' + rep.fails.join('\n') : 'PT15 PASS', Object.keys(rep.checks).length, 'checks', rep.shots.length, 'shots', JSON.stringify(rep.errors));
  await b.close(); process.exit(rep.fails.length ? 1 : 0);
})();
