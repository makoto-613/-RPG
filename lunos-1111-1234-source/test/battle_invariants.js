/* Stage5: deterministic rule invariants across all three difficulties and both enemies. */
'use strict';
const assert=require('node:assert/strict');
global.window={RULES:{LUNO_HP:25,FLAM_HP:35}};
require('../js/battle/battle_rules.js');
const R=window.BattleRules.Rules;
let trials=0, turns=0, outcomes={};
for(const diff of ['easy','normal','hard']) for(const kind of ['centipede','boss']) {
  for(let seed=1; seed<=120;seed++) {
    let state=seed*31+(kind==='boss'?137:0);
    const rng=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
    const b=R.newBattle({kind,diff,luHP:25,flHP:35,A:seed%100,K:seed*7%100,stones:3,rng,crystal:(seed%2===0)});
    assert.equal(b.en.max,b.spec.hp);
    let i=0;
    while(!b.over&&i++<80) {
      let done=false;
      for(const cmd of ['staff','stone','crystal','calm','guard','call']) {
        const f=R.why[cmd], act=R['do'+cmd[0].toUpperCase()+cmd.slice(1)];
        if(typeof f!=='function'||typeof act!=='function') continue;
        if(!f(b)) {act(b);done=true;break;}
      }
      if(!done&&!R.why.guard(b))R.doGuard(b);
      R.endTurn(b);turns++;
      for(const [label,hp,max] of [['luno',b.luno.hp,25],['flam',b.flam.hp,35],['enemy',b.en.hp,b.spec.hp]]) {
        assert.ok(Number.isFinite(hp)&&hp>=0&&hp<=max, `${diff} ${kind} #${seed}: bad ${label} HP ${hp}`);
      }
      assert.ok(Number.isFinite(b.A)&&b.A>=0&&b.A<=100, `${diff}/${kind}: bad A ${b.A}`);
      assert.ok(Number.isFinite(b.K)&&b.K>=0&&b.K<=100, `${diff}/${kind}: bad K ${b.K}`);
      assert.ok(Number.isInteger(b.turn)&&b.turn>=1&&b.turn<=80,`${diff}/${kind}: turn ${b.turn}`);
      if(kind==='boss') assert.ok(b.turn<=b.maxTurns,`boss overturn ${b.turn}`);
    }
    assert.ok(b.over, `no termination diff=${diff}, kind=${kind}, seed=${seed}`);
    const key=`${diff}/${kind}/${b.over.type}`;outcomes[key]=(outcomes[key]||0)+1;trials++;
  }
}
console.log('PASS: '+trials+' battles, '+turns+' turns, HP/K/A bounds, boss turn limit');
console.log(JSON.stringify(outcomes));
