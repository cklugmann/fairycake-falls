/* Fairycake Falls – worlds, levels, progress and the collection.

   Adventure mode: five worlds, eight levels each. Every level is a recipe – "bake the
   <cake>" – for the next tier of the world's menu (tier 4 in level 1 … the royal cake in
   level 8). The pond starts with a cluster that already holds some bigger cakes, placed
   so that the goal is some merges away (level 1 is a trick shot: one good flick can set off
   the whole ladder).

   Stars are about baking it neatly, never about stalling: ★ for baking the cake, ★★ and ★★★
   for baking it within a number of flicks (the level card and the HUD show how many). A
   quick bake is always the best bake. (v0.7 gave stars for the score at the moment of the
   bake – a player who finished fast had fewer points and got fewer stars.)

   Difficulty rises over all forty levels, not just inside a world: every world has a water
   mood of its own that grows towards its castle, its start clusters ask for more, and the
   first levels of a new world are a breather after the castle of the last one. The next
   level opens with one star; the next world opens after level 5 of the previous one.

   The collection (the Cake Book) remembers every kind ever baked, across both modes. */
(function () {
  'use strict';
  const FC = window.FC;

  const WORLDS = [
    { name: 'Blossom Falls', tag: 'The Little Fairy Bakery', theme: 0,
      blurb: 'Where every fairy learns to bake. Soft meadows, a pink castle and the first eleven recipes.' },
    { name: 'Candy Woods', tag: 'The Enchanted Forest', theme: 1,
      blurb: 'Autumn in the enchanted forest: honey, acorns, toadstools and gingerbread – and a wind that never quite stops.' },
    { name: 'Moonlight Bay', tag: "The Witch's Bakery", theme: 2,
      blurb: 'Night falls over the bay. Potions bubble, stars drop into the frosting and the moon pulls at the water.' },
    { name: 'Rainbow Heights', tag: 'The Royal Dessert Kingdom', theme: 3,
      blurb: 'Above the clouds the royal pâtissiers work with gold leaf, crystals and spun sugar. Mind the high winds.' },
    { name: 'Starfall Realm', tag: 'The Legendary Fairy Realms', theme: 4,
      blurb: 'Dragons, unicorns and the aurora itself – the oldest, strangest recipes in the kingdom.' },
  ];
  const LEVELS_PER_WORLD = 8;
  const UNLOCK_AT = 5; // clearing this level (1-based) of a world opens the next world

  // Every world's water has a character of its own: the same for all eight levels, a little stronger towards the
  // castle ([level 1, level 8], interpolated). rim = speed of the rim current, turn = how fast the calm pool turns,
  // tide = how far (world units, of a pool ~600-850 wide) the calm pool breathes in and out with the moon.
  const WORLD_MOODS = [
    { name: 'Spring water', text: 'A gentle pond to learn in.' },
    { name: 'Autumn wind', text: 'The wind drives the current round the rim – soft flicks ride further.', rim: [1.1, 1.24] },
    { name: 'Moon tide', text: 'The calm pool rises and falls with the moon – mind the low tide.', tide: [24, 40], turn: [1.05, 1.12] },
    { name: 'High winds', text: 'Up here the calm pool turns quickly – targets come and go.', turn: [1.25, 1.45], rim: [1.05, 1.12] },
    { name: 'Starfall rapids', text: 'Everything moves faster in the realm, and the pool breathes.', rim: [1.12, 1.24], turn: [1.12, 1.28], tide: [14, 26] },
  ];

  // Start clusters, per world and level: the big cakes first (they sit in the middle), then the small fry the water
  // packs round them. Never a cake as big as the goal (it would spoil the recipe). Level 1 is a trick shot on purpose:
  // one good flick sets off the whole ladder. From level 2 on there is a gap in the ladder, so no single bake cascades
  // straight to the goal.
  // What sets the length of a level is the "build" (the highest rung the player has to assemble from small cakes) and
  // the crowd of big cakes round it. Measured (bot): a tier-6 build takes ~9–20 flicks, a tier-7 build ~20–30, and four
  // giant cakes in the pool (the castle, levels 7 and 8) push either to ~35–45. Every world climbs the same way, the
  // later worlds start levels 4–6 with a little less, and the water mood adds the rest. DESIGN.md has the measured table.
  const STARTS = [
    [ // Blossom Falls – learning the pond
      [3, 2, 1, 2, 1, 2, 1],
      [3, 2, 1, 2, 1, 2, 1],
      [4, 2, 1, 2, 1, 2, 1],
      [6, 3, 2, 1, 2, 1, 2, 1],
      [7, 6, 2, 1, 2, 1, 2, 1],
      [8, 7, 6, 2, 1, 2, 1, 2],
      [9, 8, 7, 6, 4, 2, 1, 2, 1],
      [10, 9, 8, 7, 5, 4, 2, 1, 2],
    ],
    [ // Candy Woods – the autumn wind
      [3, 2, 1, 2, 1, 2, 1],
      [3, 2, 1, 2, 1, 2, 1],
      [4, 2, 1, 2, 1, 2, 1],
      [5, 3, 2, 1, 2, 1, 2, 1],
      [7, 6, 2, 1, 2, 1, 2],
      [8, 7, 6, 2, 1, 2, 1],
      [9, 8, 7, 6, 4, 2, 1, 2],
      [10, 9, 8, 7, 5, 4, 2, 1, 2],
    ],
    [ // Moonlight Bay – the moon tide
      [3, 2, 1, 2, 1, 2, 1],
      [3, 2, 1, 2, 1, 2, 1],
      [4, 2, 1, 2, 1, 2, 1],
      [5, 3, 2, 1, 2, 1, 2, 1],
      [7, 5, 4, 2, 1, 2, 1, 2, 1],
      [8, 7, 5, 4, 2, 1, 2, 1, 2],
      [9, 8, 7, 5, 4, 2, 1, 2, 1],
      [10, 9, 8, 7, 5, 4, 2, 1, 2, 1],
    ],
    [ // Rainbow Heights – high winds
      [3, 2, 1, 2, 1, 2, 1],
      [3, 2, 1, 2, 1, 2, 1],
      [4, 2, 1, 2, 1, 2, 1],
      [5, 3, 2, 1, 2, 1, 2, 1],
      [7, 5, 4, 2, 1, 2, 1, 2],
      [8, 7, 5, 4, 2, 1, 2, 1],
      [9, 8, 7, 5, 4, 2, 1, 2],
      [10, 9, 8, 7, 5, 4, 2, 1, 2],
    ],
    [ // Starfall Realm – everything at once
      [3, 2, 1, 2, 1, 2, 1],
      [3, 2, 1, 2, 1, 2, 1],
      [4, 2, 1, 2, 1, 2, 1],
      [5, 3, 2, 1, 2, 1, 2, 1],
      [7, 5, 3, 2, 1, 2, 1, 2, 1],
      [8, 7, 5, 3, 2, 1, 2, 1, 2],
      [9, 8, 7, 5, 3, 2, 1, 2, 1],
      [10, 9, 8, 7, 5, 3, 2, 1, 2, 1],
    ],
  ];

  // Flicks for ★★ and ★★★ (bake it within that many), per world and level. Measured with tools/bot.js: ★★★ is about
  // what a good player needs, ★★ leaves room for a few misses (see DESIGN.md, "Stars").
  const PAR = [
    [[6, 3], [6, 4], [10, 6], [19, 12], [34, 23], [57, 29], [69, 51], [75, 55]],
    [[4, 2], [6, 4], [10, 6], [23, 16], [44, 26], [50, 26], [75, 53], [75, 55]],
    [[4, 2], [6, 4], [10, 6], [23, 16], [38, 26], [59, 37], [71, 50], [73, 54]],
    [[4, 2], [6, 4], [10, 6], [23, 16], [38, 24], [61, 31], [72, 52], [75, 55]],
    [[4, 2], [6, 4], [10, 6], [23, 16], [47, 36], [58, 40], [69, 50], [69, 50]],
  ];

  // a little extra flavour on some levels (on top of the world's mood): a gift, a pantry, a calmer or wilder day
  const MODS = {
    '0.4': { gifts: { wands: 1 }, name: 'A spare Wand', text: 'Tilly packed a Wand: tap it, then tap a cake to poof it away.' },
    '0.6': { queue: [30, 30, 24, 16], name: 'Busy bakery', text: 'More Tarts come down the queue today.' },
    '1.2': { water: { rim: 0.8 }, name: 'Honey current', text: 'Sticky honey slows the rim current today.' },
    '1.5': { water: { rim: 1.15 }, name: 'Autumn gale', text: 'The wind blows harder than ever.' },
    '2.2': { water: { tide: 1.4 }, name: 'Spring tide', text: 'A big moon tonight – the tide runs high and low.' },
    '2.5': { water: { turn: 1.2 }, name: 'Whirling moon', text: 'The calm pool turns quickly tonight.' },
    '3.3': { queue: [26, 28, 26, 14, 6], name: 'Rich pantry', text: 'The queue brings bigger cakes.' },
    '3.6': { water: { rim: 1.15 }, name: 'Storm clouds', text: 'Wind and current, both at once.' },
    '4.3': { queue: [26, 28, 26, 14, 6], name: 'Legendary pantry', text: 'The queue brings bigger cakes.' },
    '4.5': { water: { rim: 1.1, turn: 1.1 }, name: 'Phoenix wind', text: 'A fierce wind sweeps the realm.' },
  };

  // the two royal levels of every world start with Wands: four or five giant cakes crowd the pond from the first flick,
  // and a long level should not end on one unlucky ride (the bot lost one game in four with one and two Wands)
  const BASE_GIFTS = [null, null, null, null, null, null, { wands: 2 }, { wands: 3 }];

  // the world's mood at level l (0..7), with the level's own twist multiplied in
  function waterFor(w, l, mod) {
    const m = WORLD_MOODS[w], k = l / (LEVELS_PER_WORLD - 1);
    const at = (pair, def) => (pair ? pair[0] + (pair[1] - pair[0]) * k : def);
    const water = { rim: at(m.rim, 1), turn: at(m.turn, 1), tide: at(m.tide, 0) };
    if (mod && mod.water) {
      if (mod.water.rim) water.rim *= mod.water.rim;
      if (mod.water.turn) water.turn *= mod.water.turn;
      if (mod.water.tide) water.tide *= mod.water.tide;
    }
    return water;
  }

  function level(w, l) {
    const world = WORLDS[w];
    const goal = 4 + l;
    const mod = MODS[w + '.' + l] || null;
    return {
      w, l, world, goal, kind: 'w' + w + 't' + goal, start: STARTS[w][l].slice(), par: PAR[w][l].slice(),
      water: waterFor(w, l, mod), mood: WORLD_MOODS[w], gifts: (mod && mod.gifts) || BASE_GIFTS[l], queue: (mod && mod.queue) || null, mod,
    };
  }
  const key = (w, l) => w + '.' + l;

  // stars for a bake that took this many flicks (par = [flicks for ★★, flicks for ★★★])
  function starsForFlicks(par, flicks) {
    return flicks <= par[1] ? 3 : flicks <= par[0] ? 2 : 1;
  }

  // ------------------------------------------------------------------
  // progress: stars, fewest flicks and best scores per level
  // ------------------------------------------------------------------
  const Progress = {
    data: null,
    load() {
      if (!this.data) this.data = FC.store.get('progress', { levels: {}, lastWorld: 0 });
      return this.data;
    },
    save() { FC.store.set('progress', this.load()); },
    entry(w, l) { return this.load().levels[key(w, l)] || null; },
    stars(w, l) { const e = this.entry(w, l); return e ? e.stars : 0; },
    best(w, l) { const e = this.entry(w, l); return e ? e.best : 0; },
    // fewest flicks a bake of this level took (0 = not known: never baked, or baked before v0.8 counted flicks)
    flicks(w, l) { const e = this.entry(w, l); return e && e.flicks ? e.flicks : 0; },
    worldUnlocked(w) { return w === 0 || this.stars(w - 1, UNLOCK_AT - 1) > 0; },
    unlocked(w, l) { return l === 0 ? this.worldUnlocked(w) : this.stars(w, l - 1) > 0 && this.worldUnlocked(w); },
    worldStars(w) { let n = 0; for (let l = 0; l < LEVELS_PER_WORLD; l++) n += this.stars(w, l); return n; },
    worldCleared(w) { for (let l = 0; l < LEVELS_PER_WORLD; l++) if (this.stars(w, l) < 1) return false; return true; },
    totalStars() { let n = 0; for (let w = 0; w < WORLDS.length; w++) n += this.worldStars(w); return n; },
    starsFor(w, l, flicks) { return starsForFlicks(PAR[w][l], flicks); },
    // the current level: the first one not yet cleared (or the last one)
    current() {
      for (let w = 0; w < WORLDS.length; w++) {
        if (!this.worldUnlocked(w)) break;
        for (let l = 0; l < LEVELS_PER_WORLD; l++) if (this.stars(w, l) < 1) return { w, l };
      }
      return { w: WORLDS.length - 1, l: LEVELS_PER_WORLD - 1 };
    },
    next(w, l) {
      if (l + 1 < LEVELS_PER_WORLD) return { w, l: l + 1 };
      if (w + 1 < WORLDS.length && this.worldUnlocked(w + 1)) return { w: w + 1, l: 0 };
      return null;
    },
    // a level was cleared in this many flicks, with this score
    record(w, l, score, flicks) {
      const d = this.load();
      const k = key(w, l);
      const prev = d.levels[k] || { stars: 0, best: 0, flicks: 0 };
      const worldWas = w + 1 < WORLDS.length && this.worldUnlocked(w + 1);
      const stars = this.starsFor(w, l, flicks);
      const prevFlicks = prev.flicks || 0;
      const e = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best || 0, score), flicks: prevFlicks ? Math.min(prevFlicks, flicks) : flicks };
      d.levels[k] = e;
      d.lastWorld = w;
      this.save();
      const worldNow = w + 1 < WORLDS.length && this.worldUnlocked(w + 1);
      return {
        stars, prevStars: prev.stars, flicks, prevFlicks, newBestFlicks: !prevFlicks || flicks < prevFlicks,
        newBest: score > (prev.best || 0), worldUnlocked: worldNow && !worldWas ? w + 1 : -1, first: prev.stars === 0,
      };
    },
    setLastWorld(w) { const d = this.load(); d.lastWorld = w; this.save(); },
    lastWorld() { return this.load().lastWorld || 0; },
    reset() { this.data = { levels: {}, lastWorld: 0 }; this.save(); },
  };

  // ------------------------------------------------------------------
  // the collection: which kinds have been baked, and how often
  // ------------------------------------------------------------------
  const Collection = {
    found: null, bakes: null,
    load() {
      if (this.found) return;
      let book = FC.store.get('book', null);
      // v0.6 stored tier numbers: they were the Blossom Falls menu
      if (Array.isArray(book) && book.some((x) => typeof x === 'number')) book = book.map((x) => (typeof x === 'number' ? (x >= 1 ? 'w0t' + x : 'magic') : x));
      this.found = Array.isArray(book) ? book.filter((id) => !!FC.Cakes.KINDS[id]) : [];
      if (this.found.indexOf('w0t1') < 0) this.found.push('w0t1');
      this.bakes = FC.store.get('bakes', {}) || {};
    },
    save() { FC.store.set('book', this.found); FC.store.set('bakes', this.bakes); },
    has(kind) { this.load(); return this.found.indexOf(kind) >= 0; },
    // returns true when this is a first-time find
    add(kind) {
      this.load();
      this.bakes[kind] = (this.bakes[kind] || 0) + 1;
      const fresh = this.found.indexOf(kind) < 0;
      if (fresh) this.found.push(kind);
      this.save();
      return fresh;
    },
    count(kind) { this.load(); return this.bakes[kind] || 0; },
    worldFound(w) { this.load(); return FC.Cakes.WORLD_MENUS[w].slice(1).filter((id) => this.found.indexOf(id) >= 0).length; },
    total() { this.load(); return FC.Cakes.COLLECTIBLE.filter((id) => this.found.indexOf(id) >= 0).length; },
    totalMax() { return FC.Cakes.COLLECTIBLE.length; },
    reset() { this.found = ['w0t1']; this.bakes = {}; this.save(); },
  };

  FC.Levels = { WORLDS, LEVELS_PER_WORLD, UNLOCK_AT, STARTS, PAR, MODS, WORLD_MOODS, BASE_GIFTS, level, key, waterFor, starsForFlicks, Progress, Collection };
})();
