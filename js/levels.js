/* Fairycake Falls – worlds, levels, progress and the collection.

   Adventure mode: five worlds, eight levels each. Every level is a recipe – "bake the
   <cake>" – for the next tier of the world's menu (tier 4 in level 1 … the royal cake in
   level 8). The pond starts with a cluster that already holds some bigger cakes, placed
   so that the goal is a few dozen merges away but never a free cascade (there is always a
   gap in the ladder). Stars come from the score at the moment the goal cake is baked.
   The next level opens with one star; the next world opens after level 5 of the previous one.

   The collection (the Cake Book) remembers every kind ever baked, across both modes. */
(function () {
  'use strict';
  const FC = window.FC;

  const WORLDS = [
    { name: 'Blossom Falls', tag: 'The Little Fairy Bakery', theme: 0,
      blurb: 'Where every fairy learns to bake. Soft meadows, a pink castle and the first eleven recipes.' },
    { name: 'Candy Woods', tag: 'The Enchanted Forest', theme: 1,
      blurb: 'Honey, acorns, toadstools and gingerbread – the forest bakes with whatever it finds.' },
    { name: 'Moonlight Bay', tag: "The Witch's Bakery", theme: 2,
      blurb: 'Night falls over the bay. Potions bubble, stars drop into the frosting and the moon is an ingredient.' },
    { name: 'Rainbow Heights', tag: 'The Royal Dessert Kingdom', theme: 3,
      blurb: 'Above the clouds the royal pâtissiers work with gold leaf, crystals and spun sugar.' },
    { name: 'Starfall Realm', tag: 'The Legendary Fairy Realms', theme: 4,
      blurb: 'Dragons, unicorns and the aurora itself – the oldest, strangest recipes in the kingdom.' },
  ];
  const LEVELS_PER_WORLD = 8;
  const UNLOCK_AT = 5; // clearing this level (1-based) of a world opens the next world

  // start clusters: the big cakes first (they sit in the middle), then the small fry the water packs round them.
  // There is always a gap in the ladder, so a single bake cannot cascade straight to the goal.
  const STARTS = [
    [2, 1, 2, 1, 2, 1, 5, 6],                           // level 1 · goal 4
    [2, 1, 2, 1, 2, 1, 3, 6],                           // level 2 · goal 5
    [4, 3, 2, 1, 2, 1, 2, 1, 7],                        // level 3 · goal 6
    [6, 3, 2, 1, 2, 1, 2, 1, 2],                        // level 4 · goal 7
    [7, 4, 3, 2, 1, 2, 1, 2, 1, 2, 1],                  // level 5 · goal 8
    [8, 7, 4, 3, 2, 1, 2, 1, 2, 1, 2],                  // level 6 · goal 9
    [9, 8, 6, 5, 3, 2, 1, 2, 1, 2, 1, 2],               // level 7 · goal 10
    [10, 9, 8, 6, 3, 2, 1, 2, 1, 2, 1, 2],              // level 8 · goal 11
  ];
  // score needed for the second and third star (calibrated with tools/bot.js, see DESIGN.md)
  const STARS = [[20, 35], [90, 170], [220, 420], [270, 500], [450, 850], [850, 1600], [950, 1800], [1300, 2300]];

  // a little flavour per level: the water's mood, a gift to start with, what the queue brings
  const MODS = {
    '0.2': { water: { rim: 0.85 }, name: 'Lazy spring', text: 'The current is gentle today.' },
    '0.5': { gifts: { wands: 1 }, name: 'A spare Wand', text: 'Tilly packed a Wand for you.' },
    '1.1': { water: { rim: 0.75 }, name: 'Honey current', text: 'The water is slow and sticky.' },
    '1.3': { gifts: { wands: 1 }, name: 'The witch lends a Wand', text: 'Give it back when you are done.' },
    '1.5': { water: { rim: 1.2, turn: 1.15 }, name: 'Autumn breeze', text: 'A brisk current round the rim.' },
    '1.7': { gifts: { wands: 2 }, name: 'Acorn gift', text: 'Two Wands to start with.' },
    '2.1': { water: { rim: 1.15 }, name: 'Rising tide', text: 'The current runs a little faster.' },
    '2.3': { water: { rim: 1.35, turn: 1.1 }, name: 'Spring tide', text: 'A strong current – ride it!' },
    '2.4': { gifts: { wands: 1 }, name: 'Moonlit gift', text: 'A Wand to start with.' },
    '2.6': { water: { turn: 1.4 }, name: 'Whirling moon', text: 'The calm pool turns quickly tonight.' },
    '3.0': { gifts: { wands: 1 }, name: 'Royal welcome', text: 'A Wand from the castle kitchens.' },
    '3.2': { water: { turn: 1.3 }, name: 'High winds', text: 'The pool turns faster up here.' },
    '3.4': { queue: [26, 28, 26, 14, 6], name: 'Rich pantry', text: 'The queue brings bigger cakes.' },
    '3.6': { gifts: { wands: 2 }, name: 'Crown jewels', text: 'Two Wands to start with.' },
    '4.0': { water: { rim: 1.2, turn: 1.2 }, name: 'Starfall rapids', text: 'Everything moves faster in the realm.' },
    '4.2': { gifts: { wands: 2 }, name: "Dragon's hoard", text: 'Two Wands to start with.' },
    '4.3': { water: { rim: 1.4 }, name: 'Phoenix wind', text: 'A fierce current round the rim.' },
    '4.5': { queue: [26, 28, 26, 14, 6], name: 'Legendary pantry', text: 'The queue brings bigger cakes.' },
    '4.7': { gifts: { wands: 3 }, name: "The Empress's blessing", text: 'Three Wands to start with.' },
  };

  // the two royal levels of every world start with a Wand or two: the pond is full from the first flick
  const BASE_GIFTS = [null, null, null, null, null, null, { wands: 1 }, { wands: 2 }];

  function level(w, l) {
    const world = WORLDS[w];
    const goal = 4 + l;
    const mod = MODS[w + '.' + l] || null;
    return {
      w, l, world, goal, kind: 'w' + w + 't' + goal, start: STARTS[l].slice(), stars: STARS[l],
      water: (mod && mod.water) || { rim: 1, turn: 1 }, gifts: (mod && mod.gifts) || BASE_GIFTS[l], queue: (mod && mod.queue) || null, mod,
    };
  }
  const key = (w, l) => w + '.' + l;

  // ------------------------------------------------------------------
  // progress: stars and best scores per level
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
    worldUnlocked(w) { return w === 0 || this.stars(w - 1, UNLOCK_AT - 1) > 0; },
    unlocked(w, l) { return l === 0 ? this.worldUnlocked(w) : this.stars(w, l - 1) > 0 && this.worldUnlocked(w); },
    worldStars(w) { let n = 0; for (let l = 0; l < LEVELS_PER_WORLD; l++) n += this.stars(w, l); return n; },
    worldCleared(w) { for (let l = 0; l < LEVELS_PER_WORLD; l++) if (this.stars(w, l) < 1) return false; return true; },
    totalStars() { let n = 0; for (let w = 0; w < WORLDS.length; w++) n += this.worldStars(w); return n; },
    starsFor(w, l, score) { const s = STARS[l]; return score >= s[1] ? 3 : score >= s[0] ? 2 : 1; },
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
    // a level was cleared with this score
    record(w, l, score) {
      const d = this.load();
      const k = key(w, l);
      const prev = d.levels[k] || { stars: 0, best: 0 };
      const worldWas = w + 1 < WORLDS.length && this.worldUnlocked(w + 1);
      const stars = this.starsFor(w, l, score);
      const e = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, score) };
      d.levels[k] = e;
      d.lastWorld = w;
      this.save();
      const worldNow = w + 1 < WORLDS.length && this.worldUnlocked(w + 1);
      return { stars, prevStars: prev.stars, newBest: score > prev.best, worldUnlocked: worldNow && !worldWas ? w + 1 : -1, first: prev.stars === 0 };
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

  FC.Levels = { WORLDS, LEVELS_PER_WORLD, UNLOCK_AT, STARTS, STARS, MODS, level, key, Progress, Collection };
})();
