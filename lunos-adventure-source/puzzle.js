/* ==========================================================================
   puzzle.js ― 謎解き（区画1 トロッコと砂袋／区画2 水路と水門／区画4 鏡と水晶／区画7 灯火の間）の進行
   盤面のルールは core.js、絵は render.js、物語の側の反応は sections.js から渡される「hooks」が受け持ちます。
   謎の名前（s1・s2・s4・s7）は、区画の番号と同じです。
   ========================================================================== */
(function () {
  'use strict';

  /* ★ 調整用の数値（ここを書き換えると遊び心地が変わります） */
  const TUNE_P = {
    MOVE_SPEED: 9,        // キャラクターが歩く速さ（マス／秒）
    REPEAT_DELAY: 280,    // 方向ボタンを押し続けたとき、連続移動が始まるまでの時間（ミリ秒）
    REPEAT_MS: 125,       // 連続移動の間隔（ミリ秒）
    AUTO_MS: 170,         // 「答えを自動で見る」の1手あたりの時間（ミリ秒）
    BUMP_MS: 170,         // ぶつかったとき、体が揺れる長さ（ミリ秒）
    SWIPE_PX: 26          // 盤面をなぞって動かすとき、何ピクセル以上で一歩とみなすか
  };

  const $ = (id) => document.getElementById(id);
  const UI = window.UI, STORY = window.STORY, LEVELS = window.LEVELS, sfx = (n, v) => window.Sound.sfx(n, v);   // LEVELS：{ easy, normal, hard }（難易度ごとの盤面）
  const core = makeCore(LEVELS.easy), MODS = core.MODS;
  const COLH = ['#3fb6c4', '#eaa83a', '#dc6a86'];
  const nowMs = () => performance.now();
  const sleep = UI.sleep, CANCEL = UI.CANCEL;

  const P = { sid: null, diff: 'easy', L: null, M: null, s: null, base: null, hist: [], moves: 0, vis: null, fx: [], flags: {}, run: null, busy: false, shake: null, fade: null, active: false, hooks: null, done: false };
  let R = null, auto = null, last = 0;

  const mkEnt = (x, y, dir) => ({ x, y, tx: x, ty: y, dir: dir || 'D', ph: 0, moving: false, pose: null, shk: 0, swim: false, lift: 0, over: false });
  function stepEnt(e, dt) {
    const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy);
    if (d < 1e-4) { e.x = e.tx; e.y = e.ty; e.moving = false; return; }
    const m = Math.min(d, TUNE_P.MOVE_SPEED * (e.speed || 1) * dt);
    e.x += dx / d * m; e.y += dy / d * m; e.ph += m; e.moving = true;
    e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U');
  }
  function updVis(dt) {
    const V = P.vis; if (!V) return;
    stepEnt(V.luno, dt); stepEnt(V.flam, dt);
    if (V.sheep) V.sheep.forEach((e) => stepEnt(e, dt));
    if (V.sheep) V.sheep = V.sheep.filter((e) => !(e.pen && !e.moving && e.x === e.tx && e.y === e.ty));   // 小屋に入った羊は、入口まで歩いてから消える
    if (P.sid === 's1') {
      const tr = V.trolley, d = tr.tx - tr.x; tr.x = Math.abs(d) < 0.01 ? tr.tx : tr.x + Math.sign(d) * Math.min(Math.abs(d), TUNE_P.MOVE_SPEED * 0.9 * dt);
      V.bags.forEach((b) => { const dx = b.tx - b.x, dy = b.ty - b.y, dd = Math.hypot(dx, dy); if (dd < 0.01) { b.x = b.tx; b.y = b.ty; } else { const m = Math.min(dd, TUNE_P.MOVE_SPEED * 0.9 * dt); b.x += dx / dd * m; b.y += dy / dd * m; } });
      V.bags = V.bags.filter((b) => !(b.absorb != null && b.x === b.tx && b.y === b.ty));
    }
  }
  function freeNeighbor(x, y) {
    const rows = P.L.rows;
    for (const d of ['D', 'L', 'R', 'U']) {
      const nx = x + core.DIRS[d][0], ny = y + core.DIRS[d][1]; if (nx < 0 || ny < 0 || nx >= 11 || ny >= 9) continue;
      if ('#XoG'.indexOf(rows[ny][nx]) >= 0) continue;
      if (P.sid === 's7' && P.M.prep(P.L).pos[rows[ny][nx]]) continue;   // 燭台の上には置かない
      return [nx, ny];
    }
    return [x, y];
  }
  // 論理の状態に合わせて見た目の目標を決める。snap が真なら即座に移す（戻す・やり直し・開始時）
  function syncVis(snap) {
    const V = P.vis, s = P.s, sid = P.sid;
    const put = (e, x, y) => { e.tx = x; e.ty = y; if (snap) { e.x = x; e.y = y; e.moving = false; } };
    put(V.luno, s.px, s.py);
    if (snap) { const f = freeNeighbor(s.px, s.py); put(V.flam, f[0], f[1]); }
    if (sid === 's0' && snap) V.sheep = s.sh.map((q) => mkEnt(q[0], q[1], 'L'));
    if (sid === 's1' && snap) { V.trolley.tx = V.trolley.x = s.tx; V.bags = s.bags.map((b) => ({ x: b[0], y: b[1], tx: b[0], ty: b[1] })); }
    if (snap) { V.luno.pose = null; V.flam.pose = null; V.luno.over = V.flam.over = false; V.luno.lift = V.flam.lift = 0; V.flam.swim = false; }
  }

  /* ---------------- 効果 ---------------- */
  const fxSpark = (x, y, n, c) => { for (let i = 0; i < n; i++) P.fx.push({ k: 'spark', x, y, vx: (Math.random() - 0.5) * 1.5, vy: -Math.random() * 1.1, t0: nowMs(), life: 450 + Math.random() * 350, c: c || '#ffe9a8', r: 0.05 + Math.random() * 0.04 }); };
  const fxRing = (x, y, c) => P.fx.push({ k: 'ring', x, y, t0: nowMs(), life: 650, c: c || '#fff3c0', r0: 0.1, r1: 0.62 });
  const shakeScreen = (ms, amp) => { P.shake = { until: nowMs() + ms, ms, amp }; };
  const sys = (t) => UI.sys(t);
  // 謎解きの文。難易度ごとに違う文（story.js の puz.〇〇.diff）があれば、そちらを使う
  const PT = () => { const b = STORY.puz[P.sid]; return Object.assign({}, b, (b.diff || {})[P.diff]); };
  const idle = () => UI.sys('目標：' + PT().goal);

  async function walkPath(run, e, pts, opt) {
    opt = opt || {};
    for (const p of pts) {
      UI.guard(run); e.tx = p[0]; e.ty = p[1];
      if (opt.swim) { const c = P.L.rows[Math.round(p[1])] && P.L.rows[Math.round(p[1])][Math.round(p[0])]; e.swim = '123abc'.indexOf(c) >= 0; }
      await UI.until(run, () => !e.moving && e.x === e.tx && e.y === e.ty, 4000);
      await UI.wait(run, opt.pause || 0);
    }
    e.swim = false;
  }

  /* ---------------- 状態の表示（盤面の上の札） ---------------- */
  function updateChips() {
    if (!P.sid) return;
    const s = P.s, L = P.L, sid = P.sid, p = P.M.prep(L), out = [];
    const c = (t, cls) => out.push('<span class="chip ' + (cls || '') + '">' + t + '</span>');
    c('手数 ' + P.moves);
    if (sid === 's0') {
      const m = P.M.prep(L).sheep.length; c('小屋の羊 ' + s.inn + '／' + m, s.inn === m ? 'good' : '');
    } else if (sid === 's1') {
      const n = s.filled.filter(Boolean).length;
      c('足場 ' + n + '／' + s.filled.length, n === s.filled.length ? 'good' : ''); c(s.locked ? 'トロッコ 固定' : 'トロッコ 未固定', s.locked ? 'good' : ''); c(s.chock ? '車輪止め あり' : '車輪止め なし', s.chock ? '' : 'good');
    } else if (sid === 's2') {
      [0, 1, 2].forEach((i) => c('<i class="dot" style="background:' + COLH[i] + '"></i>水路' + '①②③'[i] + '　' + (s.w[i] ? '高い' : '低い')));
      c(s.open ? '水門 開' : '水門 閉', s.open ? 'good' : '');
    } else if (sid === 's7') {
      const on = p.ids.filter((id) => s.on[id]).length; c('灯っている火 ' + on); c(s.on.M ? '扉 開' : '扉 閉', s.on.M ? 'good' : '');
    } else if (sid === 's4') {
      const lc = P.M.litCount(L, s.ms); c('光った水晶 ' + lc.n + '／' + p.cry.length, s.open ? 'good' : ''); c(s.open ? '通常の扉 開' : '通常の扉 閉', s.open ? 'good' : ''); c(s.bonus ? '隠し部屋 開' : '隠し部屋 閉', s.bonus ? 'good' : '');
    }
    $('chips').innerHTML = out.join('');
  }

  /* ---------------- 操作 ---------------- */
  function act(a) {
    if (P.busy || !P.active || !P.run || P.run.dead) return;
    const prev = P.s, V = P.vis;
    const r = P.M.step(P.L, P.s, a);
    const who = V.luno;
    if (a !== 'S') who.dir = a;
    if (!r.changed) { onBump(r, who); return; }
    P.hist.push({ s: prev, moves: P.moves }); if (P.hist.length > 500) P.hist.shift();
    P.s = r.s; P.moves++;
    V.luno.tx = r.s.px; V.luno.ty = r.s.py;
    if (r.moved) { V.flam.tx = prev.px; V.flam.ty = prev.py; }
    const tasks = [];
    handleEvents(r.ev, prev, r.s, tasks, a);
    updateChips();
    if (tasks.length) runTasks(tasks);
  }
  function onBump(r, who) {
    who.shk = nowMs() + TUNE_P.BUMP_MS;
    const ev = r.ev[0]; if (!ev || ev.t !== 'bump') return;
    const fx = STORY.puz[P.sid].fx.bump[ev.k]; sfx('bump');
    const t = typeof fx === 'function' ? fx(ev.ch) : fx; if (t) sys(t);
  }
  function runTasks(tasks) {
    const run = P.run; P.busy = true;
    (async () => {
      try { for (const t of tasks) { await t(run, api); } }
      catch (e) { if (e !== CANCEL) { console.error(e); } }
      finally { if (P.run === run && !run.dead) P.busy = false; }
    })();
  }

  /* ---------------- 出来事（イベント）ごとの反応 ---------------- */
  function handleEvents(evs, prev, s, tasks, a) {
    const sid = P.sid, S = STORY.puz[sid], V = P.vis, p = P.M.prep(P.L), H = P.hooks || {};
    evs.forEach((e) => {
      if (sid === 's0') {
        const sh = V.sheep.find((q) => !q.pen && q.tx === e.from[0] && q.ty === e.from[1]);
        if (e.t === 'herd' || e.t === 'dodge') { if (sh) { sh.tx = e.to[0]; sh.ty = e.to[1]; } sfx('push'); if (e.t === 'dodge') sys(S.fx.dodge); }
        else if (e.t === 'pen') { if (sh) { sh.tx = e.to[0]; sh.ty = e.to[1]; sh.pen = true; } sfx('bark'); fxSpark(e.to[0], e.to[1] - 0.3, 10, '#ffe9a8'); fxRing(e.to[0], e.to[1], '#fff3c0'); sys(S.fx.pen(e.n, e.m)); }
        else if (e.t === 'win') { if (H.win) tasks.push(H.win); }
        return;
      }
      if (sid === 's1') {
        if (e.t === 'chock') { sfx('click'); sys(S.fx.chock); fxSpark(p.chock[0], p.chock[1] - 0.2, 6, '#e9c98a'); }
        else if (e.t === 'push' && e.k === 'trolley') { V.trolley.tx = e.to; sfx('push'); }
        else if (e.t === 'push' && e.k === 'bag') { const b = V.bags.find((q) => q.tx === e.from[0] && q.ty === e.from[1]); if (b) { b.tx = e.to[0]; b.ty = e.to[1]; } sfx('push'); }
        else if (e.t === 'slot') { const b = V.bags.find((q) => q.tx === e.from[0] && q.ty === e.from[1]); if (b) { b.tx = e.to[0]; b.ty = e.to[1]; b.absorb = e.i; } sfx('plate'); fxSpark(e.to[0], e.to[1] - 0.2, 8, '#ffe9a8'); sys(S.fx.slot(s.filled.filter(Boolean).length, s.filled.length)); }
        else if (e.t === 'locked') { sfx('plate'); sys(S.fx.locked); fxRing(p.goal[0], p.goal[1], '#ffe08a'); }
        else if (e.t === 'ready') { if (H.ready) tasks.push(H.ready); }
      } else if (sid === 's2') {
        if (e.t === 'lever') { sfx('lever'); sys(S.fx.lever); fxRing(s.px, s.py, '#8fdcff'); fxSpark(s.px, s.py, 8, '#bfe9ff'); }
        else if (e.t === 'switch') { sfx('open'); sys(S.fx.switch); P.flags.swKnown = true; fxRing(s.px, s.py, '#ffe08a'); shakeScreen(500, 0.012); }
        else if (e.t === 'trigger') { if (!P.flags.c03 && H.trigger) tasks.push(H.trigger); }
        else if (e.t === 'win') { if (H.win) tasks.push(H.win); }
      } else if (sid === 's4') {
        if (e.t === 'rot') { sfx('rot'); }
        else if (e.t === 'lit') { if (P.flags.lastLit !== e.n) { sys(S.fx.lit(e.n, e.of)); if (P.flags.lastLit != null && e.n > P.flags.lastLit) sfx('lit'); } P.flags.lastLit = e.n; }
        else if (e.t === 'open') { fxRing(p.exit[0], p.exit[1], '#ffe08a'); p.cry.forEach((q) => fxSpark(q[0], q[1] - 0.4, 6, '#bfe9ff')); sfx('open'); if (H.open) tasks.push(H.open); }
        else if (e.t === 'bonus') { sfx('item', 'hidden'); const q = p.bon[0]; fxSpark(q[0], q[1] - 0.4, 12, '#a8ffd0'); if (H.bonus) tasks.push(H.bonus); }
        else if (e.t === 'win') { if (H.win) tasks.push(H.win); }
      } else if (sid === 's7') {
        const pos = p.pos;
        if (e.t === 'light') {
          if (e.id !== 'M') sfx('lit');   // まんなかのランプは、扉が開く音（謎が解けたときと同じ音）を鳴らす
          const q = pos[e.id]; fxRing(q[0], q[1] - 0.3, '#ffcf7a'); fxSpark(q[0], q[1] - 0.6, 10, '#ffd98a');
          e.off.forEach((o) => { const r = pos[o]; fxSpark(r[0], r[1] - 0.5, 6, '#9aa0c8'); });
          sys(S.fx.light(e.id, e.off));
        }
        else if (e.t === 'open') { sfx('win'); fxRing(p.door[0], p.door[1], '#ffe08a'); sys(S.fx.open); if (H.open) tasks.push(H.open); }
        else if (e.t === 'close') { sfx('warn'); sys(S.fx.close); }
        else if (e.t === 'win') { if (H.win) tasks.push(H.win); }
      }
    });
  }

  /* ---------------- 戻す・やり直し・ヒント・答え ---------------- */
  function undo() {
    if (P.busy || !P.active || !P.hist.length) return;
    const h = P.hist.pop(); P.s = h.s; P.moves = h.moves; P.flags.lastLit = null; syncVis(true); updateChips(); sfx('click'); sys('ひとつ戻した。');
  }
  function reset() {
    if (P.busy || !P.active) return;
    P.s = core.cl(P.base); P.hist = []; P.moves = 0; P.flags.lastLit = null; syncVis(true); updateChips(); sfx('click'); sys('やり直した。');
  }
  function hint() {
    if (P.busy || !P.active) return;
    const hs = PT().hints, n = P.flags.hintN % hs.length; P.flags.hintN++;
    sfx('click'); sys('ヒント ' + (n + 1) + '／' + hs.length + '：' + hs[n]);
  }
  async function autoSolve() {
    if (P.busy || !P.active) return;
    const run = P.run, id = P.sid; UI.closeVeil(); sys('答えを探しています……');
    await sleep(40);
    const r = core.bfs(id, P.L, P.s, (x) => MODS[id].solved(P.L, x), { limit: 3000000 });
    if (!r.path) { sys('この状態からは出口へ行けない。「やり直す」を押そう。'); return; }
    if (auto) auto.dead = true; const me = auto = { dead: false };
    sys('答えを自動で見せている。止めるには、どれかのキーやボタンを押そう。（' + r.path.length + '手）');
    for (const a of r.path) {
      while (P.busy && !me.dead && !run.dead) await sleep(80);
      if (me.dead || run.dead || !P.active) break;
      act(a); await sleep(TUNE_P.AUTO_MS);
    }
    if (auto === me) auto = null;
  }
  const stopAuto = () => { if (auto) { auto.dead = true; auto = null; } };

  /* ---------------- 入力（ゲーム全体のキー・タップから呼ばれる） ---------------- */
  let lastAct = 0;
  const KEYMAP = { ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R', w: 'U', s: 'D', a: 'L', d: 'R', W: 'U', S: 'D', A: 'L', D: 'R' };
  function key(e) {
    if (!P.active) return false;
    const k = e.key;
    if (KEYMAP[k]) {
      e.preventDefault(); stopAuto();
      if (e.repeat && nowMs() - lastAct < TUNE_P.REPEAT_MS) return true;
      lastAct = nowMs(); act(KEYMAP[k]); return true;
    }
    if (k === 'z' || k === 'Z') { stopAuto(); undo(); return true; }
    if (k === 'r' || k === 'R') { stopAuto(); reset(); return true; }
    if (k === 'h' || k === 'H') { hint(); return true; }
    return false;
  }
  function swipe(dx, dy) { stopAuto(); act(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U')); }
  function bindPad() {
    let timer = null, rep = null;
    const stop = (btn) => { clearTimeout(timer); clearInterval(rep); timer = rep = null; if (btn) btn.classList.remove('on'); };
    document.querySelectorAll('.ar').forEach((btn) => {
      const a = btn.dataset.a;
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); window.Sound.ac(); stopAuto(); if (UI.advance()) return; btn.classList.add('on'); act(a); stop(); timer = setTimeout(() => { rep = setInterval(() => act(a), TUNE_P.REPEAT_MS); }, TUNE_P.REPEAT_DELAY); try { btn.setPointerCapture(e.pointerId); } catch (x) { /* 無視 */ } });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => btn.addEventListener(ev, () => stop(btn)));
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });
    $('btn-undo').onclick = () => { stopAuto(); undo(); }; $('btn-reset').onclick = () => { stopAuto(); reset(); }; $('btn-hint').onclick = hint;
  }

  /* ---------------- 謎解きを始める／終える ---------------- */
  /* run：進行の札。sid：'s1'|'s2'|'s4'|'s7'（区画の番号）。hooks：物語の側の反応 { ready, trigger, open, bonus, win }（それぞれ async (run, api)）
     戻り値：謎解きが終わる（hooks の中で api.finish() が呼ばれる）と解決する Promise */
  function start(run, sid, hooks, diff) {   // diff：難易度（easy／normal／hard）。盤面と目標・ヒントの文が変わる
    stopAuto();
    P.diff = LEVELS[diff] ? diff : 'easy';
    P.run = run; P.sid = sid; P.L = (sid === 's0' ? LEVELS.easy : LEVELS[P.diff])[sid]; P.M = MODS[sid]; P.hooks = hooks || {};   // 序章の羊追いは、難易度に関わらず同じ盤面
    P.s = P.M.init(P.L); P.base = core.cl(P.s); P.hist = []; P.moves = 0; P.fx = []; P.shake = null; P.fade = null; P.done = false;
    P.flags = { c03: null, swKnown: false, hintN: 0, lastLit: null };
    P.vis = { luno: mkEnt(0, 0, 'U'), flam: mkEnt(0, 0, 'U'), trolley: { x: 0, tx: 0 }, bags: [], sheep: [] };
    syncVis(true);
    updateChips(); $('choices').innerHTML = '';
    P.busy = false; P.active = true;
    idle();
    return new Promise((res) => { P.res = res; run.pend.push(res); }).then(() => UI.guard(run));
  }
  function finish() { P.active = false; P.busy = false; const r = P.res; P.res = null; if (r) r(); }
  function stop() { stopAuto(); P.active = false; P.busy = false; }

  /* ---------------- 毎フレームの描画 ---------------- */
  function draw(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    if (!P.active || !P.vis) return false;
    updVis(dt); R.frame(P, now); return true;
  }

  // 盤面の上で、壁と水門を避けて a から b へ行く道（フラメトが泳いで探すときなど）
  function gridPath(a, b) {
    const rows = P.L.rows, key = (x, y) => x + ',' + y, prev = {}; prev[key(a[0], a[1])] = null; const q = [a];
    for (let i = 0; i < q.length; i++) { const [x, y] = q[i]; if (x === b[0] && y === b[1]) break; for (const d of ['U', 'D', 'L', 'R']) { const nx = x + core.DIRS[d][0], ny = y + core.DIRS[d][1]; if (nx < 0 || ny < 0 || nx >= 11 || ny >= 9 || '#G'.indexOf(rows[ny][nx]) >= 0 || key(nx, ny) in prev) continue; prev[key(nx, ny)] = [x, y]; q.push([nx, ny]); } }
    const out = []; let c = b; while (c && !(c[0] === a[0] && c[1] === a[1])) { out.unshift(c); c = prev[key(c[0], c[1])]; } return out;
  }
  const api = { P, MODS, core, gridPath, syncVis, updateChips, freeNeighbor, walkPath, fxSpark, fxRing, shakeScreen, finish, stop, sys, idle, mkEnt };

  function init(canvas) { R = window.Render.create(canvas); bindPad(); }

  window.Puzzle = { init, start, finish, stop, draw, key, swipe, act, undo, reset, hint, autoSolve, stopAuto, api, P, TUNE_P, active: () => P.active, busy: () => P.busy };
})();
