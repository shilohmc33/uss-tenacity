// Crew needs N4 check: holodeck (booking, scene, blurbs/no-repeat, diminishing returns, buffs, Risa gap, addict, crew self-use,
// off-deck act), crew-care tools (rest, counsel, swap, shore leave), quirk-fit gifts, Insight gating, Lately, P29b lows, harden.
// Usage: node tools/n4-check.js
const { chromium } = require('playwright-core'); const BASE = process.env.BASE || 'http://127.0.0.1:8765/', OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [], net = [], res = {};
  for (const [w, h] of [[390, 844], [844, 390], [1280, 800]]) {
    const tag = `${w}x${h}`, c = await br.newContext({ viewport: { width: w, height: h } }), p = await c.newPage();
    p.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); }); p.on('pageerror', e => errs.push(`${tag}: ${e.message}`));
    p.on('response', r => { if (r.status() >= 400) net.push(`${tag}: ${r.status()} ${r.url()}`); }); p.on('requestfailed', r => net.push(`${tag}: failed ${r.url()}`));
    await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(400);
    await p.evaluate(() => { window.__noSave = true; });
    const R = res[tag] = {};
    // panel (lounge chip -> Holodeck), booking for a crewmate at Insight 2 (hearts), then the scene
    R.chip = await p.evaluate(async () => { const G = __T.G, L = G.lt; L.lift = null; L.deck = 'lounge'; L.x = .3; L.y = .82; L.mode = 'idle'; L.path = null; __T.cam.snap = true; G.prog.rations = 999; G.prog.insight.lvl = 2; { const N = await import('/js/needs.js'), r = N.needsOf(G.prog.crew.slots['ops']); r.shift = (N.shiftNow() + 1) % 3; r.act = 'fun'; } await new Promise(r => setTimeout(r, 400)); const b = document.querySelector('#chipsPlay [data-holo-open]'); if (b) b.click(); return !!b; });
    await sleep(300);
    R.panel = await p.evaluate(() => { const s = document.getElementById('holoFor'), id = __T.G.prog.crew.slots['ops']; s.value = id; s.dispatchEvent(new Event('change', { bubbles: true })); return { rows: document.querySelectorAll('#holoPanel .holorow').length, hearts: document.querySelectorAll('#holoPanel .holofit').length }; });
    await sleep(300); await p.evaluate(() => { __T.app.paused = true; }); await p.screenshot({ path: OUT + `n4-holo-panel-${tag}.png` }); await p.evaluate(() => { __T.app.paused = false; });
    await p.evaluate(() => document.querySelector('#holoPanel [data-holo-book="dixon_hill"]').click()); await sleep(600);
    R.scene = await p.evaluate(() => { const f = document.querySelector('#holoScene .holoframe'), b = document.querySelector('#holoScene .holoblurb'), img = f && f.querySelector('img'); if (!f) return null; const fr = f.getBoundingClientRect(), br = b.getBoundingClientRect();
      return { fit: fr.width <= innerWidth + 1 && fr.height <= innerHeight + 1, blurbPct: Math.round(br.height / fr.height * 100), loaded: img.complete && img.naturalWidth === 1080, text: b.querySelector('p').textContent.slice(0, 60), closeVis: (() => { const sm = b.querySelector('small').getBoundingClientRect(); return sm.bottom <= Math.min(fr.bottom, innerHeight) + 1 && sm.height > 4; })() }; });
    await p.evaluate(() => { __T.app.paused = true; }); await p.screenshot({ path: OUT + `n4-holo-scene-${tag}.png` }); await p.evaluate(() => { __T.app.paused = false; document.querySelector('#holoScene .holoframe').click(); });
    // Personal Log page: Lately + CREW CARE
    R.plog = await p.evaluate(async () => { const H = await import('/js/ui/hud.js'), id = __T.G.prog.crew.slots['engineer-1']; H.openPlog(id); await new Promise(r => setTimeout(r, 200)); const t = document.getElementById('plogPanel').innerText; const sec = [...document.querySelectorAll('#plogPanel .plsec')].find(e => e.textContent === 'LATELY'); if (sec) sec.scrollIntoView(); return { lately: /LATELY/.test(t), care: /CREW CARE/.test(t), tools: document.querySelectorAll('#plogPanel [data-care-tool]').length }; });
    await sleep(200); await p.evaluate(() => { __T.app.paused = true; }); await p.screenshot({ path: OUT + `n4-plog-care-${tag}.png` }); await p.evaluate(() => { __T.app.paused = false; document.getElementById('plogPanel').hidden = true; });
    if (tag !== '1280x800') { await c.close(); continue; }
    R.logic = await p.evaluate(async () => { const N = await import('/js/needs.js'), M = await import('/js/mood.js'), HD = await import('/js/holodeck.js'), CC = await import('/js/crewcare.js'), PG = await import('/js/progression.js'), PC = await import('/js/pacing.js'), GF = await import('/js/gifts.js'), GD = await import('/js/gift-data.js'), I = await import('/js/incidents.js'), O = await import('/js/oddjobs.js');
      const G = __T.G, C = G.prog.crew, out = { sameMod: (await import('/js/state.js')).G === __T.G }, H = HD.H(), t0 = () => G.ship.elapsed, rnd = Math.random, withR = (v, f) => { Math.random = typeof v === 'function' ? v : () => v; try { return f(); } finally { Math.random = rnd; } };
      const off = i => { const q = N.needsOf(i); q.shift = (N.shiftNow() + 1) % 3; q.act = 'fun'; }, free = i => { delete H.busy[i]; off(i); }, id = C.slots['engineer-2'], r = N.needsOf(id), xp = (i, k) => G.prog.skills[i] ? G.prog.skills[i][k] : 0;
      G.prog.rations = 5000; PC.PACE_RT.idleT = 0; G.prog.jobs.active = null; for (const sl of ['engineer-2', 'ops', 'science-tech', 'crewman']) off(C.slots[sl]);
      // diminishing XP + buffs replace + one booking at a time
      let x0 = xp(id, 'tactical'); HD.book('tactical_sim', id); const g1 = xp(id, 'tactical') - x0; out.busyBlock = HD.book('vics_lounge', id).ok === false; free(id);
      x0 = xp(id, 'tactical'); HD.book('tactical_sim', id); const g2 = xp(id, 'tactical') - x0; free(id); out.xp = [g1, g2];
      out.buff1 = HD.buffOf(id); HD.book('warp_core_breach', id); out.buff2 = HD.buffOf(id); free(id);
      // station buff: sharp lifts efficiency
      const sys = Object.keys(M.STATION_CREW).find(s => M.STATION_CREW[s].some(sl => C.slots[sl] === id)); if (sys) { const e1 = M.stationEff(sys); H.buffs[id] = { k: 'sharp', t1: 0 }; const e0 = M.stationEff(sys); H.buffs[id] = { k: 'sharp', t1: t0() + 999 }; out.sharpEff = [+e0.toFixed(3), +e1.toFixed(3), sys]; }
      // Lt sharp -> repair skill
      const lr0 = M.ltRepairSkill(); HD.book('warp_core_breach', 'lt'); out.ltRepair = [+lr0.toFixed(3), +M.ltRepairSkill().toFixed(3)]; free('lt');
      // Risa gap
      out.risa1 = HD.book('risa_beach', id).ok; free(id); out.risa2 = HD.book('risa_beach', id).why || 'BOOKED'; out.comfortLock = HD.comfortLocked(id);
      // FR spend + opinion cap (+1 per day per person)
      const id2 = C.slots['ops']; free(id2); delete H.paid[id2]; const fr0 = G.prog.rations, op0 = PG.opinionOf(id2); HD.book('klingon_calisthenics', id2); free(id2); HD.book('klingon_calisthenics', id2); free(id2); out.fr = fr0 - G.prog.rations; out.opDelta = +(PG.opinionOf(id2) - op0).toFixed(2);
      // group program pulls off-shift crew
      const gr = HD.book('captain_proton', 'lt'); out.group = gr.ok ? gr.who.length : gr.why; for (const w of gr.who || []) free(w);
      // off-deck act
      const sh = C.slots['science-tech']; HD.book('vulcan_garden', sh); N.tickNeeds(400); out.act = N.needsOf(sh).act; free(sh); N.tickNeeds(400); out.actAfter = N.needsOf(sh).act;
      // addict: holo quirk, 3 sessions in a day -> overuse
      const ad = C.slots['crewman'], ao = C.occ[ad], q0 = ao.quirks; ao.quirks = ['holo']; for (let i = 0; i < 3; i++) { HD.book('dixon_hill', ad); free(ad); } out.overuse = (H.over[ad] || 0) > t0(); ao.quirks = q0;
      // blurbs: no repeat within 3; partner flavor
      const keys = []; for (let i = 0; i < 40; i++) { HD.blurbFor('vics_lounge', 'lt'); keys.push(H.recent.vics_lounge.slice(-1)[0]); }
      out.noRepeat = keys.every((k, i) => keys.slice(Math.max(0, i - 2), i).indexOf(k) < 0);
      const ro = G.prog.romance.opt; G.prog.romance.opt = true; G.prog.romance.partner = id2; const cats = {}; for (let i = 0; i < 30; i++) { const b = HD.blurbFor('vics_lounge', 'lt'); cats[b.cat] = (cats[b.cat] || 0) + 1; } out.partnerCats = cats; const hale = Object.keys(C.occ).find(k => k === 'hale'); if (hale) { G.prog.romance.partner = hale; const txt = []; for (let i = 0; i < 20; i++) { const b = HD.blurbFor('dixon_hill', 'lt'); if (b.cat === 'partner') txt.push(b.text); } out.halePartner = txt.some(t => /\bshe\b|\bher\b|dame/.test(t)) ? 'FAIL' : txt.length; } G.prog.romance.partner = null; G.prog.romance.opt = ro;
      out.crewLead = HD.blurbFor('dixon_hill', id).text.slice(0, 70);
      // crew self-use
      for (const k of Object.keys(H.busy)) delete H.busy[k]; const sid = C.slots['yeoman'], sr = N.needsOf(sid); sr.shift = (N.shiftNow() + 1) % 3; sr.n.fun = 10; sr.act = 'fun';
      for (const o of Object.values(C.slots)) if (o && o !== sid) N.needsOf(o).n.fun = 90;
      withR(0, () => HD.tickHolo(1)); out.self = H.busy[sid] ? H.busy[sid].prog + (H.busy[sid].self ? ' (self, free)' : '') : 'none';
      PC.PACE_RT.idleT = 1e6; for (const k of Object.keys(H.busy)) delete H.busy[k]; withR(0, () => HD.tickHolo(1)); out.selfUnseen = Object.keys(H.busy).length; PC.PACE_RT.idleT = 0;
      // crew care (v18: crew self-book the holodeck while the sim runs, as intended; clear self-bookings so the rest / captain's-call answers are the captain's)
      const clearSelf = () => { const hb = G.prog.holo && G.prog.holo.busy; if (hb) for (const k of Object.keys(hb)) if (hb[k].self) delete hb[k]; }; clearSelf();
      const cid = C.slots['security']; out.rest = withR(0, () => [CC.orderRest(cid).ok, CC.orderRest(cid).why, CC.orderRest(C.slots.co).why]); out.restUnwell = N.needsOf(cid).unwell > t0();
      N.needsOf(id2).stress = 6; out.counsel = [CC.counsel(id2).ok, N.needsOf(id2).stress, CC.counsel(id2).why]; CC.C().counsel[id2] -= 3 * PG.PROG.dayLength; out.counselLater = CC.toolState(id2).counsel.ok;
      const s0 = N.needsOf(id2).shift; out.swap = withR(0, () => [CC.shiftSwap(id2).ok, (s0 + 1) % 3 === N.needsOf(id2).shift, CC.shiftSwap(id2).why]);
      G.sp.location = 'ds9'; G.sp.travel = null; G.sp.rep = 100; const rep0 = G.sp.rep; out.shore = withR(0, () => [CC.shoreLeave().ok, rep0 - G.sp.rep, CC.shoreLeave().why]); G.sp.location = 'patrol'; CC.tickCare(); out.shoreReset = CC.C().shoreUsed === false;
      // P31: captain's call
      { clearSelf(); const did = C.slots['yeoman'], dr = N.needsOf(did), cap = C.slots.co; G.prog.rank = 1; CC.C().rest = {}; CC.C().swap = {}; CC.C().deny = {}; dr.unwell = 0;
        dr.stress = 0; for (const k of N.NEED_KEYS) dr.n[k] = 90; G.prog.opinions[cap] = 0; const pLow = CC.chance([did]);
        dr.stress = 8; dr.n[N.NEED_KEYS[0]] = 5; const pStress = CC.chance([did]); G.prog.opinions[cap] = 60; const pOp = CC.chance([did]);
        G.prog.opinions[cap] = 0; dr.stress = 0; for (const k of N.NEED_KEYS) dr.n[k] = 90;
        const d = withR(0.999, () => CC.orderRest(did)), cd = CC.toolState(did).rest, ds = withR(0.999, () => CC.shiftSwap(did));
        CC.C().deny[did].rest -= PG.PROG.dayLength; const after = CC.toolState(did).rest.ok;
        G.sp.location = 'ds9'; G.sp.travel = null; G.sp.rep = 100; const sd = withR(0.999, () => CC.shoreLeave()), sdRep = 100 - G.sp.rep, sd2 = CC.shoreLeave().why; G.sp.location = 'patrol'; CC.tickCare();
        G.prog.rank = 2; CC.C().rest = {}; CC.C().swap = {}; CC.C().deny = {}; dr.unwell = 0; const dir = withR(0.999, () => CC.orderRest(did)), dirSw = withR(0.999, () => CC.shiftSwap(did)); G.prog.rank = 1;
        out.p31 = { pLow: +pLow.toFixed(2), pStress: +pStress.toFixed(2), pOp: +pOp.toFixed(2), deny: d.ok + ' | ' + d.why, cd: cd.why, swapDeny: ds.ok, afterDay: after, shoreDeny: sd.ok + ' | ' + sd.why, shoreRepOnDeny: sdRep, shoreAgain: sd2, directRest: dir.ok + ' | ' + dir.line, directSwap: dirSw.ok }; }
      // quirk-fit gift = delighted
      const gid = C.slots['botanist'], go = C.occ[gid], gq = go.quirks; go.quirks = ['devout']; const it = Object.keys(GD.GIFT).find(k => GD.GIFT[k].cats.includes('spiritual'));
      G.prog.gifts && (G.prog.gifts.last = {}); const gr2 = GF.giveGift(gid, it); out.gift = gr2.ok ? gr2.r : gr2.why; go.quirks = gq;
      // Insight gating
      const cnt = l => { G.prog.insight.lvl = l; return CC.quirksShown(gid).length + '/' + M.quirkNames(gid).length + (CC.barsShown() ? ' bars' : ''); }; out.gate = [cnt(1), cnt(2), cnt(3)];
      out.lately = CC.lately(id).text;
      // P29b: incident whose crewmember left -> dropped
      G.prog.jobs.active = { kind: 'incident', inc: 'refuse', who: 'nobody-x', node: 'ops', deck: 'bridge', t: 99, dur: 99, need: 9, acc: 0, label: 'x', id: 999 }; O.tickJobs(1); out.leftDropped = !G.prog.jobs.active;
      // P30: paid bookings blocked when asleep / on shift / in an incident; romance off -> no partner blurbs; crew-lead third person
      const bq = C.slots['transporter'], bqr = N.needsOf(bq); free(bq); bqr.act = 'sleep'; out.blkSleep = HD.bookState('vulcan_garden', bq).why; bqr.act = 'fun'; bqr.shift = N.shiftNow(); out.blkShift = HD.bookState('vulcan_garden', bq).why; off(bq);
      G.prog.jobs.active = { kind: 'incident', inc: 'refuse', who: bq, node: 'ops', deck: 'bridge', t: 99, dur: 99, need: 9, acc: 0, label: 'x', id: 998 }; out.blkInc = HD.bookState('vulcan_garden', bq).why; G.prog.jobs.active = null;
      G.prog.romance.partner = id2; const o0 = G.prog.romance.opt; G.prog.romance.opt = false; let pc = 0; for (let i = 0; i < 30; i++) if (HD.blurbFor('vics_lounge', 'lt').cat === 'partner') pc++; out.romOffPartner = pc; G.prog.romance.opt = o0; G.prog.romance.partner = null;
      let you = 0; for (const pid of HD.PROG_IDS) for (let i = 0; i < 12; i++) if (/\byou\b|\byour\b/i.test(HD.blurbFor(pid, id).text)) you++; out.crewYou = you;
      // harden junk
      G.prog.holo = { busy: { ghost: { prog: 'x', endT: 1 }, [id]: { prog: 'risa_beach', endT: 1e15 } }, buffs: { [id]: { k: 'zzz' } }, risa: { [id]: 1e15 }, n: { sessions: -5 } }; G.prog.care = { rest: { [id]: 1e9 }, counsel: { ghost: 1 }, n: 'x' };
      PG.clampProg(); out.harden = { busy: Object.keys(G.prog.holo.busy).length, endOk: G.prog.holo.busy[id] && G.prog.holo.busy[id].endT <= t0() + 7200, buffs: Object.keys(G.prog.holo.buffs).length, risa: G.prog.holo.risa[id] <= t0(), sessions: G.prog.holo.n.sessions, rest: Object.keys(G.prog.care.rest).length, counsel: Object.keys(G.prog.care.counsel).length };
      return out; });
    await c.close();
  }
  console.log(JSON.stringify(res, null, 1)); console.log('ERRORS', errs.length, errs.slice(0, 5)); console.log('FAILED REQUESTS', net.length, net.slice(0, 5)); await br.close(); process.exit(errs.length || net.length ? 1 : 0);
})();
