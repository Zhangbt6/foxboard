# OpenClaw 集成文档

## 概述

FoxBoard 与 OpenClaw Agent 的深度集成，使 Agent 能够自动将已安装的技能（Skills）注册为能力标签（capability_tags），实现基于能力的智能任务派单。

---

## 一、OpenClaw Skills 目录结构

OpenClaw Skills 安装在两个位置：

| 位置 | 说明 |
|------|------|
| `~/.openclaw/skills/` | 用户安装的技能（bilibili-monitor, browser-automation 等） |
| `~/.npm-global/lib/node_modules/openclaw/skills/` | OpenClaw 内置技能（clawhub, coding-agent 等） |

每个 Skill 是一个目录，包含 `SKILL.md`（YAML frontmatter 格式），其中 `name` 字段即技能标识名。

```yaml
# SKILL.md 示例
---
name: bilibili-monitor
display-name: B站热门视频监控
description: 生成B站热门视频日报并发送邮件
version: 1.0.8
---
```

---

## 二、能力标签同步 API

### POST /agents/{agent_id}/sync-skills

自动扫描两个 Skills 目录，将所有已安装技能的 name 字段追加到 Agent 的 `capability_tags`。

**请求示例：**
```bash
curl -X POST http://localhost:8000/agents/qing_fox/sync-skills
```

**响应示例：**
```json
{
  "id": "qing_fox",
  "name": "小青",
  "capability_tags": "1password,apple-notes,bilibili-monitor,clawhub,coding-agent,...",
  "is_online": true
}
```

**特性：**
- 自动合并现有 `capability_tags`（不覆盖）
- 自动去重（已有标签不重复追加）
- 如果没有找到任何 Skill，返回当前标签不变
- Skills 目录只读，不会在其中写文件

---

## 三、基于能力的派单算法

### GET /agents/available?capability={tag}

查询符合指定能力标签的所有在线 Agent，按当前任务负载升序排列（适合派单）。

**请求示例：**
```bash
# 查找会 python 的在线 Agent
curl "http://localhost:8000/agents/available?capability=python"

# 查找会前端开发的在线 Agent
curl "http://localhost:8000/agents/available?capability=frontend"
```

**响应示例：**
```json
[
  {
    "agent_id": "qing_fox",
    "name": "小青",
    "role": "developer",
    "status": "idle",
    "is_online": true,
    "capability_tags": "python,backend,frontend",
    "task_count": 2,
    "current_task_id": null,
    "last_heartbeat": "2026-03-24T00:48:01"
  }
]
```

**派单逻辑：**
1. 筛选 `is_online = 1` 的 Agent
2. 筛选 `capability_tags` 包含指定 tag 的 Agent
3. 按 `task_count`（DOING/TODO/REVIEW/BLOCKED 任务数）升序
4. 返回负载最低的 Agent 排在前面

---

## 四、手动更新能力标签

### PATCH /agents/{agent_id}/capabilities

手动设置 Agent 的能力标签（覆盖而非追加）。

```bash
curl -X PATCH http://localhost:8000/agents/qing_fox/capabilities \
  -H "Content-Type: application/json" \
  -d '{"capability_tags": "python,backend,research"}'
```

---

## 五、OpenClaw Agent 自动心跳

OpenClaw Agent 通过定时调用心跳 API 保持在线状态：

```bash
# Agent 启动时注册（仅首次需要）
POST /agents/register
body: {"agent_id": "qing_fox", "name": "青狐", "role": "developer"}

# 定期心跳（建议每 60 秒一次）
POST /agents/qing_fox/heartbeat

# 查看在线状态
GET /agents/qing_fox/status
```

---

## 六、集成架构图

```
OpenClaw Agent
    │
    ├──► POST /agents/register    （首次注册）
    ├──► POST /agents/qing_fox/heartbeat  （定时心跳）
    ├──► POST /agents/qing_fox/sync-skills （同步 Skills → capability_tags）
    │
    ▼
FoxBoard Backend (agents 表)
    │
    ├──► capability_tags 字段存储 Agent 能力
    ├──► is_online 字段实时状态
    └──► task_count 任务负载统计
    │
    ▼
派单算法
GET /agents/available?capability=python
    │
    ▼
返回负载最低的在线 Agent → 任务派单
```

---

## 七、最佳实践

1. **Agent 启动时调用 sync-skills**：确保 capability_tags 包含所有已安装技能
2. **Skills 安装后重新 sync**：当 Agent 安装新技能后，再次调用 sync-skills 更新标签
3. **结合心跳使用**：心跳可以携带当前任务信息，sync-skills 不影响心跳状态
4. **空 capability_tags**：表示该 Agent 无限制，可接受任何任务

---

## 八、相关文件

- `foxboard_backend/routers/agents.py` — Agent 路由实现
- `foxboard_backend/models.py` — Agent Pydantic 模型
- `foxboard_backend/database.py` — 数据库连接与 agents 表 schema
- `data/foxboard.db` — SQLite 数据库文件
