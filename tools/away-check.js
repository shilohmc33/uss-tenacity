// Away happenings check (Oct 26 batch H). Per size (390x844, 844x390, 1280x800): the count rule (>= 30 min = 1, +1 per
// full 2 h, max 3), the caps (8 XP each, 24 per absence, 40 per real local day), no rested multiplier, one comm log line
// each, clock tricks (a day forward pays again; set back, the stored day never moves back), and the real return path:
// measured from maxSeen, then maxSeen = now (a reload claims nothing; a maxSeen ahead of the clock gives nothing).
// Shot: shots/away-bow-<size>.png (BACK ON WATCH with happenings). Usage: node tools/away-check.js (SHOTS=0 skips shots)
const { chromium } = require('playwright-core'); const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/', OUT = path.resolve(__dirname, '..', 'shots') + '/', SHOTS = process.env.SHOTS !== '0';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [], net = [], fails = [], J = JSON.stringify, host = new URL(BASE).host, ok = (c, m) => { if (!c) fails.push(m); else console.log('ok ' + m.split(' {')[0].split(' [')[0]); };
  for (const [w, h] of [[390, 844], [844, 390], [1280, 800]]) {
    const tag = `${w}x${h}`, mob = w < 900, c = await br.newContext({ viewport: { width: w, height: h }, locale: 'en-US', timezoneId: 'America/Chicago', isMobile: mob, hasTouch: mob });
    await c.addInitScript(() => { window.__TENACITY_SKIP_NAME = true; window.__TENACITY_SKIP_BG = true;
      /* R1 regression: a persistent clock offset (ms) read before the game loads, so a reload runs on the moved clock */
      let off = 0; try { off = +localStorage.getItem('__clockOff') || 0; } catch (e) {} if (off) { const RD = Date; class FD extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } } window.Date = FD; } });
    const p = await c.newPage();
    p.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); }); p.on('pageerror', e => errs.push(`${tag}: ${e.message}`));
    p.on('response', r => { if (r.status() >= 400) net.push(`${tag}: ${r.status()} ${r.url()}`); });
    p.on('requestfailed', r => { if (new URL(r.url()).host === host) net.push(`${tag}: failed ${r.url()} ${r.failure() && r.failure().errorText}`); });
    const ready = () => p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
    const calm = () => p.evaluate(() => { const G = __T.G; G.prog.story.pilot.done = true; G.prog.background = G.prog.background || 'none'; G.prog.bgDone = true; G.prog.rations = 2000; G.ship.nextFault = 1e9; G.sp.cap.decideT = 1e9; G.sp.ev.nextT = -1; G.sp.battle = null; G.sp.alert = null; __T.PACE_RT.sessionT = 1e6; document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); });
    await p.goto(BASE + '?reset=1'); await ready(); await sleep(400); await calm();
    const R = {};
    // ---- 1. the count rule: >= 30 min gives 1, +1 per full 2 h, max 3; zero / negative / NaN gives nothing ----
    R.count = await p.evaluate(async () => { const A = await import('/js/away.js'); return [1799, 1800, 7199, 7200, 14399, 14400, 1e7, 0, -50, NaN].map(A.awayCount); });
    ok(J(R.count) === J([0, 1, 1, 2, 2, 3, 3, 0, 0, 0]), `${tag} count rule ` + J(R.count));
    // ---- 2. caps (8 each, 24 per absence, 40 per real day) and NO rested multiplier (the rested window is open here) ----
    R.caps = await p.evaluate(async () => { const A = await import('/js/away.js'), G = __T.G, PG = G.prog; PG.away = { d: '', xp: 0 }; PG.level = 1; PG.xp = 0;
      __T.PACE_RT.sessionT = 0; PG.restT = 0; const tx = () => PG.totalXp, x0 = tx();
      const a = A.rollAway(3 * 3600), x1 = tx(); const b = A.rollAway(1e6), x2 = tx(); const c = A.rollAway(1e6), x3 = tx(); const z = A.rollAway(0), n = A.rollAway(-99);
      const logs = G.log.slice(-30).filter(e => /^While you were away:/.test(e.msg));
      return { a: a.length, ax: x1 - x0, b: b.length, bx: x2 - x1, c: c.length, cx: x3 - x2, z: z.length, n: n.length, day: PG.away, perHap: a.map(h => h.xp), logs: logs.length, cls: [...new Set(logs.map(e => e.cls))] }; });
    ok(R.caps.a === 2 && R.caps.ax === 16 && J(R.caps.perHap) === '[8,8]', `${tag} 3 h away: 2 happenings x 8 XP, no rested x1.25 ` + J(R.caps));
    ok(R.caps.b === 3 && R.caps.bx === 24 && R.caps.c === 3 && R.caps.cx === 0 && R.caps.day.xp === 40, `${tag} caps: 24 per absence, 40 per real day (listed, unpaid after) ` + J(R.caps));
    ok(R.caps.z === 0 && R.caps.n === 0 && R.caps.logs >= 8 && J(R.caps.cls) === '["comm"]', `${tag} zero / negative gap: nothing; one comm log line per happening ` + J(R.caps));
    // ---- 3. clock tricks: tomorrow opens a new allowance; set back again, the stored day never moves back (no third) ----
    R.clock = await p.evaluate(async () => { const A = await import('/js/away.js'), U = await import('/js/util.js'), PG = __T.G.prog, RD = Date; let off = 0;
      class FD extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }
      const tx = () => PG.totalXp; window.Date = FD;
      try { const today = U.dayKey(); off = 86400e3; const x0 = tx(); A.rollAway(1e6); const fwd = tx() - x0, dFwd = PG.away.d;
        off = 0; const x1 = tx(); A.rollAway(1e6); A.rollAway(1e6); const back = tx() - x1;
        return { today, dFwd, fwd, back, after: PG.away }; } finally { window.Date = RD; } });
    ok(R.clock.fwd === 24 && R.clock.back === 16 && R.clock.after.d === R.clock.dFwd && R.clock.dFwd > R.clock.today, `${tag} clock: a new day pays again; set back, the day stays and the cap holds ` + J(R.clock));
    // ---- 3b. crew picks: a junior crewmate, never the captain or a senior officer, never twice in one return or named twice ----
    R.crew = await p.evaluate(async () => { const A = await import('/js/away.js'), G = __T.G, PG = G.prog, PR = await import('/js/progression.js'); const seniors = PR.crewList().filter(c => c.senior).map(c => c.short); let bad = [], n = 0;
      for (let i = 0; i < 300; i++) { PG.away = { d: '', xp: 0 }; const hs = A.rollAway(1e6); const named = [];
        for (const h of hs) { const m = /^(\S+(?: \S+)?) (rewired|reorganized)|^(\S+) and Hale argued/.exec(h.line); if (!m) continue; n++; const who = m[1] || m[3];
          if (seniors.some(s => who.includes(s)) || /T'Ren|Hale and Hale/.test(h.line)) bad.push(h.line); if (named.includes(who)) bad.push('dup ' + who); named.push(who); } }
      const brit = A.AWAY && JSON.stringify(G.log.slice(-40)).match(/colour|reorganis/g); return { n, bad: bad.slice(0, 4), brit }; });
    ok(R.crew.n > 50 && !R.crew.bad.length && !R.crew.brit, `${tag} crew picks: juniors only, no duplicates, US spelling ` + J(R.crew));
    // ---- 4. the real return: measured from maxSeen, then maxSeen = now; a reload cannot claim it again; a future maxSeen gives nothing ----
    const plant = (seenAgo, maxAhead) => p.evaluate(([ago, ahead]) => { const G = __T.G, now = Date.now(); G.prog.away = { d: '', xp: 0 }; G.prog.lastSeen = now - ago; G.prog.maxSeen = ahead ? now + ahead : now - ago;
      window.__noSave = false; __T.saveGame(); window.__noSave = true; const s = JSON.parse(localStorage.getItem('tenacity.save.v1')); s.savedAt = now - ago; localStorage.setItem('tenacity.save.v1', JSON.stringify(s)); }, [seenAgo, maxAhead]);
    const card = () => p.evaluate(() => { const el = document.querySelector('#wbCard'), G = __T.G; return { shown: !!el && !el.hidden && el.classList.contains('bow'), haps: el ? el.querySelectorAll('.bowHaps li').length : 0, held: !!el && /Everything held as you left it\./.test(el.textContent), head: !!el && /While you were away:/.test(el.textContent), xp: [...(el ? el.querySelectorAll('.bowXp') : [])].map(b => b.textContent), maxLag: Date.now() - G.prog.maxSeen, away: G.prog.away }; });
    await plant(3 * 3600e3 + 60e3, 0); await p.reload(); await ready(); await sleep(900);
    R.ret = await card();
    ok(R.ret.shown && R.ret.haps === 2 && R.ret.held && R.ret.head && J(R.ret.xp) === '["+8 XP","+8 XP"]' && R.ret.away.xp === 16 && R.ret.maxLag >= 0 && R.ret.maxLag < 5000, `${tag} 3 h away: BACK ON WATCH lists 2 happenings (+XP), still 'Everything held', maxSeen = now ` + J(R.ret));
    if (SHOTS) { await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); }); await p.screenshot({ path: `${OUT}away-bow-${tag}.png` }); }
    await p.evaluate(() => { window.__noSave = false; __T.saveGame(); window.__noSave = true; }); await p.reload(); await ready(); await sleep(900);
    R.again = await card();
    ok(R.again.haps === 0 && R.again.away.xp === 16, `${tag} a quick reload claims nothing ` + J(R.again));
    await plant(3 * 3600e3, 5 * 3600e3); await p.reload(); await ready(); await sleep(900);
    R.fut = await card();
    ok(R.fut.haps === 0 && R.fut.away.xp === 0, `${tag} a maxSeen ahead of the clock (clock set back) gives nothing ` + J(R.fut));
    // ---- 6. R1 regression (the Tester's repro): 3 round trips, clock +2 days then back, reloading each time. A trip may
    //         never gain: no extra Lt holo session at the real date, away XP never past the caps (one +2 d day only), no rested
    //         refresh on the way back, and no counselor / Risa refund ----
    await p.evaluate(() => { localStorage.setItem('__clockOff', '0'); }); await p.goto(BASE + '?reset=1'); await ready(); await sleep(400); await calm();
    const act = () => p.evaluate(async () => { const HD = await import('/js/holodeck.js'), CC = await import('/js/crewcare.js'), N = await import('/js/needs.js'), G = __T.G, PG = G.prog, C = PG.crew;
      const A = C.slots['engineer-2'] || C.slots['chief-engineer'], B = C.slots['science'] || C.slots['security']; PG.rations = 5000;
      for (const k of Object.keys(PG.holo.busy || {})) delete PG.holo.busy[k];
      const lt = HD.book('vulcan_garden', 'lt', true).ok; for (const k of Object.keys(PG.holo.busy || {})) delete PG.holo.busy[k];
      const risa = HD.book('risa_beach', A, true).ok; for (const k of Object.keys(PG.holo.busy || {})) delete PG.holo.busy[k];
      N.needsOf(B).stress = 6; const cou = CC.counsel(B).ok;
      return { lt, why: HD.bookState('vulcan_garden', 'lt', true).why || '', risa, cou, xp: PG.totalXp, away: { ...PG.away }, restT: PG.restT, ltD: PG.holo.lt && PG.holo.lt.d }; });
    const hop = async off => { await p.evaluate(o => { __T.G.prog.restT = 500; window.__noSave = false; __T.saveGame(); window.__noSave = true; localStorage.setItem('__clockOff', String(o)); }, off); await p.reload(); await ready(); await sleep(700); await calm(); return p.evaluate(() => ({ restT: __T.G.prog.restT, xp: __T.G.prog.totalXp, away: { ...__T.G.prog.away } })); };
    // R2: +2 d trips pay once (borrowed: those days stay used) and then nothing; +31 d and +60 d trips are a BAD CLOCK: nothing at all
    for (const days of [2, 31, 60]) {
      await p.evaluate(() => { localStorage.setItem('__clockOff', '0'); }); await p.goto(BASE + '?reset=1'); await ready(); await sleep(400); await calm();
      const base = await act(); ok(base.lt && base.risa && base.cou, `${tag} +${days} d: today's Lt session, Risa and counselor used first ` + J(base));
      const runs = [];
      for (let i = 0; i < 3; i++) { const fwd = await hop(days * 864e5), aF = await act(), back = await hop(0), aB = await act(); runs.push({ fwd, aF, back, aB }); }
      const ltAhead = runs.filter(r => r.aF.lt).length, ltBack = runs.filter(r => r.aB.lt).length, xp = runs.map(r => r.fwd.away.xp), refresh = runs.map(r => r.back.restT), fRefresh = runs.map(r => r.fwd.restT);
      const refunds = runs.flatMap(r => [r.aF.risa, r.aF.cou, r.aB.risa, r.aB.cou]).filter(Boolean).length, bad = days > 30;
      const T = { days, ltAhead, ltBack, xp, refresh, fRefresh, refunds, why: runs[0].aF.why };
      if (!bad) ok(ltBack === 0 && ltAhead <= 1 && xp.every(x => x === xp[0] && x <= 24) && refresh.every(x => x >= 500) && fRefresh.slice(1).every(x => x >= 500) && refunds === 0, `${tag} R1 +${days} d x3: at most the first trip's day (borrowed), then nothing; no refunds ` + J(T));
      else ok(ltAhead === 0 && ltBack === 0 && xp.every(x => x === xp[0]) && refresh.every(x => x >= 500) && fRefresh.every(x => x >= 500) && refunds === 0 && /re-syncing/.test(T.why), `${tag} R2 +${days} d x3 (bad clock): nothing gained on any trip ` + J(T));
    }
    // a genuine bogus clock (+3 years): play continues, nothing granted or stored; corrected, everything works again at once
    R.bogus = {};
    { await p.evaluate(() => { localStorage.setItem('__clockOff', '0'); }); await p.goto(BASE + '?reset=1'); await ready(); await sleep(400); await calm();
      await p.evaluate(() => { const PG = __T.G.prog; PG.holo.lt = { d: '', n: 0 }; PG.maxSeen = Date.now(); });
      const ms0 = await p.evaluate(() => __T.G.prog.maxSeen); await hop(3 * 365 * 864e5);
      R.bogus.ahead = await p.evaluate(async () => { const HD = await import('/js/holodeck.js'), G = __T.G, s0 = G.savedAt; await new Promise(r => setTimeout(r, 1500)); window.__noSave = false; __T.saveGame(); window.__noSave = true;
        return { book: HD.book('vulcan_garden', 'lt', true).ok, maxSeen: G.prog.maxSeen, savedAt: JSON.parse(localStorage.getItem('tenacity.save.v1')).savedAt, warn: G.log.some(e => /Re-syncing ship's chronometer/.test(e.msg)), haps: document.querySelectorAll('#wbCard .bowHaps li').length, ltD: G.prog.holo.lt.d, s0 }; });
      R.bogus.ms0 = ms0;
      await p.evaluate(() => { __T.G.prog.maxSeen -= 3 * 3600e3; __T.G.prog.lastSeen = __T.G.prog.maxSeen; window.__noSave = false; __T.saveGame(); window.__noSave = true; const s = JSON.parse(localStorage.getItem('tenacity.save.v1')); s.savedAt = __T.G.prog.maxSeen; localStorage.setItem('tenacity.save.v1', JSON.stringify(s)); localStorage.setItem('__clockOff', '0'); });
      await p.reload(); await ready(); await sleep(900);
      R.bogus.back = await p.evaluate(async () => { const HD = await import('/js/holodeck.js'), G = __T.G; const haps = document.querySelectorAll('#wbCard .bowHaps li').length; await new Promise(r => setTimeout(r, 300)); document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); for (const k of Object.keys(G.prog.holo.busy || {})) delete G.prog.holo.busy[k]; return { haps, book: HD.book('vulcan_garden', 'lt', true).ok, maxLag: Date.now() - G.prog.maxSeen }; }); }
    ok(!R.bogus.ahead.book && Math.abs(R.bogus.ahead.maxSeen - R.bogus.ms0) < 6e4 && R.bogus.ahead.savedAt <= R.bogus.ms0 + 6e4 && R.bogus.ahead.warn && R.bogus.ahead.haps === 0 && R.bogus.ahead.ltD === '', `${tag} bogus +3 y clock: nothing granted or stored (no booking, maxSeen / savedAt not advanced), one warning line ` + J(R.bogus.ahead));
    ok(R.bogus.back.haps === 2 && R.bogus.back.book && R.bogus.back.maxLag >= 0 && R.bogus.back.maxLag < 6e4, `${tag} bogus clock corrected: a real 3 h absence pays, the Lt session books at once ` + J(R.bogus.back));
    // ---- 7. B1 honest return (the Tester's repro, the clock correct throughout): Oct 26, Nov 24 (+29 d), Dec 26 (+61 d: 32 d
    //         past the last watch = re-sync), the next load 2 h later accepts the new time and pays ONE normal absence ----
    await p.evaluate(() => { localStorage.setItem('__clockOff', '0'); }); await p.goto(BASE + '?reset=1'); await ready(); await sleep(400); await calm();
    const look = () => p.evaluate(async () => { const CK = await import('/js/clock.js'), HD = await import('/js/holodeck.js'), UH = await import('/js/ui/holo.js'), G = __T.G;
      const haps = document.querySelectorAll('#wbCard:not([hidden]) .bowHaps li').length; UH.openHolo('lt'); const head = (document.querySelector('#holoPanel .hololimit, #holoPanel .hololeft') || {}).textContent || ''; const rowWhy = [...document.querySelectorAll('#holoPanel .holorow small')].some(x => /re-syncing/i.test(x.textContent)); document.querySelectorAll('.modal').forEach(m => { m.hidden = true; });
      for (const k of Object.keys(G.prog.holo.busy || {})) delete G.prog.holo.busy[k]; const st = HD.bookState('vulcan_garden', 'lt', true);
      const card = document.querySelector('#wbCard'); return { bad: CK.badClock(), haps, head, rowWhy, canBook: st.ok, why: st.why || '', restT: G.prog.restT, awayXp: G.prog.away.xp, awayD: G.prog.away.d, wrong: G.log.some(e => /looks wrong/.test(e.msg)), resync: G.log.some(e => /Re-syncing ship's chronometer/.test(e.msg)), synced: G.log.some(e => /chronometer re-synced/.test(e.msg)), card: !!card && !card.hidden && card.classList.contains('bow'), cardTxt: card && !card.hidden ? card.textContent : '' }; });
    R.hon = {};
    await hop(29 * 864e5); R.hon.nov24 = await look();
    await hop(61 * 864e5); R.hon.dec26 = await look();
    // D1: a second load in the same re-sync wait must NOT show the short card again
    await hop(61 * 864e5); R.hon.dec26r = await look();
    await hop(61 * 864e5 + 2 * 3600e3); R.hon.dec26b = await look();
    await hop(62 * 864e5); R.hon.dec27 = await look();
    const Hn = R.hon;
    ok(!Hn.nov24.bad && Hn.nov24.haps === 3 && Hn.nov24.restT < 500 && Hn.nov24.canBook, `${tag} B1 honest: Nov 24 (+29 d) is a normal return ` + J(Hn.nov24));
    ok(Hn.dec26.bad && Hn.dec26.haps === 0 && Hn.dec26.restT >= 500 && !Hn.dec26.canBook && /RE-SYNCING/.test(Hn.dec26.head) && !/session.? left/.test(Hn.dec26.head) && !Hn.dec26.rowWhy && Hn.dec26.resync && !Hn.dec26.wrong && Hn.dec26.card && /away report follows within the hour/i.test(Hn.dec26.cardTxt), `${tag} B1/B2/C1 honest: Dec 26 re-syncs with a short card ('full report within the hour'), neutral text, nothing granted yet ` + J(Hn.dec26));
    ok(Hn.dec26.card && !Hn.dec26r.card && Hn.dec26r.bad, `${tag} D1: re-sync card once per wait (second Dec 26 load has no card) ` + J({ first: !!Hn.dec26.card, second: !!Hn.dec26r.card, bad: Hn.dec26r.bad }));
    ok(!Hn.dec26b.bad && Hn.dec26b.haps >= 1 && Hn.dec26b.haps <= 3 && Hn.dec26b.awayXp - Hn.nov24.awayXp <= 24 && Hn.dec26b.restT < 500 && Hn.dec26b.canBook && Hn.dec26b.synced && !Hn.dec26b.wrong && Hn.dec26b.card && /Away\s+32d\b/i.test(Hn.dec26b.cardTxt) && !/32d 2h|32d 1h/i.test(Hn.dec26b.cardTxt), `${tag} B1/C2 honest: a load 2 h later accepts, pays ONE absence, and the card does not count the re-sync hour as time away ` + J({ t: Hn.dec26b.cardTxt && Hn.dec26b.cardTxt.slice(0, 120), haps: Hn.dec26b.haps, xp: Hn.dec26b.awayXp }));
    ok(!Hn.dec27.bad && Hn.dec27.canBook && Hn.dec27.haps >= 1, `${tag} B1 honest: Dec 27 plays normally ` + J(Hn.dec27));
    // ---- 8. B1 within one session: >= 1 h on the monotonic clock with the wall clock moving the same (+-5 min) accepts;
    //         a wall clock that moved differently (a jump) does not ----
    await p.evaluate(() => { localStorage.setItem('__clockOff', '0'); }); await p.goto(BASE + '?reset=1'); await ready(); await sleep(400); await calm();
    R.sess = await p.evaluate(async () => { const CK = await import('/js/clock.js'), G = __T.G, pn = performance.now(), now = Date.now(); G.prog.maxSeen = now - 40 * 864e5; G.prog.lastSeen = G.prog.maxSeen; delete G.prog.clockCand;
      const a = CK.clockCheck(); CK.clockRT.perf0 = pn - 3601e3; CK.clockRT.wall0 = now - 2 * 3600e3; G.prog.clockCand = { wall: now - 60e3, off: 0 }; const b = CK.clockCheck();
      CK.clockRT.perf0 = performance.now() - 3601e3; CK.clockRT.wall0 = Date.now() - 3601e3; G.prog.clockCand = { wall: Date.now() - 60e3, off: 0 }; const x0 = G.prog.totalXp; const c = CK.clockCheck();
      await new Promise(r => setTimeout(r, 300)); return { a, b, c, bad: CK.badClock(), haps: document.querySelectorAll('#wbCard:not([hidden]) .bowHaps li').length, xp: G.prog.totalXp - x0, maxLag: Date.now() - G.prog.maxSeen }; });
    ok(R.sess.a === 'wait' && R.sess.b === 'wait' && R.sess.c === 'accepted' && !R.sess.bad && R.sess.haps === 3 && R.sess.xp <= 30 && R.sess.maxLag < 6e4, `${tag} B1 in-session: 1 h consistent accepts (one absence paid); an inconsistent wall clock waits ` + J(R.sess));
    await p.evaluate(() => localStorage.setItem('__clockOff', '0'));
    await c.close();
  }
  await br.close();
  console.log('ERRORS', errs.length, J(errs.slice(0, 5))); console.log('NET', net.length, J(net.slice(0, 5)));
  if (fails.length || errs.length || net.length) { console.log('FAILS ' + fails.length); fails.forEach(f => console.log('FAIL ' + f)); process.exit(1); }
  console.log('PASS · away-check · 3 sizes · 0 console errors · 0 failed requests');
})().catch(e => { console.error(e); process.exit(1); });
