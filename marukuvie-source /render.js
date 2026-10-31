/* ==========================================================================
   render.js ― 謎解きの盤面の絵（ドット絵アトラスの読み込み・切り出し／区画1・2・4・7の床・壁・仕掛けの描画）
   ゲームのルールには触れず、「今の状態」を受け取って canvas に描くだけです。
   ========================================================================== */
(function () {
  'use strict';
  const F = window.ATLAS.frames;
  const W = 11, H = 9;

  /* ★ 見た目の調整（ここを書き換えると絵の大きさや雰囲気が変わります） */
  const RT = {
    LUNO: 0.86,        // ルノの大きさ
    FLAM: 0.92,        // フラメトの大きさ
    DARK7: 0.8,        // 区画7（灯火の間）で、明かりの届いていない床の暗さ（0＝明るい／1＝真っ暗）
    DARK7_WALL: 0.62,  // 同じく、明かりの届いていない壁・燭台の暗さ（燭台の形は見えるくらいに）
    VIGNETTE: 0.38,    // 画面の四隅を暗くする強さ
    WATER_MS: 320,     // 水面の絵が切り替わる間隔（ミリ秒）
    BEAM_W: 0.17,      // 光線の太さ（マス）
    // 水路①②③・レバー・扉の色分け（同じ色どうしが対応する）
    COL: ['#3fb6c4', '#eaa83a', '#dc6a86']
  };

  let IMG = null;
  const dimCache = new Map();

  function load(src) {
    return new Promise((res, rej) => { IMG = new Image(); IMG.onload = () => res(); IMG.onerror = () => rej(new Error('atlas')); IMG.src = src; });
  }
  // 暗くした絵（消えた燭台・押されたスイッチなど）を一度だけ作って使い回す
  function dimmed(n, a) {
    const key = n + '|' + a;
    let c = dimCache.get(key);
    if (!c) {
      const f = F[n];
      c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
      const g = c.getContext('2d');
      g.drawImage(IMG, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(10,12,34,' + a + ')'; g.fillRect(0, 0, f.w, f.h);
      dimCache.set(key, c);
    }
    return c;
  }
  const hsh = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
  const SETS = {
    mine: { f: 'mine_floor', fi: [0, 3, 0, 0, 3, 3, 0, 3, 0, 3, 1, 0], w: 'mine_wall', wi: [0, 1, 2, 3, 4, 5] },
    crys: { f: 'crys_floor', fi: [0, 1, 2, 0, 1, 0, 2, 1], w: 'crys_wall', wi: [0, 1, 2, 3] },
    altar: { f: 'altar_floor', fi: [1, 3, 1, 3, 4, 1, 3, 1, 4, 3, 2, 1], w: 'altar_wall', wi: [0, 1, 2, 3] }
  };
  const CHN = { '1': [0, 0], '2': [1, 0], '3': [2, 0], a: [0, 1], b: [1, 1], c: [2, 1] };   // core.js の水路表と同じ

  function create(canvas) {
    const ctx = canvas.getContext('2d');
    let T = 48, k = 0.5;

    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const w = Math.max(220, Math.round((r.width || 440) * dpr));
      if (canvas.width !== w || canvas.height !== Math.round(w * H / W)) { canvas.width = w; canvas.height = Math.round(w * H / W);}   // 高さも確かめる（ノベルの場面から切り替わったとき、縦横比がずれないように）
      T = canvas.width / W; k = T / 96;
    }

    /* ---------- 描画の道具 ---------- */
    // タイル：素材の縁の暗い線を切り落とし、となりと1ピクセル重ねて、つなぎ目を目立たなくする（4.5% は stage.js の TILE_INSET と同じ）
    function tile(n, x, y) {
      const f = F[n], i = Math.round(Math.min(f.w, f.h) * 0.045), px = Math.floor(x * T), py = Math.floor(y * T);
      ctx.drawImage(IMG, f.x + i, f.y + i, f.w - 2 * i, f.h - 2 * i, px, py, Math.ceil((x + 1) * T) - px + 1, Math.ceil((y + 1) * T) - py + 1);
    }
    const floorT = (set, x, y) => SETS[set].f + SETS[set].fi[hsh(x, y) % SETS[set].fi.length];
    const wallT = (set, x, y) => SETS[set].w + SETS[set].wi[hsh(x + 7, y + 3) % SETS[set].wi.length];
    // 絵を「マスの下辺の中央」に立たせて描く。s＝大きさ、ox/oy＝ずらし（マス単位）、dim＝暗さ
    function spr(n, x, y, o) {
      o = o || {};
      const f = F[n], s = (o.s == null ? 1 : o.s) * k, dw = f.w * s, dh = f.h * s;
      const cx = (x + 0.5 + (o.ox || 0)) * T, by = (y + 1 + (o.oy || 0)) * T;
      let src = IMG, sx = f.x, sy = f.y;
      if (o.dim) { src = dimmed(n, o.dim); sx = 0; sy = 0; }
      ctx.save();
      if (o.a != null) ctx.globalAlpha = o.a;
      if (o.flip) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }
      if (o.clipY != null) { ctx.beginPath(); ctx.rect(0, 0, canvas.width, o.clipY * T); ctx.clip(); }
      ctx.drawImage(src, sx, sy, f.w, f.h, cx - dw / 2, by - dh, dw, dh);
      ctx.restore();
      return { cx, by, dw, dh };
    }
    function shadow(x, y, rx, a) {
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,' + (a == null ? 0.3 : a) + ')';
      ctx.beginPath(); ctx.ellipse((x + 0.5) * T, (y + 0.93) * T, rx * T, rx * T * 0.34, 0, 0, 7); ctx.fill(); ctx.restore();
    }
    function glow(cx, cy, r, rgb, a) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); ctx.restore();
    }
    function rr(x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    function badge(cx, cy, r, col, txt) {
      ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = 'rgba(30,20,28,.85)'; ctx.lineWidth = Math.max(1, T * 0.025);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); ctx.stroke();
      if (txt) { ctx.fillStyle = '#fff'; ctx.font = '700 ' + Math.round(r * 1.25) + 'px "Zen Maru Gothic",system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, cx, cy + r * 0.06); }
      ctx.restore();
    }

    /* ---------- キャラクター ---------- */
    const DN = { U: 'up', D: 'down', L: 'left', R: 'right' };
    function charName(who, v) {
      if (v.pose) return v.pose;
      return (who === 'luno' ? 'luno_' : 'flam_') + DN[v.dir || 'D'] + (v.moving ? Math.floor(v.ph * 2) % 4 : 0);
    }
    function drawChar(who, v, now) {
      const bob = v.moving ? Math.abs(Math.sin(v.ph * Math.PI * 2)) * 0.035 : 0;
      let ox = 0; if (v.shk && now < v.shk) ox = Math.sin(now * 0.07) * 0.045;
      shadow(v.x, v.y, who === 'luno' ? 0.27 : 0.25, 0.32);
      spr(charName(who, v), v.x, v.y, { s: who === 'luno' ? RT.LUNO : RT.FLAM, oy: -bob - (v.lift || 0), ox, clipY: v.swim ? v.y + 0.86 : null });
      if (v.swim) { ctx.save(); ctx.strokeStyle = 'rgba(190,235,255,.7)'; ctx.lineWidth = Math.max(1, T * 0.03); for (let i = 0; i < 2; i++) { const q = ((now / 700) + i * 0.5) % 1; ctx.globalAlpha = 1 - q; ctx.beginPath(); ctx.ellipse((v.x + 0.5) * T, (v.y + 0.88) * T, T * (0.25 + 0.3 * q), T * (0.08 + 0.1 * q), 0, 0, 7); ctx.stroke(); } ctx.restore(); }
    }

    /* ---------- 地面（共通） ---------- */
    function groundAll(G, set, special) {
      const rows = G.L.rows;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const c = rows[y][x];
        const sp = special && special(c, x, y);
        if (sp) continue;
        if (c === '#') tile(wallT(set, x, y), x, y); else tile(floorT(set, x, y), x, y);
      }
    }
    // 奥行きの順に並べて描く
    function drawList(list) { list.sort((a, b) => a.z - b.z); list.forEach((e) => e.f()); }

    /* ==================== 区画1：トロッコと砂袋 ==================== */
    function drawS1(G, now) {
      const L = G.L, s = G.s, rows = L.rows, p = G.M.prep(L), V = G.vis;
      const xs = [], ys = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rows[y][x] === 'X') { xs.push(x); ys.push(y); }
      groundAll(G, 'mine', (c, x, y) => {
        if (c === 'X') { tile(wallT('mine', x, y), x, y); return true; }
        if ('=TCbG'.indexOf(c) >= 0) { tile('mine_rail_h', x, y); return true; }
        return false;
      });
      // 足場の印
      p.slots.forEach((q, i) => {
        if (s.filled[i]) return;
        const px = q[0] * T, py = q[1] * T;
        ctx.save(); ctx.strokeStyle = 'rgba(255,226,150,.9)'; ctx.fillStyle = 'rgba(255,226,150,.16)'; ctx.lineWidth = Math.max(1.5, T * 0.04);
        ctx.setLineDash([T * 0.1, T * 0.07]); ctx.lineDashOffset = -now / 60;
        rr(px + T * 0.1, py + T * 0.12, T * 0.8, T * 0.76, T * 0.12); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,226,150,.95)'; ctx.beginPath();
        const cx = px + T * 0.5, cy = py + T * 0.5 + Math.sin(now / 300 + i) * T * 0.02;
        ctx.moveTo(cx, cy - T * 0.2); ctx.lineTo(cx + T * 0.17, cy + T * 0.08); ctx.lineTo(cx + T * 0.06, cy + T * 0.08); ctx.lineTo(cx + T * 0.06, cy + T * 0.2);
        ctx.lineTo(cx - T * 0.06, cy + T * 0.2); ctx.lineTo(cx - T * 0.06, cy + T * 0.08); ctx.lineTo(cx - T * 0.17, cy + T * 0.08); ctx.closePath(); ctx.fill(); ctx.restore();
      });
      // 終点の止め具
      { const g = p.goal, px = g[0] * T, py = g[1] * T;
        ctx.save(); ctx.fillStyle = '#4a3322'; rr(px + T * 0.74, py + T * 0.22, T * 0.2, T * 0.56, T * 0.04); ctx.fill();
        ctx.fillStyle = '#e9b94a'; for (let i = 0; i < 3; i++) ctx.fillRect(px + T * 0.76, py + T * (0.27 + i * 0.17), T * 0.16, T * 0.07);
        ctx.restore(); }
      const list = [];
      // 大きな岩
      if (xs.length) {
        const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y1 = Math.max.apply(null, ys), wT = (x1 - x0 + 1);
        list.push({ z: y1 + 1, f: () => {
          const sc = (wT * 96 * 1.08) / F.obs_tall_rock.w;
          spr('obs_tall_rock', x0 + (wT - 1) / 2, y1, { s: sc, oy: 0.02 });
          if (G.s.filled.every(Boolean) && s.locked) glow((x0 + wT / 2) * T, (y1 - 0.4) * T, T * 1.5, '255,226,150', 0.18 + 0.08 * Math.sin(now / 300));
        } });
      }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rows[y][x] === 'o') list.push({ z: y + 1, f: () => spr('obs_rocks', x, y, { s: 0.88 }) });
      if (s.chock) list.push({ z: p.chock[1] + 0.9, f: () => { shadow(p.chock[0], p.chock[1], 0.3, 0.25); spr('wheel_chock', p.chock[0], p.chock[1], { s: 0.86, oy: -0.04 }); } });
      list.push({ z: p.rail + 1, f: () => { const x = V.trolley.x; shadow(x, p.rail, 0.42, 0.28); spr('cart_coal', x, p.rail, { s: 0.8, oy: -0.02 }); } });
      p.slots.forEach((q, i) => { if (s.filled[i] && !V.bags.some((b) => b.absorb === i)) list.push({ z: q[1] + 1, f: () => { shadow(q[0], q[1], 0.36, 0.3); spr('sandbag', q[0], q[1], { s: 0.9 }); } }); });
      V.bags.forEach((b) => list.push({ z: b.y + 1, f: () => { shadow(b.x, b.y, 0.32, 0.3); spr('sandbag', b.x, b.y, { s: 0.9 }); } }));
      list.push({ z: V.luno.over ? 50 : V.luno.y + 1.001, f: () => drawChar('luno', V.luno, now) });
      list.push({ z: V.flam.over ? 50 : V.flam.y + 1, f: () => drawChar('flam', V.flam, now) });
      drawList(list);
    }

    /* ==================== 区画2：三叉路と水門 ==================== */
    function drawS2(G, now) {
      const L = G.L, s = G.s, rows = L.rows, p = G.M.prep(L), V = G.vis, fr = Math.floor(now / RT.WATER_MS);
      groundAll(G, 'mine', (c, x, y) => {
        const r = CHN[c]; if (!r) return false;
        const high = s.w[r[0]] === 1;
        if (r[1] === 0) {   // 水路の「道」：水位が低いときだけ歩ける
          if (high) tile('water' + ((fr + x + y * 2) % 5), x, y);
          else { tile('mine_floor3', x, y); ctx.fillStyle = 'rgba(80,150,200,' + (0.14 + 0.05 * Math.sin(now / 400 + x)) + ')'; ctx.fillRect(x * T, y * T, T, T); }
        } else {            // 「浮き橋」：水位が高いときだけ浮かぶ
          if (high) tile('water' + ((fr + x + y * 2) % 5), x, y);
          else { tile('mine_floor2', x, y); ctx.globalAlpha = 0.85; tile('mine_rubble0', x, y); ctx.globalAlpha = 1; }
        }
        return true;
      });
      // 水路の色札
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const r = CHN[rows[y][x]]; if (!r) continue;
        badge((x + 0.2) * T, (y + 0.22) * T, T * 0.14, RT.COL[r[0]], String(r[0] + 1));
      }
      // 浮き橋
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const r = CHN[rows[y][x]]; if (!r || r[1] !== 1 || s.w[r[0]] !== 1) continue;
        const bob = Math.sin(now / 520 + x * 1.7 + y) * T * 0.015, px = x * T, py = y * T + bob;
        ctx.save();
        ctx.fillStyle = 'rgba(8,30,60,.35)'; ctx.beginPath(); ctx.ellipse(px + T * 0.5, py + T * 0.84, T * 0.42, T * 0.1, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#8b6a44'; rr(px + T * 0.06, py + T * 0.26, T * 0.88, T * 0.52, T * 0.06); ctx.fill();
        ctx.strokeStyle = '#3d2b1b'; ctx.lineWidth = Math.max(1.5, T * 0.035); ctx.stroke();
        ctx.strokeStyle = '#5c4228'; ctx.lineWidth = Math.max(1, T * 0.03); for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(px + T * (0.06 + i * 0.22), py + T * 0.27); ctx.lineTo(px + T * (0.06 + i * 0.22), py + T * 0.77); ctx.stroke(); }
        ctx.fillStyle = 'rgba(255,230,170,.35)'; ctx.fillRect(px + T * 0.09, py + T * 0.29, T * 0.82, T * 0.06);
        ctx.restore();
      }
      // 水たまり（選択肢の場所）
      if (p.q) spr('puddle', p.q[0], p.q[1], { s: 0.95 });
      // レバーと水門のスイッチ
      const list = [];
      Object.keys(L.levers).forEach((c) => {
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rows[y][x] === c) {
          list.push({ z: y + 0.5, f: () => {
            const on = (s.px === x && s.py === y);
            spr('switch_plate', x, y, { s: 0.72, oy: on ? 0.03 : -0.02, dim: on ? 0.35 : 0 });
            const chs = L.levers[c], n = chs.length, bx = (x + 0.5) * T - (n - 1) * T * 0.13;
            chs.forEach((ch, i) => badge(bx + i * T * 0.26, (y + 0.18) * T, T * 0.12, RT.COL[ch - 1], String(ch)));
          } });
        }
      });
      if (p.sw) list.push({ z: p.sw[1] + 0.5, f: () => {
        const x = p.sw[0], y = p.sw[1], known = G.flags.swKnown || s.open || (s.px === x && s.py === y);
        if (!known) return;
        const cx = (x + 0.5) * T, cy = (y + 0.55) * T;
        if (!s.open) glow(cx, cy, T * 0.9, '120,200,255', 0.3 + 0.12 * Math.sin(now / 280));
        spr('switch_plate', x, y, { s: 0.78, oy: s.open ? 0.03 : -0.02, dim: s.open ? 0.3 : 0 });
        if (G.flags.swKnown && !s.open) { ctx.save(); ctx.strokeStyle = 'rgba(160,225,255,.9)'; ctx.lineWidth = Math.max(1.5, T * 0.04); const q = (now / 900) % 1; ctx.globalAlpha = 1 - q; ctx.beginPath(); ctx.arc(cx, cy, T * (0.3 + 0.35 * q), 0, 7); ctx.stroke(); ctx.restore(); }
      } });
      // 水門
      list.push({ z: p.gate[1] + 1, f: () => {
        const g = p.gate;
        if (s.open) glow((g[0] + 0.5) * T, (g[1] + 0.45) * T, T * 0.9, '255,220,150', 0.2);
        spr(s.open ? 'gate_open' : 'gate_closed', g[0], g[1], { s: 0.58, oy: 0.04 });
      } });
      list.push({ z: V.luno.over ? 50 : V.luno.y + 1.001, f: () => drawChar('luno', V.luno, now) });
      list.push({ z: V.flam.over ? 50 : V.flam.y + 1, f: () => drawChar('flam', V.flam, now) });
      drawList(list);
    }

    /* ==================== 区画4：水晶洞の集光器 ==================== */
    function mirror(x, y, d, hot, now) {
      const px = x * T, py = y * T, cx = px + T * 0.5;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(cx, py + T * 0.86, T * 0.34, T * 0.1, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#4a5a74'; rr(px + T * 0.28, py + T * 0.78, T * 0.44, T * 0.12, T * 0.04); ctx.fill();
      ctx.strokeStyle = '#26324a'; ctx.lineWidth = Math.max(1, T * 0.025); ctx.stroke();
      // 鏡面
      const a = d === '/' ? [px + T * 0.2, py + T * 0.78, px + T * 0.8, py + T * 0.22] : [px + T * 0.2, py + T * 0.22, px + T * 0.8, py + T * 0.78];
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#1f2c44'; ctx.lineWidth = T * 0.2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[2], a[3]); ctx.stroke();
      const g = ctx.createLinearGradient(a[0], a[1], a[2], a[3]); g.addColorStop(0, '#b8e4ff'); g.addColorStop(0.5, '#f4fbff'); g.addColorStop(1, '#8cc8f0');
      ctx.strokeStyle = g; ctx.lineWidth = T * 0.13; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[2], a[3]); ctx.stroke();
      ctx.restore();
      if (hot) glow(cx, py + T * 0.5, T * 0.55, '170,225,255', 0.32 + 0.1 * Math.sin(now / 200 + x));
    }
    function drawS4(G, now) {
      const L = G.L, s = G.s, rows = L.rows, p = G.M.prep(L), V = G.vis;
      groundAll(G, 'crys', (c, x, y) => { if (c === 'E') { tile(wallT('crys', x, y), x, y); return true; } return false; });
      const tr = G.M.trace(L, s.ms);
      const hit = (x, y) => tr.lit.has(x + ',' + y);
      const list = [];
      // 光源
      list.push({ z: p.src[1] + 1, f: () => { glow((p.src[0] + 0.6) * T, (p.src[1] + 0.45) * T, T * 0.8, '190,235,255', 0.3); spr('spotlight', p.src[0], p.src[1], { s: 0.85 }); } });
      // 石柱
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const c = rows[y][x];
        if (c === 'p') list.push({ z: y + 1, f: () => { shadow(x, y, 0.36, 0.3); spr('obs_column', x, y, { s: 0.74 }); } });
        if (c === 'T' || c === 'b') list.push({ z: y + 1, f: () => {
          const on = hit(x, y), bon = c === 'b';
          shadow(x, y, 0.34, 0.3);
          if (on) glow((x + 0.5) * T, (y + 0.45) * T, T * 1.05, bon ? '120,255,190' : '140,215,255', 0.5 + 0.15 * Math.sin(now / 200 + x));
          else {   // まだ光っていない水晶には、光を当てる場所の輪をつける
            ctx.save(); ctx.strokeStyle = bon ? 'rgba(130,240,190,.75)' : 'rgba(160,220,255,.8)'; ctx.lineWidth = Math.max(1.5, T * 0.04);
            ctx.setLineDash([T * 0.09, T * 0.07]); ctx.lineDashOffset = now / 70;
            ctx.beginPath(); ctx.ellipse((x + 0.5) * T, (y + 0.86) * T, T * 0.42, T * 0.15, 0, 0, 7); ctx.stroke(); ctx.restore();
          }
          if (bon) spr('crystal_ore', x, y, { s: 0.78, dim: on ? 0 : 0.3 }); else spr('crystal_big', x, y, { s: 0.8, dim: on ? 0 : 0.3 }); } });
        if (c === 'X') list.push({ z: y + 1, f: () => {   // 光を二手に割る石
          const cx = (x + 0.5) * T, cy = (y + 0.5) * T;
          shadow(x, y, 0.3, 0.3);
          glow(cx, cy, T * 0.7, '230,240,255', 0.25);
          ctx.save(); ctx.translate(cx, cy);
          const g = ctx.createLinearGradient(-T * 0.2, -T * 0.3, T * 0.2, T * 0.3); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#bfe6ff'); g.addColorStop(1, '#e9c8ff');
          ctx.fillStyle = g; ctx.strokeStyle = '#41506e'; ctx.lineWidth = Math.max(1.5, T * 0.035);
          ctx.scale(1.3, 1.3);
          ctx.beginPath(); ctx.moveTo(0, -T * 0.34); ctx.lineTo(T * 0.24, 0); ctx.lineTo(0, T * 0.3); ctx.lineTo(-T * 0.24, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, -T * 0.34); ctx.lineTo(0, T * 0.3); ctx.moveTo(-T * 0.24, 0); ctx.lineTo(T * 0.24, 0); ctx.strokeStyle = 'rgba(80,100,140,.45)'; ctx.stroke();
          ctx.restore(); } });
      }
      // 鏡
      p.mir.forEach((m, i) => list.push({ z: m[1] + 0.9, f: () => mirror(m[0], m[1], s.ms[i], false, now) }));
      // 出口
      { const e = p.exit; list.push({ z: e[1] + 1, f: () => {
        if (s.open) glow((e[0] + 0.5) * T, (e[1] + 0.5) * T, T * 1.2, '255,225,160', 0.24 + 0.06 * Math.sin(now / 260));
        spr(s.open ? 'door_open' : 'door_closed', e[0], e[1], { s: 0.66, oy: 0.04 });
      } }); }
      list.push({ z: V.luno.over ? 50 : V.luno.y + 1.001, f: () => drawChar('luno', V.luno, now) });
      list.push({ z: V.flam.over ? 50 : V.flam.y + 1, f: () => drawChar('flam', V.flam, now) });
      drawList(list);
      // 光線
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      [[RT.BEAM_W * 2.4, 0.10, '120,200,255'], [RT.BEAM_W * 1.3, 0.25, '170,225,255'], [RT.BEAM_W * 0.5, 0.95, '255,255,255']].forEach((l) => {
        ctx.strokeStyle = 'rgba(' + l[2] + ',' + (l[1] * (0.92 + 0.08 * Math.sin(now / 160))) + ')'; ctx.lineWidth = l[0] * T;
        tr.segs.forEach((seg) => { ctx.beginPath(); seg.forEach((q, i) => { if (i) ctx.lineTo(q[0] * T, q[1] * T); else ctx.moveTo(q[0] * T, q[1] * T); }); ctx.stroke(); });
      });
      ctx.restore();
      // 鏡に光が当たっているところの輝き
      tr.segs.forEach((seg) => seg.slice(1, -1).forEach((q) => glow(q[0] * T, q[1] * T, T * 0.28, '210,240,255', 0.35)));
    }

    /* ==================== 区画7：灯火の間（一つ灯れば、二つは消える） ==================== */
    function drawS7(G, now) {
      const L = G.L, s = G.s, rows = L.rows, M = G.M, p = M.prep(L), V = G.vis, lit = M.litMap(L, s), open = M.isOpen(s);
      groundAll(G, 'altar', (c, x, y) => { if (c === 'E') { tile(wallT('altar', x, y), x, y); return true; } return false; });
      // 暗闇：明かりの届いていないマスは暗く（進めない）。届いているマスは、ほんのり暖かく
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const c = rows[y][x], wall = c === '#' || c === 'E', on = lit[x + ',' + y];
        if (on) { if (!wall && !p.pos[c]) { ctx.fillStyle = 'rgba(255,190,110,.07)'; ctx.fillRect(x * T, y * T, T, T); } }
        else { ctx.fillStyle = 'rgba(6,5,18,' + (wall || p.pos[c] ? RT.DARK7_WALL : RT.DARK7) + ')'; ctx.fillRect(x * T, y * T, T, T); }   // 壁も暗く（明かりの届く所だけ見える）
      }
      // 隣の燭台：火を入れると消える二つを、線と ×印で前もって見せる
      const adj = p.ids.find((id) => { const q = p.pos[id]; return !s.on[id] && Math.abs(q[0] - s.px) + Math.abs(q[1] - s.py) === 1; });
      if (adj) {
        const A = p.pos[adj]; ctx.save(); ctx.lineCap = 'round'; ctx.setLineDash([T * 0.08, T * 0.1]); ctx.lineDashOffset = -now / 50;
        (L.links[adj] || []).forEach((o) => { const B = p.pos[o]; ctx.strokeStyle = 'rgba(255,140,140,.75)'; ctx.lineWidth = Math.max(1.5, T * 0.04); ctx.beginPath(); ctx.moveTo((A[0] + 0.5) * T, (A[1] + 0.5) * T); ctx.lineTo((B[0] + 0.5) * T, (B[1] + 0.5) * T); ctx.stroke(); });
        ctx.restore();
      }
      const list = [];
      // 扉（まんなかのランプが灯っている間だけ開く）
      { const e = p.door; list.push({ z: e[1] + 1, f: () => { if (open) glow((e[0] + 0.5) * T, (e[1] + 0.5) * T, T * 1.2, '255,225,160', 0.24 + 0.06 * Math.sin(now / 260)); spr(open ? 'door_open' : 'door_closed', e[0], e[1], { s: 0.6, oy: 0.02 }); } }); }
      // 燭台と奥のランプ
      p.ids.forEach((id) => {
        const q = p.pos[id], on = s.on[id], big = 'LMR'.indexOf(id) >= 0, mark = adj && (L.links[adj] || []).indexOf(id) >= 0;
        list.push({ z: q[1] + 1, f: () => {
          shadow(q[0], q[1], 0.42, 0.3);
          if (on) glow((q[0] + 0.5) * T, (q[1] + 0.35) * T, T * (big ? 1.5 : 1.1), '255,185,90', 0.42 + 0.1 * Math.sin(now / 110 + q[0] * 3));
          const r = spr('candle_stand', q[0], q[1], { s: big ? 0.72 : 0.56, dim: on ? 0 : 0.45 });
          const cx = (q[0] + 0.5) * T;
          if (on) for (let i = 0; i < 3; i++) { const fx = cx + (i - 1) * T * 0.2, fy = r.by - r.dh * 0.82 - Math.abs(Math.sin(now / 90 + i * 2 + q[0])) * T * 0.04;
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,170,70,.6)'; ctx.beginPath(); ctx.ellipse(fx, fy, T * 0.05, T * 0.1, 0, 0, 7); ctx.fill(); ctx.restore(); }
          if (id === 'M') { ctx.save(); ctx.fillStyle = on ? '#fff2b8' : 'rgba(255,225,150,.8)'; ctx.font = '700 ' + Math.round(T * 0.2) + 'px "Zen Maru Gothic",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('◆', cx, r.by - r.dh - T * 0.06); ctx.restore(); }   // 道のまんなか
          if (mark && on) { ctx.save(); ctx.strokeStyle = 'rgba(255,120,120,.95)'; ctx.lineWidth = Math.max(2, T * 0.06); const y0 = r.by - r.dh - T * 0.12, k = T * 0.11; ctx.beginPath(); ctx.moveTo(cx - k, y0 - k); ctx.lineTo(cx + k, y0 + k); ctx.moveTo(cx + k, y0 - k); ctx.lineTo(cx - k, y0 + k); ctx.stroke(); ctx.restore(); }   // 火を入れると、ここが消える
        } });
      });
      list.push({ z: V.flam.y + 0.999, f: () => drawChar('flam', V.flam, now) });
      list.push({ z: V.luno.y + 1.001, f: () => drawChar('luno', V.luno, now) });
      drawList(list);
    }

    const SCENES = { s1: drawS1, s2: drawS2, s4: drawS4, s7: drawS7 };

    /* ---------- 効果（きらめき・波紋・受け渡しの光） ---------- */
    function drawFx(G, now) {
      const a = G.fx; if (!a.length) return;
      for (let i = a.length - 1; i >= 0; i--) {
        const e = a[i], t = (now - e.t0) / e.life;
        if (t >= 1) { a.splice(i, 1); continue; }
        if (t < 0) continue;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        if (e.k === 'spark') {
          const x = (e.x + e.vx * t * 0.8 + 0.5) * T, y = (e.y + e.vy * t * 0.8 + 0.5) * T + t * t * T * 0.4;
          ctx.globalAlpha = 1 - t; ctx.fillStyle = e.c; ctx.beginPath(); ctx.arc(x, y, T * e.r * (1 - 0.5 * t), 0, 7); ctx.fill();
        } else if (e.k === 'ring') {
          ctx.globalAlpha = (1 - t) * 0.9; ctx.strokeStyle = e.c; ctx.lineWidth = Math.max(1.5, T * 0.05);
          ctx.beginPath(); ctx.ellipse((e.x + 0.5) * T, (e.y + 0.6) * T, T * (e.r0 + (e.r1 - e.r0) * t), T * (e.r0 + (e.r1 - e.r0) * t) * 0.6, 0, 0, 7); ctx.stroke();
        } else if (e.k === 'fly') {   // 火の玉が飛んでいく
          const q = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          const x = (e.x + (e.x2 - e.x) * q + 0.5) * T, y = (e.y + (e.y2 - e.y) * q + 0.35) * T - Math.sin(q * Math.PI) * T * 0.5;
          glow(x, y, T * 0.34, '255,190,90', 0.9); ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(x, y, T * 0.07, 0, 7); ctx.fill();
        }
        ctx.restore();
      }
    }

    function frame(G, now) {
      resize();
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.save();
      if (G.shake && now < G.shake.until) {
        const a = (G.shake.until - now) / G.shake.ms;
        ctx.translate(Math.sin(now * 0.09) * G.shake.amp * a * T, Math.cos(now * 0.13) * G.shake.amp * a * T * 0.6);
      }
      SCENES[G.sid](G, now);
      drawFx(G, now);
      ctx.restore();
      const g = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.38, canvas.width / 2, canvas.height / 2, canvas.width * 0.7);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + RT.VIGNETTE + ')');
      ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (G.fade) { ctx.fillStyle = 'rgba(' + G.fade.c + ',' + G.fade.a + ')'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    }
    return { frame, resize, T: () => T };
  }

  /* ---------- 台詞欄の顔アイコン ---------- */
  function portrait(cv, name) {
    const f = F[name]; if (!f || !IMG) return;
    const g = cv.getContext('2d'), s = cv.width, srcH = Math.min(f.h, f.w * 1.05);
    g.clearRect(0, 0, s, s); g.imageSmoothingQuality = 'high';
    const sc = Math.min(s / f.w, s / srcH);
    g.drawImage(IMG, f.x, f.y, f.w, srcH, (s - f.w * sc) / 2, 0, f.w * sc, srcH * sc);
  }

  /* ---------- タイトルの情景（坑道の入口にルノとフラメト） ---------- */
  function title(cv, now) {
    const g = cv.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2.5), r = cv.getBoundingClientRect();
    const w = Math.max(240, Math.round((r.width || 480) * dpr)), h = Math.round(w * 0.46);
    if (cv.width !== w) { cv.width = w; cv.height = h; }
    const T = w / 11, k = T / 96;
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingQuality = 'high';
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#171322'); bg.addColorStop(1, '#2b2233'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const sp = (n, cx, by, s, o) => { const f = F[n], sc = s * k; g.save(); if (o && o.a != null) g.globalAlpha = o.a; g.drawImage(IMG, f.x, f.y, f.w, f.h, cx - f.w * sc / 2, by - f.h * sc, f.w * sc, f.h * sc); g.restore(); };
    for (let x = 0; x < 11; x++) { const f = F['mine_floor' + [0, 1, 2, 3, 1, 0, 4, 2, 1, 3, 0][x]]; g.drawImage(IMG, f.x, f.y, f.w, f.h, Math.floor(x * T), h - T * 0.9, Math.ceil(T), Math.ceil(T)); }
    const gl = g.createRadialGradient(w / 2, h * 0.5, 0, w / 2, h * 0.5, w * 0.35); gl.addColorStop(0, 'rgba(255,190,110,.35)'); gl.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = gl; g.fillRect(0, 0, w, h);
    sp('mine_entrance', w / 2, h - T * 0.55, 1.5);
    sp('crystal_big', T * 1.3, h - T * 0.25, 1.0, { a: 0.95 }); sp('crystal_mid', T * 2.3, h - T * 0.12, 0.9); sp('crystal_tall', w - T * 1.4, h - T * 0.2, 0.95); sp('crystal_rock', w - T * 2.4, h - T * 0.1, 0.8);
    const bob = Math.sin(now / 900) * T * 0.02;
    sp('luno_determined', w / 2 - T * 0.55, h - T * 0.1 + bob, 1.02); sp((Math.floor(now / 1300) % 2) ? 'flam_happy' : 'flam_sit', w / 2 + T * 0.55, h - T * 0.1, 1.0);
    const vg = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.66); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
  }

  window.Render = { load, create, portrait, title, RT, frames: F, img: () => IMG, hsh };
})();
