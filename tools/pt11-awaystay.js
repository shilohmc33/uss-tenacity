// Pass 11 HOLD 3 metric (the tester's playtest-11 script 111c, adapted): a staged near-expiry serious injury, the Lt walks to fix;
// stay vs away 60/120/300 s at 4/6/8/10 s left, deaths per 100 (n per cell = N, default 250). Away must never beat staying.
// BASE=http://127.0.0.1:8765/ TAG=before|after N=500 node tools/pt11-awaystay.js -> shots/pt11-awaystay-<TAG>.json
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
  const R = {};
  const S = async (name, fn, arg) => { const t0 = Date.now(); R[name] = await p.evaluate(fn, arg).catch(e => 'ERR ' + e.message); console.log(name, ((Date.now() - t0) / 1000).toFixed(0) + 's', JSON.stringify(R[name]).slice(0, 900)); };
  const N = +(process.env.N || 250);
  await S('realwalk_near_expiry', n => { const G = __T.G, res = {}; for (const left of [4, 6, 8, 10]) for (const mode of ['stay', 'away60', 'away120', 'away300']) { const r = { n, death: 0, expired: 0, surg: 0, sx: 0, crewFixedAway: 0, fixedInAway: 0, outs: {} }; for (let k = 0; k < n; k++) { M.stage(30, 2); const i = M.hurt('hazard', 'kovac', { sys: 'coolant' }); const sys = i.sys; let t = 0; while (!i.ack && t < 5) { M.live(0.1); t += 0.1; } while (i.left > left + 0.05 && i.state === 'warning') M.live(0.1); const n0 = { ...M.MD.M().n }; const Rr = M.P.PACE_RT; if (mode === 'hide20') { Rr.hidden = true; M.live(20, { idle: true }); Rr.hidden = false; M.P.playerInput(); } if (mode.startsWith('away')) { const had = !!G.ship.faults[sys]; Rr.hidden = true; M.sim.catchUp(+mode.slice(4)); if (had && !G.ship.faults[sys]) r.fixedInAway++; Rr.hidden = false; M.P.playerInput(); } if (mode !== 'stay') M.live(1); if (!G.ship.faults[sys] && mode !== 'stay') r.crewFixedAway++; if (G.ship.faults[sys] && i.state === 'warning') { M.CR.sendRepair(sys); t = 0; while (G.ship.faults[sys] && i.state === 'warning' && t < 60) { M.P.playerInput(); M.sim.stepSim(0.1); t += 0.1; } } M.live(0.2); if (i.state === 'surgery') { r.surg++; r.sx += i.sx; } const st = i.state; M.live(12); const out = M.out(n0); r.outs[out] = (r.outs[out] || 0) + 1; if (out === 'death') { r.death++; if (st !== 'surgery' && i.sx == null) r.expired++; } } r.deathRate = +(r.death / n).toFixed(3); r.meanSx = r.surg ? +(r.sx / r.surg).toFixed(3) : null; delete r.sx; res[`left${left}_${mode}`] = r; } return res; }, N);
  { const w = R.realwalk_near_expiry, cells = Object.entries(w || {}), pool = f => { const c = cells.filter(([k]) => f(k)); const d = c.reduce((a, [, v]) => a + v.death, 0), n = c.reduce((a, [, v]) => a + v.n, 0); return { n, deathRate: +(d / n).toFixed(4), se: +Math.sqrt(d / n * (1 - d / n) / n).toFixed(4) }; };
    R.summary = { stay: pool(k => k.endsWith('stay')), away: pool(k => k.includes('away')), fixedInAway: cells.reduce((a, [, v]) => a + (v.fixedInAway || 0), 0) };
    R.summary.awayNotBetter = R.summary.away.deathRate >= R.summary.stay.deathRate - 2 * Math.hypot(R.summary.away.se, R.summary.stay.se) && R.summary.fixedInAway === 0;
    console.log('SUMMARY', JSON.stringify(R.summary)); }
  R.errs = errs; fs.writeFileSync(`/workspace/tenacity/shots/pt11-awaystay-${process.env.TAG || 'after'}.json`, JSON.stringify(R, null, 1)); console.log('ERRS', JSON.stringify(errs));
  await b.close();
})();
