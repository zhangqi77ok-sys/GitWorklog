import React, { useState } from 'react';
import { Copy, Check, Terminal, Code2, FileCode, ChevronDown, ChevronUp, ExternalLink, CheckCircle2, AlertCircle, XCircle, Loader2, Clock } from 'lucide-react';
import { ActionResult } from '../types/contracts';
import { getActionResultForId, parseAgentActions } from '../services/agentLoop';

interface MarkdownCardProps {
  content: string;
  isStreaming?: boolean;
  actionResults?: ActionResult[];
  onOpenFile?: (filePath: string) => void;
}

interface CodeBlockCardProps {
  language: string;
  code: string;
  executionResult?: ActionResult;
  executionStatus?: ActionResult['status'];
  onOpenFile?: (filePath: string) => void;
}

// ── Status Badge Component ──────────────────────────────────
const StatusBadge: React.FC<{ status?: ActionResult['status'] }> = ({ status }) => {
  if (!status) return null;

  const styles: Record<string, { bg: string; color: string; icon: React.ReactNode; text: string }> = {
    pending: {
      bg: 'rgba(59, 130, 246, 0.2)',
      color: '#60A5FA',
      icon: <Clock size={11} style={{ animation: 'pulse 1.25s ease-in-out infinite' }} />,
      text: '等待审批...'
    },
    executing: {
      bg: 'rgba(234, 179, 8, 0.2)',
      color: '#FBBF24',
      icon: <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />,
      text: '执行中...'
    },
    success: {
      bg: 'rgba(34, 197, 94, 0.18)',
      color: '#4ADE80',
      icon: <CheckCircle2 size={11} />,
      text: '已执行'
    },
    failed: {
      bg: 'rgba(239, 68, 68, 0.18)',
      color: '#F87171',
      icon: <AlertCircle size={11} />,
      text: '执行失败'
    },
    rejected: {
      bg: 'rgba(148, 163, 184, 0.18)',
      color: '#94A3B8',
      icon: <XCircle size={11} />,
      text: '已拒绝'
    }
  };

  const s = styles[status];
  if (!s) return null;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '3px',
      fontSize: '10px',
      padding: '1px 6px',
      borderRadius: '3px',
      background: s.bg,
      color: s.color,
      fontWeight: 600,
      letterSpacing: '0.3px'
    }}>
      {s.icon}
      {s.text}
    </span>
  );
};

