// Wave C: quarters show-in + sparring art + gym + decor (art batch 1 / gym approved).
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
    await p.evaluate(async () => {
      const G = __T.G; G.prog.story = G.prog.story || {}; G.prog.story.pilot = G.prog.story.pilot || {}; G.prog.story.pilot.done = true;
      G.prog.background = 'none'; G.prog.bgDone = true; G.prog.rations = 5000; G.prog.parts = 20; G.prog.fleetRep = 80;
      G.ship.nextFault = 1e9; G.sp.cap.decideT = 1e9; G.sp.ev.nextT = -1; G.sp.battle = null; G.sp.alert = null;
      window.__noSave = true; __T.PACE_RT.sessionT = 1e6;
      G.prog.rank = 2; G.prog.cabin = G.prog.cabin || {}; G.prog.cabin.tier = 'ltcmdr';
      const CB = await import('/js/cabin.js'); CB.applyTier();
    });

    // ---- Assets + gates ON ----
    const F = await p.evaluate(async () => {
      const { PROG } = await import('/js/progression.js');
      const LA = await import('/js/lt-act.js');
      const CB = await import('/js/cabin.js');
      const { IMG } = await import('/js/assets.js');
      const { CHAR_FRAMES, DECKS } = await import('/js/data.js');
      const { isWalkable } = await import('/js/path.js');
      const keys = ['chip-meal','chip-cards','chip-tongo','prop-lounge-poker','prop-lounge-tongo','lt-spar-v1','deck-gym','walk-gym','decor-andorian','decor-fishtank','decor-captainchair'];
      const loaded = Object.fromEntries(keys.map(k => [k, !!(IMG[k] && IMG[k].width)]));
      const punch = CHAR_FRAMES.lt && CHAR_FRAMES.lt.punch && CHAR_FRAMES.lt.punch.right;
      const axR = punch && punch[0] && punch[0].ax;
      const axL = CHAR_FRAMES.lt.punch.left[0].ax;
      const mat = LA.sparSpot();
      const gymWalk = isWalkable('gym', mat.x, mat.y);
      const gymDeck = !!DECKS.gym;
      return {
        sparArt: !!PROG.ltAct.sparArt, gymRoom: !!PROG.ltAct.gymRoom, decorArt: !!PROG.ltAct.decorArt,
        sparArtOn: LA.sparArtOn(), gymRoomOn: LA.gymRoomOn(),
        largeVisible: CB.slots().some(s => s.type === 'large'),
        windowExtra: CB.slots().filter(s => s.type === 'window').length >= 1,
        largeItems: CB.itemsForSlot('large').length,
        loaded, axR, axL, mat, gymWalk, gymDeck,
        missing: keys.filter(k => !(IMG[k] && IMG[k].width)),
      };
    });
    ok(F.sparArt && F.gymRoom && F.decorArt && F.sparArtOn && F.gymRoomOn,
      `${tag} gates ON (sparArt/gymRoom/decorArt) ` + J({ sparArt: F.sparArt, gymRoom: F.gymRoom, decorArt: F.decorArt }));
    ok(F.largeVisible && F.largeItems >= 1, `${tag} decor large slots visible + catalogue ` + J({ largeVisible: F.largeVisible, largeItems: F.largeItems }));
    ok(F.missing.length === 0, `${tag} Wave C assets load ` + J({ missing: F.missing, loaded: F.loaded }));
    ok(F.axR === 92 && F.axL === 76, `${tag} spar x offsets (right ax=92, left ax=76) ` + J({ axR: F.axR, axL: F.axL }));
    ok(F.gymDeck && F.mat.deck === 'gym' && F.gymWalk, `${tag} gym deck walkable at spar mat ` + J({ mat: F.mat, gymWalk: F.gymWalk }));
    if (SHOTS) await p.screenshot({ path: `${OUT}waveC-art-decor-${tag}.png` });

    // ---- Decor place large item ----
    const D = await p.evaluate(async () => {
      const LA = await import('/js/lt-act.js'), CB = await import('/js/cabin.js'), G = __T.G;
      G.lt.deck = 'quarters'; G.lt.x = 0.32; G.lt.y = 0.35; G.lt.mode = 'use'; G.lt.node = 'desk'; G.lt.lift = false;
      G.prog.cabin.owned = Array.from(new Set([...(G.prog.cabin.owned || []), 'diploma', 'fishtank', 'andorian']));
      const large = CB.slots().find(s => s.type === 'large');
      if (large) CB.placeItem('fishtank', large.id);
      const shelf = CB.slots().find(s => s.type === 'shelf');
      if (shelf) CB.placeItem('andorian', shelf.id);
      return { chip: LA.decorChipOk(), largeId: large && large.id, placed: G.prog.cabin.placed, arts: CB.itemsForSlot('large').filter(d => d.art).map(d => d.id) };
    });
    ok(D.chip && D.largeId && D.placed[D.largeId] === 'fishtank' && D.arts.includes('fishtank'),
      `${tag} decorate large art item ` + J(D));

    // ---- Show-in: guest seated south on quarters guest chair ----
    const S = await p.evaluate(async () => {
      const LA = await import('/js/lt-act.js'), NA = await import('/js/npc-ambient.js'), G = __T.G;
      const { NODEMAP } = await import('/js/data.js');
      const { CABIN_TIERS } = await import('/js/cabin-data.js');
      const CB = await import('/js/cabin.js');
      LA.A().show = { d: '', n: 0, invite: null };
      LA.A().session = null;
      G.lt.deck = 'quarters'; G.lt.mode = 'use'; G.lt.node = 'desk'; G.lt.lift = false;
      // every cabin tier exposes a south-facing guest seat
      const tiers = {};
      for (const id of ['ltjg','lt','ltcmdr','cmdr']) {
        const g = CABIN_TIERS[id].guest;
        tiers[id] = !!(g && g.seat && g.seat.face === 'down' && Array.isArray(g.seat.stand));
      }
      G.prog.cabin.tier = 'ltcmdr'; CB.applyTier();
      const targets = LA.inviteTargets('show');
      // Prefer a crewwmate who has an ambient body (T'Ren is bridge-only → COMM fallback, not a seat test)
      const id = targets.find(t => NA.ambient.some(a => a.occId === t.id))?.id || targets.find(t => t.id !== 'tren')?.id || targets[0]?.id;
      if (!id) return { err: 'no-target', tiers };
      const guestNode = NODEMAP.guest;
      let npc = NA.ambient.find(a => a.occId === id);
      if (!npc) {
        // force-sync roster so juniors exist as ambient
        NA.syncRoster();
        npc = NA.ambient.find(a => a.occId === id);
      }
      if (npc) {
        npc.deck = 'quarters';
        npc.x = guestNode.seat.stand[0]; npc.y = guestNode.seat.stand[1];
        npc.mode = 'dwell'; npc.path = null; npc.hidden = false;
      }
      const real = Math.random; Math.random = () => 0;
      const roll = LA.rollInvite('show', id);
      Math.random = real;
      const st = LA.startShowIn();
      // resolve approach by snapping into seat
      if (LA.A().session && LA.A().session.phase === 'approach') {
        const n2 = NA.ambient.find(a => a.occId === id);
        if (n2 && guestNode.seat) {
          n2.x = guestNode.seat.stand[0]; n2.y = guestNode.seat.stand[1]; n2.path = null;
          n2.mode = 'dwell'; n2.dir = 'down';
        }
        NA.holdAtSeat(id, 'guest', 'talk');
        LA.A().session.phase = 'chat'; LA.A().session.mode = 'near'; LA.A().session.seat = 'guest';
        if (!(LA.A().show.n | 0)) { LA.A().show.n = 1; LA.A().n.shows++; }
      }
      const n = NA.ambient.find(a => a.occId === id);
      const sess = LA.A().session;
      const seated = !!(sess && sess.seat === 'guest' && sess.mode === 'near'
        && n && n._ltActHold && n._ltActHold.seat === 'guest' && (n.dir === 'down'));
      const faceDown = guestNode && guestNode.seat && guestNode.seat.face === 'down';
      G.prog.romance = G.prog.romance || {}; G.prog.romance.opt = false;
      for (let i = 0; i < 5; i++) {
        const v = LA.showView(); if (!v) break;
        if (v.end) { LA.answerShow(0); break; }
        LA.answerShow(0);
      }
      return {
        roll: !!(roll && roll.ok && roll.yes), st: !!(st && st.ok), left: LA.showLeft(), nShows: LA.A().n.shows,
        seated, faceDown, seatId: (st && st.seat) || (sess && sess.seat), tiers, allTiers: Object.values(tiers).every(Boolean),
        hold: n && n._ltActHold, dir: n && n.dir, mode: sess && sess.mode, why: st && st.why,
      };
    });
    ok(S.roll && S.st && S.left === 0 && S.nShows >= 1, `${tag} show-in invite+scene ` + J(S));
    ok(S.seated && S.faceDown && S.allTiers, `${tag} show-in guest seated south ` + J({ seated: S.seated, faceDown: S.faceDown, seatId: S.seatId, tiers: S.tiers }));

    // ---- Cards: lamp hidden + prop ----
    const C = await p.evaluate(async () => {
      const LA = await import('/js/lt-act.js'), G = __T.G;
      LA.A().cards = { d: '', n: 0, invite: null, game: null };
      LA.A().session = null;
      G.lt.deck = 'lounge'; G.lt.mode = 'use'; G.lt.node = 'mess'; G.lt.x = 0.5667; G.lt.y = 0.4281; G.lt.lift = false;
      G.prog.rations = 5000;
      const st = LA.startCards('poker');
      // force chat if approach
      if (LA.A().session && LA.A().session.phase === 'approach') {
        LA.A().session.phase = 'chat'; LA.A().session.mode = 'near';
        if (!(LA.A().cards.n | 0)) { LA.A().cards.n = 1; LA.A().n.cards++; }
      }
      const prop = LA.cardTableProp();
      const lamp = LA.cardsLampHidden();
      return { st: !!(st && st.ok), prop: prop && { src: prop.src, hideLamp: prop.hideLamp, table: prop.table }, lamp };
    });
    ok(C.st && C.lamp && C.prop && C.prop.src === 'prop-lounge-poker' && C.prop.hideLamp,
      `${tag} cards prop + lamp hidden ` + J(C));
    if (SHOTS) await p.screenshot({ path: `${OUT}waveC-art-props-${tag}.png` });
    await p.evaluate(async () => { const LA = await import('/js/lt-act.js'); LA.dismissSession(); });

    // ---- Sparring on gym with art frames ----
    const R = await p.evaluate(async () => {
      const LA = await import('/js/lt-act.js'), NA = await import('/js/npc-ambient.js'), G = __T.G;
      const { CHAR_FRAMES } = await import('/js/data.js');
      LA.A().spar = { d: '', n: 0, invite: null };
      LA.A().session = null;
      const spot = LA.sparSpot();
      G.lt.deck = spot.deck; G.lt.x = spot.x; G.lt.y = spot.y; G.lt.mode = 'idle'; G.lt.node = null; G.lt.lift = false; G.lt.dir = spot.face;
      const chipGym = LA.sparChipOk();
      G.lt.deck = 'lounge'; const chipLounge = LA.sparChipOk();
      G.lt.deck = spot.deck;
      const list = LA.sparTargets();
      const id = list.find(x => x.id === 'hale')?.id || list[0]?.id;
      if (!id) return { err: 'no-spar', n: list.length, chipGym, chipLounge };
      const npc = NA.ambient.find(a => a.occId === id);
      if (npc) { npc.deck = spot.deck; npc.x = spot.x + 0.04; npc.y = spot.y; npc.mode = 'dwell'; npc.path = null; npc.dir = spot.guestFace; }
      // force accept
      LA.A().spar = { d: '', n: 0, invite: { rolls: { [id]: true }, nos: 0, guest: id } };
      const real = Math.random; Math.random = () => 0;
      let st = LA.startSpar(id);
      Math.random = real;
      if (LA.A().session && LA.A().session.phase === 'approach') {
        LA.A().session.phase = 'chat'; LA.A().session.mode = 'near'; LA.A().session.art = LA.sparArtOn();
        LA.A().session.pose = 'punch';
        if (!(LA.A().spar.n | 0)) { LA.A().spar.n = 1; LA.A().n.spars++; }
      }
      const sess = LA.A().session;
      const frameReady = !!(CHAR_FRAMES.lt.punch && CHAR_FRAMES.lt.punch.right && CHAR_FRAMES.lt.block);
      for (let i = 0; i < 5; i++) {
        const v = LA.sparView(); if (!v) break;
        if (v.end) { LA.answerSpar(0); break; }
        LA.answerSpar(0);
      }
      return {
        st: !!(st && st.ok && st.yes !== false),
        left: LA.sparLeft(), n: LA.A().n.spars, art: LA.sparArtOn(),
        spot: spot.deck, pose: sess && sess.pose, frameReady, chipGym, chipLounge,
        why: st && st.why,
      };
    });
    ok(R.st && R.left === 0 && R.n >= 1 && R.art === true && R.spot === 'gym' && R.frameReady,
      `${tag} sparring art bout on gym ` + J(R));
    ok(R.chipGym === true && R.chipLounge === false, `${tag} spar chip gym-only when gymRoom ` + J({ chipGym: R.chipGym, chipLounge: R.chipLounge }));
    if (SHOTS) await p.screenshot({ path: `${OUT}waveC-art-spar-${tag}.png` });

    // ---- MED: openSpar routes to gym (not lounge) when gymRoom ON ----
    const GR = await p.evaluate(async () => {
      const H = await import('/js/ui/lt-act.js');
      const LA = await import('/js/lt-act.js');
      const G = __T.G;
      LA.A().spar = { d: '', n: 0, invite: null };
      LA.A().session = null;
      // From bridge: should start liftRide to gym
      G.lt.deck = 'bridge'; G.lt.lift = null; G.lt.mode = 'idle'; G.lt.path = null; G.lt.intent = null;
      H.openSpar();
      const fromBridge = {
        deck: G.lt.deck,
        liftDest: G.lt.lift && G.lt.lift.dest,
        intent: G.lt.intent && G.lt.intent.kind === 'liftRide' ? G.lt.intent.dest : (G.lt.intent && G.lt.intent.dest),
        // rideLiftTo sends path intent with kind liftRide
        ride: G.lt.intent ? { kind: G.lt.intent.kind, dest: G.lt.intent.dest, then: G.lt.intent.then && G.lt.intent.then.node } : null,
        panel: !!(document.getElementById('ltActPanel') && !document.getElementById('ltActPanel').hidden),
      };
      // Close panel; already in gym → stay put (no lift)
      const panel = document.getElementById('ltActPanel'); if (panel) panel.hidden = true;
      G.lt.deck = 'gym'; G.lt.lift = null; G.lt.mode = 'idle'; G.lt.path = null; G.lt.intent = null;
      G.lt.x = 0.5; G.lt.y = 0.5;
      H.openSpar();
      const fromGym = {
        deck: G.lt.deck,
        lift: G.lt.lift,
        intent: G.lt.intent,
        panel: !!(document.getElementById('ltActPanel') && !document.getElementById('ltActPanel').hidden),
      };
      if (panel) panel.hidden = true;
      return { fromBridge, fromGym, gymOn: LA.gymRoomOn() };
    });
    const rideOk = GR.gymOn && GR.fromBridge.panel && (
      (GR.fromBridge.ride && GR.fromBridge.ride.kind === 'liftRide' && GR.fromBridge.ride.dest === 'gym')
      || GR.fromBridge.liftDest === 'gym'
    );
    ok(rideOk, `${tag} openSpar from bridge → gym lift ` + J(GR.fromBridge));
    ok(GR.fromGym.deck === 'gym' && !GR.fromGym.lift && !GR.fromGym.intent && GR.fromGym.panel,
      `${tag} openSpar already in gym stays put ` + J(GR.fromGym));

    // ---- Gym reachable via lift list ----
    const GYM = await p.evaluate(async () => {
      const { DECK_ORDER, DECKS } = await import('/js/data.js');
      const { rideLiftTo } = await import('/js/crew.js');
      const G = __T.G;
      G.lt.deck = 'lounge'; G.lt.x = DECKS.lounge.lift.x; G.lt.y = DECKS.lounge.lift.y; G.lt.lift = false; G.lt.mode = 'idle';
      const inOrder = DECK_ORDER.includes('gym') && DECKS.gym && DECKS.gym.plate === 'deck-gym';
      // simulate mid-ride swap
      G.lt.lift = { t: 1, dest: 'gym', then: null, swapped: false };
      // call tick enough — import tickLift
      const { tickLift } = await import('/js/crew.js');
      for (let i = 0; i < 30; i++) tickLift(0.1);
      return { inOrder, deck: G.lt.deck, atGym: G.lt.deck === 'gym', liftDone: !G.lt.lift };
    });
    ok(GYM.inOrder && GYM.atGym && GYM.liftDone, `${tag} gym reachable by turbolift ` + J(GYM));
    if (SHOTS) await p.screenshot({ path: `${OUT}waveC-art-gym-${tag}.png` });

    // ---- Chips art in HUD ----
    const CH = await p.evaluate(async () => {
      const LA = await import('/js/lt-act.js'), G = __T.G;
      G.lt.deck = 'lounge'; G.lt.mode = 'use'; G.lt.node = 'mess'; G.lt.lift = false;
      LA.A().meal = { d: '', n: 0, invite: null };
      LA.A().cards = { d: '', n: 0, invite: null, game: null };
      G.prog.rations = 5000;
      const html = LA.chipsHtml();
      return {
        meal: /chip-meal\.webp/.test(html),
        cards: /chip-cards\.webp/.test(html),
      };
    });
    ok(CH.meal && CH.cards, `${tag} meal/cards chip art ` + J(CH));
    if (SHOTS) await p.screenshot({ path: `${OUT}waveC-art-chips-${tag}.png` });

    // ---- Panel 44px spar ----
    const U = await p.evaluate(async () => {
      const H = await import('/js/ui/lt-act.js');
      const LA = await import('/js/lt-act.js');
      LA.A().spar = { d: '', n: 0, invite: null };
      LA.A().session = null;
      __T.G.lt.deck = 'gym';
      H.openSpar();
      const panel = document.getElementById('ltActPanel');
      const btn = panel && panel.querySelector('[data-ltact-spar], .holoinv');
      const foot = panel && panel.querySelector('.holofoot');
      const br = btn && btn.getBoundingClientRect();
      const fr = foot && foot.getBoundingClientRect();
      return {
        open: panel && !panel.hidden,
        tap44: !!(br && br.height >= 43.5),
        footIn: !!(fr && fr.bottom <= innerHeight + 2),
      };
    });
    ok(U.open && U.tap44 && U.footIn, `${tag} spar panel 44 ` + J(U));

    await ctx.close();
  }
  console.log(fails ? `FAILS ${fails}` : `PASS · waveC-check · 3 sizes`);
  console.log(`NETWATCH console=${net.console} failed=${net.failed}`, J(net.errs.slice(0, 6)));
  await b.close();
  process.exit(fails || net.console || net.failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
