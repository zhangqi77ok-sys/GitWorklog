import React from 'react';
import { MessageSquare, FolderTree, Cpu, Settings, Terminal, Shield } from 'lucide-react';

export type ActiveTab = 'chat' | 'files' | 'plugins' | 'settings' | 'terminal';

interface ActivityBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({ activeTab, onSelectTab }) => {
  const items: { id: ActiveTab; icon: React.ReactNode; label: string }[] = [
    { id: 'chat', icon: <MessageSquare size={18} />, label: '智能会话' },
    { id: 'files', icon: <FolderTree size={18} />, label: '工作区' },
    { id: 'plugins', icon: <Cpu size={18} />, label: '能力插件' },
    { id: 'terminal', icon: <Terminal size={18} />, label: '终端' },
    { id: 'settings', icon: <Settings size={18} />, label: '设置' },
  ];

  return (
    <aside
      style={{
        width: '48px',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 0',
        gap: '8px',
        flexShrink: 0,
      }}
    >
      {items.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            title={item.label}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: 'none',
              background: isActive ? 'var(--accent-subtle)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {item.icon}
          </button>
        );
      })}

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          title="5 大安全执行轨道已就绪 (Rails Active)"
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'var(--status-safe)',
            opacity: 0.85,
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Shield size={14} />
        </div>
      </div>
    </aside>
  );
};
