// Art batch 2 step 3: deck_bridge_v3 checks (hi-res plate + fg since suite 20: deck_bridge_v3_hires). Numbers: per seat, the engine hip (seat.at + hip offset, design px) vs the
// artist's hip point (bridge_spots.json seats[].hip_px) = hip error; every node / stand / lift point on walk-bridge.png.
// Live: the Lt sits in all 5 seats (fg occluders drawn for the right seat), walks lift -> each station / second lift
// with every foot sample checked on the mask, T'Ren seated at home, the conn / ops crew seated (NPC seat hook).
// Shots: shots/art2-bridge-<what>-<vp>.png; report shots/art2-bridge.json.   usage: node tools/art2-bridge.js [url]
const L = require('/workspace/playtest-scripts/lib.js'); const fs = require('fs');
const URL = process.argv[2] || 'http://127.0.0.1:8765/';
const SEATS = ['chair', 'fo', 'counsel', 'conn', 'ops'], STATIONS = ['tactical', 'msd', 'science2', 'engineering', 'engineering2', 'mission_ops', 'environment', 'lift2'];
(async () => {
  const b = await L.launch(); const rep = { vp: {}, shots: [] }; const errs = [];
  for (const [vp, w, h, m] of [['1280x800', 1280, 800, 0], ['390x844', 390, 844, 1], ['844x390', 844, 390, 1]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 3 : 1, isMobile: !!m, hasTouch: !!m }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(`${vp} ${e.message}`)); p.on('console', x => { if (x.type() === 'error') errs.push(`${vp} ${x.text()}`); });
    await p.goto(URL + '?reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(800);
    const R = rep.vp[vp] = { seats: {}, walks: {}, npc: {} };
    R.static = await p.evaluate(async () => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
      const D = await import('/js/data.js'), A = await import('/js/assets.js'); const J = await (await fetch('/assets/src/deck_bridge_v3_hires/bridge_spots.json')).json();
      const im = A.IMG['walk-bridge']; const cv = document.createElement('canvas'); cv.width = 960; cv.height = 640; const x = cv.getContext('2d'); x.drawImage(im, 0, 0, 960, 640);
      const md = x.getImageData(0, 0, 960, 640).data; window.__onMask = (fx, fy) => md[(Math.round(fy * 640) * 960 + Math.round(fx * 960)) * 4] > 127;
      const dk = D.DECKS.bridge, out = { plate: dk.plate, plateLoaded: !!A.IMG['deck-bridge'], fgLoaded: !!A.IMG['fg-bridge'], plateSize: A.IMG['deck-bridge'] && [A.IMG['deck-bridge'].width, A.IMG['deck-bridge'].height], fgSize: A.IMG['fg-bridge'] && [A.IMG['fg-bridge'].width, A.IMG['fg-bridge'].height], walkSrc: dk.walkSrc, hip: {}, onMask: {}, consoles: D.CONSOLES.bridge.length };
      const seatsJ = Array.isArray(J.seats) ? Object.fromEntries(J.seats.map(s => [s.id || s.name, s])) : J.seats;
      for (const id of ['chair', 'fo', 'counsel', 'conn', 'ops']) { const n = dk.nodes[id], st = n.seat, off = st.hip.down, hx = st.at[0] * 960 + off[0], hy = st.at[1] * 640 + off[1];
        const js = seatsJ[id], hp = js && (js.hip_px || (js.hip && js.hip.px) || js.hip); out.hip[id] = { engine: [+hx.toFixed(1), +hy.toFixed(1)], artist: hp, errPx: hp ? +Math.hypot(hx - hp[0], hy - hp[1]).toFixed(2) : null, standOnMask: __onMask(st.stand[0], st.stand[1]) }; }
      for (const [id, n] of Object.entries(dk.nodes)) out.onMask[id] = __onMask(n.x, n.y);
      out.onMask.lift = __onMask(dk.lift.x, dk.lift.y); out.onMask.lift2 = __onMask(dk.lift2.x, dk.lift2.y);
      for (const [x, y] of D.CONSOLES.bridge) out.onMask['console' + x + '_' + y] = __onMask(x / 960, y / 640);
      return out; });
    const toBridge = () => p.evaluate(() => { const L = __T.G.lt, D = __T; L.deck = 'bridge'; L.lift = null; const lf = { x: 0.2104, y: 0.275 }; L.x = lf.x; L.y = lf.y; L.mode = 'idle'; L.path = null; L.node = null; L.intent = null; __T.cam.snap = true; __T.cam.manualT = 0; });
    const clipAt = (fx, fy, ww = 150, hh = 140) => p.evaluate(([fx, fy, ww, hh]) => { const c = __T.cam, rc = document.querySelector('#deck').getBoundingClientRect(), s = c.scale; const sx = rc.left + c.w / 2 + (fx * 960 - c.x) * s, sy = rc.top + c.h / 2 + (fy * 640 - c.y) * s;
      const x = Math.max(0, sx - ww / 2 * s), y = Math.max(0, sy - hh * 0.7 * s); return { x, y, width: Math.min(ww * s, innerWidth - x), height: Math.min(hh * s, innerHeight - y) }; }, [fx, fy, ww, hh]);
    // seats (the Lt), others moved off the dais so each shot shows one figure
    for (const id of SEATS) {
      await toBridge(); await p.evaluate(() => { for (const a of __T.ambient) a.deck = 'nowhere'; __T.tren.x = 0.8625; __T.tren.y = 0.55; __T.tren.mode = 'station'; __T.tren.t = 999; __T.tren.spot = { x: 0.8625, y: 0.55, face: 'right' }; });
      const r = await p.evaluate(async (id) => { __T.sendUse(id, { force: true }); const t0 = performance.now(); while (performance.now() - t0 < 15000) { await new Promise(r => setTimeout(r, 100)); const L = __T.G.lt; if (L.mode === 'use' && L.node === id) break; }
        await new Promise(r => setTimeout(r, 900)); const R = await import('/js/render/deck.js'); const L = __T.G.lt; return { mode: L.mode, node: L.node, blend: +R.lieBlend().toFixed(2), fg: [...R.fgDrawn] }; }, id);
      const n = await p.evaluate((id) => __T.G && (window.__nodeAt = id) && null, id);
      const at = await p.evaluate(async (id) => { const D = await import('/js/data.js'); return D.DECKS.bridge.nodes[id].seat.at; }, id);
      const f = `shots/art2-bridge-seat-${id}-${vp}.png`; await p.screenshot({ path: f, clip: await clipAt(at[0], at[1] + 0.06, 150, 150) }); rep.shots.push(f);
      R.seats[id] = r; if (r.mode !== 'use' || r.node !== id || r.blend < 1) errs.push(`${vp} seat ${id}: not seated (${r.mode} ${r.node} ${r.blend})`);
    }
    // walks: lift -> each station, feet on the mask
    for (const id of STATIONS) {
      await toBridge();
      const r = await p.evaluate(async (id) => { const L = __T.G.lt, tr = []; __T.sendUse(id, { force: true }); const t0 = performance.now();
        while (performance.now() - t0 < 20000) { await new Promise(r => setTimeout(r, 80)); tr.push([L.x, L.y]); if (L.mode !== 'walk' && tr.length > 3) break; }
        const off = tr.filter(([x, y]) => !__onMask(x, y)).length; const lp = document.querySelector('#liftPanel');
        return { samples: tr.length, offMask: off, end: [+L.x.toFixed(4), +L.y.toFixed(4)], mode: L.mode, node: L.node, liftPanel: lp ? !lp.hidden : null }; }, id);
      R.walks[id] = r;
      if (id === 'lift2' ? !r.liftPanel : (r.node !== id || r.mode !== 'use')) errs.push(`${vp} walk ${id}: ${JSON.stringify(r)}`);
      if (r.offMask) errs.push(`${vp} walk ${id}: ${r.offMask} off-mask samples`);
      if (['tactical', 'mission_ops', 'engineering2', 'lift2'].includes(id) && vp !== '844x390') { const n = await p.evaluate(async (id) => { const D = await import('/js/data.js'); const n = D.DECKS.bridge.nodes[id]; return [n.x, n.y]; }, id);
        const f = `shots/art2-bridge-walk-${id}-${vp}.png`; await p.screenshot({ path: f, clip: await clipAt(n[0], n[1], 180, 150) }); rep.shots.push(f); }
      if (id === 'lift2') { // ride from the second door: boards there, arrives at Engineering's main lift
        const ride = await p.evaluate(async () => { const C = await import('/js/crew.js'); C.rideLiftTo('engineering'); await new Promise(r => setTimeout(r, 400)); const L = __T.G.lt; const s = { mode: L.mode, lift: !!L.lift };
          const t0 = performance.now(); while (performance.now() - t0 < 8000 && L.deck !== 'engineering') await new Promise(r => setTimeout(r, 100)); return { ...s, deck: L.deck }; });
        R.walks.lift2Ride = ride; if (ride.deck !== 'engineering') errs.push(`${vp} lift2 ride failed ${JSON.stringify(ride)}`);
        await p.evaluate(() => document.querySelectorAll('#liftPanel').forEach(e => e.hidden = true));
      }
    }
    // T'Ren seated at home + the NPC seat hook at conn / ops
    await toBridge();
    R.npc = await p.evaluate(async () => { const N = await import('/js/npc.js'), A = await import('/js/npc-ambient.js'), D = await import('/js/data.js');
      const L = __T.G.lt; L.x = 0.27; L.y = 0.34; L.mode = 'idle';
      const t = __T.tren; t.x = D.TREN.home.x; t.y = D.TREN.home.y; t.mode = 'home'; t.t = 999; t.path = null; t.spot = D.TREN.home;
      const out = { conn: null, ops: null };
      for (const [slot, spot] of [['conn', 'helm'], ['ops', 'ops']]) { const n = __T.npcOf(slot); if (!n) continue; n.deck = 'bridge';
        out[slot] = { occ: n.occId, sheet: n.who, natural: !!(await import('/js/art-hooks.js')).seatArt(n.who) };
        if (!out[slot].natural) { n.who = slot === 'conn' ? 'crew-gold' : 'crew-blue'; const o = __T.G.prog.crew.occ[n.occId]; if (o) o.sheet = n.who; }   // test the hook with a seat-capable sheet (also on the occupant, so a roster resync keeps it; test page, never saved)
        const s = n.cfg.spots.find(p => p.id === spot); n.x = s.x; n.y = s.y - 0.02; __T.ambientTo(slot, spot); }
      await new Promise(r => setTimeout(r, 4000));
      const R = await import('/js/render/deck.js');
      for (const slot of ['conn', 'ops']) { const n = __T.npcOf(slot); if (n && out[slot]) { const sn = A.seatedOn(n); out[slot].seated = sn ? sn.id : null; out[slot].mode = n.mode; out[slot].drawnSheet = n.who; } }
      out.tren = { seated: N.trenSeat() ? N.trenSeat().id : null, mode: t.mode }; out.fg = [...R.fgDrawn];
      return out; });
    for (const s of ['conn', 'ops']) if (R.npc[s] && R.npc[s].seated !== s) errs.push(`${vp} npc ${s} not seated ${JSON.stringify(R.npc[s])}`);
    if (R.npc.tren.seated !== 'fo') errs.push(`${vp} T'Ren not seated ${JSON.stringify(R.npc.tren)}`);
    { const f = `shots/art2-bridge-crew-seated-${vp}.png`; await p.screenshot({ path: f, clip: await clipAt(0.5, 0.62, 330, 300) }); rep.shots.push(f); }
    { const f = `shots/art2-bridge-full-${vp}.png`; await p.screenshot({ path: f }); rep.shots.push(f); }
    await ctx.close();
  }
  rep.errors = errs; fs.writeFileSync('shots/art2-bridge.json', JSON.stringify(rep, null, 1));
  const R = rep.vp['1280x800']; console.log('static', JSON.stringify(R.static.hip), 'offmask nodes', Object.entries(R.static.onMask).filter(([, v]) => !v).map(([k]) => k).join(',') || 'none', 'plate', R.static.plateLoaded, 'fg', R.static.fgLoaded, R.static.walkSrc);
  for (const [vp, V] of Object.entries(rep.vp)) { console.log(vp, 'seats', Object.entries(V.seats).map(([k, v]) => `${k}:${v.mode}/${v.blend}/fg[${v.fg}]`).join(' '));
    console.log(vp, 'walks', Object.entries(V.walks).map(([k, v]) => `${k}:${v.node || v.deck}/${v.offMask ?? ''}`).join(' ')); console.log(vp, 'npc', JSON.stringify(V.npc)); }
  console.log('errors', errs.length, errs.slice(0, 10)); await b.close();
})();
