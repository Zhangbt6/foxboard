import { useEffect, useState } from 'react';
import { getAgents, getTasks } from '../api/client';

interface Agent {
  id: string;
  name: string;
  role: string;
  status: string;
  current_task_id?: string;
  priority: number;
  last_heartbeat?: string;
  created_at: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
}

// 四只狐狸元数据
const FOX_META: Record<string, { emoji: string; color: string; role: string }> = {
  fox_001:    { emoji: '🦊', color: '#7c3aed', role: '青狐 · 开发' },
  white_fox:  { emoji: '🦊', color: '#e2e8f0', role: '白狐 · 调研' },
  black_fox:  { emoji: '🦊', color: '#1e293b', role: '黑狐 · 审核' },
  fox_leader: { emoji: '🦊', color: '#ec4899', role: '花火 · 指挥官' },
};

function FoxAvatar({ agentId, size = 64 }: { agentId: string; size?: number }) {
  const meta = FOX_META[agentId] ?? { emoji: '🦊', color: '#7c3aed', role: '未知' };
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: 12,
      background: `linear-gradient(135deg, ${meta.color}33, ${meta.color}11)`,
      border: `2px solid ${meta.color}66`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.5,
    }}>
      {meta.emoji}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = { idle: '#4ade80', busy: '#f59e0b', offline: '#64748b' };
  const labels: Record<string, string> = { idle: '在线', busy: '忙碌', offline: '离线' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors[status] ?? '#64748b', boxShadow: `0 0 6px ${colors[status]}` }} />
      <span style={{ fontSize: 12, color: colors[status] ?? '#64748b' }}>{labels[status] ?? status}</span>
    </div>
  );
}

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getAgents().then(r => setAgents(r.data)),
      getTasks().then(r => setTasks(r.data)),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 32, color: '#94a3b8' }}>加载中...</div>;

  const getTaskTitle = (taskId?: string) => tasks.find(t => t.id === taskId)?.title ?? '—';

  const formatTime = (iso?: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>成员状态</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
        {agents.map(agent => {
          const meta = FOX_META[agent.id] ?? { emoji: '🦊', color: '#7c3aed', role: agent.role };
          return (
            <div key={agent.id} style={{
              background: 'var(--foxboard-surface)',
              border: `1px solid ${meta.color}33`,
              borderRadius: 16,
              padding: 24,
              display: 'flex',
              gap: 20,
              alignItems: 'flex-start',
            }}>
              {/* 头像 */}
              <FoxAvatar agentId={agent.id} size={72} />

              {/* 信息 */}
              <div style={{ flex: 1 }}>
                {/* 名字和状态 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9' }}>{agent.name}</div>
                  <StatusDot status={agent.status} />
                </div>
                <div style={{ fontSize: 12, color: meta.color, marginBottom: 16 }}>{meta.role}</div>

                {/* 详情行 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13 }}>
                  <div>
                    <div style={{ color: '#475569', fontSize: 11, marginBottom: 2 }}>当前任务</div>
                    <div style={{ color: '#cbd5e1' }}>{getTaskTitle(agent.current_task_id)}</div>
                  </div>
                  <div>
                    <div style={{ color: '#475569', fontSize: 11, marginBottom: 2 }}>优先级</div>
                    <div style={{ color: '#cbd5e1' }}>{agent.priority > 0 ? `P${agent.priority}` : '—'}</div>
                  </div>
                  <div>
                    <div style={{ color: '#475569', fontSize: 11, marginBottom: 2 }}>最近心跳</div>
                    <div style={{ color: '#cbd5e1' }}>{formatTime(agent.last_heartbeat)}</div>
                  </div>
                  <div>
                    <div style={{ color: '#475569', fontSize: 11, marginBottom: 2 }}>ID</div>
                    <div style={{ color: '#94a3b8', fontSize: 12 }}>{agent.id}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* 空状态占位 */}
        {agents.length === 0 && (
          <div style={{ gridColumn: '1/-1', color: '#475569', textAlign: 'center', padding: 48, fontSize: 14 }}>
            暂无成员注册，请先通过 API 注册成员
          </div>
        )}
      </div>
    </div>
  );
}
