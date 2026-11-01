/* ==========================================================================
   sections.js ― 序章と区画1〜10の流れ（台詞・選択肢・謎解き・戦闘をつなぐ）
   ゲーム全体の土台（状態・保存・タイマー・台詞の再生・メニュー）は game.js にあり、
   game.js が makeSections(G) を呼んで、ここの区画を受け取ります。G は game.js の道具のまとめです。
   ========================================================================== */
(function () {
  'use strict';

  /* ★ 調整用の数値 */
  const TUNE_SEC = {
    BARK_TO_SPLASH_MS: 450,    // 区画2：フラメトが吠えてから、水に飛び込む音までの間（ミリ秒）
    HERD_AT: 5                 // 序章：story.js の s0 の何番目の手前で羊追いをはさむか（「ワン！」のあと）
  };

  window.makeSections = function (G) {
    const { P, RULES, UI, apply, ask, optFor, play, setMode, sfx, bgm, hud, signed, timerStart, toTitle, battleHelp } = G;
    const Puzzle = window.Puzzle, Battle = window.Battle;
    let S = null, stage = null;
    const HERD_AT = TUNE_SEC.HERD_AT;   // 今の進行と、ノベルの場面を描くもの（区画を始めるときに game.js から受け取る）

    // 各区画は、次の行き先 { go: 区画番号, o: {…} } か、結末 { end: 'e1' … } を返す

    /* 序章 */
    async function sec0(run) {
      setMode('novel'); UI.timer(null); bgm('s0_dusk');
      await play(run, P.s0.slice(0, HERD_AT));   // 「そろそろ皆を小屋に戻そうか」「ワン！」まで
      setMode('puzzle');   // 羊追い（押して運ぶ練習。時間の計測はまだ始まらない）
      await Puzzle.start(run, 's0', { win: async (run2, api) => { await UI.wait(run2, 700); sfx('win'); api.finish(); } }, S.diff);
      setMode('novel');
      await play(run, P.s0_herded);
      await play(run, P.s0.slice(HERD_AT));
      const enter = optFor('enter');
      enter.label = '廃坑へ入る'; enter.tags = [];   // ボタンには説明書きを出さない（展示モードの20分の計測は、タイトル画面で案内している）
      UI.showLine(P.s0_ask, false);
      await UI.choose(run, [enter]);
      apply('enter');
      if (S.mode === 'expo') timerStart(RULES.TIMER_SEC);   // 序章→区画1：20分の計測を始める
      return { go: 1 };
    }

    /* 区画1 廃坑入口・トロッコ（謎解き） */
    async function sec1(run) {
      setMode('novel');
      await play(run, P.s1_gate);
      await play(run, P.s1_crash_check);   // ここの選択肢はなし（フラメトが寄りそう文だけを出す）
      await play(run, P.s1_cart);
      setMode('puzzle');
      await puzzle(run, 's1', {
        // 足場ができた：登り方を選ぶ（「二人で協力して登る」は初回だけ。崩れたら、砂袋を積み直してもう一度選ぶ）
        ready: async (run2, api) => {
          await play(run2, P.s1_ready);
          const ids = ['cart_flam']; if (!S.flags.cartFailed) ids.push('cart_together'); ids.push('cart_luno');
          const id = await ask(run2, P.s1_ask2, ids);
          apply(id);
          const L = P.s1_res[id];
          if (id === 'cart_together') {
            await play(run2, L.slice(0, 2));
            sfx('crumble'); api.shakeScreen(700, 0.02);
            await play(run2, L.slice(2));
            const PZ = api.P;
            PZ.s = api.MODS.s1.collapse(PZ.L, PZ.s); PZ.base = api.core.cl(PZ.s); PZ.hist = []; PZ.moves = 0;   // 砂袋が散らばり、ルノは足場の下へ（トロッコは固定のまま）
            api.syncVis(true); api.updateChips(); api.sys(P.s1_restack);
            return;
          }
          await play(run2, L);
          sfx('win'); api.finish();
        }
      });
      setMode('novel');
      await play(run, P.s1_clear);
      return { go: 2 };
    }

    /* 区画2 三叉路・水路（謎解き） */
    async function sec2(run) {
      setMode('novel');
      await play(run, P.s2_intro);
      setMode('puzzle');
      await puzzle(run, 's2', {
        // 水たまりの入口：フラメトを泳がせる（カルマ＋10・不安＋10）か、二人で歩ける道を探す
        trigger: async (run2, api) => {
          const PZ = api.P, V = PZ.vis, p = PZ.M.prep(PZ.L), R = P.s2_res;
          PZ.flags.c03 = 'asking';
          const id = await ask(run2, P.s2_ask, ['swim', 'walk']);
          PZ.flags.c03 = id; apply(id);
          if (id === 'swim') {
            await play(run2, R.swim[0]); sfx('bark'); await UI.wait(run2, TUNE_SEC.BARK_TO_SPLASH_MS);
            const back = [V.luno.tx, V.luno.ty];
            V.flam.speed = 0.8; sfx('splash');
            const go = api.gridPath([V.flam.tx, V.flam.ty], p.sw);   // 水の中を、スイッチまで泳ぐ道（盤面から求める）
            await api.walkPath(run2, V.flam, go, { swim: true });
            PZ.flags.swKnown = true; api.fxRing(p.sw[0], p.sw[1], '#a8e4ff'); sfx('lit');
            await play(run2, R.swim[1]);
            await api.walkPath(run2, V.flam, go.slice(0, -1).reverse().concat([back]), { swim: true });
            V.flam.speed = 1;
            await play(run2, R.swim[2]); UI.sys(P.s2_revealed);
          } else { await play(run2, R.walk); api.idle(); }
        },
        win: async (run2, api) => { sfx('win'); await UI.wait(run2, 350); api.finish(); }
      });
      setMode('novel');
      await play(run, P.s2_clear);
      return { go: 3 };
    }

    // 謎解き：最中の曲に切り替え、終わったら区画の曲に戻す
    async function puzzle(run, sid, hooks) { const own = sid === 's7'; if (!own) bgm('puzzle'); await Puzzle.start(run, sid, hooks, S.diff); if (!own) bgm('sec' + S.sec); }   // 灯火の間は、区画7の曲のまま謎解きをする

    /* 戦闘のまとめ役（区画3・8）。結果 { type, luHP, flHP, A, … } を返し、HP・不安を引き継ぐ */
    async function fight(run, kind, extra) {
      setMode('battle'); bgm(kind === 'boss' ? 'boss' : 'battle');
      await battleHelp(); UI.guard(run);   // はじめての戦闘の前だけ、戦い方を見せる
      const r = await Battle.start(run, Object.assign({
        kind, diff: S.diff, luHP: S.lh, flHP: S.fh, A: S.A, K: S.K, stones: 3,
        onHud: (v) => UI.hud({ K: S.K, A: v.A, lh: v.lh, fh: v.fh, lmax: RULES.LUNO_HP, fmax: RULES.FLAM_HP }),
        onTitle: () => toTitle()
      }, extra));
      UI.guard(run);
      S.lh = r.luHP; S.fh = r.flHP; S.A = r.A; hud();
      setMode('novel'); bgm('sec' + S.sec);
      return r;
    }
    // 戦闘のあと、少し息を整えて回復する（仮）
    function afterBattle() {
      const h = RULES.AFTER_BATTLE_HEAL, a = Math.min(h.luno, RULES.LUNO_HP - S.lh), b = Math.min(h.flam, RULES.FLAM_HP - S.fh);
      S.lh += a; S.fh += b; hud();
      if (a) UI.toast('ルノ HP ' + signed(a), 'ok'); if (b) UI.toast('フラメト HP ' + signed(b), 'ok');
    }

    /* 区画3 岩喰いムカデ（戦闘） */
    async function sec3(run) {
      setMode('novel');
      await play(run, P.s3_intro);
      const a = await ask(run, P.s3_ask, ['cent_flam', 'cent_watch', 'cent_sneak']);
      apply(a);
      await play(run, P.s3_res[a]);
      await fight(run, 'centipede', { flamAdvance: a === 'cent_flam', enemySlow: a === 'cent_watch' ? 1 : 0 });   // 敵HPが10未満になると撤退
      await play(run, P.s3_retreat);
      const b = await ask(run, P.s3_ask2, ['cent_spare', 'cent_chase']);
      apply(b); S.flags.centResolve = b;
      await stage.change({ enemy: null });
      await play(run, P.s3_res2[b]);
      afterBattle();
      return { go: 4 };
    }

    /* 区画4 水晶洞（謎解き）。鏡の謎で通常の扉（mirrorA）と隠し部屋（mirrorB）を開く */
    async function sec4(run) {
      setMode('novel');
      await play(run, P.s4_intro);
      setMode('puzzle');
      const F = S.flags;
      await puzzle(run, 's4', {
        open: async (run2, api) => {           // 全部の水晶に光が通った＝東向きの主光路（mirrorA）
          if (F.mirrorA) { return; }
          F.mirrorA = true; S.log.push('mirror_e');
          await play(run2, P.s4_open); api.idle();
        },
        bonus: async (run2, api) => {          // 細い光路で緑の水晶も光った＝北向き（mirrorB）。隠し部屋が開く
          if (F.mirrorB) { return; }
          F.mirrorB = true; S.log.push('mirror_n');
          api.sys(P.s4_bonus); await UI.wait(run2, 1100);
        },
        win: async (run2, api) => {            // 通常の扉の前に着いた：隠し部屋を調べる（任意）／扉から先へ進む
          for (;;) {
            const items = [];
            if (F.mirrorB && !F.crystal) items.push('hidden_look');
            items.push('door_go');
            if (!F.mirrorB) items.push({ id: 'back_mirror', label: P.s4_back_mirror, tags: [['仮', 'prov']] });
            const line = { w: 'nar', t: P.s4_ask.t + (F.mirrorB ? '' : '\n' + P.s4_hint_secret), p: 1 };
            const id = await ask(run2, line, items);
            if (id === 'back_mirror') { api.idle(); return; }             // 謎解きに戻る（状態はそのまま）
            apply(id);
            if (id === 'door_go') { sfx('open'); await UI.wait(run2, 250); api.finish(); return; }
            // 隠し部屋：日誌と水晶のかけらを同時に取る（取らずに戻ってもよい）
            setMode('novel');
            await play(run2, P.s4_hidden);
            const j = await ask(run2, P.s4_take_ask, ['journal_take', { id: 'leave_it', label: P.s4_leave_it, tags: [['仮', 'prov']] }]);
            if (j === 'journal_take') { apply('journal_take'); sfx('item'); await play(run2, P.s4_take); }
            await play(run2, P.s4_back);
            setMode('puzzle'); api.updateChips(); api.idle();
          }
        }
      });
      return { go: 5 };
    }

    /* 区画5 鉱夫の休憩所（物語） */
    async function sec5(run) {
      setMode('novel');
      await play(run, P.s5_intro);
      await play(run, S.flags.crystalJournal ? P.s5_journal_have : P.s5_journal_find);
      await play(run, P.s5_read);
      const id = await ask(run, P.s5_ask, ['diary_read', 'diary_skip']);
      apply(id);
      await play(run, P.s5_res[id]);
      await play(run, P.s5_stairs);
      return { go: 6 };
    }

    /* 区画6 崩落した通路（物語）。フラメトがルノをかばって負傷 */
    async function sec6(run) {
      setMode('novel');
      await play(run, P.s6_intro);
      const pf = S.fh; S.fh = Math.max(1, S.fh - RULES.FLAM_INJURY); hud();
      if (S.fh !== pf) UI.toast('フラメト HP ' + signed(S.fh - pf), 'hp');
      const id = await ask(run, P.s6_ask, ['rest_heal', 'rest_push']);
      apply(id);
      await play(run, P.s6_res[id]);
      await play(run, S.K < RULES.K_HIGH ? P.s6_near : P.s6_far);   // カルマが高いと、フラメトは寄ってこない
      return { go: 7 };
    }

    /* 区画7 灯火の間（謎解き）。暗い回廊を、燭台に火を入れながら進む。『一つ灯れば、二つは消える』『灯すなら、道のまんなかに』
       まんなかのランプ（M）が灯っている間だけ扉が開き、扉に入ると解決 */
    async function sec7(run) {
      setMode('novel');
      await play(run, P.s7_intro);
      setMode('puzzle');
      await puzzle(run, 's7', { win: async (run2, api) => { await UI.wait(run2, 250); api.finish(); } });
      setMode('novel');
      apply('lamp_c'); stage.setLamps([0, 1, 0]);   // 物語の場面でも、まんなかのランプだけが灯っている
      await play(run, P.s7_res.lamp_c);
      await ask(run, P.s7_ask2, ['lamp_go']);
      apply('lamp_go');
      return { go: 8 };
    }

    /* 区画8 大空洞・トゲイモムシ（戦闘）。最大5ターン／水晶は3ターン目から */
    async function sec8(run) {
      setMode('novel');
      await play(run, P.s8_intro);
      const a = await ask(run, P.s8_ask, ['boss_ready', 'boss_escape']);
      apply(a);
      await play(run, P.s8_res[a]);
      const r = await fight(run, 'boss', { flamAdvance: a === 'boss_ready', crystal: S.flags.crystal });
      const F = S.flags;
      if (r.type === 'crystal') {                       // 水晶を使う：ボスが退く（水晶は持ったまま）
        apply('boss_crystal'); F.bossResolve = 'crystal';
        await stage.change({ enemy: null });
        await play(run, P.s8_crystal);
      } else if (r.type === 'defeat') {                 // 敵HP0：撃破
        F.bossResolve = 'defeat';
        await stage.change({ enemy: null });
        await play(run, P.s8_defeat);
        await play(run, S.K < RULES.K_HIGH ? P.s8_lick_near : P.s8_lick_far);
      } else if (r.type === 'turnlimit_low') {          // 5ターン目：敵HP1〜20＝撤退。逃がす（カルマ−5）／追撃する（カルマ＋15）
        await play(run, P.s8_retreat);
        const b = await ask(run, P.s8_ask2, ['boss_spare', 'boss_chase']);
        apply(b); F.bossResolve = b;
        await stage.change({ enemy: null });
        await play(run, P.s8_res2[b]);
      } else {                                          // 5ターン目：敵HP21〜40＝暴走。二人で回避（不安＋5）／フラメトを先行（カルマ＋10・不安＋10）
        await play(run, P.s8_rampage);
        const b = await ask(run, P.s8_ask3, ['boss_dodge', 'boss_send']);
        apply(b); F.bossResolve = b;
        await stage.change({ enemy: null });
        await play(run, P.s8_res3[b]);
      }
      afterBattle();
      return { go: 9 };
    }

    /* 区画9 命の祭壇（物語）。石を置く（結末①：カルマ<60 かつ短縮でない）／持ち帰る */
    async function sec9(run, o) {
      setMode('novel');
      const F = S.flags;
      if (o.fromTimer) { bgm('short'); await play(run, P.t_short); }
      if (!o.askOnly) await play(run, P.s9_intro);
      if (F.short) await play(run, P.s9_short);
      const offs = {};
      if (F.short) offs.altar_leave = P.s9_why_short; else if (S.K >= RULES.K_HIGH) offs.altar_leave = P.s9_why_k;
      const id = await ask(run, P.s9_ask, ['altar_leave', 'altar_take'], offs);
      apply(id);
      if (id === 'altar_leave') return { end: 'e1' };
      await play(run, P.s9_take);
      return { go: 10 };
    }

    /* 区画10 帰り道（物語）。呼びかけ・待機を計3回／攻撃／自己犠牲 */
    async function sec10(run, o) {
      setMode('novel');
      const F = S.flags, need = RULES.FINAL_NEED;
      if (!o.resume) await play(run, P.s10_intro);
      for (;;) {
        UI.guard(run);
        const k = S.K, fa = F.finalActions;
        const items = [], offs = {};
        if (fa < need) {
          items.push('call', 'wait');
          if (k >= RULES.K_HIGH) offs.call = P.s10_why_call;     // カルマ60以上では呼びかけ不可
        }
        items.push('go_home', 'attack', 'sacrifice');
        if (!(fa >= need && !F.attackedDog && k < RULES.K_HIGH)) {
          offs.go_home = F.attackedDog ? P.s10_why_hurt : (k >= RULES.K_HIGH ? P.s9_why_k : P.s10_why_home);
        }
        const id = await ask(run, P.s10_ask, items, offs);
        apply(id);
        if (id === 'call') {
          F.finalActions++; const i = Math.min(F.callN, P.s10_call.length - 1); F.callN++;
          await play(run, P.s10_call[i]);
        } else if (id === 'wait') {
          F.finalActions++; const i = Math.min(F.waitN, P.s10_wait.length - 1); F.waitN++;
          await play(run, P.s10_wait[i]);
        } else if (id === 'attack') {
          F.dogAttacks++; F.attackedDog = true;                  // 1回目：続行（結末②は不可）／2回目：結末④
          if (F.dogAttacks >= 2) return { end: 'e4' };
          await play(run, P.s10_attack1);
        } else if (id === 'sacrifice') {
          await play(run, P.s10_sacrifice);
          return { end: 'e3' };
        } else if (id === 'go_home') {
          return { end: 'e2' };
        }
        if (F.finalActions >= need && !F.attackedDog && S.K < RULES.K_HIGH && !F.memoryShown) {
          F.memoryShown = true; await play(run, P.s10_memory);   // 3回そろった：祖母の言葉を思い出す
        }
      }
    }

    // 区画を始めるときに、今の進行（S）と場面（stage）を受け取ってから流す
    const begin = (fn) => (run, o) => { S = G.S; stage = G.stage; return fn(run, o); };
    return [sec0, sec1, sec2, sec3, sec4, sec5, sec6, sec7, sec8, sec9, sec10].map(begin);
  };
})();
