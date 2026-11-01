/* ゲームの画面に出る文を、すべて一覧にして JSON で出す（セリフ集のスプレッドシート用）
   使い方：node tools/export_lines.js > lines.json
   ・lines   ＝ 人物の台詞と地の文（story.js の P。メッセージ欄に、話し手の名前つきで出る）
   ・guides  ＝ 案内文（メッセージ欄に出る説明・謎解きと戦闘の文・選べない理由／画面上部のお知らせ）
   ・ends    ＝ 結末の名前と説明
   ・choices ＝ 選択肢のボタンの文（rules.js の CHOICES）
   {〇〇} は、ゲームの中で数字や名前が入る所です */
global.window = {}; require('../rules.js'); require('../story.js'); require('../battle_rules.js');
const S = window.STORY, P = S.P, C = window.CHOICES, BR = window.BattleRules;
const plain = (t) => t.replace(/[（(][^）)]*(カルマ|不安)[^）)]*[）)]/g, '').trim();   // 画面に出るボタンの文（game.js と同じく、カルマ・不安の注記を外す）
const secOf = (k) => { const m = /^s(\d+)/.exec(k); if (m) return m[1] === '0' ? '序章' : '区画' + m[1]; if (/^e/.test(k)) return '結末'; if (/^t_/.test(k)) return 'タイマー'; return 'その他'; };
const SCN = { dusk: '牧草地（夕暮れ）', dusk_after: '牧草地（夕暮れ・羊を戻したあと）', home_dawn: '祖父母の家の前（朝）', house_in: '祖父母の家の中', house_night: '祖父母の家（夜）', house_night_desk: '祖父母の家（夜・机）', house_stone: '祖父母の家（朝・枕元の石）', memory: '思い出', black: '暗転', memo_pasture: '回想：牧草地', memo_house: '回想：祖父母の家', memo_amina: '回想：アミーナ', mine_gate: '廃坑の入口', mine_dark: '廃坑の中', mine_cart: 'トロッコ', waterway: '三叉路・水路', lair: 'ムカデの住処', crys_cave: '水晶洞', crys_secret: '隠し部屋', miners_rest: '鉱夫の休憩所', collapse: '崩落した通路', lamp_hall: '灯火の間', cavern: '大空洞', altar: '命の祭壇', return_path: '帰り道' };
const NOTE = { s10_call: ['呼びかけ1回目', '呼びかけ2回目', '呼びかけ3回目'], s10_wait: ['待つ1回目', '待つ2回目', '待つ3回目'] };
const WHO = Object.assign({}, S.names, { nar: '地の文', plq: '碑文', jrn: '日誌', sys: '案内' });
const lines = [], guides = [], seen = {};
const occ = (t) => { seen[t] = (seen[t] || 0) + 1; return seen[t]; };
// where：どこで出るか。メッセージ欄以外（お知らせ・ボタン）に出るものは、その場所も書き添える
const g = (id, sec, where, text, how) => guides.push({ id, sec, where: how && how !== 'メッセージ欄' ? (where ? where + '［' + how + '］' : how) : where, text, occ: occ(text) });

