/* Fairycake Falls – asset generator.
   One art style (clean, rounded shapes, soft gradients, gentle tinted outlines,
   light from the top left) and one camera (arena tilted, ellipse ratio K). */
(function () {
  'use strict';
  const TAU = P.TAU;
  const mix = P.mix, rgba = P.rgba;
  const G = (window.GEN = {});
  const K = (G.K = 0.78); // arena tilt: vertical squash of the pond ellipse

  // ------------------------------------------------------------------
  // palettes
  // ------------------------------------------------------------------
  const THEMES = [
    {
      key: 'blossom', name: 'Blossom Falls',
      sky: [[0, '#8ccafd'], [0.4, '#c3d3fb'], [0.72, '#efd5f1'], [1, '#ffdde8']], sun: '#fff7de', sunX: 0.22, rays: 0.07,
      cloud: { light: '#ffffff', mid: '#fcf6fe', shade: '#ebdff6', deep: '#c9b4e2' },
      fade: '#d8d1f6',
      grass: { hi: '#d2f59c', light: '#a8e37b', mid: '#7fc95e', dark: '#58a748', deep: '#3d8a3d', line: '#2e6a39' },
      rock: { hi: '#ffe4d0', light: '#f2c8aa', mid: '#d8a083', dark: '#ad7468', deep: '#7c4c56', line: '#5a3748' },
      water: { hi: '#effffd', light: '#aef2ee', mid: '#62d0e3', deep: '#2f96c6', far: '#2878ae' },
      fall: { light: '#ffffff', mid: '#cdf6ff', dark: '#86d6ef' },
      leaf: { hi: '#d0f3a2', light: '#a2dd77', mid: '#70be58', dark: '#468f45', line: '#2c6838' },
      blossom: { hi: '#fff3f8', light: '#ffd2e5', mid: '#f7a3c6', dark: '#da739f', line: '#a4467b' },
      bark: { light: '#ad7d6c', dark: '#5e3e44' },
      flowers: ['#ffffff', '#ff9fca', '#ffe27a', '#d6abff', '#ffb8d9'],
      castle: { wall: '#fff8fb', shade: '#e6cbe0', roof: '#ff95c3', roofShade: '#cc6399', window: '#a65a8c', gold: '#ffd56a' },
    },
    {
      // autumn at golden hour: a rose-to-honey sky with a low sun, maples in red, orange and gold, a golden meadow
      // strewn with leaves and pumpkins, caramel cliffs – and deep teal water, so that every cake still stands out
      key: 'candy', name: 'Candy Woods', litter: true,
      sky: [[0, '#eea0b8'], [0.34, '#ffba98'], [0.66, '#ffd99c'], [1, '#fff0c8']], sun: '#fff0c0', sunX: 0.7, sunY: 0.3, rays: 0.11, rayDir: 1.95,
      cloud: { light: '#fff8ee', mid: '#ffe9d4', shade: '#f6c9a9', deep: '#dc9c84' },
      fade: '#f2c4a4',
      grass: { hi: '#fdeaa4', light: '#f0d27a', mid: '#d9b45a', dark: '#b18d44', deep: '#8a6a37', line: '#5e4528' },
      rock: { hi: '#ffe4c2', light: '#eebe8c', mid: '#d29462', dark: '#a76a44', deep: '#774733', line: '#523024' },
      water: { hi: '#e8fff8', light: '#93ded0', mid: '#3ea79f', deep: '#207a7d', far: '#175f6a' },
      fall: { light: '#ffffff', mid: '#d6f6ee', dark: '#90d4c7' },
      leaf: { hi: '#ffd996', light: '#ffae54', mid: '#f2802f', dark: '#c85a22', line: '#8a3618' },
      blossom: { hi: '#ffc2ae', light: '#ff8466', mid: '#e8503c', dark: '#b6332f', line: '#7a1f23' },
      gold: { hi: '#fff3b2', light: '#ffd65c', mid: '#f2b232', dark: '#c78620', line: '#8a5414' },
      bark: { light: '#a8795a', dark: '#563424' },
      flowers: ['#fff3d6', '#ffcf5a', '#ff9a4a', '#e8563f', '#c58ae0'],
      castle: { wall: '#fff3e0', shade: '#e6c59e', roof: '#da5a30', roofShade: '#9c3520', window: '#8a4628', gold: '#ffd25a' },
      crystals: ['#ffd27a', '#ffb27a'],
    },
    {
      key: 'moon', name: 'Moonlight Bay', stars: true, moon: true,
      sky: [[0, '#171b4c'], [0.42, '#35367f'], [0.74, '#74579e'], [1, '#bd86b7']], sun: '#d8ccff', sunX: 0.8, rays: 0.0,
      cloud: { light: '#dcd2ff', mid: '#c0b2ee', shade: '#9a8bd2', deep: '#6b5ea3' },
      fade: '#5b4e94',
      grass: { hi: '#a8e0b4', light: '#74b98e', mid: '#4b9270', dark: '#2f6f55', deep: '#1f5442', line: '#123a30' },
      rock: { hi: '#d6c6ee', light: '#a996cc', mid: '#8371ab', dark: '#5e4f88', deep: '#3e3466', line: '#29224a' },
      water: { hi: '#e8f8ff', light: '#86d4ee', mid: '#3f88c6', deep: '#21498e', far: '#1a3a78' },
      fall: { light: '#f4fbff', mid: '#bfe2ff', dark: '#6faee0' },
      leaf: { hi: '#a6e2b6', light: '#6db68a', mid: '#438d68', dark: '#276a50', line: '#123a30' },
      blossom: { hi: '#f6efff', light: '#d8c6ff', mid: '#ad92ea', dark: '#7c62c6', line: '#4a3888' },
      bark: { light: '#6e5a86', dark: '#2e2440' },
      flowers: ['#fff6bf', '#ffb3e6', '#a8f0ff', '#ffffff', '#d4b8ff'],
      castle: { wall: '#ddd4f4', shade: '#9f91c8', roof: '#7260bc', roofShade: '#4a3b8c', window: '#ffd86a', gold: '#ffd56a', lit: true },
    },
    {
      // a bright sky kingdom above the clouds: deep blue sky, a rainbow over the castle, ground of soft cloud,
      // marble cliffs with gold veins, cotton-candy trees in every pastel, a white and gold palace, azure water
      key: 'rainbow', name: 'Rainbow Heights', rainbowFar: true,
      sky: [[0, '#4ea6f5'], [0.36, '#86c8ff'], [0.68, '#cbe8ff'], [1, '#fff3da']], sun: '#ffffff', sunX: 0.24, sunY: 0.05, rays: 0.12,
      cloud: { light: '#ffffff', mid: '#f7fbff', shade: '#dbe8fb', deep: '#aac0e8' },
      fade: '#cfe3fb',
      grass: { hi: '#ffffff', light: '#fdfdff', mid: '#e8f0fd', dark: '#ccd9f2', deep: '#aabbe0', line: '#8293c2' },
      rock: { hi: '#ffffff', light: '#f2f0fd', mid: '#d9d5f1', dark: '#b4adda', deep: '#8a83ba', line: '#635d96', vein: '#ffc845' },
      water: { hi: '#ffffff', light: '#a4e4ff', mid: '#48adf2', deep: '#2a79d4', far: '#205db6' },
      fall: { light: '#ffffff', mid: '#def0ff', dark: '#9ac9f2' },
      leaf: { hi: '#ffffff', light: '#ffffff', mid: '#eef3fe', dark: '#d0d9f2', line: '#95a2d2' },
      blossom: { hi: '#fff4fa', light: '#ffd2ea', mid: '#ffa8d2', dark: '#e57fb2', line: '#b0528a' },
      crowns: [
        { hi: '#fff4fa', light: '#ffd2ea', mid: '#ffa8d2', dark: '#e57fb2', line: '#b0528a' },
        { hi: '#f8f2ff', light: '#e2d2ff', mid: '#c4a8ff', dark: '#9b7fe0', line: '#6a52b0' },
        { hi: '#f0fff8', light: '#c4f5df', mid: '#8fe3bf', dark: '#5fbf98', line: '#3a8a6a' },
        { hi: '#fffde8', light: '#fff2a8', mid: '#ffdf5c', dark: '#e8b830', line: '#a87a14' },
        { hi: '#f0f8ff', light: '#c8e6ff', mid: '#94caff', dark: '#62a0e8', line: '#3a6ab0' },
        { hi: '#fff6ee', light: '#ffd9c0', mid: '#ffb48c', dark: '#ec8a64', line: '#b0563c' },
      ],
      bark: { light: '#e6c48e', dark: '#a87e48' },
      flowers: ['#ff9fca', '#ffe066', '#9fe8c0', '#9fd2ff', '#c9a8ff', '#ffb38a'],
      castle: { wall: '#ffffff', shade: '#dde2f4', roof: '#ffcf48', roofShade: '#cc9020', window: '#6c94dc', gold: '#ffe78a' },
      crystals: ['#ffd2ef', '#cdefff', '#e6d6ff', '#d2ffe8', '#fff1a8'],
      vine: { light: '#ecdfff', mid: '#d2bff8', dark: '#a893e2' },
    },
    {
      // legendary dusk: a deep starry sky (the aurora waves over it at runtime), golden and violet trees, violet water
      key: 'starfall', name: 'Starfall Realm', stars: true, rays: 0.05,
      sky: [[0, '#1d1350'], [0.36, '#4b2f90'], [0.66, '#b65aa3'], [1, '#ffc58a']], sun: '#fff0c0', sunX: 0.5,
      crowns: [
        { hi: '#fff8e0', light: '#ffe9a8', mid: '#ffcf5a', dark: '#e8a02a', line: '#a86a14' },
        { hi: '#ffeeff', light: '#f4c0ff', mid: '#d88cf2', dark: '#aa5ecb', line: '#6c3290' },
      ],
      crystals: ['#ffe9a0', '#e2c4ff'],
      cloud: { light: '#fff6e8', mid: '#f6dfe6', shade: '#d8b4d6', deep: '#a985bd' },
      fade: '#b48cc4',
      grass: { hi: '#dcfff0', light: '#a8eccd', mid: '#74cfa9', dark: '#4caa87', deep: '#34876c', line: '#245e4e' },
      rock: { hi: '#fff0d6', light: '#f4d4a6', mid: '#d6a86e', dark: '#a57a4e', deep: '#6e4e3c', line: '#4a3330' },
      water: { hi: '#fff4ff', light: '#d0b8ff', mid: '#8f74e8', deep: '#4e3fb8', far: '#3b2f96' },
      fall: { light: '#ffffff', mid: '#e8dcff', dark: '#b39cf0' },
      leaf: { hi: '#fff0a8', light: '#ffd870', mid: '#f0b03c', dark: '#c47a1e', line: '#8a4e14' },
      blossom: { hi: '#fff8e0', light: '#ffe9a8', mid: '#ffcf5a', dark: '#e8a02a', line: '#a86a14' },
      bark: { light: '#a98870', dark: '#5e4442' },
      flowers: ['#ffffff', '#ffd34d', '#c9a6ff', '#ff9fd0', '#8fe3ff'],
      castle: { wall: '#fbf4ff', shade: '#dccbef', roof: '#8a66e0', roofShade: '#5a3ca8', window: '#ffd86a', gold: '#ffd56a', lit: true },
    },
  ];
  G.THEMES = THEMES;

  // ------------------------------------------------------------------
  // helpers
  // ------------------------------------------------------------------
  function ell(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); }
  function shadowBlob(ctx, x, y, rx, ry, col, a) {
    ctx.save();
    ctx.filter = 'blur(' + Math.max(1, ry * 0.5).toFixed(1) + 'px)';
    ell(ctx, x, y, rx, ry);
    ctx.fillStyle = rgba(col, a);
    ctx.fill();
    ctx.restore();
  }
  function soft(src, px) { return P.blurred(src, px); }

  // which crown a tree gets: themes can list several (autumn reds, oranges and golds; rainbow pastels) –
  // the other themes keep their old blossom-or-leaf choice (and their random sequence, so their art stays as it was)
  function crownFor(T, r, pink) {
    if (T.crowns) return T.crowns[Math.floor(r() * T.crowns.length)];
    if (T.gold) { const k = r(); return k < 0.42 ? T.blossom : k < 0.78 ? T.leaf : T.gold; }
    return pink ? T.blossom : T.leaf;
  }
  // autumn bushes come in orange, red and gold; everywhere else a bush is the theme's leaf colour
  function bushFor(T, r) {
    if (!T.gold) return T.leaf;
    const k = r();
    return k < 0.5 ? T.leaf : k < 0.78 ? T.blossom : T.gold;
  }
  G.crownFor = crownFor;
  G.bushFor = bushFor;

  // ------------------------------------------------------------------
  // cloud (cartoon cumulus)
  // ------------------------------------------------------------------
  G.cloud = function (ctx, x, y, w, h, pal, seed, o) {
    o = o || {};
    const r = P.rng(seed);
    const puffs = [];
    const nb = o.n || 4 + Math.floor(r() * 3);
    for (let i = 0; i < nb; i++) {
      const u = (i + 0.5) / nb;
      const arch = Math.sin(Math.PI * u);
      const rad = h * (0.24 + 0.24 * arch) * (0.86 + r() * 0.28);
      puffs.push({ x: (u - 0.5) * w * 0.84 + (r() - 0.5) * w * 0.03, y: -rad * 0.92 - arch * h * 0.1, r: rad });
    }
    const nc = o.crown == null ? 1 + Math.floor(r() * 2) : o.crown;
    for (let i = 0; i < nc; i++) {
      const rad = h * (0.33 + r() * 0.1);
      puffs.push({ x: (r() - 0.5) * w * 0.32, y: -h + rad, r: rad });
    }
    const pad = Math.ceil(h * 0.25) + 6;
    const Lw = Math.ceil(w + pad * 2), Lh = Math.ceil(h * 1.1 + pad * 2);
    const ox = Lw / 2, oy = Lh - pad;
    const L = P.layer(Lw, Lh), c = L.getContext('2d');
    const union = (dy, k) => {
      c.beginPath();
      for (const p of puffs) { c.moveTo(ox + p.x + p.r * k, oy + p.y + dy); c.arc(ox + p.x, oy + p.y + dy, p.r * k, 0, TAU); }
      c.rect(ox - w * 0.42, oy - h * 0.3 + dy, w * 0.84, h * 0.3);
    };
    c.save();
    c.beginPath(); c.rect(0, 0, Lw, oy); c.clip();
    union(0, 1);
    const g = c.createLinearGradient(0, oy - h, 0, oy);
    g.addColorStop(0, pal.light); g.addColorStop(0.55, pal.mid); g.addColorStop(1, pal.shade);
    c.fillStyle = g; c.fill();
    // bottom shadow band
    c.save(); union(0, 1); c.clip();
    const by = oy - h * (o.shadow || 0.3);
    c.beginPath(); c.moveTo(ox - w, oy + 5);
    const waves = nb * 0.9;
    for (let i = 0; i <= 48; i++) {
      const u = i / 48;
      c.lineTo(ox - w * 0.5 + u * w, by - Math.abs(Math.sin(u * Math.PI * waves + 0.4)) * h * 0.08);
    }
    c.lineTo(ox + w, oy + 5); c.closePath();
    const sg = c.createLinearGradient(0, by - h * 0.08, 0, oy);
    sg.addColorStop(0, rgba(pal.deep, 0.18)); sg.addColorStop(0.4, rgba(pal.deep, 0.42)); sg.addColorStop(1, rgba(pal.deep, 0.55));
    c.fillStyle = sg; c.fill();
    // highlights
    for (const p of puffs) {
      if (p.y > -h * 0.4) continue;
      P.softDab(c, ox + p.x - p.r * 0.28, oy + p.y - p.r * 0.32, p.r * 0.85, '#ffffff', 0.7, 0.3);
    }
    c.restore();
    c.restore();
    // fade the flat base softly instead of a hard cut
    c.globalCompositeOperation = 'destination-out';
    const fg = c.createLinearGradient(0, oy - h * 0.16, 0, oy);
    fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,0.85)');
    c.fillStyle = fg; c.fillRect(0, oy - h * 0.16, Lw, h * 0.16 + 2);
    c.globalCompositeOperation = 'source-over';
    const B = soft(c.canvas, Math.max(0.5, h * 0.008));
    let out = B;
    if (o.tint) out = P.tint(B, o.tint[0], o.tint[1]);
    ctx.drawImage(out, x - ox, y - oy);
    return { canvas: out, ox, oy, w: Lw, h: Lh };
  };

  // ------------------------------------------------------------------
  // foliage: bush (cartoon lobes) and tree
  // ------------------------------------------------------------------
  G.bush = function (ctx, x, y, w, h, pal, seed, o) {
    o = o || {};
    const r = P.rng(seed);
    const lobes = [];
    const n = o.n || 3 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0.5 : i / (n - 1);
      const arch = Math.sin(Math.PI * (0.12 + 0.76 * u));
      const rad = h * (0.3 + 0.2 * arch) * (0.88 + r() * 0.24);
      lobes.push({ x: x + (u - 0.5) * Math.max(0, w - rad * 1.7), y: y - rad * 0.95 - arch * h * 0.18, r: rad });
    }
    if (o.top !== false) lobes.push({ x: x + (r() - 0.5) * w * 0.18, y: y - h + h * 0.34, r: h * 0.34 });
    lobes.sort((a, b) => a.y - b.y);
    shadowBlob(ctx, x, y - h * 0.02, w * 0.56, h * 0.13, pal.line, 0.45);
    const union = () => { ctx.beginPath(); for (const l of lobes) { ctx.moveTo(l.x + l.r, l.y); ctx.arc(l.x, l.y, l.r, 0, TAU); } };
    union();
    ctx.lineJoin = 'round';
    ctx.lineWidth = o.lw || Math.max(1.5, h * 0.035);
    ctx.strokeStyle = rgba(pal.line, 0.85);
    ctx.stroke();
    ctx.fillStyle = pal.dark;
    ctx.fill();
    ctx.save();
    union(); ctx.clip();
    for (const l of lobes) {
      ctx.beginPath();
      ctx.arc(l.x - l.r * 0.1, l.y - l.r * 0.14, l.r * 0.88, 0, TAU);
      const g = ctx.createRadialGradient(l.x - l.r * 0.38, l.y - l.r * 0.46, l.r * 0.06, l.x - l.r * 0.1, l.y - l.r * 0.1, l.r * 0.95);
      g.addColorStop(0, pal.hi); g.addColorStop(0.4, pal.light); g.addColorStop(1, pal.mid);
      ctx.fillStyle = g; ctx.fill();
    }
    // a few leaf ticks for texture
    ctx.strokeStyle = rgba(pal.dark, 0.5);
    ctx.lineWidth = Math.max(1, h * 0.02);
    ctx.lineCap = 'round';
    for (let i = 0; i < n * 3; i++) {
      const l = lobes[Math.floor(r() * lobes.length)];
      const a = -Math.PI * (0.1 + r() * 0.8), rr = l.r * (0.35 + r() * 0.4);
      const px = l.x + Math.cos(a) * rr, py = l.y + Math.sin(a) * rr;
      ctx.beginPath(); ctx.arc(px, py, l.r * 0.16, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    }
    ctx.restore();
    if (o.flowers) {
      for (let i = 0; i < o.flowers.n; i++) {
        const l = lobes[Math.floor(r() * lobes.length)];
        const a = -Math.PI * (0.05 + r() * 0.9), rr = l.r * r() * 0.75;
        G.flower(ctx, l.x + Math.cos(a) * rr, l.y + Math.sin(a) * rr, o.flowers.size * (0.75 + r() * 0.5), o.flowers.colors[Math.floor(r() * o.flowers.colors.length)], r() * TAU, true);
      }
    }
    return lobes;
  };

  G.tree = function (ctx, x, y, s, pal, seed, o) {
    o = o || {};
    const r = P.rng(seed);
    shadowBlob(ctx, x, y, s * 0.32, s * 0.07, pal.leaf.line, 0.45);
    // trunk
    const lean = (r() - 0.5) * s * 0.12;
    ctx.save();
    ctx.lineCap = 'round';
    const tg = ctx.createLinearGradient(x - s * 0.07, 0, x + s * 0.07, 0);
    tg.addColorStop(0, pal.bark.light); tg.addColorStop(1, pal.bark.dark);
    ctx.strokeStyle = tg;
    ctx.lineWidth = s * 0.1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x - s * 0.04, y - s * 0.2, x + lean, y - s * 0.36, x + lean, y - s * 0.56); ctx.stroke();
    ctx.lineWidth = s * 0.05;
    ctx.beginPath(); ctx.moveTo(x + lean * 0.6, y - s * 0.38); ctx.quadraticCurveTo(x + s * 0.16, y - s * 0.46, x + s * 0.24, y - s * 0.62); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + lean * 0.5, y - s * 0.34); ctx.quadraticCurveTo(x - s * 0.14, y - s * 0.42, x - s * 0.22, y - s * 0.58); ctx.stroke();
    ctx.restore();
    // crown: ring of lobes + centre
    const cx = x + lean, cy = y - s * 0.78;
    const crown = pal.crown;
    const lobes = [];
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + r() * 0.3;
      lobes.push({ x: cx + Math.cos(a) * s * 0.32, y: cy + Math.sin(a) * s * 0.22, r: s * (0.2 + r() * 0.06) });
    }
    lobes.push({ x: cx, y: cy - s * 0.08, r: s * 0.3 });
    lobes.sort((a, b) => a.y - b.y);
    const union = () => { ctx.beginPath(); for (const l of lobes) { ctx.moveTo(l.x + l.r, l.y); ctx.arc(l.x, l.y, l.r, 0, TAU); } };
    union();
    ctx.lineWidth = Math.max(1.5, s * 0.022);
    ctx.strokeStyle = rgba(crown.line, 0.85);
    ctx.stroke();
    ctx.fillStyle = crown.dark;
    ctx.fill();
    ctx.save(); union(); ctx.clip();
    for (const l of lobes) {
      ctx.beginPath(); ctx.arc(l.x - l.r * 0.1, l.y - l.r * 0.14, l.r * 0.88, 0, TAU);
      const g = ctx.createRadialGradient(l.x - l.r * 0.38, l.y - l.r * 0.46, l.r * 0.06, l.x - l.r * 0.1, l.y - l.r * 0.1, l.r * 0.95);
      g.addColorStop(0, crown.hi); g.addColorStop(0.4, crown.light); g.addColorStop(1, crown.mid);
      ctx.fillStyle = g; ctx.fill();
    }
    ctx.restore();
    // blossoms / sparkle dots – or, on an autumn tree, little leaves in the crown's lighter shades
    const dots = o.dots == null ? 26 : o.dots;
    const leafPal = o.leafy ? { light: crown.hi, mid: crown.light, dark: crown.mid, line: crown.dark } : null;
    for (let i = 0; i < dots; i++) {
      const l = lobes[Math.floor(r() * lobes.length)];
      const a = r() * TAU, rr = l.r * Math.sqrt(r()) * 0.8;
      const px = l.x + Math.cos(a) * rr, py = l.y + Math.sin(a) * rr;
      if (leafPal) { G.fallenLeaf(ctx, px, py, s * (0.035 + r() * 0.02), leafPal, r() * TAU); continue; }
      ctx.fillStyle = r() > 0.4 ? '#ffffff' : crown.hi;
      ctx.beginPath(); ctx.arc(px, py, s * (0.012 + r() * 0.012), 0, TAU); ctx.fill();
    }
  };

  // ------------------------------------------------------------------
  // flowers & small decor
  // ------------------------------------------------------------------
  G.flower = function (ctx, x, y, s, col, rot, noShadow) {
    if (!noShadow) shadowBlob(ctx, x + s * 0.1, y + s * 0.45, s * 0.9, s * 0.3, '#1e4a28', 0.35);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.scale(1, 0.84);
    const edge = mix(col, '#7a4a6a', 0.35);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * s * 0.52, Math.sin(a) * s * 0.52, s * 0.46, s * 0.36, a, 0, TAU);
      ctx.fillStyle = col; ctx.fill();
      ctx.lineWidth = Math.max(0.8, s * 0.08); ctx.strokeStyle = rgba(edge, 0.55); ctx.stroke();
    }
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5, s * 0.36, s * 0.27, a, 0, TAU);
      ctx.fillStyle = col; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, 0, s * 0.26, 0, TAU);
    ctx.fillStyle = col === '#ffe27a' || col === '#ffd66b' ? '#ff9fca' : '#ffcf45'; ctx.fill();
    ctx.beginPath(); ctx.arc(-s * 0.07, -s * 0.07, s * 0.09, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
    ctx.restore();
  };

  G.tuft = function (ctx, x, y, s, pal) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = pal.dark;
    ctx.lineWidth = Math.max(1, s * 0.16);
    for (const b of [[-0.5, -0.9, -0.2], [0, -1.15, 0], [0.5, -0.9, 0.2]]) {
      ctx.beginPath(); ctx.moveTo(x + b[2] * s * 0.4, y); ctx.quadraticCurveTo(x + b[0] * s * 0.3, y - s * 0.6, x + b[0] * s, y + b[1] * s); ctx.stroke();
    }
    ctx.restore();
  };

  G.stone = function (ctx, x, y, s, pal) {
    shadowBlob(ctx, x + s * 0.15, y + s * 0.35, s * 1.25, s * 0.42, pal.line, 0.4);
    ctx.beginPath();
    ctx.moveTo(x - s * 1.2, y + s * 0.3);
    ctx.bezierCurveTo(x - s * 1.25, y - s * 0.55, x - s * 0.3, y - s * 0.95, x + s * 0.35, y - s * 0.8);
    ctx.bezierCurveTo(x + s * 1.1, y - s * 0.6, x + s * 1.3, y + s * 0.1, x + s * 1.05, y + s * 0.35);
    ctx.quadraticCurveTo(x, y + s * 0.6, x - s * 1.2, y + s * 0.3);
    ctx.closePath();
    const g = ctx.createLinearGradient(x - s, y - s, x + s * 0.8, y + s * 0.6);
    g.addColorStop(0, '#f6f0f8'); g.addColorStop(0.55, '#cbc0d8'); g.addColorStop(1, '#9387a8');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.12); ctx.strokeStyle = 'rgba(90,70,110,0.55)'; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x - s * 0.35, y - s * 0.45, s * 0.38, s * 0.16, -0.3, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
  };

  G.mushroom = function (ctx, x, y, s) {
    shadowBlob(ctx, x, y, s * 0.7, s * 0.22, '#1e4a28', 0.35);
    const sg = ctx.createLinearGradient(x - s * 0.2, 0, x + s * 0.2, 0); sg.addColorStop(0, '#fffaf2'); sg.addColorStop(1, '#e6d4c6');
    ctx.fillStyle = sg;
    P.circle(ctx, 0, 0, 0);
    ctx.beginPath(); ctx.moveTo(x - s * 0.17, y); ctx.lineTo(x - s * 0.14, y - s * 0.6); ctx.lineTo(x + s * 0.14, y - s * 0.6); ctx.lineTo(x + s * 0.17, y); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y - s * 0.6, s * 0.56, s * 0.42, 0, Math.PI, 0); ctx.quadraticCurveTo(x, y - s * 0.5, x - s * 0.56, y - s * 0.6); ctx.closePath();
    const cg = ctx.createRadialGradient(x - s * 0.22, y - s * 0.9, s * 0.04, x, y - s * 0.65, s * 0.6); cg.addColorStop(0, '#ffa6ba'); cg.addColorStop(1, '#e44a72');
    ctx.fillStyle = cg; ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.07); ctx.strokeStyle = 'rgba(150,40,80,0.6)'; ctx.stroke();
    ctx.fillStyle = '#ffffff';
    for (const d of [[-0.26, -0.78, 0.09], [0.1, -0.9, 0.11], [0.3, -0.72, 0.07]]) { ctx.beginPath(); ctx.arc(x + d[0] * s, y + d[1] * s, d[2] * s, 0, TAU); ctx.fill(); }
  };

  // a maple leaf (unit size, tip up): five rounded lobes and a little stem – the autumn world's signature
  const MAPLE = [[220, 0.3], [252, 0.64], [280, 0.44], [308, 0.92], [334, 0.47], [0, 1], [26, 0.47], [52, 0.92], [80, 0.44], [108, 0.64], [140, 0.3], [180, 0.2]];
  G.maplePath = function (ctx, s) {
    ctx.beginPath();
    MAPLE.forEach((p, i) => {
      const a = (p[0] * Math.PI) / 180, x = Math.sin(a) * p[1] * s, y = -Math.cos(a) * p[1] * s + s * 0.12;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.closePath();
  };
  // a fallen leaf lying in the grass (squashed by the camera tilt)
  G.fallenLeaf = function (ctx, x, y, s, pal, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.62);
    ctx.rotate(rot || 0);
    ctx.lineJoin = 'round';
    G.maplePath(ctx, s);
    const g = ctx.createLinearGradient(-s, -s, s, s);
    g.addColorStop(0, pal.light); g.addColorStop(0.6, pal.mid); g.addColorStop(1, pal.dark);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(0.8, s * 0.1); ctx.strokeStyle = rgba(pal.line, 0.7); ctx.stroke();
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.6, s * 0.07); ctx.strokeStyle = rgba(pal.dark, 0.8);
    ctx.beginPath(); ctx.moveTo(0, s * 0.45); ctx.lineTo(0, -s * 0.7); ctx.moveTo(0, 0); ctx.lineTo(-s * 0.5, -s * 0.42); ctx.moveTo(0, 0); ctx.lineTo(s * 0.5, -s * 0.42); ctx.stroke();
    ctx.restore();
  };
  // a round pumpkin with a curly stem (autumn props on the banks)
  G.pumpkin = function (ctx, x, y, s, col) {
    const c = col || { hi: '#ffd08a', mid: '#f48a2c', dark: '#c8581a', line: '#86340f' };
    shadowBlob(ctx, x + s * 0.08, y, s * 1.05, s * 0.3, '#4a2410', 0.4);
    const lobes = [[-0.62, 0.3], [0.62, 0.3], [-0.32, 0.4], [0.32, 0.4], [0, 0.44]];
    for (const l of lobes) {
      ctx.beginPath(); ctx.ellipse(x + l[0] * s, y - s * 0.5, s * l[1], s * 0.5, 0, 0, TAU);
      const g = ctx.createRadialGradient(x + l[0] * s - s * 0.15, y - s * 0.75, s * 0.05, x + l[0] * s, y - s * 0.45, s * 0.6);
      g.addColorStop(0, c.hi); g.addColorStop(0.5, c.mid); g.addColorStop(1, c.dark);
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = Math.max(1, s * 0.06); ctx.strokeStyle = rgba(c.line, 0.65); ctx.stroke();
    }
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y - s * 0.9); ctx.quadraticCurveTo(x + s * 0.06, y - s * 1.12, x + s * 0.2, y - s * 1.2);
    ctx.lineWidth = s * 0.16; ctx.strokeStyle = '#6f8a32'; ctx.stroke();
    ctx.lineWidth = s * 0.05; ctx.strokeStyle = '#8fb04a';
    ctx.beginPath(); ctx.moveTo(x + s * 0.06, y - s * 0.98); ctx.bezierCurveTo(x - s * 0.3, y - s * 1.2, x - s * 0.4, y - s * 0.9, x - s * 0.22, y - s * 0.86); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x - s * 0.3, y - s * 0.72, s * 0.12, s * 0.07, -0.5, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
  };
  // a heap of fallen leaves at the foot of a tree
  G.leafPile = function (ctx, x, y, s, T, seed) {
    const r = P.rng(seed);
    shadowBlob(ctx, x, y, s * 1.2, s * 0.3, T.rock.line, 0.3);
    const pals = [T.leaf, T.blossom, T.gold || T.leaf];
    for (let i = 0; i < 26; i++) {
      const a = r() * TAU, rr = Math.sqrt(r());
      G.fallenLeaf(ctx, x + Math.cos(a) * s * 1.05 * rr, y + Math.sin(a) * s * 0.32 * rr - (1 - rr) * s * 0.25, s * (0.2 + r() * 0.12), pals[Math.floor(r() * pals.length)], r() * TAU);
    }
  };

  // ------------------------------------------------------------------
  // waterfall ribbon (static base; motion is added at runtime)
  // ------------------------------------------------------------------
  G.fall = function (ctx, x, y0, w0, w1, h, pal, seed, o) {
    o = o || {};
    const r = P.rng(seed);
    const Wl = Math.ceil(Math.max(w0, w1) * 1.4 + 10), Hl = Math.ceil(h + 10);
    const L = P.layer(Wl, Hl), c = L.getContext('2d');
    const ox = Wl / 2;
    const path = () => {
      c.beginPath();
      c.moveTo(ox - w0 / 2, 0);
      c.lineTo(ox + w0 / 2, 0);
      c.bezierCurveTo(ox + w0 / 2 + 2, h * 0.3, ox + w1 / 2, h * 0.6, ox + w1 / 2, h);
      c.lineTo(ox - w1 / 2, h);
      c.bezierCurveTo(ox - w1 / 2, h * 0.6, ox - w0 / 2 - 2, h * 0.3, ox - w0 / 2, 0);
      c.closePath();
    };
    path();
    const g = c.createLinearGradient(ox - w1 / 2, 0, ox + w1 / 2, 0);
    g.addColorStop(0, pal.dark); g.addColorStop(0.22, pal.mid); g.addColorStop(0.5, pal.light); g.addColorStop(0.78, pal.mid); g.addColorStop(1, pal.dark);
    c.fillStyle = g; c.globalAlpha = 0.92; c.fill(); c.globalAlpha = 1;
    c.save(); path(); c.clip();
    // long soft highlight streaks
    c.lineCap = 'round';
    const n = Math.max(3, Math.round(w1 / 14));
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      const xx = ox + (f - 0.5) * w0 * 0.9;
      c.beginPath();
      c.moveTo(xx, -5);
      c.bezierCurveTo(xx, h * 0.3, xx + (f - 0.5) * (w1 - w0) * 0.6, h * 0.6, ox + (f - 0.5) * w1 * 0.9, h + 5);
      c.lineWidth = Math.max(1.5, w0 * (0.04 + r() * 0.05));
      c.strokeStyle = rgba('#ffffff', 0.35 + r() * 0.3);
      c.stroke();
    }
    c.restore();
    if (o.fade) {
      c.globalCompositeOperation = 'destination-out';
      const fg = c.createLinearGradient(0, h * (1 - o.fade), 0, h);
      fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,1)');
      c.fillStyle = fg; c.fillRect(0, h * (1 - o.fade), Wl, h * o.fade + 10);
      c.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(L, x - ox, y0);
    // foam lip
    for (let i = 0; i < 6; i++) {
      const fx = x - w0 * 0.45 + (i / 5) * w0 * 0.9;
      const rr = w0 * (0.13 + r() * 0.06);
      ctx.beginPath(); ctx.arc(fx, y0 + rr * 0.3, rr, 0, TAU);
      ctx.fillStyle = '#ffffff'; ctx.fill();
    }
    if (o.splash) {
      for (let i = 0; i < 10; i++) {
        const fx = x + (r() - 0.5) * w1 * 1.5, fy = y0 + h - r() * w1 * 0.3;
        ctx.beginPath(); ctx.arc(fx, fy, w1 * (0.12 + r() * 0.16), 0, TAU);
        ctx.fillStyle = rgba('#ffffff', 0.85); ctx.fill();
      }
    }
    return { x, y: y0, w0, w1, h };
  };

  // ------------------------------------------------------------------
  // rock face: smooth gradient, ledges of layered rock, pebbles sitting on the ledges
  // pathFn(ctx) draws the silhouette; arc(y) = curvature for strata
  // ------------------------------------------------------------------
  // a pebble lodged in the rock: a whole rounded stone with its own light (top left), a darker underside
  // and a soft shadow on the rock below it
  function cliffPebble(ctx, x, y, s, pal, rot, k) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const path = () => {
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * TAU;
        const rr = s * (1 + 0.1 * Math.sin(a * 2 + k) + 0.05 * Math.sin(a * 3 + k * 2.3));
        const px = Math.cos(a) * rr * 1.18, py = Math.sin(a) * rr * 0.78;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
    };
    // the shadow it casts on the rock (light from the top left)
    ctx.save();
    ctx.filter = 'blur(' + Math.max(1, s * 0.3).toFixed(1) + 'px)';
    ctx.translate(s * 0.22, s * 0.38);
    path();
    ctx.fillStyle = rgba(pal.deep, 0.55);
    ctx.fill();
    ctx.restore();
    path();
    // a cooler, greyer tone than the rock around it, so it reads as a stone and not as a lump of earth
    const stone = mix(pal.light, '#d9d3e6', 0.45);
    const g = ctx.createRadialGradient(-s * 0.5, -s * 0.45, s * 0.05, -s * 0.15, -s * 0.05, s * 1.4);
    g.addColorStop(0, mix(stone, '#ffffff', 0.55));
    g.addColorStop(0.42, stone);
    g.addColorStop(1, mix(mix(pal.mid, '#9c93b4', 0.4), pal.dark, 0.25));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.13);
    ctx.strokeStyle = rgba(pal.line, 0.75);
    ctx.stroke();
    ctx.save();
    path();
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(s * 0.35, s * 0.55, s * 1.3, s * 0.55, -0.15, 0, TAU);
    ctx.fillStyle = rgba(pal.dark, 0.35);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(-s * 0.42, -s * 0.36, s * 0.34, s * 0.14, -0.35, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
    ctx.restore();
  }

  G.rockFace = function (ctx, pathFn, bb, pal, seed, o) {
    o = o || {};
    const r = P.rng(seed);
    ctx.save();
    pathFn(ctx);
    const g = ctx.createLinearGradient(bb.x, 0, bb.x + bb.w, 0);
    g.addColorStop(0, pal.light); g.addColorStop(0.35, pal.mid); g.addColorStop(0.75, pal.dark); g.addColorStop(1, pal.deep);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineJoin = 'round';
    if (o.outline !== false) { ctx.lineWidth = o.lw || 4; ctx.strokeStyle = rgba(pal.line, 0.7); ctx.stroke(); }
    ctx.clip();
    // vertical darkening towards the bottom
    const vg = ctx.createLinearGradient(0, bb.y, 0, bb.y + bb.h);
    vg.addColorStop(0, rgba(pal.deep, 0)); vg.addColorStop(1, rgba(pal.deep, 0.55));
    ctx.fillStyle = vg; ctx.fillRect(bb.x - 10, bb.y, bb.w + 20, bb.h + 10);
    // ledges of layered rock following the front curvature: each one a lit lip over a soft shadow, broken into
    // pieces of different lengths that taper at their ends, so the layers read as rock and not as ruled lines
    const strata = o.strata || 5;
    const rl = P.rng(seed + 77);
    const curves = [];
    for (let k = 1; k <= strata; k++) {
      const off = (k / (strata + 1)) * bb.h * 0.85;
      const curve = (t) => (o.arc ? o.arc(t, off) : bb.y + off + Math.sin(t * Math.PI) * bb.h * 0.08) + Math.sin(t * 9 + k) * bb.h * 0.006;
      curves.push(curve);
      const th = Math.max(3, bb.h * 0.03);
      let t = -0.02 + rl() * 0.05;
      while (t < 1) {
        const len = 0.14 + rl() * 0.3, t1 = Math.min(1.02, t + len);
        const w = th * (0.7 + rl() * 0.6);
        // the shadow under the lip
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) {
          const u = i / 24, tt = t + (t1 - t) * u, px = bb.x + tt * bb.w;
          const py = curve(tt) + w * 0.35;
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        for (let i = 24; i >= 0; i--) {
          const u = i / 24, tt = t + (t1 - t) * u, px = bb.x + tt * bb.w;
          ctx.lineTo(px, curve(tt) + w * 0.35 + w * 0.75 * Math.pow(Math.sin(u * Math.PI), 0.6));
        }
        ctx.closePath();
        ctx.fillStyle = rgba(pal.deep, 0.3);
        ctx.fill();
        // the lit lip
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) {
          const u = i / 24, tt = t + (t1 - t) * u, px = bb.x + tt * bb.w;
          const py = curve(tt) - w * 0.5 * Math.pow(Math.sin(u * Math.PI), 0.6);
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        for (let i = 24; i >= 0; i--) {
          const u = i / 24, tt = t + (t1 - t) * u, px = bb.x + tt * bb.w;
          ctx.lineTo(px, curve(tt) + w * 0.35 * Math.pow(Math.sin(u * Math.PI), 0.6));
        }
        ctx.closePath();
        ctx.fillStyle = rgba(pal.hi, 0.36);
        ctx.fill();
        t = t1 + 0.01 + rl() * 0.05;
      }
    }
    // gold veins through the rock (the marble cliffs of Rainbow Heights)
    if (pal.vein) {
      ctx.lineCap = 'round';
      for (let k = 0; k < 4; k++) {
        const off = (0.16 + k * 0.21 + r() * 0.05) * bb.h * 0.85;
        const curve = (t) => o.arc ? o.arc(t, off) : bb.y + off + Math.sin(t * Math.PI) * bb.h * 0.08;
        const ph = r() * 6;
        ctx.beginPath();
        for (let i = 0; i <= 64; i++) {
          const t = i / 64;
          const px = bb.x + t * bb.w, py = curve(t) + Math.sin(t * 15 + ph) * bb.h * 0.014;
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.lineWidth = Math.max(1.4, bb.h * 0.008); ctx.strokeStyle = rgba(pal.vein, 0.8); ctx.stroke();
        ctx.lineWidth = Math.max(0.6, bb.h * 0.0026); ctx.strokeStyle = rgba('#ffffff', 0.75); ctx.stroke();
      }
    }
    // pebbles: whole rounded stones resting on the ledges, alone or in twos and threes (they used to be flat
    // half-domes that looked printed on); only where the rock is wide enough to hold them
    const nb = o.boulders == null ? 10 : o.boulders;
    const rp = P.rng(seed + 91), placed = [];
    for (let i = 0, tries = 0; i < nb && tries < nb * 16; tries++) {
      const t = 0.08 + rp() * 0.84;
      const k = Math.floor(rp() * strata);
      const curve = curves[k];
      const s = bb.h * (0.016 + rp() * 0.016);
      const px = bb.x + t * bb.w, py = curve(t) - s * 0.62;
      if (o.avoid && o.avoid.some((q) => px + s * 1.8 > q[0] && px - s * 1.8 < q[1])) continue; // not behind a waterfall
      if (placed.some((q) => Math.hypot(q[0] - px, (q[1] - py) * 1.6) < (q[2] + s) * 2.4)) continue; // spread out
      pathFn(ctx);
      if (!ctx.isPointInPath(px - s * 2.4, py) || !ctx.isPointInPath(px + s * 2.4, py) || !ctx.isPointInPath(px, py + s * 3)) continue;
      const n = 1 + Math.floor(rp() * 3);
      const group = [[0, 0, 1]];
      if (n > 1) group.push([s * (1.9 + rp() * 0.4), s * 0.22, 0.55 + rp() * 0.15]);
      if (n > 2) group.push([-s * (1.5 + rp() * 0.4), s * 0.3, 0.45 + rp() * 0.15]);
      group.sort((a, b) => a[2] - b[2]);
      for (const q of group) cliffPebble(ctx, px + q[0], py + q[1] + s * (1 - q[2]) * 0.62, s * q[2], pal, (rp() - 0.5) * 0.3, rp() * 6);
      placed.push([px, py, s]);
      i++;
    }
    ctx.restore();
  };
  // ------------------------------------------------------------------
  // grass overhang scallops along an ellipse arc (a0..a1)
  // ------------------------------------------------------------------
  function scallops(ctx, cx, cy, rx, ry, a0, a1, n, size, pal, seed) {
    const r = P.rng(seed);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, s: size * (0.75 + r() * 0.5) });
    }
    // dark underside
    ctx.beginPath();
    for (const p of pts) { ctx.moveTo(p.x + p.s, p.y + p.s * 0.35); ctx.arc(p.x, p.y + p.s * 0.35, p.s, 0, TAU); }
    ctx.fillStyle = pal.deep; ctx.fill();
    ctx.beginPath();
    for (const p of pts) { ctx.moveTo(p.x + p.s, p.y); ctx.arc(p.x, p.y, p.s, 0, TAU); }
    ctx.fillStyle = pal.dark; ctx.fill();
    for (const p of pts) {
      ctx.beginPath(); ctx.arc(p.x - p.s * 0.08, p.y - p.s * 0.14, p.s * 0.82, 0, TAU);
      const g = ctx.createRadialGradient(p.x - p.s * 0.4, p.y - p.s * 0.45, p.s * 0.05, p.x, p.y, p.s);
      g.addColorStop(0, pal.light); g.addColorStop(1, pal.mid);
      ctx.fillStyle = g; ctx.fill();
    }
  }

  // ------------------------------------------------------------------
  // floating island (background) – grass top, rock underside, falls, trees
  // x,y = centre of the top surface, w = width
  // ------------------------------------------------------------------
  G.floatIsland = function (ctx, x, y, w, T, seed, o) {
    o = o || {};
    const r = P.rng(seed);
    const ry = w * 0.2;
    const depth = w * (o.depth || 0.72);
    // underside
    const path = (c) => {
      c.beginPath();
      c.moveTo(x - w / 2, y);
      c.ellipse(x, y, w / 2, ry, 0, Math.PI, 0, true);
      c.bezierCurveTo(x + w * 0.5, y + depth * 0.35, x + w * 0.28, y + depth * 0.6, x + w * 0.12, y + depth * 0.82);
      c.quadraticCurveTo(x + w * 0.02, y + depth * 1.02, x - w * 0.06, y + depth * 0.86);
      c.bezierCurveTo(x - w * 0.24, y + depth * 0.66, x - w * 0.5, y + depth * 0.4, x - w / 2, y);
      c.closePath();
    };
    const nf = o.falls == null ? 1 : o.falls;
    const fallX = (i) => x + w * (i === 0 ? 0.2 : i === 1 ? -0.26 : 0.05);
    const avoid = [];
    for (let i = 0; i < nf; i++) avoid.push([fallX(i) - w * 0.045, fallX(i) + w * 0.045]);
    G.rockFace(ctx, path, { x: x - w / 2, y: y, w, h: depth }, T.rock, seed + 1, {
      strata: 3, boulders: 4, outline: o.outline, lw: Math.max(2, w * 0.006), avoid,
      arc: (t, off) => y + ry * Math.sin(t * Math.PI) * 0.9 + off * 0.8,
    });
    const falls = [];
    for (let i = 0; i < nf; i++) {
      const fx = fallX(i);
      const fy = y + ry * Math.sin(Math.acos(P.clamp((fx - x) / (w / 2), -1, 1))) - 3;
      const f = G.fall(ctx, fx, fy, w * 0.05, w * 0.075, depth * (0.9 + r() * 0.5), T.fall, seed + 10 + i, { fade: 0.55 });
      falls.push(f);
    }
    // grass top
    ell(ctx, x, y, w / 2, ry);
    const gg = ctx.createLinearGradient(x - w / 2, y - ry, x + w / 2, y + ry);
    gg.addColorStop(0, T.grass.light); gg.addColorStop(0.6, T.grass.mid); gg.addColorStop(1, T.grass.dark);
    ctx.fillStyle = gg; ctx.fill();
    scallops(ctx, x, y, w / 2, ry, 0.05, Math.PI - 0.05, Math.round(w / 26), w * 0.028, T.grass, seed + 3);
    ctx.save(); ell(ctx, x - w * 0.08, y - ry * 0.25, w * 0.32, ry * 0.45); ctx.fillStyle = rgba(T.grass.hi, 0.35); ctx.fill(); ctx.restore();
    // vegetation
    const items = [];
    const nt = o.trees == null ? 2 : o.trees;
    for (let i = 0; i < nt; i++) items.push({ kind: 'tree', x: x + (r() - 0.5) * w * 0.55, y: y + (r() - 0.6) * ry * 0.8, s: w * (0.22 + r() * 0.12), pink: r() > 0.35 });
    const nbu = o.bushes == null ? 3 : o.bushes;
    for (let i = 0; i < nbu; i++) items.push({ kind: 'bush', x: x + (r() - 0.5) * w * 0.75, y: y + (r() - 0.3) * ry * 0.8, s: w * (0.09 + r() * 0.05) });
    items.sort((a, b) => a.y - b.y);
    if (T.litter) {
      // autumn: the little islands are strewn with leaves too, and one has a pumpkin
      const pals = [T.leaf, T.blossom, T.gold];
      for (let i = 0; i < 14; i++) G.fallenLeaf(ctx, x + (r() - 0.5) * w * 0.8, y + (r() - 0.5) * ry * 1.1, w * 0.022, pals[Math.floor(r() * 3)], r() * TAU);
      if (r() > 0.4) G.pumpkin(ctx, x + (r() - 0.5) * w * 0.5, y + ry * 0.25, w * 0.05);
    }
    for (const it of items) {
      if (it.kind === 'tree') G.tree(ctx, it.x, it.y, it.s, { bark: T.bark, crown: crownFor(T, r, it.pink), leaf: T.leaf }, Math.floor(r() * 1e6), { dots: it.pink ? 22 : 10, leafy: !!T.litter });
      else G.bush(ctx, it.x, it.y, it.s * 1.6, it.s, bushFor(T, r), Math.floor(r() * 1e6), { flowers: { n: 4, size: it.s * 0.14, colors: T.flowers } });
    }
    return { falls };
  };

  // ------------------------------------------------------------------
  // castle (pretty, slender fairy castle)
  // ------------------------------------------------------------------
  G.castle = function (ctx, x, y, s, T) {
    const C = T.castle;
    function tower(tx, tw, th, rh, roofCol, nwin) {
      const top = y - th;
      const g = ctx.createLinearGradient(tx - tw / 2, 0, tx + tw / 2, 0);
      g.addColorStop(0, mix(C.wall, '#ffffff', 0.5)); g.addColorStop(0.4, C.wall); g.addColorStop(1, C.shade);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(tx - tw / 2, y); ctx.lineTo(tx - tw / 2, top); ctx.lineTo(tx + tw / 2, top); ctx.lineTo(tx + tw / 2, y); ctx.closePath(); ctx.fill();
      ctx.lineWidth = Math.max(1, tw * 0.035); ctx.strokeStyle = rgba(C.roofShade, 0.45); ctx.stroke();
      // cornice ring
      ctx.beginPath(); ctx.ellipse(tx, top + tw * 0.04, tw * 0.58, tw * 0.12, 0, 0, TAU);
      ctx.fillStyle = mix(C.wall, '#ffffff', 0.4); ctx.fill(); ctx.stroke();
      for (let i = 0; i < nwin; i++) {
        const wy = top + tw * 0.5 + (i * (th - tw * 0.8)) / Math.max(1, nwin);
        const ww = tw * 0.28, wh = tw * 0.44;
        ctx.beginPath(); ctx.moveTo(tx - ww / 2, wy + wh); ctx.lineTo(tx - ww / 2, wy + ww / 2); ctx.arc(tx, wy + ww / 2, ww / 2, Math.PI, 0); ctx.lineTo(tx + ww / 2, wy + wh); ctx.closePath();
        ctx.fillStyle = C.lit ? C.window : C.window; ctx.fill();
        if (C.lit) P.softDab(ctx, tx, wy + wh * 0.5, ww * 1.6, '#ffe58a', 0.45, 0.2);
      }
      // cone roof
      const rw = tw * 0.66;
      ctx.beginPath();
      ctx.moveTo(tx - rw, top);
      ctx.quadraticCurveTo(tx - rw * 0.25, top - rh * 0.5, tx, top - rh);
      ctx.quadraticCurveTo(tx + rw * 0.25, top - rh * 0.5, tx + rw, top);
      ctx.quadraticCurveTo(tx, top + tw * 0.16, tx - rw, top);
      ctx.closePath();
      const rg = ctx.createLinearGradient(tx - rw, 0, tx + rw, 0);
      rg.addColorStop(0, mix(roofCol, '#ffffff', 0.35)); rg.addColorStop(0.45, roofCol); rg.addColorStop(1, mix(roofCol, C.roofShade, 0.7));
      ctx.fillStyle = rg; ctx.fill();
      ctx.lineWidth = Math.max(1, tw * 0.035); ctx.strokeStyle = rgba(C.roofShade, 0.7); ctx.stroke();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = rgba(C.roofShade, 0.35); ctx.lineWidth = Math.max(0.8, tw * 0.025);
      for (let k = 1; k < 5; k++) { const yy = top - rh * (k / 5) * 0.9; const half = rw * (1 - (k / 5) * 0.9); ctx.beginPath(); ctx.ellipse(tx, yy, half, half * 0.22, 0, 0.1, Math.PI - 0.1); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = C.gold; ctx.lineWidth = Math.max(1, tw * 0.05);
      ctx.beginPath(); ctx.moveTo(tx, top - rh); ctx.lineTo(tx, top - rh - tw * 0.4); ctx.stroke();
      ctx.beginPath(); ctx.arc(tx, top - rh - tw * 0.02, tw * 0.07, 0, TAU); ctx.fillStyle = C.gold; ctx.fill();
      ctx.beginPath(); ctx.moveTo(tx, top - rh - tw * 0.4); ctx.quadraticCurveTo(tx + tw * 0.3, top - rh - tw * 0.44, tx + tw * 0.44, top - rh - tw * 0.32); ctx.quadraticCurveTo(tx + tw * 0.24, top - rh - tw * 0.28, tx, top - rh - tw * 0.22); ctx.closePath();
      ctx.fillStyle = mix(roofCol, '#ffffff', 0.2); ctx.fill();
    }
    tower(x - s * 0.33, s * 0.085, s * 0.5, s * 0.22, mix(C.roof, T.fade, 0.2), 2);
    tower(x + s * 0.35, s * 0.08, s * 0.46, s * 0.21, mix(C.roof, T.fade, 0.2), 2);
    tower(x - s * 0.14, s * 0.1, s * 0.68, s * 0.27, mix(C.roof, T.fade, 0.1), 3);
    tower(x + s * 0.16, s * 0.1, s * 0.64, s * 0.26, mix(C.roof, T.fade, 0.1), 3);
    tower(x, s * 0.15, s * 0.86, s * 0.38, C.roof, 4);
    // curtain wall
    const wy = y - s * 0.2;
    const wg = ctx.createLinearGradient(0, wy, 0, y);
    wg.addColorStop(0, mix(C.wall, '#ffffff', 0.3)); wg.addColorStop(1, C.shade);
    ctx.fillStyle = wg;
    ctx.beginPath(); ctx.moveTo(x - s * 0.44, y); ctx.lineTo(x - s * 0.44, wy);
    for (let i = 0; i < 14; i++) { const xx = x - s * 0.44 + i * s * 0.0629; ctx.lineTo(xx, wy); ctx.lineTo(xx, wy - s * 0.03); ctx.lineTo(xx + s * 0.034, wy - s * 0.03); ctx.lineTo(xx + s * 0.034, wy); }
    ctx.lineTo(x + s * 0.44, wy); ctx.lineTo(x + s * 0.44, y); ctx.closePath(); ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.004); ctx.strokeStyle = rgba(C.roofShade, 0.45); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - s * 0.05, y); ctx.lineTo(x - s * 0.05, y - s * 0.08); ctx.arc(x, y - s * 0.08, s * 0.05, Math.PI, 0); ctx.lineTo(x + s * 0.05, y); ctx.closePath();
    ctx.fillStyle = mix(C.window, '#2a1428', 0.35); ctx.fill();
    tower(x - s * 0.45, s * 0.065, s * 0.3, s * 0.15, C.roof, 1);
    tower(x + s * 0.45, s * 0.065, s * 0.3, s * 0.15, C.roof, 1);
  };

  // ------------------------------------------------------------------
  // SKY
  // ------------------------------------------------------------------
  function fadedPal(pal, fade, k) {
    const o = {};
    for (const key of Object.keys(pal)) o[key] = mix(pal[key], fade, k);
    return o;
  }

  G.sky = function (T, seed) {
    const S = 1440;
    const C = P.layer(S, S), ctx = C.getContext('2d');
    const r = P.rng(seed);
    const g = ctx.createLinearGradient(0, 0, 0, S);
    for (const st of T.sky) g.addColorStop(st[0], st[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    const sx = S * T.sunX, sy = S * (T.sunY != null ? T.sunY : 0.08);
    P.softDab(ctx, sx, sy, S * 0.7, T.sun, T.moon ? 0.35 : 0.7, 0);
    if (!T.moon) P.softDab(ctx, sx, sy, S * 0.14, '#ffffff', 0.75, 0.25);
    if (T.rays) {
      const R = P.layer(S, S), rc = R.getContext('2d');
      const a0 = T.rayDir != null ? T.rayDir - 0.51 : 0.3; // the fan of rays points down-right unless the theme says otherwise
      for (let i = 0; i < 7; i++) {
        const a = a0 + i * 0.17 + r() * 0.05, len = S * 1.4, w = 0.025 + r() * 0.03;
        rc.beginPath(); rc.moveTo(sx, sy);
        rc.lineTo(sx + Math.cos(a - w) * len, sy + Math.sin(a - w) * len);
        rc.lineTo(sx + Math.cos(a + w) * len, sy + Math.sin(a + w) * len); rc.closePath();
        const rg = rc.createRadialGradient(sx, sy, 0, sx, sy, len);
        rg.addColorStop(0, rgba('#ffffff', T.rays * 2.5)); rg.addColorStop(0.55, rgba('#ffffff', T.rays * 0.7)); rg.addColorStop(1, rgba('#ffffff', 0));
        rc.fillStyle = rg; rc.fill();
      }
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(P.blurred(R, 14), 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (T.stars) {
      for (let i = 0; i < 220; i++) {
        const x = r() * S, y = r() * S * 0.62, rr = r() * 1.5 + 0.5;
        P.softDab(ctx, x, y, rr * 2.6, '#ffffff', 0.3 + r() * 0.6, 0.45);
      }
      for (let i = 0; i < 14; i++) {
        const x = r() * S, y = r() * S * 0.5, rr = 4 + r() * 6;
        ctx.save(); ctx.translate(x, y);
        ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4 - Math.PI / 2; const q = k % 2 ? rr * 0.25 : rr; if (k) ctx.lineTo(Math.cos(a) * q, Math.sin(a) * q); else ctx.moveTo(Math.cos(a) * q, Math.sin(a) * q); } ctx.closePath();
        ctx.fillStyle = '#fff6c8'; ctx.fill(); ctx.restore();
      }
    }
    if (T.moon) {
      const mx = S * 0.8, my = S * 0.12, mr = S * 0.05;
      P.softDab(ctx, mx, my, mr * 5, '#cfc4ff', 0.35, 0);
      const M = P.layer(mr * 2.4, mr * 2.4), mc = M.getContext('2d');
      P.circle(mc, mr * 1.2, mr * 1.2, mr);
      const mg = mc.createRadialGradient(mr, mr, mr * 0.1, mr * 1.2, mr * 1.2, mr);
      mg.addColorStop(0, '#fffbe8'); mg.addColorStop(1, '#f2e2b0'); mc.fillStyle = mg; mc.fill();
      mc.globalCompositeOperation = 'destination-out'; P.circle(mc, mr * 1.62, mr * 1.0, mr * 0.9); mc.fill();
      ctx.drawImage(M, mx - mr * 1.2, my - mr * 1.2);
    }
    if (T.rainbow) {
      const cols = ['#ff9aa8', '#ffc98a', '#fff08a', '#9ee6a6', '#9ccfff', '#c5a8ff'];
      const R = P.layer(S, S), rc = R.getContext('2d');
      for (let i = 0; i < cols.length; i++) {
        rc.beginPath(); rc.arc(S * 0.5, S * 0.8, S * (0.5 - i * 0.022), Math.PI, 0);
        rc.lineWidth = S * 0.024; rc.strokeStyle = rgba(cols[i], 0.42); rc.stroke();
      }
      ctx.drawImage(P.blurred(R, 5), 0, 0);
    }
    // distant floating islands (very faded)
    for (const q of [[0.12, 0.42, 0.11], [0.88, 0.38, 0.12], [0.3, 0.3, 0.06], [0.72, 0.27, 0.07]]) {
      const L = P.layer(S, S), lc = L.getContext('2d');
      G.floatIsland(lc, q[0] * S, q[1] * S, q[2] * S, T, Math.floor(r() * 1e6), { falls: 1, trees: 1, bushes: 1, outline: false });
      ctx.drawImage(P.blurred(P.tint(L, T.fade, 0.62), 1.2), 0, 0);
    }
    // cloud banks: far -> near
    const rows = [[0.5, 0.65, 0.16], [0.58, 0.5, 0.2], [0.68, 0.35, 0.26], [0.8, 0.2, 0.32]];
    for (const row of rows) {
      const y = S * row[0];
      for (let x = -S * 0.1; x < S * 1.15; x += S * (0.14 + r() * 0.12)) {
        const w = S * row[2] * (0.8 + r() * 0.5);
        G.cloud(ctx, x, y + r() * S * 0.03, w, w * (0.42 + r() * 0.12), fadedPal(T.cloud, T.fade, row[1]), Math.floor(r() * 1e6));
      }
    }
    return { canvas: C, meta: { w: S, h: S, horizon: 0.62 } };
  };

  // ------------------------------------------------------------------
  // FAR: castle on its floating island
  // ------------------------------------------------------------------
  G.far = function (T, seed) {
    const W = 1500, H = 1250;
    const C = P.layer(W, H), ctx = C.getContext('2d');
    const r = P.rng(seed);
    const ax = W / 2, ay = 760, iw = 860;
    let rainbow = null;
    if (T.rainbowFar) {
      // the rainbow of Rainbow Heights arches over the castle (painted into this layer, so it sits right behind the
      // castle on every screen shape, and the map card shows it too)
      const R = P.layer(W, H), rc = R.getContext('2d');
      const rx = ax, ry = ay + 70, rad = 670, bw = 27;
      const cols = ['#ff8aa8', '#ffb46c', '#ffe46a', '#8fe39c', '#74c2ff', '#b598ff'];
      rc.beginPath(); rc.arc(rx, ry, rad - bw * 2.5, Math.PI, TAU);
      rc.lineWidth = bw * 8; rc.strokeStyle = 'rgba(255,255,255,0.32)'; rc.stroke();
      for (let i = 0; i < cols.length; i++) {
        rc.beginPath(); rc.arc(rx, ry, rad - i * bw, Math.PI, TAU);
        rc.lineWidth = bw + 1.5; rc.strokeStyle = cols[i]; rc.stroke();
      }
      // a faint second rainbow outside the first, colours reversed – as real double rainbows do
      for (let i = 0; i < cols.length; i++) {
        rc.beginPath(); rc.arc(rx, ry, rad + 150 + i * 14, Math.PI, TAU);
        rc.lineWidth = 15; rc.strokeStyle = rgba(cols[cols.length - 1 - i], 0.28); rc.stroke();
      }
      // the feet fade into the clouds
      rc.globalCompositeOperation = 'destination-out';
      const fg = rc.createLinearGradient(0, ry - 340, 0, ry);
      fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,1)');
      rc.fillStyle = fg; rc.fillRect(0, ry - 340, W, 350);
      rc.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.92;
      ctx.drawImage(P.blurred(R, 2.5), 0, 0);
      ctx.globalAlpha = 1;
      rainbow = { x: rx, y: ry, r: rad - bw * 2.5, w: bw * 6 };
    }
    G.floatIsland(ctx, ax - 560, ay - 200, 230, T, seed + 1, { falls: 1, trees: 1, bushes: 1, outline: false });
    G.floatIsland(ctx, ax + 560, ay - 160, 250, T, seed + 2, { falls: 1, trees: 2, bushes: 1, outline: false });
    G.cloud(ctx, ax - 360, ay + 280, 520, 210, T.cloud, seed + 3);
    G.cloud(ctx, ax + 380, ay + 300, 540, 220, T.cloud, seed + 4);
    const isl = G.floatIsland(ctx, ax, ay, iw, T, seed + 5, { falls: 3, trees: 0, bushes: 0, depth: 0.6, outline: false });
    const rr = P.rng(seed + 77);
    G.tree(ctx, ax - iw * 0.4, ay + 12, 150, { bark: T.bark, crown: T.crowns || T.gold ? crownFor(T, rr, true) : T.blossom, leaf: T.leaf }, seed + 6, { dots: 26, leafy: !!T.litter });
    G.tree(ctx, ax + iw * 0.41, ay + 10, 136, { bark: T.bark, crown: T.crowns || T.gold ? crownFor(T, rr, false) : T.leaf, leaf: T.leaf }, seed + 7, { dots: T.litter ? 24 : 10, leafy: !!T.litter });
    if (T.litter) {
      for (let i = 0; i < 22; i++) G.fallenLeaf(ctx, ax + (rr() - 0.5) * iw * 0.85, ay + (rr() - 0.2) * iw * 0.12, 13, [T.leaf, T.blossom, T.gold][Math.floor(rr() * 3)], rr() * TAU);
      G.pumpkin(ctx, ax - iw * 0.3, ay + 40, 26);
      G.pumpkin(ctx, ax + iw * 0.33, ay + 44, 20);
    }
    G.castle(ctx, ax + 4, ay + 26, 600, T);
    for (const q of [[-0.25, 0.1], [0.27, 0.12], [-0.08, 0.16], [0.1, 0.17]]) {
      G.bush(ctx, ax + q[0] * iw, ay + q[1] * iw * 0.3 + 34, 120, 62, T.gold ? bushFor(T, rr) : T.leaf, seed + 40 + Math.round(q[0] * 100), { flowers: { n: 4, size: 9, colors: T.flowers } });
    }
    G.cloud(ctx, ax - 130, ay + 460, 680, 250, T.cloud, seed + 8);
    G.cloud(ctx, ax + 320, ay + 500, 520, 200, T.cloud, seed + 9);
    const out = P.blurred(P.tint(C, T.fade, 0.2), 0.6);
    const meta = { w: W, h: H, ax, ay, iw, top: ay - 26 - 600 * 1.26 };
    if (rainbow) meta.rainbow = rainbow;
    return { canvas: out, meta };
  };

  // ------------------------------------------------------------------
  // SIDE islands
  // ------------------------------------------------------------------
  G.side = function (T, seed, flip) {
    const W = 900, H = 960;
    const C = P.layer(W, H), ctx = C.getContext('2d');
    const ax = W / 2, ay = 360, iw = 560;
    G.floatIsland(ctx, ax, ay, iw, T, seed + 1, { falls: 2, trees: 2, bushes: 3, depth: 0.82, outline: false });
    G.cloud(ctx, ax + (flip ? 90 : -90), ay + iw * 0.92, 540, 200, T.cloud, seed + 7);
    const out = P.blurred(P.tint(C, T.fade, 0.12), 0.4);
    return { canvas: out, meta: { w: W, h: H, ax, ay, iw } };
  };

  // ------------------------------------------------------------------
  // CLOUD SEA (tileable)
  // ------------------------------------------------------------------
  G.cloudsea = function (T, seed) {
    const W = 2400, H = 800;
    const C = P.layer(W, H), ctx = C.getContext('2d');
    const r = P.rng(seed);
    const base = 360;
    const g = ctx.createLinearGradient(0, base, 0, H);
    g.addColorStop(0, rgba(T.cloud.mid, 0)); g.addColorStop(0.3, T.cloud.mid); g.addColorStop(1, T.cloud.shade);
    ctx.fillStyle = g; ctx.fillRect(0, base, W, H - base);
    const rows = [
      { y: 400, w: [300, 460], hk: 0.5, step: [170, 250], pal: fadedPal(T.cloud, T.cloud.shade, 0.35) },
      { y: 520, w: [380, 560], hk: 0.48, step: [210, 300], pal: fadedPal(T.cloud, T.cloud.shade, 0.15) },
      { y: 650, w: [440, 680], hk: 0.46, step: [250, 340], pal: T.cloud },
      { y: 790, w: [520, 760], hk: 0.44, step: [280, 380], pal: T.cloud },
    ];
    for (const row of rows) {
      for (let x = 0; x < W; x += row.step[0] + r() * (row.step[1] - row.step[0])) {
        const w = row.w[0] + r() * (row.w[1] - row.w[0]);
        const yy = row.y + r() * 30;
        const res = G.cloud(ctx, x, yy, w, w * row.hk, row.pal, Math.floor(r() * 1e6));
        if (x - res.ox < 0) ctx.drawImage(res.canvas, x + W - res.ox, yy - res.oy);
        if (x - res.ox + res.w > W) ctx.drawImage(res.canvas, x - W - res.ox, yy - res.oy);
      }
    }
    return { canvas: C, meta: { w: W, h: H, top: 250 } };
  };

  G.puff = function (T, seed, w) {
    const out = P.layer(w * 1.3, w * 0.8);
    const ctx = out.getContext('2d');
    G.cloud(ctx, out.width / 2, out.height - 8, w, w * 0.46, T.cloud, seed);
    return { canvas: out, meta: { w: out.width, h: out.height } };
  };
})();

