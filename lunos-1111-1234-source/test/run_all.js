/* すべての自動テストを順に動かす。使い方：node build.js のあとで node test/run_all.js
   どれか1つでも失敗したら、最後に「失敗」と出て、終了コードが 1 になります */
const { spawnSync } = require('child_process'); const path = require('path');
const TESTS = [
  ['rules_node.js', '戦闘のルール（画面なし）'],
  ['battle_invariants.js', '戦闘：どの難易度・作戦でも、数値がおかしくならない（画面なし）'],
  ['hp_call.js', '戦闘：HPの上限と、呼びかけでフラメトが寄ってくる（画面なし）'],
  ['ending_branches.js', '結末に行く条件と、選べない選択肢（画面なし）'],
  ['save_guards.js', '保存データの確かめと、展示モードの時間の範囲（画面なし）'],
  ['timer_thresholds.js', '展示モードのタイマー：残り5分・2分・30秒の境目（画面なし）'],
  ['timer_20min.js', '展示モードのタイマー：20分を通して数える（画面なし）'],
  ['character_art.js', 'キャラクターの絵：向き・ポーズの絵がそろっている（画面なし）'],
  ['enemy_art.js', '敵の絵：8枚とも描ける（画面なし）'],
  ['visual_state.js', '廃坑の入口・机や祭壇や枕元の石など、進み具合で変わる物の見た目（画面なし）'],
  ['levels_check.js', '謎解きの盤面が、どの難易度でも解ける（画面なし）'],
  ['tut_after_battle.js', '戦闘が終わったら、操作の練習の吹き出しが消える'],
  ['diff_ui.js', '難易度を選べる・途中で変わらない・つづきからでも同じ'],
  ['e2e.js', '最初から最後まで遊ぶ（結末①〜⑥、ふつう・むずかしいでも）'],
  ['herd_quit.js', '羊追いの難易度の目安・タイトルへ戻る・棄権（中断の結末）・操作の練習'],
  ['restart_resume.js', 'ブラウザを開き直したあとの「つづきから」（序章・謎解き・戦闘の途中）'],
  ['timer.js', '展示モードのタイマー（残り5分・2分・30秒・時間切れ）'],
  ['audio_real.js', 'BGM が鳴り、場面で切り替わる'],
  ['se_real.js', '効果音がすべて読み込める'],
  ['se_cut.js', '長い効果音が、台詞を送ると止まる']
];
let bad = 0;
for (const [f, what] of TESTS) {
  const t0 = Date.now(), r = spawnSync('node', ['--max-old-space-size=6000', path.join(__dirname, f)], { encoding: 'utf8', timeout: 900000 });
  const out = (r.stdout || '') + (r.stderr || ''), fail = r.status !== 0 || /NG |Error|error:/.test(out);
  if (fail) bad++;
  console.log((fail ? '✗ ' : '✓ ') + f + '（' + what + '）' + Math.round((Date.now() - t0) / 1000) + '秒');
  if (fail) console.log(out.split('\n').slice(-15).join('\n'));
}
console.log(bad ? '失敗 ' + bad + ' 件' : 'すべて成功'); process.exitCode = bad ? 1 : 0;
