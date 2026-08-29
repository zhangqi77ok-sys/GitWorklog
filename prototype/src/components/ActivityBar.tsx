import React from 'react';
import { MessageSquare, FolderTree, Search, GitBranch, Cpu, Settings, BookOpen } from 'lucide-react';

interface ActivityBarProps {
  activeNav: string;
  setActiveNav: (nav: string) => void;
  onOpenSettings: () => void;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({ activeNav, setActiveNav, onOpenSettings }) => {
  const navItems = [
    { id: 'sessions', icon: MessageSquare, label: '会话管理' },
    { id: 'files', icon: FolderTree, label: '项目代码' },
    { id: 'search', icon: Search, label: '全局检索' },
    { id: 'git', icon: GitBranch, label: 'Git 影子快照' },
    { id: 'rules', icon: BookOpen, label: '规则与经验库' },
    { id: 'gateway', icon: Cpu, label: '模型网关' },
  ];

  return (
    <aside style={{
      width: '42px',
      height: 'calc(100vh - 38px)',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      zIndex: 20
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              title={item.label}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: 'none',
                background: isActive ? 'var(--accent-subtle)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={18} />
            </button>
          );
        })}
      </div>

      <button
        onClick={onOpenSettings}
        title="设置与首选项"
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '6px',
          border: 'none',
          background: activeNav === 'settings' ? 'var(--accent-subtle)' : 'transparent',
          color: activeNav === 'settings' ? 'var(--accent)' : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer'
        }}
      >
        <Settings size={18} />
      </button>
    </aside>
  );
};
