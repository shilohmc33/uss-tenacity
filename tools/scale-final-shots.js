// Scale option A before|after per room: the Lt at a station in each room on the old tree (before, e.g. 84f79e0 on :8852)
// and the new one (after, :8765), full viewport, composed side by side -> shots/scale-final-<room>-<size>.png
// usage: node tools/scale-final-shots.js <beforeUrl> <afterUrl>
const L = require('/workspace/playtest-scripts/lib.js'); const { execFileSync } = require('child_process'); const fs = require('fs');
const [BEFORE, AFTER] = process.argv.slice(2);
const ROOMS = { engineering: 'core', lounge: 'bar', berthing: 'bunk', bridge: 'msd', medical: 'biobed', quarters: 'rack' };
const VPS = [['390x844', 390, 844, 1], ['1280x800', 1280, 800, 0]];
(async () => {
  const b = await L.launch(); const errs = []; const rep = {};
  for (const [tag, url] of [['before', BEFORE], ['after', AFTER]]) for (const [vp, w, h, m] of VPS) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 3 : 1, isMobile: !!m, hasTouch: !!m }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(`${tag} ${vp} ${e.message}`)); p.on('console', x => { if (x.type() === 'error') errs.push(`${tag} ${vp} ${x.text()}`); });
    await p.goto(url + '?reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(800);
    await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); });
    for (const [room, node] of Object.entries(ROOMS)) {
      const info = await p.evaluate(async ([d, n]) => { const D = await import('/js/data.js'); const nd = D.DECKS[d].nodes[n]; const L = __T.G.lt;
        L.deck = d; L.lift = null; L.x = nd.x; L.y = nd.y; L.mode = 'idle'; L.path = null; L.moving = false;
        const dx = nd.mx - nd.x, dy = nd.my - nd.y; L.dir = nd.face || (Math.abs(dx) * 1.5 > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy < 0 ? 'up' : 'down'));
        __T.cam.snap = true; __T.cam.manualT = 0; await new Promise(r => setTimeout(r, 1600));
        return { scale: +__T.cam.scale.toFixed(3), zoom: +__T.cam.zoom.toFixed(3), figPx: +(D.FIG_H * __T.cam.scale).toFixed(1) }; }, [room, node]);
      rep[`${tag}.${vp}.${room}`] = info;
      await p.screenshot({ path: `/tmp/sf-${tag}-${room}-${vp}.png` });
    }
    await ctx.close();
  }
  for (const room of Object.keys(ROOMS)) for (const [vp] of VPS) {
    const a = rep[`before.${vp}.${room}`], c = rep[`after.${vp}.${room}`];
    execFileSync('python3', ['-c', `
from PIL import Image, ImageDraw
b=Image.open('/tmp/sf-before-${room}-${vp}.png').convert('RGB'); a=Image.open('/tmp/sf-after-${room}-${vp}.png').convert('RGB')
if b.width>1400: b=b.resize((b.width//2,b.height//2)); a=a.resize((a.width//2,a.height//2))
S=Image.new('RGB',(b.width+a.width+12,max(b.height,a.height)+34),(16,18,24)); S.paste(b,(0,34)); S.paste(a,(b.width+12,34))
d=ImageDraw.Draw(S); d.text((6,6),'BEFORE 84f79e0 · ${room} ${vp} · figure ${a.figPx} css px',fill=(255,210,120)); d.text((b.width+18,6),'AFTER option A · figure ${c.figPx} css px',fill=(140,230,255))
S.save('shots/scale-final-${room}-${vp}.png')`]);
  }
  fs.writeFileSync('shots/scale-final.json', JSON.stringify({ rep, errs }, null, 1)); console.log('errors', errs.length, errs.slice(0, 5)); await b.close();
})();
