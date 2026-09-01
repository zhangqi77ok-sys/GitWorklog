import React, { useState, useEffect } from 'react';
import { X, Trash2, Copy, Check, Filter, Terminal, RefreshCw } from 'lucide-react';
import { LiveLogItem } from '../types/contracts';

interface LiveLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs?: LiveLogItem[];
  onClearLogs: () => void;
}

export const LiveLogsModal: React.FC<LiveLogsModalProps> = ({
  isOpen,
  onClose,
  logs = [],
  onClearLogs
}) => {
  const [filterLevel, setFilterLevel] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'NET'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = React.useRef<HTMLDivElement>(null);

  // Universal ESC key support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const safeLogs = Array.isArray(logs) ? logs : [];
  const filteredLogs = safeLogs.filter(l => {
    if (!l) return false;
    if (filterLevel !== 'ALL' && l.level !== filterLevel) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMsg = (l.message || '').toLowerCase().includes(q);
      const matchMod = (l.module || '').toLowerCase().includes(q);
      if (!matchMsg && !matchMod) return false;
    }
    return true;
  });

  // Auto scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs.length, autoScroll]);

  const handleCopyAll = () => {
    const text = filteredLogs.map(l => `[${new Date(l?.timestamp || Date.now()).toLocaleTimeString()}] [${l?.level || 'INFO'}] [${l?.module || 'App'}] ${l?.message || ''}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportLogs = () => {
    const text = filteredLogs.map(l => `[${new Date(l?.timestamp || Date.now()).toISOString()}] [${l?.level || 'INFO'}] [${l?.module || 'App'}] ${l?.message || ''}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tcode-live-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.55)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        width: '720px',
        maxWidth: '92vw',
        maxHeight: '80vh',
        height: '540px',
        background: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-strong)',
        borderRadius: '8px',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={16} color="var(--accent)" />
            <span style={{ fontWeight: 700, fontSize: '13px' }}>实时运行与网关日志 (Live Logs)</span>
            <span style={{
              fontSize: '10px',
              padding: '1px 6px',
              borderRadius: '10px',
              background: 'rgba(22, 163, 74, 0.1)',
              color: '#16A34A',
              fontWeight: 600
            }}>
              ● 实时监听中 ({safeLogs.length})
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={handleExportLogs}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '4px',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                cursor: 'pointer'
              }}
              title="导出全部日志为 .log 文件"
            >
              <RefreshCw size={12} />
              <span>导出日志</span>
            </button>

            <button
              onClick={handleCopyAll}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '4px',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                cursor: 'pointer'
              }}
              title="复制全部日志"
            >
              {copied ? <Check size={12} color="#16A34A" /> : <Copy size={12} />}
              <span>{copied ? '已复制' : '复制全部'}</span>
            </button>

            <button
              onClick={onClearLogs}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '4px',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                fontSize: '11px',
                cursor: 'pointer'
              }}
              title="清空日志"
            >
              <Trash2 size={12} />
              <span>清空</span>
            </button>

            <button
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                padding: '3px 8px',
                borderRadius: '4px',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              title="关闭 (Esc)"
            >
              <X size={12} />
              <span>关闭 (ESC)</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div style={{
          padding: '6px 14px',
          background: 'var(--bg-base)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={12} color="var(--text-muted)" />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '2px' }}>级别:</span>
            {(['ALL', 'INFO', 'WARN', 'ERROR', 'NET'] as const).map(lvl => (
              <button
                key={lvl}
                onClick={() => setFilterLevel(lvl)}
                style={{
                  padding: '1px 7px',
                  borderRadius: '3px',
                  background: filterLevel === lvl ? 'var(--accent)' : 'var(--bg-surface)',
                  color: filterLevel === lvl ? '#FFF' : 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '10px',
                  fontWeight: filterLevel === lvl ? 700 : 500,
                  cursor: 'pointer'
                }}
              >
                {lvl}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="text"
              placeholder="搜索日志关键字..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                padding: '2px 8px',
                fontSize: '11px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                outline: 'none',
                width: '160px'
              }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={e => setAutoScroll(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              自动滚底
            </label>
          </div>
        </div>

        {/* Logs Stream Body */}
        <div
          ref={logContainerRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 12px',
            background: '#0B1120',
            fontFamily: 'Consolas, "Fira Code", monospace',
            fontSize: '11px',
            lineHeight: 1.5
          }}
        >
          {filteredLogs.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
              暂无符合条件的运行日志
            </div>
          ) : (
            filteredLogs.map(l => {
              const lvlColor = l?.level === 'ERROR'
                ? '#F87171'
                : l?.level === 'WARN'
                ? '#FBBF24'
                : l?.level === 'NET'
                ? '#38BDF8'
                : '#A7F3D0';

              return (
                <div key={l?.id || Math.random()} style={{ display: 'flex', gap: '8px', marginBottom: '3px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  <span style={{ color: '#64748B', flexShrink: 0 }}>
                    {new Date(l?.timestamp || Date.now()).toLocaleTimeString()}
                  </span>
                  <span style={{ color: lvlColor, fontWeight: 700, flexShrink: 0, width: '48px' }}>
                    [{l?.level || 'INFO'}]
                  </span>
                  <span style={{ color: '#94A3B8', flexShrink: 0 }}>
                    [{l?.module || 'App'}]
                  </span>
                  <span style={{ color: '#E2E8F0', flex: 1 }}>
                    {l?.message || ''}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
