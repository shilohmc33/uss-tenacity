// Multi-ship P1 batch check: 1v1 regression, forced 1v2 / 1v3, 3v3 (allies fight, an ally dies, triple kill + frame time),
// P23 (ally id as enemy -> joins the allies), firing-flash crops for the Galor (enemy) and BoP (ally). 3 sizes, 0 errors.
const { chromium } = require('playwright-core');
const BASE = 'http://localhost:8765/', OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SIZES = (process.env.SIZES || '390x844 844x390 1280x800').split(' ').map(s => s.split('x').map(Number));
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [], res = {}, warns = [];
  for (const [w, h] of SIZES) {
    const tag = `${w}x${h}`, c = await br.newContext({ viewport: { width: w, height: h } }), p = await c.newPage(), R = res[tag] = {};
    p.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); if (m.type() === 'warning' && /startBattle/.test(m.text())) warns.push(m.text()); });
    p.on('pageerror', e => errs.push(`${tag}: ${e.message}`));
    await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(400);
    await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); document.querySelector('#btnView').click(); for (const a of Object.values(__T.G.ab)) a.cd = 999; });
    const start = o => p.evaluate(async o => { const BT = await import('/js/battle.js'); __T.G.sp.battle = null; __T.G.ship.hull = 100; __T.G.ship.shields = 100; BT.startBattle('debug', o);
      document.querySelectorAll('#toasts > *').forEach(t => t.remove()); const b = document.querySelector('#bcCard'); if (b) b.hidden = true;
      const B = __T.G.sp.battle; return { e: B.enemies.map(x => x.ship), a: B.allies.map(x => x.ship) }; }, o);
    const clean = () => p.evaluate(() => { document.querySelectorAll('#toasts > *').forEach(t => t.remove()); const b = document.querySelector('#bcCard'); if (b) b.hidden = true; });
    const waitEnd = async ms => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (!(await p.evaluate(() => !!__T.G.sp.battle))) return true; await sleep(250); } return false; };
    const shot = async n => { await clean(); await p.evaluate(() => { __T.app.paused = true; }); await p.screenshot({ path: OUT + `ms-${n}-${tag}.png` }); await p.evaluate(() => { __T.app.paused = false; }); };
    // 1) 1v1 regression
    R.v1 = await start({ enemy: 'galor' }); await sleep(2500); await shot('1v1');
    await p.evaluate(async () => (await import('/js/battle.js')).debugKillEnemy()); R.v1.cleared = await waitEnd(9000);
    // 2) P23: ally id as enemy
    R.p23 = await start({ enemy: 'klingon_bop' }); await p.evaluate(() => { __T.G.sp.battle = null; });
    // 3) 1v2, 1v3: kill one, battle must continue and retarget
    R.v2 = await start({ enemies: ['galor', 'jh_fighter'] }); await sleep(2500); await shot('1v2');
    R.v2.after1 = await p.evaluate(async () => { const BT = await import('/js/battle.js'); BT.debugKillOne('galor-0'); const B = __T.G.sp.battle; return { battle: !!B, dying: B.dying, target: B.enemies[B.target].id }; });
    await p.evaluate(() => { __T.G.sp.battle = null; });
    R.v3 = await start({ enemies: ['galor', 'jh_fighter', 'jh_fighter'] }); await sleep(3000); await shot('1v3');
    await p.evaluate(() => { __T.G.sp.battle = null; });
    // P2) real progression rolls (no forced list): 'enroute' fights at play days 0 / 8 / 15, a healthy ship; one shot of a rolled group
    R.prog = await p.evaluate(async () => { const BT = await import('/js/battle.js'), PC = await import('/js/pacing.js'), G = __T.G, out = {}; PC.PACE_RT.sessionT = 1e5; G.ship.torps = 8; G.ship.power = 90;
      for (const pd of [0, 8, 15]) { G.prog.playDays = pd; const c = {}; for (let i = 0; i < 40; i++) { G.sp.battle = null; G.ship.hull = 100; G.sp.lastBattleT = -1e9;
        BT.startBattle('enroute'); const B = G.sp.battle; const k = B ? B.enemies.map(e => e.ship + (e.wing ? '(w' + e.hull + ')' : '')).join('+') : 'none'; c[k] = (c[k] | 0) + 1; } out[pd] = c; }
      G.sp.battle = null; return out; });
    await p.evaluate(async () => { const BT = await import('/js/battle.js'), PC = await import('/js/pacing.js'); PC.PACE_RT.sessionT = 1e5; __T.G.prog.playDays = 15; for (let i = 0; i < 60; i++) { __T.G.sp.battle = null; __T.G.sp.lastBattleT = -1e9; __T.G.ship.hull = 100; BT.startBattle('enroute'); if (__T.G.sp.battle && __T.G.sp.battle.enemies.length === 3) break; } __T.G.ship.shields = 100; });
    await sleep(3000); await shot('prog-group');
    // 4) 3v3: let them fight, check ally volleys landed, kill the freighter (ally death), then the triple kill with frame time
    R.v33 = await start({ enemies: ['galor', 'jh_fighter', 'jh_battlecruiser'], allies: ['klingon_bop', 'freighter'] });
    await p.evaluate(() => { const B = __T.G.sp.battle; B.allies[1].volleyT = 0.2; for (const e of B.enemies) e.hull = Math.round(e.max * 0.35); });
    await sleep(5000); await shot('3v3');
    R.v33.fight = await p.evaluate(() => { const B = __T.G.sp.battle; return B && { enemies: B.enemies.map(e => `${e.id}:${e.hull}/${e.max}${e.dead ? ' dead' : ''}`), allies: B.allies.map(a => a.ref ? 'tenacity' : `${a.id}:${Math.round(a.hull)}/${a.max} sh${Math.round(a.shields)}`) }; });
    R.v33.allyDeath = await p.evaluate(async () => { const BT = await import('/js/battle.js'), B = __T.G.sp.battle; BT.debugKillOne('freighter-2', 'ally'); return { battle: !!__T.G.sp.battle, allyDying: B.allyDying, dead: B.allies[2].dead }; });
    await sleep(1200); await shot('3v3-allydeath');
    const ft = p.evaluate(() => new Promise(r => { const ts = []; let last = performance.now(); const f = now => { ts.push(now - last); last = now; if (ts.length < 180) requestAnimationFrame(f); else { ts.sort((a, b) => a - b); r({ n: ts.length, avg: +(ts.reduce((a, b) => a + b, 0) / ts.length).toFixed(1), p95: +ts[Math.floor(ts.length * 0.95)].toFixed(1), max: +ts[ts.length - 1].toFixed(1) }); } }; requestAnimationFrame(f); }));
    await p.evaluate(async () => (await import('/js/battle.js')).debugKillEnemy());
    await sleep(900); await shot('3v3-triplekill'); R.v33.frame = await ft; R.v33.cleared = await waitEnd(12000);
    // 5) firing flash: Galor (enemy) and BoP (ally) caught mid-volley, hp.fire marked
    if (w === 1280) {
      await start({ enemy: 'galor', allies: ['klingon_bop'] }); await sleep(2200);
      R.fire = await p.evaluate(async () => { const B = __T.G.sp.battle, S = await import('/js/ships.js'); B.enemies[0].volleyT = 0.01; B.allies[1].volleyT = 0.01;
        await new Promise(r => setTimeout(r, 180)); __T.app.paused = true; const SFX = (await import('/js/battle.js')).SFX;
        const cv = [...document.querySelectorAll('canvas')].sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0], VW = cv ? cv.clientWidth : innerWidth, VH = cv ? cv.clientHeight : innerHeight; const out = {}; for (const c of [B.enemies[0], B.allies[1]]) { const R = SFX && SFX.rects[c.id], hp = S.SHIPS[c.ship].hp.fire; if (R) out[c.ship] = [Math.round((R.x + (c.side === 'enemy' ? 1 - hp[0] : hp[0]) * R.w) * VW), Math.round((R.y + hp[1] * R.h) * VH), Math.round(R.w * VW)]; } return out; }).catch(e => ({ err: e.message }));
      await p.screenshot({ path: OUT + `ms-fire-${tag}.png` }); await p.evaluate(() => { __T.app.paused = false; __T.G.sp.battle = null; });
    }
    await c.close();
  }
  await br.close();
  console.log(JSON.stringify(res, null, 1)); console.log('warns:', warns.length, warns[0] || '');
  console.log(errs.length ? 'ERRORS\n' + errs.join('\n') : 'multiship-shots: 0 console errors');
})();
