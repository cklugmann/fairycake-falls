/* Fairycake Falls – cake tiers + procedural cake art (Canvas 2D).
   Cakes are painted as soft 3/4-view "drums" (cylinders) in unit space:
   the physics footprint is the unit circle around (0,0); the cake's top face
   sits above it and the bottom rim touches y≈+0.96.
   The body sprite is cached per tier; the face is drawn live
   (blinking, gaze, expressions). */
(function () {
  'use strict';
  const FC = window.FC;
  const TAU = FC.TAU;
  const shade = FC.shade, rgba = FC.rgba, mix = FC.mix;

  // ------------------------------------------------------------------
  // Tiers
  // ------------------------------------------------------------------
  const TIERS = [
    { id: 0, name: 'Magic Cake', r: 84, style: 'joker', sponge: '#fff4dc', frost: '#ffffff', outline: '#9a6fd0',
      particle: ['#ff8fc4', '#ffd66b', '#8fe3c3', '#9ec5ff', '#c9a6ff', '#ffffff'] },
    { id: 1, name: 'Macaron', r: 69, style: 'macaron', shell: '#c3acff', filling: '#fff4fb', outline: '#7a5fc2',
      accent: '#ff7fb3', mouth: 'smile', particle: ['#c3acff', '#fff4fb', '#ff7fb3', '#e6dcff'] },
    { id: 2, name: 'Cherry Bite', r: 87, style: 'classic', sponge: '#ffdca6', frost: '#fff7f0', outline: '#c0775f',
      topping: 'cherry', band: '#ff8fae', mouth: 'smile', pores: 40,
      particle: ['#ffffff', '#ee3a55', '#ffdca6', '#ffb3c6'] },
    { id: 3, name: 'Cupcake', r: 108, style: 'cupcake', wrapper: '#8fd2f2', frost: '#ffadd0', outline: '#b9577c',
      mouth: 'cat', particle: ['#ffadd0', '#8fd2f2', '#ffffff', '#f04a62'] },
    { id: 4, name: 'Lemon Tart', r: 132, style: 'tart', crust: '#efb35f', frost: '#ffe266', outline: '#b07033',
      mouth: 'smile', particle: ['#ffe266', '#fff6b8', '#8fd36f', '#efb35f'] },
    { id: 5, name: 'Blossom Cake', r: 159, style: 'classic', sponge: '#fbe0c0', frost: '#a2eac6', outline: '#3f9273',
      topping: 'flower', accent: '#ff86c0', band: '#ffffff', rosette: '#ffffff', mouth: 'cat', pores: 70,
      particle: ['#a2eac6', '#ff86c0', '#ffffff', '#ffe27a'] },
    { id: 6, name: 'Choco Cake', r: 190, style: 'classic', sponge: '#a4664b', frost: '#6a3a2f', outline: '#43231d',
      topping: 'sprinkles', band: '#f6dcc0', rosette: '#fbe8d4', mouth: 'smile', dark: true, pores: 90,
      particle: ['#6a3a2f', '#ff8fc4', '#8fe3ff', '#ffe27a', '#a7ebc8'] },
    { id: 7, name: 'Peach Cake', r: 226, style: 'classic', sponge: '#fff0d8', frost: '#ffb98e', outline: '#c06640',
      topping: 'peach', band: '#ffd9b3', rosette: '#ffffff', mouth: 'smile', pores: 90,
      particle: ['#ffb98e', '#ff9a5c', '#fff0d8', '#8fd36f'] },
    { id: 8, name: 'Blueberry Cake', r: 267, style: 'classic', sponge: '#f6eaff', frost: '#a7bfff', outline: '#5160c0',
      topping: 'blueberries', band: '#ffffff', rosette: '#ffffff', mouth: 'cat', pores: 100,
      particle: ['#a7bfff', '#4c5bd4', '#ffffff', '#c9b8ff'] },
    { id: 9, name: 'Rainbow Cake', r: 314, style: 'rainbow', frost: '#ffffff', outline: '#7f73c4', mouth: 'smile',
      particle: ['#ff9aa8', '#ffc98a', '#fff08a', '#9ee6a6', '#9ccfff', '#c5a8ff'] },
    { id: 10, name: 'Fairy Torte', r: 367, style: 'tiered', sponge: '#fff3f8', frost: '#ff9bcd', outline: '#bd4f8c',
      accent: '#ffe066', mouth: 'smile', particle: ['#ff9bcd', '#ffffff', '#ffe066', '#ffd6ea'] },
    { id: 11, name: 'Royal Fairycake', r: 430, style: 'royal', sponge: '#fff4e6', frost: '#ffcfe4', outline: '#b9628a',
      mouth: 'smile', particle: ['#ffd34d', '#ffcfe4', '#ffffff', '#ff9fd0', '#fff1a8'] },
  ];
  const MAX_TIER = 11;
  for (const t of TIERS) t.score = t.id >= 2 ? t.id * (t.id - 1) : 0;

  // face placement per style (unit space)
  const FACE = {
    classic: { ey: 0.46, ex: 0.3, my: 0.63, bx: 0.6, by: 0.6, k: 1 },
    cupcake: { ey: 0.56, ex: 0.27, my: 0.72, bx: 0.52, by: 0.69, k: 0.95 },
    macaron: { ey: 0.1, ex: 0.32, my: 0.26, bx: 0.62, by: 0.23, k: 1 },
    tart: { ey: 0.62, ex: 0.3, my: 0.77, bx: 0.62, by: 0.74, k: 0.85 },
    rainbow: { ey: 0.47, ex: 0.3, my: 0.64, bx: 0.6, by: 0.61, k: 1 },
    tiered: { ey: 0.47, ex: 0.3, my: 0.64, bx: 0.6, by: 0.61, k: 1 },
    royal: { ey: 0.48, ex: 0.3, my: 0.65, bx: 0.6, by: 0.62, k: 1 },
    joker: { ey: 0.45, ex: 0.3, my: 0.62, bx: 0.6, by: 0.59, k: 1.05 },
  };

  // sprite extent relative to the radius (top / sides)
  const EXTENT = {
    classic: { top: 1.6, side: 1.18 },
    cupcake: { top: 1.4, side: 1.15 },
    macaron: { top: 1.1, side: 1.12 },
    tart: { top: 1.25, side: 1.15 },
    rainbow: { top: 1.7, side: 1.18 },
    tiered: { top: 1.6, side: 1.8 },
    royal: { top: 2.15, side: 1.9 },
    joker: { top: 1.65, side: 1.2 },
  };

  const DRUM = { rx: 1, ry: 0.46, topY: -0.42, botY: 0.5, bulge: 0.035 };

  // ------------------------------------------------------------------
  // geometry helpers
  // ------------------------------------------------------------------
  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
  }

  function drumOutlinePath(ctx, d) {
    const h = d.botY - d.topY, b = d.bulge || 0;
    ctx.beginPath();
    ctx.moveTo(-d.rx, d.topY);
    ctx.ellipse(0, d.topY, d.rx, d.ry, 0, Math.PI, TAU);
    ctx.bezierCurveTo(d.rx + b, d.topY + h * 0.35, d.rx + b, d.topY + h * 0.7, d.rx, d.botY);
    ctx.ellipse(0, d.botY, d.rx, d.ry, 0, 0, Math.PI);
    ctx.bezierCurveTo(-d.rx - b, d.topY + h * 0.7, -d.rx - b, d.topY + h * 0.35, -d.rx, d.topY);
    ctx.closePath();
  }

  function drumSidePath(ctx, d) {
    const h = d.botY - d.topY, b = d.bulge || 0;
    ctx.beginPath();
    ctx.moveTo(-d.rx, d.topY);
    ctx.ellipse(0, d.topY, d.rx, d.ry, 0, Math.PI, 0, true);
    ctx.bezierCurveTo(d.rx + b, d.topY + h * 0.35, d.rx + b, d.topY + h * 0.7, d.rx, d.botY);
    ctx.ellipse(0, d.botY, d.rx, d.ry, 0, 0, Math.PI);
    ctx.bezierCurveTo(-d.rx - b, d.topY + h * 0.7, -d.rx - b, d.topY + h * 0.35, -d.rx, d.topY);
    ctx.closePath();
  }

  function frontY(x, yc, rx, ry) {
    const u = x / rx;
    return yc + ry * Math.sqrt(Math.max(0, 1 - u * u));
  }

  function cylGradient(ctx, x0, x1, col, k) {
    const s = k == null ? 1 : k;
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, shade(col, -0.24 * s));
    g.addColorStop(0.16, shade(col, 0.04 * s));
    g.addColorStop(0.34, shade(col, 0.24 * s));
    g.addColorStop(0.6, col);
    g.addColorStop(0.86, shade(col, -0.12 * s));
    g.addColorStop(1, shade(col, -0.32 * s));
    return g;
  }

  // a band on the drum side (filling / jam / rainbow layer)
  function sideBand(ctx, d, yc, th, color, wave) {
    const N = 48, rx = d.rx * 1.06;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const u = -1 + (2 * i) / N;
      const y = yc + d.ry * Math.sqrt(Math.max(0, 1 - u * u)) + (wave ? Math.sin(u * 11) * wave : 0);
      if (i === 0) ctx.moveTo(u * rx, y);
      else ctx.lineTo(u * rx, y);
    }
    for (let i = N; i >= 0; i--) {
      const u = -1 + (2 * i) / N;
      const y = yc + th + d.ry * Math.sqrt(Math.max(0, 1 - u * u)) + (wave ? Math.sin(u * 11 + 1.7) * wave : 0);
      ctx.lineTo(u * rx, y);
    }
    ctx.closePath();
    ctx.fillStyle = cylGradient(ctx, -d.rx, d.rx, color, 0.9);
    ctx.fill();
  }

  function paintDrumSide(ctx, d, col, outline, rng, o) {
    ctx.save();
    drumSidePath(ctx, d);
    ctx.clip();
    ctx.fillStyle = cylGradient(ctx, -d.rx, d.rx, col, 1);
    ctx.fillRect(-d.rx - 0.2, d.topY - d.ry, d.rx * 2 + 0.4, d.botY - d.topY + d.ry * 2 + 0.2);
    if (o.stripes) {
      const n = o.stripes.length;
      const h = (d.botY - d.topY) / n;
      for (let i = 0; i < n; i++) {
        sideBand(ctx, d, d.topY + i * h, h + 0.01, o.stripes[i]);
        if (i > 0) sideBand(ctx, d, d.topY + i * h - 0.012, 0.026, '#fffaf2');
      }
    }
    // sponge pores
    const pn = o.pores || 0;
    if (pn) {
      const pc = shade(col, -0.38);
      for (let i = 0; i < pn; i++) {
        const u = rng() * 2 - 1;
        const cu = Math.sqrt(1 - u * u);
        const y = FC.lerp(d.topY + d.ry * cu, d.botY + d.ry * cu, 0.12 + rng() * 0.86);
        const s = 0.011 + rng() * 0.02;
        ctx.beginPath();
        ctx.ellipse(u * d.rx * 0.97, y, s * (0.35 + cu * 0.65), s * 0.72, 0, 0, TAU);
        ctx.fillStyle = rgba(pc, 0.16 + rng() * 0.2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      for (let i = 0; i < pn * 0.35; i++) {
        const u = rng() * 1.6 - 0.95;
        const cu = Math.sqrt(Math.max(0, 1 - u * u));
        const y = FC.lerp(d.topY + d.ry * cu, d.botY + d.ry * cu, 0.15 + rng() * 0.8);
        circle(ctx, u * d.rx, y, 0.008 + rng() * 0.01);
        ctx.fill();
      }
    }
    if (o.bands) for (const b of o.bands) sideBand(ctx, d, b[0], b[1], b[2], b[3]);
    // ambient occlusion at the bottom + soft rim light on the left
    const ao = ctx.createLinearGradient(0, d.botY - 0.05, 0, d.botY + d.ry);
    ao.addColorStop(0, 'rgba(0,0,0,0)');
    ao.addColorStop(1, rgba(outline, 0.4));
    ctx.fillStyle = ao;
    ctx.fillRect(-d.rx - 0.2, d.botY - 0.3, d.rx * 2 + 0.4, d.ry + 0.6);
    const rl = ctx.createLinearGradient(-d.rx, 0, -d.rx * 0.7, 0);
    rl.addColorStop(0, 'rgba(255,255,255,0.0)');
    rl.addColorStop(0.35, 'rgba(255,255,255,0.28)');
    rl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rl;
    ctx.fillRect(-d.rx - 0.1, d.topY, d.rx * 0.4, d.botY - d.topY + d.ry);
    ctx.restore();
  }

  // ------------------------------------------------------------------
  // frosting with drips
  // ------------------------------------------------------------------
  // tongues: [angleCentre, angleHalfWidth, depth]; angle phi in [-pi/2, pi/2], u = sin(phi)
  function makeDrips(rng, o) {
    const deep = (o && o.deep) || 1;
    const out = [];
    const main = [-1.22, -0.86, -0.52, 0, 0.52, 0.86, 1.22];
    for (const c of main) {
      let dep = (0.12 + rng() * 0.22) * deep;
      const near = Math.abs(Math.abs(c) - 0.5) < 0.1;
      if (near) dep = Math.min(dep, 0.17 * deep);
      if (c === 0) dep = (0.2 + rng() * 0.05) * deep;
      out.push([c + (rng() - 0.5) * 0.06, 0.12 + rng() * 0.07, dep]);
    }
    for (const c of [-1.04, -0.7, -0.27, 0.27, 0.7, 1.04]) out.push([c + (rng() - 0.5) * 0.05, 0.075, 0.035 + rng() * 0.04]);
    return out;
  }
  function scallopDrips(n, depth, w) {
    const out = [];
    for (let i = 0; i < n; i++) out.push([-1.4 + (2.8 * i) / (n - 1), w, depth]);
    return out;
  }

  function dripDepth(u, tongues, base) {
    const phi = Math.asin(FC.clamp(u, -1, 1));
    let y = base;
    for (let i = 0; i < tongues.length; i++) {
      const t = tongues[i];
      const k = (phi - t[0]) / t[1];
      if (k > -1 && k < 1) y += t[2] * Math.pow(1 - k * k, 0.55);
    }
    return y;
  }

  function frostPath(ctx, d, edge) {
    ctx.beginPath();
    ctx.moveTo(-d.rx, d.topY);
    ctx.ellipse(0, d.topY, d.rx, d.ry, 0, Math.PI, TAU);
    const N = 96;
    for (let i = 0; i <= N; i++) {
      const x = d.rx - (2 * d.rx * i) / N;
      ctx.lineTo(x, edge(x));
    }
    ctx.closePath();
  }

  function edgeLine(ctx, d, edge) {
    const N = 96;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const x = d.rx - (2 * d.rx * i) / N;
      if (i === 0) ctx.moveTo(x, edge(x));
      else ctx.lineTo(x, edge(x));
    }
  }

  function paintTopFace(ctx, d, fr, dark) {
    ctx.beginPath();
    ctx.ellipse(0, d.topY, d.rx * 0.975, d.ry * 0.95, 0, 0, TAU);
    const g = ctx.createRadialGradient(-d.rx * 0.28, d.topY - d.ry * 0.4, 0.02, 0, d.topY, d.rx);
    g.addColorStop(0, shade(fr, dark ? 0.25 : 0.55));
    g.addColorStop(0.55, shade(fr, dark ? 0.08 : 0.18));
    g.addColorStop(1, shade(fr, dark ? -0.05 : 0.0));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(0, d.topY, d.rx * 0.9, d.ry * 0.8, 0, Math.PI * 1.12, Math.PI * 1.6);
    ctx.lineWidth = 0.05 * d.rx;
    ctx.strokeStyle = dark ? 'rgba(255,230,220,0.45)' : 'rgba(255,255,255,0.75)';
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, d.topY, d.rx * 0.985, d.ry * 0.975, 0, Math.PI * 0.1, Math.PI * 0.9);
    ctx.lineWidth = 0.028 * d.rx;
    ctx.strokeStyle = rgba(shade(fr, -0.3), 0.4);
    ctx.stroke();
  }

  function paintFrosting(ctx, d, s, tongues, lw, o) {
    o = o || {};
    const dF = { rx: d.rx + 0.025 * d.rx, ry: d.ry + 0.012 * d.rx, topY: d.topY };
    const base = 0.05 * d.rx;
    const edge = (x) => frontY(x, dF.topY, dF.rx, dF.ry) + dripDepth(x / dF.rx, tongues, base) * d.rx;
    const fr = s.frost;
    // frosting shadow on the side
    ctx.save();
    drumSidePath(ctx, d);
    ctx.clip();
    ctx.translate(0, 0.055 * d.rx);
    frostPath(ctx, dF, edge);
    ctx.fillStyle = rgba(s.outline, s.dark ? 0.4 : 0.26);
    ctx.fill();
    ctx.restore();
    // frosting body
    frostPath(ctx, dF, edge);
    if (o.rainbow && ctx.createConicGradient) {
      const g = ctx.createConicGradient(0.4, 0, d.topY + 0.1);
      const cs = ['#ff9cc0', '#ffc27e', '#fff07a', '#9ff0b0', '#8fd0ff', '#c6a2ff', '#ff9cc0'];
      cs.forEach((c, i) => g.addColorStop(i / (cs.length - 1), c));
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = cylGradient(ctx, -dF.rx, dF.rx, fr, s.dark ? 0.8 : 0.75);
    }
    ctx.fill();
    // drip edge line
    edgeLine(ctx, dF, edge);
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw * 0.8;
    ctx.strokeStyle = shade(o.rainbow ? '#c6a2ff' : fr, s.dark ? -0.45 : -0.3);
    ctx.stroke();
    // gloss on drips
    for (const t of tongues) {
      if (t[2] < 0.1) continue;
      const u = Math.sin(t[0] - t[1] * 0.3);
      const x = u * dF.rx;
      const y = edge(x) - 0.075 * d.rx;
      ctx.beginPath();
      ctx.ellipse(x, y, (0.022 + t[1] * 0.07) * Math.sqrt(1 - u * u) * d.rx + 0.006, 0.042 * d.rx, 0, 0, TAU);
      ctx.fillStyle = s.dark ? 'rgba(255,225,215,0.5)' : 'rgba(255,255,255,0.75)';
      ctx.fill();
    }
    // vertical gloss stripe on the left
    ctx.save();
    frostPath(ctx, dF, edge);
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(-dF.rx * 0.62, d.topY + d.ry * 0.95, 0.07 * d.rx, 0.11 * d.rx, 0.15, 0, TAU);
    ctx.fillStyle = s.dark ? 'rgba(255,225,215,0.35)' : 'rgba(255,255,255,0.5)';
    ctx.fill();
    ctx.restore();
    if (o.rainbow) {
      paintTopFace(ctx, dF, '#fff4fb', false);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, d.topY, dF.rx * 0.975, dF.ry * 0.95, 0, 0, TAU);
      ctx.clip();
      const g = ctx.createConicGradient ? ctx.createConicGradient(1.2, 0, d.topY) : null;
      if (g) {
        const cs = ['#ffd1e3', '#ffe3c2', '#fff6c2', '#d2f7da', '#cfe9ff', '#e5d6ff', '#ffd1e3'];
        cs.forEach((c, i) => g.addColorStop(i / (cs.length - 1), c));
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = g;
        ctx.fillRect(-1.2 * d.rx, d.topY - d.ry * 1.2, 2.4 * d.rx, d.ry * 2.4);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    } else paintTopFace(ctx, dF, fr, s.dark);
    return { edge, dF };
  }

  // ------------------------------------------------------------------
  // decorations
  // ------------------------------------------------------------------
  // fluffy piped cream dollop (base + top + curled tip)
  function rosette(ctx, x, y, s, col, lw, tipCol) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.ellipse(0, s * 0.38, s * 0.95, s * 0.34, 0, 0, TAU);
    ctx.fillStyle = 'rgba(90,30,60,0.14)';
    ctx.fill();
    const edge = rgba(shade(col, -0.45), 0.5);
    const parts = [[0, 0.0, 1.0, 0.62], [0.02, -0.42, 0.66, 0.45]];
    for (const p of parts) {
      ctx.beginPath();
      ctx.ellipse(p[0] * s, p[1] * s, p[2] * s, p[3] * s, 0, 0, TAU);
      const g = ctx.createRadialGradient(-s * 0.35, (p[1] - p[3] * 0.7) * s, s * 0.03, 0, p[1] * s, p[2] * s * 1.1);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.62, col);
      g.addColorStop(1, shade(col, -0.16));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = lw * 0.5;
      ctx.strokeStyle = edge;
      ctx.stroke();
    }
    // piped ridges on the base
    ctx.lineCap = 'round';
    ctx.lineWidth = lw * 0.38;
    ctx.strokeStyle = rgba(shade(col, -0.3), 0.45);
    for (const k of [-0.55, 0, 0.55]) {
      ctx.beginPath();
      ctx.moveTo(k * s - s * 0.12, -s * 0.2);
      ctx.quadraticCurveTo(k * s + s * 0.08, s * 0.15, k * s - s * 0.02, s * 0.5);
      ctx.stroke();
    }
    // curled tip
    ctx.beginPath();
    ctx.moveTo(-s * 0.22, -s * 0.72);
    ctx.quadraticCurveTo(-s * 0.02, -s * 1.22, s * 0.36, -s * 1.02);
    ctx.quadraticCurveTo(s * 0.1, -s * 0.88, s * 0.24, -s * 0.66);
    ctx.closePath();
    ctx.fillStyle = tipCol || shade(col, 0.4);
    ctx.fill();
    ctx.lineWidth = lw * 0.5;
    ctx.strokeStyle = edge;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-s * 0.36, -s * 0.12, s * 0.2, s * 0.1, -0.5, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();
    ctx.restore();
  }

  function rosetteRing(ctx, d, n, size, col, lw, k, skipBack) {
    const items = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + 0.3;
      const y = d.topY + Math.sin(a) * d.ry * (k || 0.8);
      if (skipBack && Math.sin(a) < -0.2) continue;
      items.push([Math.cos(a) * d.rx * (k || 0.8), y]);
    }
    items.sort((p, q) => p[1] - q[1]);
    for (const p of items) rosette(ctx, p[0], p[1] - size * 0.3, size, col, lw);
  }

  function creamSwirl(ctx, x, y, s, col, lw) {
    const c = col || '#ffffff';
    const parts = [[0, 0, 1, 0.55], [0, -0.42, 0.74, 0.44], [0.02, -0.76, 0.46, 0.3]];
    for (const p of parts) {
      ctx.beginPath();
      ctx.ellipse(x + p[0] * s, y + p[1] * s, p[2] * s, p[3] * s, 0, 0, TAU);
      const g = ctx.createRadialGradient(x - s * 0.3, y + (p[1] - p[3] * 0.6) * s, s * 0.05, x, y + p[1] * s, p[2] * s * 1.1);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.7, c);
      g.addColorStop(1, shade(c, -0.12));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = lw * 0.6;
      ctx.strokeStyle = 'rgba(170,110,140,0.55)';
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x - 0.12 * s, y - 0.98 * s);
    ctx.quadraticCurveTo(x + 0.05 * s, y - 1.38 * s, x + 0.34 * s, y - 1.12 * s);
    ctx.quadraticCurveTo(x + 0.12 * s, y - 1.0 * s, x + 0.2 * s, y - 0.88 * s);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x - s * 0.35, y - s * 0.12, s * 0.22, s * 0.1, -0.4, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
  }

  function cherry(ctx, x, y, s, lw) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.75);
    ctx.quadraticCurveTo(x + s * 0.15, y - s * 1.7, x + s * 0.85, y - s * 2.0);
    ctx.lineWidth = s * 0.17;
    ctx.strokeStyle = '#5f8a35';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + s * 0.55, y - s * 1.8);
    ctx.quadraticCurveTo(x + s * 1.1, y - s * 2.25, x + s * 1.35, y - s * 1.65);
    ctx.quadraticCurveTo(x + s * 0.9, y - s * 1.45, x + s * 0.55, y - s * 1.8);
    ctx.fillStyle = '#8fd36f';
    ctx.fill();
    ctx.lineWidth = lw * 0.6;
    ctx.strokeStyle = '#4f8a35';
    ctx.stroke();
    circle(ctx, x, y, s);
    const g = ctx.createRadialGradient(x - s * 0.35, y - s * 0.4, s * 0.08, x, y, s * 1.05);
    g.addColorStop(0, '#ff9aa6');
    g.addColorStop(0.45, '#ee3a55');
    g.addColorStop(1, '#a8173a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = lw * 0.8;
    ctx.strokeStyle = '#7f1230';
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x - s * 0.36, y - s * 0.38, s * 0.3, s * 0.18, -0.7, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    circle(ctx, x + s * 0.38, y + s * 0.3, s * 0.08);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fill();
    ctx.restore();
  }

  function strawberry(ctx, x, y, s, lw) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x - s, y - s * 0.3);
    ctx.bezierCurveTo(x - s * 1.05, y + s * 0.45, x - s * 0.35, y + s * 1.05, x, y + s * 1.12);
    ctx.bezierCurveTo(x + s * 0.35, y + s * 1.05, x + s * 1.05, y + s * 0.45, x + s, y - s * 0.3);
    ctx.bezierCurveTo(x + s * 0.8, y - s * 0.8, x - s * 0.8, y - s * 0.8, x - s, y - s * 0.3);
    ctx.closePath();
    const g = ctx.createRadialGradient(x - s * 0.3, y - s * 0.2, s * 0.08, x, y + s * 0.2, s * 1.3);
    g.addColorStop(0, '#ff98a2');
    g.addColorStop(0.5, '#f0435c');
    g.addColorStop(1, '#b51f3c');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = lw * 0.8;
    ctx.strokeStyle = '#8f1631';
    ctx.stroke();
    const seeds = [[-0.5, 0.05], [0, 0.0], [0.5, 0.05], [-0.28, 0.42], [0.28, 0.42], [0, 0.78], [-0.62, -0.3], [0.62, -0.3], [-0.2, -0.32], [0.22, -0.3]];
    for (const sd of seeds) {
      ctx.beginPath();
      ctx.ellipse(x + sd[0] * s, y + sd[1] * s, s * 0.065, s * 0.1, 0, 0, TAU);
      ctx.fillStyle = '#ffe48f';
      ctx.fill();
      circle(ctx, x + sd[0] * s - s * 0.02, y + sd[1] * s - s * 0.04, s * 0.025);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + (i / 4) * Math.PI;
      const px = x + Math.cos(a) * s * 0.75, py = y - s * 0.55 + Math.sin(a) * s * 0.45;
      ctx.moveTo(x, y - s * 0.55);
      ctx.quadraticCurveTo(x + Math.cos(a - 0.4) * s * 0.5, y - s * 0.55 + Math.sin(a - 0.4) * s * 0.4, px, py);
      ctx.quadraticCurveTo(x + Math.cos(a + 0.4) * s * 0.5, y - s * 0.55 + Math.sin(a + 0.4) * s * 0.4, x, y - s * 0.55);
    }
    ctx.fillStyle = '#7fcf62';
    ctx.fill();
    ctx.lineWidth = lw * 0.55;
    ctx.strokeStyle = '#4a8a36';
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x - s * 0.45, y - s * 0.1, s * 0.2, s * 0.12, -0.6, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fill();
    ctx.restore();
  }

  function flower(ctx, x, y, s, petal, center, lw, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.scale(1, 0.84);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(s * 0.25, -s * 0.5, s * 1.05, -s * 0.5, s * 1.02, 0);
      ctx.bezierCurveTo(s * 1.05, s * 0.5, s * 0.25, s * 0.5, 0, 0);
      const g = ctx.createLinearGradient(0, 0, s * 1.05, 0);
      g.addColorStop(0, shade(petal, -0.15));
      g.addColorStop(0.6, petal);
      g.addColorStop(1, shade(petal, 0.4));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = lw * 0.6;
      ctx.strokeStyle = shade(petal, -0.38);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * 0.2, 0);
      ctx.lineTo(s * 0.7, 0);
      ctx.lineWidth = lw * 0.4;
      ctx.strokeStyle = rgba(shade(petal, -0.3), 0.5);
      ctx.stroke();
      ctx.restore();
    }
    circle(ctx, 0, 0, s * 0.3);
    const cg = ctx.createRadialGradient(-s * 0.1, -s * 0.1, 0, 0, 0, s * 0.3);
    cg.addColorStop(0, '#fff3a8');
    cg.addColorStop(1, center || '#ffc83d');
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.lineWidth = lw * 0.5;
    ctx.strokeStyle = '#d9962b';
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,120,30,0.6)';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      circle(ctx, Math.cos(a) * s * 0.15, Math.sin(a) * s * 0.15, s * 0.035);
      ctx.fill();
    }
    ctx.restore();
  }

  function mintLeaf(ctx, x, y, s, ang, lw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(s * 0.5, -s * 0.45, s * 1.1, 0);
    ctx.quadraticCurveTo(s * 0.5, s * 0.45, 0, 0);
    const g = ctx.createLinearGradient(0, -s * 0.4, 0, s * 0.4);
    g.addColorStop(0, '#a9eb8c');
    g.addColorStop(1, '#5aad47');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = lw * 0.55;
    ctx.strokeStyle = '#3c8533';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.08, 0);
    ctx.lineTo(s * 0.9, 0);
    ctx.stroke();
    ctx.restore();
  }

  function lemonSlice(ctx, x, y, s, lw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.3);
    ctx.scale(1, 0.92);
    // rind thickness (slice seen slightly from the side)
    circle(ctx, s * 0.06, s * 0.08, s);
    ctx.fillStyle = '#e0a514';
    ctx.fill();
    circle(ctx, 0, 0, s);
    ctx.fillStyle = '#f8c826';
    ctx.fill();
    ctx.lineWidth = lw * 0.7;
    ctx.strokeStyle = '#c08a10';
    ctx.stroke();
    circle(ctx, 0, 0, s * 0.86);
    ctx.fillStyle = '#fffbe2';
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * TAU + 0.07, a1 = ((i + 1) / 8) * TAU - 0.07;
      ctx.beginPath();
      ctx.moveTo(Math.cos((a0 + a1) / 2) * s * 0.12, Math.sin((a0 + a1) / 2) * s * 0.12);
      ctx.arc(0, 0, s * 0.76, a0, a1);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? '#fff07a' : '#ffe557';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(-s * 0.35, -s * 0.38, s * 0.24, s * 0.12, -0.7, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();
    ctx.restore();
  }

  function sprinkles(ctx, rng, n, cx, cy, rx, ry, colors, size) {
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU, rr = Math.sqrt(rng());
      const x = cx + Math.cos(a) * rx * rr, y = cy + Math.sin(a) * ry * rr;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rng() * Math.PI);
      FC.roundRect(ctx, -size, -size * 0.34, size * 2, size * 0.68, size * 0.34);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      FC.roundRect(ctx, -size * 0.7, -size * 0.25, size * 0.9, size * 0.2, size * 0.1);
      ctx.fill();
      ctx.restore();
    }
  }

  function peachHalves(ctx, x, y, s, lw) {
    const halves = [[-0.42, 0.06, 0.42], [0.42, -0.04, 0.46]];
    for (const p of halves) {
      const px = x + p[0] * s, py = y + p[1] * s, pr = p[2] * s;
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(1, 0.86);
      circle(ctx, 0, pr * 0.12, pr);
      ctx.fillStyle = 'rgba(150,60,30,0.25)';
      ctx.fill();
      circle(ctx, 0, 0, pr);
      const g = ctx.createRadialGradient(-pr * 0.3, -pr * 0.35, pr * 0.08, 0, 0, pr);
      g.addColorStop(0, '#ffeaa8');
      g.addColorStop(0.5, '#ffb35e');
      g.addColorStop(1, '#ff6a4a');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = lw * 0.7;
      ctx.strokeStyle = '#c24d2d';
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pr * 0.12, -pr * 0.95);
      ctx.quadraticCurveTo(pr * 0.42, 0, pr * 0.06, pr * 0.95);
      ctx.lineWidth = lw * 0.55;
      ctx.strokeStyle = 'rgba(194,77,45,0.55)';
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-pr * 0.38, -pr * 0.42, pr * 0.26, pr * 0.15, -0.7, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fill();
      ctx.restore();
    }
    mintLeaf(ctx, x - s * 0.05, y - s * 0.32, s * 0.44, -1.25, lw);
    mintLeaf(ctx, x + s * 0.02, y - s * 0.3, s * 0.36, -2.1, lw);
  }

  function blueberries(ctx, x, y, s, lw) {
    const pos = [[-0.5, 0.18], [0.05, 0.28], [0.56, 0.16], [-0.26, -0.18], [0.32, -0.2], [0.03, -0.55]];
    for (const p of pos) {
      const bx = x + p[0] * s, by = y + p[1] * s, br = s * 0.36;
      circle(ctx, bx, by, br);
      const g = ctx.createRadialGradient(bx - br * 0.35, by - br * 0.4, br * 0.08, bx, by, br);
      g.addColorStop(0, '#9aa6ff');
      g.addColorStop(0.55, '#4f5fd8');
      g.addColorStop(1, '#2a3596');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = lw * 0.6;
      ctx.strokeStyle = '#1f2a78';
      ctx.stroke();
      FC.starPath(ctx, bx + br * 0.1, by - br * 0.15, br * 0.28, 0.45);
      ctx.fillStyle = '#25307f';
      ctx.fill();
      circle(ctx, bx - br * 0.4, by - br * 0.42, br * 0.17);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fill();
    }
    mintLeaf(ctx, x + s * 0.25, y - s * 0.62, s * 0.42, -0.5, lw);
  }

  function chocoCurls(ctx, x, y, s, lw) {
    const curls = [[-0.35, 0.05, -0.4], [0.3, 0.0, 0.5], [0.0, -0.22, 0.05]];
    for (const c of curls) {
      ctx.save();
      ctx.translate(x + c[0] * s, y + c[1] * s);
      ctx.rotate(c[2]);
      FC.roundRect(ctx, -s * 0.36, -s * 0.11, s * 0.72, s * 0.22, s * 0.11);
      const g = ctx.createLinearGradient(0, -s * 0.11, 0, s * 0.11);
      g.addColorStop(0, '#8a5038');
      g.addColorStop(0.5, '#5a2f22');
      g.addColorStop(1, '#3a1d15');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = lw * 0.5;
      ctx.strokeStyle = '#2a140e';
      ctx.stroke();
      ctx.beginPath();
      for (let k = -2; k <= 2; k++) {
        ctx.moveTo(k * s * 0.13, -s * 0.1);
        ctx.lineTo(k * s * 0.13 + s * 0.05, s * 0.1);
      }
      ctx.lineWidth = lw * 0.35;
      ctx.strokeStyle = 'rgba(255,220,200,0.35)';
      ctx.stroke();
      ctx.restore();
    }
  }

  function goldStar(ctx, x, y, s, lw) {
    ctx.save();
    const gl = ctx.createRadialGradient(x, y, 0, x, y, s * 1.9);
    gl.addColorStop(0, 'rgba(255,240,150,0.55)');
    gl.addColorStop(1, 'rgba(255,240,150,0)');
    ctx.fillStyle = gl;
    circle(ctx, x, y, s * 1.9);
    ctx.fill();
    FC.starPath(ctx, x, y + s * 0.12, s, 0.5);
    ctx.fillStyle = '#d98a14';
    ctx.fill();
    FC.starPath(ctx, x, y, s, 0.5);
    const g = ctx.createLinearGradient(x, y - s, x, y + s);
    g.addColorStop(0, '#fff7b8');
    g.addColorStop(0.5, '#ffd23f');
    g.addColorStop(1, '#f0a020');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw * 0.8;
    ctx.strokeStyle = '#b86f12';
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x - s * 0.2, y - s * 0.25, s * 0.2, s * 0.1, -0.6, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    ctx.restore();
  }

  function crown(ctx, x, y, s, lw) {
    ctx.save();
    ctx.translate(x, y);
    const w = s * 1.1, h = s * 0.8;
    ctx.beginPath();
    ctx.moveTo(-w, h * 0.35);
    ctx.lineTo(-w * 1.05, -h * 0.55);
    ctx.lineTo(-w * 0.5, -h * 0.05);
    ctx.lineTo(0, -h * 0.85);
    ctx.lineTo(w * 0.5, -h * 0.05);
    ctx.lineTo(w * 1.05, -h * 0.55);
    ctx.lineTo(w, h * 0.35);
    ctx.quadraticCurveTo(0, h * 0.62, -w, h * 0.35);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -h, 0, h * 0.6);
    g.addColorStop(0, '#fff6b2');
    g.addColorStop(0.5, '#ffcf3a');
    g.addColorStop(1, '#e8901a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw * 0.8;
    ctx.strokeStyle = '#ad6716';
    ctx.stroke();
    for (const p of [[-w * 1.05, -h * 0.55], [0, -h * 0.85], [w * 1.05, -h * 0.55]]) {
      circle(ctx, p[0], p[1], s * 0.14);
      ctx.fillStyle = '#fff1a0';
      ctx.fill();
      ctx.stroke();
    }
    const gems = [[-w * 0.55, h * 0.22, '#ff7fb3'], [0, h * 0.27, '#7fc8ff'], [w * 0.55, h * 0.22, '#9be59a']];
    for (const gm of gems) {
      ctx.beginPath();
      ctx.ellipse(gm[0], gm[1], s * 0.15, s * 0.12, 0, 0, TAU);
      ctx.fillStyle = gm[2];
      ctx.fill();
      ctx.lineWidth = lw * 0.5;
      ctx.stroke();
      circle(ctx, gm[0] - s * 0.05, gm[1] - s * 0.04, s * 0.04);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(-w * 0.8, h * 0.05);
    ctx.lineTo(-w * 0.85, -h * 0.35);
    ctx.lineWidth = lw * 0.6;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.stroke();
    ctx.restore();
  }

  function wing(ctx, x, y, s, side, lw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(side, 1);
    const g = ctx.createLinearGradient(0, -s, s * 1.2, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.96)');
    g.addColorStop(0.6, 'rgba(255,225,245,0.9)');
    g.addColorStop(1, 'rgba(226,200,255,0.85)');
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(s * 0.2, -s * 1.1, s * 1.25, -s * 1.25, s * 1.15, -s * 0.45);
    ctx.bezierCurveTo(s * 1.1, -s * 0.1, s * 0.5, 0.05 * s, 0, 0);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = lw * 0.7;
    ctx.strokeStyle = 'rgba(205,130,190,0.95)';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, s * 0.05);
    ctx.bezierCurveTo(s * 0.5, s * 0.1, s * 0.95, s * 0.35, s * 0.75, s * 0.7);
    ctx.bezierCurveTo(s * 0.5, s * 0.95, s * 0.1, s * 0.5, 0, s * 0.05);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.1, -s * 0.05);
    ctx.quadraticCurveTo(s * 0.6, -s * 0.6, s * 0.95, -s * 0.75);
    ctx.moveTo(s * 0.1, -s * 0.02);
    ctx.quadraticCurveTo(s * 0.6, -s * 0.25, s * 0.95, -s * 0.35);
    ctx.moveTo(s * 0.1, s * 0.1);
    ctx.quadraticCurveTo(s * 0.45, s * 0.3, s * 0.6, s * 0.55);
    ctx.lineWidth = lw * 0.4;
    ctx.strokeStyle = 'rgba(205,130,190,0.6)';
    ctx.stroke();
    FC.sparklePath(ctx, s * 0.75, -s * 0.7, s * 0.14);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    FC.sparklePath(ctx, s * 0.45, s * 0.45, s * 0.09);
    ctx.fill();
    ctx.restore();
  }

  function pearlsOnEdge(ctx, edge, xs, r, color, lw) {
    for (const x of xs) {
      const y = edge(x) - r * 0.4;
      circle(ctx, x, y, r);
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.05, x, y, r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, color);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = lw * 0.4;
      ctx.strokeStyle = shade(color, -0.35);
      ctx.stroke();
    }
  }

  function heart(ctx, x, y, s, col, lw) {
    FC.heartPath(ctx, x, y + s * 0.12, s);
    ctx.fillStyle = shade(col, -0.35);
    ctx.fill();
    FC.heartPath(ctx, x, y, s);
    const g = ctx.createLinearGradient(x, y - s, x, y + s);
    g.addColorStop(0, shade(col, 0.35));
    g.addColorStop(1, col);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = lw * 0.6;
    ctx.strokeStyle = shade(col, -0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x - s * 0.35, y - s * 0.3, s * 0.18, s * 0.1, -0.6, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();
  }

  // full classic drum cake (side + frosting + outline); returns frosting info
  function drumCake(ctx, d, s, lw, seed, o) {
    o = o || {};
    const rng = FC.rng(seed);
    const bands = o.bands || (s.band ? [[d.botY - 0.22 * d.rx, 0.075 * d.rx, s.band, 0.006]] : null);
    paintDrumSide(ctx, d, o.sponge || s.sponge, s.outline, rng, { pores: o.pores == null ? (s.pores || 60) : o.pores, bands, stripes: o.stripes });
    const tongues = o.tongues || makeDrips(rng, { deep: o.dripDeep || 1 });
    const fr = paintFrosting(ctx, d, { frost: o.frost || s.frost, outline: s.outline, dark: s.dark }, tongues, lw, o);
    drumOutlinePath(ctx, { rx: d.rx * 1.022, ry: d.ry * 1.02, topY: d.topY, botY: d.botY, bulge: d.bulge });
    ctx.lineWidth = lw;
    ctx.strokeStyle = s.outline;
    ctx.stroke();
    return fr;
  }

  function scaleDrum(k, botY, height) {
    const ry = DRUM.ry * k;
    return { rx: k, ry, botY, topY: botY - height, bulge: DRUM.bulge * k };
  }

  // ------------------------------------------------------------------
  // style painters (unit space)
  // ------------------------------------------------------------------
  const STYLE = {};

  STYLE.classic = function (ctx, s, lw) {
    const fr = drumCake(ctx, DRUM, s, lw, s.id * 97 + 3, { dripDeep: s.dark ? 1.15 : 1 });
    const rng = FC.rng(s.id * 31 + 7);
    const tY = DRUM.topY;
    switch (s.topping) {
      case 'cherry':
        creamSwirl(ctx, 0, tY + 0.02, 0.32, '#ffffff', lw);
        cherry(ctx, 0.03, tY - 0.42, 0.24, lw);
        break;
      case 'flower':
        rosetteRing(ctx, DRUM, 9, 0.11, s.rosette, lw, 0.82);
        mintLeaf(ctx, 0.1, tY - 0.06, 0.38, 0.35, lw);
        mintLeaf(ctx, -0.12, tY - 0.04, 0.34, Math.PI - 0.5, lw);
        flower(ctx, 0, tY - 0.1, 0.38, s.accent, '#ffd03d', lw, 0.2);
        break;
      case 'sprinkles':
        sprinkles(ctx, rng, 30, 0, tY, 0.7, 0.3, ['#ff8fc4', '#8fe3ff', '#ffe27a', '#a7ebc8', '#ffffff', '#c9a6ff'], 0.055);
        rosetteRing(ctx, DRUM, 10, 0.1, s.rosette, lw, 0.84);
        chocoCurls(ctx, 0, tY - 0.04, 0.42, lw);
        creamSwirl(ctx, 0.0, tY - 0.12, 0.17, '#fbe8d4', lw);
        break;
      case 'peach':
        rosetteRing(ctx, DRUM, 10, 0.1, s.rosette, lw, 0.84);
        peachHalves(ctx, 0, tY - 0.06, 0.5, lw);
        break;
      case 'blueberries':
        rosetteRing(ctx, DRUM, 10, 0.1, s.rosette, lw, 0.84);
        blueberries(ctx, 0, tY - 0.1, 0.42, lw);
        break;
    }
    return fr;
  };

  STYLE.cupcake = function (ctx, s, lw) {
    const W = s.wrapper;
    const tY = 0.12, tRx = 0.9, tRy = 0.34;
    const bY = 0.62, bRx = 0.7, bRy = 0.27;
    // wrapper
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-tRx, tY);
    ctx.lineTo(-bRx, bY);
    ctx.ellipse(0, bY, bRx, bRy, 0, Math.PI, 0, true);
    ctx.lineTo(tRx, tY);
    ctx.ellipse(0, tY, tRx, tRy, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = cylGradient(ctx, -tRx, tRx, W, 1);
    ctx.fill();
    ctx.clip();
    const n = 16;
    for (let i = 0; i < n; i += 2) {
      const u0 = -1 + (2 * i) / n, u1 = -1 + (2 * (i + 1)) / n;
      const p = (u, rx, yc, ry) => [u * rx, yc + ry * Math.sqrt(Math.max(0, 1 - u * u))];
      const a = p(u0, tRx, tY, tRy), b = p(u1, tRx, tY, tRy), c = p(u1, bRx, bY, bRy), d = p(u0, bRx, bY, bRy);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1] - 0.2);
      ctx.lineTo(b[0], b[1] - 0.2);
      ctx.lineTo(c[0], c[1] + 0.05);
      ctx.lineTo(d[0], d[1] + 0.05);
      ctx.closePath();
      ctx.fillStyle = rgba('#ffffff', 0.3);
      ctx.fill();
    }
    const ao = ctx.createLinearGradient(0, bY - 0.1, 0, bY + bRy);
    ao.addColorStop(0, 'rgba(0,0,0,0)');
    ao.addColorStop(1, rgba(shade(W, -0.5), 0.45));
    ctx.fillStyle = ao;
    ctx.fillRect(-1, bY - 0.2, 2, 0.6);
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(-tRx, tY);
    ctx.lineTo(-bRx, bY);
    ctx.ellipse(0, bY, bRx, bRy, 0, Math.PI, 0, true);
    ctx.lineTo(tRx, tY);
    ctx.lineWidth = lw;
    ctx.strokeStyle = shade(W, -0.45);
    ctx.lineJoin = 'round';
    ctx.stroke();
    // frosting swirl: stacked piped rings
    const F = s.frost;
    const rings = [[0.02, 0.98, 0.4], [-0.3, 0.78, 0.33], [-0.57, 0.55, 0.26], [-0.78, 0.32, 0.18]];
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      ctx.beginPath();
      ctx.ellipse(0, r[0], r[1], r[2], 0, 0, TAU);
      const g = ctx.createLinearGradient(-r[1], r[0] - r[2], r[1] * 0.4, r[0] + r[2]);
      g.addColorStop(0, shade(F, 0.55));
      g.addColorStop(0.45, F);
      g.addColorStop(1, shade(F, -0.22));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = lw * 0.9;
      ctx.strokeStyle = s.outline;
      ctx.stroke();
      // piped ridges
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, r[0], r[1], r[2], 0, 0, TAU);
      ctx.clip();
      ctx.lineWidth = lw * 0.5;
      ctx.strokeStyle = rgba(shade(F, -0.3), 0.55);
      for (let k = -5; k <= 5; k++) {
        const x = (k / 5) * r[1];
        ctx.beginPath();
        ctx.moveTo(x - r[1] * 0.12, r[0] - r[2]);
        ctx.quadraticCurveTo(x + r[1] * 0.08, r[0], x - r[1] * 0.05, r[0] + r[2]);
        ctx.stroke();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.ellipse(-r[1] * 0.4, r[0] - r[2] * 0.35, r[1] * 0.28, r[2] * 0.22, -0.25, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fill();
    }
    const rng = FC.rng(222);
    sprinkles(ctx, rng, 10, 0, -0.3, 0.6, 0.35, ['#ffffff', '#ffe27a', '#8fe3ff', '#c9a6ff'], 0.045);
    strawberry(ctx, 0.02, -0.98, 0.27, lw);
  };

  STYLE.macaron = function (ctx, s, lw) {
    const sh = s.shell;
    const rng = FC.rng(303);
    // bottom shell (drum)
    const bot = { rx: 0.97, ry: 0.4, topY: 0.2, botY: 0.5, bulge: 0.03 };
    paintDrumSide(ctx, bot, shade(sh, -0.04), s.outline, rng, { pores: 0 });
    drumOutlinePath(ctx, bot);
    ctx.lineWidth = lw;
    ctx.strokeStyle = s.outline;
    ctx.stroke();
    // ruffled feet of the bottom shell
    const feet = (yc, rx, ry, col) => {
      for (let i = 0; i <= 30; i++) {
        const u = -1 + (2 * i) / 30;
        const y = yc + ry * Math.sqrt(1 - u * u);
        circle(ctx, u * rx, y, 0.05);
        ctx.fillStyle = col;
        ctx.fill();
      }
    };
    feet(0.2, 0.95, 0.4, shade(sh, 0.12));
    // filling
    const fill = { rx: 0.9, ry: 0.38, topY: 0.04, botY: 0.22, bulge: 0.03 };
    ctx.save();
    drumSidePath(ctx, fill);
    ctx.fillStyle = cylGradient(ctx, -0.9, 0.9, s.filling, 0.6);
    ctx.fill();
    ctx.restore();
    sideBand(ctx, fill, 0.03, 0.035, 'rgba(255,255,255,0.8)', 0.008);
    // top shell dome + feet
    feet(0.06, 0.95, 0.4, shade(sh, 0.05));
    ctx.beginPath();
    ctx.moveTo(-1, 0.02);
    ctx.ellipse(0, 0.02, 1, 0.78, 0, Math.PI, TAU);
    ctx.ellipse(0, 0.02, 1, 0.4, 0, 0, Math.PI);
    ctx.closePath();
    const g = ctx.createRadialGradient(-0.3, -0.42, 0.05, 0, 0, 1.15);
    g.addColorStop(0, shade(sh, 0.5));
    g.addColorStop(0.55, sh);
    g.addColorStop(1, shade(sh, -0.2));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = s.outline;
    ctx.stroke();
    // subtle speckles of the shell
    ctx.fillStyle = rgba(shade(sh, -0.25), 0.25);
    for (let i = 0; i < 40; i++) {
      const a = rng() * TAU, rr = Math.sqrt(rng()) * 0.85;
      circle(ctx, Math.cos(a) * rr, -0.25 + Math.sin(a) * rr * 0.55, 0.012);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(-0.38, -0.42, 0.32, 0.13, -0.45, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0.05, -0.62, 0.12, 0.05, -0.2, 0, TAU);
    ctx.fill();
    heart(ctx, 0.0, -0.58, 0.17, s.accent, lw);
    for (const p of [[-0.45, -0.38], [0.48, -0.4], [0.28, -0.72], [-0.3, -0.7]]) {
      circle(ctx, p[0], p[1], 0.04);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  };

  STYLE.tart = function (ctx, s, lw) {
    const d = { rx: 1, ry: 0.44, topY: 0.02, botY: 0.48, bulge: 0.02 };
    const rng = FC.rng(404);
    // fluted crust side
    paintDrumSide(ctx, d, s.crust, s.outline, rng, { pores: 30 });
    ctx.save();
    drumSidePath(ctx, d);
    ctx.clip();
    for (let k = -9; k <= 9; k++) {
      const phi = (k / 9) * 1.45;
      const u = Math.sin(phi);
      const x = u * d.rx;
      ctx.beginPath();
      ctx.moveTo(x, frontY(x, d.topY, d.rx, d.ry));
      ctx.lineTo(x, frontY(x, d.botY, d.rx, d.ry));
      ctx.lineWidth = 0.05 * Math.cos(phi) + 0.01;
      ctx.strokeStyle = rgba(shade(s.crust, -0.35), 0.35);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 0.03, frontY(x, d.topY, d.rx, d.ry));
      ctx.lineTo(x + 0.03, frontY(x, d.botY, d.rx, d.ry));
      ctx.lineWidth = 0.025 * Math.cos(phi) + 0.005;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.stroke();
    }
    ctx.restore();
    drumOutlinePath(ctx, d);
    ctx.lineWidth = lw;
    ctx.strokeStyle = s.outline;
    ctx.stroke();
    // crust rim (top ring) with scallops
    ctx.beginPath();
    ctx.ellipse(0, d.topY, d.rx, d.ry, 0, 0, TAU);
    ctx.fillStyle = shade(s.crust, 0.2);
    ctx.fill();
    ctx.lineWidth = lw * 0.8;
    ctx.strokeStyle = s.outline;
    ctx.stroke();
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * TAU;
      circle(ctx, Math.cos(a) * d.rx * 0.96, d.topY + Math.sin(a) * d.ry * 0.95, 0.07);
      ctx.fillStyle = i % 2 ? shade(s.crust, 0.32) : shade(s.crust, 0.12);
      ctx.fill();
    }
    // lemon curd
    ctx.beginPath();
    ctx.ellipse(0, d.topY + 0.01, d.rx * 0.84, d.ry * 0.8, 0, 0, TAU);
    const g = ctx.createRadialGradient(-0.25, d.topY - 0.14, 0.02, 0, d.topY, 0.9);
    g.addColorStop(0, '#fffbd0');
    g.addColorStop(0.5, s.frost);
    g.addColorStop(1, shade(s.frost, -0.12));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = lw * 0.6;
    ctx.strokeStyle = shade(s.frost, -0.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-0.3, d.topY - 0.14, 0.32, 0.07, -0.1, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fill();
    // meringue kisses
    const kisses = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + 0.2;
      kisses.push([Math.cos(a) * 0.6, d.topY + Math.sin(a) * 0.26]);
    }
    kisses.sort((p, q) => p[1] - q[1]);
    for (const k of kisses) rosette(ctx, k[0], k[1] - 0.04, 0.12, '#fff3e2', lw, '#f0b46a');
    lemonSlice(ctx, -0.04, d.topY - 0.3, 0.3, lw);
    mintLeaf(ctx, 0.12, d.topY - 0.22, 0.3, -0.5, lw);
  };

  STYLE.rainbow = function (ctx, s, lw) {
    const stripes = ['#ffb1bf', '#ffcf9a', '#fff19a', '#b5efb9', '#a6d5ff', '#cbb2ff'];
    const fr = drumCake(ctx, DRUM, { sponge: '#fff7ee', frost: '#ffffff', outline: s.outline }, lw, 1010,
      { stripes, pores: 50, tongues: scallopDrips(11, 0.08, 0.17) });
    // little rainbow arch
    ctx.save();
    ctx.lineCap = 'round';
    const cols = ['#ff9aa8', '#ffc98a', '#fff08a', '#9ee6a6', '#9ccfff', '#c5a8ff'];
    for (let i = 0; i < cols.length; i++) {
      ctx.beginPath();
      ctx.arc(0, DRUM.topY + 0.05, 0.6 - i * 0.065, Math.PI * 1.08, Math.PI * 1.92);
      ctx.lineWidth = 0.075;
      ctx.strokeStyle = cols[i];
      ctx.stroke();
    }
    ctx.restore();
    // cloud puffs
    for (const p of [[-0.58, DRUM.topY + 0.06], [0.58, DRUM.topY + 0.06]]) {
      for (const q of [[-0.1, 0.02, 0.12], [0.08, 0.0, 0.14], [0.0, -0.08, 0.12]]) {
        circle(ctx, p[0] + q[0], p[1] + q[1], q[2]);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = lw * 0.5;
        ctx.strokeStyle = 'rgba(127,115,196,0.4)';
        ctx.stroke();
      }
    }
    rosetteRing(ctx, DRUM, 8, 0.09, '#ffffff', lw, 0.86, true);
    goldStar(ctx, 0, DRUM.topY - 0.5, 0.28, lw);
    return fr;
  };

  STYLE.tiered = function (ctx, s, lw) {
    wing(ctx, -0.78, -0.55, 0.66, -1, lw);
    wing(ctx, 0.78, -0.55, 0.66, 1, lw);
    const base = drumCake(ctx, DRUM, { sponge: s.sponge, frost: s.frost, outline: s.outline, band: '#ffc4df', pores: 70 }, lw, 909);
    pearlsOnEdge(ctx, base.edge, [-0.78, -0.42, 0.42, 0.78], 0.05, '#fff4fa', lw);
    rosetteRing(ctx, DRUM, 12, 0.085, '#ffffff', lw, 0.86, true);
    const up = scaleDrum(0.62, DRUM.topY + 0.02, 0.56);
    const top = drumCake(ctx, up, { sponge: '#ffd9ec', frost: '#fff6fb', outline: s.outline, band: '#ff9bcd', pores: 40 }, lw, 919, { dripDeep: 0.9 });
    pearlsOnEdge(ctx, top.edge, [-0.42, 0, 0.42], 0.045, '#ffd6ea', lw);
    rosetteRing(ctx, up, 8, 0.07, '#ffb7da', lw, 0.8);
    flower(ctx, 0, up.topY - 0.1, 0.25, '#ff86c0', s.accent, lw, 0.1);
    flower(ctx, -0.3, up.topY - 0.02, 0.14, '#ffffff', '#ffd75a', lw, 0.6);
    flower(ctx, 0.3, up.topY - 0.02, 0.14, '#ffffff', '#ffd75a', lw, -0.4);
  };

  STYLE.royal = function (ctx, s, lw) {
    wing(ctx, -0.8, -0.75, 0.86, -1, lw);
    wing(ctx, 0.8, -0.75, 0.86, 1, lw);
    const base = drumCake(ctx, DRUM, { sponge: s.sponge, frost: s.frost, outline: s.outline, band: '#ffe08a', pores: 80 }, lw, 1111);
    pearlsOnEdge(ctx, base.edge, [-0.82, -0.56, -0.3, 0.3, 0.56, 0.82], 0.05, '#ffe066', lw);
    rosetteRing(ctx, DRUM, 12, 0.08, '#ffffff', lw, 0.87, true);
    const mid = scaleDrum(0.7, DRUM.topY + 0.02, 0.56);
    const m = drumCake(ctx, mid, { sponge: '#ffe8f2', frost: '#ffffff', outline: s.outline, band: '#ffcfe4', pores: 50 }, lw, 1112, { dripDeep: 0.9 });
    pearlsOnEdge(ctx, m.edge, [-0.5, -0.25, 0, 0.25, 0.5], 0.045, '#ffe066', lw);
    rosetteRing(ctx, mid, 10, 0.07, '#ffd3e6', lw, 0.84, true);
    const top = scaleDrum(0.46, mid.topY + 0.02, 0.4);
    drumCake(ctx, top, { sponge: '#fff4e6', frost: '#ffc0dc', outline: s.outline, band: '#ffe9a8', pores: 30 }, lw, 1113, { dripDeep: 0.8 });
    crown(ctx, 0, top.topY - 0.18, 0.3, lw);
    flower(ctx, -0.5, mid.topY + 0.18, 0.12, '#ff9fd0', '#ffe066', lw, 0.3);
    flower(ctx, 0.5, mid.topY + 0.18, 0.12, '#ff9fd0', '#ffe066', lw, -0.3);
  };

  STYLE.joker = function (ctx, s, lw) {
    drumCake(ctx, DRUM, { sponge: s.sponge, frost: '#ffffff', outline: s.outline, band: '#ffb3e1', pores: 30 }, lw, 77, { rainbow: true });
    const rng = FC.rng(42);
    sprinkles(ctx, rng, 16, 0, DRUM.topY, 0.62, 0.26, ['#ffffff', '#fff3a0', '#ffd6f0', '#c9f3ff'], 0.05);
    goldStar(ctx, 0, DRUM.topY - 0.32, 0.34, lw);
  };

  // ------------------------------------------------------------------
  // Sprite cache
  // ------------------------------------------------------------------
  const cache = new Map();

  function renderSprite(tier, rpx) {
    const s = TIERS[tier];
    const ext = EXTENT[s.style];
    const pad = 2;
    const w = Math.ceil(rpx * ext.side * 2 + pad * 2);
    const top = Math.ceil(rpx * ext.top + pad);
    const bottom = Math.ceil(rpx * 1.08 + pad);
    const c = FC.makeCanvas(w, top + bottom);
    const ctx = c.getContext('2d');
    ctx.translate(w / 2, top);
    ctx.scale(rpx, rpx);
    const lw = Math.max(1.4 / rpx, 0.045);
    ctx.lineJoin = 'round';
    STYLE[s.style](ctx, s, lw);
    return { canvas: c, cx: w / 2, cy: top, rpx };
  }

  function sprite(tier, rpx) {
    let e = cache.get(tier);
    const q = Math.max(8, Math.round(rpx));
    if (!e || e.rpx !== q) {
      e = renderSprite(tier, q);
      cache.set(tier, e);
    }
    return e;
  }

  // silhouette (for the Cake Book)
  function silhouette(tier, rpx, color) {
    const sp = renderSprite(tier, rpx);
    const ctx = sp.canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, sp.canvas.width, sp.canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    return sp;
  }

  // ------------------------------------------------------------------
  // Face (live, unit space)
  // ------------------------------------------------------------------
  const EYE = '#3a2230';

  function eyeOpen(ctx, x, y, er, lx, ly, col) {
    const ox = lx * er * 0.32, oy = ly * er * 0.28;
    ctx.beginPath();
    ctx.ellipse(x + ox, y + oy, er * 0.8, er * 1.08, 0, 0, TAU);
    ctx.fillStyle = col;
    ctx.fill();
    circle(ctx, x + ox - er * 0.28, y + oy - er * 0.42, er * 0.36);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    circle(ctx, x + ox + er * 0.27, y + oy + er * 0.38, er * 0.16);
    ctx.fill();
  }

  function eyeArc(ctx, x, y, er, up, lw, col) {
    ctx.beginPath();
    if (up) ctx.arc(x, y + er * 0.45, er * 0.85, Math.PI * 1.15, Math.PI * 1.85);
    else ctx.arc(x, y - er * 0.5, er * 0.85, Math.PI * 0.15, Math.PI * 0.85);
    ctx.lineWidth = lw;
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function eyeChevron(ctx, x, y, er, dir, lw, col) {
    ctx.beginPath();
    ctx.moveTo(x - er * 0.7 * dir, y - er * 0.75);
    ctx.lineTo(x + er * 0.6 * dir, y);
    ctx.lineTo(x - er * 0.7 * dir, y + er * 0.75);
    ctx.lineWidth = lw;
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // o: {expr, blink, lookX, lookY}
  function drawFace(ctx, tier, o) {
    const s = TIERS[tier];
    const F = FACE[s.style];
    const k = (tier === 0 ? 1.1 : FC.lerp(1.22, 0.88, (tier - 1) / 10)) * F.k;
    const er = 0.1 * k;
    const ex = F.ex * (0.92 + 0.08 * k), ey = F.ey;
    const lw = er * 0.55;
    const expr = o.expr || 'normal';
    const lx = o.lookX || 0, ly = o.lookY || 0;
    const col = s.dark ? '#24100f' : EYE;

    ctx.fillStyle = s.dark ? 'rgba(255,130,165,0.5)' : 'rgba(255,120,155,0.5)';
    ctx.beginPath();
    ctx.ellipse(-F.bx, F.by, er * 1.08, er * 0.62, 0, 0, TAU);
    ctx.ellipse(F.bx, F.by, er * 1.08, er * 0.62, 0, 0, TAU);
    ctx.fill();

    if (expr === 'happy' || expr === 'love') {
      eyeArc(ctx, -ex, ey, er, true, lw, col);
      eyeArc(ctx, ex, ey, er, true, lw, col);
    } else if (expr === 'wee' || expr === 'ouch') {
      eyeChevron(ctx, -ex, ey, er, 1, lw, col);
      eyeChevron(ctx, ex, ey, er, -1, lw, col);
    } else if (expr === 'sad') {
      eyeArc(ctx, -ex, ey, er, false, lw, col);
      eyeArc(ctx, ex, ey, er, false, lw, col);
    } else if (o.blink > 0) {
      eyeArc(ctx, -ex, ey + er * 0.2, er, false, lw, col);
      eyeArc(ctx, ex, ey + er * 0.2, er, false, lw, col);
    } else {
      eyeOpen(ctx, -ex, ey, er, lx, ly, col);
      eyeOpen(ctx, ex, ey, er, lx, ly, col);
    }

    ctx.strokeStyle = col;
    if (expr === 'worried') {
      ctx.beginPath();
      ctx.moveTo(-ex - er * 0.9, ey - er * 1.5);
      ctx.lineTo(-ex + er * 0.7, ey - er * 2.0);
      ctx.moveTo(ex + er * 0.9, ey - er * 1.5);
      ctx.lineTo(ex - er * 0.7, ey - er * 2.0);
      ctx.lineWidth = lw * 0.8;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    const my = F.my;
    const mw = er * 1.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (expr === 'happy' || expr === 'love') {
      ctx.beginPath();
      ctx.moveTo(-mw * 1.2, my - mw * 0.3);
      ctx.quadraticCurveTo(0, my - mw * 0.5, mw * 1.2, my - mw * 0.3);
      ctx.quadraticCurveTo(mw * 1.0, my + mw * 1.4, 0, my + mw * 1.4);
      ctx.quadraticCurveTo(-mw * 1.0, my + mw * 1.4, -mw * 1.2, my - mw * 0.3);
      ctx.closePath();
      ctx.fillStyle = '#9b2d4a';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, my + mw * 0.9, mw * 0.62, mw * 0.4, 0, 0, TAU);
      ctx.fillStyle = '#ff8a9e';
      ctx.fill();
    } else if (expr === 'wee') {
      ctx.beginPath();
      ctx.ellipse(0, my + mw * 0.3, mw * 0.6, mw * 0.78, 0, 0, TAU);
      ctx.fillStyle = '#9b2d4a';
      ctx.fill();
    } else if (expr === 'ouch' || expr === 'worried' || expr === 'sad') {
      ctx.beginPath();
      ctx.moveTo(-mw, my + mw * 0.3);
      ctx.quadraticCurveTo(-mw * 0.5, my - mw * 0.2, 0, my + mw * 0.3);
      ctx.quadraticCurveTo(mw * 0.5, my + mw * 0.8, mw, my + mw * 0.3);
      ctx.lineWidth = lw * 0.8;
      ctx.strokeStyle = col;
      ctx.stroke();
    } else if (s.mouth === 'cat') {
      ctx.beginPath();
      ctx.arc(-mw * 0.5, my, mw * 0.5, 0.1, Math.PI - 0.1);
      ctx.arc(mw * 0.5, my, mw * 0.5, 0.1, Math.PI - 0.1);
      ctx.lineWidth = lw * 0.75;
      ctx.strokeStyle = col;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-mw * 0.85, my);
      ctx.quadraticCurveTo(0, my + mw * 0.1, mw * 0.85, my);
      ctx.quadraticCurveTo(mw * 0.7, my + mw * 1.1, 0, my + mw * 1.1);
      ctx.quadraticCurveTo(-mw * 0.7, my + mw * 1.1, -mw * 0.85, my);
      ctx.closePath();
      ctx.fillStyle = '#9b2d4a';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, my + mw * 0.72, mw * 0.42, mw * 0.26, 0, 0, TAU);
      ctx.fillStyle = '#ff8a9e';
      ctx.fill();
    }

    if (expr === 'worried') {
      const sx = ex + er * 2.4, sy = ey - er * 1.6;
      ctx.beginPath();
      ctx.moveTo(sx, sy - er * 1.2);
      ctx.quadraticCurveTo(sx + er * 0.8, sy, sx, sy + er * 0.6);
      ctx.quadraticCurveTo(sx - er * 0.8, sy, sx, sy - er * 1.2);
      ctx.fillStyle = '#8fd8ff';
      ctx.fill();
      ctx.lineWidth = lw * 0.4;
      ctx.strokeStyle = '#4aa6d8';
      ctx.stroke();
    }
    if (expr === 'sad') {
      ctx.beginPath();
      ctx.ellipse(-ex, ey + er * 1.4, er * 0.35, er * 0.55, 0, 0, TAU);
      ctx.fillStyle = '#8fd8ff';
      ctx.fill();
    }
    if (expr === 'love') {
      FC.heartPath(ctx, ex + er * 2.3, ey - er * 2.2, er * 0.9);
      ctx.fillStyle = '#ff6f9a';
      ctx.fill();
    }
  }

  // Icon (HUD, book, how-to): cake + face into a canvas
  function drawIcon(canvas, tier, opts) {
    const o = opts || {};
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = o.w || canvas.clientWidth || 64, cssH = o.h || canvas.clientHeight || 64;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const s = TIERS[tier];
    const ext = EXTENT[s.style];
    const fitH = ext.top + 1.08, fitW = ext.side * 2;
    const rpx = Math.min(canvas.width / fitW, canvas.height / fitH) * (o.scale || 0.92);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2 + (rpx * (ext.top - 1.08)) / 2;
    if (o.silhouette) {
      const sp = silhouette(tier, rpx, o.silhouette);
      ctx.drawImage(sp.canvas, cx - sp.cx, cy - sp.cy);
      return;
    }
    // soft contact shadow
    ctx.beginPath();
    ctx.ellipse(cx, cy + rpx * 0.92, rpx * 0.95, rpx * 0.22, 0, 0, TAU);
    ctx.fillStyle = 'rgba(120,60,90,0.16)';
    ctx.fill();
    const sp = renderSprite(tier, rpx);
    ctx.drawImage(sp.canvas, cx - sp.cx, cy - sp.cy);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(rpx, rpx);
    drawFace(ctx, tier, { expr: o.expr || 'normal', blink: 0, lookX: 0, lookY: 0.2 });
    ctx.restore();
  }

  function clearCache() {
    cache.clear();
  }

  FC.Cakes = { TIERS, MAX_TIER, FACE, EXTENT, sprite, renderSprite, drawFace, drawIcon, silhouette, clearCache };
})();
