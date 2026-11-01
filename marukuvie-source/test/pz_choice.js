const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch();
  for (const [w, h, tag] of [[1280, 800, 'pc'], [390, 844, 'ph']]) {
    const pg = await b.newPage({ viewport: { width: w, height: h } }); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.goto('file://' + path.resolve(__dirname, '../dist/index.html')); await pg.waitForFunction('window.__ready === true');
    await pg.evaluate(() => { window.UI.TUNE_UI.TYPE_MS = 0; }); await pg.click('#btn-expo'); await pg.waitForTimeout(500); await pg.click('[data-diff="easy"]'); await pg.waitForTimeout(200);
    await pg.evaluate(() => window.__G.jumpTo(2));
    for (let i = 0; i < 40; i++) { if (await pg.evaluate(() => window.UI.getMode() === 'puzzle' && !window.UI.waiting())) break; if (await pg.evaluate(() => window.UI.waiting())) await pg.keyboard.press('Enter'); await pg.waitForTimeout(80); }
    await pg.keyboard.press('ArrowUp'); await pg.waitForTimeout(900);
    await pg.screenshot({ path: `test/shots/pzc_${tag}.png` }); console.log(tag, errs, await pg.evaluate(() => document.querySelectorAll('#choices .ch').length));
    await pg.close();
  }
  await b.close();
})();
