/* quick check of the start layout: does it hold still (no self-merges), how big is it, screenshot */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || '/tmp/start.png';
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || (require('fs').existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForFunction(() => window.FC && FC.Game && FC.Game.state === 'title', null, { timeout: 15000 });
  const res = await page.evaluate(() => {
    const G = FC.Game, W = G.world;
    for (const k of Object.keys(FC.Audio)) if (typeof FC.Audio[k] === 'function' && k !== 'init') FC.Audio[k] = () => {};
    const stats = [];
    G._render = G._render || G.render;
    for (let g = 0; g < 30; g++) {
      FC.store.set('coach', g % 2 ? 3 : 0);
      G.render = () => {};
      G.newGame();
      const n0 = W.count((b) => !b.sensor), m0 = G.merges;
      let maxEdge = 0;
      for (const b of W.bodies) if (!b.dead) maxEdge = Math.max(maxEdge, Math.hypot(b.x, b.y) + b.r);
      for (let i = 0; i < 240; i++) G.update(1 / 60); // 4 s of nothing
      stats.push({ tut: g % 2 === 0, n0, n4: W.count((b) => !b.sensor), merges: G.merges - m0, edge: Math.round(maxEdge), ring: G.ring, q: G.queue.slice() });
    }
    FC.store.set('coach', 3);
    G.render = G._render;
    G.newGame();
    for (let i = 0; i < 90; i++) G.update(1 / 60);
    document.getElementById('title').classList.add('hidden');
    document.getElementById('combo').classList.remove('show');
    G.render();
    return stats;
  });
  console.log(res.map((r) => JSON.stringify(r)).join('\n'));
  const bad = res.filter((r) => r.merges > 0 || r.n0 < 9);
  console.log('self-merging or small starts:', bad.length, 'of', res.length);
  await page.screenshot({ path: out });
  await browser.close();
})();
