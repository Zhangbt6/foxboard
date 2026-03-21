import { useEffect, useState, useCallback } from 'react';
import { getAgents, getTasks } from '../api/client';
import { useWebSocket, type WSStatus } from '../hooks/useWebSocket';

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

const FOX_META: Record<string, { emoji: string; color: string; role: string; label: string }> = {
  qing_fox:   { emoji: '🦊', color: '#7c3aed', role: '开发', label: '小青' },
  white_fox:  { emoji: '🦊', color: '#e2e8f0', role: '设计', label: '小白' },
  black_fox:  { emoji: '🦊', color: '#1e293b', role: '运维', label: '小黑' },
  fox_leader: { emoji: '🦊', color: '#ec4899', role: '指挥官', label: '花火' },
};

function FoxAvatar({ agentId, size = 64 }: { agentId: string; size?: number }) {
  const meta = FOX_META[agentId] ?? { emoji: '🦊', color: '#7c3aed', role: '未知', label: agentId };
  return (
    <div style={{
      width: size, height: size, borderRadius: 12,
      background: `linear-gradient(135deg, ${meta.color}33, ${meta.color}11)`,
      border: `2px solid ${meta.color}66`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
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

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(() => {
    Promise.all([
      getAgents().then(r => setAgents(r.data)),
      getTasks().then(r => setTasks(r.data)),
    ]).catch(() => {}).finally(() => setLoading(false));
    setLastUpdated(new Date());
  }, []);

  useEffect(() => { load(); }, [load]);

  const { status: wsStatus } = useWebSocket({
    onMessage: (msg) => {
      const event = msg.event as string;
      if (event === 'agent_heartbeat' || event === 'task_update' || event === 'activity_log') {
        load();
      }
    },
    maxReconnects: 5,
  });

  const getTaskTitle = (taskId?: string) => tasks.find(t => t.id === taskId)?.title ?? '—';

  const formatTime = (iso?: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const selectAgent = (agentId: string) => {
    localStorage.setItem('foxboard_agent_id', agentId);
    window.location.href = '/my';
  };

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>
          成员状态 <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>（点击成员卡片进入「我的任务」视图）</span>
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <WSStatusDot status={wsStatus} />
          {lastUpdated && (
            <span style={{ fontSize: 11, color: '#475569' }}>
              ⟳ {lastUpdated.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {loading && agents.length === 0 && <div style={{ color: '#94a3b8', padding: 32 }}>加载中...</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
        {agents.map(agent => {
          const meta = FOX_META[agent.id] ?? { emoji: '🦊', color: '#7c3aed', role: agent.role, label: agent.name };
          return (
            <div
              key={agent.id}
              style={{
                background: 'var(--foxboard-surface)',
                border: `1px solid ${meta.color}33`,
                borderRadius: 16,
                padding: 24,
                display: 'flex',
                gap: 20,
                alignItems: 'flex-start',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
              onClick={() => selectAgent(agent.id)}
              title="点击进入该成员的任务队列"
            >
              <FoxAvatar agentId={agent.id} size={72} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9' }}>{meta.label}</div>
                  <StatusDot status={agent.status} />
                </div>
                <div style={{ fontSize: 12, color: meta.color, marginBottom: 16 }}>{meta.label} · {meta.role}</div>
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

        {agents.length === 0 && (
          <div style={{ gridColumn: '1/-1', color: '#475569', textAlign: 'center', padding: 48, fontSize: 14 }}>
            暂无成员注册
          </div>
        )}
      </div>
    </div>
  );
}
