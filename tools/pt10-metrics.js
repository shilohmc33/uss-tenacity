// Playtest 10 before/after metrics + shots (deterministic: paused loop, exact 1/60 s steps, seeded Math.random). Base: tools/pt09-metrics.js.
//   lying:   drawn figure length vs painted bed length for every bed (biobed, bunk, quarters rack at each tier) - item 5
//   asideov: the Lt standing on a crewmate who stepped aside (Lt sent to aside crew on purpose + random orders), 5 decks - item 3
//   trenwait: T'Ren blocked by a standing Lt (port passage = no way round; open floor): longest motionless stretch - item 4
// Usage: BASE=http://127.0.0.1:8811/ TAG=after [SEED=n] [ONLY=lying,asideov,trenwait] node tools/pt10-metrics.js -> shots/pt10-TAG-*.png + shots/pt10-TAG[-SEED]-metrics.json
const { chromium } = require('playwright-core');
const fs = require('fs');
const { execSync } = require('child_process');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const TAG = process.env.TAG || 'before';
const ONLY = process.env.ONLY || '';   // comma list of sections to run (lying,asideov,trenwait); empty = all
const want = k => !ONLY || ONLY.split(',').includes(k);
const SH = '/workspace/tenacity/shots/';
const TMP = `/workspace/pt10-frames/${TAG}/`;
const VPS = { phone: { width: 390, height: 844, dsf: 2, mobile: true }, desk: { width: 1280, height: 800, dsf: 1, mobile: false } };
const SEED = +(process.env.SEED || 1234567);   // Math.random seed (aside / overlap probes vary with it: average a few)
const INIT = (seed) => {
  let s = seed; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  window.__DL = []; const P = CanvasRenderingContext2D.prototype, orig = P.drawImage; let pend = null;
  const key = img => { try { const m = (img.src || '').match(/assets\/(.+)\.(webp|png)/); return m ? m[1] : null; } catch (e) { return null; } };
  P.drawImage = function (img, ...a) {
    try {
      const k = img && img.src ? key(img) : null;
      if (k && !/^deck-|^walk-|^bg-|^space|^ship-|^cabin-/.test(k) && a.length === 8) {
        if (this.canvas.id !== 'deck') pend = { k, sx: a[0], sy: a[1], sw: a[2], sh: a[3] };
        else { const T = this.getTransform(); window.__DL.push({ k, sx: a[0], sy: a[1], sw: a[2], sh: a[3], dx: a[4], dy: a[5], dw: a[6], dh: a[7], T: [T.a, T.b, T.c, T.d, T.e, T.f] }); }
      } else if (k && /^deck-/.test(k) && this.canvas.id === 'deck') { const T = this.getTransform(); window.__CAM = [T.a, T.b, T.c, T.d, T.e, T.f]; }
      else if (pend && img instanceof HTMLCanvasElement && this.canvas.id === 'deck' && a.length === 8) { const T = this.getTransform(); window.__DL.push({ ...pend, dx: a[4], dy: a[5], dw: a[6], dh: a[7], T: [T.a, T.b, T.c, T.d, T.e, T.f] }); pend = null; }
    } catch (e) {}
    return orig.call(this, img, ...a);
  };
};
const montage = (files, out, cols) => execSync(`python3 -c "
import sys
from PIL import Image
fs=sys.argv[3:]; cols=int(sys.argv[2]); ims=[Image.open(f).convert('RGB') for f in fs]
w=max(i.width for i in ims); h=max(i.height for i in ims); rows=(len(ims)+cols-1)//cols
M=Image.new('RGB',(w*cols,h*rows),(10,10,16))
for k,i in enumerate(ims): M.paste(i,((k%cols)*w,(k//cols)*h))
M.save(sys.argv[1])" ${out} ${cols} ${files.join(' ')}`);
async function run() {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const M = { errors: {} };
  for (const vpn of ['phone', 'desk']) {
    const v = VPS[vpn], R = M[vpn] = {}; fs.mkdirSync(TMP + vpn, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.dsf, isMobile: v.mobile, hasTouch: v.mobile });
    await ctx.addInitScript(() => { window.__TENACITY_SKIP_NAME = true; window.__TENACITY_SKIP_BG = true; window.__TENACITY_NO_IDLE = true; });   // v18: skip the name / Academy prompts; no idle pause in long shot runs
    const p = await ctx.newPage(); const errs = M.errors[vpn] = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await ctx.addInitScript({ content: `(${INIT.toString()})(${SEED})` });
    await p.goto(BASE + '?debug=1&reset=1');
    for (let i = 0; i < 300; i++) { await new Promise(r => setTimeout(r, 100)); if (await p.evaluate(() => !!window.__T && document.querySelector('#loading').classList.contains('done'))) break; }
    await new Promise(r => setTimeout(r, 1200));
    await p.evaluate(async () => {
      const [{ stepSim }, { tickTren }, { tickAmbient }, { drawDeck }, D, CB, CD] = await Promise.all(['/js/sim.js', '/js/npc.js', '/js/npc-ambient.js', '/js/render/deck.js', '/js/data.js', '/js/cabin.js', '/js/cabin-data.js'].map(u => import(u)));
      window.__D = D; window.__CB = CB; window.__CD = CD; window.__IMG = (await import('/js/assets.js')).IMG;   // art batch 1: lie-art body measure
      const dctx = document.querySelector('#deck').getContext('2d'); window.__rt = 100; __T.app.paused = true; window.__noSave = true;
      window.__frame = null;   // per-tick observer
      window.__adv = (ms, draw = true) => { const n = Math.round(ms / (1000 / 60)); for (let i = 0; i < n; i++) { const s = 1 / 60; stepSim(s); tickTren(s); tickAmbient(s); window.__rt += s; if (window.__frame) window.__frame(s); if (draw && (i % 2 === 1 || n === 1)) drawDeck(dctx, window.__rt, 2 / 60); } };
      document.querySelectorAll('.modal:not(.hidden), .overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
      window.__w2 = (e, lx, ly) => { const C = window.__CAM, T = e.T; const sx = T[0] * lx + T[2] * ly + T[4], sy = T[1] * lx + T[3] * ly + T[5]; const det = C[0] * C[3] - C[1] * C[2], ux = sx - C[4], uy = sy - C[5]; return [(C[3] * ux - C[2] * uy) / det, (-C[1] * ux + C[0] * uy) / det, Math.hypot(T[2], T[3]) / Math.hypot(C[2], C[3])]; };
      // head-top row per v3 cell of the Lt's sheet (first row with >= 3 opaque px)
      const im = (await import('/js/assets.js')).IMG['lt-v3'], c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, im.width, im.height).data; window.__top = {};
      for (let cy = 0; cy < im.height / 384; cy++) for (let cx = 0; cx < im.width / 160; cx++) { let top = null; for (let yy = 0; yy < 384 && top == null; yy++) { let n = 0; for (let xx = 0; xx < 160; xx++) if (d[((cy * 384 + yy) * im.width + cx * 160 + xx) * 4 + 3] > 128) n++; if (n >= 3) top = yy; } window.__top[cx * 160 + ':' + cy * 384] = top; }
    });
    const ev = (fn, arg) => p.evaluate(fn, arg);
    const adv = (ms, draw) => ev(([ms, draw]) => { __T.app.paused = true; window.__adv(ms, draw); }, [ms, draw !== false]);
    const place = (deck, x, y, dir = 'down') => ev(([deck, x, y, dir]) => { const L = __T.G.lt; L.lift = null; L.deck = deck; L.x = x; L.y = y; L.mode = 'idle'; L.path = null; L.node = null; L.repairSys = null; L.dir = dir; L.moving = false; L.swingAmp = 0; __T.cam.snap = true; __T.cam.manualT = 0; __T.G.ship.energy = 90; for (const k of Object.keys(__T.G.ship.faults)) delete __T.G.ship.faults[k]; }, [deck, x, y, dir]);
    const camFix = (x, y, zoom) => ev(([x, y, zoom]) => { const c = __T.cam; c.x = x * 960; c.y = y * 640; if (zoom) { c.zoom = zoom; c.scale = c.fit * zoom; } c.manualT = 9999; }, [x, y, zoom]);
    const shot = async name => { const f = `${TMP}${vpn}/${name}.png`; await p.screenshot({ path: f }); return f; };
    // a clip of w x h css px centred on design point (fx, fy) (deck fractions), for readable strips
    const shotAt = async (name, fx, fy, w = 170, h = 230) => { const f = `${TMP}${vpn}/${name}.png`;
      const c = await ev(([fx, fy]) => { const cam = __T.cam, r = document.querySelector('#deck').getBoundingClientRect();   // inverse of deck.js screenToDeck
        return [r.left + (fx * 960 - cam.x) * cam.scale + cam.w / 2, r.top + (fy * 640 - cam.y) * cam.scale + cam.h / 2]; }, [fx, fy]);
      const x = Math.max(0, Math.min(v.width - w, c[0] - w / 2)), y = Math.max(0, Math.min(v.height - h, c[1] - h / 2));
      await p.screenshot({ path: f, clip: { x, y, width: w, height: h } }); return f; };
    const ltAt = () => ev(() => [__T.G.lt.x, __T.G.lt.y - 0.1]);

    // ---- 1) lying length per bed ----
    const beds = [['medical', 'biobed', null], ['berthing', 'bunk', null], ...['ltjg', 'lt', 'ltcmdr', 'cmdr'].map(t => ['quarters', 'rack', t])];
    R.lying = {}; const lieShots = [];
    if (want('lying')) for (const [deck, node, tier] of beds) {
      const ok = await ev(([deck, node, tier]) => { if (tier) { if (!__CD.CABIN_TIERS[tier]) return false; for (let r = 0; r < 12; r++) if (__CB.tierIdFor(r) === tier) { __T.G.prog.rank = r; break; } __T.G.prog.cabin.tier = tier; __CB.applyTier(); } return !!__D.DECKS[deck].nodes[node]; }, [deck, node, tier]);
      if (!ok) { R.lying[tier || node] = { skipped: true }; continue; }
      const n = await ev(([deck, node]) => { const n = __D.DECKS[deck].nodes[node]; return { x: n.x, y: n.y, lie: n.lie, lieLen: n.lieLen }; }, [deck, node]);
      await place(deck, n.x, n.y);
      await ev(([node]) => { const L = __T.G.lt; L.mode = 'use'; L.node = node; L.useT = 0; __T.G.ship.energy = 20; }, [node]);
      await adv(1200); await camFix(n.lie[0], n.lie[1], vpn === 'phone' ? 3.2 : 2.4); await ev(() => { window.__DL = []; }); await adv(1000 / 30);
      const m = await ev(() => { const F = __D.CREW_FRAMES.lying; const e = window.__DL.filter(e => e.k === 'crew-atlas' || /^lie/.test(e.k)); if (!e.length) return null; const a = e[e.length - 1], w = __w2(a, 0, 0);
        // art batch 1: a LIE_ART cell (384 x 160 per frame) has transparent margins - measure the opaque body along it, not the cell width
        let frac = 1; if (a.k !== 'crew-atlas') { const im = window.__IMG && window.__IMG[a.k]; if (im) { const c = document.createElement('canvas'); c.width = 384; c.height = 160; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 384, 160, 0, 0, 384, 160); const d = x.getImageData(0, 0, 384, 160).data; let x0 = 384, x1 = -1; for (let yy = 0; yy < 160; yy++) for (let xx = 0; xx < 384; xx++) if (d[(yy * 384 + xx) * 4 + 3] > 64) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; } if (x1 > x0) frac = (x1 - x0 + 1) / 384; } }
        const len = a.k === 'crew-atlas' ? a.dh * F.refH / F.h * w[2] : a.dw * w[2] * frac; return { figLen: +len.toFixed(1), bodyFrac: +frac.toFixed(3) }; });
      const bedNow = await ev(([deck, node]) => __D.DECKS[deck].nodes[node].lieLen, [deck, node]);
      const art = tier ? await ev(([tier]) => { const b = (__CD.CABIN_TIERS[tier].beds || [])[0]; return b ? { rackPx: +((b[2] - b[0]) * 960).toFixed(1), mattressPx: +((b[2] - b[0]) * 960 - 16).toFixed(1) } : null; }, [tier]) : null;
      const key = tier ? `rack-${tier}` : node; R.lying[key] = { bedLen: bedNow, ...(art || {}), tierKept: !tier || bedNow === n.lieLen, ...(m || { figLen: null }), fits: !!m && m.figLen <= bedNow + 0.5, fullSize: !!m && m.figLen >= 137.5 };
      lieShots.push(await shotAt(`lie-${key}`, n.lie[0], n.lie[1], vpn === 'phone' ? 260 : 320, vpn === 'phone' ? 300 : 340));
      await ev(() => { const L = __T.G.lt; L.mode = 'idle'; L.node = null; }); await adv(500, false);
    }
    await ev(() => { __T.G.prog.rank = 0; __T.G.prog.cabin.tier = __CB.tierIdFor(0); __CB.applyTier(); });
    if (lieShots.length) montage(lieShots, `${SH}pt10-${TAG}-${vpn}-lying.png`, lieShots.length);
    R.lyingAllFit = Object.values(R.lying).every(b => b.skipped || b.fits);
    if (vpn === 'desk') { await ctx.close(); continue; }

    // ---- 2) the Lt standing on a crewmate who stepped aside: the longest Lt|crew overlap that starts in 'aside' mode ----
    R.asideov = {};
    if (want('asideov')) for (const deck of (process.env.DECKS || 'bridge,engineering,medical,berthing,lounge').split(',')) {
      const st = await ev(([deck]) => { const nodes = Object.values(__D.DECKS[deck].nodes).filter(n => n.x != null && !n.lift && !n.lie); const n0 = nodes[0] || __D.DECKS[deck].lift; return { x: n0.x, y: n0.y }; }, [deck]);
      await place(deck, st.x, st.y);
      if (process.env.DBG) await ev(() => { window.__dbgAo = 1; });
      await ev(() => {
        const A = window.__ao = { t: 0, run: {}, from: {}, max: 0, maxWho: null, total: 0, over1: 0, sent: 0, asides: 0, mode: {}, ordT: 0 };
        window.__frame = s => { A.t += s; const L = __T.G.lt; A.ordT -= s;
          for (const n of __T.ambient) { if (n.deck !== L.deck || n.x === null) continue; const k = n.occId;
            if (n.mode === 'aside' && A.mode[k] !== 'aside') { A.asides++; if (Math.random() < 0.6) { A.sent++; __T.sendTo(n.x, n.y); A.ordT = 6; } }   // provoke: he walks onto the aside spot
            A.mode[k] = n.mode;
            const d = Math.hypot((L.x - n.x) * 960, (L.y - n.y) * 640), on = !L.lift && !L.moving && !n.moving && d < 20;
            if (on && (A.run[k] || n.mode === 'aside')) { const r0 = A.run[k] || 0; A.run[k] = r0 + s; A.total += s; if (r0 < 1 && A.run[k] >= 1) A.over1++; if (A.run[k] > A.max) { A.max = A.run[k]; A.maxWho = k; if (window.__dbgAo) (A.trace = A.trace || []).push([+A.run[k].toFixed(2), n.mode, n.next || '', n.crowdT != null ? +n.crowdT.toFixed(2) : null, L.mode, +d.toFixed(1), n.t != null ? +n.t.toFixed(2) : null, n.path ? n.path.length : 0]); } }
            else delete A.run[k]; }
          if (A.ordT <= 0) { A.ordT = 2 + Math.random() * 6; __T.sendTo(0.15 + Math.random() * 0.7, 0.2 + Math.random() * 0.65); } };
      });
      for (let k = 0; k < 18; k++) await adv(10000, false);
      R.asideov[deck] = await ev(() => { window.__frame = null; const A = window.__ao; return { secs: Math.round(A.t), asides: A.asides, ltSentOntoAside: A.sent, maxLtOnAsideS: +A.max.toFixed(2), who: A.maxWho, totalS: +A.total.toFixed(2), runsOver1s: A.over1, trace: A.trace ? A.trace.slice(-130).filter((x, i) => i % 6 === 0) : undefined }; });
    }
    if (want('asideov')) { const v = Object.values(R.asideov); R.asideovMax = Math.max(...v.map(x => x.maxLtOnAsideS)); }

    // ---- 3) T'Ren blocked by a standing Lt: does she freeze? ----
    // 'choke' = the Lt stands in the port passage on her way to the far console (no way round at >= 20 px); 'open' = on open floor
    if (want('trenwait')) { R.trenWait = {};
      for (const [cs, from, toI] of [['choke', [0.30, 0.55], null], ['open', [0.578, 0.42], 0]]) {
        await place('bridge', 0.5, 0.6); await ev(([fx, fy]) => { const t = __T.tren; t.x = fx; t.y = fy; t.mode = 'home'; t.t = 999; t.path = null; }, from);
        const mid = await ev(async ([cs, toI]) => { const P = await import('/js/path.js'), N = await import('/js/npc.js'); const t = __T.tren;
          const st = toI == null ? __D.TREN.stations.reduce((b, s) => Math.abs(s.x - t.x) > Math.abs(b.x - t.x) ? s : b) : __D.TREN.stations[toI];
          const path = (P.findPath('bridge', t.x, t.y, st.x, st.y) || []).concat([[st.x, st.y]]);
          const pts = []; let ax = t.x, ay = t.y, along = 0;
          for (const q of path) { const seg = Math.hypot((q[0] - ax) * 960, (q[1] - ay) * 640); for (let k = 1; k <= Math.ceil(seg / 8); k++) { const f = k / Math.ceil(seg / 8); pts.push({ x: ax + (q[0] - ax) * f, y: ay + (q[1] - ay) * f, a: along + seg * f }); } along += seg; ax = q[0]; ay = q[1]; }
          const openAt = p => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (!P.isWalkable('bridge', p.x + dx * 16 / 960, p.y + dy * 16 / 640)) return false; return true; };
          const best = cs === 'choke' ? pts.reduce((b, p) => Math.abs(p.a - 90) < Math.abs(b.a - 90) ? p : b) : (pts.find(p => p.a >= 80 && openAt(p)) || pts[Math.floor(pts.length / 2)]);
          const L = __T.G.lt; L.x = best.x; L.y = best.y; L.dir = 'down'; N.trenTo('station', __D.TREN.stations.indexOf(st)); return { lt: [best.x, best.y], st: [st.x, st.y] }; }, [cs, toI]);
        await camFix(mid.lt[0], mid.lt[1], 1.8);
        await ev(() => { const T = window.__tw = { t: 0, still: 0, maxStill: 0, blocked: 0, maxBlocked: 0, min: 1e9, over: 0, poses: new Set(), key: null, rerouted: 0, dest0: null };
          T.dest0 = __T.tren.spot;
          window.__frame = s => { const t = __T.tren, L = __T.G.lt; T.t += s; const d = Math.hypot((t.x - L.x) * 960, (t.y - L.y) * 640); T.min = Math.min(T.min, d); if (d < 12) T.over += s;
            const key = `${t.dir}|${t.action || '-'}`; const waiting = t.mode === 'walk' && !t.moving;
            if (waiting) { T.blocked += s; T.maxBlocked = Math.max(T.maxBlocked, T.blocked); T.poses.add(key); } else T.blocked = 0;
            if (!t.moving && t.mode === 'walk' && key === T.key) { T.still += s; T.maxStill = Math.max(T.maxStill, T.still); } else T.still = 0;
            T.key = key; if (t.spot !== T.dest0 && t.mode === 'walk') { T.rerouted = 1; } }; });
        const tShots = [];
        for (let i = 0; i < 16; i++) { await adv(750); tShots.push(await shotAt(`tren-${cs}-${String(i).padStart(2, '0')}`, mid.lt[0], mid.lt[1] - 0.06, 240, 260)); }
        await adv(8000, false);
        R.trenWait[cs] = await ev(() => { window.__frame = null; const T = window.__tw, t = __T.tren; return { frozenMaxS: +T.maxStill.toFixed(2), blockedMaxS: +T.maxBlocked.toFixed(2), posesWhileWaiting: [...T.poses], rerouted: !!T.rerouted, minDistPx: +T.min.toFixed(1), overlapS: +T.over.toFixed(2), endMode: t.mode }; });
        montage(tShots, `${SH}pt10-${TAG}-phone-tren-${cs}.png`, 8);
      } 
      // 'home' = the Lt stands on her spot beside the chair while she walks back from a console (no detour: he IS the destination);
      // 'pace' = the Lt keeps walking back and forth across her route (he is moving, so she holds)
      for (const cs of ['home', 'pace']) {
        await place('bridge', 0.5, 0.6);
        const mid = await ev(async ([cs]) => { const N = await import('/js/npc.js'), t = __T.tren, st = __D.TREN.stations[0], H = __D.TREN.home, L = __T.G.lt;
          t.x = st.x; t.y = st.y; t.mode = 'station'; t.t = 999; t.path = null;
          if (cs === 'home') { L.x = H.x; L.y = H.y; L.dir = 'down'; }
          else { const mx = (st.x + H.x) / 2, my = (st.y + H.y) / 2; L.x = mx - 0.04; L.y = my; window.__pace = { a: [mx - 0.045, my], b: [mx + 0.045, my], k: 0, T: 0 }; }
          N.trenTo('home'); return { lt: [L.x, L.y] }; }, [cs]);
        await camFix(mid.lt[0], mid.lt[1], 1.8);
        await ev(([cs]) => { const T = window.__tw = { t: 0, still: 0, maxStill: 0, blocked: 0, maxBlocked: 0, min: 1e9, over: 0, poses: new Set(), key: null, rerouted: 0, dest0: __T.tren.spot };
          window.__frame = s => { const t = __T.tren, L = __T.G.lt; T.t += s;
            if (cs === 'pace' && T.t < 14) { const P = window.__pace; P.T -= s; if (P.T <= 0) { P.T = 1.3; const q = P.k++ % 2 ? P.a : P.b; __T.sendTo(q[0], q[1]); } }
            const d = Math.hypot((t.x - L.x) * 960, (t.y - L.y) * 640); T.min = Math.min(T.min, d); if (d < 12) T.over += s;
            const key = `${t.dir}|${t.action || '-'}`; const waiting = t.mode === 'walk' && !t.moving;
            if (waiting) { T.blocked += s; T.maxBlocked = Math.max(T.maxBlocked, T.blocked); T.poses.add(key); } else T.blocked = 0;
            if (!t.moving && t.mode === 'walk' && key === T.key) { T.still += s; T.maxStill = Math.max(T.maxStill, T.still); } else T.still = 0;
            T.key = key; if (t.spot !== T.dest0 && t.mode === 'walk') T.rerouted = 1; }; }, [cs]);
        const tShots = [];
        for (let i = 0; i < 16; i++) { await adv(1000); tShots.push(await shotAt(`tren-${cs}-${String(i).padStart(2, '0')}`, mid.lt[0], mid.lt[1] - 0.06, 240, 260)); }
        await adv(6000, false);
        R.trenWait[cs] = await ev(() => { window.__frame = null; const T = window.__tw, t = __T.tren; return { frozenMaxS: +T.maxStill.toFixed(2), blockedMaxS: +T.maxBlocked.toFixed(2), posesWhileWaiting: [...T.poses], rerouted: !!T.rerouted, minDistPx: +T.min.toFixed(1), overlapS: +T.over.toFixed(2), endMode: t.mode }; });
        montage(tShots, `${SH}pt10-${TAG}-phone-tren-${cs}.png`, 8);
      } }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(`${SH}pt10-${TAG}${process.env.SEED ? '-s' + SEED : ''}${ONLY ? '-' + ONLY.replace(/,/g, '-') : ''}-metrics.json`, JSON.stringify(M, null, 1));
  console.log(JSON.stringify(M, null, 1));
}
run().catch(e => { console.error(e); process.exit(1); });
