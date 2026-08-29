import React, { useState } from 'react';
import { Layers, ChevronDown, ShieldCheck, Zap, X, Minus, Square, Info } from 'lucide-react';
import { TokenStats, calculateTokenSavingsPercent, getContextGaugeLevel } from '../types/contracts';

interface TitlebarProps {
  currentProject: string;
  gitBranch: string;
  sessionTitle: string;
  tokenStats: TokenStats;
}

export const Titlebar: React.FC<TitlebarProps> = ({
  currentProject,
  gitBranch,
  sessionTitle,
  tokenStats
}) => {
  const [showTokenPopover, setShowTokenPopover] = useState(false);
  const savings = calculateTokenSavingsPercent(tokenStats);
  const gaugeLevel = getContextGaugeLevel(tokenStats.contextCurrentTokens, tokenStats.contextMaxTokens);

  const gaugeColors = {
    safe: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626'
  };

  const totalTokensK = (
    (tokenStats.promptTokens + tokenStats.completionTokens + tokenStats.cacheHitTokens) / 1000
  ).toFixed(1);

  return (
    <header style={{
      height: '38px',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      fontSize: '12px',
      position: 'relative',
      zIndex: 50
    }}>
      {/* Left: Brand & Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '18px',
          height: '18px',
          borderRadius: '4px',
          background: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFF',
          fontWeight: 'bold',
          fontSize: '11px'
        }}>
          C
        </div>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>CodeMind-Hub</span>
        <span style={{ color: 'var(--text-muted)' }}>›</span>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 6px',
          borderRadius: '4px',
          background: 'var(--bg-base)',
          border: '1px solid var(--border-subtle)',
          cursor: 'pointer'
        }}>
          <span>📁 {currentProject}</span>
          <span style={{ color: 'var(--accent)', fontSize: '11px' }}>({gitBranch})</span>
          <ChevronDown size={12} color="var(--text-muted)" />
        </div>
      </div>

      {/* Center: Current active session */}
      <div style={{
        color: 'var(--text-secondary)',
        fontWeight: 500,
        maxWidth: '320px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}>
        💬 {sessionTitle}
      </div>

      {/* Right: Token Telemetry HUD Capsule & Window controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Token Capsule */}
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => setShowTokenPopover(!showTokenPopover)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px',
              borderRadius: '12px',
              background: 'var(--bg-base)',
              border: `1px solid ${showTokenPopover ? 'var(--accent)' : 'var(--border-subtle)'}`,
              cursor: 'pointer',
              fontSize: '11px'
            }}
          >
            <div style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: gaugeColors[gaugeLevel]
            }} />
            <span style={{ fontWeight: 600 }}>📊 {totalTokensK}k tokens</span>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <span style={{ color: 'var(--status-safe)' }}>Cache {savings}%</span>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <span style={{ color: 'var(--accent)' }}>${tokenStats.estimatedCostUsd.toFixed(3)}</span>
          </div>

          {/* Token Dropdown Breakdown Popover */}
          {showTokenPopover && (
            <div style={{
              position: 'absolute',
              top: '28px',
              right: '0',
              width: '280px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-strong)',
              borderRadius: '6px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              padding: '12px',
              zIndex: 100
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                <span style={{ fontWeight: 600 }}>会话 Token 全链路账单</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>L0/L1/L2 记忆</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>输入 (Prompt):</span>
                  <span>{tokenStats.promptTokens.toLocaleString()} tokens</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>输出 (Completion):</span>
                  <span>{tokenStats.completionTokens.toLocaleString()} tokens</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--status-safe)' }}>KV Cache 命中:</span>
                  <span style={{ color: 'var(--status-safe)', fontWeight: 600 }}>{tokenStats.cacheHitTokens.toLocaleString()} tokens (省90%)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>当前上下文水位:</span>
                  <span>{Math.round((tokenStats.contextCurrentTokens / tokenStats.contextMaxTokens) * 100)}% ({Math.round(tokenStats.contextCurrentTokens / 1000)}k / {Math.round(tokenStats.contextMaxTokens / 1000)}k)</span>
                </div>
                {/* Water Level Bar */}
                <div style={{ height: '4px', background: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${(tokenStats.contextCurrentTokens / tokenStats.contextMaxTokens) * 100}%`,
                    height: '100%',
                    background: gaugeColors[gaugeLevel]
                  }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Window Handle Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
          <Minus size={13} style={{ cursor: 'pointer' }} />
          <Square size={11} style={{ cursor: 'pointer' }} />
          <X size={13} style={{ cursor: 'pointer' }} />
        </div>
      </div>
    </header>
  );
};
