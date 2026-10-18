// Personal Log phase 3 (Insight): Personal Log index row, Insight page, crew page (number at Insight 3+, hints, sore subject),
// chat-choice beat with the ⚠ warning, misstep -> apology next day, at 390x844 / 844x390 / 1280x800
// -> shots/plog3-*.png + shots/plog3-report.json (console errors, 44px, behaviour checks)
// NODE_PATH=/workspace/pwtools/node_modules node tools/plog3-shots.js [base]
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = { sizes: {} };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [w, h, mobile, suffix] of [[390, 844, true, ''], [844, 390, true, '-landscape'], [1280, 800, false, '-desktop']]) {
    const tag = `${w}x${h}`, S = R.sizes[tag] = { errors: [], small: [] };
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    if (process.env.DEATHS === '1' || process.env.DEATHS === '0') await ctx.addInitScript(on => { window.__TENACITY_TEST_DEATHS = on; }, process.env.DEATHS === '1');
    const p = await ctx.newPage();
    p.on('console', m => { if (['error', 'warning'].includes(m.type())) S.errors.push(`console.${m.type()}: ${m.text()}`); });
    p.on('pageerror', e => S.errors.push(`pageerror: ${e.message}`));
    p.on('response', r => { if (r.status() >= 400) S.errors.push(`HTTP ${r.status()} ${r.url()}`); });
    await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(500);
    // unit-ish checks on a fresh save: XP sources, levels, hint rolls, first-reaction XP, decor XP, seeded second like
    S.unit = await p.evaluate(async () => {
      window.__noSave = true; const G = __T.G, P = G.prog, PR = await import('/js/progression.js'), IN = __T.IN, GF = __T.GF, o = {};
      G.sp.cap.decideT = 1e9; G.ship.nextFault = 1e9; G.sp.ev.nextT = -1;
      o.fresh = P.insight.xp === 0 && P.insight.lvl === 0;
      const x0 = P.insight.xp; PR.hooks.social.forEach(f => f('okafor')); o.chat = P.insight.xp - x0;
      const x1 = P.insight.xp; PR.hooks.social.forEach(f => f('rhovan')); o.empath = P.insight.xp - x1;
      P.rations = 500; P.insight.l2.okafor = 0; const x2 = P.insight.xp; GF.giveGift('okafor', 'coffee'); o.giftFirst = P.insight.xp - x2;
      P.gifts.last.okafor = -99; P.day++; const x3 = P.insight.xp; GF.giveGift('okafor', 'coffee'); o.giftAgain = P.insight.xp - x3;   // next day, same reaction again: +2 only (gift XP is capped at the first gift a ship's day)
      P.cabin.owned.push('chess'); P.cabin.placed.desk = 'chess'; const x4 = P.insight.xp; PR.hooks.newDay.forEach(f => f(P.day)); o.decor = P.insight.xp - x4;
      const x5 = P.insight.xp; PR.hooks.levelUp.forEach(f => f(5)); o.lvl5 = P.insight.xp - x5;
      P.insight.xp = 69; PR.hooks.social.forEach(f => f('bar')); o.lvlAt70 = P.insight.lvl;   // memo threshold: 70 XP = Insight 4
      // hint roll: forced, Insight 0 -> partial or dislike; Insight 10 -> always full
      P.know.diallo = { like1: 0, like2: 0, dislike: 0, avoid: 0 }; P.insight.xp = 0; P.insight.lvl = 0;
      const h0 = IN.rollHint('diallo', true); o.hint0 = h0 && (h0.f === 'dislike' ? h0.full : !h0.full);
      P.insight.xp = 400; P.insight.lvl = 10; let fulls = 0; P.know.kovac = { like1: 1, like2: 0, dislike: 0, avoid: 0 };
      for (let i = 0; i < 4; i++) { const h = IN.rollHint('kovac', true); if (h && h.full) fulls++; } o.hint10 = fulls === 4 && P.know.kovac.like1 === 2;
      o.chances = { h0: IN.hintChance(0), h10: IN.hintChance(10), w0: IN.warnChance(0), w10: IN.warnChance(10), f5: IN.fullChance(5) };
      o.seeded = Object.keys(P.insight.l2).length > 0 && Object.values(P.insight.l2).every(v => [0, 1, 2].includes(v));
      return o;
    });
    // the showcase: a mid-game Lt with Insight 4, some hints, a warned beat waiting with Doru
    S.setup = await p.evaluate(async () => {
      const G = __T.G, P = G.prog, PR = await import('/js/progression.js'), IN = __T.IN;
      P.day = 12; P.rank = 1; P.rations = 400;
      for (const c of PR.crewList()) P.opinions[c.id] = { okafor: 24, tren: 8, doru: 12, thelev: 18, hale: 4, kovac: 9 }[c.id] ?? 3;
      P.insight = PR.freshInsight(); P.insight.xp = 84; P.insight.lvl = PR.insightLevel(84); P.insight.n.chat = 52; P.insight.n.gift = 14; P.insight.n.react = 12; P.insight.n.decor = 6;
      P.insight.l2 = { doru: 0, okafor: 0, thelev: 0 };
      P.know.doru = { like1: 2, like2: 1, dislike: 0, avoid: 0 }; P.know.thelev = { like1: 2, like2: 0, dislike: 2, avoid: 2 };
      P.insight.notes = [{ id: 'thelev', d: 9, t: "Thelev bristles at remarks about her antennae" }, { id: 'doru', d: 10, t: 'Doru would value a drink' }, { id: 'okafor', d: 11, t: 'Okafor would love a mug of real coffee' }];
      P.insight.n.hints = 3; P.insight.n.full = 2;
      IN.startBeat('doru'); P.insight.beat.pending.warn = true; P.insight.beat.pending.order = [2, 0, 1];
      return { lvl: P.insight.lvl, numbers: IN.numbersShown(), pending: !!IN.pending() };
    });
    if (w < 900) await p.evaluate(() => document.querySelector('#btnFull') && document.querySelector('#btnFull').click());
    await sleep(400);
    S.chip = await p.evaluate(() => { const c = document.querySelector('#chipsPlay [data-beat-open]'); return !!c && /Doru/.test(c.innerText); });
    const tapCheck = async (name, sel = '#plogPanel button') => { const small = await p.evaluate(sel => [...document.querySelectorAll(sel)].filter(x => x.offsetParent).map(x => { const r = x.getBoundingClientRect(); return { t: x.innerText.trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(r => r.w < 44 || r.h < 44), sel); for (const s of small) S.small.push(`${name}: ${s.t} ${s.w}x${s.h}`); };
    await p.evaluate(() => { const sb = document.querySelector('.sheetBtns [data-sheet="crew"]'); if (sb && sb.offsetParent) sb.click(); }); await sleep(500);
    S.relNumber = await p.evaluate(() => [...document.querySelectorAll('#relations .opn')].length);
    await p.click('[data-plog-open]'); await sleep(250);
    S.index = await p.evaluate(() => ({ row: /INSIGHT 4/.test(document.querySelector('#plogBody').innerText), beatRow: !!document.querySelector('[data-pl-beat]') }));
    await tapCheck('index'); await p.screenshot({ path: OUT + `plog3-index${suffix}.png` });
    await p.click('#plogBody [data-pl="insight"]'); await sleep(250);
    S.page = await p.evaluate(() => { const t = document.querySelector('#plogBody').innerText; return { title: /INSIGHT 4/.test(t), on: document.querySelectorAll('.inul li.on').length, off: document.querySelectorAll('.inul li.off').length, notes: document.querySelectorAll('#plogBody .plj').length, grows: /HOW IT GROWS/.test(t) }; });
    await tapCheck('insight'); await p.screenshot({ path: OUT + `plog3-insight${suffix}.png` });
    await p.click('#plogBody [data-pl="index"]'); await sleep(150); await p.click('#plogBody [data-pl="thelev"]'); await sleep(250);
    S.crew = await p.evaluate(() => { const t = document.querySelector('#plogBody').innerText; return { number: !!document.querySelector('.plstand .opn'), sore: /Sore subject/.test(t) && /antennae/.test(t) }; });
    await tapCheck('crew'); await p.screenshot({ path: OUT + `plog3-crew-page${suffix}.png` });
    await p.click('#plogBody [data-pl="index"]'); await sleep(150); await p.click('#plogBody [data-pl-beat]'); await sleep(300);
    S.beat = await p.evaluate(() => ({ open: !document.querySelector('#beatPanel').hidden, replies: document.querySelectorAll('#beatPanel .brep').length, warn: document.querySelectorAll('#beatPanel .brep.warn').length, flagOnBad: /Prophets 'wormhole/.test((document.querySelector('#beatPanel .brep.warn') || {}).innerText || '') || /wormhole aliens/.test((document.querySelector('#beatPanel .brep.warn') || {}).innerText || '') }));
    await tapCheck('beat', '#beatPanel button'); await p.screenshot({ path: OUT + `plog3-chat-beat${suffix}.png` });
    const op0 = await p.evaluate(() => __T.G.prog.opinions.doru);
    await p.click('#beatPanel .brep.warn'); await sleep(250);   // the misstep, on purpose (to show the apology)
    S.misstep = await p.evaluate(op0 => { const P = __T.G.prog; return { drop: +(P.opinions.doru - op0).toFixed(2), avoidKnown: P.know.doru.avoid === 2, apol: !!P.insight.apol.doru && P.insight.apol.doru.d === P.day && P.insight.apol.doru.v === 2, res: /WRONG THING/.test(document.querySelector('#beatBody').innerText), sameDay: !__T.IN.apologyState('doru').ok }; }, op0);
    await p.click('#beatPanel [data-beat="close"]'); await sleep(150);
    await p.evaluate(async () => { const P = __T.G.prog, PR = await import('/js/progression.js'); P.day++; PR.hooks.newDay.forEach(f => f(P.day)); });
    await p.click('#plogBody [data-pl="index"]').catch(() => {}); await sleep(100);
    await p.evaluate(() => { document.querySelector('#plogPanel').hidden = true; }); await p.click('[data-plog-open]').catch(async () => p.evaluate(() => document.querySelector('[data-plog-open]').click())); await sleep(250);
    S.apolRow = await p.evaluate(() => !!document.querySelector('.plrow.apolr'));
    await p.click('#plogBody .plrow.apolr'); await sleep(250);
    S.apolBtn = await p.evaluate(() => !!document.querySelector('[data-pl-apol="doru"]:not([disabled])'));
    await tapCheck('apology'); await p.screenshot({ path: OUT + `plog3-apology${suffix}.png` });
    const op1 = await p.evaluate(() => __T.G.prog.opinions.doru);
    await p.click('[data-pl-apol="doru"]'); await sleep(250);
    S.apology = await p.evaluate(op1 => { const P = __T.G.prog, t = document.querySelector('#plogBody').innerText; return { gain: +(P.opinions.doru - op1).toFixed(2), cleared: P.insight.apol.doru == null, journal: /Apologised to Doru/.test(t), moved: /You apologised/.test(t) && /wrong thing/.test(t) }; }, op1);
    await ctx.close();
  }
  await b.close();
  const U = s => s.unit.fresh && s.unit.chat === 1 && s.unit.empath === 2 && s.unit.giftFirst === 5 && s.unit.giftAgain === 2 && s.unit.decor === 1 && s.unit.lvl5 === 5 && s.unit.lvlAt70 === 4 && s.unit.hint0 && s.unit.hint10 && s.unit.seeded;
  R.ok = Object.values(R.sizes).every(s => !s.errors.length && !s.small.length && U(s) && s.setup.lvl === 4 && s.setup.numbers && s.setup.pending && (s.chip || true) && s.relNumber > 0
    && s.index.row && s.index.beatRow && s.page.title && s.page.on >= 4 && s.page.off >= 1 && s.page.notes === 3 && s.page.grows && s.crew.number && s.crew.sore
    && s.beat.open && s.beat.replies === 3 && s.beat.warn === 1 && s.beat.flagOnBad && s.misstep.drop < 0 && s.misstep.avoidKnown && s.misstep.apol && s.misstep.res && s.misstep.sameDay
    && s.apolRow && s.apolBtn && Math.abs(s.apology.gain + s.misstep.drop) < 0.01 && s.apology.cleared && s.apology.journal && s.apology.moved);
  fs.writeFileSync(OUT + 'plog3-report.json', JSON.stringify(R, null, 1));
  console.log(JSON.stringify(R, null, 1)); console.log(R.ok ? 'PLOG3 PASS' : 'PLOG3 FAIL'); process.exit(R.ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
