/* 戦闘が終わったら、操作の練習の吹き出し（#tut）が消えている（本物の画面で、区画3のムカデ戦を最後まで戦う） */
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.LUNOS_CHROMIUM || undefined, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  const pg = await b.newPage({ viewport: { width: 1100, height: 900 } }); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('lunos_adventure_prefs_v2', JSON.stringify({ battleHelpSeen: true })); } catch (e) {} });
  await pg.goto('file://' + path.resolve('dist/standalone.html')); await pg.waitForFunction('window.__ready === true');
  await pg.evaluate(() => { window.UI.TUNE_UI.TYPE_MS = 0; window.UI.TUNE_UI.DLG_GUARD_MS = 0; });
  await pg.click('#btn-new'); await pg.waitForTimeout(400); await pg.click('[data-diff="easy"]'); await pg.waitForTimeout(600);
  await pg.evaluate(() => window.__G.jumpTo(3));
  let sawTip = false, done = false;
  for (let i = 0; i < 4000 && !done; i++) {
    const st = await pg.evaluate(() => ({ mode: window.UI.getMode(), bt: window.Battle.active(), w: window.UI.waiting(), tip: !document.getElementById('tut').hidden, ch: [...document.querySelectorAll('#choices .ch:not([aria-disabled="true"])')].map((x) => x.dataset.id) }));
    if (st.mode === 'battle' && st.tip) sawTip = true;
    if (sawTip && st.mode === 'novel') { await pg.waitForTimeout(300); done = true; break; }
    if (st.mode === 'battle' && st.bt) {
      await pg.evaluate(() => {   // 近ければ杖、射程なら石弾、だめならターン終了（吹き出しは「わかった」も「とばす」も押さない）
        const Bt = window.Battle, R = Bt.Rules, B = Bt.state(); if (Bt.locked() || !B || B.over) return;
        for (const c of ['staff', 'stone']) if (!R.why[c](B)) { setTimeout(() => Bt.command(c)); return; }
        if (!R.why.move(B)) { const t = R.bfs(B, B.luno.x, B.luno.y, B.moveLeft); let best = null, bd = 99;
          Object.keys(t).forEach((k) => { const [x, y] = k.split(',').map(Number); if (!t[k].d) return; const d = Math.abs(x - B.en.x) + Math.abs(y - B.en.y); if (d >= 1 && d < bd) { bd = d; best = [x, y]; } });
          if (best && bd < Math.abs(B.luno.x - B.en.x) + Math.abs(B.luno.y - B.en.y)) { setTimeout(() => Bt.move(best[0], best[1])); return; } }
        setTimeout(() => Bt.command('end'));
      });
      await pg.waitForTimeout(60); continue;
    }
    if (st.w) { await pg.keyboard.press('Enter'); await pg.waitForTimeout(25); continue; }
    if (st.ch.length) { await pg.click(`#choices .ch[data-id="${st.ch.includes('cent_watch') ? 'cent_watch' : st.ch[0]}"]`); await pg.waitForTimeout(40); continue; }
    await pg.waitForTimeout(40);
  }
  const tipAfter = await pg.evaluate(() => !document.getElementById('tut').hidden);
  await b.close();
  const ok = sawTip && done && !tipAfter && !errs.length;
  console.log((ok ? 'PASS' : 'FAIL') + `: 戦闘中に吹き出しが出た=${sawTip}、戦闘が終わった=${done}、終わったあとも出ている=${tipAfter}`, errs);
  if (!ok) process.exitCode = 1;
})();
