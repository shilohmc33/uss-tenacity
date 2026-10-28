// Crew-to-Lt dialogue batch (Oct 27): opinion-gated ambient lines + short multi-exchange chats.
// Tokens: {lt}/{named}/{short}/{name}/{sub}/{obj}/… via prFill + fillTalk. Presence: js/crew-talk.js speakerPresence.
import { G } from "./state.js";
import { PROG, opinionOf, addr, nudge } from "./progression.js";
import { pr, Pr, prFill, START_CREW } from "./roster.js";
import { ltAddr, ltNamed, ltLast } from "./ltname.js";
import { findPath, isWalkable } from "./path.js";
import { idlePaused, PACE_RT, isPresent } from "./pacing.js";
import { toast } from "./bus.js";

const P = () => G.prog;
const rnd = a => a[Math.floor(Math.random() * a.length)];

export const CREW_LINES = {
  "tren": {
    "high": [
      "{short} glances up from a padd. 'Your repair notes are\u2026 adequate, {lt}. I have filed them under \"surprisingly so.\"'",
      "{short}: 'Chess tonight, if the Dominion permits. I find your middlegame less chaotic than your EPS routing.'",
      "{short}, almost soft: 'The crew follows you more readily than the regulations predict. That is not a criticism.'",
      "{short}: 'I have recalculated our odds of surviving the week. They improved after your last watch. Marginal. Appreciated.'"
    ],
    "mid": [
      "{short}: 'The captain expects the status board updated before 0800. See that it is, {lt}.'",
      "{short} raises an eyebrow. 'Your last bypass was creative. Creativity is not a Starfleet value. Effectiveness is.'",
      "{short}: 'Tactical drill at 1400. Try to arrive before the klaxon, not with it.'",
      "{short}: 'Logic suggests rest. Your face suggests otherwise. Choose one.'"
    ],
    "low": [
      "{short}, cool: 'I have logged three irregularities on your shift. We will discuss them. Briefly.'",
      "{short}: 'Insubordination is inefficient, {lt}. So is whatever that was.'",
      "{short}: 'I do not require an explanation. I require a correction.'",
      "{short} does not look up. 'When you are ready to be precise, find me.'"
    ]
  },
  "okafor": {
    "high": [
      "{short} wipes grease on a rag that has seen better decades. 'You kept my core singing, {lt}. I owe you a synthale. Real-ish.'",
      "{short}: 'Don't tell the kids, but that intermix trick of yours? I'm stealing it.'",
      "{short}, quieter: 'War's loud. You make Engineering feel like a place people walk out of. Means something.'",
      "{short}: 'Coffee. Then the EPS grid. Then we insult the Dominion. Order of operations.'"
    ],
    "mid": [
      "{short}: 'That coupling is marginal. We re-seat it on this watch or I put your name on the fault log.'",
      "{short}: 'Parts locker is thin again. Miracle it if you can, {lt}. Or invent a miracle.'",
      "{short} points with a spanner. 'Hands, not hopes. The core doesn't care about hopes.'",
      "{short}: 'Okafor to {lt}: stop volunteering my people for \"quick looks\" that aren't.'"
    ],
    "low": [
      "{short}, flat: 'You left a bypass open. Again. Fix it before I fix your schedule.'",
      "{short}: 'I don't shout for fun. I shout so people don't die. Catch up.'",
      "{short}: 'Stay out of my intermix chamber until you remember which end is hot.'",
      "{short} mutters something uncharitable about command and torque wrenches."
    ]
  },
  "diallo": {
    "high": [
      "{short} smiles at a spectral plot. 'You asked the right question yesterday. The data thanked you. So do I.'",
      "{short}: 'Join me on the sensor sweep? I saved the interesting anomaly for someone who listens.'",
      "{short}: 'If we survive this war, {lt}, I want a proper survey of the Badlands. With you on the console.'"
    ],
    "mid": [
      "{short}: 'Third flicker on the lateral array this week. Not a ghost. Not yet proven either.'",
      "{short}: 'Science can wait five minutes. The war cannot. Still \u2014 look at this reading when you can.'",
      "{short}: 'I filed the anomaly under \"annoying until proven lethal.\" Starfleet loves that category.'"
    ],
    "low": [
      "{short}, clipped: 'You dismissed sensor ghosts last time. One of them had teeth. Read the log.'",
      "{short}: 'I don't need cheerleading. I need the array calibrated before the next sweep.'"
    ]
  },
  "hale": {
    "high": [
      "{short} laughs too loud. 'You should've seen the look on that Galor's face \u2014 alright, I didn't, but the yield graph did.'",
      "{short}: 'Torpedo bay's ready, {lt}. And if you want the short version of the Risa story, buy the first round.'",
      "{short}, sudden sober: 'Glad you're the one on the board when it goes red. Means I get to tell the story later.'"
    ],
    "mid": [
      "{short}: 'Did I tell you about the time the yield went up? No? Sit down. Standing version costs extra.'",
      "{short}: 'Magazine's at seventy. Don't spend them like latinum at Quark's.'",
      "{short}: 'Tactical drill. Try to look surprised when I win.'"
    ],
    "low": [
      "{short}: 'Funny how the numbers change when you're not listening.'",
      "{short}, cool: 'Save the corrections for someone who asked, {lt}.'"
    ]
  },
  "orvin": {
    "high": [
      "{short} rests a hand on the console. 'You make it easier to be only one voice in here. Thank you for that.'",
      "{short}: 'Some of the memories aren't mine. The trust I'm building with you is. I prefer that.'",
      "{short}: 'If the war gets louder, sit with me anyway. The symbiont likes quiet company.'"
    ],
    "mid": [
      "{short}: 'Sometimes I remember a docking bay I've never seen. Badlands, maybe. Or a dream with better lighting.'",
      "{short}: 'Joined life is\u2026 crowded. Duty helps. So does not being asked if I'm \"really\" me.'",
      "{short}: 'Science log is filed. The other log \u2014 the personal one \u2014 stays sealed.'"
    ],
    "low": [
      "{short}, distant: 'Please don't ask about the joining like it's a party trick.'",
      "{short}: 'I have enough voices today. Come back when you have a work question.'"
    ]
  },
  "tull": {
    "high": [
      "{short} beams. 'You actually laughed at the Risa story. Most people fake it. I can tell \u2014 ridges don't lie.'",
      "{short}: 'When this war ends, {lt}, first round on me. Second round on whoever still has latinum.'",
      "{short}: 'You treat people like people. On a Bolian ship that's regulation. Here it's a gift.'"
    ],
    "mid": [
      "{short}: 'Did I tell you about almost getting married on Risa? No? Excellent. Pull up a stool.'",
      "{short}: 'Mess hall rumor says the tomatoes are real. I'm verifying for science. And lunch.'",
      "{short}: 'If you need a spare pair of hands that gossip productively, I'm your Bolian.'"
    ],
    "low": [
      "{short}, wounded pride: 'Skipping the story is fine. Saying it like that isn't.'",
      "{short}: 'I'll keep it short. Duty only. You seem busy with being unkind.'"
    ]
  },
  "kovac": {
    "high": [
      "{short} lights up. 'You credited me in front of the captain. I may actually sleep tonight.'",
      "{short}: 'Shadow you on the next CRITICAL? I'll bring the good torch. And fewer nerves.'",
      "{short}: 'I re-read your notes. Twice. They're starting to look like a language I speak.'"
    ],
    "mid": [
      "{short}: 'Permission to ask a dumb question about the plasma relay? \u2026Alright, three dumb questions.'",
      "{short}: 'I can hold the light and not drop it. Mostly. Statistically.'",
      "{short}: 'If the captain praises the wrong person again, I will not melt. Probably.'"
    ],
    "low": [
      "{short}, quiet: 'Next time, maybe mention who did the work. Or don't. I'll still do it.'",
      "{short}: 'I don't need glory. I needed you not to erase me.'"
    ]
  },
  "seo": {
    "high": [
      "{short} softens. 'You asked about Busan like it mattered. It does. Spring there smells like rain on stone.'",
      "{short}: 'Replicator lunch from home? I'll teach you which setting is least wrong.'",
      "{short}: 'Homesick and useful can both be true. Thanks for letting them be.'"
    ],
    "mid": [
      "{short}: 'Harbour picture again. Don't mind me. Just\u2026 checking the season from half a quadrant away.'",
      "{short}: 'Ops is quiet. Too quiet. That's when I miss the noise of home.'",
      "{short}: 'If you hear me humming, it's not a distress call. Unless the tune is very off.'"
    ],
    "low": [
      "{short}, flat: '\"You'll get over it\" is not comfort. It's an order I didn't ask for.'",
      "{short}: 'I'll do the job. Keep the advice about home to yourself.'"
    ]
  },
  "doru": {
    "high": [
      "{short} touches the small candle. 'You asked what the Prophets mean. Few officers do, without smirking.'",
      "{short}: 'The wormhole felt close today. Having you listen made the feeling\u2026 less lonely.'",
      "{short}: 'Faith and warp cores both prefer honesty. You bring that, {lt}.'"
    ],
    "mid": [
      "{short}: 'The Prophets don't file status reports. I do. Both matter on this ship.'",
      "{short}: 'Candle's lit. Not for show \u2014 for the ones who didn't walk off the last transport.'",
      "{short}: 'Bajor remembers occupation. The Dominion should too.'"
    ],
    "low": [
      "{short}, stiff: '\"Wormhole aliens\" is accurate in a lab. It is rude in a prayer.'",
      "{short}: 'Believe what you like. Don't belittle what I do.'"
    ]
  },
  "rhovan": {
    "high": [
      "{short} studies you, then nods. 'You're tired and pretending otherwise. Sit. I already know; you might as well admit it.'",
      "{short}: 'Thank you for not performing fine. Empaths drown in performances.'",
      "{short}: 'Your surface thoughts are\u2026 loud today. Kind, though. That helps.'"
    ],
    "mid": [
      "{short}: 'Counselor's office is empty. So is denial. Pick one chair.'",
      "{short}: 'I don't need your whole story. Just the true sentence.'",
      "{short}: 'War radiates. So does a decent commanding officer who notices.'"
    ],
    "low": [
      "{short}: '\"I'm fine\" when you aren't is a kind of lie. I hear lies as static.'",
      "{short}: 'Come back when you want a conversation, not a performance.'"
    ]
  },
  "grevv": {
    "high": [
      "{short} grins with too many teeth. 'You defended that EPS plan like a Tellarite. I almost liked you for it.'",
      "{short}: 'Argue with me properly and I'll buy the synthale. Win or lose.'",
      "{short}: 'Foolish plans die in argument. Yours lived. Annoying. Respectable.'"
    ],
    "mid": [
      "{short}: 'Your EPS run is foolish. Defend it. Or admit it and we'll fix it.'",
      "{short} slams a tool \u2014 carefully. 'Politeness is how humans hide bad engineering.'",
      "{short}: 'I insult the work, not the worker. Learn the difference, {lt}.'"
    ],
    "low": [
      "{short}: 'If you'd be so kind, perhaps \u2014 stop that. Talk like an engineer.'",
      "{short}: 'I don't need your soft gloves. I need a better schematic.'"
    ]
  },
  "mollo": {
    "high": [
      "{short} sighs happily. 'You asked where they seated me at the wedding. Terrible table. Excellent gossip.'",
      "{short}: 'Four pages from my sister. You survived the highlights. That makes you family-adjacent.'",
      "{short}: 'Denobulan families are large. Good friends are rarer. Don't vanish on me, {lt}.'"
    ],
    "mid": [
      "{short}: 'Sister wrote again. Seating charts and passive aggression. A cultural treasure.'",
      "{short}: 'If you need a second opinion that comes with three anecdotes, I'm free.'",
      "{short}: 'War news first. Family news second. I can do both without combusting.'"
    ],
    "low": [
      "{short}, stung: 'Exhausting is a word. It's just not the kind one uses about someone's family.'",
      "{short}: 'I'll keep the letters to myself. Duty only from here.'"
    ]
  },
  "vardock": {
    "high": [
      "{short} almost smiles. 'You walked the twelve steps with me. Most people skip to fourteen and break something.'",
      "{short}: 'Precision is how I stay calm. You didn't rush me. That mattered.'",
      "{short}: 'I rewrote the procedure down to eight steps. Still one more than you'd like. Compromise.'"
    ],
    "mid": [
      "{short}: 'Twelve-step procedure for a two-step job. Yes. The eleventh step is where people die otherwise.'",
      "{short}: 'Which step worries me? All of them. That's why they're numbered.'",
      "{short}: 'Benzite filtration is fine. The checklist is not optional.'"
    ],
    "low": [
      "{short}, icy: '\"Just wing it\" is how hull breaches write themselves.'",
      "{short}: 'Come back when you want a procedure, not a shrug.'"
    ]
  },
  "natarajan": {
    "high": [
      "{short} stands a little taller. 'Nothing moves without this desk. Thanks for saying it where people heard.'",
      "{short}: 'If you want that word with Engineering about \"secretary,\" I'll allow it. Softly. Or not softly.'",
      "{short}: 'Yeoman work is Starfleet. You treated it that way. I noticed.'"
    ],
    "mid": [
      "{short}: 'Padds straightened. Captain's schedule terrorized into obedience. Next crisis?'",
      "{short}: 'Somebody called me the Captain's secretary again. I'm collecting names. For\u2026 filing.'",
      "{short}: 'Ambition isn't a dirty word, {lt}. Neither is paperwork.'"
    ],
    "low": [
      "{short}, sharp: 'A yeoman isn't \"really\" Starfleet? Cool. Watch how far you get without one.'",
      "{short}: 'I'll still file your reports. I just won't smile about it.'"
    ]
  },
  "rmira": {
    "high": [
      "{short}'s ears perk. 'You asked me to play. That's either brave or tone-deaf. Either way \u2014 sit.'",
      "{short}: 'Jam at 2100. Bring something that makes noise. You count.'",
      "{short} purrs a laugh. 'No cat jokes. Just music. You're learning.'"
    ],
    "mid": [
      "{short}: 'String's tuned. War can wait one song. Or it can interrupt \u2014 rude either way.'",
      "{short} bats a stylus. 'What? It was asking for it.'",
      "{short}: 'Race you to the turbolift. Loser files the parts report. I cheat fair.'"
    ],
    "low": [
      "{short}, ears flat: 'Cat joke. Original. Leave the instrument alone.'",
      "{short}: 'I'll be on duty. Not on display.'"
    ]
  },
  "thelev": {
    "high": [
      "{short}, antennae tipping toward you: 'Next raktajino is mine, {lt}. You keep the core from eating us. Fair trade.'",
      "{short}: 'Okafor only shouts at people she plans to keep. Congrats. Condolences.'",
      "{short}: 'The Jem'Hadar don't laugh. That's why we'll win. Also why I like talking to you.'"
    ],
    "mid": [
      "{short}: 'On Andor this is a mild evening. You run ships like greenhouses.'",
      "{short}: 'Zhavey asks if the Tenacity is a starship or a museum. I said both, proudly.'",
      "{short}: 'Core's sweet tonight. That's you, isn't it?'"
    ],
    "low": [
      "{short}, antennae stiff: 'Save the lectures. I already get them from home.'",
      "{short}: 'I'll drink alone if the company's colder than the glass.'"
    ]
  },
  "delgado": {
    "high": [
      "{short} slides a bowl over. 'Real tomatoes. Taste it properly and tell me why it's good \u2014 I collect compliments scientifically.'",
      "{short}: 'Recipe's yours. Don't tell Engineering I can cook; they'll never leave the mess.'",
      "{short}: 'War outside. Soup inside. You're welcome at this counter anytime, {lt}.'"
    ],
    "mid": [
      "{short}: 'Hydroponics finally came through. Miracles happen. Slowly. With fertilizer.'",
      "{short}: 'Steward's tip: people talk more when the food isn't lying to them.'",
      "{short}: 'Replicator settings are a diplomatic incident. I mediate.'"
    ],
    "low": [
      "{short}: 'The replicator does not do it better. Take that back or take a tray elsewhere.'",
      "{short}: 'I'll still feed you. Manners are optional. Taste isn't.'"
    ]
  },
  "sorvan": {
    "high": [
      "{short}, even-voiced: 'You asked what the failure taught me. That is the correct question. Sit; the data is patient.'",
      "{short}: 'Emotion is irrelevant to the result. Your attention was not. Thank you.'",
      "{short}: 'The experiment failed usefully. Rare. I prefer sharing rare things with competent company.'"
    ],
    "mid": [
      "{short}: 'Botany bay readings are nominal. The war is not. I am tending the former.'",
      "{short}: 'Vulcan patience is not the same as indifference. Please note the distinction.'",
      "{short}: 'I have filed the failure. The success will take longer. As it should.'"
    ],
    "low": [
      "{short}: 'How I \"feel\" about it is not data. Do not ask again.'",
      "{short}: 'Return when you wish to discuss methodology, not mood.'"
    ]
  }
};

