// Art batch 2 before/after: the four cabin tiers (with the cabin_v4 demo decor placed by slot type), the bridge (Lt in the
// captain's chair, T'Ren and crew at home) and Okafor in Main Engineering, on the old tree and the new one, then joined
// side by side.  node tools/art2-shots.js <beforeUrl> <afterUrl>
//   -> shots/art2-<scene>-{before,after}-<vp>.png + shots/art2-<scene>-compare-<vp>.png
const L = require('/workspace/playtest-scripts/lib.js'); const { execFileSync } = require('child_process');
const [BEFORE, AFTER] = [process.argv[2] || 'http://127.0.0.1:8840/', process.argv[3] || 'http://127.0.0.1:8765/'];
const fs = require('fs'); const TIERS = ['ltjg', 'lt', 'ltcmdr', 'cmdr'], VPS = [['1280x800', 1280, 800, 0], ['390x844', 390, 844, 1]];
const DEMO = Object.fromEntries(['ltjg', 'lt', 'ltcmdr', 'cmdr'].map(t => [t, JSON.parse(fs.readFileSync(`assets/src/cabin_v4/cabin-${t}.json`, 'utf8'))]));   // demo decor per slot (read here: the old tree has no cabin_v4)
(async () => {
  const b = await L.launch(); const errs = []; const made = [];
  for (const [label, url] of [['before', BEFORE], ['after', AFTER]]) for (const [vp, w, h, m] of VPS) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 3 : 1, isMobile: !!m, hasTouch: !!m }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(`${label} ${vp} ${e.message}`)); p.on('console', x => { if (x.type() === 'error') errs.push(`${label} ${vp} ${x.text()}`); });
    await p.goto(url + '?reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(800);
    await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); });
    const shot = async name => { const f = `shots/art2-${name}-${label}-${vp}.png`; await p.screenshot({ path: f }); made.push(f); };
    for (const t of TIERS) {
      await p.evaluate(async ([t, js]) => { const G = __T.G, CB = __T.CB;
        const c = G.prog.cabin; G.prog.rank = ['ltjg', 'lt', 'ltcmdr', 'cmdr'].indexOf(t); c.tier = t; c.placed = {}; CB.applyTier();
        for (const s of (js ? js.slots : [])) { const id = s._demo_item || s._fits; const d = id && CB.DECOR[id]; if (!d) continue; if (!c.owned.includes(id)) c.owned.push(id);
          const sl = CB.slotsFor(d.slot).find(x => !c.placed[x.id]); if (sl && !Object.values(c.placed).includes(id)) c.placed[sl.id] = id; }
        for (const a of __T.ambient) a.deck = 'nowhere';
        const T = CB.tier(), L = G.lt; L.lift = null; L.deck = 'quarters'; L.x = T.lift.x; L.y = T.lift.y + 0.03; L.mode = 'idle'; L.path = null; L.node = null; L.intent = null; L.dir = 'down'; __T.cam.snap = true; __T.cam.manualT = 0; }, [t, DEMO[t]]);
      await L.sleep(1800); await shot('cabin-' + t);
    }
    // bridge: the Lt in the captain's chair, T'Ren / crew where they are
    await p.evaluate(() => { const L = __T.G.lt; L.deck = 'bridge'; L.lift = null; L.mode = 'idle'; L.path = null; L.node = null; const n = __T.G && null; __T.cam.snap = true; });
    await p.evaluate(async () => { const D = await import('/js/data.js'); const n = D.NODEMAP.chair, L = __T.G.lt; L.x = n.x; L.y = n.y; __T.sendUse('chair', { force: true }); });
    await L.sleep(4500); await shot('bridge');
    // Okafor in Main Engineering beside the Lt
    await p.evaluate(() => { const n = __T.npcOf('okafor'), Lt = __T.G.lt; Lt.deck = 'engineering'; Lt.lift = null; Lt.x = 0.45; Lt.y = 0.66; Lt.mode = 'idle'; Lt.path = null; Lt.node = null;
      n.deck = 'engineering'; n.x = 0.39; n.y = 0.66; n.mode = 'dwell'; n.path = null; n.spot = { id: 'linger', face: 'down', action: null }; n.dir = 'down'; n.t = 60; __T.cam.snap = true; __T.cam.manualT = 0; });
    await L.sleep(1800); await shot('okafor-scene');
    await ctx.close();
  }
  await b.close();
  for (const s of [...TIERS.map(t => 'cabin-' + t), 'bridge', 'okafor-scene']) for (const [vp] of VPS) {
    const out = `shots/art2-${s}-compare-${vp}.png`;
    execFileSync('python3', ['-c', `from PIL import Image, ImageDraw
a=Image.open('shots/art2-${s}-before-${vp}.png').convert('RGB'); b=Image.open('shots/art2-${s}-after-${vp}.png').convert('RGB')
k=1 if a.width<=1400 else 0.5
a=a.resize((int(a.width*k),int(a.height*k))); b=b.resize((int(b.width*k),int(b.height*k)))
o=Image.new('RGB',(a.width+b.width+12,max(a.height,b.height)+28),(16,18,26)); o.paste(a,(0,28)); o.paste(b,(a.width+12,28))
d=ImageDraw.Draw(o); d.text((8,8),'BEFORE (fa219ca)',fill=(255,200,120)); d.text((a.width+20,8),'AFTER (art batch 2)',fill=(140,230,255)); o.save('${out}')`]);
    made.push(out);
  }
  console.log(made.length, 'shots'); console.log('errors', errs.length, errs.slice(0, 8));
})();
