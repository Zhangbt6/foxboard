# FoxBoard - Code Repository

> AI 协作工作室指挥中台

## 目录

```
foxboard_backend/    FastAPI + SQLite 后端
frontend/            React + Tailwind 前端
  ├── pages/
  │   ├── Dashboard.tsx    Dashboard 首页（项目进度/事件流）
  │   ├── Kanban.tsx      任务看板（四列拖拽）
  │   ├── Agents.tsx       成员状态（实时心跳）
  │   └── Workflow.tsx     流程图（React Flow）
scripts/             运维脚本（foxboard_push, board_sync）
data/                SQLite 数据库
references/          参考项目（Star-Office-UI）
tests/               pytest 测试用例
```

## 关联

- **项目管理**: `Notebook/70_花火项目/FoxBoard/`（BOARD.md/任务卡/文档）
- **通信工具**: `~/.openclaw/workspace/scripts/foxcomms.py`

## 运行

```bash
# 后端
cd foxboard_backend && uvicorn app:app --reload --port 8000

# 前端
cd frontend && npm run dev
```
