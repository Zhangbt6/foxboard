/**
 * AgentsDashboard.tsx — Agent 状态看板 Dashboard 页面 v1.0.0
 * Phase 12: Agent 状态监控与负载可视化
 */
import { useEffect, useState, useCallback } from 'react';
import { getAgents, getTasks, getEvents } from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { Activity, Cpu, Clock, CheckCircle, AlertCircle, Zap, Users } from 'lucide-react';

// ---- Types ----
interface Agent {
  agent_id: string;
  name: string;
  role: string;
  status: 'idle' | 'busy' | 'offline';
  current_task_id?: string;
  priority: number;
  last_heartbeat?: string;
  capability_tags?: string[];
  created_at: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  assignee_id?: string;
}

interface Event {
  id: number;
  task_id: string | null;
  agent_id: string | null;
  event_type: string;
  message: string | null;
  created_at: string;
}

// ---- 狐狸元数据 ----
const FOX_META: Record<string, { 
  emoji: string; 
  color: string; 
  gradient: string;
  role: string; 
  label: string;
  capabilities: string[];
}> = {
  qing_fox: { 
    emoji: '🦊', 
    color: '#7c3aed', 
    gradient: 'linear-gradient(135deg, #7c3aed22, #7c3aed44)',
    role: '开发工程师', 
    label: '青狐',
    capabilities: ['frontend', 'backend', 'devops', 'coding', 'architecture']
  },
  white_fox: { 
    emoji: '🦊', 
    color: '#e2e8f0', 
    gradient: 'linear-gradient(135deg, #e2e8f022, #94a3b844)',
    role: '设计/调研', 
    label: '白狐',
    capabilities: ['design', 'research', 'ui', 'assets', 'documentation']
  },
  black_fox: { 
    emoji: '🦊', 
    color: '#1e293b', 
    gradient: 'linear-gradient(135deg, #1e293b22, #47556944)',
    role: '质量审核', 
    label: '黑狐',
    capabilities: ['qa', 'review', 'audit', 'git', 'compliance']
  },
  fox_leader: { 
    emoji: '🦊', 
    color: '#ec4899', 
    gradient: 'linear-gradient(135deg, #ec489922, #f472b644)',
    role: '项目指挥官', 
    label: '花火',
    capabilities: ['pm', 'leadership', 'planning', 'coordination', 'strategy']
  },
};

// ---- 子组件 ----
function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = { 
    idle: '#4ade80', 
    busy: '#f59e0b', 
    offline: '#64748b' 
  };
  const labels: Record<string, string> = { 
    idle: '在线空闲', 
    busy: '忙碌中', 
    offline: '离线' 
  };
  const icons: Record<string, React.ReactNode> = {
    idle: <CheckCircle size={12} />,
    busy: <Zap size={12} />,
    offline: <AlertCircle size={12} />,
  };
  
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 6,
      padding: '4px 10px',
      borderRadius: 12,
      background: `${colors[status] ?? '#64748b'}22`,
      border: `1px solid ${colors[status] ?? '#64748b'}44`,
    }}>
      <span style={{ color: colors[status] ?? '#64748b' }}>{icons[status]}</span>
      <span style={{ fontSize: 12, color: colors[status] ?? '#64748b', fontWeight: 600 }}>
        {labels[status] ?? status}
      </span>
    </div>
  );
}

function FoxAvatar({ agentId, size = 64, pulse = false }: { agentId: string; size?: number; pulse?: boolean }) {
  const meta = FOX_META[agentId] ?? { 
    emoji: '🦊', 
    color: '#7c3aed', 
    gradient: 'linear-gradient(135deg, #7c3aed22, #7c3aed44)',
    label: agentId 
  };
  
  return (
    <div style={{
      width: size, 
      height: size, 
      borderRadius: 16,
      background: meta.gradient,
      border: `3px solid ${meta.color}`,
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      fontSize: size * 0.45,
      boxShadow: `0 4px 20px ${meta.color}44`,
      animation: pulse ? 'pulse 2s ease-in-out infinite' : undefined,
    }}>
      {meta.emoji}
    </div>
  );
}

function CapabilityTag({ tag }: { tag: string }) {
  const colors: Record<string, string> = {
    frontend: '#3b82f6',
    backend: '#22c55e',
    devops: '#f59e0b',
    design: '#ec4899',
    research: '#a855f7',
    qa: '#ef4444',
    pm: '#14b8a6',
    coding: '#6366f1',
    architecture: '#8b5cf6',
    ui: '#f472b6',
    assets: '#84cc16',
    documentation: '#06b6d4',
    review: '#f43f5e',
    audit: '#e11d48',
    git: '#fb7185',
    compliance: '#fda4af',
    leadership: '#c084fc',
    planning: '#a78bfa',
    coordination: '#8b5cf6',
    strategy: '#7c3aed',
  };
  
  const color = colors[tag] ?? '#64748b';
  
  return (
    <span style={{
      fontSize: 10,
      color: color,
      background: `${color}22`,
      padding: '2px 8px',
      borderRadius: 10,
      border: `1px solid ${color}44`,
      textTransform: 'capitalize',
    }}>
      {tag}
    </span>
  );
}

