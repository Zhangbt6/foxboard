# PROJECT.md - FoxBoard AI 工作室指挥中台

## 🎯 总目标
为个人 AI 协作工作室（数字实验室）打造可视化项目管理中台（Mission Control），让主人一眼看清"谁在干什么、项目进到哪、哪里卡住、最近发生了什么"。

## 📋 产品定位

**不是**：通用项目管理平台（轻量专用，不追求大而全）
**不是**：商业组织层级系统
**是**：围绕主人个人长期目标运行的 AI 协作团队指挥台
**是**：个人数字实验室 / AI 研发工作室的 Mission Control

## 🏗️ 系统架构

```
主人（驾驶舱视角）
  ↓
FoxBoard 前端（React + React Flow）
  ↓ HTTP API
FoxBoard 后端（FastAPI + SQLite）
  ↓ openclaw agent CLI / FoxComms
花火 / 白狐 / 青狐 / 黑狐（OpenClaw agents）
  ↓
OpenClaw Gateway
```

**与 OpenClaw 的关系**：
- OpenClaw 负责运行 agents（花火/白狐/青狐/黑狐）
- FoxBoard 负责观测、任务管理、状态可视化
- 通信层使用 OpenClaw 原生能力（`openclaw agent --agent`）+ FoxComms 封装
- 两者解耦：FoxBoard 通过状态上报 API 接入

**已知限制（Phase 1）**：
- 白狐/黑狐无飞书 binding，只能通过 `openclaw agent` CLI 或 inbox 文件唤醒
- 飞书群通知由花火主 session 兜底发送

## 🔧 技术选型

| 层级 | 选择 | 理由 |
|------|------|------|
| 前端 | React + Tailwind + shadcn/ui | Phase 3 需要 React Flow，长期需要 |
| 流程图 | React Flow | 节点流程图点亮（Phase 3） |
| 后端 | Python FastAPI | 主人生态友好，轻量 API |
| 数据库 | SQLite | 个人工作室足够，无需 PostgreSQL |
| 通信 | FoxComms v2（openclaw agent CLI） | OpenClaw 原生能力 + 文件记录 |

## 🗺️ 版本规划

---

### Phase 1: v0.1.0 — 最小可用版（MVP）
- **状态**: 🔵 进行中
- **开始**: 2026-03-20
- **目标**: 能看到、能管理
- **核心页面**（最多 3 个）：
  1. 任务看板页（TODO/DOING/REVIEW/DONE 四列）
  2. 成员状态页（四只狐狸卡片 + 心跳）
  3. Dashboard 首页（嵌入活动日志 + 全局概览）
- **后端数据模型**（只建 3 个表）：
  - `agents` — 成员信息 + 心跳
  - `tasks` — 任务看板
  - `task_logs` — 事件流
- **通信**：FoxComms v2（openclaw agent CLI 唤醒）
- **子项**：
  - [ ] TASK-FB-001 需求分析与信息架构（花火）— DOING
  - [ ] TASK-FB-002 竞品调研（白狐）
  - [ ] TASK-FB-003 后端骨架 FastAPI+SQLite（青狐）
  - [ ] TASK-FB-004 前端骨架 React+Tailwind（青狐）
  - [ ] TASK-FB-005 Agent 状态协议设计（花火+白狐）
  - [ ] TASK-FB-006 Git/Build 集成方案（黑狐）
  - [ ] TASK-FB-008 测试验收与部署（黑狐）

---

### Phase 2: v0.2.0 — 自动状态上报
- **状态**: ⚪ 待开始
- **目标**: agent 心跳自动化 + 构建状态接入
- **新增能力**：
  - 心跳 API（扩展 payload：task_id, project_id, priority）
  - 构建状态接入（build pass/fail）
  - Git 提交抓取（最近 commit 展示）
  - 基础通知（超时告警）
- **Event 类型**（Phase 2 再细分）：
  - `heartbeat` — 周期性状态
  - `task_update` — 任务状态变更（含 claim/submit/complete/block）

---

### Phase 3: v0.3.0 — 流程图点亮
- **状态**: ⚪ 待开始
- **目标**: React Flow 项目流程图 + 节点状态同步
- **新增数据模型**：
  - `projects` — 项目信息
  - `workflows` — 流程定义
  - `workflow_node_states` — 节点状态
- **新增能力**：
  - React Flow 流程图开发
  - 节点状态与看板同步
  - 阻塞节点红色高亮
  - ~~TASK-FB-007~~（从 Phase 1 移入）

---

### Phase 4: v0.4.0 — 规则引擎与自动编排
- **状态**: ⚪ 待开始
- **目标**: 智能自动化
- **新增能力**：
  - 超时提醒（任务 DOING 超过 24h 告警）
  - REVIEW 自动派给黑狐
  - 任务完成自动激活下游依赖
  - 各角色专属 queue 视图（白狐调研 backlog / 青狐开发 queue / 黑狐 review queue）

---

### Phase 5: v1.0.0 — 像素风办公室集成（远期）
- **状态**: ⚪ 远期规划
- **目标**: FoxBoard + Star-Office-UI 像素风格融合
- **设想**：
  - 替换 Star-Office-UI 素材为四狐像素角色
  - 像素办公室嵌入 FoxBoard Dashboard
  - 四狐在像素办公室中实时反映工作状态
  - 完整的"个人数字实验室"视觉体验

---

## 📌 里程碑

| 里程碑 | 版本 | 完成标准 |
|--------|------|---------|
| M1: MVP 上线 | v0.1.0 | 看板可用 + 成员可见 + Dashboard |
| M2: 自动化 | v0.2.0 | 心跳自动 + 构建状态 + Git 接入 |
| M3: 流程图 | v0.3.0 | React Flow 点亮 + 阻塞高亮 |
| M4: 智能化 | v0.4.0 | 超时告警 + 自动派工 + 角色 queue |
| M5: 融合 | v1.0.0 | 像素办公室 + FoxBoard 一体化 |

## 🔑 关键技术决策

| 决策 | 结论 | 日期 |
|------|------|------|
| Star-Office-UI | 并行建设，不改源码 | 2026-03-20 |
| 数据库 | SQLite（不用 PostgreSQL） | 2026-03-20 |
| 前端框架 | React（为 Phase 3 React Flow） | 2026-03-20 |
| 通信机制 | FoxComms v2 + openclaw agent CLI | 2026-03-20 |
| Phase 1 数据模型 | 只建 3 表（agents/tasks/task_logs） | 2026-03-20 |
| 流程图 PoC | 从 Phase 1 移到 Phase 3 | 2026-03-20 |
| Event 类型 | Phase 1 不细分，Phase 2 再扩展 | 2026-03-20 |
| 团队编制 | 花火(PM) + 白狐(调研) + 青狐(开发) + 黑狐(QA) | 2026-03-20 |
