import { useEffect, useState } from 'react';
import { getProjects, createProject, deleteProject, getTasks, getPhases, getPhaseTasks, getArchivedTasks } from '../api/client';
import { useProject } from '../contexts/ProjectContext';

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  owner?: string;
  created_at?: string;
}

interface Phase {
  id: string;
  project_id: string;
  name: string;
  version?: string;
  description?: string;
  status: string;
  goals?: string;
  task_count: number;
  done_count: number;
  archived_count: number;
}

interface Task {
  id: string;
  title: string;
  status: string;
  archived_at?: string;
  archive_phase?: string;
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

const PHASE_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  planning:  { label: '⏳ 规划中', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
  active:   { label: '🚀 进行中', color: '#4ade80', bg: 'rgba(74,222,128,0.15)' },
  completed: { label: '✅ 已完成', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  cancelled: { label: '❌ 已取消', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
};

const FOX_COLORS = ['#7c3aed', '#ec4899', '#06b6d4', '#f59e0b', '#10b981', '#ef4444'];

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 4, background: '#2d2d44', borderRadius: 2 }}>
      <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.3s' }} />
    </div>
  );
}

function PhaseCard({ phase, onBack }: { phase: Phase; onBack: () => void }) {
  const [tasksExpanded, setTasksExpanded] = useState(false);
  const [archivedExpanded, setArchivedExpanded] = useState(false);
  const [phaseTasks, setPhaseTasks] = useState<Task[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const meta = PHASE_STATUS_META[phase.status] ?? PHASE_STATUS_META['planning'];

  const progress = phase.task_count > 0
    ? Math.round((phase.done_count / phase.task_count) * 100)
    : 0;

  let goals: string[] = [];
  try {
    goals = phase.goals ? JSON.parse(phase.goals) : [];
  } catch { goals = []; }

  const loadTasks = () => {
    getPhaseTasks(phase.id).then(r => setPhaseTasks(r.data)).catch(() => {});
    getArchivedTasks({ phase_id: phase.id }).then(r => setArchivedTasks(r.data)).catch(() => {});
  };

  return (
    <div style={{
      background: 'var(--foxboard-surface)',
      border: '1px solid var(--foxboard-border)',
      borderRadius: 16,
      padding: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9' }}>{phase.name}</span>
            {phase.version && (
              <span style={{ fontSize: 10, color: '#64748b', background: '#1e293b', padding: '2px 6px', borderRadius: 4 }}>
                {phase.version}
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, background: meta.bg, color: meta.color, padding: '2px 8px', borderRadius: 4, display: 'inline-block' }}>
            {meta.label}
          </div>
        </div>
        <button onClick={onBack} style={{
          background: 'transparent', border: '1px solid var(--foxboard-border)',
          color: '#94a3b8', borderRadius: 6, padding: '4px 10px',
          cursor: 'pointer', fontSize: 11,
        }}>← 返回</button>
      </div>

      {/* Description */}
      {phase.description && (
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 1.5 }}>
          {phase.description}
        </div>
      )}

      {/* Goals */}
      {goals.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 6 }}>🎯 目标</div>
          {goals.map((g, i) => (
            <div key={i} style={{ fontSize: 12, color: '#94a3b8', padding: '2px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
              {i < phase.done_count ? '✅' : '⬜'} {g}
            </div>
          ))}
        </div>
      )}

      {/* Progress */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: '#475569' }}>进度</span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
            {phase.done_count}/{phase.task_count} ({progress}%)
          </span>
        </div>
        <div style={{ height: 6, background: '#1e293b', borderRadius: 3 }}>
          <div style={{ width: `${progress}%`, height: '100%', background: meta.color, borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => { setTasksExpanded(v => !v); if (!tasksExpanded) loadTasks(); }}
          style={{
            flex: 1,
            background: tasksExpanded ? 'rgba(124,58,237,0.2)' : 'rgba(124,58,237,0.1)',
            color: '#a78bfa',
            border: '1px solid rgba(124,58,237,0.3)',
            borderRadius: 6, padding: '6px 0',
            cursor: 'pointer', fontSize: 12,
          }}
        >
          📋 查看任务 ({phase.task_count - phase.archived_count})
        </button>
        {phase.archived_count > 0 && (
          <button
            onClick={() => { setArchivedExpanded(v => !v); if (!archivedExpanded) loadTasks(); }}
            style={{
              flex: 1,
              background: archivedExpanded ? 'rgba(148,163,184,0.2)' : 'rgba(148,163,184,0.1)',
              color: '#94a3b8',
              border: '1px solid rgba(148,163,184,0.3)',
              borderRadius: 6, padding: '6px 0',
              cursor: 'pointer', fontSize: 12,
            }}
          >
            📦 已归档 ({phase.archived_count})
          </button>
        )}
      </div>

      {/* Tasks List */}
      {tasksExpanded && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--foxboard-border)', paddingTop: 12 }}>
          {phaseTasks.filter(t => !t.archived_at).map(t => (
            <div key={t.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 0', borderBottom: '1px solid #1e293b',
            }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{t.id} — {t.title}</span>
              <span style={{ fontSize: 10, color: '#64748b', background: '#1e293b', padding: '2px 6px', borderRadius: 3 }}>
                {t.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Archived Tasks */}
      {archivedExpanded && archivedTasks.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--foxboard-border)', paddingTop: 12 }}>
          {archivedTasks.map(t => (
            <div key={t.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 0', borderBottom: '1px solid #1e293b',
              opacity: 0.6,
            }}>
              <span style={{ fontSize: 12, color: '#64748b', textDecoration: 'line-through' }}>
                {t.id} — {t.title}
              </span>
              <span style={{ fontSize: 10, color: '#475569' }}>
                📦 {t.archive_phase}
              </span>
            </div>
          ))}
        </div>
      )}
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
  const [phases, setPhases] = useState<Phase[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
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

  const loadPhases = (projectId: string) => {
    getPhases(projectId)
      .then(r => setPhases(r.data))
      .catch(() => {});
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (selectedProject) {
      loadPhases(selectedProject.id);
    }
  }, [selectedProject]);

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

  const handleProjectSelect = (p: Project) => {
    setSelectedProject(p);
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
    setPhases([]);
  };

  return (
    <div style={{ padding: 32 }}>
      {/* Phase List View */}
      {selectedProject ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <button onClick={handleBackToProjects} style={{
                background: 'transparent', border: 'none', color: '#94a3b8',
                cursor: 'pointer', fontSize: 12, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4,
              }}>← 返回项目列表</button>
              <h1 style={{ fontSize: 24, fontWeight: 700 }}>🚀 {selectedProject.name} — Phases</h1>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{selectedProject.description || '项目阶段列表'}</div>
            </div>
          </div>
          {phases.length === 0 ? (
            <div style={{ color: '#475569', textAlign: 'center', padding: 48 }}>
              暂无 Phase，点击「新建项目」创建
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
              {phases.map(p => (
                <PhaseCard key={p.id} phase={p} onBack={handleBackToProjects} />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Project List View */}
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
                    border: '1px solid var(--foxboard-border)',
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
                <ProjectCard key={p.id} project={p} onSelect={handleProjectSelect} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
