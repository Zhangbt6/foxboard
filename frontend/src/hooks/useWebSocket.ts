/**
 * useWebSocket.ts
 * WebSocket 前端 hook：连接管理、自动重连、状态指示
 */
import { useEffect, useRef, useCallback, useState } from 'react';

export type WSStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface WSEvent {
  event: string;
  [key: string]: unknown;
}

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000]; // 重连延迟序列

export interface UseWebSocketOptions {
  url?: string;
  /** 收到消息回调 */
  onMessage?: (event: WSEvent) => void;
  /** 连接状态变化回调 */
  onStatusChange?: (status: WSStatus) => void;
  /** 最大重连次数（0=不重连） */
  maxReconnects?: number;
  /** 心跳间隔（毫秒），默认 25000 */
  pingInterval?: number;
}

export interface UseWebSocketReturn {
  status: WSStatus;
  lastMessage: WSEvent | null;
  send: (data: unknown) => void;
  connect: () => void;
  disconnect: () => void;
}

/**
 * useWebSocket — React hook for WebSocket connection with auto-reconnect.
 */
export function useWebSocket({
  url,
  onMessage,
  onStatusChange,
  maxReconnects = 10,
  pingInterval = 25000,
}: UseWebSocketOptions): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualCloseRef = useRef(false);

  const [status, _setStatus] = useState<WSStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<WSEvent | null>(null);

  const setStatus = useCallback((s: WSStatus) => {
    _setStatus(s);
    onStatusChange?.(s);
  }, [onStatusChange]);

  const clearPing = useCallback(() => {
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }, []);

  const clearReconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const startPing = useCallback(() => {
    clearPing();
    pingTimerRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ event: 'ping' }));
      }
    }, pingInterval);
  }, [clearPing, pingInterval]);

  const scheduleReconnect = useCallback(() => {
    if (manualCloseRef.current) return;
    if (reconnectAttemptRef.current >= maxReconnects) {
      setStatus('disconnected');
      return;
    }
    const delay = RECONNECT_DELAYS[Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS.length - 1)];
    setStatus('reconnecting');
    reconnectTimerRef.current = setTimeout(() => {
      reconnectAttemptRef.current++;
      connect();
    }, delay);
  }, [maxReconnects, setStatus]);

  const connect = useCallback(() => {
    const wsUrl = url ?? `ws://${window.location.host}/ws`;
    manualCloseRef.current = false;
    setStatus('connecting');

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        setStatus('connected');
        startPing();
      };

      ws.onmessage = (ev) => {
        try {
          const data: WSEvent = JSON.parse(ev.data);
          setLastMessage(data);
          onMessage?.(data);
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        // onclose will follow
      };

      ws.onclose = () => {
        clearPing();
        wsRef.current = null;
        if (!manualCloseRef.current) {
          scheduleReconnect();
        }
      };
    } catch {
      scheduleReconnect();
    }
  }, [url, setStatus, startPing, clearPing, scheduleReconnect]);

  const disconnect = useCallback(() => {
    manualCloseRef.current = true;
    clearPing();
    clearReconnect();
    reconnectAttemptRef.current = maxReconnects; // 防止自动重连
    wsRef.current?.close();
    setStatus('disconnected');
  }, [clearPing, clearReconnect, maxReconnects, setStatus]);

  const send = useCallback((data: unknown) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      manualCloseRef.current = true;
      clearPing();
      clearReconnect();
      wsRef.current?.close();
    };
  }, [connect, clearPing, clearReconnect]);

  return { status, lastMessage, send, connect, disconnect };
}
