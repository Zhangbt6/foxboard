import { LayoutDashboard, Kanban, Users, GitBranch, Activity } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/kanban', icon: Kanban, label: '看板' },
  { to: '/agents', icon: Users, label: '成员状态' },
  { to: '/workflow', icon: GitBranch, label: '流程图' },
  { to: '/activity', icon: Activity, label: '事件流' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* 侧边导航 */}
      <nav style={{
        width: 220,
        background: 'var(--foxboard-surface)',
        borderRight: '1px solid var(--foxboard-border)',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {/* Logo */}
        <div style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--foxboard-purple)',
          marginBottom: 32,
          padding: '0 8px',
          letterSpacing: '0.05em',
        }}>
          🦊 FoxBoard
        </div>

        {/* Nav items */}
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                color: active ? '#fff' : '#94a3b8',
                background: active ? 'var(--foxboard-purple)' : 'transparent',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: active ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}

        {/* 版本信息 */}
        <div style={{
          marginTop: 'auto',
          padding: '0 8px',
          fontSize: 11,
          color: '#475569',
        }}>
          v0.3.0 · Phase 3
        </div>
      </nav>

      {/* 主内容区 */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
