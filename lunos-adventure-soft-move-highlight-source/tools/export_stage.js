/* 場面と配置のシート用に、背景・小物・立ち位置とポーズ・調整値を書き出す（JSON）。使い方：node tools/export_stage.js > out.json */
global.window = {}; ['atlas', 'story', 'stage_data'].forEach((f) => require('../' + f + '.js'));
const { ST, PRESETS, FIXED } = window.StageData, STORY = window.STORY, F = window.ATLAS.frames;
// 場面の名前（セリフ集と同じ）
const SCN = { dusk: '牧草地（夕暮れ）', dusk_after: '牧草地（夕暮れ・羊を小屋に戻したあと）', memo_pasture: '回想：牧草地', memo_house: '回想：祖父母の家', memo_amina: '回想：アミーナ', home_dawn: '祖父母の家の前（朝）', house_in: '祖父母の家の中', house_night: '祖父母の家（夜）', house_night_desk: '祖父母の家（夜・机）', house_stone: '祖父母の家（朝・枕元の石）', memory: '思い出', black: '暗転', mine_gate: '廃坑の入口', mine_dark: '廃坑の中', mine_cart: 'トロッコ', waterway: '三叉路・水路', lair: 'ムカデの住処', crys_cave: '水晶洞', crys_secret: '隠し部屋', miners_rest: '鉱夫の休憩所', collapse: '崩落した通路', lamp_hall: '灯火の間', cavern: '大空洞', altar: '命の祭壇', return_path: '帰り道' };
const BG = { sky: '牧草地（空・丘・家）', house: '祖父母の家の中', cave: '洞窟（床と壁の素材を敷く）', vista: '廃坑の入口（朝の光の一枚絵・鉄の柵の入口）', memory: '思い出（光の中）', black: '真っ暗' };
const SET = { mine: '廃坑の岩', crys: '水晶洞の青い岩', altar: '祭壇の石' };
// 絵の説明（小物に使える絵）
const D = { o_house_full: '祖父母の家（屋根・壁・扉を1枚に組んだ絵）', r_crates: '木箱（3つ）', r_crates2: '木箱（2つ）', r_barrel: '樽', r_bench: 'ベンチ', r_candle: 'ろうそく', r_barn: '羊小屋', r_bush: '茂み', r_trough: '水桶', r_rocks: '岩（草地）', gate_locked: '鉄の柵の入口（鎖と南京錠）', gate_unlocked: '開いた入口（鎖を外したあと）', h_desk: '机（ランタンと壺つき）', frame_b: '坑道の木枠（入口B）', trolley_rig: 'トロッコ（レールつき）', frame_c: '坑道の木枠（入口C）', mine_entrance: '廃坑の入口', door_open: '開いた扉', door_closed: '閉じた扉', obs_blue_rock: '青い岩', obs_column: '石の柱', obs_crystal_stalagmite: '水晶の石筍', obs_lantern_post: 'ランタンの柱', obs_stalagmite: '石筍（下から伸びる岩）', rail_lantern_post: 'レール脇のランタン', cave_stairs: '洞窟の階段（明るい出口）', stairs: '石の階段', gate_closed: '閉じた水門', frame_a: '坑道の木枠（入口A）', obs_tall_rock: '背の高い岩', stele: '石碑', gate_open: '開いた水門', crystal_rock_tall: '水晶つきの高い岩', big_stone: '大きな石', crystal_big: '大きな水晶', crystal_rock: '水晶つきの岩', crystal_tall: '細長い水晶', cart_coal: '石炭を積んだトロッコ', obs_pillar_ruin: '崩れた柱', obs_timber_collapse: '崩れた木枠', candle_stand: '燭台（ろうそく台）', obs_crystal_pile: '水晶の山', obs_crystal_rocks: '水晶まじりの岩', spotlight: '光源（スポットライト）', crystal_mid: '中くらいの水晶', crystal_ore: '水晶のかけら', obs_mossy_rocks: '苔むした岩', obs_rocks: '岩', obs_stoneblocks: '石のブロック', life_stone: '命継ぎの石', sandbag: '砂袋', plaque: '碑文の板', stalactite: '鍾乳石（上から下がる）', switch_plate: 'スイッチの床', puddle: '水たまり', wheel_chock: '車輪止め', h_fire: '暖炉', h_cupboard: '食器棚', h_shelf: '本棚', h_bed: 'ベッド', h_table: 'テーブル', h_rug: '敷物', o_house: '家の屋根', h_chair: '椅子', o_wood: '薪', o_lamp: '外の街灯', i_bandage: '包帯', i_journal: '日誌', p_flower: '花の草地', p_path: '小道', h_herbs: '吊るした薬草', p_rock: '小さな岩', o_fence: '柵', o_hay: '干し草', p_flowers: '花', h_lantern: 'ランタン', altar_stand: '段のある祭壇', altar_table: '祭壇の台', sheep_idle: '羊（立っている）', sheep_graze: '羊（草を食べる）', sheep_lie: '羊（寝そべる）' };
const PD = { luno: { idle: 'ふつうに立つ', determined: '決意（拳をにぎる）', examine: '物を調べる（紙を持つ）', worried: '心配そう', surprised: '驚く（！）', sad: 'ひざを抱えて座る', down: '立ったまま項垂れる（目を閉じる）', read: '本を読む（両手で本を持つ）', heal: 'しゃがんで手当てする（前へ両手をのばし、包帯を持つ）' },
  flam: { idle: '立つ', sit: 'おすわり', happy: 'うれしい（舌を出す）', bark: '吠える・遠吠え', sniff: 'においをかぐ・顔を寄せる', guard: '身構える', injured: 'けが（頭を下げる）', lie: '伏せる', sad: 'うなだれる（悲しい）', sit_sad: '項垂れる（「うなだれる」と同じ絵）', lie_sad: '目を閉じて伏せる（悲しい）' },
  albo: { idle: '杖をついて立つ', speak: '話す（手を差し出す）', surprised: '驚く', think: '考える（あごに手）', sit: '切り株に座る', sleep: '座って眠る', bed: 'ベッドで起きている', smile: '微笑む（杖をついて立つ）', bed_sleep: 'ベッドで眠る' },
  amina: { stand: '立つ', happy: 'うれしい（上半身）', wave: '手をふる（上半身）', sit: '椅子に座って料理を持つ' } };
