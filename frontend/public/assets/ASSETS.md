# 🎨 像素办公室资产管理

> 所有游戏素材统一存放在 `public/assets/` 下，按类别分目录管理。
> Phase 10 莲花池国风改造后，新素材直接放入对应目录即可热替换。

## 目录结构

```
assets/
├── characters/          # 角色 sprite (64×64 per frame)
│   ├── spark/           # 花火 - 4帧 spritesheet (256×64)
│   ├── qingfox/         # 青狐
│   ├── whitefox/        # 白狐
│   └── blackfox/        # 黑狐
├── backgrounds/         # 背景图 (1280×720)
├── furniture/           # 家具物件
├── decorations/         # 装饰/环境动画
├── effects/             # 特效 spritesheet
├── legacy/              # v1 旧素材（保留备用）
└── ASSETS.md            # 本文件
```

## 命名规范

- 角色: `{角色名}_{动作}.webp` (如 `spark_idle.webp`)
- 4帧拼接版: `{角色名}_{动作}_4f.webp` (256×64)
- 背景: `bg_{主题名}.webp`
- 家具: `{物品名}.webp`
- Spritesheet: `{名称}-spritesheet.webp`

## 替换规则

1. 新素材放入对应目录，保持同名即可覆盖
2. `game.js` / `layout.js` 中的资产路径引用 `assets/` 前缀
3. Phase 10 莲花池素材将新增到各目录，v1 素材移入 `legacy/`

## 当前资产统计

| 类别 | 数量 | 说明 |
|------|------|------|
| 角色 | 24 | 4角色 × 4-6动作 |
| 背景 | 5 | default/cozy/geek + office原版 |
| 家具 | 14 | 桌椅书架+沙发等 |
| 装饰 | 3 | 猫/花/服务器 |
| 特效 | 3 | bug/working/sync |
| 遗留 | 4 | v1 低分辨率狐狸 |
