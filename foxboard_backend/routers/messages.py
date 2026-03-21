"""
消息路由 - Agent 间通信
替代 FoxComms sessions_send + COMMS.md 双轨
所有通信走数据库，可查可追溯
发消息时自动推送：飞书通知 + 触发对方 cron
"""
from __future__ import annotations

import os
import subprocess
import threading
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from datetime import datetime

from ..database import get_conn
from ..models import MessageSend, Message, MessagePriority

router = APIRouter(prefix="/messages", tags=["messages"])

# OpenClaw CLI 路径
OPENCLAW_BIN = os.environ.get("OPENCLAW_BIN", "/home/muyin/.npm-global/bin/openclaw")
# 飞书群 ID
FEISHU_GROUP_ID = os.environ.get("FOXBOARD_FEISHU_GROUP", "oc_631ca66841ec4a2bf18e0853c4a9b0f8")

# Agent → Cron Job ID 映射（用于触发对方 cron）
AGENT_CRON_MAP = {
    "black_fox": "a1f497c3-b87d-4bb1-82e7-86e6b138270a",
    "qing_fox": "93c1d29a-fabb-4115-9ac0-f13246ae96fc",
    "white_fox": "4ab87156-2d91-4179-a9d6-666bf36a4758",
    "fox_leader": "cee8d7ff-937a-4212-8092-da64965e48d6",
}

# Agent 显示名映射
AGENT_NAMES = {
    "black_fox": "黑狐",
    "qing_fox": "青狐",
    "white_fox": "白狐",
    "fox_leader": "花火",
}


def _row_to_message(r) -> Message:
    return Message(
        id=r["id"],
        from_agent=r["from_agent"],
        to_agent=r["to_agent"],
        subject=r["subject"],
        body=r["body"],
        priority=r["priority"],
        ref_task_id=r["ref_task_id"],
        ref_project_id=r["ref_project_id"],
        is_read=bool(r["is_read"]),
        read_at=r["read_at"],
        created_at=r["created_at"],
    )


def _notify_feishu(from_agent: str, to_agent: str, body: str,
                   subject: str = None, ref_task_id: str = None):
    """异步推送飞书通知"""
    def _do():
        try:
            from_name = AGENT_NAMES.get(from_agent, from_agent)
            to_name = AGENT_NAMES.get(to_agent, to_agent)
            parts = [f"📨 {from_name} → {to_name}"]
            if subject:
                parts.append(f"【{subject}】")
            if ref_task_id:
                parts.append(f"[{ref_task_id}]")
            parts.append(body)
            text = " ".join(parts)
            # 截断避免飞书消息过长
            if len(text) > 500:
                text = text[:497] + "..."

            subprocess.run(
                [OPENCLAW_BIN, "message", "send",
                 "--channel", "feishu",
                 "-t", FEISHU_GROUP_ID,
                 "-m", text],
                capture_output=True, timeout=15,
            )
        except Exception as e:
            print(f"[Messages] 飞书通知失败: {e}")

    t = threading.Thread(target=_do, daemon=True)
    t.start()


def _trigger_cron(to_agent: str):
    """异步触发对方 cron job（如果有映射）"""
    job_id = AGENT_CRON_MAP.get(to_agent)
    if not job_id:
        return

    def _do():
        try:
            subprocess.run(
                [OPENCLAW_BIN, "cron", "run", job_id],
                capture_output=True, timeout=10,
            )
            print(f"[Messages] 已触发 {to_agent} cron: {job_id}")
        except Exception as e:
            print(f"[Messages] 触发 cron 失败: {e}")

    t = threading.Thread(target=_do, daemon=True)
    t.start()


@router.post("/", response_model=Message)
def send_message(payload: MessageSend, notify: bool = True):
    """
    发送消息（agent → agent）

    Args:
        notify: 是否推送通知（默认 True）
                - 飞书群实时通知
                - 触发收件人 cron 立即执行
    """
    conn = get_conn()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute("""
        INSERT INTO messages (from_agent, to_agent, subject, body, priority,
                              ref_task_id, ref_project_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (payload.from_agent, payload.to_agent, payload.subject, payload.body,
          payload.priority.value, payload.ref_task_id, payload.ref_project_id, now))
    conn.commit()
    msg_id = cursor.lastrowid
    cursor.execute("SELECT * FROM messages WHERE id = ?", (msg_id,))
    row = cursor.fetchone()
    conn.close()

    msg = _row_to_message(row)

    # 推送通知
    if notify:
        _notify_feishu(payload.from_agent, payload.to_agent, payload.body,
                       payload.subject, payload.ref_task_id)
        # urgent/high 优先级消息立即触发对方 cron
        if payload.priority.value in ("urgent", "high"):
            _trigger_cron(payload.to_agent)

    return msg


@router.get("/", response_model=List[Message])
def list_messages(
    to_agent: Optional[str] = None,
    from_agent: Optional[str] = None,
    unread_only: bool = False,
    priority: Optional[str] = None,
    ref_task_id: Optional[str] = None,
    limit: int = 50,
):
    """查询消息（收件箱 / 发件箱）"""
    conn = get_conn()
    cursor = conn.cursor()
    query = "SELECT * FROM messages WHERE 1=1"
    params = []
    if to_agent:
        query += " AND to_agent = ?"
        params.append(to_agent)
    if from_agent:
        query += " AND from_agent = ?"
        params.append(from_agent)
    if unread_only:
        query += " AND is_read = 0"
    if priority:
        query += " AND priority = ?"
        params.append(priority)
    if ref_task_id:
        query += " AND ref_task_id = ?"
        params.append(ref_task_id)
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [_row_to_message(r) for r in rows]


@router.patch("/{message_id}/read", response_model=Message)
def mark_read(message_id: int):
    """标记消息已读"""
    conn = get_conn()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute("UPDATE messages SET is_read = 1, read_at = ? WHERE id = ?", (now, message_id))
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="消息不存在")
    conn.commit()
    cursor.execute("SELECT * FROM messages WHERE id = ?", (message_id,))
    row = cursor.fetchone()
    conn.close()
    return _row_to_message(row)


@router.patch("/read-all")
def mark_all_read(to_agent: str):
    """标记某个 agent 的全部消息为已读"""
    conn = get_conn()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute("UPDATE messages SET is_read = 1, read_at = ? WHERE to_agent = ? AND is_read = 0",
                   (now, to_agent))
    count = cursor.rowcount
    conn.commit()
    conn.close()
    return {"ok": True, "marked_read": count}


@router.get("/unread-count")
def unread_count(to_agent: str):
    """查询未读消息数"""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as cnt FROM messages WHERE to_agent = ? AND is_read = 0", (to_agent,))
    row = cursor.fetchone()
    conn.close()
    return {"agent_id": to_agent, "unread": row["cnt"]}
