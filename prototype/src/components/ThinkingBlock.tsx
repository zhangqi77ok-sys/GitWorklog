import React, { useState } from 'react';
import { Brain, ChevronDown, ChevronUp, Sparkles, Clock } from 'lucide-react';
import { ThinkingBlockPayload } from '../types/contracts';

interface ThinkingBlockProps {
  payload: ThinkingBlockPayload;
  defaultExpanded?: boolean;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  payload,
  defaultExpanded = false
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(!payload.isThinkingFinished || defaultExpanded);

  if (!payload.thinkingText) return null;

  return (
    <div style={{
      margin: '8px 0',
      borderRadius: '8px',
      border: '1px solid var(--border-subtle)',
      background: 'rgba(234, 179, 8, 0.04)',
      overflow: 'hidden',
      transition: 'all 0.2s ease'
    }}>
      {/* Header Pill */}
      <div
        onClick={() => setIsExpanded(prev => !prev)}
        style={{
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
          background: 'var(--bg-base)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '18px',
            height: '18px',
            borderRadius: '4px',
            background: 'rgba(234, 179, 8, 0.15)',
            color: '#CA8A04',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Brain size={12} />
          </div>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {payload.isThinkingFinished ? '深度思考过程 (已收敛)' : '🧠 深度思考推演中...'}
          </span>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: '10px',
            color: 'var(--text-muted)',
            padding: '1px 6px',
            borderRadius: '10px',
            background: 'var(--bg-surface)'
          }}>
            <Clock size={10} />
            <span>耗时 {payload.durationSeconds}s · {payload.tokensCount} tokens</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
          <span style={{ fontSize: '10px' }}>{isExpanded ? '收起' : '展开'}</span>
          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </div>

      {/* Expanded Thinking Body */}
      {isExpanded && (
        <div style={{
          padding: '10px 14px',
          fontSize: '11px',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          fontFamily: 'var(--font-mono)',
          whiteSpace: 'pre-wrap',
          borderTop: '1px solid var(--border-subtle)',
          maxHeight: '260px',
          overflowY: 'auto',
          background: 'rgba(0,0,0,0.02)'
        }}>
          {payload.thinkingText}
        </div>
      )}
    </div>
  );
};
