// Pass 18 #2: deck-task trip time vs its window, before (pass 16 seconds) and after (x TRAVEL_SCALE). In-page, paused, stepSim(0.1):
// the Lt starts at a node, sendUse(task node) is ordered; trip = seconds until he is using that node. Windows: voyage-event deck tasks
// (distress locker 30, defector pads 30, anomaly msd 26, storm core 26), odd jobs 150 (example nodes), CRIT knock-on 150 (repair trip).
//   node tools/p18-task-time.js [url]   -> shots/p18-task-time.json
const L = require('/workspace/playtest-scripts/lib.js'); const fs = require('fs'), path = require('path');
const OUT = path.resolve(__dirname, '..', 'shots') + '/';
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}
const URL = process.argv[2] || 'http://127.0.0.1:8765/';
(async () => {
  const b = await L.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
  await p.goto(URL + '?reset=1&debug=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(800);
  const res = await p.evaluate(async () => { window.__noSave = true; __T.app.paused = true;
    const sim = await import('/js/sim.js'), P = await import('/js/pacing.js'), CR = await import('/js/crew.js'), PR = await import('/js/progression.js'), D = await import('/js/data.js'); const G = __T.G;
    const TS = P.TRAVEL_SCALE, out = { travelScale: TS, jobsExpire: PR.PROG.jobs.expire, critKnockOnS: P.PACE.critKnockOnS, rows: [] };
    const tasks = [['distress (locker)', 'locker', 30], ['defector (pads)', 'pads', 30], ['anomaly (msd)', 'msd', 26], ['storm (core)', 'core', 26], ['odd job (biobed)', 'biobed', 150], ['odd job (bar)', 'bar', 150]];
    const starts = [['bridge', 'msd'], ['engineering', 'core'], ['medical', 'biobed'], ['lounge', 'bar']];
    for (const [name, node, base] of tasks) for (const [deck, from] of starts) { if (from === node) continue;
      for (const f of Object.keys(G.ship.faults)) delete G.ship.faults[f]; G.sp.battle = null; G.sp.ev.active = null;
      const n = D.NODEMAP[from]; const Lt = G.lt; Lt.deck = deck; Lt.lift = null; Lt.x = n.x; Lt.y = n.y; Lt.mode = 'idle'; Lt.node = null; Lt.path = null; Lt.intent = null;
      CR.sendUse(node); let t = 0, trip = null;
      while (t < 120 && trip == null) { P.playerInput(); sim.stepSim(0.1); t += 0.1; if (Lt.mode === 'use' && Lt.node === node) trip = +t.toFixed(1); }
      const after = P.travelS(base); out.rows.push({ task: name, from: `${deck}/${from}`, trip, before: base, after, shareBefore: trip && +(trip / base * 100).toFixed(0), shareAfter: trip && +(trip / after * 100).toFixed(0) }); }
    return out; });
  res.errors = errs; fs.writeFileSync(OUT + 'p18-task-time.json', JSON.stringify(res, null, 1));
  console.log(`TRAVEL_SCALE ${res.travelScale} jobs.expire ${res.jobsExpire} critKnockOnS ${res.critKnockOnS}`);
  for (const r of res.rows) console.log(`${r.task.padEnd(18)} from ${r.from.padEnd(18)} trip ${String(r.trip).padStart(5)} s  window ${r.before} -> ${r.after} s  share ${r.shareBefore}% -> ${r.shareAfter}%`);
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
