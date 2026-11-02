global.window = { RULES: null }; require('../rules.js'); require('../battle_rules.js');
const R = window.BattleRules.Rules;
for (const kind of ['centipede', 'boss']) {
  let s = 7; const rng = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const B = R.newBattle({ kind, luHP: 25, flHP: 35, A: 20, K: 20, rng, stones: 3 });
  for (let i = 0; i < 30 && !B.over; i++) {
    console.log(kind, 'turn', B.turn, 'en', B.en.hp, B.en.x, B.en.y, 'L', B.luno.x, B.luno.y, B.luno.hp, 'F', B.flam.x, B.flam.y, B.flam.hp);
    if (!R.why.staff(B)) R.doStaff(B); else if (!R.why.stone(B)) R.doStone(B);
    R.endTurn(B);
  }
  console.log(kind, 'over', JSON.stringify(B.over));
}
