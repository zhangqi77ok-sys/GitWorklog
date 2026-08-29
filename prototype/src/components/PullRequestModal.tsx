import React, { useState } from 'react';
import { GitPullRequest, GitBranch, CheckCircle2, ShieldCheck, X, Send, Sparkles } from 'lucide-react';
import { generatePullRequestDraft } from '../types/contracts';

interface PullRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchName?: string;
  sessionTitle?: string;
  onSuccess?: (prUrl: string) => void;
}

export const PullRequestModal: React.FC<PullRequestModalProps> = ({
  isOpen,
  onClose,
  branchName = 'fork-refactor-store',
  sessionTitle = '重构三栏自适应流体布局',
  onSuccess
}) => {
  const draft = generatePullRequestDraft(branchName, sessionTitle, '扩展现有全局 Store (单例状态源)');
  const [prTitle, setPrTitle] = useState(draft.title);
  const [prMotivation, setPrMotivation] = useState(draft.motivation);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedPrUrl, setSubmittedPrUrl] = useState<string | null>(null);

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

  if (!isOpen) return null;
        
  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const fakeUrl = `https://github.com/zhangqi77ok-sys/agent-learning/pull/${Math.floor(Math.random() * 800) + 100}`;
      setSubmittedPrUrl(fakeUrl);
      if (onSuccess) onSuccess(fakeUrl);
    }, 1200);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.45)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        width: '680px',
        maxHeight: '85vh',
        background: 'var(--bg-surface)',
        borderRadius: '12px',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 20px 48px rgba(0,0,0,0.28)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-base)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'rgba(217, 107, 39, 0.12)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <GitPullRequest size={16} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                🚀 一键生成 Pull Request 简报并 Push
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                自动聚合架构决策理由、变更文件清单与本地 CI 绿灯凭证
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Branch Target Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: '6px',
            background: 'var(--bg-base)',
            border: '1px solid var(--border-subtle)',
            fontSize: '11px'
          }}>
            <GitBranch size={13} color="var(--accent)" />
            <span style={{ color: 'var(--text-muted)' }}>从分支</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent)' }}>{branchName}</span>
            <span style={{ color: 'var(--text-muted)' }}>合并至</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>main</span>
          </div>

          {/* PR Title Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>PR 标题 (Title)</label>
            <input
              type="text"
              value={prTitle}
              onChange={e => setPrTitle(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '5px',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '12px'
              }}
            />
          </div>

          {/* Architecture Decision Log Callout */}
          <div style={{
            padding: '10px 12px',
            borderRadius: '6px',
            background: 'rgba(217, 107, 39, 0.06)',
            border: '1px solid rgba(217, 107, 39, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--accent)' }}>
              <Sparkles size={13} />
              <span>人机协同架构决策摘要 (Architecture Decisions Log)</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
              {draft.decisionLog}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              理由：单例模式可完全复用现有状态订阅总线，零额外样板代码破坏面。
            </div>
          </div>

          {/* CI Verification Checklist Proof */}
          <div style={{
            padding: '10px 12px',
            borderRadius: '6px',
            background: 'rgba(22, 163, 74, 0.06)',
            border: '1px solid rgba(22, 163, 74, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#16A34A' }}>
              <ShieldCheck size={13} />
              <span>本地 CI 门禁预检凭证 (Local Pre-Flight CI Proof)</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '10.5px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>✓ TypeScript: 0 Errors</span>
              <span style={{ color: 'var(--text-secondary)' }}>✓ ESLint: 0 Warnings</span>
              <span style={{ color: '#16A34A', fontWeight: 600 }}>✓ Vitest: 51 Passed (覆盖率 88.4%)</span>
            </div>
          </div>

          {/* Success Message if submitted */}
          {submittedPrUrl && (
            <div style={{
              padding: '10px 12px',
              borderRadius: '6px',
              background: 'rgba(22, 163, 74, 0.12)',
              border: '1px solid #16A34A',
              color: '#16A34A',
              fontSize: '11.5px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>🎉 Pull Request 创建成功并推送至远端仓库！</span>
              <a href={submittedPrUrl} target="_blank" rel="noreferrer" style={{ color: '#16A34A', textDecoration: 'underline' }}>
                查看 PR ➔
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 18px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px',
          background: 'var(--bg-base)'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '5px 12px',
              borderRadius: '5px',
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              fontSize: '11.5px',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !!submittedPrUrl}
            style={{
              padding: '5px 16px',
              borderRadius: '5px',
              background: 'var(--accent)',
              border: 'none',
              fontSize: '11.5px',
              fontWeight: 600,
              color: '#FFF',
              cursor: isSubmitting || !!submittedPrUrl ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: isSubmitting || !!submittedPrUrl ? 0.7 : 1
            }}
          >
            {isSubmitting ? '正在 Push 并生成 PR...' : submittedPrUrl ? '✓ 已完成创建' : '🚀 确认推送并一键创建 PR'}
          </button>
        </div>
      </div>
    </div>
  );
};
