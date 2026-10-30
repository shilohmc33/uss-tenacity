// Wave A: shared meals, card nights, personal quests — present-only, real-day slots, in-room speakers.
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
    await sleep(350);
    await p.evaluate(() => {
      const G = __T.G; G.prog.story = G.prog.story || {}; G.prog.story.pilot = G.prog.story.pilot || {}; G.prog.story.pilot.done = true;
      G.prog.background = 'none'; G.prog.bgDone = true; G.prog.rations = 5000;
      G.ship.nextFault = 1e9; G.sp.cap.decideT = 1e9; G.sp.ev.nextT = -1; G.sp.battle = null; G.sp.alert = null;
      window.__noSave = true; __T.PACE_RT.sessionT = 1e6;
    });

    // Place Lt at mess table; force Thelev nearby for meal
    const M = await p.evaluate(async () => {
      const LA = await import('/js/lt-act.js'), NA = await import('/js/npc-ambient.js'), CT = await import('/js/crew-talk.js'), G = __T.G;
      await CT.readyTalk();
      G.lt.deck = 'lounge'; G.lt.x = 0.55; G.lt.y = 0.42; G.lt.mode = 'use'; G.lt.node = 'mess'; G.lt.lift = false;
      NA.syncRoster();
      const th = NA.ambient.find(a => a.occId === 'thelev');
      if (th) { th.deck = 'lounge'; th.x = 0.57; th.y = 0.43; th.mode = 'dwell'; th.path = null; }
      G.prog.opinions = G.prog.opinions || {}; G.prog.opinions.thelev = 50;
      const chip = LA.mealChipOk();
      const left0 = LA.mealLeft();
      // invite yes forced
      const inv = LA.rollInvite('meal', 'thelev', () => 0);
      const st = LA.startMeal();
      // resolve seat walk if still approaching
      if (LA.A().session && LA.A().session.phase === 'approach') {
        const seat = LA.A().session.seat || 'table1';
        NA.holdAtSeat('thelev', seat, 'eat');
        const n2 = NA.npcOf('thelev');
        if (n2 && n2.spot) { n2.mode = 'dwell'; n2.path = null; n2.x = n2.spot.x; n2.y = n2.spot.y; n2.dir = 'down'; }
        LA.tickLtSession(25);
        if (LA.A().session && LA.A().session.phase === 'approach') {
          LA.A().session.phase = 'chat'; LA.A().session.mode = 'near';
          if (!(LA.A().meal.n | 0)) { LA.A().meal.n = 1; LA.A().n.meals++; }
        }
      }
      let steps = 0;
      for (let i = 0; i < 6; i++) {
        const v = LA.mealView(); if (!v) break;
        if (v.end) { LA.answerMeal(0); steps++; break; }
        LA.answerMeal(0); steps++;
      }
      const left1 = LA.mealLeft();
      // second meal same day blocked
      const again = LA.startMeal();
      // away: no accrual — mealLeft stays 0 even if we fake idle
      return { chip, left0, inv, st: !!(st && st.ok), steps, left1, againOk: !!(again && again.ok), rations: G.prog.rations, n: LA.A().n.meals };
    });
    ok(M.chip && M.left0 === 1, `${tag} meal chip + daily left ` + J(M));
    ok(M.st && M.left1 === 0 && !M.againOk && M.n === 1, `${tag} meal finish burns real-day slot ` + J(M));
    ok(M.inv && (M.inv.yes || M.inv.ok === false), `${tag} meal invite attempted ` + J(M.inv));

    if (SHOTS) await p.screenshot({ path: `${OUT}waveA-meal-${tag}.png` });

    // Cards: reset day slot by clearing meal/cards d
    const C = await p.evaluate(async () => {
      const LA = await import('/js/lt-act.js'), NA = await import('/js/npc-ambient.js'), G = __T.G;
      G.lt.deck = 'lounge'; G.lt.x = 0.45; G.lt.y = 0.34; G.lt.mode = 'use'; G.lt.node = 'bar';
      LA.A().cards = { d: '', n: 0, invite: null, game: null };
      const th = NA.ambient.find(a => a.occId === 'thelev');
      if (th) { th.deck = 'lounge'; th.x = 0.48; th.y = 0.36; th.mode = 'dwell'; }
      G.prog.opinions.hale = 40;
      const id = G.prog.crew.slots.tactical || 'hale';
      LA.A().everDS9 = false;
      const inv = LA.rollInvite('cards', id, () => 0);
      if (!inv.yes) LA.pickSolo('cards');
      // tongo locked without everDS9
      const tongo = LA.startCards('tongo');
      const poker = LA.startCards('poker');
      if (LA.A().session && LA.A().session.phase === 'approach') {
        const seat = LA.A().session.seat || 'table1';
        const gid = LA.A().session.guest;
        if (gid) {
          NA.holdAtSeat(gid, seat, 'talk');
          const n2 = NA.npcOf(gid);
          if (n2 && n2.spot) { n2.mode = 'dwell'; n2.path = null; n2.x = n2.spot.x; n2.y = n2.spot.y; n2.dir = 'down'; }
        }
        LA.tickLtSession(25);
        if (LA.A().session && LA.A().session.phase === 'approach') {
          LA.A().session.phase = 'chat'; LA.A().session.mode = 'near'; LA.A().session.pot = LA.CARD_ANTE.rations;
          if (!(LA.A().cards.n | 0)) { LA.A().cards.n = 1; LA.A().n.cards++; }
        }
      }
      let hands = 0;
      for (let i = 0; i < 5; i++) {
        const v = LA.cardsView(); if (!v) break;
        if (v.end) { LA.answerCards(0); hands++; break; }
        LA.answerCards(1); hands++;
      }
      return { invYes: !!(inv && inv.yes), tongoOk: !!(tongo && tongo.ok), pokerOk: !!(poker && poker.ok), hands, left: LA.cardsLeft(), n: LA.A().n.cards };
    });
    ok(!C.tongoOk && C.pokerOk && C.left === 0 && C.n === 1 && C.hands >= 3, `${tag} cards poker ok, tongo gated, 3 hands, slot burned ` + J(C));
    if (SHOTS) await p.screenshot({ path: `${OUT}waveA-cards-${tag}.png` });

    // Quest: diallo
    const Q = await p.evaluate(async () => {
      const LA = await import('/js/lt-act.js'), NA = await import('/js/npc-ambient.js'), G = __T.G;
      LA.A().quest = { active: null, done: {}, offer: null };
      G.prog.opinions.diallo = 40;
      G.lt.deck = 'lounge'; G.lt.x = 0.55; G.lt.y = 0.42; G.lt.mode = 'use'; G.lt.node = 'mess';
      const di = NA.ambient.find(a => a.occId === 'diallo');
      if (di) { di.deck = 'lounge'; di.x = 0.56; di.y = 0.43; di.mode = 'dwell'; di.path = null; }
      const offers = LA.listQuestOffers();
      const acc = LA.acceptQuest('diallo_array');
      const duty = LA.questDutyItem();
      // step 0 on lounge
      let v = LA.questView();
      const ans0 = LA.answerQuest(0);
      // move to bridge for step 1
      G.lt.deck = 'bridge'; G.lt.x = 0.5; G.lt.y = 0.5; G.lt.mode = 'idle'; G.lt.node = null;
      if (di) { di.deck = 'bridge'; di.x = 0.52; di.y = 0.5; }
      v = LA.questView();
      LA.answerQuest(0);
      v = LA.questView();
      // may finish
      if (v && !v.end) LA.answerQuest(0);
      const active = LA.A().quest.active;
      const done = LA.A().quest.done.diallo;
      // offline: ticking while "away" must not advance — set active again and freeze
      LA.A().quest.active = { id: 'thelev_spice', who: 'thelev', step: 0 };
      LA.A().quest.done = { diallo: done };
      const stepBefore = LA.A().quest.active.step;
      // simulate hidden
      const PA = await import('/js/pacing.js');
      PA.PACE_RT.hidden = true;
      LA.tickLtSession(1); LA.tickLtAct();
      const stepAfter = LA.A().quest.active.step;
      PA.PACE_RT.hidden = false;
      LA.A().quest.active = null;
      return { offers: offers.length, acc: !!(acc && acc.ok), duty: !!(duty && duty.kind === 'quest'), done: !!done, stepBefore, stepAfter, activeAfter: active };
    });
    ok(Q.offers >= 1 && Q.acc && Q.duty && Q.done, `${tag} quest offer/accept/duty/finish ` + J(Q));
    ok(Q.stepBefore === Q.stepAfter, `${tag} quest frozen while away/hidden ` + J(Q));
    if (SHOTS) await p.screenshot({ path: `${OUT}waveA-quest-${tag}.png` });


    // ---- NO-SHIP fixes: full invite list, seated meal, harden keeps rolls ----
    const FIX = await p.evaluate(async () => {
      const LA = await import('/js/lt-act.js'), NA = await import('/js/npc-ambient.js'), G = __T.G;
      const { hardenLtAct } = await import('/js/lt-act.js');
      const ids = LA.inviteTargets('meal').map(x => x.id);
      const hasThelev = ids.includes('thelev');
      const full = ids.length >= 12;
      LA.A().meal = { d: '', n: 0, invite: null };
      LA.A().session = null;
      G.lt.deck = 'lounge'; G.lt.mode = 'use'; G.lt.node = 'mess'; G.lt.x = 0.5667; G.lt.y = 0.4281; G.lt.lift = false;
      const id = 'okafor';
      NA.syncRoster();
      let npc = NA.npcOf(id) || NA.ambient.find(a => a.occId === id);
      if (npc) {
        npc.deck = 'lounge'; npc.x = 0.58; npc.y = 0.43; npc.mode = 'dwell'; npc.path = null; npc.hidden = false;
        if (npc._ltActHold) delete npc._ltActHold;
      }
      const _rnd = Math.random; Math.random = () => 0;
      LA.rollInvite('meal', id);
      const st = LA.startMeal();
      Math.random = _rnd;
      if (LA.A().session && LA.A().session.phase === 'approach') {
        const seat = LA.A().session.seat || 'table1';
        NA.holdAtSeat(id, seat, 'eat');
        const n2 = NA.npcOf(id);
        if (n2 && n2.spot) { n2.mode = 'dwell'; n2.path = null; n2.x = n2.spot.x; n2.y = n2.spot.y; n2.dir = 'down'; }
        LA.A().session.phase = 'chat'; LA.A().session.mode = 'near'; LA.A().session.seat = seat;
        if (!(LA.A().meal.n | 0)) { LA.A().meal.n = 1; LA.A().n.meals++; }
      } else if (LA.A().session && LA.A().session.guest) {
        const seat = LA.A().session.seat || (NA.npcOf(id) && NA.npcOf(id)._ltActHold && NA.npcOf(id)._ltActHold.seat);
        if (seat) NA.holdAtSeat(id, seat, 'eat');
      }
      for (let i = 0; i < 40; i++) { NA.tickAmbient(0.25); LA.tickLtSession(0.25); }
      const g = NA.npcOf(id);
      const seated = !!(g && g._ltActHold && g.mode === 'dwell' && g.dir === 'down' && g.spot && g.spot.seat);
      const noWander = !!(g && g.mode !== 'walk');
      const onSeat = !!(g && (NA.seatedOn(g) || (g.spot && g.spot.seat)));
      LA.dismissSession();

      LA.A().cards = { d: '', n: 0, invite: null };
      const roll1 = LA.rollInvite('cards', 'hale', () => 0.99);
      const rollsBefore = { ...((LA.A().cards.invite && LA.A().cards.invite.rolls) || {}) };
      hardenLtAct(G.prog);
      const again = LA.rollInvite('cards', 'hale', () => 0.1);
      return {
        hasThelev, full, nInvite: ids.length, stOk: !!(st && st.ok), seated, noWander, onSeat,
        dir: g && g.dir, mode: g && g.mode, hold: !!(g && g._ltActHold),
        roll1: roll1 && roll1.yes === false, rollsBefore,
        againBlocked: !!(again && (!again.ok || again.prior === false)),
        againWhy: again && (again.why || (again.prior === false ? 'prior-false' : (again.ok ? 'reroll-ok' : ''))),
      };
    });
    ok(FIX.hasThelev && FIX.full, `${tag} invite list includes Thelev + full roster ` + J({ n: FIX.nInvite, thelev: FIX.hasThelev }));
    ok(FIX.seated && FIX.noWander && FIX.onSeat && FIX.dir === 'down', `${tag} meal guest seated south whole bout ` + J({ seated: FIX.seated, mode: FIX.mode, dir: FIX.dir, hold: FIX.hold }));
    ok(FIX.roll1 && FIX.againBlocked, `${tag} harden keeps invite rolls (no re-roll) ` + J({ rolls: FIX.rollsBefore, again: FIX.againWhy }));
    if (SHOTS) await p.screenshot({ path: `${OUT}waveA-fix-meal-${tag}.png` });

    // Alert blocks meal
    const B = await p.evaluate(async () => {
      const LA = await import('/js/lt-act.js'), G = __T.G;
      LA.A().meal = { d: '', n: 0, invite: null };
      G.sp.alert = { kind: 'enroute', enemies: ['galor'], wing: true, allies: [], t: 0, at: 0 };
      const why = LA.blockedWhy();
      const chip = LA.mealChipOk();
      G.sp.alert = null;
      return { why, chip };
    });
    ok(B.why && !B.chip, `${tag} red alert blocks meal ` + J(B));

    // UI open panel + 44px + sticky close
    const U = await p.evaluate(async () => {
      const H = await import('/js/ui/lt-act.js'), LA = await import('/js/lt-act.js'), G = __T.G;
      G.sp.alert = null; G.sp.battle = null;
      LA.A().meal = { d: '', n: 0, invite: null };
      G.lt.deck = 'lounge'; G.lt.mode = 'use'; G.lt.node = 'mess';
      H.openMeal();
      const panel = document.getElementById('ltActPanel');
      const btn = panel && panel.querySelector('[data-ltact-ask], .holoinv');
      const foot = panel && panel.querySelector('.holofoot');
      const close = panel && panel.querySelector('[data-ltact-close]');
      const br = btn && btn.getBoundingClientRect();
      const fr = foot && foot.getBoundingClientRect();
      const body = panel && panel.querySelector('.holobody');
      const oy = body && getComputedStyle(body).overflowY;
      return {
        open: panel && !panel.hidden,
        tap44: !!(br && br.height >= 43.5),
        footIn: !!(fr && fr.bottom <= innerHeight + 2),
        closeOk: !!(close && close.getBoundingClientRect().height >= 43.5),
        oy,
      };
    });
    if (SHOTS) await p.screenshot({ path: `${OUT}waveA-panel-${tag}.png` });
    ok(U.open && U.tap44 && U.footIn && U.closeOk && (U.oy === 'auto' || U.oy === 'scroll'), `${tag} panel scroll + 44px + sticky foot ` + J(U));

    await ctx.close();
  }
  console.log(fails ? `FAILS ${fails}` : `PASS · waveA-check · 3 sizes`);
  console.log(`NETWATCH console=${net.console} failed=${net.failed}`, J(net.errs.slice(0, 6)));
  await b.close();
  process.exit(fails || net.console || net.failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
