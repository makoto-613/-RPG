/* ==========================================================================
   shell.js ― 画面の部品（台詞パネル・選択肢・ダイアログ・右上の状態表示・お知らせ）と、「やめるときに安全に止められる待ち方」
   ゲームの進み方は game.js・sections.js、謎解きは puzzle.js、戦闘は battle.js が受け持ち、この部品を使います。
   ========================================================================== */
(function () {
  'use strict';

  /* ★ 調整用の数値 */
  const TUNE_UI = {
    TYPE_MS: 22,          // 台詞が1文字出るまでの時間（ミリ秒）。0 にすると一気に表示
    DLG_GUARD_MS: 450,    // 結末などのダイアログが開いた直後は Enter／Space／ボタンのタップを無視する時間（連打で読み飛ばさないため）
    BANNER_MS: 4200,      // 画面上部のお知らせ（タイマーの注意など）を出しておく時間
    TOAST_MAX: 4,         // 画面の隅に出す「ルノ HP −3」などの札の最大数
    HP_LOW: 0.3           // HP が最大値のこの割合以下になると、右上のHPのバーを赤くする
  };

  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const nowMs = () => performance.now();
  const CANCEL = { cancel: true };
  const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const STORY = window.STORY;

  const UI = { $, clamp, sleep, nowMs, CANCEL, REDUCED, TUNE_UI, run: null };

  /* ---------------- 台詞パネル ---------------- */
  const MS = { timer: null, full: '', done: true, res: null, i: 0 };
  function stopType() { if (MS.timer) { clearInterval(MS.timer); MS.timer = null; } }
  function finishType() { stopType(); $('mtext').textContent = MS.full; keepBottom(); MS.done = true; if (MS.res) $('nxt').hidden = false; }
  const lineFace = (l) => l.face || (l.w === 'luno' ? (/！/.test(l.t) ? 'luno_determined' : 'luno_idle') : l.w === 'flam' ? 'flam_idle' : null);
  // 台詞の中に「。」が2つ以上あるときは、一文ごとに改行する（すでに改行してある所・閉じかっこの前では改行しない）
  const breakSentences = (t) => String(t).replace(/。(?=[^\n」』）)\s])/g, '。\n');
  // 長い台詞が枠からあふれるときは、文字が出るのに合わせて下まで送る
  const keepBottom = () => { const b = $('mbody'), over = $('mtext').getBoundingClientRect().bottom - b.getBoundingClientRect().bottom; if (over > 0) b.scrollTop += over; };   // 文字の下端が見えるところまでだけ送る（「仮」の印は送らない）
  function showLine(l, wait) {
    stopType();
    if (l.w !== 'sys') l = Object.assign({}, l, { t: breakSentences(l.t) });
    const nm = STORY.names[l.w] || '', mt = $('mtext'), f = lineFace(l);
    $('np').hidden = !nm; $('np').textContent = nm;
    mt.className = 'mtext ' + (l.w || '');
    if (f && window.Render.img()) { $('face').hidden = false; window.Render.portrait($('face'), f); $('mbody').classList.remove('noface'); } else { $('face').hidden = true; $('mbody').classList.add('noface'); }
    $('mmeta').innerHTML = l.w === 'sys' ? '' : (l.p ? '<span class="pill prov">仮</span>' : '<span class="pill">原稿</span>' + (l.src ? '<span>' + l.src + '</span>' : ''));
    MS.full = l.t; MS.i = 0; $('nxt').hidden = true;
    $('mbody').scrollTop = 0;
    if (!wait || REDUCED || !TUNE_UI.TYPE_MS || l.w === 'sys') { mt.textContent = l.t; MS.done = true; if (wait) $('nxt').hidden = false; return; }
    MS.done = false; mt.textContent = '';
    MS.timer = setInterval(() => { MS.i++; mt.textContent = MS.full.slice(0, MS.i); keepBottom(); if (MS.i >= MS.full.length) finishType(); }, TUNE_UI.TYPE_MS);
  }
  const sys = (t) => showLine({ w: 'sys', t });
  function advance() {
    if (!MS.res) return false;
    if (!MS.done) { finishType(); return true; }
    const r = MS.res; MS.res = null; $('nxt').hidden = true; if (window.Sound.cutSe) window.Sound.cutSe(); r(); return true;   // 台詞を送ったら、前の台詞のときに鳴った効果音は止める
  }
  const waiting = () => !!MS.res;

  /* ---------------- 進行の道具（やめるときに安全に止められる待ち方） ---------------- */
  function newRun() { const r = { dead: false, pend: [] }; UI.run = r; return r; }
  function guard(run) { if (run.dead) throw CANCEL; }
  function kill() {
    const r = UI.run; if (!r) return;
    r.dead = true; MS.res = null; stopType(); if (window.Sound.cutSe) window.Sound.cutSe(0.15); $('nxt').hidden = true; $('choices').innerHTML = '';
    const p = r.pend; r.pend = []; p.forEach((f) => { try { f(); } catch (e) { /* 無視 */ } });
  }
  function say(run, l) { return new Promise((res) => { guard(run); showLine(l, true); MS.res = res; run.pend.push(res); }).then(() => guard(run)); }
  async function sayAll(run, ls) { for (const l of ls) await say(run, l); }
  function wait(run, ms) { return new Promise((res) => { guard(run); const id = setTimeout(res, ms); run.pend.push(() => { clearTimeout(id); res(); }); }).then(() => guard(run)); }
  async function until(run, pred, max) { const t0 = nowMs(); while (!pred()) { await wait(run, 30); if (nowMs() - t0 > (max || 6000)) break; } }
  /* 選択肢を出して、選ばれた id を返す。opts の各要素：{ id, label, tags:[[文字,種類],…], off:'選べない理由' }
     off がある選択肢は、灰色で押せない（理由が小さく出る） */
  function choose(run, opts) {
    return new Promise((res) => {
      guard(run);
      const box = $('choices'); box.innerHTML = '';
      opts.forEach((o, i) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'ch'; b.dataset.id = o.id;
        const a = document.createElement('span'); a.textContent = o.label;
        if (o.off) { b.setAttribute('aria-disabled', 'true'); const w = document.createElement('span'); w.className = 'why'; w.textContent = o.off; a.appendChild(w); }
        const tg = document.createElement('span'); tg.className = 'tg';
        (o.tags || []).forEach((t) => tg.insertAdjacentHTML('beforeend', '<span class="pill ' + t[1] + '">' + t[0] + '</span>'));
        b.appendChild(a); b.appendChild(tg);
        b.onclick = () => { if (o.off) { window.Sound.sfx('warn'); return; } window.Sound.sfx('click'); box.innerHTML = ''; res(o.id); };
        box.appendChild(b);
      });
      run.pend.push(() => { box.innerHTML = ''; res(null); });
      try { box.scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' }); } catch (e) { /* 無視 */ }
    }).then((id) => { guard(run); return id; });
  }

  /* ---------------- 画面・モード ---------------- */
  // body の on-title／on-novel／on-puzzle／on-battle で、画面ごとの見た目（CSS）を切り替える。どの遊びの画面も全画面
  function syncBody() {
    const play = !$('scr-play').hidden, m = $('play').dataset.mode;
    document.body.classList.toggle('on-title', !$('scr-title').hidden);
    ['novel', 'puzzle', 'battle'].forEach((k) => document.body.classList.toggle('on-' + k, play && m === k));
  }
  function screen(name) {
    $('ld').hidden = true;
    $('scr-title').hidden = name !== 'title'; $('scr-play').hidden = name !== 'play';
    syncBody();
    window.scrollTo(0, 0);
  }
  // ノベルの場面では、台詞の枠と選択肢を、場面の絵の上に半透明で重ねる（謎解き・戦闘では、盤面が隠れないよう横に戻す）
  function mode(m) {
    $('play').dataset.mode = m;
    syncBody();
    const wrap = $('cvwrap'), msg = $('msg'), ch = $('choices'), side = document.querySelector('#play .side');
    if (m === 'novel' && msg.parentNode !== wrap) { wrap.appendChild(ch); wrap.appendChild(msg); }
    else if (m !== 'novel' && msg.parentNode === wrap) { side.insertBefore(msg, side.firstChild); side.insertBefore(ch, msg.nextSibling); }
  }
  const getMode = () => $('play').dataset.mode;

  /* ---------------- 右上の状態表示（ルノ・フラメトのHP） ---------------- */
  function hud(v) {
    $('ph-lh').textContent = v.lh; $('ph-fh').textContent = v.fh;
    const pct = (a, b) => clamp((a / b) * 100, 0, 100) + '%';
    $('pg-lh').style.width = pct(v.lh, v.lmax); $('pg-fh').style.width = pct(v.fh, v.fmax);
    $('ph-lh').parentNode.classList.toggle('low', v.lh <= v.lmax * TUNE_UI.HP_LOW);
    $('ph-fh').parentNode.classList.toggle('low', v.fh <= v.fmax * TUNE_UI.HP_LOW);
  }
  /* 展示モードの残り時間を、懐中時計（朝→昼→夕方→夜）で見せる。正確な分・秒は画面に出さない */
  const WATCH = {
    FROM: -118, TO: 140,      // 針の角度（度）。真上が0。左下（夜明け）から始まり、右下（夜）で終わる
    MOON_AT: 0.86             // ここ（経過の割合）を過ぎると、針の先が太陽から月に変わる
  };
  function dayPhase(sec) {   // 残り秒数 → { p: 経過の割合 0〜1, word: 時刻のことば }
    const total = (window.RULES && window.RULES.TIMER_SEC) || 1200, p = Math.min(1, Math.max(0, 1 - sec / total));
    const word = p < 0.2 ? '朝' : p < 0.45 ? '昼前' : p < 0.62 ? '昼すぎ' : p < 0.8 ? '夕方' : p < 0.95 ? '日暮れ' : '夜';
    return { p, word };
  }
  function timer(sec) {
    const pt = $('ph-t');
    document.body.classList.toggle('has-watch', sec != null);   // 時計を出している間は、ほかの表示を左へずらす
    if (sec == null) { pt.hidden = true; return; }
    const d = dayPhase(sec), wc = sec <= 30 ? ' w3' : sec <= 120 ? ' w2' : sec <= 300 ? ' w1' : '';
    pt.hidden = false; pt.className = 'pt' + wc + (d.p >= WATCH.MOON_AT ? ' moon' : '');
    pt.style.setProperty('--a', (WATCH.FROM + (WATCH.TO - WATCH.FROM) * d.p).toFixed(2) + 'deg');
    pt.style.setProperty('--dim', (Math.max(0, d.p - 0.6) / 0.4 * 0.45).toFixed(3));   // 夕方から、文字盤が少しずつ暗くなる
    pt.setAttribute('aria-label', '時刻：' + d.word);
  }

  /* ---------------- お知らせ・札 ---------------- */
  let bannerTimer = null;
  function banner(text, kind, ms) {
    const b = $('banner'); b.textContent = text; b.className = 'banner ' + (kind || ''); b.hidden = false;
    clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { b.hidden = true; }, ms || TUNE_UI.BANNER_MS);
  }
  function toast(text, kind) {
    const box = $('toasts'); const t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.textContent = text; box.appendChild(t);
    while (box.children.length > TUNE_UI.TOAST_MAX) box.removeChild(box.firstChild);
    setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 2700);
  }
  function clearOverlays() { $('banner').hidden = true; $('toasts').innerHTML = ''; }
  function fadeBlack(on) { $('fadev').classList.toggle('on', !!on); }

  /* ---------------- ダイアログ（メニュー・結末・ゲームオーバー） ---------------- */
  let dlgAt = 0;
  function openDlg(html, mount) { const d = $('dlg'); d.innerHTML = html; dlgAt = nowMs(); $('veil').hidden = false; if (mount) mount(d); const b = d.querySelector('button'); if (b) b.focus({ preventScroll: true }); }
  const dlgOpen = () => !$('veil').hidden;
  // 開いた直後（DLG_GUARD_MS の間）は、台詞を送るつもりの Enter／Space／タップが、ダイアログのボタンを押してしまわないよう無視する
  const inGuard = () => dlgOpen() && nowMs() - dlgAt < TUNE_UI.DLG_GUARD_MS;
  ['keydown', 'keyup'].forEach((ev) => window.addEventListener(ev, (e) => { if (inGuard() && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); } }, true));
  $('dlg').addEventListener('click', (e) => { if (inGuard() && e.target.closest('button')) { e.preventDefault(); e.stopPropagation(); } }, true);
  function closeVeil() { $('veil').hidden = true; }

  Object.assign(UI, { dayPhase, showLine, sys, advance, waiting, stopType, newRun, guard, kill, say, sayAll, wait, until, choose, screen, mode, getMode, hud, timer, banner, toast, clearOverlays, fadeBlack, openDlg, closeVeil, dlgOpen, inGuard });
  window.UI = UI;
})();
