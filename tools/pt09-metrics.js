// Playtest 09 before/after metrics + shots (deterministic: paused loop, exact 1/60 s steps, seeded Math.random).
//   lying: drawn figure length vs painted bed length for every bed (biobed, berthing bunk, quarters rack at each tier)
//   aside: crew facing flips per second and step-asides per minute while the Lt wanders (stress probe, 3 decks)
//   overlap: longest time two STANDING characters share a spot (< 14 px) while the Lt works stations
//   tren: T'Ren's walk past a Lt standing in her path (closest approach, overlap frames)
//   turns: the Lt's head height relative to his feet across side <-> front turns and action frames (head-y jump)
// Usage: BASE=http://127.0.0.1:8811/ TAG=before node tools/pt09-metrics.js  -> shots/pt09-TAG-*.png + shots/pt09-TAG-metrics.json
const { chromium } = require('playwright-core');
const fs = require('fs');
const { execSync } = require('child_process');
const BASE = process.env.BASE || 'http://127.0.0.1:8811/';
const TAG = process.env.TAG || 'before';
const ONLY = process.env.ONLY || '';   // comma list of sections to run (lying,aside,overlap,tren,turns); empty = all
const want = k => !ONLY || ONLY.split(',').includes(k);
const SH = '/workspace/tenacity/shots/';
const TMP = `/workspace/pt09-frames/${TAG}/`;
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
    const p = await ctx.newPage(); const errs = M.errors[vpn] = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await ctx.addInitScript({ content: `(${INIT.toString()})(${SEED})` });
    await p.goto(BASE + '?debug=1&reset=1');
    for (let i = 0; i < 300; i++) { await new Promise(r => setTimeout(r, 100)); if (await p.evaluate(() => !!window.__T && document.querySelector('#loading').classList.contains('done'))) break; }
    await new Promise(r => setTimeout(r, 1200));
    await p.evaluate(async () => {
      const [{ stepSim }, { tickTren }, { tickAmbient }, { drawDeck }, D, CB, CD] = await Promise.all(['/js/sim.js', '/js/npc.js', '/js/npc-ambient.js', '/js/render/deck.js', '/js/data.js', '/js/cabin.js', '/js/cabin-data.js'].map(u => import(u)));
      window.__D = D; window.__CB = CB; window.__CD = CD;
      const dctx = document.querySelector('#deck').getContext('2d'); window.__rt = 100; __T.app.paused = true; window.__noSave = true;
      window.__frame = null;   // per-tick observer
      window.__adv = (ms, draw = true) => { const n = Math.round(ms / (1000 / 60)); for (let i = 0; i < n; i++) { const s = 1 / 60; stepSim(s); tickTren(s); tickAmbient(s); window.__rt += s; if (window.__frame) window.__frame(s); if (draw && (i % 2 === 1 || n === 1)) drawDeck(dctx, window.__rt, 2 / 60); } };
      document.querySelectorAll('.modal:not(.hidden), .overlay:not(.hidden), #report:not(.hidden)').forEach(m => m.classList.add('hidden'));
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
        const len = a.k === 'crew-atlas' ? a.dh * F.refH / F.h * w[2] : a.dw * w[2]; return { figLen: +len.toFixed(1) }; });
      const bedNow = await ev(([deck, node]) => __D.DECKS[deck].nodes[node].lieLen, [deck, node]);
      const key = tier ? `rack-${tier}` : node; R.lying[key] = { bedLen: bedNow, tierKept: !tier || bedNow === n.lieLen, ...(m || { figLen: null }), fits: !!m && m.figLen <= bedNow + 0.5 };
      lieShots.push(await shotAt(`lie-${key}`, n.lie[0], n.lie[1], vpn === 'phone' ? 260 : 320, vpn === 'phone' ? 300 : 340));
      await ev(() => { const L = __T.G.lt; L.mode = 'idle'; L.node = null; }); await adv(500, false);
    }
    await ev(() => { __T.G.prog.rank = 0; __T.G.prog.cabin.tier = __CB.tierIdFor(0); __CB.applyTier(); });
    if (lieShots.length) montage(lieShots, `${SH}pt09-${TAG}-${vpn}-lying.png`, lieShots.length);
    R.lyingAllFit = Object.values(R.lying).every(b => b.skipped || b.fits);
    if (vpn === 'desk') { await ctx.close(); continue; }

    // ---- 2) step-aside stress: Lt re-ordered every 2-8 s for 120 s on each deck ----
    R.aside = {}; const asideShots = [];
    if (want('aside')) for (const deck of ['bridge', 'engineering', 'lounge']) {
      const st = await ev(([deck]) => { const nodes = Object.values(__D.DECKS[deck].nodes).filter(n => n.x != null && !n.lift); const n0 = nodes[0]; return { x: n0.x, y: n0.y }; }, [deck]);
      await place(deck, st.x, st.y);
      await ev(() => {
        const A = window.__as = { thru: 0, t: 0, flips: 0, rapid: 0, asides: 0, last: {}, prev: {}, mode: {}, ordT: 0 }; const ids = n => n.occId;
        window.__frame = s => { A.t += s; const L = __T.G.lt; A.ordT -= s;
          if (A.ordT <= 0) { A.ordT = 2 + Math.random() * 6; __T.sendTo(0.15 + Math.random() * 0.7, 0.2 + Math.random() * 0.65); }
          for (const n of __T.ambient) { if (n.deck !== L.deck || n.x === null) continue; const k = ids(n);
            if (n.mode === 'aside' && A.mode[k] !== 'aside') { A.asides++; const w = n.asideFrom && n.asideFrom.walker; (A.by = A.by || {})[w === L ? 'lt' : w === __T.tren ? 'tren' : 'crew'] = ((A.by || {})[w === L ? 'lt' : w === __T.tren ? 'tren' : 'crew'] || 0) + 1; } A.mode[k] = n.mode;
            if (!n.moving && A.prev[k] && A.prev[k] !== n.dir) { A.flips++; if (A.t - (A.last[k] ?? -9) < 0.5) A.rapid++; A.last[k] = A.t; }
            A.prev[k] = n.dir;
            if (L.moving && !n.moving && Math.hypot((L.x - n.x) * 960, (L.y - n.y) * 640) < 14) A.thru += s; } };
      });
      for (let k = 0; k < 12; k++) { await adv(10000, k % 3 === 0); if (deck === 'bridge' && k < 8 && k % 1 === 0) { /* strip below */ } }
      const a = await ev(() => { window.__frame = null; const A = window.__as, n = __T.ambient.filter(n => n.deck === __T.G.lt.deck && n.x !== null).length; return { crew: n, secs: Math.round(A.t), flipsPerS: +(A.flips / A.t).toFixed(2), rapidFlipsPerS: +(A.rapid / A.t).toFixed(2), asidesPerMin: +(A.asides / A.t * 60).toFixed(1), ltThroughStandingS: +A.thru.toFixed(2), asideFor: A.by || {} }; });
      R.aside[deck] = a;
    }
    // aside strip: bridge, 16 frames 0.5 s apart while the Lt walks across the crew
    if (want('aside')) { const st = await ev(() => ({ x: __D.DECKS.bridge.nodes.chair.x, y: __D.DECKS.bridge.nodes.chair.y }));
      await place('bridge', 0.25, 0.55); await adv(2000); await ev(() => __T.sendTo(0.75, 0.42)); await camFix(0.5, 0.48, 1.6);
      for (let i = 0; i < 16; i++) { await adv(500); asideShots.push(await shotAt(`aside-${String(i).padStart(2, '0')}`, 0.5, 0.45, 370, 300)); if (i === 7) await ev(() => __T.sendTo(0.25, 0.55)); }
      montage(asideShots, `${SH}pt09-${TAG}-phone-aside-strip.png`, 8); }

    // ---- 3) standing-on-standing overlaps (< 20 px) over 300 s per deck while the Lt keeps working its stations ----
    R.overlap = {};
    if (want('overlap')) for (const deck of ['bridge', 'engineering', 'berthing', 'lounge']) {
      const nodes = await ev(([deck]) => Object.entries(__D.DECKS[deck].nodes).filter(([k, n]) => n.x != null && !n.lift && !n.lie).map(([k]) => k), [deck]);
      const n0 = await ev(([deck, k]) => { const n = k ? __D.DECKS[deck].nodes[k] : __D.DECKS[deck].lift; return [n.x, n.y]; }, [deck, nodes[0]]);
      await place(deck, n0[0], n0[1]);
      await ev(() => { const O = window.__ov = { run: {}, max: 0, maxPair: null, t: 0, over2s: 0 };
        window.__frame = s => { O.t += s; const L = __T.G.lt, cs = [];
          if (!L.lift && !L.moving) cs.push({ id: 'lt', x: L.x, y: L.y });
          if (L.deck === 'bridge' && !__T.tren.moving) cs.push({ id: 'tren', x: __T.tren.x, y: __T.tren.y });
          for (const n of __T.ambient) if (n.deck === L.deck && n.x !== null && !n.moving) cs.push({ id: n.occId, x: n.x, y: n.y });
          const seen = {};
          for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) { const a = cs[i], b = cs[j], k = a.id + '|' + b.id;
            if (Math.hypot((a.x - b.x) * 960, (a.y - b.y) * 640) < 20) { seen[k] = 1; const r0 = O.run[k] || 0; O.run[k] = r0 + s; if (r0 < 2 && O.run[k] >= 2) O.over2s++; if (O.run[k] > O.max) { O.max = O.run[k]; O.maxPair = k; } } }
          for (const k of Object.keys(O.run)) if (!seen[k]) delete O.run[k]; }; });
      // the Lt alternates: work a station (12 s), then stop on a random floor point (6-12 s), like a player tapping around
      for (let r = 0, t = 0; t < 300; r++) { const k = nodes.length ? nodes[r % nodes.length] : null;
        if (k && r % 2 === 0) { await ev(([k]) => __T.sendUse(k), [k]); await adv(12000, false); t += 12; }
        else { const dur = await ev(() => { __T.sendTo(0.15 + Math.random() * 0.7, 0.2 + Math.random() * 0.65); return 6 + Math.random() * 6; }); await adv(dur * 1000, false); t += dur; } }
      R.overlap[deck] = await ev(() => { window.__frame = null; const O = window.__ov; return { secs: Math.round(O.t), maxStandingOverlapS: +O.max.toFixed(2), pair: O.maxPair, overlapsOver2s: O.over2s }; });
    }

    // ---- 4) T'Ren walks past a Lt standing in her path ----
    // two cases: 'choke' = the Lt stands in the 3-cell port passage (no way round at >= 20 px: she must wait, never walk
    // through), 'open' = the Lt stands on her route across the open bridge floor (she should go round him)
    if (want('tren')) { R.trenPass = {};
      for (const [cs, from, toI] of [['choke', [0.30, 0.55], null], ['open', [0.578, 0.42], 0]]) {
        await place('bridge', 0.5, 0.6); await ev(([fx, fy]) => { const t = __T.tren; t.x = fx; t.y = fy; t.mode = 'home'; t.t = 999; t.path = null; }, from);
        const mid = await ev(async ([cs, toI]) => { const P = await import('/js/path.js'), N = await import('/js/npc.js'); const t = __T.tren;
          const st = toI == null ? __D.TREN.stations.reduce((b, s) => Math.abs(s.x - t.x) > Math.abs(b.x - t.x) ? s : b) : __D.TREN.stations[toI];
          const path = (P.findPath('bridge', t.x, t.y, st.x, st.y) || []).concat([[st.x, st.y]]);
          // sample points along the route; choke = the one ~90 px along, open = the first >= 80 px along with floor all round (+-3 cells)
          const pts = []; let ax = t.x, ay = t.y, along = 0;
          for (const q of path) { const seg = Math.hypot((q[0] - ax) * 960, (q[1] - ay) * 640); for (let k = 1; k <= Math.ceil(seg / 8); k++) { const f = k / Math.ceil(seg / 8); pts.push({ x: ax + (q[0] - ax) * f, y: ay + (q[1] - ay) * f, a: along + seg * f }); } along += seg; ax = q[0]; ay = q[1]; }
          const openAt = p => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (!P.isWalkable('bridge', p.x + dx * 16 / 960, p.y + dy * 16 / 640)) return false; return true; };
          const best = cs === 'choke' ? pts.reduce((b, p) => Math.abs(p.a - 90) < Math.abs(b.a - 90) ? p : b) : (pts.find(p => p.a >= 80 && openAt(p)) || pts[Math.floor(pts.length / 2)]);
          const L = __T.G.lt; L.x = best.x; L.y = best.y; L.dir = 'down'; N.trenTo('station', __D.TREN.stations.indexOf(st)); return { lt: [best.x, best.y], st: [st.x, st.y] }; }, [cs, toI]);
        await camFix(mid.lt[0], mid.lt[1], 1.8);
        await ev(() => { const T = window.__tp = { min: 1e9, over: 0, waitT: 0, t: 0 }; window.__frame = s => { const t = __T.tren, L = __T.G.lt; T.t += s; const d = Math.hypot((t.x - L.x) * 960, (t.y - L.y) * 640); T.min = Math.min(T.min, d); if (d < 12) T.over += s; if (t.mode === 'walk' && !t.moving) T.waitT += s; }; });
        const tShots = [];
        for (let i = 0; i < 16; i++) { await adv(500); tShots.push(await shotAt(`tren-${cs}-${String(i).padStart(2, '0')}`, mid.lt[0], mid.lt[1] - 0.06, 240, 260)); }
        await adv(6000, false);
        R.trenPass[cs] = await ev(() => { window.__frame = null; const T = window.__tp, t = __T.tren; return { minDistPx: +T.min.toFixed(1), overlapS: +T.over.toFixed(2), waitS: +T.waitT.toFixed(2), arrived: t.mode !== 'walk', mode: t.mode }; });
        montage(tShots, `${SH}pt09-${TAG}-phone-tren-${cs}.png`, 8);
      } }

    // ---- 5) head height across turns (side <-> front) and into an action ----
    if (want('turns')) { await place('engineering', 0.30, 0.55, 'right'); await camFix(0.42, 0.55, 1.8);
      await ev(() => { const H = window.__hd = { rows: [] }; window.__frame = null; });
      const legs = [[0.55, 0.55], [0.55, 0.75], [0.35, 0.75], [0.35, 0.55], [0.50, 0.55]];
      const rec = [], hShots = [];
      for (const [i, [x, y]] of legs.entries()) {
        await ev(([x, y]) => __T.sendTo(x, y), [x, y]);
        for (let f = 0; f < 50; f++) { await ev(() => { window.__DL = []; }); await adv(1000 / 30);
          const r = await ev(() => { const L = __T.G.lt; const e = window.__DL.filter(e => e.k === 'lt-v3').pop(); if (!e) return null; const top = window.__top[e.sx + ':' + e.sy]; if (top == null) return null;
            const w = __w2(e, e.dx + e.dw / 2, e.dy + top * e.dh / 384); return { dir: L.dir, mv: L.moving, rel: +(w[1] - L.y * 640).toFixed(2), cell: e.sx + ':' + e.sy }; });
          if (r) rec.push(r); if (f % 10 === 5 && hShots.length < 24) { const q = await ltAt(); hShots.push(await shotAt(`turn-${String(hShots.length).padStart(2, '0')}`, q[0], q[1], 150, 210)); } }
      }
      // then he starts work at a console (front-facing action frames)
      await ev(() => __T.sendUse('core')); for (let f = 0; f < 120; f++) { await ev(() => { window.__DL = []; }); await adv(1000 / 30);
        const r = await ev(() => { const L = __T.G.lt; const e = window.__DL.filter(e => e.k === 'lt-v3').pop(); if (!e) return null; const top = window.__top[e.sx + ':' + e.sy]; if (top == null) return null; const w = __w2(e, e.dx + e.dw / 2, e.dy + top * e.dh / 384); return { dir: L.dir, mv: L.moving, rel: +(w[1] - L.y * 640).toFixed(2), cell: e.sx + ':' + e.sy, act: L.mode }; });
        if (r) rec.push(r); }
      let maxTurn = 0, maxAny = 0; const byDir = {};
      for (let i = 1; i < rec.length; i++) { const j = Math.abs(rec[i].rel - rec[i - 1].rel); maxAny = Math.max(maxAny, j); if (rec[i].dir !== rec[i - 1].dir || rec[i].mv !== rec[i - 1].mv) maxTurn = Math.max(maxTurn, j); }
      for (const r of rec) { const k = (r.dir === 'left' || r.dir === 'right' ? 'side' : 'front') + (r.mv ? '-walk' : '-still'); (byDir[k] = byDir[k] || []).push(r.rel); }
      const avg = a => +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(1);
      R.turns = { frames: rec.length, headJumpOnTurnPx: +maxTurn.toFixed(1), headJumpAnyFramePx: +maxAny.toFixed(1), headAboveFeet: Object.fromEntries(Object.entries(byDir).map(([k, a]) => [k, { mean: avg(a), min: Math.min(...a), max: Math.max(...a) }])) };
      montage(hShots, `${SH}pt09-${TAG}-phone-turn-head.png`, 12); }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(`${SH}pt09-${TAG}${ONLY ? '-' + ONLY.replace(/,/g, '-') : ''}-metrics.json`, JSON.stringify(M, null, 1));
  console.log(JSON.stringify(M, null, 1));
}
run().catch(e => { console.error(e); process.exit(1); });
