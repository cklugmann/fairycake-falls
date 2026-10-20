# Fairycake Falls – Game Design (prototype v0.6.2)

## Pitch
A cosy, endless flick-and-merge game. You flick cakes from a little slingshot
into a round pond on a floating island. Identical cakes that touch merge into
the next, bigger cake. The pond slowly fills up. Play for a high score.

**What makes it different from Suika-likes:** nothing is dropped from the top or
floats up from the bottom. You *pull back and flick*, Golf-With-Your-Friends
style, into a loose cluster of cakes floating in a pond with a current of its own.
Bank shots, rides on the current, knock-ons and chain reactions replace the dropping column.

## Design goal for v0.6: tension from the first flick, a pond that stays full and playable
Playtest verdict on v0.5: "it still isn't fun – at the start it takes very long until I have to pay attention, and
once there are enough cakes in the pond it feels blocking and clunky." Measured, both complaints have one root:

- **The start was empty.** Five tiny cakes in a pool whose area they filled to 10 %. With one merge per flick the
  population never grew (a flick adds one cake, a merge removes one), so the pond stayed at 6–10 cakes for the whole
  game. The sloppy bot saw its first warning after ~70 flicks, the careful one at the end of the game.
- **The ladder was too steep for a round pond.** A Rainbow Cake (r 314) took a third of the pond, a Royal Fairycake
  (430) half its width; games ended with 8–13 cakes, four or five of them huge, forming a wall in the middle that the
  small ones bounced off and hung on at the ring. The vision board shows the opposite: a pond full of ~25 cakes, the
  biggest about a fifth of the pond.
- **The cluster never rested.** The personal-space cushion was a purely positional push: the drain pressed resting
  cakes through it into each other, they bounced apart (e 0.35 above 110 u/s), were pressed in again … a cluster of
  20 bumped ~100 times a second, with wobble animations and bonk sounds. That is the "clunky".
- **Resting twins next to each other did not merge** (by design in v0.5). Next to a pile that stirs itself, two
  identical cakes with a gap read as a bug, and a knock-on that leaves a gap is a cheat.

