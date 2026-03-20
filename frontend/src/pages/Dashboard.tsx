import { useEffect, useState } from 'react';
import { getKanban, getEvents } from '../api/client';

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
}

interface Event {
  id: number;
  agent_id: string;
  event_type: string;
  message: string;
  created_at: string;
}

export default function Dashboard() {
  const [kanban, setKanban] = useState<KanbanData | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getKanban().then(r => setKanban(r.data)),
      getEvents({ limit: 10 }).then(r => setEvents(r.data)),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 32, color: '#94a3b8' }}>加载中...</div>;

  const allTasks = kanban?.columns.flatMap(c => c.tasks) ?? [];
  const doneTasks = allTasks.filter(t => t.status === 'DONE').length;
  const totalTasks = allTasks.length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const blockedTasks = allTasks.filter(t => t.status === 'BLOCKED');

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 32 }}>Dashboard</h1>

      {/* 顶部指标卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 32 }}>
        {/* 进度卡片 */}
        <div style={{
          background: 'var(--foxboard-surface)',
          border: '1px solid var(--foxboard-border)',
          borderRadius: 12,
          padding: 24,
        }}>
          <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>项目进度</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--foxboard-purple)' }}>{progress}%</div>
          <div style={{ marginTop: 12, height: 6, background: '#2d2d44', borderRadius: 3 }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--foxboard-purple)', borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
          <div style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>{doneTasks} / {totalTasks} 任务完成</div>
        </div>

        {/* 任务总数卡片 */}
        <div style={{
          background: 'var(--foxboard-surface)',
          border: '1px solid var(--foxboard-border)',
          borderRadius: 12,
          padding: 24,
        }}>
          <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>任务总数</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--foxboard-gold)' }}>{totalTasks}</div>
          <div style={{ color: '#64748b', fontSize: 12, marginTop: 12 }}>
            {kanban?.columns.map(col => (
              <span key={col.status} style={{ marginRight: 12 }}>
                <span style={{ color: col.status === 'TODO' ? '#94a3b8' : col.status === 'DOING' ? '#60a5fa' : col.status === 'REVIEW' ? '#fbbf24' : '#4ade80' }}>●</span>{' '}
                {col.tasks.length}
              </span>
            ))}
          </div>
        </div>

        {/* 阻塞任务卡片 */}
        <div style={{
          background: 'var(--foxboard-surface)',
          border: '1px solid #ef4444',
          borderRadius: 12,
          padding: 24,
        }}>
          <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>⚠️ 阻塞任务</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: blockedTasks.length > 0 ? '#ef4444' : '#4ade80' }}>
            {blockedTasks.length}
          </div>
          <div style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>
            {blockedTasks.length === 0 ? '无阻塞，一切正常' : blockedTasks.map(t => t.title).join(', ')}
          </div>
        </div>
      </div>

      {/* 今日动态 */}
      <div style={{
        background: 'var(--foxboard-surface)',
        border: '1px solid var(--foxboard-border)',
        borderRadius: 12,
        padding: 24,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>📋 今日动态</h2>
        {events.length === 0 ? (
          <div style={{ color: '#475569', fontSize: 13 }}>暂无事件记录</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {events.map(event => (
              <div key={event.id} style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                padding: '10px 0',
                borderBottom: '1px solid var(--foxboard-border)',
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: event.agent_id ? 'var(--foxboard-purple)' : '#60a5fa',
                  marginTop: 6, flexShrink: 0,
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
