/* 謎解きの盤面が、どの難易度でも解けるかを確かめる（画面なし）。手数と「考えどころの数」も出す
   考えどころ：区画1＝砂袋・トロッコを押す回数／区画2＝レバーを踏む回数／区画4＝鏡を回す回数／区画7＝火を灯す回数 */
const makeCore = require('../core.js'), LV = require('../levels.js');
const KEY = { s1: (e) => e.t === 'push' || e.t === 'slot', s2: (e) => e.t === 'lever', s4: (e) => e.t === 'rot', s7: (e) => e.t === 'light' };
let bad = 0; const rows = [];
for (const d of ['easy', 'normal', 'hard']) {
  const C = makeCore(LV[d]);
  for (const sid of ['s1', 's2', 's4', 's7']) {
    const L = LV[d][sid], M = C.MODS[sid], s0 = M.init(L);
    const r = C.bfs(sid, L, s0, (s) => M.solved(L, s), { limit: 3000000 });
    if (!r.path) { bad++; rows.push(`NG ${d} ${sid} 解けない`); continue; }
    let s = s0, n = 0; for (const a of r.path) { const o = M.step(L, s, a); if (o.ev.some(KEY[sid])) n++; s = o.s; }
    let extra = '';
    if (sid === 's1') {   // 「二人で登る」で崩れたあとも、積み直せるか
      const rl = C.bfs(sid, L, s0, (x) => x.locked, { limit: 3000000 }); let t = s0; for (const a of rl.path) t = M.step(L, t, a).s;
      const rc = C.bfs(sid, L, M.collapse(L, t), (x) => M.solved(L, x), { limit: 3000000 }); if (!rc.path) { bad++; extra = ' 積み直しNG'; } else extra = ' 積み直し' + rc.path.length + '手';
    }
    if (sid === 's4') { const rb = C.bfs(sid, L, s0, (x) => x.bonus && M.solved(L, x), { limit: 3000000 }); if (!rb.path) { bad++; extra = ' 隠し部屋NG'; } else extra = ' 隠し部屋も開けて' + rb.path.length + '手'; }
    if (sid === 's2') { const q = M.prep(L).q; let t = s0, hit = false; for (const a of r.path) { t = M.step(L, t, a).s; if (t.px === q[0] && t.py === q[1]) hit = true; } if (!hit) { bad++; extra = ' 水たまりの入口を通らない'; } }
    rows.push(`OK ${d.padEnd(6)} ${sid} 最短${String(r.path.length).padStart(3)}手 考えどころ${String(n).padStart(3)} 調べた状態${String(r.states).padStart(8)}${extra}`);
  }
}
console.log(rows.join('\n'));
if (bad) { console.log('解けない盤面があります'); process.exitCode = 1; }
