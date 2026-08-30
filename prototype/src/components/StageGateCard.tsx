import React, { useState } from 'react';
import { Check, MessageSquarePlus, Square, FileText, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import type { StageGateEvent, StageGateDecision } from '../services/stageGate';

interface StageGateCardProps {
  gate: StageGateEvent;
  onDecision: (decision: StageGateDecision) => void;
  onEnterFeedback: () => void;
  onOpenSpec?: (path: string) => void;
}

/**
 * WP-B 模块五：方案终审卡（Stage Gate）。
 * 工作流阶段结束挂起时弹出，未经用户批准绝不进入写码阶段。
 * 三种决策：批准 / 提修改意见（切到输入框意见模式）/ 终止。
 */
export const StageGateCard: React.FC<StageGateCardProps> = ({
  gate,
  onDecision,
  onEnterFeedback,
  onOpenSpec
}) => {
  const [expanded, setExpanded] = useState(false);
  const tasks = gate.taskBreakdown || [];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px 14px',
      borderRadius: '12px',
      background: 'linear-gradient(135deg, rgba(217, 107, 39, 0.10), rgba(217, 107, 39, 0.03))',
      border: '1.5px solid var(--accent)',
      boxShadow: '0 8px 24px rgba(217, 107, 39, 0.14)',
      fontSize: '12px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldCheck size={14} color="var(--accent)" />
          <span style={{ fontWeight: 800, color: 'var(--accent)', fontSize: '12.5px' }}>🚦 方案终审 · Stage Gate</span>
          <span style={{ fontSize: '9.5px', padding: '1px 6px', borderRadius: '8px', background: 'var(--bg-base)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {gate.gateId}
          </span>
        </div>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>流程已挂起 · 等待人工裁决</span>
      </div>

      {/* Stage name + summary */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>📋 {gate.stageName}</div>
        <div style={{
          color: 'var(--text-secondary)',
          fontSize: '11.5px',
          lineHeight: 1.55,
          maxHeight: expanded ? 'none' : '72px',
          overflow: 'hidden',
          whiteSpace: 'pre-wrap'
        }}>
          {gate.summary || '（本轮未产出文字方案摘要）'}
        </div>
        {gate.summary && gate.summary.length > 90 && (
          <button
            onClick={() => setExpanded(prev => !prev)}
            style={{
              alignSelf: 'flex-start',
              border: 'none',
              background: 'transparent',
              color: 'var(--accent)',
              fontSize: '10px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}
          >
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {expanded ? '收起' : '展开全文'}
          </button>
        )}
      </div>

      {/* Spec artifact */}
      {gate.specPath && (
        <button
          onClick={() => onOpenSpec?.(gate.specPath!)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 9px',
            borderRadius: '6px',
            background: 'var(--bg-base)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--accent)',
            fontSize: '10.5px',
            fontWeight: 600,
            cursor: 'pointer',
            alignSelf: 'flex-start',
            fontFamily: 'var(--font-mono)'
          }}
          title="点击在工作台预览 Spec 文档"
        >
          <FileText size={11} />
          <span>{gate.specPath}</span>
        </button>
      )}

      {/* Task breakdown */}
      {tasks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '7px 9px', background: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>任务拆解（批准后将按此执行）</div>
          {tasks.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', fontSize: '10.5px', color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>▪</span>
              <span>{t}</span>
            </div>
          ))}
        </div>
      )}

      {/* Decision actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
        <button
          onClick={() => onDecision({ approved: true })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '5px 12px',
            borderRadius: '7px',
            border: 'none',
            background: 'var(--status-safe)',
            color: '#FFF',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'opacity 0.12s'
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <Check size={12} />
          <span>批准方案</span>
        </button>
        <button
          onClick={onEnterFeedback}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '5px 12px',
            borderRadius: '7px',
            border: '1px solid var(--accent)',
            background: 'transparent',
            color: 'var(--accent)',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.12s'
          }}
        >
          <MessageSquarePlus size={12} />
          <span>提修改意见</span>
        </button>
        <button
          onClick={() => onDecision({ approved: false })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '5px 12px',
            borderRadius: '7px',
            border: '1px solid var(--status-danger)',
            background: 'transparent',
            color: 'var(--status-danger)',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.12s'
          }}
        >
          <Square size={11} />
          <span>终止流程</span>
        </button>
        <span style={{ marginLeft: 'auto', fontSize: '9.5px', color: 'var(--text-muted)' }}>
          未批准前 Agent 不会写入任何代码
        </span>
      </div>
    </div>
  );
};
