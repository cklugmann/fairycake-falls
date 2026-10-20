# Fairycake Falls – Game Design (prototype v0.5)

## Pitch
A cosy, endless flick-and-merge game. You flick cakes from a little slingshot
into a round pond on a floating island. Identical cakes that touch merge into
the next, bigger cake. The pond slowly fills up. Play for a high score.

**What makes it different from Suika-likes:** nothing is dropped from the top or
floats up from the bottom. You *pull back and flick*, Golf-With-Your-Friends
style, into a loose cluster of cakes floating in a pond with a current of its own.
Bank shots, rides on the current, knock-ons and chain reactions replace the dropping column.

## Design goal for v0.5: the water has a character, every flick has consequences
v0.4 let the player turn the pond with a swipe. Playtest verdict: with a free turntable there is always a gap or a
twin within reach – no tension, no decisions – and the turntable did not feel like water. v0.5 takes the turning
away from the player and gives it to the water, and makes the cluster a real floating thing that reacts to every hit.

| v0.4 | v0.5 |
| --- | --- |
| Swipe = rotate the pond 1:1 (a lazy susan) | **No player control of the water.** A finger on the water only makes ripples |
| A faint ambient drift | **A current with a character:** the spring feeds a fast current round the **rim** (a lap takes ~11 s, 9 s on late stages) that leaves over the falls; inside the dotted ring lies the **calm pool**, which draws cakes gently to the middle and turns the cluster lazily (0.1–0.2 rad/s). Foam flecks, petals and long streaks ride the current, so the player can read it |
| Fast flicks ignored the water completely | Fast flicks still skim over the drain, but the rim current sweeps even a skimming cake sideways by 30 % of its speed. **Power = straightness:** a hard flick flies almost straight, a soft one curves with the current |
| Reaching the far side: wait or stir | **Ride the current:** a flick into the rim band is carried round the pond and only drawn in at the pool's edge, so a well-judged flick arrives at the side or the back of the cluster. The preview draws the whole ride. A ride beyond the ring that takes too long overflows – reach costs risk |
| The pile was a packed blob; a Macaron bounced off it like off a wall (hit cakes moved ~30 u) | **A floating cluster:** cakes keep a little personal space (a cushion of water, `SPACE`), the pool's drift is gentle and fades towards the middle, friction is lower and cakes are lighter than their size (`MASS_EXP` 1.4). A full-power flick now shoves the hit cake 1–2 radii and stirs the cluster (mean 50–70 u); near the ring it knocks cakes out into the current. Judging that is the player's job: the preview only shows the direction of the push |
| Resting twins snapped together by themselves (fairy magnetism) | **Merges are made by hits:** fairy magnetism only pulls a *moving* cake to its twin (forgiveness for a near miss). Resting twins sit side by side with a gap until a flick or a push closes it – planned chains are the player's |
| The ring was fixed at 88 % | **The calm pool widens with the biggest cake** (600 u while a Cupcake is the biggest, +46 per tier, 880 from the Fairy Torte): a big cake gets the room it needs, clutter does not |
| Queue: tiers 1–3 (+4 later), weights 36/30/22 | Queue: tiers 1–4 (32/30/24/14), the Blossom Cake (8) joins once a Blueberry Cake exists |

Stages with orders, the whirl and the stage multiplier from v0.4 stay; the look-ahead preview was taken out again (see "Aim preview").

Bot runs (`tools/bot.js`, no turning): a careful bot plays 140–170 flicks (stage 10–11, tier 9), a sloppy bot
(60 % of its flicks are random lobs) 80–165 (stage 7–11). About half of all flicks make a merge; chains bring the
total to ~0.9 merges per flick. A full-power flick moves the hit cake 50–145 u depending on the geometry and the cluster
by ~50–70 u on average; 1–8 flicks per game knock a cake beyond the ring, and danger situations come up 5–25 times a game.

## Design goal for v0.4: more agency, clearer moves, a rhythm (superseded)
v0.4 answered "the big cake in the middle is walled in" with a swipe that turned the pond, and added the stages, the
whirl and the look-ahead preview. The turning and the look-ahead were taken out again in v0.5 (see above); the rest stayed.

