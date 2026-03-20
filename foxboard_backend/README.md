# FoxBoard Backend

FastAPI + SQLite 后端骨架，为 FoxBoard 看板系统提供 REST API。

## 技术栈

- FastAPI 0.115+
- Uvicorn (ASGI server)
- Pydantic v2 (数据验证)
- SQLite (纯 sqlite3，无需 ORM)

## 快速启动

```bash
cd foxboard_backend
pip install -r requirements.txt
python -m uvicorn foxboard_backend.app:app --reload --port 8000
```

服务启动后访问：http://localhost:8000/docs （自动生成 Swagger 文档）

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /health | 健康检查 |
| POST | /agents/register | 成员注册 |
| POST | /agents/heartbeat | 成员心跳 |
| GET | /agents/ | 成员列表 |
| GET | /tasks/ | 任务列表（支持过滤） |
| GET | /tasks/kanban | 看板视图（4列分组） |
| POST | /tasks/ | 创建任务 |
| GET | /tasks/{id} | 获取任务 |
| PATCH | /tasks/{id} | 更新任务 |
| DELETE | /tasks/{id} | 删除任务 |
| POST | /events/ | 写入事件日志 |
| GET | /events/ | 查询事件日志 |

## 数据库

- 路径: `FoxBoard/data/foxboard.db`
- 表: `agents`, `projects`, `tasks`, `task_logs`
- Phase 1 仅建 agents/tasks/task_logs 3表

## 自测命令

```bash
# 健康检查
curl http://localhost:8000/health

# 注册成员
curl -X POST http://localhost:8000/agents/register \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"fox_001","name":"小青狐","role":"worker"}'

# 心跳
curl -X POST http://localhost:8000/agents/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"fox_001","status":"busy","priority":5}'

# 创建任务
curl -X POST http://localhost:8000/tasks/ \
  -H "Content-Type: application/json" \
  -d '{"id":"FB-TASK-001","title":"示例任务","priority":8}'

# 看板视图
curl http://localhost:8000/tasks/kanban
```
