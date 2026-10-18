// Pass 11 checks + shots at 390x844 / 844x390 / 1280x800 (zero console errors):
//   MAJOR dates need a real DS9 dock (warp leaving DS9 / battle at DS9 refuse) -> pt11-date-warp-*
//   DECISION the yes card says the partner is no longer auto-protected -> pt11-yes-note-*
//   PACING the outrank disclosure card normalises it (Okafor) -> pt11-disclosure-*
//   HOLD 1 romance off with a letter thread: index + alumni page show no letters, one lost-touch line -> pt11-optoff-index-*, pt11-optoff-page-*
//   HOLD 2 a quiet-period date: sober lines, no fade -> pt11-quiet-date-*
//   m2/m5 an unpinned partner's real death (surgery roll, present): memorial page without the letters line, no opinion figure -> pt11-memorial-*
//   m1 journal cadence over 20 evenings, m3 sober log, m4 global pause, m6 forged signal, m7 corrupt save, m8 capital letters
// DEATHS=1 BASE=http://127.0.0.1:8765/ node tools/pt11-shots.js -> shots/pt11-*.png + shots/pt11-report.json
const { chromium } = require('playwright-core'); const fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/', OUT = __dirname + '/../shots/', sleep = ms => new Promise(r => setTimeout(r, ms));
const R = { sizes: {} };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [w, h, mobile] of [[390, 844, true], [844, 390, true], [1280, 800, false]]) {
    const tag = `${w}x${h}`, S = R.sizes[tag] = { errors: [] };
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    await ctx.addInitScript(() => { window.__TENACITY_TEST_DEATHS = true; });
    const p = await ctx.newPage();
    p.on('console', m => { if (['error', 'warning'].includes(m.type())) S.errors.push(`console.${m.type()}: ${m.text()}`); });
    p.on('pageerror', e => S.errors.push(`pageerror: ${e.message} @ ${(e.stack || '').split('\n').slice(1, 3).join(' ')}`));
    p.on('response', r => { if (r.status() >= 400) S.errors.push(`HTTP ${r.status()} ${r.url()}`); });
    const ev = (f, a) => p.evaluate(f, a), shot = n => p.screenshot({ path: OUT + `pt11-${n}-${tag}.png` });
    const fresh = async () => { await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(400);
      await ev(async () => { window.__noSave = true; const G = __T.G, P = G.prog; G.sp.cap.decideT = 1e9; G.ship.nextFault = 1e9; if (G.sp.ev) G.sp.ev.nextT = -1; P.day = 20; P.playDays = 20; P.rank = 1; P.rations = 900;
        window.PR = await import('/js/progression.js'); window.HUD = await import('/js/ui/hud.js'); window.BUS = await import('/js/bus.js'); window.PA = await import('/js/pacing.js'); window.SIM = await import('/js/sim.js'); window.__messDeck = (await import('/js/data.js')).NODEMAP.mess.deck; }); };
    const closeAll = () => ev(() => { for (const s of ['#romPanel', '#plogPanel', '#medPanel']) { const e = document.querySelector(s); if (e) e.hidden = true; } });
    // ---- MAJOR + DECISION ----
    await fresh();
    S.dock = await ev(() => { const G = __T.G, P = G.prog, RM = __T.RM; RM.setOpt(true); P.opinions.kovac = 60; P.romance.lastSignal = -99; RM.forceSignal('kovac'); const r = RM.answerSignal(true); window.__yes = r;
      const ok = () => Object.fromEntries(RM.dateOptions('kovac').map(o => [o.k, o.ok])); P.romance.bond.kovac.last = -99; const o = {};
      G.sp.location = 'ds9'; G.sp.travel = null; G.sp.battle = null; o.docked = ok();
      G.sp.travel = { dest: 'convoy', t: 0, dur: 300, from: 'ds9' }; o.warp = ok(); G.sp.travel = null;
      G.sp.battle = { fake: 1 }; o.battle = ok(); G.sp.battle = null;
      G.sp.location = 'convoy'; o.away = ok(); G.sp.location = 'ds9'; G.sp.travel = { dest: 'convoy', t: 0, dur: 300, from: 'ds9' };
      return { ...o, note: r.note, logNote: G.log.slice(-3).some(e => /no longer auto-protected/.test(e.msg)) }; });
    await ev(() => { HUD.openPlog('kovac'); }); await sleep(250); await ev(() => { const s = document.querySelector('#plogPanel .plh'); if (s) s.scrollIntoView(); }); await sleep(150); await shot('date-warp');
    await closeAll(); await ev(() => { __T.G.sp.travel = null; HUD.openRom({ mode: 'signal', res: { yes: true, line: __yes.line, note: __yes.note } }); }); await sleep(250);
    S.yesCard = await ev(() => document.querySelector('#romBody').innerText.includes('no longer auto-protected')); await shot('yes-note'); await closeAll();
    // ---- PACING: the outrank disclosure ----
    S.disc = await ev(() => { const P = __T.G.prog, RM = __T.RM; P.rank = 2; P.rations = 999; for (let i = 0; i < 2; i++) { P.day += 2; RM.goOnDate('kovac', 'dinner'); } PR.hooks.newDay.forEach(f => f(P.day)); return RM.pendingDisc(); });
    await ev(() => HUD.openRom({ mode: 'disc' })); await sleep(250);
    S.discCard = await ev(() => { const t = document.querySelector('#romBody').innerText; return { okafor: /paperwork, not a mark against you/.test(t), normal: /normal path/.test(t) }; }); await shot('disclosure');
    S.discLog = await ev(() => { const r = __T.RM.fileDisclosure(); return !!r && /paperwork, not a mark against you/.test(__T.G.log.slice(-1)[0].msg); }); await closeAll();
    // ---- m1 journal cadence (20 evenings), m3 sober log + HOLD 2 quiet date ----
    S.cadence = await ev(() => { const G = __T.G, P = G.prog, RM = __T.RM; P.rank = 1; const j0 = P.plog.journal.filter(e => e.id === 'kovac' && e.k === 'date').length; let n = 0;
      for (let i = 0; i < 20; i++) { P.day += 2; if (RM.goOnDate('kovac', i % 2 ? 'promenade' : 'dinner').ok) n++; }
      return { evenings: n, journalLines: P.plog.journal.filter(e => e.id === 'kovac' && e.k === 'date').length - j0, dates: P.romance.bond.kovac.dates, stage: P.romance.bond.kovac.stage }; });
    S.quiet = await ev(() => { const G = __T.G, P = G.prog, RM = __T.RM; P.med.hushUntil = G.ship.elapsed + 600; P.day += 2; const r = RM.goOnDate('kovac', 'dinner'); window.__qd = r; const lg = G.log.slice(-1)[0].msg; P.day += 3; for (let i = 0; i < 2; i++) { P.day += 2; RM.goOnDate('kovac', 'dinner'); }
      const jq = __T.PL.journalOf('kovac').map(e => e.text); return { fade: r.fade, lines: r.lines, log: lg, double: /A quiet evening with \w+\. It's a quiet evening/.test(lg), coy: jq.some(t => /not writing the rest down/.test(t)) && false }; });
    await ev(() => HUD.openRom({ mode: 'date', id: 'kovac', r: __qd })); await sleep(250);
    S.quietCard = await ev(() => ({ fadeEl: !!document.querySelector('#romBody .fade'), text: document.querySelector('#romBody').innerText.slice(0, 300) })); await shot('quiet-date');
    await ev(() => { __T.G.prog.med.hushUntil = 0; }); await closeAll();
    // ---- m4 global pause, m6 forged signal ----
    S.m4m6 = await ev(() => { const G = __T.G, P = G.prog, RM = __T.RM; RM.endIt('kovac'); const sid = PR.crewList().find(c => RM.eligible(c.id) && c.id !== 'kovac' && !P.romance.bond[c.id] && !(P.med.inj || []).some(x => x.id === c.id)).id; P.opinions[sid] = 70; const can = []; for (let d = 0; d < 16; d++) { P.romance.moments[sid] = { n: 5, last: -1 }; P.romance.lastSignal = -99; can.push(RM.canSignal(sid) ? 1 : 0); P.day++; }
      P.romance.signal = { id: 'tren', day: P.day, line: 'x' }; const a = RM.answerSignal(true); return { canByDay: can.join(''), forged: a, partner: P.romance.partner }; });
    // ---- HOLD 1: off with a letter thread; m8 capitals ----
    S.optoff = await ev(async () => { const G = __T.G, P = G.prog, RM = __T.RM; P.romance.lastEnd = -99; P.opinions.natarajan = 70; P.romance.lastSignal = -99; RM.forceSignal('natarajan'); RM.answerSignal(true);
      __T.CL.transferOff('natarajan', null, 'roll'); const caps = []; for (let d = 0; d < 9; d++) { P.playDays++; P.day++; PR.hooks.newDay.forEach(f => f(P.day)); if (RM.letterState() && RM.letterState().waiting) RM.replyLetter('light'); }
      caps.push(...P.romance.letters.filter(l => l.from === 'them').map(l => l.t[0])); const n0 = G.log.length; RM.setOpt(false); for (let d = 0; d < 20; d++) { P.playDays++; P.day++; PR.hooks.newDay.forEach(f => f(P.day)); }
      return { letters: P.romance.letters.length, capsOk: caps.every(c => c === c.toUpperCase()), caps: caps.join(''), after: G.log.slice(n0).map(e => e.msg).slice(0, 5) }; });
    await ev(() => HUD.openPlog()); await sleep(250); S.offIndex = await ev(() => !/letter/i.test(document.querySelector('#plogPanel .card').innerText)); await shot('optoff-index');
    await ev(() => HUD.openPlog('natarajan')); await sleep(250); S.offPage = await ev(() => { const t = document.querySelector('#plogPanel .card').innerText; return { noLetters: !/LETTERS|letter from|Write to me/i.test(t), lostTouch: /lost touch/.test(t) }; }); await shot('optoff-page'); await closeAll();
    // ---- m2 / m5: an unpinned partner's real death (present, surgery roll forced to lose), no letters ----
    await fresh();
    S.death = await ev(() => { const G = __T.G, P = G.prog, RM = __T.RM, MD = __T.MD, K = PR.PROG.deaths, sg = { ...K.surgery }; RM.setOpt(true); __T.app.paused = true;
      const id = PR.crewList().find(c => !c.senior && !c.protected && RM.eligible(c.id) && c.id !== P.crew.slots.doctor).id; P.opinions[id] = 60; P.romance.lastSignal = -99; RM.forceSignal(id); RM.answerSignal(true); P.day += 2; RM.goOnDate(id, 'dinner');
      Object.assign(K.surgery, { chance: 1, max: 1, fastMult: 1, excellentMult: 1, visitMult: 1, assistMult: 1, scene: 3 }); P.playDays = 30; P.presentTotal = 1e6; P.med.asked = true; MD.setGentle(false); P.med.pins = [];
      P.med.inj = []; P.med.scene = null; P.med.day = { pd: -1, n: 0 }; P.crew.rolls.hist = []; P.med.lastDeathPD = null; P.med.lastDeathPT = null;
      const i = MD.injure('hazard', { id, sev: 'serious' }); for (let t = 0; t < 25; t++) { PA.playerInput(); SIM.stepSim(0.1); } i.ack = true; i.fixBy = 'lt'; delete G.ship.faults[i.sys]; for (let t = 0; t < 120; t++) { PA.playerInput(); SIM.stepSim(0.1); }
      Object.assign(K.surgery, sg); P.med.scene = null; const mem = P.med.memorial.slice(-1)[0] || {};
      // the memorial service (mess), then the journal + page
      P.med.memPending && (P.med.memPending.notBefore = 0); G.lt.mode = 'use'; G.lt.node = 'mess'; G.lt.deck = window.__messDeck; for (let t = 0; t < 5; t++) { PA.playerInput(); SIM.stepSim(0.1); }
      const svc = G.log.slice(-8).map(e => e.msg).filter(m => /friends noticed/.test(m));
      return { id, died: !P.crew.occ[id] && mem.id === id && mem.partner === true, svc, number: svc.some(m => /opinion \+/.test(m)), journal: __T.PL.journalOf(id).map(e => e.text).filter(t => /We lost/.test(t)) }; });
    await closeAll(); await ev(id => HUD.openPlog(id), S.death.id); await sleep(250);
    S.memPage = await ev(() => { const t = document.querySelector('#plogPanel .card').innerText; return { together: /were together/.test(t), lettersLine: /keeping the letters|keeping (her|his|their) letters/.test(t) }; }); await shot('memorial'); await closeAll();
    // ---- m7 corrupt save ----
    S.m7 = await ev(() => { const p = JSON.parse(JSON.stringify(__T.G.prog)); p.romance.opt = 'yes'; const id = Object.keys(p.crew.occ).find(k => PR.PROG.romance.excluded.indexOf(k) < 0 && !['tren', 'okafor'].includes(k)); p.romance.partner = id; p.romance.bond[id] = { stage: 'courting', since: 1, dates: 2 }; p.romance.signal = { id, day: 1 }; p.romance.thread = null;
      PR.hardenRomance(p); return { opt: p.romance.opt, partner: p.romance.partner, signal: p.romance.signal, stage: p.romance.bond[id].stage }; });
    S.ok = S.errors.length === 0 && S.dock.docked.promenade && S.dock.docked.holosuite && !S.dock.warp.promenade && !S.dock.warp.holosuite && !S.dock.battle.promenade && !S.dock.battle.holosuite && !S.dock.away.promenade
      && !!S.dock.note && S.dock.logNote && S.yesCard && S.discCard.okafor && S.discCard.normal && S.discLog && S.cadence.journalLines <= 6 && S.quiet.fade === null && !S.quiet.double && !S.quietCard.fadeEl
      && /^0{14}1+$/.test(S.m4m6.canByDay) && S.m4m6.forged === null && S.m4m6.partner === null && S.optoff.capsOk && S.offIndex && S.offPage.noLetters && S.offPage.lostTouch
      && S.death.died && !S.death.number && S.death.journal.every(t => !/letters/.test(t)) && S.memPage.together && !S.memPage.lettersLine && S.m7.partner === null && S.m7.signal === null && S.m7.opt === null;
    console.log(tag, S.ok ? 'OK' : 'FAIL', JSON.stringify(S).slice(0, 2500));
    await ctx.close();
  }
  R.ok = Object.values(R.sizes).every(s => s.ok); fs.writeFileSync(OUT + 'pt11-report.json', JSON.stringify(R, null, 1)); console.log(R.ok ? 'PT11 OK' : 'PT11 FAIL'); await b.close(); process.exit(R.ok ? 0 : 1);
})();
