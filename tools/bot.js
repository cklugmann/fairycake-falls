/* Fairycake Falls – headless balance harness.
   A scripted player drives FC.Game.update() directly (no rendering) and plays with the
   same preview the player sees: it searches angles and powers for the flick that bakes the
   most, swaps when the next cake is better, sometimes waits for the water to turn the pile,
   and aims with human-like noise.

   usage: npm i -D playwright && node tools/bot.js <games> [maxShots] [skill] [world.level]
          skill 1 = careful, 0.5 = sloppy (half of the flicks are random lobs)
          world.level (e.g. 1.3 = Candy Woods, level 4) plays that level of the adventure instead of the endless pond,
          and reports flicks and score at the moment the goal cake is baked (for the star thresholds)
          env BOT_PAR = games run in parallel (default 3), PW_CHROME = path to a Chromium binary
   prints one JSON line per game (shots, score, stage, merges, biggest cake, whirl stats), averages, and the
   time course in buckets of 10 flicks: cakes in the pond, how full the pool is (sum of cake areas over the
   pool area; a packed pool reaches ~53 %), how far the cluster reaches (% of the ring), how often a merge was on offer,
   how often a flick merged (heart% = a direct match was in the preview, the merge a human sees), how often a
   warning was on (a cake beyond the ring for more than 1.5 s). */
const { chromium } = require('playwright');
const path = require('path');

