// Wrap-up species set: crew shots of the four new species sheets + the roster's sheet table.
//   node tools/art2-species-shots.js [url]
// Shots: shots/art2-species-{human-m2,human-f2,trill,vulcan}-{stand,walk}-<vp>.png; report shots/art2-species.json
// (every roster crewmate's sheet, plus 40 synthetic transfer-ins per species/pronoun to show the variant spread).
const L = require('/workspace/playtest-scripts/lib.js'); const fs = require('fs');
const URL = process.argv[2] || 'http://127.0.0.1:8765/';
const CASES = [['human-m2', 'hale', 'crew-human-m2-v1'], ['human-f2', 'seo', 'crew-human-f2-v1'], ['trill', 'orvin', 'crew-trill-v2'], ['vulcan', 'sorvan', 'crew-vulcan-m-v1']];
(async () => {
  const b = await L.launch(); const rep = { url: URL, vp: {}, shots: [] }; const errs = [];
  for (const [vp, w, h, m] of [['1280x800', 1280, 800, 0], ['390x844', 390, 844, 1]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 3 : 1, isMobile: !!m, hasTouch: !!m }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(`${vp} ${e.message}`)); p.on('console', x => { if (x.type() === 'error') errs.push(`${vp} ${x.text()}`); });
    await p.goto(URL + '?reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(800);
    const R = rep.vp[vp] = {};
    await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); });
    R.roster = await p.evaluate(() => Object.values(__T.G.prog.crew.occ).map(o => { const n = __T.npcOf(o.id); return `${o.id} ${o.species} ${o.pronoun} -> ${n ? n.who : '(no npc)'}`; }));
    R.synthetic = await p.evaluate(async () => { const NA = await import('/js/npc-ambient.js'); const out = {};
      for (const sp of ['human', 'trill', 'vulcan', 'bolian', 'betazoid']) for (const pn of ['he', 'she', 'they']) { const c = {};
        for (let i = 0; i < 40; i++) { const k = NA.sheetFor({ id: `gen-${sp}-${pn}-${i}`, species: sp, pronoun: pn }, { dept: 'eng' }); c[k] = (c[k] || 0) + 1; }
        out[`${sp}/${pn}`] = c; }
      return out; });
    const clipD = (cx, cy, ww, hh) => p.evaluate(([cx, cy, ww, hh]) => { const c = __T.cam, rc = document.querySelector('#deck').getBoundingClientRect(), s = c.scale;
      const sx = rc.left + c.w / 2 + (cx - c.x) * s, sy = rc.top + c.h / 2 + (cy - c.y) * s; const x = Math.max(0, sx - ww / 2 * s), y = Math.max(0, sy - hh / 2 * s);
      return { x, y, width: Math.min(ww * s, innerWidth - x), height: Math.min(hh * s, innerHeight - y) }; }, [cx, cy, ww, hh]);
    const shot = async (name, cl) => { const f = `shots/art2-species-${name}-${vp}.png`; await p.screenshot({ path: f, clip: cl }); rep.shots.push(f); return f; };
    for (const [key, id, want] of CASES) {
      await p.evaluate(() => { const Lt = __T.G.lt; Lt.deck = 'engineering'; Lt.lift = null; Lt.x = 0.45; Lt.y = 0.66; Lt.mode = 'idle'; Lt.path = null; Lt.face = 'left'; __T.cam.snap = true; __T.cam.manualT = 0; });
      const info = await p.evaluate(id => { const n = __T.npcOf(id); for (const a of __T.ambient) if (a !== n) a.deck = 'nowhere'; if (!n) return null;
        n.deck = 'engineering'; n.x = 0.39; n.y = 0.66; n.mode = 'dwell'; n.path = null; n.spot = { id: 'linger', face: 'down', action: null }; n.dir = 'down'; n.t = 60;
        const o = __T.G.prog.crew.occ[id]; return { id, name: o.name, pronoun: o.pronoun, species: o.species, sheet: n.who }; }, id);
      if (!info) { errs.push(`${vp} no npc ${id}`); continue; }
      await L.sleep(1500);
      const nclip = () => p.evaluate(id => { const n = __T.npcOf(id); return [n.x * 960, n.y * 640 - 45]; }, id);
      const [ax, ay] = await nclip(); info.stand = await shot(`${key}-stand`, await clipD(ax, ay, 150, 130));
      info.walkTo = await p.evaluate(id => { const n = __T.npcOf(id), s = n.cfg.spots.find(q => q.deck === undefined || q.deck === 'engineering') || n.cfg.spots[0]; try { __T.ambientTo(n.slot, s.id); } catch (e) { return 'err ' + e.message; } return s.id; }, id);
      await L.sleep(800); const [bx, by] = await nclip(); info.walkMode = await p.evaluate(id => __T.npcOf(id).mode, id);
      info.walk = await shot(`${key}-walk`, await clipD(bx, by, 150, 130));
      R[key] = info; if (info.sheet !== want) errs.push(`${vp} ${id} sheet ${info.sheet} (want ${want})`);
    }
    await ctx.close();
  }
  rep.errors = errs; fs.writeFileSync('shots/art2-species.json', JSON.stringify(rep, null, 1));
  console.log(JSON.stringify(rep.vp['1280x800'].roster)); console.log(JSON.stringify(rep.vp['1280x800'].synthetic)); console.log('errors', errs.length, errs.slice(0, 5)); await b.close();
})();
