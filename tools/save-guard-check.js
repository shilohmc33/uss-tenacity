// Save-guard check (Oct 24 save-loss fix): play, close the WHOLE browser mid-session (persistent profile, so Chrome restores the
// game tab on relaunch: the case that used to leave the save as just {savedAt}), reopen, progress intact; close again while the
// reopened page is still loading (the actual bug: G is the empty {} placeholder until boot); a corrupted / partial main save
// restores from SAVE_KEY + '.bak'; saveGame refuses a G without its core sections or a far smaller text; ?reset=1 still
// really resets (and clears the backup). 0 console errors / 0 failed or 4xx requests. 390x844, 844x390, 1280x800.
// Usage: node tools/save-guard-check.js
const { chromium } = require('playwright-core'); const fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/', KEY = 'tenacity.save.v1';
const ARGS = ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const errs = [], net = [], fails = [], aborted = [], J = JSON.stringify, ok = (c, m) => { if (!c) fails.push(m); else console.log('ok ' + m.split(' {')[0]); }, host = new URL(BASE).host;
  for (const [w, h] of [[390, 844], [844, 390], [1280, 800]]) {
    const tag = `${w}x${h}`, dir = `/tmp/save-guard-${process.pid}-${tag}`; fs.rmSync(dir, { recursive: true, force: true });
    const launch = () => chromium.launchPersistentContext(dir, { executablePath: '/usr/bin/google-chrome', args: ARGS, viewport: { width: w, height: h } });
    const watch = (p, teardown) => {
      p.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); }); p.on('pageerror', e => errs.push(`${tag}: ${e.message}`));
      p.on('response', r => { if (r.status() >= 400) net.push(`${tag}: ${r.status()} ${r.url()}`); });
      p.on('requestfailed', r => { if (new URL(r.url()).host !== host) return; const t = r.failure() && r.failure().errorText; if (teardown() && /ERR_ABORTED/.test(t || '')) aborted.push(`${tag}: ${r.url()}`); else net.push(`${tag}: failed ${r.url()} ${t}`); });
    };
    let closing = false; const tearing = () => closing;
    const ready = p => p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
    const prep = p => p.evaluate(() => { const G = __T.G; G.prog.background = G.prog.background || 'none'; G.prog.bgDone = true; document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); const pc = document.querySelector('#promCard'); if (pc) pc.hidden = true; });
    const raw = p => p.evaluate(k => { const m = localStorage.getItem(k), b = localStorage.getItem(k + '.bak'); const pick = s => { try { const d = JSON.parse(s); return { len: s.length, keys: Object.keys(d).length, repairs: d.stats && d.stats.repairs, parts: d.ship && d.ship.parts, xp: d.prog && d.prog.xp }; } catch (e) { return s == null ? null : { len: s.length, bad: true }; } }; return { main: pick(m), bak: pick(b), corrupt: localStorage.getItem(k + '.corrupt') != null }; }, KEY);
    const prog = p => p.evaluate(() => { const G = __T.G; return { repairs: G.stats.repairs, parts: G.ship.parts, xp: G.prog.xp, level: G.prog.level, tows: G.stats.tows, log: G.log.slice(-4).map(l => l.t || l.text || l.msg || J(l)) }; }).catch(() => null);
    const R = {};
    // 1. play: a fresh shift, real progress, an autosave (5 s), then a late change the autosave hasn't caught
    let ctx = await launch(), p = ctx.pages()[0] || await ctx.newPage(); watch(p, tearing);
    await p.goto(BASE + '?reset=1'); await ready(p); await prep(p);
    R.fresh = await raw(p);
    await p.evaluate(() => { const G = __T.G; G.stats.repairs = 7; G.ship.parts = 11; __T.awardXP(40, 'manual', 'save-guard'); });
    await sleep(6500); R.before = await prog(p); R.rawBefore = await raw(p);
    await p.evaluate(() => { __T.G.stats.tows = 3; });   // after the last autosave: survives only if the unload save runs
    closing = true; await ctx.close(); closing = false;
    // 2. relaunch (Chrome restores the game tab), let it boot, progress intact
    ctx = await launch(); R.restoredPages = ctx.pages().map(x => x.url());
    for (const x of ctx.pages().slice(1)) { closing = true; await x.close(); closing = false; }
    await sleep(3800);   // a restored tab that booted holds the one-tab lock for 3.5 s after it closes (tablock STALE)
    p = ctx.pages()[0] || await ctx.newPage(); watch(p, tearing);
    await p.goto(BASE); await ready(p); await prep(p); R.after = await prog(p); R.rawAfter = await raw(p);
    // 3. close the whole browser mid-session again, then relaunch and close it while the restored page is still loading
    closing = true; await ctx.close();
    ctx = await launch(); await sleep(250); await ctx.close();   // the restored tab is mid-preload: G is still {}
    ctx = await launch(); await sleep(900); await ctx.close();
    closing = false;
    // then the restored tab is navigated while it is still loading (what a test or a player's reload does): its pagehide fires with G = {}
    ctx = await launch(); p = ctx.pages().find(x => x.url().startsWith(BASE)) || ctx.pages()[0]; watch(p, tearing);
    for (const x of ctx.pages()) if (x !== p) await x.close();
    await p.addInitScript(k => { try { window.__RAW0 = localStorage.getItem(k); } catch (e) {} }, KEY);   // the stored save before any game code runs
    await sleep(300); closing = true;
    await p.goto(BASE); closing = false; await ready(p); await prep(p); R.afterPreload = await prog(p);
    R.rawPreload = await p.evaluate(() => { try { const d = JSON.parse(window.__RAW0); return { main: { len: window.__RAW0.length, keys: Object.keys(d).length, repairs: d.stats && d.stats.repairs } }; } catch (e) { return { main: null, raw: String(window.__RAW0).slice(0, 60) }; } });
    console.log(`${tag}: stored save after the mid-load closes: ${R.rawPreload.main ? R.rawPreload.main.keys + ' sections, ' + R.rawPreload.main.len + ' chars' : 'BROKEN ' + R.rawPreload.raw}`);
    // 4. the save guards: no core sections -> refused; a far smaller text -> refused; a good save writes main + .bak
    R.guard = await p.evaluate(async () => { const SS = await import('/js/state.js'), G = __T.G, o = {};
      const keep = G.prog; delete G.prog; o.noCore = SS.saveGame(); o.whyCore = SS.SAVE_GUARD.why; G.prog = keep;
      const keepLog = G.log, len0 = SS.SAVE_GUARD.len; o.good = SS.saveGame(); const len1 = SS.SAVE_GUARD.len;
      SS.SAVE_GUARD.len = len1 * 4; o.tooSmall = SS.saveGame(); o.whySize = SS.SAVE_GUARD.why; SS.SAVE_GUARD.len = len1; G.log = keepLog;
      o.good2 = SS.saveGame(); o.same = localStorage.getItem(SS.SAVE_KEY) === localStorage.getItem(SS.BAK_KEY); o.live = SS.SAVE_GUARD.live; return o; });
    // 5. a corrupted / partial main save restores from the backup (both a {savedAt} stub and truncated JSON)
    R.restore = {};
    for (const [name, bad] of [['stub', '{"savedAt":1792888000000}'], ['truncated', '{"version":17,"ship":{"hull":10']]) {
      await p.evaluate(([k, bad]) => { window.__noSave = true; localStorage.removeItem(k + '.corrupt'); localStorage.setItem(k, bad); }, [KEY, bad]);
      await p.goto(BASE); await ready(p); await prep(p);
      R.restore[name] = { prog: await prog(p), msg: await p.evaluate(() => [...document.querySelectorAll('#log *')].some(e => /restored from the last good backup/.test(e.textContent))), flag: await p.evaluate(async () => (await import('/js/state.js')).SAVE_GUARD.restored) };
      await p.evaluate(() => { window.__noSave = false; __T.saveGame(); }); R.restore[name].raw = await raw(p);
    }
    // 6. ?reset=1 really resets, and the backup with it
    await p.goto(BASE + '?reset=1'); await ready(p); await prep(p);
    R.reset = { prog: await prog(p), raw: await raw(p), url: p.url() };
    await p.evaluate(() => __T.saveGame()); R.reset.rawSaved = await raw(p);
    closing = true; await ctx.close(); closing = false; fs.rmSync(dir, { recursive: true, force: true });
    // ---- asserts ----
    const B = R.before, A = R.after, P = R.afterPreload;
    ok(B.repairs === 7 && B.parts === 11 && R.rawBefore.main && R.rawBefore.main.repairs === 7 && R.rawBefore.bak && R.rawBefore.bak.repairs === 7, `${tag} autosave wrote main + .bak ` + J([B, R.rawBefore]));
    ok(A && A.repairs === 7 && A.parts >= 11 && A.xp + A.level * 1000 >= B.xp + B.level * 1000 && R.rawAfter.main.keys > 10, `${tag} browser closed mid-session: progress intact ` + J([A, R.rawAfter, R.restoredPages]));
    ok(R.rawPreload.main && R.rawPreload.main.keys > 10 && R.rawPreload.main.repairs === 7 && P && P.repairs === 7, `${tag} closed while loading: save intact (not {savedAt}) ` + J([R.rawPreload, P]));
    const GD = R.guard; ok(GD.noCore === false && GD.whyCore === 'core' && GD.good === true && GD.tooSmall === false && GD.whySize === 'size' && GD.good2 && GD.same && GD.live, `${tag} save guards ` + J(GD));
    for (const [name, r] of Object.entries(R.restore)) ok(r.prog && r.prog.repairs === 7 && r.prog.parts >= 11 && r.msg && r.flag && r.raw.main.keys > 10 && r.raw.main.repairs === 7 && r.raw.corrupt, `${tag} ${name} main save restored from .bak ` + J(r));
    const RS = R.reset; ok(RS.prog.repairs === 0 && RS.prog.xp === 0 && !/reset/.test(RS.url) && (!RS.raw.bak || RS.raw.bak.repairs === 0) && (!RS.raw.main || RS.raw.main.repairs === 0) && RS.rawSaved.bak && RS.rawSaved.bak.repairs === 0, `${tag} ?reset=1 resets (and the backup) ` + J(RS));
    console.log(`${tag}: late change (after the last autosave) ${A && A.tows === 3 ? 'kept by the unload save' : 'not kept (no unload event on a browser close: at most 5 s of play)'} · restored tabs ${J(R.restoredPages)}`);
  }
  if (errs.length) fails.push('console errors: ' + J(errs.slice(0, 8)));
  if (net.length) fails.push('failed requests: ' + J(net.slice(0, 8)));
  if (aborted.length) console.log(`(${aborted.length} requests aborted by the deliberate mid-load browser closes; not counted)`);
  if (fails.length) { console.log('FAIL\n' + fails.join('\n')); process.exit(1); }
  console.log('PASS · save-guard-check · 3 sizes · 0 console errors · 0 failed requests');
})().catch(e => { console.error(e); process.exit(1); });
