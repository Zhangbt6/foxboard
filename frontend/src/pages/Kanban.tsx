import { useEffect, useState } from 'react';
import { getKanban, updateTask } from '../api/client';

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

interface Column {
  status: string;
  tasks: Task[];
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  TODO:    { label: '📋 待办',    color: '#94a3b8', bg: '#1e293b' },
  DOING:   { label: '🔵 进行中',  color: '#60a5fa', bg: '#1e3a5f' },
  REVIEW:  { label: '🟡 审核',    color: '#fbbf24', bg: '#3d2f00' },
  DONE:    { label: '✅ 完成',    color: '#4ade80', bg: '#14532d' },
};

const NEXT_STATUS: Record<string, string> = {
  TODO: 'DOING',
  DOING: 'REVIEW',
  REVIEW: 'DONE',
};

export default function Kanban() {
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    getKanban()
      .then(r => setColumns(r.data.columns))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const advanceTask = async (task: Task) => {
    const next = NEXT_STATUS[task.status];
    if (!next) return;
    await updateTask(task.id, { status: next });
    load();
  };

  if (loading) return <div style={{ padding: 32, color: '#94a3b8' }}>加载中...</div>;

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>任务看板</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, alignItems: 'flex-start' }}>
        {columns.map(col => {
          const meta = STATUS_META[col.status] ?? { label: col.status, color: '#94a3b8', bg: '#1e293b' };
          return (
            <div key={col.status}>
              {/* 列头 */}
              <div style={{
                padding: '12px 16px',
                borderRadius: '8px 8px 0 0',
                background: meta.bg,
                borderBottom: `2px solid ${meta.color}`,
                marginBottom: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: meta.color, fontWeight: 600, fontSize: 14 }}>{meta.label}</span>
                  <span style={{ background: meta.color, color: '#000', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                    {col.tasks.length}
                  </span>
                </div>
              </div>

              {/* 卡片列表 */}
              <div style={{
                background: '#111827',
                borderRadius: '0 0 8px 8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                minHeight: 200,
              }}>
                {col.tasks.length === 0 && (
                  <div style={{ color: '#374151', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>空</div>
                )}
                {col.tasks.map(task => (
                  <div key={task.id} style={{
                    background: 'var(--foxboard-surface)',
                    border: '1px solid var(--foxboard-border)',
                    borderRadius: 8,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    transition: 'transform 0.1s',
                  }}
                    onClick={() => advanceTask(task)}
                    title={`点击推进到下一阶段: ${NEXT_STATUS[task.status] ?? '(已是终态)'}`}
                  >
                    {/* 优先级标签 */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{
                        fontSize: 10,
                        background: task.priority >= 8 ? '#ef4444' : task.priority >= 5 ? '#f59e0b' : '#475569',
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontWeight: 600,
                      }}>
                        P{task.priority}
                      </span>
                      <span style={{ fontSize: 10, color: '#475569' }}>
                        {task.assignee_id ? `🦊 ${task.assignee_id}` : '未分配'}
                      </span>
                    </div>
                    {/* 标题 */}
                    <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.4 }}>{task.title}</div>
                    {/* 标签 */}
                    {task.tags && (
                      <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {task.tags.split(',').map(tag => (
                          <span key={tag} style={{ fontSize: 10, color: 'var(--foxboard-purple)', background: 'rgba(124,58,237,0.15)', padding: '1px 6px', borderRadius: 4 }}>{tag.trim()}</span>
                        ))}
                      </div>
                    )}
                    {/* 推进提示 */}
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
    </div>
  );
}
