# FoxBoard Mission Control — 产品需求文档 PRD v1.1

> 花火起草 | 基于 Star-Office-UI 代码调研更新 | 待主人审批

---

## 1. 产品定位

**产品名称**：FoxBoard Mission Control
**内部代号**：FoxBoard
**产品类型**：AI 工作室可视化项目管理中台
**核心价值**：让主人一眼看清"谁在干什么、项目进到哪、哪里卡住、最近发生了什么"

**与 OpenClaw 的关系**：
- OpenClaw 负责运行 agents（花火/白狐/青狐/黑狐）
- FoxBoard 负责观测、任务、状态可视化、协同管理
- 两者通过状态上报 API 解耦

---

## 2. 用户角色

| 角色 | 身份 | 视角需求 |
|------|------|---------|
| 主人（明子） | 老板 / 最终决策者 | 驾驶舱视角：全局进度、阻塞告警、关键拍板 |
| 花火 | PM | 项目总览、任务拆解、阶段汇报 |
| 白狐 | 调研 | 调研 backlog、资料库、调研进度 |
| 青狐 | 开发 | 开发 queue、当前任务、产出提交 |
| 黑狐 | QA | Review queue、构建状态、验收通过 |

---

## 3. 系统架构

```
主人
  ↓
FoxBoard（项目管理中台 / Mission Control）
  ↓ 状态上报 API
花火 / 白狐 / 青狐 / 黑狐（OpenClaw agents）
  ↓
OpenClaw Gateway / ACP / Nodes / Local Tools
```

---

## 4. 功能模块

### 4.1 总控首页 Dashboard
展示：
- 今日活跃成员数
- 当前进行中项目数
- 各项目总体进度
- 今天新增/完成/卡住任务
- 最近构建状态
- 最近 Git 提交
- 风险告警（红色高亮）

### 4.2 成员状态页 Agents
四只狐狸的卡片，每张显示：
- 在线/离线状态（基于心跳判断）
- 最近心跳时间
- 当前任务
- 今日完成任务数
- 当前工作阶段（idle / writing / researching / executing / error）
- 是否阻塞

状态判断规则：
- 最近 5 分钟有心跳 → 在线
- 最近 15 分钟有任务更新 → 活跃
- 最近 1 小时无更新 → 待机
- 任务状态长时间不变 → 可能阻塞（红色）

### 4.3 项目列表页 Projects
每个项目卡片：
- 项目名、负责人、当前阶段
- 总进度（% DONE 任务）
- 里程碑、最近更新、风险等级

点进去看：
- 项目简介、成员分工、当前任务看板
- Git 仓库入口、文档入口
- 流程图、事件日志

### 4.4 任务看板页 Tasks（核心）
四列看板：TODO | DOING | REVIEW | DONE

每个任务卡片字段：
- 标题、项目、类型、Owner、协作者
- 优先级（P1/P2/P3）、截止时间
- 状态、依赖任务、备注、附件链接

### 4.5 流程图点亮页 Workflow
使用 React Flow 绘制项目流程。

节点示例：
```
需求提出 → 花火拆解 → 白狐调研 → 青狐开发 → 黑狐验证 → 花火汇总 → 主人审核
```

节点状态样式：
- 灰色：未开始、蓝色：进行中、绿色：完成、黄色：等待审核、红色：阻塞

### 4.6 事件流/日志页 Activity
展示最近发生的事件：
- 花火创建任务、白狐提交调研报告
- 青狐推送代码、黑狐通过构建验证
- 某任务进入 REVIEW、某任务超时未更新

### 4.7 Git 与构建状态页
- 最近 commit、分支状态
- build 成功/失败、测试通过率
- changelog 更新、文档同步状态

---

## 5. Agent 状态协议

### 5.1 支持的 Event Types

| event | 说明 | 触发时机 |
|-------|------|---------|
| heartbeat | 心跳 | 每 15 秒自动 |
| claim_task | 领取任务 | 开始执行新任务 |
| update_task | 更新任务状态 | 状态变更时 |
| submit_result | 提交交付物 | 进入 REVIEW 时 |
| report_blocker | 报告阻塞 | 遇到障碍时 |
| complete_task | 完成任务 | 黑狐验收通过 |

### 5.2 心跳 Payload 格式（扩展）

```json
{
  "agent": "花火",
  "event": "heartbeat",
  "project": "FoxBoard",
  "task": "TASK-FB-003",
  "status": "writing",
  "priority": "P2",
  "message": "正在设计后端API架构",
  "timestamp": "2026-03-20T14:05:00+08:00"
}
```

---

## 6. 数据模型

### agents 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | Agent ID |
| name | TEXT | 成员名 |
| role | TEXT | 角色 |
| avatar | TEXT | 像素头像标识 |
| status | TEXT | 当前状态 |
| last_heartbeat | DATETIME | 最近心跳时间 |
| current_task_id | TEXT | 当前任务ID |

