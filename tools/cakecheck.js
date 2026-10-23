/* Fairycake Falls – cake distinctness check.
   Renders every cake of the collection at the size it has on a phone and measures how far apart the cakes
   that can meet in one pond are: their colour (CIEDE2000 between the mean colours and between the dominant
   colours) and their silhouette (overlap of the outlines drawn at the same footprint size). A pair is risky
   when the outlines are alike AND the colours are close – that is what a player mistakes for one cake.

   Groups: every world's menu (11 cakes) + the rare finds + the Magic Cake (they can all meet in one level),
   and, for the Cake Book, the cakes of one tier across the five worlds (near-copies in the grid).

   usage: node tools/cakecheck.js [--all]      (--all prints every pair, not only the closest ones)
   exit code 1 when something is flagged */
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const path = require('path');

const PAGE_CODE = () => {
  const C = FC.Cakes;
  // ---------- colour maths ----------
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  function lab(r, g, b) {
    const R = lin(r), G = lin(g), B = lin(b);
    let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + G * 0.7152 + B * 0.0722, z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    x = f(x); y = f(y); z = f(z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }
  function de00(a, b) {
    const [L1, a1, b1] = a, [L2, a2, b2] = b;
    const rad = Math.PI / 180, deg = 180 / Math.PI;
    const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2;
    const G = 0.5 * (1 - Math.sqrt(Math.pow(Cm, 7) / (Math.pow(Cm, 7) + Math.pow(25, 7))));
    const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
    const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
    let h1p = Math.atan2(b1, a1p) * deg; if (h1p < 0) h1p += 360;
    let h2p = Math.atan2(b2, a2p) * deg; if (h2p < 0) h2p += 360;
    const dLp = L2 - L1, dCp = C2p - C1p;
    let dhp = h2p - h1p;
    if (C1p * C2p === 0) dhp = 0; else if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360;
    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2);
    const Lmp = (L1 + L2) / 2, Cmp = (C1p + C2p) / 2;
    let hmp = h1p + h2p;
    if (C1p * C2p !== 0) { if (Math.abs(h1p - h2p) > 180) hmp += h1p + h2p < 360 ? 360 : -360; hmp /= 2; }
    const T = 1 - 0.17 * Math.cos((hmp - 30) * rad) + 0.24 * Math.cos(2 * hmp * rad) + 0.32 * Math.cos((3 * hmp + 6) * rad) - 0.2 * Math.cos((4 * hmp - 63) * rad);
    const dTh = 30 * Math.exp(-Math.pow((hmp - 275) / 25, 2));
    const Rc = 2 * Math.sqrt(Math.pow(Cmp, 7) / (Math.pow(Cmp, 7) + Math.pow(25, 7)));
    const Sl = 1 + (0.015 * Math.pow(Lmp - 50, 2)) / Math.sqrt(20 + Math.pow(Lmp - 50, 2));
    const Sc = 1 + 0.045 * Cmp, Sh = 1 + 0.015 * Cmp * T;
    const Rt = -Math.sin(2 * dTh * rad) * Rc;
    return Math.sqrt(Math.pow(dLp / Sl, 2) + Math.pow(dCp / Sc, 2) + Math.pow(dHp / Sh, 2) + Rt * (dCp / Sc) * (dHp / Sh));
  }
  // ---------- rendering ----------
  const BOX = 260; // every sprite is drawn into the same box, its footprint centre at the same point
  function render(kind, rpx) {
    const sp = C.renderSprite(kind, rpx);
    const cv = document.createElement('canvas');
    cv.width = BOX; cv.height = BOX;
    const x = cv.getContext('2d');
    x.drawImage(sp.canvas, BOX / 2 - sp.cx, BOX * 0.62 - sp.cy);
    return x.getImageData(0, 0, BOX, BOX).data;
  }
  function stats(kind) {
    const px = render(kind, 60); // the same footprint size for everybody: silhouettes are compared by shape
    const mask = new Uint8Array(BOX * BOX);
    const cols = [];
    let sum = [0, 0, 0], n = 0;
    for (let i = 0; i < BOX * BOX; i++) {
      const a = px[i * 4 + 3];
      if (a < 128) continue;
      mask[i] = 1;
      const L = lab(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
      sum[0] += L[0]; sum[1] += L[1]; sum[2] += L[2]; n++;
      if (i % 3 === 0) cols.push(L);
    }
    const mean = sum.map((v) => v / Math.max(1, n));
    // main colours: k-means (k = 6, seeded with k-means++ on a fixed rng so runs are repeatable) in Lab
    const rnd = FC.rng(1234);
    let cent = [cols[Math.floor(rnd() * cols.length)].slice()];
    while (cent.length < 6) {
      const d2 = cols.map((c) => Math.min(...cent.map((q) => Math.pow(c[0] - q[0], 2) + Math.pow(c[1] - q[1], 2) + Math.pow(c[2] - q[2], 2))));
      const tot = d2.reduce((a, b) => a + b, 0);
      let r = rnd() * tot, i = 0;
      while (i < d2.length - 1 && (r -= d2[i]) > 0) i++;
      cent.push(cols[i].slice());
    }
    let assign = new Int32Array(cols.length);
    for (let it = 0; it < 12; it++) {
      const acc = cent.map(() => [0, 0, 0, 0]);
      for (let i = 0; i < cols.length; i++) {
        let best = 0, bd = 1e9;
        for (let k = 0; k < cent.length; k++) { const d = Math.pow(cols[i][0] - cent[k][0], 2) + Math.pow(cols[i][1] - cent[k][1], 2) + Math.pow(cols[i][2] - cent[k][2], 2); if (d < bd) { bd = d; best = k; } }
        assign[i] = best;
        acc[best][0] += cols[i][0]; acc[best][1] += cols[i][1]; acc[best][2] += cols[i][2]; acc[best][3]++;
      }
      cent = acc.map((a, k) => (a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : cent[k]));
    }
    const counts = cent.map(() => 0);
    for (let i = 0; i < cols.length; i++) counts[assign[i]]++;
    const order = counts.map((c, k) => k).sort((p, q) => counts[q] - counts[p]);
    const dom = cent[order[0]], dom2 = cent[order[1]];
    const share = counts[order[0]] / cols.length;
    // the palette: the main colours by area – the coloured ones count more than cream and white, which nearly
    // every cake has (sponge, rosettes, highlights) and which say little about which cake it is
    const sig = order.map((k) => {
      const c = cent[k], chroma = Math.hypot(c[1], c[2]);
      return { c, w: (counts[k] / cols.length) * (0.6 + 0.4 * Math.min(1, chroma / 30)) };
    }).filter((q) => q.w > 0.02);
    // the same cake at its real size relative to the others (footprint centres aligned): size + shape
    const pxs = render(kind, C.TIERS[C.tierOf(kind)].r * 0.36);
    const smask = new Uint8Array(BOX * BOX);
    for (let i = 0; i < BOX * BOX; i++) if (pxs[i * 4 + 3] >= 128) smask[i] = 1;
    return { kind, tier: C.tierOf(kind), name: C.spec(kind).name, world: C.spec(kind).world, mask, prof: profile(mask), smask, area: n, mean, dom, dom2, share, sig };
  }
  function iou(a, b) {
    let i = 0, u = 0;
    for (let k = 0; k < a.length; k++) { if (a[k] || b[k]) { u++; if (a[k] && b[k]) i++; } }
    return u ? i / u : 0;
  }
  // the outline as a width per row (left and right edge), so a dome, a drum, a cube and a cone tell apart
  // even though they cover about the same area
  function profile(m) {
    const rows = [];
    for (let y = 0; y < BOX; y++) {
      let l = -1, r = -1;
      for (let x = 0; x < BOX; x++) if (m[y * BOX + x]) { if (l < 0) l = x; r = x; }
      rows.push(l < 0 ? null : [l, r]);
    }
    return rows;
  }
  function outlineSim(a, b) {
    let diff = 0, tot = 0;
    for (let y = 0; y < BOX; y++) {
      const p = a[y], q = b[y];
      if (!p && !q) continue;
      if (!p || !q) { const w = (p || q)[1] - (p || q)[0] + 1; diff += w; tot += w; continue; }
      diff += Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]);
      tot += Math.max(p[1], q[1]) - Math.min(p[0], q[0]) + 1;
    }
    return tot ? 1 - diff / tot : 1;
  }
  const all = {};
  for (const id of C.KIND_LIST.map((k) => k.id)) all[id] = stats(id);
  // sanity: a sprite must not be cut off by its canvas (EXTENT too small for what the painter draws)
  const clipped = [];
  for (const id of C.KIND_LIST.map((k) => k.id)) {
    const sp = C.renderSprite(id, 60);
    const cv = sp.canvas, x = cv.getContext('2d'), w = cv.width, h = cv.height;
    const d = x.getImageData(0, 0, w, h).data;
    const edge = (i) => d[i * 4 + 3] > 40;
    let hit = '';
    for (let xx = 0; xx < w && !hit; xx++) if (edge(xx)) hit = 'top';
    for (let yy = 0; yy < h && !hit; yy++) if (edge(yy * w) || edge(yy * w + w - 1)) hit = 'side';
    if (hit) clipped.push(C.spec(id).name + ' (' + hit + ')');
  }
  // colour distance between two cakes: the mean colour, and the dominant colours (either order)
  function pair(a, b) {
    const A = all[a], B = all[b];
    const dMean = de00(A.mean, B.mean);
    // palette distance: how well each cake's main colours (k-means, weighted by area) are matched by the other's
    const cover = (P, Q) => P.sig.reduce((acc, p) => acc + p.w * Math.min(...Q.sig.map((q) => de00(p.c, q.c))), 0) / P.sig.reduce((a2, p) => a2 + p.w, 0);
    const dDom = (cover(A, B) + cover(B, A)) / 2;
    const shape = outlineSim(A.prof, B.prof);
    const sized = iou(A.smask, B.smask);
    return { a, b, ta: A.tier, tb: B.tier, na: A.name, nb: B.name, dMean, dDom, shape, sized };
  }
  const groups = [];
  for (let w = 0; w < C.WORLD_COUNT; w++) groups.push({ name: 'World ' + (w + 1), ids: C.WORLD_MENUS[w].slice(1).concat(C.RARES, ['magic']) });
  const out = { groups: [], tiers: [], colours: {}, clipped };
  for (const g of groups) {
    const pairs = [];
    for (let i = 0; i < g.ids.length; i++) for (let j = i + 1; j < g.ids.length; j++) {
      const A = all[g.ids[i]], B = all[g.ids[j]];
      if (A.world === 'rare' && B.world === 'rare') continue; // the rares are checked once, in the tier groups
      pairs.push(pair(g.ids[i], g.ids[j]));
    }
    out.groups.push({ name: g.name, pairs });
  }
  for (let t = 0; t <= C.MAX_TIER; t++) {
    const ids = C.KIND_LIST.filter((k) => k.tier === t).map((k) => k.id);
    const pairs = [];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pairs.push(pair(ids[i], ids[j]));
    out.tiers.push({ tier: t, pairs });
  }
  for (const id in all) {
    const toHex = (L) => { // Lab -> sRGB hex (for the report)
      let y = (L[0] + 16) / 116, x = L[1] / 500 + y, z = y - L[2] / 200;
      const f = (t) => (t * t * t > 0.008856 ? t * t * t : (t - 16 / 116) / 7.787);
      x = f(x) * 0.95047; y = f(y); z = f(z) * 1.08883;
      const g = (c) => { c = c > 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c; return Math.max(0, Math.min(255, Math.round(c * 255))); };
      const r = g(x * 3.2406 + y * -1.5372 + z * -0.4986), gg = g(x * -0.9689 + y * 1.8758 + z * 0.0415), b = g(x * 0.0557 + y * -0.204 + z * 1.057);
      return '#' + [r, gg, b].map((v) => v.toString(16).padStart(2, '0')).join('');
    };
    out.colours[id] = { name: all[id].name, tier: all[id].tier, mean: toHex(all[id].mean), dom: toHex(all[id].dom), share: Math.round(all[id].share * 100) };
  }
  return out;
};

