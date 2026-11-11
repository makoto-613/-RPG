// Final-gate non-browser regression tests for countdown crossings.
'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/system/game.js','utf8');
const a=source.indexOf('function timerTick() {'),b=source.indexOf('  // 残り2分：',a);
assert(a>=0&&b>a);
const timer=source.slice(a,b);
const code=`${timer}; timerTick();`;
function run({rem,elapsed,sec=2,marks={}}) {
 let endings=0,short=0,warnings=[],signals=[];
 let now=elapsed*1000;
 const env={
  T:{on:true,rem,last:0,fired:{...marks}},S:{sec,ended:false},RULES:{WARN_AT:300,SHORT_AT:120,LAST_AT:30},
  performance:{now:()=>now},UI:{timer:()=>{},banner:(m)=>warnings.push(m)},
  P:{t_warn:'5',t_last:'30'},sfx:x=>signals.push(x),
  shortRoute:()=>{short++},timeUp:()=>{endings++}
 };
 vm.runInNewContext(code,env);
 return {endings,short,warnings,signals,remaining:env.T.rem,marks:env.T.fired,env};
}
let r=run({rem:301,elapsed:2});
assert.equal(r.remaining,299);assert.equal(r.endings,0);assert.equal(r.short,0);assert.deepEqual(r.warnings,['5']);
r=run({rem:121,elapsed:2,marks:{300:true}});
assert.equal(r.short,1);assert.equal(r.endings,0);
r=run({rem:31,elapsed:2,marks:{300:true,120:true}});
assert.equal(r.short,1);assert.equal(r.endings,0);assert.deepEqual(r.warnings,['30']);
r=run({rem:301,elapsed:400});
assert.equal(r.remaining,0);assert.equal(r.endings,1);assert.equal(r.short,0);
assert.equal(r.warnings.length,0);
r=run({rem:200,elapsed:175,marks:{300:true}});
assert.equal(r.short,1);assert.equal(r.endings,0);
assert.equal(r.warnings.length,0); // 30-sec notice can fire at next update
// No double transition while timer still running but zero already handled.
r=run({rem:0,elapsed:1,marks:{0:true,300:true,120:true,30:true}});
assert.equal(r.endings,0);assert.equal(r.short,0);
console.log('PASS final timer cross-threshold regressions: 6 cases');
