import { useRef } from 'react';

export default function Office() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
          Phase 5 · 实时四狐状态
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#475569' }}>
          数据来源: FoxBoard API · 刷新间隔 2.5s
        </div>
      </div>

      {/* 游戏 iframe */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <iframe
          ref={iframeRef}
          src="/office.html"
          title="FoxBoard 像素办公室"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
          allow="gamepad; cross-origin-isolated"
        />
      </div>
    </div>
  );
}
