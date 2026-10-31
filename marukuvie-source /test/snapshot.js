// リファクタの前後比べ：時間と乱数を止めて、物語の全場面・謎解き4つ・戦闘2つの絵を撮り、ハッシュで比べる
// 使い方：node test/snapshot.js <出力フォルダ>
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const crypto = require('crypto');
const OUT = path.resolve(process.argv[2]); fs.mkdirSync(OUT, { recursive: true });
const FREEZE = () => {
  let seed = 12345; Math.random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  window.__T = 100000; performance.now = () => window.__T; Date.now = () => 1700000000000 + window.__T;
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(window.__T), 16);
};
(async () => {
  const b = await chromium.launch(); const res = {};
  for (const [vw, vh, tag] of [[1280, 800, 'pc'], [390, 844, 'ph']]) {
    const pg = await b.newPage({ viewport: { width: vw, height: vh } }); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.addInitScript(FREEZE);
    await pg.goto('file://' + path.resolve(__dirname, '../dist/index.html')); await pg.waitForFunction('window.__ready === true');
    await pg.evaluate(() => { window.UI.TUNE_UI.TYPE_MS = 0; window.Sound.S.bgm = false; window.Sound.S.enabled = false; });
    const snap = async (name) => { await pg.waitForTimeout(tag === 'ph' ? 1500 : 150); const u = await pg.evaluate(() => { const c = [...document.querySelectorAll('canvas')].filter((x) => x.offsetParent && x.width > 200).map((x) => x.toDataURL()); return c.join('|'); }); const h = crypto.createHash('md5').update(u).digest('hex'); res[tag + '/' + name] = h; await pg.screenshot({ path: path.join(OUT, tag + '_' + name + '.png') }); };
    await snap('title');
    await pg.click('#btn-new'); await pg.waitForTimeout(300);
    const list = await pg.evaluate(() => { const r = []; const walk = (o, key) => { if (Array.isArray(o)) { if (o.some((x) => x && typeof x === 'object' && ('sc' in x || 'w' in x || 'c' in x))) { o.forEach((bt, i) => { if (bt && (bt.sc || bt.c || bt.enemy !== undefined)) r.push([key, i]); }); } else o.forEach((x, i) => walk(x, key + '.' + i)); return; } if (o && typeof o === 'object') for (const k of Object.keys(o)) walk(o[k], key ? key + '.' + k : k); }; walk(window.STORY.P, ''); return r; });
    for (const [key, upto] of list) {
      await pg.evaluate(async ([key, upto]) => { window.UI.kill(); const st = window.__G.stage(); let L = window.STORY.P; key.split('.').forEach((k) => { L = L[k]; }); for (let i = 0; i <= upto; i++) { const bt = Object.assign({}, L[i]); delete bt.fade; if (bt.sc || bt.c || bt.item || bt.enemy !== undefined) await st.change(bt); } const last = [...L.slice(0, upto + 1)].reverse().find((x) => x.w); if (last) window.UI.showLine(last, false); }, [key, upto]);
      await snap('sc_' + key.replace(/\./g, '_') + '_' + upto);
    }
    for (const [sec, mode, nm] of [[1, 'puzzle', 'pz1'], [2, 'puzzle', 'pz2'], [3, 'battle', 'bt3'], [4, 'puzzle', 'pz4'], [7, 'puzzle', 'pz7'], [8, 'battle', 'bt8']]) {
      await pg.evaluate((s) => window.__G.jumpTo(s), sec);
      for (let i = 0; i < 80; i++) { const m = await pg.evaluate(() => document.getElementById('play').dataset.mode); if (m === mode && !(await pg.evaluate(() => window.UI.waiting()))) break; const ch = await pg.$('#choices .ch'); if (ch) await ch.click(); else await pg.keyboard.press('Enter'); await pg.waitForTimeout(60); }
      await snap(nm);
    }
    console.log(tag, Object.keys(res).filter((k) => k.startsWith(tag)).length, errs);
    await pg.close();
  }
  fs.writeFileSync(path.join(OUT, 'hashes.json'), JSON.stringify(res, null, 1)); await b.close();
})();
