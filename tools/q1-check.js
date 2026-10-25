// Q1 check: odd jobs (no repeats, 3-5 min gap, mini-chains, parked in battle), T'Ren's threat read, countdown rings,
// the Academy background pick, the story scrapbook, the welcome-back beat. 390x844, 844x390, 1280x800; 0 console errors.
// Usage: node tools/q1-check.js
const { chromium } = require('playwright-core'); const BASE = process.env.BASE || 'http://127.0.0.1:8765/', OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [], fails = [], res = {}, ok = (c, m) => { if (!c) fails.push(m); }, J = JSON.stringify;
  let first = true;
  for (const [w, h] of (process.env.ONE ? [[390, 844]] : [[390, 844], [844, 390], [1280, 800]])) {
    const tag = `${w}x${h}`, c = await br.newContext({ viewport: { width: w, height: h } }), p = await (async () => { await c.addInitScript(() => { window.__TENACITY_SKIP_NAME = true; }); return c.newPage(); })(), R = res[tag] = {};
    p.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); }); p.on('pageerror', e => errs.push(`${tag}: ${e.message}`));
    await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
    await p.evaluate(() => { window.__noSave = true; __T.PACE_RT.idleT = 0; __T.G.prog.milestones.firstRepair = true; });   // bigger wins #10: on a fresh first watch the prompt waits for the first repair
    // ---- #9 the background pick: a fresh save is asked once (after ~3 s of session) ----
    await p.waitForFunction(() => !document.querySelector('#bgPanel').hidden, null, { timeout: 15000 }).catch(() => {});
    R.bgShown = await p.evaluate(() => !document.querySelector('#bgPanel').hidden && document.querySelectorAll('#bgPanel [data-bg]').length);
    R.bgFit = await p.evaluate(() => { const cd = document.querySelector('#bgPanel .card'); return [...document.querySelectorAll('#bgPanel [data-bg]')].every(b => { const r = b.getBoundingClientRect(); return r.height >= 44 && r.right <= innerWidth + 1 && r.left >= -1; }) && cd.scrollWidth <= cd.clientWidth + 1; });
    await p.screenshot({ path: OUT + `q1-specialty-${tag}.png` });
    await p.click('#bgPanel [data-bg="ops"]'); await sleep(200);
    R.bg = await p.evaluate(async () => { const M = await import('/js/mood.js'), BG = await import('/js/background.js'), PG = await import('/js/progression.js'), G = __T.G;
      const o = { picked: G.prog.background, eng: M.skillLvl('lt', 'engineering'), again: BG.pickBackground('tactical'), eng2: M.skillLvl('lt', 'engineering'), tac: M.skillLvl('lt', 'tactical'), closed: document.querySelector('#bgPanel').hidden };
      G.prog.background = 'junk'; PG.clampProg(); o.junk = G.prog.background; G.prog.background = 'athlete'; PG.clampProg(); o.kept = G.prog.background; G.prog.background = 'ops'; return o; });
    ok(R.bgShown >= 5 && R.bgFit && R.bg.picked === 'ops' && R.bg.eng === 2 && R.bg.again === false && R.bg.eng2 === 2 && R.bg.tac === 0 && R.bg.closed && R.bg.junk === 'none' && R.bg.kept === 'athlete', `background ${tag} ` + J([R.bgShown, R.bgFit, R.bg]));
    await p.evaluate(() => document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }));
    // ---- #5 odd jobs + #6 parked in battle (logic once) ----
    if (first) {
      R.jobs = await p.evaluate(async () => { const OJ = await import('/js/oddjobs.js'), PC = await import('/js/pacing.js'), BT = await import('/js/battle.js'), FT = await import('/js/faults.js'), G = __T.G, L = G.lt, j = OJ.J(), o = {};
        G.ship.faults = {}; PC.PACE_RT.sessionT = 1e6; G.sp.ev.active = null; G.sp.battle = null;
        const spawn = () => { j.active = null; j.next = 0; OJ.tickJobs(0.01); return j.active; };
        const keys = []; o.chainAt = []; for (let i = 0; i < 30; i++) { const a = spawn(); if (!a) { keys.push(null); continue; } keys.push(a.chain ? 'chain:' + a.chain.i : a.kind === 'request' ? 'req:' + a.label.split(' with ')[1] : 'con:' + a.label); if (a.chain) o.chainAt.push(j.offers); }
        o.repeats = keys.filter((k, i) => k && keys.slice(Math.max(0, i - 6), i).includes(k) && !k.startsWith('chain:')).length; o.nulls = keys.filter(k => !k).length;
        o.chainsEvery3 = o.chainAt.every(n => n % 3 === 0) && o.chainAt.length >= 8;
        const a = spawn(); a.t = 0; OJ.tickJobs(0.01); o.gap = j.next;
        // a mini-chain end to end
        j.n = 2; j.offers = 2; const c1 = spawn(); o.c1 = c1 && { step: c1.chain && c1.chain.step, who: c1.who };
        const work = a => { L.deck = a.deck; L.node = a.node; L.mode = 'use'; L.lift = false; a.acc = a.need; OJ.tickJobs(0.01); };
        work(c1); const c2 = j.active; o.c2 = c2 && { step: c2.chain && c2.chain.step, who: c2.who, label: c2.label };
        o.pillStep = !!c2; window.__q1c2 = c2;
        // Q1b #2: finish a chain, then the next chain is the 3rd FRESH offer (step 2 doesn't count as an offer)
        { const save = { ...c2 }; work(c2); o.chainDone = !j.active; const seq = []; for (let i = 0; i < 6; i++) { const a = spawn(); seq.push(a && a.chain ? 'C' + a.chain.step : a ? 'j' : '-'); } o.afterChain = seq.join('');
          j.active = c2; Object.assign(c2, save, { acc: 0 }); L.mode = 'idle'; }
        o.chainText = OJ.CHAINS.map(x => x.pay + x.a.thing + x.b.thing).join(' '); o.pron = /\b(she|her|hers|he|him|his)\b/i.test(o.chainText);
        // park in battle
        const t0 = c2.t; BT.startBattle('debug', { enemy: 'galor' }); o.inBattle = !!G.sp.battle; o.dutyJob = FT.dutyItems().some(i => i.kind === 'job');
        OJ.tickJobs(5); o.frozen = c2.t === t0 && j.active === c2;
        return o; });
      await p.evaluate(() => { const e = __T.G.sp.battle.enemies[0]; e.hull = e.max; e.dead = false; }); await sleep(450);   // keep her alive for the read (a debug fight ends fast)
      R.parkPill = await p.evaluate(() => ({ pill: document.querySelector('#alertPill').textContent, threat: document.querySelector('#redThreat').textContent, banner: !document.querySelector('#redBanner').hidden }));
      await p.screenshot({ path: OUT + `q1-threat-galor-${tag}.png` });
      R.threat = await p.evaluate(async () => { const BT = await import('/js/battle.js'), SH = await import('/js/ships.js'), G = __T.G, o = {};
        const rd = (en, al = []) => BT.threatRead({ enemies: en.map((s, i) => SH.makeEnemy(s, i)), allies: [SH.makeAlly('tenacity', 0), ...al.map((s, i) => SH.makeAlly(s, i + 1))] });
        G.ship.hull = 100; G.ship.shields = 64; G.ship.torps = 4;
        const f = rd(['jh_fighter']), g = rd(['galor']), b = rd(['jh_battlecruiser']), g2 = rd(['galor', 'galor']), ga = rd(['galor'], ['fed_saber']);
        o.words = { fighter: f.word, galor: g.word, bc: b.word, g2: g2.word, ga: ga.word }; o.p = [f.p, g.p, b.p, g2.p, ga.p].map(x => +x.toFixed(3)); o.label = g.label; o.g2label = g2.label;
        o.mono = f.p > g.p && g.p > b.p && g2.p < g.p && ga.p > g.p; G.ship.hull = 30; o.hurt = rd(['galor']).p < g.p; G.ship.hull = 100;
        G.sp.battle = null; G.sp.travelPaused = false; return o; });
      R.resume = await p.evaluate(async () => { const OJ = await import('/js/oddjobs.js'), a = OJ.J().active, t0 = a && a.t; OJ.tickJobs(1); return a && a.t < t0; });
      const Jb = R.jobs, T = R.threat;
      ok(Jb.repeats === 0 && Jb.nulls === 0 && Jb.chainsEvery3 && Jb.gap >= 180 && Jb.gap <= 300, 'odd jobs: no repeats in 6, chains every 3rd, 3-5 min gap ' + J(Jb));
      ok(Jb.c1 && Jb.c1.step === 1 && Jb.c2 && Jb.c2.step === 2 && Jb.c2.who === Jb.c1.who && !Jb.pron, 'odd-job mini-chain ' + J([Jb.c1, Jb.c2, Jb.pron]));
      ok(Jb.chainDone && Jb.afterChain === 'jjC1jjC1', 'Q1b #2: after a finished chain the next one is the 3rd fresh offer ' + J([Jb.chainDone, Jb.afterChain]));
      ok(Jb.inBattle && !Jb.dutyJob && Jb.frozen && /^RED ALERT/.test(R.parkPill.pill) && !/ODD JOB/.test(R.parkPill.pill) && R.resume, 'odd job parked in battle, resumes after ' + J([Jb.inBattle, Jb.dutyJob, Jb.frozen, R.parkPill, R.resume]));
      ok(T.mono && T.hurt && T.words.fighter === 'likely' && T.words.galor === 'fair odds' && T.words.bc === 'unlikely' && T.label === 'Galor — fair odds' && /^Galor \+1 — /.test(T.g2label) && R.parkPill.threat.startsWith('Galor — ') && R.parkPill.banner, 'threat read ' + J([T, R.parkPill]));
      // the mini-chain step 2 on the pill (rings too)
      await p.evaluate(() => { const OJ = window.__q1c2; });
      await sleep(400); await p.screenshot({ path: OUT + `q1-minichain-${tag}.png` });
      R.chainPill = await p.evaluate(() => document.querySelector('#alertPill').textContent);
      ok(/ODD JOB 2\/2/.test(R.chainPill), 'mini-chain step on the pill ' + R.chainPill);
    }
    if (!first) {   // the threat read on the banner and the pill at this size
      await p.evaluate(async () => { const BT = await import('/js/battle.js'); __T.G.ship.faults = {}; __T.G.sp.ev.active = null; BT.startBattle('debug', { enemy: 'galor' }); const e = __T.G.sp.battle.enemies[0]; e.hull = e.max; }); await sleep(150);
      R.thr = await p.evaluate(() => ({ pill: document.querySelector('#alertPill').textContent, threat: document.querySelector('#redThreat').textContent, bannerFits: (() => { const b = document.querySelector('#redBanner').getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth; })() }));
      await p.screenshot({ path: OUT + `q1-threat-galor-${tag}.png` });
      await p.evaluate(() => { __T.G.sp.battle = null; __T.G.sp.travelPaused = false; });
      ok(/^RED ALERTGalor\u00a0· (likely|fair odds|a long shot|unlikely)$/.test(R.thr.pill) && R.thr.threat.startsWith('Galor — ') && R.thr.bannerFits, `threat read UI ${tag} ` + J(R.thr));
    }
    // ---- #3 countdown rings: a real 'distress' deck task (the regulator), drained to amber and red ----
    R.rings = await p.evaluate(async () => { const EVM = await import('/js/events.js'), OJ = await import('/js/oddjobs.js'), G = __T.G; OJ.J().active = null; G.ship.faults = {}; G.sp.battle = null; G.sp.ev.active = null;
      const fired = EVM.fireEvent('distress'); const tk = G.sp.ev.active && G.sp.ev.active.task; return { fired, dur: tk && tk.dur, deck: tk && tk.deck }; });
    const ringAt = async f => { await p.evaluate(f => { const tk = __T.G.sp.ev.active.task; tk.t = tk.dur * f; }, f); await sleep(350); return p.evaluate(() => ({ pill: (document.querySelector('#alertPill .pring') || {}).className || null, task: (document.querySelector('#taskPill .pring') || {}).className || null, text: document.querySelector('#alertPill').textContent })); };
    R.rings.ok = await ringAt(0.9); R.rings.amber = await ringAt(0.4); await p.screenshot({ path: OUT + `q1-rings-amber-${tag}.png` }); R.rings.red = await ringAt(0.15); await p.screenshot({ path: OUT + `q1-rings-red-${tag}.png` });
    ok(R.rings.fired && R.rings.dur > 0 && R.rings.ok.pill === 'pring ok' && R.rings.amber.pill === 'pring amber' && R.rings.red.pill === 'pring red' && R.rings.red.task === 'pring red' && /Deck task/.test(R.rings.ok.text), `rings ${tag} ` + J(R.rings));
    await p.evaluate(() => { __T.G.sp.ev.active = null; });
    // ---- #10 the scrapbook ----
    R.scrap = await p.evaluate(async () => { const ST = __T.ST, SB = await import('/js/scrapbook.js'), PG = await import('/js/progression.js'), G = __T.G, rnd = Math.random, o = {};
      G.prog.scrap = []; G.prog.scrapSeeded = false; G.prog.story.seen = { coolant_cascade: 1 };
      ST.closeStory(); ST.forceStory('letter_home'); Math.random = () => 0.01; try { ST.choose('words'); } finally { Math.random = rnd; } ST.closeStory();
      ST.forceStory('mess_hall_feud'); ST.closeStory();   // the X = the safe choice
      const L = ST.scrapbook(); o.n = L.length; o.top = L[0]; o.second = L[1]; o.old = L[L.length - 1];
      for (let i = 0; i < 60; i++) SB.addScrap({ id: 'letter_home', title: 'x', art: 'story_letter', label: 'l', band: 'success', res: 'r', day: 2, sd: 1 }); o.capped = SB.scrapList().length;
      G.prog.scrap.push({ id: '<b>', art: 'javascript:x' }, 5, null); PG.clampProg(); o.hard = G.prog.scrap.length; o.junk = G.prog.scrap.some(e => e.id === '<b>');
      G.prog.scrap = []; G.prog.scrapSeeded = false; ST.forceStory('letter_home'); Math.random = () => 0.01; try { ST.choose('words'); } finally { Math.random = rnd; } ST.closeStory(); ST.forceStory('ferengi_salvage'); ST.closeStory(); ST.scrapbook();
      (await import('/js/ui/hud.js')).openPlog(); return o; });
    await sleep(300); await p.click('#plogPanel [data-pl="scrap"]'); await sleep(900);
    R.scrapUI = await p.evaluate(() => { const im = [...document.querySelectorAll('#plogPanel .scrap img')]; return { rows: document.querySelectorAll('#plogPanel .scrap').length, imgs: im.length, loaded: im.filter(i => i.naturalWidth > 0).length, w: im[0] && Math.round(im[0].getBoundingClientRect().width), fit: document.querySelector('#plogPanel .card').scrollWidth <= document.querySelector('#plogPanel .card').clientWidth + 1 }; });
    await p.screenshot({ path: OUT + `q1-scrapbook-${tag}.png` });
    const S = R.scrap; ok(S.n === 3 && S.top.id === 'mess_hall_feud' && S.top.band === 'safe' && S.second.id === 'letter_home' && S.second.band === 'success' && S.second.label && !/[{}]/.test(S.second.label) && S.second.res && S.old.old && S.old.label === null && S.capped === 40 && S.hard === 40 && !S.junk
      && R.scrapUI.rows >= 3 && R.scrapUI.loaded >= 2 && R.scrapUI.w <= 60 && R.scrapUI.fit, `scrapbook ${tag} ` + J([S, R.scrapUI]));
    await p.evaluate(() => document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }));
    // ---- #8 welcome back: waits under the Shift Report, fires after RESUME DUTY ----
    R.wb = await p.evaluate(async () => { const WB = await import('/js/welcome.js'), G = __T.G, o = {}; G.prog.welcome = null; WB.noteAbsence(3600); o.short = WB.welcomeDue(); WB.noteAbsence(9 * 3600); o.long = WB.welcomeDue();
      __T.PACE_RT.idleT = 0; document.querySelector('#report').hidden = false; return o; });
    await sleep(900); R.wb.under = await p.evaluate(() => ({ card: !document.querySelector('#wbCard').hidden, due: !!(__T.G.prog.welcome && __T.G.prog.welcome.due) }));
    await p.click('#report button[data-close="report"]'); await sleep(900);
    R.wb.after = await p.evaluate(() => { const w = document.querySelector('#wbCard').getBoundingClientRect(), hit = [...document.querySelectorAll('.chipWrap, .sheetBtns, #ltBar, #newsBar')].filter(e => { const r = e.getBoundingClientRect(); return r.height > 0 && r.left < w.right && r.right > w.left && r.top < w.bottom && r.bottom > w.top; }).map(e => e.id || e.className);
      return { card: !document.querySelector('#wbCard').hidden, text: document.querySelector('#wbCard').textContent, due: __T.G.prog.welcome, overlap: hit, inView: w.top >= 0 && w.bottom <= innerHeight && w.left >= 0 && w.right <= innerWidth }; });
    await p.screenshot({ path: OUT + `q1-welcome-${tag}.png` });
    ok(R.wb.short === false && R.wb.long === true && !R.wb.under.card && R.wb.under.due && R.wb.after.card && /WELCOME BACK/.test(R.wb.after.text) && R.wb.after.due === null && !/\b(she|her)\b/i.test(R.wb.after.text) && R.wb.after.overlap.length === 0 && R.wb.after.inView, `welcome ${tag} (Q1b #5: clear of the chip / button rows) ` + J(R.wb));
    // ---- Q1b #3: the red-alert pill + banner with the longest name (a battlecruiser with two wings): the odds word always shows ----
    R.long = await p.evaluate(async () => { const BT = await import('/js/battle.js'), G = __T.G, o = {}; document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); document.querySelector('#wbCard').hidden = true; G.sp.battle = null; G.sp.alert = null; G.ship.faults = {};
      BT.startBattle('debug', { enemies: ['jh_battlecruiser', 'jh_fighter', 'jh_fighter'] }); const B = G.sp.battle; B.enemies.forEach(e => { e.hull = e.max = 1e6; }); document.querySelector('#bcCard').hidden = true;
      await new Promise(r => setTimeout(r, 300)); const fits = (el, box) => { const r = el.getBoundingClientRect(), b = box.getBoundingClientRect(); return r.width > 0 && r.left >= b.left - 0.5 && r.right <= b.right + 0.5; };
      const pill = document.querySelector('#alertPill'), w = pill.querySelector('.ra2 .w'), ban = document.querySelector('#redBanner'), st = document.querySelector('#stage');
      o.pill = pill.textContent; o.word = w && w.textContent; o.wordIn = !!w && fits(w, pill) && w.scrollWidth <= w.clientWidth + 1; const cs = getComputedStyle(pill); o.pillPad = !!w && w.getBoundingClientRect().right <= pill.getBoundingClientRect().right - parseFloat(cs.paddingRight) + 1;
      o.banner = !ban.hidden ? { l: Math.round(ban.getBoundingClientRect().left), r: Math.round(ban.getBoundingClientRect().right), inStage: fits(ban, st), inView: ban.getBoundingClientRect().left >= 0 && ban.getBoundingClientRect().right <= innerWidth, thr: document.querySelector('#redThreat').textContent, thrFull: (() => { const t = document.querySelector('#redThreat'); return t.scrollWidth <= t.clientWidth + 1; })() } : null;
      G.sp.battle = null; G.sp.travelPaused = false; return o; });
    if (tag !== '1280x800') await p.screenshot({ path: OUT + `q1b-pill-bc-${tag}.png` });
    ok(/^RED ALERTJem'Hadar BC \+2\u00a0· /.test(R.long.pill) && /^\u00a0· (a long shot|unlikely|fair odds|likely)$/.test(R.long.word) && R.long.wordIn && R.long.pillPad && (!R.long.banner || (R.long.banner.inView && R.long.banner.inStage)), `Q1b #3 long pill / banner ${tag} ` + J(R.long));
    // ---- Q1b #1 + #6: the Academy prompt steps aside for a red alert and comes back after; a made pick can't be reopened ----
    R.bg1 = await p.evaluate(async () => { const BT = await import('/js/battle.js'), BG = await import('/js/background.js'), PG = await import('/js/progression.js'), G = __T.G, o = {}, panel = document.querySelector('#bgPanel');
      const keep = { bg: G.prog.background, done: G.prog.bgDone }; G.prog.background = null; G.prog.bgDone = false; BG._askAgain(); document.querySelectorAll('.modal').forEach(m => { m.hidden = true; });
      __T.PACE_RT.idleT = 0; __T.PACE_RT.sessionT = 1e6; G.sp.battle = null; G.sp.alert = null; G.sp.lastBattleT = -1e9; G.night.battleTimes = []; G.sp.travel = { dest: 'convoy', t: 10, dur: 600 }; G.sp.location = 'convoy';
      for (let i = 0; i < 40 && panel.hidden; i++) await new Promise(r => setTimeout(r, 100)); o.asked = !panel.hidden;
      o.ret = BT.startBattle('enroute', { enemies: ['galor'] }); await new Promise(r => setTimeout(r, 300)); o.hidden = panel.hidden; const btn = document.querySelector('#raBtn'); o.btnOk = !btn.hidden && !btn.disabled;
      const r = btn.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); o.btnTop = !!top && !!top.closest('#raBtn');
      await new Promise(r => setTimeout(r, 400)); o.notBack = panel.hidden;
      BT.engageAlert('lt'); G.sp.battle.enemies.forEach(e => { e.hull = e.max = 1e6; }); await new Promise(r => setTimeout(r, 400)); o.notInFight = panel.hidden;
      G.sp.battle = null; G.sp.travelPaused = false; for (let i = 0; i < 40 && panel.hidden; i++) await new Promise(r => setTimeout(r, 100)); o.back = !panel.hidden;
      document.querySelector('#bgPanel [data-bg="athlete"]').click(); await new Promise(r => setTimeout(r, 100)); o.done = G.prog.bgDone;
      G.prog.background = null; PG.clampProg(); o.hardBg = G.prog.background; o.again = BG.pickBackground('tactical'); o.due = BG.promptDue();
      G.prog.background = keep.bg; G.prog.bgDone = keep.done; PG.clampProg(); return o; });
    ok(R.bg1.asked && R.bg1.ret === 'held' && R.bg1.hidden && R.bg1.btnOk && R.bg1.btnTop && R.bg1.notBack && R.bg1.notInFight && R.bg1.back && R.bg1.done === true && R.bg1.hardBg === 'none' && R.bg1.again === false && R.bg1.due === false, `Q1b #1/#6 Academy prompt vs red alert ${tag} ` + J(R.bg1));
    if (first) {   // ---- Q1b #4: the scrapbook never duplicates or passes 40 (fresh save, 47 rolls before the first open; an old save seeds once, deduped) ----
      R.sb = await p.evaluate(async () => { const ST = __T.ST, SB = await import('/js/scrapbook.js'), G = __T.G, o = {}, ids = ST.IDS.filter(id => !ST.EV[id].chainOnly);
        document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); G.sp.battle = null; G.sp.alert = null;
        G.prog.scrap = []; G.prog.scrapSeeded = false; G.prog.story.seen = {}; G.prog.story.fight = null;
        for (let i = 0; i < 47; i++) { ST.closeStory(); ST.forceStory(ids[i % ids.length]); ST.closeStory(); G.sp.battle = null; G.sp.alert = null; G.prog.story.fight = null; G.prog.story.chain = null; }
        const L = ST.scrapbook(); o.n = L.length; o.old = L.filter(e => e.old).length;
        G.prog.scrap = [{ id: 'letter_home', title: 'A letter home', art: 'story_letter', label: 'x', band: 'success', res: 'r', day: 1, sd: 1 }]; G.prog.scrapSeeded = false; G.prog.story.seen = { letter_home: 2, coolant_cascade: 1, mess_hall_feud: 1 };
        const L2 = ST.scrapbook(); o.n2 = L2.length; o.ids2 = L2.map(e => e.id + (e.old ? '*' : '')); o.n3 = ST.scrapbook().length; return o; });
      ok(R.sb.n === 40 && R.sb.old === 0 && R.sb.n2 === 3 && R.sb.n3 === 3 && new Set(R.sb.ids2.map(x => x.replace('*', ''))).size === 3, 'Q1b #4 scrapbook dedupe + cap ' + J(R.sb));
    }
    first = false; await c.close();
  }
  await br.close();
  console.log(JSON.stringify(res, null, 1)); console.log('FAILS', fails.length, fails); console.log('ERRORS', errs.length, errs);
  process.exit(fails.length || errs.length ? 1 : 0);   // Q1b-RA: non-zero on any failure
})().catch(e => { console.error(e); process.exit(2); });
