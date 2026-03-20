# FoxBoard Agent 状态协议规范 v1.0

> 制定：花火 + 白狐 | 版本：v0.1.0 | 日期：2026-03-20

---

## 1. 概述

本协议定义四只狐狸（花火/白狐/青狐/黑狐）接入 FoxBoard 的标准化状态上报规范，包括心跳扩展 payload、事件类型定义、统一推送脚本接口。

**设计原则**：
- 最小字段 + 可扩展
- 向后兼容 Star-Office-UI agent-push 格式
- 统一入口，四狐共用 `foxboard_push.py`

---

## 2. Event Types

| event | 说明 | 触发时机 |
|-------|------|---------|
| `heartbeat` | 心跳保活 | 每 15 秒自动发送 |
| `claim_task` | 领取任务 | 正式开始执行新任务 |
| `update_task` | 更新任务状态 | 状态字段变更（DOING→REVIEW 等） |
| `submit_result` | 提交交付物 | 进入 REVIEW 审核阶段 |
| `report_blocker` | 报告阻塞 | 遇到障碍无法继续 |
| `complete_task` | 完成任务 | 黑狐验收通过，任务关闭 |

---

## 3. Payload 格式

### 3.1 基础心跳 Payload（所有事件通用）

```json
{
  "agent": "白狐",
  "event": "heartbeat",
  "project": "FoxBoard",
  "task": "TASK-FB-002",
  "status": "researching",
  "priority": "P2",
  "message": "正在调研 Plane.so 竞品方案",
  "timestamp": "2026-03-20T15:30:00+08:00"
}
```

### 3.2 各字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `agent` | string | ✅ | 狐狸名称：花火 / 白狐 / 青狐 / 黑狐 |
| `event` | string | ✅ | 事件类型（见上表） |
| `project` | string | ✅ | 所属项目 ID，如 FoxBoard |
| `task` | string | ✅ | 当前任务 ID，如 TASK-FB-003（无任务填"-"） |
| `status` | string | ✅ | 当前工作阶段 |
| `priority` | string | ⚙️ | 优先级：P1 / P2 / P3（无任务填"-"） |
| `message` | string | ✅ | 人类可读状态描述（50字以内） |
| `timestamp` | string | ✅ | ISO 8601 格式（含时区） |

### 3.3 status 工作阶段枚举

| status | 含义 |
|--------|------|
| `idle` | 空闲待命 |
| `writing` | 撰写/文档中 |
| `researching` | 调研/搜索中 |
| `executing` | 执行/开发中 |
| `syncing` | 同步/推送中 |
| `reviewing` | 审核中 |
| `error` | 异常/阻塞 |

### 3.4 事件示例

**claim_task（领取任务）**
```json
{
  "agent": "白狐",
  "event": "claim_task",
  "project": "FoxBoard",
  "task": "TASK-FB-002",
  "status": "researching",
  "priority": "P2",
  "message": "白狐领取 TASK-FB-002 竞品调研任务",
  "timestamp": "2026-03-20T14:05:00+08:00"
}
```

**update_task（状态变更）**
```json
{
  "agent": "青狐",
  "event": "update_task",
  "project": "FoxBoard",
  "task": "TASK-FB-003",
  "status": "executing",
  "priority": "P2",
  "message": "TASK-FB-003 状态更新：TODO → DOING",
  "timestamp": "2026-03-20T14:10:00+08:00"
}
```

**submit_result（提交交付物）**
```json
{
  "agent": "白狐",
  "event": "submit_result",
  "project": "FoxBoard",
  "task": "TASK-FB-002",
  "status": "reviewing",
  "priority": "P2",
  "message": "TASK-FB-002 调研报告已提交，等待黑狐审核",
  "timestamp": "2026-03-20T16:00:00+08:00"
}
```

**report_blocker（报告阻塞）**
```json
{
  "agent": "青狐",
  "event": "report_blocker",
  "project": "FoxBoard",
  "task": "TASK-FB-003",
  "status": "error",
  "priority": "P1",
  "message": "FB-003 遇到阻塞：SQLite 并发写入问题，需花火确认方案",
  "timestamp": "2026-03-20T15:45:00+08:00"
}
```

**complete_task（任务完成）**
```json
{
  "agent": "黑狐",
  "event": "complete_task",
  "project": "FoxBoard",
  "task": "TASK-FB-002",
  "status": "idle",
  "priority": "P2",
  "message": "TASK-FB-002 验收通过，标记 DONE",
  "timestamp": "2026-03-20T17:00:00+08:00"
}
```

---

## 4. 推送脚本规范

### 4.1 统一推送脚本

所有狐狸统一使用 `scripts/foxboard_push.py`，通过命令行参数指定事件类型和状态。

**调用格式**：
```bash
python3 foxboard_push.py <state> <detail> [--event EVENT] [--task TASK] [--project PROJECT] [--priority PRIORITY]
```

**参数说明**：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `state` | 工作阶段（idle/writing/researching/executing/syncing/error） | idle |
| `detail` | 状态描述文本 | "" |
| `--event` | 事件类型 | heartbeat |
| `--task` | 任务 ID | - |
| `--project` | 项目 ID | FoxBoard |
| `--priority` | 优先级 | - |

### 4.2 各狐狸专属入口脚本

每只狐狸在各自工作空间创建 `push.sh`，封装通用调用。

**白狐**（`/home/muyin/.openclaw/workspace/white_fox/push.sh`）：
```bash
#!/bin/bash
# 白狐 FoxBoard 状态推送入口
# 用法：./push.sh <state> [detail]
# 示例：./push.sh researching "正在调研 Plane.so"

cd /home/muyin/.openclaw/workspace/Notebook/70_花火项目/FoxBoard/scripts
python3 foxboard_push.py "$1" "$2" \
  --agent "白狐" \
  --project "FoxBoard"
```

**黑狐**（`/home/muyin/.openclaw/workspace/black_fox/push.sh`）：
```bash
#!/bin/bash
# 黑狐 FoxBoard 状态推送入口
cd /home/muyin/.openclaw/workspace/Notebook/70_花火项目/FoxBoard/scripts
python3 foxboard_push.py "$1" "$2" \
  --agent "黑狐" \
  --project "FoxBoard"
```

**青狐/花火**（各自工作空间同理，路径指向 `Notebook/70_花火项目/FoxBoard/scripts`）

### 4.3 心跳自动调度

各狐狸在 `HEARTBEAT.md` 或 cron 任务中每 15 秒触发一次心跳：
```bash
# 心跳定时（每15秒，本地测试用）
while true; do
  ./push.sh idle "心跳保活"
  sleep 15
done
```

---

## 5. 向后兼容 Star-Office-UI

当 Star-Office-UI 后端（port 19000）可用时，`foxboard_push.py` 同时向其推送原始格式：

```json
{
  "name": "白狐",
  "joinKey": "foxboard_white_fox",
  "state": "researching",
  "detail": "正在调研 Plane.so 竞品方案"
}
```

---

## 6. FoxBoard 后端 API（状态接收）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/agent-push` | POST | 接收 agent 状态上报 |
| `/api/agents` | GET | 获取所有 agent 状态快照 |
| `/api/agents/:name` | GET | 获取指定 agent 最新状态 |

---

## 7. 审核标准检查

- [x] payload 覆盖所有必要字段（agent/event/project/task/status/priority/message/timestamp）
- [x] 文档包含完整 6 种事件示例
- [x] 各狐狸推送脚本接口统一
- [x] 向后兼容 Star-Office-UI

---

## 8. 变更记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v0.1.0 | 2026-03-20 | 初始版本，定义基础协议 + 推送脚本规范 |
