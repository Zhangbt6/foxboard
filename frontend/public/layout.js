// FoxBoard 像素办公室 - 四工位布局配置
// 定义四只狐狸的工位坐标和办公室元素
// 配合 game.js 四狐多角色系统使用

const OFFICE_LAYOUT = {
  // === 游戏画布 ===
  game: {
    width: 1280,
    height: 720
  },

  // === 四工位配置 ===
  // 布局：左上火花，右上青狐，左下白狐，右下黑狐
  workstations: [
    {
      id: 'spark',
      agentId: 'fox_leader',
      label: '花火',
      x: 220,          // 角色脚底X（画布坐标系）
      y: 340,          // 角色脚底Y
      deskX: 218,
      deskY: 430,       // 桌子位置（角色身后）
      depth: 900,
      sprites: {
        idle: 'sprites/spark_idle.webp',
        think: 'sprites/spark_think.webp',
        wave: 'sprites/spark_wave.webp',
        working: 'sprites/spark_working.webp',
        wiggle: 'sprites/spark_wiggle.webp'
      }
    },
    {
      id: 'qingfox',
      agentId: 'qing_fox',
      label: '青狐',
      x: 900,
      y: 340,
      deskX: 898,
      deskY: 430,
      depth: 900,
      sprites: {
        idle: 'sprites/qingfox_idle.webp',
        think: 'sprites/qingfox_idle.webp',   // 暂无think用idle代替
        wave: 'sprites/qingfox_idle.webp',    // 暂无wave用idle代替
        working: 'sprites/qingfox_idle.webp', // 暂无working用idle代替
        wiggle: 'sprites/qingfox_idle.webp'   // 暂无wiggle用idle代替
      }
    },
    {
      id: 'whitefox',
      agentId: 'white_fox',
      label: '白狐',
      x: 220,
      y: 540,
      deskX: 218,
      deskY: 630,
      depth: 910,
      sprites: {
        idle: 'sprites/whitefox_idle.webp',
        think: 'sprites/whitefox_idle.webp',
        wave: 'sprites/whitefox_idle.webp',
        working: 'sprites/whitefox_idle.webp',
        wiggle: 'sprites/whitefox_idle.webp'
      }
    },
    {
      id: 'blackfox',
      agentId: 'black_fox',
      label: '黑狐',
      x: 900,
      y: 540,
      deskX: 898,
      deskY: 630,
      depth: 910,
      sprites: {
        idle: 'sprites/blackfox_idle.webp',
        think: 'sprites/blackfox_idle.webp',
        wave: 'sprites/blackfox_idle.webp',
        working: 'sprites/blackfox_idle.webp',
        wiggle: 'sprites/blackfox_idle.webp'
      }
    }
  ],

  // === 共享家具（与原有star-office保持兼容） ===
  furniture: {
    // 沙发（访客区）
    sofa: {
      x: 670, y: 144,
      depth: 10,
      sprite: 'sprites/sofa-idle-v3.png'
    },
    // 服务器区（右上角）
    serverroom: {
      x: 1021, y: 142,
      depth: 2,
      sprite: 'sprites/serverroom-spritesheet.webp'
    },
    // 咖啡机（供休息区）
    coffeeMachine: {
      x: 659, y: 397,
      depth: 99,
      sprite: 'sprites/coffee-machine-v3-grid.webp'
    },
    // 装饰植物
    plants: [
      { x: 565, y: 178, depth: 5, sprite: 'sprites/plants-spritesheet.webp' },
      { x: 230, y: 185, depth: 5, sprite: 'sprites/plants-spritesheet.webp' },
      { x: 977, y: 496, depth: 5, sprite: 'sprites/plants-spritesheet.webp' }
    ],
    // 海报
    poster: {
      x: 252, y: 66, depth: 4,
      sprite: 'sprites/posters-spritesheet.webp'
    },
    // 小猫（访客/吉祥物）
    cat: {
      x: 94, y: 557,
      depth: 2000,
      sprite: 'sprites/cats-spritesheet.webp'
    }
  },

  // === 背景 ===
  background: {
    sprite: 'sprites/office_bg.webp'
  },

  // === 荷花池（粒子特效目标区域）+ Phase 10 国风装饰 ===
  pond: {
    x: 640, y: 380,   // 池中心
    width: 280, height: 120,  // 池范围
    depth: 8           // 水面 depth（低于家具但高于背景）
  },

  // === Phase 10 荷花池国风装饰（莲花池国风背景主体 — FB-088/FB-089）===
  // 层级: WATER(200) 区间，lotus/leaf 在 200-209，koi 在 210-219
  lotusPondDecorations: {
    // 荷花（3种姿态，3x3宫格中的0/1/2号位）
    lotus: [
      { id: 'lotus_0', x: 580, y: 355, depth: 202, sprite: 'sprites/lotus_00.webp' },
      { id: 'lotus_1', x: 620, y: 370, depth: 201, sprite: 'sprites/lotus_01.webp' },
      { id: 'lotus_2', x: 665, y: 350, depth: 203, sprite: 'sprites/lotus_02.webp' },
    ],
    // 荷叶（3种，3x3宫格中的3/4/5号位）
    lilyPad: [
      { id: 'lily_0', x: 560, y: 375, depth: 200, sprite: 'sprites/lily_pad_00.webp' },
      { id: 'lily_1', x: 640, y: 385, depth: 200, sprite: 'sprites/lily_pad_01.webp' },
      { id: 'lily_2', x: 700, y: 368, depth: 200, sprite: 'sprites/lily_pad_02.webp' },
    ],
    // 锦鲤（2种游动姿态）
    koi: [
      { id: 'koi_red',    x: 600, y: 375, depth: 210, sprite: 'sprites/koi_red_00.webp' },
      { id: 'koi_white',  x: 660, y: 380, depth: 211, sprite: 'sprites/koi_white_00.webp' },
    ],
    // 荷花池喷泉/石灯
    accessories: {
      stoneLantern: { x: 750, y: 360, depth: 205, sprite: 'sprites/stone_lantern_00.webp' },
      bridge:       { x: 640, y: 395, depth: 195, sprite: 'sprites/bridge_00.webp' },
    }
  },

  // === Phase 10 天空盘旋转背景系统（FB-087）===
  // LAYERS.SKY_DISC = 0
  skyDisc: {
    enabled: true,
    depth: 0,
    size: 512,           // canvas 尺寸
    radius: 248,        // 天空盘半径
    imageUrl: 'assets/backgrounds/sky_disc_2560.webp',  // 2560px 天空盘素材
    degreesPerSecond: 360 / (24 * 60),  // 24分钟转一圈
    speed: 1.0          // 速度倍率
  },

  // === Phase 10 国风建筑（远山、长廊 — BUILDINGS/CORRIDOR 区间）===
  // LAYERS.BUILDINGS = 300, LAYERS.CORRIDOR = 400
  chineseStyleBuildings: {
    distantMountain: { x: 640, y: 200, depth: 50, sprite: 'sprites/distant_mountain.webp' },
    pavilion:        { x: 150, y: 280, depth: 300, sprite: 'sprites/pavilion.webp' },
    corridor:        { x: 640, y: 440, depth: 400, sprite: 'sprites/corridor.webp' },
  },

  // === Phase 10 9宫格自然装饰（3x3宫格，9种自然风物 — FB-084）===
  // 自然风物：荷花×3, 荷叶×2, 垂柳, 青竹, 石灯, 假山
  // 存储格式: sprite: 'assets/decorations/natural_XX.webp'
  // 其中 XX = 00~08，对应 grid_to_sprites.py 输出的索引
  naturalDecorations: [
    // 宫格索引 0-2: 荷花
    { id: 'nat_lotus_0',   x: 540, y: 360, depth: 204, sprite: 'assets/decorations/natural_00.webp', name: '荷花' },
    { id: 'nat_lotus_1',   x: 580, y: 375, depth: 204, sprite: 'assets/decorations/natural_01.webp', name: '荷花' },
    { id: 'nat_lotus_2',   x: 620, y: 355, depth: 204, sprite: 'assets/decorations/natural_02.webp', name: '荷花' },
    // 宫格索引 3-4: 荷叶
    { id: 'nat_lily_0',    x: 555, y: 380, depth: 203, sprite: 'assets/decorations/natural_03.webp', name: '荷叶' },
    { id: 'nat_lily_1',    x: 645, y: 385, depth: 203, sprite: 'assets/decorations/natural_04.webp', name: '荷叶' },
    // 宫格索引 5: 垂柳
    { id: 'nat_willow',    x: 1100, y: 100, depth: 300, sprite: 'assets/decorations/natural_05.webp', name: '垂柳' },
    // 宫格索引 6: 青竹
    { id: 'nat_bamboo',    x: 1050, y: 150, depth: 301, sprite: 'assets/decorations/natural_06.webp', name: '青竹' },
    // 宫格索引 7: 石灯
    { id: 'nat_stone_lantern', x: 180, y: 250, depth: 302, sprite: 'assets/decorations/natural_07.webp', name: '石灯' },
    // 宫格索引 8: 假山
    { id: 'nat_rockery',   x: 950, y: 500, depth: 303, sprite: 'assets/decorations/natural_08.webp', name: '假山' },
  ],

  // === Phase 10 16宫格科技国风装饰（4x4宫格，16种科技物件 — FB-085）===
  // 存储格式: sprite: 'assets/decorations/tech_XX.webp'
  // 其中 XX = 00~15，对应 grid_to_sprites.py 输出的索引
  techDecorations: [
    { id: 'tech_boat',        x: 640, y: 400, depth: 350, sprite: 'assets/decorations/tech_00.webp', name: '小船' },
    { id: 'tech_drone',       x: 300, y: 120, depth: 351, sprite: 'assets/decorations/tech_01.webp', name: '无人机' },
    { id: 'tech_kongming',    x: 150, y: 180, depth: 352, sprite: 'assets/decorations/tech_02.webp', name: '孔明灯' },
    { id: 'tech_paper_crane', x: 500, y: 80,  depth: 353, sprite: 'assets/decorations/tech_03.webp', name: '纸鹤' },
    { id: 'tech_tea_set',     x: 380, y: 400, depth: 354, sprite: 'assets/decorations/tech_04.webp', name: '茶具' },
    { id: 'tech_abacus',      x: 900, y: 300, depth: 355, sprite: 'assets/decorations/tech_05.webp', name: '算盘' },
    { id: 'tech_lantern',     x: 100, y: 150, depth: 356, sprite: 'assets/decorations/tech_06.webp', name: '灯笼' },
    { id: 'tech_jinchan',     x: 680, y: 380, depth: 357, sprite: 'assets/decorations/tech_07.webp', name: '金蟾' },
    { id: 'tech_firefly_jar', x: 450, y: 320, depth: 358, sprite: 'assets/decorations/tech_08.webp', name: '萤火虫罐' },
    { id: 'tech_inkstone',    x: 920, y: 350, depth: 359, sprite: 'assets/decorations/tech_09.webp', name: '砚台' },
    { id: 'tech_scroll',      x: 200, y: 320, depth: 360, sprite: 'assets/decorations/tech_10.webp', name: '卷轴' },
    { id: 'tech_brush',       x: 940, y: 370, depth: 361, sprite: 'assets/decorations/tech_11.webp', name: '毛笔' },
    { id: 'tech_crown',       x: 850, y: 160, depth: 362, sprite: 'assets/decorations/tech_12.webp', name: '凤冠' },
    { id: 'tech_fan',         x: 350, y: 250, depth: 363, sprite: 'assets/decorations/tech_13.webp', name: '折扇' },
    { id: 'tech_pearl',       x: 700, y: 360, depth: 364, sprite: 'assets/decorations/tech_14.webp', name: '珍珠' },
    { id: 'tech_jade',        x: 600, y: 370, depth: 365, sprite: 'assets/decorations/tech_15.webp', name: '玉佩' },
  ],

  // === Phase 10 角色行走系统（花火/锦鲤互动 — FB-090）===
  // 角色四方向精灵（已在 workstations.sprites 中配置四方向）
  // 行走路径扩展（新增国风区域路点）
  walkSystem: {
    // 花火专用路径
    hanabiWalk: [
      { id: 'hana_desk',    x: 220,  y: 340 },
      { id: 'hana_pond',    x: 640,  y: 370 },
      { id: 'hana_pavilion', x: 150,  y: 280 },
      { id: 'hana_corridor', x: 640,  y: 440 },
      { id: 'hana_window',  x: 1100, y: 200 },
    ],
    // 锦鲤互动路径（围绕荷花池）
    koiInteraction: [
      { id: 'koi_zone_0', x: 580, y: 370 },
      { id: 'koi_zone_1', x: 620, y: 385 },
      { id: 'koi_zone_2', x: 660, y: 375 },
      { id: 'koi_zone_3', x: 640, y: 360 },
    ]
  },

  // === 角色行走路径点 ===
  // 每个点代表办公室内一个可达位置
  waypoints: [
    { id: 'spark_desk', x: 220, y: 340 },
    { id: 'qing_desk',  x: 900, y: 340 },
    { id: 'white_desk', x: 220, y: 540 },
    { id: 'black_desk', x: 900, y: 540 },
    { id: 'breakroom',  x: 420, y: 300 },
    { id: 'window',     x: 1100, y: 200 },
    { id: 'server',     x: 1021, y: 200 },
    { id: 'cat_area',   x: 94,  y: 557 },
    { id: 'coffee',     x: 659, y: 400 },
    { id: 'sofa',       x: 670, y: 200 }
  ],

  // === 粒子特效配置 ===
  particles: {
    // 萤火虫：夜晚漂浮在办公室上空
    firefly: {
      depth: 950,       // UI层之下，角色层之上
      count: 15,
      emitX: { min: 100, max: 1180 },
      emitY: { min: 80, max: 300 }
    },
    // 樱花瓣：从顶部飘落
    petal: {
      depth: 920,
      count: 20,
      emitX: { min: 50, max: 1230 },
      emitY: { min: -20, max: 0 }
    },
    // 水波纹：荷花池区域
    ripple: {
      depth: 9,
      count: 8,
      emitX: { min: 500, max: 780 },
      emitY: { min: 340, max: 420 }
    }
  },

  // === 牌匾（办公室名称） ===
  plaque: {
    x: 640, y: 720 - 36,
    width: 420, height: 44
  },

  // === 加载资源总数（用于进度条） ===
  totalAssets: 4 * 5 + 15  // 4角色×5动画 + 共享资源
};

// game.js 使用 LAYOUT 变量名
const LAYOUT = OFFICE_LAYOUT;

// 兼容导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OFFICE_LAYOUT;
}
