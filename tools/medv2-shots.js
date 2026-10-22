// Medical v2 (sprites/deck_medical_v2): before/after deck + biobed shots with three patients in the PATIENT_BEDS and the Lt lying
// on his biobed (node lie point), plus the crew at the office / surgery terminal. shots/medv2-<label>-{deck,beds}-<vp>.png,
// report shots/medv2-<label>.json (lie points, console errors).   node tools/medv2-shots.js <label> [url]
const L = require('/workspace/playtest-scripts/lib.js'); const fs = require('fs');
const LABEL = process.argv[2] || 'after', URL = process.argv[3] || 'http://127.0.0.1:8765/';
(async () => {
  const b = await L.launch(); const rep = { label: LABEL, vp: {}, shots: [] }; const errs = [];
  for (const [vp, w, h, m] of [['390x844', 390, 844, 1], ['844x390', 844, 390, 1], ['1280x800', 1280, 800, 0], ['1280x800@2x', 1280, 800, 2]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: m === 1, hasTouch: m === 1 }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(`${vp} ${e.message}`)); p.on('console', x => { if (x.type() === 'error') errs.push(`${vp} ${x.text()}`); });
    await p.goto(URL + '?reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(800);
    rep.vp[vp] = await p.evaluate(async () => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
      const G = __T.G, D = await import('/js/data.js'), DK = await import('/js/render/deck.js'), PR = await import('/js/progression.js');
      G.ship.nextFault = 1e9; if (G.sp && G.sp.ev) G.sp.ev.nextT = -1; if (G.sp && G.sp.cap) G.sp.cap.decideT = 1e9;
      const I = __T.PROG.deaths.injury; I.maxOpen = 9; I.perPlayDay = 9;
      const ids = PR.crewList().filter(c => !c.senior && !c.protected).map(c => c.id).slice(0, 3), got = [];
      for (const id of ids) { const r = __T.MD.injure('hazard', { id, sev: 'minor', what: 'a test' }); if (r) got.push(id); }
      for (const a of __T.ambient) if (a.deck === 'medical' && !['office', 'surgery'].includes(a.spot && a.spot.id)) a.deck = 'nowhere';
      const Lt = G.lt, n = D.DECKS.medical.nodes.biobed; Lt.deck = 'medical'; Lt.lift = null; Lt.path = null; Lt.intent = null; Lt.x = n.x; Lt.y = n.y; Lt.node = 'biobed'; Lt.mode = 'use'; Lt.dir = 'left';
      __T.cam.snap = true; __T.cam.manualT = 0;
      return { patients: got, beds: DK.PATIENT_BEDS.map(([x, y]) => [Math.round(x * 960), Math.round(y * 640)]), lie: n.lie.map((v, i) => Math.round(v * (i ? 640 : 960))) }; });
    await L.sleep(2500);
    const f1 = `shots/medv2-${LABEL}-deck-${vp}.png`; await p.screenshot({ path: f1 }); rep.shots.push(f1);
    const cl = await p.evaluate(() => { const c = __T.cam, rc = document.querySelector('#deck').getBoundingClientRect(), s = c.scale; const X0 = 80, X1 = 320, Y0 = 140, Y1 = 510;
      const sx = rc.left + c.w / 2 + (X0 - c.x) * s, sy = rc.top + c.h / 2 + (Y0 - c.y) * s; const x = Math.max(rc.left, sx), y = Math.max(rc.top, sy);
      return { x, y, width: Math.max(8, Math.min((X1 - X0) * s, rc.right - x)), height: Math.max(8, Math.min((Y1 - Y0) * s, rc.bottom - y)) }; });
    const f2 = `shots/medv2-${LABEL}-beds-${vp}.png`; await p.screenshot({ path: f2, clip: cl }); rep.shots.push(f2);
    await ctx.close(); }
  rep.errors = errs; fs.writeFileSync(`shots/medv2-${LABEL}.json`, JSON.stringify(rep, null, 1));
  console.log(JSON.stringify(rep.vp['1280x800'])); console.log(errs.length ? 'MEDV2 SHOTS FAIL' : 'MEDV2 SHOTS PASS', errs.length, errs.slice(0, 6)); await b.close();
})();
