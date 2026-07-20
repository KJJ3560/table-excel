// audio.js — Web Audio API 기반 사운드 매니저.
// assets/audio/*.wav 를 미리 디코딩해두고, 재생할 때마다 새 BufferSource를
// 만들어 여러 효과음이 겹쳐도(동전 연속 획득 등) 자연스럽게 들리게 한다.

class AudioManager {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.currentMusicSrc = null;
    this.currentMusicName = null;
    this.muted = false;
    this.ready = false;

    this._resume = this._resume.bind(this);
    window.addEventListener('keydown', this._resume);
    window.addEventListener('pointerdown', this._resume);
  }

  _ensureContext() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 1;
    this.masterGain.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.55;
    this.musicGain.connect(this.masterGain);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.85;
    this.sfxGain.connect(this.masterGain);
  }

  _resume() {
    this._ensureContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  async load(name, url) {
    this._ensureContext();
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    const buf = await this.ctx.decodeAudioData(arr);
    this.buffers[name] = buf;
  }

  async loadAll(manifest) {
    this._ensureContext();
    const entries = Object.entries(manifest);
    await Promise.all(entries.map(([name, url]) => this.load(name, url).catch((err) => {
      console.warn('오디오 로드 실패:', name, err);
    })));
    this.ready = true;
  }

  play(name, { volume = 1, rate = 1, loop = false } = {}) {
    if (!this.ctx || !this.buffers[name]) return null;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[name];
    src.loop = loop;
    src.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(loop ? this.musicGain : this.sfxGain);
    src.start(0);
    return src;
  }

  playMusic(name, volume = 1) {
    if (this.currentMusicName === name && this.currentMusicSrc) return;
    this.stopMusic();
    this.currentMusicSrc = this.play(name, { volume, loop: true });
    this.currentMusicName = name;
  }

  stopMusic() {
    if (this.currentMusicSrc) {
      try { this.currentMusicSrc.stop(); } catch (e) { /* 이미 정지된 경우 무시 */ }
      this.currentMusicSrc = null;
      this.currentMusicName = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.masterGain) this.masterGain.gain.value = muted ? 0 : 1;
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }
}

const AUDIO_MANIFEST = {
  bgm_overworld: 'assets/audio/bgm_overworld.wav',
  jump: 'assets/audio/jump.wav',
  coin: 'assets/audio/coin.wav',
  stomp: 'assets/audio/stomp.wav',
  bump: 'assets/audio/bump.wav',
  break_block: 'assets/audio/break_block.wav',
  powerup: 'assets/audio/powerup.wav',
  hurt: 'assets/audio/hurt.wav',
  death: 'assets/audio/death.wav',
  flagpole: 'assets/audio/flagpole.wav',
  level_clear: 'assets/audio/level_clear.wav',
  game_over: 'assets/audio/game_over.wav',
  one_up: 'assets/audio/one_up.wav',
  select: 'assets/audio/select.wav',
};
