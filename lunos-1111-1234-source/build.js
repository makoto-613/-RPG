/* ==========================================================================
   build.js ― 部品（js/ の中の *.js）・見た目（src/style.css）・画像・音を、1枚の HTML にまとめる
   使い方：node build.js
   できるもの（dist/）
     artifact.html   … 公開ページ用。曲と効果音は、ページと一緒に公開する audio/ フォルダから読む（audio_blobs.json）
     index.html      … 手元の確認・自動テスト用。音（assets/audio）を中に埋め込む
     standalone.html … 展示・ダウンロード用。index.html と同じ中身を、ふつうの1枚の HTML の形で書き出す
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const D = __dirname;
const rd = (f) => fs.readFileSync(path.join(D, f), 'utf8');

/* ---------------------------------------------------------------------------
   プログラムの部品。上から順に読み込まれる（あとの部品は、前の部品が window に置いたものを使う）
   フォルダは機能ごと：data（数値・台詞・盤面・音の設定）／art（キャラ・敵の絵）／system（土台）
   ／novel（物語の場面）／puzzle（謎解き）／battle（戦闘）
   --------------------------------------------------------------------------- */
const MODULES = [
  [
    'js/data/atlas.js',
    'ドット絵の切り出し位置と画像データ（とても長い文字列です。ここは触らなくて大丈夫です）'
  ],
  ['js/art/chars.js', '採用済みの4キャラクター素材を全画面で共有するレジストリ'],
  [
    'js/data/rules.js',
    '数値と選択肢の表：カルマ・不安・HPの初期値、タイマーの秒数、v6.0 の「選択肢と分岐」の表'
  ],
  ['js/data/levels.js', '謎解きの盤面：各区画のマップ（書き換えたら、解けるかどうかを必ず確かめてください）'],
  ['js/puzzle/core.js', '謎解きのルール：羊追い・トロッコ・鏡・灯火の仕組み（画面に依存しない）'],
  ['js/data/story.js', '台詞・文章：p:1 がついている行が「仮」の文です'],
  ['js/data/audio.js', 'BGM・効果音の設定（シートから作る）'],
  ['js/system/sound.js', 'BGM・効果音を鳴らす'],
  ['js/puzzle/render.js', '謎解きの盤面の絵'],
  ['js/art/enemy.js', '敵の絵（ムカデ・トゲイモムシ）'],
  ['js/novel/visual_state.js', '可動装置と背景の状態を統一する表示モデル'],
  ['js/data/stage_data.js', 'ノベルの場面のデータ：見た目の調整値・ポーズ・場面の一覧'],
  ['js/novel/stage.js', 'ノベルの場面の描画：背景・立ち絵・演出'],
  ['js/system/shell.js', '画面の部品：台詞の枠・選択肢・ダイアログ・状態の表示'],
  ['js/system/tutorial.js', '操作の練習：各ゲームのはじめに出す吹き出し'],
  ['js/puzzle/puzzle.js', '謎解きの進行：盤面の操作・ヒント・やり直し'],
  ['js/battle/battle_rules.js', '戦闘のルール：数値の表・ルノの行動・敵とフラメトのAI（画面に依存しない）'],
  ['js/battle/battle.js', '戦闘の画面：盤面の描画・コマンド・アニメーション'],
  ['js/system/sections.js', '序章と区画1〜10の流れ'],
  ['js/system/game.js', 'ゲーム全体の土台：状態・台詞の再生・タイマー・結末・保存・メニュー']
];

/* ---------------------------------------------------------------------------
   画像：assets/ の中のファイルを data: URI にして、HTML の中に埋め込む
   --------------------------------------------------------------------------- */
const IMAGE_MIME = { '.png': 'image/png', '.webp': 'image/webp' };
const uri = (f) =>
  'data:' +
  IMAGE_MIME[path.extname(f)] +
  ';base64,' +
  fs.readFileSync(path.join(D, 'assets', f)).toString('base64');

