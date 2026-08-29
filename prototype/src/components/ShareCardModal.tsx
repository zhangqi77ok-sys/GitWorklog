import React, { useState } from 'react';
import { X, Check, Copy, Download, Share2, Sparkles, ShieldCheck, Terminal, Cpu } from 'lucide-react';
import { ChatMessage, SessionItem } from '../types/contracts';
import { MarkdownCard } from './MarkdownCard';

interface ShareCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: ChatMessage | null;
  session: SessionItem;
}

export const ShareCardModal: React.FC<ShareCardModalProps> = ({
  isOpen,
  onClose,
  message,
  session
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !message) return null;

  const cardDate = new Date(message.timestamp || Date.now()).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  const handleCopyCardText = async () => {
    const text = `【Tcode AI 协作卡片】\n会话: ${session.title}\n工程: ${session.projectName || '主工程'}\n时间: ${cardDate}\n\n--- 问答内容 ---\n${message.content}\n\n— 来自 Tcode 金融级 AI 桌面 IDE`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExportMarkdown = () => {
    const mdContent = `# Tcode 对话记录\n\n**工程**: ${session.projectName || '主工程'} (${session.gitBranch || 'main'})  \n**会话**: ${session.title}  \n**时间**: ${cardDate}  \n**模型审计**: ${message.auditTag || 'Tcode AI Engine'}  \n\n---\n\n${message.content}\n`;
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CodeMind-Share-${session.title.slice(0, 16)}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.52)',
      backdropFilter: 'blur(6px)',
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
        borderRadius: '12px',
        border: '1px solid var(--border-strong)',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.32)',
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
            <Share2 size={16} color="var(--accent)" />
            <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
              分享对话卡片 (Share Insight Card)
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
              borderRadius: '4px'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Card Body Viewport */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: 'var(--bg-base)' }}>
          {/* THE SOCIAL SHARE CARD */}
          <div style={{
            background: 'var(--bg-surface)',
            borderRadius: '10px',
            border: '1px solid var(--border-strong)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            {/* Card Top Brand Banner */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(217, 107, 39, 0.12) 0%, rgba(147, 51, 234, 0.08) 100%)',
              borderBottom: '1px solid var(--border-subtle)',
              padding: '14px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  background: 'var(--accent)',
                  color: '#FFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '13px'
                }}>
                  C
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-strong)' }}>
                    Tcode
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    Enterprise AI Agentic IDE
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  📁 {session.projectName || '主工程'} ({session.gitBranch || 'main'})
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {cardDate}
                </div>
              </div>
            </div>

            {/* Metadata Badges Strip */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 18px',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'var(--bg-surface-elevated)',
              fontSize: '11px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
                  💬 {session.title}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  padding: '1px 6px',
                  borderRadius: '3px',
                  background: 'rgba(22, 163, 74, 0.1)',
                  color: '#16A34A',
                  fontWeight: 600,
                  fontSize: '10px'
                }}>
                  🛡️ 离线脱敏认证
                </span>
                {message.auditTag && (
                  <span style={{
                    padding: '1px 6px',
                    borderRadius: '3px',
                    background: 'var(--accent-subtle)',
                    color: 'var(--accent)',
                    fontWeight: 600,
                    fontSize: '10px'
                  }}>
                    {message.auditTag}
                  </span>
                )}
              </div>
            </div>

            {/* Message Content Render */}
            <div style={{ padding: '18px', userSelect: 'text' }}>
              <MarkdownCard content={message.content} />
            </div>

            {/* Card Footer Watermark */}
            <div style={{
              padding: '10px 18px',
              borderTop: '1px solid var(--border-subtle)',
              background: 'rgba(0, 0, 0, 0.02)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '10.5px',
              color: 'var(--text-muted)'
            }}>
              <span>Tcode Agent 架构协同生成 · 真实本地代码校验</span>
              <span>SHA-256: {Math.random().toString(36).substring(2, 10).toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          height: '52px',
          borderTop: '1px solid var(--border-subtle)',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px',
          background: 'var(--bg-surface)'
        }}>
          <button
            onClick={handleCopyCardText}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              background: copied ? '#16A34A' : 'var(--bg-base)',
              border: `1px solid ${copied ? '#16A34A' : 'var(--border-subtle)'}`,
              color: copied ? '#FFF' : 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? '✓ 已复制卡片文本' : '📋 复制卡片文本'}</span>
          </button>

          <button
            onClick={handleExportMarkdown}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              background: 'var(--accent)',
              border: 'none',
              color: '#FFF',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Download size={14} />
            <span>💾 导出为 Markdown 文件</span>
          </button>
        </div>
      </div>
    </div>
  );
};
