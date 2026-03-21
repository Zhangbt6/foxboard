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
from ..event_bus import event_bus

router = APIRouter(prefix="/events", tags=["events"])

@router.post("/", response_model=Event)
def create_event(payload: EventCreate):
    """写入事件日志（通过 EventBus 统一分发）"""
    # 通过 EventBus 发送事件（自动写 DB + WebSocket 广播）
    result = event_bus.emit(
        event_type=payload.event_type.value,
        task_id=payload.task_id,
        actor_id=payload.agent_id,
        payload={"message": payload.message, "metadata": payload.metadata},
    )
    return Event(
        id=result["_db_id"],
        task_id=payload.task_id,
        agent_id=payload.agent_id,
        event_type=payload.event_type,
        message=payload.message,
        metadata=payload.metadata,
        created_at=result["timestamp"],
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
