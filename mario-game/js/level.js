// level.js — 레벨 데이터(희소 표현)와 이를 실제 타일/엔티티로 변환하는 빌더.

function computeGroundTopRows(widthTiles, baseGroundRow, pits, steps) {
  const top = new Array(widthTiles).fill(baseGroundRow);
  pits.forEach(([a, b]) => {
    for (let c = a; c <= b; c++) top[c] = null;
  });
  steps.forEach(({ col, height }) => {
    if (top[col] !== null) top[col] = baseGroundRow - height;
  });
  return top;
}

function buildLevel(def) {
  const rows = ROWS_VISIBLE;
  const cols = def.widthTiles;
  const baseGroundRow = rows - def.groundHeight;
  const topRows = computeGroundTopRows(cols, baseGroundRow, def.pits, def.steps || []);

  const solidGrid = Array.from({ length: rows }, () => new Array(cols).fill(null));
  const tiles = [];
  const blocks = [];

  for (let col = 0; col < cols; col++) {
    const topRow = topRows[col];
    if (topRow === null) continue;
    for (let row = topRow; row < rows; row++) {
      const tile = new GroundTile(col * TILE, row * TILE, TILE, row === topRow);
      solidGrid[row][col] = tile;
      tiles.push(tile);
    }
  }

  (def.blocks || []).forEach(({ col, row, type, item }) => {
    const block = new Block(col * TILE, row * TILE, TILE, type, item);
    if (row >= 0 && row < rows && col >= 0 && col < cols) solidGrid[row][col] = block;
    tiles.push(block);
    blocks.push(block);
  });

  (def.pipes || []).forEach(({ col, heightTiles }) => {
    const topRow = baseGroundRow - heightTiles;
    const x = col * TILE;
    const y = topRow * TILE;
    const w = TILE * 2;
    const h = (rows - topRow) * TILE;
    const pipe = new Pipe(x, y, w, h);
    for (let row = topRow; row < rows; row++) {
      solidGrid[row][col] = pipe;
      if (col + 1 < cols) solidGrid[row][col + 1] = pipe;
    }
    tiles.push(pipe);
  });

  const coins = (def.coins || []).map(({ col, row }) => new CoinPickup(
    col * TILE + TILE / 2 - 11, row * TILE + TILE / 2 - 13,
  ));

  const enemies = (def.enemies || []).map(({ type, col }) => {
    const topRow = topRows[col] === null ? baseGroundRow : topRows[col];
    const groundY = topRow * TILE;
    if (type === 'spiky') {
      const e = new Spiky(col * TILE, groundY - 32);
      return e;
    }
    const e = new Goomba(col * TILE, groundY - 30);
    return e;
  });

  const flagTopRow = baseGroundRow - 7;
  const flagpole = new Flagpole(
    def.flagCol * TILE + TILE / 2,
    flagTopRow * TILE,
    baseGroundRow * TILE,
  );
  const castle = new GoalCastle(def.castleCol * TILE, baseGroundRow * TILE);

  const spawnTopRow = topRows[2] === null ? baseGroundRow : topRows[2];

  return {
    id: def.id,
    name: def.name,
    themeKey: def.theme,
    theme: THEMES[def.theme],
    widthPx: cols * TILE,
    heightPx: rows * TILE,
    cols,
    rows,
    baseGroundRow,
    timeLimit: def.timeLimit,
    solidGrid,
    tiles,
    blocks,
    coins,
    enemies,
    items: [],
    flagpole,
    castle,
    playerStart: { x: 2 * TILE, y: spawnTopRow * TILE - PLAYER_H_SMALL },
    particles: [],
    popups: [],
  };
}

function tileAt(level, col, row) {
  if (row < 0 || row >= level.rows || col < 0 || col >= level.cols) return null;
  return level.solidGrid[row][col];
}

// ---------------------------------------------------------------------------
// 레벨 1-1: 초원 지대
// ---------------------------------------------------------------------------

