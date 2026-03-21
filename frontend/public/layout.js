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
