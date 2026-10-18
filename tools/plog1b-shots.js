// Personal Log phase 1 follow-ups: CREW RELATIONS rows (standing label + 7-day trend instead of the number; the pin gets its own
// 44px column, nothing overlaps the opinion bar) at 390x844 / 844x390 / 1280x800 -> shots/plog1b-crew-relations{SUFFIX}{,-landscape,-desktop}.png
// NODE_PATH=/workspace/pwtools/node_modules node tools/plog1b-shots.js [base] [suffix, e.g. -before]
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const SUF = process.argv[3] || '';
const OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = { sizes: {} };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [w, h, mobile, suffix] of [[390, 844, true, ''], [844, 390, true, '-landscape'], [1280, 800, false, '-desktop']]) {
    const tag = `${w}x${h}`, S = R.sizes[tag] = { errors: [] };
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const p = await ctx.newPage();
    p.on('console', m => { if (['error', 'warning'].includes(m.type())) S.errors.push(`console.${m.type()}: ${m.text()}`); });
    p.on('pageerror', e => S.errors.push(`pageerror: ${e.message}`));
    await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(500);
    await p.evaluate(async () => {
      window.__noSave = true; const G = __T.G, P = G.prog, PR = await import('/js/progression.js');
      G.sp.cap.decideT = 1e9; G.ship.nextFault = 1e9; G.sp.ev.nextT = -1; P.day = 9;
      for (const c of PR.crewList()) P.opinions[c.id] = { okafor: 26, tren: 6, diallo: 9, hale: -24, thelev: 52, tull: 11, doru: 14, kovac: -3 }[c.id] ?? 3;
      if (P.plog) P.plog.snap = [{ day: 2, op: Object.fromEntries(PR.crewList().map(c => [c.id, Math.round(PR.opinionOf(c.id)) + ({ okafor: -9, hale: 6, thelev: -5, doru: -4 }[c.id] || 0)])) }];
      PR.crewTouch();
    });
    if (w < 900) await p.evaluate(() => document.querySelector('#btnFull') && document.querySelector('#btnFull').click());
    await sleep(300);
    await p.evaluate(() => { const sb = document.querySelector('.sheetBtns [data-sheet="crew"]'); if (sb && sb.offsetParent) sb.click(); }); await sleep(600);
    await p.evaluate(() => { const e = document.querySelector('#relations'); e.scrollIntoView({ block: 'start' }); });
    await sleep(300); await p.screenshot({ path: OUT + `plog1b-crew-relations${SUF}${suffix}.png` });
    // overlap check: every pin's box must not intersect its row's opinion bar; every pin >= 44 x 44
    S.check = await p.evaluate(() => { const bad = []; let pins = 0;
      for (const row of document.querySelectorAll('#relations .rel')) { const pin = row.querySelector('.pin'), bar = row.querySelector('.opbar'); if (!pin || !bar || !pin.offsetParent) continue; pins++;
        const a = pin.getBoundingClientRect(), c = bar.getBoundingClientRect(), nm = row.querySelector('.nm').innerText.split('\n')[0];
        if (a.right > c.left + 0.5 && a.left < c.right - 0.5) bad.push(`${nm}: pin overlaps bar`); if (a.width < 44 || a.height < 44) bad.push(`${nm}: pin ${Math.round(a.width)}x${Math.round(a.height)}`); }
      const nums = [...document.querySelectorAll('#relations .rel > b')].filter(x => /\d/.test(x.innerText)).length;
      return { pins, bad, numbersShown: nums, sample: (document.querySelector('#relations .rel') || {}).innerText }; });
    await ctx.close();
  }
  await b.close();
  R.ok = Object.values(R.sizes).every(s => !s.errors.length && !s.check.bad.length && s.check.numbersShown === 0);
  fs.writeFileSync(OUT + `plog1b-report${SUF}.json`, JSON.stringify(R, null, 1));
  console.log(JSON.stringify(R, null, 1)); console.log(R.ok ? 'PLOG1B PASS' : 'PLOG1B FAIL'); process.exit(R.ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
