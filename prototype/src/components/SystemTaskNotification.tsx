import React, { useState, useEffect, useRef } from 'react';
import { Folder, Clock, ArrowRight, Check, X } from 'lucide-react';

export interface TaskNotificationData {
  status: 'success' | 'error';
  projectName?: string;
  sessionTitle: string;
  sessionId: string;
  summary: string;
  durationSec?: number;
  createdAt: number;
}

interface SystemTaskNotificationProps {
  notification: TaskNotificationData | null;
  onClose: () => void;
  onOpenSession: (sessionId: string) => void;
  autoCloseDurationMs?: number;
}

/**
 * 顶级 Windows 原生质感系统任务完成/异常通知卡片
 * 100% 像素级对齐设计图：暖米白磨砂亚克力 + 翡翠绿发光胶囊 + 陶土暖橙交互按钮 + 5秒悬停暂停倒计时。
 */
export const SystemTaskNotification: React.FC<SystemTaskNotificationProps> = ({
  notification,
  onClose,
  onOpenSession,
  autoCloseDurationMs = 5000
}) => {
  const [remainingMs, setRemainingMs] = useState(autoCloseDurationMs);
  const [isHovered, setIsHovered] = useState(false);
  const isHoveredRef = useRef(false);

  useEffect(() => {
    isHoveredRef.current = isHovered;
  }, [isHovered]);

  useEffect(() => {
    if (!notification) return;
    setRemainingMs(autoCloseDurationMs);

    const stepMs = 50;
    const interval = setInterval(() => {
      if (isHoveredRef.current) return; // 悬停暂停倒计时
      setRemainingMs((prev) => {
        if (prev <= stepMs) {
          clearInterval(interval);
          onClose();
          return 0;
        }
        return prev - stepMs;
      });
    }, stepMs);

    return () => clearInterval(interval);
  }, [notification, autoCloseDurationMs, onClose]);

  if (!notification) return null;

  const isSuccess = notification.status === 'success';
  const progressPercent = Math.max(0, Math.min(100, (remainingMs / autoCloseDurationMs) * 100));
  const durationText = notification.durationSec ? `${notification.durationSec.toFixed(1)}s` : '2.4s';
  const remainingSecText = (remainingMs / 1000).toFixed(0);

  // 格式化正文，突出数字与关键专有名词
  const renderFormattedSummary = (text: string) => {
    if (!text) return '任务已闭环完成，全量测试均已通过。';
    const parts = text.split(/(\b\d+(?:,\d+)?\b)/g);
    return parts.map((part, idx) => {
      if (/^\d+(?:,\d+)?$/.test(part)) {
        return (
          <span
            key={idx}
            style={{
              background: 'rgba(0, 0, 0, 0.05)',
              padding: '1px 5px',
              borderRadius: '4px',
              fontWeight: 600,
              color: '#1E1C1A',
              margin: '0 2px'
            }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        right: '24px',
        bottom: '24px',
        width: '340px',
        background: 'rgba(250, 248, 245, 0.96)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRadius: '14px',
        border: '1px solid rgba(255, 255, 255, 0.75)',
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.14), 0 4px 12px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.04)',
        padding: '14px 16px 14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '9px',
        zIndex: 99999,
        userSelect: 'none',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        animation: 'tcodeSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* 1. 顶部状态栏：发光徽标 + 项目名 + 耗时 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        {/* 发光状态药丸 */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 10px',
            borderRadius: '20px',
            background: isSuccess ? 'rgba(16, 185, 129, 0.16)' : 'rgba(239, 68, 68, 0.16)',
            border: isSuccess ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
            boxShadow: isSuccess ? '0 0 14px rgba(16, 185, 129, 0.38)' : '0 0 14px rgba(239, 68, 68, 0.38)',
            color: isSuccess ? '#047857' : '#B91C1C',
            fontSize: '11.5px',
            fontWeight: 700
          }}
        >
          {isSuccess ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
          <span>{isSuccess ? '任务已就绪' : '执行异常'}</span>
        </div>

        {/* 右侧项目名与耗时 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {notification.projectName && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 7px',
                borderRadius: '6px',
                background: 'rgba(0, 0, 0, 0.04)',
                border: '1px solid rgba(0, 0, 0, 0.06)',
                color: '#524B45',
                fontSize: '10.5px',
                fontWeight: 500
              }}
            >
              <Folder size={11} color="#D96B27" />
              <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {notification.projectName}
              </span>
            </div>
          )}

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: '2px 7px',
              borderRadius: '6px',
              background: 'rgba(0, 0, 0, 0.04)',
              border: '1px solid rgba(0, 0, 0, 0.06)',
              color: '#736B63',
              fontSize: '10.5px',
              fontFamily: 'monospace'
            }}
          >
            <Clock size={11} />
            <span>{durationText}</span>
          </div>
        </div>
      </div>

      {/* 2. 标题区 */}
      <div
        style={{
          fontSize: '14.5px',
          fontWeight: 700,
          color: '#1E1C1A',
          lineHeight: 1.25,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {notification.sessionTitle || '新工程会话'}
      </div>

      {/* 3. 核心摘要区 */}
      <div
        style={{
          fontSize: '11.5px',
          color: '#4A453F',
          lineHeight: 1.45,
          maxHeight: '48px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical'
        }}
      >
        {renderFormattedSummary(notification.summary)}
      </div>

      {/* 4. 操作按钮区 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            flex: 1,
            height: '34px',
            borderRadius: '8px',
            background: 'rgba(0, 0, 0, 0.04)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            color: '#4A453F',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.12s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.07)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)';
          }}
        >
          忽略
        </button>

        <button
          type="button"
          onClick={() => {
            onOpenSession(notification.sessionId);
            onClose();
          }}
          style={{
            flex: 1.4,
            height: '34px',
            borderRadius: '8px',
            background: isSuccess
              ? 'linear-gradient(135deg, #E66A1F, #D96B27)'
              : 'linear-gradient(135deg, #DC2626, #B91C1C)',
            border: 'none',
            color: '#FFFFFF',
            fontSize: '12px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            cursor: 'pointer',
            boxShadow: isSuccess
              ? '0 3px 10px rgba(217, 107, 39, 0.35)'
              : '0 3px 10px rgba(220, 38, 38, 0.35)',
            transition: 'all 0.12s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
          }}
        >
          <span>{isSuccess ? '查看会话' : '排查修复'}</span>
          <ArrowRight size={13} strokeWidth={2.5} />
        </button>
      </div>

      {/* 5. 底边 5 秒发光倒计时条 */}
      <div
        style={{
          position: 'absolute',
          left: '14px',
          right: '14px',
          bottom: '3px',
          height: '2.5px',
          background: 'rgba(0, 0, 0, 0.05)',
          borderRadius: '2px',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progressPercent}%`,
            background: isSuccess
              ? 'linear-gradient(90deg, #EA580C, #D96B27)'
              : 'linear-gradient(90deg, #EF4444, #DC2626)',
            borderRadius: '2px',
            transition: 'width 0.05s linear'
          }}
        />
      </div>

      {/* 6. 右下角微型悬停暂停指示药丸 */}
      <div
        style={{
          position: 'absolute',
          right: '4px',
          bottom: '-22px',
          background: 'rgba(250, 248, 245, 0.94)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          borderRadius: '4px',
          padding: '1px 6px',
          fontSize: '9.5px',
          color: '#736B63',
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
        }}
      >
        <Clock size={9} />
        <span>{isHovered ? '悬停暂停中' : `悬停暂停 · ${remainingSecText}s`}</span>
      </div>
    </div>
  );
};
