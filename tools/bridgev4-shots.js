// Bridge v4 (sprites/deck_bridge_v4: LCARS screens + sliding turbolift doors, geometry identical to v3): before/after shots.
// Full bridge at 3 sizes with the bridge crew seated (T'Ren, conn, ops) and the Lt at the port lift, plus 1280x800 @2x crops of
// the port / starboard lifts, the aft wall, conn + ops (fg console fronts over the seated crew) and the centre.
// shots/bridgev4-<label>-<view>-<vp>.png, report shots/bridgev4-<label>.json.   node tools/bridgev4-shots.js <label> [url]
const L = require('/workspace/playtest-scripts/lib.js'); const fs = require('fs');
const LABEL = process.argv[2] || 'after', URL = process.argv[3] || 'http://127.0.0.1:8765/';
const CROPS = { 'lift-port': [140, 30, 300, 200], 'lift-stbd': [680, 20, 840, 200], aft: [300, 0, 660, 180], connops: [260, 380, 700, 540], centre: [360, 160, 600, 360] };
(async () => {
  const b = await L.launch(); const rep = { label: LABEL, shots: [] }; const errs = [];
  for (const [vp, w, h, m] of [['390x844', 390, 844, 1], ['844x390', 844, 390, 1], ['1280x800', 1280, 800, 0], ['1280x800@2x', 1280, 800, 2]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: m === 1, hasTouch: m === 1 }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(`${vp} ${e.message}`)); p.on('console', x => { if (x.type() === 'error') errs.push(`${vp} ${x.text()}`); });
    await p.goto(URL + '?reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(800);
    await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); const G = __T.G; G.ship.nextFault = 1e9;
      const Lt = G.lt; Lt.deck = 'bridge'; Lt.lift = null; Lt.path = null; Lt.node = null; Lt.x = 0.2104; Lt.y = 0.30; Lt.mode = 'idle'; Lt.dir = 'down'; __T.cam.snap = true; __T.cam.manualT = 0; });
    await L.sleep(2500);
    if (vp !== '1280x800@2x') { const f = `shots/bridgev4-${LABEL}-deck-${vp}.png`; await p.screenshot({ path: f }); rep.shots.push(f); }
    else for (const [k, [X0, Y0, X1, Y1]] of Object.entries(CROPS)) {
      const cl = await p.evaluate(([X0, Y0, X1, Y1]) => { const c = __T.cam, rc = document.querySelector('#deck').getBoundingClientRect(), s = c.scale;
        const sx = rc.left + c.w / 2 + (X0 - c.x) * s, sy = rc.top + c.h / 2 + (Y0 - c.y) * s; const x = Math.max(rc.left, sx), y = Math.max(rc.top, sy);
        return { x, y, width: Math.max(8, Math.min((X1 - X0) * s, rc.right - x)), height: Math.max(8, Math.min((Y1 - Y0) * s, rc.bottom - y)) }; }, [X0, Y0, X1, Y1]);
      const f = `shots/bridgev4-${LABEL}-${k}.png`; await p.screenshot({ path: f, clip: cl }); rep.shots.push(f); }
    await ctx.close(); }
  rep.errors = errs; fs.writeFileSync(`shots/bridgev4-${LABEL}.json`, JSON.stringify(rep, null, 1));
  console.log(errs.length ? 'BRIDGEV4 SHOTS FAIL' : 'BRIDGEV4 SHOTS PASS', errs.length, errs.slice(0, 6)); await b.close();
})();