// フォルダの中の .webp を、名前の決まりに合うものだけ集めて { 種類: { ポーズ: data URI } } にする
function webpTable(dir, pattern) {
  const map = {};
  for (const name of fs.readdirSync(path.join(D, dir)).filter((n) => n.endsWith('.webp'))) {
    const m = pattern.exec(name);
    if (!m) continue;
    (map[m[1]] ||= {})[m[2]] =
      'data:image/webp;base64,' + fs.readFileSync(path.join(D, dir, name)).toString('base64');
  }
  return map;
}

// 物語の背景：assets/novel_bg の .webp をすべて { 場面名: data URI } にする
function novelBackgrounds() {
  return dirImages('assets/novel_bg');
}
// フォルダの .webp をすべて { 名前: data URI } にする（物語の背景・謎解きの盤面の絵 assets/puzzle_bg）
function dirImages(rel) {
  const dir = path.join(D, rel);
  const names = fs.readdirSync(dir).filter((n) => n.endsWith('.webp'));
  return Object.fromEntries(
    names.map((n) => [
      path.basename(n, '.webp'),
      'data:image/webp;base64,' + fs.readFileSync(path.join(dir, n)).toString('base64')
    ])
  );
}

/* ---------------------------------------------------------------------------
   音：手元・展示用は埋め込み、公開用は audio/ フォルダから読む
   --------------------------------------------------------------------------- */
const AUD = path.join(D, 'assets/audio');
const AUDIO_MIME = { '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4' };
const embedded = {};
(fs.existsSync(AUD) ? fs.readdirSync(AUD) : []).forEach((f) => {
  const m = AUDIO_MIME[path.extname(f).toLowerCase()];
  if (m) embedded[f] = 'data:' + m + ';base64,' + fs.readFileSync(path.join(AUD, f)).toString('base64');
});

// 公開用の音の置き場所の表（audio_blobs.json：音のファイル名 → 公開ページと一緒に置く場所）。
// assets/audio に新しい音を足すと、ここで dist/audio/ に写して表に書き足す（日本語の名前は se_番号 にする）
const BLOBS = path.join(D, 'audio_blobs.json');
const blobs = fs.existsSync(BLOBS) ? JSON.parse(rd('audio_blobs.json')) : {};
const newBlobs = Object.keys(embedded).filter((f) => !blobs[f]);
newBlobs.forEach((f) => {
  let rel = 'audio/' + f;
  if (!/^[\x21-\x7e]+$/.test(f)) {
    const used = new Set(Object.values(blobs));
    for (let n = 1; used.has((rel = 'audio/se/se_' + String(n).padStart(2, '0') + path.extname(f))); n++);
  }
  fs.mkdirSync(path.dirname(path.join(D, 'dist', rel)), { recursive: true });
  fs.copyFileSync(path.join(AUD, f), path.join(D, 'dist', rel));
  blobs[f] = rel;
});
if (newBlobs.length) {
  fs.writeFileSync(BLOBS, JSON.stringify(blobs, null, 1) + '\n');
  console.log('公開用の音を足しました（公開のときに一緒に置く）:', newBlobs.map((f) => blobs[f]).join(', '));
}

/* ---------------------------------------------------------------------------
   部品を <script> にして並べる。audioFiles：音のファイル名 → 読む場所
   部品によっては、画像・音のデータを前後に書き足す
   --------------------------------------------------------------------------- */
