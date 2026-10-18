/* Fairycake Falls – core helpers (math, easing, colors, storage)
   All scripts are classic scripts (no ES modules) so the game runs straight
   from file:// by double-clicking index.html. Shared namespace: window.FC */
(function () {
  'use strict';
  const FC = (window.FC = window.FC || {});

  const TAU = Math.PI * 2;
  FC.TAU = TAU;

  FC.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  FC.lerp = (a, b, t) => a + (b - a) * t;
  FC.invLerp = (a, b, v) => (v - a) / (b - a);
  FC.rand = (a, b) => a + Math.random() * (b - a);
  FC.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  FC.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  FC.chance = (p) => Math.random() < p;
  FC.smoothstep = (a, b, v) => {
    const t = FC.clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  FC.angDiff = (a, b) => {
    let d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  };
  // frame-rate independent exponential smoothing factor
  FC.damp = (rate, dt) => 1 - Math.exp(-rate * dt);

  // ---------- easing ----------
  FC.ease = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: (t) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    outElastic: (t) => {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      const c4 = TAU / 3;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
  };

  // ---------- deterministic RNG (for procedural art) ----------
  FC.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // ---------- colors ----------
  const hexCache = new Map();
  FC.hexToRgb = function (hex) {
    let c = hexCache.get(hex);
    if (c) return c;
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    const n = parseInt(h, 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    hexCache.set(hex, c);
    return c;
  };
  const toHex = (v) => {
    const s = Math.round(FC.clamp(v, 0, 255)).toString(16);
    return s.length === 1 ? '0' + s : s;
  };
  FC.rgbToHex = (r, g, b) => '#' + toHex(r) + toHex(g) + toHex(b);
  FC.mix = function (c1, c2, t) {
    const a = FC.hexToRgb(c1), b = FC.hexToRgb(c2);
    return FC.rgbToHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
  };
  // amt > 0: towards white, amt < 0: towards a deep tone of the same hue
  FC.shade = function (c, amt) {
    if (amt >= 0) return FC.mix(c, '#ffffff', amt);
    const [r, g, b] = FC.hexToRgb(c);
    // darken with a slight warm/purple bias so outlines look "kawaii" instead of grey
    const k = 1 + amt;
    return FC.rgbToHex(r * k + 18 * -amt, g * k * 0.92, b * k + 28 * -amt);
  };
  FC.rgba = function (c, a) {
    const [r, g, b] = FC.hexToRgb(c);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  };

  // ---------- storage (always guarded) ----------
  FC.store = {
    get(key, def) {
      try {
        const v = window.localStorage.getItem('fcf_' + key);
        return v == null ? def : JSON.parse(v);
      } catch (e) {
        return def;
      }
    },
    set(key, val) {
      try {
        window.localStorage.setItem('fcf_' + key, JSON.stringify(val));
      } catch (e) { /* ignore */ }
    },
  };

  // ---------- canvas helpers ----------
  FC.makeCanvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  };

  // rounded rectangle path
  FC.roundRect = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // 4-point sparkle star path (centered)
  FC.sparklePath = function (ctx, x, y, r, inner) {
    const k = inner == null ? 0.28 : inner;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * k;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };

  // 5-point star
  FC.starPath = function (ctx, x, y, r, inner, rot) {
    const k = inner == null ? 0.48 : inner;
    const ro = rot == null ? -Math.PI / 2 : rot;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = ro + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r : r * k;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };

  // heart path centered at x,y with size s (width ~ 2s)
  FC.heartPath = function (ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.9);
    ctx.bezierCurveTo(x - s * 1.25, y + s * 0.05, x - s * 0.95, y - s * 0.95, x, y - s * 0.38);
    ctx.bezierCurveTo(x + s * 0.95, y - s * 0.95, x + s * 1.25, y + s * 0.05, x, y + s * 0.9);
    ctx.closePath();
  };

  FC.now = () => performance.now() / 1000;
})();
