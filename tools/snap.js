/* Fairycake Falls – visual replay harness.
   Plays a game with the bot's search (rendering ON) and saves screenshots at chosen shot
   counts, plus a short frame sequence around one flick, so the look of a full pond can be
   checked without a human player.

   usage: node tools/snap.js <outDir> [shots...]     e.g. node tools/snap.js /tmp/snaps 1 10 30 60 90 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BOT = fs.readFileSync(path.join(__dirname, 'bot.js'), 'utf8').match(/const BOT = `([\s\S]*?)`;/)[1];

(async () => {
  const out = process.argv[2] || '/tmp/snaps';
  const marks = process.argv.slice(3).map(Number);
  const maxShots = marks.length ? Math.max(...marks) : 60;
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForFunction(() => window.FC && FC.Game && FC.Game.state === 'title', null, { timeout: 15000 });
  await page.evaluate(BOT);
  // rendering back on, but the loop stays ours
  await page.evaluate(() => {
    const G = FC.Game;
    G.render = G._render;
    FC.UI.showTitle();
    G.newGame();
    document.getElementById('title').classList.add('hidden');
    window.BOTstep = (sec) => { const n = Math.round(sec / (1 / 60)); for (let i = 0; i < n; i++) G.update(1 / 60); G.render(); };
    window.BOTshot = () => {
      const W = G.world, T = FC.Cakes.TIERS;
      let tier = G.queue[0];
      let best = window.BOT.search(tier);
      if (G.queue.length > 1 && G.queue[1] !== tier) { const alt = window.BOT.search(G.queue[1]); if (alt.score > best.score + 0.5) { G.swap(); tier = G.queue[0]; best = alt; } }
      if (G.danger > 1.5 && G.wands > 0 && G.dangerBody) { G.wandMode = true; const p = FC.Scene.w2s(G.dangerBody.x, G.dangerBody.y); G.wandTap(p.x, p.y - G.dangerBody.r * FC.Scene.s * 0.45); }
      FCdebug.fire(best.deg + (Math.random() - 0.5) * 3, Math.max(0.05, Math.min(1, best.p + (Math.random() - 0.5) * 0.04)));
      return { tier, deg: best.deg, p: best.p, score: best.score, hit: best.hit };
    };
  });
  await page.evaluate(() => window.BOTstep(1.2));
  let shots = 0;
  while (shots < maxShots) {
    const st = await page.evaluate(() => FCdebug.state());
    if (st.state !== 'playing') { console.log('game over at shot', shots, JSON.stringify(st)); break; }
    await page.evaluate(() => { let t = 0; while (t < 5 && (!window.BOTsettled() || FC.Game.whirl || FC.Game.stageDone)) { window.BOTstep(1 / 6); t += 1 / 6; } });
    const info = await page.evaluate(() => window.BOTshot());
    shots++;
    if (marks.includes(shots)) {
      // a few frames of this flick
      for (let f = 0; f < 6; f++) {
        await page.evaluate(() => window.BOTstep(0.25));
        await page.screenshot({ path: path.join(out, `shot${String(shots).padStart(3, '0')}_f${f}.png`) });
      }
      const st2 = await page.evaluate(() => FCdebug.state());
      console.log('shot', shots, JSON.stringify(info), JSON.stringify(st2));
    } else {
      await page.evaluate(() => window.BOTstep(0.3));
    }
  }
  await page.evaluate(() => { let t = 0; while (t < 5 && (!window.BOTsettled() || FC.Game.whirl)) { window.BOTstep(1 / 6); t += 1 / 6; } });
  await page.screenshot({ path: path.join(out, `final.png`) });
  console.log('final', JSON.stringify(await page.evaluate(() => FCdebug.state())));
  await browser.close();
})();