export const CHATS = [
  {
    "id": "tren-chess",
    "who": "tren",
    "title": "between shifts",
    "steps": [
      {
        "q": "{short} sets a chessboard on the edge of the console. 'One game. No rank. Unless you lose.'",
        "choices": [
          {
            "t": "'Set it up. Loser updates the status board.'",
            "op": 1,
            "next": 1
          },
          {
            "t": "'I don't have time for games, Commander.'",
            "op": -1,
            "next": 2
          },
          {
            "t": "'Only if you explain that last tactical note while we play.'",
            "op": 1,
            "next": 1
          }
        ]
      },
      {
        "q": "{short} moves a knight without looking up. 'Your middlegame is improving. Your excuses are not.'",
        "choices": [
          {
            "t": "Laugh once and take the hit.",
            "op": 1,
            "next": -1
          },
          {
            "t": "'The knight was a feint. Watch the rook.'",
            "op": 1,
            "next": -1
          }
        ]
      },
      {
        "q": "{short}: 'As you wish. The board will wait. The Dominion will not.'",
        "end": true,
        "op": 0
      }
    ]
  },
  {
    "id": "okafor-core",
    "who": "okafor",
    "title": "engineering quiet",
    "steps": [
      {
        "q": "{short} kills the loudest alarm with a slap. 'Tell me straight \u2014 are you sleeping, or just decorating the bags under your eyes?'",
        "choices": [
          {
            "t": "'Sleeping is a rumor. Help me finish this bypass and I'll try.'",
            "op": 1,
            "next": 1
          },
          {
            "t": "'I'm fine. The core isn't. Priorities.'",
            "op": 0,
            "next": 1
          },
          {
            "t": "'With respect, Chief, not your department.'",
            "op": -1,
            "next": 2
          }
        ]
      },
      {
        "q": "{short} snorts. 'Then we do this fast and you disappear for four hours. That's an order shaped like a favor.'",
        "choices": [
          {
            "t": "'Yes, Chief.'",
            "op": 1,
            "next": -1
          },
          {
            "t": "'Two hours. Don't push it.'",
            "op": 0,
            "next": -1
          }
        ]
      },
      {
        "q": "{short}: 'Everything on this ship is my department when it keeps people breathing. Remember that.'",
        "end": true,
        "op": 0
      }
    ]
  },
  {
    "id": "hale-story",
    "who": "hale",
    "title": "torpedo bay",
    "steps": [
      {
        "q": "{short} is halfway through the yield story. The number has climbed since Tuesday.",
        "choices": [
          {
            "t": "Laugh in the right places.",
            "op": 1,
            "next": 1
          },
          {
            "t": "Ask what happened to the gunner's mate.",
            "op": 1,
            "next": 1
          },
          {
            "t": "Point out the numbers have changed.",
            "op": -1,
            "next": 2
          }
        ]
      },
      {
        "q": "{short} grins. 'See, you get it. War's ugly. Stories are how we walk out of it.'",
        "choices": [
          {
            "t": "'Buy you a drink when we dock. Short version only.'",
            "op": 1,
            "next": -1
          },
          {
            "t": "Nod and get back to the magazine checklist.",
            "op": 0,
            "next": -1
          }
        ]
      },
      {
        "q": "{short} cools. 'Funny how accuracy only shows up for the fun parts.'",
        "end": true,
        "op": 0
      }
    ]
  },
  {
    "id": "seo-busan",
    "who": "seo",
    "title": "ops quiet hour",
    "steps": [
      {
        "q": "{short} is staring at a harbour on her console. 'Busan. It's spring there.'",
        "choices": [
          {
            "t": "'Tell me about it.'",
            "op": 1,
            "next": 1
          },
          {
            "t": "'Want to replicate something from home at lunch?'",
            "op": 1,
            "next": 1
          },
          {
            "t": "'You'll get over missing home.'",
            "op": -2,
            "next": 2
          }
        ]
      },
      {
        "q": "{short} softens. 'Rain on stone. Gulls that sound like arguments. I'll take the lunch. Thank you, {lt}.'",
        "choices": [
          {
            "t": "'Anytime. Really.'",
            "op": 1,
            "next": -1
          },
          {
            "t": "'Only if you bring the story with the food.'",
            "op": 1,
            "next": -1
          }
        ]
      },
      {
        "q": "{short} closes the picture. 'Duty. Right.'",
        "end": true,
        "op": 0
      }
    ]
  },
  {
    "id": "grevv-argue",
    "who": "grevv",
    "title": "EPS bay",
    "steps": [
      {
        "q": "{short} slams a tool down. 'Your plan for the EPS run is foolish. Defend it.'",
        "choices": [
          {
            "t": "Defend it, bluntly.",
            "op": 1,
            "next": 1
          },
          {
            "t": "'It is foolish. Give me a better one.'",
            "op": 1,
            "next": 1
          },
          {
            "t": "'With respect, if you'd be so kind, perhaps\u2026'",
            "op": -1,
            "next": 2
          }
        ]
      },
      {
        "q": "{short} shows teeth. 'Finally. Someone who argues like the work matters.'",
        "choices": [
          {
            "t": "'Then fix it with me. Now.'",
            "op": 1,
            "next": -1
          },
          {
            "t": "'I'll take that as Tellarite for yes.'",
            "op": 1,
            "next": -1
          }
        ]
      },
      {
        "q": "{short}: 'Politeness is camouflage. Come back when you mean the words.'",
        "end": true,
        "op": 0
      }
    ]
  },
  {
    "id": "rhovan-tired",
    "who": "rhovan",
    "title": "counselor's corridor",
    "steps": [
      {
        "q": "{short} studies you a moment. 'You're tired. You don't have to say you aren't.'",
        "choices": [
          {
            "t": "'I'm tired. Thank you for noticing.'",
            "op": 1,
            "next": 1
          },
          {
            "t": "Tell her what's actually on your mind.",
            "op": 1,
            "next": 1
          },
          {
            "t": "'I'm fine, really.' (You aren't.)",
            "op": -1,
            "next": 2
          }
        ]
      },
      {
        "q": "{short}: 'Good. Truth is quieter than performance. Go off shift an hour early \u2014 I'll cover the excuse with Medical.'",
        "choices": [
          {
            "t": "'Appreciate it.'",
            "op": 1,
            "next": -1
          },
          {
            "t": "'Only an hour. The board's ugly.'",
            "op": 0,
            "next": -1
          }
        ]
      },
      {
        "q": "{short}: 'Static it is, then. Find me when you want a real conversation.'",
        "end": true,
        "op": 0
      }
    ]
  },
  {
    "id": "thelev-raktajino",
    "who": "thelev",
    "title": "mess hall",
    "steps": [
      {
        "q": "{short}'s antennae tip toward you. 'Lieutenant. They say you keep the core from eating us. Next raktajino is mine.'",
        "choices": [
          {
            "t": "'I'll take that drink. And the vote of confidence.'",
            "op": 1,
            "next": 1
          },
          {
            "t": "'Keep your latinum. Just save me a seat at the cold end of the bar.'",
            "op": 1,
            "next": 1
          },
          {
            "t": "'I don't fraternize on duty.'",
            "op": -1,
            "next": 2
          }
        ]
      },
      {
        "q": "{short} almost smiles. 'Good. Andoria raises people who pay debts. Starfleet could take notes.'",
        "choices": [
          {
            "t": "'To greenhouses and mild evenings.'",
            "op": 1,
            "next": -1
          },
          {
            "t": "Clink glasses and leave it there.",
            "op": 0,
            "next": -1
          }
        ]
      },
      {
        "q": "{short}: 'Suit yourself. The offer stands when you're off the clock.'",
        "end": true,
        "op": 0
      }
    ]
  },
  {
    "id": "doru-prophets",
    "who": "doru",
    "title": "after the candle",
    "steps": [
      {
        "q": "{short} adjusts the small candle. 'The wormhole passed close today. I felt it.'",
        "choices": [
          {
            "t": "'What did it feel like?'",
            "op": 1,
            "next": 1
          },
          {
            "t": "Ask him what the Prophets mean to him.",
            "op": 1,
            "next": 1
          },
          {
            "t": "'The wormhole aliens, you mean?'",
            "op": -2,
            "next": 2
          }
        ]
      },
      {
        "q": "{short}: 'Like someone opened a door in the dark and didn't walk through. Thank you for not laughing.'",
        "choices": [
          {
            "t": "'I wouldn't. Not at that.'",
            "op": 1,
            "next": -1
          },
          {
            "t": "'Light the candle. I'll stand watch a minute.'",
            "op": 1,
            "next": -1
          }
        ]
      },
      {
        "q": "{short} goes still. 'Accurate. And unkind. Excuse me.'",
        "end": true,
        "op": 0
      }
    ]
  }
];

