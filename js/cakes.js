/* Fairycake Falls – cake tiers, the cake collection and procedural cake art (Canvas 2D).

   TIERS are the sizes: a cake's tier decides its radius, its points and its silhouette
   (macaron, bite, cupcake, tart, drum, layered, winged torte, royal), so "same size merges"
   stays readable everywhere. KINDS are the collectible cakes: every world has its own menu –
   one kind per tier – plus a few rare finds that can turn up in any world. A kind carries its
   name, epithet, lore, ingredients and the parameters its style painter needs.

   Cakes are painted as soft 3/4-view "drums" (cylinders) in unit space: the physics footprint
   is the unit circle around (0,0); the top face sits above it and the bottom rim touches y≈+0.96.
   The body sprite is cached per kind; the face is drawn live (blinking, gaze, expressions). */
(function () {
  'use strict';
  const FC = window.FC;
  const TAU = FC.TAU;
  const shade = FC.shade, rgba = FC.rgba, mix = FC.mix;

  // ------------------------------------------------------------------
  // Tiers: size, points and silhouette style
  // ------------------------------------------------------------------
  const TIERS = [
    { id: 0, r: 80, style: 'joker' },
    { id: 1, r: 74, style: 'macaron' },
    { id: 2, r: 88, style: 'classic' },
    { id: 3, r: 103, style: 'cupcake' },
    { id: 4, r: 119, style: 'tart' },
    { id: 5, r: 136, style: 'classic' },
    { id: 6, r: 154, style: 'classic' },
    { id: 7, r: 173, style: 'classic' },
    { id: 8, r: 193, style: 'classic' },
    { id: 9, r: 214, style: 'layered' },
    { id: 10, r: 236, style: 'tiered' },
    { id: 11, r: 259, style: 'royal' },
  ];
  const MAX_TIER = 11;
  for (const t of TIERS) t.score = t.id >= 2 ? t.id * (t.id - 1) : 0;
  const SIZE_NAMES = ['Power-up', 'Macaron', 'Bite', 'Cupcake', 'Tart', 'Cake', 'Cake', 'Cake', 'Cake', 'Layer cake', 'Torte', 'Royal cake'];

  // face placement per style (unit space)
  const FACE = {
    classic: { ey: 0.46, ex: 0.3, my: 0.63, bx: 0.6, by: 0.6, k: 1 },
    cupcake: { ey: 0.56, ex: 0.27, my: 0.72, bx: 0.52, by: 0.69, k: 0.95 },
    macaron: { ey: 0.1, ex: 0.32, my: 0.26, bx: 0.62, by: 0.23, k: 1 },
    pop: { ey: -0.08, ex: 0.3, my: 0.1, bx: 0.58, by: 0.06, k: 1 },
    tart: { ey: 0.62, ex: 0.3, my: 0.77, bx: 0.62, by: 0.74, k: 0.85 },
    layered: { ey: 0.47, ex: 0.3, my: 0.64, bx: 0.6, by: 0.61, k: 1 },
    tiered: { ey: 0.47, ex: 0.3, my: 0.64, bx: 0.6, by: 0.61, k: 1 },
    royal: { ey: 0.48, ex: 0.3, my: 0.65, bx: 0.6, by: 0.62, k: 1 },
    joker: { ey: 0.45, ex: 0.3, my: 0.62, bx: 0.6, by: 0.59, k: 1.05 },
  };

  // sprite extent relative to the radius (top / sides)
  const EXTENT = {
    classic: { top: 1.6, side: 1.18 },
    cupcake: { top: 1.4, side: 1.15 },
    macaron: { top: 1.1, side: 1.12 },
    pop: { top: 1.15, side: 1.12 },
    tart: { top: 1.25, side: 1.15 },
    layered: { top: 1.7, side: 1.18 },
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

  // a band on the drum side (filling / jam / layer)
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
        if (i > 0) sideBand(ctx, d, d.topY + i * h - 0.012, 0.026, o.stripeLine || '#fffaf2');
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
    // scale pattern on the side (dragon egg)
    if (o.scales) {
      ctx.lineWidth = 0.02;
      ctx.strokeStyle = rgba(shade(col, -0.4), 0.45);
      const rows = 5;
      for (let rI = 0; rI < rows; rI++) {
        const yy = d.topY + d.ry + ((d.botY - d.topY - d.ry) * (rI + 0.2)) / rows;
        for (let k = -6; k <= 6; k++) {
          const u = (k + (rI % 2) * 0.5) / 6.5;
          if (u < -1 || u > 1) continue;
          const x = u * d.rx, cu = Math.sqrt(1 - u * u);
          ctx.beginPath();
          ctx.arc(x, yy + d.ry * cu * 0.25, 0.1 * (0.5 + cu * 0.5) + 0.03, Math.PI * 0.1, Math.PI * 0.9);
          ctx.stroke();
        }
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

  // a conic sweep of colours over the top face (rainbow / galaxy / aurora)
  function topSweep(ctx, d, colors, alpha, start) {
    if (!ctx.createConicGradient) return;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, d.topY, d.rx * 0.975, d.ry * 0.95, 0, 0, TAU);
    ctx.clip();
    const g = ctx.createConicGradient(start || 1.2, 0, d.topY);
    colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
    ctx.globalAlpha = alpha == null ? 0.7 : alpha;
    ctx.fillStyle = g;
    ctx.fillRect(-1.2 * d.rx, d.topY - d.ry * 1.2, 2.4 * d.rx, d.ry * 2.4);
    ctx.restore();
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
    if (o.sweep && ctx.createConicGradient) {
      const g = ctx.createConicGradient(0.4, 0, d.topY + 0.1);
      const cs = o.sweep.concat([o.sweep[0]]);
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
    ctx.strokeStyle = shade(o.sweep ? o.sweepLine || o.sweep[o.sweep.length - 1] : fr, s.dark ? -0.45 : -0.3);
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
    if (o.sweep) {
      paintTopFace(ctx, dF, o.sweepTop || '#fff4fb', false);
      topSweep(ctx, dF, o.sweepSoft || o.sweep.concat([o.sweep[0]]), o.sweepAlpha == null ? 0.7 : o.sweepAlpha, 1.2);
    } else paintTopFace(ctx, dF, fr, s.dark);
    // polka dots on the frosting (toadstool)
    if (o.dots) {
      const rng = FC.rng(o.dotSeed || 5);
      ctx.save();
      frostPath(ctx, dF, edge);
      ctx.clip();
      ctx.fillStyle = o.dots;
      const pts = [[-0.62, 0.1], [-0.2, 0.22], [0.3, 0.16], [0.7, 0.05], [-0.45, -0.32], [0.05, -0.4], [0.5, -0.3], [-0.85, -0.08], [0.88, -0.12], [-0.3, 0.5], [0.2, 0.52], [0.62, 0.42], [-0.7, 0.42]];
      for (const p of pts) {
        const x = p[0] * dF.rx, cu = Math.sqrt(Math.max(0, 1 - p[0] * p[0]));
        const y = p[1] < 0.3 ? d.topY + p[1] * dF.ry * 1.9 : edge(x) - (0.22 + rng() * 0.08) * d.rx - (p[1] - 0.3) * 0.5 * d.rx;
        const sz = (0.055 + rng() * 0.03) * d.rx * (o.dotScale || 1);
        ctx.beginPath();
        ctx.ellipse(x, y, sz * (0.55 + cu * 0.45), sz * (p[1] < 0.3 ? 0.62 : 0.9), 0, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    // a drizzle (honey, caramel) running down over the drips
    if (o.drizzle) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineWidth = lw * 1.1;
      ctx.strokeStyle = o.drizzle;
      for (const u of [-0.78, -0.42, -0.05, 0.36, 0.72]) {
        const x = u * dF.rx;
        const y0 = d.topY + Math.sqrt(1 - u * u) * dF.ry * 0.5;
        ctx.beginPath();
        ctx.moveTo(x, y0);
        ctx.quadraticCurveTo(x + 0.04 * d.rx, (y0 + edge(x)) / 2, x - 0.02 * d.rx, edge(x) + 0.12 * d.rx);
        ctx.stroke();
      }
      ctx.restore();
    }
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
    ctx.lineCap = 'round';
    ctx.lineWidth = lw * 0.38;
    ctx.strokeStyle = rgba(shade(col, -0.3), 0.45);
    for (const k of [-0.55, 0, 0.55]) {
      ctx.beginPath();
      ctx.moveTo(k * s - s * 0.12, -s * 0.2);
      ctx.quadraticCurveTo(k * s + s * 0.08, s * 0.15, k * s - s * 0.02, s * 0.5);
      ctx.stroke();
    }
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

  // a glossy ball (cherry, blueberry, sugarplum, pearl ...)
  function glossBall(ctx, x, y, r, hi, mid, deep, line, lw, k) {
    circle(ctx, x, y, r);
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r * 1.05);
    g.addColorStop(0, hi);
    g.addColorStop(0.45, mid);
    g.addColorStop(1, deep);
    ctx.fillStyle = g;
    ctx.fill();
    if (line) {
      ctx.lineWidth = lw * (k || 0.8);
      ctx.strokeStyle = line;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(x - r * 0.36, y - r * 0.38, r * 0.3, r * 0.18, -0.7, 0, TAU);
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
    glossBall(ctx, x, y, s, '#ff9aa6', '#ee3a55', '#a8173a', '#7f1230', lw);
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

  function flower(ctx, x, y, s, petal, center, lw, rot, n) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.scale(1, 0.84);
    const np = n || 5;
    for (let i = 0; i < np; i++) {
      const a = (i / np) * TAU - Math.PI / 2;
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

  function mintLeaf(ctx, x, y, s, ang, lw, cols) {
    const c = cols || ['#a9eb8c', '#5aad47', '#3c8533'];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(s * 0.5, -s * 0.45, s * 1.1, 0);
    ctx.quadraticCurveTo(s * 0.5, s * 0.45, 0, 0);
    const g = ctx.createLinearGradient(0, -s * 0.4, 0, s * 0.4);
    g.addColorStop(0, c[0]);
    g.addColorStop(1, c[1]);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = lw * 0.55;
    ctx.strokeStyle = c[2];
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.08, 0);
    ctx.lineTo(s * 0.9, 0);
    ctx.stroke();
    ctx.restore();
  }

  function citrusSlice(ctx, x, y, s, lw, cols) {
    const c = cols || { rind: '#e0a514', peel: '#f8c826', line: '#c08a10', pith: '#fffbe2', a: '#fff07a', b: '#ffe557' };
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.3);
    ctx.scale(1, 0.92);
    circle(ctx, s * 0.06, s * 0.08, s);
    ctx.fillStyle = c.rind;
    ctx.fill();
    circle(ctx, 0, 0, s);
    ctx.fillStyle = c.peel;
    ctx.fill();
    ctx.lineWidth = lw * 0.7;
    ctx.strokeStyle = c.line;
    ctx.stroke();
    circle(ctx, 0, 0, s * 0.86);
    ctx.fillStyle = c.pith;
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * TAU + 0.07, a1 = ((i + 1) / 8) * TAU - 0.07;
      ctx.beginPath();
      ctx.moveTo(Math.cos((a0 + a1) / 2) * s * 0.12, Math.sin((a0 + a1) / 2) * s * 0.12);
      ctx.arc(0, 0, s * 0.76, a0, a1);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? c.a : c.b;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(-s * 0.35, -s * 0.38, s * 0.24, s * 0.12, -0.7, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();
    ctx.restore();
  }
  const ORANGE = { rind: '#d8731a', peel: '#ff9a3c', line: '#b65d12', pith: '#fff3e2', a: '#ffc27a', b: '#ffad55' };
  const KIWI = { rind: '#6b4a2a', peel: '#8a6a3c', line: '#55381c', pith: '#f1f7c8', a: '#a8d86a', b: '#8cc752' };

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

  // tiny stars scattered on the top (star sprinkles)
  function starDust(ctx, rng, n, cx, cy, rx, ry, colors, size) {
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU, rr = Math.sqrt(rng());
      const x = cx + Math.cos(a) * rx * rr, y = cy + Math.sin(a) * ry * rr;
      FC.starPath(ctx, x, y, size * (0.7 + rng() * 0.6), 0.5, rng() * TAU);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
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

  function blueberries(ctx, x, y, s, lw, cols) {
    const c = cols || ['#9aa6ff', '#4f5fd8', '#2a3596', '#1f2a78', '#25307f'];
    const pos = [[-0.5, 0.18], [0.05, 0.28], [0.56, 0.16], [-0.26, -0.18], [0.32, -0.2], [0.03, -0.55]];
    for (const p of pos) {
      const bx = x + p[0] * s, by = y + p[1] * s, br = s * 0.36;
      glossBall(ctx, bx, by, br, c[0], c[1], c[2], c[3], lw, 0.6);
      FC.starPath(ctx, bx + br * 0.1, by - br * 0.15, br * 0.28, 0.45);
      ctx.fillStyle = c[4];
      ctx.fill();
    }
    mintLeaf(ctx, x + s * 0.25, y - s * 0.62, s * 0.42, -0.5, lw);
  }

  // a blackberry / raspberry: a cluster of little drupelets
  function bramble(ctx, x, y, s, lw, hi, mid, deep, line) {
    const dots = [[0, -0.55], [-0.4, -0.25], [0.4, -0.25], [-0.55, 0.15], [0, 0.1], [0.55, 0.15], [-0.3, 0.55], [0.3, 0.55]];
    ctx.save();
    for (const d of dots) {
      glossBall(ctx, x + d[0] * s, y + d[1] * s, s * 0.34, hi, mid, deep, null, lw);
    }
    ctx.beginPath();
    for (const d of dots) { ctx.moveTo(x + d[0] * s + s * 0.34, y + d[1] * s); ctx.arc(x + d[0] * s, y + d[1] * s, s * 0.34, 0, TAU); }
    ctx.lineWidth = lw * 0.5;
    ctx.strokeStyle = line;
    ctx.stroke();
    ctx.restore();
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

  function chocoChips(ctx, rng, n, cx, cy, rx, ry, size) {
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU, rr = Math.sqrt(rng());
      const x = cx + Math.cos(a) * rx * rr, y = cy + Math.sin(a) * ry * rr;
      ctx.beginPath();
      ctx.moveTo(x - size, y + size * 0.5);
      ctx.quadraticCurveTo(x, y - size * 1.1, x + size, y + size * 0.5);
      ctx.closePath();
      ctx.fillStyle = '#4a2a1e';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - size * 0.2, y - size * 0.1, size * 0.22, 0, TAU);
      ctx.fillStyle = 'rgba(255,220,200,0.5)';
      ctx.fill();
    }
  }

  function goldStar(ctx, x, y, s, lw, cols) {
    const c = cols || { top: '#fff7b8', mid: '#ffd23f', bot: '#f0a020', line: '#b86f12', glow: 'rgba(255,240,150,0.55)', back: '#d98a14' };
    ctx.save();
    const gl = ctx.createRadialGradient(x, y, 0, x, y, s * 1.9);
    gl.addColorStop(0, c.glow);
    gl.addColorStop(1, 'rgba(255,240,150,0)');
    ctx.fillStyle = gl;
    circle(ctx, x, y, s * 1.9);
    ctx.fill();
    FC.starPath(ctx, x, y + s * 0.12, s, 0.5);
    ctx.fillStyle = c.back;
    ctx.fill();
    FC.starPath(ctx, x, y, s, 0.5);
    const g = ctx.createLinearGradient(x, y - s, x, y + s);
    g.addColorStop(0, c.top);
    g.addColorStop(0.5, c.mid);
    g.addColorStop(1, c.bot);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw * 0.8;
    ctx.strokeStyle = c.line;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x - s * 0.2, y - s * 0.25, s * 0.2, s * 0.1, -0.6, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    ctx.restore();
  }
  const SILVER_STAR = { top: '#ffffff', mid: '#dfe9ff', bot: '#9fb3e8', line: '#5c6fb3', glow: 'rgba(210,225,255,0.6)', back: '#7f91cf' };

  function crescent(ctx, x, y, s, lw, cols) {
    const c = cols || { a: '#fff9d6', b: '#ffe27a', line: '#c9a128' };
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.5);
    ctx.beginPath();
    ctx.arc(0, 0, s, Math.PI * 0.5, Math.PI * 1.5, false);
    ctx.arc(s * 0.35, 0, s * 0.72, Math.PI * 1.5, Math.PI * 0.5, true);
    ctx.closePath();
    const g = ctx.createLinearGradient(-s, -s, s * 0.5, s);
    g.addColorStop(0, c.a);
    g.addColorStop(1, c.b);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw * 0.7;
    ctx.strokeStyle = c.line;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-s * 0.55, -s * 0.35, s * 0.16, s * 0.08, -1.1, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    ctx.restore();
  }

  function crown(ctx, x, y, s, lw, kind) {
    const K = kind || 'gold';
    const cols = K === 'moon' ? { a: '#ffffff', b: '#d9e3ff', c: '#9aaee6', line: '#5a6cb0', gem: ['#b8c8ff', '#ffffff', '#d7c3ff'] }
      : K === 'leaf' ? { a: '#d8f3a6', b: '#86c95a', c: '#4f9a3c', line: '#2f6b2c', gem: ['#ff5f7a', '#ffd34d', '#ff8fb4'] }
        : { a: '#fff6b2', b: '#ffcf3a', c: '#e8901a', line: '#ad6716', gem: K === 'jewel' ? ['#ff5f8f', '#5fc8ff', '#8fe36a'] : ['#ff7fb3', '#7fc8ff', '#9be59a'] };
    ctx.save();
    ctx.translate(x, y);
    const w = s * 1.1, h = s * 0.8;
    const empress = K === 'empress';
    ctx.beginPath();
    ctx.moveTo(-w, h * 0.35);
    ctx.lineTo(-w * 1.05, -h * 0.55);
    ctx.lineTo(-w * 0.5, -h * 0.05);
    if (empress) { ctx.lineTo(-w * 0.25, -h * 0.75); ctx.lineTo(0, -h * 0.3); ctx.lineTo(w * 0.25, -h * 0.75); }
    else ctx.lineTo(0, -h * 0.85);
    ctx.lineTo(w * 0.5, -h * 0.05);
    ctx.lineTo(w * 1.05, -h * 0.55);
    ctx.lineTo(w, h * 0.35);
    ctx.quadraticCurveTo(0, h * 0.62, -w, h * 0.35);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -h, 0, h * 0.6);
    g.addColorStop(0, cols.a);
    g.addColorStop(0.5, cols.b);
    g.addColorStop(1, cols.c);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw * 0.8;
    ctx.strokeStyle = cols.line;
    ctx.stroke();
    if (K === 'leaf') {
      // leaves along the band
      for (const k of [-0.75, -0.3, 0.15, 0.6]) mintLeaf(ctx, k * w, h * 0.05, s * 0.42, -0.6 + k * 0.6, lw, ['#b9ea7c', '#5aad47', '#2f6b2c']);
    }
    const tips = empress ? [[-w * 1.05, -h * 0.55], [-w * 0.25, -h * 0.75], [w * 0.25, -h * 0.75], [w * 1.05, -h * 0.55]] : [[-w * 1.05, -h * 0.55], [0, -h * 0.85], [w * 1.05, -h * 0.55]];
    for (const p of tips) {
      circle(ctx, p[0], p[1], s * 0.14);
      ctx.fillStyle = K === 'leaf' ? '#ff7f9c' : K === 'moon' ? '#ffffff' : '#fff1a0';
      ctx.fill();
      ctx.stroke();
    }
    if (K === 'moon') crescent(ctx, 0, -h * 0.95, s * 0.3, lw, { a: '#ffffff', b: '#e3ebff', line: '#5a6cb0' });
    if (empress) goldStar(ctx, 0, -h * 0.55, s * 0.26, lw);
    const gems = [[-w * 0.55, h * 0.22, cols.gem[0]], [0, h * 0.27, cols.gem[1]], [w * 0.55, h * 0.22, cols.gem[2]]];
    for (const gm of gems) {
      ctx.beginPath();
      ctx.ellipse(gm[0], gm[1], s * 0.15, s * 0.12, 0, 0, TAU);
      ctx.fillStyle = gm[2];
      ctx.fill();
      ctx.lineWidth = lw * 0.5;
      ctx.strokeStyle = cols.line;
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

  function wing(ctx, x, y, s, side, lw, tint) {
    const t = tint || { a: 'rgba(255,255,255,0.96)', b: 'rgba(255,225,245,0.9)', c: 'rgba(226,200,255,0.85)', line: 'rgba(205,130,190,0.95)', vein: 'rgba(205,130,190,0.6)' };
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(side, 1);
    const g = ctx.createLinearGradient(0, -s, s * 1.2, 0);
    g.addColorStop(0, t.a);
    g.addColorStop(0.6, t.b);
    g.addColorStop(1, t.c);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(s * 0.2, -s * 1.1, s * 1.25, -s * 1.25, s * 1.15, -s * 0.45);
    ctx.bezierCurveTo(s * 1.1, -s * 0.1, s * 0.5, 0.05 * s, 0, 0);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = lw * 0.7;
    ctx.strokeStyle = t.line;
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
    ctx.strokeStyle = t.vein;
    ctx.stroke();
    FC.sparklePath(ctx, s * 0.75, -s * 0.7, s * 0.14);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    FC.sparklePath(ctx, s * 0.45, s * 0.45, s * 0.09);
    ctx.fill();
    ctx.restore();
  }
  const WING_LEAF = { a: 'rgba(240,255,220,0.96)', b: 'rgba(200,240,170,0.9)', c: 'rgba(150,210,120,0.85)', line: 'rgba(80,140,70,0.95)', vein: 'rgba(80,140,70,0.6)' };
  const WING_MOON = { a: 'rgba(255,255,255,0.96)', b: 'rgba(220,230,255,0.9)', c: 'rgba(170,185,240,0.85)', line: 'rgba(110,125,200,0.95)', vein: 'rgba(110,125,200,0.6)' };
  const WING_GOLD = { a: 'rgba(255,255,245,0.96)', b: 'rgba(255,240,190,0.9)', c: 'rgba(255,210,120,0.85)', line: 'rgba(200,140,40,0.95)', vein: 'rgba(200,140,40,0.6)' };
  const WING_NIGHT = { a: 'rgba(250,245,255,0.96)', b: 'rgba(215,200,255,0.9)', c: 'rgba(150,130,230,0.85)', line: 'rgba(100,80,190,0.95)', vein: 'rgba(100,80,190,0.6)' };

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

  // --- new decorations ---
  function cloudPuff(ctx, x, y, s, lw, line) {
    for (const q of [[-0.45, 0.05, 0.42], [0.1, -0.15, 0.5], [0.55, 0.08, 0.38], [0.05, 0.22, 0.42]]) {
      circle(ctx, x + q[0] * s, y + q[1] * s, q[2] * s);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.beginPath();
    for (const q of [[-0.45, 0.05, 0.42], [0.1, -0.15, 0.5], [0.55, 0.08, 0.38], [0.05, 0.22, 0.42]]) { ctx.moveTo(x + q[0] * s + q[2] * s, y + q[1] * s); ctx.arc(x + q[0] * s, y + q[1] * s, q[2] * s, 0, TAU); }
    ctx.lineWidth = lw * 0.5;
    ctx.strokeStyle = line || 'rgba(127,115,196,0.45)';
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x - s * 0.2, y - s * 0.35, s * 0.22, s * 0.1, -0.4, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();
  }

  function honeycomb(ctx, x, y, s, lw) {
    ctx.save();
    ctx.translate(x, y);
    const cells = [[0, 0], [0.87, 0.5], [0, 1], [-0.87, 0.5], [0.87, -0.5], [-0.87, -0.5], [0, -1]];
    for (const c of cells) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + Math.PI / 6;
        const px = (c[0] + Math.cos(a) * 0.55) * s, py = (c[1] + Math.sin(a) * 0.55) * s * 0.8;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#ffc63a';
      ctx.fill();
      ctx.lineWidth = lw * 0.55;
      ctx.strokeStyle = '#b87414';
      ctx.stroke();
      circle(ctx, c[0] * s, c[1] * s * 0.8, s * 0.2);
      ctx.fillStyle = 'rgba(255,240,160,0.9)';
      ctx.fill();
    }
    ctx.restore();
  }

  function bee(ctx, x, y, s, lw) {
    ctx.save();
    ctx.translate(x, y);
    for (const w of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(w * s * 0.35, -s * 0.55, s * 0.4, s * 0.26, w * 0.5, 0, TAU);
      ctx.fillStyle = 'rgba(230,240,255,0.85)';
      ctx.fill();
      ctx.lineWidth = lw * 0.4;
      ctx.strokeStyle = 'rgba(120,130,200,0.8)';
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.62, 0, 0, TAU);
    ctx.fillStyle = '#ffd13d';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#3a2a1a';
    for (const k of [-0.45, 0.1, 0.6]) ctx.fillRect(k * s, -s, s * 0.22, s * 2);
    ctx.restore();
    ctx.lineWidth = lw * 0.6;
    ctx.strokeStyle = '#6b4a14';
    ctx.stroke();
    circle(ctx, -s * 0.9, -s * 0.1, s * 0.28);
    ctx.fillStyle = '#3a2a1a';
    ctx.fill();
    circle(ctx, -s * 0.98, -s * 0.18, s * 0.08);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }

  function appleSlices(ctx, x, y, s, lw) {
    for (const p of [[-0.5, 0.1, -0.3], [0.1, -0.12, 0.2], [0.6, 0.12, -0.1]]) {
      ctx.save();
      ctx.translate(x + p[0] * s, y + p[1] * s);
      ctx.rotate(p[2]);
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.42, Math.PI, TAU);
      ctx.closePath();
      ctx.fillStyle = '#fff2b8';
      ctx.fill();
      ctx.lineWidth = lw * 0.6;
      ctx.strokeStyle = '#b8862a';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.42, Math.PI, TAU);
      ctx.lineWidth = lw * 1.1;
      ctx.strokeStyle = '#d64f4a';
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.12, s * 0.05, s * 0.08, 0, 0, TAU);
      ctx.fillStyle = '#6a4a2a';
      ctx.fill();
      ctx.restore();
    }
  }

  function crumble(ctx, rng, n, cx, cy, rx, ry, size) {
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU, rr = Math.sqrt(rng());
      const x = cx + Math.cos(a) * rx * rr, y = cy + Math.sin(a) * ry * rr;
      circle(ctx, x, y, size * (0.6 + rng() * 0.7));
      ctx.fillStyle = ['#e9b25f', '#d49640', '#f5c97a'][i % 3];
      ctx.fill();
    }
  }

  function toadstool(ctx, x, y, s, lw) {
    ctx.save();
    ctx.translate(x, y);
    // stem
    FC.roundRect(ctx, -s * 0.28, -s * 0.1, s * 0.56, s * 0.8, s * 0.2);
    ctx.fillStyle = '#fff3e0';
    ctx.fill();
    ctx.lineWidth = lw * 0.6;
    ctx.strokeStyle = '#b98a6a';
    ctx.stroke();
    // cap
    ctx.beginPath();
    ctx.moveTo(-s, 0);
    ctx.bezierCurveTo(-s * 1.05, -s * 1.1, s * 1.05, -s * 1.1, s, 0);
    ctx.quadraticCurveTo(0, s * 0.25, -s, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(-s, -s, s * 0.5, 0);
    g.addColorStop(0, '#ff8a8a');
    g.addColorStop(0.5, '#ee3d3d');
    g.addColorStop(1, '#b51f2a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = lw * 0.7;
    ctx.strokeStyle = '#8a1424';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    for (const d of [[-0.5, -0.35, 0.14], [0.1, -0.6, 0.16], [0.6, -0.3, 0.12], [-0.1, -0.2, 0.1]]) { circle(ctx, d[0] * s, d[1] * s, d[2] * s); ctx.fill(); }
    ctx.restore();
  }

  function gingerMan(ctx, x, y, s, lw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const body = () => {
      ctx.beginPath();
      ctx.arc(0, -s * 0.7, s * 0.36, 0, TAU); // head
      ctx.moveTo(-s * 0.25, -s * 0.4);
      ctx.lineTo(-s * 0.95, -s * 0.15); ctx.lineTo(-s * 0.85, s * 0.08); ctx.lineTo(-s * 0.3, -s * 0.05);
      ctx.lineTo(-s * 0.55, s * 0.8); ctx.lineTo(-s * 0.28, s * 0.9); ctx.lineTo(0, s * 0.3);
      ctx.lineTo(s * 0.28, s * 0.9); ctx.lineTo(s * 0.55, s * 0.8); ctx.lineTo(s * 0.3, -s * 0.05);
      ctx.lineTo(s * 0.85, s * 0.08); ctx.lineTo(s * 0.95, -s * 0.15); ctx.lineTo(s * 0.25, -s * 0.4);
      ctx.closePath();
    };
    body();
    ctx.lineWidth = lw * 2.2;
    ctx.strokeStyle = '#7a4420';
    ctx.stroke();
    body();
    ctx.fillStyle = '#c47a3a';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = lw * 0.6;
    ctx.beginPath();
    ctx.moveTo(-s * 0.9, -s * 0.05); ctx.lineTo(-s * 0.6, -s * 0.1);
    ctx.moveTo(s * 0.9, -s * 0.05); ctx.lineTo(s * 0.6, -s * 0.1);
    ctx.moveTo(-s * 0.48, s * 0.72); ctx.lineTo(-s * 0.3, s * 0.65);
    ctx.moveTo(s * 0.48, s * 0.72); ctx.lineTo(s * 0.3, s * 0.65);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    for (const b of [0.1, 0.4]) { circle(ctx, 0, s * b, s * 0.07); ctx.fill(); }
    ctx.fillStyle = '#3a2218';
    circle(ctx, -s * 0.13, -s * 0.75, s * 0.055); ctx.fill();
    circle(ctx, s * 0.13, -s * 0.75, s * 0.055); ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -s * 0.65, s * 0.14, 0.2, Math.PI - 0.2);
    ctx.lineWidth = lw * 0.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();
  }

  function mapleLeaf(ctx, x, y, s, lw, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.scale(1, 0.85);
    ctx.beginPath();
    const pts = [[0, -1], [0.2, -0.55], [0.6, -0.75], [0.5, -0.35], [1, -0.3], [0.65, 0.05], [0.8, 0.45], [0.3, 0.3], [0.12, 0.9], [-0.12, 0.9], [-0.3, 0.3], [-0.8, 0.45], [-0.65, 0.05], [-1, -0.3], [-0.5, -0.35], [-0.6, -0.75], [-0.2, -0.55]];
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0] * s, p[1] * s) : ctx.moveTo(p[0] * s, p[1] * s)));
    ctx.closePath();
    const g = ctx.createLinearGradient(-s, -s, s, s);
    g.addColorStop(0, '#ffb04a');
    g.addColorStop(0.6, '#f0762c');
    g.addColorStop(1, '#c84a1e');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw * 0.6;
    ctx.strokeStyle = '#8a3414';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, s * 0.85); ctx.lineTo(0, -s * 0.8);
    ctx.moveTo(0, 0); ctx.lineTo(s * 0.75, -s * 0.3);
    ctx.moveTo(0, 0); ctx.lineTo(-s * 0.75, -s * 0.3);
    ctx.lineWidth = lw * 0.35;
    ctx.strokeStyle = 'rgba(138,52,20,0.5)';
    ctx.stroke();
    ctx.restore();
  }

  function pecan(ctx, x, y, s, lw, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.6, 0, 0, TAU);
    const g = ctx.createLinearGradient(-s, -s, s, s);
    g.addColorStop(0, '#d9a066');
    g.addColorStop(1, '#8a5a30');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = lw * 0.55;
    ctx.strokeStyle = '#5a3818';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.8, 0);
    ctx.quadraticCurveTo(0, -s * 0.25, s * 0.8, 0);
    ctx.lineWidth = lw * 0.4;
    ctx.stroke();
    ctx.restore();
  }

  function acorn(ctx, x, y, s, lw) {
    ctx.save();
    ctx.translate(x, y);
    // nut
    ctx.beginPath();
    ctx.moveTo(-s * 0.72, -s * 0.1);
    ctx.bezierCurveTo(-s * 0.75, s * 0.6, -s * 0.3, s * 1.0, 0, s * 1.05);
    ctx.bezierCurveTo(s * 0.3, s * 1.0, s * 0.75, s * 0.6, s * 0.72, -s * 0.1);
    ctx.closePath();
    const g = ctx.createLinearGradient(-s, 0, s, s);
    g.addColorStop(0, '#e2a765');
    g.addColorStop(1, '#9a6230');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = lw * 0.7;
    ctx.strokeStyle = '#5a3818';
    ctx.stroke();
    // cap
    ctx.beginPath();
    ctx.moveTo(-s * 0.85, -s * 0.05);
    ctx.quadraticCurveTo(0, -s * 0.95, s * 0.85, -s * 0.05);
    ctx.quadraticCurveTo(0, s * 0.18, -s * 0.85, -s * 0.05);
    ctx.closePath();
    ctx.fillStyle = '#7a4a22';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,220,170,0.35)';
    for (let r = 0; r < 2; r++) for (let k = -3; k <= 3; k++) { circle(ctx, k * s * 0.22 + (r ? s * 0.11 : 0), -s * 0.55 + r * s * 0.25 + Math.abs(k) * s * 0.06, s * 0.07); ctx.fill(); }
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.75);
    ctx.quadraticCurveTo(s * 0.1, -s * 1.1, s * 0.3, -s * 1.2);
    ctx.lineWidth = lw * 0.9;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#5a3818';
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-s * 0.3, s * 0.25, s * 0.15, s * 0.28, 0.3, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fill();
    ctx.restore();
  }

  function coffeeBean(ctx, x, y, s, lw, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.68, 0, 0, TAU);
    const g = ctx.createLinearGradient(-s, -s, s, s);
    g.addColorStop(0, '#9a6a44');
    g.addColorStop(1, '#4a2a18');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = lw * 0.5;
    ctx.strokeStyle = '#2e170c';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.85, 0);
    ctx.quadraticCurveTo(0, -s * 0.4, s * 0.85, 0);
    ctx.lineWidth = lw * 0.5;
    ctx.stroke();
    ctx.restore();
  }

  function lavenderSprig(ctx, x, y, s, lw, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.beginPath();
    ctx.moveTo(0, s * 0.3);
    ctx.lineTo(0, -s * 1.1);
    ctx.lineWidth = lw * 0.6;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#5f9a4a';
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const yy = -s * 0.2 - i * s * 0.19;
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(sd * s * 0.12, yy, s * 0.12, s * 0.08, sd * 0.5, 0, TAU);
        ctx.fillStyle = i % 2 ? '#b48ae6' : '#9a6fd6';
        ctx.fill();
      }
    }
    ctx.beginPath();
    ctx.ellipse(0, -s * 1.25, s * 0.1, s * 0.13, 0, 0, TAU);
    ctx.fillStyle = '#c9a5f2';
    ctx.fill();
    ctx.restore();
  }

  function bubbles(ctx, rng, n, cx, cy, rx, ry, col, size) {
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU, rr = Math.sqrt(rng());
      const x = cx + Math.cos(a) * rx * rr, y = cy + Math.sin(a) * ry * rr;
      const r = size * (0.5 + rng() * 0.9);
      circle(ctx, x, y, r);
      ctx.fillStyle = rgba(col, 0.55);
      ctx.fill();
      ctx.lineWidth = r * 0.25;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.stroke();
      circle(ctx, x - r * 0.35, y - r * 0.35, r * 0.25);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }

  function gem(ctx, x, y, s, lw, col, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.2);
    ctx.lineTo(s * 0.55, -s * 0.35);
    ctx.lineTo(s * 0.4, s * 0.6);
    ctx.lineTo(-s * 0.4, s * 0.6);
    ctx.lineTo(-s * 0.55, -s * 0.35);
    ctx.closePath();
    const g = ctx.createLinearGradient(-s, -s, s, s);
    g.addColorStop(0, shade(col, 0.6));
    g.addColorStop(0.5, col);
    g.addColorStop(1, shade(col, -0.3));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw * 0.5;
    ctx.strokeStyle = shade(col, -0.45);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.2); ctx.lineTo(-s * 0.15, s * 0.6);
    ctx.moveTo(0, -s * 1.2); ctx.lineTo(s * 0.25, s * 0.6);
    ctx.lineWidth = lw * 0.3;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.stroke();
    ctx.restore();
  }

  function snowflake(ctx, x, y, s, lw, col) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineCap = 'round';
    ctx.strokeStyle = col || '#ffffff';
    ctx.lineWidth = lw * 0.6;
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate((i / 6) * TAU);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, -s);
      ctx.moveTo(0, -s * 0.55); ctx.lineTo(-s * 0.25, -s * 0.75);
      ctx.moveTo(0, -s * 0.55); ctx.lineTo(s * 0.25, -s * 0.75);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function coconutFlakes(ctx, rng, n, cx, cy, rx, ry, size) {
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU, rr = Math.sqrt(rng());
      const x = cx + Math.cos(a) * rx * rr, y = cy + Math.sin(a) * ry * rr;
      const rot = rng() * TAU;
      ctx.beginPath();
      ctx.arc(x, y, size * (0.6 + rng() * 0.6), rot, rot + 1.6);
      ctx.lineWidth = size * 0.45;
      ctx.strokeStyle = i % 3 ? '#ffffff' : '#f3e9d8';
      ctx.stroke();
    }
  }

  function goldFlake(ctx, x, y, s, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.beginPath();
    ctx.moveTo(-s, -s * 0.3); ctx.lineTo(s * 0.2, -s * 0.8); ctx.lineTo(s, s * 0.1); ctx.lineTo(-s * 0.3, s * 0.7);
    ctx.closePath();
    const g = ctx.createLinearGradient(-s, -s, s, s);
    g.addColorStop(0, '#fff2b0');
    g.addColorStop(0.5, '#f2c43a');
    g.addColorStop(1, '#c48a18');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  function rose(ctx, x, y, s, lw, col) {
    const c = col || '#ff7fae';
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.85);
    for (let i = 5; i >= 1; i--) {
      const r = s * (0.3 + i * 0.16);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      g.addColorStop(0, shade(c, 0.5));
      g.addColorStop(1, shade(c, -0.1 * (6 - i)));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = lw * 0.5;
      ctx.strokeStyle = shade(c, -0.45);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, 0);
    ctx.bezierCurveTo(-s * 0.3, -s * 0.45, s * 0.35, -s * 0.4, s * 0.3, 0);
    ctx.bezierCurveTo(s * 0.35, s * 0.4, -s * 0.3, s * 0.4, -s * 0.3, 0);
    ctx.lineWidth = lw * 0.45;
    ctx.stroke();
    ctx.restore();
  }

  function petals(ctx, rng, n, cx, cy, rx, ry, col, size) {
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU, rr = Math.sqrt(rng());
      const x = cx + Math.cos(a) * rx * rr, y = cy + Math.sin(a) * ry * rr;
      ctx.beginPath();
      ctx.ellipse(x, y, size, size * 0.6, rng() * Math.PI, 0, TAU);
      ctx.fillStyle = i % 2 ? col : shade(col, 0.35);
      ctx.fill();
    }
  }

  function passionFruit(ctx, x, y, s, lw) {
    ctx.save();
    circle(ctx, x, y, s);
    ctx.fillStyle = '#7a3a6a';
    ctx.fill();
    ctx.lineWidth = lw * 0.6;
    ctx.strokeStyle = '#4a2040';
    ctx.stroke();
    circle(ctx, x, y, s * 0.78);
    ctx.fillStyle = '#ffb94a';
    ctx.fill();
    ctx.fillStyle = '#3a2a18';
    for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; circle(ctx, x + Math.cos(a) * s * 0.4, y + Math.sin(a) * s * 0.4, s * 0.1); ctx.fill(); }
    ctx.restore();
  }

  function unicornHorn(ctx, x, y, s, lw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(-s * 0.32, 0);
    ctx.lineTo(0, -s * 1.5);
    ctx.lineTo(s * 0.32, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(-s * 0.3, 0, s * 0.3, 0);
    g.addColorStop(0, '#fff3b0');
    g.addColorStop(0.5, '#ffd34d');
    g.addColorStop(1, '#d99a1a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw * 0.6;
    ctx.strokeStyle = '#a66d12';
    ctx.stroke();
    ctx.beginPath();
    for (const k of [0.25, 0.55, 0.85, 1.15]) {
      const w = (1 - k / 1.5) * s * 0.32;
      ctx.moveTo(-w, -k * s + s * 0.08);
      ctx.lineTo(w, -k * s - s * 0.08);
    }
    ctx.lineWidth = lw * 0.4;
    ctx.stroke();
    ctx.restore();
  }

  function flame(ctx, x, y, s, lw) {
    ctx.save();
    ctx.translate(x, y);
    const fl = (k, a, b) => {
      ctx.beginPath();
      ctx.moveTo(0, s * 0.4 * k);
      ctx.bezierCurveTo(-s * 0.6 * k, s * 0.1 * k, -s * 0.5 * k, -s * 0.6 * k, 0, -s * 1.1 * k);
      ctx.bezierCurveTo(s * 0.5 * k, -s * 0.5 * k, s * 0.6 * k, s * 0.15 * k, 0, s * 0.4 * k);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -s * k, 0, s * 0.4 * k);
      g.addColorStop(0, a);
      g.addColorStop(1, b);
      ctx.fillStyle = g;
      ctx.fill();
    };
    fl(1, '#ff7a2a', '#d8302a');
    ctx.lineWidth = lw * 0.6;
    ctx.strokeStyle = '#9a1c1c';
    ctx.stroke();
    fl(0.62, '#fff2a0', '#ffb43a');
    ctx.restore();
  }

  function egg(ctx, x, y, s, lw, cols) {
    const c = cols || { a: '#d9f3f0', b: '#5fb8b0', line: '#2e7a78', dot: '#2e7a78' };
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.1);
    ctx.bezierCurveTo(s * 0.85, -s * 1.1, s * 0.85, s * 0.9, 0, s * 0.9);
    ctx.bezierCurveTo(-s * 0.85, s * 0.9, -s * 0.85, -s * 1.1, 0, -s * 1.1);
    ctx.closePath();
    const g = ctx.createRadialGradient(-s * 0.3, -s * 0.4, s * 0.1, 0, 0, s * 1.2);
    g.addColorStop(0, c.a);
    g.addColorStop(1, c.b);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = lw * 0.7;
    ctx.strokeStyle = c.line;
    ctx.stroke();
    ctx.fillStyle = rgba(c.dot, 0.5);
    for (const d of [[-0.35, -0.5, 0.1], [0.25, -0.2, 0.13], [-0.2, 0.3, 0.1], [0.4, 0.45, 0.08], [0.05, -0.75, 0.07]]) { circle(ctx, d[0] * s, d[1] * s, d[2] * s); ctx.fill(); }
    ctx.beginPath();
    ctx.ellipse(-s * 0.35, -s * 0.5, s * 0.18, s * 0.1, -1, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();
    ctx.restore();
  }

  function seashell(ctx, x, y, s, lw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, s * 0.5);
    ctx.lineTo(s * 0.3, s * 0.5);
    ctx.bezierCurveTo(s * 1.2, s * 0.1, s * 0.9, -s * 1.0, 0, -s * 0.95);
    ctx.bezierCurveTo(-s * 0.9, -s * 1.0, -s * 1.2, s * 0.1, -s * 0.3, s * 0.5);
    ctx.closePath();
    const g = ctx.createLinearGradient(-s, -s, s, s);
    g.addColorStop(0, '#fff1f4');
    g.addColorStop(1, '#ffb3cf');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = lw * 0.6;
    ctx.strokeStyle = '#c96a92';
    ctx.stroke();
    ctx.beginPath();
    for (const k of [-0.6, -0.2, 0.2, 0.6]) { ctx.moveTo(0, s * 0.45); ctx.lineTo(k * s * 1.2, -s * 0.75); }
    ctx.lineWidth = lw * 0.4;
    ctx.stroke();
    ctx.restore();
  }

  function tinyTree(ctx, x, y, s, lw) {
    ctx.save();
    ctx.translate(x, y);
    FC.roundRect(ctx, -s * 0.14, -s * 0.2, s * 0.28, s * 0.75, s * 0.08);
    ctx.fillStyle = '#8a5a34';
    ctx.fill();
    ctx.lineWidth = lw * 0.5;
    ctx.strokeStyle = '#4a2e18';
    ctx.stroke();
    for (const p of [[-0.4, -0.3, 0.42], [0.42, -0.35, 0.4], [0, -0.75, 0.5], [0, -0.3, 0.45]]) {
      circle(ctx, p[0] * s, p[1] * s, p[2] * s);
      const g = ctx.createRadialGradient(p[0] * s - p[2] * s * 0.3, p[1] * s - p[2] * s * 0.3, s * 0.05, p[0] * s, p[1] * s, p[2] * s);
      g.addColorStop(0, '#b8ec8a');
      g.addColorStop(1, '#4e9c45');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = '#2f6b2c';
      ctx.stroke();
    }
    ctx.fillStyle = '#ff6f9a';
    for (const d of [[-0.45, -0.25], [0.3, -0.6], [0.5, -0.15], [-0.05, -0.95]]) { circle(ctx, d[0] * s, d[1] * s, s * 0.07); ctx.fill(); }
    ctx.restore();
  }

  function shootingStar(ctx, x, y, s, lw) {
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x + s * 0.3, y + (i - 1) * s * 0.3);
      ctx.quadraticCurveTo(x + s * 1.3, y + (i - 1) * s * 0.5 - s * 0.2, x + s * 2.0, y + (i - 1) * s * 0.55 - s * 0.6);
      ctx.lineWidth = lw * (1.2 - i * 0.3);
      ctx.strokeStyle = ['rgba(255,240,170,0.9)', 'rgba(255,255,255,0.75)', 'rgba(255,220,240,0.7)'][i];
      ctx.stroke();
    }
    ctx.restore();
    goldStar(ctx, x, y, s, lw);
  }

  function clover(ctx, x, y, s, lw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(s * 0.2, s * 0.7, s * 0.45, s * 1.05);
    ctx.lineWidth = lw * 0.7;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2f7a3a';
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i / 4) * TAU + Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-s * 0.5, -s * 0.9, s * 0.0, -s * 1.15, s * 0.05, -s * 0.55);
      ctx.bezierCurveTo(s * 0.1, -s * 1.15, s * 0.6, -s * 0.9, 0, 0);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -s, 0, 0);
      g.addColorStop(0, '#9fe07a');
      g.addColorStop(1, '#3f9a45');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = lw * 0.5;
      ctx.strokeStyle = '#2f7a3a';
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function candle(ctx, x, y, s, lw) {
    ctx.save();
    ctx.translate(x, y);
    FC.roundRect(ctx, -s * 0.22, -s * 0.9, s * 0.44, s * 1.3, s * 0.1);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = '#ff8fb4';
    ctx.lineWidth = s * 0.12;
    for (let yy = -s * 1.1; yy < s * 0.6; yy += s * 0.3) { ctx.beginPath(); ctx.moveTo(-s * 0.4, yy + s * 0.3); ctx.lineTo(s * 0.4, yy); ctx.stroke(); }
    ctx.restore();
    ctx.lineWidth = lw * 0.6;
    ctx.strokeStyle = '#c4588f';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.9); ctx.lineTo(0, -s * 1.15);
    ctx.strokeStyle = '#5a3a2a';
    ctx.stroke();
    flame(ctx, 0, -s * 1.45, s * 0.3, lw);
    ctx.restore();
  }

  function ghostlet(ctx, x, y, s, lw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, -s * 0.3, s * 0.7, Math.PI, TAU);
    ctx.lineTo(s * 0.7, s * 0.6);
    for (let i = 3; i >= -3; i--) ctx.quadraticCurveTo(i * s * 0.2 - s * 0.1, s * 0.9 - (Math.abs(i) % 2) * s * 0.25, i * s * 0.2 - s * 0.2, s * 0.6 + (Math.abs(i) % 2) * s * 0.25);
    ctx.lineTo(-s * 0.7, -s * 0.3);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw * 0.6;
    ctx.strokeStyle = '#9a8ad0';
    ctx.stroke();
    ctx.fillStyle = '#3a2a50';
    circle(ctx, -s * 0.25, -s * 0.3, s * 0.1); ctx.fill();
    circle(ctx, s * 0.25, -s * 0.3, s * 0.1); ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, s * 0.02, s * 0.12, s * 0.16, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // a glimmer of gold sparkles over the whole cake (golden / stardust)
  function shimmer(ctx, rng, n, cx, cy, rx, ry, cols) {
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU, rr = Math.sqrt(rng());
      const x = cx + Math.cos(a) * rx * rr, y = cy + Math.sin(a) * ry * rr;
      FC.sparklePath(ctx, x, y, 0.04 + rng() * 0.07, 0.3);
      ctx.fillStyle = cols[i % cols.length];
      ctx.fill();
    }
  }

  // full classic drum cake (side + frosting + outline); returns frosting info
  function drumCake(ctx, d, s, lw, seed, o) {
    o = o || {};
    const rng = FC.rng(seed);
    const bands = o.bands || (s.band ? [[d.botY - 0.22 * d.rx, 0.075 * d.rx, s.band, 0.006]] : null);
    paintDrumSide(ctx, d, o.sponge || s.sponge, s.outline, rng, { pores: o.pores == null ? (s.pores || 60) : o.pores, bands, stripes: o.stripes, stripeLine: o.stripeLine, scales: o.scales });
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
  // style painters (unit space). s = the kind spec
  // ------------------------------------------------------------------
  const STYLE = {};
  const seedOf = (s) => { let h = 7; for (let i = 0; i < s.id.length; i++) h = (h * 31 + s.id.charCodeAt(i)) >>> 0; return h; };

  STYLE.classic = function (ctx, s, lw) {
    const seed = seedOf(s);
    const fr = drumCake(ctx, DRUM, s, lw, seed, {
      dripDeep: s.dripDeep || (s.dark ? 1.15 : 1), dots: s.dots, dotScale: s.dotScale, dotSeed: seed, drizzle: s.drizzle, sweep: s.sweep, sweepSoft: s.sweepSoft, sweepTop: s.sweepTop,
      sweepLine: s.sweepLine, scales: s.scales, stripes: s.sideStripes, stripeLine: s.stripeLine, pores: s.pores, tongues: s.scallop ? scallopDrips(s.scallop, 0.09, 0.16) : null,
    });
    const rng = FC.rng(seed + 11);
    const tY = DRUM.topY;
    const ring = (n, col, k) => rosetteRing(ctx, DRUM, n || 10, 0.1, col || s.rosette || '#ffffff', lw, k || 0.84);
    switch (s.topping) {
      case 'cherry':
        creamSwirl(ctx, 0, tY + 0.02, 0.32, '#ffffff', lw);
        cherry(ctx, 0.03, tY - 0.42, 0.24, lw);
        break;
      case 'flower':
        ring(9, s.rosette, 0.82);
        mintLeaf(ctx, 0.1, tY - 0.06, 0.38, 0.35, lw);
        mintLeaf(ctx, -0.12, tY - 0.04, 0.34, Math.PI - 0.5, lw);
        flower(ctx, 0, tY - 0.1, 0.38, s.accent, '#ffd03d', lw, 0.2);
        break;
      case 'sprinkles':
        sprinkles(ctx, rng, 30, 0, tY, 0.7, 0.3, ['#ff8fc4', '#8fe3ff', '#ffe27a', '#a7ebc8', '#ffffff', '#c9a6ff'], 0.055);
        ring(10, s.rosette);
        chocoCurls(ctx, 0, tY - 0.04, 0.42, lw);
        creamSwirl(ctx, 0.0, tY - 0.12, 0.17, '#fbe8d4', lw);
        break;
      case 'peach':
        ring(10, s.rosette);
        peachHalves(ctx, 0, tY - 0.06, 0.5, lw);
        break;
      case 'blueberries':
        ring(10, s.rosette);
        blueberries(ctx, 0, tY - 0.1, 0.42, lw);
        break;
      case 'honey':
        honeycomb(ctx, -0.22, tY - 0.1, 0.17, lw);
        creamSwirl(ctx, 0.38, tY + 0.02, 0.2, '#fff8e6', lw);
        bee(ctx, 0.3, tY - 0.42, 0.14, lw);
        break;
      case 'toadstool':
        ring(10, s.rosette);
        toadstool(ctx, 0.22, tY - 0.2, 0.3, lw);
        toadstool(ctx, -0.3, tY - 0.02, 0.2, lw);
        break;
      case 'gingerbread':
        ring(11, s.rosette, 0.86);
        gingerMan(ctx, 0.02, tY - 0.22, 0.34, lw);
        for (const d of [[-0.55, -0.02, '#ff5f7a'], [0.55, -0.04, '#5fc8ff'], [-0.35, 0.18, '#ffd34d'], [0.4, 0.2, '#9be59a']]) glossBall(ctx, d[0], tY + d[1], 0.07, '#ffffff', d[2], shade(d[2], -0.3), shade(d[2], -0.45), lw, 0.5);
        break;
      case 'maple':
        ring(10, s.rosette);
        pecan(ctx, -0.45, tY + 0.04, 0.16, lw, -0.5);
        pecan(ctx, 0.42, tY + 0.08, 0.15, lw, 0.4);
        pecan(ctx, 0.1, tY + 0.2, 0.14, lw, 0.1);
        mapleLeaf(ctx, -0.02, tY - 0.22, 0.38, lw, 0.15);
        break;
      case 'bramble':
        ring(10, s.rosette);
        mintLeaf(ctx, 0.05, tY - 0.3, 0.36, -0.9, lw);
        bramble(ctx, -0.36, tY - 0.02, 0.19, lw, '#8a6fe0', '#4a2f8a', '#2a1a5a', '#1c1040');
        bramble(ctx, 0.36, tY - 0.06, 0.18, lw, '#ff9ab0', '#e0405f', '#9a1e3f', '#6e1030');
        bramble(ctx, 0.02, tY + 0.14, 0.17, lw, '#8a6fe0', '#4a2f8a', '#2a1a5a', '#1c1040');
        break;
      case 'mocha':
        creamSwirl(ctx, 0, tY + 0.02, 0.32, '#fff7ec', lw);
        coffeeBean(ctx, 0.02, tY - 0.44, 0.17, lw, -0.5);
        break;
      case 'lavender':
        ring(10, s.rosette);
        lavenderSprig(ctx, -0.25, tY + 0.1, 0.36, lw, -0.5);
        lavenderSprig(ctx, 0.22, tY + 0.12, 0.38, lw, 0.45);
        lavenderSprig(ctx, 0.0, tY + 0.05, 0.42, lw, 0.0);
        break;
      case 'potion':
        bubbles(ctx, rng, 9, 0, tY - 0.02, 0.72, 0.3, '#9ff7c8', 0.09);
        starDust(ctx, rng, 5, 0, tY, 0.6, 0.28, ['#fff6a8', '#ffffff'], 0.05);
        break;
      case 'tiramisu':
        for (let i = 0; i < 80; i++) { const a = rng() * TAU, rr = Math.sqrt(rng()); circle(ctx, Math.cos(a) * 0.88 * rr, tY + Math.sin(a) * 0.38 * rr, 0.012 + rng() * 0.012); ctx.fillStyle = 'rgba(80,45,30,0.55)'; ctx.fill(); }
        ring(10, '#fff6ea');
        coffeeBean(ctx, -0.2, tY - 0.08, 0.16, lw, -0.6);
        coffeeBean(ctx, 0.22, tY - 0.02, 0.16, lw, 0.5);
        creamSwirl(ctx, 0.0, tY - 0.2, 0.2, '#fff6ea', lw);
        break;
      case 'sapphire':
        ring(10, s.rosette);
        gem(ctx, -0.42, tY - 0.1, 0.17, lw, '#5fa8ff', -0.3);
        gem(ctx, 0.4, tY - 0.06, 0.15, lw, '#8fd0ff', 0.4);
        blueberries(ctx, 0.02, tY - 0.08, 0.36, lw);
        break;
      case 'sunrise':
        creamSwirl(ctx, -0.22, tY + 0.04, 0.26, '#fff7ec', lw);
        citrusSlice(ctx, 0.3, tY - 0.22, 0.3, lw, ORANGE);
        break;
      case 'coconut':
        coconutFlakes(ctx, rng, 46, 0, tY, 0.85, 0.36, 0.05);
        ring(10, s.rosette);
        snowflake(ctx, 0, tY - 0.22, 0.3, lw, '#bfe6ff');
        snowflake(ctx, -0.5, tY + 0.1, 0.14, lw, '#dff2ff');
        snowflake(ctx, 0.52, tY + 0.06, 0.12, lw, '#dff2ff');
        break;
      case 'opera':
        goldFlake(ctx, -0.25, tY - 0.1, 0.14, -0.3);
        goldFlake(ctx, 0.3, tY + 0.02, 0.11, 0.6);
        goldFlake(ctx, 0.05, tY + 0.18, 0.09, 1.3);
        coffeeBean(ctx, 0.0, tY - 0.3, 0.13, lw, 0.3);
        ring(10, '#f6dcb8', 0.86);
        break;
      case 'rose':
        petals(ctx, rng, 10, 0, tY, 0.75, 0.3, '#ff9ec2', 0.07);
        ring(10, s.rosette);
        rose(ctx, 0, tY - 0.16, 0.36, lw, '#ff7fae');
        rose(ctx, -0.5, tY + 0.06, 0.18, lw, '#ffb3cf');
        rose(ctx, 0.5, tY + 0.08, 0.17, lw, '#ffb3cf');
        break;
      case 'pavlova':
        ring(9, '#ffffff', 0.86);
        creamSwirl(ctx, -0.3, tY - 0.02, 0.26, '#ffffff', lw);
        creamSwirl(ctx, 0.3, tY + 0.02, 0.24, '#ffffff', lw);
        citrusSlice(ctx, -0.02, tY - 0.3, 0.24, lw, KIWI);
        passionFruit(ctx, 0.28, tY - 0.32, 0.15, lw);
        break;
      case 'dragonfruit':
        creamSwirl(ctx, 0, tY + 0.02, 0.3, '#ffffff', lw);
        goldStar(ctx, 0.04, tY - 0.42, 0.2, lw);
        break;
      case 'sugarplum':
        ring(10, s.rosette);
        mintLeaf(ctx, 0.1, tY - 0.32, 0.36, -1.0, lw);
        glossBall(ctx, -0.36, tY - 0.02, 0.24, '#e6b8ff', '#9a4fd6', '#5a2a8a', '#3e1a62', lw);
        glossBall(ctx, 0.34, tY - 0.06, 0.22, '#e6b8ff', '#9a4fd6', '#5a2a8a', '#3e1a62', lw);
        glossBall(ctx, 0.0, tY + 0.16, 0.2, '#ffc6e0', '#e05fa0', '#9a2a6a', '#6a1848', lw);
        break;
      case 'dragonegg':
        ring(10, s.rosette);
        egg(ctx, 0.0, tY - 0.3, 0.36, lw);
        break;
      case 'aurora':
        starDust(ctx, rng, 8, 0, tY, 0.7, 0.3, ['#ffffff', '#fff6a8', '#d6f6ff'], 0.05);
        snowflake(ctx, -0.45, tY - 0.02, 0.16, lw, '#ffffff');
        snowflake(ctx, 0.4, tY + 0.04, 0.14, lw, '#ffffff');
        ring(10, s.rosette);
        break;
      case 'mermaid':
        ring(10, s.rosette);
        for (const p of [[-0.5, 0.06], [-0.2, 0.2], [0.18, 0.22], [0.5, 0.08]]) glossBall(ctx, p[0], tY + p[1], 0.09, '#ffffff', '#f6e9ff', '#c9b0e0', '#9a80b8', lw, 0.4);
        seashell(ctx, 0.02, tY - 0.3, 0.3, lw);
        break;
      case 'clover':
        sprinkles(ctx, rng, 12, 0, tY, 0.65, 0.28, ['#ffffff', '#ffe27a', '#9fe07a'], 0.045);
        clover(ctx, 0.0, tY - 0.36, 0.26, lw);
        break;
      case 'birthday':
        sprinkles(ctx, rng, 22, 0, tY, 0.7, 0.3, ['#ff8fc4', '#8fe3ff', '#ffe27a', '#a7ebc8', '#c9a6ff'], 0.05);
        creamSwirl(ctx, -0.3, tY + 0.04, 0.2, '#ffffff', lw);
        candle(ctx, 0.2, tY - 0.1, 0.28, lw);
        break;
    }
    if (s.shine) shimmer(ctx, rng, 14, 0, tY - 0.2, 1.0, 0.7, ['#ffffff', '#fff3a0', '#ffe27a']);
    return fr;
  };

  STYLE.cupcake = function (ctx, s, lw) {
    const W = s.wrapper;
    const tY = 0.12, tRx = 0.9, tRy = 0.34;
    const bY = 0.62, bRx = 0.7, bRy = 0.27;
    const seed = seedOf(s);
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
    const p = (u, rx, yc, ry) => [u * rx, yc + ry * Math.sqrt(Math.max(0, 1 - u * u))];
    for (let i = 0; i < n; i += 2) {
      const u0 = -1 + (2 * i) / n, u1 = -1 + (2 * (i + 1)) / n;
      const a = p(u0, tRx, tY, tRy), b = p(u1, tRx, tY, tRy), c = p(u1, bRx, bY, bRy), d = p(u0, bRx, bY, bRy);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1] - 0.2);
      ctx.lineTo(b[0], b[1] - 0.2);
      ctx.lineTo(c[0], c[1] + 0.05);
      ctx.lineTo(d[0], d[1] + 0.05);
      ctx.closePath();
      ctx.fillStyle = rgba(s.wrapperStripe || '#ffffff', 0.3);
      ctx.fill();
    }
    if (s.wrapperDots) {
      ctx.fillStyle = s.wrapperDots;
      for (let i = 0; i < 9; i++) {
        const u = -0.85 + (1.7 * i) / 8;
        for (let k = 0; k < 2; k++) {
          const q = p(u, FC.lerp(tRx, bRx, 0.3 + k * 0.4), FC.lerp(tY, bY, 0.3 + k * 0.4), FC.lerp(tRy, bRy, 0.3 + k * 0.4));
          ctx.beginPath();
          ctx.ellipse(q[0] + (k ? 0.06 : 0), q[1] + 0.01, 0.05 * Math.sqrt(1 - u * u) + 0.015, 0.045, 0, 0, TAU);
          ctx.fill();
        }
      }
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
    // frosting swirl: stacked piped rings (two-tone when frost2 is set)
    const F = s.frost, F2 = s.frost2;
    const rings = [[0.02, 0.98, 0.4], [-0.3, 0.78, 0.33], [-0.57, 0.55, 0.26], [-0.78, 0.32, 0.18]];
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      const col = F2 && i % 2 ? F2 : F;
      ctx.beginPath();
      ctx.ellipse(0, r[0], r[1], r[2], 0, 0, TAU);
      const g = ctx.createLinearGradient(-r[1], r[0] - r[2], r[1] * 0.4, r[0] + r[2]);
      g.addColorStop(0, shade(col, 0.55));
      g.addColorStop(0.45, col);
      g.addColorStop(1, shade(col, -0.22));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = lw * 0.9;
      ctx.strokeStyle = s.outline;
      ctx.stroke();
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, r[0], r[1], r[2], 0, 0, TAU);
      ctx.clip();
      ctx.lineWidth = lw * 0.5;
      ctx.strokeStyle = rgba(shade(col, -0.3), 0.55);
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
    const rng = FC.rng(seed);
    if (s.sprinkles) sprinkles(ctx, rng, 10, 0, -0.3, 0.6, 0.35, s.sprinkles, 0.045);
    if (s.stars) starDust(ctx, rng, 9, 0, -0.3, 0.62, 0.38, s.stars, 0.055);
    if (s.chips) chocoChips(ctx, rng, 9, 0, -0.3, 0.6, 0.36, 0.05);
    switch (s.topper) {
      case 'strawberry': strawberry(ctx, 0.02, -0.98, 0.27, lw); break;
      case 'cherry': cherry(ctx, 0.02, -0.92, 0.2, lw); break;
      case 'star': goldStar(ctx, 0.02, -1.02, 0.24, lw); break;
      case 'mint': mintLeaf(ctx, -0.02, -0.92, 0.36, -1.9, lw); mintLeaf(ctx, 0.04, -0.9, 0.34, -0.9, lw); chocoChips(ctx, rng, 2, 0.1, -0.75, 0.12, 0.08, 0.06); break;
      case 'tuft':
        for (const q of [[-0.22, -0.95, 0.22, '#ffc2df'], [0.2, -1.0, 0.24, '#bfe3ff'], [0.0, -1.18, 0.2, '#ffd6ea'], [-0.05, -0.8, 0.18, '#d7ecff']]) {
          circle(ctx, q[0], q[1], q[2]);
          const g = ctx.createRadialGradient(q[0] - q[2] * 0.3, q[1] - q[2] * 0.3, q[2] * 0.1, q[0], q[1], q[2]);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(1, q[3]);
          ctx.fillStyle = g;
          ctx.fill();
          ctx.lineWidth = lw * 0.4;
          ctx.strokeStyle = 'rgba(200,120,170,0.5)';
          ctx.stroke();
        }
        break;
      case 'horn': unicornHorn(ctx, 0.0, -0.9, 0.3, lw); break;
      case 'ghost': ghostlet(ctx, 0.3, -0.95, 0.26, lw); break;
      case 'moon': crescent(ctx, 0.04, -1.0, 0.22, lw); break;
    }
    if (s.shine) shimmer(ctx, rng, 10, 0, -0.3, 0.9, 0.9, ['#ffffff', '#fff3a0', '#ffe27a']);
  };

  STYLE.macaron = function (ctx, s, lw) {
    const sh = s.shell;
    const rng = FC.rng(seedOf(s));
    const bot = { rx: 0.97, ry: 0.4, topY: 0.2, botY: 0.5, bulge: 0.03 };
    paintDrumSide(ctx, bot, shade(sh, -0.04), s.outline, rng, { pores: 0 });
    drumOutlinePath(ctx, bot);
    ctx.lineWidth = lw;
    ctx.strokeStyle = s.outline;
    ctx.stroke();
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
    const fill = { rx: 0.9, ry: 0.38, topY: 0.04, botY: 0.22, bulge: 0.03 };
    ctx.save();
    drumSidePath(ctx, fill);
    ctx.fillStyle = cylGradient(ctx, -0.9, 0.9, s.filling, 0.6);
    ctx.fill();
    ctx.restore();
    sideBand(ctx, fill, 0.03, 0.035, 'rgba(255,255,255,0.8)', 0.008);
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
    switch (s.deco || 'heart') {
      case 'heart': heart(ctx, 0.0, -0.58, 0.17, s.accent, lw); break;
      case 'leaf': mintLeaf(ctx, -0.12, -0.6, 0.34, -0.35, lw); break;
      case 'star': goldStar(ctx, 0.0, -0.6, 0.18, lw, s.accent === 'silver' ? SILVER_STAR : null); break;
      case 'cloud': cloudPuff(ctx, 0.0, -0.6, 0.24, lw, 'rgba(120,150,210,0.5)'); break;
      case 'sparkle':
        goldStar(ctx, 0.0, -0.6, 0.16, lw);
        shimmer(ctx, rng, 12, 0, -0.25, 0.9, 0.5, ['#ffffff', '#fff3a0', '#ffe27a']);
        break;
      case 'moon': crescent(ctx, 0.0, -0.6, 0.18, lw); break;
    }
    const dots = s.deco === 'sparkle' ? [] : [[-0.45, -0.38], [0.48, -0.4], [0.28, -0.72], [-0.3, -0.7]];
    for (const p of dots) {
      circle(ctx, p[0], p[1], 0.04);
      ctx.fillStyle = s.dotCol || '#ffffff';
      ctx.fill();
    }
  };

  // a cake pop: a glazed ball on a stick (the rare Pixie Pop)
  STYLE.pop = function (ctx, s, lw) {
    const rng = FC.rng(seedOf(s));
    ctx.save();
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0.18, 0.55);
    ctx.lineTo(0.55, 1.02);
    ctx.lineWidth = 0.13;
    ctx.strokeStyle = '#c4588f';
    ctx.stroke();
    ctx.lineWidth = 0.08;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(0, 0, 1, 0.92, 0, 0, TAU);
    const g = ctx.createRadialGradient(-0.35, -0.4, 0.05, 0, 0, 1.1);
    g.addColorStop(0, shade(s.frost, 0.5));
    g.addColorStop(0.55, s.frost);
    g.addColorStop(1, shade(s.frost, -0.25));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = s.outline;
    ctx.stroke();
    // a drizzle of white glaze
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, 1, 0.92, 0, 0, TAU);
    ctx.clip();
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.07;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    for (const k of [-0.5, -0.15, 0.2, 0.55]) { ctx.beginPath(); ctx.moveTo(-1, k - 0.3); ctx.quadraticCurveTo(0, k + 0.1, 1, k - 0.25); ctx.stroke(); }
    ctx.restore();
    sprinkles(ctx, rng, 14, 0, -0.1, 0.8, 0.7, ['#ffffff', '#ffe27a', '#8fe3ff', '#c9a6ff', '#ff8fc4'], 0.05);
    ctx.beginPath();
    ctx.ellipse(-0.4, -0.45, 0.28, 0.13, -0.5, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fill();
    goldStar(ctx, 0.62, -0.62, 0.14, lw);
  };

  STYLE.tart = function (ctx, s, lw) {
    const d = { rx: 1, ry: 0.44, topY: 0.02, botY: 0.48, bulge: 0.02 };
    const rng = FC.rng(seedOf(s));
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
    // the filling
    ctx.beginPath();
    ctx.ellipse(0, d.topY + 0.01, d.rx * 0.84, d.ry * 0.8, 0, 0, TAU);
    const g = ctx.createRadialGradient(-0.25, d.topY - 0.14, 0.02, 0, d.topY, 0.9);
    g.addColorStop(0, shade(s.frost, 0.6));
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
    const kisses = (col, tip) => {
      const ks = [];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + 0.2;
        ks.push([Math.cos(a) * 0.6, d.topY + Math.sin(a) * 0.26]);
      }
      ks.sort((p, q) => p[1] - q[1]);
      for (const k of ks) rosette(ctx, k[0], k[1] - 0.04, 0.12, col, lw, tip);
    };
    switch (s.topping) {
      case 'lemon':
        kisses('#fff3e2', '#f0b46a');
        citrusSlice(ctx, -0.04, d.topY - 0.3, 0.3, lw);
        mintLeaf(ctx, 0.12, d.topY - 0.22, 0.3, -0.5, lw);
        break;
      case 'apple':
        crumble(ctx, rng, 60, 0, d.topY, 0.78, 0.32, 0.035);
        appleSlices(ctx, 0.0, d.topY - 0.12, 0.42, lw);
        mintLeaf(ctx, 0.28, d.topY - 0.3, 0.26, -0.7, lw);
        break;
      case 'moon':
        starDust(ctx, rng, 7, 0, d.topY, 0.7, 0.3, ['#ffffff', '#fff6a8'], 0.045);
        crescent(ctx, -0.02, d.topY - 0.28, 0.3, lw);
        break;
      case 'brulee':
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(0, d.topY + 0.01, d.rx * 0.84, d.ry * 0.8, 0, 0, TAU);
        ctx.clip();
        ctx.lineWidth = lw * 0.5;
        ctx.strokeStyle = 'rgba(120,60,10,0.55)';
        for (const l of [[-0.6, -0.2, -0.1, 0.1], [-0.1, 0.1, 0.4, -0.2], [0.1, -0.3, 0.6, 0.0], [-0.5, 0.2, -0.2, 0.3]]) { ctx.beginPath(); ctx.moveTo(l[0], d.topY + l[1] * 0.4); ctx.lineTo(l[2], d.topY + l[3] * 0.4); ctx.stroke(); }
        ctx.restore();
        bramble(ctx, 0.3, d.topY - 0.22, 0.13, lw, '#ff9ab0', '#e0405f', '#9a1e3f', '#6e1030');
        bramble(ctx, -0.32, d.topY - 0.18, 0.12, lw, '#ff9ab0', '#e0405f', '#9a1e3f', '#6e1030');
        mintLeaf(ctx, 0.0, d.topY - 0.3, 0.26, -1.2, lw);
        break;
      case 'flame':
        for (let i = 0; i < 12; i++) { const a = rng() * TAU, rr = Math.sqrt(rng()); circle(ctx, Math.cos(a) * 0.72 * rr, d.topY + Math.sin(a) * 0.3 * rr, 0.03 + rng() * 0.02); ctx.fillStyle = i % 2 ? '#ffd34d' : '#ff7a2a'; ctx.fill(); }
        flame(ctx, 0.0, d.topY - 0.35, 0.34, lw);
        break;
    }
  };

  STYLE.layered = function (ctx, s, lw) {
    const seed = seedOf(s);
    const rng = FC.rng(seed + 5);
    const fr = drumCake(ctx, DRUM, { sponge: s.sponge, frost: s.frost, outline: s.outline, dark: s.dark }, lw, seed,
      { stripes: s.stripes, stripeLine: s.stripeLine, pores: 50, tongues: scallopDrips(11, 0.08, 0.17), sweep: s.sweep, sweepSoft: s.sweepSoft, sweepTop: s.sweepTop, sweepAlpha: s.sweepAlpha, sweepLine: s.sweepLine });
    const tY = DRUM.topY;
    switch (s.top) {
      case 'rainbow': {
        ctx.save();
        ctx.lineCap = 'round';
        const cols = ['#ff9aa8', '#ffc98a', '#fff08a', '#9ee6a6', '#9ccfff', '#c5a8ff'];
        for (let i = 0; i < cols.length; i++) {
          ctx.beginPath();
          ctx.arc(0, tY + 0.05, 0.6 - i * 0.065, Math.PI * 1.08, Math.PI * 1.92);
          ctx.lineWidth = 0.075;
          ctx.strokeStyle = cols[i];
          ctx.stroke();
        }
        ctx.restore();
        cloudPuff(ctx, -0.58, tY + 0.06, 0.3, lw);
        cloudPuff(ctx, 0.58, tY + 0.06, 0.3, lw);
        rosetteRing(ctx, DRUM, 8, 0.09, '#ffffff', lw, 0.86, true);
        goldStar(ctx, 0, tY - 0.5, 0.28, lw);
        break;
      }
      case 'cherries':
        rosetteRing(ctx, DRUM, 9, 0.1, '#ffffff', lw, 0.86, true);
        chocoCurls(ctx, 0, tY + 0.02, 0.44, lw);
        creamSwirl(ctx, -0.32, tY - 0.1, 0.22, '#ffffff', lw);
        creamSwirl(ctx, 0.32, tY - 0.08, 0.22, '#ffffff', lw);
        cherry(ctx, -0.3, tY - 0.46, 0.17, lw);
        cherry(ctx, 0.3, tY - 0.44, 0.17, lw);
        cherry(ctx, 0.0, tY - 0.22, 0.18, lw);
        break;
      case 'galaxy':
        starDust(ctx, rng, 12, 0, tY, 0.75, 0.32, ['#ffffff', '#fff6a8', '#d6f6ff', '#ffc2f0'], 0.05);
        rosetteRing(ctx, DRUM, 8, 0.09, '#d9c7ff', lw, 0.86, true);
        goldStar(ctx, 0, tY - 0.42, 0.26, lw, SILVER_STAR);
        goldStar(ctx, -0.5, tY - 0.2, 0.12, lw);
        goldStar(ctx, 0.52, tY - 0.16, 0.1, lw);
        break;
      case 'crystal':
        rosetteRing(ctx, DRUM, 8, 0.09, '#ffffff', lw, 0.86, true);
        gem(ctx, -0.35, tY - 0.08, 0.2, lw, '#ff9ec2', -0.35);
        gem(ctx, 0.36, tY - 0.1, 0.19, lw, '#9fd4ff', 0.3);
        gem(ctx, 0.0, tY - 0.26, 0.28, lw, '#c9a6ff', 0.0);
        gem(ctx, -0.12, tY + 0.14, 0.13, lw, '#b8f0c8', 0.6);
        gem(ctx, 0.18, tY + 0.16, 0.12, lw, '#fff2a0', -0.6);
        break;
      case 'tree':
        petals(ctx, rng, 10, 0, tY, 0.75, 0.3, '#ffb3d9', 0.06);
        rosetteRing(ctx, DRUM, 8, 0.09, '#eaf6d6', lw, 0.86, true);
        tinyTree(ctx, 0.0, tY - 0.3, 0.42, lw);
        break;
    }
    if (s.shine) shimmer(ctx, rng, 14, 0, tY - 0.2, 1.0, 0.7, ['#ffffff', '#fff3a0', '#ffe27a']);
    return fr;
  };

  STYLE.tiered = function (ctx, s, lw) {
    const seed = seedOf(s);
    wing(ctx, -0.78, -0.55, 0.66, -1, lw, s.wingTint);
    wing(ctx, 0.78, -0.55, 0.66, 1, lw, s.wingTint);
    const base = drumCake(ctx, DRUM, { sponge: s.sponge, frost: s.frost, outline: s.outline, band: s.band, pores: 70, dark: s.dark }, lw, seed);
    pearlsOnEdge(ctx, base.edge, [-0.78, -0.42, 0.42, 0.78], 0.05, s.pearl || '#fff4fa', lw);
    rosetteRing(ctx, DRUM, 12, 0.085, s.rosette || '#ffffff', lw, 0.86, true);
    const up = scaleDrum(0.62, DRUM.topY + 0.02, 0.56);
    const top = drumCake(ctx, up, { sponge: s.topSponge, frost: s.topFrost, outline: s.outline, band: s.topBand, pores: 40, dark: s.dark }, lw, seed + 3, { dripDeep: 0.9 });
    pearlsOnEdge(ctx, top.edge, [-0.42, 0, 0.42], 0.045, s.pearl2 || '#ffd6ea', lw);
    rosetteRing(ctx, up, 8, 0.07, s.rosette2 || '#ffb7da', lw, 0.8);
    const ty = up.topY;
    const rng = FC.rng(seed + 9);
    switch (s.top) {
      case 'flowers':
        flower(ctx, 0, ty - 0.1, 0.25, '#ff86c0', s.accent, lw, 0.1);
        flower(ctx, -0.3, ty - 0.02, 0.14, '#ffffff', '#ffd75a', lw, 0.6);
        flower(ctx, 0.3, ty - 0.02, 0.14, '#ffffff', '#ffd75a', lw, -0.4);
        break;
      case 'acorn':
        mintLeaf(ctx, -0.08, ty - 0.02, 0.34, Math.PI - 0.4, lw, ['#f2c56a', '#d98a2a', '#8a4a14']);
        mintLeaf(ctx, 0.1, ty - 0.04, 0.32, 0.5, lw);
        acorn(ctx, 0.0, ty - 0.22, 0.22, lw);
        break;
      case 'moon':
        starDust(ctx, rng, 6, 0, ty, 0.5, 0.2, ['#ffffff', '#fff6a8'], 0.04);
        crescent(ctx, 0.0, ty - 0.2, 0.24, lw, { a: '#ffffff', b: '#dfe8ff', line: '#5a6cb0' });
        break;
      case 'star':
        starDust(ctx, rng, 6, 0, ty, 0.5, 0.2, ['#ffffff', '#fff6a8'], 0.04);
        goldStar(ctx, 0.0, ty - 0.24, 0.26, lw);
        break;
      case 'wish':
        shootingStar(ctx, -0.12, ty - 0.2, 0.2, lw);
        break;
    }
    if (s.shine) shimmer(ctx, rng, 16, 0, ty, 1.1, 0.8, ['#ffffff', '#fff3a0', '#ffe27a']);
  };

  STYLE.royal = function (ctx, s, lw) {
    const seed = seedOf(s);
    wing(ctx, -0.8, -0.75, 0.86, -1, lw, s.wingTint);
    wing(ctx, 0.8, -0.75, 0.86, 1, lw, s.wingTint);
    const base = drumCake(ctx, DRUM, { sponge: s.sponge, frost: s.frost, outline: s.outline, band: s.band, pores: 80, dark: s.dark }, lw, seed);
    pearlsOnEdge(ctx, base.edge, [-0.82, -0.56, -0.3, 0.3, 0.56, 0.82], 0.05, s.pearl || '#ffe066', lw);
    rosetteRing(ctx, DRUM, 12, 0.08, s.rosette || '#ffffff', lw, 0.87, true);
    const mid = scaleDrum(0.7, DRUM.topY + 0.02, 0.56);
    const m = drumCake(ctx, mid, { sponge: s.midSponge, frost: s.midFrost, outline: s.outline, band: s.midBand, pores: 50, dark: s.dark }, lw, seed + 1, { dripDeep: 0.9 });
    pearlsOnEdge(ctx, m.edge, [-0.5, -0.25, 0, 0.25, 0.5], 0.045, s.pearl || '#ffe066', lw);
    rosetteRing(ctx, mid, 10, 0.07, s.rosette2 || '#ffd3e6', lw, 0.84, true);
    const top = scaleDrum(0.46, mid.topY + 0.02, 0.4);
    drumCake(ctx, top, { sponge: s.topSponge, frost: s.topFrost, outline: s.outline, band: s.topBand, pores: 30, dark: s.dark }, lw, seed + 2, { dripDeep: 0.8 });
    crown(ctx, 0, top.topY - 0.18, s.crown === 'empress' ? 0.34 : 0.3, lw, s.crown);
    const fa = s.flowerA || '#ff9fd0', fb = s.flowerB || '#ffe066';
    if (s.crown === 'leaf') {
      glossBall(ctx, -0.5, mid.topY + 0.18, 0.08, '#ff9ab0', '#e0405f', '#9a1e3f', '#6e1030', lw, 0.5);
      glossBall(ctx, 0.5, mid.topY + 0.18, 0.08, '#ff9ab0', '#e0405f', '#9a1e3f', '#6e1030', lw, 0.5);
      mintLeaf(ctx, -0.58, mid.topY + 0.1, 0.22, -0.8, lw);
      mintLeaf(ctx, 0.5, mid.topY + 0.1, 0.22, -2.2, lw);
    } else if (s.crown === 'moon') {
      goldStar(ctx, -0.5, mid.topY + 0.18, 0.1, lw, SILVER_STAR);
      goldStar(ctx, 0.5, mid.topY + 0.18, 0.1, lw, SILVER_STAR);
    } else {
      flower(ctx, -0.5, mid.topY + 0.18, 0.12, fa, fb, lw, 0.3);
      flower(ctx, 0.5, mid.topY + 0.18, 0.12, fa, fb, lw, -0.3);
    }
    if (s.shine) shimmer(ctx, FC.rng(seed + 7), 18, 0, mid.topY, 1.2, 1.0, ['#ffffff', '#fff3a0', '#ffe27a']);
  };

  STYLE.joker = function (ctx, s, lw) {
    drumCake(ctx, DRUM, { sponge: s.sponge, frost: '#ffffff', outline: s.outline, band: '#ffb3e1', pores: 30 }, lw, 77, { sweep: ['#ff9cc0', '#ffc27e', '#fff07a', '#9ff0b0', '#8fd0ff', '#c6a2ff'], sweepSoft: ['#ffd1e3', '#ffe3c2', '#fff6c2', '#d2f7da', '#cfe9ff', '#e5d6ff', '#ffd1e3'], sweepLine: '#c6a2ff' });
    const rng = FC.rng(42);
    sprinkles(ctx, rng, 16, 0, DRUM.topY, 0.62, 0.26, ['#ffffff', '#fff3a0', '#ffd6f0', '#c9f3ff'], 0.05);
    goldStar(ctx, 0, DRUM.topY - 0.32, 0.34, lw);
  };

  // ------------------------------------------------------------------
  // The collection: every world has its own menu of eleven cakes (one per tier), a few
  // rare finds can turn up anywhere, and the Magic Cake is the joker. Each kind carries
  // its name, epithet, lore, ingredients, a hint for the level card while it is still
  // undiscovered, and the parameters of its style painter.
  // ------------------------------------------------------------------
  const KINDS = {};
  const KIND_LIST = [];
  function K(spec) {
    spec.style = spec.style || TIERS[spec.tier].style;
    if (!spec.particle) spec.particle = [spec.frost || spec.shell || '#ffffff', spec.sponge || spec.filling || '#fff4fb', spec.accent || spec.band || '#ffe27a', '#ffffff'];
    if (!spec.mouth) spec.mouth = 'smile';
    KINDS[spec.id] = spec;
    KIND_LIST.push(spec);
    return spec;
  }

  // ---------------- World 1 · Blossom Falls ----------------
  K({ id: 'w0t1', tier: 1, world: 0, name: 'Lilac Macaron', title: "Pixie's Heartspell",
    lore: 'The very first thing every fairy learns to bake: a crisp lilac shell, a heart of cream, and one tiny wish folded inside.',
    ingr: ['lilac sugar', 'almond dust', 'one folded wish'], hint: "Where every fairy's baking begins.",
    shell: '#c3acff', filling: '#fff4fb', outline: '#7a5fc2', accent: '#ff7fb3', deco: 'heart', particle: ['#c3acff', '#fff4fb', '#ff7fb3', '#e6dcff'] });
  K({ id: 'w0t2', tier: 2, world: 0, name: 'Cherry Bite', title: 'Cherryblossom Fairy Kiss',
    lore: 'A bite-sized sponge crowned with a single glossy cherry. Legend says the cherry always lands stem-up when nobody is looking.',
    ingr: ['sunny sponge', 'a glossy cherry', 'a swirl of cloud cream'], hint: 'Small, sweet, and wearing a red hat.',
    sponge: '#ffdca6', frost: '#fff7f0', outline: '#c0775f', band: '#ff8fae', topping: 'cherry', pores: 40, particle: ['#ffffff', '#ee3a55', '#ffdca6', '#ffb3c6'] });
  K({ id: 'w0t3', tier: 3, world: 0, name: 'Strawberry Cupcake', title: 'Cupcake Pixie',
    lore: "Tilly's favourite. The frosting is piped in a spiral so the strawberry on top has a comfy place to sit.",
    ingr: ['strawberry frosting', 'a sky-blue wrapper', 'rainbow sprinkles'], hint: 'A spiral of pink with a berry on top.',
    wrapper: '#8fd2f2', frost: '#ffadd0', outline: '#b9577c', topper: 'strawberry', sprinkles: ['#ffffff', '#ffe27a', '#8fe3ff', '#c9a6ff'], mouth: 'cat', particle: ['#ffadd0', '#8fd2f2', '#ffffff', '#f04a62'] });
  K({ id: 'w0t4', tier: 4, world: 0, name: 'Lemon Tart', title: 'Sunbeam Fairy Tart',
    lore: 'A fluted crust filled with sunshine curd. Seven meringue kisses stand guard around the lemon slice.',
    ingr: ['sunbeam curd', 'buttery crust', 'seven meringue kisses'], hint: 'Sour as sunshine, sweet as a kiss.',
    crust: '#efb35f', frost: '#ffe266', outline: '#b07033', topping: 'lemon', particle: ['#ffe266', '#fff6b8', '#8fd36f', '#efb35f'] });
  K({ id: 'w0t5', tier: 5, world: 0, name: 'Blossom Cake', title: 'Blossom Princess',
    lore: 'Minty frosting and one perfect blossom from the meadow by the falls. The petals never wilt – fairy magic, probably.',
    ingr: ['mint-cloud frosting', 'a meadow blossom', 'two mint leaves'], hint: 'A flower that never wilts.',
    sponge: '#fbe0c0', frost: '#a2eac6', outline: '#3f9273', topping: 'flower', accent: '#ff86c0', band: '#ffffff', rosette: '#ffffff', mouth: 'cat', pores: 70, particle: ['#a2eac6', '#ff86c0', '#ffffff', '#ffe27a'] });
  K({ id: 'w0t6', tier: 6, world: 0, name: 'Choco Cake', title: 'Chocolate Dream',
    lore: 'Dark, fudgy and dripping with ganache. The sprinkles are rumoured to be crushed rainbows.',
    ingr: ['river-deep ganache', 'chocolate curls', 'crushed rainbow sprinkles'], hint: 'Dark and dreamy, sprinkled with rainbows.',
    sponge: '#a4664b', frost: '#6a3a2f', outline: '#43231d', topping: 'sprinkles', band: '#f6dcc0', rosette: '#fbe8d4', dark: true, pores: 90, particle: ['#6a3a2f', '#ff8fc4', '#8fe3ff', '#ffe27a', '#a7ebc8'] });
  K({ id: 'w0t7', tier: 7, world: 0, name: 'Peach Cake', title: 'Peach Blossom Pixie',
    lore: 'Two peach halves on a cloud of cream, picked from the orchard on the far island at exactly the right morning.',
    ingr: ['orchard peaches', 'vanilla cloud', 'a dab of blossom honey'], hint: 'Picked on exactly the right morning.',
    sponge: '#fff0d8', frost: '#ffb98e', outline: '#c06640', topping: 'peach', band: '#ffd9b3', rosette: '#ffffff', pores: 90, particle: ['#ffb98e', '#ff9a5c', '#fff0d8', '#8fd36f'] });
  K({ id: 'w0t8', tier: 8, world: 0, name: 'Blueberry Cake', title: 'Blueberry Moon',
    lore: 'Lilac sponge, periwinkle frosting and a crown of blueberries. It tastes a little like a summer night.',
    ingr: ['lilac sponge', 'moon-washed blueberries', 'periwinkle frosting'], hint: 'Tastes like a summer night.',
    sponge: '#f6eaff', frost: '#a7bfff', outline: '#5160c0', topping: 'blueberries', band: '#ffffff', rosette: '#ffffff', mouth: 'cat', pores: 100, particle: ['#a7bfff', '#4c5bd4', '#ffffff', '#c9b8ff'] });
  K({ id: 'w0t9', tier: 9, world: 0, name: 'Rainbow Cake', title: 'Rainbow of the Seven Kingdoms',
    lore: 'Six bright layers under snow-white frosting, with a little rainbow arching between two clouds. Every fairy kingdom claims it invented it.',
    ingr: ['six coloured sponges', 'snow frosting', 'one small rainbow'], hint: 'Six layers, every one a different colour.',
    stripes: ['#ffb1bf', '#ffcf9a', '#fff19a', '#b5efb9', '#a6d5ff', '#cbb2ff'], sponge: '#fff7ee', frost: '#ffffff', outline: '#7f73c4', top: 'rainbow', particle: ['#ff9aa8', '#ffc98a', '#fff08a', '#9ee6a6', '#9ccfff', '#c5a8ff'] });
  K({ id: 'w0t10', tier: 10, world: 0, name: 'Fairy Torte', title: 'Torte of the Fairy Godmother',
    lore: 'Two tiers, pearls, blossoms and a pair of wings. It is said to flutter gently when it thinks nobody is watching.',
    ingr: ['two tiers of rose sponge', 'sugar pearls', 'a pair of wings'], hint: 'It has wings. Yes, really.',
    sponge: '#fff3f8', frost: '#ff9bcd', outline: '#bd4f8c', band: '#ffc4df', topSponge: '#ffd9ec', topFrost: '#fff6fb', topBand: '#ff9bcd', accent: '#ffe066', top: 'flowers', particle: ['#ff9bcd', '#ffffff', '#ffe066', '#ffd6ea'] });
  K({ id: 'w0t11', tier: 11, world: 0, name: 'Royal Fairycake', title: "The Fairy Queen's Royal Cake",
    lore: 'Three tiers, a golden crown and wings fit for a queen. Two of these meeting in the pond set off Fairy Magic.',
    ingr: ['three tiers of royal sponge', 'gold-dust pearls', 'a small golden crown'], hint: 'Crowned, winged and royal.',
    sponge: '#fff4e6', frost: '#ffcfe4', outline: '#b9628a', band: '#ffe08a', midSponge: '#ffe8f2', midFrost: '#ffffff', midBand: '#ffcfe4', topSponge: '#fff4e6', topFrost: '#ffc0dc', topBand: '#ffe9a8', crown: 'gold', particle: ['#ffd34d', '#ffcfe4', '#ffffff', '#ff9fd0', '#fff1a8'] });

  // ---------------- World 2 · Candy Woods ----------------
  K({ id: 'w1t1', tier: 1, world: 1, name: 'Pistachio Macaron', title: "The Emerald Elf's Secret",
    lore: 'A pale green shell with a leaf on top. The forest elves swear the filling is made from moonlit pistachios.',
    ingr: ['moonlit pistachios', 'green almond shell', 'a tiny leaf'], hint: "Green as a forest elf's hat.",
    shell: '#b6e39a', filling: '#fff9ec', outline: '#5f9a4a', accent: '#8fd36f', deco: 'leaf' });
  K({ id: 'w1t2', tier: 2, world: 1, name: 'Honey Bite', title: "The Honeybee Queen's Treasure",
    lore: 'A golden sponge glazed with honey from the Candy Woods hives. The bees drizzle it themselves, very carefully.',
    ingr: ['hive honey', 'golden sponge', 'a honeycomb chip'], hint: 'Drizzled by the bees themselves.',
    sponge: '#ffd98a', frost: '#fff0c8', outline: '#b8781e', band: '#ffc63a', drizzle: '#f4a81c', topping: 'honey', pores: 40, accent: '#f4a81c' });
  K({ id: 'w1t3', tier: 3, world: 1, name: 'Mint Choc Cupcake', title: "The Forest Fairy's Emerald Dream",
    lore: 'Cool mint frosting with chocolate chips, in a cocoa wrapper. Refreshing after a long flight through the woods.',
    ingr: ['cool mint frosting', 'chocolate chips', 'a cocoa wrapper'], hint: 'Cool, green and speckled with chocolate.',
    wrapper: '#8a5a3c', wrapperStripe: '#ffe9d6', frost: '#a9ecc8', outline: '#3f8a62', topper: 'mint', chips: true, mouth: 'cat', accent: '#4a2a1e' });
  K({ id: 'w1t4', tier: 4, world: 1, name: 'Apple Crumble Tart', title: 'The Golden Apple of the Enchanted Forest',
    lore: 'Buttery crumble over spiced apple slices, baked from the one tree in the woods that grows golden apples.',
    ingr: ['golden apples', 'buttery crumble', 'a pinch of cinnamon'], hint: 'Golden fruit under a buttery blanket.',
    crust: '#e8b36a', frost: '#f7d98c', outline: '#a86a2a', topping: 'apple', accent: '#d64f4a' });
  K({ id: 'w1t5', tier: 5, world: 1, name: 'Toadstool Cake', title: "The Pixie's Picnic Stool",
    lore: 'Scarlet frosting with white polka dots and a tiny toadstool on top. Entirely edible, unlike real toadstools. Pixies picnic on it.',
    ingr: ['scarlet frosting', 'white sugar dots', 'a wee toadstool'], hint: "Red with white dots – don't sit on it.",
    sponge: '#fbe8c8', frost: '#ee4747', outline: '#8a1424', band: '#ffffff', rosette: '#ffffff', dots: '#ffffff', topping: 'toadstool', pores: 70, mouth: 'cat', accent: '#ffffff' });
  K({ id: 'w1t6', tier: 6, world: 1, name: 'Gingerbread Cake', title: 'The Gingerbread Cottage of the Forest Witch',
    lore: 'Spiced gingerbread with icing scallops and a little gingerbread fellow on top. The forest witch bakes it to lure in guests, then feeds them tea.',
    ingr: ['spiced gingerbread', 'snowy icing', 'a gingerbread fellow'], hint: 'A spicy cottage with icing on the roof.',
    sponge: '#b9743c', frost: '#fff8f0', outline: '#4a2410', band: '#ffffff', rosette: '#ffffff', topping: 'gingerbread', pores: 90, scallop: 11, accent: '#ff5f7a' });
  K({ id: 'w1t7', tier: 7, world: 1, name: 'Maple Cake', title: 'The Golden Maple Spell',
    lore: 'Amber maple frosting with a maple leaf and toasted pecans. In autumn the whole of Candy Woods smells like this.',
    ingr: ['amber maple syrup', 'toasted pecans', 'one perfect leaf'], hint: 'Smells like autumn in the woods.',
    sponge: '#f4dcb0', frost: '#e8963c', outline: '#8a4a14', band: '#ffd9a0', rosette: '#fff3e0', topping: 'maple', pores: 90, accent: '#f0762c' });
  K({ id: 'w1t8', tier: 8, world: 1, name: 'Bramble Cake', title: 'The Midnight Bramble Witch',
    lore: 'Deep purple frosting, blackberries and raspberries from the bramble hedge. Mind the thorns – they were removed by hand, mostly.',
    ingr: ['hedge blackberries', 'wild raspberries', 'deep purple frosting'], hint: 'Picked from a thorny hedge.',
    sponge: '#f0dcf0', frost: '#7a4fb8', outline: '#3f2a78', band: '#ffffff', rosette: '#f3e6ff', topping: 'bramble', pores: 100, mouth: 'cat', accent: '#e0405f' });
  K({ id: 'w1t9', tier: 9, world: 1, name: 'Black Forest Cake', title: 'The Secret Cake of Shadowwood',
    lore: 'Dark chocolate layers, cherries and whipped cream, with chocolate curls on top. Baked only in the deepest, darkest part of the woods.',
    ingr: ['dark chocolate sponge', 'kirsch cherries', 'whipped cream', 'chocolate curls'], hint: 'From the darkest corner of the woods.',
    stripes: ['#4a2a22', '#fff4ec', '#4a2a22', '#fff4ec', '#4a2a22', '#fff4ec'], stripeLine: '#fff4ec', sponge: '#4a2a22', frost: '#fff7f2', outline: '#3a1d18', top: 'cherries', particle: ['#fff7f2', '#ee3a55', '#4a2a22', '#ffffff'] });
  K({ id: 'w1t10', tier: 10, world: 1, name: 'Acorn Torte', title: 'The Enchanted Acorn of the Elves',
    lore: 'Two tiers of hazelnut sponge with an acorn on top and leaf-green wings. Squirrels have been known to ask for a slice, politely.',
    ingr: ['hazelnut sponge', 'an enchanted acorn', 'leaf-green wings'], hint: 'Squirrels ask for this one politely.',
    sponge: '#f5e2c8', frost: '#c99a62', outline: '#7a4a22', band: '#fff0d8', topSponge: '#fff0d8', topFrost: '#f7e6c8', topBand: '#c99a62', pearl: '#fff6e8', pearl2: '#f2d9b0', rosette: '#fff6e8', rosette2: '#e6c89a', wingTint: WING_LEAF, top: 'acorn', accent: '#8fd36f' });
  K({ id: 'w1t11', tier: 11, world: 1, name: "Woodland Queen's Cake", title: 'The Autumn Crown of the Woodland Queen',
    lore: 'Three tiers of moss-green and cream, with a crown of leaves and berries. The Woodland Queen wears the real crown; the cake wears a copy.',
    ingr: ['moss-green sponge', 'a crown of leaves', 'forest berries'], hint: 'Crowned with leaves instead of gold.',
    sponge: '#f3f0d8', frost: '#8fcf8a', outline: '#3f7a4a', band: '#ffe08a', midSponge: '#fff6e0', midFrost: '#dff3c8', midBand: '#8fcf8a', topSponge: '#f3f0d8', topFrost: '#b5e4a4', topBand: '#ffd98a', pearl: '#f2e3b4', rosette: '#ffffff', rosette2: '#e6f2d2', wingTint: WING_LEAF, crown: 'leaf', particle: ['#8fcf8a', '#ff5f7a', '#ffd34d', '#ffffff'] });

  // ---------------- World 3 · Moonlight Bay ----------------
  K({ id: 'w2t1', tier: 1, world: 2, name: 'Midnight Macaron', title: "The Moon Goddess's Midnight Treasure",
    lore: 'A navy shell with a sugar star. The filling is vanilla, but at night it tastes faintly of starlight.',
    ingr: ['midnight almond shell', 'a sugar star', 'starlight vanilla'], hint: 'Navy blue with a star on top.',
    shell: '#4a4fb8', filling: '#fff6e0', outline: '#2a2a6e', accent: '#ffe27a', deco: 'star', dotCol: '#dfe6ff' });
  K({ id: 'w2t2', tier: 2, world: 2, name: 'Mocha Bite', title: "The Witch's Midnight Brew",
    lore: 'Coffee sponge with a cream swirl and a single coffee bean. The witch of the bay drinks three before sunrise.',
    ingr: ['witch-brewed coffee', 'a cream swirl', 'one coffee bean'], hint: 'Strong enough to wake a witch.',
    sponge: '#c89a6a', frost: '#f1dcc2', outline: '#6a4024', band: '#8a5a34', topping: 'mocha', pores: 40, accent: '#8a5a34' });
  K({ id: 'w2t3', tier: 3, world: 2, name: 'Starberry Cupcake', title: "The Starlight Pixie's Cupcake",
    lore: 'Indigo frosting full of star sprinkles, with a gold star on top. Picked, apparently, from a starberry bush.',
    ingr: ['indigo frosting', 'star sprinkles', 'one fallen star'], hint: 'Sprinkled with tiny stars.',
    wrapper: '#7a5fc2', wrapperStripe: '#e6dcff', frost: '#5f5fd8', outline: '#2e2a7a', topper: 'star', stars: ['#fff6a8', '#ffffff', '#ffd34d'], mouth: 'cat', accent: '#ffd34d' });
  K({ id: 'w2t4', tier: 4, world: 2, name: 'Crescent Moon Tart', title: "The Moon Goddess's Sacred Offering",
    lore: 'Dark cocoa crust, pale custard and a crescent moon. Left on the shore at full moon, it is always gone by morning.',
    ingr: ['cocoa crust', 'moonlight custard', 'a crescent moon'], hint: 'Left on the shore at full moon.',
    crust: '#6a4a3a', frost: '#fff2b8', outline: '#3a2418', topping: 'moon', accent: '#ffe27a' });
  K({ id: 'w2t5', tier: 5, world: 2, name: 'Lavender Dream', title: "The Lavender Fairy's Sleeping Spell",
    lore: "Lavender frosting with sprigs from the bay's purple fields. One slice before bed and you dream of floating ponds.",
    ingr: ['lavender frosting', 'purple sprigs', 'a yawn'], hint: "One slice and you'll dream.",
    sponge: '#f3e8ff', frost: '#c3a4f2', outline: '#6a4aa8', band: '#ffffff', rosette: '#f5ecff', topping: 'lavender', pores: 70, mouth: 'cat', accent: '#9a6fd6' });
  K({ id: 'w2t6', tier: 6, world: 2, name: "Witch's Brew Cake", title: "The Little Witch's Forbidden Treat",
    lore: 'Bubbling green potion drips over a plum-dark cake. Perfectly safe, says the witch, apart from the hiccups.',
    ingr: ['bubbling potion glaze', 'plum-dark sponge', 'three hiccups'], hint: 'Bubbling, green and slightly forbidden.',
    sponge: '#5a3a6e', frost: '#4fd68c', outline: '#1f3a3a', band: '#2fbf7a', dark: true, topping: 'potion', pores: 80, dripDeep: 1.4, accent: '#9ff7c8' });
  K({ id: 'w2t7', tier: 7, world: 2, name: 'Tiramisu Cake', title: 'The Midnight Masquerade',
    lore: "Coffee-soaked layers dusted with cocoa, cream swirls and coffee beans. Served at the bay's masked ball at midnight.",
    ingr: ['coffee-soaked sponge', 'cocoa dust', 'mascarpone cream'], hint: 'Dressed for a midnight ball.',
    sponge: '#e2c8a0', frost: '#8a5a3a', outline: '#4a2a18', band: '#fff6ea', rosette: '#fff6ea', dark: true, topping: 'tiramisu', pores: 90, accent: '#fff6ea' });
  K({ id: 'w2t8', tier: 8, world: 2, name: 'Sapphire Cheesecake', title: 'The Sapphire Crown of the Moon Kingdom',
    lore: "A velvet-blue cheesecake with blueberries and sugar crystals. The crystals are grown in the bay's caves, slowly.",
    ingr: ['velvet-blue cheesecake', 'cave-grown sugar crystals', 'moon blueberries'], hint: 'Velvet blue with crystals.',
    sponge: '#fff5e0', frost: '#5a6fd8', outline: '#2a2f78', band: '#ffffff', rosette: '#dfe6ff', topping: 'sapphire', pores: 60, mouth: 'cat', accent: '#8fd0ff' });
  K({ id: 'w2t9', tier: 9, world: 2, name: 'Galaxy Cake', title: 'The Starlight Kingdom Beyond the Moon',
    lore: 'Dark layers under a swirl of nebula frosting and sugar stars. Every slice shows a different constellation.',
    ingr: ['six dark sponges', 'nebula frosting', 'a handful of sugar stars'], hint: 'A whole galaxy in six layers.',
    stripes: ['#2a1a4a', '#3f2a78', '#2a1a4a', '#4a2f8a', '#2a1a4a', '#3f2a78'], stripeLine: '#8f7fd0', sponge: '#2a1a4a', frost: '#3b2d7a', outline: '#1a1040', dark: true, top: 'galaxy',
    sweep: ['#3b2d7a', '#6a3fb8', '#2a6fb8', '#8f3fa8'], sweepSoft: ['#5a3fa8', '#8f5fd8', '#4a8fe0', '#b85fc8', '#5a3fa8'], sweepTop: '#3b2d7a', sweepAlpha: 0.85, sweepLine: '#1a1040', particle: ['#8f5fd8', '#4a8fe0', '#fff6a8', '#ffffff'] });
  K({ id: 'w2t10', tier: 10, world: 2, name: 'Moonbeam Torte', title: 'The Moonlight Meringue Palace',
    lore: 'Two tiers of silver-blue meringue with a crescent on top and moonlit wings. It glows a little in the dark.',
    ingr: ['silver meringue', 'a crescent moon', 'moonlit wings'], hint: 'Winged, and it glows at night.',
    sponge: '#eef0ff', frost: '#b9c6f2', outline: '#5a6cb0', band: '#ffffff', topSponge: '#f6f7ff', topFrost: '#ffffff', topBand: '#b9c6f2', pearl: '#ffffff', pearl2: '#dfe6ff', rosette: '#ffffff', rosette2: '#dfe6ff', wingTint: WING_MOON, top: 'moon', accent: '#dfe6ff' });
  K({ id: 'w2t11', tier: 11, world: 2, name: "Moon Queen's Cake", title: "The Moon Queen's Celestial Pearl",
    lore: 'Three tiers of midnight blue and silver, with a crown holding a moon pearl. Only baked once a month, for obvious reasons.',
    ingr: ['midnight sponge', 'silver pearls', 'a moon-pearl crown'], hint: 'Baked once a month.',
    sponge: '#e6e8ff', frost: '#3f4fb0', outline: '#1f2a6a', band: '#dfe6ff', midSponge: '#f0f0ff', midFrost: '#7f8fe0', midBand: '#ffffff', topSponge: '#e6e8ff', topFrost: '#b9c6f2', topBand: '#ffffff', pearl: '#ffffff', rosette: '#dfe6ff', rosette2: '#ffffff', wingTint: WING_MOON, crown: 'moon', particle: ['#7f8fe0', '#ffffff', '#dfe6ff', '#fff6a8'] });

  // ---------------- World 4 · Rainbow Heights ----------------
  K({ id: 'w3t1', tier: 1, world: 3, name: 'Cloud Macaron', title: "Angel's Kiss from the Clouds",
    lore: 'A sky-blue shell with a cloud on top, filled with the lightest cream in the kingdom. It weighs almost nothing.',
    ingr: ['sky-blue shell', 'a cloud of cream', 'a breath of wind'], hint: 'Light as a cloud, because it is one.',
    shell: '#a9d8ff', filling: '#ffffff', outline: '#4f78b8', accent: '#ffffff', deco: 'cloud' });
  K({ id: 'w3t2', tier: 2, world: 3, name: 'Sunrise Bite', title: 'The Sunspell of the Citrus Sorceress',
    lore: 'Peach-and-orange sponge with an orange slice on top. Baked at dawn on the highest peak, where the sun comes up first.',
    ingr: ['dawn-orange sponge', 'a slice of sunrise', 'orange-blossom cream'], hint: 'Baked where the sun comes up first.',
    sponge: '#ffd2a0', frost: '#ffb070', outline: '#b85a28', band: '#ff8a5a', topping: 'sunrise', pores: 40, accent: '#ff9a3c' });
  K({ id: 'w3t3', tier: 3, world: 3, name: 'Cotton Candy Cupcake', title: 'The Fairy Floss Cloud Palace',
    lore: 'A two-tone swirl of pink and blue with a tuft of cotton candy, spun from the clouds above the Heights.',
    ingr: ['spun-cloud floss', 'a pink-and-blue swirl', 'a sprinkle of sugar'], hint: 'Spun from pink and blue clouds.',
    wrapper: '#ffffff', wrapperDots: '#ffb3d9', frost: '#ffb3d9', frost2: '#a9d8ff', outline: '#9a5a8a', topper: 'tuft', sprinkles: ['#ffffff', '#ffd6ea', '#bfe3ff'], accent: '#a9d8ff' });
  K({ id: 'w3t4', tier: 4, world: 3, name: 'Crème Brûlée Tart', title: 'The Crystal Crown of the Sugar Fairy',
    lore: 'Vanilla custard under a crackling caramel crown, with raspberries. The crack is the best part; everyone agrees.',
    ingr: ['vanilla custard', 'a crackling caramel lid', 'three raspberries'], hint: 'Crack the top with a spoon.',
    crust: '#e8b36a', frost: '#e8a040', outline: '#8a5a1a', topping: 'brulee', accent: '#e0405f' });
  K({ id: 'w3t5', tier: 5, world: 3, name: 'Coconut Snow Cake', title: "The Snowflake Fairy's Coconut Palace",
    lore: 'Snow-white frosting covered in coconut flakes with a sugar snowflake. It never melts, even in the sun.',
    ingr: ['snowy coconut flakes', 'white frosting', 'a sugar snowflake'], hint: 'Snow that never melts.',
    sponge: '#fff8ea', frost: '#ffffff', outline: '#8aa0b8', band: '#dff2ff', rosette: '#ffffff', topping: 'coconut', pores: 60, accent: '#bfe6ff', particle: ['#ffffff', '#dff2ff', '#bfe6ff', '#fff8ea'] });
  K({ id: 'w3t6', tier: 6, world: 3, name: 'Opera Cake', title: 'The Royal Symphony of a Thousand Stars',
    lore: 'Thin layers of almond sponge, coffee cream and chocolate, with a gold leaf on top. The royal choir hums over it while it bakes.',
    ingr: ['almond sponge', 'coffee cream', 'a flake of gold leaf'], hint: 'Baked to music.',
    sponge: '#6a4030', frost: '#3a2218', outline: '#2a150e', dark: true, topping: 'opera', pores: 0, sideStripes: ['#f3e2b8', '#6a4030', '#f3e2b8', '#6a4030', '#f3e2b8', '#3a2218'], stripeLine: '#5a3828', dripDeep: 0.6, accent: '#f2c43a', particle: ['#3a2218', '#f2c43a', '#f3e2b8', '#ffffff'] });
  K({ id: 'w3t7', tier: 7, world: 3, name: 'Rosewater Cake', title: 'The Enchanted Rose Garden',
    lore: 'Rose-pink frosting and a sugar rose with scattered petals, from the garden on the Heights where the roses grow as big as cakes.',
    ingr: ['rosewater frosting', 'a sugar rose', 'scattered petals'], hint: 'Smells like a garden of roses.',
    sponge: '#fff0f5', frost: '#ff9ec2', outline: '#b84f80', band: '#ffffff', rosette: '#ffffff', topping: 'rose', pores: 70, mouth: 'cat', accent: '#ff7fae' });
  K({ id: 'w3t8', tier: 8, world: 3, name: 'Pavlova Cloud', title: 'The Cloud Palace of the Sky Princess',
    lore: 'A crisp meringue cloud with cream, kiwi and passion fruit. The Sky Princess serves it on actual clouds.',
    ingr: ['crisp meringue', 'whipped cream', 'kiwi and passion fruit'], hint: 'Served on actual clouds.',
    sponge: '#fff8f0', frost: '#fffdf8', outline: '#b8a090', band: '#fff0d8', rosette: '#ffffff', topping: 'pavlova', pores: 50, scallop: 11, accent: '#a8d86a', particle: ['#ffffff', '#a8d86a', '#ffb94a', '#fff0d8'] });
  K({ id: 'w3t9', tier: 9, world: 3, name: 'Crystal Cake', title: 'The Crystal Palace of the Fairy Ancients',
    lore: 'Pastel layers topped with sugar crystals that catch the light. Grown, not baked – or so the ancients say.',
    ingr: ['pastel sponges', 'rock-sugar crystals', 'a shaft of light'], hint: 'Grown, not baked.',
    stripes: ['#ffd6e8', '#dff6ff', '#e8dcff', '#d6fff0', '#fff6cc', '#ffe0f0'], sponge: '#fff7fb', frost: '#ffffff', outline: '#8f7fc4', top: 'crystal', particle: ['#ff9ec2', '#9fd4ff', '#c9a6ff', '#ffffff'] });
  K({ id: 'w3t10', tier: 10, world: 3, name: 'Starlight Tower', title: 'The Starlight Tower of a Thousand Fairies',
    lore: 'Two golden tiers with a shining star and golden wings. A thousand fairies live in the real tower; the cake has room for one.',
    ingr: ['golden sponge', 'a shining star', 'golden wings'], hint: 'A tower with a star on top.',
    sponge: '#fff6dc', frost: '#ffd45a', outline: '#b8821a', band: '#ffffff', topSponge: '#fffbea', topFrost: '#ffffff', topBand: '#ffd45a', pearl: '#fff3b0', pearl2: '#ffe27a', rosette: '#ffffff', rosette2: '#ffe9a0', wingTint: WING_GOLD, top: 'star', accent: '#ffd23f' });
  K({ id: 'w3t11', tier: 11, world: 3, name: "Fairy Queen's Crown Cake", title: "The Fairy Queen's Lost Crown",
    lore: 'Three tiers in white and gold, with a jewelled crown. The Queen lost her crown years ago; this is where it turned up.',
    ingr: ['white-and-gold sponge', 'a jewelled crown', 'rainbow pearls'], hint: "The Queen's crown turned up here.",
    sponge: '#fff8ea', frost: '#ffffff', outline: '#b8921a', band: '#ffd45a', midSponge: '#fff8ea', midFrost: '#ffecb8', midBand: '#ffffff', topSponge: '#fff8ea', topFrost: '#ffffff', topBand: '#ffd45a', pearl: '#ffd45a', rosette: '#fff3c8', rosette2: '#ffffff', wingTint: WING_GOLD, crown: 'jewel', flowerA: '#ff8fb4', flowerB: '#ffd34d', particle: ['#ffd45a', '#ff5f8f', '#5fc8ff', '#ffffff'] });

  // ---------------- World 5 · Starfall Realm ----------------
  K({ id: 'w4t1', tier: 1, world: 4, name: 'Stardust Macaron', title: "The First Fairy's Stardust",
    lore: 'A champagne shell dusted with stardust, filled with starlight cream. The oldest recipe in the realm.',
    ingr: ['stardust', 'champagne almond shell', 'starlight cream'], hint: 'The oldest recipe in the realm.',
    shell: '#fff0c2', filling: '#ffe6a0', outline: '#b89a4a', accent: '#ffd34d', deco: 'sparkle' });
  K({ id: 'w4t2', tier: 2, world: 4, name: 'Dragonfruit Bite', title: "The Dragon's Forbidden Ruby",
    lore: 'Magenta sponge with snow-white frosting speckled with tiny black seeds. Dragons guard the fruit; fairies are faster.',
    ingr: ['dragonfruit', 'magenta sponge', 'a hundred tiny seeds'], hint: 'Guarded by dragons.',
    sponge: '#ff5fa8', frost: '#fff6fa', outline: '#a8246e', band: '#9fe36a', dots: '#2a1a2a', dotScale: 0.45, topping: 'dragonfruit', pores: 40, accent: '#ff5fa8' });
  K({ id: 'w4t3', tier: 3, world: 4, name: 'Unicorn Cupcake', title: "The Unicorn's Eternal Dream",
    lore: 'A rainbow swirl of frosting with a golden horn. Unicorns deny all involvement.',
    ingr: ['rainbow swirl', 'a golden horn', 'unicorn-approved sprinkles'], hint: 'Horned, and in denial.',
    wrapper: '#ffffff', wrapperDots: '#c9a6ff', frost: '#ffb3d9', frost2: '#c9a6ff', outline: '#9a5a9a', topper: 'horn', sprinkles: ['#ffffff', '#ffe27a', '#8fe3ff', '#c9a6ff', '#ff8fc4'], accent: '#ffd34d' });
  K({ id: 'w4t4', tier: 4, world: 4, name: 'Phoenix Tart', title: "The Phoenix's Flame of Eternity",
    lore: 'A fiery tart with a flame of spun sugar that never goes out. Blow on it all you like.',
    ingr: ['chilli-caramel custard', 'a flame of spun sugar', 'ember crust'], hint: "A flame you can't blow out.",
    crust: '#8a3a2a', frost: '#ff8a3a', outline: '#5a1a14', topping: 'flame', accent: '#ffd34d' });
  K({ id: 'w4t5', tier: 5, world: 4, name: 'Sugarplum Cake', title: "The Sugarplum Fairy's Eternal Spell",
    lore: 'Plum-purple frosting with sugarplums on top. The Sugarplum Fairy dances around it every winter.',
    ingr: ['sugarplums', 'plum frosting', 'a dance'], hint: 'Dance around it in winter.',
    sponge: '#f6e6ff', frost: '#9a5fd6', outline: '#4a2a78', band: '#ffffff', rosette: '#f3e6ff', topping: 'sugarplum', pores: 70, mouth: 'cat', accent: '#e6b8ff' });
  K({ id: 'w4t6', tier: 6, world: 4, name: 'Dragon Egg Cake', title: 'The Hatching of the Ancient Dragon',
    lore: 'A scaled teal cake with a speckled egg on top. Keep it warm and something might hatch. Probably more cake.',
    ingr: ['teal scale frosting', 'a speckled egg', 'a warm blanket'], hint: 'Keep it warm.',
    sponge: '#3f9a8a', frost: '#5fc8b8', outline: '#1f5a52', band: '#2a7a6e', rosette: '#dff6f0', topping: 'dragonegg', scales: true, pores: 0, accent: '#d9f3f0' });
  K({ id: 'w4t7', tier: 7, world: 4, name: 'Aurora Cake', title: 'The Eternal Aurora of the Northern Kingdom',
    lore: 'Frosting that shimmers green, teal and violet like the northern lights. Baked at the very top of the sky.',
    ingr: ['northern-light frosting', 'frost sugar', 'a shimmer'], hint: 'Shimmers like the northern lights.',
    sponge: '#e8e2ff', frost: '#5fd8c8', outline: '#3a4a8a', band: '#ffffff', rosette: '#ffffff', topping: 'aurora', pores: 60,
    sweep: ['#5fd8c8', '#7fe08f', '#5f9fe8', '#b57fe8'], sweepSoft: ['#9ff0e0', '#b8f0b0', '#9fc8ff', '#d8b8ff', '#9ff0e0'], sweepTop: '#5fd8c8', sweepLine: '#3a4a8a', sweepAlpha: 0.75, accent: '#b57fe8', particle: ['#5fd8c8', '#7fe08f', '#b57fe8', '#ffffff'] });
  K({ id: 'w4t8', tier: 8, world: 4, name: 'Mermaid Pearl Cake', title: "The Mermaid Queen's Pearl Lagoon",
    lore: 'Sea-green frosting with pearls and a shell. The Mermaid Queen traded the recipe for a very good comb.',
    ingr: ['lagoon-green frosting', 'sugar pearls', 'a seashell'], hint: 'Traded for a very good comb.',
    sponge: '#fff4f8', frost: '#6fd6c8', outline: '#2f7a78', band: '#ff9ec2', rosette: '#ffffff', topping: 'mermaid', pores: 70, mouth: 'cat', accent: '#ff9ec2' });
  K({ id: 'w4t9', tier: 9, world: 4, name: 'World Tree Cake', title: 'The Sacred Fruit of the World Tree',
    lore: "Earthy layers with a tiny tree growing on top. Water it and it grows a little. Don't water it too much.",
    ingr: ['root-and-bark sponge', 'a tiny tree', 'one drop of rain'], hint: 'A tree grows on it.',
    stripes: ['#c9a46a', '#8a5a34', '#c9a46a', '#8a5a34', '#c9a46a', '#8a5a34'], stripeLine: '#e8d2a8', sponge: '#c9a46a', frost: '#b8e49a', outline: '#4a5a2a', top: 'tree', particle: ['#b8e49a', '#8a5a34', '#ff6f9a', '#ffffff'] });
  K({ id: 'w4t10', tier: 10, world: 4, name: 'Wishing Torte', title: 'The Wishing Well of a Thousand Dreams',
    lore: 'Two tiers of midnight-and-gold with a shooting star. Make a wish before the first slice.',
    ingr: ['midnight sponge', 'a shooting star', 'a wish'], hint: 'Make a wish before slicing.',
    sponge: '#3b2d7a', frost: '#4a3f9a', outline: '#1f1a4a', band: '#ffd45a', topSponge: '#3b2d7a', topFrost: '#ffe9a0', topBand: '#4a3f9a', pearl: '#ffe27a', pearl2: '#fff3b0', rosette: '#ffe9a0', rosette2: '#fff6d0', wingTint: WING_NIGHT, top: 'wish', dark: true, accent: '#ffd45a', particle: ['#ffd45a', '#4a3f9a', '#fff6a8', '#ffffff'] });
  K({ id: 'w4t11', tier: 11, world: 4, name: 'Fairy Empress Cake', title: 'The Heavenly Throne of the Fairy Empress',
    lore: 'Three tiers of ivory and gold under the grandest crown in the realm. The Empress has only ever been seen eating this.',
    ingr: ['ivory sponge', 'the grandest crown', 'a thousand gold pearls'], hint: 'The grandest crown of all.',
    sponge: '#fff8ea', frost: '#fff2d0', outline: '#b8821a', band: '#ffd45a', midSponge: '#fff8ea', midFrost: '#ffffff', midBand: '#ffd45a', topSponge: '#fff8ea', topFrost: '#ffe9a0', topBand: '#ffffff', pearl: '#ffd45a', rosette: '#ffffff', rosette2: '#fff3c8', wingTint: WING_GOLD, crown: 'empress', shine: true, flowerA: '#ff8fb4', flowerB: '#ffd34d', particle: ['#ffd45a', '#fff2d0', '#ffffff', '#ff8fb4'] });

  // ---------------- Rare finds: they drift into the sling now and then, in any world ----------------
  K({ id: 'rare_pop', tier: 1, world: 'rare', style: 'pop', name: 'Pixie Pop', title: "Pixie's Sugar Wand",
    lore: 'A cake pop on a stick, which the pixies use as a wand. It drifts into the sling now and then – flick it with care!',
    ingr: ['cake crumbs', 'pink glaze', 'a wand'], hint: 'Rare – keep an eye on the sling.',
    frost: '#ff8fc4', outline: '#b9577c', accent: '#ffe27a', chance: 1 });
  K({ id: 'rare_gold', tier: 1, world: 'rare', name: 'Golden Macaron', title: "The Sun Fairy's Kiss",
    lore: 'A macaron that was kissed by the Sun Fairy and turned to gold. Merging it brings a shower of bonus points.',
    ingr: ['gold-leaf shell', 'sunbeam cream', 'a kiss'], hint: 'Rare – it glitters in the sling.',
    shell: '#ffc62a', filling: '#fff3c8', outline: '#a86a12', accent: '#ffffff', deco: 'sparkle', shine: true, chance: 0.7 });
  K({ id: 'rare_clover', tier: 2, world: 'rare', name: 'Lucky Clover Bite', title: "The Leprechaun's Lucky Bite",
    lore: 'Green sponge with a four-leaf clover. Lucky in every way, including the points.',
    ingr: ['clover-green sponge', 'a four-leaf clover', 'a pot of luck'], hint: 'Rare – often seen in Candy Woods.',
    sponge: '#f3f7c8', frost: '#9fe07a', outline: '#3f8a45', band: '#ffffff', topping: 'clover', pores: 40, accent: '#3f9a45', chance: 1, boost: 1 });
  K({ id: 'rare_birthday', tier: 2, world: 'rare', name: 'Birthday Bite', title: "The Birthday Pixie's Surprise",
    lore: "Confetti sponge with a little candle. It's always somebody's birthday somewhere.",
    ingr: ['confetti sponge', 'a little candle', 'a wish, again'], hint: 'Rare – it comes with a candle.',
    sponge: '#fff3f8', frost: '#ffffff', outline: '#b06a8a', band: '#ff8fc4', topping: 'birthday', pores: 40, accent: '#ff8fc4', chance: 1 });
  K({ id: 'rare_ghost', tier: 3, world: 'rare', name: 'Boo Cupcake', title: 'The Friendly Ghost of the Bakery',
    lore: 'A ghostly white cupcake that floats into the sling at odd hours. Perfectly friendly, slightly see-through.',
    ingr: ['see-through frosting', 'a lavender wrapper', 'a tiny boo'], hint: 'Rare – often seen in Moonlight Bay.',
    wrapper: '#cdbdf5', wrapperStripe: '#ffffff', frost: '#ffffff', outline: '#8a7ac0', topper: 'ghost', accent: '#cdbdf5', chance: 0.8, boost: 2 });

  // ---------------- The joker ----------------
  K({ id: 'magic', tier: 0, world: 'magic', name: 'Magic Cake', title: 'The Enchanted Wish Cake',
    lore: 'A rainbow joker that upgrades the first cake it touches. Earned by filling orders and popping Fairy Bubbles.',
    ingr: ['one wish', 'six rainbows', 'a gold star'], hint: 'A gift for a finished order.',
    sponge: '#fff4dc', frost: '#ffffff', outline: '#9a6fd0', particle: ['#ff8fc4', '#ffd66b', '#8fe3c3', '#9ec5ff', '#c9a6ff', '#ffffff'] });

  const WORLD_COUNT = 5;
  const WORLD_MENUS = [];
  for (let w = 0; w < WORLD_COUNT; w++) {
    const m = ['magic'];
    for (let t = 1; t <= MAX_TIER; t++) m.push('w' + w + 't' + t);
    WORLD_MENUS.push(m);
  }
  const RARES = KIND_LIST.filter((k) => k.world === 'rare').map((k) => k.id);
  const COLLECTIBLE = KIND_LIST.filter((k) => k.world !== 'magic').map((k) => k.id);

  // ------------------------------------------------------------------
  // the active menu: which kind a tier makes right now (set per world / level)
  // ------------------------------------------------------------------
  let menu = WORLD_MENUS[0].slice();
  function setMenu(worldOrList) {
    menu = Array.isArray(worldOrList) ? worldOrList.slice() : WORLD_MENUS[((worldOrList % WORLD_COUNT) + WORLD_COUNT) % WORLD_COUNT].slice();
  }
  function kindFor(tier) {
    return tier <= 0 ? 'magic' : menu[tier] || WORLD_MENUS[0][tier];
  }
  function spec(kind) {
    return KINDS[kind] || KINDS[typeof kind === 'number' ? kindFor(kind) : 'magic'];
  }
  function tierOf(kind) {
    const s = KINDS[kind];
    return s ? s.tier : typeof kind === 'number' ? kind : 1;
  }

  // ------------------------------------------------------------------
  // Sprite cache (per kind and pixel radius)
  // ------------------------------------------------------------------
  const cache = new Map();

  function renderSprite(kind, rpx) {
    const s = spec(kind);
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

  function sprite(kind, rpx) {
    const q = Math.max(8, Math.round(rpx));
    let e = cache.get(kind);
    if (!e || e.rpx !== q) {
      e = renderSprite(kind, q);
      cache.set(kind, e);
    }
    return e;
  }

  // silhouette (for the Cake Book and the level cards)
  function silhouette(kind, rpx, color) {
    const sp = renderSprite(kind, rpx);
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
  function drawFace(ctx, kind, o) {
    const s = spec(kind);
    const tier = s.tier;
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

  // Icon (HUD, book, cards): cake + face into a canvas
  function drawIcon(canvas, kind, opts) {
    const o = opts || {};
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = o.w || canvas.clientWidth || 64, cssH = o.h || canvas.clientHeight || 64;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const s = spec(kind);
    const ext = EXTENT[s.style];
    const fitH = ext.top + 1.08, fitW = ext.side * 2;
    const rpx = Math.min(canvas.width / fitW, canvas.height / fitH) * (o.scale || 0.92);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2 + (rpx * (ext.top - 1.08)) / 2;
    if (o.silhouette) {
      const sp = silhouette(s.id, rpx, o.silhouette);
      ctx.drawImage(sp.canvas, cx - sp.cx, cy - sp.cy);
      return;
    }
    ctx.beginPath();
    ctx.ellipse(cx, cy + rpx * 0.92, rpx * 0.95, rpx * 0.22, 0, 0, TAU);
    ctx.fillStyle = 'rgba(120,60,90,0.16)';
    ctx.fill();
    const sp = renderSprite(s.id, rpx);
    ctx.drawImage(sp.canvas, cx - sp.cx, cy - sp.cy);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(rpx, rpx);
    drawFace(ctx, s.id, { expr: o.expr || 'normal', blink: 0, lookX: 0, lookY: 0.2 });
    ctx.restore();
  }

  function clearCache() {
    cache.clear();
  }

  FC.Cakes = {
    TIERS, MAX_TIER, SIZE_NAMES, FACE, EXTENT,
    KINDS, KIND_LIST, WORLD_MENUS, WORLD_COUNT, RARES, COLLECTIBLE,
    spec, tierOf, kindFor, setMenu, get menu() { return menu; },
    sprite, renderSprite, drawFace, drawIcon, silhouette, clearCache,
  };
})();
