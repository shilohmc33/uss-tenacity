// P34b: the story odds line is >= 12px and fits (844x390 shot); a saved story fight waits under the Shift Report after an
// offline reload and starts only after RESUME DUTY (shot). Usage: node tools/p34b-check.js
const { chromium } = require('playwright-core'); const BASE = process.env.BASE || 'http://127.0.0.1:8765/', OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [], fails = [], res = {}, ok = (c, m) => { if (!c) fails.push(m); };
  for (const [w, h] of [[390, 844], [844, 390], [1280, 800]]) {
    const tag = `${w}x${h}`, c = await br.newContext({ viewport: { width: w, height: h } }), p = await c.newPage();
    p.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); }); p.on('pageerror', e => errs.push(`${tag}: ${e.message}`));
    const boot = async q => { await p.goto(BASE + q); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(500); };
    await boot('?reset=1');
    // odds line
    const odds = await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); __T.G.sp.travel = { dest: 'convoy', t: 10, dur: 600 }; __T.G.sp.location = 'convoy';
      __T.ST.forceStory('jemhadar_wreck'); return null; });
    await sleep(400);
    res[tag] = { odds: await p.evaluate(() => [...document.querySelectorAll('#storyScene .stc small')].map(s => { const r = s.getBoundingClientRect(), b = s.closest('.stc').getBoundingClientRect();
      return { px: parseFloat(getComputedStyle(s).fontSize), fits: r.left >= b.left - 0.5 && r.right <= b.right + 0.5 && r.top >= b.top - 0.5 && r.bottom <= b.bottom + 0.5 && s.scrollWidth <= s.clientWidth + 1, vis: b.bottom <= innerHeight + 0.5 || getComputedStyle(s.closest('.stc').parentElement).overflowY !== 'visible', t: s.textContent }; })) };
    if (tag === '844x390') await p.screenshot({ path: OUT + 'p34b-odds-844x390.png' });
    ok(res[tag].odds.length >= 3 && res[tag].odds.every(o => o.px >= (tag === '844x390' ? 12 : 11) && o.fits && o.vis), `odds line ${tag} ` + JSON.stringify(res[tag].odds));
    // pending fight across an offline reload
    await p.evaluate(() => { __T.ST.closeStory(); const G = __T.G; G.sp.battle = null; G.prog.story.fight = 'story_wreck'; G.sp.travel = { dest: 'convoy', t: 10, dur: 3000 }; G.sp.location = 'convoy'; G.sp.travelPaused = false; G.sp.lastBattleT = -1e9;
      window.__noSave = false; __T.saveGame(); const k = 'tenacity.save.v1', s = JSON.parse(localStorage.getItem(k)); s.savedAt -= 120000; localStorage.setItem(k, JSON.stringify(s)); window.__noSave = true; });
    await boot('');
    const st = () => p.evaluate(() => ({ report: !document.querySelector('#report').hidden, fight: __T.G.prog.story.fight, battle: !!__T.G.sp.battle, open: [...document.querySelectorAll('.modal')].filter(m => !m.hidden).map(m => m.id) }));
    const R = res[tag].reload = { load: await st() };
    await p.evaluate(() => { __T.PACE_RT.sessionT = 1e6; __T.G.sp.lastBattleT = -1e9; }); await sleep(1500); R.calmOver = await st();
    await p.click('#report button[data-close="report"]'); await sleep(300);
    R.afterResume0 = await st(); await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => { if (m.id !== 'report') m.hidden = true; }); __T.PACE_RT.sessionT = 1e6; }); await sleep(1500);
    R.afterResume = await p.evaluate(() => ({ fight: __T.G.prog.story.fight, battle: __T.G.sp.battle && { ctx: __T.G.sp.battle.ctx, soft: __T.G.sp.battle.soft }, log: (document.querySelector('#log') || document.body).textContent.includes('still waiting for you') }));
    await p.screenshot({ path: OUT + `p34b-fight-after-resume-${tag}.png` });
    ok(R.load.report && R.load.fight === 'story_wreck' && !R.load.battle && R.calmOver.report && R.calmOver.fight === 'story_wreck' && !R.calmOver.battle && R.afterResume.battle && R.afterResume.battle.soft === true && R.afterResume.fight === null, `fight after Resume Duty ${tag} ` + JSON.stringify(R));
    await c.close();
  }
  await br.close();
  console.log(JSON.stringify(res, null, 1)); console.log('FAILS', fails.length, fails); console.log('ERRORS', errs.length, errs);
})();
