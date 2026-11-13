/* 場面と配置のシート用に、背景・小物・立ち位置とポーズ・調整値を書き出す（JSON）。使い方：node tools/export_stage.js > out.json */
global.window = {}; ['js/data/atlas', 'js/data/story', 'js/data/stage_data'].forEach((f) => require('../' + f + '.js'));
const { ST, PRESETS } = window.StageData, STORY = window.STORY, F = window.ATLAS.frames;
// 場面の名前（セリフ集と同じ。ただし「羊を戻したあと」は、このシートでは「羊を小屋に戻したあと」と書く）
const SCN = Object.assign({}, require('./scenes.js'), { dusk_after: '牧草地（夕暮れ・羊を小屋に戻したあと）' });
const BG = { sky: '牧草地（空・丘・家）', house: '祖父母の家の中', cave: '洞窟（床と壁の素材を敷く）', memory: '思い出（光の中）', black: '真っ暗' };
const SET = { mine: '廃坑の岩', crys: '水晶洞の青い岩', altar: '祭壇の石' };
// 絵の説明（小物に使える絵）
const D = { r_rocks: '岩（草地）', cart_coal: '石炭を積んだトロッコ', obs_rocks: '岩', life_stone: '命継ぎの石', sandbag: '砂袋', wheel_chock: '車輪止め', i_bandage: '包帯', i_journal: '日誌', sheep_idle: '羊（立っている）', sheep_graze: '羊（草を食べる）', sheep_lie: '羊（寝そべる）' };
const PD = { luno: { idle: 'ふつうに立つ', determined: '決意（拳をにぎる）', examine: '物を調べる（紙を持つ）', worried: '心配そう', surprised: '驚く（！）', sad: 'ひざを抱えて座る', down: '立ったまま項垂れる（目を閉じる）', read: '本を読む（両手で本を持つ）', angry: '怒る', heal: 'しゃがんで手当てする（前へ両手をのばし、包帯を持つ）' },
  flam: { idle: '立つ', sit: 'おすわり', happy: 'うれしい（舌を出す）', bark: '吠える・遠吠え', sniff: 'においをかぐ・顔を寄せる', guard: '身構える', injured: 'けが（頭を下げる）', lie: '伏せる', sad: 'うなだれる（悲しい）', sit_sad: '項垂れる（「うなだれる」と同じ絵）', lie_sad: '目を閉じて伏せる（悲しい）' },
  albo: { idle: '杖をついて立つ', speak: '話す（手を差し出す）', surprised: '驚く', think: '考える（あごに手）', sit: '切り株に座る', sleep: '座って眠る', bed: 'ベッドで起き上がる', smile: '微笑む（杖をついて立つ）', bed_sleep: 'ベッドで眠る', haggard: 'やつれた立ち姿', sad: '悲しむ', crouch: '腰を屈める' },
  amina: { stand: '立つ', happy: 'うれしい（上半身）', wave: '手をふる（上半身）', sit: '椅子に座って料理を持つ' } };
