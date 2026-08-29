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
  Code2
} from 'lucide-react';
import { AgentPendingAction } from '../types/contracts';

interface ActionApprovalModalProps {
  isOpen: boolean;
  action: AgentPendingAction | null;
  currentIndex: number;
  totalCount: number;
  onAllowOnce: (action: AgentPendingAction) => void;
  onRejectOnce: (action: AgentPendingAction) => void;
  onAllowAllInSession: (action: AgentPendingAction) => void;
  onOpenFile?: (filePath: string) => void;
}

export const ActionApprovalModal: React.FC<ActionApprovalModalProps> = ({
  isOpen,
  action,
  currentIndex,
  totalCount,
  onAllowOnce,
  onRejectOnce,
  onAllowAllInSession,
  onOpenFile
}) => {
  const [showPreview, setShowPreview] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);

  // Keyboard Shortcuts (Enter = Allow, Esc = Reject, Shift+Enter = Allow All)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || !action || isExecuting) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onRejectOnce(action);
      } else if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        setIsExecuting(true);
        onAllowAllInSession(action);
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        setIsExecuting(true);
        onAllowOnce(action);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, action, isExecuting, onAllowOnce, onRejectOnce, onAllowAllInSession]);

  useEffect(() => {
    setIsExecuting(false);
  }, [action?.id]);

  if (!isOpen || !action) return null;

  const isWrite = action.type === 'write_file';

  return (
    <div style={{
      position: 'fixed',
      bottom: '100px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'min(720px, calc(100vw - 32px))',
      zIndex: 999,
      background: 'var(--bg-surface-elevated)',
      border: action.isHighRisk ? '2px solid #EF4444' : '2px solid var(--accent)',
      borderRadius: '12px',
      boxShadow: action.isHighRisk
        ? '0 16px 48px rgba(239, 68, 68, 0.28), 0 0 0 1px rgba(239, 68, 68, 0.4)'
        : '0 16px 48px rgba(217, 107, 39, 0.24), 0 0 0 1px rgba(217, 107, 39, 0.3)',
      overflow: 'hidden',
      animation: 'slideUpModal 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 1. Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: action.isHighRisk
          ? 'linear-gradient(90deg, rgba(239, 68, 68, 0.15) 0%, rgba(255, 255, 255, 0.02) 100%)'
          : 'linear-gradient(90deg, rgba(217, 107, 39, 0.15) 0%, rgba(255, 255, 255, 0.02) 100%)',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {action.isHighRisk ? (
            <AlertTriangle size={18} color="#EF4444" />
          ) : (
            <ShieldAlert size={18} color="var(--accent)" />
          )}
          <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-strong)' }}>
            🛡️ 智能体操作权限人机审批
          </span>
          <span style={{
            fontSize: '10.5px',
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: '10px',
            background: 'var(--accent-subtle)',
            color: 'var(--accent)'
          }}>
            待审批: 第 {currentIndex + 1} / {totalCount} 项
          </span>
          {action.isHighRisk && (
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#EF4444'
            }}>
              ⚠️ 高危操作
            </span>
          )}
        </div>

        {/* Preview Code/Command Toggle */}
        <button
          onClick={() => setShowPreview(!showPreview)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'transparent',
            border: 'none',
            fontSize: '11px',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '2px 6px',
            borderRadius: '4px'
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <Code2 size={13} />
          <span>{showPreview ? '收起详情' : '展开详情'}</span>
          {showPreview ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* 2. Action Summary Target */}
      <div style={{ padding: '12px 16px 8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isWrite ? <FileCode size={16} color="var(--accent)" /> : <Terminal size={16} color="#3B82F6" />}
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {isWrite ? '目标物理写盘文件:' : '目标终端执行指令:'}
            </span>
            <span
              onClick={() => isWrite && onOpenFile?.(action.target)}
              style={{
                fontSize: '12.5px',
                fontWeight: 700,
                color: isWrite ? 'var(--accent)' : '#1E293B',
                fontFamily: 'var(--font-mono)',
                cursor: isWrite ? 'pointer' : 'default',
                textDecoration: isWrite ? 'underline' : 'none'
              }}
              title={isWrite ? '点击在右侧工作台打开文件' : ''}
            >
              {action.target}
            </span>
            {isWrite && <ExternalLink size={12} color="var(--accent)" />}
          </div>

          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            共 {action.linesCount || (action.code.split('\n').length)} 行
          </span>
        </div>

        {/* High Risk Hint */}
        {action.isHighRisk && (
          <div style={{
            fontSize: '11px',
            color: '#DC2626',
            background: 'rgba(239, 68, 68, 0.08)',
            padding: '4px 8px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <AlertTriangle size={13} />
            <span>提示: 该操作涉及敏感核心配置或高危系统命令，请仔细核对预览内容后谨慎执行。</span>
          </div>
        )}
      </div>

      {/* 3. Code/Command Scrollable Preview */}
      {showPreview && (
        <div style={{
          margin: '0 16px 10px',
          maxHeight: '180px',
          overflowY: 'auto',
          background: '#0B1120',
          borderRadius: '6px',
          border: '1px solid #1E293B',
          padding: '10px 12px',
          fontSize: '11.5px',
          fontFamily: 'Consolas, "Fira Code", Monaco, monospace',
          color: '#E2E8F0',
          lineHeight: 1.5,
          whiteSpace: 'pre'
        }}>
          {action.code}
        </div>
      )}

      {/* 4. Action Buttons Trio (Allow / Reject / Always Allow) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px 12px',
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-base)'
      }}>
        {/* Left: Rejection Button (Esc) */}
        <button
          onClick={() => onRejectOnce(action)}
          disabled={isExecuting}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '6px',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-strong)',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: isExecuting ? 'default' : 'pointer',
            transition: 'all 0.15s ease'
          }}
          title="拒绝执行本次操作，跳过并继续对话 (Esc)"
        >
          <XCircle size={15} color="#64748B" />
          <span>🛑 不执行 (Esc)</span>
        </button>

        {/* Right Buttons: Always Allow & Allow Once */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Allow All in Session Button (Shift+Enter) */}
          <button
            onClick={() => {
              setIsExecuting(true);
              onAllowAllInSession(action);
            }}
            disabled={isExecuting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '6px',
              background: 'rgba(217, 107, 39, 0.12)',
              border: '1px solid var(--accent)',
              color: 'var(--accent)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: isExecuting ? 'default' : 'pointer',
              boxShadow: '0 2px 8px rgba(217, 107, 39, 0.12)'
            }}
            title="仅允许当前 Agent Loop 中后续低风险操作自动执行；高危操作仍逐项审批 (Shift+Enter)"
          >
            <Zap size={14} color="var(--accent)" />
            <span>⚡ 后续低风险自动执行 (Shift+↵)</span>
          </button>

          {/* Allow Once Button (Enter) */}
          <button
            onClick={() => {
              setIsExecuting(true);
              onAllowOnce(action);
            }}
            disabled={isExecuting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 18px',
              borderRadius: '6px',
              background: 'var(--accent)',
              border: 'none',
              color: '#FFF',
              fontSize: '12px',
              fontWeight: 700,
              cursor: isExecuting ? 'default' : 'pointer',
              boxShadow: '0 4px 12px rgba(217, 107, 39, 0.35)'
            }}
            title="确认执行当前操作，若后续还有操作将继续弹出 (Enter)"
          >
            <Play size={14} fill="#FFF" color="#FFF" />
            <span>{isExecuting ? '正在执行...' : '▶️ 确认执行 (↵)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
