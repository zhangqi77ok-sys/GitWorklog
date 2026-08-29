import React from 'react';
import { GitBranch, Clock, FileCode, RotateCcw, X, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { TrajectoryStepSnapshot } from '../types/contracts';

interface TrajectorySnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  step: TrajectoryStepSnapshot | null;
  onForkStep?: (stepIndex: number) => void;
  onRollbackStep?: (stepIndex: number) => void;
}

export const TrajectorySnapshotModal: React.FC<TrajectorySnapshotModalProps> = ({
  isOpen,
  onClose,
  step,
  onForkStep,
  onRollbackStep
}) => {
  if (!isOpen || !step) return null;

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
        width: '640px',
        maxHeight: '85vh',
        background: 'var(--bg-surface)',
        borderRadius: '12px',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 20px 48px rgba(0,0,0,0.28)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
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
              background: 'rgba(234, 179, 8, 0.12)',
              color: '#CA8A04',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Clock size={16} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                🧭 步骤轨迹时光机快照 (Step {step.stepIndex} / {step.totalSteps})
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                安全快照时间点: {step.timestamp} · 影子提交已自动固化
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

        {/* Modal Body */}
        <div style={{ padding: '16px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Step Meta Card */}
          <div style={{
            padding: '10px 12px',
            borderRadius: '6px',
            background: 'var(--bg-base)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {step.title}
              </span>
              <span style={{
                fontSize: '9.5px',
                padding: '1px 6px',
                borderRadius: '3px',
                background: step.status === 'completed' ? 'rgba(22, 163, 74, 0.1)' : 'rgba(234, 179, 8, 0.15)',
                color: step.status === 'completed' ? '#16A34A' : '#CA8A04',
                fontWeight: 600
              }}>
                {step.status === 'completed' ? '✓ 已完成阶段' : '● 当前执行中'}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              {step.summary}
            </div>
          </div>

          {/* Snapshot Files & Code Diff Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
              📁 本步骤涉及的代码快照 ({step.snapshotFileCount} 个文件)
            </span>
            <div style={{
              padding: '10px 12px',
              borderRadius: '6px',
              background: '#18181B',
              color: '#F4F4F5',
              fontFamily: 'var(--font-mono)',
              fontSize: '10.5px',
              lineHeight: 1.6,
              border: '1px solid rgba(255,255,255,0.08)'
            }}>
              <div style={{ color: '#10B981' }}>+ export interface SessionItem &#123;</div>
              <div style={{ color: '#10B981' }}>+   id: string;</div>
              <div style={{ color: '#10B981' }}>+   tier1: 'global' | 'project';</div>
              <div style={{ color: '#10B981' }}>+   title: string;</div>
              <div style={{ color: '#10B981' }}>+ &#125;</div>
              <div style={{ color: '#6B7280' }}>// [AST 校验通过: 0 语法错误 · 契约强一致]</div>
            </div>
          </div>

          {/* Time Travel Capabilities Callout */}
          <div style={{
            padding: '10px 12px',
            borderRadius: '6px',
            background: 'rgba(217, 107, 39, 0.06)',
            border: '1px solid rgba(217, 107, 39, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GitBranch size={16} color="var(--accent)" />
              <div style={{ fontSize: '11px', color: 'var(--text-primary)' }}>
                <strong>时空分支派生 (Branch Forking)</strong>：在此历史快照点直接派生新会话，探索另一种重构方案。
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '10px 18px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px',
          background: 'var(--bg-base)'
        }}>
          <button
            onClick={() => {
              if (onRollbackStep) onRollbackStep(step.stepIndex);
              onClose();
            }}
            style={{
              padding: '5px 12px',
              borderRadius: '5px',
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <RotateCcw size={11} />
            <span>↩️ 回滚至此步状态</span>
          </button>

          <button
            onClick={() => {
              if (onForkStep) onForkStep(step.stepIndex);
              onClose();
            }}
            style={{
              padding: '5px 16px',
              borderRadius: '5px',
              background: 'var(--accent)',
              border: 'none',
              fontSize: '11.5px',
              fontWeight: 600,
              color: '#FFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <GitBranch size={12} />
            <span>🌿 从此步骤分叉新思路</span>
          </button>
        </div>
      </div>
    </div>
  );
};
