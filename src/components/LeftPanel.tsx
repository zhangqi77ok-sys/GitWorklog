import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Globe,
  Folder,
  FolderOpen,
  FileText,
  Trash2,
  Edit2,
  Tag,
  Check,
  X,
  Sparkles
} from 'lucide-react';
import { SessionItem, ProjectGroup } from '../types/contracts';

interface LeftPanelProps {
  width: number;
  projects: ProjectGroup[];
  sessions: SessionItem[];
  currentSessionId: string;
  onSelectSession: (id: string) => void;
  onNewGlobalSession: () => void;
  onNewProjectSession: (projectId: string) => void;
  onNewFileSession: (projectId: string, filePath: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onAddTag: (sessionId: string, tag: string) => void;
  onRemoveTag: (sessionId: string, tag: string) => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({
  width,
  projects,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewGlobalSession,
  onNewProjectSession,
  onNewFileSession,
  onDeleteSession,
  onRenameSession,
  onAddTag,
  onRemoveTag
}) => {
  // Tree collapse state
  const [globalExpanded, setGlobalExpanded] = useState(true);
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({
    'proj-1': true,
    'proj-2': true
  });
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({
    'src/bus/GatewayBus.ts': true
  });

  // Editing state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState('');

  // Tag popover state
  const [taggingSessionId, setTaggingSessionId] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState('');

  const popularTags = ['feat', 'bug', 'refactor', 'docs', 'ui', 'test'];

  const tagColors: Record<string, { bg: string; text: string; border: string }> = {
    feat: { bg: 'rgba(217, 107, 39, 0.12)', text: '#D96B27', border: 'rgba(217, 107, 39, 0.3)' },
    bug: { bg: 'rgba(220, 38, 38, 0.1)', text: '#DC2626', border: 'rgba(220, 38, 38, 0.25)' },
    refactor: { bg: 'rgba(147, 51, 234, 0.1)', text: '#9333EA', border: 'rgba(147, 51, 234, 0.25)' },
    docs: { bg: 'rgba(16, 185, 129, 0.1)', text: '#10B981', border: 'rgba(16, 185, 129, 0.25)' },
    ui: { bg: 'rgba(37, 99, 235, 0.1)', text: '#2563EB', border: 'rgba(37, 99, 235, 0.25)' },
    test: { bg: 'rgba(202, 138, 4, 0.1)', text: '#CA8A04', border: 'rgba(202, 138, 4, 0.25)' }
  };

  const getTagStyle = (tag: string) => {
    const key = tag.toLowerCase();
    return tagColors[key] || {
      bg: 'rgba(112, 103, 93, 0.1)',
      text: 'var(--text-secondary)',
      border: 'var(--border-subtle)'
    };
  };

  const startRename = (session: SessionItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitleText(session.title);
  };

  const confirmRename = (id: string) => {
    if (editTitleText.trim()) {
      onRenameSession(id, editTitleText.trim());
    }
    setEditingSessionId(null);
  };

  const toggleProject = (projId: string) => {
    setExpandedProjects(prev => ({ ...prev, [projId]: !prev[projId] }));
  };

  const toggleFile = (filePath: string) => {
    setExpandedFiles(prev => ({ ...prev, [filePath]: !prev[filePath] }));
  };

  // Group sessions by category
  const globalSessions = sessions.filter(s => s.tier1 === 'global');

  return (
    <div style={{
      width: `${width}px`,
      minWidth: '220px',
      maxWidth: '420px',
      height: 'calc(100vh - 38px)',
      background: 'var(--bg-base)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
      fontSize: '12px'
    }}>
      {/* Panel Header */}
      <div style={{
        padding: '10px 12px 8px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          项目与会话架构树
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {sessions.length} 个会话
        </span>
      </div>

      {/* Tree Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 4px' }}>

        {/* ========================================================= */}
        {/* 1. TOP-LEVEL GROUP: 🌐 全局自由会话 (Global Free Sessions) */}
        {/* ========================================================= */}
        <div style={{ marginBottom: '8px' }}>
          <div
            onClick={() => setGlobalExpanded(!globalExpanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 6px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              fontSize: '11px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {globalExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <Globe size={13} color="var(--text-muted)" />
              <span>🌐 全局自由会话 ({globalSessions.length})</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNewGlobalSession();
              }}
              title="新建全局自由会话"
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '3px',
                background: 'transparent',
                border: 'none',
                color: 'var(--accent)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Plus size={13} />
            </button>
          </div>

          {/* Global Session Items */}
          {globalExpanded && (
            <div style={{ paddingLeft: '14px', marginTop: '2px' }}>
              {globalSessions.map(session => renderSessionItem(session))}
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 2. TOP-LEVEL GROUP: 📁 项目管理与会话 (Projects Group)    */}
        {/* ========================================================= */}
        <div>
          <div
            onClick={() => setProjectsExpanded(!projectsExpanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 6px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              fontSize: '11px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {projectsExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <Folder size={13} color="var(--accent)" />
              <span>📁 工作区项目 ({projects.length})</span>
            </div>
          </div>

          {/* Project List */}
          {projectsExpanded && (
            <div style={{ paddingLeft: '8px', marginTop: '2px' }}>
              {projects.map(proj => {
                const isProjOpen = expandedProjects[proj.id] ?? true;
                const projSessions = sessions.filter(s => s.projectId === proj.id && s.tier1 === 'project');
                const fileSessions = sessions.filter(s => s.projectId === proj.id && s.tier1 === 'file');

                return (
                  <div key={proj.id} style={{ marginBottom: '6px' }}>
                    {/* Project Folder Header */}
                    <div
                      onClick={() => toggleProject(proj.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 6px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        background: 'rgba(0,0,0,0.02)',
                        fontSize: '11px',
                        fontWeight: 600
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {isProjOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        {isProjOpen ? <FolderOpen size={13} color="var(--accent)" /> : <Folder size={13} color="var(--accent)" />}
                        <span style={{ color: 'var(--text-primary)' }}>{proj.name}</span>
                        <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 400 }}>({proj.gitBranch})</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNewProjectSession(proj.id);
                        }}
                        title="在此工程下新建会话"
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '3px',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--accent)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    {/* Project Children: Project-level sessions & File-level sessions */}
                    {isProjOpen && (
                      <div style={{ paddingLeft: '14px', marginTop: '2px' }}>
                        {/* 2.1 Project-scope Sessions */}
                        {projSessions.map(session => renderSessionItem(session))}

                        {/* 2.2 File-scope Sub-nodes */}
                        {fileSessions.length > 0 && (
                          <div style={{ marginTop: '4px' }}>
                            {/* File Parent Node */}
                            <div
                              onClick={() => toggleFile('src/bus/GatewayBus.ts')}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '3px 4px',
                                fontSize: '11px',
                                color: '#2563EB',
                                cursor: 'pointer',
                                fontWeight: 500
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {expandedFiles['src/bus/GatewayBus.ts'] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                <FileText size={12} color="#2563EB" />
                                <span>src/bus/GatewayBus.ts</span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNewFileSession(proj.id, 'src/bus/GatewayBus.ts');
                                }}
                                title="针对此文件开新会话"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#2563EB',
                                  cursor: 'pointer'
                                }}
                              >
                                <Plus size={11} />
                              </button>
                            </div>

                            {/* File's sessions */}
                            {expandedFiles['src/bus/GatewayBus.ts'] && (
                              <div style={{ paddingLeft: '12px' }}>
                                {fileSessions.map(session => renderSessionItem(session))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. Tag Adding Popover Modal (When 🏷️ is clicked)           */}
      {/* ========================================================= */}
      {taggingSessionId && (
        <div style={{
          padding: '10px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface-elevated)',
          boxShadow: '0 -4px 12px rgba(0,0,0,0.06)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600 }}>添加标签 (Tags)</span>
            <button
              onClick={() => setTaggingSessionId(null)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={12} />
            </button>
          </div>
          {/* Quick preset tags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
            {popularTags.map(t => (
              <span
                key={t}
                onClick={() => {
                  onAddTag(taggingSessionId, t);
                  setTaggingSessionId(null);
                }}
                style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  background: tagColors[t]?.bg || 'var(--bg-surface)',
                  color: tagColors[t]?.text || 'var(--text-primary)',
                  border: `1px solid ${tagColors[t]?.border || 'var(--border-subtle)'}`,
                  cursor: 'pointer'
                }}
              >
                #{t}
              </span>
            ))}
          </div>
          {/* Custom tag input */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <input
              type="text"
              placeholder="输入自定义标签后按回车..."
              value={newTagInput}
              onChange={e => setNewTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newTagInput.trim()) {
                  onAddTag(taggingSessionId, newTagInput.trim());
                  setNewTagInput('');
                  setTaggingSessionId(null);
                }
              }}
              style={{
                flex: 1,
                padding: '4px 6px',
                fontSize: '11px',
                borderRadius: '3px',
                border: '1px solid var(--border-strong)',
                background: 'var(--bg-base)',
                color: 'var(--text-primary)',
                outline: 'none'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );

  // Helper renderer for a single session item
  function renderSessionItem(session: SessionItem) {
    const isSelected = session.id === currentSessionId;
    const isEditing = editingSessionId === session.id;

    return (
      <div
        key={session.id}
        onClick={() => onSelectSession(session.id)}
        className="session-tree-item"
        style={{
          padding: '6px 8px',
          borderRadius: '5px',
          marginBottom: '3px',
          cursor: 'pointer',
          background: isSelected ? 'var(--accent-subtle)' : 'transparent',
          border: isSelected ? '1px solid rgba(217, 107, 39, 0.3)' : '1px solid transparent',
          position: 'relative',
          transition: 'all 0.15s ease'
        }}
      >
        {/* Title or In-place edit input */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {isEditing ? (
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}
              onClick={e => e.stopPropagation()}
            >
              <input
                type="text"
                value={editTitleText}
                autoFocus
                onChange={e => setEditTitleText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') confirmRename(session.id);
                  if (e.key === 'Escape') setEditingSessionId(null);
                }}
                style={{
                  flex: 1,
                  padding: '2px 4px',
                  fontSize: '11px',
                  borderRadius: '3px',
                  border: '1px solid var(--accent)',
                  background: 'var(--bg-surface-elevated)',
                  outline: 'none',
                  color: 'var(--text-primary)'
                }}
              />
              <button
                onClick={() => confirmRename(session.id)}
                style={{ background: 'var(--accent)', border: 'none', color: '#FFF', borderRadius: '3px', padding: '2px 4px', cursor: 'pointer' }}
              >
                <Check size={11} />
              </button>
              <button
                onClick={() => setEditingSessionId(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={11} />
              </button>
            </div>
          ) : (
            <>
              <div
                onDoubleClick={(e) => startRename(session, e)}
                title="双击重命名"
                style={{
                  fontWeight: isSelected ? 600 : 500,
                  color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                  fontSize: '12px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1
                }}
              >
                {session.title}
              </div>

              {/* Action Buttons (Visible on hover or when selected) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  opacity: isSelected ? 1 : 0.6
                }}
                onClick={e => e.stopPropagation()}
              >
                {/* Add Tag */}
                <button
                  title="为会话打标签"
                  onClick={() => setTaggingSessionId(session.id)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '1px' }}
                >
                  <Tag size={11} />
                </button>

                {/* Rename */}
                <button
                  title="重命名会话"
                  onClick={(e) => startRename(session, e)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '1px' }}
                >
                  <Edit2 size={11} />
                </button>

                {/* Delete */}
                <button
                  title="删除此会话"
                  onClick={() => onDeleteSession(session.id)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#DC2626', padding: '1px' }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Tags row */}
        {session.tags && session.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
            {session.tags.map(t => {
              const style = getTagStyle(t);
              return (
                <span
                  key={t}
                  style={{
                    fontSize: '9px',
                    padding: '1px 4px',
                    borderRadius: '3px',
                    background: style.bg,
                    color: style.text,
                    border: `1px solid ${style.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                >
                  #{t}
                  <X
                    size={9}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveTag(session.id, t);
                    }}
                  />
                </span>
              );
            })}
          </div>
        )}

        {/* Subtitle with message count & token usage */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '4px',
          fontSize: '10px',
          color: 'var(--text-muted)'
        }}>
          <span>{session.messagesCount} 条消息</span>
          <span>{(session.totalTokens / 1000).toFixed(1)}k tokens</span>
        </div>
      </div>
    );
  }
};
