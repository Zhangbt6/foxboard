"""
项目路由 - projects
提供项目 CRUD API
"""
from __future__ import annotations

import sqlite3
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException

from ..database import get_conn
from ..models import ProjectCreate, Project, ProjectStatus
from ..event_bus import EventBus, EventType

router = APIRouter(prefix="/projects", tags=["projects"])


def row_to_project(row) -> Project:
    return Project(
        id=row["id"],
        name=row["name"],
        description=row["description"],
        status=row["status"],
        owner=row["owner"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.get("/", response_model=List[Project])
def list_projects(status: Optional[str] = None):
    """列出所有项目，支持按 status 过滤"""
    conn = get_conn()
    cursor = conn.cursor()
    query = "SELECT * FROM projects WHERE 1=1"
    params = []
    if status:
        query += " AND status = ?"
        params.append(status)
    query += " ORDER BY created_at DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [row_to_project(r) for r in rows]


@router.get("/{project_id}", response_model=Project)
def get_project(project_id: str):
    """获取单个项目"""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    return row_to_project(row)


@router.post("/", response_model=Project, status_code=201)
def create_project(payload: ProjectCreate):
    """创建项目（数据库记录 + 项目目录模板初始化）"""
    conn = get_conn()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    try:
        cursor.execute("""
            INSERT INTO projects (id, name, description, status, owner, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            payload.id,
            payload.name,
            payload.description,
            ProjectStatus.active.value,
            payload.owner,
            now,
            now,
        ))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Project with id '{payload.id}' already exists")
    cursor.execute("SELECT * FROM projects WHERE id = ?", (payload.id,))
    row = cursor.fetchone()
    conn.close()

    # 初始化项目目录模板（幂等，不覆盖已有文件）
    from ..project_template import init_project_template
    from ..event_bus import EventBus
    template_result = init_project_template(
        project_name=payload.name,
        description=payload.description,
        owner=payload.owner,
        status=ProjectStatus.active.value,
    )
    print(f"[projects] 项目目录初始化: {template_result}")

    # 发出 project_created 事件
    event_bus = EventBus()
    event_bus.emit(
        event_type=EventType.PROJECT_CREATED,
        project_id=payload.id,
        actor_id=payload.owner,
        payload={
            "message": f"项目 '{payload.name}' 已创建",
            "project_name": payload.name,
            "project_dir": template_result["project_dir"],
            "created_files": template_result["created_files"],
            "skipped_files": template_result["skipped_files"],
        },
    )

    return row_to_project(row)


@router.patch("/{project_id}", response_model=Project)
def update_project(project_id: str, payload: dict):
    """
    更新项目（支持部分更新）。
    可更新字段：name, description, status, owner
    """
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Project not found")

    now = datetime.utcnow().isoformat()
    updates = []
    params = []

    if "name" in payload and payload["name"] is not None:
        updates.append("name = ?")
        params.append(payload["name"])
    if "description" in payload and payload["description"] is not None:
        updates.append("description = ?")
        params.append(payload["description"])
    if "status" in payload and payload["status"] is not None:
        updates.append("status = ?")
        params.append(payload["status"])
    if "owner" in payload and payload["owner"] is not None:
        updates.append("owner = ?")
        params.append(payload["owner"])

    if updates:
        updates.append("updated_at = ?")
        params.append(now)
        params.append(project_id)
        cursor.execute(
            f"UPDATE projects SET {', '.join(updates)} WHERE id = ?",
            params
        )
        conn.commit()

    cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    updated_row = cursor.fetchone()
    conn.close()
    return row_to_project(updated_row)


@router.delete("/{project_id}")
def delete_project(project_id: str):
    """删除项目（仅限 archived 状态）"""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Project not found")
    if row["status"] != ProjectStatus.archived.value:
        conn.close()
        raise HTTPException(status_code=400, detail="Only archived projects can be deleted")
    cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    conn.commit()
    conn.close()
    return {"ok": True, "deleted": project_id}
