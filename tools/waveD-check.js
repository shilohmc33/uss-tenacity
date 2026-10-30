// Wave D: DS9 shore evenings + away missions (text-only; awayArt/ds9Art OFF).
const { chromium } = require('playwright-core');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const OUT = path.resolve(__dirname, '..', 'shots') + '/';
try { require('fs').mkdirSync(OUT, { recursive: true }); } catch (e) {}
const SHOTS = process.env.SHOTS !== '0';
const SIZES = [[390, 844], [844, 390], [1280, 800]];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const J = o => JSON.stringify(o);
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('FAIL', m); } else console.log('ok', m.split(' {')[0].split(' [')[0]); };

(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const net = { console: 0, failed: 0, errs: [] };
  for (const [w, h] of SIZES) {
    const tag = `${w}x${h}`, mob = w < 900;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob, deviceScaleFactor: mob ? 2 : 1 });
    await ctx.addInitScript(() => { window.__TENACITY_SKIP_NAME = true; window.__TENACITY_SKIP_BG = true; window.__TENACITY_NO_IDLE = true; });
    const p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error') { net.console++; net.errs.push(m.text()); } });
    p.on('requestfailed', () => { net.failed++; });
    await p.goto(BASE + '?reset=1');
    await p.waitForFunction(() => window.__T && document.querySelector('#loading')?.classList.contains('done'), null, { timeout: 60000 });
    await sleep(300);
    await p.evaluate(async () => {
      const G = __T.G; G.prog.story = G.prog.story || {}; G.prog.story.pilot = G.prog.story.pilot || {}; G.prog.story.pilot.done = true;
      G.prog.background = 'none'; G.prog.bgDone = true; G.prog.rations = 5000; G.prog.parts = 20; G.prog.fleetRep = 80;
      G.ship.nextFault = 1e9; G.sp.cap.decideT = 1e9; G.sp.ev.nextT = -1; G.sp.battle = null; G.sp.alert = null;
      window.__noSave = true; __T.PACE_RT.sessionT = 1e6;
      G.prog.rank = 2;
    });

    // ---- Gates OFF ----
    const G0 = await p.evaluate(async () => {
      const { PROG } = await import('/js/progression.js');
      const LA = await import('/js/lt-act.js');
      return {
        awayArt: !!PROG.ltAct.awayArt, ds9Art: !!PROG.ltAct.ds9Art,
        awayArtOn: LA.awayArtOn(), ds9ArtOn: LA.ds9ArtOn(),
        everDS9: !!LA.A().everDS9,
      };
    });
    ok(!G0.awayArt && !G0.ds9Art && !G0.awayArtOn && !G0.ds9ArtOn,
      `${tag} gates OFF (awayArt/ds9Art) ` + J(G0));

    // ---- Dock DS9: everDS9 + shore grant path ----
    const D = await p.evaluate(async () => {
      const G = __T.G, LA = await import('/js/lt-act.js'), CC = await import('/js/crewcare.js');
      G.sp.location = 'ds9'; G.sp.travel = null; G.sp.battle = null; G.sp.alert = null;
      G.sp.rep = 100; CC.C().shoreUsed = false; CC.C().shoreDenied = false;
      LA.A().shore = { d: '', n: 0, invite: null, pick: null, visitDone: false };
      LA.A().away = { d: '', n: 0, invite: null, mission: null };
      LA.A().session = null;
      LA.tickLtAct();
      const before = { ever: !!LA.A().everDS9, shoreChip: LA.shoreChipOk(), awayChip: LA.awayChipOk() };
      // Force grant shore leave (bypass captain roll via direct state)
      const st0 = CC.shoreState();
      // Spend-like grant: set used without denial
      const withR = (r, fn) => {
        const old = Math.random; Math.random = () => r; try { return fn(); } finally { Math.random = old; }
      };
      const leave = withR(0, () => CC.shoreLeave());
      const afterLeave = { ok: !!leave.ok, denied: !!leave.denied, shoreChip: LA.shoreChipOk(), granted: LA.shoreGranted() };
      return { before, st0, afterLeave, tongo: LA.tongoUnlocked() };
    });
    ok(D.before.ever && D.tongo, `${tag} everDS9 + tongo on dock ` + J({ ever: D.before.ever, tongo: D.tongo }));
    ok(D.afterLeave.ok && D.afterLeave.granted && D.afterLeave.shoreChip,
      `${tag} shore leave grant unlocks evening chip ` + J(D.afterLeave));
    ok(D.before.awayChip, `${tag} away chip while docked ` + J({ away: D.before.awayChip }));

    // ---- Shore evening (quark) vignette + still reuse ----
    const S = await p.evaluate(async () => {
      const LA = await import('/js/lt-act.js'), H = await import('/js/ui/lt-act.js');
      const G = __T.G;
      // Invite companion for walk later; quark needs no guest
      const r = LA.startShoreEvening('quark');
      if (!r.ok) return { start: r };
      // answer through beats (final choice auto-finishes on end beat)
      let steps = 0, done = false;
      while (steps < 6) {
        const v = LA.shoreView(); if (!v) { done = true; break; }
        if (v.end) { const a = LA.answerShore(0); done = !!(a && a.done) || true; break; }
        const a = LA.answerShore(0); steps++;
        if (a && a.done) { done = true; break; }
      }
      const art = r.art;
      return {
        startOk: !!r.ok, art, steps, done,
        visitDone: !!LA.A().shore.visitDone, n: LA.A().n.shores,
        chipAfter: LA.shoreChipOk(), left: LA.shoreLeft(),
        artIsReuse: art === 'story_quarks' || art === 'story_quarks_v2',
      };
    });
    ok(S.startOk && S.done && S.visitDone && S.n >= 1 && S.left === 0 && !S.chipAfter,
      `${tag} shore quark evening completes once/visit ` + J(S));
    ok(S.artIsReuse || S.art === 'story_quarks', `${tag} shore art REUSE quarks ` + J({ art: S.art }));
    if (SHOTS) await p.screenshot({ path: `${OUT}waveD-shore-quark-${tag}.png` });

    // ---- Temple uses promenade stand-in while ds9Art OFF ----
    const T = await p.evaluate(async () => {
      const LA = await import('/js/lt-act.js'), CC = await import('/js/crewcare.js'), G = __T.G;
      // New visit: clear visitDone, re-grant
      LA.A().shore.visitDone = false; LA.A().shore.n = 0; LA.A().shore.d = '';
      CC.C().shoreUsed = false; CC.C().shoreDenied = false; G.sp.rep = 100;
      const withR = (r, fn) => { const o = Math.random; Math.random = () => r; try { return fn(); } finally { Math.random = o; } };
      withR(0, () => CC.shoreLeave());
      const key = LA.shoreArtKey('temple');
      const r = LA.startShoreEvening('temple');
      // finish quickly
      for (let i = 0; i < 5; i++) { const v = LA.shoreView(); if (!v || v.end) { LA.answerShore(0); break; } LA.answerShore(0); }
      return { key, startOk: !!r.ok, ds9: LA.ds9ArtOn() };
    });
    ok(T.startOk && T.key === 'story_promenade' && !T.ds9,
      `${tag} temple stand-in promenade while ds9Art OFF ` + J(T));

    // ---- Away mission present-only, not while traveling ----
    const A1 = await p.evaluate(async () => {
      const LA = await import('/js/lt-act.js'), G = __T.G;
      G.sp.travel = { dest: 'convoy', t: 0, dur: 600, from: 'ds9' };
      const whyTravel = LA.awayReadyWhy();
      G.sp.travel = null; G.sp.location = 'ds9';
      LA.A().away = { d: '', n: 0, invite: null, mission: null };
      LA.A().session = null;
      const whyDock = LA.awayReadyWhy();
      // Force invite yes for hale
      const roll = LA.rollInvite('away', 'hale', () => 0);
      const start = LA.startAway('listen');
      let steps = 0, done = false;
      while (steps < 6) {
        const v = LA.awayView(); if (!v) break;
        if (v.end) { LA.answerAway(0); done = true; break; }
        const r = LA.answerAway(0); if (r && r.done) { done = true; break; }
        steps++;
      }
      return {
        whyTravel, whyDock, roll, startOk: !!(start && start.ok), art: start && start.art,
        done, n: LA.A().n.aways, left: LA.awayLeft(), awayArt: LA.awayArtOn(),
      };
    });
    ok(!!A1.whyTravel && !A1.whyDock, `${tag} away blocked in travel, ok docked ` + J({ whyTravel: A1.whyTravel, whyDock: A1.whyDock }));
    ok(A1.startOk && A1.done && A1.n >= 1 && A1.left === 0 && !A1.awayArt,
      `${tag} away listen completes 1/day art gated ` + J(A1));
    ok(A1.art === 'story_generic_space', `${tag} away art REUSE generic_space ` + J({ art: A1.art }));
    if (SHOTS) await p.screenshot({ path: `${OUT}waveD-away-listen-${tag}.png` });

    // ---- Away blocked when already used; no hull damage path ----
    const A2 = await p.evaluate(async () => {
      const LA = await import('/js/lt-act.js'), G = __T.G;
      const hull0 = G.ship.hull;
      const why = LA.awayReadyWhy();
      // Reset day slot for supply run (keep today's date so daySlot won't wipe invite)
      const today = (await import('/js/progression.js')).localDate();
      LA.A().away = { d: today, n: 0, invite: { rolls: { diallo: true }, nos: 0, guest: 'diallo' }, mission: null };
      LA.A().session = null;
      const start = LA.startAway('supply');
      const hull1 = G.ship.hull;
      for (let i = 0; i < 5; i++) {
        const v = LA.awayView(); if (!v) break;
        if (v.end) { LA.answerAway(0); break; }
        // pick index 1 (stick to manifest / careful) when available
        LA.answerAway(1);
      }
      return { whyUsed: why, startOk: !!(start && start.ok), hull0, hull1, hullSame: hull0 === G.ship.hull, n: LA.A().n.aways };
    });
    ok(!!A2.whyUsed, `${tag} away day gate after first ` + J({ why: A2.whyUsed }));
    ok(A2.startOk && A2.hullSame, `${tag} away war pacing no hull change ` + J(A2));
    if (SHOTS) await p.screenshot({ path: `${OUT}waveD-away-done-${tag}.png` });

    // ---- Promenade rows expose evening + away ----
    const P = await p.evaluate(async () => {
      const PM = await import('/js/ui/promenade.js'), LA = await import('/js/lt-act.js'), CC = await import('/js/crewcare.js'), G = __T.G;
      G.sp.location = 'ds9'; G.sp.travel = null;
      LA.A().shore.visitDone = false; LA.A().shore.n = 0; LA.A().shore.d = '';
      CC.C().shoreUsed = true; CC.C().shoreDenied = false;
      LA.A().away = { d: '', n: 0, invite: null, mission: null };
      const rows = PM.promRows();
      return {
        keys: rows.map(r => r.k),
        shoreEve: rows.find(r => r.k === 'shoreEve'),
        away: rows.find(r => r.k === 'away'),
      };
    });
    ok(P.keys.includes('shoreEve') && P.keys.includes('away'),
      `${tag} promenade rows shoreEve+away ` + J(P.keys));
    if (SHOTS) {
      await p.evaluate(async () => { const PM = await import('/js/ui/promenade.js'); PM.openProm(); });
      await sleep(200);
      await p.screenshot({ path: `${OUT}waveD-prom-${tag}.png` });
      await p.evaluate(async () => { const PM = await import('/js/ui/promenade.js'); PM.hideProm(); });
    }

    // ---- Panel 44px ----
    const U = await p.evaluate(async () => {
      const H = await import('/js/ui/lt-act.js'), LA = await import('/js/lt-act.js'), CC = await import('/js/crewcare.js'), G = __T.G;
      G.sp.location = 'ds9'; G.sp.travel = null;
      LA.A().shore = { d: '', n: 0, invite: null, pick: null, visitDone: false };
      CC.C().shoreUsed = true; CC.C().shoreDenied = false;
      H.openShore();
      const panel = document.getElementById('ltActPanel');
      const btn = panel && panel.querySelector('[data-ltact-shore]');
      const br = btn && btn.getBoundingClientRect();
      const foot = panel && panel.querySelector('.holofoot');
      const fr = foot && foot.getBoundingClientRect();
      return { open: panel && !panel.hidden, tap44: !!(br && br.height >= 43.5), footIn: !!(fr && fr.bottom <= innerHeight + 2) };
    });
    ok(U.open && U.tap44 && U.footIn, `${tag} shore panel 44 ` + J(U));

    await ctx.close();
  }
  console.log(fails ? `FAILS ${fails}` : `PASS · waveD-check · 3 sizes`);
  console.log(`NETWATCH console=${net.console} failed=${net.failed}`, J(net.errs.slice(0, 6)));
  await b.close();
  process.exit(fails || net.console || net.failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