export const BEAT_EXTRA = {
  "tren": [
    {
      "q": "{short} offers a padd without preamble. 'The captain's morning brief has two errors. One is yours. Find it.'",
      "good": [
        "Find it in under a minute and show her.",
        "Admit both and fix them before she does."
      ],
      "bad": "'I'm sure it's fine.'"
    },
    {
      "q": "{short}: 'You overruled me on the divert. Explain \u2014 briefly \u2014 why you were right.'",
      "good": [
        "Walk her through the sensor ghost and the convoy clock.",
        "'I wasn't sure I was. I was sure we were out of time.'"
      ],
      "bad": "'Because I'm the Lieutenant.'"
    }
  ],
  "okafor": [
    {
      "q": "{short} holds up a scorched coupling. 'This was \"good enough\" yesterday. Comment.'",
      "good": [
        "'It wasn't. My mistake \u2014 we replace it now.'",
        "'Show me the heat signature. I'll own the log line.'"
      ],
      "bad": "'It held, didn't it?'"
    }
  ],
  "hale": [
    {
      "q": "{short} lowers his voice. 'Magazine check. Between us \u2014 you ever scared on the board?'",
      "good": [
        "'Yes. Every time. Still better than the alternative.'",
        "'Only the quiet ones. Loud fights are easier.'"
      ],
      "bad": "'Fear is for civilians.'"
    }
  ],
  "orvin": [
    {
      "q": "{short}: 'A memory surfaced that isn't mine \u2014 a docking clamp on DS9, years ago. You were not there. Still felt like I should tell someone.'",
      "good": [
        "'I'm listening. As long as you need.'",
        "'Write it down. Or don't. Either is allowed.'"
      ],
      "bad": "'Have you tried not being joined?'"
    }
  ],
  "tull": [
    {
      "q": "{short}: 'Short version of Risa: I said yes, then no, then fled into a fountain. Moral?'",
      "good": [
        "'Never propose near fountains.'",
        "'Tell the long version at Vic's when we dock.'"
      ],
      "bad": "'Can we skip to the work?'"
    }
  ],
  "kovac": [
    {
      "q": "{short}: 'Captain thanked \"Engineering\" for my plasma fix. He looked at you.'",
      "good": [
        "Correct him, lightly, with her name.",
        "Pull her into the credit on the spot."
      ],
      "bad": "Smile and accept it."
    }
  ],
  "diallo": [
    {
      "q": "{short} taps a plot. 'If this flicker is a cloaked scout, we're late. If it's nothing, I'm paranoid. Pick.'",
      "good": [
        "'Treat it as a scout until proven otherwise.'",
        "'I'll run the secondary sweep with you.'"
      ],
      "bad": "'Ignore it. Noise.'"
    }
  ],
  "natarajan": [
    {
      "q": "{short}: 'I can bury a transfer request under three other padds, or I can put it on top. Your call, {lt}.'",
      "good": [
        "'On top. We do this clean.'",
        "'Bury it until after the convoy. Then on top.'"
      ],
      "bad": "'Whatever. You're the secretary.'"
    }
  ],
  "delgado": [
    {
      "q": "{short}: 'Half the night shift hasn't eaten. I can chase them or you can order them to the mess.'",
      "good": [
        "'I'll make it an order. Kindly.'",
        "'Chase them. I'll back you if they complain.'"
      ],
      "bad": "'Not my problem if they skip dinner.'"
    }
  ],
  "sorvan": [
    {
      "q": "{short}: 'The control sample contaminated itself. Statistically irritating. Practically\u2026 useful, if we are honest.'",
      "good": [
        "'Then we are honest. Walk me through it.'",
        "'Useful how? Teach me.'"
      ],
      "bad": "'How does that make you feel?'"
    }
  ],
  "vardock": [
    {
      "q": "{short}: 'Step seven failed twice. I can delete it or double it. Preference?'",
      "good": [
        "'Double it. Show me why it fails.'",
        "'Delete it only after we know what it was catching.'"
      ],
      "bad": "'Skip to the end.'"
    }
  ],
  "mollo": [
    {
      "q": "{short}: 'My cousin wants a Starfleet reference for a civilian posting. I said I'd ask you. You can say no.'",
      "good": [
        "'Send me the file. If it's honest, I'll sign.'",
        "'No \u2014 but I'll help you write why not, kindly.'"
      ],
      "bad": "'Your whole family's exhausting.'"
    }
  ],
  "rmira": [
    {
      "q": "{short} offers the instrument. 'One chord. If you break a string, you buy the next set.'",
      "good": [
        "Take it carefully and try.",
        "Ask her to play first so you can learn."
      ],
      "bad": "Make a cat joke and wave it off."
    }
  ],
  "grevv": [
    {
      "q": "{short}: 'Humans say \"with respect\" when they mean \"you're wrong.\" Say what you mean about my weld.'",
      "good": [
        "'The weld is ugly and strong. Like the argument.'",
        "'It's wrong. Here's the angle I'd use.'"
      ],
      "bad": "'With respect, it's fine.'"
    }
  ],
  "doru": [
    {
      "q": "{short}: 'A Bajoran transport limped past at dawn. No flags. I want to send spare rations. Quietly.'",
      "good": [
        "'Do it. Log it as my authorization.'",
        "'I'll take it to the captain with you.'"
      ],
      "bad": "'Not our problem.'"
    }
  ],
  "thelev": [
    {
      "q": "{short}: 'Andorian custom: you insult a friend's work if you care. Your last EPS patch was\u2026 soft.'",
      "good": [
        "'Then help me make it hard.'",
        "'Insult accepted. Buy the next raktajino anyway.'"
      ],
      "bad": "'We don't do that in Starfleet.'"
    }
  ],
  "seo": [
    {
      "q": "{short}: 'Ops can cover itself for twenty minutes. Walk the viewport with me. No advice. Just quiet.'",
      "good": [
        "Go. Stay quiet.",
        "'Twenty minutes. Then we both get back.'"
      ],
      "bad": "'Homesickness isn't a duty shift.'"
    }
  ],
  "rhovan": [
    {
      "q": "{short}: 'Two crew are about to snap at each other in the mess. I can intervene, or you can.'",
      "good": [
        "'I'll take it. Point me at them.'",
        "'You intervene; I'll back whatever you decide.'"
      ],
      "bad": "'Let them sort it out.'"
    }
  ]
};