const BOT = `
(function(){
  const G = FC.Game, W = G.world, T = FC.Cakes.TIERS, P = FC.Physics;
  const DT = 1/60;
  G._render = G._render || G.render; G._loop = G._loop || G.loop;
  G.render = () => {};
  G.loop = () => {};
  // silence audio/vibrate
  for (const k of Object.keys(FC.Audio)) if (typeof FC.Audio[k] === 'function' && k !== 'init') FC.Audio[k] = () => {};
  navigator.vibrate = null;
  FC.store.set('coach', 3);
  FC.Levels.Progress.load();
  function stepFor(sec) { const n = Math.round(sec / DT); for (let i = 0; i < n; i++) G.update(DT); }
  function settled() {
    for (const b of W.bodies) if (!b.dead && !b.sensor) {
      const w = { x: 0, y: 0 }; W.flowAt(b.x, b.y, w, b.r);
      if (Math.hypot(b.vx - w.x, b.vy - w.y) > 70) return false;
    }
    return true;
  }
  function waitSettle(max) { let t = 0; while (t < max && !G.won && (!settled() || G.whirl || G.stageDone)) { G.update(DT); t += DT; } return t; }
  function search(kind) {
    const tier = FC.Cakes.tierOf(kind);
    const r = T[tier].r, L = G.anchorW(tier);
    let best = null, direct = 0;
    for (let deg = -76; deg <= 76; deg += 3) {
      for (const p of [0.18, 0.26, 0.34, 0.42, 0.5, 0.58, 0.68, 0.8, 0.92]) {
        const a = deg * Math.PI / 180, sp = P.speedForPower(p);
        const pr = W.predict(L.x, L.y, Math.sin(a) * sp, -Math.cos(a) * sp, r, tier, { maxT: 3.4, maxLen: 3000, spacing: 60 });
        let score = 0, info = null;
        if (pr.hit && !pr.hit.body.sensor) {
          if (pr.hit.body.tier === tier) direct++; // a heart in the preview: what a human sees
          const lk = W.lookAhead(pr.hit, { tier, r }, { time: 1.1, step: 1/100, tierR: (t) => T[t].r, maxTier: 11 });
          for (const ev of lk.events) score += ev.kind === 'royal' ? 50 : (ev.tier || 2) * 2;
          // penalise pushing cakes outwards
          for (const m of lk.moved) { const d1 = Math.hypot(m.x, m.y) + m.r; if (d1 > 820) score -= (d1 - 820) / 40; }
          info = { events: lk.events.length };
        } else if (pr.hit && pr.hit.body.sensor) {
          score = 6; // bubble!
        } else {
          // placement: closer to the pile centre is safer
          const d = Math.hypot(pr.end.x, pr.end.y);
          score = -0.5 - d / 1000;
        }
        if (!best || score > best.score) best = { deg, p, score, info, hit: !!pr.hit, ride: !!(pr.hit && pr.hit.drift && pr.land && Math.abs(Math.atan2(pr.land.y, pr.land.x) - Math.atan2(pr.hit.y, pr.hit.x)) > 0.6) };
      }
    }
    best.direct = direct;
    return best;
  }
  function play(opts) {
    const o = opts || {};
    const maxShots = o.maxShots || 400;
    const skill = o.skill == null ? 1 : o.skill; // 1 = careful, 0.5 = sloppy
    if (o.level) G.startLevel(o.level.w, o.level.l); else G.newGame();
    stepFor(1.2);
    const log = { whirls: [], danger: 0, waits: 0, rides: 0, disp: 0, dispN: 0, knocks: 0, mergeShots: 0, course: [], firstDanger: null, firstWarn: null, noOffer: 0, directOffer: 0 };
    let shots = 0, simT = 0;
    while (G.state === 'playing' && !G.won && shots < maxShots) {
      simT += waitSettle(4);
      if (G.state !== 'playing' || G.won) break;
      // wand if in danger
      if (G.danger > 1.5 && G.wands > 0 && G.dangerBody) { G.wandMode = true; const p = FC.Scene.w2s(G.dangerBody.x, G.dangerBody.y); G.wandTap(p.x, p.y - G.dangerBody.r * FC.Scene.s * 0.45); G.update(DT); continue; }
      let tier = G.queue[0];
      let best = search(tier);
      let direct = best.direct;
      // swap?
      if (G.queue.length > 1 && G.queue[1] !== tier && Math.random() < skill) {
        const alt = search(G.queue[1]);
        direct += alt.direct;
        if (alt.score > best.score + 0.5) { G.swap(); tier = G.queue[0]; best = alt; }
      }
      if (direct > 0) log.directOffer++;
      if (best.score <= 0) log.noOffer++;
      // a sloppy player sometimes just lobs the cake somewhere sensible
      if (Math.random() > skill) { best = { deg: (Math.random() - 0.5) * 60, p: 0.3 + Math.random() * 0.4, score: 0 }; }
      // nothing bakes right now: a patient player waits a little for the pile to turn (shooting nothing is not
      // an option, but we let the water work for up to ~3 s before the placement shot)
      if (best.score <= 0 && Math.random() < skill * 0.5) {
        stepFor(2.5);
        simT += 2.5;
        log.waits++;
        const b2 = search(tier);
        if (b2.score > best.score) best = b2;
      }
      // use joker when a big pair is close? keep simple: use when owned and the best has no merge
      if (G.jokers > 0 && best.score <= 0 && Math.random() < 0.6 && G.queue[0] !== 'magic') { G.useJoker(); tier = G.queue[0]; best = search(tier); }
      // human-like noise
      const noise = 3 + (1 - skill) * 8;
      const deg = best.deg + (Math.random() - 0.5) * noise, p = Math.max(0.05, Math.min(1, best.p + (Math.random() - 0.5) * (0.04 + (1 - skill) * 0.1)));
      if (best.ride) log.rides++;
      // impact bookkeeping: where is the pile before the shot, where after it has settled?
      const snap = new Map();
      for (const b of W.bodies) if (!b.dead && !b.sensor) snap.set(b.id, { x: b.x, y: b.y, edge: Math.hypot(b.x, b.y) + b.r });
      FCdebug.fire(deg, p);
      shots++;
      const t0 = W.time, m0 = G.merges;
      stepFor(0.3);
      simT += waitSettle(4);
      if (G.merges > m0) log.mergeShots++;
      // displacement in the frame of the turning pool
      const turned = W.omegaCore * (W.time - t0), ct = Math.cos(turned), stt = Math.sin(turned);
      let moved = 0, nMoved = 0, knocked = 0;
      for (const b of W.bodies) {
        if (b.dead || b.sensor) continue;
        const o = snap.get(b.id);
        if (!o) continue;
        const ox = o.x * ct - o.y * stt, oy = o.x * stt + o.y * ct;
        const d = Math.hypot(b.x - ox, b.y - oy);
        moved += d; nMoved++;
        if (o.edge <= G.ring && Math.hypot(b.x, b.y) + b.r > G.ring + 5) knocked++;
      }
      if (nMoved) { log.disp += moved / nMoved; log.dispN++; }
      if (knocked) log.knocks++;
      if (G.danger > 0) log.danger++;
      if (G.danger > 0 && log.firstDanger == null) log.firstDanger = shots;
      if (G.danger > 1.5 && log.firstWarn == null) log.firstWarn = shots;
      simT += 1.0; // aiming time budget per shot (not simulated)
      // the time course: how full is the pool, how many cakes, was a merge on offer?
      {
        let area = 0, n = 0, maxEdge = 0;
        for (const b of W.bodies) if (!b.dead && !b.sensor) { area += b.rT * b.rT; n++; maxEdge = Math.max(maxEdge, Math.hypot(b.x, b.y) + b.r); }
        log.course.push({ shot: shots, n, fill: +(area / (G.ring * G.ring)).toFixed(3), edge: Math.round(maxEdge / G.ring * 100), offer: best.score > 0 ? 1 : 0, direct: direct > 0 ? 1 : 0, merged: G.merges > m0 ? 1 : 0, danger: +G.danger.toFixed(1), stage: G.stage, t: Math.round(simT) });
      }
      // observe whirls
      if (G.whirl && !log.whirls.find((w) => w.stage === G.stage)) {
        const before = W.bodies.filter((b) => !b.dead && !b.sensor).length;
        const m0 = G.merges;
        let maxEdge = 0;
        let guard = 0;
        while (G.whirl && G.state === 'playing' && guard++ < 2000) { G.update(DT); for (const b of W.bodies) if (!b.dead && !b.sensor) maxEdge = Math.max(maxEdge, Math.hypot(b.x, b.y) + b.r); }
        stepFor(1.5);
        let edge = 0, outside = 0;
        for (const b of W.bodies) if (!b.dead && !b.sensor) { const e = Math.hypot(b.x, b.y) + b.r; edge = Math.max(edge, e); if (e > 880) outside++; }
        log.whirls.push({ stage: G.stage, shots, before, merges: G.merges - m0, maxEdge: Math.round(maxEdge), edgeAfter: Math.round(edge), outside, danger: G.danger });
      }
    }
    if (G.won) stepFor(3); // the fireworks, then the card: that is when the stars are recorded
    const tiers = {};
    for (const b of W.bodies) if (!b.dead && !b.sensor) tiers[b.tier] = (tiers[b.tier] || 0) + 1;
    const c = G.culprit;
    const culprit = c ? { tier: c.tier, x: Math.round(c.x), y: Math.round(c.y), vx: Math.round(c.vx), vy: Math.round(c.vy), r: c.r, age: +c.age.toFixed(2), rCalm: Math.round(W.rCalm), inflowK: W.inflowK, stageDone: G.stageDone } : null;
    const all = W.bodies.filter((b) => !b.dead).map((b) => [b.tier, Math.round(b.x), Math.round(b.y), Math.round(b.r), b.sensor ? 'S' : '']);
    return { state: G.won ? 'won' : G.state, won: !!G.won, stars: G.levelResult ? G.levelResult.stars : 0, shots, score: G.score, stage: G.stage, merges: G.merges, maxTier: G.maxTier, simT: Math.round(simT), bodies: W.count((b) => !b.sensor), tiers, culprit, all, whirls: log.whirls, waits: log.waits, rides: log.rides, meanDisp: Math.round(log.disp / (log.dispN || 1)), knockShots: log.knocks, dangerShots: log.danger, mergeShots: log.mergeShots, noOffer: log.noOffer, directOffer: log.directOffer, firstDanger: log.firstDanger, firstWarn: log.firstWarn, course: log.course };
  }
  window.BOT = { play, search, stepFor, waitSettle };
  window.BOTsettled = settled;
})();
`;

