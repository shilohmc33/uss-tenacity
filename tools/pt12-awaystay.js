// Pass 12 HOLD 2 metric: pt11-awaystay with large n and the tester's send-then-leave case. A staged serious injury (Kovac, coolant,
// Lt on the bridge), acked, clock fast-forwarded to LEFT s; then per cell:
//   stay           - the player stays and sends the Lt now
//   away120        - hides 120 s (catch-up), returns, 1 s later sends the Lt
//   send_stay      - sends the Lt now and stays
//   send_away120   - sends the Lt now, hides 120 s, returns and re-sends him at once (the tester's 1.1 s clock-hold edge: the Lt
//                    walked while the clock waited for the re-ack); ltMovedHeld counts trials where he moved / repaired during that hold
// Pass 13: NEAR is the DEFAULT (the Lt starts at the lift on the system's own deck: walk + repair ~ a few s, so 8-12 s left sits on
// the margin); FAR=1 = the old bridge start (100% death below ~13 s). Battles ON by default (BATTLES=0 off): no session calm, and
//   battle_stay / battle_away120 - a Galor attacks as the clock hits LEFT with Okafor's Miracle Worker ready; then stay / away 120 s
// mwLinked counts trials where Miracle Worker repaired the patient's own system (must be 0, present or away). MODES=a,b to pick arms.
// Death % per cell, away vs stay z (positive z = away better). BASE=... N=2000 LEFTS=6,8 TAG=x [SCALED=1] [FAR=1] node tools/pt12-awaystay.js
// Pass 08: surgery rates, free-save attacks, resume-clock, expiry, play-day clock (in-page, deterministic module calls)
process.env.BASE = process.env.BASE || 'http://127.0.0.1:8765/';   // the tester's lib defaults to their own (stopped) server
const L = require('/workspace/playtest-scripts/lib.js'); const fs = require('fs');
(async () => {
  const b = await L.launch(); const { p } = await L.mk(b, 'desk');
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await L.boot(p, '?debug=1&reset=1');
  await p.evaluate(async () => {
    window.__noSave = true; __T.app.paused = true;
    const M = window.M = { St: await import('/js/state.js'), sim: await import('/js/sim.js'), P: await import('/js/pacing.js'), PR: await import('/js/progression.js'), MD: await import('/js/injuries.js'), CL: await import('/js/crewlife.js'), CR: await import('/js/crew.js'), D: await import('/js/data.js') };
    const G = M.St.G;
    M.stage = (pd, rank, o = {}) => {
      M.St.resetState(); const R = M.P.PACE_RT; R.offline = false; R.idleT = 0; R.sessionT = 500; R.hidden = false;
      G.prog.playDays = pd; G.prog.lastPlayDate = o.last || '2026-11-01'; G.prog.lastPlayAt = o.lastAt ?? new Date(2026, 10, 1, 12).getTime(); G.prog.rank = rank; G.prog.level = 20;
      G.prog.presentTotal = o.pt ?? 5 * 3600; G.prog.dayPresent = 0;
      for (const k of Object.keys(G.ship.faults)) delete G.ship.faults[k];
      G.prog.opinions.tull = 90; G.prog.opinions.delgado = 85; G.prog.opinions.kovac = 0; G.prog.opinions.mollo = 0;
      G.prog.crew.log = []; G.sp.battle = null; G.sp.travel = null; G.sp.location = 'ds9';
      G.lt.deck = 'bridge'; G.lt.mode = 'use'; G.lt.node = 'msd'; G.lt.lift = null; G.lt.path = null; G.ship.parts = 20;
      if (o.gentle != null) M.MD.setGentle(o.gentle); M.MD.M().asked = true; M.MD.M().prompt12 = true;
    };
    M.live = (s, opts = {}) => { let t = 0; while (t < s - 1e-9) { if (!opts.idle) M.P.playerInput(); M.sim.stepSim(0.1); t += 0.1; } };
    M.fix = (inj, by) => { if (by) inj.fixBy = by; delete G.ship.faults[inj.sys]; };
    M.hurt = (cause, id, extra = {}) => M.MD.injure(cause, { id, sev: 'serious', ...extra });
    M.lock = (s) => { const R = M.P.PACE_RT; R.hidden = true; if (s > 30) M.sim.catchUp(s); else M.live(s, { idle: true }); R.hidden = false; M.P.playerInput(); };
    M.out = (n0) => { const n = M.MD.M().n; return n.deaths > n0.deaths ? 'death' : n.evac > n0.evac ? 'evac' : n.hospital > n0.hospital ? 'hospital' : (n.awaySaved || 0) > (n0.awaySaved || 0) ? 'awaySaved' : (n.closeCalls || 0) > (n0.closeCalls || 0) ? 'close' : n.saved > n0.saved ? 'saved' : n.pulled > n0.pulled ? 'pulled' : 'open'; };
    M.batch = (n, fn) => { const o = { n, sx: 0, bands: {} }; for (let k = 0; k < n; k++) { const r = fn(k); o[r.o] = (o[r.o] || 0) + 1; if (r.sx != null) o.sx += r.sx; if (r.band) o.bands[r.band] = (o.bands[r.band] || 0) + 1; } o.sx = +(o.sx / n).toFixed(4); o.grave = +(((o.death || 0) + (o.close || 0) + (o.evac || 0) + (o.hospital || 0)) / n).toFixed(3); o.deathRate = +((o.death || 0) / n).toFixed(3); return o; };
    // one surgery trial: pre = seconds of present play before the fix, by = fixBy, assist = tap, extra(inj) hook
    M.surg = (o = {}) => { M.stage(30, 2); const i = M.hurt('hazard', 'kovac', { sys: 'coolant' }); M.live(o.pre ?? 5, { idle: !!o.idlePre }); if (o.eps) G.ship.faults.eps = { sev: 'med', cost: 1, t: 0 }; M.fix(i, o.by === undefined ? 'lt' : o.by); const n0 = { ...M.MD.M().n }; M.live(0.2, { idle: !!o.idlePre }); const od = M.MD.surgeryOdds(); let sx = i.sx, band = od && od.band; if (o.assist) { M.P.playerInput(); M.live(0.1); M.MD.assistSurgery(); sx = i.sx; band = M.MD.surgeryOdds()?.band; } if (o.lockS) M.lock(o.lockS); if (o.hidS) { M.P.PACE_RT.hidden = true; M.live(o.hidS, { idle: true }); M.P.PACE_RT.hidden = false; } M.live(12); return { o: M.out(n0), sx, band, fast: i.fast }; };
  });
  const NEAR = !process.env.FAR, BATTLES = process.env.BATTLES !== '0', N = +(process.env.N || 2000), LEFTS = (process.env.LEFTS || '6,8,10,12,14').split(',').map(Number), MODES = (process.env.MODES || 'stay,away120,send_stay,send_away120,battle_stay,battle_away120').split(',');
  const res = {}; const t0 = Date.now();
  // pass 17 P2: SCALED=1 stages LEFT in pass-16 seconds, i.e. LEFT x pacing.js TRAVEL_SCALE (the same share of the injury window
  // now that walks take ~1.55x as long); default = raw seconds left (comparable with suites 14-19)
  const LSCALE = process.env.SCALED ? await p.evaluate(async () => (await import('/js/pacing.js')).TRAVEL_SCALE || 1) : 1;
  await p.evaluate(s => { window.__LSCALE = s; }, LSCALE); if (LSCALE !== 1) console.log(`SCALED: LEFT x ${LSCALE}`);
  for (const left of LEFTS) for (const mode of MODES) {
    const chunks = [];
    for (let done = 0; done < N; done += 250) chunks.push(await p.evaluate(async ({ n, left, mode: fullMode, near, battles }) => { const await_data = await import('/js/data.js'), BT = await import('/js/battle.js'); const G = __T.G, r = { n, death: 0, surg: 0, sx: 0, fixedInAway: 0, ltMovedHeld: 0, mwLinked: 0, battles: 0 };
      const bus = await import('/js/bus.js');
      if (!window.__mwHook) { window.__mwHook = true; bus.on('log', (msg) => { const m = typeof msg === 'string' ? msg : (msg && msg.msg) || ''; if (!/Miracle Worker/.test(m)) return; const inj = (G.prog.med && G.prog.med.inj) || [];
        if (inj.some(x => (x.state === 'warning' || x.state === 'surgery') && x.sys && m.includes(await_data.SYSTEMS[x.sys].name + ' fault repaired'))) window.__mwViol = true; }); }
      const fight = fullMode.startsWith('battle_'), mode = fullMode.replace('battle_', '');
      for (let k = 0; k < n; k++) { M.stage(30, 2); const i = M.hurt('hazard', 'kovac', { sys: 'coolant' }); const sys = i.sys; let t = 0; while (!i.ack && t < 5) { M.live(0.1); t += 0.1; }
        if (near) { const D = await_data.DECKS, SY = await_data.SYSTEMS, dk = SY[sys].deck; G.lt.deck = dk; G.lt.x = D[dk].lift.x; G.lt.y = D[dk].lift.y; G.lt.mode = 'idle'; G.lt.node = null; G.lt.path = null; G.lt.intent = null; }   // NEAR=1: the Lt starts at the lift on the system's deck
        i.left = left * (window.__LSCALE || 1); const n0 = { ...M.MD.M().n }, Rr = M.P.PACE_RT;
        if (battles) { Rr.sessionT = 3600; G.sp.lastBattleT = -1e9; }   // battles on: no session calm, so live / catch-up battles can start
        window.__mwViol = false; const b0 = G.stats.battles;
        if (fight) { G.ab.miracle.cd = 0; G.ab.miracle.active = 0; BT.startBattle('enroute', { enemy: 'galor' }); }   // a battle starts as the clock hits LEFT, Miracle Worker ready
        if (mode.startsWith('send')) M.CR.sendRepair(sys);
        if (mode.endsWith('away120')) { const had = !!G.ship.faults[sys]; Rr.hidden = true; M.sim.catchUp(120); if (had && !G.ship.faults[sys]) r.fixedInAway++; Rr.hidden = false; M.P.playerInput();
          // the player is back and sends the Lt again at once (catch-up drops his errand; tapping the system, not the alert pill, so no instant ack)
          if (mode === 'send_away120' && G.ship.faults[sys] && i.state === 'warning') M.CR.sendRepair(sys);
          // the held-clock window on return: the Lt must not move while the clock is held for the re-ack
          // a step counts as 'held' when the clock did not run in it (left unchanged); the Lt must not move / repair in any held step
          let h = 0, moved = false; const pos = () => [G.lt.x, G.lt.y, G.lt.deck, G.lt.repairT, G.lt.mode, !!G.lt.lift].join('|');
          while ((h < 0.05 || !i.ack) && i.state === 'warning' && h < 3) { const p0 = pos(), l0 = i.left; M.P.playerInput(); M.sim.stepSim(0.1); h += 0.1; if (i.left === l0 && i.state === 'warning' && pos() !== p0) moved = true; }
          if (moved) r.ltMovedHeld++; }
        if (mode === 'away120') { M.live(1); }
        if (!mode.startsWith('send') && G.ship.faults[sys] && i.state === 'warning') M.CR.sendRepair(sys);
        t = 0; while (G.ship.faults[sys] && i.state === 'warning' && t < 60) { M.P.playerInput(); M.sim.stepSim(0.1); t += 0.1; }
        const nm = await_data.SYSTEMS[sys].name; if (window.__mwViol) r.mwLinked++;   // Miracle Worker repaired the system while a patient's clock / surgery still depended on it (checked live on the log bus)
        M.live(0.2); if (i.state === 'surgery') { r.surg++; r.sx += i.sx; } M.live(12); if (M.out(n0) === 'death') r.death++;
        r.battles += G.stats.battles - b0; G.sp.battle = null; }
      window.__mv = null; return r; }, { n: Math.min(250, N - done), left, mode, near: NEAR, battles: BATTLES }));
    const r = chunks.reduce((a, c) => { for (const k of Object.keys(c)) a[k] = (a[k] || 0) + c[k]; return a; }, {});
    r.deathRate = +(r.death / r.n).toFixed(4); r.meanSx = r.surg ? +(r.sx / r.surg).toFixed(3) : null; delete r.sx; res[`left${left}_${mode}`] = r;
    console.log(`left ${left} ${mode}: n ${r.n} death ${(r.deathRate * 100).toFixed(2)}% surg ${r.surg} ltMovedHeld ${r.ltMovedHeld} fixedInAway ${r.fixedInAway} mwLinked ${r.mwLinked} battles ${r.battles} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  const z = (a, s) => { const p1 = a.death / a.n, p2 = s.death / s.n, se = Math.sqrt(p1 * (1 - p1) / a.n + p2 * (1 - p2) / s.n) || 1e-9; return +((p2 - p1) / se).toFixed(2); };
  const pairs = {}; let bad = 0;
  for (const left of LEFTS) for (const [a, s] of [['away120', 'stay'], ['send_away120', 'send_stay'], ['battle_away120', 'battle_stay']].filter(([a, b]) => MODES.includes(a) && MODES.includes(b))) { const A = res[`left${left}_${a}`], S = res[`left${left}_${s}`], zz = z(A, S);
    pairs[`left${left} ${a} vs ${s}`] = { away: A.deathRate, stay: S.deathRate, z: zz, ltMovedHeld: A.ltMovedHeld, fixedInAway: A.fixedInAway, mwLinked: A.mwLinked + S.mwLinked }; if (zz > 1.96 || A.ltMovedHeld || A.fixedInAway || A.mwLinked || S.mwLinked) bad++; }
  for (const [k, v] of Object.entries(pairs)) console.log(`${k}: away ${(v.away * 100).toFixed(2)}% vs stay ${(v.stay * 100).toFixed(2)}% · z(away better) ${v.z} · Lt moved while held ${v.ltMovedHeld} · fixed while away ${v.fixedInAway} · Miracle Worker fixed the patient's system ${v.mwLinked}`);
  console.log(bad ? `AWAYSTAY FAIL (${bad})` : 'AWAYSTAY PASS (away never better beyond noise, z <= 1.96; Lt frozen while the clock is held; no fix while away)');
  fs.writeFileSync(`/workspace/tenacity/shots/pt12-awaystay-${process.env.TAG || 'after'}${NEAR ? '' : '-far'}.json`, JSON.stringify({ N, res, pairs, errs }, null, 1)); console.log('ERRS', JSON.stringify(errs));
  await b.close();
})();
