import { useEffect, useRef } from 'react';
import { installFetchInterceptor } from './OfficeAdapter';

/**
 * PixelOffice - 像素办公室游戏组件
 * 将 game.js 直接嵌入 React，去掉 iframe
 */
export default function PixelOffice() {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current || !containerRef.current) return;
    loadedRef.current = true;

    // 1. 安装 FoxBoard API 拦截器（让 game.js 的 /status 和 /agents 请求指向 FoxBoard 后端）
    installFetchInterceptor();

    // 2. 先加载 layout.js（定义 LAYOUT 常量，game.js 依赖它）
    const layoutScript = document.createElement('script');
    layoutScript.src = '/layout.js';
    layoutScript.onload = () => {
      // 3. 加载 Phaser 3（CDN）
      const phaserScript = document.createElement('script');
      phaserScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/phaser/3.60.0/phaser.min.js';
      phaserScript.onload = () => {
        // 4. 加载 game.js（会自动找到 #game-container 并初始化）
        const gameScript = document.createElement('script');
        gameScript.src = '/game.js?v=10';
        document.body.appendChild(gameScript);
      };
      document.body.appendChild(phaserScript);
    };
    document.body.appendChild(layoutScript);

    return () => {
      // 清理：如果 React 切换页面，game.js 会继续运行但容器已卸载
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
