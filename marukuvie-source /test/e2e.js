/* 本物の画面で最後まで遊ぶ自動テスト。PLAN の選び方で結末ごとに通す */
const { chromium } = require('playwright'); const path = require('path');
const makeCore = require('../core.js'), LV = require('../levels.js'); const C = makeCore(LV);
const KEYS = { U: 'ArrowUp', D: 'ArrowDown', L: 'ArrowLeft', R: 'ArrowRight' };
const results = []; const ok = (n, c, x) => { results.push((c ? 'OK ' : 'NG ') + n + ' ' + (x || '')); if (!c) process.exitCode = 1; };
async function botTurn(pg) {   // 戦闘：近ければ杖、射程なら石弾、だめなら近づく→ターン終了
  return pg.evaluate(async () => {
    const Bt = window.Battle, R = Bt.Rules, B = Bt.state(); if (!Bt.active() || Bt.locked() || !B || B.over) return 'wait';
    const pref = B.kind === 'boss' && B.crystal && window.__useCrystal ? ['crystal'] : [];
    for (const c of pref.concat(['staff', 'stone'])) if (!R.why[c](B)) { setTimeout(() => Bt.command(c)); return c; }
    if (!R.why.move(B)) { const t = R.bfs(B, B.luno.x, B.luno.y, B.moveLeft); let best = null, bd = 99;
      Object.keys(t).forEach((k) => { const [x, y] = k.split(',').map(Number); if (!t[k].d) return; const d = Math.abs(x - B.en.x) + Math.abs(y - B.en.y) + (R.inTele(B, x, y) ? 9 : 0); if (d >= 1 && d < bd) { bd = d; best = [x, y]; } });
      if (best && bd < Math.abs(B.luno.x - B.en.x) + Math.abs(B.luno.y - B.en.y)) { setTimeout(() => Bt.move(best[0], best[1])); return 'move'; } }
    if (!R.why.calm(B) && B.A >= 30) { setTimeout(() => Bt.command('calm')); return 'calm'; }
    setTimeout(() => Bt.command('end')); return 'end';
  });
}
async function settle(pg, plan, log) {
  for (let i = 0; i < 3000; i++) {
    const st = await pg.evaluate(() => ({ ch: [...document.querySelectorAll('#choices .ch:not([aria-disabled="true"])')].map((b) => b.dataset.id), w: window.UI.waiting(), dlg: !document.getElementById('veil').hidden, mode: window.UI.getMode(), pz: window.Puzzle.active() && !window.Puzzle.busy(), bt: window.Battle.active(), title: document.getElementById('scr-play').hidden }));
    if (st.title) return 'title';
    if (st.dlg) { const t = await pg.evaluate(() => document.getElementById('dlg').innerText); if (/ゲームオーバー/.test(t)) { log.push('GAMEOVER'); await pg.waitForTimeout(500); await pg.click('[data-a="retry"]'); continue; } return t; }
    if (st.w) { await pg.keyboard.press('Enter'); await pg.waitForTimeout(25); continue; }
    if (st.ch.length) { let want = st.ch[0]; for (let q = 0; q < plan.length; q++) if (st.ch.includes(plan[q])) { want = plan[q]; plan.splice(q, 1); break; } log.push(want); await pg.click(`#choices .ch[data-id="${want}"]`); await pg.waitForTimeout(40); continue; }
    if (st.mode === 'puzzle' && st.pz) {
      const { sid, s } = await pg.evaluate(() => ({ sid: window.Puzzle.P.sid, s: JSON.parse(JSON.stringify(window.Puzzle.P.s)) }));
      const goal = sid === 's4' && global.window_hidden && !s.bonus ? (x) => x.bonus && C.MODS.s4.solved(LV.s4, x) : (x) => C.MODS[sid].solved(LV[sid], x);
      const r = C.bfs(sid, LV[sid], s, goal, { limit: 3000000 }); if (!r.path) throw new Error('解なし ' + sid);
      log.push(sid + ':' + r.path.length);
      for (const a of r.path) { for (let k = 0; k < 400; k++) { const f = await pg.evaluate(() => !window.Puzzle.busy() && !window.UI.waiting() && !document.querySelector('#choices .ch')); if (f) break; await settleOnce(pg, plan, log); } if (!(await pg.evaluate(() => window.Puzzle.active()))) break; await pg.keyboard.press(KEYS[a]); await pg.waitForTimeout(20); }
      continue;
    }
    if (st.mode === 'battle' && st.bt) { const r = await botTurn(pg); if (r === 'move') { await pg.evaluate(() => window.__G); } await pg.waitForTimeout(r === 'wait' ? 60 : 30); continue; }
    await pg.waitForTimeout(40);
  }
  throw new Error('settle: 終わらない');
}
async function settleOnce(pg, plan, log) {
  const st = await pg.evaluate(() => ({ ch: [...document.querySelectorAll('#choices .ch:not([aria-disabled="true"])')].map((b) => b.dataset.id), w: window.UI.waiting() }));
  if (st.w) { await pg.keyboard.press('Enter'); await pg.waitForTimeout(25); return; }
  if (st.ch.length) { let want = st.ch[0]; for (let q = 0; q < plan.length; q++) if (st.ch.includes(plan[q])) { want = plan[q]; plan.splice(q, 1); break; } log.push(want); await pg.click(`#choices .ch[data-id="${want}"]`); await pg.waitForTimeout(40); return; }
  await pg.waitForTimeout(30);
}
const CASES = [
  { name: '結末①', mode: '#btn-new', plan: ['crash_check', 'cart_together', 'cart_luno', 'walk', 'cent_watch', 'cent_spare', 'hidden_look', 'journal_take', 'door_go', 'diary_read', 'rest_heal', 'boss_ready', 'boss_spare', 'boss_dodge', 'altar_leave'], want: /石に頼らない未来/ },
  { name: '結末②', mode: '#btn-new', plan: ['crash_check', 'cart_luno', 'walk', 'cent_watch', 'cent_spare', 'door_go', 'diary_read', 'rest_heal', 'boss_ready', 'boss_spare', 'boss_dodge', 'altar_take', 'call', 'wait', 'call', 'go_home'], want: /三つの命/ },
  { name: '結末③', mode: '#btn-new', plan: ['cart_flam', 'swim', 'cent_flam', 'cent_chase', 'door_go', 'diary_skip', 'rest_push', 'boss_escape', 'boss_chase', 'boss_send', 'altar_take', 'sacrifice'], want: /少年の贈り物/ },
  { name: '結末④（水晶を使う）', mode: '#btn-new', crystal: true, plan: ['cart_luno', 'walk', 'cent_watch', 'cent_chase', 'hidden_look', 'journal_take', 'door_go', 'diary_read', 'rest_heal', 'boss_ready', 'altar_take', 'attack'], want: /帰らない羊飼い/ }
];
(async () => {
  const b = await chromium.launch();
  for (const cs of CASES) {
    const pg = await b.newPage({ viewport: { width: 1100, height: 900 } }); const errs = [];
    pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|ERR_/.test(m.text())) errs.push(m.text()); });
    await pg.addInitScript(() => { let s = 12345; window.__rng = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); try { localStorage.clear(); } catch (e) {} });
    await pg.goto('file://' + (process.env.GAME_HTML || path.resolve(__dirname, '../dist/index.html')));
    await pg.waitForFunction('window.__ready === true'); await pg.evaluate((c) => { window.UI.TUNE_UI.TYPE_MS = 0; window.__useCrystal = c; }, !!cs.crystal);
    await pg.click(cs.mode); const log = [];
    let t0 = Date.now(), res; global.window_hidden = cs.plan.includes('hidden_look');
    try { res = await settle(pg, cs.plan.slice(), log); } catch (e) { res = 'ERR ' + e.message; }
    const G = await pg.evaluate(() => ({ K: window.__G.S.K, A: window.__G.S.A, f: window.__G.S.flags }));
    ok(cs.name, cs.want.test(res) && !errs.length, `K${G.K} A${G.A} ${((Date.now() - t0) / 1000).toFixed(0)}s ${errs.join('|')}`);
    console.log('  ', log.join(' '), '| bossResolve=' + G.f.bossResolve, 'crystal=' + G.f.crystal);
    await pg.screenshot({ path: 'test/shots/end_' + CASES.indexOf(cs) + '.png' }); await pg.close();
  }
  console.log(results.join('\n')); await b.close();
})();
