/* 難易度：「はじめから」のあとに選べる／選んだ難易度の盤面・敵になる／途中で変える場所がない／つづきからでも同じ難易度 */
const { chromium } = require('playwright'); const path = require('path');
const LV = require('../levels.js');
const out = []; const ok = (n, c, x) => { out.push((c ? 'OK ' : 'NG ') + n + (x ? ' ' + x : '')); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1100, height: 800 } }); const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await pg.goto('file://' + path.resolve(__dirname, '../dist/index.html')); await pg.waitForFunction('window.__ready === true');
  await pg.evaluate(() => { window.UI.TUNE_UI.TYPE_MS = 0; });
  await pg.click('#btn-new'); await pg.waitForTimeout(500);
  const opts = await pg.$$eval('[data-diff]', (bs) => bs.map((x) => x.dataset.diff + ':' + x.innerText.split('\n')[0]));
  ok('はじめから→難易度が3つ出る', opts.length === 3, opts.join(' '));
  await pg.click('[data-a="no"]'); await pg.waitForTimeout(200);
  ok('「やめる」でタイトルに残る', await pg.evaluate(() => !document.getElementById('scr-title').hidden));
  for (const d of ['normal', 'hard']) {
    await pg.evaluate(() => window.__G.toTitle()); await pg.click('#btn-new'); await pg.waitForTimeout(500); await pg.click(`[data-diff="${d}"]`); await pg.waitForTimeout(300);
    ok(d + '：遊びの状態に記録', await pg.evaluate(() => window.__G.S.diff) === d);
    // 区画1の謎解き：選んだ難易度の盤面か
    await pg.evaluate(() => window.__G.jumpTo(1));
    for (let i = 0; i < 400; i++) { const st = await pg.evaluate(() => ({ pz: window.Puzzle.active(), w: window.UI.waiting(), ch: [...document.querySelectorAll('#choices .ch')].map((x) => x.dataset.id) })); if (st.pz) break; if (st.w) await pg.keyboard.press('Enter'); else if (st.ch.length) await pg.click(`#choices .ch[data-id="${st.ch[0]}"]`); await pg.waitForTimeout(30); }
    const rows = await pg.evaluate(() => window.Puzzle.P.L.rows.join('|'));
    ok(d + '：区画1の盤面', rows === LV[d].s1.rows.join('|'));
    const hint = await pg.evaluate(() => document.getElementById('mtext').textContent);
    ok(d + '：目標の文', /三つの足場/.test(hint), hint.slice(0, 30));
    // メニュー：難易度は見えるが、変える場所はない
    await pg.evaluate(() => window.__G.openMenu()); await pg.waitForTimeout(500);
    const m = await pg.evaluate(() => ({ t: document.getElementById('dlg').innerText, n: document.querySelectorAll('#dlg [data-diff]').length }));
    ok(d + '：メニューに難易度（変更不可）', /難易度/.test(m.t) && /途中では変えられません/.test(m.t) && m.n === 0);
    await pg.evaluate(() => window.UI.closeVeil());
  }
  // つづきから：難易度が保たれる
  await pg.evaluate(() => window.__G.toTitle()); await pg.waitForTimeout(200);
  const note = await pg.evaluate(() => document.getElementById('cont-note').textContent);
  ok('つづきからの説明に難易度', /難易度 むずかしい/.test(note), note);
  await pg.click('#btn-cont'); await pg.waitForTimeout(300);
  ok('つづきからでも同じ難易度', await pg.evaluate(() => window.__G.S.diff) === 'hard');
  // 戦闘：敵の強さ
  const hp = await pg.evaluate(() => { const R = window.BattleRules.Rules; return ['easy', 'normal', 'hard'].map((d) => R.newBattle({ kind: 'boss', diff: d, luHP: 25, flHP: 35, A: 20, K: 20 }).en.max); });
  ok('トゲイモムシのHPが難易度で変わる', hp[0] < hp[1] && hp[1] < hp[2], hp.join('/'));
  ok('エラーなし', !errs.length, errs.join('|'));
  console.log(out.join('\n')); await b.close();
})();