/* ---------- MAIN ISLAND (tilted arena) ---------- */
(function () {
  'use strict';
  const TAU = P.TAU;
  const mix = P.mix, rgba = P.rgba;
  const G = window.GEN;
  const K = G.K;
  const crownFor = G.crownFor, bushFor = G.bushFor;

  function ell(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); }

  G.island = function (T, seed) {
    const W = 1800, H = 1980;
    const PR = 560, RO = Math.round(PR * 1.17);
    const cx = W / 2, cy = 800;
    const dB = 34;               // bank height above the water
    const by = cy - dB;          // bank ellipse centre y
    const rin = PR * 1.02;       // inner bank edge
    const r = P.rng(seed);
    const back = P.layer(W, H), b = back.getContext('2d');
    const front = P.layer(W, H), f = front.getContext('2d');
    const meta = { w: W, h: H, pondX: cx, pondY: cy, pondR: PR, K, bankY: by, ringR: RO, rin, falls: [] };

    const grassFill = (ctx) => {
      const g = ctx.createLinearGradient(cx - RO, by - RO * K, cx + RO * 0.6, by + RO * K);
      g.addColorStop(0, T.grass.light); g.addColorStop(0.5, T.grass.mid); g.addColorStop(1, T.grass.dark);
      return g;
    };

    // ---------------- back hill with spring ----------------
    {
      const hx = cx + 6, hTop = by - RO * K - PR * 0.24;
      const hw = PR * 1.3;
      const baseY = by - RO * K * 0.55;
      // grassy mound
      b.beginPath();
      b.moveTo(hx - hw / 2, baseY);
      b.bezierCurveTo(hx - hw * 0.48, hTop + PR * 0.08, hx - hw * 0.2, hTop - PR * 0.02, hx, hTop);
      b.bezierCurveTo(hx + hw * 0.2, hTop - PR * 0.02, hx + hw * 0.48, hTop + PR * 0.08, hx + hw / 2, baseY);
      b.closePath();
      const hg = b.createLinearGradient(hx - hw / 2, hTop, hx + hw / 2, baseY);
      hg.addColorStop(0, T.grass.light); hg.addColorStop(0.55, T.grass.mid); hg.addColorStop(1, T.grass.dark);
      b.fillStyle = hg; b.fill();
      b.lineWidth = 5; b.strokeStyle = rgba(T.grass.line, 0.6); b.stroke();
      // rocky outcrop around the spring
      const sy = by - RO * K - PR * 0.04;
      const rpath = (c) => {
        c.beginPath();
        c.moveTo(cx - PR * 0.26, by - RO * K + PR * 0.04);
        c.bezierCurveTo(cx - PR * 0.27, sy - PR * 0.1, cx - PR * 0.1, sy - PR * 0.17, cx + PR * 0.02, sy - PR * 0.16);
        c.bezierCurveTo(cx + PR * 0.16, sy - PR * 0.16, cx + PR * 0.28, sy - PR * 0.08, cx + PR * 0.27, by - RO * K + PR * 0.04);
        c.closePath();
      };
      G.rockFace(b, rpath, { x: cx - PR * 0.27, y: sy - PR * 0.17, w: PR * 0.54, h: PR * 0.24 }, T.rock, seed + 2, { strata: 2, boulders: 2, lw: 4, avoid: [[cx - PR * 0.1, cx + PR * 0.1]] });
      b.beginPath(); b.ellipse(cx, sy, PR * 0.08, PR * 0.06, 0, Math.PI, 0); b.lineTo(cx + PR * 0.08, sy + 6); b.lineTo(cx - PR * 0.08, sy + 6); b.closePath();
      b.fillStyle = mix(T.rock.deep, '#1a1030', 0.35); b.fill();
      meta.springTop = sy;
      // bushes along the crest
      const items = [];
      for (let i = 0; i < 10; i++) {
        const u = i / 9;
        if (Math.abs(u - 0.5) < 0.12) continue;
        items.push({ x: hx - hw * 0.44 + u * hw * 0.88 + (r() - 0.5) * 24, y: hTop + PR * (0.05 + Math.pow(Math.abs(u - 0.5) * 2, 2) * 0.16) + r() * 14, s: PR * (0.085 + r() * 0.04) });
      }
      items.sort((a, c) => a.y - c.y);
      for (const it of items) G.bush(b, it.x, it.y + it.s * 0.55, it.s * 1.8, it.s * 1.05, bushFor(T, r), Math.floor(r() * 1e6), { flowers: { n: 4, size: it.s * 0.13, colors: T.flowers } });
    }

    // ---------------- cliff face ----------------
    const cliffBottom = by + RO * K + RO * 0.98;
    {
      const nz = P.makeNoise(seed + 5);
      const thick = (x) => {
        const u = Math.min(1, Math.abs(x - cx) / RO);
        const base = RO * (0.05 + 0.88 * Math.pow(1 - u, 1.7));
        const lobes = 1 + 0.07 * Math.sin((x - cx) / RO * 9.0 + 1.3) + 0.04 * Math.sin((x - cx) / RO * 23 + 0.4);
        const jag = Math.pow(Math.abs(nz((x - cx) / 40, 2.2)), 2) * RO * 0.06 * (1 - u);
        return base * lobes + jag;
      };
      const rimY = (x) => { const u = (x - cx) / RO; return by + RO * K * Math.sqrt(Math.max(0, 1 - u * u)); };
      const path = (c) => {
        c.beginPath();
        c.moveTo(cx - RO, by);
        c.ellipse(cx, by, RO, RO * K, 0, Math.PI, 0, true);
        for (let x = cx + RO; x >= cx - RO; x -= 5) c.lineTo(x, rimY(x) + thick(x));
        c.closePath();
      };
      G.rockFace(b, path, { x: cx - RO, y: by + RO * K * 0.2, w: RO * 2, h: cliffBottom - by - RO * K * 0.2 }, T.rock, seed + 6, {
        strata: 5, boulders: 10, lw: 5,
        // no pebbles behind the waterfalls
        avoid: [[cx - PR * 0.17, cx + PR * 0.17]].concat([-1, 1].map((sd) => { const fx = cx + Math.cos(Math.PI / 2 + sd * 0.74) * RO * 0.97; return [fx - PR * 0.055, fx + PR * 0.055]; })),
        arc: (t, off) => by + RO * K * Math.sin(t * Math.PI) + off * 0.85 - RO * K * 0.15,
      });
      // hanging vines with little blossoms (red ivy in autumn, pastel garlands in the sky kingdom)
      const V = T.vine || (T.gold ? T.blossom : T.leaf);
      b.save(); b.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        const a = Math.PI * (0.08 + r() * 0.84);
        const x = cx + Math.cos(a) * RO * 0.99, y = by + Math.sin(a) * RO * K * 0.99 + 8;
        if (Math.abs(x - cx) < PR * 0.22) continue;
        const len = RO * (0.07 + r() * 0.2);
        b.beginPath(); b.moveTo(x, y);
        b.quadraticCurveTo(x + (r() - 0.5) * 30, y + len * 0.6, x + (r() - 0.5) * 20, y + len);
        b.lineWidth = 4; b.strokeStyle = V.dark; b.stroke();
        for (let k = 1; k <= 4; k++) {
          const t = k / 4.6, lx = x + (k % 2 ? 9 : -9), ly = y + len * t;
          b.beginPath(); b.ellipse(lx, ly, 10, 6, k % 2 ? 0.6 : -0.6, 0, TAU);
          b.fillStyle = k % 2 ? V.light : V.mid; b.fill();
        }
        if (r() > 0.45) G.flower(b, x, y + len, 9 + r() * 4, T.flowers[Math.floor(r() * T.flowers.length)], r() * TAU, true);
      }
      b.restore();
      // crystals
      for (let i = 0; i < 9; i++) {
        const t = 0.12 + r() * 0.76;
        const x = cx - RO * 0.9 + t * RO * 1.8;
        if (Math.abs(x - cx) < PR * 0.25) continue;
        const y = by + RO * K * Math.sin(t * Math.PI) + RO * (0.15 + r() * 0.3);
        const s = 14 + r() * 14;
        const col = T.crystals ? T.crystals[Math.floor(r() * T.crystals.length)] : r() > 0.5 ? '#ffd2ef' : '#cdefff';
        b.save(); b.translate(x, y); b.rotate((r() - 0.5) * 0.5);
        for (const q of [[-0.6, 0.7], [0, 1], [0.6, 0.6]]) {
          b.beginPath(); b.moveTo(q[0] * s, -s * 2 * q[1]); b.lineTo(q[0] * s + s * 0.38, -s * 0.35); b.lineTo(q[0] * s, s * 0.3); b.lineTo(q[0] * s - s * 0.38, -s * 0.35); b.closePath();
          const g = b.createLinearGradient(q[0] * s - s * 0.4, 0, q[0] * s + s * 0.4, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, col); g.addColorStop(1, mix(col, '#8a6aa8', 0.35));
          b.fillStyle = g; b.fill(); b.lineWidth = 2; b.strokeStyle = 'rgba(120,90,150,0.5)'; b.stroke();
        }
        P.softDab(b, 0, -s, s * 1.6, col, 0.35, 0);
        b.restore();
      }
    }

    // ---------------- waterfalls down the cliff ----------------
    {
      const top = by + RO * K - 6;
      const fm = G.fall(b, cx, top, PR * 0.22, PR * 0.29, H - top, T.fall, seed + 30, { fade: 0.0 });
      meta.falls.push({ x: cx, y: top, w0: PR * 0.22, w1: PR * 0.29, h: H - top, kind: 'main' });
      for (const side of [-1, 1]) {
        const a = Math.PI / 2 + side * 0.74;
        const x = cx + Math.cos(a) * RO * 0.97, y = by + Math.sin(a) * RO * K * 0.97;
        const h = RO * (0.55 + r() * 0.12);
        G.fall(b, x, y - 4, PR * 0.065, PR * 0.085, h, T.fall, seed + 31 + side, { fade: 0.5 });
        meta.falls.push({ x, y: y - 4, w0: PR * 0.065, w1: PR * 0.085, h, kind: 'side', fade: 0.5 });
      }
    }

    // ---------------- island top (grass) ----------------
    ell(b, cx, by, RO, RO * K);
    b.fillStyle = grassFill(b); b.fill();
    b.lineWidth = 5; b.strokeStyle = rgba(T.grass.line, 0.6); b.stroke();
    // soft lighter top-left sheen
    b.save(); ell(b, cx, by, RO, RO * K); b.clip();
    P.softDab(b, cx - RO * 0.55, by - RO * K * 0.6, RO * 0.7, T.grass.hi, 0.35, 0);
    b.restore();

    // ---------------- far inner wall (basin) ----------------
    {
      ell(b, cx, by, rin, rin * K);
      const g = b.createLinearGradient(0, by - rin * K, 0, cy);
      g.addColorStop(0, T.rock.mid); g.addColorStop(0.6, T.rock.dark); g.addColorStop(1, T.rock.deep);
      b.fillStyle = g; b.fill();
      b.save(); ell(b, cx, by, rin, rin * K); b.clip();
      // wall strata + stones
      for (let k = 1; k <= 3; k++) {
        b.beginPath(); b.ellipse(cx, by + k * dB * 0.32, rin, rin * K, 0, Math.PI * 1.02, Math.PI * 1.98);
        b.lineWidth = 3; b.strokeStyle = rgba(T.rock.hi, 0.35); b.stroke();
      }
      for (let i = 0; i < 26; i++) {
        const a = Math.PI * (1.05 + r() * 0.9);
        const x = cx + Math.cos(a) * rin * 0.985, y = by + Math.sin(a) * rin * K * 0.985 + dB * (0.3 + r() * 0.5);
        G.stone(b, x, y, 6 + r() * 7, T.rock);
      }
      b.restore();
    }

    // ---------------- water ----------------
    {
      b.save();
      ell(b, cx, by, rin, rin * K); b.clip();
      ell(b, cx, cy, PR, PR * K);
      const g = b.createRadialGradient(cx, cy + PR * K * 0.2, PR * 0.05, cx, cy, PR * 1.02);
      g.addColorStop(0, T.water.light); g.addColorStop(0.55, T.water.mid); g.addColorStop(0.88, T.water.deep); g.addColorStop(1, T.water.far);
      b.fillStyle = g; b.fill();
      b.save(); ell(b, cx, cy, PR, PR * K); b.clip();
      // shadow of the far wall on the water
      const sg = b.createLinearGradient(0, cy - PR * K, 0, cy - PR * K + PR * 0.22);
      sg.addColorStop(0, rgba(T.water.far, 0.75)); sg.addColorStop(1, rgba(T.water.far, 0));
      b.fillStyle = sg; b.fillRect(cx - PR, cy - PR * K, PR * 2, PR * 0.25);
      // gentle ripple highlights (curved strokes)
      b.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        const a = r() * TAU, rr = Math.sqrt(r()) * 0.82;
        const x = cx + Math.cos(a) * PR * rr, y = cy + Math.sin(a) * PR * K * rr;
        const len = PR * (0.05 + r() * 0.09);
        b.beginPath(); b.ellipse(x, y, len, len * 0.28, 0, Math.PI * 1.15, Math.PI * 1.85);
        b.lineWidth = 3 + r() * 3; b.strokeStyle = rgba(T.water.hi, 0.18 + r() * 0.22); b.stroke();
      }
      // sky reflection
      P.softDab(b, cx - PR * 0.3, cy - PR * K * 0.45, PR * 0.55, T.water.hi, 0.18, 0);
      b.restore();
      // waterline foam along the far wall
      b.beginPath(); b.ellipse(cx, cy, PR * 0.995, PR * K * 0.995, 0, Math.PI * 0.98, Math.PI * 2.02);
      b.lineWidth = 4; b.strokeStyle = rgba('#ffffff', 0.6); b.stroke();
      b.restore();
    }

    // ---------------- spring cascade over the far bank into the pond ----------------
    {
      const top = meta.springTop - 4, bot = cy - PR * K + 8;
      G.fall(b, cx, top, PR * 0.12, PR * 0.15, bot - top, T.fall, seed + 40, {});
      meta.falls.push({ x: cx, y: top, w0: PR * 0.12, w1: PR * 0.15, h: bot - top, kind: 'spring' });
      meta.springEntry = { x: 0, y: -1000 }; // world coords of the splash (top edge of the pond)
      // splash ring
      b.save(); ell(b, cx, cy, PR, PR * K); b.clip();
      for (let i = 0; i < 3; i++) { b.beginPath(); b.ellipse(cx, bot + 6, PR * (0.09 + i * 0.05), PR * K * (0.035 + i * 0.02), 0, 0, TAU); b.lineWidth = 3; b.strokeStyle = rgba('#ffffff', 0.5 - i * 0.14); b.stroke(); }
      b.restore();
    }

    // ---------------- inner bank lip (far half) ----------------
    const lip = (ctx, a0, a1) => {
      // dark edge + grass blades hanging over the edge
      ctx.beginPath(); ctx.ellipse(cx, by, rin, rin * K, 0, a0, a1);
      ctx.lineWidth = 6; ctx.strokeStyle = rgba(T.grass.line, 0.7); ctx.stroke();
      ctx.save(); ctx.lineCap = 'round';
      const n = 160;
      for (let i = 0; i <= n; i++) {
        const a = a0 + (a1 - a0) * (i / n);
        const x = cx + Math.cos(a) * rin, y = by + Math.sin(a) * rin * K;
        const len = 9 + r() * 12;
        const dx = -Math.cos(a) * len * 0.6, dy = Math.sin(a) < 0 ? len * 0.8 : -len * 0.3;
        ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * 4, y - Math.sin(a) * 3);
        ctx.quadraticCurveTo(x + dx * 0.5, y + dy * 0.2 - 4, x + dx, y + dy);
        ctx.lineWidth = 3 + r() * 2; ctx.strokeStyle = r() > 0.5 ? T.grass.light : T.grass.mid; ctx.stroke();
      }
      ctx.restore();
    };
    lip(b, Math.PI, TAU);

    // ---------------- vegetation: back half ----------------
    const leafPals = [T.leaf, T.blossom, T.gold || T.leaf];
    const scatter = (ctx, aFrom, aTo, count, opts) => {
      for (let i = 0; i < count; i++) {
        const a = aFrom + r() * (aTo - aFrom);
        const u = 0.08 + r() * 0.84;
        const rr = rin + (RO - rin) * u;
        const x = cx + Math.cos(a) * rr, y = by + Math.sin(a) * rr * K;
        const k = r();
        if (T.litter) {
          // autumn: the bank is carpeted with fallen maple leaves, with a few late flowers, toadstools and pumpkins
          if (k < 0.58) G.fallenLeaf(ctx, x, y, 11 + r() * 7, leafPals[Math.floor(r() * 3)], r() * TAU);
          else if (k < 0.7) G.flower(ctx, x, y, 8 + r() * 6, T.flowers[Math.floor(r() * T.flowers.length)], r() * TAU);
          else if (k < 0.8) G.tuft(ctx, x, y, 12 + r() * 8, T.grass);
          else if (k < 0.9) G.mushroom(ctx, x, y, 16 + r() * 9);
          else G.pumpkin(ctx, x, y, 15 + r() * 9);
          continue;
        }
        if (k < 0.55) G.flower(ctx, x, y, 9 + r() * 7, T.flowers[Math.floor(r() * T.flowers.length)], r() * TAU);
        else if (k < 0.8) G.tuft(ctx, x, y, 12 + r() * 8, T.grass);
        else if (k < 0.92 && !(opts && opts.noStones)) G.stone(ctx, x, y, 7 + r() * 6, T.rock);
        else G.mushroom(ctx, x, y, 16 + r() * 8);
      }
    };
    // bushes along the outer rim of the back half
    const backBushes = [];
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i + 0.5) * (Math.PI / 9) + (r() - 0.5) * 0.12;
      if (Math.abs(a - Math.PI * 1.5) < 0.16) continue; // spring
      backBushes.push(a);
    }
    for (const a of backBushes) {
      const rr = RO * 0.94;
      const x = cx + Math.cos(a) * rr, y = by + Math.sin(a) * rr * K + 8;
      const s = (RO - rin) * (0.85 + r() * 0.4);
      G.bush(b, x, y, s * 1.7, s, bushFor(T, r), Math.floor(r() * 1e6), { flowers: r() > 0.3 ? { n: 5, size: s * 0.12, colors: T.flowers } : null });
    }
    scatter(b, Math.PI * 1.0, Math.PI * 2.0, T.litter ? 95 : 70);
    // trees at the back corners (in autumn a heap of leaves and a big pumpkin at their feet)
    const corners = [Math.PI * 1.22, Math.PI * 1.79];
    corners.forEach((a, i) => {
      const x = cx + Math.cos(a) * RO * 1.0, y = by + Math.sin(a) * RO * K * 1.0 + 6;
      if (T.litter) G.leafPile(b, x + (i ? -1 : 1) * PR * 0.05, y + 14, PR * 0.12, T, seed + 90 + i);
      const crown = T.crowns || T.gold ? (T.gold ? [T.blossom, T.gold][i] : crownFor(T, r, true)) : T.blossom;
      G.tree(b, x, y, PR * 0.42, { bark: T.bark, crown, leaf: T.leaf }, Math.floor(r() * 1e6), { dots: T.litter ? 46 : 30, leafy: !!T.litter });
      if (T.litter) G.pumpkin(b, x + (i ? -1 : 1) * PR * 0.17, y + 22, PR * (i ? 0.06 : 0.075));
    });
    // side bushes (mid height) – back layer
    for (const side of [-1, 1]) {
      const a = side < 0 ? Math.PI * 1.04 : Math.PI * 1.96;
      const x = cx + Math.cos(a) * RO * 0.92, y = by + Math.sin(a) * RO * K * 0.92 + 4;
      G.bush(b, x, y, (RO - rin) * 1.5, (RO - rin) * 0.9, bushFor(T, r), Math.floor(r() * 1e6), { flowers: { n: 4, size: 10, colors: T.flowers } });
    }

    // ================= FRONT LAYER (near bank, drawn over the cakes) =================
    f.save();
    f.beginPath();
    f.rect(0, by, W, H);
    f.clip();
    // grass ring (identical fill as in the back layer)
    f.beginPath();
    f.ellipse(cx, by, RO, RO * K, 0, 0, TAU);
    f.ellipse(cx, by, rin, rin * K, 0, 0, TAU, true);
    f.fillStyle = grassFill(f); f.fill('evenodd');
    f.save(); f.beginPath(); f.ellipse(cx, by, RO, RO * K, 0, 0, TAU); f.clip();
    P.softDab(f, cx - RO * 0.55, by - RO * K * 0.6, RO * 0.7, T.grass.hi, 0.35, 0);
    f.restore();
    f.beginPath(); f.ellipse(cx, by, RO, RO * K, 0, 0, Math.PI);
    f.lineWidth = 5; f.strokeStyle = rgba(T.grass.line, 0.6); f.stroke();
    f.restore();
    // front lip: grass scallops hanging over the cliff
    {
      const pts = [];
      const n = 46;
      for (let i = 0; i <= n; i++) {
        const a = 0.02 + (Math.PI - 0.04) * (i / n);
        pts.push({ x: cx + Math.cos(a) * RO, y: by + Math.sin(a) * RO * K, s: 15 + r() * 10 });
      }
      f.beginPath(); for (const p of pts) { f.moveTo(p.x + p.s, p.y + p.s * 0.4); f.arc(p.x, p.y + p.s * 0.4, p.s, 0, TAU); }
      f.fillStyle = T.grass.deep; f.fill();
      f.beginPath(); for (const p of pts) { f.moveTo(p.x + p.s, p.y); f.arc(p.x, p.y, p.s, 0, TAU); }
      f.fillStyle = T.grass.dark; f.fill();
      for (const p of pts) {
        f.beginPath(); f.arc(p.x - p.s * 0.1, p.y - p.s * 0.16, p.s * 0.8, 0, TAU);
        const g = f.createRadialGradient(p.x - p.s * 0.4, p.y - p.s * 0.45, p.s * 0.05, p.x, p.y, p.s);
        g.addColorStop(0, T.grass.light); g.addColorStop(1, T.grass.mid);
        f.fillStyle = g; f.fill();
      }
    }
    // inner edge of the near bank: soft shadow on the water + lip blades
    f.save();
    f.beginPath(); f.ellipse(cx, by, rin + 2, rin * K + 2, 0, 0.0, Math.PI);
    f.lineWidth = 10; f.strokeStyle = rgba(T.water.far, 0.25); f.filter = 'blur(3px)'; f.stroke(); f.filter = 'none';
    f.restore();
    lip(f, 0, Math.PI);
    // vegetation on the near bank (keep the centre clear for Tilly)
    for (const a of [Math.PI * 0.12, Math.PI * 0.26, Math.PI * 0.74, Math.PI * 0.88]) {
      const rr = (rin + RO) / 2 + (RO - rin) * 0.15;
      const x = cx + Math.cos(a) * rr, y = by + Math.sin(a) * rr * K + 6;
      const s = (RO - rin) * (0.75 + r() * 0.3);
      G.bush(f, x, y, s * 1.6, s * 0.95, bushFor(T, r), Math.floor(r() * 1e6), { flowers: { n: 4, size: s * 0.12, colors: T.flowers } });
    }
    for (let i = 0; i < 60; i++) {
      const a = 0.05 + r() * (Math.PI - 0.1);
      if (Math.abs(a - Math.PI / 2) < 0.16) continue;
      const u = 0.12 + r() * 0.76;
      const rr = rin + (RO - rin) * u;
      const x = cx + Math.cos(a) * rr, y = by + Math.sin(a) * rr * K;
      const k = r();
      if (T.litter && k < 0.62) G.fallenLeaf(f, x, y, 11 + r() * 7, leafPals[Math.floor(r() * 3)], r() * TAU);
      else if (k < 0.6) G.flower(f, x, y, 9 + r() * 7, T.flowers[Math.floor(r() * T.flowers.length)], r() * TAU);
      else G.tuft(f, x, y, 12 + r() * 8, T.grass);
    }
    meta.cliffBottom = cliffBottom;
    return { canvas: back, front, meta };
  };
})();
