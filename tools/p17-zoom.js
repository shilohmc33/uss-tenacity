// Pass 17 P5: default zoom / figure height (FIG_H x cam.scale, css px) at 360x640, 667x375, 390x844, 844x390, 1280x800, plus
// visible tap controls under 44 px and the Lt fully in frame (head + feet inside the stage) - run on the old tree and the new.
// usage: node tools/p17-zoom.js <url> <label> -> shots/p17-zoom-<label>.json + shots/p17-zoom-<label>-667x375.png
const L = require('/workspace/playtest-scripts/lib.js'); const fs = require('fs');
const URL = process.argv[2] || 'http://127.0.0.1:8765/', LABEL = process.argv[3] || 'after';
(async () => { const b = await L.launch(); const rep = { label: LABEL, vp: {} }; const errs = [];
  for (const [vp, w, h, m] of [['360x640', 360, 640, 1], ['667x375', 667, 375, 1], ['390x844', 390, 844, 1], ['844x390', 844, 390, 1], ['1280x800', 1280, 800, 0]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 3 : 1, isMobile: !!m, hasTouch: !!m }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(`${vp} ${e.message}`)); p.on('console', x => { if (x.type() === 'error') errs.push(`${vp} ${x.text()}`); });
    await p.goto(URL + '?reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(1500);
    const r = await p.evaluate(async () => { const D = await import('/js/data.js'); document.querySelectorAll('.modal:not(.hidden)').forEach(m => { if (m.id !== 'bcCard') m.hidden = true; });
      const st = document.querySelector('#stage'), rc = document.querySelector('#deck').getBoundingClientRect(), c = __T.cam, L = __T.G.lt;
      const fy = rc.top + c.h / 2 + (L.y * 640 - c.y) * c.scale, hy = fy - D.FIG_H * c.scale;
      const small = [...document.querySelectorAll('button, [data-sheet], .chip, a')].filter(e => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && b.bottom > 0 && b.top < innerHeight && (b.width < 44 || b.height < 44) && !e.closest('.modal[hidden], [hidden]'); }).map(e => (e.id || e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height));
      return { stage: [st.clientWidth, st.clientHeight], zoom: +c.zoom.toFixed(3), boost: +(c.boost || 1).toFixed(4), figPx: +(D.FIG_H * c.scale).toFixed(1), ltInFrame: hy >= rc.top - 1 && fy <= rc.bottom + 1, small }; });
    rep.vp[vp] = r; if (!r.ltInFrame) errs.push(`${vp} Lt not fully in frame`);
    if (vp === '667x375') await p.screenshot({ path: `shots/p17-zoom-${LABEL}-667x375.png` });
    await ctx.close(); }
  rep.errors = errs; fs.writeFileSync(`shots/p17-zoom-${LABEL}.json`, JSON.stringify(rep, null, 1));
  for (const [k, v] of Object.entries(rep.vp)) console.log(LABEL, k.padEnd(9), `stage ${v.stage.join('x')} zoom ${v.zoom} boost ${v.boost} figure ${v.figPx} css px  Lt in frame ${v.ltInFrame}  small controls ${v.small.length}${v.small.length ? ' ' + v.small.slice(0, 4).join(', ') : ''}`);
  console.log('errors', errs.length, errs.slice(0, 4)); await b.close(); })();
