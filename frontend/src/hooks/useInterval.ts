import { useEffect, useRef } from 'react';

/**
 * useInterval — 简单的定时轮询 hook
 * @param callback 要执行的函数
 * @param delay 轮询间隔（毫秒），传入 null 停止
 */
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  // 保持最新 callback 引用
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
