// Bigger wins check (notes/2026-10-24-bigger-wins-plan.md, items 7 8 10 11 12): the day-1 pilot (trigger, gate, once only, old-save
// skip), careful choices that carry on (kestrel, echo, vorta_offer, jemhadar_wreck + half-pay follow-ups, the ✕ = stop), nextGoal()
// priority + the 45 s first fault, the 1280 info tabs (saved), the Shift Report headline ranking + quiet fallback (a tow is never a
// win), the DS9 Promenade card (once per visit, working buttons), the v16 -> v17 migration, and 0 console errors / 0 failed or
// 4xx/5xx requests (the plan's new pictures are only ever resolved through assets/story/manifest.json). 390x844, 844x390, 1280x800.
// Usage: node tools/bigwins-check.js   (SHOTS=0 to skip the proof shots)
const { chromium } = require('playwright-core'); const BASE = process.env.BASE || 'http://127.0.0.1:8765/', OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms)), SHOTS = process.env.SHOTS !== '0';
const PREP = () => { window.__noSave = true; const T = __T, G = T.G; T.PACE_RT.idleT = 0; T.PACE_RT.offline = false; T.PACE_RT.sessionT = 1e6;
  G.prog.background = G.prog.background || 'none'; G.prog.bgDone = true; document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); const pc = document.querySelector('#promCard'); if (pc) pc.hidden = true;
  G.sp.battle = null; G.sp.alert = null; G.sp.lastBattleT = -1e9; G.night.battleTimes = []; G.sp.ev.active = null; G.ship.faults = {}; G.ship.hull = 100; if (G.prog.jobs) G.prog.jobs.active = null; };
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [], net = [], newArt = [], fails = [], res = {}, ok = (c, m) => { if (!c) fails.push(m); }, J = JSON.stringify, host = new URL(BASE).host;
  const NEW = /story_(firstwatch|report_|promenade)|_c3\.webp/;
  let first = true;
  for (const [w, h] of [[390, 844], [844, 390], [1280, 800]]) {
    const tag = `${w}x${h}`, c = await br.newContext({ viewport: { width: w, height: h } }), p = await c.newPage(), R = res[tag] = {};
    p.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); }); p.on('pageerror', e => errs.push(`${tag}: ${e.message}`));
    p.on('response', r => { if (r.status() >= 400) net.push(`${tag}: ${r.status()} ${r.url()}`); });
    p.on('requestfailed', r => { if (new URL(r.url()).host === host) net.push(`${tag}: failed ${r.url()} ${r.failure() && r.failure().errorText}`); });
    p.on('request', r => { if (NEW.test(r.url())) newArt.push(`${tag}: ${r.url()}`); });
    const boot = async (q = '?reset=1') => { await p.goto(BASE + q); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await p.evaluate(PREP); };
    await boot();
    if (first) {
      // ---- 7. the pilot: trigger, gates, once only, no day-cap count, not in any pool ----
      R.pilot = await p.evaluate(async () => { const ST = __T.ST, T = __T, G = T.G, PC = await import('/js/pacing.js'), o = {}, s = ST.S();
        o.fresh = { ...s.pilot }; o.inPool = ST.poolFor('leg').concat(ST.poolFor('dock')).includes('first_watch');
        s.pilot.t = 0; s.pilot.repairT = -1; G.prog.milestones.firstRepair = false; ST.pilotTick(899); o.noRepair = !ST.storyOpen() && s.pilot.repairT === -1;   // 899 present s, no repair: waits
        G.prog.milestones.firstRepair = true; s.pilot.t = 500; ST.pilotTick(0); o.stamp = s.pilot.repairT;   // fix 2: the first repair at t=500 stamps repairT
        s.pilot.t = 950; ST.pilotTick(0); o.notFromStart = !ST.storyOpen();   // 950 s since the start but 450 since the repair: waits
        s.pilot.t = 500 + 898; ST.pilotTick(1); o.at899 = !ST.storyOpen();
        // the gates: Shift Report, a sheet, a red alert
        document.querySelector('#report').hidden = false; o.gReport = ST.gateWhy('pilot'); ST.pilotTick(5); o.heldReport = !ST.storyOpen(); document.querySelector('#report').hidden = true;
        document.body.classList.add('sheet-open', 'sheet-duty'); o.gSheet = ST.gateWhy('pilot'); document.body.classList.remove('sheet-open', 'sheet-duty');
        G.sp.alert = { t: 0, enemies: ['galor'] }; o.gAlert = ST.gateWhy('pilot'); G.sp.alert = null;
        o.gLegDay1 = ST.gateWhy('leg');   // a normal story is still held by the grace days
        const dc0 = JSON.stringify(s.dayCount), ls0 = s.legsSince; s.legsSince = 5;
        ST.pilotTick(1); const cu = ST.current(); o.fired = { open: ST.storyOpen(), id: cu && cu.id, where: cu && cu.where, done: s.pilot.done, dayCount: JSON.stringify(s.dayCount) === dc0, legsSince: s.legsSince, steps: ST.stepsOf('first_watch') };
        o.choices = ST.choicesOf().map(c => [c.k, c.n, c.safe ? (c.careful ? 'careful' : 'safe') : c.bonus ? 'bonus' : 'roll', c.sub]);
        o.art = ST.artOf(); return o; });
      R.pilotUI = await p.evaluate(() => { const m = document.querySelector('#storyScene'), im = [...m.querySelectorAll('img.sl')].map(i => i.getAttribute('src')); return { shown: !m.hidden, noart: m.classList.contains('noart'), imgs: im, x: m.querySelector('.storyx').title }; });
      if (SHOTS) await p.screenshot({ path: OUT + `bw-pilot-step-${tag}.png` });
      // the careful thread through all three steps
      R.pilotCareful = await p.evaluate(() => { const ST = __T.ST, o = [], s = ST.S();
        for (const k of ['plans', 'isolate', 'report']) { const r = ST.choose(k); o.push({ k, band: r.band, next: r.next, xp: r.chips.map(c => c[1]).join(','), word: r.word }); if (r.next != null) { ST.next(); o.push({ line: /schematics|write-up is already/.test(ST.current().text) }); } }
        ST.closeStory(); const sc = ST.scrapbook().slice(0, 3).map(e => e.band); s.pilot.t = 1e5; ST.pilotTick(1); return { steps: o, scrap: sc, again: ST.storyOpen(), done: s.pilot.done, nCareful: s.n.careful }; });
      // the no-repair fallback (a separate fresh flag)
      // fix 4: the pilot's rolled choices get a floor (pilot only); every other story's p is the unchanged formula
      R.pilotOdds = await p.evaluate(async () => { const ST = __T.ST, G = __T.G, PC = await import('/js/pacing.js'), O = PC.STORY.odds, o = { rows: [], other: { n: 0, diff: [] } };
        const formula = (sk, op, tier) => Math.min(O.max, Math.max(O.min, O.base + O.skill * sk + O.rel * op / 100 + (tier === 'friend' ? O.friend : tier === 'rival' ? O.rival : tier === 'partner' ? O.partner : 0)));
        o.formulaSame = [[0, 0, null], [2, 0, null], [5, 50, 'friend'], [3, -40, 'rival'], [10, 100, 'partner']].every(([a, b, t]) => Math.abs(ST.oddsP(a, b, t) - formula(a, b, t)) < 1e-12);
        const lead = Object.keys(G.prog.opinion || {})[0] || 'okafor', E = ST.EV.first_watch;
        E.nodes.forEach((N, ni) => N.choices.filter(ch => !ch.safe).forEach(ch => { for (const sk of [0, 1, 2]) { const before = formula(sk, 0, null), after = ST.pilotP(before), w = ST.storyOdds(after); o.rows.push({ step: ni + 1, k: ch.k, sk, before: +before.toFixed(3), beforeWord: ST.storyOdds(before).word, after: +after.toFixed(3), word: w.word, full: +w.full.toFixed(3) }); } }));
        const cFw = { id: 'first_watch', cast: { lead }, tier: null }; o.live = E.nodes.flatMap(N => N.choices.filter(ch => !ch.safe).map(ch => +ST.choiceP(cFw, ch).toFixed(3)));
        const opinionOf = (await import('/js/progression.js')).opinionOf, opL = Math.max(-100, Math.min(100, opinionOf(lead) || 0));
        for (const id of ST.IDS.filter(id => !ST.EV[id].pilot)) { const Ev = ST.EV[id]; for (const N of (Ev.nodes || [Ev])) for (const ch of (N.choices || [])) { if (ch.safe) continue; o.other.n++;
          const sk = ST.ltSkill(ch.help ? 'composure' : ch.skill), exp = ch.help ? formula(sk, opL, null) : formula(sk, 0, null), got = ST.choiceP({ id, cast: { lead }, tier: null }, ch);
          if (Math.abs(got - exp) > 1e-12) o.other.diff.push([id, ch.k, got, exp]); } }
        return o; });
      R.pilotFallback = await p.evaluate(() => { const ST = __T.ST, G = __T.G, s = ST.S(); s.pilot = { t: 1799, done: false }; G.prog.milestones.firstRepair = false; ST.pilotTick(0.5); const a = ST.storyOpen(); ST.pilotTick(1); const b = ST.storyOpen() && ST.current().id; ST.closeStory(); return { at17995: a, at1800: b, done: s.pilot.done }; });
      R.pilot.harden = await p.evaluate(async () => { const ST = __T.ST, G = __T.G, PG = await import('/js/progression.js'), keep = JSON.stringify(ST.S()), keepR = G.prog.milestones.firstRepair, h = [];   // fix 2: harden repairT on load
        ST.S().pilot = { t: 300.7, done: false }; G.prog.milestones.firstRepair = true; PG.clampProg(); h.push(ST.S().pilot.repairT);   // missing + a repair made: starts now (300)
        ST.S().pilot = { t: 200, done: false, repairT: 'x' }; G.prog.milestones.firstRepair = false; PG.clampProg(); h.push(ST.S().pilot.repairT);   // junk, no repair: -1
        ST.S().pilot = { t: 200, done: false, repairT: 999 }; G.prog.milestones.firstRepair = true; PG.clampProg(); h.push(ST.S().pilot.repairT);   // never after t
        G.prog.story = JSON.parse(keep); G.prog.milestones.firstRepair = keepR; PG.clampProg(); return h; });
      // ---- 8. careful choices carry on; the ✕ stops; follow-ups pay half ----
      R.careful = await p.evaluate(() => { const ST = __T.ST, G = __T.G, s = ST.S(), o = {}, withR = (r, f) => { const m = Math.random; Math.random = () => r; try { return f(); } finally { Math.random = m; } };
        const run = (id, ks) => { s.chain = null; ST.closeStory(); ST.forceStory(id); const out = []; for (const k of ks) { const r = ST.choose(k); out.push(r.band + (r.next != null ? '>' + r.next : '') + (r.chips.some(c => /rep/.test(c[1])) ? '+rep' : '') + (r.chips.some(c => /XP/.test(c[1])) ? '+xp' : '')); if (r.next != null) { ST.next(); out.push(ST.current().text.length > 0 ? 'step' + (ST.current().node + 1) : '?'); } } ST.closeStory(); return { out, chain: s.chain && s.chain.id, careful: !!(s.chain && s.chain.ctx.careful) }; };
        o.kestrel = run('kestrel_derelict', ['scan', 'tow', 'hold']); o.echo = run('subspace_echo', ['log', 'leave']); o.vorta = run('vorta_offer', ['refuse']); o.jem = run('jemhadar_wreck', ['beacon']);
        // the careful line on the next step
        s.chain = null; ST.forceStory('kestrel_derelict'); ST.choose('scan'); ST.next(); o.line2 = /frost on the hold door has had longer/.test(ST.current().text); ST.closeStory(); o.stopAfterOutcome = { step: s.step, chain: s.chain && s.chain.id };
        // the ✕ = stop here (today's safe ending): no chain, no careful band
        s.chain = null; ST.forceStory('kestrel_derelict'); o.xLabelCareful = ST.hasCareful(); ST.closeStory(); o.stop = { chain: s.chain, last: ST.scrapbook()[0].band };
        s.chain = null; ST.forceStory('vorta_offer'); ST.closeStory(); o.stopVorta = s.chain;
        // half pay: the same follow-up success with and without the careful flag (XP + rep chips)
        const pay = careful => { s.chain = null; ST.setChain('kestrel_thanks', { lead: null, careful }); s.chain.legs = 9; ST.startStory('kestrel_thanks', { where: 'dock', chain: true }); const c = ST.current(), half = c.half, line = /Mehra remembers the ship/.test(c.text); const r = withR(0.001, () => ST.choose('petition')); ST.closeStory(); const n = re => { const x = r.chips.find(z => re.test(z[1])); return x ? +x[1].match(/\d+/)[0] : 0; }; return { half, line, band: r.band, xp: n(/XP$/), rep: n(/rep$/) }; };
        o.full = pay(false); o.half = pay(true);
        // careful XP is ~40 % of the rolled success XP, with no rep
        s.chain = null; ST.forceStory('subspace_echo'); const fx = ST.carefulFx(ST.nodeOf()); ST.closeStory(); o.carefulXp = fx;
        return o; });
      // careful-continue proof shot (outcome card of a careful pick)
      await p.evaluate(() => { const ST = __T.ST; ST.S().chain = null; ST.forceStory('kestrel_derelict'); ST.choose('scan'); __T.ST.storyUI.show(ST.current()); });
      await sleep(500); if (SHOTS) await p.screenshot({ path: OUT + `bw-careful-continue-${tag}.png` }); R.carefulUI = await p.evaluate(() => { const m = document.querySelector('#storyScene'); return { band: (m.querySelector('.band') || {}).textContent, cont: !!m.querySelector('[data-story-continue]'), img: m.querySelector('.storyframe').dataset.art }; });
      await p.evaluate(() => __T.ST.closeStory());
      // ---- 10. nextGoal priority; the 45 s first fault on a fresh save ----
      R.goal = await p.evaluate(async () => { const NX = await import('/js/ui/next.js'), SS = await import('/js/state.js'), FT = await import('/js/faults.js'), OJ = await import('/js/oddjobs.js'), BD = await import('/js/boards.js'), T = __T, G = T.G, o = {}, k = () => NX.nextGoal().k;
        o.freshFault = SS.freshState().ship.nextFault; o.ver = SS.SAVE_VERSION;
        G.prog.milestones.firstRepair = false; G.prog.playDays = 0; G.sp.promSeen = false; o.first = k(); await new Promise(r => setTimeout(r, 250)); o.pillFirst = document.querySelector('#alertPill').textContent;
        G.sp.alert = { t: 0, enemies: ['galor'] }; FT.spawnFault('ambient'); o.alertOverFault = k(); G.sp.alert = null;
        o.fault = k(); await new Promise(r => setTimeout(r, 250)); o.pillFault = document.querySelector('#alertPill').textContent; G.ship.faults = {};
        const j = OJ.J(); j.active = null; j.next = 0; OJ.tickJobs(0.01); o.job = j.active ? k() : 'no job offered'; j.active = null;
        const ch = Object.keys(BD.CHAIR || {})[0]; G.prog.board = ch ? { chair: ch } : { chair: 'tren' }; o.board = k(); G.prog.board = null;
        const lv = G.prog.level, sp = G.prog.specPicks; G.prog.level = 10; G.prog.specPicks = 0; o.spec = BD.specPending() > 0 ? k() : 'no spec owed'; G.prog.level = lv; G.prog.specPicks = sp;
        o.firstAgain = k(); G.prog.milestones.firstRepair = true; o.after = k();
        G.sp.location = 'ds9'; G.sp.travel = null; G.sp.promSeen = true; o.ds9 = k(); G.sp.promSeen = false;
        document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); return o; });
      // the strip proof shot (the first-watch goal)
      await p.evaluate(() => { const G = __T.G; G.prog.milestones.firstRepair = false; G.prog.playDays = 0; G.ship.faults = {}; G.ship.nextFault = 1e6; if (G.prog.jobs) { G.prog.jobs.active = null; G.prog.jobs.next = 1e9; } G.sp.ev.active = null; }); await sleep(400);
      R.stripText = await p.evaluate(() => document.querySelector('#alertPill').textContent);
      if (SHOTS) await p.screenshot({ path: OUT + `bw-strip-${tag}.png` });
      R.stripFit = await p.evaluate(() => { const r = document.querySelector('#alertPill').getBoundingClientRect(), g = document.querySelector('#alertPill .g1'); return { h: Math.round(r.height), inView: r.right <= innerWidth + 1 && r.left >= -1, lines: g ? Math.round(g.getBoundingClientRect().height / parseFloat(getComputedStyle(g).lineHeight || 16)) : 0 }; });
      await p.evaluate(() => { __T.G.prog.milestones.firstRepair = true; });
      // ---- 11. the Shift Report headline: ranking, a tow is never a win, the quiet fallback ----
      R.moments = await p.evaluate(async () => { const MO = await import('/js/moments.js'), BT = await import('/js/battle.js'), T = __T, G = T.G, o = {};
        G.prog.moments = []; MO.markReported(); G.ship.elapsed += 1; const best = () => (MO.bestMoment() || { k: 'quiet' }).k;
        o.none = best();
        MO.pushMoment('arrival', 'x'); o.a = best(); MO.pushMoment('levelup', 'x'); o.b = best(); MO.pushMoment('win', 'one', { n: 1 }); o.c = best(); MO.pushMoment('rescue', 'x'); o.d = best();
        MO.pushMoment('story', 'x'); o.e = best(); MO.pushMoment('promo', 'x'); o.f = best(); MO.pushMoment('bc', 'x'); o.g = best();
        // more enemies win the tie
        G.prog.moments = []; MO.pushMoment('win', 'one', { n: 1 }); MO.pushMoment('win', 'three', { n: 3 }); MO.pushMoment('win', 'two', { n: 2 }); o.tie = MO.bestMoment().txt;
        // a real won fight pushes a moment; a tow does not
        G.prog.moments = []; T.PACE_RT.sessionT = 1e6; G.sp.lastBattleT = -1e9; G.night.battleTimes = []; G.sp.travel = { dest: 'convoy', t: 10, dur: 600 }; G.sp.location = 'convoy';
        BT.startBattle('enroute', { enemies: ['galor'] }); BT.engageAlert('lt'); const B = G.sp.battle; o.battle = !!B;
        if (B) { B.enemies.forEach(e => { e.hull = 0; e.dead = true; e.dying = 0.01; }); B.dying = 0.05; for (let i = 0; i < 5 && G.sp.battle; i++) BT.tickBattle(0.1); }
        o.winMoment = MO.moments().map(m => m.k + ':' + m.txt);
        G.prog.moments = []; G.sp.lastBattleT = -1e9; G.night.battleTimes = []; G.sp.travel = { dest: 'convoy', t: 10, dur: 600 };
        BT.startBattle('enroute', { enemies: ['galor'] }); BT.engageAlert('lt'); o.towBattle = !!G.sp.battle; if (G.sp.battle) BT.towToDS9(); o.towMoments = MO.moments().length; o.towBest = (MO.bestMoment() || { k: 'quiet' }).k;
        G.sp.battle = null; G.sp.alert = null; return o; });
      // render: a headline, then the quiet fallback, in the real report
      R.report = await p.evaluate(async () => { const MO = await import('/js/moments.js'), HUD = await import('/js/ui/hud.js'), SIM = await import('/js/sim.js'), ART = await import('/js/ui/story.js'), T = __T, G = T.G, o = {};
        await ART.artReady();
        const r = SIM.catchUp(120); G.prog.moments = []; MO.markReported(); G.ship.elapsed += 1;
        MO.pushMoment('win', "You beat off a Cardassian Galor at 64% hull", { n: 1 }); MO.pushMoment('rescue', 'You escorted six hundred Bajoran colonists clear');
        HUD.showReport(r); await new Promise(z => setTimeout(z, 200));
        const hd = () => { const e = document.querySelector('#reportBody .rhead'); const im = e && e.querySelector('img'); return e ? { mk: e.dataset.mk, tag: e.querySelector('small').textContent, txt: e.querySelector('b').textContent, img: im ? im.getAttribute('src') : null, first: document.querySelector('#reportBody').firstElementChild === e || document.querySelector('#reportBody').firstElementChild.classList.contains('bcHead') } : null; };
        o.head = hd(); o.reportT = G.prog.reportT;
        document.querySelector('#report').hidden = true; HUD.showReport(r); await new Promise(z => setTimeout(z, 200)); o.quiet = hd();
        o.manifestOk = [o.head && o.head.img, o.quiet && o.quiet.img].filter(Boolean).every(src => ART.hasArt(src.replace(/^assets\/story\//, '').replace(/\.webp$/, '')));
        document.querySelector('#report').hidden = true; return o; });
      // ---- 12. the Promenade card: once per visit, the four buttons ----
      R.prom = await p.evaluate(async () => { const VY = await import('/js/voyage.js'), CC = await import('/js/crewcare.js'), PM = await import('/js/ui/promenade.js'), NX = await import('/js/ui/next.js'), HUD = await import('/js/ui/hud.js'), T = __T, G = T.G, o = {}, wait = ms => new Promise(z => setTimeout(z, ms)), card = () => document.querySelector('#promCard'), vis = () => !!card() && !card().hidden;
        document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); G.sp.battle = null; G.sp.alert = null; G.prog.rations = 444; G.ship.faults = {}; G.ship.nextFault = 1e6; if (G.prog.jobs) { G.prog.jobs.active = null; G.prog.jobs.next = 1e9; } G.sp.ev.active = null;
        G.sp.location = 'convoy'; G.sp.travel = { dest: 'ds9', t: 599, dur: 600 }; CC.tickCare(); VY.arriveAtDest(); o.due = G.sp.promDue; HUD.updateHud(); await wait(100);
        o.shown = vis(); o.seen = G.sp.promSeen; o.rows = [...card().querySelectorAll('[data-prom]')].map(b => b.dataset.prom + (b.disabled ? '(off)' : '')); o.line = card().querySelector('.pcl').textContent;
        o.goalWhileOpen = NX.nextGoal().k;
        card().querySelector('[data-prom="gifts"]').click(); await wait(80); o.gifts = { card: vis(), plog: !document.querySelector('#plogPanel').hidden, h3: (document.querySelector('#plogBody h3') || document.querySelector('#plogPanel h3') || {}).textContent };
        document.querySelector('#plogPanel').hidden = true; HUD.updateHud(); await wait(50); o.onceHidden = !vis(); o.goalAfter = NX.nextGoal().k;
        document.querySelector('#alertPill').click(); await wait(80); o.reopen = vis();
        card().querySelector('[data-prom="holo"]').click(); await wait(80); o.holo = { card: vis(), panel: !document.querySelector('#holoPanel').hidden }; document.querySelector('#holoPanel').hidden = true;
        PM.openProm(); const sh0 = CC.C().shoreUsed; G.sp.rep = Math.max(G.sp.rep, 100); PM.openProm(); card().querySelector('[data-prom="shore"]').click(); await wait(80);
        o.shore = { before: sh0, used: CC.C().shoreUsed, card: vis(), off: card().querySelector('[data-prom="shore"]').disabled };
        const al = (G.prog.alumni || []).length, lb = card().querySelector('[data-prom="letters"]'); o.letters = { alumni: al, disabled: lb.disabled, sub: lb.querySelector('small').textContent };
        PM.promHooks.letters(); await wait(50); o.letters.plog = !document.querySelector('#plogPanel').hidden; document.querySelector('#plogPanel').hidden = true;
        // once per visit; a new visit shows it again
        PM.hideProm(); HUD.updateHud(); await wait(50); o.stayHidden = !vis();
        G.sp.travel = { dest: 'convoy', t: 0, dur: 600 }; CC.tickCare(); o.leave = { due: G.sp.promDue, seen: G.sp.promSeen };
        G.sp.travel = { dest: 'ds9', t: 599, dur: 600 }; VY.arriveAtDest(); HUD.updateHud(); await wait(80); o.again = vis();
        // held behind a modal (the Shift Report)
        PM.hideProm(); G.sp.promSeen = false; G.sp.promDue = true; document.querySelector('#report').hidden = false; HUD.updateHud(); await wait(50); o.heldByReport = !vis(); document.querySelector('#report').hidden = true; HUD.updateHud(); await wait(50); o.afterReport = vis();
        return o; });
      first = false;
      // ---- v16 -> v17 migration (old save skips the pilot; new fields default) ----
      R.mig = {};
      for (const [name, pd, seen] of [['veteran', 3, false], ['seenStory', 0, true], ['newbie', 0, false]]) {
        await p.evaluate(([pd, seen]) => { const SS = __T.G; window.__noSave = false; __T.saveGame(); window.__noSave = true; const k = 'tenacity.save.v1', d = JSON.parse(localStorage.getItem(k)); d.version = 16; d.prog.playDays = pd; d.prog.milestones = { ...(d.prog.milestones || {}), firstRepair: true };
          if (d.prog.story) { delete d.prog.story.pilot; d.prog.story.seen = seen ? { letter_home: 1 } : {}; } delete d.prog.moments; delete d.prog.reportT; delete d.prog.ui; if (d.sp) { delete d.sp.promDue; delete d.sp.promSeen; } localStorage.setItem(k, JSON.stringify(d)); }, [pd, seen]);
        await boot('');
        R.mig[name] = await p.evaluate(() => { const G = __T.G; return { v: G.version, pilot: G.prog.story.pilot, moments: Array.isArray(G.prog.moments) && G.prog.moments.length === 0, reportT: G.prog.reportT, tab: G.prog.ui && G.prog.ui.tab, prom: [G.sp.promDue, G.sp.promSeen] }; });
      }
    }
    // ---- per size: the info tabs (1280), the card fit, shots ----
    // ---- fix 1: the strip at every size: two lines, >= 44 px, the first-watch copy whole, every fault keeps its system name ----
    await boot();
    const SETW = fw => p.evaluate(fw => { const G = __T.G; __T.app.paused = false; G.prog.milestones.firstRepair = !fw; G.prog.playDays = 0; G.ship.faults = {}; G.ship.nextFault = 1e6; if (G.prog.jobs) { G.prog.jobs.active = null; G.prog.jobs.next = 1e9; } G.sp.ev.active = null; G.sp.alert = null; document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); }, fw);
    const PILLR = () => p.evaluate(() => { const pl = document.querySelector('#alertPill'), g = pl.querySelector('.g1'), nm = pl.querySelector('.nm'), r = pl.getBoundingClientRect();
      const gr = g ? g.getBoundingClientRect() : null, nr = nm ? nm.getBoundingClientRect() : null, lh = g ? parseFloat(getComputedStyle(g).lineHeight) || 15 : 15;
      return { text: pl.textContent, h: Math.round(r.height), inView: r.right <= innerWidth + 1 && r.left >= -1, clipped: g ? g.scrollHeight > g.clientHeight + 1 : true, lines: gr ? Math.round(gr.height / lh) : 0,
        nm: nm ? { vis: nr.width > 0 && nr.bottom <= gr.bottom + 1 && nr.right <= gr.right + 1, txt: nm.textContent } : null, novb: pl.classList.contains('novb'), nosv: pl.classList.contains('nosv') }; });
    await SETW(true); await sleep(400); R.strip2 = { first: await PILLR() };
    if (SHOTS && w !== 1280) await p.screenshot({ path: OUT + `bw-strip-first-${tag}.png` });
    const sysIds = await p.evaluate(async () => Object.keys((await import('/js/data.js')).SYSTEMS));
    R.strip2.faults = {};
    for (const fw of [true, false]) {
      await SETW(fw);
      for (const id of sysIds) { await p.evaluate(id => { const G = __T.G; G.ship.faults = { [id]: { t: 0, sev: 'med', cost: 1, escT: 0 } }; }, id); await sleep(180); const r = await PILLR(); R.strip2.faults[(fw ? 'fw:' : '') + id] = r;
        if (id === 'shields' && fw && SHOTS && w !== 1280) await p.screenshot({ path: OUT + `bw-strip-fault-${tag}.png` }); }
    }
    // a very narrow strip (forced): the verb goes first, then the severity, and the name stays
    await SETW(true); await p.evaluate(() => { const pl = document.querySelector('#alertPill'); pl.style.flex = '0 0 96px'; pl.style.maxWidth = '96px'; __T.G.ship.faults = { shields: { t: 0, sev: 'crit', cost: 1, escT: 0 } }; }); await sleep(300);
    R.strip2.narrow = await PILLR(); await p.evaluate(() => { const pl = document.querySelector('#alertPill'); pl.style.flex = ''; pl.style.maxWidth = ''; });
    await SETW(false);
    if (w === 1280) {
      await boot();
      R.tabs = await p.evaluate(async () => { const o = {}, vis = s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0; };
        o.mode = document.body.classList.contains('mode-info'); o.bar = vis('#infoTabs'); o.def = { orders: vis('#p-orders'), chips: vis('#p-chips'), duty: vis('#p-duty'), log: vis('#p-log') };
        document.querySelector('#infoTabs [data-itab="duty"]').click(); await new Promise(z => setTimeout(z, 100));
        o.duty = { cls: document.body.classList.contains('itab-duty'), duty: vis('#p-duty'), orders: vis('#p-orders'), saved: __T.G.prog.ui.tab, on: document.querySelector('#infoTabs .on').dataset.itab };
        o.btnH = Math.min(...[...document.querySelectorAll('#infoTabs button')].map(b => b.getBoundingClientRect().height));
        window.__noSave = false; __T.saveGame(); return o; });
      if (SHOTS) await p.screenshot({ path: OUT + `bw-tabs-${tag}.png` });
      await boot('');
      R.tabsReload = await p.evaluate(() => ({ tab: __T.G.prog.ui.tab, cls: document.body.classList.contains('itab-duty') }));
      await p.evaluate(() => { document.querySelector('#infoTabs [data-itab="orders"]').click(); });
    } else {
      R.tabs = await p.evaluate(() => ({ bar: getComputedStyle(document.querySelector('#infoTabs')).display }));
    }
    // card + report fit at every size
    R.fit = await p.evaluate(async () => { const VY = await import('/js/voyage.js'), CC = await import('/js/crewcare.js'), HUD = await import('/js/ui/hud.js'), ART = await import('/js/ui/story.js'), G = __T.G; await ART.artReady();
      document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); G.sp.battle = null; G.sp.alert = null; G.sp.location = 'convoy'; G.sp.travel = { dest: 'ds9', t: 599, dur: 600 }; CC.tickCare(); VY.arriveAtDest(); HUD.updateHud();
      await new Promise(z => setTimeout(z, 300)); const c = document.querySelector('#promCard'), r = c.getBoundingClientRect(), st = document.querySelector('#stage').getBoundingClientRect();
      return { shown: !c.hidden, inStage: r.top >= st.top - 1 && r.bottom <= st.bottom + 1 && r.left >= st.left - 1 && r.right <= st.right + 1, scroll: c.scrollHeight > c.clientHeight + 1, btn: Math.min(...[...c.querySelectorAll('button')].map(b => Math.min(b.getBoundingClientRect().height, b.getBoundingClientRect().width))), img: (c.querySelector('img') || {}).src || null }; });
    if (SHOTS) await p.screenshot({ path: OUT + `bw-promenade-${tag}.png` });
    if (w !== 844) {   // the Shift Report headline shot (390 + 1280)
      await p.evaluate(async () => { const MO = await import('/js/moments.js'), HUD = await import('/js/ui/hud.js'), SIM = await import('/js/sim.js'), G = __T.G; document.querySelector('#promCard').hidden = true;
        const r = SIM.catchUp(90); G.prog.moments = []; MO.markReported(); G.ship.elapsed += 1; MO.pushMoment('bc', "You beat off a Jem'Hadar battlecruiser at 38% hull"); HUD.showReport(r); });
      await sleep(400); if (SHOTS) await p.screenshot({ path: OUT + `bw-report-${tag}.png` });
      R.reportFit = await p.evaluate(() => { const e = document.querySelector('#reportBody .rhead'), r = e.getBoundingClientRect(); return { h: Math.round(r.height), inView: r.right <= innerWidth + 1, img: !!e.querySelector('img') }; });
      await p.evaluate(() => { document.querySelector('#report').hidden = true; });
    }
    await c.close();
  }
  await br.close();
  // ---- verdicts ----
  const L = res['390x844'], P = L.pilot;
  ok(P.fresh.done === false && P.fresh.t >= 0, 'fresh pilot flag ' + J(P.fresh)); ok(!P.inPool, 'pilot in a story pool');
  ok(P.noRepair && P.at899 && P.stamp === 500 && P.notFromStart, 'pilot fired early / repairT ' + J([P.noRepair, P.at899, P.stamp, P.notFromStart]));
  ok(J(P.harden) === J([300, -1, 200]), 'repairT harden ' + J(P.harden));
  ok(P.gReport === 'report' && P.heldReport && P.gSheet === 'panel' && P.gAlert === 'alert', 'pilot gates ' + J([P.gReport, P.heldReport, P.gSheet, P.gAlert]));
  ok(P.gLegDay1 === 'grace', 'normal stories still in grace on day 1: ' + P.gLegDay1);
  ok(P.fired.open && P.fired.id === 'first_watch' && P.fired.done && P.fired.dayCount && P.fired.legsSince === 0 && P.fired.steps === 3, 'pilot fire ' + J(P.fired));
  ok(P.choices.length === 3 && !P.choices.some(c => c[2] === 'bonus') && P.choices[2][2] === 'careful' && P.choices[2][1] === 3, 'pilot choices ' + J(P.choices));
  ok(L.pilotUI.shown && L.pilotUI.imgs.every(s => !s || !/firstwatch/.test(s)) && (L.pilotUI.noart || L.pilotUI.imgs.some(s => s && /story_coolant_c4/.test(s))) && /stop here/.test(L.pilotUI.x), 'pilot UI ' + J(L.pilotUI));
  const PCs = L.pilotCareful; ok(PCs.steps.filter(s => s.band).every(s => s.band === 'careful' && /XP/.test(s.xp) && s.word === 'Carefully.') && PCs.steps.filter(s => 'line' in s).every(s => s.line) && PCs.steps[4].next == null, 'pilot careful thread ' + J(PCs.steps));
  ok(PCs.scrap.every(b => b === 'careful') && !PCs.again && PCs.done && PCs.nCareful >= 3, 'pilot once only / scrapbook ' + J(PCs));
  { const PO = L.pilotOdds; ok(PO.formulaSame, 'oddsP formula unchanged');
    ok(PO.rows.length >= 6 && PO.rows.every(r => (r.word === 'fair odds' || r.word === 'likely') && r.full >= 0.45 && r.full <= 0.6 && r.after >= 0.75), 'pilot odds fair-or-better ' + J(PO.rows));
    ok(PO.live.every(x => x >= 0.85 && x <= 0.9), 'pilot live choiceP ' + J(PO.live));
    ok(PO.other.n > 20 && !PO.other.diff.length, `non-pilot odds identical (${PO.other.n} choices) ` + J(PO.other.diff.slice(0, 4)));
    console.log('pilot odds: ' + PO.rows.map(r => `s${r.step} ${r.k} sk${r.sk}: ${r.before} (${r.beforeWord}, full ${Math.round(r.before * 60)}%) -> ${r.after} (${r.word}, full ${Math.round(r.full * 100)}%)`).join(' | ')); }
  ok(L.pilotFallback.at17995 === false && L.pilotFallback.at1800 === 'first_watch' && L.pilotFallback.done, 'pilot fallback ' + J(L.pilotFallback));
  const C = L.careful;
  ok(J(C.kestrel.out) === J(['careful>1+xp', 'step2', 'careful>2+xp', 'step3', 'careful+xp']) && C.kestrel.chain === 'kestrel_thanks' && C.kestrel.careful, 'kestrel careful ' + J(C.kestrel));
  ok(J(C.echo.out) === J(['careful>1+xp', 'step2', 'careful+xp']) && C.echo.chain === 'probe_maker' && C.echo.careful, 'echo careful ' + J(C.echo));
  ok(C.vorta.chain === 'vorta_returns' && C.vorta.careful && C.vorta.out[0] === 'careful+xp', 'vorta careful ' + J(C.vorta));
  ok(C.jem.chain === 'debt_repaid' && C.jem.careful && C.jem.out[0] === 'careful+xp', 'jemhadar careful ' + J(C.jem));
  ok(C.line2 && C.stopAfterOutcome.chain == null && C.stopAfterOutcome.step == null, 'careful line / stop after outcome ' + J([C.line2, C.stopAfterOutcome]));
  ok(C.xLabelCareful && C.stop.chain == null && C.stop.last === 'safe' && C.stopVorta == null, 'the ✕ stops ' + J([C.stop, C.stopVorta]));
  ok(C.full.band === 'success' && C.half.band === 'success' && C.half.half && !C.full.half && C.half.line && C.half.xp > 0 && C.half.xp <= Math.ceil(C.full.xp * 0.5) + 1 && C.half.rep <= Math.ceil(C.full.rep * 0.5), 'half pay ' + J([C.full, C.half]));
  ok(C.carefulXp.xp === Math.round(0.4 * (40 + 30) / 2), 'careful xp ' + J(C.carefulXp));
  ok(L.carefulUI.band === 'Carefully.' && L.carefulUI.cont && !/_c3/.test(L.carefulUI.img || ''), 'careful UI ' + J(L.carefulUI));
  const G2 = L.goal; ok(G2.freshFault === 45 && G2.ver === 17, 'fresh fault / version ' + J([G2.freshFault, G2.ver]));
  ok(G2.first === 'first' && /FIRST WATCH/.test(G2.pillFirst) && G2.alertOverFault === 'alert' && G2.fault === 'duty' && /TAP TO REPAIR/.test(G2.pillFault), 'goal top ' + J(G2));
  ok((G2.job === 'job' || G2.job === 'no job offered') && G2.board === 'board' && (G2.spec === 'spec' || G2.spec === 'no spec owed') && G2.firstAgain === 'first' && G2.after === 'ready' && G2.ds9 === 'ds9', 'goal order ' + J(G2));
  ok(L.stripFit.inView && L.stripFit.h >= 44 && /^FIRST WATCH/.test(L.stripText), 'strip fit ' + J([L.stripFit, L.stripText]));
  for (const [sz, RR] of Object.entries(res)) { const S2 = RR.strip2, F = S2.first;
    ok(F.h >= 44 && F.inView && !F.clipped && F.lines <= 2 && /^FIRST WATCH · Tap here when the first fault shows$/.test(F.text), `strip first-watch ${sz} ` + J(F));
    const bad = Object.entries(S2.faults).filter(([k, r]) => !(r.h >= 44 && r.inView && !r.clipped && r.lines <= 2 && r.nm && r.nm.vis && r.nm.txt.length > 2));
    ok(!bad.length, `strip fault keeps the system name ${sz} ` + J(bad.slice(0, 3)));
    const NR = S2.narrow; ok(NR.novb && NR.nm && NR.nm.vis && !NR.clipped && NR.h >= 44, `narrow strip drops the verb, keeps the name ${sz} ` + J(NR));
    const sh = S2.faults['fw:shields']; ok(sh && /^TAP TO REPAIR: Shield Generator/.test(sh.text) && (sz !== '1280x800' || !sh.novb), `strip TAP TO REPAIR ${sz} ` + J(sh));
    console.log(`strip ${sz}: first ${F.lines} line(s) ${F.h}px · faults dropping the verb ${Object.values(S2.faults).filter(r => r.novb).length}/${Object.keys(S2.faults).length}, severity ${Object.values(S2.faults).filter(r => r.nosv).length}`); }
  const M = L.moments; ok(M.none === 'quiet' && M.a === 'arrival' && M.b === 'levelup' && M.c === 'win' && M.d === 'rescue' && M.e === 'story' && M.f === 'promo' && M.g === 'bc' && M.tie === 'three', 'ranking ' + J(M));
  ok(M.battle && M.winMoment.length === 1 && /^win:You beat off a Cardassian Galor at \d+% hull$/.test(M.winMoment[0]), 'won fight moment ' + J(M.winMoment));
  ok(M.towBattle && M.towMoments === 0 && M.towBest === 'quiet', 'tow is not a win ' + J([M.towBattle, M.towMoments, M.towBest]));
  const RP = L.report; ok(RP.head && RP.head.mk === 'rescue' && /RESCUE/.test(RP.head.tag) && RP.head.first && RP.reportT > 0, 'report headline ' + J(RP.head));
  ok(RP.quiet && RP.quiet.mk === 'quiet' && RP.quiet.txt === 'A quiet watch' && RP.manifestOk, 'quiet fallback ' + J(RP.quiet));
  const PR = L.prom; ok(PR.due && PR.shown && PR.seen && J(PR.rows.map(r => r.replace('(off)', ''))) === J(['close', 'gifts', 'shore', 'holo', 'letters']) && /444/.test(PR.line), 'promenade shown ' + J(PR));
  ok(!PR.gifts.card && PR.gifts.plog && /GIFT LOCKER/.test(PR.gifts.h3 || ''), 'gifts button ' + J(PR.gifts));
  ok(PR.onceHidden && PR.goalAfter === 'ds9' && PR.reopen && !PR.holo.card && PR.holo.panel, 'reopen / holosuite ' + J([PR.onceHidden, PR.goalAfter, PR.reopen, PR.holo]));
  ok(PR.shore.used && PR.shore.card && PR.shore.off, 'shore leave ' + J(PR.shore));
  ok((PR.letters.alumni ? !PR.letters.disabled : PR.letters.disabled) && PR.letters.plog, 'letters home ' + J(PR.letters));
  ok(PR.stayHidden && !PR.leave.due && !PR.leave.seen && PR.again && PR.heldByReport && PR.afterReport, 'once per visit ' + J(PR));
  const MG = L.mig; ok(MG.veteran.v === 17 && MG.veteran.pilot.done === true && MG.seenStory.pilot.done === true && MG.newbie.pilot.done === false && MG.newbie.pilot.repairT === 0 && MG.newbie.pilot.t < 1 && ['veteran', 'seenStory', 'newbie'].every(k => MG[k].moments && MG[k].reportT === 0 && MG[k].tab === 'orders' && J(MG[k].prom) === '[false,false]'), 'migration ' + J(MG));
  const T = res['1280x800'];
  ok(T.tabs.mode && T.tabs.bar && T.tabs.def.orders && T.tabs.def.chips && !T.tabs.def.duty && !T.tabs.def.log, 'tabs default ' + J(T.tabs));
  ok(T.tabs.duty.cls && T.tabs.duty.duty && !T.tabs.duty.orders && T.tabs.duty.saved === 'duty' && T.tabs.duty.on === 'duty' && T.tabs.btnH >= 44, 'tab duty ' + J(T.tabs.duty));
  ok(T.tabsReload.tab === 'duty' && T.tabsReload.cls, 'tab saved ' + J(T.tabsReload));
  for (const t of ['390x844', '844x390']) ok(res[t].tabs.bar === 'none', 'tabs hidden in play ' + t);
  for (const t of Object.keys(res)) { const f = res[t].fit; ok(f.shown && f.inStage && !f.scroll && f.btn >= 44 && (!f.img || /story_quarks_v2|story_promenade/.test(f.img)), 'promenade fit ' + t + ' ' + J(f)); }
  for (const t of ['390x844', '1280x800']) { const f = res[t].reportFit; ok(f.h <= 112 && f.inView && f.img, 'report headline fit ' + t + ' ' + J(f)); }
  ok(!newArt.length, 'requests for not-yet-painted art ' + J(newArt));
  ok(!net.length, 'failed / 4xx requests ' + J(net));
  ok(!errs.length, 'console errors ' + J(errs));
  console.log(J(res, null, 1).slice(0, 6000));
  console.log(fails.length ? 'FAIL\n' + fails.join('\n') : 'PASS · bigwins-check · 3 sizes · 0 console errors · 0 failed requests');
  process.exit(fails.length ? 1 : 0);
})();
