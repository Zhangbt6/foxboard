// Star Office UI - 游戏主逻辑
// 依赖: layout.js（必须在这个之前加载）

// ============================================================
// LAYER CONSTANTS - 13层架构 (FB-086)
// ============================================================
// 天空盘(depth0)→远山→背景主体→水面→建筑→长廊→家具→角色→粒子→UI
const LAYERS = {
  SKY_DISC:       0,   // 天空盘 (FB-087)
  DISTANT_MOUNTAIN: 50, // 远山
  BACKGROUND:      100,  // 背景主体
  WATER:          200,  // 水面（荷花池）
  BUILDINGS:      300,  // 建筑
  CORRIDOR:       400,  // 长廊
  FURNITURE:      500,  // 家具（500-799）
  CHARACTERS:     800,  // 角色（800-849）
  PARTICLES:      850,  // 粒子特效（850-899）
  UI_OVERLAY:     900,  // UI覆盖层（900-949）
  TEXT:           950,  // 文字标签（950-999）
  CURSORS:       1000,  // 鼠标坐标（1000-1099）
  TOP:           1100,  // 顶部浮动（气泡/调试1100-1999）
};

// ============================================================
// SKY DISC - 旋转天空系统 (FB-087)
// ============================================================
class SkyDisc {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.angle = 0;
    // 默认360°/24min = 0.25°/s
    this.degreesPerSecond = options.degreesPerSecond || (360 / (24 * 60));
    this.speed = options.speed || 1.0;  // 速度倍率
    this.running = false;
    this.lastTime = 0;
    this.canvas = null;
    this.ctx = null;
    this.size = options.size || 512;
    this.radius = options.radius || Math.floor(this.size / 2);
    this.yOffset = options.yOffset || 0;
    this.clipRect = options.clipRect || null; // {x,y,width,height}
    this.imageUrl = options.imageUrl || '';
    this.discImage = null;
    this.imageReady = false;
    this.imageFailed = false;
    this._rafId = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._ensureCanvas();
    this._loadDiscImage();
    this._animate();
  }

  stop() {
    this.running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  setSpeed(speed) {
    this.speed = speed;
  }

  _ensureCanvas() {
    if (this.canvas) return;
    const container = document.getElementById(this.containerId);
    if (!container) return;
    container.style.position = container.style.position || 'relative';

    // 创建 canvas（位于 Phaser canvas 下方，覆盖全画面作为天空层）
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'sky-disc-canvas';
    this.canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 0;
    `;
    // 实际分辨率匹配游戏画布
    this.canvas.width = LAYOUT.game.width;
    this.canvas.height = LAYOUT.game.height;
    this.ctx = this.canvas.getContext('2d');

    // 插入到 Phaser canvas 之前
    const gameCanvas = container.querySelector('canvas');
    if (gameCanvas) {
      gameCanvas.style.position = 'relative';
      gameCanvas.style.zIndex = '1';
      container.insertBefore(this.canvas, gameCanvas);
    } else {
      container.insertBefore(this.canvas, container.firstChild);
    }
  }

  _loadDiscImage() {
    if (!this.imageUrl || this.discImage || this.imageFailed) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.discImage = img;
      this.imageReady = true;
    };
    img.onerror = () => {
      this.imageFailed = true;
      this.imageReady = false;
      console.warn('[SkyDisc] Failed to load image:', this.imageUrl);
    };
    img.src = this.imageUrl;
  }

  _drawFallbackSky(angle) {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.save();
    ctx.translate(w / 2, h * 0.3);
    ctx.rotate(angle * Math.PI / 180);
    ctx.translate(-w / 2, -h * 0.3);

    const stars = [
      { x: 100, y: 30, r: 2, b: 1.0 }, { x: 300, y: 60, r: 1.5, b: 0.8 },
      { x: 500, y: 20, r: 2, b: 0.9 }, { x: 700, y: 50, r: 1, b: 0.6 },
      { x: 900, y: 35, r: 1.5, b: 0.7 }, { x: 150, y: 100, r: 2, b: 1.0 },
      { x: 400, y: 120, r: 1, b: 0.5 }, { x: 600, y: 90, r: 1.5, b: 0.8 },
      { x: 800, y: 110, r: 2, b: 0.9 }, { x: 1000, y: 45, r: 1, b: 0.6 },
      { x: 1100, y: 80, r: 1.5, b: 0.7 }, { x: 200, y: 150, r: 1, b: 0.5 }
    ];
    for (const s of stars) {
      const flicker = 0.7 + 0.3 * Math.sin(Date.now() / 500 + s.x);
      ctx.globalAlpha = 0.55 * s.b * flicker;
      ctx.fillStyle = '#fffde7';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _drawSkyDisc(angle) {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // 限定天空盘只在背景可见矩形内渲染
    ctx.save();
    if (this.clipRect) {
      ctx.beginPath();
      ctx.rect(this.clipRect.x, this.clipRect.y, this.clipRect.width, this.clipRect.height);
      ctx.clip();
    }

    if (!this.imageReady || !this.discImage) {
      this._drawFallbackSky(angle);
      ctx.restore();
      return;
    }

    const cx = Math.floor(w / 2);
    const cy = Math.floor(h * 0.18 + this.yOffset);
    const r = this.radius;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // 单层贴图旋转，避免多层叠色导致“多时间天空”观感
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle * Math.PI / 180);
    ctx.globalAlpha = 0.95;
    ctx.drawImage(this.discImage, -r, -r, r * 2, r * 2);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(150,190,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  _animate() {
    if (!this.running) return;
    const now = performance.now();
    if (this.lastTime > 0) {
      const delta = now - this.lastTime;
      this.angle += this.degreesPerSecond * this.speed * (delta / 1000);
      if (this.angle >= 360) this.angle -= 360;
      if (this.angle < 0) this.angle += 360;
      this._drawSkyDisc(this.angle);
    }
    this.lastTime = now;
    this._rafId = requestAnimationFrame(() => this._animate());
  }
}

// 天空盘实例（延迟初始化，在 create() 中启动）
let skyDisc = null;

// 检测浏览器是否支持 WebP
let supportsWebP = false;

// 方法 1: 使用 canvas 检测
function checkWebPSupport() {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    if (canvas.getContext && canvas.getContext('2d')) {
      resolve(canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0);
    } else {
      resolve(false);
    }
  });
}

// 方法 2: 使用 image 检测（备用）
function checkWebPSupportFallback() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = 'data:image/webp;base64,UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAABBxAR/Q9ERP8DAABWUDggGAAAADABAJ0BKgEAAQADADQlpAADcAD++/1QAA==';
  });
}

// 获取文件扩展名（根据 WebP 支持情况 + 布局配置的 forcePng）
function getExt(pngFile) {
  // 大部分 webp 版本不存在，强制 PNG 避免 404
  return '.png';
}

const config = {
  type: Phaser.AUTO,
  width: LAYOUT.game.width,
  height: LAYOUT.game.height,
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  transparent: true,
  pixelArt: true,
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scene: { preload: preload, create: create, update: update }
};

let totalAssets = 0;
let loadedAssets = 0;
let loadingProgressBar, loadingProgressContainer, loadingOverlay, loadingText;

// Memo 相关函数
async function loadMemo() {
  const memoDate = document.getElementById('memo-date');
  const memoContent = document.getElementById('memo-content');

  try {
    const response = await fetch('/yesterday-memo?t=' + Date.now(), { cache: 'no-store' });
    const data = await response.json();

    if (data.success && data.memo) {
      memoDate.textContent = data.date || '';
      memoContent.innerHTML = data.memo.replace(/\n/g, '<br>');
    } else {
      memoContent.innerHTML = '<div id="memo-placeholder">暂无昨日日记</div>';
    }
  } catch (e) {
    console.error('加载 memo 失败:', e);
    memoContent.innerHTML = '<div id="memo-placeholder">加载失败</div>';
  }
}

// 更新加载进度
function updateLoadingProgress() {
  loadedAssets++;
  const percent = Math.min(100, Math.round((loadedAssets / totalAssets) * 100));
  if (loadingProgressBar) {
    loadingProgressBar.style.width = percent + '%';
  }
  if (loadingText) {
    loadingText.textContent = `正在加载 Star 的像素办公室... ${percent}%`;
  }
}

// 隐藏加载界面
function hideLoadingOverlay() {
  setTimeout(() => {
    if (loadingOverlay) {
      loadingOverlay.style.transition = 'opacity 0.5s ease';
      loadingOverlay.style.opacity = '0';
      setTimeout(() => {
        loadingOverlay.style.display = 'none';
      }, 500);
    }
  }, 300);
}

const STATES = {
  idle: { name: '待命', area: 'breakroom' },
  writing: { name: '整理文档', area: 'writing' },
  researching: { name: '搜索信息', area: 'researching' },
  executing: { name: '执行任务', area: 'writing' },
  syncing: { name: '同步备份', area: 'writing' },
  error: { name: '出错了', area: 'error' }
};

const BUBBLE_TEXTS = {
  idle: [
    '待命中：耳朵竖起来了',
    '我在这儿，随时可以开工',
    '先把桌面收拾干净再说',
    '呼——给大脑放个风',
    '今天也要优雅地高效',
    '等待，是为了更准确的一击',
    '咖啡还热，灵感也还在',
    '我在后台给你加 Buff',
    '状态：静心 / 充电',
    '小猫说：慢一点也没关系'
  ],
  writing: [
    '进入专注模式：勿扰',
    '先把关键路径跑通',
    '我来把复杂变简单',
    '把 bug 关进笼子里',
    '写到一半，先保存',
    '把每一步都做成可回滚',
    '今天的进度，明天的底气',
    '先收敛，再发散',
    '让系统变得更可解释',
    '稳住，我们能赢'
  ],
  researching: [
    '我在挖证据链',
    '让我把信息熬成结论',
    '找到了：关键在这里',
    '先把变量控制住',
    '我在查：它为什么会这样',
    '把直觉写成验证',
    '先定位，再优化',
    '别急，先画因果图'
  ],
  executing: [
    '执行中：不要眨眼',
    '把任务切成小块逐个击破',
    '开始跑 pipeline',
    '一键推进：走你',
    '让结果自己说话',
    '先做最小可行，再做最美版本'
  ],
  syncing: [
    '同步中：把今天锁进云里',
    '备份不是仪式，是安全感',
    '写入中…别断电',
    '把变更交给时间戳',
    '云端对齐：咔哒',
    '同步完成前先别乱动',
    '把未来的自己从灾难里救出来',
    '多一份备份，少一份后悔'
  ],
  error: [
    '警报响了：先别慌',
    '我闻到 bug 的味道了',
    '先复现，再谈修复',
    '把日志给我，我会说人话',
    '错误不是敌人，是线索',
    '把影响面圈起来',
    '先止血，再手术',
    '我在：马上定位根因',
    '别怕，这种我见多了',
    '报警中：让问题自己现形'
  ],
  cat: [
    '喵~',
    '咕噜咕噜…',
    '尾巴摇一摇',
    '晒太阳最开心',
    '有人来看我啦',
    '我是这个办公室的吉祥物',
    '伸个懒腰',
    '今天的罐罐准备好了吗',
    '呼噜呼噜',
    '这个位置视野最好'
  ]
};

let game, star, sofa, serverroom, areas = {}, currentState = 'idle', pendingDesiredState = null, statusText, lastFetch = 0, lastBlink = 0, lastBubble = 0, targetX = 660, targetY = 170, bubble = null, typewriterText = '', typewriterTarget = '', typewriterIndex = 0, lastTypewriter = 0, syncAnimSprite = null, catBubble = null;
let isMoving = false;
let waypoints = [];
let lastWanderAt = 0;
let coordsOverlay, coordsDisplay, coordsToggle;
let showCoords = false;
const FETCH_INTERVAL = 2000;
const BLINK_INTERVAL = 2500;
const BUBBLE_INTERVAL = 8000;
const CAT_BUBBLE_INTERVAL = 18000;
let lastCatBubble = 0;
const TYPEWRITER_DELAY = 50;
let agents = {}; // agentId -> sprite/container
let lastAgentsFetch = 0;
const AGENTS_FETCH_INTERVAL = 2500;
let phaserApp = null;
const WORKSTATION_POSITIONS_KEY = 'foxboard_pixel_office_workstations_v1';

function loadWorkstationPositions() {
  try {
    const raw = localStorage.getItem(WORKSTATION_POSITIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (_e) {
    return {};
  }
}

function saveWorkstationPosition(agentId, x, y) {
  if (!agentId) return;
  const positions = loadWorkstationPositions();
  positions[agentId] = { x: Math.round(x), y: Math.round(y) };
  try {
    localStorage.setItem(WORKSTATION_POSITIONS_KEY, JSON.stringify(positions));
  } catch (_e) {
    // 忽略存储异常（隐私模式/容量限制）
  }
}

// agent 颜色配置
const AGENT_COLORS = {
  star: 0xffd700,
  npc1: 0x00aaff,
  agent_nika: 0xff69b4,
  default: 0x94a3b8
};

// agent 名字颜色
const NAME_TAG_COLORS = {
  approved: 0x22c55e,
  pending: 0xf59e0b,
  rejected: 0xef4444,
  offline: 0x64748b,
  default: 0x1f2937
};

// breakroom / writing / error 区域的 agent 分布位置（多 agent 时错开）
const AREA_POSITIONS = {
  breakroom: [
    { x: 620, y: 180 },
    { x: 560, y: 220 },
    { x: 680, y: 210 },
    { x: 540, y: 170 },
    { x: 700, y: 240 },
    { x: 600, y: 250 },
    { x: 650, y: 160 },
    { x: 580, y: 200 }
  ],
  writing: [
    { x: 760, y: 320 },
    { x: 830, y: 280 },
    { x: 690, y: 350 },
    { x: 770, y: 260 },
    { x: 850, y: 340 },
    { x: 720, y: 300 },
    { x: 800, y: 370 },
    { x: 750, y: 240 }
  ],
  error: [
    { x: 180, y: 260 },
    { x: 120, y: 220 },
    { x: 240, y: 230 },
    { x: 160, y: 200 },
    { x: 220, y: 270 },
    { x: 140, y: 250 },
    { x: 200, y: 210 },
    { x: 260, y: 260 }
  ]
};


// 状态控制栏函数（用于测试）
function setState(state, detail) {
  fetch('/set_state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, detail })
  }).then(() => fetchStatus());
}

// 初始化：先检测 WebP 支持，再启动游戏
async function initGame() {
  const container = document.getElementById('game-container');
  if (!container) {
    console.warn('[PixelOffice] #game-container not found, skip init.');
    return null;
  }
  if (typeof Phaser === 'undefined') {
    console.warn('[PixelOffice] Phaser not ready, skip init.');
    return null;
  }
  if (phaserApp) {
    return phaserApp;
  }

  try {
    supportsWebP = await checkWebPSupport();
  } catch (e) {
    try {
      supportsWebP = await checkWebPSupportFallback();
    } catch (e2) {
      supportsWebP = false;
    }
  }

  console.log('WebP 支持:', supportsWebP);
  phaserApp = new Phaser.Game(config);
  return phaserApp;
}

function destroyGame() {
  if (window.testNikaTimer) {
    clearInterval(window.testNikaTimer);
    window.testNikaTimer = null;
  }

  if (skyDisc) {
    skyDisc.stop();
    if (skyDisc.canvas && skyDisc.canvas.parentNode) {
      skyDisc.canvas.parentNode.removeChild(skyDisc.canvas);
    }
    skyDisc.canvas = null;
    skyDisc.ctx = null;
    skyDisc = null;
  }

  if (phaserApp) {
    phaserApp.destroy(true);
    phaserApp = null;
  }

  const container = document.getElementById('game-container');
  if (container) {
    container.innerHTML = '';
  }

  agents = {};
  lastFetch = 0;
  lastAgentsFetch = 0;
  walkSystemActive = false;
  for (const id of Object.keys(characterWalkers)) {
    delete characterWalkers[id];
  }

  if (window.workstationSprites) delete window.workstationSprites;
  if (window.sparkManualAnim) delete window.sparkManualAnim;
}

function preload() {
  loadingOverlay = document.getElementById('loading-overlay');
  loadingProgressBar = document.getElementById('loading-progress-bar');
  loadingText = document.getElementById('loading-text');
  loadingProgressContainer = document.getElementById('loading-progress-container');

  // 从 LAYOUT 读取总资源数量（避免 magic number）
  totalAssets = LAYOUT.totalAssets || 15;
  loadedAssets = 0;

  this.load.on('filecomplete', () => {
    updateLoadingProgress();
  });

  this.load.on('loaderror', (file) => {
    console.warn('[Phaser] Failed to load:', file.key, file.url);
  });
  this.load.on('complete', () => {
    hideLoadingOverlay();
  });

  const V = '?v=20260322d';

  // === 背景 ===
  this.load.image('office_bg', '/' + LAYOUT.background.sprite + V);

  // === 天空盘 ===
  if (LAYOUT.skyDisc && LAYOUT.skyDisc.enabled) {
    this.load.image('sky_disc', '/' + LAYOUT.skyDisc.imageUrl + V);
  }

  // === 角色：从 LAYOUT.workstations 动态加载 ===
  LAYOUT.workstations.forEach(ws => {
    Object.entries(ws.sprites).forEach(([action, path]) => {
      const key = ws.id + '_' + action;
      if (!path) return;
      // 4帧 spritesheet (256x64) for webp, 单帧 image for png
      if (path.endsWith('.webp')) {
        this.load.spritesheet(key, '/' + path + V, { frameWidth: 64, frameHeight: 64 });
      } else {
        this.load.image(key, '/' + path + V);
      }
    });
  });

  // === 兼容旧key: star_idle / star_researching ===
  if (!this.load.textureManager || true) {
    this.load.spritesheet('star_idle', '/sprites/spark_idle.webp' + V, { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('star_researching', '/sprites/spark_idle.webp' + V, { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('star_working', '/static/star-working-spritesheet-grid' + (supportsWebP ? '.webp' : '.png') + V, { frameWidth: 230, frameHeight: 144 });
  }

  // === 自然装饰物 ===
  if (LAYOUT.naturalDecorations) {
    LAYOUT.naturalDecorations.forEach(d => {
      this.load.image(d.id, '/' + d.sprite + V);
    });
  }

  // === 家具装饰物 ===
  if (LAYOUT.furnitureDecorations) {
    LAYOUT.furnitureDecorations.forEach(d => {
      this.load.image(d.id, '/' + d.sprite + V);
    });
  }

  // === Legacy 共享素材（仍在使用的） ===
  this.load.spritesheet('serverroom', '/static/serverroom-spritesheet' + getExt('serverroom-spritesheet.png') + V, { frameWidth: 180, frameHeight: 251 });
  this.load.spritesheet('error_bug', '/static/error-bug-spritesheet-grid' + (supportsWebP ? '.webp' : '.png') + V, { frameWidth: 180, frameHeight: 180 });
  this.load.spritesheet('cats', '/static/cats-spritesheet' + (supportsWebP ? '.webp' : '.png') + V, { frameWidth: 160, frameHeight: 160 });
}

// ============================================================
// 粒子特效系统 - FB-090
// 萤火虫 / 樱花瓣 / 水面波纹
// ============================================================

// 粒子纹理缓存（key => Phaser.Textures.Texture）
const particleTextures = {};

/**
 * 在 create() 中调用：生成所有粒子纹理
 */
function createParticleTextures(scene) {
  // --- 萤火虫：发光小圆点 ---
  const ffGfx = scene.make.graphics({ x: 0, y: 0, add: false });
  // 外发光
  ffGfx.fillStyle(0xffff88, 0.3);
  ffGfx.fillCircle(8, 8, 8);
  ffGfx.fillStyle(0xffffaa, 0.6);
  ffGfx.fillCircle(8, 8, 5);
  ffGfx.fillStyle(0xffffff, 1.0);
  ffGfx.fillCircle(8, 8, 2);
  ffGfx.generateTexture('firefly_tex', 16, 16);
  ffGfx.destroy();
  particleTextures.firefly = 'firefly_tex';

  // --- 樱花瓣：粉色椭圆 ---
  const ptGfx = scene.make.graphics({ x: 0, y: 0, add: false });
  ptGfx.fillStyle(0xffb7c5, 0.9);
  ptGfx.fillEllipse(7, 5, 8, 5);
  ptGfx.fillStyle(0xffd5e0, 0.7);
  ptGfx.fillEllipse(6, 4, 5, 3);
  ptGfx.generateTexture('petal_tex', 14, 10);
  ptGfx.destroy();
  particleTextures.petal = 'petal_tex';

  // --- 水滴：蓝色小圆 ---
  const wdGfx = scene.make.graphics({ x: 0, y: 0, add: false });
  wdGfx.fillStyle(0x88ccff, 0.8);
  wdGfx.fillCircle(5, 5, 5);
  wdGfx.fillStyle(0xaaeeff, 1.0);
  wdGfx.fillCircle(5, 5, 2);
  wdGfx.generateTexture('waterdrop_tex', 10, 10);
  wdGfx.destroy();
  particleTextures.waterdrop = 'waterdrop_tex';

  // --- 水波圆环：同心圆 ---
  const rpGfx = scene.make.graphics({ x: 0, y: 0, add: false });
  rpGfx.lineStyle(1.5, 0x88ccff, 0.8);
  rpGfx.strokeCircle(12, 12, 10);
  rpGfx.lineStyle(1.0, 0xaaddff, 0.5);
  rpGfx.strokeCircle(12, 12, 6);
  rpGfx.lineStyle(0.5, 0xccEEFF, 0.3);
  rpGfx.strokeCircle(12, 12, 2);
  rpGfx.generateTexture('ripple_tex', 24, 24);
  rpGfx.destroy();
  particleTextures.ripple = 'ripple_tex';
}

/**
 * 在 create() 中调用：创建所有粒子发射器
 */
let fireflyEmitter, petalEmitter, rippleEmitter;

function createParticleEmitters(scene) {
  const cfg = LAYOUT.particles;
  const pond = LAYOUT.pond;

  // --- 萤火虫：随机漂浮，发光闪烁 ---
  fireflyEmitter = scene.add.particles(0, 0, particleTextures.firefly, {
    x: { min: cfg.firefly.emitX.min, max: cfg.firefly.emitX.max },
    y: { min: cfg.firefly.emitY.min, max: cfg.firefly.emitY.max },
    lifespan: 6000,
    speedY: { min: -8, max: 8 },
    speedX: { min: -15, max: 15 },
    scale: { start: 0.5, end: 0.2 },
    alpha: { start: 0.9, end: 0.0 },
    tint: [0xffffaa, 0xaaffaa, 0xffffff, 0xffee88],
    frequency: 400,
    quantity: 1,
    blendMode: 'ADD',
    emitting: true,
    lifespan: { min: 4000, max: 8000 },
    angle: { min: 0, max: 360 }
  });
  fireflyEmitter.setDepth(LAYERS.PARTICLES);

  // --- 樱花瓣：从上往下飘落，轻微左右摇摆 ---
  petalEmitter = scene.add.particles(0, 0, particleTextures.petal, {
    x: { min: cfg.petal.emitX.min, max: cfg.petal.emitX.max },
    y: { min: cfg.petal.emitY.min, max: cfg.petal.emitY.max },
    lifespan: 12000,
    speedY: { min: 20, max: 50 },
    speedX: { min: -20, max: 20 },
    scale: { start: 0.7, end: 0.4 },
    alpha: { start: 0.85, end: 0.0 },
    tint: [0xffb7c5, 0xffd0dd, 0xffe8ee, 0xffc5d5],
    rotate: { min: -180, max: 180 },
    frequency: 150,
    quantity: 1,
    gravityY: 10,
    emitting: true
  });
  petalEmitter.setDepth(LAYERS.PARTICLES);

  // --- 水面波纹：在荷花池区域周期出现 ---
  rippleEmitter = scene.add.particles(pond.x, pond.y, particleTextures.ripple, {
    x: { min: -pond.width / 2, max: pond.width / 2 },
    y: { min: -pond.height / 2, max: pond.height / 2 },
    lifespan: 2500,
    scale: { start: 0.6, end: 1.8 },
    alpha: { start: 0.7, end: 0.0 },
    tint: 0x88ccff,
    frequency: 600,
    quantity: 1,
    emitting: true,
    rotate: { min: 0, max: 360 },
    speed: 0
  });
  rippleEmitter.setDepth(LAYERS.PARTICLES);
}

/**
 * 每帧更新：萤火虫仅在夜间模式启用
 * 夜间模式由 window.nightMode 控制（由外部切换）
 */
let lastNightCheck = 0;
function updateParticles(time) {
  if (time - lastNightCheck < 2000) return;
  lastNightCheck = time;
  const isNight = window.nightMode === true;
  if (fireflyEmitter) fireflyEmitter.emitting = isNight;
  // 花瓣和水波始终开启
}

// ============================================================
// 角色行走系统 - FB-088
// 预设路径点随机移动 + 方向判定切换sprite flip
// ============================================================

/**
 * 单个角色的行走状态
 */
class CharacterWalker {
  constructor(agentId, sprite, nameTag, homeX, homeY) {
    this.agentId = agentId;
    this.sprite = sprite;
    this.nameTag = nameTag;
    this.homeX = homeX;
    this.homeY = homeY;
    this.x = homeX;
    this.y = homeY;
    this.targetX = homeX;
    this.targetY = homeY;
    this.speed = 60; // pixels per second
    this.isMoving = false;
    this.facingLeft = false;
    this.moveTimer = 0;
    this.nextMoveDelay = this._randomDelay(); // ms until next move
    this.lastUpdate = 0;
    this.waypoints = LAYOUT.waypoints || [];
  }

  _randomDelay() {
    // 30-120秒随机换目的地
    return (30 + Math.random() * 90) * 1000;
  }

  _pickRandomWaypoint() {
    // 排除当前所在位置
    const candidates = this.waypoints.filter(wp =>
      Math.abs(wp.x - this.x) > 20 || Math.abs(wp.y - this.y) > 20
    );
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  startMovingTo(targetX, targetY) {
    this.targetX = targetX;
    this.targetY = targetY;
    this.isMoving = true;
    // 方向判定
    this.facingLeft = targetX < this.x;
    if (this.sprite) {
      this.sprite.setFlipX(this.facingLeft);
    }
  }

  update(time, delta) {
    if (!this.isMoving || !this.sprite) return;

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 2) {
      // 到达目标
      this.x = this.targetX;
      this.y = this.targetY;
      this.isMoving = false;
      if (this.sprite) this.sprite.setFlipX(false);
      return;
    }

    // 线性移动
    const move = this.speed * (delta / 1000);
    const ratio = Math.min(move / dist, 1);
    this.x += dx * ratio;
    this.y += dy * ratio;

    // 更新 sprite 和 nameTag 位置
    if (this.sprite) {
      this.sprite.x = this.x;
      this.sprite.y = this.y;
    }
    if (this.nameTag) {
      this.nameTag.x = this.x;
      this.nameTag.y = this.y - 42;
    }
  }

  /**
   * 每帧调用：处理计时器，决定是否开始新移动
   */
  tick(time, delta) {
    if (!this.isMoving) {
      this.moveTimer += delta;
      if (this.moveTimer >= this.nextMoveDelay) {
        this.moveTimer = 0;
        this.nextMoveDelay = this._randomDelay();
        const wp = this._pickRandomWaypoint();
        if (wp) {
          this.startMovingTo(wp.x, wp.y);
        }
      }
    }
    this.update(time, delta);
  }
}

// 所有角色的walker实例
const characterWalkers = {};
let walkSystemActive = false;

function initCharacterWalkers() {
  if (walkSystemActive) return;
  const WS = window.OFFICE_LAYOUT || LAYOUT.workstations;
  if (!WS || !window.workstationSprites) return;

  for (const ws of WS) {
    const agentId = ws.agentId;
    const sp = window.workstationSprites[agentId];
    const nameTag = window.workstationSprites[agentId + '_nameTag'];
    if (!sp) continue;
    characterWalkers[agentId] = new CharacterWalker(
      agentId, sp, nameTag, ws.x, ws.y
    );
  }
  walkSystemActive = true;
}

function updateCharacterWalkers(time, delta) {
  if (!walkSystemActive) return;
  for (const walker of Object.values(characterWalkers)) {
    walker.tick(time, delta);
  }
}

// ============================================================
// 主 create() - 13层架构
// ============================================================
function create() {
  game = this;
  const _t = (k) => this.textures.exists(k);

  // --- LAYER 100: 背景主体（莲花池）---
  // 使用 contain 缩放，确保整幅背景都能看见（不被过度放大裁切）
  const bgSprite = this.add.image(LAYOUT.game.width / 2, LAYOUT.game.height / 2, 'office_bg').setDepth(LAYERS.BACKGROUND);
  const bgTex = this.textures.get('office_bg');
  if (bgTex && bgTex.getSourceImage) {
    const src = bgTex.getSourceImage();
    if (src && src.width && src.height) {
      const sx = LAYOUT.game.width / src.width;
      const sy = LAYOUT.game.height / src.height;
      bgSprite.setScale(Math.min(sx, sy));
    }
  }

  // --- LAYER 0: 天空盘 (FB-087) ---
  if (LAYOUT.skyDisc && LAYOUT.skyDisc.enabled) {
    const skyUrl = '/' + String(LAYOUT.skyDisc.imageUrl || '').replace(/^\/+/, '') + '?v=20260322d';
    const bgBounds = bgSprite.getBounds();
    skyDisc = new SkyDisc('game-container', {
      degreesPerSecond: LAYOUT.skyDisc.degreesPerSecond || (360 / (24 * 60)),
      speed: LAYOUT.skyDisc.speed || 1.0,
      size: LAYOUT.skyDisc.size || 500,
      radius: LAYOUT.skyDisc.radius || Math.floor((LAYOUT.skyDisc.size || 500) / 2),
      yOffset: LAYOUT.skyDisc.yOffset || 0,
      clipRect: {
        x: bgBounds.x,
        y: bgBounds.y,
        width: bgBounds.width,
        height: bgBounds.height
      },
      imageUrl: skyUrl
    });
    skyDisc.start();
  }

  // --- 自然装饰物 ---
  if (LAYOUT.naturalDecorations) {
    LAYOUT.naturalDecorations.forEach(d => {
      if (_t(d.id)) {
        this.add.image(d.x, d.y, d.id).setDepth(d.depth).setOrigin(0.5);
      }
    });
  }

  // --- 家具装饰物 ---
  if (LAYOUT.furnitureDecorations) {
    LAYOUT.furnitureDecorations.forEach(d => {
      if (_t(d.id)) {
        this.add.image(d.x, d.y, d.id).setDepth(d.depth).setOrigin(0.5);
      }
    });
  }

  // 生成粒子纹理 & 创建发射器
  createParticleTextures(this);
  createParticleEmitters(this);

  // ============================================================
  // 互动系统 - FB-089
  // 点击荷花绽放 + 水面动态
  // ============================================================

  // --- 金币纹理（程序化）---
  const coinGfx = this.make.graphics({ x: 0, y: 0, add: false });
  coinGfx.fillStyle(0xffd700, 1.0);
  coinGfx.fillCircle(8, 8, 7);
  coinGfx.fillStyle(0xffee88, 0.8);
  coinGfx.fillCircle(7, 7, 4);
  coinGfx.lineStyle(1, 0xcc9900, 1);
  coinGfx.strokeCircle(8, 8, 7);
  coinGfx.generateTexture('coin_tex', 16, 16);
  coinGfx.destroy();

  // --- 荷花池点击区 & 荷花精灵 ---
  const pond = LAYOUT.pond;
  const pondCenterX = pond.x;
  const pondCenterY = pond.y;

  // 荷花sprite（位于池子中央偏左）
  const lotusGfx = this.make.graphics({ x: 0, y: 0, add: false });
  // 荷叶底
  lotusGfx.fillStyle(0x228b22, 0.9);
  lotusGfx.fillEllipse(20, 24, 28, 14);
  // 花瓣
  const petalColors = [0xffb7c5, 0xff91a8, 0xffe0e8];
  for (let i = 0; i < 6; i++) {
    lotusGfx.fillStyle(petalColors[i % petalColors.length], 0.9);
    const angle = (i / 6) * Math.PI * 2;
    const px = 20 + Math.cos(angle) * 9;
    const py = 14 + Math.sin(angle) * 7;
    lotusGfx.fillEllipse(px, py, 8, 12);
  }
  // 花蕊
  lotusGfx.fillStyle(0xffdd00, 1.0);
  lotusGfx.fillCircle(20, 14, 4);
  lotusGfx.generateTexture('lotus_tex', 40, 32);
  lotusGfx.destroy();

  // 交互荷花进一步左移，落在左侧池区
  const lotusX = pondCenterX - Math.floor(pond.width * 1.05);
  const lotusY = pondCenterY - 4;
  const lotusSprite = this.add.sprite(lotusX, lotusY, 'lotus_tex');
  lotusSprite.setDepth(LAYERS.WATER + 1);
  lotusSprite.setScale(1.2);
  lotusSprite.setInteractive({ useHandCursor: true });

  // --- 荷花点击：3帧绽放动画 + 花瓣粒子爆发 ---
  let lotusBlooming = false;
  const lotusEmitter = this.add.particles(0, 0, particleTextures.petal || 'petal_tex', {
    lifespan: 1500,
    speedX: { min: -80, max: 80 },
    speedY: { min: -120, max: -30 },
    scale: { start: 0.6, end: 0.1 },
    alpha: { start: 1.0, end: 0.0 },
    tint: [0xffb7c5, 0xff91a8, 0xffe0e8, 0xffd0dd],
    rotate: { min: -180, max: 180 },
    frequency: 30,
    quantity: 3,
    emitting: false,
    gravityY: 80
  });
  lotusEmitter.setDepth(LAYERS.WATER + 2);

  lotusSprite.on('pointerdown', () => {
    if (lotusBlooming) return;
    lotusBlooming = true;
    lotusEmitter.setPosition(lotusSprite.x, lotusSprite.y);
    lotusEmitter.explode(12);
    // 3帧绽放：scale 1.2→1.8→2.2→1.2
    this.tweens.add({
      targets: lotusSprite,
      scaleX: 1.8,
      scaleY: 1.8,
      alpha: 1,
      duration: 200,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: lotusSprite,
          scaleX: 2.2,
          scaleY: 2.2,
          duration: 200,
          ease: 'Cubic.easeOut',
          onComplete: () => {
            this.tweens.add({
              targets: lotusSprite,
              scaleX: 1.2,
              scaleY: 1.2,
              duration: 400,
              ease: 'Cubic.easeIn',
              onComplete: () => { lotusBlooming = false; }
            });
          }
        });
      }
    });
  });

  // 锦鲤交互先移除：保留荷花交互与水面动画

  // 中央蓝色水底块已移除：避免覆盖背景池面细节

  // === 沙发（来自 LAYOUT）===
  if (_t('sofa_busy')) {
    sofa = this.add.sprite(
      LAYOUT.furniture.sofa.x,
      LAYOUT.furniture.sofa.y,
      'sofa_busy'
    ).setOrigin(LAYOUT.furniture.sofa.origin.x, LAYOUT.furniture.sofa.origin.y);
    sofa.setDepth(LAYOUT.furniture.sofa.depth);
    this.anims.create({
      key: 'sofa_busy',
      frames: this.anims.generateFrameNumbers('sofa_busy', { start: 0, end: 47 }),
      frameRate: 12,
      repeat: -1
    });
  } else if (_t('sofa_idle')) {
    sofa = this.add.image(
      LAYOUT.furniture.sofa.x,
      LAYOUT.furniture.sofa.y,
      'sofa_idle'
    ).setOrigin(LAYOUT.furniture.sofa.origin.x, LAYOUT.furniture.sofa.origin.y);
    sofa.setDepth(LAYOUT.furniture.sofa.depth);
  }

  areas = LAYOUT.areas;

  if (_t('star_idle')) {
    this.anims.create({
      key: 'star_idle',
      frames: this.anims.generateFrameNumbers('star_idle', { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1
    });
  }
  if (_t('star_researching')) {
    this.anims.create({
      key: 'star_researching',
      frames: this.anims.generateFrameNumbers('star_researching', { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1
    });
  }

  // 通用：仅对 4 帧 spritesheet 生成动画
  const createAnimIfAvailable = (textureKey, animKey, frameRate = 8, reverse = false) => {
    if (!this.textures.exists(textureKey)) return false;
    const tex = this.textures.get(textureKey);
    if (!tex || tex.frameTotal < 4) return false;
    if (this.anims.exists(animKey)) return true;
    const frames = reverse
      ? this.anims.generateFrameNumbers(textureKey, { start: 3, end: 0 })
      : this.anims.generateFrameNumbers(textureKey, { start: 0, end: 3 });
    this.anims.create({
      key: animKey,
      frames,
      frameRate,
      repeat: -1
    });
    return true;
  };

  // 花火四套动画
  createAnimIfAvailable('spark_idle', 'spark_idle_anim', 4);
  createAnimIfAvailable('spark_wave', 'spark_wave_anim', 4);
  createAnimIfAvailable('spark_wiggle', 'spark_wiggle_anim', 4);
  createAnimIfAvailable('spark_think', 'spark_think_anim', 4);
  createAnimIfAvailable('spark_working', 'spark_working_anim', 4);
  createAnimIfAvailable('spark_walk', 'spark_walk_anim', 4);
  createAnimIfAvailable('spark_sit', 'spark_sit_anim', 4);

  // 三狐动画：用各自资源，不复用花火
  const foxNames = ['qingfox', 'whitefox', 'blackfox'];
  const foxActions = ['idle', 'wave', 'working', 'think', 'wiggle', 'walk', 'sit'];
  for (const fox of foxNames) {
    for (const action of foxActions) {
      createAnimIfAvailable(`${fox}_${action}`, `${fox}_${action}_anim`, 3, fox === 'qingfox');
    }
  }

  // === 四狐多角色：创建四只狐狸的工作站精灵 ===
  // 如果 OFFICE_LAYOUT 存在（新版四工位），使用它；否则回退到原有 LAYOUT（单工位）
  const WS = (typeof OFFICE_LAYOUT !== 'undefined') ? OFFICE_LAYOUT.workstations : null;

  // 四只狐狸的工作站 sprite 对象
  const workstationSprites = {};

  if (WS) {
    const savedPositions = loadWorkstationPositions();
    // 新版：四工位模式，从 OFFICE_LAYOUT 读取
    for (const ws of WS) {
      const agentId = ws.agentId;
      const saved = savedPositions[agentId];
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        ws.x = saved.x;
        ws.y = saved.y;
      }
      // 优先使用可动画化的 idle 资源
      let spriteKey = null;
      const preferred = [
        ws.id + '_idle',
        ws.id + '_working',
        ws.id + '_wave',
        ws.id + '_think',
        ws.id + '_wiggle',
        ws.id + '_walk',
        ws.id + '_sit'
      ];
      for (const key of preferred) {
        if (!game.textures.exists(key)) continue;
        const tex = this.textures.get(key);
        if (tex && tex.frameTotal >= 4) {
          spriteKey = key;
          break;
        }
      }
      if (!spriteKey) {
        for (const key of preferred) {
          if (game.textures.exists(key)) {
            spriteKey = key;
            break;
          }
        }
      }
      if (!spriteKey) spriteKey = 'spark_idle'; // fallback

      const sp = game.add.sprite(ws.x, ws.y, spriteKey);
      sp.setOrigin(0.5);
      sp.setDepth(ws.depth || LAYERS.CHARACTERS);
      sp.setVisible(true);
      if (ws.id === 'qingfox') {
        sp.setFlipX(true);
      }
      if (this.anims.exists(spriteKey + '_anim')) {
        sp.anims.play(spriteKey + '_anim', true);
      }
      workstationSprites[agentId] = sp;

      // 名字标签
      const nameTag = game.add.text(ws.x, ws.y - 42, ws.label, {
        fontFamily: 'ArkPixel, monospace',
        fontSize: '12px',
        fill: '#ffffff',
        stroke: '#000',
        strokeThickness: 3
      }).setOrigin(0.5);
      nameTag.setDepth(LAYERS.TEXT);
      workstationSprites[agentId + '_nameTag'] = nameTag;

      // 可拖动位置：运行时调整工位摆放
      sp.setInteractive({ useHandCursor: true, draggable: true });
      this.input.setDraggable(sp);
      sp.on('dragstart', () => {
        const walker = characterWalkers[agentId];
        if (walker) {
          walker.isMoving = false;
        }
      });
      sp.on('drag', (_pointer, dragX, dragY) => {
        sp.x = dragX;
        sp.y = dragY;
        nameTag.x = dragX;
        nameTag.y = dragY - 42;
        const walker = characterWalkers[agentId];
        if (walker) {
          walker.x = dragX;
          walker.y = dragY;
          walker.targetX = dragX;
          walker.targetY = dragY;
        }
      });
      sp.on('dragend', () => {
        const walker = characterWalkers[agentId];
        if (walker) {
          walker.homeX = sp.x;
          walker.homeY = sp.y;
          walker.x = sp.x;
          walker.y = sp.y;
          walker.moveTimer = 0;
        }
        saveWorkstationPosition(agentId, sp.x, sp.y);
      });

      // 点击切换花火动画
      if (ws.id === 'spark') {
        const cycle = ['spark_idle_anim', 'spark_wave_anim', 'spark_wiggle_anim', 'spark_think_anim'];
        let cycleIndex = Math.max(0, cycle.indexOf(sp.anims?.currentAnim?.key || 'spark_idle_anim'));
        sp.on('pointerdown', () => {
          cycleIndex = (cycleIndex + 1) % cycle.length;
          const anim = cycle[cycleIndex];
          window.sparkManualAnim = anim;
          if (game.anims.exists(anim)) {
            sp.anims.play(anim, true);
          }
        });
      }
    }
    window.workstationSprites = workstationSprites;
    // 角色行走系统初始化
    initCharacterWalkers();
  }

  if (_t('star_idle')) {
    star = game.physics.add.sprite(areas.breakroom.x, areas.breakroom.y, 'star_idle');
    star.setOrigin(0.5);
    star.setScale(1.4);
    star.setAlpha(0.95);
    star.setDepth(LAYERS.CHARACTERS);
    star.setVisible(false);
    star.anims.stop();
  }

  if (sofa && _t('sofa_busy')) {
    sofa.setTexture('sofa_busy');
    sofa.anims.play('sofa_busy', true);
  }

  // === 牌匾（来自 LAYOUT）===
  const plaqueX = LAYOUT.plaque.x;
  const plaqueY = LAYOUT.plaque.y;
  const plaqueBg = game.add.rectangle(plaqueX, plaqueY, LAYOUT.plaque.width, LAYOUT.plaque.height, 0x5d4037);
  plaqueBg.setStrokeStyle(3, 0x3e2723);
  plaqueBg.setDepth(LAYERS.UI_OVERLAY);
  const plaqueText = game.add.text(plaqueX, plaqueY, '海辛小龙虾的办公室', {
    fontFamily: 'ArkPixel, monospace',
    fontSize: '18px',
    fill: '#ffd700',
    fontWeight: 'bold',
    stroke: '#000',
    strokeThickness: 2
  }).setOrigin(0.5);
  plaqueText.setDepth(LAYERS.UI_OVERLAY);
  game.add.text(plaqueX - 190, plaqueY, '⭐', { fontFamily: 'ArkPixel, monospace', fontSize: '20px' }).setOrigin(0.5).setDepth(LAYERS.UI_OVERLAY);
  game.add.text(plaqueX + 190, plaqueY, '⭐', { fontFamily: 'ArkPixel, monospace', fontSize: '20px' }).setOrigin(0.5).setDepth(LAYERS.UI_OVERLAY);

  // === 植物们（来自 LAYOUT）===
  if (_t('plants')) {
    const plantFrameCount = 16;
    for (let i = 0; i < LAYOUT.furniture.plants.length; i++) {
      const p = LAYOUT.furniture.plants[i];
      const randomPlantFrame = Math.floor(Math.random() * plantFrameCount);
      const plant = game.add.sprite(p.x, p.y, 'plants', randomPlantFrame).setOrigin(0.5);
      plant.setDepth(p.depth);
      plant.setInteractive({ useHandCursor: true });
      window[`plantSprite${i === 0 ? '' : i + 1}`] = plant;
      plant.on('pointerdown', (() => {
        const next = Math.floor(Math.random() * plantFrameCount);
        plant.setFrame(next);
      }));
    }
  }

  // === 海报（来自 LAYOUT）===
  if (_t('posters')) {
    const postersFrameCount = 32;
    const randomPosterFrame = Math.floor(Math.random() * postersFrameCount);
    const poster = game.add.sprite(LAYOUT.furniture.poster.x, LAYOUT.furniture.poster.y, 'posters', randomPosterFrame).setOrigin(0.5);
    poster.setDepth(LAYOUT.furniture.poster.depth);
    poster.setInteractive({ useHandCursor: true });
    window.posterSprite = poster;
    window.posterFrameCount = postersFrameCount;
    poster.on('pointerdown', () => {
      const next = Math.floor(Math.random() * window.posterFrameCount);
      window.posterSprite.setFrame(next);
    });
  }

  // === 小猫（来自 LAYOUT）===
  if (_t('cats')) {
    const catsFrameCount = 16;
    const randomCatFrame = Math.floor(Math.random() * catsFrameCount);
    const cat = game.add.sprite(LAYOUT.furniture.cat.x, LAYOUT.furniture.cat.y, 'cats', randomCatFrame).setOrigin(LAYOUT.furniture.cat.origin.x, LAYOUT.furniture.cat.origin.y);
    cat.setDepth(LAYOUT.furniture.cat.depth);
    cat.setInteractive({ useHandCursor: true });
    window.catSprite = cat;
    window.catsFrameCount = catsFrameCount;
    cat.on('pointerdown', () => {
      const next = Math.floor(Math.random() * window.catsFrameCount);
      window.catSprite.setFrame(next);
    });
  }

  // === 咖啡机（来自 LAYOUT）===
  if (_t('coffee_machine')) {
    this.anims.create({
      key: 'coffee_machine',
      frames: this.anims.generateFrameNumbers('coffee_machine', { start: 0, end: 95 }),
      frameRate: 12.5,
      repeat: -1
    });
    const coffeeMachine = this.add.sprite(
      LAYOUT.furniture.coffeeMachine.x,
      LAYOUT.furniture.coffeeMachine.y,
      'coffee_machine'
    ).setOrigin(LAYOUT.furniture.coffeeMachine.origin.x, LAYOUT.furniture.coffeeMachine.origin.y);
    coffeeMachine.setDepth(LAYOUT.furniture.coffeeMachine.depth);
    coffeeMachine.anims.play('coffee_machine', true);
  }

  // === 服务器区（来自 LAYOUT）===
  if (_t('serverroom')) {
    this.anims.create({
      key: 'serverroom_on',
      frames: this.anims.generateFrameNumbers('serverroom', { start: 0, end: 39 }),
      frameRate: 6,
      repeat: -1
    });
    serverroom = this.add.sprite(
      LAYOUT.furniture.serverroom.x,
      LAYOUT.furniture.serverroom.y,
      'serverroom',
      0
    ).setOrigin(LAYOUT.furniture.serverroom.origin.x, LAYOUT.furniture.serverroom.origin.y);
    serverroom.setDepth(LAYOUT.furniture.serverroom.depth);
    serverroom.anims.stop();
    serverroom.setFrame(0);
  }

  // === 新办公桌（来自 LAYOUT，强制透明 PNG）===
  if (_t('desk_v2')) {
    const desk = this.add.image(
      LAYOUT.furniture.desk.x,
      LAYOUT.furniture.desk.y,
      'desk_v2'
    ).setOrigin(LAYOUT.furniture.desk.origin.x, LAYOUT.furniture.desk.origin.y);
    desk.setDepth(LAYOUT.furniture.desk.depth);
  }

  // === 花盆（来自 LAYOUT）===
  if (_t('flowers')) {
    const flowerFrameCount = 16;
    const randomFlowerFrame = Math.floor(Math.random() * flowerFrameCount);
    const flower = this.add.sprite(
      LAYOUT.furniture.flower.x,
      LAYOUT.furniture.flower.y,
      'flowers',
      randomFlowerFrame
    ).setOrigin(LAYOUT.furniture.flower.origin.x, LAYOUT.furniture.flower.origin.y);
    flower.setScale(LAYOUT.furniture.flower.scale || 1);
    flower.setDepth(LAYOUT.furniture.flower.depth);
    flower.setInteractive({ useHandCursor: true });
    window.flowerSprite = flower;
    window.flowerFrameCount = flowerFrameCount;
    flower.on('pointerdown', () => {
      const next = Math.floor(Math.random() * window.flowerFrameCount);
      window.flowerSprite.setFrame(next);
    });
  }

  // === Star 在桌前工作（来自 LAYOUT）===
  if (_t('star_working')) {
    this.anims.create({
      key: 'star_working',
      frames: this.anims.generateFrameNumbers('star_working', { start: 0, end: 191 }),
      frameRate: 12,
      repeat: -1
    });
  }
  if (_t('error_bug')) {
    this.anims.create({
      key: 'error_bug',
      frames: this.anims.generateFrameNumbers('error_bug', { start: 0, end: 95 }),
      frameRate: 12,
      repeat: -1
    });

    // === 错误 bug（来自 LAYOUT）===
    const errorBug = this.add.sprite(
      LAYOUT.furniture.errorBug.x,
      LAYOUT.furniture.errorBug.y,
      'error_bug',
      0
    ).setOrigin(LAYOUT.furniture.errorBug.origin.x, LAYOUT.furniture.errorBug.origin.y);
    errorBug.setDepth(LAYOUT.furniture.errorBug.depth);
    errorBug.setVisible(false);
    errorBug.setScale(LAYOUT.furniture.errorBug.scale);
    errorBug.anims.play('error_bug', true);
    window.errorBug = errorBug;
    window.errorBugDir = 1;
  }

  if (_t('star_working')) {
    const starWorking = this.add.sprite(
      LAYOUT.furniture.starWorking.x,
      LAYOUT.furniture.starWorking.y,
      'star_working',
      0
    ).setOrigin(LAYOUT.furniture.starWorking.origin.x, LAYOUT.furniture.starWorking.origin.y);
    starWorking.setVisible(false);
    starWorking.setScale(LAYOUT.furniture.starWorking.scale);
    starWorking.setDepth(LAYOUT.furniture.starWorking.depth);
    window.starWorking = starWorking;
  }

  // === 同步动画（来自 LAYOUT）===
  if (_t('sync_anim')) {
    this.anims.create({
      key: 'sync_anim',
      frames: this.anims.generateFrameNumbers('sync_anim', { start: 1, end: 52 }),
      frameRate: 12,
      repeat: -1
    });
    syncAnimSprite = this.add.sprite(
      LAYOUT.furniture.syncAnim.x,
      LAYOUT.furniture.syncAnim.y,
      'sync_anim',
      0
    ).setOrigin(LAYOUT.furniture.syncAnim.origin.x, LAYOUT.furniture.syncAnim.origin.y);
    syncAnimSprite.setDepth(LAYOUT.furniture.syncAnim.depth);
    syncAnimSprite.anims.stop();
    syncAnimSprite.setFrame(0);
  }

  window.starSprite = star;

  statusText = document.getElementById('status-text');
  coordsOverlay = document.getElementById('coords-overlay');
  coordsDisplay = document.getElementById('coords-display');
  coordsToggle = document.getElementById('coords-toggle');

  coordsToggle.addEventListener('click', () => {
    showCoords = !showCoords;
    coordsOverlay.style.display = showCoords ? 'block' : 'none';
    coordsToggle.textContent = showCoords ? '隐藏坐标' : '显示坐标';
    coordsToggle.style.background = showCoords ? '#e94560' : '#333';
  });

  game.input.on('pointermove', (pointer) => {
    if (!showCoords) return;
    const x = Math.max(0, Math.min(config.width - 1, Math.round(pointer.x)));
    const y = Math.max(0, Math.min(config.height - 1, Math.round(pointer.y)));
    coordsDisplay.textContent = `${x}, ${y}`;
    coordsOverlay.style.left = (pointer.x + 18) + 'px';
    coordsOverlay.style.top = (pointer.y + 18) + 'px';
  });

  loadMemo();
  fetchStatus();
  fetchAgents();

  // 可选调试：仅在显式开启 debug 模式时渲染测试用尼卡 agent
  let debugAgents = false;
  try {
    if (typeof window !== 'undefined') {
      if (window.STAR_OFFICE_DEBUG_AGENTS === true) {
        debugAgents = true;
      } else if (window.location && window.location.search && typeof URLSearchParams !== 'undefined') {
        const sp = new URLSearchParams(window.location.search);
        if (sp.get('debugAgents') === '1') {
          debugAgents = true;
        }
      }
    }
  } catch (e) {
    debugAgents = false;
  }

  if (debugAgents) {
    const testNika = {
      agentId: 'agent_nika',
      name: '尼卡',
      isMain: false,
      state: 'writing',
      detail: '在画像素画...',
      area: 'writing',
      authStatus: 'approved',
      updated_at: new Date().toISOString()
    };
    renderAgent(testNika);

    window.testNikaState = 'writing';
    window.testNikaTimer = setInterval(() => {
      const states = ['idle', 'writing', 'researching', 'executing'];
      const areas = { idle: 'breakroom', writing: 'writing', researching: 'writing', executing: 'writing' };
      window.testNikaState = states[Math.floor(Math.random() * states.length)];
      const testAgent = {
        agentId: 'agent_nika',
        name: '尼卡',
        isMain: false,
        state: window.testNikaState,
        detail: '在画像素画...',
        area: areas[window.testNikaState],
        authStatus: 'approved',
        updated_at: new Date().toISOString()
      };
      renderAgent(testAgent);
    }, 5000);
  }
}

function update(time, delta) {
  if (time - lastFetch > FETCH_INTERVAL) { fetchStatus(); lastFetch = time; }
  if (time - lastAgentsFetch > AGENTS_FETCH_INTERVAL) { fetchAgents(); lastAgentsFetch = time; }
  updateParticles(time);
  updateCharacterWalkers(time, delta);

  const effectiveStateForServer = pendingDesiredState || currentState;
  if (serverroom) {
    if (effectiveStateForServer === 'idle') {
      if (serverroom.anims.isPlaying) {
        serverroom.anims.stop();
        serverroom.setFrame(0);
      }
    } else {
      if (!serverroom.anims.isPlaying || serverroom.anims.currentAnim?.key !== 'serverroom_on') {
        serverroom.anims.play('serverroom_on', true);
      }
    }
  }

  if (window.errorBug) {
    if (effectiveStateForServer === 'error') {
      window.errorBug.setVisible(true);
      if (!window.errorBug.anims.isPlaying || window.errorBug.anims.currentAnim?.key !== 'error_bug') {
        window.errorBug.anims.play('error_bug', true);
      }
      const leftX = LAYOUT.furniture.errorBug.pingPong.leftX;
      const rightX = LAYOUT.furniture.errorBug.pingPong.rightX;
      const speed = LAYOUT.furniture.errorBug.pingPong.speed;
      const dir = window.errorBugDir || 1;
      window.errorBug.x += speed * dir;
      window.errorBug.y = LAYOUT.furniture.errorBug.y;
      if (window.errorBug.x >= rightX) {
        window.errorBug.x = rightX;
        window.errorBugDir = -1;
      } else if (window.errorBug.x <= leftX) {
        window.errorBug.x = leftX;
        window.errorBugDir = 1;
      }
    } else {
      window.errorBug.setVisible(false);
      window.errorBug.anims.stop();
    }
  }

  if (syncAnimSprite) {
    if (effectiveStateForServer === 'syncing') {
      if (!syncAnimSprite.anims.isPlaying || syncAnimSprite.anims.currentAnim?.key !== 'sync_anim') {
        syncAnimSprite.anims.play('sync_anim', true);
      }
    } else {
      if (syncAnimSprite.anims.isPlaying) syncAnimSprite.anims.stop();
      syncAnimSprite.setFrame(0);
    }
  }

  if (time - lastBubble > BUBBLE_INTERVAL) {
    showBubble();
    lastBubble = time;
  }
  if (time - lastCatBubble > CAT_BUBBLE_INTERVAL) {
    showCatBubble();
    lastCatBubble = time;
  }

  if (typewriterIndex < typewriterTarget.length && time - lastTypewriter > TYPEWRITER_DELAY) {
    typewriterText += typewriterTarget[typewriterIndex];
    statusText.textContent = typewriterText;
    typewriterIndex++;
    lastTypewriter = time;
  }

  moveStar(time);
}

function normalizeState(s) {
  if (!s) return 'idle';
  if (s === 'working') return 'writing';
  if (s === 'run' || s === 'running') return 'executing';
  if (s === 'sync') return 'syncing';
  if (s === 'research') return 'researching';
  return s;
}

function fetchStatus() {
  fetch('/status')
    .then(response => response.json())
    .then(data => {
      const nextState = normalizeState(data.state);
      const stateInfo = STATES[nextState] || STATES.idle;
      const changed = (pendingDesiredState === null) && (nextState !== currentState);
      const nextLine = '[' + stateInfo.name + '] ' + (data.detail || '...');
      if (changed) {
        typewriterTarget = nextLine;
        typewriterText = '';
        typewriterIndex = 0;

        pendingDesiredState = null;
        currentState = nextState;

        if (nextState === 'idle') {
          if (game.textures.exists('sofa_busy')) {
            sofa.setTexture('sofa_busy');
            sofa.anims.play('sofa_busy', true);
          }
          star.setVisible(false);
          star.anims.stop();
          if (window.starWorking) {
            window.starWorking.setVisible(false);
            window.starWorking.anims.stop();
          }
        } else if (nextState === 'error') {
          sofa.anims.stop();
          sofa.setTexture('sofa_idle');
          star.setVisible(false);
          star.anims.stop();
          if (window.starWorking) {
            window.starWorking.setVisible(false);
            window.starWorking.anims.stop();
          }
        } else if (nextState === 'syncing') {
          sofa.anims.stop();
          sofa.setTexture('sofa_idle');
          star.setVisible(false);
          star.anims.stop();
          if (window.starWorking) {
            window.starWorking.setVisible(false);
            window.starWorking.anims.stop();
          }
        } else {
          sofa.anims.stop();
          sofa.setTexture('sofa_idle');
          star.setVisible(false);
          star.anims.stop();
          if (window.starWorking) {
            window.starWorking.setVisible(true);
            window.starWorking.anims.play('star_working', true);
          }
        }

        if (serverroom) {
          if (nextState === 'idle') {
            serverroom.anims.stop();
            serverroom.setFrame(0);
          } else {
            serverroom.anims.play('serverroom_on', true);
          }
        }

        if (syncAnimSprite) {
          if (nextState === 'syncing') {
            if (!syncAnimSprite.anims.isPlaying || syncAnimSprite.anims.currentAnim?.key !== 'sync_anim') {
              syncAnimSprite.anims.play('sync_anim', true);
            }
          } else {
            if (syncAnimSprite.anims.isPlaying) syncAnimSprite.anims.stop();
            syncAnimSprite.setFrame(0);
          }
        }
      } else {
        if (!typewriterTarget || typewriterTarget !== nextLine) {
          typewriterTarget = nextLine;
          typewriterText = '';
          typewriterIndex = 0;
        }
      }
    })
    .catch(error => {
      typewriterTarget = '连接失败，正在重试...';
      typewriterText = '';
      typewriterIndex = 0;
    });
}

function moveStar(time) {
  const effectiveState = pendingDesiredState || currentState;
  const stateInfo = STATES[effectiveState] || STATES.idle;
  const baseTarget = areas[stateInfo.area] || areas.breakroom;

  const dx = targetX - star.x;
  const dy = targetY - star.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const speed = 1.4;
  const wobble = Math.sin(time / 200) * 0.8;

  if (dist > 3) {
    star.x += (dx / dist) * speed;
    star.y += (dy / dist) * speed;
    star.setY(star.y + wobble);
    isMoving = true;
  } else {
    if (waypoints && waypoints.length > 0) {
      waypoints.shift();
      if (waypoints.length > 0) {
        targetX = waypoints[0].x;
        targetY = waypoints[0].y;
        isMoving = true;
      } else {
        if (pendingDesiredState !== null) {
          isMoving = false;
          currentState = pendingDesiredState;
          pendingDesiredState = null;

          if (currentState === 'idle') {
            star.setVisible(false);
            star.anims.stop();
            if (window.starWorking) {
              window.starWorking.setVisible(false);
              window.starWorking.anims.stop();
            }
          } else {
            star.setVisible(false);
            star.anims.stop();
            if (window.starWorking) {
              window.starWorking.setVisible(true);
              window.starWorking.anims.play('star_working', true);
            }
          }
        }
      }
    } else {
      if (pendingDesiredState !== null) {
        isMoving = false;
        currentState = pendingDesiredState;
        pendingDesiredState = null;

        if (currentState === 'idle') {
          star.setVisible(false);
          star.anims.stop();
          if (window.starWorking) {
            window.starWorking.setVisible(false);
            window.starWorking.anims.stop();
          }
          if (game.textures.exists('sofa_busy')) {
            sofa.setTexture('sofa_busy');
            sofa.anims.play('sofa_busy', true);
          }
        } else {
          star.setVisible(false);
          star.anims.stop();
          if (window.starWorking) {
            window.starWorking.setVisible(true);
            window.starWorking.anims.play('star_working', true);
          }
          sofa.anims.stop();
          sofa.setTexture('sofa_idle');
        }
      }
    }
  }
}

function showBubble() {
  if (bubble) { bubble.destroy(); bubble = null; }
  const texts = BUBBLE_TEXTS[currentState] || BUBBLE_TEXTS.idle;
  if (currentState === 'idle') return;

  let anchorX = star.x;
  let anchorY = star.y;
  if (currentState === 'syncing' && syncAnimSprite && syncAnimSprite.visible) {
    anchorX = syncAnimSprite.x;
    anchorY = syncAnimSprite.y;
  } else if (currentState === 'error' && window.errorBug && window.errorBug.visible) {
    anchorX = window.errorBug.x;
    anchorY = window.errorBug.y;
  } else if (!star.visible && window.starWorking && window.starWorking.visible) {
    anchorX = window.starWorking.x;
    anchorY = window.starWorking.y;
  }

  const text = texts[Math.floor(Math.random() * texts.length)];
  const bubbleY = anchorY - 70;
  const bg = game.add.rectangle(anchorX, bubbleY, text.length * 10 + 20, 28, 0xffffff, 0.95);
  bg.setStrokeStyle(2, 0x000000);
  const txt = game.add.text(anchorX, bubbleY, text, { fontFamily: 'ArkPixel, monospace', fontSize: '12px', fill: '#000', align: 'center' }).setOrigin(0.5);
  bubble = game.add.container(0, 0, [bg, txt]);
  bubble.setDepth(LAYERS.TOP);
  setTimeout(() => { if (bubble) { bubble.destroy(); bubble = null; } }, 3000);
}

function showCatBubble() {
  if (!window.catSprite) return;
  if (window.catBubble) { window.catBubble.destroy(); window.catBubble = null; }
  const texts = BUBBLE_TEXTS.cat || ['喵~', '咕噜咕噜…'];
  const text = texts[Math.floor(Math.random() * texts.length)];
  const anchorX = window.catSprite.x;
  const anchorY = window.catSprite.y - 60;
  const bg = game.add.rectangle(anchorX, anchorY, text.length * 10 + 20, 24, 0xfffbeb, 0.95);
  bg.setStrokeStyle(2, 0xd4a574);
  const txt = game.add.text(anchorX, anchorY, text, { fontFamily: 'ArkPixel, monospace', fontSize: '11px', fill: '#8b6914', align: 'center' }).setOrigin(0.5);
  window.catBubble = game.add.container(0, 0, [bg, txt]);
  window.catBubble.setDepth(LAYERS.TOP);
  setTimeout(() => { if (window.catBubble) { window.catBubble.destroy(); window.catBubble = null; } }, 4000);
}

function fetchAgents() {
  fetch('/agents?t=' + Date.now(), { cache: 'no-store' })
    .then(response => response.json())
    .then(data => {
      if (!Array.isArray(data)) return;
      // 重置位置计数器
      // 按区域分配不同位置索引，避免重叠
      const areaSlots = { breakroom: 0, writing: 0, error: 0 };
      for (let agent of data) {
        const area = agent.area || 'breakroom';
        agent._slotIndex = areaSlots[area] || 0;
        areaSlots[area] = (areaSlots[area] || 0) + 1;
        renderAgent(agent);
        // 四狐多角色：同时更新工作站精灵
        updateWorkstationSprites(agent);
      }
      // 移除不再存在的 agent
      const currentIds = new Set(data.map(a => a.agentId));
      for (let id in agents) {
        if (!currentIds.has(id)) {
          if (agents[id]) {
            agents[id].destroy();
            delete agents[id];
          }
        }
      }
    })
    .catch(error => {
      console.error('拉取 agents 失败:', error);
    });
}

function getAreaPosition(area, slotIndex) {
  const positions = AREA_POSITIONS[area] || AREA_POSITIONS.breakroom;
  const idx = (slotIndex || 0) % positions.length;
  return positions[idx];
}

// 四狐多角色：状态→动作映射
const FOX_ACTION_MAP = {
  'idle': 'idle',
  'TODO': 'idle',
  'DOING': 'working',
  'REVIEW': 'think',
  'DONE': 'wave',
  'writing': 'wave',
  'researching': 'think',
  'executing': 'working',
  'syncing': 'working',
  'error': 'working'
};

function getFoxSpriteKey(agentId) {
  // agentId → spritesheet key 前缀
  if (agentId === 'fox_leader') return 'spark';
  if (agentId === 'qing_fox') return 'qingfox';
  if (agentId === 'white_fox') return 'whitefox';
  if (agentId === 'black_fox') return 'blackfox';
  return null;
}

function getFoxAnimKey(agentId, state) {
  const base = getFoxSpriteKey(agentId);
  if (!base) return null;
  const action = FOX_ACTION_MAP[state] || FOX_ACTION_MAP['idle'];
  const preferred = `${base}_${action}_anim`;
  if (game && game.anims && game.anims.exists(preferred)) return preferred;
  const fallback = `${base}_idle_anim`;
  if (game && game.anims && game.anims.exists(fallback)) return fallback;
  return preferred;
}

function updateWorkstationSprites(agentData) {
  // 根据 FoxBoard API 返回的 agent 数据更新四狐工作站精灵
  if (!window.workstationSprites) return;
  const ws = window.workstationSprites;
  const agentId = agentData.agentId;
  const state = agentData.state || 'idle';
  const status = agentData.current_task_status || state;

  const sp = ws[agentId];
  if (!sp) return;

  let animKey = getFoxAnimKey(agentId, status);
  if (agentId === 'fox_leader' && window.sparkManualAnim && game.anims.exists(window.sparkManualAnim)) {
    animKey = window.sparkManualAnim;
  }
  if (!animKey) return;

  const textureKey = animKey.replace('_anim', '');
  if (game.textures.exists(textureKey)) {
    if (sp.texture && sp.texture.key !== textureKey) {
      sp.setTexture(textureKey);
    }
    if (sp.anims && sp.anims.currentAnim?.key !== animKey) {
      sp.anims.play(animKey, true);
    }
  }

  // 更新名字标签颜色（根据状态）
  const nameTag = ws[agentId + '_nameTag'];
  if (nameTag) {
    let color = '#ffffff';
    if (status === 'DOING' || status === 'executing') color = '#fbbf24';
    else if (status === 'REVIEW' || status === 'researching') color = '#60a5fa';
    else if (status === 'DONE' || status === 'writing') color = '#4ade80';
    nameTag.setFill(color);
  }
}

function getAgentVisualSpec(agent) {
  const agentId = agent.agentId || '';
  const name = String(agent.name || '');
  const isHibana = !!agent.isMain || name.includes('花火');

  // 四狐多角色：花火+另外三只狐狸都走 spritesheet 路线
  const foxKey = getFoxSpriteKey(agentId);
  if (foxKey) {
    const state = agent.state || 'idle';
    const animKey = getFoxAnimKey(agentId, state);
    const textureKey = animKey ? animKey.replace('_anim', '') : foxKey + '_idle';
    return {
      type: 'sprite',
      texture: textureKey,
      animKey: animKey,
      scale: foxKey === 'spark' ? 0.95 : 0.85,
      y: 4,
    };
  }

  // 其它 agent（非四狐）走旧逻辑
  if (!isHibana) return null;

  const state = agent.state || 'idle';
  let animKey = 'spark_idle_anim';
  if (state === 'researching') animKey = 'spark_think_anim';
  else if (state === 'executing' || state === 'syncing' || state === 'error') animKey = 'spark_wiggle_anim';
  else if (state === 'writing') animKey = 'spark_wave_anim';

  return {
    type: 'sprite',
    texture: animKey.replace('_anim', ''),
    animKey,
    scale: 0.95,
    y: 4,
  };
}

function renderAgent(agent) {
  const agentId = agent.agentId;
  const name = agent.name || 'Agent';
  const area = agent.area || 'breakroom';
  const authStatus = agent.authStatus || 'pending';
  const isMain = !!agent.isMain;

  // 获取这个 agent 在区域里的位置
  const pos = getAreaPosition(area, agent._slotIndex || 0);
  const baseX = pos.x;
  const baseY = pos.y;

  // 颜色
  const nameColor = NAME_TAG_COLORS[authStatus] || NAME_TAG_COLORS.default;
  const visualSpec = getAgentVisualSpec(agent);

  // 透明度（离线/待批准/拒绝时变半透明）
  let alpha = 1;
  if (authStatus === 'pending') alpha = 0.7;
  if (authStatus === 'rejected') alpha = 0.4;
  if (authStatus === 'offline') alpha = 0.5;

  if (!agents[agentId]) {
    // 新建 agent
    const container = game.add.container(baseX, baseY);
    container.setDepth(LAYERS.TOP + (isMain ? 100 : 0)); // 放到最顶层！

    let agentVisual;
    if (visualSpec && visualSpec.type === 'sprite' && game.textures.exists(visualSpec.texture)) {
      agentVisual = game.add.sprite(0, visualSpec.y || 0, visualSpec.texture).setOrigin(0.5);
      agentVisual.setScale(visualSpec.scale || 1);
      if (visualSpec.animKey) {
        agentVisual.anims.play(visualSpec.animKey, true);
        agentVisual.setData('animKey', visualSpec.animKey);
      }
      agentVisual.name = 'agentVisual';
    } else {
      agentVisual = game.add.text(0, 0, '⭐', {
        fontFamily: 'ArkPixel, monospace',
        fontSize: '32px'
      }).setOrigin(0.5);
      agentVisual.name = 'agentVisual';
    }

    // 名字标签（漂浮）
    const nameTag = game.add.text(0, -42, name, {
      fontFamily: 'ArkPixel, monospace',
      fontSize: '14px',
      fill: '#' + nameColor.toString(16).padStart(6, '0'),
      stroke: '#000',
      strokeThickness: 3,
      backgroundColor: 'rgba(255,255,255,0.95)'
    }).setOrigin(0.5);
    nameTag.name = 'nameTag';

    // 状态小点（绿色/黄色/红色）
    let dotColor = 0x64748b;
    if (authStatus === 'approved') dotColor = 0x22c55e;
    if (authStatus === 'pending') dotColor = 0xf59e0b;
    if (authStatus === 'rejected') dotColor = 0xef4444;
    if (authStatus === 'offline') dotColor = 0x94a3b8;
    const statusDot = game.add.circle(24, -24, 5, dotColor, alpha);
    statusDot.setStrokeStyle(2, 0x000000, alpha);
    statusDot.name = 'statusDot';

    container.add([agentVisual, statusDot, nameTag]);
    agents[agentId] = container;
  } else {
    // 更新 agent
    const container = agents[agentId];
    container.setPosition(baseX, baseY);
    container.setAlpha(alpha);
    container.setDepth(LAYERS.TOP + (isMain ? 100 : 0));

    // 更新主视觉（花火用 spritesheet，其它继续占位）
    const agentVisual = container.getAt(0);
    if (agentVisual && agentVisual.name === 'agentVisual' && visualSpec && visualSpec.animKey && agentVisual.anims) {
      const currentAnimKey = agentVisual.getData ? agentVisual.getData('animKey') : null;
      if (currentAnimKey !== visualSpec.animKey) {
        agentVisual.anims.play(visualSpec.animKey, true);
        if (agentVisual.setData) agentVisual.setData('animKey', visualSpec.animKey);
      }
    }

    // 更新名字和颜色（如果变化）
    const nameTag = container.getAt(2);
    if (nameTag && nameTag.name === 'nameTag') {
      nameTag.setText(name);
      nameTag.setFill('#' + (NAME_TAG_COLORS[authStatus] || NAME_TAG_COLORS.default).toString(16).padStart(6, '0'));
    }
    // 更新状态点颜色
    const statusDot = container.getAt(1);
    if (statusDot && statusDot.name === 'statusDot') {
      let dotColor = 0x64748b;
      if (authStatus === 'approved') dotColor = 0x22c55e;
      if (authStatus === 'pending') dotColor = 0xf59e0b;
      if (authStatus === 'rejected') dotColor = 0xef4444;
      if (authStatus === 'offline') dotColor = 0x94a3b8;
      statusDot.fillColor = dotColor;
    }
  }
}

// 暴露给 React 页面做生命周期控制
if (typeof window !== 'undefined') {
  window.__FOXBOARD_PIXEL_OFFICE_INIT = initGame;
  window.__FOXBOARD_PIXEL_OFFICE_DESTROY = destroyGame;
}

// 兼容独立 office.html：未声明手动托管时自动启动
if (typeof window !== 'undefined' && !window.__FOXBOARD_PIXEL_OFFICE_MANUAL_BOOT__) {
  initGame();
}
