// Foot-slide check (scale option A, 2026-10-18): how far the planted foot drifts per step with the live walk frames.
// The walk advances by distance (anim.js: walkPhase += moved / step * PI; frames A, M, B, M), so over one step the body
// moves `step` design px while the planted foot travels from the front to the back of the stance: the foot-to-foot
// separation measured on the contact frames A and B (side: heel-to-heel in x; up/down: sole-to-sole in y, halves split
// at the anchor x) times the draw scale FIG_H / refH. drift = step - separation x scale (design px per step; x2 per
// cycle; x cam.scale for screen px). 0 = the foot stays put; + = it skates backward, - = forward.
// usage: node tools/foot-slide.js <url> [label] [out.json]   (run once on the old tree and once on the new one)
const L = require('/workspace/playtest-scripts/lib.js');
const [url, label = 'run', out] = process.argv.slice(2);
(async () => {
  const b = await L.launch(); const res = { label, url, rows: [] }; const errs = [];
  for (const [vp, w, h, m] of [['1280x800', 1280, 800, 0], ['390x844', 390, 844, 1], ['844x390', 844, 390, 1]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 3 : 1, isMobile: !!m, hasTouch: !!m }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message)); p.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
    await p.goto(url + '?reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(600);
    res['scale' + vp] = await p.evaluate(() => __T.cam.scale);
    if (vp !== '1280x800') { await ctx.close(); continue; }
    res.rows = await p.evaluate(async () => {
      const D = await import('/js/data.js'), A = await import('/js/assets.js'), AN = await import('/js/anim.js'); const rows = [];
      const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
      const meas = (f, dir) => {
        const im = A.IMG[f.img]; cv.width = f.w; cv.height = f.h; cx.clearRect(0, 0, f.w, f.h); cx.drawImage(im, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
        const d = cx.getImageData(0, 0, f.w, f.h).data, op = (x, y) => d[(y * f.w + x) * 4 + 3] > 128;
        let low = -1, top = f.h; for (let y = f.h - 1; y >= 0 && low < 0; y--) for (let x = 0; x < f.w; x++) if (op(x, y)) { low = y; break; }
        for (let y = 0; y < f.h && top === f.h; y++) for (let x = 0; x < f.w; x++) if (op(x, y)) { top = y; break; }
        const H = low - top;
        const runsAt = (yy0, yy1, merge) => { const occ = []; for (let x = 0; x < f.w; x++) { let o = false; for (let y = yy0; y <= yy1; y++) if (op(x, y)) { o = true; break; } occ.push(o); }
          const runs = []; let st = -1, gap = 0; for (let x = 0; x <= f.w; x++) { const o = x < f.w && occ[x];
            if (o) { if (st < 0) st = x; gap = 0; } else if (st >= 0 && (++gap > merge || x === f.w)) { runs.push([st, x - gap]); st = -1; gap = 0; } }
          return runs.filter(r => r[1] - r[0] >= 4).sort((p, q) => p[0] - q[0]); };
        if (dir === 'left' || dir === 'right') {   // the two feet = the outermost runs in the bottom 10% band (toes/heels may lift)
          const runs = runsAt(Math.round(low - 0.10 * H), low, 2);
          if (runs.length < 2) return { sep: null, runs: runs.length, H };
          const r0 = runs[0], r1 = runs[runs.length - 1], heel = dir === 'right' ? r1[0] - r0[0] : r1[1] - r0[1];
          return { sep: Math.abs(heel), centre: Math.abs((r1[0] + r1[1]) / 2 - (r0[0] + r0[1]) / 2), runs: runs.length, H };
        }
        // up / down: bottom profile (lowest opaque row per column) over the leg columns; the feet are its two low lobes,
        // split at the highest point of the profile in the middle half of the leg span; sole y per lobe
        const bot = []; for (let x = 0; x < f.w; x++) { let v = -1; for (let y = low; y >= low - 0.3 * H; y--) if (op(x, y)) { v = y; break; } bot.push(v); }
        const cols = bot.map((v, x) => v >= 0 ? x : -1).filter(x => x >= 0); if (cols.length < 8) return { sep: null, H };
        const xa = cols[0], xb = cols[cols.length - 1]; let split = -1, best = 1e9;
        for (let x = Math.round(xa + 0.25 * (xb - xa)); x <= Math.round(xa + 0.75 * (xb - xa)); x++) { const v = bot[x] < 0 ? low - 0.3 * H : bot[x]; if (v < best) { best = v; split = x; } }
        const yl = Math.max(...bot.slice(xa, split)), yr = Math.max(...bot.slice(split + 1, xb + 1));
        return { sep: Math.abs(yl - yr), yl, yr, split, H };
      };
      const who2step = { lt: 'lt', tren: 'tren', 'crew-gold': 'crew-gold', andorian: 'andorian', 'crew-male-v1': 'crew-male-v1' };
      for (const who of Object.keys(who2step)) { const W = D.CHAR_FRAMES[who] && D.CHAR_FRAMES[who].walk; if (!W) continue;
        for (const dir of ['right', 'left', 'down', 'up']) { const fr = W[dir]; if (!fr || !A.IMG[fr[0].img]) continue;
          const a = meas(fr[0], dir), bb = meas(fr[2], dir), s = D.FIG_H / fr[0].refH, step = AN.stepLen(who2step[who], dir);
          const sep = (a.sep != null && bb.sep != null) ? (a.sep + bb.sep) / 2 : (a.sep ?? bb.sep);
          rows.push({ who, dir, img: fr[0].img, refH: +fr[0].refH.toFixed(1), drawScale: +s.toFixed(4), sepA: a.sep, sepB: bb.sep, step,
            footTravel: sep == null ? null : +(sep * s).toFixed(1), drift: sep == null ? null : +(step - sep * s).toFixed(1), figH: D.FIG_H }); } }
      return rows; });
    await ctx.close();
  }
  for (const r of res.rows) { r.driftScreenDesk = r.drift == null ? null : +(r.drift * res['scale1280x800']).toFixed(1); r.driftScreenPhone = r.drift == null ? null : +(r.drift * res['scale390x844']).toFixed(1); }
  res.errors = errs; if (out) require('fs').writeFileSync(out, JSON.stringify(res, null, 1));
  console.log(`${label}: scale desk ${res['scale1280x800'].toFixed(3)} phone ${res['scale390x844'].toFixed(3)} land ${res['scale844x390'].toFixed(3)}; errors ${errs.length}`);
  for (const r of res.rows) console.log(`${r.who.padEnd(10)} ${r.dir.padEnd(5)} ${r.img.padEnd(18)} sepA/B ${r.sepA}/${r.sepB} x${r.drawScale} = ${r.footTravel}  step ${r.step}  drift/step ${r.drift} design px (desk ${r.driftScreenDesk}, phone ${r.driftScreenPhone} screen px)`);
  await b.close();
})();
