import { useEffect, useState } from 'react';
import { getProjects, createProject, deleteProject, getTasks } from '../api/client';
import { useProject } from '../contexts/ProjectContext';

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  owner?: string;
  created_at?: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
}

interface TaskSummary {
  total: number;
  done: number;
  blocked: number;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active:   { label: '● 活跃',    color: '#4ade80', bg: 'rgba(74,222,128,0.15)' },
  paused:  { label: '⏸ 暂停',    color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  archived: { label: '📦 已归档', color: '#64748b', bg: '#2d2d44' },
};

const FOX_COLORS = ['#7c3aed', '#ec4899', '#06b6d4', '#f59e0b', '#10b981', '#ef4444'];

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 4, background: '#2d2d44', borderRadius: 2 }}>
      <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.3s' }} />
    </div>
  );
}

function ProjectCard({ project, onSelect }: { project: Project; onSelect: (p: Project) => void }) {
  const { currentProject, setCurrentProject } = useProject();
  const isActive = currentProject?.id === project.id;
  const meta = STATUS_META[project.status] ?? STATUS_META['active'];
  const [taskSummary, setTaskSummary] = useState<TaskSummary | null>(null);

  useEffect(() => {
    getTasks({ project_id: project.id })
      .then(r => {
        const tasks = r.data as Task[];
        const total = tasks.length;
        const done = tasks.filter(t => t.status === 'DONE').length;
        const blocked = tasks.filter(t => t.status === 'BLOCKED').length;
        setTaskSummary({ total, done, blocked });
      })
      .catch(() => {});
  }, [project.id]);

  const progress = taskSummary && taskSummary.total > 0
    ? Math.round((taskSummary.done / taskSummary.total) * 100)
    : taskSummary ? 0 : null;

  const handleSelect = () => {
    setCurrentProject(project);
    onSelect(project);
  };

  const ownerColor = FOX_COLORS[project.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % FOX_COLORS.length];

  return (
    <div style={{
      background: 'var(--foxboard-surface)',
      border: `1px solid ${isActive ? 'var(--foxboard-purple)' : 'var(--foxboard-border)'}`,
      borderRadius: 16,
      padding: 20,
      transition: 'border-color 0.15s',
      boxShadow: isActive ? '0 0 16px rgba(124,58,237,0.2)' : 'none',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>{project.name}</div>
          <div style={{ fontSize: 10, background: meta.bg, color: meta.color, padding: '2px 8px', borderRadius: 4, display: 'inline-block' }}>
            {meta.label}
          </div>
        </div>
        {isActive && (
          <div style={{ fontSize: 10, color: 'var(--foxboard-purple)', background: 'rgba(124,58,237,0.15)', padding: '2px 8px', borderRadius: 4 }}>
            当前选中
          </div>
        )}
      </div>

      {/* Description */}
      {project.description && (
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 1.5 }}>
          {project.description}
        </div>
      )}

      {/* Owner */}
      {project.owner && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            background: `${ownerColor}33`,
            border: `1px solid ${ownerColor}66`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10,
          }}>🦊</div>
          <span style={{ fontSize: 11, color: '#475569' }}>{project.owner}</span>
        </div>
      )}

      {/* Progress */}
      {taskSummary !== null && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: '#475569' }}>项目进度</span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              {taskSummary.done}/{taskSummary.total}
              {progress !== null && ` (${progress}%)`}
            </span>
          </div>
          <ProgressBar value={progress ?? 0} color={taskSummary.blocked > 0 ? '#ef4444' : 'var(--foxboard-purple)'} />
          {taskSummary.blocked > 0 && (
            <div style={{ fontSize: 10, color: '#ef4444', marginTop: 4 }}>⚠️ {taskSummary.blocked} 个阻塞任务</div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          onClick={handleSelect}
          style={{
            flex: 1,
            background: isActive ? 'rgba(124,58,237,0.15)' : 'rgba(124,58,237,0.25)',
            color: '#a78bfa',
            border: `1px solid ${isActive ? 'rgba(124,58,237,0.3)' : 'rgba(124,58,237,0.5)'}`,
            borderRadius: 6,
            padding: '6px 0',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {isActive ? '✓ 查看看板' : '进入看板'}
        </button>
        <button
          onClick={() => {
            if (!confirm('确认删除该项目？')) return;
            deleteProject(project.id).catch(() => {});
            setCurrentProject(null);
          }}
          style={{
            background: 'rgba(239,68,68,0.1)',
            color: '#f87171',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 6,
            padding: '6px 10px',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          删除
        </button>
      </div>
    </div>
  );
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newOwner, setNewOwner] = useState('');

  const load = () => {
    setLoading(true);
    getProjects()
      .then(r => setProjects(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const id = 'proj_' + Date.now();
    await createProject({
      id,
      name: newName.trim(),
      description: newDesc.trim(),
      owner: newOwner.trim() || undefined,
    });
    setNewName('');
    setNewDesc('');
    setNewOwner('');
    setShowForm(false);
    load();
  };

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>📁 项目列表</h1>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>切换项目以过滤全局视图</div>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{
            background: 'var(--foxboard-purple)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          + 新建项目
        </button>
      </div>

      {showForm && (
        <div style={{
          background: 'var(--foxboard-surface)',
          border: '1px solid var(--foxboard-border)',
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: 12 }}>新建项目</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              placeholder="项目名称 *"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              style={{
                background: '#111827',
                border: '1px solid var(--foxboard-border)',
                borderRadius: 6,
                padding: '8px 12px',
                color: '#e2e8f0',
                fontSize: 13,
              }}
            />
            <input
              placeholder="项目描述（可选）"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              style={{
                background: '#111827',
                border: '1px solid var(--foxboard-border)',
                borderRadius: 6,
                padding: '8px 12px',
                color: '#e2e8f0',
                fontSize: 13,
              }}
            />
            <input
              placeholder="负责人（可选）"
              value={newOwner}
              onChange={e => setNewOwner(e.target.value)}
              style={{
                background: '#111827',
                border: '1px solid var(--foxboard-border',
                borderRadius: 6,
                padding: '8px 12px',
                color: '#e2e8f0',
                fontSize: 13,
              }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleCreate}
                style={{
                  background: 'var(--foxboard-purple)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                创建
              </button>
              <button
                onClick={() => setShowForm(false)}
                style={{
                  background: 'transparent',
                  color: '#94a3b8',
                  border: '1px solid var(--foxboard-border)',
                  borderRadius: 6,
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: '#94a3b8' }}>加载中...</div>
      ) : projects.length === 0 ? (
        <div style={{ color: '#475569', textAlign: 'center', padding: 48 }}>
          暂无项目，点击右上角「新建项目」创建第一个项目
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {projects.map(p => (
            <ProjectCard key={p.id} project={p} onSelect={() => {}} />
          ))}
        </div>
      )}
    </div>
  );
}