function scripts(audioFiles) {
  return MODULES.map(([file, note]) => {
    const name = path.basename(file);
    let code = rd(file);
    if (name === 'atlas.js') code += '\nwindow.ATLAS_URL = "' + uri('atlas.webp') + '";';
    if (name === 'chars.js') {
      const map = webpTable('assets/character_hd', /^(luno|flam|albo|amina)_([a-z_0-9]+)\.webp$/);
      code = 'window.CHARACTER_HD_URLS = ' + JSON.stringify(map) + ';\n' + code;
      // 物語（会話の場面）で使う人物の絵（assets/character_novel）。フラメトは頭と胸だけの絵（*_cut）
      const novel = webpTable('assets/character_novel', /^(luno|flam|albo|amina)_([a-z_]+)\.webp$/);
      code = 'window.CHARACTER_NOVEL_URLS = ' + JSON.stringify(novel) + ';\n' + code;
    }
    if (name === 'audio.js') code += '\nwindow.AUDIO_FILES = ' + JSON.stringify(audioFiles) + ';';
    if (name === 'enemy.js') {
      const map = webpTable('assets/enemies_hd', /^(centipede|boss)_(idle|big|atk|dmg)\.webp$/);
      code = 'window.ENEMY_HD_URLS = ' + JSON.stringify(map) + ';\n' + code;
    }
    if (name === 'render.js')
      code = 'window.PUZZLE_BG_URLS = ' + JSON.stringify(dirImages('assets/puzzle_bg')) + ';\n' + code;
    if (name === 'battle.js')
      code = 'window.BATTLE_BG_URLS = ' + JSON.stringify(dirImages('assets/battle_bg')) + ';\n' + code;
    if (name === 'stage.js')
      code = 'window.NOVEL_BG_URLS = ' + JSON.stringify(novelBackgrounds()) + ';\n' + code;
    return '<!-- ' + name + ' ― ' + note + ' -->\n<script>\n' + code + '\n</script>';
  }).join('\n');
}

/* ---------------------------------------------------------------------------
   画面の HTML（src/index.html）に、見た目（src/style.css）とプログラムを差し込む
   --------------------------------------------------------------------------- */
let page = rd('src/index.html');
if (page.indexOf('<!--@@STYLE@@-->') < 0) throw new Error('src/index.html に <!--@@STYLE@@--> がありません');
if (page.indexOf('<!--@@SCRIPTS@@-->') < 0)
  throw new Error('src/index.html に <!--@@SCRIPTS@@--> がありません');
page = page.replace('<!--@@STYLE@@-->', () => '<style>\n' + rd('src/style.css') + '</style>');
page = page.replace(/@@(ui\/[A-Za-z0-9_.]+)@@/g, (m, f) => uri(f)); // UI の画像
const html = page.replace('<!--@@SCRIPTS@@-->', () => scripts(embedded));
const htmlArt = page.replace('<!--@@SCRIPTS@@-->', () => scripts(blobs));

/* ---------------------------------------------------------------------------
   書き出し
   --------------------------------------------------------------------------- */
fs.mkdirSync(path.join(D, 'dist'), { recursive: true });
fs.writeFileSync(path.join(D, 'dist/artifact.html'), htmlArt);

const reset =
  '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}' +
  'body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>';
const viewport = '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">';
fs.writeFileSync(
  path.join(D, 'dist/index.html'),
  '<!doctype html><html lang="ja"><head><meta charset="utf-8">' +
    viewport +
    reset +
    '</head><body>' +
    html +
    '</body></html>'
);

// 展示・ダウンロード用：ふつうの1枚のHTMLとして書き出す（title・フォント・CSS は <head> へ、画面とプログラムは <body> へ）
const cut = html.indexOf('</style>') + '</style>'.length;
const headPart = html
  .slice(0, cut)
  .replace('<meta charset="utf-8">', '')
  .replace(/<meta name="claude:viewport-fit-sides"[^>]*>\s*/, '')
  .trim();
const standalone =
  '<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n' +
  viewport +
  '\n' +
  reset +
  '\n' +
  headPart +
  '\n</head>\n<body>\n' +
  html.slice(cut).trim() +
  '\n</body>\n</html>\n';
fs.writeFileSync(path.join(D, 'dist/standalone.html'), standalone);

console.log(
  'dist/artifact.html',
  (htmlArt.length / 1024).toFixed(0) +
    ' KB  /  dist/index.html（手元確認用）/ ' +
    'dist/standalone.html（展示・ダウンロード用 ' +
    (standalone.length / 1024).toFixed(0) +
    ' KB）'
);
