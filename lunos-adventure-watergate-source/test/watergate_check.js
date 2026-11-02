/* Node単体回帰テスト：水たまりはイベントなし・隠しスイッチは踏むと作動 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
global.window = {};
const LV = require('../levels.js'), makeCore = require('../core.js');
require('../story.js');
const c = makeCore(LV.easy);
for (const diff of ['easy', 'normal', 'hard']) {
  const L = LV[diff].s2, M = c.MODS.s2, p = M.prep(L), s = M.init(L);
  assert.ok(p.q && p.sw && p.gate);
  const q = M.step(L, { ...s, px: p.q[0]-1, py: p.q[1] }, 'R');
  assert.ok(!q.ev.some(e => e.t === 'trigger'), 'Qマスでは選択肢を出さない');
  const k = M.step(L, { ...s, px: p.sw[0]-1, py: p.sw[1] }, 'R');
  assert.ok(k.s.open, 'Kを踏むと水門が開く');
  assert.ok(k.ev.some(e => e.t === 'switch'));
}
const render = fs.readFileSync(path.join(__dirname, '../render.js'), 'utf8');
assert.ok(render.includes('if (s.open) {'), '作動後だけスイッチ板を表示');
assert.ok(!render.includes("ctx.strokeText('水門スイッチ'"), 'スイッチの場所を露骨に示すラベルは表示しない');
const shell = fs.readFileSync(path.join(__dirname, '../shell.js'), 'utf8');
assert.ok(shell.includes("$('mmeta').textContent = ''"), '原稿・S04などの管理情報を表示しない');
console.log('OK: 水門3難易度／入室選択肢／隠しスイッチ／メタ情報');
