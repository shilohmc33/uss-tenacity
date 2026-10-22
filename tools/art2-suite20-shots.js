// Suite 20 before/after shots: the hi-res bridge plate (1920x1280 vs v3 1080x720), the female crew base (crew-female-v1 vs
// T'Ren's recolour), the Betazoid crewwoman (crew-betazoid-v1) and the Bolian crewman (crew-bolian-v1 vs the male base). CASES=bridge,female,betazoid,bolian narrows. Run once on the old tree, once on the new:
//   node tools/art2-suite20-shots.js <url> <before|after>
// Shots: shots/art2-{bridgehr-dais,bridgehr-conn,female-stand,female-walk,betazoid-stand,betazoid-walk}-<label>-<vp>.png;
// report shots/art2-suite20-<label>.json (sheet keys, plate size, crop sharpness: tools/shot-sharpness.py)).
const L = require('/workspace/playtest-scripts/lib.js'); const fs = require('fs');
const URL = process.argv[2] || 'http://127.0.0.1:8765/', LABEL = process.argv[3] || 'after';
(async () => {
  const b = await L.launch(); const rep = { label: LABEL, url: URL, vp: {}, shots: [] }; const errs = [];
  for (const [vp, w, h, m] of [['1280x800', 1280, 800, 0], ['390x844', 390, 844, 1]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 3 : 1, isMobile: !!m, hasTouch: !!m }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(`${vp} ${e.message}`)); p.on('console', x => { if (x.type() === 'error') errs.push(`${vp} ${x.text()}`); });
    await p.goto(URL + '?reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(800);
    const R = rep.vp[vp] = {};
    await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); });
    // design-px rect -> screen clip (the camera follows the Lt)
    const clipD = (cx, cy, ww, hh) => p.evaluate(([cx, cy, ww, hh]) => { const c = __T.cam, rc = document.querySelector('#deck').getBoundingClientRect(), s = c.scale;
      const sx = rc.left + c.w / 2 + (cx - c.x) * s, sy = rc.top + c.h / 2 + (cy - c.y) * s; const x = Math.max(0, sx - ww / 2 * s), y = Math.max(0, sy - hh / 2 * s);
      return { x, y, width: Math.min(ww * s, innerWidth - x), height: Math.min(hh * s, innerHeight - y) }; }, [cx, cy, ww, hh]);
    const shot = async (name, cl) => { const f = `shots/art2-${name}-${LABEL}-${vp}.png`; await p.screenshot({ path: f, clip: cl }); rep.shots.push(f); return f; };
    const ltAt = (deck, x, y, face) => p.evaluate(([deck, x, y, face]) => { const Lt = __T.G.lt; Lt.deck = deck; Lt.lift = null; Lt.x = x; Lt.y = y; Lt.mode = 'idle'; Lt.path = null; Lt.face = face; __T.cam.snap = true; __T.cam.manualT = 0; }, [deck, x, y, face]);
    // 1) hi-res bridge: the command dais and the conn console with the Lt standing between them
    if (!process.env.CASES || process.env.CASES.includes('bridge')) {
    await ltAt('bridge', 0.499, 0.56, 'down');
    R.bridge = await p.evaluate(async () => { const A = await import('/js/assets.js'); for (const a of __T.ambient) a.deck = 'nowhere'; const im = A.IMG['deck-bridge'], fg = A.IMG['fg-bridge'];
      return { plate: im && [im.width, im.height], fg: fg && [fg.width, fg.height] }; });
    await L.sleep(1200);
    R.bridge.dais = await shot('bridgehr-dais', await clipD(480, 300, 240, 170));
    R.bridge.conn = await shot('bridgehr-conn', await clipD(360, 470, 200, 120));
    }
    // 2) female crew base (Ens. Maren Kovac) and 3) the Betazoid (Ianna Rhovan) beside the Lt in Main Engineering
    for (const [key, id] of [['female', 'kovac'], ['betazoid', 'rhovan'], ['bolian', 'tull']].filter(c => !process.env.CASES || process.env.CASES.split(',').includes(c[0]))) {
      await ltAt('engineering', 0.45, 0.66, 'left');
      const info = await p.evaluate(id => { const n = __T.npcOf(id); for (const a of __T.ambient) if (a !== n) a.deck = 'nowhere'; if (!n) return null;
        n.deck = 'engineering'; n.x = 0.39; n.y = 0.66; n.mode = 'dwell'; n.path = null; n.spot = { id: 'linger', face: 'down', action: null }; n.dir = 'down'; n.t = 60;
        const o = __T.G.prog.crew.occ[id]; return { id, name: o.name, pronoun: o.pronoun, species: o.species, sheet: n.who }; }, id);
      if (!info) { errs.push(`${vp} no npc ${id}`); continue; }
      await L.sleep(1500);
      const nclip = () => p.evaluate(id => { const n = __T.npcOf(id); return [n.x * 960, n.y * 640 - 45]; }, id);
      const [ax, ay] = await nclip(); info.stand = await shot(`${key}-stand`, await clipD(ax, ay, 150, 130));
      const moved = await p.evaluate(id => { const n = __T.npcOf(id), s = n.cfg.spots.find(q => q.deck === undefined || q.deck === 'engineering') || n.cfg.spots[0]; try { __T.ambientTo(n.slot, s.id); } catch (e) { return 'err ' + e.message; } return s.id; }, id);
      await L.sleep(800); const [bx, by] = await nclip(); info.walkMode = await p.evaluate(id => __T.npcOf(id).mode, id); info.walkTo = moved;
      info.walk = await shot(`${key}-walk`, await clipD(bx, by, 150, 130));
      R[key] = info;
      if (LABEL === 'after' && info.sheet !== { female: 'crew-female-v1', betazoid: 'crew-betazoid-v1', bolian: 'crew-bolian-v1' }[key]) errs.push(`${vp} ${id} sheet ${info.sheet}`);
    }
    if (LABEL === 'after' && R.bridge && !(R.bridge.plate && R.bridge.plate[0] === 1920 && R.bridge.fg && R.bridge.fg[0] === 1920)) errs.push(`${vp} bridge plate/fg not 1920 wide`);
    await ctx.close();
  }
  rep.errors = errs; fs.writeFileSync(`shots/art2-suite20-${LABEL}${process.env.CASES ? '-' + process.env.CASES.replace(/,/g, '-') : ''}.json`, JSON.stringify(rep, null, 1));
  console.log(JSON.stringify(rep.vp)); console.log('errors', errs.length, errs.slice(0, 5)); await b.close();
})();
