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
const DEATHS = process.argv[5] === 'deaths';
const GIFTSIM = process.argv[5] === 'gifts';
const INSIM = process.argv[5] === 'insight';
const ROMSIM = process.argv[5] === 'romance';   // Personal Log phase 4: regular + casual, romance off vs on (accept the first signal); RM_CFG=kind:on|off, SIMJSON / RM_MERGE   // Personal Log phase 3: regular + casual, Insight off (before) vs on, gifts on; INS_CFG=kind:on picks one config (parallel jobs + SIMJSON / INS_MERGE)   // Personal Log phase 2: regular + casual, before (dinner +2, no gifts) / dinner +4 / gifts on // phase 6: regular + casual only, then the injury / death tables and safeguard assertions
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '?reset=1');
  await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 30000 });
  if (DEATHS) await p.evaluate(cfg => { __T.PROG.deaths.enabled = true; window.__DSIM = cfg; }, { late: [+(process.env.LATE_R || 0.05), +(process.env.LATE_C || 0.10)], awayP: +(process.env.AWAY_P || 0.15), assist: [0.7, 0.5] });   // pass 07: slow responders (regular 5% / casual 10%), look-away 15%, assist 70% / 50%   // (on by default since retune v2; kept explicit)
  await p.evaluate(async () => {
    window.__noSave = true; __T.app.paused = true;
    const St = await import('/js/state.js'), sim = await import('/js/sim.js'), P = await import('/js/pacing.js'), PR = await import('/js/progression.js'), CL = await import('/js/crewlife.js'), AM = await import('/js/npc-ambient.js'), CB = await import('/js/cabin.js'), CD = await import('/js/cabin-data.js'), BD = await import('/js/boards.js');
    const G = St.G;
    const snapT = tag => ({ tag, level: G.prog.level, totalXp: G.prog.totalXp, manual: G.prog.xpManual, auto: G.prog.xpAuto, offline: G.prog.xpOffline, day: G.prog.day, rep: G.sp.rep, parts: G.ship.parts, cap: G.ship.partsCap, q: { ...G.prog.quality }, rank: G.prog.rank, readiness: PR.computeReadiness(), rp: { ...G.prog.readyParts }, social: PR.socialPoints(), ops: Object.fromEntries(PR.crewList().map(c => [c.id, Math.round(PR.opinionOf(c.id))])), opAll: (() => { const v = PR.crewList().map(c => PR.opinionOf(c.id)); return Math.round(v.reduce((a, b) => a + b, 0) / v.length); })(), opTop: (() => { const v = PR.crewList().map(c => Math.max(0, PR.opinionOf(c.id))).sort((a, b) => b - a).slice(0, 6); return Math.round(v.reduce((a, b) => a + b, 0) / 6); })(),
      fr: G.prog.fleetRep, alumni: G.prog.alumni.length, cn: { ...G.prog.crew.rolls.n }, perk: (() => { const k = CL.perkState(); return { qm: k.quartermaster ? 1 : 0, gw: k.goodword }; })(), sunk: { ...G.prog.sinks.spent }, sinkN: { ...G.prog.sinks.n }, torps: G.ship.torps, lifetime: Math.round(G.prog.repLifetime), spent: window.__spent || 0, capHits: window.__capHits || 0, ev: { ...G.prog.repEv }, starts: window.__starts || 0,
      rr: G.prog.rations, rrLife: G.prog.rationsLife, rrSpent: G.prog.sinks.spent.rations || 0, rrBy: { ...G.prog.rationsBy }, owned: G.prog.cabin.owned.length, comp: Math.round(CB.completion() * 100), tier: G.prog.cabin.tier, placed: Object.keys(G.prog.cabin.placed).length, nslots: CB.slots().length, comfort: Math.round(CB.totals().comfort * 100), rests: { ...(window.__rests || {}) }, decorRep: window.__decorRep || 0, dinners: G.prog.cabin.dinners || 0, startParts: (window.__startParts || []).slice(),
      gf: { ...(G.prog.gifts ? G.prog.gifts.n : {}) }, rl: G.prog.rationsLife, foc: Math.round(PR.opinionOf('thelev') * 10) / 10, n30: PR.crewList().filter(c => PR.opinionOf(c.id) >= 30).length, gop: Math.round(Object.values(G.prog.gifts ? G.prog.gifts.giftOp : {}).reduce((a, b) => a + b, 0) * 10) / 10, ready: PR.computeReadiness(),
      pl: { ...(G.prog.plog.n || {}) }, plJ: G.prog.plog.journal.length, plH: Object.values(G.prog.plog.hist).reduce((s, a) => s + a.length, 0), med: { ...G.prog.med.n }, rank: G.prog.rank, pd: G.prog.playDays, audit: G.prog.med.audit.slice(), offD: window.__offDeaths || 0, injAll: (window.__injAll || []).length, lastRepBuy: window.__lastRepBuy || 0, cadets: G.prog.fav.fx.cadets || 0, repLeft: CD.DECOR_ITEMS.filter(d => d.cost && d.cost.rep && !CB.owned(d.id)).length,
      ins: G.prog.insight ? { xp: G.prog.insight.xp, lvl: G.prog.insight.lvl, n: { ...G.prog.insight.n } } : null, known: Object.values(G.prog.know || {}).reduce((a, k) => a + ['like1', 'like2', 'dislike', 'avoid'].filter(f => k[f] === 2).length, 0), knownP: Object.values(G.prog.know || {}).reduce((a, k) => a + ['like1', 'like2', 'avoid'].filter(f => k[f] === 1).length, 0),
      rm: G.prog.romance ? (() => { const R = G.prog.romance, id = R.partner, b = id && R.bond[id]; return { n: { ...R.n }, partner: id, stage: b ? b.stage : null, popn: id ? Math.round(PR.opinionOf(id)) : null, farm: { ...(window.__farm || {}) }, pfr: (window.__pfr || []).slice() }; })() : null, soc: (G.prog.readyParts || {}).social,
      desk: (() => { const s = CB.slotsFor('desk')[0]; return s ? G.prog.cabin.placed[s.id] || null : null; })(),
      repT: Math.round(window.__repT || 0), lrep: window.__liveRep || 0, spec: { ...G.prog.spec }, bySys: { ...(G.prog.repBySys || {}) }, boards: G.prog.boardLog.length,
      nextGoal: (() => { const u = CD.DECOR_ITEMS.filter(d => d.cost && !CB.owned(d.id)); const open = u.filter(d => CB.gateState(d).ok); return { open: open.length, gated: u.length - open.length, maxOpen: open.reduce((m, d) => Math.max(m, d.cost.rations || 0), 0), maxOpenRep: open.reduce((m, d) => Math.max(m, d.cost.rep || 0), 0) }; })() });
    // a typical ACTIVE player: reacts to faults after ~20 s, does ~60% of deck tasks, rotates stations every 2-3 min,
    // rests below 25% energy, tops up parts when low. Everything they order is MANUAL (crew.playerOrder).
    // ---- pass 07 deaths audit: looking away (hidden -> app paused, catch-up on return; or idle >= 60 s) must never improve the outcome ----
    const DSIM = window.__DSIM || null;
    const D = () => window.__D || (window.__D = { freeSave: 0, awayBetter: 0, winUp: 0, aways: 0, surg: [], timeouts: [], rec: {}, n0: null });
    function dmon() {
      const m = G.prog.med, d = D(), S = PR.PROG.deaths.surgery, F = G.ship.faults, seen = new Set();
      const n = m.n, n0 = d.n0 || { pulled: n.pulled || 0, close: n.closeCalls || 0 };
      for (const x of m.inj) { const key = x.id + '@' + x.at; seen.add(key); const r = d.rec[key] || (d.rec[key] = { st: x.state, sev: x.sev, away: false });
        if (x.state === 'warning') { r.seenT = x.seenT; r.left = x.left; r.ackT = x.ackT; r.ack = x.ack; }
        if (x.state === 'surgery' && r.st === 'warning') {   // a fix just landed
          r.pres = P.isPresent(); r.by = x.savedBy; r.fast = !!x.fast; r.sx0 = x.sx0; if (!r.pres) r.away = true;
          let ch = S.chance; if (r.ack && r.ackT <= S.fastS) ch *= S.fastMult; ch *= Math.pow(S.excellentMult, Math.min(S.excellentMax, x.excellent || 0)); if (x.visited) ch *= S.visitMult; if (F.eps && F.eps.sev !== 'low' && x.sys !== 'eps') ch *= S.epsOpenMult; ch = Math.min(S.max, ch);
          r.cf = ch; if (!r.pres && x.sx0 < ch - 1e-9) d.awayBetter++; }   // the same fix by a present Lt would never be riskier
        if (x.state === 'surgery') { r.sx = x.sx; r.assist = !!x.assist; }
        if (x.state === 'stable' && r.st === 'warning' && x.sev === 'serious') {   // left the warning with no surgery
          if ((n.pulled || 0) > n0.pulled) d.timeouts.push({ out: 'pulled', away: r.away }); else if ((r.seenT || 0) > 0) d.freeSave++; }
        if (x.state === 'stable' && r.st === 'surgery') d.surg.push({ away: r.away, fast: r.fast, by: r.by, sx0: r.sx0, sx: r.sx, cf: r.cf, assist: r.assist, grave: (n.closeCalls || 0) > n0.close });
        r.st = x.state; }
      for (const [key, r] of Object.entries(d.rec)) if (!seen.has(key)) {   // gone: died, evacuated or transferred
        if (r.st === 'surgery') d.surg.push({ away: r.away, fast: r.fast, by: r.by, sx0: r.sx0, sx: r.sx, cf: r.cf, assist: r.assist, grave: true });
        else if (r.st === 'warning' && r.sev === 'serious') d.timeouts.push({ out: 'lost', away: r.away });
        delete d.rec[key]; }
      d.n0 = { pulled: n.pulled || 0, close: n.closeCalls || 0 };
    }
    function lookAway() {   // 60%: locks the phone 35-400 s (app paused; catch-up on return as in main.js), 40%: idle 70-200 s on screen
      const d = D(), m = G.prog.med, before = {}; d.aways++;
      for (const x of m.inj) { const r = d.rec[x.id + '@' + x.at]; if (r) r.away = true; if (x.state === 'warning') before[x.id + '@' + x.at] = x.left; }
      let dur;
      if (Math.random() < 0.6) { dur = 35 + Math.random() * 365; P.PACE_RT.hidden = true; if (dur > 30) { const d0 = m.n.deaths; sim.catchUp(dur); window.__offDeaths = (window.__offDeaths || 0) + m.n.deaths - d0; } P.PACE_RT.hidden = false; dmon(); }
      else { dur = 70 + Math.random() * 130; for (let s2 = 0; s2 < dur; s2 += 0.1) { sim.stepSim(0.1); dmon(); } }
      P.playerInput(); sim.stepSim(0.1); dmon();
      for (const x of m.inj) { const k = x.id + '@' + x.at; if (x.state === 'warning' && before[k] != null && x.left > before[k] + 0.01 && !(x.floored && x.left <= 30.01)) d.winUp++; }   // the clock never grows back while away (pass 08: except the one-time 30 s return floor)
      return dur;
    }
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
          // pass 06: an ATTENTIVE player — the red pill + vibrate get noticed; most go at once (~20 s like any fault: regular 80%,
          // casual 65%), the rest finish what they're doing first (60-120 s; 40% of them visit the patient on the way). Nobody ignores it.
          if (W) { const key = W.id + '@' + W.at, A = st.att || (st.att = {}); if (A[key] === undefined) { const late = DSIM && Math.random() < (window.__kind === 'casual' ? DSIM.late[1] : DSIM.late[0]);   // pass 07: a few slow responders (timeouts)
              A[key] = late ? 'none' : Math.random() < (window.__kind === 'casual' ? 0.65 : 0.8) ? 'fix' : Math.random() < 0.4 ? 'visit' : 'none'; (st.slow || (st.slow = {}))[key] = G.ship.elapsed + (late ? 150 + Math.random() * 110 : 60 + Math.random() * 60);
              if (DSIM && Math.random() < DSIM.awayP) (st.awayAt || (st.awayAt = {}))[key] = t + Math.random() * 40; }   // pass 07: sometimes looks away mid-warning
            if (DSIM && st.awayAt && st.awayAt[key] != null && t >= st.awayAt[key]) { delete st.awayAt[key]; t += lookAway(); continue; }
            if (A[key] !== 'fix' && G.ship.elapsed >= st.slow[key] && (A[key] === 'none' || A[key] === 'visited' || W.visited)) A[key] = 'fix';
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
        if (DSIM && !opts.handsOff) { const sc = G.prog.med.scene, x = sc && sc.phase === 'surgery' && G.prog.med.inj.find(i => i.id === sc.id && i.state === 'surgery');
          if (x) { const key = 's' + x.id + '@' + x.at, A = st.satt || (st.satt = {});
            if (A[key] === undefined) { A[key] = { assist: Math.random() < (window.__kind === 'casual' ? DSIM.assist[1] : DSIM.assist[0]), away: Math.random() < DSIM.awayP }; if (A[key].away) { A[key].away = false; t += lookAway(); continue; } }
            if (A[key].assist && !x.assist) __T.MD.assistSurgery(); } }
        sim.stepSim(0.1); AM.tickAmbient(0.1); t += 0.1; if (DSIM) dmon();
        window.__liveRep = (window.__liveRep || 0) + (G.stats.repairs || 0) - r0;   // roster NPCs on the Lt's deck come over for chats / intros
        for (const m of marks) if (!m.done && t >= m.at) { m.done = true; out.push(snapT(m.tag)); }
      }
    }
    // phase 3 spending policy of an engaged player (session start): favours when affordable with a reserve, parts sinks
    // whenever the locker is near full. Rep spent is tracked in G.prog.sinks.spent.
    // Personal Log phase 2: an engaged gift-giver (memo §2 target: ~35-50 FR a day on gifts). Budget per session; the focus
    // friend (Thelev: protected, never transfers) first, then the friendliest crew under +70. Known loved > known liked > explore
    // (mostly Tokens) avoiding known dislikes and repeats; a Personal item for the focus when docked at DS9 with spare rations.
    window.__giftPolicy = async () => {
      const GF = await import('/js/gifts.js'), GD = await import('/js/gift-data.js');
      let budget = window.__kind === 'casual' ? 25 : 23;
      const sh = GF.shopState();
      if (sh.docked && G.prog.rations >= 300 && GF.lockerCount() < 2) {
        const pers = GD.GIFT_ITEMS.find(it => it.tier === 'personal' && GF.knownHint('thelev', it) && GF.knownHint('thelev', it) !== 'disliked' && !G.prog.gifts.inv[it.id]);
        if (pers && GF.buyForLocker(pers.id)) window.__gLocker = (window.__gLocker || 0) + 1;
      }
      const cands = PR.crewList().filter(c => PR.opinionOf(c.id) < 69 && GF.giveState(c.id).ok).sort((a, b) => (b.id === 'thelev') - (a.id === 'thelev') || PR.opinionOf(b.id) - PR.opinionOf(a.id));
      for (const c of cands) {
        const opts = GF.giftOptions(c.id).filter(o => o.ok && o.price <= budget && o.hint !== 'disliked'), cnt = G.prog.gifts.count[c.id] || {};
        const score = o => (o.hint === 'loved' ? 100 : o.hint === 'liked' ? 50 : 0) - (cnt[o.it.id] || 0) * 30 + (o.inLocker ? 20 : 0) + (o.hint ? o.tier.base : (o.it.tier === 'token' ? 3 : 1)) + Math.random();
        const best = opts.sort((a, b) => score(b) - score(a))[0]; if (!best) continue;
        const r = GF.giveGift(c.id, best.it.id); if (r.ok) budget -= best.price;
        if (budget < 10) break;
      }
    };
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
    // phase 3 follow-up (insight mode only, window.__insDecor): an Insight-minded player puts a 3-D chess set on the desk once
    // it can afford 350 rations (from day 2, before gifting), and upgrades to the holo-novel library once Fleet Rep 50 and 2400 + 100 rations
    // allow. Every tier has ONE desk slot, so only one of the two can be placed at a time (+1 Insight XP a day, not +2).
    const insDesk = () => { const s = CB.slotsFor('desk')[0]; return s && ['chess', 'holoLib'].includes(G.prog.cabin.placed[s.id]) ? s : null; };
    window.__insDecorStep = () => {
      if (!window.__insDecor) return; const s = CB.slotsFor('desk')[0]; if (!s) return; const cur = G.prog.cabin.placed[s.id];
      const want = id => { const d = CD.DECOR[id]; if (CB.owned(id)) { if (cur !== id) CB.placeItem(id, s.id); return true; } if (CB.gateState(d).ok && G.prog.rations >= d.cost.rations + (id === 'chess' ? 0 : 100) && CB.buyItem(id, s.id)) { if (G.prog.cabin.placed[s.id] !== id) CB.placeItem(id, s.id); window.__insBuys = (window.__insBuys || []).concat([[id, G.prog.day]]); return true; } return false; };
      if (cur === 'holoLib') return;
      if (want('holoLib')) return;
      if (cur !== 'chess' && G.prog.day >= 2) want('chess');
    };
    window.__decor = () => {
      window.__insDecorStep();
      for (let k = 0; k < 6; k++) {
        const cands = CD.DECOR_ITEMS.filter(d => d.cost && !CB.owned(d.id) && CB.gateState(d).ok && PR.canAfford(d.cost) && CB.slotsFor(d.slot).length);
        const free = cands.filter(d => CB.slotsFor(d.slot).some(s => !G.prog.cabin.placed[s.id]) && (d.cost.rations ? true : G.sp.rep >= d.cost.rep + 300)).sort((a, b) => (a.cost.rations || a.cost.rep / 3) - (b.cost.rations || b.cost.rep / 3));
        let d = free[0], slot = d && CB.slotsFor(d.slot).find(s => !G.prog.cabin.placed[s.id]);
        if (!d) {
          d = cands.filter(x => !(window.__insDecor && x.slot === 'desk' && insDesk())).filter(x => x.cost.rations ? G.prog.rations >= x.cost.rations + 200 : G.sp.rep >= x.cost.rep + 300).sort((a, b) => (a.cost.rations || a.cost.rep / 3) - (b.cost.rations || b.cost.rep / 3))[0];
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
      window.__insDecorStep();   // (a promotion moves the desk item to storage; put the chess set / library back)
    };
    // phase 5: a present player faces a waiting board straight away and makes a waiting spec pick by policy
    // (first focus at random, then upgrade it, then a second focus at random)
    window.__present = () => {
      if (BD.boardWaiting()) BD.resolveBoard();
      if (window.__romOn) { const RM = window.__RM; if (RM.pendingSignal()) RM.answerSignal(true); if (RM.pendingDisc()) RM.fileDisclosure(); if ((RM.letterState() || {}).waiting) RM.replyLetter('warm'); }
      // phase 3: a waiting chat-choice beat is answered; with a ⚠ showing the player avoids the risky reply, without one they
      // pick it 25% of the time (the replies read plausibly); an open apology is made at the next chance
      const IN = window.__IN; if (IN) { const v = IN.beatView(); if (v) IN.answerBeat(v.warn ? 0 : (Math.random() < 0.25 ? 2 : Math.floor(Math.random() * 2)));
        for (const id of Object.keys(G.prog.insight.apol)) if ((IN.apologyState(id) || {}).ok) IN.apologise(id); }
      while (BD.specPending()) {
        const sp = G.prog.spec, ids = Object.keys(PR.PROG.specs.focus), own = Object.keys(sp);
        const id = !own.length ? ids[Math.floor(Math.random() * ids.length)] : own.find(i => sp[i] < PR.PROG.specs.maxTier) || ids.filter(i => !sp[i])[Math.floor(Math.random() * ids.filter(i => !sp[i]).length)];
        if (!id || !BD.pickSpec(id)) break;
      }
    };
    window.__IN = await import('/js/insight.js'); window.__RM = await import('/js/romance.js');
    // phase 4 policy (romance mode, window.__romOn): accept the first signal, an evening together whenever one is open at session
    // start (Promenade when docked, else dinner), file any disclosure, answer letters warmly. Audit the anti-farm rule every day.
    window.__romPolicy = () => { const RM = window.__RM; if (!window.__romOn) return; const id = RM.partner(); if (!id) return;
      const o = RM.dateOptions(id).filter(x => x.ok).sort((a, b) => (b.k === 'promenade') - (a.k === 'promenade'))[0]; if (o) RM.goOnDate(id, o.k); };
    window.__romAudit = () => { const RM = window.__RM, id = RM.partner(), A = window.__farm || (window.__farm = { checks: 0, ready: 0, cap: 0, auth: 0, maxGain: 0 }); if (!id) return;
      A.checks++; const op = G.prog.opinions[id], r1 = PR.computeReadiness(), s1 = G.prog.readyParts.social;
      if (PR.romanceCap(id, 100) > PR.PROG.romance.friendCap) A.cap++; if (PR.romAuthority(id) && PR.romanceCap(id, 100) !== 0) A.auth++;
      G.prog.opinions[id] = Math.min(op, PR.PROG.romance.friendCap); const r0 = PR.computeReadiness(); G.prog.opinions[id] = op; PR.computeReadiness();   // counterfactual: the same partner held at friendship level
      A.maxGain = Math.max(A.maxGain, r1 - r0); if (r1 > r0) A.ready++; };
    PR.hooks.crewEvent.push((kind, id) => { if (kind === 'transfer') { const a = G.prog.alumni[G.prog.alumni.length - 1]; if (a && a.id === id && G.prog.romance.bond[id] && G.prog.romance.bond[id].stage === 'letters') (window.__pfr = window.__pfr || []).push({ fr: a.fr, op: a.opinion }); } });
    PR.hooks.crewInjured.push(inj => (window.__injAll = window.__injAll || []).push({ cause: inj.cause, sev: inj.sev, pd: inj.pd, offline: inj.offline }));
    function newSession() { P.PACE_RT.sessionT = 0; P.PACE_RT.idleT = 0; }
    function fresh() { St.resetState(); window.__ps = null; newSession(); }
    const rate = (a, b, h) => ({ xp: +((b.totalXp - a.totalXp) / h).toFixed(0), xpMin: +((b.totalXp - a.totalXp) / h / 60).toFixed(2), rep: +((b.rep - a.rep) / h).toFixed(1), parts: +((b.parts - a.parts) / h).toFixed(1) });
    window.__sim = {
      // A) per-mode rates, measured from a mid-game state (level ~8, after 2 days of regular play) so session-1
      // milestones / rested bonus don't inflate them; parts measured with the locker refilled to 6 first.
      async modes() {
        fresh(); await window.__sim.regular(2, []);
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
      async regular(days, out, kind = 'regular', buy = true) {
        window.__kind = kind; window.__injAll = []; window.__offDeaths = 0;
        window.__lastRepBuy = 0; window.__repT = 0; window.__liveRep = 0; window.__spent = 0; window.__capHits = 0; window.__starts = 0; window.__rests = {}; window.__decorRep = 0; window.__startParts = [];
        if (!buy) G.prog.sinks.maintainOn = false;   // the no-spend baseline also turns the standing order off
        const atStart = () => { window.__starts++; (window.__startParts = window.__startParts || []).push([G.ship.parts, G.ship.partsCap, G.sp.location || 'warp', G.prog.sinks.trade ? G.prog.sinks.trade.parts : 0]); if (G.ship.parts >= G.ship.partsCap) window.__capHits++; };
        const plan = kind === 'regular' ? [{ at: 8, len: 20 }, { at: 19, len: 20 }] : [{ at: 19, len: 15 }];
        let clock = null;
        for (let d = 1; d <= days; d++) {
          for (let si = 0; si < plan.length; si++) {
            const startH = (d - 1) * 24 + plan[si].at;
            if (clock !== null) { const d0 = G.prog.med.n.deaths; sim.catchUp((startH - clock) * 3600); window.__offDeaths = (window.__offDeaths || 0) + G.prog.med.n.deaths - d0; }
            newSession(); PR.markPlayDay(new Date(Date.UTC(2026, 0, d, 12)), 999);   // a real calendar day with play (pass 07: sim sessions are >= 3 min present)
            atStart(); window.__present();
            const o = PR.lockerOffer(); if (buy && o && G.sp.rep >= o.rep + 30) { window.__spent += o.rep; PR.buyLocker(); }   // the player buys the requisition once affordable (+30 reserve)
            if (window.__romPolicy) window.__romPolicy();
            if (buy && window.__insDecorStep) window.__insDecorStep();   // (insight mode: saves for the chess set before gifting)
            if (buy && window.__gifts) await window.__giftPolicy();
            if (buy) window.__sinks();
            const len = (d === 1 && si === 0) ? Math.max(plan[si].len, 30) : plan[si].len;
            live(len * 60); clock = startH + len / 60;
          }
          const endH = d * 24 + plan[0].at;   // "after day d" = the next morning, before the first session
          { const d0 = G.prog.med.n.deaths; sim.catchUp((endH - clock) * 3600); window.__offDeaths = (window.__offDeaths || 0) + G.prog.med.n.deaths - d0; } clock = endH;
          if (window.__romOn !== undefined && window.__romAudit) window.__romAudit();
          if (out) out.push(snapT(`day ${d}`));
        }
        return out;
      },
    };
  });
  if (GIFTSIM) {
    const cfgs = [['before: no gifts, dinner +2', false, 2], ['no gifts, dinner +4', false, 4], ['gifts on, dinner +4', true, 4]];
    let res = {};
    // parallel jobs: SIMJSON=out.json dumps the raw runs; GIFT_MERGE=a.json,b.json merges dumps and only prints the table
    if (process.env.GIFT_MERGE) { for (const f of process.env.GIFT_MERGE.split(',')) for (const [k, v] of Object.entries(JSON.parse(require('fs').readFileSync(f, 'utf8')))) res[k] = (res[k] || []).concat(v); }
    else for (const kind of ['regular', 'casual']) for (const [name, on, dinner] of cfgs) {
      const runs = res[`${kind} · ${name}`] = [];
      for (let r = 0; r < RUNS; r++) runs.push(await p.evaluate(async ([D, kind, on, dinner]) => { const St = await import('/js/state.js'), PR = await import('/js/progression.js'); PR.PROG.cabin.dinner.opinion = dinner; window.__gifts = on; St.resetState(); window.__ps = null; window.__gLocker = 0; const o = await __sim.regular(D, [], kind); return { o, locker: window.__gLocker }; }, [DAYS_N, kind, on, dinner]));
    }
    if (process.env.SIMJSON) require('fs').writeFileSync(process.env.SIMJSON, JSON.stringify(res));
    const NR = Object.values(res)[0].length, ND = Object.values(res)[0][0].o.length;
    const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const fmt = v => NR > 1 ? `${med(v)} [${Math.min(...v)}-${Math.max(...v)}]` : `${v[0]}`;
    const r1 = x => Math.round(x * 10) / 10;
    const dayTo = (r, f) => { const s = r.o.find(f); return s ? +s.tag.split(' ')[1] : 999; };
    console.log(`runs: ${NR} × ${ND} days per config (median [min-max]); focus friend = Thelev (protected: never transfers), starts at +5; favours threshold +30\n`);
    console.log('| player · config | gifts / week | FR on gifts / day | FR income / day | gift share of income | gift opinion / week (all crew) | Thelev at day 7 / 14 / 30 / 60 | days for Thelev to reach +30 | first crewmate at +30 (day) | crew at +30 at the end | board readiness at the end |');
    console.log('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const [k, runs] of Object.entries(res)) {
      const L = r => r.o[r.o.length - 1], at = (r, d) => r.o.find(o => o.tag === `day ${d}`) || L(r), W = ND / 7;
      const spent = r => (L(r).gf.spent || 0) + (L(r).gf.careSpent || 0);
      console.log(`| ${k} | ${fmt(runs.map(r => r1((L(r).gf.given || 0) / W)))} | ${fmt(runs.map(r => Math.round(spent(r) / ND)))} | ${fmt(runs.map(r => Math.round(L(r).rl / ND)))} | ${med(runs.map(r => Math.round(spent(r) / Math.max(1, L(r).rl) * 100)))}% | ${fmt(runs.map(r => r1((L(r).gf.opinion || 0) / W)))} | ${med(runs.map(r => at(r, 7).foc))} / ${med(runs.map(r => at(r, 14).foc))} / ${med(runs.map(r => at(r, 30).foc))} / ${med(runs.map(r => at(r, 60).foc))} | ${fmt(runs.map(r => dayTo(r, o => o.foc >= 30)))} | ${fmt(runs.map(r => dayTo(r, o => o.n30 >= 1)))} | ${fmt(runs.map(r => L(r).n30))} | ${fmt(runs.map(r => L(r).ready))} |`);
    }
    console.log('\n(999 = not reached inside the horizon.) Gift opinion = what gifts actually added after gainMult 0.4, the soft cap and the +70 gift cap.');
    console.log('errors', JSON.stringify(errs)); await b.close(); return;
  }
  if (INSIM) {
    const all = [['regular', false], ['regular', true], ['casual', false], ['casual', true]], pick = process.env.INS_CFG;
    const cfgs = pick ? all.filter(([k, on]) => `${k}:${on ? 'on' : 'off'}` === pick) : all;
    let res = {};
    if (process.env.INS_MERGE) { for (const f of process.env.INS_MERGE.split(',')) for (const [k, v] of Object.entries(JSON.parse(require('fs').readFileSync(f, 'utf8')))) res[k] = (res[k] || []).concat(v); }
    else for (const [kind, on] of cfgs) {
      const runs = res[`${kind} · Insight ${on ? 'ON' : 'off (before)'}`] = [];
      for (let r = 0; r < RUNS; r++) runs.push(await p.evaluate(async ([D, kind, on]) => { const St = await import('/js/state.js'), PR = await import('/js/progression.js'); PR.PROG.insight.enabled = on; window.__gifts = true; window.__insDecor = true; window.__insBuys = []; St.resetState(); window.__ps = null; window.__gLocker = 0;
        const o = await __sim.regular(D, [], kind); return { o: o.map(s => ({ tag: s.tag, pd: s.pd, rank: s.rank, level: s.level, ready: s.ready, opAll: s.opAll, opTop: s.opTop, foc: s.foc, n30: s.n30, ins: s.ins, known: s.known, knownP: s.knownP, gf: s.gf, desk: s.desk, rr: s.rr, tier: s.tier })), buys: window.__insBuys }; }, [DAYS_N, kind, on]));
    }
    if (process.env.SIMJSON) { require('fs').writeFileSync(process.env.SIMJSON, JSON.stringify(res)); console.log('dumped', process.env.SIMJSON, 'errors', JSON.stringify(errs)); await b.close(); return; }
    const NR = Object.values(res)[0].length, ND = Object.values(res)[0][0].o.length;
    const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const fmt = v => NR > 1 ? `${med(v)} [${Math.min(...v)}-${Math.max(...v)}]` : `${v[0]}`;
    const r1 = x => Math.round(x * 10) / 10;
    const dayTo = (r, f) => { const s = r.o.find(f); return s ? +s.tag.split(' ')[1] : 999; };
    const pdTo = (r, f) => { const s = r.o.find(f); return s ? s.pd : 999; };
    const at = (r, d) => r.o.find(o => o.tag === `day ${d}`) || r.o[r.o.length - 1];
    console.log(`runs: ${NR} × ${ND} days per config (median [min-max]); gifts on in every config (phase 2 policy); deaths on (shipped default)\n`);
    console.log('### Insight gain');
    console.log('| player · config | Insight XP week 1 / 2 / 3 / 4 | XP / week (days 29-' + ND + ') | Insight at day 3 / 8 / 14 / 21 / 30 / ' + ND + ' | day Insight 3 / 5 / 8 / 10 | XP by source at the end (chat / gift / first reactions / levels / decor) |');
    console.log('|---|---|---|---|---|---|');
    const XPd = (r, d) => d <= 0 ? 0 : (at(r, d).ins || { xp: 0 }).xp;
    for (const [k, runs] of Object.entries(res)) { if (!/ON/.test(k)) continue; const L = r => r.o[r.o.length - 1];
      const wk = w => med(runs.map(r => XPd(r, 7 * w) - XPd(r, 7 * (w - 1))));
      console.log(`| ${k} | ${wk(1)} / ${wk(2)} / ${wk(3)} / ${wk(4)} | ${fmt(runs.map(r => r1((XPd(r, ND) - XPd(r, 28)) / ((ND - 28) / 7))))} | ${[3, 8, 14, 21, 30, ND].map(d => med(runs.map(r => (at(r, d).ins || {}).lvl || 0))).join(' / ')} | ${[3, 5, 8, 10].map(l => fmt(runs.map(r => dayTo(r, o => o.ins && o.ins.lvl >= l)))).join(' / ')} | ${['chat', 'gift', 'react', 'level', 'decor'].map(x => med(runs.map(r => L(r).ins.n[x] || 0))).join(' / ')} |`); }
    console.log('\n### What it unlocks, and when (Insight ON)');
    console.log('| player | numbers shown (Insight 3) from day | full-reveal odds at day 14 / 30 | ⚠ odds at day 14 / 30 | hints (exact) by day 14 / 30 / ' + ND + ' | conversations · missteps · apologies by day ' + ND + ' | tastes known exactly at day 14 / 30 (off → on) |');
    console.log('|---|---|---|---|---|---|---|');
    for (const kind of ['regular', 'casual']) { const on = res[`${kind} · Insight ON`], off = res[`${kind} · Insight off (before)`]; if (!on) continue; const L = r => r.o[r.o.length - 1];
      const lv = d => med(on.map(r => (at(r, d).ins || {}).lvl || 0)), hn = d => `${med(on.map(r => at(r, d).ins.n.hints))} (${med(on.map(r => at(r, d).ins.n.full))})`;
      console.log(`| ${kind} | ${fmt(on.map(r => dayTo(r, o => o.ins && o.ins.lvl >= 3)))} | ${lv(14) * 10}% / ${lv(30) * 10}% | ${Math.min(80, 20 + 6 * lv(14))}% / ${Math.min(80, 20 + 6 * lv(30))}% | ${hn(14)} / ${hn(30)} / ${hn(ND)} | ${med(on.map(r => L(r).ins.n.beats))} · ${med(on.map(r => L(r).ins.n.missteps))} · ${med(on.map(r => L(r).ins.n.apologies))} | ${off ? med(off.map(r => at(r, 14).known)) : '?'} → ${med(on.map(r => at(r, 14).known))} / ${off ? med(off.map(r => at(r, 30).known)) : '?'} → ${med(on.map(r => at(r, 30).known))} |`); }
    console.log('\n### Promotion timing and readiness: before (Insight off) vs ON');
    console.log('| player · config | Lt at play day | Lt Cmdr at play day | readiness day 7 / 14 / 21 | avg opinion day 14 / 30 / ' + ND + ' | top-6 opinion day 30 / ' + ND + ' | crew at +30 at the end |');
    console.log('|---|---|---|---|---|---|---|');
    for (const [k, runs] of Object.entries(res)) { const L = r => r.o[r.o.length - 1];
      console.log(`| ${k} | ${fmt(runs.map(r => pdTo(r, o => o.rank >= 1)))} | ${fmt(runs.map(r => pdTo(r, o => o.rank >= 2)))} | ${[7, 14, 21].map(d => med(runs.map(r => at(r, d).ready))).join(' / ')} | ${[14, 30, ND].map(d => med(runs.map(r => at(r, d).opAll))).join(' / ')} | ${med(runs.map(r => at(r, 30).opTop))} / ${med(runs.map(r => L(r).opTop))} | ${fmt(runs.map(r => L(r).n30))} |`); }
    console.log('\n### Decor Insight XP (3-D chess set / holo-novel library on the desk; one desk slot per tier)');
    console.log('| player · config | chess bought (day) | library bought (day) | days with chess / library on the desk | decor XP by day 30 / ' + ND + ' |');
    console.log('|---|---|---|---|---|');
    for (const [k, runs] of Object.entries(res)) { const L = r => r.o[r.o.length - 1], bd = (r, id) => { const x = (r.buys || []).find(b => b[0] === id); return x ? x[1] : 999; };
      console.log(`| ${k} | ${fmt(runs.map(r => bd(r, 'chess')))} | ${fmt(runs.map(r => bd(r, 'holoLib')))} | ${med(runs.map(r => r.o.filter(o => o.desk === 'chess').length))} / ${med(runs.map(r => r.o.filter(o => o.desk === 'holoLib').length))} | ${/ON/.test(k) ? `${med(runs.map(r => at(r, 30).ins.n.decor))} / ${med(runs.map(r => L(r).ins.n.decor))}` : '-'} |`); }
    console.log('\n(999 = not reached inside the horizon.) Play day = calendar days with play (markPlayDay); here 1 play day = 1 ship\'s day.');
    console.log('errors', JSON.stringify(errs)); await b.close(); return;
  }
  if (ROMSIM) {
    const all = [['regular', false], ['regular', true], ['casual', false], ['casual', true]], pick = process.env.RM_CFG;
    const cfgs = pick ? all.filter(([k, on]) => `${k}:${on ? 'on' : 'off'}` === pick) : all;
    let res = {};
    if (process.env.RM_MERGE) { for (const f of process.env.RM_MERGE.split(',')) for (const [k, v] of Object.entries(JSON.parse(require('fs').readFileSync(f, 'utf8')))) res[k] = (res[k] || []).concat(v); }
    else for (const [kind, on] of cfgs) {
      const runs = res[`${kind} · romance ${on ? 'ON (accepts)' : 'off'}`] = [];
      for (let r = 0; r < RUNS; r++) runs.push(await p.evaluate(async ([D, kind, on]) => { const St = await import('/js/state.js'); window.__gifts = true; window.__insDecor = true; window.__romOn = on; window.__farm = null; window.__pfr = []; St.resetState(); window.__ps = null; window.__gLocker = 0;
        __T.G.prog.romance.opt = on; const o = await __sim.regular(D, [], kind); const L = o[o.length - 1];
        return { o: o.map(s => ({ tag: s.tag, pd: s.pd, rank: s.rank, ready: s.ready, soc: s.soc, opAll: s.opAll, rm: s.rm, med: s.med })), audit: L.audit, offD: L.offD, injAll: L.injAll }; }, [DAYS_N, kind, on]));
    }
    if (process.env.SIMJSON) { require('fs').writeFileSync(process.env.SIMJSON, JSON.stringify(res)); console.log('dumped', process.env.SIMJSON, 'errors', JSON.stringify(errs)); await b.close(); return; }
    const K6 = await p.evaluate(() => __T.PROG.deaths);
    const NR = Object.values(res)[0].length, ND = Object.values(res)[0][0].o.length;
    const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const fmt = v => NR > 1 ? `${med(v)} [${Math.min(...v)}-${Math.max(...v)}]` : `${v[0]}`;
    const dayTo = (r, f) => { const s = r.o.find(f); return s ? +s.tag.split(' ')[1] : 999; };
    const pdTo = (r, f) => { const s = r.o.find(f); return s ? s.pd : 999; };
    const at = (r, d) => r.o.find(o => o.tag === `day ${d}`) || r.o[r.o.length - 1];
    const L = r => r.o[r.o.length - 1];
    console.log(`runs: ${NR} × ${ND} days per config (median [min-max]); gifts + Insight on; deaths ON (shipped default). The ON player accepts the first signal, takes every open evening together, files disclosures and answers letters.\n`);
    console.log('### Signal and stages (romance ON)');
    console.log('| player | first signal (day) | accepted (day) | courting (day) | together (day) | days signal → courting / → together | evenings together by day 30 / ' + ND + ' | endings · transfers to letters · partners lost | disclosures |');
    console.log('|---|---|---|---|---|---|---|---|---|');
    for (const [k, runs] of Object.entries(res)) { if (!/ON/.test(k)) continue;
      const fs_ = r => dayTo(r, o => o.rm.n.signals > 0), cs = r => dayTo(r, o => o.rm.stage === 'courting' || o.rm.stage === 'together' || (o.rm.n.together > 0)), ts = r => dayTo(r, o => o.rm.n.together > 0);
      console.log(`| ${k} | ${fmt(runs.map(fs_))} | ${fmt(runs.map(r => dayTo(r, o => o.rm.n.accepted > 0)))} | ${fmt(runs.map(cs))} | ${fmt(runs.map(ts))} | ${med(runs.map(r => cs(r) - fs_(r)))} / ${med(runs.map(r => ts(r) - fs_(r)))} | ${med(runs.map(r => at(r, 30).rm.n.dates))} / ${med(runs.map(r => L(r).rm.n.dates))} | ${med(runs.map(r => L(r).rm.n.ended))} · ${med(runs.map(r => L(r).rm.n.letters ? 1 : 0))} · ${runs.reduce((t, r) => t + L(r).rm.n.lost, 0)} (all runs) | ${med(runs.map(r => L(r).rm.n.disclosures))} |`); }
    console.log('\n### Readiness and promotion: romance off vs ON (anti-farm)');
    console.log('| player · config | Lt at play day | Lt Cmdr at play day | readiness day 7 / 14 / 21 / 30 | social points (of 40) day 14 / 30 | avg opinion day 30 / ' + ND + ' | partner opinion day 30 / ' + ND + ' | farm audit: daily checks · readiness gain over the partner-at-+50 counterfactual (max) · cap / authority violations | Fleet Rep banked from a transferred partner |');
    console.log('|---|---|---|---|---|---|---|---|---|');
    let farmBad = 0;
    for (const [k, runs] of Object.entries(res)) { const F = runs.map(r => L(r).rm.farm), pf = runs.flatMap(r => L(r).rm.pfr);
      const bad = F.reduce((t, f) => t + (f.ready || 0) + (f.cap || 0) + (f.auth || 0), 0) + pf.filter(x => x.fr > 5).length; farmBad += bad;
      console.log(`| ${k} | ${fmt(runs.map(r => pdTo(r, o => o.rank >= 1)))} | ${fmt(runs.map(r => pdTo(r, o => o.rank >= 2)))} | ${[7, 14, 21, 30].map(d => med(runs.map(r => at(r, d).ready))).join(' / ')} | ${med(runs.map(r => at(r, 14).soc))} / ${med(runs.map(r => at(r, 30).soc))} | ${med(runs.map(r => at(r, 30).opAll))} / ${med(runs.map(r => L(r).opAll))} | ${/ON/.test(k) ? `${med(runs.map(r => at(r, 30).rm.popn ?? -999))} / ${med(runs.map(r => L(r).rm.popn ?? -999))}` : '-'} | ${F.reduce((t, f) => t + (f.checks || 0), 0)} · ${F.reduce((t, f) => t + (f.ready || 0), 0)} (max ${Math.max(0, ...F.map(f => f.maxGain || 0))}) · ${F.reduce((t, f) => t + (f.cap || 0), 0)} / ${F.reduce((t, f) => t + (f.auth || 0), 0)} | ${pf.length ? pf.map(x => `${x.fr} (opinion ${x.op})`).join(', ') : 'none transferred'} |`); }
    console.log(`\nAnti-farm assertion (partner never adds readiness above the +50 counterfactual, never > +50 credit, 0 under authority, ≤ 5 Fleet Rep on transfer): ${farmBad === 0 ? 'PASS' : 'FAIL'} (${farmBad} violations)`);
    console.log('\n### Death safeguards (deaths ON)');
    let vBad = 0;
    for (const [k, runs] of Object.entries(res)) {
      const A = runs.flatMap(x => x.audit || []), v = { early: 0, rank: 0, senior: 0, protected: 0, favourite: 0, gap: 0, caps: 0, unseen: 0, notPresent: 0, offlineDeath: 0, gentle: 0 };
      for (const d of A) { if (d.pd < K6.noDeathsBefore) v.early++; if (d.rank < K6.minRank) v.rank++; if (d.senior) v.senior++; if (d.prot) v.protected++; if (d.fav) v.favourite++; if (d.gap != null && d.gap < K6.gap) v.gap++; if (!d.caps) v.caps++; if (!d.ack) v.unseen++; if (d.present !== true || d.offline || d.hidden || d.idleT >= K6.presentIdle) v.notPresent++; if (d.gentle) v.gentle++; }
      v.offlineDeath = runs.reduce((t, x) => t + (x.offD || 0), 0); const bad = Object.values(v).reduce((a, b) => a + b, 0); vBad += bad;
      console.log(`- ${k}: ${A.length} deaths audited (${runs.reduce((t, r) => t + (L(r).med.deaths || 0), 0)} total), ${runs.reduce((t, r) => t + (r.injAll || 0), 0)} injuries · violations ${JSON.stringify(v)} → ${bad ? 'FAIL' : 'PASS'}`); }
    console.log(`\nSafeguards with deaths on: ${vBad === 0 ? 'PASS' : 'FAIL'} (${vBad} violations). (999 = not reached inside the horizon.)`);
    console.log('errors', JSON.stringify(errs)); await b.close(); return;
  }
  // ---- run ----
  const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const fmt = v => v.length > 1 ? `${med(v)} [${Math.min(...v)}-${Math.max(...v)}]` : `${v[0]}`;
  const modeRuns = [], s1Runs = [], regRuns = [], casRuns = [], noBuyRuns = [], specOffRuns = [], qPool = {};
  for (let r = 0; r < RUNS; r++) {
    if ((!QUICK || QMODES) && !DEATHS) modeRuns.push(await p.evaluate(() => __sim.modes()));
    if (!DEATHS) s1Runs.push(await p.evaluate(() => __sim.session1()));
    regRuns.push(await p.evaluate(async D => { const St = await import('/js/state.js'); St.resetState(); window.__ps = null; window.__D = null; const o = await __sim.regular(D, []); const dz = window.__D; if (dz) { delete dz.rec; delete dz.n0; } return { o, q: St.G.prog.qByLevel, hist: St.G.prog.history, boards: St.G.prog.boardLog.slice(), dz }; }, DAYS_N));
    if (!QUICK || DEATHS) casRuns.push(await p.evaluate(async D => { const St = await import('/js/state.js'); St.resetState(); window.__ps = null; window.__D = null; const o = await __sim.regular(D, [], 'casual'); const dz = window.__D; if (dz) { delete dz.rec; delete dz.n0; } return { o, hist: St.G.prog.history, boards: St.G.prog.boardLog.slice(), dz }; }, DAYS_N));
    if (!QUICK && !DEATHS) noBuyRuns.push(await p.evaluate(async () => { const St = await import('/js/state.js'); St.resetState(); window.__ps = null; const o = await __sim.regular(60, [], 'regular', false); return { o }; }));
    if (!QUICK && !DEATHS) specOffRuns.push(await p.evaluate(async () => { const St = await import('/js/state.js'), PR = await import('/js/progression.js'); const keep = PR.PROG.specs.picks; PR.PROG.specs.picks = []; St.resetState(); window.__ps = null; const o = await __sim.regular(60, []); PR.PROG.specs.picks = keep; return { o }; }));
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
    const A = runs.flatMap(x => x.o[x.o.length - 1].audit), v = { early: 0, rank: 0, senior: 0, protected: 0, favourite: 0, gap: 0, caps: 0, unseen: 0, notPresent: 0, offlineDeath: 0, cause: 0, window: 0, gentle: 0 };
    for (const d of A) { if (d.pd < K6.noDeathsBefore) v.early++; if (d.rank < K6.minRank) v.rank++; if (d.senior) v.senior++; if (d.prot) v.protected++; if (d.fav) v.favourite++; if (d.gap != null && d.gap < K6.gap) v.gap++; if (!d.caps) v.caps++; if (!d.ack) v.unseen++;
      if (d.present !== true || d.offline || d.hidden || d.idleT >= K6.presentIdle) v.notPresent++;   // pass 06 hard rule
      if (!['battle', 'hazard'].includes(d.cause) || (d.cause === 'battle' && d.crit === false)) v.cause++; if (d.how !== 'surgery' && d.window < K6.window - 1) v.window++; if (d.gentle) v.gentle++; }
    v.offlineDeath = runs.reduce((s, x) => s + (x.o[x.o.length - 1].offD || 0), 0);   // independent check: deaths counted across every catch-up
    const injC = runs.reduce((s, x) => s + x.o[x.o.length - 1].injAll, 0), bad = Object.values(v).reduce((a, b) => a + b, 0);
    const minGap = A.filter(d => d.gap != null).map(d => d.gap);
    console.log(`${title}: ${A.length} deaths audited, ${injC} injuries (all from battle hits / hazards — the daily roll has no injury path) · violations ${JSON.stringify(v)} → ${bad === 0 ? 'PASS' : 'FAIL'} · min gap between deaths ${minGap.length ? Math.min(...minGap) : '—'} days of play · deaths by surgery ${A.filter(d => d.how === 'surgery').length} / window expired ${A.filter(d => d.how !== 'surgery').length} · deaths during catch-up ${v.offlineDeath}`);
    return bad;
  };
  if (DEATHS) {
    // parallel jobs: SIMJSON=out.json dumps the raw runs; DEATH_MERGE=a.json,b.json merges dumps (no new runs) and prints everything
    if (process.env.DEATH_MERGE) { regRuns.length = 0; casRuns.length = 0; for (const fn of process.env.DEATH_MERGE.split(',')) { const d = JSON.parse(require('fs').readFileSync(fn, 'utf8')); regRuns.push(...d.reg); casRuns.push(...d.cas); } }
    else if (process.env.SIMJSON) require('fs').writeFileSync(process.env.SIMJSON, JSON.stringify({ reg: regRuns, cas: casRuns }));
    const summ = (name, runs) => { const last = runs.map(x => x.o[x.o.length - 1]), tot = k => last.reduce((s2, r) => s2 + (r.med[k] || 0), 0), mo = DAYS_N / 30, dd = last.map(r => r.med.deaths || 0);
      console.log(`${name}: runs ${runs.length} · injuries/30d ${(tot('injuries') / runs.length / mo).toFixed(1)} (serious ${(tot('serious') / runs.length / mo).toFixed(1)}) · serious saved ${Math.round(tot('saved') / Math.max(1, tot('serious')) * 100)}% (of them stabilised by the night crew/doctor while away ${tot('awaySaved')}) · close calls ${tot('closeCalls')} · pulled ${tot('pulled')} · hospital/evac ${tot('hospital')}/${tot('evac')} · deaths/${DAYS_N}d p10/p50/p90 ${q3(dd)} mean ${(dd.reduce((a, b2) => a + b2, 0) / runs.length).toFixed(2)} · per run [${dd.join(',')}] · refused while away ${tot('blockedAway')}`); };
    console.log(`SUMMARY (pass 07: presence-only clock, present-hours gate ${K6.minPresentH} h / ${K6.gapPresentH} h, assist ×${K6.surgery.assistMult}, window ${K6.window} s present time, surgery chance ${K6.surgery.chance} ×fast ${K6.surgery.fastMult} ×excellent ${K6.surgery.excellentMult} ×visit ${K6.surgery.visitMult}, max ${K6.surgery.max}; crewStabilise ${K6.crewStabilise})`);
    summ('regular', regRuns); summ('casual', casRuns);
    // ---- pass 07: both death sources, the fast-fixer risk, and 'looking away never improves the outcome' ----
    const p7 = (name, runs) => {
      const A = runs.flatMap(x => x.o[x.o.length - 1].audit), dd = runs.map(x => x.o[x.o.length - 1].med.deaths || 0);
      const perRun = h => runs.map(x => x.o[x.o.length - 1].audit.filter(a => (a.how === 'surgery') === (h === 'surgery')).length);
      const Z = runs.map(x => x.dz).filter(Boolean), SG = Z.flatMap(z => z.surg), TO = Z.flatMap(z => z.timeouts);
      const rate = arr => arr.length ? `${(arr.filter(x => x.grave).length / arr.length * 100).toFixed(1)}% observed (n ${arr.length}) · mean odds ${(arr.reduce((a, x) => a + (x.sx || 0), 0) / arr.length * 100).toFixed(1)}%` : 'n 0';
      const w = SG.filter(x => !x.away), aw = SG.filter(x => x.away);
      const v = { freeSave: Z.reduce((a, z) => a + z.freeSave, 0), awayBetter: Z.reduce((a, z) => a + z.awayBetter, 0), windowGrewBack: Z.reduce((a, z) => a + z.winUp, 0) };
      const mo = (arr) => arr.length ? arr.reduce((a, x) => a + (x.sx0 || 0), 0) / arr.length : 0;   // odds at the fix (before any assist)
      // empirical: a surgery that started while away must not carry lower odds than the same patient fixed by a present Lt (cf)
      const cfBad = aw.filter(x => x.sx0 < (x.cf || 0) - 1e-9).length; v.awayBetter += 0;   // (already counted live in awayBetter)
      const awayGrave = aw.length ? aw.filter(x => x.grave).length / aw.length : 0, fastGrave = w.filter(x => x.fast).length ? w.filter(x => x.fast).filter(x => x.grave).length / w.filter(x => x.fast).length : 0;
      const bad = v.freeSave + v.awayBetter + v.windowGrewBack;
      console.log(`\n${name}: deaths/${DAYS_N}d p10/p50/p90 ${q3(dd)} mean ${(dd.reduce((a, b2) => a + b2, 0) / runs.length).toFixed(2)} · by source: surgery ${A.filter(a => a.how === 'surgery').length} (per run p50 ${med(perRun('surgery'))}) / timeout ${A.filter(a => a.how !== 'surgery').length} (per run p50 ${med(perRun('timeout'))})`);
      console.log(`  surgery odds and outcomes ('grave' = the roll went against the patient: death, evacuation or a close call the safeguards caught):`);
      console.log(`  - fast fix by the Lt, watched: ${rate(w.filter(x => x.fast))}; of them assisted: ${rate(w.filter(x => x.fast && x.assist))}`);
      console.log(`  - slower fix by the Lt, watched: ${rate(w.filter(x => !x.fast && x.by === 'lt'))} · fixed by the crew, watched: ${rate(w.filter(x => x.by === 'crew'))}`);
      console.log(`  - player away at some point (hidden / idle): ${rate(aw)} · looked away ${Z.reduce((a, z) => a + z.aways, 0)} times`);
      console.log(`  - timeouts (window ran out, seen + acknowledged): ${TO.length} (lost ${TO.filter(x => x.out === 'lost').length}, pulled through ${TO.filter(x => x.out === 'pulled').length})`);
      console.log(`  Away audit: violations ${JSON.stringify(v)} (freeSave = a seen patient saved with no roll while away; awayBetter = an away fix given lower odds than a present fix; windowGrewBack = clock longer after returning) · away surgeries' mean odds at the fix ${(mo(aw) * 100).toFixed(1)}% vs watched fast fix ${(mo(w.filter(x => x.fast)) * 100).toFixed(1)}% · away grave rate ${(awayGrave * 100).toFixed(1)}% vs watched fast fix ${(fastGrave * 100).toFixed(1)}% → ${bad === 0 && (!aw.length || mo(aw) >= mo(w.filter(x => x.fast))) ? 'PASS' : 'FAIL'}`);
      return bad + (!aw.length || mo(aw) >= mo(w.filter(x => x.fast)) ? 0 : 1);
    };
    const p7bad = p7('P7 regular (attentive: 80% go at once, 15% finish first, 5% late; looks away 15%)', regRuns) + p7('P7 casual (65% at once, 25% finish first, 10% late; looks away 15%)', casRuns);
    console.log(`\nPass 07 'away never improves the outcome': ${p7bad === 0 ? 'PASS' : 'FAIL'} (${p7bad} violations)`);
    console.log(`\nruns: ${regRuns.length} × ${DAYS_N} days  (median [min-max])`);
    medT('P6-1) Injuries and deaths — regular (2 × 20 min a day)', regRuns);
    medT('P6-2) Injuries and deaths — casual (1 × 15 min a day)', casRuns);
    // Personal Log phase 1: journal entries written per week (the memo sets no rate; caps in PROG.plog)
    const plT = (title, runs) => {
      const at = (r, d) => (r.o.find(o => o.tag === `day ${d}`) || r.o[r.o.length - 1]), kinds = ['chat', 'arrival', 'promotion', 'demotion', 'transfer', 'death', 'injured', 'stable', 'healed', 'visit', 'memorial', 'dinner', 'kit', 'oddjob', 'praise', 'complaint'];
      const wk = (r, k, a, b) => ((at(r, b).pl[k] || 0) - (a <= 1 ? 0 : (at(r, a).pl[k] || 0))) / ((b - Math.max(1, a) + (a <= 1 ? 1 : 0)) / 7);
      const tot = (r, a, b) => kinds.reduce((s, k) => s + wk(r, k, a, b), 0);
      console.log(`\n${title}\n| days | journal entries / week (all) | chats | crew events | sickbay | dinner / kit / odd job / rep | journal kept (cap ${K6pl.journal}) | reasons kept |\n|---|---|---|---|---|---|---|---|`);
      for (const [a, b] of [[1, 7], [1, 30], [30, 60], [60, 120]].filter(([, b]) => b <= DAYS_N)) {
        const f = fn => fmt(runs.map(r => Math.round(fn(r) * 10) / 10));
        console.log(`| ${a}-${b} | ${f(r => tot(r, a, b))} | ${f(r => wk(r, 'chat', a, b))} | ${f(r => ['arrival', 'promotion', 'demotion', 'transfer', 'death'].reduce((s, k) => s + wk(r, k, a, b), 0))} | ${f(r => ['injured', 'stable', 'healed', 'visit', 'memorial'].reduce((s, k) => s + wk(r, k, a, b), 0))} | ${f(r => ['dinner', 'kit', 'oddjob', 'praise', 'complaint'].reduce((s, k) => s + wk(r, k, a, b), 0))} | ${med(runs.map(r => at(r, b).plJ))} | ${med(runs.map(r => at(r, b).plH))} |`);
      }
      const B = DAYS_N; console.log(`  by kind, entries/week over days 1-${B} (median): ` + kinds.map(k => `${k} ${med(runs.map(r => Math.round(wk(r, k, 1, B) * 10) / 10))}`).join(' · '));
    };
    const K6pl = await p.evaluate(() => __T.PROG.plog);
    plT('PL-1) Personal Log — regular', regRuns); plT('PL-2) Personal Log — casual', casRuns);
    console.log('\nP6-3) Safeguard assertions (every death checked against the memo rules)');
    const bad = assertT('  regular', regRuns) + assertT('  casual', casRuns);
    console.log(`\nASSERTIONS ${bad === 0 ? 'PASS' : 'FAIL'}`);
    if (bad) { console.error(`SAFEGUARD VIOLATION: ${bad} death(s) broke a memo rule — see P6-3`); process.exitCode = 2; }   // fail loudly
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
