import { FileExplorerPanel } from './panels/FileExplorerPanel';
import { GlobalSearchPanel } from './panels/GlobalSearchPanel';
import { GitSnapshotsPanel } from './panels/GitSnapshotsPanel';
import { GatewayCockpitPanel } from './panels/GatewayCockpitPanel';
import { RulesMemoryPanel } from './panels/RulesMemoryPanel';
import { SettingsPanel } from './panels/SettingsPanel';
import React, { useState, useRef } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Globe,
  Folder,
  FolderOpen,
  FolderPlus,
  Trash2,
  Edit2,
  Tag,
  Check,
  X,
  HardDrive
} from 'lucide-react';
import { SessionItem, ProjectGroup } from '../types/contracts';

interface LeftPanelProps {
  width: number;
  activeNav: string;
  onOpenFile: (filePath: string, fileName: string, line?: number) => void;
  projects: ProjectGroup[];
  sessions: SessionItem[];
  currentSessionId: string;
  onSelectSession: (id: string) => void;
  onNewGlobalSession: () => void;
  onNewProjectSession: (projectId: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onAddTag: (sessionId: string, tag: string) => void;
  onRemoveTag: (sessionId: string, tag: string) => void;
  onOpenDirectory: (folderPath: string) => void;
  onRemoveProject: (projectId: string) => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({
  width,
  activeNav,
  onOpenFile,
  projects,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewGlobalSession,
  onNewProjectSession,
  onDeleteSession,
  onRenameSession,
  onAddTag,
  onRemoveTag,
  onOpenDirectory,
  onRemoveProject
}) => {
  const [globalExpanded, setGlobalExpanded] = useState(true);
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({
    'proj-1': true,
    'proj-2': true
  });

  const [showDirPickerModal, setShowDirPickerModal] = useState(false);
  const [customPathInput, setCustomPathInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState('');

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

  const handleNativeFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const firstFile = files[0];
      const relPath = firstFile.webkitRelativePath;
      const rootName = relPath.split('/')[0];
      onOpenDirectory(`d:/workspace/${rootName}`);
      setShowDirPickerModal(false);
    }
  };

  const handleConfirmCustomPath = () => {
    if (customPathInput.trim()) {
      onOpenDirectory(customPathInput.trim());
      setCustomPathInput('');
      setShowDirPickerModal(false);
    }
  };

  const globalSessions = sessions.filter(s => s.tier1 === 'global');

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const activeProject = projects.find(p => p.id === currentSession?.projectId) || projects[0];
  const handleSelectProject = (projId: string) => {
    const projSession = sessions.find(s => s.projectId === projId);
    if (projSession) {
      onSelectSession(projSession.id);
    }
  };

  // Render based on active navigation tab
  if (activeNav === 'files') {
    return (
      <div style={{ width: `${width}px`, minWidth: '220px', maxWidth: '380px', height: 'calc(100vh - 38px)', background: 'var(--bg-base)', borderRight: '1px solid var(--border-subtle)' }}>
        <FileExplorerPanel
          activeProject={activeProject}
          projects={projects}
          onSelectProject={handleSelectProject}
          onOpenFile={(path, name) => onOpenFile(path, name)}
        />
      </div>
    );
  }

  if (activeNav === 'search') {
    return (
      <div style={{ width: `${width}px`, minWidth: '220px', maxWidth: '380px', height: 'calc(100vh - 38px)', background: 'var(--bg-base)', borderRight: '1px solid var(--border-subtle)' }}>
        <GlobalSearchPanel
          activeProject={activeProject}
          projects={projects}
          onSelectProject={handleSelectProject}
          onOpenFileAndLine={(path, name, line) => onOpenFile(path, name, line)}
        />
      </div>
    );
  }

  if (activeNav === 'git') {
    return (
      <div style={{ width: `${width}px`, minWidth: '220px', maxWidth: '380px', height: 'calc(100vh - 38px)', background: 'var(--bg-base)', borderRight: '1px solid var(--border-subtle)' }}>
        <GitSnapshotsPanel
          activeProject={activeProject}
          projects={projects}
          onSelectProject={handleSelectProject}
        />
      </div>
    );
  }

  if (activeNav === 'rules') {
    return (
      <div style={{ width: `${width}px`, minWidth: '220px', maxWidth: '380px', height: 'calc(100vh - 38px)', background: 'var(--bg-base)', borderRight: '1px solid var(--border-subtle)' }}>
        <RulesMemoryPanel />
      </div>
    );
  }

  if (activeNav === 'gateway') {
    return (
      <div style={{ width: `${width}px`, minWidth: '220px', maxWidth: '380px', height: 'calc(100vh - 38px)', background: 'var(--bg-base)', borderRight: '1px solid var(--border-subtle)' }}>
        <GatewayCockpitPanel />
      </div>
    );
  }

  if (activeNav === 'settings') {
    return (
      <div style={{ width: `${width}px`, minWidth: '220px', maxWidth: '380px', height: 'calc(100vh - 38px)', background: 'var(--bg-base)', borderRight: '1px solid var(--border-subtle)' }}>
        <SettingsPanel />
      </div>
    );
  }

  return (
    <div style={{
      width: `${width}px`,
      minWidth: '220px',
      maxWidth: '380px',
      height: 'calc(100vh - 38px)',
      background: 'var(--bg-base)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
      fontSize: '12px',
      position: 'relative'
    }}>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleNativeFolderSelect}
        {...({ webkitdirectory: '', directory: '' } as any)}
      />

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
        <button
          onClick={() => setShowDirPickerModal(true)}
          title="选择并打开系统目录"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 7px',
            borderRadius: '4px',
            background: 'var(--accent-subtle)',
            color: 'var(--accent)',
            border: '1px solid rgba(217, 107, 39, 0.3)',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <FolderPlus size={12} />
          <span>打开目录</span>
        </button>
      </div>

      {/* Tree Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 4px' }}>

        {/* 1. 全局自由会话 */}
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

          {globalExpanded && (
            <div style={{ paddingLeft: '14px', marginTop: '2px' }}>
              {globalSessions.map(session => renderSessionItem(session))}
            </div>
          )}
        </div>

        {/* 2. 工作区项目 */}
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
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDirPickerModal(true);
              }}
              title="打开新系统项目目录"
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
              <FolderPlus size={13} />
            </button>
          </div>

          {projectsExpanded && (
            <div style={{ paddingLeft: '8px', marginTop: '2px' }}>
              {projects.map(proj => {
                const isProjOpen = expandedProjects[proj.id] ?? true;
                const projSessions = sessions.filter(s => s.projectId === proj.id && s.tier1 === 'project');

                return (
                  <div key={proj.id} style={{ marginBottom: '6px' }}>
                    <div
                      onClick={() => toggleProject(proj.id)}
                      title={`系统路径: ${proj.path}`}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                        {isProjOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        {isProjOpen ? <FolderOpen size={13} color="var(--accent)" /> : <Folder size={13} color="var(--accent)" />}
                        <span style={{ color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {proj.name}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 400 }}>({proj.gitBranch})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }} onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => onNewProjectSession(proj.id)}
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
                        <button
                          onClick={() => onRemoveProject(proj.id)}
                          title="从工作区移除此工程"
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '3px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    </div>

                    {isProjOpen && (
                      <div style={{ paddingLeft: '14px', marginTop: '2px' }}>
                        {projSessions.map(session => renderSessionItem(session))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Directory Modal Dialog */}
      {showDirPickerModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999
        }}>
          <div style={{
            width: '420px',
            background: 'var(--bg-surface-elevated)',
            borderRadius: '8px',
            border: '1px solid var(--border-strong)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '13px' }}>
                <FolderPlus size={16} color="var(--accent)" />
                <span>选择或打开系统项目目录</span>
              </div>
              <button
                onClick={() => setShowDirPickerModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'var(--accent-subtle)',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent)',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <HardDrive size={14} />
                <span>调用系统文件选择器 (浏览本机文件夹)...</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0', color: 'var(--text-muted)', fontSize: '11px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
              <span>或者手动输入系统绝对路径</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="例如: D:\workspace\my-project 或 e:/pro/agent-learning"
                value={customPathInput}
                onChange={e => setCustomPathInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleConfirmCustomPath();
                }}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  fontSize: '12px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-strong)',
                  background: 'var(--bg-base)',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setShowDirPickerModal(false)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-subtle)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                取消
              </button>
              <button
                onClick={handleConfirmCustomPath}
                disabled={!customPathInput.trim()}
                style={{
                  padding: '5px 14px',
                  borderRadius: '4px',
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#FFF',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                打开此工程
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Adding Modal */}
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

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  opacity: isSelected ? 1 : 0.6
                }}
                onClick={e => e.stopPropagation()}
              >
                <button
                  title="为会话打标签"
                  onClick={() => setTaggingSessionId(session.id)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '1px' }}
                >
                  <Tag size={11} />
                </button>
                <button
                  title="重命名会话"
                  onClick={(e) => startRename(session, e)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '1px' }}
                >
                  <Edit2 size={11} />
                </button>
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
