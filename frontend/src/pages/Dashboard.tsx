import { useEffect, useState, useCallback } from 'react';
import { getKanban, getEvents } from '../api/client';
import { useWebSocket, type WSStatus } from '../hooks/useWebSocket';

interface KanbanData {
  columns: { status: string; tasks: Task[] }[];
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: number;
  assignee_id: string;
  created_at: string;
  completed_at?: string;
  started_at?: string;
}

interface FoxEvent {
  id: number;
  agent_id?: string;
  event_type: string;
  message?: string;
  created_at: string;
}

function WSStatusDot({ status }: { status: WSStatus }) {
  const colors: Record<WSStatus, string> = {
    connected: '#4ade80',
    connecting: '#f59e0b',
    reconnecting: '#f97316',
    disconnected: '#64748b',
  };
  const labels: Record<WSStatus, string> = {
    connected: '实时在线',
    connecting: '连接中',
    reconnecting: '重连中',
    disconnected: '离线(轮询)',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: colors[status] }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: colors[status],
        boxShadow: `0 0 6px ${colors[status]}`,
      }} />
      {labels[status]}
    </div>
  );
}

export default function Dashboard() {
  const [kanban, setKanban] = useState<KanbanData | null>(null);
  const [events, setEvents] = useState<FoxEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(() => {
    Promise.all([
      getKanban().then(r => setKanban(r.data)),
      getEvents({ limit: 30 }).then(r => setEvents(r.data)),
    ]).catch(() => {}).finally(() => setLoading(false));
    setLastUpdated(new Date());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // WebSocket 实时推送（替代轮询）
  const { status: wsStatus } = useWebSocket({
    onMessage: (msg) => {
      const event = msg.event as string;
      if (event === 'task_update' || event === 'activity_log' || event === 'agent_heartbeat') {
        // 有相关事件时静默刷新数据
        refresh();
      }
    },
    maxReconnects: 5,
  });

  const allTasks = kanban?.columns.flatMap(c => c.tasks) ?? [];
  const doneTasks = allTasks.filter(t => t.status === 'DONE').length;
  const totalTasks = allTasks.length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const blockedTasks = allTasks.filter(t => t.status === 'BLOCKED');

  const timeoutEvents = events.filter(e => e.event_type === 'task_timeout');
  const reviewEvents = events.filter(e => e.event_type === 'task_review_requested');

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <WSStatusDot status={wsStatus} />
          {lastUpdated && (
            <span style={{ fontSize: 11, color: '#475569' }}>
              ⟳ {lastUpdated.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {loading && !kanban && <div style={{ color: '#94a3b8', padding: 32 }}>加载中...</div>}

      {/* 指标卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 32 }}>
        <div style={{ background: 'var(--foxboard-surface)', border: '1px solid var(--foxboard-border)', borderRadius: 12, padding: 24 }}>
          <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>项目进度</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--foxboard-purple)' }}>{progress}%</div>
          <div style={{ marginTop: 12, height: 6, background: '#2d2d44', borderRadius: 3 }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--foxboard-purple)', borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
          <div style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>{doneTasks} / {totalTasks} 任务完成</div>
        </div>

        <div style={{ background: 'var(--foxboard-surface)', border: '1px solid var(--foxboard-border)', borderRadius: 12, padding: 24 }}>
          <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>任务总数</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--foxboard-gold)' }}>{totalTasks}</div>
          <div style={{ color: '#64748b', fontSize: 12, marginTop: 12 }}>
            {kanban?.columns.map(col => (
              <span key={col.status} style={{ marginRight: 12 }}>
                <span style={{ color: col.status === 'TODO' ? '#94a3b8' : col.status === 'DOING' ? '#60a5fa' : col.status === 'REVIEW' ? '#fbbf24' : '#4ade80' }}>●</span> {col.tasks.length}
              </span>
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--foxboard-surface)', border: '1px solid #ef4444', borderRadius: 12, padding: 24 }}>
          <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>⚠️ 阻塞任务</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: blockedTasks.length > 0 ? '#ef4444' : '#4ade80' }}>{blockedTasks.length}</div>
          <div style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>
            {blockedTasks.length === 0 ? '无阻塞' : blockedTasks.map(t => t.title).join(', ')}
          </div>
        </div>

        <div style={{ background: 'var(--foxboard-surface)', border: `1px solid ${timeoutEvents.length > 0 ? '#ef4444' : '#2d2d44'}`, borderRadius: 12, padding: 24 }}>
          <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>⏱️ 超时任务</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: timeoutEvents.length > 0 ? '#ef4444' : '#4ade80' }}>{timeoutEvents.length}</div>
          <div style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>
            {timeoutEvents.length === 0 ? '无超时' : timeoutEvents.slice(0, 2).map(e => e.message || '超时').join(', ')}
          </div>
        </div>
      </div>

      {/* 超时告警横幅 */}
      {timeoutEvents.length > 0 && (
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid #ef4444',
          borderRadius: 12,
          padding: '16px 24px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          <div style={{ fontSize: 24 }}>⏱️</div>
          <div>
            <div style={{ color: '#ef4444', fontWeight: 600, marginBottom: 4 }}>有 {timeoutEvents.length} 个任务执行超时</div>
            {timeoutEvents.map(e => (
              <div key={e.id} style={{ color: '#fca5a5', fontSize: 12 }}>
                {e.message} — {new Date(e.created_at).toLocaleString('zh-CN')}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REVIEW 待审核提示 */}
      {reviewEvents.length > 0 && (
        <div style={{
          background: 'rgba(251,191,36,0.1)',
          border: '1px solid #fbbf24',
          borderRadius: 12,
          padding: '16px 24px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          <div style={{ fontSize: 24 }}>🔍</div>
          <div>
            <div style={{ color: '#fbbf24', fontWeight: 600, marginBottom: 4 }}>待黑狐审核</div>
            {reviewEvents.slice(0, 3).map(e => (
              <div key={e.id} style={{ color: '#fde68a', fontSize: 12 }}>
                {e.message || '新审核任务'} — {new Date(e.created_at).toLocaleString('zh-CN')}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 事件流 */}
      <div style={{ background: 'var(--foxboard-surface)', border: '1px solid var(--foxboard-border)', borderRadius: 12, padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>📋 事件流 {wsStatus === 'connected' && <span style={{ fontSize: 11, color: '#4ade80', marginLeft: 8 }}>● 实时推送</span>}</h2>
        {events.length === 0 ? (
          <div style={{ color: '#475569', fontSize: 13 }}>暂无事件记录</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {events.map(event => (
              <div key={event.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--foxboard-border)' }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                  background: event.event_type === 'task_timeout' ? '#ef4444'
                    : event.event_type === 'task_review_requested' ? '#fbbf24'
                    : event.agent_id ? 'var(--foxboard-purple)' : '#60a5fa',
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#e2e8f0' }}>
                    {event.agent_id ? `🦊 ${event.agent_id}` : '系统'}: {event.event_type}
                  </div>
                  {event.message && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{event.message}</div>}
                </div>
                <div style={{ fontSize: 11, color: '#475569', flexShrink: 0 }}>
                  {new Date(event.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
