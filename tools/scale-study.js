// Scale study (Shiloh: background art vs character sprites). MEASURES the painted plates against the standing figure
// (FIG_H 134 design px) and MOCKS UP two fixes without changing the game's committed scale:
//   A = characters drawn at f x (room unchanged)            -> URL flag ?scaleA=f
//   B = room zoomed 1/f x, characters at f (same screen size) -> URL flag ?scaleB=1/f
// The flags only exist on the scratch worktree (branch scratch/scale-mock, js/render/deck.js); master has no flag.
// Usage: MOCK=http://127.0.0.1:8841/ [MAIN=http://127.0.0.1:8765/] [F=0.62] node tools/scale-study.js
// Out: shots/scale-measure-<deck>.png (measured boxes + a figure bar on the plate), shots/scale-<deck>-<vp>.png
//      (reference art | current scale v2 | A | B), shots/scale-sharp-<deck>.png (phone dpr3 crops around the Lt: 160x384 vs hi-res at B and A size, B with nearest plate),
//      shots/scale-report.json (+ shots/scale-report.md, written by hand from it)
const L = require('/workspace/playtest-scripts/lib.js');
const { execFileSync } = require('child_process');
const fs = require('fs');
const MOCK = process.env.MOCK || 'http://127.0.0.1:8841/', MAIN = process.env.MAIN || 'http://127.0.0.1:8765/';
const OUT = '/workspace/tenacity/shots/', TMP = '/tmp/scale-study/'; fs.mkdirSync(TMP, { recursive: true });
const FIG_H = 134, F = +process.env.F || 0.62;
// Hand measurements in design px (960x640 plate = half the 1920x1280 art), read off 2x art crops with a 10 px grid.
// box = [x0, y0, x1, y1] of the measured span; h = the measured vertical span (door: clear opening, threshold to head
// of the opening; console/desk: front face; furniture: top to floor), len = horizontal length (beds, torpedo).
// Person target per kind (real-world ratio): door 0.825 x opening; console front face x2 (person ~2x console);
// desk 2.37x; counter/table 1.7x; stool 2.37x; chair 1.8x; full-height locker 0.99x; bed: lying body <= 0.92 x
// mattress length; torpedo casing 2.1 m vs person 1.78 m (0.85x). axis 'v' = vertical span (foreshortened by the
// plate's camera tilt), 'h' = floor-plane length (not foreshortened).
const T = { door: [0.825, 'v'], console: [2, 'v'], desk: [2.37, 'v'], counter: [1.7, 'v'], table: [1.7, 'v'], stool: [2.37, 'v'], chair: [1.8, 'v'], locker: [0.99, 'v'], bed: [0.92, 'h'], torpedo: [0.85, 'h'] };
const MEAS = {
  engineering: [
    { kind: 'door', what: 'turbolift door (clear opening)', box: [790, 490, 865, 552], h: 62, w: 75, primary: true },
    { kind: 'locker', what: 'parts lockers (full height)', box: [220, 515, 330, 588], h: 73 },
    { kind: 'console', what: 'core-ring console front face', box: [270, 330, 310, 348], h: 18, note: '46 incl. the sloped top (f 0.69, upper bound)' },
    { kind: 'torpedo', what: 'torpedo casing length', box: [790, 420, 890, 450], len: 100 },
  ],
  lounge: [
    { kind: 'door', what: 'turbolift door (clear opening)', box: [92, 321, 189, 405], h: 84, w: 97, primary: true },
    { kind: 'counter', what: 'bar counter (lip to floor)', box: [380, 149, 520, 189], h: 40 },
    { kind: 'table', what: 'high-top table (top to base)', box: [352, 268, 406, 306], h: 38 },
    { kind: 'stool', what: 'bar stool', box: [392, 172, 412, 210], h: 38 },
  ],
  berthing: [
    { kind: 'door', what: 'cabin door (clear opening)', box: [80, 196, 128, 243], h: 47, w: 48, primary: true },
    { kind: 'door', what: 'turbolift door (leaves)', box: [530, 499, 647, 552], h: 53, w: 117 },
    { kind: 'bed', what: 'bunk mattress (crew cabins)', box: [50, 50, 135, 90], len: 85 },
    { kind: 'bed', what: 'double bed at the bunk node (lieLen 96)', box: [792, 68, 888, 125], len: 96 },
  ],
  bridge: [
    { kind: 'door', what: 'rear door (clear opening)', box: [437, 16, 516, 106], h: 90, w: 79, primary: true },
    { kind: 'chair', what: 'starboard station chair', box: [730, 202, 760, 249], h: 47 },
  ],
  medical: [
    { kind: 'door', what: 'aft door (clear opening)', box: [291, 72, 350, 144], h: 72, w: 59, primary: true },
    { kind: 'door', what: 'turbolift door (leaves, front wall)', box: [432, 517, 520, 566], h: 49, w: 88 },
    { kind: 'bed', what: 'biobed mattress (lieLen 150 incl. frame)', box: [177, 150, 280, 190], len: 103 },
    { kind: 'desk', what: 'CMO desk front face', box: [578, 134, 672, 159], h: 25 },
    { kind: 'chair', what: 'CMO office chair', box: [605, 132, 640, 185], h: 53 },
  ],
};
const factorOf = m => T[m.kind][0] * (m.len || m.h) / FIG_H;
const DECKS = Object.keys(MEAS);
const STAND = { engineering: [0.86, 0.875], lounge: [0.145, 0.6625], berthing: [0.555, 0.89], bridge: [0.49, 0.1625], medical: [0.51, 0.7625] };
const VPS = { phone: { w: 390, h: 844, m: true, tag: '390x844' }, desk: { w: 1280, h: 800, m: false, tag: '1280x800' } };
const issues = [];
async function page(b, vp) {
  const v = VPS[vp]; const ctx = await b.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: v.m ? 3 : 1, isMobile: v.m, hasTouch: v.m });
  const p = await ctx.newPage();
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) issues.push(`[${vp}] console.${m.type()}: ${m.text()}`); });
  p.on('pageerror', e => issues.push(`[${vp}] pageerror: ${e.message}`));
  p.on('response', r => { if (r.status() >= 400) issues.push(`[${vp}] HTTP ${r.status()}: ${r.url()}`); });
  return { ctx, p };
}
async function boot(p, url) {
  await p.goto(url); await L.waitFor(p, () => !!window.__T && document.querySelector('#loading').classList.contains('done')); await L.sleep(700);
  await p.evaluate(() => { window.__noSave = true; document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); });
}
async function place(p, deck) {
  const [x, y] = STAND[deck];
  return p.evaluate(async ([deck, x, y]) => { const L = __T.G.lt; L.deck = deck; L.lift = null; L.x = x; L.y = y; L.mode = 'idle'; L.path = null; L.dir = 'right'; L.moving = false;
    __T.cam.snap = true; __T.cam.manualT = 0; await new Promise(r => setTimeout(r, 900)); const c = __T.cam, M = (await import('/js/render/deck.js')).MOCK || { SA: 1, SB: 1 };
    return { scale: +c.scale.toFixed(4), SA: M.SA, SB: M.SB, figPx: +(134 * M.SA * c.scale).toFixed(1), visW: +(c.w / c.scale / 960).toFixed(3), visH: +(c.h / c.scale / 640).toFixed(3) }; }, [deck, x, y]);
}
const ltClip = p => p.evaluate(() => { const c = __T.cam, r = document.querySelector('#deck').getBoundingClientRect(), L = __T.G.lt; const sx = r.left + c.w / 2 + (L.x * 960 - c.x) * c.scale, sy = r.top + c.h / 2 + (L.y * 640 - c.y) * c.scale; return { x: Math.max(0, sx - 80), y: Math.max(0, sy - 170), width: 160, height: 190 }; });
const py = code => execFileSync('python3', ['-c', code], { stdio: ['ignore', 'pipe', 'inherit'] }).toString();
(async () => {
  const b = await L.launch(); const rep = { F, FIG_H, rooms: {}, live: {}, shots: [] };
  // 1) measurement overlays on the plates (main tree, unmodified)
  { const { ctx, p } = await page(b, 'desk'); await boot(p, MAIN + '?debug=1&reset=1');
    for (const d of DECKS) {
      const url = await p.evaluate(async ([d, meas, fig]) => { const A = await import('/js/assets.js'), D = await import('/js/data.js'); const im = A.IMG[D.DECKS[d].plate];
        const c = document.createElement('canvas'), k = 1.5; c.width = 960 * k; c.height = 640 * k; const x = c.getContext('2d'); x.drawImage(im, 0, 0, c.width, c.height); x.scale(k, k);
        x.font = 'bold 11px sans-serif'; x.lineWidth = 1.5;
        meas.forEach((m, i) => { const [x0, y0, x1, y1] = m.box; x.strokeStyle = m.kind === 'door' ? '#ff3df0' : m.kind === 'bed' || m.kind === 'torpedo' ? '#3dff7a' : '#ffd23d'; x.strokeRect(x0, y0, x1 - x0, y1 - y0);
          x.fillStyle = 'rgba(0,0,0,.7)'; const t = `${i + 1} ${m.kind} ${m.h ? 'h ' + m.h : 'len ' + m.len}`; x.fillRect(x0, y0 - 13, x.measureText(t).width + 6, 13); x.fillStyle = '#fff'; x.fillText(t, x0 + 3, y0 - 3); });
        const dr = meas.find(m => m.primary), bx = Math.min(dr.box[2] + 6, 780), by = dr.box[3];   // the standing figure (FIG_H) as a bar beside the reference door
        x.fillStyle = 'rgba(80,200,255,.8)'; x.fillRect(bx, by - fig, 10, fig); x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(bx + 12, by - 0.825 * dr.h, 10, 0.825 * dr.h);
        x.fillStyle = 'rgba(0,0,0,.75)'; x.fillRect(bx, by + 2, 170, 26); x.fillStyle = '#7fe0ff'; x.fillText(`figure now ${fig}`, bx + 3, by + 13); x.fillStyle = '#fff'; x.fillText(`door target ${Math.round(0.825 * dr.h)} (0.825 x door)`, bx + 3, by + 25);
        return c.toDataURL('image/png'); }, [d, MEAS[d], FIG_H]);
      const f = `${OUT}scale-measure-${d}.png`; fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); py(`from PIL import Image\nim=Image.open('${f}').convert('RGB'); im.quantize(256, method=Image.Quantize.MEDIANCUT).save('${f}', optimize=True)`); rep.shots.push(f);
    }
    await ctx.close(); }
  // 2) factors
  const med = a => { const s = a.map(r => r.f).sort((x, y) => x - y); return s.length ? +(s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2).toFixed(2) : null; };
  for (const d of DECKS) {
    const rows = MEAS[d].map(m => ({ ...m, axis: T[m.kind][1], target: T[m.kind][0], f: +factorOf(m).toFixed(2) }));
    const door = rows.find(r => r.primary), doors = rows.filter(r => r.kind === 'door'), cross = rows.filter(r => r.kind !== 'door');
    rep.rooms[d] = { rows, doorF: door.f, doorRange: [Math.min(...doors.map(r => r.f)), Math.max(...doors.map(r => r.f))], crossF: med(cross), floorF: med(rows.filter(r => r.axis === 'h')), vertF: med(rows.filter(r => r.axis === 'v')) };
  }
  rep.quarters = 'placeholder plate (cabin-ph-*, procedural boxes in js/cabin.js; racks sized to LIE_FIG 138): no painted art to measure; matches the current figure by construction';
  // 3) mockups: current | A | B per deck and viewport (scratch worktree; current = no flag = the master code path)
  // v2 walk art (assets/walk_v2, scratch-only wiring): art0 = today's art at today's scale (reference); cur = v2 frames at
  // today's scale; A / B = v2 frames drawn from the hi-res masters (canvas downscale); *160 = the same from the 160x384 cells.
  const B_ = (1 / F).toFixed(3);
  const variants = [['art0', ''], ['cur', '&walkv2=1'], ['A', `&walkv2=1&hires=1&scaleA=${F}`], ['B', `&walkv2=1&hires=1&scaleB=${B_}`],
    ['A160', `&walkv2=1&scaleA=${F}`], ['B160', `&walkv2=1&scaleB=${B_}`], ['Bn', `&walkv2=1&hires=1&scaleB=${B_}&nearest=1`]];
  const COMP = ['art0', 'cur', 'A', 'B'], SHARP = ['B160', 'B', 'A160', 'A', 'Bn'];
  for (const vp of Object.keys(VPS)) {
    for (const [vn, q] of variants) {
      if (vp === 'desk' && !COMP.includes(vn)) continue;
      const { ctx, p } = await page(b, vp); await boot(p, MOCK + '?debug=1&reset=1' + q);
      await L.waitFor(p, async () => { const M = (await import('/js/render/deck.js')).MOCK; return !M || M.ready; });
      for (const d of DECKS) {
        const live = await place(p, d); rep.live[`${vp}-${d}-${vn}`] = live;
        if (COMP.includes(vn)) await p.locator('#deck').screenshot({ path: `${TMP}${d}-${vp}-${vn}.png` });
        if (vp === 'phone' && SHARP.includes(vn)) await p.screenshot({ path: `${TMP}${d}-sharp-${vn}.png`, clip: await ltClip(p) });
      }
      await ctx.close();
    }
    for (const d of DECKS) {
      const f = `${OUT}scale-${d}-${VPS[vp].tag}.png`; rep.shots.push(f);
      py(`
from PIL import Image, ImageDraw
ims=[Image.open('${TMP}${d}-${vp}-%s.png'%v).convert('RGB') for v in ${JSON.stringify(COMP)}]
sc=${vp === 'phone' ? '1/3' : '0.5'}; ims=[i.resize((round(i.width*sc),round(i.height*sc)),Image.LANCZOS) for i in ims]
W=sum(i.width for i in ims)+30; H=max(i.height for i in ims)+24; c=Image.new('RGB',(W,H),(12,14,20)); d=ImageDraw.Draw(c); x=0
for i,t in zip(ims,['REFERENCE: current art + scale','CURRENT scale, walk_v2 (figure ${FIG_H})','A: characters x${F} (figure ${Math.round(FIG_H * F)}), v2 hi-res','B: room x${(1 / F).toFixed(2)}, chars same size, v2 hi-res']):
    c.paste(i,(x,24)); d.text((x+4,6),t,fill=(255,210,90)); x+=i.width+10
c.save('${f}')`);
    }
  }
  for (const d of DECKS) {
    const f = `${OUT}scale-sharp-${d}.png`; rep.shots.push(f);
    py(`
from PIL import Image, ImageDraw
ims=[Image.open('${TMP}${d}-sharp-%s.png'%v).convert('RGB') for v in ${JSON.stringify(SHARP)}]
W=sum(i.width for i in ims)+40; H=max(i.height for i in ims)+24; c=Image.new('RGB',(W,H),(12,14,20)); d=ImageDraw.Draw(c); x=0
for i,t in zip(ims,['B/current size: 160x384 upscaled','B/current size: hi-res downscaled','A size: 160x384','A size: hi-res downscaled','B hi-res, plate nearest']):
    c.paste(i,(x,24)); d.text((x+4,6),t,fill=(255,210,90)); x+=i.width+10
c.save('${f}')`);
  }
  rep.sharpEdge = JSON.parse(py(`
from PIL import Image, ImageFilter, ImageStat
import json
o={}
for d in ${JSON.stringify(DECKS)}:
  o[d]={v: round(ImageStat.Stat(Image.open('${TMP}%s-sharp-%s.png'%(d,v)).convert('L').filter(ImageFilter.FIND_EDGES)).mean[0],2) for v in ${JSON.stringify(SHARP)}}
print(json.dumps(o))`));
  rep.issues = issues;
  fs.writeFileSync(`${OUT}scale-report.json`, JSON.stringify(rep, null, 1));
  console.log(JSON.stringify({ rooms: Object.fromEntries(Object.entries(rep.rooms).map(([d, r]) => [d, { doorF: r.doorF, doorRange: r.doorRange, crossF: r.crossF, floorF: r.floorF, vertF: r.vertF }])), live: rep.live, issues }, null, 0));
  console.log(issues.length ? 'SCALE STUDY: CONSOLE ISSUES ' + issues.length : 'SCALE STUDY OK', rep.shots.length, 'shots');
  await b.close(); process.exit(issues.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
