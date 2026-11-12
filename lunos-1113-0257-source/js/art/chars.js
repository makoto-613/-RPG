/* ==========================================================================
   chars.js ― 人物（ルノ・フラメト・アルボ・アミーナ）の絵（assets/character_hd。物語の立ち絵は assets/character_novel）
   assets/character_hd：謎解き・戦闘で歩く絵と、台詞の枠の顔（ルノ・フラメト）。足りない絵は、立ち絵（idle）で代わりに描いて警告を出す
   assets/character_novel：物語の会話の場面の立ち絵（js/novel/stage.js が使う）
   ========================================================================== */
(function () {
  'use strict';

  /* ★ 調整用の数値 */
  const TUNE_CA = {
    PASS: 0.4, // 下へ1マス歩く間、はじめのこの割合（0〜1）は「足がそろう絵」、残りは「足を前に出した絵」を出す
    IDLE_MS: 500 // 止まっている間、歩く絵を1枚ずつ切りかえる間隔（ミリ秒）。小さいほど速く足踏みする（11月11日に220→500）
  };
  const diagnostics = new Set();
  function loadAll(URLS) {
    const out = {};
    for (const [who, poses] of Object.entries(URLS || {})) {
      out[who] = {};
      for (const [pose, src] of Object.entries(poses)) {
        const img = new Image();
        out[who][pose] = img;
        img.src = src;
        img.addEventListener('error', () => warn(who + ':' + pose, 'image load failed'));
      }
    }
    return out;
  }
  const images = loadAll(window.CHARACTER_HD_URLS), // 謎解き・戦闘・台詞の枠の顔
    novel = loadAll(window.CHARACTER_NOVEL_URLS); // 物語の会話の場面の立ち絵（assets/character_novel）
  function warn(key, why) {
    if (diagnostics.has(key + why)) return;
    diagnostics.add(key + why);
    console.warn('[CHARACTER_HD]', key, why);
  }
  function resolve(who, pose) {
    let p = pose || 'idle';
    if (who === 'luno' || who === 'flam') {
      // 向きと番号の名前（luno_down0、flam_left2 など）：謎解き・戦闘で歩く絵
      let m = p.match(/^(up|down|left|right)([0-3])?$/);
      if (m) {
        const d = m[1],
          frame = Number(m[2] || 0);
        // どの向きも歩く絵4枚（walk_down0〜3・walk_left0〜3・walk_right0〜3・walk_up0〜3。11月11日にいただいたシートから切り出した絵。左右は同じ日の夜の描き直し）
        // 絵の番号は walkFrame が決める（どの向きも同じ）
        p = 'walk_' + d + frame;
      }
    }
    const mapped = p;
    if (!images[who] || !images[who][mapped]) {
      warn(who + ':' + pose, 'pose not in approved images; using documented idle fallback');
      return 'idle';
    }
    return mapped;
  }
  function splitSprite(name) {
    const m = /^(luno|flam|albo|amina)_(.+)$/.exec(name || '');
    if (!m) return null;
    const who = m[1],
      pose = resolve(who, m[2]);
    return { who, pose };
  }
  function get(who, pose) {
    const p = resolve(who, pose),
      img = images[who] && images[who][p];
    if (img && img.complete && img.naturalWidth > 0) return img;
    if (img && img.complete && img.naturalWidth === 0) warn(who + ':' + p, 'undecodable');
    return null;
  }
  function getSprite(name) {
    const spec = splitSprite(name);
    if (!spec) return null;
    return get(spec.who, spec.pose);
  }
  function fromSprite(name) {
    return splitSprite(name);
  }
  /* 歩く絵の番号（0〜3。どの向きも同じ）。e：キャラ（ph＝歩いた道のり（マス）、moving＝歩いている最中か）、now：いまの時刻（ミリ秒）
     歩いている間は、1マスごとに前に出す足を入れかえる（0＝片方の足、2＝もう片方の足。1・3＝足がそろう途中の絵）。
     止まっている間は、4枚を順に切りかえて、その場で足踏みする */
  /* 歩くときの体のはずみ（0〜1）。足がそろう絵を出している間だけ、体を山なりに少し持ち上げる（足を前に出した絵では 0）。
     どれだけ持ち上げるかは、使う側（謎解き・戦闘）が決める */
  function walkBob(e) {
    if (!e.moving) return 0;
    const k = Math.max(0, Math.ceil(e.ph - 1e-6) - 1),
      u = e.ph - k;
    return u < TUNE_CA.PASS ? Math.sin((Math.PI * u) / TUNE_CA.PASS) : 0;
  }
  /* 歩く絵の名前（luno_left2 など）。e：キャラ（dir＝向き U・D・L・R、ph・moving は walkFrame と同じ） */
  const DIR_NAME = { U: 'up', D: 'down', L: 'left', R: 'right' };
  function walkName(who, e, now) {
    return (who === 'luno' ? 'luno_' : 'flam_') + DIR_NAME[e.dir || 'D'] + walkFrame(e, now);
  }
  function walkFrame(e, now) {
    if (!e.moving) return Math.floor(now / TUNE_CA.IDLE_MS) % 4;
    const k = Math.max(0, Math.ceil(e.ph - 1e-6) - 1); // いま何マス目を歩いているか（0から）
    const odd = k % 2 === 1;
    if (e.moving && e.ph - k < TUNE_CA.PASS) return odd ? 3 : 1;
    return odd ? 2 : 0;
  }
  function draw(ctx, who, pose, cx, by, height, opts) {
    const img = get(who, pose);
    if (!img) return false;
    opts = opts || {};
    const dw = (height * img.naturalWidth) / img.naturalHeight;
    ctx.save();
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    if (opts.flip) {
      ctx.translate(cx, 0);
      ctx.scale(-1, 1);
      ctx.translate(-cx, 0);
    }
    if (opts.clipY !== undefined) {
      ctx.beginPath();
      ctx.rect(0, 0, opts.clipW || ctx.canvas.width, opts.clipY);
      ctx.clip();
    }
    if (opts.filter) ctx.filter = opts.filter;
    ctx.drawImage(img, cx - dw / 2, by - height, dw, height);
    ctx.restore();
    return true;
  }
  window.CharArt = {
    novel,
    resolve,
    get,
    getSprite,
    fromSprite,
    walkBob,
    walkName,
    draw,
    diagnostics,
    status: () => ({
      loaded: Object.values(images)
        .flatMap((x) => Object.values(x))
        .filter((im) => im.complete && im.naturalWidth).length,
      total: Object.values(images).reduce((s, x) => s + Object.keys(x).length, 0),
      diagnostics: [...diagnostics]
    })
  };
})();