| v0.3 problem | v0.4 |
| --- | --- |
| **Two input modes guessed from the first 12 px of a drag** (pull back = sling, push forward / tap = throw at a spot). A slightly diagonal pull became a throw at the finger; any tap on the water fired a cake | **Where you press decides, never how you move.** The cake in the sling (and anything outside the water) is the slingshot. A tap on the water just ripples and shows the hand |
| The preview stopped at the first contact; what the hit did to the pile was anyone's guess | **The preview simulated the hit** (hearts for chain merges, ghosts for pushed cakes) – taken out again in v0.5.1, see "Aim preview". What stayed: a lob into open water shows the drift with the current to the point where it touches the pile |
| Progress was a score bar; the only pacing was the slow filling of the pond | **Stages with orders** (the Underwatermelon idea, transplanted): every stage is an order of N merges (5, 8, 10, 12, … up to 24). Filling it starts the *whirl*: the water spins up for ~1.5 s, the cluster is flung apart and gathers again in a new arrangement (with some free merges on the way), a gift arrives, the stage multiplier rises (+15 % per stage, up to ×2.5) and every third stage the island drifts into a new world |
| The start pile sometimes merged by itself before the first flick (random layout + inflow) | A fixed cross layout (one cake in the middle, four around it, twins opposite each other) in a random rotation; the first cake in the queue always has a match on the outside |

## Design goal for v0.3: it has to *feel* good
Feedback on v0.2 said the visuals were good, but the pacing was off, pulling and
releasing was not satisfying, and the water felt like too much resistance rather
than "what you see is what you get". Measurements on v0.2 confirmed it:

| v0.2 problem (measured) | v0.3 |
| --- | --- |
| Full-power flick lost 39 % of its speed in the first 0.25 s (viscous drag + v²) | Loses about 20 %: near-constant "skimming" friction, even glide |
| The pull to the middle bent slower flicks into curves | Flicks stay within 3 u of the aimed line. Angled ones bend only at the very end (~50 u over a 1300 u glide), when the current takes over |
| Cakes crept on for seconds, then got dragged back (no clear stop) | Clear landing after 0.5–1.5 s, then a calm drift to the pile |
| Pull length mapped to speed, distance was hard to judge | Pull length is linear to travel distance (e.g. 1280 u wanted → 1291 u). Tapping lands right on the spot |
| — | The preview lands within 2–7 u of the real landing point |

## Design goal for v0.2: understandable in the first seconds
v0.2 answered "I don't get the game, the controls or the goal". It added:

- **One fixed slingshot:** in v0.1 the cake jumped around the rim depending on where you pressed.
- **A guided first game:** nothing had shown that identical cakes merge or what the ring means.
- **An always-visible cake ladder:** it shows the whole goal at a glance.
- **Less clutter:** the cake to play with was tiny, while "Next" and the power-ups were big.

## Controls (mouse and touch are identical)
- **Pull back & let go (the only way to flick):** press the cake in the sling – or anywhere outside the water – drag back, release.
  - **Direction:** the cake flies the opposite way of the drag.
  - **Power:** set by the pull length (linear in travel distance on still water). Full power is always reachable inside the screen.
  - **Feedback:** the cake follows the drag at half its length in a pink ribbon, a dotted pull line connects it to the finger, detents every 25 %.
  - **Flick angle:** limited to ±80° from straight ahead, so every flick goes into the pond.
- **Tap or swipe the water:** ripples; a tap also shows the hand. Nothing is fired by accident, and the water cannot be moved by the player.
- **Cancel:** drag back to where you started, right-click or press `Esc`.
- **Swap:** tap "Next" or press `Space`.

## Core loop
1. **Aim:** the dotted preview simulates the real flick against the cluster, which turns with the pool meanwhile, up to the first touch (contact ghost, heart for a match, push arrow otherwise). A flick into open water also shows the drift – or the ride round the rim – up to the point where the cake touches the cluster. What the touch sets off is not shown.
2. **The water** (`js/physics.js`, `World.flowAt`):
   - **Calm pool** (inside the dotted ring, radius `rCalm`): turns at `omegaCore` (0.1 rad/s on stage 1 → 0.2 on stage 10) and drifts inwards at 90 u/s in the middle rising to 190 u/s at the ring (× a mild size factor, so big cakes sink in a little harder).
   - **Rim current** (outside the ring, blended over 120 u): moves at `vRim` (520 → 700 u/s) with only a gentle inward drift of 110 u/s, so a slow cake rides round the pond.
   - **Coupling:** a cake slower than 380 u/s floats with the water, one faster than 820 skims over the drain – but even a skimming cake feels 30 % of the turning part (`TAN_K`). Cakes that touch the cluster turn with the pool wherever they are, so the current cannot peel the cluster apart.
   - **Skim friction:** 850 u/s² relative to the water the cake feels – an even glide and a clear stop; shoved cakes slide a little.
