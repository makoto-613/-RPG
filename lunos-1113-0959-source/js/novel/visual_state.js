/* 進み具合で見た目が変わる物（廃坑の入口・机や祭壇や枕元の石）の状態を決める。画面に依存しない */
(function () {
  'use strict';
  const STATEFUL_SCENES = Object.freeze([
    'mine_gate',
    'crys_secret',
    'altar',
    'house_night_desk',
    'house_stone'
  ]);
  function snapshot(scene, flags, local) {
    flags = flags || {};
    local = local || {};
    return Object.freeze({
      scene,
      mineGateOpen: scene === 'mine_gate' && (local.gate === 'gate_unlocked' || !!flags.mineGateUnlocked),
      houseDeskCleared: scene === 'house_night_desk' && !!local.deskOff,
      // 祭壇の石は、物語で取るまで祭壇の上にある
      altarStonePresent: !(scene === 'altar' && (local.altarStoneTaken || !!flags.stone)),
      pillowStonePresent: scene === 'house_stone' && !!local.pillowStone
    });
  }
  window.VisualState = { STATEFUL_SCENES, snapshot };
})();
