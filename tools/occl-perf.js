// Pass 18 3b: per-frame occluder cost at 390x844 (phone, DPR 2). Per deck: Lt parked BEHIND one occluder (worst normal case:
// that item draws every frame), ambient crew left running; OCCL_STATS reset after a 1.5 s warm-up (first draw uploads each cut),
// then 5 s measured. Reports ms per frame for occluderCast + drawOccl, draws per frame. -> shots/occl-perf.json
const L = require('/workspace/playtest-scripts/lib.js'); const fs = require('fs'), path = require('path');
const OUT = path.resolve(__dirname, '..', 'shots') + '/';
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}
const URL = process.argv[2] || 'http://127.0.0.1:8765/';
const SPOTS = { bridge: [336, 266], medical: [470, 446], lounge: [222, 472], berthing: [480, 330], engineering: [450, 420] };
(async () => {
  const b = await L.launch(); const rep = { vp: '390x844', decks: {} }; const errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message)); p.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
  await p.goto(URL + '?reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(800);
  await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); });
  for (const [deck, at] of Object.entries(SPOTS)) {
    await p.evaluate(([deck, at]) => { const Lt = __T.G.lt; Lt.deck = deck; Lt.lift = null; Lt.path = null; Lt.x = at[0] / 960; Lt.y = at[1] / 640; Lt.mode = 'idle'; __T.cam.snap = true; __T.cam.manualT = 0; }, [deck, at]);
    await L.sleep(1500);
    await p.evaluate(async () => { const O = await import('/js/render/occluders.js'); Object.assign(O.OCCL_STATS, { frames: 0, draws: 0, ms: 0 }); window.__fr = []; let last = performance.now(); const f = t => { window.__fr.push(t - last); last = t; if (window.__fr.length < 100000) requestAnimationFrame(f); }; requestAnimationFrame(f); });
    await L.sleep(5000);
    rep.decks[deck] = await p.evaluate(async () => { const O = await import('/js/render/occluders.js'), S = O.OCCL_STATS, fr = window.__fr.slice(5); window.__fr = [1e9];
      return { frames: S.frames, msPerFrame: +(S.ms / S.frames).toFixed(4), drawsPerFrame: +(S.draws / S.frames).toFixed(2), built: S.built, frameMsMedian: +fr.sort((a, b) => a - b)[fr.length >> 1].toFixed(2) }; });
  }
  rep.errors = errs; fs.writeFileSync(OUT + 'occl-perf.json', JSON.stringify(rep, null, 1)); console.log(JSON.stringify(rep.decks), 'errors', errs.length); await b.close();
})();
