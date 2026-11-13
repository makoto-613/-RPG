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
    DEV_MENU: false, // メニューに「確認用」（区画ジャンプ・残り時間・数値の調整）を出す。制作中に確かめたいときだけ true に
    SECTION_BANNER_MS: 2200, // 区画のはじめに出す「区画3 …」の札を出しておく時間（ミリ秒）
    TIMER_TICK_MS: 200, // 展示タイマーを確かめる間隔（ミリ秒）
    TALK_MAX: 800, // 会話ログに残す数の上限（台詞・選んだ選択肢・区画の区切り）。これを超えたら古いものから消す
    SAVE_KEY: 'lunos_adventure_save_v1', // 途中経過の保存先（ブラウザの中）
    END_KEY: 'lunos_adventure_endings_v1', // 見た結末の記録
    PREF_KEY: 'lunos_adventure_prefs_v2' // 設定（効果音・補足表示）。v2 から「補足の表示」（仮・原稿の印）は、はじめは出さない
  };

  const $ = (id) => document.getElementById(id);
  const UI = window.UI,
    STORY = window.STORY,
    RULES = window.RULES,
    CHOICES = window.CHOICES,
    P = STORY.P;
  const Puzzle = window.Puzzle,
    Battle = window.Battle,
    Render = window.Render,
    Stage = window.Stage,
    Dialogs = window.Dialogs;
  const CANCEL = UI.CANCEL,
    clamp = UI.clamp;
  const sfx = (n, v, k) => window.Sound.sfx(n, v, k);
  const signed = (n) => (n > 0 ? '＋' : '−') + Math.abs(n);

  /* ---------------- 保存（ブラウザの中。使えなくても遊べる） ---------------- */
  const store = {
    get(k) {
      try {
        const v = localStorage.getItem(k);
        return v ? JSON.parse(v) : null;
      } catch (e) {
        return null;
      }
    },
    set(k, v) {
      try {
        const serialized = JSON.stringify(v);
        localStorage.setItem(k, serialized);
        // Safariのプライベートブラウズや容量制限などで書き込みに失敗した場合を区別する。
        return localStorage.getItem(k) === serialized;
      } catch (e) {
        return false;
      }
    },
    del(k) {
      try {
        localStorage.removeItem(k);
        return true;
      } catch (e) {
        return false;
      }
    }
  };
  const prefs = Object.assign(
    { notes: false, sound: true, bgm: true, bgmVol: 100, seVol: 100 },
    store.get(TUNE_G.PREF_KEY) || {}
  ); // bgmVol・seVol＝設定の音量バー（0〜100）
  let endings = store.get(TUNE_G.END_KEY) || {};
  const savePrefs = () => store.set(TUNE_G.PREF_KEY, prefs);
  let saveFailureShown = false;
  function persistProgress(data) {
    const ok = store.set(TUNE_G.SAVE_KEY, data);
    if (!ok && !saveFailureShown) {
      saveFailureShown = true;
      console.warn('[SAVE] このブラウザでは進行状況を保存できません。');
      UI.toast('このブラウザではオートセーブできません。空き容量・ブラウザ設定をご確認ください。', 'warn');
    }
    if (ok) saveFailureShown = false;
    return ok;
  }
  // 区画の情報（中の番号 n から）と、画面に出す名前（「序章」「区画2」など。消した区画の分は番号を詰める）
  const secOf = (n) => STORY.sec.find((s) => s.no === n);
  const areaLabel = (n) => (n === 0 ? '序章' : '区画' + STORY.sec.indexOf(secOf(n)));
  // ローカルストレージに残った破損・旧版データを、画面表示や復元の前に検査する。
  const isRecord = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
  function isValidSave(d) {
    if (!isRecord(d) || d.v !== 2 || !isRecord(d.S) || !isRecord(d.entry)) return false;
    const st = d.S,
      en = d.entry;
    if (!['free', 'expo'].includes(st.mode) || !['easy', 'normal', 'hard'].includes(st.diff)) return false;
    // 中断地点の復元元（entry）にも同じモードと難易度が必要。
    if (en.mode !== st.mode || en.diff !== st.diff) return false;
    if (
      !Number.isInteger(st.sec) ||
      !secOf(st.sec) || // 消した区画（区画2）の途中のデータも使わない
      !Number.isInteger(en.sec) ||
      en.sec !== st.sec
    )
      return false;
    if (!isRecord(st.flags) || !isRecord(en.flags) || !Array.isArray(st.log) || !Array.isArray(en.log))
      return false;
    if (st.log.some((x) => typeof x !== 'string') || en.log.some((x) => typeof x !== 'string')) return false;
    if ([st.K, st.A, en.K, en.A].some((x) => !Number.isFinite(x) || x < 0 || x > 100)) return false;
    if ([st.lh, en.lh].some((x) => !Number.isFinite(x) || x < 0 || x > RULES.LUNO_HP)) return false;
    if ([st.fh, en.fh].some((x) => !Number.isFinite(x) || x < 0 || x > RULES.FLAM_HP)) return false;
    if (d.rem != null && (!Number.isFinite(d.rem) || d.rem < 0 || d.rem > RULES.TIMER_SEC)) return false;
    if (d.progress != null) {
      if (
        !isRecord(d.progress) ||
        !['puzzle', 'battle'].includes(d.progress.kind) ||
        d.progress.sec !== st.sec
      )
        return false;
      if (
        d.progress.kind === 'puzzle' &&
        (!['s0', 's1', 's4', 's7'].includes(d.progress.sid) || !isRecord(d.progress.puzzleS))
      )
        return false;
      if (
        d.progress.kind === 'battle' &&
        (!['centipede', 'boss'].includes(d.progress.battleKind) || !isRecord(d.progress.battleState))
      )
        return false;
    }
    return true;
  }
  const validSave = () => {
    const d = store.get(TUNE_G.SAVE_KEY);
    return isValidSave(d) ? d : null;
  };

  /* ---------------- ゲームの状態 ---------------- */
  // 表の「重要フラグ」の名前をそのまま使っています（started・cartFailed・mirrorA・mirrorB・crystal・crystalJournal・crystalUsed・lampSolved・bossResolve・stone・finalActions・dogAttacks・attackedDog・short）
  const newFlags = () => ({
    started: false,
    mineGateUnlocked: false,
    cartFailed: false,
    mirrorA: false,
    mirrorB: false,
    mirrorTries: 0,
    crystal: false,
    crystalJournal: false,
    crystalUsed: false,
    lampSolved: false,
    bossResolve: '',
    stone: false,
    finalActions: 0,
    dogAttacks: 0,
    attackedDog: false,
    short: false,
    callN: 0,
    waitN: 0,
    memoryShown: false,
    centResolve: ''
  });
  const newState = (mode, diff) => ({
    mode,
    diff: diff || 'easy',
    sec: 0,
    K: RULES.K_START,
    A: RULES.A_START,
    lh: RULES.LUNO_HP,
    fh: RULES.FLAM_HP,
    flags: newFlags(),
    log: [],
    talk: [], // 会話ログ：{w, t}＝台詞／{ch}＝選んだ選択肢／{sec, h}＝区画の区切り（ゲームのはじめから。保存して「つづきから」でも続く）
    ended: ''
  });
  let S = null; // 今の進行
  let stage = null; // ノベルの場面を描くもの
  let menuOpen = false;
  const cloneState = (v) => JSON.parse(JSON.stringify(v));
  let sectionEntry = null; // 区画に入った時点の状態：途中再開で選択肢を二重反映しない
  let resumePending = null; // セーブ済みの謎解き／戦闘の状態
  let resumeSnapshot = null; // 途中再開時に盤面直前のHP・フラグを戻す
  let resumeChoices = []; // 盤面前の選択を正しく再現するための履歴
  /* ---------------- 謎解き・戦闘の途中経過の保存と再開 ---------------- */
  function saveProgress(kind, payload) {
    if (!S || S.ended || !sectionEntry) return;
    persistProgress({
      v: 2,
      S: cloneState(S),
      entry: cloneState(sectionEntry),
      progress: Object.assign({ kind, sec: S.sec }, cloneState(payload)),
      rem: T.on ? Math.max(0, T.rem) : null
    });
  }
  function takeResume(kind, id) {
    const p = resumePending;
    if (!p || p.kind !== kind || p.sec !== S.sec || (p.sid || p.battleKind) !== id) return null;
    // 開始地点から物語を再生してきた後に、実際のセーブ時点の数値を戻す
    if (resumeSnapshot) {
      const snap = cloneState(resumeSnapshot);
      Object.keys(snap).forEach((k) => {
        if (k === 'flags') Object.assign(S.flags, snap.flags);
        else if (k !== 'talk') S[k] = snap[k]; // 会話ログは、区画のはじめから再生しなおした分をそのまま使う
      });
    }
    resumeSnapshot = null;
    resumeChoices = [];
    resumePending = null;
    UI.setSkip(false);
    hud();
    return p;
  }
  // 谜解き・戦闘モジュールから呼ぶ、区画内オートセーブ
  window.__autoSaveProgress = saveProgress;
  window.__takeGameResume = takeResume;
  // 操作の練習を出すか（このプレイで、そのゲームがはじめてなら true を返して、見たことにする）
  window.__tutorOnce = (id) => {
    if (!S) return false;
    const seen = (S.flags.tut = S.flags.tut || {});
    if (seen[id]) return false;
    seen[id] = true;
    return true;
  };

  /* ---------------- 右上の状態表示 ---------------- */
  const hud = () => {
    if (S) UI.hud({ lh: S.lh, fh: S.fh, lmax: RULES.LUNO_HP, fmax: RULES.FLAM_HP });
  };

  /* ---------------- 選択肢の効果 ---------------- */
  // 表の選択肢（CHOICES）を選んだときの変化を、まとめて反映する。札（トースト）で変化を見せる
  // 結末⑥「君を犠牲に…」の条件：カルマが上がる選択肢のうち、選べる状態で出てきたもの（kOffered）と、選んだもの（kTaken）
  function noteKOffered(items, offs) {
    const F = S.flags;
    F.kOffered = F.kOffered || [];
    items.forEach((it) => {
      const id = typeof it === 'string' ? it : it.id;
      const c = CHOICES[id];
      if (c && c.K > 0 && !(offs && offs[id]) && !F.kOffered.includes(id)) F.kOffered.push(id);
    });
  }
  function apply(id) {
    const c = CHOICES[id];
    if (!c) throw new Error('選択肢の表にありません: ' + id);
    if (c.K > 0) {
      S.flags.kTaken = S.flags.kTaken || [];
      if (!S.flags.kTaken.includes(id)) S.flags.kTaken.push(id);
    }
    const pl = S.lh,
      pf = S.fh;
    const dK = c.K || 0,
      dA = c.band ? RULES.callDelta(S.K) || 0 : c.A || 0;
    S.K = clamp(S.K + dK, 0, 100);
    S.A = clamp(S.A + dA, 0, 100);
    if (c.hp) {
      if (c.hp.flam) S.fh = clamp(S.fh + c.hp.flam, 1, RULES.FLAM_HP); // フラメトHPは最低1・最大35
      if (c.hp.luno) S.lh = clamp(S.lh + c.hp.luno, 1, RULES.LUNO_HP);
    }
    if (c.set) Object.assign(S.flags, c.set);
    if (c.tries) S.flags[c.tries] = (S.flags[c.tries] || 0) + 1;
    S.log.push(id);
    if (S.lh !== pl) UI.toast('ルノ HP ' + signed(S.lh - pl), S.lh > pl ? 'ok' : 'hp');
    if (S.fh !== pf) UI.toast('フラメト HP ' + signed(S.fh - pf), S.fh > pf ? 'ok' : 'hp');
    if (S.lh !== pl || S.fh !== pf) {
      // HPが変わったときだけ、減ったか増えたかで音を分ける（カルマ・不安の増減は、音でも知らせない）
      const dh = S.lh - pl + (S.fh - pf);
      sfx('gauge', dh < 0 ? 'bad' : 'good');
    }
    hud();
  }
  // ボタンの文から「（カルマ＋10）」「（不安＋5）」のような数値の注記を外す（表の文は rules.js にそのまま残す）
  const plainLabel = (t) => t.replace(/[（(][^）)]*(カルマ|不安)[^）)]*[）)]/g, '').trim();
  // 選択肢の見た目（表のラベル＋HPなどの札）。off に理由を入れると、灰色で選べない
  function optFor(it, off) {
    if (typeof it === 'object') return it;
    const c = CHOICES[it],
      tags = []; // カルマ・不安の増減は、プレイヤーには見せない（数字ではなく気持ちで選んでもらうため）
    if (c.hp && c.hp.flam) tags.push(['フラメトHP' + signed(c.hp.flam), 'ok']);
    if (c.once) tags.push(['初回のみ', 'once']);
    return { id: it, label: plainLabel(c.label), tags, off };
  }
  // 台詞（案内文）を出したまま、選択肢を出して、選ばれた id を返す
  // line が配列なら、最後の1つ以外は順に読ませてから、最後の文を出したまま選ぶ。null なら、いま出ている文のまま選ぶ
  async function ask(run, line, items, offs) {
    UI.guard(run);
    if (Array.isArray(line)) {
      for (const l of line.slice(0, -1)) await UI.say(run, l);
      line = line[line.length - 1];
    }
    if (line) UI.showLine(line, false);
    noteKOffered(items, offs);
    // オートセーブ再開時は直前に選んだ選択肢を再現し、重複を防ぐ
    const opts = items.map((it) => optFor(it, offs && typeof it === 'string' ? offs[it] : undefined));
    const chose = (id) => {
      const o = opts.find((x) => x.id === id);
      if (o) talkAdd({ ch: o.label }); // 選んだ選択肢を会話ログに残す
      return id;
    };
    if (resumePending && resumeChoices.length) {
      const id = resumeChoices[0];
      if (items.some((it) => (typeof it === 'string' ? it : it.id) === id)) {
        resumeChoices.shift();
        return chose(id);
      }
    }
    return chose(await UI.choose(run, opts));
  }

  /* ---------------- 会話ログ ---------------- */
  function talkAdd(e) {
    if (!S) return;
    const t = S.talk || (S.talk = []),
      last = t[t.length - 1];
    if (last && JSON.stringify(last) === JSON.stringify(e)) return; // 同じものを続けて2回は残さない
    t.push(e);
    if (t.length > TUNE_G.TALK_MAX) t.splice(0, t.length - TUNE_G.TALK_MAX);
  }
  // 区画に入ったとき：同じ区画をはじめからやり直す（つづきから）ときは、その区画の分を消してから、もう一度残す
  function talkSection(h) {
    const t = S.talk || (S.talk = []);
    let i = t.length - 1;
    while (i >= 0 && t[i].sec == null) i--;
    if (i >= 0 && t[i].sec === S.sec) t.length = i;
    talkAdd({ sec: S.sec, h });
  }
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const TALK_WHO = Object.assign({}, STORY.names, { jrn: '日誌', plq: '碑文' });
  const logOpen = () => !$('logv').hidden;
  function openLog() {
    if (!S || logOpen() || UI.dlgOpen() || menuOpen || UI.getMode() !== 'novel') return;
    const list = $('log-list');
    list.innerHTML = (S.talk || [])
      .map((e) =>
        e.sec != null
          ? '<div class="le sec">― ' + esc(e.h) + ' ―</div>'
          : e.ch
            ? '<div class="le lch"><span>▶ ' + esc(e.ch) + '</span></div>'
            : '<div class="le ' +
              esc(e.w) +
              '"><b>' +
              esc(TALK_WHO[e.w] || '') +
              '</b><span>' +
              esc(e.t) +
              '</span></div>'
      )
      .join('');
    $('logv').hidden = false;
    list.scrollTop = list.scrollHeight; // 開いたときは、最後に見た台詞が一番下に見える所から
    list.focus();
  }
  function closeLog() {
    $('logv').hidden = true;
  }

  /* ---------------- ノベル：場面と台詞の再生 ---------------- */
  // beats：台詞・場面・演出の並び（story.js の書き方）。文字列は案内文としてそのまま出す
  // BGM（audio.js の場面ID）を流す。場面の切り替えに合わせて流す曲
  const bgm = (k) => window.Sound.bgm(k);
  const SC_BGM = {
    dusk: 's0_dusk',
    house_in: 's0_house',
    house_eve: 's0_house',
    house_night: 's0_night',
    memory: 'memory',
    return_path: 'sec10'
  };
  /* カルマ演出：区画のはじめのカルマで決めた段階（mood：'' ふつう／'mid' ぎくしゃく／'far' 離れている）で、フラメトの様子を変える
     ・台詞の並びの kv: { mid: {…}, far: {…} } ＝ その段階のときに、上書きする中身（ポーズ・ずらす量・台詞・効果音）
     ・ずらした量（off）は、同じ場面のあいだ、あとのフラメトの立ち位置にも引き継ぐ
     ・「無理に歩かせる」を選んだあと（区画7〜10）は、フラメトを元気のない絵にする（カルマ演出より優先） */
  const MOOD = { stage: '', off: null };
  const SAD_POSE = { idle: 'sad', happy: 'sad', sniff: 'sad', sit: 'sit_sad', lie: 'lie_sad' }; // 元気のない絵への読みかえ
  function setMood() {
    MOOD.stage = S.K >= RULES.K_HIGH ? 'far' : S.K >= RULES.K_MOOD_MID ? 'mid' : '';
    MOOD.off = null;
  }
  function moodBeat(b) {
    if (S.ended) return b;
    let nb = b;
    if (b.sc) MOOD.off = null;
    const v = b.kv && b.kv[MOOD.stage];
    if (v) {
      nb = Object.assign({}, b, v, { c: v.c ? Object.assign({}, b.c, v.c) : b.c });
      if (v.c && v.c.flam && v.c.flam[4]) MOOD.off = v.c.flam[4];
    } else if (MOOD.off && b.c && b.c.flam && !b.c.flam[4]) {
      const f = b.c.flam.slice();
      while (f.length < 4) f.push(f.length === 2 ? 0 : 1);
      f[4] = MOOD.off;
      nb = Object.assign({}, b, { c: Object.assign({}, b.c, { flam: f }) });
    }
    if (S.flags.pushed && S.sec >= 7 && nb.c && nb.c.flam && SAD_POSE[nb.c.flam[0]]) {
      const f = nb.c.flam.slice();
      f[0] = SAD_POSE[f[0]];
      nb = Object.assign({}, nb, { c: Object.assign({}, nb.c, { flam: f }) });
    }
    return nb;
  }
  async function play(run, beats) {
    const list = Array.isArray(beats) ? beats : [beats];
    for (const b0 of list) {
      UI.guard(run);
      const b = typeof b0 === 'string' ? b0 : moodBeat(b0);
      if (typeof b === 'string') {
        UI.sys(b);
        continue;
      }
      if (b.sc && !S.ended && SC_BGM[b.sc] && (b.sc === 'memory' || b.sc === 'return_path' || S.sec === 0))
        bgm(SC_BGM[b.sc]);
      const fxNow = () => {
        if (b.sfx) sfx(b.sfx, b.sfxVariant, b.sfxVol);
      }; // 効果音は、絵が変わる瞬間に鳴らす（暗転をはさむときは、明るくなり始めたとき）
      if (
        b.sc ||
        b.c ||
        b.item ||
        b.enemy !== undefined ||
        b.dust !== undefined ||
        b.gate ||
        b.deskOff ||
        b.dim != null
      ) {
        if (b.sc && b.fade && window.Sound.cutSe) window.Sound.cutSe(0.3);
        if (b.sc) UI.hideMsg(); // 背景が変わるときは、前の場面の台詞を消して、枠をいったん隠す（次の台詞で出す）
        await stage.change(b, fxNow);
        UI.guard(run);
      } else fxNow();
      if (b.shake) stage.shake(b.shake[0], b.shake[1]);
      if (b.flash) stage.flash();
      if (b.wait) await UI.wait(run, b.wait);
      if (b.w) await UI.say(run, b);
    }
  }
  function setMode(m) {
    UI.mode(m);
    UI.showMsg();
    if (m === 'novel') {
      $('chips').innerHTML = '';
      if (window.Tutor) window.Tutor.stop(); // 戦闘・謎解きが終わったら、操作の練習の吹き出しも消す
    }
  }

  /* ---------------- 展示タイマー（表：20分／残り5分・2分・30秒・0秒に特別処理） ---------------- */
  const T = { on: false, rem: 0, last: 0, fired: {}, id: null };
  const T_MARKS = [RULES.WARN_AT, RULES.SHORT_AT, RULES.LAST_AT, 0];
  function timerStart(sec) {
    T.on = true;
    T.rem = sec;
    T.last = performance.now();
    T.fired = {};
    T_MARKS.forEach((m) => {
      T.fired[m] = sec <= m && m > 0;
    }); // 途中から再開したとき、過ぎた区切りは鳴らさない
    UI.timer(T.rem);
    if (!T.id) T.id = setInterval(timerTick, TUNE_G.TIMER_TICK_MS);
  }
  function timerStop() {
    T.on = false;
  }
  function setRemaining(sec) {
    // 確認用：残り時間を直接変える（過ぎた区切りは鳴らさない）
    T.rem = Math.max(0, Math.min(RULES.TIMER_SEC, Number.isFinite(sec) ? sec : 0));
    T.last = performance.now();
    T_MARKS.forEach((m) => {
      T.fired[m] = m > T.rem;
    });
    UI.timer(T.rem);
  }
  function timerTick() {
    if (!T.on || !S) return;
    const now = performance.now();
    T.rem = Math.max(0, T.rem - Math.max(0, now - T.last) / 1000);
    T.last = now;
    UI.timer(T.rem);
    // タブ復帰などで残時間が複数の通知境界を一度にまたいでも、
    // タイマー切れを最優先し、同じフレームで別シーンへ複数回遷移させない。
    if (T.rem <= 0 && !T.fired[0]) {
      T.fired[0] = true;
      timeUp();
      return;
    }
    if (T.rem <= RULES.WARN_AT && !T.fired[RULES.WARN_AT]) {
      T.fired[RULES.WARN_AT] = true;
      UI.banner(P.t_warn, 'warn', 5200);
      sfx('warn');
    }
    if (T.rem <= RULES.SHORT_AT && !T.fired[RULES.SHORT_AT]) {
      T.fired[RULES.SHORT_AT] = true;
      // このtickでは一回のシーン移動だけを許可する
      shortRoute();
      return;
    }
    if (T.rem <= RULES.LAST_AT && !T.fired[RULES.LAST_AT]) {
      T.fired[RULES.LAST_AT] = true;
      UI.banner(P.t_last, 'alert', 5200);
      sfx('alarm');
      if (S.sec < 9) shortRoute();
    }
  }
  // 残り2分：第9区画へ短縮ルート（short=true・戦闘や謎解きは打ち切り・結末①不可）
  function shortRoute() {
    if (!S || S.ended) return;
    S.flags.short = true;
    if (S.sec >= 10) return;
    UI.banner('（日が沈みかけてる…！ 近道を行こう）', 'alert', 4200);
    sfx('alarm');
    if (S.sec === 9) {
      begin({ go: 9, o: { askOnly: true } });
      return;
    } // すでに祭壇：選択肢だけ作り直して、①を選べなくする
    begin({ go: 9, o: { fromTimer: true } });
  }
  // 残り0秒：区画10で結末②の条件が成立していれば②、そうでなければ時間切れ専用エンド
  function timeUp() {
    if (!S || S.ended) return;
    timerStop();
    const F = S.flags,
      ok2 = S.sec === 10 && F.finalActions >= RULES.FINAL_NEED && !F.attackedDog && S.K < RULES.K_HIGH;
    begin({ end: ok2 ? 'e2' : 'e_timeout' });
  }

  /* ---------------- 区画ごとの進行（sections.js） ---------------- */
  const SECS = window.makeSections({
    get S() {
      return S;
    },
    get stage() {
      return stage;
    },
    P,
    RULES,
    UI,
    apply,
    ask,
    play,
    setMode,
    sfx,
    bgm,
    hud,
    signed,
    timerStart,
    toTitle,
    herdResult
  });

  /* ---------------- 進行の起動・中断 ---------------- */
  function closeAll() {
    UI.kill();
    Puzzle.stop();
    Battle.stop();
    UI.clearOverlays();
    UI.clearMsg();
    UI.closeVeil();
    closeLog();
    menuOpen = false;
  }
  // いまの進行をやめて、first（{go:区画番号, o:…} か {end:'e1'}）から新しく始める
  function begin(first) {
    closeAll();
    const run = UI.newRun();
    if (resumePending) UI.setSkip(true); // 中断した盤面に至るまでの既読部分は早送り
    drive(run, first);
  }
  async function drive(run, first) {
    let next = first;
    try {
      while (next) {
        UI.guard(run);
        if (next.end) {
          await playEnding(run, next.end);
          return;
        }
        S.sec = next.go;
        talkSection(S.sec === 0 ? '序章' : areaLabel(S.sec) + '　' + secOf(S.sec).name);
        setMood(); // カルマ演出の段階は、区画のはじめに決めて、その区画のあいだは変えない
        hud();
        sectionEntry = cloneState(S);
        if (S.sec >= 1) {
          // 再開時は保存済みの盤面データを守り、該当する場面で読み込む
          if (!resumePending) save();
          const o = next.o || {};
          if (!o.fromTimer && !o.askOnly)
            UI.banner(
              areaLabel(S.sec) + '　' + secOf(S.sec).name + '（' + secOf(S.sec).kind + '）',
              '',
              TUNE_G.SECTION_BANNER_MS
            );
        }
        if (S.sec >= 1 && !(next.o && next.o.fromTimer)) bgm('sec' + S.sec);
        next = await SECS[S.sec](run, next.o || {});
      }
    } catch (e) {
      if (e === CANCEL) return;
      console.error(e);
      failDialog(e);
    }
  }
  function failDialog(e) {
    UI.openDlg(
      '<div class="dlg-h"><span class="emb"></span><h2>エラー</h2></div><div class="dlg-b"><p style="margin:0">すみません、プログラムでエラーが起きました。</p><p class="fine" style="margin:0;word-break:break-all">' +
        String((e && e.message) || e).replace(/[<>&]/g, '') +
        '</p><div class="btns"><button class="kbtn" data-a="title">タイトルへ</button></div></div>',
      (d) => {
        d.querySelector('[data-a]').onclick = () => toTitle();
      }
    );
  }

  /* ---------------- 保存・つづきから ---------------- */
  function save() {
    if (!S || S.ended) return;
    persistProgress({
      v: 2,
      S: cloneState(S),
      entry: cloneState(sectionEntry || S),
      progress: null,
      rem: T.on ? Math.max(0, T.rem) : null
    });
  }
  function continueGame() {
    const d = validSave();
    if (!d) {
      UI.toast('有効なセーブデータがありません。', 'warn');
      renderTitle();
      return;
    }
    closeAll();
    resumePending = d.progress && d.progress.sec === d.S.sec ? d.progress : null;
    resumeSnapshot = resumePending ? cloneState(d.S) : null;
    const baseLog = d.entry && Array.isArray(d.entry.log) ? d.entry.log.length : 0;
    resumeChoices = resumePending ? (d.S.log || []).slice(baseLog).filter((id) => !!CHOICES[id]) : [];
    S = cloneState(resumePending && d.entry ? d.entry : d.S);
    S.log = S.log || [];
    S.talk = S.talk || [];
    S.diff = S.diff || 'easy';
    S.flags = Object.assign(newFlags(), S.flags); // 旧セーブデータに足りないフラグを補う
    UI.screen('play');
    hud();
    window.Sound.ac();
    if (S.mode === 'expo' && d.rem != null) timerStart(d.rem);
    else {
      timerStop();
      UI.timer(null);
    }
    begin({ go: S.sec });
  }
  // 難易度を選ぶ（はじめるときだけ。ゲームの途中では変えられない）
  /* ---------------- 新しく始める・タイトルへ戻る・区画へ飛ぶ ---------------- */
  const diffName = (d) => (STORY.diffs.find((x) => x.id === d) || STORY.diffs[0]).name;
  function chooseDiff(mode) {
    UI.openDlg(
      '<div class="dlg-h"><span class="emb"></span><h2>難易度をえらぶ</h2></div><div class="dlg-b"><p class="fine" style="margin:0">' +
        STORY.diffLead +
        '</p><div class="diffs">' +
        STORY.diffs
          .map(
            (x) =>
              '<button class="t-btn' +
              (x.id === 'hard' ? ' rd' : '') +
              '" data-diff="' +
              x.id +
              '">' +
              x.name +
              '<small>' +
              x.note +
              '</small></button>'
          )
          .join('') +
        '</div><div class="btns"><button class="kbtn sm" data-a="no">やめる</button></div></div>',
      (d) => {
        d.querySelectorAll('[data-diff]').forEach((b) => {
          b.onclick = () => {
            sfx('click');
            UI.closeVeil();
            newGame(mode, b.dataset.diff);
          };
        });
        d.querySelector('[data-a="no"]').onclick = () => {
          sfx('click');
          UI.closeVeil();
        };
      }
    );
  }
  function newGame(mode, diff) {
    if (!diff) {
      chooseDiff(mode);
      return;
    }
    closeAll();
    timerStop();
    resumePending = null;
    resumeSnapshot = null;
    resumeChoices = [];
    sectionEntry = null;
    S = newState(mode, diff);
    // 新規ゲームの開始時に前回の続きデータを置き換える。序章も再開地点とする。
    save();
    UI.screen('play');
    UI.timer(null);
    hud();
    window.Sound.ac();
    begin({ go: 0 });
  }
  function toTitle() {
    closeAll();
    timerStop();
    UI.timer(null);
    UI.screen('title');
    bgm('title');
    renderTitle();
  }
  function jumpTo(n) {
    // 確認用：区画へ直接行く（持ち物などは、その区画に必要な最小限だけ整える）
    if (!S) return;
    closeAll();
    const F = S.flags;
    if (!F.started) {
      F.started = true;
      if (S.mode === 'expo' && !T.on) timerStart(RULES.TIMER_SEC);
    }
    if (n >= 10) F.stone = true;
    if (n >= 8 && !F.lampSolved) F.lampSolved = true;
    begin({ go: n });
  }

  /* ---------------- 結末 ---------------- */
  // 結末の札を①②③④・未の順に並べる。見た結末だけ明るく
  function endMarks() {
    return (
      '<div class="endmarks">' +
      Object.keys(P.endings)
        .map(
          (k) =>
            '<span class="' +
            (endings[k] ? 'on' : '') +
            '" title="' +
            (endings[k] ? P.endings[k].name : 'まだ見ていない') +
            '">' +
            P.endings[k].mark +
            '</span>'
        )
        .join('') +
      '</div>'
    );
  }
  async function playEnding(run, id) {
    timerStop();
    Puzzle.stop();
    Battle.stop();
    UI.timer(null);
    S.ended = id;
    talkAdd({ sec: 'end', h: '結末' });
    store.del(TUNE_G.SAVE_KEY);
    bgm(id);
    setMode('novel');
    await play(run, P[id]);
    const quit = id === 'e_quit'; // 中断の結末（結末の一覧には数えない）
    sfx(id === 'e_timeout' || id === 'e4' || id === 'e6' || quit ? 'sad' : 'glow');
    if (!quit) {
      endings[id] = true;
      store.set(TUNE_G.END_KEY, endings);
    }
    const E = quit ? P.quit_end : P.endings[id],
      F = S.flags,
      seen = Object.keys(P.endings).filter((k) => endings[k]).length;
    const nk = Object.keys(P.endings).find((k) => !endings[k]),
      next = nk ? P.endings[nk] : null; // まだ見ていない結末のうち、いちばん番号の小さいもの
    const act = await new Promise((res) => {
      UI.openDlg(
        '<div class="dlg-h"><span class="emb"></span><h2>' +
          (id === 'e_timeout' ? '時間切れ' : quit ? STORY.quit.title : '結末') +
          '</h2></div><div class="dlg-b">' +
          '<div class="endcard"><div class="mk">' +
          E.mark +
          '</div><div class="nm">' +
          E.name +
          '</div><div class="nt">' +
          E.note +
          '</div></div>' +
          '<ul class="rows"><li><span>ルノ／フラメトのHP</span><b>' +
          S.lh +
          '／' +
          S.fh +
          '</b></li>' +
          '<li><span>水晶のかけら</span><b>' +
          (F.crystal ? '持っていた' : '持っていない') +
          '</b></li><li><span>見た結末</span><b>' +
          seen +
          '／' +
          Object.keys(P.endings).length +
          '</b></li></ul>' +
          endMarks() +
          (quit
            ? ''
            : next
              ? '<div class="endhint"><button class="kbtn sm" id="e-hint">ヒントを見る</button><p id="e-hint-t" hidden>' +
                next.hint +
                '</p></div>'
              : '<p class="endhint">すべての結末を見ました。遊んでくれて、ありがとう。</p>') +
          '<div class="btns"><button class="kbtn" data-a="again">もう一度はじめから</button><button class="kbtn sm rd" data-a="title">タイトルへ</button></div></div>',
        (d) => {
          d.querySelectorAll('[data-a]').forEach((b) => {
            b.onclick = () => {
              sfx('click');
              res(b.dataset.a);
            };
          });
          const hb = d.querySelector('#e-hint');
          if (hb)
            hb.onclick = () => {
              sfx('click');
              hb.hidden = true;
              d.querySelector('#e-hint-t').hidden = false;
            };
        }
      );
      run.pend.push(() => res('cancel'));
    });
    UI.guard(run);
    UI.closeVeil();
    if (act === 'again') newGame(S.mode);
    else toTitle();
  }

  /* ---------------- タイトル ---------------- */
  function renderTitle() {
    $('endings').innerHTML = Object.keys(P.endings)
      .map((k) => {
        const e = P.endings[k],
          got = !!endings[k];
        return (
          '<div class="endb' +
          (got ? ' got' : '') +
          '" title="' +
          (got ? e.note : 'まだ見ていない結末') +
          '"><div class="mk">' +
          e.mark +
          '</div><div class="nm">' +
          e.name +
          '</div></div>'
        );
      })
      .join('');
    const d = validSave(),
      has = !!d;
    $('btn-cont').hidden = !has;
    if (has)
      $('cont-note').textContent =
        areaLabel(d.S.sec) +
        '「' +
        secOf(d.S.sec).name +
        '」' +
        (d.progress ? 'の途中から／' : 'のはじめから／') +
        (d.S.mode === 'expo' ? UI.dayPhase(d.rem == null ? 0 : d.rem).word + 'ごろ' : '時間制限なし') +
        '／難易度 ' +
        diffName(d.S.diff);
  }

  /* ---------------- メニュー ---------------- */
  /* ---------------- 羊追いの結果（難易度の目安）。'go'（この難易度で進む）か 'back'（タイトルへ戻る）を返す ---------------- */
  function herdResult(run, info) {
    const H = STORY.herd,
      order = ['easy', 'normal', 'hard'],
      di = order.indexOf(S.diff),
      ratio = info.moves / Math.max(1, info.par);
    // 目安：手数が目安の RULES.HERD_UP 倍以下なら「上も」、HERD_DOWN 倍以上か HERD_SLOW_SEC 秒以上なら「下も」
    let adv = 'ok';
    if (ratio <= RULES.HERD_UP && di < 2) adv = 'up';
    else if ((ratio >= RULES.HERD_DOWN || info.sec >= RULES.HERD_SLOW_SEC) && di > 0) adv = 'down';
    const mm = Math.floor(info.sec / 60),
      ss = String(Math.round(info.sec % 60)).padStart(2, '0');
    return new Promise((res) => {
      UI.openDlg(
        Dialogs.herd(H, { diff: diffName(S.diff), moves: info.moves, par: info.par, mm, ss, adv }),
        (d) => {
          d.querySelectorAll('[data-a]').forEach((b) => {
            b.onclick = () => {
              sfx('click');
              UI.closeVeil();
              res(b.dataset.a);
            };
          });
        }
      );
      run.pend.push(() => res('cancel'));
    });
  }
  // メニューの「棄権する」：確認して、中断の結末へ
  function quitGame() {
    confirmDlg(STORY.quit.confirm, STORY.quit.btn, () => begin({ end: 'e_quit' }));
  }
  function confirmDlg(text, okLabel, onOk) {
    UI.openDlg(Dialogs.confirm(text, okLabel), (d) => {
      d.querySelector('[data-a="ok"]').onclick = () => {
        UI.closeVeil();
        onOk();
      };
      d.querySelector('[data-a="no"]').onclick = () => {
        UI.closeVeil();
      };
    });
  }
  function openMenu() {
    sfx('click');
    window.Sound.ac();
    const inPlay = !!S && !$('scr-play').hidden;
    const h = Dialogs.menu({
      play: inPlay
        ? {
            where: S.sec === 0 ? '序章' : areaLabel(S.sec) + '「' + secOf(S.sec).name + '」',
            diff: diffName(S.diff),
            lh: S.lh,
            lhMax: RULES.LUNO_HP,
            fh: S.fh,
            fhMax: RULES.FLAM_HP,
            crystal: S.flags.crystal,
            stone: S.flags.stone,
            time: S.mode === 'expo' ? (T.on ? UI.dayPhase(T.rem).word : '—') : null,
            mode: UI.getMode(),
            committed: S.flags.committed,
            quitBtn: STORY.quit.btn
          }
        : null,
      prefs,
      dev: TUNE_G.DEV_MENU
        ? {
            secs: STORY.sec.map((x) => ({ no: x.no, label: areaLabel(x.no), name: x.name })),
            expo: S && S.mode === 'expo'
          }
        : null
    });
    menuOpen = true;
    UI.openDlg(h, (d) => {
      const tg = (id, key, after) => {
        const b = d.querySelector('#' + id);
        b.onclick = () => {
          prefs[key] = !prefs[key];
          b.setAttribute('aria-checked', String(!!prefs[key]));
          savePrefs();
          if (after) after();
          sfx('click');
        };
      };
      tg('sw-snd', 'sound', () => {
        window.Sound.S.enabled = prefs.sound;
      });
      tg('sw-bgm', 'bgm', () => {
        window.Sound.setBgmOn(prefs.bgm);
      });
      const vb = d.querySelector('#vol-bgm'),
        vs = d.querySelector('#vol-se');
      vb.oninput = () => {
        prefs.bgmVol = +vb.value;
        d.querySelector('#vo-bgm').textContent = vb.value;
        window.Sound.setBgmVol(prefs.bgmVol / 100);
      };
      vs.oninput = () => {
        prefs.seVol = +vs.value;
        d.querySelector('#vo-se').textContent = vs.value;
        window.Sound.S.seVol = prefs.seVol / 100;
      };
      vb.onchange = savePrefs;
      vs.onchange = () => {
        savePrefs();
        sfx('click');
      }; // 手を離したとき：保存して、効果音は試しに1回鳴らす
      d.querySelector('#m-close').onclick = () => {
        menuOpen = false;
        UI.closeVeil();
      };
      let armed = false;
      const er = d.querySelector('#m-erase');
      er.onclick = () => {
        if (!armed) {
          armed = true;
          er.textContent = '本当に消す？ もう一度押す';
          return;
        }
        endings = {};
        store.del(TUNE_G.END_KEY);
        store.del(TUNE_G.SAVE_KEY);
        menuOpen = false;
        UI.closeVeil();
        if (!inPlay) renderTitle();
      };
      const bh = d.querySelector('#m-bhelp');
      if (bh)
        bh.onclick = () => {
          menuOpen = false;
          battleHelp(true);
        };
      const au = d.querySelector('#m-auto');
      if (au)
        au.onclick = () => {
          menuOpen = false;
          Puzzle.autoSolve();
        };
      const rs = d.querySelector('#m-restart');
      if (rs)
        rs.onclick = () => {
          menuOpen = false;
          UI.closeVeil();
          resumePending = null;
          // 中途のHPや選択を重複させず、区画開始の状態まで戻す
          if (sectionEntry) S = cloneState(sectionEntry);
          begin({ go: S.sec });
        };
      const ti = d.querySelector('#m-title');
      if (ti)
        ti.onclick = () => {
          menuOpen = false;
          confirmDlg(
            'タイトルへ戻ります。区画開始時と謎解き・戦闘の進行が自動保存されています。',
            'タイトルへ',
            toTitle
          );
        };
      const qt = d.querySelector('#m-quit');
      if (qt)
        qt.onclick = () => {
          menuOpen = false;
          quitGame();
        };
      d.querySelectorAll('[data-j]').forEach((b) => {
        b.onclick = () => {
          menuOpen = false;
          jumpTo(+b.dataset.j);
        };
      });
      d.querySelectorAll('[data-adj]').forEach((b) => {
        b.onclick = () => {
          const [w, v] = b.dataset.adj.split(':');
          S[w] = clamp(S[w] + +v, 0, 100);
          hud();
          sfx('gauge');
          b.blur();
        };
      });
      d.querySelectorAll('[data-t]').forEach((b) => {
        b.onclick = () => {
          menuOpen = false;
          UI.closeVeil();
          if (!T.on) timerStart(+b.dataset.t);
          else setRemaining(+b.dataset.t);
        };
      });
    });
  }

  /* ---------------- 戦い方の説明 ---------------- */
  // force なし：はじめての戦闘の前に1回だけ（見たことは設定と一緒に保存）。force あり：メニューから、いつでも
  function battleHelp(force) {
    if (!force && prefs.battleHelpSeen) return Promise.resolve();
    prefs.battleHelpSeen = true;
    savePrefs();
    const t0 = performance.now(); // 展示モードでも、説明を読んでいる間は残り時間を減らさない
    return new Promise((res) => {
      UI.openDlg(Dialogs.battleHelp(P.battle_help, force), (d) => {
        d.querySelector('[data-a]').onclick = () => {
          sfx('click');
          UI.closeVeil();
          if (T.on) T.rem += (performance.now() - t0) / 1000;
          res();
        };
      });
    });
  }

  /* ---------------- 入力（キー・タップ） ---------------- */
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // 会話ログを開いている間：L・Esc で閉じる。↑↓は一覧のスクロール（ほかの操作はしない）
    if (logOpen()) {
      if (e.key === 'Escape' || e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        closeLog();
      }
      return;
    }
    if (
      (e.key === 'l' || e.key === 'L') &&
      S &&
      !$('scr-play').hidden &&
      !UI.dlgOpen() &&
      !menuOpen &&
      UI.getMode() === 'novel'
    ) {
      e.preventDefault();
      openLog();
      return;
    }
    if (e.key === 'Escape') {
      if (menuOpen) {
        menuOpen = false;
        UI.closeVeil();
      } else if (S && !$('scr-play').hidden && !UI.dlgOpen()) openMenu();
      return;
    }
    if (UI.dlgOpen() || $('scr-play').hidden) return;
    const m = UI.getMode();
    if ((e.key === 'Enter' || e.key === ' ') && UI.waiting()) {
      e.preventDefault();
      UI.advance();
      return;
    } // 台詞の送りを、謎解き・戦闘の操作より先に
    if (m === 'puzzle' && Puzzle.key(e)) return;
    if (m === 'battle' && Battle.key(e)) return;
    if (e.key === 'Enter' || e.key === ' ') {
      if (UI.waiting()) {
        e.preventDefault();
        UI.advance();
      }
      return;
    }
    if (e.key >= '1' && e.key <= '9') {
      const b = $('choices').children[+e.key - 1];
      if (b) {
        e.preventDefault();
        b.click();
      }
    }
  });
  function bindPointers() {
    const wrap = $('cvwrap');
    let p0 = null;
    wrap.addEventListener('pointerdown', (e) => {
      window.Sound.ac();
      p0 = { x: e.clientX, y: e.clientY };
    });
    wrap.addEventListener('pointerup', (e) => {
      if (!p0) return;
      const dx = e.clientX - p0.x,
        dy = e.clientY - p0.y;
      p0 = null;
      if (e.target.closest('#msg, #choices')) return; // 重ねた台詞の枠・選択肢の上は、それぞれの操作にまかせる
      const m = UI.getMode(),
        moved = Math.max(Math.abs(dx), Math.abs(dy)) >= Puzzle.TUNE_P.SWIPE_PX;
      if (m === 'puzzle') {
        if (moved) Puzzle.swipe(dx, dy);
        else if (!UI.waiting()) Puzzle.tap(e.clientX, e.clientY);
        else UI.advance();
        return;
      }
      if (UI.waiting()) {
        UI.advance();
        return;
      }
      if (m === 'battle' && !moved) Battle.tap(e.clientX, e.clientY);
    });
    wrap.addEventListener('pointercancel', () => {
      p0 = null;
    });
    $('msg').addEventListener('click', () => {
      window.Sound.ac();
      UI.advance();
    });
    $('btn-log').addEventListener('click', (e) => {
      e.stopPropagation();
      window.Sound.ac();
      openLog();
    });
    // マウスホイールを上に回すと会話ログを開く（会話の場面のとき）
    wrap.addEventListener(
      'wheel',
      (e) => {
        if (e.deltaY < 0 && !logOpen()) openLog();
      },
      { passive: true }
    );
    $('log-x').addEventListener('click', closeLog);
    $('logv').addEventListener('click', (e) => {
      if (e.target === $('logv')) closeLog(); // 枠の外を押しても閉じる
    });
    $('logv').addEventListener('contextmenu', (e) => {
      e.preventDefault();
      closeLog();
    });
    $('btn-skip').addEventListener('click', (e) => {
      e.stopPropagation();
      window.Sound.ac();
      UI.setSkip(!UI.getSkip());
    });
  }

  /* ---------------- 毎フレームの描画 ---------------- */
  function loop(now) {
    if (!$('scr-play').hidden) {
      const m = UI.getMode();
      if (m === 'puzzle') Puzzle.draw(now);
      else if (m === 'battle') Battle.draw(now);
      else if (stage) stage.frame(now);
    }
    requestAnimationFrame(loop);
  }

  /* ---------------- 起動 ---------------- */
  async function boot() {
    UI.onLine = (l) => talkAdd({ w: l.w, t: l.t }); // 画面に出た台詞を会話ログに残す
    document.body.classList.toggle('notes-off', !prefs.notes);
    window.Sound.S.enabled = !!prefs.sound;
    window.Sound.S.bgm = !!prefs.bgm;
    window.Sound.S.seVol = prefs.seVol / 100;
    window.Sound.S.bgmVol = prefs.bgmVol / 100;
    try {
      await Render.load(window.ATLAS_URL);
    } catch (e) {
      $('ld').textContent = 'ドット絵の読み込みに失敗しました。ページを開き直してください。';
      return;
    }
    stage = Stage.create($('cv'));
    Puzzle.init($('cv'));
    Battle.init($('cv'));
    bindPointers();
    $('btn-new').onclick = () => newGame('free');
    $('btn-expo').onclick = () => newGame('expo');
    $('btn-cont').onclick = continueGame;
    $('btn-tmenu').onclick = openMenu;
    $('ph-menu').onclick = openMenu;
    $('veil').addEventListener('pointerdown', (e) => {
      if (e.target === $('veil') && menuOpen) {
        menuOpen = false;
        UI.closeVeil();
      }
    });
    toTitle();
    requestAnimationFrame(loop);
    // 確かめ用（自動テストが使う）
    window.__G = {
      get S() {
        return S;
      },
      stage: () => stage,
      jumpTo,
      setRemaining,
      toTitle,
      openMenu
    };
    window.__ready = true;
  }
  boot();
})();
