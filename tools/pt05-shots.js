// Tester pass 05 m3: readiness hint with targets and matching units -> shots/pt05-readiness-hint*.png, shots/pt05-report.json
// NODE_PATH=/workspace/pwtools/node_modules node tools/pt05-shots.js [base]
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const issues = {}, R = { hint: {}, kinds: null };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [w, h, mobile, suffix] of [[390, 844, true, ''], [844, 390, true, '-landscape'], [1280, 800, false, '-desktop']]) {
    const tag = `${w}x${h}`; issues[tag] = [];
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const p = await ctx.newPage();
    p.on('console', m => { if (['error', 'warning'].includes(m.type())) issues[tag].push(`console.${m.type()}: ${m.text()}`); });
    p.on('pageerror', e => issues[tag].push(`pageerror: ${e.message}`));
    p.on('response', r => { if (r.status() >= 400) issues[tag].push(`HTTP ${r.status()} ${r.url()}`); });
    await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(500);
    // the tester's case: L5, HUD REP 49 and the rep component the weakest (49 of 600 earned at this rank -> 2/20)
    await p.evaluate(async () => {
      window.__noSave = true; const G = __T.G, PR = await import('/js/progression.js'); G.sp.cap.decideT = 1e9; G.ship.nextFault = 1e9; G.sp.ev.nextT = -1;
      PR.awardXP(500, 'manual'); G.prog.perf.q = 0.8; G.prog.perf.resp = 0.8; for (const c of PR.crewList()) G.prog.opinions[c.id] = 25;
    });
    await sleep(400);   // let the XP award's rep settle, then pin the tester's numbers: HUD REP 49, all of it earned at this rank
    await p.evaluate(async () => { const G = __T.G, PR = await import('/js/progression.js'); G.sp.rep = 49; G.prog.repSeen = 49; G.prog.repLifetime = 49; G.prog.repLost = 0; G.prog.rankSince.rep = 0; G.prog.rankSince.lost = 0; PR.computeReadiness(); });
    if (w < 900) await p.evaluate(() => document.querySelector('#btnFull').click());
    await sleep(400);
    await p.evaluate(() => document.querySelector('.sheetBtns [data-sheet="crew"]').click()); await sleep(500);
    await p.evaluate(() => { const e = document.querySelector('#career .ready') || document.querySelector('#career'); e.scrollIntoView({ block: 'start' }); let ps = e.parentElement; while (ps && !(ps.scrollHeight > ps.clientHeight && /auto|scroll/.test(getComputedStyle(ps).overflowY))) ps = ps.parentElement; if (ps) ps.scrollTop = Math.max(0, ps.scrollTop - 110); }); await sleep(300);
    R.hint[tag] = await p.evaluate(() => ({ hint: (document.querySelector('.rhint') || {}).innerText || null, parts: (document.querySelector('.rparts') || {}).innerText || null, hudRep: (document.querySelector('[data-stat="rep"]') || {}).innerText || null }));
    await p.screenshot({ path: OUT + `pt05-readiness-hint${suffix}.png` });
    if (!R.kinds) R.kinds = await p.evaluate(async () => {   // every hint kind names a target in real units and a concrete action
      const G = __T.G, P = G.prog, PR = await import('/js/progression.js'), out = {};
      const set = (o) => { Object.assign(P, o.p || {}); if (o.perf) Object.assign(P.perf, o.perf); if (o.op != null) for (const c of PR.crewList()) P.opinions[c.id] = o.op; PR.computeReadiness(); const h = PR.readinessHint(); return h && { k: h.k, unit: h.unit, act: h.act }; };
      out.rep = set({ p: { repLifetime: 49 }, perf: { q: 0.9, resp: 0.9 }, op: 30 });
      out.social = set({ p: { repLifetime: 5000 }, perf: { q: 0.9, resp: 0.9 }, op: 2 });
      out.perf = set({ p: { repLifetime: 5000 }, perf: { q: 0.05, resp: 0.05 }, op: 30 });
      // (the service fallback can't be the gap on its own: with perf/social/rep full, readiness is already 100)
      out.board = set({ p: { repLifetime: 5000, service: 5, boardMalus: 30, readyPeak: 50 }, perf: { q: 0.9, resp: 0.9 }, op: 30 });
      P.boardMalus = 0; P.level = 3; P.xp = 0; out.level = set({ p: { repLifetime: 5000, service: 5 }, perf: { q: 0.9, resp: 0.9 }, op: 30 });
      for (const [k, v] of Object.entries(out)) out[k].ok = !!(v && v.k === k && /\d/.test(v.unit) && v.act && v.act.length > 20);
      return out;
    });
    await ctx.close();
  }
  await b.close();
  R.issues = issues; R.ok = Object.values(R.kinds).every(x => x.ok) && Object.values(issues).every(a => !a.length);
  fs.writeFileSync(OUT + 'pt05-report.json', JSON.stringify(R, null, 1));
  console.log(JSON.stringify(R, null, 1)); process.exit(R.ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
