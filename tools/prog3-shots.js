// Progression phase 3 verification + proof shots -> shots/prog3-*.png, shots/prog3-report.json
// NODE_PATH=/workspace/pwtools/node_modules node tools/prog3-shots.js [base]
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const issues = {}, R = {};
async function mk(b, w, h, mobile) {
  const tag = `${w}x${h}`; issues[tag] = issues[tag] || [];
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript(() => { window.__TENACITY_SKIP_NAME = true; window.__TENACITY_SKIP_BG = true; window.__TENACITY_NO_IDLE = true; });   // v18: skip the name / Academy prompts; no idle pause in long shot runs
  const p = await ctx.newPage();
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) issues[tag].push(`console.${m.type()}: ${m.text()}`); });
  p.on('pageerror', e => issues[tag].push(`pageerror: ${e.message}`));
  p.on('response', r => { if (r.status() >= 400) issues[tag].push(`HTTP ${r.status()} ${r.url()}`); });
  return p;
}
async function boot(p, q = '?debug=1&reset=1') {
  await p.goto(BASE + q);
  await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
  await sleep(400);
  await p.evaluate(() => { const G = __T.G; window.__noSave = true; G.sp.cap.decideT = 1e9; G.ship.nextFault = 1e9; G.sp.ev.nextT = -1; const d = document.querySelector('#debug'); if (d) d.hidden = true; });
}
const shot = (p, name) => p.screenshot({ path: OUT + `prog3-${name}.png` });
const tele = (p, deck, x, y) => p.evaluate(([deck, x, y]) => { const L = __T.G.lt; L.lift = null; L.deck = deck; L.x = x; L.y = y; L.mode = 'idle'; L.path = null; L.node = null; L.repairSys = null; L.intent = null; __T.cam.snap = true; __T.cam.manualT = 0; }, [deck, x, y]);
// a mid-career Lt (level 12, Lt jg) with a spread of opinions across the 18 crew
const career = p => p.evaluate(async () => {
  const PR = await import('/js/progression.js'), G = __T.G;
  PR.awardXP(5200, 'manual'); G.prog.specOffered = 99;   // phase 5: keep the spec picker (level 10+) out of these shots
  Object.assign(G.prog.opinions, { tren: 38, okafor: 61, diallo: 22, hale: -12, orvin: 14, tull: 33, kovac: 52, seo: 31, doru: 9, rhovan: 64, grevv: 45, mollo: 27, vardock: 6, natarajan: 18, rmira: 41, thelev: 72, delgado: 47, sorvan: 3 });
  G.prog.perf.q = 0.74; G.prog.perf.resp = 0.8; G.prog.service = 3.4; G.sp.rep = 260; G.prog.repLifetime = 900; G.prog.repSeen = 260; G.ship.parts = 18;
  G.prog.playDays = 9; G.prog.crew.rolls.lastPD = 9;
  return PR.computeReadiness();
}).then(async r => { await sleep(4500); return r; });
const openSheet = async (p, name) => { await p.evaluate(n => document.querySelector(`.sheetBtns [data-sheet="${n}"]`).click(), name); await sleep(400); };
const closeSheet = p => p.evaluate(() => { const c = document.querySelector('#sheetClose'); if (c) c.click(); }).then(() => sleep(300));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  // ================= portrait =================
  let p = await mk(b, 390, 844, true);
  await boot(p);
  R.readiness = await career(p);
  R.roster = await p.evaluate(async () => { const PR = await import('/js/progression.js'); return PR.crewList().map(c => `${c.slot} | ${c.dept} | ${c.deck} | ${c.rankShort} ${c.occ.name} | ${c.speciesName} | ${c.tags.join(', ')} | ${c.senior ? 'senior' : ''} | ${c.img ? 'portrait' : 'badge'} | sheet ${__T.npcOf(c.id) ? __T.npcOf(c.id).who : 'npc.js (T\'Ren)'}`); });
  R.visible = await p.evaluate(() => Object.fromEntries(['bridge', 'engineering', 'medical', 'berthing', 'lounge'].map(d => [d, __T.visibleOn(d).map(n => n.occId)])));
  // deck with several crew wandering: the bridge (T'Ren + 4) and engineering
  await tele(p, 'bridge', 0.495, 0.56); await sleep(9000);
  await shot(p, 'deck-bridge-portrait');
  R.bridgeCrew = await p.evaluate(() => __T.visibleOn('bridge').map(n => ({ id: n.occId, who: n.who, mode: n.mode, spot: n.spot && n.spot.id, x: +n.x.toFixed(3), y: +n.y.toFixed(3) })));
  // CREW sheet with 18 crew grouped by department
  await openSheet(p, 'crew'); await p.evaluate(() => document.querySelector('#relations').scrollIntoView());
  await shot(p, 'crew-portrait');
  await p.evaluate(() => document.querySelector('#relations .dgrp:nth-of-type(5)').scrollIntoView()); await sleep(200);
  await shot(p, 'crew-portrait-2');
  R.crewText = await p.evaluate(() => document.querySelector('#relations').innerText.replace(/\n+/g, ' | '));
  await closeSheet(p);
  // transfer out + arrival in engineering; the newcomer crosses the deck to introduce themself
  await tele(p, 'engineering', 0.45, 0.62); await sleep(1500);
  R.transfer = await p.evaluate(() => { const a = __T.CL.transferOff('kovac', 'utopia'); const G = __T.G; G.prog.crew.pending[0].at = G.ship.elapsed + 3; return { alum: a, fr: G.prog.fleetRep, log: G.log.slice(-1)[0].msg }; });
  await sleep(6000);
  R.arrival = await p.evaluate(() => { const G = __T.G, id = G.prog.crew.slots['engineer-1'], o = G.prog.crew.occ[id]; return { id, name: o && o.name, species: o && o.species, rank: o && o.rank, tags: o && o.tags, intro: o && o.intro, opinion: G.prog.opinions[id], fr: G.prog.fleetRep, log: G.log.slice(-1)[0].msg }; });
  await openSheet(p, 'log'); await sleep(300);
  await shot(p, 'transfer-log');
  await closeSheet(p);
  await p.waitForFunction(() => __T.G.prog.crew.occ[__T.G.prog.crew.slots['engineer-1']].intro === false, null, { timeout: 60000 }).catch(() => {});
  await sleep(1200);
  await p.evaluate(() => { const n = __T.npcOf('engineer-1'), c = __T.cam; if (n) { c.manualT = 60; c.x = (n.x + __T.G.lt.x) / 2 * 960; c.y = (n.y + __T.G.lt.y) / 2 * 640 - 60; } });
  await sleep(300);
  await shot(p, 'intro-chat');
  R.intro = await p.evaluate(() => { const n = __T.npcOf('engineer-1'); return { mode: n && n.mode, kind: n && n.chatKind, line: __T.G.log.filter(e => /^New crewmate/.test(e.msg)).slice(-1)[0]?.msg, distPx: n ? Math.round(Math.hypot((n.x - __T.G.lt.x) * 960, (n.y - __T.G.lt.y) * 640)) : null }; });
  // fleet reputation: more friendly ex-shipmates + a diplomatic visit
  R.fleet = await p.evaluate(() => {
    const CL = __T.CL, G = __T.G;
    CL.transferOff('seo', 'utopia', 'scripted'); CL.transferOff('rhovan', 'ds9ops'); CL.transferOff('grevv', 'intel');
    CL.onDiplomatic('vulcan');
    for (const pe of G.prog.crew.pending) pe.at = G.ship.elapsed + 1;
    return { fr: G.prog.fleetRep, alumni: G.prog.alumni.map(a => `${a.short} ${a.opinion} -> ${a.posting} (+${a.fr})`), perks: CL.perkState(), ds9Mult: CL.ds9Mult() };
  });
  await sleep(2500);
  await openSheet(p, 'crew'); await p.evaluate(() => document.querySelector('#fleet').scrollIntoView()); await sleep(300);
  await shot(p, 'fleet');
  await p.evaluate(() => document.querySelector('#favours').scrollIntoView()); await sleep(200);
  await shot(p, 'favours-before');
  R.favoursBefore = await p.evaluate(() => document.querySelector('#favours').innerText.replace(/\n+/g, ' | '));
  await p.evaluate(() => { const bp = document.querySelector('#boardPanel'); if (bp && !bp.hidden) { document.querySelector('[data-board="face"]').click(); const c = document.querySelector('[data-board="close"]'); if (c) c.click(); } });   // phase 5: a board that convened meanwhile is faced (was a silent promotion)
  const r0 = await p.evaluate(() => __T.G.sp.rep);
  await p.locator('#favours button[data-fav="intel"]').click(); await sleep(250);
  await p.locator('#favours button[data-fav="round"]').click(); await sleep(450);
  await shot(p, 'favours-after');
  R.favoursAfter = await p.evaluate(r0 => ({ repBefore: r0, repAfter: __T.G.sp.rep, lifetime: __T.G.prog.repLifetime, preScanned: __T.G.sp.preScanned, delgado: Math.round(__T.G.prog.opinions.delgado), log: __T.G.log.slice(-2).map(e => e.msg) }), r0);
  await closeSheet(p);
  // parts sinks on the DUTY sheet: kit requests, overhaul, torpedo casing
  R.sinks = await p.evaluate(async () => { const G = __T.G; G.ship.parts = 22; G.prog.reqDay = -1; G.prog.requests = []; G.prog.requests.push({ id: 'mollo', item: 'family holo-projector that flickers', day: G.prog.day }, { id: 'tull', item: 'music player with a dead speaker', day: G.prog.day }); G.ship.torps = 5; return { parts: G.ship.parts }; });
  await openSheet(p, 'duty'); await p.evaluate(() => document.querySelector('#reqBox').scrollIntoView()); await sleep(200);
  await shot(p, 'sinks-before');
  await p.locator('#reqBox button[data-kit="mollo"]').click(); await sleep(200);
  await p.locator('#reqBox button[data-sink="casing"]').click(); await sleep(200);
  await p.locator('#reqBox button[data-sink="overhaul"]').click(); await sleep(400);
  await shot(p, 'sinks-after');
  R.sinksAfter = await p.evaluate(() => ({ parts: __T.G.ship.parts, torps: __T.G.ship.torps, mollo: Math.round(__T.G.prog.opinions.mollo), nextFault: __T.G.ship.nextFault, spent: __T.G.prog.sinks.spent }));
  await closeSheet(p);
  // ---- rule checks (headless, no rendering needed) ----
  R.checks = await p.evaluate(async () => {
    const PR = await import('/js/progression.js'), St = await import('/js/state.js'), sim = await import('/js/sim.js'), CL = __T.CL, G = __T.G;
    const out = {};
    // favour effects
    G.prog.fleetRep = 60; G.sp.rep = 2000; G.prog.alumni.forEach(a => { a.leftPD = -100; });   // ex-shipmates have been promoted elsewhere
    const rd0 = PR.computeReadiness(); out.letter = { ok: CL.callFavour('letter'), bonus: G.prog.readyBonus, rd0, rd1: PR.computeReadiness() };
    out.calibration = { ok: CL.callFavour('calibration'), excellentBonus: PR.perkFx.excellent() };
    G.ship.torps = 3; out.ordnance = { ok: CL.callFavour('ordnance'), torps: G.ship.torps };
    out.dcteam = { ok: CL.callFavour('dcteam'), repairSpeed: PR.perkFx.repairSpeed() };
    out.ear = CL.favourState('ear').why;
    out.callupMult = PR.perkFx.callup(); out.readinessPerk = PR.perkFx.readiness();
    out.deathEligible = CL.deathEligible('doru', 'battle');
    // the daily roll over 200 days of play: caps, seniors protected, positive-only early, no deaths
    St.resetState(); const p = G.prog; const seniors = ['tren', 'okafor', 'diallo', 'hale'];
    const evs = []; PR.hooks.crewEvent = [(k, id) => evs.push({ k, id, pd: p.playDays })];
    for (let d = 1; d <= 200; d++) { p.playDays = d; p.day = d; PR.hooks.newDay.forEach(f => f(d)); PR.hooks.newDay.forEach(f => f(d)); G.ship.elapsed += 5000; CL.tickCrew(0); }
    const roll = evs.filter(e => e.k !== 'arrival');
    let maxWeek = 0; for (let d = 1; d <= 200; d++) maxWeek = Math.max(maxWeek, roll.filter(e => e.pd > d - 7 && e.pd <= d).length);
    let maxDay = 0; for (let d = 1; d <= 200; d++) maxDay = Math.max(maxDay, roll.filter(e => e.pd === d).length);
    out.roll200 = { events: roll.length, perWeek: +(roll.length / (200 / 7)).toFixed(2), byKind: roll.reduce((a, e) => (a[e.k] = (a[e.k] || 0) + 1, a), {}), maxPerDay: maxDay, maxPer7Days: maxWeek,
      seniorsTouched: roll.filter(e => seniors.includes(e.id)).length, demotionsFirst14: roll.filter(e => e.k === 'demotion' && e.pd <= 14).length, firstTransferPD: (roll.find(e => e.k === 'transfer') || {}).pd,
      arrivals: evs.filter(e => e.k === 'arrival').length, crewAboard: PR.crewList().length, alumni: p.alumni.length, fleetRep: p.fleetRep, seniorsAboard: seniors.filter(s => PR.crewList().some(c => c.id === s)).length };
    PR.hooks.crewEvent = [];
    // newcomer opinion nudged by fleet rep
    St.resetState(); G.prog.fleetRep = 14; CL.transferOff('vardock', 'vsa'); const o = CL.arrive('science-tech'); out.newcomer = { fr: G.prog.fleetRep, opinion: G.prog.opinions[o.id], expect: Math.min(15, Math.floor(G.prog.fleetRep * 0.5)), intro: o.intro, name: o.name, species: o.species };
    // offline catch-up lands the replacement and the report lists it
    St.resetState(); CL.transferOff('mollo', 'sb375'); G.prog.crew.pending[0].at = G.ship.elapsed + 600;
    out.offline = null;   // v18: no offline catch-up (retired)
    // generator sample (rarity)
    const sp = {}; for (let i = 0; i < 2000; i++) { const g = CL.genOccupant('crewman'); sp[g.species] = (sp[g.species] || 0) + 1; } out.generator2000 = sp;
    return out;
  });
  // ---- migrations: v3 (phase-2 save) and v1 ----
  for (const v of [3, 1]) {
    await p.evaluate(async v => {
      const St = await import('/js/state.js'); St.resetState(); const old = JSON.parse(JSON.stringify(__T.G)); old.version = v; old.savedAt = Date.now();
      if (v === 1) { delete old.version; delete old.prog; old.stats.repairs = 40; old.stats.nightFixes = 60; }
      else { const q = old.prog; for (const k of ['crew', 'fav', 'readyBonus', 'requests', 'reqDay', 'sinks']) delete q[k]; q.crewExtra = []; q.opinions = { tren: 30, okafor: 44, diallo: 12, hale: 8, thelev: 25 }; q.level = 14; }
      localStorage.setItem(St.SAVE_KEY, JSON.stringify(old));
    }, v);
    await p.goto(BASE + '?debug=1');
    await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
    await sleep(1500);
    R['migrate_v' + v] = await p.evaluate(async () => { window.__noSave = true; const PR = await import('/js/progression.js'); return { version: __T.G.version, level: __T.G.prog.level, crew: PR.crewList().length, opinions: Object.fromEntries(PR.crewList().slice(0, 6).map(c => [c.id, Math.round(PR.opinionOf(c.id))])), thelev: Math.round(PR.opinionOf('thelev')), fleetRep: __T.G.prog.fleetRep, crewExtra: 'crewExtra' in __T.G.prog }; });
  }
  // full-length CREW sheet (tall viewport, for review)
  p = await mk(b, 390, 2600, true);
  await boot(p); await career(p);
  await p.evaluate(() => { __T.CL.transferOff('seo', 'utopia', 'scripted'); __T.CL.transferOff('rhovan', 'ds9ops'); __T.G.prog.crew.pending[1].at = __T.G.ship.elapsed + 1; });
  await sleep(1500);
  await openSheet(p, 'crew'); await p.evaluate(() => { const ps = document.querySelector('#panels'); ps.style.maxHeight = 'none'; ps.style.top = '0'; document.querySelector('#relations').scrollIntoView(); }); await sleep(400);
  await shot(p, 'crew-full');
  issues['390x2600'] = [];   // review capture only
  // ================= landscape =================
  p = await mk(b, 844, 390, true);
  await boot(p); await career(p);
  await tele(p, 'engineering', 0.45, 0.62); await sleep(6000);
  await shot(p, 'deck-engineering-landscape');
  await openSheet(p, 'crew'); await p.evaluate(() => document.querySelector('#relations').scrollIntoView());
  await shot(p, 'crew-landscape');
  // ================= desktop =================
  p = await mk(b, 1280, 800, false);
  await boot(p); await career(p);
  await tele(p, 'lounge', 0.525, 0.4125); await sleep(7000);
  await shot(p, 'deck-lounge-desktop');
  await tele(p, 'bridge', 0.495, 0.56); await sleep(8000);
  await shot(p, 'deck-bridge-desktop');
  await p.evaluate(() => document.querySelector('#relations').scrollIntoView());
  await shot(p, 'crew-desktop');
  R.issues = issues;
  fs.writeFileSync(OUT + 'prog3-report.json', JSON.stringify(R, null, 1));
  console.log(JSON.stringify(R, null, 1));
  await b.close();
})();
