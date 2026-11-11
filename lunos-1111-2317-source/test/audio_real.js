const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const f of ['index.html', 'artifact.html']) {
    const pg = await b.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() !== 'log') errs.push(m.text()); });
    await pg.goto('file://' + path.resolve(__dirname, '../dist/' + f)); await pg.waitForFunction('window.__ready === true');
    await pg.mouse.click(5, 5); await pg.waitForTimeout(1500);
    const r = await pg.evaluate(() => { const e = window.Sound.state.el; return { file: window.Sound.state.file, playing: e && !e.paused, t: e && e.currentTime, vol: e && e.volume, src: e && e.src.slice(0, 40) }; });
    await pg.click('#btn-new'); await pg.waitForTimeout(500); await pg.click('[data-diff="easy"]'); await pg.waitForTimeout(1200);
    const r2 = await pg.evaluate(() => ({ file: window.Sound.state.file, playing: !window.Sound.state.el.paused }));
    console.log(f, r, r2, errs.filter((e) => !/TUNNEL|Failed to load resource: net::ERR_TUN/.test(e)));
    await pg.close();
  }
  await b.close();
})();