3. **The cluster:** cakes keep a cushion of 0.3 × the smaller radius between them (`SPACE`, restored softly: a drift cannot close it, a flick can). Masses go with r^1.4, bounciness 0.35: a hit shoves rather than bounces.
4. **Merge:**
   - **Contact:** two identical cakes merge when they overlap. The new cake keeps the momentum and nudges its neighbours, which sets off chain reactions.
   - **Fairy magnetism:** a *moving* cake (> 120 u/s) is pulled to a twin within 0.4 × r – forgiveness for near misses; resting twins stay apart until something pushes them together.
   - **Hit-stop:** a short pause of 45–130 ms sells each pop.
5. **Stage:** every merge fills the order. When it is complete the whirl reshuffles the cluster and the next stage begins (see below).
6. **Lose:** a cake that rests beyond the ring (in the current) for 4 seconds overflows the pond – "rests" meaning at rest relative to the water and not being carried inwards. The warning starts after 1.5 s, so a short ride stays quiet. After a whirl the ring only counts again after a 2.5 s grace.

## Stages, orders and the whirl
- **Order:** stage *n* asks for `n = 1 ? 5 : min(24, 4 + 2n)` merges (5, 8, 10, 12, 14, …). The HUD pill shows the stage, a bar and "N to go".
- **Completion:** "Order complete!" – input pauses, the game waits for the chain reaction to finish (max 2.5 s), then the **whirl** starts. It has to reshuffle a *dense* late-game cluster, which a plain spin never did (everything just turned together), so it works in four phases (`WHIRL` in `game.js`):
  1. **Tear (0–0.55 s):** the water spins up to 3.4 rad/s, the rim turning faster than the middle (`shear`), the drain turns into an *outflow* (`inflowK` −1.3), nothing is held by the cluster any more (`World.free`), the cushion is off, and every cake gets one random kick (turbulence, ~320 u/s). The cluster flies apart to the rim.
  2. **Spin (0.55–1.9 s):** the cakes orbit the rim, overtaking and bumping each other; fairy magnetism is boosted (×2.4) and pulls resting twins too, so twins that pass each other merge – the free merges count for the new order.
  3. **Drain (1.9–2.9 s):** the spin dies down and the current turns into a strong drain (×3.2, bigger cakes pulled harder), everything rushes back to the middle and packs tight.
  4. **Settle (2.9–4.3 s, up to 5.8 s):** the drain eases off, the cushion returns; the whirl ends once every cake is slow and inside the ring. Danger timers are frozen throughout and for 2.5 s after.
  Measured on a dense 17-cake cluster (bigger than the ring): 65–85 % of neighbour pairs change, 2–4 merges, and the cluster fits inside the ring again afterwards in every run.
- **At the end:** the stage banner, a gift (Magic Cake on even stages, Wand on odd), a new world every third stage.
- **Stage multiplier:** `1 + 0.15 · (stage − 1)`, capped at ×2.5, on every merge, on top of combo and streak.
- **Why merges, not target cakes:** an order for a specific cake would have to leave the pond (it is the material for the next tier) or grow exponentially. A merge count keeps every cake, gives stages of 10–25 flicks, and – like Underwatermelon's gates – turns the stuck late-game structure into a fresh one every stage.
- **The ring is not a stage reward:** the calm pool widens with the biggest cake baked (600 + 46 per tier above Cupcake, capped at 880), with a pink pulse and "The pool widens!".

## First-time experience
- **Title screen:**
  - The demo shows Tilly using the same sling: she pulls it back and the preview line appears.
  - A goal card shows *Macaron + Macaron = Cherry Bite … Royal Fairycake* with the line "Flick matching cakes together to bake bigger and bigger ones!".
- **Guided first game:** stored in `localStorage` and repeatable from "How to play".
  1. **Setup:** the pond starts with a small cluster, with a Macaron right in front of the sling, and your first cake is a Macaron.
  2. **Show the gesture:** a cartoon hand shows press, pull back and release, and the coach card says "Pull the cake back & let go!".
  3. **While aiming:** "That's a match! ♥ Let go to merge them" or "Aim at the same cake – a ♥ means: match!".
  4. **First merge:** "Yum! Same cakes merge" with *A + A = B*.
  5. **Bigger goal:** "Bake bigger and bigger cakes – all the way up to the Royal Fairycake!" with a mini chain; the cake ladder pulses.
  6. **Water:** "Read the water – the current at the edge carries slow cakes round; the calm pool inside the ring draws them in", with the foam brightened for a moment.
  7. **Order:** "Fill the order: 5 merges – then the pond whirls and the next stage begins"; the stage pill pulses.
  8. **Ring:** after 6 shots, or when a cake nears the ring, the ring glows pink and the coach says "Keep the cakes in the calm water!".
  9. **A miss:** if the first flick misses, the coach says "So close! Hit a cake that looks the same" and the hand comes back.
