import React, { useState } from 'react';
import { ChevronDown, ChevronRight, BrainCircuit } from 'lucide-react';

interface ThinkingBlockProps {
  thinking: string;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ thinking }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!thinking) return null;

  return (
    <div
      style={{
        margin: '8px 0',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        overflow: 'hidden',
        fontSize: '12px',
      }}
    >
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          background: 'var(--bg-surface-elevated)',
          userSelect: 'none',
        }}
      >
        <BrainCircuit size={13} color="var(--accent)" />
        <span style={{ fontWeight: 600, flex: 1 }}>深度思考过程 (Reasoning Engine)</span>
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </div>

      {isExpanded && (
        <div
          style={{
            padding: '10px 12px',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            maxHeight: '220px',
            overflowY: 'auto',
          }}
        >
          {thinking}
        </div>
      )}
    </div>
  );
};
