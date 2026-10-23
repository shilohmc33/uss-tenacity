// Crew needs N3 check: medium/major incidents (gates, caps, grace, gentle, unseen), Lt response (resolve/expire),
// refuse -> station 70%, unwell is not an injury, mis-set console never CRITICAL, harden, 10-day cap sim, shots.
// Usage: node tools/n3-check.js
const { chromium } = require('playwright-core'); const BASE = process.env.BASE || 'http://127.0.0.1:8765/', OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [], res = {};
  for (const [w, h] of [[390, 844], [844, 390], [1280, 800]]) {
    const tag = `${w}x${h}`, c = await br.newContext({ viewport: { width: w, height: h } }), p = await c.newPage();
    p.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); }); p.on('pageerror', e => errs.push(`${tag}: ${e.message}`));
    await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(400);
    await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); });
    const R = res[tag] = {};
    // shot: a lounge argument posted, Lt in the lounge; Thelev Breaking behind the bar (icon clamp + edge arrow at short heights)
    R.shot = await p.evaluate(async () => { const N = await import('/js/needs.js'), I = await import('/js/incidents.js'), PC = await import('/js/pacing.js'), G = __T.G, C = G.prog.crew, L = G.lt;
      L.lift = null; L.deck = 'lounge'; L.x = 0.3; L.y = 0.82; L.mode = 'idle'; L.path = null; L.node = null; __T.cam.snap = true; PC.PACE_RT.idleT = 0; G.prog.playDays = 8;
      const set = (sl, v) => { const id = C.slots[sl], r = N.needsOf(id); r.shift = N.shiftNow(); for (const k of N.NEED_KEYS) r.n[k] = v; r.n.food = 60; r.act = 'duty'; r.stress = 5; return id; };
      const d = set('steward', 4); set('mess-regular-1', 2); N.tickNeeds(10); N.needsOf(d).band = 4; N.needsOf(d).stress = 5;
      const rnd = Math.random; Math.random = () => 0.5; try { I.rollIncident(d, N.needsOf(d), 1); } finally { Math.random = rnd; }   // 0.5 >= majors' 0.2/h -> medium; 0.5 -> refuse... force argument below
      if (!I.activeIncident() || I.activeIncident().inc !== 'argument') { G.prog.jobs.active = null; G.prog.inc.lastMed = -1e12; Math.random = () => 0.1; try { I.rollIncident(d, N.needsOf(d), 1); } finally { Math.random = rnd; } }
      const a = I.activeIncident(); if (a) { const n = (await import('/js/data.js')).NODEMAP[a.node]; L.deck = a.deck; L.x = n.x; L.y = n.y; L.mode = 'use'; L.node = a.node; } return a && { inc: a.inc, label: a.label, node: a.node, deck: a.deck }; });
    await sleep(1500);
    R.status = await p.evaluate(() => /Responding to incident/.test(document.body.innerText));
    R.pill = await p.evaluate(() => [...document.querySelectorAll('*')].some(e => e.children.length === 0 && /INCIDENT —/.test(e.textContent)));
    await p.evaluate(() => { __T.app.paused = true; }); await p.screenshot({ path: OUT + `n3-incident-${tag}.png` }); await p.evaluate(() => { __T.app.paused = false; });
    if (tag !== '1280x800') { await c.close(); continue; }
    R.logic = await p.evaluate(async () => { const N = await import('/js/needs.js'), M = await import('/js/mood.js'), I = await import('/js/incidents.js'), O = await import('/js/oddjobs.js'), PC = await import('/js/pacing.js'), P = await import('/js/progression.js'), G = __T.G, C = G.prog.crew, L = G.lt, out = {};
      const logs = () => [...document.querySelectorAll('#log *')].map(e => e.textContent).join(' | ');
      const rnd = Math.random, withR = (v, f) => { Math.random = typeof v === 'function' ? v : () => v; try { return f(); } finally { Math.random = rnd; } };
      const id = C.slots['engineer-2'], r = N.needsOf(id);
      const prime = (band = 4, stress = 5) => { for (const k of N.NEED_KEYS) r.n[k] = band >= 4 ? 4 : 20; r.n.food = 60; r.band = band; r.stress = stress; delete r.unwell; delete r.refuse; G.prog.jobs.active = null; };
      const roll = v => withR(v, () => I.rollIncident(id, r, 1)), act = () => I.activeIncident();
      // grace: play day 3 -> nothing
      G.prog.playDays = 3; prime(); G.prog.inc.lastMed = G.prog.inc.lastMaj = -1e12; roll(0); out.grace = act() ? 'FAIL' : 'none';
      G.prog.playDays = 8;
      // unseen: idle (night crew) / offline / battle -> nothing
      PC.PACE_RT.idleT = 1e6; prime(); roll(0); out.unseenIdle = act() ? 'FAIL' : 'none'; PC.PACE_RT.idleT = 0;
      // gentle: no majors (medium still allowed)
      G.prog.med.gentle = true; prime(); const m0 = G.prog.inc.n.major; roll(0.01); out.gentle = { major: G.prog.inc.n.major - m0, got: act() && act().inc }; G.prog.med.gentle = false;
      // stressed but low stress hours -> nothing
      prime(3, 0.5); G.prog.inc.lastMed = -1e12; roll(0); out.lowStress = act() ? 'FAIL' : 'none';
      // medium cap: 1 per ship's day
      prime(3, 2); G.prog.inc.lastMed = G.ship.elapsed - 3600; roll(0); out.medCap = act() ? 'FAIL' : 'none';
      // major cap: 1 per 5 days (lastMaj 2 days ago, medium also capped)
      prime(); G.prog.inc.lastMaj = G.ship.elapsed - 2 * 57600; G.prog.inc.lastMed = G.ship.elapsed - 3600; roll(0); out.majCap = act() ? 'FAIL' : 'none';
      // refuse -> station 70%, Lt resolves at his post
      prime(3, 2); G.prog.inc.lastMed = -1e12; const e0 = M.stationEff('coolant'); { let n = 0; roll(() => n++ ? 0.5 : 0); } const a1 = act(); const e1 = M.stationEff('coolant');
      out.refuse = { inc: a1 && a1.inc, node: a1 && a1.node, eff: [+e0.toFixed(3), +e1.toFixed(3)] };
      L.deck = a1.deck; L.node = a1.node; L.mode = 'use'; a1.acc = a1.need - 0.01; O.tickJobs(0.5); out.refuse.after = { active: !!act(), eff: +M.stationEff('coolant').toFixed(3), log: /hears you out/.test(logs()) };
      // unwell -> rests (no injury record)
      prime(3, 2); G.prog.inc.lastMed = -1e12; { let n = 0; roll(() => n++ ? 0.9 : 0); } const a2 = act(); out.unwell = { inc: a2 && a2.inc, act: N.choose ? N.choose(r) : 'n/a', injured: (G.prog.med.inj || []).some(x => x.id === id), unwellH: +((r.unwell - G.ship.elapsed) / 3600).toFixed(1) };
      // expire path: argument left alone -> Hale breaks it up
      prime(3, 2); G.prog.inc.lastMed = -1e12; roll(0.1); const a3 = act(); L.node = null; L.mode = 'idle'; a3.t = 0.01; O.tickJobs(0.5); out.argExpire = { inc: a3.inc, other: !!a3.other, gone: !act(), log: /Hale wades in/.test(logs()) };
      // majors: breakdown / insub / misset (never crit)
      const maj = v => { prime(); G.prog.inc.lastMaj = G.prog.inc.lastMed = -1e12; for (const k in G.ship.faults) delete G.ship.faults[k]; let n = 0; roll(t => (n++ === 0 ? 0 : v)); return act(); };
      const b = maj(0.3); out.breakdown = { inc: b && b.inc, offH: +((r.unwell - G.ship.elapsed) / 3600).toFixed(1) };
      L.deck = b.deck; L.node = b.node; L.mode = 'use'; b.acc = b.need; O.tickJobs(0.5); out.breakdown.halvedH = +((r.unwell - G.ship.elapsed) / 3600).toFixed(1);
      const op0 = P.opinionOf ? P.opinionOf(id) : 0; const s1 = maj(0.8); out.insub = { inc: s1 && s1.inc, opDrop: +((P.opinionOf ? P.opinionOf(id) : 0) - op0).toFixed(1) };
      const sevs = []; for (let i = 0; i < 25; i++) { const x = maj(0.05); if (x && x.inc === 'misset') sevs.push(Object.values(G.ship.faults).map(f => f.sev).join('')); }
      out.misset = { n: sevs.length, sevs: [...new Set(sevs)], crit: sevs.some(s => s.includes('crit')) };
      for (const k in G.ship.faults) delete G.ship.faults[k]; G.prog.jobs.active = null;
      // harden
      const junk = { inc: { lastMed: 'x', lastMaj: NaN, n: null } }; I.hardenInc(junk); out.harden = JSON.stringify(junk.inc);
      // 10-day cap sim: every crewmember Breaking, stress 6 h, roll each ship minute with random luck; clear the Lt slot after each
      G.prog.inc.lastMed = G.prog.inc.lastMaj = -1e12; const n0 = { ...G.prog.inc.n }, t0 = G.ship.elapsed, ids = Object.values(C.slots).filter(Boolean);
      for (let s = 0; s < 10 * 57600; s += 60) { G.ship.elapsed = t0 + s; G.prog.jobs.active = null; for (const k in G.ship.faults) delete G.ship.faults[k];
        for (const x of ids) { const q = N.needsOf(x); q.band = 4; q.stress = 6; delete q.unwell; delete q.refuse; I.rollIncident(x, q, 60 / 3600); } }
      G.ship.elapsed = t0; out.sim10 = { medium: G.prog.inc.n.medium - n0.medium, major: G.prog.inc.n.major - n0.major };
      // ---- P29 fixes ----
      { const q = {}; const lg0 = () => logs();
        // #1 pronouns + #2 responder: Orvin (doctor, they) reports unwell -> another officer signs them off, 'their quarters'
        const doc = C.slots['doctor'], rd = N.needsOf(doc); delete rd.unwell; G.prog.jobs.active = null; G.prog.inc.lastMed = -1e12;
        for (const k of N.NEED_KEYS) rd.n[k] = 20; rd.n.food = 60; rd.band = 3; rd.stress = 2; { let n = 0; withR(() => n++ ? 0.9 : 0, () => I.rollIncident(doc, rd, 1)); }
        const txt = logs(); q.unwellDoc = { inc: act() && act().inc, selfResp: (txt.match(/Orvin reports to sickbay 'unwell'\. ([^ ]+)/) || [])[1], theirQuarters: /their quarters/.test(txt) };
        // Seo (she) refuse -> 'Her station', 'reduced effort'
        prime(3, 2); G.prog.inc.lastMed = -1e12; { let n = 0; roll(() => n++ ? 0.5 : 0); } q.refuseText = /Her station runs at reduced effort \(70%\)/.test(logs());
        // #3 argument: both walk to the bar (act fun)
        prime(3, 2); G.prog.inc.lastMed = -1e12; roll(0.1); const ag = act(); q.argue = { inc: ag && ag.inc, acts: [N.choose(N.needsOf(ag.who)), N.choose(N.needsOf(ag.other))] };
        // #4 freeze while idle / offline
        const t0 = ag.t; PC.PACE_RT.idleT = 1e6; O.tickJobs(30); PC.PACE_RT.offline = true; O.tickJobs(30); PC.PACE_RT.offline = false; PC.PACE_RT.idleT = 0;
        q.freeze = { kept: act() === ag, t: [t0, ag.t] }; O.tickJobs(1); q.freeze.resumed = +(t0 - ag.t).toFixed(2);
        // #6 an incident replaces an odd job: walk cancelled, logged
        G.prog.jobs.active = { kind: 'console', node: 'shield', deck: 'engineering', label: 'Recalibrate the shield emitters', t: 100, dur: 100, need: 10, acc: 0, xp: 17, id: 99 };
        L.intent = { kind: 'use', node: 'shield' }; L.mode = 'walk'; prime(3, 2); G.prog.jobs.active = { kind: 'console', node: 'shield', deck: 'engineering', label: 'Recalibrate the shield emitters', t: 100, dur: 100, need: 10, acc: 0, xp: 17, id: 99 }; G.prog.inc.lastMed = -1e12;
        { let n = 0; roll(() => n++ ? 0.5 : 0); } q.replace = { inc: act() && act().inc, intent: L.intent, mode: L.mode, log: /Odd job dropped/.test(logs()) };
        // #7 junk harden
        const sid = C.slots['ops'], jk = { crew: G.prog.crew, inc: { lastMed: G.ship.elapsed + 1e7, lastMaj: 5e15, n: { medium: -4, major: 2.7, helped: 'x' } }, jobs: { active: { kind: 'incident', inc: 'refuse', who: 'nobody', node: 'core', t: 5, dur: 5, need: 5, acc: 0 } } };
        I.hardenInc(jk); q.harden = { lastMedOk: jk.inc.lastMed <= G.ship.elapsed, lastMajOk: jk.inc.lastMaj <= G.ship.elapsed, n: jk.inc.n, dropUnknownCrew: jk.jobs.active === null };
        const jk2 = { crew: G.prog.crew, inc: {}, jobs: { active: { kind: 'incident', inc: 'refuse', who: sid, node: 'nowhere', t: 5, dur: 5, need: 5, acc: 0 } } }; I.hardenInc(jk2); q.harden.dropUnknownSpot = jk2.jobs.active === null;
        const jk3 = { crew: G.prog.crew, inc: {}, jobs: { active: { kind: 'incident', inc: 'refuse', who: sid, node: 'core', t: 1e9, dur: 1e9, need: -3, acc: 99 } } }; I.hardenInc(jk3); const a3 = jk3.jobs.active; q.harden.clampTimers = a3 && [a3.t, a3.dur, a3.need, a3.acc];
        // #9 unwell share
        G.prog.jobs.active = null; const r2 = N.needsOf(id); delete r2.refuse; delete r2.unwell; const ea = M.stationEff('coolant'); r2.unwell = G.ship.elapsed + 3600; const eb = M.stationEff('coolant'); delete r2.unwell; q.unwellEff = [+ea.toFixed(3), +eb.toFixed(3)];
        out.p29 = q; }
      return out; });
    await c.close();
  }
  await br.close();
  console.log(JSON.stringify(res, null, 1)); console.log('errors:', errs.length, errs.slice(0, 5));
})();
