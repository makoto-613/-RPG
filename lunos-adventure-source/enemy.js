/* ==========================================================================
   enemy.js ― 敵の絵（ムカデ・トゲイモムシ）
   ご提供のドット絵「ムカデとトゲイモムシの戦闘スプライト集」から切り出した絵を使います。
   戦闘の盤面（battle.js）と、戦闘前の場面（stage.js）の両方から使います。
   使い方：Enemy.draw(ctx, 'centipede' | 'boss', 中心x, 足元y, 1マスの大きさ(px), 今の時刻,
                      { dir:1(右向き) or -1(左向き), flash:0〜1, phase:1 or 2, pose:'idle'|'atk'|'dmg'|'ko', big:true（場面用の大きな絵） })
   ========================================================================== */
(function () {
  'use strict';

  /* ★ 大きさの調整（1マスの幅に対する、絵の幅） */
  const EN = {
    CENT_W: 1.5,       // ムカデ（戦闘の盤面）
    BOSS_W: 2.1,       // トゲイモムシ（戦闘の盤面）
    BIG_W: 2.6,        // 場面（ノベル）で使う大きな絵
    PHASE2_GLOW: 'rgba(255,80,40,'   // 第2段階（棘の色が変わった）の赤い光
  };
  const PRE = { centipede: 'cent_', boss: 'boss_' };

  function draw(ctx, kind, cx, by, T, now, o) {
    o = o || {};
    const F = window.ATLAS.frames, img = window.Render && window.Render.img(); if (!img) return;
    const name = o.big && !(o.pose && o.pose !== 'idle') ? PRE[kind] + 'big' : PRE[kind] + (o.pose || 'idle');   // 場面でも、襲いかかる（atk）などのポーズを指定できる
    const f = F[name] || F[PRE[kind] + 'idle']; if (!f) return;
    const wantW = T * (o.big ? EN.BIG_W : kind === 'boss' ? EN.BOSS_W : EN.CENT_W);
    const k = wantW / f.w, dw = f.w * k, dh = f.h * k;
    const bob = (o.pose === 'ko' ? 0 : Math.sin(now / (o.phase === 2 ? 160 : 380)) * T * 0.015);
    // 影
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(cx, by - T * 0.03, dw * 0.42, dw * 0.08, 0, 0, 7); ctx.fill(); ctx.restore();
    if (o.phase === 2) {   // 第2段階：赤い光が脈打つ
      const a = 0.25 + 0.15 * Math.sin(now / 150), gr = ctx.createRadialGradient(cx, by - dh * 0.5, 0, cx, by - dh * 0.5, dw * 0.75);
      gr.addColorStop(0, EN.PHASE2_GLOW + a + ')'); gr.addColorStop(1, EN.PHASE2_GLOW + '0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.fillRect(cx - dw, by - dh * 1.5, dw * 2, dh * 2); ctx.restore();
    }
    const paint = () => {
      ctx.save(); ctx.translate(cx, 0); if ((o.dir || 1) < 0) ctx.scale(-1, 1);
      ctx.drawImage(img, f.x, f.y, f.w, f.h, -dw / 2, by - dh + bob, dw, dh); ctx.restore();
    };
    paint();
    if (o.flash) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, o.flash) * 0.6; paint(); ctx.restore(); }
  }

  window.Enemy = { draw, EN, names: { centipede: '岩喰いムカデ', boss: 'トゲイモムシ' } };
})();