// Fill talk tokens: Lt name + crewmate pronouns. Lt pronouns default to they (no player pronoun field).
export function fillTalk(str, o) {
  let named = "Lieutenant", lt = "Lieutenant";
  try { named = ltNamed(); lt = ltAddr(); } catch (e) { try { lt = addr(); named = lt; } catch (e2) {} }
  let s = String(str)
    .replace(/\{named\}/g, named)
    .replace(/\{lt\}/g, lt)
    .replace(/\{Lt\}/g, lt)
    .replace(/\{name\}/g, o && o.name || "")
    .replace(/\{short\}/g, o && o.short || "");
  s = prFill(s, o || { pronoun: "they" });
  // Lt pronoun tokens (fallback they)
  const L = { sub: "they", obj: "them", pos: "their", poss: "theirs", ref: "themself", is: "are", has: "have", s: "" };
  s = s.replace(/\{lt(They|Them|Their|Theirs|Themself|Is|Has|S|they|them|their|theirs|themself|is|has|s)\}/g, (_, f) => {
    const key = f[0] === f[0].toUpperCase() ? f : f;
    const map = { They: "They", they: L.sub, Them: "Them", them: L.obj, Their: "Their", their: L.pos, Theirs: "Theirs", theirs: L.poss,
      Themself: "Themself", themself: L.ref, Is: "Are", is: L.is, Has: "Have", has: L.has, S: L.s };
    return map[f] != null ? map[f] : "";
  });
  return s;
}

