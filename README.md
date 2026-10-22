# USS Tenacity — deck game (rebuild)

Static ES-module build. There's no build step.

    cd /workspace/tenacity && python3 -m http.server 8765
    open http://localhost:8765/            (play)
    open http://localhost:8765/?debug=1    (debug menu: battle / faults / events / x1-x5-x20 / offline sim / wipe)
    ?reset=1 wipes the save.

## Layout
- index.html, css/style.css: phone-first shell (WINDOW info view / FULL slim play view, SPACE/DECK).
- js/data.js: decks, nodes, walk rects, systems, destinations, officers, lines, and the sprite atlas frame defs with anchors.
  The Lieutenant uses assets/lt-v3.webp (LT2_SHEETS / LT2_FRAMES: walk, talk, eat, computer, kneel, weld x up/down/right/left x A/M/B,
  160x384 cells, feet at 80,376, refH 252 -> FIG_H). Only the bunk/biobed lying pose still comes from crew-atlas.
  Sheets are per character (CHAR_SHEETS / CHAR_FRAMES / charFrame): Captain T'Ren uses assets/tren-v1.webp (same grid and scale).
  CHARACTER SCALE (option A, 2026-10-18, shots/scale-report.md): FIG_H = 83 design px (was 134; FIG_K = 0.62 scales every
  body-sized number: steps, speeds (Lt 68 px/s), shadows, LIE_FIG 86, HEAD_Y floaters, weld sparks). On screen: ~114 css px
  at 1280x800 (cam.scale 1.368), ~87 px at 390x844 and ~88 px at 844x390 (phones start 1.22x / 1.28x tighter: main.js
  PHONE_BOOST / PHONE_BOOST_LAND -> cam.boost), ~68 / ~58 px on the 360x640 / 667x375 card sizes. Rings, labels, name tags and
  the 40 px tap zones keep their old size. Walking uses the walk_v2 masters (assets/lt-walk-v2.webp: Lt up/down/right/left;
  assets/tren-walk-v2.webp: T'Ren right/left; crew-gold/blue-walk-v2 = the same recolour as tools/make-uniform-sheets.py; packed
  by tools/pack-walk-v2.py, drawn downscaled via data.js WALK_V2, refH = 252 / hires factor). T'Ren's up/down (and every
  crewmate's) stay tren_walkfix_v1. Artist guide: keep delivering the 160x384 grid (252 px standing, enough for ~230 device px
  on dpr 2); hi-res masters (~500+ px standing) are welcome and get downscaled. tools/foot-slide.js checks the planted foot,
  tools/node-shots.js shows the Lt at every node.
- js/npc.js: Captain T'Ren on the Bridge (visual only, not saved): stands beside the chair, works consoles, talks when the Lt
  reports at the chair or stands beside her, holds at the chair in battle. Spots in data.js TREN.
- js/npc-ambient.js: generic ambient crew NPCs from AMBIENT_NPCS (data.js). First one: Crewman Thelev sh'Zarath, an Andorian crewwoman (she/her) in the
  Mess & Bar, using CHAR_SHEETS.andorian (stand-in: T'Ren's tren-v1 sheet until assets/andorian-v1.webp exists). tools/andor-shots.js verifies.
- js/state.js: the single serialisable state G, plus save/load (localStorage).
- js/path.js: per-deck 60x40 grid and A*.
- js/crew.js: the Lieutenant (intents, zones, walk, repair, rest, recharge, torpedo replication, turbolift).
- js/faults.js: severity, priority chain, duty list, capability gates.
- js/voyage.js: T'Ren's autonomous voyage, arrivals, docks, and the single voyage view-model.
- js/events.js: the 9 random events, timed deck tasks (10 s warning and expiry).
- js/battle.js: the battle, officer AI, abilities, tow to DS9, and space FX state. It fights combatants from js/ships.js.
- js/ships.js: the SHIP DEFINITIONS table (SHIPS), factions, story-context enemies (CTX_ENEMY), combatant helpers, save v14 migration /
  hardening for battles, and the stubbed multi-ship hooks (target selection, per-combatant HUD rows, formation slots).
- js/encounters.js: the encounter table (which enemy a battle brings): weights + battlecruiser gates from PACE.encounter, G.sp.enc.
- js/sim.js: the fixed-order step and offline catch-up.
- js/render/deck.js: the camera (follow, zoom, pan), plates, sprites, rings, and the turbolift overlay.
- js/render/space.js: backdrop crossfade, ships, beams, torpedoes, shields, and explosions.
- js/doors-data.js + js/render/doors.js: per-deck sliding doors (DECK_DOORS; Bridge lifts): panels under the cast, open while crew feet are in the trigger radius, close after a delay.
- js/render/ships.js: drawShip (the SHIP_ART sheet when loaded, else the legacy painted image from data.js SHIP_PAINTED, else a vector placeholder per class in faction colours) and name labels.
- js/ui/hud.js: the DOM HUD. Landscape phones (orientation landscape, height <= 500px) get their own layout in css/style.css:
  stats column | deck | side column (alert, modes, stations, sheet buttons), one merged LT/SHIP line, sheets as a right drawer.
