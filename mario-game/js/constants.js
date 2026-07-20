// constants.js — 여러 <script> 태그가 공유하는 전역 상수 (모듈 번들러 없이 동작)

const TILE = 40;
const COLS_VISIBLE = 20;
const ROWS_VISIBLE = 12;
const VIEW_W = TILE * COLS_VISIBLE; // 800
const VIEW_H = TILE * ROWS_VISIBLE; // 480

const GRAVITY = 2200;
const MAX_FALL_SPEED = 900;
const MOVE_SPEED = 220;
const RUN_SPEED = 340;
const ACCEL = 1400;
const AIR_ACCEL = 1000;
const FRICTION = 1700;
const JUMP_VELOCITY = -760;
const RUN_JUMP_VELOCITY = -830;
const JUMP_CUT_MULT = 0.45;
const COYOTE_TIME = 0.09;
const JUMP_BUFFER = 0.12;
const STOMP_BOUNCE = -520;

const PLAYER_W = 30;
const PLAYER_H_SMALL = 34;
const PLAYER_H_BIG = 54;

const GOOMBA_SPEED = 60;
const SPIKY_SPEED = 85;
const MUSHROOM_SPEED = 90;

const INVINCIBLE_TIME = 1.5;
const STAR_TIME = 0; // (예비) 별 파워업은 이번 버전에 없음

const KILL_Y = VIEW_H + 400; // 이 y좌표를 넘어가면 낙사 처리

const THEMES = {
  overworld: {
    skyTop: '#5c94fc',
    skyBottom: '#a7d3ff',
    hillFar: '#2f7d1c',
    hillNear: '#3a9d23',
    bush: '#2f9d2f',
    cloud: '#ffffff',
    groundBody: '#b2591a',
    groundTop: '#4ec22d',
    groundDeco: '#8c4413',
    brick: '#c0561c',
    brickLine: '#8c3c10',
    block: '#e8a020',
    blockUsed: '#8a6a4a',
    pipe: '#2f9d2f',
    pipeDark: '#1f7d16',
  },
  underground: {
    skyTop: '#05061a',
    skyBottom: '#12143a',
    hillFar: '#171b45',
    hillNear: '#1f2559',
    bush: '#232a63',
    cloud: '#20244f',
    groundBody: '#263573',
    groundTop: '#3e52a0',
    groundDeco: '#1b2657',
    brick: '#33468f',
    brickLine: '#212f6b',
    block: '#5a72c9',
    blockUsed: '#3a3f5c',
    pipe: '#3aa64d',
    pipeDark: '#217a30',
  },
};
