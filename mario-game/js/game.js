// game.js — 메인 게임 루프, 물리/충돌, 상태 머신, 렌더링을 담당하는 엔진.

function aabbOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function drawCloud(ctx, x, y) {
  const parts = [[0, 0, 26, 16], [22, -8, 20, 14], [44, 0, 24, 15]];
  parts.forEach(([ddx, ddy, rx, ry]) => {
    ctx.beginPath();
    ctx.ellipse(x + ddx, y + ddy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawHill(ctx, x, baseY, w, h) {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, baseY);
  ctx.quadraticCurveTo(x, baseY - h, x + w / 2, baseY);
  ctx.closePath();
  ctx.fill();
}

function drawBush(ctx, x, y, w, color) {
  ctx.fillStyle = color;
  [0, 0.35, 0.7].forEach((t) => {
    ctx.beginPath();
    ctx.ellipse(x + w * t, y, w * 0.34, w * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

class Game {
  constructor(canvas, audio, input) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.audio = audio;
    this.input = input;

    this.state = 'start';
    this.stateTimer = 0;
    this.flagPhase = null;

    this.levelIndex = 0;
    this.level = null;
    this.player = null;

    this.score = 0;
    this.coins = 0;
    this.lives = 3;
    this.time = 0;
    this.camX = 0;
    this.levelClearBonus = 0;
    this.highScore = this._loadHighScore();

    this._lastTs = null;
    this._raf = (ts) => this.loop(ts);

    this._loadLevelDef(0);
  }

  _loadHighScore() {
    try { return Number(localStorage.getItem('plumberquest_hiscore') || 0); } catch (e) { return 0; }
  }

  _saveHighScore() {
    try { localStorage.setItem('plumberquest_hiscore', String(this.highScore)); } catch (e) { /* 저장 불가 환경 무시 */ }
  }

  _loadLevelDef(index) {
    this.levelIndex = index;
    this.level = buildLevel(LEVELS[index]);
    this.player = new Player(this.level.playerStart.x, this.level.playerStart.y);
    this.time = this.level.timeLimit;
    this.camX = 0;
    this.flagPhase = null;
  }

  _playLevelMusic() {
    this.audio.playMusic('bgm_overworld', 0.5);
    if (this.level.themeKey === 'underground' && this.audio.currentMusicSrc) {
      this.audio.currentMusicSrc.playbackRate.value = 0.92;
    }
  }

  startNewGame() {
    this.score = 0;
    this.coins = 0;
    this.lives = 3;
    this._loadLevelDef(0);
    this.state = 'playing';
    this.stateTimer = 0;
    this._playLevelMusic();
  }

  run() {
    requestAnimationFrame(this._raf);
  }

  loop(ts) {
    if (this._lastTs == null) this._lastTs = ts;
    let dt = (ts - this._lastTs) / 1000;
    this._lastTs = ts;
    dt = Math.min(dt, 1 / 30);
    this.input.update();
    this.update(dt);
    this.render();
    requestAnimationFrame(this._raf);
  }

  // -------------------------------------------------------------------
  // 업데이트
  // -------------------------------------------------------------------

  update(dt) {
    if (this.player && this.player.invincible > 0) {
      this.player.invincible = Math.max(0, this.player.invincible - dt);
    }
    if (this.input.mutePressed) this.audio.toggleMuted();

    switch (this.state) {
      case 'start': this._updateStart(dt); break;
      case 'playing': this._updatePlaying(dt); break;
      case 'flagseq': this._updateFlagSeq(dt); break;
      case 'dying': this._updateDying(dt); break;
      case 'levelclear': this._updateLevelClear(dt); break;
      case 'gameover': this._updateGameOver(dt); break;
      case 'win': this._updateWin(dt); break;
      case 'paused': this._updatePaused(dt); break;
      default: break;
    }
  }

  _updateStart(dt) {
    this.stateTimer += dt;
    if (this.input.startPressed) this.startNewGame();
  }

  _updatePaused(dt) {
    if (this.input.pausePressed) this.state = 'playing';
  }

  _updatePlaying(dt) {
    if (this.input.pausePressed) { this.state = 'paused'; return; }

    this.time = Math.max(0, this.time - dt);

    this._updatePlayerControl(dt);
    this._movePlayerAndCollide(dt);
    this._handlePlayerEnemyCollisions();
    this._handlePlayerCoinCollisions();
    this._updateEnemies(dt);
    this._updateItems(dt);
    this._updateBlockTimers(dt);
    this._updateParticlesAndPopups(dt);
    this._updateCamera();

    const fp = this.level.flagpole;
    if (!fp.touched && aabbOverlap(this.player, fp)) {
      this._beginFlagSequence();
      return;
    }
    if (this.player.y > KILL_Y) { this._startDying(); return; }
    if (this.time <= 0) { this._startDying(); return; }
  }

  _updatePlayerControl(dt) {
    const p = this.player;
    if (!p.controllable) {
      p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL_SPEED);
      return;
    }
    const input = this.input;
    const speedCap = input.run ? RUN_SPEED : MOVE_SPEED;
    const accel = p.onGround ? ACCEL : AIR_ACCEL;

    if (input.left && !input.right) {
      p.vx = Math.max(p.vx - accel * dt, -speedCap);
      p.facing = -1;
    } else if (input.right && !input.left) {
      p.vx = Math.min(p.vx + accel * dt, speedCap);
      p.facing = 1;
    } else if (p.onGround) {
      const fr = FRICTION * dt;
      if (p.vx > 0) p.vx = Math.max(0, p.vx - fr);
      else if (p.vx < 0) p.vx = Math.min(0, p.vx + fr);
    }

    p.coyote = p.onGround ? COYOTE_TIME : Math.max(0, p.coyote - dt);
    p.jumpBuffer = input.jumpPressed ? JUMP_BUFFER : Math.max(0, p.jumpBuffer - dt);

    if (p.jumpBuffer > 0 && p.coyote > 0) {
      p.vy = input.run ? RUN_JUMP_VELOCITY : JUMP_VELOCITY;
      p.onGround = false;
      p.coyote = 0;
      p.jumpBuffer = 0;
      this.audio.play('jump', { volume: 0.55 });
    }
    if (!input.jumpHeld && p.vy < 0) {
      p.vy *= JUMP_CUT_MULT;
    }

    p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL_SPEED);
    if (Math.abs(p.vx) > 4 && p.onGround) p.animTime += dt;
  }

  _moveAndCollideX(ent, dt) {
    ent.x += ent.vx * dt;
    const dir = Math.sign(ent.vx);
    if (dir === 0) return null;
    const minRow = Math.max(0, Math.floor(ent.top / TILE));
    const maxRow = Math.min(this.level.rows - 1, Math.floor((ent.bottom - 1) / TILE));
    const col = dir > 0 ? Math.floor((ent.right - 1) / TILE) : Math.floor(ent.left / TILE);
    for (let row = minRow; row <= maxRow; row++) {
      const tile = tileAt(this.level, col, row);
      if (tile && tile.solid) {
        if (dir > 0) ent.x = col * TILE - ent.w;
        else ent.x = (col + 1) * TILE;
        ent.vx = 0;
        return tile;
      }
    }
    return null;
  }

  _moveAndCollideY(ent, dt) {
    ent.y += ent.vy * dt;
    const dir = Math.sign(ent.vy);
    ent.onGround = false;
    if (dir === 0) return null;
    const minCol = Math.max(0, Math.floor(ent.left / TILE));
    const maxCol = Math.min(this.level.cols - 1, Math.floor((ent.right - 1) / TILE));
    const row = dir > 0 ? Math.floor((ent.bottom - 1) / TILE) : Math.floor(ent.top / TILE);
    let hit = null;
    for (let col = minCol; col <= maxCol; col++) {
      const tile = tileAt(this.level, col, row);
      if (tile && tile.solid) {
        if (dir > 0) { ent.y = row * TILE - ent.h; ent.vy = 0; ent.onGround = true; }
        else { ent.y = (row + 1) * TILE; ent.vy = 0; }
        hit = tile;
        break;
      }
    }
    return { dir, tile: hit };
  }

  _movePlayerAndCollide(dt) {
    const p = this.player;
    this._moveAndCollideX(p, dt);
    const yResult = this._moveAndCollideY(p, dt);
    if (yResult && yResult.dir < 0 && yResult.tile) this._onPlayerHitBlockFromBelow(yResult.tile);
  }

  _onPlayerHitBlockFromBelow(tile) {
    if (!(tile instanceof Block)) return;
    if (tile.type === 'used') { this.audio.play('bump', { volume: 0.5 }); return; }
    if (tile.type === 'brick') {
      if (this.player.big) this._breakBlock(tile);
      else { tile.bump(); this.audio.play('bump', { volume: 0.5 }); }
      return;
    }
    tile.bump();
    this.audio.play('bump', { volume: 0.4 });
    if (tile.item === 'mushroom') {
      this.level.items.push(new Mushroom(tile.x, tile.y));
    } else {
      this.score += 100;
      this.coins += 1;
      this._checkExtraLife();
      this._spawnPopup(tile.x + TILE / 2, tile.y, '+100', '#ffd54a');
      this.audio.play('coin', { volume: 0.6 });
    }
    tile.type = 'used';
    tile.item = null;
  }

  _breakBlock(tile) {
    tile.solid = false;
    const col = Math.floor(tile.x / TILE);
    const row = Math.floor(tile.y / TILE);
    if (this.level.solidGrid[row] && this.level.solidGrid[row][col] === tile) {
      this.level.solidGrid[row][col] = null;
    }
    const ti = this.level.tiles.indexOf(tile);
    if (ti >= 0) this.level.tiles.splice(ti, 1);
    const bi = this.level.blocks.indexOf(tile);
    if (bi >= 0) this.level.blocks.splice(bi, 1);
    for (let i = 0; i < 4; i++) {
      const vx = (i % 2 === 0 ? -1 : 1) * (80 + Math.random() * 60);
      const vy = -(220 + Math.random() * 200);
      this.level.particles.push(new Particle(tile.x + TILE / 2, tile.y + TILE / 2, vx, vy, this.level.theme.brick, 8, 0.6));
    }
    this.score += 50;
    this.audio.play('break_block', { volume: 0.7 });
  }

  _handlePlayerEnemyCollisions() {
    const p = this.player;
    if (!p.controllable || p.invincible > 0) return;
    this.level.enemies.forEach((e) => {
      if (!e.alive || e.squashed) return;
      if (!aabbOverlap(p, e)) return;
      if (e.stompable && p.vy > 0 && (p.bottom - e.top) < e.h * 0.6) {
        e.squashed = true;
        e.squashTimer = 0.4;
        e.vx = 0;
        p.vy = STOMP_BOUNCE;
        this.score += 100;
        this._spawnPopup(e.x + e.w / 2, e.y, '+100', '#fff');
        this.audio.play('stomp', { volume: 0.7 });
      } else {
        this._damagePlayer();
      }
    });
  }

  _damagePlayer() {
    const p = this.player;
    if (p.invincible > 0) return;
    if (p.big) {
      p.shrink();
      this.audio.play('hurt', { volume: 0.8 });
    } else {
      this._startDying();
    }
  }

  _handlePlayerCoinCollisions() {
    const p = this.player;
    this.level.coins.forEach((c) => {
      if (c.collected) return;
      if (aabbOverlap(p, c)) {
        c.collected = true;
        this.coins += 1;
        this.score += 100;
        this._checkExtraLife();
        this._spawnPopup(c.x + c.w / 2, c.y, '+100', '#ffd54a');
        this.audio.play('coin', { volume: 0.6 });
      }
    });
  }

  _checkExtraLife() {
    if (this.coins >= 100) {
      this.coins -= 100;
      this.lives += 1;
      this.audio.play('one_up', { volume: 0.8 });
      this._spawnPopup(this.player.x + this.player.w / 2, this.player.y - 10, '1UP', '#3ec22d');
    }
  }

  _updateEnemies(dt) {
    this.level.enemies.forEach((e) => {
      if (!e.alive) return;
      e.animTime += dt;
      if (e.squashed) {
        e.squashTimer -= dt;
        if (e.squashTimer <= 0) e.alive = false;
        return;
      }
      e.vy = Math.min(e.vy + GRAVITY * dt, MAX_FALL_SPEED);
      const prevVx = e.vx;
      const hitX = this._moveAndCollideX(e, dt);
      if (hitX && prevVx !== 0) e.vx = -prevVx;
      this._moveAndCollideY(e, dt);
      if (e.y > KILL_Y) e.alive = false;
    });
    this.level.enemies = this.level.enemies.filter((e) => e.alive);
  }

  _updateItems(dt) {
    this.level.items.forEach((m) => {
      if (!m.alive) return;
      if (m.emerging) {
        m.y -= 60 * dt;
        if (m.y <= m.emergeTarget) { m.y = m.emergeTarget; m.emerging = false; }
        return;
      }
      m.vy = Math.min(m.vy + GRAVITY * dt, MAX_FALL_SPEED);
      const prevVx = m.vx;
      const hitX = this._moveAndCollideX(m, dt);
      if (hitX) m.vx = -prevVx;
      this._moveAndCollideY(m, dt);
      if (m.y > KILL_Y) m.alive = false;
    });
    this.level.items = this.level.items.filter((m) => m.alive);

    const p = this.player;
    this.level.items.forEach((m) => {
      if (m.emerging || !m.alive) return;
      if (aabbOverlap(p, m)) {
        m.alive = false;
        p.grow();
        this.score += 1000;
        this._checkExtraLife();
        this._spawnPopup(p.x + p.w / 2, p.y - 10, '+1000', '#ffd54a');
        this.audio.play('powerup', { volume: 0.8 });
      }
    });
  }

  _updateBlockTimers(dt) {
    this.level.blocks.forEach((b) => {
      if (b.bumpTimer > 0) b.bumpTimer = Math.max(0, b.bumpTimer - dt);
    });
  }

  _spawnPopup(x, y, text, color) {
    this.level.popups.push(new ScorePopup(x, y, text, color));
  }

  _updateParticlesAndPopups(dt) {
    this.level.particles.forEach((p) => p.update(dt));
    this.level.particles = this.level.particles.filter((p) => p.life > 0);
    this.level.popups.forEach((p) => p.update(dt));
    this.level.popups = this.level.popups.filter((p) => p.life > 0);
  }

  _updateCamera() {
    const targetX = this.player.x + this.player.w / 2 - VIEW_W / 2;
    this.camX = Math.max(0, Math.min(targetX, Math.max(0, this.level.widthPx - VIEW_W)));
  }

  _beginFlagSequence() {
    const fp = this.level.flagpole;
    fp.touched = true;
    const p = this.player;
    p.controllable = false;
    p.vx = 0;
    p.vy = 0;
    p.x = fp.x - p.w / 2;
    p.atFlag = true;
    this.state = 'flagseq';
    this.flagPhase = 'slide';
    this.stateTimer = 0;
    this.audio.stopMusic();
    this.audio.play('flagpole', { volume: 0.8 });
  }

  _updateFlagSeq(dt) {
    const fp = this.level.flagpole;
    const p = this.player;
    if (this.flagPhase === 'slide') {
      const targetY = fp.bottomY - p.h;
      p.y = Math.min(p.y + 420 * dt, targetY);
      fp.flagT = Math.min(Math.max((p.y - fp.topY) / (targetY - fp.topY), 0), 1);
      if (p.y >= targetY) {
        this.flagPhase = 'walk';
        p.facing = 1;
      }
    } else if (this.flagPhase === 'walk') {
      p.vx = RUN_SPEED * 0.7;
      p.x += p.vx * dt;
      p.animTime += dt;
      if (p.x >= this.level.castle.x - TILE * 0.6) this._finishLevel();
    }
    this._updateCamera();
  }

  _finishLevel() {
    const bonus = Math.floor(this.time) * 50;
    this.score += bonus;
    this.time = 0;
    this.levelClearBonus = bonus;
    this.state = 'levelclear';
    this.stateTimer = 0;
    this.audio.play('level_clear', { volume: 0.9 });
  }

  _updateLevelClear(dt) {
    this.stateTimer += dt;
    if (this.stateTimer > 3.2) {
      if (this.levelIndex + 1 < LEVELS.length) {
        this._loadLevelDef(this.levelIndex + 1);
        this.state = 'playing';
        this._playLevelMusic();
      } else {
        this.state = 'win';
        this.stateTimer = 0;
        this.audio.stopMusic();
        if (this.score > this.highScore) {
          this.highScore = this.score;
          this._saveHighScore();
        }
      }
    }
  }

  _startDying() {
    if (this.state === 'dying') return;
    this.state = 'dying';
    this.stateTimer = 0;
    this.player.controllable = false;
    this.player.vx = 0;
    this.player.vy = -600;
    this.lives = Math.max(0, this.lives - 1);
    this.audio.stopMusic();
    this.audio.play('death', { volume: 0.9 });
  }

  _updateDying(dt) {
    const p = this.player;
    p.vy += GRAVITY * dt;
    p.y += p.vy * dt;
    this.stateTimer += dt;
    if (this.stateTimer > 1.7) {
      if (this.lives > 0) {
        this._loadLevelDef(this.levelIndex);
        this.state = 'playing';
        this._playLevelMusic();
      } else {
        this.state = 'gameover';
        this.stateTimer = 0;
        this.audio.play('game_over', { volume: 0.9 });
        if (this.score > this.highScore) {
          this.highScore = this.score;
          this._saveHighScore();
        }
      }
    }
  }

  _updateGameOver(dt) {
    this.stateTimer += dt;
    if (this.stateTimer > 1.0 && this.input.startPressed) this.state = 'start';
  }

  _updateWin(dt) {
    this.stateTimer += dt;
    if (this.stateTimer > 1.0 && this.input.startPressed) this.state = 'start';
  }

  // -------------------------------------------------------------------
  // 렌더링
  // -------------------------------------------------------------------

  render() {
    this._renderWorld();
    if (this.state === 'start') this._renderStartOverlay();
    else if (this.state === 'paused') this._renderPauseOverlay();
    else if (this.state === 'levelclear') this._renderLevelClearOverlay();
    else if (this.state === 'gameover') this._renderGameOverOverlay();
    else if (this.state === 'win') this._renderWinOverlay();

    if (this.state !== 'start') this._renderHUD();
  }

  _renderWorld() {
    const ctx = this.ctx;
    const level = this.level;
    const theme = level.theme;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    this._renderBackground(theme, level.widthPx);

    level.tiles.forEach((t) => {
      if (t.right < this.camX - TILE || t.left > this.camX + VIEW_W + TILE) return;
      t.draw(ctx, this.camX, theme);
    });
    level.coins.forEach((c) => c.draw(ctx, this.camX));
    level.items.forEach((m) => m.draw(ctx, this.camX));
    level.enemies.forEach((e) => e.draw(ctx, this.camX));
    level.castle.draw(ctx, this.camX);
    level.flagpole.draw(ctx, this.camX);
    if (this.player) this.player.draw(ctx, this.camX);
    level.particles.forEach((p) => p.draw(ctx, this.camX));
    level.popups.forEach((p) => p.draw(ctx, this.camX));
  }

  _renderBackground(theme, widthPx) {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, theme.skyTop);
    grad.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const farOffset = this.camX * 0.25;
    const nearOffset = this.camX * 0.5;
    const bushOffset = this.camX * 0.7;

    ctx.fillStyle = theme.cloud;
    const cloudSpan = 320;
    for (let i = 0; i < Math.ceil(widthPx / cloudSpan) + 2; i++) {
      const bx = i * cloudSpan - (farOffset % cloudSpan);
      drawCloud(ctx, bx + 20, 46 + (i % 3) * 20);
    }

    ctx.fillStyle = theme.hillFar;
    const hillFarSpan = 260;
    for (let i = 0; i < Math.ceil(widthPx / hillFarSpan) + 2; i++) {
      const bx = i * hillFarSpan - (farOffset % hillFarSpan);
      drawHill(ctx, bx, VIEW_H - TILE * 2, 170, 95);
    }

    ctx.fillStyle = theme.hillNear;
    const hillNearSpan = 220;
    for (let i = 0; i < Math.ceil(widthPx / hillNearSpan) + 2; i++) {
      const bx = i * hillNearSpan - (nearOffset % hillNearSpan);
      drawHill(ctx, bx + 60, VIEW_H - TILE * 2, 140, 60);
    }

    const bushSpan = 260;
    for (let i = 0; i < Math.ceil(widthPx / bushSpan) + 2; i++) {
      const bx = i * bushSpan - (bushOffset % bushSpan);
      drawBush(ctx, bx, VIEW_H - TILE * 2 - 4, 60, theme.bush);
    }
  }

  _renderHUD() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, VIEW_W, 34);
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${String(this.score).padStart(6, '0')}`, 12, 17);
    ctx.fillText(`COIN x${String(this.coins).padStart(2, '0')}`, 210, 17);
    ctx.textAlign = 'center';
    ctx.fillText(this.level.id, VIEW_W / 2, 17);
    ctx.textAlign = 'right';
    ctx.fillText(`LIVES x${this.lives}`, VIEW_W - 12, 17);
    ctx.fillText(`TIME ${Math.ceil(this.time)}`, VIEW_W - 150, 17);
    if (this.audio.muted) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ff6666';
      ctx.fillText('MUTED (M)', 12, 33 + 8);
    }
    ctx.restore();
  }

  _renderPanel(lines) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    const totalGap = lines.reduce((s, l) => s + (l.gap || 30), 0);
    let y = VIEW_H / 2 - totalGap / 2;
    lines.forEach((line) => {
      ctx.font = line.font || 'bold 20px "Courier New", monospace';
      ctx.fillStyle = line.color || '#fff';
      ctx.fillText(line.text, VIEW_W / 2, y);
      y += line.gap || 30;
    });
    ctx.restore();
  }

  _renderStartOverlay() {
    this._renderPanel([
      { text: 'PLUMBER QUEST', font: 'bold 40px "Courier New", monospace', color: '#ffd54a', gap: 54 },
      { text: '오리지널 8비트 사이드스크롤 플랫포머', font: '15px "Courier New", monospace', color: '#fff', gap: 46 },
      { text: 'ENTER 를 눌러 시작', font: 'bold 20px "Courier New", monospace', color: '#3ec22d', gap: 36 },
      { text: '← → 이동  SPACE 점프  SHIFT 달리기', font: '14px "Courier New", monospace', color: '#ccc', gap: 22 },
      { text: 'P 일시정지   M 음소거', font: '14px "Courier New", monospace', color: '#ccc', gap: 26 },
      { text: `HIGH SCORE ${String(this.highScore).padStart(6, '0')}`, font: '14px "Courier New", monospace', color: '#ffd54a' },
    ]);
  }

  _renderPauseOverlay() {
    this._renderPanel([
      { text: 'PAUSED', font: 'bold 32px "Courier New", monospace', color: '#fff', gap: 40 },
      { text: 'P 를 눌러 계속하기', font: '16px "Courier New", monospace', color: '#ccc' },
    ]);
  }

  _renderLevelClearOverlay() {
    this._renderPanel([
      { text: 'LEVEL CLEAR!', font: 'bold 32px "Courier New", monospace', color: '#ffd54a', gap: 40 },
      { text: this.level.name, font: '16px "Courier New", monospace', color: '#fff', gap: 30 },
      { text: `TIME BONUS +${this.levelClearBonus}`, font: '16px "Courier New", monospace', color: '#3ec22d' },
    ]);
  }

  _renderGameOverOverlay() {
    this._renderPanel([
      { text: 'GAME OVER', font: 'bold 34px "Courier New", monospace', color: '#e23e3e', gap: 42 },
      { text: `SCORE ${String(this.score).padStart(6, '0')}`, font: '16px "Courier New", monospace', color: '#fff', gap: 28 },
      { text: 'ENTER 를 눌러 타이틀로', font: '14px "Courier New", monospace', color: '#ccc' },
    ]);
  }

  _renderWinOverlay() {
    this._renderPanel([
      { text: 'YOU WIN!', font: 'bold 36px "Courier New", monospace', color: '#ffd54a', gap: 46 },
      { text: '모든 레벨을 클리어했습니다!', font: '15px "Courier New", monospace', color: '#fff', gap: 30 },
      { text: `FINAL SCORE ${String(this.score).padStart(6, '0')}`, font: '16px "Courier New", monospace', color: '#3ec22d', gap: 26 },
      { text: `HIGH SCORE ${String(this.highScore).padStart(6, '0')}`, font: '14px "Courier New", monospace', color: '#ffd54a', gap: 26 },
      { text: 'ENTER 를 눌러 타이틀로', font: '14px "Courier New", monospace', color: '#ccc' },
    ]);
  }
}