function ActivityItem({ event }: { event: Event }) {
  const agentMeta = event.agent_id ? (FOX_META[event.agent_id] ?? { label: event.agent_id, color: '#64748b' }) : null;
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: '12px',
      borderRadius: 8,
      background: 'var(--foxboard-surface)',
      border: '1px solid var(--foxboard-border)',
    }}>
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: agentMeta?.color ?? '#64748b',
        marginTop: 6,
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 4 }}>
          {event.message ?? event.event_type}
        </div>
        <div style={{ fontSize: 11, color: '#64748b', display: 'flex', gap: 8, alignItems: 'center' }}>
          {agentMeta && <span style={{ color: agentMeta.color }}>🦊 {agentMeta.label}</span>}
          <span>•</span>
          <span>{new Date(event.created_at).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );
}

// ---- 主组件 ----
export default function AgentsDashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  // 统计计算
  const stats = {
    total: agents.length,
    online: agents.filter(a => a.status !== 'offline').length,
    busy: agents.filter(a => a.status === 'busy').length,
    idle: agents.filter(a => a.status === 'idle').length,
    offline: agents.filter(a => a.status === 'offline').length,
  };

  // 计算Agent负载
  const getAgentLoad = (agentId: string) => {
    return tasks.filter(t => t.assignee_id === agentId && (t.status === 'DOING' || t.status === 'REVIEW')).length;
  };

  // 获取Agent当前任务
  const getAgentTasks = (agentId: string) => {
    return tasks.filter(t => t.assignee_id === agentId && t.status !== 'DONE');
  };

  // 格式化时间
  const formatTimeAgo = (iso?: string) => {
    if (!iso) return '从未';
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    return new Date(iso).toLocaleDateString('zh-CN');
  };

  // 加载数据
  const load = useCallback(() => {
    Promise.all([
      getAgents().then(r => setAgents(r.data)).catch(() => []),
      getTasks().then(r => setTasks(r.data)).catch(() => []),
      getEvents({ limit: 5 }).then(r => setEvents(r.data)).catch(() => []),
    ]).finally(() => {
      setLoading(false);
      setLastUpdated(new Date());
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  // WebSocket 实时推送
  useWebSocket({
    onMessage: (msg: { event?: string }) => {
      if (msg.event === 'agent_heartbeat' || msg.event === 'task_update') {
        load();
      }
    },
    onStatusChange: (status) => setWsConnected(status === 'connected'),
    maxReconnects: 5,
  });

  // 轮询刷新（30秒）
  useEffect(() => {
    const timer = setInterval(() => {
      load();
    }, 30000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <div style={{ padding: '24px 32px', minHeight: '100vh' }}>
      {/* 头部标题区 */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: 24 
      }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>
            🤖 Agent 状态看板
          </h1>
          <p style={{ fontSize: 14, color: '#64748b' }}>
            实时监控四狐成员状态、任务负载与能力标签
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 2 }}>连接状态</div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6,
              fontSize: 12,
              color: wsConnected ? '#4ade80' : '#f59e0b',
            }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: wsConnected ? '#4ade80' : '#f59e0b',
                boxShadow: `0 0 8px ${wsConnected ? '#4ade80' : '#f59e0b'}`,
              }} />
              {wsConnected ? '实时推送中' : '轮询模式'}
            </div>
          </div>
          {lastUpdated && (
            <div style={{ fontSize: 11, color: '#475569' }}>
              更新于 {lastUpdated.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          )}
        </div>
      </div>

      {/* 统计概览卡片区 */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(5, 1fr)', 
        gap: 16,
        marginBottom: 24,
      }}>
        {[
          { label: '总成员', value: stats.total, icon: Users, color: '#7c3aed', bg: 'rgba(124,58,237,0.15)' },
          { label: '在线', value: stats.online, icon: Activity, color: '#4ade80', bg: 'rgba(74,222,128,0.15)' },
          { label: '忙碌', value: stats.busy, icon: Cpu, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
          { label: '空闲', value: stats.idle, icon: Clock, color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
          { label: '离线', value: stats.offline, icon: AlertCircle, color: '#64748b', bg: 'rgba(100,116,139,0.15)' },
        ].map((stat, idx) => (
          <div key={idx} style={{
            background: 'var(--foxboard-surface)',
            border: '1px solid var(--foxboard-border)',
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: stat.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <stat.icon size={22} color={stat.color} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Agent 卡片网格 */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0', marginBottom: 16 }}>
          🦊 成员详情
        </h2>
      </div>

      {loading && agents.length === 0 && (
        <div style={{ 
          color: '#94a3b8', 
          padding: 48, 
          textAlign: 'center',
          background: 'var(--foxboard-surface)',
          borderRadius: 12,
        }}>
          加载中...
        </div>
      )}

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(2, 1fr)', 
        gap: 20,
        marginBottom: 32,
      }}>
        {agents.map(agent => {
          const meta = FOX_META[agent.agent_id] ?? { 
            emoji: '🦊', 
            color: '#7c3aed', 
            gradient: 'linear-gradient(135deg, #7c3aed22, #7c3aed44)',
            role: agent.role, 
            label: agent.name || agent.agent_id,
            capabilities: []
          };
          const agentTasks = getAgentTasks(agent.agent_id);
          const taskLoad = getAgentLoad(agent.agent_id);
          
          return (
            <div key={agent.agent_id} style={{
              background: 'var(--foxboard-surface)',
              border: `1px solid ${meta.color}33`,
              borderRadius: 16,
              padding: 24,
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* 背景装饰 */}
              <div style={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 120,
                height: 120,
                background: meta.gradient,
                borderRadius: '50%',
                opacity: 0.3,
              }} />
              
              <div style={{ display: 'flex', gap: 20, position: 'relative', zIndex: 1 }}>
                <FoxAvatar agentId={agent.agent_id} size={80} pulse={agent.status === 'busy'} />
                
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <h3 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', marginBottom: 2 }}>
                        {meta.label}
                      </h3>
                      <p style={{ fontSize: 13, color: meta.color }}>{meta.role}</p>
                    </div>
                    <StatusDot status={agent.status} />
                  </div>
                  
                  {/* 能力标签 */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                    {(agent.capability_tags || meta.capabilities).slice(0, 6).map((tag, idx) => (
                      <CapabilityTag key={idx} tag={tag} />
                    ))}
                  </div>
                  
                  {/* 任务负载条 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                        <span>任务负载</span>
                        <span>{taskLoad} 个进行中</span>
                      </div>
                      <div style={{
                        height: 6,
                        background: 'var(--foxboard-border)',
                        borderRadius: 3,
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${Math.min((taskLoad / 5) * 100, 100)}%`,
                          height: '100%',
                          background: taskLoad >= 3 ? '#ef4444' : taskLoad >= 2 ? '#f59e0b' : '#4ade80',
                          borderRadius: 3,
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 当前任务列表 */}
              {agentTasks.length > 0 && (
                <div style={{ 
                  marginTop: 20, 
                  padding: 16, 
                  background: 'rgba(0,0,0,0.2)', 
                  borderRadius: 12,
                  border: '1px solid var(--foxboard-border)',
                }}>
                  <h4 style={{ fontSize: 12, color: '#64748b', marginBottom: 10, textTransform: 'uppercase' }}>
                    📋 当前任务
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {agentTasks.map(task => (
                      <div key={task.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'var(--foxboard-surface)',
                        borderRadius: 8,
                        border: '1px solid var(--foxboard-border)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{
                            fontSize: 10,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: task.status === 'DOING' ? 'rgba(59,130,246,0.2)' : 
                                       task.status === 'REVIEW' ? 'rgba(245,158,11,0.2)' : 'rgba(100,116,139,0.2)',
                            color: task.status === 'DOING' ? '#60a5fa' : 
                                   task.status === 'REVIEW' ? '#fbbf24' : '#94a3b8',
                          }}>
                            {task.status}
                          </span>
                          <span style={{ fontSize: 13, color: '#e2e8f0' }}>{task.title}</span>
                        </div>
                        <span style={{ fontSize: 11, color: '#475569' }}>{task.id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 最后在线时间 */}
              <div style={{ 
                marginTop: 16, 
                paddingTop: 16, 
                borderTop: '1px solid var(--foxboard-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  <Clock size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  最后活跃: {formatTimeAgo(agent.last_heartbeat)}
                </div>
                <div style={{ fontSize: 12, color: '#475569' }}>
                  ID: <code style={{ background: 'var(--foxboard-border)', padding: '2px 6px', borderRadius: 4 }}>{agent.agent_id}</code>
                </div>
              </div>
            </div>
          );
        })}
        
        {agents.length === 0 && !loading && (
          <div style={{ 
            gridColumn: '1/-1',
            padding: 60,
            textAlign: 'center',
            background: 'var(--foxboard-surface)',
            borderRadius: 16,
            border: '1px dashed var(--foxboard-border)',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🦊</div>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>
              暂无成员数据
            </h3>
            <p style={{ fontSize: 13, color: '#64748b' }}>
              等待 Agent 注册并发送心跳...
            </p>
          </div>
        )}
      </div>
      
      {/* 最近活动流 */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0', marginBottom: 16 }}>
          📡 最近活动
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {events.length > 0 ? (
            events.map(event => <ActivityItem key={event.id} event={event} />)
          ) : (
            <div style={{ 
              padding: 24, 
              textAlign: 'center',
              color: '#64748b',
              background: 'var(--foxboard-surface)',
              borderRadius: 8,
            }}>
              暂无活动记录
            </div>
          )}
        </div>
      </div>
      
      {/* CSS 动画 */}
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 currentColor; }
          50% { box-shadow: 0 0 0 8px transparent; }
        }
      `}</style>
    </div>
  );
}

