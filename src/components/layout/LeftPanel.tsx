import React, { useState } from 'react';
import {
  FolderPlus,
  Plus,
  Search,
  Pin,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Trash2,
  Edit2,
  Folder,
  Tag,
  Check,
} from 'lucide-react';
import { useProjectSessionStore, SessionRecord, ProjectRecord } from '../../store/useProjectSessionStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { WorkspaceTreeView } from '../workspace/WorkspaceTreeView';

export const LeftPanel: React.FC = () => {
  const {
    projects,
    activeProjectId,
    activeSessionId,
    searchQuery,
    selectedTag,
    setActiveSession,
    setActiveProject,
    addProjectFolder,
    createSession,
    updateSession,
    deleteSession,
    setSearchQuery,
    setSelectedTag,
  } = useProjectSessionStore();

  const { currentRoot, loadTree } = useWorkspaceStore();
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
  const [showWorkspaceTree, setShowWorkspaceTree] = useState(true);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Extract all unique tags across all projects
  const allTags = Array.from(
    new Set(
      projects.flatMap(p => p.sessions.flatMap(s => s.tags || []))
    )
  );

  const toggleProjectCollapse = (projectId: string) => {
    setCollapsedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const handleOpenFolder = async () => {
    // Prompt directory path or use default
    const inputPath = window.prompt(
      '请输入要打开的本地项目绝对路径 (例如 D:\\weihu\\agent-learning):',
      'D:\\weihu\\agent-learning'
    );
    if (inputPath && inputPath.trim()) {
      const proj = await addProjectFolder(inputPath.trim());
      if (proj) {
        loadTree(proj.path);
      }
    }
  };

  const handleCreateSession = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const session = await createSession(projectId);
    const proj = projects.find(p => p.id === projectId);
    if (proj) {
      loadTree(proj.path);
    }
  };

  const handleSelectSession = (projectId: string, session: SessionRecord) => {
    setActiveSession(session.id);
    const proj = projects.find(p => p.id === projectId);
    if (proj) {
      loadTree(proj.path);
    }
  };

  const startRename = (session: SessionRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const saveRename = async (sessionId: string) => {
    if (editingTitle.trim()) {
      await updateSession(sessionId, editingTitle.trim());
    }
    setEditingSessionId(null);
  };

  const togglePin = async (session: SessionRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    await updateSession(session.id, undefined, undefined, !session.is_pinned);
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('确定要删除此会话及其历史对话吗？')) {
      await deleteSession(sessionId);
    }
  };

  return (
    <aside className="w-80 h-full bg-[#F4EFEA] border-r border-[#E6DFD5] flex flex-col flex-shrink-0 select-none">
      {/* 1. Header with Open Project */}
      <div className="p-3 border-b border-[#E6DFD5] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#D96B27]" />
          <span className="font-semibold text-xs text-[#1E1C1A] tracking-wider uppercase">
            项目与会话 (Sessions)
          </span>
        </div>
        <button
          onClick={handleOpenFolder}
          className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-[#FAF8F5] border border-[#E6DFD5] hover:border-[#D96B27] rounded text-[11px] font-medium text-[#3D3A36] hover:text-[#D96B27] transition-all shadow-sm"
          title="打开本地项目文件夹"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span>打开项目</span>
        </button>
      </div>

      {/* 2. Search & Tag Filter Bar */}
      <div className="p-2.5 border-b border-[#E6DFD5] space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A847C]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索项目、会话或标签 (Ctrl+K)..."
            className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-[#E6DFD5] focus:border-[#D96B27] rounded text-xs text-[#1E1C1A] placeholder-[#8A847C] outline-none transition-colors"
          />
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1 items-center max-h-14 overflow-y-auto no-scrollbar">
            <button
              onClick={() => setSelectedTag(null)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                selectedTag === null
                  ? 'bg-[#D96B27] text-white'
                  : 'bg-[#EAE4DC] text-[#6B665F] hover:text-[#1E1C1A]'
              }`}
            >
              全部
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  selectedTag === tag
                    ? 'bg-[#D96B27] text-white'
                    : 'bg-[#EAE4DC] text-[#6B665F] hover:text-[#1E1C1A]'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. Multi-Project & Nested Sessions List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {projects.length === 0 ? (
          <div className="p-4 text-center text-xs text-[#8A847C]">
            <p>暂无打开的项目</p>
            <button
              onClick={handleOpenFolder}
              className="mt-2 px-3 py-1 bg-[#D96B27] text-white rounded text-xs font-medium"
            >
              打开本地项目
            </button>
          </div>
        ) : (
          projects.map(project => {
            const isCollapsed = !!collapsedProjects[project.id];
            const isActiveProject = activeProjectId === project.id;

            // Filter sessions by search & tags
            const filteredSessions = project.sessions.filter(s => {
              const matchesSearch =
                !searchQuery ||
                s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
              const matchesTag = !selectedTag || s.tags?.includes(selectedTag);
              return matchesSearch && matchesTag;
            });

            // Sort: pinned first, then updated_at desc
            const sortedSessions = [...filteredSessions].sort((a, b) => {
              if (a.is_pinned === b.is_pinned) {
                return b.updated_at - a.updated_at;
              }
              return a.is_pinned ? -1 : 1;
            });

            return (
              <div
                key={project.id}
                className={`rounded-lg border transition-all ${
                  isActiveProject
                    ? 'border-[#D96B27]/40 bg-white/60 shadow-xs'
                    : 'border-[#E6DFD5] bg-white/30'
                }`}
              >
                {/* Project Header */}
                <div
                  onClick={() => {
                    setActiveProject(project.id);
                    loadTree(project.path);
                  }}
                  className="flex items-center justify-between p-2 cursor-pointer hover:bg-[#EAE4DC]/50 rounded-t-lg transition-colors group"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        toggleProjectCollapse(project.id);
                      }}
                      className="text-[#8A847C] hover:text-[#1E1C1A]"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <Folder
                      className={`w-3.5 h-3.5 flex-shrink-0 ${
                        isActiveProject ? 'text-[#D96B27]' : 'text-[#8A847C]'
                      }`}
                    />
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-[#1E1C1A] truncate block">
                        {project.name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={e => handleCreateSession(project.id, e)}
                      className="p-1 text-[#8A847C] hover:text-[#D96B27] hover:bg-[#EAE4DC] rounded transition-colors"
                      title="为该项目新建会话"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Nested Sessions */}
                {!isCollapsed && (
                  <div className="p-1.5 pt-0 space-y-1">
                    {sortedSessions.length === 0 ? (
                      <div className="px-3 py-2 text-[11px] text-[#8A847C] text-center italic">
                        无匹配会话
                      </div>
                    ) : (
                      sortedSessions.map(session => {
                        const isActive = activeSessionId === session.id;
                        const isEditing = editingSessionId === session.id;

                        return (
                          <div
                            key={session.id}
                            onClick={() => handleSelectSession(project.id, session)}
                            className={`group relative flex flex-col p-2 rounded-md cursor-pointer transition-all ${
                              isActive
                                ? 'bg-white border-l-3 border-[#D96B27] shadow-xs'
                                : 'hover:bg-[#EAE4DC] border-l-3 border-transparent'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              {isEditing ? (
                                <div
                                  className="flex items-center gap-1 flex-1"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <input
                                    type="text"
                                    value={editingTitle}
                                    onChange={e => setEditingTitle(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') saveRename(session.id);
                                    }}
                                    autoFocus
                                    className="w-full px-1.5 py-0.5 text-xs bg-white border border-[#D96B27] rounded outline-none font-medium text-[#1E1C1A]"
                                  />
                                  <button
                                    onClick={() => saveRename(session.id)}
                                    className="p-1 text-[#2E7D32]"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <span
                                  onDoubleClick={e => startRename(session, e)}
                                  className={`text-xs font-medium truncate flex-1 ${
                                    isActive ? 'text-[#1E1C1A]' : 'text-[#3D3A36]'
                                  }`}
                                >
                                  {session.title}
                                </span>
                              )}

                              {/* Hover Action Menu */}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={e => togglePin(session, e)}
                                  className={`p-0.5 rounded hover:bg-[#EAE4DC] ${
                                    session.is_pinned
                                      ? 'text-[#D96B27]'
                                      : 'text-[#8A847C]'
                                  }`}
                                  title={session.is_pinned ? '取消置顶' : '置顶'}
                                >
                                  <Pin className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={e => startRename(session, e)}
                                  className="p-0.5 text-[#8A847C] hover:text-[#1E1C1A] rounded hover:bg-[#EAE4DC]"
                                  title="重命名"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={e => handleDeleteSession(session.id, e)}
                                  className="p-0.5 text-[#8A847C] hover:text-[#C62828] rounded hover:bg-[#EAE4DC]"
                                  title="删除会话"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* Tags & Meta row */}
                            <div className="flex items-center gap-1.5 mt-1">
                              {session.is_pinned && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-[#D96B27] bg-[#D96B27]/10 px-1 py-0.2 rounded">
                                  <Pin className="w-2.5 h-2.5" />
                                  置顶
                                </span>
                              )}
                              {session.tags?.map(t => (
                                <span
                                  key={t}
                                  className="text-[9px] text-[#6B665F] bg-[#EAE4DC] px-1 py-0.2 rounded font-mono"
                                >
                                  {t}
                                </span>
                              ))}
                              <span className="text-[10px] text-[#8A847C] ml-auto font-mono">
                                {session.messages?.length || 0} 轮
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 4. Collapsible Workspace File Tree View at Bottom */}
      <div className="border-t border-[#E6DFD5] bg-[#FAF8F5]/80">
        <div
          onClick={() => setShowWorkspaceTree(!showWorkspaceTree)}
          className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[#EAE4DC] transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-[#D96B27]" />
            <span className="text-xs font-semibold text-[#1E1C1A]">
              工作区文件树 (Files Explorer)
            </span>
          </div>
          {showWorkspaceTree ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#8A847C]" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[#8A847C]" />
          )}
        </div>

        {showWorkspaceTree && (
          <div className="max-h-48 overflow-y-auto px-2 pb-2">
            <WorkspaceTreeView rootNode={currentRoot} />
          </div>
        )}
      </div>
    </aside>
  );
};
