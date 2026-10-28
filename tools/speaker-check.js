// Oct 27: in-person dialogue waits for speaker arrival; COMM fallback ~8 s sim if blocked.
// Asserts: no in-person modal/line before arrival; forced-blocked → COMM by ~8 s; freeze while idle-paused.
// Exit paths (dismiss / battle / timeout / finish / reload / deck-change / injured) clear walk/chat and return to post.
const { chromium } = require('playwright-core');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const OUT = path.resolve(__dirname, '..', 'shots') + '/';
const SHOTS = process.env.SHOTS === '1';
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
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
    await ctx.addInitScript(() => { window.__TENACITY_SKIP_NAME = true; window.__TENACITY_NO_IDLE = true; });
    const p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error') { net.console++; net.errs.push(m.text()); } });
    p.on('requestfailed', r => { net.failed++; net.errs.push('req ' + r.url()); });
    await p.goto(BASE + '?reset=1');
    await p.waitForFunction(() => window.__T && document.querySelector('#loading')?.classList.contains('done'), null, { timeout: 60000 });
    await sleep(400);
    await p.evaluate(() => { window.__noSave = true; const G = __T.G; G.prog.story = G.prog.story || {}; G.prog.story.pilot = G.prog.story.pilot || {}; G.prog.story.pilot.done = true; G.ship.nextFault = 1e9; G.sp.cap.decideT = 1e9; G.sp.ev.nextT = -1; G.sp.battle = null; });

    // ---- A: approach from across the lounge — no in-person dialogue until near ----
    const A = await p.evaluate(async () => {
      const CT = await import('/js/crew-talk.js'), IN = await import('/js/insight.js'), NA = await import('/js/npc-ambient.js'), H = await import('/js/ui/hud.js'), G = __T.G;
      await CT.readyTalk();
      IN.dismissBeat(); IN.dismissChat();
      G.lt.deck = 'lounge'; G.lt.x = 0.55; G.lt.y = 0.42; G.lt.mode = 'use'; G.lt.node = 'mess'; G.lt.lift = false;
      NA.syncRoster();
      const th = NA.ambient.find(a => a.occId === 'thelev');
      if (!th) return { err: 'no-thelev' };
      th.deck = 'lounge'; th.x = 0.70; th.y = 0.55; th.mode = 'dwell'; th.path = null; th.next = null;   // lounge window spot, far from mess
      const before = CT.speakerPresence('thelev');
      IN.startBeat('thelev');
      const pend0obj = IN.pending();
      const pend0 = pend0obj && pend0obj.mode;   // snapshot string now (object is live and mutates on tick)
      const raw0 = G.prog.insight.beat.pending && G.prog.insight.beat.pending.mode;
      H.openBeat();   // must NOT open dialogue while approaching
      const panel0 = (() => { const el = document.querySelector('#beatPanel'); return { hidden: !el || el.hidden, hasQ: !!(el && !el.hidden && el.querySelector('.mline') && el.querySelector('.brep')) }; })();
      const view0 = IN.beatView();
      // advance sim until near or timeout
      const snap = [];
      for (let i = 0; i < 400; i++) {   // up to ~20 s at 0.05
        NA.tickAmbient ? NA.tickAmbient(0.05) : __T.tickAmbient(0.05); IN.tickBeats(0.05);
        const pend = IN.pending(), pr = CT.speakerPresence('thelev');
        if (i % 20 === 0) snap.push({ i, mode: pend && pend.mode, dist: pr.dist != null ? Math.round(pr.dist) : null, wait: pend && Math.round((pend.wait || 0) * 10) / 10 });
        if (pend && pend.mode === 'near') break;
        if (pend && pend.mode === 'comm') break;
      }
      const pend1 = IN.pending();
      H.openBeat();
      const panel1 = (() => { const el = document.querySelector('#beatPanel'); return { hidden: !el || el.hidden, open: el && !el.hidden, comm: !!(el && el.querySelector('.commtag, .bhd.comm')), hasQ: !!(el && !el.hidden && el.querySelector('.brep')) }; })();
      return { before: before.mode, pend0, raw0, panel0, view0Mode: view0 && view0.mode, view0Q: !!(view0 && view0.q), snap, pend1: pend1 && pend1.mode, panel1, nearPx: CT.NEAR_PX, timeout: CT.APPROACH_TIMEOUT };
    });
    if (SHOTS) await p.screenshot({ path: `${OUT}talk-approach-${tag}.png` });
    ok(A.before === 'approach', `${tag} A starts far enough to approach ` + J(A.before));
    ok(A.pend0 === 'approaching', `${tag} A pending is approaching (not near yet) ` + J({ pend0: A.pend0, raw0: A.raw0, view: A.view0Mode }));
    ok(A.panel0.hidden && !A.panel0.hasQ, `${tag} A no in-person modal before arrival ` + J(A.panel0));
    ok(!A.view0Q && A.view0Mode === 'approaching', `${tag} A beatView has no dialogue pre-arrival ` + J({ m: A.view0Mode, q: A.view0Q }));
    ok(A.pend1 === 'near' || A.pend1 === 'comm', `${tag} A resolves to near or comm ` + J(A.pend1));
    if (A.pend1 === 'near') ok(A.panel1.open && A.panel1.hasQ && !A.panel1.comm, `${tag} A after arrival in-person panel ` + J(A.panel1));

    // ---- B: forced blocked approach → COMM by ~8 s sim ----
    const B = await p.evaluate(async () => {
      const CT = await import('/js/crew-talk.js'), IN = await import('/js/insight.js'), NA = await import('/js/npc-ambient.js'), H = await import('/js/ui/hud.js'), G = __T.G;
      IN.dismissBeat(); IN.dismissChat();
      document.querySelector('#beatPanel').hidden = true;
      G.lt.deck = 'lounge'; G.lt.x = 0.55; G.lt.y = 0.42; G.lt.mode = 'use'; G.lt.node = 'mess'; G.lt.lift = false;
      const th = NA.ambient.find(a => a.occId === 'thelev');
      th.deck = 'lounge'; th.x = 0.20; th.y = 0.55; th.mode = 'dwell'; th.path = null;
      // Monkey-patch: keep presence returning approach but never near, and kill path progress
      const real = CT.speakerPresence;
      const fake = id => {
        if (id !== 'thelev') return real(id);
        const r = real(id);
        if (r.mode === 'near') return { mode: 'approach', dist: 200, npc: th, spot: { x: G.lt.x, y: G.lt.y }, path: [[G.lt.x, G.lt.y]] };
        return r.mode === 'approach' ? r : { mode: 'approach', dist: 200, npc: th, spot: { x: G.lt.x, y: G.lt.y }, path: [[0.3, 0.5], [G.lt.x, G.lt.y]] };
      };
      // Override via beat record wait only: start approaching then freeze NPC and tick wait
      IN.startBeat('thelev');
      let pend = IN.pending();
      if (pend.mode === 'near') {
        // shove them away and force approaching state
        th.x = 0.18; th.y = 0.58; th.path = null; th.mode = 'dwell';
        pend.mode = 'approaching'; pend.wait = 0;
        CT.approachSpeaker('thelev');
      }
      // Block arrival: teleport NPC back every tick + zero path progress conceptually by resetting position
      const waits = [];
      for (let t = 0; t < 12; t += 0.25) {
        th.x = 0.18; th.y = 0.58; th.path = null; th.mode = 'dwell'; th.next = null;   // stuck / never arrive
        // prevent speakerPresence from flipping to near
        const dist = Math.hypot((th.x - G.lt.x) * 960, (th.y - G.lt.y) * 640);
        if (dist <= CT.NEAR_PX) { th.x = 0.15; th.y = 0.60; }
        IN.tickBeats(0.25);
        pend = IN.pending();
        waits.push({ t: Math.round(t * 100) / 100, wait: pend && Math.round((pend.wait || 0) * 100) / 100, mode: pend && pend.mode });
        if (pend && pend.mode === 'comm') break;
        if (!pend) break;
      }
      H.openBeat();
      const panel = (() => { const el = document.querySelector('#beatPanel'); return { open: el && !el.hidden, comm: !!(el && el.querySelector('.commtag, .bhd.comm')), hasQ: !!(el && !el.hidden && el.querySelector('.brep')) }; })();
      const view = IN.beatView();
      return { final: pend && pend.mode, waits, panel, viewMode: view && view.mode, timeout: CT.APPROACH_TIMEOUT };
    });
    if (SHOTS) await p.screenshot({ path: `${OUT}talk-timeout-comm-${tag}.png` });
    ok(B.final === 'comm', `${tag} B blocked → COMM ` + J({ final: B.final, waits: B.waits.slice(-4) }));
    const hit = (B.waits || []).find(x => x.mode === 'comm');
    ok(hit && hit.wait >= 7.5 && hit.wait <= 9.5, `${tag} B COMM around 8 s sim ` + J(hit));
    ok(B.panel.comm && B.panel.hasQ, `${tag} B COMM panel shows dialogue ` + J(B.panel));

    // ---- C: freeze while "hidden" — wait budget does not burn ----
    const C = await p.evaluate(async () => {
      const CT = await import('/js/crew-talk.js'), IN = await import('/js/insight.js'), NA = await import('/js/npc-ambient.js'), PA = await import('/js/pacing.js'), G = __T.G;
      IN.dismissBeat(); IN.dismissChat();
      document.querySelector('#beatPanel').hidden = true;
      G.lt.deck = 'lounge'; G.lt.x = 0.55; G.lt.y = 0.42; G.lt.mode = 'use'; G.lt.node = 'mess';
      const th = NA.ambient.find(a => a.occId === 'thelev');
      th.deck = 'lounge'; th.x = 0.18; th.y = 0.58; th.mode = 'dwell'; th.path = null;
      IN.startBeat('thelev');
      let pend = IN.pending();
      if (pend.mode !== 'approaching') { pend.mode = 'approaching'; pend.wait = 0; }
      PA.PACE_RT.hidden = true;
      for (let i = 0; i < 40; i++) { th.x = 0.18; th.y = 0.58; IN.tickBeats(0.25); }
      const waitHidden = IN.pending() && IN.pending().wait;
      PA.PACE_RT.hidden = false;
      for (let i = 0; i < 8; i++) { th.x = 0.18; th.y = 0.58; IN.tickBeats(0.25); }
      const waitAfter = IN.pending() && IN.pending().wait;
      PA.PACE_RT.hidden = false;
      return { mode: IN.pending() && IN.pending().mode, waitHidden, waitAfter };
    });
    ok(C.waitHidden === 0 || C.waitHidden < 0.05, `${tag} C wait frozen while hidden ` + J(C));
    ok(C.waitAfter > 1.5, `${tag} C wait resumes when present ` + J(C));

    // ---- D: already-near still opens immediately ----
    const D = await p.evaluate(async () => {
      const CT = await import('/js/crew-talk.js'), IN = await import('/js/insight.js'), NA = await import('/js/npc-ambient.js'), H = await import('/js/ui/hud.js'), G = __T.G;
      IN.dismissBeat(); IN.dismissChat();
      G.lt.deck = 'lounge'; G.lt.x = 0.55; G.lt.y = 0.42; G.lt.mode = 'use'; G.lt.node = 'mess';
      const th = NA.ambient.find(a => a.occId === 'thelev');
      th.deck = 'lounge'; th.x = 0.57; th.y = 0.43; th.mode = 'dwell'; th.path = null;
      const pr = CT.speakerPresence('thelev');
      IN.startBeat('thelev');
      const pend = IN.pending();
      H.openBeat();
      const panel = (() => { const el = document.querySelector('#beatPanel'); return { open: el && !el.hidden, comm: !!(el && el.querySelector('.commtag, .bhd.comm')), hasQ: !!(el && !el.hidden && el.querySelector('.brep')) }; })();
      return { pr: pr.mode, pend: pend && pend.mode, panel };
    });
    if (SHOTS) await p.screenshot({ path: `${OUT}talk-near-${tag}.png` });
    ok(D.pr === 'near' && D.pend === 'near' && D.panel.open && D.panel.hasQ && !D.panel.comm, `${tag} D already-near opens in-person ` + J(D));

    // helper shape: walker must not be left on talk-approach (walk/chat or walk/crewTalk)
    const walkerClean = (w) => w && !w._talkApproach && w.next !== 'chat' && w.next !== 'crewTalk' && (w.mode === 'dwell' || (w.mode === 'walk' && w.next === 'dwell') || w.mode === 'aside');

    // ---- E: dismiss mid-approach clears walk and sends to duty post ----
    const E = await p.evaluate(async () => {
      const CT = await import('/js/crew-talk.js'), IN = await import('/js/insight.js'), NA = await import('/js/npc-ambient.js'), G = __T.G;
      IN.dismissBeat(); IN.dismissChat();
      document.querySelector('#beatPanel').hidden = true;
      G.lt.deck = 'lounge'; G.lt.x = 0.55; G.lt.y = 0.42; G.lt.mode = 'use'; G.lt.node = 'mess'; G.lt.lift = false; G.sp.battle = null;
      const th = NA.ambient.find(a => a.occId === 'thelev');
      th.deck = 'lounge'; th.x = 0.70; th.y = 0.55; th.mode = 'dwell'; th.path = null; th.next = null; delete th._talkApproach;
      IN.startBeat('thelev');
      let pend = IN.pending();
      if (pend.mode !== 'approaching') { th.x = 0.70; th.y = 0.55; pend.mode = 'approaching'; pend.wait = 0; CT.approachSpeaker('thelev'); }
      const mid = { mode: th.mode, next: th.next, hasMark: !!th._talkApproach };
      IN.dismissBeat();
      const post = th.cfg.spots[0];
      return {
        mid, after: { mode: th.mode, next: th.next, hasMark: !!th._talkApproach, path: !!th.path, spotId: th.spot && th.spot.id, postId: post && post.id, targetNearPost: !!(th.target && post && Math.hypot((th.target.x - (post.x || NA.resolveSpot ? 0 : 0)) , 0) >= 0) },
        clean: !th._talkApproach && th.next !== 'chat' && th.next !== 'crewTalk' && (th.mode === 'dwell' || (th.mode === 'walk' && th.next === 'dwell')),
        headingPost: th.mode === 'walk' && th.next === 'dwell' && th.spot && post && th.spot.id === post.id,
        pend: IN.pending(),
      };
    });
    ok(E.mid.hasMark || E.mid.next === 'crewTalk' || E.mid.next === 'chat' || E.mid.mode === 'walk', `${tag} E was approaching before dismiss ` + J(E.mid));
    ok(E.clean && !E.pend, `${tag} E dismiss clears approach walk ` + J(E));
    ok(E.headingPost || (E.after.mode === 'dwell'), `${tag} E heads to duty post ` + J(E.after));

    // ---- F: battle mid-approach → COMM + battle station ----
    const F = await p.evaluate(async () => {
      const CT = await import('/js/crew-talk.js'), IN = await import('/js/insight.js'), NA = await import('/js/npc-ambient.js'), G = __T.G;
      IN.dismissBeat(); IN.dismissChat();
      G.lt.deck = 'lounge'; G.lt.x = 0.55; G.lt.y = 0.42; G.lt.mode = 'use'; G.lt.node = 'mess'; G.lt.lift = false; G.sp.battle = null;
      const th = NA.ambient.find(a => a.occId === 'thelev');
      th.deck = 'lounge'; th.x = 0.70; th.y = 0.55; th.mode = 'dwell'; th.path = null; th.next = null; delete th._talkApproach;
      IN.startBeat('thelev');
      let pend = IN.pending();
      if (pend.mode !== 'approaching') { pend.mode = 'approaching'; pend.wait = 0; CT.approachSpeaker('thelev'); }
      G.sp.battle = { id: 'test', t: 30 };   // force battle
      IN.tickBeats(0.05);
      pend = IN.pending();
      const post = th.cfg.spots[0];
      return {
        pend: pend && pend.mode, reason: pend && pend.reason,
        clean: !th._talkApproach && th.next !== 'chat' && th.next !== 'crewTalk' && (th.mode === 'dwell' || (th.mode === 'walk' && th.next === 'dwell')),
        station: th.mode === 'walk' && th.next === 'dwell' && th.spot && post && th.spot.id === post.id,
        next: th.next, mode: th.mode, spotId: th.spot && th.spot.id, postId: post && post.id,
      };
    });
    ok(F.pend === 'comm' && F.reason === 'battle', `${tag} F battle → COMM ` + J(F));
    ok(F.clean && F.station, `${tag} F walk cleared; heads to battle station ` + J(F));
    await p.evaluate(() => { __T.G.sp.battle = null; });

    // ---- G: timeout COMM clears walk / returns to post ----
    const Gcase = await p.evaluate(async () => {
      const CT = await import('/js/crew-talk.js'), IN = await import('/js/insight.js'), NA = await import('/js/npc-ambient.js'), G = __T.G;
      IN.dismissBeat(); IN.dismissChat();
      G.lt.deck = 'lounge'; G.lt.x = 0.55; G.lt.y = 0.42; G.lt.mode = 'use'; G.lt.node = 'mess'; G.sp.battle = null;
      const th = NA.ambient.find(a => a.occId === 'thelev');
      th.deck = 'lounge'; th.x = 0.18; th.y = 0.58; th.mode = 'dwell'; th.path = null; th.next = null; delete th._talkApproach;
      IN.startBeat('thelev');
      let pend = IN.pending();
      if (pend.mode !== 'approaching') { pend.mode = 'approaching'; pend.wait = 0; CT.approachSpeaker('thelev'); }
      for (let t = 0; t < 12; t += 0.25) {
        th.x = 0.18; th.y = 0.58; th.path = null; th.mode = 'dwell'; // stuck
        // keep mark so endApproach has something to clear — re-set approach walk each tick then wipe progress
        if (!th._talkApproach) CT.approachSpeaker('thelev');
        th.x = 0.18; th.y = 0.58; th.path = null; th.mode = 'dwell';
        IN.tickBeats(0.25);
        pend = IN.pending();
        if (pend && pend.mode === 'comm') break;
      }
      const post = th.cfg.spots[0];
      return {
        pend: pend && pend.mode, reason: pend && pend.reason,
        clean: !th._talkApproach && th.next !== 'chat' && th.next !== 'crewTalk' && (th.mode === 'dwell' || (th.mode === 'walk' && th.next === 'dwell')),
        headingPost: (th.mode === 'walk' && th.next === 'dwell' && th.spot && post && th.spot.id === post.id) || th.mode === 'dwell',
        next: th.next, mode: th.mode,
      };
    });
    ok(Gcase.pend === 'comm' && Gcase.reason === 'timeout', `${tag} G timeout → COMM ` + J(Gcase));
    ok(Gcase.clean && Gcase.headingPost, `${tag} G timeout clears walk; to post ` + J(Gcase));

    // ---- H: answer/finish clears approach leftovers ----
    const H = await p.evaluate(async () => {
      const CT = await import('/js/crew-talk.js'), IN = await import('/js/insight.js'), NA = await import('/js/npc-ambient.js'), G = __T.G;
      IN.dismissBeat(); IN.dismissChat();
      G.lt.deck = 'lounge'; G.lt.x = 0.55; G.lt.y = 0.42; G.lt.mode = 'use'; G.lt.node = 'mess'; G.sp.battle = null;
      const th = NA.ambient.find(a => a.occId === 'thelev');
      th.deck = 'lounge'; th.x = 0.57; th.y = 0.43; th.mode = 'dwell'; th.path = null; th.next = null; delete th._talkApproach;
      IN.startBeat('thelev');
      const pend = IN.pending();
      // force near settle leftovers then answer
      th._talkApproach = { lx: G.lt.x, ly: G.lt.y, deck: 'lounge' }; th.next = 'crewTalk'; th.mode = 'walk'; th.path = [[0.57, 0.43]];
      if (pend) pend.mode = 'near';
      const view = IN.beatView();
      const j = view && view.replies && view.replies[0] ? view.replies[0].j : 0;
      IN.answerBeat(j);
      const post = th.cfg.spots[0];
      return {
        pend: IN.pending(),
        clean: !th._talkApproach && th.next !== 'chat' && th.next !== 'crewTalk' && (th.mode === 'dwell' || (th.mode === 'walk' && th.next === 'dwell')),
        headingPost: (th.mode === 'walk' && th.next === 'dwell' && th.spot && post && th.spot.id === post.id) || th.mode === 'dwell',
        next: th.next, mode: th.mode,
      };
    });
    ok(!H.pend && H.clean && H.headingPost, `${tag} H finish clears walk; to post ` + J(H));

    // ---- I: scrubSavedApproach on reload mid-approach ----
    const I = await p.evaluate(async () => {
      const CT = await import('/js/crew-talk.js'), IN = await import('/js/insight.js'), NA = await import('/js/npc-ambient.js'), G = __T.G;
      IN.dismissBeat(); IN.dismissChat();
      G.lt.deck = 'lounge'; G.lt.x = 0.55; G.lt.y = 0.42; G.lt.mode = 'use'; G.lt.node = 'mess';
      const th = NA.ambient.find(a => a.occId === 'thelev');
      th.deck = 'lounge'; th.x = 0.70; th.y = 0.55; th.mode = 'dwell'; th.path = null;
      IN.startBeat('thelev');
      let pend = IN.pending();
      if (pend.mode !== 'approaching') { pend.mode = 'approaching'; pend.wait = 1.5; CT.approachSpeaker('thelev'); }
      // simulate saved mid-approach then scrub (as readyTalk does on boot)
      CT.scrubSavedApproach();
      pend = IN.pending();
      const post = th.cfg.spots[0];
      return {
        pend: pend && pend.mode, reason: pend && pend.reason,
        clean: !th._talkApproach && th.next !== 'chat' && th.next !== 'crewTalk' && (th.mode === 'dwell' || (th.mode === 'walk' && th.next === 'dwell')),
        headingPost: (th.mode === 'walk' && th.next === 'dwell' && th.spot && post && th.spot.id === post.id) || th.mode === 'dwell',
      };
    });
    ok(I.pend === 'comm' && I.reason === 'reload', `${tag} I reload scrub → COMM ` + J(I));
    ok(I.clean && I.headingPost, `${tag} I reload clears walk; to post ` + J(I));

    // ---- J: skip / Lt leaves deck mid-approach ----
    const Jcase = await p.evaluate(async () => {
      const CT = await import('/js/crew-talk.js'), IN = await import('/js/insight.js'), NA = await import('/js/npc-ambient.js'), G = __T.G;
      IN.dismissBeat(); IN.dismissChat();
      G.lt.deck = 'lounge'; G.lt.x = 0.55; G.lt.y = 0.42; G.lt.mode = 'use'; G.lt.node = 'mess'; G.sp.battle = null;
      const th = NA.ambient.find(a => a.occId === 'thelev');
      th.deck = 'lounge'; th.x = 0.70; th.y = 0.55; th.mode = 'dwell'; th.path = null; th.next = null; delete th._talkApproach;
      IN.startBeat('thelev');
      let pend = IN.pending();
      if (pend.mode !== 'approaching') { pend.mode = 'approaching'; pend.wait = 0; CT.approachSpeaker('thelev'); }
      G.lt.deck = 'bridge'; G.lt.lift = false;   // Lt left the deck
      IN.tickBeats(0.05);
      pend = IN.pending();
      const post = th.cfg.spots[0];
      return {
        pend: pend && pend.mode,
        clean: !th._talkApproach && th.next !== 'chat' && th.next !== 'crewTalk' && (th.mode === 'dwell' || (th.mode === 'walk' && th.next === 'dwell')),
        headingPost: (th.mode === 'walk' && th.next === 'dwell' && th.spot && post && th.spot.id === post.id) || th.mode === 'dwell',
        next: th.next, mode: th.mode, reason: pend && pend.reason,
      };
    });
    ok(Jcase.pend === 'comm', `${tag} J Lt deck-change → COMM ` + J(Jcase));
    ok(Jcase.clean && Jcase.headingPost, `${tag} J deck-change clears walk; to post ` + J(Jcase));

    // ---- K: injured mid-approach ----
    const K = await p.evaluate(async () => {
      const CT = await import('/js/crew-talk.js'), IN = await import('/js/insight.js'), NA = await import('/js/npc-ambient.js'), G = __T.G;
      IN.dismissBeat(); IN.dismissChat();
      G.lt.deck = 'lounge'; G.lt.x = 0.55; G.lt.y = 0.42; G.lt.mode = 'use'; G.lt.node = 'mess'; G.lt.lift = false; G.sp.battle = null;
      G.prog.med = G.prog.med || { inj: [] };
      const th = NA.ambient.find(a => a.occId === 'thelev');
      th.deck = 'lounge'; th.x = 0.70; th.y = 0.55; th.mode = 'dwell'; th.path = null; th.next = null; delete th._talkApproach;
      IN.startBeat('thelev');
      let pend = IN.pending();
      if (pend.mode !== 'approaching') { pend.mode = 'approaching'; pend.wait = 0; CT.approachSpeaker('thelev'); }
      G.prog.med.inj = [{ id: 'thelev', kind: 'sprain' }];
      IN.tickBeats(0.05);
      pend = IN.pending();
      const post = th.cfg.spots[0];
      const out = {
        pend: pend && pend.mode, reason: pend && pend.reason,
        clean: !th._talkApproach && th.next !== 'chat' && th.next !== 'crewTalk' && (th.mode === 'dwell' || (th.mode === 'walk' && th.next === 'dwell')),
        headingPost: (th.mode === 'walk' && th.next === 'dwell' && th.spot && post && th.spot.id === post.id) || th.mode === 'dwell',
      };
      G.prog.med.inj = [];
      return out;
    });
    ok(K.pend === 'comm' && K.reason === 'injured', `${tag} K injured → COMM ` + J(K));
    ok(K.clean && K.headingPost, `${tag} K injured clears walk; to post ` + J(K));

    await ctx.close();
  }
  console.log(fails ? `FAILS ${fails}` : `PASS · speaker-check · 3 sizes`);
  console.log(`NETWATCH console=${net.console} failed=${net.failed}`, J(net.errs.slice(0, 6)));
  await b.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
