"""
任务路由 - tasks
提供任务 CRUD、看板视图、超时检测、依赖管理等 API
"""
from __future__ import annotations

import asyncio
import sqlite3
import sys
import threading
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone, timedelta

from ..database import get_conn
from ..models import (
    TaskCreate, TaskUpdate, Task, TaskStatus,
    KanbanView, KanbanColumn,
    TaskClaimRequest, TaskSubmitRequest,
    TaskReviewRequest, TaskRejectRequest,
    TaskBulkCreateRequest, TaskOperationResponse, TaskBulkResponse,
)
from ..event_bus import event_bus
from ..task_context import build_task_context

# 添加 scripts 路径，以便导入 FoxComms


def _run_async_broadcast(coro):
    """
    在独立线程的新事件循环中运行异步协程。
    解决 sync route handler 中 asyncio.get_event_loop() 返回未运行 loop 的问题。
    """
    def _thread_target():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(coro)
        finally:
            loop.close()
    t = threading.Thread(target=_thread_target, daemon=True)
    t.start()
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
        started_at=row["started_at"],
        depends_on=row["depends_on"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        completed_at=row["completed_at"],
    )


def _notify_black_fox(task_id: str, title: str):
    """任务进入 REVIEW 时通知黑狐审核"""
    # 阻止测试数据误报（测试任务ID以 FB-SUB- 开头）
    if task_id.startswith("FB-SUB-"):
        return
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
            activated.append(task_row["title"])
            # 通过 EventBus 记录激活事件
            event_bus.task_activated(
                task_id=task_row["id"],
                project_id=None,
                activated_by="system",
                reason=f"依赖任务 {completed_task_id} 已完成，自动激活",
            )

    conn.commit()
    conn.close()
    if activated:
        print(f"[AUTO] 激活依赖任务: {activated}")


def _check_timeouts():
    """扫描 DOING 任务，通过 EventBus 写入超时事件"""
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
                event_bus.task_timeout(
                    task_id=row["id"],
                    project_id=row["project_id"],
                    threshold_hours=TIMEOUT_HOURS,
                )
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
    try:
        cursor.execute("""
            INSERT INTO tasks (id, title, description, status, priority, assignee_id, project_id, tags, depends_on, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            payload.id, payload.title, payload.description, task_status,
            payload.priority, payload.assignee_id, payload.project_id,
            payload.tags, payload.depends_on, now, now
        ))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Task with id '{payload.id}' already exists")
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (payload.id,))
    row = cursor.fetchone()
    task = row_to_task(row)
    conn.close()

    # 通过 EventBus 记录事件（自动写 DB + WebSocket 广播）
    event_bus.task_created(
        task_id=payload.id,
        project_id=payload.project_id,
        actor_id=payload.assignee_id or "system",
        task_data=task.model_dump(),
    )

    return task


@router.get("/{task_id}")
def get_task(task_id: str, with_context: bool = False):
    """
    获取单个任务。
    with_context=true 时返回 TaskOperationResponse（含上下文）。
    """
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found")

    # 查项目名（用于 project_summary）
    project_name = None
    if row["project_id"]:
        cursor.execute("SELECT name FROM projects WHERE id = ?", (row["project_id"],))
        proj_row = cursor.fetchone()
        if proj_row:
            project_name = proj_row["name"]
    conn.close()

    task = row_to_task(row)

    if with_context:
        from ..models import TaskContext
        context = build_task_context(
            task_id=task.id,
            task_title=task.title,
            task_description=task.description,
            task_tags=task.tags,
            task_depends_on=task.depends_on,
            project_id=task.project_id,
            project_name=project_name,
            db_description=None,
        )
        tc = TaskContext(**context)
        return TaskOperationResponse(ok=True, task=task, context=tc)

    return task


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
    task = row_to_task(updated_row)
    conn.close()

    # 通过 EventBus 记录事件
    event_bus.task_updated(
        task_id=task_id,
        project_id=row["project_id"],
        actor_id=payload.assignee_id or "system",
        changes={k: v for k, v in payload.model_dump().items() if v is not None},
    )

    return task


@router.delete("/{task_id}")
def delete_task(task_id: str):
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found")
    cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()

    # 通过 EventBus 记录删除事件
    event_bus.task_deleted(task_id=task_id, project_id=row["project_id"], actor_id="system")

    return {"ok": True, "deleted": task_id}


# ---- Task Lifecycle Endpoints ----

def _write_task_log(conn, task_id: str, agent_id: str, event_type: str, message: str):
    """写入 task_log 的工具函数"""
    now = datetime.utcnow().isoformat()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO task_logs (task_id, agent_id, event_type, message, created_at)
        VALUES (?, ?, ?, ?, ?)
    """, (task_id, agent_id, event_type, message, now))
    conn.commit()


