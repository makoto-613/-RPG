/* ==========================================================================
   sound.js ― 効果音とBGM（audio.js で決めた音のファイルを鳴らす。ファイルがない効果音は、Web Audio で作る仮の音）
   ========================================================================== */
(function () {
  'use strict';

  /* ★ 調整用の数値 */
  const SND = {
    VOL: 0.2,          // 仮の合成音の大きさ（0〜1）
    ONSET: 0.25,       // 効果音の頭の、ほぼ無音の部分を飛ばして鳴らす（いちばん大きい所のこの割合に届くまでを飛ばす）。操作とのズレを減らす
    CUT_FADE: 0.25,    // 台詞を送ったときなどに、鳴っている効果音を消していく秒数
    SOLO: { baa: true },   // ここに書いた効果音は、鳴っている間に同じ音を重ねない（鳴り終わってから、次の操作でまた鳴る）
    // 効果音ごとの、鳴らす長さの上限（秒）。長い音がいつまでも続かないように、ここで止める（フェードして消す）。書いていない音は最後まで鳴らす
    MAX_SEC: { push: 0.9, open: 3.0, crumble: 2.5, item: 2.2, bark: 1.6, heal: 1.6, win: 2.2, glow: 4.5, sad: 4.0, lose: 2.4, splash: 1.3, 'item:hidden': 3.5 }
  };

  let AC = null;
  const S = { enabled: true, bgm: true, seVol: 1, bgmVol: 1 };   // enabled＝効果音、bgm＝BGM（メニューで切り替え）。seVol・bgmVol＝設定の音量バー（0〜1。シートの音量にかける）

  function ac() {
    try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { AC = null; }
    return AC;
  }
  function tone(t0, f0, f1, d, type, v) {
    const a = AC, o = a.createOscillator(), g = a.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + d);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v * SND.VOL * S.seVol), t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + d + 0.03);
  }
  function noise(t0, d, v, f) {
    const a = AC, n = Math.floor(a.sampleRate * d), b = a.createBuffer(1, n, a.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource(); s.buffer = b; const fl = a.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = f || 1200;
    const g = a.createGain(); g.gain.value = v * SND.VOL * S.seVol; s.connect(fl); fl.connect(g); g.connect(a.destination); s.start(t0);
  }
  const SFX = {
    bump: (t) => tone(t, 150, 70, 0.12, 'sine', 1), push: (t) => noise(t, 0.09, 0.8, 500), click: (t) => tone(t, 700, 500, 0.05, 'square', 0.3),
    plate: (t) => tone(t, 330, 440, 0.1, 'triangle', 0.8), plateoff: (t) => tone(t, 440, 300, 0.1, 'triangle', 0.6),
    lever: (t) => { tone(t, 200, 320, 0.14, 'sawtooth', 0.4); noise(t, 0.1, 0.4, 800); }, rot: (t) => tone(t, 520, 700, 0.07, 'triangle', 0.7),
    swap: (t) => tone(t, 440, 660, 0.08, 'square', 0.3), give: (t) => tone(t, 520, 880, 0.2, 'sine', 0.9),
    baa: (t) => { tone(t, 520, 470, 0.22, 'sawtooth', 0.35); tone(t + 0.2, 500, 430, 0.35, 'sawtooth', 0.3); },   // 羊（ファイルがないときの仮の音）
    lit: (t) => [660, 880, 1320].forEach((f, i) => tone(t + i * 0.07, f, 0, 0.25, 'sine', 0.6)),
    open: (t) => { noise(t, 0.5, 0.7, 300); tone(t + 0.1, 220, 330, 0.5, 'triangle', 0.5); [523, 784].forEach((f, i) => tone(t + 0.3 + i * 0.12, f, 0, 0.3, 'sine', 0.5)); },
    win: (t) => [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.12, f, 0, 0.35, 'triangle', 0.7)),
    crumble: (t) => { noise(t, 0.7, 1, 700); tone(t, 90, 40, 0.5, 'sawtooth', 0.5); },
    bark: (t) => { tone(t, 380, 200, 0.12, 'sawtooth', 0.5); tone(t + 0.16, 360, 190, 0.12, 'sawtooth', 0.5); },
    splash: (t) => noise(t, 0.35, 0.8, 2500), item: (t) => [880, 1175, 1568].forEach((f, i) => tone(t + i * 0.08, f, 0, 0.3, 'sine', 0.6)),
    warn: (t) => tone(t, 300, 200, 0.2, 'square', 0.4),
    // ここから下は、ノベル・戦闘で増えた音
    tick: (t) => tone(t, 880, 0, 0.025, 'square', 0.08),
    hit: (t) => { noise(t, 0.12, 0.9, 900); tone(t, 220, 90, 0.12, 'sawtooth', 0.6); },
    miss: (t) => tone(t, 500, 250, 0.15, 'triangle', 0.5),
    heal: (t) => [523, 659, 880].forEach((f, i) => tone(t + i * 0.09, f, 0, 0.3, 'sine', 0.6)),
    alarm: (t) => [0, 0.22].forEach((d) => tone(t + d, 660, 520, 0.18, 'square', 0.45)),
    sad: (t) => [440, 392, 330].forEach((f, i) => tone(t + i * 0.22, f, 0, 0.5, 'sine', 0.5)),
    lose: (t) => [392, 330, 262, 196].forEach((f, i) => tone(t + i * 0.18, f, 0, 0.4, 'triangle', 0.6)),
    glow: (t) => [392, 523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.1, f, 0, 0.6, 'sine', 0.5)),
    gauge: (t) => tone(t, 300, 360, 0.08, 'sine', 0.5)
  };
  const CFG = () => window.AUDIO || { BGM: {}, SE: {} };
  const FILE = (name) => (window.AUDIO_FILES || {})[name] || null;
  const warned = new Set(), warnOnce = (k, f) => { if (warned.has(f)) return; warned.add(f); console.warn(k, f); };   // まだ入っていない音は、1回だけ知らせる   // 埋め込んだ音のファイル（名前 → データ）
  // sfx(名前, 場合)：場合（'bad'／'good'／'hidden' など）があれば、シートでその場合に決めた音を鳴らす。何種類かあるときは毎回1つを選ぶ
  let lastPick = {};
  function seFile(e, v) {
    if (!e) return '';
    if (v && e.alt && e.alt[v]) return e.alt[v];
    if (e.pick && e.pick.length > 1) { let i = Math.floor(Math.random() * e.pick.length); if (i === lastPick[e.file]) i = (i + 1) % e.pick.length; lastPick[e.file] = i; return e.pick[i]; }   // 同じ音が続かないように
    return e.file;
  }
  /* 効果音のファイルは、最初の操作のときに前もって読み込んで（デコードして）おく。鳴らすたびに読み込むと、操作より音が遅れるため */
  const BUF = {}, LOADING = {}, ACTIVE = new Set();
  function decodeFile(name) {
    const a = ac(), url = FILE(name); if (!a || !url || BUF[name] || LOADING[name]) return LOADING[name] || null;
    LOADING[name] = fetch(url).then((r) => r.arrayBuffer()).then((ab) => new Promise((res, rej) => a.decodeAudioData(ab, res, rej))).then((b) => {
      const ch = b.getChannelData(0); let pk = 0; for (let i = 0; i < ch.length; i += 4) pk = Math.max(pk, Math.abs(ch[i]));
      let on = 0; const th = pk * SND.ONSET; for (let i = 0; i < ch.length; i++) if (Math.abs(ch[i]) > th) { on = i; break; }
      BUF[name] = { b, off: Math.max(0, on / b.sampleRate - 0.012) };
    }).catch(() => { /* 読めないときは、毎回ファイルから鳴らす */ });
    return LOADING[name];
  }
  function preloadSe() { const SE = CFG().SE || {}; Object.keys(SE).forEach((k) => { const e = SE[k]; [e.file, ...Object.values(e.alt || {}), ...(e.pick || [])].forEach((f) => { if (f && FILE(f)) decodeFile(f); }); }); }
  // 鳴っている効果音を、すぐに（少しフェードして）止める。台詞を送ったとき・場面が変わったときに呼ぶ
  function cutSe(sec) {
    const a = AC, fs = sec == null ? SND.CUT_FADE : sec;
    ACTIVE.forEach((x) => { try { if (x.g && a) { x.g.gain.cancelScheduledValues(a.currentTime); x.g.gain.setValueAtTime(x.g.gain.value, a.currentTime); x.g.gain.linearRampToValueAtTime(0, a.currentTime + fs); x.src.stop(a.currentTime + fs + 0.02); } else if (x.el) { x.el.pause(); } } catch (e) { /* 無視 */ } });
    ACTIVE.clear();
  }
  function playFile(n, v, f, vol) {
    const a = ac(), d = BUF[f], max = SND.MAX_SEC[n + ':' + v] || SND.MAX_SEC[n];
    if (a && d) {
      const src = a.createBufferSource(), g = a.createGain(); src.buffer = d.b; g.gain.value = vol; src.connect(g); g.connect(a.destination);
      const t = a.currentTime, x = { src, g, n }; src.start(t, d.off);
      if (max && d.b.duration - d.off > max) { g.gain.setValueAtTime(vol, t + max - 0.3); g.gain.linearRampToValueAtTime(0, t + max); src.stop(t + max + 0.02); }
      ACTIVE.add(x); src.onended = () => ACTIVE.delete(x);
      return;
    }
    decodeFile(f);   // まだ読み込めていない：今回だけはファイルから直接鳴らす
    try { const el = new Audio(FILE(f)), x = { el, n }; el.volume = vol; el.play().catch(() => {}); ACTIVE.add(x); el.onended = () => ACTIVE.delete(x); if (max) setTimeout(() => { el.pause(); ACTIVE.delete(x); }, max * 1000); } catch (e) { /* 無視 */ }
  }
  const SYN_UNTIL = {};   // 仮の合成音を鳴らしているあいだ（重ねない音のため）
  function playing(n) { for (const x of ACTIVE) if (x.n === n) return true; return (SYN_UNTIL[n] || 0) > performance.now(); }
  function sfx(n, v) {
    if (!S.enabled) return;
    if (SND.SOLO[n] && playing(n)) return;   // 鳴っている最中は鳴らさない
    const e0 = CFG().SE[n], f = seFile(e0, v), e = e0 && Object.assign({}, e0, { file: f }), url = f ? FILE(f) : null;
    if (url) { playFile(n, v, f, Math.max(0, Math.min(1, (e.vol == null ? 60 : e.vol) / 100 * S.seVol))); return; }   // シートで決めた音
    if (e && e.file && !FILE(e.file)) warnOnce('効果音のファイルがまだありません:', e.file);
    const a = ac(); if (!a) return; try { SFX[n](a.currentTime); if (SND.SOLO[n]) SYN_UNTIL[n] = performance.now() + 600; } catch (x) { /* 音が出なくても進行には影響しない */ }
  }

  /* ---------------- BGM ---------------- */
  const B = { el: null, file: '', key: '', vol: 0, fadeId: null, pending: false };
  function fadeEl(el, to, sec, done) {
    const from = el.volume, t0 = performance.now(), ms = Math.max(1, sec * 1000);
    const step = () => { const q = Math.min(1, (performance.now() - t0) / ms); el.volume = Math.max(0, Math.min(1, from + (to - from) * q)); if (q < 1) requestAnimationFrame(step); else if (done) done(); };
    step();
  }
  function stopBgm(sec) { const el = B.el; B.el = null; B.file = ''; if (el) fadeEl(el, 0, sec == null ? 0.8 : sec, () => { el.pause(); }); }
  // 場面の ID（audio.js の BGM）に合わせて曲を切り替える
  function bgm(key) {
    const e = CFG().BGM[key]; B.key = key;
    if (!e || !e.file) return;                       // 空欄：前の曲をそのまま
    if (e.file === 'なし') { stopBgm(e.fade); return; }
    const url = FILE(e.file); if (!url) { warnOnce('BGMのファイルがまだありません:', e.file); return; }
    const vol = Math.max(0, Math.min(1, (e.vol == null ? 60 : e.vol) / 100));
    if (B.file === e.file && B.el) { B.vol = vol; fadeEl(B.el, S.bgm ? vol * S.bgmVol : 0, 0.5); return; }   // 同じ曲：切らずに流し続ける
    stopBgm(e.fade);
    const el = new Audio(url); el.loop = e.loop !== false; el.volume = 0; B.el = el; B.file = e.file; B.vol = vol;
    el.play().then(() => { if (B.el === el) fadeEl(el, S.bgm ? vol * S.bgmVol : 0, e.fade == null ? 1 : e.fade); }).catch(() => { B.pending = true; });   // 最初の操作の前は鳴らせない
  }
  function unlock() { ac(); preloadSe(); if (B.pending && B.el) { B.pending = false; const el = B.el; el.play().then(() => fadeEl(el, S.bgm ? B.vol * S.bgmVol : 0, 0.8)).catch(() => { B.pending = true; }); } }
  function setBgmOn(on) { S.bgm = !!on; if (B.el) fadeEl(B.el, S.bgm ? B.vol * S.bgmVol : 0, 0.3); }
  function setBgmVol(q) { S.bgmVol = Math.max(0, Math.min(1, q)); if (B.el && S.bgm) B.el.volume = B.vol * S.bgmVol; }   // 音量バーを動かしたとき（すぐ反映）
  ['pointerdown', 'keydown'].forEach((t) => window.addEventListener(t, unlock, true));

  window.Sound = { ac, sfx, cutSe, preloadSe, seLoaded: () => Object.keys(BUF).length, seActive: () => ACTIVE.size, bgm, stopBgm, setBgmOn, setBgmVol, unlock, S, SND, state: B };
})();
