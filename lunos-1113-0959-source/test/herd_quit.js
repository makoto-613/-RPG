/* 羊追いの難易度の目安・タイトルへの戻り・棄権（中断の結末）・操作の練習を、本物の画面で確かめる */
const T = require('./lib');
const path = require('path');
const makeCore = require('../js/puzzle/core.js'),
  LVS = require('../js/data/levels.js');
const C = makeCore(LVS.easy);
const KEYS = { U: 'ArrowUp', D: 'ArrowDown', L: 'ArrowLeft', R: 'ArrowRight' };
const results = [];
const ok = (n, c, x) => {
  results.push((c ? 'OK ' : 'NG ') + n + ' ' + (x || ''));
  if (!c) process.exitCode = 1;
};
const shot = (pg, n) => pg.screenshot({ path: path.join(__dirname, 'shots', 'hq_' + n + '.png') });

// 台詞を送って、羊追いが始まるまで待つ
async function toSheep(pg) {
  for (let i = 0; i < 400; i++) {
    const st = await pg.evaluate(() => ({
      w: window.UI.waiting(),
      pz: window.Puzzle.active() && window.Puzzle.P.sid === 's0'
    }));
    if (st.pz) return true;
    if (st.w) await pg.keyboard.press('Enter');
    await pg.waitForTimeout(30);
  }
  return false;
}
async function tutText(pg) {
  return pg.evaluate(() => {
    const t = document.getElementById('tut');
    return t.hidden ? '' : t.innerText;
  });
}
async function press(pg, a) {
  for (let k = 0; k < 200; k++) {
    if (await pg.evaluate(() => !window.Puzzle.busy())) break;
    await pg.waitForTimeout(20);
  }
  await pg.keyboard.press(KEYS[a]);
  await pg.waitForTimeout(25);
}
async function solveSheep(pg, diff) {
  const s = await pg.evaluate(() => JSON.parse(JSON.stringify(window.Puzzle.P.s)));
  const r = C.solve('s0', LVS[diff].s0, s);
  for (const a of r.path) {
    if (!(await pg.evaluate(() => window.Puzzle.active()))) break;
    await press(pg, a);
  }
}
async function waitDlg(pg, re) {
  for (let i = 0; i < 300; i++) {
    const t = await pg.evaluate(() => (document.getElementById('veil').hidden ? '' : document.getElementById('dlg').innerText));
    if (re.test(t)) {
      await pg.waitForTimeout(600); // 開いた直後のボタンは押せない（連打の読み飛ばし防止）
      return t;
    }
    if (await pg.evaluate(() => window.UI.waiting())) await pg.keyboard.press('Enter');
    await pg.waitForTimeout(40);
  }
  return '';
}

(async () => {
  const b = await T.launch();
  const { pg, errs } = await T.openGame(b, { viewport: { width: 1280, height: 800 }, init: T.clearStorage });

  // 1回目：かんたん → 羊追い → 練習の吹き出し → 結果 →「タイトルに戻る」
  await pg.click('#btn-new');
  await pg.waitForTimeout(400);
  await pg.click('[data-diff="easy"]');
  ok('羊追いが始まる', await toSheep(pg));
  let t = await tutText(pg);
  ok('練習1：動かしてみよう', /1／3/.test(t) && /動かして/.test(t), t.replace(/\n/g, ' '));
  await shot(pg, '1_tut');
  // 羊のいない方へ1歩
  const s = await pg.evaluate(() => window.Puzzle.P.s);
  await press(pg, s.py > 1 ? 'U' : 'L');
  await pg.waitForTimeout(700);
  t = await tutText(pg);
  ok('練習2：羊を押そう', /2／3/.test(t), t.replace(/\n/g, ' '));
  await solveSheep(pg, 'easy');
  let d = await waitDlg(pg, /羊追いの結果/);
  ok('結果のダイアログ', /手数/.test(d) && /目安/.test(d) && /かかった時間/.test(d), d.replace(/\n/g, ' ').slice(0, 120));
  await shot(pg, '2_result');
  await pg.click('[data-a="back"]');
  await pg.waitForTimeout(500);
  ok('タイトルに戻る', await pg.evaluate(() => !document.getElementById('scr-title').hidden));

  // 2回目：ふつう → 羊4頭 → 「この難易度で進む」→ メニューが「棄権する」→ 中断の結末
  await pg.click('#btn-new');
  await pg.waitForTimeout(400);
  const dlg = await pg.evaluate(() => document.getElementById('dlg').innerText);
  if (/つづき|上書き|はじめから/.test(dlg) && (await pg.$('[data-a="ok"]'))) await pg.click('[data-a="ok"]');
  await pg.waitForTimeout(300);
  await pg.click('[data-diff="normal"]');
  ok('羊追い（ふつう）', await toSheep(pg));
  const n = await pg.evaluate(() => window.Puzzle.P.s.sh.length);
  ok('ふつうの羊は4頭', n === 4, String(n));
  await shot(pg, '3_normal');
  await solveSheep(pg, 'normal');
  d = await waitDlg(pg, /羊追いの結果/);
  ok('結果（ふつう）', /ふつう/.test(d), d.replace(/\n/g, ' ').slice(0, 120));
  await pg.click('[data-a="go"]');
  // 序章の続きを送る
  for (let i = 0; i < 80; i++) {
    if (await pg.evaluate(() => window.UI.waiting())) await pg.keyboard.press('Enter');
    await pg.waitForTimeout(30);
  }
  await pg.click('#ph-menu');
  await pg.waitForTimeout(300);
  const menu = await pg.evaluate(() => document.getElementById('dlg').innerText);
  ok('メニューは「棄権する」', /棄権する/.test(menu) && !/タイトルへ/.test(menu));
  await pg.waitForTimeout(500);
  await pg.click('#m-quit');
  await pg.waitForTimeout(600);
  await shot(pg, '4_confirm');
  await pg.click('[data-a="ok"]');
  d = await waitDlg(pg, /中断/);
  ok('中断の結末', /今日はここまで/.test(d), d.replace(/\n/g, ' ').slice(0, 120));
  await shot(pg, '5_quit_end');
  const ends = await pg.evaluate(() => JSON.parse(localStorage.getItem('lunos_adventure_endings_v1') || '{}'));
  ok('結末の一覧には数えない', !ends.e_quit, JSON.stringify(ends));
  ok('ページのエラーなし', !errs.length, errs.join('|'));
  console.log(results.join('\n'));
  await b.close();
})();
