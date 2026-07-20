// main.js — 게임 부트스트랩.

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  const audio = new AudioManager();
  const input = new InputManager();
  const game = new Game(canvas, audio, input);
  window.__GAME__ = game;

  const hint = document.getElementById('audio-hint');
  audio.loadAll(AUDIO_MANIFEST).then(() => {
    if (hint) hint.textContent = '오디오 준비 완료! ENTER 를 눌러 시작하세요.';
  }).catch(() => {
    if (hint) hint.textContent = '오디오를 불러오지 못했습니다. 사운드 없이 진행됩니다.';
  });

  const muteBtn = document.getElementById('mute-btn');
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      const muted = audio.toggleMuted();
      muteBtn.textContent = muted ? '🔇' : '🔊';
      canvas.focus();
    });
  }

  canvas.addEventListener('click', () => canvas.focus());
  canvas.setAttribute('tabindex', '0');

  game.run();
});
