import { useEffect, useRef } from 'react';
import { installFetchInterceptor } from './OfficeAdapter';

declare global {
  interface Window {
    __FOXBOARD_PIXEL_OFFICE_INIT?: () => Promise<unknown> | unknown;
    __FOXBOARD_PIXEL_OFFICE_DESTROY?: () => void;
    __FOXBOARD_PIXEL_OFFICE_MANUAL_BOOT__?: boolean;
    __FOXBOARD_SCRIPT_PROMISES__?: Partial<Record<string, Promise<void>>>;
  }
}

function loadScriptOnce(key: string, src: string): Promise<void> {
  if (!window.__FOXBOARD_SCRIPT_PROMISES__) {
    window.__FOXBOARD_SCRIPT_PROMISES__ = {};
  }
  if (window.__FOXBOARD_SCRIPT_PROMISES__[key]) {
    return window.__FOXBOARD_SCRIPT_PROMISES__[key];
  }

  window.__FOXBOARD_SCRIPT_PROMISES__[key] = new Promise<void>((resolve, reject) => {
    const attr = `data-foxboard-script="${key}"`;
    const existing = document.querySelector<HTMLScriptElement>(`script[${attr}]`);

    if (existing) {
      if (existing.dataset.loaded === '1') {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Load failed: ${src}`)), { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.setAttribute('data-foxboard-script', key);
    script.addEventListener('load', () => {
      script.dataset.loaded = '1';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Load failed: ${src}`)), { once: true });
    document.body.appendChild(script);
  });

  return window.__FOXBOARD_SCRIPT_PROMISES__[key];
}

/**
 * PixelOffice - 像素办公室游戏组件
 * 将 game.js 直接嵌入 React，去掉 iframe
 */
export default function PixelOffice() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    window.__FOXBOARD_PIXEL_OFFICE_MANUAL_BOOT__ = true;

    const boot = async () => {
      // 1. 安装 FoxBoard API 拦截器（让 game.js 的 /status 和 /agents 请求指向 FoxBoard 后端）
      installFetchInterceptor();

      // 2. 只加载一次脚本，避免路由切回时重复执行 game.js 导致全局变量冲突
      await loadScriptOnce('layout', '/layout.js');
      await loadScriptOnce('phaser', 'https://cdnjs.cloudflare.com/ajax/libs/phaser/3.60.0/phaser.min.js');
      await loadScriptOnce('game', '/game.js?v=11');

      if (cancelled) return;

      // 3. 每次进入页面都显式初始化；离开页面由 cleanup 销毁
      if (window.__FOXBOARD_PIXEL_OFFICE_INIT) {
        await window.__FOXBOARD_PIXEL_OFFICE_INIT();
      }
    };

    void boot().catch((err) => {
      console.error('[PixelOffice] boot failed:', err);
    });

    return () => {
      cancelled = true;
      if (window.__FOXBOARD_PIXEL_OFFICE_DESTROY) {
        window.__FOXBOARD_PIXEL_OFFICE_DESTROY();
      }
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0a14' }}>
      {/* 页面头部 */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--foxboard-border)',
        background: 'var(--foxboard-surface)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
      }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>🦊 像素办公室</h1>
        <div style={{
          fontSize: 11,
          background: 'rgba(124,58,237,0.15)',
          color: '#a78bfa',
          padding: '2px 8px',
          borderRadius: 4,
        }}>
          Phase 9 · 四狐多角色
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#475569' }}>
          数据来源: FoxBoard API · 刷新间隔 2.5s
        </div>
      </div>

      {/* 游戏容器（game.js 会自动挂载到这里） */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div
          ref={containerRef}
          id="game-container"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
}
