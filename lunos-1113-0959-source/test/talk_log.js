// 会話ログ：台詞・選んだ選択肢・区画の区切りが残る／開くと一番下（最後の台詞）が見える／L・Esc で開け閉め／「つづきから」でも続き、二重に残らない
// 使い方：node test/talk_log.js
const T = require('./lib'); const path = require('path'); const fs = require('fs');
const open = (dir) => T.openPersistent(dir, process.argv[2]);
const adv = (pg, until, n = 200) => T.advance(pg, until, n);
const talk = (pg) => pg.evaluate(() => (window.__G.S.talk || []).slice());
const NG = [];
const ok = (c, m) => { if (!c) NG.push(m); };
(async () => {
  const dir = path.resolve(__dirname, 'shots/profile_talk'); fs.rmSync(dir, { recursive: true, force: true });
  let { ctx, pg, errs } = await open(dir);
  await pg.click('#btn-new'); await pg.waitForTimeout(500); await pg.click('[data-diff="easy"]'); await pg.waitForTimeout(800);
  // 区画5（休憩所）の選択肢まで進めて、選んだあとの台詞を2つ読む
  await pg.evaluate(() => window.__G.jumpTo(5));
  await adv(pg, async () => !!(await pg.$('#choices .ch')));
  await pg.click('#choices .ch'); await pg.waitForTimeout(300);
  for (let i = 0; i < 2; i++) { await pg.keyboard.press('Enter'); await pg.waitForTimeout(200); }
  await pg.waitForTimeout(2500); // 演出の待ちが終わって、台詞が出たままになるまで
  const t1 = await talk(pg);
  ok(t1.some((e) => e.sec === 0 && e.h === '序章'), '序章の区切りがない');
  ok(t1.some((e) => e.sec === 5), '区画の区切り（休憩所）がない');
  ok(t1.some((e) => e.ch), '選んだ選択肢が残っていない');
  ok(t1.some((e) => e.w === 'jrn'), '日誌の台詞が残っていない');
  ok(t1.filter((e) => e.sec === 5).length === 1, '区切りが二重');
  // L で開く → 一番下が見えている → Esc で閉じる
  await pg.keyboard.press('l'); await pg.waitForTimeout(300);
  const v = await pg.evaluate(() => { const l = document.getElementById('log-list'); return { open: !document.getElementById('logv').hidden, bottom: Math.abs(l.scrollHeight - l.clientHeight - l.scrollTop) < 4, n: l.children.length, last: l.lastElementChild && l.lastElementChild.textContent }; });
  ok(v.open, 'L で開かない'); ok(v.bottom, '開いたときに一番下が見えていない'); ok(v.n === t1.length, 'ログの数と表示の数がちがう');
  const lineNow = await pg.evaluate(() => document.getElementById('mtext').textContent);
  ok(v.last && v.last.includes(lineNow.split('\n')[0]), '一番下が、いま出ている台詞ではない');
  await pg.screenshot({ path: path.join(__dirname, 'shots/talk_log_open.png') });
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
  ok((await pg.evaluate(() => document.getElementById('mtext').textContent)) === lineNow, 'ログを開いている間に Enter で台詞が進んだ');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => document.getElementById('logv').hidden), 'Esc で閉じない');
  ok(!(await pg.evaluate(() => !document.getElementById('veil').hidden)), 'Esc でメニューまで開いた');
  // ボタンで開いて、右クリックで閉じる
  await pg.click('#btn-log'); await pg.waitForTimeout(200);
  ok(!(await pg.evaluate(() => document.getElementById('logv').hidden)), 'ボタンで開かない');
  await pg.click('#logv .lh', { button: 'right' }); await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => document.getElementById('logv').hidden), '右クリックで閉じない');
  // ブラウザを開き直して「つづきから」：ログが続き、同じ区画の分が二重にならない
  await ctx.close();
  ({ ctx, pg, errs } = await open(dir));
  await pg.click('#btn-cont'); await pg.waitForTimeout(1500);
  await adv(pg, async () => !!(await pg.$('#choices .ch')));
  const t2 = await talk(pg);
  ok(t2.some((e) => e.sec === 0), 'つづきからで、前のログが消えた');
  ok(t2.filter((e) => e.sec === 5).length === 1, 'つづきからで、区切りが二重');
  const rows = t2.filter((e) => e.w).map((e) => e.t), dup = rows.filter((t, i) => t === rows[i - 1]);
  const sec5 = t2.slice(t2.findIndex((e) => e.sec === 5)).filter((e) => e.w);
  ok(new Set(sec5.map((e) => e.t)).size >= sec5.length - 2, 'つづきからで、区画の台詞が二重に残った');
  console.log(NG.length ? 'NG ' + NG.join(' / ') : 'PASS 会話ログ', 'entries', t1.length, '->', t2.length, 'dup', dup.length, 'errs', errs);
  await ctx.close();
  if (NG.length) process.exitCode = 1;
})();
