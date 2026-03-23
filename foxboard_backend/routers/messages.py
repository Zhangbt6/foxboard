"""
消息路由 - Agent 间通信
替代 FoxComms sessions_send + COMMS.md 双轨
所有通信走数据库，可查可追溯
发消息时自动推送：飞书通知 + 触发对方 cron

通知路由引擎 (NotificationRouter):
- 动态加载 Agent 名称和 Cron Job ID（从数据库）
- 支持通知路由规则配置
- 失败重试机制（指数退避）
- 任务事件自动通知相关人（通过 EventBus）
"""
from __future__ import annotations

import os
import subprocess
import threading
import time
import json
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from datetime import datetime

from ..database import get_conn
from ..models import MessageSend, Message, MessagePriority

router = APIRouter(prefix="/messages", tags=["messages"])

# ---- 通知路由引擎 ----

# 环境检测：TESTING=1 或 PYTEST_CURRENT_TEST 存在时禁用推送
def _is_test_env() -> bool:
    return bool(os.environ.get("TESTING") or os.environ.get("PYTEST_CURRENT_TEST"))

# OpenClaw CLI 路径
OPENCLAW_BIN = os.environ.get("OPENCLAW_BIN", "/home/muyin/.npm-global/bin/openclaw")
# 飞书群 ID
FEISHU_GROUP_ID = os.environ.get("FOXBOARD_FEISHU_GROUP", "oc_631ca66841ec4a2bf18e0853c4a9b0f8")

# 静态兜底映射（数据库无法查到时使用）
_FALLBACK_CRON_MAP = {
    "black_fox": "a1f497c3-b87d-4bb1-82e7-86e6b138270a",
    "qing_fox": "93c1d29a-fabb-4115-9ac0-f13246ae96fc",
    "white_fox": "4ab87156-2d91-4179-a9d6-666bf36a4758",
    "fox_leader": "cee8d7ff-937a-4212-8092-da64965e48d6",
}
_FALLBACK_AGENT_NAMES = {
    "black_fox": "黑狐",
    "qing_fox": "青狐",
    "white_fox": "白狐",
    "fox_leader": "花火",
}

# 通知路由规则（内存缓存 + 数据库持久化）
# rule格式: {event_type: {agent_id: {priority, channels: [...]}}}
_notification_rules: Dict[str, Dict[str, Dict[str, Any]]] = {}
_rules_loaded = False
_rules_lock = threading.Lock()


def load_notification_rules() -> None:
    """从数据库加载通知路由规则到内存"""
    global _notification_rules, _rules_loaded
    if _rules_loaded:
        return
    with _rules_lock:
        if _rules_loaded:
            return
        try:
            conn = get_conn()
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='notification_rules'")
            if not cursor.fetchone():
                conn.close()
                _rules_loaded = True
                return
            cursor.execute("SELECT event_type, agent_id, priority, channels, enabled FROM notification_rules")
            rules = {}
            for row in cursor.fetchall():
                evt, agent, priority, channels_json, enabled = row
                if enabled != 1:
                    continue
                rules.setdefault(evt, {})[agent] = {
                    "priority": priority,
                    "channels": json.loads(channels_json) if channels_json else ["feishu"],
                }
            _notification_rules = rules
            conn.close()
            print(f"[NotifyRouter] 已加载 {sum(len(v) for v in rules.values())} 条路由规则")
        except Exception as e:
            print(f"[NotifyRouter] 规则加载失败，使用空规则集: {e}")
        finally:
            _rules_loaded = True


def get_agent_name(agent_id: str) -> str:
    """动态获取 Agent 显示名（数据库优先，回退到静态映射）"""
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM agents WHERE id = ?", (agent_id,))
        row = cursor.fetchone()
        conn.close()
        if row and row["name"]:
            return row["name"]
    except Exception:
        pass
    return _FALLBACK_AGENT_NAMES.get(agent_id, agent_id)


def get_agent_cron_job_id(agent_id: str) -> Optional[str]:
    """动态获取 Agent 的 Cron Job ID（数据库优先）"""
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT cron_job_id FROM agents WHERE id = ?", (agent_id,))
        row = cursor.fetchone()
        conn.close()
        if row and row["cron_job_id"]:
            return row["cron_job_id"]
    except Exception:
        pass
    return _FALLBACK_CRON_MAP.get(agent_id)


def get_agent_names_from_db() -> Dict[str, str]:
    """批量获取所有 Agent 显示名"""
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name FROM agents")
        result = {row["id"]: row["name"] for row in cursor.fetchall()}
        conn.close()
        return result
    except Exception:
        return _FALLBACK_AGENT_NAMES.copy()


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


# ---- 通知重试队列 ----
_RETRY_QUEUE: List[Dict[str, Any]] = []
_RETRY_LOCK = threading.Lock()
_RETRY_MAX_ATTEMPTS = 3


