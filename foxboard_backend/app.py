"""
FoxBoard 后端主入口 - FastAPI
提供任务看板 + Agent 管理 API
"""
import os
import threading
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from foxboard_backend.database import init_db, migrate_add_columns, migrate_add_state_detail, migrate_add_messages_and_reports, migrate_add_phases, migrate_add_is_online, migrate_add_capability_tags, migrate_add_webhooks, migrate_add_indexes, migrate_add_agents_indexes
from foxboard_backend.routers import agents, tasks, events, workflows, projects, websocket, messages, reports, analytics, phases, stats, webhooks

TIMEOUT_INTERVAL = int(os.environ.get("TASK_TIMEOUT_INTERVAL_SECONDS", "300"))  # 默认5分钟检测一次
HEARTBEAT_TIMEOUT = 300  # 5分钟无心跳视为离线

_timer_lock = threading.Lock()
_scheduler_running = True

def _timeout_scheduler():
    """后台线程：定期扫描超时任务"""
    global _scheduler_running
    while _scheduler_running:
        time.sleep(TIMEOUT_INTERVAL)
        if not _scheduler_running:
            break
        try:
            # 延迟导入避免循环依赖
            from foxboard_backend.routers.tasks import _check_timeouts
            triggered = _check_timeouts()
            if triggered:
                print(f"[SCHEDULER] 超时任务: {triggered}")
        except Exception as e:
            print(f"[SCHEDULER] 超时检测异常: {e}")

def _heartbeat_cleanup_scheduler():
    """后台线程：定期清理超时不活跃的 Agent（设置 is_online=0）"""
    global _scheduler_running
    while _scheduler_running:
        time.sleep(60)  # 每分钟检查一次
        if not _scheduler_running:
            break
        try:
            from foxboard_backend.database import get_conn
            from datetime import datetime, timedelta
            conn = get_conn()
            cursor = conn.cursor()
            cutoff = (datetime.utcnow() - timedelta(seconds=HEARTBEAT_TIMEOUT)).isoformat()
            cursor.execute(
                "UPDATE agents SET is_online = 0, updated_at = ? WHERE is_online = 1 AND (last_heartbeat IS NULL OR last_heartbeat < ?)",
                (datetime.utcnow().isoformat(), cutoff)
            )
            conn.commit()
            if cursor.rowcount > 0:
                print(f"[SCHEDULER] Agent 离线清理: {cursor.rowcount} 个设为 offline")
            conn.close()
        except Exception as e:
            print(f"[SCHEDULER] Agent 心跳清理异常: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时
    init_db()
    migrate_add_columns()
    migrate_add_state_detail()
    migrate_add_messages_and_reports()
    migrate_add_phases()
    migrate_add_is_online()
    migrate_add_capability_tags()
    migrate_add_webhooks()
    migrate_add_indexes()
    migrate_add_agents_indexes()
    global _scheduler_running
    _scheduler_running = True
    t1 = threading.Thread(target=_timeout_scheduler, daemon=True)
    t1.start()
    t2 = threading.Thread(target=_heartbeat_cleanup_scheduler, daemon=True)
    t2.start()
    print(f"[SCHEDULER] 超时检测线程已启动（间隔 {TIMEOUT_INTERVAL}s）")
    print(f"[SCHEDULER] Agent 心跳清理线程已启动（间隔 60s，超时 {HEARTBEAT_TIMEOUT}s）")
    yield
    # 关闭时
    _scheduler_running = False

app = FastAPI(
    title="FoxBoard API",
    description="花火看板系统后端 API",
    version="0.4.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents.router)
app.include_router(tasks.router)
app.include_router(events.router)
app.include_router(workflows.router)
app.include_router(projects.router)
app.include_router(websocket.router)
app.include_router(messages.router)
app.include_router(reports.router)
app.include_router(analytics.router)
app.include_router(phases.router)
app.include_router(stats.router)
app.include_router(webhooks.router)

@app.get("/", tags=["health"])
def root():
    return {"status": "ok", "service": "FoxBoard API", "version": "0.4.0"}

@app.get("/health", tags=["health"])
def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
