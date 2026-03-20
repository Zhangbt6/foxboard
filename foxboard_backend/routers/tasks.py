"""
任务路由 - tasks
提供任务 CRUD、看板视图、超时检测、依赖管理等 API
"""
from __future__ import annotations

import sys
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone, timedelta

from ..database import get_conn
from ..models import (
    TaskCreate, TaskUpdate, Task, TaskStatus,
    KanbanView, KanbanColumn
)

# 添加 scripts 路径，以便导入 FoxComms
sys.path.insert(0, "/home/muyin/.openclaw/workspace/scripts")

router = APIRouter(prefix="/tasks", tags=["tasks"])

# 超时阈值（小时），可在环境变量覆盖
TIMEOUT_HOURS = float(__import__("os").environ.get("TASK_TIMEOUT_HOURS", "2"))


def row_to_task(row) -> Task:
    return Task(
        id=row["id"],
        title=row["title"],
        description=row["description"],
        status=row["status"],
        priority=row["priority"],
        assignee_id=row["assignee_id"],
        project_id=row["project_id"],
        tags=row["tags"],
        started_at=row.get("started_at"),
        depends_on=row.get("depends_on"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        completed_at=row["completed_at"],
    )


def _notify_black_fox(task_id: str, title: str):
    """任务进入 REVIEW 时通知黑狐审核"""
    try:
        from foxcomms import FoxComms
        FoxComms("FoxBoard").send(
            to="黑狐",
            message=f"TASK-{task_id}「{title}」已进入 REVIEW，请审核",
            sender="青狐",
            msg_type="审核",
            wake=True,
            notify_group=True,
        )
    except Exception as e:
        print(f"[WARN] FoxComms 通知黑狐失败: {e}")


def _activate_blocked_tasks(completed_task_id: str):
    """
    当任务完成时，自动激活依赖它的下游任务。
    depends_on 格式：逗号分隔的任务ID列表，如 "FB-TASK-001,FB-TASK-002"
    """
    conn = get_conn()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()

    # 查找所有被 completed_task_id 阻塞的 BLOCKED 任务
    cursor.execute("""
        SELECT id, title, depends_on FROM tasks
        WHERE status = 'BLOCKED'
    """)
    blocked = cursor.fetchall()

    activated = []
    for task_row in blocked:
        depends_raw = task_row["depends_on"]
        if not depends_raw:
            continue
        deps = [d.strip() for d in depends_raw.split(",") if d.strip()]
        if completed_task_id not in deps:
            continue

        # 检查所有依赖是否都已 DONE
        placeholders = ",".join(["?"] * len(deps))
        cursor.execute(f"SELECT COUNT(*) as cnt FROM tasks WHERE id IN ({placeholders}) AND status = 'DONE'", deps)
        if cursor.fetchone()["cnt"] == len(deps):
            cursor.execute("UPDATE tasks SET status = 'TODO', updated_at = ? WHERE id = ?", (now, task_row["id"]))
            cursor.execute("""
                INSERT INTO task_logs (task_id, agent_id, event_type, message, created_at)
                VALUES (?, 'system', 'task_activated', ?, ?)
            """, (task_row["id"], f"依赖任务 {completed_task_id} 已完成，自动激活", now))
            activated.append(task_row["title"])

    conn.commit()
    conn.close()
    if activated:
        print(f"[AUTO] 激活依赖任务: {activated}")


def _check_timeouts():
    """扫描 DOING 任务，写入超时事件"""
    conn = get_conn()
    cursor = conn.cursor()
    now = datetime.utcnow()
    threshold = timedelta(hours=TIMEOUT_HOURS)
    triggered = []

    cursor.execute("SELECT * FROM tasks WHERE status = 'DOING' AND started_at IS NOT NULL")
    for row in cursor.fetchall():
        try:
            started = datetime.fromisoformat(row["started_at"].replace("Z", "+00:00"))
            if now - started > threshold:
                cursor.execute("""
                    INSERT INTO task_logs (task_id, agent_id, event_type, message, created_at)
                    VALUES (?, 'system', 'task_timeout', ?, ?)
                    ON CONFLICT DO NOTHING
                """, (row["id"], f"任务超时（>{TIMEOUT_HOURS}h）", now.isoformat()))
                triggered.append(row["title"])
        except Exception:
            pass

    conn.commit()
    conn.close()
    return triggered


@router.get("/", response_model=List[Task])
def list_tasks(
    status: Optional[str] = None,
    assignee_id: Optional[str] = None,
    project_id: Optional[str] = None,
    role: Optional[str] = None,
):
    """
    列出任务，支持按 status / assignee_id / project_id / role 过滤。
    role 过滤：按 agents 表的 role 字段筛选（如 'worker' / 'auditor'）
    """
    conn = get_conn()
    cursor = conn.cursor()
    query = "SELECT t.* FROM tasks t WHERE 1=1"
    params = []
    if status:
        query += " AND t.status = ?"
        params.append(status)
    if assignee_id:
        query += " AND t.assignee_id = ?"
        params.append(assignee_id)
    if project_id:
        query += " AND t.project_id = ?"
        params.append(project_id)
    if role:
        query += " AND t.assignee_id IN (SELECT id FROM agents WHERE role = ?)"
        params.append(role)
    query += " ORDER BY t.priority DESC, t.created_at DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [row_to_task(r) for r in rows]


@router.get("/kanban", response_model=KanbanView)
def kanban_view(project_id: Optional[str] = None):
    """看板视图——四列 TODO / DOING / REVIEW / DONE"""
    conn = get_conn()
    cursor = conn.cursor()
    query = "SELECT * FROM tasks"
    params = []
    if project_id:
        query += " WHERE project_id = ?"
        params.append(project_id)
    query += " ORDER BY priority DESC, created_at DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    columns = []
    for status in ["TODO", "DOING", "REVIEW", "DONE"]:
        tasks = [row_to_task(r) for r in rows if r["status"] == status]
        columns.append(KanbanColumn(status=status, tasks=tasks))
    return KanbanView(columns=columns)


@router.get("/my", response_model=List[Task])
def my_tasks(agent_id: str, status: Optional[str] = None):
    """
    我的任务视图——按 agent_id 筛选任务。
    前端"我的任务"入口调用此接口。
    """
    conn = get_conn()
    cursor = conn.cursor()
    query = "SELECT * FROM tasks WHERE assignee_id = ?"
    params = [agent_id]
    if status:
        query += " AND status = ?"
        params.append(status)
    query += " ORDER BY priority DESC, created_at DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [row_to_task(r) for r in rows]


@router.post("/", response_model=Task)
def create_task(payload: TaskCreate):
    """创建任务"""
    conn = get_conn()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    task_status = payload.status.value if payload.status else "TODO"
    cursor.execute("""
        INSERT INTO tasks (id, title, description, status, priority, assignee_id, project_id, tags, depends_on, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        payload.id, payload.title, payload.description, task_status,
        payload.priority, payload.assignee_id, payload.project_id,
        payload.tags, payload.depends_on, now, now
    ))
    conn.commit()
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (payload.id,))
    row = cursor.fetchone()
    conn.close()
    return row_to_task(row)


@router.get("/{task_id}", response_model=Task)
def get_task(task_id: str):
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")
    return row_to_task(row)


@router.patch("/{task_id}", response_model=Task)
def update_task(task_id: str, payload: TaskUpdate):
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found")

    old_status = row["status"]
    now = datetime.utcnow().isoformat()

    new_started_at = row["started_at"]
    new_completed_at = row["completed_at"]

    # 状态变更逻辑
    new_status = payload.status.value if payload.status else None
    if new_status == "DOING" and old_status != "DOING":
        new_started_at = now  # 记录开始时间
    if new_status == "DONE" and old_status != "DONE":
        new_completed_at = now
        # 触发依赖激活
        _activate_blocked_tasks(task_id)

    cursor.execute("""
        UPDATE tasks SET
            title = COALESCE(?, title),
            description = COALESCE(?, description),
            status = COALESCE(?, status),
            priority = COALESCE(?, priority),
            assignee_id = COALESCE(?, assignee_id),
            project_id = COALESCE(?, project_id),
            tags = COALESCE(?, tags),
            depends_on = COALESCE(?, depends_on),
            started_at = ?,
            completed_at = ?,
            updated_at = ?
        WHERE id = ?
    """, (
        payload.title, payload.description, new_status,
        payload.priority, payload.assignee_id, payload.project_id,
        payload.tags, payload.depends_on,
        new_started_at, new_completed_at, now, task_id
    ))
    conn.commit()

    # REVIEW → 通知黑狐审核
    if new_status == "REVIEW" and old_status != "REVIEW":
        _notify_black_fox(task_id, row["title"])

    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    updated_row = cursor.fetchone()
    conn.close()
    return row_to_task(updated_row)


@router.delete("/{task_id}")
def delete_task(task_id: str):
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found")
    cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()
    return {"ok": True, "deleted": task_id}


@router.get("/system/check-timeout", tags=["system"])
def check_timeout():
    """手动触发超时检测（实际由后台定时调用）"""
    triggered = _check_timeouts()
    return {"checked": "timeout", "triggered": triggered, "threshold_hours": TIMEOUT_HOURS}
