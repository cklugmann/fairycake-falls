/* Fairycake Falls – game logic, input and rendering.

   Controls (mouse and touch work the same, no mode guessing):
   - Grab the cake in the sling (or anything outside the water), pull back, let go:
     the cake flies the opposite way, pull length = travel distance.
   - Tap or swipe the water: ripples, and the hand reminds you how to flick.
   The water does the rest: a current races round the rim and carries slow cakes
   round the pond, the calm middle draws them in and turns the pile lazily.
   Stages: every stage is an order of N merges. When it is filled the whirlpool
   spins up and reshuffles the pile, the multiplier rises and a gift arrives.
   Modes: 'endless' is the classic high-score pond (the island drifts through the worlds
   you have unlocked); 'level' is one recipe of the adventure – bake the goal cake of a
   world's menu, with a start cluster, a mood of the water and stars for the score. */
(function () {
  'use strict';
  const FC = window.FC;
  const TAU = FC.TAU;
  const CFG = FC.Physics.CFG;
  const Body = FC.Physics.Body;
  const CK = FC.Cakes;
  const TIERS = CK.TIERS;
  const MAX_T = CK.MAX_TIER;
  const spec = CK.spec;
  const kr = (kind) => TIERS[CK.tierOf(kind)].r; // radius of a kind
  const S = FC.Scene;
  const FX = FC.FX;
  const AU = FC.Audio;
  const LV = FC.Levels;

  const CONE = (80 * Math.PI) / 180; // widest flick, measured from straight ahead
  const DEAD = 9;                    // px a pull needs before it counts
  const FLY_TIME = 0.2;              // the next cake hops from the Next bubble into the sling
  const COACH_DONE = 3;              // stored tutorial progress when finished
  const HAND_CYCLE = 2.6;
  const FOAM_N = 56;                 // petals / foam flecks that ride the current and make it visible
  const STREAK_N = 7;                // long foam streaks that race round the rim band
  // the stage whirl: tear (the water spins up and pushes everything out), spin (the cluster orbits the rim, mixed by
  // shear and turbulence, twins find each other), drain (the current drags everything back to the middle, big cakes
  // first), settle. Times in seconds, speeds in rad/s.
  const WHIRL = { up: 0.45, hold: 1.55, down: 2.4, settle: 3.5, maxSettle: 4.7, omega: 3.4, shear: 0.8, outflow: -1.3, drain: 3.2, twin: 2.4, kick: 320 };
  const START_N = 11;                // cakes floating in the pond when a run starts (the tutorial uses 9)

  const stageGoal = (n) => (n <= 1 ? 5 : Math.min(18, 4 + 2 * n)); // merges an order asks for: 5, 8, 10, 12, ... up to 18
  // the castle's delivery: with every finished order a few fresh cakes tumble down the spring and join the whirl.
  // How many depends on how empty the pond is: the delivery tops the pool up to this fill (sum of cake areas over the
  // pool area), which rises with the stage – the pond stays populated, and the pressure grows even for a player
  // who merges with every flick
  const targetFill = (stage) => Math.min(0.5, 0.36 + 0.025 * (stage - 2)); // (a pool holds ~53 % before the cluster touches the ring)
  const DELIVERY_MAX = 9;
  const WAND_SPARES = 7;             // in a level the Wand spares the two rungs below the goal, from this tier up
  const ringFor = (maxTier) => Math.min(CFG.DANGER, CFG.RING_MIN + CFG.RING_STEP * Math.max(0, maxTier - 3)); // the calm pool widens with every new cake
  const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  const WTMP = { x: 0, y: 0 };
  const RARE_P = 0.014;              // chance per spawned cake that it is a rare find (of that tier); more in the world it likes
  const isRare = (kind) => spec(kind).world === 'rare';
  const TIDE_PERIOD = 18;            // s – one breath of the moon tide (Moonlight Bay, Starfall Realm): ~9 s of low water

  const Game = {
    canvas: null, ctx: null, W: 0, H: 0, dpr: 1,
    state: 'loading', // loading | title | playing | paused | over | won
    mode: 'endless',  // endless | level
    level: null,      // { w, l, def } while a level is played
    won: false, wonT: 0, goalBody: null, levelResult: null,
    endlessWorlds: [0],
    t: 0, last: 0,
    world: null,
    score: 0, best: 0, combo: 0, bestCombo: 0, lastMergeT: -9, maxTier: 1, merges: 0, shots: 0,
    stage: 1, stageGoal: 5, stageMerges: 0, stageDone: false, whirl: null, ring: 880,
    queue: [], cool: 0, shotSeq: 0,
    aim: { active: false, pid: null, sx: 0, sy: 0, cx: 0, cy: 0, L: null, dir: null, power: 0, valid: false, speed: 0, pred: null, lastTick: 0, offX: 0, offY: 0, gripX: 0, gripY: 0, detent: 0 },
    water: { active: false, pid: null, lx: 0, ly: 0, rippleT: 0 },
    foam: [],
    launcher: { pop: 1 },
    sling: { w: 0, snap: 0 },
    fly: null,
    tilly: { x: 0, y: 0, mood: 'idle', moodT: 0, flick: 0 },
    jokers: 0, wands: 0, wandMode: false,
    bubble: null, nextBubbleAt: 16,
    danger: 0, dangerBody: null, dangerLimit: 5, warnT: 0, dangerHinted: false,
    dangerUI: { x: 0, y: 0, a: 0, k: 0, n: -1, bump: 0, body: null }, // the stopwatch over a cake in danger (screen space, eased)
    tide: 0, tideT: 0, tideAmp: 0, ringBase: 880, trickTip: 0,
    shake: 0, flash: 0, flashCol: '#ffffff',
    overT: 0, overPops: 0,
    discovered: null,
    coach: null, idle: 0, handT: -1, hint: null, ringPulse: 0, rideTip: false, foamPulse: 0,
    hitstop: 0, streak: 0, pending: [], grab: 0,
    demo: { phase: 'wait', t: 0, wait: 0.8 },
    whirlPhase: 0,

    // ------------------------------------------------------------
    init(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.best = FC.store.get('best', 0);
      LV.Collection.load();
      this.world = new FC.Physics.World();
      this.world.onMerge = (a, b) => this.onMerge(a, b);
      this.world.onJoker = (j, c) => this.onJoker(j, c);
      this.world.onSensor = (s, b) => this.onBubble(s, b);
      this.world.onImpact = (a, b, st, nx, ny, x, y) => this.onImpact(a, b, st, nx, ny, x, y);
      this.world.onRim = (b, st, nx, ny) => this.onRim(b, st, nx, ny);
      this.bindInput();
      this.resize();
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 120));
      document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') FC.UI.pause(); });
    },

    resize() {
      const W = window.innerWidth, H = window.innerHeight;
      let dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (W * H * dpr * dpr > 4.2e6) dpr = Math.sqrt(4.2e6 / (W * H));
      this.W = W; this.H = H; this.dpr = dpr;
      this.canvas.width = Math.round(W * dpr);
      this.canvas.height = Math.round(H * dpr);
      this.canvas.style.width = W + 'px';
      this.canvas.style.height = H + 'px';
      const cs = getComputedStyle(document.documentElement);
      const st = parseFloat(cs.getPropertyValue('--sat')) || 0, sb = parseFloat(cs.getPropertyValue('--sab')) || 0;
      S.layout(W, H, dpr, st, sb);
      document.documentElement.style.setProperty('--k', FC.clamp(Math.min(W, H * 0.8) / 430, 1, 1.7).toFixed(3));
      FC.Cakes.clearCache();
      this.sling.w = 0;
      this.placeTilly(true);
      if (FC.UI) FC.UI.layout();
    },

    // ------------------------------------------------------------
    // run lifecycle
    // ------------------------------------------------------------
    toTitle() {
      this.state = 'title';
      this.mode = 'endless';
      this.level = null;
      this.won = false;
      this.danger = 0; this.dangerBody = null;
      this.dangerUI.a = 0; this.dangerUI.body = null; this.dangerUI.n = -1; // no stopwatch fading out over the title
      FX.clear();
      this.bubble = null;
      this.wandMode = false;
      this.whirl = null;
      this.world.inflowK = 1; this.world.free = false; this.world.shear = 0; this.world.twinK = 1; this.world.twinAlways = false;
      this.cancelAim();
      this.coach = null;
      this.handT = -1;
      this.hint = null;
      this.fly = null;
      S.setTheme(0, true);
      CK.setMenu(0);
      this.queue = [CK.kindFor(1), CK.kindFor(2)];
      this.ring = CFG.DANGER;
      this.maxTier = 3;
      this.setupStart(false);
      this.setWater(true);
      this.buildFoam();
      this.demo = { phase: 'wait', t: 0, wait: 0.9 };
      this.setCursor();
    },

    // which world the pond is in right now (the menu, the backdrop)
    worldIndex() {
      return this.level ? this.level.w : S.theme;
    },

    // the classic endless pond: the island drifts through the worlds you have unlocked, every third stage
    newGame() {
      this.mode = 'endless';
      this.level = null;
      this.endlessWorlds = [];
      for (let w = 0; w < LV.WORLDS.length; w++) if (LV.Progress.worldUnlocked(w)) this.endlessWorlds.push(w);
      if (!this.endlessWorlds.length) this.endlessWorlds = [0];
      this.beginRun({ theme: 0, tutorialOk: true });
    },

    // one recipe of the adventure
    startLevel(w, l) {
      const def = LV.level(w, l);
      this.mode = 'level';
      this.level = { w, l, def };
      LV.Progress.setLastWorld(w);
      this.beginRun({ theme: def.world.theme, tutorialOk: w === 0 && l === 0, start: def.start, water: def.water, gifts: def.gifts, goal: def.goal });
    },

    beginRun(o) {
      FX.clear();
      this.won = false; this.wonT = 0; this.goalBody = null; this.levelResult = null;
      this.score = 0; this.combo = 0; this.bestCombo = 0; this.lastMergeT = -9;
      this.stage = 1; this.stageGoal = stageGoal(1); this.stageMerges = 0; this.stageDone = false; this.whirl = null;
      this.world.inflowK = 1; this.world.free = false; this.world.shear = 0; this.world.twinK = 1; this.world.twinAlways = false;
      this.merges = 0; this.shots = 0; this.shotSeq = 0; this.runNew = []; this.runRares = []; this.maxKind = null; this.maxKindTier = 0;
      this.jokers = (o.gifts && o.gifts.jokers) || 0; this.wands = (o.gifts && o.gifts.wands) || 0; this.wandMode = false;
      this.bubble = null; this.nextBubbleAt = 14 + FC.randInt(0, 6);
      this.danger = 0; this.dangerBody = null; this.warnT = 0; this.dangerHinted = false;
      this.dangerUI.a = 0; this.dangerUI.body = null; this.dangerUI.n = -1;
      this.tide = 0; this.tideT = 0;
      this.cool = 0; this.launcher.pop = 0; this.fly = null;
      this.overT = 0;
      this.cancelAim();
      this.idle = 0; this.handT = -1; this.hint = null; this.ringPulse = 0; this.rideTip = false; this.rareTipFor = null;
      this.hitstop = 0; this.streak = 0; this.pending = [];
      this.waterMod = o.water || { rim: 1, turn: 1, tide: 0 };
      this.state = 'playing';
      const theme = o.theme || 0;
      if (S.theme !== theme) { if (S.ready(theme)) S.setTheme(theme, false); else S.load(theme).then(() => { if (this.state === 'playing' && this.worldIndex() === theme) S.setTheme(theme, false); }); }
      CK.setMenu(theme);
      const coachState = FC.store.get('coach', 0);
      const tutorial = o.tutorialOk && coachState === 0;       // the guided first game
      const tourRest = o.tutorialOk && coachState === 1;       // the first level ended before the tour did: the rest of it comes now
      const tiers = tutorial ? [3, 2, 1, 2, 3, 1, 4, 2, 1, 5] : (o.start || [3, 2, 1, 2, 3, 1, 4, 2, 3, 4, 1].slice(0, START_N));
      this.maxTier = Math.max(3, ...tiers);
      // in a level the calm pool is as wide as the goal cake will need from the start – the big cakes are there already
      this.ringTier = o.goal ? Math.max(this.maxTier, o.goal) : this.maxTier;
      this.ring = ringFor(this.ringTier);
      const first = this.setupStart(tutorial, tiers); // the first cake always has a match on the front face of the start cluster
      this.queue = tutorial ? [CK.kindFor(1), CK.kindFor(2), CK.kindFor(1)] : [CK.kindFor(first), this.randKind()];
      FC.UI.onNewGame();
      this.coach = tutorial ? { step: 'aim', t: 0, shown: '' } : tourRest ? { step: 'merged', t: 1.4, shown: '' } : null;
      // level 1 of a world is a warm-up with a trick to it: the start cluster can bake the goal from one good flick
      this.trickTip = !!(this.level && this.level.l === 0 && !this.coach) ? 2.6 : 0; // after the opening banner
      if (tutorial) this.coachSay('aim', 'Pull the cake back & let go!', 'Like a slingshot');
      this.setWater(true);
      this.buildFoam();
      this.setCursor();
      // the start cluster counts for the book too (the big cakes of a level are "baked" by the castle, not by you –
      // they are shown, but only your own bakes fill the book)
      if (this.level) { FC.UI.setGoal(); FC.UI.setFlicks(0, this.level.def.par); }
      // the opening banner names the day's water: the level's own twist, or the world's mood (from level 1 of a world
      // on, and whenever the mood is not plain spring water)
      if (this.level) {
        const def = this.level.def;
        const mood = def.mood && def.w > 0 ? def.mood : null;
        if (def.mod && def.mod.name) FC.UI.banner(def.mod.name, def.mod.text);
        else if (mood) FC.UI.banner(mood.name, mood.text);
      }
    },

    // A populated pond: a run starts with a cluster of cakes that the water has packed together, so the first
    // flick already has targets, chains and a little tension (the cluster fills ~40 % of the calm pool). No two
    // twins touch (they would merge by themselves), and the cake the sling gets first always has a match on the
    // front face. Returns the tier for the first cake in the sling.
    setupStart(tutorial, list) {
      const W = this.world;
      // the tutorial cluster is calmer: no Cherry Bite next to the Macaron in front, so the coached first flick
      // makes one merge (not a four-chain) – chains come with the next flicks
      const tiers = (list || (tutorial ? [3, 2, 1, 2, 3, 1, 4, 2, 1, 5] : [3, 2, 1, 2, 3, 1, 4, 2, 3, 4, 1])).slice();
      const settle = (steps) => {
        const onI = W.onImpact, onR = W.onRim, om = W.omegaCore;
        W.onImpact = W.onRim = null;
        W.canMerge = () => false;
        W.omegaCore = 0;
        for (let i = 0; i < (steps || 100); i++) W.step(1 / 60);
        delete W.canMerge;
        W.onImpact = onI; W.onRim = onR; W.omegaCore = om;
        for (const b of W.bodies) { b.vx = 0; b.vy = 0; }
      };
      // identical cakes must not start next to each other (they would merge by themselves)
      const tooClose = (a, b) => a.tier === b.tier && Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r < CFG.TWIN_RANGE * Math.min(a.r, b.r) + 70;
      const apart = () => {
        const B = W.bodies;
        for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) if (tooClose(B[i], B[j])) return false;
        return true;
      };
      // the water packed two twins together while settling: swap one of them with a small cake of another tier
      // that fits there (the small ones are all about the same size, so the cluster keeps its shape)
      const retier = (b, t) => { b.tier = t; b.r = b.rT = TIERS[t].r; b.setMass(b.r); b.kind = CK.kindFor(t); };
      const repair = () => {
        const B = W.bodies;
        for (let n = 0; n < 24; n++) {
          let bad = null;
          for (let i = 0; i < B.length && !bad; i++) for (let j = i + 1; j < B.length; j++) if (tooClose(B[i], B[j])) { bad = B[i]; break; }
          if (!bad) return true;
          let done = false;
          for (const o of B) {
            if (o === bad || o.tier === bad.tier || o.tier > 4 || bad.tier > 4) continue;
            const ta = bad.tier, tb = o.tier;
            retier(bad, tb); retier(o, ta);
            if (B.every((p) => p === bad || !tooClose(bad, p)) && B.every((p) => p === o || !tooClose(o, p))) { done = true; break; }
            retier(bad, ta); retier(o, tb);
          }
          if (!done) return false;
        }
        return apart();
      };
      const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };
      // the ring layout (small clusters): a seed in the middle, a ring of six round it, the rest in a second ring,
      // turned so that one outer spot sits right in front of the sling (the tutorial puts a Macaron there). The tiers
      // are assigned to the spots by a small backtracking search: no twins on neighbouring spots
      const ringLayout = () => {
        const rot = tutorial ? Math.PI / 2 - Math.PI / 8 : Math.random() * TAU;
        const pos = [[0, 0]];
        for (let k = 0; k < 6 && pos.length < tiers.length; k++) { const a = rot + (k / 6) * TAU; pos.push([Math.cos(a) * 215, Math.sin(a) * 215]); }
        for (let k = 0; pos.length < tiers.length; k++) { const a = rot + ((k + 0.5) / 8) * TAU; pos.push([Math.cos(a) * 410, Math.sin(a) * 410]); }
        const near = pos.map((p) => pos.map((q, j) => (Math.hypot(p[0] - q[0], p[1] - q[1]) < 330 ? j : -1)).filter((j) => j >= 0 && j !== pos.indexOf(p)));
        const counts = {};
        for (const x of tiers) counts[x] = (counts[x] || 0) + 1;
        const kinds = shuffle(Object.keys(counts).map(Number));
        const t = new Array(pos.length).fill(0);
        const order = pos.map((_, i) => i).sort((a, b) => near[b].length - near[a].length);
        if (tutorial && pos.length > 7) { t[7] = 1; counts[1]--; order.splice(order.indexOf(7), 1); }
        const rec = (k) => {
          if (k === order.length) return true;
          const i = order[k];
          for (const tier of shuffle(kinds.slice())) {
            if (counts[tier] <= 0) continue;
            if (near[i].some((j) => t[j] === tier)) continue;
            if (tutorial && tier === 2 && near[7] && near[7].indexOf(i) >= 0) continue; // no Cherry Bite next to the coached Macaron
            t[i] = tier; counts[tier]--;
            if (rec(k + 1)) return true;
            t[i] = 0; counts[tier]++;
          }
          return false;
        };
        if (!rec(0)) return null;
        return pos.map(([x, y], i) => ({ t: t[i], x, y }));
      };
      // the level layout: the big cakes go in the middle, the small ones are packed round them (closest free
      // spot first, never next to a twin), in a random orientation
      const packLayout = () => {
        const rot = Math.random() * TAU;
        const big = tiers.filter((t) => t >= 5).sort((a, b) => b - a);
        const small = shuffle(tiers.filter((t) => t < 5));
        const placed = [];
        for (const t of big.concat(small)) {
          const r = TIERS[t].r;
          let spot = null;
          for (let d = 0; d < 1500 && !spot; d += 10) {
            for (let k = 0; k < 36; k++) {
              const a = rot + (k / 36) * TAU + d * 0.013;
              const x = Math.cos(a) * d, y = Math.sin(a) * d;
              let ok = true;
              for (const p of placed) {
                const dd = Math.hypot(p.x - x, p.y - y);
                if (dd < p.r + r + 6 || (p.t === t && dd < p.r + r + CFG.TWIN_RANGE * Math.min(p.r, r) + 90)) { ok = false; break; }
              }
              if (ok) { spot = { x, y }; break; }
            }
          }
          placed.push({ t, r, x: spot ? spot.x : 0, y: spot ? spot.y : 0 });
        }
        return placed;
      };
      const build = () => {
        W.clear();
        const items = (tutorial || !tiers.some((t) => t >= 5) ? ringLayout() : null) || packLayout(); // small clusters use the ring layout
        items.forEach((it, i) => {
          const b = new Body(it.t, TIERS[it.t].r, it.x, it.y);
          b.age = 3;
          b.pop = -0.1 - i * 0.06; // staggered pop-in
          W.add(b);
        });
        settle(300);
      };
      // which cakes can a medium flick from the sling reach?
      const probe = (deg) => {
        const L = this.anchorW(1), sp = FC.Physics.speedForPower(0.5), a = (deg * Math.PI) / 180;
        const pr = W.predict(L.x, L.y, Math.sin(a) * sp, -Math.cos(a) * sp, TIERS[1].r, 1, { maxT: 2.2, driftT: 0, maxLen: 1700, spacing: 90 });
        return pr.hit && !pr.hit.body.sensor ? pr.hit.body : null;
      };
      let fails = 0;
      const stats = (this.startStats = { tries: 0, twins: 0, front: 0, hit: 0 });
      for (let tries = 0; tries < 80; tries++) {
        stats.tries++;
        build();
        if (!apart() && !repair()) { stats.twins++; continue; }
        if (tutorial) {
          // the straight flick the coach asks for must hit a Macaron
          const hit = probe(0);
          if (hit && hit.tier === 1) return 1;
          if (hit && ++fails > 20) {
            // rare: something keeps getting in front – make that cake the Macaron (if its twins stay apart)
            const old = hit.tier;
            hit.tier = 1; hit.r = hit.rT = TIERS[1].r; hit.setMass(hit.r);
            if (apart()) return 1;
            hit.tier = old; hit.r = hit.rT = TIERS[old].r; hit.setMass(hit.r);
          }
          continue;
        }
        const front = [];
        for (let deg = -50; deg <= 50; deg += 10) { const h = probe(deg); if (h && front.indexOf(h) < 0) front.push(h); }
        if (front.length < 2) { stats.front++; continue; }
        // the first cake in the sling is small (a big start cake in front must not become the first flick)
        const small = front.filter((b) => b.tier <= 3);
        if (!small.length) { stats.front++; continue; }
        return FC.pick(small).tier;
      }
      // the fallback (practically never): the old fixed cross, one cake in the middle, twins opposite each other
      W.clear();
      [[3, 0, 0], [1, 0, 190], [2, -205, -60], [1, 0, -190], [2, 205, -60]].forEach(([t, x, y], i) => {
        const b = new Body(t, TIERS[t].r, x, y);
        b.age = 3; b.pop = -0.1 - i * 0.09;
        W.add(b);
      });
      settle(100);
      return 1;
    },

    // new cakes: Macaron, Cherry Bite, Cupcake and (rarely) Lemon Tart – the tier-5 cake joins once a tier-7 cake
    // exists (a level's pantry can say otherwise). Now and then a rare find takes the place of the usual cake
    randTier() {
      const lv = this.level && this.level.def;
      const w = (lv && lv.queue) || [32, 30, 24, 14, 8];
      // in a level the start cakes do not count: tier 5 joins once *you* have baked a tier-7 cake
      const top = this.level ? Math.max(3, this.maxKindTier || 0) : this.maxTier;
      const maxT = lv && lv.queue ? w.length : FC.clamp(top - 3, 4, 5);
      let sum = 0;
      for (let i = 0; i < maxT; i++) sum += w[i];
      let x = Math.random() * sum;
      for (let i = 0; i < maxT; i++) { x -= w[i]; if (x <= 0) return i + 1; }
      return 1;
    },
    randKind() {
      const tier = this.randTier();
      if (this.state === 'playing' && this.shots >= 3 && !this.coach) {
        const here = this.worldIndex();
        for (const id of CK.RARES) {
          const s = spec(id);
          if (s.tier !== tier) continue;
          const p = RARE_P * (s.chance || 1) * (s.boost === here ? 2.5 : 1);
          if (Math.random() < p) return id;
        }
      }
      return CK.kindFor(tier);
    },

    // ------------------------------------------------------------
    // input
    // ------------------------------------------------------------
    bindInput() {
      const c = this.canvas;
      c.addEventListener('pointerdown', (e) => this.onDown(e));
      c.addEventListener('pointermove', (e) => this.onMove(e));
      c.addEventListener('pointerup', (e) => this.onUp(e));
      c.addEventListener('pointercancel', (e) => this.onCancel(e));
      c.addEventListener('contextmenu', (e) => e.preventDefault());
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (this.aim.active) this.cancelAim();
          else if (this.wandMode) this.toggleWand();
          else if (this.state === 'playing') FC.UI.pause();
          else if (this.state === 'paused') FC.UI.resume();
        } else if ((e.key === ' ' || e.key === 's') && this.state === 'playing') {
          e.preventDefault();
          this.swap();
        }
      });
    },

    onDown(e) {
      AU.init();
      if (this.state !== 'playing') return;
      if (e.button === 2) { this.cancelAim(); return; }
      if (this.wandMode) { this.wandTap(e.clientX, e.clientY); return; }
      if (this.aim.active || this.water.active || this.whirl || this.stageDone || this.won) return;
      if (this.queue[0] == null) return;
      this.idle = 0;
      this.handT = -1;
      try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (this.isSlingPress(e.clientX, e.clientY)) this.beginAim(e);
      else this.touchWater(e);
      this.setCursor();
    },

    // where you press decides what you hold: the cake (and everything outside the water)
    // is the sling; a finger on the open water only makes ripples
    isSlingPress(x, y) {
      if (!this.inPond(x, y)) return true;
      const g = this.slingGround();
      const rr = kr(this.queue[0]) * S.s;
      const reach = Math.max(rr * 2.4, 46);
      return Math.hypot(x - g.x, y - (g.y - rr * 0.45)) < reach;
    },

    beginAim(e) {
      this.fly = null; // snap the next cake into the sling
      const a = this.aim;
      a.active = true;
      a.pid = e.pointerId;
      a.sx = a.cx = e.clientX;
      a.sy = a.cy = e.clientY;
      a.valid = false;
      a.power = 0;
      a.lastTick = 0;
      a.pred = null;
      a.detent = 0;
      this.grab = 1;
      AU.grab();
      this.computeAim();
    },

    // a finger on the water: ripples that follow it (and a tap shows the hand)
    touchWater(e) {
      const w = this.water;
      w.active = true;
      w.pid = e.pointerId;
      w.lx = e.clientX; w.ly = e.clientY;
      w.moved = 0; w.t = 0; w.rippleT = 0;
      const p = S.s2w(e.clientX, e.clientY);
      FX.ripple(p.x, p.y, 40, 0.5, 300);
      AU.plip(2);
    },

    onMove(e) {
      const a = this.aim, w = this.water;
      if (a.active && e.pointerId === a.pid) {
        a.cx = e.clientX;
        a.cy = e.clientY;
      } else if (w.active && e.pointerId === w.pid) {
        w.moved += Math.hypot(e.clientX - w.lx, e.clientY - w.ly);
        w.lx = e.clientX; w.ly = e.clientY;
        if (w.moved > 10 && this.inPond(e.clientX, e.clientY) && this.t - w.rippleT > 0.07) {
          w.rippleT = this.t;
          const p = S.s2w(e.clientX, e.clientY);
          FX.ripple(p.x, p.y, 26, 0.3, 260);
        }
      }
    },

    onUp(e) {
      const a = this.aim, w = this.water;
      if (a.active && e.pointerId === a.pid) {
        a.cx = e.clientX;
        a.cy = e.clientY;
        this.computeAim();
        const ok = a.valid && a.power > 0.03;
        if (ok && this.cool <= 0 && this.state === 'playing') this.launch();
        else if (!a.valid) this.idle = 20; // tapped the cake: show the hand right away
        AU.stretch(0);
        a.active = false;
        a.pred = null;
        this.setCursor();
      } else if (w.active && e.pointerId === w.pid) {
        if (w.moved < 12) this.idle = 20; // a tap on the water: the hand shows what to do
        w.active = false;
        this.setCursor();
      }
    },

    onCancel(e) {
      if (this.aim.active && (!e || e.pointerId === this.aim.pid)) this.cancelAim();
      if (this.water.active && (!e || e.pointerId === this.water.pid)) this.water.active = false;
    },

    cancelAim() {
      this.aim.active = false;
      this.aim.pred = null;
      AU.stretch(0);
      this.setCursor();
    },

    setCursor() {
      if (!this.canvas) return;
      let c = 'default';
      if (this.state === 'playing') c = this.wandMode ? 'pointer' : this.aim.active ? 'grabbing' : 'grab';
      if (this.canvas.style.cursor !== c) this.canvas.style.cursor = c;
    },

    // ------------------------------------------------------------
    // aiming
    // ------------------------------------------------------------
    // where a cake sits in the sling (world units); k = a tier or a kind
    anchorW(k) {
      const r = typeof k === 'number' ? TIERS[k].r : kr(k);
      return { x: 0, y: CFG.R - r - 4 };
    },
    slingGround() {
      const a = this.anchorW(this.queue[0] == null ? 1 : this.queue[0]);
      return S.w2s(a.x, a.y);
    },
    slingBase() {
      return S.w2s(0, CFG.R - 40);
    },
    inPond(x, y) {
      const dx = (x - S.cx) / S.pr, dy = (y - S.cy) / (S.pr * S.K);
      return dx * dx + dy * dy < 1;
    },
    // full power must be reachable when pulling straight back from the cake, even on short screens
    maxPull() {
      const room = S.H - this.slingBase().y - 28;
      return FC.clamp(Math.min(S.pr * 0.95, room), 110, 260);
    },

    computeAim() {
      const a = this.aim;
      const kind = this.queue[0];
      a.valid = false;
      a.offX = a.offY = 0;
      if (kind == null) return;
      const tier = CK.tierOf(kind);
      const r = TIERS[tier].r;
      const L = this.anchorW(tier);
      const dx = a.cx - a.sx, dy = a.cy - a.sy;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < DEAD) { a.pred = null; a.power = 0; AU.stretch(0); return; }
      let wx = -dx, wy = -dy / S.K;
      const maxPull = this.maxPull();
      const p = FC.clamp((len - DEAD) / (maxPull - DEAD), 0, 1);
      const speed = FC.Physics.speedForPower(p); // pull length = travel distance
      const vis = Math.min(len, maxPull) * 0.5;
      a.offX = (dx / len) * vis;
      a.offY = (dy / len) * vis;
      a.gripX = (dx / len) * Math.min(len, maxPull);
      a.gripY = (dy / len) * Math.min(len, maxPull);
      const wl = Math.sqrt(wx * wx + wy * wy) || 1;
      wx /= wl; wy /= wl;
      // flicks always go into the pond
      const ang = FC.clamp(Math.atan2(wx, -wy), -CONE, CONE);
      wx = Math.sin(ang); wy = -Math.cos(ang);
      a.L = L;
      a.dir = { x: wx, y: wy };
      a.power = p;
      a.speed = speed;
      a.valid = true;
      // the preview ends at the first contact: what the hit does to the cluster is the player's call
      a.pred = this.world.predict(L.x, L.y, wx * speed, wy * speed, r, tier, { maxT: 3.4, maxLen: 3000, spacing: 42 });
      // detents every 25 % (sound + a tiny buzz on phones that support it)
      const step = Math.floor(p * 4 + 0.001);
      if (step !== a.lastTick) {
        if (step > a.lastTick) {
          AU.tick(step / 4);
          a.detent = 1;
          if (navigator.vibrate) try { navigator.vibrate(step >= 4 ? 16 : 7); } catch (e) { /* ignore */ }
        }
        a.lastTick = step;
      }
      AU.stretch(p);
    },

    predMatch(pred, tier) {
      return !!(pred && pred.hit && pred.hit.body.tier >= 1 && (pred.hit.body.tier === tier || tier === 0));
    },

    launch() {
      const a = this.aim;
      this.fire(a.dir, a.speed, a.power, a.L);
    },

    fire(dir, speed, power, L) {
      const kind = this.queue.shift();
      this.queue.push(this.randKind());
      const tier = CK.tierOf(kind);
      const r = TIERS[tier].r;
      const b = new Body(tier, r, L.x, L.y, kind);
      b.vx = dir.x * speed;
      b.vy = dir.y * speed;
      b.launched = true;
      b.shotId = ++this.shotSeq;
      b.expr = 'wee';
      b.exprT = 0.6;
      b.sq = -0.16 - 0.12 * power; b.sqv = 0; b.sqa = Math.atan2(dir.y * S.K, dir.x); // stretched by the launch
      b.gliding = true;
      this.world.add(b);
      this.lastShot = b;
      this.pending.push({ id: b.shotId, body: b, t: 0, still: 0, merged: false });
      if (power > 0.85) this.shake = Math.max(this.shake, 2.5);
      this.cool = 0.1;
      this.launcher.pop = 1;
      this.fly = { t: 0 };
      this.sling.snap = 1;
      this.tilly.flick = 1;
      this.shots++;
      this.idle = 0;
      if (this.level) FC.UI.setFlicks(this.shots, this.level.def.par); // the stars of a level count flicks
      FX.ripple(L.x, L.y, r * 0.8, 0.6, 520);
      FX.burst(L.x, L.y, { n: 10, colors: ['#ffffff', '#c9f6ff'], speed: [200, 600], size: [8, 14], kinds: ['drop', 'dot'], life: [0.3, 0.6], gravity: 0, drag: 4, dir: Math.atan2(dir.y, dir.x) + Math.PI, spread: 1.6 });
      AU.launch(power);
      this.maybeBubble();
      FC.UI.updateNext(true);
      this.rareCheck();
      const c = this.coach;
      if (c && (c.step === 'aim' || c.step === 'retry')) { c.step = 'fly'; c.t = 0; c.shown = ''; FC.UI.coachHide(); }
    },

    // a rare find has arrived in the sling: say so once
    rareCheck() {
      const k = this.queue[0];
      if (!k || !isRare(k) || this.rareTipFor === k || this.coach) return;
      this.rareTipFor = k;
      const s = spec(k);
      FC.UI.coach('A rare find! ' + s.name, LV.Collection.has(k) ? 'Merge it for bonus points' : 'Merge it to add it to your Cake Book', { time: 3200 });
      AU.discover();
    },

    swap() {
      if (this.state !== 'playing' || this.aim.active || this.queue.length < 2 || this.won) return;
      const q = this.queue;
      const t = q[0]; q[0] = q[1]; q[1] = t;
      this.fly = null;
      this.launcher.pop = 0.35;
      AU.swap();
      FC.UI.updateNext(true);
      this.rareCheck();
    },

    useJoker() {
      if (this.state !== 'playing' || this.jokers <= 0 || this.queue[0] === 'magic' || this.won) return;
      this.jokers--;
      this.queue.unshift('magic');
      this.fly = null;
      this.launcher.pop = 0;
      AU.magic();
      FC.UI.updatePowers();
      FC.UI.updateNext();
      FC.UI.banner('Magic Cake!', 'It upgrades the first cake it touches');
    },

    toggleWand() {
      if (this.state !== 'playing' || this.won) return;
      if (this.wandMode) { this.wandMode = false; FC.UI.updatePowers(); FC.UI.coachHide(); this.setCursor(); return; }
      if (this.wands <= 0) return;
      this.cancelAim();
      this.wandMode = true;
      FC.UI.updatePowers();
      FC.UI.coach('Tap a cake to poof it away', 'Tap the water to cancel', { sticky: true });
      this.setCursor();
    },

    // The two big cakes right below a level's goal (the castle's 9 and 10, say) are its recipe: one poofed by a Wand
    // could not be baked again in the level, and the level would play on with a goal out of reach. So the Wand leaves
    // them alone and stays ready. Smaller cakes (a 7 or an 8 in a castle) can still go: a costly rescue, not a dead end.
    wandSpares(b) {
      return !!(b && this.level && !this.won && b.tier >= Math.max(WAND_SPARES, this.level.def.goal - 2));
    },

    wandTap(x, y) {
      let hit = this.pickBody(x, y);
      // a spared giant in front: the finger probably meant the smaller cake peeking out behind it
      if (this.wandSpares(hit)) hit = this.pickBody(x, y, (b) => this.wandSpares(b)) || hit;
      if (this.wandSpares(hit)) {
        hit.expr = 'worried'; hit.exprT = 1.4;
        FX.popup(hit.x, hit.y - hit.r, 'The recipe needs me!', '#a77ad6', 30);
        if (AU.nope) AU.nope();
        FC.UI.coach('Too big for a Wand', 'The recipe needs it – tap a smaller cake', { sticky: true });
        return;
      }
      this.wandMode = false;
      FC.UI.coachHide();
      this.setCursor();
      if (!hit) { FC.UI.updatePowers(); return; }
      hit.dead = true;
      this.wands--;
      const T = spec(hit.kind);
      FX.burst(hit.x, hit.y, { n: 30, colors: ['#ffffff', '#fff3a8', '#e8d4ff'].concat(T.particle), speed: [250, 900], size: [10, 24], kinds: ['star', 'dot', 'heart'], life: [0.5, 1.1], gravity: -200 });
      FX.ring(hit.x, hit.y, hit.r * 0.6, hit.r * 1.8, '#ffffff', 0.45, 18);
      FX.popup(hit.x, hit.y - hit.r, 'Poof!', '#a77ad6', 40);
      AU.poof();
      FC.UI.updatePowers();
    },

    pickBody(sx, sy, skip) {
      const list = this.world.bodies.filter((b) => !b.dead && !b.sensor && !(skip && skip(b))).sort((a, b) => b.y - a.y);
      for (const b of list) {
        const p = S.w2s(b.x, b.y);
        const r = b.r * S.s;
        const oy = p.y - r * 0.45;
        if (Math.abs(sx - p.x) < r * 1.05 && sy > oy - r * 1.05 && sy < oy + r * 1.05) return b;
      }
      return null;
    },

    // first time the player owns a power-up: explain it once
    powerIntro(kind) {
      const key = kind === 'joker' ? 'seenMagic' : 'seenWand';
      if (FC.store.get(key, false)) return;
      FC.store.set(key, true);
      if (kind === 'joker') this.coachSay('magic', 'You got a Magic Cake!', 'Tap it: your next cake upgrades any cake', { time: 4200 });
      else this.coachSay('wand', 'You got a Wand!', 'Tap it, then tap a cake to poof it away', { time: 4200 });
    },

    // ------------------------------------------------------------
    // physics events
    // ------------------------------------------------------------
    onImpact(a, b, st, nx, ny, x, y) {
      const k = Math.min(0.22, st / 6000);
      const ang = Math.atan2(ny * S.K, nx);
      for (const o of [a, b]) {
        if (o.sensor) continue;
        const kk = k * (o === a ? b.m : a.m) / (a.m + b.m) * 2;
        o.sqv += kk * 9;
        o.sqa = ang;
        if (st > 900 && kk > 0.06 && !o.expr) { o.expr = 'ouch'; o.exprT = 0.35; }
        if (o.launched && st > 160) o.launched = false;
        o.gliding = false;
      }
      if (st > 140) AU.bump(st, (a.tier + b.tier) / 2);
      if (st > 420) FX.ripple(x, y, 40, Math.min(1, st / 2500), 380);
    },

    onRim(b, st, nx, ny) {
      b.sqv += Math.min(0.25, st / 5000) * 9;
      b.sqa = Math.atan2(ny * S.K, nx);
      if (st > 160) AU.rim(st);
      if (st > 380) {
        const x = b.x + nx * b.r, y = b.y + ny * b.r;
        FX.ripple(x, y, 30, Math.min(1, st / 2500), 300);
        FX.burst(x, y, { n: Math.min(12, Math.round(st / 300)), colors: ['#ffffff', '#c9f6ff'], speed: [150, 450], size: [7, 13], kinds: ['drop'], life: [0.3, 0.6], gravity: 0, drag: 3.5, dir: Math.atan2(-ny, -nx), spread: 1.6 });
      }
    },

    onMerge(a, b) {
      const t = a.tier;
      const live = this.state === 'playing';
      const combo = live ? this.bumpCombo() : 1;
      const mult = 1 + 0.5 * (combo - 1);
      if (t >= MAX_T) {
        a.dead = b.dead = true;
        if (live) this.royalBlast((a.x + b.x) / 2, (a.y + b.y) / 2, combo);
        return;
      }
      const nt = t + 1;
      const nb = this.world.mergeBodies(a, b, nt, TIERS[nt].r, live);
      nb.pop = 0;
      nb.expr = 'happy';
      nb.exprT = 1.1;
      if (!live) {
        // title-screen demo: just the pretty part
        this.mergeFX(nb, nt, 1, 0, null, true);
        return;
      }
      this.merges++;
      this.creditShot(nb.shotId);
      const pts = Math.round(TIERS[nt].score * mult * this.streakMult() * this.stageMult());
      this.addScore(pts);
      this.mergeFX(nb, nt, combo, pts);
      AU.merge(nt, combo);
      // a tiny freeze sells the pop
      this.hitstop = Math.min(0.1, this.hitstop + 0.035 + nt * 0.003); // lighter than v0.5: chains are common now and must keep flowing
      if (navigator.vibrate) try { navigator.vibrate(nt >= 6 ? 22 : 10); } catch (e) { /* ignore */ }
      for (const o of [a, b]) if (isRare(o.kind)) this.rareFound(o, nb);
      this.reach(nt, nb);
      this.cheer(nt >= 5 || combo >= 3 ? 1.2 : 0.6);
      this.bakeProgress();
      const c = this.coach;
      if (c && (c.step === 'aim' || c.step === 'fly' || c.step === 'retry')) {
        c.step = 'merged'; c.t = 0;
        this.coachSay('merged', 'Yum! Same cakes merge', 'Two of a kind make a bigger cake', { eq: [t, t, nt] });
      }
      // cakes nearby smile
      for (const o of this.world.bodies) {
        if (o.dead || o === nb || o.sensor) continue;
        const d = Math.hypot(o.x - nb.x, o.y - nb.y);
        if (d < nb.rT * 2.6 && !o.expr) { o.expr = 'happy'; o.exprT = 0.6 + Math.random() * 0.4; }
      }
    },

    onJoker(j, c) {
      if (j.dead || c.dead || this.state !== 'playing') return;
      j.dead = true;
      const combo = this.bumpCombo();
      const mult = 1 + 0.5 * (combo - 1);
      FX.burst(j.x, j.y, { n: 30, colors: spec('magic').particle, speed: [250, 900], size: [10, 22], kinds: ['star', 'dot', 'heart'], life: [0.6, 1.2], gravity: -100 });
      AU.magic();
      if (c.tier >= MAX_T) {
        c.dead = true;
        this.royalBlast(c.x, c.y, combo);
        return;
      }
      c.dead = true;
      const nt = c.tier + 1;
      const nb = new Body(nt, c.r, c.x, c.y);
      nb.rT = TIERS[nt].r;
      nb.setMass(nb.rT);
      nb.vx = c.vx * 0.5; nb.vy = c.vy * 0.5;
      nb.age = Math.max(0.8, c.age);
      nb.pop = 0;
      nb.expr = 'love';
      nb.exprT = 1.4;
      this.world.add(nb);
      this.merges++;
      this.creditShot(j.shotId);
      const pts = Math.round(TIERS[nt].score * mult * this.streakMult() * this.stageMult());
      this.addScore(pts);
      this.mergeFX(nb, nt, combo, pts, 'Magic!');
      this.hitstop = Math.min(0.13, this.hitstop + 0.06);
      if (isRare(c.kind)) this.rareFound(c, nb);
      this.reach(nt, nb);
      this.cheer(1);
      this.bakeProgress();
    },

    // a rare find was merged: bonus points, and the Cake Book gets it (first time: a discovery)
    rareFound(o, nb) {
      const s = spec(o.kind);
      const pts = Math.round(40 * s.tier * this.stageMult());
      this.addScore(pts);
      FX.popup(nb.x, nb.y - nb.rT * 3.4, 'Rare! +' + pts, '#e2a800', 34, { life: 1.6 });
      FX.burst(nb.x, nb.y, { n: 26, colors: ['#ffe27a', '#ffffff', '#fff3a8', '#ffd34d'], speed: [250, 800], size: [9, 18], kinds: ['star', 'dot'], life: [0.6, 1.2], gravity: -120 });
      this.flash = Math.max(this.flash, 0.3); this.flashCol = '#fff6d8';
      if (this.runRares) this.runRares.push(o.kind);
      this.discover(o.kind, true);
    },

    onBubble(s, b) {
      if (s.dead) return;
      s.dead = true;
      this.bubble = null;
      const roll = Math.random();
      let label, kind = null;
      // in a level the bubble holds a Magic Cake only once in six (it is the shortcut to the goal)
      const pMagic = this.mode === 'level' ? 0.16 : 0.36;
      if (roll < pMagic) { this.jokers++; label = '+1 Magic Cake'; kind = 'joker'; }
      else if (roll < 0.72) { this.wands++; label = '+1 Wand'; kind = 'wand'; }
      else { this.addScore(60); label = '+60 Bonus'; }
      FX.burst(s.x, s.y, { n: 34, colors: ['#ffffff', '#d6f6ff', '#ffd6f0', '#fff3a8'], speed: [250, 800], size: [9, 20], kinds: ['star', 'dot'], life: [0.5, 1.0], gravity: -150 });
      FX.ring(s.x, s.y, s.r * 0.8, s.r * 2.2, '#ffffff', 0.4, 14);
      FX.popup(s.x, s.y - s.r * 0.6, label, '#7d63d8', 34, { life: 1.5 });
      AU.bubble();
      FC.UI.updatePowers(true);
      if (kind) this.powerIntro(kind);
      this.cheer(0.8);
    },

    // hot streak: consecutive flicks that make at least one merge
    streakMult() {
      return this.streak >= 2 ? Math.min(3, 1 + 0.25 * (this.streak - 1)) : 1;
    },
    // every finished order raises the stage multiplier
    stageMult() {
      return Math.min(2.5, 1 + 0.15 * (this.stage - 1));
    },
    creditShot(id) {
      const p = this.pending.find((q) => q.id === id);
      if (!p || p.merged) return;
      p.merged = true;
      this.streak++;
      if (this.streak >= 2) {
        AU.streak(this.streak);
        FC.UI.setStreak(this.streak, this.streakMult());
      }
    },
    updatePending(dt) {
      for (let i = this.pending.length - 1; i >= 0; i--) {
        const p = this.pending[i];
        p.t += dt;
        if (p.merged) { if (p.t > 0.5) this.pending.splice(i, 1); continue; }
        const b = p.body;
        p.still = b.dead || b.speed() < 90 ? p.still + dt : 0;
        if ((p.still > 0.45 && p.t > 0.6) || p.t > 6) {
          this.pending.splice(i, 1);
          if (this.streak >= 2) { AU.streakLost(); FC.UI.setStreak(0, 1, true); }
          this.streak = 0;
        }
      }
    },

    bumpCombo() {
      if (this.t - this.lastMergeT < 1.4) this.combo++;
      else this.combo = 1;
      this.lastMergeT = this.t;
      if (this.combo > this.bestCombo) this.bestCombo = this.combo;
      if (this.combo >= 3) FC.UI.combo(this.combo);
      return this.combo;
    },

    mergeFX(nb, nt, combo, pts, label, quiet) {
      const T = spec(nb.kind);
      const big = nt >= 6 && !quiet;
      FX.burst(nb.x, nb.y - nb.rT * 0.2, {
        n: Math.min(30, 10 + nt * 2 + combo * 2), colors: T.particle.concat(['#ffffff']),
        speed: [260, 700 + nt * 60], size: [9, 18 + nt], kinds: ['sprinkle', 'star', 'dot', 'heart', 'sprinkle'],
        life: [0.55, 1.15], gravity: 650, up: 200, drag: 2.2, jitter: nb.rT * 0.6,
      });
      FX.ring(nb.x, nb.y, nb.rT * 0.5, nb.rT * 1.6, '#ffffff', 0.38, 16);
      FX.ripple(nb.x, nb.y, nb.rT * 0.8, 0.9, 520);
      if (!quiet) FX.popup(nb.x, nb.y - nb.rT * 2.5, label ? label + ' +' + pts : '+' + pts, T.particle[0] === '#ffffff' ? '#ff6fa8' : FC.shade(T.particle[0], -0.25), 30 + nt * 2.5, { sub: combo >= 2 ? 'Combo x' + combo : null });
      if (big) { this.shake = Math.max(this.shake, 3 + nt * 0.6); }
    },

    royalBlast(x, y, combo) {
      const pts = Math.round(500 * (1 + 0.5 * (combo - 1)) * this.stageMult());
      this.addScore(pts);
      this.merges++;
      FX.burst(x, y, { n: 60, colors: spec(CK.kindFor(MAX_T)).particle.concat(['#ff9fd0', '#9ec5ff', '#a7ebc8']), speed: [400, 1600], size: [12, 30], kinds: ['star', 'heart', 'sprinkle', 'dot'], life: [0.8, 1.8], gravity: 300, up: 300 });
      FX.ring(x, y, 100, 900, '#fff3a8', 0.8, 30);
      FX.ring(x, y, 60, 700, '#ffffff', 0.6, 20);
      FX.popup(x, y - 300, 'Fairy Magic! +' + pts, '#ff6fa8', 64, { life: 2.0 });
      for (const o of this.world.bodies) {
        if (o.dead || o.sensor) continue;
        const dx = o.x - x, dy = o.y - y, d = Math.hypot(dx, dy) || 1;
        if (d < 900) { const k = (1 - d / 900) * 900; o.vx += (dx / d) * k; o.vy += (dy / d) * k; o.expr = 'happy'; o.exprT = 1.5; }
      }
      this.shake = 12;
      this.flash = 0.6; this.flashCol = '#fff6d8';
      AU.royal();
      FC.UI.banner('Fairy Magic!', 'Two ' + spec(CK.kindFor(MAX_T)).name + 's vanished in sparkles');
      this.cheer(2);
      this.bakeProgress();
    },

    // a new cake was baked in this run (nb = the new body)
    reach(nt, nb) {
      if (nb && nt >= (this.maxKindTier || 0)) { this.maxKind = nb.kind; this.maxKindTier = nt; }
      if (nt > this.maxTier) {
        this.maxTier = nt;
        // a bigger cake needs more room: the calm pool widens
        if (ringFor(nt) > (this.ringBase || this.ring) + 1 && this.state === 'playing') { // the base ring: the tide is no widening
          this.ringPulse = Math.max(this.ringPulse, 2.2);
          FX.popup(0, -this.ring * 0.55, 'The pool widens!', '#7bdbe8', 30, { life: 1.6 });
        }
      }
      const goal = this.level && !this.won && nt >= this.level.def.goal;
      this.discover(nb ? nb.kind : CK.kindFor(nt), false, goal);
      if (this.level) FC.UI.setGoal();
      if (goal) this.levelClear(nb);
    },

    // the Cake Book: every kind you bake yourself (quiet = no toast; the level-clear card shows the goal cake instead)
    discover(kind, rare, quiet) {
      if (!kind || kind === 'magic') return;
      const fresh = LV.Collection.add(kind);
      if (!fresh) return;
      if (this.runNew) this.runNew.push(kind); // a first-time find: the Cake Book pill shows "New!"
      FC.UI.markNewCake(kind);
      if (!quiet) { FC.UI.discover(kind, rare); AU.discover(); }
    },

    // ------------------------------------------------------------
    // level clear: the goal cake is baked – fireworks, then the result card
    // ------------------------------------------------------------
    levelClear(nb) {
      this.won = true;
      this.wonT = 0;
      this.goalBody = nb;
      this.cancelAim();
      this.wandMode = false;
      this.handT = -1;
      this.hint = null;
      this.pending = [];
      this.danger = 0; this.dangerBody = null;
      FC.UI.setDanger(false);
      FC.UI.coachHide();
      FC.UI.updatePowers();
      // (the stars are recorded when the card appears: the chain that bakes the goal may still be running)
      // the tour was cut short by the win: the rest of it comes with the next level
      if (this.coach) { FC.store.set('coach', ['aim', 'retry', 'fly', 'merged', 'goal'].indexOf(this.coach.step) >= 0 ? 1 : COACH_DONE); this.coach = null; }
      AU.royal();
      this.shake = Math.max(this.shake, 7);
      this.flash = 0.5; this.flashCol = '#fff6d8';
      this.cheer(99);
      for (const b of this.world.bodies) { if (!b.sensor) { b.expr = 'happy'; b.exprT = 99; } b.danger = 0; }
      FC.UI.banner('Level clear!', 'You baked the ' + spec(nb.kind).name + '!');
      FC.UI.setGoal();
      this.setCursor();
    },

    updateWon(dt) {
      this.wonT += dt;
      const nb = this.goalBody;
      const W = this.world;
      for (const b of W.bodies) b.danger = 0;
      // fireworks around the new cake, and a lap of honour for everybody
      if (nb && !nb.dead && Math.random() < dt * 9) {
        const a = Math.random() * TAU, rr = nb.rT * (1.2 + Math.random() * 1.6);
        FX.burst(nb.x + Math.cos(a) * rr, nb.y + Math.sin(a) * rr * 0.6, { n: 14, colors: spec(nb.kind).particle.concat(['#ffffff', '#fff3a8']), speed: [200, 700], size: [9, 20], kinds: ['star', 'heart', 'sprinkle'], life: [0.6, 1.2], gravity: 450, up: 250 });
      }
      if (Math.random() < dt * 6) {
        const a = Math.random() * TAU, rr = 300 + Math.random() * 600;
        FX.burst(Math.cos(a) * rr, Math.sin(a) * rr, { n: 8, colors: ['#ffffff', '#fff3a8', '#ffd6ea', '#d6f6ff'], speed: [120, 420], size: [7, 14], kinds: ['star', 'dot'], life: [0.5, 1.0], gravity: -60 });
      }
      if (this.wonT > 2.6 && this.state === 'playing') {
        this.state = 'won';
        this.levelResult = LV.Progress.record(this.level.w, this.level.l, this.score, this.shots);
        this.levelResult.score = this.score;
        this.levelResult.par = this.level.def.par;
        // a whirl that was running ends here (the pond keeps floating behind the card, calmly)
        this.whirl = null;
        W.inflowK = 1; W.free = false; W.shear = 0; W.twinK = 1; W.twinAlways = false; W.spin = 0;
        FC.UI.showLevelClear(this.level, this.levelResult, nb ? nb.kind : this.level.def.kind);
        this.setCursor();
      }
    },

    cheer(dur) {
      this.tilly.mood = 'cheer';
      this.tilly.moodT = dur;
    },

    addScore(pts) {
      this.score += pts;
      FC.UI.setScore(this.score);
    },

    // ------------------------------------------------------------
    // stages: every order is a number of merges; filling it starts the whirl
    // ------------------------------------------------------------
    bakeProgress() {
      // merges the whirl makes by itself are scored, but they do not fill the order (otherwise a lucky whirl
      // completes the next order on the spot, and the player watches whirl after whirl)
      if (this.whirl) { this.whirl.merges++; return; }
      this.stageMerges++;
      FC.UI.setStage(this.stage, this.stageMerges, this.stageGoal);
      if (this.stageMerges >= this.stageGoal && !this.stageDone && !this.whirl) {
        this.stageDone = true;
        this.stageDoneT = 0;
        AU.orderDone();
        FC.UI.banner('Order complete!', 'Hold on – the pond is about to whirl');
        this.cheer(2.5);
      }
    },

    // endless mode: the island drifts into the next unlocked world every third stage (and its menu comes along)
    themeForStage(n) {
      const list = this.endlessWorlds || [0];
      return LV.WORLDS[list[Math.floor((n - 1) / 3) % list.length]].theme;
    },

    // the whirl waits for the chain reaction to finish, then spins the pond up
    updateStageDone(dt) {
      if (!this.stageDone || this.whirl || this.won) return;
      this.stageDoneT += dt;
      let busy = this.pending.length > 0;
      for (const b of this.world.bodies) if (!b.dead && !b.sensor && b.speed() > 260) { busy = true; break; }
      if (busy && this.stageDoneT < 1.4) return;
      this.startWhirl();
    },

    startWhirl() {
      this.stageDone = false;
      this.cancelAim();
      this.wandMode = false;
      FC.UI.updatePowers();
      this.stage++;
      this.stageMerges = 0;
      this.stageGoal = stageGoal(this.stage);
      this.whirl = { t: 0, omega: 0, merges: 0, shown: false, kicked: false, batch: this.deliverySize(), delivered: 0, nextDrop: 0 };
      this.pending = [];
      this.danger = 0; this.dangerBody = null;
      for (const b of this.world.bodies) { b.danger = 0; if (!b.sensor) { b.expr = 'wee'; b.exprT = 2.4; } }
      this.cheer(4.5);
      this.shake = Math.max(this.shake, 3);
      AU.whirl();
      FC.UI.setStage(this.stage, 0, this.stageGoal);
      FC.UI.coachHide();
    },

    updateWhirl(dt) {
      const w = this.whirl;
      if (!w) return;
      w.t += dt;
      const T = WHIRL, W = this.world;
      let om, k;
      if (w.t < T.up) om = T.omega * easeInOut(w.t / T.up);
      else if (w.t < T.hold) om = T.omega;
      else if (w.t < T.down) om = T.omega * (1 - easeInOut((w.t - T.hold) / (T.down - T.hold)));
      else om = 0;
      w.omega = om;
      // tear & spin: nothing holds together, the rim turns faster than the middle, the water pushes outwards
      const spinning = w.t < T.hold + 0.3;
      W.free = spinning;
      W.shear = spinning ? T.shear * om : 0;
      if (w.t < T.up) W.inflowK = FC.lerp(0.4, T.outflow, w.t / T.up);
      else if (w.t < T.hold) W.inflowK = T.outflow;
      else if (w.t < T.down) { k = (w.t - T.hold) / (T.down - T.hold); W.inflowK = FC.lerp(T.outflow, T.drain, easeInOut(k)); }
      else if (w.t < T.settle) { k = (w.t - T.down) / (T.settle - T.down); W.inflowK = FC.lerp(T.drain, 1.2, k); }
      else W.inflowK = 1;
      // twins find each other while everything is in motion
      W.twinAlways = w.t < T.settle;
      W.twinK = w.t < T.down ? T.twin : w.t < T.settle ? FC.lerp(T.twin, 1, (w.t - T.down) / (T.settle - T.down)) : 1;
      // turbulence: one random kick for everybody once the water has taken hold
      if (!w.kicked && w.t > 0.35) {
        w.kicked = true;
        for (const b of W.bodies) {
          if (b.dead || b.sensor || b.anchored) continue;
          const a = Math.random() * TAU, sp = T.kick * (0.5 + Math.random());
          b.vx += Math.cos(a) * sp; b.vy += Math.sin(a) * sp;
          b.touch = false;
        }
      }
      for (const b of W.bodies) { b.danger = 0; b.age = Math.min(b.age, 0.4); }
      // the delivery: fresh cakes tumble down the spring at the back while everything is spinning, and get mixed in
      if (w.delivered < w.batch && w.t > T.up + 0.1 && w.t < T.down && w.t >= w.nextDrop) {
        w.nextDrop = w.t + 0.18;
        w.delivered++;
        this.deliverCake();
      }
      if (w.t > 0.2 && w.t < T.down && Math.random() < dt * 30) {
        const a = Math.random() * TAU, rr = 300 + Math.random() * 650;
        FX.burst(Math.cos(a) * rr, Math.sin(a) * rr, { n: 2, colors: ['#ffffff', '#d6f6ff', '#fff3a8'], speed: [60, 260], size: [6, 12], kinds: ['star', 'drop'], life: [0.4, 0.8], gravity: -40 });
      }
      if (!w.shown && w.t >= T.down) {
        w.shown = true;
        const n = this.stage;
        let gift, kind;
        // endless: Magic Cake and Wand alternate. In a level the Magic Cake is the late finisher (the fifth
        // order, then every third) – handed out at the first order it would upgrade the biggest cake straight
        // to the goal and skip the climb
        const magic = this.mode === 'level' ? n >= 5 && n % 3 === 2 : n % 2 === 0;
        if (magic) { this.jokers++; gift = '+1 Magic Cake'; kind = 'joker'; } else { this.wands++; gift = '+1 Wand'; kind = 'wand'; }
        FC.UI.updatePowers(true);
        const nextTheme = this.mode === 'endless' ? this.themeForStage(n) : S.theme;
        const fresh = w.batch > 0 ? ' · ' + w.batch + ' fresh cakes' : '';
        if (nextTheme !== S.theme) {
          S.load(nextTheme).then(() => {
            if (this.state !== 'playing' || this.mode !== 'endless') return;
            S.setTheme(nextTheme, false);
            CK.setMenu(nextTheme); // new world, new menu: the cakes from here on wear the new world's flavours
            this.redress();
            FC.UI.banner('Welcome to ' + S.themeName(nextTheme) + '!', 'Stage ' + n + fresh + ' · ' + gift);
            FC.UI.updateNext();
          });
        } else FC.UI.banner('Stage ' + n + '!', 'Order: ' + this.stageGoal + ' merges' + fresh + ' · ' + gift);
        if (this.mode === 'endless') { const upcoming = this.themeForStage(n + 1); if (upcoming !== S.theme) S.load(upcoming); }
        AU.levelUp();
        this.powerIntro(kind);
      }
      if (w.t >= T.settle) {
        // the whirl is over once the cluster has gathered inside the ring again (or after a last grace)
        let calm = true;
        for (const b of W.bodies) {
          if (b.dead || b.sensor) continue;
          if (b.speed() > 120 || Math.hypot(b.x, b.y) + b.r > this.ring) { calm = false; break; }
        }
        if (calm || w.t >= T.maxSettle) {
          this.whirl = null;
          W.inflowK = 1; W.free = false; W.shear = 0; W.twinK = 1; W.twinAlways = false;
          for (const b of W.bodies) b.age = -1.4; // a long grace: the ring only counts again after 2.5 s
        }
      }
    },

    // endless mode, a new world: every cake in the pond and in the queue changes into this world's cake of its size, so
    // the pond only ever holds one world's menu (two worlds' cakes side by side were hard to tell apart, and a Blossom
    // Cake merging with a Toadstool Cake broke the "same cake, same size" rule). Rare finds and Magic Cakes stay.
    redress() {
      for (const b of this.world.bodies) {
        if (b.dead || b.sensor || b.tier < 1 || isRare(b.kind)) continue;
        const k = CK.kindFor(b.tier);
        if (b.kind === k) continue;
        b.kind = k;
        b.pop = Math.min(b.pop, 0.45); // a little bounce sells the change of clothes
        b.expr = 'love'; b.exprT = 1.2;
        FX.burst(b.x, b.y - b.r * 0.4, { n: 10, colors: spec(k).particle.concat(['#ffffff']), speed: [140, 420], size: [7, 14], kinds: ['star', 'sprinkle', 'dot'], life: [0.4, 0.9], gravity: 200, up: 120 });
      }
      this.queue = this.queue.map((k) => (k === 'magic' || isRare(k) ? k : CK.kindFor(CK.tierOf(k))));
    },

    // how full is the calm pool? sum of the cakes' areas over the pool's area (a packed pool reaches ~0.53)
    poolFill() {
      let area = 0;
      for (const b of this.world.bodies) if (!b.dead && !b.sensor) area += b.rT * b.rT;
      return area / (this.ring * this.ring);
    },
    // how many small cakes the castle sends with the next whirl: enough to top the pool up to the stage's target fill
    deliverySize() {
      const want = targetFill(this.stage);
      const fill = this.poolFill();
      if (fill >= want) return 0;
      const one = (TIERS[2].r * TIERS[2].r) / (this.ring * this.ring); // a Cherry Bite's share
      let n = Math.round((want - fill) / one);
      // big cakes pack loosely: when the cluster already reaches out towards the ring, the castle sends less
      // (cakes beyond the ring are riders on the current, not the cluster – they do not count)
      let edge = 0;
      for (const b of this.world.bodies) {
        if (b.dead || b.sensor) continue;
        const e = Math.hypot(b.x, b.y) + b.rT;
        if (e <= this.ring + 20) edge = Math.max(edge, e);
      }
      const reach = edge / this.ring;
      n = Math.min(n, reach > 0.9 ? 0 : reach > 0.82 ? 1 : reach > 0.74 ? 2 : reach > 0.66 ? 4 : reach > 0.58 ? 6 : DELIVERY_MAX);
      return FC.clamp(n, 0, DELIVERY_MAX);
    },
    // one fresh cake tumbles down the spring at the back of the pond and joins the current
    deliverCake() {
      const tier = FC.pick([1, 1, 1, 1, 2, 2, 2, 3]);
      const r = TIERS[tier].r;
      const x = FC.rand(-60, 60), y = -CFG.R + r + 30;
      const b = new Body(tier, r, x, y);
      this.world.flowAt(x, y, WTMP, r);
      b.vx = WTMP.x * 0.8 + FC.rand(-80, 80); b.vy = WTMP.y * 0.8 + 180;
      b.launched = true;
      b.age = 0;
      b.pop = 0;
      b.expr = 'wee'; b.exprT = 1.6;
      b.sq = -0.2; b.sqa = Math.PI / 2;
      this.world.add(b);
      FX.ripple(x, y + r * 0.5, r, 0.8, 420);
      FX.burst(x, y, { n: 12, colors: ['#ffffff', '#c9f6ff', '#d6f6ff'], speed: [150, 500], size: [8, 15], kinds: ['drop', 'dot'], life: [0.3, 0.7], gravity: 300, up: 120, drag: 2.5 });
      AU.plip(tier);
    },

    maybeBubble() {
      if (this.bubble || this.shots < this.nextBubbleAt) return;
      this.nextBubbleAt = this.shots + FC.randInt(14, 22);
      for (let i = 0; i < 50; i++) {
        const a = Math.random() * TAU, rr = 250 + Math.random() * 480;
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        if (y > 560) continue; // keep the area in front of the sling clear
        let free = true;
        for (const o of this.world.bodies) {
          if (o.dead) continue;
          if (Math.hypot(o.x - x, o.y - y) < o.r + 120) { free = false; break; }
        }
        if (!free) continue;
        const b = new Body(-1, 80, x, y);
        b.sensor = true;
        b.anchored = true;
        b.life = 16;
        b.pop = 0;
        this.world.add(b);
        this.bubble = b;
        FX.ring(x, y, 20, 120, '#ffffff', 0.5, 10);
        return;
      }
    },

    // ------------------------------------------------------------
    // tutorial coach: one short tip at a time, exactly when it matters
    // ------------------------------------------------------------
    coachSay(key, title, sub, opts) {
      if (this.coach && this.coach.shown === key) return;
      if (this.coach) this.coach.shown = key;
      FC.UI.coach(title, sub, opts);
    },

    nearRing() {
      for (const b of this.world.bodies) {
        if (b.dead || b.sensor || b.age < 1.1) continue;
        if (Math.hypot(b.x, b.y) + b.r > this.ring - 50 && b.speed() < 400) return true;
      }
      return false;
    },

    updateCoach(dt) {
      const a = this.aim;
      if (!a.active && !this.water.active && !this.wandMode) this.idle += dt;
      if (this.trickTip > 0) {
        this.trickTip -= dt;
        if (this.shots > 0) this.trickTip = 0;
        else if (this.trickTip <= 0) FC.UI.coach('Trick shot!', 'One clever flick can set off the whole chain', { time: 3400 });
      }
      const c = this.coach;
      // the hand shows the gesture: always during the first steps, later only when the player hesitates
      let hand;
      if (c && (c.step === 'aim' || c.step === 'retry')) hand = !a.active && this.idle > 0.35;
      else hand = !a.active && !this.water.active && !this.wandMode && !this.whirl && ((this.shots === 0 && this.idle > 2.5) || this.idle > 14);
      if (hand) this.handT = this.handT < 0 ? 0 : this.handT + dt;
      else this.handT = -1;
      // the first time a flick is seen riding the current round to the pile: say so (once per game)
      if (!this.rideTip && a.active && a.valid && a.pred && a.pred.hit && a.pred.hit.drift && a.pred.land) {
        const land = a.pred.land, h = a.pred.hit;
        const turned = Math.abs(FC.angDiff(Math.atan2(land.y, land.x), Math.atan2(h.y, h.x)));
        if (turned > 0.6 && (!c || c.step === 'wait' || c.step === 'done')) {
          this.rideTip = true;
          if (!c) FC.UI.coach('Riding the current {heart}', 'The water carries it round to the pile', { time: 2600 });
        }
      }
      if (!c) return;
      c.t += dt;
      switch (c.step) {
        case 'aim':
        case 'retry':
          if (a.active && a.valid) {
            if (this.predMatch(a.pred, CK.tierOf(this.queue[0]))) this.coachSay('match', 'That’s a match! {heart}', 'Let go to merge them');
            else this.coachSay('aiming', 'Aim at the same cake', 'A {heart} means: match!');
          } else if (!a.active) {
            if (c.step === 'aim') this.coachSay('aim', 'Pull the cake back & let go!', 'Like a slingshot');
            else this.coachSay('retry', 'So close!', 'Hit a cake that looks the same');
          }
          break;
        case 'fly':
          if (c.t > 2.4) { c.step = 'retry'; c.t = 0; }
          break;
        case 'merged':
          if (c.t > 2.6) {
            c.step = 'goal'; c.t = 0;
            this.coachSay('goal', 'Bake bigger and bigger cakes', 'All the way up to the ' + spec(CK.kindFor(MAX_T)).name + '!', { chain: true });
            FC.UI.pulseBook();
          }
          break;
        case 'goal':
          if (c.t > 3.2) {
            c.step = 'water'; c.t = 0;
            this.coachSay('water', 'Read the water', 'The current at the edge carries slow cakes round; the calm pool inside the ring draws them in');
            this.foamPulse = 4;
          }
          break;
        case 'water':
          if (c.t > 4.2) { c.step = 'order'; c.t = 0; }
          break;
        case 'order':
          if (c.t > 0.2) {
            c.step = 'order2'; c.t = 0;
            this.coachSay('order', 'Fill the order: ' + this.stageGoal + ' merges', 'Then the pond whirls, and fresh cakes tumble in');
            FC.UI.pulseStage();
          }
          break;
        case 'order2':
          if (c.t > 3.4) { c.step = 'wait'; c.t = 0; FC.UI.coachHide(); }
          break;
        case 'wait':
          if (this.shots >= 6 || this.nearRing()) {
            c.step = 'ring'; c.t = 0;
            this.ringPulse = 4.5;
            this.coachSay('ring', 'Keep the cakes in the calm water!', 'A cake resting in the current overflows the pond');
          }
          break;
        case 'ring':
          if (c.t > 3.8) { c.step = 'done'; c.t = 0; }
          break;
        case 'done':
          FC.UI.coachHide(); FC.store.set('coach', COACH_DONE); this.coach = null;
          break;
      }
    },

    // ------------------------------------------------------------
    // game over
    // ------------------------------------------------------------
    gameOver(culprit) {
      if (this.state !== 'playing') return;
      this.state = 'over';
      this.overT = 0;
      this.overPops = 0;
      this.culprit = culprit;
      this.cancelAim();
      this.wandMode = false;
      this.handT = -1;
      AU.gameOver();
      this.shake = 10;
      this.flash = 0.45; this.flashCol = '#ffd2e4';
      this.tilly.mood = 'sad'; this.tilly.moodT = 99;
      this.newBest = this.mode === 'endless' && this.score > this.best;
      if (this.newBest) { this.best = this.score; FC.store.set('best', this.best); }
      for (const b of this.world.bodies) { b.expr = 'sad'; b.exprT = 99; }
      FC.UI.onGameOver();
      this.setCursor();
    },

    updateOver(dt) {
      this.overT += dt;
      if (this.overT > 0.9) {
        const target = Math.floor((this.overT - 0.9) / 0.07);
        while (this.overPops < target) {
          const list = this.world.bodies.filter((b) => !b.dead);
          if (!list.length) break;
          list.sort((a, b) => Math.hypot(b.x, b.y) + b.r - (Math.hypot(a.x, a.y) + a.r));
          const b = list[0];
          b.dead = true;
          if (!b.sensor) {
            const T = spec(b.kind);
            FX.burst(b.x, b.y, { n: 14, colors: T.particle, speed: [200, 600], size: [8, 16], kinds: ['sprinkle', 'dot', 'star'], life: [0.5, 1.0], gravity: 700, up: 150 });
            AU.tone(300 + Math.random() * 200, 0.08, { type: 'triangle', vol: 0.06 });
          }
          this.overPops++;
        }
      }
      if (this.overT > 1.0 && !this.overShown && (this.world.count() === 0 || this.overT > 3.2)) {
        this.overShown = true;
        FC.UI.showOver({ score: this.score, best: this.best, newBest: this.newBest, maxTier: this.maxTier, maxKind: this.maxKind || null, merges: this.merges, combo: this.bestCombo, stage: this.stage, shots: this.shots, level: this.level });
      }
    },

    // ------------------------------------------------------------
    // per-frame update
    // ------------------------------------------------------------
    // the water: the calm pool (= the dotted ring) widens with every stage and turns a little faster,
    // the rim current races a little more, and the stage whirl adds a spin everywhere
    setWater(instant, dt) {
      const W = this.world;
      const k = this.state === 'title' ? 0.3 : FC.clamp((this.stage - 1) / 9, 0, 1);
      const mood = this.state === 'title' || !this.waterMod ? null : this.waterMod; // a level's water has a mood of its own
      const om = FC.lerp(CFG.OMEGA_MIN, CFG.OMEGA_MAX, k) * (mood ? mood.turn || 1 : 1);
      const vr = FC.lerp(CFG.VRIM_MIN, CFG.VRIM_MAX, k) * (mood ? mood.rim || 1 : 1);
      // the moon tide: the calm pool breathes in and out (it starts at mid water, rising). Frozen during the whirl and
      // after the bake, so the reshuffle and the lap of honour are not judged against a moving ring
      const tideAmp = mood && mood.tide && this.state !== 'title' ? mood.tide : 0;
      if (tideAmp && dt && this.state === 'playing' && !this.whirl && !this.won) this.tideT += dt;
      this.tide = tideAmp ? tideAmp * Math.sin((this.tideT / TIDE_PERIOD) * TAU) : 0;
      this.ringBase = this.state === 'title' ? CFG.DANGER : ringFor(Math.max(this.maxTier, this.ringTier || 0));
      this.tideAmp = tideAmp;
      const ring = this.state === 'title' ? CFG.DANGER : Math.min(CFG.DANGER, this.ringBase + this.tide);
      if (instant || !dt) { W.omegaCore = om; W.vRim = vr; this.ring = ring; }
      else {
        const kk = FC.damp(0.8, dt);
        W.omegaCore += (om - W.omegaCore) * kk;
        W.vRim += (vr - W.vRim) * kk;
        // the pool widens when a bigger cake is baked (and never shrinks under the player)
        if (ring > this.ring) this.ring = Math.min(ring, this.ring + 90 * dt);
        else if (ring < this.ring) this.ring = ring;
      }
      W.rCalm = this.ring;
      W.spin = this.whirl ? this.whirl.omega : 0;
      this.whirlPhase += (W.omegaCore + W.spin) * (dt || 0);
    },

    update(dt) {
      this.t += dt;
      S.update(dt);
      if (this.state !== 'paused') this.setWater(false, dt);
      const pdt = this.hitstop > 0 ? dt * 0.06 : dt;
      this.hitstop = Math.max(0, this.hitstop - dt);
      if (this.state === 'playing' || this.state === 'title' || this.state === 'over' || this.state === 'won') this.world.step(pdt);
      if (this.state !== 'paused') {
        this.updateBodies(dt);
        this.updateFoam(dt);
        FX.update(dt);
      }
      if (this.state === 'playing' && this.won) {
        this.updateWhirl(pdt);
        this.updateWon(dt);
      } else if (this.state === 'playing') {
        if (this.cool > 0) this.cool -= dt;
        if (this.aim.active) this.computeAim();
        this.updateWhirl(pdt); // runs on physics time, so hit-stops do not eat the spin
        this.updateStageDone(dt);
        if (!this.whirl) this.updateDanger(dt);
        this.updateCoach(dt);
        this.updatePending(dt);
        if (this.bubble) {
          this.bubble.life -= dt;
          if (this.bubble.life <= 0) { this.bubble.dead = true; FX.ring(this.bubble.x, this.bubble.y, 60, 140, '#ffffff', 0.4, 8); this.bubble = null; }
        }
      } else if (this.state === 'title') this.updateDemo(dt);
      else if (this.state === 'over') this.updateOver(dt);
      if (this.state !== 'paused') {
        if (this.fly) { this.fly.t += dt; if (this.fly.t >= FLY_TIME) this.fly = null; }
        if (this.launcher.pop < 1) this.launcher.pop = Math.min(1, this.launcher.pop + dt / 0.32);
        this.sling.snap = Math.max(0, this.sling.snap - dt * 3.2);
        this.grab += ((this.aim.active ? 1 : 0) - this.grab) * FC.damp(14, dt);
        if (this.aim.detent) this.aim.detent = Math.max(0, this.aim.detent - dt * 5);
        this.ringPulse = Math.max(0, this.ringPulse - dt);
      }
      if (this.state !== 'paused') this.updateDangerUI(dt);
      this.updateHint();
      this.placeTilly(false, dt);
      this.shake = Math.max(0, this.shake - dt * 30);
      this.flash = Math.max(0, this.flash - dt * 1.6);
    },

    updateBodies(dt) {
      const bodies = this.world.bodies;
      const sv = this.shotView();
      const look = sv ? sv.L : this.lastShot && !this.lastShot.dead && this.lastShot.speed() > 200 ? this.lastShot : null;
      for (const b of bodies) {
        if (b.dead) continue;
        b.sqv += (-260 * b.sq - 13 * b.sqv) * dt;
        b.sq += b.sqv * dt;
        b.sq = FC.clamp(b.sq, -0.3, 0.3);
        if (b.pop < 1) b.pop = Math.min(1, b.pop + dt / 0.45);
        b.blinkT -= dt;
        if (b.blinkT <= 0) { b.blink = 0.13; b.blinkT = FC.rand(1.8, 5); }
        if (b.blink > 0) b.blink -= dt;
        if (b.exprT > 0) { b.exprT -= dt; if (b.exprT <= 0) b.expr = null; }
        const sp = b.speed();
        if (b.launched && sp < 140) b.launched = false;
        if (b.gliding && b.age > 0.12) {
          this.world.feltFlow(b.x, b.y, sp, WTMP, b.r);
          if (Math.hypot(b.vx - WTMP.x, b.vy - WTMP.y) < 60) {
            b.gliding = false;
            if (this.state === 'playing') { AU.plip(b.tier); FX.ripple(b.x, b.y, b.r * 0.9, 0.45, 260); }
          }
        }
        let tx = 0, ty = 0.35;
        if (look && look !== b) {
          const dx = look.x - b.x, dy = look.y - b.y, d = Math.hypot(dx, dy) || 1;
          tx = dx / d; ty = (dy / d) * 0.8;
        }
        const k = FC.damp(6, dt);
        b.lookX += (tx - b.lookX) * k;
        b.lookY += (ty - b.lookY) * k;
        if (sp > 420 && !b.sensor) {
          b.wakeT -= dt;
          if (b.wakeT <= 0) { FX.ripple(b.x, b.y + b.r * 0.2, b.r * 0.85, 0.22, 140); b.wakeT = 0.1; }
        }
      }
    },

    // ------------------------------------------------------------
    // foam flecks and petals that ride the current – the water you can read
    // ------------------------------------------------------------
    buildFoam() {
      this.foam = [];
      for (let i = 0; i < FOAM_N; i++) this.foam.push(this.newFoam(true));
      this.streaks = [];
      for (let i = 0; i < STREAK_N; i++) this.streaks.push({ a: Math.random() * TAU, k: Math.random(), len: FC.rand(0.35, 0.7), ph: Math.random() * TAU });
    },
    newFoam(anywhere) {
      const W = this.world;
      const a = Math.random() * TAU;
      // most flecks ride the rim band, a few drift in the calm middle (they show the drain)
      const band = anywhere ? Math.random() < 0.75 : Math.random() < 0.85;
      const r0 = band ? FC.lerp(W.rCalm + 30, CFG.R - 40, Math.random()) : FC.lerp(CFG.INFLOW_CORE + 40, W.rCalm - 20, Math.random());
      const life = FC.rand(3.5, 7);
      // the world decides what rides the current (petals, leaves, stars …) and how much of it there is
      const fs = S.foamStyle ? S.foamStyle(S.theme) : null;
      const share = fs && fs.petalShare != null ? fs.petalShare : 0.4;
      return { x: Math.cos(a) * r0, y: Math.sin(a) * r0, t: anywhere ? Math.random() * life : 0, life, s: FC.rand(0.6, 1.3), petal: Math.random() < share, ph: Math.random() * TAU, vx: 0, vy: 0 };
    },
    updateFoam(dt) {
      if (!this.foam.length) return;
      const W = this.world;
      const F = WTMP;
      for (let i = 0; i < this.foam.length; i++) {
        const f = this.foam[i];
        f.t += dt;
        W.flowAt(f.x, f.y, F, 60);
        // petals are light: they follow the water fully, with a tiny wobble
        f.vx = F.x; f.vy = F.y;
        f.x += (F.x + Math.cos(f.ph + this.t * 3) * 12) * dt;
        f.y += (F.y + Math.sin(f.ph + this.t * 2.3) * 12) * dt;
        const d = Math.hypot(f.x, f.y);
        if (f.t > f.life || d < CFG.INFLOW_CORE * 0.9 || d > CFG.R - 20) this.foam[i] = this.newFoam(false);
      }
      if (this.foamPulse > 0) this.foamPulse -= dt;
      // the streaks sit in the band and turn with the water there
      for (const st of this.streaks) {
        const r = FC.lerp(W.rCalm + 50, CFG.R - 45, st.k);
        st.a += W.omegaAt(r) * dt;
      }
    },
    drawFoam(ctx) {
      if (!this.foam.length) return;
      // hook for the world's look: S.foamStyle(theme) -> { colors: [foam, petal colours…], petalShare, drawPetal(ctx, x, y, size, ang, col, alpha, i, t) }
      const fs = S.foamStyle ? S.foamStyle(S.theme) : null;
      const pal = (fs && fs.colors) || [['#ffffff', '#ffd6ea', '#ffb3d9'], ['#ffffff', '#ffe27a', '#8fe3ff'], ['#fff6c8', '#ffffff', '#d6e8ff'], ['#ffffff', '#ffb3c6', '#b5f0c8', '#c9c0ff']][S.theme % 4];
      const boost = this.foamPulse > 0 ? 1 + 0.6 * Math.min(1, this.foamPulse) : 1;
      const W = this.world;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(S.cx, S.cy, S.pr * 0.99, S.pr * S.K * 0.99, 0, 0, TAU);
      ctx.clip();
      const base = Math.max(1.6, S.pr * 0.011);
      // long streaks: the racing water of the rim band
      if (this.state !== 'title') {
        ctx.lineCap = 'round';
        for (const st of this.streaks) {
          const r = FC.lerp(W.rCalm + 50, CFG.R - 45, st.k) * S.s;
          const pulse = 0.55 + 0.45 * Math.sin(this.t * 1.3 + st.ph);
          ctx.beginPath();
          ctx.ellipse(S.cx, S.cy, r, r * S.K, 0, st.a, st.a + st.len);
          ctx.lineWidth = base * 1.1;
          ctx.strokeStyle = FC.rgba(pal[0], 0.22 * pulse * boost);
          ctx.stroke();
        }
      }
      for (let i = 0; i < this.foam.length; i++) {
        const f = this.foam[i];
        const k = Math.sin(Math.PI * Math.min(1, f.t / f.life));
        if (k <= 0.03) continue;
        const p = S.w2s(f.x, f.y);
        const sp = Math.hypot(f.vx, f.vy);
        const al = (0.22 + 0.5 * Math.min(1, sp / 450)) * k * boost;
        if (f.petal && fs && fs.drawPetal) {
          const ang = Math.atan2(f.vy * S.K, f.vx) + Math.sin(f.ph + this.t * 2) * 0.5;
          fs.drawPetal(ctx, p.x, p.y, base * f.s, ang, pal[1 + (i % (pal.length - 1))], Math.min(0.9, al + 0.15), i, this.t);
        } else if (f.petal) {
          // a little blossom petal, turned along the flow
          const ang = Math.atan2(f.vy * S.K, f.vx) + Math.sin(f.ph + this.t * 2) * 0.5;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(ang);
          ctx.beginPath();
          ctx.ellipse(0, 0, base * 2.2 * f.s, base * 1.3 * f.s, 0, 0, TAU);
          ctx.fillStyle = FC.rgba(pal[1 + (i % (pal.length - 1))], Math.min(0.9, al + 0.15));
          ctx.fill();
          ctx.restore();
        } else {
          // a foam fleck: stretched along the flow when the water is fast
          const len = Math.min(5, sp / 110);
          const ux = f.vx / (sp || 1), uy = (f.vy / (sp || 1)) * S.K;
          ctx.beginPath();
          ctx.moveTo(p.x - ux * base * len, p.y - uy * base * len);
          ctx.lineTo(p.x + ux * base * len, p.y + uy * base * len);
          ctx.lineWidth = base * 1.6 * f.s;
          ctx.lineCap = 'round';
          ctx.strokeStyle = FC.rgba(pal[0], al);
          ctx.stroke();
        }
      }
      ctx.restore();
    },

    updateDanger(dt) {
      let worst = null, max = 0;
      const W = this.world;
      for (const b of W.bodies) {
        if (b.dead || b.sensor) continue;
        const d = Math.hypot(b.x, b.y) || 1;
        const edge = d + b.r;
        // "at rest" is measured against the water: a cake riding the rim current beyond the ring counts
        // (it has to make it in), a cake still being carried inwards does not
        W.flowAt(b.x, b.y, WTMP, b.r);
        const rel = Math.hypot(b.vx - WTMP.x, b.vy - WTMP.y);
        const inward = -(b.x * b.vx + b.y * b.vy) / d; // > 0 while the current still carries it in
        if (edge > this.ring && b.age > 1.1 && rel < 420 && inward < 90) b.danger += dt;
        else b.danger = Math.max(0, b.danger - dt * 1.5);
        if (b.danger > max) { max = b.danger; worst = b; }
      }
      this.danger = max;
      this.dangerBody = worst;
      // the fuller the pond, the sooner it overflows: a cake stuck on a bump of a half-empty cluster gets more time
      // (the pool turns and the next flicks jostle it free) than one resting on a cluster that fills the pool
      const fill = this.poolFill();
      this.dangerLimit = CFG.DANGER_TIME + Math.max(0, 0.4 - fill) * 25;
      if (max > CFG.WARN_AT) {
        this.warnT -= dt;
        if (this.warnT <= 0) { AU.danger(); this.warnT = 0.9; }
        if (!this.dangerHinted && !this.coach && !this.wandMode) {
          this.dangerHinted = true;
          const n = FC.store.get('dangerTips', 0);
          if (n < 3) {
            FC.store.set('dangerTips', n + 1);
            const wand = this.wands > 0 ? ' – or use your Wand' : '';
            // a cake caught in the current with room to spare is not the same problem as a full pond
            if (this.poolFill() < 0.4) FC.UI.coach('Caught in the current!', 'A cake outside the ring overflows: merge it' + wand, { time: 3200 });
            else FC.UI.coach('Too full!', 'Merge cakes to make room' + wand, { time: 3200 });
          }
        }
        if (this.tilly.mood !== 'cheer') { this.tilly.mood = 'worried'; this.tilly.moodT = 0.3; }
      }
      FC.UI.setDanger(max > CFG.WARN_AT);
      if (max >= this.dangerLimit) this.gameOver(worst);
    },

    // title screen: Tilly plays by herself with the same sling the player uses
    updateDemo(dt) {
      const d = this.demo;
      if (d.phase === 'pull') {
        d.t += dt;
        if (d.t >= 0.8) {
          this.fireDemo(d);
          d.phase = 'wait';
          d.wait = 1.0 + Math.random() * 0.8;
        }
        return;
      }
      d.wait -= dt;
      if (d.wait > 0) return;
      const bodies = this.world.bodies.filter((b) => !b.dead && !b.sensor);
      let area = 0;
      for (const b of bodies) area += b.r * b.r;
      if (area > CFG.DANGER * CFG.DANGER * 0.36) {
        for (const b of bodies) {
          b.dead = true;
          FX.burst(b.x, b.y, { n: 8, colors: spec(b.kind).particle, speed: [200, 500], size: [8, 14], kinds: ['star', 'dot'], life: [0.4, 0.8], gravity: 400 });
        }
        d.wait = 1.0;
        return;
      }
      const tier = CK.tierOf(this.queue[0]);
      const r = TIERS[tier].r;
      const L = this.anchorW(tier);
      // look for a flick that hits a matching cake, like a player reading the preview
      const hits = [];
      for (let deg = -64; deg <= 64; deg += 4) {
        for (const p of [0.45, 0.65, 0.85]) {
          const ang = (deg * Math.PI) / 180;
          const sp = FC.Physics.speedForPower(p);
          const pr = this.world.predict(L.x, L.y, Math.sin(ang) * sp, -Math.cos(ang) * sp, r, tier, { maxT: 3, maxLen: 3000, spacing: 42 });
          if (this.predMatch(pr, tier)) hits.push({ ang, p, sp, pr });
        }
      }
      let shot = hits.length ? FC.pick(hits) : null;
      if (!shot) {
        const ang = (Math.random() - 0.5) * 0.9, p = 0.3 + Math.random() * 0.25;
        const sp = FC.Physics.speedForPower(p);
        shot = { ang, p, sp, pr: this.world.predict(L.x, L.y, Math.sin(ang) * sp, -Math.cos(ang) * sp, r, tier, { maxT: 3, maxLen: 3000, spacing: 42 }) };
      }
      d.phase = 'pull';
      d.t = 0;
      d.L = L;
      d.dir = { x: Math.sin(shot.ang), y: -Math.cos(shot.ang) };
      d.power = shot.p;
      d.speed = shot.sp;
      d.pred = shot.pr;
    },

    fireDemo(d) {
      const kind = this.queue.shift();
      this.queue.push(CK.kindFor(FC.randInt(1, 3)));
      const tier = CK.tierOf(kind);
      const r = TIERS[tier].r;
      const b = new Body(tier, r, d.L.x, d.L.y, kind);
      b.vx = d.dir.x * d.speed; b.vy = d.dir.y * d.speed;
      b.launched = true; b.expr = 'wee'; b.exprT = 0.5;
      this.world.add(b);
      this.lastShot = b;
      this.launcher.pop = 0;
      this.sling.snap = 1;
      this.tilly.flick = 1;
      FX.ripple(d.L.x, d.L.y, r * 0.8, 0.5, 400);
    },

    // the animated hand that demonstrates the pull-back gesture
    updateHint() {
      if (this.state !== 'playing' || this.queue[0] == null || this.handT < 0) {
        this.hint = null;
        if (FC.UI.handOver) FC.UI.setHandOver(false);
        return;
      }
      if (this.won) { this.hint = null; return; }
      const u = this.handT % HAND_CYCLE;
      let alpha = 0, pull = 0, press = 0;
      if (u < 0.3) { alpha = u / 0.3; }
      else if (u < 0.45) { alpha = 1; press = (u - 0.3) / 0.15; }
      else if (u < 1.35) { alpha = 1; press = 1; pull = easeInOut((u - 0.45) / 0.9); }
      else if (u < 1.75) { alpha = 1; press = 1; pull = 1; }
      else if (u < 2.05) { alpha = 1 - (u - 1.75) / 0.3; }
      const prev = this.hint && this.hint.kind === 'pull' ? this.hint.u : 0;
      if (prev < 1.75 && u >= 1.75) this.sling.snap = 1; // "let go": the ribbon twangs
      this.hint = { kind: 'pull', alpha, pull, press, u };
      // does the hand reach down into the Cake Book pill?
      const L = FC.UI.bookRect, g = this.slingGround();
      const s = FC.clamp(S.pr * 0.17, 26, 52);
      const handBottom = g.y + this.maxPull() * 0.7 + s * 1.5;
      FC.UI.setHandOver(!!L && alpha > 0.02 && handBottom > L.top && g.x + s > L.left && g.x - s < L.right);
    },

    // ------------------------------------------------------------
    // launcher, sling and Tilly
    // ------------------------------------------------------------
    // what the sling shows right now: the player's aim, the title demo or the tutorial hand
    shotView() {
      const kind = this.queue[0];
      if (kind == null) return null;
      const tier = CK.tierOf(kind);
      if (this.state === 'title') {
        const d = this.demo;
        if (d.phase !== 'pull') return null;
        const k = easeInOut(Math.min(1, d.t / 0.55));
        const pull = this.maxPull() * (0.15 + 0.35 * d.power) * k; // shorter than real, the title card sits below
        const sx = d.dir.x, sy = d.dir.y * S.K, sl = Math.hypot(sx, sy) || 1;
        return { L: d.L, dir: d.dir, power: d.power * k, pred: k > 0.5 ? d.pred : null, tier, kind, offX: -(sx / sl) * pull * 0.4, offY: -(sy / sl) * pull * 0.4, gripX: -(sx / sl) * pull, gripY: -(sy / sl) * pull, alpha: k };
      }
      const a = this.aim;
      if (a.active && a.valid) {
        return { L: a.L, dir: a.dir, power: a.power, pred: a.pred, tier, kind, offX: a.offX, offY: a.offY, gripX: a.gripX, gripY: a.gripY, alpha: 1 };
      }
      return null;
    },

    placeTilly(instant, dt) {
      const b = this.slingBase();
      const ts = this.tillySize();
      const t = this.tilly;
      if (t.moodT > 0 && dt) { t.moodT -= dt; if (t.moodT <= 0) t.mood = 'idle'; }
      const sv = this.shotView();
      if (sv && t.mood === 'idle') t.mood = 'aim';
      if (!sv && t.mood === 'aim') t.mood = 'idle';
      if (dt) t.flick = Math.max(0, t.flick - dt * 4);
      const dodge = sv ? Math.min(0, sv.offX) * 1.3 : 0; // step aside when the cake is pulled her way
      const tx = b.x - this.sling.w - ts * 1.25 - t.flick * ts * 0.25 + dodge;
      const ty = b.y - S.pr * 0.1 - ts * 0.2 + Math.sin(this.t * 2.2) * ts * 0.12;
      if (instant || !dt) { t.x = tx; t.y = ty; return; }
      const kk = FC.damp(10, dt);
      t.x += (tx - t.x) * kk;
      t.y += (ty - t.y) * kk;
    },

    tillySize() {
      return FC.clamp(S.pr * 0.085, 14, 34);
    },

    nextCenter() {
      const b = this.slingBase();
      const size = Math.round(FC.clamp(S.pr * 0.26, 46, 76));
      return { x: Math.min(b.x + Math.max(S.pr * 0.4, 80), S.W - size * 0.7), y: b.y + S.pr * 0.05, size };
    },

    // ------------------------------------------------------------
    // rendering
    // ------------------------------------------------------------
    render() {
      const ctx = this.ctx, dpr = this.dpr;
      const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
      const sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
      ctx.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'low';
      S.drawBack(ctx, this.t);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(S.cx, S.cy, S.pr, S.pr * S.K, 0, 0, TAU);
      ctx.clip();
      FX.drawWater(ctx, S);
      ctx.restore();
      const whirlK = this.whirl ? Math.min(1, this.whirl.omega / 1.2) : 0;
      this.drawPool(ctx);
      S.drawWaterFX(ctx, this.t, this.state === 'title' ? 0.6 : 1 + whirlK * 2.2, this.whirlPhase);
      this.drawFoam(ctx);
      if (S.drawWaterAmbient) S.drawWaterAmbient(ctx, this.t); // the world's touch on the water (reflections, floating leaves …), under the cakes
      if (this.state === 'playing' || this.state === 'paused' || this.state === 'won') this.drawDangerRing(ctx);
      this.drawShadows(ctx);
      const view = this.shotView();
      if (view) this.drawAimPath(ctx, view);
      else if (this.hint && this.hint.kind === 'pull') this.drawHintPath(ctx);
      this.drawBodies(ctx);
      S.drawFrontLayer(ctx);
      if (view) this.drawAimTop(ctx, view);
      this.grip = null;
      if (this.state === 'playing' || this.state === 'paused' || this.state === 'title' || this.state === 'won') this.drawLauncher(ctx, view);
      ctx.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);
      FX.drawTop(ctx, S, dpr);
      S.drawSea(ctx, this.t);
      S.drawSparkles(ctx);
      if (S.drawAmbientFront) S.drawAmbientFront(ctx, this.t); // the world's weather in front (falling leaves, petals, snow …)
      // pull line and tutorial hand stay above the cloud sea (short screens pull into it)
      this.drawGrip(ctx);
      if (this.hint) this.drawHand(ctx);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (this.danger > CFG.WARN_AT && this.state === 'playing') {
        const k = FC.clamp((this.danger - CFG.WARN_AT) / ((this.dangerLimit || CFG.DANGER_TIME) - CFG.WARN_AT), 0, 1);
        const pulse = 0.5 + 0.5 * Math.sin(this.t * (6 + k * 8));
        const g = ctx.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.35, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.75);
        g.addColorStop(0, 'rgba(255,60,120,0)');
        g.addColorStop(1, 'rgba(255,60,120,' + (0.12 + 0.25 * k * pulse).toFixed(3) + ')');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, this.W, this.H);
      }
      this.drawDangerTimer(ctx); // always on top of the pond, the cakes and the particles
      if (this.wandMode) {
        ctx.fillStyle = 'rgba(120,80,200,0.12)';
        ctx.fillRect(0, 0, this.W, this.H);
      }
      if (this.flash > 0) {
        ctx.fillStyle = FC.rgba(this.flashCol, Math.min(0.8, this.flash));
        ctx.fillRect(0, 0, this.W, this.H);
      }
    },

    // the calm pool: a touch lighter and glassier than the racing water round it
    drawPool(ctx) {
      if (this.state === 'title') return;
      const pr = this.ring * S.s, K = S.K;
      const g = ctx.createRadialGradient(S.cx, S.cy, pr * 0.55, S.cx, S.cy, pr * 1.02);
      g.addColorStop(0, 'rgba(255,255,255,0.1)');
      g.addColorStop(0.85, 'rgba(255,255,255,0.08)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(S.cx, S.cy, pr * 1.02, pr * K * 1.02, 0, 0, TAU);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    },

    drawDangerRing(ctx) {
      const pr = this.ring * S.s;
      const K = S.K;
      const k = FC.clamp(this.danger / (this.dangerLimit || CFG.DANGER_TIME), 0, 1);
      const rp = this.ringPulse > 0 ? 0.5 + 0.5 * Math.sin(this.ringPulse * 7) : 0;
      ctx.save();
      ctx.lineCap = 'round';
      if (rp > 0 || this.ringPulse > 0) {
        // tutorial: make the ring impossible to miss
        ctx.beginPath();
        ctx.ellipse(S.cx, S.cy, pr, pr * K, 0, 0, TAU);
        ctx.lineWidth = Math.max(6, S.pr * 0.05);
        ctx.strokeStyle = FC.rgba('#ff6fa8', 0.25 + 0.35 * rp);
        ctx.stroke();
      }
      const col = k > 0.1 ? FC.mix('#ffffff', '#ff4f86', Math.min(1, k * 1.6)) : this.ringPulse > 0 ? '#ffe0ef' : S.theme === 2 ? '#fff6c8' : '#ffffff';
      const alpha = 0.62 + (k > 0.1 ? 0.3 * (0.5 + 0.5 * Math.sin(this.t * 10)) : 0);
      // the moon tide: a faint line where the pool will shrink to at low water, so the breathing ring can be read
      if (this.tideAmp > 0 && this.state !== 'title') {
        const lo = Math.max(100, this.ringBase - this.tideAmp) * S.s;
        const low = this.tide < -this.tideAmp * 0.55;
        ctx.setLineDash([2, Math.max(5, lo * 0.035)]);
        ctx.lineDashOffset = -this.whirlPhase * lo * 0.9;
        ctx.beginPath();
        ctx.ellipse(S.cx, S.cy, lo, lo * K, 0, 0, TAU);
        ctx.lineWidth = Math.max(1.2, S.pr * 0.008);
        ctx.strokeStyle = FC.rgba(S.theme === 2 ? '#d8e4ff' : '#ffffff', low ? 0.5 : 0.28);
        ctx.stroke();
      }
      ctx.setLineDash([Math.max(4, pr * 0.03), Math.max(6, pr * 0.045)]);
      ctx.lineDashOffset = -this.whirlPhase * pr * 0.9 - this.t * 18;
      ctx.beginPath();
      ctx.ellipse(S.cx, S.cy, pr, pr * K, 0, 0, TAU);
      ctx.lineWidth = Math.max(1.8, S.pr * 0.013);
      ctx.strokeStyle = FC.rgba(col, alpha);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + this.t * 0.12 + this.whirlPhase;
        const x = S.cx + Math.cos(a) * pr, y = S.cy + Math.sin(a) * pr * K;
        const tw = 0.5 + 0.5 * Math.sin(this.t * 3 + i * 1.7);
        FC.sparklePath(ctx, x, y, (2 + tw * 3) * (S.pr / 300 + 0.5), 0.3);
        ctx.fillStyle = FC.rgba(col, 0.5 + tw * 0.4);
        ctx.fill();
      }
      for (const b of this.world.bodies) {
        if (b.dead || b.sensor) continue;
        const d = Math.hypot(b.x, b.y);
        const edge = d + b.r;
        if (edge < this.ring - 60 || b.age < 1.1) continue;
        const a = Math.atan2(b.y, b.x);
        const intensity = FC.clamp((edge - (this.ring - 60)) / 90, 0, 1) * (b.danger > 0 ? 1 : 0.5);
        const span = (b.r / this.ring) * 1.2;
        ctx.beginPath();
        ctx.ellipse(S.cx, S.cy, pr, pr * K, 0, a - span, a + span);
        ctx.lineWidth = Math.max(3, S.pr * 0.03);
        ctx.strokeStyle = FC.rgba(b.danger > CFG.WARN_AT ? '#ff4f86' : '#ffd1e4', 0.35 + 0.45 * intensity);
        ctx.stroke();
      }
      ctx.restore();
      // the cake in danger: a pulsing red halo on the water round its foot (under the cake – the stopwatch above it
      // is drawn last, on top of everything, see drawDangerTimer)
      const db = this.dangerBody;
      if (db && this.danger > CFG.WARN_AT && !db.dead) {
        const p = S.w2s(db.x, db.y);
        const r = db.r * S.s;
        const kk = FC.clamp((this.danger - CFG.WARN_AT) / ((this.dangerLimit || CFG.DANGER_TIME) - CFG.WARN_AT), 0, 1);
        const pulse = 0.5 + 0.5 * Math.sin(this.t * (8 + kk * 10));
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + r * 0.05, r * (1.18 + 0.08 * pulse), r * S.K * (0.74 + 0.05 * pulse), 0, 0, TAU);
        ctx.lineWidth = Math.max(3, r * 0.12);
        ctx.strokeStyle = FC.rgba('#ff3f7a', 0.45 + 0.4 * pulse);
        ctx.stroke();
        ctx.restore();
      }
    },

    // The overflow countdown: a big stopwatch over the cake that is about to overflow the pond. It is drawn after
    // everything else on the canvas (cakes, the front bank, particles, the cloud sea), eases after its cake, stays on
    // screen and clear of the HUD, and points at the cake with a little tail. The ring of the watch runs down with the
    // time that is left; the last two seconds shake.
    updateDangerUI(dt) {
      const u = this.dangerUI;
      const db = this.dangerBody;
      const on = this.state === 'playing' && !this.won && !this.whirl && db && !db.dead && this.danger > CFG.WARN_AT;
      u.a += ((on ? 1 : 0) - u.a) * FC.damp(on ? 14 : 9, dt);
      if (u.a < 0.01 && !on) { u.body = null; u.n = -1; return; }
      if (!on) return; // fading out where it is
      const R = this.dangerRadius();
      const p = S.w2s(db.x, db.y);
      const rr = db.r * S.s;
      const ext = (CK.EXTENT && CK.EXTENT[spec(db.kind).style]) || { top: 1.6 };
      const cakeTop = p.y - rr * (0.45 + ext.top);
      const topSafe = FC.UI && FC.UI.hudBottom ? FC.UI.hudBottom() + 8 : 90;
      let x = FC.clamp(p.x, R + 10, this.W - R - 10);
      let y = cakeTop - R * 1.25;
      u.below = false;
      if (y - R < topSafe) { y = Math.max(y, topSafe + R); if (y + R > cakeTop + rr * 0.6) { u.below = true; y = p.y + rr * 0.6 + R * 1.3; } }
      y = FC.clamp(y, topSafe + R, this.H - R - 10);
      u.tx = p.x; u.ty = u.below ? p.y + rr * 0.3 : cakeTop + rr * 0.2; // where the tail points
      if (u.body !== db || u.a < 0.05) { u.x = x; u.y = y; u.body = db; u.k = 0.3; }
      else { const kk = FC.damp(12, dt); u.x += (x - u.x) * kk; u.y += (y - u.y) * kk; }
      u.k += (1 - u.k) * FC.damp(10, dt);
      const left = Math.max(0, (this.dangerLimit || CFG.DANGER_TIME) - this.danger);
      const n = Math.ceil(left);
      if (n !== u.n) { if (u.n >= 0 && n < u.n) u.bump = 1; u.n = n; }
      u.bump = Math.max(0, u.bump - dt * 3.5);
      u.left = left;
      u.frac = FC.clamp(left / Math.max(0.1, (this.dangerLimit || CFG.DANGER_TIME) - CFG.WARN_AT), 0, 1);
    },
    dangerRadius() {
      return FC.clamp(S.pr * 0.085, 24, 40);
    },
    drawDangerTimer(ctx) {
      const u = this.dangerUI;
      if (u.a < 0.02 || u.n < 0) return;
      const R = this.dangerRadius();
      const urgent = u.left < 2;
      const shake = urgent ? Math.sin(this.t * 60) * R * 0.05 : 0;
      const pulse = 1 + 0.06 * Math.sin(this.t * (urgent ? 18 : 10)) + 0.22 * u.bump;
      const x = u.x + shake, y = u.y;
      ctx.save();
      ctx.globalAlpha = u.a;
      // the tail towards the cake
      const ang = Math.atan2(u.ty - y, u.tx - x);
      const tl = Math.min(R * 0.9, Math.max(0, Math.hypot(u.tx - x, u.ty - y) - R * 0.6));
      if (tl > 2) {
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(ang - 0.42) * R * 0.86, y + Math.sin(ang - 0.42) * R * 0.86);
        ctx.lineTo(x + Math.cos(ang) * (R * 0.86 + tl), y + Math.sin(ang) * (R * 0.86 + tl));
        ctx.lineTo(x + Math.cos(ang + 0.42) * R * 0.86, y + Math.sin(ang + 0.42) * R * 0.86);
        ctx.closePath();
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#c4285f';
        ctx.stroke();
      }
      ctx.translate(x, y);
      ctx.scale(pulse * u.k, pulse * u.k);
      // soft shadow
      ctx.beginPath();
      ctx.ellipse(0, R * 0.95, R * 0.8, R * 0.2, 0, 0, TAU);
      ctx.fillStyle = 'rgba(80,20,50,0.25)';
      ctx.fill();
      // crown and side buttons of the stopwatch
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#c4285f';
      ctx.lineWidth = 2;
      FC.roundRect(ctx, -R * 0.2, -R * 1.32, R * 0.4, R * 0.3, R * 0.08); ctx.fill(); ctx.stroke();
      FC.roundRect(ctx, -R * 0.12, -R * 1.12, R * 0.24, R * 0.2, R * 0.04); ctx.fill(); ctx.stroke();
      for (const sx of [-1, 1]) {
        ctx.save();
        ctx.rotate(sx * 0.75);
        FC.roundRect(ctx, -R * 0.11, -R * 1.18, R * 0.22, R * 0.24, R * 0.06); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      // the face
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, TAU);
      const g = ctx.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R);
      g.addColorStop(0, urgent ? '#ff8aa8' : '#ff9cb8');
      g.addColorStop(1, urgent ? '#e3124f' : '#ff3f7a');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = Math.max(3, R * 0.13);
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#c4285f';
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.07, 0, TAU);
      ctx.stroke();
      // the time that is left: a bright arc that runs down
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.74, -Math.PI / 2, -Math.PI / 2 + TAU * u.frac);
      ctx.lineWidth = R * 0.17;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.74, -Math.PI / 2 + TAU * u.frac, -Math.PI / 2 + TAU);
      ctx.strokeStyle = 'rgba(120,0,40,0.25)';
      ctx.stroke();
      // seconds left
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 ' + Math.round(R * 0.95) + 'px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, R * 0.12);
      ctx.strokeStyle = '#b0154a';
      ctx.lineJoin = 'round';
      ctx.strokeText(String(Math.max(1, u.n)), 0, R * 0.05);
      ctx.fillText(String(Math.max(1, u.n)), 0, R * 0.05);
      ctx.restore();
    },

    drawShadows(ctx) {
      const K = S.K;
      ctx.fillStyle = 'rgba(12,58,96,0.26)';
      ctx.beginPath();
      for (const b of this.world.bodies) {
        if (b.dead || b.sensor || b.pop <= 0) continue;
        const p = S.w2s(b.x, b.y);
        const r = b.r * S.s * this.popScale(b);
        ctx.moveTo(p.x + r * 1.08 + r * 0.06, p.y + r * 0.1);
        ctx.ellipse(p.x + r * 0.06, p.y + r * 0.1, r * 1.08, r * K * 0.62, 0, 0, TAU);
      }
      ctx.fill();
    },

    popScale(b) {
      if (b.pop >= 1) return 1;
      if (b.pop <= 0) return 0.001;
      const e = FC.ease.outElastic(b.pop);
      return 0.55 + 0.45 * e;
    },

    drawBodies(ctx) {
      const dpr = this.dpr;
      const list = this.world.bodies.filter((b) => !b.dead && b.pop > 0);
      list.sort((a, b) => a.y - b.y);
      for (const b of list) {
        if (b.sensor) { this.drawBubble(ctx, b); continue; }
        this.drawTrail(ctx, b);
        this.drawCake(ctx, b.kind, b.x, b.y, b.r, b, dpr);
      }
    },

    // a soft streak behind fast cakes – speed you can see
    drawTrail(ctx, b) {
      const sp = b.speed();
      if (sp < 650) return;
      const k = Math.min(1, (sp - 650) / 1800);
      const p = S.w2s(b.x, b.y), q = S.w2s(b.x - b.vx * 0.085, b.y - b.vy * 0.085);
      const rr = b.r * S.s, yy = -rr * 0.38;
      const g = ctx.createLinearGradient(q.x, q.y + yy, p.x, p.y + yy);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(255,255,255,' + (0.5 * k).toFixed(3) + ')');
      ctx.strokeStyle = g;
      ctx.lineWidth = rr * 1.25;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(q.x, q.y + yy);
      ctx.lineTo(p.x, p.y + yy);
      ctx.stroke();
    },

    // draw one cake (a kind) at world (x, y) with physics radius r
    drawCake(ctx, kind, x, y, r, b, dpr, scrX, scrY) {
      const tier = CK.tierOf(kind);
      const T = TIERS[tier];
      const rare = isRare(kind);
      const p = scrX != null ? { x: scrX, y: scrY } : S.w2s(x, y);
      const base = T.r * S.s;
      let sc = (r / T.r) * (b ? this.popScale(b) : 1);
      sc *= 1 + 0.012 * Math.sin(this.t * 2.2 + (b ? b.phase : 0));
      const rr = base * sc;
      const oy = p.y - rr * 0.45;
      if (tier === 0 || tier === MAX_T || rare) {
        const pulse = 0.85 + 0.15 * Math.sin(this.t * 3);
        const g = ctx.createRadialGradient(p.x, oy - rr * 0.2, rr * 0.3, p.x, oy - rr * 0.2, rr * 2.1 * pulse);
        g.addColorStop(0, tier === 0 ? 'rgba(255,255,255,0.55)' : 'rgba(255,240,170,0.55)');
        g.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, oy - rr * 0.2, rr * 2.1 * pulse, 0, TAU);
        ctx.fill();
      }
      const sp = CK.sprite(kind, base * dpr);
      const sq = b ? b.sq : 0;
      const ang = b ? b.sqa : 0;
      ctx.save();
      ctx.translate(p.x, oy);
      if (sq) {
        ctx.rotate(ang);
        ctx.scale(1 - sq, 1 + sq * 0.7);
        ctx.rotate(-ang);
      }
      ctx.scale(sc, sc);
      ctx.drawImage(sp.canvas, -sp.cx / dpr, -sp.cy / dpr, sp.canvas.width / dpr, sp.canvas.height / dpr);
      ctx.scale(base, base);
      let expr = b ? b.expr : null;
      if (b && !expr) {
        if (b.launched && b.speed() > 500) expr = 'wee';
        else if (b.danger > 0.15 || (Math.hypot(b.x, b.y) + b.r > this.ring && b.age > 1.1)) expr = 'worried';
      }
      CK.drawFace(ctx, kind, { expr: expr || 'normal', blink: b ? b.blink : 0, lookX: b ? b.lookX : 0, lookY: b ? b.lookY : 0.3 });
      ctx.restore();
      if (tier === 0 || rare) {
        for (let i = 0; i < 3; i++) {
          const a = this.t * 2 + (i * TAU) / 3;
          FC.sparklePath(ctx, p.x + Math.cos(a) * rr * 1.25, oy - rr * 0.3 + Math.sin(a) * rr * 0.6, rr * 0.16, 0.3);
          ctx.fillStyle = rare ? ['#ffe27a', '#ffffff', '#ffd34d'][i] : ['#ff9fd0', '#ffe27a', '#9ec5ff'][i];
          ctx.fill();
        }
      }
    },

    drawBubble(ctx, b) {
      const p = S.w2s(b.x, b.y);
      const life = b.life == null ? 10 : b.life;
      const appear = this.popScale(b);
      const fade = FC.clamp(life / 2, 0, 1);
      const r = b.r * S.s * appear * (1 + 0.04 * Math.sin(this.t * 3));
      const y = p.y - r * 0.9 + Math.sin(this.t * 2) * r * 0.08;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + r * 0.1, r * 0.8, r * 0.8 * S.K * 0.5, 0, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fill();
      const g = ctx.createRadialGradient(p.x - r * 0.3, y - r * 0.35, r * 0.1, p.x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.65)');
      g.addColorStop(0.6, 'rgba(220,240,255,0.25)');
      g.addColorStop(1, 'rgba(255,200,240,0.55)');
      ctx.beginPath();
      ctx.arc(p.x, y, r, 0, TAU);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = Math.max(1.5, r * 0.06);
      const sg = ctx.createLinearGradient(p.x - r, y - r, p.x + r, y + r);
      sg.addColorStop(0, 'rgba(255,170,220,0.9)'); sg.addColorStop(0.5, 'rgba(170,230,255,0.9)'); sg.addColorStop(1, 'rgba(210,180,255,0.9)');
      ctx.strokeStyle = sg;
      ctx.stroke();
      const s = r * 0.42;
      ctx.translate(p.x, y + Math.sin(this.t * 2.6) * r * 0.05);
      FC.roundRect(ctx, -s, -s * 0.7, s * 2, s * 1.6, s * 0.25);
      ctx.fillStyle = '#ff8fc4';
      ctx.fill();
      ctx.fillStyle = '#ffe27a';
      ctx.fillRect(-s * 0.18, -s * 0.7, s * 0.36, s * 1.6);
      ctx.fillRect(-s, -s * 0.05, s * 2, s * 0.3);
      ctx.beginPath();
      ctx.ellipse(-s * 0.35, -s * 0.85, s * 0.38, s * 0.22, -0.4, 0, TAU);
      ctx.ellipse(s * 0.35, -s * 0.85, s * 0.38, s * 0.22, 0.4, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.ellipse(p.x - r * 0.38, y - r * 0.42, r * 0.24, r * 0.12, -0.6, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,' + (0.8 * fade).toFixed(2) + ')';
      ctx.fill();
    },

    drawAimPath(ctx, v) {
      const pred = v.pred;
      if (!pred) return;
      const pts = pred.pts;
      const match = this.predMatch(pred, v.tier);
      const col = match ? '#ff6fa8' : '#ffffff';
      const n = pts.length;
      const rad = Math.max(2.4, S.pr * 0.015);
      for (let i = 1; i < n; i++) {
        const pt = pts[i];
        const q = S.w2s(pt.x, pt.y);
        const f = i / n;
        const drift = !!pt.drift;
        // after the landing the current carries the cake on: smaller, calmer dots
        const al = (drift ? 0.5 : 0.95 - f * 0.55) * v.alpha;
        const wave = drift ? 1 + 0.25 * Math.max(0, Math.sin(i * 0.75 - this.t * 4)) : 1 + 0.4 * Math.max(0, Math.sin(i * 0.75 - this.t * 10));
        ctx.beginPath();
        ctx.arc(q.x, q.y, rad * (drift ? 0.55 : 1 - f * 0.35) * wave, 0, TAU);
        ctx.fillStyle = FC.rgba(col, al);
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = FC.rgba(match ? '#ffffff' : '#7f6ad0', al * 0.6);
        ctx.stroke();
      }
    },

    // a heart over cakes that will merge
    drawHeart(ctx, x, y, s, phase) {
      const ss = s * (1 + 0.12 * Math.sin(this.t * 10 + (phase || 0)));
      FC.heartPath(ctx, x, y, ss);
      ctx.fillStyle = '#ff6fa8';
      ctx.fill();
      ctx.lineWidth = Math.max(1.5, ss * 0.18);
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    },

    drawAimTop(ctx, v) {
      const pred = v.pred;
      const tier = v.tier;
      const r = TIERS[tier].r;
      ctx.save();
      ctx.globalAlpha = v.alpha;
      if (pred && pred.hit) {
        const h = pred.hit;
        const q = S.w2s(h.x, h.y);
        const rr = r * S.s;
        const match = this.predMatch(pred, tier);
        // the ghost at the point of contact
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, rr, rr * S.K, 0, 0, TAU);
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = match ? 'rgba(255,111,168,0.95)' : 'rgba(255,255,255,0.85)';
        ctx.stroke();
        ctx.setLineDash([]);
        const hp = S.w2s(h.bx != null ? h.bx : h.body.x, h.by != null ? h.by : h.body.y);
        if (match) {
          const hr = h.body.r * S.s;
          const s = Math.max(10, rr * 0.55);
          this.drawHeart(ctx, (q.x + hp.x) / 2, (q.y + hp.y) / 2 - hr * 1.3, s, 0);
        } else if (!h.body.sensor) {
          // no match: a short arrow along the line of centres – the direction the hit cake is pushed in.
          // How far it goes, and what that sets off, is for the player to judge
          const dx = hp.x - q.x, dy = hp.y - q.y, d = Math.hypot(dx, dy) || 1;
          const len = Math.max(14, rr * 0.9) * (0.4 + v.power);
          const x0 = hp.x + (dx / d) * h.body.r * S.s * 0.3, y0 = hp.y + (dy / d) * h.body.r * S.s * 0.3;
          const ex = hp.x + (dx / d) * len, ey = hp.y + (dy / d) * len;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(ex, ey);
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      } else if (pred && pred.end) {
        // nothing in the way: a dashed ghost where the cake comes to rest
        const q = S.w2s(pred.end.x, pred.end.y);
        const rr = r * S.s;
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, rr, rr * S.K, 0, 0, TAU);
        ctx.setLineDash([4, 6]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    },

    // ghost dots of the tutorial hand: "this is where it will go"
    drawHintPath(ctx) {
      const h = this.hint;
      if (!h || h.kind !== 'pull' || h.pull <= 0.05) return;
      const g = this.slingGround();
      const rr = kr(this.queue[0]) * S.s;
      const step = S.pr * 0.075;
      const n = Math.round(4 + 6 * h.pull);
      const rad = Math.max(2.4, S.pr * 0.015);
      for (let i = 1; i <= n; i++) {
        const y = g.y - rr * 0.45 - rr - i * step;
        const al = h.alpha * h.pull * (0.9 - (i / n) * 0.5);
        ctx.beginPath();
        ctx.arc(g.x, y, rad, 0, TAU);
        ctx.fillStyle = FC.rgba('#ffffff', al);
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = FC.rgba('#7f6ad0', al * 0.6);
        ctx.stroke();
      }
    },

    drawLauncher(ctx, view) {
      const kind = this.queue[0];
      if (kind == null) return;
      const r = kr(kind);
      const rr = r * S.s;
      const g = this.slingGround();
      const base = this.slingBase();
      // sling width follows the cake size
      const wT = Math.max(rr + S.pr * 0.07, S.pr * 0.15);
      this.sling.w = this.sling.w ? this.sling.w + (wT - this.sling.w) * 0.25 : wT;
      let offX = 0, offY = 0, gripX = 0, gripY = 0;
      const pullHint = this.hint && this.hint.kind === 'pull' ? this.hint : null;
      if (view) { offX = view.offX; offY = view.offY; gripX = view.gripX || 0; gripY = view.gripY || 0; }
      else if (pullHint) { gripY = this.maxPull() * 0.7 * pullHint.pull; offY = gripY * 0.5; }
      let x = g.x + offX, y = g.y + offY, sc = 1;
      let flying = false;
      if (this.fly && this.state === 'playing') {
        const k = FC.clamp(this.fly.t / FLY_TIME, 0, 1), e = FC.ease.outCubic(k);
        const f = this.nextCenter();
        x = FC.lerp(f.x, g.x, e);
        y = FC.lerp(f.y + f.size * 0.18, g.y, e) - Math.sin(k * Math.PI) * S.pr * 0.1;
        sc = FC.lerp(0.55, 1, e);
        flying = k < 1;
      }
      const pop = this.launcher.pop < 1 ? 0.3 + 0.7 * FC.ease.outBack(this.launcher.pop) : 1;
      sc *= pop * (1 + 0.07 * this.grab); // the cake "lifts" a little when you grab it
      const tension = view ? view.power : pullHint ? 0.6 * pullHint.pull : 0;
      if (tension > 0.97) { x += Math.sin(this.t * 95) * 0.9; y += Math.cos(this.t * 83) * 0.6; } // trembling at full power
      this.grip = null;
      if (Math.hypot(gripX, gripY) > 6 && !flying) this.grip = { x0: g.x + offX, y0: g.y + offY - rr * 0.45, x1: g.x + gripX, y1: g.y - rr * 0.45 + gripY };
      // ribbon & posts
      this.drawSling(ctx, base, rr * sc, flying ? null : { x, y }, { x: offX, y: offY }, tension);
      // Tilly behind the sling
      const ts = this.tillySize();
      const tl = this.tilly;
      FC.Scene.drawTilly(ctx, tl.x, tl.y, ts, this.t, tl.mood, this.tillyFace(view));
      // the cake
      const hover = !view && !flying ? Math.sin(this.t * 3) * rr * 0.05 : 0;
      ctx.beginPath();
      ctx.ellipse(x, y + rr * 0.12, rr * 0.9 * sc, rr * S.K * 0.45 * sc, 0, 0, TAU);
      ctx.fillStyle = 'rgba(30,40,80,0.22)';
      ctx.fill();
      // soft glow so the eye finds the cake to play with
      if (!view && !flying && this.state === 'playing') {
        const pulse = 0.5 + 0.5 * Math.sin(this.t * 3.2);
        const gg = ctx.createRadialGradient(x, y - rr * 0.45, rr * 0.4, x, y - rr * 0.45, rr * (1.9 + 0.25 * pulse));
        gg.addColorStop(0, 'rgba(255,255,255,0.5)');
        gg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.arc(x, y - rr * 0.45, rr * (1.9 + 0.25 * pulse), 0, TAU);
        ctx.fill();
      }
      const fake = { sq: 0, sqa: 0, phase: 0, expr: view ? 'normal' : null, blink: 0, lookX: 0, lookY: -0.4, pop: 1, launched: false, danger: 0, x: 0, y: 0, r, age: 0, speed: () => 0 };
      if (view) { fake.sq = 0.13 * view.power; fake.sqa = Math.atan2(view.dir.y * S.K, view.dir.x); fake.lookX = view.dir.x; fake.lookY = view.dir.y; } // squeezed by the band
      this.drawCake(ctx, kind, 0, 0, r * sc, fake, this.dpr, x, y - hover);
      // power ring with 4 notches; it flashes on every detent
      if (view && view.power > 0) {
        const pw = view.power, det = this.aim.detent || 0;
        const R = Math.max(rr * 1.45, S.pr * 0.075), cy0 = y - rr * 0.45;
        ctx.save();
        ctx.globalAlpha = view.alpha;
        ctx.beginPath();
        ctx.arc(x, cy0, R, 0, TAU);
        ctx.lineWidth = Math.max(3, S.pr * 0.02);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, cy0, R, -Math.PI / 2, -Math.PI / 2 + pw * TAU);
        ctx.lineWidth = Math.max(3, S.pr * 0.022) * (1 + 0.7 * det);
        ctx.lineCap = 'round';
        ctx.strokeStyle = pw < 0.5 ? '#8fe3c3' : pw < 0.99 ? '#ffd166' : '#ff6fa8';
        ctx.stroke();
        for (let i = 1; i < 4; i++) {
          const a = -Math.PI / 2 + (i / 4) * TAU;
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * R, cy0 + Math.sin(a) * R, Math.max(1.5, S.pr * 0.009), 0, TAU);
          ctx.fillStyle = pw * 4 >= i ? '#ffffff' : 'rgba(255,255,255,0.5)';
          ctx.fill();
        }
        if (pw >= 0.99) {
          const g2 = ctx.createRadialGradient(x, cy0, R * 0.6, x, cy0, R * 1.5);
          g2.addColorStop(0, 'rgba(255,111,168,0)');
          g2.addColorStop(0.6, 'rgba(255,111,168,' + (0.18 + 0.12 * Math.sin(this.t * 14)).toFixed(3) + ')');
          g2.addColorStop(1, 'rgba(255,111,168,0)');
          ctx.fillStyle = g2;
          ctx.beginPath();
          ctx.arc(x, cy0, R * 1.5, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }
    },

    // the pull: a stretchy dotted line from the cake to where the finger is pulling
    drawGrip(ctx) {
      const gp = this.grip;
      if (!gp) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.setLineDash([2, Math.max(5, S.pr * 0.03)]);
      ctx.lineWidth = Math.max(3, S.pr * 0.02);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.moveTo(gp.x0, gp.y0);
      ctx.lineTo(gp.x1, gp.y1);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(gp.x1, gp.y1, Math.max(5, S.pr * 0.03), 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(143,107,230,0.8)';
      ctx.stroke();
      ctx.restore();
    },

    // two candy posts with a ribbon; the ribbon wraps behind the cake
    drawSling(ctx, base, rr, cake, off, tension) {
      const w = this.sling.w;
      const pw = Math.max(4.5, S.pr * 0.027);
      const top = base.y - S.pr * 0.1;
      const bot = base.y + S.pr * 0.05;
      const lx = base.x - w, rx = base.x + w;
      // ribbon: wraps around the back of the cake (the side facing the player / the pull)
      let px, py;
      if (cake) {
        const nx = off.x, ny = off.y + rr * 0.6;
        const nl = Math.hypot(nx, ny) || 1;
        px = cake.x + (nx / nl) * rr * 0.85;
        py = cake.y - rr * 0.45 + (ny / nl) * rr * 0.85;
      } else {
        px = base.x; py = top + S.pr * 0.03;
      }
      // after the release the ribbon twangs forward and wobbles out
      const snap = this.sling.snap;
      if (snap > 0 && !tension) py -= Math.sin((1 - snap) * Math.PI * 3.2) * snap * S.pr * 0.1;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const lw = Math.max(3.2, S.pr * 0.022) * (1 - tension * 0.35);
      ctx.beginPath();
      ctx.moveTo(lx, top);
      ctx.quadraticCurveTo((lx + px) / 2, (top + py) / 2 + S.pr * 0.01, px, py);
      ctx.quadraticCurveTo((rx + px) / 2, (top + py) / 2 + S.pr * 0.01, rx, top);
      ctx.lineWidth = lw + 2.4;
      ctx.strokeStyle = '#c4588f';
      ctx.stroke();
      ctx.lineWidth = lw;
      ctx.strokeStyle = FC.mix('#ffa8cf', '#ff4f9a', Math.min(1, tension));
      ctx.stroke();
      ctx.lineWidth = Math.max(1, lw * 0.3);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.stroke();
      // posts
      for (const x of [lx, rx]) {
        ctx.beginPath();
        FC.roundRect(ctx, x - pw / 2, top, pw, bot - top, pw / 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = '#ff8fc4';
        ctx.lineWidth = pw * 0.55;
        for (let yy = top - pw; yy < bot + pw; yy += pw * 1.3) {
          ctx.beginPath();
          ctx.moveTo(x - pw, yy + pw);
          ctx.lineTo(x + pw, yy - pw * 0.2);
          ctx.stroke();
        }
        ctx.restore();
        ctx.beginPath();
        FC.roundRect(ctx, x - pw / 2, top, pw, bot - top, pw / 2);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#c4588f';
        ctx.stroke();
        const kr = pw * 0.95;
        const kg = ctx.createRadialGradient(x - kr * 0.35, top - kr * 0.4, kr * 0.1, x, top, kr);
        kg.addColorStop(0, '#ffd6ea');
        kg.addColorStop(1, '#ff6fa8');
        ctx.beginPath();
        ctx.arc(x, top, kr, 0, TAU);
        ctx.fillStyle = kg;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#c4588f';
        ctx.stroke();
      }
      ctx.restore();
    },

    // cartoon hand demonstrating "press on the cake, pull back, let go"
    drawHand(ctx) {
      const h = this.hint;
      if (!h || h.alpha <= 0.01) return;
      const s = FC.clamp(S.pr * 0.17, 26, 52);
      const g = this.slingGround();
      const rr = kr(this.queue[0]) * S.s;
      const pullY = this.maxPull() * 0.7 * h.pull;
      const fx = g.x + rr * 0.15;
      const fy = g.y - rr * 0.45 + pullY + (1 - h.press) * s * 0.18;
      ctx.save();
      ctx.globalAlpha = h.alpha;
      if (h.press > 0.5 && h.pull < 0.05) {
        ctx.beginPath();
        ctx.arc(fx, fy, s * 0.25 + h.press * s * 0.1, 0, TAU);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.stroke();
      }
      ctx.translate(fx, fy);
      ctx.rotate(-0.25);
      const sc = 1 - h.press * 0.08;
      ctx.scale(sc, sc);
      const u = s;
      const rrect = (c, x, y, w, hh, r) => {
        c.moveTo(x + r, y);
        c.arcTo(x + w, y, x + w, y + hh, r);
        c.arcTo(x + w, y + hh, x, y + hh, r);
        c.arcTo(x, y + hh, x, y, r);
        c.arcTo(x, y, x + w, y, r);
        c.closePath();
      };
      const shapes = (c) => {
        c.beginPath();
        rrect(c, -0.16 * u, 0, 0.32 * u, 0.95 * u, 0.16 * u); // index finger
        rrect(c, -0.2 * u, 0.55 * u, 0.88 * u, 0.85 * u, 0.3 * u); // palm
        c.moveTo(0.36 * u + 0.15 * u, 0.62 * u);
        c.arc(0.36 * u, 0.62 * u, 0.15 * u, 0, TAU);
        c.moveTo(0.56 * u + 0.14 * u, 0.68 * u);
        c.arc(0.56 * u, 0.68 * u, 0.14 * u, 0, TAU);
        c.moveTo(-0.2 * u, 0.95 * u);
        c.ellipse(-0.27 * u, 0.88 * u, 0.13 * u, 0.24 * u, -0.5, 0, TAU); // thumb
      };
      ctx.shadowColor = 'rgba(90,40,90,0.35)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;
      shapes(ctx);
      ctx.lineWidth = u * 0.16;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#7a3f6b';
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      shapes(ctx);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-0.08 * u, 0.22 * u);
      ctx.lineTo(0.08 * u, 0.22 * u);
      ctx.lineWidth = u * 0.05;
      ctx.strokeStyle = '#e8c9de';
      ctx.stroke();
      ctx.restore();
    },

    tillyFace(view) {
      if (view) return { x: view.dir.x, y: view.dir.y };
      return { x: 0.3, y: -0.5 };
    },

    // ------------------------------------------------------------
    loop(ts) {
      const now = ts / 1000;
      const dt = Math.min(0.05, Math.max(0, now - (this.last || now)));
      this.last = now;
      this.update(dt);
      this.render();
      requestAnimationFrame((t) => this.loop(t));
    },
  };

  FC.Game = Game;
})();
