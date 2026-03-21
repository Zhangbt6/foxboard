import { useEffect, useState, useCallback } from 'react';
import { getAgents, getTasks } from '../api/client';
import { useInterval } from '../hooks/useInterval';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: number;
  assignee_id?: string;
  tags?: string;
  created_at: string;
}

interface Agent {
  id: string;
  name: string;
  role: string;
  status: string;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  TODO:    { label: '📋 待办',    color: '#94a3b8', bg: '#1e293b' },
  DOING:   { label: '🔵 进行中',  color: '#60a5fa', bg: '#1e3a5f' },
  REVIEW:  { label: '🟡 审核',    color: '#fbbf24', bg: '#3d2f00' },
  DONE:    { label: '✅ 完成',    color: '#4ade80', bg: '#14532d' },
  BLOCKED: { label: '🚫 阻塞',    color: '#ef4444', bg: '#3f0000' },
};

export default function MyTasks() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    Promise.all([
      getAgents().then(r => setAgents(r.data)),
      getTasks().then(r => setTasks(r.data)),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useInterval(load, 10000);

  const filteredTasks = tasks.filter(t => {
    if (selectedAgent && t.assignee_id !== selectedAgent) return false;
    if (statusFilter && t.status !== statusFilter) return false;
    return true;
  });

  const grouped = Object.entries(STATUS_META).reduce((acc, [status]) => {
    acc[status] = filteredTasks.filter(t => t.status === status);
    return acc;
  }, {} as Record<string, Task[]>);

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>我的任务</h1>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
            安全只读视图。自动推进状态已禁用；后续将并入主看板。
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select
            value={selectedAgent}
            onChange={e => setSelectedAgent(e.target.value)}
            style={{ background: 'var(--foxboard-surface)', color: '#e2e8f0', border: '1px solid var(--foxboard-border)', borderRadius: 8, padding: '6px 12px', fontSize: 13 }}
          >
            <option value="">全部成员</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ background: 'var(--foxboard-surface)', color: '#e2e8f0', border: '1px solid var(--foxboard-border)', borderRadius: 8, padding: '6px 12px', fontSize: 13 }}
          >
            <option value="">全部状态</option>
            {Object.entries(STATUS_META).map(([s, m]) => (
              <option key={s} value={s}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div style={{ color: '#94a3b8' }}>加载中...</div>}

      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {Object.entries(STATUS_META).map(([status, meta]) => (
          <div key={status} style={{
            flex: 1,
            background: meta.bg,
            border: `1px solid ${meta.color}44`,
            borderRadius: 8,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ color: meta.color, fontSize: 13 }}>{meta.label}</span>
            <span style={{ color: meta.color, fontWeight: 700, fontSize: 18 }}>
              {grouped[status]?.length ?? 0}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {Object.entries(STATUS_META).map(([status, meta]) => (
          <div key={status}>
            <div style={{ color: meta.color, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
              {meta.label} ({grouped[status]?.length ?? 0})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(grouped[status] ?? []).map(task => (
                <div key={task.id} style={{
                  background: 'var(--foxboard-surface)',
                  border: `1px solid ${meta.color}44`,
                  borderRadius: 10,
                  padding: '12px 14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{
                      fontSize: 10,
                      background: task.priority >= 8 ? '#ef4444' : task.priority >= 5 ? '#f59e0b' : '#475569',
                      color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 600,
                    }}>
                      P{task.priority}
                    </span>
                    <span style={{ fontSize: 10, color: '#475569' }}>
                      {task.assignee_id || '未分配'}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.4 }}>{task.title}</div>
                  {task.tags && (
                    <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {task.tags.split(',').map(tag => (
                        <span key={tag} style={{ fontSize: 10, color: 'var(--foxboard-purple)', background: 'rgba(124,58,237,0.15)', padding: '1px 6px', borderRadius: 4 }}>{tag.trim()}</span>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 10, color: '#64748b', textAlign: 'right' }}>
                    已禁用点击自动推进
                  </div>
                </div>
              ))}
              {grouped[status]?.length === 0 && (
                <div style={{ color: '#374151', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>无</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
