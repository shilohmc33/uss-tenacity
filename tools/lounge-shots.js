// Lounge v2 (sprites/deck_lounge_v2): seated tables, chair carves, mess routines. At 390x844, 844x390, 1280x800:
// checks every chair carve + table block is off the walk grid, every stand spot is walkable, the Lt sits at the mess (table 2),
// Thelev (mess-east/west) and the steward (table-west, table 4) reach their seats, and walkers' sampled feet never enter a carve.
// shots/lounge-v2-<size>.png. NODE_PATH=/workspace/pwtools/node_modules node tools/lounge-shots.js [base]
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SP = JSON.parse(fs.readFileSync(__dirname + '/../assets/src/deck_lounge_v2/lounge_spots.json'));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const rep = { errors: {}, info: {} }; let fail = 0;
  for (const [w, h, m] of [[390, 844, true], [844, 390, true], [1280, 800, false]]) {
    const tag = `${w}x${h}`, errs = [], I = rep.info[tag] = {};
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: m, hasTouch: m });
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
    await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(600);
    await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); });
    // grid: carves blocked (sample 3x3 inside each), stand spots walkable
    I.grid = await p.evaluate(async (seats) => { const P = await import('/js/path.js'); const bad = [];
      for (const [id, s] of Object.entries(seats)) { const [x0, y0, x1, y1] = s.carve_px;
        for (const fx of [0.25, 0.5, 0.75]) for (const fy of [0.25, 0.5, 0.75]) { const x = (x0 + (x1 - x0) * fx) / 960, y = (y0 + (y1 - y0) * fy) / 640; if (P.isWalkable('lounge', x, y)) bad.push(id + ' carve walkable ' + [Math.round(x * 960), Math.round(y * 640)]); }
        if (!P.isWalkable('lounge', s.stand_px[0] / 960, s.stand_px[1] / 640)) bad.push(id + ' stand blocked'); }
      return bad; }, SP.seats);
    fail += I.grid.length;
    const L = (deck, x, y) => p.evaluate(([deck, x, y]) => { const Lt = __T.G.lt; Lt.deck = deck; Lt.lift = null; Lt.x = x; Lt.y = y; Lt.mode = 'idle'; Lt.path = null; Lt.intent = null; __T.cam.snap = true; __T.cam.manualT = 0; }, [deck, x, y]);
    await L('lounge', 0.30, 0.56);
    // Lt walks to the mess and sits; Thelev to table 3 (mess-east), the steward (if rostered) to table 4; sample walker feet vs carves
    const who = await p.evaluate(() => { __T.sendUse('mess'); const on = __T.ambient.filter(n => n.deck === 'lounge');
      const th = on.find(n => n.cfg && n.cfg.id === 'thelev') || on[0]; const st = on.find(n => n !== th && n.cfg.spots.some(s => s.seat === 'table4')); if (st) st.who = 'crew-blue';   // test: a sheet with seat art (tint-base crew have none and stand)
      const out = []; if (th) { __T.ambientTo(th.occId || th.slot, 'mess-east'); out.push([__T.ambient.indexOf(th), 'table3']); } if (st) { __T.ambientTo(st.occId || st.slot, 'table-west'); out.push([__T.ambient.indexOf(st), 'table4']); } return out; });
    I.who = who;
    I.through = await p.evaluate(([seats, who]) => new Promise(res => { const hits = new Set(); const t0 = performance.now();
      const carves = Object.entries(seats).map(([id, s]) => [id, s.carve_px]);
      const f = () => { const ppl = [__T.G.lt, ...__T.ambient.filter(n => n.deck === 'lounge' && n.x !== null)];
        for (const q of ppl) { if (q.mode !== 'walk') continue; const x = q.x * 960, y = q.y * 640; for (const [id, r] of carves) if (x > r[0] + 2 && x < r[2] - 2 && y > r[1] + 2 && y < r[3] - 2) hits.add((q.id || 'lt') + '@' + id); }
        const done = __T.G.lt.mode === 'use' && who.every(([i]) => ['dwell', 'chat'].includes(__T.ambient[i].mode));
        if (!done && performance.now() - t0 < 60000) setTimeout(f, 100); else res([...hits]); }; f(); }), [SP.seats, who]);
    fail += I.through.length;
    I.state = await p.evaluate(async (who) => { const A = await import('/js/npc-ambient.js'); const Lt = __T.G.lt;
      return { lt: [Lt.node, Lt.mode], npcs: who.map(([id, seat]) => { const n = __T.ambient[id]; const sn = A.seatedOn(n); return [n.id || n.cfg.id, seat, sn ? sn.id : null, n.mode, n.who, Math.round(n.x * 960), Math.round(n.y * 640)]; }) }; }, who);
    if (I.state.lt[0] !== 'mess' || I.state.lt[1] !== 'use') fail++;
    for (const [id, seat, sat, mode] of I.state.npcs) if (!['dwell', 'chat'].includes(mode) || (mode === 'dwell' && sat !== seat)) fail++;
    await p.screenshot({ path: OUT + `lounge-v2-${tag}.png` });
    rep.errors[tag] = errs; fail += errs.length; await c.close();
  }
  fs.writeFileSync(OUT + 'lounge-shots.json', JSON.stringify(rep, null, 1));
  console.log(JSON.stringify(rep)); console.log(fail ? 'LOUNGE FAIL ' + fail : 'LOUNGE PASS');
  await b.close();
})();
