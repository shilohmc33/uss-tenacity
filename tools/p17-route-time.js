// Pass 17 P2: repair trip time vs the injury window. In-page, paused, stepSim(0.1): the Lt starts at a deck node, a MED fault opens,
// sendRepair(sys) is ordered; trip = seconds until he starts the repair (L.mode "repair" at the system), done = until the fault is gone.
// Share = trip / PROG.deaths.window (pass 16: 180 s window). Report shots/p17-route-time.json.   usage: node tools/p17-route-time.js [url] [label]
const L = require('/workspace/playtest-scripts/lib.js'); const fs = require('fs');
const URL = process.argv[2] || 'http://127.0.0.1:8765/', LABEL = process.argv[3] || 'now';
(async () => {
  const b = await L.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
  await p.goto(URL + '?reset=1&debug=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(800);
  const res = await p.evaluate(async () => { window.__noSave = true; __T.app.paused = true;
    const sim = await import('/js/sim.js'), P = await import('/js/pacing.js'), CR = await import('/js/crew.js'), PR = await import('/js/progression.js'), D = await import('/js/data.js'); const G = __T.G;
    const routes = [['bridge', 'msd', 'coolant'], ['bridge', 'msd', 'warpcore'], ['medical', 'biobed', 'coolant'], ['lounge', 'bar', 'coolant'], ['engineering', 'core', 'shields']];
    const out = { window: PR.PROG.deaths.window, travelScale: P.TRAVEL_SCALE || 1, routes: {} };
    for (const [deck, node, sys] of routes) { const runs = [];
      for (let k = 0; k < 5; k++) { for (const f of Object.keys(G.ship.faults)) delete G.ship.faults[f]; G.sp.battle = null;
        const n = D.NODEMAP[node] || D.DECKS[deck].nodes[node]; const Lt = G.lt; Lt.deck = deck; Lt.lift = null; Lt.x = n.x; Lt.y = n.y; Lt.mode = 'idle'; Lt.node = null; Lt.path = null; Lt.intent = null; Lt.repairSys = null;
        G.ship.faults[sys] = { sev: 'med', cost: 1, t: 0 }; CR.sendRepair(sys); let t = 0, trip = null;
        while (t < 120 && G.ship.faults[sys]) { P.playerInput(); sim.stepSim(0.1); t += 0.1; if (trip == null && Lt.mode === 'repair' && Lt.repairSys === sys && !Lt.path) trip = t; }
        runs.push({ trip: trip == null ? null : +trip.toFixed(1), done: G.ship.faults[sys] ? null : +t.toFixed(1) }); }
      const tr = runs.map(r => r.trip).filter(x => x != null).sort((a, b) => a - b), dn = runs.map(r => r.done).filter(x => x != null).sort((a, b) => a - b);
      out.routes[`${deck}->${sys}`] = { trip: tr[Math.floor(tr.length / 2)], done: dn[Math.floor(dn.length / 2)], share: +(tr[Math.floor(tr.length / 2)] / out.window * 100).toFixed(1), runs }; }
    return out; });
  res.errors = errs; res.label = LABEL; fs.writeFileSync(`shots/p17-route-time-${LABEL}.json`, JSON.stringify(res, null, 1));
  console.log(`${LABEL}: window ${res.window} s (TRAVEL_SCALE ${res.travelScale})`); for (const [k, r] of Object.entries(res.routes)) console.log(`${k.padEnd(22)} trip ${r.trip} s  repair done ${r.done} s  trip/window ${r.share}%`);
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