- **Later games:** the hand appears again if you don't flick within 2.5 s of the start, or after 14 s of idling, or when you tap the cake or the water. The first flick of a game whose preview rides the current round to the cluster gets a "Riding the current ♥" tip.
- **Cake ladder:** all 11 cakes sit in a strip at the bottom. The cakes this run has reached are lit, the biggest one is highlighted, and a newly reached cake pops.
- **Power-ups:** the buttons stay hidden until you own one. The first Magic Cake and the first Wand are each explained once.
- **Warnings and game over:** the first three times the pond gets dangerously full, the coach says "Too full! Merge cakes to make room". The game-over card explains why the game ended.

## Aim preview
The preview follows the billiards convention: it shows the player's own cake up to its first touch, and nothing of what
that touch sets off. The path through the water is shown because the current bends it in ways that cannot fairly be
judged by eye; the consequences of a hit are the player's to read – that is where the game's skill and its surprises live.

- **Path:** a dotted path runs up to the first contact, curved by the current. It is pink when the contact is a matching cake.
- **Contact:** a dashed ghost marks where the cake will touch.
- **Heart:** a pink heart over a matching target means the two cakes will merge.
- **Push arrow:** if there is no match, a short arrow along the line of centres shows which way the hit cake is pushed (length grows with power). How far it goes, and what that sets off, is not shown.
- **Drift & ride:** a flick into open water shows smaller, calmer dots along the drift – or the ride round the rim – until the cake touches the cluster; if it touches nothing, a dashed ghost marks where it comes to rest.
- **Power:** a power ring around the cake turns from mint to yellow to pink.
- **Not shown on purpose:** chain reactions, where pushed cakes end up, cakes knocked into the current. (v0.4 and v0.5 simulated the hit for ~1 s and drew hearts and ghosts for all of it; it turned aiming into "drag until a heart appears" and the pushed-cake ghosts were never sharp enough to trust. `World.lookAhead` still exists for the bot.)

## Game feel (v0.3, later additions marked)
- **Water (v0.5):** foam flecks and blossom petals ride the current (fast and bright in the rim band, slow in the pool), long foam streaks race round the band, the calm pool is a touch lighter, the ring's dashes and sparkles turn with the pool. A finger on the water leaves ripples.
- **Whirl (v0.4, rebuilt in v0.5.2):** a rising swoosh with a shimmer on top, the water arms brighten and race, the cluster is torn apart and flung round the rim, sparkles and drops fly, twins snap together, then everything rushes back to the middle; "Order complete!" before, the stage banner after.
- **Grab:** pressing lifts the cake a little, with a soft pick-up sound.
- **Pull:**
  - **Following the finger:** the cake follows the drag at half its length, held in a pink ribbon between two candy posts.
  - **Ribbon:** it thins and deepens in colour with tension.
  - **Squeeze:** the cake is squeezed by the band.
  - **Sound:** a rubber creak rises in pitch with the tension.
  - **Pull line:** a dotted line connects the cake to the finger.
- **Detents:**
  - **Feedback:** every 25 % of power gives a click, a tiny vibration on phones that support it and a flash of the notched power ring.
  - **Full power:** the cake trembles, the ring glows pink and a bell rings.
- **Release:**
  - **Launch:** a plucked "twang", a soft thump and a whoosh that grows with power. The cake launches stretched along its path.
  - **Ribbon:** it springs forward and wobbles out.
  - **Shake:** full power adds a slight screen shake.
- **Flight:** fast cakes leave a soft white speed streak and a wake. When the glide ends, a small "plip" and a ripple mark the landing.
- **Preview:** a pulse runs along the dotted path towards the target.
- **Hits:**
  - **Merge:** hit-stop, a ring flash, sprinkles, a nudge for the neighbours and stacked score popups.
  - **Combos:** praise words *Sweet! / Yummy! / Delicious! / Sugar Rush!*.
