// Battle groundwork: per-enemy-type battle sim. Runs the REAL battle code headless (paused rAF, stepSim at 1/20 s, seeded
// Math.random per run so every build fights the same dice) from one standard start: full hull/shields/power, 0-4 torpedoes,
// officer abilities at random points of their cooldowns (all ready = scan + spread one-shots the enemy), no faults, a passive Lt (nobody repairs mid-fight: it isolates the enemy's effect), present player.
// Reports per type: hull damage taken, shield damage, fault counts (new faults during the fight, by severity), battle
// duration, hull hits (shots that got through the shields), injury rate per battle (each hull hit rolls PROG.deaths.injury.battleHit,
// at most one per battle: 1-(1-p)^hits; the measured count is also given, but the sim's single game day trips the injury
// safeguards after a few, so it under-reads), and outcome (win / disengage / tow).
// NODE_PATH=/workspace/pwtools/node_modules node tools/battle-sim.js [base] [runs] [types,comma] [label] -> shots/battle-sim-<label>.json
// On a pre-groundwork build the type is ignored (the old single enemy): label it 'before'.
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const RUNS = +(process.argv[3] || 300);
const TYPES = (process.argv[4] || 'galor').split(',');
const LABEL = process.argv[5] || 'after';
const START = process.env.START || 'worn';
// pass 13: START=gated - a realistic start that PASSES the battlecruiser's gate (not crippled), a mix: 60% well kept (hull 85-100, shields /
// power 60-100, 2-8 torpedoes, cooldowns x1, a low / med fault 25% / 10%) and 40% mid-voyage (hull 60-85, shields / power 30-80, 1-6 (pass 15 D1; was 0-6)
// torpedoes, cooldowns x1.5, low / med 50% / 35%). BC='{"hull":200,...}' overrides the battlecruiser's stats in-page (tuning only). LT=active: the player keeps the Lt on the
// worst open fault through the fight (a present player); default passive (nobody repairs).
const LT = process.env.LT || 'passive', BCO = process.env.BC ? JSON.parse(process.env.BC) : null;
// BC_GATE='{"minHull":70,"minPower":40}' overrides the crippled-check floors in-page (gate tuning); START=worst / gated read the floors from PACE.
const BCG = process.env.BC_GATE ? JSON.parse(process.env.BC_GATE) : null;
// AWAY=1 (pass 11 check): the player is idle (not present) for the whole fight and a SEEN serious patient's life hangs on a
// MEDIUM Shield Generator fault at the start - pass 11 freezes that repair (no Miracle Worker, no Lt repair) while their clock is frozen.
const AWAY = process.env.AWAY === '1';   // full: a fresh ship; worn (default): hull 55-100, shields 20-100, power 30-100, cooldowns x1.5 (a mid-voyage fight);
                                             // hard: hull 35-80, shields 0-40, power 20-60, 0-1 torpedoes, cooldowns x2 (caught after a bad stretch)
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { window.__TENACITY_TEST_DEATHS = true; });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(BASE + '?reset=1');
  await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
  const out = { base: BASE, runs: RUNS, label: LABEL, start: START, lt: LT, away: AWAY, types: {} };
  for (const type of TYPES) {
    out.types[type] = await p.evaluate(async ({ type, RUNS, START, AWAY, LT, BCO, BCG, WORST_TORPS }) => {
      if (BCG) Object.assign((await import('/js/pacing.js')).PACE.encounter.bc, BCG);
      if (BCO) { const d = (await import('/js/ships.js')).SHIPS.jh_battlecruiser; const { dmg, every, first, pierce, ...rest } = BCO; Object.assign(d, rest); const w = d.weapons[0]; if (dmg) w.dmg = dmg; if (every) w.every = every; if (first != null) w.first = first; if (pierce != null) w.pierce = pierce; }
      window.__noSave = true; __T.app.paused = true;
      const sim = await import('/js/sim.js'), BT = await import('/js/battle.js'), CR = await import('/js/crew.js'), DA = await import('/js/data.js'), P = await import('/js/pacing.js'), G = __T.G;
      const orig = Math.random; const runs = []; const IH = (await import('/js/progression.js')).PROG.deaths.injury.battleHit;   // injury roll per hull hit (at most 1 per battle)
      for (let r = 0; r < RUNS; r++) {
        let s = 99991 + r * 7919; Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
        const S = G.ship, worn = START === 'worn', R = (a, b) => a + Math.random() * (b - a);
        const hard = START === 'hard';
        const gated = START === 'gated', WT = WORST_TORPS;
        if (START === 'worst') {   // pass 15 N1: the WORST start that still passes the battlecruiser's gate - hull 60, power 30, torpedoes = minTorps
          // (or WORST_TORPS), shields 20, one MED fault, abilities part-way through their cooldowns (x1.5, a mid-voyage fight)
          const gc = P.PACE.encounter.bc; Object.assign(S, { hull: gc.minHull, shields: 20, power: gc.minPower }); S.torps = WT != null ? WT : P.PACE.encounter.bc.minTorps; S.faults = {};
          const sys = Object.keys(DA.SYSTEMS), k = sys[Math.floor(Math.random() * sys.length)]; S.faults[k] = { sev: 'med', cost: 2, t: 0, escT: 0 }; window.__sf = k;
          for (const a of Object.values(G.ab)) { a.cd = Math.random() * (a.cdMax || 60) * 1.5; a.active = 0; }
        } else if (gated) { const fresh = Math.random() < 0.6;   // 60% a well-kept ship between fights, 40% caught mid-voyage (both pass the gate: hull >= 60, no crit)
          Object.assign(S, fresh ? { hull: R(85, 100), shields: R(60, 100), power: R(60, 100) } : { hull: R(P.PACE.encounter.bc.minHull, Math.max(85, P.PACE.encounter.bc.minHull)), shields: R(30, 80), power: R(P.PACE.encounter.bc.minPower, Math.max(80, P.PACE.encounter.bc.minPower)) }); S.torps = fresh ? 2 + Math.floor(Math.random() * 7) : 2 + Math.floor(Math.random() * 5);   // pass 15 N1: >= 2 torpedoes pass the gate (D1: >= 1) S.faults = {};
          const sys = Object.keys(DA.SYSTEMS); for (const [pr, sev] of [[fresh ? 0.25 : 0.5, 'low'], [fresh ? 0.1 : 0.35, 'med']]) if (Math.random() < pr) { const k = sys[Math.floor(Math.random() * sys.length)]; if (!S.faults[k]) S.faults[k] = { sev, cost: sev === 'med' ? 2 : 1, t: 0, escT: 0 }; }
          for (const a of Object.values(G.ab)) { a.cd = Math.random() * (a.cdMax || 60) * (fresh ? 1 : 1.5); a.active = 0; }
        } else {
        Object.assign(S, hard ? { hull: R(35, 80), shields: R(0, 40), power: R(20, 60) } : worn ? { hull: R(55, 100), shields: R(20, 100), power: R(30, 100) } : { hull: 100, shields: 100, power: 100 }); S.torps = Math.floor(Math.random() * (hard ? 2 : 5)); S.faults = {};   // 0-4 torpedoes (hard: 0-1)
        for (const a of Object.values(G.ab)) { a.cd = Math.random() * (a.cdMax || 60) * (hard ? 2 : worn ? 1.5 : 1); a.active = 0; }   // abilities part-way through their cooldowns
        }
        G.sp.battle = null; G.sp.evasiveT = 0; G.sp.travel = null; G.sp.travelPaused = false; G.sp.lastBattleT = -1e9; G.sp.preScanned = false;
        if (G.prog.med) { G.prog.med.inj = []; G.prog.med.hushUntil = 0; }
        P.PACE_RT.offline = false; P.PACE_RT.idleT = 0; P.PACE_RT.sessionT = 1e5;
        if (AWAY) { const pid = Object.keys(G.prog.crew.occ).find(id => !['tren', 'okafor'].includes(id)), o = G.prog.crew.occ[pid];
          S.faults.shields = { sev: 'med', cost: 1, t: 0, escT: 0 };
          G.prog.med.inj = [{ id: pid, name: o.name, short: o.short, sev: 'serious', sys: 'shields', state: 'warning', at: S.elapsed, pd: G.prog.playDays, day: G.prog.day, left: 1e6, seen: true, seenT: 5, offline: false, ack: true, acked: true, pendT: 0, ackT: 0, away: false, cause: 'hazard' }]; }
        G.lt.mode = 'idle'; G.lt.repairSys = null; G.lt.intent = null; G.lt.path = null;
        if (AWAY) P.PACE_RT.idleT = 1e6;   // pass 16 B1: idle BEFORE the fight starts, so it is an away fight (live-started fights keep live rules now)
        const st0 = { ...G.stats }, hull0 = S.hull; BT.startBattle('debug', { enemy: type });
        const B0 = G.sp.battle, t0 = S.elapsed, ene = B0 && B0.enemies ? B0.enemies[0].ship : 'legacy';
        const seenLog = new WeakSet(G.log); let hits = 0;
        let prevHull = S.hull, part = false, denied = false, dis = false;   // tow diagnosis (N1 root cause)
        let shFixedAt = 0, seen = new Set(), nf = 0, crit = 0, inj = 0, minHull = 100, shieldLost = 0, lastSh = S.shields, steps = 0;
        while (G.sp.battle && steps < 12000) {
          P.PACE_RT.idleT = AWAY ? 1e6 : 0;
          if (LT === 'active' && steps % 10 === 0 && !G.lt.repairSys && !(G.lt.intent && G.lt.intent.sys)) { const ks = Object.keys(S.faults).sort((a, b) => ({ crit: 0, med: 1, low: 2 }[S.faults[a].sev] - { crit: 0, med: 1, low: 2 }[S.faults[b].sev])); if (ks.length) CR.sendRepair(ks[0]); }
          prevHull = S.hull; sim.stepSim(0.05); steps++; if (AWAY && !shFixedAt && !S.faults.shields) shFixedAt = S.elapsed - t0;
          for (const [k, f] of Object.entries(S.faults)) if (!seen.has(k + f.sev)) { seen.add(k + f.sev); nf++; if (f.sev === 'crit') crit++; }
          for (const k of [...seen]) if (!S.faults[k.replace(/(low|med|crit)$/, '')]) seen.delete(k);
          if (G.sp.battle) inj = Math.max(inj, G.sp.battle.injN || 0);
          for (let i = G.log.length - 1; i >= Math.max(0, G.log.length - 12); i--) { const e = G.log[i]; if (seenLog.has(e)) break; seenLog.add(e); const tx = e.text || e.msg || ''; if (/the hull takes/.test(tx)) hits++; if (/Parting volley/.test(tx)) part = true; if (/Disengage denied/.test(tx)) denied = true; if (/emergency warp, disengage/.test(tx)) dis = true; }
          if (S.shields < lastSh) shieldLost += lastSh - S.shields; lastSh = S.shields; minHull = Math.min(minHull, S.hull);
        }
        const st = G.stats, out = st.tows > st0.tows ? 'tow' : st.wins > st0.wins ? 'win' : 'disengage';
        runs.push({ ene, shFixed: shFixedAt ? 1 : 0, hits, injExp: 1 - Math.pow(1 - IH, hits), dur: S.elapsed - t0, hullLost: Math.max(0, hull0 - (out === 'tow' ? 0 : S.hull)), minHull, shieldLost, nf, crit, inj, out, towHull: out === 'tow' ? prevHull : null, sf: START === 'worst' ? window.__sf : null, part, denied, dis });
        G.sp.battle = null; S.faults = {};
      }
      Math.random = orig;
      const avg = k => Math.round(runs.reduce((a, x) => a + x[k], 0) / runs.length * 10) / 10;
      const pct = f => Math.round(runs.filter(f).length / runs.length * 1000) / 10;
      const q = (k, f) => { const a = runs.map(x => x[k]).sort((x, y) => x - y); return Math.round(a[Math.floor(f * (a.length - 1))] * 10) / 10; };
      const tw = runs.filter(x => x.out === 'tow'), tp = f => tw.length ? Math.round(tw.filter(f).length / runs.length * 1000) / 10 : 0;
      // why she was towed (% of ALL fights): the parting volley after T'Ren broke off; disengage denied (warp core fault); one hit from
      // >= 25% hull straight to 0 (no chance to break off); under 25% but not yet broken off (between officer orders)
      const towCause = { partingVolley: tp(x => x.dis && x.part), denied: tp(x => !x.dis && x.denied), oneHitFrom25: tp(x => !x.dis && !x.denied && x.towHull >= 25), deniedStartWarpcore: tp(x => !x.dis && x.denied && x.sf === 'warpcore'), under25NotYetOff: tp(x => !x.dis && !x.denied && x.towHull < 25),
        towHullP50: tw.length ? (() => { const a = tw.map(x => x.towHull).sort((p, q) => p - q); return Math.round(a[a.length >> 1] * 10) / 10; })() : null };
      return { towCause, enemy: runs[0].ene, n: runs.length, dur: avg('dur'), durP50: q('dur', 0.5), durP90: q('dur', 0.9), hullLost: avg('hullLost'), hullLostP50: q('hullLost', 0.5), hullLostP90: q('hullLost', 0.9), shieldLost: avg('shieldLost'),
        faults: avg('nf'), critFaults: avg('crit'), hullHits: avg('hits'), injuryRatePct: Math.round(runs.reduce((a, x) => a + x.injExp, 0) / runs.length * 1000) / 10, injuryPctMeasured: pct(x => x.inj > 0), winPct: pct(x => x.out === 'win'), ...(() => { const w = runs.filter(x => x.out === 'win'), h = w.map(x => x.hullLost).sort((a, b) => a - b); return { winHullLost: w.length ? Math.round(h.reduce((a, b) => a + b, 0) / w.length * 10) / 10 : 0, winHullLostP50: w.length ? Math.round(h[Math.floor(h.length / 2)] * 10) / 10 : 0, winHullLostP90: w.length ? Math.round(h[Math.floor(0.9 * (h.length - 1))] * 10) / 10 : 0, winsWithHullLossPct: w.length ? Math.round(w.filter(x => x.hullLost > 0.5).length / w.length * 1000) / 10 : 0 }; })(), disengagePct: pct(x => x.out === 'disengage'), towPct: pct(x => x.out === 'tow'), ...(AWAY ? { shieldFaultFixedInBattlePct: pct(x => x.shFixed) } : {}) };
    }, { type, RUNS, START, AWAY, LT, BCO, BCG, WORST_TORPS: process.env.WORST_TORPS != null ? +process.env.WORST_TORPS : null });
    console.log(type, JSON.stringify(out.types[type]));
  }
  out.errors = errs;
  fs.writeFileSync(__dirname + `/../shots/battle-sim-${LABEL}-${START}${LT === 'active' ? '-lt' : ''}${AWAY ? '-away' : ''}.json`, JSON.stringify(out, null, 1));
  console.log('ERRORS', errs.length, errs.slice(0, 3));
  await b.close();
})();
