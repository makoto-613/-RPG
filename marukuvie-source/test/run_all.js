/* すべての自動テストを順に動かす。使い方：node build.js のあとで node test/run_all.js
   どれか1つでも失敗したら、最後に「失敗」と出て、終了コードが 1 になります */
const { spawnSync } = require('child_process'); const path = require('path');
const TESTS = [
  ['rules_node.js', '戦闘のルール（画面なし）'],
  ['e2e.js', '最初から最後まで遊ぶ（結末①〜④）'],
  ['timer.js', '展示モードのタイマー（残り5分・2分・30秒・時間切れ）'],
  ['pz_choice.js', '謎解きの中の選択肢（パソコン・スマホ）'],
  ['audio_real.js', 'BGM が鳴り、場面で切り替わる'],
  ['se_real.js', '効果音がすべて読み込める'],
  ['se_cut.js', '長い効果音が、台詞を送ると止まる']
];
let bad = 0;
for (const [f, what] of TESTS) {
  const t0 = Date.now(), r = spawnSync('node', [path.join(__dirname, f)], { encoding: 'utf8', timeout: 900000 });
  const out = (r.stdout || '') + (r.stderr || ''), fail = r.status !== 0 || /NG |Error|error:/.test(out);
  if (fail) bad++;
  console.log((fail ? '✗ ' : '✓ ') + f + '（' + what + '）' + Math.round((Date.now() - t0) / 1000) + '秒');
  if (fail) console.log(out.split('\n').slice(-15).join('\n'));
}
console.log(bad ? '失敗 ' + bad + ' 件' : 'すべて成功'); process.exitCode = bad ? 1 : 0;
