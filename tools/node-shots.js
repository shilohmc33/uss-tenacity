// Scale re-tune helper: the Lt placed at every node (feet x,y, facing its target) on each deck, clipped around him.
// usage: node tools/node-shots.js <url> <outdir> [WxH]   -> <outdir>/<deck>-<node>.png + nodes.json (figure bbox vs node)
const L = require('/workspace/playtest-scripts/lib.js');
const [url, out, vp = '1280x800'] = process.argv.slice(2); const [W, H] = vp.split('x').map(Number);
const fs = require('fs'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await L.launch(); const ctx = await b.newContext({ viewport: { width: W, height: H } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url + '?reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(700);
  await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); });
  const list = await p.evaluate(async () => { const D = await import('/js/data.js'); const r = []; for (const [d, dk] of Object.entries(D.DECKS)) for (const [n, nd] of Object.entries(dk.nodes)) r.push([d, n]); return r; });
  const rep = {};
  for (const [d, n] of list) {
    const info = await p.evaluate(async ([d, n]) => { const D = await import('/js/data.js'); const nd = D.DECKS[d].nodes[n]; const L = __T.G.lt;
      L.deck = d; L.lift = null; L.x = nd.x; L.y = nd.y; L.mode = 'idle'; L.path = null; L.moving = false; L.node = n;
      const dx = nd.mx - nd.x, dy = nd.my - nd.y; L.dir = nd.face || (Math.abs(dx) * 1.5 > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy < 0 ? 'up' : 'down'));
      __T.cam.snap = true; __T.cam.manualT = 0; await new Promise(r => setTimeout(r, 700));
      const c = __T.cam, rc = document.querySelector('#deck').getBoundingClientRect();
      const sx = rc.left + c.w / 2 + (nd.x * 960 - c.x) * c.scale, sy = rc.top + c.h / 2 + (nd.y * 640 - c.y) * c.scale;
      return { sx, sy, scale: c.scale, dir: L.dir, figH: D.FIG_H }; }, [d, n]);
    const s = info.scale, half = Math.round(110 * s);
    const clip = { x: Math.max(0, info.sx - half), y: Math.max(0, info.sy - Math.round(150 * s)), width: half * 2, height: Math.round(190 * s) };
    await p.screenshot({ path: `${out}/${d}-${n}.png`, clip }); rep[`${d}.${n}`] = info;
  }
  fs.writeFileSync(`${out}/nodes.json`, JSON.stringify({ rep, errs }, null, 1)); console.log(list.length, 'nodes; errors', errs.length, errs.slice(0, 3));
  await b.close();
})();
