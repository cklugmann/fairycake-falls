# Fairycake Falls – Game Design (prototype v0.3)

## Pitch
A cosy, endless flick-and-merge game. You flick cakes from a little slingshot
into a round pond on a floating island. Identical cakes that touch merge into
the next, bigger cake. The pond slowly fills up. Play for a high score.

**What makes it different from Suika-likes:** nothing is dropped from the top or
floats up from the bottom. You *pull back and flick*, Golf-With-Your-Friends
style, into a pile that a slow whirlpool keeps turning. Bank shots, knock-ons
and chain reactions replace the dropping column.

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
- **Pull back & let go (taught gesture):** press anywhere, drag back, release.
  - **Direction:** the cake flies the opposite way of the drag.
  - **Power:** set by the pull length. Full power is always reachable inside the screen, even on short desktop windows.
  - **Feedback:** the cake visibly moves back in the ribbon, and a dotted line connects it to the finger.
- **Tap or drag forward (fallback):** tap a spot on the water, or drag towards it. The cake is thrown at that spot, so players who "point" instead of "pull" also succeed.
- **How the mode is chosen:** the first movement of a drag decides.
  - Started on open water: only a clear pull *backwards* means slingshot.
  - Started anywhere else: only a clear push *forwards* means pointing.
  - The mode then stays fixed for that drag, so the aim never jumps.
- **Cancel:** drag back to where you started, right-click or press `Esc`.
- **Swap:** tap "Next" or press `Space`.
- **Flick angle:** limited to ±80° from straight ahead, so every flick goes into the pond.

## Core loop
1. **Aim:** the dotted preview simulates the real flick against the current pile, including the turning water.
2. **Physics (skimming + whirlpool current):**
   - **Glide:** cakes skim like curling stones. A near-constant friction relative to the water gives long, even glides in a straight line and a crisp stop.
   - **Current:** once a cake has slowed down, the whirlpool current carries it calmly to the pile and slowly round.
     - Fast cakes ignore the current, so they fly straight.
     - The pile turns at 0.04 rad/s on level 1 and up to 0.12 rad/s by level 10, so every side of it comes round to the sling.
   - **Packing:** the current also presses the pile together.
3. **Merge:**
   - **Contact:** two identical cakes merge on contact. The new cake keeps the momentum and nudges its neighbours, which sets off chain reactions.
   - **Fairy magnetism:** near-misses are pulled together.
   - **Hit-stop:** a short pause of 45–130 ms sells each pop.
4. **Lose:** a cake that rests outside the dotted ring (88 % of the pond radius) for 4 seconds overflows the pond.

## First-time experience
- **Title screen:**
  - The demo shows Tilly using the same sling: she pulls it back and the preview line appears.
  - A goal card shows *Macaron + Macaron = Cherry Bite … Royal Fairycake* with the line "Flick matching cakes together to bake bigger and bigger ones!".
- **Guided first game:** stored in `localStorage` and repeatable from "How to play".
  1. **Setup:** the pond starts with a small cluster, with a Macaron right in front of the sling, and your first cake is a Macaron.
  2. **Show the gesture:** a cartoon hand shows press, pull back and release, and the coach card says "Pull back & let go!".
  3. **While aiming:**
     - When the preview hits the Macaron, the coach says "That's a match! ♥ Let go to merge them".
     - Otherwise it says "Aim at the same cake – a ♥ means: match!".
  4. **First merge:** the layout makes the first flick a chain reaction. The coach shows "Yum! Same cakes merge" with *A + A = B*.
  5. **Bigger goal:** "Bake bigger and bigger cakes – all the way up to the Royal Fairycake!" appears with a mini chain, and the cake ladder pulses.
  6. **Ring:** after 4 shots, or when a cake nears the ring, the ring glows pink and the coach says "Keep the cakes inside the ring!".
  7. **A miss:** if the first flick misses, the coach says "So close! Hit a cake that looks the same" and the hand comes back.
- **Later games:**
  - **Hand reminder:** the hand appears again if you don't flick within 2.5 s of the start, or after 14 s of idling.
  - **Tapping the cake:** a tap on the cake itself shows the hand right away.
- **Cake ladder:** all 11 cakes sit in a strip at the bottom. The cakes this run has reached are lit, the biggest one is highlighted, and a newly reached cake pops.
- **Power-ups:** the buttons stay hidden until you own one. The first Magic Cake and the first Wand are each explained once.
- **Warnings and game over:**
  - The first three times the pond gets dangerously full, the coach says "Too full! Merge cakes to make room".
  - The game-over card explains why the game ended: "A cake stayed outside the ring too long."

