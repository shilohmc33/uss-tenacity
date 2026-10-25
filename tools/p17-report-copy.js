// RETIRED in v18 (no offline quests, notes/2026-10-25-no-offline-quests-plan.md): this tool exercised the removed offline catch-up /
// night crew / Shift Report (sim.catchUp, PACE_RT.offline, #report). The v18 behaviour is covered by tools/offline-check.js.
if (!process.env.RUN_RETIRED) { console.log('RETIRED in v18 (offline catch-up removed): see tools/offline-check.js'); process.exit(0); }
// Pass 17 P4: after a live fight that the player hid during (catch-up deferred, pass 16 B1), the deferred night report must name
// the actual enemy and outcome, not "No contact with the Jem'Hadar". Per enemy (battlecruiser, Galor): live fight, catchUp(40)
// while it is on (deferred), the fight is won, the report opens: its text is checked. Also a plain quiet catch-up still reads
// "No contact with the Jem'Hadar." Shot shots/p17-report-bc-390x844.png; report shots/p17-report-copy.json.
const L = require('/workspace/playtest-scripts/lib.js'); const fs = require('fs');
const URL = process.argv[2] || 'http://127.0.0.1:8765/';
(async () => {
  const b = await L.launch(); const rep = {}; const errs = [];
  for (const cs of ['jh_battlecruiser', 'galor', 'quiet']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(`${cs} ${e.message}`)); p.on('console', x => { if (x.type() === 'error') errs.push(`${cs} ${x.text()}`); });
    await p.goto(URL + '?reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(1200);
    await p.evaluate(async cs => { const G = __T.G; window.__noSave = true; G.sp.cap.decideT = 1e9; G.ship.nextFault = 1e9; document.querySelectorAll('.modal').forEach(e => { if (e.id !== 'bcCard') e.hidden = true; });
      const P = G.prog; P.rank = 1; P.day = 25; P.playDays = 30; Object.assign(G.ship, { hull: 100, power: 100, shields: 100, torps: 6, faults: {} }); G.sp.lastBattleT = -1e9; G.sp.battle = null;
      const PC = await import('/js/pacing.js'); PC.PACE_RT.sessionT = 1e5;
      if (cs !== 'quiet') { const BT = await import('/js/battle.js'); BT.startBattle('enroute', { enemy: cs }); } }, cs);
    if (cs !== 'quiet') {
      await L.sleep(1500); const d = await p.evaluate(() => { const r = __T.catchUp(40); return { deferred: !!r.deferred, defer: __T.G.sp.awayDefer, live: !!(__T.G.sp.battle && __T.G.sp.battle.live) }; });
      rep[cs] = { deferred: d };
      await p.evaluate(() => { const c = document.querySelector('#bcCard .tap') || document.getElementById('bcCard'); if (!document.getElementById('bcCard').hidden) c.click(); const B = __T.G.sp.battle; if (B) for (const e of B.enemies || []) e.hull = Math.min(e.hull, 1); });
      await L.waitFor(p, () => !__T.G.sp.battle, 120000).catch(() => errs.push(`${cs} fight did not end`));
    } else { await p.evaluate(async () => { const H = await import('/js/ui/hud.js'); H.showReport(__T.catchUp(40)); }); }
    await L.waitFor(p, () => !document.getElementById('report').hidden, 20000).catch(() => errs.push(`${cs} no report`)); await L.sleep(600);
    const txt = await p.evaluate(() => document.getElementById('reportBody').innerText);
    const li = (txt.split('\n').find(l => /contact|engagement|fight that held/i.test(l)) || '').trim();
    rep[cs] = { ...(rep[cs] || {}), line: li };
    if (cs === 'quiet' && !/No contact with the Jem'Hadar/.test(li)) errs.push(`quiet: ${li}`);
    if (cs !== 'quiet') { const name = cs === 'galor' ? /Galor/i : /battlecruiser/i; if (/No contact with the Jem'Hadar/.test(li) || !name.test(li) || !/beaten off/.test(li)) errs.push(`${cs}: ${li}`); }
    if (cs === 'jh_battlecruiser') await p.screenshot({ path: 'shots/p17-report-bc-390x844.png' });
    await ctx.close();
  }
  rep.errors = errs; fs.writeFileSync('shots/p17-report-copy.json', JSON.stringify(rep, null, 1));
  for (const [k, v] of Object.entries(rep)) if (k !== 'errors') console.log(k, JSON.stringify(v));
  console.log(errs.length ? 'P17 REPORT FAIL' : 'P17 REPORT PASS', errs.length, errs.slice(0, 4)); await b.close();
})();
