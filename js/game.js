/* Fairycake Falls – game logic, input and rendering.

   Controls (mouse and touch work the same):
   - Pull back anywhere and let go: slingshot. The cake flies the opposite way,
     pull length = power. This is the gesture the tutorial teaches.
   - Tap a spot in the pond (or drag forward): the cake is thrown at that spot.
   The cake always starts from the sling at the front of the pond. */
(function () {
  'use strict';
  const FC = window.FC;
  const TAU = FC.TAU;
  const CFG = FC.Physics.CFG;
  const Body = FC.Physics.Body;
  const TIERS = FC.Cakes.TIERS;
  const MAX_T = FC.Cakes.MAX_TIER;
  const S = FC.Scene;
  const FX = FC.FX;
  const AU = FC.Audio;

  const CONE = (80 * Math.PI) / 180; // widest flick, measured from straight ahead
  const DEAD = 12;                   // px a drag needs before it counts
  const FLY_TIME = 0.2;              // the next cake hops from the Next bubble into the sling
  const COACH_DONE = 3;              // stored tutorial progress when finished
  const HAND_CYCLE = 2.6;

  const levelScore = (n) => 50 * n * (n - 1); // score needed to reach level n
  const levelFor = (score) => { let n = 1; while (levelScore(n + 1) <= score) n++; return n; };
  const themeForLevel = (lv) => Math.floor((lv - 1) / 3) % Math.max(1, S.themeCount());
  const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  const WTMP = { x: 0, y: 0 };

  const Game = {
    canvas: null, ctx: null, W: 0, H: 0, dpr: 1,
    state: 'loading', // loading | title | playing | paused | over
    t: 0, last: 0,
    world: null,
    score: 0, best: 0, level: 1, combo: 0, bestCombo: 0, lastMergeT: -9, maxTier: 1, merges: 0, shots: 0,
    queue: [], cool: 0, shotSeq: 0,
    aim: { active: false, pid: null, sx: 0, sy: 0, cx: 0, cy: 0, mode: null, pressInPond: false, L: null, dir: null, power: 0, valid: false, speed: 0, pred: null, lastTick: 0, offX: 0, offY: 0, target: null },
    launcher: { pop: 1 },
    sling: { w: 0, snap: 0 },
    fly: null,
    tilly: { x: 0, y: 0, mood: 'idle', moodT: 0, flick: 0 },
    jokers: 0, wands: 0, wandMode: false,
    bubble: null, nextBubbleAt: 16,
    danger: 0, dangerBody: null, warnT: 0, dangerHinted: false,
    shake: 0, flash: 0, flashCol: '#ffffff',
    overT: 0, overPops: 0,
    discovered: null,
    coach: null, idle: 0, handT: -1, hint: null, ringPulse: 0,
    hitstop: 0, streak: 0, pending: [], grab: 0,
    demo: { phase: 'wait', t: 0, wait: 0.8 },
    whirlPhase: 0,

    // ------------------------------------------------------------
    init(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.best = FC.store.get('best', 0);
      this.discovered = FC.store.get('book', [1]);
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
      FX.clear();
      this.bubble = null;
      this.wandMode = false;
      this.aim.active = false;
      this.coach = null;
      this.handT = -1;
      this.hint = null;
      this.fly = null;
      S.setTheme(0, true);
      this.queue = [1, 2];
      this.setupStart(false);
      this.demo = { phase: 'wait', t: 0, wait: 0.9 };
      this.setCursor();
    },

    newGame() {
      FX.clear();
      this.score = 0; this.level = 1; this.combo = 0; this.bestCombo = 0; this.lastMergeT = -9;
      this.maxTier = 3; this.merges = 0; this.shots = 0; this.shotSeq = 0;
      this.jokers = 0; this.wands = 0; this.wandMode = false;
      this.bubble = null; this.nextBubbleAt = 14 + FC.randInt(0, 6);
      this.danger = 0; this.dangerBody = null; this.warnT = 0; this.dangerHinted = false;
      this.cool = 0; this.launcher.pop = 0; this.fly = null;
      this.overT = 0;
      this.aim.active = false;
      this.idle = 0; this.handT = -1; this.hint = null; this.ringPulse = 0;
      this.hitstop = 0; this.streak = 0; this.pending = [];
      this.state = 'playing';
      if (S.theme !== 0) S.setTheme(0, false);
      const tutorial = FC.store.get('coach', 0) < COACH_DONE;
      this.setupStart(tutorial);
      this.queue = tutorial ? [1, 2, 1] : [this.randTier(), this.randTier()];
      FC.UI.onNewGame();
      this.coach = tutorial ? { step: 'aim', t: 0, shown: '' } : null;
      if (this.coach) this.coachSay('aim', 'Pull back & let go!', 'Flick the cake into the pond');
      this.setCursor();
    },

    // A few cakes are already floating when a run starts, so the first flick has a target.
    setupStart(tutorial) {
      const W = this.world;
      const place = (list) => {
        W.clear();
        list.forEach(([tier, x, y], i) => {
          const b = new Body(tier, TIERS[tier].r, x, y);
          b.age = 3;
          b.pop = -0.1 - i * 0.09; // staggered pop-in
          W.add(b);
        });
      };
      const settle = () => {
        const onI = W.onImpact, onR = W.onRim, sw = W.swirl;
        W.onImpact = W.onRim = null;
        W.canMerge = () => false;
        W.swirl = 0;
        for (let i = 0; i < 100; i++) W.step(1 / 60);
        delete W.canMerge;
        W.onImpact = onI; W.onRim = onR; W.swirl = sw;
        for (const b of W.bodies) { b.vx = 0; b.vy = 0; }
      };
      // identical cakes must not start next to each other (they would merge by themselves)
      const apart = () => {
        const B = W.bodies;
        for (let i = 0; i < B.length; i++) {
          for (let j = i + 1; j < B.length; j++) {
            if (B[i].tier !== B[j].tier) continue;
            const gap = Math.hypot(B[i].x - B[j].x, B[i].y - B[j].y) - B[i].r - B[j].r;
            if (gap < CFG.TWIN_RANGE * Math.min(B[i].r, B[j].r) + 30) return false;
          }
        }
        return true;
      };
      if (tutorial) {
        // a Macaron right in front of the sling, matching pairs around it
        place([[1, 0, 190], [3, 0, 10], [2, -205, 70], [2, 205, 70], [1, 0, -190]]);
        settle();
        return;
      }
      for (let tries = 0; tries < 14; tries++) {
        const tiers = [1, 1, 2, 2, 3].sort(() => Math.random() - 0.5);
        const list = [];
        for (const t of tiers) {
          for (let k = 0; k < 40; k++) {
            const a = Math.random() * TAU, rr = 70 + Math.random() * 290;
            const x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.85;
            if (list.every(([t2, x2, y2]) => Math.hypot(x - x2, y - y2) > TIERS[t].r + TIERS[t2].r + 30)) { list.push([t, x, y]); break; }
          }
        }
        place(list);
        settle();
        if (apart()) break;
      }
    },

    // new cakes: Macaron, Cherry Bite, Cupcake – and Lemon Tart once a Peach Cake exists
    randTier() {
      const maxT = FC.clamp(this.maxTier - 3, 3, 4);
      const w = [36, 30, 22, 12];
      let sum = 0;
      for (let i = 0; i < maxT; i++) sum += w[i];
      let x = Math.random() * sum;
      for (let i = 0; i < maxT; i++) { x -= w[i]; if (x <= 0) return i + 1; }
      return 1;
    },

    // ------------------------------------------------------------
    // input
    // ------------------------------------------------------------
    bindInput() {
      const c = this.canvas;
      c.addEventListener('pointerdown', (e) => this.onDown(e));
      c.addEventListener('pointermove', (e) => this.onMove(e));
      c.addEventListener('pointerup', (e) => this.onUp(e));
      c.addEventListener('pointercancel', () => this.cancelAim());
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
      if (this.aim.active || this.queue[0] == null) return;
      this.fly = null; // snap the next cake into the sling
      const a = this.aim;
      a.active = true;
      a.pid = e.pointerId;
      a.sx = a.cx = e.clientX;
      a.sy = a.cy = e.clientY;
      a.mode = null;
      a.valid = false;
      a.power = 0;
      a.lastTick = 0;
      a.pred = null;
      a.target = null;
      const g = this.slingGround();
      const rr = TIERS[this.queue[0]].r * S.s;
      // pressed on open water (not on the cake): the player probably points at a target
      a.pressInPond = this.inPond(e.clientX, e.clientY) && e.clientY < g.y - rr * 2.2;
      try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      this.idle = 0;
      this.handT = -1;
      this.grab = 1;
      a.detent = 0;
      AU.grab();
      this.computeAim();
      this.setCursor();
    },

    onMove(e) {
      const a = this.aim;
      if (!a.active || e.pointerId !== a.pid) return;
      a.cx = e.clientX;
      a.cy = e.clientY;
      if (!a.mode) {
        const dx = a.cx - a.sx, dy = a.cy - a.sy;
        if (dx * dx + dy * dy > DEAD * DEAD) {
          // the first real movement decides: pulling back = slingshot, pushing forward = point
          if (a.pressInPond) a.mode = dy > Math.abs(dx) * 0.8 ? 'sling' : 'point';
          else a.mode = dy < -Math.abs(dx) * 0.8 ? 'point' : 'sling';
        }
      }
    },

    onUp(e) {
      const a = this.aim;
      if (!a.active || e.pointerId !== a.pid) return;
      a.cx = e.clientX;
      a.cy = e.clientY;
      if (!a.mode && a.pressInPond) a.mode = 'point'; // a tap on the water: throw it there
      this.computeAim();
      const ok = a.valid && (a.mode === 'point' || a.power > 0.02);
      if (ok && this.cool <= 0 && this.state === 'playing') this.launch();
      else if (!a.mode) this.idle = 20; // tapped the cake: show the hand right away
      AU.stretch(0);
      a.active = false;
      a.pred = null;
      this.setCursor();
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
    anchorW(tier) {
      return { x: 0, y: CFG.R - TIERS[tier].r - 4 };
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
      return FC.clamp(Math.min(S.pr * 0.9, room), 100, 250);
    },

    computeAim() {
      const a = this.aim;
      const tier = this.queue[0];
      a.valid = false;
      a.offX = a.offY = 0;
      a.target = null;
      if (tier == null) return;
      const r = TIERS[tier].r;
      const L = this.anchorW(tier);
      const dx = a.cx - a.sx, dy = a.cy - a.sy;
      const len = Math.sqrt(dx * dx + dy * dy);
      const mode = a.mode || (a.pressInPond ? 'point' : null);
      let wx, wy, p, speed;
      if (mode === 'sling') {
        if (len < DEAD) { a.pred = null; a.power = 0; return; }
        wx = -dx; wy = -dy / S.K;
        const maxPull = this.maxPull();
        p = FC.clamp((len - DEAD) / (maxPull - DEAD), 0, 1);
        speed = FC.Physics.speedForPower(p); // pull length = travel distance
        const vis = Math.min(len, maxPull) * 0.5;
        a.offX = (dx / len) * vis;
        a.offY = (dy / len) * vis;
        a.gripX = (dx / len) * Math.min(len, maxPull);
        a.gripY = (dy / len) * Math.min(len, maxPull);
      } else if (mode === 'point') {
        const T = S.s2w(a.cx, a.cy);
        wx = T.x - L.x; wy = T.y - L.y;
        const d = Math.sqrt(wx * wx + wy * wy);
        if (d < r * 1.2) { a.pred = null; a.power = 0; return; }
        const dd = FC.clamp(d, CFG.D_MIN, CFG.D_MAX);
        speed = FC.Physics.speedForDistance(dd); // lands right on the spot you tapped
        p = (dd - CFG.D_MIN) / (CFG.D_MAX - CFG.D_MIN);
        a.target = T;
      } else {
        a.pred = null;
        a.power = 0;
        return;
      }
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
      AU.stretch(mode === 'sling' ? p : p * 0.4);
    },

    predMatch(pred, tier) {
      return !!(pred && pred.hit && pred.hit.body.tier >= 1 && (pred.hit.body.tier === tier || tier === 0));
    },

    launch() {
      const a = this.aim;
      this.fire(a.dir, a.speed, a.power, a.L);
    },

    fire(dir, speed, power, L) {
      const tier = this.queue.shift();
      this.queue.push(this.randTier());
      const r = TIERS[tier].r;
      const b = new Body(tier, r, L.x, L.y);
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
      FX.ripple(L.x, L.y, r * 0.8, 0.6, 520);
      FX.burst(L.x, L.y, { n: 10, colors: ['#ffffff', '#c9f6ff'], speed: [200, 600], size: [8, 14], kinds: ['drop', 'dot'], life: [0.3, 0.6], gravity: 0, drag: 4, dir: Math.atan2(dir.y, dir.x) + Math.PI, spread: 1.6 });
      AU.launch(power);
      this.maybeBubble();
      FC.UI.updateNext(true);
      const c = this.coach;
      if (c && (c.step === 'aim' || c.step === 'retry')) { c.step = 'fly'; c.t = 0; c.shown = ''; FC.UI.coachHide(); }
    },

    swap() {
      if (this.state !== 'playing' || this.aim.active || this.queue.length < 2) return;
      const q = this.queue;
      const t = q[0]; q[0] = q[1]; q[1] = t;
      this.fly = null;
      this.launcher.pop = 0.35;
      AU.swap();
      FC.UI.updateNext(true);
    },

    useJoker() {
      if (this.state !== 'playing' || this.jokers <= 0 || this.queue[0] === 0) return;
      this.jokers--;
      this.queue.unshift(0);
      this.fly = null;
      this.launcher.pop = 0;
      AU.magic();
      FC.UI.updatePowers();
      FC.UI.updateNext();
      FC.UI.banner('Magic Cake!', 'It upgrades the first cake it touches');
    },

    toggleWand() {
      if (this.state !== 'playing') return;
      if (this.wandMode) { this.wandMode = false; FC.UI.updatePowers(); FC.UI.coachHide(); this.setCursor(); return; }
      if (this.wands <= 0) return;
      this.cancelAim();
      this.wandMode = true;
      FC.UI.updatePowers();
      FC.UI.coach('Tap a cake to poof it away', 'Tap the water to cancel', { sticky: true });
      this.setCursor();
    },

    wandTap(x, y) {
      const hit = this.pickBody(x, y);
      this.wandMode = false;
      FC.UI.coachHide();
      this.setCursor();
      if (!hit) { FC.UI.updatePowers(); return; }
      hit.dead = true;
      this.wands--;
      const T = TIERS[hit.tier];
      FX.burst(hit.x, hit.y, { n: 30, colors: ['#ffffff', '#fff3a8', '#e8d4ff'].concat(T.particle), speed: [250, 900], size: [10, 24], kinds: ['star', 'dot', 'heart'], life: [0.5, 1.1], gravity: -200 });
      FX.ring(hit.x, hit.y, hit.r * 0.6, hit.r * 1.8, '#ffffff', 0.45, 18);
      FX.popup(hit.x, hit.y - hit.r, 'Poof!', '#a77ad6', 40);
      AU.poof();
      FC.UI.updatePowers();
    },

    pickBody(sx, sy) {
      const list = this.world.bodies.filter((b) => !b.dead && !b.sensor).sort((a, b) => b.y - a.y);
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
      a.dead = b.dead = true;
      const x = (a.x * a.m + b.x * b.m) / (a.m + b.m);
      const y = (a.y * a.m + b.y * b.m) / (a.m + b.m);
      const live = this.state === 'playing';
      const combo = live ? this.bumpCombo() : 1;
      const mult = 1 + 0.5 * (combo - 1);
      if (t >= MAX_T) {
        if (live) this.royalBlast(x, y, combo);
        return;
      }
      const nt = t + 1;
      const nb = new Body(nt, Math.max(a.r, b.r), x, y);
      nb.rT = TIERS[nt].r;
      nb.setMass(nb.rT);
      nb.vx = (a.vx * a.m + b.vx * b.m) / (a.m + b.m) * 0.6;
      nb.vy = (a.vy * a.m + b.vy * b.m) / (a.m + b.m) * 0.6;
      nb.age = Math.max(0.8, Math.min(a.age, b.age));
      nb.pop = 0;
      nb.expr = 'happy';
      nb.exprT = 1.1;
      nb.shotId = Math.max(a.shotId, b.shotId);
      this.world.add(nb);
      if (!live) {
        // title-screen demo: just the pretty part
        this.mergeFX(nb, nt, 1, 0, null, true);
        return;
      }
      this.merges++;
      this.creditShot(nb.shotId);
      const pts = Math.round(TIERS[nt].score * mult * this.streakMult());
      this.addScore(pts);
      this.mergeFX(nb, nt, combo, pts);
      AU.merge(nt, combo);
      // a tiny freeze sells the pop; neighbours get nudged by the burst
      this.hitstop = Math.min(0.13, this.hitstop + 0.045 + nt * 0.004);
      for (const o of this.world.bodies) {
        if (o.dead || o === nb || o.sensor || o.anchored) continue;
        const dx = o.x - x, dy = o.y - y, d = Math.hypot(dx, dy) || 1;
        const R = nb.rT * 2.3 + o.r;
        if (d >= R) continue;
        const k = 300 * (1 - d / R) * Math.min(1.5, nb.m / (o.m + nb.m) * 2);
        o.vx += (dx / d) * k; o.vy += (dy / d) * k;
        o.sqv += 2.2;
      }
      if (navigator.vibrate) try { navigator.vibrate(nt >= 6 ? 22 : 10); } catch (e) { /* ignore */ }
      this.reach(nt);
      this.cheer(nt >= 5 || combo >= 3 ? 1.2 : 0.6);
      const c = this.coach;
      if (c && (c.step === 'aim' || c.step === 'fly' || c.step === 'retry')) {
        c.step = 'merged'; c.t = 0;
        this.coachSay('merged', 'Yum! Same cakes merge', 'Two of a kind make a bigger cake', { eq: [t, t, nt] });
      }
      // cakes nearby smile
      for (const o of this.world.bodies) {
        if (o.dead || o === nb || o.sensor) continue;
        const d = Math.hypot(o.x - x, o.y - y);
        if (d < nb.rT * 2.6 && !o.expr) { o.expr = 'happy'; o.exprT = 0.6 + Math.random() * 0.4; }
      }
    },

    onJoker(j, c) {
      if (j.dead || c.dead || this.state !== 'playing') return;
      j.dead = true;
      const combo = this.bumpCombo();
      const mult = 1 + 0.5 * (combo - 1);
      FX.burst(j.x, j.y, { n: 30, colors: TIERS[0].particle, speed: [250, 900], size: [10, 22], kinds: ['star', 'dot', 'heart'], life: [0.6, 1.2], gravity: -100 });
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
      const pts = Math.round(TIERS[nt].score * mult * this.streakMult());
      this.addScore(pts);
      this.mergeFX(nb, nt, combo, pts, 'Magic!');
      this.hitstop = Math.min(0.13, this.hitstop + 0.06);
      this.reach(nt);
      this.cheer(1);
    },

    onBubble(s, b) {
      if (s.dead) return;
      s.dead = true;
      this.bubble = null;
      const roll = Math.random();
      let label, kind = null;
      if (roll < 0.36) { this.jokers++; label = '+1 Magic Cake'; kind = 'joker'; }
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
      const T = TIERS[nt];
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
      const pts = Math.round(500 * (1 + 0.5 * (combo - 1)));
      this.addScore(pts);
      this.merges++;
      FX.burst(x, y, { n: 60, colors: TIERS[MAX_T].particle.concat(['#ff9fd0', '#9ec5ff', '#a7ebc8']), speed: [400, 1600], size: [12, 30], kinds: ['star', 'heart', 'sprinkle', 'dot'], life: [0.8, 1.8], gravity: 300, up: 300 });
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
      FC.UI.banner('Fairy Magic!', 'Two Royal Fairycakes vanished in sparkles');
      this.cheer(2);
    },

    // a new tier was created in this run
    reach(nt) {
      if (nt > this.maxTier) {
        this.maxTier = nt;
        FC.UI.setLadder(this.maxTier, nt);
      }
      this.discover(nt);
    },

    discover(nt) {
      if (this.discovered.indexOf(nt) >= 0) return;
      this.discovered.push(nt);
      FC.store.set('book', this.discovered);
      if (nt >= 2) {
        FC.UI.discover(nt);
        AU.discover();
      }
    },

    cheer(dur) {
      this.tilly.mood = 'cheer';
      this.tilly.moodT = dur;
    },

    addScore(pts) {
      this.score += pts;
      FC.UI.setScore(this.score);
      const lv = levelFor(this.score);
      if (lv > this.level) {
        for (let n = this.level + 1; n <= lv; n++) this.levelUp(n);
        this.level = lv;
      }
      FC.UI.setLevel(this.level, (this.score - levelScore(this.level)) / (levelScore(this.level + 1) - levelScore(this.level)));
    },

    levelUp(n) {
      AU.levelUp();
      let gift, kind;
      if (n % 2 === 0) { this.jokers++; gift = '+1 Magic Cake'; kind = 'joker'; } else { this.wands++; gift = '+1 Wand'; kind = 'wand'; }
      FC.UI.updatePowers(true);
      const nextTheme = themeForLevel(n);
      if (nextTheme !== S.theme) {
        S.load(nextTheme).then(() => {
          S.setTheme(nextTheme, false);
          FC.UI.banner('Welcome to ' + S.themeName(nextTheme) + '!', 'Level ' + n + ' · ' + gift);
        });
      } else FC.UI.banner('Level ' + n + '!', gift);
      const upcoming = themeForLevel(n + 1);
      if (upcoming !== S.theme) S.load(upcoming);
      this.powerIntro(kind);
      this.cheer(1.2);
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
        if (Math.hypot(b.x, b.y) + b.r > CFG.DANGER - 50 && b.speed() < 400) return true;
      }
      return false;
    },

    updateCoach(dt) {
      const a = this.aim;
      if (!a.active && !this.wandMode) this.idle += dt;
      const c = this.coach;
      // the hand shows the gesture: always during the first steps, later only when the player hesitates
      let hand;
      if (c && (c.step === 'aim' || c.step === 'retry')) hand = !a.active && this.idle > 0.35;
      else hand = !a.active && !this.wandMode && ((this.shots === 0 && this.idle > 2.5) || this.idle > 14);
      if (hand) this.handT = this.handT < 0 ? 0 : this.handT + dt;
      else this.handT = -1;
      if (!c) return;
      c.t += dt;
      switch (c.step) {
        case 'aim':
        case 'retry':
          if (a.active && a.valid) {
            if (this.predMatch(a.pred, this.queue[0])) this.coachSay('match', 'That’s a match! {heart}', 'Let go to merge them');
            else this.coachSay('aiming', 'Aim at the same cake', 'A {heart} means: match!');
          } else if (!a.active) {
            if (c.step === 'aim') this.coachSay('aim', 'Pull back & let go!', 'Flick the cake into the pond');
            else this.coachSay('retry', 'So close!', 'Hit a cake that looks the same');
          }
          break;
        case 'fly':
          if (c.t > 2.4) { c.step = 'retry'; c.t = 0; }
          break;
        case 'merged':
          if (c.t > 2.6) {
            c.step = 'goal'; c.t = 0;
            this.coachSay('goal', 'Bake bigger and bigger cakes', 'All the way up to the Royal Fairycake!', { chain: true });
            FC.UI.pulseLadder();
          }
          break;
        case 'goal':
          if (c.t > 3.2) { c.step = 'wait'; c.t = 0; FC.UI.coachHide(); }
          break;
        case 'wait':
          if (this.shots >= 4 || this.nearRing()) {
            c.step = 'ring'; c.t = 0;
            this.ringPulse = 4.5;
            this.coachSay('ring', 'Keep the cakes inside the ring!', 'If they pile up past it, the pond overflows');
          }
          break;
        case 'ring':
          if (c.t > 3.8) { FC.UI.coachHide(); FC.store.set('coach', COACH_DONE); this.coach = null; }
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
      this.newBest = this.score > this.best;
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
            const T = TIERS[b.tier] || TIERS[1];
            FX.burst(b.x, b.y, { n: 14, colors: T.particle, speed: [200, 600], size: [8, 16], kinds: ['sprinkle', 'dot', 'star'], life: [0.5, 1.0], gravity: 700, up: 150 });
            AU.tone(300 + Math.random() * 200, 0.08, { type: 'triangle', vol: 0.06 });
          }
          this.overPops++;
        }
      }
      if (this.overT > 1.0 && !this.overShown && (this.world.count() === 0 || this.overT > 3.2)) {
        this.overShown = true;
        FC.UI.showOver({ score: this.score, best: this.best, newBest: this.newBest, maxTier: this.maxTier, merges: this.merges, combo: this.bestCombo, level: this.level });
      }
    },

    // ------------------------------------------------------------
    // per-frame update
    // ------------------------------------------------------------
    // the whirlpool turns faster as the levels go up
    swirlTarget() {
      if (this.state === 'title') return 0.1;
      const k = FC.clamp((this.level - 1) / 9, 0, 1);
      return FC.lerp(CFG.SWIRL_MIN, CFG.SWIRL_MAX, k);
    },

    update(dt) {
      this.t += dt;
      S.update(dt);
      if (this.state !== 'paused') {
        const W = this.world;
        W.swirl += (this.swirlTarget() - W.swirl) * FC.damp(0.8, dt);
        this.whirlPhase += W.swirl * dt;
      }
      const pdt = this.hitstop > 0 ? dt * 0.06 : dt;
      this.hitstop = Math.max(0, this.hitstop - dt);
      if (this.state === 'playing' || this.state === 'title' || this.state === 'over') this.world.step(pdt);
      if (this.state !== 'paused') {
        this.updateBodies(dt);
        FX.update(dt);
      }
      if (this.state === 'playing') {
        if (this.cool > 0) this.cool -= dt;
        if (this.aim.active) this.computeAim();
        this.updateDanger(dt);
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
          FC.Physics.water(b.x, b.y, this.world.swirl, WTMP);
          const fk = FC.Physics.floatK(sp);
          if (Math.hypot(b.vx - WTMP.x * fk, b.vy - WTMP.y * fk) < 60) {
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

    updateDanger(dt) {
      let worst = null, max = 0;
      for (const b of this.world.bodies) {
        if (b.dead || b.sensor) continue;
        const d = Math.hypot(b.x, b.y) || 1;
        const edge = d + b.r;
        const inward = -(b.x * b.vx + b.y * b.vy) / d; // > 0 while the current still carries it in
        if (edge > CFG.DANGER && b.age > 1.1 && b.speed() < 420 && inward < 70) b.danger += dt;
        else b.danger = Math.max(0, b.danger - dt * 1.5);
        if (b.danger > max) { max = b.danger; worst = b; }
      }
      this.danger = max;
      this.dangerBody = worst;
      if (max > 0.3) {
        this.warnT -= dt;
        if (this.warnT <= 0) { AU.danger(); this.warnT = 0.9; }
        if (!this.dangerHinted && !this.coach && !this.wandMode) {
          this.dangerHinted = true;
          const n = FC.store.get('dangerTips', 0);
          if (n < 3) {
            FC.store.set('dangerTips', n + 1);
            FC.UI.coach('Too full!', this.wands > 0 ? 'Merge cakes to make room – or use your Wand' : 'Merge cakes to make room', { time: 3200 });
          }
        }
        if (this.tilly.mood !== 'cheer') { this.tilly.mood = 'worried'; this.tilly.moodT = 0.3; }
      }
      FC.UI.setDanger(max > 0.3);
      if (max >= CFG.DANGER_TIME) this.gameOver(worst);
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
          FX.burst(b.x, b.y, { n: 8, colors: TIERS[b.tier].particle, speed: [200, 500], size: [8, 14], kinds: ['star', 'dot'], life: [0.4, 0.8], gravity: 400 });
        }
        d.wait = 1.0;
        return;
      }
      const tier = this.queue[0];
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
      const tier = this.queue.shift();
      this.queue.push(FC.randInt(1, 3));
      const r = TIERS[tier].r;
      const b = new Body(tier, r, d.L.x, d.L.y);
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
      if (this.handT < 0 || this.state !== 'playing' || this.queue[0] == null) {
        this.hint = null;
        if (FC.UI.handOver) FC.UI.setHandOver(false);
        return;
      }
      const u = this.handT % HAND_CYCLE;
      let alpha = 0, pull = 0, press = 0;
      if (u < 0.3) { alpha = u / 0.3; }
      else if (u < 0.45) { alpha = 1; press = (u - 0.3) / 0.15; }
      else if (u < 1.35) { alpha = 1; press = 1; pull = easeInOut((u - 0.45) / 0.9); }
      else if (u < 1.75) { alpha = 1; press = 1; pull = 1; }
      else if (u < 2.05) { alpha = 1 - (u - 1.75) / 0.3; }
      const prev = this.hint ? this.hint.u : 0;
      if (prev < 1.75 && u >= 1.75) this.sling.snap = 1; // "let go": the ribbon twangs
      this.hint = { alpha, pull, press, u };
      // does the hand reach down into the cake ladder?
      const L = FC.UI.ladderRect, g = this.slingGround();
      const s = FC.clamp(S.pr * 0.17, 26, 52);
      const handBottom = g.y + this.maxPull() * 0.7 + s * 1.5;
      FC.UI.setHandOver(!!L && alpha > 0.02 && handBottom > L.top && g.x + s > L.left && g.x - s < L.right);
    },

    // ------------------------------------------------------------
    // launcher, sling and Tilly
    // ------------------------------------------------------------
    // what the sling shows right now: the player's aim, the title demo or the tutorial hand
    shotView() {
      const tier = this.queue[0];
      if (tier == null) return null;
      if (this.state === 'title') {
        const d = this.demo;
        if (d.phase !== 'pull') return null;
        const k = easeInOut(Math.min(1, d.t / 0.55));
        const pull = this.maxPull() * (0.15 + 0.35 * d.power) * k; // shorter than real, the title card sits below
        const sx = d.dir.x, sy = d.dir.y * S.K, sl = Math.hypot(sx, sy) || 1;
        return { L: d.L, dir: d.dir, power: d.power * k, pred: k > 0.5 ? d.pred : null, tier, offX: -(sx / sl) * pull * 0.4, offY: -(sy / sl) * pull * 0.4, gripX: -(sx / sl) * pull, gripY: -(sy / sl) * pull, mode: 'sling', alpha: k };
      }
      const a = this.aim;
      if (a.active && a.valid) {
        const sling = a.mode === 'sling';
        return { L: a.L, dir: a.dir, power: a.power, pred: a.pred, tier, offX: a.offX, offY: a.offY, gripX: sling ? a.gripX : 0, gripY: sling ? a.gripY : 0, mode: a.mode || 'point', target: a.target, alpha: 1 };
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
      S.drawWaterFX(ctx, this.t, this.state === 'title' ? 0.6 : 1, this.whirlPhase);
      if (this.state === 'playing' || this.state === 'paused') this.drawDangerRing(ctx);
      this.drawShadows(ctx);
      const view = this.shotView();
      if (view) this.drawAimPath(ctx, view);
      else if (this.hint) this.drawHintPath(ctx);
      this.drawBodies(ctx);
      S.drawFrontLayer(ctx);
      if (view) this.drawAimTop(ctx, view);
      this.grip = null;
      if (this.state === 'playing' || this.state === 'paused' || this.state === 'title') this.drawLauncher(ctx, view);
      ctx.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);
      FX.drawTop(ctx, S, dpr);
      S.drawSea(ctx, this.t);
      S.drawSparkles(ctx);
      // pull line and tutorial hand stay above the cloud sea (short screens pull into it)
      this.drawGrip(ctx);
      if (this.hint) this.drawHand(ctx);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (this.danger > 0.3 && this.state === 'playing') {
        const k = FC.clamp((this.danger - 0.3) / (CFG.DANGER_TIME - 0.3), 0, 1);
        const pulse = 0.5 + 0.5 * Math.sin(this.t * (6 + k * 8));
        const g = ctx.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.35, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.75);
        g.addColorStop(0, 'rgba(255,60,120,0)');
        g.addColorStop(1, 'rgba(255,60,120,' + (0.12 + 0.25 * k * pulse).toFixed(3) + ')');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, this.W, this.H);
      }
      if (this.wandMode) {
        ctx.fillStyle = 'rgba(120,80,200,0.12)';
        ctx.fillRect(0, 0, this.W, this.H);
      }
      if (this.flash > 0) {
        ctx.fillStyle = FC.rgba(this.flashCol, Math.min(0.8, this.flash));
        ctx.fillRect(0, 0, this.W, this.H);
      }
    },

    drawDangerRing(ctx) {
      const pr = CFG.DANGER * S.s;
      const K = S.K;
      const k = FC.clamp(this.danger / CFG.DANGER_TIME, 0, 1);
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
      ctx.setLineDash([Math.max(4, pr * 0.03), Math.max(6, pr * 0.045)]);
      ctx.lineDashOffset = -this.t * 18;
      ctx.beginPath();
      ctx.ellipse(S.cx, S.cy, pr, pr * K, 0, 0, TAU);
      ctx.lineWidth = Math.max(1.8, S.pr * 0.013);
      ctx.strokeStyle = FC.rgba(col, alpha);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + this.t * 0.12;
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
        if (edge < CFG.DANGER - 60 || b.age < 1.1) continue;
        const a = Math.atan2(b.y, b.x);
        const intensity = FC.clamp((edge - (CFG.DANGER - 60)) / 90, 0, 1) * (b.danger > 0 ? 1 : 0.5);
        const span = (b.r / CFG.DANGER) * 1.2;
        ctx.beginPath();
        ctx.ellipse(S.cx, S.cy, pr, pr * K, 0, a - span, a + span);
        ctx.lineWidth = Math.max(3, S.pr * 0.03);
        ctx.strokeStyle = FC.rgba(b.danger > 0.3 ? '#ff4f86' : '#ffd1e4', 0.35 + 0.45 * intensity);
        ctx.stroke();
      }
      ctx.restore();
      const db = this.dangerBody;
      if (db && this.danger > 0.3 && !db.dead) {
        const left = Math.max(0, CFG.DANGER_TIME - this.danger);
        const p = S.w2s(db.x, db.y);
        const r = db.r * S.s;
        const n = Math.ceil(left);
        const y = p.y - r * 2.2;
        const sc = 1 + 0.15 * Math.sin(this.t * 12);
        ctx.save();
        ctx.translate(p.x, y);
        ctx.scale(sc, sc);
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, TAU);
        ctx.fillStyle = '#ff4f86';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 18px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(n), 0, 1);
        ctx.restore();
      }
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
        this.drawCake(ctx, b.tier, b.x, b.y, b.r, b, dpr);
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

    // draw one cake at world (x, y) with physics radius r
    drawCake(ctx, tier, x, y, r, b, dpr, scrX, scrY) {
      const T = TIERS[tier];
      const p = scrX != null ? { x: scrX, y: scrY } : S.w2s(x, y);
      const base = T.r * S.s;
      let sc = (r / T.r) * (b ? this.popScale(b) : 1);
      sc *= 1 + 0.012 * Math.sin(this.t * 2.2 + (b ? b.phase : 0));
      const rr = base * sc;
      const oy = p.y - rr * 0.45;
      if (tier === 0 || tier === MAX_T) {
        const pulse = 0.85 + 0.15 * Math.sin(this.t * 3);
        const g = ctx.createRadialGradient(p.x, oy - rr * 0.2, rr * 0.3, p.x, oy - rr * 0.2, rr * 2.1 * pulse);
        g.addColorStop(0, tier === 0 ? 'rgba(255,255,255,0.55)' : 'rgba(255,240,170,0.55)');
        g.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, oy - rr * 0.2, rr * 2.1 * pulse, 0, TAU);
        ctx.fill();
      }
      const sp = FC.Cakes.sprite(tier, base * dpr);
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
        else if (b.danger > 0.15 || (Math.hypot(b.x, b.y) + b.r > CFG.DANGER && b.age > 1.1)) expr = 'worried';
      }
      FC.Cakes.drawFace(ctx, tier, { expr: expr || 'normal', blink: b ? b.blink : 0, lookX: b ? b.lookX : 0, lookY: b ? b.lookY : 0.3 });
      ctx.restore();
      if (tier === 0) {
        for (let i = 0; i < 3; i++) {
          const a = this.t * 2 + (i * TAU) / 3;
          FC.sparklePath(ctx, p.x + Math.cos(a) * rr * 1.25, oy - rr * 0.3 + Math.sin(a) * rr * 0.6, rr * 0.16, 0.3);
          ctx.fillStyle = ['#ff9fd0', '#ffe27a', '#9ec5ff'][i];
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
        const q = S.w2s(pts[i].x, pts[i].y);
        const f = i / n;
        const al = (0.95 - f * 0.55) * v.alpha;
        const wave = 1 + 0.4 * Math.max(0, Math.sin(i * 0.75 - this.t * 10));
        ctx.beginPath();
        ctx.arc(q.x, q.y, rad * (1 - f * 0.35) * wave, 0, TAU);
        ctx.fillStyle = FC.rgba(col, al);
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = FC.rgba(match ? '#ffffff' : '#7f6ad0', al * 0.6);
        ctx.stroke();
      }
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
          const s = Math.max(10, rr * 0.55) * (1 + 0.12 * Math.sin(this.t * 10));
          const hx = (q.x + hp.x) / 2, hy = (q.y + hp.y) / 2 - hr * 1.3;
          FC.heartPath(ctx, hx, hy, s);
          ctx.fillStyle = '#ff6fa8';
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
        } else {
          const dx = hp.x - q.x, dy = hp.y - q.y, d = Math.hypot(dx, dy) || 1;
          const len = Math.max(14, rr * 0.9) * (0.4 + v.power);
          const ex = hp.x + (dx / d) * len, ey = hp.y + (dy / d) * len;
          ctx.beginPath();
          ctx.moveTo(hp.x + (dx / d) * h.body.r * S.s * 0.3, hp.y + (dy / d) * h.body.r * S.s * 0.3);
          ctx.lineTo(ex, ey);
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      }
      if (pred && !pred.hit && pred.end) {
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
      // aiming at a spot: small target where the finger / mouse is
      if (v.mode === 'point' && v.target) {
        const q = S.w2s(v.target.x, v.target.y);
        const s = Math.max(8, S.pr * 0.04);
        ctx.translate(q.x, q.y);
        ctx.rotate(this.t * 1.5);
        ctx.beginPath();
        ctx.ellipse(0, 0, s, s * S.K, 0, 0, TAU);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.stroke();
        FC.sparklePath(ctx, 0, 0, s * 0.55, 0.3);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fill();
      }
      ctx.restore();
    },

    // ghost dots of the tutorial hand: "this is where it will go"
    drawHintPath(ctx) {
      const h = this.hint;
      if (!h || h.pull <= 0.05) return;
      const g = this.slingGround();
      const rr = TIERS[this.queue[0]].r * S.s;
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
      const tier = this.queue[0];
      if (tier == null) return;
      const r = TIERS[tier].r;
      const rr = r * S.s;
      const g = this.slingGround();
      const base = this.slingBase();
      // sling width follows the cake size
      const wT = Math.max(rr + S.pr * 0.07, S.pr * 0.15);
      this.sling.w = this.sling.w ? this.sling.w + (wT - this.sling.w) * 0.25 : wT;
      let offX = 0, offY = 0, gripX = 0, gripY = 0;
      if (view) { offX = view.offX; offY = view.offY; gripX = view.gripX || 0; gripY = view.gripY || 0; }
      else if (this.hint) { gripY = this.maxPull() * 0.7 * this.hint.pull; offY = gripY * 0.5; }
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
      const tension = view ? view.power : this.hint ? 0.6 * this.hint.pull : 0;
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
      this.drawCake(ctx, tier, 0, 0, r * sc, fake, this.dpr, x, y - hover);
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
      const g = this.slingGround();
      const rr = TIERS[this.queue[0]].r * S.s;
      const s = FC.clamp(S.pr * 0.17, 26, 52);
      const pullY = this.maxPull() * 0.7 * h.pull;
      const fx = g.x + rr * 0.15, fy = g.y - rr * 0.45 + pullY + (1 - h.press) * s * 0.18;
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
