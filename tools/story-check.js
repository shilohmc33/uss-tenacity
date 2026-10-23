// E0 + E1 check: the 4 story events (scene + outcome shots at 3 sizes, layout, sim paused), the shore-leave chip at 844x390,
// and a logic block: odds bounds with junk, 3 bands reachable, no spend on the safe choice, costs only when shown, gates,
// gentle mode never injures, partner only with romance on, no she/her for Hale / Orvin, save after the roll, hardener, P31 lows.
// Usage: node tools/story-check.js   (exit code 1 on any failed assert or console error)
const { chromium } = require('playwright-core'); const BASE = process.env.BASE || 'http://127.0.0.1:8765/', OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const IDS = ['coolant_cascade', 'mess_hall_feud', 'letter_home', 'ferengi_salvage'];
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [], fails = [], res = {}, ok = (c, m) => { if (!c) fails.push(m); };
  for (const [w, h] of [[390, 844], [844, 390], [1280, 800]]) {
    const tag = `${w}x${h}`, c = await br.newContext({ viewport: { width: w, height: h } }), p = await c.newPage();
    p.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); }); p.on('pageerror', e => errs.push(`${tag}: ${e.message}`));
    await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(400);
    await p.evaluate(() => { window.__noSave = true; __T.G.prog.rations = 500; });
    const R = res[tag] = {};
    // ---- shore chip (docked at DS9 on a fresh shift) ----
    R.shore = await p.evaluate(() => { const b = [...document.querySelectorAll('[data-shore]')].find(x => x.getBoundingClientRect().height > 0); if (!b) return null; const r = b.getBoundingClientRect(), s = b.querySelector('small'), sr = s && s.getBoundingClientRect();
      const wrap = b.closest('.chipWrap') || b.parentElement, wr = wrap.getBoundingClientRect();
      return { text: b.innerText.replace(/\s+/g, ' '), h: Math.round(r.height), clip: b.scrollWidth > b.clientWidth + 1, smallIn: !!sr && sr.right <= r.right + 1 && sr.left >= r.left - 1, inWrap: r.left >= wr.left - 1 && r.right <= wr.right + 1 }; });
    ok(R.shore && !R.shore.clip && R.shore.smallIn && R.shore.h >= 44 && /if granted · (likely|fair odds|a long shot|unlikely)/.test(R.shore.text), `${tag} shore chip ${JSON.stringify(R.shore)}`);
    if (tag === '844x390') { await p.evaluate(() => { const b = [...document.querySelectorAll('[data-shore]')].find(x => x.getBoundingClientRect().height > 0); b && b.scrollIntoView({ block: 'nearest' }); __T.app.paused = true; }); await sleep(150); await p.screenshot({ path: OUT + 'e0-shore-chip-844x390.png' }); await p.evaluate(() => { __T.app.paused = false; }); }
    // ---- the 4 scenes ----
    for (const id of IDS) {
      const s = await p.evaluate(id => { const ST = __T.ST; ST.closeStory(); return ST.forceStory(id); }, id); ok(s, `${tag} ${id} force`);
      await p.waitForFunction(() => { const i = document.querySelector('#storyScene img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 }).catch(() => fails.push(`${tag} ${id} img`));
      const e0 = await p.evaluate(() => __T.G.ship.elapsed); await sleep(350);
      const L = await p.evaluate(e0 => { const m = document.getElementById('storyScene'), f = m.querySelector('.storyframe').getBoundingClientRect(), pn = m.querySelector('.storypanel'), pr = pn.getBoundingClientRect(), img = m.querySelector('img');
        const btns = [...m.querySelectorAll('.stc')].map(b => { const r = b.getBoundingClientRect(); return { h: Math.round(r.height), inV: r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1, t: b.innerText.replace(/\s+/g, ' ') }; });
        return { paused: __T.G.ship.elapsed === e0, vis: !m.hidden, frameFit: f.width <= innerWidth + 1 && f.height <= innerHeight + 1, panelIn: pr.bottom <= innerHeight + 1 && pr.right <= innerWidth + 1, img: img.naturalWidth + 'x' + img.naturalHeight,
          panelScroll: pn.scrollHeight > pn.clientHeight + 1, btns, safe: btns.filter(b => /no roll · safe/.test(b.t)).length, odds: btns.filter(b => /(likely|fair odds|a long shot|unlikely)/.test(b.t)).length, text: m.querySelector('.sttext').textContent.slice(0, 80) }; }, e0);
      R[id] = L;
      ok(L.paused && L.vis && L.frameFit && L.panelIn && L.img === '1080x1920', `${tag} ${id} layout ${JSON.stringify({ ...L, btns: undefined })}`);
      ok(L.btns.length >= 2 && L.btns.length <= 3 && L.btns.every(b => b.h >= 44 && b.inV) && L.safe === 1 && L.odds === L.btns.length - 1, `${tag} ${id} buttons ${JSON.stringify(L.btns)}`);
      await p.screenshot({ path: OUT + `e1-story-${id}-${tag}.png` });
      // outcome card: the first rolled choice, forced to a success
      const O = await p.evaluate(() => { const rnd = Math.random; Math.random = () => 0.01; try { document.querySelector('#storyScene .stc:not(.safe)').click(); } finally { Math.random = rnd; }
        const m = document.getElementById('storyScene'), cont = m.querySelector('.stcont'), r = cont && cont.getBoundingClientRect(); return { band: __T.ST.current() && __T.ST.current().res && __T.ST.current().res.band, chips: [...m.querySelectorAll('.stchip')].map(x => x.textContent), cont: !!cont && r.bottom <= innerHeight + 1 && r.height >= 44 }; });
      R[id + ':out'] = O; ok(O.band === 'success' && O.chips.length > 0 && O.cont, `${tag} ${id} outcome ${JSON.stringify(O)}`);
      await sleep(120); await p.screenshot({ path: OUT + `e1-story-${id}-outcome-${tag}.png` });
      const closed = await p.evaluate(() => { document.querySelector('#storyScene .stcont').click(); return !__T.ST.storyOpen() && document.getElementById('storyScene').hidden; }); ok(closed, `${tag} ${id} continue closes`);
    }
    // ---- P32 #7: with ?debug=1 the debug panel never covers the scene's close button (collapsed and expanded) ----
    await p.goto(BASE + '?debug=1&story=letter_home'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done') && __T.ST.storyOpen(), null, { timeout: 60000 }); await sleep(300);
    R.debugX = await p.evaluate(() => { const hit = () => { const a = document.querySelector('#debug').getBoundingClientRect(), b = document.querySelector('#storyScene .storyx').getBoundingClientRect(); return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top); };
      const x = document.querySelector('#storyScene .storyx').getBoundingClientRect(), top = document.elementFromPoint(x.left + x.width / 2, x.top + x.height / 2), r = { collapsed: hit(), xOnTop: !!top && !!top.closest('.storyx') };
      document.querySelector('#debug .t').click(); r.expanded = hit(); document.querySelector('#debug .t').click(); return r; });
    ok(!R.debugX.collapsed && !R.debugX.expanded && R.debugX.xOnTop, `${tag} debug overlap ${JSON.stringify(R.debugX)}`);
    await p.screenshot({ path: OUT + `p32-debug-x-${tag}.png` });
    await p.evaluate(() => { __T.ST.closeStory(); window.__noSave = true; });
    if (tag !== '1280x800') { await c.close(); continue; }
    // ---- logic ----
    R.logic = await p.evaluate(async () => {
      const ST = __T.ST, CC = await import('/js/crewcare.js'), N = await import('/js/needs.js'), PG = await import('/js/progression.js'), PC = await import('/js/pacing.js'), SS = await import('/js/state.js'), MD = await import('/js/injuries.js');
      const G = __T.G, C = G.prog.crew, out = {}, rnd = Math.random, withR = (v, f) => { Math.random = typeof v === 'function' ? v : () => v; try { return f(); } finally { Math.random = rnd; } };
      __T.app.paused = true; PC.PACE_RT.idleT = 0; G.prog.playDays = 10; G.prog.jobs.active = null; G.sp.ev.active = null; G.prog.rations = 500; G.sp.rep = 100; G.ship.parts = 10;
      // 1. odds bounds with junk
      const junk = [NaN, 'x', '50', -5, -1e9, 1e9, null, undefined, {}, [], Infinity], tiers = ['friend', 'rival', 'partner', 'solo', 'x', null]; let lo = 1, hi = 0, bad = 0;
      for (const a of junk) for (const b of junk) for (const t of tiers) { const v = ST.oddsP(a, b, t); if (!Number.isFinite(v)) bad++; lo = Math.min(lo, v); hi = Math.max(hi, v); }
      out.odds = { lo, hi, bad, base: ST.oddsP(0, 0, null), top: ST.oddsP(10, 100, 'friend'), floor: ST.oddsP(0, -100, 'rival'), mid: +ST.oddsP(5, 40, 'partner').toFixed(3), bandsAt05: [ST.bandOf(0.5, 0.1), ST.bandOf(0.5, 0.4), ST.bandOf(0.5, 0.6), ST.bandOf(NaN, NaN)] };
      // P31 low 3: crew-care chance with junk inputs
      const did = C.slots['yeoman'], dr = N.needsOf(did), cap = C.slots.co, op0 = G.prog.opinions[cap]; dr.stress = 0; for (const k of N.NEED_KEYS) dr.n[k] = 90; G.prog.opinions[cap] = 0; const pBase = CC.chance([did]);
      dr.stress = -50; const pNeg = CC.chance([did]); dr.stress = NaN; dr.n[N.NEED_KEYS[0]] = 'abc'; G.prog.opinions[cap] = NaN; const pNaN = CC.chance([did]); dr.stress = 'lots'; G.prog.opinions[cap] = 'x'; const pStr = CC.chance([did]);
      dr.stress = 0; for (const k of N.NEED_KEYS) dr.n[k] = 90; G.prog.opinions[cap] = op0;
      out.careOdds = { pBase, pNeg, pNaN, pStr, words: [CC.oddsWord(pNaN), CC.oddsWord(pStr)] };
      // 2. all three bands through choose() (forced Math.random), and the save right after the roll
      const bands = {}, saves = [];
      for (const [k, f] of [['success', p => 0.5 * p], ['partial', p => 0.8 * p], ['fail', () => 0.999]]) {
        ST.closeStory(); ST.forceStory('letter_home'); const cur = ST.current(), ch = ST.choicesOf(cur).find(x => x.k === 'words'), n0 = SS.SAVE_RT.n;
        const r = withR(f(ch.p), () => ST.choose('words')); bands[k] = r.band; saves.push(SS.SAVE_RT.n - n0 === 1 && SS.SAVE_RT.why === 'story' && !G.prog.story.step); ST.closeStory();
      }
      out.bands = bands; out.saveAfterRoll = saves;
      { window.__noSave = false; ST.forceStory('letter_home'); const t0 = (JSON.parse(localStorage.getItem(SS.SAVE_KEY) || '{}').savedAt) || 0; await new Promise(r => setTimeout(r, 5)); withR(0.01, () => ST.choose('words')); const sv = JSON.parse(localStorage.getItem(SS.SAVE_KEY) || '{}'); out.realSave = sv.savedAt > t0 && sv.prog.story.n.fired === G.prog.story.n.fired && sv.version === 16; ST.closeStory(); window.__noSave = true; }
      // 3. no spend on the safe choice (picked, or closed with no choice); costs only on choices that show them
      const wal = () => [G.prog.rations, G.sp.rep, G.ship.parts, G.ship.torps, G.prog.latinum || 0, G.ship.power].join(','), safe = [];
      for (const id of Object.keys(ST.EV)) { ST.closeStory(); ST.forceStory(id); const w0 = wal(), sk = ST.choicesOf().find(x => x.safe).k; const r = ST.choose(sk); safe.push(r.band === 'safe' && wal() === w0 && r.chips.length === 0); ST.closeStory();
        ST.forceStory(id); const w1 = wal(); ST.closeStory(); safe.push(wal() === w1 && G.prog.story.step === null); }
      out.safeNoSpend = safe;
      const costs = []; for (const id of Object.keys(ST.EV)) for (const ch of ST.EV[id].choices) { if (ch.safe) continue;
        ST.closeStory(); ST.forceStory(id); const view = ST.choicesOf().find(x => x.k === ch.k), r0 = G.prog.rations, l0 = G.prog.latinum || 0, rep0 = G.sp.rep;
        withR(0.01, () => ST.choose(ch.k)); const spentR = r0 - G.prog.rations, spentL = l0 - (G.prog.latinum || 0);
        costs.push({ c: `${id}.${ch.k}`, shown: !!view.cost && view.sub.includes(view.cost), spent: spentR + spentL, ok: ch.cost ? (view.sub.includes(view.cost) && spentR === (ch.cost.rations || 0)) : (spentR === 0 && spentL === 0 && G.sp.rep >= rep0) }); ST.closeStory(); }
      out.costs = costs.filter(x => !x.ok).length ? costs : costs.length + ' ok';
      { G.prog.rations = 3; ST.forceStory('mess_hall_feud'); const v = ST.choicesOf().find(x => x.k === 'round'), r = ST.choose('round'); out.cantAfford = !v.ok && r.ok === false && G.prog.rations === 3 && !ST.current().res; ST.closeStory(); G.prog.rations = 500; }
      // 4. gates
      ST.closeStory(); G.sp.travel = { dest: 'convoy', t: 10, dur: 600 }; G.sp.location = 'convoy'; G.prog.story.legsSince = 99; G.prog.story.dayCount = { d: 0, n: 0 };
      const gate = (set, undo) => { set(); const why = ST.gateWhy('leg'), f0 = G.prog.story.n.fired, fired = withR(0, () => ST.legStory()); if (fired) ST.closeStory(); undo(); return { why, fired: !!fired || G.prog.story.n.fired !== f0 }; };
      const nop = () => {}; out.gates = {
        open: gate(nop, nop),
        offRules: gate(() => { PC.PACE_RT.idleT = 1e6; }, () => { PC.PACE_RT.idleT = 0; }),
        offline: gate(() => { PC.PACE_RT.offline = true; }, () => { PC.PACE_RT.offline = false; }),
        battle: gate(() => { G.sp.battle = { live: true }; }, () => { G.sp.battle = null; }),
        incident: gate(() => { G.prog.jobs.active = { kind: 'incident', who: C.slots.ops }; }, () => { G.prog.jobs.active = null; }),
        deckTask: gate(() => { G.sp.ev.active = { id: 'storm', task: null }; }, () => { G.sp.ev.active = null; }),
        day1: gate(() => { G.prog.playDays = 1; }, () => { G.prog.playDays = 10; }),
        hushed: gate(() => { MD.M().hushUntil = G.ship.elapsed + 999; }, () => { MD.M().hushUntil = 0; }),
        dayCap: gate(() => { G.prog.story.dayCount = { d: G.prog.day, n: 2 }; }, () => { G.prog.story.dayCount = { d: 0, n: 0 }; }),
        legGap: gate(() => { G.prog.story.legsSince = 1; }, () => { G.prog.story.legsSince = 99; }),
      };
      out.gates.open = gate(nop, nop);   // the baseline fires
      G.prog.story.legsSince = 99; G.prog.story.dayCount = { d: 0, n: 0 };
      out.rate35 = [withR(0.34, () => ST.gateWhy('leg') === null && PC.STORY.legChance > 0.34), withR(0.36, () => !!ST.legStory())]; ST.closeStory();
      G.prog.playDays = 3; out.poolDay3 = ST.poolFor('leg'); G.prog.playDays = 6; out.poolDay6 = ST.poolFor('leg'); out.poolDock = ST.poolFor('dock');
      // docked at DS9
      G.sp.travel = null; G.sp.location = 'ds9'; G.prog.story.legsSince = 99; G.prog.story.dayCount = { d: 0, n: 0 };
      const d1 = withR(0, () => ST.tickStoryDock(1)); ST.closeStory(); const d2 = withR(0, () => ST.tickStoryDock(1)); ST.closeStory(); G.prog.story.legsSince = 99; const d3 = withR(0.99, () => ST.tickStoryDock(0.05));
      out.dock = { fired: !!d1, again: !!d2, rare: !!d3, notFerengi: d1 !== 'ferengi_salvage' };
      // 5. gentle mode never injures (S2 fail); outside gentle a fail is a minor injury at worst; faults LOW / MEDIUM only
      const lead = C.slots['engineer-1'], inj0 = () => MD.M().inj.length, gen0 = MD.M().gentle, gentleRes = [];
      MD.M().gentle = true; for (const [ev, k] of [['coolant_cascade', 'seal'], ['coolant_cascade', 'crawl'], ['ferengi_salvage', 'argue'], ['ferengi_salvage', 'tractor'], ['letter_home', 'words'], ['mess_hall_feud', 'hear']]) { G.ship.faults = {}; G.ship.parts = 10; const pw0 = G.ship.power; ST.forceStory(ev, ev === 'coolant_cascade' ? { lead } : undefined); const n0 = inj0(); const r = withR(0.999, () => ST.choose(k));
        gentleRes.push(r.band === 'fail' && inj0() === n0 && !MD.isInjured(lead) && !Object.keys(G.ship.faults).length && G.ship.parts === 10 && G.ship.power === pw0 && r.chips.every(c => c[0] !== 'bad' || /shaken|sore|−\d+ FR/.test(c[1])) && !/burn|fault/i.test(r.text) ? true : ev + '.' + k + ' ' + r.text + ' ' + JSON.stringify(r.chips)); ST.closeStory(); }
      out.gentleNoInjury = gentleRes;
      MD.M().gentle = false; G.ship.faults = {}; ST.forceStory('coolant_cascade', { lead }); withR(0.999, () => ST.choose('seal')); const ij = MD.injuryOf(lead); out.nonGentle = { injured: ij ? ij.sev : 'none (injury caps / disabled)', faults: Object.values(G.ship.faults).map(f => f.sev) }; ST.closeStory();
      MD.M().gentle = gen0; MD.M().inj = MD.M().inj.filter(x => x.id !== lead); G.ship.faults = {};
      // 6. partner text only with romance on; pronouns
      const ro = { ...G.prog.romance }, pid = C.slots['ops'], cats = on => { G.prog.romance.opt = on; G.prog.romance.partner = pid; const seen = {}; for (let i = 0; i < 30; i++) { ST.forceStory('letter_home', { lead: pid }); const c = ST.current(); seen[c.vkey.replace(/\d+$/, '')] = (seen[c.vkey.replace(/\d+$/, '')] || 0) + 1; if (c.tier === 'partner' && !on) seen.TIER = 1; ST.closeStory(); } return seen; };
      out.partnerOff = cats(false); out.partnerOn = cats(true); G.prog.romance.opt = ro.opt; G.prog.romance.partner = ro.partner;
      const pron = {}; for (const who of ['hale', 'orvin']) { if (!C.occ[who]) { pron[who] = 'not aboard'; continue; } const other = who === 'hale' ? 'orvin' : 'hale', hits = [];
        for (const id of Object.keys(ST.EV)) for (const cast of [{ lead: who, other: C.occ[other] ? other : who }, { lead: C.occ[other] ? other : who, other: who }]) for (const t of ST.allTexts(id, cast)) if (/\b(she|her|hers|herself)\b/i.test(t)) hits.push(id + ': ' + t.slice(0, 60));
        pron[who] = hits.length ? hits : 'clean (' + C.occ[who].pronoun + ')'; }
      out.pronouns = pron;
      // E2: every variant category per event, for the blurb and the outcome line
      const vc = {}, ro2 = { ...G.prog.romance }, vlead = C.slots['ops'];
      for (const id of Object.keys(ST.EV)) { const r = vc[id] = {};
        for (const cat of ['partner', 'friend', 'rival', 'solo']) { G.prog.romance.opt = cat === 'partner'; G.prog.romance.partner = cat === 'partner' ? vlead : null; G.prog.opinions[vlead] = cat === 'friend' ? 75 : cat === 'rival' ? -40 : 20;
          let b = 0, o = 0, tier = null; for (let i = 0; i < 24; i++) { ST.forceStory(id, { lead: vlead, other: C.slots['crewman'] }); const c = ST.current(); tier = c.tier; if (c.vkey.startsWith(cat)) b++; const sk = ST.choicesOf().find(x => !x.safe).k; const res = withR(i % 3 === 0 ? 0.01 : i % 3 === 1 ? 0.999 : () => 0.5, () => ST.choose(i % 4 === 3 ? ST.choicesOf().find(x => x.safe).k : sk)); if (res.akey && res.akey.startsWith(cat)) o++; ST.closeStory(); }
          r[cat] = { tier, blurb: b, outcome: o }; }
        r.lines = ST.allTexts(id, { lead: vlead, other: C.slots['crewman'] }).length; }
      G.prog.romance.opt = ro2.opt; G.prog.romance.partner = ro2.partner; out.variants = vc;
      // P32 #2 / #3: an injury the cap blocks -> the text says unhurt; a fault that lands elsewhere -> the text names that system
      { MD.M().gentle = false; const K = PG.PROG.deaths, en0 = K.enabled; K.enabled = false; G.ship.faults = { coolant: { t: 0, sev: 'low', cost: 1, escT: 0 } };
        ST.forceStory('coolant_cascade', { lead }); const r = withR(0.999, () => ST.choose('seal')); const sys = Object.keys(G.ship.faults).find(k => k !== 'coolant'); const DT = await import('/js/data.js'), OS = DT.OKAFOR_SHORT;
        out.capText = { unhurt: /unhurt/.test(r.text) && !/burn/.test(r.text) && !r.chips.some(c => /injury/.test(c[1])) && r.chips.some(c => /shaken/.test(c[1])), faultNamed: !!sys && r.text.includes('the ' + OS[sys]) && r.chips.some(c => c[1].includes(DT.SYSTEMS[sys].name)), sys, text: r.text };
        ST.closeStory(); K.enabled = en0; MD.M().gentle = gen0; G.ship.faults = {};
        G.ship.faults = {}; for (const k of Object.keys((await import('/js/data.js')).SYSTEMS)) G.ship.faults[k] = { t: 0, sev: 'low', cost: 1, escT: 0 }; ST.forceStory('ferengi_salvage'); const r2 = withR(0.999, () => ST.choose('tractor')); out.noFaultNoText = !/fault/i.test(r2.text) && !r2.chips.some(c => /fault/.test(c[1])); ST.closeStory(); G.ship.faults = {};
        G.ship.parts = 0; ST.forceStory('ferengi_salvage'); MD.M().gentle = false; const r3 = withR(0.999, () => ST.choose('argue')); out.noPartsNoText = !/hand over/.test(r3.text); ST.closeStory(); MD.M().gentle = gen0; G.ship.parts = 10; }
      // P32 #6: odds words on full success
      out.oddsWords = [0.1, 0.25, 0.4, 0.55, 0.6, 0.75, 0.84, 0.9].map(p => { const o = ST.storyOdds(p); return p + ':' + o.word + (o.hint ? '+' + o.hint : ''); });
      // 7. hardener drops junk
      G.prog.story = { last: 'bogus', seen: { bogus: 3, letter_home: 'x', mess_hall_feud: 2.7 }, legsSince: -4, dayCount: { d: 1e9, n: -1 }, chain: { id: 'nope' }, step: { id: 'coolant_cascade', node: 0 }, n: { fired: 'x', success: -3, partial: 2 } };
      PG.clampProg(); const hs = G.prog.story; out.harden = { last: hs.last, seen: JSON.stringify(hs.seen), legsSince: hs.legsSince, dayD: hs.dayCount.d <= G.prog.day, dayN: hs.dayCount.n, chain: hs.chain, step: hs.step, n: JSON.stringify(hs.n) };
      G.prog.story = 'junk'; PG.clampProg(); out.hardenStr = JSON.stringify(G.prog.story) === JSON.stringify(ST.freshStory());
      // 8. P31 lows: captain rest wording, a single T'Ren name on the shore line, saves after a denial and the shore roll
      G.prog.rank = 1; out.capRest = CC.toolState(C.slots.co).rest.why;
      CC.C().deny = {}; CC.C().rest = {}; N.needsOf(did).unwell = 0; let n0 = SS.SAVE_RT.n; const dn = withR(0.999, () => CC.orderRest(did)); out.denySave = dn.denied === true && SS.SAVE_RT.n === n0 + 1;
      G.sp.location = 'ds9'; G.sp.travel = null; G.sp.rep = 100; CC.C().shoreUsed = false; n0 = SS.SAVE_RT.n; const sh = withR(0, () => CC.shoreLeave()); out.shoreSave = SS.SAVE_RT.n === n0 + 1;
      const capN = C.occ[C.slots.co].short; out.shoreLine = sh.line; out.shoreNameOnce = (sh.line.split(capN).length - 1) === 1;
      CC.C().shoreUsed = false; n0 = SS.SAVE_RT.n; const sd = withR(0.999, () => CC.shoreLeave()); out.shoreDenySave = sd.denied === true && SS.SAVE_RT.n === n0 + 1;
      // 9. a v15 save loads with a fresh story block and v16
      { const raw = JSON.parse(JSON.stringify(G)); raw.version = 15; delete raw.prog.story; localStorage.setItem(SS.SAVE_KEY, JSON.stringify(raw)); const okL = SS.loadGame(); out.v15 = okL && __T.G.version === 16 && JSON.stringify(__T.G.prog.story) === JSON.stringify(ST.freshStory()); localStorage.removeItem(SS.SAVE_KEY); }
      __T.app.paused = false; return out; });
    const L = R.logic;
    ok(L.odds.lo >= 0.1 && L.odds.hi <= 0.9 && L.odds.bad === 0 && L.odds.base === 0.35 && L.odds.top === 0.9 && Math.abs(L.odds.floor - 0.15) < 1e-9 && L.odds.bandsAt05.join() === 'success,partial,fail,fail', 'odds ' + JSON.stringify(L.odds));
    ok([L.careOdds.pNaN, L.careOdds.pStr].every(v => Number.isFinite(v) && v >= 0.05 && v <= 0.95) && L.careOdds.pNeg === L.careOdds.pBase, 'care odds ' + JSON.stringify(L.careOdds));
    ok(L.bands.success === 'success' && L.bands.partial === 'partial' && L.bands.fail === 'fail' && L.saveAfterRoll.every(Boolean) && L.realSave, 'bands/save ' + JSON.stringify([L.bands, L.saveAfterRoll, L.realSave]));
    ok(L.safeNoSpend.every(Boolean) && L.costs.endsWith && L.costs.endsWith(' ok') && L.cantAfford, 'spend ' + JSON.stringify([L.safeNoSpend, L.costs, L.cantAfford]));
    for (const [k, g] of Object.entries(L.gates)) ok(k === 'open' ? g.why === null && g.fired : g.why !== null && !g.fired, `gate ${k} ${JSON.stringify(g)}`);
    ok(L.rate35[0] && !L.rate35[1] && !L.poolDay3.includes('coolant_cascade') && L.poolDay6.includes('coolant_cascade') && !L.poolDock.includes('ferengi_salvage'), 'pools ' + JSON.stringify([L.rate35, L.poolDay3, L.poolDay6, L.poolDock]));
    ok(L.dock.fired && !L.dock.again && !L.dock.rare && L.dock.notFerengi, 'dock ' + JSON.stringify(L.dock));
    ok(L.gentleNoInjury.every(x => x === true) && L.nonGentle.injured !== 'serious' && L.nonGentle.faults.every(s => s === 'low' || s === 'med'), 'gentle ' + JSON.stringify([L.gentleNoInjury, L.nonGentle]));
    ok(!L.partnerOff.partner && !L.partnerOff.TIER && L.partnerOn.partner > 0, 'partner ' + JSON.stringify([L.partnerOff, L.partnerOn]));
    ok(Object.values(L.pronouns).every(v => typeof v === 'string'), 'pronouns ' + JSON.stringify(L.pronouns));
    for (const [id, r] of Object.entries(L.variants)) for (const cat of ['partner', 'friend', 'rival', 'solo']) ok(r[cat].blurb > 0 && r[cat].outcome > 0 && (cat === 'solo' || r[cat].tier === cat), `variant ${id}.${cat} ${JSON.stringify(r[cat])}`);
    ok(L.capText.unhurt && L.capText.faultNamed && L.noFaultNoText && L.noPartsNoText, 'P32 #2/#3 ' + JSON.stringify([L.capText, L.noFaultNoText, L.noPartsNoText]));
    ok(L.oddsWords.join() === '0.1:unlikely,0.25:a long shot,0.4:a long shot,0.55:fair odds,0.6:fair odds+partial or better likely,0.75:fair odds+partial or better likely,0.84:likely,0.9:likely', 'odds words ' + L.oddsWords.join());
    const H = L.harden; ok(H.last === null && H.seen === '{"mess_hall_feud":2}' && H.legsSince === 0 && H.dayD && H.dayN === 0 && H.chain === null && H.step === null && H.n === '{"fired":0,"success":0,"partial":2,"fail":0}' && L.hardenStr, 'harden ' + JSON.stringify(H));
    ok(L.capRest === "you can't request rest for the captain" && L.shoreNameOnce && L.denySave && L.shoreSave && L.shoreDenySave && L.v15, 'p31 ' + JSON.stringify({ capRest: L.capRest, line: L.shoreLine, denySave: L.denySave, shoreSave: L.shoreSave, shoreDenySave: L.shoreDenySave, v15: L.v15 }));
    await c.close();
  }
  // ---- P32 #1: one playing tab (two pages, one context), with BroadcastChannel and with the localStorage heartbeat only ----
  for (const mode of ['bc', 'heartbeat']) {
    const c = await br.newContext({ viewport: { width: 1280, height: 800 } }), tag = 'tab-' + mode;
    if (mode === 'heartbeat') await c.addInitScript(() => { delete window.BroadcastChannel; });
    const load = async (pg, url) => { pg.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); }); pg.on('pageerror', e => errs.push(`${tag}: ${e.message}`)); await pg.goto(url); await pg.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); };
    const A = await c.newPage(); await load(A, BASE + '?reset=1'); await sleep(600);
    const B = await c.newPage(); await load(B, BASE); await sleep(1500);
    const st = pg => pg.evaluate(() => ({ ro: __T.TAB_RT.ro, overlay: !!document.querySelector('#tabLock:not([hidden])'), t: __T.G.ship.elapsed, saved: __T.saveGame() }));
    const a1 = await st(A), b1 = await st(B); await sleep(1200); const a2 = await st(A), b2 = await st(B);
    const savedAt0 = await A.evaluate(() => JSON.parse(localStorage.getItem('tenacity.save.v1')).savedAt); await B.evaluate(() => { __T.G.prog.story = { bogus: 1 }; __T.saveGame(); }); const savedAt1 = await A.evaluate(() => JSON.parse(localStorage.getItem('tenacity.save.v1')).savedAt);
    await B.screenshot({ path: OUT + `p32-tablock-${mode}-1280x800.png` });
    await A.evaluate(() => { __T.ST.S().n.fired = 777; });
    await B.evaluate(() => document.querySelector('#tabLock [data-tab-take]').click());
    await sleep(800); await B.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done') && !__T.TAB_RT.ro, null, { timeout: 60000 }); await sleep(1500);
    const a3 = await st(A), b3 = await B.evaluate(() => ({ ro: __T.TAB_RT.ro, overlay: !!document.querySelector('#tabLock:not([hidden])'), fired: __T.ST.S().n.fired, t: __T.G.ship.elapsed })); await sleep(1000); const b4 = await B.evaluate(() => __T.G.ship.elapsed), a4 = await A.evaluate(() => __T.G.ship.elapsed);
    const T = res[tag] = { a1, b1, a2, b2, bSaveBlocked: savedAt0 === savedAt1, a3, b3, bRuns: b4 > b3.t, aFrozen: a4 === a3.t };
    ok(!a1.ro && b1.ro && b1.overlay && !b1.saved && a2.t > a1.t && b2.t === b1.t && T.bSaveBlocked, `${tag} lock ${JSON.stringify(T)}`);
    ok(a3.ro && a3.overlay && !a3.saved && !b3.ro && !b3.overlay && b3.fired === 777 && T.bRuns && T.aFrozen, `${tag} takeover ${JSON.stringify(T)}`);
    { /* P32b #1: Duplicate Tab / window.open copy sessionStorage: the copy must still be read-only. #2 overlay above .modal. #4 deck drawn behind it */
      const ss = await B.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(sessionStorage).map(k => [k, sessionStorage.getItem(k)]))));
      const D = await c.newPage(); await D.addInitScript(s => { const o = JSON.parse(s); for (const k in o) sessionStorage.setItem(k, o[k]); }, ss); await load(D, BASE); await sleep(1500);
      const d = await D.evaluate(() => { const m = document.querySelector('#tabLock'), zs = [...document.querySelectorAll('.modal')].filter(x => x !== m).map(x => +getComputedStyle(x).zIndex || 0);
        const cv = [...document.querySelectorAll('canvas')].find(x => x.offsetParent) || document.querySelector('canvas'), cx = cv.getContext('2d'), px = cx.getImageData(0, 0, cv.width, cv.height).data; let lit = 0; for (let i = 0; i < px.length; i += 400) if (px[i] + px[i + 1] + px[i + 2] > 30) lit++;
        return { ro: __T.TAB_RT.ro, z: +getComputedStyle(m).zIndex, zMax: Math.max(0, ...zs), lit }; });
      const bStill = await B.evaluate(() => !__T.TAB_RT.ro); T.dup = d; T.bStill = bStill;
      ok(d.ro && bStill && d.z > d.zMax && d.z >= 90 && d.lit > 50, `${tag} duplicate ${JSON.stringify(d)} ownerKeeps ${bStill}`);
      if (mode === 'bc') await D.screenshot({ path: OUT + `p32b-tablock-dup-1280x800.png` }); }
    await c.close();
  }
  console.log(JSON.stringify(res, null, 1));
  console.log('FAILS', fails.length, fails); console.log('ERRORS', errs.length, errs.slice(0, 5)); await br.close();
  process.exit(fails.length || errs.length ? 1 : 0);
})();