def _log_delivery(message_id: int, channel: str, status: str, error: str = None):
    """记录通知投递日志到数据库"""
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notification_delivery_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id INTEGER,
                channel TEXT NOT NULL,
                status TEXT NOT NULL,
                error TEXT,
                attempt INTEGER DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        cursor.execute(
            "INSERT INTO notification_delivery_log (message_id, channel, status, error) VALUES (?, ?, ?, ?)",
            (message_id, channel, status, error)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[NotifyRouter] 投递日志记录失败: {e}")


def _notify_feishu_with_retry(from_agent: str, to_agent: str, body: str,
                               subject: str = None, ref_task_id: str = None,
                               message_id: int = None, attempt: int = 1):
    """带重试的飞书通知推送"""
    if _is_test_env():
        return True

    try:
        from_name = get_agent_name(from_agent)
        to_name = get_agent_name(to_agent)
        parts = [f"📨 {from_name} → {to_name}"]
        if subject:
            parts.append(f"【{subject}】")
        if ref_task_id:
            parts.append(f"[{ref_task_id}]")
        parts.append(body)
        text = " ".join(parts)
        if len(text) > 500:
            text = text[:497] + "..."

        cron_job_id = get_agent_cron_job_id(from_agent)
        cmd = [OPENCLAW_BIN, "message", "send",
               "--channel", "feishu",
               "-t", FEISHU_GROUP_ID,
               "-m", text]
        if cron_job_id:
            cmd.extend(["--account", from_agent])

        result = subprocess.run(cmd, capture_output=True, timeout=15, text=True)
        if result.returncode != 0:
            error_msg = result.stderr[:200] if result.stderr else "unknown"
            print(f"[Messages] 飞书通知失败(rc={result.returncode}): {error_msg}")
            if message_id is not None:
                _log_delivery(message_id, "feishu", "failed", error_msg)
            # 加入重试队列
            if attempt < _RETRY_MAX_ATTEMPTS:
                with _RETRY_LOCK:
                    _RETRY_QUEUE.append({
                        "from_agent": from_agent,
                        "to_agent": to_agent,
                        "body": body,
                        "subject": subject,
                        "ref_task_id": ref_task_id,
                        "message_id": message_id,
                        "attempt": attempt + 1,
                        "next_retry_at": time.time() + (2 ** attempt),
                    })
            return False
        else:
            print(f"[Messages] 飞书通知已发送: {from_name}→{to_name}")
            if message_id is not None:
                _log_delivery(message_id, "feishu", "sent", None)
            return True
    except Exception as e:
        print(f"[Messages] 飞书通知异常: {e}")
        if message_id is not None:
            _log_delivery(message_id, "feishu", "error", str(e))
        return False


def _process_retry_queue():
    """处理通知重试队列（由后台线程定期调用）"""
    now = time.time()
    with _RETRY_LOCK:
        pending = [item for item in _RETRY_QUEUE if item["next_retry_at"] <= now]
        for item in pending:
            _RETRY_QUEUE.remove(item)
    for item in pending:
        print(f"[NotifyRouter] 重试发送通知 (第{item['attempt']}次): {item['to_agent']}")
        _notify_feishu_with_retry(**item)


def _notify_feishu(from_agent: str, to_agent: str, body: str,
                   subject: str = None, ref_task_id: str = None,
                   message_id: int = None):
    """异步推送飞书通知（测试环境下跳过）"""
    if _is_test_env():
        return
    t = threading.Thread(
        target=_notify_feishu_with_retry,
        args=(from_agent, to_agent, body, subject, ref_task_id, message_id, 1),
        daemon=True
    )
    t.start()


def _trigger_cron(to_agent: str):
    """异步触发对方 cron job（测试环境下跳过）"""
    if _is_test_env():
        return
    job_id = get_agent_cron_job_id(to_agent)
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


# ---- 任务事件 → 自动通知 ----

def _on_task_event(event: Dict[str, Any]):
    """
    处理任务事件，自动通知相关人。
    由 EventBus 在任务生命周期事件触发时调用。
    """
    if _is_test_env():
        return
    event_type = event.get("event_type", "")
    task_id = event.get("task_id")
    actor_id = event.get("actor_id", "")
    payload = event.get("payload", {})

    # 只处理任务相关事件
    task_events = {
        "task_claimed", "task_submitted", "task_review_passed",
        "task_review_failed", "task_updated", "task_blocked",
        "task_activated", "task_timeout",
    }
    if event_type not in task_events or not task_id:
        return

    # 加载路由规则
    load_notification_rules()

    # 获取任务信息，确定通知谁
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return
    except Exception as e:
        print(f"[NotifyRouter] 获取任务信息失败: {e}")
        return

    assignee_id = row["assignee_id"]
    project_id = row["project_id"]

    # 根据事件类型确定通知策略
    notifications = []

    if event_type == "task_claimed":
        # 任务被领取 → 通知任务创建者/负责人（除执行人外）
        # 如果有 assignee 字段变更，通知原 assignee
        pass

    elif event_type == "task_submitted":
        # 任务提交审核 → 通知黑狐（审核人）
        if assignee_id and assignee_id != actor_id:
            notifications.append({
                "from_agent": actor_id,
                "to_agent": "black_fox",
                "priority": "high",
                "subject": "任务提交审核",
                "body": f"【{task_id}】已提交审核，等待审核。",
            })
        else:
            notifications.append({
                "from_agent": actor_id,
                "to_agent": "black_fox",
                "priority": "high",
                "subject": "任务提交审核",
                "body": f"【{task_id}】已提交审核，等待审核。",
            })

    elif event_type == "task_review_passed":
        # 审核通过 → 通知任务执行人
        if assignee_id and assignee_id != actor_id:
            notifications.append({
                "from_agent": "black_fox",
                "to_agent": assignee_id,
                "priority": "normal",
                "subject": "审核通过",
                "body": f"【{task_id}】审核通过 ✅",
            })

    elif event_type == "task_review_failed":
        # 审核打回 → 通知任务执行人
        reason = payload.get("reason", "")
        if assignee_id and assignee_id != actor_id:
            notifications.append({
                "from_agent": "black_fox",
                "to_agent": assignee_id,
                "priority": "high",
                "subject": "审核打回",
                "body": f"【{task_id}】审核打回 ❌ 原因：{reason}",
            })

    elif event_type == "task_timeout":
        # 任务超时 → 通知执行人和花火
        msg = payload.get("message", f"任务 {task_id} 超时")
        if assignee_id:
            notifications.append({
                "from_agent": "system",
                "to_agent": assignee_id,
                "priority": "high",
                "subject": "任务超时",
                "body": f"【{task_id}】{msg}",
            })
        notifications.append({
            "from_agent": "system",
            "to_agent": "fox_leader",
            "priority": "high",
            "subject": "任务超时",
            "body": f"【{task_id}】{msg}",
        })

    # 发送通知
    for notif in notifications:
        try:
            _send_message_direct(
                from_agent=notif["from_agent"],
                to_agent=notif["to_agent"],
                body=notif["body"],
                subject=notif.get("subject"),
                priority=notif.get("priority", "normal"),
                ref_task_id=task_id,
                ref_project_id=project_id,
                auto_notify=True,
            )
        except Exception as e:
            print(f"[NotifyRouter] 自动通知失败: {e}")


def _send_message_direct(from_agent: str, to_agent: str, body: str,
                         subject: str = None, priority: str = "normal",
                         ref_task_id: str = None, ref_project_id: str = None,
                         auto_notify: bool = False) -> int:
    """
    内部方法：直接写数据库并触发通知，不走 API 路由。
    返回 message_id。
    """
    conn = get_conn()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute("""
        INSERT INTO messages (from_agent, to_agent, subject, body, priority,
                              ref_task_id, ref_project_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (from_agent, to_agent, subject, body, priority, ref_task_id, ref_project_id, now))
    conn.commit()
    msg_id = cursor.lastrowid
    conn.close()

    if auto_notify:
        _notify_feishu(from_agent, to_agent, body, subject, ref_task_id, msg_id)
        if priority in ("urgent", "high"):
            _trigger_cron(to_agent)

    return msg_id


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
                       payload.subject, payload.ref_task_id, msg_id)
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


# ---- 通知路由规则 API ----

def migrate_add_notification_rules():
    """迁移：新增 notification_rules 表（幂等）"""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS notification_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            agent_id TEXT NOT NULL,
            priority TEXT NOT NULL DEFAULT 'normal',
            channels TEXT NOT NULL DEFAULT '["feishu"]',
            enabled INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(event_type, agent_id)
        )
    """)
    # 插入默认规则（如果不存在）
    default_rules = [
        ("task_submitted", "black_fox", "high", '["feishu"]'),
        ("task_review_passed", None, "normal", '["feishu"]'),
        ("task_review_failed", None, "high", '["feishu"]'),
        ("task_timeout", None, "high", '["feishu"]'),
        ("task_timeout", "fox_leader", "high", '["feishu"]'),
    ]
    for event_type, agent_id, priority, channels in default_rules:
        if agent_id:
            cursor.execute("""
                INSERT OR IGNORE INTO notification_rules (event_type, agent_id, priority, channels)
                VALUES (?, ?, ?, ?)
            """, (event_type, agent_id, priority, channels))
        else:
            # None agent_id means "notify task assignee"
            cursor.execute("""
                INSERT OR IGNORE INTO notification_rules (event_type, agent_id, priority, channels)
                VALUES (?, ?, ?, ?)
            """, (event_type, "__assignee__", priority, channels))
    conn.commit()
    conn.close()


def _init_notify_router():
    """初始化通知路由引擎（模块加载时调用）"""
    migrate_add_notification_rules()
    load_notification_rules()
    # 注册 EventBus 监听器
    try:
        from ..event_bus import event_bus
        event_bus.listen(_on_task_event)
        print("[NotifyRouter] EventBus 监听器已注册")
    except Exception as e:
        print(f"[NotifyRouter] EventBus 监听器注册失败: {e}")

# 模块加载时自动初始化
_init_notify_router()
