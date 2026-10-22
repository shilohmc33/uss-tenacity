// Art batch 2 step 2: Commander Okafor on okafor-v2. In Main Engineering: her sheet key, her standing height (opaque
// crown-to-feet on screen vs FIG_H), a standing / walking / working crop beside the Lt, at 1280x800 and 390x844.
// Run once on the old tree and once on the new: node tools/art2-okafor.js <url> <before|after>
// Shots: shots/art2-okafor-<label>-<pose>-<vp>.png; report shots/art2-okafor-<label>.json.
const L = require('/workspace/playtest-scripts/lib.js'); const fs = require('fs');
const URL = process.argv[2] || 'http://127.0.0.1:8765/', LABEL = process.argv[3] || 'after';
(async () => {
  const b = await L.launch(); const rep = { label: LABEL, url: URL, vp: {}, shots: [] }; const errs = [];
  for (const [vp, w, h, m] of [['1280x800', 1280, 800, 0], ['390x844', 390, 844, 1]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 3 : 1, isMobile: !!m, hasTouch: !!m }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(`${vp} ${e.message}`)); p.on('console', x => { if (x.type() === 'error') errs.push(`${vp} ${x.text()}`); });
    await p.goto(URL + '?reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(800);
    const info = await p.evaluate(async () => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
      const n = __T.npcOf('okafor'), Lt = __T.G.lt; Lt.deck = 'engineering'; Lt.lift = null; Lt.x = 0.45; Lt.y = 0.66; Lt.mode = 'idle'; Lt.path = null; Lt.face = 'left';
      for (const a of __T.ambient) if (a !== n) a.deck = 'nowhere';
      n.deck = 'engineering'; n.x = 0.39; n.y = 0.66; n.mode = 'dwell'; n.path = null; n.spot = { id: 'linger', face: 'down', action: null }; n.dir = 'down'; n.t = 60; __T.cam.snap = true; __T.cam.manualT = 0;
      return { who: n.who, pronoun: __T.G.prog.crew.occ.okafor.pronoun }; });
    await L.sleep(1500);
    const crop = async (pose) => { const c = await p.evaluate(() => { const n = __T.npcOf('okafor'), c = __T.cam, rc = document.querySelector('#deck').getBoundingClientRect(), s = c.scale;
        const sx = rc.left + c.w / 2 + (n.x * 960 - c.x) * s, sy = rc.top + c.h / 2 + (n.y * 640 - c.y) * s;
        return { x: Math.max(0, sx - 80 * s), y: Math.max(0, sy - 110 * s), width: 160 * s, height: 130 * s, mode: n.mode, face: n.dir, act: n.act || n.action || null }; });
      const { mode, face, act, ...cl } = c; const f = `shots/art2-okafor-${LABEL}-${pose}-${vp}.png`; await p.screenshot({ path: f, clip: cl }); rep.shots.push(f); return { mode, face, act }; };
    const st = await crop('stand');
    // height on screen: render-independent measure via the frame data
    const hgt = await p.evaluate(async () => { const D = await import('/js/data.js'), A = await import('/js/assets.js'); const n = __T.npcOf('okafor'); const F = D.CHAR_FRAMES[n.who]; if (!F) return null;
      const f = F.talk.down[0], im = A.IMG[f.img]; if (!im) return null; const cv = document.createElement('canvas'); cv.width = f.w; cv.height = f.h; const x = cv.getContext('2d'); x.drawImage(im, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
      const d = x.getImageData(0, 0, f.w, f.h).data; let top = f.h; for (let y = 0; y < f.h && top === f.h; y++) for (let xx = 0; xx < f.w; xx++) if (d[(y * f.w + xx) * 4 + 3] > 128) { top = y; break; }
      return { img: f.img, standCellPx: f.ay - top, drawScale: +(D.FIG_H / f.refH).toFixed(4), standDesign: +((f.ay - top) * D.FIG_H / f.refH).toFixed(1), FIG_H: D.FIG_H, FIG_K: +(D.FIG_H / 134).toFixed(3) }; });
    await p.evaluate(() => { const n = __T.npcOf('okafor'); const s = n.cfg.spots[0]; __T.ambientTo('okafor', s.id); });
    await L.sleep(700); const wk = await crop('walk');
    await p.waitForFunction(() => { const n = __T.npcOf('okafor'); return n.mode !== 'walk'; }, null, { timeout: 20000 }).catch(() => {}); await L.sleep(1200);
    const wo = await crop('work');
    rep.vp[vp] = { ...info, height: hgt, stand: st, walk: wk, work: wo };
    if (LABEL === 'after' && info.who !== 'okafor') errs.push(`${vp} Okafor sheet is ${info.who}`);
    await ctx.close();
  }
  rep.errors = errs; fs.writeFileSync(`shots/art2-okafor-${LABEL}.json`, JSON.stringify(rep, null, 1));
  console.log(JSON.stringify(rep.vp, null, 0)); console.log('errors', errs.length, errs.slice(0, 5)); await b.close();
})();
