"""
WebSocket 连接管理器
负责维护所有 WebSocket 连接、广播事件、心跳保活
"""
from __future__ import annotations

import json
import threading
from typing import Dict, Optional
from datetime import datetime
from fastapi import WebSocket
import logging

logger = logging.getLogger("ws")

# ---- WebSocket 事件类型 ----
class WSEventType:
    TASK_UPDATE = "task_update"
    AGENT_HEARTBEAT = "agent_heartbeat"
    ACTIVITY_LOG = "activity_log"
    CONNECTED = "connected"
    PING = "ping"
    PONG = "pong"


class ConnectionManager:
    """
    全局 WebSocket 连接管理器（单例）。
    所有连接存储在 _connections: Dict[connection_id, WebSocket]。
    """
    _instance: Optional["ConnectionManager"] = None
    _init_lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._init_lock:
                if cls._instance is None:
                    instance = super().__new__(cls)
                    instance._connections: Dict[str, WebSocket] = {}
                    instance._connection_ids: Dict[int, str] = {}  # id(websocket) -> conn_id
                    instance._lock = threading.Lock()
                    cls._instance = instance
        return cls._instance

    async def connect(self, websocket: WebSocket, connection_id: Optional[str] = None) -> str:
        """接受 WebSocket 连接并注册"""
        await websocket.accept()
        if connection_id is None:
            connection_id = f"conn_{id(websocket)}_{datetime.utcnow().timestamp()}"
        with self._lock:
            self._connections[connection_id] = websocket
            self._connection_ids[id(websocket)] = connection_id
        logger.info(f"[WS] 连接建立: {connection_id}, 总连接数: {len(self._connections)}")
        await self.broadcast({
            "event": WSEventType.CONNECTED,
            "connection_id": connection_id,
            "timestamp": datetime.utcnow().isoformat(),
        })
        return connection_id

    async def disconnect(self, websocket: WebSocket):
        """主动断开连接"""
        ws_id = id(websocket)
        with self._lock:
            connection_id = self._connection_ids.pop(ws_id, None)
            if connection_id:
                self._connections.pop(connection_id, None)
        if connection_id:
            logger.info(f"[WS] 连接断开: {connection_id}, 剩余: {len(self._connections)}")

    def get_connection_id(self, websocket: WebSocket) -> Optional[str]:
        return self._connection_ids.get(id(websocket))

    @property
    def connections(self) -> Dict[str, WebSocket]:
        return self._connections

    async def broadcast(self, message: dict, exclude: Optional[str] = None):
        """
        广播消息给所有已连接客户端。
        message: dict，会被 JSON 序列化后发送
        exclude: 可选，要排除的 connection_id
        """
        if not self._connections:
            return
        dead = []
        payload = json.dumps(message, ensure_ascii=False)
        with self._lock:
            items = list(self._connections.items())
        for conn_id, ws in items:
            if conn_id == exclude:
                continue
            try:
                await ws.send_text(payload)
            except Exception as e:
                logger.warning(f"[WS] 发送失败 {conn_id}: {e}")
                dead.append(conn_id)
        # 清理失效连接
        for conn_id in dead:
            with self._lock:
                ws = self._connections.pop(conn_id, None)
                if ws:
                    self._connection_ids.pop(id(ws), None)

    async def send_to(self, connection_id: str, message: dict):
        """向指定连接发送消息"""
        with self._lock:
            ws = self._connections.get(connection_id)
        if ws is None:
            logger.warning(f"[WS] 连接不存在: {connection_id}")
            return
        try:
            await ws.send_text(json.dumps(message, ensure_ascii=False))
        except Exception as e:
            logger.warning(f"[WS] 发送失败 {connection_id}: {e}")

    # ---- 事件广播便捷方法 ----

    async def broadcast_task_update(self, task_id: str, action: str, task_data: dict):
        """
        广播任务状态变更。
        action: created / updated / status_changed / deleted
        """
        await self.broadcast({
            "event": WSEventType.TASK_UPDATE,
            "task_id": task_id,
            "action": action,
            "data": task_data,
            "timestamp": datetime.utcnow().isoformat(),
        })

    async def broadcast_agent_heartbeat(self, agent_id: str, status: str, extra: Optional[dict] = None):
        """广播 Agent 心跳"""
        await self.broadcast({
            "event": WSEventType.AGENT_HEARTBEAT,
            "agent_id": agent_id,
            "status": status,
            "extra": extra or {},
            "timestamp": datetime.utcnow().isoformat(),
        })

    async def broadcast_activity_log(self, agent_id: Optional[str], message: str, metadata: Optional[str] = None):
        """广播活动日志"""
        await self.broadcast({
            "event": WSEventType.ACTIVITY_LOG,
            "agent_id": agent_id,
            "message": message,
            "metadata": metadata,
            "timestamp": datetime.utcnow().isoformat(),
        })


# 全局单例
ws_manager = ConnectionManager()
