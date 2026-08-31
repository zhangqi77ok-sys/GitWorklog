import React, { useState } from 'react';
import { Terminal, Check, Copy, ChevronDown, ChevronUp, Loader2, XCircle, Play } from 'lucide-react';
import { ActionResult } from '../types/contracts';

interface TerminalOutputCardProps {
  command: string;
  result?: ActionResult;
  isExecuting?: boolean;
  onAbort?: () => void;
}

export const TerminalOutputCard: React.FC<TerminalOutputCardProps> = ({
  command,
  result,
  isExecuting = false,
  onAbort
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const isSuccess = result?.status === 'success';
  const isFailed = result?.status === 'failed';
  const isRejected = result?.status === 'rejected';

  const outputText = (result?.output || '') + (result?.error ? `\n[STDERR]:\n${result.error}` : '');

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      margin: '6px 0',
      borderRadius: '6px',
      overflow: 'hidden',
      border: '1px solid var(--border-subtle)',
      background: '#18181B',
      color: '#E4E4E7',
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
    }}>
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '6px 10px',
          background: '#27272A',
          borderBottom: isExpanded ? '1px solid #3F3F46' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
          <Terminal size={13} color="var(--accent)" />
          <span style={{ color: '#A1A1AA', fontSize: '10px' }}>$</span>
          <span style={{
            color: '#F4F4F5',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {command}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Status Badge */}
          {isExecuting && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent)', fontSize: '10px', fontWeight: 600 }}>
              <Loader2 size={11} className="animate-spin" /> 执行中...
            </span>
          )}
          {isSuccess && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#22C55E', fontSize: '10px', fontWeight: 600 }}>
              <Check size={11} /> 退出码 0
            </span>
          )}
          {isFailed && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#EF4444', fontSize: '10px', fontWeight: 600 }}>
              <XCircle size={11} /> 退出码 {result?.exitCode ?? 1}
            </span>
          )}
          {isRejected && (
            <span style={{ color: '#F59E0B', fontSize: '10px', fontWeight: 600 }}>
              已拦截
            </span>
          )}

          {/* Copy Command Button */}
          <button
            onClick={handleCopy}
            title="复制命令"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#A1A1AA',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '2px'
            }}
          >
            {copied ? <Check size={11} color="#22C55E" /> : <Copy size={11} />}
          </button>

          {/* Abort button if executing */}
          {isExecuting && onAbort && (
            <button
              onClick={(e) => { e.stopPropagation(); onAbort(); }}
              style={{
                padding: '1px 6px',
                borderRadius: '3px',
                background: '#DC2626',
                color: '#FFF',
                border: 'none',
                fontSize: '9.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              中断
            </button>
          )}

          {isExpanded ? <ChevronUp size={12} color="#A1A1AA" /> : <ChevronDown size={12} color="#A1A1AA" />}
        </div>
      </div>

      {/* Terminal Stream Console Body */}
      {isExpanded && (
        <div style={{
          padding: '8px 10px',
          maxHeight: '180px',
          overflowY: 'auto',
          lineHeight: '1.45',
          fontSize: '10.5px',
          color: isFailed ? '#FCA5A5' : '#D4D4D8',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all'
        }}>
          {outputText.trim() ? outputText : isExecuting ? '⏳ 正在等待标准输出流...' : '(终端无输出)'}
        </div>
      )}
    </div>
  );
};
