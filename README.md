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
- js/battle.js: the battle, officer AI, abilities, tow to DS9, and space FX state.
- js/sim.js: the fixed-order step and offline catch-up.
- js/render/deck.js: the camera (follow, zoom, pan), plates, sprites, rings, and the turbolift overlay.
- js/render/space.js: backdrop crossfade, ships, beams, torpedoes, shields, and explosions.
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
- js/romance.js (Personal Log phase 4 = memo phase D, romance; save v12, the memo's "v10"). Opt-in (prog.romance.opt null = off;
  card in the Personal Log index, toggle any time). Any gender; everyone except T'Ren and Okafor (PROG.romance.excluded). The crewmate
  signals first: at opinion +50 after 3 shared moments (chat / dinner / pleased gift, one a day), 30% a day, 5-day gap; decline costs
  nothing (never asked again by that crewmate unless the player reopens). Per-crew FRIENDS ONLY toggle. Dates (dinner 40 rations,
  holosuite 30, Promenade free at DS9; every 2 days) end in a PG fade to black; Courting after 2 dates, Together after 5 dates and
  5 days. Disclosure (memo): senior partner -> to the captain at Together; Lt Cmdr over a non-senior partner -> outrank disclosure.
  Partner below +20 ends it; END IT GENTLY costs -3. Transfer -> letter thread (alumni page, reply warm/light/end, +1 alumni opinion,
  no Fleet Rep). Partners are not auto-protected (excluded from the auto top-2 favourites; normal safeguards only); their death gives a
  heavier memorial + personal log entry. Anti-farm: romanceCap() caps partner opinion at +50 in readiness social share and transfer
  Fleet Rep, and 0 for readiness under authority. Tuning in PROG.romance. Proof: tools/plog4-shots.js, save-fuzz v11->v12 cases +
  invariants, prog-sim `romance` mode (shots/plog4-sim.txt, anti-farm and safeguard assertions).
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
