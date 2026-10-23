/* Fairycake Falls – runtime scene.
   Composes the pre-painted layers (assets/*.webp, see tools/) and adds the
   animated parts: flowing waterfalls, water glints & whirl, drifting clouds,
   cloud sea and sparkles. Also owns the tilted-arena projection:
     screen = (cx + x*s, cy + y*s*K)   (world: pond radius 1000, top-down) */
(function () {
  'use strict';
  const FC = window.FC;
  const TAU = FC.TAU;
  const MAN = window.FC_ASSETS;

  const Scene = {
    K: (MAN && MAN.themes[0].K) || 0.78,
    W: 0, H: 0, dpr: 1,
    cx: 0, cy: 0, pr: 100, s: 0.1, ki: 0.2,
    theme: 0, prevTheme: -1, fade: 1,
    imgs: {},
    loading: {},
    puffs: [], sparkles: [], glints: [],
    bandTop: 0,

    // ---------------- assets ----------------
    themeCount() {
      return MAN ? MAN.themes.length : 0;
    },
    themeName(i) {
      return MAN && MAN.themes[i] ? MAN.themes[i].name : '';
    },
    load(ti, onProgress) {
      if (!MAN || !MAN.themes[ti]) return Promise.resolve();
      if (this.loading[ti]) return this.loading[ti];
      const files = MAN.themes[ti].files;
      const names = Object.keys(files);
      const set = (this.imgs[ti] = {});
      let done = 0;
      this.loading[ti] = Promise.all(
        names.map(
          (n) =>
            new Promise((res) => {
              const img = new Image();
              img.onload = () => { done++; if (onProgress) onProgress(done / names.length); res(); };
              img.onerror = () => { done++; console.warn('asset failed', files[n]); res(); };
              img.src = 'assets/' + files[n];
              set[n] = img;
            })
        )
      );
      return this.loading[ti];
    },
    ready(ti) {
      const set = this.imgs[ti];
      if (!set) return false;
      for (const k in set) if (!set[k].complete || !set[k].naturalWidth) return false;
      return true;
    },
    meta(ti) {
      return MAN.themes[ti == null ? this.theme : ti].meta;
    },

    // Static layers are composed once per theme & screen size (1:1 device pixels)
    caches: {},
    cacheFor(ti) {
      if (!this.ready(ti)) return null;
      let c = this.caches[ti];
      const key = this.W + 'x' + this.H + '@' + this.dpr;
      if (c && c.key === key) return c;
      c = this.caches[ti] = { key };
      const mk = () => {
        const cv = document.createElement('canvas');
        cv.width = Math.round(this.W * this.dpr);
        cv.height = Math.round(this.H * this.dpr);
        const x = cv.getContext('2d');
        x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        x.imageSmoothingQuality = 'high';
        return [cv, x];
      };
      let [cv, x] = mk();
      this.paintSky(x, ti);
      c.sky = cv;
      [cv, x] = mk();
      this.paintMid(x, ti);
      c.mid = cv;
      [cv, x] = mk();
      const set = this.imgs[ti], im = this.meta(ti).island;
      if (set.islandFront && set.islandFront.naturalWidth) x.drawImage(set.islandFront, this.cx - im.pondX * this.ki, this.cy - im.pondY * this.ki, im.w * this.ki, im.h * this.ki);
      c.front = cv;
      // pre-scaled cloud sea strip
      const M = this.meta(ti).sea;
      const k = this.ki * 1.15;
      const sw = Math.max(1, Math.round(M.w * k * this.dpr)), sh = Math.max(1, Math.round(M.h * k * this.dpr));
      const sea = document.createElement('canvas');
      sea.width = sw; sea.height = sh;
      const sx = sea.getContext('2d');
      sx.imageSmoothingQuality = 'high';
      if (set.sea && set.sea.naturalWidth) sx.drawImage(set.sea, 0, 0, sw, sh);
      c.sea = sea;
      c.seaW = M.w * k; c.seaH = M.h * k; c.seaY = this.bandTop - M.top * k;
      c.seaFill = this.pal(ti).cloud.shade;
      // puffs pre-scaled
      c.puffs = [];
      for (let i = 0; i < 3; i++) {
        const img = set['puff' + i];
        if (!img || !img.naturalWidth) { c.puffs.push(null); continue; }
        const kk = this.ki * 1.2;
        const pc = document.createElement('canvas');
        pc.width = Math.max(1, Math.round(img.naturalWidth * kk * this.dpr));
        pc.height = Math.max(1, Math.round(img.naturalHeight * kk * this.dpr));
        pc.getContext('2d').drawImage(img, 0, 0, pc.width, pc.height);
        c.puffs.push({ cv: pc, w: img.naturalWidth * kk, h: img.naturalHeight * kk });
      }
      return c;
    },
    dropCaches(keep) {
      for (const k in this.caches) if (+k !== keep && +k !== this.prevTheme) delete this.caches[k];
    },
    pal(ti) {
      return MAN.themes[ti == null ? this.theme : ti].palette;
    },

    // ---------------- layout ----------------
    layout(W, H, dpr, safeTop, safeBottom) {
      this.W = W; this.H = H; this.dpr = dpr;
      const m = this.meta(0).island;
      const K = this.K;
      this.upK = (m.pondY - (m.bankY - m.ringR * K)) / m.pondR; // back bank top above pond centre
      this.downK = (m.bankY + m.ringR * K - m.pondY) / m.pondR; // front lip below pond centre
      const top = Math.max(64, H * 0.08) + (safeTop || 0);
      const bottom = Math.max(110, H * 0.16) + (safeBottom || 0);
      // leave room for the castle on screens that have it
      const castleRoom = H > W * 1.25 ? H * 0.16 : H * 0.15;
      let pr = Math.min(W * 0.445, (H - top - bottom - castleRoom) / (this.upK + this.downK + 0.12));
      pr = Math.max(pr, 80);
      let cy = Math.max(top + castleRoom + pr * this.upK, H * 0.42);
      if (cy + pr * this.downK > H - bottom) cy = H - bottom - pr * this.downK;
      this.pr = pr;
      this.cx = W / 2;
      this.cy = cy;
      this.s = pr / FC.Physics.CFG.R;
      this.ki = pr / m.pondR;
      this.bankTopY = cy - pr * this.upK;
      this.frontY = cy + pr * this.downK;
      const tall = FC.clamp((H / W - 1.3) / 0.6, 0, 1);
      this.bandTop = Math.min(cy + pr * (this.downK + 0.55 + 0.5 * tall), H - Math.max(50, H * 0.06));
      this.buildAmbient();
    },

    w2s(x, y) {
      return { x: this.cx + x * this.s, y: this.cy + y * this.s * this.K };
    },
    s2w(x, y) {
      return { x: (x - this.cx) / this.s, y: (y - this.cy) / (this.s * this.K) };
    },

    setTheme(i, instant) {
      const n = this.themeCount();
      i = ((i % n) + n) % n;
      if (i === this.theme) return;
      if (instant) {
        this.theme = i;
        this.prevTheme = -1;
        this.fade = 1;
        return;
      }
      this.prevTheme = this.theme;
      this.theme = i;
      this.fade = 0;
    },

    buildAmbient() {
      this.sparkles = [];
      for (let i = 0; i < 24; i++) {
        this.sparkles.push({ x: Math.random() * this.W, y: Math.random() * this.H, v: 7 + Math.random() * 16, s: 1.5 + Math.random() * 2.6, p: Math.random() * TAU, w: 0.6 + Math.random() * 1.5 });
      }
      this.glints = [];
      for (let i = 0; i < 14; i++) this.glints.push(this.newGlint(Math.random()));
      this.puffs = [];
      for (let i = 0; i < 3; i++) {
        this.puffs.push({ k: i, x: Math.random() * this.W, y: (0.15 + Math.random() * 0.55) * Math.max(40, this.bankTopY - 30), v: 4 + Math.random() * 7, sc: 0.5 + Math.random() * 0.35 });
      }
      if (FC.Ambient) FC.Ambient.reset(); // the worlds' particles are laid out for the screen size
    },
    newGlint(age) {
      const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * 0.9;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r, t: age || 0, d: 1.2 + Math.random() * 1.6, s: 0.6 + Math.random() * 0.8 };
    },

    update(dt) {
      if (this.fade < 1) {
        this.fade = Math.min(1, this.fade + dt / 1.8);
        if (this.fade >= 1) { this.prevTheme = -1; this.dropCaches(this.theme); }
      }
      for (const p of this.puffs) {
        p.x += p.v * dt;
        if (p.x > this.W + 200) p.x = -200;
      }
      for (const s of this.sparkles) {
        s.y -= s.v * dt;
        s.p += dt * s.w * 3;
        if (s.y < -10) { s.y = this.H + 10; s.x = Math.random() * this.W; }
      }
      for (let i = 0; i < this.glints.length; i++) {
        const g = this.glints[i];
        g.t += dt / g.d;
        if (g.t >= 1) this.glints[i] = this.newGlint(0);
      }
      if (FC.Ambient) FC.Ambient.update(dt);
    },

    // ---------------- drawing ----------------
    // place an image layer using its anchor (ax, ay) in image px at screen (x, y) with scale k
    blit(ctx, img, m, x, y, k) {
      if (!img || !img.naturalWidth) return;
      ctx.drawImage(img, x - m.ax * k, y - m.ay * k, m.w * k, m.h * k);
    },

    paintSky(ctx, ti) {
      const set = this.imgs[ti];
      const M = this.meta(ti);
      const W = this.W, H = this.H;
      const sky = set.sky;
      if (sky && sky.naturalWidth) {
        const S = M.sky.w;
        const ks = Math.max(W / S, H / S);
        let sy = this.cy - S * M.sky.horizon * ks;
        sy = Math.min(0, Math.max(H - S * ks, sy));
        ctx.drawImage(sky, (W - S * ks) / 2, sy, S * ks, S * ks);
      }
    },

    // where the far layer (the castle island) sits on screen: its anchor and scale (the ambient layer needs it too –
    // the rainbow of Rainbow Heights is painted into that layer)
    farPlace(ti) {
      const fm = this.meta(ti).far;
      const anchorY = this.bankTopY - this.pr * 0.3;
      let kf = (this.pr * 1.05) / fm.iw;
      kf = Math.max(kf * 0.55, Math.min(kf, (anchorY - 4) / Math.max(1, fm.ay - fm.top)));
      return { x: this.cx, y: anchorY, k: kf, m: fm };
    },

    paintMid(ctx, ti) {
      const set = this.imgs[ti];
      const M = this.meta(ti);
      const ks2 = (this.pr * 0.78) / M.sideL.iw;
      const ro = this.pr * (M.island.ringR / M.island.pondR);
      this.blit(ctx, set.sideL, M.sideL, this.cx - ro * 1.4, this.cy - this.pr * 0.62, ks2);
      this.blit(ctx, set.sideR, M.sideR, this.cx + ro * 1.42, this.cy - this.pr * 0.8, ks2);
      const fp = this.farPlace(ti);
      this.blit(ctx, set.far, fp.m, fp.x, fp.y, fp.k);
      const im = M.island;
      if (set.island && set.island.naturalWidth) ctx.drawImage(set.island, this.cx - im.pondX * this.ki, this.cy - im.pondY * this.ki, im.w * this.ki, im.h * this.ki);
    },

    drawThemeBack(ctx, ti) {
      const c = this.cacheFor(ti);
      if (!c) return;
      const W = this.W, H = this.H;
      ctx.drawImage(c.sky, 0, 0, W, H);
      const a0 = ctx.globalAlpha;
      // the world's own sky life (aurora, balloons, shooting stars …) sits behind the clouds and the islands
      if (FC.Ambient) FC.Ambient.sky(ctx, ti, a0);
      ctx.globalAlpha = a0 * 0.85;
      for (const p of this.puffs) {
        const pf = c.puffs[p.k];
        if (!pf) continue;
        const w = pf.w * p.sc, h = pf.h * p.sc;
        ctx.drawImage(pf.cv, p.x - w / 2, p.y, w, h);
      }
      ctx.globalAlpha = a0;
      ctx.drawImage(c.mid, 0, 0, W, H);
      if (FC.Ambient) FC.Ambient.over(ctx, ti, a0);
    },

    drawBack(ctx, t) {
      if (this.prevTheme >= 0 && this.fade < 1) {
        // the new world fades in over the old one (the old one stays opaque underneath)
        ctx.globalAlpha = 1;
        this.drawThemeBack(ctx, this.prevTheme);
        ctx.globalAlpha = FC.ease.inOutSine(this.fade);
        this.drawThemeBack(ctx, this.theme);
        ctx.globalAlpha = 1;
      } else this.drawThemeBack(ctx, this.theme);
      this.drawFalls(ctx, t);
    },

    drawFrontLayer(ctx) {
      const draw = (ti) => {
        const c = this.cacheFor(ti);
        if (c) ctx.drawImage(c.front, 0, 0, this.W, this.H);
      };
      if (this.prevTheme >= 0 && this.fade < 1) {
        draw(this.prevTheme);
        ctx.globalAlpha = FC.ease.inOutSine(this.fade);
        draw(this.theme);
        ctx.globalAlpha = 1;
      } else draw(this.theme);
    },

    // animated streaks over the painted falls of the main island
    drawFalls(ctx, t) {
      const im = this.meta().island;
      const k = this.ki;
      for (const f of im.falls) {
        const x = this.cx + (f.x - im.pondX) * k;
        const y0 = this.cy + (f.y - im.pondY) * k;
        let h = f.h * k;
        if (f.kind === 'main') h = Math.min(h, this.bandTop + this.pr * 0.3 - y0);
        this.fallOverlay(ctx, x, y0, f.w0 * k, f.w1 * k, h, t * (f.kind === 'spring' ? 1.15 : 1) + f.x * 0.01, f.kind, f.fade);
      }
    },

    fallOverlay(ctx, x, y0, w0, w1, h, t, kind, fade) {
      if (h < 4) return;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x - w0 / 2, y0);
      ctx.lineTo(x + w0 / 2, y0);
      ctx.lineTo(x + w1 / 2, y0 + h);
      ctx.lineTo(x - w1 / 2, y0 + h);
      ctx.closePath();
      ctx.clip();
      const n = Math.max(3, Math.round(w0 / 4));
      ctx.lineCap = 'round';
      const sp = kind === 'spring' ? 120 : 170;
      const hMax = fade ? h * (1 - fade * 0.55) : h;
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n;
        const spd = sp + ((i * 37) % 60);
        const len = 10 + ((i * 13) % 18);
        const gap = 16 + ((i * 7) % 22);
        const per = len + gap;
        const off = (t * spd + i * 53) % per;
        const a = i % 3 === 0 ? 0.75 : 0.4;
        ctx.strokeStyle = 'rgba(255,255,255,' + a + ')';
        ctx.lineWidth = i % 3 === 0 ? 2.2 : 1.4;
        ctx.beginPath();
        for (let yy = -per + off; yy < hMax; yy += per) {
          const q = yy / h;
          const xx = x + (f - 0.5) * (w0 + (w1 - w0) * q) * 0.9;
          ctx.moveTo(xx, y0 + yy);
          ctx.lineTo(xx, y0 + yy + len);
        }
        ctx.stroke();
      }
      ctx.restore();
      // bobbing foam at the lip
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 5; i++) {
        const fx = x - w0 * 0.42 + (i / 4) * w0 * 0.84;
        const r = Math.max(1.5, w0 * (0.1 + 0.03 * Math.sin(t * 5 + i * 1.9)));
        ctx.beginPath();
        ctx.arc(fx, y0 + 1, r, 0, TAU);
        ctx.fill();
      }
      if (kind === 'spring') {
        // splash where it meets the pond
        const by = y0 + h;
        for (let i = 0; i < 3; i++) {
          const k = (t * 0.8 + i / 3) % 1;
          ctx.beginPath();
          ctx.ellipse(x, by + 2, w1 * (0.6 + k * 1.6), w1 * (0.6 + k * 1.6) * this.K * 0.42, 0, 0, TAU);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = 'rgba(255,255,255,' + (0.7 * (1 - k)).toFixed(3) + ')';
          ctx.stroke();
        }
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(x + (i - 1.5) * w1 * 0.32, by + Math.sin(t * 7 + i) * 1.5, w1 * 0.18, 0, TAU);
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.fill();
        }
      }
    },

    // glints + gentle whirl on the water (world-projected)
    drawWaterFX(ctx, t, whirl, phase) {
      const cx = this.cx, cy = this.cy, pr = this.pr, K = this.K;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, pr * 0.99, pr * K * 0.99, 0, 0, TAU);
      ctx.clip();
      const arms = 5, rot = phase != null ? phase : t * 0.16; // turns with the physics whirlpool
      ctx.lineCap = 'round';
      const a0 = whirl == null ? 1 : whirl;
      for (let k = 0; k < arms; k++) {
        const base = rot + (k / arms) * TAU;
        let px = 0, py = 0;
        for (let i = 0; i <= 14; i++) {
          const f = i / 14;
          const r = FC.lerp(0.92, 0.2, f) * pr;
          const a = base + f * 1.9;
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * K;
          if (i > 0) {
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(x, y);
            ctx.lineWidth = FC.lerp(4, 1.4, f) * (pr / 300) + 0.7;
            ctx.strokeStyle = 'rgba(255,255,255,' + (0.13 * Math.sin(Math.PI * f) * a0).toFixed(3) + ')';
            ctx.stroke();
          }
          px = x; py = y;
        }
      }
      for (const g of this.glints) {
        const k = Math.sin(Math.PI * g.t);
        if (k <= 0.02) continue;
        const x = cx + g.x * pr, y = cy + g.y * pr * K;
        FC.sparklePath(ctx, x, y, (2 + 4 * g.s) * k * (pr / 300 + 0.4), 0.25);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.8 * k).toFixed(3) + ')';
        ctx.fill();
      }
      ctx.restore();
    },

    drawSea(ctx, t) {
      const draw = (ti, alpha) => {
        const c = this.cacheFor(ti);
        if (!c) return;
        const off = (t * 6) % c.seaW;
        ctx.globalAlpha = alpha;
        for (let x = -off; x < this.W; x += c.seaW) ctx.drawImage(c.sea, x, c.seaY, c.seaW, c.seaH);
        if (c.seaY + c.seaH < this.H) {
          ctx.fillStyle = c.seaFill;
          ctx.fillRect(0, c.seaY + c.seaH - 1, this.W, this.H - c.seaY - c.seaH + 1);
        }
        ctx.globalAlpha = 1;
      };
      if (this.prevTheme >= 0 && this.fade < 1) {
        draw(this.prevTheme, 1);
        draw(this.theme, FC.ease.inOutSine(this.fade));
      } else draw(this.theme, 1);
    },

    drawSparkles(ctx) {
      const pal = this.pal();
      // warm gold in the autumn light and at the starry dusk, moonlit cream at night, white by day
      const col = ['#ffffff', '#ffe6a6', '#fff6c8', '#ffffff', '#ffe9a8'][this.theme] || '#ffffff';
      for (const s of this.sparkles) {
        const k = 0.5 + 0.5 * Math.sin(s.p);
        if (k < 0.1) continue;
        FC.sparklePath(ctx, s.x + Math.sin(s.p * 0.5) * 6, s.y, s.s * (0.5 + k * 0.7), 0.3);
        ctx.fillStyle = FC.rgba(col, 0.2 + 0.55 * k);
        ctx.fill();
      }
      return pal;
    },
  };

  // ------------------------------------------------------------------
  // Tilly – the whipped-cream fairy who flicks the cakes
  // ------------------------------------------------------------------
  function drawTilly(ctx, x, y, s, t, mood, faceDir) {
    ctx.save();
    ctx.translate(x, y);
    const bob = Math.sin(t * 3.2) * s * 0.06;
    ctx.translate(0, bob);
    if (mood === 'cheer') ctx.rotate(Math.sin(t * 14) * 0.12);
    const lw = Math.max(1.2, s * 0.07);
    const flap = 0.65 + 0.35 * Math.abs(Math.sin(t * (mood === 'cheer' ? 22 : 13)));
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * s * 0.62, -s * 0.38);
      ctx.scale(side, flap);
      ctx.rotate(-0.25);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(s * 0.25, -s * 0.95, s * 1.15, -s * 0.95, s * 0.95, -s * 0.2);
      ctx.bezierCurveTo(s * 0.85, s * 0.12, s * 0.35, s * 0.15, 0, 0);
      const g = ctx.createLinearGradient(0, -s, s, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(1, 'rgba(225,200,255,0.85)');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = lw * 0.7;
      ctx.strokeStyle = 'rgba(190,150,220,0.9)';
      ctx.stroke();
      ctx.restore();
    }
    // soft shadow under Tilly
    const parts = [[0, 0.18, 1.0, 0.72], [0, -0.38, 0.74, 0.5], [0.04, -0.76, 0.46, 0.33]];
    for (const p of parts) {
      ctx.beginPath();
      ctx.ellipse(p[0] * s, p[1] * s, p[2] * s, p[3] * s, 0, 0, TAU);
      const g = ctx.createRadialGradient(-s * 0.3, (p[1] - p[3] * 0.6) * s, s * 0.05, 0, p[1] * s, p[2] * s * 1.1);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.7, '#fbf3fd');
      g.addColorStop(1, '#ead8f1');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = lw;
      ctx.strokeStyle = '#c9a3d6';
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, -s * 1.02);
    ctx.quadraticCurveTo(s * 0.08, -s * 1.42, s * 0.38, -s * 1.18);
    ctx.quadraticCurveTo(s * 0.18, -s * 1.06, s * 0.24, -s * 0.94);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = '#c9a3d6';
    ctx.stroke();
    FC.starPath(ctx, -s * 0.36, -s * 0.62, s * 0.16, 0.5);
    ctx.fillStyle = '#ffd34d';
    ctx.fill();
    const fx = (faceDir ? faceDir.x : 0) * s * 0.12, fy = (faceDir ? faceDir.y : 0) * s * 0.08;
    const ey = s * 0.12 + fy, ex = s * 0.3;
    const er = s * 0.12;
    ctx.fillStyle = 'rgba(255,140,170,0.55)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.56 + fx, ey + s * 0.16, er * 1.1, er * 0.65, 0, 0, TAU);
    ctx.ellipse(s * 0.56 + fx, ey + s * 0.16, er * 1.1, er * 0.65, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#3a2230';
    ctx.fillStyle = '#3a2230';
    ctx.lineWidth = er * 0.6;
    ctx.lineCap = 'round';
    if (mood === 'cheer') {
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(sx * ex + fx, ey + er * 0.5, er * 0.9, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
    } else if (mood === 'sad') {
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(sx * ex + fx, ey - er * 0.4, er * 0.9, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      }
    } else {
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(sx * ex + fx, ey, er * 0.8, er * (mood === 'aim' ? 0.85 : 1.05), 0, 0, TAU);
        ctx.fillStyle = '#3a2230';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx * ex + fx - er * 0.28, ey - er * 0.38, er * 0.34, 0, TAU);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    }
    const my = ey + s * 0.24;
    ctx.beginPath();
    if (mood === 'cheer') {
      ctx.ellipse(fx, my + er * 0.3, er * 0.75, er * 0.85, 0, 0, Math.PI);
      ctx.fillStyle = '#9b2d4a';
      ctx.fill();
    } else if (mood === 'aim') {
      ctx.arc(fx, my, er * 0.35, 0, TAU);
      ctx.fillStyle = '#9b2d4a';
      ctx.fill();
    } else if (mood === 'worried' || mood === 'sad') {
      ctx.moveTo(fx - er * 0.8, my + er * 0.3);
      ctx.quadraticCurveTo(fx, my - er * 0.4, fx + er * 0.8, my + er * 0.3);
      ctx.lineWidth = er * 0.45;
      ctx.stroke();
    } else {
      ctx.arc(fx, my - er * 0.2, er * 0.7, 0.2, Math.PI - 0.2);
      ctx.lineWidth = er * 0.45;
      ctx.stroke();
    }
    if (mood === 'worried') {
      const sx = s * 0.75, sy = -s * 0.1;
      ctx.beginPath();
      ctx.moveTo(sx, sy - er * 1.3);
      ctx.quadraticCurveTo(sx + er * 0.9, sy, sx, sy + er * 0.7);
      ctx.quadraticCurveTo(sx - er * 0.9, sy, sx, sy - er * 1.3);
      ctx.fillStyle = '#8fd8ff';
      ctx.fill();
    }
    ctx.restore();
  }

  Scene.drawTilly = drawTilly;
  FC.Scene = Scene;
})();