/* ---- ① 台詞と地の文（story.js の P） ---- */
let scene = '';
const P_WHERE = {
  'P.s1_restack': '区画1：「二人で協力して登る」で足場が崩れたあと', 'P.s2_revealed': '区画2：フラメトがスイッチを見つけたあと', 'P.s4_bonus': '区画4：隠し部屋が開いたとき',
  'P.s4_leave_it': '区画4：隠し部屋の選択肢のボタン（何も取らない）', 'P.s4_back_mirror': '区画4：扉の前の選択肢のボタン（謎解きに戻る）', 'P.s4_hint_secret': '区画4：扉の前で、隠し部屋がまだ開いていないとき（問いかけの2行目）',
  'P.s9_why_k': '区画9・10：選べない選択肢の理由（カルマが高いとき。画面にカルマの名前は出さない）', 'P.s9_why_short': '区画9：選べない選択肢の理由（短縮ルート）', 'P.s10_why_call': '区画10：選べない選択肢の理由（呼びかけが届かない）',
  'P.s10_why_home': '区画10：選べない選択肢の理由（まだ帰れない）', 'P.s10_why_hurt': '区画10：選べない選択肢の理由（フラメトを攻撃したあと）'
};
const P_HOW = { 'P.t_warn': '画面上部のお知らせ（展示モード：残り5分）', 'P.t_last': '画面上部のお知らせ（展示モード：残り30秒）', 'P.s4_leave_it': '選択肢のボタン', 'P.s4_back_mirror': '選択肢のボタン', 'P.s9_why_k': '選択肢のボタンの下', 'P.s9_why_short': '選択肢のボタンの下', 'P.s10_why_call': '選択肢のボタンの下', 'P.s10_why_home': '選択肢のボタンの下', 'P.s10_why_hurt': '選択肢のボタンの下' };
function walk(v, path, key, note) {
  if (typeof v === 'string') { g(path, secOf(key), P_WHERE[path] || '', v, P_HOW[path]); return; }
  if (Array.isArray(v)) { v.forEach((x, i) => walk(x, path + '[' + i + ']', key, (NOTE[key] && Array.isArray(x)) ? NOTE[key][i] : note)); return; }
  if (v && typeof v === 'object') {
    if (v.sc) scene = SCN[v.sc] || v.sc;
    if (typeof v.t !== 'string' && ['sc', 'c', 'sfx', 'shake', 'wait', 'flash', 'enemy', 'dust', 'item'].some((q) => q in v)) return;   // 場面・演出の指定（文ではない）
    if (typeof v.t === 'string') { lines.push({ id: path, sec: secOf(key), scene, who: WHO[v.w] || v.w, kind: v.p ? '仮' : '原稿', src: v.src || '', text: v.t, occ: occ(v.t), note: /^P\.s7_res\.lamp_c/.test(path) ? '区画7の謎解きが解けたあと（まんなかのランプが灯って扉に入ったあと）' : (note || '') }); return; }
    Object.keys(v).forEach((k) => { if (k === 'endings') return; walk(v[k], path + '.' + k, key, note || (C[k] ? '選択肢「' + plain(C[k].label) + '」のあと' : '')); });
  }
}
Object.keys(P).forEach((k) => { if (k === 'endings') return; walk(P[k], 'P.' + k, k, ''); });

