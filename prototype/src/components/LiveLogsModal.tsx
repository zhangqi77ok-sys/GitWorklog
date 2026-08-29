import React, { useState } from 'react';
import { X, Trash2, Copy, Check, Filter, Terminal, RefreshCw } from 'lucide-react';
import { LiveLogItem, liveLogStore } from '../types/contracts';

interface LiveLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: LiveLogItem[];
  onClearLogs: () => void;
}

export const LiveLogsModal: React.FC<LiveLogsModalProps> = ({
  isOpen,
  onClose,
  logs,
  onClearLogs
}) => {
  if (!isOpen) return null;

  const [filterLevel, setFilterLevel] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'NET'>('ALL');
  const [copied, setCopied] = useState(false);

  const filteredLogs = filterLevel === 'ALL'
    ? logs
    : logs.filter(l => l.level === filterLevel);

  const handleCopyAll = () => {
    const text = logs.map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.level}] [${l.module}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
      zIndex: 999,
      backdropFilter: 'blur(2px)'
    }}>
      <div style={{
        width: '680px',
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
              ● 实时监听中 ({logs.length})
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={handleCopyAll}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '3px 8px',
                borderRadius: '4px',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
                color: copied ? '#16A34A' : 'var(--text-secondary)',
                fontSize: '10.5px',
                cursor: 'pointer'
              }}
              title="复制全部日志到剪贴板"
            >
              {copied ? <Check size={11} color="#16A34A" /> : <Copy size={11} />}
              <span>{copied ? '已复制' : '复制日志'}</span>
            </button>

            <button
              onClick={onClearLogs}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '3px 8px',
                borderRadius: '4px',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                fontSize: '10.5px',
                cursor: 'pointer'
              }}
              title="清空日志记录"
            >
              <Trash2 size={11} />
              <span>清空</span>
            </button>

            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', marginLeft: '4px' }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div style={{
          padding: '6px 14px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-base)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '11px'
        }}>
          <Filter size={12} color="var(--text-muted)" />
          <span style={{ color: 'var(--text-muted)' }}>过滤级别:</span>
          {(['ALL', 'INFO', 'NET', 'WARN', 'ERROR'] as const).map(lvl => (
            <button
              key={lvl}
              onClick={() => setFilterLevel(lvl)}
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                border: 'none',
                background: filterLevel === lvl ? 'var(--accent)' : 'transparent',
                color: filterLevel === lvl ? '#FFF' : 'var(--text-secondary)',
                fontWeight: filterLevel === lvl ? 600 : 400,
                fontSize: '10.5px',
                cursor: 'pointer'
              }}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Log Viewer Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 14px',
          background: '#0D1117',
          color: '#C9D1D9',
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          fontSize: '11px',
          lineHeight: 1.5,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          {filteredLogs.length === 0 ? (
            <div style={{ color: '#8B949E', textAlign: 'center', margin: 'auto' }}>
              暂无符合条件的运行日志
            </div>
          ) : (
            filteredLogs.map(log => {
              const color = log.level === 'ERROR' ? '#F85149' : log.level === 'WARN' ? '#D29922' : log.level === 'NET' ? '#58A6FF' : '#3FB950';
              return (
                <div key={log.id} style={{ display: 'flex', gap: '8px', wordBreak: 'break-all' }}>
                  <span style={{ color: '#8B949E', flexShrink: 0 }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span style={{ color, fontWeight: 700, flexShrink: 0, width: '46px' }}>
                    [{log.level}]
                  </span>
                  <span style={{ color: '#79C0FF', flexShrink: 0 }}>
                    [{log.module}]
                  </span>
                  <span style={{ color: log.level === 'ERROR' ? '#FF7B72' : '#C9D1D9' }}>
                    {log.message}
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
