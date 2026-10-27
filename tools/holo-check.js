// Holodeck + hotspot check (Oct 25 build on 03db75a). Per size (390x844, 844x390, 1280x800):
//  1. the old bug: a booking for the Lt used to hold a busy timer of pg.min SHIP minutes; v18 freezes ship time while paused /
//     away, so "You're already in a session" outlived reloads and real days. Now his session is instant (no timer), and a
//     pre-fix save's stuck busy.lt is dropped on load
//  2. the daily limit (HOLO.ltPerDay = 1 per real local day): one session, then every row says why + 'Next available: tomorrow
//     12:00 AM'; the panel shows UNAVAILABLE TODAY; a real tap on a greyed row toasts the reason (shot shots/holo-limit-<size>.png)
//  3. crew never block it: every crewmate on a (self- or paid) session, and the Lt still books; his paid bookings for crew
//     don't use his slot
//  4. midnight reset with a mocked clock (23:59 -> 00:00:05 the next day), and the clock moved back gives nothing extra
//  5. hotspots: on every deck the floor pixels around each action spot are identical with and without the spots (nothing
//     drawn), the ?debug=1&walk=1 overlay does draw them (the probe works), and every spot is still tappable: a real tap on
//     each on-screen spot sends him there, and hitTest answers >= 22 px from the centre (a >= 44 px target)
// 0 console errors, 0 failed requests. Usage: node tools/holo-check.js   (SHOTS=0 skips the shots)
const { chromium } = require('playwright-core'); const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/', OUT = path.resolve(__dirname, '..', 'shots') + '/', SHOTS = process.env.SHOTS !== '0';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [], net = [], fails = [], J = JSON.stringify, host = new URL(BASE).host, ok = (c, m) => { if (!c) fails.push(m); else console.log('ok ' + m.split(' {')[0].split(' [')[0]); };
  for (const [w, h] of [[390, 844], [844, 390], [1280, 800]]) {
    const tag = `${w}x${h}`, mob = w < 900, c = await br.newContext({ viewport: { width: w, height: h }, locale: 'en-US', timezoneId: 'America/Chicago', isMobile: mob, hasTouch: mob });
    await c.addInitScript(() => { window.__TENACITY_SKIP_NAME = true; window.__TENACITY_SKIP_BG = true; });
    const p = await c.newPage();
    p.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); }); p.on('pageerror', e => errs.push(`${tag}: ${e.message}`));
    p.on('response', r => { if (r.status() >= 400) net.push(`${tag}: ${r.status()} ${r.url()}`); });
    p.on('requestfailed', r => { if (new URL(r.url()).host === host) net.push(`${tag}: failed ${r.url()} ${r.failure() && r.failure().errorText}`); });
    const ready = () => p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
    const calm = () => p.evaluate(() => { const G = __T.G; G.prog.story.pilot.done = true; G.prog.background = G.prog.background || 'none'; G.prog.bgDone = true; G.prog.rations = 2000; G.ship.nextFault = 1e9; G.sp.cap.decideT = 1e9; G.sp.ev.nextT = -1; G.sp.battle = null; G.sp.alert = null; __T.PACE_RT.sessionT = 1e6; document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); });
    await p.goto(BASE + '?reset=1'); await ready(); await sleep(400); await calm();
    // ---- 1. the old bug, and its stuck state in a pre-fix save ----
    const R = {};
    R.old = await p.evaluate(async () => { const HD = await import('/js/holodeck.js'), h = HD.H(); h.lt = { d: '', n: 0 };
      const a = HD.book('tactical_sim', 'lt', true); return { ok: a.ok, ltTimer: 'lt' in h.busy, busyLt: HD.busyUntil('lt') }; });
    await p.evaluate(() => { const G = __T.G; G.prog.holo.busy.lt = { prog: 'risa_beach', endT: G.ship.elapsed + 7000, self: false }; G.prog.holo.lt = { d: '', n: 0 }; window.__noSave = false; __T.saveGame(); window.__noSave = true; });
    await p.reload(); await ready(); await sleep(400); await calm();
    R.reload = await p.evaluate(async () => { const HD = await import('/js/holodeck.js'); return { stuck: 'lt' in HD.H().busy, st: HD.bookState('vulcan_garden', 'lt', true) }; });
    ok(R.old.ok && !R.old.ltTimer && R.old.busyLt === 0 && !R.reload.stuck && R.reload.st.ok, `${tag} old bug fixed: no Lt timer, a pre-fix stuck booking is dropped on load ` + J(R));
    // ---- 2. the daily limit + its message ----
    R.lim = await p.evaluate(async () => { const HD = await import('/js/holodeck.js'); HD.H().lt = { d: '', n: 0 };
      const a = HD.book('vulcan_garden', 'lt', true); document.querySelectorAll('.modal').forEach(m => { m.hidden = true; });
      const rows = HD.PROG_IDS.map(pid => HD.bookState(pid, 'lt', true)); return { first: a.ok, left: HD.ltLeft(), all: rows.every(r => !r.ok && r.used), why: rows[0].why, next: HD.ltNextText() }; });
    await p.evaluate(async () => { const H = await import('/js/ui/holo.js'); H.openHolo('lt'); }); await sleep(300);
    R.panel = await p.evaluate(() => { const m = document.getElementById('holoPanel'), l = m.querySelector('.hololimit'), r = l && l.getBoundingClientRect();
      return { open: !m.hidden, text: l ? l.textContent : null, inView: !!r && r.top >= 0 && r.bottom <= innerHeight, greyed: [...m.querySelectorAll('[data-holo-book]')].every(b => b.getAttribute('aria-disabled') === 'true') }; });
    const row = p.locator('#holoPanel [data-holo-book]').first(); await row.scrollIntoViewIfNeeded(); await row.click({ force: true });   /* aria-disabled: Playwright calls it 'not enabled', a finger still taps it */ await sleep(350);
    R.toast = await p.evaluate(() => { const f = document.querySelector('#holoPanel .hololimit.flash'), r = f && f.getBoundingClientRect();
      const tEl = [...document.querySelectorAll('#toasts .toast')].find(t => /unavailable/i.test(t.textContent));
      const tb = document.getElementById('toasts'), mp = document.getElementById('holoPanel');
      const tz = +getComputedStyle(tb).zIndex || 0, mz = +getComputedStyle(mp).zIndex || 0;
      // #toasts is pointer-events:none (clicks pass through), so elementFromPoint is the wrong test; z-index + body parent is the paint order
      const onTop = !!(tEl && tb.parentElement === document.body && tz > mz);
      return { toast: tEl ? tEl.textContent : null, flash: f ? f.textContent : null, flashInView: !!r && r.top >= 0 && r.bottom <= innerHeight, onTop, tz, mz }; });   // D2: toast above the holodeck panel
    if (SHOTS) await p.screenshot({ path: OUT + `holo-limit-${tag}.png` });
    ok(R.lim.first && R.lim.left === 0 && R.lim.all && /Next available: tomorrow 12:00\sAM/.test(R.lim.why), `${tag} one session a day, then the reason + next time ` + J(R.lim));
    ok(R.panel.open && /UNAVAILABLE TODAY/.test(R.panel.text || '') && /Next available: tomorrow 12:00\sAM/.test(R.panel.text || '') && R.panel.inView && R.panel.greyed && /Holodeck unavailable — Next available: tomorrow 12:00\sAM/.test(R.toast.toast || '') && /Next available: tomorrow 12:00\sAM/.test(R.toast.flash || '') && R.toast.flashInView && R.toast.onTop, `${tag} panel says unavailable + next time; a tap on a row explains ` + J([R.panel, R.toast]));
    await p.evaluate(() => { document.getElementById('holoPanel').hidden = true; });
    // ---- 3. crew never block it ----
    R.crew = await p.evaluate(async () => { const HD = await import('/js/holodeck.js'), G = __T.G, h = HD.H(); h.lt = { d: '', n: 0 };
      const ids = Object.values(G.prog.crew.slots).filter(id => id && G.prog.crew.occ[id]), t = G.ship.elapsed;
      ids.forEach((id, i) => { h.busy[id] = { prog: 'dixon_hill', endT: t + 1e5, self: i % 2 === 0 }; });   // everyone aboard on the holodeck (self- and paid)
      const all = ids.every(id => HD.isHolo(id)), st = HD.bookState('captain_proton', 'lt', true), a = HD.book('captain_proton', 'lt', true);
      h.busy = {}; h.lt = { d: '', n: 0 }; const cid = ids.find(id => HD.bookState('klingon_calisthenics', id, true).ok) || null, paid = cid ? HD.book('klingon_calisthenics', cid, true).ok : null;
      const self = HD.tickHolo ? (() => { for (let i = 0; i < 400; i++) HD.tickHolo(10); return Object.values(h.busy).some(b => b.self); })() : null;
      return { n: ids.length, all, st: st.ok, booked: a.ok, solo: a.who && a.who.length === 1, paidForCrew: paid, leftAfterPaid: HD.ltLeft(), selfAfter: self, stillFree: HD.bookState('tactical_sim', 'lt', true).ok }; });
    ok(R.crew.all && R.crew.st && R.crew.booked && (R.crew.paidForCrew === null || R.crew.paidForCrew === true) && R.crew.leftAfterPaid === 1 && R.crew.stillFree, `${tag} crew sessions never block his slot; paying for crew doesn't use it ` + J(R.crew));
    // ---- 4. midnight reset, mocked clock ----
    R.mid = await p.evaluate(async () => { const HD = await import('/js/holodeck.js'), RD = Date, h = HD.H(); let off = 0;
      class FD extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }
      const set = d => { off = d.getTime() - RD.now(); }; window.Date = FD;
      try { const n = new RD(); set(new RD(n.getFullYear(), n.getMonth(), n.getDate(), 23, 59, 0)); h.lt = { d: '', n: 0 }; h.busy = {};
        const a = HD.book('vulcan_garden', 'lt', true).ok, at2359 = HD.bookState('vulcan_garden', 'lt', true), next = HD.ltNextText();
        set(new RD(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 5)); const after = HD.bookState('vulcan_garden', 'lt', true).ok, left = HD.ltLeft();
        const b = HD.book('vulcan_garden', 'lt', true).ok; set(new RD(n.getFullYear(), n.getMonth(), n.getDate(), 12, 0, 0)); const back = HD.bookState('vulcan_garden', 'lt', true);
        return { a, blocked: !at2359.ok, next, after, left, b, backBlocked: !back.ok, backWhy: back.why };
      } finally { window.Date = RD; } });
    ok(R.mid.a && R.mid.blocked && /^Next available: tomorrow 12:00\sAM$/.test(R.mid.next) && R.mid.after && R.mid.left === 1 && R.mid.b && R.mid.backBlocked, `${tag} resets at local midnight; moving the clock back gives nothing ` + J(R.mid));
    // ---- 5. hotspots: invisible on every deck, still tappable ----
    R.spots = await p.evaluate(async () => { const D = await import('/js/data.js'), R = await import('/js/render/deck.js'), G = __T.G, L = G.lt, out = {};
      const cam = R.cam, keep = { ...cam }, cv = document.createElement('canvas'); cv.width = D.DW; cv.height = D.DH; const x = cv.getContext('2d', { willReadFrequently: true });
      const save = { deck: L.deck, x: L.x, y: L.y, mode: L.mode, node: L.node, path: L.path, lift: L.lift, intent: L.intent };
      __T.app.paused = true;
      const grab = () => { Object.assign(cam, { x: D.DW / 2, y: D.DH / 2, w: D.DW, h: D.DH, scale: 1, manualT: 1e9, snap: false }); R.drawDeck(x, 1000, 0); return x.getImageData(0, 0, D.DW, D.DH).data; };
      const ann = n => { const px = []; const K = 1, rx = 15 * 1.6 + 6, ry = rx * 0.34 + 4; for (let yy = Math.floor(n.y * D.DH - ry); yy <= n.y * D.DH + ry; yy++) for (let xx = Math.floor(n.x * D.DW - rx); xx <= n.x * D.DW + rx; xx++) if (xx >= 0 && yy >= 0 && xx < D.DW && yy < D.DH) px.push((yy * D.DW + xx) * 4); return px; };
      for (const [dk, def] of Object.entries(D.DECKS)) {
        Object.assign(L, { deck: dk, lift: null, path: null, mode: 'idle', node: null, x: def.lift.x, y: def.lift.y });
        const nodes = def.nodes, ids = Object.keys(nodes); if (!ids.length) { out[dk] = { nodes: 0 }; continue; }
        const diff = (a, b) => { let d = 0; for (const n of Object.values(nodes)) for (const i of ann(n)) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 6) d++; return d; };
        const withS = grab(); def.nodes = {}; const noS = grab(); def.nodes = nodes;
        R.DBG.walk = true; const dbgS = grab(); def.nodes = {}; const dbgNo = grab(); def.nodes = nodes; R.DBG.walk = false;
        out[dk] = { nodes: ids.length, visible: diff(withS, noS), debugShows: diff(dbgS, dbgNo) };
      }
      Object.assign(cam, keep, { manualT: 0, snap: true });
      // tap targets at the real camera scale: 22 screen px off-centre (one of 4 directions; crowded consoles share the space
      // between them, nearest wins) still answers with this spot
      for (const [dk, def] of Object.entries(D.DECKS)) { if (!out[dk].nodes) continue; L.deck = dk; let hitOk = 0;
        for (const [id, n] of Object.entries(def.nodes)) { const o = 22 / cam.scale; if ([[o, 0], [-o, 0], [0, o], [0, -o]].some(([dx, dy]) => { const h = R.hitTest(n.x + dx / D.DW, n.y + dy / D.DH); return h && h.id === id; })) hitOk++; }
        out[dk].hit22 = hitOk; } Object.assign(L, save); __T.app.paused = false; return out; });
    const decks = Object.entries(R.spots).filter(([, v]) => v.nodes);
    ok(decks.length >= 5 && decks.every(([, v]) => v.visible === 0), `${tag} no action spot drawn on any deck floor ` + J(R.spots));
    ok(decks.every(([, v]) => v.debugShows > 0), `${tag} the debug walk overlay still outlines them (the pixel probe works) ` + J(R.spots));
    ok(decks.every(([, v]) => v.hit22 === v.nodes), `${tag} every spot answers a tap 22 px off-centre (>= 44 px target) ` + J(R.spots));
    // real taps on the on-screen spots of the current deck (engineering at boot)
    await p.evaluate(async () => { const C = await import('/js/crew.js'); if (__T.G.lt.deck !== 'engineering') C.rideLiftTo('engineering'); });
    await p.waitForFunction(() => __T.G.lt.deck === 'engineering' && !__T.G.lt.lift, null, { timeout: 60000 }); await sleep(400);
    const targets = await p.evaluate(async () => { const D = await import('/js/data.js'), R = await import('/js/render/deck.js'), cv = document.querySelector('#deck'), b = cv.getBoundingClientRect(), cam = R.cam;
      return Object.entries(D.DECKS.engineering.nodes).map(([id, n]) => ({ id, sx: b.left + (n.x * D.DW - cam.x) * cam.scale + cam.w / 2, sy: b.top + (n.y * D.DH - cam.y) * cam.scale + cam.h / 2 }))
        .filter(t => t.sx > b.left + 30 && t.sx < b.right - 30 && t.sy > b.top + 30 && t.sy < b.bottom - 30 && document.elementFromPoint(t.sx, t.sy) === cv); });
    const taps = [];
    for (const t of targets.slice(0, 4)) {
      await p.evaluate(() => { const L = __T.G.lt; L.intent = null; });
      if (mob) await p.touchscreen.tap(t.sx, t.sy); else await p.mouse.click(t.sx, t.sy);
      await sleep(150); taps.push({ id: t.id, went: await p.evaluate(id => { const L = __T.G.lt; return !!((L.intent && L.intent.node === id) || (L.mode === 'use' && L.node === id)); }, t.id) });
    }
    ok(taps.length >= 1 && taps.every(t => t.went), `${tag} a real tap on each on-screen spot sends him there ` + J(taps));
    await c.close();
  }
  ok(errs.length === 0, 'console errors ' + J(errs.slice(0, 5))); ok(net.length === 0, 'failed / 4xx requests ' + J(net.slice(0, 5)));
  await br.close();
  if (fails.length) { console.log('FAIL\n' + fails.join('\n')); process.exit(1); }
  console.log('PASS · holo-check · 3 sizes · 0 console errors · 0 failed requests');
})();