def _broadcast_task_change(task_id: str, action: str, task_data: dict):
    """触发 WebSocket 广播的辅助函数"""
    try:
        from ..websocket_manager import ws_manager
        _run_async_broadcast(ws_manager.broadcast_task_update(
            task_id=task_id,
            action=action,
            task_data=task_data
        ))
    except Exception:
        pass


@router.post("/{task_id}/claim", response_model=TaskOperationResponse)
def claim_task(task_id: str, payload: TaskClaimRequest):
    """
    员工领取任务：TODO → DOING
    - 设置 started_at
    - 更新 agents.current_task_id
    - 通过 EventBus 记录事件（自动写 DB + 广播）
    """
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found")

    if row["status"] != "TODO":
        conn.close()
        raise HTTPException(status_code=400, detail=f"任务状态为 {row['status']}，只能在 TODO 状态下领取")

    now = datetime.utcnow().isoformat()

    # 更新任务状态
    cursor.execute("""
        UPDATE tasks SET status = 'DOING', assignee_id = ?, started_at = ?, updated_at = ?
        WHERE id = ?
    """, (payload.agent_id, now, now, task_id))

    # 更新 agent 的 current_task_id
    cursor.execute("""
        UPDATE agents SET current_task_id = ?, updated_at = ?
        WHERE id = ?
    """, (task_id, now, payload.agent_id))

    conn.commit()
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    updated_row = cursor.fetchone()
    task = row_to_task(updated_row)
    conn.close()

    # 通过 EventBus 记录事件（自动写 DB + WebSocket 广播）
    event_bus.task_claimed(
        task_id=task_id,
        project_id=row["project_id"],
        actor_id=payload.agent_id,
    )

    # 构建任务上下文
    project_name = None
    conn2 = get_conn()
    cursor2 = conn2.cursor()
    if row["project_id"]:
        cursor2.execute("SELECT name FROM projects WHERE id = ?", (row["project_id"],))
        proj_row = cursor2.fetchone()
        if proj_row:
            project_name = proj_row["name"]
    conn2.close()

    from ..models import TaskContext
    context = build_task_context(
        task_id=task.id,
        task_title=task.title,
        task_description=task.description,
        task_tags=task.tags,
        task_depends_on=task.depends_on,
        project_id=task.project_id,
        project_name=project_name,
        db_description=None,
    )
    tc = TaskContext(**context)

    return TaskOperationResponse(ok=True, task=task, message="任务已领取", context=tc)


@router.post("/{task_id}/submit", response_model=TaskOperationResponse)
def submit_task(task_id: str, payload: TaskSubmitRequest):
    """
    员工提交任务：DOING → REVIEW
    - 清除 agents.current_task_id
    - 通知黑狐审核
    - 通过 EventBus 记录事件
    """
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found")

    if row["status"] != "DOING":
        conn.close()
        raise HTTPException(status_code=400, detail=f"任务状态为 {row['status']}，只能在 DOING 状态下提交")

    now = datetime.utcnow().isoformat()

    # 更新任务状态
    cursor.execute("""
        UPDATE tasks SET status = 'REVIEW', updated_at = ?
        WHERE id = ?
    """, (now, task_id))

    # 清除 agent 的 current_task_id
    cursor.execute("""
        UPDATE agents SET current_task_id = NULL, updated_at = ?
        WHERE id = ?
    """, (now, payload.agent_id))

    conn.commit()
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    updated_row = cursor.fetchone()
    task = row_to_task(updated_row)
    conn.close()

    # 通过 EventBus 记录事件
    event_bus.task_submitted(
        task_id=task_id,
        project_id=row["project_id"],
        actor_id=payload.agent_id,
        message=payload.message,
    )

    # 通知黑狐审核
    _notify_black_fox(task_id, task.title)

    return TaskOperationResponse(ok=True, task=task, message="任务已提交，等待审核")


