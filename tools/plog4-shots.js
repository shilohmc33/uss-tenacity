// Personal Log phase 4 (romance): opt-in, the signal, accept / stay-friends choice, friends-only toggle, a date with the fade,
// the disclosure, the letter thread after a transfer, the partner memorial (a real death: present-only + the surgery roll), the quiet-period gate + pronouns; anti-farm checks (readiness + transfer Fleet Rep)
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
      const g0 = P.gifts.giftOp.vardock; P.gifts.giftOp.vardock = 30; P.opinions.vardock = 97; const c97 = PR.socialCredit('vardock'); P.opinions.vardock = 50; const c50 = PR.socialCredit('vardock'); P.gifts.giftOp.vardock = g0;   // da943e7 finding: gift-made opinion above +50
      o.giftCase = { c97, c50 }; o.readyCapped = r90 === r50 && c97 === c50; o.cap = PR.romanceCap('vardock', 90);
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
    // after pass 07-09: the quiet-period gate covers romance; pronouns in dates / letters / the journal; and a partner's injury goes
    // through the normal rules - a pinned partner is evacuated (-> letters), an unpinned one can die, but only while the player is
    // present and only through the surgery roll (the real injure -> fix -> surgery -> outcome path, no constructed memorial)
    S.integ = await ev(async () => {
      const G = __T.G, P = G.prog, PR = await import('/js/progression.js'), PA = await import('/js/pacing.js'), SIM = await import('/js/sim.js'), BUS = await import('/js/bus.js'), MD = __T.MD, RM = __T.RM, o = {};
      __T.app.paused = true; P.romance.thread.ended = true; P.romance.signal = null; RM.setFriendsOnly('rhovan', false);
      const braces = t => /[{}]/.test(t);
      const pool = PR.crewList().filter(c => !c.senior && !c.protected && RM.eligible(c.id) && P.crew.occ[c.id] && !['kovac', 'rhovan', 'vardock', 'mollo', 'grevv'].includes(c.id) && c.id !== P.crew.slots.doctor);
      const A = pool[0].id, byPr = pr => (pool.find(c => c.pronoun === pr) || {}).id; o.A = A;
      P.opinions[A] = 60; P.opinions.rhovan = 60; P.rations = 9999;
      // quiet period (pass 06 m1 / pass 09 (4)): no signal, the yes and the evening are sober
      P.med.hushUntil = G.ship.elapsed + 600; P.romance.lastSignal = -99;
      o.hushNoSignal = !RM.forceSignal(A) && !RM.canSignal(A);
      P.med.hushUntil = 0; RM.forceSignal(A); P.med.hushUntil = G.ship.elapsed + 600;   // asked before the loss, answered in the quiet period
      const n0 = G.log.length, ya = RM.answerSignal(true);
      o.hushYes = { line: ya.line, sober: /quieter/.test(ya.line) && !G.log.slice(n0).some(e => /briefly, delighted/.test(e.msg)) && __T.PL.journalOf(A).some(e => /Not the week/.test(e.text)) };
      P.day += 2; const dq = RM.goOnDate(A, 'dinner');
      { const lm = G.log.slice(-1)[0].msg;   // pass 11: no fade in the quiet period (HOLD 2), and the log line isn't doubled (m3)
        // pass 12 m5: the ship-log line is one of the sober variants, never the same twice running (5 more quiet evenings)
        const SOB = /quiet evening|keeps you company for an hour after shift|^An early night\./, seq = [lm]; for (let k = 0; k < 5; k++) { P.day += 2; G.prog.romance.bond[A].last = -99; RM.goOnDate(A, 'dinner'); seq.push(G.log.slice(-1)[0].msg); }
        const noRepeat = seq.every((m, k) => k === 0 || m !== seq[k - 1]), allSober = seq.every(m => SOB.test(m) && !/delighted|dessert|hasperat|lakeside/.test(m));
        o.hushDate = { lines: dq.lines, fade: dq.fade, log: lm, seq, noRepeat, allSober, sober: dq.ok && /quiet evening/.test(dq.lines[0]) && dq.fade === null && allSober && noRepeat && !/A quiet evening with \w+\. It's a quiet evening/.test(lm) }; }
      P.med.hushUntil = 0;
      // pronouns: one crewmate of each pronoun aboard, the sober evening line ({sub} just sit{s} with you)
      const fills = [], keepBond = JSON.parse(JSON.stringify(P.romance.bond)); const ids = { they: byPr('they'), she: byPr('she'), he: byPr('he') }; o.prIds = ids; for (const id of Object.values(ids).filter(Boolean)) { P.romance.partner = id; P.romance.bond[id] = { stage: 'courting', since: P.day, dates: 2, last: -99, courtAt: P.day, disclosed: null };
        for (let k = 0; k < 6; k++) { P.romance.bond[id].last = -99; P.med.hushUntil = k % 2 ? G.ship.elapsed + 600 : 0; const r = RM.goOnDate(id, 'dinner'); if (r.ok) fills.push(id + ': ' + r.lines.join(' ') + ' ' + r.fade); } } P.romance.bond = keepBond;
      P.med.hushUntil = 0; P.romance.partner = A;
      o.pron = { theySit: !ids.they || fills.some(t => t.startsWith(ids.they + ':') && /they just sit with you/.test(t)), sheSits: !ids.she || fills.some(t => t.startsWith(ids.she + ':') && /she just sits with you/.test(t)), heSits: !ids.he || fills.some(t => t.startsWith(ids.he + ':') && /he just sits with you/.test(t)), sample: fills.filter((t, k) => k % 2 === 1).slice(0, 3), braces: fills.filter(braces).length, n: fills.length };
      // a pinned partner (protected favourite): a grave surgery becomes an evacuation -> the romance becomes letters
      const K = PR.PROG.deaths, sg = { ...K.surgery }; Object.assign(K.surgery, { chance: 1, max: 1, fastMult: 1, excellentMult: 1, visitMult: 1, assistMult: 1, scene: 3 });
      const reset = () => { P.med.inj = []; P.med.scene = null; P.med.day = { pd: -1, n: 0 }; P.crew.rolls.hist = []; P.med.lastDeathPD = null; P.med.lastDeathPT = null; };
      P.playDays = Math.max(P.playDays, 30); P.presentTotal = 1e6; P.med.asked = true; MD.setGentle(false); o.deathsOn = K.enabled; reset();
      P.med.pins = [A]; const fixIt = i => { i.ack = true; i.fixBy = 'lt'; delete G.ship.faults[i.sys]; };
      let i = MD.injure('hazard', { id: A, sev: 'serious' }); PA.playerInput(); for (let t = 0; t < 25; t++) { PA.playerInput(); SIM.stepSim(0.1); } fixIt(i); for (let t = 0; t < 80; t++) { PA.playerInput(); SIM.stepSim(0.1); }
      o.pinnedEvac = { aboard: !!P.crew.occ[A], stage: (P.romance.bond[A] || {}).stage, thread: !!(RM.thread() && RM.thread().id === A && !RM.thread().ended), mem: P.med.memorial.some(m => m.id === A) };
      P.romance.thread.ended = true; P.med.pins = []; reset();
      // an unpinned partner: Rhovan, 3 evenings
      // pass 11 m1: an evening writes a journal line only on the 1st, a stage change and every 5th (varied; date_quiet in the quiet period)
      P.romance.lastSignal = -99; RM.forceSignal('rhovan'); RM.answerSignal(true);
      { const dj = () => P.plog.journal.filter(e => e.id === 'rhovan' && e.k === 'date'), log = [];
        for (let k = 0; k < 11; k++) { const quietK = k >= 3 && k < 6; P.med.hushUntil = quietK ? G.ship.elapsed + 600 : 0; const n0 = dj().length, st0 = P.romance.bond.rhovan.stage; P.day += 2; const r = RM.goOnDate('rhovan', 'dinner'); const b = P.romance.bond.rhovan;
          const want = b.dates === 1 || st0 !== b.stage || b.dates % PR.PROG.romance.journalEvery === 0, got = dj().length - n0; log.push({ d: b.dates, want, got, x: got ? dj().slice(-1)[0].x : null, quiet: quietK, ok: r.ok }); }
        P.med.hushUntil = 0; const texts = __T.PL.journalOf('rhovan', 99).filter(e => /dinner|Dinner|quiet evening|sat with me|in silence|dessert/.test(e.text)).map(e => e.text);
        o.dateVariety = { log: log.map(l => `${l.d}:${l.want ? 'W' : '-'}${l.got}${l.x ? l.x[0] : ''}`).join(' '), lines: log.filter(l => l.got).length, texts,
          ok: log.every(l => l.ok && (l.want ? l.got === 1 : l.got === 0) && (!l.got || (l.quiet ? l.x === 'quiet' : l.x === 'dinner'))) && log.filter(l => l.got).length <= 5 && !texts.some(t => /[{}]/.test(t)) }; }
      o.notAutoFav = !MD.favourites().includes('rhovan') && P.opinions.rhovan >= Math.max(...PR.crewList().filter(c => !c.senior && !c.protected && c.id !== 'rhovan').map(c => PR.opinionOf(c.id)));
      i = MD.injure('hazard', { id: 'rhovan', sev: 'serious', what: 'a plasma burn' }); PA.playerInput(); for (let t = 0; t < 25; t++) { PA.playerInput(); SIM.stepSim(0.1); }
      // away: the window and the surgery wait; the crew's fix while hidden is held, never resolved
      PA.PACE_RT.hidden = true; i.ack = true; o.awayWhy = MD.deathCheck('rhovan', 'hazard', i).why; delete G.ship.faults[i.sys];
      for (let t = 0; t < 3000; t++) SIM.stepSim(0.1);
      o.away = { alive: !!P.crew.occ.rhovan, state: i.state, held: !!i.held, partner: P.romance.partner };
      // back: the surgery roll runs while the player watches (forced to lose here)
      PA.PACE_RT.hidden = false; for (let t = 0; t < 120; t++) { PA.playerInput(); SIM.stepSim(0.1); }
      const mem = P.med.memorial.slice(-1)[0] || {};
      o.died = { gone: !P.crew.occ.rhovan, how: (P.med.audit || []).slice(-1)[0] ? (P.med.audit.slice(-1)[0].how) : (mem.how || null), partnerMem: mem.id === 'rhovan' && mem.partner === true, stage: P.romance.bond.rhovan.stage, grief: !!P.romance.grief, present: (P.med.audit || []).slice(-1)[0] ? P.med.audit.slice(-1)[0].present : null, scene: (MD.sceneOf() || {}).phase };
      o.griefNoSignal = !RM.canSignal('diallo') && !RM.forceSignal('mollo'); o.hushedAfter = !BUS.cheerful();
      Object.assign(K.surgery, sg); P.med.scene = null; __T.app.paused = false; window.__noSave = true;
      return o;
    });
    if (process.env.PLOG4_DEBUG) console.log(tag, JSON.stringify(S.integ));
    await ev(() => { const b = document.querySelector('#medPanel [data-med=close]'); if (b) b.click(); const m = document.querySelector('#medPanel'); if (m) m.hidden = true; }); await sleep(300);
    await ev(() => { if (document.querySelector('#plogPanel').hidden) document.querySelector('[data-plog-open]').click(); }); await sleep(250);
    await p.click('#plogBody [data-pl="index"]'); await sleep(200);
    S.memRow = await ev(() => /your partner/.test(document.querySelector('#plogBody').innerText));
    await p.click('#plogBody .plrow.lost[data-pl="rhovan"]'); await sleep(250);
    S.memorial = await ev(() => { const t = document.querySelector('#plogBody').innerText, R = __T.G.prog.romance; return { heavy: /Personal log, supplemental/.test(t), entry: /We lost Rhovan/.test(t), stage: R.bond.rhovan.stage, grief: !!R.grief, noSignal: !__T.RM.canSignal('diallo') }; });
    await tapCheck('memorial', '#plogPanel button'); await p.screenshot({ path: OUT + `plog4-memorial${suffix}.png` });
    await ctx.close();
  }
  await b.close();
  const U = u => u.offByDefault && u.excluded && u.decline && u.neverAgain && u.fo && u.natural && u.readyCapped && u.cap === 50 && u.authority && u.fleetCapped && u.letters;
  const I = x => x && x.deathsOn && x.hushNoSignal && x.hushYes.sober && x.hushDate.sober && x.pron.theySit && x.pron.sheSits && x.pron.heSits && !x.pron.braces
    && x.pinnedEvac.stage === 'letters' && x.pinnedEvac.thread && !x.pinnedEvac.aboard && !x.pinnedEvac.mem && x.notAutoFav && x.awayWhy === 'not present'
    && x.away.alive && x.away.state === 'surgery' && x.away.held && x.away.partner === 'rhovan' && x.died.gone && x.died.how === 'surgery' && x.died.partnerMem && x.died.stage === 'lost' && x.died.grief && x.died.present !== false && x.griefNoSignal && x.hushedAfter && x.dateVariety.ok;
  R.ok = Object.values(R.sizes).every(s => !s.errors.length && !s.small.length && U(s.unit) && s.optCard && s.optOn && s.signal.row && s.signal.chip && s.choice.open && s.choice.yes && s.choice.no && s.accepted && s.fo
    && s.date.open && s.date.fade && s.date.stage === 'together' && s.date.up && s.disc.open && s.disc.kind === 'outrank' && s.disc.text && s.filed && s.letterRow && s.letters.n >= 3 && s.letters.reply && s.letters.end
    && I(s.integ) && s.memRow && s.memorial.heavy && s.memorial.entry && s.memorial.stage === 'lost' && s.memorial.grief && s.memorial.noSignal);
  fs.writeFileSync(OUT + 'plog4-report.json', JSON.stringify(R, null, 1));
  console.log(JSON.stringify(R, null, 1)); console.log(R.ok ? 'PLOG4 PASS' : 'PLOG4 FAIL'); process.exit(R.ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
