/* ==========================================================================
   build.js ― 部品（*.js）・画像・音を、1枚の HTML にまとめる
   使い方：node build.js
   できるもの（dist/）
     artifact.html   … 公開ページ用。曲と効果音は、ページと一緒に公開する audio/ フォルダから読む（audio_blobs.json）
     index.html      … 手元の確認・自動テスト用。軽くした音（assets/audio）を中に埋め込む
     standalone.html … ダウンロード用。index.html と同じ中身を、ふつうの1枚の HTML の形で書き出す
   ========================================================================== */
const fs = require('fs'), path = require('path');
const D = __dirname, rd = (f) => fs.readFileSync(path.join(D, f), 'utf8');

/* プログラムの部品。上から順に読み込まれる（あとの部品は、前の部品が window に置いたものを使う） */
const MODULES = [
  ['atlas.js', 'ドット絵の切り出し位置と画像データ（とても長い文字列です。ここは触らなくて大丈夫です）'],
  ['rules.js', '数値と選択肢の表：カルマ・不安・HPの初期値、タイマーの秒数、v6.0 の「選択肢と分岐」の表'],
  ['levels.js', '謎解きの盤面：各区画のマップ（書き換えたら、解けるかどうかを必ず確かめてください）'],
  ['core.js', '謎解きのルール：トロッコ・水路・鏡・灯火の仕組み（画面に依存しない）'],
  ['story.js', '台詞・文章：p:1 がついている行が「仮」の文です'],
  ['audio.js', 'BGM・効果音の設定（シートから作る）'],
  ['sound.js', 'BGM・効果音を鳴らす'],
  ['render.js', '謎解きの盤面の絵'],
  ['enemy.js', '敵の絵（ムカデ・トゲイモムシ）'],
  ['stage_data.js', 'ノベルの場面のデータ：見た目の調整値・ポーズ・場面の一覧'],
  ['stage_paint.js', 'ノベルの場面：一枚絵の風景（廃坑の入口・タイトル画面）'],
  ['stage.js', 'ノベルの場面の描画：背景・立ち絵・演出'],
  ['shell.js', '画面の部品：台詞の枠・選択肢・ダイアログ・状態の表示'],
  ['puzzle.js', '謎解きの進行：盤面の操作・ヒント・やり直し'],
  ['battle_rules.js', '戦闘のルール：数値の表・ルノの行動・敵とフラメトのAI（画面に依存しない）'],
  ['battle.js', '戦闘の画面：盤面の描画・コマンド・アニメーション'],
  ['sections.js', '序章と区画1〜10の流れ'],
  ['game.js', 'ゲーム全体の土台：状態・台詞の再生・タイマー・結末・保存・メニュー']
];

/* 画像（assets/ の中）を data: URI にする */
const mime = { '.png': 'image/png', '.webp': 'image/webp' };
const uri = (f) => 'data:' + mime[path.extname(f)] + ';base64,' + fs.readFileSync(path.join(D, 'assets', f)).toString('base64');

/* 音：手元・ダウンロード用は埋め込み、公開用は audio/ フォルダから読む */
const AUD = path.join(D, 'assets/audio'), amime = { '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4' };
const embedded = {}; (fs.existsSync(AUD) ? fs.readdirSync(AUD) : []).forEach((f) => { const m = amime[path.extname(f).toLowerCase()]; if (m) embedded[f] = 'data:' + m + ';base64,' + fs.readFileSync(path.join(AUD, f)).toString('base64'); });
// 公開用の音の置き場所の表（audio_blobs.json：音のファイル名 → 公開ページと一緒に置く場所）。
// assets/audio に新しい音を足すと、ここで dist/audio/ に写して表に書き足す（日本語の名前は se_番号 にする）
const BLOBS = path.join(D, 'audio_blobs.json');
const blobs = fs.existsSync(BLOBS) ? JSON.parse(rd('audio_blobs.json')) : {};
const newBlobs = Object.keys(embedded).filter((f) => !blobs[f]);
newBlobs.forEach((f) => {
  let rel = 'audio/' + f;
  if (!/^[\x21-\x7e]+$/.test(f)) { const used = new Set(Object.values(blobs)); for (let n = 1; used.has(rel = 'audio/se/se_' + String(n).padStart(2, '0') + path.extname(f)); n++); }
  fs.mkdirSync(path.dirname(path.join(D, 'dist', rel)), { recursive: true }); fs.copyFileSync(path.join(AUD, f), path.join(D, 'dist', rel));
  blobs[f] = rel;
});
if (newBlobs.length) { fs.writeFileSync(BLOBS, JSON.stringify(blobs, null, 1) + '\n'); console.log('公開用の音を足しました（公開のときに一緒に置く）:', newBlobs.map((f) => blobs[f]).join(', ')); }

/* 部品を <script> にして並べる。audioFiles：音のファイル名 → 読む場所 */
function scripts(audioFiles) {
  return MODULES.map(([f, note]) => {
    let code = rd(f);
    if (f === 'atlas.js') code += '\nwindow.ATLAS_URL = "' + uri('atlas.webp') + '";';
    if (f === 'audio.js') code += '\nwindow.AUDIO_FILES = ' + JSON.stringify(audioFiles) + ';';
    return '<!-- ' + f + ' ― ' + note + ' -->\n<script>\n' + code + '\n</script>';
  }).join('\n');
}
let page = rd('src/index.src.html').replace(/@@(ui\/[A-Za-z0-9_.]+)@@/g, (m, f) => uri(f));
if (page.indexOf('<!--@@SCRIPTS@@-->') < 0) throw new Error('index.src.html に <!--@@SCRIPTS@@--> がありません');
const html = page.replace('<!--@@SCRIPTS@@-->', () => scripts(embedded));
const htmlArt = page.replace('<!--@@SCRIPTS@@-->', () => scripts(blobs));

fs.mkdirSync(path.join(D, 'dist'), { recursive: true });
fs.writeFileSync(path.join(D, 'dist/artifact.html'), htmlArt);
const reset = '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>';
fs.writeFileSync(path.join(D, 'dist/index.html'), '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' + reset + '</head><body>' + html + '</body></html>');

/* ダウンロード用：ふつうの1枚のHTMLとして書き出す（title・フォント・CSS は <head> へ、画面とプログラムは <body> へ） */
const cut = html.indexOf('</style>') + '</style>'.length;
const headPart = html.slice(0, cut).replace('<meta charset="utf-8">', '').replace(/<meta name="claude:viewport-fit-sides"[^>]*>\s*/, '').trim();
const standalone = '<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + reset + '\n' + headPart + '\n</head>\n<body>\n' + html.slice(cut).trim() + '\n</body>\n</html>\n';
fs.writeFileSync(path.join(D, 'dist/standalone.html'), standalone);
console.log('dist/artifact.html', (htmlArt.length / 1024).toFixed(0) + ' KB  /  dist/index.html（手元確認用）/ dist/standalone.html（ダウンロード用 ' + (standalone.length / 1024).toFixed(0) + ' KB）');