@router.post("/{task_id}/review", response_model=TaskOperationResponse)
def review_task(task_id: str, payload: TaskReviewRequest):
    """
    审核通过：REVIEW → DONE
    - 设置 completed_at
    - 激活依赖任务
    - 通过 EventBus 记录事件
    """
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found")

    if row["status"] != "REVIEW":
        conn.close()
        raise HTTPException(status_code=400, detail=f"任务状态为 {row['status']}，只能在 REVIEW 状态下审核")

    now = datetime.utcnow().isoformat()

    # 更新任务状态
    cursor.execute("""
        UPDATE tasks SET status = 'DONE', completed_at = ?, updated_at = ?
        WHERE id = ?
    """, (now, now, task_id))

    conn.commit()
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    updated_row = cursor.fetchone()
    task = row_to_task(updated_row)
    conn.close()

    # 通过 EventBus 记录事件
    event_bus.task_review_passed(
        task_id=task_id,
        project_id=row["project_id"],
        auditor_id=payload.auditor_id,
    )

    # 激活依赖任务
    _activate_blocked_tasks(task_id)

    return TaskOperationResponse(ok=True, task=task, message="审核通过，任务已完成")


@router.post("/{task_id}/reject", response_model=TaskOperationResponse)
def reject_task(task_id: str, payload: TaskRejectRequest):
    """
    审核打回：REVIEW → DOING
    - 保留 started_at
    - 通过 EventBus 记录事件
    """
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found")

    if row["status"] != "REVIEW":
        conn.close()
        raise HTTPException(status_code=400, detail=f"任务状态为 {row['status']}，只能在 REVIEW 状态下打回")

    now = datetime.utcnow().isoformat()

    # 更新任务状态（保留 started_at）
    cursor.execute("""
        UPDATE tasks SET status = 'DOING', updated_at = ?
        WHERE id = ?
    """, (now, task_id))

    conn.commit()
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    updated_row = cursor.fetchone()
    task = row_to_task(updated_row)
    conn.close()

    # 通过 EventBus 记录事件
    event_bus.task_review_failed(
        task_id=task_id,
        project_id=row["project_id"],
        auditor_id=payload.auditor_id,
        reason=payload.reason,
    )

    return TaskOperationResponse(ok=True, task=task, message=f"任务已打回：{payload.reason}")


@router.post("/bulk", response_model=TaskBulkResponse)
def bulk_create_tasks(payload: TaskBulkCreateRequest):
    """
    批量创建任务。
    接受 TaskCreate 数组，逐条创建。
    部分失败不影响其他任务，最终返回成功列表和失败列表。
    """
    created = []
    failed = []

    for task_create in payload.tasks:
        conn = get_conn()
        cursor = conn.cursor()
        now = datetime.utcnow().isoformat()
        task_status = task_create.status.value if task_create.status else "TODO"
        try:
            cursor.execute("""
                INSERT INTO tasks (id, title, description, status, priority, assignee_id, project_id, tags, depends_on, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                task_create.id, task_create.title, task_create.description, task_status,
                task_create.priority, task_create.assignee_id, task_create.project_id,
                task_create.tags, task_create.depends_on, now, now
            ))
            conn.commit()
            cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_create.id,))
            row = cursor.fetchone()
            task = row_to_task(row)
            created.append(task)
            # 通过 EventBus 记录事件
            event_bus.task_created(
                task_id=task_create.id,
                project_id=task_create.project_id,
                actor_id="bulk",
                task_data=task.model_dump(),
            )
        except sqlite3.IntegrityError as e:
            conn.rollback()
            failed.append({"id": task_create.id, "title": task_create.title, "error": f"任务 ID 已存在：{task_create.id}"})
        except Exception as e:
            conn.rollback()
            failed.append({"id": task_create.id, "title": task_create.title, "error": str(e)})
        finally:
            conn.close()

    return TaskBulkResponse(ok=len(failed) == 0, created=created, failed=failed)


@router.get("/system/check-timeout", tags=["system"])
def check_timeout():
    """手动触发超时检测（实际由后台定时调用）"""
    triggered = _check_timeouts()
    return {"checked": "timeout", "triggered": triggered, "threshold_hours": TIMEOUT_HOURS}
