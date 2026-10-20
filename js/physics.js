/* Fairycake Falls – physics.
   Cakes skim over the pond like curling stones: a nearly constant friction gives
   long, even glides and a crisp stop (what you see is what you get).

   The water has a character of its own: the spring at the back feeds a current that
   races round the RIM of the pond and leaves over the falls, while the MIDDLE is a
   calm pool (the dotted ring is its edge) that draws everything to the pile and turns it lazily.
   - A fast cake skims over the water and is only nudged sideways by the rim current.
   - A slow cake floats with it: in the current it rides round the pond, in the calm
     pool it is drawn in to the pile.
   - Cakes that touch the pile turn with the pool, even where the pile sticks out into
     the current (otherwise the current would peel them off, and nothing could be aimed at).
   - The pile is held together gently, so every hit really moves it; a hard flick can
     knock a cake out into the current.
   Circle collisions are billiards-like; identical cakes attract a little ("fairy magnetism").
   World units: inner pond radius R = 1000, centre (0,0), y points down. */
(function () {
  'use strict';
  const FC = window.FC;
  const TAU = FC.TAU;

  const CFG = {
    R: 1000,               // inner pond radius
    DANGER: 880,           // the biggest the calm pool (dotted ring) gets; a cake's edge must not rest beyond it
    DANGER_TIME: 4.0,      // seconds a cake may rest beyond the ring
    WARN_AT: 1.5,          // ... the warning starts after this long (a short ride along the edge stays quiet)
    // skimming
    FRICTION: 850,         // u/s^2, relative to the water: even glide, crisp stop (and shoved cakes slide a little)
    FRIC_EPS: 40,          // below this relative speed friction turns smoothly viscous (no jitter)
    DRAG: 0.45,            // small linear drag (1/s)
    SKIM_LO: 380,          // below this speed a cake floats with the current,
    SKIM_HI: 820,          // above this it skims over it ...
    TAN_K: 0.3,            // ... but even a skimming cake is swept sideways by this fraction of the rim current
    // the calm pool: a gentle drain towards the middle, strongest at the ring and fading towards the centre
    INFLOW: 190,           // u/s at the ring (x sizeK) ...
    INFLOW_CORE: 240,      // ... reaching INFLOW_MIN (x sizeK) in the middle
    INFLOW_MIN: 90,
    SIZE_K0: 0.85,         // inflow multiplier by size: K0 + K1 * r/300 (Macaron 0.95, Peach 1.2, Royal 1.5) – a mild sorting
    SIZE_K1: 0.45,
    OMEGA_MIN: 0.1,        // the calm middle (and the pile in it) turns at this rate on stage 1 (rad/s) ...
    OMEGA_MAX: 0.2,        // ... and from stage 10 on
    // the rim current
    VRIM_MIN: 520,         // speed of the rim current on stage 1 (u/s; a lap takes ~11 s) ...
    VRIM_MAX: 700,         // ... and from stage 10 on
    INFLOW_BAND: 110,      // u/s – the current only drifts inwards gently, so cakes ride round
    RING_MIN: 600,         // the calm pool while the biggest cake is a Cupcake ...
    RING_STEP: 46,         // ... grows by this much with every bigger cake, up to DANGER (Fairy Torte)
    BAND_RAMP: 120,        // width of the transition from calm pool to rim current
    // collisions
    REST: 0.35,            // cake-cake bounciness (sponge cakes: a hit shoves rather than bounces)
    MASS_EXP: 1.4,         // mass ~ r^MASS_EXP: fairy cakes are lighter than their size (2 = real discs), so a flick can shove big ones
    SPACE: 0.3,            // floating cakes keep a little personal space: gap = SPACE x smaller radius ...
    SPACE_K: 0.045,        // ... restored by this fraction per step (a soft cushion of water: a drift cannot close it, a flick can)
    TWIN_MOVE: 120,        // fairy magnetism only pulls while one of the twins is moving faster than this (resting twins wait for a push)
    REST_RIM: 0.6,         // rim bounciness
    REST_MIN_SPEED: 110,   // below this, no bounce (calm packing)
    TWIN_RANGE: 0.4,       // fairy magnetism range (x smaller radius, as gap width): forgiveness for near-misses of a flick
    TWIN_ACC: 2600,
    GROW_RATE: 340,        // u/s – growth speed of a freshly merged cake
    // flicks: pull length maps linearly to travel distance
    D_MIN: 160,            // distance of the gentlest flick (u)
    D_MAX: 2400,           // distance of a full-power flick (crosses the pond and bounces back)
    STEP: 1 / 240,
    ITER: 3,
  };

  // bigger cakes are "heavier": the current pulls them to the middle harder, so the pile
  // sorts itself – big ones sink to the centre, small ones stay at the surface where new flicks can reach them
  function sizeK(r) {
    return FC.clamp(CFG.SIZE_K0 + CFG.SIZE_K1 * (r / 300), 0.8, 1.6);
  }
  // 1 = floats with the current, 0 = skims straight over it
  function floatK(speed) {
    if (speed <= CFG.SKIM_LO) return 1;
    if (speed >= CFG.SKIM_HI) return 0;
    const k = (speed - CFG.SKIM_LO) / (CFG.SKIM_HI - CFG.SKIM_LO);
    return 1 - k * k * (3 - 2 * k);
  }
  const smooth = (a, b, v) => { const t = v <= a ? 0 : v >= b ? 1 : (v - a) / (b - a); return t * t * (3 - 2 * t); };
  // friction on a velocity relative to the water (in place on the 2-vector r)
  function rub(r, h) {
    const rs = Math.sqrt(r.x * r.x + r.y * r.y);
    if (rs < 1e-6) return;
    const dec = (CFG.FRICTION * Math.min(1, rs / CFG.FRIC_EPS) + CFG.DRAG * rs) * h;
    const k = dec >= rs ? 0 : 1 - dec / rs;
    r.x *= k; r.y *= k;
  }

  // distance a free flick travels for a launch speed -> table for the inverse
  const TABLE_DV = 25, TABLE_N = 200;
  const DIST = new Float64Array(TABLE_N + 1);
  (function build() {
    const h = CFG.STEP, r = { x: 0, y: 0 };
    for (let i = 0; i <= TABLE_N; i++) {
      r.x = i * TABLE_DV; r.y = 0;
      let x = 0;
      for (let k = 0; k < 4000 && r.x > 1; k++) { rub(r, h); x += r.x * h; }
      DIST[i] = x;
    }
  })();
  function speedForDistance(d) {
    if (d <= 0) return 0;
    let lo = 0, hi = TABLE_N;
    if (d >= DIST[hi]) return hi * TABLE_DV;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (DIST[m] < d) lo = m; else hi = m; }
    const f = (d - DIST[lo]) / (DIST[hi] - DIST[lo] || 1);
    return (lo + f) * TABLE_DV;
  }
  // flick speed for a power 0..1 (linear in distance)
  function speedForPower(p) {
    return speedForDistance(CFG.D_MIN + (CFG.D_MAX - CFG.D_MIN) * FC.clamp(p, 0, 1));
  }

  let NEXT_ID = 1;

  class Body {
    constructor(tier, r, x, y) {
      this.id = NEXT_ID++;
      this.tier = tier;     // 1..11 cakes, 0 = Magic Cake (joker), -1 = Fairy Bubble (sensor)
      this.x = x; this.y = y;
      this.vx = 0; this.vy = 0;
      this.r = r; this.rT = r;
      this.setMass(r);
      this.age = 0;
      this.danger = 0;
      this.dead = false;
      this.sensor = false;
      this.anchored = false; // bubbles: no pull, no drift
      this.mergeLock = 0;
      this.launched = false;
      this.touch = false;    // touched another cake in the last step (then it turns with the pool)
      this.shotId = 0;       // which shot caused the motion (for combos)
      // visuals
      this.sq = 0; this.sqv = 0; this.sqa = 0;
      this.pop = 1;          // 0 -> 1 pop-in animation
      this.phase = Math.random() * TAU;
      this.blinkT = FC.rand(0.8, 4);
      this.blink = 0;
      this.expr = null; this.exprT = 0;
      this.lookX = 0; this.lookY = 0;
      this.wakeT = 0;
      this.flash = 0;
    }
    setMass(r) {
      this.m = Math.pow(r / 100, CFG.MASS_EXP) * 1e4;
      this.im = 1 / this.m;
    }
    speed() {
      return Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    }
  }

  class World {
    constructor() {
      this.bodies = [];
      this.acc = 0;
      this.time = 0;
      // handlers are set by the game
      this.onMerge = null;   // (a,b) -> void  (two identical cakes touch)
      this.onJoker = null;   // (joker, cake) -> void
      this.onSensor = null;  // (sensor, body) -> void
      this.onImpact = null;  // (a,b,strength,nx,ny,x,y)
      this.onRim = null;     // (b,strength,nx,ny)
      this.paused = false;
      // the water (set by the game)
      this.omegaCore = CFG.OMEGA_MIN; // rad/s – the calm middle turns the pile at this rate
      this.vRim = CFG.VRIM_MIN;       // u/s – speed of the rim current
      this.rCalm = CFG.RING_MIN;      // radius of the calm pool = the dotted ring (grows with the stages)
      this.spin = 0;                  // rad/s – extra turn everywhere (the stage whirl)
      this.shear = 0;                 // rad/s – the whirl turns the rim faster than the middle (shear tears the cluster apart)
      this.free = false;              // the whirl: nothing is held by the cluster, every cake follows the water where it is
      this.twinK = 1;                 // fairy magnetism multiplier (the whirl brings twins together)
      this.twinAlways = false;        // ... and pulls resting twins too
      this.inflowK = 1;               // inflow multiplier (negative: the whirl pushes everything out; > 1: it packs the pile while it settles)
    }

    add(b) {
      this.bodies.push(b);
      return b;
    }

    clear() {
      this.bodies.length = 0;
    }

    count(filter) {
      let n = 0;
      for (const b of this.bodies) if (!b.dead && (!filter || filter(b))) n++;
      return n;
    }

    // ---------- the water ----------
    // 0 = calm middle, 1 = rim band
    bandK(d) {
      return smooth(this.rCalm, this.rCalm + CFG.BAND_RAMP, d);
    }
    // angular rate of the water at distance d from the centre
    omegaAt(d) {
      const core = this.omegaCore + this.spin + this.shear * (d / CFG.R - 0.5);
      const k = this.bandK(d);
      if (k <= 0) return core;
      const rim = this.vRim / Math.max(d, 200) + this.spin + this.shear * (d / CFG.R - 0.5);
      return core + (Math.max(rim, core) - core) * k;
    }
    // inward drift of the water at distance d (positive = towards the centre), before size and whirl factors
    inflowAt(d) {
      const k = Math.min(1, Math.max(0, (d - CFG.INFLOW_CORE) / Math.max(1, this.rCalm - CFG.INFLOW_CORE)));
      const core = CFG.INFLOW_MIN + (CFG.INFLOW - CFG.INFLOW_MIN) * k * Math.min(1, d / 120);
      const b = this.bandK(d);
      return core + (CFG.INFLOW_BAND - core) * b;
    }
    // water velocity at (x, y) for a cake of radius r, split into the turning part (t) and the inward part (n).
    // held = the cake touches the pile: it turns with the calm pool wherever it is
    flowAt(x, y, out, r, held) {
      const d = Math.sqrt(x * x + y * y);
      const om = held && !this.free ? this.omegaCore + this.spin : this.omegaAt(d);
      out.tx = -y * om; out.ty = x * om;
      if (d > 1) {
        const vin = this.inflowAt(d) * this.inflowK * (r == null ? 1 : sizeK(r));
        out.nx = -(x / d) * vin; out.ny = -(y / d) * vin;
      } else { out.nx = 0; out.ny = 0; }
      out.x = out.tx + out.nx; out.y = out.ty + out.ny;
      return out;
    }
    // the water a moving cake "feels": a fast cake skims over the drain but is still swept a little by the current
    feltFlow(x, y, speed, out, r, held) {
      this.flowAt(x, y, out, r, held);
      const fk = floatK(speed);
      const ft = CFG.TAN_K + (1 - CFG.TAN_K) * fk;
      out.x = out.tx * ft + out.nx * fk;
      out.y = out.ty * ft + out.ny * fk;
      return out;
    }

    // the pure part of a merge: a + b -> one bigger cake that keeps the momentum,
    // and (optionally) a little burst that nudges the neighbours – chain reactions
    mergeBodies(a, b, nt, rT, nudge) {
      a.dead = b.dead = true;
      const ms = a.m + b.m;
      const x = (a.x * a.m + b.x * b.m) / ms;
      const y = (a.y * a.m + b.y * b.m) / ms;
      const nb = new Body(nt, Math.max(a.r, b.r), x, y);
      nb.rT = rT;
      nb.setMass(rT);
      nb.vx = (a.vx * a.m + b.vx * b.m) / ms * 0.6;
      nb.vy = (a.vy * a.m + b.vy * b.m) / ms * 0.6;
      nb.age = Math.max(0.8, Math.min(a.age, b.age));
      nb.shotId = Math.max(a.shotId, b.shotId);
      this.add(nb);
      if (nudge) {
        for (const o of this.bodies) {
          if (o.dead || o === nb || o.sensor || o.anchored) continue;
          const dx = o.x - x, dy = o.y - y, d = Math.sqrt(dx * dx + dy * dy) || 1;
          const R = nb.rT * 2.3 + o.r;
          if (d >= R) continue;
          const k = 300 * (1 - d / R) * Math.min(1.5, nb.m / (o.m + nb.m) * 2);
          o.vx += (dx / d) * k; o.vy += (dy / d) * k;
          o.sqv += 2.2;
        }
      }
      return nb;
    }

    // turn every resting cake with the water for t seconds (where will the pile be?)
    advance(t) {
      if (!t) return;
      for (const b of this.bodies) {
        if (b.dead) continue;
        if (b.launched && b.vx * b.vx + b.vy * b.vy > CFG.SKIM_LO * CFG.SKIM_LO) continue;
        const d = Math.sqrt(b.x * b.x + b.y * b.y);
        const da = (b.touch ? this.omegaCore + this.spin : this.omegaAt(d)) * t;
        const c = Math.cos(da), s = Math.sin(da);
        const x = b.x, y = b.y;
        b.x = x * c - y * s; b.y = x * s + y * c;
        const vx = b.vx, vy = b.vy;
        b.vx = vx * c - vy * s; b.vy = vx * s + vy * c;
      }
    }

    // a light copy for look-ahead simulations (no handlers, no visuals)
    clone() {
      const w = new World();
      w.omegaCore = this.omegaCore; w.vRim = this.vRim; w.rCalm = this.rCalm; w.spin = this.spin;
      w.shear = this.shear; w.free = this.free; w.twinK = this.twinK; w.twinAlways = this.twinAlways;
      w.inflowK = this.inflowK;
      for (const b of this.bodies) {
        if (b.dead) continue;
        const c = new Body(b.tier, b.r, b.x, b.y);
        c.id = b.id; c.rT = b.rT; c.setMass(b.rT);
        c.vx = b.vx; c.vy = b.vy;
        c.age = b.age; c.mergeLock = b.mergeLock;
        c.sensor = b.sensor; c.anchored = b.anchored;
        c.launched = b.launched; c.shotId = b.shotId; c.touch = b.touch;
        w.bodies.push(c);
      }
      return w;
    }

    // What happens after the first contact? Run the real physics on a copy for a short while:
    // merges (incl. chain reactions) and how far the hit cake gets pushed.
    // tierR(t) gives the radius of tier t; maxTier the top of the ladder.
    lookAhead(hit, shot, opts) {
      const o = opts || {};
      const T = o.time || 0.8, h = o.step || 1 / 120;
      const w = this.clone();
      // the ghost flew for hit.t seconds while the resting cakes turned with the water
      if (hit.t) w.advance(hit.t);
      const s = new Body(shot.tier, shot.r, hit.x, hit.y);
      s.id = -1;
      s.vx = hit.vx; s.vy = hit.vy;
      s.launched = true; s.age = 0.5;
      w.add(s);
      const events = [];
      const before = new Map();
      for (const b of w.bodies) before.set(b.id, { x: b.x, y: b.y, r: b.r, tier: b.tier });
      w.onMerge = (a, b) => {
        const t = a.tier;
        if (t >= o.maxTier) {
          a.dead = b.dead = true;
          events.push({ kind: 'royal', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, t: w.time });
          return;
        }
        const nb = w.mergeBodies(a, b, t + 1, o.tierR(t + 1), true);
        nb.id = -2 - events.length;
        events.push({ kind: 'merge', x: nb.x, y: nb.y, tier: t + 1, r: nb.rT, t: w.time, ids: [a.id, b.id], body: nb });
      };
      w.onJoker = (j, c) => {
        if (j.dead || c.dead) return;
        j.dead = true;
        if (c.tier >= o.maxTier) { c.dead = true; events.push({ kind: 'royal', x: c.x, y: c.y, t: w.time }); return; }
        const nt = c.tier + 1;
        c.tier = nt; c.rT = o.tierR(nt); c.setMass(c.rT);
        events.push({ kind: 'magic', x: c.x, y: c.y, tier: nt, r: c.rT, t: w.time, ids: [c.id], body: c });
      };
      let guard = 0;
      for (let t = 0; t < T && guard++ < 400; t += h) {
        w.substep(h);
        w.time += h;
      }
      // the same stretch of time without the flick: the water moves everything anyway, and only
      // what the flick changes on top of that counts as "pushed"
      const base = this.clone();
      if (hit.t) base.advance(hit.t);
      base.canMerge = () => false;
      guard = 0;
      for (let t = 0; t < T && guard++ < 400; t += h) base.substep(h);
      const quiet = new Map();
      for (const b of base.bodies) if (!b.dead) quiet.set(b.id, { x: b.x, y: b.y });
      // where did everybody end up, compared with where it would have been anyway?
      const moved = [];
      for (const b of w.bodies) {
        if (b.dead || b.id < 0 || b.sensor) continue;
        const p = before.get(b.id), q = quiet.get(b.id);
        if (!p || !q) continue;
        const dx = b.x - q.x, dy = b.y - q.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > b.r * 0.5) moved.push({ id: b.id, x0: p.x, y0: p.y, x: b.x, y: b.y, r: b.r, tier: b.tier, dist: d });
      }
      const shotEnd = s.dead ? null : { x: s.x, y: s.y };
      return { events, moved, shotEnd };
    }

    step(dt) {
      if (this.paused) return;
      this.acc += Math.min(dt, 0.1);
      const h = CFG.STEP;
      let guard = 0;
      while (this.acc >= h && guard++ < 40) {
        this.substep(h);
        this.acc -= h;
        this.time += h;
      }
      // remove dead bodies
      let w = 0;
      const B = this.bodies;
      for (let i = 0; i < B.length; i++) if (!B[i].dead) B[w++] = B[i];
      B.length = w;
    }

    canMerge(a, b) {
      return a.tier >= 1 && a.tier === b.tier && a.mergeLock <= 0 && b.mergeLock <= 0 && !a.dead && !b.dead;
    }

    substep(h) {
      const C = CFG;
      const B = this.bodies;
      const n = B.length;

      // 1) water: skim friction relative to the current the cake feels, growth
      const W = this._w || (this._w = { x: 0, y: 0, tx: 0, ty: 0, nx: 0, ny: 0 }), RV = this._r || (this._r = { x: 0, y: 0 });
      for (let i = 0; i < n; i++) {
        const b = B[i];
        if (b.dead) continue;
        b.age += h;
        if (b.mergeLock > 0) b.mergeLock -= h;
        if (b.r !== b.rT) {
          const d = b.rT - b.r, g = C.GROW_RATE * h;
          b.r = Math.abs(d) <= g ? b.rT : b.r + Math.sign(d) * g;
        }
        if (b.anchored) {
          b.vx *= 0.9; b.vy *= 0.9;
          continue;
        }
        const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        this.feltFlow(b.x, b.y, sp, W, b.r, b.touch);
        RV.x = b.vx - W.x; RV.y = b.vy - W.y;
        rub(RV, h);
        b.vx = W.x + RV.x;
        b.vy = W.y + RV.y;
        b.touch = false;
      }

      // 2) fairy magnetism: a moving cake is drawn to a twin with a small gap (resting twins wait for a push –
      //    except during the whirl, which brings twins together on purpose)
      const mv2 = C.TWIN_MOVE * C.TWIN_MOVE;
      const tk = this.twinK, always = this.twinAlways;
      for (let i = 0; i < n; i++) {
        const a = B[i];
        if (a.dead || a.tier < 1) continue;
        const am = always || a.vx * a.vx + a.vy * a.vy > mv2;
        for (let j = i + 1; j < n; j++) {
          const b = B[j];
          if (b.dead || b.tier !== a.tier) continue;
          if (!am && b.vx * b.vx + b.vy * b.vy <= mv2) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const rs = a.r + b.r;
          const range = C.TWIN_RANGE * tk * Math.min(a.r, b.r);
          const lim = rs + range;
          if (Math.abs(dx) > lim || Math.abs(dy) > lim) continue;
          const d = Math.sqrt(dx * dx + dy * dy);
          const gap = d - rs;
          if (gap <= 0 || gap >= range) continue;
          const acc = C.TWIN_ACC * tk * (1 - gap / range) * h;
          const nx = dx / d, ny = dy / d;
          a.vx += nx * acc; a.vy += ny * acc;
          b.vx -= nx * acc; b.vy -= ny * acc;
        }
      }

      // 3) integrate
      for (let i = 0; i < n; i++) {
        const b = B[i];
        if (b.dead || b.anchored) continue;
        b.x += b.vx * h;
        b.y += b.vy * h;
      }

      // 4) resolve contacts (several iterations)
      for (let it = 0; it < C.ITER; it++) {
        for (let i = 0; i < n; i++) {
          const a = B[i];
          if (a.dead) continue;
          for (let j = i + 1; j < n; j++) {
            const b = B[j];
            if (b.dead) continue;
            const dx = b.x - a.x, dy = b.y - a.y;
            const rs = a.r + b.r;
            const space = C.SPACE * (a.r < b.r ? a.r : b.r);
            const lim = rs + space;
            if (dx > lim || dx < -lim || dy > lim || dy < -lim) continue;
            const d2 = dx * dx + dy * dy;
            if (d2 >= lim * lim) continue;
            if (d2 >= rs * rs) {
              // not touching, but closer than their personal space: ease them apart (both at rest-ish: a soft cushion)
              if (it === 0 && !this.free && !a.sensor && !b.sensor && !a.anchored && !b.anchored) {
                const d = Math.sqrt(d2) || 0.0001;
                const nx = dx / d, ny = dy / d;
                const corr = (lim - d) * C.SPACE_K / (a.im + b.im);
                a.x -= nx * corr * a.im; a.y -= ny * corr * a.im;
                b.x += nx * corr * b.im; b.y += ny * corr * b.im;
              }
              continue;
            }

            if (!a.sensor && !b.sensor) { a.touch = b.touch = true; }
            // special cases: sensor, joker, merge
            if (a.sensor || b.sensor) {
              if (a.sensor && !b.sensor && this.onSensor) this.onSensor(a, b);
              else if (b.sensor && !a.sensor && this.onSensor) this.onSensor(b, a);
              continue;
            }
            if (a.tier === 0 || b.tier === 0) {
              if (a.tier === 0 && b.tier >= 1 && this.onJoker) { this.onJoker(a, b); if (a.dead) continue; }
              else if (b.tier === 0 && a.tier >= 1 && this.onJoker) { this.onJoker(b, a); if (b.dead) continue; }
            } else if (this.canMerge(a, b) && this.onMerge) {
              this.onMerge(a, b);
              if (a.dead || b.dead) continue;
            }

            const d = Math.sqrt(d2) || 0.0001;
            const nx = dx / d, ny = dy / d;
            const pen = rs - d;
            const wsum = a.im + b.im;
            const aw = a.anchored ? 0 : a.im, bw = b.anchored ? 0 : b.im;
            const ws = aw + bw || 1;
            const corr = (Math.max(0, pen - 0.02) * 0.8) / ws;
            a.x -= nx * corr * aw; a.y -= ny * corr * aw;
            b.x += nx * corr * bw; b.y += ny * corr * bw;

            const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
            const vn = rvx * nx + rvy * ny;
            if (vn < 0) {
              const e = -vn > C.REST_MIN_SPEED ? C.REST : 0;
              const jn = (-(1 + e) * vn) / wsum;
              a.vx -= nx * jn * a.im; a.vy -= ny * jn * a.im;
              b.vx += nx * jn * b.im; b.vy += ny * jn * b.im;
              // a little tangential friction – measured in the turning water's frame,
              // so a pile can turn as a whole with the calm middle
              const tx = -ny, ty = nx;
              const cxm = (a.x + b.x) * 0.5, cym = (a.y + b.y) * 0.5;
              const om = this.omegaAt(Math.sqrt(cxm * cxm + cym * cym));
              const vt = rvx * tx + rvy * ty - om * d;
              const jt = (-vt / wsum) * 0.06;
              a.vx -= tx * jt * a.im; a.vy -= ty * jt * a.im;
              b.vx += tx * jt * b.im; b.vy += ty * jt * b.im;
              if (it === 0 && -vn > 70 && this.onImpact) {
                this.onImpact(a, b, -vn, nx, ny, a.x + nx * a.r, a.y + ny * a.r);
              }
            }
          }
        }
        // rim
        for (let i = 0; i < n; i++) {
          const b = B[i];
          if (b.dead) continue;
          const d = Math.sqrt(b.x * b.x + b.y * b.y);
          const lim = C.R - b.r;
          if (d > lim) {
            const nx = b.x / d, ny = b.y / d;
            b.x = nx * lim; b.y = ny * lim;
            const vn = b.vx * nx + b.vy * ny;
            if (vn > 0) {
              const e = vn > C.REST_MIN_SPEED ? C.REST_RIM : 0;
              b.vx -= nx * vn * (1 + e);
              b.vy -= ny * vn * (1 + e);
              if (it === 0 && vn > 90 && this.onRim) this.onRim(b, vn, nx, ny);
            }
          }
        }
      }
    }

    // Trajectory preview: a "ghost" flies against the resting cakes, which turn with the water meanwhile.
    // Returns path points + first contact. After the glide the ghost keeps floating with the
    // current (dots marked drift) until it touches the pile: the whole move is on screen.
    predict(x, y, vx, vy, r, tier, opts) {
      const C = CFG;
      const o = opts || {};
      const maxT = o.maxT || 3.2;
      const driftT = o.driftT == null ? 6 : o.driftT;
      const maxLen = o.maxLen || 2600;
      const spacing = o.spacing || 34;
      const h = 1 / 120;
      const pts = [{ x, y }];
      let acc = 0, len = 0;
      let hit = null, bounces = 0;
      const B = this.bodies;
      let px = x, py = y;
      let sensorHits = [];
      let stopped = false, land = null, tLand = 0;
      const W = { x: 0, y: 0, tx: 0, ty: 0, nx: 0, ny: 0 }, RV = { x: 0, y: 0 };
      // where is everybody at time t? resting cakes turn with the water at their own radius
      const nb = B.length;
      const bw = new Float64Array(nb), bd = new Float64Array(nb);
      for (let i = 0; i < nb; i++) {
        const b = B[i];
        bd[i] = Math.sqrt(b.x * b.x + b.y * b.y);
        bw[i] = b.anchored ? 0 : b.touch ? this.omegaCore + this.spin : this.omegaAt(bd[i]);
      }
      const bx = new Float64Array(nb), by = new Float64Array(nb);
      for (let t = 0; t < maxT + driftT; t += h) {
        if (land && t - tLand > driftT) break;
        for (let i = 0; i < nb; i++) {
          const b = B[i];
          const a = bw[i] * t, ct = Math.cos(a), st = Math.sin(a);
          bx[i] = b.x * ct - b.y * st; by[i] = b.x * st + b.y * ct;
        }
        const sp = Math.sqrt(vx * vx + vy * vy);
        this.feltFlow(x, y, sp, W, r);
        RV.x = vx - W.x; RV.y = vy - W.y;
        // magnetism towards identical cakes
        if (tier >= 1) {
          for (let i = 0; i < nb; i++) {
            const b = B[i];
            if (b.dead || b.tier !== tier) continue;
            const dx = bx[i] - x, dy = by[i] - y;
            const dd = Math.sqrt(dx * dx + dy * dy);
            const range = C.TWIN_RANGE * Math.min(r, b.r);
            const gap = dd - r - b.r;
            if (gap > 0 && gap < range) {
              const acc2 = C.TWIN_ACC * (1 - gap / range) * h;
              RV.x += (dx / dd) * acc2; RV.y += (dy / dd) * acc2;
            }
          }
        }
        rub(RV, h);
        vx = W.x + RV.x; vy = W.y + RV.y;
        px = x; py = y;
        x += vx * h; y += vy * h;
        const rel = Math.sqrt(RV.x * RV.x + RV.y * RV.y);

        // contact?
        let contact = null, cbx = 0, cby = 0;
        for (let i = 0; i < nb; i++) {
          const b = B[i];
          if (b.dead) continue;
          const rr = r + b.r;
          const dx = bx[i] - x, dy = by[i] - y;
          if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
          if (dx * dx + dy * dy < rr * rr) {
            if (b.sensor) {
              if (sensorHits.indexOf(b) < 0) sensorHits.push(b);
              continue;
            }
            contact = b; cbx = bx[i]; cby = by[i];
            break;
          }
        }
        if (contact) {
          // refine the contact point by bisection
          let lo = 0, hi = 1;
          for (let k2 = 0; k2 < 8; k2++) {
            const mid = (lo + hi) / 2;
            const mx = px + (x - px) * mid, my = py + (y - py) * mid;
            const dx = cbx - mx, dy = cby - my;
            if (dx * dx + dy * dy < (r + contact.r) * (r + contact.r)) hi = mid;
            else lo = mid;
          }
          x = px + (x - px) * lo;
          y = py + (y - py) * lo;
          pts.push({ x, y });
          hit = { body: contact, x, y, vx, vy, bx: cbx, by: cby, t };
          break;
        }

        // rim
        const dd = Math.sqrt(x * x + y * y);
        const lim = C.R - r;
        if (dd > lim) {
          const nx = x / dd, ny = y / dd;
          x = nx * lim; y = ny * lim;
          const vn = vx * nx + vy * ny;
          if (vn > 0) {
            const e = vn > C.REST_MIN_SPEED ? C.REST_RIM : 0;
            vx -= nx * vn * (1 + e);
            vy -= ny * vn * (1 + e);
            if (vn > C.REST_MIN_SPEED) {
              bounces++;
              pts.push({ x, y, bounce: true });
            }
          }
        }

        const step = Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
        acc += step; len += step;
        if (acc >= (land ? spacing * 1.4 : spacing)) {
          acc = 0;
          pts.push(land ? { x, y, drift: true } : { x, y });
        }
        if (!land && len > maxLen) break;
        // the glide is over once the cake moves with the current: that's where it lands.
        // From here on the current carries it to the pile.
        if (!land && rel < (o.landSpeed || 45) && t > 0.08) {
          stopped = true;
          land = { x, y, t };
          tLand = t;
          if (!driftT) break;
          if (Math.sqrt(x * x + y * y) < 60) break; // nothing to drift to (empty pond)
        }
        // drifting cakes that come to rest stop the preview
        if (land && t - tLand > 0.3 && Math.sqrt(vx * vx + vy * vy) < 8) break;
      }
      if (hit && land) hit.drift = true;
      return { pts, hit, bounces, end: { x, y }, land, stopped, sensors: sensorHits };
    }
  }

  FC.Physics = { CFG, Body, World, floatK, sizeK, speedForDistance, speedForPower };
})();
