# Fairycake Falls

Flick cute cakes from a little slingshot into a magical floating pond.
Identical cakes merge into bigger ones – from a tiny **Macaron** all the way up
to the **Royal Fairycake**. Keep the dotted ring clear, or the pond overflows!

Your first game is a short guided tour that shows the gesture and the goal.

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
| Flick a cake | Press anywhere, **pull back**, let go – like a slingshot. Pull further for more power | – |
| Throw at a spot | Tap the spot on the water – the cake lands right there (or drag towards it) | – |
| Cancel a flick | Drag back to where you started (or right-click) | `Esc` |
| Swap current / next cake | Tap **Next** | `Space` |
| Magic Cake (joker) | Tap its button (appears once you earn one) | – |
| Wand (remove a cake) | Tap its button, then a cake | – |
| Pause | Pause button | `Esc` |

The dotted preview shows the flick's path against the current pile. A **pink
heart** means the flick will hit a matching cake. Merge with every flick to
build a **hot streak** that multiplies your points. The ladder at the bottom shows
the whole cake chain and how far you got this run.

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
js/audio.js         Web Audio sound effects + music-box lullaby
js/ui.js            HUD, coach tips, cake ladder, menus, Cake Book
js/main.js          bootstrap
assets/             pre-painted background layers (WebP) + manifest.js
tools/              asset generator (re-creates everything in assets/)
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
