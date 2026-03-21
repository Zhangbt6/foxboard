/**
 * Kanban.tsx — 实时指挥看板 v0.7.0
 * Phase 7 升级：态势栏 + 角色过滤 + 详情抽屉 + 活动流 + WS实时
 */
import { useEffect, useState, useCallback } from 'react';
import { getKanban, getAgents, getEvents } from '../api/client';
import { useWebSocket, type WSStatus } from '../hooks/useWebSocket';
import { useProject } from '../contexts/ProjectContext';
import TaskDrawer from '../components/TaskDrawer';

// ---- Types ----
interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: number;
  assignee_id?: string;
  tags?: string;
  created_at: string;
  depends_on?: string;
}

interface Column {
  status: string;
  tasks: Task[];
}

interface KanbanResponse {
  data: { columns: Column[] };
}

interface Agent {
  agent_id: string;
  name: string;
  role: string;
  last_seen: string;
}

interface Event {
  id: number;
  task_id: string | null;
  agent_id: string | null;
  event_type: string;
  message: string | null;
  created_at: string;
}

// ---- 常量 ----
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  TODO:    { label: '📋 待办',    color: '#94a3b8', bg: '#1e293b' },
  DOING:   { label: '🔵 进行中',  color: '#60a5fa', bg: '#1e3a5f' },
  REVIEW:  { label: '🟡 审核',    color: '#fbbf24', bg: '#3d2f00' },
  DONE:    { label: '✅ 完成',    color: '#4ade80', bg: '#14532d' },
  BLOCKED: { label: '⛔ 阻塞',   color: '#ef4444', bg: '#3b1111' },
};

const NEXT_STATUS: Record<string, string> = {
  TODO: 'DOING',
  DOING: 'REVIEW',
  REVIEW: 'DONE',
};

const ROLE_FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'fox_leader', label: '🦊 花火' },
  { id: 'white_fox', label: '🦊 小白' },
  { id: 'qing_fox', label: '🦊 小青' },
  { id: 'black_fox', label: '🦊 小黑' },
];

// ---- 子组件 ----
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
    disconnected: '已断开',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: colors[status],
        boxShadow: `0 0 6px ${colors[status]}`,
      }} />
      <span style={{ fontSize: 11, color: colors[status] }}>{labels[status]}</span>
    </div>
  );
}

interface StatusBarProps {
  columns: Column[];
  onlineCount: number;
  projectName: string;
  lastUpdated: Date | null;
  onRefresh: () => void;
  wsStatus: WSStatus;
}

