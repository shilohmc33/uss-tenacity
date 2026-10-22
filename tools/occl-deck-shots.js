// Pass 18 3b: prove each deck occluder with a walker BEHIND it (feet above its baseY, body overlapping it: the prop must draw
// over him) and IN FRONT (feet below baseY: he draws over the prop). Spots are found on the walk grid (walkable cells only);
// an item with no walkable spot behind it is reported as such. The Lt stands still (idle, facing down), ambient crew are
// parked off-deck. Shots shots/occl-<deck>-<item>-<behind|front>-<vp>.png (crop around the item); report shots/occl-<deck>.json
// with the drawn-occluder list per pose and OCCL_STATS (cut once at load: built / buildMs; per-frame ms).
//   node tools/occl-deck-shots.js <deck> [url] [ids,comma]
const L = require('/workspace/playtest-scripts/lib.js'); const fs = require('fs');
const DECK = process.argv[2] || 'bridge', URL = process.argv[3] || 'http://127.0.0.1:8765/', ONLY = process.argv[4] ? process.argv[4].split(',') : null;
(async () => {
  const b = await L.launch(); const rep = { deck: DECK, vp: {}, shots: [] }; const errs = [];
  for (const [vp, w, h, m] of [['390x844', 390, 844, 1], ['844x390', 844, 390, 1], ['1280x800', 1280, 800, 0]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: !!m, hasTouch: !!m }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(`${vp} ${e.message}`)); p.on('console', x => { if (x.type() === 'error') errs.push(`${vp} ${x.text()}`); });
    await p.goto(URL + '?reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(800);
    await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); });
    const plan = await p.evaluate(async ([deck, only]) => { const D = await import('/js/data.js'), P = await import('/js/path.js'), O = await import('/js/render/occluders.js');
      const items = ((D.DECK_OCCL[deck] || {}).items || []).filter(it => !only || only.includes(it.id)), out = [];
      // P19: a strip of a shared crop cutout (box + polys) answers for its polygon only, like the engine's 'hit' bounds
      for (const it of items) { const [x0, y0, x1, y1] = O.occluderBox(it.box && it.polys ? { polys: it.polys } : it); let behind = null, front = null, bd = 1e9, fd = 1e9; const cx = (x0 + x1) / 2;
        for (let y = y0 - 4; y < it.baseY + 40; y += 2) for (let x = x0 - 16; x <= x1 + 16; x += 2) { if (!P.isWalkable(deck, x / 960, y / 640)) continue;
          const body = [x - 19, y - D.FIG_H, x + 19, y], over = body[2] > x0 + 4 && body[0] < x1 - 4 && body[3] > y0 + 4 && body[1] < y1;
          if (y < it.baseY - 2 && over) { const d = Math.abs(x - cx) + (it.baseY - y) * 0.5; if (d < bd) { bd = d; behind = [x, y]; } }
          if (y > it.baseY + 4 && body[2] > x0 && body[0] < x1) { const d = Math.abs(x - cx) + (y - it.baseY); if (d < fd) { fd = d; front = [x, y]; } } }
        out.push({ id: it.id, box: [x0, y0, x1, y1], baseY: it.baseY, behind, front }); }
      return out; }, [DECK, ONLY]);
    const R = rep.vp[vp] = { items: {} };
    for (const it of plan) { const r = R.items[it.id] = { box: it.box, baseY: it.baseY, behind: it.behind, front: it.front };
      for (const pose of ['behind', 'front']) { const at = it[pose]; if (!at) { r[pose + 'Drawn'] = null; continue; }
        await p.evaluate(([deck, at]) => { for (const a of __T.ambient) a.deck = 'nowhere'; const Lt = __T.G.lt; Lt.deck = deck; Lt.lift = null; Lt.path = null; Lt.intent = null; Lt.node = null;
          Lt.x = at[0] / 960; Lt.y = at[1] / 640; Lt.mode = 'idle'; Lt.face = 'down'; Lt.dir = 'down'; __T.cam.snap = true; __T.cam.manualT = 0; }, [DECK, at]);
        await L.sleep(500);
        r[pose + 'Drawn'] = await p.evaluate(async id => { const O = await import('/js/render/occluders.js'); return O.occlDrawn.includes(id); }, it.id);
        // a seat of this item taken (T'Ren sits at home in the first officer's seat on the bridge) draws it by design
        r.seatTaken = await p.evaluate(async ([deck, id]) => { const D = await import('/js/data.js'), N = await import('/js/npc.js'); const it = D.DECK_OCCL[deck].items.find(q => q.id === id);
          const ts = deck === 'bridge' && N.trenSeat && N.trenSeat(); return !!(it.seats && ts && it.seats.includes(ts.id)) ? ts.id : null; }, [DECK, it.id]);
        const cl = await p.evaluate(([box, at]) => { const c = __T.cam, rc = document.querySelector('#deck').getBoundingClientRect(), s = c.scale;
          const X0 = Math.min(box[0], at[0] - 25) - 12, X1 = Math.max(box[2], at[0] + 25) + 12, Y0 = Math.min(box[1], at[1] - 95) - 8, Y1 = Math.max(box[3], at[1]) + 12;
          const sx = rc.left + c.w / 2 + (X0 - c.x) * s, sy = rc.top + c.h / 2 + (Y0 - c.y) * s; const x = Math.max(rc.left, sx), y = Math.max(rc.top, sy);
          return { x, y, width: Math.max(8, Math.min((X1 - X0) * s, rc.right - x)), height: Math.max(8, Math.min((Y1 - Y0) * s, rc.bottom - y)) }; }, [it.box, at]);
        const f = `shots/occl-${DECK}-${it.id}-${pose}-${vp}.png`; await p.screenshot({ path: f, clip: cl }); rep.shots.push(f); }
      if (it.behind && r.behindDrawn !== true) errs.push(`${vp} ${it.id} not drawn over a walker behind it`);
      if (it.front && r.frontDrawn === true && !r.seatTaken) errs.push(`${vp} ${it.id} drawn although the walker is in front`); }
    R.stats = await p.evaluate(async () => { const O = await import('/js/render/occluders.js'); return { ...O.OCCL_STATS }; });
    await ctx.close(); }
  rep.errors = errs; fs.writeFileSync(`shots/occl-${DECK}.json`, JSON.stringify(rep, null, 1));
  for (const [vp, R] of Object.entries(rep.vp)) console.log(vp, Object.entries(R.items).map(([id, r]) => `${id}: behind ${r.behind ? r.behindDrawn : 'none'} front ${r.front ? r.frontDrawn : 'none'}${r.seatTaken ? ' (seat ' + r.seatTaken + ' taken)' : ''}`).join(' | '), 'stats', JSON.stringify(R.stats));
  console.log(errs.length ? 'OCCL FAIL' : 'OCCL PASS', errs.length, errs.slice(0, 6)); await b.close();
})();
