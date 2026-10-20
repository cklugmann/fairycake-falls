/* Fairycake Falls – sound: a small Web Audio synth for all effects, and "Tilly's Lullaby", a generative
   music-box waltz: a composed 16-bar tune in G major (6/8) for music box, harp, a warm pad and a soft
   bass, with a little flute singing the tune on every other round, sparkles of fairy dust, a dreamy
   ping-pong echo on the melody and a hall of reverb (a generated impulse response). No audio files. */
(function () {
  'use strict';
  const FC = window.FC;

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const pitch = (s) => { const m = /^([A-G])(#?)(\d)$/.exec(s); return (+m[3] + 1) * 12 + NOTE[m[1]] + (m[2] ? 1 : 0); }; // "F#5" -> 78
  // a bar of melody: "D5:3 B4:1 -:2" = pitch:length in eighths, "-" = rest
  const parseBar = (s) => {
    let pos = 0;
    const out = [];
    for (const tok of s.split(/\s+/)) {
      const [p, l] = tok.split(':');
      const len = +l;
      if (p !== '-') out.push({ pos, len, n: pitch(p) });
      pos += len;
    }
    return out;
  };

  // ---------- the tune ----------
  const EIGHTH = 0.36;   // seconds per eighth note (6/8, dotted quarter = 55 bpm): a slow, rocking waltz
  const BAR = 6;         // eighths per bar
  const MUSIC_GAIN = 0.65;
  // chord voicing (for harp and pad, midi), the bass note, and the melody of each bar
  const SONG = [
    { chord: [55, 59, 62, 66], bass: 43, mel: 'D5:3 B4:1 A4:1 B4:1' },     // Gmaj7
    { chord: [55, 59, 62, 66], bass: 43, mel: 'G4:3 -:3' },
    { chord: [52, 55, 59, 62], bass: 40, mel: 'E5:2 D5:1 B4:3' },          // Em7
    { chord: [52, 55, 59, 62], bass: 40, mel: '-:3 D5:1 E5:1 F#5:1' },
    { chord: [48, 52, 55, 59], bass: 36, mel: 'G5:3 E5:2 D5:1' },          // Cmaj7
    { chord: [48, 52, 55, 59], bass: 36, mel: 'E5:3 -:3' },
    { chord: [50, 55, 57, 60], bass: 38, mel: 'A4:2 B4:1 C5:2 D5:1' },     // D7sus4
    { chord: [50, 54, 57, 60], bass: 38, mel: 'F#5:5 -:1' },               // D7
    { chord: [55, 59, 62, 66], bass: 43, mel: 'D5:3 B4:1 G4:2' },          // Gmaj7
    { chord: [50, 54, 57, 59], bass: 47, mel: 'F#5:2 D5:1 B4:3' },         // Bm7
    { chord: [48, 52, 55, 59], bass: 36, mel: 'E5:2 G5:1 E5:2 C5:1' },     // Cmaj7
    { chord: [48, 52, 55, 57], bass: 45, mel: 'C5:3 E5:2 D5:1' },          // Am7
    { chord: [50, 55, 59, 62], bass: 47, mel: 'B4:2 D5:1 G5:3' },          // G/B
    { chord: [48, 52, 55, 59], bass: 36, mel: 'F#5:2 E5:1 G5:3' },         // Cmaj7#11 – the lydian sparkle
    { chord: [50, 55, 57, 60], bass: 38, mel: 'A5:2 G5:1 F#5:1 E5:1 D5:1' }, // D7sus4 (a little run home)
    { chord: [55, 59, 62, 66], bass: 43, mel: 'G5:6' },                    // Gmaj7
  ];
  for (const b of SONG) b.notes = parseBar(b.mel);
  const HARP = [0, 1, 2, 3, 2, 1];                               // a rolling arpeggio over the four chord tones
  const SPARKLE = [79, 81, 83, 86, 88, 91, 93, 95, 98, 100];     // G major pentatonic, high up: fairy dust

  const Audio = {
    ctx: null,
    master: null, sfx: null, music: null, melody: null, verb: null,
    sfxOn: FC.store.get('sfx', true),
    musicOn: FC.store.get('music', true),
    lastBump: 0,
    musicTimer: null,
    nextNoteT: 0,
    step: 0,

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
      this.buildGraph(this.ctx);
      if (this.musicOn) this.startMusic();
    },

    // master -> compressor -> out; sfx and music buses; a reverb send for both; a ping-pong echo for the melody
    buildGraph(c) {
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 12;
      comp.ratio.value = 3;
      comp.attack.value = 0.01;
      comp.release.value = 0.25;
      this.master = c.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(comp);
      comp.connect(c.destination);
      this.sfx = c.createGain();
      this.sfx.gain.value = this.sfxOn ? 0.8 : 0;
      this.sfx.connect(this.master);
      this.music = c.createGain();
      this.music.gain.value = this.musicOn ? MUSIC_GAIN : 0;
      this.music.connect(this.master);
      // the hall: a generated impulse response (2.6 s, darker towards the end)
      const conv = c.createConvolver();
      conv.buffer = this.makeReverb(c, 2.6, 2.4);
      const wet = c.createGain();
      wet.gain.value = 0.55;
      conv.connect(wet);
      wet.connect(this.master);
      this.verb = c.createGain();          // the send: anything connected here goes into the hall
      this.verb.gain.value = 1;
      this.verb.connect(conv);
      // the melody bus: into the music bus, and into a dotted-eighth ping-pong echo that fades left and right
      this.melody = c.createGain();
      this.melody.gain.value = 1;
      this.melody.connect(this.music);
      const dl = c.createDelay(2), dr = c.createDelay(2);
      dl.delayTime.value = EIGHTH * 1.5;
      dr.delayTime.value = EIGHTH * 1.5;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2400;
      const fb = c.createGain();
      fb.gain.value = 0.34;
      const send = c.createGain();
      send.gain.value = 0.3;
      this.melody.connect(send);
      send.connect(dl);
      dl.connect(lp);
      lp.connect(fb);
      fb.connect(dr);
      dr.connect(fb);
      const pl = this.panner(c, -0.65), pr = this.panner(c, 0.65);
      dl.connect(pl); pl.connect(this.music);
      dr.connect(pr); pr.connect(this.music);
      this.noiseBuf = this.makeNoise(c);
    },

    panner(c, p) {
      if (c.createStereoPanner) { const n = c.createStereoPanner(); n.pan.value = p; return n; }
      const g = c.createGain(); g.gain.value = 1; return g;
    },

    makeNoise(c) {
      const len = c.sampleRate * 1;
      const b = c.createBuffer(1, len, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return b;
    },

    // a stereo impulse response: decaying noise that gets darker as it fades (the convolver normalises it)
    makeReverb(c, seconds, decay) {
      const n = Math.floor(c.sampleRate * seconds);
      const b = c.createBuffer(2, n, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch);
        const rng = FC.rng(1234 + ch * 77);
        let lp = 0;
        for (let i = 0; i < n; i++) {
          const x = i / n;
          const env = Math.pow(1 - x, decay) * (i < 300 ? i / 300 : 1);
          const a = 0.55 - 0.42 * x;
          lp += (rng() * 2 - 1 - lp) * a;
          d[i] = lp * env;
        }
      }
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
      this.music.gain.setTargetAtTime(on ? MUSIC_GAIN : 0, this.ctx.currentTime, 0.4);
      if (on) this.startMusic();
      else this.stopMusic();
    },

    // ---------- primitives (t = absolute context time) ----------
    toneAt(t, freq, dur, o) {
      o = o || {};
      const c = this.ctx;
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
      return g;
    },
    noiseAt(t, dur, o) {
      o = o || {};
      const c = this.ctx;
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
      g.connect(o.dest || this.sfx);
      if (o.echo) g.connect(this.verb);
      src.start(t, Math.random() * 0.5);
      src.stop(t + dur + 0.05);
    },
    // effects helpers (now + delay, silent when sound is off)
    tone(freq, dur, o) {
      if (!this.ctx || !this.sfxOn) return;
      this.toneAt(this.ctx.currentTime + ((o && o.delay) || 0), freq, dur, o);
    },
    noise(dur, o) {
      if (!this.ctx || !this.sfxOn) return;
      this.noiseAt(this.ctx.currentTime + ((o && o.delay) || 0), dur, o);
    },

    // ---------- instruments ----------
    // music box / celesta: a bright little tine – a sine fundamental with a few quickly fading partials
    // and the tiny click of the pin, into the hall
    mbox(freq, t, vol, o) {
      o = o || {};
      const c = this.ctx;
      freq = Math.min(freq, 5200);
      const out = c.createGain();
      out.gain.value = 1;
      const pan = o.pan != null ? this.panner(c, o.pan) : null;
      if (pan) { out.connect(pan); pan.connect(o.dest || this.sfx); } else out.connect(o.dest || this.sfx);
      const vs = c.createGain();
      vs.gain.value = o.verb == null ? 0.7 : o.verb;
      out.connect(vs);
      vs.connect(this.verb);
      const life = o.dur || FC.clamp(2.3 - freq / 1500, 0.6, 2.1); // high notes ring shorter
      const parts = [[1, 1], [2, 0.3], [3, 0.09], [4.16, 0.06], [5.43, 0.025]];
      for (const [k, a] of parts) {
        const f = freq * k;
        if (f > 15000) continue;
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        const g = c.createGain();
        const d = life / (1 + (k - 1) * 0.9);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol * a, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        osc.connect(g);
        g.connect(out);
        osc.start(t);
        osc.stop(t + d + 0.05);
      }
      if (o.click !== false) this.noiseAt(t, 0.018, { freq: Math.min(9000, freq * 3.5), q: 1.4, vol: vol * 0.22, dest: out });
    },
    // harp: a plucked string – a triangle whose brightness closes right after the pluck
    harp(freq, t, vol, o) {
      o = o || {};
      const c = this.ctx;
      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const osc2 = c.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = freq * 2;
      const g2 = c.createGain();
      g2.gain.value = 0.22;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 0.8;
      f.frequency.setValueAtTime(Math.min(12000, freq * 7), t);
      f.frequency.exponentialRampToValueAtTime(Math.max(250, freq * 1.3), t + 0.4);
      const g = c.createGain();
      const dur = o.dur || 1.2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(f);
      osc2.connect(g2);
      g2.connect(f);
      f.connect(g);
      const pan = this.panner(c, o.pan || 0);
      g.connect(pan);
      pan.connect(o.dest || this.music);
      const vs = c.createGain();
      vs.gain.value = 0.5;
      g.connect(vs);
      vs.connect(this.verb);
      osc.start(t); osc.stop(t + dur + 0.1);
      osc2.start(t); osc2.stop(t + dur + 0.1);
    },
    // a warm pad: two detuned triangles per note under a slow, breathing low-pass, spread across the stereo field
    pad(notes, t, dur, vol) {
      const c = this.ctx;
      notes.forEach((n, i) => {
        const f = midi(n);
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 420 + i * 70;
        lp.Q.value = 0.6;
        const lfo = c.createOscillator();
        lfo.frequency.value = 0.11 + i * 0.02;
        const lg = c.createGain();
        lg.gain.value = 140;
        lfo.connect(lg);
        lg.connect(lp.frequency);
        lfo.start(t); lfo.stop(t + dur + 0.2);
        for (const det of [-6, 6]) {
          const osc = c.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = f;
          osc.detune.value = det;
          osc.connect(lp);
          osc.start(t); osc.stop(t + dur + 0.2);
        }
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + 1.4);
        g.gain.setValueAtTime(vol, t + Math.max(1.4, dur - 1.1));
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        lp.connect(g);
        const pan = this.panner(c, (i - 1.5) * 0.36);
        g.connect(pan);
        pan.connect(this.music);
        const vs = c.createGain();
        vs.gain.value = 0.8;
        g.connect(vs);
        vs.connect(this.verb);
      });
    },
    // a soft bass: a sine with a touch of its octave, a gentle bloom
    bass(n, t, vol) {
      const c = this.ctx;
      const f = midi(n);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.0);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 320;
      for (const [k, a, type] of [[1, 1, 'sine'], [2, 0.35, 'triangle']]) {
        const osc = c.createOscillator();
        osc.type = type;
        osc.frequency.value = f * k;
        const og = c.createGain();
        og.gain.value = a;
        osc.connect(og);
        og.connect(lp);
        osc.start(t); osc.stop(t + 2.2);
      }
      lp.connect(g);
      g.connect(this.music);
    },
    // a little flute: a sine with a whisper of its octave and a vibrato that sets in after the note has settled
    flute(freq, t, dur, vol, o) {
      o = o || {};
      const c = this.ctx;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.07);
      g.gain.setValueAtTime(vol, t + Math.max(0.07, dur - 0.14));
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      const lfo = c.createOscillator();
      lfo.frequency.value = 5.3;
      const lg = c.createGain();
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(9, t + 0.45);
      lfo.connect(lg);
      for (const [k, a] of [[1, 1], [2, 0.14], [3, 0.03]]) {
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq * k;
        lg.connect(osc.detune);
        const og = c.createGain();
        og.gain.value = a;
        osc.connect(og);
        og.connect(g);
        osc.start(t); osc.stop(t + dur + 0.1);
      }
      lfo.start(t); lfo.stop(t + dur + 0.1);
      this.noiseAt(t, dur, { filter: 'bandpass', freq: freq * 2, q: 2, vol: vol * 0.06, attack: 0.08, dest: g }); // breath
      const pan = this.panner(c, o.pan || 0);
      g.connect(pan);
      pan.connect(o.dest || this.music);
      const vs = c.createGain();
      vs.gain.value = 0.6;
      g.connect(vs);
      vs.connect(this.verb);
    },
    // a little chime for the effects (kept for the old call sites): freq, length, volume, delay, destination
    bell(freq, dur, vol, delay, dest) {
      if (!this.ctx || !this.sfxOn) return;
      this.mbox(freq, this.ctx.currentTime + (delay || 0), vol, { dur, dest });
    },

    // ---------- game sounds ----------
    click() {
      this.tone(880, 0.06, { type: 'triangle', vol: 0.1 });
    },
    // the detents while pulling (every 25 %): a rising G major arpeggio on the music box, a sparkle at full power
    tick(p) {
      if (!this.ctx || !this.sfxOn) return;
      const step = Math.min(4, Math.max(1, Math.round(p * 4)));
      const now = this.ctx.currentTime;
      this.mbox(midi([67, 71, 74, 79][step - 1]), now, 0.055, { dur: 0.5 });
      if (p >= 0.99) {
        this.mbox(midi(91), now + 0.05, 0.05, { dur: 0.9, pan: 0.3 });
        this.noiseAt(now, 0.25, { freq: 5000, sweep: 9000, q: 0.8, vol: 0.03, echo: true });
      }
    },
    // picking the cake up: a soft little pluck
    grab() {
      if (!this.ctx || !this.sfxOn) return;
      this.mbox(midi(83), this.ctx.currentTime, 0.04, { dur: 0.3, click: false });
    },
    // the pull: an airy shimmer of fairy dust that brightens and swells with the tension (the detents play the
    // rising arpeggio, see tick – no creaking rubber any more)
    stretch(t) {
      if (!this.ctx || !this.sfxOn) return;
      const c = this.ctx, now = c.currentTime;
      if (t <= 0.01) {
        if (this.st) {
          const st = this.st;
          st.g1.gain.setTargetAtTime(0.0001, now, 0.04);
          setTimeout(() => { try { st.src.stop(); } catch (e) { /* ignore */ } }, 250);
          this.st = null;
        }
        return;
      }
      if (!this.st) {
        const src = c.createBufferSource();
        src.buffer = this.noiseBuf;
        src.loop = true;
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 2.4;
        const g1 = c.createGain();
        g1.gain.value = 0.0001;
        src.connect(bp); bp.connect(g1); g1.connect(this.sfx); g1.connect(this.verb);
        src.start();
        this.st = { src, bp, g1 };
      }
      const st = this.st;
      st.bp.frequency.setTargetAtTime(900 + t * 2600, now, 0.06);
      st.g1.gain.setTargetAtTime(0.005 + t * 0.035, now, 0.06);
    },
    // the release: a soft pluck, a thump and a whoosh that grows with power
    launch(power) {
      this.stretch(0);
      this.tone(230 + power * 130, 0.13, { type: 'triangle', slide: 0.6, vol: 0.09 });
      this.tone(92, 0.14, { type: 'sine', slide: 0.6, vol: 0.14 });
      this.noise(0.2 + power * 0.2, { freq: 900, sweep: 3600, q: 0.7, vol: 0.04 + power * 0.1, echo: true });
    },
    // the glide ends and the cake settles into the water
    plip(size) {
      this.tone(Math.max(260, 760 - size * 40), 0.09, { type: 'sine', slide: 1.5, vol: 0.05 });
    },
    // hot streak grows: a rising sparkle
    streak(n) {
      const base = 76 + Math.min(10, (n - 2) * 2);
      [0, 4, 7].forEach((k, i) => this.bell(midi(base + k), 0.6, 0.06, 0.04 + i * 0.06));
    },
    streakLost() {
      this.tone(330, 0.18, { type: 'triangle', slide: 0.7, vol: 0.06 });
    },
    bump(strength, size) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      if (now - this.lastBump < 0.035) return;
      this.lastBump = now;
      const v = Math.min(0.2, 0.03 + strength / 5000);
      const f = 520 - size * 28 + Math.random() * 40;
      this.tone(Math.max(140, f), 0.11, { type: 'sine', slide: 0.55, vol: v });
      this.tone(Math.max(280, f * 2.1), 0.05, { type: 'triangle', vol: v * 0.3 });
    },
    rim(strength) {
      const v = Math.min(0.16, 0.03 + strength / 7000);
      this.noise(0.16, { freq: 700, sweep: 300, q: 1.4, vol: v });
      this.tone(260, 0.1, { slide: 0.7, vol: v * 0.7 });
    },
    merge(tier, combo) {
      const PENTA = [0, 2, 4, 7, 9];
      const base = 60 + Math.min(12, (combo - 1) * 2); // rises with the combo
      const note = Math.min(84, base + PENTA[(tier + combo) % 5] + 12 * Math.floor(tier / 7));
      this.noise(0.12, { freq: 2400, q: 0.6, vol: 0.08 });
      this.tone(midi(note) * 0.5, 0.15, { type: 'sine', slide: 1.6, vol: 0.14 });
      this.bell(midi(note + 12), 1.0, 0.16, 0.02);
      if (tier >= 5) this.bell(midi(note + 19), 1.2, 0.1, 0.09);
      if (combo >= 3) this.bell(midi(note + 24), 0.9, 0.07, 0.15);
    },
    discover() {
      [0, 4, 7, 12, 16].forEach((n, i) => this.bell(midi(72 + n), 1.2, 0.11, i * 0.07));
    },
    levelUp() {
      [0, 4, 7, 12].forEach((n, i) => this.bell(midi(67 + n), 1.1, 0.14, i * 0.11));
      this.tone(midi(55), 0.6, { type: 'triangle', vol: 0.08, delay: 0.3 });
    },
    royal() {
      [0, 4, 7, 11, 14, 19, 24].forEach((n, i) => this.bell(midi(64 + n), 1.8, 0.12, i * 0.06));
      this.noise(1.2, { freq: 3000, sweep: 9000, q: 0.5, vol: 0.06, echo: true });
    },
    swap() {
      this.bell(midi(76), 0.3, 0.06, 0);
      this.bell(midi(83), 0.3, 0.06, 0.06);
    },
    poof() {
      this.noise(0.4, { freq: 3000, sweep: 600, q: 0.7, vol: 0.14, echo: true });
      [12, 7, 4].forEach((n, i) => this.bell(midi(72 + n), 0.5, 0.07, i * 0.05));
    },
    magic() {
      [0, 7, 12, 19].forEach((n, i) => this.bell(midi(76 + n), 0.8, 0.09, i * 0.05));
    },
    bubble() {
      this.tone(500, 0.12, { slide: 2.6, vol: 0.12 });
      this.bell(midi(84), 0.7, 0.09, 0.05);
      this.bell(midi(88), 0.7, 0.07, 0.1);
    },
    // a cake is in danger: a soft, slightly uneasy two-note call
    danger() {
      this.tone(392, 0.14, { type: 'triangle', vol: 0.07 });
      this.tone(370, 0.16, { type: 'triangle', vol: 0.06, delay: 0.16 });
    },
    // the order is filled
    orderDone() {
      [0, 4, 7, 12].forEach((n, i) => this.bell(midi(72 + n), 0.8, 0.11, i * 0.07));
      this.tone(midi(48), 0.5, { type: 'triangle', vol: 0.08, delay: 0.1 });
    },
    // the stage whirl: a rising swoosh, a shimmer on top, a soft settle at the end
    whirl() {
      this.noise(1.4, { freq: 300, sweep: 2600, q: 0.8, vol: 0.14, attack: 0.3, echo: true });
      this.noise(1.8, { freq: 2200, sweep: 700, q: 0.7, vol: 0.1, attack: 0.5, delay: 1.3 });
      this.tone(110, 1.6, { type: 'sine', slide: 2.2, vol: 0.07, attack: 0.4 });
      [0, 2, 4, 7, 9, 12, 14, 16].forEach((n, i) => this.bell(midi(76 + n), 0.6, 0.045, 0.25 + i * 0.09));
      this.noise(0.6, { freq: 500, sweep: 200, q: 1.0, vol: 0.08, delay: 2.9 });
    },
    gameOver() {
      [12, 7, 4, 0, -5].forEach((n, i) => this.bell(midi(67 + n), 1.2, 0.12, i * 0.18));
    },

    // ---------- Tilly's Lullaby ----------
    startMusic() {
      if (!this.ctx || this.musicTimer) return;
      this.nextNoteT = this.ctx.currentTime + 0.15;
      this.step = 0;
      this.musicTimer = setInterval(() => this.schedule(this.ctx.currentTime), 120);
    },
    stopMusic() {
      if (!this.musicTimer) return;
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    },
    // schedule everything up to a good second ahead of "now" (background tabs throttle timers to once a second)
    schedule(now) {
      if (!this.ctx) return;
      while (this.nextNoteT < now + 1.3) {
        this.playStep(this.step, this.nextNoteT);
        this.step++;
        this.nextNoteT += EIGHTH;
      }
    },
    // one eighth of the tune. Round 0, 2, 4 …: the music box sings over the rolling harp; round 1, 3 …: the flute
    // takes the tune an octave lower with the music box only touching the long notes, and the harp thins out
    playStep(step, t) {
      const bars = SONG.length;
      const bar = Math.floor(step / BAR) % bars, pos = step % BAR, round = Math.floor(step / (BAR * bars));
      const B = SONG[bar];
      const fluteRound = round % 2 === 1;
      if (pos === 0) {
        this.pad(B.chord, t, BAR * EIGHTH + 0.7, 0.017);
        this.bass(B.bass, t, 0.06);
      }
      if (!fluteRound || pos === 0 || pos === 2 || pos === 3 || pos === 5) {
        const n = B.chord[HARP[pos]];
        this.harp(midi(n), t + (Math.random() - 0.5) * 0.012, pos === 0 ? 0.08 : pos === 3 ? 0.062 : 0.048, { pan: (pos / 5 - 0.5) * 0.7 });
      }
      for (const m of B.notes) {
        if (m.pos !== pos) continue;
        if (!fluteRound) this.mbox(midi(m.n), t, m.len >= 3 ? 0.21 : 0.17, { dest: this.melody, pan: 0.12, verb: 0.5 });
        else {
          this.flute(midi(m.n - 12), t, m.len * EIGHTH - 0.05, 0.13, { dest: this.melody, pan: -0.1 });
          if (m.len >= 3) this.mbox(midi(m.n + 12), t + 0.03, 0.05, { dest: this.melody, pan: 0.4, verb: 0.9 });
        }
      }
      // fairy dust: a sparkle now and then, high up and far left or right
      if (Math.random() < (fluteRound ? 0.05 : 0.08)) {
        const n = SPARKLE[Math.floor(Math.random() * SPARKLE.length)];
        this.mbox(midi(n), t + Math.random() * 0.25, 0.022 + Math.random() * 0.022, { dest: this.music, pan: Math.random() * 1.6 - 0.8, verb: 1 });
      }
    },

    // render the tune offline (tools/render-music.js): resolves with an AudioBuffer of `seconds` seconds
    renderMusic(seconds) {
      const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const rate = 44100;
      const off = new Off(2, Math.ceil(rate * seconds), rate);
      const live = { ctx: this.ctx, master: this.master, sfx: this.sfx, music: this.music, melody: this.melody, verb: this.verb, noiseBuf: this.noiseBuf, step: this.step, nextNoteT: this.nextNoteT };
      this.ctx = off;
      this.buildGraph(off);
      this.music.gain.value = MUSIC_GAIN;
      this.step = 0;
      this.nextNoteT = 0.1;
      for (let now = 0; now < seconds; now += 0.4) this.schedule(now);
      const p = off.startRendering();
      Object.assign(this, live);
      return p;
    },
  };

  FC.Audio = Audio;
})();
