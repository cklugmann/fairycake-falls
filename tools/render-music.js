/* Fairycake Falls – render the music offline to a WAV file (to listen to it outside the game, or to
   check levels). Uses the game's own audio code in headless Chromium.
   usage: node tools/render-music.js out.wav [seconds]   (env PW_CHROME = path to a Chromium binary) */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const out = process.argv[2] || 'lullaby.wav';
  const seconds = +(process.argv[3] || 75);
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForFunction(() => window.FC && FC.Audio, null, { timeout: 15000 });
  const b64 = await page.evaluate(async (sec) => {
    const buf = await FC.Audio.renderMusic(sec);
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
  }, seconds);
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
  console.log('wrote', out, seconds + ' s');
  await browser.close();
})();
