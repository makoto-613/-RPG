// ブラウザを閉じて開き直したあとの「つづきから」：序章の途中・謎解きの途中・戦闘の途中（本物のブラウザの保存領域を使う）
// 使い方：node test/restart_resume.js
const T = require('./lib'); const path = require('path'); const fs = require('fs');
const open = (dir) => T.openPersistent(dir, process.argv[2]);
const adv = T.advance;
const snap = (pg) => pg.evaluate(() => { const S = window.__G.S; return S && { sec: S.sec, diff: S.diff, lh: S.lh, fh: S.fh, K: S.K, A: S.A, log: S.log.length, mode: document.getElementById('play').dataset.mode, line: (document.getElementById('mt') || {}).textContent }; });
(async () => {
  const out = {};
  for (const sc of ['prologue', 'puzzle', 'battle']) {
    const dir = path.resolve(__dirname, 'shots/profile_' + sc); fs.rmSync(dir, { recursive: true, force: true });
    let { ctx, pg, errs } = await open(dir);
    await pg.click('#btn-new'); await pg.waitForTimeout(500); await pg.click('[data-diff="hard"]'); await pg.waitForTimeout(800);
    if (sc === 'prologue') { for (let i = 0; i < 4; i++) { await pg.keyboard.press('Enter'); await pg.waitForTimeout(200); } }
    if (sc === 'puzzle') { await pg.evaluate(() => window.__G.jumpTo(4)); await adv(pg, async () => (await snap(pg)).mode === 'puzzle'); await pg.waitForTimeout(500); for (const k of ['ArrowRight', 'ArrowUp', 'ArrowUp']) { await pg.keyboard.press(k); await pg.waitForTimeout(300); } }
    if (sc === 'battle') { await pg.evaluate(() => window.__G.jumpTo(3)); await adv(pg, async () => (await snap(pg)).mode === 'battle'); await pg.waitForTimeout(800); await pg.keyboard.press('3'); await pg.waitForTimeout(400); await pg.keyboard.press('Enter'); await pg.waitForTimeout(3500); }
    const before = await snap(pg); const extra = sc === 'puzzle' ? await pg.evaluate(() => JSON.stringify(window.Puzzle.P.s)) : null;
    await ctx.close();
    ({ ctx, pg, errs } = await open(dir));
    const cont = await pg.isVisible('#btn-cont'), note = await pg.textContent('#cont-note');
    await pg.click('#btn-cont'); await pg.waitForTimeout(1500);
    if (sc !== 'prologue') await adv(pg, async () => (await snap(pg)).mode === (sc === 'puzzle' ? 'puzzle' : 'battle'));
    await pg.waitForTimeout(1500);
    const after = await snap(pg); const extra2 = sc === 'puzzle' ? await pg.evaluate(() => JSON.stringify(window.Puzzle.P.s)) : null;
    await pg.screenshot({ path: path.join(__dirname, 'shots/resume_' + sc + '.png') });
    out[sc] = { cont, note, before, after, sameBoard: extra ? extra === extra2 : undefined, errs };
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1));
})();
