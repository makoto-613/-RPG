/* story.js・rules.js から、セリフ・案内文・選択肢を一覧にして JSON で出す（スプレッドシート作成用） */
global.window = {}; require('../rules.js'); require('../story.js');
const S = window.STORY, P = S.P, C = window.CHOICES;
const secOf = (k) => { const m = /^s(\d+)/.exec(k); if (m) return '区画' + m[1]; if (/^e/.test(k)) return '結末'; if (/^t_/.test(k)) return 'タイマー'; return 'その他'; };
const SCN = { dusk: '牧草地（夕暮れ）', home_dawn: '祖父母の家の前（朝）', house_in: '祖父母の家の中', memory: '思い出', black: '暗転', mine_gate: '廃坑の入口', mine_dark: '廃坑（崩落後）', mine_cart: 'トロッコ', waterway: '三叉路・水路', lair: 'ムカデの住処', crys_cave: '水晶洞', crys_secret: '隠し部屋', miners_rest: '鉱夫の休憩所', collapse: '崩落した通路', lamp_hall: '灯火の回廊', cavern: '大空洞', altar: '命の祭壇', return_path: '帰り道' };
const NOTE = { s10_call: ['呼びかけ1回目', '呼びかけ2回目', '呼びかけ3回目'], s10_wait: ['待つ1回目', '待つ2回目', '待つ3回目'] };
const lines = [], guides = [], seen = {};
const occ = (t) => { seen[t] = (seen[t] || 0) + 1; return seen[t]; };
let scene = '';
function walk(v, path, key, note) {
  if (typeof v === 'string') { guides.push({ id: path, sec: secOf(key), text: v, occ: occ(v), note }); return; }
  if (Array.isArray(v)) { v.forEach((x, i) => walk(x, path + '[' + i + ']', key, (NOTE[key] && Array.isArray(x)) ? NOTE[key][i] : note)); return; }
  if (v && typeof v === 'object') {
    if (v.sc) scene = SCN[v.sc] || v.sc;
    if (typeof v.t !== 'string' && ['sc', 'c', 'sfx', 'shake', 'wait', 'flash', 'enemy', 'dust'].some((q) => q in v)) return;   // 場面・演出の指定（セリフではない）
    if (typeof v.t === 'string') { lines.push({ id: path, sec: secOf(key), scene, who: S.names[v.w] || (v.w === 'nar' ? '地の文' : v.w), kind: v.p ? '仮' : '原稿', src: v.src || '', text: v.t, occ: occ(v.t), note: note || '' }); return; }
    Object.keys(v).forEach((k) => { if (k === 'endings') return; walk(v[k], path + '.' + k, key, note || (C[k] ? '選択肢「' + C[k].label + '」のあと' : '')); });
  }
}
lines.push({ id: 'premise', sec: '序章', scene: 'タイトル画面', who: 'ルノ', kind: '原稿', src: 'S00', text: S.premise.t, occ: occ(S.premise.t), note: 'タイトル画面に出る文' });
Object.keys(P).forEach((k) => { if (k === 'endings') return; walk(P[k], 'P.' + k, k, ''); });
const ends = Object.keys(P.endings).map((k) => ({ id: 'P.endings.' + k, mark: P.endings[k].mark, name: P.endings[k].name, note: P.endings[k].note }));
const choices = Object.keys(C).map((k) => ({ id: k, row: C[k].row, sec: '区画' + C[k].sec, label: C[k].label, K: C[k].K, A: C[k].A }));
process.stdout.write(JSON.stringify({ lines, guides, ends, choices }, null, 1));
