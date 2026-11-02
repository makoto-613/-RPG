/* 区画2の選択肢は、謎解きの前（ノベル表示中）に現れる */
const { chromium } = require('playwright');
const path = require('path');
const assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch();
  try {
    for (const [w, h, tag] of [[1280, 800, 'pc'], [390, 844, 'ph']]) {
      const pg = await b.newPage({ viewport: { width: w, height: h } });
      const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
      await pg.goto('file://' + path.resolve(__dirname, '../dist/index.html'));
      await pg.waitForFunction('window.__ready === true');
      await pg.evaluate(() => {
        UI.TUNE_UI.TYPE_MS = 0;
        __G.newGame('free', 'easy');
        __G.jumpTo(2);
        UI.setSkip(true);
      });
      await pg.waitForFunction(() => document.querySelectorAll('#choices .ch').length === 2);
      assert.equal(await pg.evaluate(() => UI.getMode()), 'novel');
      assert.equal(await pg.evaluate(() => Puzzle.active()), false);
      await pg.click('[data-id="walk"]');
      await pg.evaluate(() => UI.setSkip(true));
      await pg.waitForFunction(() => Puzzle.active());
      assert.equal(await pg.evaluate(() => Puzzle.P.flags.c03), 'walk');
      assert.equal(await pg.evaluate(() => document.querySelectorAll('#choices .ch').length), 0);
      assert.equal(await pg.evaluate(() => document.querySelector('#mmeta').textContent), '');
      const ev = await pg.evaluate(() => {
        const P = Puzzle.P, q = P.M.prep(P.L).q;
        return P.M.step(P.L, Object.assign({}, P.s, { px: q[0] - 1, py: q[1] }), 'R').ev;
      });
      assert.ok(!ev.some((e) => e.t === 'trigger'), '水たまりで選択肢を再表示しない');
      assert.deepEqual(errs, []);
      console.log('OK', tag);
      await pg.close();
    }
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
