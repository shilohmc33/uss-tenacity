// Red alert batch (a) check: the held alert (hold while present, freeze while away, 30-min break-off, 90 s takeover), the
// Red Alert button + battle view (Engage, multi-ship rows, T'Ren's read, the Lt's station), Engage bypassing calm/gap,
// story fight -> soft alert, reload with a held alert, the gates, odd-job parking. 390x844, 844x390, 1280x800; 0 console errors.
// Usage: node tools/redalert-check.js
const { chromium } = require('playwright-core'); const BASE = process.env.BASE || 'http://127.0.0.1:8765/', OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PREP = () => { window.__noSave = true; const T = __T, G = T.G; T.PACE_RT.idleT = 0; T.PACE_RT.offline = false; T.PACE_RT.sessionT = 1e6;
  G.prog.background = G.prog.background || 'none'; document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); const bp = document.querySelector('#bgPanel'); if (bp) bp.hidden = true;
  G.sp.battle = null; G.sp.alert = null; G.sp.lastBattleT = -1e9; G.night.battleTimes = []; G.sp.ev.active = null; G.ship.faults = {}; G.ship.hull = 100;
  G.sp.travel = { dest: 'convoy', t: 10, dur: 600 }; G.sp.location = 'convoy'; G.sp.travelPaused = false; };
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [], fails = [], res = {}, ok = (c, m) => { if (!c) fails.push(m); }, J = JSON.stringify;
  let first = true;
  for (const [w, h] of [[390, 844], [844, 390], [1280, 800]]) {
    const tag = `${w}x${h}`, c = await br.newContext({ viewport: { width: w, height: h } }), p = await c.newPage(), R = res[tag] = {};
    p.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); }); p.on('pageerror', e => errs.push(`${tag}: ${e.message}`));
    await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
    await p.evaluate(PREP);
    if (first) {
      // ---- logic: hold, gates, parking, freeze, takeover, break-off, calm at roll, engage bypass, story fight ----
      R.L = await p.evaluate(async () => { const BT = await import('/js/battle.js'), PC = await import('/js/pacing.js'), ST = await import('/js/story.js'), EV = await import('/js/events.js'),
          OJ = await import('/js/oddjobs.js'), FT = await import('/js/faults.js'), SH = await import('/js/ships.js'), T = __T, G = T.G, o = {}, last = () => G.log[G.log.length - 1].msg, hasLog = re => G.log.slice(-6).some(e => re.test(e.msg));
        const prep = () => { G.sp.battle = null; G.sp.alert = null; G.sp.lastBattleT = -1e9; G.night.battleTimes = []; G.sp.travelPaused = false; T.PACE_RT.idleT = 0; T.PACE_RT.offline = false; T.PACE_RT.sessionT = 1e6; };
        // an odd job in progress before the alert
        const j = OJ.J(); j.active = null; j.next = 0; OJ.tickJobs(0.01); const job = j.active; o.hadJob = !!job;
        prep(); const s0 = G.stats ? JSON.stringify(G.stats) : '';
        o.ret = BT.startBattle('enroute', { enemies: ['galor'] }); const A = G.sp.alert;
        o.hold = { ret: o.ret, alert: !!A, battle: !!G.sp.battle, paused: G.sp.travelPaused, roster: A && A.enemies, allies: A && A.allies, stamped: G.sp.lastBattleT === G.ship.elapsed, log: /Red alert: your call/.test(last()) };
        // travel pauses: a sim step doesn't move the ship
        const tt = G.sp.travel.t; T.catchUp ? 0 : 0; (await import('/js/sim.js')).stepSim(1); o.travelFrozen = G.sp.travel.t === tt; o.ticked = G.sp.alert && G.sp.alert.t > 0;
        // the gates
        o.gate = ST.gateWhy('leg'); o.second = BT.startBattle('enroute'); o.ev = EV.fireEvent ? EV.fireEvent('distress') : false;
        // odd job parked: no duty item, no ticking, no new offers
        o.dutyJob = FT.dutyItems().some(i => i.kind === 'job'); const jt = job && job.t; OJ.tickJobs(5); o.jobFrozen = job ? job.t === jt : true;
        j.active = null; j.next = 0; OJ.tickJobs(0.01); o.noOffer = !j.active; j.active = job;
        // freeze while away (idle)
        const t0 = G.sp.alert.t; T.PACE_RT.idleT = 1e6; BT.tickAlert(100); o.freeze = { t: G.sp.alert.t === t0, away: G.sp.alert.away };
        T.PACE_RT.idleT = 0; BT.tickAlert(1); o.back = { away: G.sp.alert.away, t: +(G.sp.alert.t - t0).toFixed(2) };
        // takeover at 90 s present
        G.sp.alert.t = 0; BT.tickAlert(89.5); o.at89 = !!G.sp.alert && !G.sp.battle; BT.tickAlert(0.6);
        o.take = { alert: G.sp.alert, battle: !!G.sp.battle, live: G.sp.battle && !G.sp.battle.away, enemies: G.sp.battle && G.sp.battle.enemies.map(e => e.ship), log: hasLog(/^T'Ren: 'Engaging, Lieutenant\. Join us when you can\.'$/) };
        G.sp.battle = null; G.sp.travelPaused = false;
        // the 30-min break-off (away time only; no penalty or reward)
        prep(); BT.startBattle('enroute', { enemies: ['galor'] }); T.PACE_RT.idleT = 1e6; const st = JSON.stringify(G.stats || {}), rep = JSON.stringify(G.prog.rep || null);
        BT.tickAlert(1799); o.at1799 = !!G.sp.alert; BT.tickAlert(2);
        o.brk = { alert: G.sp.alert, battle: !!G.sp.battle, paused: G.sp.travelPaused, log: hasLog(/^Contact lost while you were off watch\.$/), stats: JSON.stringify(G.stats || {}) === st, rep: JSON.stringify(G.prog.rep || null) === rep };
        // offline catch-up freezes then breaks it off too
        prep(); BT.startBattle('enroute', { enemies: ['galor'] }); T.PACE_RT.offline = true; BT.tickAlert(600); o.offFreeze = G.sp.alert && G.sp.alert.t === 0 && G.sp.alert.away === 600; BT.tickAlert(1300); o.offBrk = !G.sp.alert; T.PACE_RT.offline = false;
        // calm/gap at roll: no alert at all; Engage bypasses them
        prep(); T.PACE_RT.sessionT = 0; o.calmRoll = BT.startBattle('enroute'); o.calmNone = !G.sp.alert && !G.sp.battle;
        prep(); BT.startBattle('enroute', { enemies: ['galor'] }); T.PACE_RT.sessionT = 0; G.sp.lastBattleT = G.ship.elapsed; o.blocked = !BT.battleAllowed('enroute');
        BT.engageAlert('lt'); o.bypass = { battle: !!G.sp.battle, alert: G.sp.alert, log: hasLog(/^You call it: 'Engage\.'/) };
        // away/night rolls keep today's rules (no hold)
        prep(); T.PACE_RT.idleT = 1e6; BT.startBattle('enroute', { enemies: ['galor'] }); o.awayRoll = { alert: !!G.sp.alert, battle: !!G.sp.battle };
        // story fight -> soft held alert, never broken off; Engage -> soft fight
        prep(); ST.closeStory(); ST.S().fight = 'story_wreck'; ST.storyTick(); const SA = G.sp.alert;
        o.story = { alert: !!SA, soft: SA && SA.soft, ctx: SA && SA.kind, en: SA && SA.enemies, pend: ST.S().fight, gate: ST.gateWhy('leg') };
        T.PACE_RT.idleT = 1e6; BT.tickAlert(4000); o.story.kept = !!G.sp.alert; T.PACE_RT.idleT = 0; BT.engageAlert('lt'); o.story.softB = G.sp.battle && G.sp.battle.soft;
        // a pending story fight waits behind a held alert (the "alert" gate)
        prep(); BT.startBattle('enroute', { enemies: ['galor'] }); ST.S().fight = 'story_wreck'; ST.storyTick(); o.pendBehind = ST.S().fight === 'story_wreck' && G.sp.alert.kind === 'enroute' && !G.sp.alert.soft; ST.S().fight = null;
        // hardening
        o.hard = [SH.hardenAlert({ alert: { kind: 'x', enemies: ['nope'], allies: ['tenacity'] } }), SH.hardenAlert({ alert: { kind: 'Bad Kind', enemies: ['galor'], allies: ['tenacity'] } }), SH.hardenAlert({ alert: 7 })].map(x => x && x.alert || null);
        prep(); j.active = job; return o; });
      // ---- Q1b-RA #2: the 90 s T'Ren timer still runs under a sheet; Q1b-RA #3: verb agreement for they / he / she crew in every dc line, the odd-job chain and welcome lines ----
      R.agree = await p.evaluate(async () => { const BT = await import('/js/battle.js'), DC = await import('/js/dc.js'), ST = __T.ST, OJ = await import('/js/oddjobs.js'), G = __T.G, o = {};
        G.sp.battle = null; G.sp.alert = null; G.sp.lastBattleT = -1e9; __T.PACE_RT.idleT = 0; __T.PACE_RT.sessionT = 1e6; G.sp.travel = { dest: 'convoy', t: 10, dur: 600 }; G.sp.location = 'convoy'; BT.startBattle('enroute', { enemies: ['galor'] });
        document.body.classList.add('sheet-open', 'sheet-crew'); BT.tickAlert(91); o.took = !!G.sp.battle && !G.sp.alert; document.body.classList.remove('sheet-open', 'sheet-crew'); G.sp.battle = null; G.sp.travelPaused = false;
        const occ = G.prog.crew.occ, want = { they: null, he: null, she: null }; for (const id of Object.keys(occ)) { const pn = occ[id].pronoun; if (pn in want && !want[pn] && id !== 'tren') want[pn] = id; }
        const SUBJ = { they: 'they', he: 'he', she: 'she' }, bad = [], lines = [];
        for (const [pn, id] of Object.entries(want)) { if (!id) { bad.push('no ' + pn + ' crewmate'); continue; } const nm = occ[id].short, sub = SUBJ[pn];
          const texts = []; for (const ch of Object.values(DC.DC)) for (const f of ['risk', 'grisk', 'success', 'partial', 'fail', 'gfail', 'injured', 'unhurt', 'text']) if (ch[f]) texts.push(ST.kit.fill(ch[f], { lead: id }));
          for (const c of OJ.CHAINS) for (const t of [c.pay, c.a.thing, c.b.thing]) texts.push(String(t).replace(/\{short\}/g, nm).replace(/\{addr\}/g, 'Lieutenant'));
          const wsrc = await (await fetch('/js/welcome.js')).text(); for (const m of wsrc.matchAll(/"(\{short\}[^"]*)"/g)) texts.push(m[1].replace(/\{short\}/g, nm).replace(/\{addr\}/g, 'Lieutenant'));
          for (const t of texts) { lines.push(pn + ': ' + t);
            if (/\{\w+\}/.test(t)) bad.push('token left: ' + t);
            if (new RegExp('\\b' + nm + ' (have|are|do|were|stay)\\b').test(t)) bad.push(pn + ' name+plural verb: ' + t);
            if (pn === 'they' && /\bthey (has|is|does|was|stays)\b/i.test(t)) bad.push('they+singular: ' + t);
            if (pn !== 'they' && new RegExp('\\b' + sub + ' (have|are|do|were|stay)\\b', 'i').test(t)) bad.push(pn + '+plural: ' + t); } }
        o.who = want; o.n = lines.length; o.bad = bad; o.sample = lines.filter(l => /forearm|stay/.test(l)); return o; });
      ok(R.agree.took && R.agree.n > 60 && R.agree.bad.length === 0, 'T\'Ren timer under a sheet + verb agreement (they / he / she) ' + J(R.agree));
      const L = R.L;
      ok(L.hold.ret === 'held' && L.hold.alert && !L.hold.battle && L.hold.paused && J(L.hold.roster) === '["galor"]' && J(L.hold.allies) === '[]' && L.hold.stamped && L.hold.log && L.travelFrozen && L.ticked, 'hold while present ' + J([L.hold, L.travelFrozen, L.ticked]));
      ok(L.gate === 'alert' && L.second === false && !L.ev && !L.dutyJob && L.jobFrozen && L.noOffer && L.hadJob, 'gates + odd job parked ' + J([L.gate, L.second, L.ev, L.dutyJob, L.jobFrozen, L.noOffer, L.hadJob]));
      ok(L.freeze.t && L.freeze.away === 100 && L.back.away === 0 && L.back.t === 1, 'freeze while away ' + J([L.freeze, L.back]));
      ok(L.at89 && L.take.alert === null && L.take.battle && L.take.live && J(L.take.enemies) === '["galor"]' && L.take.log, '90 s takeover ' + J([L.at89, L.take]));
      ok(L.at1799 && L.brk.alert === null && !L.brk.battle && !L.brk.paused && L.brk.log && L.brk.stats && L.brk.rep && L.offFreeze && L.offBrk, '30-min break-off ' + J([L.at1799, L.brk, L.offFreeze, L.offBrk]));
      ok(L.calmRoll === false && L.calmNone && L.blocked && L.bypass.battle && L.bypass.alert === null && L.bypass.log, 'calm at roll; Engage bypasses calm/gap ' + J([L.calmRoll, L.calmNone, L.blocked, L.bypass]));
      ok(!L.awayRoll.alert && L.awayRoll.battle, 'away rolls start as today ' + J(L.awayRoll));
      ok(L.story.alert && L.story.soft && L.story.ctx === 'story_wreck' && J(L.story.en) === '["jh_fighter"]' && L.story.pend === null && L.story.gate === 'alert' && L.story.kept && L.story.softB && L.pendBehind, 'story fight -> soft alert ' + J([L.story, L.pendBehind]));
      ok(L.hard.every(x => x === null), 'hardenAlert drops junk ' + J(L.hard));
    }
    // ---- UI: the button, the view (multi-ship), Engage from the view, a modal disables the button ----
    await p.evaluate(async () => { const BT = await import('/js/battle.js'); __T.G.sp.lastBattleT = -1e9; __T.G.sp.battle = null; __T.G.sp.alert = null; __T.PACE_RT.sessionT = 1e6; __T.PACE_RT.idleT = 0; BT.startBattle('enroute', { enemies: ['galor'] }); });
    await sleep(300);
    R.btn = await p.evaluate(() => { const b = document.querySelector('#raBtn'), r = b.getBoundingClientRect(); return { shown: !b.hidden, en: !b.disabled, txt: b.textContent, h: r.height, inView: r.left >= 0 && r.right <= innerWidth, pill: document.querySelector('#alertPill').textContent }; });
    await p.screenshot({ path: OUT + `ra-a-button-${tag}.png` });
    R.modal = await p.evaluate(async () => { const rp = document.querySelector('#report'); rp.hidden = false; await new Promise(r => setTimeout(r, 400)); const b = document.querySelector('#raBtn'), d = b.disabled; b.click(); const opened = !document.querySelector('#raSheet').hidden; rp.hidden = true; await new Promise(r => setTimeout(r, 2500)); return { dis: d, opened, en: !b.disabled }; });   // Q1b-RA #5: a slow headless frame needs ~2.5 s
    // ---- Q1b-RA #2: under each play-mode sheet (ORDERS / DUTY / CREW / LOG) the button, the pill and the banner tap are held and the view never opens ----
    R.sheets = await p.evaluate(async () => { const RA = await import('/js/ui/redalert.js'), BT = await import('/js/battle.js'), G = __T.G, o = {}, wait = ms => new Promise(r => setTimeout(r, ms)), b = document.querySelector('#raBtn'), view = () => !document.querySelector('#raSheet').hidden;
      const info = document.body.classList.contains('mode-info'); if (info) document.querySelector('#btnFull').click(); await wait(300);
      for (const sh of ['orders', 'duty', 'crew', 'log']) { const r = o[sh] = {}; __T.PACE_RT.idleT = 0;
        document.querySelector(`.sheetBtns [data-sheet="${sh}"]`).click(); await wait(600); r.open = document.body.classList.contains('sheet-' + sh);
        r.dis = b.disabled; b.click(); document.querySelector('#alertPill').click(); r.api = RA.openView(); r.viewed = view(); r.t0 = G.sp.alert && G.sp.alert.t;
        document.querySelector('#sheetClose').click(); await wait(2500); r.en = !b.disabled; r.ticked = G.sp.alert && G.sp.alert.t > r.t0; }
      // a sheet opening over an open view closes it
      __T.PACE_RT.idleT = 0; RA.openView(); await wait(200); o.viewFirst = view(); document.querySelector('.sheetBtns [data-sheet="crew"]').click(); await wait(600); o.viewClosed = !view(); document.querySelector('#sheetClose').click(); await wait(300);
      if (info) document.querySelector('#btnWindow').click(); await wait(300); o.info = info; return o; });
    ok(['orders', 'duty', 'crew', 'log'].every(k => { const r = R.sheets[k]; return r.open && r.dis && r.api === false && !r.viewed && r.en && r.ticked; }) && R.sheets.viewFirst && R.sheets.viewClosed, `Red Alert held under the sheets ${tag} ` + J(R.sheets));
    await p.click('#raBtn'); await sleep(250);
    R.view = await p.evaluate(() => { const s = document.querySelector('#raSheet'), cd = s.querySelector('.ra-card').getBoundingClientRect(), go = s.querySelector('[data-ra=engage]'), gr = go && go.getBoundingClientRect();
      return { open: !s.hidden, space: document.body.classList.contains('view-space'), rows: s.querySelectorAll('.ra-row').length, tren: s.querySelector('.ra-tren').textContent, st: s.querySelector('.ra-st').textContent, hook: !!s.querySelector('#raCall'),
        fit: cd.top >= 0 && cd.bottom <= innerHeight + 1 && cd.left >= 0 && cd.right <= innerWidth + 1, goH: gr && gr.height, goIn: gr && gr.bottom <= innerHeight + 1, minFont: Math.min(...[...s.querySelectorAll('.ra-row small,.ra-left,.ra-sec')].map(e => parseFloat(getComputedStyle(e).fontSize))) }; });
    await p.screenshot({ path: OUT + `ra-a-view-${tag}.png` });
    await p.click('#raSheet [data-ra=engage]'); await sleep(250);
    R.eng = await p.evaluate(() => ({ battle: !!__T.G.sp.battle, alert: __T.G.sp.alert, back: (document.querySelector('#raSheet [data-ra=close]') || {}).textContent, btn: document.querySelector('#raBtn').hidden, open: !document.querySelector('#raSheet').hidden }));
    await p.click('#raSheet [data-ra=close]'); await sleep(150);
    R.liveTap = await p.evaluate(async () => { const B = __T.G.sp.battle; if (B) B.enemies.forEach(e => { e.hull = e.max; e.dead = false; }); document.querySelector('#alertPill').click(); await new Promise(r => setTimeout(r, 150)); const o = !document.querySelector('#raSheet').hidden; (await import('/js/ui/redalert.js')).closeView(); return o; });
    // multi-ship: two contacts + a wingman ally
    R.multi = await p.evaluate(async () => { const BT = await import('/js/battle.js'), RA = await import('/js/ui/redalert.js'), G = __T.G; G.sp.battle = null; G.sp.alert = null; G.sp.lastBattleT = -1e9;
      G.sp.alert = { kind: 'enroute', enemies: ['galor', 'jh_fighter'], allies: ['fed_saber'], wing: true, mission: 'none', away: false, soft: false, t: 0, away: 0, at: G.ship.elapsed };
      RA.openView(); await new Promise(r => setTimeout(r, 150)); const s = document.querySelector('#raSheet'), o = { rows: s.querySelectorAll('.ra-row').length, tren: s.querySelector('.ra-tren').textContent }; RA.closeView(); G.sp.alert = null; G.sp.battle = null; G.sp.travelPaused = false; return o; });
    ok(R.btn.shown && R.btn.en && /RED ALERT/.test(R.btn.txt) && /Galor — /.test(R.btn.txt) && R.btn.h >= 44 && R.btn.inView && /^RED ALERT · TAP TO RESPONDGalor\u00a0· /.test(R.btn.pill), `button ${tag} ` + J(R.btn));
    ok(R.modal.dis && !R.modal.opened && R.modal.en, `button held by a modal ${tag} ` + J(R.modal));
    ok(R.view.open && R.view.space && R.view.rows === 2 && /^T'Ren: 'Galor-class\. (Likely|Fair odds|A long shot|Unlikely), Lieutenant\.'$/.test(R.view.tren) && /^Your station/.test(R.view.st) && R.view.hook && R.view.fit && R.view.goH >= 44 && R.view.goIn && R.view.minFont >= 11, `view ${tag} ` + J(R.view));
    ok(R.eng.battle && R.eng.alert === null && /BACK TO THE FIGHT/.test(R.eng.back) && R.eng.btn && R.eng.open && R.liveTap, `Engage from the view ${tag} ` + J([R.eng, R.liveTap]));
    ok(R.multi.rows === 4 && /Galor-class, and 1 more\./.test(R.multi.tren), `multi-ship view ${tag} ` + J(R.multi));
    if (first) {
      // ---- the takeover log shot ----
      await p.evaluate(async () => { const BT = await import('/js/battle.js'), G = __T.G; G.sp.battle = null; G.sp.alert = null; G.sp.lastBattleT = -1e9; BT.startBattle('enroute', { enemies: ['galor'] }); G.sp.alert.t = 89.9; BT.tickAlert(0.2);
        G.sp.battle && G.sp.battle.enemies.forEach(e => { e.hull = e.max; }); });
      await p.click('[data-sheet="log"]').catch(() => {}); await sleep(300);
      R.tlog = await p.evaluate(() => /Engaging, Lieutenant\. Join us when you can\./.test(document.body.innerText));
      await p.screenshot({ path: OUT + `ra-a-takeover-${tag}.png` });
      ok(R.tlog, 'takeover line in the log panel');
      // ---- reload with a held alert: kept, still paused, no reward dodge; T'Ren still takes over ----
      await p.evaluate(async () => { const BT = await import('/js/battle.js'), G = __T.G; document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); (await import('/js/ui/hud.js')).closeSheet();
        G.sp.battle = null; G.sp.alert = null; G.sp.lastBattleT = -1e9; G.sp.travel = { dest: 'convoy', t: 10, dur: 600 }; G.sp.location = 'convoy'; BT.startBattle('enroute', { enemies: ['galor'] }); G.sp.alert.t = 40; window.__noSave = false; __T.saveGame(); window.__noSave = true; });
      await p.goto(BASE); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
      R.reload = await p.evaluate(async () => { window.__noSave = true; const BT = await import('/js/battle.js'), G = __T.G, A = G.sp.alert; const o = { alert: !!A, en: A && A.enemies, t: A && A.t, paused: G.sp.travelPaused, battle: !!G.sp.battle };
        __T.PACE_RT.idleT = 0; __T.PACE_RT.offline = false; BT.tickAlert(51); o.took = !!G.sp.battle && !G.sp.alert; G.sp.battle = null; return o; });
      ok(R.reload.alert && J(R.reload.en) === '["galor"]' && R.reload.t >= 40 && R.reload.paused && !R.reload.battle && R.reload.took, 'reload keeps the held alert ' + J(R.reload));
      await p.evaluate(() => localStorage.clear());
    }
    // ======== RA(b): damage-control calls ========
    await p.evaluate(PREP);
    // ---- RA-a #5: the toasts never sit under the Red Alert button (all 3 sizes) ----
    R.toast = await p.evaluate(async () => { const BT = await import('/js/battle.js'), BUS = await import('/js/bus.js'), G = __T.G; G.sp.lastBattleT = -1e9; BT.startBattle('enroute', { enemies: ['galor'] });
      for (let i = 0; i < 5; i++) BUS.toast('⚠ Test toast number ' + i + ' — long enough to wrap the line', i % 2 ? 'crit' : 'warn');
      await new Promise(r => setTimeout(r, 400)); const b = document.querySelector('#raBtn').getBoundingClientRect(), hit = [];
      for (const box of [[], ['top'], ['side']]) { const tb = document.querySelector('#toasts'); tb.classList.remove('top', 'side'); box.forEach(c => tb.classList.add(c)); await new Promise(r => setTimeout(r, 60));
        for (const t of document.querySelectorAll('#toasts .toast')) { const r = t.getBoundingClientRect(), tr = tb.getBoundingClientRect(), vis = Math.min(r.bottom, tr.bottom) - Math.max(r.top, tr.top) > 1; if (vis && r.left < b.right && r.right > b.left && Math.min(r.bottom, tr.bottom) > b.top && Math.max(r.top, tr.top) < b.bottom) hit.push(box.join('') || 'bottom'); } }
      document.querySelector('#toasts').classList.remove('top', 'side'); return { n: document.querySelectorAll('#toasts .toast').length, hit, shown: !document.querySelector('#raBtn').hidden }; });
    if (tag === '844x390') await p.screenshot({ path: OUT + `ra-b-button-toast-${tag}.png` });
    ok(R.toast.shown && R.toast.n >= 3 && R.toast.hit.length === 0, `toasts clear of the Red Alert button ${tag} ` + J(R.toast));
    // ---- the call card in a live fight the Lt engaged (all 3 sizes): opens at the threshold, holds the fight, fits ----
    await p.evaluate(async () => { const BT = await import('/js/battle.js'), G = __T.G; document.querySelectorAll('#toasts .toast').forEach(t => t.remove()); __T.PACE_RT.idleT = 0; BT.engageAlert('lt');
      const B = G.sp.battle; B.enemies.forEach(e => { e.hull = e.max = 1e5; }); B.startedAt = G.ship.elapsed - 20; G.ship.shields = 50; G.ship.hull = 80; });
    await p.waitForFunction(() => { const m = document.querySelector('#dcCard'); return m && !m.hidden; }, null, { timeout: 5000 }).catch(() => {}); await sleep(700);
    R.card = await p.evaluate(() => { const m = document.querySelector('#dcCard'), w = m.querySelector('.dcwrap').getBoundingClientRect(), bt = [...m.querySelectorAll('.dcc')], fr = m.querySelector('.dcframe'), on = fr.querySelector('img.sl.on'), B = __T.G.sp.battle;
      return { open: !m.hidden, by: B && B.by, n: B && B.dc.n, i: B && B.dc.open && B.dc.open.i, fit: w.top >= -1 && w.left >= -1 && w.bottom <= innerHeight + 1 && w.right <= innerWidth + 1, nb: bt.length,
        bh: Math.min(...bt.map(b => b.getBoundingClientRect().height)), vis: bt.every(b => { const r = b.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top >= 0; }),
        minFont: Math.min(...[...m.querySelectorAll('.dcc b,.dcc small,.dcc em,.dctext')].map(e => parseFloat(getComputedStyle(e).fontSize))), art: fr.dataset.art, src: on && on.getAttribute('src'), noart: m.classList.contains('noart'), lines: bt.map(b => b.querySelector('small').textContent) }; });
    await p.screenshot({ path: OUT + `ra-b-call-${tag}.png` });
    ok(R.card.open && R.card.by === 'lt' && R.card.n === 1 && R.card.i === 1 && R.card.fit && R.card.nb === 4 && R.card.bh >= 44 && R.card.vis && R.card.minFont >= 12 && R.card.art === 'story_dc_core' && /story_dc_core\.webp$/.test(R.card.src) && !R.card.noart
      && /^Engineering \d+ · (likely|fair odds|a long shot|unlikely)/.test(R.card.lines[0]) && /^Fitness \d+ · with \S+/.test(R.card.lines[1]) && /^Composure \d+ · with \S+/.test(R.card.lines[2]) && R.card.lines[3] === 'no roll · safe', `call card ${tag} ` + J(R.card));
    // hover the loader: its picture; choose (success forced): the chosen picture under the outcome
    await p.hover('#dcCard [data-dc=loader]'); await sleep(700);
    R.hov = await p.evaluate(() => document.querySelector('#dcCard .dcframe').dataset.art);
    await p.evaluate(async () => { const DC = await import('/js/dc.js'); DC.choose('eps', false, 0); }); await sleep(800);
    R.out = await p.evaluate(() => { const m = document.querySelector('#dcCard'); return { art: m.querySelector('.dcframe').dataset.art, band: (m.querySelector('.dctext i.band') || {}).textContent, chips: [...m.querySelectorAll('.stchip')].map(c => c.textContent), go: m.querySelector('.dcgo').getBoundingClientRect().height, goIn: m.querySelector('.dcgo').getBoundingClientRect().bottom <= innerHeight + 1 }; });
    if (tag === '1280x800') await p.screenshot({ path: OUT + `ra-b-success-${tag}.png` });
    ok(R.hov === 'story_dc_loader' && R.out.art === 'story_dc_eps' && R.out.band === 'Success.' && R.out.chips.some(c => /shields/.test(c)) && R.out.go >= 44 && R.out.goIn, `hover / outcome art ${tag} ` + J([R.hov, R.out]));
    await p.click('#dcCard [data-dc-close]'); await sleep(200);
    R.closed = await p.evaluate(() => document.querySelector('#dcCard').hidden && !__T.G.sp.battle.dc.open);
    ok(R.closed, `call card closes ${tag}`);
    if (tag === '390x844') {   // a fail outcome shot (the second call, the loader)
      await p.evaluate(async () => { const DC = await import('/js/dc.js'), G = __T.G, B = G.sp.battle; B.startedAt = G.ship.elapsed - 90; G.ship.hull = 30; G.ship.torps = 4; __T.PACE_RT.idleT = 0; DC.tickDC(0.01); DC.choose('loader', false, 0.999); });
      await sleep(800); R.fail = await p.evaluate(() => ({ i: __T.G.sp.battle.dc.open.i, band: document.querySelector('#dcCard .dctext i.band').textContent, art: document.querySelector('#dcCard .dcframe').dataset.art }));
      await p.screenshot({ path: OUT + `ra-b-fail-${tag}.png` });
      ok(R.fail.i === 2 && R.fail.band === 'It goes wrong.' && R.fail.art === 'story_dc_loader', 'second call + fail outcome ' + J(R.fail));
      await p.evaluate(async () => (await import('/js/dc.js')).closeCall());
    }
    if (first) {
      R.DCL = await p.evaluate(async () => { const BT = await import('/js/battle.js'), DC = await import('/js/dc.js'), RA = await import('/js/ui/redalert.js'), FT = await import('/js/faults.js'), MD = await import('/js/injuries.js'), SIM = await import('/js/sim.js'), T = __T, G = T.G, S = G.ship, o = {};
        const clean = () => { if (G.sp.battle && G.sp.battle.dc) G.sp.battle.dc.open = null; G.sp.battle = null; G.sp.alert = null; G.sp.lastBattleT = -1e9; G.night.battleTimes = []; T.PACE_RT.idleT = 0; T.PACE_RT.offline = false; T.PACE_RT.sessionT = 1e6; S.faults = {}; S.hull = 80; S.shields = 50; S.power = 80; S.torps = 4;
          G.sp.travel = { dest: 'convoy', t: 10, dur: 600 }; G.sp.location = 'convoy'; MD.M().inj = []; MD.M().day = { pd: G.prog.playDays, n: 0 }; MD.M().gentle = false; document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); RA.closeView(); };
        const fight = (by = 'lt') => { clean(); BT.startBattle('enroute', { enemies: ['galor'] }); BT.engageAlert(by); const B = G.sp.battle; B.enemies.forEach(e => { e.hull = e.max = 1e5; e.volleyT = 5; }); B.startedAt = S.elapsed - 20; return B; };
        const call = () => { const B = fight(); S.shields = 50; DC.tickDC(0.01); return B; };
        // threshold: not before minT, not above 60%; fires at 60 and pauses the fight; auto-safe after 20 s
        let B = fight(); S.shields = 70; S.hull = 80; DC.tickDC(0.01); o.above = !B.dc || !B.dc.open; S.shields = 50; B.startedAt = S.elapsed - 2; DC.tickDC(0.01); o.early = !B.dc.open; B.startedAt = S.elapsed - 20; DC.tickDC(0.01); o.fired = !!B.dc.open && B.dc.n === 1;
        o.paused = DC.dcPaused(); const v0 = B.enemies[0].volleyT, h0 = B.enemies[0].hull; SIM.stepSim(1); o.held = B.enemies[0].volleyT === v0 && B.enemies[0].hull === h0;
        DC.tickDC(18); o.notYet = !B.dc.open.res; DC.tickDC(1.5); o.auto = B.dc.open.res && { k: B.dc.open.res.k, auto: B.dc.open.res.auto, band: B.dc.open.res.band }; o.unpaused = !DC.dcPaused(); DC.tickDC(20); o.autoClosed = !B.dc.open;
        S.hull = 50; DC.tickDC(1); o.oneOnly = !B.dc.open && B.dc.n === 1;   // one call per threshold; the second needs hull < 35 on a long fight
        // each choice, success (r = 0) and fail (r = 0.999)
        const run = (k, r, prep) => { const b = call(); if (prep) prep(b); const st = { sh: S.shields, tp: S.torps, pw: S.power, cd: b.cd.torp }; const cast = { ...b.dc.open.cast }; if (r === 'mid') r = DC.pOf(k, cast) * 0.8; const res = DC.choose(k, false, r);
          return { b, st, cast, res, band: res.band, chips: res.chips.map(c => c[1]), text: res.text }; };
        let x = run('eps', 0); o.epsS = { band: x.band, d: Math.round(S.shields - x.st.sh), buf: x.b.dc.buf.eps, xp: x.chips.some(c => /XP/.test(c)) }; DC.closeCall(); const s1 = S.shields; DC.tickDC(10); o.epsS.regen = +(S.shields - s1).toFixed(1);
        x = run('eps', 0.999); o.epsF = { band: x.band, fault: S.faults.eps && S.faults.eps.sev, who: x.cast.eps, inj: MD.M().inj.filter(i => i.id === x.cast.eps).map(i => i.sev), chips: x.chips, hullSame: S.hull === 80 };
        x = run('loader', 0, b => { b.cd.torp = 9; }); o.ldS = { band: x.band, cd: x.b.cd.torp, dt: S.torps - x.st.tp };
        x = run('loader', 0.999); o.ldF = { band: x.band, cd: x.b.cd.torp > 0, dt: S.torps - x.st.tp, who: x.cast.loader, inj: MD.M().inj.filter(i => i.id === x.cast.loader).map(i => i.sev), chips: x.chips };
        x = run('core', 0); o.coS = { band: x.band, buf: x.b.dc.buf.core }; const sp = []; for (let i = 0; i < 40; i++) { const id = FT.spawnFault('battle'); sp.push(id); if (id) delete S.faults[id]; } o.coS.noCore = !sp.includes('warpcore');
        x = run('core', 0.999); o.coF = { band: x.band, dp: Math.round(x.st.pw - S.power) };
        x = run('tren', 0); o.tren = { band: x.band, same: S.shields === x.st.sh && S.torps === x.st.tp && S.power === x.st.pw, chips: x.chips.length };
        x = run('eps', 'mid'); o.partial = { band: x.band, buf: !!x.b.dc.buf.eps };
        // gentle: the risk line and a capped fail (no injury, no fault)
        let b = call(); MD.M().gentle = true; o.gRisk = DC.choicesOf().find(c => c.k === 'eps').risk; const gw = b.dc.open.cast.eps; x = { res: DC.choose('eps', false, 0.999) };
        o.gentle = { fault: !!S.faults.eps, inj: MD.M().inj.length, chips: x.res.chips.map(c => c[1]), text: x.res.text, who: gw }; MD.M().gentle = false; DC.closeCall();
        o.risk = DC.choicesOf({ i: 1, cast: call().dc.open.cast }).find(c => c.k === 'eps').risk; DC.closeCall();
        // never destroyed: hull 0 is the tow
        b = fight(); S.shields = 0; S.hull = 3; BT.damageShip(60, 'test hit'); o.tow = { battle: !!G.sp.battle, loc: G.sp.location, hull: S.hull };
        // T'Ren engaged: the call waits for the Lt to open the view
        b = fight('tren'); DC.tickDC(0.01); o.queued = { by: b.by, due: b.dc.due, open: !!b.dc.open }; RA.openView(); o.queued.after = !!b.dc.open && b.dc.open.i === 1 && b.dc.due === null; DC.closeCall(); RA.closeView();
        // an away fight: never a call
        clean(); T.PACE_RT.idleT = 1e6; BT.startBattle('enroute', { enemies: ['galor'] }); b = G.sp.battle; b.enemies.forEach(e => { e.hull = e.max = 1e5; }); b.startedAt = S.elapsed - 90; S.hull = 20; S.shields = 10; DC.tickDC(1); T.PACE_RT.idleT = 0; DC.tickDC(1); RA.openView(); DC.tickDC(1);
        o.away = { live: b.live, dc: b.dc ? [b.dc.n, b.dc.due, !!b.dc.open] : null }; RA.closeView();
        // hardening
        const SH = await import('/js/ships.js'), hz = d => { const q = { dc: d }; SH.hardenDC(q); return q.dc; };
        o.hard = [hz(7), hz({ n: 9, due: 5, open: { i: 1, cast: { eps: '<x>' }, res: { k: 'nuke', band: 'success' } }, buf: { eps: 'yes', core: true } })];
        clean(); return o; });
      const D = R.DCL;
      ok(D.above && D.early && D.fired && D.paused && D.held && D.notYet && D.auto && D.auto.k === 'tren' && D.auto.auto && D.auto.band === 'safe' && D.unpaused && D.autoClosed && D.oneOnly, 'call at the threshold, pause, 20 s auto-safe ' + J(D));
      ok(D.epsS.band === 'success' && D.epsS.d === 25 && D.epsS.buf && D.epsS.xp && D.epsS.regen >= 4.9, 'EPS success ' + J(D.epsS));
      ok(D.epsF.band === 'fail' && D.epsF.fault === 'med' && D.epsF.hullSame && (D.epsF.inj.join() === 'minor' || D.epsF.chips.some(c => /shaken/.test(c))) && !D.epsF.inj.includes('serious'), 'EPS fail ' + J(D.epsF));
      ok(D.ldS.band === 'success' && D.ldS.cd === 0 && D.ldS.dt === 1, 'loader success ' + J(D.ldS));
      ok(D.ldF.band === 'fail' && D.ldF.cd && D.ldF.dt === -1 && (D.ldF.inj.join() === 'minor' || D.ldF.chips.some(c => /shaken/.test(c))), 'loader fail ' + J(D.ldF));
      ok(D.coS.band === 'success' && D.coS.buf && D.coS.noCore && D.coF.band === 'fail' && D.coF.dp === 15 && D.tren.band === 'safe' && D.tren.same && D.tren.chips === 0 && D.partial.band === 'partial' && !D.partial.buf, 'core / T\'Ren / partial ' + J([D.coS, D.coF, D.tren, D.partial]));
      ok(/no harm done/.test(D.gRisk) && !D.gentle.fault && D.gentle.inj === 0 && D.gentle.chips.some(c => /shaken/.test(c)) && /nothing gained/.test(D.gentle.text) && /burns/.test(D.risk), 'gentle wording ' + J([D.gRisk, D.gentle, D.risk]));
      ok(!D.tow.battle && D.tow.loc === 'ds9' && D.tow.hull === 20, 'not destroyable ' + J(D.tow));
      ok(D.queued.by === 'tren' && D.queued.due === 1 && !D.queued.open && D.queued.after, 'queued call (T\'Ren engaged) ' + J(D.queued));
      ok(D.away.live === false && (!D.away.dc || (D.away.dc[0] === 0 && !D.away.dc[1] && !D.away.dc[2])), 'no call in away fights ' + J(D.away));
      ok(D.hard[0].n === 0 && D.hard[0].open === null && D.hard[1].n === 2 && D.hard[1].due === null && D.hard[1].open && !D.hard[1].open.cast.eps && D.hard[1].open.res === null && D.hard[1].buf.eps === false && D.hard[1].buf.core === true, 'hardenDC ' + J(D.hard));
      // ---- reload mid-call: the same call reopens (same cast, no reroll); then it can still be answered ----
      R.pre = await p.evaluate(async () => { const BT = await import('/js/battle.js'), DC = await import('/js/dc.js'), G = __T.G, S = G.ship; G.sp.lastBattleT = -1e9; __T.PACE_RT.idleT = 0; BT.startBattle('enroute', { enemies: ['galor'] }); BT.engageAlert('lt');
        const B = G.sp.battle; B.enemies.forEach(e => { e.hull = e.max = 1e5; }); B.startedAt = S.elapsed - 20; S.shields = 50; DC.tickDC(0.01); B.dc.open.t = 5; window.__noSave = false; __T.saveGame(); window.__noSave = true; return { cast: B.dc.open.cast, n: B.dc.n }; });
      await p.goto(BASE); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(600);
      R.re = await p.evaluate(async () => { window.__noSave = true; const B = __T.G.sp.battle, m = document.querySelector('#dcCard'), o = { battle: !!B, open: B && B.dc && B.dc.open && { i: B.dc.open.i, cast: B.dc.open.cast, res: B.dc.open.res, t: B.dc.open.t }, n: B && B.dc.n, card: m && !m.hidden, paused: (await import('/js/dc.js')).dcPaused() };
        const r = (await import('/js/dc.js')).choose('core', false, 0); o.answered = r && r.band; (await import('/js/dc.js')).closeCall(); __T.G.sp.battle = null; localStorage.clear(); return o; });
      ok(R.re.battle && R.re.open && R.re.open.i === 1 && J(R.re.open.cast) === J(R.pre.cast) && R.re.open.res === null && R.re.open.t >= 5 && R.re.n === 1 && R.re.card && R.re.paused && R.re.answered === 'success', 'reload mid-call ' + J([R.pre, R.re]));
    }
    first = false; await c.close();
  }
  { // art fallback: the manifest lacks the dc pictures -> the card without a picture, no broken image, no console error
    const c = await br.newContext({ viewport: { width: 390, height: 844 } }), p = await c.newPage(), R = res.fallback = {};
    p.on('console', m => { if (m.type() === 'error') errs.push(`fallback: ${m.text()}`); }); p.on('pageerror', e => errs.push(`fallback: ${e.message}`));
    await p.route('**/assets/story/manifest.json', async r => { const resp = await r.fetch(), a = (await resp.json()).filter(k => !/^story_dc_/.test(k)); await r.fulfill({ response: resp, body: JSON.stringify(a) }); });
    await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await p.evaluate(PREP); await sleep(400);
    R.fb = await p.evaluate(async () => { const BT = await import('/js/battle.js'), DC = await import('/js/dc.js'), G = __T.G; BT.startBattle('enroute', { enemies: ['galor'] }); BT.engageAlert('lt'); const B = G.sp.battle; B.enemies.forEach(e => { e.hull = e.max = 1e5; }); B.startedAt = G.ship.elapsed - 20; G.ship.shields = 50; DC.tickDC(0.01);
      await new Promise(r => setTimeout(r, 400)); const m = document.querySelector('#dcCard'), o = { open: !m.hidden, noart: m.classList.contains('noart'), frame: getComputedStyle(m.querySelector('.dcframe')).display, srcs: [...m.querySelectorAll('img')].map(i => i.getAttribute('src')).filter(Boolean) };
      DC.choose('eps', false, 0); await new Promise(r => setTimeout(r, 400)); o.after = { noart: m.classList.contains('noart'), srcs: [...m.querySelectorAll('img')].map(i => i.getAttribute('src')).filter(Boolean) }; return o; });
    // an image that errors (bad bytes): the shown picture stays, or the frame drops; never a broken image
    await p.unroute('**/assets/story/manifest.json');
    ok(R.fb.open && R.fb.noart && R.fb.frame === 'none' && R.fb.srcs.length === 0 && R.fb.after.noart && R.fb.after.srcs.length === 0, 'art fallback (no manifest entry) ' + J(R.fb));
    await c.close();
  }
  { // an image error: the neutral picture fails to decode -> .noart
    const c = await br.newContext({ viewport: { width: 390, height: 844 } }), p = await c.newPage(), R = res.fallback2 = {};
    p.on('pageerror', e => errs.push(`fallback2: ${e.message}`));
    await p.route('**/assets/story/story_dc_*.webp', r => r.fulfill({ status: 200, contentType: 'image/webp', body: 'not an image' }));
    await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await p.evaluate(PREP); await sleep(400);
    R.err = await p.evaluate(async () => { const BT = await import('/js/battle.js'), DC = await import('/js/dc.js'), G = __T.G; BT.startBattle('enroute', { enemies: ['galor'] }); BT.engageAlert('lt'); const B = G.sp.battle; B.enemies.forEach(e => { e.hull = e.max = 1e5; }); B.startedAt = G.ship.elapsed - 20; G.ship.shields = 50; DC.tickDC(0.01);
      await new Promise(r => setTimeout(r, 700)); const m = document.querySelector('#dcCard'); return { open: !m.hidden, noart: m.classList.contains('noart'), err: m.querySelector('.dcframe').dataset.err }; });
    ok(R.err.open && R.err.noart && R.err.err === 'story_dc_core', 'art fallback (image error) ' + J(R.err));
    await c.close();
  }
  await br.close();
  console.log(JSON.stringify(res, null, 1).slice(0, 6000));
  console.log('ERRORS', errs.length, errs.slice(0, 8)); console.log('FAILS', fails.length); fails.forEach(f => console.log(' -', f));
  process.exit(fails.length || errs.length ? 1 : 0);
})();
