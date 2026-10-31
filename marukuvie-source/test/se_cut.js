// 効果音を前もって読み込めるか／台詞を送ると長い効果音が止まるか／長さの上限で止まるか
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const root = path.resolve(__dirname, '../dist');
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.mp3') ? 'audio/mpeg' : 'text/html' }); fs.createReadStream(f).pipe(r); }).listen(8765);
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const u of ['http://localhost:8765/index.html', 'http://localhost:8765/artifact.html']) {
    const pg = await b.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.goto(u); await pg.waitForFunction('window.__ready === true');
    await pg.mouse.click(5, 5); await pg.waitForTimeout(2500);
    const loaded = await pg.evaluate(() => window.Sound.seLoaded());
    await pg.click('#btn-new'); await pg.waitForTimeout(800);
    await pg.evaluate(() => { window.UI.TUNE_UI.TYPE_MS = 0; });
    // 長い音（ゴゴゴゴ）を鳴らしてから、台詞を送る
    const r1 = await pg.evaluate(async () => { window.Sound.sfx('item'); await new Promise((r) => setTimeout(r, 300)); const a = window.Sound.seActive(); const ok = window.UI.waiting(); window.UI.advance(); window.UI.advance(); await new Promise((r) => setTimeout(r, 400)); return { before: a, waiting: ok, after: window.Sound.seActive() }; });
    // 上限：push（0.9秒で止まる）
    const r2 = await pg.evaluate(async () => { window.Sound.sfx('push'); await new Promise((r) => setTimeout(r, 300)); const a = window.Sound.seActive(); await new Promise((r) => setTimeout(r, 1000)); return { during: a, after: window.Sound.seActive() }; });
    console.log(u.split('/').pop(), 'loaded', loaded, r1, r2, errs); await pg.close();
  }
  await b.close(); srv.close();
})();
