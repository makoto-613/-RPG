/* テストで共通に使うもの：ブラウザを開く・ゲームのページを開く・台詞を進める・結果を記録する
   使い方：const T = require('./lib'); */
const { chromium } = require('playwright');
const path = require('path');

// 確かめる HTML（ふつうは dist/index.html。GAME_HTML で別のファイルにもできる）
const gameFile = (f) => process.env.GAME_HTML || path.resolve(__dirname, '../dist/' + (f || 'index.html'));
const gameUrl = (f) => 'file://' + gameFile(f);

// ブラウザを開く。autoplay：音を、操作なしで鳴らせるようにする（BGM・効果音のテスト用）
function launch(o = {}) {
  return chromium.launch({
    executablePath: process.env.LUNOS_CHROMIUM || undefined,
    args: o.autoplay ? ['--autoplay-policy=no-user-gesture-required'] : ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });
}

// ページの読み込み前に動かすもの（addInitScript に渡す）
const clearStorage = () => {
  try {
    localStorage.clear();
  } catch (e) {
    /* 使えないときは何もしない */
  }
};
const seenBattleHelp = () => {
  // 戦い方の説明は別のテストで確かめる（ここでは出さない）
  try {
    localStorage.clear();
    localStorage.setItem('lunos_adventure_prefs_v2', JSON.stringify({ battleHelpSeen: true }));
  } catch (e) {
    /* 使えないときは何もしない */
  }
};

// 文字を一度に出す（TYPE_MS＝0）。noGuard：ダイアログを開いた直後の押しまちがい防止の待ちもなくす
const fast = (pg, noGuard) =>
  pg.evaluate((g) => {
    window.UI.TUNE_UI.TYPE_MS = 0;
    if (g) window.UI.TUNE_UI.DLG_GUARD_MS = 0;
  }, !!noGuard);

/* ゲームのページを開く。o：{ viewport, file（dist の中のファイル名）, init（読み込み前に動かす関数）, noGuard, slow（文字を一度に出さない） }
   戻り値：{ pg, errs（ページで起きたエラー） } */
async function openGame(b, o = {}) {
  const pg = await b.newPage(o.viewport ? { viewport: o.viewport } : {});
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  if (o.init) await pg.addInitScript(o.init);
  await pg.goto(gameUrl(o.file), { timeout: 120000 });
  await pg.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  if (!o.slow) await fast(pg, o.noGuard);
  return { pg, errs };
}

/* ブラウザの保存領域をフォルダに残す開き方（閉じて開き直す「つづきから」のテスト用）。戻り値：{ ctx, pg, errs } */
async function openPersistent(dir, file) {
  const ctx = await chromium.launchPersistentContext(dir, { viewport: { width: 1280, height: 800 } });
  const pg = ctx.pages()[0] || (await ctx.newPage());
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto(file ? 'file://' + path.resolve(file) : gameUrl(), { timeout: 120000 });
  await pg.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  await fast(pg);
  return { ctx, pg, errs };
}

/* until() が true になるまで、台詞を送る（ダイアログの「OK」・選択肢のいちばん上・Enter の順に押す）。n 回で諦める */
async function advance(pg, until, n = 150) {
  for (let i = 0; i < n; i++) {
    if (await until()) return true;
    const ok = await pg.$('.dlg-b [data-a="ok"]');
    if (ok && (await ok.isVisible())) {
      await ok.click();
      continue;
    }
    const ch = await pg.$('#choices .ch');
    if (ch) await ch.click();
    else await pg.keyboard.press('Enter');
    await pg.waitForTimeout(90);
  }
  return false;
}

/* 結果の記録：ok(名前, 合っているか, 補足)。まちがいが1つでもあれば、終了コードを 1 にする */
function checker() {
  const lines = [];
  const ok = (name, cond, extra) => {
    lines.push((cond ? 'OK ' : 'NG ') + name + (extra ? ' ' + extra : ''));
    if (!cond) process.exitCode = 1;
  };
  return { ok, lines };
}

module.exports = { chromium, gameFile, gameUrl, launch, clearStorage, seenBattleHelp, fast, openGame, openPersistent, advance, checker };
