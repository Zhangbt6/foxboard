"""
任务路由 - tasks
提供任务 CRUD 和看板视图 API
"""
from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, HTTPException
from datetime import datetime

from ..database import get_conn
from ..models import (
    TaskCreate, TaskUpdate, Task, TaskStatus,
    KanbanView, KanbanColumn, ProjectCreate, Project
)

router = APIRouter(prefix="/tasks", tags=["tasks"])

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
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        completed_at=row["completed_at"],
    )

@router.get("/", response_model=List[Task])
def list_tasks(
    status: Optional[str] = None,
    assignee_id: Optional[str] = None,
    project_id: Optional[str] = None,
):
    """列出任务，支持按 status / assignee_id / project_id 过滤"""
    conn = get_conn()
    cursor = conn.cursor()
    query = "SELECT * FROM tasks WHERE 1=1"
    params = []
    if status:
        query += " AND status = ?"
        params.append(status)
    if assignee_id:
        query += " AND assignee_id = ?"
        params.append(assignee_id)
    if project_id:
        query += " AND project_id = ?"
        params.append(project_id)
    query += " ORDER BY priority DESC, created_at DESC"
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

@router.post("/", response_model=Task)
def create_task(payload: TaskCreate):
    """创建任务"""
    conn = get_conn()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    try:
        cursor.execute("""
            INSERT INTO tasks (id, title, description, priority, assignee_id, project_id, tags, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (payload.id, payload.title, payload.description, payload.priority,
              payload.assignee_id, payload.project_id, payload.tags, now, now))
        conn.commit()
        cursor.execute("SELECT * FROM tasks WHERE id = ?", (payload.id,))
        row = cursor.fetchone()
        conn.close()
        return row_to_task(row)
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=str(e))

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
    now = datetime.utcnow().isoformat()
    completed_at = None
    new_status = payload.status if payload.status else None
    cursor.execute("""
        UPDATE tasks SET
            title = COALESCE(?, title),
            description = COALESCE(?, description),
            status = COALESCE(?, status),
            priority = COALESCE(?, priority),
            assignee_id = COALESCE(?, assignee_id),
            project_id = COALESCE(?, project_id),
            tags = COALESCE(?, tags),
            completed_at = COALESCE(?, completed_at),
            updated_at = ?
        WHERE id = ?
    """, (
        payload.title, payload.description,
        new_status.value if new_status else None,
        payload.priority, payload.assignee_id, payload.project_id, payload.tags,
        completed_at, now, task_id
    ))
    conn.commit()
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    row = cursor.fetchone()
    conn.close()
    return row_to_task(row)

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
