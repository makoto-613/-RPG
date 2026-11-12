# Luno's Adventure 〜オフェリの石と選択〜

ブラウザで遊ぶ、1枚の HTML のゲームです（物語・謎解き・戦闘）。部品（`js/` の中の `*.js`）・見た目（`src/style.css`）・画像・音を `build.js` でまとめて作ります。

## 作り方・確かめ方

```
node build.js            # dist/ に standalone.html（展示・ダウンロード用）・index.html（確認用）・artifact.html（公開ページ用）を作る
node test/run_all.js     # 自動テストをすべて動かす（十数分かかります）
npx prettier --write "js/**/*.js" build.js src/style.css   # コードの改行・字下げを整える（設定は .prettierrc.json）
```

遊ぶときは `dist/standalone.html` をブラウザで開きます（画像も音も中に入っています）。

## フォルダの分け方（機能ごと）

```
src/            画面の HTML（index.html）と見た目（style.css）
js/data/        数値・台詞・盤面・音の設定など、直すことの多い「表」
js/art/         キャラクター・敵の絵の読み込みと描き方
js/system/      ゲーム全体の土台：音・画面の部品・操作の練習・区画の流れ・状態と保存とメニュー
js/novel/       物語の場面（背景・立ち絵・演出）
js/puzzle/      謎解き（ルール・盤面の絵・操作）
js/battle/      戦闘（ルール・画面）
assets/         画像・音
  atlas.webp      ドット絵の小物（羊・砂袋・トロッコ・命継ぎの石など。切り出し位置は js/data/atlas.js）
  character_hd/   謎解き・戦闘で歩くルノ・フラメトの絵（walk_*）と、台詞の枠の顔（idle・determined など）
  character_novel/ 物語の会話の場面の立ち絵（ルノ・アルボ・アミーナは全身の絵、フラメトは頭と胸の絵 flam_*_cut）
  enemies_hd/     ムカデ・トゲイモムシの絵
  novel_bg/       物語の場面の背景（場面の名前.webp。同じ絵を使う場面は stage.js の BG_ALIAS）
  puzzle_bg/      謎解きの盤面の一枚絵（s0 羊追い・s1 トロッコ・s4 水晶・s7 灯火。絵の中の範囲は render.js の ART）
  battle_bg/      戦闘の盤面の一枚絵（敵の種類.webp。ムカデ戦 centipede と、トゲイモムシ戦 boss。範囲は battle.js の ARENA）
  ui/             ボタン・枠・タイトル画面の絵
  audio/          BGM・効果音
test/           自動テスト（run_all.js がまとめて動かす）
tools/          スプレッドシートとのやり取りの道具
```

## ファイルの役割（読み込まれる順。順番は build.js の `MODULES`）

| ファイル | 中身 |
|---|---|
| `js/data/atlas.js` | ドット絵の切り出し位置（画像は `assets/atlas.webp`） |
| `js/art/chars.js` | 人物の絵の読み込み（`assets/character_hd` と、物語の立ち絵 `assets/character_novel`）。下向きに歩く絵の切りかえ（`downFrame`） |
| `js/data/rules.js` | カルマ・不安・HP・タイマーの数値と、選択肢の表 |
| `js/data/levels.js` | 謎解きの盤面（序章の羊追い・区画1・4・7。中の番号）。難易度ごと（easy／normal／hard） |
| `js/puzzle/core.js` | 謎解きのルール（画面に依存しない。自動テストでも使う） |
| `js/data/story.js` | 台詞・場面の指定・謎解きの文・操作の練習の文。`p:1` が付いた文は「仮」 |
| `js/data/audio.js` | BGM・効果音の設定 |
| `js/system/sound.js` | BGM・効果音を鳴らす |
| `js/puzzle/render.js` | 謎解きの盤面の絵 |
| `js/art/enemy.js` | 敵の絵 |
| `js/novel/visual_state.js` | 廃坑の入口・机や祭壇や枕元の石など、進み具合で見た目が変わる物の状態 |
| `js/data/stage_data.js` | 物語の場面のデータ：見た目の調整値・場面の一覧 |
| `js/novel/stage.js` | 物語の場面の描画：背景・立ち絵・演出 |
| `js/system/shell.js` | 画面の部品：台詞の枠・選択肢・ダイアログ・右上の表示・懐中時計 |
| `js/system/tutorial.js` | 操作の練習（各ゲームのはじめの吹き出し） |
| `js/puzzle/puzzle.js` | 謎解きの進行：操作・ヒント・やり直し・途中の保存 |
| `js/battle/battle_rules.js` | 戦闘の数値とルール・敵とフラメトの動き（画面に依存しない） |
| `js/battle/battle.js` | 戦闘の画面 |
| `js/system/sections.js` | 序章と区画の流れ（中の番号は1・3〜10。区画2は11月11日に削除。画面では区画1〜9と表示） |
| `js/system/dialogs.js` | ダイアログの中身（メニュー・確認・羊追いの結果・戦い方の説明）の文と並び |
| `js/system/game.js` | ゲーム全体の土台：状態・台詞の再生・タイマー・結末・保存・メニューのボタンの動き |
| `src/index.html` | 画面の HTML（見た目とプログラムは build.js が差し込む） |
| `src/style.css` | 画面の見た目（CSS） |

