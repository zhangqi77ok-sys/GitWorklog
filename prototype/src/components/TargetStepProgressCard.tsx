import React from 'react';
import { CheckCircle2, XCircle, Clock, AlertTriangle, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { TargetAcceptanceItem, InternalStepTag, LoopTerminationStatus } from '../types/contracts';

interface TargetStepProgressCardProps {
  items?: TargetAcceptanceItem[];
  stepTags?: InternalStepTag[];
  loopStatus?: LoopTerminationStatus;
  terminationSummary?: string;
  onSelectAction?: (actionId: string) => void;
}

export const TargetStepProgressCard: React.FC<TargetStepProgressCardProps> = ({
  items = [],
  stepTags = [],
  loopStatus = 'running',
  terminationSummary,
  onSelectAction
}) => {
  const [isTagsExpanded, setIsTagsExpanded] = React.useState(true);

  if (items.length === 0 && stepTags.length === 0) return null;

  const passedCount = items.filter(i => i.status === 'passed').length;
  const totalCount = items.length;

  return (
    <div style={{
      margin: '8px 0 12px 0',
      borderRadius: '8px',
      border: loopStatus === 'completed'
        ? '1px solid rgba(34, 197, 94, 0.35)'
        : loopStatus === 'no_progress' || loopStatus === 'blocked'
        ? '1px solid rgba(234, 88, 12, 0.35)'
        : '1px solid rgba(217, 107, 39, 0.25)',
      background: 'var(--bg-surface-elevated)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      overflow: 'hidden',
      fontSize: '12px'
    }}>
      {/* Header Banner */}
      <div style={{
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: loopStatus === 'completed'
          ? 'linear-gradient(90deg, rgba(34, 197, 94, 0.12) 0%, var(--bg-surface-elevated) 100%)'
          : loopStatus === 'no_progress' || loopStatus === 'blocked'
          ? 'linear-gradient(90deg, rgba(234, 88, 12, 0.12) 0%, var(--bg-surface-elevated) 100%)'
          : 'linear-gradient(90deg, rgba(217, 107, 39, 0.1) 0%, var(--bg-surface-elevated) 100%)',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {loopStatus === 'completed' ? (
            <CheckCircle2 size={16} color="#16A34A" />
          ) : loopStatus === 'no_progress' ? (
            <AlertTriangle size={16} color="#EA580C" />
          ) : loopStatus === 'blocked' ? (
            <AlertTriangle size={16} color="#DC2626" />
          ) : (
            <Zap size={16} color="var(--accent)" />
          )}

          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            {loopStatus === 'completed' && '🎯 目标驱动闭环 · 验证已全部通过'}
            {loopStatus === 'running' && '🎯 目标驱动闭环 · 正在逐步求证与修复'}
            {loopStatus === 'no_progress' && '⏸ 任务暂停 · 未产生新的有效进展'}
            {loopStatus === 'blocked' && '⚠ 任务被外部条件阻塞'}
          </div>
        </div>

        {totalCount > 0 && (
          <span style={{
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '10px',
            background: loopStatus === 'completed' ? 'rgba(34, 197, 94, 0.15)' : 'var(--accent-subtle)',
            color: loopStatus === 'completed' ? '#16A34A' : 'var(--accent)',
            fontWeight: 700
          }}>
            {passedCount} / {totalCount} 项验收通过
          </span>
        )}
      </div>

      {/* Acceptance Criteria Checklist */}
      {items.length > 0 && (
        <div style={{ padding: '10px 12px', borderBottom: stepTags.length > 0 ? '1px dashed var(--border-subtle)' : 'none' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
            🎯 目标验收标准清单 (Acceptance Criteria):
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {items.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                <span style={{ marginTop: '1px', flexShrink: 0 }}>
                  {item.status === 'passed' && <CheckCircle2 size={13} color="#16A34A" />}
                  {item.status === 'failed' && <XCircle size={13} color="#DC2626" />}
                  {item.status === 'pending' && <Clock size={13} color="var(--text-muted)" />}
                </span>
                <div style={{ flex: 1 }}>
                  <span style={{
                    color: item.status === 'passed' ? 'var(--text-primary)' : item.status === 'failed' ? '#DC2626' : 'var(--text-secondary)',
                    fontWeight: item.status === 'passed' ? 500 : 400
                  }}>
                    {item.description}
                  </span>
                  {item.evidence && (
                    <span style={{ marginLeft: '6px', fontSize: '10.5px', color: '#16A34A', fontFamily: 'var(--font-mono)' }}>
                      [{item.evidence}]
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Internal Step Tags Chain */}
      {stepTags.length > 0 && (
        <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.015)' }}>
          <div
            onClick={() => setIsTagsExpanded(!isTagsExpanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              userSelect: 'none',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-muted)'
            }}
          >
            <span>🏷️ 内部执行链路 (Internal Step Chain · 共 {stepTags.length} 步):</span>
            {isTagsExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </div>

          {isTagsExpanded && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
              {stepTags.map((tag, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: tag.status === 'passed'
                      ? 'rgba(34, 197, 94, 0.1)'
                      : tag.status === 'failed'
                      ? 'rgba(220, 38, 38, 0.1)'
                      : 'var(--bg-surface)',
                    border: tag.status === 'passed'
                      ? '1px solid rgba(34, 197, 94, 0.3)'
                      : tag.status === 'failed'
                      ? '1px solid rgba(220, 38, 38, 0.3)'
                      : '1px solid var(--border-subtle)',
                    fontSize: '10.5px',
                    fontFamily: 'var(--font-mono)',
                    color: tag.status === 'passed' ? '#16A34A' : tag.status === 'failed' ? '#DC2626' : 'var(--text-primary)'
                  }}
                >
                  <span style={{ fontWeight: 700 }}>#{tag.step} [{tag.label}]</span>
                  <span>{tag.status === 'passed' ? '✓' : tag.status === 'failed' ? '✕' : '…'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Termination Summary & Stalled Decision Actions */}
      {terminationSummary && (
        <div style={{
          padding: '8px 12px',
          borderTop: '1px solid var(--border-subtle)',
          background: loopStatus === 'completed' ? 'rgba(34, 197, 94, 0.05)' : 'rgba(234, 88, 12, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <span style={{
            fontWeight: 600,
            color: loopStatus === 'completed' ? '#16A34A' : '#EA580C'
          }}>
            {terminationSummary}
          </span>

          {loopStatus === 'no_progress' && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => onSelectAction?.('try_new_approach')}
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--accent)',
                  background: 'var(--accent)',
                  color: '#FFF',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                🔄 换一种方案
              </button>
              <button
                onClick={() => onSelectAction?.('continue_anyway')}
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                继续尝试
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
