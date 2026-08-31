import React from 'react';
import { Zap, Users } from 'lucide-react';
import type { ExecutionMode } from '../services/executionMode';

interface ExecutionModeCapsuleProps {
  mode: ExecutionMode;
  onModeChange: (mode: ExecutionMode) => void;
}

/**
 * 二元执行引擎胶囊（⚡ Agent Loop / 🐝 Swarm 协同）
 * 放置于输入框上方，提供直观、就近的执行心智决策。
 */
export const ExecutionModeCapsule: React.FC<ExecutionModeCapsuleProps> = ({
  mode,
  onModeChange
}) => {
  const isAgentLoop = mode === 'act';
  const isSwarm = mode === 'swarm';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          background: 'var(--bg-base, #F4EFEA)',
          border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
          borderRadius: '6px',
          padding: '2px',
          gap: '2px',
          userSelect: 'none'
        }}
      >
        {/* ⚡ Agent Loop (Single Agent Micro-Loop) */}
        <button
          type="button"
          onClick={() => onModeChange('act')}
          title="⚡ Agent Loop（单智能体极速自主闭环）· 快捷键: Alt+1"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 9px',
            borderRadius: '4px',
            border: 'none',
            background: isAgentLoop ? 'var(--accent, #D96B27)' : 'transparent',
            color: isAgentLoop ? '#FFFFFF' : 'var(--text-secondary, #736B63)',
            fontSize: '11px',
            fontWeight: isAgentLoop ? 600 : 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
            boxShadow: isAgentLoop ? '0 1px 4px rgba(217, 107, 39, 0.28)' : 'none'
          }}
        >
          <Zap size={12} color={isAgentLoop ? '#FFFFFF' : 'var(--accent, #D96B27)'} />
          <span>Agent Loop</span>
        </button>

        {/* 🐝 Swarm (Multi-Agent Concurrent Collaboration) */}
        <button
          type="button"
          onClick={() => onModeChange('swarm')}
          title="🐝 Swarm（多智能体并发协同网络）· 快捷键: Alt+2"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 9px',
            borderRadius: '4px',
            border: 'none',
            background: isSwarm ? 'var(--accent, #D96B27)' : 'transparent',
            color: isSwarm ? '#FFFFFF' : 'var(--text-secondary, #736B63)',
            fontSize: '11px',
            fontWeight: isSwarm ? 600 : 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
            boxShadow: isSwarm ? '0 1px 4px rgba(217, 107, 39, 0.28)' : 'none'
          }}
        >
          <Users size={12} color={isSwarm ? '#FFFFFF' : '#EA580C'} />
          <span>Swarm 协同</span>
        </button>
      </div>
    </div>
  );
};
