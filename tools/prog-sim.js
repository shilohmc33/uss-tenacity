// Progression pacing sim (phase 1): runs the REAL game sim headless (stepSim live, catchUp offline) and reports
// against the design memo's targets (playtest/2026-10-17-design-progression.md):
//   A) per-mode rates: XP / rep / parts per hour for ACTIVE play, AUTO (app open, hands off) and OFFLINE (2 h / 3.5 h / 8 h)
//   B) session 1 (levels at 10/15/20/25/30/45/60 min)
//   C) regular player (2 x 20 min sessions + 2 offline stretches a day) and casual (1 x 15 min a day) over 30 days
//   D) quality tier distribution by level (analytic odds + observed)
// NODE_PATH=/workspace/pwtools/node_modules node tools/prog-sim.js [base] [runs]
const { chromium } = require('playwright-core');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const RUNS = +(process.argv[3] || 3);
const DAYS_N = +(process.argv[4] || 120);   // horizon in real days (no guarantee after Lt, so run long)
const QUICK = /^quick/.test(process.argv[5] || ''), QMODES = process.argv[5] === 'quick+modes';   // session 1 + regular only (tuning loops)
const DEATHS = process.argv[5] === 'deaths'; // phase 6: regular + casual only, then the injury / death tables and safeguard assertions
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '?reset=1');
  await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 30000 });
  if (DEATHS) await p.evaluate(() => { __T.PROG.deaths.enabled = true; });   // phase 6 is WIP: off by default
  await p.evaluate(async () => {
    window.__noSave = true; __T.app.paused = true;
    const St = await import('/js/state.js'), sim = await import('/js/sim.js'), P = await import('/js/pacing.js'), PR = await import('/js/progression.js'), CL = await import('/js/crewlife.js'), AM = await import('/js/npc-ambient.js'), CB = await import('/js/cabin.js'), CD = await import('/js/cabin-data.js'), BD = await import('/js/boards.js');
    const G = St.G;
    const snapT = tag => ({ tag, level: G.prog.level, totalXp: G.prog.totalXp, manual: G.prog.xpManual, auto: G.prog.xpAuto, offline: G.prog.xpOffline, day: G.prog.day, rep: G.sp.rep, parts: G.ship.parts, cap: G.ship.partsCap, q: { ...G.prog.quality }, rank: G.prog.rank, readiness: PR.computeReadiness(), rp: { ...G.prog.readyParts }, social: PR.socialPoints(), ops: Object.fromEntries(PR.crewList().map(c => [c.id, Math.round(PR.opinionOf(c.id))])), opAll: (() => { const v = PR.crewList().map(c => PR.opinionOf(c.id)); return Math.round(v.reduce((a, b) => a + b, 0) / v.length); })(), opTop: (() => { const v = PR.crewList().map(c => Math.max(0, PR.opinionOf(c.id))).sort((a, b) => b - a).slice(0, 6); return Math.round(v.reduce((a, b) => a + b, 0) / 6); })(),
      fr: G.prog.fleetRep, alumni: G.prog.alumni.length, cn: { ...G.prog.crew.rolls.n }, perk: (() => { const k = CL.perkState(); return { qm: k.quartermaster ? 1 : 0, gw: k.goodword }; })(), sunk: { ...G.prog.sinks.spent }, sinkN: { ...G.prog.sinks.n }, torps: G.ship.torps, lifetime: Math.round(G.prog.repLifetime), spent: window.__spent || 0, capHits: window.__capHits || 0, ev: { ...G.prog.repEv }, starts: window.__starts || 0,
      rr: G.prog.rations, rrLife: G.prog.rationsLife, rrSpent: G.prog.sinks.spent.rations || 0, rrBy: { ...G.prog.rationsBy }, owned: G.prog.cabin.owned.length, comp: Math.round(CB.completion() * 100), tier: G.prog.cabin.tier, placed: Object.keys(G.prog.cabin.placed).length, nslots: CB.slots().length, comfort: Math.round(CB.totals().comfort * 100), rests: { ...(window.__rests || {}) }, decorRep: window.__decorRep || 0, dinners: G.prog.cabin.dinners || 0, startParts: (window.__startParts || []).slice(),
      med: { ...G.prog.med.n }, rank: G.prog.rank, pd: G.prog.playDays, audit: G.prog.med.audit.slice(), injAll: (window.__injAll || []).length, lastRepBuy: window.__lastRepBuy || 0, cadets: G.prog.fav.fx.cadets || 0, repLeft: CD.DECOR_ITEMS.filter(d => d.cost && d.cost.rep && !CB.owned(d.id)).length,
      repT: Math.round(window.__repT || 0), lrep: window.__liveRep || 0, spec: { ...G.prog.spec }, bySys: { ...(G.prog.repBySys || {}) }, boards: G.prog.boardLog.length,
      nextGoal: (() => { const u = CD.DECOR_ITEMS.filter(d => d.cost && !CB.owned(d.id)); const open = u.filter(d => CB.gateState(d).ok); return { open: open.length, gated: u.length - open.length, maxOpen: open.reduce((m, d) => Math.max(m, d.cost.rations || 0), 0), maxOpenRep: open.reduce((m, d) => Math.max(m, d.cost.rep || 0), 0) }; })() });
    // a typical ACTIVE player: reacts to faults after ~20 s, does ~60% of deck tasks, rotates stations every 2-3 min,
    // rests below 25% energy, tops up parts when low. Everything they order is MANUAL (crew.playerOrder).
    function live(seconds, opts = {}) {
      const S = G.ship, L = G.lt, order = fn => __T.playerOrder(fn);
      const st = window.__ps || (window.__ps = { react: {}, nextSwap: 0, ri: 0, taskTry: new Set(), resting: false });
      const rota = ['core', 'torpbay', 'shield', 'locker', 'msd', 'chair'];
      st.nextSwap = 0;   // per-call clock
      let t = 0; const marks = opts.marks || [], out = opts.out || [];
      while (t < seconds) {
        if (!opts.handsOff) {
          P.playerInput();
          const busy = L.mode === 'repair' || L.lift || (L.mode === 'walk' && L.intent && L.intent.kind !== 'walk');
          const rank = { crit: 0, med: 1, low: 2 };
          let fk = Object.keys(S.faults).sort((a, b) => rank[S.faults[a].sev] - rank[S.faults[b].sev])[0];
          // phase 6: a serious injury's system — most players see the sickbay warning and go (regular 80%, casual 70%);
          // those who don't sometimes visit the patient instead (40%)
          const W = G.prog.med.inj.find(x => x.state === 'warning' && S.faults[x.sys]);
          if (W) { const key = W.id + '@' + W.at, A = st.att || (st.att = {}); if (A[key] === undefined) A[key] = Math.random() < (window.__kind === 'casual' ? 0.7 : 0.8) ? 'fix' : Math.random() < 0.4 ? 'visit' : 'none';
            if (A[key] === 'fix') fk = W.sys;
            else { fk = Object.keys(S.faults).filter(k => k !== W.sys).sort((a, b) => rank[S.faults[a].sev] - rank[S.faults[b].sev])[0]; }   // ignoring the warning: works other faults, leaves that one
            if (A[key] === 'fix') {} else if (A[key] === 'visit' && !W.visited && !busy && !st.resting && L.deck !== 'medical') { A[key] = 'visited'; order(() => __T.sendUse('biobed', { force: true })); } }
          const task = G.sp.ev.active && G.sp.ev.active.task;
          const OJ = G.prog.jobs && G.prog.jobs.active;
          if (st.resting && S.energy >= 80) st.resting = false;
          if (!busy && !st.resting) {
            if (S.energy < 25) { st.resting = true; const rr2 = Math.random(), spot = rr2 < 0.5 ? 'rack' : rr2 < 0.65 ? 'bunk' : rr2 < 0.85 ? 'mess' : 'biobed'; const R = window.__rests || (window.__rests = {}); R[spot] = (R[spot] || 0) + 1; order(() => __T.sendUse(spot, { force: true })); }   // phase 4: half the rests in his own quarters
            else if (fk) { st.react[fk] = (st.react[fk] || 0) + 0.1; if (st.react[fk] > 20) { if (S.parts >= S.faults[fk].cost) { order(() => __T.sendRepair(fk)); delete st.react[fk]; } else order(() => __T.sendUse('locker', { force: true })); } }
            else if (task && !st.taskTry.has(task.label)) { st.taskTry.add(task.label); if (Math.random() < 0.6) order(() => __T.sendUse(task.node, { force: true })); }
            // pt04: odd jobs between repairs: an engaged player takes most of them (regular 85%, casual 75%) after a short look
            else if (OJ && OJ.id !== st.jobId && (st.jobSeen = (st.jobId0 === OJ.id ? st.jobSeen + 0.1 : (st.jobId0 = OJ.id, 0))) > 4) { st.jobId = OJ.id; if (Math.random() < (window.__kind === 'casual' ? 0.75 : 0.85)) order(() => __T.sendUse(OJ.node, { force: true })); }
            else if (OJ && L.mode === 'use' && L.node === OJ.node) { /* working the odd job */ }
            else if (t >= st.nextSwap) { order(() => __T.sendUse(S.parts < 4 ? 'locker' : rota[st.ri++ % rota.length], { force: true })); st.nextSwap = t + 120 + Math.random() * 60; }
          }
        }
        if (!opts.handsOff) window.__present();
        if (L.mode === 'repair') window.__repT = (window.__repT || 0) + 0.1;
        const r0 = G.stats.repairs || 0;
        sim.stepSim(0.1); AM.tickAmbient(0.1); t += 0.1;
        window.__liveRep = (window.__liveRep || 0) + (G.stats.repairs || 0) - r0;   // roster NPCs on the Lt's deck come over for chats / intros
        for (const m of marks) if (!m.done && t >= m.at) { m.done = true; out.push(snapT(m.tag)); }
      }
    }
    // phase 3 spending policy of an engaged player (session start): favours when affordable with a reserve, parts sinks
    // whenever the locker is near full. Rep spent is tracked in G.prog.sinks.spent.
    window.__sinks = () => {
      const S = G.ship, rep0 = () => G.sp.rep, fs = id => CL.favourState(id).ok;
      const tryF = (id, reserve) => { if (fs(id) && rep0() >= (PR.PROG.favours.find(f => f.id === id).cost.rep || 0) + reserve) { const r0 = rep0(); if (CL.callFavour(id)) window.__spent += r0 - rep0(); } };
      // follow-up: a decor-first collector — while a rep prestige piece is open to buy, the discretionary favours wait
      // until its price (+300) is in the bank, so the piece gets bought first; essentials (letter, round, low ammo/parts) don't wait.
      const goalItem = CD.DECOR_ITEMS.filter(d => d.cost && d.cost.rep && !CB.owned(d.id) && CB.gateState(d).ok).sort((a, b) => a.cost.rep - b.cost.rep)[0];
      const goal = goalItem ? goalItem.cost.rep + 300 : 0;
      tryF('letter', 0); tryF('round', 40); tryF('dcteam', 80 + goal); tryF('calibration', 120 + goal); tryF('intel', 150 + goal);
      if (S.torps <= 4) tryF('ordnance', 100);
      if (S.parts < 8) tryF('shipment', 60);
      tryF('dock', 200 + goal); tryF('loaner', 200 + goal);
      for (let k = 0; k < 4 && S.parts >= S.partsCap - 3; k++) {
        if (G.prog.requests.length) CL.fixKit(G.prog.requests[0].id);
        else if (CL.casingOk()) CL.buildCasing();
        else if (CL.overhaulState().ok) CL.doOverhaul();
        else break;
      }
      // phase 4: trade surplus spares down to ~60% of the locker, then decorate
      for (let k = 0; k < 20 && S.parts > Math.ceil(S.partsCap * 0.6) && CB.tradeOk(); k++) CB.tradeParts(true);
      window.__decor();
      tryF('cadet', CD.DECOR_ITEMS.some(d => d.cost && d.cost.rep && !CB.owned(d.id)) ? 2500 : 300);   // follow-up: repeatable rep sink once the decor savings are covered
    };
    // phase 4 decorating policy: fill empty slots with the cheapest affordable fitting item (rations); once a slot type
    // is full, keep collecting (storage / swap in if it has a bigger bonus) when rations >= cost + 200; prestige rep
    // pieces when rep >= cost + 300 after favours.
    const bonusOf = d => (d.bonus.comfort || 0) * 100 + (d.bonus.social || 0) * 150 + (d.bonus.readiness || 0) * 6;
    window.__decor = () => {
      for (let k = 0; k < 6; k++) {
        const cands = CD.DECOR_ITEMS.filter(d => d.cost && !CB.owned(d.id) && CB.gateState(d).ok && PR.canAfford(d.cost) && CB.slotsFor(d.slot).length);
        const free = cands.filter(d => CB.slotsFor(d.slot).some(s => !G.prog.cabin.placed[s.id]) && (d.cost.rations ? true : G.sp.rep >= d.cost.rep + 300)).sort((a, b) => (a.cost.rations || a.cost.rep / 3) - (b.cost.rations || b.cost.rep / 3));
        let d = free[0], slot = d && CB.slotsFor(d.slot).find(s => !G.prog.cabin.placed[s.id]);
        if (!d) {
          d = cands.filter(x => x.cost.rations ? G.prog.rations >= x.cost.rations + 200 : G.sp.rep >= x.cost.rep + 300).sort((a, b) => (a.cost.rations || a.cost.rep / 3) - (b.cost.rations || b.cost.rep / 3))[0];
          if (!d) break;
          const worst = CB.slotsFor(d.slot).map(s => ({ s, b: bonusOf(CD.DECOR[G.prog.cabin.placed[s.id]]) })).sort((a, b) => a.b - b.b)[0];
          slot = worst && worst.b < bonusOf(d) ? worst.s : null;
        }
        const r0 = G.sp.rep;
        if (!CB.buyItem(d.id, slot ? slot.id : null)) break;
        if (d.cost.rep) { window.__decorRep = (window.__decorRep || 0) + (r0 - G.sp.rep); window.__lastRepBuy = G.prog.playDays; }
      }
      if (G.prog.rations >= PR.PROG.cabin.dinner.cost.rations + 300 && CB.dinnerState().ok) CB.hostDinner();
      // place anything sitting in storage that fits a free slot (after a promotion)
      for (const id of CB.storage()) { const d = CD.DECOR[id], s = CB.slotsFor(d.slot).find(x => !G.prog.cabin.placed[x.id]); if (s) CB.placeItem(id, s.id); }
    };
    // phase 5: a present player faces a waiting board straight away and makes a waiting spec pick by policy
    // (first focus at random, then upgrade it, then a second focus at random)
    window.__present = () => {
      if (BD.boardWaiting()) BD.resolveBoard();
      while (BD.specPending()) {
        const sp = G.prog.spec, ids = Object.keys(PR.PROG.specs.focus), own = Object.keys(sp);
        const id = !own.length ? ids[Math.floor(Math.random() * ids.length)] : own.find(i => sp[i] < PR.PROG.specs.maxTier) || ids.filter(i => !sp[i])[Math.floor(Math.random() * ids.filter(i => !sp[i]).length)];
        if (!id || !BD.pickSpec(id)) break;
      }
    };
    PR.hooks.crewInjured.push(inj => (window.__injAll = window.__injAll || []).push({ cause: inj.cause, sev: inj.sev, pd: inj.pd, offline: inj.offline }));
    function newSession() { P.PACE_RT.sessionT = 0; P.PACE_RT.idleT = 0; }
    function fresh() { St.resetState(); window.__ps = null; newSession(); }
    const rate = (a, b, h) => ({ xp: +((b.totalXp - a.totalXp) / h).toFixed(0), xpMin: +((b.totalXp - a.totalXp) / h / 60).toFixed(2), rep: +((b.rep - a.rep) / h).toFixed(1), parts: +((b.parts - a.parts) / h).toFixed(1) });
    window.__sim = {
      // A) per-mode rates, measured from a mid-game state (level ~8, after 2 days of regular play) so session-1
      // milestones / rested bonus don't inflate them; parts measured with the locker refilled to 6 first.
      modes() {
        fresh(); window.__sim.regular(2, []);
        const res = {};
        const measure = (name, fn, h) => { G.ship.parts = 6; newSession(); P.PACE_RT.sessionT = 1e4; const a = snapT(); fn(); res[name] = rate(a, snapT(), h); };
        measure('active, 60 min (no rested bonus)', () => live(3600), 1);
        measure('active, a 20-min session (rested x1.25 for 15 min)', () => { P.PACE_RT.sessionT = 0; live(1200); }, 1200 / 3600);
        measure('auto: app open, hands off (60 min)', () => live(3600, { handsOff: true }), 1);
        for (const h of [2, 3.5, 8]) measure(`offline ${h} h`, () => sim.catchUp(h * 3600), h);
        return res;
      },
      session1() {
        fresh(); const out = [];
        live(3600, { out, marks: [5, 10, 15, 20, 30, 60].map(m => ({ at: m * 60, tag: `${m} min` })) });
        return out;
      },
      // regular: sessions 08:00 and 19:00 (20 min; day 1 morning = a 30-min first session), offline in between.
      // casual: one 15-min session at 19:00. Catch-up is capped at 8 h per gap (PACE.offlineMaxSim).
      regular(days, out, kind = 'regular', buy = true) {
        window.__kind = kind; window.__injAll = [];
        window.__lastRepBuy = 0; window.__repT = 0; window.__liveRep = 0; window.__spent = 0; window.__capHits = 0; window.__starts = 0; window.__rests = {}; window.__decorRep = 0; window.__startParts = [];
        if (!buy) G.prog.sinks.maintainOn = false;   // the no-spend baseline also turns the standing order off
        const atStart = () => { window.__starts++; (window.__startParts = window.__startParts || []).push([G.ship.parts, G.ship.partsCap, G.sp.location || 'warp', G.prog.sinks.trade ? G.prog.sinks.trade.parts : 0]); if (G.ship.parts >= G.ship.partsCap) window.__capHits++; };
        const plan = kind === 'regular' ? [{ at: 8, len: 20 }, { at: 19, len: 20 }] : [{ at: 19, len: 15 }];
        let clock = null;
        for (let d = 1; d <= days; d++) {
          for (let si = 0; si < plan.length; si++) {
            const startH = (d - 1) * 24 + plan[si].at;
            if (clock !== null) sim.catchUp((startH - clock) * 3600);
            newSession(); PR.markPlayDay(new Date(Date.UTC(2026, 0, d, 12)));   // a real calendar day with play
            atStart(); window.__present();
            const o = PR.lockerOffer(); if (buy && o && G.sp.rep >= o.rep + 30) { window.__spent += o.rep; PR.buyLocker(); }   // the player buys the requisition once affordable (+30 reserve)
            if (buy) window.__sinks();
            const len = (d === 1 && si === 0) ? Math.max(plan[si].len, 30) : plan[si].len;
            live(len * 60); clock = startH + len / 60;
          }
          const endH = d * 24 + plan[0].at;   // "after day d" = the next morning, before the first session
          sim.catchUp((endH - clock) * 3600); clock = endH;
          if (out) out.push(snapT(`day ${d}`));
        }
        return out;
      },
    };
  });
  // ---- run ----
  const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const fmt = v => RUNS > 1 ? `${med(v)} [${Math.min(...v)}-${Math.max(...v)}]` : `${v[0]}`;
  const modeRuns = [], s1Runs = [], regRuns = [], casRuns = [], noBuyRuns = [], specOffRuns = [], qPool = {};
  for (let r = 0; r < RUNS; r++) {
    if ((!QUICK || QMODES) && !DEATHS) modeRuns.push(await p.evaluate(() => __sim.modes()));
    if (!DEATHS) s1Runs.push(await p.evaluate(() => __sim.session1()));
    regRuns.push(await p.evaluate(async D => { const St = await import('/js/state.js'); St.resetState(); window.__ps = null; const o = __sim.regular(D, []); return { o, q: St.G.prog.qByLevel, hist: St.G.prog.history, boards: St.G.prog.boardLog.slice() }; }, DAYS_N));
    if (!QUICK || DEATHS) casRuns.push(await p.evaluate(async D => { const St = await import('/js/state.js'); St.resetState(); window.__ps = null; const o = __sim.regular(D, [], 'casual'); return { o, hist: St.G.prog.history, boards: St.G.prog.boardLog.slice() }; }, DAYS_N));
    if (!QUICK && !DEATHS) noBuyRuns.push(await p.evaluate(async () => { const St = await import('/js/state.js'); St.resetState(); window.__ps = null; const o = __sim.regular(60, [], 'regular', false); return { o }; }));
    if (!QUICK && !DEATHS) specOffRuns.push(await p.evaluate(async () => { const St = await import('/js/state.js'), PR = await import('/js/progression.js'); const keep = PR.PROG.specs.picks; PR.PROG.specs.picks = []; St.resetState(); window.__ps = null; const o = __sim.regular(60, []); PR.PROG.specs.picks = keep; return { o }; }));
    for (const [L, a] of Object.entries(regRuns[r].q)) { qPool[L] = qPool[L] || [0, 0, 0, 0]; a.forEach((v, i) => qPool[L][i] += v); }
  }
  // ---- phase 6: injuries, deaths, safeguards ----
  const K6 = await p.evaluate(() => __T.PROG.deaths);
  const q3 = v => { const s = [...v].sort((a, b) => a - b), q = f => s[Math.min(s.length - 1, Math.floor(f * s.length))]; return `${q(0.1)}/${q(0.5)}/${q(0.9)}`; };
  const medT = (title, runs) => {
    console.log(`\n${title}\n| month | injuries (minor / serious) | serious saved in the window | pulled through | hospital (favourite) / evac (gentle) | deaths | recovered (discharged) |\n|---|---|---|---|---|---|---|`);
    const at = (r, d) => (r.o.find(o => o.tag === `day ${d}`) || { med: {} }).med;
    const dm = (r, k, a, b) => (at(r, b)[k] || 0) - (a <= 1 ? 0 : (at(r, a)[k] || 0));
    for (const [a, b] of [[1, 30], [30, 60], [60, 90], [90, 120]].filter(([, b]) => b <= DAYS_N)) console.log(`| days ${a}-${b} | ${fmt(runs.map(r => dm(r, 'injuries', a, b)))} (${med(runs.map(r => dm(r, 'minor', a, b)))} / ${med(runs.map(r => dm(r, 'serious', a, b)))}) | ${fmt(runs.map(r => dm(r, 'saved', a, b)))} | ${fmt(runs.map(r => dm(r, 'pulled', a, b)))} | ${med(runs.map(r => dm(r, 'hospital', a, b)))} / ${med(runs.map(r => dm(r, 'evac', a, b)))} | ${fmt(runs.map(r => dm(r, 'deaths', a, b)))} | ${fmt(runs.map(r => dm(r, 'recovered', a, b)))} |`);
    const last = runs.map(x => x.o[x.o.length - 1]), tot = k => last.reduce((s, r) => s + (r.med[k] || 0), 0);
    const inj = tot('injuries'), lost = tot('deaths'), away = tot('hospital') + tot('evac');
    const ltDay = runs.map(x => { const h = x.hist.find(h => h.rank === 'lt'); return h ? h.playDays : 999; });
    const firstDeath = runs.map(x => (x.o.find(o => (o.med.deaths || 0) > 0) || { tag: 'day -' }).tag.split(' ')[1]);
    console.log(`  per 30 days: ${(inj / runs.length / (DAYS_N / 30)).toFixed(1)} injuries (${(tot('serious') / runs.length / (DAYS_N / 30)).toFixed(1)} serious) · recovery rate ${Math.round((inj - lost - away) / Math.max(1, inj) * 100)}% stayed aboard and recovered, ${Math.round(away / Math.max(1, inj) * 100)}% transferred for care, ${(lost / Math.max(1, inj) * 100).toFixed(1)}% died · serious saved by a fix in the window ${Math.round(tot('saved') / Math.max(1, tot('serious')) * 100)}% · injuries while offline ${tot('offlineInj')}`);
    console.log(`  deaths per ${DAYS_N} days p10/p50/p90: ${q3(last.map(r => r.med.deaths || 0))} (per run: ${last.map(r => r.med.deaths || 0).join(', ')}) · first possible death: play day ${med(ltDay.map(d => Math.max(K6.noDeathsBefore, d)))} (day ${K6.noDeathsBefore} or reaching Lt, whichever is later) · first actual death: day ${firstDeath.join(', ')}`);
  };
  const assertT = (title, runs) => {
    const A = runs.flatMap(x => x.o[x.o.length - 1].audit), v = { early: 0, rank: 0, senior: 0, favourite: 0, gap: 0, caps: 0, unseen: 0, offlineUnseen: 0, cause: 0, window: 0, gentle: 0 };
    for (const d of A) { if (d.pd < K6.noDeathsBefore) v.early++; if (d.rank < K6.minRank) v.rank++; if (d.senior) v.senior++; if (d.fav) v.favourite++; if (d.gap != null && d.gap < K6.gap) v.gap++; if (!d.caps) v.caps++; if (!d.seen) v.unseen++; if (d.offline && d.seenT < K6.offlineMinSeen) v.offlineUnseen++; if (!['battle', 'hazard'].includes(d.cause)) v.cause++; if (d.window < K6.window - 1) v.window++; if (d.gentle) v.gentle++; }
    const injC = runs.reduce((s, x) => s + x.o[x.o.length - 1].injAll, 0), bad = Object.values(v).reduce((a, b) => a + b, 0);
    const minGap = A.filter(d => d.gap != null).map(d => d.gap);
    console.log(`${title}: ${A.length} deaths audited, ${injC} injuries (all from battle hits / hazards — the daily roll has no injury path) · violations ${JSON.stringify(v)} → ${bad === 0 ? 'PASS' : 'FAIL'} · min gap between deaths ${minGap.length ? Math.min(...minGap) : '—'} days of play · offline deaths ${A.filter(d => d.offline).length} (all seen live ≥ ${K6.offlineMinSeen} s first)`);
    return bad;
  };
  if (DEATHS) {
    console.log(`runs: ${RUNS} × ${DAYS_N} days  (median [min-max])`);
    medT('P6-1) Injuries and deaths — regular (2 × 20 min a day)', regRuns);
    medT('P6-2) Injuries and deaths — casual (1 × 15 min a day)', casRuns);
    console.log('\nP6-3) Safeguard assertions (every death checked against the memo rules)');
    const bad = assertT('  regular', regRuns) + assertT('  casual', casRuns);
    console.log(`\nASSERTIONS ${bad === 0 ? 'PASS' : 'FAIL'}`);
    console.log('\nerrors', JSON.stringify(errs));
    await b.close(); return;
  }
  console.log(`runs: ${RUNS}  (median [min-max])\n\nA) Per-mode rates (memo: active ~15 XP/min, auto ~6, offline 1/min first 2 h then 0.25; ~210 per 8 h)`);
  console.log('| mode | XP/h | XP/min | rep/h | parts/h |\n|---|---|---|---|---|');
  if (modeRuns.length) for (const k of Object.keys(modeRuns[0])) { const g = f => fmt(modeRuns.map(m => m[k][f])); console.log(`| ${k} | ${g('xp')} | ${g('xpMin')} | ${g('rep')} | ${g('parts')} |`); }
  const table = (title, runs) => {
    console.log(`\n${title}\n| point | level | total XP | manual | auto | offline | active share | ship's day | rep | parts |\n|---|---|---|---|---|---|---|---|---|---|`);
    for (const tag of runs[0].map(o => o.tag)) {
      const rows = runs.map(rr => rr.find(o => o.tag === tag)); const g = k => fmt(rows.map(x => x[k]));
      console.log(`| ${tag} | ${g('level')} | ${g('totalXp')} | ${med(rows.map(x => x.manual))} | ${med(rows.map(x => x.auto))} | ${med(rows.map(x => x.offline))} | ${med(rows.map(x => Math.round(x.manual / Math.max(1, x.totalXp) * 100)))}% | ${med(rows.map(x => x.day))} | ${med(rows.map(x => x.rep))} | ${med(rows.map(x => x.parts))} |`);
    }
  };
  if (s1Runs.length) table('B) Session 1 (memo: L4 by 15 min, L5 by ~25 min; rep +20-30 in 20 min; parts >= 6 at the end)', s1Runs);
  const DAYS = [1, 2, 3, 4, 5, 7, 11, 14, 21, 30, 45, 60, 90, 120];
  const pickDays = rr => rr.filter(o => DAYS.includes(+o.tag.split(' ')[1]));
  table('C1) Regular player: 2 x 20 min/day + 2 offline stretches (memo: ~1,100 XP/day; L8 day 2, L15 day 7, L18 day 11-12, L27-28 day 30-35)', regRuns.map(x => pickDays(x.o)));
  if (casRuns.length) table('C2) Casual player: 1 x 15 min/day (memo: ~500-550 XP/day; L11-12 at day 7, L19-20 at day 30)', casRuns.map(x => pickDays(x.o)));
  // ---- phase 2 tables ----
  const RK = ['Lt jg', 'Lt', 'Lt Cmdr', 'Cmdr'];
  const p2 = (title, runs) => {
    console.log(`\n${title}\n| real day | rank | readiness | perf/social/rep/service/bonus | social pts | T'Ren | Okafor | Diallo | Hale | Thelev | top-6 avg | all aboard avg | rep balance (spent) | lifetime rep | parts/cap |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`);
    for (const d of DAYS) {
      const rows = runs.map(x => x.o.find(o => o.tag === `day ${d}`)).filter(Boolean); if (!rows.length) continue;
      const m = f => med(rows.map(f));
      console.log(`| ${d} | ${RK[m(r => r.rank)]} | ${fmt(rows.map(r => r.readiness))} | ${m(r => r.rp.perf)}/${m(r => r.rp.social)}/${m(r => r.rp.rep)}/${m(r => r.rp.service)}/${m(r => r.rp.bonus || 0)} | ${m(r => r.social)} | ${m(r => r.ops.tren)} | ${m(r => r.ops.okafor)} | ${m(r => r.ops.diallo)} | ${m(r => r.ops.hale)} | ${m(r => r.ops.thelev ?? '—')} | ${m(r => r.opTop)} | ${m(r => r.opAll)} | ${m(r => r.rep)} (${m(r => r.spent)}) | ${m(r => r.lifetime)} | ${m(r => r.parts)}/${m(r => r.cap)} |`);
    }
  };
  p2('E1) Regular player: relationships, readiness, rank, rep sink', regRuns);
  if (casRuns.length) p2('E2) Casual player', casRuns);
  // ---- phase 3 tables ----
  const p3 = (title, runs) => {
    console.log(`\n${title}\n| real day | crew events so far: transfers / promotions / demotions / arrivals | ex-shipmates | Fleet Rep | perks: quartermaster / good word | favours used | rep spent: requisitions+favours | parts sunk | torps |\n|---|---|---|---|---|---|---|---|---|`);
    for (const d of DAYS) {
      const rows = runs.map(x => x.o.find(o => o.tag === `day ${d}`)).filter(Boolean); if (!rows.length) continue;
      const m = f => med(rows.map(f)), fav = r => Object.entries(r.sinkN).filter(([k]) => k.startsWith('favour:')).reduce((a, [, v]) => a + v, 0);
      console.log(`| ${d} | ${m(r => r.cn.transfer || 0)} / ${m(r => r.cn.promotion || 0)} / ${m(r => r.cn.demotion || 0)} / ${m(r => r.cn.arrival || 0)} | ${m(r => r.alumni)} | ${fmt(rows.map(r => r.fr))} | ${m(r => r.perk.qm)} / ${m(r => r.perk.gw)} | ${m(fav)} | ${m(r => r.sunk.rep || 0)} | ${m(r => r.sunk.parts || 0)} | ${m(r => r.torps)} |`);
    }
  };
  p3('I1) Regular player: crew turnover, fleet reputation, perks, sinks (memo month 1: ~5 crew events, 3-5 ex-shipmates, 25-35 Fleet Rep, 4-6 favours unlocked; no deaths)', regRuns);
  if (casRuns.length) p3('I2) Casual player', casRuns);
  const turn = (title, runs) => {
    const per = (r, k, a, b) => { const A = r.o.find(o => o.tag === `day ${a}`), B = r.o.find(o => o.tag === `day ${b}`); return A && B ? ((B.cn[k] || 0) - (a === 0 ? 0 : (A.cn[k] || 0))) : null; };
    const months = [[1, 30], [30, 60], [60, 90], [90, 120]].filter(([, b]) => b <= DAYS_N);
    console.log(`\n${title}\n| month | transfers | promotions | demotions | arrivals | deaths |\n|---|---|---|---|---|---|`);
    months.forEach(([a, b], i) => console.log(`| ${i + 1} (days ${a}-${b}) | ${fmt(runs.map(r => per(r, 'transfer', a, b) + (a === 1 ? (r.o[0].cn.transfer || 0) : 0)))} | ${fmt(runs.map(r => per(r, 'promotion', a, b) + (a === 1 ? (r.o[0].cn.promotion || 0) : 0)))} | ${fmt(runs.map(r => per(r, 'demotion', a, b) + (a === 1 ? (r.o[0].cn.demotion || 0) : 0)))} | ${fmt(runs.map(r => per(r, 'arrival', a, b) + (a === 1 ? (r.o[0].cn.arrival || 0) : 0)))} | ${fmt(runs.map(r => per(r, 'death', a, b) + (a === 1 ? (r.o[0].cn.death || 0) : 0)))} |`));
  };
  turn('J1) Crew turnover per month — regular (memo: ~1.25 events/week after week 2: 0.6 transfers, 0.4 promotions, 0.1 demotions)', regRuns);
  if (casRuns.length) turn('J2) Crew turnover per month — casual', casRuns);
  medT('P6-1) Injuries and deaths — regular', regRuns); if (casRuns.length) medT('P6-2) Injuries and deaths — casual', casRuns);
  console.log('\nP6-3) Safeguard assertions'); assertT('  regular', regRuns); if (casRuns.length) assertT('  casual', casRuns);
  const firstT = runs => runs.map(r => (r.o.find(o => (o.cn.transfer || 0) > 0) || { tag: 'day -' }).tag.split(' ')[1]);
  console.log(`\nFirst transfer off (scripted friendly transfer): regular day ${firstT(regRuns).join(', ')}${casRuns.length ? ` · casual day ${firstT(casRuns).join(', ')}` : ''}`);
  const op95 = runs => runs.map(r => { const hit = r.o.find(o => ['tren', 'okafor', 'diallo', 'hale'].filter(k => (o.ops[k] ?? 0) >= 95).length >= 2); return hit ? +hit.tag.split(' ')[1] : '>' + DAYS_N; });
  console.log(`Opinions maxing out (2 of the 4 seniors at >= 95): regular day ${op95(regRuns).join(', ')}${casRuns.length ? ` · casual day ${op95(casRuns).join(', ')}` : ''} (target ~75-90)`);
  const promo = (title, runs) => {
    console.log(`\n${title}\n| promotion | real day (days of play) | ship's day | level | reason (per run) | memo target |\n|---|---|---|---|---|---|`);
    const tgt = { lt: 'expected day 4-5, guaranteed 7', ltcmdr: 'memo expected 15-18 (no guarantee now)', cmdr: 'memo expected 40-55 (no guarantee now)' };
    for (const id of ['lt', 'ltcmdr', 'cmdr']) {
      const hs = runs.map(x => x.hist.find(h => h.rank === id)).filter(Boolean);
      if (!hs.length) { console.log(`| ${id} | not reached in ${DAYS_N} days | | | | ${tgt[id]} |`); continue; }
      const pd = hs.map(h => h.playDays).sort((a, b) => a - b), q = f => pd[Math.min(pd.length - 1, Math.floor(f * pd.length))];
      console.log(`| ${id} | ${fmt(hs.map(h => h.playDays))} p10/p50/p90 ${q(0.1)}/${q(0.5)}/${q(0.9)} | ${fmt(hs.map(h => h.day))} | ${fmt(hs.map(h => h.level))} | ${Object.entries(hs.reduce((a, h) => (a[h.reason] = (a[h.reason] || 0) + 1, a), {})).map(([k, v]) => k + ' ' + v).join(', ')} (${hs.length}/${runs.length} runs) | ${tgt[id]} |`);
    }
  };
  promo('F1) Promotions — regular', regRuns);
  if (casRuns.length) promo('F2) Promotions — casual', casRuns);
  // ---- phase 5: boards ----
  const boardT = (title, runs) => {
    console.log(`\n${title}\n| board for | boards held (per run) | pass / defer / fail | queued (convened while away) | readiness at board (median) | median p(pass) | forced (Lt guarantee) | boards per promotion |\n|---|---|---|---|---|---|---|---|`);
    for (const id of ['lt', 'ltcmdr', 'cmdr']) {
      const all = runs.flatMap(x => x.boards.filter(b => b.to === id)); if (!all.length) { console.log(`| ${id} | 0 | | | | | | |`); continue; }
      const c = k => all.filter(b => b.outcome === k).length, pc = k => Math.round(c(k) / all.length * 100);
      const passes = c('pass');
      console.log(`| ${id} | ${fmt(runs.map(x => x.boards.filter(b => b.to === id).length))} | ${pc('pass')}% / ${pc('defer')}% / ${pc('fail')}% (n ${all.length}) | ${Math.round(all.filter(b => b.queued).length / all.length * 100)}% | ${med(all.map(b => b.readiness))} | ${med(all.map(b => b.pPass))} | ${all.filter(b => b.forced).length} | ${passes ? (all.length / passes).toFixed(2) : '—'} |`);
    }
    const reasons = runs.flatMap(x => x.boards).reduce((a, b) => (a[b.reason] = (a[b.reason] || 0) + 1, a), {});
    console.log(`  boards by trigger: ${JSON.stringify(reasons)}`);
  };
  boardT('F3) Promotion boards — regular', regRuns);
  if (casRuns.length) boardT('F4) Promotion boards — casual', casRuns);
  // ---- phase 5: specialisations ----
  const specT = (title, runs) => {
    console.log(`\n${title}\n| real day | foci (run 1) | Lt repairs in live sessions | time spent repairing (s) | mean s / repair | excellent share | level |\n|---|---|---|---|---|---|---|`);
    for (const d of [10, 20, 30, 45, 60, 90, 120]) {
      const rows = runs.map(x => x.o.find(o => o.tag === `day ${d}`)).filter(Boolean); if (!rows.length) continue;
      const ex = r => Math.round((r.q.excellent || 0) / Math.max(1, Object.values(r.q).reduce((a, b) => a + b, 0)) * 100);
      console.log(`| ${d} | ${JSON.stringify(rows[0].spec || {})} | ${fmt(rows.map(r => r.lrep))} | ${fmt(rows.map(r => r.repT))} | ${med(rows.map(r => +(r.repT / Math.max(1, r.lrep)).toFixed(2)))} | ${med(rows.map(ex))}% | ${med(rows.map(r => r.level))} |`);
    }
  };
  specT('S1) Specialisations — regular (policy: random first focus, upgrade it, then a second)', regRuns);
  { const last = regRuns.map(x => x.o[x.o.length - 1]), tot = {}; for (const r of last) for (const [k, v] of Object.entries(r.bySys || {})) tot[k] = (tot[k] || 0) + v;
    const n = Object.values(tot).reduce((a, b) => a + b, 0) || 1, K = await p.evaluate(() => __T.PROG.specs);
    console.log(`\nS3) Focus effect on the Lt's repair time, weighted by the observed mix of his repairs (regular, all runs: ${JSON.stringify(Object.fromEntries(Object.entries(tot).map(([k, v]) => [k, Math.round(v / n * 100) + '%'])))})\n| focus | share of Lt repairs | tier I: time saved on its systems / overall | tier II: on its systems / overall |\n|---|---|---|---|`);
    for (const [id, f] of Object.entries(K.focus)) { const sh = f.systems.reduce((a, s) => a + (tot[s] || 0), 0) / n, sv = t => 1 - 1 / (1 + K.tiers[t].speed);
      console.log(`| ${f.name} | ${Math.round(sh * 100)}% | ${Math.round(sv(0) * 100)}% / ${(sv(0) * sh * 100).toFixed(1)}% | ${Math.round(sv(1) * 100)}% / ${(sv(1) * sh * 100).toFixed(1)}% |`); } }
  if (specOffRuns.length) specT('S2) Control: same player with specialisations disabled (60 days)', specOffRuns);
  const capT = (title, runs) => { const last = runs.map(x => x.o[x.o.length - 1]); console.log(`${title}: sessions starting with the locker at cap: ${fmt(last.map(r => Math.round(r.capHits / Math.max(1, r.starts) * 100)))}% of ${med(last.map(r => r.starts))} session starts`); };
  const evT = (title, runs) => { const last = runs.map(x => x.o[x.o.length - 1]); const wk = last[0] ? (runs[0].o.length / 7) : 1;
    console.log(`${title}: ${fmt(last.map(r => +((r.ev.good + r.ev.bad) / wk).toFixed(1)))} events/week (good ${med(last.map(r => +(r.ev.good / wk).toFixed(1)))}, bad ${med(last.map(r => +(r.ev.bad / wk).toFixed(1)))}), net ${fmt(last.map(r => Math.round(r.ev.net / wk)))} rep/week vs ~${med(last.map(r => Math.round(r.lifetime / wk)))} rep/week earned in total`); };
  console.log('\nH) Random reputation events');
  evT('  regular', regRuns); if (casRuns.length) evT('  casual', casRuns);
  console.log('\nG) Parts pinned at the cap (share of session starts where the locker is full)');
  if (noBuyRuns.length) capT('  regular, 60 days, spends NOTHING (no requisitions, favours or parts sinks)', noBuyRuns);
  capT(`  regular, ${DAYS_N} days, engaged spender (requisitions + favours + parts sinks)`, regRuns);
  if (casRuns.length) capT(`  casual, ${DAYS_N} days, engaged spender`, casRuns);
  if (noBuyRuns.length) { const nb = noBuyRuns.map(x => x.o.find(o => o.tag === 'day 60')), sp = regRuns.map(x => x.o.find(o => o.tag === 'day 60')).filter(Boolean);
    console.log(`  rep balance at day 60: no spending ${fmt(nb.map(r => r.rep))} vs engaged spender ${fmt(sp.map(r => r.rep))} (spent ${fmt(sp.map(r => r.spent))}); parts sunk by day 60: ${fmt(sp.map(r => r.sunk.parts || 0))}`); }
  // ---- phase 4 tables ----
  const p4 = (title, runs) => {
    console.log(`\n${title}\n| real day | quarters | rations earned (total) | spent | balance | by source: repair / task / chat / shift / trade | catalogue owned | placed/slots | comfort | rep balance | rep on decor | dinners |\n|---|---|---|---|---|---|---|---|---|---|---|---|`);
    for (const d of DAYS) {
      const rows = runs.map(x => x.o.find(o => o.tag === `day ${d}`)).filter(Boolean); if (!rows.length) continue;
      const m = f => med(rows.map(f)), sh = (r, k) => Math.round((r.rrBy[k] || 0) / Math.max(1, r.rrLife) * 100);
      console.log(`| ${d} | ${rows[0].tier} | ${fmt(rows.map(r => Math.round(r.rrLife)))} | ${m(r => r.rrSpent)} | ${fmt(rows.map(r => r.rr))} | ${m(r => sh(r, 'repair'))}% / ${m(r => sh(r, 'task'))}% / ${m(r => sh(r, 'chat'))}% / ${m(r => sh(r, 'shift'))}% / ${m(r => sh(r, 'trade'))}% | ${fmt(rows.map(r => r.comp))}% (${m(r => r.owned)}) | ${m(r => r.placed)}/${m(r => r.nslots)} | +${m(r => r.comfort)}% | ${fmt(rows.map(r => r.rep))} | ${m(r => r.decorRep)} | ${m(r => r.dinners)} |`);
    }
  };
  p4('K1) Regular player: rations, quarters, catalogue, rep (engaged spender)', regRuns);
  if (casRuns.length) p4('K2) Casual player', casRuns);
  const goal = (title, runs) => {
    const rows = d => runs.map(x => x.o.find(o => o.tag === `day ${d}`)).filter(Boolean);
    const after7 = runs.map(x => Math.max(...x.o.filter(o => +o.tag.split(' ')[1] >= 7).map(o => o.rep)));
    const rrMax = runs.map(x => Math.max(...x.o.filter(o => +o.tag.split(' ')[1] >= 7).map(o => o.rr)));
    const last = runs.map(x => x.o[x.o.length - 1]);
    console.log(`${title}: rep balance max (day 7+) ${fmt(after7)} · rations balance max (day 7+) ${fmt(rrMax)} · catalogue ${[30, 60, 120].filter(d => d <= DAYS_N).map(d => `day ${d} ${fmt(rows(d).map(r => r.comp))}%`).join(' · ')} · parts at cap ${fmt(last.map(r => Math.round(r.capHits / Math.max(1, r.starts) * 100)))}% · at day ${DAYS_N}: ${med(last.map(r => r.nextGoal.open))} buyable items left (dearest ${med(last.map(r => r.nextGoal.maxOpen))} rations / ${med(last.map(r => r.nextGoal.maxOpenRep))} rep), ${med(last.map(r => r.nextGoal.gated))} still gated · rests: ${JSON.stringify(last[0].rests)}`);
    console.log(`    rep goals: last rep decor bought on play day ${fmt(last.map(r => r.lastRepBuy))} · rep decor left at day ${DAYS_N}: ${fmt(last.map(r => r.repLeft))} · cadets sponsored ${fmt(last.map(r => r.cadets))} · Fleet Rep at day ${DAYS_N} ${fmt(last.map(r => r.fr))} · rep balance by day ${[14, 30, 45, 60, 90, 120].filter(d => d <= DAYS_N).map(d => `${d}: ${med(rows(d).map(r => r.rep))}`).join(' · ')}`);
    const sp = last[0].startParts || [], hits = sp.filter(x => x[0] >= x[1]); console.log(`    run 1 session starts at cap by location: ${JSON.stringify(hits.reduce((a, x) => (a[x[2]] = (a[x[2]] || 0) + 1, a), {}))} · trade quota used at those starts: ${JSON.stringify(hits.map(x => x[3]).slice(0, 20))} · start parts p50 ${med(sp.map(x => Math.round(x[0] / x[1] * 100)))}% of cap`);
  };
  console.log('\nL) Balance goal check');
  goal('  regular', regRuns); if (casRuns.length) goal('  casual', casRuns);
  const odds = await p.evaluate(async () => { const PR = await import('/js/progression.js'); return [1, 2, 4, 5, 8, 10, 15, 18, 20, 28].map(L => ({ L, need: PR.xpToNext(L), cum: PR.xpForLevel(L), m: PR.qualityOdds(L, true, 1), a: PR.qualityOdds(L, false, 10) })); });
  console.log('\nD) Quality odds by level (manual | auto after week 1) and observed (regular player, all runs; M/S/G/E)');
  console.log('| level | XP to next | cumulative | manual S/G/E | auto M/S/G/E | observed M/S/G/E (n) |\n|---|---|---|---|---|---|');
  const pc = v => Math.round(v * 100);
  for (const o of odds) { const ob = qPool[o.L], n = ob ? ob.reduce((x, y) => x + y, 0) : 0;
    console.log(`| ${o.L} | ${o.need} | ${o.cum} | ${pc(o.m.standard)}/${pc(o.m.good)}/${pc(o.m.excellent)}% | ${pc(o.a.marginal)}/${pc(o.a.standard)}/${pc(o.a.good)}/${pc(o.a.excellent)}% | ${n ? ob.map(v => pc(v / n)).join('/') + `% (${n})` : '-'} |`); }
  console.log('\nerrors', JSON.stringify(errs));
  await b.close();
})();
