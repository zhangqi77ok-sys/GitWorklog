import React, { useState } from 'react';
import { CheckCircle2, Circle, CheckSquare, Square, Sparkles, Send } from 'lucide-react';
import { AskOptionsPayload } from '../types/contracts';

interface OptionsCardProps {
  payload: AskOptionsPayload;
  onConfirm: (selectedIds: string[], customInput?: string) => void;
}

export const OptionsCard: React.FC<OptionsCardProps> = ({ payload, onConfirm }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    payload.resolvedSelection || (payload.options.find(o => o.isRecommended)?.id ? [payload.options.find(o => o.isRecommended)!.id] : [])
  );
  const [customText, setCustomText] = useState(payload.customInput || '');
  const isResolved = payload.status === 'resolved';

  const handleToggle = (id: string) => {
    if (isResolved) return;
    if (payload.single_select) {
      setSelectedIds([id]);
    } else {
      setSelectedIds(prev =>
        prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
      );
    }
  };

  if (isResolved) {
    const selectedLabels = payload.options
      .filter(o => payload.resolvedSelection?.includes(o.id))
      .map(o => o.label)
      .join(', ');

    return (
      <div style={{
        padding: '6px 12px',
        borderRadius: '6px',
        background: 'rgba(22, 163, 74, 0.08)',
        border: '1px solid rgba(22, 163, 74, 0.2)',
        fontSize: '11px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        margin: '8px 0'
      }}>
        <CheckCircle2 size={13} color="#16A34A" />
        <span style={{ fontWeight: 600, color: '#16A34A' }}>决策已采纳:</span>
        <span style={{ color: 'var(--text-primary)' }}>{selectedLabels || payload.customInput}</span>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--bg-surface-elevated)',
      border: '1px solid var(--accent)',
      borderRadius: '8px',
      padding: '12px',
      margin: '10px 0',
      boxShadow: '0 4px 16px rgba(217, 107, 39, 0.08)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--accent)' }}>
        <Sparkles size={14} />
        <span style={{ fontWeight: 600, fontSize: '12px' }}>智能体决策分叉请求 (需要您抉择)</span>
      </div>
      <p style={{ fontSize: '12px', marginBottom: '10px', color: 'var(--text-primary)', fontWeight: 500 }}>
        {payload.question}
      </p>

      {/* Options List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
        {payload.options.map(option => {
          const isSelected = selectedIds.includes(option.id);
          return (
            <div
              key={option.id}
              onClick={() => handleToggle(option.id)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '6px',
                background: isSelected ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ marginTop: '2px', color: isSelected ? 'var(--accent)' : 'var(--text-muted)' }}>
                {payload.single_select ? (
                  isSelected ? <CheckCircle2 size={15} /> : <Circle size={15} />
                ) : (
                  isSelected ? <CheckSquare size={15} /> : <Square size={15} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: isSelected ? 600 : 500, fontSize: '12px' }}>{option.label}</span>
                  {option.isRecommended && (
                    <span style={{
                      padding: '1px 5px',
                      borderRadius: '3px',
                      background: 'rgba(217, 107, 39, 0.15)',
                      color: 'var(--accent)',
                      fontSize: '10px',
                      fontWeight: 600
                    }}>
                      推荐
                    </span>
                  )}
                </div>
                {option.description && (
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {option.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom input */}
      {payload.allow_custom_input && (
        <div style={{ marginBottom: '10px' }}>
          <input
            type="text"
            placeholder="自定义补充说明或特殊要求（可选）..."
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: '4px',
              border: '1px solid var(--border-strong)',
              background: 'var(--bg-base)',
              fontSize: '11px',
              color: 'var(--text-primary)',
              outline: 'none'
            }}
          />
        </div>
      )}

      {/* Confirm button */}
      <button
        onClick={() => onConfirm(selectedIds, customText)}
        disabled={selectedIds.length === 0 && !customText.trim()}
        style={{
          padding: '6px 14px',
          borderRadius: '4px',
          background: 'var(--accent)',
          color: '#FFF',
          border: 'none',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        <Send size={12} />
        <span>确认并唤醒智能体继续</span>
      </button>
    </div>
  );
};