新しいファイルを足すときは、`build.js` の `MODULES` に1行足します。

## よく触る場所

- 台詞を直す：`js/data/story.js`（またはセリフ集のシート → `tools/apply_sheet.py`）
- 選択肢のカルマ・不安の増減：`js/data/rules.js` の `CHOICES`
- 場面の背景・小物・立ち位置の見た目：`js/data/stage_data.js`（会話の場面の立ち絵の大きさ・位置は `VN_` で始まる数値）
- 台詞の枠（物語）：`src/style.css` の末尾。枠の絵は `assets/ui/novel_dialogue.webp`（名札つき）・`novel_narration.webp`（地の文）
- 謎解きの盤面：`js/data/levels.js`（変えたら `node test/levels_check.js` で解けるか確かめる）。目標とヒントの文は `js/data/story.js` の `puz`（難易度ごとの文は `diff`）
- 羊追いの結果（難易度の目安）の境目：`js/data/rules.js` の `HERD_UP`・`HERD_DOWN`・`HERD_SLOW_SEC`
- 戦闘の数値：`js/battle/battle_rules.js` の先頭の `BT`。難易度ごとの敵の強さは `ENEMY_DIFF`
- 操作の練習の文：`js/data/story.js` の `tut`。出し方は `js/system/tutorial.js`
- BGM・効果音：音のファイルは `assets/audio/`。設定は `js/data/audio.js`（シートの書き出し → `tools/audio_from_dump.py`）。新しい音を足すと、`node build.js` が公開用の置き場所 `dist/audio/` と `audio_blobs.json` に自動で書き足します

各ファイルの先頭に「★ 調整用の数値」があり、日本語のコメント付きで数値だけ変えられます。

## 道具（tools/）

| ファイル | 使い道 |
|---|---|
| `export_lines.js` | ゲームの中の文を一覧にして出す（セリフ集のシートを作り直すとき） |
| `export_stage.js` | 場面の背景・小物・立ち位置を一覧にして出す（場面と配置のシート用） |
| `apply_sheet.py` | セリフ集のシートを xlsx で書き出したものから、「修正後」の文を story.js・rules.js に戻す |
| `scenes.js` | 場面の名前の一覧（`export_lines.js`・`export_stage.js` が使う） |
| `audio_from_dump.py` | 音のシートを書き出したテキストから、audio.js を作り直す（場面の ID は audio.js にあるもの） |

## テスト（test/）

`run_all.js` がまとめて動かします。ブラウザを開く・ページを開く・台詞を進めるなどの共通の部分は `lib.js` にあります。ほかに、作り直す前と後の見た目を比べる道具があります。

- `snapshot.js` と `snapcmp.py`：時間と乱数を止めて、物語の全場面・謎解き・戦闘を撮り、前と後を比べる（`node test/snapshot.js 出力先` → `python3 test/snapcmp.py 前 後`）

## 変更の記録

これまでの修正の記録は [`CHANGES.md`](CHANGES.md) にあります。