(async () => {
  const showAll = process.argv.includes('--all');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, 'cakesheet.html'));
  await page.waitForFunction(() => window.FC && FC.Cakes);
  const res = await page.evaluate(PAGE_CODE);
  await browser.close();
  // A pair a player can mix up: alike outlines and close colours. Two cakes of different tiers in one world are
  // the dangerous case (they do not merge); cakes of one tier in different worlds only meet in the Cake Book.
  // shape = how alike the outlines are at the same footprint size (1 = the same silhouette), sized = overlap at
  // their real sizes (a Macaron next to a royal cake is told apart by size alone); col = the closer of the two
  // colour distances (the mean colour, and the palette of main colours)
  let risk = (p) => {
    // the mean colour alone misjudges cakes of many colours (a rainbow swirl averages to beige), the palette alone
    // misjudges a big cake with a small topper: both have to be close
    const col = (p.dMean + p.dDom) / 2;
    if (p.ta !== p.tb) {
      let r = '';
      if (p.shape >= 0.9 && col < 14) r = 'FLAG';      // the same silhouette and close colours
      else if (p.shape >= 0.8 && col < 10) r = 'FLAG'; // similar silhouettes and very close colours
      else if (p.shape >= 0.8 && col < 14) r = 'warn';
      else if (col < 6) r = 'warn';                    // nearly the same colours, even with different outlines
      if (p.sized < 0.3 && r === 'FLAG') r = 'warn';    // ... but sizes this far apart tell them apart
      return r;
    }
    // cakes of one tier share their silhouette by design: in the book only their colours tell them apart
    if (col < 9) return 'FLAG';
    if (col < 12) return 'warn';
    return '';
  };
  // how easily two cakes are mixed up (for sorting): alike outlines and close colours
  const confusion = (p) => Math.max(0, Math.min(1, (p.shape - 0.6) / 0.4)) * Math.exp(-((p.dMean + p.dDom) / 2) / 12) * (0.4 + 0.6 * Math.min(1, p.sized / 0.5));
  // pairs a person has looked at and found clearly different although the numbers are close (the measure only
  // sees colours and outlines, not stripes, wrappers or a square against a round cake)
  const REVIEWED = {
    'w1t2|rare_gold': 'a square petit four in bee stripes against a round macaron that glows and sparkles in the pond',
    'w3t3|rare_ghost': 'a pink-and-blue swirl in a pink case against a white swirl in a deep violet case',
  };
  const reviewed = (p) => REVIEWED[p.a + '|' + p.b] || REVIEWED[p.b + '|' + p.a];
  const risk0 = risk;
  risk = (p) => { const r = risk0(p); return r === 'FLAG' && reviewed(p) ? 'ok*' : r; };
  const f1 = (v) => v.toFixed(1).padStart(5);
  const line = (p) => `${risk(p).padEnd(4)}  t${String(p.ta).padStart(2)} ${p.na.padEnd(26)} t${String(p.tb).padStart(2)} ${p.nb.padEnd(26)} shape ${p.shape.toFixed(2)} sized ${p.sized.toFixed(2)}  dE(mean) ${f1(p.dMean)}  dE(palette) ${f1(p.dDom)}`;
  let flags = 0, warns = 0;
  for (const g of res.groups) {
    const list = g.pairs.filter((p) => p.ta !== p.tb).sort((a, b) => confusion(b) - confusion(a));
    const shown = showAll ? list : list.filter((p, i) => risk(p) || i < 6).slice(0, 16);
    console.log(`\n== ${g.name}: the closest pairs of different tiers (world menu + rares + Magic Cake)`);
    for (const p of shown) { console.log(line(p)); if (risk(p) === 'FLAG') flags++; else if (risk(p) === 'warn') warns++; }
    if (!shown.length) console.log('   (nothing close)');
  }
  console.log('\n== The Cake Book: cakes of one tier across the worlds (near-copies in the grid)');
  for (const t of res.tiers) {
    for (const p of t.pairs.sort((a, b) => Math.min(a.dMean, a.dDom) - Math.min(b.dMean, b.dDom))) {
      const r = risk(p);
      if (r || showAll) console.log(line(p));
      if (r === 'FLAG') flags++; else if (r === 'warn') warns++;
    }
  }
  if (showAll) {
    console.log('\n== mean / dominant colour (share of the dominant colour)');
    for (const id in res.colours) { const c = res.colours[id]; console.log(`t${String(c.tier).padStart(2)} ${c.name.padEnd(26)} mean ${c.mean}  dom ${c.dom} (${c.share}%)`); }
  }
  const seen = new Set();
  for (const g of res.groups.concat(res.tiers)) for (const p of g.pairs) if (risk(p) === 'ok*' && !seen.has(p.a + p.b)) { seen.add(p.a + p.b); console.log(`ok*   ${p.na} / ${p.nb}: reviewed – ${reviewed(p)}`); }
  if (res.clipped.length) { console.log('\nCLIPPED sprites (EXTENT too small): ' + res.clipped.join(', ')); flags += res.clipped.length; }
  console.log(`\n${flags} flagged, ${warns} warnings`);
  process.exit(flags ? 1 : 0);
})();
