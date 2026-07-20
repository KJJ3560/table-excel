// input.js — 키보드 + 터치 입력을 하나의 상태 객체로 모은다.

class InputManager {
  constructor() {
    this.left = false;
    this.right = false;
    this.run = false;
    this.jumpHeld = false;
    this.jumpPressed = false;

    this.pausePressed = false;
    this.mutePressed = false;
    this.startPressed = false;
    this.downHeld = false;

    this._jumpKeyDown = false;
    this._touchJump = false;
    this._prevJumpKey = false;
    this._pauseQueued = false;
    this._muteQueued = false;
    this._startQueued = false;

    window.addEventListener('keydown', (e) => this._onKey(e, true));
    window.addEventListener('keyup', (e) => this._onKey(e, false));

    this._bindTouchButton('touch-left', 'left');
    this._bindTouchButton('touch-right', 'right');
    this._bindTouchButton('touch-jump', 'jump');
  }

  _bindTouchButton(id, action) {
    const el = document.getElementById(id);
    if (!el) return;
    const setter = (v) => (e) => {
      e.preventDefault();
      if (action === 'left') this.left = v;
      else if (action === 'right') this.right = v;
      else if (action === 'jump') this._touchJump = v;
    };
    el.addEventListener('touchstart', setter(true), { passive: false });
    el.addEventListener('touchend', setter(false), { passive: false });
    el.addEventListener('touchcancel', setter(false), { passive: false });
    el.addEventListener('mousedown', setter(true));
    el.addEventListener('mouseup', setter(false));
    el.addEventListener('mouseleave', setter(false));
  }

  _onKey(e, isDown) {
    const code = e.code;
    const handled = new Set([
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS',
      'Space', 'KeyZ', 'ShiftLeft', 'ShiftRight', 'KeyP', 'Escape', 'KeyM', 'Enter', 'KeyX',
    ]);
    if (handled.has(code)) e.preventDefault();
    if (e.repeat) {
      // 길게 눌러도 새로운 '단발성' 입력으로 취급하지 않는다.
      if (code === 'ArrowLeft' || code === 'KeyA') this.left = isDown;
      if (code === 'ArrowRight' || code === 'KeyD') this.right = isDown;
      return;
    }

    if (code === 'ArrowLeft' || code === 'KeyA') this.left = isDown;
    if (code === 'ArrowRight' || code === 'KeyD') this.right = isDown;
    if (code === 'ArrowDown' || code === 'KeyS') this.downHeld = isDown;
    if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyX') this.run = isDown;
    if (code === 'ArrowUp' || code === 'Space' || code === 'KeyW' || code === 'KeyZ') {
      this._jumpKeyDown = isDown;
    }
    if (isDown && code === 'KeyP') this._pauseQueued = true;
    if (isDown && code === 'Escape') this._pauseQueued = true;
    if (isDown && code === 'KeyM') this._muteQueued = true;
    if (isDown && code === 'Enter') this._startQueued = true;
  }

  // 매 프레임 루프 시작 시 호출: '이번 프레임에 새로 눌림' 판정을 갱신한다.
  update() {
    const jumpKey = this._jumpKeyDown || this._touchJump;
    this.jumpPressed = jumpKey && !this._prevJumpKey;
    this.jumpHeld = jumpKey;
    this._prevJumpKey = jumpKey;

    this.pausePressed = this._pauseQueued;
    this._pauseQueued = false;
    this.mutePressed = this._muteQueued;
    this._muteQueued = false;
    this.startPressed = this._startQueued;
    this._startQueued = false;
  }
}
