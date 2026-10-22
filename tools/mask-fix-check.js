// Prop-collision mask fixes: reachability + on-mask for every deck. For each crew deck: every node (+ its stand), every
// CONSOLES work spot and every roster wander spot (resolved as npc-ambient does) must lie on the walk mask (3 px tolerance)
// and be reachable on the 60x40 grid from the deck's lift node (findPath non-null and ending within one cell). Also the
// blocked cells named in BLOCK must be off the grid. ?debug=1 with the walk grid on: shots/mask-fix-<deck>-<label>-<vp>.png
//   node tools/mask-fix-check.js [url] [label] [decks,comma]
const L = require('/workspace/playtest-scripts/lib.js'); const fs = require('fs');
const URL = process.argv[2] || 'http://127.0.0.1:8765/', LABEL = process.argv[3] || 'after';
const DECKS = (process.argv[4] || 'bridge,engineering,medical,berthing,lounge').split(',');
// cells (col,row) that a fix must have taken off the grid
const BLOCK = { medical: [[31, 35, 8, 9]], lounge: [[15, 15, 15, 24]], berthing: [[42, 45, 27, 32], [46, 47, 31, 32]] };   // [col0, col1, row0, row1]; berthing: the cleaned plate opens cols 45-46 rows 34-35 (the new opening) and moves the bench + wall end up into rows 27-32
(async () => {
  const b = await L.launch(); const rep = { label: LABEL, vp: {}, shots: [] }; const errs = [];
  for (const [vp, w, h, m] of [['390x844', 390, 844, 1], ['844x390', 844, 390, 1], ['1280x800', 1280, 800, 0]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: !!m, hasTouch: !!m }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(`${vp} ${e.message}`)); p.on('console', x => { if (x.type() === 'error') errs.push(`${vp} ${x.text()}`); });
    await p.goto(URL + '?debug=1&reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(800);
    const R = rep.vp[vp] = {};
    for (const deck of DECKS) {
      R[deck] = await p.evaluate(async ([deck, BLOCK]) => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
        const D = await import('/js/data.js'), A = await import('/js/assets.js'), NA = await import('/js/npc-ambient.js'), RO = await import('/js/roster.js'), P = await import('/js/path.js');
        const im = A.IMG['walk-' + deck], c = document.createElement('canvas'); c.width = 960; c.height = 640; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 960, 640); const M = x.getImageData(0, 0, 960, 640).data;
        const on = (fx, fy) => { const X = Math.round(fx * 960), Y = Math.round(fy * 640); for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 9 && M[((Y + dy) * 960 + X + dx) * 4] > 127) return true; return false; };
        const nodes = D.DECKS[deck].nodes, lift = D.DECKS[deck].lift || nodes.lift || Object.values(nodes)[0];   // paths start at the deck's lift landing
        const T = [];
        for (const [id, n] of Object.entries(nodes)) { T.push({ kind: 'node', id, x: n.x, y: n.y }); if (n.seat && n.seat.stand) T.push({ kind: 'stand', id, x: n.seat.stand[0], y: n.seat.stand[1] }); }
        for (const [cx, cy, f] of D.CONSOLES[deck] || []) T.push({ kind: 'console', id: `${cx},${cy}`, x: cx / 960, y: cy / 640 });
        for (const sl of RO.CREW_ROSTER) if (sl.deck === deck) for (const s of sl.spots || []) { const r = NA.resolveSpot(deck, s); T.push({ kind: 'spot', id: `${sl.slot}.${s.id}`, x: r.x, y: r.y }); }
        for (const [id, sy] of Object.entries(D.SYSTEMS)) if (sy.deck === deck) T.push({ kind: 'system', id, x: sy.x, y: sy.y });   // repair (task) spots
        const bad = [];
        for (const t of T) { const okMask = on(t.x, t.y); const pth = P.findPath(deck, lift.x, lift.y, t.x, t.y);
          const end = pth && pth.length ? pth[pth.length - 1] : [lift.x, lift.y]; const dist = Math.hypot((end[0] - t.x) * 60, (end[1] - t.y) * 40);
          const okCell = P.isWalkable(deck, t.x, t.y);   // pass 18 A: the spot's own grid cell must be walkable too (not just within 3 px of white)
          t.ok = okMask && okCell && !!pth && dist <= 1.01; if (!t.ok) bad.push({ ...t, okMask, okCell, path: !!pth, endCells: +dist.toFixed(2) }); }
        const stillOpen = []; for (const [c0, c1, r0, r1] of BLOCK[deck] || []) for (let r = r0; r <= r1; r++) for (let cc = c0; cc <= c1; cc++) if (D.DECKS[deck].walk[r * 60 + cc]) stillOpen.push([cc, r]);
        const cells = D.DECKS[deck].walk.filter(Boolean).length;
        // debug view: Lt on this deck, walk grid on
        const DB = await import('/js/render/deck.js'); DB.DBG.walk = true;
        const Lt = __T.G.lt; Lt.deck = deck; Lt.lift = null; Lt.x = lift.x; Lt.y = lift.y; Lt.mode = 'idle'; Lt.path = null; __T.cam.snap = true; __T.cam.manualT = 0;
        return { targets: T.length, bad, stillOpen, cells }; }, [deck, BLOCK]);
      if (R[deck].bad.length || R[deck].stillOpen.length) errs.push(`${vp} ${deck} bad ${JSON.stringify(R[deck].bad).slice(0, 400)} stillOpen ${JSON.stringify(R[deck].stillOpen)}`);
      await L.sleep(900);
      const f = `shots/mask-fix-${deck}-${LABEL}-${vp}.png`; await p.screenshot({ path: f }); rep.shots.push(f);
    }
    await ctx.close();
  }
  rep.errors = errs; fs.writeFileSync(`shots/mask-fix-${LABEL}.json`, JSON.stringify(rep, null, 1));
  for (const [vp, R] of Object.entries(rep.vp)) console.log(vp, Object.entries(R).map(([d, r]) => `${d} ${r.targets} targets, ${r.bad.length} bad, cells ${r.cells}, stillOpen ${r.stillOpen.length}`).join(' | '));
  console.log(errs.length ? 'MASK FIX FAIL' : 'MASK FIX PASS', errs.length, errs.slice(0, 6)); await b.close();
})();