/* ---- ② 謎解きの文（story.js の puz）。目標・ヒント・ぶつかったとき・仕掛けが動いたとき ---- */
const PZ = { s0: ['序章', '羊追い'], s1: ['区画1', 'トロッコと砂袋'], s2: ['区画2', '水路と水門'], s4: ['区画4', '鏡と水晶'], s7: ['区画7', '灯火の間'] };
const BUMP = {
  rock: '大岩にぶつかったとき', trolley_locked: '固定したトロッコを押したとき', trolley_chocked: '車輪止めがかかったトロッコを押したとき', trolley_rail: 'トロッコを縦に押したとき', trolley_end: 'トロッコが終点より先へ行かないとき',
  trolley_bag: 'レールの上の砂袋がじゃまなとき', bag_blocked: '砂袋がそれ以上動かないとき', slot_full: '積み終えた足場に、さらに砂袋を押したとき',
  gate_closed: '閉まった水門にぶつかったとき', submerged: '水に沈んだ道へ進もうとしたとき（{①〜③} は水路の番号）', nofoot: '浮き橋が浮いていない所へ進もうとしたとき（{①〜③} は水路の番号）',
  pillar: '石柱にぶつかったとき', crystal: '水晶にぶつかったとき', splitter: '光を割る石にぶつかったとき', source: '光を放つ装置にぶつかったとき', door_closed: '閉まった扉にぶつかったとき',
  barn: '羊小屋にぶつかったとき', sheep_stuck: '羊がどこにも動けないとき',
  wall: '壁にぶつかったとき', already: '火の入った燭台に、もう一度ぶつかったとき', dark: '暗いマスへ進もうとしたとき'
};
const FX = {
  chock: '車輪止めを外したとき', locked: 'トロッコが終点に固定されたとき', slot: '砂袋を足場に積んだとき（{n}／{m} は積んだ数／全部の数）',
  lever: '堰のレバーを踏んだとき', switch: '水門のスイッチを踏んだとき', lit: '光った水晶の数が増えたとき（{n}／{m}）',
  light: '燭台・ランプに火を入れたとき（{名前} は「燭台」「左のランプ」「まんなかのランプ」「右のランプ」。消えた火がないときは、後ろの文は出ない）',
  dodge: '羊が横へよけたとき', pen: '羊が小屋に入ったとき（{n}／{m} は入った数／全部の数。「／」の前が2頭目まで、後ろが最後の1頭）',
  open: 'まんなかのランプが灯って、扉が開いたとき', close: 'まんなかのランプが消えて、扉が閉じたとき'
};
const tmpl = (f, args) => f(...args);
const FX_ARGS = { slot: ['{n}', '{m}'], lit: ['{n}', '{m}'], submerged: [0], nofoot: [0] };
Object.keys(S.puz).forEach((sid) => {
  const o = S.puz[sid], [sec, name] = PZ[sid] || [sid, sid];
  g('puz.' + sid + '.goal', sec, sec + ' ' + name + '：謎解きの目標（「目標：」の後ろに出る）' + (o.diff && Object.values(o.diff).some((x) => x.goal) ? '（かんたん）' : ''), o.goal);
  o.hints.forEach((h, i) => g('puz.' + sid + '.hints[' + i + ']', sec, sec + ' ' + name + '：ヒント ' + (i + 1) + '（「ヒント ' + (i + 1) + '／' + o.hints.length + '：」の後ろに出る）' + (o.diff ? '（かんたん）' : ''), h));
  // 難易度ごとの目標・ヒント（ふつう・むずかしい）
  Object.keys(o.diff || {}).forEach((d) => {
    const od = o.diff[d], dn = (S.diffs.find((x) => x.id === d) || {}).name || d, base = 'puz.' + sid + '.diff.' + d;
    if (od.goal) g(base + '.goal', sec, sec + ' ' + name + '：謎解きの目標（' + dn + '）', od.goal);
    (od.hints || []).forEach((h, i) => g(base + '.hints[' + i + ']', sec, sec + ' ' + name + '：ヒント ' + (i + 1) + '（' + dn + '）', h));
  });
  Object.keys(o.fx.bump || {}).forEach((k) => { const v = o.fx.bump[k]; g('puz.' + sid + '.fx.bump.' + k, sec, sec + ' ' + name + '：' + (BUMP[k] || k), typeof v === 'function' ? tmpl(v, FX_ARGS[k] || []).replace(/水路undefined|水路①/, '水路{①〜③}') : v); });
  Object.keys(o.fx).forEach((k) => {
    if (k === 'bump') return; const v = o.fx[k];
    const t = k === 'pen' ? v(1, 3).replace('1／3', '{n}／{m}') + '／' + v(3, 3).replace('3／3', '{n}／{m}') : k === 'light' ? '{名前}に火を入れた。そのかわり、{消えた火（「燭台と燭台」など）}の火が消えた。' : typeof v === 'function' ? tmpl(v, FX_ARGS[k] || []) : v;
    g('puz.' + sid + '.fx.' + k, sec, sec + ' ' + name + '：' + (FX[k] || k), t);
  });
});
/* 謎解きのボタンを押したときの文（puzzle.js） */
g('puzzle.undo', '謎解き', '謎解き：「ひとつ戻す」を押したとき', 'ひとつ戻した。');
g('puzzle.reset', '謎解き', '謎解き：「やり直す」を押したとき', 'やり直した。');
g('puzzle.solving', '謎解き', '謎解き：答えを自動で探しているとき（確認用メニュー）', '答えを探しています……');
g('puzzle.nosolve', '謎解き', '謎解き：今の状態からは解けないとき（確認用メニュー）', 'この状態からは出口へ行けない。「やり直す」を押そう。');
g('puzzle.auto', '謎解き', '謎解き：答えを自動で見せているとき（確認用メニュー。{n} は手数）', '答えを自動で見せている。止めるには、どれかのキーやボタンを押そう。（{n}手）');

