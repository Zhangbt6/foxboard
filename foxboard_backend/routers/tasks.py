"""
任务路由 - tasks
提供任务 CRUD、看板视图、超时检测、依赖管理等 API
"""
from __future__ import annotations

import asyncio
import os
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
    TaskArchiveRequest,
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
    d = dict(row)
    return Task(
        id=d["id"],
        title=d["title"],
        description=d.get("description"),
        status=d["status"],
        priority=d["priority"],
        assignee_id=d.get("assignee_id"),
        project_id=d.get("project_id"),
        tags=d.get("tags"),
        started_at=d.get("started_at"),
        depends_on=d.get("depends_on"),
        created_at=d["created_at"],
        updated_at=d["updated_at"],
        completed_at=d.get("completed_at"),
        archived_at=d.get("archived_at"),
        archive_phase=d.get("archive_phase"),
        archive_note=d.get("archive_note"),
    )


def _is_test_task(task_id: str) -> bool:
    """测试任务不触发通知"""
    return task_id.startswith("FB-SUB-") or task_id.startswith("TEST-")


def _is_test_runtime() -> bool:
    """pytest 运行期间禁止真实外发通知"""
    return bool(os.environ.get("PYTEST_CURRENT_TEST"))


# ---- FB-051: EventBus → Workflow 状态联动 ----
# 任务状态 → 工作流节点状态 映射
_TASK_TO_NODE_STATUS: Record[str, str] = {
    "TODO":    "pending",
    "DOING":   "running",
    "REVIEW":  "review",
    "DONE":    "done",
    "BLOCKED": "blocked",
}


def _sync_workflow_node_for_task(task_id: str, task_status: str) -> None:
    """
    当任务状态变化时，同步更新对应工作流节点的显示状态。
    实现 EventBus → Workflow 状态联动（FB-051）。

    逻辑：
    1. 在 workflow_node_states 表中查找关联该 task_id 的节点
    2. 将该节点 status 更新为对应的工作流状态
    """
    node_status = _TASK_TO_NODE_STATUS.get(task_status)
    if not node_status:
        return

    try:
        conn = get_conn()
        cursor = conn.cursor()
        # 查找关联该 task_id 的工作流节点
        cursor.execute(
            "SELECT workflow_id, node_id FROM workflow_node_states WHERE task_id = ?",
            (task_id,)
        )
        row = cursor.fetchone()
        if not row:
            conn.close()
            return

        workflow_id = row["workflow_id"]
        node_id = row["node_id"]
        now = datetime.utcnow().isoformat()

        cursor.execute("""
            UPDATE workflow_node_states
            SET status = ?, updated_at = ?
            WHERE workflow_id = ? AND node_id = ?
        """, (node_status, now, workflow_id, node_id))
        conn.commit()
        conn.close()
        print(f"[FB-051] 同步工作流节点 {workflow_id}/{node_id} → {node_status} (task={task_id})")
    except Exception as e:
        # 不阻塞主流程，仅记录
        print(f"[FB-051] 工作流节点同步失败: {e}")



def _notify_via_foxcomms(to: str, message: str, sender: str = "系统", msg_type: str = None, wake: bool = True):
    """统一 FoxComms 通知入口"""
    if _is_test_runtime() or not to:
        return
    try:
        from foxcomms import FoxComms
        FoxComms("FoxBoard").send(
            to=to,
            message=message,
            sender=sender,
            msg_type=msg_type,
            wake=wake,
            notify_group=True,
        )
    except Exception as e:
        print(f"[WARN] FoxComms 通知 {to} 失败: {e}")


# Agent ID → 中文名映射
AGENT_NAME_MAP = {
    "qing_fox": "青狐", "white_fox": "白狐", "black_fox": "黑狐",
    "main": "花火", "worker": "青狐",
}


def _notify_assignee(task_id: str, title: str, assignee_id: str, action: str = "派单"):
    """任务分配/创建时通知负责人"""
    if _is_test_task(task_id) or not assignee_id:
        return
    name = AGENT_NAME_MAP.get(assignee_id)
    if not name:
        return
    _notify_via_foxcomms(
        to=name,
        message=f"TASK-{task_id}「{title}」已分配给你，请领取执行",
        sender="花火",
        msg_type="派单",
    )


def _notify_black_fox(task_id: str, title: str, submitter: str = "青狐"):
    """任务进入 REVIEW 时通知黑狐审核"""
    if _is_test_task(task_id):
        return
    _notify_via_foxcomms(
        to="黑狐",
        message=f"TASK-{task_id}「{title}」已进入 REVIEW，请审核",
        sender=submitter,
        msg_type="审核",
    )


def _notify_review_result(task_id: str, title: str, assignee_id: str, passed: bool, reason: str = ""):
    """审核结果通知执行人 + 花火"""
    if _is_test_task(task_id):
        return
    name = AGENT_NAME_MAP.get(assignee_id) if assignee_id else None
    if passed:
        msg = f"TASK-{task_id}「{title}」审核通过 ✅"
        if name:
            _notify_via_foxcomms(to=name, message=msg, sender="黑狐", msg_type="通知", wake=False)
        _notify_via_foxcomms(to="花火", message=msg, sender="黑狐", msg_type="通知", wake=False)
    else:
        msg = f"TASK-{task_id}「{title}」审核打回 ❌ 原因：{reason}"
        if name:
            _notify_via_foxcomms(to=name, message=msg, sender="黑狐", msg_type="通知", wake=True)


