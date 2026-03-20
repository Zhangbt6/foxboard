# TASK-FB-003: 后端骨架开发——FastAPI + SQLite

## 基本信息
- **状态**: TODO ⬜
- **版本**: v0.1.0
- **分配**: 青狐
- **优先级**: P2
- **创建**: 2026-03-20
- **依赖**: TASK-FB-001（PRD定稿）
- **并行**: 可与 TASK-FB-002 同时进行

## 目标
搭建 FoxBoard 后端最小骨架，提供任务 CRUD API、成员心跳 API、事件日志 API，为前端开发提供可联调的后端。

## 输入
- PRD.md v1.1（花火提供）
- 数据模型：**Phase 1 只建 3 个表**（agents / tasks / task_logs）
- projects / workflows / workflow_node_states 表留到 Phase 2-3

## 步骤
1. 创建后端项目结构：
   ```
   FoxBoard/backend/
   ├── app.py              # FastAPI 主入口
   ├── models.py            # Pydantic 数据模型
   ├── database.py          # SQLite（纯 sqlite3，不用 SQLAlchemy）
   ├── routers/
   │   ├── agents.py       # 成员心跳、注册
   │   ├── tasks.py        # 任务 CRUD + 看板视图
   │   └── events.py       # 事件日志
   └── requirements.txt
   ```
2. 实现数据模型（agents / projects / tasks / task_logs）
3. 实现核心 API：
   - `POST /agents/register` — 成员注册
   - `POST /agents/heartbeat` — 心跳（含 task_id / project_id / priority）
   - `GET/POST /projects/` — 项目 CRUD
   - `GET/POST /tasks/` — 任务 CRUD
   - `GET /tasks/kanban` — 看板视图（四列分组）
   - `POST /events/` — 事件日志写入
4. SQLite 数据库初始化脚本
5. 写 README.md（本地启动说明）
6. 自测：每个 API 用 curl 或 httpx 测试通过

## 输出
- 完整可运行的后端骨架
- `backend/README.md`（启动说明）
- 所有 API 经自测可用

## 技术要求
- FastAPI + SQLAlchemy + SQLite
- 所有模型用 Pydantic 验证
- CORS 配置允许前端开发服务器访问
- 数据库文件存放在 `FoxBoard/data/foxboard.db`

## 审核标准
- `python app.py` 能启动（无报错）
- 所有 API 用 curl 测试返回正确 JSON
- 数据库文件正常创建
- README 包含启动命令