export function linesForCrew(o) {
  const pack = CREW_LINES[o.id]; if (!pack) return null;
  const v = opinionOf(o.id);
  const band = v >= 40 ? "high" : v <= -20 ? "low" : "mid";
  const pool = [...(pack[band] || []), ...(pack.mid || [])];
  return pool.map(t => fillTalk(t, o));
}

// Stand-in = no unique OWN sheet and not T'Ren (species/tint/dept fallback). Listed for the report.
export const STAND_IN_IDS = ["diallo", "kovac", "natarajan", "delgado", "doru", "grevv", "mollo", "vardock", "rmira"];
export const isStandIn = id => STAND_IN_IDS.includes(id);

export const NEAR_PX = 56;   // design px: "beside him" for in-person speech
export const APPROACH_TIMEOUT = 8;   // sim seconds of active (present, not idle-paused) wait before COMM fallback
const SOFT_NEAR = NEAR_PX * 1.25;   // 70 — soft arrive; also widen to end-tile dist + margin
const injuredIds = () => new Set((((P().med && P().med.inj) || [])).map(x => x.id));
let _NA = null;
async function NA() { if (!_NA) _NA = await import("./npc-ambient.js"); return _NA; }
function NASync() { return _NA; }

export function speakerNpc(id) {
  const mod = NASync(); if (!mod) return null;
  return mod.ambient.find(a => a.occId === id && a.x != null) || null;
}

