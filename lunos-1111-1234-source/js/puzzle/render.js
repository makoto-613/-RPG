/* ==========================================================================
   render.js ― 謎解きの盤面の絵（ドット絵アトラスの読み込み・切り出し／序章・区画1・4・7の仕掛けの描画）
   ゲームのルールには触れず、「今の状態」を受け取って canvas に描くだけです。
   ========================================================================== */
(function () {
  'use strict';
  const F = window.ATLAS.frames;
  const W = 11,
    H = 9;

  /* ★ 見た目の調整（ここを書き換えると絵の大きさや雰囲気が変わります） */
  const RT = {
    LUNO: 0.86, // ルノの大きさ
    FLAM: 0.92, // フラメトの大きさ
    DARK7: 0.8, // 区画7（灯火の間）で、明かりの届いていない床の暗さ（0＝明るい／1＝真っ暗）
    DARK7_WALL: 0.62, // 同じく、明かりの届いていない壁・燭台の暗さ（燭台の形は見えるくらいに）
    VIGNETTE: 0.38, // 画面の四隅を暗くする強さ
    BEAM_W: 0.17, // 光線の太さ（マス）
    GRID_S0: 0.25, // 羊追いの盤面のマス目の線の濃さ（0＝見えない／1＝はっきり）。草地でも見えるよう、明るい色で引く
    MIRROR_SIZE: 0.88 // 水晶の謎解きの鏡（台座）の大きさ（1マスに対する割合）
  };
  /* ★ 盤面の一枚絵（assets/puzzle_bg/s0.webp・s1.webp）
     src：盤面全体（11×9マス、外周の壁も含む）に当たる、絵の中の範囲 [左, 上, 幅, 高さ]（ピクセル。絵の外にはみ出してよい）
     rocks・slots：絵に描きこまれている小岩・足場の印のマス（ここはゲームで描かない。盤面を変えたら合わせる） */
  const ART = {
    s0: { src: [-9, 105, 1419, 990] }, // 柵の内側（絵の 120〜1281, 215〜985）が、中の9×7マスに重なる
    s1: {
      src: [-8, 4, 1425.6, 1170], // 1マス＝絵の約130ピクセル
      rocks: ['4,1', '5,2', '1,5', '7,6', '8,6'],
      slots: ['7,4', '7,5']
    },
    s4: { src: [18.2, 20.1, 1350.8, 1124.1] }, // 1マス＝絵の約123×125ピクセル。光源・水晶・石柱・割る石・扉が描いてある（鏡と光の線は消してある）
    s7: { src: [2, 11, 1320, 1062] } // 1マス＝絵の約120×118ピクセル。壁・燭台・扉が描いてある
  };
  const ART_IMG = {};
  Object.entries(window.PUZZLE_BG_URLS || {}).forEach(([k, uri]) => {
    const im = new Image();
    im.src = uri;
    ART_IMG[k] = im;
  });

  let IMG = null;

  function load(src) {
    return new Promise((res, rej) => {
      IMG = new Image();
      IMG.onload = () => res();
      IMG.onerror = () => rej(new Error('atlas'));
      IMG.src = src;
    });
  }
  // 座標から決まる、ばらつきの値（会話の場面の背景で使う）
  const hsh = (x, y) => {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
  };
  function create(canvas) {
    const ctx = canvas.getContext('2d');
    let T = 48,
      k = 0.5;

    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const w = Math.max(220, Math.round((r.width || 440) * dpr));
      if (canvas.width !== w || canvas.height !== Math.round((w * H) / W)) {
        canvas.width = w;
        canvas.height = Math.round((w * H) / W);
      } // 高さも確かめる（ノベルの場面から切り替わったとき、縦横比がずれないように）
      T = canvas.width / W;
      k = T / 96;
    }

    /* ---------- 描画の道具 ---------- */
    // 絵を「マスの下辺の中央」に立たせて描く。s＝大きさ、ox/oy＝ずらし（マス単位）
    function spr(n, x, y, o) {
      o = o || {};
      const cx = (x + 0.5 + (o.ox || 0)) * T,
        by = (y + 1 + (o.oy || 0)) * T;
      // 人物は高画質の絵（js/art/chars.js）で描く
      const spec = window.CharArt.fromSprite(n);
      if (spec) {
        const size = T * (spec.who === 'luno' ? 1.22 : 0.98) * (o.s == null ? 1 : o.s);
        const img = window.CharArt.get(spec.who, spec.pose);
        if (img) {
          const ww = (size * img.naturalWidth) / img.naturalHeight;
          ctx.save();
          if (o.a != null) ctx.globalAlpha = o.a;
          if (o.flip) {
            ctx.translate(cx, 0);
            ctx.scale(-1, 1);
            ctx.translate(-cx, 0);
          }
          ctx.drawImage(img, cx - ww / 2, by - size, ww, size);
          ctx.restore();
          return { cx, by, dw: ww, dh: size };
        }
        return null; // 絵の読みこみ前
      }
      const f = F[n],
        s = (o.s == null ? 1 : o.s) * k,
        dw = f.w * s,
        dh = f.h * s;
      ctx.save();
      if (o.a != null) ctx.globalAlpha = o.a;
      if (o.flip) {
        ctx.translate(cx, 0);
        ctx.scale(-1, 1);
        ctx.translate(-cx, 0);
      }
      ctx.drawImage(IMG, f.x, f.y, f.w, f.h, cx - dw / 2, by - dh, dw, dh);
      ctx.restore();
      return { cx, by, dw, dh };
    }
    function shadow(x, y, rx, a) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,' + (a == null ? 0.3 : a) + ')';
      ctx.beginPath();
      ctx.ellipse((x + 0.5) * T, (y + 0.93) * T, rx * T, rx * T * 0.34, 0, 0, 7);
      ctx.fill();
      ctx.restore();
    }
    function glow(cx, cy, r, rgb, a) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')');
      g.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 7);
      ctx.fill();
      ctx.restore();
    }
    function rr(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
    /* ---------- キャラクター ---------- */
    const DN = { U: 'up', D: 'down', L: 'left', R: 'right' };
    function charName(who, v, now) {
      if (v.pose) return v.pose;
      const d = v.dir || 'D',
        fr = d === 'D' ? window.CharArt.downFrame(v, now) : v.moving ? Math.floor(v.ph * 2) % 4 : 0; // 下向きは1マスごとに足を入れかえる
      return (who === 'luno' ? 'luno_' : 'flam_') + DN[d] + fr;
    }
    function drawChar(who, v, now) {
      const bob = v.moving ? Math.abs(Math.sin(v.ph * Math.PI * 2)) * 0.035 : 0;
      let ox = 0;
      if (v.shk && now < v.shk) ox = Math.sin(now * 0.07) * 0.045;
      shadow(v.x, v.y, who === 'luno' ? 0.27 : 0.25, 0.32);
      spr(charName(who, v, now), v.x, v.y, {
        s: who === 'luno' ? RT.LUNO : RT.FLAM,
        oy: -bob - (v.lift || 0),
        ox
      });
    }

    /* ---------- 改修版：盤面の共通視認性レイヤー ----------
       壁、床、装置、移動できる隣のマスを視覚的に区別する。
       全てのマーカーはコアルールの step/passable と同じ情報を使う。 */
    // 盤面はすべて一枚絵なので、壁の線・段差の影は描かない（壁や段差は絵に描いてある）
    function drawGrid(G, now) {
      const rows = G.L.rows,
        s = G.s,
        sid = G.sid;
      const candleLight = sid === 's7' ? G.M.litMap(G.L, s) : null;
      const wall = (x, y) => {
        if (x < 0 || y < 0 || x >= W || y >= H) return true;
        const c = rows[y][x];
        return c === '#' || (sid === 's1' && c === 'X');
      };
      ctx.save();
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const c = rows[y][x],
            px = x * T,
            py = y * T,
            solid = wall(x, y);
          let blocked = solid;
          if (sid === 's0' && 'Btyo'.includes(c)) blocked = true;
          if (sid === 's1' && c === 'o') blocked = true;
          if (sid === 's4' && 'pSTbX'.includes(c)) blocked = true;
          if (candleLight && !solid && c !== 'E' && !candleLight[x + ',' + y]) blocked = true;
          if (blocked && !solid) {
            if (candleLight) {
              // 灯りの外は「遮られた床」として暗く描く。×の乱立を避ける
              ctx.fillStyle = 'rgba(7,7,21,.22)';
              ctx.fillRect(px + 1, py + 1, T - 2, T - 2);
            } else {
              ctx.fillStyle = 'rgba(58,21,29,.12)';
              ctx.fillRect(px + 1, py + 1, T - 2, T - 2);
              ctx.fillStyle = 'rgba(255,161,143,.65)';
              ctx.font = '700 ' + Math.max(9, Math.round(T * 0.21)) + 'px sans-serif';
              ctx.textAlign = 'right';
              ctx.textBaseline = 'top';
              ctx.fillText('×', px + T * 0.9, py + T * 0.05);
            }
          }
          // 境界線は一辺につき一回だけ描き、白い格子の二重線を防ぐ。
          // 石床の色に近い中間色を細く重ね、模様は隠さない。
          if (solid) continue;
          ctx.strokeStyle = sid === 's0' ? 'rgba(255,244,214,' + RT.GRID_S0 + ')' : 'rgba(165,158,145,.19)';
          ctx.lineWidth = Math.max(0.7, Math.min(1.1, T * 0.016));
          ctx.beginPath();
          ctx.moveTo(px + T - 0.5, py);
          ctx.lineTo(px + T - 0.5, py + T);
          ctx.moveTo(px, py + T - 0.5);
          ctx.lineTo(px + T, py + T - 0.5);
          if (x === 0) {
            ctx.moveTo(px + 0.5, py);
            ctx.lineTo(px + 0.5, py + T);
          }
          if (y === 0) {
            ctx.moveTo(px, py + 0.5);
            ctx.lineTo(px + T, py + 0.5);
          }
          ctx.stroke();
        }
      // コア判定が許す次の一歩だけ、淡い塗りと控えめな輪郭で示す
      const moves = [
        ['U', 0, -1],
        ['R', 1, 0],
        ['D', 0, 1],
        ['L', -1, 0]
      ];
      moves.forEach(([d, dx, dy]) => {
        const nx = s.px + dx,
          ny = s.py + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) return;
        const result = G.M.step(G.L, s, d);
        if (!result.changed) return;
        const walk = !!result.moved,
          px = nx * T,
          py = ny * T;
        ctx.fillStyle = walk ? 'rgba(45,202,189,.18)' : 'rgba(241,185,95,.19)';
        ctx.fillRect(px + T * 0.07, py + T * 0.07, T * 0.86, T * 0.86);
        ctx.strokeStyle = walk ? 'rgba(136,236,218,.42)' : 'rgba(255,215,131,.46)';
        ctx.lineWidth = Math.max(1.0, T * 0.023);
        ctx.strokeRect(px + T * 0.08, py + T * 0.08, T * 0.84, T * 0.84);
        // 中央の目印を小さなコーナー印に変更。足元やオブジェクトを隠さない。
        ctx.fillStyle = walk ? 'rgba(151,238,225,.56)' : 'rgba(255,225,154,.62)';
        ctx.fillRect(px + T * 0.12, py + T * 0.12, T * 0.13, Math.max(1, T * 0.024));
      });
      // 現在位置を示すリングは常に最後に描く
      const pulse = Math.sin(now / 360) * T * 0.025;
      ctx.lineWidth = Math.max(2, T * 0.045);
      ctx.strokeStyle = 'rgba(255,246,173,.93)';
      ctx.beginPath();
      ctx.ellipse((s.px + 0.5) * T, (s.py + 0.89) * T, T * (0.29 + pulse / T), T * 0.105, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 奥行きの順に並べて描く
    function drawList(list) {
      list.sort((a, b) => a.z - b.z);
      list.forEach((e) => e.f());
    }

    // 盤面の一枚絵を描く（読みこみ中は、下地の色だけ）
    function drawArt(sid) {
      const im = ART_IMG[sid],
        a = ART[sid];
      ctx.fillStyle = '#2a2219';
      ctx.fillRect(0, 0, W * T, H * T);
      if (!im || !im.complete || !im.naturalWidth) return;
      const [sx, sy, sw, sh] = a.src,
        kx = (W * T) / sw,
        ky = (H * T) / sh;
      // 絵の外にはみ出した部分は切りつめて描く
      const x0 = Math.max(0, sx),
        y0 = Math.max(0, sy),
        x1 = Math.min(im.naturalWidth, sx + sw),
        y1 = Math.min(im.naturalHeight, sy + sh);
      ctx.drawImage(
        im,
        x0,
        y0,
        x1 - x0,
        y1 - y0,
        (x0 - sx) * kx,
        (y0 - sy) * ky,
        (x1 - x0) * kx,
        (y1 - y0) * ky
      );
      // 絵の下・右が盤面に足りないときは、絵のいちばん端の帯を引きのばしてうめる
      const eb = (y1 - sy) * ky,
        er = (x1 - sx) * kx,
        band = 40;
      if (eb < H * T)
        ctx.drawImage(
          im,
          x0,
          y1 - band,
          x1 - x0,
          band,
          (x0 - sx) * kx,
          eb - 1,
          (x1 - x0) * kx,
          H * T - eb + 1
        );
      if (er < W * T)
        ctx.drawImage(
          im,
          x1 - band,
          y0,
          band,
          y1 - y0,
          er - 1,
          (y0 - sy) * ky,
          W * T - er + 1,
          (y1 - y0) * ky
        );
      return true;
    }
    /* ==================== 序章：羊追い ==================== */
    function drawS0(G, now) {
      const L = G.L,
        s = G.s,
        rows = L.rows,
        p = G.M.prep(L),
        V = G.vis;
      drawArt('s0'); // 一枚絵（柵・羊小屋・水桶・干し草が描いてある）
      // 小屋の入口：点線の枠と、上向きの矢印
      {
        const g = p.gate,
          px = g[0] * T,
          py = g[1] * T;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,226,150,.95)';
        ctx.fillStyle = 'rgba(255,226,150,.18)';
        ctx.lineWidth = Math.max(1.5, T * 0.04);
        ctx.setLineDash([T * 0.1, T * 0.07]);
        ctx.lineDashOffset = -now / 60;
        rr(px + T * 0.08, py + T * 0.1, T * 0.84, T * 0.82, T * 0.12);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      const list = [];
      // 羊小屋（B の範囲いっぱいに、入口の下辺にそろえて置く）
      {
        const bx = [],
          by = [];
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++)
            if (rows[y][x] === 'B' || rows[y][x] === 'g') {
              bx.push(x);
              by.push(y);
            }
        const x0 = Math.min.apply(null, bx),
          x1 = Math.max.apply(null, bx),
          y1 = Math.max.apply(null, by),
          wT = x1 - x0 + 1;
        list.push({
          z: y1 + 0.5,
          f: () => {
            if (s.inn) {
              ctx.save();
              ctx.font = '700 ' + Math.round(T * 0.3) + 'px "Zen Maru Gothic",system-ui,sans-serif';
              ctx.textAlign = 'center';
              ctx.fillStyle = 'rgba(255,240,200,.95)';
              ctx.strokeStyle = 'rgba(40,24,12,.8)';
              ctx.lineWidth = T * 0.06;
              const t = '羊 ×' + s.inn;
              ctx.strokeText(t, (x0 + wT / 2) * T, (y1 - 0.75) * T);
              ctx.fillText(t, (x0 + wT / 2) * T, (y1 - 0.75) * T);
              ctx.restore();
            }
          }
        });
      }
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          // 一枚絵には、柵・水桶・干し草が描いてある。岩は描いていないので、ここで描く
          if (rows[y][x] === 'o') list.push({ z: y + 1, f: () => spr('r_rocks', x, y, { s: 0.78 }) });
        }
      drawGrid(G, now);
      V.sheep.forEach((e, i) =>
        list.push({
          z: e.y + 1,
          f: () => {
            shadow(e.x, e.y, 0.3, 0.28);
            const bob = e.moving ? Math.abs(Math.sin(e.ph * Math.PI * 2)) * 0.04 : 0;
            spr(i % 2 ? 'sheep_graze' : 'sheep_idle', e.x, e.y, { s: 1.1, oy: -bob, flip: e.dir === 'R' });
          }
        })
      );
      list.push({ z: V.luno.y + 1.001, f: () => drawChar('luno', V.luno, now) });
      list.push({ z: V.flam.y + 1, f: () => drawChar('flam', V.flam, now) });
      drawList(list);
      // 夕暮れの色をうすく重ねる
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgb(236,178,150)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(60,30,80,.16)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore(); // 夕暮れの色
    }

    /* ==================== 区画1：トロッコと砂袋 ==================== */
    function drawS1(G, now) {
      const L = G.L,
        s = G.s,
        rows = L.rows,
        p = G.M.prep(L),
        V = G.vis;
      const xs = [],
        ys = [];
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++)
          if (rows[y][x] === 'X') {
            xs.push(x);
            ys.push(y);
          }
      // 一枚絵（壁・大岩・レール・終点の止め具・小岩・足場の印が描いてある）
      drawArt('s1');
      const inArt = (list, x, y) => ART.s1[list].includes(x + ',' + y);
      drawGrid(G, now);
      // 足場の印
      p.slots.forEach((q, i) => {
        if (s.filled[i] || inArt('slots', q[0], q[1])) return;
        const px = q[0] * T,
          py = q[1] * T;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,226,150,.9)';
        ctx.fillStyle = 'rgba(255,226,150,.16)';
        ctx.lineWidth = Math.max(1.5, T * 0.04);
        ctx.setLineDash([T * 0.1, T * 0.07]);
        ctx.lineDashOffset = -now / 60;
        rr(px + T * 0.1, py + T * 0.12, T * 0.8, T * 0.76, T * 0.12);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,226,150,.95)';
        ctx.beginPath();
        const cx = px + T * 0.5,
          cy = py + T * 0.5 + Math.sin(now / 300 + i) * T * 0.02;
        ctx.moveTo(cx, cy - T * 0.2);
        ctx.lineTo(cx + T * 0.17, cy + T * 0.08);
        ctx.lineTo(cx + T * 0.06, cy + T * 0.08);
        ctx.lineTo(cx + T * 0.06, cy + T * 0.2);
        ctx.lineTo(cx - T * 0.06, cy + T * 0.2);
        ctx.lineTo(cx - T * 0.06, cy + T * 0.08);
        ctx.lineTo(cx - T * 0.17, cy + T * 0.08);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });
      const list = [];
      // 大きな岩（絵に描いてある）：足場がそろってトロッコが止まったら、光らせる
      if (xs.length) {
        const x0 = Math.min.apply(null, xs),
          x1 = Math.max.apply(null, xs),
          y1 = Math.max.apply(null, ys),
          wT = x1 - x0 + 1;
        list.push({
          z: y1 + 1,
          f: () => {
            if (G.s.filled.every(Boolean) && s.locked)
              glow(
                (x0 + wT / 2) * T,
                (y1 - 0.4) * T,
                T * 1.5,
                '255,226,150',
                0.18 + 0.08 * Math.sin(now / 300)
              );
          }
        });
      }
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++)
          if (rows[y][x] === 'o' && !inArt('rocks', x, y))
            list.push({ z: y + 1, f: () => spr('obs_rocks', x, y, { s: 0.88 }) });
      if (s.chock)
        list.push({
          z: p.chock[1] + 0.9,
          f: () => {
            shadow(p.chock[0], p.chock[1], 0.3, 0.25);
            spr('wheel_chock', p.chock[0], p.chock[1], { s: 0.86, oy: -0.04 });
          }
        });
      list.push({
        z: p.rail + 1,
        f: () => {
          const x = V.trolley.x;
          shadow(x, p.rail, 0.42, 0.28);
          spr('cart_coal', x, p.rail, { s: 0.8, oy: -0.02 });
        }
      });
      p.slots.forEach((q, i) => {
        if (s.filled[i] && !V.bags.some((b) => b.absorb === i))
          list.push({
            z: q[1] + 1,
            f: () => {
              shadow(q[0], q[1], 0.36, 0.3);
              spr('sandbag', q[0], q[1], { s: 0.9 });
            }
          });
      });
      V.bags.forEach((b) =>
        list.push({
          z: b.y + 1,
          f: () => {
            shadow(b.x, b.y, 0.32, 0.3);
            spr('sandbag', b.x, b.y, { s: 0.9 });
          }
        })
      );
      list.push({ z: V.luno.over ? 50 : V.luno.y + 1.001, f: () => drawChar('luno', V.luno, now) });
      list.push({ z: V.flam.over ? 50 : V.flam.y + 1, f: () => drawChar('flam', V.flam, now) });
      drawList(list);
    }

    /* ==================== 区画4：水晶洞の集光器 ==================== */
    /* 鏡（上から見た絵 assets/puzzle_bg/s4_mirror.webp）：丸い石の台座に、斜めに置いた水晶。
       絵は「／」向き。「＼」のときは左右を反転して描く */
    function mirror(x, y, d, hot, now) {
      const im = ART_IMG.s4_mirror;
      if (!im || !im.complete || !im.naturalWidth) return;
      const cx = (x + 0.5) * T,
        cy = (y + 0.5) * T,
        S = T * RT.MIRROR_SIZE;
      ctx.save();
      // 影
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath();
      ctx.ellipse(cx + T * 0.03, cy + T * 0.06, S * 0.48, S * 0.46, 0, 0, 7);
      ctx.fill();
      ctx.translate(cx, cy);
      if (d !== '/') ctx.scale(-1, 1);
      ctx.drawImage(im, -S / 2, -S / 2, S, S);
      ctx.restore();
      if (hot) glow(cx, cy, T * 0.55, '170,225,255', 0.32 + 0.1 * Math.sin(now / 200 + x));
    }
    function drawS4(G, now) {
      const L = G.L,
        s = G.s,
        rows = L.rows,
        p = G.M.prep(L),
        V = G.vis;
      // 一枚絵（光源・水晶・石柱・割る石・扉が描いてある）。ここでは光と印だけを重ねる
      drawArt('s4');
      drawGrid(G, now);
      const tr = G.M.trace(L, s.ms);
      const hit = (x, y) => tr.lit.has(x + ',' + y);
      const list = [];
      // 光源
      list.push({
        z: p.src[1] + 1,
        f: () => {
          glow((p.src[0] + 0.6) * T, (p.src[1] + 0.45) * T, T * 0.8, '190,235,255', 0.3);
        }
      });
      // 水晶（光ったら輝き、まだのときは光を当てる場所の輪）と、光を二手に割る石の輝き
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const c = rows[y][x];
          if (c === 'T' || c === 'b')
            list.push({
              z: y + 1,
              f: () => {
                const on = hit(x, y),
                  bon = c === 'b';
                if (on)
                  glow(
                    (x + 0.5) * T,
                    (y + 0.45) * T,
                    T * 1.05,
                    bon ? '120,255,190' : '140,215,255',
                    0.5 + 0.15 * Math.sin(now / 200 + x)
                  );
                else {
                  // まだ光っていない水晶には、光を当てる場所の輪をつける
                  ctx.save();
                  ctx.strokeStyle = bon ? 'rgba(130,240,190,.75)' : 'rgba(160,220,255,.8)';
                  ctx.lineWidth = Math.max(1.5, T * 0.04);
                  ctx.setLineDash([T * 0.09, T * 0.07]);
                  ctx.lineDashOffset = now / 70;
                  ctx.beginPath();
                  ctx.ellipse((x + 0.5) * T, (y + 0.86) * T, T * 0.42, T * 0.15, 0, 0, 7);
                  ctx.stroke();
                  ctx.restore();
                }
              }
            });
          if (c === 'X')
            list.push({
              z: y + 1,
              f: () => {
                // 光を二手に割る石
                const cx = (x + 0.5) * T,
                  cy = (y + 0.5) * T;
                glow(cx, cy, T * 0.7, '230,240,255', 0.25);
              }
            });
        }
      // 鏡
      p.mir.forEach((m, i) => list.push({ z: m[1] + 0.9, f: () => mirror(m[0], m[1], s.ms[i], false, now) }));
      // 出口
      {
        const e = p.exit;
        list.push({
          z: e[1] + 1,
          f: () => {
            if (s.open)
              glow(
                (e[0] + 0.5) * T,
                (e[1] + 0.5) * T,
                T * 1.2,
                '255,225,160',
                0.24 + 0.06 * Math.sin(now / 260)
              );
          }
        });
      }
      list.push({ z: V.luno.over ? 50 : V.luno.y + 1.001, f: () => drawChar('luno', V.luno, now) });
      list.push({ z: V.flam.over ? 50 : V.flam.y + 1, f: () => drawChar('flam', V.flam, now) });
      drawList(list);
      // 光線
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      [
        [RT.BEAM_W * 2.4, 0.1, '120,200,255'],
        [RT.BEAM_W * 1.3, 0.25, '170,225,255'],
        [RT.BEAM_W * 0.5, 0.95, '255,255,255']
      ].forEach((l) => {
        ctx.strokeStyle = 'rgba(' + l[2] + ',' + l[1] * (0.92 + 0.08 * Math.sin(now / 160)) + ')';
        ctx.lineWidth = l[0] * T;
        tr.segs.forEach((seg) => {
          ctx.beginPath();
          seg.forEach((q, i) => {
            if (i) ctx.lineTo(q[0] * T, q[1] * T);
            else ctx.moveTo(q[0] * T, q[1] * T);
          });
          ctx.stroke();
        });
      });
      ctx.restore();
      // 鏡に光が当たっているところの輝き
      tr.segs.forEach((seg) =>
        seg.slice(1, -1).forEach((q) => glow(q[0] * T, q[1] * T, T * 0.28, '210,240,255', 0.35))
      );
    }

    /* ==================== 区画7：灯火の間（一つ灯れば、二つは消える） ==================== */
    function drawS7(G, now) {
      const L = G.L,
        s = G.s,
        rows = L.rows,
        M = G.M,
        p = M.prep(L),
        V = G.vis,
        lit = M.litMap(L, s),
        open = M.isOpen(s);
      drawArt('s7'); // 一枚絵（壁・燭台・扉が描いてある）。ここでは暗さ・火・印だけを重ねる
      // 暗闇：明かりの届いていないマスは暗く（進めない）。届いているマスは、ほんのり暖かく
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const c = rows[y][x],
            wall = c === '#' || c === 'E',
            on = lit[x + ',' + y];
          if (on) {
            if (!wall && !p.pos[c]) {
              ctx.fillStyle = 'rgba(255,190,110,.07)';
              ctx.fillRect(x * T, y * T, T, T);
            }
          } else {
            ctx.fillStyle = 'rgba(6,5,18,' + (wall || p.pos[c] ? RT.DARK7_WALL : RT.DARK7) + ')';
            ctx.fillRect(x * T, y * T, T, T);
          } // 壁も暗く（明かりの届く所だけ見える）
        }
      drawGrid(G, now);
      // 隣の燭台：火を入れると消える二つを、線と ×印で前もって見せる
      const adj = p.ids.find((id) => {
        const q = p.pos[id];
        return !s.on[id] && Math.abs(q[0] - s.px) + Math.abs(q[1] - s.py) === 1;
      });
      if (adj) {
        const A = p.pos[adj];
        ctx.save();
        ctx.lineCap = 'round';
        ctx.setLineDash([T * 0.08, T * 0.1]);
        ctx.lineDashOffset = -now / 50;
        (L.links[adj] || []).forEach((o) => {
          const B = p.pos[o];
          ctx.strokeStyle = 'rgba(255,140,140,.75)';
          ctx.lineWidth = Math.max(1.5, T * 0.04);
          ctx.beginPath();
          ctx.moveTo((A[0] + 0.5) * T, (A[1] + 0.5) * T);
          ctx.lineTo((B[0] + 0.5) * T, (B[1] + 0.5) * T);
          ctx.stroke();
        });
        ctx.restore();
      }
      const list = [];
      // 扉（まんなかのランプが灯っている間だけ開く）
      {
        const e = p.door;
        list.push({
          z: e[1] + 1,
          f: () => {
            if (open)
              glow(
                (e[0] + 0.5) * T,
                (e[1] + 0.5) * T,
                T * 1.2,
                '255,225,160',
                0.24 + 0.06 * Math.sin(now / 260)
              );
          }
        });
      }
      // 燭台と奥のランプ
      p.ids.forEach((id) => {
        const q = p.pos[id],
          on = s.on[id],
          big = 'LMR'.indexOf(id) >= 0,
          mark = adj && (L.links[adj] || []).indexOf(id) >= 0;
        list.push({
          z: q[1] + 1,
          f: () => {
            if (on)
              glow(
                (q[0] + 0.5) * T,
                (q[1] + 0.35) * T,
                T * (big ? 1.5 : 1.1),
                '255,185,90',
                0.42 + 0.1 * Math.sin(now / 110 + q[0] * 3)
              );
            // 一枚絵には燭台が描いてあるので、火と印だけを重ねる（r：燭台の絵の下端 by と高さ dh）
            const r = { by: (q[1] + 0.85) * T, dh: T * 0.72 };
            const cx = (q[0] + 0.5) * T;
            if (on)
              for (let i = 0; i < 3; i++) {
                const fx = cx + (i - 1) * T * 0.2,
                  fy = r.by - r.dh * 0.82 - Math.abs(Math.sin(now / 90 + i * 2 + q[0])) * T * 0.04;
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = 'rgba(255,170,70,.6)';
                ctx.beginPath();
                ctx.ellipse(fx, fy, T * 0.05, T * 0.1, 0, 0, 7);
                ctx.fill();
                ctx.restore();
              }
            if (id === 'M') {
              ctx.save();
              ctx.fillStyle = on ? '#fff2b8' : 'rgba(255,225,150,.8)';
              ctx.font = '700 ' + Math.round(T * 0.2) + 'px "Zen Maru Gothic",sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('◆', cx, r.by - r.dh - T * 0.06);
              ctx.restore();
            } // 道のまんなか
            if (mark && on) {
              ctx.save();
              ctx.strokeStyle = 'rgba(255,120,120,.95)';
              ctx.lineWidth = Math.max(2, T * 0.06);
              const y0 = r.by - r.dh - T * 0.12,
                k = T * 0.11;
              ctx.beginPath();
              ctx.moveTo(cx - k, y0 - k);
              ctx.lineTo(cx + k, y0 + k);
              ctx.moveTo(cx + k, y0 - k);
              ctx.lineTo(cx - k, y0 + k);
              ctx.stroke();
              ctx.restore();
            } // 火を入れると、ここが消える
          }
        });
      });
      list.push({ z: V.flam.y + 0.999, f: () => drawChar('flam', V.flam, now) });
      list.push({ z: V.luno.y + 1.001, f: () => drawChar('luno', V.luno, now) });
      drawList(list);
    }

    const SCENES = { s0: drawS0, s1: drawS1, s4: drawS4, s7: drawS7 };

    /* ---------- 効果（きらめき・波紋・受け渡しの光） ---------- */
    function drawFx(G, now) {
      const a = G.fx;
      if (!a.length) return;
      for (let i = a.length - 1; i >= 0; i--) {
        const e = a[i],
          t = (now - e.t0) / e.life;
        if (t >= 1) {
          a.splice(i, 1);
          continue;
        }
        if (t < 0) continue;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        if (e.k === 'spark') {
          const x = (e.x + e.vx * t * 0.8 + 0.5) * T,
            y = (e.y + e.vy * t * 0.8 + 0.5) * T + t * t * T * 0.4;
          ctx.globalAlpha = 1 - t;
          ctx.fillStyle = e.c;
          ctx.beginPath();
          ctx.arc(x, y, T * e.r * (1 - 0.5 * t), 0, 7);
          ctx.fill();
        } else if (e.k === 'ring') {
          ctx.globalAlpha = (1 - t) * 0.9;
          ctx.strokeStyle = e.c;
          ctx.lineWidth = Math.max(1.5, T * 0.05);
          ctx.beginPath();
          ctx.ellipse(
            (e.x + 0.5) * T,
            (e.y + 0.6) * T,
            T * (e.r0 + (e.r1 - e.r0) * t),
            T * (e.r0 + (e.r1 - e.r0) * t) * 0.6,
            0,
            0,
            7
          );
          ctx.stroke();
        } else if (e.k === 'fly') {
          // 火の玉が飛んでいく
          const q = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          const x = (e.x + (e.x2 - e.x) * q + 0.5) * T,
            y = (e.y + (e.y2 - e.y) * q + 0.35) * T - Math.sin(q * Math.PI) * T * 0.5;
          glow(x, y, T * 0.34, '255,190,90', 0.9);
          ctx.fillStyle = '#fff3c4';
          ctx.beginPath();
          ctx.arc(x, y, T * 0.07, 0, 7);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    function frame(G, now) {
      resize();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#191525';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.save();
      if (G.shake && now < G.shake.until) {
        const a = (G.shake.until - now) / G.shake.ms;
        ctx.translate(
          Math.sin(now * 0.09) * G.shake.amp * a * T,
          Math.cos(now * 0.13) * G.shake.amp * a * T * 0.6
        );
      }
      try {
        const drawScene = SCENES[G.sid];
        if (!drawScene) throw new Error('不明な盤面: ' + G.sid);
        drawScene(G, now);
      } catch (err) {
        // 描画処理で予期せぬエラーが発生しても真っ暗な画面にしない。
        // ルール・セーブ状態は触らず、操作可能な簡易盤面を表示する。
        if (!frame.reported || frame.reported !== G.sid + ':' + err.message) {
          frame.reported = G.sid + ':' + err.message;
          console.error('盤面描画のフォールバック:', err);
          if (window.UI && window.UI.banner) window.UI.banner('背景を簡易表示に切り替えました', 'warn', 3000);
        }
        ctx.save();
        ctx.fillStyle = '#2e2933';
        ctx.fillRect(0, 0, W * T, H * T);
        const rows = (G.L && G.L.rows) || [];
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            const wall = !!(rows[y] && rows[y][x] === '#');
            const px = x * T,
              py = y * T;
            ctx.fillStyle = wall ? '#373038' : '#75665b';
            ctx.fillRect(px, py, T, T);
            ctx.strokeStyle = 'rgba(220,208,188,.19)';
            ctx.lineWidth = Math.max(0.5, T * 0.015);
            ctx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
          }
        if (G.s) {
          ctx.fillStyle = '#ffe5a5';
          ctx.beginPath();
          ctx.arc((G.s.px + 0.5) * T, (G.s.py + 0.5) * T, T * 0.26, 0, 7);
          ctx.fill();
        }
        ctx.restore();
      }
      drawFx(G, now);
      ctx.restore();
      const g = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        canvas.height * 0.38,
        canvas.width / 2,
        canvas.height / 2,
        canvas.width * 0.7
      );
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,' + RT.VIGNETTE + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (G.fade) {
        ctx.fillStyle = 'rgba(' + G.fade.c + ',' + G.fade.a + ')';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
    return { frame, resize, T: () => T };
  }

  /* ---------- 台詞欄の顔アイコン ---------- */
  function portrait(cv, name) {
    const g = cv.getContext('2d'),
      w = cv.width,
      h = cv.height;
    g.clearRect(0, 0, w, h);
    const spec = window.CharArt.fromSprite(name);
    if (spec) {
      const img = window.CharArt.get(spec.who, spec.pose);
      if (img) {
        // 台詞の枠の顔：絵の上のほう（頭と肩）を切り出す
        const isDog = spec.who === 'flam';
        const cropH = img.naturalHeight * (isDog ? 0.68 : 0.42);
        const cropW = Math.min(img.naturalWidth, cropH * 0.97);
        const srcX = (img.naturalWidth - cropW) / 2;
        const sc = Math.min(w / cropW, h / cropH) * 0.96;
        const dw = cropW * sc,
          dh = cropH * sc;
        g.imageSmoothingEnabled = true;
        g.drawImage(img, srcX, 0, cropW, cropH, (w - dw) / 2, (h - dh) / 2, dw, dh);
        return;
      }
    }
  }

  window.Render = { load, create, portrait, img: () => IMG, hsh };
})();
