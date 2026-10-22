// Pass 18 A: the bridge mission-ops / environment work spots (roster msd-port / msd-aft, CONSOLES, nodes) moved from y 341 (grid
// row 21, blocked) to 334 (row 20, floor). A bridge crewmember is sent to each, must arrive, dwell on a walkable cell and type.
// Shots shots/p18-msd-<spot>-<vp>.png; report shots/p18-msd-spot.json.   node tools/p18-msd-spot.js [url]
const L = require('/workspace/playtest-scripts/lib.js'); const fs = require('fs');
const URL = process.argv[2] || 'http://127.0.0.1:8765/';
(async () => {
  const b = await L.launch(); const rep = { vp: {} }; const errs = [];
  for (const [vp, w, h, m] of [['390x844', 390, 844, 1], ['844x390', 844, 390, 1], ['1280x800', 1280, 800, 0]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: !!m, hasTouch: !!m }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(`${vp} ${e.message}`)); p.on('console', x => { if (x.type() === 'error') errs.push(`${vp} ${x.text()}`); });
    await p.goto(URL + '?reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(800);
    await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); });
    const R = rep.vp[vp] = {};
    for (const [slot, spot] of [['tactical', 'msd-port'], ['science', 'msd-aft']]) {
      await p.evaluate(([slot, spot]) => { const Lt = __T.G.lt; Lt.deck = 'bridge'; Lt.lift = null; Lt.x = 0.5; Lt.y = 0.5; Lt.mode = 'idle'; Lt.path = null; __T.cam.snap = true; __T.cam.manualT = 0;
        const n = __T.npcOf(slot); n.deck = 'bridge'; n.x = 0.5; n.y = 0.24; n.mode = 'idle'; n.path = null; __T.ambientTo(slot, spot); }, [slot, spot]);
      let r = null; for (let i = 0; i < 80; i++) { await L.sleep(250); r = await p.evaluate(slot => { const n = __T.npcOf(slot); return { mode: n.mode, spot: n.spot && n.spot.id, x: n.x, y: n.y }; }, slot); if (r.mode === 'dwell' && r.spot === spot) break; }
      await L.sleep(1500);
      const info = await p.evaluate(async ([slot, spot]) => { const P = await import('/js/path.js'), NA = await import('/js/npc-ambient.js'); const n = __T.npcOf(slot);
        return { slot, spot, who: n.who, mode: n.mode, at: [Math.round(n.x * 960), Math.round(n.y * 640)], cell: P.isWalkable('bridge', n.x, n.y), typing: !!NA.consoleNear('bridge', n.x, n.y, 'down', 6), act: n.act || n.action || null }; }, [slot, spot]);
      R[spot] = info; if (info.mode !== 'dwell' || !info.cell || !info.typing) errs.push(`${vp} ${JSON.stringify(info)}`);
      const cl = await p.evaluate(slot => { const n = __T.npcOf(slot), c = __T.cam, rc = document.querySelector('#deck').getBoundingClientRect(), s = c.scale;
        const sx = rc.left + c.w / 2 + (n.x * 960 - c.x) * s, sy = rc.top + c.h / 2 + (n.y * 640 - c.y) * s; const x = Math.max(rc.left, sx - 80 * s), y = Math.max(rc.top, sy - 110 * s);
        return { x, y, width: Math.min(160 * s, rc.right - x), height: Math.min(150 * s, rc.bottom - y) }; }, slot);
      await p.screenshot({ path: `shots/p18-msd-${spot}-${vp}.png`, clip: cl });
    }
    await ctx.close();
  }
  rep.errors = errs; fs.writeFileSync('shots/p18-msd-spot.json', JSON.stringify(rep, null, 1));
  for (const [vp, R] of Object.entries(rep.vp)) console.log(vp, JSON.stringify(R));
  console.log(errs.length ? 'MSD SPOT FAIL' : 'MSD SPOT PASS', errs.length, errs.slice(0, 4)); await b.close();
})();
