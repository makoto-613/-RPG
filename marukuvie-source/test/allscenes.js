// 物語の全ての場面（sc / c / enemy / item が変わる beat）を、実際の流れどおりに当てはめて撮影する
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const [VW, VH, TAG] = [+process.argv[2] || 1280, +process.argv[3] || 800, process.argv[4] || 'pc'];
const OUT = path.resolve(__dirname, '../../check/' + TAG); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: VW, height: VH } }); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto('file://' + path.resolve(__dirname, '../dist/index.html')); await pg.waitForFunction('window.__ready === true');
  await pg.evaluate(() => { window.UI.TUNE_UI.TYPE_MS = 0; window.Sound.S.bgm = false; });
  await pg.click('#btn-new'); await pg.waitForTimeout(400);
  const list = await pg.evaluate(() => {
    const res = []; const walk = (o, key) => {
      if (Array.isArray(o)) { if (o.some((x) => x && typeof x === 'object' && ('sc' in x || 'w' in x || 'c' in x))) { let n = 0; o.forEach((bt, i) => { if (bt && (bt.sc || bt.c || bt.enemy !== undefined)) res.push([key, i, n++]); }); } else o.forEach((x, i) => walk(x, key + '.' + i)); return; }
      if (o && typeof o === 'object') for (const k of Object.keys(o)) walk(o[k], key ? key + '.' + k : k);
    }; walk(window.STORY.P, ''); return res;
  });
  console.log('shots', list.length);
  for (const [key, upto] of list) {
    await pg.evaluate(async ([key, upto, fresh]) => {
      window.UI.kill(); const st = window.__G.stage(); let L = window.STORY.P; key.split('.').forEach((k) => { L = L[k]; });
      for (let i = 0; i <= upto; i++) { const bt = Object.assign({}, L[i]); delete bt.fade; if (bt.sc || bt.c || bt.item || bt.enemy !== undefined) await st.change(bt); if (bt.w && i === upto) window.UI.showLine(bt, false); }
      const last = [...L.slice(0, upto + 1)].reverse().find((x) => x.w); if (last) window.UI.showLine(last, false);
    }, [key, upto]);
    await pg.waitForTimeout(1300);
    await pg.screenshot({ path: `${OUT}/${key.replace(/\./g, '_')}__${String(upto).padStart(2, '0')}.png` });
  }
  console.log(errs); await b.close();
})();
