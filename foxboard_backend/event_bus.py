"""
EventBus - 统一事件总线
所有任务状态变更、Agent 动态、项目更新都通过 EventBus 分发，
统一驱动 task_logs 写入、WebSocket 广播、activity 记录。
"""
from __future__ import annotations

import asyncio
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from .database import get_conn


def _run_async_broadcast(coro):
    """
    在独立线程的新事件循环中运行异步协程。
    解决 sync 上下文中调用 asyncio 协程的问题。
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


# ---- 事件类型常量 ----
class EventType:
    # Task lifecycle
    TASK_CREATED = "task_created"
    TASK_UPDATED = "task_updated"
    TASK_CLAIMED = "task_claimed"
    TASK_SUBMITTED = "task_submitted"
    TASK_REVIEW_PASSED = "task_review_passed"
    TASK_REVIEW_FAILED = "task_review_failed"
    TASK_BLOCKED = "task_blocked"
    TASK_ACTIVATED = "task_activated"
    TASK_TIMEOUT = "task_timeout"
    TASK_DELETED = "task_deleted"

    # Project
    PROJECT_CREATED = "project_created"
    PROJECT_UPDATED = "project_updated"

    # Agent
    AGENT_REGISTERED = "agent_registered"
    AGENT_HEARTBEAT = "agent_heartbeat"
    AGENT_STATUS_CHANGED = "agent_status_changed"

    # Dependency
    DEPENDENCY_ACTIVATED = "dependency_activated"


# ---- EventBus ----
class EventBus:
    """
    统一事件总线（单例）。
    
    使用方式：
        from foxboard_backend.event_bus import event_bus
        event_bus.emit("task_claimed", task_id="FB-038", actor_id="qing_fox",
                       payload={"from_status": "TODO", "to_status": "DOING"})
    
    emit() 内部自动完成三件事：
        1. 写入 task_logs / events 表（同步）
        2. WebSocket 广播（异步）
        3. 返回构造好的事件对象
    """

    _instance: Optional["EventBus"] = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    instance = super().__new__(cls)
                    instance._render_callback = None
                    cls._instance = instance
        return cls._instance

    def _now_iso(self) -> str:
        return datetime.utcnow().isoformat()

    def _write_to_db(self, event_type: str, project_id: Optional[str],
                     task_id: Optional[str], actor_id: Optional[str],
                     payload: Dict[str, Any]) -> int:
        """
        将事件写入 task_logs 表。
        返回新记录 id。
        """
        conn = get_conn()
        cursor = conn.cursor()
        now = self._now_iso()
        message = payload.get("message", f"事件: {event_type}")
        cursor.execute("""
            INSERT INTO task_logs (task_id, agent_id, event_type, message, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (task_id, actor_id, event_type, message, now))
        conn.commit()
        record_id = cursor.lastrowid
        conn.close()
        return record_id

    async def _broadcast_ws(self, event: Dict[str, Any]):
        """通过 WebSocket 广播事件"""
        try:
            # 延迟导入避免循环依赖
            from .websocket_manager import ws_manager
            await ws_manager.broadcast(event)
        except Exception as e:
            print(f"[EventBus] WebSocket 广播失败: {e}")

    def _broadcast_ws_sync(self, event: Dict[str, Any]):
        """同步版 WebSocket 广播（在 sync route handler 中调用）"""
        _run_async_broadcast(self._broadcast_ws(event))

    def emit(self, event_type: str,
             project_id: Optional[str] = None,
             task_id: Optional[str] = None,
             actor_id: Optional[str] = None,
             payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        发送事件的统一入口。
        
        Args:
            event_type: 事件类型字符串
            project_id: 所属项目 ID
            task_id: 关联任务 ID
            actor_id: 触发该事件的 agent ID
            payload: 事件附加数据
        
        Returns:
            构造好的事件对象字典（含 timestamp）
        """
        payload = payload or {}
        now = self._now_iso()

        # 构造统一事件对象
        event = {
            "event_type": event_type,
            "project_id": project_id,
            "task_id": task_id,
            "actor_id": actor_id,
            "timestamp": now,
            "payload": payload,
        }

        # 1. 写入数据库
        record_id = self._write_to_db(event_type, project_id, task_id, actor_id, payload)
        event["_db_id"] = record_id

        # 2. WebSocket 广播
        self._broadcast_ws_sync(event)

        # 3. Board 渲染回调（如果注册了的话）
        self._trigger_render(event)

        # 4. 返回事件对象（供调用方使用）
        return event

    def _trigger_render(self, event: Dict[str, Any]):
        """触发 Board 渲染（如果设置了 render_callback）"""
        if self._render_callback and event.get("project_id"):
            try:
                pid = event["project_id"]
                from .board_renderer import render_project
                board_path = self._get_board_path(pid)
                if board_path:
                    render_project(pid, board_path)
                    print("[EventBus] Board 渲染已触发: %s" % pid)
            except Exception as e:
                print("[EventBus] Board 渲染失败: %s" % e)

    def _get_board_path(self, project_id: str):
        """根据项目 ID 推断看板路径"""
        # 优先从环境变量
        env_path = os.environ.get("FOXBOARD_BOARD_PATH")
        if env_path:
            p = Path(env_path)
            if p.is_dir():
                return p
        # 默认推断
        default = (
            Path.home()
            / ".openclaw"
            / "workspace"
            / "qinghu"
            / "projects"
            / project_id
        )
        if default.exists():
            return default
        return None

    def set_render_callback(self, callback):
        """
        设置 Board 渲染回调。
        回调签名：callback(project_id: str, board_path: Path)
        """
        self._render_callback = callback

    # ---- 便捷快捷方法 ----

    def task_created(self, task_id: str, project_id: Optional[str], actor_id: str,
                     task_data: Dict[str, Any]) -> Dict[str, Any]:
        """任务创建事件"""
        return self.emit(
            EventType.TASK_CREATED,
            project_id=project_id,
            task_id=task_id,
            actor_id=actor_id,
            payload={"message": f"任务「{task_data.get('title', task_id)}」被创建",
                     "task_data": task_data},
        )

    def task_claimed(self, task_id: str, project_id: Optional[str], actor_id: str) -> Dict[str, Any]:
        """任务领取事件"""
        return self.emit(
            EventType.TASK_CLAIMED,
            project_id=project_id,
            task_id=task_id,
            actor_id=actor_id,
            payload={"message": f"任务被 {actor_id} 领取", "to_status": "DOING"},
        )

    def task_submitted(self, task_id: str, project_id: Optional[str], actor_id: str,
                       message: Optional[str] = None) -> Dict[str, Any]:
        """任务提交审核事件"""
        return self.emit(
            EventType.TASK_SUBMITTED,
            project_id=project_id,
            task_id=task_id,
            actor_id=actor_id,
            payload={"message": message or f"任务被 {actor_id} 提交审核", "to_status": "REVIEW"},
        )

    def task_review_passed(self, task_id: str, project_id: Optional[str],
                           auditor_id: str) -> Dict[str, Any]:
        """审核通过事件"""
        return self.emit(
            EventType.TASK_REVIEW_PASSED,
            project_id=project_id,
            task_id=task_id,
            actor_id=auditor_id,
            payload={"message": "审核通过，任务完成", "to_status": "DONE"},
        )

    def task_review_failed(self, task_id: str, project_id: Optional[str],
                           auditor_id: str, reason: str) -> Dict[str, Any]:
        """审核打回事件"""
        return self.emit(
            EventType.TASK_REVIEW_FAILED,
            project_id=project_id,
            task_id=task_id,
            actor_id=auditor_id,
            payload={"message": f"审核打回，原因：{reason}", "to_status": "DOING"},
        )

    def task_blocked(self, task_id: str, project_id: Optional[str],
                     actor_id: str, reason: str) -> Dict[str, Any]:
        """任务阻塞事件"""
        return self.emit(
            EventType.TASK_BLOCKED,
            project_id=project_id,
            task_id=task_id,
            actor_id=actor_id,
            payload={"message": f"任务被阻塞：{reason}", "to_status": "BLOCKED"},
        )

    def task_activated(self, task_id: str, project_id: Optional[str],
                       activated_by: str, reason: str) -> Dict[str, Any]:
        """依赖激活事件"""
        return self.emit(
            EventType.TASK_ACTIVATED,
            project_id=project_id,
            task_id=task_id,
            actor_id="system",
            payload={"message": reason, "to_status": "TODO"},
        )

    def task_timeout(self, task_id: str, project_id: Optional[str],
                     threshold_hours: float) -> Dict[str, Any]:
        """任务超时事件"""
        return self.emit(
            EventType.TASK_TIMEOUT,
            project_id=project_id,
            task_id=task_id,
            actor_id="system",
            payload={"message": f"任务超时（>{threshold_hours}h）"},
        )

    def task_deleted(self, task_id: str, project_id: Optional[str],
                     actor_id: str) -> Dict[str, Any]:
        """任务删除事件"""
        return self.emit(
            EventType.TASK_DELETED,
            project_id=project_id,
            task_id=task_id,
            actor_id=actor_id,
            payload={"message": f"任务被 {actor_id} 删除"},
        )

    def task_updated(self, task_id: str, project_id: Optional[str],
                     actor_id: str, changes: Dict[str, Any]) -> Dict[str, Any]:
        """任务更新事件"""
        return self.emit(
            EventType.TASK_UPDATED,
            project_id=project_id,
            task_id=task_id,
            actor_id=actor_id,
            payload={"message": f"任务被 {actor_id} 更新", "changes": changes},
        )

    def project_created(self, project_id: str, actor_id: str,
                        project_data: Dict[str, Any]) -> Dict[str, Any]:
        """项目创建事件"""
        return self.emit(
            EventType.PROJECT_CREATED,
            project_id=project_id,
            actor_id=actor_id,
            payload={"message": f"项目「{project_data.get('name', project_id)}」被创建",
                     "project_data": project_data},
        )

    def project_updated(self, project_id: str, actor_id: str,
                        changes: Dict[str, Any]) -> Dict[str, Any]:
        """项目更新事件"""
        return self.emit(
            EventType.PROJECT_UPDATED,
            project_id=project_id,
            task_id=None,
            actor_id=actor_id,
            payload={"message": f"项目被 {actor_id} 更新", "changes": changes},
        )

    def agent_registered(self, agent_id: str, agent_data: Dict[str, Any]) -> Dict[str, Any]:
        """Agent 注册事件"""
        return self.emit(
            EventType.AGENT_REGISTERED,
            actor_id=agent_id,
            payload={"message": f"Agent「{agent_data.get('name', agent_id)}」注册",
                     "agent_data": agent_data},
        )

    def agent_heartbeat(self, agent_id: str, status: str,
                        extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Agent 心跳事件"""
        return self.emit(
            EventType.AGENT_HEARTBEAT,
            actor_id=agent_id,
            payload={"message": f"Agent {agent_id} 心跳", "status": status, "extra": extra or {}},
        )


# 全局单例
event_bus = EventBus()
