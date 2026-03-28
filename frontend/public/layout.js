// FoxBoard 像素办公室 v2 - 莲花池国风主题布局配置
// Phase 10: 国风古典园林 + 四狐工位
// 配合 game.js 使用

const OFFICE_LAYOUT = {
  // === 游戏画布 ===
  game: {
    width: 1280,
    height: 720
  },

  // === 四工位配置 ===
  workstations: [
    {
      id: 'spark',
      agentId: 'fox_leader',
      label: '花火',
      x: 220, y: 340,
      deskX: 218, deskY: 430,
      depth: 900,
      sprites: {
        idle:    'sprites/spark_idle.webp',
        walk:    'sprites/spark_walk.webp',
        wave:    'sprites/spark_wave.webp',
        sit:     'sprites/spark_sit.webp',
        think:   'sprites/spark_sit.webp',
        working: 'sprites/spark_walk.webp',
        wiggle:  'sprites/spark_walk.webp'
      }
    },
    {
      id: 'qingfox',
      agentId: 'qing_fox',
      label: '青狐',
      x: 900, y: 340,
      deskX: 898, deskY: 430,
      depth: 900,
      sprites: {
        idle:    'sprites/qingfox_idle.webp',
        think:   'sprites/qingfox_idle.webp',
        wave:    'sprites/qingfox_idle.webp',
        working: 'sprites/qingfox_idle.webp',
        wiggle:  'sprites/qingfox_idle.webp'
      }
    },
    {
      id: 'whitefox',
      agentId: 'white_fox',
      label: '白狐',
      x: 220, y: 540,
      deskX: 218, deskY: 630,
      depth: 910,
      sprites: {
        idle:    'sprites/whitefox_idle.webp',
        think:   'sprites/whitefox_idle.webp',
        wave:    'sprites/whitefox_idle.webp',
        working: 'sprites/whitefox_idle.webp',
        wiggle:  'sprites/whitefox_idle.webp'
      }
    },
    {
      id: 'blackfox',
      agentId: 'black_fox',
      label: '黑狐',
      x: 900, y: 540,
      deskX: 898, deskY: 630,
      depth: 910,
      sprites: {
        idle:    'sprites/blackfox_idle.webp',
        think:   'sprites/blackfox_idle.webp',
        wave:    'sprites/blackfox_idle.webp',
        working: 'sprites/blackfox_idle.webp',
        wiggle:  'sprites/blackfox_idle.webp'
      }
    }
  ],

  // === 背景（莲花池主体） ===
  background: {
    sprite: 'assets/backgrounds/lotus_park_bg_clean.png'
  },

  // === 天空盘旋转系统 ===
  skyDisc: {
    enabled: true,
    depth: 0,
    size: 1500,
    radius: 700,
    imageUrl: 'assets/backgrounds/sky_disc_2560.webp',
    degreesPerSecond: 360 / (24 * 60),
    speed: -1.35,
    yOffset: 90
  },

  // === 荷花池区域（粒子特效+互动目标） ===
  pond: {
    x: 640, y: 380,
    width: 280, height: 120,
    depth: 8
  },

  // === 自然装饰物（9宫格产出 — FB-084）===
  naturalDecorations: [],

  // === 古典园林家具物件（16宫格产出 v2 — FB-085）===
  furnitureDecorations: [],

  // === 行走系统路径点 ===
  waypoints: [
    { id: 'spark_desk',  x: 220,  y: 340 },
    { id: 'qing_desk',   x: 900,  y: 340 },
    { id: 'white_desk',  x: 220,  y: 540 },
    { id: 'black_desk',  x: 900,  y: 540 },
    { id: 'pond_center', x: 640,  y: 380 },
    { id: 'pavilion',    x: 150,  y: 280 },
    { id: 'tea_area',    x: 380,  y: 400 },
    { id: 'window',      x: 1100, y: 200 },
    { id: 'bridge',      x: 640,  y: 440 },
    { id: 'garden',      x: 950,  y: 480 },
  ],

  // === 粒子特效配置 ===
  particles: {
    firefly: {
      depth: 950,
      count: 15,
      emitX: { min: 100, max: 1180 },
      emitY: { min: 80, max: 300 }
    },
    petal: {
      depth: 920,
      count: 20,
      emitX: { min: 50, max: 1230 },
      emitY: { min: -20, max: 0 }
    },
    ripple: {
      depth: 9,
      count: 8,
      emitX: { min: 500, max: 780 },
      emitY: { min: 340, max: 420 }
    }
  },

  // === 牌匾 ===
  plaque: {
    x: 640, y: 720 - 36,
    width: 420, height: 44
  },

  // === 加载资源总数 ===
  totalAssets: 4 * 3 + 3  // 4角色×3动画 + 3背景
};

const LAYOUT = OFFICE_LAYOUT;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = OFFICE_LAYOUT;
}
