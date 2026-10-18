// pt04 m1: corrupted-save fuzz test. Builds a real save, then boots the game from ~70 corrupted variants (the tester's named
// cases + seeded random mutations). Each must finish loading, tick, render every sheet, and log zero console errors.
// NODE_PATH=/workspace/pwtools/node_modules node tools/save-fuzz.js [base] [randomCases]  -> shots/save-fuzz-report.json
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const NRAND = +(process.argv[3] || 50);
const OUT = __dirname + '/../shots/';
const KEY = 'tenacity.save.v1';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let seed = 1234567; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const clone = o => JSON.parse(JSON.stringify(o));
const set = (o, path, v) => { const ks = path.split('.'); let x = o; for (const k of ks.slice(0, -1)) { if (x[k] == null || typeof x[k] !== 'object') x[k] = {}; x = x[k]; } if (v === '__del') delete x[ks.at(-1)]; else x[ks.at(-1)] = v; return o; };
function paths(o, pre = '', out = [], depth = 0) { if (depth > 4 || !o || typeof o !== 'object') return out; for (const k of Object.keys(o)) { const p = pre ? pre + '.' + k : k; out.push(p); if (k !== 'log') paths(o[k], p, out, depth + 1); } return out; }
const JUNK = [null, '__del', -1, 7, 1e12, -1e12, 'admiral', '', {}, [], true, 'NaN', [1, 2, 3], { x: 1 }];
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); let errs = [];
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  const ready = (t = 20000) => p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: t });
  // 1) a realistic mid-game save: Lt, decor, alumni, opinions, a fault
  await p.goto(BASE + '?reset=1'); await ready(60000); await sleep(500);
  const good = await p.evaluate(async () => {
    const G = __T.G, PR = await import('/js/progression.js'), CL = __T.CL;
    PR.awardXP(12000, 'manual'); G.prog.rank = 1; __T.CB.applyTier(); G.sp.rep = 900; G.prog.cabin.rations = 800;
    const ids = Object.keys(__T.CB.DECOR).slice(0, 2); G.prog.cabin.owned.push(...ids); G.prog.cabin.placed[__T.CB.tier().slots[0].id] = ids[0];
    Object.assign(G.prog.opinions, { tren: 30, okafor: 50, thelev: 60 });
    const reg = PR.crewList().find(c => !c.senior && c.id !== 'thelev'); if (reg && CL.transferOff) CL.transferOff(reg.id);
    G.ship.faults.coolant = { sev: 'med', t: 0, cost: 1, escT: 0 };
    __T.saveGame(); return localStorage.getItem('tenacity.save.v1');
  });
  const base = JSON.parse(good);
  // 2) named cases (tester pass 04 m1 and friends)
  const named = [
    ['opinions null', s => set(s, 'prog.opinions', null)], ['opinions junk', s => set(s, 'prog.opinions', { tren: 'x', okafor: 1e9, ghost: 5 })],
    ['cabin tier admiral', s => set(s, 'prog.cabin.tier', 'admiral')], ['cabin null', s => set(s, 'prog.cabin', null)],
    ['cabin placed bogus', s => set(s, 'prog.cabin.placed', { wall1: 'nope', zzz: 'diploma' })],
    ['alum bad posting+species', s => { s.prog.alumni = (s.prog.alumni || []).concat([{ id: 'x1', name: 'Ens Ghost', posting: 'narnia', species: 'gorn-ish', rank: 99 }]); return s; }],
    ['alumni null', s => set(s, 'prog.alumni', null)], ['alumni junk', s => set(s, 'prog.alumni', [null, 5, 'a', {}])],
    ['rank 7', s => set(s, 'prog.rank', 7)], ['rank -3', s => set(s, 'prog.rank', -3)], ['rank string', s => set(s, 'prog.rank', 'cmdr')],
    ['level NaN', s => set(s, 'prog.level', 'abc')], ['xp negative', s => set(s, 'prog.xp', -500)],
    ['crew null', s => set(s, 'prog.crew', null)], ['crew occ bad species', s => { for (const o of Object.values(s.prog.crew.occ)) o.species = 'blob'; return s; }],
    ['crew slots to ghosts', s => { for (const k of Object.keys(s.prog.crew.slots)) s.prog.crew.slots[k] = 'ghost'; return s; }],
    ['crew occ rank 99', s => { for (const o of Object.values(s.prog.crew.occ)) o.rank = 99; return s; }],
    ['prog null', s => set(s, 'prog', null)], ['prog array', s => set(s, 'prog', [])], ['ship null', s => set(s, 'ship', null)],
    ['ship parts NaN', s => set(s, 'ship.parts', 'lots')], ['ship faults junk', s => set(s, 'ship.faults', { warpcore: null, nowhere: { sev: 'x' } })],
    ['sp null', s => set(s, 'sp', null)], ['lt null', s => set(s, 'lt', null)], ['log object', s => set(s, 'log', { a: 1 })],
    ['version string', s => set(s, 'version', 'seven')], ['version 99', s => set(s, 'version', 99)], ['version 3 with v7 body', s => set(s, 'version', 3)],
    ['spec array', s => set(s, 'prog.spec', ['warp', 'nope'])], ['board bogus', s => set(s, 'prog.board', { to: 'admiral' })],
    ['history null', s => set(s, 'prog.history', null)], ['med null', s => set(s, 'prog.med', null)], ['fav null', s => set(s, 'prog.fav', null)],
    ['requests junk', s => set(s, 'prog.requests', [{ id: 'ghost' }, null])], ['savedAt future', s => set(s, 'savedAt', Date.now() + 864e5)],
    ['savedAt string', s => set(s, 'savedAt', 'yesterday')], ['not json', () => '{"version":7,"prog":{'], ['empty object', () => ({})],
  ];
  const all = paths(base).filter(x => !/^log\./.test(x));
  const cases = named.map(([n, f]) => [n, f]);
  for (let i = 0; i < NRAND; i++) { const muts = 1 + Math.floor(rnd() * 3), list = []; for (let j = 0; j < muts; j++) list.push([all[Math.floor(rnd() * all.length)], JUNK[Math.floor(rnd() * JUNK.length)]]);
    cases.push([`random#${i + 1}: ` + list.map(([a, v]) => `${a}=${JSON.stringify(v)}`).join(' '), s => { for (const [a, v] of list) set(s, a, v); return s; }]); }
  const results = [];
  for (const [name, f] of cases) {
    errs = []; let s = f(clone(base)); const raw = typeof s === 'string' ? s : JSON.stringify(s);
    await p.evaluate(([k, r]) => { window.__noSave = true; localStorage.setItem(k, r); sessionStorage.clear(); }, [KEY, raw]);
    const r = { name, booted: false, ticks: false, sheets: false, version: null, recovered: false, errors: [] };
    try {
      await p.goto(BASE); await ready(20000); r.booted = true;
      const t0 = await p.evaluate(() => __T.G.ship.elapsed); await sleep(700); r.ticks = (await p.evaluate(() => __T.G.ship.elapsed)) > t0;
      r.sheets = await p.evaluate(async () => { for (const n of ['orders', 'duty', 'crew', 'log']) { document.querySelector(`.sheetBtns [data-sheet="${n}"]`).click(); await new Promise(r => setTimeout(r, 150)); } const c = document.querySelector('#sheetClose'); c && c.click(); return true; });
      await p.evaluate(() => __T.saveGame()); r.version = await p.evaluate(() => __T.G.version);
      r.recovered = await p.evaluate(k => !!localStorage.getItem(k + '.corrupt'), KEY);
      r.state = await p.evaluate(() => ({ rank: __T.G.prog.rank, tier: __T.G.prog.cabin.tier, level: __T.G.prog.level, parts: __T.G.ship.parts, alumni: __T.G.prog.alumni.length }));
    } catch (e) { r.errors.push(String(e.message || e).slice(0, 200)); }
    await p.evaluate(k => localStorage.removeItem(k + '.corrupt'), KEY).catch(() => {});
    r.errors.push(...errs); r.pass = r.booted && r.ticks && r.sheets && r.version === 7 && !r.errors.length;
    results.push(r); if (!r.pass) console.log('FAIL', JSON.stringify(r));
  }
  await b.close();
  const pass = results.filter(r => r.pass).length, rec = results.filter(r => r.recovered).length;
  fs.writeFileSync(OUT + 'save-fuzz-report.json', JSON.stringify({ cases: results.length, pass, recoveredFresh: rec, results }, null, 1));
  console.log(`save fuzz: ${pass}/${results.length} booted clean (named ${named.length}, random ${NRAND}); fell back to a fresh shift (save kept aside): ${rec}`);
  console.log(results.filter(r => r.recovered).map(r => '  fresh: ' + r.name).join('\n'));
  console.log(pass === results.length ? 'FUZZ PASS' : 'FUZZ FAIL'); process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
