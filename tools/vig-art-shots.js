// Oct 27: forces the 5 vignettes_v1-art vignettes (Bajoran, damaged Bajoran, Ferengi, runabout, comet) and shoots shots/vig-art-<id>-<size>.png
// at 390x844, 844x390, 1280x800; fails on any console error or a failed/404 art request. Usage: node tools/vig-art-shots.js
const { chromium } = require('playwright-core');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/', OUT = path.resolve(__dirname, '..', 'shots') + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [], net = [], fails = [], host = new URL(BASE).host;
  for (const [w, h] of [[390, 844], [844, 390], [1280, 800]]) {
    const tag = `${w}x${h}`, mob = w < 900;
    const c = await br.newContext({ viewport: { width: w, height: h }, locale: 'en-US', timezoneId: 'America/Chicago', isMobile: mob, hasTouch: mob });
    await c.addInitScript(() => { window.__TENACITY_SKIP_NAME = true; window.__TENACITY_SKIP_BG = true; window.__TENACITY_NO_IDLE = true; });
    const p = await c.newPage();
    p.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); });
    p.on('pageerror', e => errs.push(`${tag}: ${e.message}`));
    p.on('response', r => { if (r.status() >= 400 && /ship-(bajoran|ferengi|runabout|comet)/.test(r.url())) net.push(`${tag}: ${r.status()} ${r.url()}`); });
    p.on('requestfailed', r => { try { if (new URL(r.url()).host === host && /ship-(bajoran|ferengi|runabout|comet)/.test(r.url())) net.push(`${tag}: failed ${r.url()}`); } catch (e) {} });
    await p.goto(BASE + '?reset=1');
    await p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
    await sleep(400);
    await p.evaluate(() => { const G = __T.G; G.prog.story.pilot.done = true; G.prog.background = G.prog.background || 'none'; G.prog.bgDone = true; G.prog.rations = 2000; G.ship.nextFault = 1e9; G.sp.cap.decideT = 1e9; G.sp.ev.nextT = -1; G.sp.battle = null; G.sp.alert = null; G.prog.day = 12; document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); });
    const loaded = await p.evaluate(async () => {
      const VG = __T.VG, { IMG } = await import('/js/assets.js'), out = {};
      for (const [k, a] of Object.entries(VG.VIG_ART)) out[k] = { ready: !!a.ready, key: a.key, img: !!(IMG[a.key] && IMG[a.key].naturalWidth) };
      out.comet.tail = !!(IMG['ship-comet-tail'] && IMG['ship-comet-tail'].naturalWidth);
      return out;
    });
    console.log(tag, 'art', JSON.stringify(loaded));
    if (!['bajoran_transport','bajoran_transport_damaged','ferengi_marauder','runabout','comet'].every(k => loaded[k] && loaded[k].ready && loaded[k].img) || !loaded.comet.tail) fails.push(`${tag} art not loaded ` + JSON.stringify(loaded));
    for (const id of ['bajoran_transport', 'bajoran_limp', 'ferengi_hail', 'runabout_mail', 'comet', 'ferengi_auction', 'bajoran_vedek', 'comet_wish', 'convoy_thanks']) {
      await p.evaluate(id => {
        const VG = __T.VG; document.querySelectorAll('.modal').forEach(m => { m.hidden = true; });
        const w = document.querySelector('#wbCard'); if (w) w.hidden = true;
        VG.endVig('x'); __T.setView('space');
        const def = VG.VIGS.find(v => v.id === id); VG.startVig(def, { dur: 28, bonus: null });
        for (let i = 0; i < 12; i++) VG.tickVig(1);
      }, id);
      await sleep(600);
      await p.screenshot({ path: `${OUT}vig-art-${id}-${tag}.png` });
      console.log('shot', id, tag);
    }
    await c.close();
  }
  await br.close();
  console.log('ERRORS', errs.length, JSON.stringify(errs.slice(0, 5)));
  console.log('NET', net.length, JSON.stringify(net.slice(0, 5)));
  if (fails.length || errs.length || net.length) { console.log('FAILS', fails); process.exit(1); }
  console.log('PASS · vig-art-shots · 3 sizes · 0 console errors · 0 failed requests');
})().catch(e => { console.error(e); process.exit(1); });
