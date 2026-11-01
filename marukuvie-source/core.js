/* ==========================================================================
   core.js ― 謎解きのルール（区画1 トロッコと砂袋／区画2 水路と水門／区画4 鏡と水晶／区画7 灯火の間）
   画面や音には触れず、「状態 → 操作 → 新しい状態」だけを決めるファイルです。
   ブラウザでも Node（自動テスト）でも同じコードが動きます。盤面のマップは levels.js、絵は render.js です。
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.makeCore = factory;
})(typeof self !== 'undefined' ? self : this, function makeCore(LEVELS) {
  'use strict';

  /* ---------------- 共通 ---------------- */
  const W = 11, H = 9;                                   // 盤面の大きさ（マス）。外周は壁
  const DIRS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
  const DIRN = ['U', 'R', 'D', 'L'];                     // 時計回り
  const cell = (rows, x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? '#' : rows[y][x];
  const cl = (o) => JSON.parse(JSON.stringify(o));
  const out = (s, ev, moved, changed) => ({ s, ev: ev || [], moved: !!moved, changed: !!changed });
  const blocked = (s, ev) => out(s, ev, false, false);

  function findAll(rows, ch) {
    const r = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rows[y][x] === ch) r.push([x, y]);
    return r;
  }
  const findOne = (rows, ch) => findAll(rows, ch)[0] || null;

  /* ======================================================================
     区画1 ― トロッコと砂袋（押して運ぶパズル）
     車輪止めを外し、トロッコをレールの終点まで押して固定し、
     砂袋を「足場」の印まで押して積む。足場が全部そろうと岩に登れる。
       # 壁   X 大岩   o 小岩   . 床   = レール   T トロッコ   G 終点の止め具
       C 車輪止め   B 砂袋   b レールの上にある砂袋   s 足場の印   P ルノの開始位置
     ====================================================================== */
  const cl1 = (s) => ({ px: s.px, py: s.py, bags: s.bags.map((b) => b.slice()), filled: s.filled.slice(), tx: s.tx, locked: s.locked, chock: s.chock, phase: s.phase });
  const S1 = {
    prep(L) {
      if (L.p) return L.p;
      const rows = L.rows;
      const p = {
        start: findOne(rows, 'P'), trolley: findOne(rows, 'T'), goal: findOne(rows, 'G'),
        chock: findOne(rows, 'C'), bags: findAll(rows, 'B').concat(findAll(rows, 'b')), slots: findAll(rows, 's')
      };
      p.rail = p.trolley[1];
      L.p = p; return p;
    },
    isWall(c) { return c === '#' || c === 'X' || c === 'o'; },
    init(L) {
      const p = S1.prep(L);
      return { px: p.start[0], py: p.start[1], bags: p.bags.map((b) => b.slice()), filled: p.slots.map(() => false),
        tx: p.trolley[0], locked: false, chock: true, phase: 'A' };
    },
    bagAt(s, x, y) { for (let i = 0; i < s.bags.length; i++) if (s.bags[i][0] === x && s.bags[i][1] === y) return i; return -1; },
    slotAt(p, x, y) { for (let i = 0; i < p.slots.length; i++) if (p.slots[i][0] === x && p.slots[i][1] === y) return i; return -1; },
    won(L, s) { return s.locked && s.filled.every(Boolean); },
    step(L, s, a) {
      const p = S1.prep(L), rows = L.rows, [dx, dy] = DIRS[a];
      const nx = s.px + dx, ny = s.py + dy, c = cell(rows, nx, ny);
      if (S1.isWall(c)) return blocked(s, [{ t: 'bump', k: c === 'X' ? 'rock' : 'wall' }]);
      const n = cl1(s);
      // 車輪止め
      if (s.chock && nx === p.chock[0] && ny === p.chock[1]) {
        n.chock = false;
        return out(n, [{ t: 'chock' }], false, true);
      }
      // トロッコ（レールの上だけを横に動く）
      if (nx === s.tx && ny === p.rail) {
        if (s.locked) return blocked(s, [{ t: 'bump', k: 'trolley_locked' }]);
        if (s.chock) return blocked(s, [{ t: 'bump', k: 'trolley_chocked' }]);
        if (dy !== 0) return blocked(s, [{ t: 'bump', k: 'trolley_rail' }]);
        const tx2 = s.tx + dx, c2 = cell(rows, tx2, p.rail);
        if (!(c2 === '=' || c2 === 'G' || c2 === 'T' || c2 === 'C' || c2 === 'b')) return blocked(s, [{ t: 'bump', k: 'trolley_end' }]);
        if (S1.bagAt(s, tx2, p.rail) >= 0) return blocked(s, [{ t: 'bump', k: 'trolley_bag' }]);
        n.tx = tx2; n.px = nx; n.py = ny;
        const ev = [{ t: 'push', k: 'trolley', from: s.tx, to: tx2 }];
        if (tx2 === p.goal[0]) { n.locked = true; ev.push({ t: 'locked' }); }
        if (S1.won(L, n)) ev.push({ t: 'ready' });
        return out(n, ev, true, true);
      }
      // 砂袋
      const bi = S1.bagAt(s, nx, ny);
      if (bi >= 0) {
        const bx = nx + dx, by = ny + dy, c2 = cell(rows, bx, by);
        if (S1.isWall(c2) || c2 === 'G') return blocked(s, [{ t: 'bump', k: 'bag_blocked' }]);
        if (S1.bagAt(s, bx, by) >= 0) return blocked(s, [{ t: 'bump', k: 'bag_blocked' }]);
        if (bx === s.tx && by === p.rail) return blocked(s, [{ t: 'bump', k: 'bag_blocked' }]);
        if (s.chock && bx === p.chock[0] && by === p.chock[1]) return blocked(s, [{ t: 'bump', k: 'bag_blocked' }]);
        const si = S1.slotAt(p, bx, by);
        const ev = [];
        if (si >= 0) {
          if (s.filled[si]) return blocked(s, [{ t: 'bump', k: 'slot_full' }]);
          n.filled[si] = true; n.bags.splice(bi, 1);
          ev.push({ t: 'slot', i: si, from: [nx, ny], to: [bx, by] });
        } else { n.bags[bi] = [bx, by]; ev.push({ t: 'push', k: 'bag', from: [nx, ny], to: [bx, by] }); }
        n.px = nx; n.py = ny;
        if (S1.won(L, n)) ev.push({ t: 'ready' });
        return out(n, ev, true, true);
      }
      n.px = nx; n.py = ny;
      return out(n, [], true, true);
    },
    // 足場が崩れる：砂袋が散らばり、積み直しになる（区画1の「二人で登る」）
    collapse(L, s) {
      const n = cl1(s);
      n.filled = n.filled.map(() => false);
      n.bags = L.bagsB.map((b) => b.slice());
      n.px = L.startB[0]; n.py = L.startB[1]; n.phase = 'B';
      return n;
    },
    key(L, s) {
      const bs = s.bags.map((b) => b[1] * W + b[0]).sort((a, b) => a - b);
      let k = s.py * W + s.px;
      for (const b of bs) k = k * 100 + b;
      k = k * 4 + (s.filled[0] ? 1 : 0) + (s.filled[1] ? 2 : 0);
      if (s.filled.length > 2) k = k * 2 + (s.filled[2] ? 1 : 0);
      return ((k * 16 + s.tx) * 2 + (s.locked ? 1 : 0)) * 2 + (s.chock ? 1 : 0);
    },
    solved: (L, s) => S1.won(L, s)
  };

  /* ======================================================================
     区画2 ― 三叉路と水門（三つの水路の水位を、堰のレバーで切り替える）
     水路は ①②③ の三本。レバーを踏むたびに、そのレバーが受け持つ水路の水位が 高⇔低 と入れ替わる。
       # 壁  . 床  P 開始  Q 水たまりの入口（選択肢が出る）  G 水門  K 水門のスイッチ
       1 2 3 … 水路の「道」。その水路の水位が【低い】ときだけ歩ける（高いと水の底）
       a b c … 水路の「浮き橋」。その水路の水位が【高い】ときだけ歩ける（低いと浮かない）
       x y z … 堰のレバー（level.levers で、どの水路を切り替えるかを決める）
     ====================================================================== */
  const CH = { '1': [0, 0], '2': [1, 0], '3': [2, 0], a: [0, 1], b: [1, 1], c: [2, 1] };   // [水路の番号, 歩ける水位]
  const S2 = {
    prep(L) { if (!L.p) L.p = { start: findOne(L.rows, 'P'), gate: findOne(L.rows, 'G'), sw: findOne(L.rows, 'K'), q: findOne(L.rows, 'Q') }; return L.p; },
    init(L) { const p = S2.prep(L); return { px: p.start[0], py: p.start[1], w: (L.w0 || [1, 1, 1]).slice(), open: false, trig: false }; },
    passable(c, w, open) {
      if (c === '#') return false;
      if (c === 'G') return open;
      const r = CH[c]; if (r) return w[r[0]] === r[1];
      return true;
    },
    won(L, s) { const g = S2.prep(L).gate; return s.px === g[0] && s.py === g[1]; },
    step(L, s, a) {
      S2.prep(L);
      const [dx, dy] = DIRS[a], nx = s.px + dx, ny = s.py + dy, c = cell(L.rows, nx, ny);
      if (c === '#') return blocked(s, [{ t: 'bump', k: 'wall' }]);
      if (c === 'G' && !s.open) return blocked(s, [{ t: 'bump', k: 'gate_closed' }]);
      if (!S2.passable(c, s.w, s.open)) {
        const r = CH[c];
        return blocked(s, [{ t: 'bump', k: r[1] === 0 ? 'submerged' : 'nofoot', ch: r[0] + 1 }]);
      }
      const n = cl(s), ev = [];
      n.px = nx; n.py = ny;
      if (L.levers && L.levers[c]) {
        L.levers[c].forEach((k) => { n.w[k - 1] = 1 - n.w[k - 1]; });
        ev.push({ t: 'lever', id: c, chs: L.levers[c].slice(), w: n.w.slice() });
      } else if (c === 'K' && !s.open) { n.open = true; ev.push({ t: 'switch' }); }
      else if (c === 'Q' && !s.trig) { n.trig = true; ev.push({ t: 'trigger' }); }
      if (c === 'G') ev.push({ t: 'win' });
      return out(n, ev, true, true);
    },
    key: (L, s) => ((s.py * W + s.px) * 8 + s.w[0] * 4 + s.w[1] * 2 + s.w[2]) * 2 + (s.open ? 1 : 0),
    solved: (L, s) => S2.won(L, s)
  };

  /* ======================================================================
     区画4 ― 水晶洞の集光器（鏡で光を曲げる）
       # 壁  . 床  P 開始  S 光源（向きは level.src）  m 鏡（体当たりで / と \ が切り替わる）
       T 受光水晶（光が当たると輝く・光は通り抜ける）  b おまけの水晶（任意）
       X 光を二手に割る石（まっすぐ＋右へ曲がる）  p 石柱（光を遮る）  E 封印された扉
     ====================================================================== */
  const MDIR = { '/': { R: 'U', U: 'R', L: 'D', D: 'L' }, '\\': { R: 'D', D: 'R', L: 'U', U: 'L' } };
  const S4 = {
    prep(L) {
      if (!L.p) {
        const r = L.rows, p = { start: findOne(r, 'P'), src: findOne(r, 'S'), exit: findOne(r, 'E'), mir: findAll(r, 'm'), cry: findAll(r, 'T'), bon: findAll(r, 'b') };
        p.mirIdx = {}; p.mir.forEach((m, i) => { p.mirIdx[m[1] * W + m[0]] = i; });
        L.p = p;
      }
      return L.p;
    },
    init(L) { const p = S4.prep(L); return { px: p.start[0], py: p.start[1], ms: L.ms0, open: false, bonus: false }; },
    trace(L, ms) {
      const p = S4.prep(L), lit = new Set(), segs = [], seen = new Set(), q = [{ x: p.src[0], y: p.src[1], d: L.src }];
      while (q.length) {
        let { x, y, d } = q.pop();
        const pts = [[x + 0.5, y + 0.5]];
        for (let guard = 0; guard < 80; guard++) {
          x += DIRS[d][0]; y += DIRS[d][1];
          const c = cell(L.rows, x, y);
          if (c === '#' || c === 'p' || c === 'S' || c === 'E') { pts.push([x + 0.5 - DIRS[d][0] * 0.5, y + 0.5 - DIRS[d][1] * 0.5]); break; }
          const sk = x + ',' + y + ',' + d;
          if (seen.has(sk)) { pts.push([x + 0.5, y + 0.5]); break; }
          seen.add(sk);
          if (c === 'm') { const i = p.mirIdx[y * W + x]; d = MDIR[ms[i]][d]; pts.push([x + 0.5, y + 0.5]); }
          else if (c === 'T' || c === 'b') lit.add(x + ',' + y);
          else if (c === 'X') { pts.push([x + 0.5, y + 0.5]); q.push({ x, y, d: DIRN[(DIRN.indexOf(d) + 1) % 4] }); }
        }
        segs.push(pts);
      }
      return { lit, segs };
    },
    litCount(L, ms) { const p = S4.prep(L), t = S4.trace(L, ms).lit; return { n: p.cry.filter((c) => t.has(c[0] + ',' + c[1])).length, bonus: p.bon.length > 0 && p.bon.every((c) => t.has(c[0] + ',' + c[1])) }; },
    won(L, s) { const e = S4.prep(L).exit; return s.open && s.px === e[0] && s.py === e[1]; },
    step(L, s, a) {
      const p = S4.prep(L), [dx, dy] = DIRS[a], nx = s.px + dx, ny = s.py + dy, c = cell(L.rows, nx, ny);
      const ev = [];
      if (c === 'm') {
        const i = p.mirIdx[ny * W + nx], n = cl(s), arr = n.ms.split('');
        arr[i] = arr[i] === '/' ? '\\' : '/'; n.ms = arr.join('');
        ev.push({ t: 'rot' });
        const lc = S4.litCount(L, n.ms);
        ev.push({ t: 'lit', n: lc.n, of: p.cry.length });
        if (!n.open && lc.n >= p.cry.length) { n.open = true; ev.push({ t: 'open' }); }
        if (lc.bonus && lc.n >= p.cry.length && !n.bonus) { n.bonus = true; ev.push({ t: 'bonus' }); }   // おまけは「全部の水晶が光った状態」で同時に光らせたとき
        return out(n, ev, false, true);
      }
      if (c === '#') return blocked(s, [{ t: 'bump', k: 'wall' }]);
      if (c === 'p') return blocked(s, [{ t: 'bump', k: 'pillar' }]);
      if (c === 'T' || c === 'b') return blocked(s, [{ t: 'bump', k: 'crystal' }]);
      if (c === 'X') return blocked(s, [{ t: 'bump', k: 'splitter' }]);
      if (c === 'S') return blocked(s, [{ t: 'bump', k: 'source' }]);
      if (c === 'E' && !s.open) return blocked(s, [{ t: 'bump', k: 'door_closed' }]);
      const n = cl(s); n.px = nx; n.py = ny;
      if (c === 'E') ev.push({ t: 'win' });
      return out(n, ev, true, true);
    },
    key: (L, s) => s.px + ',' + s.py + ',' + s.ms + (s.open ? 'o' : '') + (s.bonus ? 'b' : ''),
    solved: (L, s) => S4.won(L, s)
  };

  /* ======================================================================
     区画7 ― 灯火の間（一つ灯れば、二つは消える）
     回廊は暗く、明かりの届いているマスにしか進めない。燭台に体当たりすると火が入り、
     その燭台と「対になった二つ」の火が消える（対は level.links）。
     奥の三つのランプ（L・M・R）も同じで、まんなかの M が灯っている間だけ、扉が開く。
       # 壁  . 床（暗い）  S 入口の明かりが届く床  P 開始  E 扉  a〜e 燭台  L M R 奥のランプ
     ====================================================================== */
  const S7 = {
    prep(L) {
      if (!L.p) {
        const r = L.rows, ids = [], pos = {}, base = {};
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = r[y][x]; if ('abcdefghLMR'.indexOf(c) >= 0) { ids.push(c); pos[c] = [x, y]; } if (c === 'S' || c === 'P') base[x + ',' + y] = 1; }
        ids.sort();
        const area = {}; ids.forEach((id) => { const q = pos[id], a = {}; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.abs(x - q[0]) + Math.abs(y - q[1]) <= L.reach) a[x + ',' + y] = 1; area[id] = a; });
        L.p = { start: findOne(r, 'P'), door: findOne(r, 'E'), ids, pos, base, area };
      }
      return L.p;
    },
    init(L) { const p = S7.prep(L), on = {}; p.ids.forEach((id) => { on[id] = false; }); return { px: p.start[0], py: p.start[1], on }; },
    isOpen: (s) => !!s.on.M,
    // 明かりの届いているマス（"x,y" → 1）
    litMap(L, s) { const p = S7.prep(L), m = Object.assign({}, p.base); p.ids.forEach((id) => { if (s.on[id]) Object.assign(m, p.area[id]); }); return m; },
    won(L, s) { const d = S7.prep(L).door; return s.px === d[0] && s.py === d[1]; },
    step(L, s, a) {
      const p = S7.prep(L), [dx, dy] = DIRS[a], nx = s.px + dx, ny = s.py + dy, c = cell(L.rows, nx, ny);
      if (c === '#') return blocked(s, [{ t: 'bump', k: 'wall' }]);
      if (p.pos[c]) {
        if (s.on[c]) return blocked(s, [{ t: 'bump', k: 'already', id: c }]);
        const n = cl(s), off = []; n.on[c] = true;
        (L.links[c] || []).forEach((o) => { if (n.on[o]) { n.on[o] = false; off.push(o); } });
        const ev = [{ t: 'light', id: c, off }];
        if (!s.on.M && n.on.M) ev.push({ t: 'open' });
        if (s.on.M && !n.on.M) ev.push({ t: 'close' });
        return out(n, ev, false, true);
      }
      if (c === 'E') { if (!s.on.M) return blocked(s, [{ t: 'bump', k: 'door_closed' }]); const n = cl(s); n.px = nx; n.py = ny; return out(n, [{ t: 'win' }], true, true); }
      if (!S7.litMap(L, s)[nx + ',' + ny]) return blocked(s, [{ t: 'bump', k: 'dark' }]);
      const n = cl(s); n.px = nx; n.py = ny;
      return out(n, [], true, true);
    },
    key: (L, s) => s.px + ',' + s.py + ',' + S7.prep(L).ids.map((id) => (s.on[id] ? 1 : 0)).join(''),
    solved: (L, s) => S7.won(L, s)
  };

  const MODS = { s1: S1, s2: S2, s4: S4, s7: S7 };
  const ACTS = { s1: ['U', 'D', 'L', 'R'], s2: ['U', 'D', 'L', 'R'], s4: ['U', 'D', 'L', 'R'], s7: ['U', 'D', 'L', 'R'] };

  /* ---------------- 幅優先探索（自動テストと「詰み」判定で使う） ----------------
     goal(s) が真になる最短の操作列を返す。見つからなければ null。 */
  function bfs(id, L, s0, goal, opts) {
    const M = MODS[id], acts = ACTS[id], lim = (opts && opts.limit) || 3000000;
    const seen = new Map(), q = [s0], par = [-1], act = [''];
    seen.set(M.key(L, s0), 0);
    for (let h = 0; h < q.length; h++) {
      const s = q[h];
      if (goal(s)) { let r = '', i = h; while (par[i] >= 0) { r = act[i] + r; i = par[i]; } return { path: r, states: q.length }; }
      if (q.length > lim) return { path: null, states: q.length, capped: true };
      for (const a of acts) {
        const r = M.step(L, s, a);
        if (!r.changed) continue;
        const k = M.key(L, r.s);
        if (seen.has(k)) continue;
        seen.set(k, q.length); q.push(r.s); par.push(h); act.push(a);
      }
    }
    return { path: null, states: q.length };
  }
  // 今の状態から出口まで行けるか（小さい盤面用）
  function canFinish(id, L, s, limit) { const r = bfs(id, L, s, (x) => MODS[id].solved(L, x), { limit: limit || 200000 }); return r.path !== null || !!r.capped; }

  return { W, H, DIRS, MODS, ACTS, LEVELS, bfs, canFinish, cl };
});
