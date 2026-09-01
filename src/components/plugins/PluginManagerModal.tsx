import React from 'react';
import { X, Cpu, CheckCircle2, Box, ExternalLink } from 'lucide-react';
import type { PluginMetadata, ToolSchema } from '../../types';

interface PluginManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  plugins: PluginMetadata[];
  tools: ToolSchema[];
}

export const PluginManagerModal: React.FC<PluginManagerModalProps> = ({
  isOpen,
  onClose,
  plugins,
  tools,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
      }}
    >
      <div
        style={{
          width: '680px',
          maxHeight: '80vh',
          background: 'var(--bg-base)',
          borderRadius: '12px',
          border: '1px solid var(--border-strong)',
          boxShadow: '0 12px 36px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={18} color="var(--accent)" />
            <span style={{ fontWeight: 700, fontSize: '15px' }}>能力插件管理中心 (Tool / Skill Rail)</span>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            系统已挂载的能力插件列表（所有能力均基于标准 Trait / MCP 协议即插即用）：
          </div>

          {plugins.map((plugin) => (
            <div
              key={plugin.id}
              style={{
                padding: '14px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    background: plugin.is_builtin ? 'var(--accent-subtle)' : 'var(--bg-surface-elevated)',
                    color: plugin.is_builtin ? 'var(--accent)' : 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Box size={16} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                      {plugin.name}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: plugin.is_builtin ? 'var(--status-safe)' : 'var(--accent)',
                        color: '#FFFFFF',
                        fontWeight: 600,
                      }}
                    >
                      {plugin.is_builtin ? '内置原生' : 'MCP 协议'}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>v{plugin.version}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {plugin.description}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--status-safe)', fontSize: '12px', fontWeight: 600 }}>
                <CheckCircle2 size={14} />
                <span>已挂载</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
