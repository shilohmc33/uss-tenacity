// Animation before/after metrics + frame strips (pass 08). Steps the real sim/render at exact 1/60 s ticks (like
// /workspace/anim/cap.js) and logs every sprite draw on the deck canvas, then measures:
//   step length + slide per step, cadence, feet/anchor bob, idle foot drift, action lockstep, lying length +
//   transition, facing flips, re-tap speed, walk-through overlap + equal-y order, floor typing, the Captain's chair.
// Usage: BASE=http://127.0.0.1:8811/ TAG=before node tools/anim-strips.js   (frames -> /workspace/anim-strips/TAG)
// Then python3 tools/anim-strip-sheet.py TAG  -> shots/anim-TAG-<vp>-<scenario>.png
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const TAG = process.env.TAG || 'before';
const OUT = `/workspace/anim-strips/${TAG}/`;
const VPS = { phone: { width: 390, height: 844, dsf: 2, mobile: true }, desk: { width: 1280, height: 800, dsf: 1, mobile: false } };
const vpSel = process.env.VP ? process.env.VP.split(',') : ['phone', 'desk'];
const HOOK = () => {
  window.__DL = []; const P = CanvasRenderingContext2D.prototype, orig = P.drawImage; let pend = null;
  const key = img => { try { const m = (img.src || '').match(/assets\/(.+)\.(webp|png)/); return m ? m[1] : null; } catch (e) { return null; } };
  P.drawImage = function (img, ...a) {
    try {
      const k = img && img.src ? key(img) : null;
      if (k && !/^deck-|^walk-|^bg-|^space|^ship-|^cabin-/.test(k) && a.length === 8) {
        if (this.canvas.id !== 'deck') pend = { k, sx: a[0], sy: a[1], sw: a[2], sh: a[3] };
        else { const T = this.getTransform(); window.__DL.push({ k, sx: a[0], sy: a[1], sw: a[2], sh: a[3], dx: a[4], dy: a[5], dw: a[6], dh: a[7], T: [T.a, T.b, T.c, T.d, T.e, T.f], al: this.globalAlpha }); }
      } else if (k && /^deck-/.test(k) && this.canvas.id === 'deck') { const T = this.getTransform(); window.__CAM = [T.a, T.b, T.c, T.d, T.e, T.f]; }
      else if (pend && img instanceof HTMLCanvasElement && this.canvas.id === 'deck' && a.length === 8) {
        const T = this.getTransform(); window.__DL.push({ ...pend, dx: a[4], dy: a[5], dw: a[6], dh: a[7], T: [T.a, T.b, T.c, T.d, T.e, T.f], al: this.globalAlpha }); pend = null;
      }
    } catch (e) {}
    return orig.call(this, img, ...a);
  };
};
async function run() {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const M = {};
  for (const vpn of vpSel) {
    const v = VPS[vpn], R = M[vpn] = {};
    const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.dsf, isMobile: v.mobile, hasTouch: v.mobile });
    await ctx.addInitScript(() => { window.__TENACITY_SKIP_NAME = true; window.__TENACITY_SKIP_BG = true; window.__TENACITY_NO_IDLE = true; });   // v18: skip the name / Academy prompts; no idle pause in long shot runs
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await ctx.addInitScript(HOOK);
    await p.goto(BASE + '?debug=1&reset=1');
    for (let i = 0; i < 300; i++) { await new Promise(r => setTimeout(r, 100)); if (await p.evaluate(() => !!window.__T && document.querySelector('#loading').classList.contains('done'))) break; }
    await new Promise(r => setTimeout(r, 1200));
    await p.evaluate(async () => {
      const [{ stepSim }, { tickTren }, { tickAmbient }, { drawDeck }, path] = await Promise.all(['/js/sim.js', '/js/npc.js', '/js/npc-ambient.js', '/js/render/deck.js', '/js/path.js'].map(u => import(u)));
      window.__path = path;
      const dctx = document.querySelector('#deck').getContext('2d'); window.__rt = 100; __T.app.paused = true;
      window.__adv = (ms, draw = true) => { const n = Math.round(ms / (1000 / 60)); for (let i = 0; i < n; i++) { const s = 1 / 60; stepSim(s); tickTren(s); tickAmbient(s); window.__rt += s; if (draw && (i % 2 === 1 || n === 1)) drawDeck(dctx, window.__rt, 2 / 60); } };
      window.__noSave = true; document.querySelectorAll('.modal:not(.hidden), .overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
      // world-space anchor of a logged draw (feet for upright frames; centre for rotated/lying ones)
      window.__anchor = (e) => {
        const C = window.__CAM; if (!C) return null; const T = e.T;
        const up = e.sw === 160 && e.sh === 384, lx = e.dx + e.dw * 0.5, ly = e.dy + e.dh * (up ? 376 / 384 : 0.5);
        const sx = T[0] * lx + T[2] * ly + T[4], sy = T[1] * lx + T[3] * ly + T[5];
        const det = C[0] * C[3] - C[1] * C[2]; const ux = sx - C[4], uy = sy - C[5];
        return [(C[3] * ux - C[2] * uy) / det, (-C[1] * ux + C[0] * uy) / det, Math.hypot(T[0], T[1]) / Math.hypot(C[0], C[1])];
      };
      window.__chars = () => { const L = __T.G.lt, t = __T.tren; const a = [{ id: 'lt', x: L.x, y: L.y, dir: L.dir, mv: L.moving, wp: L.walkPhase, mode: L.mode, node: L.node }];
        if (L.deck === 'bridge') a.push({ id: 'tren', x: t.x, y: t.y, dir: t.dir, mv: t.moving, wp: t.walkPhase, act: t.action });
        for (const n of __T.ambient) if (n.deck === L.deck && n.x !== null) a.push({ id: n.occId, x: n.x, y: n.y, dir: n.dir, mv: n.moving, wp: n.walkPhase, act: n.action, who: n.who });
        return a; };
    });
    const ev = (fn, arg) => p.evaluate(fn, arg);
    const adv = (ms, draw) => p.evaluate(([ms, draw]) => { __T.app.paused = true; window.__adv(ms, draw); }, [ms, draw !== false]);
    const place = (deck, x, y, dir = 'down') => ev(([deck, x, y, dir]) => { const L = __T.G.lt; L.lift = null; L.deck = deck; L.x = x; L.y = y; L.mode = 'idle'; L.path = null; L.node = null; L.repairSys = null; L.dir = dir; L.moving = false; L.swingAmp = 0; __T.cam.snap = true; __T.cam.manualT = 0; __T.G.ship.energy = 90; }, [deck, x, y, dir]);
    const camFix = (x, y, zoom) => ev(([x, y, zoom]) => { const c = __T.cam; c.x = x * 960; c.y = y * 640; if (zoom) { c.zoom = zoom; c.scale = c.fit * zoom; } c.manualT = 9999; }, [x, y, zoom]);
    // record n frames at 30 fps: per-frame chars + draws; optional screenshots (every `shotEvery` frames)
    async function rec(name, n, perFrame, shotEvery = 0) {
      const dir = `${OUT}${vpn}/${name}/`; if (shotEvery) fs.mkdirSync(dir, { recursive: true });
      await ev(() => { window.__DL = []; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); });
      const st = [];
      for (let i = 0; i < n; i++) {
        if (perFrame) await perFrame(i);
        await adv(1000 / 30);
        const f = await ev(() => { const dl = window.__DL.splice(0); return { ch: __chars(), dl: dl.map(e => ({ ...e, A: __anchor(e) })), cam: { x: __T.cam.x, y: __T.cam.y, s: __T.cam.scale, w: __T.cam.w, h: __T.cam.h, r: (r => [r.left, r.top])(document.querySelector('#deck').getBoundingClientRect()) } }; });
        st.push(f);
        if (shotEvery && i % shotEvery === 0) await p.screenshot({ path: `${dir}f${String(i).padStart(3, '0')}.png` });
      }
      if (shotEvery) fs.writeFileSync(`${dir}log.json`, JSON.stringify(st));
      return st;
    }
    // the draw that belongs to character c in frame f (nearest anchor, upright frames)
    const drawOf = (f, c, maxd = 10) => { let best = null, bd = maxd; for (const e of f.dl) { if (!e.A || isLie(e)) continue; const d = Math.hypot(e.A[0] - c.x * 960, e.A[1] - c.y * 640); if (d < bd) { bd = d; best = e; } } return best; };
    const isLie = e => e.k === 'crew-atlas' || /lie/.test(e.k) || !(e.sw === 160 && e.sh === 384);
    const fid = e => e ? `${e.k}:${e.sx}:${e.sy}` : null;
    // walking metrics for one character over a log
    function walkStats(st, id) {
      const by = {}; let prev = null;
      for (const f of st) { const c = f.ch.find(c => c.id === id); if (!c) { prev = null; continue; }
        if (prev && c.mv && prev.mv) { const d = Math.hypot((c.x - prev.x) * 960, (c.y - prev.y) * 640), dp = c.wp - prev.wp; const k = c.dir === 'left' || c.dir === 'right' ? 'side' : c.dir;
          const b = by[k] = by[k] || { dist: 0, ph: 0, t: 0, bob: [], frames: new Set() }; if (dp > 0) { b.dist += d; b.ph += dp; b.t += 1 / 30; }
          const e = drawOf(f, c); if (e) { b.bob.push(e.A[1] - c.y * 640); b.frames.add(fid(e)); } }
        prev = c; }
      const out = {}; for (const [k, b] of Object.entries(by)) { if (b.ph <= 0) continue; const step = b.dist / (b.ph / Math.PI);
        out[k] = { stepPx: +step.toFixed(1), speedPx: +(b.dist / b.t).toFixed(1), stepsPerS: +((b.ph / Math.PI) / b.t).toFixed(2), anchorBob: b.bob.length ? [+Math.min(...b.bob).toFixed(2), +Math.max(...b.bob).toFixed(2)] : null, frames: b.frames.size }; }
      return out;
    }
    const dirChanges = (st, id) => { const d = st.map(f => (f.ch.find(c => c.id === id) || {}).dir); let n = 0; for (let i = 1; i < d.length; i++) if (d[i] !== d[i - 1]) n++; return { changes: n, seq: d.map(x => x ? x[0] : '-').join('') }; };
    // ---------- 1 walks (fixed camera) ----------
    await place('engineering', 0.30, 0.66, 'right'); await camFix(0.45, 0.58); await adv(300);
    let s = await rec('walk-right', 60, async i => { if (i === 0) await ev(() => __T.sendTo(0.62, 0.66)); }, 2);
    R.ltWalkRight = walkStats(s, 'lt'); R.ltWalkRightDir = dirChanges(s, 'lt');
    await place('engineering', 0.50, 0.42, 'down'); await camFix(0.50, 0.55); await adv(300);
    s = await rec('walk-down', 60, async i => { if (i === 0) await ev(() => __T.sendTo(0.50, 0.80)); }, 2);
    R.ltWalkDown = walkStats(s, 'lt'); R.ltWalkDownDir = dirChanges(s, 'lt');
    await place('engineering', 0.50, 0.80, 'up'); await camFix(0.50, 0.55); await adv(300);
    s = await rec('walk-up', 60, async i => { if (i === 0) await ev(() => __T.sendTo(0.50, 0.42)); });
    R.ltWalkUp = walkStats(s, 'lt'); R.ltWalkUpDir = dirChanges(s, 'lt');
    // stop: frames from arrival to the idle frame
    await place('engineering', 0.40, 0.66, 'right'); await camFix(0.45, 0.62); await adv(300);
    s = await rec('startstop', 80, async i => { if (i === 3) await ev(() => __T.sendTo(0.50, 0.66)); });
    { let arr = -1, idleAt = -1, t0 = -1; s.forEach((f, i) => { const c = f.ch[0]; if (c.mv && t0 < 0) t0 = i; if (t0 >= 0 && !c.mv && arr < 0) arr = i; });
      const idleK = fid(drawOf(s[s.length - 1], s[s.length - 1].ch[0]));
      if (arr >= 0) for (let i = arr; i < s.length; i++) if (fid(drawOf(s[i], s[i].ch[0])) === idleK) { idleAt = i; break; }
      R.startStop = { hop96pxS: arr > 0 ? +((arr - t0) / 30).toFixed(2) : null, arriveToIdleMs: idleAt >= 0 ? Math.round((idleAt - arr) * 1000 / 30) : null }; }
    // re-tap mid-walk: speed before vs right after the new order
    await place('engineering', 0.40, 0.66, 'right'); await camFix(0.45, 0.62); await adv(300);
    s = await rec('reverse', 45, async i => { if (i === 0) await ev(() => __T.sendTo(0.58, 0.66)); if (i === 18) await ev(() => __T.sendTo(0.32, 0.66)); });
    { const sp = s.map((f, i) => i ? Math.hypot((f.ch[0].x - s[i - 1].ch[0].x) * 960, (f.ch[0].y - s[i - 1].ch[0].y) * 640) * 30 : 0);
      R.reTap = { speedBefore: +sp[17].toFixed(1), minAfter: +Math.min(...sp.slice(19, 30)).toFixed(1), dir: dirChanges(s, 'lt') }; }
    // diagonal (facing flips)
    await place('engineering', 0.30, 0.45, 'right'); await camFix(0.45, 0.58); await adv(300);
    s = await rec('diagonal', 75, async i => { if (i === 0) await ev(() => __T.sendTo(0.62, 0.82)); });
    R.diagonalDir = dirChanges(s, 'lt');
    // level speed bonus: same walk at the top walk multiplier
    await ev(() => { window.__lv0 = __T.G.prog.level; __T.G.prog.level = 40; });
    await place('engineering', 0.30, 0.66, 'right'); await camFix(0.45, 0.58); await adv(300);
    s = await rec('walk-right-fast', 45, async i => { if (i === 0) await ev(() => __T.sendTo(0.62, 0.66)); });
    R.ltWalkRightTopLevel = walkStats(s, 'lt'); R.walkMultTop = await ev(async () => (await import('/js/progression.js')).walkMult());
    await ev(() => { __T.G.prog.level = window.__lv0; });
    // ---------- 2 idle: feet drift ----------
    await place('engineering', 0.45, 0.66, 'down'); await adv(1500);
    s = await rec('idle', 60);
    { const xs = [], ys = []; s.forEach(f => { const e = drawOf(f, f.ch[0]); if (e) { xs.push(e.A[0] - f.ch[0].x * 960); ys.push(e.A[1] - f.ch[0].y * 640); } });
      R.idleFeet = { x: [+Math.min(...xs).toFixed(2), +Math.max(...xs).toFixed(2)], y: [+Math.min(...ys).toFixed(2), +Math.max(...ys).toFixed(2)] }; }
    // ---------- 3 T'Ren + ambient walks ----------
    await place('bridge', 0.49, 0.22, 'down'); await adv(500); await camFix(0.5, 0.45);
    s = await rec('tren-walk', 90, async i => { if (i === 0) await ev(() => __T.trenTo('station', 1)); }, 3);
    let tw = walkStats(s, 'tren');
    await adv(3000); s = await rec('tren-walk2', 90, async i => { if (i === 0) await ev(() => __T.trenTo('station', 2)); });
    const tw2 = walkStats(s, 'tren'); for (const k in tw2) if (!tw[k]) tw[k] = tw2[k];
    await adv(3000); s = await rec('tren-walk3', 120, async i => { if (i === 0) await ev(() => __T.trenTo('home')); });
    const tw3 = walkStats(s, 'tren'); for (const k in tw3) if (!tw[k]) tw[k] = tw3[k];
    R.trenWalk = tw;
    await place('engineering', 0.45, 0.66, 'down'); await adv(2000); await camFix(0.45, 0.5, 1.2);
    await ev(() => { const n = __T.ambient.find(a => a.occId === 'kovac'); if (n && n.cfg.spots.length > 1) __T.ambientTo('kovac', n.cfg.spots[(n.cfg.spots.indexOf(n.spot) + 1) % n.cfg.spots.length].id); });
    s = await rec('crew-walk', 90, null, 3);
    R.crewWalk = walkStats(s, 'kovac');
    // ---------- 4 lockstep: everyone working in engineering + bridge for 10 s ----------
    const lock = {};
    for (const [deck, x, y] of [['engineering', 0.45, 0.66], ['bridge', 0.49, 0.22], ['medical', 0.42, 0.6]]) {
      await place(deck, x, y, 'down'); await adv(20000, false); await camFix(0.5, 0.5, 1);
      s = await rec('lock-' + deck, 300);
      const seq = {}; s.forEach(f => f.ch.forEach(c => { if (c.id === 'lt' || !c.act || c.mv) return; const e = drawOf(f, c, 12); (seq[c.id] = seq[c.id] || []).push(e ? e.sy % 1152 : -1); }));
      const ids = Object.keys(seq).filter(k => seq[k].length >= 280), pairs = [];
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        const a = seq[ids[i]], b = seq[ids[j]]; let same = 0, chg = 0;
        for (let t = 1; t < Math.min(a.length, b.length); t++) { const ca = a[t] !== a[t - 1], cb = b[t] !== b[t - 1]; if (ca || cb) { chg++; if (ca && cb && a[t] === b[t]) same++; } }
        pairs.push({ a: ids[i], b: ids[j], lockstepPct: chg ? Math.round(100 * same / chg) : 0 });
      }
      const intervals = ids.map(k => { const a = seq[k], iv = []; let last = 0; for (let t = 1; t < a.length; t++) if (a[t] !== a[t - 1]) { iv.push(t - last); last = t; } return iv; }).flat();
      lock[deck] = { actors: ids.length, maxLockstepPct: pairs.length ? Math.max(...pairs.map(p => p.lockstepPct)) : 0, pairsOver50: pairs.filter(p => p.lockstepPct > 50).length, pairs: pairs.length,
        frameHoldMs: intervals.length ? [Math.round(Math.min(...intervals) * 33.3), Math.round(Math.max(...intervals) * 33.3)] : null };
    }
    R.lockstep = lock;
    // ---------- 5 lying: biobed + bunk, length + transition ----------
    const lieStat = (st, lp) => { let both = 0, fadeFr = 0, len = new Set(), firstLie = -1, lastStand = -1;
      st.forEach((f, i) => { const lie = f.dl.filter(e => e.A && isLie(e) && Math.hypot(e.A[0] - lp[0] * 960, e.A[1] - lp[1] * 640) < 30);
        const stand = drawOf(f, f.ch[0], 14); if (lie.length && firstLie < 0) firstLie = i; if (stand) lastStand = i; if (lie.length && stand) both++;
        if ([...lie, stand].some(e => e && e.al < 0.99)) fadeFr++;
        lie.forEach(e => len.add(Math.round((e.k === 'crew-atlas' ? e.dh : e.dw * 0.62) * e.A[2]))); });
      return { overlapFrames: both, fadeFrames: fadeFr, fadeMs: Math.round(fadeFr * 33.3), lyingLenPx: [...len] }; };
    await place('medical', 0.42, 0.55, 'left'); await ev(() => { __T.G.prog.med = __T.G.prog.med || {}; __T.G.prog.med.inj = [{ id: 'kovac', short: 'Kovac', state: 'stable', sev: 'serious', sys: 'eps', left: 0 }]; }); await adv(300); await camFix(0.3, 0.45, 1.3);
    s = await rec('biobed-liedown', 120, async i => { if (i === 0) await ev(() => __T.sendUse('biobed')); }, 2);
    R.biobedDown = lieStat(s, [0.205, 0.433]);
    s = await rec('biobed-getup', 45, async i => { if (i === 10) await ev(() => __T.sendTo(0.42, 0.6)); }, 2);
    R.biobedUp = lieStat(s, [0.205, 0.433]);
    { const pat = s[0].dl.filter(e => e.A && isLie(e) && Math.abs(e.A[0] - 0.205 * 960) < 30 && Math.abs(e.A[1] - 0.556 * 640) < 30).map(e => Math.round((e.k === 'crew-atlas' ? e.dh : e.dw * 0.62) * e.A[2])); R.patientLenPx = [...new Set(pat)]; }
    await ev(() => { __T.G.prog.med.inj = []; });
    await place('berthing', 0.70, 0.30, 'right'); await adv(300); await camFix(0.78, 0.25, 1.3);
    s = await rec('bunk-liedown', 120, async i => { if (i === 0) await ev(() => __T.sendUse('bunk')); }, 2);
    R.bunkDown = lieStat(s, [0.80, 0.162]);
    // ---------- 6 overlap: the Lt walks through a standing crewmate at equal y ----------
    await place('engineering', 0.45, 0.66, 'down'); await adv(1500, false);
    const ov = await ev(() => { const n = __T.ambient.find(a => a.deck === 'engineering' && a.x !== null); if (!n) return null; n.mode = 'dwell'; n.t = 999; n.path = null; n.x = 0.50; n.y = 0.7125; n.spot = { id: 'test', face: 'down', action: null, t: [999, 999] }; return n.occId; });
    await place('engineering', 0.34, 0.7125, 'right'); await camFix(0.5, 0.62, 1.2);
    s = await rec('overlap', 60, async i => { if (i === 0) await ev(() => __T.sendTo(0.66, 0.7125)); }, 3);
    { let minD = 1e9, close = 0, flips = 0, lastOrd = null; s.forEach(f => { const L = f.ch[0], n = f.ch.find(c => c.id === ov); if (!n) return; const d = Math.hypot((L.x - n.x) * 960, (L.y - n.y) * 640); minD = Math.min(minD, d); if (d < 24) close++;
        const iL = f.dl.findIndex(e => e === drawOf(f, L)), iN = f.dl.findIndex(e => e === drawOf(f, n)); if (iL >= 0 && iN >= 0) { const o = iL < iN; if (lastOrd !== null && o !== lastOrd && d < 40) flips++; lastOrd = o; } });
      R.overlap = { npc: ov, minDistPx: +minD.toFixed(1), framesWithin24px: close, orderFlipsWhileClose: flips }; }
    // equal-y order: same y, Lt left vs right of the crewmate -> who is drawn on top
    const ord = [];
    for (const lx of [0.46, 0.54]) { await place('engineering', lx, 0.7125, 'down'); await ev(([id]) => { const n = __T.ambient.find(a => a.occId === id); n.x = 0.50; n.y = 0.7125; n.mode = 'dwell'; n.t = 999; }, [ov]); s = await rec('eqy', 2);
      const f = s[1], L = f.ch[0], n = f.ch.find(c => c.id === ov); const iL = f.dl.indexOf(drawOf(f, L)), iN = f.dl.indexOf(drawOf(f, n)); ord.push(iL > iN ? 'lt-on-top' : 'npc-on-top'); }
    R.equalY = { ltLeft: ord[0], ltRight: ord[1], deterministicByX: ord[0] !== ord[1] };
    // ---------- 7 floor typing: crew in a 'computer' loop with no blocked cell (console) within 34 px ahead ----------
    const typing = {};
    for (const [deck, x, y] of [['bridge', 0.49, 0.22], ['engineering', 0.45, 0.66], ['medical', 0.42, 0.6], ['lounge', 0.40, 0.55], ['berthing', 0.55, 0.45]]) {
      await place(deck, x, y, 'down');
      const res = { comp: 0, floor: 0, who: [] };
      for (let k = 0; k < 6; k++) { await adv(15000, false);
        const r = await ev(() => { const out = []; const P = window.__path; const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
          for (const n of __T.ambient) { if (n.deck !== __T.G.lt.deck || n.x === null || n.mode !== 'dwell' || n.action !== 'computer') continue; const d = D[n.dir] || [0, 1];
            let blocked = false; for (const r of [10, 18, 26, 34]) if (!P.isWalkable(n.deck, n.x + d[0] * r / 960, n.y + d[1] * r / 640)) blocked = true;
            out.push({ id: n.occId, spot: n.spot && n.spot.id, blocked }); } return out; });
        for (const o of r) { res.comp++; if (!o.blocked) { res.floor++; res.who.push(o.spot); } } }
      res.who = [...new Set(res.who)]; typing[deck] = res;
    }
    R.floorTyping = typing;
    // ---------- 8 the Captain's chair ----------
    await place('bridge', 0.45, 0.45, 'up'); await adv(300); await ev(() => __T.sendUse('chair')); await adv(6000); await camFix(0.5, 0.42, 1.2);
    s = await rec('chair', 30, null, 10);
    { const f = s[s.length - 1], L = f.ch[0], e = drawOf(f, L, 20); const P = await ev(([x, y, dir]) => { const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir]; let b = false; for (const r of [10, 18, 26, 34]) if (!window.__path.isWalkable('bridge', x + D[0] * r / 960, y + D[1] * r / 640)) b = true; return b; }, [L.x, L.y, L.dir]);
      R.chair = { node: L.node, mode: L.mode, at: [+L.x.toFixed(3), +L.y.toFixed(3)], dir: L.dir, frame: fid(e), sheetRow: e ? Math.floor(e.sy / 384) : null, consoleAhead: P }; }
    R.errors = errs;
    console.log(vpn, 'errors', errs.length);
    await ctx.close();
  }
  fs.mkdirSync('/workspace/tenacity/shots', { recursive: true });
  fs.writeFileSync(require('path').resolve(__dirname, '..', 'shots', `anim-${TAG}-metrics.json`), JSON.stringify(M, null, 1));
  console.log(JSON.stringify(M.desk || M.phone, null, 0));
  await browser.close();
}
run().catch(e => { console.error(e); process.exit(1); });
