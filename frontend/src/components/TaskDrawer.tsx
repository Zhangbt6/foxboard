/**
 * TaskDrawer.tsx — 任务详情抽屉组件
 * 从看板右侧滑出，展示任务完整信息、操作按钮和最近事件
 */
import { useEffect, useState } from 'react';
import { getTask, claimTask, submitTask, reviewTask, rejectTask, getTaskLogs, getTaskDetails } from '../api/client';

export interface DrawerTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: number;
  assignee_id?: string;
  tags?: string;
  created_at: string;
  updated_at?: string;
  dependencies?: string[];
  references?: string[];
}

interface TaskLog {
  id: number;
  event_type: string;
  message: string | null;
  agent_id: string | null;
  created_at: string;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  TODO:    { label: '📋 待办',    color: '#94a3b8', bg: '#1e293b' },
  DOING:   { label: '🔵 进行中',  color: '#60a5fa', bg: '#1e3a5f' },
  REVIEW:  { label: '🟡 审核',    color: '#fbbf24', bg: '#3d2f00' },
  DONE:    { label: '✅ 完成',    color: '#4ade80', bg: '#14532d' },
  BLOCKED: { label: '⛔ 阻塞',   color: '#ef4444', bg: '#3b1111' },
};

const ROLE_LABELS: Record<string, string> = {
  fox_001: '🦊 青狐',
  white_fox: '🦊 白狐',
  black_fox: '🦊 黑狐',
  fox_leader: '🦊 花火',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}m 前`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h 前`;
  return d.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface TaskDrawerProps {
  taskId: string | null;
  onClose: () => void;
  onRefresh: () => void;
}

