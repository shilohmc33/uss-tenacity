// Progression phase 6 (crew injuries + deaths with the memo's safeguards) verification + proof shots
// -> shots/prog6-*.png, shots/prog6-report.json.   NODE_PATH=/workspace/pwtools/node_modules node tools/prog6-shots.js [base]
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const issues = {}, R = {};
async function mk(b, w, h, mobile) {
  const tag = `${w}x${h}`; issues[tag] = issues[tag] || [];
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) issues[tag].push(`console.${m.type()}: ${m.text()}`); });
  p.on('pageerror', e => issues[tag].push(`pageerror: ${e.message}`));
  p.on('response', r => { if (r.status() >= 400) issues[tag].push(`HTTP ${r.status()} ${r.url()}`); });
  return p;
}
const ready = p => p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
async function boot(p, q = '?debug=1&reset=1') {
  await p.goto(BASE + q); await ready(p); await p.evaluate(() => { __T.PROG.deaths.enabled = true; }); await sleep(400);   // phase 6 is WIP: off by default
  await p.evaluate(() => { const G = __T.G; window.__noSave = true; G.sp.cap.decideT = 1e9; G.ship.nextFault = 1e9; G.sp.ev.nextT = -1; const d = document.querySelector('#debug'); if (d) d.hidden = true; });
}
const shot = (p, name) => p.screenshot({ path: OUT + `prog6-${name}.png` });
// a Lt on day 20 of play with a crew that knows them (favourites = the two highest regular opinions)
const setup = p => p.evaluate(async () => {
  const PR = await import('/js/progression.js'), G = __T.G;
  PR.awardXP(9000, 'manual'); G.prog.rank = 1; __T.CB.applyTier(); G.prog.specOffered = 99; G.prog.playDays = 20; G.prog.day = 24; G.prog.med.asked = true;
  Object.assign(G.prog.opinions, { tren: 58, okafor: 81, diallo: 66, hale: 40, thelev: 77, tull: 52, kovac: 61, rhovan: 70, mollo: 44 });
  const s = G.prog.crew.slots; return { e1: s['engineer-1'], yeo: s.yeoman, tc: s.transporter, ok: s['chief-engineer'], tren: s.co, favs: __T.MD.favourites() };
}).then(async r => { await sleep(3600); return r; });
const openSheet = async (p, name) => { await p.evaluate(n => document.querySelector(`.sheetBtns [data-sheet="${n}"]`).click(), name); await sleep(450); };
const closeSheet = p => p.evaluate(() => { const c = document.querySelector('#sheetClose'); if (c) c.click(); }).then(() => sleep(300));
const scrollTo = (p, sel, pad = 50) => p.evaluate(([sel, pad]) => { const el = document.querySelector(sel); if (!el) return false; el.scrollIntoView({ block: 'start' }); const ps = document.querySelector('#panels'); ps.scrollTop = Math.max(0, ps.scrollTop - pad); return true; }, [sel, pad]).then(async r => { await sleep(300); return r; });
const goDeck = async (p, node, deck, timeout = 90000) => { await p.evaluate(n => __T.sendUse(n, { force: true }), node); await p.waitForFunction(d => __T.G.lt.deck === d && !__T.G.lt.lift && __T.G.lt.mode !== 'walk', deck, { timeout }); await sleep(900); };
const logHas = (p, re) => p.evaluate(re => __T.G.log.slice(-40).some(e => new RegExp(re).test(e.msg)), re);
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  // ================= portrait: the whole story =================
  let p = await mk(b, 390, 844, true);
  await boot(p);
  const ids = R.ids = await setup(p);
  // 1) serious battle injury -> warning (toast, sickbay alert, life-critical duty row)
  R.warning = await p.evaluate(id => { const inj = __T.MD.injure('battle', { id, sev: 'serious', crit: true, sys: null, what: 'a polaron hit that came through the shields on the engineering deck' }); return inj && { sev: inj.sev, sys: inj.sys, state: inj.state, seen: inj.seen, left: inj.left, pri: __T.G.ship.faults[inj.sys] && inj.sys }; }, ids.e1);
  await sleep(250); await shot(p, 'injury-warning');
  R.warningLog = await p.evaluate(() => __T.G.log.slice(-3).map(e => e.msg));
  await openSheet(p, 'duty'); await shot(p, 'injury-duty');
  R.dutyText = await p.evaluate(() => document.querySelector('#dutyBody').innerText.replace(/\n+/g, ' | '));
  await closeSheet(p);
  // a minor hazard injury too (two patients in sickbay)
  R.minor = await p.evaluate(id => { const i = __T.MD.injure('hazard', { id, sev: 'minor', what: 'the subspace shear' }); return i && { sev: i.sev, healIn: Math.round(i.healAt - __T.G.ship.elapsed) }; }, ids.yeo);
  // 2) injured crew on the biobeds (the Lt visits: opinion +, lower risk)
  await goDeck(p, 'biobed', 'medical');
  await p.evaluate(() => { __T.G.lt.mode = 'idle'; __T.G.lt.node = null; __T.G.lt.x = 0.42; __T.G.lt.y = 0.52; }); await sleep(900);
  await shot(p, 'medical-biobed');
  R.visit = await p.evaluate(id => ({ visited: __T.MD.injuryOf(id).visited, ambientHidden: !__T.ambient.some(a => a.occId === id) }), ids.e1);
  // 3) CREW sheet: Injured status
  await openSheet(p, 'crew'); await scrollTo(p, '#relations .rel.inj', 90);
  await shot(p, 'crew-injured');
  R.crewText = await p.evaluate(() => [...document.querySelectorAll('#relations .rel.inj')].map(r => r.innerText.replace(/\n+/g, ' ')));
  await closeSheet(p);
  // 4) recovery: the Lt fixes the coolant line in time -> saved (opinion jump); the minor patient is discharged
  const op0 = await p.evaluate(id => __T.G.prog.opinions[id], ids.e1);
  await p.evaluate(sys => __T.sendRepair(sys), R.warning.sys);
  await p.waitForFunction(sys => !__T.G.ship.faults[sys], R.warning.sys, { timeout: 120000 }); await sleep(800);
  await p.evaluate(id => { const i = __T.MD.injuryOf(id); if (i) i.healAt = __T.G.ship.elapsed; }, ids.yeo); await sleep(600);
  R.recovery = await p.evaluate(([e1, op0]) => { const i = __T.MD.injuryOf(e1); return { state: i && i.state, savedBy: i && i.savedBy, opinion: [op0, Math.round(__T.G.prog.opinions[e1])], n: __T.G.prog.med.n, log: __T.G.log.slice(-6).map(e => e.msg) }; }, [ids.e1, op0]);
  await openSheet(p, 'log'); await shot(p, 'recovery'); await closeSheet(p);
  // 5) a death: serious hazard injury, warning seen, nobody fixes the EPS in time, every safeguard allows it
  R.deathSetup = await p.evaluate(id => { const K = __T.PROG.deaths; window.__k = { dc: K.deathChance, mx: K.maxChance }; K.deathChance = 1; K.maxChance = 1; __T.G.prog.med.day = { pd: -1, n: 0 };   // (test: lift the 2-a-day injury cap)
    const i = __T.MD.injure('hazard', { id, sev: 'serious', what: 'the intruder loose in the systems' }); i.seenT = 300; i.left = 1.2; return { sys: i.sys, check: __T.MD.deathCheck(id, 'hazard', i), favs: __T.MD.favourites() }; }, ids.tc);
  await sleep(2500);
  await p.evaluate(() => { const K = __T.PROG.deaths; K.deathChance = window.__k.dc; K.maxChance = window.__k.mx; });
  R.death = await p.evaluate(id => ({ gone: !__T.G.prog.crew.occ[id], memorial: __T.G.prog.med.memorial.slice(-1)[0], audit: __T.G.prog.med.audit.slice(-1)[0], pending: __T.G.prog.crew.pending.map(x => ({ slot: x.slot, inH: +((x.at - __T.G.ship.elapsed) / 3600).toFixed(1) })), cn: __T.G.prog.crew.rolls.n, log: __T.G.log.slice(-4).map(e => e.msg) }), ids.tc);
  await openSheet(p, 'log'); await shot(p, 'memorial-log'); await closeSheet(p);
  // the Mess & Bar service (memo §2.6): T'Ren's eulogy, Hale's story, a plaque; friends' opinion up
  await goDeck(p, 'mess', 'lounge');
  await p.waitForFunction(() => !__T.G.prog.med.memPending, null, { timeout: 20000 }).catch(() => {});
  R.service = await p.evaluate(() => ({ plaque: __T.G.prog.med.memorial.slice(-1)[0].plaque, attended: !!__T.G.prog.med.memorial.slice(-1)[0].attended, log: __T.G.log.slice(-4).map(e => e.msg) }));
  await openSheet(p, 'log'); await shot(p, 'memorial-service'); await closeSheet(p);
  // 6) In Memoriam on the CREW sheet
  await openSheet(p, 'crew'); R.memSec = await scrollTo(p, '#memoriam', 90); await shot(p, 'in-memoriam');
  R.memText = await p.evaluate(() => document.querySelector('#memoriam').innerText.replace(/\n+/g, ' | '));
  await scrollTo(p, '#safety', 90); await shot(p, 'crew-safety');
  R.safetyText = await p.evaluate(() => document.querySelector('#safety').innerText.replace(/\n+/g, ' | '));
  await closeSheet(p);
  // 7) the replacement transfers in later (existing generator)
  await p.evaluate(() => { for (const x of __T.G.prog.crew.pending) x.at = __T.G.ship.elapsed + 0.5; }); await sleep(1500);
  R.replacement = await p.evaluate(slot => { const id = __T.G.prog.crew.slots[slot], o = id && __T.G.prog.crew.occ[id]; return { slot, who: o && o.name, intro: o && o.intro, log: __T.G.log.slice(-2).map(e => e.msg) }; }, R.death.memorial ? 'transporter' : 'transporter');
  await openSheet(p, 'log'); await shot(p, 'replacement'); await closeSheet(p);
  // ================= safeguard checks (same page) =================
  R.checks = await p.evaluate(async ids => {
    const MD = __T.MD, G = __T.G, PR = await import('/js/progression.js'), PA = await import('/js/pacing.js'), SIM = await import('/js/sim.js'), K = __T.PROG.deaths, out = {};
    const occ = () => PR.crewList().filter(c => !c.senior && !MD.isInjured(c.id));
    // seniors: never killed, T'Ren never hurt, the others only minor
    out.trenNeverHurt = MD.injure('battle', { id: ids.tren, sev: 'serious', crit: true }) === null;
    const ok = MD.injure('battle', { id: ids.ok, sev: 'serious', crit: true }); out.seniorMinorOnly = ok && ok.sev === 'minor';
    out.seniorDeathCheck = MD.deathCheck(ids.ok, 'battle').why;
    G.prog.med.inj = []; G.prog.med.day = { pd: -1, n: 0 };
    // eligibility rules
    const c = occ().find(x => !MD.favourites().includes(x.id));
    const why = mut => { const keep = JSON.parse(JSON.stringify({ pd: G.prog.playDays, rank: G.prog.rank, last: G.prog.med.lastDeathPD, g: G.prog.med.gentle, hist: G.prog.crew.rolls.hist })); mut(); const r = MD.deathCheck(c.id, 'battle').why || 'ok'; G.prog.playDays = keep.pd; G.prog.rank = keep.rank; G.prog.med.lastDeathPD = keep.last; G.prog.med.gentle = keep.g; G.prog.crew.rolls.hist = keep.hist; return r; };
    out.rules = { day13: why(() => { G.prog.playDays = 13; G.prog.med.lastDeathPD = null; }), ltjg: why(() => { G.prog.rank = 0; G.prog.med.lastDeathPD = null; }), gap20: why(() => { G.prog.med.lastDeathPD = G.prog.playDays - 20; }), gap21: why(() => { G.prog.med.lastDeathPD = G.prog.playDays - 21; G.prog.crew.rolls.hist = []; }),
      gentle: why(() => { G.prog.med.gentle = true; G.prog.med.lastDeathPD = null; }), capsDay: why(() => { G.prog.med.lastDeathPD = null; G.prog.crew.rolls.hist = [G.prog.playDays]; }), dailyRoll: MD.deathCheck(c.id, 'roll').why,
      favourite: MD.deathCheck(MD.favourites()[0], 'battle').why };
    // offline: an injury that happens while away waits for the player (no clock, never a death)
    G.prog.med.lastDeathPD = null; G.prog.crew.rolls.hist = [];
    const keepNF = PA.PACE.nightFix.med; PA.PACE.nightFix.med = 1e9; PA.PACE.nightFix.critToMed = 1e9;
    PA.PACE_RT.offline = true; const off = MD.injure('battle', { id: c.id, sev: 'serious', crit: true }); PA.PACE_RT.offline = false;
    const kc = { dc: K.deathChance, mx: K.maxChance }; K.deathChance = 1; K.maxChance = 1;
    SIM.catchUp(3 * 3600);
    out.offlineHold = { created: !!off, offlineFlag: off.offline, stillWarning: MD.isInjured(c.id) && MD.injuryOf(c.id).state === 'warning', left: MD.injuryOf(c.id) && MD.injuryOf(c.id).left, seen: MD.injuryOf(c.id) && MD.injuryOf(c.id).seen, alive: !!G.prog.crew.occ[c.id] };
    // seen only briefly (< offlineMinSeen) then away: still no clock offline
    const i2 = MD.injuryOf(c.id); i2.seen = true; i2.seenT = 20; i2.left = 30; SIM.catchUp(1800);
    out.offlineBriefSeen = { left: MD.injuryOf(c.id) && Math.round(MD.injuryOf(c.id).left), alive: !!G.prog.crew.occ[c.id] };
    // seen long enough in a prior session: the clock may run while away (death allowed; the night crew couldn't fix it here)
    i2.seenT = 120; SIM.catchUp(600);
    out.offlineAfterSeen = { resolved: !MD.injuryOf(c.id) || MD.injuryOf(c.id).state !== 'warning', alive: !!G.prog.crew.occ[c.id], audit: G.prog.med.audit.slice(-1)[0] };
    // cap: a second death inside 21 days of play is impossible -> pulled through instead
    const d2 = occ().find(x => !MD.favourites().includes(x.id)); G.prog.crew.rolls.hist = [];
    const i3 = MD.injure('battle', { id: d2.id, sev: 'serious', crit: true }); i3.seenT = 300; i3.left = 0.01; G.prog.med.day = { pd: -1, n: 0 };
    for (let t = 0; t < 4; t++) SIM.stepSim(0.25);
    out.gapCap = { alive: !!G.prog.crew.occ[d2.id], state: MD.injuryOf(d2.id) && MD.injuryOf(d2.id).state, lastDeathPD: G.prog.med.lastDeathPD, pd: G.prog.playDays };
    // favourite: worst case = transferred to a starbase hospital (feeds Fleet Rep); gentle: evacuated to a hospital ship
    G.prog.med.lastDeathPD = null; G.prog.crew.rolls.hist = []; G.prog.med.inj = []; G.prog.med.day = { pd: -1, n: 0 };
    const fav = MD.favourites()[0], fr0 = G.prog.fleetRep, i4 = MD.injure('battle', { id: fav, sev: 'serious', crit: true }); i4.seenT = 300; i4.left = 0.01;
    for (let t = 0; t < 4; t++) SIM.stepSim(0.25);
    const al = G.prog.alumni.slice(-1)[0]; out.favourite = { aboard: !!G.prog.crew.occ[fav], posting: al && al.id === fav ? al.posting : null, fleetRep: [fr0, G.prog.fleetRep] };
    G.prog.crew.rolls.hist = []; G.prog.med.day = { pd: -1, n: 0 }; MD.setGentle(true);
    const g = occ().find(x => !MD.favourites().includes(x.id)), i5 = MD.injure('battle', { id: g.id, sev: 'serious', crit: true }); i5.seenT = 300; i5.left = 0.01;
    for (let t = 0; t < 4; t++) SIM.stepSim(0.25);
    const al2 = G.prog.alumni.slice(-1)[0]; out.gentle = { aboard: !!G.prog.crew.occ[g.id], posting: al2 && al2.id === g.id ? al2.posting : null, deaths: G.prog.med.n.deaths };
    MD.setGentle(false); K.deathChance = kc.dc; K.maxChance = kc.mx; PA.PACE.nightFix.med = keepNF; PA.PACE.nightFix.critToMed = 900;
    // the daily crew roll has no health path: 200 rolls injure nobody
    const n0 = G.prog.med.n.injuries; for (let k = 0; k < 200; k++) __T.CL.crewEvent(); out.dailyRollInjuries = G.prog.med.n.injuries - n0;
    out.n = G.prog.med.n; out.deathsAudited = G.prog.med.audit.length;
    return out;
  }, ids);
  // migration v6 -> v7 (no sickbay state yet) and v1 -> v7
  R.migrate = await p.evaluate(async () => {
    const St = await import('/js/state.js'), G = __T.G, keep = JSON.stringify(G), out = {};
    const v6 = JSON.parse(keep); v6.version = 6; delete v6.prog.med; localStorage.setItem(St.SAVE_KEY, JSON.stringify(v6));
    out.v6 = { ok: St.loadGame(), version: G.version, med: !!G.prog.med && Array.isArray(G.prog.med.inj) && G.prog.med.memorial.length === 0, gentle: G.prog.med.gentle };
    const v1 = { version: 1, stats: { repairs: 40, events: 6, nightFixes: 10 }, sp: { rep: 30 } }; localStorage.setItem(St.SAVE_KEY, JSON.stringify(v1));
    out.v1 = { ok: St.loadGame(), version: G.version, med: !!G.prog.med, inj: G.prog.med.inj.length };
    localStorage.setItem(St.SAVE_KEY, keep); St.loadGame(); localStorage.removeItem(St.SAVE_KEY);
    return out;
  });
  await p.close();
  // ================= landscape + desktop: sickbay and the CREW sheet =================
  for (const [w, h, mob, tag] of [[844, 390, true, 'landscape'], [1280, 800, false, 'desktop']]) {
    p = await mk(b, w, h, mob); await boot(p); const id2 = await setup(p);
    await p.evaluate(ids => { const K = __T.PROG.deaths, kc = [K.deathChance, K.maxChance]; K.deathChance = 1; K.maxChance = 1; const i = __T.MD.injure('hazard', { id: ids.tc, sev: 'serious' }); i.seenT = 300; i.left = 0.5; window.__kc = kc; }, id2);
    await sleep(1500);
    await p.evaluate(ids => { const K = __T.PROG.deaths; [K.deathChance, K.maxChance] = window.__kc; __T.G.prog.med.day = { pd: -1, n: 0 }; __T.MD.injure('battle', { id: ids.e1, sev: 'serious', crit: true }); __T.MD.injure('hazard', { id: ids.yeo, sev: 'minor' }); }, id2);
    await goDeck(p, 'biobed', 'medical'); await p.evaluate(() => { __T.G.lt.mode = 'idle'; __T.G.lt.node = null; __T.G.lt.x = 0.42; __T.G.lt.y = 0.52; }); await sleep(900);
    await shot(p, `medical-${tag}`);
    await openSheet(p, 'crew'); await scrollTo(p, '#relations .rel.inj', 90); await shot(p, `crew-injured-${tag}`);
    await scrollTo(p, '#memoriam', 90); await shot(p, `in-memoriam-${tag}`); await closeSheet(p);
    await p.close();
  }
  R.issues = issues;
  fs.writeFileSync(OUT + 'prog6-report.json', JSON.stringify(R, null, 1));
  console.log(JSON.stringify(R, null, 1));
  await b.close();
})();