def _append_archive_record(project_id: str, task_row, phase_label: str, operator_id: str, note: str = None):
    """归档后追加到当前 phase 的开发记录"""
    try:
        base = "/home/muyin/.openclaw/workspace/black_fox/projects/FoxBoard/docs"
        file_path = os.path.join(base, f"{phase_label.upper()}_ARCHIVE.md")
        if not os.path.exists(file_path):
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(f"# {phase_label.upper()} Archive\n\n")
                f.write("| 时间 | 任务ID | 任务名 | 负责人 | 操作者 | 备注 |\n")
                f.write("|------|--------|--------|--------|--------|------|\n")
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M")
        with open(file_path, "a", encoding="utf-8") as f:
            f.write(
                f"| {now} | {task_row['id']} | {task_row['title']} | {task_row['assignee_id'] or '—'} | {operator_id} | {note or ''} |\n"
            )
    except Exception as e:
        print(f"[WARN] 归档记录写入失败: {e}")


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
    query = "SELECT t.* FROM tasks t WHERE t.archived_at IS NULL"
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
    query = "SELECT * FROM tasks WHERE archived_at IS NULL"
    params = []
    if project_id:
        query += " AND project_id = ?"
        params.append(project_id)
    query += " ORDER BY priority DESC, created_at DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    columns = []
    for status in ["TODO", "DOING", "REVIEW", "DONE", "BLOCKED"]:
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
    query = "SELECT * FROM tasks WHERE assignee_id = ? AND archived_at IS NULL"
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

    # R3: 创建任务时自动通知负责人
    if payload.assignee_id:
        _notify_assignee(payload.id, payload.title, payload.assignee_id)

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
        submitter_name = AGENT_NAME_MAP.get(payload.assignee_id or row["assignee_id"], "青狐")
        _notify_black_fox(task_id, row["title"], submitter_name)

    # R3: assignee 变更时通知新负责人
    if payload.assignee_id and payload.assignee_id != row["assignee_id"]:
        _notify_assignee(task_id, row["title"], payload.assignee_id)

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

    # FB-051: 同步工作流节点状态
    _sync_workflow_node_for_task(task_id, task.status)

    return task


@router.delete("/{task_id}")
def delete_task(task_id: str):
    """销毁任务：直接删除，不保留在 active 看板"""
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

    return {"ok": True, "deleted": task_id, "mode": "destroyed"}


@router.post("/{task_id}/archive")
def archive_task(task_id: str, payload: TaskArchiveRequest):
    """归档任务：从当前看板退出，并写入 phase 版本归档记录"""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found")
    if row["archived_at"] is not None:
        conn.close()
        return {"ok": True, "archived": task_id, "phase": row["archive_phase"], "message": "任务已归档"}
    if row["status"] != "DONE":
        conn.close()
        raise HTTPException(status_code=400, detail="只有 DONE 任务才能归档")

    now = datetime.utcnow().isoformat()
    cursor.execute(
        """
        UPDATE tasks
        SET archived_at = ?, archive_phase = ?, archive_note = ?, updated_at = ?
        WHERE id = ?
        """,
        (now, payload.phase_label.upper(), payload.note, now, task_id),
    )
    conn.commit()
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    updated = cursor.fetchone()
    conn.close()

    _append_archive_record(updated["project_id"], updated, payload.phase_label, payload.operator_id, payload.note)
    event_bus.task_updated(
        task_id=task_id,
        project_id=updated["project_id"],
        actor_id=payload.operator_id,
        changes={"archived_at": now, "archive_phase": payload.phase_label.upper()},
    )
    return {"ok": True, "archived": task_id, "phase": payload.phase_label.upper(), "message": "任务已归档"}


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

    # FB-051: 同步工作流节点状态（claim: TODO → DOING → running）
    _sync_workflow_node_for_task(task_id, "DOING")

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

    # FB-051: 同步工作流节点状态（submit: DOING → REVIEW → review）
    _sync_workflow_node_for_task(task_id, "REVIEW")

    # 通知黑狐审核
    submitter_name = AGENT_NAME_MAP.get(payload.agent_id, "青狐")
    _notify_black_fox(task_id, task.title, submitter_name)

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

    # FB-051: 同步工作流节点状态（pass: REVIEW → DONE → done）
    _sync_workflow_node_for_task(task_id, "DONE")

    # 激活依赖任务
    _activate_blocked_tasks(task_id)

    # R3: 审核通过通知执行人 + 花火
    _notify_review_result(task_id, row["title"], row["assignee_id"], passed=True)

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

    # FB-051: 同步工作流节点状态（reject: REVIEW → DOING → running）
    _sync_workflow_node_for_task(task_id, "DOING")

    # R3: 审核打回通知执行人
    _notify_review_result(task_id, row["title"], row["assignee_id"], passed=False, reason=payload.reason)

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
            # R3: 批量创建也通知负责人
            if task_create.assignee_id:
                _notify_assignee(task_create.id, task_create.title, task_create.assignee_id)
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
