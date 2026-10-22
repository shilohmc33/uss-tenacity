// Art batch 2 step 1: cabin_v4 checks. For every tier: the plate + walk mask load, demo decor (the artist's _demo_item /
// _fits per slot) drawn at true size, the Lt lying on the rack (lie-lt body vs the bed's lieLen), and the Lt walking
// lift -> desk -> rack stand -> lift on the walk mask at the option-A scale (FIG_H 83 = 0.62 of the old 134), every
// sampled foot position checked against walk-cabin-<tier>.png.
// Shots: shots/art2-cabin-<tier>-<vp>.png (room), -lie-, -walk1/2-; report shots/art2-cabin.json.
// usage: node tools/art2-cabin.js [url] [outPrefix]
const L = require('/workspace/playtest-scripts/lib.js'); const fs = require('fs');
const URL = process.argv[2] || 'http://127.0.0.1:8765/'; const PFX = process.argv[3] || 'shots/art2-cabin';
const TIERS = ['ltjg', 'lt', 'ltcmdr', 'cmdr'];
(async () => {
  const b = await L.launch(); const rep = { tiers: {}, shots: [] }; const errs = [];
  for (const [vp, w, h, m] of [['1280x800', 1280, 800, 0], ['390x844', 390, 844, 1]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 3 : 1, isMobile: !!m, hasTouch: !!m }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(`${vp} ${e.message}`)); p.on('console', x => { if (x.type() === 'error') errs.push(`${vp} ${x.text()}`); });
    await p.goto(URL + '?reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(800);
    await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); for (const a of __T.ambient) a.deck = 'nowhere'; __T.tren.deck = 'bridge'; });
    for (const t of TIERS) {
      const r = await p.evaluate(async (t) => {
        const G = __T.G, CB = __T.CB, A = await import('/js/assets.js'), D = await import('/js/data.js'), H = await import('/js/art-hooks.js'), RD = await import('/js/render/deck.js');
        const J = await (await fetch(`/assets/src/cabin_v4/cabin-${t}.json`)).json();
        const c = G.prog.cabin; G.prog.rank = ['ltjg', 'lt', 'ltcmdr', 'cmdr'].indexOf(t); c.tier = t; c.placed = {}; const T = CB.tier();
        for (const s of J.slots) { const id = s._demo_item || s._fits; if (id && CB.DECOR[id]) { if (!c.owned.includes(id)) c.owned.push(id); if (!Object.values(c.placed).includes(id)) c.placed[s.id] = id; } }
        CB.applyTier();
        const dk = D.DECKS.quarters, im = A.IMG[T.mask]; const cv = document.createElement('canvas'); cv.width = 960; cv.height = 640; const x = cv.getContext('2d'); x.drawImage(im, 0, 0, 960, 640);
        const md = x.getImageData(0, 0, 960, 640).data; window.__onMask = (fx, fy) => { const px = Math.round(fx * 960), py = Math.round(fy * 640); return md[(py * 960 + px) * 4] > 127; };
        window.__offBy = (fx, fy) => { const px = Math.round(fx * 960), py = Math.round(fy * 640); for (let r = 0; r <= 24; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const X = px + dx, Y = py + dy; if (X >= 0 && Y >= 0 && X < 960 && Y < 640 && md[(Y * 960 + X) * 4] > 127 && Math.hypot(dx, dy) <= r) return Math.hypot(dx, dy); } return 99; };
        const drawn = Object.entries(c.placed).map(([sid, id]) => { const sl = CB.slotById(sid), d = CB.DECOR[id]; const k = d.art ? CB.decorScale(d, sl) : null;
          return { slot: sid, item: id, slotBox: [+(sl.w * 960).toFixed(1), +(sl.h * 640).toFixed(1)], art: d.art || null, scale: k == null ? null : +k.toFixed(3), img: !!A.IMG['decor-' + id] }; });
        const hidden = T.slots.filter(s => s.hidden).map(s => s.id);
        // lie fit
        const lt = D.LIE_ART.lt, lim = A.IMG[lt.img]; const c2 = document.createElement('canvas'); c2.width = 384; c2.height = 160; const x2 = c2.getContext('2d'); x2.drawImage(lim, 0, 0, 384, 160, 0, 0, 384, 160);
        const d2 = x2.getImageData(0, 0, 384, 160).data; let x0 = 384, x1 = -1; for (let yy = 0; yy < 160; yy++) for (let xx = 0; xx < 384; xx++) if (d2[(yy * 384 + xx) * 4 + 3] > 64) { x0 = Math.min(x0, xx); x1 = Math.max(x1, xx); }
        const fit = RD.lieFit(T.bed.lieLen), body = (x1 - x0 + 1) * H.ART_SCALE * fit;
        return { plate: dk.plate, plateLoaded: !!A.IMG[T.plate], walkSrc: dk.walkSrc, desk: { ...dk.nodes.desk }, rack: { lie: dk.nodes.rack.lie, lieRot: +(dk.nodes.rack.lieRot || 0).toFixed(4), lieLen: dk.nodes.rack.lieLen },
          lieFit: { lieLen: T.bed.lieLen, fit: +fit.toFixed(3), bodyDesign: +body.toFixed(1), margin: +(T.bed.lieLen - body).toFixed(1), ok: body <= T.bed.lieLen },
          figH: D.FIG_H, figK: +(D.FIG_H / 134).toFixed(3), drawn, hidden, visibleSlots: CB.slots().length,
          nodesOnMask: { lift: __onMask(T.lift.x, T.lift.y), desk: __onMask(T.desk.x, T.desk.y), rack: __onMask(T.bed.x, T.bed.y) } };
      }, t);
      // room shot (Lt at the lift)
      const roomShot = async (name) => { const f = `${PFX}-${t}-${name}-${vp}.png`; await p.screenshot({ path: f }); rep.shots.push(f); };
      await p.evaluate(() => { const T = __T.CB.tier(), L = __T.G.lt; L.lift = null; L.deck = 'quarters'; L.x = T.lift.x; L.y = T.lift.y + 0.02; L.mode = 'idle'; L.path = null; L.node = null; L.intent = null; __T.cam.snap = true; __T.cam.manualT = 0; });
      await L.sleep(1500); await roomShot('room');
      // walk: lift -> desk, desk -> rack (lie), rack -> lift; sample feet every 80 ms
      const walk = async (go, label, shotAt) => p.evaluate(async ([go, shotAt]) => {
        const L = __T.G.lt, tr = []; if (go === 'lift') { const T = __T.CB.tier(); __T.sendTo(T.lift.x, T.lift.y); } else __T.sendUse(go, { force: true });
        let t0 = performance.now(), shot = null; while (performance.now() - t0 < 15000) { await new Promise(r => setTimeout(r, 80)); tr.push([L.x, L.y]); if (L.mode !== 'walk' && tr.length > 3) break; }
        const offS = tr.filter(([x, y]) => !__onMask(x, y)), off = offS.length, offMax = offS.length ? +Math.max(...offS.map(([x, y]) => __offBy(x, y))).toFixed(1) : 0; let len = 0; for (let i = 1; i < tr.length; i++) len += Math.hypot((tr[i][0] - tr[i - 1][0]) * 960, (tr[i][1] - tr[i - 1][1]) * 640);
        return { samples: tr.length, offMask: off, offMaxPx: offMax, lenPx: Math.round(len), end: [+L.x.toFixed(4), +L.y.toFixed(4)], mode: L.mode, node: L.node };
      }, [go, shotAt]);
      const w1 = await walk('desk'); await L.sleep(500); await roomShot('walk1-desk');
      const w2 = await walk('rack'); await L.sleep(3500);
      // lie close-up
      const clip = await p.evaluate(() => { const n = __T.CB.tier().bed, c = __T.cam, rc = document.querySelector('#deck').getBoundingClientRect(), s = c.scale;
        const sx = rc.left + c.w / 2 + (n.lie[0] * 960 - c.x) * s, sy = rc.top + c.h / 2 + (n.lie[1] * 640 - c.y) * s;
        return { x: Math.max(0, sx - 110 * s), y: Math.max(0, sy - 110 * s), width: Math.min(220 * s, innerWidth), height: Math.min(220 * s, innerHeight), lmode: __T.G.lt.mode, lnode: __T.G.lt.node }; });
      const { lmode, lnode, ...cl } = clip; { const f = `${PFX}-${t}-lie-${vp}.png`; await p.screenshot({ path: f, clip: cl }); rep.shots.push(f); }
      const w3 = await walk('lift'); await L.sleep(300); await roomShot('walk2-back');
      r.walk = { toDesk: w1, toRack: w2, back: w3 }; r.lying = { mode: lmode, node: lnode };
      if (!r.plateLoaded || r.walkSrc !== 'mask') errs.push(`${vp} ${t}: plate/mask not loaded`);
      // the path grid is 16 px cells (path.js sampleMask: a cell is floor when >= half its pixels are), so feet may graze the
      // mask edge by up to half a cell; more than 8 px off the painted floor is a real failure
      if (Math.max(w1.offMaxPx, w2.offMaxPx, w3.offMaxPx) > 8) errs.push(`${vp} ${t}: feet ${Math.max(w1.offMaxPx, w2.offMaxPx, w3.offMaxPx)} px off the mask`);
      if (w1.node !== 'desk') errs.push(`${vp} ${t}: did not reach desk (${w1.mode} ${w1.node})`);
      if (lmode !== 'use' || lnode !== 'rack') errs.push(`${vp} ${t}: not lying (${lmode} ${lnode})`);
      if (!r.lieFit.ok) errs.push(`${t}: lie overhang`);
      rep.tiers[t + '@' + vp] = r;
    }
    await ctx.close();
  }
  rep.errors = errs; fs.writeFileSync(PFX + '.json', JSON.stringify(rep, null, 1));
  for (const [k, r] of Object.entries(rep.tiers)) console.log(k.padEnd(16), `lieLen ${r.lieFit.lieLen} body ${r.lieFit.bodyDesign} margin ${r.lieFit.margin} rot ${r.rack.lieRot}`, `walk off ${r.walk.toDesk.offMask}/${r.walk.toRack.offMask}/${r.walk.back.offMask} (max ${Math.max(r.walk.toDesk.offMaxPx, r.walk.toRack.offMaxPx, r.walk.back.offMaxPx)} px) len ${r.walk.toDesk.lenPx}/${r.walk.toRack.lenPx}/${r.walk.back.lenPx}`, `lying ${r.lying.mode}/${r.lying.node}`, 'drawn', r.drawn.map(d => `${d.item}@${d.slot}x${d.scale}`).join(' '), 'hidden', r.hidden.join(','));
  console.log('errors', errs.length, errs.slice(0, 8)); await b.close();
})();
