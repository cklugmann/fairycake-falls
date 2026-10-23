/* Fairycake Falls – the weather of the worlds.
   Every world gets its own life on top of the painted layers, so that each one feels like a place of its own:
     Blossom Falls   – cherry petals drifting down, butterflies over the far bank, petals riding the current
     Candy Woods     – maple leaves tumbling in autumn gusts, a flock of birds heading south, leaves on the water
     Moonlight Bay   – fireflies round the banks, a moonlit glitter path on the water, now and then a shooting star
     Rainbow Heights – hot-air balloons and quick cloud wisps far away, sparkles running along the rainbow,
                       prism glints and rainbow sprinkles on the water, soap bubbles floating up
     Starfall Realm  – the aurora waving over the castle, shooting stars, golden motes, stars twinkling on the water
   It hooks into the scene in four places: the sky (behind clouds and islands), over the far scenery, on the water
   (under the cakes) and in front (over everything but the HUD). All of it is drawn in screen space from small
   sprites rendered once at the device pixel ratio, the counts are capped and scale with the screen, and whatever
   crosses the pond or the sling fades back so it never hides a cake or muddles the aim. */
(function () {
  'use strict';
  const FC = window.FC;
  const S = FC.Scene;
  const TAU = FC.TAU;
  const rand = FC.rand;

  // ------------------------------------------------------------------
  // sprites: small canvases painted once per device pixel ratio
  // ------------------------------------------------------------------
  const sprites = new Map();
  function sprite(key, w, h, paint) {
    const dpr = S.dpr || 1;
    const k = key + '@' + dpr;
    let sp = sprites.get(k);
    if (!sp) {
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.ceil(w * dpr));
      cv.height = Math.max(1, Math.ceil(h * dpr));
      const c = cv.getContext('2d');
      c.scale(dpr, dpr);
      paint(c, w, h);
      sp = { cv, w, h };
      sprites.set(k, sp);
    }
    return sp;
  }
  // draw a sprite centred at (x, y), w px wide, turned by rot, squashed vertically by fy (a tumbling flip)
  function blit(ctx, sp, x, y, w, rot, fy) {
    const h = (w * sp.h) / sp.w;
    if (!rot && (fy == null || fy === 1)) { ctx.drawImage(sp.cv, x - w / 2, y - h / 2, w, h); return; }
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    if (fy != null && fy !== 1) ctx.scale(1, fy);
    ctx.drawImage(sp.cv, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // a cherry petal: a soft oval with the little notch at its tip
  function petalSprite(col) {
    return sprite('petal' + col, 16, 16, (c, w, h) => {
      c.translate(w / 2, h / 2);
      c.beginPath();
      c.moveTo(0, h * 0.42);
      c.bezierCurveTo(-w * 0.44, h * 0.16, -w * 0.4, -h * 0.4, -w * 0.09, -h * 0.38);
      c.lineTo(0, -h * 0.25);
      c.lineTo(w * 0.09, -h * 0.38);
      c.bezierCurveTo(w * 0.4, -h * 0.4, w * 0.44, h * 0.16, 0, h * 0.42);
      c.closePath();
      const g = c.createRadialGradient(0, h * 0.28, 0.5, 0, 0, w * 0.55);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.45, FC.mix(col, '#ffffff', 0.35));
      g.addColorStop(1, col);
      c.fillStyle = g;
      c.fill();
      c.lineWidth = 0.9;
      c.strokeStyle = FC.rgba(FC.shade(col, -0.3), 0.6);
      c.stroke();
    });
  }

  // a maple leaf (the same five-lobed leaf the asset generator scatters on the banks)
  const MAPLE = [[220, 0.3], [252, 0.64], [280, 0.44], [308, 0.92], [334, 0.47], [0, 1], [26, 0.47], [52, 0.92], [80, 0.44], [108, 0.64], [140, 0.3], [180, 0.2]];
  const LEAF_COLS = [
    { light: '#ffb06a', mid: '#f2802f', dark: '#c85a22', line: '#8a3618' },
    { light: '#ff8a6a', mid: '#e8503c', dark: '#b6332f', line: '#7a1f23' },
    { light: '#ffe07a', mid: '#f2b232', dark: '#c78620', line: '#8a5414' },
    { light: '#e8a070', mid: '#c87a48', dark: '#9a5530', line: '#6a3520' },
  ];
  function leafSprite(k) {
    const col = LEAF_COLS[k % LEAF_COLS.length];
    return sprite('maple' + k, 24, 24, (c, w) => {
      const s = w * 0.44;
      c.translate(w / 2, w / 2);
      c.lineJoin = 'round';
      c.beginPath();
      MAPLE.forEach((p, i) => {
        const a = (p[0] * Math.PI) / 180, x = Math.sin(a) * p[1] * s, y = -Math.cos(a) * p[1] * s + s * 0.12;
        if (i) c.lineTo(x, y); else c.moveTo(x, y);
      });
      c.closePath();
      const g = c.createLinearGradient(-s, -s, s, s);
      g.addColorStop(0, col.light); g.addColorStop(0.55, col.mid); g.addColorStop(1, col.dark);
      c.fillStyle = g;
      c.fill();
      c.lineWidth = 1.1;
      c.strokeStyle = FC.rgba(col.line, 0.75);
      c.stroke();
      c.lineCap = 'round';
      c.lineWidth = 0.9;
      c.strokeStyle = FC.rgba(col.dark, 0.85);
      c.beginPath();
      c.moveTo(0, s * 0.55); c.lineTo(0, -s * 0.72);
      c.moveTo(0, s * 0.05); c.lineTo(-s * 0.52, -s * 0.4);
      c.moveTo(0, s * 0.05); c.lineTo(s * 0.52, -s * 0.4);
      c.stroke();
    });
  }

  // a soft round glow (fireflies, golden motes)
  function glowSprite(key, core, halo) {
    return sprite('glow' + key, 32, 32, (c, w) => {
      const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      g.addColorStop(0, core);
      g.addColorStop(0.18, core);
      g.addColorStop(0.4, halo);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, w);
    });
  }

  // a sprinkle for the rainbow world's water
  function sprinkleSprite(col) {
    return sprite('spr' + col, 14, 6, (c, w, h) => {
      FC.roundRect(c, 1, 1, w - 2, h - 2, (h - 2) / 2);
      c.fillStyle = col;
      c.fill();
      c.lineWidth = 0.8;
      c.strokeStyle = FC.rgba(FC.shade(col, -0.35), 0.7);
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.7)';
      FC.roundRect(c, 3, 1.6, w * 0.45, 1.3, 0.6);
      c.fill();
    });
  }

  // a five-point star (starfall water, motes)
  function starSprite(col) {
    return sprite('star' + col, 16, 16, (c, w) => {
      FC.starPath(c, w / 2, w / 2 + 0.6, w * 0.42, 0.5);
      c.fillStyle = col;
      c.fill();
      c.lineWidth = 0.9;
      c.strokeStyle = FC.rgba(FC.shade(col, -0.35), 0.8);
      c.stroke();
    });
  }

  // a striped hot-air balloon with its basket (Rainbow Heights)
  const BALLOONS = [['#ff9fca', '#fff3b0'], ['#8fd0ff', '#ffffff'], ['#b8f0c8', '#c9a8ff'], ['#ffd08a', '#ff9fca']];
  function balloonSprite(k) {
    const cols = BALLOONS[k % BALLOONS.length];
    return sprite('balloon' + k, 40, 58, (c, w, h) => {
      const cx = w / 2, cy = h * 0.36, R = w * 0.42;
      const env = () => {
        c.beginPath();
        c.moveTo(cx - R * 0.28, cy + R * 1.18);
        c.bezierCurveTo(cx - R * 1.05, cy + R * 0.55, cx - R * 1.12, cy - R * 0.98, cx, cy - R);
        c.bezierCurveTo(cx + R * 1.12, cy - R * 0.98, cx + R * 1.05, cy + R * 0.55, cx + R * 0.28, cy + R * 1.18);
        c.closePath();
      };
      env();
      c.fillStyle = cols[0];
      c.fill();
      c.save();
      env();
      c.clip();
      c.fillStyle = cols[1];
      for (const u of [-0.62, 0, 0.62]) {
        c.beginPath();
        c.ellipse(cx + u * R, cy, R * 0.16 * (1 - Math.abs(u) * 0.3), R * 1.3, 0, 0, TAU);
        c.fill();
      }
      const sh = c.createLinearGradient(cx - R, 0, cx + R, 0);
      sh.addColorStop(0, 'rgba(255,255,255,0.35)');
      sh.addColorStop(0.5, 'rgba(255,255,255,0)');
      sh.addColorStop(1, 'rgba(60,40,110,0.22)');
      c.fillStyle = sh;
      c.fillRect(cx - R, cy - R, R * 2, R * 2.3);
      c.restore();
      env();
      c.lineWidth = 1.3;
      c.strokeStyle = 'rgba(110,80,150,0.65)';
      c.stroke();
      c.beginPath();
      c.ellipse(cx - R * 0.42, cy - R * 0.42, R * 0.2, R * 0.12, -0.6, 0, TAU);
      c.fillStyle = 'rgba(255,255,255,0.8)';
      c.fill();
      // ropes and basket
      c.strokeStyle = 'rgba(120,90,70,0.8)';
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(cx - R * 0.26, cy + R * 1.16); c.lineTo(cx - R * 0.2, h * 0.84);
      c.moveTo(cx + R * 0.26, cy + R * 1.16); c.lineTo(cx + R * 0.2, h * 0.84);
      c.stroke();
      FC.roundRect(c, cx - R * 0.27, h * 0.83, R * 0.54, h * 0.13, 2);
      c.fillStyle = '#d9a46a';
      c.fill();
      c.lineWidth = 1;
      c.strokeStyle = '#8a5a34';
      c.stroke();
    });
  }

  // a soap bubble with a rainbow rim (Rainbow Heights)
  function bubbleSprite() {
    return sprite('bubble', 32, 32, (c, w) => {
      const r = w * 0.44, cx = w / 2, cy = w / 2;
      const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
      g.addColorStop(0, 'rgba(255,255,255,0.28)');
      g.addColorStop(0.75, 'rgba(220,240,255,0.08)');
      g.addColorStop(1, 'rgba(255,220,250,0.3)');
      c.beginPath();
      c.arc(cx, cy, r, 0, TAU);
      c.fillStyle = g;
      c.fill();
      if (c.createConicGradient) {
        const cg = c.createConicGradient(0.6, cx, cy);
        ['#ff9fca', '#ffe27a', '#9fe8c0', '#8fd0ff', '#c9a8ff', '#ff9fca'].forEach((col, i) => cg.addColorStop(i / 5, col));
        c.strokeStyle = cg;
      } else c.strokeStyle = '#c9a8ff';
      c.lineWidth = 1.6;
      c.globalAlpha = 0.85;
      c.stroke();
      c.globalAlpha = 1;
      c.beginPath();
      c.arc(cx, cy, r * 0.72, Math.PI * 1.1, Math.PI * 1.45);
      c.lineWidth = 1.8;
      c.lineCap = 'round';
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.stroke();
    });
  }

  // a quick little cloud wisp (Rainbow Heights' altitude wind)
  function wispSprite() {
    return sprite('wisp', 96, 26, (c, w, h) => {
      c.filter = 'blur(3px)';
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.beginPath();
      c.ellipse(w * 0.5, h * 0.55, w * 0.38, h * 0.2, 0, 0, TAU);
      c.ellipse(w * 0.36, h * 0.45, w * 0.16, h * 0.2, 0, 0, TAU);
      c.ellipse(w * 0.6, h * 0.42, w * 0.18, h * 0.22, 0, 0, TAU);
      c.fill();
      c.filter = 'none';
    });
  }

  // ------------------------------------------------------------------
  // helpers
  // ------------------------------------------------------------------
  const area = () => FC.clamp((S.W * S.H) / (390 * 844), 0.75, 2.2);
  const count = (n) => Math.max(1, Math.round(n * area()));
  const scale = () => FC.clamp(S.pr / 175, 0.9, 1.7);
  // how much of a front particle shows at (x, y): little over the pond and the sling (so cakes and the aim stay clear)
  function clearK(x, y, low) {
    const dx = (x - S.cx) / (S.pr * 1.08), dy = (y - (S.cy + S.pr * 0.12)) / (S.pr * S.K * 1.08 + S.pr * 0.2);
    const d = dx * dx + dy * dy;
    const lo = low == null ? 0.3 : low;
    return d >= 1.2 ? 1 : d <= 0.85 ? lo : lo + (1 - lo) * ((d - 0.85) / 0.35);
  }
  // the sky above the island (where far-away things fly)
  const skyTop = () => Math.max(S.H * 0.02, 6);
  const skyBottom = () => Math.max(skyTop() + 40, S.bankTopY - S.pr * 0.05);

  // things that tumble down across the screen (petals, leaves)
  function faller(o, anywhere) {
    const sc = scale();
    return {
      x: rand(-30, S.W + 30), y: anywhere ? rand(-S.H * 0.05, S.H) : rand(-80, -20),
      vy: rand(o.vy[0], o.vy[1]) * sc, sway: rand(o.sway[0], o.sway[1]) * sc, fr: rand(0.5, 1.2), ph: rand(0, TAU),
      rot: rand(0, TAU), vr: rand(-o.spin, o.spin), flip: rand(0, TAU), vf: rand(1.4, 3.4),
      s: rand(o.size[0], o.size[1]) * sc, k: Math.floor(Math.random() * (o.kinds || 1)), t: 0,
    };
  }
  function updateFallers(list, o, dt, wind) {
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      f.t += dt;
      f.y += f.vy * dt;
      f.x += (wind || 0) * dt;
      f.rot += f.vr * dt;
      f.flip += f.vf * dt;
      if (f.y > S.H + 30 || f.x > S.W + 60 || f.x < -60) list[i] = faller(o, false);
    }
  }
  function drawFallers(ctx, list, alpha, sp, t) {
    for (const f of list) {
      const x = f.x + Math.sin(f.ph + t * f.fr) * f.sway;
      const a = alpha * clearK(x, f.y) * Math.min(1, f.t * 1.5 + (f.y > 0 ? 1 : 0));
      if (a < 0.02) continue;
      ctx.globalAlpha = a;
      blit(ctx, sp(f.k), x, f.y, f.s, f.rot, 0.25 + 0.75 * Math.abs(Math.cos(f.flip)));
    }
    ctx.globalAlpha = 1;
  }

  // a shooting star now and then across the top of the sky
  function shooter(st, dt, every) {
    let s = st.shoot;
    if (!s) s = st.shoot = { wait: rand(every[0] * 0.3, every[1]), on: false };
    if (!s.on) {
      s.wait -= dt;
      if (s.wait <= 0) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        s.on = true; s.t = 0; s.life = rand(0.8, 1.2);
        s.x = rand(S.W * 0.15, S.W * 0.85); s.y = rand(skyTop() + 10, skyTop() + (skyBottom() - skyTop()) * 0.55);
        const sp = Math.max(S.W, 500) * rand(0.55, 0.8);
        s.vx = dir * sp; s.vy = sp * rand(0.22, 0.4);
      }
    } else {
      s.t += dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.t >= s.life) { s.on = false; s.wait = rand(every[0], every[1]); }
    }
  }
  function drawShooter(ctx, st, alpha) {
    const s = st.shoot;
    if (!s || !s.on) return;
    const k = Math.sin(Math.PI * Math.min(1, s.t / s.life));
    const len = 0.13;
    const tx = s.x - s.vx * len, ty = s.y - s.vy * len;
    const g = ctx.createLinearGradient(tx, ty, s.x, s.y);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,250,220,' + (0.9 * k * alpha).toFixed(3) + ')');
    ctx.strokeStyle = g;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
    FC.sparklePath(ctx, s.x, s.y, 5 * k + 1, 0.3);
    ctx.fillStyle = 'rgba(255,255,240,' + (k * alpha).toFixed(3) + ')';
    ctx.fill();
  }

  // little twinkles that come and go at random spots (in the sky or on the water)
  function twinkle(fresh, place) {
    const p = place();
    return { x: p.x, y: p.y, t: fresh ? Math.random() : 0, d: rand(1.2, 2.6), s: rand(0.6, 1.2), k: Math.floor(Math.random() * 8) };
  }
  function updateTwinkles(list, dt, place) {
    for (let i = 0; i < list.length; i++) {
      list[i].t += dt / list[i].d;
      if (list[i].t >= 1) list[i] = twinkle(false, place);
    }
  }
  // a random spot on the water, in pond units (so it turns with nothing and survives a resize)
  function waterSpot() {
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * 0.86;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  }

  // ------------------------------------------------------------------
  // the five worlds
  // ------------------------------------------------------------------
  const PETAL_COLS = ['#ffb3d4', '#ff9cc6', '#ffc8e0', '#ffffff'];
  const PETAL = { vy: [20, 38], sway: [10, 26], spin: 1.6, size: [8, 13], kinds: PETAL_COLS.length };
  const LEAF = { vy: [30, 58], sway: [16, 40], spin: 2.6, size: [12, 19], kinds: LEAF_COLS.length };
  const RAINBOW = ['#ff8fb4', '#ffb46c', '#ffe46a', '#8fe39c', '#74c2ff', '#b598ff'];

  const WORLDS = [];

  // ---------------- Blossom Falls: spring morning ----------------
  WORLDS[0] = {
    foam: {
      colors: ['#ffffff', '#ffd6ea', '#ffb3d9', '#ffc8e0'],
      petalShare: 0.45,
      drawPetal(ctx, x, y, size, ang, col, alpha) {
        ctx.globalAlpha = alpha;
        blit(ctx, petalSprite(col), x, y, size * 3.4, ang + Math.PI / 2, 0.7);
        ctx.globalAlpha = 1;
      },
    },
    init(st) {
      st.petals = [];
      for (let i = 0; i < count(9); i++) st.petals.push(faller(PETAL, true));
      st.flies = [];
      for (let i = 0; i < 3; i++) st.flies.push({ ph: rand(0, TAU), side: i === 1 ? 1 : -1, col: ['#ffd34d', '#ff9fca', '#c9a8ff'][i], fr: rand(0.35, 0.55), k: rand(0.6, 1) });
    },
    update(st, dt, t) { updateFallers(st.petals, PETAL, dt, 6 + 8 * Math.sin(t * 0.13)); },
    front(ctx, st, t, a) {
      drawFallers(ctx, st.petals, a * 0.9, (k) => petalSprite(PETAL_COLS[k]), t);
      // butterflies flutter over the far bank, never over the water
      const sc = scale();
      for (const b of st.flies) {
        const top = S.bankTopY - S.pr * 0.25, bot = S.cy - S.pr * S.K * 0.98;
        const x = S.cx + b.side * S.pr * (0.55 + 0.35 * Math.sin(t * b.fr + b.ph)) + Math.sin(t * 1.7 + b.ph) * 8;
        const y = FC.lerp(top, bot, 0.5 + 0.45 * Math.sin(t * b.fr * 1.6 + b.ph * 2)) + Math.sin(t * 6 + b.ph) * 3;
        drawButterfly(ctx, x, y, 7 * sc * b.k + 3, t * 16 + b.ph, b.col, a * clearK(x, y, 0.15));
      }
    },
  };
  function drawButterfly(ctx, x, y, s, flap, col, alpha) {
    if (alpha < 0.03) return;
    const f = 0.25 + 0.75 * Math.abs(Math.sin(flap));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.fillStyle = col;
    ctx.strokeStyle = FC.rgba(FC.shade(col, -0.45), 0.8);
    ctx.lineWidth = Math.max(0.8, s * 0.12);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side * f, 1);
      ctx.beginPath();
      ctx.ellipse(s * 0.55, -s * 0.3, s * 0.55, s * 0.42, -0.5, 0, TAU);
      ctx.ellipse(s * 0.42, s * 0.32, s * 0.36, s * 0.28, 0.5, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#6a3f5c';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.12, s * 0.5, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // ---------------- Candy Woods: autumn at golden hour ----------------
  const autumnWind = (t) => 14 + 42 * Math.pow(Math.max(0, Math.sin(t * 0.19 + 1)), 4); // calm, then a gust
  WORLDS[1] = {
    foam: {
      colors: ['#fff2d8', '#f2802f', '#e8503c', '#f2b232', '#c87a48'],
      petalShare: 0.6,
      drawPetal(ctx, x, y, size, ang, col, alpha, i) {
        ctx.globalAlpha = alpha;
        blit(ctx, leafSprite(i % LEAF_COLS.length), x, y, size * 4.6, ang + (i % 7), 0.62);
        ctx.globalAlpha = 1;
      },
    },
    init(st) {
      st.leaves = [];
      for (let i = 0; i < count(9); i++) st.leaves.push(faller(LEAF, true));
      st.flock = { wait: rand(4, 10), on: false };
    },
    update(st, dt, t) {
      updateFallers(st.leaves, LEAF, dt, autumnWind(t));
      // a small flock of birds heading south, now and then
      const f = st.flock;
      if (!f.on) {
        f.wait -= dt;
        if (f.wait <= 0) {
          f.on = true;
          f.dir = Math.random() < 0.5 ? 1 : -1;
          f.x = f.dir > 0 ? -60 : S.W + 60;
          f.y = rand(skyTop() + 30, skyTop() + (skyBottom() - skyTop()) * 0.6);
          f.v = rand(34, 52) * scale();
          f.n = 5 + Math.floor(Math.random() * 3);
        }
      } else {
        f.x += f.dir * f.v * dt;
        f.y -= f.v * 0.08 * dt;
        if (f.x < -120 || f.x > S.W + 120) { f.on = false; f.wait = rand(16, 30); }
      }
    },
    front(ctx, st, t, a) {
      drawFallers(ctx, st.leaves, a, leafSprite, t);
      const f = st.flock;
      if (f.on) {
        const s = 4.2 * scale();
        ctx.save();
        ctx.globalAlpha = a * 0.75;
        ctx.strokeStyle = '#7a4a52';
        ctx.lineWidth = Math.max(1.2, s * 0.32);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < f.n; i++) {
          const row = Math.ceil(i / 2), side = i % 2 ? -1 : 1;
          const bx = f.x - f.dir * row * s * 3.2, by = f.y + side * row * s * 2.1 + (i ? 0 : 0);
          const flap = Math.sin(t * 9 + i * 1.3) * s * 0.55;
          ctx.moveTo(bx - s, by - flap);
          ctx.quadraticCurveTo(bx - s * 0.4, by - s * 0.15, bx, by + s * 0.25);
          ctx.quadraticCurveTo(bx + s * 0.4, by - s * 0.15, bx + s, by - flap);
        }
        ctx.stroke();
        ctx.restore();
      }
    },
  };

  // ---------------- Moonlight Bay: night ----------------
  WORLDS[2] = {
    foam: {
      colors: ['#fff6c8', '#fff3b0', '#ffffff', '#d6e8ff'],
      petalShare: 0.35,
      drawPetal(ctx, x, y, size, ang, col, alpha, i, t) {
        const k = 0.6 + 0.4 * Math.sin(t * 4 + i);
        ctx.globalAlpha = alpha * k;
        FC.sparklePath(ctx, x, y, size * 2.2, 0.3);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.globalAlpha = 1;
      },
    },
    init(st) {
      st.flies = [];
      for (let i = 0; i < count(14); i++) st.flies.push(this.firefly());
      st.glit = [];
      for (let i = 0; i < 16; i++) st.glit.push({ u: i / 15, ph: rand(0, TAU), w: rand(0.6, 1.2), off: rand(-1, 1) });
      st.stars = [];
      for (let i = 0; i < 8; i++) st.stars.push(twinkle(true, skySpot));
    },
    // fireflies live round the banks and in the night air beside the island
    firefly() {
      const a = rand(0, TAU), rr = rand(1.02, 1.3);
      return { a, rr, ph: rand(0, TAU), ph2: rand(0, TAU), fr: rand(0.25, 0.5), blink: rand(0.9, 1.8), s: rand(0.8, 1.25) };
    },
    update(st, dt, t) {
      updateTwinkles(st.stars, dt, skySpot);
      shooter(st, dt, [7, 14]);
    },
    sky(ctx, st, t, a) {
      drawTwinkles(ctx, st.stars, a, '#fff6c8', 1);
      drawShooter(ctx, st, a);
    },
    water(ctx, st, t, a) {
      // the moon's glitter path on the pond: short wavering strokes from the far edge towards the middle
      const x0 = S.cx + S.pr * 0.36;
      ctx.save();
      ctx.lineCap = 'round';
      for (const g of st.glit) {
        const y = S.cy - S.pr * S.K * (0.9 - g.u * 0.78);
        const w = S.pr * (0.05 + g.u * 0.07) * g.w;
        const x = x0 + Math.sin(t * 0.8 + g.ph) * S.pr * 0.02 + g.off * S.pr * 0.04 * (0.4 + g.u);
        const k = 0.5 + 0.5 * Math.sin(t * 2.6 + g.ph);
        ctx.globalAlpha = a * (0.2 + 0.45 * k) * (1 - g.u * 0.4);
        ctx.strokeStyle = '#fff3c4';
        ctx.lineWidth = Math.max(2, S.pr * 0.014);
        ctx.beginPath();
        ctx.moveTo(x - w / 2, y);
        ctx.lineTo(x + w / 2, y);
        ctx.stroke();
      }
      ctx.restore();
    },
    front(ctx, st, t, a) {
      const sp = glowSprite('fly', 'rgba(255,255,215,1)', 'rgba(215,255,120,0.5)');
      const sc = scale();
      for (const f of st.flies) {
        const ang = f.a + Math.sin(t * f.fr + f.ph) * 0.25;
        const rr = f.rr + Math.sin(t * f.fr * 1.3 + f.ph2) * 0.05;
        const x = S.cx + Math.cos(ang) * S.pr * rr * 1.05;
        const y = S.cy + Math.sin(ang) * S.pr * S.K * rr - S.pr * 0.06 + Math.sin(t * 1.9 + f.ph) * 5;
        const glow = Math.pow(Math.max(0, Math.sin(t * f.blink + f.ph)), 2);
        const al = a * (0.35 + 0.65 * glow) * clearK(x, y, 0.5);
        if (al < 0.03) continue;
        ctx.globalAlpha = al;
        blit(ctx, sp, x, y, (15 + 17 * glow) * sc * f.s);
      }
      ctx.globalAlpha = 1;
    },
  };
  function skySpot() { return { x: Math.random() * S.W, y: rand(skyTop(), skyBottom()) }; }
  function drawTwinkles(ctx, list, a, col, size, water) {
    for (const g of list) {
      const k = Math.sin(Math.PI * g.t);
      if (k <= 0.03) continue;
      let x = g.x, y = g.y;
      if (water) { x = S.cx + g.x * S.pr; y = S.cy + g.y * S.pr * S.K; }
      FC.sparklePath(ctx, x, y, (2 + 4 * g.s) * k * size * scale(), 0.28);
      ctx.fillStyle = FC.rgba(Array.isArray(col) ? col[g.k % col.length] : col, Math.min(1, 0.9 * k * a));
      ctx.fill();
    }
  }

  // ---------------- Rainbow Heights: the sky kingdom ----------------
  WORLDS[3] = {
    foam: {
      colors: ['#ffffff'].concat(RAINBOW),
      petalShare: 0.5,
      drawPetal(ctx, x, y, size, ang, col, alpha) {
        ctx.globalAlpha = alpha;
        blit(ctx, sprinkleSprite(col), x, y, size * 3.6, ang + Math.PI / 2);
        ctx.globalAlpha = 1;
      },
    },
    init(st) {
      st.balloons = [];
      for (let i = 0; i < 3; i++) {
        const depth = 0.55 + i * 0.22;
        st.balloons.push({ x: rand(0, S.W), y: rand(0, 1), depth, vx: rand(5, 11) * (i % 2 ? -1 : 1), ph: rand(0, TAU), k: i });
      }
      st.wisps = [];
      for (let i = 0; i < 4; i++) st.wisps.push({ x: rand(-100, S.W), y: rand(0, 1), v: rand(50, 95), s: rand(0.6, 1.2) });
      st.glints = [];
      for (let i = 0; i < 7; i++) st.glints.push(twinkle(true, waterSpot));
      st.bubbles = [];
      for (let i = 0; i < count(5); i++) st.bubbles.push(this.bubble(true));
    },
    bubble(anywhere) {
      const side = Math.random() < 0.5;
      return { x: side ? rand(-10, S.W * 0.22) : rand(S.W * 0.78, S.W + 10), y: anywhere ? rand(S.H * 0.3, S.H + 20) : S.H + rand(10, 60), v: rand(16, 30), s: rand(9, 17), ph: rand(0, TAU), top: rand(S.H * 0.05, S.H * 0.5) };
    },
    update(st, dt, t) {
      const sc = scale();
      for (const b of st.balloons) {
        b.x += b.vx * b.depth * dt;
        if (b.x > S.W + 50) b.x = -50;
        if (b.x < -50) b.x = S.W + 50;
      }
      for (const w of st.wisps) {
        w.x += w.v * sc * dt;
        if (w.x > S.W + 120) { w.x = -120 - Math.random() * 200; w.y = Math.random(); w.s = rand(0.6, 1.2); }
      }
      updateTwinkles(st.glints, dt, waterSpot);
      for (let i = 0; i < st.bubbles.length; i++) {
        const b = st.bubbles[i];
        b.y -= b.v * dt;
        if (b.y < b.top) st.bubbles[i] = this.bubble(false);
      }
    },
    sky(ctx, st, t, a) {
      const sc = scale(), top = skyTop(), bot = skyBottom();
      for (const w of st.wisps) {
        ctx.globalAlpha = a * 0.55;
        blit(ctx, wispSprite(), w.x, FC.lerp(top + 10, bot, w.y), 70 * w.s * sc);
      }
      for (const b of st.balloons) {
        const y = FC.lerp(top + 24 * sc, bot - 10, b.y) + Math.sin(t * 0.8 + b.ph) * 4;
        ctx.globalAlpha = a * (0.55 + 0.4 * b.depth);
        blit(ctx, balloonSprite(b.k), b.x, y, 15 * sc * b.depth + 6);
      }
      ctx.globalAlpha = a;
    },
    // sparkles that run along the rainbow over the castle
    over(ctx, st, t, a) {
      const fp = S.farPlace ? S.farPlace(3) : null;
      const rb = fp && fp.m.rainbow;
      if (!rb) return;
      const cx = fp.x + (rb.x - fp.m.ax) * fp.k, cy = fp.y + (rb.y - fp.m.ay) * fp.k, R = rb.r * fp.k, bw = rb.w * fp.k;
      for (let i = 0; i < 6; i++) {
        const u = (t * 0.07 + i / 6) % 1;
        const ang = Math.PI * (1.08 + u * 0.84);
        const rr = R + Math.sin(i * 2.3 + t * 0.5) * bw * 0.35;
        const k = Math.sin(Math.PI * u);
        FC.sparklePath(ctx, cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, (2.5 + 3.5 * k) * scale(), 0.28);
        ctx.fillStyle = FC.rgba('#ffffff', 0.9 * k * a);
        ctx.fill();
      }
    },
    water(ctx, st, t, a) { drawTwinkles(ctx, st.glints, a, RAINBOW, 1, true); },
    front(ctx, st, t, a) {
      const sp = bubbleSprite(), sc = scale();
      for (const b of st.bubbles) {
        const x = b.x + Math.sin(t * 1.3 + b.ph) * 8;
        const fade = Math.min(1, (b.y - b.top) / 60);
        ctx.globalAlpha = a * fade * clearK(x, b.y, 0.25) * 0.9;
        blit(ctx, sp, x, b.y, b.s * sc);
      }
      ctx.globalAlpha = 1;
    },
  };

  // ---------------- Starfall Realm: legendary dusk ----------------
  const AURORA = [
    { y: 0.72, amp: 0.1, h: 0.95, rim: '#7dffcf', top: '#5fc8ff', alpha: 0.9 },
    { y: 0.9, amp: 0.07, h: 0.6, rim: '#ff9ef0', top: '#b48cff', alpha: 0.65 },
  ];
  WORLDS[4] = {
    foam: {
      colors: ['#fff2e0', '#ffe27a', '#ffd34d', '#ffefb0', '#e2c4ff'],
      petalShare: 0.4,
      drawPetal(ctx, x, y, size, ang, col, alpha) {
        ctx.globalAlpha = alpha;
        blit(ctx, starSprite(col), x, y, size * 3.2, ang);
        ctx.globalAlpha = 1;
      },
    },
    init(st) {
      st.motes = [];
      for (let i = 0; i < count(12); i++) st.motes.push(this.mote(true));
      st.stars = [];
      for (let i = 0; i < 6; i++) st.stars.push(twinkle(true, waterSpot));
      st.sky = [];
      for (let i = 0; i < 7; i++) st.sky.push(twinkle(true, skySpot));
    },
    mote(anywhere) {
      return { x: rand(0, S.W), y: anywhere ? rand(0, S.H) : S.H + rand(5, 40), v: rand(8, 20), ph: rand(0, TAU), s: rand(0.7, 1.3) };
    },
    update(st, dt, t) {
      for (let i = 0; i < st.motes.length; i++) {
        const m = st.motes[i];
        m.y -= m.v * dt;
        if (m.y < -20) st.motes[i] = this.mote(false);
      }
      updateTwinkles(st.stars, dt, waterSpot);
      updateTwinkles(st.sky, dt, skySpot);
      shooter(st, dt, [2.5, 5.5]);
    },
    sky(ctx, st, t, a) {
      // two aurora curtains waving over the castle: a soft fill that fades upwards from a bright, wavy lower rim,
      // with a few faint rays standing in it
      const top = skyTop(), bot = Math.max(skyBottom(), S.H * 0.3), span = bot - top;
      const step = Math.max(8, S.W / 60);
      for (let k = 0; k < AURORA.length; k++) {
        const c = AURORA[k];
        const y0 = top + span * c.y, amp = span * c.amp, hh = span * c.h;
        const yb = (x) => y0 + Math.sin(x * 0.006 + t * 0.32 + k * 2) * amp + Math.sin(x * 0.017 - t * 0.21 + k) * amp * 0.4;
        const hx = (x) => hh * (0.65 + 0.35 * Math.sin(x * 0.009 + t * 0.45 + k * 3));
        ctx.beginPath();
        for (let x = -step; x <= S.W + step; x += step) ctx.lineTo(x, yb(x));
        for (let x = S.W + step; x >= -step; x -= step) ctx.lineTo(x, yb(x) - hx(x));
        ctx.closePath();
        const g = ctx.createLinearGradient(0, y0 + amp * 1.4, 0, y0 - hh - amp);
        g.addColorStop(0, FC.rgba(c.rim, 0.9));
        g.addColorStop(0.2, FC.rgba(c.rim, 0.55));
        g.addColorStop(0.55, FC.rgba(c.top, 0.28));
        g.addColorStop(1, FC.rgba(c.top, 0));
        ctx.globalAlpha = a * c.alpha * (0.85 + 0.15 * Math.sin(t * 0.7 + k));
        ctx.fillStyle = g;
        ctx.fill();
        // rays: thin streaks that drift slowly along the curtain
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(1.5, S.W / 500);
        for (let i = 0; i < 9; i++) {
          const x = ((i / 9 + t * 0.012 * (k ? -1 : 1)) % 1 + 1) % 1 * (S.W + 80) - 40;
          const y = yb(x), h = hx(x) * (0.55 + 0.3 * Math.sin(i * 1.7 + t));
          ctx.globalAlpha = a * c.alpha * (0.25 + 0.2 * Math.sin(t * 1.3 + i * 2.1));
          ctx.strokeStyle = c.rim;
          ctx.beginPath();
          ctx.moveTo(x, y - 2);
          ctx.lineTo(x + 3, y - h);
          ctx.stroke();
        }
        // the bright lower rim, with a soft glow round it
        ctx.beginPath();
        for (let x = -step; x <= S.W + step; x += step) ctx.lineTo(x, yb(x));
        ctx.strokeStyle = c.rim;
        ctx.globalAlpha = a * c.alpha * 0.18;
        ctx.lineWidth = Math.max(8, span * 0.09);
        ctx.stroke();
        ctx.globalAlpha = a * c.alpha * 0.6;
        ctx.lineWidth = Math.max(2, span * 0.022);
        ctx.stroke();
      }
      ctx.globalAlpha = a;
      drawTwinkles(ctx, st.sky, a, '#fff3c4', 1);
      drawShooter(ctx, st, a);
    },
    water(ctx, st, t, a) { drawTwinkles(ctx, st.stars, a, '#ffe27a', 0.9, true); },
    front(ctx, st, t, a) {
      const sp = glowSprite('gold', 'rgba(255,246,200,1)', 'rgba(255,200,90,0.35)');
      const sc = scale();
      for (const m of st.motes) {
        const x = m.x + Math.sin(t * 0.7 + m.ph) * 12;
        const tw = 0.5 + 0.5 * Math.sin(t * 2.2 + m.ph);
        const al = a * (0.3 + 0.55 * tw) * clearK(x, m.y, 0.3);
        if (al < 0.03) continue;
        ctx.globalAlpha = al;
        blit(ctx, sp, x, m.y, (7 + 5 * tw) * sc * m.s);
      }
      ctx.globalAlpha = 1;
    },
  };

  // ------------------------------------------------------------------
  // runtime: state per world, cross-fades with the scene, the hooks the game calls
  // ------------------------------------------------------------------
  const A = {
    state: [],
    time: 0,
    reset() { this.state = []; },
    st(ti) {
      let st = this.state[ti];
      if (!st && WORLDS[ti]) { st = this.state[ti] = {}; WORLDS[ti].init(st); }
      return st;
    },
    // the worlds on screen right now, with their weight in the cross-fade
    active() {
      if (S.prevTheme >= 0 && S.fade < 1) {
        const e = FC.ease.inOutSine(S.fade);
        return [[S.prevTheme, 1 - e], [S.theme, e]];
      }
      return [[S.theme, 1]];
    },
    update(dt) {
      if (!S.W) return;
      this.time += dt;
      for (const [ti] of this.active()) {
        const st = this.st(ti);
        if (st && WORLDS[ti].update) WORLDS[ti].update(st, dt, this.time);
      }
    },
    // drawThemeBack draws each world with its own alpha already set (the cross-fade), so the sky layers take it as given
    sky(ctx, ti, a) {
      const W = WORLDS[ti];
      if (!W || !W.sky) return;
      const st = this.st(ti);
      W.sky(ctx, st, this.time, a);
      ctx.globalAlpha = a;
    },
    over(ctx, ti, a) {
      const W = WORLDS[ti];
      if (!W || !W.over) return;
      W.over(ctx, this.st(ti), this.time, a);
      ctx.globalAlpha = a;
    },
    layer(name, ctx) {
      for (const [ti, w] of this.active()) {
        const W = WORLDS[ti];
        if (!W || !W[name] || w < 0.02) continue;
        W[name](ctx, this.st(ti), this.time, w);
      }
      ctx.globalAlpha = 1;
    },
  };
  FC.Ambient = A;

  // the hooks the game calls
  S.foamStyle = (theme) => (WORLDS[theme] ? WORLDS[theme].foam : null);
  S.drawWaterAmbient = (ctx) => A.layer('water', ctx);
  S.drawAmbientFront = (ctx) => A.layer('front', ctx);
})();
