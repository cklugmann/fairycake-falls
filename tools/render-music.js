/* Fairycake Falls – render the music offline to a WAV file (to listen to it outside the game, or to
   check levels). Uses the game's own audio code in headless Chromium.
   usage: node tools/render-music.js out.wav [seconds] [--sfx]   (env PW_CHROME = path to a Chromium binary)
   --sfx plays a scripted minute of game sounds on top (pulls, flicks, merges, fanfares) to hear them against the tune */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const out = process.argv[2] || 'lullaby.wav';
  const seconds = +(process.argv[3] || 75);
  const withSfx = process.argv.includes('--sfx'); // a scripted game on top: flicks, merges, a discovery, an order, a whirl
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForFunction(() => window.FC && FC.Audio, null, { timeout: 15000 });
  const b64 = await page.evaluate(async ([sec, sfx]) => {
    const ev = [];
    if (sfx) {
      // a plausible minute of play, repeating: pull (ticks), launch, a plip, merges with growing combos, the occasional bump
      for (let t = 1; t < sec - 4; t += 4.2) {
        const k = Math.floor(t / 4.2);
        ev.push([t, 'grab'], [t + 0.3, 'tick', 0.25], [t + 0.5, 'tick', 0.5], [t + 0.7, 'tick', 0.75], [t + 0.9, 'launch', 0.7]);
        ev.push([t + 1.6, 'bump', 900, 3], [t + 1.8, 'plip', 2]);
        if (k % 3 !== 2) ev.push([t + 2.0, 'merge', 2 + (k % 5), 1]);
        if (k % 3 === 0) ev.push([t + 2.3, 'merge', 3 + (k % 4), 2], [t + 2.5, 'streak', 2 + (k % 4)]);
        if (k % 5 === 4) ev.push([t + 2.6, 'merge', 6, 3], [t + 2.9, 'discover']);
        if (k % 7 === 6) ev.push([t + 3.0, 'orderDone'], [t + 3.6, 'whirl']);
        if (k % 6 === 5) ev.push([t + 3.2, 'danger'], [t + 4.1, 'danger']);
        if (k % 8 === 7) ev.push([t + 3.0, 'swap'], [t + 3.3, 'magic']);
      }
    }
    const buf = await FC.Audio.renderMusic(sec, ev);
    const n = buf.length, ch = buf.numberOfChannels, rate = buf.sampleRate;
    const bytes = 44 + n * ch * 2;
    const ab = new ArrayBuffer(bytes), v = new DataView(ab);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, bytes - 8, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, rate, true);
    v.setUint32(28, rate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, n * ch * 2, true);
    const data = [];
    for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
    let o = 44, peak = 0;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      peak = Math.max(peak, Math.abs(s));
      v.setInt16(o, s < 0 ? s * 32768 : s * 32767, true);
      o += 2;
    }
    const u8 = new Uint8Array(ab);
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    console.log('peak', peak.toFixed(3));
    return btoa(s);
  }, [seconds, withSfx]);
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
  console.log('wrote', out, seconds + ' s');
  await browser.close();
})();