export default function TaskDrawer({ taskId, onClose, onRefresh }: TaskDrawerProps) {
  const [task, setTask] = useState<DrawerTask | null>(null);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    setError(null);

    // 并行加载任务详情和最近事件
    Promise.all([
      getTaskDetails(taskId).catch(() => null),
      getTaskLogs(taskId, 10).catch(() => null),
    ]).then(([taskData, logsData]) => {
      if (taskData) {
        setTask(taskData.data as DrawerTask);
      } else {
        // fallback: 用 getTask
        getTask(taskId).then(r => setTask(r.data as DrawerTask)).catch(() => {});
      }
      if (logsData) {
        setLogs(logsData.data ?? []);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [taskId]);

  const handleAction = async (action: 'claim' | 'submit' | 'review_pass' | 'review_fail', note?: string) => {
    if (!taskId) return;
    setActing(true);
    try {
      const agentId = localStorage.getItem('agent_id') ?? 'fox_001';
      if (action === 'claim') {
        await claimTask(taskId, { assignee_id: agentId });
      } else if (action === 'submit') {
        await submitTask(taskId, { status: 'REVIEW', note });
      } else if (action === 'review_pass') {
        await reviewTask(taskId, { result: 'pass', note });
      } else if (action === 'review_fail') {
        await rejectTask(taskId, { reason: note ?? '' });
      }
      onRefresh();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '操作失败';
      setError(msg);
    } finally {
      setActing(false);
    }
  };

  const meta = task ? (STATUS_META[task.status] ?? { label: task.status, color: '#94a3b8', bg: '#1e293b' }) : null;
  const isOpen = taskId !== null;

  return (
    <>
      {/* 遮罩 */}
      {isOpen && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 999,
          }}
          onClick={onClose}
        />
      )}

      {/* 抽屉 */}
      <div style={{
        position: 'fixed',
        top: 0, right: 0, bottom: 0,
        width: 440,
        maxWidth: '100vw',
        background: '#0f172a',
        borderLeft: '1px solid #1e293b',
        zIndex: 1000,
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* 头部 */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {meta && (
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: meta.color,
                background: `${meta.color}22`,
                padding: '3px 10px', borderRadius: 6,
                border: `1px solid ${meta.color}44`,
              }}>
                {meta.label}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid #334155',
              borderRadius: 6,
              color: '#94a3b8',
              width: 32, height: 32,
              cursor: 'pointer',
              fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* 内容 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {loading && <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>加载中...</div>}
          {error && <div style={{ color: '#ef4444', padding: 12, background: '#ef444411', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}

          {task && !loading && (
            <>
              {/* 标题 + 优先级 */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{
                    fontSize: 10,
                    background: task.priority >= 8 ? '#ef4444' : task.priority >= 5 ? '#f59e0b' : '#475569',
                    color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 600,
                  }}>
                    P{task.priority}
                  </span>
                  <span style={{ fontSize: 11, color: '#475569' }}>ID: {task.id}</span>
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0, lineHeight: 1.4 }}>
                  {task.title}
                </h2>
              </div>

              {/* 元信息 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                <div style={{ background: '#1e293b', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>负责人</div>
                  <div style={{ fontSize: 13, color: '#e2e8f0' }}>
                    {task.assignee_id ? ROLE_LABELS[task.assignee_id] ?? `🦊 ${task.assignee_id}` : '— 未分配'}
                  </div>
                </div>
                <div style={{ background: '#1e293b', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>创建时间</div>
                  <div style={{ fontSize: 13, color: '#e2e8f0' }}>{formatTime(task.created_at)}</div>
                </div>
              </div>

              {/* 描述 */}
              {task.description && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: '#475569', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>描述</div>
                  <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, background: '#1e293b', borderRadius: 8, padding: '12px 14px' }}>
                    {task.description}
                  </div>
                </div>
              )}

              {/* 标签 */}
              {task.tags && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: '#475569', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>标签</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {task.tags.split(',').map(tag => (
                      <span key={tag} style={{
                        fontSize: 11, color: 'var(--foxboard-purple, #7c3aed)',
                        background: 'rgba(124,58,237,0.15)',
                        padding: '2px 8px', borderRadius: 6,
                      }}>{tag.trim()}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* 依赖关系 */}
              {task.dependencies && task.dependencies.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: '#475569', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>依赖任务</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {task.dependencies.map(dep => (
                      <div key={dep} style={{ fontSize: 12, color: '#94a3b8', background: '#1e293b', padding: '6px 10px', borderRadius: 6 }}>
                        📌 {dep}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 最近事件 */}
              <div>
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>最近活动</div>
                {logs.length === 0 && (
                  <div style={{ color: '#334155', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>暂无事件记录</div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {logs.map(log => (
                    <div key={log.id} style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                      background: '#1e293b', borderRadius: 6, padding: '8px 12px',
                    }}>
                      <div style={{ fontSize: 12, color: '#64748b', flexShrink: 0, width: 52 }}>
                        {formatTime(log.created_at)}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
                        <span style={{ color: '#60a5fa' }}>{log.event_type}</span>
                        {log.agent_id && <span style={{ color: '#64748b' }}> · {ROLE_LABELS[log.agent_id] ?? log.agent_id}</span>}
                        {log.message && <div style={{ marginTop: 2 }}>{log.message}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 操作按钮 */}
        {task && !loading && (
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid #1e293b',
            display: 'flex', gap: 10, flexWrap: 'wrap',
            flexShrink: 0,
          }}>
            {task.status === 'TODO' && (
              <button
                onClick={() => handleAction('claim')}
                disabled={acting}
                style={{
                  flex: 1, minWidth: 100,
                  background: '#7c3aed', color: '#fff',
                  border: 'none', borderRadius: 8,
                  padding: '10px 14px', fontSize: 13, fontWeight: 600,
                  cursor: acting ? 'not-allowed' : 'pointer',
                  opacity: acting ? 0.6 : 1,
                }}
              >
                🦊 领取任务
              </button>
            )}
            {task.status === 'DOING' && (
              <button
                onClick={() => handleAction('submit')}
                disabled={acting}
                style={{
                  flex: 1, minWidth: 100,
                  background: '#f59e0b', color: '#000',
                  border: 'none', borderRadius: 8,
                  padding: '10px 14px', fontSize: 13, fontWeight: 600,
                  cursor: acting ? 'not-allowed' : 'pointer',
                  opacity: acting ? 0.6 : 1,
                }}
              >
                📮 提交审核
              </button>
            )}
            {task.status === 'REVIEW' && (
              <>
                <button
                  onClick={() => handleAction('review_pass')}
                  disabled={acting}
                  style={{
                    flex: 1, minWidth: 80,
                    background: '#10b981', color: '#fff',
                    border: 'none', borderRadius: 8,
                    padding: '10px 14px', fontSize: 13, fontWeight: 600,
                    cursor: acting ? 'not-allowed' : 'pointer',
                    opacity: acting ? 0.6 : 1,
                  }}
                >
                  ✅ 通过
                </button>
                <button
                  onClick={() => handleAction('review_fail')}
                  disabled={acting}
                  style={{
                    flex: 1, minWidth: 80,
                    background: '#ef4444', color: '#fff',
                    border: 'none', borderRadius: 8,
                    padding: '10px 14px', fontSize: 13, fontWeight: 600,
                    cursor: acting ? 'not-allowed' : 'pointer',
                    opacity: acting ? 0.6 : 1,
                  }}
                >
                  ❌ 驳回
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
