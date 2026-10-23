/* Fairycake Falls – effects: particles, water ripples, flash rings, score popups.
   Everything lives in world units (pond radius = 1000) so it stays aligned on resize. */
(function () {
  'use strict';
  const FC = window.FC;
  const TAU = FC.TAU;

  const MAX_PARTICLES = 320;
  const spriteCache = new Map();

  // small pre-rendered particle sprites (kind + colour), 32px
  function pSprite(kind, color) {
    const key = kind + color;
    let c = spriteCache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 32;
    const x = c.getContext('2d');
    x.translate(16, 16);
    x.fillStyle = color;
    const sz = 10;
    switch (kind) {
      case 'sprinkle': FC.roundRect(x, -sz * 1.2, -sz * 0.4, sz * 2.4, sz * 0.8, sz * 0.4); x.fill(); x.fillStyle = 'rgba(255,255,255,0.5)'; FC.roundRect(x, -sz * 0.8, -sz * 0.3, sz * 1.0, sz * 0.25, sz * 0.12); x.fill(); break;
      case 'star': FC.sparklePath(x, 0, 0, sz * 1.5, 0.3); x.fill(); break;
      case 'heart': FC.heartPath(x, 0, 0, sz); x.fill(); break;
      case 'petal': x.beginPath(); x.ellipse(0, 0, sz * 1.2, sz * 0.65, 0, 0, FC.TAU); x.fill(); break;
      case 'drop': x.beginPath(); x.ellipse(0, 0, sz * 0.6, sz * 0.9, 0, 0, FC.TAU); x.fill(); x.fillStyle = 'rgba(255,255,255,0.7)'; x.beginPath(); x.arc(-sz * 0.2, -sz * 0.3, sz * 0.22, 0, FC.TAU); x.fill(); break;
      default: x.beginPath(); x.arc(0, 0, sz * 0.75, 0, FC.TAU); x.fill(); x.fillStyle = 'rgba(255,255,255,0.55)'; x.beginPath(); x.arc(-sz * 0.25, -sz * 0.25, sz * 0.25, 0, FC.TAU); x.fill();
    }
    spriteCache.set(key, c);
    return c;
  }

  // pre-rendered text for popups
  function textSprite(text, color, sub) {
    const size = 64;
    const c = document.createElement('canvas');
    const x = c.getContext('2d');
    x.font = '700 ' + size + 'px Fredoka, sans-serif';
    const w1 = x.measureText(text).width;
    let w2 = 0;
    if (sub) { x.font = '700 ' + Math.round(size * 0.55) + 'px Fredoka, sans-serif'; w2 = x.measureText(sub).width; }
    c.width = Math.ceil(Math.max(w1, w2) + size * 0.6);
    c.height = Math.ceil(size * (sub ? 2.05 : 1.35));
    const y = c.getContext('2d');
    y.textAlign = 'center';
    y.textBaseline = 'middle';
    y.lineJoin = 'round';
    y.font = '700 ' + size + 'px Fredoka, sans-serif';
    y.lineWidth = size * 0.2;
    y.strokeStyle = '#ffffff';
    y.strokeText(text, c.width / 2, size * 0.66);
    y.fillStyle = color;
    y.fillText(text, c.width / 2, size * 0.66);
    if (sub) {
      const s2 = Math.round(size * 0.55);
      y.font = '700 ' + s2 + 'px Fredoka, sans-serif';
      y.lineWidth = s2 * 0.24;
      y.strokeText(sub, c.width / 2, size * 1.55);
      y.fillStyle = '#9b6bff';
      y.fillText(sub, c.width / 2, size * 1.55);
    }
    return { c, size };
  }

  const FX = {
    particles: [],
    ripples: [],
    rings: [],
    popups: [],

    clear() {
      this.particles.length = 0;
      this.ripples.length = 0;
      this.rings.length = 0;
      this.popups.length = 0;
    },

    // o: {n, colors, speed:[min,max], size:[min,max], kinds:[...], life:[min,max], gravity, spread, dir, drag, up}
    burst(x, y, o) {
      const n = o.n || 16;
      for (let i = 0; i < n; i++) {
        if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
        const a = o.dir != null ? o.dir + (Math.random() - 0.5) * (o.spread || 1) : Math.random() * TAU;
        const sp = FC.rand(o.speed ? o.speed[0] : 200, o.speed ? o.speed[1] : 700);
        const kind = FC.pick(o.kinds || ['dot']);
        this.particles.push({
          x: x + (o.jitter ? (Math.random() - 0.5) * o.jitter : 0),
          y: y + (o.jitter ? (Math.random() - 0.5) * o.jitter : 0),
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - (o.up || 0),
          g: o.gravity == null ? 900 : o.gravity,
          drag: o.drag == null ? 2.2 : o.drag,
          size: FC.rand(o.size ? o.size[0] : 10, o.size ? o.size[1] : 22),
          rot: Math.random() * TAU,
          vr: (Math.random() - 0.5) * 12,
          life: FC.rand(o.life ? o.life[0] : 0.5, o.life ? o.life[1] : 1.1),
          t: 0,
          color: FC.pick(o.colors || ['#ffffff']),
          kind,
          twinkle: Math.random() * TAU,
        });
      }
    },

    ripple(x, y, r0, strength, speed) {
      if (this.ripples.length > 60) this.ripples.shift();
      this.ripples.push({ x, y, r: r0, v: speed || 420, t: 0, life: 0.9 + strength * 0.5, a: Math.min(0.75, 0.25 + strength * 0.5) });
    },

    ring(x, y, r0, r1, color, life, width) {
      this.rings.push({ x, y, r0, r1, color: color || '#ffffff', life: life || 0.4, t: 0, w: width || 14 });
    },

    popup(x, y, text, color, size, opts) {
      const o = opts || {};
      // chain reactions: stack new popups above the fresh ones instead of on top of them
      for (const q of this.popups) {
        if (q.t < 0.45 && Math.abs(q.x - x) < 260 && Math.abs(q.y - y) < 120) y = Math.min(y, q.y - 120);
      }
      this.popups.push({ x, y, text, color: color || '#ff6fa8', size: size || 46, t: 0, life: o.life || 1.1, vy: o.vy || -160, sub: o.sub || null, spr: textSprite(text, color || '#ff6fa8', o.sub || null) });
    },

    update(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.t += dt;
        if (p.t >= p.life) { this.particles.splice(i, 1); continue; }
        const f = Math.exp(-p.drag * dt);
        p.vx *= f; p.vy *= f;
        p.vy += p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += p.vr * dt;
      }
      for (let i = this.ripples.length - 1; i >= 0; i--) {
        const r = this.ripples[i];
        r.t += dt;
        r.r += r.v * dt;
        r.v *= Math.exp(-1.2 * dt);
        if (r.t >= r.life) this.ripples.splice(i, 1);
      }
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i];
        r.t += dt;
        if (r.t >= r.life) this.rings.splice(i, 1);
      }
      for (let i = this.popups.length - 1; i >= 0; i--) {
        const p = this.popups[i];
        p.t += dt;
        p.y += p.vy * dt;
        p.vy *= Math.exp(-2.4 * dt);
        if (p.t >= p.life) this.popups.splice(i, 1);
      }
    },

    // ripples on the water (under the cakes), clipped to the pond by the caller
    drawWater(ctx, S) {
      const s = S.s;
      for (const r of this.ripples) {
        const k = r.t / r.life;
        const a = r.a * (1 - k) * (1 - k);
        if (a < 0.01) continue;
        const p = S.w2s(r.x, r.y);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r.r * s, r.r * s * 0.82, 0, 0, TAU);
        ctx.lineWidth = Math.max(1, 3.2 * (1 - k) * (S.pr / 300) + 0.6);
        ctx.strokeStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
        ctx.stroke();
      }
    },

    drawTop(ctx, S, dpr) {
      const s = S.s;
      // flash rings
      for (const r of this.rings) {
        const k = r.t / r.life;
        const e = FC.ease.outCubic(k);
        const p = S.w2s(r.x, r.y);
        const rad = (r.r0 + (r.r1 - r.r0) * e) * s;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, rad), 0, TAU);
        ctx.lineWidth = Math.max(1, r.w * s * (1 - k));
        ctx.strokeStyle = FC.rgba(r.color, (1 - k) * 0.9);
        ctx.stroke();
      }
      // particles (sprites)
      for (const p of this.particles) {
        const k = p.t / p.life;
        const alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        let sz = p.size * s * (k < 0.15 ? 0.5 + k / 0.3 : 1);
        if (p.kind === 'star') sz *= 0.75 + 0.25 * Math.sin(p.twinkle + p.t * 18);
        const q = S.w2s(p.x, p.y);
        const spr = pSprite(p.kind, p.color);
        const d = sz * 1.6;
        ctx.globalAlpha = alpha;
        if (p.kind === 'dot' || p.kind === 'drop') {
          ctx.drawImage(spr, q.x - d, q.y - d, d * 2, d * 2);
        } else {
          const cs = Math.cos(p.rot), sn = Math.sin(p.rot);
          ctx.setTransform(cs * dpr, sn * dpr, -sn * dpr, cs * dpr, q.x * dpr, q.y * dpr);
          ctx.drawImage(spr, -d, -d, d * 2, d * 2);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      }
      ctx.globalAlpha = 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // popups (pre-rendered text)
      for (const p of this.popups) {
        const k = p.t / p.life;
        const q = S.w2s(p.x, p.y);
        const sc = k < 0.18 ? FC.ease.outBack(k / 0.18) : 1;
        const a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
        const size = Math.max(13, Math.min(46, p.size * s * 3.2)) * sc;
        const f = size / p.spr.size;
        const w = p.spr.c.width * f, h = p.spr.c.height * f;
        // a long popup near the rim stays on screen (a phone is narrower than the pond)
        const x = S.W > w + 12 ? Math.max(w / 2 + 6, Math.min(S.W - w / 2 - 6, q.x)) : q.x;
        ctx.globalAlpha = a;
        ctx.drawImage(p.spr.c, x - w / 2, q.y - size * 0.66, w, h);
      }
      ctx.globalAlpha = 1;
    },
  };

  FC.FX = FX;
})();
