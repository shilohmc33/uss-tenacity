// Pass 11 HOLD 1 (+ HOLD 2): "no romantic text with the setting off" (and none in the quiet period after a death).
// 1. STATIC: the romance entry points keep their gates (romance.js letters / signals / dates; plog journal + "what moved it"
//    filters; hud letters, memorial paragraph and badge), and every romance journal kind in plog.js is in ROM_KINDS.
// 2. DYNAMIC (browser, BASE default http://127.0.0.1:8765/): with romance OFF, run 60 play days with every crewmate at
//    opinion 75 and daily chats / dinners, in four states - never allowed (opt null), refused (opt false), turned off with a
//    partner aboard, turned off with a letter thread open (partner transferred, one letter waiting) - and scan every new log
//    line, toast, journal line, "what moved it" line and the rendered Personal Log index + crew/alumni pages for romantic text.
//    One neutral "lost touch" line is expected when a letter thread is closed. QUIET: a letter due in the 600 s quiet period
//    after a death is deferred (no letter, toast or log) and arrives once the gate opens.
// Pass 12: the rendered SHIP log (whole history) is scanned too; off_history (full romance history then OFF, legacy untagged lines);
// m3_m4 (endIt clears a stale disclosure + counts the ending; the auto-protection notice only for a former AUTO favourite, never
// for a hand-pinned partner - pass 13 minor); off_deadpartner (pass 13: a dead partner keeps a plain death journal entry with romance off);
// off_transferredpartner (pass 14: a transferred partner keeps the plain transfer entry with romance off); off_build09 (pass 15: a real
// build09 save that wrote both death entries for a lost partner shows ONE, romance on or off).
// Usage: NODE_PATH=/workspace/pwtools/node_modules node tools/romance-scan.js   (exit 1 on failure; STATIC=1 skips the browser)
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'js'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const bad = [], rom = rd('romance.js'), plog = rd('plog.js'), hud = rd('ui/hud.js');
const body = (src, name) => { const i = src.search(new RegExp(`(export )?function ${name}\\(`)); if (i < 0) return null; let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return null; };
const need = (what, ok) => { if (!ok) bad.push(`static: ${what}`); };
need('letterArrives returns unless enabled()', /if \(!enabled\(\)\) return/.test(body(rom, 'letterArrives') || ''));
need('letterArrives defers while !cheerful()', /!cheerful\(\)/.test(body(rom, 'letterArrives') || ''));
need('replyLetter returns unless enabled()', /if \(!enabled\(\)\) return/.test(body(rom, 'replyLetter') || ''));
need('letterState null unless enabled()', /letterState\(\) \{[^}]*!enabled\(\)/.test(rom));
need('setOpt(false) closes the letter thread', /closeThread\(\)/.test(body(rom, 'setOpt') || ''));
need('canSignal checks enabled() and cheerful()', /enabled\(\) && cheerful\(\)/.test(body(rom, 'canSignal') || ''));
need('pendingSignal checks enabled()', /pendingSignal = \(\) => \{[^}]*enabled\(\)/.test(rom));
need('answerSignal re-checks eligible()', /eligible\(/.test(body(rom, 'answerSignal') || ''));
need('letter toast goes through cheerToast', !/toast\(`✉/.test(rom.replace(/cheerToast\(`✉/g, '')));
need('quiet-period date has no fade', /fade: cheerful\(\) \?/.test(body(rom, 'goOnDate') || ''));
need('plog journalOf filters ROM_KINDS while off', /ROM_KINDS\.includes\(e\.k\)/.test(body(plog, 'journalOf') || ''));
need('plog moved() filters romance reasons while off', /ROM_WHY/.test(body(plog, 'moved') || ''));
need('hud lettersSection gated on RM.enabled()', /if \(!RM\.enabled\(\)\) return ""/.test(body(hud, 'lettersSection') || ''));
need('hud memorial partner paragraph gated', /w\.partner && RM\.enabled\(\)/.test(hud));
need('hud memorial badge gated', /m\.partner && RM\.enabled\(\) \? "♥"/.test(hud));
{ const blk = plog.slice(plog.indexOf('// phase 4: romance'), plog.indexOf('  hint:')), kinds = [...blk.matchAll(/^\s+([a-z_]+): \[/gm)].map(m => m[1].replace(/^date_.*/, 'date'));
  const rk = (plog.match(/ROM_KINDS = \[([^\]]*)\]/) || [, ''])[1];
  for (const k of new Set(kinds)) if (k !== 'losttouch' && !rk.includes(`"${k}"`)) bad.push(`static: plog romance kind '${k}' is not in ROM_KINDS (it would show with romance off)`); }
