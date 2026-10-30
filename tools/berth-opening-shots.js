// Addition C: the cleaned Berthing plate (decks_berthing_fix_v1). The lift vestibule reaches the starboard bay only through the
// new opening (744,534,42,61 design px): findPath from the lift node to the bay must pass it, and nothing walks over the
// squashed bench / alcove wall end. Shots of the Lt standing in the opening: shots/berth-opening-<vp>.png; report
// shots/berth-opening.json.   node tools/berth-opening-shots.js [url]
const L = require('/workspace/playtest-scripts/lib.js'); const fs = require('fs'), path = require('path');
const OUT = path.resolve(__dirname, '..', 'shots') + '/';
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}
const URL = process.argv[2] || 'http://127.0.0.1:8765/';
(async () => {
  const b = await L.launch(); const rep = { vp: {}, shots: [] }; const errs = [];
  for (const [vp, w, h, m] of [['390x844', 390, 844, 1], ['844x390', 844, 390, 1], ['1280x800', 1280, 800, 0]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: !!m, hasTouch: !!m }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(`${vp} ${e.message}`)); p.on('console', x => { if (x.type() === 'error') errs.push(`${vp} ${x.text()}`); });
    await p.goto(URL + '?reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(800);
    await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); });
    const r = rep.vp[vp] = await p.evaluate(async () => { const D = await import('/js/data.js'), P = await import('/js/path.js');
      const lift = D.DECKS.berthing.lift, bay = [820 / 960, 560 / 640];
      const path = P.findPath('berthing', lift.x, lift.y, bay[0], bay[1]) || [];
      const pts = [[lift.x, lift.y], ...path], inOpen = ([x, y]) => x * 960 >= 740 && x * 960 <= 790 && y * 640 >= 530 && y * 640 <= 600;   // the path is string-pulled: sample its segments
      let viaOpening = false; for (let i = 1; i < pts.length; i++) for (let t = 0; t <= 1; t += 0.02) if (inOpen([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t])) viaOpening = true;
      const bench = [[690, 450], [720, 480], [750, 500], [770, 520]].filter(([x, y]) => P.isWalkable('berthing', x / 960, y / 640));
      return { pathLen: path.length, viaOpening, end: path.length ? path[path.length - 1].map((v, i) => Math.round(v * (i ? 640 : 960))) : null,
        openingWalkable: P.isWalkable('berthing', 765 / 960, 565 / 640), benchWalkable: bench }; });
    if (!r.pathLen || !r.viaOpening) errs.push(`${vp} lift -> bay path does not use the opening`);
    if (!r.openingWalkable) errs.push(`${vp} opening not walkable`);
    if (r.benchWalkable.length) errs.push(`${vp} bench/wall walkable at ${JSON.stringify(r.benchWalkable)}`);
    for (const [pose, at] of [['in', [765, 566]], ['bay', [812, 556]]]) {
      await p.evaluate(at => { for (const a of __T.ambient) a.deck = 'nowhere'; const Lt = __T.G.lt; Lt.deck = 'berthing'; Lt.lift = null; Lt.path = null; Lt.intent = null; Lt.node = null;
        Lt.x = at[0] / 960; Lt.y = at[1] / 640; Lt.mode = 'idle'; Lt.face = 'left'; Lt.dir = 'left'; __T.cam.snap = true; __T.cam.manualT = 0; }, at);
      await L.sleep(500);
      const cl = await p.evaluate(() => { const c = __T.cam, rc = document.querySelector('#deck').getBoundingClientRect(), s = c.scale; const X0 = 620, X1 = 900, Y0 = 400, Y1 = 630;
        const sx = rc.left + c.w / 2 + (X0 - c.x) * s, sy = rc.top + c.h / 2 + (Y0 - c.y) * s; const x = Math.max(rc.left, sx), y = Math.max(rc.top, sy);
        return { x, y, width: Math.max(8, Math.min((X1 - X0) * s, rc.right - x)), height: Math.max(8, Math.min((Y1 - Y0) * s, rc.bottom - y)) }; });
      const f = `shots/berth-opening-${pose}-${vp}.png`; await p.screenshot({ path: f, clip: cl }); rep.shots.push(f); }
    await ctx.close(); }
  rep.errors = errs; fs.writeFileSync(OUT + 'berth-opening.json', JSON.stringify(rep, null, 1));
  for (const [vp, r] of Object.entries(rep.vp)) console.log(vp, JSON.stringify(r));
  console.log(errs.length ? 'BERTH OPENING FAIL' : 'BERTH OPENING PASS', errs.length, errs.slice(0, 6)); await b.close();
})();
