import React from 'react';
import { CheckCircle2, XCircle, Clock, AlertTriangle, Zap, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { TargetAcceptanceItem, InternalStepTag, LoopTerminationStatus, AgentRoundItem } from '../types/contracts';

interface TargetStepProgressCardProps {
  items?: TargetAcceptanceItem[];
  stepTags?: InternalStepTag[];
  rounds?: AgentRoundItem[];
  activeRoundId?: number;
  onSelectRound?: (roundId: number) => void;
  loopStatus?: LoopTerminationStatus;
  terminationSummary?: string;
  onSelectAction?: (actionId: string) => void;
}

export const TargetStepProgressCard: React.FC<TargetStepProgressCardProps> = ({
  items = [],
  stepTags = [],
  rounds = [],
  activeRoundId,
  onSelectRound,
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
        <div style={{ padding: '10px 12px', borderBottom: (stepTags.length > 0 || (rounds && rounds.length > 0)) ? '1px dashed var(--border-subtle)' : 'none' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>🎯 任务目标验收标准清单 (Run 级统一验收):</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>共 {items.length} 项</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {items.map(item => {
              const [showEvidence, setShowEvidence] = React.useState(false);
              const hasEvidence = item.evidence || (item.evidenceDetails && item.evidenceDetails.length > 0);

              return (
                <div key={item.id} style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', flex: 1 }}>
                      <span style={{ marginTop: '2px', flexShrink: 0 }}>
                        {item.status === 'passed' && <CheckCircle2 size={14} color="#16A34A" />}
                        {item.status === 'failed' && <XCircle size={14} color="#DC2626" />}
                        {item.status === 'running' && <Zap size={14} color="var(--accent)" />}
                        {item.status === 'pending' && <Clock size={14} color="var(--text-muted)" />}
                      </span>
                      <span style={{
                        color: item.status === 'passed' ? 'var(--text-primary)' : item.status === 'failed' ? '#DC2626' : 'var(--text-secondary)',
                        fontWeight: item.status === 'passed' ? 600 : 400,
                        fontSize: '11.5px',
                        lineHeight: 1.4
                      }}>
                        {item.description}
                      </span>
                    </div>

                    {hasEvidence && (
                      <button
                        onClick={() => setShowEvidence(!showEvidence)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: item.status === 'passed' ? 'rgba(22, 163, 74, 0.08)' : 'var(--accent-subtle)',
                          border: 'none',
                          color: item.status === 'passed' ? '#16A34A' : 'var(--accent)',
                          fontSize: '10px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          flexShrink: 0
                        }}
                      >
                        <span>{showEvidence ? '收起证据' : '查看证据'}</span>
                        {showEvidence ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                    )}
                  </div>

                  {/* Expandable Structured Evidence Box */}
                  {showEvidence && (
                    <div style={{
                      marginTop: '4px',
                      padding: '8px',
                      borderRadius: '4px',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-strong)',
                      fontSize: '10.5px',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {item.evidence && (
                        <div style={{ color: item.status === 'passed' ? '#16A34A' : '#DC2626', fontWeight: 600, marginBottom: '4px' }}>
                          ● {item.evidence}
                        </div>
                      )}
                      {item.evidenceDetails && item.evidenceDetails.map((ev, evIdx) => (
                        <div key={evIdx} style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderTop: evIdx > 0 ? '1px dashed var(--border-subtle)' : 'none', paddingTop: evIdx > 0 ? '4px' : '0' }}>
                          <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                            {ev.type === 'test' ? '🧪 自动化测试验证' : ev.type === 'file' ? '📁 文件落盘证据' : '▶ 执行指令'}:
                          </div>
                          {ev.command && (
                            <div style={{ color: 'var(--accent)', background: 'var(--bg-base)', padding: '2px 4px', borderRadius: '3px' }}>
                              $ {ev.command} {ev.exitCode !== undefined && `(ExitCode: ${ev.exitCode})`}
                            </div>
                          )}
                          {ev.filePath && (
                            <div style={{ color: '#10B981' }}>已修改: {ev.filePath}</div>
                          )}
                          {ev.output && (
                            <div style={{ color: 'var(--text-muted)', maxHeight: '80px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                              {ev.output}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Internal Rounds Tabs [Round 1] [Round 2] (No History Overwrite) */}
      {rounds && rounds.length > 0 && (
        <div style={{ padding: '6px 12px', background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
            <Layers size={12} />
            <span>执行轮次:</span>
          </div>
          {rounds.map(r => {
            const isCur = r.roundId === activeRoundId || (!activeRoundId && r.roundId === rounds[rounds.length - 1].roundId);
            return (
              <button
                key={r.roundId}
                onClick={() => onSelectRound && onSelectRound(r.roundId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: isCur ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                  background: isCur ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                  color: isCur ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: '10px',
                  fontWeight: isCur ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.12s ease'
                }}
              >
                <span>{r.status === 'passed' ? '✓' : r.status === 'failed' ? '✕' : '●'} Round {r.roundId}</span>
                <span style={{ fontSize: '9px', opacity: 0.8 }}>({r.title})</span>
              </button>
            );
          })}
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