if (process.env.STATIC) return finish({});
const { chromium } = require('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const [VW, VH] = (process.env.VIEWPORT || '1280x800').split('x').map(Number), mob = VW < 1000;   // pass 14: VIEWPORT=390x844 / 844x390 (default 1280x800)
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, isMobile: mob, hasTouch: mob, deviceScaleFactor: mob ? 2 : 1 })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const fresh = async () => { await p.goto(BASE + '?debug=1&reset=1'); await p.waitForFunction(() => !!window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 30000 }); await p.waitForTimeout(300);
    await p.evaluate(async () => { window.__noSave = true; const G = __T.G, P = G.prog; __T.app.paused = true; G.sp.cap.decideT = 1e9; G.ship.nextFault = 1e9; if (G.sp.ev) G.sp.ev.nextT = -1; P.day = 20; P.playDays = 20; P.rank = 1; P.rations = 900;
      window.PR = await import('/js/progression.js'); window.HUD = await import('/js/ui/hud.js'); window.BUS = await import('/js/bus.js');
      window.ROMRX = /\b(romantic|not as (ship|crew)mates|just (the two of )?us|evening with|evenings? together|together|partner|kiss|courting|takes? your hand|cabin door|would like a word|lingers after|letters?|write to me|said yes|in love|miss(ed)? you|LETTERS)\b|💌|♥|✉/i;
      window.toasts = []; new MutationObserver(() => document.querySelectorAll('#toasts > *, .toast').forEach(t => { if (!t.__seen) { t.__seen = 1; toasts.push(t.innerText); } })).observe(document.body, { childList: true, subtree: true });
      window.days = (n, chat) => { for (let d = 0; d < n; d++) { P.day++; P.playDays++; PR.hooks.newDay.forEach(f => f(P.day)); if (chat) for (const c of PR.crewList()) { for (let k = 0; k < 3; k++) PR.hooks.social.forEach(f => f(c.id)); PR.nudge(c.id, 2, 'dinner'); } } };
      window.scan = async (n0, t0, ids, allow) => { await new Promise(r => setTimeout(r, 250)); const G = __T.G, hits = [];
        const chk = (where, s) => { if (s && ROMRX.test(s) && !(allow && allow.test(s)) && !/^Personal log: no romantic storylines\./.test(s)) hits.push(`${where}: ${String(s).slice(0, 160)}`); };
        G.log.slice(n0).forEach(e => chk('log', e.msg)); toasts.slice(t0).forEach(t => chk('toast', t));
        HUD.openPlog(); chk('plog index', document.querySelector('#plogBody, #plogPanel .card').innerText.replace(/Allow romantic storylines\?[\s\S]*?ALLOW|Romantic storylines: (ON|OFF)/g, ''));
        for (const id of ids) { __T.PL.journalOf(id).forEach(j => chk(`journal ${id}`, j.text)); __T.PL.moved(id).forEach(m => chk(`moved ${id}`, m.text)); HUD.openPlog(id); chk(`page ${id}`, document.querySelector('#plogPanel .card').innerText.replace(/LOST TOUCH|have lost touch/gi, '')); }
        document.querySelector('#plogPanel').hidden = true;
        HUD.renderLog(); [...document.querySelectorAll('#log li')].map(li => li.innerText.replace(/^[\d.]+/, '')).filter(t => !/have lost touch\. It happens with postings|^\s*Personal log: no romantic storylines/.test(t)).forEach(t => chk('ship log', t));   /* pass 13 minor: the 'storylines allowed' line must be HIDDEN while off (only the 'no romantic storylines' line is exempt) */   // pass 12 HOLD 1: the rendered SHIP log, whole history
        return hits; };
    }); };
  const R = {};
  for (const opt of [null, false]) { await fresh(); R['off_' + opt] = await p.evaluate(async opt => { const P = __T.G.prog; P.romance.opt = opt; for (const c of PR.crewList()) P.opinions[c.id] = 75; const n0 = __T.G.log.length; days(60, true); return { hits: await scan(n0, 0, PR.crewList().map(c => c.id).slice(0, 6)), partner: P.romance.partner, signal: P.romance.signal }; }, opt); }
  await fresh(); R.off_partnerAboard = await p.evaluate(async () => { const G = __T.G, P = G.prog, RM = __T.RM; RM.setOpt(true); P.opinions.kovac = 70; P.romance.lastSignal = -99; RM.forceSignal('kovac'); RM.answerSignal(true); G.sp.location = 'ds9'; G.sp.travel = null; G.sp.battle = null;
    for (let i = 0; i < 3; i++) { P.day += 2; RM.goOnDate('kovac', 'dinner'); } const n0 = G.log.length, t0 = toasts.length; RM.setOpt(false); for (const c of PR.crewList()) P.opinions[c.id] = 75; days(60, true);
    return { hits: await scan(n0, t0, ['kovac', 'seo', 'tull']), partner: P.romance.partner, bond: P.romance.bond.kovac.stage }; });
  await fresh(); R.off_letterThread = await p.evaluate(async () => { const G = __T.G, P = G.prog, RM = __T.RM; RM.setOpt(true); P.opinions.natarajan = 70; P.romance.lastSignal = -99; RM.forceSignal('natarajan'); RM.answerSignal(true);
    __T.CL.transferOff('natarajan', null, 'roll'); days(2); await new Promise(r => setTimeout(r, 60)); const before = { letters: P.romance.letters.length, waiting: !!(RM.letterState() || {}).waiting };
    const n0 = G.log.length, t0 = toasts.length; RM.setOpt(false); const neutral = G.log.slice(n0).map(e => e.msg).filter(m => /lost touch/.test(m)); for (const c of PR.crewList()) P.opinions[c.id] = 75; days(60, true);
    const hits = await scan(n0, t0, ['natarajan', 'kovac'], /have lost touch\. It happens with postings/); const lettersAfter = P.romance.letters.length;
    RM.setOpt(true); days(20); return { before, neutral, hits, lettersAfterOff: lettersAfter - before.letters, lettersAfterBackOn: P.romance.letters.length - lettersAfter, thread: P.romance.thread }; });
  // pass 12 HOLD 1: a full romance history (dates, disclosure, break-up, farewell 'Write to me', letters) then OFF: the ship log hides it all;
  // plus legacy (untagged, pre-pass-12 save) lines. Back ON: the history shows again.
  await fresh(); R.off_history = await p.evaluate(async () => { const G = __T.G, P = G.prog, RM = __T.RM; RM.setOpt(true); G.sp.location = 'ds9'; G.sp.travel = null; G.sp.battle = null;
    P.opinions.kovac = 70; P.romance.lastSignal = -99; RM.forceSignal('kovac'); RM.answerSignal(true); for (let i = 0; i < 3; i++) { P.day += 2; RM.goOnDate('kovac', 'dinner'); }
    P.romance.disc = { id: 'kovac', kind: 'outrank' }; if (RM.fileDisclosure) RM.fileDisclosure(); RM.endIt('kovac', 'player');
    P.day += 20; P.romance.lastEnd = -99; P.opinions.natarajan = 70; P.romance.lastSignal = -99; RM.forceSignal('natarajan'); RM.answerSignal(true); __T.CL.transferOff('natarajan', null, 'roll'); days(30);
    const BUS = window.BUS; BUS.log("An evening with Kovac. You talk until the replicator runs out of tea.", "good"); BUS.log("A letter from Kovac at Starbase 375. (Personal Log)", "comm"); BUS.log("Before the transporter takes Kovac, there's a moment that's only yours. 'Write to me.' You promise. (Personal Log ▸ letters)", "comm");
    const tagged = G.log.filter(e => e.tag === 'rom').length; HUD.renderLog(); const onCount = [...document.querySelectorAll('#log li')].filter(li => ROMRX.test(li.innerText)).length;
    await new Promise(r => setTimeout(r, 60));   /* pass 14 deflake: let the toast observer record letters toasted while romance was ON before the off-scan baseline */
    RM.setOpt(false); const hits = await scan(G.log.length, toasts.length, []); RM.setOpt(true); HUD.renderLog(); const backOn = [...document.querySelectorAll('#log li')].filter(li => ROMRX.test(li.innerText)).length;
    return { tagged, onCount, hits, backOn }; });
  // pass 13 HOLD 1: the IN MEMORIAM row for a lost partner reads '· a close friend' (no ♥) with romance off, '· your partner' with it on
  await fresh(); R.memorial_row = await p.evaluate(async () => { const G = __T.G, P = G.prog, RM = __T.RM; RM.setOpt(true);
    P.med.memorial.push({ id: 'kovac_mem', name: 'PO Mara Kovac', short: 'Kovac', role: 'Damage control', day: 30, sd: '51500.0', partner: true });
    const row = () => { HUD.openPlog(); const el = [...document.querySelectorAll('#plogBody .plrow.lost')].pop(); const t = el ? el.innerText : ''; document.querySelector('#plogPanel').hidden = true; return t; };
    const on = row(); RM.setOpt(false); const off = row(); const hits = ROMRX.test(off) ? ['memorial row: ' + off] : []; return { on, off, hits }; });
  // pass 12 m3: endIt clears the stale disclosure and counts the ending (the comment used to swallow both); m4: the "no longer
  // auto-protected" notice only for a crewmate who was a favourite
  await fresh(); R.m3_m4 = await p.evaluate(async () => { const G = __T.G, P = G.prog, RM = __T.RM, MD = await import('/js/injuries.js'); RM.setOpt(true); window.__T.PROG && 0;
    const pool = PR.crewList().filter(c => !c.senior && !c.protected && !PR.PROG.romance.excluded.includes(c.id)), A = pool[0].id, B = pool[1].id, C = pool[2].id;
    MD.M().pins = [A, B]; for (const c of PR.crewList()) P.opinions[c.id] = 10; P.opinions[C] = 70; const favs = MD.favourites(), nonFav = { id: C };
    P.romance.lastSignal = -99; RM.forceSignal(C); const a1 = RM.answerSignal(true); const noteNonFav = a1 && a1.note, partner1 = P.romance.partner;
    P.romance.disc = { id: C, kind: 'outrank' }; const n0 = P.romance.n.ended; RM.endIt(C, 'player'); const ended = P.romance.n.ended - n0, discAfter = P.romance.disc;
    // an AUTO-protected favourite (no pins; top opinion) gets the notice ...
    P.romance.lastEnd = -99; P.day += 30; MD.M().pins = []; const D = pool[3].id, fav = D; P.opinions[D] = 90; const favAuto = MD.favourites().includes(D); P.romance.lastSignal = -99; RM.forceSignal(D); const a2 = RM.answerSignal(true); const partner2 = P.romance.partner;
    // ... pass 13 minor: a HAND-PINNED one does not (the pin keeps protecting them)
    RM.endIt(D, 'player'); P.romance.lastEnd = -99; P.day += 30; MD.M().pins = [B]; P.opinions[B] = 95; const pinFav = MD.favourites().includes(B); P.romance.lastSignal = -99; RM.forceSignal(B); const a3 = RM.answerSignal(true);
    return { favs, partner1, nonFav: nonFav.id, noteNonFav, ended, discAfter, fav, favAuto, noteFav: a2 && a2.note, partner2, pinned: B, pinFav, notePinned: a3 && a3.note, partner3: P.romance.partner, stillProtected: MD.favourites().includes(B) }; });
  // pass 13 minor: a partner who died (real death path), then romance OFF -> their journal still has the plain crewmate death entry
  await fresh(); R.off_deadpartner = await p.evaluate(async () => { const G = __T.G, P = G.prog, RM = __T.RM, MD = await import('/js/injuries.js'), SIM = await import('/js/sim.js'), PA = await import('/js/pacing.js'), K = PR.PROG.deaths, sg = { ...K.surgery }; RM.setOpt(true);
    const id = PR.crewList().find(c => !c.senior && !c.protected && RM.eligible(c.id) && c.id !== P.crew.slots.doctor).id; P.opinions[id] = 60; P.romance.lastSignal = -99; RM.forceSignal(id); RM.answerSignal(true); P.day += 2; RM.goOnDate(id, 'dinner');
    Object.assign(K.surgery, { chance: 1, max: 1, fastMult: 1, excellentMult: 1, visitMult: 1, assistMult: 1, scene: 3 }); P.playDays = 30; P.presentTotal = 1e6; P.med.asked = true; MD.setGentle(false); P.med.pins = [];
    P.med.inj = []; P.med.scene = null; P.med.day = { pd: -1, n: 0 }; P.crew.rolls.hist = []; P.med.lastDeathPD = null; P.med.lastDeathPT = null;
    const i = MD.injure('hazard', { id, sev: 'serious' }); for (let t = 0; t < 25; t++) { PA.playerInput(); SIM.stepSim(0.1); } i.ack = true; i.fixBy = 'lt'; delete G.ship.faults[i.sys]; for (let t = 0; t < 120; t++) { PA.playerInput(); SIM.stepSim(0.1); }
    Object.assign(K.surgery, sg); const dead = !P.crew.occ[id] && P.med.memorial.some(m => m.id === id);
    const on = __T.PL.journalOf(id).map(j => j.text); RM.setOpt(false); const off = __T.PL.journalOf(id).map(j => j.text); const hits = await scan(G.log.length, toasts.length, [id], /Somewhere a letter home is being written/);
    return { id, dead, on: on.slice(0, 3), off: off.slice(0, 3), offDeath: off.some(t => /^We lost .+ today\.|is gone\. I wrote the letter home/.test(t)), onLost: on.some(t => /I don't have words for the log/.test(t)), hits }; });
  // pass 14: a partner who transferred off, then romance OFF -> their journal still has the plain crewmate transfer entry
  await fresh(); R.off_transferredpartner = await p.evaluate(async () => { const G = __T.G, P = G.prog, RM = __T.RM; RM.setOpt(true);
    const id = PR.crewList().find(c => !c.senior && !c.protected && RM.eligible(c.id)).id; P.opinions[id] = 70; P.romance.lastSignal = -99; RM.forceSignal(id); RM.answerSignal(true);
    __T.CL.transferOff(id, null, 'roll'); await new Promise(r => setTimeout(r, 60)); const gone = !P.crew.occ[id] && (P.alumni || []).some(a => a.id === id);
    const on = __T.PL.journalOf(id).map(j => j.text); RM.setOpt(false); const off = __T.PL.journalOf(id).map(j => j.text); const hits = await scan(G.log.length, toasts.length, [id], /have lost touch\. It happens with postings/);
    return { id, gone, on: on.slice(0, 3), off: off.slice(0, 3), offTransfer: off.some(t => /shipped out to|Said goodbye to/.test(t)), onLetter: on.some(t => /We promised to write/.test(t)), hits }; });
  // pass 15: a REAL build09 save (tools/fixtures/rom-build09-lostpartner.json, made on efdb4b8: partner Tull died in surgery; that
  // build wrote BOTH a plain "death" entry (v1 pinned: "...is gone. I wrote the letter home...") and "lostpartner") -> one death entry
  await fresh(); R.off_build09 = await (async () => {
    const raw = fs.readFileSync(path.join(__dirname, 'fixtures', 'rom-build09-lostpartner.json'), 'utf8');
    await p.evaluate(r => { window.__noSave = true; const d = JSON.parse(r); d.savedAt = Date.now(); localStorage.setItem('tenacity.save.v1', JSON.stringify(d)); }, raw);
    await p.goto(BASE + '?debug=1'); await p.waitForFunction(() => !!window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 30000 }); await p.waitForTimeout(300);
    return p.evaluate(async () => { window.__noSave = true; __T.app.paused = true; const G = __T.G, RM = __T.RM, id = 'tull', DRX = /^We lost .+ today\.|is gone\. I wrote the letter home|I don't have words for the log/;
      const raw = (G.prog.plog.journal || []).filter(e => e.id === id).map(e => e.k);
      RM.setOpt(true); const on = __T.PL.journalOf(id).map(j => j.text); RM.setOpt(false); const off = __T.PL.journalOf(id).map(j => j.text);
      return { version: G.version, raw, on, off, onDeaths: on.filter(t => DRX.test(t)).length, offDeaths: off.filter(t => DRX.test(t)).length, onLost: on.some(t => /I don't have words for the log/.test(t)), offPlain: off.some(t => /^We lost .+ today\.|is gone\. I wrote the letter home/.test(t)) }; });
  })();
  // HOLD 2: a letter due inside the quiet period waits for the gate
  await fresh(); R.quiet_letter = await p.evaluate(async () => { const G = __T.G, P = G.prog, RM = __T.RM; RM.setOpt(true); P.opinions.natarajan = 70; P.romance.lastSignal = -99; RM.forceSignal('natarajan'); RM.answerSignal(true);
    __T.CL.transferOff('natarajan', null, 'roll'); await new Promise(r => setTimeout(r, 60)); const th = P.romance.thread; th.next = P.playDays + 1; BUS.hush && BUS.hush(); if (!BUS.hushed()) G.prog.med.hushUntil = G.ship.elapsed + 600;
    const quiet0 = !BUS.cheerful(), n0 = G.log.length, t0 = toasts.length, L0 = P.romance.letters.length; days(3); await new Promise(r => setTimeout(r, 250));
    const during = { letters: P.romance.letters.length - L0, logs: G.log.slice(n0).map(e => e.msg).filter(m => ROMRX.test(m)), toasts: toasts.slice(t0).filter(t => ROMRX.test(t)), next: th.next, miss: th.miss };
    G.ship.elapsed += 700; const open = BUS.cheerful(); days(1); return { quiet0, during, open, lettersAfterGate: P.romance.letters.length - L0 }; });
  R.errs = errs; await b.close(); finish(R);
})().catch(e => { bad.push('dynamic: ' + e.message); finish({}); });
function finish(R) {
  for (const [k, v] of Object.entries(R)) if (v && v.hits && v.hits.length) bad.push(`${k}: ${v.hits.length} romantic line(s) with romance off: ${v.hits.slice(0, 4).join(' | ')}`);
  if (R.off_letterThread) { const t = R.off_letterThread; if (!t.before.waiting) bad.push('off_letterThread: setup failed (no letter waiting before opt-out)'); if (t.neutral.length !== 1) bad.push(`off_letterThread: expected 1 neutral lost-touch line, got ${t.neutral.length}`); if (t.lettersAfterOff || t.lettersAfterBackOn) bad.push(`off_letterThread: letters after opt-out ${t.lettersAfterOff}, after back on ${t.lettersAfterBackOn}`); }
  if (R.quiet_letter) { const q = R.quiet_letter; if (!q.quiet0) bad.push('quiet_letter: setup failed (gate not shut)'); else { if (q.during.letters || q.during.logs.length || q.during.toasts.length) bad.push(`quiet_letter: letter/log/toast in the quiet period: ${JSON.stringify(q.during)}`); if (q.open && q.lettersAfterGate !== 1) bad.push(`quiet_letter: expected the deferred letter once the gate opened, got ${q.lettersAfterGate}`); } }
  if (R.off_history) { const h = R.off_history; if (h.tagged < 5 || h.onCount < 6) bad.push(`off_history: setup failed (tagged ${h.tagged}, romance lines shown while on ${h.onCount})`); if (h.backOn < h.onCount) bad.push(`off_history: history not back after re-enabling (${h.backOn} < ${h.onCount})`); }
  if (R.memorial_row) { const m = R.memorial_row; if (!/your partner/.test(m.on) || !/♥/.test(m.on)) bad.push('memorial_row: setup failed (on) ' + m.on); if (!/a close friend/.test(m.off) || /your partner|♥/.test(m.off)) bad.push('memorial_row: off row ' + m.off); }
  if (R.m3_m4) { const m = R.m3_m4; if (m.ended !== 1) bad.push(`m3: endIt did not count the ending (${m.ended})`); if (m.discAfter) bad.push('m3: stale disclosure left after endIt ' + JSON.stringify(m.discAfter)); if (m.noteNonFav) bad.push('m4: auto-protection notice for a non-favourite: ' + m.noteNonFav); if (m.partner2 && m.fav && !m.noteFav) bad.push('m4: no notice for a former favourite'); if (!m.partner2 || !m.partner1 || !m.favAuto) bad.push('m4: setup failed (partners) ' + JSON.stringify(m)); if (m.partner3 !== m.pinned || !m.pinFav) bad.push('pass 13 pinned: setup failed ' + JSON.stringify(m)); if (m.notePinned) bad.push('pass 13: auto-protection notice for a hand-pinned partner: ' + m.notePinned); if (!m.stillProtected) bad.push('pass 13: the pinned partner lost protection'); }
  if (R.off_deadpartner) { const d = R.off_deadpartner; if (!d.dead || !d.onLost) bad.push('off_deadpartner: setup failed ' + JSON.stringify(d)); if (!d.offDeath) bad.push('off_deadpartner: no plain death entry in the journal with romance off ' + JSON.stringify(d.off)); }
  if (R.off_transferredpartner) { const d = R.off_transferredpartner; if (!d.gone || !d.onLetter) bad.push('off_transferredpartner: setup failed ' + JSON.stringify(d)); if (!d.offTransfer) bad.push('off_transferredpartner: no plain transfer entry in the journal with romance off ' + JSON.stringify(d.off)); }
  if (R.off_build09) { const d = R.off_build09; if (!(d.raw.includes('death') && d.raw.includes('lostpartner'))) bad.push('off_build09: fixture setup failed ' + JSON.stringify(d.raw)); if (d.offDeaths !== 1 || !d.offPlain) bad.push('off_build09: romance off - expected exactly 1 plain death entry, got ' + JSON.stringify(d.off)); if (d.onDeaths !== 1 || !d.onLost) bad.push('off_build09: romance on - expected exactly 1 death entry (the partner one), got ' + JSON.stringify(d.on)); }
  if (R.errs && R.errs.length) bad.push(`console errors: ${R.errs.slice(0, 3).join(' | ')}`);
  console.log(JSON.stringify({ R, bad }, null, 1).slice(0, 6000));
  console.log(bad.length ? 'ROMANCE SCAN FAIL' : 'ROMANCE SCAN PASS'); process.exit(bad.length ? 1 : 0);
}
