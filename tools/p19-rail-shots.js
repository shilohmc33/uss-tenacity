// P19 HOLD: Engineering railing-front at the ring's SW / SE corners. The Lt stands IN FRONT of the rail (repro points
// (0.408,0.463) / (0.558,0.463), feet below the rail's local bottom edge: no railing piece may draw over him) and BEHIND it
// (same x, feet at y 268, above the local edge: the rail must draw over his legs). Reports occlDrawn per pose and walkability.
// shots/p19-rail-<label>-<sw|se>-<front|behind>-<vp>.png, report shots/p19-rail-<label>.json.   node tools/p19-rail-shots.js <label> [url]
const L = require('/workspace/playtest-scripts/lib.js'); const fs = require('fs');
const LABEL = process.argv[2] || 'after', URL = process.argv[3] || 'http://127.0.0.1:8765/';
const POSES = { 'sw-front': [0.408, 0.463], 'sw-behind': [0.408, 268 / 640], 'se-front': [0.558, 0.463], 'se-behind': [0.558, 268 / 640] };
(async () => {
  const b = await L.launch(); const rep = { label: LABEL, vp: {}, shots: [] }; const errs = [];
  for (const [vp, w, h, m] of [['390x844', 390, 844, 1], ['844x390', 844, 390, 1], ['1280x800', 1280, 800, 0]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: !!m, hasTouch: !!m }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(`${vp} ${e.message}`)); p.on('console', x => { if (x.type() === 'error') errs.push(`${vp} ${x.text()}`); });
    await p.goto(URL + '?reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(800);
    await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); __T.G.ship.nextFault = 1e9; for (const a of __T.ambient) a.deck = 'nowhere'; });
    rep.vp[vp] = {};
    for (const [k, at] of Object.entries(POSES)) {
      await p.evaluate(at => { const Lt = __T.G.lt; Lt.deck = 'engineering'; Lt.lift = null; Lt.path = null; Lt.intent = null; Lt.node = null;
        Lt.x = at[0]; Lt.y = at[1]; Lt.mode = 'idle'; Lt.face = 'down'; Lt.dir = 'down'; __T.cam.snap = true; __T.cam.manualT = 0; }, at);
      await L.sleep(600);
      const r = await p.evaluate(async at => { const O = await import('/js/render/occluders.js'), P = await import('/js/path.js');
        const c = __T.cam, rc = document.querySelector('#deck').getBoundingClientRect(), s = c.scale, X0 = at[0] * 960 - 60, X1 = at[0] * 960 + 60, Y0 = at[1] * 640 - 100, Y1 = at[1] * 640 + 25;
        const sx = rc.left + c.w / 2 + (X0 - c.x) * s, sy = rc.top + c.h / 2 + (Y0 - c.y) * s, x = Math.max(rc.left, sx), y = Math.max(rc.top, sy);
        return { rail: O.occlDrawn.filter(i => i.startsWith('railing')), walkable: P.isWalkable('engineering', at[0], at[1]),
          clip: { x, y, width: Math.max(8, Math.min((X1 - X0) * s, rc.right - x)), height: Math.max(8, Math.min((Y1 - Y0) * s, rc.bottom - y)) } }; }, at);
      const f = `shots/p19-rail-${LABEL}-${k}-${vp}.png`; await p.screenshot({ path: f, clip: r.clip }); rep.shots.push(f); delete r.clip; rep.vp[vp][k] = r;
      if (LABEL === 'after' && k.endsWith('front') && r.rail.length) errs.push(`${vp} ${k}: rail drawn over the Lt ${r.rail}`);
      if (LABEL === 'after' && k.endsWith('behind') && !r.rail.length) errs.push(`${vp} ${k}: rail not drawn over the Lt behind it`); }
    await ctx.close(); }
  rep.errors = errs; fs.writeFileSync(`shots/p19-rail-${LABEL}.json`, JSON.stringify(rep, null, 1));
  console.log(JSON.stringify(rep.vp['390x844'])); console.log(errs.length ? 'P19 RAIL FAIL' : 'P19 RAIL PASS', errs.length, errs.slice(0, 6)); await b.close();
})();