function besideForTalk(n) {
  const mod = NASync();
  try { return (mod.talkBesideLt || mod.besideLt)(n); } catch (e) { return null; }
}

/** Presence for an in-person line. mode: near | approach | comm | skip */
export function speakerPresence(id) {
  const o = P().crew && P().crew.occ[id]; if (!o) return { mode: "skip", reason: "not aboard" };
  if (injuredIds().has(id)) return { mode: "comm", reason: "injured" };
  if (G.sp && G.sp.battle) return { mode: "comm", reason: "battle" };
  const mod = NASync();
  if (!mod) return { mode: "comm", reason: "ambient-unready" };
  const n = mod.ambient.find(a => a.occId === id && a.x != null);
  if (!n) return { mode: "comm", reason: "off-deck-or-hidden" };
  const L = G.lt;
  if (!L || L.lift) return { mode: "comm", reason: "lt-in-lift" };
  if (n.deck !== L.deck) return { mode: "comm", reason: "different-deck" };
  const dx = (n.x - L.x) * 960, dy = (n.y - L.y) * 640, dist = Math.hypot(dx, dy);
  if (dist <= NEAR_PX) return { mode: "near", dist, npc: n };
  let spot;
  try { spot = besideForTalk(n); } catch (e) { return { mode: "comm", reason: "no-beside" }; }
  if (!spot || !isWalkable(n.deck, spot.x, spot.y)) return { mode: "comm", reason: "no-walkable-beside" };
  const path = findPath(n.deck, n.x, n.y, spot.x, spot.y);
  if (!path || !path.length) return { mode: "comm", reason: "no-path" };
  return { mode: "approach", dist, npc: n, spot, path };
}

