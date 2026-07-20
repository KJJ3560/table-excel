// entities.js — 플레이어/적/아이템/블록 등 게임 오브젝트와 그리기 로직.
// 모든 그래픽은 이미지 파일 없이 canvas 도형(사각형/원/삼각형)만으로 그린다.

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// ---------------------------------------------------------------------------
// 플레이어
// ---------------------------------------------------------------------------

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = PLAYER_W;
    this.h = PLAYER_H_SMALL;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facing = 1;
    this.big = false;
    this.invincible = 0;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.animTime = 0;
    this.alive = true;
    this.controllable = true;
    this.dead = false;
    this.atFlag = false;
  }

  get top() { return this.y; }
  get bottom() { return this.y + this.h; }
  get left() { return this.x; }
  get right() { return this.x + this.w; }

  grow() {
    if (this.big) return;
    this.big = true;
    const oldH = this.h;
    this.h = PLAYER_H_BIG;
    this.y -= (this.h - oldH);
  }

  shrink() {
    if (!this.big) return false;
    this.big = false;
    const oldH = this.h;
    this.h = PLAYER_H_SMALL;
    this.y += (oldH - this.h);
    this.invincible = INVINCIBLE_TIME;
    return true;
  }

  draw(ctx, camX) {
    const dx = this.x - camX;
    const dy = this.y;
    if (this.invincible > 0 && Math.floor(this.invincible * 20) % 2 === 0) return;

    ctx.save();
    if (this.facing < 0) {
      ctx.translate(dx + this.w, dy);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(dx, dy);
    }
    drawPlumber(ctx, this.w, this.h, {
      big: this.big,
      moving: Math.abs(this.vx) > 10 && this.onGround,
      airborne: !this.onGround,
      animTime: this.animTime,
    });
    ctx.restore();
  }
}

function drawPlumber(ctx, w, h, opts) {
  const capH = h * 0.20;
  const faceH = h * 0.17;
  const torsoH = h * 0.36;
  const legH = h - capH - faceH - torsoH;

  const capColor = '#d31f1f';
  const skinColor = '#f4b98d';
  const hairColor = '#5b3a1a';
  const overallColor = '#2255d8';
  const shoeColor = '#3a2510';
  const buttonColor = '#ffd54a';

  // 다리 (걷기 애니메이션)
  const legSwing = opts.moving ? Math.sin(opts.animTime * 16) * (w * 0.16) : 0;
  const legW = w * 0.34;
  const legY = h - legH;
  if (opts.airborne) {
    rect(ctx, w * 0.12, legY, legW, legH * 0.8, overallColor);
    rect(ctx, w * 0.54, legY, legW, legH * 0.8, overallColor);
    rect(ctx, w * 0.10, h - legH * 0.35, legW * 1.1, legH * 0.35, shoeColor);
    rect(ctx, w * 0.52, h - legH * 0.35, legW * 1.1, legH * 0.35, shoeColor);
  } else {
    rect(ctx, w * 0.10 + legSwing, legY, legW, legH, overallColor);
    rect(ctx, w * 0.56 - legSwing, legY, legW, legH, overallColor);
    rect(ctx, w * 0.08 + legSwing, h - legH * 0.32, legW * 1.15, legH * 0.32, shoeColor);
    rect(ctx, w * 0.54 - legSwing, h - legH * 0.32, legW * 1.15, legH * 0.32, shoeColor);
  }

  // 팔 (몸통 옆, 걸을 때 살짝 흔들림)
  const armSwing = opts.moving ? Math.sin(opts.animTime * 16 + Math.PI) * (h * 0.02) : 0;
  rect(ctx, -w * 0.08, capH + faceH + armSwing, w * 0.2, torsoH * 0.7, capColor);
  rect(ctx, w * 0.9, capH + faceH - armSwing, w * 0.2, torsoH * 0.7, skinColor);

  // 몸통 (오버올)
  rect(ctx, w * 0.08, capH + faceH, w * 0.84, torsoH, overallColor);
  rect(ctx, w * 0.08, capH + faceH, w * 0.2, torsoH, capColor);
  rect(ctx, w * 0.22, capH + faceH + torsoH * 0.15, w * 0.06, w * 0.06, buttonColor);
  rect(ctx, w * 0.72, capH + faceH + torsoH * 0.15, w * 0.06, w * 0.06, buttonColor);

  // 얼굴
  rect(ctx, w * 0.14, capH, w * 0.72, faceH, skinColor);
  rect(ctx, w * 0.14, capH + faceH * 0.5, w * 0.5, faceH * 0.32, hairColor);

  // 모자
  rect(ctx, w * 0.06, 0, w * 0.8, capH, capColor);
  rect(ctx, w * 0.5, capH * 0.35, w * 0.5, capH * 0.4, capColor);

  if (opts.big) {
    rect(ctx, w * 0.02, capH + faceH, w * 0.14, torsoH * 0.5, capColor);
    rect(ctx, w * 0.84, capH + faceH, w * 0.14, torsoH * 0.5, capColor);
  }
}

