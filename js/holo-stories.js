// Holodeck multi-beat stories (Oct 27 invite build). Variants: >=3 per program x category; talk lines for co-stars.
// Tokens: {lead}/{leads}/{co}/{Co}/{named} + pronouns {coThey}/{coThem}/{coTheir}/{coTheirs}/{coThemself}/{coIs}/{coHas}/{coS}
// (and {CoThey}… capitalized; {leadThey}… when lead is a crewmate). Partner category is romance-gated at pick time. US spelling.
export const STORIES = {
  tactical_sim: {
    solo: [
      { beats: ["Kobayashi Maru, variant 12. The bridge lights go red before the first hail finishes.", "Three Klingon cruisers decloak on the beam. Shields fold like wet paper.", "Nobody gets out alive. The drill is in losing well, and the hands remember."] },
      { beats: ["A simulated Excelsior under red alert. The odds board reads hopeless in four fonts.", "Torpedo rooms jam. The conn freezes. Someone on the recording is already screaming.", "The reset tone is almost kind. Run it again. The third time is almost clean."] },
      { beats: ["Cardassian ambush in the Badlands, take three. Plasma washes the saucer in orange.", "The computer cheats — of course it does. A wingman vanishes into static.", "You limp out on impulse with half a crew listed as missing. Good practice anyway."] },
    ],
    friend: [
      { beats: ["{Co} takes tactical before the sensors finish painting. The freighter captain {coThey} play{coS} begs badly enough to draw laughs.", "The second volley should end you. It doesn't. {Co} calls targets like {coThey} {coHas} been waiting all week.", "The sim ends in a draw, which almost never happens. {Co} looks smug. Fair."], talk: [["you", "You're early on the board."], ["{Co}", "Somebody has to keep you honest."], ["you", "Draw counts. Don't get used to it."]] },
      { beats: ["Freighter in the kill zone, Klingons on the fringe. {Co} is the panicked captain and somehow still helpful.", "You talk them through a bow-shot that shouldn't work. It works twice.", "When the lights come up, {Co} is already filing the 'we lived' joke."], talk: [["{Co}", "For the record, I hated that freighter accent."], ["you", "For the record, it saved the run."], ["{Co}", "Buy me a drink and we'll call it even."]] },
      { beats: ["Ambush drill. {Co} on your wing, talking too much, shooting better than {coThey} talk{coS}.", "A lucky hit drops your shields. {Co} covers the hole without being asked.", "You both limp home. The computer marks it a partial. You'll take it."], talk: [["you", "That cover was clean."], ["{Co}", "Don't sound surprised."], ["you", "I'm updating my expectations."]] },
    ],
    rival: [
      { beats: ["The computer casts {co} as the Klingon commander. The gloating is a little too practiced.", "Every order you give gets a padd note. The notes are not kind.", "You still take the win by a hair. {Co} logs the loss like a threat."], talk: [["{Co}", "Sloppy on the roll."], ["you", "You're welcome for the target practice."], ["{Co}", "Next time I won't miss."]] },
      { beats: ["{Co} is the evaluator in a Starfleet observer's uniform that somehow looks judgmental.", "{CoThey} freeze{coS} the sim mid-volley to lecture on spacing. You restart colder.", "The scoreboard favors you. {Co}'s face does not."], talk: [["you", "Still counting?"], ["{Co}", "Every mistake."], ["you", "Add 'finished the run' to the list."]] },
      { beats: ["Rival on the opposite bridge. Same map, worse manners.", "{CoThey} bait{coS} you into a head-on pass. You refuse and cut under.", "The computer calls your win 'acceptable.' {Co} calls it luck."], talk: [["{Co}", "Luck."], ["you", "Keep telling yourself that."], ["{Co}", "I will. Loudly."]] },
    ],
    partner: [
      { beats: ["The Maru again. {Co} takes the helm beside {lead} and refuses, flatly, to accept a no-win scenario.", "Three cruisers decloak. Under the console, a squeeze of the hand — then the evasive pattern.", "You still lose. You lose together. The lights come up softer than they should."], talk: [["you", "You don't have to take the helm."], ["{Co}", "I do if you're on it."], ["you", "Then we go down proper."]] },
      { beats: ["Night-shift variant. Empty bridge, just the two of you and a cheating computer.", "When the shields fail, {co} is already pulling power from life support with a look that says don't argue.", "Afterwards nobody lets go of the chair for a moment too long."], talk: [["{Co}", "Again?"], ["you", "Again."], ["{Co}", "Good. I wasn't done being angry at this program."]] },
      { beats: ["You brief the no-win like it's new. {Co} smiles like {coThey} {coHas} heard every version.", "Mid-fight {coThey} override{coS} your order — correctly. You forgive {coThem} mid-explosion.", "Reset. Foreheads touch, briefly, before the next load."], talk: [["you", "That override was insubordinate."], ["{Co}", "You're welcome, {named}."], ["you", "…Fair."]] },
    ],
    acquaintance: [
      { beats: ["You invited {co} on a maybe. {CoThey} showed. The Maru doesn't care about manners.", "{CoThey} keep{coS} to {coTheir} station, precise, quiet, not quite warm.", "You both survive longer than average. A nod at the end counts as a beginning."], talk: [["you", "Thanks for coming."], ["{Co}", "Don't waste it."], ["you", "Wasn't planning to."]] },
      { beats: ["First shared drill. {Co} doesn't small-talk. The computer does enough talking for everyone.", "A bad call on your part; {coThey} cover{coS} without commentary.", "Afterward: a short 'not bad.' You'll take that too."], talk: [["{Co}", "Your roll was late."], ["you", "Noted."], ["{Co}", "So was mine. Once."]] },
      { beats: ["Awkward start. {Co} stands too straight. You stand too casual.", "Halfway through the ambush you start moving like a team by accident.", "The score is mediocre. The silence after is almost friendly."], talk: [["you", "Same time next week?"], ["{Co}", "Ask me when I'm less busy."], ["you", "That's a maybe. I'll take it."]] },
    ],
  },
  warp_core_breach: {
    solo: [
      { beats: ["Antimatter containment at 12 percent and falling. Klaxons, steam, a stuck valve.", "The right answer is ugly and fast. You take it.", "The core holds, barely. Your hands smell like coolant for an hour."] },
      { beats: ["Utopia Planitia drill: three cascading faults, one right sequence.", "You miss the second the first time. The computer is not gentle about it.", "Second run: clean. The silence after the all-clear is the prize."] },
      { beats: ["Coolant rupture on a simulated Ambassador-class. Old hull, old sins.", "The hands remember what the mind forgets. A patch, a bypass, a prayer you don't say aloud.", "Green lights. You sit on the deck plating and breathe."] },
    ],
    friend: [
      { beats: ["{Co} plays the panicking ensign, then quietly fixes the plasma leak while {lead} argues with the simulated chief.", "Four seconds to spare on the clock. {Co} looks offended it wasn't five.", "You both laugh once, short and mean, the way engineers do."], talk: [["{Co}", "You talk too much in a breach."], ["you", "You fix too much without credit."], ["{Co}", "Put it in the log. I dare you."]] },
      { beats: ["Okafor's own scenario — or close enough. {Co} on the other side of the core.", "A misread on the intermix. You catch it; {coThey} catch{coS} the next.", "The sim reports spare seconds. You spend them not talking about the war."], talk: [["you", "Nice catch."], ["{Co}", "Don't make me do your job."], ["you", "Wouldn't dream of it."]] },
      { beats: ["Breach drill as a two-person band. {Co} handles valves; you handle the computer's spite.", "Something sparks that shouldn't. You both swear the same word.", "All clear. Shoulder bump. Done."], talk: [["{Co}", "We're getting too good at almost dying."], ["you", "Occupational hazard."], ["{Co}", "Buy the synthale anyway."]] },
    ],
    rival: [
      { beats: ["{Co} is cast as the Utopia Planitia inspector, sighing at every coolant valve.", "{CoThey} grade{coS} your patch like a personal insult. You still pass.", "The computer agrees with you. That almost hurts {coThem} more."], talk: [["{Co}", "Sloppy torque."], ["you", "Still green."], ["{Co}", "Luck isn't engineering."]] },
      { beats: ["Scenario: {co} as the ensign who caused the breach. Deeply satisfying.", "You talk {coThem} through the fix with heroic patience you do not feel.", "{CoThey} thank{coS} you in a tone that could cut bulkhead."], talk: [["you", "Try not to break my core."], ["{Co}", "It's a simulation."], ["you", "So is your gratitude."]] },
      { beats: ["Rival on damage control. Same room, different religions about procedure.", "{CoThey} override{coS} a call. Wrong. You override back. Right.", "The core holds. The argument will continue in the Mess."], talk: [["{Co}", "I had it."], ["you", "You had a funeral."], ["{Co}", "We'll revisit this."]] },
    ],
    partner: [
      { beats: ["Breach in ninety seconds. {Co} reads the intermix ratios aloud in a calm voice meant only for {lead}.", "The core goes critical. {CoThey} {coIs} the one who makes the ejection call.", "Afterwards nobody lets go of anybody for a long moment."], talk: [["you", "You shouldn't have to make that call."], ["{Co}", "I'd rather it be me than a stranger."], ["you", "Stay close."]] },
      { beats: ["Steam and red lights. {Co}'s hand finds yours behind the console, once.", "You finish the bypass together. The computer almost sounds impressed.", "Foreheads, briefly. Then professionalism like a coat."], talk: [["{Co}", "You're shaking."], ["you", "So are you."], ["{Co}", "Then we match."]] },
      { beats: ["Night drill. Just the two of you and a dying star in a bottle.", "{Co} swears mid-sequence, then apologizes to the warp core out of habit.", "Green. A kiss that tastes like coolant. You both pretend that's normal."], talk: [["you", "Again tomorrow?"], ["{Co}", "If the ship lets us."], ["you", "I'll pencil in the apocalypse."]] },
    ],
    acquaintance: [
      { beats: ["{Co} accepted the invite with a shrug. The breach does not shrug.", "You work opposite sides of the core, polite and precise.", "Spare seconds. A nod. The start of something that isn't friendship yet."], talk: [["you", "Good timing on the bypass."], ["{Co}", "I read the manual."], ["you", "More people should."]] },
      { beats: ["First shared engineering sim. {Co} corrects your clamp angle without looking at you.", "{CoThey} {coIs} right. You hate that a little. You use it.", "All clear. 'Thanks' lands awkward and honest."], talk: [["{Co}", "Don't take it personal."], ["you", "The correction? Or the tone?"], ["{Co}", "Yes."]] },
      { beats: ["Quiet professionals. The computer tries to kill you both anyway.", "Halfway through you stop saying 'please' and start saying 'now.'", "It works. You're not friends. You're effective."], talk: [["you", "Same page?"], ["{Co}", "Same core."], ["you", "Close enough."]] },
    ],
  },
  klingon_calisthenics: {
    solo: [
      { beats: ["Mok'bara at dawn in a stone hall. The instructor shouts in Klingon until your arms shake.", "Every muscle complains. The mind finally goes quiet.", "You walk out sore and strangely grateful. Safeties were on. Barely."] },
      { beats: ["Bat'leth forms until the arms burn. Holo-warriors bang their mugs at the end.", "You miss a beat, eat a flat of the blade, swear, reset.", "Level complete. Tomorrow will hurt in places you forgot you had."] },
      { beats: ["Level 3. The safeties are the only reason anyone walks out.", "Bloodwine on the table you don't drink. The forms don't care.", "You leave the hall lighter, which makes no sense and is the point."] },
    ],
    friend: [
      { beats: ["{Co} joins the forms and loses three bouts with tremendous dignity.", "The holo-instructor praises {coThem}. {CoThey} will be insufferable for days.", "You both limp to the Mess like heroes of a very small war."], talk: [["{Co}", "I had him."], ["you", "You had the floor."], ["{Co}", "Details."]] },
      { beats: ["Sparring partners. {Co} talks trash in two languages.", "You take a hit you deserved. {CoThey} help{coS} you up without making a speech.", "End bell. Water. The good kind of tired."], talk: [["you", "Your form's getting mean."], ["{Co}", "I learned from watching you lose."], ["you", "Friendly fire."]] },
      { beats: ["Bat'leth doubles. {Co} keeps forgetting which end is polite.", "The computer dockets a foul. You both argue with it and lose.", "Worth it."], talk: [["{Co}", "That call was garbage."], ["you", "We were garbage."], ["{Co}", "Speak for yourself."]] },
    ],
    rival: [
      { beats: ["The computer hands {co} a d'k tahg and the role of challenger.", "It ends with both of you on the mat, breathing like engines.", "Neither says 'good match.' Both think it."], talk: [["{Co}", "You're slower."], ["you", "You're louder."], ["{Co}", "Loud still counts."]] },
      { beats: ["{Co} watches from the edge, arms folded, unimpressed.", "The forms get done twice as hard. Of course they do.", "A short nod at the end. Progress, of a kind."], talk: [["you", "Notes?"], ["{Co}", "Don't telegraph the high cut."], ["you", "Was that a compliment?"]] },
      { beats: ["Rival bout, full contact, safeties humming.", "{CoThey} score{coS}. You score. The computer calls it even like a joke.", "You leave before the argument starts. It will find you later."], talk: [["{Co}", "Even is pity."], ["you", "Even is math."], ["{Co}", "We'll fix the math."]] },
    ],
    partner: [
      { beats: ["{Co} turns up with a bat'leth and a grin. The forms become a duel. Nobody keeps score.", "Close work. Breath shared. The holographic Klingons look politely away.", "Afterwards, bruises and a soft laugh against your shoulder."], talk: [["you", "You're showing off."], ["{Co}", "For an audience of one."], ["you", "Keep going."]] },
      { beats: ["Slow forms, close enough to count eyelashes.", "A slip, a catch, a kiss that is absolutely not in the syllabus.", "You finish the set anyway. Discipline is a love language."], talk: [["{Co}", "Focus."], ["you", "I am."], ["{Co}", "On the blade, {named}."]] },
      { beats: ["Level 2 together. You let {coThem} take you down once on purpose. {CoThey} know{coS}.", "Payback is immediate and fair.", "Water break turns into forehead-to-forehead quiet."], talk: [["you", "Truce?"], ["{Co}", "Until tomorrow."], ["you", "I'll stretch."]] },
    ],
    acquaintance: [
      { beats: ["{Co} said yes to the forms like it was a chore. {CoThey} move{coS} like it isn't.", "Little talk. Clean contact. Respect shows up before friendship does.", "End bell. A handshake that isn't soft."], talk: [["you", "You train."], ["{Co}", "I survive."], ["you", "Same difference tonight."]] },
      { beats: ["First spar. {Co} measures you like a problem set.", "You give {coThem} nothing cheap. {CoThey} return{coS} the favor.", "Even match. Maybe later you learn first names properly."], talk: [["{Co}", "Again sometime."], ["you", "That's nearly friendly."], ["{Co}", "Don't push it."]] },
      { beats: ["Quiet hall. Two people who don't know each other's jokes yet.", "Halfway through, timing clicks. The computer notices before you do.", "A short 'well fought.' You'll remember it."], talk: [["you", "Well fought."], ["{Co}", "You too."], ["you", "See you on the real deck."]] },
    ],
  },
  vulcan_garden: {
    solo: [
      { beats: ["Red sands under a white sun. A gong somewhere far off.", "The breath slows. The week falls away in pieces.", "By two hundred counts the shoulders have dropped. That is the whole win."] },
      { beats: ["A ridge above ShiKahr. Stones, sand, the long silence after.", "You almost fall asleep. The program counts it as success.", "You leave quieter than you arrived. The ship will be loud again soon."] },
      { beats: ["Meditation program, stern voice, no shortcuts.", "Thoughts about the Dominion try to queue. You let them pass like weather.", "Session end. Water. No alarms in your head for once."] },
    ],
    friend: [
      { beats: ["{Co} tries meditation and falls asleep in eleven minutes. It still counts.", "You rake sand in long lines beside {coThem} while {coThey} snore{coS} politely.", "{CoThey} wake{coS} embarrassed. You pretend you saw nothing. Bonding."], talk: [["{Co}", "How long was I out?"], ["you", "Long enough to improve your score."], ["{Co}", "I'm deleting the log."]] },
      { beats: ["Shared garden. {Co} talks once, then takes the hint.", "Red sky does the rest. You leave with matching calm.", "On the way out {coThey} admit{coS} it helped. You don't gloat. Much."], talk: [["you", "Come back next week."], ["{Co}", "If the war allows."], ["you", "We'll pencil the war out."]] },
      { beats: ["{Co} rakes like {coThey} {coIs} mad at the sand. Eventually the sand wins.", "Quiet lands on both of you at the same time.", "No jokes for a full minute. A record."], talk: [["{Co}", "This is stupid."], ["you", "And?"], ["{Co}", "…Fine. It works."]] },
    ],
    rival: [
      { beats: ["The computer casts {co} as a disapproving Vulcan master. Posture notes. Repeatedly.", "You correct nothing {coThey} say{coS}. That annoys {coThem} more than argument.", "Session ends. {CoThey} leave{coS} first. You stay one extra breath out of spite."], talk: [["{Co}", "Your shoulders are wrong."], ["you", "Noted, master."], ["{Co}", "Don't call me that."]] },
      { beats: ["{Co} turns up mid-meditation to complain about the duty roster.", "Even the garden can't fix that. You finish the count anyway.", "{CoThey} wait{coS}. You both walk back in a truce made of silence."], talk: [["you", "Roster later."], ["{Co}", "Roster now."], ["you", "Garden first. Then war."]] },
      { beats: ["Rival meditation. Competitive calm. A stupid idea that almost works.", "{CoThey} break{coS} first with a sigh. You don't smile. Externally.", "The program awards you both 'adequate peace.' Insulting. Accurate."], talk: [["{Co}", "Adequate."], ["you", "I'll frame it."], ["{Co}", "Please don't."]] },
    ],
    partner: [
      { beats: ["Sand, stone, silence. {Co} sits beside {lead} on warm rock and says nothing for an hour. Exactly right.", "At dusk {coThey} arrange{coS} the stones wrong on purpose, just to make {lead} smile.", "You fix the stones together. Hands linger."], talk: [["you", "You ruined my pattern."], ["{Co}", "I improved your evening."], ["you", "Guilty."]] },
      { beats: ["Shared breath counts. {Co}'s shoulder against yours, light as a secret.", "The war stays outside the forcefield for thirty blessed minutes.", "When the program ends you don't stand up right away."], talk: [["{Co}", "Stay."], ["you", "Already am."], ["{Co}", "Good."]] },
      { beats: ["{CoThey} lead{coS} the meditation badly on purpose. You laugh once, soft.", "Real quiet follows. The kind you only get with someone who knows your noise.", "A kiss at the gate, quick, before the corridor."], talk: [["you", "That was not Surak."], ["{Co}", "Surak never met you."], ["you", "Flattery will get you another session."]] },
    ],
    acquaintance: [
      { beats: ["{Co} sits at a polite distance. The garden allows that.", "No chatter. Shared air. When it's over, a civil thank-you.", "Not friends. Not strangers as hard as before."], talk: [["you", "Thanks for coming."], ["{Co}", "It was… quiet."], ["you", "That's the idea."]] },
      { beats: ["First garden invite. {Co} looks suspicious of peace.", "Halfway through, the suspicion softens. Not gone. Softer.", "You don't push. Good instincts."], talk: [["{Co}", "I still don't get it."], ["you", "You don't have to."], ["{Co}", "Hmm."]] },
      { beats: ["Two people, one program, careful space.", "The computer's voice is the only third wheel.", "End. A nod. Door."], talk: [["you", "Same time?"], ["{Co}", "Maybe."], ["you", "I'll hold the maybe."]] },
    ],
  },
  dixon_hill: {
    solo: [
      { beats: ["San Francisco, 1941. A missing necklace, a fat man with a gun, a fedora that fits.", "Fog off the Bay on cue. The client lies in the first sentence.", "You solve it anyway. The night ends with jazz and no alarms."] },
      { beats: ["Dixon Hill and the case of the green sedan.", "Three wrong turns, one right fist, a confession in an alley that smells like coffee.", "The program tips its hat. You tip yours back."] },
      { beats: ["Holonovel night: trench coat, rain, a dame with a problem that isn't hers.", "You follow the money until it bites. Then you follow the teeth.", "Case closed. Soft credits. Real shoulders dropping."] },
    ],
    friend: [
      { beats: ["{Co} plays the hapless police lieutenant who arrests the wrong man twice.", "The case still gets solved. Mostly because you ignore {coTheir} badge.", "Afterwards {coThey} buy{coS} the first round in Vic's. Or try to. The computer won't take latinum."], talk: [["{Co}", "I almost had him."], ["you", "You almost had the florist."], ["{Co}", "Details."]] },
      { beats: ["{Co} is the bartender at the Little Sparrow with opinions about every suspect.", "Half of {coThem} are useful. The other half are comedy.", "You close the case. {CoThey} close{coS} the bar. Fair trade."], talk: [["you", "Your tip on the sedan was good."], ["{Co}", "My tips are always good."], ["you", "Your coffee isn't."]] },
      { beats: ["Buddy-cop variant. {Co} talks; you shoot the locks; ethics optional.", "A chase across wet bricks. You both look ridiculous. It works.", "Credits. Shoulder clap. Back to the war."], talk: [["{Co}", "We looked cool."], ["you", "We looked wet."], ["{Co}", "Cool and wet."]] },
    ],
    rival: [
      { beats: ["Cyrus Redblock, played by {co}, cigar and a terrible accent.", "You cuff {coThem} at the end with feeling.", "{CoThey} break{coS} character to say you'll pay for that. You smile like Dixon."], talk: [["{Co}", "This accent is a hate crime."], ["you", "Commit to the bit."], ["{Co}", "I committed. You enjoyed it."]] },
      { beats: ["{Co} as the crooked councilman. The handcuffs feel earned.", "{CoThey} improvise{coS} a speech about your 'tin star morals.' You let {coThem} finish.", "Then the lights. Scoreboard likes you. {CoThey} {coDont}."], talk: [["you", "Nice speech."], ["{Co}", "Nice betrayal."], ["you", "It's a noir. Keep up."]] },
      { beats: ["Rival on the other side of the desk. Same city, colder manners.", "{CoThey} almost out-deduce you. Almost.", "You tip the fedora. {CoThey} tip{coS} nothing."], talk: [["{Co}", "Lucky guess."], ["you", "Lucky living."], ["{Co}", "Next case."]] },
    ],
    partner: [
      { beats: ["Dixon Hill's office. The door opens and {co} walks in as the mysterious client — trouble and good shoes.", "Rain on the window. Jazz. {CoThey} know{coS} more than anyone should.", "The case is solved. The evening isn't over."], talk: [["you", "You're not here about a necklace."], ["{Co}", "Astute."], ["you", "Stay after the credits."]] },
      { beats: ["Partners in the trench coat sense. {Co} has your back in the alley and your collar in the quiet.", "A kiss that tastes like rain and bad coffee.", "You finish the mystery because leaving it open would be rude."], talk: [["{Co}", "Focus, detective."], ["you", "I am focusing."], ["{Co}", "On the case, {named}."]] },
      { beats: ["Soft noir. Soft lighting. Hardly any gunfire.", "{Co} plays the stranger who becomes less strange by the second act.", "End card. Real hands. No audience."], talk: [["you", "Same case next week?"], ["{Co}", "Different case. Same partner."], ["you", "Book it."]] },
    ],
    acquaintance: [
      { beats: ["{Co} agreed to noir with a look that said 'this better be good.'", "{CoThey} play{coS} the informant, dry and exact. Helpful despite {coThemself}.", "Case closed. A short 'fine evening.' Progress."], talk: [["you", "You were good in the alley."], ["{Co}", "I stood there."], ["you", "Professionally."]] },
      { beats: ["First shared holonovel. {Co} refuses the fedora. You respect that.", "{CoThey} still deliver the clue that cracks it.", "Nod at the door. Not nothing."], talk: [["{Co}", "Don't make this a habit."], ["you", "No promises."], ["{Co}", "Hmm."]] },
      { beats: ["Polite mystery. Careful distance. Shared plot.", "Halfway through you stop apologizing for the genre.", "{CoThey} almost smile at the twist. You'll take almost."], talk: [["you", "Thanks for the assist."], ["{Co}", "Don't mention it."], ["you", "I won't. Out loud."]] },
    ],
  },
  captain_proton: {
    solo: [
      { beats: ["Black and white. Rocket ships on strings. Doctor Chaotica's death ray aimed at Earth. Again.", "You monologue. The satan robot walks very slowly.", "Chapter saved. Dignity optional. Fun mandatory."] },
      { beats: ["Fortress of Doom, chapter 7. Cardboard cliffs, real laughter.", "You swing on a rope that shouldn't hold. It holds because the story says so.", "Credits in a font that hurts. Worth it."] },
      { beats: ["Grayscale serial night. You fight the Moon Men with a ray gun that clicks.", "Mid-fight you forget the war for a whole glorious minute.", "End title. Back to color. Back to duty."] },
    ],
    friend: [
      { beats: ["{Co} plays Buster Kincaid with a tinfoil helmet and enormous enthusiasm.", "You are Captain Proton. The Mess can hear the narrator voice from here.", "Earth is saved. Your reputation is not. Acceptable."], talk: [["{Co}", "Did you see my dive?"], ["you", "The whole deck saw your dive."], ["{Co}", "Good."]] },
      { beats: ["{Co} narrates the chapter cards in a booming voice.", "You corpse twice. The computer waits patiently like a saint.", "Chapter complete. You both hurt from laughing."], talk: [["you", "Tone it down."], ["{Co}", "Never."], ["you", "Fine. Louder."]] },
      { beats: ["Buddy serial. {Co} refuses to need rescuing and means it.", "Death ray misfires on schedule. You both pose anyway.", "Heroic theme. Idiotic grins."], talk: [["{Co}", "We looked heroic."], ["you", "We looked unemployed."], ["{Co}", "Heroically unemployed."]] },
    ],
    rival: [
      { beats: ["Doctor Chaotica is played by {co}, who has waited all year for this.", "The cackling is committed. The defeat is satisfying.", "{CoThey} demand{coS} a rematch in character. You schedule it like a meeting."], talk: [["{Co}", "You haven't seen the last of me."], ["you", "Please no."], ["{Co}", "Friday."]] },
      { beats: ["{Co} as Lonzak. Henching with spite.", "You catch {coThem} with the lasso of science. {CoThey} complain{coS} about physics.", "Win logged. Grudge logged."], talk: [["you", "Nice henching."], ["{Co}", "Nice cheating."], ["you", "It's pulp. Relax."]] },
      { beats: ["Rival Moon Men. Same cardboard, colder eyes.", "{CoThey} almost take the fortress. You pull the lever first.", "Earth lives. {CoTheir} pride does not."], talk: [["{Co}", "Rigged lever."], ["you", "Story logic."], ["{Co}", "I hate story logic."]] },
    ],
    partner: [
      { beats: ["Chapter 7. {Co} as co-pilot, refusing — flatly — to need rescuing.", "{CoThey} steal{coS} half the scenes and all of your attention.", "Earth is saved. You celebrate out of costume."], talk: [["you", "You upstaged me."], ["{Co}", "Somebody had to."], ["you", "Do it again."]] },
      { beats: ["{Co} plays the ruler of the Spider People and somehow makes it tender.", "Between ray-gun blasts there is a look that isn't in the script.", "Credits. Real quiet. Real hands."], talk: [["{Co}", "My empire for a kiss."], ["you", "Cheap empire."], ["{Co}", "Expensive kiss."]] },
      { beats: ["Soft pulp. Hard laugh. {Co} in tinfoil looking unfairly good.", "You fluff a line; {coThey} cover{coS}; you both break.", "Reset. Finish. Walk out leaning."], talk: [["you", "Same chapter next week?"], ["{Co}", "New chapter. Same co-pilot."], ["you", "Copy that."]] },
    ],
    acquaintance: [
      { beats: ["{Co} said yes to Proton with deep suspicion. The tinfoil does not help.", "{CoThey} still hit {coTheir} marks. Professional even in grayscale.", "Earth saved. A reluctant 'that was… fine.'"], talk: [["you", "Fine works."], ["{Co}", "Don't quote me."], ["you", "Too late."]] },
      { beats: ["First serial together. {Co} refuses most of the bits, accepts the important one.", "Timing lands. Surprise on both faces.", "Nod. Door. Maybe again."], talk: [["{Co}", "This stays between us."], ["you", "And the computer."], ["{Co}", "Delete the log."]] },
      { beats: ["Awkward pulp. Careful jokes. Shared ray gun.", "By the Fortress {coThey} stop{coS} apologizing for existing in the scene.", "End title. Civil goodbye."], talk: [["you", "Thanks for coming."], ["{Co}", "Don't make me regret it."], ["you", "No promises."]] },
    ],
  },
  vics_lounge: {
    solo: [
      { beats: ["Las Vegas, 1962. The band swings. Vic asks about {leads} week like he means it.", "One song becomes four. Nobody is in a hurry.", "You leave the lounge lighter. The corridor feels louder for it."] },
      { beats: ["Quiet night at Vic's. Good chair. Better tempo.", "'Fly Me to the Moon' does what the counselor can't always.", "Tab closed. Shoulders down. Back to the ship."] },
      { beats: ["Blackjack with a hologram who always knows what to say.", "You lose chips you don't have. You win a mood you needed.", "Vic tips his hat. You tip yours in a corridor with no hat."] },
    ],
    friend: [
      { beats: ["{Co} gets talked onto the stage for one song. It goes better than anyone expected.", "Vic is delighted. The band is professional about it.", "You both pretend this won't be Mess gossip. It will."], talk: [["{Co}", "If you tell the Mess—"], ["you", "I already did."], ["{Co}", "Traitor."]] },
      { beats: ["Vic deals. {Co} wins four hands. The house is gracious.", "You buy the next round of whatever passes for bourbon.", "Outside, the war can wait ten more minutes."], talk: [["you", "Lucky streak."], ["{Co}", "Skill."], ["you", "Sure, shark."]] },
      { beats: ["Booth for two friends. Bad jokes. Good brass.", "{Co} steals fries that aren't real. Principle holds.", "Last song. Soft landing."], talk: [["{Co}", "We needed this."], ["you", "Desperately."], ["{Co}", "Don't get mushy."]] },
    ],
    rival: [
      { beats: ["{Co} heckles the band. Vic handles it: 'Pal, every room's got one.'", "You almost defend {coThem}. Almost.", "{CoThey} tip{coS} well out of spite. Evening saved."], talk: [["{Co}", "The trumpet was flat."], ["you", "So was your joke."], ["{Co}", "Even."]] },
      { beats: ["Vic seats {co} at the next table. Joke or lesson.", "You ignore each other for a song. Fail. Argue about the tempo.", "Call it a draw. Leave separately. Same turbo."], talk: [["you", "You're impossible."], ["{Co}", "You're loud."], ["you", "It's a lounge."]] },
      { beats: ["Rival night out. Competitive calm destroyed by a shared eye-roll at a tourist hologram.", "Almost camaraderie. Dangerous.", "You both pretend it didn't happen."], talk: [["{Co}", "That didn't count."], ["you", "What didn't?"], ["{Co}", "Exactly."]] },
    ],
    partner: [
      { beats: ["Vic sees {co} and drops the tempo. 'For the lovebirds,' he says.", "Corner booth. Martini. {Co} humming 'The Best Is Yet To Come.'", "It is. For a little while."], talk: [["you", "He's onto us."], ["{Co}", "Let him be."], ["you", "Dance?"]] },
      { beats: ["Slow number. Real hand at your waist. Hologram lights being kind.", "You forget rank. {CoThey} forget{coS} the week.", "Last bar. Forehead touch. Corridor faces on."], talk: [["{Co}", "One more song."], ["you", "Greedy."], ["{Co}", "For you? Always."]] },
      { beats: ["Blackjack abandoned for the booth. Talk soft. Laughs softer.", "{Co} steals the cherry. You steal a kiss.", "Vic pretends not to see. Professional."], talk: [["you", "Same booth next week?"], ["{Co}", "Reserve it."], ["you", "Already did."]] },
    ],
    acquaintance: [
      { beats: ["{Co} sits across like it's a meeting. Vic softens the edges anyway.", "One shared song. Careful conversation.", "Not a date. Not nothing. A start."], talk: [["you", "Thanks for coming."], ["{Co}", "The music's fine."], ["you", "I'll take fine."]] },
      { beats: ["Polite lounge. Two people learning each other's silences.", "Halfway through, a real laugh slips out of {coThem}.", "You don't comment. Good."], talk: [["{Co}", "Don't look so pleased."], ["you", "Can't help it."], ["{Co}", "Try."]] },
      { beats: ["Short night. Short words. Decent bourbon.", "{Co} leaves first with a nod that isn't cold.", "You'll ask again. Maybe {coThey}'ll say yes again."], talk: [["you", "Another time?"], ["{Co}", "Maybe."], ["you", "I'll hold it."]] },
    ],
  },
  risa_beach: {
    solo: [
      { beats: ["Risa: white sand, warm water, absolutely no alarms.", "Two hours that reset a person. The war becomes a rumor.", "You stand up sand-covered and oddly ready."] },
      { beats: ["Hammock between palms. Surf. Nothing to fix.", "You almost feel guilty. Then you don't.", "Session end. Shoulders unknotted. Good."] },
      { beats: ["Sun, salt, a book you won't finish.", "The computer dims the sky on time like a kind nurse.", "Back to gray corridors with a private tan you'll deny."] },
    ],
    friend: [
      { beats: ["{Co} builds an outrageous sandcastle shaped like the Tenacity.", "You ask the computer to keep it. It refuses. You take a picture of nothing.", "Swim to the buoy. {CoThey} lose{coS} gracefully. You buy the next shore leave fantasy."], talk: [["{Co}", "That castle was art."], ["you", "It was structurally unsound."], ["{Co}", "So is the real ship sometimes."]] },
      { beats: ["Beach day. Bad sunscreen jokes. Good water.", "{Co} splashes you like a child. You retaliate like an officer. Both wrong.", "Sunset. Quiet. Friends."], talk: [["you", "Truce?"], ["{Co}", "Until the water."], ["you", "Fair."]] },
      { beats: ["Loungers. Shared silence. Occasional insults about form.", "A horga'hn appears. You both ignore it professionally.", "Leave sandy and better."], talk: [["{Co}", "Don't tell the Mess."], ["you", "About the horga'hn?"], ["{Co}", "About any of this."]] },
    ],
    rival: [
      { beats: ["{Co} claims the best lounger and won't budge. Even on Risa.", "You take the worse one out of spite and enjoy it more.", "Paradise has a flaw. Its name is {coThem}."], talk: [["you", "Comfortable?"], ["{Co}", "Very."], ["you", "Good. Suffering builds character — for me."]] },
      { beats: ["The computer puts {co} at the next umbrella with a loud tricorder.", "You ask {coThem} to stop scanning the surf. {CoThey} scan{coS} louder.", "Eventually the battery dies. Peace. Temporary."], talk: [["{Co}", "Interesting salinity."], ["you", "Interesting manners."], ["{Co}", "Risa isn't real. Relax."]] },
      { beats: ["Competitive swimming. Of course.", "{CoThey} win{coS}. You accuse the current. {CoThey} accept{coS} the accusation as praise.", "Shore. Separate towels. Same turbo later."], talk: [["you", "Rematch."], ["{Co}", "You'll lose again."], ["you", "Optimism is free."]] },
    ],
    partner: [
      { beats: ["Warm sand, blue water, {co} with a horga'hn and a straight face. Two hours like a week.", "Sunset. {CoThey} read{coS} aloud under the umbrella until the light goes.", "You don't talk about the war. You don't have to."], talk: [["you", "That statue—"], ["{Co}", "Is a joke."], ["you", "Keep holding it."]] },
      { beats: ["Shared towel. Shared quiet. Occasional kiss that tastes like salt.", "The computer dims early because someone asked. You're not sorry.", "Walk back sandy, leaning, done hiding for an hour."], talk: [["{Co}", "Stay until the stars."], ["you", "Program's ending."], ["{Co}", "Then we steal a minute."]] },
      { beats: ["Swim together until talking stops being necessary.", "On the sand {co} traces idle shapes on {leads} wrist.", "End chime. Real corridor. Still soft."], talk: [["you", "Same beach next week?"], ["{Co}", "Book it."], ["you", "Already did."]] },
    ],
    acquaintance: [
      { beats: ["{Co} picks a lounger two away. Risa allows distance.", "Occasional comments about the water. Nothing heavy.", "End. A civil 'thanks.' The sand remembers more warmth than you showed."], talk: [["you", "Good spot?"], ["{Co}", "Adequate."], ["you", "High praise."]] },
      { beats: ["First beach invite. {Co} reads a padd the whole time. Fine.", "Once, {coThey} look{coS} at the water like it surprised {coThem}.", "You don't ruin it by talking."], talk: [["{Co}", "It's… fine."], ["you", "I'll take fine."], ["{Co}", "You keep saying that."]] },
      { beats: ["Parallel quiet. Parallel swims. No splash fights.", "On the way out, {coThey} hold{coS} the door. Old manners, new maybe.", "You'll ask again when the week is less sharp."], talk: [["you", "Another time?"], ["{Co}", "Maybe."], ["you", "Held."]] },
    ],
  },
};
export const STORY_CATS = ["solo", "friend", "rival", "partner", "acquaintance"];
export const storyCount = pid => { const S = STORIES[pid]; if (!S) return {}; const o = {}; for (const c of STORY_CATS) o[c] = (S[c] || []).length; return o; };
