import React from 'react';
import { Bot, CheckCircle2, Clock, AlertTriangle, Sparkles } from 'lucide-react';
import { SwarmAgentState, INITIAL_SWARM_AGENTS } from '../types/contracts';

interface SwarmPipelineBarProps {
  agents?: SwarmAgentState[];
}

export const SwarmPipelineBar: React.FC<SwarmPipelineBarProps> = ({
  agents = INITIAL_SWARM_AGENTS
}) => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '3px 8px',
      borderRadius: '16px',
      background: 'rgba(0,0,0,0.03)',
      border: '1px solid var(--border-subtle)',
      fontSize: '10.5px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent)', fontWeight: 700 }}>
        <Bot size={12} />
        <span>Swarm 协同:</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {agents.map((ag, idx) => {
          const isCompleted = ag.status === 'completed';
          const isRunning = ag.status === 'running';

          return (
            <React.Fragment key={ag.role}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: isCompleted ? 'rgba(22, 163, 74, 0.1)' : isRunning ? 'rgba(217, 107, 39, 0.12)' : 'var(--bg-base)',
                  border: isRunning ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                  color: isCompleted ? '#16A34A' : isRunning ? 'var(--accent)' : 'var(--text-muted)',
                  fontWeight: isRunning ? 700 : 500
                }}
                title={`${ag.name} (${ag.model}): ${ag.outputSummary || '等待阶段就绪'}`}
              >
                {isCompleted && <CheckCircle2 size={10} />}
                {isRunning && <Sparkles size={10} />}
                <span>{ag.name}</span>
                <span style={{ fontSize: '9px', opacity: 0.8 }}>({ag.model.split('-')[0]})</span>
              </div>
              {idx < agents.length - 1 && (
                <span style={{ color: 'var(--text-muted)', fontSize: '9px' }}>➔</span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
