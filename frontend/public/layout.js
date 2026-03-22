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
        idle:    'assets/characters/spark/spark_idle_front.png',
        walk:    'assets/characters/spark/spark_walk_front.png',
        wave:    'assets/characters/spark/spark_wave_front.png',
        sit:     'assets/characters/spark/spark_sit_front.png',
        think:   'sprites/spark_think.webp',
        working: 'sprites/spark_wiggle.webp',
        wiggle:  'sprites/spark_wiggle.webp'
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
        idle:    'assets/characters/qingfox/qingfox_idle_front_v2.png',
        think:   'sprites/qingfox_think.webp',
        wave:    'sprites/qingfox_wave.webp',
        working: 'sprites/qingfox_working.webp',
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
        idle:    'assets/characters/whitefox/whitefox_idle_front_v2.png',
        think:   'sprites/whitefox_think.webp',
        wave:    'sprites/whitefox_wave.webp',
        working: 'sprites/whitefox_working.webp',
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
        idle:    'assets/characters/blackfox/blackfox_idle_front_v2.png',
        think:   'sprites/blackfox_think.webp',
        wave:    'sprites/blackfox_wave.webp',
        working: 'sprites/blackfox_working.webp',
        wiggle:  'sprites/blackfox_idle.webp'
      }
    }
  ],

  // === 背景（莲花池主体） ===
  background: {
    sprite: 'assets/backgrounds/lotus_pond_bg.jpg'
  },

  // === 天空盘旋转系统 ===
  skyDisc: {
    enabled: false,  // 等主人处理好绿幕素材后再开
    depth: 0,
    size: 400,
    radius: 248,
    imageUrl: 'assets/backgrounds/sky_disc_2560.webp',
    degreesPerSecond: 360 / (24 * 60),
    speed: 1.0
  },

  // === 荷花池区域（粒子特效+互动目标） ===
  pond: {
    x: 640, y: 380,
    width: 280, height: 120,
    depth: 8
  },

  // === 自然装饰物（9宫格产出 — FB-084）===
  naturalDecorations: [
    { id: 'nat_lotus_pink',   x: 540, y: 360, depth: 204, sprite: 'assets/decorations/lotus_pink.png',    name: '粉莲' },
    { id: 'nat_lotus_white',  x: 620, y: 355, depth: 204, sprite: 'assets/decorations/lotus_white.png',   name: '白莲' },
    { id: 'nat_lily_pad',     x: 580, y: 380, depth: 203, sprite: 'assets/decorations/lily_pad.png',      name: '荷叶' },
    { id: 'nat_willow',       x: 1100, y: 80, depth: 300, sprite: 'assets/decorations/willow_branch.png', name: '垂柳' },
    { id: 'nat_bamboo',       x: 1050, y: 150, depth: 301, sprite: 'assets/decorations/bamboo_cluster.png', name: '青竹' },
    { id: 'nat_stone_lantern', x: 180, y: 250, depth: 302, sprite: 'assets/decorations/stone_lantern.png', name: '石灯' },
    { id: 'nat_koi',          x: 600, y: 375, depth: 210, sprite: 'assets/decorations/koi_orange.png',    name: '锦鲤' },
    { id: 'nat_cherry',       x: 50, y: 100, depth: 303, sprite: 'assets/decorations/cherry_branch.png', name: '樱花' },
    { id: 'nat_rockery',      x: 950, y: 480, depth: 303, sprite: 'assets/decorations/rock_garden.png',   name: '假山' },
  ],

  // === 古典园林家具物件（16宫格产出 v2 — FB-085）===
  furnitureDecorations: [
    { id: 'fur_tea_table',     x: 380, y: 400, depth: 350, sprite: 'assets/decorations/tea_table.png',          name: '茶桌' },
    { id: 'fur_chair',         x: 400, y: 420, depth: 351, sprite: 'assets/decorations/wooden_chair.png',       name: '太师椅' },
    { id: 'fur_lantern_red',   x: 100, y: 150, depth: 352, sprite: 'assets/decorations/paper_lantern_red.png',  name: '红灯笼' },
    { id: 'fur_lantern_yellow', x: 160, y: 140, depth: 352, sprite: 'assets/decorations/paper_lantern_yellow.png', name: '黄灯笼' },
    { id: 'fur_bookshelf',    x: 920, y: 300, depth: 353, sprite: 'assets/decorations/wooden_bookshelf.png',   name: '书架' },
    { id: 'fur_incense',      x: 850, y: 360, depth: 354, sprite: 'assets/decorations/incense_burner.png',     name: '香炉' },
    { id: 'fur_guqin',        x: 300, y: 320, depth: 355, sprite: 'assets/decorations/guqin.png',              name: '古琴' },
    { id: 'fur_vase',         x: 700, y: 280, depth: 356, sprite: 'assets/decorations/flower_vase.png',        name: '青花瓷瓶' },
    { id: 'fur_screen',       x: 450, y: 250, depth: 357, sprite: 'assets/decorations/wooden_screen.png',      name: '屏风' },
    { id: 'fur_scroll',       x: 200, y: 200, depth: 358, sprite: 'assets/decorations/hanging_scroll.png',     name: '挂轴' },
  ],

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
  totalAssets: 4 * 3 + 9 + 10 + 3  // 4角色×3动画 + 9自然 + 10家具 + 3背景
};

const LAYOUT = OFFICE_LAYOUT;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = OFFICE_LAYOUT;
}