const LEVEL_1_1 = {
  id: '1-1',
  name: 'GRASS PLAINS',
  theme: 'overworld',
  widthTiles: 128,
  groundHeight: 2,
  timeLimit: 300,
  pits: [[30, 32], [52, 53], [77, 79]],
  steps: [
    { col: 58, height: 1 }, { col: 59, height: 2 }, { col: 60, height: 3 },
    { col: 61, height: 2 }, { col: 62, height: 1 },
    { col: 100, height: 1 }, { col: 101, height: 2 }, { col: 102, height: 3 },
    { col: 103, height: 4 }, { col: 104, height: 5 },
    { col: 105, height: 5 }, { col: 106, height: 5 }, { col: 107, height: 5 },
    { col: 108, height: 4 }, { col: 109, height: 3 }, { col: 110, height: 2 }, { col: 111, height: 1 },
  ],
  blocks: [
    { col: 5, row: 6, type: 'question', item: 'coin' },
    { col: 14, row: 6, type: 'question', item: 'mushroom' },
    { col: 15, row: 6, type: 'brick' },
    { col: 16, row: 6, type: 'question', item: 'coin' },
    { col: 39, row: 6, type: 'brick' },
    { col: 40, row: 6, type: 'question', item: 'mushroom' },
    { col: 41, row: 6, type: 'brick' },
    { col: 46, row: 5, type: 'question', item: 'coin' },
    { col: 85, row: 6, type: 'brick' },
    { col: 86, row: 6, type: 'question', item: 'coin' },
    { col: 87, row: 6, type: 'brick' },
    { col: 95, row: 6, type: 'question', item: 'coin' },
  ],
  pipes: [
    { col: 20, heightTiles: 2 },
    { col: 34, heightTiles: 3 },
    { col: 72, heightTiles: 2 },
  ],
  coins: [
    { col: 7, row: 8 }, { col: 30, row: 7 }, { col: 31, row: 6 }, { col: 32, row: 7 },
    { col: 37, row: 8 }, { col: 52, row: 7 }, { col: 53, row: 7 },
    { col: 67, row: 5 }, { col: 68, row: 5 }, { col: 69, row: 5 },
    { col: 77, row: 7 }, { col: 78, row: 6 }, { col: 79, row: 7 },
    { col: 97, row: 8 }, { col: 105, row: 3 }, { col: 106, row: 3 }, { col: 107, row: 3 },
    { col: 115, row: 7 },
  ],
  enemies: [
    { type: 'goomba', col: 10 }, { type: 'goomba', col: 25 },
    { type: 'goomba', col: 44 }, { type: 'goomba', col: 46 },
    { type: 'spiky', col: 63 },
    { type: 'goomba', col: 80 }, { type: 'spiky', col: 82 },
    { type: 'goomba', col: 102 }, { type: 'goomba', col: 113 },
  ],
  flagCol: 116,
  castleCol: 121,
};

// ---------------------------------------------------------------------------
// 레벨 1-2: 지하 동굴 (더 짧고 어려움)
// ---------------------------------------------------------------------------

const LEVEL_1_2 = {
  id: '1-2',
  name: 'UNDERGROUND CAVE',
  theme: 'underground',
  widthTiles: 94,
  groundHeight: 2,
  timeLimit: 260,
  pits: [[15, 16], [34, 36], [55, 56], [70, 72]],
  steps: [
    { col: 74, height: 1 }, { col: 75, height: 2 }, { col: 76, height: 3 },
    { col: 77, height: 4 }, { col: 78, height: 3 }, { col: 79, height: 2 }, { col: 80, height: 1 },
  ],
  blocks: [
    { col: 6, row: 6, type: 'question', item: 'mushroom' },
    { col: 7, row: 6, type: 'brick' },
    { col: 20, row: 6, type: 'question', item: 'coin' },
    { col: 40, row: 6, type: 'brick' },
    { col: 41, row: 6, type: 'question', item: 'coin' },
    { col: 42, row: 6, type: 'brick' },
    { col: 60, row: 5, type: 'question', item: 'coin' },
  ],
  pipes: [
    { col: 27, heightTiles: 2 },
    { col: 49, heightTiles: 3 },
    { col: 66, heightTiles: 2 },
  ],
  coins: [
    { col: 15, row: 7 }, { col: 16, row: 7 },
    { col: 25, row: 8 }, { col: 34, row: 7 }, { col: 35, row: 6 }, { col: 36, row: 7 },
    { col: 46, row: 8 }, { col: 55, row: 7 }, { col: 56, row: 7 },
    { col: 65, row: 8 }, { col: 70, row: 7 }, { col: 71, row: 6 }, { col: 72, row: 7 },
  ],
  enemies: [
    { type: 'goomba', col: 5 }, { type: 'spiky', col: 12 },
    { type: 'goomba', col: 22 }, { type: 'goomba', col: 24 },
    { type: 'spiky', col: 31 },
    { type: 'goomba', col: 45 }, { type: 'goomba', col: 47 },
    { type: 'spiky', col: 52 },
    { type: 'goomba', col: 62 }, { type: 'spiky', col: 64 },
    { type: 'goomba', col: 76 }, { type: 'goomba', col: 83 },
  ],
  flagCol: 85,
  castleCol: 90,
};

const LEVELS = [LEVEL_1_1, LEVEL_1_2];