// ── CodeBlockCard (Display-Only) ────────────────────────────
const CodeBlockCard: React.FC<CodeBlockCardProps> = ({
  language,
  code,
  executionResult,
  executionStatus,
  onOpenFile
}) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const cleanLang = (language || '').trim();
  const isWriteFile = cleanLang.startsWith('write_file:') || cleanLang.startsWith('file:') || cleanLang.startsWith('create_file:');
  const targetFilePath = isWriteFile ? cleanLang.replace(/^(write_file:|file:|create_file:)/, '').trim() : '';
  const isCommandLang = parseAgentActions(`\`\`\`${cleanLang}\n${code}\n\`\`\``).some(action => action.type === 'run_command');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const status = executionStatus ?? executionResult?.status;

  // ─── 1. File Write Card (Collapsible, Display-Only) ───
  if (isWriteFile && targetFilePath) {
    const codeLines = (code || '').split('\n').length;

    return (
      <div style={{
        margin: '10px 0',
        borderRadius: '8px',
        overflow: 'hidden',
        border: status === 'success' ? '1px solid #22C55E' : status === 'failed' ? '1px solid #EF4444' : '1px solid var(--accent)',
        background: '#0F172A',
        boxShadow: '0 4px 16px rgba(217, 107, 39, 0.12)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 12px',
          background: status === 'success'
            ? 'linear-gradient(90deg, rgba(34, 197, 94, 0.2) 0%, rgba(15, 23, 42, 0.85) 100%)'
            : 'linear-gradient(90deg, rgba(217, 107, 39, 0.22) 0%, rgba(15, 23, 42, 0.85) 100%)',
          borderBottom: isExpanded ? '1px solid #334155' : 'none',
          fontSize: '11.5px',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
            <FileCode size={14} color={status === 'success' ? '#22C55E' : 'var(--accent)'} style={{ flexShrink: 0 }} />
            <div
              onClick={() => onOpenFile?.(targetFilePath)}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: '#F8FAFC',
                fontWeight: 700,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              title="点击在右侧代码工作台打开此文件"
            >
              <span style={{ color: status === 'success' ? '#22C55E' : 'var(--accent)' }}>📁 {targetFilePath}</span>
              <ExternalLink size={11} color={status === 'success' ? '#22C55E' : 'var(--accent)'} style={{ opacity: 0.8 }} />
              <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 400, marginLeft: '2px' }}>
                ({codeLines} 行)
              </span>
            </div>
            <StatusBadge status={status} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                display: 'flex', alignItems: 'center', gap: '3px',
                padding: '3px 8px', borderRadius: '4px',
                background: 'rgba(51, 65, 85, 0.6)', color: '#E2E8F0',
                border: '1px solid #475569', fontSize: '11px', cursor: 'pointer'
              }}
            >
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              <span>{isExpanded ? '折叠代码' : '展开代码'}</span>
            </button>

            <button
              onClick={handleCopy}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '3px 8px', borderRadius: '4px',
                background: copied ? '#15803D' : '#334155',
                color: copied ? '#DCFCE7' : '#F1F5F9',
                border: 'none', fontSize: '11px', cursor: 'pointer'
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span>{copied ? '已复制' : '复制'}</span>
            </button>
          </div>
        </div>

        {/* Execution result notification */}
        {executionResult && (executionResult.status === 'success' || executionResult.status === 'failed') && (
          <div style={{
            padding: '6px 12px',
            background: executionResult.status === 'success' ? 'rgba(22, 163, 74, 0.15)' : 'rgba(220, 38, 38, 0.15)',
            borderBottom: isExpanded ? '1px solid #334155' : 'none',
            fontSize: '11px',
            color: executionResult.status === 'success' ? '#4ADE80' : '#F87171',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            {executionResult.status === 'success' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
            <span>
              {executionResult.status === 'success'
                ? `✨ 写入成功 → ${targetFilePath} (${executionResult.fileSize || '?'} 字节)`
                : `❌ 写入失败: ${executionResult.error}`}
            </span>
          </div>
        )}

        {/* Code content (collapsed by default) */}
        {isExpanded && (
          <pre style={{
            margin: 0, padding: '12px 14px', overflowX: 'auto', maxHeight: '480px',
            fontSize: '12px', lineHeight: 1.6,
            fontFamily: 'Consolas, "Fira Code", Monaco, monospace',
            color: '#F8FAFC', background: '#0B1120', whiteSpace: 'pre', wordBreak: 'normal'
          }}>
            <code>{code}</code>
          </pre>
        )}
      </div>
    );
  }

  // ─── 2. Command / Standard Code Block (Display-Only) ───
  const isAction = isCommandLang;

  return (
    <div style={{
      margin: '12px 0',
      borderRadius: '8px',
      overflow: 'hidden',
      border: status === 'success' ? '1px solid #22C55E' : status === 'failed' ? '1px solid #EF4444' : '1px solid #334155',
      background: '#0F172A',
      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 12px',
        background: status === 'success' ? 'rgba(34, 197, 94, 0.1)' : '#1E293B',
        borderBottom: '1px solid #334155',
        fontSize: '11px', color: '#94A3B8'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
          {isCommandLang ? <Terminal size={13} color="#38BDF8" /> : <Code2 size={13} color="#F59E0B" />}
          <span style={{ textTransform: 'uppercase', letterSpacing: '0.5px', color: '#E2E8F0' }}>
            {cleanLang || (isCommandLang ? 'POWERSHELL' : 'PLAINTEXT')}
          </span>
          {isAction && <StatusBadge status={status} />}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={handleCopy}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '3px 8px', borderRadius: '4px',
              background: copied ? '#15803D' : '#334155',
              color: copied ? '#DCFCE7' : '#F1F5F9',
              border: 'none', fontSize: '11px', cursor: 'pointer'
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{copied ? '已复制' : '复制'}</span>
          </button>
        </div>
      </div>

      {/* Code Body */}
      <pre style={{
        margin: 0, padding: '12px 14px', overflowX: 'auto',
        fontSize: '12px', lineHeight: 1.6,
        fontFamily: 'Consolas, "Fira Code", Monaco, "Courier New", monospace',
        color: '#F8FAFC', background: '#0B1120', whiteSpace: 'pre', wordBreak: 'normal'
      }}>
        <code>{code}</code>
      </pre>

      {/* Inline Execution Output (from Agent Loop results) */}
      {executionResult && (executionResult.status === 'success' || executionResult.status === 'failed') && isAction && (
        <div style={{
          borderTop: '1px solid #334155',
          background: '#030712',
          padding: '8px 12px',
          fontSize: '11px',
          fontFamily: 'Consolas, Monaco, monospace',
          color: '#E5E7EB'
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '4px',
            color: executionResult.status === 'success' ? '#4ADE80' : '#F87171',
            fontWeight: 700
          }}>
            <span>
              {executionResult.status === 'success'
                ? `✓ 执行完成 (Exit Code: ${executionResult.exitCode ?? 0})`
                : `❌ 执行失败 (Exit Code: ${executionResult.exitCode ?? 1})`}
            </span>
          </div>

          {executionResult.output && (
            <div style={{ color: '#A7F3D0', whiteSpace: 'pre-wrap', maxHeight: '180px', overflowY: 'auto' }}>
              {executionResult.output}
            </div>
          )}

          {executionResult.error && (
            <div style={{ color: '#FCA5A5', whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto', marginTop: '4px' }}>
              {executionResult.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── MarkdownCard Main Component ─────────────────────────────
export const MarkdownCard: React.FC<MarkdownCardProps> = ({
  content,
  isStreaming,
  actionResults = [],
  onOpenFile
}) => {
  if (!content) return null;

  // Split content into blocks: Code blocks vs Text/Markdown blocks
  const blocks: Array<{ type: 'code' | 'text'; language?: string; content: string }> = [];
  const lines = content.split('\n');
  let inCode = false;
  let codeLang = '';
  let currentBlock: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    if (trimmed.startsWith('```')) {
      if (inCode) {
        blocks.push({ type: 'code', language: codeLang, content: currentBlock.join('\n') });
        currentBlock = [];
        inCode = false;
        codeLang = '';
      } else {
        if (currentBlock.length > 0) {
          blocks.push({ type: 'text', content: currentBlock.join('\n') });
          currentBlock = [];
        }
        inCode = true;
        codeLang = trimmed.slice(3).trim();
      }
    } else {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length > 0) {
    if (inCode) {
      blocks.push({ type: 'code', language: codeLang, content: currentBlock.join('\n') });
    } else {
      blocks.push({ type: 'text', content: currentBlock.join('\n') });
    }
  }

  // Action blocks share the same parser as the execution controller, so display and execution cannot drift.
  const parsedActions = parseAgentActions(content);
  let actionIndex = 0;

  const renderInlineText = (text: string) => {
    const parts: React.ReactNode[] = [];
    const inlineRegex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = inlineRegex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push(text.slice(lastIdx, match.index));
      }
      const token = match[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(
          <strong key={match.index} style={{ fontWeight: 700, color: 'var(--text-strong)' }}>
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code
            key={match.index}
            style={{
              background: 'rgba(234, 88, 12, 0.12)',
              color: '#EA580C',
              padding: '2px 5px',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'Consolas, monospace',
              border: '1px solid rgba(234, 88, 12, 0.25)',
              margin: '0 2px'
            }}
          >
            {token.slice(1, -1)}
          </code>
        );
      } else if (token.startsWith('[') && token.includes('](')) {
        const linkText = token.slice(1, token.indexOf(']('));
        const linkUrl = token.slice(token.indexOf('](') + 2, -1);
        parts.push(
          <a
            key={match.index}
            href={linkUrl}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'underline' }}
          >
            {linkText}
          </a>
        );
      }
      lastIdx = inlineRegex.lastIndex;
    }

    if (lastIdx < text.length) {
      parts.push(text.slice(lastIdx));
    }
    return parts.length > 0 ? parts : text;
  };

  const renderTextParagraphs = (textBlock: string, blockKey: number) => {
    const textLines = textBlock.split('\n');
    const elements: React.ReactNode[] = [];
    let listBuffer: { type: 'ul' | 'ol'; items: string[] } | null = null;

    const flushList = () => {
      if (!listBuffer) return;
      if (listBuffer.type === 'ul') {
        elements.push(
          <ul key={`list-${elements.length}`} style={{ margin: '6px 0', paddingLeft: '20px', lineHeight: '1.6' }}>
            {listBuffer.items.map((it, idx) => (
              <li key={idx} style={{ margin: '3px 0' }}>{renderInlineText(it)}</li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`list-${elements.length}`} style={{ margin: '6px 0', paddingLeft: '20px', lineHeight: '1.6' }}>
            {listBuffer.items.map((it, idx) => (
              <li key={idx} style={{ margin: '3px 0' }}>{renderInlineText(it)}</li>
            ))}
          </ol>
        );
      }
      listBuffer = null;
    };

    for (let i = 0; i < textLines.length; i++) {
      const line = textLines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        flushList();
        continue;
      }

      if (trimmed.startsWith('### ')) {
        flushList();
        elements.push(
          <h3 key={i} style={{ fontSize: '13px', fontWeight: 700, margin: '10px 0 4px 0', color: 'var(--text-strong)' }}>
            {renderInlineText(trimmed.slice(4))}
          </h3>
        );
      } else if (trimmed.startsWith('## ')) {
        flushList();
        elements.push(
          <h2 key={i} style={{ fontSize: '14px', fontWeight: 700, margin: '12px 0 6px 0', color: 'var(--text-strong)' }}>
            {renderInlineText(trimmed.slice(3))}
          </h2>
        );
      } else if (trimmed.startsWith('# ')) {
        flushList();
        elements.push(
          <h1 key={i} style={{ fontSize: '15px', fontWeight: 800, margin: '14px 0 6px 0', color: 'var(--text-strong)' }}>
            {renderInlineText(trimmed.slice(2))}
          </h1>
        );
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('● ')) {
        if (!listBuffer || listBuffer.type !== 'ul') {
          flushList();
          listBuffer = { type: 'ul', items: [] };
        }
        listBuffer.items.push(trimmed.replace(/^[-*●]\s+/, ''));
      } else if (/^\d+\.\s+/.test(trimmed)) {
        if (!listBuffer || listBuffer.type !== 'ol') {
          flushList();
          listBuffer = { type: 'ol', items: [] };
        }
        listBuffer.items.push(trimmed.replace(/^\d+\.\s+/, ''));
      } else {
        flushList();
        elements.push(
          <p key={i} style={{ margin: '4px 0', lineHeight: '1.6' }}>
            {renderInlineText(line)}
          </p>
        );
      }
    }
    flushList();

    return <div key={`text-block-${blockKey}`}>{elements}</div>;
  };

  return (
    <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--text-primary)' }}>
      {blocks.map((b, idx) => {
        if (b.type === 'code') {
          const lang = (b.language || '').trim();
          const blockAction = parseAgentActions(`\`\`\`${lang}\n${b.content}\n\`\`\``)[0];
          const action = blockAction ? parsedActions[actionIndex++] : undefined;
          const result = action ? getActionResultForId(action.id, actionResults) : undefined;

          return (
            <CodeBlockCard
              key={idx}
              language={b.language || ''}
              code={b.content}
              executionResult={result}
              executionStatus={result?.status || 'idle'}
              onOpenFile={onOpenFile}
            />
          );
        }
        return renderTextParagraphs(b.content, idx);
      })}
    </div>
  );
};