(async () => {
  const games = +(process.argv[2] || 3);
  const maxShots = +(process.argv[3] || 400);
  const skill = +(process.argv[4] || 1);
  const lvArg = process.argv[5];
  const level = lvArg ? { w: +lvArg.split('.')[0], l: +lvArg.split('.')[1] } : null;
  const par = +(process.env.BOT_PAR || 3);
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || (require('fs').existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined) });
  const results = [];
  const runOne = async (i) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type(), m.text()); });
    await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
    await page.waitForFunction(() => window.FC && FC.Game && FC.Game.state === 'title', null, { timeout: 15000 });
    await page.evaluate(BOT);
    const t0 = Date.now();
    const r = await page.evaluate(([m, sk, lv]) => window.BOT.play({ maxShots: m, skill: sk, level: lv }), [maxShots, skill, level]);
    r.wall = ((Date.now() - t0) / 1000).toFixed(1) + 's';
    results[i] = r;
    console.log(JSON.stringify({ ...r, all: undefined, course: undefined, whirls: r.whirls.map((w) => [w.stage, w.shots, w.before, w.merges, w.edgeAfter, w.outside]) }));
    await page.close();
  };
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(par, games) }, async () => { while (next < games) await runOne(next++); }));
  const avg = (k) => (results.reduce((s, r) => s + (r[k] || 0), 0) / results.length).toFixed(1);
  if (level) {
    const won = results.filter((r) => r.won);
    const med = (arr) => { const a = arr.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };
    console.log('LEVEL', lvArg, 'won', won.length + '/' + results.length, 'shots med', med(won.map((r) => r.shots)), 'min', Math.min(...won.map((r) => r.shots)), 'max', Math.max(...won.map((r) => r.shots)),
      'score med', med(won.map((r) => r.score)), 'min', Math.min(...won.map((r) => r.score)), 'max', Math.max(...won.map((r) => r.score)), 'merges med', med(won.map((r) => r.merges)), 'stars', won.map((r) => r.stars).join(''));
  }
  console.log('AVG shots', avg('shots'), 'score', avg('score'), 'stage', avg('stage'), 'merges', avg('merges'), 'maxTier', avg('maxTier'), 'simT', avg('simT'),
    'mergeShots%', (100 * results.reduce((s, r) => s + r.mergeShots, 0) / results.reduce((s, r) => s + r.shots, 0)).toFixed(0),
    'noOffer%', (100 * results.reduce((s, r) => s + r.noOffer, 0) / results.reduce((s, r) => s + r.shots, 0)).toFixed(0),
    'heart%', (100 * results.reduce((s, r) => s + (r.directOffer || 0), 0) / results.reduce((s, r) => s + r.shots, 0)).toFixed(0),
    'firstDanger', avg('firstDanger'), 'firstWarn', avg('firstWarn'));
  // the time course in buckets of 10 shots: cakes in the pond, fill of the pool, merges on offer, danger
  const B = 10, buckets = [];
  for (const r of results) for (const c of r.course) {
    const k = Math.floor((c.shot - 1) / B);
    const b = buckets[k] || (buckets[k] = { n: 0, bodies: 0, fill: 0, edge: 0, offer: 0, direct: 0, merged: 0, danger: 0, games: new Set() });
    b.n++; b.bodies += c.n; b.fill += c.fill; b.edge += c.edge; b.offer += c.offer; b.direct += c.direct || 0; b.merged += c.merged; b.danger += c.danger > 1.5 ? 1 : 0; b.games.add(r);
  }
  console.log('shots   games  cakes  fill%  edge%  offer%  heart%  merge%  warn%');
  buckets.forEach((b, k) => console.log(String(k * B + 1).padStart(3) + '-' + String(k * B + B).padEnd(5), String(b.games.size).padStart(3), String((b.bodies / b.n).toFixed(1)).padStart(7), String((100 * b.fill / b.n).toFixed(0)).padStart(6), String((b.edge / b.n).toFixed(0)).padStart(6), String((100 * b.offer / b.n).toFixed(0)).padStart(7), String((100 * b.direct / b.n).toFixed(0)).padStart(7), String((100 * b.merged / b.n).toFixed(0)).padStart(7), String((100 * b.danger / b.n).toFixed(0)).padStart(7)));
  await browser.close();
})();
