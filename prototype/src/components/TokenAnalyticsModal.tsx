import React from 'react';
import { X, Sparkles, TrendingUp } from 'lucide-react';
import { TokenStats, calculateTokenRoi } from '../types/contracts';

interface TokenAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: TokenStats;
}

export const TokenAnalyticsModal: React.FC<TokenAnalyticsModalProps> = ({
  isOpen,
  onClose,
  stats
}) => {
  if (!isOpen) return null;

  const roi = calculateTokenRoi(stats);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.48)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      userSelect: 'none'
    }}>
      <div style={{
        width: '680px',
        maxWidth: '92vw',
        background: 'var(--bg-surface-elevated)',
        borderRadius: '8px',
        border: '1px solid var(--border-strong)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.24)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={16} color="var(--accent)" />
            <span style={{ fontSize: '13px', fontWeight: 700 }}>Token 财务效益与研发 ROI 看板 (Analytics & ROI)</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--bg-surface-elevated)' }}>
          {/* Top 3 KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div style={{ padding: '12px', borderRadius: '6px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>总计费用 (本会话)</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent)' }}>
                ${stats.estimatedCostUsd.toFixed(3)}
              </div>
              <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Prompt: {stats.promptTokens} · Completion: {stats.completionTokens}
              </div>
            </div>

            <div style={{ padding: '12px', borderRadius: '6px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>KV Cache 命中效益</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#10B981' }}>
                {roi.cacheHitRatePercent}% 命中
              </div>
              <div style={{ fontSize: '9.5px', color: '#10B981', marginTop: '2px', fontWeight: 600 }}>
                已省 {Math.round(stats.cacheHitTokens / 1000)}k tokens (~${roi.savedCostUsd})
              </div>
            </div>

            <div style={{ padding: '12px', borderRadius: '6px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>代码生成产出 (ROI)</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                ~{roi.linesGeneratedApprox} 行代码
              </div>
              <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                单行成本: ${(stats.estimatedCostUsd / Math.max(1, roi.linesGeneratedApprox)).toFixed(5)}
              </div>
            </div>
          </div>

          {/* Model Breakdown Matrix */}
          <div style={{ padding: '12px 14px', borderRadius: '6px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-secondary)' }}>
              各厂商模型调用占比与效率对比:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { name: 'DeepSeek V4-Pro (R1 Reasoning)', share: '65%', cost: '$0.024', cache: '92%' },
                { name: 'Claude 3.5 Sonnet (Coding Specialist)', share: '25%', cost: '$0.011', cache: '82%' },
                { name: 'Zhipu GLM-4-Plus (Doc & Struct)', share: '10%', cost: '$0.003', cache: '75%' }
              ].map(m => (
                <div key={m.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '4px', background: 'var(--bg-base)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }} />
                    <span style={{ fontSize: '11px', fontWeight: 600 }}>{m.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '10.5px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>占比 {m.share}</span>
                    <span style={{ color: '#10B981', fontWeight: 600 }}>Cache: {m.cache}</span>
                    <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{m.cost}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tips for Token Optimization */}
          <div style={{ padding: '8px 12px', borderRadius: '4px', background: 'var(--accent-subtle)', border: '1px solid rgba(217, 107, 39, 0.2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={13} color="var(--accent)" />
            <span style={{ fontSize: '10.5px', color: 'var(--text-primary)' }}>
              <strong>提示</strong>：开启 <code>Minimal 极简低噪模式</code> 可再压制 80% 终端转轮冗余日志，每万行代码节省 $0.15。
            </span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '5px 16px',
              borderRadius: '4px',
              background: 'var(--accent)',
              border: 'none',
              color: '#FFF',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            完成并关闭
          </button>
        </div>
      </div>
    </div>
  );
};
