import { useEffect, useState } from 'react';
import { getEvents } from '../api/client';

// Event type definitions
const EVENT_TYPE_META: Record<string, { emoji: string; color: string; label: string }> = {
  task_created:      { emoji: '✨',  color: '#6366f1', label: '任务创建' },
  task_updated:      { emoji: '📝',  color: '#f59e0b', label: '任务更新' },
  task_completed:    { emoji: '✅',  color: '#10b981', label: '任务完成' },
  agent_heartbeat:   { emoji: '💓',  color: '#06b6d4', label: 'Agent心跳' },
  agent_registered:  { emoji: '🦊',  color: '#8b5cf6', label: 'Agent注册' },
};

// Agent meta for display
const AGENT_META: Record<string, { emoji: string; color: string; name: string }> = {
  qing_fox:   { emoji: '🦊', color: '#7c3aed', name: '小青' },
  white_fox:  { emoji: '🦊', color: '#e2e8f0', name: '小白' },
  black_fox:  { emoji: '🦊', color: '#1e293b', name: '小黑' },
  fox_leader: { emoji: '🦊', color: '#ec4899', name: '花火' },
};

interface Event {
  id: number;
  task_id: string | null;
  agent_id: string | null;
  event_type: string;
  message: string | null;
  metadata: string | null;
  created_at: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)} 小时前`;
  return d.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Activity() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEvents({ limit: 50 })
      .then(res => {
        setEvents(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError('无法加载事件日志，请检查后端服务是否运行');
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 页面头部 */}
      <div style={{
        padding: '20px 32px',
        borderBottom: '1px solid var(--foxboard-border)',
        background: 'var(--foxboard-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>事件流</h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
            实时事件时间线：任务变更 · Agent心跳 · 状态更新
          </p>
        </div>
        <div style={{
          fontSize: 12,
          color: '#64748b',
          background: '#1e293b',
          padding: '4px 14px',
          borderRadius: 20,
        }}>
          v0.3.0 · Phase 3
        </div>
      </div>

      {/* 事件列表 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        {loading && (
          <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>
            加载中...
          </div>
        )}

        {error && (
          <div style={{
            textAlign: 'center',
            color: '#ef4444',
            padding: 40,
            background: '#ef444411',
            borderRadius: 12,
            border: '1px solid #ef444433',
          }}>
            {error}
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>
            暂无事件记录
          </div>
        )}

        {!loading && !error && events.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {events.map((event, idx) => {
              const meta = EVENT_TYPE_META[event.event_type] ?? {
                emoji: '📌',
                color: '#64748b',
                label: event.event_type,
              };
              const agentMeta = event.agent_id
                ? AGENT_META[event.agent_id] ?? { emoji: '🦊', color: '#64748b', name: event.agent_id }
                : null;

              return (
                <div
                  key={event.id}
                  style={{
                    display: 'flex',
                    gap: 16,
                    paddingBottom: 20,
                    position: 'relative',
                  }}
                >
                  {/* 时间线竖线 */}
                  {idx < events.length - 1 && (
                    <div style={{
                      position: 'absolute',
                      left: 15,
                      top: 32,
                      bottom: 0,
                      width: 2,
                      background: '#1e293b',
                    }} />
                  )}

                  {/* 圆点 */}
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: `${meta.color}22`,
                    border: `2px solid ${meta.color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    flexShrink: 0,
                    zIndex: 1,
                  }}>
                    {meta.emoji}
                  </div>

                  {/* 内容 */}
                  <div style={{
                    flex: 1,
                    background: 'var(--foxboard-surface)',
                    border: '1px solid var(--foxboard-border)',
                    borderRadius: 10,
                    padding: '12px 16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: meta.color,
                          background: `${meta.color}18`,
                          padding: '2px 8px',
                          borderRadius: 6,
                        }}>
                          {meta.label}
                        </span>
                        {agentMeta && (
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>
                            <span style={{ marginRight: 4 }}>{agentMeta.emoji}</span>
                            {agentMeta.name}
                          </span>
                        )}
                        {event.task_id && (
                          <span style={{ fontSize: 11, color: '#475569' }}>
                            任务: {event.task_id}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: '#475569' }}>
                        {formatTime(event.created_at)}
                      </span>
                    </div>
                    {event.message && (
                      <p style={{ fontSize: 13, color: 'var(--foxboard-text)', margin: 0, lineHeight: 1.5 }}>
                        {event.message}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
