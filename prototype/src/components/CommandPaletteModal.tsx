import React, { useState, useEffect } from 'react';
import { Search, FileCode, Zap, Check, Sparkles, Terminal, Shield, ArrowRight, X } from 'lucide-react';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'files' | 'commands';
  onOpenFile?: (path: string) => void;
  onRunAction?: (actionId: string) => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  mode,
  onOpenFile,
  onRunAction
}) => {
  // Universal ESC key support
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  if (!isOpen) return null;

  const fileItems = [
    { id: 'f1', name: 'contracts.ts', path: 'prototype/src/types/contracts.ts', type: 'typescript', desc: '核心数据契约与纯函数' },
    { id: 'f2', name: 'ChatColumn.tsx', path: 'prototype/src/components/ChatColumn.tsx', type: 'react', desc: '主对话流与流体 Ribbon' },
    { id: 'f3', name: 'EditorWorkspace.tsx', path: 'prototype/src/components/EditorWorkspace.tsx', type: 'react', desc: 'Zed 级高精工作台' },
    { id: 'f4', name: 'OptionsCard.tsx', path: 'prototype/src/components/OptionsCard.tsx', type: 'react', desc: '人机协同动态决策分叉卡片' },
    { id: 'f5', name: 'PRODUCT_REQUIREMENTS_DOCUMENT.md', path: 'docs/PRODUCT_REQUIREMENTS_DOCUMENT.md', type: 'doc', desc: '完整产品需求规约' }
  ];

  const commandItems = [
    { id: 'run-ci', title: '🚀 运行本地 CI 预检门禁与覆盖率分析', shortcut: 'Ctrl+Shift+T', icon: Shield },
    { id: 'split-commits', title: '📦 意图智能拆分 Conventional Commits', shortcut: 'Ctrl+Shift+C', icon: Zap },
    { id: 'toggle-swarm', title: '🐝 切换为 Swarm 协同蜂群 (R1+Sonnet+GLM)', shortcut: 'Ctrl+Shift+S', icon: Sparkles },
    { id: 'add-rule', title: '💡 沉淀当前会话纠错经验至 .codemind/lessons.md', shortcut: 'Ctrl+Shift+L', icon: FileCode },
    { id: 'toggle-vim', title: '⌨️ 切换 Vim Mode 极客编辑模式 (Normal/Insert)', shortcut: 'Ctrl+Shift+V', icon: Terminal }
  ];

  const filteredFiles = fileItems.filter(f => f.name.toLowerCase().includes(query.toLowerCase()) || f.path.toLowerCase().includes(query.toLowerCase()));
  const filteredCommands = commandItems.filter(c => c.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.45)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: '10vh',
      zIndex: 1000
    }}>
      <div style={{
        width: '580px',
        maxHeight: '440px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Search Header */}
        <div style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Search size={16} color="var(--accent)" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={mode === 'files' ? '快速跳转文件 (输入文件名或路径)...' : '执行全局 AI 指令与工作流动作...'}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '13px',
              color: 'var(--text-primary)',
              fontFamily: 'inherit'
            }}
          />
          <span style={{ fontSize: '10px', padding: '2px 5px', borderRadius: '3px', background: 'var(--bg-base)', color: 'var(--text-muted)' }}>
            ESC 关闭
          </span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>

        {/* Results List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
          {mode === 'files' ? (
            filteredFiles.map((file, idx) => (
              <div
                key={file.id}
                onClick={() => {
                  if (onOpenFile) onOpenFile(file.path);
                  onClose();
                }}
                style={{
                  padding: '8px 10px',
                  borderRadius: '5px',
                  background: idx === selectedIndex ? 'rgba(217, 107, 39, 0.12)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileCode size={14} color="var(--accent)" />
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{file.name}</div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{file.path}</div>
                  </div>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{file.desc}</span>
              </div>
            ))
          ) : (
            filteredCommands.map((cmd, idx) => {
              const IconComp = cmd.icon;
              return (
                <div
                  key={cmd.id}
                  onClick={() => {
                    if (onRunAction) onRunAction(cmd.id);
                    onClose();
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '5px',
                    background: idx === selectedIndex ? 'rgba(217, 107, 39, 0.12)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IconComp size={14} color="var(--accent)" />
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cmd.title}</span>
                  </div>
                  <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: 'var(--bg-base)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {cmd.shortcut}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hint */}
        <div style={{
          padding: '6px 12px',
          background: 'var(--bg-base)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: 'var(--text-muted)'
        }}>
          <span>↑↓ 导航选择 · Enter 确认执行</span>
          <span>Tab 切换文件/指令中心</span>
        </div>
      </div>
    </div>
  );
};
