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
  // pass 06: an attentive player gives input every second (the injury clock only runs while PRESENT); idle tests stop this
  await p.evaluate(async () => { const PA = await import('/js/pacing.js'); window.__PA = PA; window.__keepAlive = setInterval(() => PA.playerInput(), 1000); });
  await p.evaluate(() => { const G = __T.G; window.__noSave = true; G.sp.cap.decideT = 1e9; G.ship.nextFault = 1e9; G.sp.ev.nextT = -1; const d = document.querySelector('#debug'); if (d) d.hidden = true; });
}
const shot = (p, name) => p.screenshot({ path: OUT + `prog6-${name}.png` });
// a Lt on day 20 of play with a crew that knows them (favourites = the two highest regular opinions)
const setup = p => p.evaluate(async () => {
  const PR = await import('/js/progression.js'), G = __T.G;
  PR.awardXP(9000, 'manual'); G.prog.rank = 1; __T.CB.applyTier(); G.prog.specOffered = 99; G.prog.playDays = 20; G.prog.presentTotal = 1e6; G.prog.day = 24; G.prog.med.asked = true; G.prog.med.prompt12 = true;
  Object.assign(G.prog.opinions, { tren: 58, okafor: 81, diallo: 66, hale: 40, thelev: 77, tull: 52, kovac: 61, rhovan: 70, mollo: 44 });
  const s = G.prog.crew.slots; return { e1: s['engineer-1'], yeo: s.yeoman, tc: s.transporter, ok: s['chief-engineer'], tren: s.co, favs: __T.MD.favourites() };
}).then(async r => { await sleep(3600); return r; });
const openSheet = async (p, name) => { await p.evaluate(n => document.querySelector(`.sheetBtns [data-sheet="${n}"]`).click(), name); await sleep(450); };
const closeSheet = p => p.evaluate(() => { const c = document.querySelector('#sheetClose'); if (c) c.click(); }).then(() => sleep(300));
const scrollTo = (p, sel, pad = 50) => p.evaluate(([sel, pad]) => { const el = document.querySelector(sel); if (!el) return false; el.scrollIntoView({ block: 'start' }); const ps = document.querySelector('#panels'); ps.scrollTop = Math.max(0, ps.scrollTop - pad); return true; }, [sel, pad]).then(async r => { await sleep(300); return r; });
const goDeck = async (p, node, deck, timeout = 90000) => { await p.evaluate(n => __T.sendUse(n, { force: true }), node); await p.waitForFunction(d => __T.G.lt.deck === d && !__T.G.lt.lift && __T.G.lt.mode !== 'walk', deck, { timeout }); await sleep(900); };
const closeMed = p => p.evaluate(() => { const b = document.querySelector('#medPanel [data-med=close]'); if (b) b.click(); __T.MD.closeScene(); document.querySelector('#medPanel').hidden = true; }).then(() => sleep(250));
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
  await p.evaluate(() => { window.__sc = __T.PROG.deaths.surgery.chance; __T.PROG.deaths.surgery.chance = 0; });   // (test: deterministic save through the surgery roll)
  await p.evaluate(sys => __T.sendRepair(sys), R.warning.sys);
  await p.waitForFunction(sys => !__T.G.ship.faults[sys], R.warning.sys, { timeout: 120000 });
  await p.waitForFunction(id => { const i = __T.MD.injuryOf(id); return !i || i.state !== 'surgery'; }, ids.e1, { timeout: 30000 }); await sleep(500);
  await p.evaluate(() => { __T.PROG.deaths.surgery.chance = window.__sc; }); await closeMed(p);
  await p.evaluate(id => { const i = __T.MD.injuryOf(id); if (i) i.healAt = __T.G.ship.elapsed; }, ids.yeo); await sleep(600);
  R.recovery = await p.evaluate(([e1, op0]) => { const i = __T.MD.injuryOf(e1); return { state: i && i.state, savedBy: i && i.savedBy, opinion: [op0, Math.round(__T.G.prog.opinions[e1])], n: __T.G.prog.med.n, log: __T.G.log.slice(-6).map(e => e.msg) }; }, [ids.e1, op0]);
  await openSheet(p, 'log'); await shot(p, 'recovery'); await closeSheet(p);
  // 5) a death: serious hazard injury, warning seen, nobody fixes the EPS in time, every safeguard allows it
  R.deathSetup = await p.evaluate(id => { const K = __T.PROG.deaths; window.__k = { dc: K.deathChance, mx: K.maxChance }; K.deathChance = 1; K.maxChance = 1; __T.G.prog.med.day = { pd: -1, n: 0 };   // (test: lift the 2-a-day injury cap)
    const i = __T.MD.injure('hazard', { id, sev: 'serious', what: 'the intruder loose in the systems' }); i.seenT = 300; i.ack = true; i.left = 1.2; __PA.playerInput(); return { sys: i.sys, check: __T.MD.deathCheck(id, 'hazard', i), favs: __T.MD.favourites() }; }, ids.tc);
  await sleep(2500);
  await p.evaluate(() => { const K = __T.PROG.deaths; K.deathChance = window.__k.dc; K.maxChance = window.__k.mx; });
  R.deathScene = await p.evaluate(() => ({ phase: (__T.MD.sceneOf() || {}).phase, shown: !document.querySelector('#medPanel').hidden }));
  await closeMed(p);
  R.death = await p.evaluate(id => ({ gone: !__T.G.prog.crew.occ[id], memorial: __T.G.prog.med.memorial.slice(-1)[0], audit: __T.G.prog.med.audit.slice(-1)[0], pending: __T.G.prog.crew.pending.map(x => ({ slot: x.slot, inH: +((x.at - __T.G.ship.elapsed) / 3600).toFixed(1) })), cn: __T.G.prog.crew.rolls.n, log: __T.G.log.slice(-4).map(e => e.msg) }), ids.tc);
  await openSheet(p, 'log'); await shot(p, 'memorial-log'); await closeSheet(p);
  // the Mess & Bar service (memo §2.6): T'Ren's eulogy, Hale's story, a plaque; friends' opinion up
  await goDeck(p, 'mess', 'lounge');
  await p.evaluate(() => { const m = __T.G.prog.med; if (m.memPending) m.memPending.notBefore = __T.G.ship.elapsed + 1; m.hushUntil = 0; });   // (test: skip the 10-minute pause before the service)
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
    out.rules = { day13: why(() => { G.prog.playDays = 13; G.prog.med.lastDeathPD = null; G.prog.med.lastDeathPT = null; }), ltjg: why(() => { G.prog.rank = 0; G.prog.med.lastDeathPD = null; G.prog.med.lastDeathPT = null; }), gap20: why(() => { G.prog.med.lastDeathPD = G.prog.playDays - 20; }), gap21: why(() => { G.prog.med.lastDeathPD = G.prog.playDays - 21; G.prog.med.lastDeathPT = null; G.prog.crew.rolls.hist = []; }),
      gentle: why(() => { G.prog.med.gentle = true; G.prog.med.lastDeathPD = null; G.prog.med.lastDeathPT = null; }), capsDay: why(() => { G.prog.med.lastDeathPD = null; G.prog.med.lastDeathPT = null; G.prog.crew.rolls.hist = [G.prog.playDays]; }), dailyRoll: MD.deathCheck(c.id, 'roll').why,
      favourite: MD.deathCheck(MD.favourites()[0], 'battle').why };
    // pass 06 (c): away / offline the night crew + doctor ALWAYS stabilise; nothing ever dies outside a live, present session
    G.prog.med.lastDeathPD = null; G.prog.med.lastDeathPT = null; G.prog.crew.rolls.hist = [];
    const kc = { dc: K.deathChance, mx: K.maxChance }; K.deathChance = 1; K.maxChance = 1;
    PA.PACE_RT.offline = true; const off = MD.injure('battle', { id: c.id, sev: 'serious', crit: true }); PA.PACE_RT.offline = false;
    const d0 = G.prog.med.n.deaths; SIM.catchUp(3 * 3600);
    out.offlineStabilised = { created: !!off, offlineFlag: off && off.offline, state: MD.injuryOf(c.id) && MD.injuryOf(c.id).state, alive: !!G.prog.crew.occ[c.id], deaths: G.prog.med.n.deaths - d0 };
    // B1 repro: seen + acknowledged for 66 s, 1 s left, then 2 h away with the night crew unable to fix it -> held, then a FRESH window on return
    G.prog.med.inj = []; G.prog.med.day = { pd: -1, n: 0 };
    const keepNF = PA.PACE.nightFix.med; PA.PACE.nightFix.med = 1e9; PA.PACE.nightFix.critToMed = 1e9;
    const i2 = MD.injure('hazard', { id: c.id, sev: 'serious' }); i2.ack = true; i2.seenT = 66; i2.ackT = 66; i2.left = 1;
    SIM.catchUp(2 * 3600);
    const held = MD.injuryOf(c.id); out.offlineAfterSeen = { alive: !!G.prog.crew.occ[c.id], state: held && held.state, away: held && held.away, deaths: G.prog.med.n.deaths - d0 };
    PA.playerInput(); SIM.stepSim(0.1);
    out.freshOnReturn = { left: held && Math.round(held.left), ack: held && held.ack, window: 1 };   // pass 07: resumes at the 1 s it paused on (never a fresh, longer window), and needs seeing again before it runs
    // B2 repro: visible but idle (no input) for 300 s with 5 s left: the clock stops at 60 s idle, nobody dies
    held.ack = true; held.left = 5; PA.PACE_RT.idleT = 59;
    for (let t = 0; t < 3000; t++) SIM.stepSim(0.1);
    out.idleNoDeath = { alive: !!G.prog.crew.occ[c.id], left: MD.injuryOf(c.id) && +MD.injuryOf(c.id).left.toFixed(1), idleT: Math.round(PA.PACE_RT.idleT), deaths: G.prog.med.n.deaths - d0 };
    // hidden (document.hidden / visibility): never present
    PA.playerInput(); PA.PACE_RT.hidden = true; out.hiddenCheck = MD.deathCheck(c.id, 'hazard', MD.injuryOf(c.id)).why; PA.PACE_RT.hidden = false;
    PA.PACE.nightFix.med = keepNF; PA.PACE.nightFix.critToMed = 900; G.prog.med.inj = []; G.prog.med.day = { pd: -1, n: 0 }; PA.playerInput();
    // cap: a second death inside 21 days of play is impossible -> pulled through instead
    const d2 = occ().find(x => !MD.favourites().includes(x.id)); G.prog.crew.rolls.hist = [];
    G.prog.med.lastDeathPD = G.prog.playDays - 5;
    const i3 = MD.injure('battle', { id: d2.id, sev: 'serious', crit: true }); i3.seenT = 300; i3.ack = true; i3.left = 0.01; G.prog.med.day = { pd: -1, n: 0 };
    for (let t = 0; t < 4; t++) { PA.playerInput(); SIM.stepSim(0.25); }
    out.gapCap = { alive: !!G.prog.crew.occ[d2.id], state: MD.injuryOf(d2.id) && MD.injuryOf(d2.id).state, lastDeathPD: G.prog.med.lastDeathPD, pd: G.prog.playDays };
    // favourite: worst case = transferred to a starbase hospital (feeds Fleet Rep); gentle: evacuated to a hospital ship
    G.prog.med.lastDeathPD = null; G.prog.med.lastDeathPT = null; G.prog.crew.rolls.hist = []; G.prog.med.inj = []; G.prog.med.day = { pd: -1, n: 0 };
    const fav = MD.favourites()[0], fr0 = G.prog.fleetRep, i4 = MD.injure('battle', { id: fav, sev: 'serious', crit: true }); i4.seenT = 300; i4.ack = true; i4.left = 0.01;
    for (let t = 0; t < 4; t++) { PA.playerInput(); SIM.stepSim(0.25); }
    const al = G.prog.alumni.slice(-1)[0]; out.favourite = { aboard: !!G.prog.crew.occ[fav], posting: al && al.id === fav ? al.posting : null, fleetRep: [fr0, G.prog.fleetRep] };
    G.prog.crew.rolls.hist = []; G.prog.med.day = { pd: -1, n: 0 }; MD.setGentle(true);
    const g = occ().find(x => !MD.favourites().includes(x.id)), i5 = MD.injure('battle', { id: g.id, sev: 'serious', crit: true }); i5.seenT = 300; i5.ack = true; i5.left = 0.01;
    for (let t = 0; t < 4; t++) { PA.playerInput(); SIM.stepSim(0.25); }
    const al2 = G.prog.alumni.slice(-1)[0]; out.gentle = { aboard: !!G.prog.crew.occ[g.id], posting: al2 && al2.id === g.id ? al2.posting : null, deaths: G.prog.med.n.deaths };
    MD.setGentle(false); K.deathChance = kc.dc; K.maxChance = kc.mx; MD.closeScene();
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
    await p.evaluate(ids => { const K = __T.PROG.deaths, kc = [K.deathChance, K.maxChance]; K.deathChance = 1; K.maxChance = 1; const i = __T.MD.injure('hazard', { id: ids.tc, sev: 'serious' }); i.seenT = 300; i.ack = true; i.left = 0.5; window.__kc = kc; __PA.playerInput(); }, id2);
    await sleep(1500); await closeMed(p);
    await p.evaluate(ids => { const K = __T.PROG.deaths; [K.deathChance, K.maxChance] = window.__kc; __T.G.prog.med.day = { pd: -1, n: 0 }; __T.MD.injure('battle', { id: ids.e1, sev: 'serious', crit: true }); __T.MD.injure('hazard', { id: ids.yeo, sev: 'minor' }); }, id2);
    await goDeck(p, 'biobed', 'medical'); await p.evaluate(() => { __T.G.lt.mode = 'idle'; __T.G.lt.node = null; __T.G.lt.x = 0.42; __T.G.lt.y = 0.52; }); await sleep(900);
    await shot(p, `medical-${tag}`);
    await openSheet(p, 'crew'); await scrollTo(p, '#relations .rel.inj', 90); await shot(p, `crew-injured-${tag}`);
    await scrollTo(p, '#memoriam', 90); await shot(p, `in-memoriam-${tag}`); await closeSheet(p);
    await p.close();
  }
  R.issues = issues;
  // pass 06: no death resolves while not present (every audited death), plus the presence/away behaviour above
  const C = R.checks, aud = (R.death && R.death.audit ? [R.death.audit] : []);
  R.asserts = {
    deathAuditPresent: aud.every(a => a.present === true && !a.offline && !a.hidden && a.ack === true),
    offlineStabilised: C.offlineStabilised.alive && C.offlineStabilised.deaths === 0 && C.offlineStabilised.state === 'stable',
    offlineAfterSeenHeld: C.offlineAfterSeen.alive && C.offlineAfterSeen.deaths === 0 && C.offlineAfterSeen.state === 'warning' && C.offlineAfterSeen.away === true,
    freshWindowOnReturn: C.freshOnReturn.left <= Math.max(C.freshOnReturn.window, 30) && C.freshOnReturn.ack === false,   // pass 07: the clock resumes (never longer than before), needs seeing again; pass 08 (3): except the one-time 30 s return floor
    idlePausesClock: C.idleNoDeath.alive && C.idleNoDeath.deaths === 0 && C.idleNoDeath.left > 0,
    hiddenNotPresent: C.hiddenCheck === 'not present',
    deathScene: R.deathScene && R.deathScene.phase === 'lost' && R.deathScene.shown,
    gapCap: C.gapCap.alive, favourite: !C.favourite.aboard && C.favourite.posting === 'hospital', gentle: !C.gentle.aboard && C.gentle.deaths === C.n.deaths,
    zeroErrors: Object.values(issues).every(a => a.length === 0),
  };
  R.ok = Object.values(R.asserts).every(Boolean);
  fs.writeFileSync(OUT + 'prog6-report.json', JSON.stringify(R, null, 1));
  console.log(JSON.stringify(R, null, 1));
  console.log(R.ok ? 'PROG6 PASS (deaths ON)' : 'PROG6 FAIL ' + JSON.stringify(R.asserts));
  if (!R.ok) process.exitCode = 1;
  await b.close();
})();
