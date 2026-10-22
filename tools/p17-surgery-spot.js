// Pass 17 P1 (the HOLD): Medical's "surgery" work spot sat on the turbolift alcove wall (0.45, 0.7297, off walk-medical).
// Static: every roster wander spot (resolved exactly as npc-ambient does: snap to the mask, then the console override) and every
// CONSOLES work spot must lie on its deck's walk mask (pixel test, white = floor, 3 px edge tolerance). Live: a medical crewmember is sent to the
// surgery spot, must arrive and dwell with feet on the mask, typing (console within 6 px). Shots shots/p17-surgery-<vp>.png
// (crop around her, walk grid off) at 390x844, 844x390, 1280x800; report shots/p17-surgery.json.   usage: node tools/p17-surgery-spot.js [url]
const L = require('/workspace/playtest-scripts/lib.js'); const fs = require('fs');
const URL = process.argv[2] || 'http://127.0.0.1:8765/';
(async () => {
  const b = await L.launch(); const rep = { vp: {}, shots: [] }; const errs = [];
  for (const [vp, w, h, m] of [['390x844', 390, 844, 1], ['844x390', 844, 390, 1], ['1280x800', 1280, 800, 0]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 3 : 1, isMobile: !!m, hasTouch: !!m }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(`${vp} ${e.message}`)); p.on('console', x => { if (x.type() === 'error') errs.push(`${vp} ${x.text()}`); });
    await p.goto(URL + '?reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(800);
    const R = rep.vp[vp] = {};
    R.static = await p.evaluate(async () => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
      const D = await import('/js/data.js'), A = await import('/js/assets.js'), NA = await import('/js/npc-ambient.js'), RO = await import('/js/roster.js');
      const masks = {}; const on = (deck, fx, fy) => { if (!masks[deck]) { const im = A.IMG['walk-' + deck]; if (!im) return null; const c = document.createElement('canvas'); c.width = 960; c.height = 640; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 960, 640); masks[deck] = x.getImageData(0, 0, 960, 640).data; }
        const X = Math.round(fx * 960), Y = Math.round(fy * 640), M = masks[deck]; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 9 && M[((Y + dy) * 960 + X + dx) * 4] > 127) return true; return false; };   // within 3 px of floor (mask edge AA; the old surgery spot was 19 px off)
      const out = { spots: 0, off: [], consoles: 0, consolesOff: [] };
      for (const sl of RO.CREW_ROSTER || Object.values(RO.SLOTMAP)) for (const s of sl.spots || []) { if (!sl.deck || !D.DECKS[sl.deck] || D.DECKS[sl.deck].cabin) continue;
        const r = NA.resolveSpot(sl.deck, s); out.spots++; const ok = on(sl.deck, r.x, r.y); if (ok === false) out.off.push({ slot: sl.slot, deck: sl.deck, id: s.id, at: [+r.x.toFixed(4), +r.y.toFixed(4)] }); }
      for (const [deck, l] of Object.entries(D.CONSOLES)) for (const [x, y, f] of l) { out.consoles++; if (on(deck, x / 960, y / 640) === false) out.consolesOff.push({ deck, at: [x, y, f] }); }
      const surg = (RO.CREW_ROSTER || Object.values(RO.SLOTMAP)).flatMap(sl => (sl.spots || []).filter(s => s.id === 'surgery').map(s => ({ slot: sl.slot, deck: sl.deck, ...NA.resolveSpot(sl.deck, s) })));
      out.surgery = surg.map(s => ({ slot: s.slot, at: [+s.x.toFixed(4), +s.y.toFixed(4)], px: [Math.round(s.x * 960), Math.round(s.y * 640)], onMask: on(s.deck, s.x, s.y), console: !!NA.consoleNear(s.deck, s.x, s.y, 'up', 6) }));
      return out; });
    if (R.static.off.length || R.static.consolesOff.length) errs.push(`${vp} off-mask spots ${JSON.stringify(R.static.off)} consoles ${JSON.stringify(R.static.consolesOff)}`);
    if (!R.static.surgery.length || R.static.surgery.some(s => !s.onMask || !s.console)) errs.push(`${vp} surgery spot ${JSON.stringify(R.static.surgery)}`);
    // live: the first medical slot that has the surgery spot walks there and dwells
    const slot = R.static.surgery[0] && R.static.surgery[0].slot;
    await p.evaluate(slot => { const Lt = __T.G.lt; Lt.deck = 'medical'; Lt.lift = null; Lt.x = 0.51; Lt.y = 0.6875; Lt.mode = 'idle'; Lt.path = null; __T.cam.snap = true; __T.cam.manualT = 0;
      const n = __T.npcOf(slot); for (const a of __T.ambient) if (a !== n && a.deck === 'medical') a.deck = 'nowhere'; n.deck = 'medical'; n.x = 0.30; n.y = 0.66; n.mode = 'idle'; n.path = null; __T.ambientTo(slot, 'surgery'); }, slot);
    const samples = []; let arrived = false;
    for (let i = 0; i < 60 && !arrived; i++) { await L.sleep(250); const s = await p.evaluate(slot => { const n = __T.npcOf(slot); return { x: n.x, y: n.y, mode: n.mode, spot: n.spot && n.spot.id, act: n.act || null }; }, slot); samples.push(s); arrived = s.mode === 'dwell' && s.spot === 'surgery'; }
    await L.sleep(1200);
    R.live = await p.evaluate(async slot => { const A = await import('/js/assets.js'), NA = await import('/js/npc-ambient.js'); const n = __T.npcOf(slot); const im = A.IMG['walk-medical']; const c = document.createElement('canvas'); c.width = 960; c.height = 640; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 960, 640); const d = x.getImageData(0, 0, 960, 640).data;
      return { slot, who: n.who, mode: n.mode, spot: n.spot && n.spot.id, feet: [Math.round(n.x * 960), Math.round(n.y * 640)], onMask: d[(Math.round(n.y * 640) * 960 + Math.round(n.x * 960)) * 4] > 127, face: n.dir, typing: !!NA.consoleNear('medical', n.x, n.y, n.spot && n.spot.face, 6) }; }, slot);
    R.live.walkOffMask = (await p.evaluate(async ss => { const A = await import('/js/assets.js'); const im = A.IMG['walk-medical']; const c = document.createElement('canvas'); c.width = 960; c.height = 640; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 960, 640); const d = x.getImageData(0, 0, 960, 640).data;
      return ss.filter(s => d[(Math.round(s.y * 640) * 960 + Math.round(s.x * 960)) * 4] <= 127).length; }, samples));
    if (!arrived || !R.live.onMask || !R.live.typing || R.live.walkOffMask > 0) errs.push(`${vp} live ${JSON.stringify(R.live)} arrived ${arrived}`);
    const cl = await p.evaluate(slot => { const n = __T.npcOf(slot), c = __T.cam, rc = document.querySelector('#deck').getBoundingClientRect(), s = c.scale;
      const sx = rc.left + c.w / 2 + (n.x * 960 - c.x) * s, sy = rc.top + c.h / 2 + (n.y * 640 - c.y) * s; const x = Math.max(0, sx - 110 * s), y = Math.max(0, sy - 120 * s);
      return { x, y, width: Math.min(220 * s, innerWidth - x), height: Math.min(170 * s, innerHeight - y) }; }, slot);
    const f = `shots/p17-surgery-${vp}.png`; await p.screenshot({ path: f, clip: cl }); rep.shots.push(f);
    await ctx.close();
  }
  rep.errors = errs; fs.writeFileSync('shots/p17-surgery.json', JSON.stringify(rep, null, 1));
  for (const [vp, R] of Object.entries(rep.vp)) console.log(vp, 'spots', R.static.spots, 'off', R.static.off.length, 'consoles', R.static.consoles, 'off', R.static.consolesOff.length, 'surgery', JSON.stringify(R.static.surgery), 'live', JSON.stringify(R.live));
  console.log(errs.length ? 'P17 SURGERY FAIL' : 'P17 SURGERY PASS', 'errors', errs.length, errs.slice(0, 4)); await b.close();
})();
