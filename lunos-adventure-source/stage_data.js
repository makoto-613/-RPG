/* ==========================================================================
   stage_data.js ― ノベル場面のデータ（見た目の調整値・立ち絵のポーズ・床と壁の素材の組・場面の一覧）
   場面を足したり、置く小物や明かりを変えたりするときは、このファイルを書き換えます。描くのは stage.js です。
   ========================================================================== */
(function () {
  'use strict';

  /* ★ 見た目の調整（ここを書き換えると場面の雰囲気が変わります） */
  const ST = {
    RATIO: 7.5 / 11,       // 場面の窓の縦横比（高さ÷幅）。index.src.html の --ar（11 / 7.5）と合わせる
    CHAR_S: 2.0,           // 立ち絵の大きさ（大きいほど大きく描く）
    PIXEL_MATCH: false,    // true：家具・小物のドットの細かさを、人物の立ち絵にそろえる（小さく描く物ほど、ドットが粗くなる）。比較を見てから決める
    FEET: 0.86,            // 場面の中での立ち絵の足元の高さ（場面の絵の高さに対する割合。床の上に立つ位置）
    SCREEN_FEET: 0.69,     // 画面の上での足元の高さ。台詞の枠（下から約30%）の上に来るよう、場面全体（床・壁・小物ごと）を上へ縮めて描く
    HORIZON: 0.6,          // 背景の壁と床の境目の高さ
    FADE_OUT_MS: 220,      // 場面が切り替わるとき、暗くなる時間
    FADE_IN_MS: 380,       // 場面が切り替わるとき、明るくなる時間
    BREATH: 0.012,         // 立ち絵が呼吸するように揺れる大きさ
    STAMP_SIZE: 1.5,       // なめらかに敷くときの「はんこ」の大きさ（マス）。ふちをぼかして重ねるので、マス目が見えない
    STAMP_STEP: 0.82,      // はんこを置く間隔（マス）
    CHAR_GAP: { luno_flam: 2.15, luno_albo: 1.8, flam_albo: 2.1, luno_amina: 1.8 },   // 人物どうしの、中心の最小の間隔（マス）。重ならないように自動でずらす
    VISTA_PX: 26,          // 一枚絵の風景の、ドットの細かさ（1マスあたりのドット数。大きいほど細かい）
    TILE_INSET: 0.045,     // タイルの縁を切り落とす割合（素材の縁にある暗い線を消す。大きいほど多く切る）
    WALK_MS: 330,          // 立ち絵が1マス歩くのにかかる時間（ミリ秒）
    BED_FOLD: 0.335,       // ベッドの絵で、折り返したシーツが始まる高さ（上から0〜1）。ここから下を布団としてアルボの上に重ねる
    BED_SLEEP_SINK: 0.03,   // 眠っているアルボの肩が、折り返したシーツより下へ沈む量（ベッドの絵の高さ比）。大きいほど布団に深く入る
    BED_HEAD_SLEEP_DX: 0.05,   // 眠っているアルボの頭の横のずれ（マス）
    BED_HEAD_SLEEP_S: 1.2,     // 眠っているアルボの頭の大きさ（立ち絵に対する倍率）
    BED_HEAD_SIT: 0.0,     // 起きて座っているアルボの頭の上端
    CAM_PAD: 1.1,          // スマホで見せる範囲を決めるとき、人物の中心から左右に足す幅（マス）
    CAM_PAD_ENEMY: 1.7,    // 同じく、ムカデの中心から左右に足す幅（マス）
    CAM_PAD_BOSS: 2.1,     // 同じく、トゲイモムシの中心から左右に足す幅（マス）
    FACE_DEAD: 0.4,        // ルノの向きを自動で決めるとき、見る相手がこの距離（マス）より近ければ、向きを変えない
    GATE_S: 1.5,           // 廃坑の入口の絵の大きさ（山より大きくならないように）
    MEMO_GRAY: 0.85,       // 回想の場面で、色を抜く強さ（0〜1）
    MEMO_TINT: 'rgb(246,214,170)',   // 回想の場面の、セピアの色
    DESK_S: 1.2,           // 隠し部屋の机の大きさ
    ALTAR_Y: 0.68,         // 命の祭壇の台の足元の高さ（画面比）
    ALTAR_S: 1.3,         // 命の祭壇の台の大きさ
    ITEM_MS: 2200,         // 品物（日誌・包帯など）を画面に見せておく時間（ミリ秒）
    VIEW_MIN: 7.6,         // 縦長の画面（スマホ）で、横に最低何マス分を見せるか（小さいほど人物が大きく、左右が切れる）
    SCREEN_FEET_TALL: 0.7, // 縦長の画面（スマホ）での、画面の上での足元の高さ
    BED_SQ: 0.62,          // ベッドの縦の縮め方（1＝素材のまま）。上から見た絵なので、縦を縮めて床に置いたように見せる
    HOUSE_S: 0.72,         // 牧草地の祖父母の家の大きさ（人物との釣り合い）
    CENT_FAR: 0.72,        // 戦闘前の場面で、ムカデを奥に小さく見せる倍率（1＝手前と同じ大きさ）
    CENT_FAR_DY: -0.55,    // 同じく、奥に置くための足元のずれ（マス。マイナスで奥＝上）
    AMINA_SIT_S: 0.86      // 椅子に座るアミーナの大きさ（ほかの人物との釣り合い）
  };
  const POSE = {   // ポーズ名 → 絵の名前（アトラス）。story.js ではこの短い名前を使う
    luno: { idle: 'luno_idle', determined: 'luno_determined', examine: 'luno_examine', worried: 'luno_worried', surprised: 'luno_surprised', sad: 'luno_sad', down: 'luno_down', read: 'luno_read', heal: 'luno_heal' },   // down＝立ったまま項垂れる／read＝本を読む／heal＝しゃがんで手当てする
    // sad・sit_sad＝頭を下げて項垂れる（顔の表情ではなく、しぐさで気持ちを見せる）／lie_sad＝目を閉じて伏せる
    flam: { idle: 'flam_idle', sit: 'flam_sit', happy: 'flam_happy', bark: 'flam_bark', sniff: 'flam_sniff', guard: 'flam_guard', injured: 'flam_injured', lie: 'flam_lie', sad: 'flam_sad', sit_sad: 'flam_sad', lie_sad: 'flam_lie_sad' }
  };
  const SETS = {
    mine: { f: 'mine_floor', fi: [0, 3, 0, 0, 3, 3, 0, 3, 0, 3, 1, 0], w: 'mine_wall', wi: [0, 1, 2, 3, 4, 5], natural: true },   // natural：岩の壁・床。マス目を見せずに、なめらかに敷く
    crys: { f: 'crys_floor', fi: [0, 1, 2, 0, 1, 0, 2, 1], w: 'crys_wall', wi: [0, 1, 2, 3], natural: true },
    altar: { f: 'altar_floor', fi: [1, 3, 1, 3, 4, 1, 3, 1, 4, 3, 2, 1], w: 'altar_wall', wi: [0, 1, 2, 3] }
  };

  /* ---------- いつも同じ場所に描く家具・小物（場面の種類ごと）。書き方は下の PRESETS の小物と同じ：[絵の名前, 横位置(マス), 足元の高さ(画面比), 大きさ, オプション]
     オプション：{ dy: 足元からさらに上下へずらす量（マス）, hang: true＝天井から吊るす（足元ではなく上端の位置）, flip: true＝左右反転 } */
  const FIXED = {
    pasture: [   // 牧草地（夕暮れ・朝）
      ['o_fence', 3.2, 0.7, 0.92], ['o_fence', 5.15, 0.7, 0.92], ['o_fence', 7.1, 0.7, 0.92],
      ['o_hay', 1.6, 0.74, 1.0], ['p_rock', 0.5, 1.0, 0.75], ['p_flowers', 10.5, 0.98, 0.9], ['p_flowers', 5.1, 1.0, 0.8]
    ],
    pastureHouse: [9.0, 0.68],   // 牧草地の祖父母の家：[横位置(マス), 足元の高さ(画面比)]
    house: [   // 祖父母の家の中（いちばん上の暖炉は、火の明かりの位置にも使う）
      ['h_fire', 1.45, 0.64, 1.05, { dy: 0.1 }], ['h_shelf', 3.0, 0.64, 1.0, { dy: 0.05 }], ['h_cupboard', 10.35, 0.64, 1.0, { dy: 0.05 }],
      ['h_herbs', 5.4, 0, 0.8, { dy: 0.05, hang: true }]
    ],
    houseRug: [5.5, 0.78, 4.0, 1.2],   // 家の中の敷物：[中心の横位置(マス), 上端の高さ(画面比), 幅(マス), 奥行き(マス)]
    altar: [['stairs', 5.5, 0.62, 1.75]],   // 命の祭壇の奥の階段
    altarCandles: [[2.4, 0.66, 0.9], [8.6, 0.66, 0.9]]   // 命の祭壇の燭台：[横位置(マス), 足元の高さ(画面比), 大きさ]
  };

  /* ---------- 場面の一覧（背景の種類・置く小物・明かり）。小物は [絵の名前, 横位置(マス), 足元の高さ(画面比), 大きさ, オプション] ---------- */
  const PRESETS = {
    dusk_after: { bg: 'sky', mood: 'dusk' },   // 羊を小屋に戻したあと
    dusk: { bg: 'sky', mood: 'dusk', props: [['sheep_graze', 8.3, 0.79, 1.5], ['sheep_lie', 10.7, 0.9, 1.6], ['sheep_idle', 0.9, 0.86, 1.6]] },
    // 序章の回想（三人で羊の世話をしていたころ／アミーナが料理を作って待っていたころ／アミーナとの別れ）
    memo_pasture: { bg: 'sky', mood: 'dawn', memo: true, props: [['sheep_graze', 1.4, 0.8, 1.6], ['sheep_idle', 6.3, 0.83, 1.6, { flip: true }], ['sheep_lie', 9.9, 0.9, 1.6], ['sheep_graze', 10.8, 0.79, 1.4, { flip: true }]] },
    memo_house: { bg: 'house', memo: true, props: [['h_table', 5.4, 0.87, 1.1], ['h_chair', 4.3, 0.86, 1.0], ['h_lantern', 5.6, 0.87, 0.8, { dy: -0.95 }]] },
    memo_amina: { bg: 'memory', memo: true },
    home_dawn: { bg: 'sky', mood: 'dawn' },
    house_in: { bg: 'house', bed: 7.4 },
    house_night: { bg: 'house', bed: 7.4, night: true },   // 夜の祖父母の家
    house_night_desk: { bg: 'house', bed: 7.4, night: true,   // 夜：机の上に日誌と命継ぎの石
      props: [['h_desk', 2.6, 0.87, 1.15], ['i_journal', 1.9, 0.87, 0.5, { dy: -1.2 }], ['life_stone', 3.45, 0.87, 0.6, { dy: -1.25, glow: '230,150,255' }]] },   // dy：机の高さ（マス）だけ上に置く
    house_stone: { bg: 'house', bed: 7.4, pillowStone: true },   // 朝：アルボの枕元に石
    memory: { bg: 'memory' },
    black: { bg: 'black' },
    mine_gate: { bg: 'vista' },   // 廃坑の入口（タイトル画面と同じ、一枚絵の風景）
    mine_dark: { bg: 'cave', set: 'mine', dark: 0.3, tint: '30,12,44,.22', rail: false, lights: [[2.0, 0.5, 3.6, '255,185,105', 0.3]],
      props: [['obs_timber_collapse', 1.0, 0.7, 2.3], ['obs_rocks', 2.2, 0.73, 1.9], ['rail_lantern_post', 9.9, 0.7, 2.0, { lamp: [0.8, 0.44] }]] },
    mine_cart: { bg: 'cave', set: 'mine', dark: 0.18, tint: '30,12,44,.16', rail: true, lights: [[8.0, 0.3, 4.2, '255,200,120', 0.22]],
      props: [['obs_tall_rock', 9.8, 0.72, 1.8], ['trolley_rig', 7.0, 0.72, 1.7], ['rail_lantern_post', 0.7, 0.7, 2.0, { lamp: [0.8, 0.44] }]] },
    waterway: { bg: 'cave', set: 'mine', water: true, horizon: 0.46, dark: 0.2, tint: '10,30,60,.2', lights: [[5.5, 0.3, 4.4, '140,200,255', 0.14]],
      props: [['gate_closed', 8.6, 0.6, 1.5], ['obs_mossy_rocks', 0.9, 0.62, 1.5]] },
    lair: { bg: 'cave', set: 'mine', dark: 0.34, tint: '40,16,30,.22', lights: [[8.2, 0.55, 4.0, '255,150,80', 0.16]],
      props: [['obs_stalagmite', 1.0, 0.64, 1.8], ['obs_stalagmite', 10.0, 0.62, 1.6], ['obs_rocks', 6.2, 0.68, 1.4], ['obs_rocks', 9.6, 0.88, 1.2]] },
    crys_cave: { bg: 'cave', set: 'crys', dark: 0.18, tint: '20,40,90,.22', motes: '150,215,255', lights: [[5.5, 0.4, 5, '120,190,255', 0.18]],
      props: [['stalactite', 2.2, 0.1, 1.7, { hang: true }], ['stalactite', 5.0, 0.1, 1.4, { hang: true }], ['stalactite', 9.4, 0.1, 1.8, { hang: true }],
        ['obs_crystal_stalagmite', 9.9, 0.7, 2.0, { glow: '120,200,255' }], ['crystal_big', 1.2, 0.66, 1.4, { glow: '120,200,255' }], ['crystal_tall', 10.2, 0.88, 1.2, { glow: '120,200,255' }], ['door_open', 7.4, 0.62, 1.15]] },
    crys_secret: { bg: 'cave', set: 'crys', dark: 0.42, tint: '10,20,50,.3', motes: '160,255,210', lights: [[5.6, 0.62, 3.4, '130,255,200', 0.3]], desk: [5.6, 0.7],
      props: [['crystal_rock', 1.1, 0.66, 1.2, { glow: '120,200,255' }], ['crystal_mid', 10.2, 0.66, 1.2, { glow: '120,200,255' }]] },
    miners_rest: { bg: 'cave', set: 'mine', dark: 0.22, tint: '60,30,10,.18', lights: [[3.4, 0.4, 4.6, '255,190,100', 0.3], [8.5, 0.4, 3.6, '255,190,100', 0.2]],
      props: [['frame_c', 7.8, 0.66, 1.6], ['obs_lantern_post', 1.0, 0.7, 1.8, { lamp: [0.84, 0.36] }], ['r_crates', 10.2, 0.72, 0.95], ['r_barrel', 9.1, 0.73, 0.9],
        ['h_table', 4.7, 0.75, 1.0], ['h_chair', 3.6, 0.745, 0.95], ['h_chair', 5.9, 0.745, 0.95, { flip: true }], ['r_candle', 4.4, 0.75, 0.8, { dy: -0.95, glow: '255,190,110' }], ['i_journal', 5.1, 0.75, 0.3, { dy: -0.93 }], ['r_bench', 1.9, 0.8, 1.0], ['r_crates2', 6.6, 0.69, 0.75]] },
    collapse: { bg: 'cave', set: 'mine', dark: 0.34, tint: '30,16,10,.26', dust: true, lights: [[3.0, 0.4, 3.8, '255,190,110', 0.18]],
      props: [['obs_timber_collapse', 8.8, 0.72, 2.3], ['obs_pillar_ruin', 10.3, 0.76, 1.3], ['obs_rocks', 6.6, 0.8, 1.2]] },
    lamp_hall: { bg: 'cave', set: 'altar', dark: 0.38, tint: '20,12,40,.3', lamps: [0, 0, 0], plaque: [6.4, 0.34],
      props: [] },
    cavern: { bg: 'cave', set: 'mine', dark: 0.5, tint: '14,6,30,.34', horizon: 0.64, motes: '120,160,255',
      props: [['stalactite', 1.6, 0.1, 1.9, { hang: true }], ['stalactite', 4.4, 0.1, 1.5, { hang: true }], ['stalactite', 6.8, 0.1, 2.0, { hang: true }], ['stalactite', 9.6, 0.1, 1.6, { hang: true }],
        ['obs_stalagmite', 0.8, 0.66, 1.7], ['obs_stalagmite', 10.2, 0.66, 1.8]] },
    altar: { bg: 'cave', set: 'altar', dark: 0.3, tint: '40,10,60,.2', motes: '255,200,255', altar: true },
    return_path: { bg: 'cave', set: 'mine', dark: 0.26, tint: '30,14,30,.2', lights: [[8.4, 0.45, 4.4, '255,220,160', 0.32]],
      props: [['cave_stairs', 8.4, 0.66, 2.1], ['obs_lantern_post', 1.2, 0.72, 1.7, { lamp: [0.84, 0.36] }]] }
  };

  window.StageData = { ST, POSE, SETS, PRESETS, FIXED };
})();
