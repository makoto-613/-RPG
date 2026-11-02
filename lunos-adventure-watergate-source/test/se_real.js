// すべての効果音（場合ちがい・何種類かから選ぶ音も）を実際に読み込んで、鳴らせるか確かめる
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const f of ['index.html', 'artifact.html']) {
    const pg = await b.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') errs.push(m.text()); });
    await pg.goto('file://' + path.resolve(__dirname, '../dist/' + f)); await pg.waitForFunction('window.__ready === true');
    await pg.mouse.click(5, 5); await pg.waitForTimeout(500);
    const r = await pg.evaluate(async () => {
      const SE = window.AUDIO.SE, out = [], names = new Set();
      for (const k in SE) { const e = SE[k]; [e.file, ...Object.values(e.alt || {}), ...(e.pick || [])].forEach((x) => names.add(x)); }
      for (const n of names) {
        const url = window.AUDIO_FILES[n]; if (!url) { out.push([n, 'なし']); continue; }
        const a = new Audio(url); a.muted = true;
        const ok = await new Promise((res) => { a.oncanplaythrough = () => res('ok ' + a.duration.toFixed(2) + 's'); a.onerror = () => res('ERR'); setTimeout(() => res('timeout'), 5000); a.load(); });
        out.push([n, ok]);
      }
      Object.keys(SE).forEach((k) => window.Sound.sfx(k)); window.Sound.sfx('gauge', 'good'); window.Sound.sfx('item', 'hidden');
      return out;
    });
    console.log(f, r.filter((x) => !x[1].startsWith('ok')).length === 0 ? '全' + r.length + '個 OK' : r, errs.filter((e) => !/ERR_TUN|net::/.test(e)));
    await pg.close();
  }
  await b.close();
})();