/** Clear approach walk markers and send the speaker back to duty / battle station. Shared exit for every leave path. */
export function endApproach(id, reason = "end") {
  if (!id) return;
  const mod = NASync();
  if (mod && typeof mod.returnToDuty === "function") mod.returnToDuty(id);
  else {
    const n = speakerNpc(id);
    if (n) {
      n.path = null; n.pathI = 0; n.next = null; n.target = null; n.chatNode = null;
      if (n._talkApproach) delete n._talkApproach;
      if (n.mode === "walk" || n.mode === "chat") { n.mode = "dwell"; n.t = 1; n.chatWith = null; }
    }
  }
}

/** Arrive beside Lt for dialogue: stop walking, linger facing them — do NOT send back to post yet. */
function settleArrived(id) {
  const n = speakerNpc(id), L = G.lt;
  if (!n) return;
  n.path = null; n.pathI = 0; n.next = null; n.target = null; n.chatNode = null;
  if (n._talkApproach) delete n._talkApproach;
  n.mode = "dwell"; n.t = 12; n.action = "talk";
  if (L && n.x != null) {
    const dx = (L.x - n.x) * 960, dy = (L.y - n.y) * 640;
    n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
  }
}

function applyApproachWalk(id, presence) {
  const n = presence.npc, L = G.lt;
  // next "crewTalk" (not "chat") so ambient startChat cannot steal them at the end tile
  n.path = presence.path.concat([[presence.spot.x, presence.spot.y]]); n.pathI = 0; n.mode = "walk"; n.next = "crewTalk"; n.target = presence.spot;
  n.chatNode = null; n.walkDist = 0;
  n._talkApproach = { lx: L.x, ly: L.y, deck: L.deck, endDist: Math.hypot((presence.spot.x - L.x) * 960, (presence.spot.y - L.y) * 640) };
}

export function approachSpeaker(id) {
  const pr = speakerPresence(id);
  if (pr.mode === "near") return pr;
  if (pr.mode !== "approach") return pr;
  applyApproachWalk(id, pr);
  return { ...pr, approaching: true };
}

/** Call once from main after modules load so speakerPresence can sync-read ambient. Also scrub a saved mid-approach. */
export async function readyTalk() {
  await NA();
  scrubSavedApproach();
}

/** Reload / boot: a saved pending.mode === approaching must not leave a walker hanging — fall back to COMM and clear walk. */
export function scrubSavedApproach() {
  const talk = (() => { try { return T(); } catch (e) { return null; } })();
  if (talk && talk.pending && talk.pending.mode === "approaching") {
    endApproach(talk.pending.who, "reload");
    talk.pending.mode = "comm"; talk.pending.reason = "reload"; talk.pending.wait = 0;
  }
  try {
    const p = P();
    const b = p && p.insight && p.insight.beat && p.insight.beat.pending;
    if (b && b.mode === "approaching") {
      endApproach(b.id, "reload");
      b.mode = "comm"; b.reason = "reload"; b.wait = 0;
    }
  } catch (e) { /* insight may not be ready */ }
  // orphan ambient walkers left mid-approach (runtime never saved, but belt-and-braces)
  const mod = NASync();
  if (mod) for (const a of mod.ambient) {
    if (a && (a._talkApproach || a.next === "crewTalk" || (a.next === "chat" && a._talkApproach))) {
      mod.returnToDuty(a.occId);
    }
  }
}

export function speakerNearEnough(id) {
  return speakerPresence(id).mode === "near";
}

function arriveRadius(n, L) {
  const soft = SOFT_NEAR;
  const mark = n && n._talkApproach;
  const endDist = mark && mark.endDist != null ? mark.endDist
    : (n && n.target ? Math.hypot((n.target.x - L.x) * 960, (n.target.y - L.y) * 640) : soft);
  return Math.max(soft, endDist + 16);
}

/** Start presence for a conversation: returns { mode: near|approaching|comm|skip, reason? }. Approaching does NOT grant dialogue yet. */
export function beginSpeaker(id) {
  const presence = speakerPresence(id);
  if (presence.mode === "near") return { mode: "near" };
  if (presence.mode === "approach") {
    applyApproachWalk(id, presence);
    const o = P().crew.occ[id];
    toast(`${o.short} is coming over…`, "info");
    return { mode: "approaching", wait: 0, reason: null };
  }
  if (presence.mode === "skip") return { mode: "skip", reason: presence.reason };
  return { mode: "comm", reason: presence.reason || "unavailable" };
}

function repathIfNeeded(id) {
  const n = speakerNpc(id), L = G.lt; if (!n || !L || L.lift) return false;
  const mark = n._talkApproach;
  if (!mark) return approachSpeaker(id).mode === "approach" || speakerPresence(id).mode === "near";
  const moved = mark.deck !== L.deck || Math.hypot((L.x - mark.lx) * 960, (L.y - mark.ly) * 640) > 40;
  if (!moved && n.mode === "walk" && (n.next === "crewTalk" || n.next === "chat")) return true;
  const pr = approachSpeaker(id);
  return pr.mode === "approach" || pr.mode === "near";
}

/**
 * Advance an approaching conversation. Mutates `rec` which must have { mode, wait?, who|id }.
 * Returns the (possibly updated) mode: approaching | near | comm | skip.
 * Freezes wait while idle-paused or the tab is hidden / not present.
 * Every non-approaching exit calls endApproach (near settles in place; others return to duty).
 */
