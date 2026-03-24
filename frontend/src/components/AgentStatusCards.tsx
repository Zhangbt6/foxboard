/**
 * AgentStatusCards.tsx — Agent 状态卡片组件 v1.0.0
 * Phase 12: OpenClaw Dashboard 集成
 * 
 * 功能：展示四狐 Agent 实时状态卡片
 * - 花火 (fox_leader): 项目指挥官
 * - 青狐 (qing_fox): 开发工程师
 * - 白狐 (white_fox): 设计/调研
 * - 黑狐 (black_fox): 质量审核
 */

import { useEffect, useState, useCallback } from 'react';
import { getAgents, getTasks } from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { 
  Activity, 
  Clock, 
  Briefcase
} from 'lucide-react';

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

// ---- 狐狸元数据 ----
const FOX_META: Record<string, { 
  emoji: string; 
  color: string; 
  gradient: string;
  borderColor: string;
  role: string; 
  label: string;
  description: string;
  capabilities: string[];
}> = {
  fox_leader: { 
    emoji: '🦊', 
    color: '#ec4899', 
    gradient: 'linear-gradient(135deg, rgba(236,72,153,0.15) 0%, rgba(244,114,182,0.08) 100%)',
    borderColor: 'rgba(236,72,153,0.3)',
    role: '项目指挥官', 
    label: '花火',
    description: 'PM / 任务派发 / 进度把控',
    capabilities: ['pm', 'leadership', 'planning', 'coordination', 'strategy']
  },
  qing_fox: { 
    emoji: '🦊', 
    color: '#7c3aed', 
    gradient: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(139,92,246,0.08) 100%)',
    borderColor: 'rgba(124,58,237,0.3)',
    role: '开发工程师', 
    label: '青狐',
    description: 'Frontend / Backend / DevOps',
    capabilities: ['frontend', 'backend', 'devops', 'coding', 'architecture']
  },
  white_fox: { 
    emoji: '🦊', 
    color: '#e2e8f0', 
    gradient: 'linear-gradient(135deg, rgba(226,232,240,0.12) 0%, rgba(148,163,184,0.06) 100%)',
    borderColor: 'rgba(226,232,240,0.25)',
    role: '设计/调研', 
    label: '白狐',
    description: 'Design / Research / UI/UX',
    capabilities: ['design', 'research', 'ui', 'assets', 'documentation']
  },
  black_fox: { 
    emoji: '🦊', 
    color: '#475569', 
    gradient: 'linear-gradient(135deg, rgba(71,85,105,0.15) 0%, rgba(30,41,59,0.1) 100%)',
    borderColor: 'rgba(71,85,105,0.3)',
    role: '质量审核', 
    label: '黑狐',
    description: 'QA / Code Review / Git Management',
    capabilities: ['qa', 'review', 'audit', 'git', 'compliance']
  },
};

// ---- 子组件 ----

function StatusDot({ status, pulse = false }: { status: string; pulse?: boolean }) {
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
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 8, 
        height: 8, 
        borderRadius: '50%',
        background: colors[status] || '#64748b',
        boxShadow: pulse ? `0 0 8px ${colors[status]}` : 'none',
        animation: pulse ? 'pulse 2s infinite' : 'none',
      }} />
      <span style={{ fontSize: 11, color: colors[status] || '#64748b' }}>
        {labels[status] || status}
      </span>
    </div>
  );
}

function AgentCard({ agent, currentTask }: { agent: Agent; currentTask?: Task }) {
  const meta = FOX_META[agent.agent_id] || FOX_META['fox_leader'];
  const timeSinceHeartbeat = agent.last_heartbeat 
    ? Math.floor((new Date().getTime() - new Date(agent.last_heartbeat).getTime()) / 60000)
    : null;
  
  return (
    <div style={{
      background: 'var(--foxboard-surface)',
      border: `1px solid ${meta.borderColor}`,
      borderRadius: 12,
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* 背景渐变 */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: meta.gradient,
        opacity: 0.5,
        pointerEvents: 'none',
      }} />
      
      {/* 内容 */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* 头部 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 48, height: 48,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${meta.color}22, ${meta.color}44)`,
            border: `2px solid ${meta.color}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24,
          }}>
            {meta.emoji}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0' }}>
              {meta.label}
            </div>
            <div style={{ fontSize: 12, color: meta.color, marginTop: 2 }}>
              {meta.role}
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <StatusDot status={agent.status} pulse={agent.status === 'busy'} />
          </div>
        </div>
        
        {/* 描述 */}
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
          {meta.description}
        </div>
        
        {/* 当前任务 */}
        {currentTask && (
          <div style={{
            background: 'rgba(124,58,237,0.1)',
            border: '1px solid rgba(124,58,237,0.2)',
            borderRadius: 8,
            padding: 10,
            marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Briefcase size={12} color="#a78bfa" />
              <span style={{ fontSize: 11, color: '#a78bfa' }}>当前任务</span>
            </div>
            <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500 }}>
              {currentTask.id}: {currentTask.title}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              状态: {currentTask.status}
            </div>
          </div>
        )}
        
        {/* 底部信息 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: '#475569' }}>
          {timeSinceHeartbeat !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={12} />
              <span>心跳: {timeSinceHeartbeat < 1 ? '刚刚' : `${timeSinceHeartbeat}分钟前`}</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Activity size={12} />
            <span>优先级: P{agent.priority}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- 主组件 ----

export default function AgentStatusCards() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    Promise.all([
      getAgents().then(r => setAgents(r.data)),
      getTasks().then(r => setTasks(r.data)),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // WebSocket 实时更新
  useWebSocket({
    onMessage: (msg) => {
      const event = msg.event as string;
      if (event === 'agent_heartbeat' || event === 'task_update') {
        refresh();
      }
    },
    maxReconnects: 5,
  });

  // 获取每个 Agent 的当前任务
  const getAgentCurrentTask = (agentId: string): Task | undefined => {
    return tasks.find(t => 
      t.assignee_id === agentId && 
      (t.status === 'DOING' || t.status === 'REVIEW')
    );
  };

  // 按固定顺序排序: 花火、青狐、白狐、黑狐
  const sortedAgents = ['fox_leader', 'qing_fox', 'white_fox', 'black_fox']
    .map(id => agents.find(a => a.agent_id === id))
    .filter(Boolean) as Agent[];

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
        <Activity size={32} style={{ marginBottom: 16, opacity: 0.5 }} />
        <div>加载 Agent 状态中...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* 标题 */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
          🦊 Agent 状态监控
        </h2>
        <p style={{ fontSize: 12, color: '#64748b' }}>
          实时显示四狐团队在线状态与当前任务
        </p>
      </div>

      {/* Agent 卡片网格 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 20,
      }}>
        {sortedAgents.map(agent => (
          <AgentCard 
            key={agent.agent_id} 
            agent={agent} 
            currentTask={getAgentCurrentTask(agent.agent_id)}
          />
        ))}
      </div>

      {/* 底部统计 */}
      <div style={{
        marginTop: 24,
        padding: 16,
        background: 'var(--foxboard-surface)',
        border: '1px solid var(--foxboard-border)',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#4ade80' }}>
            {agents.filter(a => a.status === 'idle').length}
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>在线空闲</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>
            {agents.filter(a => a.status === 'busy').length}
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>忙碌中</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#64748b' }}>
            {agents.filter(a => a.status === 'offline').length}
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>离线</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#7c3aed' }}>
            {tasks.filter(t => t.status === 'DOING' || t.status === 'REVIEW').length}
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>进行中任务</div>
        </div>
      </div>
    </div>
  );
}
