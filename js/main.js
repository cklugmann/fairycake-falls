/* Fairycake Falls – bootstrap */
(function () {
  'use strict';
  const FC = window.FC;

  async function boot() {
    const bar = document.getElementById('loadBar');
    const text = document.querySelector('.load-text');
    if (!window.FC_ASSETS) {
      text.textContent = 'Art assets are missing (assets/manifest.js). Run: node tools/build-assets.js';
      return;
    }
    try {
      await Promise.race([document.fonts.load('700 24px Fredoka'), new Promise((r) => setTimeout(r, 1500))]);
    } catch (e) { /* ignore */ }
    await FC.Scene.load(0, (p) => { bar.style.width = Math.round(p * 100) + '%'; });
    FC.Game.init(document.getElementById('game'));
    FC.UI.init();
    document.getElementById('loading').classList.add('hidden');
    FC.UI.showTitle();
    requestAnimationFrame((t) => FC.Game.loop(t));
    // warm up the other unlocked worlds in the background (the map shows them)
    setTimeout(() => { for (let w = 1; w < FC.Levels.WORLDS.length; w++) if (FC.Levels.Progress.worldUnlocked(w)) FC.Scene.load(FC.Levels.WORLDS[w].theme); }, 4000);
    // audio needs a user gesture
    const unlock = () => { FC.Audio.init(); window.removeEventListener('pointerdown', unlock); };
    window.addEventListener('pointerdown', unlock);
  }

  // debug hooks for automated testing
  window.FCdebug = {
    spawn(tier, x, y, kind) {
      const b = new FC.Physics.Body(tier, FC.Cakes.TIERS[tier].r, x, y, kind);
      FC.Game.world.add(b);
      return b;
    },
    state: () => ({ state: FC.Game.state, mode: FC.Game.mode, level: FC.Game.level && { w: FC.Game.level.w, l: FC.Game.level.l, goal: FC.Game.level.def.goal }, won: FC.Game.won, score: FC.Game.score, stage: FC.Game.stage, stageMerges: FC.Game.stageMerges, stageGoal: FC.Game.stageGoal, whirl: !!FC.Game.whirl, bodies: FC.Game.world.count(), danger: FC.Game.danger, queue: FC.Game.queue.slice(), merges: FC.Game.merges, theme: FC.Scene.theme, shots: FC.Game.shots, maxTier: FC.Game.maxTier, coach: FC.Game.coach && FC.Game.coach.step }),
    // where the cake in the sling is on screen (for input tests)
    sling() {
      const G = FC.Game, g = G.slingGround(), rr = FC.Cakes.TIERS[FC.Cakes.tierOf(G.queue[0])].r * FC.Scene.s;
      return { x: g.x, y: g.y - rr * 0.45, rr, maxPull: G.maxPull(), cx: FC.Scene.cx, cy: FC.Scene.cy, pr: FC.Scene.pr, K: FC.Scene.K };
    },
    // let the water turn the pond for t seconds (resting cakes only) – for tests that wait for a target
    advance(t) { FC.Game.world.advance(t); FC.Game.whirlPhase += FC.Game.world.omegaCore * t; },
    water: () => ({ omegaCore: FC.Game.world.omegaCore, vRim: FC.Game.world.vRim, rCalm: FC.Game.world.rCalm, spin: FC.Game.world.spin, inflowK: FC.Game.world.inflowK }),
    // flick without input: angle in degrees from straight ahead (+ = right), power 0..1
    fire(deg, power) {
      const G = FC.Game, a = (deg * Math.PI) / 180;
      const sp = FC.Physics.speedForPower(power);
      G.fire({ x: Math.sin(a), y: -Math.cos(a) }, sp, power, G.anchorW(G.queue[0]));
    },
    // start a level of the adventure directly
    level(w, l) { FC.UI.playLevel(w, l); },
    // unlock everything / forget everything (for testing)
    unlockAll() { for (let w = 0; w < FC.Levels.WORLDS.length; w++) for (let l = 0; l < FC.Levels.LEVELS_PER_WORLD; l++) FC.Levels.Progress.record(w, l, 1); },
    wipe() { FC.Levels.Progress.reset(); FC.Levels.Collection.reset(); FC.store.set('best', 0); FC.store.set('coach', 0); },
  };

  boot();
})();