// 向き：ルノは「自動・左・右」、フラメトは「左・右」（絵の向きをもとに書く）、アルボ・アミーナは「絵のまま・反転」
const WHO = { luno: 'ルノ', flam: 'フラメト', albo: 'アルボ', amina: 'アミーナ' };
const fmtOpt = (o) => o ? Object.keys(o).map((k) => k + '=' + JSON.stringify(o[k])).join(' ') : '';
// ① 場面の設定（項目ごとに1行）
const scenes = [];
for (const id of Object.keys(PRESETS)) {
  const P = PRESETS[id], add = (key, label, val, note) => scenes.push({ id, name: SCN[id] || id, key, label, val: val == null ? '' : val, note: note || '' });
  add('bg', '背景の種類', BG[P.bg] || P.bg, '変えられない（ほかの場面の背景にしたいときはメモへ）');
  if (P.set) add('set', '床と壁の素材', SET[P.set] || P.set, 'altar（祭壇の石。一枚絵のない場面だけ）');
  if (P.dark != null) add('dark', '暗さ', P.dark, '0（明るい）〜1（真っ暗）');
  if (P.tint) { add('tint', '色味（赤,緑,青,濃さ）', P.tint, '赤・緑・青は0〜255、濃さは0〜1'); }
  if (P.motes) add('motes', '舞う光の粒の色（赤,緑,青）', P.motes, '書かなければ光の粒なし');
  (P.lights || []).forEach((L, i) => add('lights[' + i + ']', '明かり' + (i + 1) + '（横位置, 高さ, 広さ, 色, 強さ）', L.join(' , '), '横位置はマス（0〜11）、高さは画面比、広さはマス、色は 赤,緑,青、強さ 0〜1'));
  if (P.dust) add('dust', '砂ぼこり', 'あり', '');
}
// ② 小物（場面ごと＋いつも描くもの）
const props = [];
for (const id of Object.keys(PRESETS)) (PRESETS[id].props || []).forEach((p, i) => props.push({ kind: '場面の小物', sid: id, key: 'PRESETS.' + id + '.props[' + i + ']', name: SCN[id] || id, sp: p[0], desc: D[p[0]] || '', x: p[1], y: p[2], s: p[3], flip: p[4] && p[4].flip ? 'する' : '', opt: fmtOpt(Object.assign({}, p[4] || {}, { flip: undefined })).replace(/flip=undefined ?/, '').trim() }));
// ③ 立ち位置とポーズ（台詞の流れの中で、人物が出る・動く・ポーズが変わる所）
// 向き：ルノは「自動・左・右」（絵はもともと左向き）、フラメトは「右・左」（絵はもともと右向き）、アルボ・アミーナは「絵のまま・反転」
const FLAM_LEFT = ['injured', 'sniff'];   // フラメトの絵で、もともと左を向いているもの
const faceOf = (k, f, pose) => k === 'luno' ? (f == null ? '自動' : f ? '右' : '左') : k === 'flam' ? ((!!f) !== FLAM_LEFT.includes(pose) ? '左' : '右') : (f ? '反転' : '絵のまま');
const beats = []; let cur = '';
const nextLine = (arr, i) => { for (let j = i; j < arr.length; j++) if (arr[j] && arr[j].w) return (STORY.names[arr[j].w] ? STORY.names[arr[j].w] + '：' : '') + arr[j].t; return ''; };
// 区画の番号は画面に出す番号（水門の区画2を消したので、3以降は1つ詰める）
const secOf = (k0) => { const k = k0.replace(/^P\./, ''); const m = k.match(/^(s(\d+)|e\d|e_timeout|t_)/); return !m ? '' : m[2] != null ? (m[2] === '0' ? '序章' : '区画' + (+m[2] > 2 ? +m[2] - 1 : m[2])) : '結末'; };
(function walk(o, key) {
  if (Array.isArray(o)) {
    if (o.some((x) => x && typeof x === 'object' && !Array.isArray(x) && ('sc' in x || 'w' in x || 'c' in x))) {
      o.forEach((b, i) => {
        if (!b || typeof b !== 'object' || Array.isArray(b)) return;
        if (b.sc) cur = b.sc;
        if (!b.c && !b.sc && !b.gate && !b.deskOff) return;
        const fx = [b.sc ? '場面：' + (SCN[b.sc] || b.sc) + (b.fade ? '（暗転して切り替え）' : b.xfade ? '（重ねて切り替え）' : '') : '', b.sfx ? '効果音：' + b.sfx : '', b.shake ? '揺れ' : '', b.item ? '品物を見せる：' + (D[b.item] || b.item) : '', b.gate ? '入口：' + (D[b.gate] || b.gate) : '', b.deskOff ? '机の上の日誌と水晶を消す' : '', b.enemy ? '敵：' + (b.enemy[0] === 'boss' ? 'トゲイモムシ' : 'ムカデ') + '（横位置 ' + b.enemy[1] + (b.enemy[2] ? '・襲いかかる形' : '') + '）' : '', b.wait ? '待つ ' + b.wait + 'ミリ秒' : ''].filter(Boolean).join('／');
        const cs = Object.keys(b.c || {});
        if (!cs.length) beats.push({ key: key + '[' + i + ']', sec: secOf(key), scene: SCN[cur] || cur, next: nextLine(o, i), who: '', pose: '', x: '', f: '', fx });
        cs.forEach((k) => { const a = b.c[k]; beats.push({ key: key + '[' + i + ']', sec: secOf(key), scene: SCN[cur] || cur, next: nextLine(o, i), who: WHO[k] || k, pose: a ? a[0] : '（退場）', poseJ: a ? (PD[k] || {})[a[0]] || '' : '', x: a ? a[1] : '', f: a ? faceOf(k, a[2], a[0]) : '', fx }); });
      });
      return;
    }
    o.forEach((x, i) => walk(x, key + '[' + i + ']'));
    return;
  }
  if (o && typeof o === 'object') Object.keys(o).forEach((k) => walk(o[k], key ? key + '.' + k : 'P.' + k));
})(STORY.P, '');
// ④ ポーズの一覧
const poses = []; for (const k of Object.keys(PD)) for (const p of Object.keys(PD[k])) poses.push({ who: WHO[k], pose: p, desc: PD[k][p] });
// ⑤ 小物に使える絵の一覧
const sprites = Object.keys(D).filter((n) => F[n]).map((n) => ({ name: n, desc: D[n], w: F[n].w, h: F[n].h }));
// ⑥ 調整値（ST）
const SRC = require('fs').readFileSync(require('path').join(__dirname, '../js/data/stage_data.js'), 'utf8');
const stv = Object.keys(ST).filter((k) => typeof ST[k] !== 'object').map((k) => { const m = SRC.match(new RegExp('\\b' + k + ':[^\\n]*?//\\s*([^\\n]*)')); return { key: k, val: ST[k], note: m ? m[1].trim() : '' }; });
// ⑦ 絵のファイル（背景・人物・敵）と、画面の上での大きさ・位置
const fs = require('fs'), path = require('path'), ROOT = path.join(__dirname, '..');
function webpSize(file) {
  const b = fs.readFileSync(file), t = b.toString('ascii', 12, 16);
  if (t === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (t === 'VP8L') { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
}
const filesIn = (dir) => Object.fromEntries(fs.readdirSync(path.join(ROOT, dir)).filter((n) => n.endsWith('.webp')).map((n) => [n.replace(/\.webp$/, ''), webpSize(path.join(ROOT, dir, n))]));
const BGF = filesIn('assets/novel_bg'), CHF = filesIn('assets/character_novel'), ENF = filesIn('assets/enemies_hd');
const STAGE_SRC = fs.readFileSync(path.join(ROOT, 'js/novel/stage.js'), 'utf8');
const BG_ALIAS = eval('(' + STAGE_SRC.match(/const BG_ALIAS = (\{[^}]*\})/)[1] + ')');
const STATEFUL = eval(fs.readFileSync(path.join(ROOT, 'js/novel/visual_state.js'), 'utf8').match(/STATEFUL_SCENES = Object\.freeze\((\[[^\]]*\])/)[1]);
// 背景の絵：場面ごとに、どの絵を使うか
const bgs = Object.keys(PRESETS).map((id) => {
  const file = BG_ALIAS[id] || id, sz = BGF[file];
  let use, note = '';
  // 進み具合で見た目が変わる場面は、一枚絵の上に変化を重ねる（stage.js の artOverlay・houseOnArt）か、状態ごとの絵に切り替える
  const ALT = { mine_gate: 'mine_gate_open.webp（鎖を外したあと）', collapse: 'collapse_after.webp（岩が崩れたあと）' };
  if (!sz) { use = '絵なし'; note = id === 'black' ? '真っ暗' : ''; }
  else { use = '使う'; if (ALT[id]) note = '状態で切り替える絵：' + ALT[id]; else if (STATEFUL.includes(id)) note = '状態で変わる物は、絵の上に重ねて描く'; }
  if (BG_ALIAS[id]) note = (note ? note + '。' : '') + '「' + file + '.webp」を使う（stage.js の BG_ALIAS）';
  return { id, name: SCN[id] || id, file: sz ? 'assets/novel_bg/' + file + '.webp' : '', w: sz ? sz[0] : '', h: sz ? sz[1] : '', use, note };
});
const usedBg = new Set(bgs.filter((b) => b.use === '使う').map((b) => b.file));
Object.keys(BGF).forEach((n) => { const f = 'assets/novel_bg/' + n + '.webp'; if (!usedBg.has(f) && !bgs.some((b) => b.file === f || b.note.includes(n + '.webp'))) bgs.push({ id: '', name: '（どの場面でも表示されない）', file: f, w: BGF[n][0], h: BGF[n][1], use: '使われていない', note: STATEFUL.includes(n) ? 'この場面はドット絵で組み立てるため' : BG_ALIAS[n] ? '別の絵に置きかえ中' : '' }); });
// 人物の絵（会話の場面の立ち絵：assets/character_novel）：stage.js の customPoseFor と同じ決まり。フラメトは頭と胸の絵（_cut）
const fileOf = (k, p) => k + '_' + p + (k === 'flam' ? '_cut' : '');
const has = (k, p) => !!CHF[fileOf(k, p)];
function poseFile(k, p) {
  p = p || 'idle';
  if (k === 'albo' && /^bed/.test(p)) return null;
  if (has(k, p)) return p;
  const alt = (ST.VN_POSE_ALT[k] || {})[p];
  if (alt && has(k, alt)) return alt;
  const d = k === 'amina' ? 'stand' : 'idle';
  return has(k, d) ? d : null;
}
const usedBy = {};
for (const k of Object.keys(PD)) for (const p of Object.keys(PD[k])) { const f = poseFile(k, p); if (f) (usedBy[fileOf(k, f)] ||= []).push(p); }
const chimgsF = () => Object.keys(CHF).map((n) => { const k = n.split('_')[0], pose = n.slice(k.length + 1).replace(/_cut$/, ''); return { who: WHO[k], file: 'assets/character_novel/' + n + '.webp', pose, w: CHF[n][0], h: CHF[n][1], usedBy: (usedBy[n] || []).join('、'), hRate: k === 'flam' ? ST.VN_FLAM_SIZE : ST.VN_FIG_H, foot: '', wRate: 1 }; });
const enimgs = Object.keys(ENF).map((n) => { const [kind, pose] = n.split('_'); return { kind: kind === 'boss' ? 'トゲイモムシ' : '岩喰いムカデ', file: 'assets/enemies_hd/' + n + '.webp', pose, w: ENF[n][0], h: ENF[n][1], where: pose === 'big' ? '物語の場面（ふだん）' : pose === 'atk' ? '物語の場面で「襲いかかる形」・戦闘の攻撃' : pose === 'dmg' ? '戦闘でダメージを受けたとき・倒れたとき' : '戦闘の盤面（ふだん）' }; });
// 台詞の流れに沿って、画面に出ている人物を積み上げ、それぞれの位置と大きさを計算する
const [W, H] = [1440, 810]; // PC の画面の大きさ
// stage.js の portraitLayout と同じ：ルノ・フラメト・アルボ・アミーナを左から並べる（敵・ベッドのアルボがいるときは左に寄せる）
const isBed = (k, c) => k === 'albo' && /^bed/.test(c.p);
const figuresIn = (chars) => ['luno', 'flam', 'albo', 'amina'].filter((k) => chars[k] && !isBed(k, chars[k]));
function layout(chars, enemy) {
  const ents = figuresIn(chars).sort((a, b) => chars[a].x - chars[b].x);
  const bed = chars.albo && isBed('albo', chars.albo), tbl = enemy || bed ? ST.VN_X_ENEMY : ST.VN_X;
  const xs = tbl[Math.min(ents.length, tbl.length) - 1] || [];
  const pos = {}; ents.forEach((k, i) => (pos[k] = xs[Math.min(i, xs.length - 1)]));
  if (bed) pos.albo = ST.BED_SLOT;
  return pos;
}
function sizeOn(k, c) {
  if (isBed(k, c)) { const [x0, y0, x1, y1] = ST.BED_CROP, ar = ((x1 - x0) * 1100) / ((y1 - y0) * 733), bw = Math.min(H * ST.BED_H * ar, W * ST.BED_W_MAX); return { w: Math.round(bw), h: Math.round(bw / ar), foot: Math.round(ST.BED_BOTTOM * 100), file: 'albo_bed_' + (c.p === 'bed_sleep' ? 'sleep' : 'up') + '.webp（上半身を切り出す）', bed: Math.round(bw) }; }
  const pose = poseFile(k, c.p); if (!pose) return null;
  const [iw, ih] = CHF[fileOf(k, pose)];
  if (k === 'flam') { const side = H * ST.VN_FLAM_SIZE, fh = (side * ih) / iw, bottom = H * ST.VN_FLAM_HEAD_Y + fh; return { w: Math.round(side), h: Math.round(fh), foot: +((bottom / H) * 100).toFixed(1), file: fileOf(k, pose) + '.webp' }; }
  const sc = (H * ST.VN_FIG_H) / ST.VN_IMG_H, feet = H * (k === 'luno' ? ST.VN_LUNO_HEAD_Y : ST.VN_HEAD_TOP) + ST.VN_IMG_H * sc;
  return { w: Math.round(iw * sc), h: Math.round(ih * sc), foot: +((feet / H) * 100).toFixed(1), file: fileOf(k, pose) + '.webp' };
}
const placed = []; let pc = {}, pe = null, pscene = '';
(function walk2(o, key) {
  if (Array.isArray(o)) {
    if (o.some((x) => x && typeof x === 'object' && !Array.isArray(x) && ('sc' in x || 'w' in x || 'c' in x))) {
      o.forEach((b, i) => {
        if (!b || typeof b !== 'object' || Array.isArray(b)) return;
        if (b.sc) { pscene = b.sc; pe = null; }
        if (b.c) { const base = b.sc ? {} : Object.assign({}, pc); Object.keys(b.c).forEach((k) => { const a = b.c[k]; if (!a) delete base[k]; else base[k] = { p: a[0], x: a[1], s: a[3] || 1 }; }); pc = base; } else if (b.sc) pc = {};
        if (b.enemy) pe = { kind: b.enemy[0], pose: b.enemy[2] }; if (b.enemy === null) pe = null;
        if (!b.c && !b.sc && b.enemy === undefined) return;
        const pos = layout(pc, pe), nOn = figuresIn(pc).length + (pe ? 1 : 0);
        const who = Object.keys(pc).sort((a, b2) => pos[a] - pos[b2]);
        who.forEach((k) => { const P1 = sizeOn(k, pc[k]); if (!P1) return; placed.push({ key: key + '[' + i + ']', sec: secOf(key), scene: SCN[pscene] || pscene, next: nextLine(o, i), who: WHO[k], pose: pc[k].p, file: P1.file, slot: Math.round(pos[k] * 100), pcW: P1.w, pcH: P1.h, foot: P1.foot, n: nOn, bed: P1.bed || '' }); });
        if (pe) { const wideW = ST.VN_ENEMY_W * 2.6, f = pe.kind + '_' + (pe.pose && pe.pose !== 'idle' ? pe.pose : 'big'), [iw, ih] = ENF[f] || [1, 1]; placed.push({ key: key + '[' + i + ']', sec: secOf(key), scene: SCN[pscene] || pscene, next: nextLine(o, i), who: pe.kind === 'boss' ? 'トゲイモムシ（敵）' : '岩喰いムカデ（敵）', pose: pe.pose || 'big', file: f + '.webp', slot: 79, pcW: Math.round(W * wideW), pcH: Math.round(W * wideW * ih / iw), foot: Math.round(ST.VN_ENEMY_FEET * 100), n: nOn, bed: '' }); }
      });
      return;
    }
    o.forEach((x, i) => walk2(x, key + '[' + i + ']'));
    return;
  }
  if (o && typeof o === 'object') Object.keys(o).forEach((k) => walk2(o[k], key ? key + '.' + k : 'P.' + k));
})(STORY.P, '');
// 一枚絵の場面では使われない設定・小物（stage.js の frame()：一枚絵のときは dusk の小物、灯り・机・光の粒だけを描く）
const painted = new Set(bgs.filter((b) => b.use === '使う').map((b) => b.id));
scenes.forEach((r) => { r.active = !painted.has(r.id) ? '効く' : ['motes', 'desk', 'dust'].includes(r.key) || r.id === 'dusk' && /^(lights|props)/.test(r.key) ? '効く' : r.key === 'bg' ? '—' : '効かない（一枚絵の場面）'; });
props.forEach((r) => { r.active = r.kind === '場面の小物' ? (!painted.has(r.sid) || r.sid === 'dusk' ? '描く' : '描かない（一枚絵の場面）') : r.sid === 'pasture' ? '描かない（牧草地の場面はすべて一枚絵）' : r.sid === 'house' ? '夜の机・枕元の石の場面だけ描く（家の中・夜は一枚絵）' : '祭壇はドット絵で組み立てるので描く'; });
// 物語の中で実際に使われているポーズも「この絵を使うポーズ」に足す
placed.forEach((r) => { const m = r.file.match(/^((luno|flam|albo|amina)_[a-z_]+)\.webp/); if (!m) return; const a = (usedBy[m[1]] ||= []); if (!a.includes(r.pose)) a.push(r.pose); });
const chimgs = chimgsF();
const unusedCh = chimgs.filter((c) => !c.usedBy).map((c) => c.file);
console.log(JSON.stringify({ scenes, props, beats, poses, sprites, stv, bgs, chimgs, unusedCh, enimgs, placed }, null, 1));
