// Personal Log phase 4 (romance): opt-in, the signal, accept / stay-friends choice, friends-only toggle, a date with the fade,
// the disclosure, the letter thread after a transfer, the partner memorial; anti-farm checks (readiness + transfer Fleet Rep)
// at 390x844 / 844x390 / 1280x800 -> shots/plog4-*.png + shots/plog4-report.json
// NODE_PATH=/workspace/pwtools/node_modules node tools/plog4-shots.js [base]
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
    const tapCheck = async (name, sel) => { const small = await p.evaluate(sel => [...document.querySelectorAll(sel)].filter(x => x.offsetParent).map(x => { const r = x.getBoundingClientRect(); return { t: x.innerText.trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(r => r.w < 44 || r.h < 44), sel); for (const s of small) S.small.push(`${name}: ${s.t} ${s.w}x${s.h}`); };
    const ev = (f, a) => p.evaluate(f, a);
    // logic checks (no UI): opt-in default, decline costs nothing, friends only, excluded crew, anti-farm
    S.unit = await ev(async () => {
      window.__noSave = true; const G = __T.G, P = G.prog, PR = await import('/js/progression.js'), RM = __T.RM, o = {};
      G.sp.cap.decideT = 1e9; G.ship.nextFault = 1e9; G.sp.ev.nextT = -1; P.day = 20; P.rank = 1; P.rations = 600;
      o.offByDefault = P.romance.opt === null && !RM.canSignal('kovac');
      RM.setOpt(true);
      for (const c of PR.crewList()) P.opinions[c.id] = 55;
      o.excluded = !RM.forceSignal('tren') && !RM.forceSignal('okafor');
      const op0 = P.opinions.rhovan; RM.forceSignal('rhovan'); const d = RM.answerSignal(false);
      o.decline = d && !d.yes && P.opinions.rhovan === op0 && !RM.canSignal('rhovan');
      for (let i = 0; i < 30; i++) PR.hooks.social.forEach(f => f('rhovan')); o.neverAgain = !RM.pendingSignal();
      RM.setFriendsOnly('grevv', true); o.fo = !RM.forceSignal('grevv') && !RM.canSignal('grevv'); RM.setFriendsOnly('grevv', false);
      // natural signal path: moments + chats
      P.romance.lastSignal = -99; P.romance.moments.mollo = { n: 0, last: -1 };
      for (let d2 = 0; d2 < 3; d2++) { P.day++; PR.hooks.social.forEach(f => f('mollo')); }
      let tries = 0; while (!RM.pendingSignal() && tries++ < 60) PR.hooks.social.forEach(f => f('mollo'));
      o.natural = !!RM.pendingSignal() && RM.pendingSignal().id === 'mollo'; RM.answerSignal(false);
      // anti-farm: a partner at +90 counts like +50 in readiness and in transfer Fleet Rep, and 0 under station authority
      P.romance.lastSignal = -99; RM.forceSignal('vardock'); RM.answerSignal(true);
      P.opinions.vardock = 90; const r90 = PR.computeReadiness(), s90 = P.readyParts.social; P.opinions.vardock = 50; const r50 = PR.computeReadiness();
      o.readyCapped = r90 === r50; o.cap = PR.romanceCap('vardock', 90);
      P.rank = 2; o.authority = PR.romanceCap('vardock', 90) === 0; P.rank = 1;
      P.opinions.vardock = 90; const fr0 = P.fleetRep; __T.CL.transferOff('vardock', null, 'roll'); o.fleetCapped = P.fleetRep - fr0 <= Math.floor(PR.PROG.romance.friendCap / PR.PROG.fleet.perOpinion);
      o.letters = !!RM.thread() && RM.thread().id === 'vardock'; P.romance.thread.ended = true; P.romance.signal = null;
      return o;
    });
    // showcase: fresh romance state, opt-in card, then Kovac signals
    await ev(async () => { const G = __T.G, P = G.prog, PR = await import('/js/progression.js'); P.romance = PR.freshRomance(); P.day = 24; P.rank = 1; P.rations = 600; for (const c of PR.crewList()) P.opinions[c.id] = { kovac: 58, rhovan: 52, diallo: 40 }[c.id] ?? 20; });
    if (w < 900) await ev(() => document.querySelector('#btnFull') && document.querySelector('#btnFull').click());
    await sleep(300);
    await ev(() => { const sb = document.querySelector('.sheetBtns [data-sheet="crew"]'); if (sb && sb.offsetParent) sb.click(); }); await sleep(400);
    await p.click('[data-plog-open]'); await sleep(250);
    S.optCard = await ev(() => !!document.querySelector('.romask'));
    await tapCheck('optin', '#plogPanel button'); await p.screenshot({ path: OUT + `plog4-optin${suffix}.png` });
    await p.click('[data-rm="opt"][data-rm-k="1"]'); await sleep(200);
    S.optOn = await ev(() => __T.G.prog.romance.opt === true && /Romantic storylines: ON/.test(document.querySelector('#plogBody').innerText));
    await ev(() => { __T.RM.forceSignal('kovac'); document.querySelector('#plogPanel').hidden = true; }); await sleep(600);
    await ev(() => { document.querySelector('[data-plog-open]').click(); }); await sleep(300);
    S.signal = await ev(() => ({ row: !!document.querySelector('.plrow.romr[data-rm="signal"]'), chip: !!document.querySelector('[data-rom-open]') }));
    await tapCheck('signal', '#plogPanel button'); await p.screenshot({ path: OUT + `plog4-signal${suffix}.png` });
    await p.click('.plrow.romr[data-rm="signal"]'); await sleep(250);
    S.choice = await ev(() => ({ open: !document.querySelector('#romPanel').hidden, yes: !!document.querySelector('[data-rom="yes"]'), no: /stay friends/.test(document.querySelector('#romBody').innerText) }));
    await tapCheck('choice', '#romPanel button'); await p.screenshot({ path: OUT + `plog4-choice${suffix}.png` });
    await p.click('[data-rom="yes"]'); await sleep(200);
    S.accepted = await ev(() => __T.G.prog.romance.partner === 'kovac' && __T.G.prog.romance.bond.kovac.stage === 'interested');
    await p.click('[data-rom="close"]'); await sleep(150);
    // friends-only toggle on Rhovan's page
    await ev(() => document.querySelector('#plogBody [data-pl="index"]') && document.querySelector('#plogBody [data-pl="index"]').click()); await sleep(150);
    await p.click('#plogBody [data-pl="rhovan"]'); await sleep(200); await p.click('[data-rm="fo"][data-rm-id="rhovan"]'); await sleep(200);
    S.fo = await ev(() => __T.G.prog.romance.fo.rhovan === true && !!document.querySelector('button.fo.on') && /Friends only/.test(document.querySelector('#plogBody').innerText));
    await tapCheck('fo', '#plogPanel button'); await p.screenshot({ path: OUT + `plog4-friends-only${suffix}.png` });
    // dates: two to Courting, then three more over 5 days to Together; the shot is the 5th (Together) with the fade
    await ev(() => { const P = __T.G.prog; for (let i = 0; i < 4; i++) { P.day += 2; __T.RM.goOnDate('kovac', 'dinner'); } P.day += 2; });
    await p.click('#plogBody [data-pl="index"]'); await sleep(150); await p.click('#plogBody [data-pl="kovac"]'); await sleep(200);
    await p.click('[data-rm="date"][data-rm-k="dinner"]'); await sleep(2700);
    S.date = await ev(() => ({ open: !document.querySelector('#romPanel').hidden, fade: !!document.querySelector('#romBody .fade') && /door slides shut/.test(document.querySelector('#romBody .fade').innerText), stage: __T.G.prog.romance.bond.kovac.stage, up: /together now/.test(document.querySelector('#romBody').innerText) }));
    await tapCheck('date', '#romPanel button'); await p.screenshot({ path: OUT + `plog4-date${suffix}.png` });
    await p.click('[data-rom="close"]'); await sleep(150);
    // promotion to Lt Cmdr: the disclosure pops up by itself
    await ev(async () => { const P = __T.G.prog, PR = await import('/js/progression.js'); P.rank = 2; PR.hooks.newDay.forEach(f => f(P.day)); document.querySelector('#plogPanel').hidden = true; }); await sleep(900);
    S.disc = await ev(() => ({ open: !document.querySelector('#romPanel').hidden, kind: (__T.RM.pendingDisc() || {}).kind, text: /Okafor/.test(document.querySelector('#romBody').innerText) }));
    await tapCheck('disc', '#romPanel button'); await p.screenshot({ path: OUT + `plog4-disclosure${suffix}.png` });
    await p.click('[data-rom="file"]'); await sleep(150);
    S.filed = await ev(async () => { const PR = await import('/js/progression.js'); return __T.G.prog.romance.bond.kovac.disclosed === 'outrank' && PR.romanceCap('kovac', 80) === 0; });
    await p.click('[data-rom="close"]'); await sleep(150);
    // transfer -> letters
    await ev(async () => { const P = __T.G.prog, PR = await import('/js/progression.js'); __T.CL.transferOff('kovac', 'sb375', 'roll'); P.playDays += 1; P.day++; PR.hooks.newDay.forEach(f => f(P.day)); __T.RM.replyLetter('warm'); P.playDays += 3; P.day++; PR.hooks.newDay.forEach(f => f(P.day)); });
    await ev(() => document.querySelector('[data-plog-open]').click()); await sleep(250);
    S.letterRow = await ev(() => /A letter from Kovac/.test(document.querySelector('#plogBody').innerText));
    await p.click('#plogBody [data-pl="kovac"]'); await sleep(250);
    S.letters = await ev(() => ({ n: document.querySelectorAll('#plogBody .pll').length, reply: !!document.querySelector('[data-rm="letter"][data-rm-k="warm"]'), end: !!document.querySelector('[data-rm="letter"][data-rm-k="end"]') }));
    await tapCheck('letters', '#plogPanel button'); await p.screenshot({ path: OUT + `plog4-letters${suffix}.png` });
    // the partner memorial: a new partner (Rhovan unmarked), then lost (constructed: the real death path is covered by pt06 / prog6 / the sim)
    await ev(async () => { const P = __T.G.prog, PR = await import('/js/progression.js'), RM = __T.RM; P.romance.thread.ended = true; RM.setFriendsOnly('rhovan', false); P.romance.lastSignal = -99; RM.forceSignal('rhovan'); RM.answerSignal(true);
      for (let i = 0; i < 3; i++) { P.day += 2; RM.goOnDate('rhovan', 'dinner'); }
      const o = P.crew.occ.rhovan; P.med.memorial.push({ partner: P.romance.partner === 'rhovan', id: 'rhovan', name: 'Lt jg Ianna Rhovan', rankLong: 'Lieutenant junior grade', short: o.short, pronoun: o.pronoun, species: 'Betazoid', role: 'Operations', dept: 'ops', day: P.day, pd: P.playDays, sd: '51520.4', cause: 'battle', what: 'a plasma burn', plaque: true });
      delete P.crew.slots[o.slot]; P.crew.slots[o.slot] = null; delete P.crew.occ.rhovan; PR.crewTouch(); __T.CL.crewNote('death', 'rhovan', 'Ianna Rhovan', { cause: 'battle' }); });
    await p.click('#plogBody [data-pl="index"]'); await sleep(200);
    S.memRow = await ev(() => /your partner/.test(document.querySelector('#plogBody').innerText));
    await p.click('#plogBody .plrow.lost[data-pl="rhovan"]'); await sleep(250);
    S.memorial = await ev(() => { const t = document.querySelector('#plogBody').innerText, R = __T.G.prog.romance; return { heavy: /Personal log, supplemental/.test(t), entry: /We lost Rhovan/.test(t), stage: R.bond.rhovan.stage, grief: !!R.grief, noSignal: !__T.RM.canSignal('diallo') }; });
    await tapCheck('memorial', '#plogPanel button'); await p.screenshot({ path: OUT + `plog4-memorial${suffix}.png` });
    await ctx.close();
  }
  await b.close();
  const U = u => u.offByDefault && u.excluded && u.decline && u.neverAgain && u.fo && u.natural && u.readyCapped && u.cap === 50 && u.authority && u.fleetCapped && u.letters;
  R.ok = Object.values(R.sizes).every(s => !s.errors.length && !s.small.length && U(s.unit) && s.optCard && s.optOn && s.signal.row && s.signal.chip && s.choice.open && s.choice.yes && s.choice.no && s.accepted && s.fo
    && s.date.open && s.date.fade && s.date.stage === 'together' && s.date.up && s.disc.open && s.disc.kind === 'outrank' && s.disc.text && s.filed && s.letterRow && s.letters.n >= 3 && s.letters.reply && s.letters.end
    && s.memRow && s.memorial.heavy && s.memorial.entry && s.memorial.stage === 'lost' && s.memorial.grief && s.memorial.noSignal);
  fs.writeFileSync(OUT + 'plog4-report.json', JSON.stringify(R, null, 1));
  console.log(JSON.stringify(R, null, 1)); console.log(R.ok ? 'PLOG4 PASS' : 'PLOG4 FAIL'); process.exit(R.ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
