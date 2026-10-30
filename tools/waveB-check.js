// Wave B: duty shifts, repair calls, mentoring, personal log — present-only, real-day slots.
const { chromium } = require('playwright-core');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const OUT = path.resolve(__dirname, '..', 'shots') + '/';
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
    await p.evaluate(() => {
      const G = __T.G; G.prog.story = G.prog.story || {}; G.prog.story.pilot = G.prog.story.pilot || {}; G.prog.story.pilot.done = true;
      G.prog.background = 'none'; G.prog.bgDone = true; G.prog.rations = 5000; G.prog.parts = 20;
      G.ship.nextFault = 1e9; G.sp.cap.decideT = 1e9; G.sp.ev.nextT = -1; G.sp.battle = null; G.sp.alert = null;
      window.__noSave = true; __T.PACE_RT.sessionT = 1e6;
    });

    // ---- Duty watch ----
    const D = await p.evaluate(async () => {
      const LA = await import('/js/lt-act.js'), CT = await import('/js/crew-talk.js'), NA = await import('/js/npc-ambient.js'), G = __T.G;
      await CT.readyTalk();
      G.lt.deck = 'bridge'; G.lt.x = 0.376; G.lt.y = 0.6219; G.lt.mode = 'use'; G.lt.node = 'conn'; G.lt.lift = false;
      NA.syncRoster();
      const tren = NA.ambient.find(a => a.occId === 'tren');
      if (tren) { tren.deck = 'bridge'; tren.x = 0.4; tren.y = 0.55; tren.mode = 'dwell'; tren.path = null; }
      LA.A().duty = { d: '', fams: {} };
      const chip = LA.dutyChipOk();
      const st = LA.startDutyWatch();
      // accelerate watch
      const s = LA.A().session; s.t = s.need - 0.1;
      LA.tickLtSession(0.2);
      // may be in chat now
      let steps = 0;
      for (let i = 0; i < 4; i++) {
        const v = LA.dutyView(); if (!v) break;
        if (v.phase === 'watch') { LA.tickLtSession(5); continue; }
        if (v.end) { LA.answerDuty(0); steps++; break; }
        LA.answerDuty(0); steps++;
      }
      const left = LA.dutyLeft('bridge');
      const again = LA.startDutyWatch();
      // freeze while hidden
      LA.A().duty = { d: '', fams: {} };
      G.lt.mode = 'use'; G.lt.node = 'conn';
      LA.startDutyWatch();
      const PA = await import('/js/pacing.js');
      const t0 = LA.A().session.t;
      PA.PACE_RT.hidden = true; LA.tickLtSession(10); const t1 = LA.A().session.t; PA.PACE_RT.hidden = false;
      LA.dismissSession();
      return { chip, st: !!(st && st.ok), left, againOk: !!(again && again.ok), steps, frozen: t0 === t1, n: LA.A().n.duty };
    });
    ok(D.chip && D.st && D.left === 0 && !D.againOk && D.frozen, `${tag} duty watch slot + freeze ` + J(D));
    if (SHOTS) await p.screenshot({ path: `${OUT}waveB-duty-${tag}.png` });

    // ---- Repair call (kit) ----
    const R = await p.evaluate(async () => {
      const LA = await import('/js/lt-act.js'), NA = await import('/js/npc-ambient.js'), G = __T.G;
      LA.A().repair = { d: '', n: 0, active: null };
      const id = G.prog.crew.slots.tactical || Object.keys(G.prog.crew.occ)[0];
      G.prog.requests = [{ id, item: 'mag-boots with a failed coil', day: G.prog.day }];
      G.prog.parts = 20;
      G.lt.deck = 'bridge'; G.lt.mode = 'use'; G.lt.node = 'tactical';
      const npc = NA.ambient.find(a => a.occId === id);
      if (npc) { npc.deck = 'bridge'; npc.x = G.lt.x + 0.02; npc.y = G.lt.y; npc.mode = 'dwell'; npc.path = null; }
      const pend = LA.pendingKitCalls();
      const acc = LA.acceptRepairCall(id);
      const duty = LA.repairDutyItem();
      const sc = LA.startRepairScene();
      // force chat
      if (LA.A().session && LA.A().session.phase === 'approach') {
        LA.A().session.phase = 'chat'; LA.A().session.mode = 'near'; LA.A().session.wait = 9;
      }
      LA.answerRepair(0);
      const v = LA.repairView();
      if (v && !v.end) LA.answerRepair(0);
      if (LA.A().session && LA.A().session.kind === 'repair') {
        // force finish
        LA.A().session.step = 1;
        LA.answerRepair(0);
      }
      return { pend: pend.length, acc: !!(acc && acc.ok), duty: !!(duty && duty.kind === 'repair-call'), left: LA.repairLeft(), n: LA.A().n.repairs, reqs: (G.prog.requests || []).length };
    });
    ok(R.pend >= 1 && R.acc && R.duty && R.left <= 1 && R.n >= 1, `${tag} repair call accept+scene ` + J(R));
    if (SHOTS) await p.screenshot({ path: `${OUT}waveB-repair-${tag}.png` });

    // ---- Mentoring ----
    const M = await p.evaluate(async () => {
      const LA = await import('/js/lt-act.js'), NA = await import('/js/npc-ambient.js'), G = __T.G;
      LA.A().mentor = { d: '', n: 0, invite: null };
      LA.A().session = null;
      const juniors = LA.mentorJuniors();
      const id = juniors.find(j => j.green)?.id || juniors[0]?.id;
      if (!id) return { err: 'no-junior', juniors: juniors.length };
      const npc = NA.ambient.find(a => a.occId === id);
      G.lt.deck = 'engineering'; G.lt.mode = 'use'; G.lt.node = 'core'; G.lt.x = 0.48; G.lt.y = 0.7;
      if (npc) { npc.deck = 'engineering'; npc.x = 0.5; npc.y = 0.7; npc.mode = 'dwell'; npc.path = null; }
      // force yes
      const real = Math.random; Math.random = () => 0;
      const st = LA.startMentor(id);
      Math.random = real;
      if (LA.A().session && LA.A().session.phase === 'approach') {
        LA.A().session.phase = 'chat'; LA.A().session.mode = 'near';
      }
      for (let i = 0; i < 4; i++) {
        const v = LA.mentorView(); if (!v) break;
        if (v.end) { LA.answerMentor(0); break; }
        LA.answerMentor(0);
      }
      return { juniors: juniors.length, st: !!(st && st.ok && st.yes !== false), left: LA.mentorLeft(), n: LA.A().n.mentor };
    });
    ok(M.juniors >= 1 && M.st && M.left === 0 && M.n === 1, `${tag} mentoring session ` + J(M));
    if (SHOTS) await p.screenshot({ path: `${OUT}waveB-mentor-${tag}.png` });

    // ---- Personal log ----
    const L = await p.evaluate(async () => {
      const LA = await import('/js/lt-act.js'), G = __T.G;
      LA.A().log = { d: '', n: 0 };
      G.lt.deck = 'quarters'; G.lt.mode = 'use'; G.lt.node = 'desk'; G.lt.lift = false;
      const chip = LA.logChipOk();
      const pr = LA.logPrompts();
      const w = LA.writeLog({ open: pr.opens[0], close: pr.closes[0], who: null });
      const again = LA.writeLog({ open: 'x', close: 'y' });
      // not at desk
      G.lt.node = 'rack';
      LA.A().log = { d: '', n: 0 };
      const nodeck = LA.writeLog({ open: 'a', close: 'b' });
      return { chip, opens: pr.opens.length, closes: pr.closes.length, w: !!(w && w.ok), againOk: !!(again && again.ok), nodeckOk: !!(nodeck && nodeck.ok), writes: LA.A().writes.length, n: LA.A().n.logs };
    });
    ok(L.chip && L.opens >= 1 && L.closes >= 1 && L.w && !L.againOk && !L.nodeckOk && L.writes >= 1, `${tag} personal log desk+slot ` + J(L));
    if (SHOTS) await p.screenshot({ path: `${OUT}waveB-log-${tag}.png` });



    // ---- Wave B NO-SHIP: romance close, mentor deck gate, declined locked ----
    const BF = await p.evaluate(async () => {
      const LA = await import('/js/lt-act.js'), H = await import('/js/ui/lt-act.js'), G = __T.G;
      // romance close present when ON
      const partner = G.prog.crew.slots.science || Object.keys(G.prog.crew.occ)[0];
      G.prog.romance = { opt: true, partner, stage: 1 };
      G.lt.deck = 'quarters'; G.lt.mode = 'use'; G.lt.node = 'desk'; G.lt.lift = false;
      LA.A().log = { d: '', n: 0 };
      const on = LA.logPrompts();
      const romOn = on.closes.some(c => /Thinking of /.test(c));
      G.prog.romance.opt = false;
      const off = LA.logPrompts();
      const romOff = off.closes.some(c => /Thinking of /.test(c));
      // mentor deck gate
      G.lt.deck = 'lounge'; G.lt.mode = 'idle'; G.lt.node = null;
      const fromLounge = LA.startMentor(LA.mentorJuniorIds()[0] || 'seo');
      let openBlocked = false;
      try {
        H.openMentor();
        const panel = document.getElementById('ltActPanel');
        openBlocked = !panel || panel.hidden;
      } catch (e) { openBlocked = true; }
      // declined locked in UI
      G.lt.deck = 'bridge'; G.lt.mode = 'use'; G.lt.node = 'conn';
      LA.A().mentor = { d: '', n: 0, invite: null };
      const jid = LA.mentorJuniorIds()[0];
      LA.rollInvite('mentor', jid, () => 0.99); // decline
      const list = LA.mentorJuniors();
      const row = list.find(x => x.id === jid);
      H.openMentor();
      const btn = document.querySelector(`#ltActPanel [data-ltact-mentor="${jid}"]`);
      return {
        romOn, romOff, closesOn: on.closes, closesOff: off.closes,
        loungeBlocked: !!(fromLounge && !fromLounge.ok),
        loungeWhy: fromLounge && fromLounge.why,
        openBlocked,
        declined: !!(row && row.declined && row.locked),
        btnDisabled: !!(btn && btn.disabled),
        jid,
      };
    });
    ok(BF.romOn && !BF.romOff, `${tag} romance close on/off ` + J({ on: BF.closesOn, off: BF.closesOff }));
    ok(BF.loungeBlocked && BF.openBlocked, `${tag} mentor deck-gated API+panel ` + J({ why: BF.loungeWhy, openBlocked: BF.openBlocked }));
    ok(BF.declined && BF.btnDisabled, `${tag} declined mentor locked untappable ` + J({ jid: BF.jid, declined: BF.declined, disabled: BF.btnDisabled }));

    // full invite + mentor harden rolls
    const INV = await p.evaluate(async () => {
      const LA = await import('/js/lt-act.js');
      const { hardenLtAct } = await import('/js/lt-act.js');
      const ids = LA.inviteTargets('meal').map(x => x.id);
      const juniors = LA.mentorJuniors();
      LA.A().mentor = { d: '', n: 0, invite: null };
      const jid = juniors[0] && juniors[0].id;
      let roll = null, again = null;
      if (jid) {
        roll = LA.rollInvite('mentor', jid, () => 0.99);
        hardenLtAct(__T.G.prog);
        again = LA.rollInvite('mentor', jid, () => 0.1);
      }
      return {
        mealN: ids.length, hasThelev: ids.includes('thelev'), juniors: juniors.length,
        rollNo: roll && roll.yes === false,
        againBlocked: again && (!again.ok || again.prior === false),
      };
    });
    ok(INV.hasThelev && INV.mealN >= 12 && INV.juniors >= 1, `${tag} Wave B invite/mentor full lists ` + J(INV));
    ok(INV.rollNo && INV.againBlocked, `${tag} mentor harden keeps rolls ` + J(INV));

    // UI panel 44px
    const U = await p.evaluate(async () => {
      const H = await import('/js/ui/lt-act.js');
      const LA = await import('/js/lt-act.js');
      LA.A().mentor = { d: '', n: 0, invite: null };
      LA.A().session = null;
      H.openMentor();
      const panel = document.getElementById('ltActPanel');
      const btn = panel && panel.querySelector('[data-ltact-mentor], .holoinv');
      const foot = panel && panel.querySelector('.holofoot');
      const br = btn && btn.getBoundingClientRect();
      const fr = foot && foot.getBoundingClientRect();
      const body = panel && panel.querySelector('.holobody');
      return {
        open: panel && !panel.hidden,
        tap44: !!(br && br.height >= 43.5),
        footIn: !!(fr && fr.bottom <= innerHeight + 2),
        oy: body && getComputedStyle(body).overflowY,
      };
    });
    if (SHOTS) await p.screenshot({ path: `${OUT}waveB-panel-${tag}.png` });
    ok(U.open && U.tap44 && U.footIn && (U.oy === 'auto' || U.oy === 'scroll'), `${tag} mentor panel scroll+44 ` + J(U));

    await ctx.close();
  }
  console.log(fails ? `FAILS ${fails}` : `PASS · waveB-check · 3 sizes`);
  console.log(`NETWATCH console=${net.console} failed=${net.failed}`, J(net.errs.slice(0, 6)));
  await b.close();
  process.exit(fails || net.console || net.failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
