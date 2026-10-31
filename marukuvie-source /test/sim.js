/* 戦闘のバランス確認：単純な作戦（近づいて杖・石弾）で何回も戦わせ、結果の割合を見る */
global.window = { RULES: null }; require('../rules.js'); require('../battle_rules.js');
const R = window.BattleRules.Rules; const kind = process.argv[2] || 'boss', K = +(process.argv[3] || 20), A0 = +(process.argv[4] || 20);
const out = {}; let hpL = 0, hpF = 0;
for (let seed = 1; seed <= 400; seed++) {
  let s = seed * 7919; const rng = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const B = R.newBattle({ kind, luHP: 25, flHP: 30, A: A0, K, rng, stones: 3, flamAdvance: seed % 2 });
  for (let i = 0; i < 40 && !B.over; i++) {
    if (!R.why.staff(B)) R.doStaff(B); else if (!R.why.stone(B)) R.doStone(B);
    if (!B.acted && !R.why.move(B)) { const t = R.bfs(B, B.luno.x, B.luno.y, B.moveLeft); let best = null, bd = R.manh(B.luno, B.en);
      Object.keys(t).forEach((k) => { const [x, y] = k.split(',').map(Number); const d = Math.abs(x - B.en.x) + Math.abs(y - B.en.y) + (R.inTele(B, x, y) ? 9 : 0); if (d >= 1 && d < bd) { bd = d; best = [x, y]; } });
      if (best) R.doMove(B, best[0], best[1]); if (!R.why.staff(B)) R.doStaff(B); else if (!R.why.stone(B)) R.doStone(B); }
    if (!B.over) R.endTurn(B);
  }
  const t = B.over ? B.over.type + (B.over.who ? ':' + B.over.who : '') : 'none'; out[t] = (out[t] || 0) + 1; hpL += B.luno.hp; hpF += B.flam.hp;
}
console.log(kind, 'K' + K, 'A' + A0, out, 'avgHP L', (hpL / 400).toFixed(1), 'F', (hpF / 400).toFixed(1));
