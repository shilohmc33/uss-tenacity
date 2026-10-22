// Pass 17 P3: an auto prompt that was open when the red-alert card appears steps aside (pass 16 B2) and must come back exactly
// once after the card and the fight are gone: specialisation picker (the bug: specOffered was already counted), promotion board,
// crew-safety prompt, romance disclosure. Per case: stage the owed prompt, start a battlecruiser fight, check the prompt is hidden
// under the card, dismiss the card, finish the fight (enemy hull -> 1, the next hit wins), then count re-opens (100 ms sampling).
// Sizes 390x844 + 844x390 + 1280x800. Report shots/p17-prompt-return.json.   usage: node tools/p17-prompt-return.js [url]
const L = require('/workspace/playtest-scripts/lib.js'); const fs = require('fs');
const URL = process.argv[2] || 'http://127.0.0.1:8765/';
const PANEL = { spec: 'specPanel', board: 'boardPanel', safety: 'safetyPanel', disc: 'romPanel' };
(async () => {
  const b = await L.launch(); const rep = {}; const errs = [];
  for (const [vp, w, h, m] of [['390x844', 390, 844, 1], ['844x390', 844, 390, 1], ['1280x800', 1280, 800, 0]].filter(v => !process.env.VPS || process.env.VPS.split(',').includes(v[0]))) for (const cs of Object.keys(PANEL).filter(c => !process.env.CASES || process.env.CASES.split(',').includes(c))) {   // VPS= / CASES= to narrow
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 3 : 1, isMobile: !!m, hasTouch: !!m }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(`${vp} ${cs} ${e.message}`)); p.on('console', x => { if (x.type() === 'error') errs.push(`${vp} ${cs} ${x.text()}`); });
    await p.goto(URL + '?reset=1'); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(1200);
    const pre = await p.evaluate(async ([cs, id]) => { const G = __T.G; window.__noSave = true; G.sp.cap.decideT = 1e9; G.ship.nextFault = 1e9;
      const MD = await import('/js/injuries.js'), BD = await import('/js/boards.js'), PR = await import('/js/progression.js'), hud = await import('/js/ui/hud.js'), PC = await import('/js/pacing.js');
      document.querySelectorAll('.modal').forEach(e => { if (e.id !== 'bcCard') e.hidden = true; });
      const P = G.prog; P.rank = 1; P.day = 25; P.playDays = 30; P.level = Math.max(P.level, 5); Object.assign(G.ship, { hull: 100, power: 100, shields: 100, torps: 6, faults: {} });
      G.sp.lastBattleT = -1e9; G.sp.battle = null; G.night.battleTimes = []; PC.PACE_RT.sessionT = 1e5; PC.PACE_RT.idleT = 0; MD.M().prompt12 = true; P.board = null; P.specPicks = 9; P.specOffered = 9; P.romance.disc = null;
      if (cs === 'board') { BD.scheduleBoard(PR.PROG.ranks[P.rank + 1], 'ready'); hud.openBoard(); }
      if (cs === 'spec') { P.level = Math.max(P.level, 10); P.specPicks = 0; P.specOffered = BD.specOwed(); hud.openSpec(); }
      if (cs === 'safety') { MD.M().prompt12 = false; await new Promise(r => setTimeout(r, 1500)); }
      if (cs === 'disc') { const r = P.romance; r.opt = true; const oid = Object.keys(P.crew.occ).find(k => !['tren', 'okafor'].includes(k)); r.partner = oid; r.bond[oid] = r.bond[oid] || { stage: 'together' }; r.disc = { id: oid, kind: 'captain' }; await new Promise(r2 => setTimeout(r2, 1500)); }
      const vis = () => { const e = document.getElementById(id); return !!(e && !e.hidden && e.getBoundingClientRect().height > 0); };
      window.__opens = 0; let prev = vis(); window.__samp = setInterval(() => { const v = vis(); if (v && !prev) window.__opens++; prev = v; }, 100);
      return { open: vis() }; }, [cs, PANEL[cs]]);
    await p.evaluate(async () => { const BT = await import('/js/battle.js'); BT.startBattle('enroute', { enemy: 'jh_battlecruiser' }); });
    await L.waitFor(p, () => !document.getElementById('bcCard').hidden, 20000); await L.sleep(1000);
    const during = await p.evaluate(id => !document.getElementById(id).hidden, PANEL[cs]);
    await p.evaluate(() => { const c = document.querySelector('#bcCard .tap') || document.getElementById('bcCard'); c.click(); });   // dismiss the card
    await L.sleep(800); const afterCard = await p.evaluate(id => ({ open: !document.getElementById(id).hidden, battle: !!__T.G.sp.battle }), PANEL[cs]);
    await p.evaluate(() => { const B = __T.G.sp.battle; if (B) for (const e of B.enemies || []) e.hull = Math.min(e.hull, 1); });
    await L.waitFor(p, () => !__T.G.sp.battle && document.getElementById('bcCard').hidden, 120000).catch(() => errs.push(`${vp} ${cs} fight did not end`));
    await L.sleep(3000);
    const after = await p.evaluate(id => { clearInterval(window.__samp); return { open: !document.getElementById(id).hidden, opens: window.__opens }; }, PANEL[cs]);
    rep[`${vp} ${cs}`] = { pre: pre.open, hiddenUnderCard: !during, openAfterCardMidFight: afterCard.open, reShown: after.open, reOpens: after.opens };
    if (!pre.open || during || !after.open || after.opens !== 1) errs.push(`${vp} ${cs} ${JSON.stringify(rep[`${vp} ${cs}`])}`);
    if (cs === 'spec' && vp === '390x844') await p.screenshot({ path: 'shots/p17-prompt-return-spec-390x844.png' });
    await ctx.close();
  }
  rep.errors = errs; fs.writeFileSync('shots/p17-prompt-return.json', JSON.stringify(rep, null, 1));
  for (const [k, v] of Object.entries(rep)) if (k !== 'errors') console.log(k.padEnd(16), JSON.stringify(v));
  console.log(errs.length ? 'P17 PROMPTS FAIL' : 'P17 PROMPTS PASS', errs.length, errs.slice(0, 6)); await b.close();
})();
