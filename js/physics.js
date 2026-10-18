/* Fairycake Falls – physics.
   Cakes skim over the pond like curling stones: a nearly constant friction gives
   long, even glides in a straight line and a crisp stop (what you see is what you get).
   Only once a cake is slow does the whirlpool current carry it to the middle and
   slowly round. Circle collisions are billiards-like; identical cakes attract a
   little ("fairy magnetism").
   World units: inner pond radius R = 1000, centre (0,0), y points down. */
(function () {
  'use strict';
  const FC = window.FC;
  const TAU = FC.TAU;

  const CFG = {
    R: 1000,               // inner pond radius
    DANGER: 880,           // dotted ring: a cake's edge must not rest beyond this
    DANGER_TIME: 4.0,      // seconds a cake may rest beyond the ring
    // skimming
    FRICTION: 1250,        // u/s^2, relative to the water: even glide, crisp stop
    FRIC_EPS: 40,          // below this relative speed friction turns smoothly viscous (no jitter)
    DRAG: 0.45,            // small linear drag (1/s)
    // the whirlpool current
    INFLOW: 270,           // u/s towards the centre – carries slow cakes to the pile
    INFLOW_CORE: 240,      // ... fading out in the core
    SKIM_LO: 380,          // below this speed a cake floats with the current,
    SKIM_HI: 820,          // above this it skims straight over it
    SWIRL_MIN: 0.04,       // whirlpool turn rate at level 1 (rad/s) ...
    SWIRL_MAX: 0.12,       // ... and from level 10 on
    // collisions
    REST: 0.5,             // cake-cake bounciness
    REST_RIM: 0.6,         // rim bounciness
    REST_MIN_SPEED: 110,   // below this, no bounce (calm packing)
    TWIN_RANGE: 0.8,       // fairy magnetism range (x smaller radius, as gap width)
    TWIN_ACC: 3200,
    GROW_RATE: 340,        // u/s – growth speed of a freshly merged cake
    // flicks: pull length maps linearly to travel distance
    D_MIN: 160,            // distance of the gentlest flick (u)
    D_MAX: 2400,           // distance of a full-power flick (crosses the pond and bounces back)
    STEP: 1 / 240,
    ITER: 3,
  };

  // water velocity at (x, y): slow swirl + inflow towards the centre
  function water(x, y, swirl, out) {
    const d = Math.sqrt(x * x + y * y);
    let wx = -y * swirl, wy = x * swirl;
    if (d > 1) {
      const k = d / CFG.INFLOW_CORE;
      const f = k >= 1 ? 1 : k * k * (3 - 2 * k);
      wx -= (x / d) * CFG.INFLOW * f;
      wy -= (y / d) * CFG.INFLOW * f;
    }
    out.x = wx; out.y = wy;
  }
  // 1 = floats with the current, 0 = skims straight over it
  function floatK(speed) {
    if (speed <= CFG.SKIM_LO) return 1;
    if (speed >= CFG.SKIM_HI) return 0;
    const k = (speed - CFG.SKIM_LO) / (CFG.SKIM_HI - CFG.SKIM_LO);
    return 1 - k * k * (3 - 2 * k);
  }
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
      this.m = r * r;
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
      this.swirl = 0;        // rad/s – the pond water turns slowly like a whirlpool (set by the game)
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

      // 1) water: skim friction relative to the current, growth
      const om = this.swirl, W = this._w || (this._w = { x: 0, y: 0 }), RV = this._r || (this._r = { x: 0, y: 0 });
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
        const fk = floatK(sp);
        water(b.x, b.y, om, W);
        const wx = W.x * fk, wy = W.y * fk;
        RV.x = b.vx - wx; RV.y = b.vy - wy;
        rub(RV, h);
        b.vx = wx + RV.x;
        b.vy = wy + RV.y;
      }

      // 2) fairy magnetism: identical cakes with a small gap attract each other
      for (let i = 0; i < n; i++) {
        const a = B[i];
        if (a.dead || a.tier < 1) continue;
        for (let j = i + 1; j < n; j++) {
          const b = B[j];
          if (b.dead || b.tier !== a.tier) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const rs = a.r + b.r;
          const range = C.TWIN_RANGE * Math.min(a.r, b.r);
          const lim = rs + range;
          if (Math.abs(dx) > lim || Math.abs(dy) > lim) continue;
          const d = Math.sqrt(dx * dx + dy * dy);
          const gap = d - rs;
          if (gap <= 0 || gap >= range) continue;
          const acc = C.TWIN_ACC * (1 - gap / range) * h;
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
            if (dx > rs || dx < -rs || dy > rs || dy < -rs) continue;
            const d2 = dx * dx + dy * dy;
            if (d2 >= rs * rs) continue;

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
              // so a pile can turn as a whole with the whirlpool
              const tx = -ny, ty = nx;
              const vt = rvx * tx + rvy * ty - this.swirl * d;
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

    // Trajectory preview: a "ghost" flies against the (frozen) cakes.
    // Returns path points + first contact.
    predict(x, y, vx, vy, r, tier, opts) {
      const C = CFG;
      const o = opts || {};
      const maxT = o.maxT || 3.2;
      const maxLen = o.maxLen || 2600;
      const spacing = o.spacing || 34;
      const h = 1 / 120;
      const pts = [{ x, y }];
      let acc = 0, len = 0;
      let hit = null, bounces = 0;
      const B = this.bodies;
      let px = x, py = y;
      let sensorHits = [];
      let stopped = false;
      const om = this.swirl;
      const W = { x: 0, y: 0 }, RV = { x: 0, y: 0 };
      for (let t = 0; t < maxT; t += h) {
        // resting cakes turn with the water: where is everybody at time t?
        const ct = Math.cos(om * t), st = Math.sin(om * t);
        const sp = Math.sqrt(vx * vx + vy * vy);
        const fk = floatK(sp);
        water(x, y, om, W);
        const wx = W.x * fk, wy = W.y * fk;
        RV.x = vx - wx; RV.y = vy - wy;
        // magnetism towards identical cakes
        if (tier >= 1) {
          for (const b of B) {
            if (b.dead || b.tier !== tier) continue;
            const bx = b.anchored ? b.x : b.x * ct - b.y * st, by = b.anchored ? b.y : b.x * st + b.y * ct;
            const dx = bx - x, dy = by - y;
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
        vx = wx + RV.x; vy = wy + RV.y;
        px = x; py = y;
        x += vx * h; y += vy * h;
        const rel = Math.sqrt(RV.x * RV.x + RV.y * RV.y);

        // contact?
        let contact = null, cbx = 0, cby = 0;
        for (const b of B) {
          if (b.dead) continue;
          const rr = r + b.r;
          const bx = b.anchored ? b.x : b.x * ct - b.y * st, by = b.anchored ? b.y : b.x * st + b.y * ct;
          const dx = bx - x, dy = by - y;
          if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
          if (dx * dx + dy * dy < rr * rr) {
            if (b.sensor) {
              if (sensorHits.indexOf(b) < 0) sensorHits.push(b);
              continue;
            }
            contact = b; cbx = bx; cby = by;
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
        if (acc >= spacing) {
          acc = 0;
          pts.push({ x, y });
        }
        if (len > maxLen) break;
        // the glide is over once the cake moves with the current: that's where it lands
        if (rel < (o.landSpeed || 45) && t > 0.08) { stopped = true; break; }
      }
      return { pts, hit, bounces, end: { x, y }, stopped, sensors: sensorHits };
    }
  }

  FC.Physics = { CFG, Body, World, water, floatK, speedForDistance, speedForPower };
})();
