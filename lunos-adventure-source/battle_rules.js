/* ==========================================================================
   battle_rules.js ― 戦闘のルール（区画3 岩喰いムカデ／区画8 トゲイモムシ）。画面に依存しないので、Node の自動テストでも動きます
   ① 数値の調整表 BT・敵の表 ENEMY・マップ MAPS・画面に出す文 TXT
   ② ルール Rules（ルノの行動・フラメトのAI・敵のAI）
   画面（盤面の描画・コマンド・アニメーション）は battle.js
   戦闘フロー表（v6.0）に数値のあるものは表のとおり。表にない数値は「仮」で、①の表だけ直せば変わります。
   ========================================================================== */
(function () {
  'use strict';

  /* ★ ① 戦闘の数値（「表」＝v6.0 戦闘フロー の数値／「仮」＝表にないので仮に決めた数値） */
  const BT = {
    // ---- ルノ ----
    LUNO_MOVE: 2,             // 仮：ルノの移動（1ターンに動けるマス数）。表：移動は1回
    STAFF_DMG: 10,            // 表：杖 10
    STONE_DMG: 7,             // 表：石弾 7
    STONE_COUNT: 3,           // 表：石弾 所持3個
    STONE_MIN: 2, STONE_MAX: 4,   // 表：石弾の射程 2〜4（杖は射程1）
    ANX_NO_STONE: 50,         // 表：不安50以上は石弾不可
    ANX_NO_STAFF: 70,         // 表：不安70以上は杖不可
    ANX_NO_CALM: 90,          // 表：不安90以上は落ち着けない
    FAIL_MID: [30, 0.10],     // 表：不安30〜49 は失敗10%   [しきい値, 確率]
    FAIL_HIGH: [50, 0.30],    // 表：不安50以上は失敗30%
    FAIL_ANX_UP: 5,           // 表：失敗時は不安+5
    CALM_DOWN: 20,            // 表：落ち着く −20
    GUARD_RATE: 0.5,          // 仮：防御したときの被ダメージの割合（表は「減る」とだけ）
    A_LUNO_HIT: 3,            // 仮：ルノが攻撃を受けたときの不安の上昇
    A_FLAM_HIT: 2,            // 仮：フラメトが攻撃を受けたときの不安の上昇
    // ---- フラメトのAI（表：HPとカルマ・敵との距離で、噛みつき／体当たり／威嚇／防御・退避） ----
    FL_MOVE: 3,               // 仮：フラメトの移動
    FL_BITE: 4,               // 仮：噛みつき
    FL_RAM: 6,                // 仮：体当たり（カルマが高いと、こちらを使う）
    FL_RAM_RECOIL: 2,         // 仮：体当たりの反動
    FL_RAM_K: 50,             // 仮：カルマがこれ以上だと体当たりを選ぶ
    FL_RETREAT: 0.3,          // 仮：HPがこの割合以下だと、防御・退避
    FL_GROWL_K: 50,           // 仮：カルマがこれ未満で、距離3以内なら威嚇する
    GROWL_TURNS: 2,           // 仮：威嚇の効く長さ（敵のターン数）
    GROWL_ATK: 0.6,           // 表：威嚇で敵の攻撃力低下（割合は仮）
    GROWL_MOVE: 1,            // 表：威嚇で敵の移動力低下（量は仮）
    // ---- 勝負の決まり方 ----
    BOSS_MAX_TURNS: 5         // 表：ボスは最大5ターン
  };
  const ENEMY = {
    centipede: { name: '岩喰いムカデ', hp: 20, move: 2, atk: 4, retreatBelow: 10 },                                   // 表：HP20、HP10未満で撤退（move・atkは仮）
    boss: { name: 'トゲイモムシ', hp: 40, move: 1, atk: 4, charge: 7, phase2At: 20, maxTurns: BT.BOSS_MAX_TURNS }          // 表：HP40・最大5ターン（move・atk・突進・第2段階の境目は仮）
  };
  // ★ 難易度ごとの敵の強さ（かんたん＝上の ENEMY のまま。ふつう・むずかしいは、ここに書いた値で上書きする）
  const ENEMY_DIFF = {
    easy: {},
    normal: {
      centipede: { hp: 28, move: 2, atk: 6, retreatBelow: 12 },
      boss: { hp: 52, move: 1, atk: 6, charge: 10, phase2At: 26 }
    },
    hard: {
      centipede: { hp: 36, move: 3, atk: 8, retreatBelow: 14 },
      boss: { hp: 64, move: 2, atk: 8, charge: 13, phase2At: 32 }
    }
  };
  const specOf = (kind, diff) => Object.assign({}, ENEMY[kind], (ENEMY_DIFF[diff] || {})[kind]);
  const MAPS = {   // 7×7、# は壁（石）。表：7×7、壁あり
    centipede: ['.......', '.#...#.', '.......', '...#...', '.......', '.#...#.', '.......'],
    boss: ['.......', '..#.#..', '.......', '.#...#.', '.......', '..#.#..', '.......']
  };
  const STARTS = { centipede: { luno: [1, 6], flam: [2, 6], flamAdv: [3, 4], en: [5, 2] }, boss: { luno: [1, 6], flam: [2, 6], flamAdv: [3, 4], en: [5, 1] } };
  // ルノ・フラメトのHPの上限（rules.js がないとき＝自動テストでは 25／35）
  const LUNO_MAX = () => (window.RULES ? window.RULES.LUNO_HP : 25), FLAM_MAX = () => (window.RULES ? window.RULES.FLAM_HP : 35);

  /* 画面に出す文（ここを書き換えると戦闘中の文が変わります） */
  const TXT = {
    start: { centipede: 'ムカデとの戦い！ ルノは「移動」と「行動」を1回ずつできる。', boss: 'トゲイモムシとの戦い！ 最大5ターン。ルノは「移動」と「行動」を1回ずつできる。' },
    yourTurn: (t, max) => 'ルノの番。' + (max ? '（ターン ' + t + '／' + max + '）' : '（ターン ' + t + '）') + ' 光っているマスをタップして移動、コマンドで行動。',
    staff: (n, d) => 'ルノの杖が' + n + 'に命中！ ' + d + 'のダメージ。',
    stone: (n, d, left) => 'ルノの石弾が' + n + 'に命中！ ' + d + 'のダメージ。（石弾 あと' + left + '）',
    miss: () => 'ルノの手が震えて、攻撃がはずれてしまった……。',
    guard: 'ルノは身を固めて、敵の攻撃に備えた。',
    calm: () => 'ルノは深く息をはいた。少し落ち着いた。',
    call: () => 'ルノはフラメトに呼びかけた。心が少し落ち着く。',
    fbite: (n, d) => 'フラメトが' + n + 'に噛みついた！ ' + d + 'のダメージ。',
    fram: (n, d, r) => 'フラメトが' + n + 'に体当たり！ ' + d + 'のダメージ。（反動 ' + r + '）',
    growl: (n) => 'フラメトが' + n + 'を威嚇した！ 動きが鈍り、攻撃も弱まる。',
    fguard: 'フラメトは傷をかばい、身をかがめて下がった。',
    fstay: 'フラメトはルノのそばで身構えている。',
    ebite: (n, t, d) => n + 'の攻撃！ ' + t + 'に' + d + 'のダメージ。',
    tele: (n) => n + 'の棘が赤く光った……！ 突進の予兆だ。赤いマスから離れよう。',
    charge: (n) => n + 'が棘を逆立てて突進した！',
    chargeHit: (t, d) => '　' + t + 'に' + d + 'のダメージ。',
    chargeMiss: '　突進は、だれにも当たらなかった。',
    names: { luno: 'ルノ', flam: 'フラメト' },
    crystal: '水晶のかけらが、まばゆく輝いた……！'
  };

  /* ====================================================================== ② ルール（画面に依存しない） */
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const inb = (x, y) => x >= 0 && y >= 0 && x < 7 && y < 7;
  const manh = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const isWall = (B, x, y) => B.map[y][x] === '#';

  function newBattle(cfg) {
    const kind = cfg.kind, E = specOf(kind, cfg.diff), S = STARTS[kind];   // cfg.diff：難易度（easy／normal／hard）
    const fl = cfg.flamAdvance ? S.flamAdv : S.flam;
    return {
      kind, spec: E, map: MAPS[kind], turn: 1, maxTurns: E.maxTurns || null, rng: cfg.rng || Math.random,
      luno: { x: S.luno[0], y: S.luno[1], hp: cfg.luHP }, flam: { x: fl[0], y: fl[1], hp: cfg.flHP, guard: false, called: false },
      en: { x: S.en[0], y: S.en[1], hp: E.hp, max: E.hp, slow: cfg.enemySlow || 0, weak: 0, tele: null },   // enemySlow：区画3で「様子を見る」を選ぶと、最初の1ターンだけ敵の移動が鈍る（仮）
      A: cfg.A, K: cfg.K, stones: cfg.stones == null ? BT.STONE_COUNT : cfg.stones, crystal: !!cfg.crystal,
      moveLeft: BT.LUNO_MOVE, steps: 0, moveClosed: false, acted: false, guard: false, phase2: false, over: null
    };
  }
  const unitAt = (B, x, y) => (B.luno.x === x && B.luno.y === y ? 'luno' : B.flam.x === x && B.flam.y === y ? 'flam' : B.en.hp > 0 && B.en.x === x && B.en.y === y ? 'en' : null);
  // 位置 (sx,sy) から maxd マス以内に動ける場所（壁と他の者のいる場所は通れない）。{ "x,y": {d, prev} }
  function bfs(B, sx, sy, maxd) {
    const out = {}; out[sx + ',' + sy] = { d: 0, prev: null }; const q = [[sx, sy]];
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i], d = out[x + ',' + y].d; if (d >= maxd) continue;
      for (const dd of DIRS) { const nx = x + dd[0], ny = y + dd[1]; if (!inb(nx, ny) || isWall(B, nx, ny) || out[nx + ',' + ny] || unitAt(B, nx, ny)) continue; out[nx + ',' + ny] = { d: d + 1, prev: [x, y] }; q.push([nx, ny]); }
    }
    return out;
  }
  function pathOf(tbl, x, y) { const p = []; let c = [x, y]; while (c) { p.unshift(c); c = tbl[c[0] + ',' + c[1]].prev; } p.shift(); return p; }
  // 見通し（間に壁がないか）
  function los(B, a, b) {
    const n = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); if (n <= 1) return true;
    for (let i = 1; i < n; i++) { const x = Math.round(a.x + (b.x - a.x) * i / n), y = Math.round(a.y + (b.y - a.y) * i / n); if (isWall(B, x, y)) return false; }
    return true;
  }
  const failRate = (A) => (A >= BT.FAIL_HIGH[0] ? BT.FAIL_HIGH[1] : A >= BT.FAIL_MID[0] ? BT.FAIL_MID[1] : 0);
  const enName = (B) => B.spec.name;

  /* ---- ルノの行動ができるか（できないときは理由の文字を返す。できるなら null） ---- */
  const why = {
    move(B) { return B.moveClosed ? '行動のあとは、もう動けない' : B.moveLeft <= 0 ? '今回の移動は使い切った' : null; },
    staff(B) { return B.acted ? '行動は1回だけ' : B.A >= BT.ANX_NO_STAFF ? '手が震えて、杖を振れない' : manh(B.luno, B.en) !== 1 ? '敵が遠い（射程1）' : null; },
    stone(B) { if (B.acted) return '行動は1回だけ'; if (B.stones <= 0) return '石弾がない'; if (B.A >= BT.ANX_NO_STONE) return '手が震えて、狙えない'; const d = manh(B.luno, B.en); if (d < BT.STONE_MIN || d > BT.STONE_MAX) return '射程外（' + BT.STONE_MIN + '〜' + BT.STONE_MAX + '）'; if (!los(B, B.luno, B.en)) return '壁にさえぎられている'; return null; },
    guard(B) { return B.acted ? '行動は1回だけ' : null; },
    calm(B) { return B.acted ? '行動は1回だけ' : B.A >= BT.ANX_NO_CALM ? '気持ちが張りつめて、落ち着けない' : null; },
    call(B) { return B.acted ? '行動は1回だけ' : (window.RULES && window.RULES.callDelta(B.K) == null) ? '今は、声が届かない' : null; },
    crystal(B) { return !B.crystal ? '水晶を持っていない' : B.turn < 3 ? '3ターン目から使える' : null; }
  };
  const callDelta = (K) => (window.RULES ? window.RULES.callDelta(K) : (K < 30 ? -15 : K < 50 ? -10 : K < 60 ? -5 : null));
  function markActed(B) { B.acted = true; if (B.steps > 0) B.moveClosed = true; }

  // 敵・味方がダメージを受ける共通処理（不安の上昇・イベントの記録・勝敗の判定）
  function hurt(B, ev, who, dmg, kind, from) {
    if (who === 'en') {
      B.en.hp = Math.max(0, B.en.hp - dmg);
      ev.push({ t: 'hit', who: from, tgt: 'en', dmg, kind, hp: B.en.hp });
    } else {
      const u = B[who]; u.hp = Math.max(0, u.hp - dmg);
      ev.push({ t: 'hit', who: from, tgt: who, dmg, kind, hp: u.hp });
      const up = who === 'luno' ? BT.A_LUNO_HIT : BT.A_FLAM_HIT; B.A = clamp(B.A + up, 0, 100); ev.push({ t: 'anx', A: B.A });
    }
  }
  function checkEnd(B, ev) {
    if (B.over) return true;
    if (B.luno.hp <= 0) B.over = { type: 'lose', who: 'luno' };
    else if (B.flam.hp <= 0) B.over = { type: 'lose', who: 'flam' };
    else if (B.kind === 'centipede' && B.en.hp < B.spec.retreatBelow) B.over = { type: 'retreat' };
    else if (B.kind === 'boss' && B.en.hp <= 0) B.over = { type: 'defeat' };
    if (B.over) ev.push({ t: 'end', over: B.over });
    return !!B.over;
  }

  /* ---- ルノの行動 ---- */
  function doMove(B, x, y) {
    const w = why.move(B); if (w) return { ok: false, why: w };
    const tbl = bfs(B, B.luno.x, B.luno.y, B.moveLeft), c = tbl[x + ',' + y];
    if (!c || c.d === 0) return { ok: false, why: 'そこへは動けない' };
    const path = pathOf(tbl, x, y); B.luno.x = x; B.luno.y = y; B.moveLeft -= c.d; B.steps += c.d;
    return { ok: true, ev: [{ t: 'move', who: 'luno', path }] };
  }
  function doAttack(B, kind) {
    const w = why[kind](B); if (w) return { ok: false, why: w };
    const ev = []; markActed(B);
    if (B.rng() < failRate(B.A)) {
      B.A = clamp(B.A + BT.FAIL_ANX_UP, 0, 100);
      ev.push({ t: 'miss', who: 'luno', kind }, { t: 'anx', A: B.A }, { t: 'msg', text: TXT.miss(BT.FAIL_ANX_UP) });
    } else {
      const dmg = kind === 'staff' ? BT.STAFF_DMG : BT.STONE_DMG;
      if (kind === 'stone') { B.stones--; ev.push({ t: 'proj', from: [B.luno.x, B.luno.y], to: [B.en.x, B.en.y] }); }
      hurt(B, ev, 'en', dmg, kind, 'luno');
      ev.push({ t: 'msg', text: kind === 'staff' ? TXT.staff(enName(B), dmg) : TXT.stone(enName(B), dmg, B.stones) });
      checkEnd(B, ev); if (B.kind === 'boss' && !B.phase2 && B.en.hp > 0 && B.en.hp <= B.spec.phase2At) { B.phase2 = true; ev.push({ t: 'phase2' }); }
    }
    return { ok: true, ev };
  }
  const doStaff = (B) => doAttack(B, 'staff'), doStone = (B) => doAttack(B, 'stone');
  function doGuard(B) { const w = why.guard(B); if (w) return { ok: false, why: w }; markActed(B); B.guard = true; return { ok: true, ev: [{ t: 'guard', who: 'luno' }, { t: 'msg', text: TXT.guard }] }; }
  function doCalm(B) { const w = why.calm(B); if (w) return { ok: false, why: w }; markActed(B); const d = Math.min(B.A, BT.CALM_DOWN); B.A -= d; return { ok: true, ev: [{ t: 'calm' }, { t: 'anx', A: B.A }, { t: 'msg', text: TXT.calm(d) }] }; }
  function doCall(B) {
    const w = why.call(B); if (w) return { ok: false, why: w };
    markActed(B); const dl = callDelta(B.K), d = Math.min(B.A, -dl); B.A -= d; B.flam.called = true;
    return { ok: true, ev: [{ t: 'call' }, { t: 'anx', A: B.A }, { t: 'msg', text: TXT.call(d) }] };
  }
  function doCrystal(B) {
    const w = why.crystal(B); if (w) return { ok: false, why: w };
    markActed(B); B.over = { type: 'crystal' }; return { ok: true, ev: [{ t: 'msg', text: TXT.crystal }, { t: 'end', over: B.over }] };
  }

  /* ---- フラメトのAI ---- */
  const inTele = (B, x, y) => !!(B.en.tele && B.en.tele.cells.some((c) => c[0] === x && c[1] === y));
  // 動ける場所のうち、score の高いところ（同点なら歩数が少ない所）へ
  function bestCell(B, who, maxd, score) {
    const u = B[who], tbl = bfs(B, u.x, u.y, maxd); let best = null, bs = -1e9;
    Object.keys(tbl).forEach((k) => { const [x, y] = k.split(',').map(Number), s = score(x, y, tbl[k].d) - tbl[k].d * 0.01; if (s > bs) { bs = s; best = [x, y, tbl[k].d]; } });
    return best ? { x: best[0], y: best[1], tbl } : null;
  }
  function moveTo(B, who, c, ev) { const u = B[who]; if (c.x === u.x && c.y === u.y) return; const path = pathOf(c.tbl, c.x, c.y); u.x = c.x; u.y = c.y; ev.push({ t: 'move', who, path }); }
  function flamPhase(B, ev) {
    const f = B.flam, e = B.en, M = BT.FL_MOVE; f.guard = false;
    const ram = B.K >= BT.FL_RAM_K, low = f.hp / FLAM_MAX() <= BT.FL_RETREAT, called = f.called; f.called = false;
    const d = () => manh(f, e);
    const strike = () => {
      if (d() !== 1) return false;
      if (ram && !called) { const dm = BT.FL_RAM; hurt(B, ev, 'en', dm, 'ram', 'flam'); ev.push({ t: 'msg', text: TXT.fram(enName(B), dm, BT.FL_RAM_RECOIL) }); f.hp = Math.max(1, f.hp - BT.FL_RAM_RECOIL); ev.push({ t: 'recoil', who: 'flam', dmg: BT.FL_RAM_RECOIL, hp: f.hp }); }
      else { const dm = BT.FL_BITE; hurt(B, ev, 'en', dm, 'bite', 'flam'); ev.push({ t: 'msg', text: TXT.fbite(enName(B), dm) }); }
      checkEnd(B, ev); if (B.kind === 'boss' && !B.phase2 && B.en.hp > 0 && B.en.hp <= B.spec.phase2At) { B.phase2 = true; ev.push({ t: 'phase2' }); }
      return true;
    };
    const growl = () => { e.slow = BT.GROWL_TURNS; e.weak = BT.GROWL_TURNS; ev.push({ t: 'growl', who: 'flam' }, { t: 'msg', text: TXT.growl(enName(B)) }); };
    if (low) {                         // 防御・退避：敵から離れ、ルノのそばへ。受けるダメージが減る
      const c = bestCell(B, 'flam', M, (x, y) => Math.abs(x - e.x) + Math.abs(y - e.y) - (inTele(B, x, y) ? 6 : 0) - 0.5 * (Math.abs(x - B.luno.x) + Math.abs(y - B.luno.y)));
      if (c) moveTo(B, 'flam', c, ev); f.guard = true; ev.push({ t: 'guard', who: 'flam' }, { t: 'msg', text: TXT.fguard }); return;
    }
    if (inTele(B, f.x, f.y)) {         // 突進の予兆の線から出る
      const c = bestCell(B, 'flam', M, (x, y) => (inTele(B, x, y) ? -9 : 0) - Math.abs(x - e.x) - Math.abs(y - e.y)); if (c) moveTo(B, 'flam', c, ev);
    }
    if (called) {                      // 呼びかけられた：ルノのそばで身構える（威嚇はする）
      const c = bestCell(B, 'flam', M, (x, y) => -(Math.abs(x - B.luno.x) + Math.abs(y - B.luno.y)) * 2 - (inTele(B, x, y) ? 9 : 0) + (manh({ x, y }, e) <= 3 ? 0.5 : 0));
      if (c) moveTo(B, 'flam', c, ev);
      if (d() <= 3 && e.slow <= 0) growl(); else if (!strike()) ev.push({ t: 'msg', text: TXT.fstay });
      return;
    }
    if (d() === 1) { strike(); return; }
    // 敵のとなりまで行けるなら行って攻撃。行けなければ威嚇か接近
    const c = bestCell(B, 'flam', M, (x, y) => (manh({ x, y }, e) === 1 ? 10 : 0) - manh({ x, y }, e) - (inTele(B, x, y) ? 8 : 0));
    if (c && manh(c, e) === 1) { moveTo(B, 'flam', c, ev); strike(); return; }
    if (B.K < BT.FL_GROWL_K && manh(f, e) <= 3 && e.slow <= 0) { growl(); return; }
    if (c) moveTo(B, 'flam', c, ev);
    if (manh(f, e) === 1) strike();
  }

  /* ---- 敵のAI ---- */
  function enemyHit(B, ev, who, dmg, label) {
    const u = B[who], guarded = who === 'luno' ? B.guard : u.guard;
    const dm = Math.max(1, Math.round(dmg * (guarded ? BT.GUARD_RATE : 1)));
    hurt(B, ev, who, dm, label, 'en'); return dm;
  }
  function enemyPhase(B, ev) {
    const e = B.en, spec = B.spec; if (e.hp <= 0) return;
    const mv = Math.max(0, spec.move - (e.slow > 0 ? BT.GROWL_MOVE : 0)), mult = e.weak > 0 ? BT.GROWL_ATK : 1;
    const dl = manh(e, B.luno), df = manh(e, B.flam), tgt = dl <= df ? 'luno' : 'flam';
    if (B.kind === 'boss' && B.en.hp <= spec.phase2At) {
      if (e.tele) {   // 予兆のあとの突進
        const cells = e.tele.cells; e.tele = null; ev.push({ t: 'charge', cells }, { t: 'msg', text: TXT.charge(spec.name) });
        let hit = false; ['luno', 'flam'].forEach((w) => { const u = B[w]; if (cells.some((c) => c[0] === u.x && c[1] === u.y)) { const dm = enemyHit(B, ev, w, spec.charge * mult, 'charge'); ev.push({ t: 'msg', text: TXT.chargeHit(TXT.names[w], dm) }); hit = true; } });
        if (!hit) ev.push({ t: 'msg', text: TXT.chargeMiss });
        let dest = null; cells.forEach((c) => { if (!unitAt(B, c[0], c[1])) dest = c; });
        if (dest && (dest[0] !== e.x || dest[1] !== e.y)) { e.x = dest[0]; e.y = dest[1]; ev.push({ t: 'move', who: 'en', path: [dest] }); }
      } else {        // 突進の予兆（棘が赤く光る）
        const t = B[tgt], dx = t.x - e.x, dy = t.y - e.y, order = Math.abs(dx) >= Math.abs(dy) ? [[Math.sign(dx), 0], [0, Math.sign(dy)]] : [[0, Math.sign(dy)], [Math.sign(dx), 0]];
        let cells = [];
        for (const dv of order) { if (!dv[0] && !dv[1]) continue; cells = []; let x = e.x, y = e.y; for (let i = 0; i < 3; i++) { x += dv[0]; y += dv[1]; if (!inb(x, y) || isWall(B, x, y)) break; cells.push([x, y]); } if (cells.length) break; }
        if (cells.length) { e.tele = { cells }; ev.push({ t: 'tele', cells }, { t: 'msg', text: TXT.tele(spec.name) }); }
        else if (manh(e, t) === 1) { const dm = enemyHit(B, ev, tgt, spec.atk * mult, 'bite'); ev.push({ t: 'msg', text: TXT.ebite(spec.name, TXT.names[tgt], dm) }); }
      }
    } else {
      const t = B[tgt];
      const c = bestCell(B, 'en', mv, (x, y) => -manh({ x, y }, t) * 2 + (manh({ x, y }, t) === 1 ? 5 : 0));
      if (c && mv > 0) moveTo(B, 'en', c, ev);
      const adj = ['luno', 'flam'].filter((w) => manh(e, B[w]) === 1), vic = adj.includes(tgt) ? tgt : adj[0];
      if (vic) { const dm = enemyHit(B, ev, vic, spec.atk * mult, 'bite'); ev.push({ t: 'msg', text: TXT.ebite(spec.name, TXT.names[vic], dm) }); }
    }
    e.slow = Math.max(0, e.slow - 1); e.weak = Math.max(0, e.weak - 1);
  }

  /* ---- ターン終了：フラメト → 敵。ターンの区切りの判定 ---- */
  function endTurn(B) {
    const ev = [];
    if (B.over) return { ok: true, ev };
    flamPhase(B, ev); if (checkEnd(B, ev)) return { ok: true, ev };
    enemyPhase(B, ev); if (checkEnd(B, ev)) return { ok: true, ev };
    if (B.maxTurns && B.turn >= B.maxTurns) {   // 最大ターンに達した：ボスの状況で結末が分かれる
      B.over = { type: B.en.hp > B.spec.phase2At ? 'turnlimit_high' : 'turnlimit_low' }; ev.push({ t: 'end', over: B.over }); return { ok: true, ev };
    }
    B.turn++; B.moveLeft = BT.LUNO_MOVE; B.steps = 0; B.moveClosed = false; B.acted = false; B.guard = false; B.flam.guard = false;
    ev.push({ t: 'turn', turn: B.turn });
    return { ok: true, ev };
  }
  const Rules = { newBattle, bfs, pathOf, los, why, doMove, doStaff, doStone, doGuard, doCalm, doCall, doCrystal, endTurn, manh, unitAt, failRate, callDelta, checkEnd, inTele, inb, LUNO_MAX, FLAM_MAX };

  window.BattleRules = { BT, ENEMY, ENEMY_DIFF, MAPS, STARTS, TXT, Rules };
})();
