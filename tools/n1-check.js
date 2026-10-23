// Crew needs N1 check: needs tick, off-duty crew walk to eat (lounge tables) / sleep (berthing cabins), roster bars,
// save v15 round trip + v14 migration, offline floor, 3-day activity mix. Usage: node tools/n1-check.js
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
    const tele = (deck) => p.evaluate(deck => { const G = __T.G, L = G.lt, D = { lounge: [0.62, 0.82], berthing: [0.55, 0.62], engineering: [0.48, 0.85] }[deck]; L.lift = null; L.deck = deck; L.x = D[0]; L.y = D[1]; L.mode = 'idle'; L.path = null; L.node = null; __T.cam.snap = true; }, deck);
    // 1) four off-shift crew get hungry while the Lt is in the lounge: they arrive by turbolift and sit at the tables
    await tele('lounge');
    await p.evaluate(async () => { const N = await import('/js/needs.js'), G = __T.G, C = G.prog.crew;
      { const r = N.needsOf(C.slots['chief-engineer']); r.shift = (N.shiftNow() + 1) % 3; r.n.rest = 10; r.n.food = 90; r.act = 'sleep'; }   // P27: a senior asleep off-screen FIRST
      for (const s of ['engineer-1', 'nurse', 'ops', 'transporter']) { const r = N.needsOf(C.slots[s]); r.shift = (N.shiftNow() + 1) % 3; r.n.food = 30; r.n.rest = 90; r.n.fun = 80; }
      for (const s of ['crewman', 'yeoman']) { const r = N.needsOf(C.slots[s]); r.shift = (N.shiftNow() + 2) % 3; r.n.rest = 20; r.n.food = 90; } });
    await sleep(4000);
    R.lounge = await p.evaluate(async () => { const A = await import('/js/npc-ambient.js'); return A.ambient.filter(n => n.deck === 'lounge').map(n => `${n.cfg.short}:${n.act}:${n.mode}${A.seatedOn(n) ? ':seated' : ''}`); });
    await sleep(9000);
    R.loungeLater = await p.evaluate(async () => { const A = await import('/js/npc-ambient.js'); return A.ambient.filter(n => n.deck === 'lounge').map(n => `${n.cfg.short}:${n.act}:${n.mode}${A.seatedOn(n) ? ':seated' : ''}`); });
    await p.evaluate(() => { __T.app.paused = true; }); await p.screenshot({ path: OUT + `n1-lounge-eat-${tag}.png` }); await p.evaluate(() => { __T.app.paused = false; });
    // 2) berthing: the two sleepers are inside their cabins (hidden)
    R.seniorAsleep = await p.evaluate(async () => { const A = await import('/js/npc-ambient.js'), n = A.npcOf('chief-engineer'); return `${n.act}:${n.deck}`; });
    R.sleepers = await p.evaluate(async () => { const A = await import('/js/npc-ambient.js'); return A.ambient.filter(n => n.act === 'sleep').map(n => `${n.cfg.short}:${n.deck}:${n.hidden ? 'in cabin' : n.mode}`); });
    // 3) a seen crewmember leaves via the lift: engineer-2 on engineering goes to eat
    await tele('engineering'); await sleep(1500);
    await p.evaluate(async () => { const N = await import('/js/needs.js'), r = N.needsOf(__T.G.prog.crew.slots['engineer-2']); r.shift = (N.shiftNow() + 1) % 3; r.n.food = 30; r.act = 'eat'; });
    await sleep(800);
    R.leaving = await p.evaluate(async () => { const A = await import('/js/npc-ambient.js'), n = A.npcOf('engineer-2'); return `${n.deck}:${n.mode}:${n.next}`; });
    // 4) roster bars on the CREW sheet
    await p.evaluate(() => document.querySelector('.sheetBtns [data-sheet="crew"]').click()); await sleep(500);
    await p.evaluate(() => { const r = document.querySelector('#relations'); r.scrollIntoView(); }); await sleep(300);
    R.bars = await p.evaluate(() => ({ rows: document.querySelectorAll('#relations .rel .needs').length, sample: (document.querySelector('#relations .rel .needs') || {}).title }));
    R.tap = await p.evaluate(() => { const r = document.querySelector('#relations .rel .needs'); const id = r.dataset.needs; r.closest('.rel').querySelector('.nm').click(); const q = document.querySelector(`#relations [data-needs="${id}"]`); const nv = q.querySelector('.nv'); return { same: q === r, open: q.classList.contains('open'), shown: getComputedStyle(nv).display !== 'none', text: nv.textContent }; });
    await p.screenshot({ path: OUT + `n1-roster-bars-${tag}.png` });
    await p.evaluate(() => document.querySelectorAll('.sheet .close, [data-close]').forEach(b => b.click()));
    // 5) save v15 round trip + v14 migration + offline floor + 3-day mix (only once)
    if (tag === '1280x800') {
      R.save = await p.evaluate(async () => { const S = await import('/js/state.js'), G = __T.G; const id = G.prog.crew.slots['nurse'];
        const j = JSON.parse(JSON.stringify(G)); const v15 = { version: j.version, has: !!j.prog.needs[id] };
        const N = await import('/js/needs.js'); const old = JSON.parse(JSON.stringify(G)); old.version = 14; delete old.prog.needs; old.prog.needs = undefined;
        const P = await import('/js/progression.js'); const p2 = JSON.parse(JSON.stringify(old.prog)); p2.needs = { junk: 5, [id]: { n: { rest: 'x', food: 500, fun: null, social: Infinity }, shift: 9, act: 'dance' } }; const p3 = JSON.parse(JSON.stringify(p2)); p3.needs[id].n.fun = null; N.hardenNeeds(p2);
        const nanLoad = JSON.parse(JSON.stringify({ a: NaN, b: Infinity })); 
        return { ...v15, hardened: JSON.stringify(p2.needs[id]), junkDropped: !('junk' in p2.needs), nanJson: nanLoad }; });
      R.wakeToEat = await p.evaluate(async () => { const N = await import('/js/needs.js'), G = __T.G, id = G.prog.crew.slots['nurse'], r = N.needsOf(id), out = [];
        r.shift = (N.shiftNow() + 1) % 3; r.act = 'sleep'; r.n.rest = 50; r.n.food = 14; out.push('sleep'); for (let i = 0; i < 100; i++) { N.tickNeeds(10); if (out[out.length - 1] !== r.act) out.push(r.act); } return out.join('>'); });
      R.offline = await p.evaluate(async () => { const N = await import('/js/needs.js'), PC = await import('/js/pacing.js'), G = __T.G; const save = JSON.stringify(G.prog.needs); const dayT = G.prog.dayT;
        PC.PACE_RT.offline = true; for (let t = 0; t < 8 * 3600; t += 10) { G.prog.dayT = (dayT + t) % (16 * 3600); N.tickNeeds(10); } PC.PACE_RT.offline = false;
        let min = 100; for (const r of Object.values(G.prog.needs)) for (const v of Object.values(r.n)) min = Math.min(min, v);
        // 3-day online mix
        const mix = { duty: 0, sleep: 0, eat: 0, fun: 0 }; let lo = 100, steps = 0; const t0 = performance.now();
        for (let t = 0; t < 3 * 16 * 3600; t += 10) { G.prog.dayT = (dayT + t) % (16 * 3600); N.tickNeeds(10); for (const r of Object.values(G.prog.needs)) { mix[r.act]++; steps++; for (const k of ['rest', 'food', 'fun']) lo = Math.min(lo, r.n[k]); } }
        const ms = performance.now() - t0; G.prog.dayT = dayT; G.prog.needs = JSON.parse(save);
        return { offlineMin: Math.round(min), mixPct: Object.fromEntries(Object.entries(mix).map(([k, v]) => [k, +(100 * v / steps).toFixed(1)])), minRestFoodFun: Math.round(lo), msFor3Days: Math.round(ms) }; });
    }
    await c.close();
  }
  console.log(JSON.stringify(res, null, 1)); console.log(`n1-check: ${errs.length} console errors`, errs.slice(0, 5)); await br.close();
})();
