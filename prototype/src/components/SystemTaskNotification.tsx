import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, X, Folder, ArrowRight } from 'lucide-react';

export interface TaskNotificationData {
  id: string;
  status: 'success' | 'error';
  projectName: string;
  sessionTitle: string;
  sessionId: string;
  summary: string;
  createdAt: number;
}

interface SystemTaskNotificationProps {
  notification: TaskNotificationData | null;
  onClose: () => void;
  onOpenSession: (sessionId: string, projectName: string) => void;
  durationMs?: number;
}

export const SystemTaskNotification: React.FC<SystemTaskNotificationProps> = ({
  notification,
  onClose,
  onOpenSession,
  durationMs = 5000
}) => {
  const [remainingMs, setRemainingMs] = useState<number>(durationMs);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const isHoveredRef = useRef<boolean>(false);
  isHoveredRef.current = isHovered;

  useEffect(() => {
    if (!notification) return;
    setRemainingMs(durationMs);

    const interval = 50; // update every 50ms
    const timer = setInterval(() => {
      if (isHoveredRef.current) return; // Pause on hover
      setRemainingMs(prev => {
        if (prev <= interval) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - interval;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [notification, durationMs, onClose]);

  if (!notification) return null;

  const progressPercent = Math.max(0, Math.min(100, (remainingMs / durationMs) * 100));
  const isSuccess = notification.status === 'success';

  // Format clean 1-2 line summary
  const cleanSummary = notification.summary.length > 55
    ? notification.summary.slice(0, 52) + '...'
    : notification.summary;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        right: '16px',
        bottom: '16px',
        width: '280px',
        height: '120px',
        boxSizing: 'border-box',
        background: 'var(--bg-surface-elevated, #FFFFFF)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--border-strong, #E2DDD5)',
        borderRadius: '10px',
        boxShadow: '0 10px 28px rgba(0, 0, 0, 0.16)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '8px 10px 6px 10px',
        zIndex: 99999,
        userSelect: 'none',
        animation: 'tcodeToastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        fontFamily: 'inherit'
      }}
    >
      <style>{`
        @keyframes tcodeToastSlideIn {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Top Row: Status Badge + Project Tag + Close Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
          {isSuccess ? (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: '1px 5px',
              borderRadius: '6px',
              background: 'rgba(22, 163, 74, 0.12)',
              border: '1px solid rgba(22, 163, 74, 0.25)',
              color: '#16A34A',
              fontSize: '9.5px',
              fontWeight: 700,
              whiteSpace: 'nowrap'
            }}>
              <CheckCircle2 size={10} strokeWidth={2.5} />
              任务已完成
            </span>
          ) : (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: '1px 5px',
              borderRadius: '6px',
              background: 'rgba(220, 38, 38, 0.12)',
              border: '1px solid rgba(220, 38, 38, 0.25)',
              color: '#DC2626',
              fontSize: '9.5px',
              fontWeight: 700,
              whiteSpace: 'nowrap'
            }}>
              <AlertCircle size={10} strokeWidth={2.5} />
              执行异常
            </span>
          )}

          {notification.projectName && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: '1px 5px',
              borderRadius: '5px',
              background: 'var(--chat-user-bg, rgba(0,0,0,0.04))',
              color: 'var(--text-muted, #78716C)',
              fontSize: '9px',
              maxWidth: '90px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              <Folder size={9} />
              {notification.projectName}
            </span>
          )}
        </div>

        <button
          onClick={onClose}
          title="关闭"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted, #A8A29E)',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px'
          }}
        >
          <X size={12} />
        </button>
      </div>

      {/* Middle Row: Title & Summary */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px', overflow: 'hidden' }}>
        <div style={{
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--text-primary, #1E1C1A)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {notification.sessionTitle || '会话任务'}
        </div>
        <div style={{
          fontSize: '10px',
          color: 'var(--text-secondary, #57534E)',
          lineHeight: '1.25',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical'
        }}>
          {cleanSummary || (isSuccess ? '任务已执行完毕。' : '执行遇到错误，已中断。')}
        </div>
      </div>

      {/* Bottom Row: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', height: '24px' }}>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted, #78716C)',
            fontSize: '10px',
            padding: '2px 6px',
            cursor: 'pointer',
            borderRadius: '4px'
          }}
        >
          忽略
        </button>
        <button
          onClick={() => {
            onOpenSession(notification.sessionId, notification.projectName);
            onClose();
          }}
          style={{
            background: 'var(--accent, #D96B27)',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '10px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '5px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            boxShadow: '0 2px 6px rgba(217, 107, 39, 0.25)'
          }}
        >
          {isSuccess ? '查看会话' : '排查修复'}
          <ArrowRight size={10} strokeWidth={2.5} />
        </button>
      </div>

      {/* 5s Countdown Progress Line */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        height: '2px',
        width: '100%',
        background: 'rgba(0, 0, 0, 0.06)',
        borderBottomLeftRadius: '10px',
        borderBottomRightRadius: '10px',
        overflow: 'hidden'
      }}>
        <div style={{
          height: '100%',
          width: `${progressPercent}%`,
          background: isSuccess ? 'var(--accent, #D96B27)' : '#DC2626',
          transition: isHovered ? 'none' : 'width 50ms linear'
        }} />
      </div>
    </div>
  );
};
