import { useEffect, useState } from 'react';
import { getProjects, getProject } from '../api/client';
import { useProject } from '../contexts/ProjectContext';

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  owner?: string;
}

export default function ProjectSelector() {
  const { currentProject, setCurrentProject } = useProject();
  const [projects, setProjects] = useState<Project[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getProjects()
      .then(r => setProjects(r.data))
      .catch(() => {});
  }, []);

  const handleSelect = async (projectId: string) => {
    if (projectId === '__all__') {
      setCurrentProject(null);
      setOpen(false);
      return;
    }
    try {
      const r = await getProject(projectId);
      setCurrentProject(r.data);
    } finally {
      setOpen(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          background: 'var(--foxboard-surface)',
          border: '1px solid var(--foxboard-border)',
          borderRadius: 8,
          padding: '5px 12px',
          color: '#e2e8f0',
          fontSize: 13,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ fontSize: 14 }}>📁</span>
        <span>{currentProject ? currentProject.name : '全部项目'}</span>
        <span style={{ fontSize: 10, color: '#64748b' }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 6,
          background: 'var(--foxboard-surface)',
          border: '1px solid var(--foxboard-border)',
          borderRadius: 10,
          padding: '6px',
          minWidth: 200,
          zIndex: 1000,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          <div
            onClick={() => handleSelect('__all__')}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              color: !currentProject ? '#a78bfa' : '#94a3b8',
              fontWeight: !currentProject ? 600 : 400,
              background: !currentProject ? 'rgba(124,58,237,0.1)' : 'transparent',
            }}
          >
            🌐 全部项目
          </div>
          {projects.map(p => (
            <div
              key={p.id}
              onClick={() => handleSelect(p.id)}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
                color: currentProject?.id === p.id ? '#a78bfa' : '#94a3b8',
                fontWeight: currentProject?.id === p.id ? 600 : 400,
                background: currentProject?.id === p.id ? 'rgba(124,58,237,0.1)' : 'transparent',
              }}
            >
              📁 {p.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
