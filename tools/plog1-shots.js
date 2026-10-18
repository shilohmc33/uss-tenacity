// Personal Log phase 1 (memo phase A, save v8): CREW-sheet entry, log index, a crew page, Seo's former-shipmate page
// at 390x844 / 844x390 / 1280x800 -> shots/plog1-*.png + shots/plog1-report.json (console errors, 44px tap targets, content)
// NODE_PATH=/workspace/pwtools/node_modules node tools/plog1-shots.js [base]
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const issues = {}, R = { sizes: {} };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [w, h, mobile, suffix] of [[390, 844, true, ''], [844, 390, true, '-landscape'], [1280, 800, false, '-desktop']]) {
    const tag = `${w}x${h}`; issues[tag] = []; const S = R.sizes[tag] = { small: [] };
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    if (process.env.DEATHS === '1' || process.env.DEATHS === '0') await ctx.addInitScript(on => { window.__TENACITY_TEST_DEATHS = on; }, process.env.DEATHS === '1');
    const p = await ctx.newPage();
    p.on('console', m => { if (['error', 'warning'].includes(m.type())) issues[tag].push(`console.${m.type()}: ${m.text()}`); });
    p.on('pageerror', e => issues[tag].push(`pageerror: ${e.message}`));
    p.on('response', r => { if (r.status() >= 400) issues[tag].push(`HTTP ${r.status()} ${r.url()}`); });
    await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(500);
    // a week or so of play, compressed: repairs, chats, a deck task, kit, dinner, an injury + recovery, Seo's scripted transfer
    S.setup = await p.evaluate(async () => {
      window.__noSave = true; const G = __T.G, P = G.prog, PR = await import('/js/progression.js'), PL = __T.PL;
      G.sp.cap.decideT = 1e9; G.ship.nextFault = 1e9; G.sp.ev.nextT = -1;
      P.day = 9; const day = d => { P.day = d; G.ship.stardate += 2.6; };
      for (const c of PR.crewList()) P.opinions[c.id] = { okafor: 18, tren: 6, diallo: 9, hale: -4, thelev: 22, tull: 11 }[c.id] ?? 3;
      P.plog.snap = [{ day: 2, op: Object.fromEntries(PR.crewList().map(c => [c.id, Math.round(PR.opinionOf(c.id)) + ({ okafor: -9, hale: 6, thelev: -5 }[c.id] || 0)])) }];
      day(3); __T.CL.transferOff('seo', 'utopia', 'scripted');
      day(4); PR.nudge('okafor', 3, 'excellent repair|warpcore'); PR.chatXP('okafor'); PR.nudge('thelev', 1, 'chat'); PL.addEntry('thelev', 'chat');
      day(5); P.chatT = -1e9; PR.nudge('okafor', -1, 'ignored fault|coolant'); PR.nudge('hale', -1, 'ignored fault|loader'); PR.nudge('okafor', 1, 'station work');
      day(6); PR.nudge('okafor', 3, 'kit|tricorder'); PR.nudge('okafor', 1, 'deck task'); PR.nudge('tull', 2, 'dinner', true); PR.nudge('okafor', 2, 'dinner', true);
      day(7); P.chatT = -1e9; PR.chatXP('okafor'); PR.nudge('okafor', 3, 'excellent repair|warpcore'); PR.nudge('okafor', 3, 'excellent repair|warpcore');
      PL.addEntry('okafor', 'injured', 'a coolant burst', 0); PL.addEntry('okafor', 'visit'); PL.addEntry('okafor', 'healed');
      day(9); P.chatT = -1e9; PR.chatXP('okafor');
      return { journal: P.plog.journal.length, hist: Object.keys(P.plog.hist).length, version: G.version };
    });
    if (w < 900) await p.evaluate(() => document.querySelector('#btnFull') && document.querySelector('#btnFull').click());
    await sleep(300);
    await p.evaluate(() => { const sb = document.querySelector('.sheetBtns [data-sheet="crew"]'); if (sb && sb.offsetParent) sb.click(); }); await sleep(500);
    await p.evaluate(() => { const e = document.querySelector('#plogBox'); e.scrollIntoView({ block: 'start' }); let ps = e.parentElement; while (ps && !(ps.scrollHeight > ps.clientHeight && /auto|scroll/.test(getComputedStyle(ps).overflowY))) ps = ps.parentElement; if (ps) ps.scrollTop = Math.max(0, ps.scrollTop - 110); });
    await sleep(300); await p.screenshot({ path: OUT + `plog1-crew-sheet${suffix}.png` });
    const tapCheck = async name => { const small = await p.evaluate(() => [...document.querySelectorAll('#plogPanel button, #plogBox button')].filter(x => x.offsetParent).map(x => { const r = x.getBoundingClientRect(); return { t: x.innerText.trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(r => r.w < 44 || r.h < 44)); for (const s of small) S.small.push(`${name}: ${s.t} ${s.w}x${s.h}`); };
    await tapCheck('sheet');
    await p.click('[data-plog-open]'); await sleep(300);
    S.index = await p.evaluate(() => ({ rows: document.querySelectorAll('#plogBody .plrow').length, former: document.querySelectorAll('#plogBody .plrow.alum').length, text: document.querySelector('#plogBody').innerText.slice(0, 300) }));
    await tapCheck('index'); await p.screenshot({ path: OUT + `plog1-index${suffix}.png` });
    await p.click('#plogBody [data-pl="okafor"]'); await sleep(250);
    S.page = await p.evaluate(() => ({ text: document.querySelector('#plogBody').innerText, moved: document.querySelectorAll('.plmv li').length, journal: document.querySelectorAll('.plj').length }));
    S.page.numberHidden = !/[+−-]\d{1,3}\b/.test(S.page.text.split('WHAT MOVED IT')[0]);
    await tapCheck('page'); await p.screenshot({ path: OUT + `plog1-crew-page${suffix}.png` });
    await p.click('#plogBody [data-pl="index"]'); await sleep(200); await p.click('#plogBody [data-pl="seo"]'); await sleep(250);
    S.seo = await p.evaluate(() => { const t = document.querySelector('#plogBody').innerText; return { handwritten: /PERSONAL LOG, SUPPLEMENTAL/.test(t), posting: /Utopia Planitia/.test(t), frozen: /FROZEN/.test(t) }; });
    await tapCheck('seo'); await p.screenshot({ path: OUT + `plog1-former-shipmate${suffix}.png` });
    await p.click('#plogPanel [data-close="plogPanel"]'); await sleep(200);
    S.closed = await p.evaluate(() => document.querySelector('#plogPanel').hidden);
    await ctx.close();
  }
  await b.close();
  R.issues = issues;
  R.ok = Object.values(issues).every(a => !a.length) && Object.values(R.sizes).every(s => !s.small.length && s.index.former >= 1 && s.page.moved === 5 && s.page.journal >= 5 && s.page.numberHidden && s.seo.handwritten && s.seo.posting && s.closed);
  fs.writeFileSync(OUT + 'plog1-report.json', JSON.stringify(R, null, 1));
  console.log(JSON.stringify(R, (k, v) => k === 'text' ? undefined : v, 1)); console.log(R.ok ? 'PLOG1 PASS' : 'PLOG1 FAIL'); process.exit(R.ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
