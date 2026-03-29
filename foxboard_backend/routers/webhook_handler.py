"""
Webhook 投递处理器
负责：
1. 同步/异步投递 Webhook 事件
2. 签名验证（HMAC-SHA256）
3. 重试机制（最多3次，间隔 1min/5min/30min）
"""
from __future__ import annotations

import hashlib
import hmac
import json
import threading
import time
import requests
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..database import get_conn


# ---- 投递函数 ----

def _deliver_single(webhook_id: str, url: str, event_type: str,
                    payload: Dict[str, Any], secret: Optional[str],
                    delivery_id: int) -> bool:
    """
    向单个 URL 投递事件，返回是否成功。
    投递记录（response_code）会写入 webhook_deliveries 表。
    """
    headers = {"Content-Type": "application/json"}
    body = json.dumps(payload)

    if secret:
        sig = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
        headers["X-FoxBoard-Signature"] = f"sha256={sig}"

    try:
        resp = requests.post(url, data=body.encode(), headers=headers, timeout=10)
        response_code = resp.status_code
    except requests.RequestException as e:
        response_code = 0  # 网络错误用 0 表示

    # 写投递记录
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE webhook_deliveries SET response_code = ?, delivered_at = datetime('now')
        WHERE id = ?
    """, (response_code, delivery_id))
    conn.commit()
    conn.close()

    return 200 <= response_code < 300


def deliver_webhook(webhook_id: str, url: str, event_type: str,
                    payload: Dict[str, Any], secret: Optional[str] = None):
    """
    同步投递 Webhook（建议在线程中调用避免阻塞主请求）。
    失败时不重试（重试由 schedule_retry 处理）。
    """
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO webhook_deliveries (webhook_id, event_type, payload, response_code, delivered_at)
        VALUES (?, ?, ?, NULL, datetime('now'))
    """, (webhook_id, event_type, json.dumps(payload)))
    conn.commit()
    delivery_id = cursor.lastrowid
    conn.close()

    return _deliver_single(webhook_id, url, event_type, payload, secret, delivery_id)


def schedule_retry(webhook_id: str, url: str, event_type: str,
                   payload: Dict[str, Any], secret: Optional[str],
                   attempt: int):
    """
    安排重试：失败后 1min / 5min / 30min 重试，最多3次。
    attempt: 当前是第几次（1-based），下次是 attempt+1
    """
    retry_delays = {1: 60, 2: 300, 3: 1800}  # 秒
    delay = retry_delays.get(attempt)
    if delay is None:
        print(f"[Webhook] {webhook_id} 已达最大重试次数，放弃: {event_type}")
        return

    def _retry():
        time.sleep(delay)
        conn2 = get_conn()
        cursor2 = conn2.cursor()
        cursor2.execute("""
            INSERT INTO webhook_deliveries (webhook_id, event_type, payload, response_code, delivered_at)
            VALUES (?, ?, ?, NULL, datetime('now'))
        """, (webhook_id, event_type, json.dumps(payload)))
        conn2.commit()
        delivery_id = cursor2.lastrowid
        conn2.close()

        success = _deliver_single(webhook_id, url, event_type, payload, secret, delivery_id)
        if not success and attempt < 3:
            schedule_retry(webhook_id, url, event_type, payload, secret, attempt + 1)

    t = threading.Thread(target=_retry, daemon=True)
    t.start()


# ---- Webhook 事件触发入口 ----

def trigger_webhooks(project_id: Optional[str], event_type: str, payload: Dict[str, Any]):
    """
    根据事件类型查询所有匹配的活跃 Webhook，并异步投递。
    在事件发生时由 event_bus 或 tasks 路由调用。

    event_type 例如: "task.created", "task.status_changed", "task.completed", "task.review_requested"
    """
    conn = get_conn()
    cursor = conn.cursor()

    # 查询所有匹配的活跃 Webhook
    cursor.execute("""
        SELECT id, url, events, secret FROM webhooks
        WHERE is_active = 1
          AND (project_id IS NULL OR project_id = ?)
    """, (project_id,))

    rows = cursor.fetchall()
    conn.close()

    for row in rows:
        webhook_id = row["id"]
        url = row["url"]
        events: List[str] = json.loads(row["events"])
        secret = row["secret"]

        if event_type not in events:
            continue

        # 异步投递（不阻塞主流程）
        def _deliver():
            success = deliver_webhook(webhook_id, url, event_type, payload, secret)
            if not success:
                schedule_retry(webhook_id, url, event_type, payload, secret, attempt=1)

        t = threading.Thread(target=_deliver, daemon=True)
        t.start()
