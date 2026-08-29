import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  FileCode,
  Terminal,
  Play,
  XCircle,
  Zap,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ExternalLink,
  Check,
  Eye,
  ShieldCheck,
  FolderLock
} from 'lucide-react';
import type { AgentAction } from '../services/agentLoop';

interface ActionApprovalModalProps {
  isOpen: boolean;
  actions: AgentAction[];
  onApproveAll: (approvedActionIds: string[], trustGlob?: string) => void;
  onRejectAll: () => void;
  onOpenFile?: (filePath: string) => void;
}

export const ActionApprovalModal: React.FC<ActionApprovalModalProps> = ({
  isOpen,
  actions,
  onApproveAll,
  onRejectAll,
  onOpenFile
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [trustScopeChecked, setTrustScopeChecked] = useState(false);

  // Initialize selected IDs to all actions
  useEffect(() => {
    if (actions && actions.length > 0) {
      setSelectedIds(new Set(actions.map(a => a.id)));
      setExpandedId(actions[0]?.id || null);
    }
  }, [actions]);

  // Compute common directory for scope trust option (e.g. "src/**")
  const commonScopeGlob = React.useMemo(() => {
    const writeActions = actions.filter(a => a.type === 'write_file');
    if (writeActions.length === 0) return 'src/**';
    const firstTarget = writeActions[0].target.replace(/\\/g, '/');
    const parts = firstTarget.split('/');
    if (parts.length > 1) {
      return `${parts[0]}/**`;
    }
    return '*';
  }, [actions]);

  const hasHighRisk = actions.some(a => a.isHighRisk);

  // Keyboard Shortcuts (Enter = Approve Selected, Esc = Reject All)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || actions.length === 0 || isExecuting) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onRejectAll();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        setIsExecuting(true);
        onApproveAll(Array.from(selectedIds), trustScopeChecked ? commonScopeGlob : undefined);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, actions, selectedIds, isExecuting, onApproveAll, onRejectAll, trustScopeChecked, commonScopeGlob]);

  useEffect(() => {
    setIsExecuting(false);
  }, [isOpen]);

  if (!isOpen || actions.length === 0) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const activeExpandedAction = actions.find(a => a.id === expandedId) || actions[0];

  return (
    <div style={{
      position: 'fixed',
      bottom: '90px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'min(780px, calc(100vw - 32px))',
      zIndex: 999,
      background: 'var(--bg-surface-elevated)',
      border: hasHighRisk ? '2px solid #EF4444' : '2px solid var(--accent)',
      borderRadius: '12px',
      boxShadow: hasHighRisk
        ? '0 16px 48px rgba(239, 68, 68, 0.28), 0 0 0 1px rgba(239, 68, 68, 0.4)'
        : '0 16px 48px rgba(217, 107, 39, 0.24), 0 0 0 1px rgba(217, 107, 39, 0.3)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'text',
      WebkitUserSelect: 'text'
    }}>
      {/* 1. Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: hasHighRisk
          ? 'linear-gradient(90deg, rgba(239, 68, 68, 0.15) 0%, rgba(255, 255, 255, 0.02) 100%)'
          : 'linear-gradient(90deg, rgba(217, 107, 39, 0.15) 0%, rgba(255, 255, 255, 0.02) 100%)',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {hasHighRisk ? (
            <AlertTriangle size={18} color="#EF4444" />
          ) : (
            <ShieldAlert size={18} color="var(--accent)" />
          )}
          <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-strong)' }}>
            本轮将执行 {actions.length} 项变更
          </span>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '10px',
            background: 'var(--accent-subtle)',
            color: 'var(--accent)'
          }}>
            已选中 {selectedIds.size} / {actions.length} 项
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <span>Enter 确认执行 · Esc 全部放弃</span>
        </div>
      </div>

      {/* 2. Action Items Checklist */}
      <div style={{
        padding: '10px 16px',
        maxHeight: '170px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        background: 'var(--bg-surface)'
      }}>
        {actions.map((act) => {
          const isSelected = selectedIds.has(act.id);
          const isExpanded = expandedId === act.id;
          const isWrite = act.type === 'write_file';

          return (
            <div
              key={act.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderRadius: '6px',
                background: isExpanded ? 'var(--bg-surface-elevated)' : 'transparent',
                border: isExpanded ? '1px solid var(--border-strong)' : '1px solid transparent',
                fontSize: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(act.id)}
                  style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
                />
                <span style={{
                  color: isWrite ? '#3B82F6' : '#10B981',
                  fontWeight: 700,
                  fontSize: '11px',
                  width: '32px'
                }}>
                  {isWrite ? '写入' : '运行'}
                </span>

                <span
                  onClick={() => onOpenFile && isWrite && onOpenFile(act.target)}
                  title={act.target}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                    textDecoration: isSelected ? 'none' : 'line-through',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    cursor: isWrite ? 'pointer' : 'default',
                    fontWeight: 600
                  }}
                >
                  {act.target}
                </span>

                {act.isHighRisk && act.riskReason && (
                  <span style={{
                    fontSize: '11px',
                    color: '#DC2626',
                    background: 'rgba(239, 68, 68, 0.1)',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    marginLeft: '4px'
                  }}>
                    ⚠ {act.riskReason}
                  </span>
                )}
              </div>

              <button
                onClick={() => setExpandedId(isExpanded ? null : act.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  padding: '2px 6px'
                }}
              >
                <Eye size={12} />
                <span>{isExpanded ? '收起' : '预览'}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* 3. Code/Command Scrollable Preview (Selectable & Copyable) */}
      {activeExpandedAction && (
        <div style={{
          margin: '0 16px 8px',
          maxHeight: '150px',
          overflowY: 'auto',
          background: '#0B1120',
          borderRadius: '6px',
          border: '1px solid #1E293B',
          padding: '8px 12px',
          fontSize: '11.5px',
          fontFamily: 'Consolas, "Fira Code", Monaco, monospace',
          color: '#E2E8F0',
          lineHeight: 1.5,
          whiteSpace: 'pre',
          userSelect: 'text',
          WebkitUserSelect: 'text',
          cursor: 'text'
        }}>
          {activeExpandedAction.code}
        </div>
      )}

      {/* 4. Action Buttons & Scoped Trust Option */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-base)'
      }}>
        {/* Left: Scoped Trust Checkbox */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={trustScopeChecked}
            onChange={(e) => setTrustScopeChecked(e.target.checked)}
            style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
          />
          <FolderLock size={13} color="var(--accent)" />
          <span>记住授权：后续自动允许写 <strong>{commonScopeGlob}</strong></span>
        </label>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={onRejectAll}
            disabled={isExecuting}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            全部放弃 (Esc)
          </button>

          <button
            onClick={() => {
              setIsExecuting(true);
              onApproveAll(Array.from(selectedIds), trustScopeChecked ? commonScopeGlob : undefined);
            }}
            disabled={isExecuting || selectedIds.size === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 16px',
              borderRadius: '6px',
              background: 'var(--accent)',
              border: 'none',
              color: '#FFF',
              fontSize: '12px',
              fontWeight: 700,
              cursor: isExecuting ? 'default' : 'pointer',
              boxShadow: '0 2px 8px rgba(217, 107, 39, 0.3)'
            }}
          >
            <Play size={12} fill="#FFF" />
            <span>执行选中项 ({selectedIds.size}) ↵</span>
          </button>
        </div>
      </div>
    </div>
  );
};
