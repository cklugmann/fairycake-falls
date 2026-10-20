/* Fairycake Falls – sound: small Web Audio synth for all effects plus a
   gentle, generative music-box lullaby. No audio files needed. */
(function () {
  'use strict';
  const FC = window.FC;

  const PENTA = [0, 2, 4, 7, 9]; // major pentatonic
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  const Audio = {
    ctx: null,
    master: null, sfx: null, music: null, verb: null,
    sfxOn: FC.store.get('sfx', true),
    musicOn: FC.store.get('music', true),
    lastBump: 0,
    musicTimer: null,
    nextNoteT: 0,
    step: 0,
    chord: 0,

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch (e) {
        return;
      }
      const c = this.ctx;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 4;
      this.master = c.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(comp);
      comp.connect(c.destination);
      this.sfx = c.createGain();
      this.sfx.gain.value = this.sfxOn ? 0.8 : 0;
      this.sfx.connect(this.master);
      this.music = c.createGain();
      this.music.gain.value = this.musicOn ? 0.22 : 0;
      this.music.connect(this.master);
      // dreamy echo for bells
      const delay = c.createDelay(1.0);
      delay.delayTime.value = 0.32;
      const fb = c.createGain();
      fb.gain.value = 0.32;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2600;
      delay.connect(lp);
      lp.connect(fb);
      fb.connect(delay);
      this.verb = c.createGain();
      this.verb.gain.value = 0.5;
      this.verb.connect(delay);
      delay.connect(this.master);
      this.noiseBuf = this.makeNoise();
      if (this.musicOn) this.startMusic();
    },

    makeNoise() {
      const c = this.ctx;
      const len = c.sampleRate * 1;
      const b = c.createBuffer(1, len, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return b;
    },

    setSfx(on) {
      this.sfxOn = on;
      FC.store.set('sfx', on);
      if (this.sfx) this.sfx.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
    },
    setMusic(on) {
      this.musicOn = on;
      FC.store.set('music', on);
      if (!this.ctx) return;
      this.music.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.3);
      if (on) this.startMusic();
    },

    // ---------- primitives ----------
    tone(freq, dur, o) {
      if (!this.ctx || !this.sfxOn) return;
      o = o || {};
      const c = this.ctx;
      const t = c.currentTime + (o.delay || 0);
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * o.slide), t + dur);
      const v = o.vol == null ? 0.3 : o.vol;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(o.dest || this.sfx);
      if (o.echo) g.connect(this.verb);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    },

    noise(dur, o) {
      if (!this.ctx || !this.sfxOn) return;
      o = o || {};
      const c = this.ctx;
      const t = c.currentTime + (o.delay || 0);
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = c.createBiquadFilter();
      f.type = o.filter || 'bandpass';
      f.frequency.setValueAtTime(o.freq || 1200, t);
      if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
      f.Q.value = o.q || 1;
      const g = c.createGain();
      const v = o.vol == null ? 0.2 : o.vol;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.01));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f);
      f.connect(g);
      g.connect(this.sfx);
      src.start(t, Math.random() * 0.5);
      src.stop(t + dur + 0.05);
    },

    bell(freq, dur, vol, delay, dest) {
      freq = Math.min(freq, 4200);
      this.tone(freq, dur, { vol, delay, echo: true, dest });
      if (freq * 2 < 12000) this.tone(freq * 2.0, dur * 0.6, { vol: vol * 0.28, delay, dest });
      if (freq * 3.01 < 12000) this.tone(freq * 3.01, dur * 0.35, { vol: vol * 0.1, delay, dest });
    },

    // ---------- game sounds ----------
    click() {
      this.tone(880, 0.06, { type: 'triangle', vol: 0.12 });
    },
    // little detents while pulling (every 25 %), brighter towards full power
    tick(p) {
      this.tone(420 + p * 760, 0.05, { type: 'triangle', vol: 0.09 });
      if (p >= 0.99) this.bell(1320, 0.35, 0.07);
    },
    // picking the cake up
    grab() {
      this.tone(620, 0.05, { type: 'sine', slide: 1.25, vol: 0.06 });
    },
    // rubber band creak that follows the tension (0 = silent)
    stretch(t) {
      if (!this.ctx || !this.sfxOn) return;
      const c = this.ctx, now = c.currentTime;
      if (t <= 0.01) {
        if (this.st) {
          this.st.g.gain.setTargetAtTime(0.0001, now, 0.03);
          const st = this.st;
          setTimeout(() => { try { st.o.stop(); st.o2.stop(); } catch (e) { /* ignore */ } }, 200);
          this.st = null;
        }
        return;
      }
      if (!this.st) {
        const o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
        o.type = 'sawtooth'; o2.type = 'triangle';
        f.type = 'bandpass'; f.Q.value = 3;
        g.gain.value = 0.0001;
        o.connect(f); o2.connect(f); f.connect(g); g.connect(this.sfx);
        o.start(); o2.start();
        this.st = { o, o2, f, g };
      }
      const st = this.st;
      st.o.frequency.setTargetAtTime(70 + t * 120, now, 0.03);
      st.o2.frequency.setTargetAtTime(140 + t * 300, now, 0.03);
      st.f.frequency.setTargetAtTime(500 + t * 1400, now, 0.04);
      st.g.gain.setTargetAtTime(0.012 + t * 0.03, now, 0.04);
    },
    // the release: a plucked band, a soft thump and a whoosh that grows with power
    launch(power) {
      this.stretch(0);
      this.tone(210 + power * 120, 0.16, { type: 'triangle', slide: 0.55, vol: 0.2 });
      this.tone(420 + power * 240, 0.09, { type: 'triangle', slide: 0.7, vol: 0.08 });
      this.tone(95, 0.14, { type: 'sine', slide: 0.6, vol: 0.18 });
      this.noise(0.18 + power * 0.18, { freq: 1200, sweep: 3800, q: 0.7, vol: 0.05 + power * 0.13 });
    },
    // the glide ends and the cake settles into the water
    plip(size) {
      this.tone(Math.max(260, 760 - size * 40), 0.09, { type: 'sine', slide: 1.5, vol: 0.06 });
    },
    // hot streak grows: rising sparkle
    streak(n) {
      const base = 76 + Math.min(10, (n - 2) * 2);
      [0, 4, 7].forEach((k, i) => this.bell(midi(base + k), 0.5, 0.07, 0.04 + i * 0.05));
    },
    streakLost() {
      this.tone(330, 0.18, { type: 'triangle', slide: 0.7, vol: 0.07 });
    },
    bump(strength, size) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      if (now - this.lastBump < 0.035) return;
      this.lastBump = now;
      const v = Math.min(0.28, 0.04 + strength / 4500);
      const f = 520 - size * 28 + Math.random() * 40;
      this.tone(Math.max(140, f), 0.11, { type: 'sine', slide: 0.55, vol: v });
      this.tone(Math.max(280, f * 2.1), 0.05, { type: 'triangle', vol: v * 0.35 });
    },
    rim(strength) {
      const v = Math.min(0.2, 0.03 + strength / 6000);
      this.noise(0.16, { freq: 700, sweep: 300, q: 1.4, vol: v });
      this.tone(260, 0.1, { slide: 0.7, vol: v * 0.7 });
    },
    merge(tier, combo) {
      const base = 60 + Math.min(12, (combo - 1) * 2); // rises with combo
      const note = Math.min(84, base + PENTA[(tier + combo) % 5] + 12 * Math.floor(tier / 7));
      this.noise(0.12, { freq: 2400, q: 0.6, vol: 0.12 });
      this.tone(midi(note) * 0.5, 0.15, { type: 'sine', slide: 1.6, vol: 0.2 });
      this.bell(midi(note + 12), 0.9, 0.18, 0.02);
      if (tier >= 6) this.bell(midi(note + 19), 1.2, 0.12, 0.09);
      if (combo >= 3) this.bell(midi(note + 24), 0.8, 0.08, 0.14);
    },
    discover() {
      [0, 4, 7, 12, 16].forEach((n, i) => this.bell(midi(72 + n), 1.1, 0.13, i * 0.07));
    },
    levelUp() {
      [0, 4, 7, 12].forEach((n, i) => this.bell(midi(67 + n), 1.0, 0.16, i * 0.11));
      this.tone(midi(55), 0.6, { type: 'triangle', vol: 0.12, delay: 0.3 });
    },
    royal() {
      [0, 4, 7, 11, 14, 19, 24].forEach((n, i) => this.bell(midi(64 + n), 1.6, 0.14, i * 0.06));
      this.noise(1.2, { freq: 3000, sweep: 9000, q: 0.5, vol: 0.08 });
    },
    swap() {
      this.tone(660, 0.07, { type: 'triangle', vol: 0.1 });
      this.tone(990, 0.07, { type: 'triangle', vol: 0.1, delay: 0.06 });
    },
    poof() {
      this.noise(0.4, { freq: 3000, sweep: 600, q: 0.7, vol: 0.18 });
      [12, 7, 4].forEach((n, i) => this.bell(midi(72 + n), 0.5, 0.08, i * 0.05));
    },
    magic() {
      [0, 7, 12, 19].forEach((n, i) => this.bell(midi(76 + n), 0.7, 0.1, i * 0.05));
    },
    bubble() {
      this.tone(500, 0.12, { slide: 2.6, vol: 0.18 });
      this.bell(midi(84), 0.6, 0.1, 0.05);
      this.bell(midi(88), 0.6, 0.08, 0.1);
    },
    danger() {
      this.tone(196, 0.16, { type: 'triangle', vol: 0.12 });
      this.tone(185, 0.16, { type: 'triangle', vol: 0.1, delay: 0.17 });
    },
    // the order is filled
    orderDone() {
      [0, 4, 7, 12].forEach((n, i) => this.bell(midi(72 + n), 0.7, 0.12, i * 0.07));
      this.tone(midi(48), 0.5, { type: 'triangle', vol: 0.1, delay: 0.1 });
    },
    // the stage whirl: a rising swoosh, a shimmer on top, a soft settle at the end
    whirl() {
      this.noise(1.4, { freq: 300, sweep: 2600, q: 0.8, vol: 0.16, attack: 0.3 });
      this.noise(1.8, { freq: 2200, sweep: 700, q: 0.7, vol: 0.12, attack: 0.5, delay: 1.3 });
      this.tone(110, 1.6, { type: 'sine', slide: 2.2, vol: 0.08, attack: 0.4 });
      [0, 2, 4, 7, 9, 12, 14, 16].forEach((n, i) => this.bell(midi(76 + n), 0.5, 0.05, 0.25 + i * 0.09));
      this.noise(0.6, { freq: 500, sweep: 200, q: 1.0, vol: 0.09, delay: 2.9 });
    },
    gameOver() {
      [12, 7, 4, 0, -5].forEach((n, i) => this.bell(midi(67 + n), 1.0, 0.14, i * 0.18));
    },

    // ---------- music box lullaby ----------
    startMusic() {
      if (!this.ctx || this.musicTimer) return;
      this.nextNoteT = this.ctx.currentTime + 0.1;
      this.step = 0;
      this.musicTimer = setInterval(() => this.schedule(), 60);
    },
    schedule() {
      if (!this.ctx || !this.musicOn) return;
      const c = this.ctx;
      const beat = 60 / 92 / 2; // eighth notes at 92 bpm
      const chords = [
        [60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62],
        [60, 64, 67], [52, 55, 60], [53, 57, 60], [55, 59, 62],
      ];
      while (this.nextNoteT < c.currentTime + 0.25) {
        const bar = Math.floor(this.step / 8) % chords.length;
        const ch = chords[bar];
        const pos = this.step % 8;
        const t = this.nextNoteT;
        const delay = Math.max(0, t - c.currentTime);
        if (pos === 0) {
          // soft pad
          for (const n of ch) this.padNote(midi(n - 12), beat * 7.5, 0.05, delay);
          this.padNote(midi(ch[0] - 24), beat * 7.5, 0.06, delay);
        }
        // music-box arpeggio with gentle variation
        const pattern = [0, 2, 1, 2, 0, 2, 1, 2];
        let n = ch[pattern[pos]] + 12;
        if (Math.random() < 0.18) n += PENTA[Math.floor(Math.random() * 5)] - 2;
        if (pos === 0 || Math.random() < 0.82) this.bell(midi(n + (pos % 4 === 0 ? 12 : 0)), 1.2, pos === 0 ? 0.11 : 0.06, delay, this.music);
        this.step++;
        this.nextNoteT += beat;
      }
    },
    padNote(freq, dur, vol, delay) {
      const c = this.ctx;
      const t = c.currentTime + delay;
      const osc = c.createOscillator();
      const f = c.createBiquadFilter();
      const g = c.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      f.type = 'lowpass';
      f.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.6);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      osc.connect(f);
      f.connect(g);
      g.connect(this.music);
      osc.start(t);
      osc.stop(t + dur + 0.1);
    },
  };

  FC.Audio = Audio;
})();
