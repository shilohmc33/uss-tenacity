// Pass 18 (3a): the bridge fg pass -> per-prop occluders, no visual regression.
//  1) pixels: each occluder canvas drawn at the deck transform == fg-bridge drawn clipped to the same box (old drawBridgeFg),
//     compared on an offscreen canvas at 3 camera scales (max channel difference reported).
//  2) decisions: 3000 random standing figures + every seat: the old rule (drawn after everyone when a figure with feet above
//     the baseline overlaps the box, or a seat is taken) vs the new one (sorted at baseY, drawn when a figure behind overlaps).
//  3) staged scenes on the old build and the new (Lt standing behind / in front of the conn console, seated in conn and fo,
//     T'Ren seated, no ambient crew, app paused after one frame): shots/occl-bridge-ab-<scene>-<old|new>-<vp>.png + diff.
//   node tools/occl-bridge-ab.js <newUrl> <oldUrl>
const L = require('/workspace/playtest-scripts/lib.js'); const fs = require('fs');
const NEW = process.argv[2] || 'http://127.0.0.1:8765/', OLD = process.argv[3] || 'http://127.0.0.1:8855/';
const SCENES = [['behind', { x: 0.36, y: 0.765, face: 'down' }], ['front', { x: 0.36, y: 0.83, face: 'up' }], ['seat-conn', { use: 'conn' }], ['seat-fo', { use: 'fo' }]];
(async () => {
  const b = await L.launch(); const rep = { pixels: null, decisions: null, scenes: {} }; const errs = [];
  const open = async (url, w, h, m) => { const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: !!m, hasTouch: !!m }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(`${url} ${e.message}`)); p.on('console', x => { if (x.type() === 'error') errs.push(`${url} ${x.text()}`); });
    await p.goto(url + '?reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(800);
    await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); }); return { ctx, p }; };
  { const { ctx, p } = await open(NEW, 1280, 800, 0);
    rep.pixels = await p.evaluate(async () => { const O = await import('/js/render/occluders.js'), A = await import('/js/assets.js'), D = await import('/js/data.js');
      const items = O.occluders('bridge').filter(o => !o.src), fg = A.IMG['fg-bridge'], out = [];   // the fg-bridge items (3b plate cuts carry their own src)
      for (const s of [1, 1.37, 2.3]) for (const o of items) { const [x0, y0, x1, y1] = o.box, W = Math.ceil((x1 - x0) * s) + 4, H = Math.ceil((y1 - y0) * s) + 4;
        const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.setTransform(s, 0, 0, s, -x0 * s + 2, -y0 * s + 2); return [c, x]; };
        const [ca, a] = mk(); a.save(); a.beginPath(); a.rect(x0, y0, x1 - x0, y1 - y0); a.clip(); a.drawImage(fg, 0, 0, D.DW, D.DH); a.restore();
        const [cb, bb] = mk(); bb.drawImage(o.cv, x0, y0, x1 - x0, y1 - y0);
        const da = a.getImageData(0, 0, W, H).data, db = bb.getImageData(0, 0, W, H).data; let mx = 0, sum = 0, n = 0;
        // interior only (1 screen px in from the box edge: the old path clip and the canvas edge anti-alias differently)
        for (let yy = 3; yy < H - 3; yy++) for (let xx = 3; xx < W - 3; xx++) { const i = (yy * W + xx) * 4; for (let k = 0; k < 4; k++) { const d = Math.abs(da[i + k] - db[i + k]); mx = Math.max(mx, d); sum += d; n++; } }
        out.push({ id: o.id, scale: s, maxDiff: mx, meanDiff: +(sum / n).toFixed(3) }); }
      return out; });
    rep.decisions = await p.evaluate(async () => { const D = await import('/js/data.js'); const items = D.DECK_OCCL.bridge.items.filter(it => !it.src), DW = D.DW, DH = D.DH, FIG_H = D.FIG_H; let n = 0, same = 0; const diff = [];
      let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 3000; i++) { const c = { x: 0.25 + rnd() * 0.5, y: 0.35 + rnd() * 0.5 };
        for (const it of items) { const [x0, y0, x1, y1] = it.box;
          const oldR = c.y * DH < it.baseY && c.x * DW + 19 > x0 && c.x * DW - 19 < x1 && c.y * DH > y0 && c.y * DH - FIG_H < y1;
          const bd = [c.x * DW - 19, c.y * DH - FIG_H, c.x * DW + 19, c.y * DH], newR = c.y * DH < it.baseY && bd[2] > x0 && bd[0] < x1 && bd[3] > y0 && bd[1] < y1;
          n++; if (oldR === newR) same++; else if (diff.length < 8) diff.push({ it: it.id, feet: [Math.round(c.x * DW), Math.round(c.y * DH)], oldR, newR }); } }
      // seats: old = drawn when that seat is taken; new = sorted at baseY: seated hip y must be above baseY so the console lands on top
      const seats = items.flatMap(it => it.seats.map(sid => { const nd = D.NODEMAP[sid] || D.DECKS.bridge.nodes[sid]; return { it: it.id, seat: sid, hipY: Math.round(nd.seat.at[1] * DH), baseY: it.baseY, ok: nd.seat.at[1] * DH < it.baseY }; }));
      return { n, same, diff, seats }; });
    await ctx.close(); }
  // NOAB=1: pixels + decisions only (the old pre-occluder tree is not served)
  if (!process.env.NOAB) for (const [vp, w, h, m] of [['390x844', 390, 844, 1], ['844x390', 844, 390, 1], ['1280x800', 1280, 800, 0]]) for (const [scene, st] of SCENES) for (const [lab, url] of [['old', OLD], ['new', NEW]]) {
    const { ctx, p } = await open(url, w, h, m);
    await p.evaluate(async st => { const CR = await import('/js/crew.js'); const D = await import('/js/data.js'); for (const a of __T.ambient) a.deck = 'nowhere';
      const Lt = __T.G.lt; Lt.deck = 'bridge'; Lt.lift = null; Lt.path = null; Lt.intent = null;
      if (st.use) { const n = D.NODEMAP[st.use]; Lt.x = n.seat ? n.seat.stand[0] : n.x; Lt.y = n.seat ? n.seat.stand[1] : n.y; Lt.mode = 'idle'; CR.sendUse(st.use); }
      else { Lt.x = st.x; Lt.y = st.y; Lt.mode = 'idle'; Lt.face = st.face; Lt.dir = st.face; }
      __T.cam.snap = true; __T.cam.manualT = 0; }, st);
    await L.sleep(st.use ? 2500 : 900);
    await p.evaluate(() => { __T.app.paused = true; });
    await L.sleep(150);
    const f = `shots/occl-bridge-ab-${scene}-${lab}-${vp}.png`;
    const cl = await p.evaluate(() => { const c = __T.cam, rc = document.querySelector('#deck').getBoundingClientRect(), s = c.scale, L = __T.G.lt;
      const sx = rc.left + c.w / 2 + (L.x * 960 - c.x) * s, sy = rc.top + c.h / 2 + (L.y * 640 - c.y) * s; const x = Math.max(0, sx - 110 * s), y = Math.max(0, sy - 120 * s);
      return { x, y, width: Math.min(220 * s, innerWidth - x), height: Math.min(170 * s, innerHeight - y) }; });
    await p.screenshot({ path: f, clip: cl }); (rep.scenes[`${scene}@${vp}`] = rep.scenes[`${scene}@${vp}`] || {})[lab] = { f, fg: await p.evaluate(async () => { const R = await import('/js/render/deck.js'); return [...R.fgDrawn]; }) };
    await ctx.close(); }
  rep.errors = errs; fs.writeFileSync('shots/occl-bridge-ab.json', JSON.stringify(rep, null, 1));
  const px = rep.pixels.reduce((m, r) => Math.max(m, r.maxDiff), 0); console.log('pixels max channel diff', px, 'mean', Math.max(...rep.pixels.map(r => r.meanDiff)));
  console.log('decisions', rep.decisions.same, '/', rep.decisions.n, 'same', JSON.stringify(rep.decisions.diff), 'seats', JSON.stringify(rep.decisions.seats));
  for (const [k, v] of Object.entries(rep.scenes)) console.log(k, 'old fg', JSON.stringify(v.old && v.old.fg), 'new fg', JSON.stringify(v.new && v.new.fg));
  console.log('errors', errs.length, errs.slice(0, 4)); await b.close();
})();
