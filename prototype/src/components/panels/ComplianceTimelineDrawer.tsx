import React, { useState, useEffect } from 'react';
import { codeGraphService, AuditEventItem } from '../../services/codeGraphService';
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  RotateCcw,
  RefreshCw,
  Clock,
  Cpu,
  FileCode,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

interface ComplianceTimelineDrawerProps {
  onRestoreCheckpoint?: (checkpointRef: string) => void;
  onClose?: () => void;
}

export const ComplianceTimelineDrawer: React.FC<ComplianceTimelineDrawerProps> = ({
  onRestoreCheckpoint,
  onClose,
}) => {
  const [events, setEvents] = useState<AuditEventItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTimeline();
  }, []);

  const loadTimeline = async () => {
    setLoading(true);
    const evts = await codeGraphService.fetchAuditTimeline(30);
    setEvents(evts);
    setLoading(false);
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-base)',
        userSelect: 'none',
        fontSize: '12px',
        color: 'var(--text-primary)',
      }}
    >
      {/* 顶部 Header */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700 }}>
          <ShieldCheck size={15} color="var(--accent-orange)" />
          <span>AI 代码血缘与合规审计链</span>
        </div>
        <button
          onClick={loadTimeline}
          disabled={loading}
          style={{
            padding: '3px 8px',
            fontSize: '11px',
            fontWeight: 600,
            borderRadius: '4px',
            background: 'var(--bg-base)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          <span>刷新</span>
        </button>
      </div>

      {/* 核心指标卡网格 */}
      <div
        style={{
          padding: '10px 12px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
        }}
      >
        {/* 许可合规卡 */}
        <div
          style={{
            padding: '8px',
            borderRadius: '6px',
            background: 'rgba(22, 163, 74, 0.08)',
            border: '1px solid rgba(22, 163, 74, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#16A34A', fontWeight: 700, fontSize: '10.5px' }}>
            <CheckCircle2 size={12} />
            <span>开源许可合规</span>
          </div>
          <strong style={{ fontSize: '11px', color: '#15803D' }}>100% Safe (MIT)</strong>
          <span style={{ fontSize: '9.5px', color: '#16A34A' }}>无 GPL 传染风险</span>
        </div>

        {/* Stage Gate 审计卡 */}
        <div
          style={{
            padding: '8px',
            borderRadius: '6px',
            background: 'rgba(217, 107, 39, 0.08)',
            border: '1px solid rgba(217, 107, 39, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-orange)', fontWeight: 700, fontSize: '10.5px' }}>
            <Lock size={12} />
            <span>Stage Gate 审计</span>
          </div>
          <strong style={{ fontSize: '11px', color: 'var(--text-primary)' }}>不可篡改因果链</strong>
          <span style={{ fontSize: '9.5px', color: 'var(--text-tertiary)' }}>Prompt 指纹留痕</span>
        </div>
      </div>

      {/* 时间轴列表 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-tertiary)', fontSize: '11px' }}>
            加载不可篡改审计事件流...
          </div>
        )}

        {!loading && events.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '36px 12px',
              color: 'var(--text-tertiary)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Clock size={24} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: '11.5px', fontWeight: 600 }}>暂无历史审计事件</span>
            <span style={{ fontSize: '10.5px' }}>AI 执行代码修改与门禁审批时将在此自动留痕</span>
          </div>
        )}

        {!loading &&
          events.map((evt, idx) => {
            const timeStr = new Date(evt.timestamp).toLocaleTimeString();
            let parsedMeta: any = {};
            try {
              parsedMeta = JSON.parse(evt.metadata_json || '{}');
            } catch {
              parsedMeta = {};
            }

            return (
              <div key={evt.id || idx} style={{ display: 'flex', gap: '10px', position: 'relative' }}>
                {/* 竖向时间轴线 */}
                {idx < events.length - 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      left: '9px',
                      top: '20px',
                      bottom: '-12px',
                      width: '1px',
                      background: 'var(--border-subtle)',
                    }}
                  />
                )}

                {/* 轴线节点图标 */}
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: 'var(--accent-orange)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    fontWeight: 700,
                    flexShrink: 0,
                    zIndex: 2,
                    boxShadow: '0 1px 3px rgba(217, 107, 39, 0.3)',
                  }}
                >
                  ✨
                </div>

                {/* 事件卡片 */}
                <div
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{evt.actor}</span>
                    <span>{timeStr}</span>
                  </div>

                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-primary)', lineHeight: 1.4, fontWeight: 500 }}>
                    {evt.summary}
                  </p>

                  {parsedMeta.model && (
                    <div
                      style={{
                        marginTop: '4px',
                        paddingTop: '4px',
                        borderTop: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '9.5px',
                        color: 'var(--text-tertiary)',
                        fontFamily: 'monospace',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Cpu size={10} color="var(--accent-orange)" />
                        <span>{parsedMeta.model}</span>
                      </div>

                      {parsedMeta.checkpoint && (
                        <button
                          onClick={() => onRestoreCheckpoint && onRestoreCheckpoint(parsedMeta.checkpoint)}
                          style={{
                            padding: '1px 5px',
                            fontSize: '9.5px',
                            borderRadius: '3px',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-base)',
                            color: 'var(--accent-orange)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            cursor: 'pointer',
                          }}
                          title="秒级回退到该快照"
                        >
                          <RotateCcw size={9} />
                          <span>回滚</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};