### projects 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | 项目ID |
| name | TEXT | 项目名 |
| description | TEXT | 描述 |
| status | TEXT | 状态 |
| owner | TEXT | 负责人 |
| progress | INTEGER | 完成度% |
| repo_url | TEXT | 仓库地址 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### tasks 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | 任务ID |
| project_id | TEXT FK | 所属项目 |
| title | TEXT | 标题 |
| description | TEXT | 描述 |
| task_type | TEXT | 类型 |
| status | TEXT | 状态 |
| owner_agent_id | TEXT | Owner |
| priority | TEXT | 优先级 |
| due_date | DATE | 截止日期 |
| depends_on | TEXT | 前置任务 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### task_logs 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| task_id | TEXT FK | 任务ID |
| agent_id | TEXT | 执行人 |
| event_type | TEXT | 事件类型 |
| message | TEXT | 描述 |
| created_at | DATETIME | 时间 |

### workflows 表（Phase 3 流程图点亮）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | 流程 ID |
| project_id | TEXT FK | 所属项目 |
| name | TEXT | 流程名称 |
| definition_json | TEXT | React Flow 节点/边定义 JSON |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### workflow_node_states 表（Phase 3 流程图点亮）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| workflow_id | TEXT FK | 所属流程 |
| node_key | TEXT | 节点标识（如 "白狐调研"） |
| status | TEXT | 灰色/蓝色/绿色/黄色/红色 |
| linked_task_id | TEXT | 关联任务 ID |
| updated_at | DATETIME | 更新时间 |

---

## 7. 技术选型

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | React + Tailwind + shadcn/ui | 现代 UI，可定制像素风 |
| 图表 | Recharts / ECharts | 数据可视化 |
| 流程图 | React Flow | 节点流程图 |
| 后端 | Python FastAPI | 轻量 API 服务 |
| 数据 | SQLite（起步）/ PostgreSQL（后期） | 持久化 |
| 状态推送 | WebSocket / SSE | 实时更新 |
| OpenClaw 对接 | HTTP API 心跳上报 | 解耦设计 |

---

## 8. 开发阶段

### Phase 1：最小可用版（MVP）
**目标**：FoxBoard 任务看板 + 成员状态页

- [ ] FoxBoard Backend：FastAPI + SQLite + 任务 CRUD API
- [ ] FoxBoard Frontend：任务看板页面（React）
- [ ] 成员状态页（四只狐狸卡片）
- [ ] 各狐狸接入脚本（复用 agent-push 协议）
- [ ] 活动日志页

### Phase 2：自动状态上报
- [ ] 心跳 API（扩展 payload：task_id, project_id, priority）
- [ ] 构建状态接入
- [ ] Git 提交抓取
- [ ] 基础通知

### Phase 3：流程图点亮
- [ ] React Flow 流程图
- [ ] 节点状态同步
- [ ] 阻塞节点高亮

### Phase 4：规则引擎与自动编排
- [ ] 超时提醒
- [ ] REVIEW 自动派给黑狐
- [ ] 任务完成自动激活下游
- [ ] 各角色专属 queue 视图

---

## 9. Star-Office-UI 调研结论（关键决策参考）

### 关键发现

**Backend 架构（app.py, 2103行）：**
- 框架：Flask（非 FastAPI）
- 持久化：**JSON 文件**（state.json, agents-state.json），非 SQLite
- 状态模型：`{state, detail, progress, updated_at}` — 简洁但缺少项目/任务字段
- 已有 6 种状态：idle/writing/researching/executing/syncing/error
- 并发控制：join key 粒度的 threading.Lock

**关键 API 路由：**
- `GET/POST /status` — 主 Agent 状态
- `POST /join-agent` — 访客加入（join key 机制）
- `POST /agent-push` — 访客主动推送状态（多 Agent 核心）
- `GET /agents` — 获取所有访客 Agent 列表

**Frontend 架构：**
- **纯 Canvas 像素游戏**（game.js），非 React/Vue
- 像素风办公室：角色在区域间移动，气泡显示状态
- **不支持任务看板 / React Flow**，改造代价 ≈ 重写

### 推荐决策：并行建设，不改 Star-Office-UI

| 组件 | 操作 |
|------|------|
| Star-Office-UI backend | 不改，作为 agent 状态服务（装饰性保留） |
| Star-Office-UI frontend | 不改，作为四狐像素状态可视化 |
| FoxBoard backend（新建） | FastAPI + SQLite，新增 projects/tasks/workflows API |
| FoxBoard frontend（新建） | React + Tailwind + React Flow + Recharts |

---

## 10. 成功指标

- [ ] 主人打开 FoxBoard 可在 10 秒内了解团队当前状态
- [ ] 所有正式任务必须经过看板，消除"口头任务"
- [ ] 花火通过 FoxBoard 汇报，无需手动整理
- [ ] 黑狐的 REVIEW 关口作用清晰可见
