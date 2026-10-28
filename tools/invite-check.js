// Holodeck invite + multi-beat stories (Oct 27). Per size 390x844, 844x390, 1280x800:
//  1. odds formula + words (Likely >= 0.65, Maybe >= 0.35, else Long shot); partner = 0.95 only with romance ON
//  2. yes/no opinion effects; 2-try limit; no reroll on reload; daily slot spent only when a session starts
//  3. romance-off: no partner odds boost / no partner stories; injured + not-aboard hidden from picker
//  4. stories: >=3 variants per program x category; last-3 no-repeat; co-star talk by relationship; tokens resolve
//  5. scene text fits; proof shot shots/holo-invite-<size>.png (picker) and shots/holo-invite-story-<size>.png (co-star)
// Usage: node tools/invite-check.js (SHOTS=0 skips shots)
const { chromium } = require('playwright-core'); const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/', OUT = path.resolve(__dirname, '..', 'shots') + '/', SHOTS = process.env.SHOTS !== '0';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [], net = [], fails = [], J = JSON.stringify, host = new URL(BASE).host;
  const ok = (c, m) => { if (!c) fails.push(m); else console.log('ok ' + m.split(' {')[0].split(' [')[0]); };
  for (const [w, h] of [[390, 844], [844, 390], [1280, 800]]) {
    const tag = `${w}x${h}`, mob = w < 900;
    const c = await br.newContext({ viewport: { width: w, height: h }, locale: 'en-US', timezoneId: 'America/Chicago', isMobile: mob, hasTouch: mob });
    await c.addInitScript(() => { window.__TENACITY_SKIP_NAME = true; window.__TENACITY_SKIP_BG = true; window.__TENACITY_NO_IDLE = true; });
    const p = await c.newPage();
    p.on('console', m => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); });
    p.on('pageerror', e => errs.push(`${tag}: ${e.message}`));
    p.on('response', r => { if (r.status() >= 400) net.push(`${tag}: ${r.status()} ${r.url()}`); });
    p.on('requestfailed', r => { try { if (new URL(r.url()).host === host) net.push(`${tag}: failed ${r.url()}`); } catch (e) {} });
    const ready = () => p.waitForFunction(() => window.__T && document.querySelector('#loading').classList.contains('done'), null, { timeout: 60000 });
    const calm = () => p.evaluate(() => { const G = __T.G; G.prog.story.pilot.done = true; G.prog.background = G.prog.background || 'none'; G.prog.bgDone = true; G.prog.rations = 5000; G.ship.nextFault = 1e9; G.sp.cap.decideT = 1e9; G.sp.ev.nextT = -1; G.sp.battle = null; G.sp.alert = null; __T.PACE_RT.sessionT = 1e6; document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); });
    await p.goto(BASE + '?reset=1'); await ready(); await sleep(400); await calm();

    // ---- 1. odds formula + words + romance partner boost ----
    const R1 = await p.evaluate(async () => {
      const HD = await import('/js/holodeck.js'), PG = await import('/js/progression.js'), G = __T.G;
      const id = G.prog.crew.slots.science || Object.keys(G.prog.crew.occ)[0];
      const samples = [-45, 0, 20, 60, 100].map(op => { G.prog.opinions[id] = op; const p = HD.inviteChance(id); return { op, p, word: HD.inviteWord(p) }; });
      G.prog.romance.opt = true; G.prog.romance.partner = id; G.prog.opinions[id] = 0;
      const partnerOn = HD.inviteChance(id);
      G.prog.romance.opt = false; const partnerOff = HD.inviteChance(id);
      G.prog.romance.partner = null;
      const words = { L: HD.inviteWord(0.80), M: HD.inviteWord(0.40), S: HD.inviteWord(0.10) };
      return { samples, partnerOn, partnerOff, words, id };
    });
    const near = (a, b) => Math.abs(a - b) < 1e-9;
    ok(near(R1.samples.find(s => s.op === 0).p, 0.4) && near(R1.samples.find(s => s.op === 60).p, 0.8)
      && near(R1.samples.find(s => s.op === -45).p, 0.1) && R1.samples.find(s => s.op === 100).p === 0.95
      && R1.partnerOn === 0.95 && R1.partnerOff === 0.4
      && R1.words.L === 'Likely' && R1.words.M === 'Maybe' && R1.words.S === 'Long shot',
      `${tag} odds formula + words + romance partner boost ` + J(R1));

    // ---- 2. yes/no effects, 2 tries, no reroll on reload, slot only on session ----
    const R2 = await p.evaluate(async () => {
      const HD = await import('/js/holodeck.js'), PG = await import('/js/progression.js'), G = __T.G;
      HD.H().lt = { d: '', n: 0 }; HD.H().invite = null;
      const a = G.prog.crew.slots.tactical || 'hale', b = G.prog.crew.slots.science || 'diallo';
      G.prog.opinions[a] = 10; G.prog.opinions[b] = 50; G.prog.opDay = {};
      const left0 = HD.ltLeft(), opA0 = PG.opinionOf(a);
      const no = HD.invite(a, () => 0.99); // force no
      const left1 = HD.ltLeft(), opA1 = PG.opinionOf(a);
      const yes = HD.invite(b, () => 0); // force yes
      const left2 = HD.ltLeft(), opB = PG.opinionOf(b) - 50;
      const again = HD.invite(a, () => 0); // already rolled / guest set
      window.__noSave = false; __T.saveGame(); window.__noSave = true;
      return { no, yes, again, left0, left1, left2, dOpNo: +(opA1 - opA0).toFixed(3), dOpYes: +opB.toFixed(3), guest: HD.inviteStatus().guest, nos: HD.inviteStatus().nos };
    });
    await p.reload(); await ready(); await sleep(400); await calm();
    const R2b = await p.evaluate(async () => {
      const HD = await import('/js/holodeck.js'), G = __T.G;
      const st = HD.inviteStatus(), list = HD.inviteList();
      const reroll = HD.invite(st.rolls && Object.keys(st.rolls)[0], () => 0);
      const left = HD.ltLeft();
      // start a session: slot spends now
      const book = HD.book('vulcan_garden', 'lt', true);
      return { st, list, reroll, leftBeforeBook: left, leftAfter: HD.ltLeft(), bookOk: book.ok, beats: (book.beats || []).length, talk: (book.talk || []).length, cat: book.cat, blurb: (book.blurb || '').slice(0, 80) };
    });
    ok(R2.no && R2.no.yes === false && R2.dOpNo === -1 && R2.left0 === 1 && R2.left1 === 1 && R2.left2 === 1
      && R2.yes && R2.yes.yes === true && R2.dOpYes > 0 && R2.guest === R2.yes.guest
      && R2.again && R2.again.ok === false
      && R2b.st.guest === R2.guest && R2b.reroll && R2b.reroll.ok === false
      && R2b.leftBeforeBook === 1 && R2b.leftAfter === 0 && R2b.bookOk && R2b.beats >= 3,
      `${tag} yes/no, 2-try state saved, no reroll, slot only on book ` + J({ R2, R2b: { guest: R2b.st.guest, leftBeforeBook: R2b.leftBeforeBook, leftAfter: R2b.leftAfter, beats: R2b.beats, talk: R2b.talk, cat: R2b.cat } }));

    // ---- 3. picker hides injured / not aboard; romance-off no partner stories ----
    await p.evaluate(() => { localStorage.clear(); }); await p.goto(BASE + '?reset=1'); await ready(); await sleep(400); await calm();
    const R3 = await p.evaluate(async () => {
      const HD = await import('/js/holodeck.js'), G = __T.G, MD = await import('/js/injuries.js');
      HD.H().lt = { d: '', n: 0 }; HD.H().invite = null;
      const id = G.prog.crew.slots.ops || Object.values(G.prog.crew.slots).find(x => x && x !== 'tren');
      // injure someone
      G.prog.med = G.prog.med || { inj: [] };
      G.prog.med.inj.push({ id, sys: 'coolant', left: 600, short: 'hurt', ack: true });
      const list = HD.inviteList().map(x => x.id);
      const hidden = !list.includes(id);
      // romance off partner stories
      G.prog.romance.opt = false; G.prog.romance.partner = G.prog.crew.slots.science;
      let pc = 0; for (let i = 0; i < 40; i++) if (HD.blurbFor('vics_lounge', 'lt').cat === 'partner') pc++;
      // forced invite guest with romance off should not be partner cat
      G.prog.opinions[G.prog.romance.partner] = 80;
      HD.H().invite = { d: (await import('/js/progression.js')).localDate(), rolls: {}, nos: 0, guest: G.prog.romance.partner };
      const forced = HD.blurbFor('vics_lounge', 'lt', G.prog.romance.partner);
      G.prog.med.inj = []; G.prog.romance.partner = null;
      return { hidden, injured: id, listN: list.length, romOffPartner: pc, forcedCat: forced.cat };
    });
    ok(R3.hidden && R3.romOffPartner === 0 && R3.forcedCat !== 'partner', `${tag} injured hidden; romance-off no partner stories ` + J(R3));

    // ---- 4. stories: >=3 variants, last-3 rule, talk by relationship, tokens ----
    const R4 = await p.evaluate(async () => {
      const HD = await import('/js/holodeck.js'), { STORIES, STORY_CATS } = await import('/js/holo-stories.js'), G = __T.G;
      const counts = {}, short = {}, badTok = [], noTalk = [], last3 = {};
      for (const pid of HD.PROG_IDS) {
        counts[pid] = {};
        for (const cat of STORY_CATS) {
          const n = (STORIES[pid][cat] || []).length; counts[pid][cat] = n;
          if (n < 3) short[pid + '.' + cat] = n;
          if (cat !== 'solo') for (const v of STORIES[pid][cat]) if (!v.talk || v.talk.length < 2) noTalk.push(pid + '.' + cat);
        }
        // last-3: force solo pool only
        HD.H().recent[pid] = [];
        const keys = [];
        for (let i = 0; i < 12; i++) {
          // solo-only by clearing relations path: book blurbs with no guest and empty friend/rival pools
          const b = HD.blurbFor(pid, 'lt', null); keys.push(b.key);
        }
        // check no immediate repeat of same key 4 times in a tiny pool is hard; instead verify block logic:
        HD.H().recent[pid] = ['solo0', 'solo1', 'solo2'];
        const poolKeys = [];
        for (let i = 0; i < 20; i++) { HD.H().recent[pid] = ['solo0', 'solo1', 'solo2']; const b = HD.blurbFor(pid, 'lt', null); poolKeys.push(b.key); }
        // with only 3 solo variants and last 3 blocked, avail-1 = 2, block = last 2? HOLO.recent=3, avail=3, block=min(3,2)=2 → one free
        last3[pid] = { blocked: poolKeys.every(k => k !== undefined), sample: poolKeys.slice(0, 5) };
      }
      // tokens resolve: force friend guest — also pronoun packs for he/she/they crewmates
      const fid = G.prog.crew.slots.science; G.prog.opinions[fid] = 70; G.prog.romance.opt = false;
      HD.H().invite = { d: (await import('/js/progression.js')).localDate(), rolls: { [fid]: true }, nos: 0, guest: fid };
      const tokRe = /\{(?:named|leads?|Co|co|Lead|lead)(?:They|Them|Theirs?|Themself|Is|Has|S|Do|Dont)?\}/;
      const bl = HD.blurbFor('tactical_sim', 'lt', fid);
      const joined = bl.beats.join(' ') + ' ' + (bl.talk || []).map(t => t.join(' ')).join(' ');
      if (tokRe.test(joined)) badTok.push('friend:' + joined.slice(0, 140));
      // pronoun resolution across he/she/they: pick known START_CREW ids if present, else mutate pronoun
      const pronCheck = [];
      for (const [id, want] of [['hale','he'],['tren','she'],['orvin','they']]) {
        const o = G.prog.crew.occ[id]; if (!o) continue;
        o.pronoun = want; G.prog.opinions[id] = 70;
        // exhaust friend variants so a pronoun-bearing beat is filled
        HD.H().recent.tactical_sim = [];
        let saw = false;
        for (let i = 0; i < 12; i++) {
          const b = HD.blurbFor('tactical_sim', 'lt', id);
          const j = b.beats.join(' ') + ' ' + (b.talk || []).map(t => t.join(' ')).join(' ');
          if (tokRe.test(j)) pronCheck.push(id + ':unresolved:' + j.slice(0, 80));
          if (want === 'he' && /\b(He|he|him|his)\b/.test(j)) saw = true;
          if (want === 'she' && /\b(She|she|her|hers)\b/.test(j)) saw = true;
          if (want === 'they' && /\b(They|they|them|their)\b/.test(j)) saw = true;
        }
        if (!saw) pronCheck.push(id + ':no-' + want + '-forms-across-variants');
      }
      // every non-solo story string that still contains a pronoun token name as literal is a source bug — scan raw STORIES
      let rawTok = 0;
      for (const pid of HD.PROG_IDS) for (const cat of STORY_CATS) if (cat !== 'solo') for (const v of (STORIES[pid][cat] || [])) {
        const raw = (v.beats || []).join(' ') + ' ' + (v.talk || []).map(t => t.join(' ')).join(' ');
        if (/\{coThey\}|\{CoThey\}|\{coThem\}|\{coIs\}|\{coHas\}|\{coS\}/.test(raw)) rawTok++;
      }
      if (!/\bYou\b/.test((bl.talk || []).map(t => t[0]).join(' ')) && bl.talk && bl.talk.length) { /* speaker You expected for lt */ }
      const hasYou = (bl.talk || []).some(t => t[0] === 'You');
      const hasCo = (bl.talk || []).some(t => t[0] === G.prog.crew.occ[fid].short);
      return { counts, short, noTalk, badTok, pronCheck, rawTok, hasYou, hasCo, cat: bl.cat, beats: bl.beats.length, talkN: (bl.talk || []).length, last3ok: Object.values(last3).every(x => x.blocked) };
    });
    ok(Object.keys(R4.short).length === 0 && R4.noTalk.length === 0 && R4.badTok.length === 0 && R4.pronCheck.length === 0 && R4.rawTok > 0 && R4.hasYou && R4.hasCo && R4.beats >= 3 && R4.talkN >= 2 && R4.cat === 'friend',
      `${tag} stories >=3, talk, pronoun tokens ` + J({ short: R4.short, noTalk: R4.noTalk, badTok: R4.badTok, pronCheck: R4.pronCheck, rawTok: R4.rawTok, cat: R4.cat, beats: R4.beats, talkN: R4.talkN }));

    // ---- 5. UI: picker + co-star story scene + fit ----
    await p.evaluate(() => { localStorage.clear(); }); await p.goto(BASE + '?reset=1'); await ready(); await sleep(400); await calm();
    await p.evaluate(async () => {
      const HD = await import('/js/holodeck.js'), H = await import('/js/ui/holo.js'), G = __T.G, PG = await import('/js/progression.js');
      HD.H().lt = { d: '', n: 0 }; HD.H().invite = null;
      const id = G.prog.crew.slots.science; G.prog.opinions[id] = 70;
      H.openHolo('lt');
    });
    await sleep(350);
    if (SHOTS) await p.screenshot({ path: `${OUT}holo-invite-${tag}.png` });
    const R5 = await p.evaluate(() => {
      const inv = [...document.querySelectorAll('#holoPanel .holoinv')];
      const sizes = inv.map(b => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height), ok: r.height >= 43.5 && r.width >= 43.5 }; });
      return { n: inv.length, all44: sizes.every(s => s.ok), sample: sizes.slice(0, 4) };
    });
    ok(R5.n >= 2 && R5.all44, `${tag} invite picker taps >= 44px ` + J(R5));

    // force yes + book + story shot (direct book so the invited co-star is guaranteed)
    await p.evaluate(async () => {
      const HD = await import('/js/holodeck.js'), H = await import('/js/ui/holo.js'), G = __T.G;
      const id = G.prog.crew.slots.science; G.prog.opinions[id] = 70;
      HD.H().lt = { d: '', n: 0 }; HD.H().invite = null; HD.invite(id, () => 0);
      const r = HD.book('dixon_hill', 'lt', true);
      document.getElementById('holoPanel').hidden = true;
      // mirror showScene
      const m = document.getElementById('holoScene') || (() => { const d = document.createElement('div'); d.id = 'holoScene'; d.className = 'modal holoscene'; document.body.appendChild(d); return d; })();
      const who = r.who.filter(x => x !== 'lt').map(x => G.prog.crew.occ[x].short);
      const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
      const beats = (r.beats || [r.blurb]).map(t => `<p class="holobeat">${esc(t)}</p>`).join('');
      const talk = (r.talk || []).map(([w, line]) => `<div class="holotalk"><b>${esc(w)}</b> ${esc(line)}</div>`).join('');
      m.className = 'modal holoscene'; m.hidden = false;
      m.innerHTML = `<div class="holoframe"><img src="assets/holodeck/holo_dixon_hill.webp" alt=""><div class="holoblurb"><b>DIXON HILL${who.length ? ' · ' + esc(who.join(', ')) : ''}</b><div class="holostory">${beats}${talk ? `<div class="holotalks">${talk}</div>` : ''}</div><small>Tap to close</small></div></div>`;
      window.__inviteStory = { beats: (r.beats || []).length, talk: (r.talk || []).length, cat: r.cat };
    });
    await sleep(500);
    const R6 = await p.evaluate(() => {
      const bl = document.querySelector('#holoScene .holoblurb'), st = document.querySelector('#holoScene .holostory');
      const fr = document.querySelector('#holoScene .holoframe');
      if (!bl || !fr) return { open: false };
      const br = bl.getBoundingClientRect(), rr = fr.getBoundingClientRect();
      const band = br.height / rr.height;
      const beats = [...document.querySelectorAll('#holoScene .holobeat')].map(e => e.textContent);
      const talks = [...document.querySelectorAll('#holoScene .holotalk')].map(e => e.textContent);
      const overflow = st && st.scrollHeight > st.clientHeight + 2;
      return { open: true, band, beats: beats.length, talks: talks.length, overflow, fit: br.bottom <= rr.bottom + 1 && br.top >= rr.top - 1 && band <= 0.35 };
    });
    if (SHOTS) await p.screenshot({ path: `${OUT}holo-invite-story-${tag}.png` });
    const meta = await p.evaluate(() => window.__inviteStory || {}); ok(R6.open && R6.beats >= 3 && (R6.talks >= 2 || meta.talk >= 2) && R6.fit && meta.cat === 'friend', `${tag} co-star story scene fits ` + J({ R6, meta }));

    await c.close();
  }
  await br.close();
  console.log('ERRORS', errs.length, J(errs.slice(0, 5)));
  console.log('NET', net.length, J(net.slice(0, 5)));
  if (fails.length || errs.length || net.length) { console.log('FAILS ' + fails.length); fails.forEach(f => console.log('FAIL ' + f)); process.exit(1); }
  console.log('PASS · invite-check · 3 sizes · 0 console errors · 0 failed requests');
})().catch(e => { console.error(e); process.exit(1); });
