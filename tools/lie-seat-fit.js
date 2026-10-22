// Art batch 1: LIE_ART / SEAT_ART fit at the option-A scale. For every lie node (biobed, berthing bunk, the quarters rack
// of every cabin tier) and the sickbay patient beds: the art's measured body length (opaque extent along the body, cell px)
// x ART_SCALE x lieFit vs node.lieLen (design px; margin = lieLen - body). For the bridge chair seat: the seated hip
// (seat.at + hip offset) vs the painted cushion centre measured on deck-bridge (CUSHION below), in design px.
// Shots: shots/art1-lie-<node>-<size>.png, shots/art1-patients-<size>.png, shots/art1-seat-chair-<size>.png; report
// shots/art1-fit.json.   usage: node tools/lie-seat-fit.js [url]
const L = require('/workspace/playtest-scripts/lib.js'); const fs = require('fs');
const URL = process.argv[2] || 'http://127.0.0.1:8765/';
const CUSHION = { chair: [0.499, 0.4234] };   // art batch 2: deck_bridge_v3 captain's chair hip (bridge_spots.json hip_px 479,271; was the v2-era cushion 0.495,0.4125)
(async () => {
  const b = await L.launch(); const rep = { lie: {}, seat: {}, shots: [] }; const errs = [];
  for (const [vp, w, h, m] of [['390x844', 390, 844, 1], ['1280x800', 1280, 800, 0]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 3 : 1, isMobile: !!m, hasTouch: !!m }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(`${vp} ${e.message}`)); p.on('console', x => { if (x.type() === 'error') errs.push(`${vp} ${x.text()}`); });
    await p.goto(URL + '?reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(800);
    await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); });
    if (vp === '1280x800') rep.lie = await p.evaluate(async () => {   // numbers (size-independent)
      const D = await import('/js/data.js'), A = await import('/js/assets.js'), H = await import('/js/art-hooks.js'), R = await import('/js/render/deck.js'), C = await import('/js/cabin-data.js');
      const len = img => { const im = A.IMG[img]; const c = document.createElement('canvas'); c.width = 384; c.height = 160; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 384, 160, 0, 0, 384, 160);
        const d = x.getImageData(0, 0, 384, 160).data; let x0 = 384, x1 = -1, y0 = 160, y1 = -1; for (let y = 0; y < 160; y++) for (let xx = 0; xx < 384; xx++) if (d[(y * 384 + xx) * 4 + 3] > 64) { x0 = Math.min(x0, xx); x1 = Math.max(x1, xx); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        return { len: x1 - x0 + 1, wid: y1 - y0 + 1 }; };
      const out = { ART_SCALE: +H.ART_SCALE.toFixed(4), LIE_FIG: R.LIE_FIG, art: {} };
      for (const [k, a] of Object.entries(D.LIE_ART)) { const m = len(a.img); out.art[k] = { img: a.img, lenCell: m.len, widCell: m.wid, lenDesign: +(m.len * H.ART_SCALE).toFixed(1), widDesign: +(m.wid * H.ART_SCALE).toFixed(1) }; }
      const beds = []; const lt = out.art.lt;
      for (const [d, dk] of Object.entries(D.DECKS)) for (const [n, nd] of Object.entries(dk.nodes)) if (nd.lie) beds.push({ bed: `${d}.${n}`, lieLen: nd.lieLen });
      for (const [t, T] of Object.entries(C.CABIN_TIERS)) if (T.bed && T.bed.lieLen) beds.push({ bed: `quarters(${t})`, lieLen: T.bed.lieLen });
      for (const bd of beds) { const fit = R.lieFit(bd.lieLen); bd.fit = +fit.toFixed(3); bd.bodyDesign = +(lt.lenDesign * fit).toFixed(1); bd.margin = +(bd.lieLen - bd.bodyDesign).toFixed(1); bd.ok = bd.margin >= 0; }
      for (const pk of ['patient-red', 'patient-gold', 'patient-blue', 'patient']) { const a = out.art[pk]; beds.push({ bed: `sickbay patient bed (${pk})`, lieLen: 150, fit: 1, bodyDesign: a.lenDesign, margin: +(150 - a.lenDesign).toFixed(1), ok: a.lenDesign <= 150 }); }
      out.beds = beds; out.allFit = beds.every(x => x.ok); return out; });
    // lying shots: the Lt on each lie node of the decks (sends him to use it, waits for the fade)
    for (const [deck, node] of [['medical', 'biobed'], ['berthing', 'bunk'], ['quarters', 'rack']]) {
      const clip = await p.evaluate(async ([deck, node]) => { const D = await import('/js/data.js'); const n = D.DECKS[deck].nodes[node]; for (const a of __T.ambient) a.deck = 'nowhere';
        const L = __T.G.lt; L.deck = deck; L.lift = null; L.x = n.x; L.y = n.y; L.mode = 'idle'; L.path = null; __T.cam.snap = true; await new Promise(r => setTimeout(r, 300)); __T.sendUse(node); await new Promise(r => setTimeout(r, 3500));
        const c = __T.cam, rc = document.querySelector('#deck').getBoundingClientRect(), s = c.scale; const sx = rc.left + c.w / 2 + (n.lie[0] * 960 - c.x) * s, sy = rc.top + c.h / 2 + (n.lie[1] * 640 - c.y) * s;
        return { x: Math.max(0, sx - 110 * s), y: Math.max(0, sy - 90 * s), width: 220 * s, height: 180 * s, mode: L.mode, node: L.node }; }, [deck, node]);
      const { mode, node: nn, ...c } = clip; const f = `shots/art1-lie-${deck}-${node}-${vp}.png`; await p.screenshot({ path: f, clip: c }); rep.shots.push(f);
      if (mode !== 'use' || nn !== node) errs.push(`${vp} ${deck}.${node}: not lying (mode ${mode}, node ${nn})`);
    }
    // patients: hurt three crew so all three sickbay beds are occupied
    const pc = await p.evaluate(async () => { const G = __T.G, occ = Object.values(G.prog.crew.occ).filter(o => !['tren', 'okafor', 'thelev'].includes(o.id)); let n = 0;
      // one patient per uniform colour where possible (patient-red / -gold / -blue art): first crewmate seen per department tint
      const R = await import('/js/roster.js'), seen = new Set(), pick = [];
      for (const o of occ) { const sl = R.SLOTMAP[o.slot], t = sl && R.DEPTS[sl.dept] && R.DEPTS[sl.dept].tint; if (t && !seen.has(t)) { seen.add(t); pick.push(o); } }
      for (const o of occ) if (pick.length < 3 && !pick.includes(o)) pick.push(o);
      G.prog.med.inj = pick.slice(0, 3).map(o => ({ id: o.id, slot: o.slot, short: o.short, name: o.name, cause: 'hazard', what: 'a hazard', sev: 'minor', sys: null, state: 'recovering', at: G.ship.elapsed, pd: G.prog.playDays, day: G.prog.day, left: 1e6, seen: true, seenT: 5, offline: false, ack: true, acked: true, pendT: 0, ackT: 0, away: false, visited: false, excellent: 0, crewSave: false, healAt: G.ship.elapsed + 1e6, crit: false, src: '' })); n = G.prog.med.inj.length;
      const L = __T.G.lt; L.deck = 'medical'; L.lift = null; L.x = 0.42; L.y = 0.62; L.mode = 'idle'; __T.cam.snap = true; await new Promise(r => setTimeout(r, 1200));
      const c = __T.cam, rc = document.querySelector('#deck').getBoundingClientRect(), s = c.scale; const sx = rc.left + c.w / 2 + (0.205 * 960 - c.x) * s, sy = rc.top + c.h / 2 + (0.52 * 640 - c.y) * s;
      return { n, inj: (__T.G.prog.med && __T.G.prog.med.inj || []).length, clip: { x: Math.max(0, sx - 120 * s), y: Math.max(0, sy - 170 * s), width: 260 * s, height: 330 * s } }; });
    { const f = `shots/art1-patients-${vp}.png`; await p.screenshot({ path: f, clip: pc.clip }); rep.shots.push(f); rep['patients' + vp] = { injured: pc.n, onBeds: pc.inj }; }
    // seat
    const st = await p.evaluate(async (CU) => { const D = await import('/js/data.js'); const n = D.NODEMAP.chair; for (const a of __T.ambient) a.deck = 'nowhere'; __T.tren.x = 0.70; __T.tren.y = 0.30;
      const L = __T.G.lt; L.deck = 'bridge'; L.lift = null; L.x = n.x; L.y = n.y; L.mode = 'idle'; __T.cam.snap = true; await new Promise(r => setTimeout(r, 300)); __T.sendUse('chair'); await new Promise(r => setTimeout(r, 3500));
      const off = (n.seat.hip && n.seat.hip[n.seat.face]) || [0, 0], hx = n.seat.at[0] * 960 + off[0], hy = n.seat.at[1] * 640 + off[1];
      const c = __T.cam, rc = document.querySelector('#deck').getBoundingClientRect(), s = c.scale; const sx = rc.left + c.w / 2 + (hx - c.x) * s, sy = rc.top + c.h / 2 + (hy - c.y) * s;
      return { mode: L.mode, node: L.node, hip: [+hx.toFixed(1), +hy.toFixed(1)], cushion: [CU.chair[0] * 960, CU.chair[1] * 640], errPx: +Math.hypot(hx - CU.chair[0] * 960, hy - CU.chair[1] * 640).toFixed(1), screenScale: +s.toFixed(3), clip: { x: Math.max(0, sx - 70 * s), y: Math.max(0, sy - 90 * s), width: 140 * s, height: 150 * s } }; }, CUSHION);
    { const { clip, ...rest } = st; const f = `shots/art1-seat-chair-${vp}.png`; await p.screenshot({ path: f, clip }); rep.shots.push(f); rep.seat[vp] = rest; if (st.mode !== 'use' || st.node !== 'chair') errs.push(`${vp} not seated`); }
    await ctx.close();
  }
  rep.errors = errs; fs.writeFileSync('shots/art1-fit.json', JSON.stringify(rep, null, 1));
  for (const bd of rep.lie.beds) console.log(`${bd.bed.padEnd(34)} lieLen ${bd.lieLen}  fit ${bd.fit}  body ${bd.bodyDesign}  margin ${bd.margin}  ${bd.ok ? 'OK' : 'OVERHANG'}`);
  console.log('seat', JSON.stringify(rep.seat)); console.log('patients', rep['patients390x844'], rep['patients1280x800']); console.log('errors', errs.length, errs.slice(0, 5)); await b.close();
})();