/* ---- ③ 戦闘の文（battle_rules.js の TXT と、行動できない理由） ---- */
const T = BR.TXT, BT_WHERE = {
  'start.centipede': '区画3：ムカデとの戦いが始まったとき', 'start.boss': '区画8：トゲイモムシとの戦いが始まったとき',
  yourTurn: 'ルノの番になったとき（{t}／{max} はターン。ムカデ戦は「（ターン {t}）」）', staff: 'ルノの杖が当たったとき', stone: 'ルノの石弾が当たったとき', miss: '不安で攻撃がはずれたとき',
  guard: 'ルノが「防御」したとき', calm: 'ルノが「落ち着く」を使ったとき', call: 'ルノが「呼びかけ」を使ったとき', fbite: 'フラメトが噛みついたとき', fram: 'フラメトが体当たりしたとき（{反動} はフラメトが受けるダメージ）',
  growl: 'フラメトが威嚇したとき', fguard: 'フラメトが傷をかばって下がったとき', fstay: 'フラメトが身構えているとき', ebite: '敵の攻撃が当たったとき', tele: 'トゲイモムシの突進の予兆',
  charge: 'トゲイモムシが突進したとき', chargeHit: '突進が当たったとき（前の文に続けて出る）', chargeMiss: '突進が当たらなかったとき（前の文に続けて出る）', crystal: '区画8：水晶のかけらを使ったとき'
};
const BT_ARGS = { yourTurn: ['{t}', '{max}'], staff: ['{敵}', '{ダメージ}'], stone: ['{敵}', '{ダメージ}', '{残り}'], miss: ['{不安の増加}'], calm: ['{下がった不安}'], call: ['{下がった不安}'], fbite: ['{敵}', '{ダメージ}'], fram: ['{敵}', '{ダメージ}', '{反動}'], growl: ['{敵}'], ebite: ['{敵}', '{ルノ／フラメト}', '{ダメージ}'], tele: ['{敵}'], charge: ['{敵}'], chargeHit: ['{ルノ／フラメト}', '{ダメージ}'] };
Object.keys(T.start).forEach((k) => g('battle.TXT.start.' + k, k === 'boss' ? '区画8' : '区画3', BT_WHERE['start.' + k], T.start[k]));
Object.keys(T).forEach((k) => { if (k === 'start' || k === 'names') return; const v = T[k]; g('battle.TXT.' + k, '戦闘', '戦闘：' + BT_WHERE[k], typeof v === 'function' ? tmpl(v, BT_ARGS[k] || []) : v); });
const WHY = [
  ['move.closed', '行動のあとは、もう動けない', '移動しようとしたが、もう行動したあと'], ['move.used', '今回の移動は使い切った', '移動を使い切ったあとに、移動しようとしたとき'],
  ['once', '行動は1回だけ', '行動したあとに、もう一度行動しようとしたとき'], ['staff.anx', '手が震えて、杖を振れない', '不安が高くて「杖」が使えないとき'], ['staff.far', '敵が遠い（射程1）', '敵が遠くて「杖」が届かないとき'],
  ['stone.none', '石弾がない', '石弾を使い切ったとき'], ['stone.anx', '手が震えて、狙えない', '不安が高くて「石弾」が使えないとき'], ['stone.range', '射程外（' + BR.BT.STONE_MIN + '〜' + BR.BT.STONE_MAX + '）', '敵が「石弾」の射程の外にいるとき'],
  ['calm.max', '気持ちが張りつめて、落ち着けない', '不安が限界で「落ち着く」が使えないとき'], ['call.far', '今は、声が届かない', 'カルマが高くて「呼びかけ」が使えないとき'],
  ['crystal.none', '水晶を持っていない', '水晶のかけらを持っていないとき'], ['crystal.early', '3ターン目から使える', '2ターン目までに水晶を使おうとしたとき']
];
WHY.forEach(([id, t, where]) => g('battle.why.' + id, '戦闘', '戦闘：' + where + '（文の最後に「。」がつく）', t));

/* ---- ④ 画面上部のお知らせ（メッセージ欄ではないが、物語の文なので載せる） ---- */
/* 難易度（タイトルで「はじめから」などを押したあとの画面） */
g('STORY.diffLead', 'タイトル', '難易度をえらぶ画面：いちばん上の説明', S.diffLead);
S.diffs.forEach((x, i) => { g('STORY.diffs[' + i + '].name', 'タイトル', '難易度をえらぶ画面：ボタンの名前［ボタン］', x.name); g('STORY.diffs[' + i + '].note', 'タイトル', '難易度をえらぶ画面：「' + x.name + '」のボタンの下の説明［ボタン］', x.note); });
g('game.short_banner', 'タイマー', '画面上部のお知らせ（展示モード：残り2分で近道へ）', '残り2分　近道で祭壇へ向かう');
Object.keys(S.sec).forEach((n) => { const s = S.sec[n]; if (n === '0') return; g('STORY.sec[' + n + ']', '区画' + n, '画面上部のお知らせ：区画' + n + 'のはじめに出る札（「区画' + n + '　」の後ろに出る）', s.name + '（' + s.kind + '）'); });

const ends = Object.keys(P.endings).map((k) => ({ id: 'P.endings.' + k, mark: P.endings[k].mark, name: P.endings[k].name, note: P.endings[k].note }));
const choices = Object.keys(C).map((k) => ({ id: k, row: C[k].row, sec: C[k].sec === 0 ? '序章' : '区画' + C[k].sec, label: C[k].label, shown: plain(C[k].label), K: C[k].K, A: C[k].A }));
process.stdout.write(JSON.stringify({ lines, guides, ends, choices }, null, 1));
