import { useEffect, useState } from 'react';
import { getProjects, createProject, deleteProject } from '../api/client';
import { useProject } from '../contexts/ProjectContext';

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  owner?: string;
  created_at?: string;
}

export default function Projects() {
  const { setCurrentProject } = useProject();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

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
    await createProject({ id, name: newName.trim(), description: newDesc.trim() });
    setNewName('');
    setNewDesc('');
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除该项目？')) return;
    await deleteProject(id);
    setCurrentProject(null);
    load();
  };

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>📁 项目列表</h1>
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
              placeholder="项目名称"
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
        <div style={{ color: '#475569', textAlign: 'center', padding: 48 }}>暂无项目</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {projects.map(p => (
            <div key={p.id} style={{
              background: 'var(--foxboard-surface)',
              border: '1px solid var(--foxboard-border)',
              borderRadius: 12,
              padding: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9' }}>{p.name}</div>
                <div style={{
                  fontSize: 10,
                  background: p.status === 'active' ? 'rgba(74,222,128,0.15)' : '#2d2d44',
                  color: p.status === 'active' ? '#4ade80' : '#64748b',
                  padding: '2px 8px',
                  borderRadius: 4,
                }}>
                  {p.status === 'active' ? '● 活跃' : p.status}
                </div>
              </div>
              {p.description && (
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 1.5 }}>
                  {p.description}
                </div>
              )}
              {p.owner && (
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 12 }}>
                  负责人：{p.owner}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setCurrentProject(p)}
                  style={{
                    flex: 1,
                    background: 'rgba(124,58,237,0.15)',
                    color: '#a78bfa',
                    border: '1px solid rgba(124,58,237,0.3)',
                    borderRadius: 6,
                    padding: '6px 0',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  查看看板
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
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
          ))}
        </div>
      )}
    </div>
  );
}
