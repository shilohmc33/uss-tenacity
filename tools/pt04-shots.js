// Tester pass 04 fixes: proof shots -> shots/pt04-*.png and checks -> shots/pt04-report.json
// NODE_PATH=/workspace/pwtools/node_modules node tools/pt04-shots.js [base] [beforeBase]
//   beforeBase (optional): a server of the pre-pt04 build for the "before" stat-tile shots
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const BEFORE = process.argv[3] || null;
const OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const issues = {}, R = {};
async function mk(b, w, h, mobile, tag = `${w}x${h}`) {
  issues[tag] = issues[tag] || [];
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) issues[tag].push(`console.${m.type()}: ${m.text()}`); });
  p.on('pageerror', e => issues[tag].push(`pageerror: ${e.message}`));
  p.on('response', r => { if (r.status() >= 400) issues[tag].push(`HTTP ${r.status()} ${r.url()}`); });
  return p;
}
const ready = p => p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
async function boot(p, base = BASE) { await p.goto(base + '?reset=1'); await ready(p); await sleep(500); await p.evaluate(() => { window.__noSave = true; const G = __T.G; G.sp.cap.decideT = 1e9; G.ship.nextFault = 1e9; G.sp.ev.nextT = -1; }); }
const full = p => p.evaluate(() => document.querySelector('#btnFull').click()).then(() => sleep(500));
const openSheet = async (p, n) => { await p.evaluate(n => document.querySelector(`.sheetBtns [data-sheet="${n}"]`).click(), n); await sleep(500); };
const closeSheet = p => p.evaluate(() => { const c = document.querySelector('#sheetClose'); if (c) c.click(); }).then(() => sleep(300));
const scrollTo = (p, sel, pad = 70) => p.evaluate(([sel, pad]) => { const e = document.querySelector(sel); if (!e) return false; e.scrollIntoView({ block: 'start' }); const ps = document.querySelector('#panels'); if (ps) ps.scrollTop = Math.max(0, ps.scrollTop - pad); return true; }, [sel, pad]).then(r => sleep(300).then(() => r));
const shot = (p, name, clip) => p.screenshot({ path: OUT + `pt04-${name}.png`, ...(clip ? { clip } : {}) });
async function career(p) {   // a Lt jg mid-week-1 with some decor, a pending spec pick and favours open
  await p.evaluate(async () => {
    const G = __T.G, PR = await import('/js/progression.js');
    PR.awardXP(5200, 'manual'); G.prog.playDays = 3; G.sp.rep = 600; G.prog.repLifetime = 700;
    G.prog.cabin.rations = 900; const ids = Object.keys(__T.CB.DECOR).slice(0, 2); G.prog.cabin.owned.push(...ids); G.prog.cabin.placed[__T.CB.slots()[0].id] = ids[0];
    G.prog.perf.q = 0.5; G.prog.perf.resp = 0.4; G.prog.fleetRep = 12; Object.assign(G.prog.opinions, { okafor: 12, kovac: 8, thelev: 10 });
    G.prog.specOffered = 99; PR.computeReadiness();
  });
  await sleep(600);
}
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  // ---------- stat tiles: before / after ----------
  R.tiles = {};
  for (const [label, base] of [['before', BEFORE], ['after', BASE]]) {
    if (!base) continue;
    for (const [w, h, name] of [[390, 844, 'phone'], [844, 390, 'landscape']]) {
      const p = await mk(b, w, h, true, label === 'after' ? `${w}x${h}` : `${w}x${h}-before`);
      await boot(p, base); await full(p);
      const m = await p.evaluate(() => [...document.querySelectorAll('#stats .stat')].filter(e => e.checkVisibility()).map(e => { const r = e.getBoundingClientRect(); return { k: e.dataset.stat, w: Math.round(r.width), h: Math.round(r.height) }; }));
      R.tiles[`${name}-${label}`] = { min: { w: Math.min(...m.map(x => x.w)), h: Math.min(...m.map(x => x.h)) }, tiles: m.length };
      const box = await p.evaluate(() => { const r = document.querySelector('#stats').getBoundingClientRect(); return { x: 0, y: 0, width: Math.min(innerWidth, Math.ceil(r.right + 4)), height: Math.ceil(r.bottom + 4) }; });
      await shot(p, `tiles-${name}-${label}`, name === 'phone' ? { x: 0, y: 0, width: w, height: Math.max(box.height, 60) } : { x: 0, y: 0, width: Math.max(box.width, 120), height: h });
      await p.context().close();
    }
  }
  // ---------- portrait: 44 px controls, readiness hint, odd job, minor-fix checks ----------
  const p = await mk(b, 390, 844, true);
  await boot(p); await full(p); await career(p);
  await openSheet(p, 'crew'); await scrollTo(p, '#career', 20);
  R.hint = await p.evaluate(() => { const h = document.querySelector('.rhint'); return h ? h.innerText : null; });
  await shot(p, 'readiness-hint');
  await scrollTo(p, '#quarters', 30); await shot(p, 'controls-crew-quarters');
  await scrollTo(p, '#favours', 30); await shot(p, 'controls-favours');
  R.controlSizes = await p.evaluate(() => ['.slotb', '.req button', '.spb', '[data-fav]'].map(s => { const e = [...document.querySelectorAll(s)].find(x => x.checkVisibility()); if (!e) return [s, null]; const r = e.getBoundingClientRect(); return [s, `${Math.round(r.width)}x${Math.round(r.height)}`]; }));
  await p.evaluate(() => { const s = document.querySelector('[data-slot]'); s && s.click(); }); await sleep(500);
  await shot(p, 'controls-decor-chooser');
  await p.evaluate(() => { document.querySelector('#decorPanel').hidden = true; }); await closeSheet(p);
  await openSheet(p, 'duty'); await scrollTo(p, '#reqBox', 10); await p.evaluate(() => { const b = document.querySelector('[data-sink="maintain"]'); b && b.scrollIntoView({ block: 'center' }); }); await sleep(300);
  R.nightOrder = await p.evaluate(() => { const b = document.querySelector('[data-sink="maintain"]'); const r = b.getBoundingClientRect(); return `${b.innerText} ${Math.round(r.width)}x${Math.round(r.height)}`; });
  R.tradeText = await p.evaluate(() => { const e = [...document.querySelectorAll('#reqBox .req')].find(x => /quartermaster/.test(x.innerText)); return e ? e.innerText.replace(/\s+/g, ' ') : null; });
  await shot(p, 'controls-duty-night-order');
  await closeSheet(p);
  // odd job between repairs: wait for one to spawn on a quiet ship, then send the Lt and watch him work it
  await p.evaluate(() => { const G = __T.G; G.ship.faults = {}; __T.PACE_RT.sessionT = 999; G.prog.jobs = { next: 1, active: null, n: 0, done: 0, xp: 0, expired: 0 }; });
  await p.waitForFunction(() => __T.G.prog.jobs.active, null, { timeout: 20000 });
  R.job = await p.evaluate(() => ({ ...__T.G.prog.jobs.active, pill: document.querySelector('#alertPill').innerText }));
  await sleep(1200); await shot(p, 'odd-job-offered');
  await p.evaluate(() => __T.playerOrder(() => document.querySelector('#alertPill').click()));
  await p.waitForFunction(() => { const j = __T.G.prog.jobs.active; return j && j.acc > j.need * 0.4; }, null, { timeout: 90000 });
  await shot(p, 'odd-job-working');
  await openSheet(p, 'duty'); await shot(p, 'odd-job-duty'); await closeSheet(p);
  const xp0 = await p.evaluate(() => __T.G.prog.totalXp);
  await p.waitForFunction(() => !__T.G.prog.jobs.active, null, { timeout: 60000 });
  R.jobDone = await p.evaluate(x0 => ({ done: __T.G.prog.jobs.done, xpGain: __T.G.prog.totalXp - x0, log: __T.G.log.slice(-3).map(l => l.text || l.msg || l) }), xp0);
  await sleep(600); await shot(p, 'odd-job-done');
  // ---- minor-fix checks ----
  R.checks = await p.evaluate(async () => {
    const G = __T.G, PR = await import('/js/progression.js'), CL = __T.CL, CB = __T.CB, D = await import('/js/render/deck.js'), out = {};
    // m2: play day by LOCAL midnight
    G.prog.lastPlayDate = null; G.prog.lastPlayAt = null; const d0 = G.prog.playDays;
    PR.markPlayDay(new Date(2026, 9, 17, 18, 55), 999); const a = G.prog.playDays; PR.markPlayDay(new Date(2026, 9, 17, 19, 5), 999); const b2 = G.prog.playDays; G.prog.lastPlayAt = null; PR.markPlayDay(new Date(2026, 9, 18, 0, 5), 999); const c = G.prog.playDays;
    out.m2 = { at1855: a - d0, at1905: b2 - d0, nextMidnight: c - d0, ok: a - d0 === 1 && b2 === a && c === a + 1 };
    // m3: shipment favour near a full locker
    G.prog.alumni.push({ id: 'testalum', name: 'Ens Test', short: 'Test', species: 'human', rank: 1, ladder: 'officer', slot: 'engineer-2', dept: 'eng', role: 'Engineer', opinion: 60, posting: 'utopia', leftDay: 1, leftPD: 1, fr: 6 });
    const qonos = { ...G.prog.alumni.at(-1), id: 'testalum2', posting: 'qonos' }; G.prog.alumni.push(qonos);
    G.prog.fleetRep = 40; G.sp.rep = 500; G.prog.fav.cd = {}; G.ship.partsCap = 20; G.prog.fav.fx.shipment = 0;
    G.ship.parts = 18; let s = CL.favourState('shipment'); out.m3 = { at18: { ok: s.ok, n: s.n, cost: s.cost, why: s.why } };
    G.ship.parts = 19; s = CL.favourState('shipment'); out.m3.at19 = { ok: s.ok, why: s.why };
    G.ship.parts = 10; s = CL.favourState('shipment'); out.m3.at10 = { ok: s.ok, n: s.n, cost: s.cost };
    G.ship.parts = 18; G.sp.location = 'ds9'; G.sp.travel = null; const r0 = G.sp.rep; CL.callFavour('shipment'); out.m3.calledAt18 = { parts: G.ship.parts, repSpent: r0 - G.sp.rep };
    out.m3.ok = out.m3.at18.n === 2 && out.m3.at18.cost.rep === 14 && !out.m3.at19.ok && out.m3.calledAt18.parts === 20 && out.m3.calledAt18.repSpent === 14;
    // m4: ordnance favour charged per torpedo
    G.prog.fleetRep = 40; G.prog.fav.cd = {}; G.ship.torps = G.ship.torpCap - 1; s = CL.favourState('ordnance'); out.m4 = { oneShort: { ok: s.ok, n: s.n, cost: s.cost, why: s.why } };
    G.ship.torps = G.ship.torpCap - 3; s = CL.favourState('ordnance'); out.m4.threeShort = { n: s.n, cost: s.cost };
    out.m4.ok = out.m4.oneShort.n === 1 && out.m4.oneShort.cost.rep === 25 && out.m4.threeShort.cost.rep === 50;
    // m5: decor slots on walkable floor don't eat walk taps
    // every tier, every slot (empty and placed): sample taps on WALKABLE floor around the slot (between the tight radius
    // and the old hit zone); none may open the chooser. A tap right on a placed item still does.
    const P = await import('/js/path.js'), cam = D.cam; out.m5 = { tiers: {} }; let eaten = 0, sampled = 0, onOk = 0, onN = 0;
    for (let rank = 0; rank <= 3; rank++) {
      G.prog.rank = rank; CB.applyTier(); G.lt.deck = 'quarters'; G.prog.cabin.placed = {};
      const tight = PR.PROG.cabin.floorSlotTap / cam.scale, big = Math.max(40, 34 / cam.scale), DW = 960, DH = 640;
      const tierRes = [];
      for (const pass of ['empty', 'placed']) {
        if (pass === 'placed') CB.slots().forEach((sl, i) => { const id = Object.keys(CB.DECOR)[i % Object.keys(CB.DECOR).length]; if (!G.prog.cabin.owned.includes(id)) G.prog.cabin.owned.push(id); G.prog.cabin.placed[sl.id] = id; });
        for (const sl of CB.slots()) {
          let e = 0, n = 0;
          for (let a = 0; a < 16; a++) for (const rd of [tight + 6, (tight + big) / 2, big - 2]) {
            const fx = sl.x + Math.cos(a / 16 * 6.283) * rd / DW, fy = sl.y + Math.sin(a / 16 * 6.283) * rd / DH;
            if (!P.isWalkable('quarters', fx, fy)) continue; n++; const h = D.hitTest(fx, fy); if (h && h.kind === 'slot') e++;
          }
          eaten += e; sampled += n;
          if (pass === 'placed') { onN++; const h = D.hitTest(sl.x, sl.y); if (h && h.kind === 'slot' && h.id === sl.id) onOk++; }
          if (e) tierRes.push(`${pass}:${sl.id} ${e}/${n}`);
        }
      }
      out.m5.tiers[CB.tier().id || rank] = tierRes.length ? tierRes : 'no floor taps eaten';
    }
    out.m5.floorTapsSampled = sampled; out.m5.floorTapsEaten = eaten; out.m5.tapOnPlacedItem = `${onOk}/${onN}`; out.m5.ok = eaten === 0 && onOk >= onN - 2;
    G.prog.cabin.placed = {}; G.prog.rank = 0; CB.applyTier(); G.lt.deck = 'engineering';
    // m6: trade cap 120 = 24 trades of 5
    G.prog.sinks.trade = null; let n = 0; for (let i = 0; i < 40; i++) { G.ship.parts = Math.max(G.ship.parts, 10); if (!CB.tradeParts(true)) break; n++; }
    out.m6 = { trades: n, parts: n * 5, cap: PR.PROG.rations.trade.perDay, ok: n * 5 === PR.PROG.rations.trade.perDay };
    // m7: Thelev is protected: drain every possible random transfer, she stays; death check refuses
    G.prog.playDays = 60; for (const o of Object.values(G.prog.crew.occ)) o.joined = 0;
    const gone = []; for (let i = 0; i < 40; i++) { const r = CL.crewEvent(['transfer']); if (!r) break; gone.push(r.id || r); }
    const MD = __T.MD; const was = PR.PROG.deaths.enabled; PR.PROG.deaths.enabled = true; const dc = MD.deathCheck('thelev', 'battle'); PR.PROG.deaths.enabled = was;
    out.m7 = { transfersDrained: gone.length, thelevAboard: !!G.prog.crew.occ.thelev, flag: !!(G.prog.crew.occ.thelev || {}).protected, deathCheck: dc.why, ok: !!G.prog.crew.occ.thelev && dc.why === 'protected' };
    return out;
  });
  await p.context().close();
  // landscape + desktop: controls + readiness hint, zero errors
  for (const [w, h, mob, tag] of [[844, 390, true, 'landscape'], [1280, 800, false, 'desktop']]) {
    const q = await mk(b, w, h, mob); await boot(q); if (w < 900) await full(q); await career(q);
    await openSheet(q, 'crew'); await scrollTo(q, '#career', 20); await shot(q, `readiness-hint-${tag}`);
    await scrollTo(q, '#quarters', 20); await shot(q, `controls-crew-${tag}`);
    await q.context().close();
  }
  await b.close();
  R.issues = issues;
  fs.writeFileSync(OUT + 'pt04-report.json', JSON.stringify(R, null, 1));
  console.log(JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
