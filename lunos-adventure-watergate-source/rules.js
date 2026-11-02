/* ==========================================================================
   rules.js ― ゲーム全体の数値と、選択肢の表（ストーリーフロー v6.0「選択肢と分岐」）
   ・CHOICES の label・K（カルマ差）・A（不安差）は、v6.0 の表の文字と数字をそのまま写したものです。
     row は表の行番号。set・hp・once などの「効果」は、表の「HP等の変化」「条件・注記」欄を読んで付けています。
   ・RULES は、表に数字がない（または旧企画案から借りた）部分の数値です。「仮」と書いたものは差し替え前提です。
   ========================================================================== */
window.RULES = {
  // ---- 初期値（仮：v1.1 の旧案に合わせた値。v6.0 の表には初期値の記載がありません） ----
  K_START: 20,            // カルマの初期値
  A_START: 20,            // 不安の初期値
  K_HIGH: 60,             // 高カルマの目安（呼びかけ不可・結末①不可・フラメトが寄ってこない）
  LUNO_HP: 25,            // ルノのHP上限（表：HP回復はルノ25／フラメト35を上限）
  FLAM_HP: 35,            // フラメトのHP上限
  FLAM_INJURY: 8,         // 区画6でフラメトがかばって受ける傷（仮）。HPは最低1
  AFTER_BATTLE_HEAL: { luno: 10, flam: 10 },   // 戦闘が終わったあと少し休んで回復するHP（仮）
  // ---- 展示タイマー（表：20分／残り5分・2分・30秒・0秒に特別処理） ----
  TIMER_SEC: 1200,        // 展示モードの制限時間（秒）
  WARN_AT: 300,           // 残り5分：注意メッセージ
  SHORT_AT: 120,          // 残り2分：第9区画へ短縮ルート
  LAST_AT: 30,            // 残り30秒：最後の選択を促す
  // ---- 区画10「呼びかけ」の不安の下がり方（表：カルマ0〜29:-15／30〜49:-10／50〜59:-5） ----
  CALL_BAND: [[30, -15], [50, -10], [60, -5]],   // [カルマの上限（未満）, 不安の増減]
  FINAL_NEED: 3           // 結末②に必要な「呼びかけ・待機」の合計回数
};
window.RULES.callDelta = function (K) { const b = window.RULES.CALL_BAND; for (let i = 0; i < b.length; i++) if (K < b[i][0]) return b[i][1]; return null; };   // null ＝ 呼びかけ不可（カルマ60以上）

window.CHOICES = {
  enter: { row: 2, sec: 0, label: "廃坑へ入る", K: 0, A: 0, set: { started: true } },
  cart_flam: { row: 5, sec: 1, label: "フラメトを先に登らせる（カルマ＋10）", K: 10, A: 0 },
  cart_together: { row: 6, sec: 1, label: "二人で協力して登る", K: 0, A: 5, set: { cartFailed: true }, once: true },
  cart_luno: { row: 7, sec: 1, label: "ルノが先導して登る", K: 0, A: 0 },
  swim: { row: 8, sec: 2, label: "フラメトを泳がせてスイッチを探させる", K: 10, A: 10 },
  walk: { row: 9, sec: 2, label: "二人で歩ける道を探す", K: 0, A: 0 },
  cent_flam: { row: 10, sec: 3, label: "フラメトを先に向かわせる", K: 10, A: 0 },
  cent_watch: { row: 11, sec: 3, label: "落ち着いて相手の様子を見る", K: 0, A: 0 },
  cent_sneak: { row: 12, sec: 3, label: "こっそり通り抜けようとする", K: 0, A: 5 },
  cent_spare: { row: 13, sec: 3, label: "逃がす（カルマ変化なし）", K: 0, A: 0 },
  cent_chase: { row: 14, sec: 3, label: "追撃する（カルマ＋15）", K: 15, A: 0 },
  mirror_e: { row: 15, sec: 4, label: "反射鏡を東向きに回す（主光路）", K: 0, A: 0, puzzle: true },
  mirror_n: { row: 16, sec: 4, label: "反射鏡を北向きに回す（細い光路）", K: 0, A: 0, puzzle: true },
  hidden_look: { row: 18, sec: 4, label: "開いた隠し部屋を調べる", K: 0, A: 0 },
  journal_take: { row: 19, sec: 4, label: "日誌の切れ端と、水晶のかけらを手に取る", K: 0, A: 0, set: { crystalJournal: true, crystal: true } },
  door_go: { row: 20, sec: 4, label: "開いた通常の扉から先に進む", K: 0, A: 0 },
  diary_read: { row: 21, sec: 5, label: "フラメトと日誌を読み、代償を考える", K: 0, A: 5 },
  diary_skip: { row: 22, sec: 5, label: "怖い話は忘れて先へ急ぐ", K: 5, A: 5 },
  rest_heal: { row: 23, sec: 6, label: "フラメトを休ませ、傷の手当てをする", K: -5, A: -10, hp: { flam: +5 } },
  rest_push: { row: 24, sec: 6, label: "先へ進むため、無理に歩かせる", K: 15, A: 15, hp: { flam: -5 } },
  lamp_c: { row: 25, sec: 7, label: "中央のランプだけを灯す", K: 0, A: 0, set: { lampSolved: true } },
  lamp_go: { row: 28, sec: 7, label: "灯火に導かれて進む", K: 0, A: 0 },
  boss_ready: { row: 29, sec: 8, label: "フラメトと戦いに備える", K: 0, A: 0 },
  boss_escape: { row: 30, sec: 8, label: "まず逃げ道を探してみる", K: 0, A: 5 },
  boss_spare: { row: 31, sec: 8, label: "逃がす（カルマ−5）", K: -5, A: 0 },
  boss_chase: { row: 32, sec: 8, label: "追撃する（カルマ＋15）", K: 15, A: 0 },
  boss_dodge: { row: 33, sec: 8, label: "二人で協力して回避（不安＋5）", K: 0, A: 5 },
  boss_send: { row: 34, sec: 8, label: "フラメトを先行させる（カルマ＋10・不安＋10）", K: 10, A: 10 },
  boss_crystal: { row: 35, sec: 8, label: "◆ 水晶を使う", K: 0, A: 0, set: { crystalUsed: true } },
  altar_leave: { row: 36, sec: 9, label: "石を置き、祖父と話し合うために帰る", K: 0, A: 0 },
  altar_take: { row: 37, sec: 9, label: "命継ぎの石を持ち帰る", K: 0, A: 0, set: { stone: true } },
  call: { row: 38, sec: 10, label: "フラメトに呼びかける", K: 0, A: 0, band: true },
  wait: { row: 39, sec: 10, label: "じっと待つ", K: 0, A: -3 },
  go_home: { row: 40, sec: 10, label: "フラメトと帰る", K: 0, A: 0 },
  attack: { row: 41, sec: 10, label: "フラメトを攻撃する", K: 25, A: 15 },
  sacrifice: { row: 42, sec: 10, label: "自分の命を石にささげる", K: 0, A: 0 },
};
