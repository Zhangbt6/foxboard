# Changelog

All notable changes to **FoxBoard** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-03-21

### Added
- **数据适配层** (TASK-FB-027): agents 表新增 `state_detail` 字段 + `PATCH /agents/{id}/state-detail` API
- **game.js 数据源适配** (TASK-FB-028): `OfficeAdapter.ts` 实现 FoxBoard API → game.js 格式转换，fetch 拦截器自动映射
- **像素办公室页面** (TASK-FB-029): `/office` 页面，Phaser 游戏内嵌 + 四狐实时状态展示

## [0.4.0] - 2026-03-21

### Added
- **超时提醒机制** (TASK-FB-021): 后台定时扫描DOING任务
  - `started_at` 字段记录任务开始时间
  - 后台线程每5分钟扫描一次，超时（默认2小时）写入 `task_timeout` 事件
  - Dashboard 超时告警横幅（红色）+ 指标卡
- **REVIEW 自动派给黑狐** (TASK-FB-022): 任务进入 REVIEW 状态时自动触发 FoxComms 通知黑狐审核
  - 状态变更钩子：PATCH `/tasks/{id}` 检测 `→REVIEW` 自动通知
- **任务依赖自动激活** (TASK-FB-023): 任务 DONE 后检查下游依赖
  - `depends_on` 字段（逗号分隔任务ID列表）
  - 所有前置任务 DONE 时自动激活下游 BLOCKED→TODO
  - 自动写入 `task_activated` 事件日志
- **角色专属 Queue 视图** (TASK-FB-024): `/my-tasks` 页面
  - 按成员/状态/优先级多维筛选
  - 四列统计：TODO/DOING/REVIEW/DONE 计数
  - 点击卡片推进任务状态

## [0.3.0] - 2026-03-20

### Added
- **流程图节点自动点亮** (TASK-FB-017): 前端节点根据后端状态自动变色
  - 灰=未开始 / 蓝=进行中 / 绿=完成 / 黄=审核中 / 红=阻塞
  - 阻塞节点高亮闪烁效果（CSS animation）
  - 节点颜色实时从后端 `/workflows/{id}/nodes` API 拉取
- **流程图节点状态同步后端** (TASK-FB-016): 新增 workflows + workflow_node_states 表及 API
  - `workflows` 表：工作流定义（name, project_id, status）
  - `workflow_node_states` 表：节点实时状态（node_id, task_id, color, updated_at）
  - GET/POST `/workflows/`、GET/PATCH `/workflows/{id}/nodes` 接口
  - 节点状态关联 task，task 状态变化自动更新节点颜色
  - 新增 15 个 pytest 测试用例（test_workflows.py）
- **Activity 事件流页面** (TASK-FB-018): 新增 `/activity` 页面
  - 实时展示系统事件流（任务创建/完成/Agent心跳/注册）
  - 按类型筛选 + 时间线展示，负责人着色
- **React Flow 流程图** (TASK-FB-015): 新增 `/workflow` 页面
  - 7步标准流程图（需求提出→花火拆解→白狐调研→青狐开发→黑狐验证→花火汇总→主人审核）
  - React Flow 渲染，支持拖拽/缩放/Controls/MiniMap
  - 自定义 `StepNode` 组件，节点含步骤名+负责人+描述
- **前后端联调** (TASK-FB-009): 前端实时拉取后端 API 数据
  - Dashboard / 看板 / 成员状态三页面接入 API
  - `useInterval` hook 实现轮询（Dashboard 30s / 看板 20s / Agents 10s）
- **Agent 心跳接入** (TASK-FB-010): 各 agent 心跳数据入库，前端实时展示在线状态
- **BOARD.md 解析器** (TASK-FB-011): `scripts/board_sync.py`，支持 Markdown → SQLite 同步
- **Dashboard 数据可视化** (TASK-FB-012): 项目进度%、任务统计、阻塞告警、事件流

### Fixed
- 后端 DB_PATH 配置修正为正确路径
- 前端 API 字段名统一（`agent_id`）

### Notes
- Phase 2 完成，pytest 测试用例 34 个（97% 覆盖）

## [0.1.0] - 2026-03-20

### Added
- **后端骨架** (TASK-FB-003): FastAPI + SQLite 后端，3张表（agents / projects / tasks）
  - `agents` 表：name, status, last_heartbeat, current_task
  - `projects` 表：name, description, status, created_at, updated_at
  - `tasks` 表：title, description, status, priority, assignee, project_id, created_at, updated_at
  - DB 路径：`Notebook/70_花火项目/FoxBoard/data/foxboard.db`
- **前端骨架** (TASK-FB-004): React + Tailwind + React Flow，3页
  - 看板页（BoardPage）：流程图节点渲染 + 任务拖拽
  - 成员状态页（AgentsPage）：Agent 心跳状态卡片
  - 项目列表页（ProjectsPage）：项目 CRUD 入口
- **Agent 状态协议** (TASK-FB-005): heartbeat + task_update + 6种事件类型
  - `black_fox/push.sh` 和 `black_fox/foxboard_push.py` 工具脚本
- **Git/Build/文档集成** (TASK-FB-006):
  - pre-commit hook（build 检查 + lint + commit 格式验证）
  - `CONTRIBUTING.md` 分支规范 + Commit 规范 + PR 流程
  - `.gitignore`（Python/Node/IDE/DB/Logs 全覆盖）
  - `pytest.ini` 测试路径配置

### Fixed
- 后端 DB_PATH 配置修正为正确路径
- 前端 API 字段名统一（`agent_id`）

### Notes
- pytest 测试用例降级至 v0.2.0（Phase 1 暂不强制要求）
- 部署方案待主人决定（本地 / 云服务器 / Cloudflare Tunnel）
