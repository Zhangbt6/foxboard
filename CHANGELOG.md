# Changelog

All notable changes to **FoxBoard** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-03-20

### Added
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
