// Art-hook check (pass 08): injects generated stand-in art at runtime (no files are added) and proves each hook draws:
//   LIE_ART.lt / LIE_ART.patient (384x160 cells, head left, hip anchor, A/B), SEAT_ART.lt + chair seat spot (walks to
//   seat.stand and sits), TINT_BASES (a grey-uniform copy of tren-v1, department colour applied at draw time).
// Also checks the fallbacks: with the entries removed the legacy render returns. Shots: shots/anim-hook-<vp>-*.png
// Usage: [BASE=http://127.0.0.1:8765/] node tools/anim-hook-check.js   (the main tree's server; 8812 no longer serves the game)
const L = require('/workspace/playtest-scripts/lib.js');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const OUT = '/workspace/tenacity/shots/';
(async () => {
  const b = await L.launch(); let fail = 0; const res = {};
  for (const vp of ['phone', 'desk']) {
    const { p } = await L.mk(b, vp);
    await p.addInitScript(() => { window.__HD = []; const P = CanvasRenderingContext2D.prototype, o = P.drawImage; P.drawImage = function (img, ...a) { if (this.canvas.id === 'deck' && img && img.__tag) window.__HD.push(img.__tag); else if (img && img.__tag && a.length === 8) window.__HD.push(img.__tag); return o.call(this, img, ...a); }; });
    await p.goto(BASE + '?debug=1&reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(800);
    await p.evaluate(async () => {
      document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
      const D = await import('/js/data.js'), A = await import('/js/assets.js');
      const mk = (w, h, fn, tag) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d', { willReadFrequently: true })); c.__tag = tag; return c; };
      // lying: two 384x160 cells, head (circle) at the left, hip centre (192,80) marked, B breathes wider
      A.IMG['test-lie'] = mk(768, 160, x => { for (const k of [0, 1]) { const o = k * 384; x.fillStyle = '#2a2f3a'; x.fillRect(o + 70, 60 - k * 2, 250, 40 + k * 4); x.fillStyle = '#e8c4a0'; x.beginPath(); x.arc(o + 50, 80, 26, 0, 7); x.fill(); x.fillStyle = '#c8463c'; x.fillRect(o + 90, 60 - k * 2, 60, 40 + k * 4); x.fillStyle = '#ff0'; x.fillRect(o + 188, 76, 8, 8); } }, 'test-lie');
      // seated: columns up/down, rows A/B; hip at (80,300)
      A.IMG['test-seat'] = mk(320, 768, x => { for (const col of [0, 1]) for (const row of [0, 1]) { const ox = col * 160, oy = row * 384; x.fillStyle = '#2a2f3a'; x.fillRect(ox + 45, oy + 160, 70, 150); x.fillRect(ox + 40, oy + 290, 80, 30 + row * 2); x.fillStyle = '#e8c4a0'; x.beginPath(); x.arc(ox + 80, oy + 130 - row * 2, 30, 0, 7); x.fill(); x.fillStyle = col ? '#c8463c' : '#555'; x.fillRect(ox + 45, oy + 165, 70, 22); x.fillStyle = '#ff0'; x.fillRect(ox + 76, oy + 296, 8, 8); } }, 'test-seat');
      // tint base: tren-v1 with its red uniform panels turned mid-grey
      const src = A.IMG['tren-v1'];
      A.IMG['test-male'] = mk(src.width, src.height, x => { x.drawImage(src, 0, 0); const d = x.getImageData(0, 0, src.width, src.height), q = d.data;
        for (let i = 0; i < q.length; i += 4) { const r = q[i], g = q[i + 1], bb = q[i + 2], mx = Math.max(r, g, bb), mn = Math.min(r, g, bb); if (q[i + 3] && mx > 30 && (mx - mn) / mx > 0.62 && r > 2.7 * g && r > 2 * bb) { const v = Math.round(128 * (mx / 160)); q[i] = q[i + 1] = q[i + 2] = Math.min(255, v); } }
        x.putImageData(d, 0, 0); window.__greyed = q.length; }, 'test-male');
      { let n = 0; const q = A.IMG['test-male'].getContext('2d', { willReadFrequently: true }).getImageData(0, 0, src.width, src.height).data; for (let i = 0; i < q.length; i += 4) if (q[i + 3] && q[i] === q[i + 1] && q[i] === q[i + 2] && q[i] > 60 && q[i] < 200) n++; window.__greyed = n; }
      window.__hook = { D, A };
    });
    const shot = async (name, cx, cy, zoom) => { await p.evaluate(([cx, cy, z]) => { const c = __T.cam; c.x = cx * 960; c.y = cy * 640; c.zoom = z; c.scale = c.fit * z; c.manualT = 9999; }, [cx, cy, zoom]); await L.sleep(400); await p.screenshot({ path: `${OUT}anim-hook-${vp}-${name}.png` }); };
    // 1 lying: Lt on the bunk + patients on the biobeds with LIE_ART
    const lie = await p.evaluate(async () => { const { D } = window.__hook; D.LIE_ART.lt = { img: 'test-lie' }; D.LIE_ART.patient = { img: 'test-lie' };
      __T.G.prog.med = __T.G.prog.med || {}; __T.G.prog.med.inj = [{ id: Object.keys(__T.G.prog.crew.occ)[3], short: 'Test', state: 'stable', sev: 'serious', sys: 'eps', left: 0 }];
      const L = __T.G.lt; L.deck = 'medical'; L.lift = null; L.x = 0.42; L.y = 0.55; L.mode = 'idle'; L.path = null; __T.cam.snap = true; window.__HD = []; __T.sendUse('biobed');
      for (let i = 0; i < 80 && L.mode !== 'use'; i++) await new Promise(r => setTimeout(r, 100)); await new Promise(r => setTimeout(r, 900));
      window.__HD = []; await new Promise(r => setTimeout(r, 300)); return { mode: L.mode, node: L.node, draws: window.__HD.filter(t => t === 'test-lie').length }; });
    await shot('lying', 0.25, 0.5, 1.4);
    res[vp + '-lying'] = lie; if (!(lie.node === 'biobed' && lie.draws > 0)) { fail++; console.log('FAIL lying', vp, lie); }
    // fallback: entries removed -> legacy frame again
    const lieFb = await p.evaluate(async () => { const { D } = window.__hook; delete D.LIE_ART.lt; delete D.LIE_ART.patient; window.__HD = []; await new Promise(r => setTimeout(r, 300)); return window.__HD.filter(t => t === 'test-lie').length; });
    res[vp + '-lyingFallback'] = lieFb; if (lieFb !== 0) { fail++; console.log('FAIL lying fallback', vp, lieFb); }
    await shot('lying-fallback', 0.25, 0.5, 1.4);
    // 1b the Lt himself on his bunk (LIE_ART.lt)
    const bunk = await p.evaluate(async () => { const { D } = window.__hook; D.LIE_ART.lt = { img: 'test-lie' }; __T.G.prog.med.inj = [];
      const L = __T.G.lt; L.deck = 'berthing'; L.lift = null; L.x = 0.6; L.y = 0.5; L.mode = 'idle'; L.path = null; __T.cam.snap = true; const bn = D.NODEMAP.bunk; __T.sendUse(bn.id);
      for (let i = 0; i < 80 && L.mode !== 'use'; i++) await new Promise(r => setTimeout(r, 100)); await new Promise(r => setTimeout(r, 1200));
      window.__HD = []; await new Promise(r => setTimeout(r, 300)); const r = { node: L.node, id: bn.id, lie: bn.lie, draws: window.__HD.filter(t => t === 'test-lie').length }; return r; });
    await shot('lying-bunk', bunk.lie ? bunk.lie[0] : 0.8, bunk.lie ? bunk.lie[1] + 0.05 : 0.25, 1.6);
    res[vp + '-bunk'] = bunk; if (!(bunk.node === bunk.id && bunk.draws > 0)) { fail++; console.log('FAIL bunk', vp, bunk); }
    await p.evaluate(() => { delete window.__hook.D.LIE_ART.lt; });
    // 2 seated: SEAT_ART.lt -> the chair's stand spot moves to seat.stand and he sits facing the viewscreen
    const seat = await p.evaluate(async () => { const { D } = window.__hook; D.SEAT_ART.lt = { img: 'test-seat' }; (await import('/js/art-hooks.js')).applyArtHooks();
      __T.G.prog.med.inj = []; const L = __T.G.lt; L.deck = 'bridge'; L.lift = null; L.x = 0.45; L.y = 0.45; L.mode = 'idle'; L.path = null; __T.cam.snap = true; __T.sendUse('chair');
      for (let i = 0; i < 80 && L.mode !== 'use'; i++) await new Promise(r => setTimeout(r, 100)); await new Promise(r => setTimeout(r, 900));
      window.__HD = []; await new Promise(r => setTimeout(r, 300)); const n = D.NODEMAP.chair; return { mode: L.mode, node: L.node, at: [L.x, L.y], stand: [n.x, n.y], draws: window.__HD.filter(t => t === 'test-seat').length }; });
    await shot('seated', 0.5, 0.45, 1.3);
    res[vp + '-seated'] = seat; if (!(seat.node === 'chair' && seat.draws > 0 && Math.abs(seat.at[1] - 0.49) < 0.02)) { fail++; console.log('FAIL seated', vp, seat); }
    await p.evaluate(() => { const { D } = window.__hook; delete D.SEAT_ART.lt; const n = D.NODEMAP.chair; if (n.standInterim) { n.x = n.standInterim.x; n.y = n.standInterim.y; n.face = n.standInterim.face; } });
    // 3 tint base: male crew on the bridge drawn from the grey sheet, tinted per department at draw time
    const tint = await p.evaluate(async () => { const { D } = window.__hook, AH = await import('/js/art-hooks.js'), NA = await import('/js/npc-ambient.js');
      D.TINT_BASES['crew-male'] = { img: 'test-male', pronoun: 'he' };
      D.CHAR_SHEETS['crew-male'] = { 'test-male': ['walk', 'talk', 'eat', 'computer', 'kneel', 'weld'] };
      D.CHAR_FRAMES['crew-male'] = JSON.parse(JSON.stringify(D.CHAR_FRAMES['crew-red'], (k, v) => k === 'img' ? 'test-male' : v));
      const L = __T.G.lt; L.deck = 'bridge'; L.mode = 'idle'; L.path = null; L.x = 0.5; L.y = 0.55;
      let n = 0; const who = []; for (const a of __T.ambient) { const o = __T.G.prog.crew.occ[a.occId]; if (o && o.pronoun === 'he' && /^crew-/.test(a.who)) { a.who = AH.tintBaseFor('he') || a.who; n++; who.push([a.occId, a.deck, a.tint]); } }
      window.__HD = []; await new Promise(r => setTimeout(r, 500)); const tinted = [...new Set(window.__HD)];
      return { male: n, greyPx: window.__greyed, who, base: AH.tintBaseFor('he'), cached: ['#d4a72c', '#3d8fc4', '#c8463c'].map(c => !!AH.tintedSheet('test-male', c)) }; });
    // show the tinted crew: park three male crew from different departments in view
    await p.evaluate(() => { const L = __T.G.lt; const ms = __T.ambient.filter(a => a.who === 'crew-male'); const pos = [[0.36, 0.43], [0.5, 0.36], [0.64, 0.43]]; ms.slice(0, 3).forEach((a, i) => { a.deck = L.deck; a.x = pos[i][0]; a.y = pos[i][1]; a.mode = 'dwell'; a.t = 999; a.path = null; a.spot = { id: 'show', face: 'down', action: null, t: [999, 999] }; }); });
    await shot('tint-base', 0.5, 0.42, 1.2);
    res[vp + '-tint'] = tint; if (!(tint.base === 'crew-male' && tint.male > 0 && tint.cached.every(Boolean))) { fail++; console.log('FAIL tint', vp, tint); }
    await p.close();
  }
  console.log(JSON.stringify(res));
  const iss = L.issues.filter(x => !/favicon/.test(x)); console.log('issues', iss.length, iss.slice(0, 5));
  console.log(fail || iss.length ? 'HOOK CHECK FAIL' : 'HOOK CHECK PASS');
  await b.close(); process.exit(fail || iss.length ? 1 : 0);
})();
