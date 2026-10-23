/* Fairycake Falls – DOM UI: HUD, coach tips, menus, banners, the world map, level cards and the Cake Book. */
(function () {
  'use strict';
  const FC = window.FC;
  const $ = (id) => document.getElementById(id);
  const G = () => FC.Game;
  const CK = FC.Cakes;
  const LV = FC.Levels;
  const TIERS = CK.TIERS;
  const MAX = CK.MAX_TIER;

  const SPEAKER_ON = '<svg viewBox="0 0 24 24"><path d="M4 9h3.5L12 5v14l-4.5-4H4z" fill="#fff"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>';
  const SPEAKER_OFF = '<svg viewBox="0 0 24 24"><path d="M4 9h3.5L12 5v14l-4.5-4H4z" fill="#fff"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>';
  const HEART = '<svg class="ic-heart" viewBox="0 0 24 24"><path d="M12 21C5 15.5 2 12.3 2 8.6 2 5.6 4.4 3.3 7.3 3.3c1.9 0 3.6 1 4.7 2.6 1.1-1.6 2.8-2.6 4.7-2.6 2.9 0 5.3 2.3 5.3 5.3 0 3.7-3 6.9-10 12.4z" fill="#ff6fa8" stroke="#fff" stroke-width="2"/></svg>';
  const STAR = '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"/></svg>';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (s) => esc(s).replace(/\{heart\}/g, HEART);
  const SIL = '#dcc8dc';
  // where the eight levels of a world sit on the map card (percent), winding up towards the castle
  const NODE_POS = [[16, 88], [40, 81], [66, 74], [84, 61], [60, 52], [34, 45], [20, 31], [48, 19]];

  function iconCanvas(kind, size, opts) {
    const c = document.createElement('canvas');
    c.style.width = c.style.height = size + 'px';
    CK.drawIcon(c, kind, Object.assign({ w: size, h: size }, opts || {}));
    return c;
  }
  // three stars, n of them lit
  function starsHtml(n, cls) {
    let h = '<span class="stars ' + (cls || '') + '">';
    for (let i = 0; i < 3; i++) h += '<i class="' + (i < n ? 'on' : 'off') + '" style="--d:' + i * 0.18 + 's">' + STAR + '</i>';
    return h + '</span>';
  }

  const UI = {
    timers: {},
    mapWorld: 0,

    init() {
      const click = (id, fn) => {
        const el = $(id);
        if (!el) return;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          FC.Audio.init();
          FC.Audio.click();
          fn(e);
        });
      };
      click('playBtn', () => this.showMap());
      click('endlessBtn', () => G().newGame());
      click('howBtn', () => this.open('how'));
      click('bookBtn', () => this.openBook());
      click('bookHud', () => this.openBook());
      click('pauseBookBtn', () => this.openBook());
      click('mapBookBtn', () => this.openBook());
      click('pauseBtn', () => this.pause());
      click('resumeBtn', () => this.resume());
      click('restartBtn', () => { this.close('pause'); this.restartRun(); });
      click('menuBtn', () => { this.close('pause'); this.showTitle(); });
      click('pauseMapBtn', () => { this.close('pause'); this.showMap(G().level ? G().level.w : undefined); });
      click('pauseHowBtn', () => this.open('how'));
      click('againBtn', () => { this.close('over'); this.restartRun(); });
      click('overMenuBtn', () => { this.close('over'); this.showTitle(); });
      click('overMapBtn', () => { this.close('over'); this.showMap(G().level ? G().level.w : undefined); });
      click('musicBtn', () => { FC.Audio.setMusic(!FC.Audio.musicOn); this.refreshToggles(); });
      click('sfxBtn', () => { FC.Audio.setSfx(!FC.Audio.sfxOn); this.refreshToggles(); });
      click('replayTutBtn', () => {
        FC.store.set('coach', 0);
        $('replayTutBtn').textContent = 'The tour starts with your next game';
      });
      click('soundBtnTitle', () => {
        const on = !(FC.Audio.musicOn || FC.Audio.sfxOn);
        FC.Audio.setMusic(on);
        FC.Audio.setSfx(on);
        this.refreshToggles();
      });
      click('nextBtn', () => G().swap());
      click('jokerBtn', () => G().useJoker());
      click('wandBtn', () => G().toggleWand());
      // the map
      click('mapBack', () => this.showTitle());
      click('mapPrev', () => this.switchWorld(-1));
      click('mapNext', () => this.switchWorld(1));
      click('lcPlay', () => { if (this.levelPick) this.playLevel(this.levelPick.w, this.levelPick.l); });
      click('wonNext', () => { const n = this.wonNext; this.close('won'); if (n) this.playLevel(n.w, n.l); else this.showMap(); });
      click('wonReplay', () => { const lv = G().level; this.close('won'); if (lv) this.playLevel(lv.w, lv.l); });
      click('wonMap', () => { this.close('won'); this.showMap(G().level ? G().level.w : undefined); });
      document.querySelectorAll('[data-close]').forEach((el) => {
        el.addEventListener('click', () => { FC.Audio.click(); this.close(el.getAttribute('data-close')); });
      });
      // HUD buttons must not start a flick on the canvas underneath
      ['nextBtn', 'jokerBtn', 'wandBtn', 'pauseBtn', 'bookHud'].forEach((id) => {
        $(id).addEventListener('pointerdown', (e) => e.stopPropagation());
      });
      window.addEventListener('keydown', (e) => {
        if ($('map').classList.contains('hidden')) return;
        if (e.key === 'ArrowLeft') this.switchWorld(-1);
        else if (e.key === 'ArrowRight') this.switchWorld(1);
      });
      this.bindMapSwipe();
      CK.drawIcon($('jokerIcon'), 'magic', { w: 52, h: 52 });
      this.drawHowIcons();
      this.drawTitleChain();
      this.refreshToggles();
      $('bestTitle').textContent = G().best;
      this.layout();
      window.addEventListener('resize', () => { if (!$('map').classList.contains('hidden')) this.renderMap(); });
    },

    layout() {
      const nb = $('nextBtn');
      if (!nb || !G().nextCenter) return;
      const n = G().nextCenter();
      nb.style.width = nb.style.height = n.size + 'px';
      const cv = $('nextCanvas');
      cv.style.width = cv.style.height = Math.round(n.size * 0.84) + 'px';
      cv.style.left = Math.round(n.size * 0.04) + 'px';
      cv.style.top = Math.round(n.size * 0.02) + 'px';
      nb.style.left = n.x + 'px';
      nb.style.top = n.y + 'px';
      this.updateNext();
      const br = $('bookHud').getBoundingClientRect();
      this.bookRect = br.width ? { left: br.left, top: br.top, right: br.right, bottom: br.bottom } : null;
      this.placeTop();
    },

    // The top row of the HUD: the score pill on the left, the pause button on the right, and in a level the recipe
    // chip in between – centred on the screen when there is room, otherwise in the gap, and never wider than the gap
    // (v0.7 centred it on the screen with a max-width in vw: on phones it ran under the pill and its text overflowed).
    // Also tells the coach card, the discovery toast and the stopwatch where the top row ends.
    placeTop() {
      const hud = $('hud');
      if (!hud || hud.classList.contains('hidden')) return;
      const pill = $('scorePill').getBoundingClientRect();
      const pause = $('pauseBtn').getBoundingClientRect();
      let bottom = Math.max(pill.bottom, pause.bottom);
      const wrap = $('goalWrap');
      if (!wrap.classList.contains('hidden')) {
        const k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--k')) || 1;
        const gap = 8;
        const left = pill.right + gap, right = pause.left - gap;
        const room = Math.max(0, right - left);
        const chip = $('goalChip');
        wrap.style.left = left + 'px';
        wrap.style.width = room + 'px';
        chip.style.maxWidth = Math.max(60, room / k) + 'px';
        chip.classList.toggle('narrow', room / k < 210);
        chip.classList.toggle('tight', room / k < 150); // the smallest phones: a smaller icon, stars and count
        chip.style.marginLeft = '0px';
        const cw = chip.getBoundingClientRect().width;
        const c = FC.clamp(window.innerWidth / 2, left + cw / 2, right - cw / 2);
        chip.style.marginLeft = Math.max(0, Math.round(c - cw / 2 - left)) + 'px';
        bottom = Math.max(bottom, chip.getBoundingClientRect().bottom);
      }
      this.topBottom = bottom;
      // the hot-streak badge hangs below the score pill while a streak runs (layout sizes, so its pop-in animation
      // does not matter)
      const pe = $('scorePill'), st = $('streak');
      const ks = pe.offsetHeight ? pill.height / pe.offsetHeight : 1;
      this.streakBottom = st ? pill.top + (st.offsetTop + st.offsetHeight) * ks : 0;
      hud.style.setProperty('--hudB', Math.round(bottom) + 'px');
      hud.style.setProperty('--pillB', Math.round(pill.bottom) + 'px');
    },
    // where the top row of the HUD ends (CSS px) – the stopwatch over a cake in danger stays below it
    hudBottom() {
      const b = this.topBottom || 90;
      const st = $('streak');
      return st && this.streakBottom && st.classList.contains('show') ? Math.max(b, this.streakBottom) : b;
    },

    // the tutorial hand must never hide behind the Cake Book pill: fade the pill while they overlap
    setHandOver(on) {
      if (this.handOver === on) return;
      this.handOver = on;
      $('bookHud').classList.toggle('dim', on);
    },

    open(id) {
      $(id).classList.remove('hidden');
      if (id === 'how') $('replayTutBtn').textContent = 'Show me the tour again';
    },
    close(id) {
      $(id).classList.add('hidden');
      if (id === 'book') {
        this.hideTip();
        if (this.bookFromGame) { this.bookFromGame = false; this.resume(); }
        else if (this.bookFromPause) { this.bookFromPause = false; this.open('pause'); }
      }
    },

    // the Cake Book: from the title, the map, the pause menu, or straight out of the game (which pauses meanwhile)
    openBook(tab) {
      const g = G();
      if (g.state === 'playing') {
        g.state = 'paused';
        g.cancelAim();
        this.bookFromGame = true;
      } else if (!$('pause').classList.contains('hidden')) {
        // from the pause menu: the menu steps aside and comes back when the book closes
        this.bookFromPause = true;
        $('pause').classList.add('hidden');
      }
      if (tab == null) tab = g.level ? g.level.w : !$('map').classList.contains('hidden') ? this.mapWorld : g.mode === 'endless' && g.state !== 'title' ? g.worldIndex() : this.bookTab || 0;
      this.bookTab = tab;
      this.buildBook();
      $('bookHud').classList.remove('new');
      $('mapBookBtn').classList.remove('new');
      this.open('book');
    },

    showTitle() {
      ['hud', 'pause', 'over', 'how', 'book', 'map', 'levelCard', 'won', 'cakeDetail'].forEach((id) => $(id).classList.add('hidden'));
      this.stopMapTilly();
      $('title').classList.remove('hidden');
      $('bestTitle').textContent = G().best;
      const cur = LV.Progress.current();
      const stars = LV.Progress.totalStars();
      $('titleProgress').textContent = (LV.Progress.worldCleared(LV.WORLDS.length - 1) ? 'All worlds cleared' : LV.WORLDS[cur.w].name + ' · Level ' + (cur.l + 1)) + (stars ? ' · ★ ' + stars : '');
      this.coachHide();
      G().toTitle();
    },

    // a run restarts the way it was started
    restartRun() {
      const g = G();
      if (g.level) this.playLevel(g.level.w, g.level.l);
      else g.newGame();
    },

    onNewGame() {
      const g = G();
      ['title', 'pause', 'over', 'how', 'book', 'map', 'levelCard', 'won', 'cakeDetail'].forEach((id) => $(id).classList.add('hidden'));
      this.stopMapTilly();
      $('hud').classList.remove('hidden');
      $('hud').classList.remove('danger');
      this.setScore(0);
      this.setStage(1, 0, g.stageGoal);
      this.layout();
      this.updatePowers();
      this.setBook();
      this.setStreak(0);
      this.coachHide();
      this.parTier = 0;
      this.setGoal();
      g.overShown = false;
    },

    pause() {
      const g = G();
      if (g.state !== 'playing') return;
      g.state = 'paused';
      g.cancelAim();
      this.refreshToggles();
      $('pauseMapBtn').classList.toggle('hidden', !g.level);
      $('restartBtn').textContent = g.level ? 'Restart level' : 'Restart';
      this.open('pause');
    },
    resume() {
      if (G().state !== 'paused') return;
      this.bookFromGame = false;
      this.bookFromPause = false;
      this.close('pause');
      this.close('how');
      this.close('book');
      G().state = 'playing';
      G().last = 0;
    },

    onGameOver() {
      this.coachHide();
      $('hud').classList.remove('danger');
    },

    showOver(st) {
      const lv = st.level;
      $('overScore').textContent = st.score;
      // in a level the record that counts is the fewest flicks (the stars come from them); endless keeps its best score
      const bestF = lv ? LV.Progress.flicks(lv.w, lv.l) : 0;
      $('overBest').textContent = lv ? (bestF ? bestF + ' flicks' : '') : st.best;
      $('overBest').parentElement.classList.toggle('hidden', !!lv && !bestF);
      $('newBest').classList.toggle('hidden', !st.newBest);
      $('overLevelWord').textContent = lv ? 'Flicks' : 'Stage';
      $('overLevel').textContent = lv ? st.shots : st.stage;
      $('overMerges').textContent = st.merges;
      $('overCombo').textContent = 'x' + Math.max(1, st.combo);
      if (st.maxKind) {
        $('overCakeName').textContent = CK.spec(st.maxKind).name;
        CK.drawIcon($('overCake'), st.maxKind, { w: 60, h: 60 });
      } else {
        $('overCakeName').textContent = 'none yet';
        CK.drawIcon($('overCake'), lv ? lv.def.kind : CK.kindFor(2), { w: 60, h: 60, silhouette: SIL });
      }
      document.querySelector('.over-sub').textContent = lv ? 'A cake stayed outside the ring too long. The recipe is still here – try again!' : 'A cake stayed outside the ring too long.';
      $('againBtn').textContent = lv ? 'Try again' : 'Play again';
      $('overMapBtn').classList.toggle('hidden', !lv);
      this.open('over');
    },

    refreshToggles() {
      $('musicBtn').textContent = 'Music: ' + (FC.Audio.musicOn ? 'on' : 'off');
      $('sfxBtn').textContent = 'Sound: ' + (FC.Audio.sfxOn ? 'on' : 'off');
      $('soundBtnTitle').innerHTML = FC.Audio.musicOn || FC.Audio.sfxOn ? SPEAKER_ON : SPEAKER_OFF;
    },

    setScore(n) {
      const el = $('score');
      const grew = String(n).length !== el.textContent.length;
      el.textContent = n;
      const p = el.parentElement;
      p.classList.remove('bump');
      void p.offsetWidth;
      p.classList.add('bump');
      if (grew) this.placeTop(); // a wider pill moves the recipe chip
    },

    // The star meter in the recipe chip: which stars a bake would still earn, and the flicks used of those allowed
    // for the best of them ("★★★ 4/6"). Flicks are counted at the launch, so the flick that bakes the cake still
    // counts for the stars shown while it flies. A star that slips away falls off with a little wobble.
    setFlicks(shots, par) {
      if (!par) return;
      const tier = LV.starsForFlicks(par, shots);
      const lim = tier === 3 ? par[1] : tier === 2 ? par[0] : 0;
      const box = $('parStars');
      if (this.parTier !== tier || !box.firstChild) {
        const lost = this.parTier && tier < this.parTier; // the star at index `tier` just slipped away
        let h = '';
        for (let i = 0; i < 3; i++) h += '<i class="' + (i < tier ? 'on' : 'off') + (lost && i === tier ? ' drop' : '') + '">' + STAR + '</i>';
        box.innerHTML = h;
        if (lost && FC.Audio.streakLost) FC.Audio.streakLost();
      }
      const cnt = $('parCount');
      const before = cnt.textContent;
      cnt.textContent = tier > 1 ? shots + '/' + lim : String(shots);
      $('parWord').textContent = tier > 1 ? (shots === 1 && lim === 1 ? 'flick' : 'flicks') : 'flicks · bake it!';
      const row = $('goalPar');
      row.classList.toggle('warn', tier > 1 && lim - shots <= 1);
      row.classList.toggle('last', tier === 1);
      if (shots > 0) { row.classList.remove('tick'); void row.offsetWidth; row.classList.add('tick'); }
      this.parTier = tier;
      if (before.length !== cnt.textContent.length) this.placeTop();
    },

    // the order of the stage: n merges fill the bar
    setStage(stage, merges, goal) {
      $('lvl').textContent = stage;
      const g = $('goal');
      const left = Math.max(0, goal - merges);
      g.textContent = left > 0 ? left + ' to go' : 'done!';
      $('lvlbar').style.width = Math.round(FC.clamp(merges / goal, 0, 1) * 100) + '%';
      const p = $('scorePill');
      if (merges > 0 && left > 0) {
        p.classList.remove('tick');
        void p.offsetWidth;
        p.classList.add('tick');
      }
      p.classList.toggle('full', left <= 0);
    },
    pulseStage() {
      const p = $('scorePill');
      p.classList.remove('pulse');
      void p.offsetWidth;
      p.classList.add('pulse');
    },

    // the recipe chip: which cake the level asks for, silhouetted until it is baked for the first time
    setGoal() {
      const g = G();
      const wrap = $('goalWrap'), chip = $('goalChip');
      if (!g.level) { wrap.classList.add('hidden'); this.placeTop(); return; }
      const def = g.level.def;
      const known = LV.Collection.has(def.kind);
      const s = CK.spec(def.kind);
      const wasHidden = wrap.classList.contains('hidden');
      wrap.classList.remove('hidden');
      const n = g.level.l + 1;
      const close = (g.maxKindTier || 0) >= def.goal - 1 && !g.won;
      // the kicker has a short and a long part; a narrow chip shows only the short one
      const kick = g.won ? ['Baked!', ''] : close ? ['Almost!', ' One merge to go'] : ['Level ' + n, ' · bake the'];
      $('goalKicker').innerHTML = '<span class="gk-a">' + esc(kick[0]) + '</span>' + (kick[1] ? '<span class="gk-b">' + esc(kick[1]) + '</span>' : '');
      const name = known ? s.name : '???';
      // redraw when the cake changes, not only the name: two unknown goals in a row are both "???"
      const iconKey = def.kind + (known ? '' : '?');
      if ($('goalName').textContent !== name || wasHidden || this.goalIconKey !== iconKey) {
        $('goalName').textContent = name;
        CK.drawIcon($('goalIcon'), def.kind, known ? { w: 44, h: 44 } : { w: 44, h: 44, silhouette: '#cdb8d4' });
        this.goalIconKey = iconKey;
      }
      chip.classList.toggle('close', close);
      chip.classList.toggle('done', !!g.won);
      this.placeTop();
    },

    updateNext(pulse) {
      const q = G().queue;
      if (!q || q.length < 2) return;
      CK.drawIcon($('nextCanvas'), q[1], { w: 56, h: 56 });
      if (pulse) {
        const b = $('nextBtn');
        b.classList.remove('pulse');
        void b.offsetWidth;
        b.classList.add('pulse');
      }
    },

    // power-up buttons only appear once you own one
    updatePowers(flash) {
      const g = G();
      $('jokerCount').textContent = g.jokers;
      $('wandCount').textContent = g.wands;
      const jb = $('jokerBtn'), wb = $('wandBtn');
      const jWas = !jb.classList.contains('gone'), wWas = !wb.classList.contains('gone');
      jb.classList.toggle('gone', g.jokers <= 0);
      wb.classList.toggle('gone', g.wands <= 0 && !g.wandMode);
      wb.classList.toggle('active', !!g.wandMode);
      for (const [b, was] of [[jb, jWas], [wb, wWas]]) {
        if (b.classList.contains('gone')) continue;
        if (flash || !was) {
          b.classList.remove('flash');
          void b.offsetWidth;
          b.classList.add('flash');
        }
      }
    },

    banner(title, sub) {
      const b = $('banner');
      b.querySelector('.banner-title').textContent = title;
      b.querySelector('.banner-sub').textContent = sub || '';
      b.classList.remove('show');
      void b.offsetWidth;
      b.classList.add('show');
    },

    combo(n) {
      const c = $('combo');
      const words = ['Sweet!', 'Yummy!', 'Delicious!', 'Sugar Rush!'];
      c.textContent = words[Math.min(words.length - 1, n - 3)] + ' x' + n;
      c.classList.remove('show');
      void c.offsetWidth;
      c.classList.add('show');
    },

    // a cake was baked for the first time
    discover(kind, rare) {
      const d = $('discover');
      $('discoverKicker').textContent = rare ? 'Rare find!' : 'New cake!';
      $('discoverName').textContent = CK.spec(kind).name;
      CK.drawIcon($('discoverIcon'), kind, { w: 48, h: 48 });
      d.classList.toggle('rare', !!rare);
      d.classList.toggle('low', $('coach').classList.contains('show')); // below the coach card while a tip is up
      d.classList.add('show');
      clearTimeout(this.timers.disc);
      this.timers.disc = setTimeout(() => d.classList.remove('show'), 2800);
    },

    // ---------- coach: one short tip at a time ----------
    coach(title, sub, opts) {
      const o = opts || {};
      const el = $('coach');
      el.querySelector('.coach-title').innerHTML = fmt(title);
      const se = el.querySelector('.coach-sub');
      se.innerHTML = sub ? fmt(sub) : '';
      se.classList.toggle('hidden', !sub);
      const row = el.querySelector('.coach-row');
      row.innerHTML = '';
      const sym = (t) => { const s = document.createElement('span'); s.className = 'sym'; s.textContent = t; row.appendChild(s); };
      if (o.eq) {
        row.appendChild(iconCanvas(CK.kindFor(o.eq[0]), 34)); sym('+');
        row.appendChild(iconCanvas(CK.kindFor(o.eq[1]), 34)); sym('=');
        row.appendChild(iconCanvas(CK.kindFor(o.eq[2]), 42));
      } else if (o.chain) {
        [1, 2, 3, 4].forEach((t, i) => { row.appendChild(iconCanvas(CK.kindFor(t), 24 + i * 3)); sym('›'); });
        sym('…'); sym('›');
        row.appendChild(iconCanvas(CK.kindFor(MAX), 44));
      }
      row.classList.toggle('hidden', !o.eq && !o.chain);
      el.classList.remove('show');
      void el.offsetWidth;
      el.classList.add('show');
      clearTimeout(this.timers.coach);
      if (o.time) this.timers.coach = setTimeout(() => this.coachHide(), o.time);
    },
    coachHide() {
      clearTimeout(this.timers.coach);
      $('coach').classList.remove('show');
    },

    // ---------- the Cake Book pill: how many cakes are in the book, and a "New!" when one was just added ----------
    setBook() {
      $('bookCount').textContent = LV.Collection.total() + '/' + LV.Collection.totalMax();
    },
    // a cake was discovered for the first time: the pill shows "New!" until the book is opened
    markNewCake() {
      this.setBook();
      for (const id of ['bookHud', 'mapBookBtn']) {
        const b = $(id);
        b.classList.remove('new');
        void b.offsetWidth;
        b.classList.add('new');
      }
    },
    pulseBook() {
      const b = $('bookHud');
      b.classList.remove('pulse');
      void b.offsetWidth;
      b.classList.add('pulse');
    },

    // hot streak badge (n >= 2 shows it, 0 hides it; lost = little shake before it fades)
    setStreak(n, mult, lost) {
      const el = $('streak');
      if (n >= 2) {
        $('streakX').textContent = 'x' + (Math.round(mult * 100) / 100);
        $('streakN').textContent = 'Streak ' + n;
        el.classList.remove('lost', 'bump');
        void el.offsetWidth;
        el.classList.add('show', 'bump');
      } else if (lost) {
        el.classList.remove('bump');
        el.classList.add('lost');
        clearTimeout(this.timers.streak);
        this.timers.streak = setTimeout(() => el.classList.remove('show', 'lost'), 500);
      } else {
        el.classList.remove('show', 'bump', 'lost');
      }
    },

    setDanger(on) {
      $('hud').classList.toggle('danger', on);
    },

    // ============================================================
    // the world map
    // ============================================================
    showMap(w) {
      const g = G();
      if (g.state === 'playing' || g.state === 'paused' || g.state === 'won' || g.state === 'over') { g.toTitle(); }
      ['hud', 'pause', 'over', 'how', 'book', 'title', 'levelCard', 'won', 'cakeDetail'].forEach((id) => $(id).classList.add('hidden'));
      this.coachHide();
      if (w == null) {
        const last = LV.Progress.lastWorld();
        const cur = LV.Progress.current();
        w = LV.Progress.worldUnlocked(last) ? last : cur.w;
      }
      this.mapWorld = FC.clamp(w, 0, LV.WORLDS.length - 1);
      $('map').classList.remove('hidden');
      this.renderMap();
      this.startMapTilly();
    },

    switchWorld(dir) {
      const w = this.mapWorld + dir;
      if (w < 0 || w >= LV.WORLDS.length) return;
      this.mapWorld = w;
      LV.Progress.setLastWorld(w);
      const card = $('mapCard');
      card.classList.remove('slide-left', 'slide-right');
      void card.offsetWidth;
      card.classList.add(dir > 0 ? 'slide-left' : 'slide-right');
      this.renderMap();
    },

    bindMapSwipe() {
      const card = $('mapCard');
      let sx = null, sy = null;
      card.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
      card.addEventListener('pointerup', (e) => {
        if (sx == null) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        sx = sy = null;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) this.switchWorld(dx < 0 ? 1 : -1);
      });
    },

    renderMap() {
      const w = this.mapWorld;
      const world = LV.WORLDS[w];
      const P = LV.Progress;
      const unlocked = P.worldUnlocked(w);
      $('mapWorldName').textContent = 'World ' + (w + 1) + ' · ' + world.name;
      $('mapWorldTag').textContent = world.tag;
      $('mapBlurb').textContent = world.blurb;
      $('mapPrev').classList.toggle('off', w === 0);
      $('mapNext').classList.toggle('off', w === LV.WORLDS.length - 1);
      $('mapStars').innerHTML = STAR + ' ' + P.worldStars(w) + ' / ' + LV.LEVELS_PER_WORLD * 3;
      $('mapCakes').textContent = LV.Collection.worldFound(w) + ' / ' + MAX + ' cakes';
      // the screen takes the world's colours
      const pal = FC.Scene.pal(world.theme);
      $('map').style.setProperty('--sky-a', pal.sky[1]);
      $('map').style.setProperty('--sky-b', pal.sky[3]);
      // dots
      const dots = $('mapDots');
      dots.innerHTML = '';
      LV.WORLDS.forEach((ww, i) => {
        const d = document.createElement('button');
        d.className = 'map-dot' + (i === w ? ' on' : '') + (P.worldUnlocked(i) ? '' : ' locked');
        d.setAttribute('aria-label', ww.name);
        d.addEventListener('click', () => { if (i !== this.mapWorld) { FC.Audio.click(); this.switchWorld(i > this.mapWorld ? 1 : -1); this.mapWorld = i; this.renderMap(); } });
        dots.appendChild(d);
      });
      // lock
      const lock = $('mapLock');
      lock.classList.toggle('hidden', unlocked);
      if (!unlocked) $('mapLockText').textContent = 'Clear level ' + LV.UNLOCK_AT + ' of ' + LV.WORLDS[w - 1].name + ' to open ' + world.name;
      $('mapCard').classList.toggle('locked', !unlocked);
      this.paintMapScene(w);
      this.buildMapPath();
      this.buildMapNodes(w);
    },

    // the world's sky and its castle island on the card
    paintMapScene(w) {
      const cv = $('mapScene'), card = $('mapCard');
      const W = card.clientWidth, H = card.clientHeight;
      if (!W || !H) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const S = FC.Scene;
      const theme = LV.WORLDS[w].theme;
      const pal = S.pal(theme);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      pal.sky.forEach((c, i) => g.addColorStop(i / (pal.sky.length - 1), c));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      if (S.ready(theme)) {
        const img = S.imgs[theme].far, m = S.meta(theme).far;
        if (img && img.naturalWidth) {
          const k = (W * 0.92) / m.iw;
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, W, H * 0.62);
          ctx.clip();
          ctx.drawImage(img, W / 2 - m.ax * k, H * 0.4 - m.ay * k, m.w * k, m.h * k);
          ctx.restore();
          // the island fades into the clouds below
          const f = ctx.createLinearGradient(0, H * 0.4, 0, H * 0.64);
          f.addColorStop(0, FC.rgba(pal.cloud.shade, 0));
          f.addColorStop(1, FC.rgba(pal.cloud.shade, 0.9));
          ctx.fillStyle = f;
          ctx.fillRect(0, H * 0.4, W, H * 0.25);
        }
      } else {
        S.load(theme).then(() => { if (this.mapWorld === w && !$('map').classList.contains('hidden')) this.paintMapScene(w); });
      }
      // a cloud sea the path winds over
      const c = ctx.createLinearGradient(0, H * 0.6, 0, H);
      c.addColorStop(0, FC.rgba(pal.cloud.shade, 0.9));
      c.addColorStop(0.5, FC.rgba(pal.cloud.mid, 0.95));
      c.addColorStop(1, pal.cloud.light);
      ctx.fillStyle = c;
      ctx.fillRect(0, H * 0.62, W, H * 0.38);
      // a few puffs
      ctx.fillStyle = FC.rgba(pal.cloud.light, 0.9);
      const rng = FC.rng(77 + w);
      for (let i = 0; i < 14; i++) {
        const x = rng() * W, y = H * (0.6 + rng() * 0.4), r = 12 + rng() * 28;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.6, r * 0.7, 0, 0, FC.TAU);
        ctx.fill();
      }
      // sparkles
      for (let i = 0; i < 18; i++) {
        FC.sparklePath(ctx, rng() * W, rng() * H * 0.9, 2 + rng() * 3, 0.3);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + rng() * 0.5).toFixed(2) + ')';
        ctx.fill();
      }
    },

    buildMapPath() {
      const svg = $('mapPath'), card = $('mapCard');
      const W = card.clientWidth, H = card.clientHeight;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('preserveAspectRatio', 'none');
      const pts = NODE_POS.map((p) => [(p[0] / 100) * W, (p[1] / 100) * H]);
      // a smooth curve through the nodes (Catmull-Rom to Bézier)
      let d = 'M' + pts[0][0] + ' ' + pts[0][1];
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += ' C' + c1[0].toFixed(1) + ' ' + c1[1].toFixed(1) + ' ' + c2[0].toFixed(1) + ' ' + c2[1].toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
      }
      svg.innerHTML = '<path d="' + d + '" class="path-under"/><path d="' + d + '" class="path-over"/>';
    },

    buildMapNodes(w) {
      const P = LV.Progress;
      const wrap = $('mapNodes');
      wrap.innerHTML = '';
      const cur = P.current();
      let marker = null;
      for (let l = 0; l < LV.LEVELS_PER_WORLD; l++) {
        const def = LV.level(w, l);
        const stars = P.stars(w, l);
        const open = P.unlocked(w, l);
        const current = cur.w === w && cur.l === l;
        const known = LV.Collection.has(def.kind);
        const node = document.createElement('button');
        node.className = 'map-node' + (stars > 0 ? ' done' : '') + (current ? ' current' : '') + (open ? '' : ' locked') + (l === LV.LEVELS_PER_WORLD - 1 ? ' castle' : '');
        node.style.left = NODE_POS[l][0] + '%';
        node.style.top = NODE_POS[l][1] + '%';
        node.setAttribute('aria-label', 'Level ' + (l + 1));
        const ring = document.createElement('span');
        ring.className = 'node-ring';
        if (open) {
          const cv = document.createElement('canvas');
          cv.className = 'node-icon';
          ring.appendChild(cv);
          CK.drawIcon(cv, def.kind, known ? { w: 44, h: 44 } : { w: 44, h: 44, silhouette: SIL });
        } else {
          const lk = document.createElement('span');
          lk.className = 'node-lock';
          lk.innerHTML = '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2.5" fill="#fff"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10" fill="none" stroke="#fff" stroke-width="2.4"/></svg>';
          ring.appendChild(lk);
        }
        node.appendChild(ring);
        const num = document.createElement('span');
        num.className = 'node-num';
        num.textContent = l + 1;
        node.appendChild(num);
        if (open) {
          const st = document.createElement('span');
          st.className = 'node-stars';
          st.innerHTML = starsHtml(stars, 'tiny');
          node.appendChild(st);
        }
        if (open) node.addEventListener('click', (e) => { e.stopPropagation(); FC.Audio.init(); FC.Audio.click(); this.openLevel(w, l); });
        wrap.appendChild(node);
        if (current) marker = l;
      }
      // Tilly waits at the level to play next (or at the castle once the world is done)
      const tl = $('mapTilly');
      const at = marker != null ? marker : P.worldUnlocked(w) ? LV.LEVELS_PER_WORLD - 1 : null;
      tl.classList.toggle('hidden', at == null);
      if (at != null) { tl.style.left = NODE_POS[at][0] + '%'; tl.style.top = NODE_POS[at][1] + '%'; }
    },

    startMapTilly() {
      this.stopMapTilly();
      const cv = $('mapTilly');
      const ctx = cv.getContext('2d');
      const draw = (ts) => {
        if ($('map').classList.contains('hidden')) { this.mapRaf = 0; return; }
        ctx.clearRect(0, 0, cv.width, cv.height);
        FC.Scene.drawTilly(ctx, 36, 40, 15, ts / 1000, 'idle', { x: 0.2, y: -0.4 });
        this.mapRaf = requestAnimationFrame(draw);
      };
      this.mapRaf = requestAnimationFrame(draw);
    },
    stopMapTilly() {
      if (this.mapRaf) cancelAnimationFrame(this.mapRaf);
      this.mapRaf = 0;
    },

    // ---------- the level card ----------
    openLevel(w, l) {
      const def = LV.level(w, l);
      const P = LV.Progress;
      this.levelPick = { w, l };
      const known = LV.Collection.has(def.kind);
      const s = CK.spec(def.kind);
      $('lcKicker').textContent = def.world.name + ' · Level ' + (l + 1);
      $('lcTitle').textContent = 'Bake the ' + (known ? s.name : '???');
      CK.drawIcon($('lcIcon'), def.kind, known ? { w: 120, h: 120 } : { w: 120, h: 120, silhouette: SIL });
      $('lcStars').innerHTML = starsHtml(P.stars(w, l));
      $('lcHint').textContent = known ? s.title : s.hint;
      // the day's water: the level's own twist, or the world's mood (plain spring water needs no note)
      const mod = $('lcMod');
      const note = def.mod && def.mod.name ? def.mod : w > 0 ? def.mood : null;
      // the castle's gift for the royal levels (a level twist that is itself a gift says so already)
      const wands = def.gifts && def.gifts.wands && !(def.mod && def.mod.gifts) ? def.gifts.wands : 0;
      const lines = [];
      if (note) lines.push('<b>' + esc(note.name) + '</b> ' + esc(note.text));
      if (wands) lines.push('<b>Castle gift</b> ' + wands + (wands === 1 ? ' Wand' : ' Wands') + ' to start with.');
      if (lines.length) { mod.classList.remove('hidden'); mod.innerHTML = lines.join('<br>'); }
      else mod.classList.add('hidden');
      // the stars: bake it – and bake it in few flicks
      $('lcGoals').innerHTML = '<span>' + STAR + ' bake it</span><span>' + STAR + STAR + ' in ' + def.par[0] + ' flicks</span><span>' + STAR + STAR + STAR + ' in ' + def.par[1] + ' flicks</span>';
      const bestF = P.flicks(w, l);
      $('lcBest').textContent = bestF ? 'Your best: ' + bestF + (bestF === 1 ? ' flick' : ' flicks') : P.stars(w, l) > 0 ? 'Baked before – now every flick counts!' : 'A new recipe!';
      $('lcPlay').textContent = P.stars(w, l) > 0 ? 'Bake again!' : 'Bake!';
      this.open('levelCard');
    },

    playLevel(w, l) {
      this.close('levelCard');
      this.close('won');
      this.stopMapTilly();
      G().startLevel(w, l);
    },

    // ---------- level clear ----------
    showLevelClear(level, res, kind) {
      const s = CK.spec(kind);
      const w = level.w, l = level.l;
      $('wonStars').innerHTML = starsHtml(res.stars, 'big');
      $('wonScore').textContent = res.score;
      $('wonFlicks').textContent = res.flicks;
      $('wonFlicksWord').textContent = res.flicks === 1 ? 'flick' : 'flicks';
      $('wonBest').textContent = res.prevFlicks && res.newBestFlicks ? 'New best!' : res.prevFlicks ? 'Best ' + LV.Progress.flicks(w, l) : '';
      // what the next star would take – a reason for one more try, never a scolding
      const par = res.par || LV.level(w, l).par;
      const hint = $('wonHint');
      if (res.stars >= 3) hint.innerHTML = 'Perfect bake! ' + STAR + STAR + STAR;
      else if (res.stars === 2) hint.innerHTML = STAR + STAR + STAR + ' in ' + par[1] + ' flicks or fewer';
      else hint.innerHTML = STAR + STAR + ' in ' + par[0] + ' flicks · ' + STAR + STAR + STAR + ' in ' + par[1];
      hint.classList.toggle('perfect', res.stars >= 3);
      CK.drawIcon($('wonIcon'), kind, { w: 120, h: 120, expr: 'happy' });
      const fresh = (G().runNew || []).indexOf(kind) >= 0;
      $('wonKicker').textContent = fresh ? 'New cake in your book!' : 'Baked again';
      $('wonName').textContent = s.name;
      $('wonEpithet').textContent = s.title;
      $('wonLore').textContent = s.lore;
      const unl = $('wonUnlock');
      if (res.worldUnlocked >= 0) { unl.textContent = LV.WORLDS[res.worldUnlocked].name + ' unlocked!'; unl.classList.remove('hidden'); }
      else unl.classList.add('hidden');
      this.wonNext = LV.Progress.next(w, l);
      $('wonNext').textContent = this.wonNext ? (this.wonNext.w !== w ? 'On to ' + LV.WORLDS[this.wonNext.w].name : 'Next level') : 'Back to the map';
      this.setGoal();
      this.open('won');
      FC.Audio.levelUp();
      // one chime per star as it lands (the CSS lets them pop in 0.18 s apart)
      clearTimeout(this.timers.st0); clearTimeout(this.timers.st1); clearTimeout(this.timers.st2);
      for (let i = 0; i < res.stars; i++) this.timers['st' + i] = setTimeout(() => { if (!$('won').classList.contains('hidden')) FC.Audio.star(i); }, 450 + i * 180);
    },

    // ============================================================
    // the Cake Book: every world's menu, the rare finds, and a detail card for each cake
    // ============================================================
    buildBook() {
      const g = G();
      const C = LV.Collection;
      const inRun = g.state === 'playing' || g.state === 'paused' || g.state === 'over' || g.state === 'won';
      const runNew = (inRun && g.runNew) || [];
      const total = C.total(), max = C.totalMax();
      $('bookSub').textContent = total >= max ? 'All ' + max + ' cakes baked – from tiny to fairytale!' : total + ' of ' + max + ' cakes baked';
      // tabs
      const tabs = $('bookTabs');
      tabs.innerHTML = '';
      const groups = LV.WORLDS.map((ww, i) => ({ key: i, name: ww.name.split(' ')[0], ids: CK.WORLD_MENUS[i].slice(1), locked: !LV.Progress.worldUnlocked(i) }));
      groups.push({ key: 'rare', name: 'Rare finds', ids: CK.RARES.concat(['magic']) });
      for (const gr of groups) {
        const b = document.createElement('button');
        const found = gr.ids.filter((id) => id === 'magic' ? false : C.has(id)).length;
        const n = gr.ids.filter((id) => id !== 'magic').length;
        b.className = 'book-tab' + (gr.key === this.bookTab ? ' on' : '') + (gr.locked ? ' locked' : '');
        b.innerHTML = esc(gr.name) + ' <small>' + found + '/' + n + '</small>';
        b.addEventListener('click', () => { FC.Audio.click(); this.bookTab = gr.key; this.buildBook(); });
        tabs.appendChild(b);
      }
      const gr = groups.find((x) => x.key === this.bookTab) || groups[0];
      const grid = $('bookGrid');
      grid.innerHTML = '';
      for (const id of gr.ids) {
        const s = CK.spec(id);
        const known = id === 'magic' || C.has(id);
        const fresh = runNew.indexOf(id) >= 0;
        const item = document.createElement('button');
        item.className = 'book-item' + (known ? '' : ' locked') + (fresh ? ' fresh' : '') + (s.world === 'rare' ? ' rare' : '');
        item.setAttribute('data-kind', id);
        const cv = document.createElement('canvas');
        cv.width = 72; cv.height = 72;
        item.appendChild(cv);
        const nm = document.createElement('div');
        nm.className = 'nm';
        nm.textContent = known ? s.name : '???';
        item.appendChild(nm);
        const tr = document.createElement('div');
        tr.className = 'tier';
        tr.textContent = s.tier === 0 ? 'Power-up' : 'Tier ' + s.tier + ' · ' + CK.SIZE_NAMES[s.tier] + (known ? '' : ' · keep baking!');
        item.appendChild(tr);
        if (fresh) {
          const tag = document.createElement('div');
          tag.className = 'tag';
          tag.textContent = 'New!';
          item.appendChild(tag);
        }
        const n = C.count(id);
        if (known && n > 1) {
          const ct = document.createElement('div');
          ct.className = 'count';
          ct.textContent = '×' + n;
          item.appendChild(ct);
        }
        item.addEventListener('click', (e) => { e.stopPropagation(); FC.Audio.click(); this.hideTip(); this.openDetail(id); });
        item.addEventListener('mouseenter', () => this.showTip(item, id, known));
        item.addEventListener('mouseleave', () => this.hideTip());
        grid.appendChild(item);
        CK.drawIcon(cv, id, known ? { w: 72, h: 72 } : { w: 72, h: 72, silhouette: SIL });
      }
    },

    // a hover tooltip (desktop): the epithet, or the hint while the cake is unknown
    showTip(item, id, known) {
      if (!window.matchMedia || !window.matchMedia('(hover: hover)').matches) return;
      const s = CK.spec(id);
      const tip = $('bookTip');
      tip.innerHTML = known ? '<b>' + esc(s.name) + '</b><span>' + esc(s.title) + '</span>' : '<b>???</b><span>' + esc(s.hint) + '</span>';
      tip.classList.remove('hidden');
      const r = item.getBoundingClientRect();
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      let x = r.left + r.width / 2 - tw / 2, y = r.top - th - 8;
      x = FC.clamp(x, 8, window.innerWidth - tw - 8);
      if (y < 8) y = r.bottom + 8;
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
    },
    hideTip() { $('bookTip').classList.add('hidden'); },

    // the detail card: the cake, its story and where it comes from
    openDetail(id) {
      const s = CK.spec(id);
      const C = LV.Collection;
      const known = id === 'magic' || C.has(id);
      CK.drawIcon($('detailIcon'), id, known ? { w: 150, h: 150, expr: 'happy' } : { w: 150, h: 150, silhouette: SIL });
      $('detailTier').textContent = s.tier === 0 ? 'Power-up' : 'Tier ' + s.tier + ' · ' + CK.SIZE_NAMES[s.tier];
      $('detailName').textContent = known ? s.name : '???';
      $('detailEpithet').textContent = known ? s.title : s.hint;
      $('detailLore').textContent = known ? s.lore : 'Bake it to read its story.';
      const ingr = $('detailIngr');
      if (known && s.ingr) ingr.innerHTML = '<b>Ingredients</b>' + s.ingr.map((x) => '<span>' + esc(x) + '</span>').join('');
      else ingr.innerHTML = '';
      let where;
      if (s.world === 'rare') where = 'A rare find – it drifts into the sling now and then' + (typeof s.boost === 'number' ? ', most often in ' + LV.WORLDS[s.boost].name : '') + '.';
      else if (s.world === 'magic') where = 'A gift for every finished order, and in Fairy Bubbles.';
      else {
        const world = LV.WORLDS[s.world];
        where = s.tier >= 4 ? world.name + ' · Level ' + (s.tier - 3) : 'Baked everywhere in ' + world.name + '.';
      }
      const n = C.count(id);
      $('detailMeta').innerHTML = '<span>' + esc(where) + '</span>' + (known && id !== 'magic' ? '<span>Baked ' + (n === 1 ? 'once' : n + ' times') + '</span>' : '');
      $('cakeDetail').classList.toggle('unknown', !known);
      this.open('cakeDetail');
    },

    // little "A + A = B" strip on the title screen
    drawTitleChain() {
      const row = $('titleChain');
      if (!row) return;
      row.innerHTML = '';
      const sym = (t) => { const s = document.createElement('span'); s.className = 'sym'; s.textContent = t; row.appendChild(s); };
      row.appendChild(iconCanvas('w0t1', 26)); sym('+'); row.appendChild(iconCanvas('w0t1', 26)); sym('=');
      row.appendChild(iconCanvas('w0t2', 31)); sym('…'); row.appendChild(iconCanvas('w0t11', 40));
    },

    drawHowIcons() {
      document.querySelectorAll('.step-icon').forEach((cv) => {
        const kind = cv.getAttribute('data-icon');
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const W = 64, H = 64;
        cv.width = W * dpr; cv.height = H * dpr;
        const ctx = cv.getContext('2d');
        ctx.scale(dpr, dpr);
        const icon = (tier, x, y, s) => {
          const c = document.createElement('canvas');
          CK.drawIcon(c, 'w0t' + tier, { w: s, h: s });
          ctx.drawImage(c, x - s / 2, y - s / 2, s, s);
        };
        if (kind === 'aim') {
          ctx.fillStyle = '#ff6fa8';
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(30, 22 - i * 6, 2.2, 0, FC.TAU); ctx.fill(); }
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#ff9cc8';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(12, 34); ctx.lineTo(30, 50); ctx.lineTo(48, 34); ctx.stroke();
          ctx.strokeStyle = '#c4588f';
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(12, 33); ctx.lineTo(12, 46); ctx.moveTo(48, 33); ctx.lineTo(48, 46); ctx.stroke();
          icon(3, 30, 40, 26);
          ctx.strokeStyle = '#8f6be6';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(56, 40); ctx.lineTo(56, 58); ctx.moveTo(52, 54); ctx.lineTo(56, 59); ctx.lineTo(60, 54); ctx.stroke();
        } else if (kind === 'merge') {
          icon(1, 13, 22, 26);
          icon(1, 31, 22, 26);
          ctx.fillStyle = '#ff6fa8';
          FC.heartPath(ctx, 22, 10, 5);
          ctx.fill();
          ctx.strokeStyle = '#b99cf0';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(22, 36); ctx.lineTo(22, 44); ctx.moveTo(18, 41); ctx.lineTo(22, 45); ctx.lineTo(26, 41);
          ctx.stroke();
          icon(2, 44, 48, 32);
        } else if (kind === 'water') {
          ctx.beginPath();
          ctx.ellipse(32, 36, 28, 20, 0, 0, FC.TAU);
          ctx.fillStyle = '#7bdbe8';
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(32, 36, 15, 10.5, 0, 0, FC.TAU);
          ctx.fillStyle = '#95e4ee';
          ctx.fill();
          icon(3, 30, 33, 18);
          icon(1, 40, 40, 13);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.6;
          ctx.lineCap = 'round';
          for (const [a0, a1] of [[Math.PI * 1.1, Math.PI * 1.7], [Math.PI * 0.1, Math.PI * 0.7]]) {
            ctx.beginPath();
            ctx.ellipse(32, 36, 23, 16, 0, a0, a1);
            ctx.stroke();
            const ex = 32 + Math.cos(a1) * 23, ey = 36 + Math.sin(a1) * 16;
            const tx = -Math.sin(a1), ty = Math.cos(a1) * 0.7;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(ex + tx * 5, ey + ty * 5);
            ctx.lineTo(ex - ty * 4 - tx * 2, ey + tx * 4 - ty * 2);
            ctx.lineTo(ex + ty * 4 - tx * 2, ey - tx * 4 - ty * 2);
            ctx.closePath();
            ctx.fill();
          }
          ctx.fillStyle = '#ffb3d9';
          for (const [x, y] of [[12, 30], [50, 44], [22, 50]]) { ctx.beginPath(); ctx.ellipse(x, y, 3, 1.8, 0.6, 0, FC.TAU); ctx.fill(); }
        } else {
          ctx.beginPath();
          ctx.ellipse(32, 36, 28, 20, 0, 0, FC.TAU);
          ctx.fillStyle = '#7bdbe8';
          ctx.fill();
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.ellipse(32, 36, 21, 15, 0, 0, FC.TAU);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.setLineDash([]);
          icon(4, 50, 22, 26);
          ctx.beginPath();
          ctx.arc(56, 8, 7, 0, FC.TAU);
          ctx.fillStyle = '#ff4f86';
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = '700 10px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('3', 56, 8.5);
        }
      });
    },
  };

  FC.UI = UI;
})();
