/* Fairycake Falls – start-layout check for every level of the adventure.
   Does the layout succeed (tries; 80 = it fell back to the five-cake cross), does it hold still (no self-merges in
   4 s of nothing), how far does it reach (edge of the cluster over the ring) and how full is the pool?
   usage: node tools/check-levels.js            (needs Playwright: npm i -D playwright) */
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const root = path.resolve(__dirname, '..');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('file://' + root + '/index.html');
  await p.waitForFunction(() => window.FC && FC.Game && FC.Game.state === 'title', null, { timeout: 20000 });
  const res = await p.evaluate(() => {
    const G = FC.Game, W = G.world;
    for (const k of Object.keys(FC.Audio)) if (typeof FC.Audio[k] === 'function' && k !== 'init') FC.Audio[k] = () => {};
    FC.store.set('coach', 3);
    G.render = () => {};
    const out = [];
    for (let w = 0; w < 5; w++) for (let l = 0; l < 8; l++) {
      let tries = 0, fallback = 0, selfm = 0, edge = 0, fill = 0, n = 0;
      const R = 8;
      for (let g = 0; g < R; g++) {
        G.startLevel(w, l);
        tries += G.startStats.tries; if (G.startStats.tries >= 80) fallback++;
        const m0 = G.merges;
        let e = 0; for (const bb of W.bodies) if (!bb.dead && !bb.sensor) e = Math.max(e, Math.hypot(bb.x, bb.y) + bb.r);
        edge += e / G.ring; fill += G.poolFill(); n += W.count((bb) => !bb.sensor);
        for (let i = 0; i < 240; i++) G.update(1 / 60);
        selfm += G.merges - m0;
      }
      out.push({ lv: w + '.' + l, tries: +(tries / R).toFixed(1), fallback, selfMerges: selfm, edge: +(edge / R).toFixed(2), fill: +(fill / R).toFixed(2), cakes: n / R, ring: Math.round(G.ring) });
    }
    return out;
  });
  for (const r of res) console.log(JSON.stringify(r));
  await b.close();
})();
