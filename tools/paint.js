/* Fairycake Falls – offline painting library used by the asset generator.
   Runs in a browser (Chromium via Playwright). Not loaded by the game. */
(function () {
  'use strict';
  const P = (window.P = {});
  const TAU = Math.PI * 2;
  P.TAU = TAU;

  // ---------- RNG ----------
  P.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // ---------- simplex noise 2D ----------
  P.makeNoise = function (seed) {
    const r = P.rng(seed);
    const perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const grad = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
    const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
    return function (xin, yin) {
      const s = (xin + yin) * F2;
      const i = Math.floor(xin + s), j = Math.floor(yin + s);
      const t = (i + j) * G2;
      const x0 = xin - (i - t), y0 = yin - (j - t);
      const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
      const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      let n0 = 0, n1 = 0, n2 = 0;
      let t0 = 0.5 - x0 * x0 - y0 * y0;
      if (t0 > 0) { const g = grad[perm[ii + perm[jj]] & 7]; t0 *= t0; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0); }
      let t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 > 0) { const g = grad[perm[ii + i1 + perm[jj + j1]] & 7]; t1 *= t1; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1); }
      let t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 > 0) { const g = grad[perm[ii + 1 + perm[jj + 1]] & 7]; t2 *= t2; n2 = t2 * t2 * (g[0] * x2 + g[1] * y2); }
      return 70 * (n0 + n1 + n2); // -1..1
    };
  };
  P.fbm = function (noise, x, y, oct, lac, gain) {
    let a = 0.5, f = 1, s = 0, n = 0;
    for (let i = 0; i < (oct || 4); i++) { s += a * noise(x * f, y * f); n += a; f *= lac || 2; a *= gain || 0.5; }
    return s / n;
  };

  // ---------- colors ----------
  const hc = new Map();
  P.rgb = function (hex) {
    let c = hc.get(hex); if (c) return c;
    let h = hex.replace('#', ''); if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    const n = parseInt(h, 16); c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; hc.set(hex, c); return c;
  };
  const hx = (v) => { const s = Math.round(Math.max(0, Math.min(255, v))).toString(16); return s.length < 2 ? '0' + s : s; };
  P.hex = (r, g, b) => '#' + hx(r) + hx(g) + hx(b);
  P.mix = function (a, b, t) { const x = P.rgb(a), y = P.rgb(b); return P.hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); };
  P.rgba = function (c, a) { const x = P.rgb(c); return 'rgba(' + x[0] + ',' + x[1] + ',' + x[2] + ',' + a + ')'; };
  P.lighten = (c, t) => P.mix(c, '#ffffff', t);
  P.darken = (c, t, tint) => P.mix(c, tint || '#3b2340', t);

  // ---------- canvas ----------
  P.layer = function (w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; };
  P.blurred = function (src, px) {
    const c = P.layer(src.width, src.height); const x = c.getContext('2d');
    x.filter = 'blur(' + px + 'px)'; x.drawImage(src, 0, 0); x.filter = 'none'; return c;
  };
  P.softDab = function (ctx, x, y, r, color, alpha, hard) {
    const h = hard == null ? 0 : hard;
    const g = ctx.createRadialGradient(x, y, r * h, x, y, r);
    g.addColorStop(0, P.rgba(color, alpha)); g.addColorStop(1, P.rgba(color, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  P.circle = function (ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); };
  P.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  P.lerp = (a, b, t) => a + (b - a) * t;

  // Tint the non-transparent pixels of a layer (keeps alpha) – used for atmospheric fade
  P.tint = function (src, color, amount) {
    const c = P.layer(src.width, src.height); const x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-atop'; x.globalAlpha = amount; x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    return c;
  };

})();
