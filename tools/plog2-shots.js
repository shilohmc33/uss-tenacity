// Personal Log phase 2 (gifts): gift picker, reaction, gift locker (DS9 Promenade), care package
// at 390x844 / 844x390 / 1280x800 -> shots/plog2-*.png + shots/plog2-report.json (console errors, 44px, behaviour checks)
// NODE_PATH=/workspace/pwtools/node_modules node tools/plog2-shots.js [base]
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
    // a mid-game Lt docked at DS9: some tastes already learned, a Personal item in the locker, Doru's birthday, Seo transferred
    S.setup = await p.evaluate(async () => {
      window.__noSave = true; const G = __T.G, P = G.prog, PR = await import('/js/progression.js'), GF = __T.GF;
      G.sp.cap.decideT = 1e9; G.ship.nextFault = 1e9; G.sp.ev.nextT = -1; G.sp.location = 'ds9'; G.sp.travel = null;
      P.day = 12; P.rations = 640; P.rank = 1;
      for (const c of PR.crewList()) P.opinions[c.id] = { okafor: 24, tren: 8, doru: 12, thelev: 18, hale: 4 }[c.id] ?? 3;
      P.know.doru = { like1: 2, like2: 2, dislike: 2, avoid: 0 }; P.insight.l2.doru = 0; P.know.thelev = { like1: 2, like2: 0, dislike: 0, avoid: 0 };   // phase 3: Doru's seeded second like pinned to pool 0 (springwine)
      P.gifts.seed = 0; while (GF.birthdayOf('doru') !== P.day % PR.PROG.gifts.year) P.gifts.seed++;   // Doru's birthday today
      __T.CL.transferOff('seo', 'utopia', 'scripted'); P.know.seo = { like1: 1, like2: 0, dislike: 0, avoid: 0 };
      const bought = GF.buyForLocker('springwine');
      return { bought, locker: GF.lockerCount(), occ: (GF.occasionOf(P.crew.occ.doru) || {}).why };
    });
    if (w < 900) await p.evaluate(() => document.querySelector('#btnFull') && document.querySelector('#btnFull').click());
    await sleep(300);
    await p.evaluate(() => { const sb = document.querySelector('.sheetBtns [data-sheet="crew"]'); if (sb && sb.offsetParent) sb.click(); }); await sleep(500);
    const tapCheck = async name => { const small = await p.evaluate(() => [...document.querySelectorAll('#plogPanel button')].filter(x => x.offsetParent).map(x => { const r = x.getBoundingClientRect(); return { t: x.innerText.trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(r => r.w < 44 || r.h < 44)); for (const s of small) S.small.push(`${name}: ${s.t} ${s.w}x${s.h}`); };
    await p.click('[data-plog-open]'); await sleep(250);
    await p.click('#plogBody [data-pl="doru"]'); await sleep(200); await p.click('[data-pl-gift="doru"]'); await sleep(250);
    S.picker = await p.evaluate(() => ({ rows: document.querySelectorAll('#plogBody .gift').length, loves: document.querySelectorAll('#plogBody .gh.love').length, likes: document.querySelectorAll('#plogBody .gh.like').length, dislikes: document.querySelectorAll('#plogBody .gh.dis').length, locker: !!document.querySelector('[data-pl-give="springwine"]:not([disabled])'), occasion: /birthday/.test(document.querySelector('#plogBody').innerText) }));
    await tapCheck('picker'); await p.screenshot({ path: OUT + `plog2-gift-picker${suffix}.png` });
    const before = await p.evaluate(() => __T.G.prog.opinions.doru);
    await p.click('[data-pl-give="springwine"]'); await sleep(250);
    S.reaction = await p.evaluate(b0 => { const G = __T.G; return { banner: (document.querySelector('.plres') || {}).innerText || null, r: G.prog.gifts.lastR.doru && G.prog.gifts.lastR.doru.r, gain: +(G.prog.opinions.doru - b0).toFixed(2), journal: /Gave Doru/.test(document.querySelector('#plogBody').innerText), moved: /Your gift/.test(document.querySelector('#plogBody').innerText), cooldown: !!document.querySelector('[data-pl-gift="doru"][disabled]') }; }, before);
    await tapCheck('reaction'); await p.screenshot({ path: OUT + `plog2-gift-reaction${suffix}.png` });
    await p.click('#plogBody [data-pl="index"]'); await sleep(150); await p.click('#plogBody [data-pl="locker"]'); await sleep(250);
    S.locker = await p.evaluate(() => ({ open: /Promenade shops are open/.test(document.querySelector('#plogBody').innerText), buy: document.querySelectorAll('[data-pl-buy]:not([disabled])').length, treasuredLocked: document.querySelectorAll('[data-pl-buy="bloodwine"][disabled]').length }));
    await tapCheck('locker'); await p.screenshot({ path: OUT + `plog2-gift-locker${suffix}.png` });
    await p.click('#plogBody [data-pl="index"]'); await sleep(150); await p.click('#plogBody [data-pl="seo"]'); await sleep(200);
    const fr0 = await p.evaluate(() => __T.G.prog.fleetRep);
    await p.click('[data-pl-care="seo"]'); await sleep(250);
    S.care = await p.evaluate(fr0 => { const G = __T.G, a = G.prog.alumni.find(x => x.id === 'seo'); return { opinion: a.opinion, care: G.prog.gifts.care.seo, fleetRepSame: G.prog.fleetRep === fr0, banner: !!document.querySelector('.plres') }; }, fr0);
    await tapCheck('care'); await p.screenshot({ path: OUT + `plog2-care-package${suffix}.png` });
    await ctx.close();
  }
  await b.close();
  R.ok = Object.values(R.sizes).every(s => !s.errors.length && !s.small.length && s.setup.bought && s.setup.occ === 'birthday' && s.picker.loves >= 1 && s.picker.dislikes >= 1 && s.picker.locker && s.picker.occasion
    && s.reaction.r === 'delighted' && s.reaction.gain > 0 && s.reaction.journal && s.reaction.moved && s.reaction.cooldown && s.locker.open && s.locker.buy >= 5 && s.locker.treasuredLocked === 1 && s.care.care > 0 && s.care.fleetRepSame && s.care.banner);
  fs.writeFileSync(OUT + 'plog2-report.json', JSON.stringify(R, null, 1));
  console.log(JSON.stringify(R, null, 1)); console.log(R.ok ? 'PLOG2 PASS' : 'PLOG2 FAIL'); process.exit(R.ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