## Aim preview
- **Path:** a dotted path runs up to the first contact. It is pink when the flick will hit a matching cake.
- **Contact:** a dashed ghost marks where the cake will hit.
- **Heart:** a pink heart over a matching target means the two cakes will merge.
- **Push arrow:** if there is no match, a white arrow shows which way the hit cake will be pushed.
- **Run-out:** a dashed ghost marks where the flick slows down without hitting anything.
- **Power:** a power ring around the cake turns from mint to yellow to pink.
- **Tap mode:** a small target marks the finger or mouse position.
- **Moving targets:** the preview turns resting cakes with the whirlpool, so the heart is right even though the targets move.

## Game feel (v0.3)
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

## Scoring, combos, levels, worlds
- **Combo:** merges less than 1.4 s apart chain into a combo. Points are multiplied by 1 + 0.5 × (combo − 1).
- **Hot streak:** consecutive merging flicks multiply points by 1 + 0.25 × (streak − 1), capped at ×3, on top of the combo.
- **Level:** level *n* is reached at 50 · n · (n − 1) points, so level-ups and gifts come a bit more often than in v0.2. Every level-up grants a power-up, alternating between Magic Cake and Wand.
- **Worlds:** every 3 levels a new world fades in: Blossom Falls → Candy Woods → Moonlight Bay → Rainbow Heights, then the cycle repeats.
- **Cake Book:** the Cake Book records every cake you have discovered, and the best score is saved locally.

## Power-ups and bonuses
- **Magic Cake:** turns your next cake into a rainbow joker that upgrades the first cake it touches.
- **Wand:** tap a cake to make it disappear, or tap the water to cancel. This is your emergency save when the ring is in danger.
- **Swap:** tap "Next" to exchange the current and next cake. Swapping is free.
- **Fairy Bubble:** a bubble appears every 14–22 shots and stays for 16 s. Hitting it gives a Magic Cake, a Wand or 60 points.

## Lose condition in detail
- **Countdown:** the timer runs while a cake's outer edge is beyond the ring *and* the cake is nearly at rest (< 260 u/s). It counts down when the cake comes back in.
- **Grace period:** freshly launched cakes are ignored for 1.1 s.
- **Warnings:** the ring segment near the cake glows, a countdown bubble shows above the cake, the screen edge pulses red, a warning tone plays, faces turn worried and Tilly sweats.

## Balance (bot test, v0.3 settings)
A scripted player searches the preview for matching flicks, about 300 candidate angles and powers per shot. It swaps when the next cake has a match, waits briefly for the whirlpool to bring a match round, uses Wand and Magic Cake, and aims with human-like noise.

| Player | Shots per game (avg, min–max) | Level | Biggest cake | Best streak |
| --- | --- | --- | --- | --- |
| Careful (searches 80 % of the time) | 155 (127–185) | 8 | tier 9–10 | ~7 |
| Sloppy (searches 50 % of the time) | 136 (93–186) | 8 | tier 9–10 | ~7 |

Each flick now resolves in about 1–1.5 s instead of 3–4 s, so a run of this length takes about 7–10 minutes. Chain reactions and fairy magnetism keep the game forgiving.

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
  - the current `INFLOW` / `INFLOW_CORE`
  - when a cake starts floating with the current `SKIM_LO` / `SKIM_HI`
  - whirlpool speed `SWIRL_MIN` / `SWIRL_MAX`
  - flick distance range `D_MIN` / `D_MAX`
  - bounciness
  - fairy magnetism `TWIN_RANGE` / `TWIN_ACC`
  - danger ring `DANGER` and danger time `DANGER_TIME`
- **`js/game.js`:**
  - level thresholds (`levelScore`) and spawn weights (`randTier`)
  - flick cone `CONE` and pull length (`maxPull`)
  - hit-stop and the neighbour nudge in `onMerge`, and the streak in `streakMult` / `updatePending`
  - combo window, bubble interval and power-up rewards
  - tutorial texts and timing (`updateCoach`)
- **`js/cakes.js`:** tier radii, names and colours.
- **`js/scene.js`:** layout and the arena size on screen.

## Ideas for the next iteration
- Playtest the guided first game with people who have never seen it, and measure time-to-first-merge.
- Goals per world (e.g. "make two Fairy Tortes") and a daily challenge with a fixed seed
- Special cakes: jam (sticky), soufflé (bouncy), meringue bomb
- Better haptics and sound mixing; a few recorded sound effects
- A PWA manifest so it can be installed on the home screen; online leaderboards (needs a backend)
- An artist pass that keeps the layer structure (sky / far / sides / island back+front / clouds) and simply replaces the WebP files
