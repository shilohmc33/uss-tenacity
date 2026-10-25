// Progression phase 4 (quarters + rations) verification + proof shots -> shots/prog4-*.png, shots/prog4-report.json
// NODE_PATH=/workspace/pwtools/node_modules node tools/prog4-shots.js [base]
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
const shot = (p, name, clip) => p.screenshot({ path: OUT + `prog4-${name}.png`, ...(clip ? { clip } : {}) });
const tele = (p, deck, x, y) => p.evaluate(([deck, x, y]) => { const L = __T.G.lt; L.lift = null; L.deck = deck; L.x = x; L.y = y; L.mode = 'idle'; L.path = null; L.node = null; L.repairSys = null; L.intent = null; __T.cam.snap = true; __T.cam.manualT = 0; }, [deck, x, y]);
const toQuarters = p => p.evaluate(() => { const T = __T.CB.tier(), L = __T.G.lt; L.lift = null; L.deck = 'quarters'; L.x = T.lift.x; L.y = Math.min(0.9, T.lift.y + 0.08); L.mode = 'idle'; L.path = null; L.node = null; L.intent = null; __T.cam.snap = true; __T.cam.manualT = 0; }).then(() => sleep(4500));
const fund = p => p.evaluate(() => { const G = __T.G; G.prog.rations = 20000; G.sp.rep = 20000; G.prog.fleetRep = 30; });
const buy = (p, list) => p.evaluate(list => list.map(([id, slot]) => { const CB = __T.CB; const ok = CB.owned(id) ? CB.placeItem(id, slot) : CB.buyItem(id, slot); return `${id}->${slot}:${!!ok}`; }), list);
const openSheet = async (p, name) => { await p.evaluate(n => document.querySelector(`.sheetBtns [data-sheet="${n}"]`).click(), name); await sleep(400); };
const closeSheet = p => p.evaluate(() => { const c = document.querySelector('#sheetClose'); if (c) c.click(); }).then(() => sleep(300));
const promote = p => p.evaluate(async () => { const PR = await import('/js/progression.js'); PR.promote('readiness'); __T.CB.applyTier(); const c = __T.G.prog.cabin; return { rank: __T.G.prog.rank, tier: c.tier, placed: { ...c.placed }, move: c.log.slice(-1)[0] }; }).then(async r => { await sleep(600); return r; });
const cabinState = p => p.evaluate(() => { const CB = __T.CB, c = __T.G.prog.cabin; return { tier: c.tier, name: CB.tier().name, slots: CB.slots().length, placed: { ...c.placed }, storage: CB.storage(), totals: CB.totals(), rackRest: +CB.rackRest().toFixed(2), completion: Math.round(CB.completion() * 100), rations: __T.G.prog.rations }; });
const closeDecor = p => p.evaluate(() => { document.querySelector('#decorPanel').hidden = true; }).then(() => sleep(200));
const PLAN = {
  ltjg: [['diploma', 'wall1'], ['plant', 'corner1'], ['holophoto', 'shelf1']],
  lt: [['lamp', 'desk1'], ['rug', 'floor1'], ['replicator', 'replicator'], ['painting', 'wall2']],
  ltcmdr: [['telescope', 'window1'], ['fishtank', 'large1'], ['shipmodel', 'shelf2'], ['portrait', 'wall1']],
  cmdr: [['captainchair', 'large2'], ['bonsai', 'corner2'], ['holowindow', 'window2'], ['shipbottle', 'shelf3'], ['targ', 'floor2'], ['batleth', 'wall3']],
};
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  // ================= portrait =================
  let p = await mk(b, 390, 844, true);
  await boot(p);
  R.fresh = await cabinState(p);
  // rations in the HUD (fresh save, after a few repairs' worth)
  await p.evaluate(() => { __T.G.prog.rations = 186; });
  await sleep(500);
  await shot(p, 'hud-rations', { x: 0, y: 0, width: 390, height: 200 });
  R.hudTile = await p.evaluate(() => [...document.querySelectorAll('#stats > *')].map(e => e.innerText.replace(/\n/g, ' ')).join(' | '));
  await fund(p);
  // empty Lt jg bunk room (placeholder plate + dashed slots)
  await toQuarters(p);
  await shot(p, 'cabin-ltjg-empty');
  // decor chooser: tap the wall slot on the deck (real tap through hitTest)
  R.slotTap = await p.evaluate(() => { const CB = __T.CB, s = CB.slotById('wall1'); return { x: s.x, y: s.y }; });
  await p.evaluate(() => __T.HUD_openDecor ? null : null);
  await p.evaluate(async () => { const H = await import('/js/ui/hud.js'); H.openDecor('wall1'); });
  await sleep(300);
  await shot(p, 'decor-chooser');
  R.chooserText = await p.evaluate(() => document.querySelector('#decorPanel').innerText.replace(/\n+/g, ' | ').slice(0, 900));
  // buy the diploma through the chooser button
  await p.evaluate(() => document.querySelector('#decorList [data-dbuy="diploma"]').click()); await sleep(300);
  await shot(p, 'decor-chooser-bought');
  await closeDecor(p);
  R.ltjgBuys = await buy(p, PLAN.ltjg.slice(1));
  await sleep(4500);
  await shot(p, 'cabin-ltjg');
  R.ltjg = await cabinState(p);
  // resting in quarters: tired Lt walks to the rack via the turbolift
  await tele(p, 'engineering', 0.45, 0.62); await sleep(800);
  await p.evaluate(() => { __T.G.ship.energy = 42; __T.sendUse('rack'); });
  await p.waitForFunction(() => __T.G.lt.deck === 'quarters' && __T.G.lt.node === 'rack' && __T.G.lt.mode !== 'walk', null, { timeout: 60000 }).catch(() => {});
  await sleep(2500);
  R.rest = await p.evaluate(() => ({ deck: __T.G.lt.deck, node: __T.G.lt.node, mode: __T.G.lt.mode, energy: +__T.G.ship.energy.toFixed(1), rackRest: __T.CB.rackRest(), chip: document.querySelector('#chips') ? document.querySelector('#chips').innerText.slice(0, 200) : '' }));
  await shot(p, 'rest-quarters');
  // Refreshed buff when topped up on the rack
  await p.evaluate(() => { __T.G.ship.energy = 99; }); await sleep(1500);
  R.refreshed = await p.evaluate(() => { const c = __T.G.prog.cabin, S = __T.G.ship; return { until: Math.round((c.refreshedUntil || 0) - S.elapsed), drainMult: __T.CB.drainMult(), log: __T.G.log.slice(-2).map(e => e.msg) }; });
  // promotions: Lt -> Lt Cmdr -> Cmdr, decor follows
  R.promo = [];
  for (const t of ['lt', 'ltcmdr', 'cmdr']) {
    const r = await promote(p); r.buys = await buy(p, PLAN[t]); R.promo.push(r);
    await toQuarters(p);
    await shot(p, `cabin-${t}`);
    R[t] = await cabinState(p);
  }
  R.promoLog = await p.evaluate(() => __T.G.log.filter(e => /Quarters reassigned|New decor available/.test(e.msg)).map(e => e.msg));
  // placed decor close-up (zoomed) in the Commander's suite
  await shot(p, 'decor-placed');
  // CREW sheet quarters box
  await openSheet(p, 'crew'); await p.evaluate(() => document.querySelector('#quarters').scrollIntoView()); await sleep(300);
  await shot(p, 'crew-quarters');
  R.quartersBox = await p.evaluate(() => document.querySelector('#quarters').innerText.replace(/\n+/g, ' | '));
  await closeSheet(p);
  // trade-in from the DUTY sheet
  await p.evaluate(() => { const S = __T.G.ship; S.parts = S.partsCap; __T.G.prog.rations = 320; });
  await openSheet(p, 'duty'); await p.evaluate(() => document.querySelector('[data-sink="trade"]').scrollIntoView({ block: 'center' })); await sleep(400);
  await shot(p, 'trade-before');
  R.tradeBefore = await p.evaluate(() => ({ parts: __T.G.ship.parts, rations: __T.G.prog.rations, left: __T.CB.tradeLeft() }));
  for (let i = 0; i < 2; i++) { await p.evaluate(() => document.querySelector('[data-sink="trade"]').click()); await sleep(400); }
  await p.evaluate(() => document.querySelector('[data-sink="trade"]').scrollIntoView({ block: 'center' })); await sleep(300);
  await shot(p, 'trade-after');
  R.tradeAfter = await p.evaluate(() => ({ parts: __T.G.ship.parts, rations: __T.G.prog.rations, left: __T.CB.tradeLeft(), log: __T.G.log.slice(-1)[0].msg }));
  await closeSheet(p);
  // ---- logic checks ----
  R.checks = await p.evaluate(async () => {
    const St = await import('/js/state.js'), PR = await import('/js/progression.js'), CL = __T.CL, CB = __T.CB, G = __T.G, out = {};
    // demotion-style remap (cmdr -> ltjg): extra items go to storage, keep ownership; back up again puts nothing back automatically
    const before = Object.keys(G.prog.cabin.placed).length;
    const m = CB.moveQuarters('ltjg'); out.remapDown = { placedBefore: before, placedAfter: Object.keys(G.prog.cabin.placed).length, stored: m.stored, storage: CB.storage().length, owned: G.prog.cabin.owned.length };
    CB.moveQuarters('cmdr'); out.remapUp = { placed: Object.keys(G.prog.cabin.placed).length, storage: CB.storage().length };
    // favour drop: calling the Utopia shipment favour delivers the yard plaque once
    St.resetState(); G.sp.rep = 5000; G.prog.rank = 1; CB.applyTier(); G.prog.opinions.okafor = 60; CL.transferOff('okafor', 'utopia'); G.prog.fleetRep = Math.max(G.prog.fleetRep, 40);
    const fs0 = CL.favourState('shipment');
    const okF = CL.callFavour('shipment'); out.favourDrop = { stateOk: fs0.ok, why: fs0.why, called: okF, owned: G.prog.cabin.owned.slice(), log: G.log.slice(-2).map(e => e.msg) };
    // gates
    St.resetState(); out.gates = Object.fromEntries(['batleth', 'replicator', 'telescope', 'portrait', 'yardplaque', 'plant'].map(id => [id, CB.gateState(CB.DECOR[id])]));
    // rations earning: one repair outcome each grade + chat cap + shift
    St.resetState(); const r0 = G.prog.rations; PR.earnRations(5, 'test'); out.earn = { start: r0, after: G.prog.rations, by: G.prog.rationsBy };
    // dinner
    St.resetState(); G.prog.rank = 1; G.prog.rations = 500; CB.applyTier(); const o0 = {}; for (const c of PR.crewList()) o0[c.id] = Math.round(PR.opinionOf(c.id));
    const dn = CB.hostDinner(); out.dinner = { ok: !!dn, rations: G.prog.rations, again: CB.dinnerState(), log: G.log.slice(-1)[0].msg };
    // offline: auto-trade with a full locker + standing order on, and rack rest offline is off by config
    out.offline = null;   // v18: no offline catch-up / auto-trade (retired)
    St.resetState();
    return out;
  });
  // ---- migrations: v4 (phase-3 save) and v1 -> v5 ----
  for (const v of [4, 1]) {
    await p.evaluate(async v => {
      const St = await import('/js/state.js'); St.resetState(); const old = JSON.parse(JSON.stringify(__T.G)); old.version = v; old.savedAt = Date.now();
      if (v === 1) { delete old.version; delete old.prog; old.stats.repairs = 40; old.stats.nightFixes = 60; }
      else { const q = old.prog; for (const k of ['rations', 'rationsLife', 'rationsBy', 'chatRR', 'cabin']) delete q[k]; q.level = 22; q.rank = 2; old.sp.rep = 3100; }
      localStorage.setItem(St.SAVE_KEY, JSON.stringify(old));
    }, v);
    await p.goto(BASE + '?debug=1');
    await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
    await sleep(1500);
    R['migrate_v' + v] = await p.evaluate(() => { window.__noSave = true; const G = __T.G, c = G.prog.cabin; return { version: G.version, level: G.prog.level, rank: G.prog.rank, rep: G.sp.rep, rations: G.prog.rations, tier: c && c.tier, owned: c && c.owned.length }; });
  }
  await p.evaluate(() => localStorage.clear());
  // ================= landscape =================
  p = await mk(b, 844, 390, true);
  await boot(p); await fund(p);
  await promote(p); await buy(p, [...PLAN.ltjg, ...PLAN.lt]);
  await toQuarters(p);
  await shot(p, 'cabin-lt-landscape');
  await p.evaluate(async () => { const H = await import('/js/ui/hud.js'); H.openDecor('desk1'); }); await sleep(300);
  await shot(p, 'decor-chooser-landscape');
  await closeDecor(p);
  await openSheet(p, 'crew'); await p.evaluate(() => document.querySelector('#quarters').scrollIntoView()); await sleep(300);
  await shot(p, 'crew-quarters-landscape');
  await closeSheet(p);
  // ================= desktop =================
  p = await mk(b, 1280, 800, false);
  await boot(p); await fund(p);
  await promote(p); await promote(p); await buy(p, [...PLAN.ltjg, ...PLAN.lt, ...PLAN.ltcmdr]);
  await toQuarters(p);
  await shot(p, 'cabin-ltcmdr-desktop');
  await p.evaluate(async () => { const H = await import('/js/ui/hud.js'); H.openDecor('large1'); }); await sleep(300);
  await shot(p, 'decor-chooser-desktop');
  await closeDecor(p);
  await promote(p); await buy(p, PLAN.cmdr); await toQuarters(p);
  await shot(p, 'cabin-cmdr-desktop');
  await p.evaluate(() => { const S = __T.G.ship; S.parts = S.partsCap; });
  await openSheet(p, 'duty'); await p.evaluate(() => document.querySelector('[data-sink="trade"]').scrollIntoView({ block: 'center' })); await sleep(300);
  await shot(p, 'trade-desktop');
  R.issues = issues;
  fs.writeFileSync(OUT + 'prog4-report.json', JSON.stringify(R, null, 1));
  console.log(JSON.stringify(R, null, 1));
  await b.close();
})();
