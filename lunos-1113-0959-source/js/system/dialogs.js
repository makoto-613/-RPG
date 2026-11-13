/* ==========================================================================
   dialogs.js ― ダイアログの中身（HTML）を組み立てる
   メニュー・確認・羊追いの結果・戦い方の説明の文と並びは、ここで決めます。
   ボタンを押したときの動き（保存・タイトルへ戻る など）は game.js にあります。
   ========================================================================== */
(function () {
  'use strict';

  // 見出しの帯（左に紋章）。どのダイアログも同じ形
  const head = (title) => '<div class="dlg-h"><span class="emb"></span><h2>' + title + '</h2></div>';
  const row = (label, value) => '<li><span>' + label + '</span><b>' + value + '</b></li>';

  /* 確認（「タイトルへ戻る」「棄権する」など）。押すボタン：data-a="ok"／"no" */
  function confirm(text, okLabel) {
    return (
      head('確認') +
      '<div class="dlg-b"><p style="margin:0">' +
      text +
      '</p><div class="btns"><button class="kbtn sm rd" data-a="ok">' +
      okLabel +
      '</button><button class="kbtn sm" data-a="no">やめる</button></div></div>'
    );
  }

  /* 羊追いの結果（難易度の目安）。H：STORY.herd の文、o：{ diff（難易度の名前）, moves, par, mm, ss, adv } */
  function herd(H, o) {
    return (
      head(H.title) +
      '<div class="dlg-b herd-res">' +
      '<ul class="rows">' +
      row('難易度', o.diff) +
      row(H.moves, o.moves + '手') +
      row(H.par, o.par + '手くらい') +
      row(H.time, o.mm + '分' + o.ss + '秒') +
      '</ul>' +
      '<p class="adv">' +
      H.advice[o.adv] +
      '</p><p style="margin:0">' +
      H.lead +
      '</p><div class="btns"><button class="kbtn" data-a="go">' +
      H.go +
      '</button><button class="kbtn sm" data-a="back">' +
      H.back +
      '</button></div></div>'
    );
  }

  /* 戦い方の説明。items：説明の文の並び、force：メニューから開いたとき（ボタンが「閉じる」になる） */
  function battleHelp(items, force) {
    return (
      head('戦い方') +
      '<div class="dlg-b"><ol class="bhelp">' +
      items.map((t) => '<li>' + t + '</li>').join('') +
      '</ol><div class="btns"><button class="kbtn" data-a="ok">' +
      (force ? '閉じる' : 'はじめる') +
      '</button></div></div>'
    );
  }

  /* メニュー。o の中身：
     play：遊んでいる最中なら { where, diff, lh, lhMax, fh, fhMax, crystal, stone, time（展示モードの時刻。それ以外は null）,
           mode（'puzzle'|'battle'|…）, committed（もう棄権しかできない）, quitBtn } ／タイトル画面なら null
     prefs：設定（bgm・bgmVol・sound・seVol）
     dev：確認用の欄を出すなら { secs：[{ no, label, name }], expo：展示モードか } ／出さないなら null */
  function menu(o) {
    const p = o.play,
      pr = o.prefs;
    let h = head('メニュー') + '<div class="dlg-b">';
    if (p) {
      h +=
        '<div><h3 class="sub">いまの状況　' +
        p.where +
        '</h3>' +
        '<div class="tgl"><span>難易度 <b>' +
        p.diff +
        '</b>（途中では変えられません）</span></div>' +
        '<ul class="rows" style="margin-top:10px">' +
        row('ルノのHP', p.lh + '／' + p.lhMax) +
        row('フラメトのHP', p.fh + '／' + p.fhMax) +
        row('水晶のかけら', p.crystal ? 'あり' : 'なし') +
        row('命継ぎの石', p.stone ? 'あり' : 'なし') +
        (p.time !== null ? row('時刻', p.time) : '') +
        '</ul>' +
        '</div>';
    }
    h +=
      '<div class="tgl"><span>BGM</span><button class="sw" id="sw-bgm" role="switch" aria-checked="' +
      !!pr.bgm +
      '" aria-label="BGM"></button></div>' +
      '<div class="vol"><label for="vol-bgm">BGMの音量</label><input type="range" id="vol-bgm" min="0" max="100" step="5" value="' +
      pr.bgmVol +
      '"><output id="vo-bgm">' +
      pr.bgmVol +
      '</output></div>' +
      '<div class="tgl"><span>効果音</span><button class="sw" id="sw-snd" role="switch" aria-checked="' +
      !!pr.sound +
      '" aria-label="効果音"></button></div>' +
      '<div class="vol"><label for="vol-se">効果音の音量</label><input type="range" id="vol-se" min="0" max="100" step="5" value="' +
      pr.seVol +
      '"><output id="vo-se">' +
      pr.seVol +
      '</output></div>';
    if (p) {
      h +=
        '<div class="btns">' +
        (p.mode === 'puzzle' ? '<button class="kbtn sm" id="m-auto">答えを自動で見る</button>' : '') +
        (p.mode === 'battle' ? '<button class="kbtn sm" id="m-bhelp">戦い方</button>' : '') +
        '<button class="kbtn sm" id="m-restart">この区画を最初から</button>' +
        (p.committed
          ? '<button class="kbtn sm rd" id="m-quit">' + p.quitBtn + '</button>'
          : '<button class="kbtn sm rd" id="m-title">タイトルへ</button>') +
        '</div>';
    }
    if (p && o.dev) {
      h +=
        '<h3 class="sub">確認用（制作中のみ）</h3><div class="fine">区画へ直接ジャンプ</div><div class="jump">' +
        o.dev.secs
          .map(
            (s) =>
              '<button data-j="' +
              s.no +
              '">' +
              s.label +
              '<br><span style="font-weight:500">' +
              s.name +
              '</span></button>'
          )
          .join('') +
        '</div>' +
        '<div class="fine">カルマ・不安を動かす</div><div class="jump"><button data-adj="K:-10">カルマ −10</button><button data-adj="K:10">カルマ ＋10</button><button data-adj="A:-10">不安 −10</button><button data-adj="A:10">不安 ＋10</button></div>' +
        (o.dev.expo
          ? '<div class="fine">残り時間を変える（5分・2分・30秒・0秒の出来事を試せます）</div><div class="jump"><button data-t="305">残り5:05</button><button data-t="125">残り2:05</button><button data-t="35">残り0:35</button><button data-t="5">残り0:05</button></div>'
          : '');
    }
    h +=
      '<h3 class="sub">素材</h3>' +
      '<p class="cr">ドット絵：ご提供の素材をもとに作成。UI：ご提供のUIキット（Kopanda bth08 系）の部品。素材の利用規約は配布元の最新版をご確認ください：<a href="https://kopacurve.blog.fc2.com/blog-entry-394.html" target="_blank" rel="noopener">kopacurve.blog.fc2.com/blog-entry-394.html</a></p>' +
      '<div class="btns"><button class="kbtn" id="m-close">閉じる</button><button class="kbtn sm rd" id="m-erase">進行状況を消す</button></div></div>';
    return h;
  }

  window.Dialogs = { confirm, herd, battleHelp, menu };
})();
