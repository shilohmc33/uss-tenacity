// pt04 BUG-05 guard: measures every visible interactive control (buttons, tappable tiles, sheet controls, modals)
// at 390x844, 844x390 and 1280x800 in both WINDOW and FULL modes, across every sheet and modal; fails if any is under 44 px.
// NODE_PATH=/workspace/pwtools/node_modules node tools/tap44-check.js [base]   -> shots/tap44-report.json, exit 1 on failure
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const OUT = __dirname + '/../shots/';
const MIN = 44;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SEL = 'button,a[href],input,select,textarea,[role=button],[data-sheet],[data-node],[data-lift],[data-fix],[data-task],[data-close],[data-req],[data-fav],[data-sink],[data-kit],[data-slot],[data-spec],[data-spick],[data-board],[data-board-open],[data-pin],[data-gentle],[data-dpick],.stat';
const report = { min: MIN, sizes: {}, fails: [], errors: {}, scenes: {} };
async function measure(p, tag, scene) {
  const r = await p.evaluate(([SEL, MIN]) => {
    const vw = innerWidth, out = [];
    for (const el of document.querySelectorAll(SEL)) {
      if (el.closest('#debug,#loading')) continue;
      if (el.parentElement && el.parentElement.closest(SEL)) continue;   // nested inside a measured control (e.g. a tile's value span)
      if (el.matches('[data-spec=""]') && !el.matches('button')) continue;   // a data attribute, not a control
      if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      const b = el.getBoundingClientRect(); if (b.width < 1 || b.height < 1) continue;
      if (b.right <= 0 || b.left >= vw) continue;   // parked off-screen drawer
      if (el.disabled && el.closest('.stat')) continue;
      const id = el.id ? '#' + el.id : el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : el.tagName.toLowerCase();
      const ds = Object.keys(el.dataset).map(k => `${k}=${el.dataset[k]}`).join(',');
      out.push({ el: id + (ds ? `[${ds}]` : ''), text: (el.innerText || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 28), w: Math.round(b.width), h: Math.round(b.height), ok: b.width >= MIN - 0.5 && b.height >= MIN - 0.5 });
    }
    return out;
  }, [SEL, MIN]);
  const key = `${tag} ${scene}`; report.scenes[key] = { n: r.length, small: r.filter(x => !x.ok).length };
  for (const x of r) if (!x.ok) report.fails.push({ size: tag, scene, ...x });
  return r.length;
}
async function setup(p) {
  await p.evaluate(async () => {
    const PR = await import('/js/progression.js'), G = __T.G; window.__noSave = true;
    G.sp.cap.decideT = 1e9; G.ship.nextFault = 1e9; G.sp.ev.nextT = -1;
    PR.awardXP(9000, 'manual'); G.prog.rank = 1; __T.CB.applyTier();
    G.prog.specOffered = 99; G.sp.rep = 3000; G.prog.repLifetime = 9000; G.prog.playDays = 12; G.prog.med.prompt12 = true;   // pass 06: the Crew safety prompt is measured in pt06-shots
    const C = G.prog.cabin; C.rations = 5000; const ids = Object.keys(__T.CB.DECOR).slice(0, 3); for (const id of ids) { if (!C.owned.includes(id)) C.owned.push(id); }
    if (G.prog.fleet) G.prog.fleet.rep = 60;
    G.ship.faults.coolant = { sev: 'med', t: 0, cost: 1, escT: 0 };
    G.prog.requests = G.prog.requests || [];
  });
  await sleep(800);
}
async function opened(p, tag, scene, sel) { const ok = await p.evaluate(sel => { const e = document.querySelector(sel); return !!e && !e.hidden; }, sel); (report.opened = report.opened || {})[`${tag} ${scene}`] = ok; if (!ok) report.fails.push({ size: tag, scene, el: sel, text: 'did not open (not measured)', w: 0, h: 0 }); }
const sheets = ['orders', 'duty', 'crew', 'log'];
async function openSheet(p, n) { await p.evaluate(n => { const b = document.querySelector(`.sheetBtns [data-sheet="${n}"]`) || document.querySelector(`[data-sheet="${n}"]`); b && b.click(); }, n); await sleep(500); }
async function closeAll(p) { await p.evaluate(() => { for (const id of ['decorPanel', 'specPanel', 'boardPanel', 'report', 'liftPanel']) { const e = document.getElementById(id); if (e) e.hidden = true; } const c = document.querySelector('#sheetClose'); if (c && c.getBoundingClientRect().right <= innerWidth && c.checkVisibility()) c.click(); }); await sleep(400); }
async function mode(p, m) { await p.evaluate(m => document.querySelector(m === 'full' ? '#btnFull' : '#btnWindow').click(), m); await sleep(500); }
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [w, h, mobile] of [[390, 844, true], [844, 390, true], [1280, 800, false]]) {
    const tag = `${w}x${h}`; report.errors[tag] = [];
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    await ctx.addInitScript(() => { window.__TENACITY_SKIP_NAME = true; window.__TENACITY_SKIP_BG = true; window.__TENACITY_NO_IDLE = true; });   // v18: skip the name / Academy prompts; no idle pause in long shot runs
    if (process.env.DEATHS === '1' || process.env.DEATHS === '0') await ctx.addInitScript(on => { window.__TENACITY_TEST_DEATHS = on; }, process.env.DEATHS === '1');   // phase 6: force deaths ON/OFF (default: the shipped PROG value, ON)
    const p = await ctx.newPage();
    p.on('console', m => { if (['error', 'warning'].includes(m.type())) report.errors[tag].push(m.text()); });
    p.on('pageerror', e => report.errors[tag].push('pageerror: ' + e.message));
    await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
    await sleep(600); await closeAll(p); await setup(p);
    let n = 0;
    for (const m of ['window', 'full']) {
      await mode(p, m); n += await measure(p, tag, `${m} hud`);
      for (const s of sheets) { await openSheet(p, s); n += await measure(p, tag, `${m} sheet:${s}`); await closeAll(p); }
    }
    await mode(p, 'full');
    // spec picker, decor chooser, board, shift report, lift, space view
    await p.evaluate(async () => { const BD = __T.BD; __T.G.prog.specOffered = 0; const PR = await import('/js/progression.js'); PR.awardXP(4000, 'manual'); });
    await openSheet(p, 'crew'); await p.evaluate(() => { const s = document.querySelector('[data-spec=open]'); s && s.click(); }); await sleep(500); await opened(p, tag, 'spec picker', '#specPanel'); n += await measure(p, tag, 'spec picker'); await closeAll(p);
    await openSheet(p, 'crew'); await p.evaluate(() => { const s = document.querySelector('[data-slot]'); s && s.click(); }); await sleep(500); await opened(p, tag, 'decor chooser', '#decorPanel'); n += await measure(p, tag, 'decor chooser');
    if (w === 390) await p.screenshot({ path: OUT + 'pt04-controls-decor.png' });
    await closeAll(p);
    await p.evaluate(async () => { const PR = await import('/js/progression.js'); const G = __T.G; PR.awardXP(20000, 'manual'); Object.assign(G.prog.opinions, { tren: 58, okafor: 81, diallo: 66, hale: 40 }); G.prog.perf.q = 0.95; G.prog.perf.resp = 0.95; G.prog.service = 5; G.prog.repLifetime = 12000; G.prog.rankSince.rep = 0; G.prog.playDays = 20; PR.promotionDue('readiness'); }); await sleep(800);
    await opened(p, tag, 'board', '#boardPanel'); n += await measure(p, tag, 'board'); await closeAll(p);
    await p.evaluate(async () => { const H = await import('/js/ui/hud.js'); H.showBackOnWatch(3 * 3600); }); await sleep(800); await opened(p, tag, 'back on watch', '#wbCard'); n += await measure(p, tag, 'back on watch'); await p.evaluate(() => { document.querySelector('#wbCard').hidden = true; });   // v18: the BACK ON WATCH card replaces the Shift Report await closeAll(p);
    // Oct 26: transient controls, forced visible: BACK ON WATCH with away happenings, the Sensors chip + the other
    // on-demand chips (romance / beat signals, injected with their real classes), and the vignette tap-bonus button
    await p.evaluate(async () => { const H = await import('/js/ui/hud.js'); H.showBackOnWatch(3 * 3600, [{ line: 'Diallo ran a long-range sensor sweep.', xp: 8 }, { line: 'Okafor flushed the plasma manifold.', xp: 8 }]); }); await sleep(800);
    await opened(p, tag, 'back on watch + happenings', '#wbCard .bowHaps'); n += await measure(p, tag, 'back on watch + happenings'); await p.evaluate(() => { document.querySelector('#wbCard').hidden = true; });
    await p.evaluate(() => { const VG = __T.VG, G = __T.G; G.sp.battle = null; G.sp.alert = null; G.sp.ev.active = null; document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); VG.endVig('x'); G.prog.day = 12; VG.startVig(VG.VIGS.find(v => v.id === 'convoy'), { dur: 40, bonus: 'xp' }); }); await sleep(600);
    await p.evaluate(() => { for (const id of ['chipsPlay', 'chipsInfo']) { const r = document.getElementById(id); if (r) r.insertAdjacentHTML('afterbegin', '<button class="chip romc t44x">💌 Seo</button><button class="chip beatc t44x">💬 Diallo</button>'); } });
    await opened(p, tag, 'sensors chip', '.chip.vigc'); n += await measure(p, tag, 'deck + sensors / signal chips'); await p.evaluate(() => document.querySelectorAll('.t44x').forEach(e => e.remove()));
    await p.evaluate(() => { [...document.querySelectorAll('.chip.vigc')].find(b => b.offsetParent !== null)?.click(); __T.VG.tickVig(4); }); await sleep(600);
    await opened(p, tag, 'vignette bonus', '#vigBox .vbBonus'); n += await measure(p, tag, 'vignette bonus');
    await p.evaluate(() => { __T.VG.endVig('x'); __T.setView('deck'); }); await sleep(300);
    await p.evaluate(async () => { const H = await import('/js/ui/hud.js'); H.openLiftPanel(); }); await sleep(800); await opened(p, tag, 'turbolift', '#liftPanel'); n += await measure(p, tag, 'turbolift'); await closeAll(p);
    await p.evaluate(() => document.querySelector('#btnView').click()); await sleep(600); n += await measure(p, tag, 'space view');
    await p.evaluate(async () => { const B = await import('/js/battle.js'); B.startBattle(); }); await sleep(1500); n += await measure(p, tag, 'battle'); 
    report.sizes[tag] = { controls: n, small: report.fails.filter(f => f.size === tag).length };
    await ctx.close();
  }
  await b.close();
  report.pass = report.fails.length === 0 && Object.values(report.errors).every(e => !e.length);
  fs.writeFileSync(OUT + 'tap44-report.json', JSON.stringify(report, null, 1));
  const uniq = {}; for (const f of report.fails) { const k = `${f.size} ${f.el} "${f.text}" ${f.w}x${f.h}`; uniq[k] = (uniq[k] || []).concat(f.scene); }
  console.log(JSON.stringify(report.sizes)); for (const [k, v] of Object.entries(uniq)) console.log('SMALL', k, '—', [...new Set(v)].join('; '));
  console.log('errors', JSON.stringify(report.errors)); console.log(report.pass ? 'TAP44 PASS' : 'TAP44 FAIL', process.env.DEATHS === '0' ? '(deaths OFF)' : '(deaths ON)');
  process.exit(report.pass ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