export function tickApproach(rec, dt) {
  if (!rec || rec.mode !== "approaching") return rec && rec.mode;
  const id = rec.who || rec.id;
  const frozen = idlePaused() || !isPresent() || !!(typeof document !== "undefined" && document.hidden) || !!(PACE_RT && PACE_RT.hidden);
  if (!frozen) rec.wait = (rec.wait || 0) + dt;

  if (G.sp && G.sp.battle) {
    rec.mode = "comm"; rec.reason = "battle";
    endApproach(id, "battle");
    toast(`📶 ${P().crew.occ[id].short} on comm instead`, "info");
    return "comm";
  }

  const n = speakerNpc(id), L = G.lt;
  if (n && L && !L.lift && n.deck === L.deck) {
    const dist = Math.hypot((n.x - L.x) * 960, (n.y - L.y) * 640);
    if (dist <= arriveRadius(n, L)) {
      rec.mode = "near"; rec.reason = null;
      settleArrived(id);
      toast(`💬 ${P().crew.occ[id].short} — ready to talk`, "info");
      return "near";
    }
  }

  const pr = speakerPresence(id);
  if (pr.mode === "near") {
    rec.mode = "near"; rec.reason = null;
    settleArrived(id);
    toast(`💬 ${P().crew.occ[id].short} — ready to talk`, "info");
    return "near";
  }
  if (pr.mode === "skip") {
    rec.mode = "skip"; rec.reason = pr.reason;
    endApproach(id, pr.reason || "skip");
    return "skip";
  }
  if (pr.mode === "comm") {
    // Same deck: keep re-pathing until the 8 s budget burns; early COMM only if Lt left / lift / injured.
    if (n && L && n.deck === L.deck && !L.lift && pr.reason !== "injured" && pr.reason !== "battle") {
      repathIfNeeded(id);
    } else {
      rec.mode = "comm"; rec.reason = pr.reason || "lost-path";
      endApproach(id, rec.reason);
      toast(`📶 ${P().crew.occ[id].short} on comm — couldn't reach you`, "info");
      return "comm";
    }
  } else {
    repathIfNeeded(id);
  }

  if ((rec.wait || 0) >= APPROACH_TIMEOUT) {
    rec.mode = "comm"; rec.reason = "timeout";
    endApproach(id, "timeout");
    toast(`📶 ${P().crew.occ[id].short} on comm — took too long`, "info");
    return "comm";
  }
  return "approaching";
}

// Multi-exchange chat runtime (stored on insight-ish scratch in G.prog.talk)
export function freshTalk() { return { pending: null, step: 0, log: [] }; }
export const T = () => { const p = P(); if (!p.talk || typeof p.talk !== "object") p.talk = freshTalk(); return p.talk; };

export function pickChat(id) {
  const pool = CHATS.filter(c => c.who === id); if (!pool.length) return null;
  return rnd(pool);
}

export function startChatSession(id, forceId = null) {
  const c = forceId ? CHATS.find(x => x.id === forceId) : pickChat(id);
  if (!c || !P().crew.occ[c.who]) return null;
  const gate = beginSpeaker(c.who);
  if (gate.mode === "skip") return null;
  T().pending = { chatId: c.id, who: c.who, step: 0, mode: gate.mode, reason: gate.reason || null, wait: gate.wait || 0 }; T().log = [];
  return T().pending;
}

/** Tick approaching beat/chat records. Call from the sim loop (after tickAmbient). */
export function tickTalk(dt) {
  const t = T().pending;
  if (t && t.mode === "approaching") {
    const m = tickApproach(t, dt);
    if (m === "skip") { endApproach(t.who, "skip"); T().pending = null; }
  }
}


export function chatView() {
  const t = T().pending; if (!t) return null;
  const c = CHATS.find(x => x.id === t.chatId); if (!c) return null;
  const o = P().crew.occ[t.who];
  if (t.mode === "approaching") return { id: t.who, who: o, mode: "approaching", title: c.title, end: false, q: null, replies: [], wait: t.wait || 0 };
  const st = c.steps[t.step]; if (!st) return null;
  if (st.end) return { id: t.who, who: o, q: fillTalk(st.q, o), end: true, mode: t.mode, replies: [], title: c.title };
  return {
    id: t.who, who: o, q: fillTalk(st.q, o), mode: t.mode, title: c.title, end: false,
    replies: (st.choices || []).map((ch, j) => ({ j, text: fillTalk(ch.t, o), op: ch.op, next: ch.next })),
  };
}

export function answerChat(j) {
  const t = T().pending; if (!t) return null;
  const c = CHATS.find(x => x.id === t.chatId); const st = c.steps[t.step]; const ch = st.choices[j]; if (!ch) return null;
  if (ch.op) nudge(t.who, ch.op, "talk|" + c.id, true);
  T().log.push({ step: t.step, j, op: ch.op });
  if (ch.next < 0 || ch.next == null) { const o = P().crew.occ[t.who]; endApproach(t.who, "finished"); T().pending = null; return { done: true, good: (ch.op || 0) >= 0, line: fillTalk("{short} nods to {lt}.", o) }; }
  t.step = ch.next;
  const nxt = c.steps[t.step];
  if (nxt && nxt.end) { if (nxt.op) nudge(t.who, nxt.op, "talk|" + c.id, true); const o = P().crew.occ[t.who]; const line = fillTalk(nxt.q, o); endApproach(t.who, "finished"); T().pending = null; return { done: true, good: (ch.op || 0) >= 0, line }; }
  return { done: false };
}

export function dismissChat() {
  const t = T().pending;
  if (t) endApproach(t.who, "dismiss");
  T().pending = null;
}

export function countLines() {
  const out = {};
  for (const o of START_CREW) {
    const pack = CREW_LINES[o.id] || {};
    out[o.id] = (pack.high || []).length + (pack.mid || []).length + (pack.low || []).length;
  }
  out._chats = CHATS.length;
  out._beatExtra = Object.values(BEAT_EXTRA).reduce((n, a) => n + a.length, 0);
  return out;
}