- **Hot streak:** every flick that makes at least one merge raises the streak. From 2 in a row a badge shows the multiplier, ×1.25 per extra hit up to ×3. A flick that settles without a merge breaks the streak with a little shake.

## Cakes
| Tier | Name | Radius* | Points when created |
| ---: | --- | ---: | ---: |
| 1 | Macaron | 69 | – |
| 2 | Cherry Bite | 87 | 2 |
| 3 | Cupcake | 108 | 6 |
| 4 | Lemon Tart | 132 | 12 |
| 5 | Blossom Cake | 159 | 20 |
| 6 | Choco Cake | 190 | 30 |
| 7 | Peach Cake | 226 | 42 |
| 8 | Blueberry Cake | 267 | 56 |
| 9 | Rainbow Cake | 314 | 72 |
| 10 | Fairy Torte | 367 | 90 |
| 11 | Royal Fairycake | 430 | 110 |
| – | Magic Cake (power-up) | 84 | upgrade of the touched cake |

\*World units; the pond radius is 1000.

- **New cakes:** Macaron, Cherry Bite and Cupcake, with weights 36/30/22. The Lemon Tart (weight 12) joins once a Peach Cake exists. Fewer kinds in the queue means more reachable matches from the single sling.
- **Fairy Magic:** two Royal Fairycakes vanish in a blast worth 500 points that pushes everything outwards.

## Scoring, combos, stages, worlds
- **Combo:** merges less than 1.4 s apart chain into a combo. Points are multiplied by 1 + 0.5 × (combo − 1).
- **Hot streak:** consecutive merging flicks multiply points by 1 + 0.25 × (streak − 1), capped at ×3, on top of the combo.
- **Stage multiplier:** 1 + 0.15 × (stage − 1), capped at ×2.5, on top of both.
- **Stages:** see above. Every finished order grants a power-up, alternating between Magic Cake and Wand.
- **Worlds:** every 3 stages a new world fades in: Blossom Falls → Candy Woods → Moonlight Bay → Rainbow Heights, then the cycle repeats.
- **Cake Book:** the Cake Book records every cake you have discovered, and the best score is saved locally.

## Power-ups and bonuses
- **Magic Cake:** turns your next cake into a rainbow joker that upgrades the first cake it touches.
- **Wand:** tap a cake to make it disappear, or tap the water to cancel. This is your emergency save when the ring is in danger (also right after a whirl that left the pond too full).
- **Swap:** tap "Next" to exchange the current and next cake. Swapping is free.
- **Fairy Bubble:** a bubble appears every 14–22 shots and stays for 16 s. Hitting it gives a Magic Cake, a Wand or 60 points.

## Lose condition in detail
- **Countdown:** the timer runs while a cake's outer edge is beyond the ring *and* the cake is nearly at rest relative to the water (< 420 u/s) and not being carried inwards (< 90 u/s). It counts down when the cake comes back in.
- **Grace period:** freshly launched cakes are ignored for 1.1 s; after a whirl every cake gets 2.5 s. The warning (ring segment, countdown bubble, red pulse, tone) only starts after 1.5 s.
- **Warnings:** the ring segment near the cake glows, a countdown bubble shows above the cake, the screen edge pulses red, a warning tone plays, faces turn worried and Tilly sweats.

## Balance (bot test, v0.5 settings)
A scripted player (`tools/bot.js`) searches the preview (angles in 3° steps × 9 powers, plus a look-ahead the player does not get) for the
flick that bakes the most, swaps when the next cake is better, sometimes waits 2.5 s for the pool to turn a target
round, uses the Wand in danger and aims with human-like noise. "Sloppy" replaces 60 % of its flicks with random lobs.

| Player | Flicks per game | Stage | Biggest cake | Flicks that merge | Knock-outs / danger situations per game |
| --- | --- | --- | --- | --- | --- |
| Careful | 140–170 | 10–11 | tier 9 | ~55 % | 1–5 / 15–21 |
| Sloppy | 80–165 | 7–11 | tier 9–10 | ~48 % | 2–5 / 5–17 |

A flick resolves in about 1–1.5 s, a ride round the rim takes 2–5 s more (the next flick does not have to wait).
A run of 150 flicks takes about 10–12 minutes.

