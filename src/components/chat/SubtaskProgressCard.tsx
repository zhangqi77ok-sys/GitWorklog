import React from 'react';
import { CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react';
import type { Subtask } from '../../types';

interface SubtaskProgressCardProps {
  subtasks: Subtask[];
}

export const SubtaskProgressCard: React.FC<SubtaskProgressCardProps> = ({ subtasks }) => {
  if (!subtasks || subtasks.length === 0) return null;

  return (
    <div
      style={{
        margin: '12px 0',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px', color: 'var(--accent)' }}>
        🎯 目标规划与执行链 (DAG Planning Rail)
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {subtasks.map((task) => {
          let icon = <Circle size={14} color="var(--text-muted)" />;
          let color = 'var(--text-secondary)';

          if (task.status === 'completed') {
            icon = <CheckCircle2 size={14} color="var(--status-safe)" />;
            color = 'var(--text-primary)';
          } else if (task.status === 'running') {
            icon = <Clock size={14} color="var(--accent)" className="animate-pulse-glow" />;
            color = 'var(--accent)';
          } else if (task.status === 'failed') {
            icon = <AlertCircle size={14} color="var(--status-danger)" />;
            color = 'var(--status-danger)';
          }

          return (
            <div
              key={task.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color,
              }}
            >
              {icon}
              <span style={{ fontWeight: task.status === 'running' ? 600 : 400 }}>
                {task.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
