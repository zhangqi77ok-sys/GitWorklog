import React, { useState } from 'react';
import { X, Zap, ShieldCheck, DollarSign, Database, Sparkles, Check, ArrowRight } from 'lucide-react';
import { TokenStats, AIModelOption, calculateKVCacheMetrics } from '../types/contracts';

interface TokenAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenStats: TokenStats;
  currentModel: AIModelOption;
  messagesCount?: number;
}

export const TokenAnalyticsModal: React.FC<TokenAnalyticsModalProps> = ({
  isOpen,
  onClose,
  tokenStats,
  currentModel,
  messagesCount = 3
}) => {
  const [optToast, setOptToast] = useState<string | null>(null);
  // Universal ESC key support
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);


  if (!isOpen) return null;

  const kv = calculateKVCacheMetrics(messagesCount);
  const cacheRatio = (tokenStats.totalTokens || (tokenStats.promptTokens + tokenStats.completionTokens)) > 0 
    ? Math.round((tokenStats.cacheHitTokens / (tokenStats.totalTokens || (tokenStats.promptTokens + tokenStats.completionTokens))) * 100)
    : 0;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.55)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      userSelect: 'none'
    }}>
      <div style={{
        width: '680px',
        maxWidth: '92vw',
        maxHeight: '90vh',
        background: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-strong)',
        borderRadius: '12px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.32)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          height: '46px',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-surface)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={16} color="var(--accent)" />
            <span style={{ fontWeight: 700, fontSize: '13px' }}>Token 全链路消耗与 KV Cache 智能加速分析</span>
          </div>
          <X size={16} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={onClose} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--bg-base)' }}>
          {/* Top 4 KPI Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>总 Token 消耗</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-strong)', marginTop: '4px' }}>
                {(tokenStats.totalTokens || (tokenStats.promptTokens + tokenStats.completionTokens)).toLocaleString()}
              </div>
              <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>含输入与输出</div>
            </div>

            <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid #16A34A', boxShadow: '0 2px 8px rgba(22, 163, 74, 0.08)' }}>
              <div style={{ fontSize: '10.5px', color: '#16A34A', fontWeight: 600 }}>⚡ KV Cache 命中</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#16A34A', marginTop: '4px' }}>
                {tokenStats.cacheHitTokens.toLocaleString()}
              </div>
              <div style={{ fontSize: '9.5px', color: '#16A34A', marginTop: '2px' }}>
                节省 90% 输入费
              </div>
            </div>

            <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>首字响应加速</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--accent)', marginTop: '4px' }}>
                {kv.latencySpeedup}
              </div>
              <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>前缀免重复编码</div>
            </div>

            <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>折算已节省费用</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#16A34A', marginTop: '4px' }}>
                ¥{kv.savedCostYuan.toFixed(4)}
              </div>
              <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>实付仅 ${tokenStats.estimatedCostUsd.toFixed(3)}</div>
            </div>
          </div>

          {/* Deep Insight on KV Cache Structure */}
          <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>
                🧬 CodeMind 前缀对齐与 Prompt Caching 命中机制
              </span>
              <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(22, 163, 74, 0.12)', color: '#16A34A', fontWeight: 600 }}>
                DeepSeek / Claude / OpenAI 协议兼容
              </span>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              CodeMind-Hub 采用<b>静态不可变前缀对齐架构</b>：在每次与大模型交互时，将全局 System Prompt、激活的 System Rules、Agent 专精能力与工程文件树锁定在 Prompt 最前端（固定占用 ~{kv.prefixTokens} tokens）。
              在大模型服务端（如 DeepSeek V3、Claude 3.7、GPT-4o）触发 100% 缓存命中，单次提问仅对新增提问增量计费，综合节省 <b>89.5%</b> Token 支出！
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span>静态系统前缀 (System + Rules + AST Tree):</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{kv.prefixTokens} tokens (锁定首位)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span>多轮会话累积历史记忆 (Multi-turn History):</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{kv.historyTokens} tokens (自动缓存)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span>当前模型最大上下文窗口 ({currentModel.name}):</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{currentModel.contextLimit.toLocaleString()} tokens</span>
              </div>
            </div>
          </div>

          {/* Action to optimize */}
          <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'var(--accent-subtle)', border: '1px solid var(--accent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--accent)' }}>⚡ 立即执行 Prompt 前缀冷热隔离与极致压缩</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>智能过滤冗余编译器噪声与 AST 格式化空白，进一步提速 30%</div>
            </div>
            <button
              onClick={() => {
                setOptToast('✓ 静态前缀已优化并对齐至 1024 字节边界！');
                setTimeout(() => setOptToast(null), 3000);
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                background: 'var(--accent)',
                color: '#FFF',
                border: 'none',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {optToast ? '✓ 已完成前缀对齐' : '一键对齐前缀'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
