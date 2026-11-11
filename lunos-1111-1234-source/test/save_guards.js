const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('js/system/game.js','utf8');
function chunk(start,next) {
 const a=source.indexOf(start),b=source.indexOf(next,a+start.length);
 assert(a>=0&&b>a, 'source extraction');
 return source.slice(a,b);
}
const check = chunk('function isValidSave(d) {','  const validSave =');
const base={
  v:2, S:{mode:'free',diff:'normal',sec:3,flags:{},log:[],K:20,A:20,lh:25,fh:35},
  entry:{mode:'free',diff:'normal',sec:3,flags:{},log:[],K:20,A:20,lh:25,fh:35},
  progress:null, rem:null
};
const {isValidSave}=vm.runInNewContext(`(function(){${check};return {isValidSave}})()`,{RULES:{LUNO_HP:25,FLAM_HP:35,TIMER_SEC:1200},secOf:(n)=>[0,1,3,4,5,6,7,8,9,10].includes(n),Number,isRecord:x=>x!==null&&typeof x==='object'&&!Array.isArray(x)});
assert(isValidSave(base));
for (const id of ['s0','s1','s4','s7']) assert(isValidSave({...base,progress:{kind:'puzzle',sec:3,sid:id,puzzleS:{}}}));
// 消した区画2（水門）の途中のデータは使わない
assert(!isValidSave({...base,S:{...base.S,sec:2},entry:{...base.entry,sec:2}}));
assert(!isValidSave({...base,progress:{kind:'puzzle',sec:3,sid:'s2',puzzleS:{}}}));
for (const kind of ['centipede','boss']) assert(isValidSave({...base,progress:{kind:'battle',sec:3,battleKind:kind,battleState:{}}}));
assert(!isValidSave({...base,progress:{kind:'puzzle',sec:3,sid:'s999',puzzleS:{}}}));
assert(!isValidSave({...base,progress:{kind:'battle',sec:3,battleKind:'unknown',battleState:{}}}));
assert(!isValidSave({...base,rem:-1}));
assert(!isValidSave({...base,entry:{...base.entry,diff:'hard'}}));
assert(!isValidSave({...base,entry:{...base.entry,mode:'expo'}}));
const timerCode=chunk('function timerTick() {','  // 残り2分');
let time=4000,triggered=0,uiRem=-1;
const env={
 T:{on:true,rem:2,last:0,fired:{300:true,120:true,30:true}},
 S:{ended:false},RULES:{WARN_AT:300,SHORT_AT:120,LAST_AT:30},
 performance:{now:()=>time},UI:{timer:n=>{uiRem=n},banner:()=>{}},P:{t_warn:'',t_last:''},
 sfx:()=>{},shortRoute:()=>{throw new Error('unexpected short route')},timeUp:()=>{triggered++}
};
vm.runInNewContext(`${timerCode};timerTick()`,env);
assert.strictEqual(env.T.rem,0);
assert.strictEqual(uiRem,0);
assert.strictEqual(triggered,1);
vm.runInNewContext(`${timerCode};timerTick()`,env);
assert.strictEqual(triggered,1);
console.log('PASS stage6 save ID validation and expo timer clamp');
