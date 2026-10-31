/* ==========================================================================
   audio.js ― BGM・効果音の設定（「BGM・効果音シート」から tools/make_audio_js.py（xlsx）または tools/audio_from_dump.py（書き出したテキスト）で作る）
   ・BGM：場面ごとに流す曲。file が空＝前の曲をそのまま流す／'なし'＝止める。同じファイルが続くときは、曲を切らずに流し続ける
   ・SE ：効果音。file が空＝今の仮の音（プログラムで作った音）を鳴らす
   ・音のファイルは assets/audio/ に置くと、組み立て（build.js）のときにゲームの中へ埋め込まれる
   ========================================================================== */
window.AUDIO = {
 "BGM": {
  "title": {
   "file": "kamatamago_B00152_Along-the-riverside-road.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  },
  "s0_dusk": {
   "file": "kamatamago_B00017_kaettekita-furusato.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  },
  "s0_house": {
   "file": "kamatamago_B00017_kaettekita-furusato.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  },
  "s0_night": {
   "file": "kamatamago_B00012_sinpitekina-tenkuu.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  },
  "sec1": {
   "file": "kamatamago_B00215_Decaying-place.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  },
  "sec2": {
   "file": "kamatamago_B00215_Decaying-place.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  },
  "puzzle": {
   "file": "kamatamago_B00215_Decaying-place.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  },
  "sec3": {
   "file": "kamatamago_B00138_jungle-back-the-village.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  },
  "battle": {
   "file": "kamatamago_B00083_military-research-facility.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  },
  "sec4": {
   "file": "kamatamago_B00068_kamigamiga-nemuru-basyo.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  },
  "sec5": {
   "file": "kamatamago_B00068_kamigamiga-nemuru-basyo.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  },
  "sec6": {
   "file": "kamatamago_B00068_kamigamiga-nemuru-basyo.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  },
  "sec7": {
   "file": "kamatamago_B00020_sinpitekina-kuukan.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  },
  "sec8": {
   "file": "kamatamago_B00144_Mysterious-temple.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  },
  "boss": {
   "file": "kamatamago_B00225_top-secret-facility.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  },
  "boss2": {
   "file": "kamatamago_B00225_top-secret-facility.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  },
  "sec9": {
   "file": "kamatamago_B00111_Forgotten-temple.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  },
  "short": {
   "file": "kamatamago_B00095_Escape-from-the-ruins.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  },
  "sec10": {
   "file": "kamatamago_B00072_Universe.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  },
  "memory": {
   "file": "kamatamago_B00072_Universe.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  },
  "gameover": {
   "file": "kamatamago_B00157_wandering.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  },
  "e1": {
   "file": "kamatamago_B00116_Nostalgic-memories_musicbox.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  },
  "e2": {
   "file": "kamatamago_B00113_What-you-taught-me-that-day.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  },
  "e3": {
   "file": "kamatamago_B00050_mayoi.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  },
  "e4": {
   "file": "kamatamago_B00085_Falling-things.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  },
  "e_timeout": {
   "file": "kamatamago_B00157_wandering.mp3",
   "vol": 40,
   "loop": true,
   "fade": 1.0
  }
 },
 "SE": {
  "click": {
   "file": "決定・選択.mp3",
   "vol": 80
  },
  "warn": {
   "file": "不可の時.mp3",
   "vol": 80
  },
  "gauge": {
   "file": "ダメージ.mp3",
   "vol": 80,
   "alt": {
    "bad": "ダメージ.mp3",
    "good": "回復時.mp3"
   }
  },
  "bump": {
   "file": "進行不能.mp3",
   "vol": 80
  },
  "push": {
   "file": "重いものを引きずる.mp3",
   "vol": 80
  },
  "plate": {
   "file": "軽い成功音.mp3",
   "vol": 80
  },
  "lever": {
   "file": "レバー音.mp3",
   "vol": 80
  },
  "rot": {
   "file": "ひねる音.mp3",
   "vol": 80
  },
  "lit": {
   "file": "軽い成功音.mp3",
   "vol": 80
  },
  "open": {
   "file": "ゴゴゴゴ.mp3",
   "vol": 80
  },
  "win": {
   "file": "成功音.mp3",
   "vol": 80
  },
  "item": {
   "file": "ゴゴゴゴ.mp3",
   "vol": 80,
   "alt": {
    "hidden": "隠し部屋.mp3"
   }
  },
  "splash": {
   "file": "水に潜る.mp3",
   "vol": 80
  },
  "bark": {
   "file": "犬の鳴き声1.mp3",
   "vol": 80,
   "pick": [
    "犬の鳴き声1.mp3",
    "犬の鳴き声2.mp3",
    "犬の鳴き声3.mp3",
    "犬の鳴き声4.mp3"
   ]
  },
  "crumble": {
   "file": "ゴゴゴゴ.mp3",
   "vol": 80
  },
  "hit": {
   "file": "打撃3.mp3",
   "vol": 80
  },
  "miss": {
   "file": "回避.mp3",
   "vol": 80
  },
  "heal": {
   "file": "回復(戦闘）.mp3",
   "vol": 80
  },
  "alarm": {
   "file": "警告.mp3",
   "vol": 80
  },
  "lose": {
   "file": "ゲームオーバー.mp3",
   "vol": 80
  },
  "sad": {
   "file": "タイムオーバー.mp3",
   "vol": 80
  },
  "glow": {
   "file": "結末.mp3",
   "vol": 80
  }
 }
};
