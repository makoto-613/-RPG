/* ==========================================================================
   tutorial.js ― 操作の練習（各ゲームのはじめに出す、小さな吹き出し）
   文は story.js の tut にあります。吹き出しは遊びをじゃましない（盤面の操作はそのままできる）。
   手順に wait があるときは、その操作をすると次へ進む。wait がない手順は「わかった」で進む。
   謎解き（puzzle.js）・戦闘（battle.js）が、操作をするたびに Tutor.note([…]) で知らせる。
   ========================================================================== */
(function () {
  'use strict';

  /* ★ 調整用の数値 */
  const TUNE_TUT = {
    NEXT_MS: 450, // 操作をしてから、次の吹き出しに変わるまで（ミリ秒）
    FLIP_AT: 0.5, // ルノが盤面のこの高さ（上から0〜1）より下にいたら、吹き出しを上に出す（狭い画面のとき）
    GAP: 8, // 横長の画面で、吹き出しとまわりの枠とのすきま（px）
    WIDE_MQ: '(min-width: 900px)' // この幅以上では、吹き出しを盤面の外（左右の余白）に出す。style.css の同じ幅とそろえる
  };

  let cur = null; // いま出している練習 { id, steps, i, timer }
  const box = () => document.getElementById('tut');
  const TXT = () => window.STORY.tut;
  const esc = (t) => String(t).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]);

  // 横長の画面：吹き出しを盤面の外に出す。謎解きは右（案内の枠の下）か左（凡例の下）の、入る方へ。戦闘は左（状態の下）
  const rectOf = (el) => {
    if (!el || el.hidden) return null;
    const r = el.getBoundingClientRect();
    return r.width && r.height ? r : null;
  };
  function placeWide(el) {
    const play = document.getElementById('play'),
      mode = play && play.dataset.mode,
      g = TUNE_TUT.GAP,
      h = el.offsetHeight,
      slots = [];
    const chips = rectOf(document.getElementById('chips'));
    if (mode === 'puzzle') {
      const msg = rectOf(document.getElementById('msg')),
        pad = rectOf(document.querySelector('#pad .dpad')),
        acts = rectOf(document.querySelector('#pad .acts'));
      if (msg && pad) slots.push({ side: 'right', top: msg.bottom + g, lim: pad.top - g });
      if (acts) slots.push({ side: 'left', top: (chips ? chips.bottom : 0) + g, lim: acts.top - g });
    } else if (mode === 'battle') {
      slots.push({ side: 'left', top: (chips ? chips.bottom : 0) + g, lim: window.innerHeight - 16 });
    }
    if (!slots.length) return false;
    const fit =
      slots.find((q) => q.lim - q.top >= h) ||
      slots.slice().sort((a, b) => b.lim - b.top - (a.lim - a.top))[0];
    el.style.top = Math.max(g, Math.min(fit.top, fit.lim - h)) + 'px';
    el.style.bottom = 'auto';
    el.style.left = fit.side === 'left' ? '' : 'auto';
    el.style.right = fit.side === 'right' ? 'max(12px, env(safe-area-inset-right, 0px))' : '';
    return true;
  }
  // 狭い画面：ルノが盤面の下半分にいるときは、吹き出しを上に出す（ルノの姿を隠さないように）
  function place() {
    const el = box();
    if (!el) return;
    if (!el.hidden && window.matchMedia(TUNE_TUT.WIDE_MQ).matches && placeWide(el)) return;
    el.style.top = el.style.bottom = el.style.left = el.style.right = '';
    let f = 1;
    const PZ = window.Puzzle,
      BA = window.Battle;
    if (PZ && PZ.active() && PZ.P.s) f = PZ.P.s.py / 9;
    else if (BA && BA.active() && BA.state()) {
      const B = BA.state();
      f = B.luno.y / ((B.map && B.map.length) || 7);
    }
    el.classList.toggle('top', f > TUNE_TUT.FLIP_AT);
  }
  // 画面の大きさや、案内の枠の高さが変わったら置き直す
  window.addEventListener('resize', () => cur && place());
  const msgEl = document.getElementById('msg'); // このファイルは画面の部品より後に読みこまれる
  if (window.ResizeObserver && msgEl) new ResizeObserver(() => cur && place()).observe(msgEl);
  function show() {
    const el = box();
    if (!el) return;
    if (!cur) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    const st = cur.steps[cur.i];
    el.innerHTML =
      '<div class="tut-h">' +
      esc(TXT().head) +
      '　' +
      (cur.i + 1) +
      '／' +
      cur.steps.length +
      '</div><p class="tut-t">' +
      esc(st.t) +
      '</p><div class="tut-b">' +
      (st.wait ? '' : '<button type="button" class="kbtn sm" data-tut="ok">' + esc(TXT().ok) + '</button>') +
      '<button type="button" class="kbtn sm ghost" data-tut="skip">' +
      esc(TXT().skip) +
      '</button></div>';
    el.querySelectorAll('[data-tut]').forEach((b) => {
      b.onclick = (e) => {
        e.stopPropagation();
        if (window.Sound && window.Sound.sfx) window.Sound.sfx('click');
        if (b.dataset.tut === 'ok') next();
        else stop();
      };
    });
    el.hidden = false;
    place(); // 中身を入れてから（高さが決まってから）置く
  }

  // id：'s0'（羊追い）・'s1'〜's7'（謎解き）・'battle'（戦闘）
  function start(id) {
    const steps = (TXT() || {})[id];
    if (!steps || !steps.length) return;
    stop();
    cur = { id, steps, i: 0, timer: null };
    show();
  }
  // 操作の知らせ。names：['move'] や ['herd'] など
  function note(names) {
    if (!cur) return;
    setTimeout(place, 0);
    if (cur.timer) return;
    const st = cur.steps[cur.i];
    if (!st.wait) return;
    const want = st.wait.split('|');
    if (!names.some((n) => want.includes(n))) return;
    cur.timer = setTimeout(() => {
      if (!cur) return;
      cur.timer = null;
      next();
    }, TUNE_TUT.NEXT_MS);
  }
  function next() {
    if (!cur) return;
    cur.i++;
    if (cur.i >= cur.steps.length) stop();
    else show();
  }
  function stop() {
    if (cur && cur.timer) clearTimeout(cur.timer);
    cur = null;
    show();
  }

  window.Tutor = {
    start,
    note,
    stop,
    active: () => !!cur,
    current: () => (cur ? cur.id + ':' + cur.i : null)
  };
})();
