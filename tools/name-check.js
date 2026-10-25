// Lt name check (Oct 24): the new-game name entry (no stacked modals) and the blank default, the one-time prompt for an
// older save (held while a red alert, a sheet or a story is open, then shown once), the Personal Log rename (same form),
// sanitising (entry + a hand-edited save) and escaping (a name forced past the sanitiser renders as text), and the name in
// use (BACK ON WATCH card + its welcome-back crew line, crew lines ~1 in 3). 390x844, 844x390, 1280x800; 0 console errors, 0 failed requests.
// Usage: node tools/name-check.js   (SHOTS=0 to skip shots/name-entry-*.png, shots/name-in-use-390x844.png)
const { chromium } = require('playwright-core'); const BASE = process.env.BASE || 'http://127.0.0.1:8765/', OUT = __dirname + '/../shots/', KEY = 'tenacity.save.v1';
const sleep = ms => new Promise(r => setTimeout(r, ms)), SHOTS = process.env.SHOTS !== '0';
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [], net = [], fails = [], J = JSON.stringify, host = new URL(BASE).host, ok = (c, m) => { if (!c) fails.push(m); else console.log('ok ' + m.split(' {')[0].split(' [')[0]); };
  for (const [w, h] of [[390, 844], [844, 390], [1280, 800]]) {
    const tag = `${w}x${h}`, c = await br.newContext({ viewport: { width: w, height: h } }), p = await c.newPage(), R = {};
    p.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); }); p.on('pageerror', e => errs.push(`${tag}: ${e.message}`));
    p.on('response', r => { if (r.status() >= 400) net.push(`${tag}: ${r.status()} ${r.url()}`); });
    p.on('requestfailed', r => { if (new URL(r.url()).host === host) net.push(`${tag}: failed ${r.url()} ${r.failure() && r.failure().errorText}`); });
    p.on('dialog', d => { errs.push(`${tag}: dialog ${d.message()}`); d.dismiss(); });
    const ready = () => p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
    const shown = () => p.evaluate(() => !document.querySelector('#namePanel').hidden);
    const modals = () => p.evaluate(() => [...document.querySelectorAll('.modal')].filter(m => !m.hidden).map(m => m.id));
    const name = () => p.evaluate(() => ({ ...__T.G.lt.name, done: __T.G.lt.nameDone }));
    // ---- 1. a new game: the entry shows at the start, alone; blank -> the default surname ----
    await p.goto(BASE + '?reset=1'); await ready();
    await p.waitForFunction(() => !document.querySelector('#namePanel').hidden, null, { timeout: 8000 }).catch(() => {});
    R.newShown = await shown(); R.newModals = await modals(); R.newFit = await p.evaluate(() => { const c = document.querySelector('#namePanel .card').getBoundingClientRect(), ins = [...document.querySelectorAll('#namePanel input, #namePanel button')].map(e => e.getBoundingClientRect()); return { inView: c.top >= 0 && c.bottom <= innerHeight + 1 && c.left >= 0 && c.right <= innerWidth + 1, minH: Math.min(...ins.map(r => r.height)) }; });
    await p.fill('#namePanel input[name="first"]', 'Jean-Luc'); await p.fill('#namePanel input[name="last"]', "  Pi  card ");
    R.preview = await p.evaluate(() => document.querySelector('#namePanel .nprev').textContent);
    if (SHOTS) await p.screenshot({ path: OUT + `name-entry-${tag}.png` });
    await p.fill('#namePanel input[name="first"]', ''); await p.fill('#namePanel input[name="last"]', '   ');
    await p.click('#namePanel [data-name="ok"]'); await sleep(200);
    R.def = await name(); R.defHidden = !(await shown()); R.defLog = await p.evaluate(() => __T.G.log.slice(-3).map(l => l.msg).join(' | '));
    R.defSaved = await p.evaluate(k => { const d = JSON.parse(localStorage.getItem(k)); return d.lt.name && d.lt.nameDone; }, KEY);
    await p.reload(); await ready(); await sleep(2500); R.notAgain = !(await shown());
    // ---- 2. sanitising on entry: unicode letters kept, markup / digits / symbols dropped, spaces collapsed, 20 max ----
    R.clean = await p.evaluate(async () => { const N = await import('/js/ltname.js'); return [N.cleanName("O'<b>Brien</b>"), N.cleanName('  Zoë   Ndlovu–Kuti '), N.cleanName('李 小龍'), N.cleanName('<img src=x onerror=alert(1)>Data7!'), N.cleanName('abcdefghijklmnopqrstuvwxyz'), N.cleanName('’Sisko’'), N.cleanName('---')]; });
    R.marks = await p.evaluate(async () => { const N = await import('/js/ltname.js'), M = /\p{M}/u, run = t => Math.max(0, ...(t.match(/\p{M}+/gu) || []).map(x => [...x].length));
      const zal = N.cleanName('Z\u0300\u0301\u0302\u0303\u0304\u0305a\u0306\u0307\u0308\u0309lgo'), lead = N.cleanName('\u0301\u0302 Ann'), two = N.cleanName('Nguye\u0302\u0303n'), hin = N.cleanName('\u0928\u092e\u0938\u094d\u0924\u0947');
      return { zal, zalMax: run(zal), zalBase: zal.normalize('NFD').replace(/\p{M}/gu, ''), lead, two, twoKeep: two === 'Nguye\u0302\u0303n'.normalize('NFC'), hin, hinKeep: hin === '\u0928\u092e\u0938\u094d\u0924\u0947', noLeadMark: !M.test(lead[0] || '') }; });
    // ---- 3. an older save (no name): asked once on the next load, held while an alert, a sheet or a story is open ----
    await p.evaluate(k => { const d = JSON.parse(localStorage.getItem(k)); delete d.lt.name; delete d.lt.nameDone; localStorage.setItem(k, JSON.stringify(d)); window.__noSave = true; }, KEY);
    await p.addInitScript(() => { if (!sessionStorage.getItem('nc.hold')) { window.__TENACITY_SKIP_NAME = true; sessionStorage.setItem('nc.hold', '1'); } });
    await p.reload(); await ready();
    R.oldDue = await p.evaluate(() => __T.G.lt.nameDone === false && __T.G.lt.name.last === '');
    const hold = async (setup, undo) => { await p.evaluate(setup); await sleep(700); const s = await shown(); await p.evaluate(undo); return s; };
    await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); __T.PACE_RT.sessionT = 1e6; });
    R.gates = {};
    R.gates.alert = await hold(() => { const G = __T.G; G.sp.alert = { kind: 'enroute', enemies: ['galor'], allies: [], wing: false, mission: 'none', away: 0, soft: false, t: 0, at: G.ship.elapsed }; window.__TENACITY_SKIP_NAME = false; }, () => {});
    R.gates.sheet = await hold(() => { document.body.classList.add('sheet-open'); __T.G.sp.alert = null; __T.G.sp.battle = null; }, () => {});   // each step swaps one hold for the next in one go
    R.gates.story = await hold(() => { __T.G.ST_ok = __T.ST.startStory('first_watch', { where: 'debug' }); document.body.classList.remove('sheet-open'); document.querySelectorAll('.modal').forEach(m => { if (m.id !== 'storyScene') m.hidden = true; }); }, () => { __T.G.ST_still = __T.ST.storyOpen(); __T.ST.closeStory(); });
    R.storyWasOpen = await p.evaluate(() => { const v = [!!__T.G.ST_ok, __T.G.ST_still]; delete __T.G.ST_ok; delete __T.G.ST_still; return v; });
    await sleep(900); R.oldShown = await shown(); R.oldModals = await modals();
    if (!R.oldShown) console.log('DIAG', J(R.gates), J(await p.evaluate(async () => ({ due: (await import('/js/ltname.js')).nameDue(), skip: window.__TENACITY_SKIP_NAME, st: __T.PACE_RT.sessionT, alert: !!__T.G.sp.alert, battle: !!__T.G.sp.battle, sheet: document.body.className, story: __T.ST.storyOpen(), modals: [...document.querySelectorAll('.modal')].filter(m => !m.hidden).map(m => m.id) }))));
    await p.fill('#namePanel input[name="last"]', "O'Brien"); await p.click('#namePanel [data-name="ok"]'); await sleep(200);
    R.oldName = await name(); await sleep(1500); R.oldOnce = !(await shown());
    // ---- 4. rename from the Personal Log (the same form); cancel keeps the name ----
    R.rename = await p.evaluate(async () => { const HUD = await import('/js/ui/hud.js'); document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); HUD.openPlog(); const o = {};
      const b = () => document.querySelector('#plogBody'); o.row = !!b().querySelector('[data-pl="rename"]'); o.rowTxt = (b().querySelector('[data-pl="rename"]') || {}).textContent;
      b().querySelector('[data-pl="rename"]').click(); o.form = !!b().querySelector('form.nameform'); o.prefill = b().querySelector('input[name="last"]').value;
      b().querySelector('input[name="first"]').value = 'Miles'; b().querySelector('input[name="last"]').value = "O'Brien-Keiko"; b().querySelector('[data-name="cancel"]').click(); o.afterCancel = { ...__T.G.lt.name }; o.backToIndex = !!b().querySelector('[data-pl="rename"]');
      b().querySelector('[data-pl="rename"]').click(); b().querySelector('input[name="first"]').value = '  Miles '; b().querySelector('input[name="last"]').value = "O'Brien"; b().querySelector('form.nameform').requestSubmit();
      o.after = { ...__T.G.lt.name }; o.log = __T.G.log.slice(-1)[0].msg; o.index = !!b().querySelector('[data-pl="rename"]'); document.querySelector('#plogPanel').hidden = true; return o; });
    // ---- 5. a hand-edited save with markup: sanitised on load; and a name forced past the sanitiser renders as text ----
    await p.evaluate(k => { window.__noSave = true; const d = JSON.parse(localStorage.getItem(k)); d.lt.name = { first: '<img src=x onerror="window.__pwn=1">', last: "O'<b>Brien</b>" }; d.lt.nameDone = true; localStorage.setItem(k, JSON.stringify(d)); }, KEY);
    await p.reload(); await ready(); await sleep(400);
    R.evil = await p.evaluate(async () => { const HUD = await import('/js/ui/hud.js'), T = __T, G = T.G, o = { loaded: { ...G.lt.name } }; window.__noSave = true;
      document.querySelectorAll('.modal').forEach(m => { m.hidden = true; });
      G.lt.name = { first: '<i id="pwnI">x</i>', last: '<b id="pwnB">Brien</b>' };   // forced past the sanitiser: every render path must escape it
      HUD.openPlog(); const pl = document.querySelector('#plogBody'); o.plogEsc = !pl.querySelector('#pwnB, #pwnI') && /<b id="pwnB">Brien<\/b>/.test(pl.textContent);
      pl.querySelector('[data-pl="rename"]').click(); o.formEsc = !pl.querySelector('#pwnB, #pwnI') && pl.querySelector('input[name="last"]').value === '<b id="pwnB">Brien</b>';
      document.querySelector('#plogPanel').hidden = true;
      HUD.showBackOnWatch(8 * 3600); await new Promise(z => setTimeout(z, 300)); const wb = document.querySelector('#wbCard'), bl = wb.querySelector('.bowLine'); o.reportEsc = !wb.hidden && !wb.querySelector('#pwnB, #pwnI') && /BACK ON WATCH/.test(wb.textContent);
      o.welcomeEsc = !!bl && !bl.querySelector('#pwnB') && /<b id="pwnB">Brien<\/b>/.test(bl.textContent);
      o.anyInjected = !!document.querySelector('#pwnB, #pwnI') || window.__pwn === 1; wb.hidden = true;
      G.lt.name = { first: 'Miles', last: "O'Brien" }; return o; });
    // ---- 6. the name in use: Shift Report, welcome back, crew lines (~1 in 3, never two in a row) ----
    R.use = await p.evaluate(async () => { const HUD = await import('/js/ui/hud.js'), N = await import('/js/ltname.js'), OJ = await import('/js/oddjobs.js'), T = __T, G = T.G, o = {};
      document.querySelectorAll('.modal').forEach(m => { m.hidden = true; });
      HUD.showBackOnWatch(8 * 3600); await new Promise(z => setTimeout(z, 300)); o.report = (document.querySelector('#wbCard .bowLine') || {}).textContent;
      N._resetAddr(); const seq = Array.from({ length: 9 }, () => N.ltAddr()); o.seq = seq; o.named = seq.filter(x => /O'Brien/.test(x)).length; o.never2 = !seq.some((x, i) => i && /O'Brien/.test(x) && /O'Brien/.test(seq[i - 1]));
      const lines = []; for (let i = 0; i < 6; i++) { const j = OJ.J(); j.active = null; j.next = 0; G.ship.faults = {}; G.sp.ev.active = null; G.lt.lift = null; T.PACE_RT.sessionT = 1e6; const n0 = G.log.length; OJ.tickJobs(0.01); if (j.active) lines.push(...G.log.slice(n0).map(l => l.msg).filter(m => /minute/.test(m))); j.active = null; }
      o.jobLines = lines; o.jobDiag = lines.length ? null : G.log.slice(-3).map(l => l.msg); o.jobNamed = lines.filter(x => /Lieutenant O'Brien/.test(x)).length;
      return o; });
    if (w === 390 && SHOTS) await p.screenshot({ path: OUT + 'name-in-use-390x844.png' });
    R.welcome = await p.evaluate(async () => { const T = __T, G = T.G; const HUD = await import('/js/ui/hud.js'); document.querySelector('#wbCard').hidden = true; T.PACE_RT.idleT = 0; HUD.showBackOnWatch(3 * 3600); await new Promise(z => setTimeout(z, 300)); const t = document.querySelector('#wbCard').textContent; document.querySelector('#wbCard').hidden = true; return t; });
    await c.close();
    // ---- asserts ----
    ok(R.newShown && J(R.newModals) === '["namePanel"]' && R.newFit.inView && R.newFit.minH >= 44, `${tag} new game: the name entry shows alone and fits ` + J([R.newModals, R.newFit]));
    ok(/The crew will call you Lieutenant Pi card \(Jean-Luc Pi card on your service record\)\./.test(R.preview), `${tag} live preview ` + J(R.preview));
    ok(R.def.last === 'Marlowe' && R.def.first === '' && R.def.done === true && R.defHidden && R.defSaved && /Service record: Lieutenant \(junior grade\) Marlowe/.test(R.defLog), `${tag} blank -> default Marlowe ` + J([R.def, R.defLog]));
    ok(R.notAgain, `${tag} not asked again after a reload`);
    ok(R.marks.zalMax <= 2 && R.marks.zalBase === 'Zalgo' && R.marks.lead === 'Ann' && R.marks.noLeadMark && R.marks.twoKeep && R.marks.hinKeep, `${tag} max 2 combining marks per letter ` + J(R.marks));
    ok(J(R.clean) === J(["O'Brien", 'Zoë Ndlovu-Kuti', '李 小龍', 'Data', 'abcdefghijklmnopqrst', 'Sisko', '']), `${tag} sanitiser ` + J(R.clean));
    ok(R.oldDue && R.storyWasOpen[0] && R.storyWasOpen[1] && R.gates.alert === false && R.gates.sheet === false && R.gates.story === false && R.oldShown && J(R.oldModals) === '["namePanel"]', `${tag} older save: held by alert / sheet / story, then shown alone ` + J([R.oldDue, R.storyWasOpen, R.gates, R.oldShown, R.oldModals]));
    ok(R.oldName.last === "O'Brien" && R.oldName.done && R.oldOnce, `${tag} older save: named once ` + J(R.oldName));
    const RN = R.rename; ok(RN.row && /Marlowe|O'Brien/.test(RN.rowTxt) && RN.form && RN.prefill === "O'Brien" && RN.afterCancel.last === "O'Brien" && RN.afterCancel.first === '' && RN.backToIndex && RN.after.first === 'Miles' && RN.after.last === "O'Brien" && /Service record updated: .* Miles O'Brien\./.test(RN.log) && RN.index, `${tag} rename (same form, cancel) ` + J(RN));
    const E = R.evil; ok(E.loaded.first === '' && E.loaded.last === "O'Brien", `${tag} hand-edited save sanitised on load ` + J(E.loaded));
    ok(E.plogEsc && E.formEsc && E.reportEsc && E.welcomeEsc && !E.anyInjected, `${tag} a forced markup name renders as text ` + J(E));
    const U = R.use; ok(/Lieutenant O'Brien/.test(U.report || ''), `${tag} BACK ON WATCH crew line names the Lt ` + J(U.report));
    ok(U.named === 3 && U.never2, `${tag} crew address: 3 of 9 named, never two in a row ` + J(U.seq));
    ok(U.jobLines.length >= 3 && U.jobNamed >= 1 && U.jobNamed < U.jobLines.length, `${tag} odd-job crew lines use the name sometimes ` + J(U.jobLines));
    ok(/Lieutenant O'Brien/.test(R.welcome), `${tag} welcome back names the Lt ` + J(R.welcome));
  }
  await br.close();
  if (errs.length) fails.push('console errors: ' + J(errs.slice(0, 8)));
  if (net.length) fails.push('failed requests: ' + J(net.slice(0, 8)));
  if (fails.length) { console.log('FAIL\n' + fails.join('\n')); process.exit(1); }
  console.log('PASS · name-check · 3 sizes · 0 console errors · 0 failed requests');
})().catch(e => { console.error(e); process.exit(1); });
