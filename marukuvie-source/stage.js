/* ==========================================================================
   stage.js ― ノベル場面の描画（背景・立ち絵・演出）
   story.js の { sc:'場面名', c:{ luno:['idle',3.4], … } } を受けて、canvas に場面を描きます。
   場面の一覧と見た目の調整値は stage_data.js、廃坑の入口の一枚絵は stage_paint.js にあります。
   背景・人物・敵は、ご提供のドット絵素材（床・壁・小物・牧草地・祖父母宅・アルボ・アミーナ・敵）を並べて作り、素材のない空と遠くの丘だけ canvas で描いています。
   ========================================================================== */
(function () {
  'use strict';
  const F = window.ATLAS.frames;

  const { ST, POSE, SETS, PRESETS } = window.StageData;   // 場面のデータ（stage_data.js）
  const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const hsh = (x, y) => window.Render.hsh(x, y);   // 座標から決まる、ばらつきの値（render.js）
  const nowT = () => performance.now();

  function create(canvas, opt) {
    opt = opt || {};   // opt.cover：タイトル画面用。台詞の枠がないので、場面を縮めず、画面いっぱいに広げる
    const g = canvas.getContext('2d');
    const dk = document.createElement('canvas'), dg = dk.getContext('2d');
    let w = 528, h = 360, HB = 360, U = 48, OX = 0, OY = 0; const FEET = ST.FEET;
    const S = { item: null, spec: null, chars: {}, lamps: [0, 0, 0], enemy: null, fadeA: 0, fade: null, flashT: 0, shakeUntil: 0, shakeMs: 1, shakeAmp: 0, dust: false, t0: nowT(), pose: {} };

    function resize() {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const ww = Math.max(220, Math.round((r.width || 440) * dpr));
      const ratio = r.width > 0 && r.height > 0 ? r.height / r.width : ST.RATIO;   // 画面の窓の縦横比に合わせる（スマホでは縦長になる）
      const hh = Math.round(ww * ratio);
      if (canvas.width !== ww || canvas.height !== hh) { canvas.width = ww; canvas.height = hh; }
      const cw = canvas.width; HB = canvas.height;
      const ex = extent(), vm = Math.min(11, Math.max(ST.VIEW_MIN, Math.ceil((ex ? ex[1] - ex[0] : 0) * 2) / 2));   // 人物と敵が全員入る幅（マス）。入りきらないときだけ少し引いて見せる
      U = Math.max(cw / 11, Math.min(HB / 7.5, cw / vm));   // 縦長のときは、場面（横11マス）を少し拡大して、左右を切る
      w = Math.round(U * 11); OX = Math.round((cw - w) / 2);
      // h ＝ 場面の絵の高さ。床・壁・小物・人物の位置はすべて h を基準に決まるので、h を縮めると、足元と床の関係を保ったまま全体が上へ寄る。
      // h より下（台詞の枠の後ろ）は、床や地面をそのまま画面の下まで敷きつめる（HB ＝ 画面の本当の高さ）
      h = HB * (HB / cw > 1 ? ST.SCREEN_FEET_TALL : ST.SCREEN_FEET) / ST.FEET; OY = 0;
      if (opt.cover) { const ch = HB; U = Math.max(cw / 11, ch / 7.5); w = Math.round(U * 11); h = Math.round(U * 7.5); OX = Math.round((cw - w) / 2); OY = Math.round((ch - h) / 2); HB = h; }
      if (dk.width !== w || dk.height !== HB) { dk.width = w; dk.height = HB; }
    }

    /* ---------- 描画の道具 ---------- */
    function IMG() { return window.Render.img(); }
    // タイル：素材の縁の暗い線を切り落とし（TILE_INSET）、となりのタイルと1ピクセル重ねて、つなぎ目を目立たなくする
    function tile(n, x, y, sz) {
      const f = F[n]; if (!f) return;
      const i = Math.round(Math.min(f.w, f.h) * ST.TILE_INSET), px = Math.floor(x), py = Math.floor(y);
      g.drawImage(IMG(), f.x + i, f.y + i, f.w - 2 * i, f.h - 2 * i, px, py, Math.ceil(x + sz) - px + 1, Math.ceil(y + sz) - py + 1);
    }
    // 絵を「足元の中央」に置いて描く。s＝大きさ（1＝素材のまま×画面の拡大率）
    function spr(n, cx, by, s, o) {
      o = o || {}; const f = F[n]; if (!f) return null;
      const k = U / 96 * s, dw = f.w * k, dh = f.h * k;
      g.save();
      if (o.a != null) g.globalAlpha = o.a;
      if (o.flip) { g.translate(cx, 0); g.scale(-1, 1); g.translate(-cx, 0); }
      g.drawImage(IMG(), f.x, f.y, f.w, f.h, cx - dw / 2, o.hang ? by : by - dh, dw, dh);
      g.restore();
      return { dw, dh, cx, by: o.hang ? by + dh : by, top: o.hang ? by : by - dh };
    }
    function glow(cx, cy, r, rgb, a) {
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
      g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.restore();
    }
    function shadow(cx, by, rx, a) { g.save(); g.fillStyle = 'rgba(0,0,0,' + (a == null ? 0.3 : a) + ')'; g.beginPath(); g.ellipse(cx, by - U * 0.04, rx, rx * 0.2, 0, 0, 7); g.fill(); g.restore(); }
    function rr(x, y, ww, hh, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + ww, y, x + ww, y + hh, r); g.arcTo(x + ww, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + ww, y, r); g.closePath(); }
    const OUT = '#2a2029';
    function stroke(lw) { g.lineWidth = lw || Math.max(1.5, U * 0.04); g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke(); }

    /* ---------- 背景：牧草地・家・屋内（ご提供の「牧草地」「祖父母宅・外観／内観」の素材を並べる。空と遠くの丘は canvas） ---------- */
    // 絵を、指定した四角に合わせて描く（縦横の比率は変えてよいとき）
    function box(n, x, y, ww, hh, o) { const f = F[n]; if (!f) return; const i = o && o.tile ? Math.round(Math.min(f.w, f.h) * ST.TILE_INSET) : 0, e = i ? 1 : 0; g.save(); if (o && o.a != null) g.globalAlpha = o.a; g.drawImage(IMG(), f.x + i, f.y + i, f.w - 2 * i, f.h - 2 * i, x, y, ww + e, hh + e); g.restore(); }
    function drawSky(mood, now) {
      const dawn = mood === 'dawn';
      const sk = g.createLinearGradient(0, 0, 0, h * 0.66);
      if (dawn) { sk.addColorStop(0, '#7fa9d6'); sk.addColorStop(0.55, '#f2d3b0'); sk.addColorStop(1, '#fde7c6'); }
      else { sk.addColorStop(0, '#2f2652'); sk.addColorStop(0.45, '#b5626f'); sk.addColorStop(1, '#f0b06c'); }
      g.fillStyle = sk; g.fillRect(0, 0, w, HB);
      if (!dawn) { g.fillStyle = 'rgba(255,245,220,.8)'; for (let i = 0; i < 26; i++) { const x = (hsh(i, 3) % 1000) / 1000 * w, y = (hsh(i, 9) % 1000) / 1000 * h * 0.34, tw = 0.5 + 0.5 * Math.sin(now / 700 + i); g.globalAlpha = 0.25 + 0.5 * tw * (1 - y / (h * 0.4)); g.fillRect(x, y, Math.max(1.5, U * 0.04), Math.max(1.5, U * 0.04)); } g.globalAlpha = 1; }
      glow(w * 0.2, h * 0.47, w * 0.34, dawn ? '255,236,190' : '255,170,100', dawn ? 0.55 : 0.5);
      { const sx = w * 0.2, sy = h * 0.47, r = U * 0.5, sg = g.createRadialGradient(sx, sy, 0, sx, sy, r * 1.5);   // 太陽：ふちをやわらかく。下は遠くの丘に少し隠れる
        sg.addColorStop(0, dawn ? 'rgba(255,252,236,1)' : 'rgba(255,236,190,1)'); sg.addColorStop(0.62, dawn ? 'rgba(255,240,200,.95)' : 'rgba(255,205,140,.95)'); sg.addColorStop(1, 'rgba(255,220,160,0)');
        g.fillStyle = sg; g.beginPath(); g.arc(sx, sy, r * 1.5, 0, 7); g.fill(); }
      const hill = (yBase, amp, col, ph, f) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, HB); for (let x = 0; x <= w + 4; x += 4) g.lineTo(x, yBase + Math.sin(x / w * f + ph) * amp * h + Math.sin(x / w * f * 2.3 + ph * 2) * amp * h * 0.4); g.lineTo(w, HB); g.closePath(); g.fill(); };
      hill(h * 0.5, 0.06, dawn ? '#8ea6b4' : '#4a3a62', 0.5, 5);
      hill(h * 0.58, 0.04, dawn ? '#7a9a5e' : '#3a3550', 2.2, 4);
      // 牧草地（素材のタイルを敷く）
      const gy = h * 0.62, GR = ['p_grass0', 'p_grass1', 'p_grass2', 'p_grass1', 'p_flower', 'p_grass0', 'p_grass2'];
      layer('grass|' + mood, (cx) => stampFill(cx, GR, 0, gy, w, HB, 11, true));   // 草地：はんこでなめらかに
      const fade = g.createLinearGradient(0, gy - U * 0.1, 0, gy + U * 0.8); fade.addColorStop(0, dawn ? 'rgba(122,154,94,1)' : 'rgba(58,53,80,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = fade; g.fillRect(0, gy - U * 0.1, w, U * 0.9);
      // 家（祖父母宅）・柵・干し草
      drawHouse(9.0 * U, h * 0.72, dawn, now);
      for (let i = 0; i < 3; i++) spr('o_fence', (3.2 + i * 1.95) * U, h * 0.7, 0.92);
      spr('o_hay', 1.6 * U, h * 0.74, 1.0); spr('p_rock', 0.6 * U, h * 0.95, 0.9); spr('p_flowers', 10.5 * U, h * 0.98, 0.9); spr('p_flowers', 5.1 * U, h * 1.0, 0.8);
      propsAndLights(S.spec, now);   // 場面ごとの小物（羊など）
      g.fillStyle = dawn ? 'rgba(255,220,170,.08)' : 'rgba(40,20,70,.34)'; g.fillRect(0, gy, w, HB - gy);   // 夕暮れは暗く
    }
    function drawHouse(cx, by, dawn, now) {
      const s = 0.82, k = U / 96 * s, fw = F.o_wall_win, fd = F.o_wall_door;
      const ww = fw.w * k, dw = fd.w * k, wh = fw.h * k, total = ww + dw, x0 = cx - total / 2, top = by - wh;
      shadow(cx, by, total * 0.55, 0.28);
      box('o_wall_win', x0, top, ww, wh); box('o_wall_door', x0 + ww, by - fd.h * k, dw, fd.h * k);
      const fr = F.o_house, rw = total * 1.12, rh = rw * fr.h / fr.w;
      box('o_house', cx - rw / 2, top - rh * 0.72, rw, rh);
      if (!dawn) { glow(x0 + ww * 0.55, top + wh * 0.35, U * 1.3, '255,200,110', 0.4 + 0.05 * Math.sin(now / 300)); }
      spr('o_lamp', cx + total / 2 + U * 0.35, by + U * 0.02, 0.8);
      if (!dawn) glow(cx + total / 2 + U * 0.65, by - U * 0.75, U * 1.0, '255,190,100', 0.45);
    }
    function drawHouseIn(now) {
      const hz = h * 0.64, fw = F.h_wall, k = hz / fw.h, tw = fw.w * k;
      for (let i = 0, x = 0; x < w; i++, x += tw) box(i === 4 || i === 8 ? 'h_wall_win' : 'h_wall', x, 0, i === 4 || i === 8 ? F.h_wall_win.w * k : tw + 1, hz);
      layer('hfloor', (cx) => drawPlanks(cx, hz));   // 床板：横に長い板を、継ぎ目をずらして張る（マス目の線が出ないように）
      g.fillStyle = '#3a2618'; g.fillRect(0, hz - U * 0.06, w, U * 0.12);   // 幅木
      box('h_rug', w * 0.5 - U * 2.0, h * 0.78, U * 4.0, U * 1.2, { a: 0.95 });
      spr('h_fire', 1.25 * U, hz + U * 0.1, 1.05); spr('h_shelf', 3.0 * U, hz + U * 0.05, 1.0); spr('h_cupboard', 10.35 * U, hz + U * 0.05, 1.0);
      spr('h_herbs', 5.4 * U, U * 0.05, 0.8, { hang: true });
      const fl = 1 + Math.sin(now / 130) * 0.06;
      glow(1.25 * U, hz - U * 0.6, U * 3.2 * fl, '255,150,70', 0.42);   // 暖炉の火
      g.save(); g.fillStyle = 'rgba(30,14,10,.2)'; g.fillRect(0, 0, w, HB); g.restore();
      const P = S.spec;
      if (P.bed != null) drawBed(P.bed * U, FEET * h + U * 0.1);
      propsAndLights(P, now);
      if (P.pillowStone) { const B = bedBox(P.bed * U, FEET * h + U * 0.1), r = spr('life_stone', (P.bed + 0.95) * U, B.bt + B.bh * 0.31, 0.5); if (r) glow(r.cx, (r.top + r.by) / 2, U * 1.4, '230,150,255', 0.4 + 0.1 * Math.sin(now / 500)); }   // 枕の上にそっと置く
      if (P.night) {   // 夜：部屋を暗くし、暖炉とランプの明かりだけを残す
        g.save(); g.fillStyle = 'rgba(10,8,34,.55)'; g.fillRect(0, 0, w, HB); g.restore();
        glow(1.25 * U, h * 0.5, U * 3.4 * (1 + Math.sin(now / 130) * 0.05), '255,150,70', 0.45);
      }
    }
    // 板張りの床。奥ほど板の幅を細くして、奥行きを出す
    function drawPlanks(cx, hz) {
      const COL = ['#6e4a30', '#77503a', '#664329', '#7d5638', '#704c33'];
      let y = hz, row = 0;
      while (y < HB) {
        const t = (y - hz) / Math.max(1, HB - hz), rh = U * (0.2 + 0.24 * t);
        let x = -((hsh(row, 5) % 100) / 100) * U * 2.4, k = 0;
        while (x < w) {
          const len = U * (1.7 + (hsh(row, k + 9) % 100) / 100 * 1.6), hh = hsh(row * 31 + k, 17);
          cx.fillStyle = COL[hh % COL.length]; cx.fillRect(x, y, len, rh);
          cx.fillStyle = 'rgba(40,22,12,.18)';   // 木目
          for (let gl = 0; gl < 3; gl++) { const gy2 = y + rh * (0.25 + 0.25 * gl) + ((hh >>> (gl * 3)) % 5 - 2); cx.fillRect(x + len * 0.05, gy2, len * (0.5 + ((hh >>> (gl + 4)) % 40) / 100), Math.max(1, rh * 0.05)); }
          cx.fillStyle = 'rgba(255,220,170,.10)'; cx.fillRect(x, y, len, Math.max(1, rh * 0.08));   // 板の上のふちの光
          cx.fillStyle = '#2e1c12'; cx.fillRect(x + len - Math.max(1, U * 0.02), y, Math.max(1, U * 0.02), rh);   // 板の継ぎ目
          x += len; k++;
        }
        cx.fillStyle = '#2a190f'; cx.fillRect(0, y + rh - Math.max(1, U * 0.025), w, Math.max(1, U * 0.025));   // 板と板のすき間
        y += rh; row++;
      }
      const dk = cx.createLinearGradient(0, hz, 0, hz + U * 1.6); dk.addColorStop(0, 'rgba(20,10,6,.45)'); dk.addColorStop(1, 'rgba(20,10,6,0)'); cx.fillStyle = dk; cx.fillRect(0, hz, w, U * 1.6);   // 奥を暗く
    }
    // ベッド（家具）。アルボが寝ているときは、drawAlbo が頭と掛け布団を重ねる
    function bedBox(x, fy) { const fb = F.h_bed, kb = U / 96 * ST.CHAR_S * 0.95, bw = fb.w * kb, bh = fb.h * kb; return { fb, bw, bh, bx: x - bw / 2, bt: fy - bh }; }
    function drawBed(x, fy) { const b = bedBox(x, fy); shadow(x, fy, b.bw * 0.5, 0.3); g.drawImage(IMG(), b.fb.x, b.fb.y, b.fb.w, b.fb.h, b.bx, b.bt, b.bw, b.bh); }
    function drawMemory(now) {
      const bgr = g.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, w * 0.7);
      bgr.addColorStop(0, '#b08a6a'); bgr.addColorStop(0.5, '#5a4452'); bgr.addColorStop(1, '#1e1722'); g.fillStyle = bgr; g.fillRect(0, 0, w, HB);
      motes('255,225,190', now, 24);
    }

    /* ---------- 背景：洞窟（壁と床にタイルを敷く） ---------- */
    /* ---------- マス目を見せない描き方 ----------
       ① はんこ：素材のタイルのふちをぼかし、少しずつずらし・ときどき左右反転して重ねて敷く（岩や草のような自然なもの）
       ② 一枚絵：タイトル画面と廃坑の入口は、山・岩肌・草地・道を、ドット絵風に一枚の絵として描く */
    const STAMPS = {}, AVG = {}, LAYERS = new Map();
    function stampOf(n, S2) {
      const key = n + '|' + S2; if (STAMPS[key]) return STAMPS[key];
      const f = F[n], c = document.createElement('canvas'), x = c.getContext('2d'), i = Math.round(Math.min(f.w, f.h) * ST.TILE_INSET);
      c.width = c.height = S2; x.imageSmoothingQuality = 'high'; x.drawImage(IMG(), f.x + i, f.y + i, f.w - 2 * i, f.h - 2 * i, 0, 0, S2, S2);
      x.globalCompositeOperation = 'destination-in';
      const gr = x.createRadialGradient(S2 / 2, S2 / 2, S2 * 0.28, S2 / 2, S2 / 2, S2 * 0.6); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr; x.fillRect(0, 0, S2, S2);
      return (STAMPS[key] = c);
    }
    function avgOf(n) {   // 素材の平均の色（はんこの下地）
      if (AVG[n]) return AVG[n];
      const f = F[n], c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
      x.drawImage(IMG(), f.x + 8, f.y + 8, f.w - 16, f.h - 16, 0, 0, 1, 1);
      let d = [60, 50, 50]; try { d = x.getImageData(0, 0, 1, 1).data; } catch (e) { /* 読めなければ仮の色 */ }
      return (AVG[n] = 'rgb(' + d[0] + ',' + d[1] + ',' + d[2] + ')');
    }
    function stampFill(cx, names, x0, y0, x1, y1, seed, flipOk) {
      const S2 = Math.ceil(U * ST.STAMP_SIZE), step = U * ST.STAMP_STEP;
      cx.fillStyle = avgOf(names[0]); cx.fillRect(x0, y0, x1 - x0, y1 - y0);
      cx.save(); cx.beginPath(); cx.rect(x0, y0, x1 - x0, y1 - y0); cx.clip();
      for (let j = -1; y0 + j * step < y1 + step; j++) for (let i = -1; x0 + i * step < x1 + step; i++) {
        const hh = hsh(i + seed * 17, j + seed * 31), jx = ((hh % 997) / 997 - 0.5) * step * 0.45, jy = (((hh >>> 10) % 991) / 991 - 0.5) * step * 0.45;
        const st = stampOf(names[(hh >>> 5) % names.length], S2), px = x0 + (i + (j % 2 ? 0.5 : 0)) * step + jx, py = y0 + j * step + jy;
        if (flipOk && ((hh >>> 15) & 1)) { cx.save(); cx.translate(px, 0); cx.scale(-1, 1); cx.drawImage(st, -S2 / 2, py - S2 / 2); cx.restore(); }
        else cx.drawImage(st, px - S2 / 2, py - S2 / 2);
      }
      cx.restore();
    }
    // 動かない背景は、一度だけ描いて取っておく（毎回描き直さない）
    function layer(key, build) {
      const k = key + '|' + w + '|' + HB + '|' + Math.round(h);
      let c = LAYERS.get(k);
      if (!c) { c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(HB); const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; build(x); LAYERS.set(k, c); if (LAYERS.size > 8) LAYERS.delete(LAYERS.keys().next().value); }
      g.drawImage(c, 0, 0);
    }
    const names = (base, idx) => Array.from(new Set(idx)).map((i) => base + i);

    function drawVista(now) {
      const env = { w, h, HB, U, F, IMG, ST };
      layer(opt.cover ? 'vista_real' : 'vista', (cx) => (opt.cover ? window.StagePaint.vistaReal : window.StagePaint.vista)(cx, env));   // タイトル画面は、写実寄りの一枚絵
      g.fillStyle = 'rgba(255,245,220,.85)'; for (let i = 0; i < 18; i++) { const x = (hsh(i, 3) % 1000) / 1000 * w, y = (hsh(i, 9) % 1000) / 1000 * h * 0.22, r = Math.max(0.8, U * (opt.cover ? 0.012 : 0.02)); g.globalAlpha = 0.15 + 0.45 * (0.5 + 0.5 * Math.sin(now / 650 + i * 1.7)); g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } g.globalAlpha = 1;
      glow(w * 0.84, h * 0.5, w * 0.28, '255,170,100', 0.32);
      const gy = h * 0.66;
      [3.5, 7.5].forEach((x, i) => { const r = spr('o_lamp', x * U, gy + U * 0.45, 0.85, { flip: i === 1 }); if (r) glow(i ? r.cx - r.dw * 0.28 : r.cx + r.dw * 0.28, r.top + r.dh * 0.6, U * 1.3, '255,190,100', 0.5 + 0.08 * Math.sin(now / 130 + i)); });
      if (!opt.cover) { spr('p_rock', 1.6 * U, gy + U * 1.0, 1.1); spr('p_rock', 9.6 * U, gy + U * 0.8, 0.85); spr('o_hay', 10.5 * U, gy + U * 1.7, 0.9); spr('p_flowers', 0.7 * U, gy + U * 1.8, 0.9); }   // タイトル（写実寄り）では、ドット絵の小物は置かない
      glow(5.5 * U, gy - U * 0.9, U * 1.4, '255,180,100', 0.14);
      motes('255,220,150', now, 10);
      g.fillStyle = 'rgba(40,16,40,.16)'; g.fillRect(0, 0, w, HB);
    }

    function drawCave(P, now) {
      const set = SETS[P.set || 'mine'], hz = (P.horizon || ST.HORIZON) * h;
      // 壁と床：岩の場所は「はんこ」でなめらかに、祭壇などの石組みはタイルのまま（動かないので、一度描いて取っておく）
      layer('cave|' + (S.specName || '') + '|' + (P.set || 'mine'), (cx) => {
        if (set.natural) {
          stampFill(cx, names(set.w, set.wi), 0, 0, w, hz + U * 0.35, 7, true);
          stampFill(cx, names(set.f, set.fi), 0, hz - U * 0.1, w, HB, 3, true);
          const sh = cx.createLinearGradient(0, hz - U * 0.35, 0, hz + U * 0.3); sh.addColorStop(0, 'rgba(8,6,14,0)'); sh.addColorStop(0.5, 'rgba(8,6,14,.45)'); sh.addColorStop(1, 'rgba(8,6,14,0)'); cx.fillStyle = sh; cx.fillRect(0, hz - U * 0.35, w, U * 0.65);
        } else {
          const t2 = (n, x, y) => { const f = F[n], i = Math.round(Math.min(f.w, f.h) * ST.TILE_INSET), px = Math.floor(x), py = Math.floor(y); cx.drawImage(IMG(), f.x + i, f.y + i, f.w - 2 * i, f.h - 2 * i, px, py, Math.ceil(x + U) - px + 1, Math.ceil(y + U) - py + 1); };
          for (let y = 0; y * U < hz; y++) for (let x = 0; x < 12; x++) t2(set.w + set.wi[hsh(x + 7, y + 3) % set.wi.length], x * U, y * U);
          for (let y = Math.floor(hz / U); y * U < HB; y++) for (let x = 0; x < 12; x++) t2(set.f + set.fi[hsh(x, y) % set.fi.length], x * U, Math.max(y * U, hz - U * 0.2));
          cx.fillStyle = 'rgba(0,0,0,.28)'; cx.fillRect(0, hz - U * 0.06, w, U * 0.12);
        }
        const wg = cx.createLinearGradient(0, 0, 0, hz); wg.addColorStop(0, 'rgba(6,4,14,.62)'); wg.addColorStop(0.6, 'rgba(6,4,14,.18)'); wg.addColorStop(1, 'rgba(6,4,14,.05)'); cx.fillStyle = wg; cx.fillRect(0, 0, w, hz);
      });
      // 水路：奥と手前は水、人物の立つあたりは乾いた石の通路（人物が水の上に立たないように）
      const fr = Math.floor(now / 320);
      if (P.water) for (let y = Math.floor(hz / U); y * U < HB; y++) {
        const py = Math.max(y * U, hz), walk0 = FEET * h - U * 1.0, walk1 = FEET * h + U * 0.6;
        if (py > hz + U * 0.2 && (py + U <= walk0 + U * 0.5 || py >= walk1)) for (let x = 0; x < 12; x++) tile('water' + ((fr + x + y * 2) % 5), x * U, y * U, U);
      }
      if (P.rail) for (let x = 0; x < 12; x++) tile('mine_rail_h', x * U, hz + U * 0.2, U);
      if (P.water) {   // 通路と水の境目に、石の縁と水しぶきの線
        const top = (Math.floor((FEET * h - U * 1.0) / U) + 1) * U - U, edge = top + U * 0.5;
        const rows = []; for (let y = Math.floor(hz / U); y * U < HB; y++) { const py = Math.max(y * U, hz); rows.push([y * U, py > hz + U * 0.2 && (py + U <= FEET * h - U * 0.5 || py >= FEET * h + U * 0.6)]); }
        for (let i = 1; i < rows.length; i++) if (rows[i][1] !== rows[i - 1][1]) { const yy = rows[i][0]; g.fillStyle = 'rgba(20,14,24,.55)'; g.fillRect(0, yy - U * 0.06, w, U * 0.12); g.fillStyle = 'rgba(190,230,255,' + (0.25 + 0.1 * Math.sin(now / 300)) + ')'; g.fillRect(0, yy + (rows[i][1] ? U * 0.06 : -U * 0.1), w, Math.max(1, U * 0.04)); }
        void edge;
      }
      const fg = g.createLinearGradient(0, hz, 0, h); fg.addColorStop(0, 'rgba(6,4,14,.3)'); fg.addColorStop(1, 'rgba(6,4,14,0)'); g.fillStyle = fg; g.fillRect(0, hz, w, HB - hz);
    }
    function propsAndLights(P, now) {
      (P.props || []).forEach((p) => {
        const n = p[0], x = p[1], by = p[2], s = p[3], o = p[4] || {};
        if (!s) return;
        const r = spr(n, x * U, by * h + (o.dy || 0) * U, s, o);   // dy：足元からさらに上下へずらす量（マス）。机の上の品物など、画面の縦横比が変わってもずれないように
        if (r && o.glow) glow(r.cx, (r.top + r.by) / 2, r.dh * 0.9, o.glow, 0.22 + 0.06 * Math.sin(now / 420 + x));
        if (r && o.lamp) glow(r.cx - r.dw / 2 + r.dw * o.lamp[0], r.top + r.dh * o.lamp[1], U * 1.5, '255,190,100', 0.5 + 0.1 * Math.sin(now / 120 + x * 3));
      });
    }
    function drawLamps(now) {
      const xs = [4.3, 6.3, 8.3];
      xs.forEach((x, i) => {
        const r = spr('obs_lantern_post', x * U, 0.7 * h, 1.7); if (!r) return;
        const lx = r.cx - r.dw / 2 + r.dw * 0.84, ly = r.top + r.dh * 0.36;
        if (S.lamps[i]) {
          glow(lx, ly, U * 2.7, '255,190,100', 0.62 + 0.1 * Math.sin(now / 110 + i));
          glow(r.cx, r.by - U * 0.2, U * 1.6, '255,200,120', 0.2);
          g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,170,70,.65)'; g.beginPath(); g.ellipse(lx, ly - U * 0.02 - Math.abs(Math.sin(now / 90 + i)) * U * 0.03, U * 0.06, U * 0.12, 0, 0, 7); g.fill(); g.restore();
        }
      });
    }
    function drawPlaque(p) {
      const r = spr('plaque', p[0] * U, p[1] * h + U * 0.9, 1.35);
      if (r) glow(r.cx, (r.top + r.by) / 2, r.dw * 0.7, '255,215,140', 0.14);
    }
    function drawAltar(now) {
      spr('stairs', 5.5 * U, 0.62 * h, 1.75);
      // 台座：ご提供の「祭壇石床・壁」の祭壇（壁や床と同じ石）。石は天板の上に置く
      const px = 5.5 * U, py = ST.ALTAR_Y * h;
      shadow(px, py, U * 1.3, 0.35);
      const r = spr('altar_table', px, py, ST.ALTAR_S), topY = r ? r.top + r.dh * 0.1 : py - U;
      const pulse = 0.5 + 0.5 * Math.sin(now / 600);
      glow(px, topY - U * 0.5, U * (2.6 + pulse * 0.5), '230,150,255', 0.4 + 0.15 * pulse);
      spr('life_stone', px, topY + Math.sin(now / 700) * U * 0.05, 1.0);
      [2.4, 8.6].forEach((x, i) => { const r = spr('candle_stand', x * U, 0.66 * h, 0.9); if (r) { for (let k = 0; k < 7; k++) glow(r.cx - r.dw * 0.36 + k * r.dw * 0.12, r.top + r.dh * 0.2, U * 0.5, '255,190,100', 0.4 + 0.1 * Math.sin(now / 100 + k + i)); } });
    }
    function drawDesk(d, now) {   // 隠し部屋の古びた机：ご提供の家具の机（h_desk）に、日誌と水晶のかけらをのせる
      const x = d[0] * U, by = d[1] * h;
      shadow(x, by, U * 1.1, 0.35);
      const r = spr('h_desk', x, by, ST.DESK_S); if (!r) return;
      const top = r.top + r.dh * ST.DESK_TOP;   // 机の天板の高さ
      spr('i_journal', x - r.dw * 0.32, top, 0.5);
      spr('crystal_ore', x + r.dw * 0.1, top + Math.sin(now / 500) * U * 0.02, 0.55);
      glow(x + r.dw * 0.1, top - U * 0.35, U * 1.4, '130,255,200', 0.4);
    }

    /* ---------- 背景：入口（空と岩肌と廃坑の入口） ---------- */

    /* ---------- 立ち絵 ---------- */
    // ルノの絵は、もともと左を向いている。向きを書いていない場面では、歩いている間は進む方へ、立ち止まったら
    // 話し相手（ほかの人物・敵）や、場面の見どころ（祭壇の石・ベッド）のいる方へ向く。true ＝ 右を向く（左右反転）
    function lunoFace(c) {
      if (c.t0 != null && Math.abs(c.tx - c.x0) > 0.05) return c.tx > c.x0;
      if (c.f != null) return !!c.f;
      const xs = [];
      Object.keys(S.chars).forEach((k) => { const o = S.chars[k]; if (k === 'luno' || !o) return; const x = o.tx != null ? o.tx : o.x; if (x > -0.5 && x < 11.5) xs.push(x); });
      if (S.enemy) xs.push(S.enemy.x, S.enemy.x);   // 敵がいるときは、敵の方を強めに見る
      if (S.spec && S.spec.altar) xs.push(5.5);
      if (S.spec && S.spec.bed != null && !S.chars.albo) xs.push(S.spec.bed);
      const t = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 5.5;
      return Math.abs(t - c.x) < ST.FACE_DEAD ? false : t > c.x;
    }
    function drawLuno(c, now, fy) {
      const f = POSE.luno[c.p] || POSE.luno.idle, br = c.walk ? -Math.abs(Math.sin(now / 110)) * U * 0.08 : Math.sin(now / 900) * ST.BREATH * h;
      shadow(c.x * U, fy, U * 0.55, 0.32);
      spr(f, c.x * U, fy + br, ST.CHAR_S * (c.s || 1), { flip: lunoFace(c) });
    }
    function drawFlam(c, now, fy) {
      const f = POSE.flam[c.p] || POSE.flam.idle, br = c.walk ? -Math.abs(Math.sin(now / 95)) * U * 0.07 : Math.sin(now / 760 + 1) * ST.BREATH * h * 0.7;
      shadow(c.x * U, fy, U * (/^lie/.test(c.p) ? 1.1 : 0.8), 0.3);
      spr(f, c.x * U, fy + br, ST.CHAR_S * (c.s || 1) * 0.9, { flip: !!c.f });
    }
    // アルボ（祖父）・アミーナ（祖母）：ご提供の「アルボ（動き）」「アミーナ（動き）」から切り出した絵
    const ALBO = { idle: 'albo_idle', speak: 'albo_speak', surprised: 'albo_surprised', think: 'albo_think', sit: 'albo_sit', sleep: 'albo_sleep' };
    const AMINA = { stand: 'amina_idle', idle: 'amina_idle', happy: 'amina_happy', wave: 'amina_wave', sit: 'amina_sit' };
    function drawAlbo(c, now, fy) {
      const x = c.x * U, br = Math.sin(now / 1100) * ST.BREATH * h;
      if (c.p === 'bed' || c.p === 'bed_sleep') {   // ベッドの中：頭と肩だけを出して、掛け布団を上からかける（bed＝起きている／bed_sleep＝眠っている）
        const B = bedBox(x, fy), fb = B.fb, bw = B.bw, bh = B.bh, bx = B.bx, bt = B.bt;
        if (!S.spec || S.spec.bed == null) drawBed(x, fy);
        const sleep = c.p === 'bed_sleep', ka = U / 96 * ST.CHAR_S * 0.9;
        if (sleep) {   // 眠っている：頭と肩の絵（albo_bed_head）を、肩が布団に入るように枕の上へ置く
          const fa = F.albo_bed_head, aw = fa.w * ka * ST.BED_HEAD_SLEEP_S, ah = fa.h * ka * ST.BED_HEAD_SLEEP_S;
          g.drawImage(IMG(), fa.x, fa.y, fa.w, fa.h, x - aw / 2 + U * ST.BED_HEAD_SLEEP_DX, bt + bh * (ST.BED_FOLD + ST.BED_SLEEP_SINK) - ah + br, aw, ah);
        } else {   // 起きて座っている：考えている絵の上の方を使い、体は布団の下まで描く（切れ目が見えない）
          const fa = F.albo_think, aw = fa.w * ka, top = bt + bh * ST.BED_HEAD_SIT, part = Math.min(1, (bt + bh * (ST.BED_FOLD + 0.08) - top) / (fa.h * ka));
          g.drawImage(IMG(), fa.x, fa.y, fa.w, fa.h * part, x - aw / 2 + U * 0.08, top + br, aw, fa.h * part * ka);
        }
        const cut = ST.BED_FOLD;   // 折り返したシーツから下を、もう一度上に描く
        g.drawImage(IMG(), fb.x, fb.y + fb.h * cut, fb.w, fb.h * (1 - cut), bx, bt + bh * cut, bw, bh * (1 - cut));
        return;
      }
      shadow(x, fy, U * 0.6, 0.32);
      spr(ALBO[c.p] || ALBO.idle, x, fy + br, ST.CHAR_S * (c.s || 1), { flip: !!c.f });
    }
    function drawAmina(c, now, fy) {
      const x = c.x * U, br = Math.sin(now / 1000) * ST.BREATH * h, a = 0.88 + 0.08 * Math.sin(now / 500);
      glow(x, fy - U * 1.6, U * 2.8, '255,225,180', 0.4);   // 思い出の中の人なので、やわらかい光で包む
      spr(AMINA[c.p] || AMINA.stand, x, fy + br, ST.CHAR_S * (c.s || 1), { flip: !!c.f, a });
    }

    /* ---------- 効果 ---------- */
    // 回想の場面：色を抜いてセピア色にし、まわりをぼかしたように暗くして、左上に「回想」と出す
    let FONT_H = '';
    function memoFx() {
      const cw = canvas.width, ch = canvas.height;
      g.save();
      g.globalCompositeOperation = 'saturation'; g.fillStyle = 'rgba(128,128,128,' + ST.MEMO_GRAY + ')'; g.fillRect(0, 0, cw, ch);
      g.globalCompositeOperation = 'multiply'; g.fillStyle = ST.MEMO_TINT; g.fillRect(0, 0, cw, ch);
      g.globalCompositeOperation = 'source-over';
      const vg = g.createRadialGradient(cw / 2, ch * 0.42, Math.min(cw, ch) * 0.3, cw / 2, ch * 0.42, Math.max(cw, ch) * 0.62);
      vg.addColorStop(0, 'rgba(255,240,215,.08)'); vg.addColorStop(1, 'rgba(60,38,18,.62)'); g.fillStyle = vg; g.fillRect(0, 0, cw, ch);
      const fs = Math.max(12, Math.round(U * 0.26));
      g.font = '700 ' + fs + 'px ' + (FONT_H || (FONT_H = getComputedStyle(document.documentElement).getPropertyValue('--font-h').trim() || 'serif'));
      g.fillStyle = 'rgba(255,238,210,.85)'; g.textBaseline = 'top'; g.fillText('― 回想 ―', fs * 1.2, ch > cw ? ch * 0.13 : fs * 1.1);   // 縦長の画面では、上の状態表示に隠れないよう少し下に
      g.restore();
    }
    function motes(rgb, now, n) {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n; i++) {
        const sp = 0.00004 + (hsh(i, 1) % 100) / 100 * 0.00005, ph = (hsh(i, 2) % 1000) / 1000;
        const y = h - ((now * sp + ph) % 1) * h, x = ((hsh(i, 3) % 1000) / 1000 * w + Math.sin(now / 900 + i) * U * 0.25);
        g.fillStyle = 'rgba(' + rgb + ',' + (0.2 + 0.4 * Math.abs(Math.sin(now / 500 + i))) + ')'; g.beginPath(); g.arc(x, y, Math.max(1, U * 0.035), 0, 7); g.fill();
      }
      g.restore();
    }
    function dustFx(now) {
      g.save(); g.fillStyle = 'rgba(210,190,160,.55)';
      for (let i = 0; i < 38; i++) { const sp = 0.00012 + (hsh(i, 4) % 100) / 100 * 0.00018, ph = (hsh(i, 5) % 1000) / 1000, y = ((now * sp + ph) % 1) * h, x = (hsh(i, 6) % 1000) / 1000 * w + Math.sin(now / 700 + i) * U * 0.1; g.globalAlpha = 0.25 + 0.4 * ((hsh(i, 7) % 100) / 100); g.fillRect(x, y, Math.max(1.5, U * 0.05), Math.max(1.5, U * 0.05)); }
      g.restore();
    }
    // 暗がり（地面や壁を暗くして、明かりのまわりだけ見える）
    function darkness(P, now) {
      const lv = P.dark || 0; if (!lv && !P.tint) return;
      if (P.tint) { g.fillStyle = 'rgba(' + P.tint + ')'; g.fillRect(0, 0, w, HB); }
      if (!lv) return;
      dg.setTransform(1, 0, 0, 1, 0, 0); dg.globalCompositeOperation = 'source-over'; dg.clearRect(0, 0, dk.width, dk.height);
      dg.fillStyle = 'rgba(4,3,14,' + lv + ')'; dg.fillRect(0, 0, dk.width, dk.height);
      dg.globalCompositeOperation = 'destination-out';
      const lights = (P.lights || []).slice();
      if (P.lamps) S.lamps.forEach((on, i) => { if (on) lights.push([[4.3, 6.3, 8.3][i] + 0.4, 0.4, 3.4, '255,190,100', 0.4]); });
      lights.forEach((l) => { const x = l[0] * U, y = l[1] * h, r = l[2] * U * (1 + 0.03 * Math.sin(now / 160 + l[0])); const gr = dg.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,.95)'); gr.addColorStop(0.55, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); dg.fillStyle = gr; dg.beginPath(); dg.arc(x, y, r, 0, 7); dg.fill(); });
      // キャラクターのまわりも少し明るく
      Object.keys(S.chars).forEach((k) => { const c = S.chars[k]; if (!c || k === 'albo' || k === 'amina') return; const x = c.x * U, y = FEET * h - U * 1.2, r = U * 2.2; const gr = dg.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); dg.fillStyle = gr; dg.beginPath(); dg.arc(x, y, r, 0, 7); dg.fill(); });
      g.drawImage(dk, 0, 0);
    }

    // 人物（行き先）と敵の、左右の端（マス）。ベッドの中のアルボはベッドの幅で数える
    function extent() {
      let lo = 99, hi = -99;
      Object.keys(S.chars).forEach((k) => { const c = S.chars[k]; if (!c || c.hide) return; const x = c.tx != null ? c.tx : c.x, pd = k === 'albo' && /^bed/.test(c.p) ? ST.CAM_PAD * 1.5 : ST.CAM_PAD; if (x < -0.5 || x > 11.5) return; lo = Math.min(lo, x - pd); hi = Math.max(hi, x + pd); });
      if (S.enemy) { const pe = S.enemy.kind === 'boss' ? ST.CAM_PAD_BOSS : ST.CAM_PAD_ENEMY; lo = Math.min(lo, S.enemy.x - pe); hi = Math.max(hi, S.enemy.x + pe); }
      return lo > hi ? null : [Math.max(0, lo), Math.min(11, hi)];
    }
    // 縦長の画面（スマホ）では横が切れるので、人物と敵が全員入るように、見せる位置を左右へゆっくり動かす
    function camera() {
      const cw = canvas.width; if (cw >= w - 1) { S.cam = null; return; }
      const ex = extent(), want = ex ? (ex[0] + ex[1]) / 2 : 5.5, half = cw / U / 2, tgt = Math.max(half, Math.min(11 - half, want));
      S.cam = S.cam == null || S.camScene !== S.specName ? tgt : S.cam + (tgt - S.cam) * 0.06; S.camScene = S.specName;
      OX = Math.round(cw / 2 - S.cam * U);
    }
    /* ---------- 1フレーム ---------- */
    function frame(now) {
      resize();
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      const P = S.spec; if (!P) { g.fillStyle = '#000'; g.fillRect(0, 0, w, HB); return; }
      if (!opt.cover) camera();
      g.save(); g.translate(OX, OY);   // 縦長の画面では、人物がいるあたりを見せる（camera）
      if (now < S.shakeUntil) { const a = (S.shakeUntil - now) / S.shakeMs; g.translate(Math.sin(now * 0.09) * S.shakeAmp * a * U, Math.cos(now * 0.13) * S.shakeAmp * a * U * 0.6); }
      const fy = FEET * h;
      if (P.bg === 'sky') drawSky(P.mood, now);
      else if (P.bg === 'house') drawHouseIn(now);
      else if (P.bg === 'memory') drawMemory(now);
      else if (P.bg === 'vista') drawVista(now);
      else if (P.bg === 'black') { g.fillStyle = '#05040a'; g.fillRect(0, 0, w, HB); }
      else if (P.bg === 'cave') {
        drawCave(P, now);
        if (P.plaque) drawPlaque(P.plaque);
        propsAndLights(P, now);
        if (P.lamps) drawLamps(now);
        if (P.desk) drawDesk(P.desk, now);
        if (P.altar) drawAltar(now);
        darkness(P, now);
        if (P.motes) motes(P.motes, now, 22);
      }
      // 敵（戦闘前の場面）
      if (S.enemy && window.Enemy) { const e = S.enemy; window.Enemy.draw(g, e.kind, e.x * U, fy + U * 0.05, U * (e.kind === 'boss' ? 1.5 : 1.35), now, { dir: -1, big: true }); }
      // 立ち絵（奥行き順：足元の高さ→左から）
      ['albo', 'amina', 'flam', 'luno'].forEach((k) => {
        const c = S.chars[k]; if (!c) return;
        if (c.t0 != null) { const q = Math.min(1, (now - c.t0) / c.dur), e = q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2; c.x = c.x0 + (c.tx - c.x0) * e; c.walk = q < 1; if (q >= 1) c.t0 = null; }
        if (k === 'luno') drawLuno(c, now, fy); else if (k === 'flam') drawFlam(c, now, fy + U * 0.04); else if (k === 'albo') drawAlbo(c, now, fy + U * 0.1); else drawAmina(c, now, fy);
      });
      if (S.dust || P.dust) dustFx(now);
      if (S.item) {   // 品物を見せる（日誌・包帯など）：ふわっと出て、少しして消える
        const q = (now - S.item.t0) / ST.ITEM_MS;
        if (q >= 1) S.item = null; else {
          const a = q < 0.15 ? q / 0.15 : q > 0.8 ? (1 - q) / 0.2 : 1, y = h * 0.34 - (q < 0.15 ? (1 - q / 0.15) * U * 0.3 : 0);
          glow(5.5 * U, y - U * 0.5, U * 2.2, '255,235,180', 0.5 * a); spr(S.item.n, 5.5 * U, y, 0.95, { a });
        }
      }
      g.restore();
      if (P.memo) memoFx();   // 回想：色をあせさせて、セピア色に
      // 四隅を暗く
      const vg = g.createRadialGradient(w / 2, HB / 2, HB * 0.4, w / 2, HB / 2, w * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.4)'); g.fillStyle = vg; g.fillRect(0, 0, w, HB);
      // 切り替えの暗転・フラッシュ
      let fa = S.fadeA;
      if (S.fade) { const q = Math.min(1, (now - S.fade.t0) / S.fade.ms); fa = S.fade.from + (S.fade.to - S.fade.from) * q; S.fadeA = fa; if (q >= 1) { const d = S.fade.done; S.fade = null; if (d) d(); } }
      if (fa > 0.001) { g.fillStyle = 'rgba(0,0,0,' + fa + ')'; g.fillRect(0, 0, w, HB); }
      if (now < S.flashT) { g.fillStyle = 'rgba(255,255,255,' + Math.min(1, (S.flashT - now) / 300) * 0.85 + ')'; g.fillRect(0, 0, w, HB); }
    }

    /* ---------- 外から呼ぶ操作 ---------- */
    const toChars = (c) => { const o = {}; Object.keys(c || {}).forEach((k) => { const a = c[k]; o[k] = a ? { p: a[0], x: a[1], f: a[2] == null ? (k === 'luno' ? null : false) : !!a[2], s: a[3] || 1 } : null; }); return o; };   // ルノは向きを書かなければ自動（lunoFace）
    function fadeTo(to, ms) { return new Promise((res) => { if (REDUCED || !ms) { S.fadeA = to; S.fade = null; res(); return; } S.fade = { from: S.fadeA, to, t0: nowT(), ms, done: res }; }); }
    function apply(b) {
      if (b.sc) {
        const base = PRESETS[b.sc]; if (!base) throw new Error('場面がありません: ' + b.sc);
        S.spec = Object.assign({}, base); S.specName = b.sc; if (S.spec.lamps) S.lamps = S.spec.lamps.slice(); S.dust = false; S.enemy = null;
      }
      if (b.c) {
        const nc = toChars(b.c), base = b.sc ? {} : Object.assign({}, S.chars);
        Object.keys(nc).forEach((k) => {
          const o = base[k], n = nc[k];
          if (!n) { delete base[k]; return; }   // null ＝ その人物を場面から外す
          if (o && !b.sc && Math.abs(o.x - n.x) > 0.01) { n.x0 = o.x; n.tx = n.x; n.x = o.x; n.t0 = nowT(); n.dur = REDUCED ? 1 : Math.max(350, Math.abs(n.tx - n.x0) * ST.WALK_MS); }   // 歩いて移動する
          base[k] = n;
        });
        S.chars = base;
        // 人物どうしが重ならないように、近すぎるときは、あとから来た側をずらす（ルノは動かさない）
        const sep = (a, b, gap) => { const A = S.chars[a], Bc = S.chars[b]; if (!A || !Bc || (b === 'albo' && /^bed/.test(Bc.p))) return; const ax = A.tx != null ? A.tx : A.x, bx = Bc.tx != null ? Bc.tx : Bc.x, d = bx - ax; if (Math.abs(d) >= gap) return; const nx = ax + (d >= 0 ? gap : -gap); if (Bc.tx != null && Bc.t0 != null) Bc.tx = nx; else Bc.x = nx; };
        const G = ST.CHAR_GAP; sep('luno', 'flam', G.luno_flam); sep('luno', 'albo', G.luno_albo); sep('flam', 'albo', G.flam_albo); sep('luno', 'amina', G.luno_amina);
      }
      else if (b.sc) S.chars = {};
      if (b.enemy) S.enemy = { kind: b.enemy[0], x: b.enemy[1] };
      if (b.enemy === null) S.enemy = null;
      if (b.dust != null) S.dust = !!b.dust;
      if (b.item) S.item = { n: b.item, t0: nowT() };
    }
    return {
      frame,
      // 場面を切り替える（fade が真なら、暗転をはさむ）
      change(b, onShow) {   // onShow：新しい絵が見え始めた瞬間に呼ぶ（効果音を合わせるため）
        if (b.sc && b.fade) { return (S.spec ? fadeTo(1, ST.FADE_OUT_MS) : Promise.resolve()).then(() => { apply(b); S.fadeA = 1; const p = fadeTo(0, ST.FADE_IN_MS); if (onShow) onShow(); return p; }); }
        apply(b); if (b.sc) { S.fadeA = 0; S.fade = null; } if (onShow) onShow();
        return Promise.resolve();
      },
      shake(ms, amp) { S.shakeUntil = nowT() + ms; S.shakeMs = ms; S.shakeAmp = amp; },
      flash() { S.flashT = nowT() + 300; },
      setLamps(a) { S.lamps = a.slice(); },
      lamps: () => S.lamps.slice(),
      state: S, presets: PRESETS, poses: POSE
    };
  }
  window.Stage = { create, PRESETS, POSE, ST };
})();
