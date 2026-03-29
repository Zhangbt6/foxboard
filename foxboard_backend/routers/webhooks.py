"""
Webhook 路由 - webhooks
支持创建/列出/删除 Webhook，以及查询投递历史
"""
from __future__ import annotations

import hashlib
import hmac
import json
import time
import uuid
from datetime import datetime
from typing import List, Optional

import requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..database import get_conn
from .webhook_handler import deliver_webhook, schedule_retry


router = APIRouter(prefix="/webhooks", tags=["webhooks"])


# ---- Request/Response Models ----
class WebhookCreate(BaseModel):
    url: str
    events: List[str]
    secret: Optional[str] = None
    project_id: Optional[str] = None


class Webhook(BaseModel):
    id: str
    url: str
    events: List[str]
    secret: Optional[str]
    is_active: bool
    project_id: Optional[str]
    created_at: str


class WebhookDelivery(BaseModel):
    id: int
    webhook_id: str
    event_type: str
    payload: str
    response_code: Optional[int]
    delivered_at: str


# ---- Webhook 管理 API ----

@router.post("/", response_model=Webhook)
def create_webhook(data: WebhookCreate):
    """创建 Webhook"""
    conn = get_conn()
    cursor = conn.cursor()

    webhook_id = f"wh-{uuid.uuid4().hex[:12]}"
    events_json = json.dumps(data.events)
    now = datetime.utcnow().isoformat()

    cursor.execute("""
        INSERT INTO webhooks (id, url, events, secret, is_active, project_id, created_at)
        VALUES (?, ?, ?, ?, 1, ?, ?)
    """, (webhook_id, data.url, events_json, data.secret, data.project_id, now))
    conn.commit()
    conn.close()

    return Webhook(
        id=webhook_id,
        url=data.url,
        events=data.events,
        secret=data.secret,
        is_active=True,
        project_id=data.project_id,
        created_at=now,
    )


@router.get("/", response_model=List[Webhook])
def list_webhooks(project_id: Optional[str] = None):
    """列出 Webhook"""
    conn = get_conn()
    cursor = conn.cursor()

    if project_id:
        cursor.execute("""
            SELECT * FROM webhooks WHERE project_id = ? ORDER BY created_at DESC
        """, (project_id,))
    else:
        cursor.execute("SELECT * FROM webhooks ORDER BY created_at DESC")

    rows = cursor.fetchall()
    conn.close()

    return [
        Webhook(
            id=row["id"],
            url=row["url"],
            events=json.loads(row["events"]),
            secret=row["secret"] if "secret" in row.keys() else None,
            is_active=bool(row["is_active"]),
            project_id=row["project_id"] if "project_id" in row.keys() else None,
            created_at=row["created_at"],
        )
        for row in rows
    ]


@router.delete("/{webhook_id}")
def delete_webhook(webhook_id: str):
    """删除 Webhook"""
    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM webhooks WHERE id = ?", (webhook_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Webhook not found")

    cursor.execute("DELETE FROM webhooks WHERE id = ?", (webhook_id,))
    conn.commit()
    conn.close()

    return {"ok": True, "message": f"Webhook {webhook_id} deleted"}


@router.get("/{webhook_id}/deliveries", response_model=List[WebhookDelivery])
def get_deliveries(webhook_id: str, limit: int = 50):
    """查询投递历史"""
    conn = get_conn()
    cursor = conn.cursor()

    # 先确认 webhook 存在
    cursor.execute("SELECT id FROM webhooks WHERE id = ?", (webhook_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Webhook not found")

    cursor.execute("""
        SELECT * FROM webhook_deliveries
        WHERE webhook_id = ?
        ORDER BY delivered_at DESC
        LIMIT ?
    """, (webhook_id, limit))

    rows = cursor.fetchall()
    conn.close()

    return [
        WebhookDelivery(
            id=row["id"],
            webhook_id=row["webhook_id"],
            event_type=row["event_type"],
            payload=row["payload"],
            response_code=row["response_code"],
            delivered_at=row["delivered_at"],
        )
        for row in rows
    ]


@router.post("/{webhook_id}/test")
def test_webhook(webhook_id: str):
    """发送测试事件到指定 Webhook"""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM webhooks WHERE id = ?", (webhook_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Webhook not found")

    test_payload = {
        "event_type": "test",
        "timestamp": datetime.utcnow().isoformat(),
        "payload": {"message": "FoxBoard Webhook 测试事件"},
    }

    try:
        headers = {"Content-Type": "application/json"}
        if row["secret"]:
            body_str = json.dumps(test_payload)
            sig = hmac.new(
                row["secret"].encode(),
                body_str.encode(),
                hashlib.sha256
            ).hexdigest()
            headers["X-FoxBoard-Signature"] = f"sha256={sig}"

        resp = requests.post(
            row["url"],
            json=test_payload,
            headers=headers,
            timeout=5,
        )
        return {"ok": True, "status_code": resp.status_code}
    except Exception as e:
        return {"ok": False, "error": str(e)}
