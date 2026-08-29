import React, { useState } from 'react';
import { X, GitCommit, Check, ArrowRight, Zap, CheckCheck } from 'lucide-react';
import { SemanticCommitItem, splitChangesetIntoSemanticCommits } from '../types/contracts';

interface SemanticCommitModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: Array<{ path: string }>;
  onExecuteCommits: (commits: SemanticCommitItem[]) => void;
}

export const SemanticCommitModal: React.FC<SemanticCommitModalProps> = ({
  isOpen,
  onClose,
  files,
  onExecuteCommits
}) => {
  if (!isOpen) return null;

  const [commits, setCommits] = useState<SemanticCommitItem[]>(() => splitChangesetIntoSemanticCommits(files));
  const [isExecuting, setIsExecuting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleRun = () => {
    setIsExecuting(true);
    setTimeout(() => {
      setIsExecuting(false);
      setSuccess(true);
      onExecuteCommits(commits);
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1800);
    }, 1000);
  };

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
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        width: '560px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitCommit size={16} color="var(--accent)" />
            <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
              📦 意图智能拆分 Conventional Commits
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            AI 已自动根据修改性质，将 3 个文件的变更拆解为符合团队规范的原子提交：
          </div>

          {commits.map((c, idx) => (
            <div
              key={c.id}
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    padding: '1px 6px',
                    borderRadius: '3px',
                    background: c.type === 'feat' ? 'rgba(22, 163, 74, 0.15)' : c.type === 'test' ? 'rgba(37, 99, 235, 0.15)' : 'rgba(217, 107, 39, 0.15)',
                    color: c.type === 'feat' ? '#16A34A' : c.type === 'test' ? '#2563EB' : 'var(--accent)',
                    fontSize: '10px',
                    fontWeight: 700
                  }}>
                    {c.type}({c.scope})
                  </span>
                  <span style={{ fontWeight: 600, fontSize: '11.5px', color: 'var(--text-primary)' }}>{c.message}</span>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>#{idx + 1}</span>
              </div>

              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', paddingLeft: '4px' }}>
                涉及文件: {c.files.join(', ')}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 16px',
          background: 'var(--bg-base)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '4px 12px',
              borderRadius: '4px',
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            取消
          </button>
          <button
            onClick={handleRun}
            disabled={isExecuting || success}
            style={{
              padding: '5px 14px',
              borderRadius: '4px',
              background: success ? '#16A34A' : 'var(--accent)',
              border: 'none',
              color: '#FFF',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: isExecuting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {success ? <CheckCheck size={13} /> : <Zap size={13} />}
            <span>{success ? '✓ 已原子化提交至 Git 本地树' : isExecuting ? '正在顺序提交...' : '🚀 顺序执行原子提交'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
