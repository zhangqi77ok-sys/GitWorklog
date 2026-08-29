import React, { useState } from 'react';
import { Check, X, Undo2, ChevronRight, ChevronDown, Split, Columns, Sparkles, FileText } from 'lucide-react';

export interface DiffHunkItem {
  id: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: Array<{
    type: 'add' | 'del' | 'context';
    content: string;
    oldLineNumber?: number;
    newLineNumber?: number;
  }>;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface FileDiffPayload {
  fileId: string;
  filePath: string;
  oldContent: string;
  newContent: string;
  hunks: DiffHunkItem[];
  additions: number;
  deletions: number;
  reason?: string;
  riskLevel?: 'low' | 'medium' | 'high';
}

export interface InteractiveDiffViewerProps {
  diff: FileDiffPayload;
  onAcceptHunk?: (hunkId: string) => void;
  onRejectHunk?: (hunkId: string) => void;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
  onRollbackHunk?: (hunkId: string) => void;
}

export const InteractiveDiffViewer: React.FC<InteractiveDiffViewerProps> = ({
  diff,
  onAcceptHunk,
  onRejectHunk,
  onAcceptAll,
  onRejectAll,
  onRollbackHunk
}) => {
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('unified');

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-base)',
      fontFamily: 'var(--font-mono)',
      fontSize: '11.5px',
      userSelect: 'text'
    }}>
      {/* 1. Diff Summary Header Banner */}
      <div style={{
        padding: '8px 12px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: 'var(--font-sans)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-primary)' }}>
            📄 变更审查: {diff.filePath}
          </span>
          <span style={{ color: '#16A34A', fontWeight: 700, fontSize: '11px' }}>+{diff.additions}</span>
          <span style={{ color: '#DC2626', fontWeight: 700, fontSize: '11px' }}>-{diff.deletions}</span>
          {diff.riskLevel && (
            <span style={{
              fontSize: '9.5px',
              padding: '1px 5px',
              borderRadius: '3px',
              background: diff.riskLevel === 'high' ? 'rgba(220, 38, 38, 0.15)' : diff.riskLevel === 'medium' ? 'rgba(234, 88, 12, 0.15)' : 'rgba(22, 163, 74, 0.15)',
              color: diff.riskLevel === 'high' ? '#DC2626' : diff.riskLevel === 'medium' ? '#EA580C' : '#16A34A',
              fontWeight: 600
            }}>
              {diff.riskLevel === 'high' ? '高风险变更' : diff.riskLevel === 'medium' ? '常规修改' : '低风险'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Mode Switcher */}
          <div style={{ display: 'flex', background: 'var(--bg-base)', padding: '2px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setViewMode('unified')}
              style={{
                padding: '2px 6px',
                border: 'none',
                borderRadius: '3px',
                background: viewMode === 'unified' ? 'var(--accent-subtle)' : 'transparent',
                color: viewMode === 'unified' ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: '10px',
                cursor: 'pointer',
                fontWeight: viewMode === 'unified' ? 700 : 500
              }}
            >
              Inline
            </button>
            <button
              onClick={() => setViewMode('split')}
              style={{
                padding: '2px 6px',
                border: 'none',
                borderRadius: '3px',
                background: viewMode === 'split' ? 'var(--accent-subtle)' : 'transparent',
                color: viewMode === 'split' ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: '10px',
                cursor: 'pointer',
                fontWeight: viewMode === 'split' ? 700 : 500
              }}
            >
              Side-by-Side
            </button>
          </div>

          {onRejectAll && (
            <button
              onClick={onRejectAll}
              style={{
                padding: '3px 8px',
                borderRadius: '4px',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                fontSize: '10.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              全部拒绝
            </button>
          )}

          {onAcceptAll && (
            <button
              onClick={onAcceptAll}
              style={{
                padding: '3px 10px',
                borderRadius: '4px',
                background: 'var(--accent)',
                border: 'none',
                color: '#FFF',
                fontSize: '10.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              全部接受
            </button>
          )}
        </div>
      </div>

      {diff.reason && (
        <div style={{
          padding: '6px 12px',
          background: 'rgba(217, 107, 39, 0.05)',
          borderBottom: '1px solid rgba(217, 107, 39, 0.2)',
          color: 'var(--accent)',
          fontSize: '11px',
          fontFamily: 'var(--font-sans)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <Sparkles size={12} />
          <span>Agent 修改意图: {diff.reason}</span>
        </div>
      )}

      {/* 2. Hunks Canvas */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
        {diff.hunks.map(hunk => (
          <div
            key={hunk.id}
            style={{
              margin: '0 12px 14px 12px',
              borderRadius: '6px',
              border: hunk.status === 'accepted' ? '1px solid rgba(22, 163, 74, 0.4)' : hunk.status === 'rejected' ? '1px solid rgba(220, 38, 38, 0.4)' : '1px solid var(--border-subtle)',
              overflow: 'hidden',
              background: 'var(--bg-surface)'
            }}
          >
            {/* Hunk Header with Granular Accept / Reject Controls */}
            <div style={{
              padding: '4px 8px',
              background: 'var(--bg-surface-elevated)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)',
              fontSize: '10.5px',
              color: 'var(--text-muted)'
            }}>
              <span>{hunk.header}</span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {hunk.status === 'accepted' && <span style={{ color: '#16A34A', fontWeight: 600 }}>✓ 已接受</span>}
                {hunk.status === 'rejected' && <span style={{ color: '#DC2626', fontWeight: 600 }}>✕ 已拒绝</span>}

                {hunk.status === 'pending' && (
                  <>
                    {onRejectHunk && (
                      <button
                        onClick={() => onRejectHunk(hunk.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                          padding: '1px 6px',
                          borderRadius: '3px',
                          background: 'transparent',
                          border: '1px solid rgba(220, 38, 38, 0.3)',
                          color: '#DC2626',
                          fontSize: '9.5px',
                          cursor: 'pointer'
                        }}
                      >
                        <X size={10} />
                        <span>拒绝此块</span>
                      </button>
                    )}
                    {onAcceptHunk && (
                      <button
                        onClick={() => onAcceptHunk(hunk.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                          padding: '1px 8px',
                          borderRadius: '3px',
                          background: '#16A34A',
                          border: 'none',
                          color: '#FFF',
                          fontSize: '9.5px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <Check size={10} />
                        <span>接受此块</span>
                      </button>
                    )}
                  </>
                )}

                {hunk.status !== 'pending' && onRollbackHunk && (
                  <button
                    onClick={() => onRollbackHunk(hunk.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                      padding: '1px 6px',
                      borderRadius: '3px',
                      background: 'transparent',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-muted)',
                      fontSize: '9.5px',
                      cursor: 'pointer'
                    }}
                  >
                    <Undo2 size={10} />
                    <span>重置</span>
                  </button>
                )}
              </div>
            </div>

            {/* Hunk Lines Rendering */}
            <div style={{ lineHeight: '19px', overflowX: 'auto' }}>
              {hunk.lines.map((l, lIdx) => {
                const isAdd = l.type === 'add';
                const isDel = l.type === 'del';

                return (
                  <div
                    key={lIdx}
                    style={{
                      display: 'flex',
                      background: isAdd ? 'rgba(22, 163, 74, 0.12)' : isDel ? 'rgba(220, 38, 38, 0.12)' : 'transparent',
                      color: isAdd ? '#15803D' : isDel ? '#B91C1C' : 'var(--text-primary)'
                    }}
                  >
                    <div style={{ width: '36px', textAlign: 'right', paddingRight: '6px', color: 'var(--text-muted)', userSelect: 'none', opacity: 0.6 }}>
                      {l.oldLineNumber || ''}
                    </div>
                    <div style={{ width: '36px', textAlign: 'right', paddingRight: '8px', color: 'var(--text-muted)', userSelect: 'none', opacity: 0.6 }}>
                      {l.newLineNumber || ''}
                    </div>
                    <div style={{ width: '16px', textAlign: 'center', userSelect: 'none', fontWeight: 700 }}>
                      {isAdd ? '+' : isDel ? '-' : ' '}
                    </div>
                    <div style={{ flex: 1, paddingLeft: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {l.content}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