function StatusBar({ columns, onlineCount, projectName, lastUpdated, onRefresh, wsStatus }: StatusBarProps) {
  const counts = columns.reduce<Record<string, number>>((acc, col) => {
    acc[col.status] = (acc[col.status] ?? 0) + col.tasks.length;
    acc._total = (acc._total ?? 0) + col.tasks.length;
    return acc;
  }, { _total: 0 });

  const statItems = [
    { label: '全部', value: counts._total ?? 0, color: '#e2e8f0' },
    { label: '待办', value: counts.TODO ?? 0, color: '#94a3b8' },
    { label: '进行', value: counts.DOING ?? 0, color: '#60a5fa' },
    { label: '审核', value: counts.REVIEW ?? 0, color: '#fbbf24' },
    { label: '完成', value: counts.DONE ?? 0, color: '#4ade80' },
    { label: '阻塞', value: counts.BLOCKED ?? 0, color: '#ef4444' },
  ];

  return (
    <div style={{
      background: '#0f172a',
      borderBottom: '1px solid #1e293b',
      padding: '0 32px',
      margin: '0 -32px 24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 12px' }}>
        {/* 左侧：项目名 + 版本目标 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>{projectName}</span>
            <span style={{
              fontSize: 11, fontWeight: 600,
              background: 'rgba(124,58,237,0.2)',
              color: '#a78bfa',
              padding: '2px 8px', borderRadius: 6,
              border: '1px solid rgba(124,58,237,0.3)',
            }}>
              Phase 7 · v0.7.0
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#475569' }}>
            规范化项目管理机制 · 数据库真源 + Markdown投影 + EventBus + Agent SDK
          </div>
        </div>

        {/* 中间：统计 */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {statItems.map(item => (
            <div key={item.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: item.color }}>{item.value}</div>
              <div style={{ fontSize: 10, color: '#475569' }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* 右侧：在线人数 + WS状态 + 刷新 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#4ade80' }}>{onlineCount}</div>
            <div style={{ fontSize: 10, color: '#475569' }}>在线成员</div>
          </div>
          <WSStatusDot status={wsStatus} />
          {lastUpdated && (
            <span style={{ fontSize: 11, color: '#475569' }}>
              ⟳ {lastUpdated.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={onRefresh}
            style={{
              background: '#7c3aed',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '6px 14px',
              fontSize: 12,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            刷新
          </button>
        </div>
      </div>
    </div>
  );
}

interface ActivityFeedProps {
  events: Event[];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
  return d.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const EVENT_EMOJI: Record<string, string> = {
  task_created: '✨',
  task_updated: '📝',
  task_completed: '✅',
  task_claimed: '🦊',
  task_submitted: '📮',
  task_review_passed: '🎉',
  task_review_failed: '❌',
  agent_heartbeat: '💓',
};

const AGENT_LABELS: Record<string, string> = {
  fox_001: '青狐',
  white_fox: '白狐',
  black_fox: '黑狐',
  fox_leader: '花火',
};

function ActivityFeed({ events }: ActivityFeedProps) {
  return (
    <div style={{
      background: '#0f172a',
      borderTop: '1px solid #1e293b',
      margin: '24px -32px 0',
      padding: '12px 32px',
    }}>
      <div style={{ fontSize: 11, color: '#475569', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        📡 最近活动
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {events.length === 0 && (
          <span style={{ fontSize: 12, color: '#334155' }}>暂无活动</span>
        )}
        {events.slice(0, 10).map(event => (
          <div key={event.id} style={{
            flexShrink: 0,
            background: '#1e293b',
            borderRadius: 8,
            padding: '8px 12px',
            minWidth: 140,
            maxWidth: 200,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              <span style={{ fontSize: 12 }}>
                {EVENT_EMOJI[event.event_type] ?? '📌'}
              </span>
              <span style={{ fontSize: 10, color: '#64748b' }}>
                {formatTime(event.created_at)}
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
              {event.message ?? event.event_type}
              {event.agent_id && (
                <span style={{ color: '#475569' }}> · {AGENT_LABELS[event.agent_id] ?? event.agent_id}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- 主组件 ----
export default function Kanban() {
  const { projectId } = useProject();
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');  // FB-055: 优先级筛选
  const [agents, setAgents] = useState<Agent[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  const projectName = 'FoxBoard';

  const load = useCallback(() => {
    Promise.all([
      getKanban(projectId ?? undefined) as Promise<KanbanResponse>,
      getAgents().catch(() => ({ data: [] })),
      getEvents({ limit: 10 }).catch(() => ({ data: [] })),
    ]).then(([kanbanRes, agentsRes, eventsRes]) => {
      setColumns(kanbanRes.data.columns);
      setAgents(agentsRes.data ?? []);
      setEvents(eventsRes.data ?? []);
      setLastUpdated(new Date());
    }).catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  // WebSocket 实时推送
  const { status: wsStatus } = useWebSocket({
    onMessage: (msg) => {
      if (msg.event === 'task_update' || msg.event === 'task_created' || msg.event === 'agent_heartbeat') {
        load();
      }
    },
    maxReconnects: 5,
  });

  // 在线成员数（最近5分钟有心跳的）
  const onlineCount = agents.filter(a => {
    if (!a.last_seen) return false;
    const diff = Date.now() - new Date(a.last_seen).getTime();
    return diff < 5 * 60 * 1000;
  }).length || 1;

  // FB-055: 角色 + 优先级过滤后的列数据
  const filteredColumns = columns.map(col => ({
    ...col,
    tasks: col.tasks.filter(t => {
      // 角色过滤
      if (roleFilter !== 'all' && t.assignee_id !== roleFilter) return false;
      // 优先级过滤
      if (priorityFilter === 'high' && t.priority < 8) return false;
      if (priorityFilter === 'medium' && (t.priority < 5 || t.priority > 7)) return false;
      if (priorityFilter === 'low' && t.priority > 4) return false;
      return true;
    }),
  }));

  return (
    <div style={{ padding: '24px 32px', minHeight: '100vh' }}>
      {/* 态势栏 */}
      <StatusBar
        columns={columns}
        onlineCount={onlineCount}
        projectName={projectName}
        lastUpdated={lastUpdated}
        onRefresh={load}
        wsStatus={wsStatus}
      />

      {/* 角色过滤 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {ROLE_FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setRoleFilter(f.id)}
            style={{
              background: roleFilter === f.id ? '#7c3aed' : '#1e293b',
              color: roleFilter === f.id ? '#fff' : '#94a3b8',
              border: roleFilter === f.id ? '1px solid #7c3aed' : '1px solid #334155',
              borderRadius: 6,
              padding: '5px 12px',
              fontSize: 12,
              cursor: 'pointer',
              fontWeight: roleFilter === f.id ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            {f.label}
          </button>
        ))}

        {/* FB-055: 优先级过滤 */}
        <div style={{ width: 1, height: 20, background: '#334155', margin: '0 4px' }} />
        {[
          { id: 'all', label: '全部优先级' },
          { id: 'high', label: '🔴 P8+' },
          { id: 'medium', label: '🟡 P5-7' },
          { id: 'low', label: '⚪ P1-4' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setPriorityFilter(f.id)}
            style={{
              background: priorityFilter === f.id ? '#7c3aed' : '#1e293b',
              color: priorityFilter === f.id ? '#fff' : '#94a3b8',
              border: priorityFilter === f.id ? '1px solid #7c3aed' : '1px solid #334155',
              borderRadius: 6,
              padding: '5px 12px',
              fontSize: 12,
              cursor: 'pointer',
              fontWeight: priorityFilter === f.id ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            {f.label}
          </button>
        ))}

        {(roleFilter !== 'all' || priorityFilter !== 'all') && (
          <span style={{ fontSize: 11, color: '#475569', alignSelf: 'center' }}>
            （{filteredColumns.reduce((s, c) => s + c.tasks.length, 0)} 个任务）
          </span>
        )}
      </div>

      {/* 看板主体 */}
      {loading && columns.length === 0 && (
        <div style={{ color: '#94a3b8', padding: 32, textAlign: 'center' }}>加载中...</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, alignItems: 'flex-start' }}>
        {filteredColumns.map(col => {
          const meta = STATUS_META[col.status] ?? { label: col.status, color: '#94a3b8', bg: '#1e293b' };
          return (
            <div key={col.status}>
              <div style={{
                padding: '12px 16px',
                borderRadius: '8px 8px 0 0',
                background: meta.bg,
                borderBottom: `2px solid ${meta.color}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: meta.color, fontWeight: 600, fontSize: 14 }}>{meta.label}</span>
                  <span style={{
                    background: meta.color, color: '#000',
                    borderRadius: '50%', width: 20, height: 20,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                  }}>
                    {col.tasks.length}
                  </span>
                </div>
              </div>

              <div style={{
                background: '#111827',
                borderRadius: '0 0 8px 8px',
                padding: '12px',
                display: 'flex', flexDirection: 'column', gap: 10,
                minHeight: 200,
              }}>
                {col.tasks.length === 0 && (
                  <div style={{ color: '#374151', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>空</div>
                )}
                {col.tasks.map(task => (
                  <div key={task.id} style={{
                    background: 'var(--foxboard-surface)',
                    border: '1px solid var(--foxboard-border)',
                    borderRadius: 8, padding: '12px 14px',
                    cursor: 'pointer',
                    transition: 'transform 0.1s, border-color 0.15s, box-shadow 0.15s',
                  }}
                    onClick={() => setSelectedTaskId(task.id)}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = '#7c3aed';
                      (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 1px #7c3aed44';
                      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--foxboard-border)';
                      (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                      (e.currentTarget as HTMLDivElement).style.transform = 'none';
                    }}
                    title="点击查看详情"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{
                        fontSize: 10,
                        background: task.priority >= 8 ? '#ef4444' : task.priority >= 5 ? '#f59e0b' : '#475569',
                        color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 600,
                      }}>
                        P{task.priority}
                      </span>
                      <span style={{ fontSize: 10, color: '#475569' }}>
                        {task.assignee_id
                          ? `🦊 ${AGENT_LABELS[task.assignee_id] ?? task.assignee_id}`
                          : '未分配'}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.4 }}>{task.title}</div>
                    {task.tags && (
                      <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {task.tags.split(',').map(tag => (
                          <span key={tag} style={{
                            fontSize: 10, color: '#a78bfa',
                            background: 'rgba(124,58,237,0.15)', padding: '1px 6px', borderRadius: 4,
                          }}>{tag.trim()}</span>
                        ))}
                      </div>
                    )}
                    {NEXT_STATUS[task.status] && (
                      <div style={{ marginTop: 8, fontSize: 10, color: meta.color, textAlign: 'right' }}>
                        → {STATUS_META[NEXT_STATUS[task.status]]?.label}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 活动流 */}
      <ActivityFeed events={events} />

      {/* 任务详情抽屉 */}
      <TaskDrawer
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onRefresh={load}
      />
    </div>
  );
}
