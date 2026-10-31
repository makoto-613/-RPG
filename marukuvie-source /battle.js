/* ==========================================================================
   battle.js ― 戦闘の画面（盤面の描画・コマンド・アニメーション）
   数値・ルール・敵とフラメトのAIは battle_rules.js。ここは、それを画面に映して操作できるようにする部分です。
   ========================================================================== */
(function () {
  'use strict';
  const { BT, ENEMY, MAPS, STARTS, TXT, Rules } = window.BattleRules;
  const { newBattle, bfs, why, doMove, doStaff, doStone, doGuard, doCalm, doCall, doCrystal, callDelta, inb, LUNO_MAX, FLAM_MAX } = Rules;

  const B_UI = (function () {
    const $ = (id) => document.getElementById(id);
    const UI = window.UI, STORY = window.STORY, F = window.ATLAS.frames, sfx = (n, v) => window.Sound.sfx(n, v);
    const nowMs = () => performance.now(), CANCEL = UI.CANCEL;

    /* ★ 見た目・動きの調整 */
    const VT = {
      WALK: 8.5,          // 戦闘中の歩く速さ（マス／秒）
      HIT_MS: 420,        // 攻撃が当たったときの間（ミリ秒）
      STEP_PAUSE: 180,    // 動きと動きの間（ミリ秒）
      END_DELAY: 450,     // 移動も行動も終えてから、自動でターンを終えるまでの時間（ミリ秒）
      LUNO_S: 0.86, FLAM_S: 0.92   // 絵の大きさ（render.js の RT と同じ）
    };
    const SET = { f: 'mine_floor', fi: [0, 3, 0, 0, 3, 3, 0, 3, 0, 3, 1, 0], w: 'mine_wall', wi: [0, 1, 2, 3, 4, 5] };
    const hsh = (x, y) => window.Render.hsh(x, y);

    let ctx = null, cv = null, V = null, B = null, cfg = null, run = null, hooks = null, active = false, lock = false, nextTurn = null, W = 528, H = 432, T = 56, ox = 0, oy = 0, last = 0, mouse = null;

    const mkEnt = (x, y) => ({ x, y, tx: x, ty: y, dir: 'D', ph: 0, moving: false });
    function stepEnt(e, dt) {
      const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy);
      if (d < 1e-4) { e.x = e.tx; e.y = e.ty; e.moving = false; return; }
      const m = Math.min(d, VT.WALK * dt); e.x += dx / d * m; e.y += dy / d * m; e.ph += m; e.moving = true;
      e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U');
      if (Math.abs(dx) > 1e-3) e.face = dx > 0 ? 1 : -1;
    }
    function setupView() {
      V = {
        luno: mkEnt(B.luno.x, B.luno.y), flam: mkEnt(B.flam.x, B.flam.y), en: mkEnt(B.en.x, B.en.y),
        hp: { luno: B.luno.hp, flam: B.flam.hp, en: B.en.hp }, flash: { luno: 0, flam: 0, en: 0 }, floats: [], proj: null, tele: [], phase: 1, guard: { luno: false, flam: false }, pose: { flam: null }, A: B.A, shk: 0
      };
      V.en.dir = 'L';
    }
    const hudPush = () => { if (hooks && hooks.onHud) hooks.onHud({ lh: V.hp.luno, fh: V.hp.flam, A: V.A }); };

    /* ---------- 描画 ---------- */
    function resize() {
      const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2.5), w = Math.max(220, Math.round((r.width || 440) * dpr));
      if (cv.width !== w || cv.height !== Math.round(w * 9 / 11)) { cv.width = w; cv.height = Math.round(w * 9 / 11); }
      W = cv.width; H = cv.height; T = Math.floor(H * 0.95 / 7); ox = Math.round((W - 7 * T) / 2); oy = Math.round((H - 7 * T) / 2);
    }
    const IMG = () => window.Render.img();
    function tile(n, x, y, sz) { const f = F[n]; if (!f) return; const i = Math.round(Math.min(f.w, f.h) * 0.045), px = Math.floor(x), py = Math.floor(y); ctx.drawImage(IMG(), f.x + i, f.y + i, f.w - 2 * i, f.h - 2 * i, px, py, Math.ceil(x + sz) - px + 1, Math.ceil(y + sz) - py + 1); }   // 縁の暗い線を切り落として、つなぎ目を目立たなくする
    function spr(n, cx, by, s, o) {
      o = o || {}; const f = F[n]; if (!f) return; const k = T / 96 * s, dw = f.w * k, dh = f.h * k;
      ctx.save(); if (o.a != null) ctx.globalAlpha = o.a; ctx.drawImage(IMG(), f.x, f.y, f.w, f.h, cx - dw / 2, by - dh, dw, dh); ctx.restore();
    }
    const cx = (x) => ox + (x + 0.5) * T, cy = (y) => oy + (y + 0.5) * T, bot = (y) => oy + (y + 1) * T;
    function bar(x, y, w, ratio, col) {
      ctx.save(); ctx.fillStyle = 'rgba(20,12,22,.85)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, T * 0.1 + 2);
      ctx.fillStyle = '#4b3b49'; ctx.fillRect(x - w / 2, y, w, T * 0.1); ctx.fillStyle = col; ctx.fillRect(x - w / 2, y, w * clamp(ratio, 0, 1), T * 0.1); ctx.restore();
    }
    const DN = { U: 'up', D: 'down', L: 'left', R: 'right' };
    function unitSprite(who, e) { const f = (who === 'luno' ? 'luno_' : 'flam_') + DN[e.dir] + (e.moving ? Math.floor(e.ph * 2) % 4 : 0); return F[f] ? f : (who === 'luno' ? 'luno_down0' : 'flam_down0'); }
    function drawUnit(who, now) {
      const e = V[who], bob = e.moving ? Math.abs(Math.sin(e.ph * Math.PI * 2)) * 0.03 * T : 0, shk = (V.flash[who] > now) ? Math.sin(now * 0.08) * 0.05 * T : 0;
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(cx(e.x), bot(e.y) - T * 0.08, T * 0.3, T * 0.1, 0, 0, 7); ctx.fill(); ctx.restore();
      let name = unitSprite(who, e); if (who === 'flam' && V.pose.flam) name = V.pose.flam;
      spr(name, cx(e.x) + shk, bot(e.y) - T * 0.05 - bob, who === 'luno' ? VT.LUNO_S : VT.FLAM_S);
      if (V.flash[who] > now) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,120,120,' + Math.min(0.5, (V.flash[who] - now) / 500) + ')'; ctx.beginPath(); ctx.arc(cx(e.x), cy(e.y), T * 0.4, 0, 7); ctx.fill(); ctx.restore(); }
      bar(cx(e.x), bot(e.y) - T * 1.06, T * 0.72, V.hp[who] / (who === 'luno' ? LUNO_MAX() : FLAM_MAX()), who === 'luno' ? '#6cc0e0' : '#e8a02a');
      if (V.guard[who]) { ctx.save(); ctx.strokeStyle = 'rgba(160,230,255,.9)'; ctx.lineWidth = Math.max(2, T * 0.05); ctx.beginPath(); ctx.arc(cx(e.x), cy(e.y), T * 0.5, 0, 7); ctx.stroke(); ctx.restore(); }
    }
    function draw(now) {
      if (!active || !V) return false;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      resize(); stepEnt(V.luno, dt); stepEnt(V.flam, dt); stepEnt(V.en, dt);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      // 周囲の壁
      for (let y = 0; y * T < H + T; y++) for (let x = -1; x * T < W + T; x++) tile(SET.w + SET.wi[hsh(x + 7, y + 3) % SET.wi.length], ox % T + x * T - (ox % T ? 0 : 0), oy % T + y * T - T, T);
      ctx.fillStyle = 'rgba(8,5,16,.55)'; ctx.fillRect(0, 0, W, H);
      // 床
      for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) tile(SET.f + SET.fi[hsh(x, y) % SET.fi.length], ox + x * T, oy + y * T, T);
      ctx.strokeStyle = 'rgba(20,10,24,.9)'; ctx.lineWidth = Math.max(3, T * 0.06); ctx.strokeRect(ox, oy, 7 * T, 7 * T);
      if (B.kind === 'boss') { ctx.fillStyle = 'rgba(10,6,30,.22)'; ctx.fillRect(ox, oy, 7 * T, 7 * T); }
      // 移動できるマス（ルノの番）
      if (!lock && !B.over && !why.move(B)) {
        const tbl = bfs(B, B.luno.x, B.luno.y, B.moveLeft); const pulse = 0.5 + 0.5 * Math.sin(now / 260);
        Object.keys(tbl).forEach((k) => { const c = tbl[k]; if (!c.d) return; const [x, y] = k.split(',').map(Number); ctx.fillStyle = 'rgba(63,200,196,' + (0.22 + 0.1 * pulse) + ')'; ctx.fillRect(ox + x * T + 2, oy + y * T + 2, T - 4, T - 4); ctx.strokeStyle = 'rgba(160,255,245,.8)'; ctx.lineWidth = Math.max(1.5, T * 0.03); ctx.strokeRect(ox + x * T + 3, oy + y * T + 3, T - 6, T - 6); });
      }
      // 突進の予兆
      if (V.tele.length) { const p = 0.5 + 0.5 * Math.sin(now / 120); V.tele.forEach((c) => { ctx.fillStyle = 'rgba(230,50,60,' + (0.3 + 0.25 * p) + ')'; ctx.fillRect(ox + c[0] * T, oy + c[1] * T, T, T); ctx.strokeStyle = 'rgba(255,120,120,.95)'; ctx.lineWidth = Math.max(2, T * 0.04); ctx.strokeRect(ox + c[0] * T + 2, oy + c[1] * T + 2, T - 4, T - 4); ctx.fillStyle = 'rgba(255,230,230,.9)'; ctx.font = '700 ' + Math.round(T * 0.4) + 'px "Zen Maru Gothic",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', cx(c[0]), cy(c[1])); }); }
      // 石（壁）と、奥行き順の登場人物
      const list = [];
      for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) if (B.map[y][x] === '#') list.push({ z: y + 0.5, f: () => spr(['obs_stalagmite', 'obs_rocks', 'obs_mossy_rocks'][hsh(x, y) % 3], cx(x), bot(y) + T * 0.04, 0.9) });
      list.push({ z: V.en.y + 0.4, f: () => {
        const e = V.en, bob = Math.sin(now / 400) * T * 0.01;
        const pose = B.over && (B.over.type === 'defeat' || B.over.type === 'retreat') ? 'ko' : (V.enPose && V.enPose.until > now ? V.enPose.p : 'idle');
        window.Enemy.draw(ctx, B.kind, cx(e.x), bot(e.y) - T * 0.02 + bob, T, now, { dir: e.face || -1, flash: V.flash.en > now ? Math.min(1, (V.flash.en - now) / 300) : 0, phase: V.phase, pose });
        bar(cx(e.x), bot(e.y) - T * (B.kind === 'boss' ? 1.35 : 0.95), T * 0.9, V.hp.en / B.en.max, V.phase === 2 ? '#ff6a3d' : '#d65a5a');
      } });
      list.push({ z: V.luno.y + 0.5, f: () => drawUnit('luno', now) }); list.push({ z: V.flam.y + 0.5, f: () => drawUnit('flam', now) });
      list.sort((a, b) => a.z - b.z).forEach((o) => o.f());
      // 石弾
      if (V.proj) { const p = V.proj, q = Math.min(1, (now - p.t0) / p.ms); if (q >= 1) V.proj = null; else { const x = cx(p.a[0] + (p.b[0] - p.a[0]) * q), y = cy(p.a[1] + (p.b[1] - p.a[1]) * q) - Math.sin(q * Math.PI) * T * 0.35; ctx.fillStyle = '#e8e0d0'; ctx.strokeStyle = '#3a3040'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, T * 0.1, 0, 7); ctx.fill(); ctx.stroke(); } }
      // 数字・文字の浮かび上がり
      for (let i = V.floats.length - 1; i >= 0; i--) { const f = V.floats[i], q = (now - f.t0) / f.ms; if (q >= 1) { V.floats.splice(i, 1); continue; } if (q < 0) continue; ctx.save(); ctx.globalAlpha = 1 - q * q; ctx.font = '700 ' + Math.round(T * (f.big ? 0.52 : 0.4)) + 'px "Zen Maru Gothic",sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = Math.max(3, T * 0.07); ctx.strokeStyle = 'rgba(30,14,28,.9)'; ctx.fillStyle = f.c; const y = cy(f.y) - T * 0.6 - q * T * 0.55; ctx.strokeText(f.t, cx(f.x), y); ctx.fillText(f.t, cx(f.x), y); ctx.restore(); }
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.7); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.4)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      return true;
    }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    /* ---------- コマンド ---------- */
    const CMDS = [
      { id: 'staff', label: '杖', sub: () => '射程1・' + BT.STAFF_DMG + 'ダメージ' },
      { id: 'stone', label: '石弾', sub: () => 'あと' + B.stones + '・射程' + BT.STONE_MIN + '〜' + BT.STONE_MAX + '・' + BT.STONE_DMG },
      { id: 'guard', label: '防御', sub: () => '敵の攻撃を軽くする' },
      { id: 'calm', label: '落ち着く', sub: () => '不安 −' + BT.CALM_DOWN },
      { id: 'call', label: '呼びかけ', sub: () => { const d = callDelta(B.K); return d == null ? 'カルマ60以上は不可' : '不安 ' + d; } },
      { id: 'crystal', label: '◆ 水晶を使う', sub: () => '敵を退かせる（3ターン目から）' }
    ];
    function buildCmd() {
      const box = $('cmd'); box.innerHTML = '<div class="cgrid"></div><div class="cinfo" id="cinfo"></div>'; const grid = box.firstChild;
      CMDS.forEach((c, i) => {
        if (c.id === 'crystal' && !(B.kind === 'boss' && cfg.crystal)) return;
        const b = document.createElement('button'); b.type = 'button'; b.className = 'cbtn'; b.dataset.id = c.id; b.innerHTML = '<span>' + (i + 1) + '　' + c.label + '</span><small></small>'; b.onclick = () => command(c.id); grid.appendChild(b);
      });
      const e = document.createElement('button'); e.type = 'button'; e.className = 'cbtn rd'; e.dataset.id = 'end'; e.style.gridColumn = '1 / -1'; e.innerHTML = '<span>ターン終了</span><small>フラメトと敵が動く</small>'; e.onclick = () => command('end'); grid.appendChild(e);
      const cb = box.querySelectorAll('.cbtn'); cb.forEach((b) => { b.addEventListener('pointerdown', () => window.Sound.ac()); });
    }
    function refreshCmd() {
      const box = $('cmd'); if (!box || !B) return;
      box.querySelectorAll('.cbtn').forEach((b) => {
        const id = b.dataset.id; if (id === 'end') { b.setAttribute('aria-disabled', String(lock || !!B.over)); return; }
        const c = CMDS.find((x) => x.id === id), w = lock || B.over ? '動作中' : why[id](B);
        b.setAttribute('aria-disabled', String(!!w)); b.querySelector('small').textContent = w && !lock ? w : c.sub();
      });
      const ms = why.move(B);
      $('cinfo').textContent = lock ? '……' : '移動：' + (ms ? ms : 'あと' + B.moveLeft + 'マス（光るマスをタップ／矢印キー）') + '　行動：' + (B.acted ? '済み' : '未使用');
      const ch = [];
      const c = (t, cls) => ch.push('<span class="chip ' + (cls || '') + '">' + t + '</span>');
      c(B.maxTurns ? 'ターン ' + B.turn + '／' + B.maxTurns : 'ターン ' + B.turn, B.maxTurns && B.turn >= B.maxTurns ? 'warn' : '');
      c(ENEMY[B.kind].name + ' HP ' + V.hp.en + '／' + B.en.max, V.hp.en <= (ENEMY[B.kind].retreatBelow || ENEMY[B.kind].phase2At) ? 'good' : '');
      c('石弾 あと' + B.stones, B.stones ? '' : 'warn');
      if (B.A >= BT.ANX_NO_STONE) c(B.A >= BT.ANX_NO_STAFF ? '不安が高く、杖も使えない' : '不安が高く、石弾が使えない', 'warn');
      $('chips').innerHTML = ch.join('');
    }

    /* ---------- 出来事のアニメーション ---------- */
    const flt = (x, y, t, c, big) => V.floats.push({ x, y, t, c, t0: nowMs(), ms: 900, big });
    async function play(ev) {
      for (const e of ev) {
        UI.guard(run);
        switch (e.t) {
          case 'move': { const u = V[e.who]; for (const p of e.path) { u.tx = p[0]; u.ty = p[1]; await UI.until(run, () => !u.moving && u.x === u.tx && u.y === u.ty, 3000); } if (e.who !== 'luno') await UI.wait(run, VT.STEP_PAUSE); break; }
          case 'msg': UI.sys(e.text); break;
          case 'proj': V.proj = { a: e.from, b: e.to, t0: nowMs(), ms: 320 }; sfx('click'); await UI.wait(run, 330); break;
          case 'hit': {
            const tg = e.tgt, u = V[tg]; sfx('hit'); V.flash[tg] = nowMs() + 520;
            if (tg === 'en') V.enPose = { p: 'dmg', until: nowMs() + 520 }; else if (e.who === 'en') { V.enPose = { p: 'atk', until: nowMs() + 520 }; V.en.face = V[tg].x >= V.en.x ? 1 : -1; } V.hp[tg] = e.hp; hudPush();
            flt(u.x, u.y, '−' + e.dmg, tg === 'en' ? '#fff3b0' : '#ffb0b0', true);
            if (e.who === 'luno' && e.kind === 'staff') { V.luno.dir = dirTo(V.luno, V.en); }
            await UI.wait(run, VT.HIT_MS); refreshCmd(); break;
          }
          case 'recoil': V.hp.flam = e.hp; hudPush(); flt(V.flam.x, V.flam.y, '−' + e.dmg, '#ffd0a0'); break;
          case 'miss': sfx('miss'); flt(V.luno.x, V.luno.y, 'ミス…', '#c8d0ff'); await UI.wait(run, 420); break;
          case 'anx': V.A = e.A; hudPush(); break;
          case 'guard': V.guard[e.who] = true; sfx('click'); flt(V[e.who].x, V[e.who].y, '防御', '#bfeaff'); if (e.who === 'flam') V.pose.flam = 'flam_guard'; await UI.wait(run, 350); break;
          case 'calm': case 'call': sfx('heal'); flt(V.luno.x, V.luno.y, e.t === 'calm' ? '落ち着く' : '呼びかけ', '#d8ffd0'); await UI.wait(run, 450); break;
          case 'growl': sfx('bark'); V.pose.flam = 'flam_bark'; flt(V.flam.x, V.flam.y, 'ウゥゥ！', '#ffe0a0', true); await UI.wait(run, 600); V.pose.flam = null; break;
          case 'tele': V.tele = e.cells; sfx('alarm'); await UI.wait(run, 650); break;
          case 'charge': V.tele = []; V.enPose = { p: 'atk', until: nowMs() + 700 }; sfx('crumble'); await UI.wait(run, 450); break;
          case 'phase2': V.phase = 2; sfx('alarm'); window.Sound.bgm('boss2'); await UI.say(run, STORY.P.s8_phase2); break;
          case 'turn': V.guard.luno = V.guard.flam = false; V.pose.flam = null; break;
          case 'end': break;
          default: break;
        }
      }
    }
    function dirTo(a, b) { const dx = b.x - a.x, dy = b.y - a.y; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U'); }
    // 画面の表示を、ルールの状態にそろえる
    function syncView() { V.hp.luno = B.luno.hp; V.hp.flam = B.flam.hp; V.hp.en = B.en.hp; V.A = B.A; hudPush(); }

    /* ---------- 入力 ---------- */
    async function runAction(fn) {
      if (lock || !active || B.over) return;
      const r = fn(); if (!r.ok) { sfx('warn'); if (r.why) UI.sys(r.why + '。'); return; }
      lock = true; refreshCmd();
      try {
        await play(r.ev); UI.guard(run);
        if (B.over) { syncView(); finishTurn(); return; }
        lock = false; refreshCmd();
        if (B.acted && B.steps > 0) { await UI.wait(run, VT.END_DELAY); if (!lock && !B.over) await command('end'); }   // 移動も行動も済んだら、自動でターンを終える
      } catch (e) { if (e !== CANCEL) console.error(e); }
    }
    async function command(id) {
      if (lock || !active || B.over) return;
      const wasStep = false; void wasStep;
      if (id === 'end') {
        lock = true; refreshCmd();
        try { const r = Rules.endTurn(B); await play(r.ev); UI.guard(run); syncView(); if (B.over) { finishTurn(); return; } lock = false; UI.sys(TXT.yourTurn(B.turn, B.maxTurns)); refreshCmd(); }
        catch (e) { if (e !== CANCEL) console.error(e); }
        return;
      }
      const map = { staff: doStaff, stone: doStone, guard: doGuard, calm: doCalm, call: doCall, crystal: doCrystal };
      if (map[id]) await runAction(() => map[id](B));
    }
    function finishTurn() { lock = true; refreshCmd(); const n = nextTurn; nextTurn = null; if (n) n(); }
    function stepKey(dx, dy) { if (lock || !active || B.over) return; runAction(() => doMove(B, B.luno.x + dx, B.luno.y + dy)); }
    function key(e) {
      if (!active) return false; const k = e.key;
      const mv = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0] };
      if (mv[k]) { e.preventDefault(); if (!e.repeat) stepKey(mv[k][0], mv[k][1]); return true; }
      const ids = { 1: 'staff', 2: 'stone', 3: 'guard', 4: 'calm', 5: 'call', 6: 'crystal' };
      if (ids[k]) { command(ids[k]); return true; }
      if (k === 'Enter') { e.preventDefault(); command('end'); return true; }
      return false;
    }
    function tap(clientX, clientY) {
      if (!active || lock || B.over) return false;
      const r = cv.getBoundingClientRect(), x = (clientX - r.left) / r.width * cv.width, y = (clientY - r.top) / r.height * cv.height;
      const gx = Math.floor((x - ox) / T), gy = Math.floor((y - oy) / T); if (!inb(gx, gy)) return false;
      runAction(() => doMove(B, gx, gy)); return true;
    }
    void mouse;

    /* ---------- ゲームオーバー ---------- */
    function gameOver(who) {
      return new Promise((res) => {
        sfx('lose'); window.Sound.bgm('gameover');
        const msg = who === 'luno' ? 'ルノは力尽きてしまった……。' : 'フラメトは動けなくなってしまった……。';
        UI.openDlg('<div class="dlg-h"><span class="emb"></span><h2>ゲームオーバー</h2></div><div class="dlg-b"><p style="margin:0">' + msg + '</p><p class="fine" style="margin:0">戦闘のはじめからやり直せます。（展示タイマーはリセットされません）</p><div class="btns"><button class="kbtn" data-a="retry">戦闘をやり直す</button><button class="kbtn sm rd" data-a="title">タイトルへ</button></div></div>', (d) => {
          d.querySelectorAll('[data-a]').forEach((b) => { b.onclick = () => { sfx('click'); UI.closeVeil(); res(b.dataset.a); }; });
        });
        run.pend.push(() => { UI.closeVeil(); res('cancel'); });
      });
    }

    /* ---------- 戦闘の進行 ---------- */
    /* cfg：{ kind:'centipede'|'boss', luHP, flHP, A, K, stones, crystal, flamAdvance, onHud(v), onTitle() } ／ 戻り値：{ type, luHP, flHP, A, stones, turn, enemyHp, enemyMax } */
    async function start(runTok, c) {
      run = runTok; cfg = c; hooks = c; active = true;
      for (;;) {
        B = newBattle(Object.assign({}, c, { rng: c.rng || (window.__rng || Math.random) }));
        setupView(); lock = false; buildCmd(); hudPush();
        UI.sys(TXT.start[c.kind]); refreshCmd();
        await UI.wait(run, 700); UI.sys(TXT.yourTurn(B.turn, B.maxTurns));
        await new Promise((res) => { nextTurn = res; run.pend.push(res); });
        UI.guard(run);
        const o = B.over;
        if (o && o.type === 'lose') {
          const a = await gameOver(o.who); UI.guard(run);
          if (a === 'retry') { window.Sound.bgm(c.kind === 'boss' ? 'boss' : 'battle'); continue; }
          active = false; if (c.onTitle) c.onTitle(); throw CANCEL;
        }
        active = false; lock = true;
        return { type: o.type, luHP: B.luno.hp, flHP: B.flam.hp, A: B.A, stones: B.stones, turn: B.turn, enemyHp: B.en.hp, enemyMax: B.en.max };
      }
    }
    function stop() { active = false; lock = true; nextTurn = null; }
    function init(canvas) { cv = canvas; ctx = canvas.getContext('2d'); }
    return { start, stop, init, draw, key, tap, state: () => B, active: () => active, locked: () => lock, view: () => V, command, stepKey, move: (x, y) => runAction(() => doMove(B, x, y)) };
  })();

  window.Battle = Object.assign({ BT, ENEMY, MAPS, STARTS, TXT, Rules }, B_UI);
})();
