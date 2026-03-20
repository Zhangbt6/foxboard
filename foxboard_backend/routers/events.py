"""
事件日志路由 - events
记录系统事件，用于审计和追踪
"""
from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter
from datetime import datetime

from ..database import get_conn
from ..models import EventCreate, Event

router = APIRouter(prefix="/events", tags=["events"])

@router.post("/", response_model=Event)
def create_event(payload: EventCreate):
    """写入事件日志"""
    conn = get_conn()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute("""
        INSERT INTO task_logs (task_id, agent_id, event_type, message, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        payload.task_id,
        payload.agent_id,
        payload.event_type.value,
        payload.message,
        payload.metadata,
        now,
    ))
    conn.commit()
    cursor.execute("SELECT * FROM task_logs WHERE id = last_insert_rowid()")
    row = cursor.fetchone()
    conn.close()
    return Event(
        id=row["id"],
        task_id=row["task_id"],
        agent_id=row["agent_id"],
        event_type=row["event_type"],
        message=row["message"],
        metadata=row["metadata"],
        created_at=row["created_at"],
    )

@router.get("/", response_model=List[Event])
def list_events(
    task_id: Optional[str] = None,
    agent_id: Optional[str] = None,
    event_type: Optional[str] = None,
    limit: int = 50,
):
    """查询事件日志"""
    conn = get_conn()
    cursor = conn.cursor()
    query = "SELECT * FROM task_logs WHERE 1=1"
    params = []
    if task_id:
        query += " AND task_id = ?"
        params.append(task_id)
    if agent_id:
        query += " AND agent_id = ?"
        params.append(agent_id)
    if event_type:
        query += " AND event_type = ?"
        params.append(event_type)
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [
        Event(
            id=r["id"],
            task_id=r["task_id"],
            agent_id=r["agent_id"],
            event_type=r["event_type"],
            message=r["message"],
            metadata=r["metadata"],
            created_at=r["created_at"],
        )
        for r in rows
    ]
