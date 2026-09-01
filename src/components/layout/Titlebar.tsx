import React from 'react';
import { Cpu, ShieldCheck, Sparkles, Sun, Moon } from 'lucide-react';

interface TitlebarProps {
  theme: string;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenPlugins: () => void;
  pluginCount: number;
}

export const Titlebar: React.FC<TitlebarProps> = ({
  theme,
  onToggleTheme,
  onOpenSettings,
  onOpenPlugins,
  pluginCount,
}) => {
  return (
    <header
      style={{
        height: '42px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '13px',
          }}
        >
          T
        </div>
        <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '-0.2px' }}>
          Tcode <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>Studio v2.0</span>
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            background: 'var(--accent-subtle)',
            color: 'var(--accent)',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 600,
          }}
        >
          <ShieldCheck size={12} />
          Rail-Protected
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={onOpenPlugins}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-base)',
            color: 'var(--text-primary)',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          <Cpu size={13} color="var(--accent)" />
          <span>能力插件 ({pluginCount})</span>
        </button>

        <button
          onClick={onOpenSettings}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-base)',
            color: 'var(--text-primary)',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          <Sparkles size={13} color="var(--accent)" />
          <span>模型网关 v2</span>
        </button>

        <button
          onClick={onToggleTheme}
          title="切换色彩主题"
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-base)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </header>
  );
};
