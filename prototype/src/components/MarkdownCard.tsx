import React, { useState } from 'react';
import { Copy, Check, Terminal, Code2, FileCode, CheckCircle2, ChevronRight } from 'lucide-react';

interface MarkdownCardProps {
  content: string;
  isStreaming?: boolean;
}

interface CodeBlockCardProps {
  language: string;
  code: string;
}

const CodeBlockCard: React.FC<CodeBlockCardProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLangIcon = (lang: string) => {
    const l = lang.toLowerCase();
    if (['bash', 'sh', 'cmd', 'powershell', 'shell', 'zsh'].includes(l)) {
      return <Terminal size={13} color="#38BDF8" />;
    }
    return <Code2 size={13} color="#F59E0B" />;
  };

  return (
    <div style={{
      margin: '12px 0',
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid #334155',
      background: '#0F172A',
      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)'
    }}>
      {/* Code Card Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        background: '#1E293B',
        borderBottom: '1px solid #334155',
        fontSize: '11px',
        color: '#94A3B8'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
          {getLangIcon(language)}
          <span style={{ textTransform: 'uppercase', letterSpacing: '0.5px', color: '#E2E8F0' }}>
            {language || 'PLAINTEXT'}
          </span>
        </div>
        <button
          onClick={handleCopy}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '4px',
            background: copied ? '#15803D' : '#334155',
            color: copied ? '#DCFCE7' : '#F1F5F9',
            border: 'none',
            fontSize: '11px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          title="复制代码内容"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? '已复制' : '复制代码'}</span>
        </button>
      </div>

      {/* Code Body */}
      <pre style={{
        margin: 0,
        padding: '12px 14px',
        overflowX: 'auto',
        fontSize: '12px',
        lineHeight: 1.6,
        fontFamily: 'Consolas, "Fira Code", Monaco, "Courier New", monospace',
        color: '#F8FAFC',
        background: '#0B1120',
        whiteSpace: 'pre',
        wordBreak: 'normal'
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
};

export const MarkdownCard: React.FC<MarkdownCardProps> = ({ content, isStreaming }) => {
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
        // End of code block
        blocks.push({
          type: 'code',
          language: codeLang,
          content: currentBlock.join('\n')
        });
        currentBlock = [];
        inCode = false;
        codeLang = '';
      } else {
        // Start of code block
        if (currentBlock.length > 0) {
          blocks.push({
            type: 'text',
            content: currentBlock.join('\n')
          });
          currentBlock = [];
        }
        inCode = true;
        codeLang = trimmed.slice(3).trim();
      }
    } else {
      currentBlock.push(line);
    }
  }

  // Flush remaining block
  if (currentBlock.length > 0) {
    if (inCode) {
      blocks.push({
        type: 'code',
        language: codeLang,
        content: currentBlock.join('\n')
      });
    } else {
      blocks.push({
        type: 'text',
        content: currentBlock.join('\n')
      });
    }
  }

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
    let tableBuffer: string[] = [];

    const flushList = () => {
      if (listBuffer) {
        elements.push(
          <div key={`list-${elements.length}`} style={{ margin: '8px 0', paddingLeft: '8px' }}>
            {listBuffer.items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', margin: '4px 0' }}>
                <span style={{ color: 'var(--accent)', fontWeight: 700, lineHeight: 1.6 }}>•</span>
                <span style={{ flex: 1, lineHeight: 1.6 }}>{renderInlineText(item)}</span>
              </div>
            ))}
          </div>
        );
        listBuffer = null;
      }
    };

    const flushTable = () => {
      if (tableBuffer.length >= 2) {
        const headerRow = tableBuffer[0].split('|').map(s => s.trim()).filter(Boolean);
        const bodyRows = tableBuffer.slice(2).map(row => row.split('|').map(s => s.trim()).filter(Boolean));

        elements.push(
          <div key={`table-${elements.length}`} style={{
            margin: '12px 0',
            overflowX: 'auto',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-strong)' }}>
                  {headerRow.map((h, idx) => (
                    <th key={idx} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-strong)' }}>
                      {renderInlineText(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} style={{ borderBottom: '1px solid var(--border-subtle)', background: rIdx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} style={{ padding: '6px 12px', color: 'var(--text-main)' }}>
                        {renderInlineText(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableBuffer = [];
      }
    };

    for (let i = 0; i < textLines.length; i++) {
      const rawLine = textLines[i];
      const line = rawLine.trim();

      // Check Table row
      if (line.startsWith('|') && line.endsWith('|')) {
        flushList();
        tableBuffer.push(line);
        continue;
      } else if (tableBuffer.length > 0) {
        flushTable();
      }

      // Check Headings
      if (line.startsWith('# ')) {
        flushList();
        elements.push(
          <div key={i} style={{
            fontSize: '16px',
            fontWeight: 800,
            color: 'var(--text-strong)',
            margin: '16px 0 8px 0',
            paddingBottom: '6px',
            borderBottom: '2px solid var(--border-subtle)'
          }}>
            {renderInlineText(line.slice(2))}
          </div>
        );
      } else if (line.startsWith('## ')) {
        flushList();
        elements.push(
          <div key={i} style={{
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--text-strong)',
            margin: '14px 0 6px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{ width: '4px', height: '14px', background: 'var(--accent)', borderRadius: '2px' }} />
            <span>{renderInlineText(line.slice(3))}</span>
          </div>
        );
      } else if (line.startsWith('### ')) {
        flushList();
        elements.push(
          <div key={i} style={{
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--text-strong)',
            margin: '12px 0 4px 0',
            paddingLeft: '6px',
            borderLeft: '3px solid var(--accent)'
          }}>
            {renderInlineText(line.slice(4))}
          </div>
        );
      } else if (line.startsWith('#### ')) {
        flushList();
        elements.push(
          <div key={i} style={{
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            margin: '10px 0 4px 0'
          }}>
            {renderInlineText(line.slice(5))}
          </div>
        );
      } else if (line.startsWith('> ')) {
        flushList();
        elements.push(
          <div key={i} style={{
            margin: '8px 0',
            padding: '8px 12px',
            borderRadius: '4px',
            background: 'var(--bg-surface-elevated)',
            borderLeft: '3px solid var(--accent)',
            fontSize: '11.5px',
            color: 'var(--text-muted)',
            fontStyle: 'italic'
          }}>
            {renderInlineText(line.slice(2))}
          </div>
        );
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        if (!listBuffer) listBuffer = { type: 'ul', items: [] };
        listBuffer.items.push(line.slice(2));
      } else if (/^\d+\.\s/.test(line)) {
        if (!listBuffer) listBuffer = { type: 'ol', items: [] };
        listBuffer.items.push(line.replace(/^\d+\.\s/, ''));
      } else if (line.length === 0) {
        flushList();
        elements.push(<div key={i} style={{ height: '6px' }} />);
      } else {
        flushList();
        elements.push(
          <div key={i} style={{ margin: '4px 0', lineHeight: 1.65 }}>
            {renderInlineText(rawLine)}
          </div>
        );
      }
    }

    flushList();
    flushTable();

    return <div key={blockKey}>{elements}</div>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {blocks.map((block, idx) => {
        if (block.type === 'code') {
          return <CodeBlockCard key={idx} language={block.language || ''} code={block.content} />;
        }
        return renderTextParagraphs(block.content, idx);
      })}
      {isStreaming && (
        <span style={{
          display: 'inline-block',
          width: '6px',
          height: '14px',
          background: 'var(--accent)',
          marginLeft: '4px',
          verticalAlign: 'middle',
          animation: 'pulse 1s infinite'
        }} />
      )}
    </div>
  );
};