- js/main.js: loop, input, modes, visibility, and boot.
- js/debug.js
- js/injuries.js (phase 6 — ON by default since retune v2, Shiloh: about 1 death per 4 months for a regular player; Gentle mode is the opt-out;
  21-run sim: regular p10/p50/p90 0/1/1 deaths per 120 days, casual 0/0/1 — shots/prog6-sim-v2.txt): crew injuries and rare, fair deaths, built to the design memo's safeguards (§2). Injuries only come
  from battle hull hits and hazard events, never the daily crew roll. The injured crew member lies on a sickbay biobed
  (render/deck.js) with an INJURED status on the CREW sheet. A serious injury hangs on a ship's system (coolant / EPS, or the
  fault the hit opened). Fixing it inside the warning window saves them. Deaths: never before day 14 of play or before Lt; never
  senior staff; never the 2 favourites (or the player's 2 pins), who are transferred to a starbase hospital instead. Gentle mode
  (CREW > Crew safety) turns a death into an evacuation. At most 1 death per 21 days of play, inside the crew-event caps. Offline
  outcomes wait until the player has seen the warning. On a death: a memorial log line, a Mess & Bar service, In Memoriam on the
  CREW sheet, and a transfer-in replacement. Tuning: PROG.deaths. Save: G.prog.med (v7). Proof: tools/prog6-shots.js, prog-sim `deaths` mode
  (exits 2 on any safeguard violation). Force deaths ON/OFF in tests: `DEATHS=1` / `DEATHS=0 node tools/tap44-check.js` (also save-fuzz, e2e); unset = the shipped default (ON). Protected crew
  (Thelev) are a per-occupant `protected` flag, never a name check. While the player is live but idle, the night crew leaves a fault
  a serious injury depends on to the Lt; offline it still fixes it (so no death resolves unseen).
  **Pass 06 (playtest-06 HOLD fixes, save v10):** a death only ever resolves while the player is PRESENT (app visible, not in
  catch-up, input within 60 s — pacing.js `isPresent()`), shown live in the sickbay scene, never as a shift-report bullet. The
  injury clock starts when the alert is seen (input after it appeared, or tapping it / opening DUTY or CREW), counts 180 s of
  present time only, and pauses while hidden / locked / idle (night mode too). Away or offline the night crew + doctor always
  stabilise the patient (`crewStabilise` 1; pass 07: only patients never seen live); back with the system still down, the window restarts fresh (pass 07: resumes). The alert pill turns
  into a red ✚ medical alert with a live countdown (+ vibrate and a short tone after the first user gesture). Rate: when the
  system is restored live, Dr. Orvin operates (PROG.deaths.surgery: 8 s scene, chance 0.2, ×0.65 fast, ×0.7 per Excellent
  repair (max 2), ×0.7 visited, cap 0.25); every safeguard is re-checked at the outcome. Play days use a high-water mark
  (date must be later than any counted, ≥ 20 h real time apart), so clock flips can't skip the day-14 / 21-day gates.
  ~10 min hush after a death (no floaters / cheerful lines), the service waits ≥ 10 min, evacuations get their own
  goodbye, the memorial states the real opinion change and names the department's crew, a one-time Crew safety prompt from
  play day 12, prog.rep clamped. Proof: tools/pt06-shots.js (hidden / idle / tamper / day-13 tests), prog6-shots
  asserts, prog-sim `deaths` (`notPresent` / `offlineDeath` violations) — shots/prog6-sim-v3.txt.
  **Pass 07 (playtest-07 narrow HOLD, save v13):** deaths have TWO sources, both only while present: (a) the surgery roll after
  the fix, and (b) a timeout: the 180 s of present time ran out after the alert was seen and acknowledged, with the system still
  down (fair; kept; counted in the rate). (1) A play day also needs ~3 min of present play once it is due (later date + 20 h),
  measured by the in-session timer, so stepping the clock and relaunching adds nothing; a stored future date / time is pulled
  back to now (no frozen days); migrateProg13 seeds the present requirement so the first day after the update counts; deaths
  also need 3 h of present play in total and 3 h since the last death (`minPresentH` / `gapPresentH`). (2) Away never beats
  watching: a seen patient whose system is fixed while the player is away / idle goes to surgery like any other; the surgery
  pauses while away and resumes on return (never auto-saved); back with the system still down, the clock resumes where it paused
  (not a fresh 180 s). Only a patient never seen live is stabilised with no roll. The 'fast' bonus needs the Lt's own fix landing
  while present. (4) Surgery: base 0.30, ×0.4 fast (≈12%), one-tap ASSIST (×0.75), odds shown as a band (good chance ≤ 15% /
  touch and go ≤ 35% / grim), and after a loss the doctor says it wasn't the Lt. Proof: tools/pt07-shots.js, save-fuzz v13
  cases, prog-sim `deaths` (adds `awayBetter` / `freeSave` violations and the surgery vs timeout split) — shots/prog6-sim-v4.txt.
  Exposure retuned to hold the rate (hazard injury 0.40, serious 0.9 / 0.45 / 0.85): 21 runs x 120 days, regular p10/p50/p90 0/1/2
  (mean 0.95; 18 surgery + 2 timeout deaths), casual 0/1/2 (mean 0.71; 7 + 8). Minors: Orvin is they, evac / homesick lines use
  the patient's pronoun, homesick is a 3-day spell every 15 ship's days, the gift that reveals a loved item doesn't start the
  repeat decay, no cheerful repair quips in the hush, care-made good words count at 50% (max +2 readiness, x1.25 call-up),
  generated crew never love a disliked category, the injury note shows the clock state, the phone gift picker footer is solid.
  **Pass 08 (playtest-08 notes):** play days are also capped at 1 + presentTotal / 600 (10 min of present play per day), so
  stepping the clock can't mint days; the surgery scene counts as seen when the player is present (an auto-fix before the alert
  tap can't leave a patient unkillable; no fast bonus for it); back from away with the system still down the clock is at least
  30 s (once per injury, `returnFloor`), re-tap kept, and a short lock / hide / idle under 30 s also needs the re-tap; the
  fast-fix bonus eases (x0.4 to 20 s, linear to x1.0 at 90 s: `fastFullS` / `fastEndS`); the 600 s hush also blocks the
  birthday / mail-call moment, Okafor's deck line and the specialisation quip; the crew panel says IN SURGERY; '1 second';
  sickbay lines and the panel say 'the duty medic' when Dr. Orvin is the patient. Proof: pt07-shots, shots/prog6-sim-v5.txt.
- js/plog.js (Personal Log phase 1 = design memo 2026-10-17 phase A; save v8, the memo's "v7" — memo v8/v9/v10 become v9/v11/v12; pass 06 took v10):
  CREW > PERSONAL LOG opens a read-only modal: one page per crewmate with standing (bar + label + 7-day trend arrow; the number stays
  hidden until Insight 3+ in phase C), "What moved it" (last 5 nudge(why) reasons, consecutive repeats merge ×n) and a stardated journal
  in the Lt's voice (crew events, sickbay, chats max 1/crewmate/ship's day, dinner, kit, odd jobs, praise/complaints). Former
  shipmates (alumni, frozen opinion, posting, rank, favour contact ✓ at +30) and the fallen keep their pages; Seo's is hand-written.
  Save: G.prog.plog { hist, journal, snap, chat, n }; migrateProg8 seeds the journal from crew.log (last 60). Caps: PROG.plog.
  Every crewmate has a `pronoun` (START_PRONOUNS in roster.js; generated crew roll one; alumni/memorial keep it); crew text uses
  pr()/Pr()/prFill() ({sub} {obj} {pos} {ref}). Proof: tools/plog1-shots.js, save-fuzz v7->v8 cases, prog-sim `deaths` PL-1/PL-2.
- js/gifts.js + js/gift-data.js (Personal Log phase 2 = memo phase B; save v9, the memo's "v8"): gifts from a crew page in the
  Personal Log. Memo tiers/caps in PROG.gifts: Token 10 FR / base 2 and Thoughtful 30 / 4 from Delgado's galley (any time), Personal
  75 / 7 on the DS9 Promenade while docked, Treasured 180 / 12 at a homeworld (Lt+); both of those wait in the GIFT LOCKER (6).
  Liked x1.5, loved x2 (the exact item, already known; not Tokens), disliked -4 raw; same item 1 / 0.5 / 0.25; ship-wide x0.5 after
  3 a day; occasions x1.5 (birthday every 60 ship's days, seeded per save; 3 days after a promotion; homesick); one gift per person
  per 2 ship's days; gifts stop at +70. Reactions reveal tastes (KNOWN TASTES: partial = category, full = item). Care packages to
  ex-shipmates: 60 FR / base 5, +10 total, no Fleet Rep change. Gift opinion (gifts.giftOp) counts 50% in board readiness and in
  the Fleet Rep banked on a transfer. Quarters dinner opinion 2 -> 4. Save: G.prog.gifts, G.prog.know (migrateProg9).
  Proof: tools/plog2-shots.js, save-fuzz v8->v9 cases, prog-sim `gifts` mode (shots/plog2-sim.txt).
- js/insight.js (Personal Log phase 3 = memo phase C, §4; save v11, the memo's "v9"). Player-facing name INSIGHT (never
  "Intelligence"). XP -> Insight 0-10 at 10/25/45/70/100/140/190/250/320/400 (memo): chat +1 (Rhovan / Delgado / any Betazoid +2),
  gift +2, first time a crewmate shows a given reaction +3, every 5 Lt levels +5, 3-D chess set / holo-novel library placed +1 a day
  each. Chat XP is capped at 8 and gift XP at the first gift per ship's day (PROG.insight.dayCap, sim-tuned to the memo pace).
  It unlocks knowledge only: a hint roll per chat (4% + 3% x Insight) reveals a hidden taste (partial = category, full = item at
  Insight x 10%; Insight 8+ upgrades partials; dislikes and sore subjects too), the opinion number at Insight 3+ (Personal Log +
  CREW RELATIONS), and the ⚠ on the risky reply of a chat-choice beat (20% + 6% x Insight, max 80%). Beats: 18% of chats with a
  named crewmate, max 2 a ship's day, lapse at day's end; a 💬 chip + Personal Log row open a 3-reply modal (BEATS in insight.js).
  Good reply +1 (normal nudge); the risky one -2 raw, reveals the sore subject and opens an apology from the next ship's day for
  2 days that gives the loss back in full. The second like of each named crewmate is seeded per save from a pool of 3 (L2_ALT in
  gift-data.js; gifts.tastesFor). No effect on readiness or promotion. Save: G.prog.insight { xp, lvl, today, n, seen, beat, apol,
  l2, notes } (migrateProg11 pins pool 0 where a second like was already learned; hardenInsight re-derives lvl from xp).
  Proof: tools/plog3-shots.js, save-fuzz v10->v11 cases + invariants, prog-sim `insight` mode (shots/plog3-sim.txt).
- js/romance.js (Personal Log phase 4 = memo phase D, romance; FINISHED after pass 09). Shiloh's rules: opt-in, the crewmate asks
  first, "I'd rather stay friends" costs nothing, any gender, everyone except T'Ren and Okafor (PROG.romance.excluded), per-crew
  Friends only, PG with a fade to black, partners NOT protected from deaths. Tuning: PROG.romance.
  - Opt-in: G.prog.romance.opt null = OFF. The one-time "Allow romantic storylines?" card sits at the top of the Personal Log until
    answered (no boot-time popup); after that a row toggles it any time. Turning it off ends an active romance gently.
  - Signal: at opinion +50 after 3 shared moments (chat / dinner / pleased gift, one a day), 30% per qualifying chat, 5 ship's days
    between signals, never while the crewmate is injured, never in the quiet period after a death (bus.js cheer gate), never for 14
    days after losing a partner or (for that crewmate) after an ending. Decline: no opinion change, never asked again by that crewmate
    unless the player reopens it from their page.
  - Stages: Interested -> Courting after 2 evenings -> Together after 5 evenings and 5 ship's days of courting. Evenings every 2 ship's
    days: dinner in quarters 40 rations, holosuite 30, Promenade free (both docked at DS9); +2 opinion each; each ends in a PG fade.
    A new partner can't be randomly transferred for 14 ship's days. The partner ends it below +20; END IT GENTLY costs -3.
  - Disclosure (memo "chain of command"): a senior-officer partner -> a note to the captain at Together; as Lt Cmdr over a non-senior
    partner -> the outrank disclosure (Okafor writes their evaluations, their opinion counts 0 for readiness).
  - Anti-farm: progression.js romanceCap() caps the partner's OPINION at +50 before the gift discount (socialCredit) and in the Fleet
    Rep banked on a transfer, and 0 under station authority, so a partner never counts more than a friend at +50.
  - Transfer or medical evacuation -> a letter thread (alumni page: write back warmly / keep it light / let it end; 2 unanswered letters
    end it warmly; +1 alumni opinion up to +50, never Fleet Rep).
  - Partner deaths go through the normal injury rules only: not an auto-favourite (the player may pin them, which turns a grave case into
    an evacuation -> letters), the pass 06 present-only rule, the pass 07-09 surgery roll and first-ack fast fix, gap / caps / gentle.
    A death gives a heavier memorial ("your partner" in In Memoriam, a supplemental log entry, one journal line instead of two) and 14
    days of grief with no romance prompts.
  - With pass 07-09: the signal, the yes (and its journal line) and an evening in the quiet period go through the bus.js cheer gate
    (sober variants; tools/cheer-scan.js knows the romance lines); dates, letters, journal lines and the UI use the crewmate's pronouns.
  - Save: v12 = G.prog.romance (memo "v10"; migrateProg12 adds a fresh, OFF state), v13 = pass 07 present time (migrateProg13);
    chain v11 -> v12 -> v13, no renumbering. hardenRomance sanitizes every load (exactly one aboard partner at an active stage, known
    ids only, excluded crew dropped, letters capped at 24, no signal unless opted in). save-fuzz covers the v11 -> v12 -> v13 cases.
  - Proof: tools/plog4-shots.js (shots/plog4-*.png at 390x844, 844x390, 1280x800 + plog4-report.json: opt-in, signal, choice,
    friends only, a date with the fade, disclosure, letters, the partner memorial from a real present-only surgery death, the quiet
    gate and pronoun checks); prog-sim `romance` mode (shots/plog4-sim.txt: stages, anti-farm audit, death safeguards).
- js/anim.js + js/art-hooks.js (animation pass): walk frames advance by distance with a step length per character and
  direction (anim.js STEP, option A: Lt side 31 / up 13 / down 15, T'Ren and crew 30 / 15 / 18, set by tools/foot-slide.js), so speed bonuses raise cadence; seeded per-crew action
  timelines (ACTION_TIMING) instead of lockstep; facing from a look-ahead with hysteresis; give-way and step-aside (AVOID);
  crew type only at data.js CONSOLES. ART HOOKS (data.js LIE_ART / SEAT_ART / TINT_BASES, empty = current render): lying =
  assets/<img>.webp, one row of 384x160 cells (A, B), head left, hip anchor (192,80); seated = 160x384 cells, columns up/down,
  rows idle A/B (+ talk A/B), hip anchor (80,300), seat spot on the node (`seat: { at, face, hip: { up, down }, stand }`);
  tint base = a v3 crew sheet with mid-grey uniform panels, department colour applied at draw time (optional <img>-mask).
  Proof: tools/anim-strips.js (shots/anim-before-* / anim-after-*), tools/anim-hook-check.js.
- assets/: harvested art. Ships are pre-keyed from magenta to alpha.
- reference/: original HTML, assets, and attachments.
- tools/: Playwright e2e scripts (tools/lt2-shots.js: Lt sprite screenshots -> shots/lt2_*.png; tools/tren-shots.js: T'Ren -> shots/tren_*.png).

## Playtest-02 fixes (2026-10-17)
- Pacing knobs added to js/pacing.js: firstLegTime, nightFaultCap, offlineHullFloor, ltDrain/ltDrainBattle, repairRep/repairParts.
- Per-deck crew light tint: DECK_LIGHT in js/data.js (retune when the new deck art lands).
- Verification tools (NODE_PATH=/workspace/pwtools/node_modules):
  tools/pt02-shots.js [base] [tag] -> shots/pt02-*-<tag>.png + shots/pt02-report-<tag>.json (390x844, 844x390, 1280x800)
  tools/pt02-offline-sim.js [base] [runs] [out.json] (real catchUp, fresh + crisis starts) ·
  tools/pt02-energy-sim.js [base] · tools/pt02-checks.js [base] · tools/pt02-tint-check.js · tools/pt02-smoke.js

## Tester pass 04 fixes (2026-10-17)
- BUG-05 regression: every control is at least 44 px (css/style.css: the pt04 block at the end). Phone stat tiles sit on 2 rows; landscape tiles use 2 columns.
  tools/tap44-check.js measures every visible control in every sheet and modal at 390x844, 844x390 and 1280x800, and fails on anything under 44 px.
- Saves: every load is type-checked and clamped (state.js sanitize, progression.js clampProg/hardenCrew). If a save still breaks the boot, it is kept
  as tenacity.save.v1.corrupt and a fresh shift starts. tools/save-fuzz.js boots the game from ~120 corrupted saves.
- The play day uses the local date (progression.js localDate). The shipment and ordnance favours charge per item and never overflow the locker.
  Decor slots never take a tap that lands on walkable floor. The trade cap is 120. Crew can carry a per-occupant `protected` flag (Thelev):
  never a random transfer, never seriously hurt or killed.
- Pacing: odd jobs between repairs (js/oddjobs.js, PROG.jobs), live hands-off auto XP x0.7 (PROG.auto) with offline auto repairs kept at x0.4
  (PROG.autoOffline), a loosened performance score, and a readiness hint naming the weakest component. Proof: tools/pt04-shots.js -> shots/pt04-*.png.
- 120-day sim (tools/prog-sim.js, 4 runs, after 6060ad1): shots/pt04-sim.txt. Regular player: active 14-16 XP/min, auto ~5.4, offline 1.0; L15 day 7, L27 day 30;
  Lt day 4 [3-7] by readiness, Lt Cmdr day 21 [16-23] (earlier runs 16), Cmdr day 43; ~1.24 crew events/week after week 1; Fleet Rep 30 at day 30.

## Tester pass 09 fixes (2026-10-18, HOLD batch; proof tools/pt09-metrics.js -> shots/pt09-{before,after}-*.png + metrics json, shots/pt09-seeds-summary.txt)
- (1) A lying figure never overhangs its bed: deck.js lieFit(bedLen) scales the figure, shadow and LIE_ART sprite to the bed (bunk 96,
  shared-room rack 120; biobed and larger racks keep 138); breathing widens only. Overhangs 2/6 -> 0/6.
- (2) Fast-fix exploit: the fast-fix timer starts on the FIRST ack only (inj.acked); a re-tap never restarts it and it keeps counting
  while away (only the patient's clock pauses). Fix 40 s after the first ack: stay 0.1714 / leave + re-tap 0.120 -> all 0.1717.
  Sanitize adds acked (no version bump).
- (3) Crew step aside only for a walker about to reach them (path within 24 px in the next 60 px), at most once per 5 s unless closer
  than 12 px; face once and hold 1.2 s; spot picks skip where someone stands or is headed (kills the hop-swivel loop). 5-seed means
  bridge/engineering/lounge: facing flips/s 0.49/0.83/0.39 -> 0.29/0.40/0.13, rapid flips -> 0, asides/min 10.1/16.6/9.1 -> 8.0/12.1/3.1.
- (4) T'Ren never walks through the Lt (re-paths >= 20 px clear or waits); nobody shares a standing spot; ONE quiet-period gate in
  bus.js (cheerful / cheer / cheerLog / cheerToast, fx drops floaters + milestones) with tools/cheer-scan.js; 7 leaks -> 0.
- (5) Head height: per-sheet / action / direction draw scale (data.js DIR_SCALE) keeps the Lt's crown at front-walk height; head jump on
  a turn 10.6 -> 2.1 px; STEP.lt.side 45 -> 48.
- Also: Fleet Rep increments clamp to 100000 (save-fuzz "everything maxed"). Death sim v6: shots/prog6-sim-v6.txt (unchanged within noise).

## Tester pass 10 fixes (2026-10-18; proof tools/pt10-metrics.js -> shots/pt10-{before,after}-*, pt07 asserts, death sim shots/prog6-sim-v7.txt)
- (1) Return floor: back from away with the system still down, the clock is at least min(clock at leave, 30 s) (injuries.js
  leftAtLeave), never a flat 30 s, so nobody comes back to more time than they left with. pt07 returnNeverMore: 5 s -> 5 s (was 30),
  29 -> 29, 100 -> 100; re-tap still needed.
- (2) Quiet period: level-up / promotion toasts and reputation praise toasts are sober through cheerToast; levelUp + promotion fx
  (gold burst, big floater, tile flash) are in bus.js CHEER_FX. cheer-scan checks them; pt07 hushGold: 4 cheerful toasts -> 0.
- (3) A crewmate who stepped aside moves off within AVOID.asideOverlapS (0.4 s) when someone stops on it, and doesn't yield to the
  person it is walking out of (escapeT). Longest Lt-on-aside overlap 5.3-6.0 s -> 0.42 s.
- (4) T'Ren blocked by the Lt fidgets (a word to him, a look along her route) and after 4.5 s with no way round goes somewhere else.
  Lt on her chair spot: frozen 17.9 s -> longest still pose 1.3 s.
- (5) Quarters bed.lieLen = the drawn rack length (154 / 192 / 192 / 173): the Lt sleeps at 138 on every rack (ltjg was 120).
- (6) Fleet Rep logs show the real change (or none at the 100000 cap), never '+50' that didn't land.

## Battle groundwork (2026-10-18; proof tools/battle-sim.js -> shots/battle-sim-{before,after}-{full,worn,hard}.json + shots/battle-sim-v1.txt, tools/battle-shots2.js -> shots/battle-*.png, tools/ship-hook-check.js)
- Structure. js/ships.js `SHIPS[id] = { name, short, a, cls, faction, side, hull, shields, speed, sprite, aspect, size, weapons: [...],
  parting, salvage, rep, evade, death, hp: { fire, torp, hit, miss, boom } }`. Ally guns: `{ id, name, kind, dmg, cd,
  cdImpaired, power, ammo, col }`; enemy guns: `{ id, name, kind, dmg, every, first, col, hits }`. `FACTIONS[k]` = hull / shade / trim /
  glow / label colours. A battle (`G.sp.battle`, saved) is `{ ctx, enterT, dying, cd, startedAt, inflight, injN, allies: [], enemies: [], target }`;
  a combatant is `{ id, ship, side, slot, hull, max, volleyT, lastVolleyAt, volleyGap }` (the Tenacity is `{ id: "tenacity", ref: "ship" }`:
  her hull / shields / power stay on G.ship). Still ONE-ON-ONE: the officers fight `foe(B)` = `enemies[target]`.
  Every ship defines `shields`: allies a max %, enemies 0 (no separate shield bar; hits land on the hull % exactly as the old enemy's did).
- Ships. Allies: USS Tenacity (Miranda class), SS Kerala (convoy freighter), IKS Ch'Tang (Klingon Bird-of-Prey) — the freighter and the
  Bird-of-Prey are defined and drawable but never join a fight yet. Enemies: Jem'Hadar fighter, Cardassian Galor, Jem'Hadar battlecruiser.
- Balance. The Galor carries the old enemy's numbers exactly (hull 100, 10-18 every 3.0-3.8 s, first volley 2.0 s, parting 8-14, salvage 3,
  speed 1): same dice, same results (battle-sim: identical to the pre-groundwork build in all three start states). The fighter is fast and
  fragile (hull 60, 7-12 every 2.1-2.7 s, first 1.3 s, 15% of the Tenacity's shots miss, jinks x1.24, salvage 2). The battlecruiser is tough
  and rare (hull 170, 12-20 every 3.4-4.2 s, first 2.4 s, jinks x0.88, salvage 5 + reputation 1; pass 13: her polarons PIERCE 0.5 -
  half of every hit the shields absorb bleeds through to the hull, hull only, no fault / injury roll; weapons without `pierce` are untouched); which enemy comes up is the encounter
  table's job (below; it replaced the groundwork's per-ship `mix: { w, gate }` of fighter 40 / Galor 50 / battlecruiser 10 from Lt + ship's day 21). The story fixes two contexts: the defector trap is a Galor, the shadow a fighter; debug drills fight
  the Galor unless asked (`startBattle("debug", { enemy })`, debug menu "Battle fighter / Galor / cruiser").
- Placeholders. render/ships.js draws each class as a clean vector silhouette in its faction colours (Starfleet grey-blue, civilian tan,
  Klingon green-grey with red trim, Dominion violet, Cardassian khaki), facing right; enemies are mirrored. Each placeholder gets a soft
  rim glow in its faction colour (one offscreen draw + shadow) so it reads against the DS9 / planet backdrops on a phone. Name + class labels under each ship (above it
  when the battle HUD is in the way). Allies left / bottom, enemies right / top. The old plates (assets/ship-tenacity.webp, ship-jemhadar.webp)
  are no longer loaded; the files stay on disk.
- Stubs, unused: `selectTarget(B, id)` / `targetOf(B)`, `combatantRows(B, ship)` (rendered into the hidden `#combatantRows` list in the
  battle HUD), `FORMATION` (3 slots a side, portrait and landscape tables) and `previewFormation(B, allies, enemies)` (tests only:
  shots/battle-roster-*.png).
- Save v14: a v13 battle's single enemy (hull / max / volleyT on the battle) migrates to a Galor combatant at the same hull; every loaded
  battle is hardened (`hardenBattle`: unknown ship -> Galor, hull / max / volley clock / cooldowns clamped, no enemies -> no battle). save-fuzz:
  11 battle cases.

## Encounter weighting (2026-10-18; proof tools/enc-shots.js -> shots/enc-*.png + shots/enc-report.json, prog-sim deaths -> shots/prog6-sim-v9.txt)
- js/encounters.js `chooseEncounter(ctx, { prog, ship, enc, forced })`: a forced type (tests, debug) > a story context (CTX_ENEMY: defector
  = Galor, shadow = fighter, debug drill = Galor) > the weighted table. Tunables in pacing.js `PACE.encounter`.
- The table (relative odds among the open rows): Jem'Hadar fighter 50 · Cardassian Galor 40 · Jem'Hadar battlecruiser 20 (pass 15; was 10).
  With the battlecruiser's gate closed the roll is fighter 56% / Galor 44%; open, 45 / 36 / 18% live (away: 1 -> about 1%, see pass 15 D2).
- The battlecruiser's gate (all must hold, `bcBlock` says which fails): rank >= Lieutenant (rank 1) AND ship's day >= 21 (the battle
  groundwork's gate, kept on the pass 12 manager's call; Lt is guaranteed by play day 7); never twice running and spaced (pass 13): at
  least 2 other battles AND at least 2 play days since the last one (`gapBattles`, `gapPlayDays`); and (pass 13 manager call: she is an
  EVENT) blocked only for a CRIPPLED ship: hull < 60% or an open CRIT fault (`minHull`, `blockSev`), and (pass 15 D1 / N1) fewer than 2
  torpedoes or main power < 30% (`minTorps` 2, `minPower` 30) -> the roll falls back to fighter / Galor and counts as `held`. A med / low fault doesn't hold her.
- `G.sp.enc = { last, since, lastBcPD, n: { type: count }, held }` (saved; additive to the v14 shape; `hardenEnc` clamps junk at load).
  Pass 13: the memory survives migration - a valid `enc` rides through every migration step untouched, and a save without one (pre-encounter
  builds, or a junk value) is rebuilt by `seedEnc` from its saved battle and the ship log's red-alert openers (a battlecruiser found there
  counts as fought on the load's play day, so the spacing holds). save-fuzz: 12 cases. Debug drills are not counted.
- Pass 13 (manager call: the battlecruiser is an EVENT). Tuned from a gated start (battle-sim `START=gated`: a mix of starts that pass the
  gate - 60% well kept: hull 85-100, shields / power 60-100, 2-8 torpedoes, a low / med fault 25% / 10%; 40% mid-voyage: hull 60-85,
  shields / power 30-80, 0-6 torpedoes, cooldowns x1.5, low / med 50% / 35%): she wins about 1 fight in 8 (Tenacity win 85.0% passive Lt /
  87.3% active Lt; T'Ren disengages 12-13%, tows 0.5-1.8%) and a WON fight still costs ~22% hull (p90 36%); injuries 1.6-2.4% a fight
  (shields hold longer, and the bleed rolls none). Before (hull 150, no pierce): 90.1 / 93.0% wins and won fights cost ~0% hull.
  Sensor warning first: Hale's "capital-class contact" log line + a "⚠ SENSORS - capital-class contact" toast, the red-alert card
  ~1.2 s later (`redAlertCard({ delay })`). Card copy (pass 15): "She outguns us — if it goes badly, T'Ren will break off. Expect
  hull damage. / Her polarons bleed through shields. Keep shields and weapons up, tubes loaded, the deck patched." (was "...maybe casualties. /
  No outrunning her..." - injuries are ~2% a fight and T'Ren does break off). No disengage option (T'Ren's automatic
  break-off below 25% hull is unchanged). A battlecruiser fought during offline catch-up (`catchUp().bcFights`: outcome, hull after, hull
  lost) is the return report's HEADLINE, first thing in `#reportBody` (`.bcHead`). Proof: tools/pt13-shots.js -> shots/pt13-*.png.
- Pass 15: Hale's sensor toast stays visible ALONGSIDE the card. The card no longer covers a toast (hud.js `fitAlertCard`: below the toast
  stack on a phone in portrait; in landscape the card steps left and the toasts sit to its right at its top, clear of the zoom buttons,
  capped at 40%; the landscape card starts at 96 px so it clears the RED ALERT banner), and the crit sensor toast is held
  until the card closes (7 s or a tap). Was: the card covered the toast at 390x844 and 844x390 and the toast left after 3.2 s.
- The warning: a battlecruiser opens with a red-alert CARD (bus.js `redAlertCard` -> hud.js `#bcCard`: "RED ALERT · CAPITAL SHIP",
  the name, two lines of what it means; below the RED ALERT banner, tap to dismiss, gone after 7 s) instead of the plain toast, plus a
  Diallo log line. Not behind the quiet-period gate (bus.js cheerful() holds back light / cheerful lines; a battle warning is a danger
  alert and must never be hushed); offline catch-up (bus quiet) skips it like every toast, the log keeps it. Fighters and Galors keep the
  "RED ALERT — <name>" toast and their fights are untouched.
- Pass 15 D2: she is weighted toward LIVE play. Live her weight is 20 (was 10; fighter 50 / Galor 40 unchanged). While the player is away
  (`nightActive()`: offline catch-up or an idle tab) the roll uses `PACE.encounter.awayWeights` (battlecruiser 1) and also needs
  `bc.awayGapPlayDays` (14) since her last fight - about one away battlecruiser per 2-3 weeks of play days. `G.sp.enc.off`
  counts away fights per type and `G.sp.enc.bcRec` keeps the last 60 battlecruiser fights `{ pd, away, h0, h1, out }` (hardened at load);
  prog-sim's ENCOUNTERS section prints LIVE vs AWAY (count, % live, first day, spacing, hull cost of won fights).
- Pass 15 D2: why away wins were cheap - hours away let every officer ability cool down, so she met a fully rested bridge (Scan + a full
  Spread, 8 torpedoes) and died in one volley: won-fight hull lost p50 0%, mean 3.5% (the offline hull floor also rules out break-off /
  tow). Now an away battlecruiser fight starts on the night watch (`PACE.encounter.bcAway`): each ability starts on cooldown at 0.8-1.0 x
  its cdMax (36 s+, so none in the fight), torpedoes capped at 4 (`torpsMax`), and T'Ren logs "The night watch has the bridge". Probe (catchUp steady state, ~190 fights):
  won-fight hull lost p50 19-22% (p25 11-12, p90 66-69 - the floor of 30% replaces break-off), like the gated live sim's p50 22%. Fighters and
  Galors have the same rested-bridge mechanism offline but their live full-ready fights are just as cheap, so they are unchanged.
- Pass 15 (manager call): LIVE she opens with a polaron ALPHA STRIKE at the bridge (`PACE.encounter.bcAlpha.knockFrac` 0.5): every officer
  ability with less than half its cdMax left (ready or nearly ready) goes to 0.5 x cdMax; one cooling longer keeps its timer (never pushed
  further). The player sees why: Hale's log line names the abilities ("Polaron alpha strike on the bridge! ... knocked offline - half recharge")
  and a crit toast "ALPHA STRIKE - n bridge abilities knocked offline" that stays clear of the card like the sensor toast (toast overflow now
  evicts non-crit toasts first). Away fights keep the night watch start instead (its 0.8-1.0 x cdMax already exceeds the knock, so no
  double penalty). Rested-bridge probe (full ship, 8 torpedoes): won-fight hull lost p50 0% -> 22.8%, wins 100%; 2 torpedoes p50 42.5%.
  Gated battle-sim (2000): passive win 88.5% -> 84.2%, won p50 22.1 -> 23.8% · active 90.8% -> 86.9%, won p50 22.5 -> 24.1%.
  Debug drills (battle-sim) get the strike too. Proof: tools/pt15-shots.js -> shots/pt15-alpha-*.png.
- Pass 15 N1: she needs >= 2 torpedoes (power floor stays 30). battle-sim `START=worst` (the worst start that passes the gate: hull 60,
  power 30, shields 20, one MED fault, cooldowns x1.5; torpedoes = minTorps or WORST_TORPS), 1000 fights, with the alpha strike:
  1 torpedo: win 0% · break off 61.6% · TOW 38.4% (passive) / 38.4% (active) -> 2 torpedoes: win 1.2-1.4% · break off 61-62% · TOW 37.7%
  (passive) / 36.5% (active). The tow rate barely moves: the harshness is hull 60 + shields 20 + power 30, not the tubes (as the tester found).
- Pass 15 L1-L3 (card layout): L1 at 360x640 / 667x375 the card is height-capped inside the stage (copy scrolls, TAP TO DISMISS pinned;
  tighter type below 380 px wide / 400 px tall; a portrait phone with no room under the toasts keeps the card under the banner and moves the
  toasts below it). L2 resize / orientationchange re-run the layout (now, next frame, +200 ms). L3 the crew-safety prompt, board, spec and
  disclosure wait while the card is up. Proof: tools/pt15-shots.js -> shots/pt15-alpha-fit-{360x640,667x375}.png, pt15-rotate-*.png,
  pt15-safety-{queued,after}-*.png.
- Pass 15: death attribution - an injury carries `src` (battle: the enemy ship id, hazard: the hazard kind), the death audit keeps it, and
  prog-sim prints DEATH ATTRIBUTION (cause:source x surgery / timeout, per 120 play days) and the battlecruiser-linked death rate.

## Ship sprites (art hook; the artist's copy is notes/ship-sprite-spec.md)
- Hook: `SHIP_ART[sprite] = { img, len?, pivot?, rows?, engine? }` in js/data.js, keyed by `SHIPS[id].sprite` (tenacity, freighter,
  klingon_bop, jh_fighter, galor, jh_battlecruiser). `img` is an asset key: assets/<img>.webp, preloaded with every plate. `img: null` or a
  missing file = the vector placeholder. Proof: tools/ship-hook-check.js (stand-in sheets, no files added).
- Sheet (`SHIP_SHEET`): cells 512 x 256 px; one row per state, frames left to right; the ship FACES RIGHT in every cell (the game mirrors
  enemies). Pivot (256, 128) = the ship's visual centre; the ship's nose-to-tail length is `len` px (default 448), which the game scales to the
  class's on-screen length (Miranda = 1; Galor 0.68, fighter 0.44, battlecruiser 0.9, freighter 0.9, Bird-of-Prey 0.6). Keep the hull inside
  len x len/aspect around the pivot (aspects: Miranda 3.5, freighter 3.2, BoP 2.0, fighter 2.1, Galor 2.6, battlecruiser 2.3) so labels and
  beams line up; glow and debris may spill into the rest of the cell.
- Rows, top to bottom: 0 idle (4 frames, 6 fps, loop) · 1 firing (4, 12 fps, once) · 2 damaged (4, 6 fps, loop; replaces idle below 35% hull)
  · 3 shieldsHit (4, 14 fps, once) · 4 explode (8, 10 fps, once; holds the last frame while the game fades the ship over 1.3 s) · 5 engine
  (4, 8 fps, loop; OPTIONAL glow-only overlay drawn additively on top of every state). A sheet may stop after any row: missing rows fall back to
  idle, and a sheet without row 5 just has no overlay. Per-ship overrides: `rows: { firing: { frames: 6 } }`, `engine: false`.
- Beams, torpedoes, shield bubbles, floaters and explosions stay game-drawn; their anchor points are `SHIPS[id].hp` (fractions of the ship's
  box, facing right), so paint muzzles near hp.fire / hp.torp.


## Pass 12 HOLD fixes (2026-10-18; proof tools/romance-scan.js, tools/pt12-awaystay.js -> shots/pt12-awaystay-{before,after}[-near].json)
- HOLD 1: romance lines in the SHIP log carry `tag: "rom"` (bus.js `log(msg, cls, tag)`, `cheerLog(..., tag)`); while romance is off
  (`opt !== true`) hud.js skips them (romance.js `romLogHidden`; lines from older saves are recognised by their wording) and the shift
  report's highlights drop them; toggling the setting re-renders the log, so turning romance back on shows the history again. The
  opt-out confirmation and the single neutral "lost touch" line stay. The partner memorial lines in injuries.js are not tagged (they
  are a death, not a romance scene). romance-scan scans the rendered ship log (whole history) and an off-after-a-full-history case.
- HOLD 2: faults.js `medFrozen()` keeps a seen patient's system frozen (the Lt's walk / repair, night crew, handover, Miracle Worker) not
  only while away but on the first tick back (`away` / `paused`) and through the re-ack hold (`inj.reack` until `firstAck`), and the
  re-ack tick runs the clock, so the Lt never moves in a tick the clock didn't.
- Minors: endIt's swallowed line restored (stale disclosure cleared, `n.ended++`); the "no longer auto-protected" notice only for a
  former favourite; four sober quiet-period ship-log lines, never the same twice running; a journal `{X}` that opens a sentence is
  capitalised; the battlecruiser's class line is "Dominion capital ship".
- Pass 15 (build09 journal): build09 wrote BOTH a plain death entry and the "lostpartner" entry for a partner, so with romance off the
  journal showed two neutral death lines ("We lost Tull today..." + "Tull is gone. I wrote the letter home..."). plog.js `dedupeGone`
  keeps one per crewmate at render time (the romance entry while on, the plain one while off; same for a plain transfer next to a
  "letter" v2). Proof: romance-scan `off_build09` loads a real build09 save (tools/fixtures/rom-build09-lostpartner.json, made on
  efdb4b8; its death entry pinned to v1, the line the tester saw) - fails before (2 death lines on and off), passes after.

## Art batch 1 (2026-10-18; sources copied from the artist's sprites/ folder into assets/src/, proof tools/lie-seat-fit.js -> shots/art1-fit.json, tools/art1-shots.js -> shots/art1-<room>-<size>.png, tools/anim-hook-check.js)
- **Thelev** (thelev_v1, Andorian, she/her, gold, NOT tinted): own sheet `assets/thelev-v1.webp` via `OWN_SHEETS.thelev -> "andorian"`.
  **Male crew base** (crew_male_v1, mid-grey panels + mask): `TINT_BASES['crew-male-v1']`; every man without his own sheet wears it
  in department colour (women keep the T'Ren body). Both packed from the hi-res masters by `tools/pack-masters.py` (per-frame
  scale from measurements.json, 240x288 cells / anchor 120,280 = `SHEET_CELL`, so the masters' weld sparks are not clipped).
  Steps (tools/foot-slide.js): side 29 / up 8 / down 15.
- **Lying** (lie_v1): `LIE_ART` lie-lt, lie-patient, lie-patient-red/-gold/-blue (768x160, A + breathing B, hip 192,80). Body
  84.6 design px; fits every bed with lieFit 1: bunk 96 (margin 11.4), biobed / sickbay beds 150 (65.4), quarters racks 154-192.
- **Seated** (seat_v1): `SEAT_ART` seat-lt, seat-tren (idle A/B, talk A/B; hip 80,300; no chair drawn). Bridge chair seat
  y .41: seated hip 1.6 design px from the painted cushion centre. seat-tren is loaded; T'Ren still stands by design.
- **Doors** (decks_doorfix_v1): deck-berthing (walk grid unchanged), deck-medical full raise; medical lift node y .6875
  (walk-medical regenerated by tools/make-walk-masks.py). Person/door at FIG_H 83: berthing cabin 0.86, berthing lift 0.85, medical lift 0.86.

## Pass 16 HOLD fixes (2026-10-18; proof tools/pt16-livefight.js -> shots/pt16-livefight-{before,after}.json, tools/pt16-alert.js -> shots/pt16-alert-*)
- **B1** a fight that started live (`battle.live`, saved) keeps live rules to the end: `offRules()` (= nightActive && !liveFight)
  gates the offline hull/power floors, night-crew patching and the x0.006 injury rate. `catchUp()` never simulates while a
  live-started fight is open: the gap goes to `G.sp.awayDefer` and runs (with its report) once the fight is over. Hidden =
  frozen at any length; reload / reopen resumes the same fight live. Hard-kill with no exit save still rolls back to the last
  5 s autosave (N5).
- **B2** the red-alert card moves into a body-level `#alertLayer` over the stage while up (above every modal); auto-opened
  prompts step aside (still owed; the board no longer opens mid-fight); the 7 s auto-hide counts only time it is visible and on top.
- **B3** opaque pinned TAP TO DISMISS strip. **B4** Hale's alpha-strike line names "Attack Pattern Analysis".
