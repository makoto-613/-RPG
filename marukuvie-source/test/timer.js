const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto('file://' + path.resolve(__dirname, '../dist/index.html')); await pg.waitForFunction('window.__ready === true');
  await pg.evaluate(() => { window.UI.TUNE_UI.TYPE_MS = 0; }); await pg.click('#btn-expo'); await pg.waitForTimeout(200);
  await pg.evaluate(() => window.__G.jumpTo(3));
  for (let i = 0; i < 40; i++) { if (await pg.evaluate(() => window.Battle.active())) break; if (await pg.evaluate(() => window.UI.waiting())) await pg.keyboard.press('Enter'); else { const c = await pg.$('#choices .ch'); if (c) await c.click(); } await pg.waitForTimeout(80); }
  await pg.evaluate(() => window.__G.setRemaining(121)); await pg.waitForTimeout(1600);
  let st = await pg.evaluate(() => ({ sec: window.__G.S.sec, short: window.__G.S.flags.short, bt: window.Battle.active(), banner: document.getElementById('banner').textContent }));
  console.log('2分:', JSON.stringify(st));
  for (let i = 0; i < 30; i++) { if (await pg.$('#choices .ch')) break; await pg.keyboard.press('Enter'); await pg.waitForTimeout(80); }
  console.log('祭壇の選択肢:', await pg.evaluate(() => [...document.querySelectorAll('#choices .ch')].map((b) => b.dataset.id + (b.getAttribute('aria-disabled') ? '(不可:' + b.querySelector('.why').textContent + ')' : ''))));
  await pg.evaluate(() => window.__G.setRemaining(1)); await pg.waitForTimeout(1800);
  for (let i = 0; i < 30; i++) { if (await pg.evaluate(() => !document.getElementById('veil').hidden)) break; await pg.keyboard.press('Enter'); await pg.waitForTimeout(100); }
  console.log('0秒:', (await pg.evaluate(() => document.getElementById('dlg').innerText)).replace(/\s+/g, ' ').slice(0, 60), errs);
  await b.close();
})();
