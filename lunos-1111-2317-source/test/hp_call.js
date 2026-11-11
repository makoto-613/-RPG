/* 回帰テスト：呼びかけ誘導、HPの下限、燭台の難易度 */
'use strict';
const assert = require('node:assert/strict');
global.window = {};
require('../js/data/levels.js');
require('../js/puzzle/core.js');
require('../js/battle/battle_rules.js');
const R = window.BattleRules.Rules;
const b = R.newBattle({kind:'centipede',diff:'easy',luHP:19,flHP:33,A:10,K:20,rng:()=>0.99});
b.flam.x = 5; b.flam.y = 5;
const dist = () => R.manh(b.flam,b.luno);
const before = dist();
assert.equal(R.doCall(b).ok,true);
assert.equal(b.flam.callTurns,2);
R.endTurn(b);
assert.ok(dist()<before,`呼びかけ後に距離が縮まらない: ${before} → ${dist()}`);
assert.equal(b.flam.callTurns,1);
const d1=dist();
if (!b.over) { R.endTurn(b); assert.ok(dist()<=d1); assert.equal(b.flam.callTurns,0); }
const z = R.newBattle({kind:'boss', diff:'easy',luHP:0,flHP:0,A:0,K:0});
assert.equal(z.luno.hp,0);
assert.equal(z.flam.hp,0);
const e = R.newBattle({kind:'boss', diff:'easy',luHP:999,flHP:999,A:0,K:0});
assert.equal(e.luno.hp,25);
assert.equal(e.flam.hp,35);
console.log('OK: HP正規化 / 呼びかけ2ターン誘導');
