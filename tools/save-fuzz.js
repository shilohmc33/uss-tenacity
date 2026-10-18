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
  if (process.env.DEATHS === '1' || process.env.DEATHS === '0') await ctx.addInitScript(on => { window.__TENACITY_TEST_DEATHS = on; }, process.env.DEATHS === '1');   // phase 6: force deaths ON/OFF (default: the shipped PROG value, ON)
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
    ['savedAt string', s => set(s, 'savedAt', 'yesterday')], ['not json', () => '{"version":9,"prog":{', 'keep'], ['empty object', () => ({})],
    // pass 05 m1-b: unreadable saves must be kept aside byte for byte as tenacity.save.v1.corrupt
    ['truncated real save (half)', () => good.slice(0, Math.floor(good.length / 2)), 'keep'], ['truncated real save (last byte cut)', () => good.slice(0, -1), 'keep'],
    ['garbage bytes', () => '\u0000\u00ff~~not a save~~\ud83d\ude80', 'keep'], ['json null', () => 'null', 'keep'],
    // pass 05 m1-a: oversized / out-of-range values (the tester's hand-edited PARTS 1000000000/30 and friends)
    ['parts 1e9', s => set(s, 'ship.parts', 1e9)], ['partsCap 1e9', s => set(s, 'ship.partsCap', 1e9)], ['parts+cap 1e9', s => { set(s, 'ship.parts', 1e9); return set(s, 'ship.partsCap', 1e9); }],
    ['parts -50', s => set(s, 'ship.parts', -50)], ['torps 1e6 + torpCap 1e6', s => { set(s, 'ship.torps', 1e6); return set(s, 'ship.torpCap', 1e6); }],
    ['hull/power/shields/energy 1e9', s => { for (const k of ['hull', 'power', 'shields', 'energy', 'charge']) set(s, 'ship.' + k, 1e9); return s; }],
    ['hull/energy negative', s => { set(s, 'ship.hull', -400); return set(s, 'ship.energy', -1e6); }],
    ['rep 1e15', s => set(s, 'sp.rep', 1e15)], ['rations 1e15', s => set(s, 'prog.rations', 1e15)], ['fleetRep 1e12', s => set(s, 'prog.fleetRep', 1e12)],
    ['xp 1e15', s => set(s, 'prog.xp', 1e15)], ['level 1e9', s => set(s, 'prog.level', 1e9)], ['latinum 1e15', s => set(s, 'prog.latinum', 1e15)],
    ['readiness 1e5 + service 1e5', s => { set(s, 'prog.readiness', 1e5); return set(s, 'prog.service', 1e5); }], ['lockerTier 99', s => set(s, 'prog.lockerTier', 99)],
    ['trade parts 1e6', s => set(s, 'prog.sinks.trade', { day: s.prog.day, parts: 1e6, auto: 1e6 })], ['stats 1e15', s => { for (const k of Object.keys(s.stats || {})) s.stats[k] = 1e15; return s; }],
    // Personal Log phase 1 (save v8): v7 saves migrate (journal seeded from crew.log, pronouns added); v8 plog junk is hardened
    ['v7 -> v8: real v7 save (no plog, no pronouns)', s => v7(s, 5), null, { jMin: 5, jMax: 5 }],
    ['v7 -> v8: crew.log 80 entries (seed caps at 60)', s => v7(s, 80), null, { jMin: 60, jMax: 60 }],
    ['v7 -> v8: crew.log null', s => { v7(s, 0); return set(s, 'prog.crew.log', null); }, null, { jMin: 0, jMax: 0 }],
    ['v7 -> v8: crew.log junk entries', s => { v7(s, 3); s.prog.crew.log.push(null, 5, { kind: 'zap', id: 'x' }, { kind: 'transfer' }); return s; }, null, { jMin: 3, jMax: 3 }],
    ['v7 -> v8: stray plog junk in a v7 save', s => { v7(s, 2); return set(s, 'prog.plog', 'junk'); }, null, { jMin: 2, jMax: 2 }],
    ['v7 -> v8: pronoun junk on occ/alumni/memorial', s => { v7(s, 0); for (const o of Object.values(s.prog.crew.occ)) o.pronoun = 'xe'; for (const a of s.prog.alumni) a.pronoun = 7; s.prog.med.memorial = [{ id: 'grevv', name: 'Ens Grevv', pronoun: {} }, null]; return s; }],
    ['v6 -> v8 (two steps)', s => { v7(s, 4); delete s.prog.med; return set(s, 'version', 6); }, null, { jMin: 4, jMax: 4 }],
    ['v8 plog null', s => set(s, 'prog.plog', null)], ['v8 plog array', s => set(s, 'prog.plog', [1, 2])],
    ['v8 plog junk fields', s => set(s, 'prog.plog', { hist: 5, journal: [null, { id: 1 }, { id: 'tren', k: 'nope' }], snap: 'x', chat: [] }), null, { jMin: 0, jMax: 0 }],
    ['v8 plog hist oversized', s => set(s, 'prog.plog.hist', { tren: Array.from({ length: 50 }, (_, i) => ({ w: 'chat', d: 1e9, day: i, n: -4 })), ghost: [{ w: 5 }] })],
    ['v8 journal 1000 entries', s => set(s, 'prog.plog.journal', Array.from({ length: 1000 }, (_, i) => ({ id: 'tren', n: 'Capt T\'Ren', k: 'chat', d: i, sd: 'x', v: 1e9, x: 'y'.repeat(500) }))), null, { jMin: 360, jMax: 360 }],
    ['v8 snap junk', s => set(s, 'prog.plog.snap', [{ day: 1, op: { tren: 'x', okafor: 1e9 } }, null, { day: 'a' }])],
    ['v8 pronouns wrong for fixed crew', s => { for (const o of Object.values(s.prog.crew.occ)) o.pronoun = 'he'; return s; }],
    // Personal Log phase 2 (save v9): v8 saves migrate (empty gifts, nothing known); v9 gift / know junk is hardened
    // pass 06 (v10): presence clock fields, surgery state, play-day high-water mark, prog.rep
    ['v9 -> v10: real v9 save with an open, half-run warning', s => { s.version = 9; delete s.prog.lastPlayAt; for (const k of ['hushUntil', 'prompt12', 'scene']) delete s.prog.med[k]; const id = Object.keys(s.prog.crew.occ).find(k => !['tren', 'okafor', 'diallo', 'hale', 'thelev'].includes(k)); s.prog.med.inj = [{ id, slot: s.prog.crew.occ[id].slot, short: 'X', name: 'Ens X', cause: 'hazard', what: 'a hazard', sev: 'serious', sys: 'eps', state: 'warning', at: 0, pd: 20, day: 20, left: 7, seen: true, seenT: 90, offline: false, visited: false, excellent: 0, crewSave: false, healAt: null, crit: false }]; s.ship.faults = s.ship.faults || {}; s.ship.faults.eps = { sev: 'med', cost: 1, t: 0 }; s.savedAt = Date.now(); return s; }, null, { v10: 'fresh' }],
    ['v9 -> v10: no med at all', s => { s.version = 9; delete s.prog.med; delete s.prog.lastPlayAt; return s; }],
    ['v10 lastPlayAt junk', s => set(s, 'prog.lastPlayAt', 'tomorrow')], ['v10 lastPlayAt in the future', s => set(s, 'prog.lastPlayAt', Date.now() + 9e11)], ['v10 lastPlayDate junk', s => set(s, 'prog.lastPlayDate', { y: 1 })],
    ['v10 scene junk', s => set(s, 'prog.med.scene', { phase: 'party', name: 5 })], ['v10 hushUntil NaN', s => set(s, 'prog.med.hushUntil', 'NaN')],
    ['v10 surgery state junk', s => { const id = Object.keys(s.prog.crew.occ).find(k => !['tren', 'okafor', 'diallo', 'hale', 'thelev'].includes(k)); s.prog.med.inj = [{ id, sev: 'serious', sys: 'eps', state: 'surgery', surg: 1e9, sx: 7, left: -50, ack: 'yes' }]; return s; }],
    ['v10 injury state unknown', s => { const id = Object.keys(s.prog.crew.occ)[5]; s.prog.med.inj = [{ id, sev: 'serious', sys: 'eps', state: 'zombie' }]; return s; }],
    ['prog.rep negative', s => set(s, 'prog.rep', -10)],
    ['v8 -> v9: real v8 save (no gifts, no know)', s => { s.version = 8; delete s.prog.gifts; delete s.prog.know; return s; }, null, { g: 'empty' }],
    ['v8 -> v9: stray gifts junk in a v8 save', s => { s.version = 8; s.prog.gifts = { inv: { bloodwine: 99 } }; s.prog.know = 'x'; return s; }, null, { g: 'empty' }],
    ['v7 -> v9 (two steps)', s => { v7(s, 3); delete s.prog.gifts; delete s.prog.know; return s; }, null, { jMin: 3, jMax: 3, g: 'empty' }],
    ['v9 gifts null', s => set(s, 'prog.gifts', null)], ['v9 gifts array', s => set(s, 'prog.gifts', [1])], ['v9 know null', s => set(s, 'prog.know', null)],
    ['v9 gifts junk fields', s => set(s, 'prog.gifts', { last: { tren: 'x', okafor: 1e12 }, giftOp: { tren: 1e9, ghost: -5 }, inv: { bloodwine: 1e6, nope: 3, raktajino: -2 }, count: { tren: { kaltoh: 1e9, zzz: 1 } }, lastR: { tren: { item: 'kaltoh', r: 'ecstatic' } }, day: 'x', care: { x: 1e9 }, seed: 'abc', n: { given: 1e30 } })],
    ['v9 know junk', s => set(s, 'prog.know', { tren: { like1: 99, like2: -3, dislike: 'y', avoid: null }, okafor: 5, ghost: {} })],
    ['v9 locker over cap', s => set(s, 'prog.gifts.inv', { kanar: 4, lyre: 4, mineral: 4 })],
    ['v9 giftOp above opinion', s => { set(s, 'prog.opinions.thelev', 20); return set(s, 'prog.gifts.giftOp', { thelev: 90 }); }],
    // Personal Log phase 3 (v11): Insight, seeded second likes, beats / apologies
    ['v10 -> v11: real v10 save (no insight), second likes already learned', s => { s.version = 10; delete s.prog.insight; s.prog.know = { okafor: { like1: 2, like2: 2, dislike: 0, avoid: 0 }, doru: { like1: 0, like2: 1, dislike: 2, avoid: 0 }, tren: { like1: 1, like2: 0, dislike: 0, avoid: 0 } }; return s; }, null, { in: 'fresh', pin: ['okafor', 'doru'], nopin: ['tren'] }],
    ['v10 -> v11: stray insight junk in a v10 save', s => { s.version = 10; s.prog.insight = { xp: 9999, lvl: 10, n: { hints: 50 } }; return s; }, null, { in: 'fresh' }],
    ['v9 -> v11 (two steps)', s => { s.version = 9; delete s.prog.insight; delete s.prog.lastPlayAt; return s; }, null, { in: 'fresh' }],
    ['v11 insight null', s => set(s, 'prog.insight', null)], ['v11 insight array', s => set(s, 'prog.insight', [1, 2])], ['v11 insight string', s => set(s, 'prog.insight', 'wise')],
    ['v11 insight junk fields', s => set(s, 'prog.insight', { xp: 'lots', lvl: 99, n: { chat: -5, hints: 'x', missteps: 1e30 }, seen: { tren: 'dpzzz', okafor: 5 }, beat: { day: 'x', n: 99, pending: { id: 'ghost', order: [0, 0, 0] } }, apol: { ghost: { d: 3, v: 2 }, tren: 'y', okafor: { d: 'x' } }, l2: { tren: 7, okafor: -1, doru: 2 }, notes: [null, 5, { id: 'tren', t: 'x'.repeat(500), d: 'q' }] })],
    ['v11 xp huge, lvl wrong', s => { set(s, 'prog.insight.xp', 1e30); return set(s, 'prog.insight.lvl', 0); }],
    ['v11 xp 100 lvl 0 (re-derived to 5)', s => { set(s, 'prog.insight.xp', 100); return set(s, 'prog.insight.lvl', 0); }, null, { lvl: 5 }],
    ['v11 valid pending beat + apology kept', s => { const id = Object.keys(s.prog.crew.occ).find(k => ['okafor', 'hale', 'diallo'].includes(k)); set(s, 'prog.insight.beat', { day: s.prog.day, n: 1, pending: { id, at: s.prog.day, warn: true, order: [2, 0, 1] } }); return set(s, 'prog.insight.apol', { [id]: { d: s.prog.day - 1, v: 2 } }); }, null, { keepBeat: true }],
    ['v11 apology value too big', s => { const id = Object.keys(s.prog.crew.occ)[0]; return set(s, 'prog.insight.apol', { [id]: { d: 1, v: 50 } }); }],
    ['v11 know avoid junk', s => set(s, 'prog.know', { tren: { like1: 0, like2: 0, dislike: 0, avoid: 9 } })],
    // Personal Log phase 4 (v12): romance
    ['v11 -> v12: real v11 save (no romance)', s => { s.version = 11; delete s.prog.romance; return s; }, null, { rm: 'fresh' }],
    ['v11 -> v12: stray romance junk in a v11 save', s => { s.version = 11; s.prog.romance = { opt: true, partner: 'tren', bond: { tren: { stage: 'together' } } }; return s; }, null, { rm: 'fresh' }],
    ['v10 -> v12 (two steps)', s => { s.version = 10; delete s.prog.insight; delete s.prog.romance; return s; }, null, { rm: 'fresh', in: 'fresh' }],
    ['v12 romance null', s => set(s, 'prog.romance', null)], ['v12 romance array', s => set(s, 'prog.romance', [1])], ['v12 romance string', s => set(s, 'prog.romance', 'yes')],
    ['v12 romance junk fields', s => set(s, 'prog.romance', { opt: 'maybe', partner: 5, bond: { tren: { stage: 'together' }, okafor: { stage: 'courting' }, ghost: { stage: 'together' }, hale: { stage: 'married', dates: -4 }, diallo: 'x' }, fo: { tren: true, x: 1 }, declined: 'y', moments: { hale: { n: 1e9, last: 'q' }, ghost: { n: 3 } }, signal: { id: 'okafor', line: 5 }, disc: { id: 'ghost', kind: 'x' }, letters: [null, { id: 'ghost', t: 'hi', from: 'them' }, { id: 'hale', t: 9 }], thread: { id: 'nobody' }, grief: 7, lastSignal: 'z', n: { dates: -1, signals: 'a' } })],
    ['v12 partner not aboard', s => set(s, 'prog.romance', { opt: true, partner: 'ghost', bond: { ghost: { stage: 'together' } } })],
    ['v12 two active partners', s => { const ids = Object.keys(s.prog.crew.occ).filter(k => !['tren', 'okafor'].includes(k)).slice(0, 2); return set(s, 'prog.romance', { opt: true, partner: ids[0], bond: { [ids[0]]: { stage: 'together', since: 1, dates: 6 }, [ids[1]]: { stage: 'courting', since: 2, dates: 3 } } }); }, null, { rm: 'onePartner' }],
    ['v12 valid partner + pending disclosure kept', s => { const id = Object.keys(s.prog.crew.occ).find(k => ['diallo', 'hale'].includes(k)); return set(s, 'prog.romance', { opt: true, partner: id, bond: { [id]: { stage: 'together', since: 3, dates: 6, last: 5, courtAt: 4, protectUntil: 17 } }, disc: { id, kind: 'senior' }, moments: { [id]: { n: 5, last: 4 } } }); }, null, { rm: 'keep' }],
    ['v12 opt off with a pending signal', s => { const id = Object.keys(s.prog.crew.occ).find(k => !['tren', 'okafor'].includes(k)); return set(s, 'prog.romance', { opt: false, signal: { id, day: 3, line: 'x' } }); }, null, { rm: 'noSignal' }],
    ['v12 friends-only partner', s => { const id = Object.keys(s.prog.crew.occ).find(k => !['tren', 'okafor'].includes(k)); return set(s, 'prog.romance', { opt: true, partner: id, bond: { [id]: { stage: 'courting' } }, fo: { [id]: true } }); }],
    // pass 07 (v13): present-time play days + present-hours death gate
    ['v12 -> v13: real v12 save', s => { s.version = 12; delete s.prog.dayPresent; delete s.prog.presentTotal; s.prog.playDays = 9; return s; }, null, { v13: 'migr', pd: 9 }],
    ['v12 -> v13: a past death (lastDeathPT estimated)', s => { s.version = 12; delete s.prog.dayPresent; delete s.prog.presentTotal; s.prog.playDays = 30; s.prog.med.lastDeathPD = 20; return s; }, null, { v13: 'migr', pd: 30 }],
    ['v13 future lastPlayDate', s => set(s, 'prog.lastPlayDate', '2027-12-01')], ['v13 dayPresent 1e12', s => set(s, 'prog.dayPresent', 1e12)], ['v13 dayPresent junk', s => set(s, 'prog.dayPresent', 'x')],
    ['v13 presentTotal negative', s => set(s, 'prog.presentTotal', -50)], ['v13 lastDeathPT above presentTotal', s => { s.prog.presentTotal = 100; s.prog.med.lastDeathPD = 1; s.prog.med.lastDeathPT = 1e9; return s; }],
    ['v12 letters over cap + thread to a non-alum', s => set(s, 'prog.romance', { opt: true, letters: Array.from({ length: 200 }, (_, i) => ({ id: (s.prog.alumni[0] || { id: 'x' }).id, d: i, from: 'them', t: 'Dear Lt' })), thread: { id: 'nobody', next: 1 } })],
    ['everything maxed', s => { for (const [k, v] of [['ship.parts', 1e9], ['ship.partsCap', 1e9], ['ship.torps', 1e9], ['ship.hull', 1e9], ['sp.rep', 1e18], ['prog.rations', 1e18], ['prog.xp', 1e18], ['prog.level', 1e18], ['prog.fleetRep', 1e18]]) set(s, k, v); return s; }],
  ];
  // a real v7 save from the v8 base: no plog, no pronouns anywhere, crew.log with n realistic entries
  function v7(s, n) {
    s.version = 7; delete s.prog.plog;
    for (const o of Object.values(s.prog.crew.occ)) delete o.pronoun; for (const a of s.prog.alumni || []) delete a.pronoun; for (const e of (s.prog.med || {}).memorial || []) delete e.pronoun;
    const ids = Object.keys(s.prog.crew.occ), kinds = ['promotion', 'demotion', 'arrival', 'transfer'];
    s.prog.crew.log = Array.from({ length: n }, (_, i) => ({ kind: kinds[i % 4], id: ids[i % ids.length], name: 'Ens Someone', day: 1 + i, playDays: 1 + i, ...(i % 4 === 3 ? { posting: 'sb375', opinion: 12, fr: 1, why: 'roll' } : {}) }));
    return s;
  }
  const all = paths(base).filter(x => !/^log\./.test(x));
  const cases = named.map(([n, f, keep, ex]) => [n, f, keep, ex]);
  for (let i = 0; i < NRAND; i++) { const muts = 1 + Math.floor(rnd() * 3), list = []; for (let j = 0; j < muts; j++) list.push([all[Math.floor(rnd() * all.length)], JUNK[Math.floor(rnd() * JUNK.length)]]);
    cases.push([`random#${i + 1}: ` + list.map(([a, v]) => `${a}=${JSON.stringify(v)}`).join(' '), s => { for (const [a, v] of list) set(s, a, v); return s; }]); }
  const results = [];
  for (const [name, f, keep, ex] of cases) {
    errs = []; let s = f(clone(base)); const raw = typeof s === 'string' ? s : JSON.stringify(s);
    await p.evaluate(([k, r]) => { window.__noSave = true; localStorage.setItem(k, r); sessionStorage.clear(); }, [KEY, raw]);
    const r = { name, booted: false, ticks: false, sheets: false, version: null, recovered: false, errors: [] };
    try {
      await p.goto(BASE); await ready(20000); r.booted = true;
      if (keep) {   // pass 05 m1-b: the original bytes are in .corrupt, and the player is told
        const k = await p.evaluate(kk => ({ c: localStorage.getItem(kk + '.corrupt'), told: __T.G.log.some(e => /kept aside/.test(e.text || e.msg || JSON.stringify(e))) }), KEY);
        r.keptExact = k.c === raw; r.told = k.told; r.keptBytes = k.c == null ? null : k.c.length;
        if (!r.keptExact) r.errors.push(`.corrupt ${k.c == null ? 'missing' : 'differs from the original bytes'}`); if (!r.told) r.errors.push('no "kept aside" log line');
      }
      const t0 = await p.evaluate(() => __T.G.ship.elapsed); await sleep(700); r.ticks = (await p.evaluate(() => __T.G.ship.elapsed)) > t0;
      r.sheets = await p.evaluate(async () => { for (const n of ['orders', 'duty', 'crew', 'log']) { document.querySelector(`.sheetBtns [data-sheet="${n}"]`).click(); await new Promise(r => setTimeout(r, 150)); } const c = document.querySelector('#sheetClose'); c && c.click(); return true; });
      await p.evaluate(() => __T.saveGame()); r.version = await p.evaluate(() => __T.G.version);
      r.recovered = await p.evaluate(k => !!localStorage.getItem(k + '.corrupt'), KEY);
      r.state = await p.evaluate(() => ({ rank: __T.G.prog.rank, tier: __T.G.prog.cabin.tier, level: __T.G.prog.level, parts: __T.G.ship.parts, alumni: __T.G.prog.alumni.length }));
      // pass 05 m1-a: every case, every resource inside its range (checked after loading + ticking)
      r.range = await p.evaluate(async () => { const G = __T.G, S = G.ship, P = G.prog, PR = await import('/js/progression.js'), bad = [];
        const chk = (n, v, lo, hi) => { if (!(typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi)) bad.push(`${n}=${v}`); };
        chk('partsCap', S.partsCap, 20, 30); chk('parts', S.parts, 0, S.partsCap); chk('torpCap', S.torpCap, 8, 8); chk('torps', S.torps, 0, S.torpCap);
        for (const k of ['hull', 'power', 'shields', 'energy', 'charge']) chk(k, S[k], 0, 100);
        const M = PR.SANE_MAX + 1000;   // open-ended currencies: load ceiling + what 0.7 s of play can add
        chk('rep', G.sp.rep, 0, M); chk('rations', P.rations, 0, M); chk('fleetRep', P.fleetRep, 0, 1e5); chk('latinum', P.latinum, 0, PR.SANE_MAX);
        chk('level', P.level, 1, 1000); chk('xp', P.xp, 0, PR.xpToNext(P.level)); chk('readiness', P.readiness, 0, 100); chk('rank', P.rank, 0, PR.PROG.ranks.length - 1);
        for (const [id, v] of Object.entries(P.opinions)) chk('opinion.' + id, v, -100, 100);
        return bad; });
      if (r.range.length) r.errors.push('out of range: ' + r.range.join(', '));
      // v8: the Personal Log is well-formed and every crewmate (aboard, alumni, memorial) has a valid pronoun; fixed pronouns hold
      r.plog = await p.evaluate(async () => { const P = __T.G.prog, R = await import('/js/roster.js'), PR = await import('/js/progression.js'), bad = [], L = P.plog, ok = ['she', 'he', 'they'];
        if (!L || typeof L !== 'object' || Array.isArray(L) || !Array.isArray(L.journal) || !Array.isArray(L.snap) || !L.hist || typeof L.hist !== 'object') return { bad: ['plog shape'] };
        if (L.journal.length > PR.PROG.plog.journal) bad.push('journal over cap ' + L.journal.length);
        for (const [id, a] of Object.entries(L.hist)) if (!Array.isArray(a) || a.length > PR.PROG.plog.hist || a.some(e => !Number.isFinite(e.d) || Math.abs(e.d) > 200)) bad.push('hist ' + id);
        for (const o of Object.values(P.crew.occ)) { if (!ok.includes(o.pronoun)) bad.push('occ pronoun ' + o.id + '=' + o.pronoun); const sc = R.START_CREW.find(x => x.id === o.id); if (sc && sc.pronoun !== o.pronoun) bad.push('fixed pronoun ' + o.id); }
        for (const a of P.alumni) if (!ok.includes(a.pronoun)) bad.push('alum pronoun ' + a.id);
        for (const e of P.med.memorial) if (!ok.includes(e.pronoun)) bad.push('memorial pronoun ' + e.id);
        return { bad, journal: L.journal.length }; });
      if (r.plog.bad.length) r.errors.push('plog: ' + r.plog.bad.join(', '));
      // v9: gift state well-formed: locker within its cap, every gift share within [0, opinion], know values 0..2
      r.gifts = await p.evaluate(async () => { const P = __T.G.prog, PR = await import('/js/progression.js'), g = P.gifts, bad = [];
        if (!g || typeof g !== 'object' || Array.isArray(g) || !P.know || typeof P.know !== 'object') return { bad: ['gifts/know shape'] };
        const inv = Object.values(g.inv || {}).reduce((a, b) => a + b, 0); if (inv > PR.PROG.gifts.invMax) bad.push('locker ' + inv);
        for (const [id, v] of Object.entries(g.giftOp || {})) if (!(v >= 0 && v <= Math.max(0, PR.opinionOf(id)) + 1e-6)) bad.push('giftOp ' + id + '=' + v);
        for (const [id, k] of Object.entries(P.know)) for (const f of ['like1', 'like2', 'dislike', 'avoid']) if (![0, 1, 2].includes(k[f])) bad.push('know ' + id + '.' + f);
        return { bad, empty: !inv && !Object.keys(g.giftOp).length && !Object.keys(P.know).length && !g.n.given }; });
      if (r.gifts.bad.length) r.errors.push('gifts: ' + r.gifts.bad.join(', '));
      if (ex && ex.g === 'empty' && !r.gifts.empty) r.errors.push('v8 -> v9 migration did not start from an empty gift state');
      // v10: injury clock state in range; a migrated warning restarts fresh (180 s; the harness opens DUTY / CREW, which counts as seeing it)
      r.med10 = await p.evaluate(async () => { const P = __T.G.prog, PR = await import('/js/progression.js'), K = PR.PROG.deaths, m = P.med, bad = [];
        for (const x of m.inj) { if (!['warning', 'surgery', 'stable', 'recovering'].includes(x.state)) bad.push('state ' + x.state); if (!(x.left >= 0 && x.left <= K.window)) bad.push('left ' + x.left); if (typeof x.ack !== 'boolean') bad.push('ack'); if (x.state === 'surgery' && !(x.sx >= 0 && x.sx <= K.surgery.max)) bad.push('sx ' + x.sx); }
        if (m.scene !== null && (typeof m.scene !== 'object' || typeof m.scene.name !== 'string')) bad.push('scene');
        if (!(m.hushUntil >= 0)) bad.push('hush'); if (P.lastPlayAt !== null && !(P.lastPlayAt > 0 && P.lastPlayAt <= Date.now())) bad.push('lastPlayAt ' + P.lastPlayAt);
        if ('rep' in P && !(P.rep >= 0)) bad.push('prog.rep ' + P.rep);
        return { bad, warn: m.inj.filter(x => x.state === 'warning').map(x => ({ left: Math.round(x.left), ack: x.ack })) }; });
      if (r.med10.bad.length) r.errors.push('med v10: ' + r.med10.bad.join(', '));
      if (ex && ex.v10 === 'fresh' && !(r.med10.warn.length && r.med10.warn.every(w => w.left >= 170))) r.errors.push('v9 -> v10: open warning did not restart fresh ' + JSON.stringify(r.med10.warn));
      // v11: Insight well-formed; level re-derived from XP; seeded second likes in 0..2; a migrated save starts at 0 and keeps learned second likes
      r.ins = await p.evaluate(async () => { const P = __T.G.prog, PR = await import('/js/progression.js'), IN = await import('/js/insight.js'), K = PR.PROG.insight, I = P.insight, bad = [];
        if (!I || typeof I !== 'object' || Array.isArray(I)) return { bad: ['insight shape'] };
        if (!(Number.isFinite(I.xp) && I.xp >= 0 && I.xp <= PR.SANE_MAX + 100)) bad.push('xp ' + I.xp);
        if (I.lvl !== PR.insightLevel(I.xp) || !(I.lvl >= 0 && I.lvl <= K.levels.length)) bad.push(`lvl ${I.lvl} for xp ${I.xp}`);
        for (const [k, v] of Object.entries(I.n || {})) if (!(Number.isFinite(v) && v >= 0)) bad.push('n.' + k);
        for (const [id, v] of Object.entries(I.l2 || {})) if (![0, 1, 2].includes(v)) bad.push('l2.' + id + '=' + v);
        for (const [id, a] of Object.entries(I.apol || {})) if (!P.crew.occ[id] || !(a && a.v >= 0 && a.v <= -K.beat.misstep && Number.isFinite(a.d))) bad.push('apol.' + id);
        const b = I.beat.pending; if (b && (!P.crew.occ[b.id] || !IN.BEATS[b.id] || b.order.slice().sort().join() !== '0,1,2')) bad.push('pending beat');
        if (!(I.beat.n >= 0 && I.beat.n <= K.beat.perDay)) bad.push('beat.n ' + I.beat.n);
        if (!Array.isArray(I.notes) || I.notes.length > K.notes || I.notes.some(x => typeof x.t !== 'string' || x.t.length > 160)) bad.push('notes');
        for (const [id, v] of Object.entries(I.seen || {})) if (typeof v !== 'string' || /[^dpcu]/.test(v)) bad.push('seen.' + id);
        return { bad, xp: I.xp, lvl: I.lvl, l2: I.l2, nsum: Object.values(I.n).reduce((a, b) => a + b, 0), pending: !!b, apol: Object.keys(I.apol).length }; });
      if (r.ins.bad.length) r.errors.push('insight v11: ' + r.ins.bad.join(', '));
      if (ex && ex.in === 'fresh' && !(r.ins.xp <= 5 && r.ins.nsum <= 5)) r.errors.push('v10 -> v11: Insight did not start fresh ' + JSON.stringify(r.ins));   // (a chat during the 0.7 s tick can add 1-2)
      if (ex && ex.pin) for (const id of ex.pin) if (r.ins.l2[id] !== 0) r.errors.push('v10 -> v11: learned second like not pinned for ' + id);
      if (ex && ex.lvl != null && r.ins.lvl !== ex.lvl) r.errors.push(`insight lvl ${r.ins.lvl} != ${ex.lvl}`);
      if (ex && ex.keepBeat && !(r.ins.pending && r.ins.apol === 1)) r.errors.push('valid beat / apology lost ' + JSON.stringify(r.ins));
      // v12: romance well-formed; at most one partner (aboard, active, never T'Ren / Okafor); excluded crew never bonded; letters capped
      r.rom = await p.evaluate(async () => { const P = __T.G.prog, PR = await import('/js/progression.js'), K = PR.PROG.romance, R = P.romance, bad = [];
        if (!R || typeof R !== 'object' || Array.isArray(R)) return { bad: ['romance shape'] };
        if (![null, true, false].includes(R.opt)) bad.push('opt ' + R.opt);
        const act = Object.entries(R.bond).filter(([, b]) => ['interested', 'courting', 'together'].includes(b.stage)).map(([id]) => id);
        if (act.length > 1) bad.push('active bonds ' + act.join(','));
        if (R.partner !== null && (!P.crew.occ[R.partner] || !act.includes(R.partner) || K.excluded.includes(R.partner))) bad.push('partner ' + R.partner);
        if (R.partner === null && act.length) bad.push('active bond without partner');
        for (const id of K.excluded) if (R.bond[id] || R.fo[id] || (R.signal && R.signal.id === id)) bad.push('excluded ' + id);
        if (R.partner && R.fo[R.partner]) bad.push('friends-only partner');
        if (R.signal && (R.opt !== true || !P.crew.occ[R.signal.id] || R.partner)) bad.push('signal');
        if (R.disc && R.disc.id !== R.partner) bad.push('disc');
        if (!Array.isArray(R.letters) || R.letters.length > K.letters) bad.push('letters');
        if (R.thread && !P.alumni.some(a => a.id === R.thread.id)) bad.push('thread');
        for (const [k, v] of Object.entries(R.n)) if (!(Number.isFinite(v) && v >= 0)) bad.push('n.' + k);
        for (const [id, m] of Object.entries(R.moments)) if (!(m.n >= 0 && m.n <= 999)) bad.push('moments.' + id);
        return { bad, opt: R.opt, partner: R.partner, bonds: Object.keys(R.bond).length, disc: !!R.disc, signal: !!R.signal, nsum: Object.values(R.n).reduce((a, b) => a + b, 0) }; });
      if (r.rom.bad.length) r.errors.push('romance v12: ' + r.rom.bad.join(', '));
      // v13: play-day clock sane; never a future date; present-time fields in range; the migrated first day is owed at once
      r.pd13 = await p.evaluate(async () => { const P = __T.G.prog, PR = await import('/js/progression.js'), bad = [], today = PR.localDate();
        if (!(P.dayPresent >= 0 && P.dayPresent <= PR.PROG.playDayPresentS)) bad.push('dayPresent ' + P.dayPresent);
        if (!(Number.isFinite(P.presentTotal) && P.presentTotal >= 0)) bad.push('presentTotal ' + P.presentTotal);
        if (P.lastPlayDate && P.lastPlayDate > today) bad.push('future lastPlayDate ' + P.lastPlayDate);
        if (P.med.lastDeathPT != null && !(P.med.lastDeathPT >= 0 && P.med.lastDeathPT <= P.presentTotal)) bad.push('lastDeathPT ' + P.med.lastDeathPT);
        return { bad, dayPresent: P.dayPresent, presentTotal: P.presentTotal, ldpt: P.med.lastDeathPT, pd: P.playDays }; });
      if (r.pd13.bad.length) r.errors.push('playday v13: ' + r.pd13.bad.join(', '));
      if (ex && ex.v13 === 'migr' && !((r.pd13.dayPresent === 180 || r.pd13.pd > ex.pd) && r.pd13.presentTotal >= ex.pd * 1200 && r.pd13.presentTotal < ex.pd * 1200 + 600)) r.errors.push('v12 -> v13 migration ' + JSON.stringify(r.pd13));

      if (ex && ex.rm === 'fresh' && !(r.rom.opt === null && !r.rom.partner && !r.rom.bonds && !r.rom.nsum)) r.errors.push('v11 -> v12: romance did not start fresh ' + JSON.stringify(r.rom));
      if (ex && ex.rm === 'onePartner' && !r.rom.partner) r.errors.push('two partners: the named partner was dropped');
      if (ex && ex.rm === 'keep' && !(r.rom.partner && r.rom.disc)) r.errors.push('valid partner / disclosure lost ' + JSON.stringify(r.rom));
      if (ex && ex.rm === 'noSignal' && r.rom.signal) r.errors.push('signal kept with romance off');
      if (ex && ex.jMin != null && !(r.plog.journal >= ex.jMin && r.plog.journal <= ex.jMax)) r.errors.push(`journal ${r.plog.journal} not in ${ex.jMin}..${ex.jMax}`);
    } catch (e) { r.errors.push(String(e.message || e).slice(0, 200)); }
    await p.evaluate(k => localStorage.removeItem(k + '.corrupt'), KEY).catch(() => {});
    r.errors.push(...errs); r.pass = r.booted && r.ticks && r.sheets && r.version === 13 && !r.errors.length;
    results.push(r); if (!r.pass) console.log('FAIL', JSON.stringify(r));
  }
  await b.close();
  const pass = results.filter(r => r.pass).length, rec = results.filter(r => r.recovered).length;
  fs.writeFileSync(OUT + 'save-fuzz-report.json', JSON.stringify({ cases: results.length, pass, recoveredFresh: rec, results }, null, 1));
  console.log(`save fuzz: ${pass}/${results.length} booted clean (named ${named.length}, random ${NRAND}); fell back to a fresh shift (save kept aside): ${rec}`);
  console.log(results.filter(r => r.recovered).map(r => '  fresh: ' + r.name).join('\n'));
  console.log(pass === results.length ? 'FUZZ PASS' : 'FUZZ FAIL', process.env.DEATHS === '0' ? '(deaths OFF)' : '(deaths ON)'); process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
