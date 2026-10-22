# Fairycake Falls

Flick cute cakes from a little slingshot into a magical floating pond that is
already full of cakes. Cakes of the same size merge into bigger ones. Read the water:
a current races round the edge and carries slow cakes with it, the calm pool inside
the ring draws them in. Keep the cakes in the calm water, or the pond overflows!

**v0.7 – the adventure.** Five worlds, each with its own menu of eleven cakes, and
eight levels each: every level is a recipe ("bake the Lavender Dream"), and every
cake you bake for the first time goes into the **Cake Book** with its name, its story
and its ingredients. Rare finds drift into the sling now and then. The classic
endless pond is still there as **Endless Pond**, and it drifts through the worlds you
have unlocked.

Your first level is a short guided tour that shows the gestures and the goal.

Prototype: pure HTML / CSS / JavaScript, no backend, no build step.

## Play

Double-click **`index.html`**. It runs straight from the file system in Chrome,
Edge, Firefox and Safari. Phone portrait is the primary format, but desktop
and landscape work too.

If your browser blocks local files, run any static server in this folder instead
(for example `npx serve .`) and open the printed URL.

## Controls

Mouse and touch work the same.

| Action | Touch / mouse | Keyboard |
| --- | --- | --- |
| Flick a cake | Press the cake in the sling (or anywhere outside the water), **pull back**, let go – like a slingshot. Pull further to send it further | – |
| Cancel a flick | Drag back to where you started (or right-click) | `Esc` |
| Swap current / next cake | Tap **Next** | `Space` |
| Magic Cake (joker) | Tap its button (appears once you earn one) | – |
| Wand (remove a cake) | Tap its button, then a cake | – |
| Pause | Pause button | `Esc` |
| World map | Swipe the card or tap the arrows | `←` `→` |

The dotted preview shows the flick's path – curved by the current – up to its
first touch: a **pink heart** when that touch is a matching cake, a short arrow
for the direction a hit cake is pushed in, and the ride round the pond for a
flick into open water. A hard flick flies straight and shoves the cluster; a soft
one curves and lands gently. Merge with every flick to build a **hot streak**.

## The adventure

- **Worlds:** Blossom Falls, Candy Woods, Moonlight Bay, Rainbow Heights, Starfall Realm.
  Each world has its own eleven cakes (the shape says the size, the world says the flavour)
  and its own painted backdrop.
- **Levels:** eight per world. The level card names the cake to bake (a silhouette with a
  hint until you have baked it once). The pond starts with a few bigger cakes already in it,
  placed so that the goal is a few dozen merges away – never a free cascade. One star for
  baking it, two and three for the score at that moment. The next world opens when you clear
  level 5 of the one before.
- **Orders and the whirl** still set the beat inside a level: fill the order and the pond
  whirls, fresh cakes tumble down the spring, your multiplier rises, a gift arrives.
- **The Cake Book** (the pill at the bottom, the book button on the map, the pause menu) has a
  page per world plus the rare finds. Tap a cake for its story and ingredients; on a desktop,
  hovering shows its epithet.
- **Rare finds:** five cakes that can take the place of a normal cake in the sling in any
  world (some prefer one world). Merge one to add it to the book and earn bonus points.
- **Endless Pond:** the classic high-score game. Every third stage the island drifts into the
  next world you have unlocked, and the cakes from then on wear that world's flavours.

## Project structure

```
index.html          markup for canvas, HUD, menus, the map and the cards
css/style.css       UI styles            css/font.css   embedded Fredoka font
js/core.js          helpers (math, colours, storage)
js/physics.js       pond physics (whirlpool, pull, drag), merges, aim prediction   <- main tuning constants
js/cakes.js         cake tiers (sizes), the collection (every cake's look, name, lore) and the procedural cake art
js/levels.js        worlds, levels (goal, start cluster, water mood, gifts), stars, progress and the Cake Book store
js/scene.js         background composition, tilted projection, waterfalls, water FX
js/game.js          game rules, slingshot input, tutorial coach, scoring, modes (level / endless), power-ups, rendering
js/fx.js            particles, ripples, popups
js/audio.js         Web Audio sound effects + "Tilly's Lullaby"
js/ui.js            HUD, coach tips, menus, world map, level cards, Cake Book
js/main.js          bootstrap + debug hooks (FCdebug.level(w, l), FCdebug.unlockAll(), FCdebug.wipe())
assets/             pre-painted background layers (WebP) for the five worlds + manifest.js
tools/              asset generator (re-creates everything in assets/), bot.js balance harness (levels too),
                    snap.js screenshot replay, physlab.js physics experiments (Node, no browser),
                    check-start.js start-layout check, cakesheet.html (every cake on one page)
DESIGN.md           game design: rules, numbers, art direction, next steps
```

## Regenerating the background art

All background layers are painted by code in `tools/gen.js` (palettes for the
five worlds are at the top of that file). To rebuild `assets/`:

```
npm i -D playwright      # once
node tools/build-assets.js        # all worlds (~1 minute each)
node tools/build-assets.js 4      # only world 5
```

You can also open `tools/generate.html` in a browser to watch it paint, and
`tools/cakesheet.html` to see every cake of the collection on one page.

## Credits

Fredoka font © The Fredoka Project Authors, SIL Open Font License 1.1 (`fonts/OFL.txt`).
Everything else (code, art and sound) is generated procedurally for this project.

## Balance harness

```
npm i -D playwright                 # once (Chromium is downloaded by Playwright)
node tools/bot.js 4 400 1           # 4 careful endless games, up to 400 flicks each
node tools/bot.js 4 400 0.5         # 4 sloppy games (half of the flicks are random lobs)
node tools/bot.js 4 400 1 2.5       # 4 careful games of Moonlight Bay, level 6: flicks and score at the clear
node tools/snap.js out 1 10 40 80   # screenshots of a bot game at these flicks
node tools/physlab.js all           # cluster physics experiments, no browser needed
node tools/render-music.js out.wav 110  # render the music to a WAV file (to listen outside the game)
python3 tools/dissonance.py out.wav     # how often strong notes clash (semitone / tritone), frame by frame
```

`bot.js` prints one JSON line per game plus a time course in buckets of ten flicks
(cakes in the pond, fill of the pool, merges on offer, hearts in the preview, warnings);
with a `world.level` argument it also prints a LEVEL line (won, flicks and score at the
clear, stars) that the star thresholds in `js/levels.js` were set from.
Set `PW_CHROME=/path/to/chrome` to use a Chromium you already have and `BOT_PAR=2` to
run games in parallel.