// ---------------------------------------------------------------------------
// 적 - 굼바형 (밟아서 처치)
// ---------------------------------------------------------------------------

class Goomba {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 34;
    this.h = 30;
    this.vx = -GOOMBA_SPEED;
    this.vy = 0;
    this.onGround = false;
    this.alive = true;
    this.squashed = false;
    this.squashTimer = 0;
    this.animTime = Math.random() * 10;
    this.type = 'goomba';
    this.stompable = true;
  }

  get top() { return this.y; }
  get bottom() { return this.y + this.h; }
  get left() { return this.x; }
  get right() { return this.x + this.w; }

  draw(ctx, camX) {
    const dx = this.x - camX;
    const dy = this.y;
    ctx.save();
    ctx.translate(dx, dy);
    if (this.squashed) {
      rect(ctx, this.w * 0.05, this.h * 0.6, this.w * 0.9, this.h * 0.4, '#7a4a1e');
    } else {
      const bob = Math.sin(this.animTime * 14) * 2;
      ctx.fillStyle = '#8a5426';
      ctx.beginPath();
      ctx.ellipse(this.w / 2, this.h * 0.5 + bob * 0.2, this.w / 2, this.h * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();
      const footOffset = Math.abs(Math.sin(this.animTime * 14)) * 3;
      rect(ctx, this.w * 0.08, this.h * 0.86, this.w * 0.28, this.h * 0.16 - footOffset * 0.2, '#3a2510');
      rect(ctx, this.w * 0.64, this.h * 0.86, this.w * 0.28, this.h * 0.16 - footOffset * 0.2, '#3a2510');
      rect(ctx, this.w * 0.16, this.h * 0.36, this.w * 0.22, this.h * 0.22, '#fff');
      rect(ctx, this.w * 0.62, this.h * 0.36, this.w * 0.22, this.h * 0.22, '#fff');
      rect(ctx, this.w * 0.22, this.h * 0.42, this.w * 0.1, this.h * 0.12, '#1a1a1a');
      rect(ctx, this.w * 0.68, this.h * 0.42, this.w * 0.1, this.h * 0.12, '#1a1a1a');
      rect(ctx, this.w * 0.14, this.h * 0.28, this.w * 0.24, this.h * 0.08, '#3a2510');
      rect(ctx, this.w * 0.62, this.h * 0.28, this.w * 0.24, this.h * 0.08, '#3a2510');
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// 적 - 가시형 (밟을 수 없음, 뛰어넘어야 함)
// ---------------------------------------------------------------------------

class Spiky {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 34;
    this.h = 32;
    this.vx = -SPIKY_SPEED;
    this.vy = 0;
    this.onGround = false;
    this.alive = true;
    this.squashed = false;
    this.animTime = Math.random() * 10;
    this.type = 'spiky';
    this.stompable = false;
  }

  get top() { return this.y; }
  get bottom() { return this.y + this.h; }
  get left() { return this.x; }
  get right() { return this.x + this.w; }

  draw(ctx, camX) {
    const dx = this.x - camX;
    const dy = this.y + Math.sin(this.animTime * 10) * 2;
    ctx.save();
    ctx.translate(dx, dy);
    ctx.fillStyle = '#2b2b3a';
    ctx.beginPath();
    ctx.ellipse(this.w / 2, this.h * 0.55, this.w * 0.48, this.h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a4a63';
    const spikeCount = 5;
    for (let i = 0; i < spikeCount; i++) {
      const t = i / (spikeCount - 1);
      const px = this.w * (0.08 + t * 0.84);
      ctx.beginPath();
      ctx.moveTo(px, this.h * 0.28);
      ctx.lineTo(px + this.w * 0.08, this.h * 0.02);
      ctx.lineTo(px + this.w * 0.16, this.h * 0.28);
      ctx.closePath();
      ctx.fill();
    }
    rect(ctx, this.w * 0.18, this.h * 0.5, this.w * 0.18, this.h * 0.16, '#e23e3e');
    rect(ctx, this.w * 0.64, this.h * 0.5, this.w * 0.18, this.h * 0.16, '#e23e3e');
    rect(ctx, this.w * 0.06, this.h * 0.82, this.w * 0.3, this.h * 0.14, '#1a1a1a');
    rect(ctx, this.w * 0.64, this.h * 0.82, this.w * 0.3, this.h * 0.14, '#1a1a1a');
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// 버섯 파워업
// ---------------------------------------------------------------------------

class Mushroom {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 30;
    this.h = 28;
    this.vx = MUSHROOM_SPEED;
    this.vy = 0;
    this.onGround = false;
    this.alive = true;
    this.emerging = true;
    this.emergeTarget = y - TILE;
  }

  get top() { return this.y; }
  get bottom() { return this.y + this.h; }
  get left() { return this.x; }
  get right() { return this.x + this.w; }

  draw(ctx, camX) {
    const dx = this.x - camX;
    const dy = this.y;
    ctx.save();
    ctx.translate(dx, dy);
    ctx.fillStyle = '#e23e3e';
    ctx.beginPath();
    ctx.ellipse(this.w / 2, this.h * 0.42, this.w * 0.5, this.h * 0.42, 0, Math.PI, 0);
    ctx.fill();
    rect(ctx, 0, this.h * 0.4, this.w, this.h * 0.12, '#e23e3e');
    ctx.fillStyle = '#fff';
    [0.2, 0.5, 0.8].forEach((t) => {
      ctx.beginPath();
      ctx.ellipse(this.w * t, this.h * 0.28, this.w * 0.1, this.h * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    rect(ctx, this.w * 0.2, this.h * 0.52, this.w * 0.6, this.h * 0.42, '#f4d9a8');
    rect(ctx, this.w * 0.28, this.h * 0.66, this.w * 0.14, this.h * 0.14, '#3a2510');
    rect(ctx, this.w * 0.58, this.h * 0.66, this.w * 0.14, this.h * 0.14, '#3a2510');
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// 동전 (블록 밖에 떠 있는 것)
// ---------------------------------------------------------------------------

class CoinPickup {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 22;
    this.h = 26;
    this.collected = false;
    this.animTime = Math.random() * 10;
  }

  get top() { return this.y; }
  get bottom() { return this.y + this.h; }
  get left() { return this.x; }
  get right() { return this.x + this.w; }

  draw(ctx, camX) {
    if (this.collected) return;
    drawCoinShape(ctx, this.x - camX, this.y, this.w, this.h, this.animTime);
  }
}

function drawCoinShape(ctx, x, y, w, h, animTime) {
  const spin = Math.abs(Math.sin(animTime * 4));
  const cw = Math.max(w * spin, w * 0.15);
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.fillStyle = '#ffd54a';
  ctx.beginPath();
  ctx.ellipse(0, 0, cw / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c98a12';
  ctx.lineWidth = 2;
  ctx.stroke();
  if (cw > w * 0.4) {
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.ellipse(0, 0, cw * 0.22, h * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 블록 (? 블록 / 벽돌 / 사용된 블록)
// ---------------------------------------------------------------------------

class Block {
  constructor(x, y, size, type, item) {
    this.x = x;
    this.y = y;
    this.w = size;
    this.h = size;
    this.type = type; // 'question' | 'brick' | 'used'
    this.item = item || null; // 'coin' | 'mushroom' | null
    this.solid = true;
    this.bumpTimer = 0;
    this.breaking = false;
  }

  get top() { return this.y; }
  get bottom() { return this.y + this.h; }
  get left() { return this.x; }
  get right() { return this.x + this.w; }

  bump() {
    if (this.bumpTimer <= 0) this.bumpTimer = 0.18;
  }

  draw(ctx, camX, theme) {
    let offsetY = 0;
    if (this.bumpTimer > 0) {
      const p = this.bumpTimer / 0.18;
      offsetY = -Math.sin(p * Math.PI) * 8;
    }
    const dx = this.x - camX;
    const dy = this.y + offsetY;

    if (this.type === 'brick') {
      rect(ctx, dx, dy, this.w, this.h, theme.brick);
      ctx.strokeStyle = theme.brickLine;
      ctx.lineWidth = 2;
      ctx.strokeRect(dx + 1, dy + 1, this.w - 2, this.h / 2 - 1);
      ctx.strokeRect(dx + 1, dy + this.h / 2, this.w - 2, this.h / 2 - 1);
      ctx.beginPath();
      ctx.moveTo(dx + this.w / 2, dy + 1);
      ctx.lineTo(dx + this.w / 2, dy + this.h / 2 - 1);
      ctx.moveTo(dx, dy + this.h * 0.75);
      ctx.lineTo(dx + this.w, dy + this.h * 0.75);
      ctx.stroke();
      return;
    }

    const fill = this.type === 'used' ? theme.blockUsed : theme.block;
    rect(ctx, dx, dy, this.w, this.h, fill);
    rect(ctx, dx + 3, dy + 3, this.w - 6, 4, 'rgba(255,255,255,0.35)');
    rect(ctx, dx + 3, dy + this.h - 7, this.w - 6, 4, 'rgba(0,0,0,0.25)');
    const corner = 5;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(dx + 2, dy + 2, corner, corner);
    ctx.fillRect(dx + this.w - 2 - corner, dy + 2, corner, corner);
    ctx.fillRect(dx + 2, dy + this.h - 2 - corner, corner, corner);
    ctx.fillRect(dx + this.w - 2 - corner, dy + this.h - 2 - corner, corner, corner);

    if (this.type === 'question') {
      ctx.fillStyle = '#6b4412';
      ctx.font = `bold ${this.w * 0.55}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', dx + this.w / 2, dy + this.h / 2 + 2);
    }
  }
}

// ---------------------------------------------------------------------------
// 파이프 (장애물, 순수 지형)
// ---------------------------------------------------------------------------

class Pipe {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.solid = true;
  }

  get top() { return this.y; }
  get bottom() { return this.y + this.h; }
  get left() { return this.x; }
  get right() { return this.x + this.w; }

  draw(ctx, camX, theme) {
    const dx = this.x - camX;
    const collarH = TILE * 0.55;
    rect(ctx, dx, this.y + collarH, this.w, this.h - collarH, theme.pipe);
    rect(ctx, dx - 4, this.y, this.w + 8, collarH, theme.pipe);
    rect(ctx, dx, this.y, this.w * 0.22, this.h, theme.pipeDark);
    rect(ctx, dx - 4, this.y, (this.w + 8) * 0.2, collarH, theme.pipeDark);
    rect(ctx, dx - 4, this.y, this.w + 8, 6, 'rgba(255,255,255,0.25)');
  }
}

// ---------------------------------------------------------------------------
// 지형 타일 (땅)
// ---------------------------------------------------------------------------

class GroundTile {
  constructor(x, y, size, isTop) {
    this.x = x;
    this.y = y;
    this.w = size;
    this.h = size;
    this.isTop = isTop;
    this.solid = true;
  }

  get top() { return this.y; }
  get bottom() { return this.y + this.h; }
  get left() { return this.x; }
  get right() { return this.x + this.w; }

  draw(ctx, camX, theme) {
    const dx = this.x - camX;
    rect(ctx, dx, this.y, this.w, this.h, theme.groundBody);
    if (this.isTop) {
      rect(ctx, dx, this.y, this.w, this.h * 0.22, theme.groundTop);
    }
    const seed = Math.floor(this.x * 0.13) % 5;
    ctx.fillStyle = theme.groundDeco;
    if (seed === 0) rect(ctx, dx + this.w * 0.2, this.y + this.h * 0.5, this.w * 0.15, this.h * 0.15, theme.groundDeco);
    if (seed === 2) rect(ctx, dx + this.w * 0.6, this.y + this.h * 0.65, this.w * 0.18, this.h * 0.12, theme.groundDeco);
  }
}

// ---------------------------------------------------------------------------
// 깃발 (레벨 종료 지점)
// ---------------------------------------------------------------------------

class Flagpole {
  constructor(x, topY, bottomY) {
    this.x = x;
    this.topY = topY;
    this.bottomY = bottomY;
    this.touched = false;
    this.flagT = 0; // 0 = 꼭대기, 1 = 바닥
  }

  get left() { return this.x - 6; }
  get right() { return this.x + 6; }
  get top() { return this.topY; }
  get bottom() { return this.bottomY; }

  draw(ctx, camX) {
    const dx = this.x - camX;
    rect(ctx, dx - 3, this.topY, 6, this.bottomY - this.topY, '#d8d8d8');
    ctx.fillStyle = '#e8e020';
    ctx.beginPath();
    ctx.arc(dx, this.topY - 6, 7, 0, Math.PI * 2);
    ctx.fill();

    const flagY = this.topY + (this.bottomY - this.topY - 24) * this.flagT;
    ctx.fillStyle = '#2fa03a';
    ctx.beginPath();
    ctx.moveTo(dx + 3, flagY);
    ctx.lineTo(dx + 34, flagY + 12);
    ctx.lineTo(dx + 3, flagY + 24);
    ctx.closePath();
    ctx.fill();
  }
}

class GoalCastle {
  constructor(x, groundY) {
    this.x = x;
    this.groundY = groundY;
  }

  draw(ctx, camX) {
    const dx = this.x - camX;
    const baseW = TILE * 3.2;
    const baseH = TILE * 2.4;
    const baseY = this.groundY - baseH;
    rect(ctx, dx, baseY, baseW, baseH, '#c9c9c9');
    rect(ctx, dx, baseY, baseW, 10, '#9d9d9d');
    for (let i = 0; i < 4; i++) {
      rect(ctx, dx - 4 + i * (baseW / 3.4), baseY - 18, 16, 18, '#c9c9c9');
    }
    const towerW = TILE * 1.1;
    rect(ctx, dx + baseW * 0.35, baseY - TILE * 1.4, towerW, TILE * 1.4, '#b6b6b6');
    for (let i = 0; i < 3; i++) {
      rect(ctx, dx + baseW * 0.35 - 3 + i * (towerW / 2.6), baseY - TILE * 1.4 - 16, 14, 16, '#b6b6b6');
    }
    rect(ctx, dx + baseW * 0.42, baseY - TILE * 0.5, baseW * 0.16, TILE * 0.5, '#3a3a3a');
    [0.18, 0.78].forEach((t) => {
      rect(ctx, dx + baseW * t, baseY + baseH * 0.3, 18, 18, '#3a3a3a');
    });
    ctx.strokeStyle = '#7a7a7a';
    ctx.beginPath();
    ctx.moveTo(dx + baseW * 0.35 + towerW / 2, baseY - TILE * 1.4 - 16);
    ctx.lineTo(dx + baseW * 0.35 + towerW / 2, baseY - TILE * 1.9);
    ctx.stroke();
    ctx.fillStyle = '#e23e3e';
    ctx.beginPath();
    ctx.moveTo(dx + baseW * 0.35 + towerW / 2, baseY - TILE * 1.9);
    ctx.lineTo(dx + baseW * 0.35 + towerW / 2 + 22, baseY - TILE * 1.78);
    ctx.lineTo(dx + baseW * 0.35 + towerW / 2, baseY - TILE * 1.66);
    ctx.closePath();
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// 파티클 / 점수 팝업
// ---------------------------------------------------------------------------

class Particle {
  constructor(x, y, vx, vy, color, size, life) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.color = color; this.size = size;
    this.life = life; this.maxLife = life;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += GRAVITY * 0.6 * dt;
    this.life -= dt;
  }
  draw(ctx, camX) {
    if (this.life <= 0) return;
    ctx.globalAlpha = Math.max(this.life / this.maxLife, 0);
    rect(ctx, this.x - camX, this.y, this.size, this.size, this.color);
    ctx.globalAlpha = 1;
  }
}

class ScorePopup {
  constructor(x, y, text, color) {
    this.x = x; this.y = y; this.text = text;
    this.color = color || '#fff';
    this.life = 0.8; this.maxLife = 0.8;
  }
  update(dt) {
    this.y -= 60 * dt;
    this.life -= dt;
  }
  draw(ctx, camX) {
    if (this.life <= 0) return;
    ctx.globalAlpha = Math.max(this.life / this.maxLife, 0);
    ctx.fillStyle = this.color;
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.x - camX, this.y);
    ctx.globalAlpha = 1;
  }
}