// 向き：ルノは「自動・左・右」、フラメトは「左・右」（絵の向きをもとに書く）、アルボ・アミーナは「絵のまま・反転」
const WHO = { luno: 'ルノ', flam: 'フラメト', albo: 'アルボ', amina: 'アミーナ' };
const fmtOpt = (o) => o ? Object.keys(o).map((k) => k + '=' + JSON.stringify(o[k])).join(' ') : '';
// ① 場面の設定（項目ごとに1行）
const scenes = [];
for (const id of Object.keys(PRESETS)) {
  const P = PRESETS[id], add = (key, label, val, note) => scenes.push({ id, name: SCN[id] || id, key, label, val: val == null ? '' : val, note: note || '' });
  add('bg', '背景の種類', BG[P.bg] || P.bg, '変えられない（ほかの場面の背景にしたいときはメモへ）');
  if (P.mood) add('mood', '時間', P.mood === 'dawn' ? '朝（dawn）' : '夕暮れ（dusk）', 'dawn か dusk');
  if (P.set) add('set', '床と壁の素材', SET[P.set] || P.set, 'mine（廃坑の岩）／crys（水晶洞）／altar（祭壇の石）');
  if (P.dark != null) add('dark', '暗さ', P.dark, '0（明るい）〜1（真っ暗）');
  if (P.tint) { add('tint', '色味（赤,緑,青,濃さ）', P.tint, '赤・緑・青は0〜255、濃さは0〜1'); }
  if (P.horizon != null) add('horizon', '壁と床の境目の高さ', P.horizon, '画面の上から0〜1');
  if (P.motes) add('motes', '舞う光の粒の色（赤,緑,青）', P.motes, '書かなければ光の粒なし');
  (P.lights || []).forEach((L, i) => add('lights[' + i + ']', '明かり' + (i + 1) + '（横位置, 高さ, 広さ, 色, 強さ）', L.join(' , '), '横位置はマス（0〜11）、高さは画面比、広さはマス、色は 赤,緑,青、強さ 0〜1'));
  if (P.bed != null) add('bed', 'ベッドの横位置', P.bed, 'マス（0〜11）');
  if (P.night) add('night', '夜にする', 'する', '「する」「しない」');
  if (P.memo) add('memo', '回想（セピア色）', 'する', '「する」「しない」');
  if (P.water) add('water', '水路', 'あり', '');
  if (P.rail != null) add('rail', 'レール', P.rail ? 'あり' : 'なし', '「あり」「なし」');
  if (P.dust) add('dust', '砂ぼこり', 'あり', '');
  if (P.desk) add('desk', '机の位置（横位置, 足元の高さ）', P.desk.join(' , '), '隠し部屋の机（日誌と水晶をのせる）');
  if (P.plaque) add('plaque', '碑文の板の位置（横位置, 高さ）', P.plaque.join(' , '), '');
  if (P.altar) add('altar', '命の祭壇の台', 'あり', '台の位置と大きさは「調整値」の ALTAR_Y・ALTAR_S');
}
// ② 小物（場面ごと＋いつも描くもの）
const props = [];
for (const id of Object.keys(PRESETS)) (PRESETS[id].props || []).forEach((p, i) => props.push({ kind: '場面の小物', sid: id, key: 'PRESETS.' + id + '.props[' + i + ']', name: SCN[id] || id, sp: p[0], desc: D[p[0]] || '', x: p[1], y: p[2], s: p[3], flip: p[4] && p[4].flip ? 'する' : '', opt: fmtOpt(Object.assign({}, p[4] || {}, { flip: undefined })).replace(/flip=undefined ?/, '').trim() }));
const FX = { pasture: '牧草地（夕暮れ・朝・回想）', house: '祖父母の家の中（すべて）', altar: '命の祭壇' };
for (const k of ['pasture', 'house', 'altar']) FIXED[k].forEach((p, i) => props.push({ kind: 'いつも描くもの', sid: k, key: 'FIXED.' + k + '[' + i + ']', name: FX[k], sp: p[0], desc: D[p[0]] || '', x: p[1], y: p[2], s: p[3], flip: p[4] && p[4].flip ? 'する' : '', opt: fmtOpt(p[4]) }));
FIXED.altarCandles.forEach((p, i) => props.push({ kind: 'いつも描くもの', sid: 'altar', key: 'FIXED.altarCandles[' + i + ']', name: '命の祭壇', sp: 'candle_stand', desc: D.candle_stand, x: p[0], y: p[1], s: p[2], flip: '', opt: '' }));
props.push({ kind: 'いつも描くもの', sid: 'pasture', key: 'FIXED.pastureHouse', name: FX.pasture, sp: 'o_house_full', desc: D.o_house_full, x: FIXED.pastureHouse[0], y: FIXED.pastureHouse[1], s: ST.HOUSE_S, flip: '', opt: '' });
props.push({ kind: 'いつも描くもの', sid: 'house', key: 'FIXED.houseRug', name: FX.house, sp: 'h_rug', desc: '敷物（幅' + FIXED.houseRug[2] + '・奥行き' + FIXED.houseRug[3] + 'マス）', x: FIXED.houseRug[0], y: FIXED.houseRug[1], s: '', flip: '', opt: '' });
// ③ 立ち位置とポーズ（台詞の流れの中で、人物が出る・動く・ポーズが変わる所）
// 向き：ルノは「自動・左・右」（絵はもともと左向き）、フラメトは「右・左」（絵はもともと右向き）、アルボ・アミーナは「絵のまま・反転」
const FLAM_LEFT = ['injured', 'sniff'];   // フラメトの絵で、もともと左を向いているもの
const faceOf = (k, f, pose) => k === 'luno' ? (f == null ? '自動' : f ? '右' : '左') : k === 'flam' ? ((!!f) !== FLAM_LEFT.includes(pose) ? '左' : '右') : (f ? '反転' : '絵のまま');
const beats = []; let cur = '';
const nextLine = (arr, i) => { for (let j = i; j < arr.length; j++) if (arr[j] && arr[j].w) return (STORY.names[arr[j].w] ? STORY.names[arr[j].w] + '：' : '') + arr[j].t; return ''; };
const secOf = (k0) => { const k = k0.replace(/^P\./, ''); const m = k.match(/^(s(\d+)|e\d|e_timeout|t_)/); return !m ? '' : m[2] != null ? (m[2] === '0' ? '序章' : '区画' + m[2]) : '結末'; };
(function walk(o, key) {
  if (Array.isArray(o)) {
    if (o.some((x) => x && typeof x === 'object' && !Array.isArray(x) && ('sc' in x || 'w' in x || 'c' in x))) {
      o.forEach((b, i) => {
        if (!b || typeof b !== 'object' || Array.isArray(b)) return;
        if (b.sc) cur = b.sc;
        if (!b.c && !b.sc && !b.gate && !b.deskOff) return;
        const fx = [b.sc ? '場面：' + (SCN[b.sc] || b.sc) + (b.fade ? '（暗転して切り替え）' : '') : '', b.sfx ? '効果音：' + b.sfx : '', b.shake ? '揺れ' : '', b.item ? '品物を見せる：' + (D[b.item] || b.item) : '', b.gate ? '入口：' + (D[b.gate] || b.gate) : '', b.deskOff ? '机の上の日誌と水晶を消す' : '', b.enemy ? '敵：' + (b.enemy[0] === 'boss' ? 'トゲイモムシ' : 'ムカデ') + '（横位置 ' + b.enemy[1] + (b.enemy[2] ? '・襲いかかる形' : '') + '）' : '', b.wait ? '待つ ' + b.wait + 'ミリ秒' : ''].filter(Boolean).join('／');
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
const SRC = require('fs').readFileSync(require('path').join(__dirname, '../stage_data.js'), 'utf8');
const stv = Object.keys(ST).filter((k) => typeof ST[k] !== 'object').map((k) => { const m = SRC.match(new RegExp('\\b' + k + ':[^\\n]*?//\\s*([^\\n]*)')); return { key: k, val: ST[k], note: m ? m[1].trim() : '' }; });
console.log(JSON.stringify({ scenes, props, beats, poses, sprites, stv }, null, 1));
