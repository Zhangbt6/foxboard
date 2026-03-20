"""
成员路由 - agents
提供成员注册和心跳 API
"""
from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, HTTPException
from datetime import datetime

from ..database import get_conn
from ..models import AgentRegister, AgentHeartbeat, Agent, AgentStatus

router = APIRouter(prefix="/agents", tags=["agents"])

def row_to_agent(row) -> Agent:
    return Agent(
        id=row["id"],
        name=row["name"],
        role=row["role"],
        status=row["status"],
        current_task_id=row["current_task_id"],
        current_project_id=row["current_project_id"],
        priority=row["priority"],
        last_heartbeat=row["last_heartbeat"],
        state_detail=row.get("state_detail"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )

@router.post("/register", response_model=Agent)
def register_agent(payload: AgentRegister):
    """成员注册"""
    conn = get_conn()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute("""
        INSERT INTO agents (id, name, role, status, created_at, updated_at)
        VALUES (?, ?, ?, 'idle', ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            role = excluded.role,
            updated_at = excluded.updated_at
    """, (payload.agent_id, payload.name, payload.role.value, now, now))
    conn.commit()
    cursor.execute("SELECT * FROM agents WHERE id = ?", (payload.agent_id,))
    row = cursor.fetchone()
    conn.close()
    return row_to_agent(row)

@router.post("/heartbeat", response_model=Agent)
def heartbeat(payload: AgentHeartbeat):
    """成员心跳上报"""
    conn = get_conn()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute("SELECT * FROM agents WHERE id = ?", (payload.agent_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Agent {payload.agent_id} not found")

    # 获取 state_detail（可由 heartbeat 附带）
    state_detail = getattr(payload, 'state_detail', None) or row.get("state_detail")

    cursor.execute("""
        UPDATE agents SET
            status = ?,
            current_task_id = ?,
            current_project_id = ?,
            priority = ?,
            state_detail = COALESCE(?, state_detail),
            last_heartbeat = ?,
            updated_at = ?
        WHERE id = ?
    """, (
        payload.status.value,
        payload.task_id,
        payload.project_id,
        payload.priority,
        state_detail,
        now, now,
        payload.agent_id,
    ))
    conn.commit()
    cursor.execute("SELECT * FROM agents WHERE id = ?", (payload.agent_id,))
    row = cursor.fetchone()
    conn.close()
    return row_to_agent(row)

@router.get("/", response_model=List[Agent])
def list_agents():
    """列出所有成员"""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM agents ORDER BY last_heartbeat DESC")
    rows = cursor.fetchall()
    conn.close()
    return [row_to_agent(r) for r in rows]

@router.get("/{agent_id}", response_model=Agent)
def get_agent(agent_id: str):
    """获取单个成员"""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM agents WHERE id = ?", (agent_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Agent not found")
    return row_to_agent(row)

@router.patch("/{agent_id}/state-detail", response_model=Agent)
def update_state_detail(agent_id: str, detail: str = None):
    """
    更新单个成员的 state_detail 字段。
    各 agent 的 push 脚本调用此 API 主动上报工作详情。
    """
    if detail is None:
        raise HTTPException(status_code=400, detail="detail is required")
    conn = get_conn()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute("SELECT * FROM agents WHERE id = ?", (agent_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")
    cursor.execute(
        "UPDATE agents SET state_detail = ?, updated_at = ? WHERE id = ?",
        (detail, now, agent_id)
    )
    conn.commit()
    cursor.execute("SELECT * FROM agents WHERE id = ?", (agent_id,))
    row = cursor.fetchone()
    conn.close()
    return row_to_agent(row)
