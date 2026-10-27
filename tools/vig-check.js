// Ambient vignette check (Oct 26 batch H). Per size: lane frequency (none on play day 1; ~12 / 9 / 6 min on days 2-4 / 5-9 /
// 10+; max 4 per hour of present play), gating (battle, held alert, deck task, quiet period, idle, away, story, DC), a running
// vignette ends on red alert and freezes with the sim, the real vignettes_v1 art (all 25 playable, planned files loaded, no 404s), bubbles + log lines, the Sensors chip, the tap
// bonus and its ~1 in 4 rate.
// Shot: shots/vig-bubbles-<size>.png. Usage: node tools/vig-check.js (SHOTS=0 skips the shots)
const { chromium } = require('playwright-core'); const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/', OUT = path.resolve(__dirname, '..', 'shots') + '/', SHOTS = process.env.SHOTS !== '0';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const reqs = [], errs = [], net = [], fails = [], J = JSON.stringify, host = new URL(BASE).host, ok = (c, m) => { if (!c) fails.push(m); else console.log('ok ' + m.split(' {')[0].split(' [')[0]); };
  for (const [w, h] of [[390, 844], [844, 390], [1280, 800]]) {
    const tag = `${w}x${h}`, mob = w < 900, c = await br.newContext({ viewport: { width: w, height: h }, locale: 'en-US', timezoneId: 'America/Chicago', isMobile: mob, hasTouch: mob });
    await c.addInitScript(() => { window.__TENACITY_SKIP_NAME = true; window.__TENACITY_SKIP_BG = true; });
    const p = await c.newPage();
    p.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); }); p.on('pageerror', e => errs.push(`${tag}: ${e.message}`));
    p.on('request', r => reqs.push(r.url())); p.on('response', r => { if (r.status() >= 400) net.push(`${tag}: ${r.status()} ${r.url()}`); });
    p.on('requestfailed', r => { if (new URL(r.url()).host === host) net.push(`${tag}: failed ${r.url()} ${r.failure() && r.failure().errorText}`); });
    const ready = () => p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
    const calm = () => p.evaluate(() => { const G = __T.G; G.prog.story.pilot.done = true; G.prog.background = G.prog.background || 'none'; G.prog.bgDone = true; G.prog.rations = 2000; G.ship.nextFault = 1e9; G.sp.cap.decideT = 1e9; G.sp.ev.nextT = -1; G.sp.battle = null; G.sp.alert = null; __T.PACE_RT.sessionT = 1e6; document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); });
    await p.goto(BASE + '?reset=1'); await ready(); await sleep(400); await calm();
    const R = {};
    // drive the lane by hand with the game paused (the main loop also ticks it while unpaused)
    const lane = (o) => p.evaluate(o => { const VG = __T.VG, rt = VG.vigRT, G = __T.G; __T.app.paused = true;
      rt.cur = null; G.prog.vig = { pt: 0, st: [], w: null, bt: -1e9 }; rt.recent = []; G.prog.day = o.day; G.sp.battle = null; G.sp.alert = null; G.sp.ev.active = null;
      const starts = []; for (let i = 0; i < o.secs; i++) { __T.PACE_RT.idleT = o.idle || 0; if (o.set) (new Function('G', o.set))(G); const had = !!rt.cur; VG.tickVig(1); if (!had && rt.cur) starts.push(i); }
      if (o.set) { G.sp.battle = null; G.sp.alert = null; G.sp.ev.active = null; if (G.prog.med) G.prog.med.hushUntil = 0; }
      const cur = rt.cur && rt.cur.id; VG.endVig('test'); return { starts, n: starts.length, cur }; }, o);
    // ---- 1. frequency: none before play day 2; ~12 / 9 / 6 min (+-25%) on days 2-4 / 5-9 / 10+; max 4 per hour of present play ----
    R.d1 = await lane({ day: 1, secs: 7200 });
    R.d3 = await lane({ day: 3, secs: 3600 }); R.d6 = await lane({ day: 6, secs: 3600 }); R.d12 = await lane({ day: 12, secs: 3600 });
    R.d12h2 = await lane({ day: 12, secs: 7200 });
    R.gaps = await p.evaluate(() => [1, 2, 4, 5, 9, 10, 30].map(d => __T.VG.gapFor(d)));
    ok(R.d1.n === 0, `${tag} lane: nothing on play day 1 ` + J(R.d1));
    ok(J(R.gaps) === J([Infinity, 720, 720, 540, 540, 360, 360].map(x => x === Infinity ? null : x)) || J(R.gaps) === '[null,720,720,540,540,360,360]', `${tag} lane gaps by play day ` + J(R.gaps));
    ok(R.d3.starts[0] >= 539 && R.d3.starts[0] <= 901 && R.d6.starts[0] >= 404 && R.d6.starts[0] <= 676 && R.d12.starts[0] >= 269 && R.d12.starts[0] <= 451, `${tag} lane: first vignette at ~12 / 9 / 6 min ` + J([R.d3.starts[0], R.d6.starts[0], R.d12.starts[0]]));
    ok(R.d12.n <= 4 && R.d12.n >= 3 && R.d12h2.n <= 8 && R.d12h2.n >= 6, `${tag} lane: at most 4 per hour of present play ` + J([R.d12, R.d12h2.n]));
    // ---- 2. gating: battle, held alert, deck task, the quiet period, idle, not present (no input for 60 s+); story and DC block too ----
    R.gate = {};
    for (const [k, set] of [['battle', 'G.sp.battle = G.sp.battle || { t: 0 };'], ['alert', 'G.sp.alert = G.sp.alert || { t: 0 };'], ['task', 'G.sp.ev.active = G.sp.ev.active || { id: "x" };'], ['hushed', 'G.prog.med.hushUntil = G.ship.elapsed + 1e6;']])
      R.gate[k] = (await lane({ day: 12, secs: 1500, set })).n;
    R.gate.idle = (await lane({ day: 12, secs: 1500, idle: 1e6 })).n; R.gate.away = (await lane({ day: 12, secs: 1500, idle: 100 })).n;
    R.gate.panel = (await lane({ day: 12, secs: 1500, set: 'const m = document.querySelector(".modal"); if (m) m.hidden = false; window.__m = m;' })).n; await p.evaluate(() => { if (window.__m) window.__m.hidden = true; });
    R.gate.card = (await lane({ day: 12, secs: 1500, set: 'const w = document.querySelector("#wbCard"); w.classList.add("bow"); w.hidden = false;' })).n; await p.evaluate(() => { document.querySelector('#wbCard').hidden = true; });
    R.gate.holo = await p.evaluate(async () => { const UH = await import('/js/ui/holo.js'); UH.openHolo('lt'); const r = __T.VG.vigBlock(); document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); return r === 'panel' ? 0 : 1; });
    R.gate.story = await p.evaluate(() => { const ST = __T.ST, VG = __T.VG; let r = null; for (const id of ST.IDS) if (ST.startStory(id)) { r = VG.vigBlock(); ST.closeStory(); break; } return r; });
    R.gate.dc = await p.evaluate(async () => { const DC = await import('/js/dc.js'), src = String(DC.dcPaused); return /dc\.open/.test(src); });
    ok(Object.entries(R.gate).every(([k, v]) => k === 'story' ? v === 'story' : k === 'dc' ? v === true : v === 0), `${tag} gating: no vignette in battle / alert / task / quiet period / idle / away; story + DC block ` + J(R.gate));
    R.abort = await p.evaluate(() => { const VG = __T.VG, G = __T.G; __T.app.paused = true; G.prog.day = 12; VG.endVig('x'); VG.startVig(VG.VIGS[1], { dur: 30, bonus: null }); VG.tickVig(1); const a = !!VG.vigRT.cur; G.sp.alert = { t: 0 }; VG.tickVig(1); const b = !!VG.vigRT.cur; G.sp.alert = null; return { a, b }; });
    ok(R.abort.a && !R.abort.b, `${tag} a running vignette ends when red alert starts ` + J(R.abort));
    R.freeze = await p.evaluate(async () => { const VG = __T.VG; VG.endVig('x'); VG.startVig(VG.VIGS[2], { dur: 30, bonus: null }); VG.tickVig(3); const t0 = VG.vigRT.cur.t; __T.app.paused = true; await new Promise(r => setTimeout(r, 1200)); const t1 = VG.vigRT.cur.t; VG.endVig('x'); return { t0, t1 }; });
    ok(R.freeze.t0 === R.freeze.t1, `${tag} the lane freezes with the sim ` + J(R.freeze));
    // ---- 3. real art (vignettes_v1, Shiloh approved): all 25 playable; every VIG_ART ready; the planned files loaded with no 404 ----
    R.art = await p.evaluate(() => { const VG = __T.VG, picks = {}; for (let i = 0; i < 2000; i++) { const v = VG.pickVig(); picks[v.id] = 1; VG.vigRT.recent = []; }
      const A = VG.VIG_ART; return { picks: Object.keys(picks).sort(), n: Object.keys(picks).length, ready: Object.values(A).every(a => a.ready), comet: VG.playable(VG.VIGS.find(v => v.id === 'comet')), keys: Object.values(A).map(a => a.key).filter(Boolean) }; });
    ok(R.art.ready && R.art.comet && R.art.n === 25 && R.art.picks.includes('comet') && ['bajoran_transport', 'bajoran_limp', 'ferengi_hail', 'runabout_mail', 'comet'].every(x => R.art.picks.includes(x)), `${tag} real art: all 25 playable (12 new Oct 27 + prior) ` + J(R.art));
    // ---- 3b. line lengths fit bubbles; US spelling; every actor sprite resolves; runabout ~0.22 ----
    R.txt = await p.evaluate(() => {
      const VG = __T.VG, BRIT = /\b(colour|favour|honour|centre|defence|travelling|organised|recognised|licence|aluminium)\b/i;
      const long = [], brit = [], miss = [];
      for (const v of VG.VIGS) {
        for (const [who, tx] of v.lines) {
          if (String(tx).length > 110) long.push([v.id, who, String(tx).length]);
          if (BRIT.test(tx) || BRIT.test(who)) brit.push([v.id, who, tx]);
        }
        for (const a of v.actors) { if (!VG.playable({ actors: [a], lines: [['x', 'x']] })) miss.push([v.id, a.s]); }
        if (!VG.playable(v)) miss.push([v.id, 'UNPLAYABLE']);
      }
      return { long, brit, miss, n: VG.VIGS.length, runSz: VG.VIGS.find(v => v.id === 'runabout_mail').actors[0].sz };
    });
    ok(R.txt.n === 25 && !R.txt.long.length && !R.txt.brit.length && !R.txt.miss.length && R.txt.runSz >= 0.2 && R.txt.runSz <= 0.24, `${tag} lines fit, US spelling, sprites exist, runabout ~0.22 ` + J(R.txt));
    // ---- 4. bubbles + chip + tap bonus + shot ----
    R.ui = await p.evaluate(async () => { const VG = __T.VG, G = __T.G, PG = G.prog; __T.app.paused = true; VG.endVig('x'); __T.setView('deck');
      VG.startVig(VG.VIGS.find(v => v.id === 'convoy'), { dur: 32, bonus: 'xp' }); for (let i = 0; i < 18; i++) VG.tickVig(1);
      __T.app.paused = false; await new Promise(r => setTimeout(r, 400)); const chip = [...document.querySelectorAll('.chip.vigc')].find(b => b.offsetParent !== null); const chipOn = !!chip;
      if (chip) chip.click(); await new Promise(r => setTimeout(r, 300));
      const box = document.querySelector('#vigBox'); return { chipOn, view: __T.app.view, bubbles: box ? box.querySelectorAll('.vb').length : 0, boxVis: !!box && box.offsetParent !== null, bonusBtn: !!document.querySelector('#vigBox .vbBonus'), logs: G.log.slice(-6).filter(e => e.cls === 'comm' && /^(Hale|Capt T'Ren): /.test(e.msg)).length }; });
    ok(R.ui.chipOn && R.ui.view === 'space' && R.ui.bubbles === 3 && R.ui.boxVis && R.ui.bonusBtn && R.ui.logs === 3, `${tag} bubbles in the space window (3 lines, logged), Sensors chip -> space view ` + J(R.ui));
    if (SHOTS) { await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); const w = document.querySelector('#wbCard'); if (w) w.hidden = true; }); await sleep(300); await p.screenshot({ path: `${OUT}vig-bubbles-${tag}.png` }); }
    R.bonus = await p.evaluate(async () => { const VG = __T.VG, G = __T.G, PG = G.prog; __T.PACE_RT.sessionT = 0; PG.restT = 0; const x0 = PG.totalXp; document.querySelector('#vigBox .vbBonus').click(); const x1 = PG.totalXp; VG.takeBonus(); const x2 = PG.totalXp;
      VG.endVig('x'); VG.startVig(VG.VIGS[2], { dur: 30, bonus: 'rep' }); VG.tickVig(5); const r0 = G.sp.rep; VG.takeBonus(); VG.takeBonus(); const r1 = G.sp.rep; VG.endVig('x');
      return { xp: x1 - x0, again: x2 - x1, rep: r1 - r0, gone: !document.querySelector('#vigBox .vbBonus') }; });
    ok(R.bonus.xp === 5 && R.bonus.again === 0 && R.bonus.rep === 1, `${tag} tap bonus: +5 XP once (no rested), or +1 rep ` + J(R.bonus));
    R.rate = await p.evaluate(() => { const VG = __T.VG; let b = 0; for (let i = 0; i < 2000; i++) { VG.vigRT.cur = null; __T.G.prog.vig.bt = -1e9; VG.startVig(VG.VIGS[0]); if (VG.vigRT.cur.bonus) b++; VG.vigRT.cur = null; } __T.G.prog.vig.st = []; return b / 2000; });
    ok(R.rate > 0.19 && R.rate < 0.31, `${tag} about 1 in 4 offers the bonus ` + J(R.rate));
    // ---- 5. saved lane: the hour's starts and the last bonus survive a reload (no farming by reloading) ----
    await p.evaluate(() => { const G = __T.G; G.prog.day = 12; G.prog.vig = { pt: 1000, st: [200, 400, 600, 800], w: 0, bt: 900 }; window.__noSave = false; __T.saveGame(); window.__noSave = true; });
    await p.reload(); await ready(); await sleep(400); await calm();
    R.saved = await p.evaluate(() => { const VG = __T.VG, G = __T.G, v0 = JSON.parse(JSON.stringify(G.prog.vig)); __T.app.paused = true; let n = 0; for (let i = 0; i < 1500; i++) { __T.PACE_RT.idleT = 0; const had = !!VG.vigRT.cur; VG.tickVig(1); if (!had && VG.vigRT.cur) n++; if (G.prog.vig.pt < 1700) { /* keep under the hour */ } }
      VG.endVig('x'); G.prog.vig.st = []; G.prog.vig.bt = G.prog.vig.pt - 60; VG.startVig(VG.VIGS[2], { rnd: () => 0 }); const b = VG.vigRT.cur.bonus; VG.endVig('x'); return { v0, n, bonusInGap: b }; });
    ok(R.saved.v0.st.length === 4 && R.saved.v0.bt === 900 && R.saved.n === 0 && R.saved.bonusInGap === null, `${tag} saved lane: 4 starts survive a reload (next only after the hour), no bonus within 30 min of the last ` + J(R.saved));
    await c.close();
  }
  await br.close();
  const want = ['ship-bajoran_transport', 'ship-bajoran_transport-damaged', 'ship-ferengi_marauder', 'ship-runabout', 'ship-comet', 'ship-comet-tail'];
  const art = reqs.filter(u => /ship-(bajoran_transport|ferengi_marauder|runabout|comet)/.test(u));
  const got = [...new Set(art.map(u => (u.match(/ship-[\w-]+/) || [])[0]).filter(Boolean))];
  const miss = want.filter(k => !got.includes(k)), bad = art.filter(u => /\s(404|failed)/.test(u) || false);
  // requests are URL strings from the request listener; 404s land in `net`
  const netArt = net.filter(n => /ship-(bajoran_transport|ferengi_marauder|runabout|comet)/.test(n));
  ok(miss.length === 0 && netArt.length === 0, 'planned vignette art requested with no 404s ' + J({ got, miss, netArt }));
  console.log('ERRORS', errs.length, J(errs.slice(0, 5))); console.log('NET', net.length, J(net.slice(0, 5)));
  if (fails.length || errs.length || net.length) { console.log('FAILS ' + fails.length); fails.forEach(f => console.log('FAIL ' + f)); process.exit(1); }
  console.log('PASS · vig-check · 3 sizes · 0 console errors · 0 failed requests');
})().catch(e => { console.error(e); process.exit(1); });
