const assert=require('assert');
const fs=require('fs'); const vm=require('vm');
const sandbox={window:{},console};vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('js/novel/visual_state.js','utf8'),sandbox);
const V=sandbox.window.VisualState;
const snap=(sc,f={},l={})=>V.snapshot(sc,f,l);
// 家（夜・机）：机の上の石は、取ると消える
assert.equal(snap('house_night_desk').houseDeskCleared, false);
assert.equal(snap('house_night_desk',{}, {deskOff:true}).houseDeskCleared, true);
// Mine gate is initially closed and remains unlocked after save/restart.
assert.equal(snap('mine_gate').mineGateOpen,false);
assert.equal(snap('mine_gate',{}, {gate:'gate_unlocked'}).mineGateOpen,true);
assert.equal(snap('mine_gate',{mineGateUnlocked:true}).mineGateOpen,true);
// Altar stone is taken from the same scene without changing its stage backdrop.
assert.equal(snap('altar').altarStonePresent,true);
assert.equal(snap('altar',{}, {altarStoneTaken:true}).altarStonePresent,false);
assert.equal(snap('altar',{stone:true}).altarStonePresent,false);
// Pillow stone only on its existing scene.
assert.equal(snap('house_stone',{}, {pillowStone:true}).pillowStonePresent,true);
assert.equal(snap('house_in',{}, {pillowStone:true}).pillowStonePresent,false);
assert.equal(V.STATEFUL_SCENES.length,5);
const stage=fs.readFileSync('js/novel/stage.js','utf8');
const story=fs.readFileSync('js/system/sections.js','utf8');
assert(stage.includes('markAltarStoneTaken()'));
assert(story.includes('stage.markAltarStoneTaken()'));
assert(stage.includes("spr('life_stone', x, y, (F.stone[2]"), '祭壇の石は、家の石と同じ命継ぎの石の絵を重ねる');
console.log('PASS: 5 stateful scene names, state assertions and stage hooks');
