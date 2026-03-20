# TASK-FB-004: 前端 Dashboard 骨架——React + Tailwind

## 基本信息
- **状态**: TODO ⬜
- **版本**: v0.1.0
- **分配**: 青狐
- **优先级**: P2
- **创建**: 2026-03-20
- **依赖**: TASK-FB-003（后端骨架）可并行

## 目标
搭建 FoxBoard 前端最小可展示骨架，包含：Dashboard 首页 + 任务看板页 + 成员状态页。

## 输入
- PRD.md v1.1
- 后端 API 文档（与 TASK-FB-003 同步进行）

## 步骤
1. 创建前端项目：
   ```bash
   cd FoxBoard
   npm create vite@latest frontend -- --template react-ts
   cd frontend
   npm install
   npm install tailwindcss @tailwindcss/vite
   npm install lucide-react   # 图标
   npm install axios         # API 调用
   ```
2. 配置 Tailwind + shadcn/ui
3. 开发 3 个核心页面：
   - **Dashboard 主页**：项目进度总览 + 今日动态卡片
   - **任务看板页**：四列（TODO/DOING/REVIEW/DONE）拖拽卡片
   - **成员状态页**：四只狐狸的像素风格状态卡片
4. 接入后端 API（与 TASK-FB-003 联调）
5. 本地开发服务器可正常访问

## 页面详细设计

### Dashboard 首页
- 顶部：项目选择器（当前进行中的项目）
- 中部：项目进度条（% DONE 任务）
- 右侧：风险告警卡片（红色：阻塞任务）
- 底部：今日动态流（事件日志）

### 任务看板页
- 四列：TODO（灰）/ DOING（蓝）/ REVIEW（黄）/ DONE（绿）
- 每张卡片：标题、Owner 头像、优先级标签、截止时间
- 支持创建新任务（弹窗表单）
- 支持拖拽改变状态（可选，Phase 1 可先不做）

### 成员状态页
- 四张狐狸卡片：
  - 头像区（像素风格）
  - 在线状态（绿色点=活跃，灰色=待机）
  - 当前任务名
  - 最近心跳时间
  - 今日完成任务数

## 输出
- 完整可运行的前端项目
- `frontend/README.md`（启动说明）

## 审核标准
- `npm run dev` 能启动，页面可访问
- 三个页面都能正常渲染数据
- 看板页能展示任务列表
- 成员状态页能展示四只狐狸卡片
