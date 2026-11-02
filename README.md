# Luno's Adventure 〜オフェリの石と選択〜（ノベル・謎解き・戦闘版）

（旧題：マルクヴィエ物語）

ブラウザで遊ぶ、1枚の HTML のゲームです。部品（`*.js`）・画像・音を `build.js` でまとめて作ります。

## 作り方・確かめ方

```
node build.js            # dist/ に artifact.html（公開用）・index.html（確認用）・standalone.html（ダウンロード用）を作る
node test/run_all.js     # 自動テストをすべて動かす（数分かかります）
```

## ファイルの役割（読み込まれる順）

| ファイル | 中身 |
|---|---|
| `atlas.js` | ドット絵の切り出し位置（画像は `assets/atlas.webp`） |
| `rules.js` | カルマ・不安・HP・タイマーの数値と、選択肢の表（v6.0「選択肢と分岐」） |
| `levels.js` | 謎解きの盤面（区画1・2・4・7）。難易度ごと（easy／normal／hard） |
| `core.js` | 謎解きのルール（画面に依存しない。自動テストでも使う） |
| `story.js` | 台詞・場面の指定・謎解きの文。`p:1` が付いた文は「仮」 |
| `audio.js` | BGM・効果音の設定（シートから作る） |
| `sound.js` | BGM・効果音を鳴らす |
| `render.js` | 謎解きの盤面の絵 |
| `enemy.js` | 敵の絵（ムカデ・トゲイモムシ） |
| `stage_data.js` | ノベルの場面のデータ：見た目の調整値・ポーズ・場面の一覧 |
| `stage_paint.js` | 廃坑の入口の一枚絵（ゲーム内とタイトル画面） |
| `stage.js` | ノベルの場面の描画：背景・立ち絵・演出・スマホでの見せ方 |
| `shell.js` | 画面の部品：台詞の枠・選択肢・ダイアログ・状態の表示 |
| `puzzle.js` | 謎解きの進行：操作・ヒント・やり直し |
| `battle_rules.js` | 戦闘の数値とルール・敵とフラメトのAI（画面に依存しない） |
| `battle.js` | 戦闘の画面 |
| `sections.js` | 序章と区画1〜10の流れ |
| `game.js` | ゲーム全体の土台：状態・台詞の再生・タイマー・結末・保存・メニュー |
| `src/index.src.html` | 画面の HTML と CSS（プログラムは build.js が差し込む） |

新しいファイルを足すときは、`build.js` の `MODULES` に1行足します。

## よく触る場所

- 台詞を直す：`story.js`（またはセリフ修正シート → `tools/apply_sheet.py`）
- 選択肢のカルマ・不安の増減：`rules.js` の `CHOICES`
- 場面の背景・小物・立ち位置の見た目：`stage_data.js`
- 謎解きの盤面：`levels.js` の easy／normal／hard（変えたら `node test/levels_check.js` で解けるか確かめる）。目標とヒントの文は `story.js` の `puz`（難易度ごとの文は `diff`）
- 難易度の名前と説明：`story.js` の `diffs`
- 戦闘の数値：`battle_rules.js` の先頭の `BT`。難易度ごとの敵の強さは `ENEMY_DIFF`
- BGM・効果音：BGM・効果音シート → `tools/make_audio_js.py` か `tools/audio_from_dump.py`、音のファイルは `assets/audio/`（新しい音を足すと、`node build.js` が公開用の置き場所 `dist/audio/` と `audio_blobs.json` に自動で書き足します）

各ファイルの先頭に「★ 調整用の数値」があり、日本語のコメント付きで数値だけ変えられます。

## 道具（tools/）

| ファイル | 使い道 |
|---|---|
| `export_lines.js` → `make_sheet.py` | セリフ修正シート（xlsx）を作る |
| `apply_sheet.py` | 直したセリフ修正シート（xlsx）を story.js・rules.js に戻す |
| `apply_dump.py` | Googleスプレッドシートから書き出したテキストで、セリフを差し替える |
| `make_audio_sheet.py` | BGM・効果音シート（xlsx）を作る |
| `make_audio_js.py` / `audio_from_dump.py` | BGM・効果音シート（xlsx／書き出したテキスト）から audio.js を作る |
| `audio_def.py` | BGM・効果音の「場所」の一覧（シートと audio.js の元） |

## テスト（test/）

`run_all.js` がまとめて動かします。ほかに、見た目を確かめる道具があります。

- `snapshot.js` と `snapcmp.py`：時間と乱数を止めて全場面を撮り、作り直す前と後を比べる（`node test/snapshot.js 出力先` → `python3 test/snapcmp.py 前 後`）
- `allscenes.js`：物語の全場面を撮る（`node test/allscenes.js 1280 800 pc`）
- `sim.js`：戦闘のバランスを、何回も戦わせて確かめる（`node test/sim.js boss 20 20 hard` のように難易度も指定できる）
