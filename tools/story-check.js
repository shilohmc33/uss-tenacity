// E0 + E1 check: the 4 story events (scene + outcome shots at 3 sizes, layout, sim paused), the shore-leave chip at 844x390,
// and a logic block: odds bounds with junk, 3 bands reachable, no spend on the safe choice, costs only when shown, gates,
// gentle mode never injures, partner only with romance on, no she/her for Hale / Orvin, save after the roll, hardener, P31 lows.
// Usage: node tools/story-check.js   (exit code 1 on any failed assert or console error)
const { chromium } = require('playwright-core'); const BASE = process.env.BASE || 'http://127.0.0.1:8765/', OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'), ART = path.join(__dirname, '../assets/story/');
const manifest = () => execSync('python3 ' + path.join(__dirname, 'story-art-manifest.py'));
const IDS = ['coolant_cascade', 'mess_hall_feud', 'letter_home', 'ferengi_salvage', 'kestrel_thanks', 'probe_maker', 'vorta_offer', 'bajoran_relic', 'cardassian_codes', 'jemhadar_wreck', 'holo_ghost', 'shore_trouble', 'vorta_returns', 'debt_repaid'];   // single-step (E3 follow-ups too)
const MULTI = ['kestrel_derelict', 'subspace_echo'];
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [], fails = [], res = {}, ok = (c, m) => { if (!c) fails.push(m); };
  // ---- story choice art: manifest matches the folder; a temporary c1 crossfades in; a missing c2 keeps the main scene; _v2 preferred ----
  { const dir = fs.readdirSync(ART).filter(f => f.endsWith('.webp')).map(f => f.slice(0, -5)).sort(), man = JSON.parse(fs.readFileSync(ART + 'manifest.json', 'utf8'));
    ok(JSON.stringify(dir) === JSON.stringify(man), 'manifest matches assets/story ' + JSON.stringify({ dir: dir.length, man: man.length }));
    const snap0 = fs.readdirSync(ART).sort().map(f => f + ':' + fs.statSync(ART + f).size + ':' + fs.statSync(ART + f).mtimeMs).join('|');
    // P33: the real art is in now, so the fallback is tested by serving a manifest without story_coolant_c2 (the files are never touched)
    const c = await br.newContext({ viewport: { width: 390, height: 844 } }), p = await c.newPage(), reqs = [], tag = 'art';
    await p.route('**/assets/story/manifest.json', rt => rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(man.filter(k => k !== 'story_coolant_c2').concat(['story_ferengi_v2'])) }));
    // P33 fix 5: a stale manifest lists story_ferengi_v2 (not on disk) and story_letter_c1 is served broken (200, junk bytes: no 404 in the console)
    await p.route(/story_(ferengi_v2|letter_c1)\.webp/, rt => rt.fulfill({ status: 200, contentType: 'image/webp', body: 'not a webp' }));
    try {
      p.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); }); p.on('pageerror', e => errs.push(`${tag}: ${e.message}`)); p.on('request', r => reqs.push(r.url())); p.on('requestfailed', r => errs.push(`${tag}: failed ${r.url()}`));
      await p.goto(BASE + '?reset=1'); await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 }); await sleep(400);
      await p.evaluate(() => { window.__noSave = true; });
      const pick = async (id, k) => { await p.evaluate(([id, k]) => { __T.ST.closeStory(); __T.ST.forceStory(id); }, [id, k]); await sleep(300); const before = await p.evaluate(() => document.querySelector('#storyScene .storyframe').dataset.art);
        if (k) await p.evaluate(k => { const rnd = Math.random; Math.random = () => 0.01; try { document.querySelector(`#storyScene [data-story-pick="${k}"]`).click(); } finally { Math.random = rnd; } }, k);
        await sleep(200); const mid = await p.evaluate(() => { const on = document.querySelector('#storyScene img.sl.on'); return +getComputedStyle(on).opacity; }); await sleep(600);
        return { before, mid, ...(await p.evaluate(() => { const f = document.querySelector('#storyScene .storyframe'), on = f.querySelector('img.sl.on'); return { art: f.dataset.art, src: on.getAttribute('src'), w: on.naturalWidth, op: +getComputedStyle(on).opacity, ons: f.querySelectorAll('img.sl.on').length }; })) }; };
      const A = res.art = {};
      A.c1 = await pick('coolant_cascade', 'seal'); await p.screenshot({ path: OUT + 'sca-coolant-c1-390x844.png' });
      A.c2 = await pick('coolant_cascade', 'crawl');
      A.v2 = await pick('letter_home', null); A.v2m = await pick('mess_hall_feud', null); A.noV2 = await pick('ferengi_salvage', null);
      const errOf = () => p.evaluate(() => document.querySelector('#storyScene .storyframe').dataset.err || null);
      A.noV2err = await errOf(); A.badC = await pick('letter_home', 'words'); A.badCerr = await errOf();
      ok(A.noV2.art === 'story_ferengi' && A.noV2.w === 1080 && A.noV2err === 'story_ferengi_v2' && A.badC.art === 'story_letter_v2' && A.badC.w === 1080 && A.badC.op === 1 && A.badCerr === 'story_letter_c1', 'P33 fix 5: a broken _v2 / choice image falls back to the main scene ' + JSON.stringify([A.noV2, A.noV2err, A.badC, A.badCerr]));
      A.c2req = reqs.filter(u => /story_coolant_c2\.webp/.test(u)).length; A.preloaded = reqs.filter(u => /story_coolant_c1\.webp/.test(u)).length;
      ok(A.c1.before === 'story_coolant' && A.c1.art === 'story_coolant_c1' && A.c1.src.endsWith('story_coolant_c1.webp') && A.c1.w === 1080 && A.c1.op === 1 && A.c1.ons === 1, 'choice art c1 ' + JSON.stringify(A.c1));
      ok(A.c2.art === 'story_coolant' && A.c2.w === 1080 && A.c2req === 0, 'missing c2 keeps the main scene ' + JSON.stringify([A.c2, A.c2req]));
      ok(A.v2.art === 'story_letter_v2' && A.v2.w === 1080 && A.v2m.art === 'story_messhall_v2' && A.noV2.art === 'story_ferengi', 'v2 preferred ' + JSON.stringify([A.v2, A.v2m, A.noV2]));
      // a real v2 scene, and a real choice picture mid-crossfade and settled
      await pick('mess_hall_feud', null); await p.screenshot({ path: OUT + 'p33-v2-messhall-390x844.png' });
      await p.evaluate(() => { __T.ST.closeStory(); __T.ST.forceStory('ferengi_salvage'); }); await sleep(400);
      await p.evaluate(() => { const rnd = Math.random; Math.random = () => 0.01; try { document.querySelector('#storyScene [data-story-pick="tractor"]').click(); } finally { Math.random = rnd; } });
      await p.waitForFunction(() => document.querySelector('#storyScene .storyframe').dataset.art === 'story_ferengi_c2', null, { timeout: 5000 }).catch(() => fails.push('ferengi c2 crossfade'));
      await sleep(150); A.mid = await p.evaluate(() => [...document.querySelectorAll('#storyScene img.sl')].map(i => +getComputedStyle(i).opacity)); await p.screenshot({ path: OUT + 'p33-crossfade-mid-390x844.png' });
      await sleep(600); await p.screenshot({ path: OUT + 'p33-crossfade-ferengi_c2-390x844.png' });
      ok(A.mid.some(o => o > 0.02 && o < 0.98), 'crossfade caught mid-fade ' + JSON.stringify(A.mid));
    } finally { await c.close(); }
    const snap1 = fs.readdirSync(ART).sort().map(f => f + ':' + fs.statSync(ART + f).size + ':' + fs.statSync(ART + f).mtimeMs).join('|'); ok(snap1 === snap0, 'assets/story untouched by the test');
  }
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
        const btns = [...m.querySelectorAll('.stc')].map(b => { const r = b.getBoundingClientRect(); return { h: Math.round(r.height), inV: r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1, t: b.innerText.replace(/\s+/g, ' '), lk: b.classList.contains('locked') }; });
        return { paused: __T.G.ship.elapsed === e0, vis: !m.hidden, frameFit: f.width <= innerWidth + 1 && f.height <= innerHeight + 1, panelIn: pr.bottom <= innerHeight + 1 && pr.right <= innerWidth + 1, img: img.naturalWidth + 'x' + img.naturalHeight,
          panelScroll: pn.scrollHeight > pn.clientHeight + 1, btns, safe: btns.filter(b => /no roll · safe/.test(b.t)).length, odds: btns.filter(b => /(likely|fair odds|a long shot|unlikely)/.test(b.t)).length, text: m.querySelector('.sttext').textContent.slice(0, 80) }; }, e0);
      R[id] = L;
      ok(L.paused && L.vis && L.frameFit && L.panelIn && L.img === '1080x1920', `${tag} ${id} layout ${JSON.stringify({ ...L, btns: undefined })}`);
      ok(L.btns.length >= 3 && L.btns.length <= 4 && L.btns.every(b => b.h >= 44 && b.inV) && L.safe === 1 && L.odds === L.btns.filter(b => !b.lk).length - 1 && L.btns.filter(b => !b.lk && !/no roll/.test(b.t)).every(b => /(Engineering|Tactical|Fitness|Composure) \d+ · /.test(b.t)), `${tag} ${id} buttons ${JSON.stringify(L.btns)}`);
      await p.screenshot({ path: OUT + `e1-story-${id}-${tag}.png` });
      // outcome card: the first rolled choice, forced to a success
      const O = await p.evaluate(() => { const rnd = Math.random; Math.random = () => 0.01; try { document.querySelector('#storyScene .stc:not(.safe)').click(); } finally { Math.random = rnd; }
        const m = document.getElementById('storyScene'), cont = m.querySelector('.stcont'), r = cont && cont.getBoundingClientRect(); return { band: __T.ST.current() && __T.ST.current().res && __T.ST.current().res.band, chips: [...m.querySelectorAll('.stchip')].map(x => x.textContent), cont: !!cont && r.bottom <= innerHeight + 1 && r.height >= 44 }; });
      R[id + ':out'] = O; ok(O.band === 'success' && O.chips.length > 0 && O.cont, `${tag} ${id} outcome ${JSON.stringify(O)}`);
      await sleep(120); await p.screenshot({ path: OUT + `e1-story-${id}-outcome-${tag}.png` });
      const closed = await p.evaluate(() => { document.querySelector('#storyScene .stcont').click(); return !__T.ST.storyOpen() && document.getElementById('storyScene').hidden; }); ok(closed, `${tag} ${id} continue closes`);
    }
    // ---- E3: every step of the multi-step events (scene + outcome, Continue moves on, the last Continue closes) ----
    for (const id of MULTI) {
      await p.evaluate(id => { __T.ST.closeStory(); __T.G.prog.story.chain = null; __T.ST.forceStory(id); }, id);
      for (let st = 1; st <= 3; st++) {
        const on = await p.evaluate(() => __T.ST.current() && __T.ST.current().node); if (on == null || on !== st - 1) break;
        await p.waitForFunction(() => { const i = document.querySelector('#storyScene img.sl.on'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 }).catch(() => fails.push(`${tag} ${id} s${st} img`));
        await sleep(300);
        const L = await p.evaluate(() => { const m = document.getElementById('storyScene'), f = m.querySelector('.storyframe').getBoundingClientRect(), pr = m.querySelector('.storypanel').getBoundingClientRect(), img = m.querySelector('img.sl.on');
          const btns = [...m.querySelectorAll('.stc')].map(b => { const r = b.getBoundingClientRect(); return { h: Math.round(r.height), inV: r.top >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 }; });
          return { vis: !m.hidden, frameFit: f.width <= innerWidth + 1 && f.height <= innerHeight + 1, panelIn: pr.bottom <= innerHeight + 1 && pr.right <= innerWidth + 1, img: img.naturalWidth + 'x' + img.naturalHeight, art: m.querySelector('.storyframe').dataset.art, title: m.querySelector('.sttitle').textContent, btns }; });
        R[`${id}:s${st}`] = { ...L, btns: L.btns.length };
        ok(L.vis && L.frameFit && L.panelIn && L.img === '1080x1920' && L.btns.length >= 3 && L.btns.length <= 4 && L.btns.every(b => b.h >= 44 && b.inV) && new RegExp(` ${st}/\\d$`).test(L.title), `${tag} ${id} step ${st} ${JSON.stringify(L)}`);
        await p.screenshot({ path: OUT + `e3-${id}-s${st}-${tag}.png` });
        const O = await p.evaluate(() => { const rnd = Math.random; Math.random = () => 0.01; try { document.querySelector('#storyScene .stc:not(.safe)').click(); } finally { Math.random = rnd; }
          const m = document.getElementById('storyScene'), cont = m.querySelector('.stcont'), r = cont.getBoundingClientRect(), c = __T.ST.current(); return { band: c.res.band, next: c.res.next, label: cont.textContent, cont: r.bottom <= innerHeight + 1 && r.height >= 44 }; });
        ok(O.band === 'success' && O.cont && (O.next != null) === /▸/.test(O.label), `${tag} ${id} step ${st} outcome ${JSON.stringify(O)}`);
        await sleep(650); const ca = await p.evaluate(() => [document.querySelector('#storyScene .storyframe').dataset.art, __T.ST.artOf().cbase + '_c1']); ok(ca[0] === ca[1], `${tag} ${id} step ${st} choice art ${ca}`); await p.screenshot({ path: OUT + `e3-${id}-s${st}-outcome-${tag}.png` });
        await p.evaluate(() => document.querySelector('#storyScene .stcont').click()); await sleep(100);
      }
      const done = await p.evaluate(() => !__T.ST.storyOpen() && document.getElementById('storyScene').hidden); ok(done, `${tag} ${id} last continue closes`);
    }
    await p.evaluate(() => { __T.G.prog.story.chain = null; });
    // ---- P34 shots: a locked and an unlocked bonus choice (coolant, 4 buttons), the Lt's fail line at low and high Engineering ----
    { const setLt = o => p.evaluate(o => { const S = __T.G.prog.skills || (__T.G.prog.skills = {}); S.lt = S.lt || { tactical: 0, engineering: 0, fitness: 0, composure: 0 }; for (const [k, v] of Object.entries(o)) S.lt[k] = 50 * v * (v + 1); }, o);
      const open = async () => { await p.evaluate(() => { const ST = __T.ST; ST.closeStory(); __T.G.prog.story.chain = null; ST.forceStory('coolant_cascade'); }); await sleep(350); };
      const btn = k => p.evaluate(k => { const b = document.querySelector(`#storyScene [data-story-pick="${k}"]`), r = b.getBoundingClientRect(), pn = document.querySelector('#storyScene .storypanel'); return { locked: b.classList.contains('locked'), dis: b.disabled, h: Math.round(r.height), inV: r.top >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1, t: b.innerText.replace(/\s+/g, ' '), fs: getComputedStyle(document.querySelector('#storyScene .sttext')).fontSize, hscroll: pn.scrollWidth > pn.clientWidth + 1 }; }, k);
      await setLt({ engineering: 2 }); await open(); const L = await btn('manifold'); await p.screenshot({ path: OUT + `p34-bonus-locked-${tag}.png` });
      await p.evaluate(() => document.querySelector('#storyScene [data-story-pick="manifold"]').click()); const still = await p.evaluate(() => __T.ST.storyOpen() && !__T.ST.current().res);
      await setLt({ engineering: 6 }); await open(); const U = await btn('manifold'); await p.screenshot({ path: OUT + `p34-bonus-unlocked-${tag}.png` });
      const fl = async lv => { await setLt({ engineering: lv }); await open(); const t = await p.evaluate(() => { const rnd = Math.random; Math.random = () => 0.999; try { document.querySelector('#storyScene [data-story-pick="seal"]').click(); } finally { Math.random = rnd; } return document.querySelector('#storyScene .sttext').textContent; }); await sleep(700); await p.screenshot({ path: OUT + `p34-fail-${lv < 4 ? 'low' : 'high'}-${tag}.png` }); return t; };
      const lo = await fl(1), hi = await fl(9);
      R.p34shots = { L, U, still, lo: lo.slice(0, 120), hi: hi.slice(0, 120) };
      ok(L.locked && L.dis && L.h >= 44 && L.inV && /needs Engineering 6/.test(L.t) && !L.hscroll && still, `${tag} P34 locked bonus ${JSON.stringify([L, still])}`);
      ok(!U.locked && !U.dis && U.h >= 44 && U.inV && /Engineering 6 · /.test(U.t) && !U.hscroll && (tag !== '844x390' || U.fs === '13px'), `${tag} P34 unlocked bonus ${JSON.stringify(U)}`);
      ok(/little practice/.test(lo) && /gives out anyway/.test(hi), `${tag} P34 fail lines ${JSON.stringify([lo, hi])}`);
      await p.evaluate(() => { __T.ST.closeStory(); const S = __T.G.prog.skills; S.lt = { tactical: 0, engineering: 0, fitness: 0, composure: 0 }; __T.G.ship.faults = {}; }); }
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
      const costs = []; for (const id of Object.keys(ST.EV)) for (const ch of (ST.EV[id].nodes ? ST.EV[id].nodes[0] : ST.EV[id]).choices) { if (ch.safe) continue;
        ST.closeStory(); ST.forceStory(id); const view = ST.choicesOf().find(x => x.k === ch.k), r0 = G.prog.rations, l0 = G.prog.latinum || 0, rep0 = G.sp.rep;
        withR(0.01, () => ST.choose(ch.k)); const spentR = r0 - G.prog.rations, spentL = l0 - (G.prog.latinum || 0);
        costs.push({ c: `${id}.${ch.k}`, shown: !!view.cost && view.sub.includes(view.cost), spent: spentR + spentL, ok: ch.cost ? (view.sub.includes(view.cost) && spentR === (ch.cost.rations || 0)) : (spentR === 0 && spentL === 0 && G.sp.rep >= rep0) }); ST.closeStory(); }
      out.costs = costs.filter(x => !x.ok).length ? costs : costs.length + ' ok';
      { G.prog.rations = 3; ST.forceStory('mess_hall_feud'); const v = ST.choicesOf().find(x => x.k === 'round'), r = ST.choose('round'); out.cantAfford = !v.ok && r.ok === false && G.prog.rations === 3 && !ST.current().res; ST.closeStory(); G.prog.rations = 500; }
      // 4. gates
      ST.closeStory(); G.prog.story.chain = null; G.sp.travel = { dest: 'convoy', t: 10, dur: 600 }; G.sp.location = 'convoy'; G.prog.story.legsSince = 99; G.prog.story.dayCount = { d: 0, n: 0 };
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
    // ---- E3 logic: step graphs, chains (timing, expiry, frozen while away, one pending), hardening, the battle hand-off guard ----
    R.e3 = await p.evaluate(async () => {
      const ST = __T.ST, PC = await import('/js/pacing.js'), SS = await import('/js/state.js'), PG = await import('/js/progression.js'), FT = await import('/js/faults.js'), BT = await import('/js/battle.js'), MD = await import('/js/injuries.js');
      const G = __T.G, C = G.prog.crew, out = {}, rnd = Math.random, withR = (v, f) => { Math.random = typeof v === 'function' ? v : () => v; try { return f(); } finally { Math.random = rnd; } }, S = () => G.prog.story;
      __T.app.paused = true; window.__noSave = true; PC.PACE_RT.idleT = 0; PC.PACE_RT.offline = false; G.prog.playDays = 10; G.prog.jobs.active = null; G.sp.ev.active = null; G.sp.battle = null; MD.M().hushUntil = 0; MD.M().gentle = false;
      const travel = () => { G.sp.travel = { dest: 'convoy', t: 10, dur: 600 }; G.sp.location = 'convoy'; }, reset = () => { ST.closeStory(); S().fight = null; S().chain = null; S().legsSince = 99; S().dayCount = { d: 0, n: 0 }; };
      travel(); reset();
      const labels = id => (ST.EV[id].nodes || [ST.EV[id]]).map(n => n.choices.map(c => c.label));
      out.bind = []; for (const id of Object.keys(ST.EV)) { const Ev = ST.EV[id]; (Ev.nodes || [Ev]).forEach((N, ni) => N.choices.forEach((ch, i) => { if (ch.safe) return; const base = Ev.nodes ? `${Ev.ckey || Ev.art}_s${ni + 1}` : Ev.ckey || Ev.art;
        out.bind.push({ id, file: `${base}_c${i + 1}.webp`, label: ch.label, bonus: !!ch.bonus, skill: ({ engineering: 'Engineering', tactical: 'Tactical', fitness: 'Fitness', composure: 'Composure' })[ch.help ? 'composure' : ch.skill], at: ch.bonus ? ST.bonusAt(id, ni) : null }); })); }
      out.labels = { kestrel: labels('kestrel_derelict'), echo: labels('subspace_echo'), thanks: labels('kestrel_thanks'), maker: labels('probe_maker') };
      out.art = { kestrel: ST.EV.kestrel_derelict.nodes.map(n => n.art), echo: ST.EV.subspace_echo.nodes.map(n => n.art), thanks: ST.EV.kestrel_thanks.art, maker: ST.EV.probe_maker.art,
        cbase: (() => { ST.forceStory('kestrel_derelict'); const a = [ST.artOf().cbase]; withR(0.01, () => ST.choose('board')); ST.next(); a.push(ST.artOf().cbase, ST.artOf().main); ST.closeStory(); return a; })() };
      // S1: any rolled band moves on; safe ends; the step is saved with the roll; escort success / partial sets kestrel_thanks
      const lead = C.slots['security'] || C.slots['tactical'], walk = (id, picks) => { reset(); ST.forceStory(id, { lead }); const tr = []; for (const [k, r] of picks) { const c = ST.current(); if (!c) { tr.push('closed'); break; } const n0 = SS.SAVE_RT.n; const rr = r === 'part' ? 0.8 * ST.choicesOf().find(z => z.k === k).p : r, x = withR(rr, () => ST.choose(k)); tr.push({ node: c.node, k, band: x.band, next: x.next, saved: SS.SAVE_RT.n - n0, step: S().step && S().step.node, chain: S().chain && S().chain.id }); if (x.next != null) ST.next(); else ST.closeStory(); } ST.closeStory(); return tr; };
      out.s1 = { allSucc: walk('kestrel_derelict', [['board', 0.01], ['cut', 0.01], ['escort', 0.01]]), fails: walk('kestrel_derelict', [['sweep', 0.999], ['knock', 0.999], ['escort', 0.999]]), partial: walk('kestrel_derelict', [['board', 'part'], ['cut', 'part'], ['escort', 'part']]),
        safe1: walk('kestrel_derelict', [['scan', 0.01], ['cut', 0.01]]), safe2: walk('kestrel_derelict', [['board', 0.01], ['tow', 0.01]]), handoff: walk('kestrel_derelict', [['board', 0.01], ['cut', 0.01], ['handoff', 0.01]]) };
      out.s1.chainLead = (reset(), walk('kestrel_derelict', [['board', 0.01], ['cut', 0.01], ['escort', 0.01]]), S().chain);
      { reset(); ST.forceStory('kestrel_derelict'); withR(0.01, () => ST.choose('board')); ST.closeStory(); out.s1.closeMid = { open: ST.storyOpen(), step: S().step, chain: S().chain }; }
      // S4: step 1 success / partial -> step 2, fail / safe end; a success pends probe_maker, set when it ends (also on the safe ending)
      out.s4 = { succJam: walk('subspace_echo', [['analyse', 0.01], ['jam', 0.999]]), partSafe: walk('subspace_echo', [['grid', 'part'], ['leave', 0.01]]), fail: walk('subspace_echo', [['analyse', 0.999], ['jam', 0.01]]), safe: walk('subspace_echo', [['log', 0.01]]), succSafe: walk('subspace_echo', [['grid', 0.01], ['leave', 0.01]]) };
      // battle hand-off guard: blocked (battle gap) -> the non-battle text and no fight; allowed -> a soft one-on-one story_echo fight, no follow-up
      const hand = allowed => { reset(); travel(); G.sp.battle = null; PC.PACE_RT.sessionT = allowed ? 1e6 : 0; G.sp.lastBattleT = allowed ? -1e9 : G.ship.elapsed; G.ship.faults = {};
        ST.forceStory('subspace_echo', { lead }); withR(0.01, () => ST.choose('grid')); ST.next(); const allow = BT.battleAllowed('story_echo'), x = withR(0.01, () => ST.choose('track')); const chips = x.chips.map(c => c[1]); ST.closeStory(); const B = G.sp.battle;
        return { allow, battle: x.battle === false ? false : x.battle === 'story_echo' ? true : x.battle, red: chips.some(c => /red alert/.test(c)), alt: /goes to warp/.test(x.text), chain: S().chain && S().chain.id, fight: B ? { ctx: B.ctx, soft: B.soft, enemies: B.enemies.map(e => e.ship), allies: B.allies.length } : null }; };
      out.handBlocked = hand(false); out.handAllowed = hand(true);
      { // the soft caps: no CRIT fault from the fight's hits, the ambient battle faults or the tow; injuries from hits are minor
        const sev = []; for (let i = 0; i < 20; i++) { G.ship.faults = {}; withR(0.99, () => FT.spawnFault('battle')); sev.push(...Object.values(G.ship.faults).map(f => f.sev)); }
        const n0 = MD.M().inj.length, K = PG.PROG.deaths; let ij = []; for (let i = 0; i < 6; i++) { G.sp.battle.injN = 0; withR(0, () => PG.hooks.shipHit.forEach(f => f({ sys: null, hit: 'a test hit' }))); }
        ij = MD.M().inj.slice(n0).map(x => x.sev); MD.M().inj = MD.M().inj.slice(0, n0); for (const id of Object.keys(C.occ)) { /* clear the test injuries */ }
        G.ship.faults = {}; withR(0.99, () => BT.towToDS9()); const tow = Object.values(G.ship.faults).map(f => f.sev);
        out.soft = { hitSev: [...new Set(sev)], injuries: ij, tow, after: (G.ship.faults = {}, G.sp.battle) };
        G.sp.battle = { soft: false }; G.ship.faults = {}; const hard = []; for (let i = 0; i < 20; i++) { G.ship.faults = {}; withR(0.99, () => FT.spawnFault('battle')); hard.push(...Object.values(G.ship.faults).map(f => f.sev)); } G.sp.battle = null; G.ship.faults = {};
        out.soft.unsoftHasCrit = hard.includes('crit'); }
      travel(); G.sp.lastBattleT = G.ship.elapsed;
      // chains: wait 1..3 seen legs, due only after, at most one pending, frozen while away / night rules, expire after 5
      reset(); const ch = {}; MD.M().inj = MD.M().inj.filter(x => x.id !== lead);
      ch.w1 = withR(0, () => ST.setChain('probe_maker', { lead })) && S().chain.wait; ch.second = ST.setChain('kestrel_thanks', {}); ch.stillFirst = S().chain.id;
      ch.dueAt0 = ST.chainDue('leg'); ST.storyLeg(); ch.dueAt1 = ST.chainDue('leg'); S().chain = null;
      withR(0.999, () => ST.setChain('probe_maker', { lead })); ch.w3 = S().chain.wait; const due = []; for (let i = 0; i < 3; i++) { due.push(!!ST.chainDue('leg')); ST.storyLeg(); } due.push(!!ST.chainDue('leg')); ch.w3due = due;
      S().chain.legs = 1; PC.PACE_RT.offline = true; ST.storyLeg(); ST.storyLeg(); PC.PACE_RT.offline = false; PC.PACE_RT.idleT = 1e6; ST.storyLeg(); PC.PACE_RT.idleT = 0; ch.frozen = S().chain.legs;
      // P33 fix 3: expiry counts only legs where the due follow-up could fire: 9 legs at the day cap don't use it up, 5 open ones do
      S().chain.legs = 1; S().chain.el = 0; S().legsSince = 99; S().dayCount = { d: G.prog.day, n: 9 }; for (let i = 0; i < 9; i++) ST.storyLeg(); ch.capEl = S().chain && S().chain.el; S().dayCount = { d: -1, n: 0 };
      for (let i = 0; i < 4; i++) ST.storyLeg(); ch.el4 = S().chain && S().chain.el; ST.storyLeg(); ch.expired = S().chain; ch.nExpired = S().n.expired;
      // P33 fix 1: a due follow-up is eligible, not forced: it obeys the leg gap (never on the leg after its parent) and the share roll
      withR(0, () => ST.setChain('probe_maker', { lead })); S().legsSince = 0; ST.storyLeg(); ch.gapBlocked = withR(0, () => ST.legStory()); ch.gapWhy = ST.gateWhy('leg');
      S().legsSince = 99; ch.rollMiss = withR(0.99, () => ST.legStory());
      PC.PACE_RT.idleT = 1e6; ch.blockedNight = withR(0, () => ST.legStory()); PC.PACE_RT.idleT = 0; ch.keptAfterBlock = S().chain && S().chain.id;
      ch.fired = withR(0, () => ST.legStory()); ch.firedLead = ST.current() && ST.current().cast.lead === lead; ch.clearedOnFire = S().chain; ST.closeStory();
      // the DS9 follow-up: not on a leg, fires on the first open dock moment even right after another story (legsSince 0)
      reset(); withR(0, () => ST.setChain('kestrel_thanks', { lead })); ST.storyLeg(); ch.dockOnLeg = withR(0, () => ST.legStory()) === 'kestrel_thanks'; ST.closeStory(); S().chain = { id: 'kestrel_thanks', wait: 1, legs: 1, ctx: { lead } };
      G.sp.travel = null; G.sp.location = 'ds9'; S().legsSince = 0; ch.dockSame = withR(0, () => ST.tickStoryDock(3600)); ch.dockSameWhy = ST.gateWhy('dock');   // one per DS9 visit
      S().legsSince = 1; ch.dockMiss = withR(0.99, () => ST.tickStoryDock(0.01)); ch.dock = withR(0, () => ST.tickStoryDock(3600)); ch.dockLead = ST.current() && ST.current().cast.lead === lead; ST.closeStory();
      ch.notInPool = !ST.poolFor('leg').includes('probe_maker') && !ST.poolFor('dock').includes('kestrel_thanks');
      out.chains = ch;
      // hardening: a junk chain clamps, a non-chain id drops, a half-finished step is dropped (= safe) with one log line, its earned follow-up kept
      const hz = st => { G.prog.story = st; PG.clampProg(); return JSON.parse(JSON.stringify(G.prog.story)); };
      out.hard = { junk: hz({ chain: { id: 'probe_maker', wait: 99, legs: -3, ctx: { lead: 5 } }, step: { id: 'subspace_echo', node: 7 } }), notChain: hz({ chain: { id: 'letter_home', wait: 1, legs: 0 } }).chain,
        pend: hz({ step: { id: 'subspace_echo', node: 1, pend: 'probe_maker' } }), badStep: hz({ step: { id: 'bogus', node: 1 } }), strStep: hz({ step: 'x' }) };
      G.prog.story = ST.freshStory(); G.prog.story.passed = 'kestrel_derelict'; const lg0 = JSON.stringify(G.log || []).length; ST.storyTick(); ST.storyTick();
      out.hard.tickLog = { cleared: G.prog.story.passed === null, lines: (JSON.stringify(G.log || []).match(/the moment passed/g) || []).length };
      // a real save mid-step: the step is in the save; a load drops it (passed), and nothing is rerolled
      { window.__noSave = false; reset(); travel(); ST.forceStory('kestrel_derelict'); withR(0.01, () => ST.choose('board')); const sv = JSON.parse(localStorage.getItem(SS.SAVE_KEY)); window.__noSave = true;
        out.realStep = { saved: sv.prog.story.step, ok: SS.loadGame(), after: { step: __T.G.prog.story.step, passed: __T.G.prog.story.passed } }; ST.closeStory(); localStorage.removeItem(SS.SAVE_KEY); }
      // P33 fix 2: a story fight is saved with its roll; a reload (in the calm period, cur gone) starts it from storyTick, soft
      { window.__noSave = false; reset(); travel(); G.sp.battle = null; MD.M().gentle = false; PC.PACE_RT.sessionT = 1e6; G.sp.lastBattleT = -1e9; ST.forceStory('jemhadar_wreck'); withR(0.999, () => ST.choose('secure'));
        const sv = localStorage.getItem(SS.SAVE_KEY), f = { saved: JSON.parse(sv).prog.story.fight }; window.__noSave = true; ST.closeStory(); G.sp.battle = null; localStorage.setItem(SS.SAVE_KEY, sv);
        f.ok = SS.loadGame(); const G2 = __T.G, tr = G2.sp.travel; f.kept = G2.prog.story.fight; G2.sp.lastBattleT = -1e9; G2.sp.battle = null;
        // P34b: it stays pending (saved, hardened, never expiring) while docked, in the calm period, under the Shift Report or any panel
        const tick = () => { ST.storyTick(); return [G2.prog.story.fight, !!G2.sp.battle]; };
        G2.sp.travel = null; G2.sp.location = 'ds9'; PC.PACE_RT.sessionT = 1e6; f.docked = tick(); for (let i = 0; i < 40; i++) { ST.storyLeg(); tick(); } f.dockedLong = tick();
        G2.sp.travel = tr; G2.sp.location = 'convoy'; PC.PACE_RT.sessionT = 0; f.calmAllowed = BT.battleAllowed('story_wreck'); f.calm = tick();
        PC.PACE_RT.sessionT = 1e6; document.querySelector('#report').hidden = false; f.report = tick(); document.querySelector('#report').hidden = true;
        document.querySelector('#plogPanel').hidden = false; f.panel = tick(); document.querySelector('#plogPanel').hidden = true;
        G2.prog.story = JSON.parse(JSON.stringify(G2.prog.story)); PG.clampProg(); f.hardKept = G2.prog.story.fight; ST.storyTick(); const B = G2.sp.battle;
        f.started = B && { ctx: B.ctx || B.kind, soft: B.soft }; f.cleared = G2.prog.story.fight; f.junk = hz({ fight: 'bogus' }).fight; G2.sp.battle = null; localStorage.removeItem(SS.SAVE_KEY); out.fightLoad = f; }
      __T.app.paused = false; return out; });
    // ---- P33 frequency ramp: the share of voyage event slots by play day, the 1-a-day cap on days 2-4, the total event rate unchanged ----
    R.ramp = await p.evaluate(async () => {
      const ST = __T.ST, PC = await import('/js/pacing.js'), EVM = await import('/js/events.js'), G = __T.G, S = () => G.prog.story, out = {}, rnd = Math.random;
      let seed = 12345; const rng = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      __T.app.paused = true; window.__noSave = true; PC.PACE_RT.idleT = 0; PC.PACE_RT.offline = false; G.prog.jobs.active = null; G.sp.ev.active = null; G.sp.battle = null; ST.closeStory(); S().chain = null;
      const travel = () => { G.sp.travel = { dest: 'convoy', t: 0, dur: 600 }; G.sp.location = 'convoy'; G.sp.travelPaused = false; };
      out.share = Object.fromEntries([1, 3, 7, 12].map(d => [d, PC.storyShare(d)])); out.perDay = Object.fromEntries([1, 3, 7, 12].map(d => [d, PC.storyPerDay(d)]));
      // measured: 3000 slot offers per play day with the other gates open
      out.measured = {}; for (const d of [1, 3, 7, 12]) { G.prog.playDays = d; travel(); seed = 7; let n = 0; Math.random = rng; try { for (let i = 0; i < 3000; i++) { S().legsSince = 99; S().dayCount = { d: 0, n: 0 }; if (ST.legStory()) { n++; ST.closeStory(); } } } finally { Math.random = rnd; } out.measured[d] = +(n / 3000).toFixed(3); }
      // the day 2-4 cap: one a ship's day, two from day 5
      const cap = (d, n) => { G.prog.playDays = d; travel(); S().legsSince = 99; S().dayCount = { d: G.prog.day, n }; return ST.gateWhy('leg'); };
      out.cap = { d3n0: cap(3, 0), d3n1: cap(3, 1), d4n1: cap(4, 1), d6n1: cap(6, 1), d6n2: cap(6, 2), d12n1: cap(12, 1) };
      { G.prog.playDays = 3; travel(); S().legsSince = 99; S().dayCount = { d: 0, n: 0 }; let n = 0; Math.random = () => 0; try { for (let i = 0; i < 10; i++) { S().legsSince = 99; if (ST.legStory()) { n++; ST.closeStory(); } } } finally { Math.random = rnd; } out.cap.firedInOneDay3 = n; out.cap.counter = JSON.stringify(S().dayCount); }
      // the real slot loop (events.js tickEvents), seeded: every scheduled slot is filled, a story or an old text event
      out.rate = {}; for (const d of [1, 3, 7, 12]) { G.prog.playDays = d; seed = 99; S().chain = null; let target = 0, filled = 0, stories = 0, f0 = S().n.fired; const e0 = G.stats.events; Math.random = rng;
        try { for (let leg = 0; leg < 80; leg++) { travel(); S().dayCount = { d: 0, n: 0 }; EVM.evResetLeg('convoy'); const ev = G.sp.ev; target += ev.legTarget;
          for (let t = 0; t < 700 && ev.legFired < ev.legTarget; t++) { if (G.sp.ev.active) EVM.resolveEvent(false); if (ST.storyOpen()) ST.closeStory(); G.sp.battle = null; G.sp.travelPaused = false; G.sp.travel.t = 0; EVM.tickEvents(1); }
          if (G.sp.ev.active) EVM.resolveEvent(false); if (ST.storyOpen()) ST.closeStory(); G.sp.battle = null; filled += ev.legFired; } } finally { Math.random = rnd; }
        stories = S().n.fired - f0; out.rate[d] = { target, filled, stories, textEvents: filled - stories, statsEvents: G.stats.events - e0, storyShareOfSlots: +(stories / Math.max(1, filled)).toFixed(3) }; }
      G.prog.playDays = 10; G.sp.travel = null; G.sp.location = 'ds9'; __T.app.paused = false; return out; });
    // ---- P34 logic: every roll an Lt skill (help = composure + the crewmate's opinion), the odds line, bonus locks, tier text, dock ramp, E4 ----
    R.p34 = await p.evaluate(async () => {
      const ST = __T.ST, PC = await import('/js/pacing.js'), PG = await import('/js/progression.js'), MD = await import('/js/injuries.js'), BT = await import('/js/battle.js'), EVM = await import('/js/events.js');
      const G = __T.G, C = G.prog.crew, S = () => G.prog.story, out = {}, rnd = Math.random, withR = (v, f) => { Math.random = typeof v === 'function' ? v : () => v; try { return f(); } finally { Math.random = rnd; } };
      __T.app.paused = true; window.__noSave = true; PC.PACE_RT.idleT = 0; PC.PACE_RT.offline = false; G.prog.playDays = 12; G.prog.jobs.active = null; G.sp.ev.active = null; G.sp.battle = null; MD.M().hushUntil = 0; const gen0 = MD.M().gentle; MD.M().gentle = false;
      const sk = G.prog.skills || (G.prog.skills = {}), lt0 = JSON.stringify(sk.lt || {}), setLt = o => { sk.lt = sk.lt || { tactical: 0, engineering: 0, fitness: 0, composure: 0 }; for (const [k, v] of Object.entries(o)) sk.lt[k] = 50 * v * (v + 1); };
      const reset = () => { ST.closeStory(); S().fight = null; S().chain = null; S().legsSince = 99; S().dayCount = { d: 0, n: 0 }; }, travel = () => { G.sp.travel = { dest: 'convoy', t: 10, dur: 600 }; G.sp.location = 'convoy'; };
      const lead = C.slots['engineer-1']; MD.M().inj = MD.M().inj.filter(x => x.id !== lead);
      // 1. shape: no who, every rolled choice an Lt skill + an action phrase; help choices roll composure
      const shape = []; for (const id of Object.keys(ST.EV)) for (const N of ST.EV[id].nodes || [ST.EV[id]]) for (const ch of N.choices) if (!ch.safe && ('who' in ch || !['engineering', 'tactical', 'fitness', 'composure'].includes(ch.skill) || !ch.act || (ch.help && ch.skill !== 'composure'))) shape.push(id + '.' + ch.k);
      out.shape = shape; out.bonusPer = Object.keys(ST.EV).flatMap(id => (ST.EV[id].nodes || [ST.EV[id]]).map(N => N.choices.filter(c => c.bonus).length)).every(n => n <= 1);
      // 2. odds: solo = the Lt skill alone; help = composure + the lead's opinion and tier; the line shows the skill and level
      reset(); setLt({ engineering: 3, composure: 4 }); const op0 = G.prog.opinions[lead];
      const look = op => { G.prog.opinions[lead] = op; ST.closeStory(); ST.forceStory('coolant_cascade', { lead }); const cs = ST.choicesOf(), c = ST.current(); const r = { seal: cs.find(x => x.k === 'seal'), crawl: cs.find(x => x.k === 'crawl'), tier: c.tier }; ST.closeStory(); return r; };
      const a = look(0), b = look(80); out.odds = { sealP: a.seal.p, sealP80: b.seal.p, crawlP: a.crawl.p, crawlP80: b.crawl.p, expSeal: ST.oddsP(3, 0, null), expCrawl80: ST.oddsP(4, 80, b.tier), sealSub: a.seal.sub, crawlSub: b.crawl.sub, tier80: b.tier, leadName: C.occ[lead].short };
      G.prog.opinions[lead] = op0;
      // 3. locks: Engineering 5 -> the coolant bonus is locked (no roll, no res); 6 -> open and rolls
      setLt({ engineering: 5 }); reset(); ST.forceStory('coolant_cascade', { lead }); const lk = ST.choicesOf().find(x => x.k === 'manifold'), n0 = JSON.stringify(S().n), rl = withR(0.01, () => ST.choose('manifold'));
      out.locked = { locked: lk.locked, ok: lk.ok, sub: lk.sub, chose: rl, res: ST.current().res, nSame: JSON.stringify(S().n) === n0, last: ST.choicesOf()[ST.choicesOf().length - 1].safe }; ST.closeStory();
      setLt({ engineering: 6 }); ST.forceStory('coolant_cascade', { lead }); const ul = ST.choicesOf().find(x => x.k === 'manifold'), ru = withR(0.01, () => ST.choose('manifold')); out.unlocked = { locked: !!ul.locked, sub: ul.sub, band: ru.band, credit: ru.text.includes('Your Engineering training carries it.') }; ST.closeStory();
      // 4. tier text: fail / partial / success lines by the Lt's level
      const ch = ST.EV.coolant_cascade.choices.find(x => x.k === 'seal'), tier = {};
      for (const lv of [1, 5, 9]) { setLt({ engineering: lv }); for (const [band, r] of [['fail', 0.999], ['partial', () => 0.8 * ST.choicesOf().find(x => x.k === 'seal').p], ['success', 0.01]]) { G.ship.faults = {}; MD.M().inj = MD.M().inj.filter(x => x.id !== lead); ST.closeStory(); ST.forceStory('coolant_cascade', { lead }); const rr = typeof r === 'function' ? r() : r; const x = withR(rr, () => ST.choose('seal')); const line = ST.ltLine(ch, band, lv, ST.current().cast); tier[`${band}${lv}`] = { band: x.band, has: !!line && x.text.includes(line), line, first: band === 'success' ? null : x.text.startsWith(line) }; ST.closeStory(); } }
      out.tier = tier; G.ship.faults = {}; MD.M().inj = MD.M().inj.filter(x => x.id !== lead);
      // 5. dock ramp: the DS9 chance x the ramp share (one ship-hour: 0.6 x share / 0.35)
      const dock = (d, r) => { reset(); G.sp.travel = null; G.sp.location = 'ds9'; G.prog.playDays = d; const f = withR(r, () => ST.tickStoryDock(3600)); ST.closeStory(); return !!f; };
      out.dock = { d1: dock(1, 0), d3lo: dock(3, 0.16), d3hi: dock(3, 0.18), d7lo: dock(7, 0.33), d7hi: dock(7, 0.35), d12lo: dock(12, 0.59), d12hi: dock(12, 0.61) };
      // 6. E4 pools, chains, the S9 hand-off (allowed / blocked / gentle), text weights
      G.prog.playDays = 3; out.pool3 = ST.poolFor('leg'); G.prog.playDays = 6; out.pool6 = ST.poolFor('leg'); out.poolDock = ST.poolFor('dock'); G.prog.playDays = 12;
      const chainOf = (id, k, lv) => { reset(); travel(); if (lv) setLt(lv); ST.forceStory(id); withR(0.01, () => ST.choose(k)); ST.closeStory(); return S().chain && S().chain.id; };
      out.chains = { treat: chainOf('jemhadar_wreck', 'treat', { composure: 2 }), white: chainOf('jemhadar_wreck', 'white', { engineering: 6 }), secure: chainOf('jemhadar_wreck', 'secure'), hear: chainOf('vorta_offer', 'hear'), trace: chainOf('vorta_offer', 'trace') };
      const wreck = (allowed, gentle) => { reset(); travel(); document.querySelectorAll('.modal').forEach(m => { m.hidden = true; });   // P34b: an open panel (the spec offer) would hold the fight
        G.sp.battle = null; MD.M().gentle = gentle; PC.PACE_RT.sessionT = allowed ? 1e6 : 0; G.sp.lastBattleT = allowed ? -1e9 : G.ship.elapsed; ST.forceStory('jemhadar_wreck'); const x = withR(0.999, () => ST.choose('secure')); ST.closeStory(); const B = G.sp.battle;
        const r = { band: x.band, battle: x.battle, alt: /circles the clearing/.test(x.text), fight: B ? { ctx: B.ctx, soft: B.soft, enemies: B.enemies.map(e => e.ship) } : null }; G.sp.battle = null; G.ship.faults = {}; MD.M().gentle = false; return r; };
      // P34c: a pending fight survives later stories (safe choice, rolled choice, the ✕), blocks new ones ("fight pending"), logs once, then fires
      { reset(); travel(); document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); G.sp.battle = null; MD.M().gentle = false; G.sp.lastBattleT = -1e9; PC.PACE_RT.sessionT = 1e6;
        const lines = () => (JSON.stringify(G.log || []).match(/beacon is still calling/g) || []).length, q = {}, l0 = lines();
        ST.forceStory('jemhadar_wreck'); withR(0.999, () => ST.choose('secure')); document.querySelector('#plogPanel').hidden = false; ST.closeStory(); q.pend = S().fight; q.noBattle = !G.sp.battle;
        for (let i = 0; i < 5; i++) ST.storyTick(); q.lines = lines() - l0; document.querySelector('#plogPanel').hidden = true; PC.PACE_RT.sessionT = 0;   // calm: it keeps waiting while we test
        q.gLeg = ST.gateWhy('leg'); q.legStory = withR(0, () => ST.legStory()); withR(0, () => ST.setChain('probe_maker', {})); S().chain.legs = 3; q.chainLeg = withR(0, () => ST.legStory()); S().chain = null;
        G.sp.travel = null; G.sp.location = 'ds9'; q.gDock = ST.gateWhy('dock'); q.dock = withR(0, () => ST.tickStoryDock(3600)); travel();
        const pick = sel => { const b = document.querySelector('#storyScene ' + sel); if (b) b.click(); return !!b; };
        ST.forceStory('letter_home'); await new Promise(r => setTimeout(r, 50)); q.safeBtn = pick('.stc.safe[data-story-pick]'); await new Promise(r => setTimeout(r, 50)); q.safeRes = !!(ST.current() && ST.current().res); pick('[data-story-close]'); ST.closeStory(); q.afterSafe = S().fight;
        ST.forceStory('mess_hall_feud'); await new Promise(r => setTimeout(r, 50)); q.xBtn = pick('.storyx'); q.xClosed = !ST.storyOpen(); ST.closeStory(); q.afterX = S().fight;
        ST.forceStory('coolant_cascade'); withR(0.01, () => ST.choose('seal')); ST.closeStory(); q.afterRoll = S().fight;
        PC.PACE_RT.sessionT = 1e6; G.sp.lastBattleT = -1e9; ST.storyTick(); q.fired = G.sp.battle && { ctx: G.sp.battle.ctx, soft: G.sp.battle.soft }; q.cleared = S().fight; G.sp.battle = null; q.gAfter = ST.gateWhy('leg'); out.pend34c = q; reset(); }
      out.wreck = { allowed: wreck(true, false), blocked: wreck(false, false), gentle: wreck(true, true) };
      out.textWeight = Object.entries(PC.STORY.textWeight).every(([k, v]) => v === 0.5 && EVM.EV_POOL.some(e => e.id === k)) && !('shadow' in PC.STORY.textWeight);
      sk.lt = JSON.parse(lt0); MD.M().gentle = gen0; G.sp.lastBattleT = G.ship.elapsed; travel(); reset(); __T.app.paused = false; return out; });
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
    { const E = R.e3, J = JSON.stringify, lab = E.labels, has = (tr, i, o) => Object.entries(o).every(([k, v]) => tr[i] && tr[i][k] === v);
      { // P34: every rolled choice in the game is bound to its notes/story-choice-art.md row (label, file name), bonus rows also by skill + threshold
        const md = fs.readFileSync(path.join(__dirname, '../notes/story-choice-art.md'), 'utf8'), [main, bonus] = md.split('## Bonus'), rows = {};
        for (const l of main.split('\n')) { const c = l.split('|').map(x => x.trim()); const f = c.find(x => /^story_\w+_c\d\.webp$/.test(x)); if (f && c.length >= 8) rows[f] = { label: c[4] }; }
        for (const l of bonus.split('\n')) { const c = l.split('|').map(x => x.trim()); if (c[6] && /^story_\w+_c\d\.webp$/.test(c[6])) rows[c[6]] = { label: c[3], skill: c[4], at: +c[5], bonus: true }; }
        const bad = []; for (const g of E.bind) { const r = rows[g.file]; if (!r || r.label !== g.label || !!r.bonus !== g.bonus || (g.bonus && (r.skill !== g.skill || r.at !== g.at))) bad.push({ g, r: r || null }); }
        const used = new Set(E.bind.map(g => g.file)), unbound = Object.keys(rows).filter(f => !used.has(f));
        ok(!bad.length && !unbound.length && E.bind.length > 40, 'notes binding ' + J({ n: E.bind.length, bad, unbound })); }
      ok(J(E.art.kestrel) === J(['story_kestrel_a', 'story_kestrel_b', 'story_kestrel_b']) && J(E.art.echo) === J(['story_echo_a', 'story_echo_b']) && E.art.thanks === 'story_quarks' && E.art.maker === 'story_generic_space' && J(E.art.cbase) === J(['story_kestrel_s1', 'story_kestrel_s2', 'story_kestrel_b']), 'E3 art ' + J(E.art));
      const s1 = E.s1; ok(has(s1.allSucc, 0, { next: 1, saved: 1, step: 1 }) && has(s1.allSucc, 1, { node: 1, next: 2, step: 2 }) && has(s1.allSucc, 2, { node: 2, band: 'success', next: null, step: null, chain: 'kestrel_thanks' })
        && has(s1.fails, 0, { band: 'fail', next: 1 }) && has(s1.fails, 1, { band: 'fail', next: 2 }) && has(s1.fails, 2, { band: 'fail', chain: null }) && has(s1.partial, 2, { band: 'partial', chain: 'kestrel_thanks' })
        && has(s1.safe1, 0, { band: 'safe', next: null, step: null }) && s1.safe1[1] === 'closed' && has(s1.safe2, 1, { band: 'safe', next: null }) && s1.safe2.length === 2 && has(s1.handoff, 2, { band: 'success', chain: null })
        && s1.chainLead && s1.chainLead.wait >= 1 && s1.chainLead.wait <= 3 && s1.chainLead.legs === 0 && typeof s1.chainLead.ctx.lead === 'string' && !s1.closeMid.open && s1.closeMid.step === null && s1.closeMid.chain === null, 'E3 S1 graph ' + J(s1));
      const s4 = E.s4; ok(has(s4.succJam, 0, { band: 'success', next: 1 }) && has(s4.succJam, 1, { band: 'fail', chain: 'probe_maker' }) && has(s4.partSafe, 0, { band: 'partial', next: 1 }) && has(s4.partSafe, 1, { band: 'safe', chain: null })
        && has(s4.fail, 0, { band: 'fail', next: null, step: null }) && s4.fail[1] === 'closed' && has(s4.safe, 0, { band: 'safe', next: null }) && has(s4.succSafe, 1, { band: 'safe', chain: 'probe_maker' }), 'E3 S4 graph ' + J(s4));
      const hb = E.handBlocked, ha = E.handAllowed;
      ok(!hb.allow && hb.battle === false && hb.alt && !hb.red && hb.fight === null && hb.chain === 'probe_maker', 'E3 battle blocked ' + J(hb));
      ok(ha.allow && ha.battle === true && ha.red && !ha.alt && ha.chain === null && ha.fight && ha.fight.ctx === 'story_echo' && ha.fight.soft === true && J(ha.fight.enemies) === '["jh_fighter"]' && ha.fight.allies === 1, 'E3 battle hand-off ' + J(ha));
      ok(!E.soft.hitSev.includes('crit') && E.soft.hitSev.length > 0 && E.soft.injuries.every(s => s === 'minor') && E.soft.tow.length === 3 && !E.soft.tow.includes('crit') && E.soft.after === null && E.soft.unsoftHasCrit, 'E3 soft fight ' + J(E.soft));
      const ch = E.chains; ok(ch.w1 === 1 && ch.second === false && ch.stillFirst === 'probe_maker' && ch.dueAt0 === null && ch.dueAt1 === 'probe_maker' && ch.w3 === 3 && J(ch.w3due) === '[false,false,false,true]' && ch.frozen === 1 && ch.expired === null && ch.nExpired >= 1
        && ch.blockedNight === null && ch.keptAfterBlock === 'probe_maker' && ch.fired === 'probe_maker' && ch.capEl === 0 && ch.el4 === 4 && ch.gapBlocked === null && ch.gapWhy === 'leg gap' && ch.rollMiss === null && ch.dockSame === null && ch.dockSameWhy === 'this dock' && ch.dockMiss === null && ch.firedLead && ch.clearedOnFire === null && !ch.dockOnLeg && ch.dock === 'kestrel_thanks' && ch.dockLead && ch.notInPool, 'E3 chains ' + J(ch));
      const H = E.hard; ok(J(H.junk.chain) === J({ id: 'probe_maker', wait: 3, legs: 0, el: 0, ctx: { lead: null } }) && H.junk.step === null && H.junk.passed === 'subspace_echo' && H.notChain === null && H.pend.chain && H.pend.chain.id === 'probe_maker' && H.pend.passed === 'subspace_echo'
        && H.badStep.passed === null && H.badStep.step === null && H.strStep.passed === null && H.tickLog.cleared && H.tickLog.lines === 1, 'E3 harden ' + J(H));
      { const F = E.fightLoad, W = 'story_wreck,false'; ok(F.saved === 'story_wreck' && F.ok && F.kept === 'story_wreck' && J(F.docked) === J(['story_wreck', false]) && J(F.dockedLong) === J(['story_wreck', false]) && F.calmAllowed === false && J(F.calm) === J(['story_wreck', false])
        && J(F.report) === J(['story_wreck', false]) && J(F.panel) === J(['story_wreck', false]) && F.hardKept === 'story_wreck' && F.started && F.started.soft === true && F.cleared === null && F.junk === null, 'P34b: a saved story fight waits (docked, calm, Shift Report, panel) and starts once all clear ' + J(F)); }
      ok(E.realStep.saved && E.realStep.saved.id === 'kestrel_derelict' && E.realStep.saved.node === 1 && E.realStep.ok && E.realStep.after.step === null && E.realStep.after.passed === 'kestrel_derelict', 'E3 real save mid-step ' + J(E.realStep)); }
    { const M = R.ramp, J = JSON.stringify;
      ok(J(M.share) === '{"1":0,"3":0.1,"7":0.2,"12":0.35}' && J(M.perDay) === '{"1":0,"3":1,"7":1,"12":2}' && Math.abs(M.measured[1]) === 0 && Math.abs(M.measured[3] - 0.10) < 0.025 && Math.abs(M.measured[7] - 0.20) < 0.03 && Math.abs(M.measured[12] - 0.35) < 0.035, 'P33 share ' + J([M.share, M.measured]));
      ok(M.cap.d3n0 === null && M.cap.d3n1 === 'day cap' && M.cap.d4n1 === 'day cap' && M.cap.d6n1 === 'day cap' && M.cap.d6n2 === 'day cap' && M.cap.d12n1 === null && M.cap.firedInOneDay3 === 1, 'P33 day cap ' + J(M.cap));
      const rs = Object.values(M.rate), per = rs.map(r => r.filled / 80);
      ok(rs.every(r => r.filled === r.target && r.statsEvents === r.filled) && M.rate[1].stories === 0 && M.rate[3].stories > 0 && M.rate[12].stories > M.rate[3].stories && Math.max(...per) - Math.min(...per) < 0.25, 'P33 event rate ' + J(M.rate)); }
    { const P = R.p34, J = JSON.stringify, O = P.odds;
      ok(!P.shape.length && P.bonusPer, 'P34 Lt-skill choices ' + J(P.shape));
      ok(Math.abs(O.sealP - O.expSeal) < 1e-9 && O.sealP === O.sealP80 && O.crawlP80 > O.crawlP && Math.abs(O.crawlP80 - O.expCrawl80) < 1e-9 && /^Engineering 3 · /.test(O.sealSub) && O.crawlSub.startsWith(`Composure 4 · with ${O.leadName} · `), 'P34 odds ' + J(O));
      ok(P.locked.locked && !P.locked.ok && P.locked.sub === 'needs Engineering 6' && P.locked.chose.ok === false && !P.locked.res && P.locked.nSame && P.locked.last && !P.unlocked.locked && /^Engineering 6 · /.test(P.unlocked.sub) && P.unlocked.band === 'success' && P.unlocked.credit, 'P34 locks ' + J([P.locked, P.unlocked]));
      const T = P.tier, lines = ['fail1', 'fail5', 'fail9'].map(k => T[k].line);
      ok(Object.entries(T).every(([k, v]) => v.band === k.replace(/\d+$/, '') && v.has && v.first !== false) && new Set(lines).size === 3 && /little practice/.test(T.fail1.line) && /gives out anyway/.test(T.fail9.line) && /still green/.test(T.success1.line) && /make it look easy/.test(T.success9.line), 'P34 tier text ' + J(T));
      const D = P.dock; ok(!D.d1 && D.d3lo && !D.d3hi && D.d7lo && !D.d7hi && D.d12lo && !D.d12hi, 'P34 dock ramp ' + J(D));
      ok(P.pool3.includes('holo_ghost') && !P.pool3.includes('vorta_offer') && ['vorta_offer', 'bajoran_relic', 'cardassian_codes', 'jemhadar_wreck', 'holo_ghost'].every(i => P.pool6.includes(i)) && !P.pool6.includes('shore_trouble') && P.poolDock.includes('shore_trouble') && !P.poolDock.includes('vorta_offer') && ![...P.pool6, ...P.poolDock].some(i => ['vorta_returns', 'debt_repaid'].includes(i)), 'P34 E4 pools ' + J([P.pool3, P.pool6, P.poolDock]));
      ok(P.chains.treat === 'debt_repaid' && P.chains.white === 'debt_repaid' && P.chains.secure === null && P.chains.hear === 'vorta_returns' && P.chains.trace === null, 'P34 E4 chains ' + J(P.chains));
      { const q = P.pend34c, W = 'story_wreck'; ok(q.pend === W && q.noBattle && q.lines === 1 && q.gLeg === 'fight pending' && q.legStory === null && q.chainLeg === null && q.gDock === 'fight pending' && q.dock === null
        && q.safeBtn && q.safeRes && q.afterSafe === W && q.xBtn && q.xClosed && q.afterX === W && q.afterRoll === W && q.fired && q.fired.ctx === W && q.fired.soft === true && q.cleared === null && q.gAfter !== 'fight pending', 'P34c: a pending fight survives later stories, gates new ones, logs once, then fires ' + J(q)); }
      const W = P.wreck; ok(W.allowed.band === 'fail' && W.allowed.battle === 'story_wreck' && W.allowed.fight && W.allowed.fight.ctx === 'story_wreck' && W.allowed.fight.soft === true && J(W.allowed.fight.enemies) === '["jh_fighter"]' && W.blocked.battle === false && W.blocked.alt && !W.blocked.fight && W.gentle.battle === false && W.gentle.alt && !W.gentle.fight && P.textWeight, 'P34 S9 hand-off / weights ' + J([W, P.textWeight])); }
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
