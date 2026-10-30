// Phaser range live UI + crew-spar registry + LOWs + spar true.webp guard.
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
    const reqs = [];
    p.on('console', m => { if (m.type() === 'error') { net.console++; net.errs.push(m.text()); } });
    p.on('pageerror', e => { net.console++; net.errs.push(e.message); });
    p.on('requestfailed', r => { net.failed++; net.errs.push('fail:' + r.url()); });
    p.on('request', r => { const u = r.url(); if (/story\/true\.webp|lt-phaser|fx-phaser/.test(u)) reqs.push(u); });
    await p.goto(BASE + '?reset=1');
    await p.waitForFunction(() => window.__T && document.querySelector('#loading')?.classList.contains('done'), null, { timeout: 60000 });
    await sleep(300);
    await p.evaluate(async () => {
      const G = __T.G; G.prog.story = G.prog.story || {}; G.prog.story.pilot = G.prog.story.pilot || {}; G.prog.story.pilot.done = true;
      G.prog.background = 'none'; G.prog.bgDone = true; G.prog.rations = 5000; G.prog.parts = 20; G.prog.fleetRep = 80;
      G.ship.nextFault = 1e9; G.sp.cap.decideT = 1e9; G.sp.ev.nextT = -1; G.sp.battle = null; G.sp.alert = null;
      window.__noSave = true; __T.PACE_RT.sessionT = 1e6; G.prog.rank = 2;
    });

    // ---- Flags OFF + no phaser asset requests ----
    const F = await p.evaluate(async () => {
      const { PROG } = await import('/js/progression.js');
      const LA = await import('/js/lt-act.js');
      const { CREW_SPAR_SHEETS, PHASER_SHEET } = await import('/js/data.js');
      return {
        crewSparArt: !!PROG.ltAct.crewSparArt, phaserArt: !!PROG.ltAct.phaserArt,
        muzzle: PHASER_SHEET.muzzle_px.down, sheet: PHASER_SHEET.img,
        guestWho: LA.guestSparWho('hale'),
      };
    });
    ok(!F.crewSparArt && !F.phaserArt && F.guestWho === null, `${tag} flags OFF ` + J(F));
    ok(F.muzzle && F.muzzle[0] === 72 && F.sheet === 'lt-phaser-v1', `${tag} PHASER_SHEET muzzle contract ` + J({ muzzle: F.muzzle }));

    // ---- LIVE phaser UI: countdown drops, tap hits, end card, XP once ----
    const Live = await p.evaluate(async () => {
      const LA = await import('/js/lt-act.js'), H = await import('/js/ui/lt-act.js'), G = __T.G;
      const { awardXP } = await import('/js/progression.js');
      G.lt.deck = 'gym'; G.lt.lift = null; G.lt.x = 0.45; G.lt.y = 0.5;
      LA.A().phaser = { d: '', n: 0 }; LA.A().session = null; LA.A().n.phasers = 0;
      const xp0 = G.prog.xp | 0;
      H.openPhaser();
      const title0 = document.getElementById('phaserTitle')?.textContent || '';
      const left0 = LA.phaserView()?.left;
      // Advance sim ~3s via tickLtSession path
      for (let i = 0; i < 60; i++) { LA.tickPhaserRange(0.05); }
      // Force UI refresh (sim would call phaserUI.refresh)
      H.refreshLtAct();
      const title1 = document.getElementById('phaserTitle')?.textContent || '';
      const left1 = LA.phaserView()?.left;
      // Ensure a target exists then tap it through the button
      const s = LA.A().session;
      if (s && s.phase === 'range' && !s.target) { s.target = { x: 50, y: 40, born: s.t }; }
      H.refreshLtAct();
      const btn = document.querySelector('#phaserArena .phaser-tgt');
      const br = btn && btn.getBoundingClientRect();
      const hits0 = LA.phaserView()?.hits | 0;
      if (btn) btn.click();
      await new Promise(r => setTimeout(r, 50));
      const hits1 = LA.phaserView()?.hits | 0;
      // Finish the bout
      for (let i = 0; i < 500; i++) {
        LA.tickPhaserRange(0.05);
        if (LA.A().session && LA.A().session.phase === 'done') break;
      }
      H.refreshLtAct();
      const endTitle = document.querySelector('#ltActChat h3')?.textContent || '';
      const endBody = document.querySelector('#ltActChat .mline')?.textContent || '';
      const doneBtn = document.querySelector('#ltActChat [data-ltact-phaser-done], #ltActChat [data-ltact-ans]');
      const xpMid = G.prog.xp | 0;
      // Close via Done
      if (doneBtn) doneBtn.click();
      await new Promise(r => setTimeout(r, 30));
      const xp1 = G.prog.xp | 0;
      const closed = !LA.A().session;
      // XP must not double on second finish
      LA.A().session = { kind: 'phaser', phase: 'done', summary: 'x', xpPaid: 4, hits: 4 };
      const again = LA.answerPhaser();
      const xp2 = G.prog.xp | 0;
      return {
        title0, title1, left0, left1, countdownDrop: left1 < left0,
        tap44: !!(br && br.width >= 43.5), hitRegistered: hits1 === hits0 + 1,
        endTitle, endBody, hasDone: !!doneBtn, closed,
        xpGain: xpMid - xp0, xpAfterClose: xp1 - xp0, xpStable: xp2 === xp1,
        paidOnce: (xpMid - xp0) >= 3 && (xpMid - xp0) <= 5,
      };
    });
    ok(Live.countdownDrop && Live.left1 < Live.left0, `${tag} countdown decreases ` + J({ left0: Live.left0, left1: Live.left1, t0: Live.title0, t1: Live.title1 }));
    ok(Live.tap44 && Live.hitRegistered, `${tag} tap registers hit ` + J({ hits: Live.hitRegistered, tap44: Live.tap44 }));
    ok(/DONE/i.test(Live.endTitle) && /Phaser range|hit/i.test(Live.endBody) && Live.hasDone,
      `${tag} end card shows ` + J({ endTitle: Live.endTitle, endBody: Live.endBody }));
    ok(Live.closed && Live.paidOnce && Live.xpStable, `${tag} XP paid once + Done closes ` + J(Live));
    if (SHOTS) await p.screenshot({ path: `${OUT}phaser-range-${tag}.png` });

    // ---- sparArt ON must NOT request story/true.webp ----
    const Spar = await p.evaluate(async () => {
      const LA = await import('/js/lt-act.js'), H = await import('/js/ui/lt-act.js'), G = __T.G;
      const { PROG } = await import('/js/progression.js');
      PROG.ltAct.sparArt = true;
      G.lt.deck = 'gym'; G.lt.lift = null;
      LA.A().spar = { d: '', n: 0, invite: { rolls: { hale: true }, nos: 0, guest: 'hale' } };
      LA.A().session = null;
      const r = LA.startSpar('hale');
      if (r && r.approaching) {
        LA.A().session.phase = 'chat'; LA.A().session.mode = 'near'; LA.A().session.art = true;
        LA.A().session.pose = 'punch';
      }
      H.refreshLtAct();
      const v = LA.sparView();
      const still = document.querySelector('#ltActChat .ltact-still');
      const img = still && still.querySelector('img');
      return {
        artField: v && v.art, sparArt: v && v.sparArt, hasStill: !!still,
        imgSrc: img ? img.getAttribute('src') : null,
      };
    });
    ok(Spar.artField == null && !Spar.hasStill && !Spar.imgSrc,
      `${tag} spar chat no story still / no true.webp ` + J(Spar));
    const badReq = reqs.filter(u => /story\/true\.webp/.test(u));
    ok(badReq.length === 0, `${tag} netwatch no true.webp ` + J(badReq));
    // restore sparArt (was already true in PROG defaults for Wave C — leave true)
    if (SHOTS) await p.screenshot({ path: `${OUT}spar-crew-pin-${tag}.png` });

    // ---- shipped: no lt-phaser / fx-phaser requests with flag OFF ----
    const phaserReqs = reqs.filter(u => /lt-phaser|fx-phaser/.test(u) && !/shots\/_phaser-preview/.test(u));
    ok(phaserReqs.length === 0, `${tag} no shipped phaser asset requests ` + J(phaserReqs));

    // LOWs smoke (quest pill + away abort) — keep brief
    const Low = await p.evaluate(async () => {
      const G = __T.G, LA = await import('/js/lt-act.js'), H = await import('/js/ui/hud.js');
      const errs = [];
      window.onerror = (m) => { errs.push(String(m)); return true; };
      G.prog.opinions = G.prog.opinions || {}; G.prog.opinions.diallo = 50;
      LA.A().quest = { active: null, done: {}, offer: null };
      LA.acceptQuest('diallo_array'); G.ship.faults = {}; G.lt.deck = 'lounge';
      H.updateHud(); LA.answerQuest(0); G.lt.deck = 'bridge'; H.updateHud();
      const pill = document.getElementById('alertPill')?.textContent || '';
      const today = (await import('/js/progression.js')).localDate();
      LA.A().away = { d: today, n: 0, invite: { rolls: { hale: true }, nos: 0, guest: 'hale' }, mission: null };
      G.sp.location = 'ds9'; G.sp.travel = null;
      LA.startAway('listen');
      G.sp.travel = { dest: 'convoy', t: 1, dur: 600, from: 'ds9' };
      LA.tickLtAct();
      G.sp.travel = null;
      return { nameErrs: errs.filter(e => /reading 'name'/.test(e)).length, pill, aborted: !LA.A().session };
    });
    ok(Low.nameErrs === 0 && Low.aborted, `${tag} LOWs quest+abort ` + J(Low));
    if (SHOTS) await p.screenshot({ path: `${OUT}lows-quest-pill-${tag}.png` });

    await ctx.close();
  }

  // ---- Dev preview: force flag ON, load temp shots/_phaser-preview into IMG ----
  {
    const tag = 'preview';
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await ctx.addInitScript(() => { window.__TENACITY_SKIP_NAME = true; window.__TENACITY_SKIP_BG = true; window.__TENACITY_NO_IDLE = true; });
    const p = await ctx.newPage();
    const prevReqs = [];
    p.on('request', r => { if (/lt-phaser|fx-phaser/.test(r.url())) prevReqs.push(r.url()); });
    p.on('console', m => { if (m.type() === 'error') { net.console++; net.errs.push('prev:' + m.text()); } });
    p.on('pageerror', e => { net.console++; net.errs.push('prev:' + e.message); });
    await p.goto(BASE + '?reset=1');
    await p.waitForFunction(() => window.__T && document.querySelector('#loading')?.classList.contains('done'), null, { timeout: 60000 });
    const Prev = await p.evaluate(async () => {
      const { PROG } = await import('/js/progression.js');
      const { IMG } = await import('/js/assets.js');
      const { PHASER_SHEET } = await import('/js/data.js');
      const LA = await import('/js/lt-act.js');
      const H = await import('/js/ui/lt-act.js');
      const G = __T.G;
      G.prog.story = { pilot: { done: true } }; G.prog.background = 'none'; G.prog.bgDone = true;
      window.__noSave = true; __T.PACE_RT.sessionT = 1e6;
      G.ship.nextFault = 1e9; G.sp.cap.decideT = 1e9; G.sp.battle = null; G.sp.alert = null;
      // Load preview copies (served from shots/_phaser-preview — NOT assets/)
      const load = (key, url) => new Promise((res, rej) => {
        const i = new Image(); i.onload = () => { IMG[key] = i; res(true); }; i.onerror = () => res(false); i.src = url;
      });
      const base = 'shots/_phaser-preview/';
      const okSheet = await load(PHASER_SHEET.img, base + 'lt-phaser-v1.webp');
      const okBeam = await load(PHASER_SHEET.beam, base + 'fx-phaser-beam.png');
      const okHit = await load(PHASER_SHEET.hit, base + 'fx-phaser-hit.png');
      PROG.ltAct.phaserArt = true;
      const framed = LA.ensureLtPhaserFrames();
      const muzzle = LA.phaserMuzzle('right');
      G.lt.deck = 'gym'; G.lt.lift = null; G.lt.dir = 'right';
      LA.A().phaser = { d: '', n: 0 }; LA.A().session = null;
      H.openPhaser();
      // force a target + hit to flash beam
      const s = LA.A().session;
      if (s) { s.target = { x: 70, y: 35, born: s.t || 0 }; s.art = true; }
      H.refreshLtAct();
      const btn = document.querySelector('#phaserArena .phaser-tgt');
      if (btn) btn.click();
      await new Promise(r => setTimeout(r, 100));
      const hasLt = !!document.querySelector('#phaserArena .phaser-lt');
      const fr = LA.A().session; // may still be range
      return {
        okSheet, okBeam, okHit, framed, muzzle, hasLt, phaserArt: LA.phaserArtOn(),
        frames: !!(window.__T && (await import('/js/data.js')).CHAR_FRAMES.lt.phaser),
      };
    });
    ok(Prev.okSheet && Prev.okBeam && Prev.okHit && Prev.framed && Prev.phaserArt,
      `preview assets loaded + frames ` + J(Prev));
    ok(Prev.muzzle && Prev.muzzle.x === 153, `preview muzzle right ` + J(Prev.muzzle));
    // Preview may request shots/_phaser-preview paths — that is OK; must not hit assets/lt-phaser
    const assetLeak = prevReqs.filter(u => /\/assets\/(lt-phaser|fx-phaser)/.test(u));
    ok(assetLeak.length === 0, `preview no assets/ leak ` + J(assetLeak));
    if (SHOTS) {
      await p.screenshot({ path: `${OUT}phaser-art-preview-390x844.png` });
      // landscape + desktop
      await p.setViewportSize({ width: 844, height: 390 });
      await sleep(200);
      await p.screenshot({ path: `${OUT}phaser-art-preview-844x390.png` });
      await p.setViewportSize({ width: 1280, height: 800 });
      await sleep(200);
      await p.screenshot({ path: `${OUT}phaser-art-preview-1280x800.png` });
    }
    // Restore flag OFF for cleanliness
    await p.evaluate(async () => { const { PROG } = await import('/js/progression.js'); PROG.ltAct.phaserArt = false; });
    await ctx.close();
  }

  console.log(fails ? `FAILS ${fails}` : `PASS · phaser-check · 3 sizes + preview`);
  console.log(`NETWATCH console=${net.console} failed=${net.failed}`, J(net.errs.slice(0, 8)));
  await b.close();
  process.exit(fails || net.console || net.failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
