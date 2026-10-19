// Art batch 1 before|after per room: the Lt USING a station in every room (bridge chair = seated art, biobed / bunk / rack =
// lying art, engineering core / lounge bar standing) on the pre-art tree (before, 9078b20 on :8852) and the art tree (after,
// :8765); in engineering and the lounge Thelev and two male crew are parked in view (own sheet / male tint base).
// Full viewport, composed side by side -> shots/art1-<room>-<size>.png, report shots/art1-shots.json
// usage: node tools/art1-shots.js <beforeUrl> <afterUrl> [beforeLabel]
const L = require('/workspace/playtest-scripts/lib.js'); const { execFileSync } = require('child_process'); const fs = require('fs');
const [BEFORE, AFTER, BLABEL = '9078b20'] = process.argv.slice(2);
const ROOMS = { engineering: 'core', lounge: 'bar', berthing: 'bunk', bridge: 'chair', medical: 'biobed', quarters: 'rack' };
const VPS = [['390x844', 390, 844, 1], ['844x390', 844, 390, 1], ['1280x800', 1280, 800, 0]];
(async () => {
  const b = await L.launch(); const errs = []; const rep = {};
  for (const [tag, url] of [['before', BEFORE], ['after', AFTER]]) for (const [vp, w, h, m] of VPS) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: !!m, hasTouch: !!m }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(`${tag} ${vp} ${e.message}`)); p.on('console', x => { if (x.type() === 'error') errs.push(`${tag} ${vp} ${x.text()}`); });
    await p.goto(url + '?reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(800);
    await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); });
    for (const [room, node] of Object.entries(ROOMS)) {
      const info = await p.evaluate(async ([d, n]) => { const D = await import('/js/data.js'); const nd = D.DECKS[d].nodes[n]; const L = __T.G.lt;
        L.deck = d; L.lift = null; L.x = nd.x; L.y = nd.y; L.mode = 'idle'; L.path = null; __T.cam.snap = true; __T.cam.manualT = 0;
        // park crew in view in the standing rooms: Thelev + two men (whatever sheet this build gives them)
        const parked = [];
        if (d === 'engineering' || d === 'lounge') { const occ = __T.G.prog.crew.occ; const am = __T.ambient.filter(a => occ[a.occId]);
          const pick = [am.find(a => a.occId === 'thelev'), ...am.filter(a => occ[a.occId].pronoun === 'he' && a.occId !== 'tren').slice(0, 2)].filter(Boolean);
          const pos = d === 'engineering' ? [[0.40, 0.66], [0.60, 0.66], [0.52, 0.74]] : [[0.40, 0.62], [0.58, 0.62], [0.49, 0.72]];
          pick.forEach((a, i) => { a.deck = d; a.x = pos[i][0]; a.y = pos[i][1]; a.mode = 'dwell'; a.t = 999; a.path = null; a.dir = 'down'; parked.push([a.occId, a.who]); }); }
        await new Promise(r => setTimeout(r, 300)); __T.sendUse(n); await new Promise(r => setTimeout(r, 3800));
        return { mode: L.mode, node: L.node, parked, figPx: +(D.FIG_H * __T.cam.scale).toFixed(1) }; }, [room, node]);
      rep[`${tag}.${vp}.${room}`] = info;
      await p.screenshot({ path: `/tmp/a1-${tag}-${room}-${vp}.png` });
    }
    await ctx.close();
  }
  for (const room of Object.keys(ROOMS)) for (const [vp] of VPS) {
    const a = rep[`before.${vp}.${room}`], c = rep[`after.${vp}.${room}`];
    execFileSync('python3', ['-c', `
from PIL import Image, ImageDraw
b=Image.open('/tmp/a1-before-${room}-${vp}.png').convert('RGB'); a=Image.open('/tmp/a1-after-${room}-${vp}.png').convert('RGB')
if b.width>1400: b=b.resize((b.width//2,b.height//2)); a=a.resize((a.width//2,a.height//2))
S=Image.new('RGB',(b.width+a.width+12,max(b.height,a.height)+34),(16,18,24)); S.paste(b,(0,34)); S.paste(a,(b.width+12,34))
d=ImageDraw.Draw(S); d.text((6,6),'BEFORE ${BLABEL} (pre-art) · ${room} ${vp} · Lt ${a.mode} ${a.node}',fill=(255,210,120)); d.text((b.width+18,6),'AFTER art batch 1 · Lt ${c.mode} ${c.node}',fill=(140,230,255))
S.save('shots/art1-${room}-${vp}.png')`]);
  }
  fs.writeFileSync('shots/art1-shots.json', JSON.stringify({ rep, errs }, null, 1)); console.log('errors', errs.length, errs.slice(0, 5)); await b.close();
})();
