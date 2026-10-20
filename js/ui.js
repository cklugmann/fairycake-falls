/* Fairycake Falls – DOM UI: HUD, coach tips, menus, banners, the Cake Book (also mid-game). */
(function () {
  'use strict';
  const FC = window.FC;
  const $ = (id) => document.getElementById(id);
  const G = () => FC.Game;
  const TIERS = FC.Cakes.TIERS;
  const MAX = FC.Cakes.MAX_TIER;

  const SPEAKER_ON = '<svg viewBox="0 0 24 24"><path d="M4 9h3.5L12 5v14l-4.5-4H4z" fill="#fff"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>';
  const SPEAKER_OFF = '<svg viewBox="0 0 24 24"><path d="M4 9h3.5L12 5v14l-4.5-4H4z" fill="#fff"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>';
  const HEART = '<svg class="ic-heart" viewBox="0 0 24 24"><path d="M12 21C5 15.5 2 12.3 2 8.6 2 5.6 4.4 3.3 7.3 3.3c1.9 0 3.6 1 4.7 2.6 1.1-1.6 2.8-2.6 4.7-2.6 2.9 0 5.3 2.3 5.3 5.3 0 3.7-3 6.9-10 12.4z" fill="#ff6fa8" stroke="#fff" stroke-width="2"/></svg>';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (s) => esc(s).replace(/\{heart\}/g, HEART);

  function iconCanvas(tier, size) {
    const c = document.createElement('canvas');
    c.style.width = c.style.height = size + 'px';
    FC.Cakes.drawIcon(c, tier, { w: size, h: size });
    return c;
  }

  const UI = {
    timers: {},

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
      click('playBtn', () => G().newGame());
      click('howBtn', () => this.open('how'));
      click('bookBtn', () => this.openBook());
      click('bookHud', () => this.openBook());
      click('pauseBookBtn', () => this.openBook());
      click('pauseBtn', () => this.pause());
      click('resumeBtn', () => this.resume());
      click('restartBtn', () => { this.close('pause'); G().newGame(); });
      click('menuBtn', () => { this.close('pause'); this.showTitle(); });
      click('pauseHowBtn', () => this.open('how'));
      click('againBtn', () => { this.close('over'); G().newGame(); });
      click('overMenuBtn', () => { this.close('over'); this.showTitle(); });
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
      document.querySelectorAll('[data-close]').forEach((el) => {
        el.addEventListener('click', () => { FC.Audio.click(); this.close(el.getAttribute('data-close')); });
      });
      // HUD buttons must not start a flick on the canvas underneath
      ['nextBtn', 'jokerBtn', 'wandBtn', 'pauseBtn', 'bookHud'].forEach((id) => {
        $(id).addEventListener('pointerdown', (e) => e.stopPropagation());
      });
      FC.Cakes.drawIcon($('jokerIcon'), 0, { w: 52, h: 52 });
      this.drawHowIcons();
      this.drawTitleChain();
      this.refreshToggles();
      $('bestTitle').textContent = G().best;
      this.layout();
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
        if (this.bookFromGame) { this.bookFromGame = false; this.resume(); }
        else if (this.bookFromPause) { this.bookFromPause = false; this.open('pause'); }
      }
    },

    // the Cake Book: from the title, from the pause menu, or straight out of the game (which pauses meanwhile)
    openBook() {
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
      this.buildBook();
      $('bookHud').classList.remove('new');
      this.open('book');
    },

    showTitle() {
      ['hud', 'pause', 'over', 'how', 'book'].forEach((id) => $(id).classList.add('hidden'));
      $('title').classList.remove('hidden');
      $('bestTitle').textContent = G().best;
      this.coachHide();
      G().toTitle();
    },

    onNewGame() {
      ['title', 'pause', 'over', 'how', 'book'].forEach((id) => $(id).classList.add('hidden'));
      $('hud').classList.remove('hidden');
      $('hud').classList.remove('danger');
      this.setScore(0);
      this.setStage(1, 0, G().stageGoal);
      this.layout();
      this.updatePowers();
      this.setBook();
      this.setStreak(0);
      this.coachHide();
      G().overShown = false;
    },

    pause() {
      if (G().state !== 'playing') return;
      G().state = 'paused';
      G().cancelAim();
      this.refreshToggles();
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
      $('overScore').textContent = st.score;
      $('overBest').textContent = st.best;
      $('newBest').classList.toggle('hidden', !st.newBest);
      $('overLevel').textContent = st.stage;
      $('overMerges').textContent = st.merges;
      $('overCombo').textContent = 'x' + Math.max(1, st.combo);
      $('overCakeName').textContent = TIERS[st.maxTier].name;
      FC.Cakes.drawIcon($('overCake'), st.maxTier, { w: 60, h: 60 });
      this.open('over');
    },

    refreshToggles() {
      $('musicBtn').textContent = 'Music: ' + (FC.Audio.musicOn ? 'on' : 'off');
      $('sfxBtn').textContent = 'Sound: ' + (FC.Audio.sfxOn ? 'on' : 'off');
      $('soundBtnTitle').innerHTML = FC.Audio.musicOn || FC.Audio.sfxOn ? SPEAKER_ON : SPEAKER_OFF;
    },

    setScore(n) {
      $('score').textContent = n;
      const p = $('score').parentElement;
      p.classList.remove('bump');
      void p.offsetWidth;
      p.classList.add('bump');
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

    updateNext(pulse) {
      const q = G().queue;
      if (!q || q.length < 2) return;
      FC.Cakes.drawIcon($('nextCanvas'), q[1], { w: 56, h: 56 });
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

    discover(tier) {
      const d = $('discover');
      $('discoverName').textContent = TIERS[tier].name;
      FC.Cakes.drawIcon($('discoverIcon'), tier, { w: 48, h: 48 });
      d.classList.add('show');
      clearTimeout(this.timers.disc);
      this.timers.disc = setTimeout(() => d.classList.remove('show'), 2600);
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
        row.appendChild(iconCanvas(o.eq[0], 34)); sym('+');
        row.appendChild(iconCanvas(o.eq[1], 34)); sym('=');
        row.appendChild(iconCanvas(o.eq[2], 42));
      } else if (o.chain) {
        [1, 2, 3, 4].forEach((t, i) => { row.appendChild(iconCanvas(t, 24 + i * 3)); sym('›'); });
        sym('…'); sym('›');
        row.appendChild(iconCanvas(MAX, 44));
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
      const disc = G().discovered || [1];
      $('bookCount').textContent = disc.filter((t) => t >= 1 && t <= MAX).length + '/' + MAX;
    },
    // a cake was discovered for the first time: the pill shows "New!" until the book is opened
    markNewCake() {
      this.setBook();
      const b = $('bookHud');
      b.classList.remove('new');
      void b.offsetWidth;
      b.classList.add('new');
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

    // every cake with its name once you have baked it; the ones of this run are marked, a first-time find glows
    buildBook() {
      const g = G();
      const grid = $('bookGrid');
      grid.innerHTML = '';
      const disc = g.discovered || [1];
      const inRun = g.state === 'playing' || g.state === 'paused' || g.state === 'over';
      const runNew = (inRun && g.runNew) || [];
      const found = disc.filter((t) => t >= 1 && t <= MAX).length;
      let sub = found >= MAX ? 'All ' + MAX + ' cakes baked – from tiny to fairytale!' : found + ' of ' + MAX + ' cakes baked';
      if (inRun && g.maxTier >= 2) sub += ' · this run: up to the ' + TIERS[g.maxTier].name;
      $('bookSub').textContent = sub;
      const order = [];
      for (let t = 1; t <= MAX; t++) order.push(t);
      order.push(0);
      for (const t of order) {
        const known = t === 0 || disc.indexOf(t) >= 0;
        const fresh = runNew.indexOf(t) >= 0;
        const run = inRun && t >= 1 && t <= g.maxTier;
        const item = document.createElement('div');
        item.className = 'book-item' + (known ? '' : ' locked') + (fresh ? ' fresh' : '') + (run ? ' run' : '');
        const cv = document.createElement('canvas');
        cv.width = 72; cv.height = 72;
        item.appendChild(cv);
        const nm = document.createElement('div');
        nm.className = 'nm';
        nm.textContent = known ? TIERS[t].name : '???';
        item.appendChild(nm);
        const tr = document.createElement('div');
        tr.className = 'tier';
        tr.textContent = t === 0 ? 'Power-up' : known ? 'Tier ' + t : 'Tier ' + t + ' · keep baking!';
        item.appendChild(tr);
        if (fresh || run) {
          const tag = document.createElement('div');
          tag.className = 'tag';
          tag.textContent = fresh ? 'New!' : 'this run';
          item.appendChild(tag);
        }
        grid.appendChild(item);
        FC.Cakes.drawIcon(cv, t, known ? { w: 72, h: 72 } : { w: 72, h: 72, silhouette: '#e3cfe0' });
      }
    },

    // little "A + A = B" strip on the title screen
    drawTitleChain() {
      const row = $('titleChain');
      if (!row) return;
      row.innerHTML = '';
      const sym = (t) => { const s = document.createElement('span'); s.className = 'sym'; s.textContent = t; row.appendChild(s); };
      row.appendChild(iconCanvas(1, 26)); sym('+'); row.appendChild(iconCanvas(1, 26)); sym('=');
      row.appendChild(iconCanvas(2, 31)); sym('…'); row.appendChild(iconCanvas(MAX, 40));
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
          FC.Cakes.drawIcon(c, tier, { w: s, h: s });
          ctx.drawImage(c, x - s / 2, y - s / 2, s, s);
        };
        if (kind === 'aim') {
          // dotted path forward
          ctx.fillStyle = '#ff6fa8';
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(30, 22 - i * 6, 2.2, 0, FC.TAU); ctx.fill(); }
          // sling posts + ribbon pulled back
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#ff9cc8';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(12, 34); ctx.lineTo(30, 50); ctx.lineTo(48, 34); ctx.stroke();
          ctx.strokeStyle = '#c4588f';
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(12, 33); ctx.lineTo(12, 46); ctx.moveTo(48, 33); ctx.lineTo(48, 46); ctx.stroke();
          icon(3, 30, 40, 26);
          // pull arrow
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
          // the pond: a current racing round the rim (arrows + foam), a calm middle with the pile
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
