import React, { useState, useEffect } from 'react';
import { getCachedTelemetryStats, CacheTelemetryStats } from '../services/cacheEngine';
import { Layers, ChevronDown, ShieldCheck, Zap, X, Minus, Square, Info, TrendingUp } from 'lucide-react';
import { TokenStats, calculateTokenSavingsPercent, getContextGaugeLevel } from '../types/contracts';

interface TitlebarProps {
  currentProject: string;
  gitBranch: string;
  sessionTitle: string;
  tokenStats: TokenStats;
  onOpenTokenAnalytics?: () => void;
}

export const Titlebar: React.FC<TitlebarProps> = ({
  currentProject,
  gitBranch,
  sessionTitle,
  tokenStats,
  onOpenTokenAnalytics
}) => {
  const [showTokenPopover, setShowTokenPopover] = useState(false);
  const [cacheStats, setCacheStats] = useState<CacheTelemetryStats>(() => getCachedTelemetryStats());
  const [showCachePopover, setShowCachePopover] = useState(false);

  useEffect(() => {
    const handleCacheUpdate = (e: any) => {
      if (e.detail) setCacheStats(e.detail);
    };
    window.addEventListener('tcode_cache_telemetry_updated', handleCacheUpdate);
    return () => window.removeEventListener('tcode_cache_telemetry_updated', handleCacheUpdate);
  }, []);

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
    <header
      className="pywebview-drag-region"
      style={{
        height: '38px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 0 0 12px',
        fontSize: '12px',
        position: 'relative',
        zIndex: 50,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitAppRegion: 'drag'
      } as any}
    >
      {/* Left: Brand & Breadcrumb */}
      <div className="pywebview-no-drag" style={{ display: 'flex', alignItems: 'center', gap: '8px', WebkitAppRegion: 'no-drag' } as any}>
        <img
          src="/logo.svg"
          alt="Tcode Logo"
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '4px',
            display: 'block'
          }}
        />
        <span style={{ fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>Tcode</span>
        {currentProject ? (
          <>
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
              {gitBranch && <span style={{ color: 'var(--accent)', fontSize: '11px' }}>({gitBranch})</span>}
              <ChevronDown size={12} color="var(--text-muted)" />
            </div>
          </>
        ) : (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '2px' }}>
            · 未打开工作区
          </span>
        )}
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
      <div className="pywebview-no-drag" style={{ display: 'flex', alignItems: 'center', gap: '12px', WebkitAppRegion: 'no-drag' } as any}>
        {/* Air-gapped PII Shield Capsule */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 8px',
          borderRadius: '12px',
          background: 'rgba(22, 163, 74, 0.08)',
          border: '1px solid rgba(22, 163, 74, 0.25)',
          color: '#16A34A',
          fontSize: '11px',
          fontWeight: 600
        }} title="金融级离线脱敏盾牌：API Key 与数据库密码已内存虚拟化脱敏">
          <ShieldCheck size={12} />
          <span>离线脱敏盾牌</span>
        </div>

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
          </div>

          {/* Token Dropdown Breakdown Popover */}
          {showTokenPopover && (
            <div style={{
              position: 'absolute',
              top: '32px',
              right: '0',
              left: 'auto',
              width: 'min(300px, calc(100vw - 40px))',
              maxWidth: 'calc(100vw - 40px)',
              maxHeight: 'min(420px, 70vh)',
              overflowY: 'auto',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-strong)',
              borderRadius: '8px',
              boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
              padding: '12px',
              zIndex: 300
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
                  <span style={{ color: 'var(--text-secondary)' }}>本轮有效输入水位:</span>
                  <span>{Math.round((tokenStats.contextCurrentTokens / tokenStats.contextMaxTokens) * 100)}% ({Math.round(tokenStats.contextCurrentTokens / 1000)}k / {Math.round(tokenStats.contextMaxTokens / 1000)}k)</span>
                </div>
                {/* Water Level Bar */}
                <div style={{ height: '4px', background: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, (tokenStats.contextCurrentTokens / tokenStats.contextMaxTokens) * 100)}%`,
                    height: '100%',
                    background: gaugeColors[gaugeLevel]
                  }} />
                </div>
                <button
                  onClick={() => {
                    setShowTokenPopover(false);
                    if (onOpenTokenAnalytics) onOpenTokenAnalytics();
                  }}
                  style={{
                    marginTop: '8px',
                    width: '100%',
                    padding: '5px 8px',
                    borderRadius: '4px',
                    background: 'var(--accent)',
                    border: 'none',
                    color: '#FFF',
                    fontSize: '10.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <TrendingUp size={12} />
                  <span>打开完整 Token 财务与 ROI 看板</span>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Far Right: Native Frameless Window Action Controls (Minimize, Maximize, Close) */}
      <div
        className="pywebview-no-drag"
        style={{
          display: 'flex',
          alignItems: 'center',
          height: '100%',
          WebkitAppRegion: 'no-drag'
        } as any}
      >
        <button
          onClick={() => fetch('/api/window/minimize')}
          style={{
            width: '44px',
            height: '100%',
            background: 'transparent',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            transition: 'background 0.15s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.06)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          title="最小化"
        >
          <Minus size={14} />
        </button>

        <button
          onClick={() => fetch('/api/window/maximize')}
          style={{
            width: '44px',
            height: '100%',
            background: 'transparent',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            transition: 'background 0.15s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.06)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          title="最大化 / 还原"
        >
          <Square size={12} />
        </button>

        <button
          onClick={() => fetch('/api/window/close')}
          style={{
            width: '46px',
            height: '100%',
            background: 'transparent',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#E81123';
            e.currentTarget.style.color = '#FFFFFF';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
          title="关闭"
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
};
