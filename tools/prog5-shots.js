// Progression phase 5 (promotion boards + specialisations) verification + proof shots -> shots/prog5-*.png, shots/prog5-report.json
// NODE_PATH=/workspace/pwtools/node_modules node tools/prog5-shots.js [base]
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
const ready = p => p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
async function boot(p, q = '?debug=1&reset=1') {
  await p.goto(BASE + q); await ready(p); await sleep(400);
  await p.evaluate(() => { const G = __T.G; window.__noSave = true; G.sp.cap.decideT = 1e9; G.ship.nextFault = 1e9; G.sp.ev.nextT = -1; const d = document.querySelector('#debug'); if (d) d.hidden = true; });
}
const shot = (p, name, clip) => p.screenshot({ path: OUT + `prog5-${name}.png`, ...(clip ? { clip } : {}) });
// a strong Lt (rank 1, level 19, readiness 100) or Lt Cmdr (rank 2, level 29) ready for the next board
const career = (p, rank = 1, xp = 26000) => p.evaluate(async ([rank, xp]) => {
  const PR = await import('/js/progression.js'), G = __T.G;
  PR.awardXP(xp, 'manual'); G.prog.rank = rank; __T.CB.applyTier();
  G.prog.specOffered = 99;   // keep the spec picker out of the board shots
  Object.assign(G.prog.opinions, { tren: 58, okafor: 81, diallo: 66, hale: 40, thelev: 77, tull: 52, kovac: 61, rhovan: 70, mollo: 44 });
  G.prog.perf.q = 0.9; G.prog.perf.resp = 0.9; G.prog.service = 5; G.prog.repLifetime = 12000; G.prog.rankSince.rep = 0; G.sp.rep = 1400; G.prog.playDays = 20; if (G.prog.med) G.prog.med.prompt12 = true; G.stats.repairs = 412; G.prog.quality.excellent = 96;
  return PR.computeReadiness();
}, [rank, xp]).then(async r => { await sleep(1500); return r; });
const callBoard = p => p.evaluate(async () => { const PR = await import('/js/progression.js'); const ok = PR.promotionDue('readiness'); return { ok, board: __T.G.prog.board && { to: __T.G.prog.board.to, chair: __T.G.prog.board.chair, queued: __T.G.prog.board.queued } }; }).then(async r => { await sleep(900); return r; });
// face the board with a fixed roll (0.01 -> pass, 0.999 -> fail unless forced)
const face = (p, roll) => p.evaluate(roll => { const mr = Math.random; Math.random = () => roll; try { document.querySelector('[data-board="face"]').click(); } finally { Math.random = mr; } return { rank: __T.G.prog.rank, last: __T.G.prog.boardLog.slice(-1)[0], readiness: __T.G.prog.readiness, cd: __T.G.prog.boardCd, malus: __T.G.prog.boardMalus, text: document.querySelector('#boardBody').innerText.replace(/\n+/g, ' | ') }; }, roll).then(async r => { await sleep(500); return r; });
const dismiss = p => p.evaluate(() => { const b = document.querySelector('[data-board="close"]'); if (b) b.click(); }).then(() => sleep(400));
const openSheet = async (p, name) => { await p.evaluate(n => document.querySelector(`.sheetBtns [data-sheet="${n}"]`).click(), name); await sleep(400); };
const closeSheet = p => p.evaluate(() => { const c = document.querySelector('#sheetClose'); if (c) c.click(); }).then(() => sleep(300));
const modalFits = (p, sel) => p.evaluate(sel => { const c = document.querySelector(sel + ' .card'), r = c.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), vw: innerWidth, vh: innerHeight, scrolls: c.scrollHeight > c.clientHeight + 1, inView: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth }; }, sel);
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  // ================= portrait =================
  let p = await mk(b, 390, 844, true);
  await boot(p);
  R.readiness = await career(p);
  R.board1 = await callBoard(p);
  R.board1.modal = await p.evaluate(() => !document.querySelector('#boardPanel').hidden);
  R.board1.fit = await modalFits(p, '#boardPanel');
  R.board1.text = await p.evaluate(() => document.querySelector('#boardBody').innerText.replace(/\n+/g, ' | '));
  await shot(p, 'board-portrait');
  R.fail = await face(p, 0.999);
  await shot(p, 'board-fail');
  await dismiss(p);
  // the CREW sheet shows the failed board, cooldown and penalty
  await openSheet(p, 'crew'); await p.evaluate(() => { document.querySelector('#career').scrollIntoView({ block: 'start' }); const ps = document.querySelector('#panels'); ps.scrollTop = Math.max(0, ps.scrollTop - 60); }); await sleep(300);
  await shot(p, 'board-fail-crew');
  R.failCareer = await p.evaluate(() => document.querySelector('#career').innerText.replace(/\n+/g, ' | '));
  await closeSheet(p);
  // gate: no board during the cooldown; penalty fades daily; after the cooldown the board sits again and passes
  R.gate = await p.evaluate(async () => {
    const PR = await import('/js/progression.js'), G = __T.G, out = {};
    out.blocked = PR.promotionDue('readiness') === false && !G.prog.board;
    const days = []; for (let i = 0; i < 4; i++) { G.prog.day++; PR.hooks.newDay.forEach(f => f(G.prog.day)); days.push({ day: G.prog.day, malus: G.prog.boardMalus, readiness: PR.computeReadiness() }); }
    out.decay = days; return out;
  });
  await sleep(1500);   // tickProg (r >= 100) re-convenes the board by itself
  R.board2 = await p.evaluate(() => ({ board: __T.G.prog.board && __T.G.prog.board.to, modal: !document.querySelector('#boardPanel').hidden }));
  if (!R.board2.board) R.board2.forced = await callBoard(p);
  await sleep(500);
  R.pass = await face(p, 0.01);
  await shot(p, 'board-pass');
  await dismiss(p); await sleep(2500);
  R.afterPass = await p.evaluate(() => ({ rank: __T.G.prog.rank, tier: __T.G.prog.cabin.tier, hist: __T.G.prog.history.slice(-1)[0], log: __T.G.log.slice(-6).map(e => e.msg) }));
  // specialisation picker (level 29 now: picks at 10 and 20 owed)
  await p.evaluate(() => { __T.G.prog.specOffered = 0; }); await sleep(800);
  R.spec = { open: await p.evaluate(() => !document.querySelector('#specPanel').hidden), pending: await p.evaluate(() => __T.BD.specPending()), fit: await modalFits(p, '#specPanel') };
  await shot(p, 'spec-picker');
  await p.evaluate(() => document.querySelector('[data-spick="warp"]').click()); await sleep(300);
  await shot(p, 'spec-picker-second');
  await p.evaluate(() => document.querySelector('[data-spick="warp"]').click()); await sleep(400);
  R.spec.after = await p.evaluate(() => ({ spec: __T.G.prog.spec, picks: __T.G.prog.specPicks, pending: __T.BD.specPending(), open: !document.querySelector('#specPanel').hidden, fx: { core: __T.G.prog && null } }));
  R.spec.effect = await p.evaluate(async () => { const PR = await import('/js/progression.js'); return { warpcore: PR.specFx('warpcore'), shields: PR.specFx('shields'), mult: { warpcore: +PR.repairMult('warpcore').toFixed(3), shields: +PR.repairMult('shields').toFixed(3) }, odds: { base: PR.qualityOdds(__T.G.prog.level, true) } }; });
  // the spec in the LT tile (tooltip) and the CREW sheet's service record
  await sleep(400);
  R.ltTile = await p.evaluate(() => { const t = document.querySelector('.stat[data-stat="level"]'); return { title: t.title, text: t.innerText.replace(/\n/g, ' '), spec: document.querySelector('#v-level').dataset.spec }; });
  await shot(p, 'spec-lt-tile', { x: 0, y: 0, width: 390, height: 120 });
  await openSheet(p, 'crew'); await p.evaluate(() => { document.querySelector('#career').scrollIntoView({ block: 'start' }); const ps = document.querySelector('#panels'); ps.scrollTop = Math.max(0, ps.scrollTop - 60); }); await sleep(300);
  await shot(p, 'spec-crew');
  R.specCareer = await p.evaluate(() => document.querySelector('#career').innerText.replace(/\n+/g, ' | '));
  await closeSheet(p);
  // ---- queued board after offline: save an eligible Lt, come back 3 h later ----
  await p.evaluate(async () => {
    const St = await import('/js/state.js'), PR = await import('/js/progression.js'), G = __T.G; St.resetState();
    PR.awardXP(26000, 'manual'); G.prog.rank = 1; G.prog.specOffered = 99;
    Object.assign(G.prog.opinions, { tren: 58, okafor: 81, diallo: 66, hale: 40, thelev: 77, tull: 52 });
    G.prog.perf.q = 0.9; G.prog.perf.resp = 0.9; G.prog.service = 5; G.prog.repLifetime = 12000; G.prog.rankSince.rep = 0; G.prog.playDays = 20;
    G.prog.spec = { warp: 1 }; G.prog.specPicks = 2;
    G.savedAt = Date.now() - 3 * 3600 * 1000; G.prog.lastSeen = G.savedAt; localStorage.setItem(St.SAVE_KEY, JSON.stringify(G));
  });
  await p.goto(BASE + '?debug=1'); await ready(p); await sleep(1200);
  R.queued = await p.evaluate(() => ({ board: __T.G.prog.board, report: !!document.querySelector('#wbCard.bow:not([hidden])'), boardModal: !document.querySelector('#boardPanel').hidden, reportLine: null,   /* v18: no Shift Report */ rank: __T.G.prog.rank }));
  await p.evaluate(() => { window.__noSave = true; const d = document.querySelector('#debug'); if (d) d.hidden = true; });
  await shot(p, 'board-queued-report');
  await p.evaluate(() => { const e = document.querySelector('#wbCard'); if (e) e.hidden = true; }); await sleep(800);
  R.queued.afterReport = await p.evaluate(() => ({ boardModal: !document.querySelector('#boardPanel').hidden, text: document.querySelector('#boardBody').innerText.slice(0, 200) }));
  await shot(p, 'board-queued');
  await p.evaluate(() => document.querySelector('#boardPanel').hidden = true);
  // ---- logic checks ----
  R.checks = await p.evaluate(async () => {
    const St = await import('/js/state.js'), PR = await import('/js/progression.js'), sim = await import('/js/sim.js'), BD = __T.BD, G = __T.G, out = {};
    // a board never resolves offline: catch-up with a board pending leaves it queued
    St.resetState(); PR.awardXP(3200, 'manual'); G.prog.specOffered = 99; PR.promotionDue('readiness');
    out.offlineHold = { board: !!G.prog.board, rank: G.prog.rank, boards: G.prog.boardLog.length, promoted: false };   // v18: no catch-up (nothing runs while away), so a pending board simply waits
    // Lt guarantee: a weak Lt jg on play day 7 is forced through (and a fail before day 7 can't block it)
    St.resetState(); PR.awardXP(3200, 'manual'); G.prog.specOffered = 99; G.prog.playDays = 5; PR.promotionDue('readiness');
    const mr = Math.random; Math.random = () => 0.999; const f1 = BD.resolveBoard(); Math.random = mr;
    G.prog.playDays = 7; const blockedCd = G.prog.boardCd > G.prog.day; PR.tickProg(1.1);
    Math.random = () => 0.999; const f2 = BD.resolveBoard(); Math.random = mr;
    out.guarantee = { firstOutcome: f1 && f1.outcome, cooldownActive: blockedCd, guaranteedBoard: f2 && { outcome: f2.outcome, forced: f2.forced, reason: f2.reason }, rank: G.prog.rank };
    // odds table
    out.odds = Object.fromEntries([100, 95, 90, 80, 70, 60].map(r => [r, Object.fromEntries(Object.entries(BD.boardOdds(r)).map(([k, v]) => [k, +v.toFixed(2)]))]));
    // spec pending on a high-level fresh save; can't pick past the max tier
    St.resetState(); PR.awardXP(60000, 'manual'); out.specHigh = { level: G.prog.level, pending: BD.specPending() };
    BD.pickSpec('damage'); BD.pickSpec('damage'); out.specMax = { third: BD.pickSpec('damage'), spec: { ...G.prog.spec }, pending: BD.specPending() };
    G.sp.battle = { fake: true }; out.damageBattle = { warpcore: PR.specFx('warpcore'), shields: PR.specFx('shields') }; G.sp.battle = null;
    // latinum: hidden prep currency
    out.latinum = { start: PR.latinum.get(), add: PR.latinum.add(5, 'test'), bal: PR.balance('latinum'), spend: PR.latinum.spend(3, 'test'), after: PR.latinum.get(), hud: !!document.querySelector('[data-stat="latinum"]') };
    St.resetState();
    return out;
  });
  // ---- migrations: v5 (phase-4 save, level 25 -> 2 picks owed) and v1 -> v6 ----
  for (const v of [5, 1]) {
    await p.evaluate(async v => {
      const St = await import('/js/state.js'), PR = await import('/js/progression.js'); St.resetState(); const G = __T.G;
      if (v === 5) { PR.awardXP(40000, 'manual'); G.prog.rank = 2; }
      const old = JSON.parse(JSON.stringify(G)); old.version = v; old.savedAt = Date.now();
      if (v === 1) { delete old.version; delete old.prog; old.stats.repairs = 40; old.stats.nightFixes = 60; }
      else { const q = old.prog; for (const k of ['latinum', 'latinumBy', 'specPicks', 'specOffered', 'board', 'boardLog', 'boardCd', 'boardMalus']) delete q[k]; q.spec = []; q.promo = { pending: false }; }
      localStorage.setItem(St.SAVE_KEY, JSON.stringify(old));
    }, v);
    await p.goto(BASE + '?debug=1'); await ready(p); await sleep(1500);
    R['migrate_v' + v] = await p.evaluate(() => { window.__noSave = true; const G = __T.G; return { version: G.version, level: G.prog.level, rank: G.prog.rank, latinum: G.prog.latinum, spec: G.prog.spec, specPending: __T.BD.specPending(), pickerOpen: !document.querySelector('#specPanel').hidden, board: G.prog.board, tier: G.prog.cabin.tier }; });
    if (v === 5) await shot(p, 'migrate-v5-picker');
  }
  await p.evaluate(() => localStorage.clear());
  // ================= landscape =================
  p = await mk(b, 844, 390, true);
  await boot(p); await career(p);
  R.land = { board: await callBoard(p) };
  R.land.fit = await modalFits(p, '#boardPanel');
  await shot(p, 'board-landscape');
  R.land.fail = await face(p, 0.999); await shot(p, 'board-fail-landscape'); await dismiss(p);
  await p.evaluate(() => { __T.G.prog.specOffered = 0; }); await sleep(800);
  R.land.specFit = await modalFits(p, '#specPanel');
  await shot(p, 'spec-picker-landscape');
  // ================= desktop =================
  p = await mk(b, 1280, 800, false);
  await boot(p); await career(p, 2, 60000);   // Lt Cmdr -> Commander: T'Ren chairs
  R.desk = { board: await callBoard(p) };
  R.desk.fit = await modalFits(p, '#boardPanel');
  await shot(p, 'board-desktop');
  R.desk.pass = await face(p, 0.01); await shot(p, 'board-pass-desktop'); await dismiss(p); await sleep(2500);
  await p.evaluate(() => { __T.G.prog.specOffered = 0; }); await sleep(800);
  await shot(p, 'spec-picker-desktop');
  await p.evaluate(() => { document.querySelector('[data-spick="damage"]').click(); }); await sleep(200);
  await p.evaluate(() => { document.querySelector('[data-spick="weapons"]').click(); }); await sleep(200);
  await p.evaluate(() => { const b = document.querySelector('[data-spick="damage"]'); if (b && !b.disabled) b.click(); }); await sleep(400);
  await p.evaluate(() => { document.querySelector('#specPanel').hidden = true; document.querySelector('#career').scrollIntoView(); }); await sleep(400);
  await shot(p, 'spec-crew-desktop');
  R.desk.spec = await p.evaluate(() => ({ spec: __T.G.prog.spec, title: document.querySelector('.stat[data-stat="level"]').title }));
  R.issues = issues;
  fs.writeFileSync(OUT + 'prog5-report.json', JSON.stringify(R, null, 1));
  console.log(JSON.stringify(R, null, 1));
  await b.close();
})();
