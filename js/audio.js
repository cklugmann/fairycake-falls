/* Fairycake Falls – sound. A small Web Audio synth for all effects, and "Tilly's Lullaby": a composed
   16-bar waltz in G major (6/8) for celesta, harp, a warm pad and a soft bass, with a little flute on
   every other round and a quiet harp-only round in between. No audio files.

   Everything that rings is in one key: the tune in G major, every chime and fanfare in the G major
   pentatonic (G A B D E), so an effect can land on any bar without rubbing against the chord. All
   timbres are harmonic (no inharmonic bell partials), the pad holds plain triads (no major sevenths
   under a melody that sits on the root), the registers are kept apart (bass – pad/harp – melody),
   and the hall is short and modest. v0.6.1's lullaby was built the other way round and playtesters
   called it dissonant; tools/dissonance.py measures the difference on an offline render. */
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
  const EIGHTH = 0.36;   // seconds per eighth (6/8, dotted quarter = 55 bpm): a slow, rocking waltz
  const BAR = 6;         // eighths per bar
  const MUSIC_GAIN = 0.75;
  // per bar: the pad's chord (plain triads with an octave, a 7th or 9th only where the melody leaves room),
  // the harp's four notes, the bass note, the melody
  const SONG = [
    { pad: [55, 59, 62, 67], harp: [55, 59, 62, 67], bass: 43, mel: 'D5:3 B4:1 A4:1 B4:1' },   // G
    { pad: [55, 59, 62, 67], harp: [55, 59, 64, 67], bass: 43, mel: 'G4:3 -:3' },              // G6 colour in the harp
    { pad: [52, 55, 59, 64], harp: [52, 55, 59, 62], bass: 40, mel: 'E5:2 D5:1 B4:3' },        // Em (harp Em7)
    { pad: [52, 55, 59, 64], harp: [52, 55, 59, 62], bass: 40, mel: '-:3 B4:1 D5:1 E5:1' },
    { pad: [48, 52, 55, 60], harp: [48, 55, 60, 64], bass: 36, mel: 'G5:3 E5:2 D5:1' },        // C
    { pad: [48, 52, 55, 60], harp: [48, 55, 62, 64], bass: 36, mel: 'E5:3 -:3' },              // Cadd9 in the harp
    { pad: [50, 57, 62, 67], harp: [50, 57, 62, 67], bass: 38, mel: 'A4:2 B4:1 C5:2 D5:1' },   // Dsus4
    { pad: [50, 54, 57, 62], harp: [50, 54, 57, 62], bass: 38, mel: 'F#5:5 -:1' },             // D
    { pad: [55, 59, 62, 67], harp: [55, 59, 62, 67], bass: 43, mel: 'D5:3 B4:1 G4:2' },        // G
    { pad: [50, 54, 59, 62], harp: [50, 54, 59, 62], bass: 47, mel: 'F#5:2 D5:1 B4:3' },       // Bm
    { pad: [48, 52, 55, 60], harp: [48, 55, 60, 64], bass: 36, mel: 'E5:2 G5:1 E5:2 C5:1' },   // C
    { pad: [48, 52, 57, 60], harp: [45, 52, 55, 60], bass: 45, mel: 'C5:3 E5:2 D5:1' },        // Am7
    { pad: [50, 55, 59, 62], harp: [50, 55, 59, 62], bass: 47, mel: 'B4:2 D5:1 G5:3' },        // G/B
    { pad: [48, 52, 55, 60], harp: [48, 55, 60, 64], bass: 36, mel: 'E5:2 D5:1 G5:3' },        // C
    { pad: [50, 57, 60, 62], harp: [50, 57, 60, 62], bass: 38, mel: 'A5:2 G5:1 F#5:1 E5:1 D5:1' }, // D7sus – the little run home
    { pad: [55, 59, 62, 67], harp: [55, 62, 67, 71], bass: 43, mel: 'G5:6' },                  // G
  ];
  for (const b of SONG) b.notes = parseBar(b.mel);
  const HARP = [0, 1, 2, 3, 2, 1];                                   // a rolling arpeggio over the four harp notes
  const PENT = [67, 69, 71, 74, 76, 79, 81, 83, 86, 88, 91, 93, 95, 98, 100]; // G major pentatonic, G4 and up
  const FLOURISH = [67, 69, 71, 74, 76, 79, 81, 83];                  // a harp run up the pentatonic at phrase ends

  const Audio = {
    ctx: null,
    master: null, sfx: null, music: null, melody: null, verb: null,
    sfxOn: FC.store.get('sfx', true),
    musicOn: FC.store.get('music', true),
    lastBump: 0,
    musicTimer: null,
    nextNoteT: 0,
    step: 0,
    tOffset: 0, // offline rendering moves "now" forward (see renderMusic)

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

    now() {
      return this.ctx.currentTime + this.tOffset;
    },

    // master -> compressor -> out; sfx and music buses; a reverb send for both; a single soft echo for the melody
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
      // the hall: a generated impulse response, short and warm (1.7 s, darker towards the end)
      const conv = c.createConvolver();
      conv.buffer = this.makeReverb(c, 1.7, 3.0);
      const wet = c.createGain();
      wet.gain.value = 0.38;
      conv.connect(wet);
      wet.connect(this.master);
      this.verb = c.createGain();          // the send: anything connected here goes into the hall
      this.verb.gain.value = 1;
      this.verb.connect(conv);
      // the melody bus: into the music bus, plus one quiet dotted-eighth echo drifting to the right
      this.melody = c.createGain();
      this.melody.gain.value = 1;
      this.melody.connect(this.music);
      const dl = c.createDelay(2);
      dl.delayTime.value = EIGHTH * 1.5;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1800;
      const send = c.createGain();
      send.gain.value = 0.16;
      this.melody.connect(send);
      send.connect(dl);
      dl.connect(lp);
      const pr = this.panner(c, 0.5);
      lp.connect(pr);
      pr.connect(this.music);
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
          const a = 0.5 - 0.4 * x;
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
      this.toneAt(this.now() + ((o && o.delay) || 0), freq, dur, o);
    },
    noise(dur, o) {
      if (!this.ctx || !this.sfxOn) return;
      this.noiseAt(this.now() + ((o && o.delay) || 0), dur, o);
    },

    // ---------- instruments ----------
    // celesta: a sine with harmonic partials that fade quickly – pure, round, a little sparkle on top
    celesta(freq, t, vol, o) {
      o = o || {};
      const c = this.ctx;
      freq = Math.min(freq, 5000);
      const out = c.createGain();
      out.gain.value = 1;
      const pan = o.pan != null ? this.panner(c, o.pan) : null;
      if (pan) { out.connect(pan); pan.connect(o.dest || this.sfx); } else out.connect(o.dest || this.sfx);
      const vs = c.createGain();
      vs.gain.value = o.verb == null ? 0.45 : o.verb;
      out.connect(vs);
      vs.connect(this.verb);
      const life = o.dur || FC.clamp(2.4 - freq / 1400, 0.7, 2.2); // high notes ring shorter
      const parts = [[1, 1], [2, 0.22], [3, 0.07], [4, 0.035], [6, 0.012]];
      for (const [k, a] of parts) {
        const f = freq * k;
        if (f > 15000) continue;
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        const g = c.createGain();
        const d = life / (1 + (k - 1) * 1.1);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol * a, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        osc.connect(g);
        g.connect(out);
        osc.start(t);
        osc.stop(t + d + 0.05);
      }
      if (o.click !== false) this.noiseAt(t, 0.012, { freq: Math.min(8000, freq * 3), q: 1.2, vol: vol * 0.1, dest: out });
    },
    // harp: a plucked string – a triangle whose brightness closes right after the pluck
    harp(freq, t, vol, o) {
      o = o || {};
      const c = this.ctx;
      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 0.7;
      f.frequency.setValueAtTime(Math.min(9000, freq * 6), t);
      f.frequency.exponentialRampToValueAtTime(Math.max(250, freq * 1.2), t + 0.35);
      const g = c.createGain();
      const dur = o.dur || 0.9;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(f);
      f.connect(g);
      const pan = this.panner(c, o.pan || 0);
      g.connect(pan);
      pan.connect(o.dest || this.music);
      const vs = c.createGain();
      vs.gain.value = 0.35;
      g.connect(vs);
      vs.connect(this.verb);
      osc.start(t); osc.stop(t + dur + 0.1);
    },
    // a warm pad: two barely detuned triangles per note under a slowly breathing low-pass, spread left to right
    pad(notes, t, dur, vol) {
      const c = this.ctx;
      notes.forEach((n, i) => {
        const f = midi(n);
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 380 + i * 60;
        lp.Q.value = 0.5;
        const lfo = c.createOscillator();
        lfo.frequency.value = 0.1 + i * 0.02;
        const lg = c.createGain();
        lg.gain.value = 90;
        lfo.connect(lg);
        lg.connect(lp.frequency);
        lfo.start(t); lfo.stop(t + dur + 0.2);
        for (const det of [-3, 3]) {
          const osc = c.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = f;
          osc.detune.value = det;
          osc.connect(lp);
          osc.start(t); osc.stop(t + dur + 0.2);
        }
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.5);
        g.gain.setValueAtTime(vol, t + Math.max(0.5, dur - 0.4));
        g.gain.linearRampToValueAtTime(0.0001, t + dur); // a quick fade: the old chord must not rub against the new one
        lp.connect(g);
        const pan = this.panner(c, (i - 1.5) * 0.3);
        g.connect(pan);
        pan.connect(this.music);
        const vs = c.createGain();
        vs.gain.value = 0.45;
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
      lp.frequency.value = 300;
      for (const [k, a, type] of [[1, 1, 'sine'], [2, 0.3, 'triangle']]) {
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
    // a little flute: a sine with a whisper of its octave, a breath, and a gentle vibrato that sets in late
    flute(freq, t, dur, vol, o) {
      o = o || {};
      const c = this.ctx;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.08);
      g.gain.setValueAtTime(vol, t + Math.max(0.08, dur - 0.16));
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      const lfo = c.createOscillator();
      lfo.frequency.value = 5;
      const lg = c.createGain();
      lg.gain.setValueAtTime(0, t);
      lg.gain.setValueAtTime(0, t + 0.25);
      lg.gain.linearRampToValueAtTime(6, t + 0.7);
      lfo.connect(lg);
      for (const [k, a] of [[1, 1], [2, 0.12], [3, 0.025]]) {
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
      this.noiseAt(t, dur, { filter: 'bandpass', freq: freq * 2, q: 2.5, vol: vol * 0.05, attack: 0.1, dest: g });
      const pan = this.panner(c, o.pan || 0);
      g.connect(pan);
      pan.connect(o.dest || this.music);
      const vs = c.createGain();
      vs.gain.value = 0.5;
      g.connect(vs);
      vs.connect(this.verb);
    },
    // a chime for the effects: a celesta note at now + delay (kept for the old call sites)
    bell(freq, dur, vol, delay, dest) {
      if (!this.ctx || !this.sfxOn) return;
      this.celesta(freq, this.now() + (delay || 0), vol, { dur, dest });
    },
    // a little pentatonic phrase on the celesta: indices into PENT, a gap between the notes
    phrase(idx, gap, vol, dur) {
      idx.forEach((k, i) => this.bell(midi(PENT[Math.max(0, Math.min(PENT.length - 1, k))]), dur || 0.9, vol, i * gap));
    },

    // ---------- game sounds (all chimes in the G major pentatonic, like the tune) ----------
    click() {
      this.tone(880, 0.06, { type: 'triangle', vol: 0.09 });
    },
    // the detents while pulling (every 25 %): G B D G rising; full power adds a high sparkle
    tick(p) {
      const step = Math.min(4, Math.max(1, Math.round(p * 4)));
      this.phrase([[0, 2, 3, 5][step - 1]], 0, 0.05, 0.5);
      if (p >= 0.99) {
        this.phrase([10], 0, 0.045, 0.9);
        this.noise(0.25, { freq: 5000, sweep: 9000, q: 0.8, vol: 0.025, echo: true });
      }
    },
    // picking the cake up: a soft little pluck
    grab() {
      if (!this.ctx || !this.sfxOn) return;
      this.celesta(midi(83), this.now(), 0.035, { dur: 0.3, click: false });
    },
    // the pull: an airy shimmer of fairy dust that swells and brightens with the tension
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
      st.g1.gain.setTargetAtTime(0.004 + t * 0.03, now, 0.06);
    },
    // the release: a harp pluck (D4, a touch higher with more power), a low thud and a whoosh that grows with power
    launch(power) {
      this.stretch(0);
      if (!this.ctx || !this.sfxOn) return;
      this.harp(midi(power > 0.75 ? 67 : 62), this.now(), 0.09, { dest: this.sfx, dur: 0.5 });
      this.tone(98, 0.14, { type: 'sine', slide: 0.5, vol: 0.12 });
      this.noise(0.2 + power * 0.2, { freq: 900, sweep: 3600, q: 0.7, vol: 0.035 + power * 0.09, echo: true });
    },
    // the glide ends and the cake settles into the water: a small plop, no pitch
    plip(size) {
      this.noise(0.09, { freq: Math.max(300, 900 - size * 50), sweep: 300, q: 1.6, vol: 0.05 });
    },
    // hot streak grows: a rising sparkle, higher with every link
    streak(n) {
      const k = Math.min(6, n - 2);
      this.phrase([5 + k, 7 + k, 8 + k], 0.06, 0.05, 0.6);
    },
    streakLost() {
      this.tone(midi(64), 0.1, { type: 'triangle', vol: 0.05 });
      this.tone(midi(59), 0.16, { type: 'triangle', vol: 0.04, delay: 0.1 });
    },
    // cakes bumping: a short wooden "tok" on a note of the scale, lower for bigger cakes
    bump(strength, size) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      if (now - this.lastBump < 0.035) return;
      this.lastBump = now;
      const v = Math.min(0.14, 0.02 + strength / 7000);
      const n = PENT[Math.max(0, 7 - Math.round(size / 1.6))] - 12;
      this.tone(midi(n), 0.07, { type: 'triangle', vol: v });
      this.noise(0.03, { freq: 1500, q: 1, vol: v * 0.3 });
    },
    rim(strength) {
      const v = Math.min(0.14, 0.03 + strength / 8000);
      this.noise(0.16, { freq: 700, sweep: 300, q: 1.4, vol: v });
      this.tone(midi(55), 0.08, { type: 'triangle', vol: v * 0.5 });
    },
    // a merge: a puff, a soft low note and a two-note chime that climbs with the combo (three notes for big cakes)
    merge(tier, combo) {
      const i = Math.min(PENT.length - 5, 1 + Math.floor(tier / 2) + Math.min(5, combo - 1));
      this.noise(0.12, { freq: 2400, q: 0.6, vol: 0.06 });
      this.tone(midi(PENT[i] - 12), 0.14, { type: 'sine', vol: 0.09 });
      const notes = tier >= 5 ? [i, i + 2, i + 4] : [i, i + 2];
      this.phrase(notes, 0.07, 0.13, 1.0);
    },
    discover() {
      this.phrase([5, 7, 8, 10, 12], 0.07, 0.1, 1.2);
    },
    levelUp() {
      this.phrase([0, 2, 3, 5], 0.11, 0.12, 1.1);
      this.tone(midi(55), 0.6, { type: 'triangle', vol: 0.07, delay: 0.3 });
    },
    royal() {
      this.phrase([0, 2, 3, 5, 7, 8, 10, 12], 0.06, 0.11, 1.8);
      this.noise(1.2, { freq: 3000, sweep: 9000, q: 0.5, vol: 0.05, echo: true });
    },
    swap() {
      this.phrase([4, 7], 0.06, 0.055, 0.3);
    },
    poof() {
      this.noise(0.4, { freq: 3000, sweep: 600, q: 0.7, vol: 0.12, echo: true });
      this.phrase([10, 9, 8], 0.05, 0.06, 0.5);
    },
    magic() {
      this.phrase([5, 8, 10, 13], 0.05, 0.08, 0.8);
    },
    bubble() {
      this.noise(0.15, { freq: 2500, sweep: 6000, q: 1, vol: 0.05 });
      this.phrase([8, 10], 0.05, 0.08, 0.7);
    },
    // a cake is in danger: a soft, questioning "uh-oh" – a minor third down, in key
    danger() {
      this.tone(midi(71), 0.14, { type: 'triangle', vol: 0.06 });
      this.tone(midi(67), 0.18, { type: 'triangle', vol: 0.055, delay: 0.17 });
    },
    // the order is filled
    orderDone() {
      this.phrase([3, 5, 7, 8], 0.07, 0.1, 0.9);
      this.tone(midi(43), 0.5, { type: 'triangle', vol: 0.07, delay: 0.1 });
    },
    // the stage whirl: a rising swoosh, a pentatonic run on top, a soft settle at the end
    whirl() {
      this.noise(1.4, { freq: 300, sweep: 2600, q: 0.8, vol: 0.12, attack: 0.3, echo: true });
      this.noise(1.8, { freq: 2200, sweep: 700, q: 0.7, vol: 0.09, attack: 0.5, delay: 1.3 });
      [0, 2, 3, 5, 7, 8, 10, 12].forEach((k, i) => this.bell(midi(PENT[k]), 0.7, 0.05, 0.2 + i * 0.12)); // a G chord climbing with the water
      this.noise(0.6, { freq: 500, sweep: 200, q: 1.0, vol: 0.07, delay: 2.9 });
    },
    gameOver() {
      this.phrase([5, 4, 3, 2, 0], 0.18, 0.1, 1.3);
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
    // one eighth of the tune. The rounds go: celesta – flute – celesta an octave up over a brighter harp –
    // a quiet harp-and-pad round without the tune – and round again
    playStep(step, t) {
      const bars = SONG.length;
      const bar = Math.floor(step / BAR) % bars, pos = step % BAR, round = Math.floor(step / (BAR * bars)) % 4;
      const B = SONG[bar];
      const flute = round === 1, high = round === 2, quiet = round === 3;
      if (pos === 0) {
        this.pad(B.pad, t, BAR * EIGHTH + 0.12, quiet ? 0.013 : 0.016);
        this.bass(B.bass, t, quiet ? 0.045 : 0.06);
      }
      // the harp: every eighth (every other one on the flute round), an octave up on the bright round
      if (!flute || pos === 0 || pos === 2 || pos === 3 || pos === 5) {
        const n = B.harp[HARP[pos]] + (high && pos >= 3 ? 12 : 0);
        const v = (pos === 0 ? 0.1 : pos === 3 ? 0.08 : 0.06) * (quiet ? 1.15 : 1);
        this.harp(midi(n), t + (Math.random() - 0.5) * 0.012, v, { pan: (pos / 5 - 0.5) * 0.7 });
      }
      // a little flourish up the harp at the end of each phrase
      if ((bar === 7 || bar === 15) && pos === 3 && !flute) {
        FLOURISH.forEach((n, i) => this.harp(midi(n + (high ? 12 : 0)), t + 0.05 + i * 0.055, 0.04, { pan: -0.5 + i * 0.14, dur: 0.8 }));
      }
      if (!quiet) {
        for (const m of B.notes) {
          if (m.pos !== pos) continue;
          if (flute) {
            this.flute(midi(m.n), t, m.len * EIGHTH - 0.06, 0.1, { dest: this.melody, pan: -0.1 });
          } else {
            const n = m.n + (high ? 12 : 0);
            this.celesta(midi(n), t, (m.len >= 3 ? 0.17 : 0.14) * (high ? 0.8 : 1), { dest: this.melody, pan: 0.12, verb: 0.4 });
            if (m.len >= 3 && !high) this.celesta(midi(n + 12), t + 0.015, 0.03, { dest: this.melody, pan: 0.35, verb: 0.8, click: false });
          }
        }
      }
      // fairy dust: a sparkle now and then, high up and far left or right – always a note of the bar's own chord
      if (Math.random() < (quiet ? 0.1 : 0.05)) {
        const n = B.harp[Math.floor(Math.random() * 4)] + 24 + (Math.random() < 0.4 ? 12 : 0);
        this.celesta(midi(n), t + Math.random() * 0.25, 0.02 + Math.random() * 0.016, { dest: this.music, pan: Math.random() * 1.6 - 0.8, verb: 0.9, click: false });
      }
    },

    // render the tune offline (tools/render-music.js): resolves with an AudioBuffer of `seconds` seconds.
    // events: optional list of [time, 'sfxName', ...args] to play effects on top (for listening tests)
    renderMusic(seconds, events) {
      const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const rate = 44100;
      const off = new Off(2, Math.ceil(rate * seconds), rate);
      const live = { ctx: this.ctx, master: this.master, sfx: this.sfx, music: this.music, melody: this.melody, verb: this.verb, noiseBuf: this.noiseBuf, step: this.step, nextNoteT: this.nextNoteT, tOffset: this.tOffset, sfxOn: this.sfxOn };
      this.ctx = off;
      this.buildGraph(off);
      this.music.gain.value = MUSIC_GAIN;
      this.sfx.gain.value = 0.8;
      this.sfxOn = true;
      this.step = 0;
      this.nextNoteT = 0.1;
      for (let now = 0; now < seconds; now += 0.4) this.schedule(now);
      for (const [time, name, ...args] of events || []) {
        this.tOffset = time;
        if (typeof this[name] === 'function') this[name](...args);
      }
      this.tOffset = 0;
      const p = off.startRendering();
      Object.assign(this, live);
      return p;
    },
  };

  FC.Audio = Audio;
})();
