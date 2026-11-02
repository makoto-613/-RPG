/* ==========================================================================
   stage_paint.js ― 一枚絵の風景（廃坑の入口）を、プログラムで描く
   ・vista ：ゲームの中の「廃坑の入口」の場面（ドット絵らしく、段をつけて塗る）
   ・vistaReal ：タイトル画面（写実寄り。なめらかに塗り、細かい凹凸と夕日の向きで陰影をつける）
   どちらも、乱数のかわりに「同じ場所なら必ず同じ値になる」ノイズ（hsh・vnoise）を使うので、毎回同じ絵になります。
   E ＝ 描く大きさと素材 { w, h, HB, U, F, IMG, ST }（stage.js から渡す）
   ========================================================================== */
(function () {
  'use strict';
  const hsh = (x, y) => window.Render.hsh(x, y);   // 座標から決まる、ばらつきの値（render.js）
  const rnd2 = (x, y, sd) => (hsh(x + sd * 131, y + sd * 71) % 10007) / 10007;
  function vnoise(x, y, sd) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, a = rnd2(xi, yi, sd), b = rnd2(xi + 1, yi, sd), c = rnd2(xi, yi + 1, sd), d = rnd2(xi + 1, yi + 1, sd), u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
  function fbm(x, y, sd) { let t = 0, a = 0.5, f = 1; for (let o = 0; o < 4; o++) { t += a * vnoise(x * f, y * f, sd + o * 7); f *= 2; a *= 0.5; } return t / 0.9375; }
  const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function vista(cx, E) {
    const { w, h, HB, U, F, IMG, ST } = E;
    const PX = U / ST.VISTA_PX, W2 = Math.ceil(w / PX), H2 = Math.ceil(HB / PX), c = document.createElement('canvas'); c.width = W2; c.height = H2;
    const x2 = c.getContext('2d'), img = x2.createImageData(W2, H2), D = img.data;
    const C = { sky0: hex('#221d46'), sky1: hex('#6f4470'), sky2: hex('#d9826a'), sky3: hex('#f3b47a'), far1: hex('#55466f'), far2: hex('#3b3256'), rock0: hex('#3a3034'), rock1: hex('#6c5a52'), rock2: hex('#9a8170'), crack: hex('#241c22'),
      gr0: hex('#264a26'), gr1: hex('#4f7d37'), gr2: hex('#7aa24a'), dirt0: hex('#5e4430'), dirt1: hex('#8d6c4a'), fl: [hex('#f4e38c'), hex('#f2a6c4'), hex('#ffffff')] };
    const gyAt = (X) => h * 0.66 + Math.sin(X / w * 9) * U * 0.07 + (fbm(X / w * 6, 0.5, 5) - 0.5) * U * 0.2;
    const mtAt = (X) => h * (0.02 + 0.42 * Math.pow(Math.abs(X / w - 0.5) * 2, 1.5)) + (fbm(X / w * 7, 1.5, 9) - 0.5) * U * 0.9;   // 入口より山を十分高く
    const r1At = (X) => h * 0.4 + (fbm(X / w * 3, 2.5, 3) - 0.5) * h * 0.16, r2At = (X) => h * 0.48 + (fbm(X / w * 4.5, 3.5, 4) - 0.5) * h * 0.1;
    for (let j = 0; j < H2; j++) for (let i = 0; i < W2; i++) {
      const X = (i + 0.5) * PX, Y = (j + 0.5) * PX, gy = gyAt(X), mt = mtAt(X), dth = (BAYER[(j & 3) * 4 + (i & 3)] / 16 - 0.5);
      let col;
      if (Y > gy) {                                   // 草地と、入口へ続く土の道
        const t = (Y - gy) / (HB - gy + 1), pc = w * 0.5 + Math.sin((Y - gy) / U * 1.2) * U * 0.22, hw = U * 0.32 + (Y - gy) * 0.42, n = fbm(X / U * 2.4, Y / U * 2.4, 41);
        const edge = Math.abs(X - pc) - hw + (fbm(X / U * 3, Y / U * 3, 47) - 0.5) * U * 0.35;
        if (edge < 0) col = mix(C.dirt0, C.dirt1, Math.min(1, n * 1.2 + dth * 0.3));
        else { col = mix(C.gr0, n > 0.55 ? C.gr2 : C.gr1, Math.min(1, n * 1.15 + dth * 0.35)); const r = rnd2(i, j, 77); if (r > 0.992) col = C.fl[Math.floor(rnd2(j, i, 78) * 3)]; else if (r > 0.95) col = mix(col, C.gr2, 0.5); }
        col = mix(col, [10, 8, 20], t * 0.35 + (edge >= 0 && edge < U * 0.12 ? 0.15 : 0));
      } else if (Y > mt) {                            // 岩山（廃坑の入口がある）
        const n = fbm(X / U * 1.1, Y / U * 1.1, 21), m = fbm(X / U * 3.2, Y / U * 3.2, 25), cr = Math.abs(fbm(X / U * 0.7, Y / U * 1.6, 33) - 0.5);
        const q = Math.round((n * 0.7 + m * 0.3) * 6 + dth) / 6;   // 段をつけて塗る（ドット絵らしく）
        col = q < 0.5 ? mix(C.rock0, C.rock1, q / 0.5) : mix(C.rock1, C.rock2, (q - 0.5) / 0.5);
        if (cr < 0.012 && m > 0.45) col = mix(col, C.crack, 0.7);
        col = mix(col, [255, 170, 110], Math.max(0, X / w - 0.45) * 0.35);           // 夕日の当たる側
        col = mix(col, [16, 10, 22], Math.min(0.5, Math.max(0, (Y - mt) / (gy - mt + 1)) * 0.4));
        if (Y - mt < PX * 1.2) col = mix(col, [255, 200, 160], 0.25);              // 稜線のふち
      } else if (Y > r2At(X)) col = mix(C.far2, C.sky2, 0.15 + dth * 0.05);
      else if (Y > r1At(X)) col = mix(C.far1, C.sky2, 0.25 + dth * 0.05);
      else {                                          // 夕焼けの空（ドット絵らしく、段をつけて塗る）
        const v = Y / (h * 0.62), q = Math.round(Math.min(1, v) * 14 + dth) / 14;
        col = q < 0.45 ? mix(C.sky0, C.sky1, q / 0.45) : q < 0.8 ? mix(C.sky1, C.sky2, (q - 0.45) / 0.35) : mix(C.sky2, C.sky3, (q - 0.8) / 0.2);
      }
      const o = (j * W2 + i) * 4; D[o] = col[0]; D[o + 1] = col[1]; D[o + 2] = col[2]; D[o + 3] = 255;
    }
    x2.putImageData(img, 0, 0);
    cx.imageSmoothingEnabled = false; cx.drawImage(c, 0, 0, W2 * PX, H2 * PX); cx.imageSmoothingEnabled = true;
    // 入口（素材）を、ふちをぼかして岩肌になじませる
    const fe = F.mine_entrance, s2 = U / 96 * ST.GATE_S, ew = fe.w * s2, eh = fe.h * s2, ec = document.createElement('canvas'); ec.width = Math.ceil(ew); ec.height = Math.ceil(eh);
    const ex = ec.getContext('2d'); ex.imageSmoothingQuality = 'high'; ex.drawImage(IMG(), fe.x, fe.y, fe.w, fe.h, 0, 0, ew, eh);
    ex.globalCompositeOperation = 'destination-in'; const gm = ex.createRadialGradient(ew / 2, eh * 0.62, Math.min(ew, eh) * 0.38, ew / 2, eh * 0.62, Math.max(ew, eh) * 0.62); gm.addColorStop(0, 'rgba(0,0,0,1)'); gm.addColorStop(1, 'rgba(0,0,0,0)'); ex.fillStyle = gm; ex.fillRect(0, 0, ew, eh);
    cx.drawImage(ec, 5.5 * U - ew / 2, gyAt(5.5 * U) + U * 0.3 - eh);
  }
  // 写実寄りの一枚絵（タイトル画面用）：段をつけずになめらかに塗り、細かい凹凸と光の向き（夕日は右）で陰影をつける
  function fbmN(x, y, sd, oct) { let t = 0, a = 0.5, f = 1, n = 0; for (let o = 0; o < oct; o++) { t += a * vnoise(x * f, y * f, sd + o * 7); n += a; f *= 2.03; a *= 0.5; } return t / n; }
  // E.dawn：朝の光（左から）で描く（ゲームの中の「廃坑の入口」）。E.gate：入口の絵の名前（鉄の柵など）
  function vistaReal(cx, E) {
    const { w, h, HB, U, F, IMG } = E, dawn = !!E.dawn;
    const W2 = Math.min(760, Math.ceil(w / 2)), PX = w / W2, H2 = Math.ceil(HB / PX), c = document.createElement('canvas'); c.width = W2; c.height = H2;
    const x2 = c.getContext('2d'), img = x2.createImageData(W2, H2), D = img.data, sm = (a, b, t) => { t = Math.max(0, Math.min(1, (t - a) / (b - a))); return t * t * (3 - 2 * t); };
    const C = dawn
      ? { z0: hex('#5f8fc8'), z1: hex('#9dbde0'), z2: hex('#efd8be'), z3: hex('#ffe4c0'), z4: hex('#fff3dc'), haze: hex('#c4c8d4'),
        rk0: hex('#3a3633'), rk1: hex('#6d6259'), rk2: hex('#a39282'), rkw: hex('#e8d2b2'), g0: hex('#2a4a22'), g1: hex('#4d7b34'), g2: hex('#86ab56'), d0: hex('#5a4630'), d1: hex('#8c7152'), d2: hex('#b49874') }
      : { z0: hex('#1b1838'), z1: hex('#4a3360'), z2: hex('#b4606a'), z3: hex('#f0a46e'), z4: hex('#ffd29a'), haze: hex('#c98a8a'),
        rk0: hex('#2c2626'), rk1: hex('#5d5049'), rk2: hex('#8f7b6b'), rkw: hex('#d79b74'), g0: hex('#1f3a1c'), g1: hex('#3d6230'), g2: hex('#6c8f45'), d0: hex('#4a3826'), d1: hex('#7d6347'), d2: hex('#a68866') };
    const LS = dawn ? -1 : 1, side = (X) => (dawn ? Math.max(0, 0.55 - X / w) : Math.max(0, X / w - 0.45));   // 光の来る向き（朝は左、夕方は右）
    const gyAt = (X) => h * 0.66 + Math.sin(X / w * 9) * U * 0.06 + (fbmN(X / w * 6, 0.5, 5, 4) - 0.5) * U * 0.22;
    const mtAt = (X) => h * (0.15 + 0.36 * Math.pow(Math.abs(X / w - 0.5) * 2, 1.3)) + (fbmN(X / w * 7, 1.5, 9, 5) - 0.5) * U * 1.0;
    const r1At = (X) => h * 0.4 + (fbmN(X / w * 3, 2.5, 3, 5) - 0.5) * h * 0.16, r2At = (X) => h * 0.48 + (fbmN(X / w * 4.5, 3.5, 4, 5) - 0.5) * h * 0.1;
    const sunX = dawn ? w * 0.14 : w * 0.84, sunY = dawn ? h * 0.3 : h * 0.5;
    for (let j = 0; j < H2; j++) for (let i = 0; i < W2; i++) {
      const X = (i + 0.5) * PX, Y = (j + 0.5) * PX, gy = gyAt(X), mt = mtAt(X), grain = (rnd2(i, j, 91) - 0.5) * 0.05;
      let col;
      if (Y > gy) {                                   // 草地と土の道（遠くほど細かく、手前ほど粗く）
        const dz = Math.max(0.15, (Y - gy) / (HB - gy)), sc = 1 / (0.35 + dz * 1.6), pc = w * 0.5 + Math.sin((Y - gy) / U * 1.2) * U * 0.22, hw = U * 0.3 + (Y - gy) * 0.42;
        const n = fbmN(X / U * 1.6 * sc, Y / U * 1.6 * sc, 41, 5), blade = fbmN(X / U * 22 * sc, Y / U * 5 * sc, 52, 3), spk = fbmN(X / U * 16 * sc, Y / U * 16 * sc, 57, 2);
        const edge = Math.abs(X - pc) - hw + (fbmN(X / U * 2.5, Y / U * 2.5, 47, 4) - 0.5) * U * 0.45;
        let gc = mix(mix(C.g0, C.g1, sm(0.2, 0.6, n)), C.g2, sm(0.5, 0.8, n * 0.45 + blade * 0.55)); gc = mix(gc, [10, 22, 10], sm(0.55, 0.75, spk) * 0.35); gc = mix(gc, hex('#9cb860'), sm(0.72, 0.8, blade) * 0.35);
        const dirt = mix(mix(C.d0, C.d1, sm(0.3, 0.7, n)), C.d2, rnd2(i, j, 63) > 0.93 ? 0.6 : 0);
        col = mix(dirt, gc, sm(-U * 0.08, U * 0.12, edge));
        col = mix(col, dawn ? [255, 240, 200] : [255, 190, 130], Math.max(0, 1 - Math.hypot(X - sunX, (Y - gy) * 2) / (w * 0.5)) * 0.18);   // 日の照り返し
        col = mix(col, [8, 8, 16], dz * (dawn ? 0.25 : 0.45));
      } else if (Y > mt) {                            // 岩山：細かい凹凸の起伏に、右からの光で陰影
        const e = 0.04, k = 1 / U * 0.9, hgt = (xx, yy) => fbmN(xx * k, yy * k, 21, 6);
        const hh = hgt(X, Y), dx = hgt(X + U * e, Y) - hgt(X - U * e, Y), dy = hgt(X, Y + U * e) - hgt(X, Y - U * e);
        const light = Math.max(0, Math.min(1, 0.55 + LS * dx * 9 - dy * 4)), fine = fbmN(X / U * 7, Y / U * 7, 29, 3);
        const rough = fbmN(X / U * 18, Y / U * 18, 37, 2), crk = Math.abs(fbmN(X / U * 1.2, Y / U * 3, 33, 4) - 0.5);
        col = mix(mix(C.rk0, C.rk1, sm(0.25, 0.65, hh * 0.6 + fine * 0.4)), C.rk2, light * 0.8); col = mix(col, [20, 16, 18], sm(0.5, 0.7, rough) * 0.25); if (crk < 0.014) col = mix(col, [22, 16, 20], 0.55 * (1 - crk / 0.014));
        col = mix(col, C.rkw, side(X) * light * 0.55);        // 日の当たる面
        col = mix(col, [12, 8, 16], sm(0, 1, (Y - mt) / (gy - mt + 1)) * (dawn ? 0.3 : 0.45));    // 足もとは暗く
        col = mix(col, C.rkw, Math.max(0, 1 - (Y - mt) / (U * 0.25)) * 0.35);       // 稜線の縁に日の光
        col = mix(col, C.haze, 0.08);
      } else if (Y > r2At(X)) { const t = (Y - r2At(X)) / (h * 0.3); col = mix(mix(hex(dawn ? '#6f7e96' : '#45395e'), C.haze, 0.35), dawn ? [60, 70, 80] : [25, 20, 40], sm(0, 1, t) * 0.5); }
      else if (Y > r1At(X)) { col = mix(hex(dawn ? '#8e9cb6' : '#5c4c75'), C.haze, 0.5 + fbmN(X / U * 2, Y / U * 2, 13, 4) * 0.1); }
      else {                                          // 夕焼けの空となめらかな雲
        const v = Y / (h * 0.6);
        col = v < 0.35 ? mix(C.z0, C.z1, sm(0, 0.35, v)) : v < 0.72 ? mix(C.z1, C.z2, sm(0.35, 0.72, v)) : mix(C.z2, C.z3, sm(0.72, 1, v));
        const cl = fbmN(X / w * 3.2, Y / h * 14, 61, 6), cm = sm(0.55, 0.75, cl) * sm(0.1, 0.5, v) * (1 - sm(0.85, 1, v));
        col = mix(col, mix(hex(dawn ? '#e9eef6' : '#7a4a6a'), C.z4, sm(0.4, 1, v)), cm * 0.6);
        const sd = Math.hypot(X - sunX, Y - sunY) / U; col = mix(col, C.z4, Math.max(0, 1 - sd / 3.2) * 0.55); if (sd < 0.45) col = mix(col, [255, 240, 205], 0.95);
      }
      const o = (j * W2 + i) * 4; D[o] = col[0] * (1 + grain); D[o + 1] = col[1] * (1 + grain); D[o + 2] = col[2] * (1 + grain); D[o + 3] = 255;
    }
    x2.putImageData(img, 0, 0);
    cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high'; cx.drawImage(c, 0, 0, W2 * PX, H2 * PX);
    // 入口（素材）を、ふちをぼかして岩肌になじませる
    const fe = F[E.gate] || F.mine_entrance, ew = E.gate ? U * 3.3 : fe.w * U / 96 * 2.25, eh = fe.h * ew / fe.w, ec = document.createElement('canvas'); ec.width = Math.ceil(ew); ec.height = Math.ceil(eh);
    const ex = ec.getContext('2d'); ex.imageSmoothingQuality = 'high'; ex.drawImage(IMG(), fe.x, fe.y, fe.w, fe.h, 0, 0, ew, eh);
    if (!E.gate) { ex.globalCompositeOperation = 'destination-in'; const gm = ex.createRadialGradient(ew / 2, eh * 0.62, Math.min(ew, eh) * 0.36, ew / 2, eh * 0.62, Math.max(ew, eh) * 0.62); gm.addColorStop(0, 'rgba(0,0,0,1)'); gm.addColorStop(1, 'rgba(0,0,0,0)'); ex.fillStyle = gm; ex.fillRect(0, 0, ew, eh); }
    cx.drawImage(ec, 5.5 * U - ew / 2, gyAt(5.5 * U) + U * 0.3 - eh);
    const vg = cx.createRadialGradient(w / 2, HB * 0.55, HB * 0.35, w / 2, HB * 0.55, w * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, dawn ? 'rgba(6,4,14,.2)' : 'rgba(6,4,14,.45)'); cx.fillStyle = vg; cx.fillRect(0, 0, w, HB);
  }

  window.StagePaint = { vista, vistaReal };
})();