## Art direction
- **One camera.** The arena is tilted, so the pond is an ellipse with ratio K = 0.78. The water sits lower than the bank, so the far inner wall is visible and the spring tumbles over it into the pond. The near bank is a separate front layer that slightly overlaps the cakes at the front, which gives the scene real depth. The island cliff, waterfalls and the castle island use the same viewpoint.
- **One style.** The cakes set the style: rounded shapes, soft gradients, gentle outlines in a darker shade of each colour, and light from the top left. The whole world uses that same vocabulary. Distant layers fade towards the sky colour.
- **Cakes** are drawn procedurally at runtime, so they stay crisp at every size and their faces blink, look at the sling and react with joy, worry or sadness.
- **Sling:** two candy-stick posts with a pink ribbon at the front of the pond. Tilly floats beside it and the "Next" bubble sits on the other side. After each flick, the next cake hops from the bubble into the sling.
- **Backgrounds** are pre-painted WebP layers: sky, castle island, side islands, main island (back and front), cloud sea and cloud puffs, for four worlds. The deterministic generator in `tools/` produces them. At runtime the layers are composed once per screen size, and only the moving parts (waterfalls, water glints, the whirlpool arms, drifting clouds, sparkles) are animated. The whirlpool arms turn at exactly the physics rate.

## Audio
Everything is synthesised with Web Audio:

- **Collisions:** soft bonks between cakes, splashy plops on the rim.
- **Merges:** pops plus pentatonic chimes that rise with the combo.
- **Fanfares:** for discoveries, level-ups and Fairy Magic.
- **Warnings:** tones while a cake is in danger.
- **Music:** a gentle generative music-box lullaby.

Music and sound can be toggled separately in the pause menu.

## Tuning knobs
- **`js/physics.js` → `CFG`:**
  - skim friction `FRICTION` / `FRIC_EPS` / `DRAG`
  - the calm pool `INFLOW` (at the ring) / `INFLOW_MIN` (middle) / `INFLOW_CORE`, the size sorting `SIZE_K0` / `SIZE_K1`, its turn `OMEGA_MIN` / `OMEGA_MAX`
  - the rim current `VRIM_MIN` / `VRIM_MAX`, its inward drift `INFLOW_BAND`, the blend width `BAND_RAMP`
  - how much a fast cake feels the water `SKIM_LO` / `SKIM_HI` / `TAN_K`
  - the cluster: cushion `SPACE` / `SPACE_K`, mass `MASS_EXP`, bounciness `REST`
  - fairy magnetism `TWIN_RANGE` / `TWIN_ACC` / `TWIN_MOVE`
  - the ring `RING_MIN` / `RING_STEP` / `DANGER`, the timer `DANGER_TIME` / `WARN_AT`
  - flick distance range `D_MIN` / `D_MAX`
- **`js/game.js`:**
  - order sizes (`stageGoal`), stage multiplier (`stageMult`), worlds per stage (`themeForStage`), the ring per tier (`ringFor`)
  - the whirl: timeline, top speed, shear, outflow, drain, twin boost and kick (`WHIRL`)
  - flick cone `CONE`, dead zone `DEAD` and pull length (`maxPull`)
  - spawn weights (`randTier`)
  - hit-stop and the neighbour nudge (`mergeBodies` in physics), the streak in `streakMult` / `updatePending`
  - combo window, bubble interval and power-up rewards
  - foam / streak counts (`FOAM_N`, `STREAK_N`), tutorial texts and timing (`updateCoach`)
- **`js/cakes.js`:** tier radii, names and colours.
- **`js/scene.js`:** layout and the arena size on screen.

## Ideas for the next iteration
- Playtest the guided first game with people who have never seen it, and measure time-to-first-merge and time-to-first-ride.
- Calibrate the cluster by feel on a phone: `MASS_EXP`, `SPACE`, `FRICTION`, `INFLOW_MIN` decide how much a hit stirs things up.
- Water with moods per world: a stronger current in Candy Woods, a pulsing tide in Moonlight Bay, two eddies in Rainbow Heights.
- Cakes going over the falls: an open lip at the front where a hard-knocked cake can be lost for good.
- Orders with flavour: "3 Cupcakes", "a Blossom Cake" as optional side quests with a bonus, next to the merge count.
- Goals per world (e.g. "make two Fairy Tortes") and a daily challenge with a fixed seed
- Special cakes: jam (sticky), soufflé (bouncy), meringue bomb
- Better haptics and sound mixing; a few recorded sound effects
- A PWA manifest so it can be installed on the home screen; online leaderboards (needs a backend)
- An artist pass that keeps the layer structure (sky / far / sides / island back+front / clouds) and simply replaces the WebP files
