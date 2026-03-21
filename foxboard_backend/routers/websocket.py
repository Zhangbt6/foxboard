"""
WebSocket 路由 - /ws
提供实时推送端点：连接管理、心跳保活、事件广播
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from ..websocket_manager import ws_manager, WSEventType

router = APIRouter(tags=["websocket"])

# 心跳间隔（秒）
PING_INTERVAL = 30
# 客户端超时（秒），超过此时间无 pong 则断开
PONG_TIMEOUT = 10


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket 端点。

    客户端连接流程：
    1. 客户端连接 /ws，成功后收到 {"event": "connected", "connection_id": "..."}
    2. 客户端定期发送 ping 保持连接（建议每 25s 一次）
    3. 服务器推送事件：task_update / agent_heartbeat / activity_log
    4. 客户端发送 {"event": "ping"} → 服务器回复 {"event": "pong"}

    事件格式：
    - task_update: {task_id, action, data, timestamp}
    - agent_heartbeat: {agent_id, status, extra, timestamp}
    - activity_log: {agent_id, message, metadata, timestamp}
    """
    conn_id = await ws_manager.connect(websocket)
    last_pong = datetime.utcnow()

    try:
        # 监听客户端消息
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "event": "error",
                    "message": "Invalid JSON",
                    "timestamp": datetime.utcnow().isoformat(),
                }))
                continue

            event = msg.get("event", "")

            if event == WSEventType.PING:
                last_pong = datetime.utcnow()
                await websocket.send_text(json.dumps({
                    "event": WSEventType.PONG,
                    "timestamp": datetime.utcnow().isoformat(),
                }))

            elif event == "pong":
                last_pong = datetime.utcnow()

            elif event == "ping_server":
                # 客户端请求服务器主动 ping（用于超时检测）
                await websocket.send_text(json.dumps({
                    "event": "pong",
                    "timestamp": datetime.utcnow().isoformat(),
                }))

            else:
                # 忽略未知消息，不断开连接
                pass

            # 检查 pong 超时
            elapsed = (datetime.utcnow() - last_pong).total_seconds()
            if elapsed > PING_INTERVAL + PONG_TIMEOUT:
                await websocket.send_text(json.dumps({
                    "event": "timeout",
                    "message": "No pong received, closing connection",
                    "timestamp": datetime.utcnow().isoformat(),
                }))
                break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        # 其他异常，记录后断开
        print(f"[WS] 异常: {e}")
    finally:
        await ws_manager.disconnect(websocket)
