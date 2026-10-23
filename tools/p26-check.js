// P26 recheck: escort death = FAILED, debug convoy hook pays, a won convoy fight keeps 'Convoy delivered', no allies away/offline
const { chromium } = require('playwright-core'); const BASE = process.env.BASE || 'http://127.0.0.1:8765/', OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [], res = {};
  for (const [w, h] of [[390, 844], [844, 390], [1280, 800]]) {
    const tag = `${w}x${h}`, c = await br.newContext({ viewport: { width: w, height: h } }), p = await c.newPage();
    p.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); }); p.on('pageerror', e => errs.push(`${tag}: ${e.message}`));
    await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(400);
    await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); document.querySelector('#btnView').click(); });
    const logs = n => p.evaluate(n => __T.G.log.slice(-n).map(l => l.text || l.msg || String(l)), n);
    const killAll = () => p.evaluate(async () => { const BT = await import('/js/battle.js'); for (const e of __T.G.sp.battle.enemies) BT.debugKillOne(e.id); });
    const waitEnd = async () => { for (let i = 0; i < 60; i++) { if (!(await p.evaluate(() => !!__T.G.sp.battle))) return true; await sleep(250); } return false; };
    const R = res[tag] = {};
    // 1) escort ally dies -> FAILED in the HUD
    await p.evaluate(async () => { const BT = await import('/js/battle.js'); __T.G.sp.battle = null; BT.startBattle('debug', { enemies: ['galor'], mission: 'escort' }); BT.debugKillOne('fed_saber-1', 'ally'); });
    await sleep(700); R.escortFail = await p.evaluate(() => ({ failed: __T.G.sp.battle.mission.failed, hud: document.querySelector('#bridgeOrders').textContent }));
    await p.evaluate(() => { document.querySelectorAll('#toasts > *').forEach(t => t.remove()); __T.app.paused = true; }); await p.screenshot({ path: OUT + `p26-escort-failed-${tag}.png` }); await p.evaluate(() => { __T.app.paused = false; });
    await killAll(); await waitEnd();
    // 2) debug mission:'convoy' victory pays 'convoy is safe'
    await p.evaluate(async () => { const BT = await import('/js/battle.js'); __T.G.sp.battle = null; __T.G.sp.location = 'ds9'; BT.startBattle('debug', { enemies: ['jh_fighter'], mission: 'convoy' }); });
    const r0 = await p.evaluate(() => __T.G.sp.rep); await killAll(); await waitEnd();
    R.debugConvoy = { safe: (await logs(8)).some(s => /convoy is safe/.test(s)), rep: await p.evaluate(r0 => __T.G.sp.rep - r0, r0) };
    // 3) real rendezvous with raiders: win the fight, the escort keeps running, then 'Convoy delivered' pays
    R.realConvoy = await p.evaluate(async () => { const V = await import('/js/voyage.js'), PC = await import('/js/pacing.js'), G = __T.G; PC.PACE_RT.sessionT = 1e5; G.sp.lastBattleT = -1e9; G.sp.travel = { dest: 'convoy', t: 600, dur: 600, from: 'ds9' };
      const rnd = Math.random; Math.random = () => 0.01; try { V.arriveAtDest(); } finally { Math.random = rnd; } const B = G.sp.battle;
      return { battle: !!B, allies: B ? B.allies.map(a => a.ship) : [], escortDone: G.sp.escortDone }; });
    await killAll(); await waitEnd();
    R.realConvoy.afterWin = await p.evaluate(() => ({ escortDone: __T.G.sp.escortDone, rep: __T.G.sp.rep, parts: __T.G.ship.parts }));
    await p.evaluate(async () => { const PC = await import('/js/pacing.js'); __T.G.sp.escortT = PC.PACE.escortTime - 0.5; }); await sleep(2500);
    R.realConvoy.delivered = { log: (await logs(12)).some(s => /Convoy delivered/.test(s)), escortDone: await p.evaluate(() => __T.G.sp.escortDone), rep: await p.evaluate(() => __T.G.sp.rep), parts: await p.evaluate(() => __T.G.ship.parts) };
    // 4) away / offline: no mission allies
    R.away = await p.evaluate(async () => { const BT = await import('/js/battle.js'), PC = await import('/js/pacing.js'), G = __T.G; const out = {};
      G.sp.battle = null; G.sp.location = 'convoy'; G.sp.escortDone = false; PC.PACE_RT.offline = true; BT.startBattle('debug', { enemies: ['jh_fighter'], mission: 'convoy' }); out.offline = G.sp.battle.allies.length; PC.PACE_RT.offline = false;
      G.sp.battle = null; BT.startBattle('debug', { enemies: ['jh_fighter'], mission: 'convoy' }); out.live = G.sp.battle.allies.length; G.sp.battle = null; return out; });
    await c.close();
  }
  console.log(JSON.stringify(res)); console.log(`p26-check: ${errs.length} console errors`, errs.slice(0, 5)); await br.close();
})();
