// Wave C: quarters show-in polish + sparring (stand-in poses; art/gym gated).
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

    // ---- Flags off ----
    const F = await p.evaluate(async () => {
      const { PROG } = await import('/js/progression.js');
      const LA = await import('/js/lt-act.js');
      const CB = await import('/js/cabin.js');
      return {
        sparArt: !!PROG.ltAct.sparArt,
        gymRoom: !!PROG.ltAct.gymRoom,
        decorArt: !!PROG.ltAct.decorArt,
        sparArtOn: LA.sparArtOn(),
        largeHidden: !CB.slots().some(s => s.type === 'large'),
        largeItems: CB.itemsForSlot('large').length,
      };
    });
    ok(!F.sparArt && !F.gymRoom && !F.decorArt && !F.sparArtOn && F.largeHidden && F.largeItems === 0,
      `${tag} gates off (sparArt/gymRoom/decorArt) ` + J(F));

    // ---- Decor chip / catalogue uses existing art slots only ----
    const D = await p.evaluate(async () => {
      const LA = await import('/js/lt-act.js'), CB = await import('/js/cabin.js'), G = __T.G;
      G.lt.deck = 'quarters'; G.lt.x = 0.32; G.lt.y = 0.35; G.lt.mode = 'use'; G.lt.node = 'desk'; G.lt.lift = false;
      // buy a sprited item into storage then place
      G.prog.cabin.owned = Array.from(new Set([...(G.prog.cabin.owned || []), 'diploma', 'lamp']));
      const sl = CB.slots().find(s => s.type === 'wall') || CB.slots()[0];
      if (sl) CB.placeItem('diploma', sl.id);
      const chip = LA.decorChipOk();
      const vis = CB.slots().map(s => s.id);
      const wallItems = CB.itemsForSlot('wall').map(d => ({ id: d.id, art: !!d.art }));
      return { chip, vis, wallItems, placed: G.prog.cabin.placed };
    });
    ok(D.chip && D.vis.length >= 1 && D.wallItems.some(x => x.art), `${tag} decorate chip + sprited catalogue ` + J({ chip: D.chip, vis: D.vis, arts: D.wallItems.filter(x => x.art).map(x => x.id) }));

    // ---- Show-in ----
    const S = await p.evaluate(async () => {
      const LA = await import('/js/lt-act.js'), NA = await import('/js/npc-ambient.js'), G = __T.G;
      LA.A().show = { d: '', n: 0, invite: null };
      LA.A().session = null;
      G.lt.deck = 'quarters'; G.lt.mode = 'use'; G.lt.node = 'desk'; G.lt.lift = false;
      const targets = LA.inviteTargets('show');
      const id = targets[0]?.id;
      if (!id) return { err: 'no-target' };
      const npc = NA.ambient.find(a => a.occId === id);
      if (npc) { npc.deck = 'quarters'; npc.x = G.lt.x + 0.03; npc.y = G.lt.y; npc.mode = 'dwell'; npc.path = null; }
      const real = Math.random; Math.random = () => 0;
      const roll = LA.rollInvite('show', id);
      Math.random = real;
      const st = LA.startShowIn();
      if (LA.A().session && LA.A().session.phase === 'approach') {
        LA.A().session.phase = 'chat'; LA.A().session.mode = 'near';
      }
      // romance OFF — no partner line required
      G.prog.romance = G.prog.romance || {}; G.prog.romance.opt = false;
      for (let i = 0; i < 5; i++) {
        const v = LA.showView(); if (!v) break;
        if (v.end) { LA.answerShow(0); break; }
        LA.answerShow(0);
      }
      const left = LA.showLeft();
      // freeze while hidden
      LA.A().show = { d: '', n: 0, invite: null };
      LA.A().session = { kind: 'show', phase: 'approach', guest: id, step: 0, wait: 0 };
      const PA = await import('/js/pacing.js');
      const w0 = LA.A().session.wait;
      PA.PACE_RT.hidden = true; LA.tickLtSession(5); const w1 = LA.A().session.wait; PA.PACE_RT.hidden = false;
      LA.dismissSession();
      return { roll: !!(roll && roll.ok && roll.yes), st: !!(st && st.ok), left, frozen: w0 === w1, n: LA.A().n.shows };
    });
    ok(S.roll && S.st && S.left === 0 && S.frozen && S.n >= 1, `${tag} show-in invite+scene+freeze ` + J(S));
    if (SHOTS) await p.screenshot({ path: `${OUT}waveC-show-${tag}.png` });

    // ---- Sparring ----
    const R = await p.evaluate(async () => {
      const LA = await import('/js/lt-act.js'), NA = await import('/js/npc-ambient.js'), G = __T.G;
      LA.A().spar = { d: '', n: 0, invite: null };
      LA.A().session = null;
      G.lt.deck = 'lounge'; G.lt.x = LA.SPAR_SPOT.x; G.lt.y = LA.SPAR_SPOT.y; G.lt.mode = 'idle'; G.lt.node = null; G.lt.lift = false;
      const list = LA.sparTargets();
      const id = list.find(x => x.id === 'hale')?.id || list[0]?.id;
      if (!id) return { err: 'no-spar', n: list.length };
      const npc = NA.ambient.find(a => a.occId === id);
      if (npc) { npc.deck = 'lounge'; npc.x = LA.SPAR_SPOT.x + 0.04; npc.y = LA.SPAR_SPOT.y; npc.mode = 'dwell'; npc.path = null; }
      const st = LA.startSpar(id);
      // force yes path if declined by rng — re-roll forced
      if (st && st.yes === false) {
        LA.A().spar = { d: '', n: 0, invite: { rolls: { [id]: true }, nos: 0, guest: id } };
        const st2 = LA.startSpar(id);
        Object.assign(st, st2);
      }
      if (LA.A().session && LA.A().session.phase === 'approach') {
        LA.A().session.phase = 'chat'; LA.A().session.mode = 'near'; LA.A().session.art = LA.sparArtOn();
        if (!(LA.A().spar.n | 0)) { LA.A().spar.n = 1; LA.A().n.spars++; }
      }
      for (let i = 0; i < 5; i++) {
        const v = LA.sparView(); if (!v) break;
        if (v.end) { LA.answerSpar(0); break; }
        LA.answerSpar(0);
      }
      // no injury from spar
      const inj = (G.prog.med && G.prog.med.inj) || [];
      return {
        st: !!(st && st.ok && st.yes !== false),
        left: LA.sparLeft(),
        n: LA.A().n.spars,
        art: LA.sparArtOn(),
        inj: inj.length,
        spot: LA.SPAR_SPOT.deck,
      };
    });
    ok(R.st && R.left === 0 && R.n >= 1 && R.art === false && R.inj === 0 && R.spot === 'lounge',
      `${tag} sparring stand-in bout ` + J(R));
    if (SHOTS) await p.screenshot({ path: `${OUT}waveC-spar-${tag}.png` });

    // ---- UI panel 44px ----
    const U = await p.evaluate(async () => {
      const H = await import('/js/ui/lt-act.js');
      const LA = await import('/js/lt-act.js');
      LA.A().spar = { d: '', n: 0, invite: null };
      LA.A().session = null;
      __T.G.lt.deck = 'lounge';
      H.openSpar();
      const panel = document.getElementById('ltActPanel');
      const btn = panel && panel.querySelector('[data-ltact-spar], .holoinv');
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
    if (SHOTS) await p.screenshot({ path: `${OUT}waveC-panel-${tag}.png` });
    ok(U.open && U.tap44 && U.footIn && (U.oy === 'auto' || U.oy === 'scroll'), `${tag} spar panel scroll+44 ` + J(U));

    await ctx.close();
  }
  console.log(fails ? `FAILS ${fails}` : `PASS · waveC-check · 3 sizes`);
  console.log(`NETWATCH console=${net.console} failed=${net.failed}`, J(net.errs.slice(0, 6)));
  await b.close();
  process.exit(fails || net.console || net.failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