| v0.5 | v0.6 |
| --- | --- |
| Start: 5 cakes in a cross, pool 600 | **A populated start:** 11 cakes (9 in the tutorial) packed by the water, no twins touching, the first cake in the sling always has a match on the front face. The pool starts at **560** – the cluster fills ~40 % of it, a careless push already matters |
| Radii 69 … 430 (×1.26 → ×1.17 per tier) | **A flatter ladder:** 74 … 259 (×1.19 → ×1.10). The pool holds 18 cakes at the start and 40 at the end instead of 8–13; a Royal Fairycake is a quarter of the pool, two of them fit side by side |
| Pool widens 46 per tier to 880 | **36 per tier to 848:** less than the cakes grow, so one cake of every tier just about fills the pool – the late game is about merging the big ones (Magic Cakes!), not about running out of room with eight cakes |
| Nothing arrives but what you flick | **The castle's delivery:** with every finished order a few fresh small cakes (0–9) tumble down the spring and are mixed in by the whirl. The number tops the pool up to a target fill that rises with the stage (36 % → 50 %), limited by how far the cluster already reaches. The pond stays populated for a player who merges every flick, and the pressure ramps for everybody |
| Cushion 0.3 r, positional only | **Cushion 0.08 r, inelastic:** slow approaches (< 260 u/s, the drain's doing) are absorbed at the cushion's edge, a shove passes through. A resting cluster is silent (0 impacts in 10 s measured, instead of ~1000) and compact |
| Resting twins wait for a push | **Touching twins always merge** (`TWIN_MOVE` 0): knock-ons finish, chains run, nothing looks broken |
| Merges inside the whirl fill the next order | **Scored, but they do not fill the order** – a lucky whirl used to complete the next order on the spot (whirl after whirl in the first three flicks of a chain-rich start) |
| Orders up to 24, whirl 4.3–5.8 s, "Order complete" wait 2.5 s | Orders up to **18**; whirl **3.5–4.7 s**, wait **1.4 s** – the stage beat comes every 15–20 flicks and the show is shorter |
| Pool turns 0.1 → 0.2 rad/s | **0.15 → 0.26 rad/s:** the back of the cluster comes round to the sling in 12–20 s instead of 30 |
| Overflow after 4 s, always | **5 s, and up to 10 s while the pool is less than 40 % full:** a cake stuck on a bump of a half-empty cluster is jostled free by the next flicks; a full pond overflows fast. The tip says "Caught in the current!" or "Too full!" accordingly |

The bot harness (`tools/bot.js`) now prints the time course of a game in buckets of ten flicks – cakes in the pond,
fill, merges on offer, hearts in the preview, warnings – and `tools/physlab.js` runs the cluster physics without a
browser (capacity of the pool, rest jitter, the push of a flick, late-game envelopes). Numbers in "Balance" below.

What a flick does to a *packed* cluster is now modest by design: momentum spreads over twenty cakes and the friction
eats it, so the hit cake moves 10–15 u and the shot nestles in at the front. The game is played on the cluster's
surface – like Suika – with the pool's turn, the whirl and the rim rides bringing new faces to the sling.

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
- **An always-visible cake ladder:** it shows the whole goal at a glance. (Replaced in v0.6.1 by the Cake Book pill – see below.)
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
   - **Calm pool** (inside the dotted ring, radius `rCalm`): turns at `omegaCore` (0.15 rad/s on stage 1 → 0.26 on stage 10) and drifts inwards at 90 u/s in the middle rising to 190 u/s at the ring (× a mild size factor, so big cakes sink in a little harder).
   - **Rim current** (outside the ring, blended over 120 u): moves at `vRim` (520 → 700 u/s) with only a gentle inward drift of 110 u/s, so a slow cake rides round the pond.
   - **Coupling:** a cake slower than 380 u/s floats with the water, one faster than 820 skims over the drain – but even a skimming cake feels 30 % of the turning part (`TAN_K`). Cakes that touch the cluster turn with the pool wherever they are, so the current cannot peel the cluster apart.
   - **Skim friction:** 850 u/s² relative to the water the cake feels – an even glide and a clear stop; shoved cakes slide a little.
3. **The cluster:** cakes keep a sliver of cushion, 0.08 × the smaller radius (`SPACE`), restored softly; approaches slower than 260 u/s are absorbed at the cushion's edge (`CUSHION_V`), so the drain packs the cluster without bumping, while a shove passes through. Masses go with r^1.4, bounciness 0.35: a hit shoves rather than bounces.
4. **Merge:**
   - **Contact:** two identical cakes merge when they overlap. The new cake keeps the momentum and nudges its neighbours a little (`NUDGE` 150 u/s, half of v0.5: with twins that merge at rest, the old burst reshuffled the cluster and set off chains nobody planned).
   - **Fairy magnetism:** a cake is pulled to a twin within 0.4 × r – forgiveness for near misses, and the way resting twins that end up side by side find each other (`TWIN_MOVE` 0: touching twins always merge, as in Suika).
   - **Hit-stop:** a short pause of 35–100 ms sells each pop (lighter than in v0.5, chains are common now).
5. **Stage:** every merge fills the order. When it is complete the whirl reshuffles the cluster and the next stage begins (see below).
6. **Lose:** a cake that rests beyond the ring (in the current) for 5 seconds overflows the pond – "rests" meaning at rest relative to the water and not being carried inwards. While the pool is less than 40 % full the limit stretches to up to 10 s (see "Lose condition"). The warning starts after 1.5 s, so a short ride stays quiet. After a whirl the ring only counts again after a 2.5 s grace.

## Stages, orders and the whirl
- **Order:** stage *n* asks for `n = 1 ? 5 : min(18, 4 + 2n)` merges (5, 8, 10, 12, 14, 16, 18, 18, …). The HUD pill shows the stage, a bar and "N to go". Merges the whirl makes by itself are scored but do not count.
- **Completion:** "Order complete!" – input pauses, the game waits for the chain reaction to finish (max 1.4 s), then the **whirl** starts. It has to reshuffle a *dense* late-game cluster, which a plain spin never did (everything just turned together), so it works in four phases (`WHIRL` in `game.js`):
  1. **Tear (0–0.45 s):** the water spins up to 3.4 rad/s, the rim turning faster than the middle (`shear`), the drain turns into an *outflow* (`inflowK` −1.3), nothing is held by the cluster any more (`World.free`), the cushion is off, and every cake gets one random kick (turbulence, ~320 u/s). The cluster flies apart to the rim.
  2. **Spin (0.45–1.55 s):** the cakes orbit the rim, overtaking and bumping each other; fairy magnetism is boosted (×2.4), so twins that pass each other merge (scored, not counted for the order). **The delivery:** the castle's fresh cakes (see below) tumble down the spring one by one, 0.18 s apart, and join the spin (a big delivery runs on into the drain).
  3. **Drain (1.55–2.4 s):** the spin dies down and the current turns into a strong drain (×3.2, bigger cakes pulled harder), everything rushes back to the middle and packs tight.
  4. **Settle (2.4–3.5 s, up to 4.7 s):** the drain eases off, the cushion returns; the whirl ends once every cake is slow and inside the ring. Danger timers are frozen throughout and for 2.5 s after.
  Measured on a dense 17-cake cluster (bigger than the ring): 65–85 % of neighbour pairs change, 2–4 merges, and the cluster fits inside the ring again afterwards in every run.
- **The delivery:** at the start of the whirl the game counts how many Cherry-Bite-sized cakes would top the pool up to `targetFill(stage) = min(0.5, 0.36 + 0.025 (stage − 2))` (sum of cake areas over the pool area; a packed pool reaches ~0.53), caps that at 9, and caps it again by how far the cluster already reaches (edge over ring: > 0.9 → none, > 0.82 → 1, > 0.74 → 2, > 0.66 → 4, > 0.58 → 6). The cakes are Macarons (½), Cherry Bites (⅜) and Cupcakes (⅛), 0.18 s apart. The banner says "N fresh cakes".
- **At the end:** the stage banner, a gift (Magic Cake on even stages, Wand on odd), a new world every third stage.
- **Stage multiplier:** `1 + 0.15 · (stage − 1)`, capped at ×2.5, on every merge, on top of combo and streak.
- **Why merges, not target cakes:** an order for a specific cake would have to leave the pond (it is the material for the next tier) or grow exponentially. A merge count keeps every cake, gives stages of 10–25 flicks, and – like Underwatermelon's gates – turns the stuck late-game structure into a fresh one every stage.
- **The ring is not a stage reward:** the calm pool widens with the biggest cake baked (560 + 36 per tier above Cupcake: 848 at the Royal Fairycake), with a pink pulse and "The pool widens!".

## First-time experience
- **Title screen:**
  - The demo shows Tilly using the same sling: she pulls it back and the preview line appears.
  - A goal card shows *Macaron + Macaron = Cherry Bite … Royal Fairycake* with the line "Flick matching cakes together to bake bigger and bigger ones!".
- **Guided first game:** stored in `localStorage` and repeatable from "How to play".
  1. **Setup:** the pond starts with a small cluster, with a Macaron right in front of the sling, and your first cake is a Macaron.
  2. **Show the gesture:** a cartoon hand shows press, pull back and release, and the coach card says "Pull the cake back & let go!".
  3. **While aiming:** "That's a match! ♥ Let go to merge them" or "Aim at the same cake – a ♥ means: match!".
  4. **First merge:** "Yum! Same cakes merge" with *A + A = B*.
  5. **Bigger goal:** "Bake bigger and bigger cakes – all the way up to the Royal Fairycake!" with a mini chain; the Cake Book pill pulses.
  6. **Water:** "Read the water – the current at the edge carries slow cakes round; the calm pool inside the ring draws them in", with the foam brightened for a moment.
  7. **Order:** "Fill the order: 5 merges – then the pond whirls and the next stage begins"; the stage pill pulses.
  8. **Ring:** after 6 shots, or when a cake nears the ring, the ring glows pink and the coach says "Keep the cakes in the calm water!".
  9. **A miss:** if the first flick misses, the coach says "So close! Hit a cake that looks the same" and the hand comes back.
- **Later games:** the hand appears again if you don't flick within 2.5 s of the start, or after 14 s of idling, or when you tap the cake or the water. The first flick of a game whose preview rides the current round to the cluster gets a "Riding the current ♥" tip.
- **Cake Book (v0.6.1, replaces the ladder):** playtesters wanted to *see what they have unlocked, with names*, and the strip of
  tiny icons at the bottom told them nothing. Now a pill at the bottom ("Cake Book 7/11") opens the book straight out of the game
  (the pond pauses): every cake ever baked with its name, the ones of this run marked "this run", a first-time find glowing with
  "New!" (the pill shows "New!" until the book is opened), unknown cakes as silhouettes with "keep baking!". The same book opens
  from the title and the pause menu. Future work, as a vision: a collection rather than a strict ladder, with many more cakes.
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
| 1 | Macaron | 74 | – |
| 2 | Cherry Bite | 88 | 2 |
| 3 | Cupcake | 103 | 6 |
| 4 | Lemon Tart | 119 | 12 |
| 5 | Blossom Cake | 136 | 20 |
| 6 | Choco Cake | 154 | 30 |
| 7 | Peach Cake | 173 | 42 |
| 8 | Blueberry Cake | 193 | 56 |
| 9 | Rainbow Cake | 214 | 72 |
| 10 | Fairy Torte | 236 | 90 |
| 11 | Royal Fairycake | 259 | 110 |
| – | Magic Cake (power-up) | 80 | upgrade of the touched cake |

\*World units; the pond radius is 1000. (v0.5 radii were 69 … 430; see the v0.6 notes for why the ladder is flatter now.)

- **New cakes:** Macaron, Cherry Bite, Cupcake and Lemon Tart, with weights 32/30/24/14. The Blossom Cake (weight 8) joins once a Peach Cake exists. Fewer kinds in the queue means more reachable matches from the single sling.
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
- **Countdown:** the timer runs while a cake's outer edge is beyond the ring *and* the cake is nearly at rest relative to the water (< 420 u/s) and not being carried inwards (< 90 u/s). It counts down when the cake comes back in. The limit is 5 s, plus 25 s × (0.4 − fill) while the pool is less than 40 % full (10 s at 20 %): a cake stuck on a bump of a half-empty cluster is not an overflow yet, the next flicks jostle it free.
- **Grace period:** freshly launched cakes are ignored for 1.1 s; after a whirl every cake gets 2.5 s. The warning (ring segment, countdown bubble, red pulse, tone) only starts after 1.5 s.
- **Warnings:** the ring segment near the cake glows, a countdown bubble shows above the cake, the screen edge pulses red, a warning tone plays, faces turn worried and Tilly sweats.

## Balance (bot test, v0.6 settings)
A scripted player (`tools/bot.js`) searches the preview (angles in 3° steps × 9 powers, plus a look-ahead the player does not get) for the
flick that bakes the most, swaps when the next cake is better, sometimes waits 2.5 s for the pool to turn a target
round, uses the Wand in danger and aims with human-like noise. "Typical" replaces 25 % of its flicks with random lobs,
"sloppy" 50 %. Note that even the sloppy bot reads push-merges through the look-ahead and rides the current far more
than a person would, so its merge rate is on the high side and its danger blips mostly come from rides.

| Player | Flicks per game | Stage | Biggest cake | Flicks that merge | Heart in the preview | Cakes in the pond | First warning (flick) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Careful | 150–200 | 12–15 | tier 10–11 | ~60 % | 50–80 % of turns | 6–14 | ~50–75 |
| Typical | 130–160 | 11–13 | tier 9–10 | ~55 % | 60–90 % | 7–13 | ~50–75 |
| Sloppy | 85–180 | 8–14 | tier 9–10 | ~53 % | 70–100 % | 7–16 | ~25–60 |

For comparison, v0.5 with the same bot: careful 130–280 flicks (stage 9–15), typical 140–200, sloppy 135–140; the pond held
6–17 cakes, the pool filled (old metric) from ~20 % to 70–85 %, and the typical player's first real warning came at the very end.

The time course (`tools/bot.js` prints it in buckets of ten flicks) is the thing to watch when tuning: cakes in the pond
should sit around 10–15 from the first flick on, the fill should climb towards 45 % by the last third, hearts should be on
offer in well over half of the turns, and warnings should appear in the last third, not only on the fatal flick.
A flick resolves in about 1–1.5 s, a ride round the rim takes 2–5 s more (the next flick does not have to wait).
A run of 150 flicks takes about 10 minutes.

**Physics lab** (`tools/physlab.js`, v0.6): the pool holds 18 cakes (tiers 1–6 mix) at the start ring of 560 and 40 at 880; a packed
cluster at rest makes 0 impacts in 10 s (v0.5 cushion: ~1000); resting twins with a gap inside the magnetism range merge in
0.1–0.25 s; a full-power Macaron into a packed 20-cake cluster moves the cakes it hits by 6–15 u and comes to rest at the front;
one cake of every tier 1–11 reaches 94–100 % of the Royal's ring (848).

## Art direction
- **One camera.** The arena is tilted, so the pond is an ellipse with ratio K = 0.78. The water sits lower than the bank, so the far inner wall is visible and the spring tumbles over it into the pond. The near bank is a separate front layer that slightly overlaps the cakes at the front, which gives the scene real depth. The island cliff, waterfalls and the castle island use the same viewpoint.
- **One style.** The cakes set the style: rounded shapes, soft gradients, gentle outlines in a darker shade of each colour, and light from the top left. The whole world uses that same vocabulary. Distant layers fade towards the sky colour.
- **Cakes** are drawn procedurally at runtime, so they stay crisp at every size and their faces blink, look at the sling and react with joy, worry or sadness.
- **Sling:** two candy-stick posts with a pink ribbon at the front of the pond. Tilly floats beside it and the "Next" bubble sits on the other side. After each flick, the next cake hops from the bubble into the sling.
- **Backgrounds** are pre-painted WebP layers: sky, castle island, side islands, main island (back and front), cloud sea and cloud puffs, for four worlds. The deterministic generator in `tools/` produces them. At runtime the layers are composed once per screen size, and only the moving parts (waterfalls, water glints, the whirlpool arms, drifting clouds, sparkles) are animated. The whirlpool arms turn at exactly the physics rate.

## Audio
Everything is synthesised with Web Audio (`js/audio.js`), no audio files.

**v0.6.2 – one key for everything.** Playtesters called the v0.6.1 lullaby "still too dissonant". Measured with
`tools/dissonance.py` (an offline render, frame by frame: strong spectral peaks that sound together a semitone, a
minor ninth or a tritone apart), 44 % of its frames had such a clash. The causes, each fixed:

- *Inharmonic bell partials* (2, 3, 4.16, 5.43 × f) on every chime and melody note → **harmonic celesta** (1, 2, 3, 4, 6 × f).
- *Major sevenths under a melody on the root* (G4 over Gmaj7, C5 over Cmaj7 = minor seconds) → **plain triads in the
  pad**, a 6th or 9th only in the harp where the melody leaves room; the lydian F# is gone.
- *Effects in two other keys* (fanfares in C and E major against a tune in G: G# against G, D# against D, C against B) →
  **every chime, fanfare and warning in the G major pentatonic** (`PENT`), which cannot rub against any chord of the tune.
- *Sliding tones* (bloops, twangs, a rising siren in the whirl) → pitched effects sit on scale notes (the launch is a harp
  pluck on D4, bumps are wooden "toks" on a scale note, lower for bigger cakes); what must not have a pitch is noise (plops, whooshes).
- *A long, loud hall and a feedback echo* smearing one chord into the next → hall 1.7 s at 38 %, one quiet echo, and a
  0.4 s crossfade between chords instead of 1 s.
- *The flute an octave down, beating against the pad* → the flute sings at the melody's pitch; registers stay apart:
  bass (36–47) – pad and harp (45–71) – melody (67–81, 79–93 on the bright round).
- Sparkles now use the bar's own chord notes.

Result on the meter: 15 % of frames (music alone), 25 % with a scripted minute of effects on top – the rest is reverb tails
across chord changes, leading tones resolving, and noise sweeps, which the meter cannot tell from clashes. The score
itself is clean (every melody note checked against its bar's chord; the only deliberate tension is the F# over C in the
D7sus bar, the classic dominant resolving home).

- **Music – "Tilly's Lullaby":** a composed 16-bar tune in G major, 6/8 at a rocking 55 bpm (dotted quarter). Chords:
  G · G6 · Em · Em · C · Cadd9 · Dsus4 · D · G · Bm · C · Am7 · G/B · C · D7sus · G. Four rounds that rotate: celesta
  over the rolling harp; the **flute** singing the tune with the harp thinned out; the celesta an **octave up** over a
  brighter harp; a **quiet round** of harp and pad only. A harp flourish up the pentatonic at the end of each phrase.
  Instruments: **celesta** (sine with harmonic partials that fade quickly, the tiny click of the pin), **harp** (a
  triangle whose brightness closes right after the pluck), **pad** (two triangles 3 cents apart under a slowly breathing
  low-pass, spread left to right, plain triads), **bass** (sine with a touch of its octave), **flute** (sine with a whisper
  of its octave, a breath and a vibrato that sets in late). `node tools/render-music.js out.wav 110` renders the tune;
  `--sfx` adds a scripted minute of play on top.
- **Pulling the sling:** an airy shimmer of fairy dust swells and brightens with the tension; the four detents play
  G B D G on the celesta; full power adds a high sparkle. No creaking rubber.
- **Collisions:** wooden "toks" on scale notes between cakes, a splashy plop on the rim.
- **Merges:** a puff, a soft low note and a two-note chime (three for big cakes) that climbs the pentatonic with the combo.
- **Fanfares:** G major arpeggios and pentatonic runs for discoveries, orders, stages, the whirl and Fairy Magic.
- **Warnings:** a soft, questioning two-note call (B4 → G4) while a cake is in danger.

Music and sound can be toggled separately in the pause menu. Mix (offline render): peak −12 dBFS, long-term RMS −29 dBFS
(−26 with effects), no clipping; the master compressor (threshold −14 dB, ratio 3) only catches peaks.

## Tuning knobs
- **`js/physics.js` → `CFG`:**
  - skim friction `FRICTION` / `FRIC_EPS` / `DRAG`
  - the calm pool `INFLOW` (at the ring) / `INFLOW_MIN` (middle) / `INFLOW_CORE`, the size sorting `SIZE_K0` / `SIZE_K1`, its turn `OMEGA_MIN` / `OMEGA_MAX`
  - the rim current `VRIM_MIN` / `VRIM_MAX`, its inward drift `INFLOW_BAND`, the blend width `BAND_RAMP`
  - how much a fast cake feels the water `SKIM_LO` / `SKIM_HI` / `TAN_K`
  - the cluster: cushion `SPACE` / `SPACE_K` / `CUSHION_V` (the approach speed the cushion absorbs), mass `MASS_EXP`, bounciness `REST`
  - fairy magnetism `TWIN_RANGE` / `TWIN_ACC` / `TWIN_MOVE`
  - the ring `RING_MIN` / `RING_STEP` / `DANGER`, the timer `DANGER_TIME` / `WARN_AT`
  - flick distance range `D_MIN` / `D_MAX`
- **`js/game.js`:**
  - order sizes (`stageGoal`), stage multiplier (`stageMult`), worlds per stage (`themeForStage`), the ring per tier (`ringFor`)
  - the start cluster (`START_N`, the tier list in `setupStart`), the delivery (`targetFill`, `DELIVERY_MAX`, the reach caps in `deliverySize`, the tier mix in `deliverCake`)
  - the whirl: timeline, top speed, shear, outflow, drain, twin boost and kick (`WHIRL`)
  - flick cone `CONE`, dead zone `DEAD` and pull length (`maxPull`)
  - spawn weights (`randTier`)
  - hit-stop and the neighbour nudge (`mergeBodies` in physics), the streak in `streakMult` / `updatePending`
  - combo window, bubble interval and power-up rewards
  - foam / streak counts (`FOAM_N`, `STREAK_N`), tutorial texts and timing (`updateCoach`)
- **`js/cakes.js`:** tier radii, names and colours.
- **`js/scene.js`:** layout and the arena size on screen.

## Ideas for the next iteration
- Playtest v0.6 by feel on a phone: does the populated start read as "a pond of cakes" or as clutter? Is the delivery at the whirl
  a treat or a threat? Tune `targetFill` and `START_N` from that.
- A third slot in the queue ("after next") for planning chains.
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
