/* ==========================================================================
   stage.js ― ノベル場面の描画（背景・立ち絵・演出）
   story.js の { sc:'場面名', c:{ luno:['idle',3.4], … } } を受けて、canvas に場面を描きます。
   場面の一覧と見た目の調整値は stage_data.js にあります。
   背景・人物・敵は、ご提供のドット絵素材（床・壁・小物・牧草地・祖父母宅・アルボ・アミーナ・敵）を並べて作り、素材のない空と遠くの丘だけ canvas で描いています。
   ========================================================================== */
(function () {
  'use strict';
  const F = window.ATLAS.frames;

  const { ST, PRESETS } = window.StageData; // 場面のデータ（stage_data.js）
  // 新しい背景：ノベル背景だけを置換。読み込み不良時は従来の背景に戻す。
  /* ---------------- 新しい絵（背景）の読み込み ---------------- */
  const NEW_BG = {};
  Object.entries(window.NOVEL_BG_URLS || {}).forEach(([key, uri]) => {
    const im = new Image();
    NEW_BG[key] = im;
    im.src = uri;
  });
  // 場面の中身に合う絵を使う（場面名 → 使う背景画像の名前）
  //   return_path：区画10の帰り道・結末④は洞窟の中。明るい山里の絵ではなく、廃坑の通路の絵にする
  //   cavern：区画8の大空洞。真上から見た戦闘マップの絵ではなく、横から見た晶洞の絵にする
  //   house_stone：家の中（昼）の絵。house_night_desk：家（夜）の絵（机の上の日誌と石は、ゲームで描く小物）
  const BG_ALIAS = {
    return_path: 'mine_dark',
    house_stone: 'house_in',
    house_night_desk: 'house_night'
  };
  Object.keys(BG_ALIAS).forEach((k) => {
    if (NEW_BG[BG_ALIAS[k]]) NEW_BG[k] = NEW_BG[BG_ALIAS[k]];
  });

  const NOVEL_CHAR = window.CharArt.novel; // 会話の場面の立ち絵

  const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const hsh = (x, y) => window.Render.hsh(x, y); // 座標から決まる、ばらつきの値（render.js）
  const nowT = () => performance.now();

  function create(canvas) {
    const g = canvas.getContext('2d');
    let w = 528,
      h = 360,
      HB = 360,
      U = 48,
      OX = 0,
      OY = 0;
    const S = {
      progress: null,
      item: null,
      spec: null,
      chars: {},
      leaving: {}, // 歩いて去っていく人物（消えるまで描く。並びの場所は、次の場面まで残す）
      enemy: null,
      fadeA: 0,
      fade: null,
      xf: null, // 重ねて切り替える（xfade）ときの、前の場面の絵と始まった時刻
      flashT: 0,
      shakeUntil: 0,
      shakeMs: 1,
      shakeAmp: 0,
      dust: false,
      t0: nowT(),
      pose: {}
    };

    function resize() {
      const r = canvas.getBoundingClientRect(),
        dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const ww = Math.max(220, Math.round((r.width || 440) * dpr));
      const ratio = r.width > 0 && r.height > 0 ? r.height / r.width : ST.RATIO; // 画面の窓の縦横比に合わせる
      const hh = Math.round(ww * ratio);
      if (canvas.width !== ww || canvas.height !== hh) {
        canvas.width = ww;
        canvas.height = hh;
      }
      const cw = canvas.width;
      HB = canvas.height;
      const ex = extent(),
        vm = Math.min(11, Math.max(ST.VIEW_MIN, Math.ceil((ex ? ex[1] - ex[0] : 0) * 2) / 2)); // 人物と敵が全員入る幅（マス）。入りきらないときだけ少し引いて見せる
      U = Math.max(cw / 11, Math.min(HB / 7.5, cw / vm)); // 幅の狭い画面では、場面（横11マス）を少し拡大して、左右を切る
      w = Math.round(U * 11);
      OX = Math.round((cw - w) / 2);
      // h ＝ 場面の絵の高さ。床・壁・小物・人物の位置はすべて h を基準に決まるので、h を縮めると、足元と床の関係を保ったまま全体が上へ寄る。
      // h より下（台詞の枠の後ろ）は、床や地面をそのまま画面の下まで敷きつめる（HB ＝ 画面の本当の高さ）
      h = (HB * ST.SCREEN_FEET) / ST.FEET;
      OY = 0;
    }

    /* ---------- 描画の道具 ---------- */
    function IMG() {
      return window.Render.img();
    }
    // ドットの細かさをそろえる（ST.PIXEL_MATCH）：人物（CHAR_S）より小さい倍率で描く家具・小物は、いったん
    // 人物と同じ細かさまで縮めた絵を作り、それを引き伸ばして描く。人物・敵の絵はそのまま
    const PM = new Map();
    function pixMatch(n, f, k) {
      if (!ST.PIXEL_MATCH || /^(luno|flam|albo|amina)_/.test(n)) return null;
      const kc = (U / 96) * ST.CHAR_S;
      if (k > kc * 0.9) return null;
      const tw = Math.max(1, Math.round((f.w * k) / kc)),
        th = Math.max(1, Math.round((f.h * k) / kc)),
        key = n + ':' + tw;
      let c = PM.get(key);
      if (!c) {
        c = document.createElement('canvas');
        c.width = tw;
        c.height = th;
        const x = c.getContext('2d');
        x.imageSmoothingQuality = 'high';
        x.drawImage(IMG(), f.x, f.y, f.w, f.h, 0, 0, tw, th);
        PM.set(key, c);
        if (PM.size > 200) PM.delete(PM.keys().next().value);
      }
      return c;
    }
    // 絵を「足元の中央」に置いて描く。s＝大きさ（1＝素材のまま×画面の拡大率）
    // キャラクター用の光・色調。元のスプライトと表情は変更せず背景に馴染ませる。
    function charLight() {
      const key = S.specName || '';
      if (/house_night|mine_dark|lair|collapse|cavern|crys_secret/.test(key))
        return { filter: 'brightness(0.88) saturate(0.87) sepia(0.10)', glow: 'rgba(255,183,105,0.16)' };
      if (/crys_cave/.test(key))
        return { filter: 'brightness(0.95) saturate(0.88)', glow: 'rgba(125,205,255,0.15)' };
      if (/dusk|memo/.test(key))
        return { filter: 'sepia(0.13) saturate(0.91) brightness(0.99)', glow: 'rgba(255,195,119,0.12)' };
      return { filter: 'saturate(0.91) contrast(0.98)', glow: 'rgba(255,231,177,0.12)' };
    }
    function spr(n, cx, by, s, o) {
      o = o || {};
      // 人物（ルノ・フラメト・アルボ・アミーナ）は、高画質の絵（js/art/chars.js）で描く
      const charRef = window.CharArt.fromSprite(n);
      if (charRef) {
        const hh = U * (charRef.who === 'flam' ? 1.22 : 2.1) * (s / ST.CHAR_S);
        const img = window.CharArt.get(charRef.who, charRef.pose);
        if (img) {
          const ww = (hh * img.naturalWidth) / img.naturalHeight;
          g.save();
          if (o.a != null) g.globalAlpha = o.a;
          const light = charLight();
          g.filter = light.filter;
          if (o.flip) {
            g.translate(cx, 0);
            g.scale(-1, 1);
            g.translate(-cx, 0);
          }
          g.drawImage(img, cx - ww / 2, o.hang ? by : by - hh, ww, hh);
          g.restore();
          return { dw: ww, dh: hh, cx, by: o.hang ? by + hh : by, top: o.hang ? by : by - hh };
        }
        return null; // 絵の読みこみ前
      }
      const f = F[n];
      if (!f) return null;
      const k = (U / 96) * s,
        dw = f.w * k,
        dh = f.h * k;
      const pm = pixMatch(n, f, k); // 家具・小物を、人物と同じドットの細かさにした絵（使わないときは null）
      g.save();
      if (o.a != null) g.globalAlpha = o.a;
      if (o.flip) {
        g.translate(cx, 0);
        g.scale(-1, 1);
        g.translate(-cx, 0);
      }
      if (pm) g.drawImage(pm, 0, 0, pm.width, pm.height, cx - dw / 2, o.hang ? by : by - dh, dw, dh);
      else g.drawImage(IMG(), f.x, f.y, f.w, f.h, cx - dw / 2, o.hang ? by : by - dh, dw, dh);
      g.restore();
      return { dw, dh, cx, by: o.hang ? by + dh : by, top: o.hang ? by : by - dh };
    }
    function glow(cx, cy, r, rgb, a) {
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, 'rgba(' + rgb + ',' + a + ')');
      gr.addColorStop(1, 'rgba(' + rgb + ',0)');
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = gr;
      g.beginPath();
      g.arc(cx, cy, r, 0, 7);
      g.fill();
      g.restore();
    }

    /* ---------- 背景：牧草地・家・屋内（ご提供の「牧草地」「祖父母宅・外観／内観」の素材を並べる。空と遠くの丘は canvas） ---------- */
    // 一枚絵の上に、進み具合で変わる物を重ねる（位置は stage_data.js の ART_FX。絵の幅・高さに対する割合）
    //   命の祭壇：石がある間、家の石と同じ命継ぎの石の絵を台の上に置き、明かりをゆらす
    function artOverlay(vis, now, artPt, zoom) {
      const F = ST.ART_FX[S.specName];
      if (!F) return;
      if (F.stone && vis.altarStonePresent) {
        const [x, y] = artPt(F.stone[0], F.stone[1]),
          pulse = 0.5 + 0.5 * Math.sin(now / 600);
        glow(x, y - HB * 0.03, HB * (0.14 + pulse * 0.03), '230,150,255', 0.22 + 0.12 * pulse);
        spr('life_stone', x, y, (F.stone[2] * (HB / h)) / zoom);
      }
    }
    // 家の一枚絵の上に重ねる物：机の上の命継ぎの石（夜・机の場面。取ったあとは消す）と、枕元の石（朝の場面）
    function houseOnArt(P, now, artPt, zoom) {
      const v = visualSnapshot();
      if (S.specName === 'house_night_desk' && !v.houseDeskCleared) {
        const [x, y] = artPt(ST.HOUSE_DESK_STONE[0], ST.HOUSE_DESK_STONE[1]);
        const r = spr('life_stone', x, y, (ST.HOUSE_DESK_STONE[2] * (HB / h)) / zoom);
        if (r) glow(r.cx, (r.top + r.by) / 2, U * 1.4, '230,150,255', 0.4 + 0.1 * Math.sin(now / 500));
      }
    }
    // 枕元の石（朝の場面）：ベッドの絵の上に重ねる
    function pillowStone(P, now) {
      if (!(S.spec && S.spec.pillowStone && visualSnapshot().pillowStonePresent)) return;
      const r = spr('life_stone', P.x, P.y, (P.h * P.s * 96) / (U * F.life_stone.h));
      if (r) glow(r.cx, (r.top + r.by) / 2, U * 1.4, '230,150,255', 0.4 + 0.1 * Math.sin(now / 500));
    }

    function propsAndLights(P, now) {
      (P.props || []).forEach((p) => {
        const n = p[0],
          x = p[1],
          by = p[2],
          s = p[3],
          o = p[4] || {};
        if (!s) return;
        const r = spr(n, x * U, by * h + (o.dy || 0) * U, s, o); // dy：足元からさらに上下へずらす量（マス）。机の上の品物など、画面の縦横比が変わってもずれないように
        if (r && o.glow)
          glow(r.cx, (r.top + r.by) / 2, r.dh * 0.9, o.glow, 0.22 + 0.06 * Math.sin(now / 420 + x));
        if (r && o.lamp)
          glow(
            r.cx - r.dw / 2 + r.dw * o.lamp[0],
            r.top + r.dh * o.lamp[1],
            U * 1.5,
            '255,190,100',
            0.5 + 0.1 * Math.sin(now / 120 + x * 3)
          );
      });
    }

    // ベッドのアルボ：ベッドと一緒に描いた絵（bed_sleep＝眠っている／bed＝起き上がっている）から、
    // 上半身のところ（BED_CROP）だけを切り出して、立ち絵のようにアップで見せる
    function drawBedAlbo(c, now) {
      const im = NOVEL_CHAR.albo && NOVEL_CHAR.albo[c.p === 'bed_sleep' ? 'bed_sleep' : 'bed_up'];
      if (!im || !im.complete || !im.naturalWidth) return;
      const [cx0, cy0, cx1, cy1] = ST.BED_CROP,
        sx = im.naturalWidth * cx0,
        sy = im.naturalHeight * cy0,
        sw = im.naturalWidth * (cx1 - cx0),
        sh = im.naturalHeight * (cy1 - cy0),
        dw = Math.min((HB * ST.BED_H * sw) / sh, canvas.width * ST.BED_W_MAX),
        dh = (dw * sh) / sw,
        x = canvas.width * ST.BED_SLOT - OX,
        bottom = HB * ST.BED_BOTTOM;
      g.save();
      g.filter = charLight().filter;
      g.translate(x, 0);
      if (ST.BED_FLIP) g.scale(-1, 1);
      g.drawImage(im, sx, sy, sw, sh, -dw / 2, bottom - dh, dw, dh);
      g.restore();
      // 枕元の石：切り出した絵の中の位置（左右を反転したときは、横の位置も返す）
      const q = ST.BED_PILLOW,
        qx = ST.BED_FLIP ? 1 - q[0] : q[0];
      pillowStone({ x: x - dw / 2 + dw * qx, y: bottom - dh + dh * q[1], h: dh, s: q[2] }, now);
    }

    /* ---------- 会話の場面の立ち絵（assets/character_novel） ----------
       ルノ・フラメト・アルボ・アミーナ：画面の左右に、胸から上が大きく見えるように並べる（体の下の方は台詞の枠の後ろ・画面の外）
       フラメトは頭から下の絵（flam_*_cut。体は台詞の枠の後ろ・画面の外まで続く）。画面の右側にいるときは、左（まん中）を向くように左右を返す */
    const isBed = (k, c) => k === 'albo' && /^bed/.test(c.p);
    const figuresIn = (chars) =>
      ['luno', 'flam', 'albo', 'amina']
        .filter((k) => chars[k] && !isBed(k, chars[k]))
        .sort((a, b) => chars[a].x - chars[b].x);
    // 立ち絵の横の位置（画面の幅に対する割合）。並び順は、物語の指定の x（左から）のまま
    function portraitLayout(chars, withEnemy) {
      const list = figuresIn(chars),
        n = list.length,
        poses = {};
      const bedAlbo = !!(chars.albo && isBed('albo', chars.albo));
      const tbl = withEnemy || bedAlbo ? ST.VN_X_ENEMY : ST.VN_X; // 敵やベッドのアルボ（右側）がいるときは、左に寄せる
      const xs = tbl[Math.min(n, tbl.length) - 1] || [];
      list.forEach((k, i) => (poses[k] = xs[Math.min(i, xs.length - 1)]));
      if (bedAlbo) poses.albo = ST.BED_SLOT;
      return poses;
    }
    // 物語のポーズ名から、使う絵の名前を決める（ベッドのアルボは別に描く：null）
    function customPoseFor(k, p) {
      p = p || 'idle';
      if (k === 'albo' && /^bed/.test(p)) return null;
      const im = NOVEL_CHAR[k] || {},
        has = (q) => !!im[k === 'flam' ? q + '_cut' : q]; // フラメトは頭と胸の絵（名前の後ろに _cut）
      if (has(p)) return p;
      const alt = ST.VN_POSE_ALT[k] && ST.VN_POSE_ALT[k][p]; // 絵のないポーズの読みかえ
      if (alt && has(alt)) return alt;
      const def = k === 'amina' ? 'stand' : 'idle';
      return has(def) ? def : null;
    }
    function drawCustomPortrait(k, c, slot, now) {
      const pose = customPoseFor(k, c.p);
      const im = pose && NOVEL_CHAR[k][pose + (k === 'flam' ? '_cut' : '')];
      if (!im || !im.complete || !im.naturalWidth) return false;
      const at = slot + (c.o || 0), // ずらした位置
        px = canvas.width * at - OX;
      let dw, dh, bottom, flip;
      if (k === 'flam') {
        // フラメト：頭から絵の下の端までの絵（体を途中で切らない）。横幅は画面の高さの VN_FLAM_SIZE 倍
        dw = HB * ST.VN_FLAM_SIZE;
        dh = (dw * im.naturalHeight) / im.naturalWidth;
        // 頭のてっぺんの高さ。体の下の方は台詞の枠の後ろ・画面の外
        const top = HB * ST.VN_FLAM_HEAD_Y;
        bottom = top + dh;
        flip = at > 0.5 !== !!c.away; // 絵は右向き。右側にいるときは左を向かせる（away：背を向ける）
      } else {
        // 人物：絵の高さ 1200 を、画面の高さの VN_FIG_H 倍に
        const scale = (HB * ST.VN_FIG_H) / ST.VN_IMG_H;
        dw = im.naturalWidth * scale;
        dh = im.naturalHeight * scale;
        // 足もとの線：頭が VN_HEAD_TOP の高さに来るように（ルノは VN_LUNO_HEAD_Y の高さ）
        bottom = HB * (k === 'luno' ? ST.VN_LUNO_HEAD_Y : ST.VN_HEAD_TOP) + ST.VN_IMG_H * scale;
        flip = !!c.f;
      }
      const bob = c.walk
        ? -Math.abs(Math.sin(now / 110)) * HB * 0.006
        : Math.sin(now / 900 + slot * 3) * HB * 0.003;
      g.save();
      if (k === 'amina') g.globalAlpha = 0.94 + 0.04 * Math.sin(now / 500); // 回想の人なので、少し透けて揺らぐ
      if (c.la != null) g.globalAlpha *= c.la; // 去っていく人物は薄くなる
      if (c.ls != null) {
        dw *= c.ls;
        dh *= c.ls;
        bottom -= HB * (1 - c.ls) * 0.35; // 小さくなりながら、少し奥（上）へ
      }
      if (flip) {
        g.translate(px, 0);
        g.scale(-1, 1);
        g.translate(-px, 0);
      }
      g.drawImage(im, px - dw / 2, bottom + bob - dh, dw, dh);
      g.restore();
      return true;
    }

    function drawNovelPortrait(k, c, slot, now) {
      if (isBed(k, c)) {
        drawBedAlbo(c, now);
        return;
      }
      drawCustomPortrait(k, c, slot, now);
    }
    /* ---------- 効果 ---------- */
    function motes(rgb, now, n) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n; i++) {
        const sp = 0.00004 + ((hsh(i, 1) % 100) / 100) * 0.00005,
          ph = (hsh(i, 2) % 1000) / 1000;
        const y = h - ((now * sp + ph) % 1) * h,
          x = ((hsh(i, 3) % 1000) / 1000) * w + Math.sin(now / 900 + i) * U * 0.25;
        g.fillStyle = 'rgba(' + rgb + ',' + (0.2 + 0.4 * Math.abs(Math.sin(now / 500 + i))) + ')';
        g.beginPath();
        g.arc(x, y, Math.max(1, U * 0.035), 0, 7);
        g.fill();
      }
      g.restore();
    }
    function dustFx(now) {
      g.save();
      g.fillStyle = 'rgba(210,190,160,.55)';
      for (let i = 0; i < 38; i++) {
        const sp = 0.00012 + ((hsh(i, 4) % 100) / 100) * 0.00018,
          ph = (hsh(i, 5) % 1000) / 1000,
          y = ((now * sp + ph) % 1) * h,
          x = ((hsh(i, 6) % 1000) / 1000) * w + Math.sin(now / 700 + i) * U * 0.1;
        g.globalAlpha = 0.25 + 0.4 * ((hsh(i, 7) % 100) / 100);
        g.fillRect(x, y, Math.max(1.5, U * 0.05), Math.max(1.5, U * 0.05));
      }
      g.restore();
    }

    // 人物（行き先）と敵の、左右の端（マス）。ベッドの中のアルボはベッドの幅で数える
    /* ---------- カメラ（幅の狭い画面では、人物がいるあたりを見せる） ---------- */
    function extent() {
      let lo = 99,
        hi = -99;
      Object.keys(S.chars).forEach((k) => {
        const c = S.chars[k];
        if (!c || c.hide) return;
        const x = c.tx != null ? c.tx : c.x,
          pd = k === 'albo' && /^bed/.test(c.p) ? ST.CAM_PAD * 1.5 : ST.CAM_PAD;
        if (x < -0.5 || x > 11.5) return;
        lo = Math.min(lo, x - pd);
        hi = Math.max(hi, x + pd);
      });
      if (S.enemy) {
        const pe = S.enemy.kind === 'boss' ? ST.CAM_PAD_BOSS : ST.CAM_PAD_ENEMY;
        lo = Math.min(lo, S.enemy.x - pe);
        hi = Math.max(hi, S.enemy.x + pe);
      }
      return lo > hi ? null : [Math.max(0, lo), Math.min(11, hi)];
    }
    // 幅の狭い画面では横が切れるので、人物と敵が全員入るように、見せる位置を左右へゆっくり動かす
    function camera() {
      const cw = canvas.width;
      if (cw >= w - 1) {
        S.cam = null;
        return;
      }
      const ex = extent(),
        want = ex ? (ex[0] + ex[1]) / 2 : 5.5,
        half = cw / U / 2,
        tgt = Math.max(half, Math.min(11 - half, want));
      S.cam = S.cam == null || S.camScene !== S.specName ? tgt : S.cam + (tgt - S.cam) * 0.06;
      S.camScene = S.specName;
      OX = Math.round(cw / 2 - S.cam * U);
    }
    /* ---------- 状態で見た目が変わる場面（扉・燭台・石など） ---------- */
    function progressFlags() {
      return (S.progress && S.progress.flags) || {};
    }
    function visualSnapshot() {
      return window.VisualState.snapshot(S.specName, progressFlags(), {
        gate: S.gate,
        deskOff: S.deskOff,
        altarStoneTaken: !!S.altarStoneTaken,
        pillowStone: !!(S.spec && S.spec.pillowStone)
      });
    }
    /* ---------- 1フレーム ---------- */
    function frame(now) {
      resize();
      g.setTransform(1, 0, 0, 1, 0, 0);
      // 背景を不透明にする。透明素材の隙間からHTMLの白が見える現象を防ぐ。
      g.fillStyle = '#171523';
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      const P = S.spec;
      if (!P) {
        g.fillStyle = '#000';
        g.fillRect(0, 0, w, HB);
        return;
      }
      camera();
      g.save();
      g.translate(OX, OY); // 幅の狭い画面では、人物がいるあたりを見せる（camera）
      if (now < S.shakeUntil) {
        const a = (S.shakeUntil - now) / S.shakeMs;
        g.translate(
          Math.sin(now * 0.09) * S.shakeAmp * a * U,
          Math.cos(now * 0.13) * S.shakeAmp * a * U * 0.6
        );
      }
      const vis = visualSnapshot();
      // 状態で絵が変わる場面：廃坑の入口（鎖を外したあと）・崩落した通路（岩が崩れたあと＝ dust）。
      // 命の祭壇の石は、絵ではなく artOverlay で重ねる（石を取ったら描かない）
      const artKey =
        S.specName === 'mine_gate' && vis.mineGateOpen
          ? 'mine_gate_open'
          : S.specName === 'collapse' && S.dust
            ? 'collapse_after'
            : S.specName;
      const art = NEW_BG[artKey];
      // 背景画像は画面全体に表示し、人物・敵・品物・暗転は以降の既存処理で重ねる。
      // 状態で変わる物（祭壇の石・家の石）は、絵の上に重ねて描く（artOverlay・houseOnArt）
      if (art && art.complete && art.naturalWidth) {
        const sw = art.naturalWidth,
          sh = art.naturalHeight,
          targetAspect = w / HB;
        // 画面比の違いは中央トリミングで吸収し、歪ませない。
        let sx = 0,
          sy = 0,
          cw = sw,
          ch = sh;
        if (sw / sh > targetAspect) {
          cw = sh * targetAspect;
          sx = (sw - cw) / 2;
        } else {
          ch = sw / targetAspect;
          sy = (sh - ch) / 2;
        }
        g.drawImage(art, sx, sy, cw, ch, 0, 0, w, HB);
        // 絵の中の位置（絵の幅・高さに対する割合）→ 画面の位置
        const artPt = (fx, fy) => [((fx * sw - sx) / cw) * w, ((fy * sh - sy) / ch) * HB];
        if (P.bg === 'house') houseOnArt(P, now, artPt, ch / sh);
        artOverlay(vis, now, artPt, ch / sh);
        // 動的オブジェクトは画像に焼き込まない（羊・点灯燭台・祭壇の状態等）。
        if (S.specName === 'dusk') propsAndLights(P, now);
        if (P.motes) motes(P.motes, now, 22);
      } else {
        // 暗転の場面（black）と、絵を読みこむ前は、暗い色で塗る
        g.fillStyle = '#05040a';
        g.fillRect(0, 0, w, HB);
      }
      // 立ち絵を左右に大きく配置。寝床はシーン上の位置関係を守る。
      const slots = portraitLayout(Object.assign({}, S.leaving, S.chars), !!S.enemy); // 去った人物の場所は、次の場面まで空けておく
      if (S.enemy && window.Enemy) {
        const e = S.enemy;
        // 敵は右側を大きく使い、立ち絵と同じ奥行きのレイヤーに表示。
        window.Enemy.draw(
          g,
          e.kind,
          canvas.width * 0.79 - OX,
          HB * ST.VN_ENEMY_FEET,
          canvas.width * ST.VN_ENEMY_W,
          now,
          {
            dir: -1,
            big: true,
            pose: e.pose
          }
        );
      }
      ['albo', 'amina', 'flam', 'luno'].forEach((k) => {
        const c = S.chars[k];
        if (!c) return;
        if (c.t0 != null) {
          const q = Math.min(1, (now - c.t0) / c.dur),
            e = q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
          c.x = c.x0 + (c.tx - c.x0) * e;
          c.walk = q < 1;
          if (q >= 1) c.t0 = null;
        }
        if (c.ot0 != null) {
          const q = Math.min(1, (now - c.ot0) / c.odur),
            e = q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
          c.o = c.o0 + (c.ot - c.o0) * e;
          c.walk = q < 1;
          if (q >= 1) c.ot0 = null;
        }
        drawNovelPortrait(k, c, slots[k] ?? 0.5, now);
      });
      // 去っていく人物：奥へ歩きながら、小さく薄くなって消える
      Object.keys(S.leaving).forEach((k) => {
        const c = S.leaving[k];
        if (c.done) return;
        const q = Math.min(1, (now - c.lt0) / c.lms);
        c.walk = q < 1;
        c.la = 1 - q;
        c.ls = 1 - q * ST.VN_LEAVE_SHRINK;
        if (q >= 1) c.done = true;
        else drawNovelPortrait(k, c, slots[k] ?? 0.5, now);
      });
      if (S.dust || P.dust) dustFx(now);
      if (S.item) {
        // 品物を見せる（日誌・包帯など）：ふわっと出て、少しして消える
        const q = (now - S.item.t0) / ST.ITEM_MS;
        if (q >= 1) S.item = null;
        else {
          const a = q < 0.15 ? q / 0.15 : q > 0.8 ? (1 - q) / 0.2 : 1,
            y = h * 0.44 - (q < 0.15 ? (1 - q / 0.15) * U * 0.3 : 0);
          glow(5.5 * U, y - U * 0.5, U * 2.2, '255,235,180', ST.ITEM_GLOW * a);
          g.save();
          g.shadowColor = 'rgba(255,244,214,' + (ST.ITEM_RIM_A * a).toFixed(2) + ')'; // 白っぽい光のふち
          g.shadowBlur = U * ST.ITEM_RIM;
          spr(S.item.n, 5.5 * U, y, 0.95, { a });
          g.restore();
        }
      }
      g.restore();
      // 四隅を暗く
      const vg = g.createRadialGradient(w / 2, HB / 2, HB * 0.4, w / 2, HB / 2, w * 0.7);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,.4)');
      g.fillStyle = vg;
      g.fillRect(0, 0, w, HB);
      // 切り替えの暗転・フラッシュ
      let fa = S.fadeA;
      if (S.fade) {
        const q = Math.min(1, (now - S.fade.t0) / S.fade.ms);
        fa = S.fade.from + (S.fade.to - S.fade.from) * q;
        S.fadeA = fa;
        if (q >= 1) {
          const d = S.fade.done;
          S.fade = null;
          if (d) d();
        }
      }
      if (fa > 0.001) {
        g.fillStyle = 'rgba(0,0,0,' + fa + ')';
        g.fillRect(0, 0, w, HB);
      }
      if (now < S.flashT) {
        g.fillStyle = 'rgba(255,255,255,' + Math.min(1, (S.flashT - now) / 300) * 0.85 + ')';
        g.fillRect(0, 0, w, HB);
      }
      // 重ねて切り替える（xfade）：前の場面の絵を上に重ね、だんだん消していく
      if (S.xf) {
        const q = (now - S.xf.t0) / ST.XFADE_MS;
        if (q >= 1) S.xf = null;
        else {
          g.save();
          g.setTransform(1, 0, 0, 1, 0, 0);
          g.globalAlpha = 1 - q;
          g.drawImage(S.xf.img, 0, 0, canvas.width, canvas.height);
          g.restore();
        }
      }
    }

    /* ---------- 外から呼ぶ操作 ---------- */
    const toChars = (c) => {
      const o = {};
      Object.keys(c || {}).forEach((k) => {
        const a = c[k];
        o[k] = a
          ? {
              p: a[0],
              x: a[1],
              f: a[2] == null ? (k === 'luno' ? null : false) : !!a[2],
              s: a[3] || 1,
              o: (a[4] && a[4].off) || 0, // 会話の立ち絵を、決まった位置から横にずらす量（画面の幅に対する割合。＋で右）
              away: !!(a[4] && a[4].away) // フラメトの立ち絵を、いつもと反対に向ける（相手に背を向ける）
            }
          : null;
      });
      return o;
    }; // ルノは向きを書かなければ自動（lunoFace）
    function fadeTo(to, ms) {
      return new Promise((res) => {
        if (REDUCED || !ms) {
          S.fadeA = to;
          S.fade = null;
          res();
          return;
        }
        S.fade = { from: S.fadeA, to, t0: nowT(), ms, done: res };
      });
    }
    function apply(b) {
      if (b.sc) {
        const base = PRESETS[b.sc];
        if (!base) throw new Error('場面がありません: ' + b.sc);
        S.spec = Object.assign({}, base);
        S.specName = b.sc;
        S.dust = false;
        S.enemy = null;
        S.deskOff = false;
        S.gate = null;
        S.altarStoneTaken = false;
        S.leaving = {};
      }
      if (b.c) {
        const nc = toChars(b.c),
          base = b.sc ? {} : Object.assign({}, S.chars);
        Object.keys(nc).forEach((k) => {
          const o = base[k],
            n = nc[k];
          if (!n) {
            if (o && b.leave && !b.sc)
              S.leaving[k] = Object.assign({}, o, { lt0: nowT(), lms: REDUCED ? 1 : b.leave });
            delete base[k];
            return;
          } // null ＝ その人物を場面から外す（leave：その時間をかけて、奥へ歩いて消える）
          if (o && !b.sc && Math.abs(o.x - n.x) > 0.01) {
            n.x0 = o.x;
            n.tx = n.x;
            n.x = o.x;
            n.t0 = nowT();
            n.dur = REDUCED ? 1 : Math.max(350, Math.abs(n.tx - n.x0) * ST.WALK_MS);
          } // 歩いて移動する
          if (o && !b.sc && Math.abs((o.o || 0) - n.o) > 0.001) {
            n.o0 = o.o || 0;
            n.ot = n.o;
            n.o = n.o0;
            n.ot0 = nowT();
            n.odur = REDUCED ? 1 : Math.max(350, Math.abs(n.ot - n.o0) * ST.VN_SHIFT_MS);
          } // 会話の立ち絵が、横に歩いてずれる
          base[k] = n;
        });
        S.chars = base;
        // 人物どうしが重ならないように、近すぎるときは、あとから来た側をずらす（ルノは動かさない）
        const sep = (a, b, gap) => {
          const A = S.chars[a],
            Bc = S.chars[b];
          if (!A || !Bc || (b === 'albo' && /^bed/.test(Bc.p))) return;
          const ax = A.tx != null ? A.tx : A.x,
            bx = Bc.tx != null ? Bc.tx : Bc.x,
            d = bx - ax;
          if (Math.abs(d) >= gap) return;
          const nx = ax + (d >= 0 ? gap : -gap);
          if (Bc.tx != null && Bc.t0 != null) Bc.tx = nx;
          else Bc.x = nx;
        };
        const G = ST.CHAR_GAP;
        sep('luno', 'flam', G.luno_flam);
        sep('luno', 'albo', G.luno_albo);
        sep('flam', 'albo', G.flam_albo);
        sep('luno', 'amina', G.luno_amina);
      } else if (b.sc) S.chars = {};
      if (b.enemy) S.enemy = { kind: b.enemy[0], x: b.enemy[1], pose: b.enemy[2] };
      if (b.enemy === null) S.enemy = null;
      if (b.dust != null) S.dust = !!b.dust;
      if (b.deskOff) S.deskOff = true;
      if (b.gate) {
        S.gate = b.gate;
        if (b.gate === 'gate_unlocked' && S.progress && S.progress.flags)
          S.progress.flags.mineGateUnlocked = true;
      }
      if (b.item) S.item = { n: b.item, t0: nowT() };
    }
    return {
      frame,
      // 場面を切り替える（fade が真なら、暗転をはさむ。xfade が真なら、暗転せずに前の絵と重ねて切り替える）
      change(b, onShow) {
        // onShow：新しい絵が見え始めた瞬間に呼ぶ（効果音を合わせるため）
        // dim：画面を、その濃さまでゆっくり暗くする（眠った・時間がたった、を見せる。次の場面の切り替えで元に戻る）
        if (b.dim != null && !b.sc) {
          apply(b);
          if (onShow) onShow();
          return fadeTo(b.dim, ST.DIM_MS);
        }
        if (b.sc && b.xfade && S.spec && !REDUCED) {
          const img = document.createElement('canvas');
          img.width = canvas.width;
          img.height = canvas.height;
          img.getContext('2d').drawImage(canvas, 0, 0);
          apply(b);
          S.fadeA = 0;
          S.fade = null;
          S.xf = { img, t0: nowT() };
          if (onShow) onShow();
          return new Promise((res) => setTimeout(res, ST.XFADE_MS));
        }
        if (b.sc && b.fade) {
          return (S.spec ? fadeTo(1, ST.FADE_OUT_MS) : Promise.resolve()).then(() => {
            apply(b);
            S.fadeA = 1;
            const p = fadeTo(0, ST.FADE_IN_MS);
            if (onShow) onShow();
            return p;
          });
        }
        apply(b);
        if (b.sc) {
          S.fadeA = 0;
          S.fade = null;
        }
        if (onShow) onShow();
        return Promise.resolve();
      },
      shake(ms, amp) {
        S.shakeUntil = nowT() + ms;
        S.shakeMs = ms;
        S.shakeAmp = amp;
      },
      flash() {
        S.flashT = nowT() + 300;
      },
      setProgress(progress) {
        S.progress = progress;
      },
      markAltarStoneTaken() {
        S.altarStoneTaken = true;
      }
    };
  }
  window.Stage = { create };
})();
