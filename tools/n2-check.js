// Crew needs N2 check: mood bands + hysteresis, quirk-scaled moodlets, minor incidents (cap), station efficiency and
// officer cooldown ranges, skills XP/levels + harden, head icons (lounge shot), roster mood label, 3-day mood mix.
// Usage: node tools/n2-check.js
const { chromium } = require('playwright-core'); const BASE = process.env.BASE || 'http://127.0.0.1:8765/', OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [], res = {};
  for (const [w, h] of [[390, 844], [844, 390], [1280, 800]]) {
    const tag = `${w}x${h}`, c = await br.newContext({ viewport: { width: w, height: h } }), p = await c.newPage();
    p.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); }); p.on('pageerror', e => errs.push(`${tag}: ${e.message}`));
    await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(400);
    await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); });
    const R = res[tag] = {};
    // 1) lounge: Delgado Stressed, Thelev Strained (both on shift) -> icons over their heads
    await p.evaluate(() => { const G = __T.G, L = G.lt; L.lift = null; L.deck = 'lounge'; L.x = 0.62; L.y = 0.82; L.mode = 'idle'; L.path = null; L.node = null; __T.cam.snap = true; });
    R.bands = await p.evaluate(async () => { const N = await import('/js/needs.js'), M = await import('/js/mood.js'), C = __T.G.prog.crew;
      const set = (sl, v) => { const id = C.slots[sl], r = N.needsOf(id); r.shift = N.shiftNow(); for (const k of N.NEED_KEYS) r.n[k] = v; r.n.food = Math.max(v, 60); r.act = 'duty'; return id; };
      const d = set('steward', 8), t = set('mess-regular-1', 30), b = set('botanist', 3); N.tickNeeds(10);
      return { delgado: [Math.round(M.moodOf(d)), M.bandLabel(M.bandOf(d))], thelev: [Math.round(M.moodOf(t)), M.bandLabel(M.bandOf(t))], sorvan: [Math.round(M.moodOf(b)), M.bandLabel(M.bandOf(b))] }; });
    await sleep(2500);
    await p.evaluate(() => { __T.app.paused = true; }); await p.screenshot({ path: OUT + `n2-mood-icons-${tag}.png` }); await p.evaluate(() => { __T.app.paused = false; });
    // 2) roster: mood label + tap line with mood, efficiency, quirks, skills
    await p.evaluate(() => document.querySelector('.sheetBtns [data-sheet="crew"]').click()); await sleep(500);
    R.roster = await p.evaluate(() => { const id = __T.G.prog.crew.slots['steward'], q = document.querySelector(`#relations [data-needs="${id}"]`); q.closest('.rel').querySelector('.nm').click();
      const nd = document.querySelector(`#relations [data-needs="${id}"]`); nd.scrollIntoView({ block: 'center' }); return { label: nd.querySelector('.md').textContent, nv: nd.querySelector('.nv').innerText.replace(/\n/g, ' | '), ltSkills: (document.querySelector('.ltSkills') || {}).textContent }; });
    await sleep(300); await p.screenshot({ path: OUT + `n2-roster-mood-${tag}.png` });
    await p.evaluate(() => document.querySelectorAll('.sheet .close, [data-close]').forEach(b => b.click()));
    if (tag !== '1280x800') { await c.close(); continue; }
    // 3) logic (once)
    R.logic = await p.evaluate(async () => { const N = await import('/js/needs.js'), M = await import('/js/mood.js'), P = await import('/js/progression.js'), G = __T.G, C = G.prog.crew, out = {};
      const reset = id => { const r = N.needsOf(id); for (const k of N.NEED_KEYS) r.n[k] = 70; r.ml = []; r.wins = 0; delete r.band; return r; };
      // hysteresis: 58 -> Steady; 62 stays Steady; 66 -> Content
      { const id = C.slots['ops'], r = reset(id); const seq = []; for (const v of [70, 58, 62, 66]) { for (const k of N.NEED_KEYS) r.n[k] = v; M.tickMood(id, r, 0, false); seq.push(M.bandLabel(r.band)); } out.hyst = seq.join('>'); }
      // win moodlet by quirk: Hale short fuse+old hand 10*0.6=6, T'Ren vulcan 2.5, Seo green 7.5, Rhovan 5
      const ids = { hale: C.slots['tactical'], tren: C.slots['co'], seo: C.slots['engineer-2'], rhovan: C.slots['ops'] };
      for (const id of Object.values(ids)) reset(id); M.moodAll('win');
      out.win = Object.fromEntries(Object.entries(ids).map(([k, id]) => [k, N.needsOf(id).ml.find(m => m.k === 'win').v]));
      // efficiency and cooldown ranges
      const e = []; for (const v of [0, 30, 60, 100]) { const id = C.slots['chief-engineer'], r = reset(id); for (const k of N.NEED_KEYS) r.n[k] = v; M.tickMood(id, r, 0, false); e.push([v, +M.effOf(id).toFixed(3), +M.cdRate('miracle').toFixed(3), +M.stationEff('warpcore').toFixed(3)]); }
      out.eff = e;
      // minor incidents: everyone Strained-ish for 6 ship hours online -> at most 3 (1 per 2 h)
      G.prog.moodInc = { last: -1e9, n: 0 }; const n0 = G.log.length;
      for (const id of Object.values(C.slots)) if (id) { const r = reset(id); for (const k of N.NEED_KEYS) r.n[k] = 30; r.ml = []; }
      const t0 = G.ship.elapsed; for (let i = 0; i < 2160; i++) { G.ship.elapsed += 10; for (const id of Object.values(C.slots)) if (id) { const r = N.needsOf(id); for (const k of N.NEED_KEYS) r.n[k] = Math.max(r.n[k], 30); M.tickMood(id, r, 10 / 3600, false); } }
      G.ship.elapsed = t0; out.minor = { n: G.prog.moodInc.n, lines: G.log.slice(n0).map(l => l.msg).slice(0, 3) };
      out.slipEff = +M.stationEff('warpcore').toFixed(3);
      // P28: no incidents while idle (night crew has the deck)
      { const PC = await import('/js/pacing.js'); G.prog.moodInc = { last: -1e9, n: 0 }; const was = PC.PACE_RT.idleT; PC.PACE_RT.idleT = 1e6;
        for (let i = 0; i < 2160; i++) { G.ship.elapsed += 10; for (const id of Object.values(C.slots)) if (id) { const r = N.needsOf(id); for (const k of N.NEED_KEYS) r.n[k] = 30; r.ml = []; M.tickMood(id, r, 10 / 3600, false); } }
        G.ship.elapsed = t0; PC.PACE_RT.idleT = was; out.idleIncidents = G.prog.moodInc.n; }
      // P28: ally lost (Kerala heavier); Old hand only dampens negatives
      { const r1 = reset(ids.rhovan), r2 = reset(ids.hale); M.moodAll('allyLost'); const a = [r1.ml[0].v, r2.ml[0].v]; reset(ids.rhovan); reset(ids.hale); M.moodAll('keralaLost'); out.allyLost = { rhovan: a[0], hale: a[1], keralaRhovan: N.needsOf(ids.rhovan).ml[0].v }; }
      // P28: load clamps moodlet value / duration and stress
      { const p4 = JSON.parse(JSON.stringify(G.prog)), id = C.slots['nurse']; p4.needs[id] = { n: { rest: 50, food: 50, fun: 50, social: 50, comfort: 50 }, shift: 1, act: 'duty', stress: 1e9, ml: [{ k: 'chat', v: 500, t0: 0, t1: 9e12 }] };
        N.hardenNeeds(p4); const r = p4.needs[id]; out.loadClamp = { stress: r.stress, v: r.ml[0].v, days: +((r.ml[0].t1 - r.ml[0].t0) / 57600).toFixed(2) }; }
      // skills: XP -> levels, Lt repair skill, harden junk
      M.addSkillXp('lt', 'engineering', 300); out.ltEng = [M.skillLvl('lt', 'engineering'), +M.ltRepairSkill().toFixed(2)];
      out.levels = [0, 99, 100, 300, 5500, 99999].map(M.levelOfXp);
      const p2 = JSON.parse(JSON.stringify(G.prog)); p2.skills = { lt: { tactical: 'x', engineering: NaN, fitness: 1e12, composure: -5 }, ghost: { tactical: 5 } }; M.hardenSkills(p2); out.hardenSkills = p2.skills;
      // mood fields survive the save harden; junk moodlets dropped
      const p3 = JSON.parse(JSON.stringify(G.prog)); const id = C.slots['nurse']; p3.needs[id] = { n: { rest: 50, food: 50, fun: 50, social: 50, comfort: 50 }, shift: 1, act: 'duty', mood: 44, band: 1, stress: 2, wins: 2, ml: [{ k: 'win', v: 5, t0: 0, t1: 9e9 }, { k: 'bogus', v: 1, t0: 0, t1: 1 }, { k: 'tow', v: NaN, t0: 0, t1: 9 }] };
      N.hardenNeeds(p3); out.hardenMood = p3.needs[id];
      // quirks for a generated arrival (from tags)
      C.occ.zz9 = { id: 'zz9', slot: 'crewman', tags: ['gruff', 'calm'], short: 'Zed' }; out.genQuirks = M.quirkNames('zz9'); delete C.occ.zz9;
      return out; });
    // 4) 3-day fresh mood mix (offline=false), band % over roster and min mood
    R.mix = await p.evaluate(async () => { const N = await import('/js/needs.js'), M = await import('/js/mood.js'), G = __T.G, C = G.prog.crew; G.prog.needs = {}; G.prog.moodInc = { last: -1e9, n: 0 };
      const cnt = [0, 0, 0, 0, 0]; let min = 100, tot = 0; const n0 = G.prog.moodInc.n;
      for (let i = 0; i < 3 * 57600 / 10; i++) { G.prog.dayT = ((G.prog.dayT || 0) + 10) % 57600; G.ship.elapsed += 10; N.tickNeeds(10);
        for (const id of Object.values(C.slots)) if (id && G.prog.needs[id]) { const r = G.prog.needs[id]; cnt[r.band || 0]++; tot++; min = Math.min(min, r.mood); } }
      return { pct: cnt.map(x => +(100 * x / tot).toFixed(1)), minMood: Math.round(min), minorIncidents3d: G.prog.moodInc.n - n0 }; });
    await c.close();
  }
  await br.close();
  console.log(JSON.stringify(res, null, 1)); console.log(`n2-check: ${errs.length} console errors`, errs.slice(0, 5));
})();
