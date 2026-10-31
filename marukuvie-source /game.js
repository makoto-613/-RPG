/* ==========================================================================
   game.js ― ゲーム全体の土台
   タイトル／カルマ・不安・HP／台詞と場面の再生／展示タイマー／結末／保存／メニュー／入力
   ・序章と区画1〜10の流れ（どの順番で何を見せ、何を選ばせ、何を変えるか）は sections.js にあります。
   ・台詞や文章は story.js、数値と選択肢の表は rules.js、謎解きは puzzle.js、戦闘は battle.js・battle_rules.js です。
   ========================================================================== */
(function () {
  'use strict';

  /* ★ 調整用の数値・スイッチ */
  const TUNE_G = {
    DEV_MENU: true,            // メニューに「確認用」（区画ジャンプ・残り時間・数値の調整）を出す。展示や配布のときは false に
    SECTION_BANNER_MS: 2200,   // 区画のはじめに出す「区画3 …」の札を出しておく時間（ミリ秒）
    TIMER_TICK_MS: 200,        // 展示タイマーを確かめる間隔（ミリ秒）
    SAVE_KEY: 'marukuvie_novel_save_v1',     // 途中経過の保存先（ブラウザの中）
    END_KEY: 'marukuvie_novel_endings_v1',   // 見た結末の記録
    PREF_KEY: 'marukuvie_novel_prefs_v1'     // 設定（効果音・補足表示）
  };

  const $ = (id) => document.getElementById(id);
  const UI = window.UI, STORY = window.STORY, RULES = window.RULES, CHOICES = window.CHOICES, P = STORY.P;
  const Puzzle = window.Puzzle, Battle = window.Battle, Render = window.Render, Stage = window.Stage;
  const CANCEL = UI.CANCEL, clamp = UI.clamp;
  const sfx = (n, v) => window.Sound.sfx(n, v);
  const signed = (n) => (n > 0 ? '＋' : '−') + Math.abs(n);
  const fmtTime = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  /* ---------------- 保存（ブラウザの中。使えなくても遊べる） ---------------- */
  const store = {
    get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 保存できなくても進行はできる */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* 無視 */ } }
  };
  const prefs = Object.assign({ notes: true, sound: true, bgm: true }, store.get(TUNE_G.PREF_KEY) || {});
  let endings = store.get(TUNE_G.END_KEY) || {};
  const savePrefs = () => store.set(TUNE_G.PREF_KEY, prefs);

  /* ---------------- ゲームの状態 ---------------- */
  // 表の「重要フラグ」の名前をそのまま使っています（started・cartFailed・mirrorA・mirrorB・crystal・crystalJournal・crystalUsed・lampSolved・bossResolve・stone・finalActions・dogAttacks・attackedDog・short）
  const newFlags = () => ({
    started: false, cartFailed: false, mirrorA: false, mirrorB: false, mirrorTries: 0, crystal: false, crystalJournal: false, crystalUsed: false,
    lampSolved: false, bossResolve: '', stone: false, finalActions: 0, dogAttacks: 0, attackedDog: false, short: false,
    callN: 0, waitN: 0, memoryShown: false, centResolve: ''
  });
  const newState = (mode) => ({ mode, sec: 0, K: RULES.K_START, A: RULES.A_START, lh: RULES.LUNO_HP, fh: RULES.FLAM_HP, flags: newFlags(), log: [], ended: '' });
  let S = null;        // 今の進行
  let stage = null;    // ノベルの場面を描くもの
  let titleStage = null;   // タイトル画面の背景（廃坑の入口）を描くもの
  let menuOpen = false;

  const hud = () => { if (S) UI.hud({ K: S.K, A: S.A, lh: S.lh, fh: S.fh, lmax: RULES.LUNO_HP, fmax: RULES.FLAM_HP }); };

  /* ---------------- 選択肢の効果 ---------------- */
  // 表の選択肢（CHOICES）を選んだときの変化を、まとめて反映する。札（トースト）で変化を見せる
  function apply(id) {
    const c = CHOICES[id]; if (!c) throw new Error('選択肢の表にありません: ' + id);
    const pk = S.K, pa = S.A, pl = S.lh, pf = S.fh;
    const dK = c.K || 0, dA = c.band ? (RULES.callDelta(S.K) || 0) : (c.A || 0);
    S.K = clamp(S.K + dK, 0, 100); S.A = clamp(S.A + dA, 0, 100);
    if (c.hp) {
      if (c.hp.flam) S.fh = clamp(S.fh + c.hp.flam, 1, RULES.FLAM_HP);   // フラメトHPは最低1・最大35
      if (c.hp.luno) S.lh = clamp(S.lh + c.hp.luno, 1, RULES.LUNO_HP);
    }
    if (c.set) Object.assign(S.flags, c.set);
    if (c.tries) S.flags[c.tries] = (S.flags[c.tries] || 0) + 1;
    S.log.push(id);
    if (S.K !== pk) UI.toast('カルマ ' + signed(S.K - pk), 'k');
    if (S.A !== pa) UI.toast('不安 ' + signed(S.A - pa), 'a');
    if (S.lh !== pl) UI.toast('ルノ HP ' + signed(S.lh - pl), S.lh > pl ? 'ok' : 'hp');
    if (S.fh !== pf) UI.toast('フラメト HP ' + signed(S.fh - pf), S.fh > pf ? 'ok' : 'hp');
    if (S.K !== pk || S.A !== pa || S.lh !== pl || S.fh !== pf) {
      // 悪くなった（カルマ・不安が上がる／HPが下がる）か、良くなったかで音を分ける。HPが変わったときは、HPの向きを優先
      const dh = (S.lh - pl) + (S.fh - pf), dka = (S.K - pk) + (S.A - pa);
      sfx('gauge', dh !== 0 ? (dh < 0 ? 'bad' : 'good') : (dka > 0 ? 'bad' : 'good'));
    }
    hud();
  }
  // 選択肢の見た目（表のラベルそのまま＋カルマ・不安の札）。off に理由を入れると、灰色で選べない
  function optFor(it, off) {
    if (typeof it === 'object') return it;
    const c = CHOICES[it], tags = [];
    const dK = c.K || 0, dA = c.band ? (RULES.callDelta(S.K) || 0) : (c.A || 0);
    if (dK) tags.push(['カルマ' + signed(dK), 'k']);
    if (dA) tags.push(['不安' + signed(dA), 'a']);
    if (c.hp && c.hp.flam) tags.push(['フラメトHP' + signed(c.hp.flam), 'ok']);
    if (c.once) tags.push(['初回のみ', 'once']);
    return { id: it, label: c.label, tags, off };
  }
  // 台詞（案内文）を出したまま、選択肢を出して、選ばれた id を返す
  // line が配列なら、最後の1つ以外は順に読ませてから、最後の文を出したまま選ぶ。null なら、いま出ている文のまま選ぶ
  async function ask(run, line, items, offs) {
    UI.guard(run);
    if (Array.isArray(line)) { for (const l of line.slice(0, -1)) await UI.say(run, l); line = line[line.length - 1]; }
    if (line) UI.showLine(line, false);
    return UI.choose(run, items.map((it) => optFor(it, offs && typeof it === 'string' ? offs[it] : undefined)));
  }

  /* ---------------- ノベル：場面と台詞の再生 ---------------- */
  // beats：台詞・場面・演出の並び（story.js の書き方）。文字列は案内文としてそのまま出す
  // BGM（audio.js の場面ID）を流す。場面の切り替えに合わせて流す曲
  const bgm = (k) => window.Sound.bgm(k);
  const SC_BGM = { dusk: 's0_dusk', house_in: 's0_house', house_night: 's0_night', memory: 'memory', return_path: 'sec10' };
  async function play(run, beats) {
    const list = Array.isArray(beats) ? beats : [beats];
    for (const b of list) {
      UI.guard(run);
      if (typeof b === 'string') { UI.sys(b); continue; }
      if (b.sc && !S.ended && SC_BGM[b.sc] && (b.sc === 'memory' || b.sc === 'return_path' || S.sec === 0)) bgm(SC_BGM[b.sc]);
      const fxNow = () => { if (b.sfx) sfx(b.sfx); };   // 効果音は、絵が変わる瞬間に鳴らす（暗転をはさむときは、明るくなり始めたとき）
      if (b.sc || b.c || b.item || b.enemy !== undefined || b.dust !== undefined) { if (b.sc && b.fade && window.Sound.cutSe) window.Sound.cutSe(0.3); await stage.change(b, fxNow); UI.guard(run); } else fxNow();
      if (b.shake) stage.shake(b.shake[0], b.shake[1]);
      if (b.flash) stage.flash();
      if (b.wait) await UI.wait(run, b.wait);
      if (b.w) await UI.say(run, b);
    }
  }
  function setMode(m) { UI.mode(m); if (m === 'novel') $('chips').innerHTML = ''; }
  function setHeader() {
    const s = STORY.sec[S.sec];
    UI.header(STORY.title, S.sec === 0 ? '序章' : '区画' + s.no + '　' + s.name, s.kind);
  }

  /* ---------------- 展示タイマー（表：20分／残り5分・2分・30秒・0秒に特別処理） ---------------- */
  const T = { on: false, rem: 0, last: 0, fired: {}, id: null };
  const T_MARKS = [RULES.WARN_AT, RULES.SHORT_AT, RULES.LAST_AT, 0];
  function timerStart(sec) {
    T.on = true; T.rem = sec; T.last = performance.now(); T.fired = {};
    T_MARKS.forEach((m) => { T.fired[m] = sec <= m && m > 0; });   // 途中から再開したとき、過ぎた区切りは鳴らさない
    UI.timer(T.rem);
    if (!T.id) T.id = setInterval(timerTick, TUNE_G.TIMER_TICK_MS);
  }
  function timerStop() { T.on = false; }
  function setRemaining(sec) {   // 確認用：残り時間を直接変える（過ぎた区切りは鳴らさない）
    T.rem = sec; T.last = performance.now(); T_MARKS.forEach((m) => { T.fired[m] = m > sec; }); UI.timer(T.rem);
  }
  function timerTick() {
    if (!T.on || !S) return;
    const now = performance.now(); T.rem -= (now - T.last) / 1000; T.last = now;
    UI.timer(T.rem);
    if (T.rem <= RULES.WARN_AT && !T.fired[RULES.WARN_AT]) { T.fired[RULES.WARN_AT] = true; UI.banner(P.t_warn, 'warn', 5200); sfx('warn'); }   // 残り5分：注意。まだ自動では動かさない
    if (T.rem <= RULES.SHORT_AT && !T.fired[RULES.SHORT_AT]) { T.fired[RULES.SHORT_AT] = true; shortRoute(); }
    if (T.rem <= RULES.LAST_AT && !T.fired[RULES.LAST_AT]) { T.fired[RULES.LAST_AT] = true; UI.banner(P.t_last, 'alert', 5200); sfx('alarm'); if (S.sec < 9) shortRoute(); }
    if (T.rem <= 0 && !T.fired[0]) { T.fired[0] = true; timeUp(); }
  }
  // 残り2分：第9区画へ短縮ルート（short=true・戦闘や謎解きは打ち切り・結末①不可）
  function shortRoute() {
    if (!S || S.ended) return;
    S.flags.short = true;
    if (S.sec >= 10) return;
    UI.banner('残り2分　近道で祭壇へ向かう', 'alert', 4200); sfx('alarm');
    if (S.sec === 9) { begin({ go: 9, o: { askOnly: true } }); return; }   // すでに祭壇：選択肢だけ作り直して、①を選べなくする
    begin({ go: 9, o: { fromTimer: true } });
  }
  // 残り0秒：区画10で結末②の条件が成立していれば②、そうでなければ時間切れ専用エンド
  function timeUp() {
    if (!S || S.ended) return;
    timerStop();
    const F = S.flags, ok2 = S.sec === 10 && F.finalActions >= RULES.FINAL_NEED && !F.attackedDog && S.K < RULES.K_HIGH;
    begin({ end: ok2 ? 'e2' : 'e_timeout' });
  }

  /* ---------------- 区画ごとの進行（sections.js） ---------------- */
  const SECS = window.makeSections({ get S() { return S; }, get stage() { return stage; }, P, RULES, UI, apply, ask, optFor, play, setMode, sfx, bgm, hud, signed, timerStart, toTitle });

  /* ---------------- 進行の起動・中断 ---------------- */
  function closeAll() { UI.kill(); Puzzle.stop(); Battle.stop(); UI.clearOverlays(); UI.closeVeil(); menuOpen = false; }
  // いまの進行をやめて、first（{go:区画番号, o:…} か {end:'e1'}）から新しく始める
  function begin(first) {
    closeAll();
    const run = UI.newRun();
    drive(run, first);
  }
  async function drive(run, first) {
    let next = first;
    try {
      while (next) {
        UI.guard(run);
        if (next.end) { await playEnding(run, next.end); return; }
        S.sec = next.go; setHeader(); hud();
        if (S.sec >= 1) {
          save();
          const o = next.o || {};
          if (!o.fromTimer && !o.askOnly) UI.banner('区画' + S.sec + '　' + STORY.sec[S.sec].name + '（' + STORY.sec[S.sec].kind + '）', '', TUNE_G.SECTION_BANNER_MS);
        }
        if (S.sec >= 1 && !(next.o && next.o.fromTimer)) bgm('sec' + S.sec);
        next = await SECS[S.sec](run, next.o || {});
      }
    } catch (e) {
      if (e === CANCEL) return;
      console.error(e); failDialog(e);
    }
  }
  function failDialog(e) {
    UI.openDlg('<div class="dlg-h"><span class="emb"></span><h2>エラー</h2></div><div class="dlg-b"><p style="margin:0">すみません、プログラムでエラーが起きました。</p><p class="fine" style="margin:0;word-break:break-all">' + String(e && e.message || e).replace(/[<>&]/g, '') + '</p><div class="btns"><button class="kbtn" data-a="title">タイトルへ</button></div></div>', (d) => { d.querySelector('[data-a]').onclick = () => toTitle(); });
  }

  /* ---------------- 保存・つづきから ---------------- */
  function save() {
    if (!S || S.ended) return;
    store.set(TUNE_G.SAVE_KEY, { v: 1, S, rem: T.on ? T.rem : null });
  }
  function continueGame() {
    const d = store.get(TUNE_G.SAVE_KEY); if (!d || !d.S) return;
    closeAll(); S = d.S; S.log = S.log || []; S.flags = Object.assign(newFlags(), S.flags);
    UI.screen('play'); hud(); window.Sound.ac();
    if (S.mode === 'expo' && d.rem != null) timerStart(d.rem); else { timerStop(); UI.timer(null); }
    begin({ go: S.sec });
  }
  function newGame(mode) {
    closeAll(); timerStop(); S = newState(mode);
    UI.screen('play'); UI.timer(null); hud(); window.Sound.ac();
    begin({ go: 0 });
  }
  function toTitle() {
    closeAll(); timerStop(); UI.timer(null); UI.screen('title'); bgm('title'); UI.header(STORY.title, STORY.sub, '');
    renderTitle();
  }
  function jumpTo(n) {   // 確認用：区画へ直接行く（持ち物などは、その区画に必要な最小限だけ整える）
    if (!S) return;
    closeAll();
    const F = S.flags;
    if (!F.started) { F.started = true; if (S.mode === 'expo' && !T.on) timerStart(RULES.TIMER_SEC); }
    if (n >= 10) F.stone = true;
    if (n >= 8 && !F.lampSolved) F.lampSolved = true;
    begin({ go: n });
  }

  /* ---------------- 結末 ---------------- */
  async function playEnding(run, id) {
    timerStop(); Puzzle.stop(); Battle.stop(); UI.timer(null);
    S.ended = id; store.del(TUNE_G.SAVE_KEY); bgm(id);
    setMode('novel');
    await play(run, P[id]);
    sfx(id === 'e_timeout' || id === 'e4' ? 'sad' : 'glow');
    endings[id] = true; store.set(TUNE_G.END_KEY, endings);
    const E = P.endings[id], F = S.flags, seen = Object.keys(P.endings).filter((k) => endings[k]).length;
    const act = await new Promise((res) => {
      UI.openDlg('<div class="dlg-h"><span class="emb"></span><h2>' + (id === 'e_timeout' ? '時間切れ' : '結末') + '</h2></div><div class="dlg-b">'
        + '<div class="endcard"><div class="mk">' + E.mark + '</div><div class="nm">' + E.name + '</div><div class="nt">' + E.note + '</div></div>'
        + '<ul class="rows"><li><span>カルマ</span><b>' + S.K + '</b></li><li><span>不安</span><b>' + S.A + '</b></li><li><span>ルノ／フラメトのHP</span><b>' + S.lh + '／' + S.fh + '</b></li>'
        + '<li><span>水晶のかけら</span><b>' + (F.crystal ? '持っていた' : '持っていない') + '</b></li><li><span>見た結末</span><b>' + seen + '／5</b></li></ul>'
        + '<div class="btns"><button class="kbtn" data-a="again">もう一度はじめから</button><button class="kbtn sm rd" data-a="title">タイトルへ</button></div></div>',
      (d) => { d.querySelectorAll('[data-a]').forEach((b) => { b.onclick = () => { sfx('click'); res(b.dataset.a); }; }); });
      run.pend.push(() => res('cancel'));
    });
    UI.guard(run);
    UI.closeVeil();
    if (act === 'again') newGame(S.mode); else toTitle();
  }

  /* ---------------- タイトル ---------------- */
  function renderTitle() {
    $('endings').innerHTML = Object.keys(P.endings).map((k) => {
      const e = P.endings[k], got = !!endings[k];
      return '<div class="endb' + (got ? ' got' : '') + '" title="' + (got ? e.note : 'まだ見ていない結末') + '"><div class="mk">' + e.mark + '</div><div class="nm">' + e.name + '</div></div>';
    }).join('');
    const d = store.get(TUNE_G.SAVE_KEY), has = !!(d && d.S);
    $('btn-cont').hidden = !has;
    if (has) $('cont-note').textContent = '区画' + d.S.sec + '「' + STORY.sec[d.S.sec].name + '」のはじめから／' + (d.S.mode === 'expo' ? '展示モード・残り ' + fmtTime(d.rem == null ? 0 : d.rem) : '時間制限なし');
  }

  /* ---------------- メニュー ---------------- */
  function confirmDlg(text, okLabel, onOk) {
    UI.openDlg('<div class="dlg-h"><span class="emb"></span><h2>確認</h2></div><div class="dlg-b"><p style="margin:0">' + text + '</p><div class="btns"><button class="kbtn sm rd" data-a="ok">' + okLabel + '</button><button class="kbtn sm" data-a="no">やめる</button></div></div>', (d) => {
      d.querySelector('[data-a="ok"]').onclick = () => { UI.closeVeil(); onOk(); };
      d.querySelector('[data-a="no"]').onclick = () => { UI.closeVeil(); };
    });
  }
  function openMenu() {
    sfx('click'); window.Sound.ac();
    const inPlay = !!S && !$('scr-play').hidden;
    const F = inPlay ? S.flags : null, mode = UI.getMode();
    const band = STORY.ui;
    let h = '<div class="dlg-h"><span class="emb"></span><h2>メニュー</h2></div><div class="dlg-b">';
    if (inPlay) {
      h += '<div><h3 class="sub">いまの状況　' + (S.sec === 0 ? '序章' : '区画' + S.sec + '「' + STORY.sec[S.sec].name + '」') + '</h3>'
        + '<div class="tgl"><span>カルマ <b>' + S.K + '</b>（' + band.karmaBand(S.K) + '）</span></div><div class="kbar"><i style="width:' + S.K + '%"></i></div>'
        + '<div class="tgl" style="margin-top:8px"><span>不安 <b>' + S.A + '</b>（' + band.anxBand(S.A) + '）</span></div><div class="kbar a"><i style="width:' + S.A + '%"></i></div>'
        + '<ul class="rows" style="margin-top:10px"><li><span>ルノのHP</span><b>' + S.lh + '／' + RULES.LUNO_HP + '</b></li><li><span>フラメトのHP</span><b>' + S.fh + '／' + RULES.FLAM_HP + '</b></li>'
        + '<li><span>水晶のかけら</span><b>' + (F.crystal ? 'あり' : 'なし') + '</b></li><li><span>命継ぎの石</span><b>' + (F.stone ? 'あり' : 'なし') + '</b></li>'
        + (S.mode === 'expo' ? '<li><span>残り時間</span><b>' + (T.on ? fmtTime(T.rem) : '—') + '</b></li>' : '') + '</ul>'
        + '<p class="fine" style="margin:6px 0 0">カルマ・不安の初期値と、戦闘の細かい数値は「仮」です（rules.js・battle.js の表で直せます）。</p></div>';
    }
    h += '<div class="tgl"><span>BGM</span><button class="sw" id="sw-bgm" role="switch" aria-checked="' + !!prefs.bgm + '" aria-label="BGM"></button></div>'
      + '<div class="tgl"><span>効果音</span><button class="sw" id="sw-snd" role="switch" aria-checked="' + !!prefs.sound + '" aria-label="効果音"></button></div>'
      + '<div class="tgl"><span>補足の表示（カルマ・不安の数字、原稿／仮の印）</span><button class="sw" id="sw-note" role="switch" aria-checked="' + !!prefs.notes + '" aria-label="補足の表示"></button></div>';
    if (inPlay) {
      h += '<div class="btns">' + (mode === 'puzzle' ? '<button class="kbtn sm" id="m-auto">答えを自動で見る</button>' : '') + '<button class="kbtn sm" id="m-restart">この区画を最初から</button><button class="kbtn sm rd" id="m-title">タイトルへ</button></div>';
    }
    if (inPlay && TUNE_G.DEV_MENU) {
      h += '<h3 class="sub">確認用（制作中のみ）</h3><div class="fine">区画へ直接ジャンプ</div><div class="jump">'
        + STORY.sec.map((s) => '<button data-j="' + s.no + '">' + (s.no === 0 ? '序章' : '区画' + s.no) + '<br><span style="font-weight:500">' + s.name + '</span></button>').join('') + '</div>'
        + '<div class="fine">カルマ・不安を動かす</div><div class="jump"><button data-adj="K:-10">カルマ −10</button><button data-adj="K:10">カルマ ＋10</button><button data-adj="A:-10">不安 −10</button><button data-adj="A:10">不安 ＋10</button></div>'
        + (S.mode === 'expo' ? '<div class="fine">残り時間を変える（5分・2分・30秒・0秒の出来事を試せます）</div><div class="jump"><button data-t="305">残り5:05</button><button data-t="125">残り2:05</button><button data-t="35">残り0:35</button><button data-t="5">残り0:05</button></div>' : '');
    }
    h += '<h3 class="sub">印の見かた・出典</h3><div class="fine"><span class="pill">原稿</span> ストーリーフローにある文をそのまま使っています。　<span class="pill prov">仮</span> 原稿にない部分を、試作のために仮に書いた文・数値です（差し替え前提）。　<span class="pill k">カルマ</span><span class="pill a">不安</span> 選ぶと変わる値（表の数字）。</div>'
      + '<p class="cr">ドット絵：ご提供の素材（敵・祖父母の絵などは仮の描き込みです）。UI：ご提供のUIキット（Kopanda bth08 系）の部品。素材の利用規約は配布元の最新版をご確認ください：<a href="https://kopacurve.blog.fc2.com/blog-entry-394.html" target="_blank" rel="noopener">kopacurve.blog.fc2.com/blog-entry-394.html</a></p>'
      + '<div class="btns"><button class="kbtn" id="m-close">閉じる</button><button class="kbtn sm rd" id="m-erase">進行状況を消す</button></div></div>';
    menuOpen = true;
    UI.openDlg(h, (d) => {
      const tg = (id, key, after) => { const b = d.querySelector('#' + id); b.onclick = () => { prefs[key] = !prefs[key]; b.setAttribute('aria-checked', String(!!prefs[key])); savePrefs(); if (after) after(); sfx('click'); }; };
      tg('sw-snd', 'sound', () => { window.Sound.S.enabled = prefs.sound; });
      tg('sw-bgm', 'bgm', () => { window.Sound.setBgmOn(prefs.bgm); });
      tg('sw-note', 'notes', () => document.body.classList.toggle('notes-off', !prefs.notes));
      d.querySelector('#m-close').onclick = () => { menuOpen = false; UI.closeVeil(); };
      let armed = false; const er = d.querySelector('#m-erase');
      er.onclick = () => { if (!armed) { armed = true; er.textContent = '本当に消す？ もう一度押す'; return; } endings = {}; store.del(TUNE_G.END_KEY); store.del(TUNE_G.SAVE_KEY); menuOpen = false; UI.closeVeil(); if (!inPlay) renderTitle(); };
      const au = d.querySelector('#m-auto'); if (au) au.onclick = () => { menuOpen = false; Puzzle.autoSolve(); };
      const rs = d.querySelector('#m-restart'); if (rs) rs.onclick = () => { menuOpen = false; UI.closeVeil(); begin({ go: S.sec }); };
      const ti = d.querySelector('#m-title'); if (ti) ti.onclick = () => { menuOpen = false; confirmDlg('タイトルへ戻ります。進み具合は、区画のはじめに自動で保存されています。', 'タイトルへ', toTitle); };
      d.querySelectorAll('[data-j]').forEach((b) => { b.onclick = () => { menuOpen = false; jumpTo(+b.dataset.j); }; });
      d.querySelectorAll('[data-adj]').forEach((b) => { b.onclick = () => { const [w, v] = b.dataset.adj.split(':'); S[w] = clamp(S[w] + +v, 0, 100); hud(); sfx('gauge'); b.blur(); }; });
      d.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => { menuOpen = false; UI.closeVeil(); if (!T.on) timerStart(+b.dataset.t); else setRemaining(+b.dataset.t); }; });
    });
  }

  /* ---------------- 入力（キー・タップ） ---------------- */
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { if (menuOpen) { menuOpen = false; UI.closeVeil(); } else if (S && !$('scr-play').hidden && !UI.dlgOpen()) openMenu(); return; }
    if (UI.dlgOpen() || $('scr-play').hidden) return;
    const m = UI.getMode();
    if ((e.key === 'Enter' || e.key === ' ') && UI.waiting()) { e.preventDefault(); UI.advance(); return; }   // 台詞の送りを、謎解き・戦闘の操作より先に
    if (m === 'puzzle' && Puzzle.key(e)) return;
    if (m === 'battle' && Battle.key(e)) return;
    if (e.key === 'Enter' || e.key === ' ') { if (UI.waiting()) { e.preventDefault(); UI.advance(); } return; }
    if (e.key >= '1' && e.key <= '9') { const b = $('choices').children[+e.key - 1]; if (b) { e.preventDefault(); b.click(); } }
  });
  function bindPointers() {
    const wrap = $('cvwrap'); let p0 = null;
    wrap.addEventListener('pointerdown', (e) => { window.Sound.ac(); p0 = { x: e.clientX, y: e.clientY }; });
    wrap.addEventListener('pointerup', (e) => {
      if (!p0) return; const dx = e.clientX - p0.x, dy = e.clientY - p0.y; p0 = null;
      if (e.target.closest('#msg, #choices')) return;   // 重ねた台詞の枠・選択肢の上は、それぞれの操作にまかせる
      const m = UI.getMode(), moved = Math.max(Math.abs(dx), Math.abs(dy)) >= Puzzle.TUNE_P.SWIPE_PX;
      if (m === 'puzzle' && moved) { Puzzle.swipe(dx, dy); return; }
      if (UI.waiting()) { UI.advance(); return; }
      if (m === 'battle' && !moved) Battle.tap(e.clientX, e.clientY);
    });
    wrap.addEventListener('pointercancel', () => { p0 = null; });
    $('msg').addEventListener('click', () => { window.Sound.ac(); UI.advance(); });
  }

  /* ---------------- 毎フレームの描画 ---------------- */
  function loop(now) {
    if (!$('scr-play').hidden) {
      const m = UI.getMode();
      if (m === 'puzzle') Puzzle.draw(now); else if (m === 'battle') Battle.draw(now); else if (stage) stage.frame(now);
    } else if (!$('scr-title').hidden && titleStage) titleStage.frame(now);
    requestAnimationFrame(loop);
  }

  /* ---------------- 起動 ---------------- */
  async function boot() {
    document.body.classList.toggle('notes-off', !prefs.notes);
    window.Sound.S.enabled = !!prefs.sound; window.Sound.S.bgm = !!prefs.bgm;
    try { await Render.load(window.ATLAS_URL); }
    catch (e) { $('ld').textContent = 'ドット絵の読み込みに失敗しました。ページを開き直してください。'; return; }
    stage = Stage.create($('cv')); Puzzle.init($('cv')); Battle.init($('cv'));
    titleStage = Stage.create($('cv-title'), { cover: true }); titleStage.change({ sc: 'mine_gate' });
    bindPointers();
    $('btn-menu').onclick = openMenu; $('st-k').onclick = openMenu; $('st-a').onclick = openMenu;
    $('btn-back').onclick = () => { sfx('click'); confirmDlg('タイトルへ戻ります。進み具合は、区画のはじめに自動で保存されています。', 'タイトルへ', toTitle); };
    $('btn-new').onclick = () => newGame('free'); $('btn-expo').onclick = () => newGame('expo'); $('btn-cont').onclick = continueGame; $('btn-tmenu').onclick = openMenu; $('ph-menu').onclick = openMenu;
    $('veil').addEventListener('pointerdown', (e) => { if (e.target === $('veil') && menuOpen) { menuOpen = false; UI.closeVeil(); } });
    toTitle();
    requestAnimationFrame(loop);
    window.__G = { get S() { return S; }, T, stage: () => stage, begin, jumpTo, setRemaining, timerStart, timerTick, newGame, toTitle, openMenu, apply, endings: () => endings, TUNE_G, SECS };
    window.__ready = true;
  }
  boot();
})();
