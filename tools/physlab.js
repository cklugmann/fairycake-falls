/* Fairycake Falls – physics lab (Node, no browser).
   Loads core.js + physics.js + cakes.js with a tiny window shim and runs quick experiments on the
   cluster physics: how far a flick moves things, whether resting twins find each other, how many cakes a
   full pool holds. usage: node tools/physlab.js [experiment] */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const win = { devicePixelRatio: 1, localStorage: { getItem: () => null, setItem: () => {} } };
win.window = win;
const ctx = vm.createContext(win);
for (const f of ['core.js', 'physics.js', 'cakes.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
const FC = win.FC;
const { CFG, Body, World, speedForPower } = FC.Physics;
const TIERS = FC.Cakes.TIERS;

// a packed cluster of n cakes (given tiers), settled by the water
function cluster(tiers, ring) {
  const W = new World();
  W.rCalm = ring || 560;
  const pos = [[0, 0]];
  for (let k = 0; pos.length < tiers.length; k++) {
    const ringN = Math.floor(k / 6) + 1, a = (k % 6) / 6 * Math.PI * 2 + ringN * 0.5;
    pos.push([Math.cos(a) * 215 * ringN, Math.sin(a) * 215 * ringN]);
  }
  // no twins next to each other (greedy colouring on the initial spots, like the game's start layout)
  const near = pos.map((p) => pos.map((q, j) => (Math.hypot(p[0] - q[0], p[1] - q[1]) < 330 ? j : -1)).filter((j) => j >= 0));
  const pool = tiers.slice(), t = new Array(pos.length).fill(0);
  for (let i = 0; i < pos.length; i++) { const used = near[i].map((j) => t[j]); let k = pool.findIndex((x) => used.indexOf(x) < 0); if (k < 0) k = 0; t[i] = pool.splice(k, 1)[0]; }
  W.canMerge = () => false;
  W.omegaCore = 0; // measure in the frame of the pool
  t.forEach((tt, i) => { const b = new Body(tt, TIERS[tt].r, pos[i][0], pos[i][1]); b.age = 3; W.add(b); });
  for (let i = 0; i < 900; i++) W.step(1 / 60);
  delete W.canMerge;
  for (const b of W.bodies) { b.vx = 0; b.vy = 0; }
  return W;
}
const edge = (W) => Math.max(...W.bodies.filter((b) => !b.dead).map((b) => Math.hypot(b.x, b.y) + b.r));
const fill = (W) => W.bodies.filter((b) => !b.dead).reduce((s, b) => s + b.r * b.r, 0) / (W.rCalm * W.rCalm);

const exp = process.argv[2] || 'all';

if (exp === 'all' || exp === 'capacity') {
  // how many cakes fit inside the ring before the edge passes it?
  for (const ring of [560, 640, 720, 800, 880]) {
    const mix = [];
    const sizes = [1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 6];
    let n = 0, last = null;
    for (let i = 0; i < 40; i++) {
      mix.push(sizes[i % sizes.length]);
      const W = cluster(mix, ring);
      if (edge(W) > ring) break;
      n = mix.length; last = W;
    }
    console.log('ring', ring, '-> holds', n, 'cakes (tiers 1-6 mix), fill', last ? (100 * fill(last)).toFixed(0) + '%' : '-');
  }
}

if (exp === 'all' || exp === 'twins') {
  // two resting twins with a gap: do they find each other?
  for (const gap of [10, 20, 30, 40, 60]) {
    const W = new World();
    const r = TIERS[2].r;
    const a = new Body(2, r, -r - gap / 2, 0), b = new Body(2, r, r + gap / 2, 0);
    a.age = b.age = 3;
    W.add(a); W.add(b);
    let merged = -1;
    W.onMerge = () => { merged = W.time; };
    W.omegaCore = 0.15;
    for (let i = 0; i < 300 && merged < 0; i++) W.step(1 / 60);
    console.log('twins gap', gap, '(range', (CFG.TWIN_RANGE * r).toFixed(0) + ')', merged >= 0 ? 'merge after ' + merged.toFixed(2) + ' s' : 'no merge in 5 s');
  }
}

if (exp === 'all' || exp === 'flick') {
  // a Macaron flicked straight at a packed 20-cake cluster: how far do things move, does anything leave the ring?
  const tiers = [3, 2, 1, 2, 3, 1, 4, 2, 3, 4, 1, 5, 1, 2, 3, 6, 1, 2, 4, 3];
  for (const p of [0.3, 0.5, 0.7, 0.9]) {
    const W = cluster(tiers, 720);
    W.canMerge = () => false; // the push alone (twins in this lab cluster may touch)
    const before = new Map(W.bodies.map((b) => [b.id, [b.x, b.y]]));
    const e0 = edge(W);
    const s = new Body(1, TIERS[1].r, 0, CFG.R - TIERS[1].r - 4);
    const sp = speedForPower(p);
    s.vx = 0; s.vy = -sp; s.launched = true;
    W.add(s);
    let merges = 0;
    W.onMerge = (a, b) => { merges++; W.mergeBodies(a, b, a.tier + 1, TIERS[a.tier + 1].r, true); };
    for (let i = 0; i < 240; i++) W.step(1 / 60);
    let moved = 0, n = 0, out = 0;
    for (const b of W.bodies) {
      if (b.dead || b === s) continue;
      const o = before.get(b.id);
      if (!o) continue;
      const d = Math.hypot(b.x - o[0], b.y - o[1]);
      moved += d; n++;
      if (Math.hypot(b.x, b.y) + b.r > W.rCalm) out++;
    }
    console.log('flick p=' + p, 'speed', sp.toFixed(0), 'edge before', e0.toFixed(0), 'after', edge(W).toFixed(0), 'mean move', (moved / n).toFixed(0), 'beyond ring', out, 'merges', merges, 'shot rests at', Math.hypot(s.x, s.y).toFixed(0));
  }
}

if (exp === 'trace') {
  // follow a full-power flick into a packed cluster: speed of the shot and of the cakes it hits, frame by frame
  const tiers = [3, 2, 1, 2, 3, 1, 4, 2, 3, 4, 1, 5, 1, 2, 3, 6, 1, 2, 4, 3];
  const W = cluster(tiers, 720);
  W.canMerge = () => false;
  const before = new Map(W.bodies.map((b) => [b.id, [b.x, b.y]]));
  const s = new Body(1, TIERS[1].r, 0, CFG.R - TIERS[1].r - 4);
  const p = +(process.argv[3] || 0.9), sp = speedForPower(p);
  s.vx = 0; s.vy = -sp; s.launched = true;
  W.add(s);
  const hits = [];
  W.onImpact = (a, b, st) => { if (hits.length < 12) hits.push([W.time.toFixed(2), a === s ? 'shot' : a.tier, b === s ? 'shot' : b.tier, st.toFixed(0)]); };
  for (let i = 0; i < 90; i++) {
    W.step(1 / 60);
    if (i % 6 === 0) {
      const top = W.bodies.filter((b) => b !== s).map((b) => b.speed()).sort((a, b) => b - a).slice(0, 3).map((v) => v.toFixed(0));
      console.log('t', (i / 60).toFixed(2), 'shot y', s.y.toFixed(0), 'v', s.speed().toFixed(0), 'fastest others', top.join(' '));
    }
  }
  console.log('impacts', JSON.stringify(hits));
  const moved = W.bodies.filter((b) => b !== s).map((b) => { const o = before.get(b.id); return o ? Math.hypot(b.x - o[0], b.y - o[1]) : 0; }).sort((a, b) => b - a);
  console.log('displacements (sorted):', moved.map((d) => d.toFixed(0)).join(' '));
}

if (exp === 'rest') {
  // a packed cluster at rest: does it stay quiet? impacts per second (the game plays a bump sound above 140)
  const tiers = [3, 2, 1, 2, 3, 1, 4, 2, 3, 4, 1, 5, 1, 2, 3, 6, 1, 2, 4, 3];
  for (const n of [11, 20]) {
    const W = cluster(tiers.slice(0, n), n > 11 ? 720 : 560);
    W.canMerge = () => false;
    W.omegaCore = +(process.argv[3] || 0.15);
    let bumps = 0, loud = 0, maxV = 0;
    W.onImpact = (a, b, st) => { bumps++; if (st > 140) loud++; };
    for (let i = 0; i < 600; i++) { W.step(1 / 60); for (const b of W.bodies) maxV = Math.max(maxV, Math.hypot(b.vx - (-b.y * W.omegaCore), b.vy - (b.x * W.omegaCore))); }
    console.log('cluster of', n, 'at rest for 10 s: impacts', bumps, 'loud (>140)', loud, 'max speed rel. to pool', maxV.toFixed(0));
  }
}

if (exp === 'late') {
  // a late-game mix: how far does the cluster reach, compared with the ring the biggest cake earns?
  const ringFor = (maxTier) => Math.min(CFG.DANGER, CFG.RING_MIN + CFG.RING_STEP * Math.max(0, maxTier - 3));
  const mixes = {
    'stage 7 (max 9)': [9, 8, 7, 6, 5, 4, 3, 3, 2, 1],
    'stage 7 + 5 small': [9, 8, 7, 6, 5, 4, 3, 3, 2, 1, 1, 2, 3, 1, 2],
    'stage 10 (max 10)': [10, 9, 8, 7, 6, 5, 4, 3, 3, 2, 1, 2],
    'stage 12 (max 11)': [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 2, 3],
    'two royals': [11, 11, 9, 7, 5, 4, 3, 2, 1, 2, 3],
  };
  for (const [name, tiers] of Object.entries(mixes)) {
    const ring = ringFor(Math.max(...tiers));
    let worst = 0, sum = 0, f = 0;
    for (let k = 0; k < 6; k++) { const W = cluster(tiers.slice().sort(() => Math.random() - 0.5), ring); const e = edge(W); worst = Math.max(worst, e); sum += e; f = fill(W); }
    console.log(name.padEnd(20), 'ring', ring, 'edge mean', (sum / 6).toFixed(0), 'worst', worst.toFixed(0), '(' + (100 * worst / ring).toFixed(0) + '% of the ring) fill', (100 * f).toFixed(0) + '%');
  }
}
