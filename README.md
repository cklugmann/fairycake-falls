# Fairycake Falls

Flick cute cakes from a little slingshot into a magical floating pond that is
already full of cakes. Identical cakes merge into bigger ones – from a tiny
**Macaron** all the way up to the **Royal Fairycake**. Read the water: a current
races round the edge and carries slow cakes with it, the calm pool inside the ring
draws them in. Fill the castle's orders to make the pond whirl (and fresh cakes
tumble down the spring), and keep the cakes in the calm water, or the pond overflows!

Your first game is a short guided tour that shows the gestures and the goal.

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

The dotted preview shows the flick's path – curved by the current – up to its
first touch: a **pink heart** when that touch is a matching cake, a short arrow
for the direction a hit cake is pushed in, and the ride round the pond for a
flick into open water. What the hit sets off – chains, knock-ons, a cake shoved
into the current – is yours to read. A hard flick flies straight and shoves the
cluster; a soft one curves and lands gently. Merge with every flick to build a
**hot streak** that multiplies your points.

Every stage is an **order** of merges (shown in the pill at the top). Fill it and
the pond **whirls**: the cluster is shuffled, a few fresh cakes tumble down the spring
and join in, your multiplier rises, a gift arrives, and every third stage the island
drifts into a new world. The calm pool widens with every bigger cake you bake. The
**Cake Book** (the pill at the bottom, also in the pause menu) opens mid-game and shows
every cake you have ever baked, with its name – the ones of this run are marked.

To see the guided tour again: **How to play → Show me the tour again**.

## Project structure

```
index.html          markup for canvas, HUD and menus
css/style.css       UI styles            css/font.css   embedded Fredoka font
js/core.js          helpers (math, colours, storage)
js/physics.js       pond physics (whirlpool, pull, drag), merges, aim prediction   <- main tuning constants
js/cakes.js         cake tiers + procedural cake art and faces
js/scene.js         background composition, tilted projection, waterfalls, water FX
js/game.js          game rules, slingshot input, tutorial coach, scoring, levels, power-ups, rendering
js/fx.js            particles, ripples, popups
js/audio.js         Web Audio sound effects + "Tilly's Lullaby" (a composed waltz for celesta, harp, pad, flute)
js/ui.js            HUD, coach tips, menus, Cake Book (also mid-game)
js/main.js          bootstrap
assets/             pre-painted background layers (WebP) + manifest.js
tools/              asset generator (re-creates everything in assets/), bot.js balance harness,
                    snap.js screenshot replay, physlab.js physics experiments (Node, no browser),
                    check-start.js start-layout check
DESIGN.md           game design: rules, numbers, art direction, next steps
```

## Regenerating the background art

All background layers are painted by code in `tools/gen.js` (palettes for the
four worlds are at the top of that file). To rebuild `assets/`:

```
npm i -D playwright      # once
node tools/build-assets.js        # all worlds (~1 minute)
node tools/build-assets.js 2      # only world 3
```

You can also open `tools/generate.html` in a browser to watch it paint.

## Credits

Fredoka font © The Fredoka Project Authors, SIL Open Font License 1.1 (`fonts/OFL.txt`).
Everything else (code, art and sound) is generated procedurally for this project.

## Balance harness

```
npm i -D playwright                 # once (Chromium is downloaded by Playwright)
node tools/bot.js 4 400 1           # 4 careful games, up to 400 flicks each
node tools/bot.js 4 400 0.5         # 4 sloppy games (half of the flicks are random lobs)
node tools/snap.js out 1 10 40 80   # screenshots of a bot game at these flicks
node tools/physlab.js all           # cluster physics experiments, no browser needed
node tools/render-music.js out.wav 110  # render the music to a WAV file (to listen outside the game)
node tools/render-music.js play.wav 60 --sfx   # ... with a scripted minute of game sounds on top
python3 tools/dissonance.py out.wav     # how often strong notes clash (semitone / tritone), frame by frame
```

`bot.js` prints one JSON line per game plus a time course in buckets of ten flicks
(cakes in the pond, fill of the pool, merges on offer, hearts in the preview, warnings).
Set `PW_CHROME=/path/to/chrome` to use a Chromium you already have and `BOT_PAR=2` to
run games in parallel.
