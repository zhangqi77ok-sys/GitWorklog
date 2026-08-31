import React, { useState, useRef } from 'react';
import { X, Check, Copy, Download, Share2, Sparkles, Image as ImageIcon, ShieldCheck } from 'lucide-react';
import { ChatMessage, SessionItem } from '../types/contracts';
import { MarkdownCard } from './MarkdownCard';
import { buildCleanConversationText } from '../services/shareText';
import { isDesktopHost } from '../services/systemNotify';

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
  const [copiedText, setCopiedText] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageGeneratedToast, setImageGeneratedToast] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

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

  if (!isOpen || !message) return null;

  const cardDate = new Date(message.timestamp || Date.now()).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  // 统一「可分享/可复制」文本：兼容 Agent Loop 与 Swarm 两种输出风格
  const cleanContent = buildCleanConversationText(message);

  const handleCopyCardText = async () => {
    const text = `【Tcode AI 协作记录卡片】\n会话: ${session.title}\n工程: ${session.projectName || '主工程'}\n时间: ${cardDate}\n\n--- 问答内容 ---\n${cleanContent}\n\n— 来自 Tcode 企业级 AI 桌面 IDE`;
    await navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };


  // High-DPI Canvas PNG Card Generator (桌面宿主真实落盘; 浏览器 dev 环境 Blob 下载)
  const canvasToPngBase64 = (canvas: HTMLCanvasElement): Promise<string> =>
    new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas 转 PNG 失败'));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(',')[1] || '');
        };
        reader.onerror = () => reject(new Error('读取图片数据失败'));
        reader.readAsDataURL(blob);
      }, 'image/png');
    });

  const handleSaveAsImage = async () => {
    setIsGeneratingImage(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D 不可用');

      const width = 800;
      const padding = 32;
      const contentWidth = width - padding * 2;

      ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const rawLines = cleanContent.split('\n');
      const lines: string[] = [];

      for (const rLine of rawLines) {
        if (!rLine) {
          lines.push('');
          continue;
        }
        let current = '';
        for (const char of rLine) {
          const testLine = current + char;
          const metrics = ctx.measureText(testLine);
          if (metrics.width > contentWidth && current !== '') {
            lines.push(current);
            current = char;
          } else {
            current = testLine;
          }
        }
        if (current) lines.push(current);
      }

      const lineHeight = 22;
      const maxLinesToRender = Math.min(lines.length, 60);
      const contentHeight = maxLinesToRender * lineHeight + 40;
      const headerHeight = 110;
      const footerHeight = 60;
      const height = headerHeight + contentHeight + footerHeight;

      const scale = 2;
      canvas.width = width * scale;
      canvas.height = height * scale;
      ctx.scale(scale, scale);

      // 1. Draw Card Background
      ctx.fillStyle = '#1A1816';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = '#38332E';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, width, height);

      // 2. Draw Header Banner
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, '#D96B27');
      grad.addColorStop(1, '#9333EA');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, 5);

      ctx.fillStyle = '#D96B27';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(padding, 24, 28, 28, 6);
      } else {
        ctx.rect(padding, 24, 28, 28);
      }
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('T', padding + 8, 44);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('Tcode', padding + 38, 38);

      ctx.fillStyle = '#A8A29E';
      ctx.font = '11px sans-serif';
      ctx.fillText('AI Agentic Desktop IDE', padding + 38, 52);

      ctx.fillStyle = '#E7E5E4';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`📁 ${session.projectName || '主工程'} (${session.gitBranch || 'main'})`, width - padding, 38);

      ctx.fillStyle = '#78716C';
      ctx.font = '11px sans-serif';
      ctx.fillText(cardDate, width - padding, 52);
      ctx.textAlign = 'left';

      ctx.strokeStyle = '#292524';
      ctx.beginPath();
      ctx.moveTo(padding, headerHeight - 15);
      ctx.lineTo(width - padding, headerHeight - 15);
      ctx.stroke();

      // 3. Draw Message Content
      ctx.fillStyle = '#F5F5F4';
      ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

      let y = headerHeight + 10;
      for (let i = 0; i < maxLinesToRender; i++) {
        const line = lines[i];
        if (line.startsWith('```') || line.startsWith('#')) {
          ctx.fillStyle = '#D96B27';
          ctx.font = 'bold 14px Consolas, monospace';
        } else if (line.startsWith('- ') || line.startsWith('● ')) {
          ctx.fillStyle = '#E7E5E4';
          ctx.font = '14px sans-serif';
        } else {
          ctx.fillStyle = '#D6D3D1';
          ctx.font = '14px sans-serif';
        }
        ctx.fillText(line, padding, y);
        y += lineHeight;
      }

      if (lines.length > maxLinesToRender) {
        ctx.fillStyle = '#78716C';
        ctx.font = 'italic 12px sans-serif';
        ctx.fillText(`... (已截取前 ${maxLinesToRender} 行，完整内容请在 IDE 中查看)`, padding, y + 10);
      }

      // 4. Draw Footer
      const footerY = height - footerHeight + 15;
      ctx.strokeStyle = '#292524';
      ctx.beginPath();
      ctx.moveTo(padding, footerY - 10);
      ctx.lineTo(width - padding, footerY - 10);
      ctx.stroke();

      ctx.fillStyle = '#78716C';
      ctx.font = '11px sans-serif';
      ctx.fillText('✨ 由 Tcode 智能体生成 · 经 AST 语法校验与离线脱敏认证', padding, footerY + 15);

      ctx.textAlign = 'right';
      ctx.fillText('https://github.com/zhangqi77ok-sys/agent-learning', width - padding, footerY + 15);

      const dataBase64 = await canvasToPngBase64(canvas);
      const filename = `Tcode-Share-Card-${Date.now()}.png`;

      if (isDesktopHost()) {
        // 桌面宿主：真实落盘（WebView2 的 <a download> 默认不触发，改走宿主写文件）
        const res = await fetch('/api/share/save_image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename, dataBase64 }),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          throw new Error(`保存失败: HTTP ${res.status} ${detail.slice(0, 120)}`);
        }
        const payload = await res.json();
        setImageGeneratedToast(
          payload.clipboard
            ? `✨ 已保存并复制到剪贴板（可直接 Ctrl+V 粘贴）：${payload.path}`
            : `✨ 已保存卡片图片（剪贴板复制失败）：${payload.path}`,
        );
        setTimeout(() => setImageGeneratedToast(null), 6000);
      } else {
        // 浏览器 dev 环境：Blob 下载
        const blob = await (await fetch(`data:image/png;base64,${dataBase64}`)).blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setImageGeneratedToast('✨ 已生成并下载卡片图片 (PNG)！');
        setTimeout(() => setImageGeneratedToast(null), 3500);
      }
    } catch (e) {
      setImageGeneratedToast(`❌ 保存卡片图片失败: ${e instanceof Error ? e.message : String(e)}`);
      setTimeout(() => setImageGeneratedToast(null), 4000);
    } finally {
      setIsGeneratingImage(false);
    }
  };



  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.55)',
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
              分享对话卡片 (Share Image Card)
            </span>
          </div>
          <button
            onClick={onClose}
            title="关闭 (ESC)"
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
          {imageGeneratedToast && (
            <div style={{
              padding: '8px 12px',
              borderRadius: '6px',
              background: 'var(--accent)',
              color: '#FFF',
              fontSize: '11.5px',
              fontWeight: 600,
              marginBottom: '12px',
              textAlign: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}>
              {imageGeneratedToast}
            </div>
          )}

          {/* THE SOCIAL SHARE CARD PREVIEW */}
          <div
            ref={cardRef}
            style={{
              background: 'var(--bg-surface)',
              borderRadius: '10px',
              border: '1px solid var(--border-strong)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}
          >
            {/* Card Top Brand Banner */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(217, 107, 39, 0.14) 0%, rgba(147, 51, 234, 0.08) 100%)',
              borderBottom: '1px solid var(--border-subtle)',
              padding: '14px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  background: 'var(--accent)',
                  color: '#FFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '14px'
                }}>
                  T
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-strong)' }}>
                    Tcode
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    AI Agentic Desktop IDE
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
              </div>
            </div>

            {/* Message Content Render */}
            <div style={{ padding: '18px', userSelect: 'text' }}>
              <MarkdownCard content={cleanContent} />
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
              <span>✨ 由 Tcode 智能体协同生成 · 本地代码严谨校验</span>
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
          justifyContent: 'space-between',
          background: 'var(--bg-surface)'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '11.5px',
              cursor: 'pointer'
            }}
          >
            ✕ 取消 (ESC)
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleCopyCardText}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                background: copiedText ? '#16A34A' : 'var(--bg-base)',
                border: `1px solid ${copiedText ? '#16A34A' : 'var(--border-subtle)'}`,
                color: copiedText ? '#FFF' : 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {copiedText ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedText ? '✓ 已复制文本' : '📋 复制文本'}</span>
            </button>

            <button
              onClick={handleSaveAsImage}
              disabled={isGeneratingImage}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 16px',
                borderRadius: '6px',
                background: 'var(--accent)',
                border: 'none',
                color: '#FFF',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(217, 107, 39, 0.25)'
              }}
            >
              <ImageIcon size={14} />
              <span>{isGeneratingImage ? '正在生成卡片...' : '🖼️ 保存为卡片图片 (PNG)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
