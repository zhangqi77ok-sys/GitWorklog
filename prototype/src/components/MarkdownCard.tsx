import React, { useState, useEffect } from 'react';
import { Copy, Check, Terminal, Code2, FileCode, Play, Save, CheckCircle2, AlertCircle, RefreshCw, Shield, AlertTriangle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { PermissionPolicy } from '../types/contracts';

interface MarkdownCardProps {
  content: string;
  isStreaming?: boolean;
  autoExecute?: boolean;
  permissionPolicy?: PermissionPolicy;
  onOpenFile?: (filePath: string) => void;
}

interface CodeBlockCardProps {
  language: string;
  code: string;
  autoExecute?: boolean;
  isStreaming?: boolean;
  permissionPolicy?: PermissionPolicy;
  onOpenFile?: (filePath: string) => void;
}

const CodeBlockCard: React.FC<CodeBlockCardProps> = ({
  language,
  code,
  autoExecute = false,
  isStreaming = false,
  permissionPolicy = 'autonomous_agent',
  onOpenFile
}) => {
  const [copied, setCopied] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [execResult, setExecResult] = useState<{ success: boolean; stdout?: string; stderr?: string; exitCode?: number; error?: string } | null>(null);
  const [isWritingFile, setIsWritingFile] = useState(false);
  const [writeResult, setWriteResult] = useState<{ success: boolean; path?: string; size?: number; error?: string } | null>(null);
  const [hasAutoExecuted, setHasAutoExecuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const cleanLang = (language || '').trim();
  const isWriteFile = cleanLang.startsWith('write_file:') || cleanLang.startsWith('file:') || cleanLang.startsWith('create_file:');
  const targetFilePath = isWriteFile ? cleanLang.replace(/^(write_file:|file:|create_file:)/, '').trim() : '';

  const isCommandLang = ['run_command', 'bash', 'sh', 'powershell', 'pwsh', 'cmd', 'shell', 'zsh', 'terminal'].includes(cleanLang.toLowerCase()) || code.startsWith('git ') || code.startsWith('npm ') || code.startsWith('python ') || code.startsWith('cargo ') || code.startsWith('New-Item') || code.startsWith('Set-Content') || code.includes('Test-Path');

  // Risk Detection for Risk-Adaptive Policy
  const isHighRisk =
    /(\b(git\s+push|git\s+reset\s+--hard|git\s+clean|rm\s+-rf|Remove-Item|del\s+\/f|Drop-Table|Format-Volume)\b)/i.test(code) ||
    (isWriteFile && (targetFilePath.includes('package.json') || targetFilePath.includes('.env') || targetFilePath.includes('.git')));

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Real 1-Click File Write to Host Disk via /api/fs/write
  const handleWriteFileToDisk = async () => {
    if (!targetFilePath || isWritingFile) return;
    setIsWritingFile(true);
    setWriteResult(null);

    try {
      const res = await fetch('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: targetFilePath,
          content: code
        })
      });
      const data = await res.json();
      if (data.success) {
        setWriteResult({ success: true, path: data.path, size: data.size });
      } else {
        setWriteResult({ success: false, error: data.error || '写入失败' });
      }
    } catch (e: any) {
      setWriteResult({ success: false, error: e.message || '网络连接异常' });
    } finally {
      setIsWritingFile(false);
    }
  };

  // Real 1-Click Terminal Command Execution on Host via /api/terminal/exec
  const handleRunCommand = async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    setExecResult(null);

    try {
      const res = await fetch('/api/terminal/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: code
        })
      });
      const data = await res.json();
      setExecResult(data);
    } catch (e: any) {
      setExecResult({
        success: false,
        error: e.message || '无法连接宿主执行引擎'
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Permission-Driven Auto Execution Logic:
  // - strict_approval: NEVER auto execute (requires manual user click)
  // - autonomous_agent: ALWAYS auto execute when generation ends
  // - risk_adaptive: AUTO execute low-risk changes; FUSE/INTERCEPT high-risk commands
  useEffect(() => {
    if (!autoExecute || isStreaming || hasAutoExecuted || !code || !code.trim()) return;

    if (permissionPolicy === 'strict_approval') {
      // Manual approval only
      return;
    }

    if (permissionPolicy === 'risk_adaptive' && isHighRisk) {
      // Risk fused - pause and require manual approval
      return;
    }

    // Auto execute approved tasks
    setHasAutoExecuted(true);
    if (isWriteFile && targetFilePath) {
      handleWriteFileToDisk();
    } else if (isCommandLang) {
      handleRunCommand();
    }
  }, [autoExecute, isStreaming, hasAutoExecuted, isWriteFile, isCommandLang, targetFilePath, code, permissionPolicy, isHighRisk]);

  // 1. Specialized Collapsible File Write Card (Default Collapsed)
  if (isWriteFile && targetFilePath) {
    const codeLines = (code || '').split('\n').length;

    return (
      <div style={{
        margin: '10px 0',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid var(--accent)',
        background: '#0F172A',
        boxShadow: '0 4px 16px rgba(217, 107, 39, 0.12)'
      }}>
        {/* Header with Save Button, Clickable Path & Expand Toggle */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 12px',
          background: 'linear-gradient(90deg, rgba(217, 107, 39, 0.22) 0%, rgba(15, 23, 42, 0.85) 100%)',
          borderBottom: isExpanded ? '1px solid #334155' : 'none',
          fontSize: '11.5px',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
            <FileCode size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
            
            {/* Clickable File Path to Open in Right Workspace */}
            <div
              onClick={() => onOpenFile?.(targetFilePath)}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: '#F8FAFC',
                fontWeight: 700,
                textDecoration: 'none',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              title="点击在右侧代码工作台打开此文件"
            >
              <span style={{ color: 'var(--accent)' }}>📁 {targetFilePath}</span>
              <ExternalLink size={11} color="var(--accent)" style={{ opacity: 0.8 }} />
              <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 400, marginLeft: '2px' }}>
                ({codeLines} 行)
              </span>
            </div>

            {permissionPolicy === 'strict_approval' && (
              <span style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(100, 116, 139, 0.3)', color: '#CBD5E1', flexShrink: 0 }}>
                🛡️ 逐次审核
              </span>
            )}
            {permissionPolicy === 'risk_adaptive' && isHighRisk && (
              <span style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(239, 68, 68, 0.3)', color: '#FCA5A5', fontWeight: 700, flexShrink: 0 }}>
                ⚠️ 风险熔断
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {/* Expand / Collapse Toggle Button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '3px 8px',
                borderRadius: '4px',
                background: 'rgba(51, 65, 85, 0.6)',
                color: '#E2E8F0',
                border: '1px solid #475569',
                fontSize: '11px',
                cursor: 'pointer'
              }}
              title={isExpanded ? '折叠代码预览' : '展开代码预览'}
            >
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              <span>{isExpanded ? '折叠代码' : '展开代码'}</span>
            </button>

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
                cursor: 'pointer'
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span>{copied ? '已复制' : '复制'}</span>
            </button>

            <button
              onClick={handleWriteFileToDisk}
              disabled={isWritingFile}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 10px',
                borderRadius: '4px',
                background: writeResult?.success ? '#16A34A' : 'var(--accent)',
                color: '#FFF',
                border: 'none',
                fontSize: '11px',
                fontWeight: 700,
                cursor: isWritingFile ? 'default' : 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}
            >
              {isWritingFile ? <RefreshCw size={12} className="animate-spin" /> : writeResult?.success ? <CheckCircle2 size={12} /> : <Save size={12} />}
              <span>{isWritingFile ? '正在写盘...' : writeResult?.success ? '✓ 已写入本地' : '💾 立即写盘应用'}</span>
            </button>
          </div>
        </div>

        {/* Status Notification */}
        {writeResult && (
          <div style={{
            padding: '6px 12px',
            background: writeResult.success ? 'rgba(22, 163, 74, 0.15)' : 'rgba(220, 38, 38, 0.15)',
            borderBottom: isExpanded ? '1px solid #334155' : 'none',
            fontSize: '11px',
            color: writeResult.success ? '#4ADE80' : '#F87171',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            {writeResult.success ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
            <span>{writeResult.success ? `✨ 成功将代码落地写入至: ${writeResult.path} (${writeResult.size} 字节)` : `❌ 写入失败: ${writeResult.error}`}</span>
          </div>
        )}

        {/* Code Content (Rendered only when isExpanded = true) */}
        {isExpanded && (
          <pre style={{
            margin: 0,
            padding: '12px 14px',
            overflowX: 'auto',
            maxHeight: '480px',
            fontSize: '12px',
            lineHeight: 1.6,
            fontFamily: 'Consolas, "Fira Code", Monaco, monospace',
            color: '#F8FAFC',
            background: '#0B1120',
            whiteSpace: 'pre',
            wordBreak: 'normal'
          }}>
            <code>{code}</code>
          </pre>
        )}
      </div>
    );
  }

  // 2. Standard or Command Code Card with Permission Policy Guard
  return (
    <div style={{
      margin: '12px 0',
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid #334155',
      background: '#0F172A',
      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)'
    }}>
      {/* Header */}
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
          {isCommandLang ? <Terminal size={13} color="#38BDF8" /> : <Code2 size={13} color="#F59E0B" />}
          <span style={{ textTransform: 'uppercase', letterSpacing: '0.5px', color: '#E2E8F0' }}>
            {cleanLang || (isCommandLang ? 'POWERSHELL' : 'PLAINTEXT')}
          </span>
          {isCommandLang && permissionPolicy === 'strict_approval' && (
            <span style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(100, 116, 139, 0.3)', color: '#CBD5E1' }}>
              🛡️ 逐次审核
            </span>
          )}
          {isCommandLang && permissionPolicy === 'risk_adaptive' && isHighRisk && (
            <span style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(239, 68, 68, 0.3)', color: '#FCA5A5', fontWeight: 700 }}>
              ⚠️ 高危操作已拦截
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
            <span>{copied ? '已复制' : '复制'}</span>
          </button>

          {isCommandLang && (
            <button
              onClick={handleRunCommand}
              disabled={isExecuting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 10px',
                borderRadius: '4px',
                background: execResult?.success ? '#16A34A' : (isHighRisk && permissionPolicy === 'risk_adaptive' ? '#DC2626' : '#0284C7'),
                color: '#FFF',
                border: 'none',
                fontSize: '11px',
                fontWeight: 700,
                cursor: isExecuting ? 'default' : 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}
              title="直接在宿主系统 PowerShell 终端执行此脚本"
            >
              {isExecuting ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
              <span>{isExecuting ? '执行中...' : execResult?.success ? '✓ 重新执行' : (isHighRisk && permissionPolicy === 'risk_adaptive' ? '⚠️ 人工确认执行' : '▶️ 立即在宿主终端执行')}</span>
            </button>
          )}
        </div>
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

      {/* Inline Execution Output Log */}
      {execResult && (
        <div style={{
          borderTop: '1px solid #334155',
          background: '#030712',
          padding: '8px 12px',
          fontSize: '11px',
          fontFamily: 'Consolas, Monaco, monospace',
          color: '#E5E7EB'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '4px',
            color: execResult.success ? '#4ADE80' : '#F87171',
            fontWeight: 700
          }}>
            <span>{execResult.success ? `✓ 执行完成 (Exit Code: ${execResult.exitCode ?? 0})` : `❌ 执行失败 (Exit Code: ${execResult.exitCode ?? 1})`}</span>
            <button
              onClick={() => setExecResult(null)}
              style={{ background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '10px' }}
            >
              关闭输出
            </button>
          </div>

          {execResult.stdout && (
            <div style={{ color: '#A7F3D0', whiteSpace: 'pre-wrap', maxHeight: '180px', overflowY: 'auto' }}>
              {execResult.stdout}
            </div>
          )}

          {execResult.stderr && (
            <div style={{ color: '#FCA5A5', whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto', marginTop: '4px' }}>
              {execResult.stderr}
            </div>
          )}

          {execResult.error && (
            <div style={{ color: '#F87171', marginTop: '4px' }}>
              {execResult.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const MarkdownCard: React.FC<MarkdownCardProps> = ({
  content,
  isStreaming,
  autoExecute,
  permissionPolicy = 'autonomous_agent',
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

      // Headers
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
      }
      // Unordered list
      else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('● ')) {
        if (!listBuffer || listBuffer.type !== 'ul') {
          flushList();
          listBuffer = { type: 'ul', items: [] };
        }
        listBuffer.items.push(trimmed.replace(/^[-*●]\s+/, ''));
      }
      // Ordered list
      else if (/^\d+\.\s+/.test(trimmed)) {
        if (!listBuffer || listBuffer.type !== 'ol') {
          flushList();
          listBuffer = { type: 'ol', items: [] };
        }
        listBuffer.items.push(trimmed.replace(/^\d+\.\s+/, ''));
      }
      // Normal paragraph
      else {
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
          return (
            <CodeBlockCard
              key={idx}
              language={b.language || ''}
              code={b.content}
              autoExecute={autoExecute}
              isStreaming={isStreaming}
              permissionPolicy={permissionPolicy}
              onOpenFile={onOpenFile}
            />
          );
        }
        return renderTextParagraphs(b.content, idx);
      })}
    </div>
  );
};
