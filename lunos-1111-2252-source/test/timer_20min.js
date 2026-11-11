// 20-min timer accelerated by virtual clock: the real timerTick is executed 1201 times
'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync('js/system/game.js','utf8');
const a=source.indexOf('function timerTick() {');
const b=source.indexOf('  // 残り2分：',a);
assert(a>=0&&b>a);
const code=source.slice(a,b);
let now=0, warnings=[], short=0, ended=0;
const env={
 T:{on:true,rem:1200,last:0,fired:{}},S:{sec:1,ended:false},
 RULES:{WARN_AT:300,SHORT_AT:120,LAST_AT:30},
 performance:{now:()=>now},UI:{timer:()=>{},banner:x=>warnings.push([Math.round(env.T.rem),x])},
 P:{t_warn:'WARN_5_MIN',t_last:'WARN_30_SEC'},
 sfx:()=>{},
 shortRoute:()=>{short++; env.S.sec=9;},
 timeUp:()=>{ended++;env.T.on=false;}
};
vm.runInNewContext(`${code}; this.nextTick=timerTick;`,env);
for(let sec=1;sec<=1201;sec++){
 now=sec*1000;
 env.nextTick();
}
assert.equal(env.T.rem,0);
assert.equal(ended,1);
assert.equal(short,1);
assert.deepEqual(warnings.map(x=>x[1]),['WARN_5_MIN','WARN_30_SEC']);
assert.equal(env.T.fired[300],true);
assert.equal(env.T.fired[120],true);
assert.equal(env.T.fired[30],true);
assert.equal(env.T.fired[0],true);
console.log('PASS virtual 20-minute continuous countdown: warnings, shortcut, timeout');
