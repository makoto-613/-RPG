'use strict';
const assert=require('node:assert/strict');
global.window={Puzzle:{}, Battle:{}};
require('../js/system/sections.js');
const dummy=new Proxy({}, {get:(obj,k)=>k==='s10_call'||k==='s10_wait'?['dummy','dummy','dummy']:String(k)});
const RULES={FINAL_NEED:3,K_HIGH:60,K_TALK:20};
let passed=0;
async function runCase(name,sec,choices,expected,opts={}) {
  const state={sec,K:opts.K??0,flags:{short:!!opts.short,finalActions:0,callN:0,waitN:0,attackedDog:false,dogAttacks:0,memoryShown:false,...(opts.flags||{})}};
  const disabled=[];
  const src=choices.slice();
  const G={
    get S(){return state},get stage(){return null},P:dummy,RULES,
    UI:{guard:()=>{}},apply:()=>{},ask:async(_run,_line,items,offs={})=>{
      const id=src.shift();assert.ok(items.includes(id),`${name}: choice ${id} absent`);
      assert.ok(!offs[id],`${name}: choice ${id} disabled: ${offs[id]}`);
      disabled.push(offs);
      return id;},
    play:async()=>{},setMode:()=>{},sfx:()=>{},bgm:()=>{},hud:()=>{},
    signed:()=>'',timerStart:()=>{},toTitle:()=>{},battleHelp:()=>{}
  };
  const secs=window.makeSections(G);
  const result=await secs[sec]({},opts.secOpts||{});
  assert.deepEqual(result,expected,`${name}: ending mismatch`);
  assert.equal(src.length,0,`${name}: unused choices`);
  passed++;
}
(async()=>{
 await runCase('ending1',9,['altar_leave'],{end:'e1'});
 await runCase('short route blocks ending1',9,['altar_take'],{go:10},{short:true});
 await runCase('high K blocks ending1',9,['altar_take'],{go:10},{K:80});
 await runCase('ending2 (karma 21+ -> e2)',10,['call','wait','call','go_home'],{end:'e2'},{K:30});
 await runCase('ending stone-talk (karma 20 or less -> e5)',10,['call','wait','call','go_home'],{end:'e5'},{K:20});
 await runCase('ending sacrifice-flam (all karma-up choices taken -> e6)',10,[],{end:'e6'},{K:80,flags:{kOffered:['cart_flam','cent_flam'],kTaken:['cent_flam','cart_flam']}});
 await runCase('one karma-up choice skipped -> normal return path',10,['sacrifice'],{end:'e3'},{K:50,flags:{kOffered:['cart_flam','cent_flam'],kTaken:['cent_flam']}});
 await runCase('ending3',10,['sacrifice'],{end:'e3'});
 await runCase('ending4',10,['attack','attack'],{end:'e4'});
 console.log('PASS',passed,'end-state and restriction paths');
})().catch(e=>{console.error(e);process.exitCode=1;});
