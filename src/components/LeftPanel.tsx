import React from 'react';
import { Plus, Globe, Folder, FileText, ChevronRight } from 'lucide-react';
import { SessionTier1Type, SessionItem } from '../types/contracts';

interface LeftPanelProps {
  width: number;
  activeTier1: SessionTier1Type;
  setActiveTier1: (tier1: SessionTier1Type) => void;
  sessions: SessionItem[];
  currentSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({
  width,
  activeTier1,
  setActiveTier1,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession
}) => {
  const filteredSessions = sessions.filter(s => s.tier1 === activeTier1);

  return (
    <div style={{
      width: `${width}px`,
      minWidth: '180px',
      maxWidth: '400px',
      height: 'calc(100vh - 38px)',
      background: 'var(--bg-base)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none'
    }}>
      {/* Panel Header with Tier-1 Segmented Switch */}
      <div style={{ padding: '10px 10px 6px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            会话作用域
          </span>
          <button
            onClick={onNewSession}
            title="在当前作用域新建会话"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'var(--accent)',
              color: '#FFF',
              border: 'none',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            <Plus size={12} />
            <span>新建</span>
          </button>
        </div>

        {/* Tier-1 Switcher */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-surface)',
          padding: '2px',
          borderRadius: '6px',
          border: '1px solid var(--border-subtle)',
          fontSize: '11px'
        }}>
          <button
            onClick={() => setActiveTier1('global')}
            style={{
              flex: 1,
              padding: '4px 0',
              border: 'none',
              borderRadius: '4px',
              background: activeTier1 === 'global' ? 'var(--bg-surface-elevated)' : 'transparent',
              color: activeTier1 === 'global' ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: activeTier1 === 'global' ? 600 : 400,
              cursor: 'pointer',
              boxShadow: activeTier1 === 'global' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            🌐 全局 ({sessions.filter(s => s.tier1 === 'global').length})
          </button>
          <button
            onClick={() => setActiveTier1('project')}
            style={{
              flex: 1,
              padding: '4px 0',
              border: 'none',
              borderRadius: '4px',
              background: activeTier1 === 'project' ? 'var(--bg-surface-elevated)' : 'transparent',
              color: activeTier1 === 'project' ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: activeTier1 === 'project' ? 600 : 400,
              cursor: 'pointer',
              boxShadow: activeTier1 === 'project' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            📁 工程 ({sessions.filter(s => s.tier1 === 'project').length})
          </button>
          <button
            onClick={() => setActiveTier1('file')}
            style={{
              flex: 1,
              padding: '4px 0',
              border: 'none',
              borderRadius: '4px',
              background: activeTier1 === 'file' ? 'var(--bg-surface-elevated)' : 'transparent',
              color: activeTier1 === 'file' ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: activeTier1 === 'file' ? 600 : 400,
              cursor: 'pointer',
              boxShadow: activeTier1 === 'file' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            📄 文件 ({sessions.filter(s => s.tier1 === 'file').length})
          </button>
        </div>
      </div>

      {/* Tier-2 Session List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
        {filteredSessions.length === 0 ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
            暂无此作用域下的会话<br />点击右上角「新建」开启
          </div>
        ) : (
          filteredSessions.map(session => {
            const isSelected = session.id === currentSessionId;
            return (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  marginBottom: '4px',
                  cursor: 'pointer',
                  background: isSelected ? 'var(--accent-subtle)' : 'transparent',
                  border: isSelected ? '1px solid rgba(217, 107, 39, 0.25)' : '1px solid transparent',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: isSelected ? 600 : 500,
                  color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                  fontSize: '12px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {session.tier1 === 'global' && <Globe size={13} color="var(--text-muted)" />}
                  {session.tier1 === 'project' && <Folder size={13} color="var(--accent)" />}
                  {session.tier1 === 'file' && <FileText size={13} color="#2563EB" />}
                  <span>{session.title}</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '4px',
                  fontSize: '11px',
                  color: 'var(--text-muted)'
                }}>
                  <span>{session.messagesCount} 条消息</span>
                  <span>{(session.totalTokens / 1000).toFixed(1)}k tokens</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
