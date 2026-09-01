import React, { useState } from 'react';
import { FolderPlus, Search, MessageSquare, FolderTree, RefreshCw } from 'lucide-react';
import { useProjectSessionStore, SessionRecord } from '../../store/useProjectSessionStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { WorkspaceTreeView } from '../workspace/WorkspaceTreeView';
import { TagFilterBar } from './TagFilterBar';
import { ProjectTreeItem } from './ProjectTreeItem';

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

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  // Extract all unique tags & compute tag counts
  const allTags = Array.from(
    new Set(projects.flatMap((p) => p.sessions.flatMap((s) => s.tags || [])))
  );
  const tagCounts: Record<string, number> = {
    all: projects.reduce((acc, p) => acc + p.sessions.length, 0),
  };
  allTags.forEach((t) => {
    tagCounts[t] = projects.reduce(
      (acc, p) => acc + p.sessions.filter((s) => s.tags?.includes(t)).length,
      0
    );
  });

  const toggleProjectCollapse = (projectId: string) => {
    setCollapsedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const handleOpenFolder = async () => {
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
    await createSession(projectId);
    const proj = projects.find((p) => p.id === projectId);
    if (proj) {
      loadTree(proj.path);
    }
  };

  const handleSelectSession = (projectId: string, session: SessionRecord) => {
    setActiveProject(projectId);
    setActiveSession(session.id);
    const proj = projects.find((p) => p.id === projectId);
    if (proj) {
      loadTree(proj.path);
    }
  };

  return (
    <aside className="w-80 h-full bg-[#F4EFEA] border-r border-[#E6DFD5] flex flex-col flex-shrink-0 select-none overflow-hidden">
      {/* ──────────────────────────────────────────────────────────── */}
      {/* 栏 1 (上半部)：项目与会话管理 (Projects & Sessions)             */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="h-1/2 min-h-[220px] flex flex-col border-b-2 border-[#E6DFD5] bg-[#F4EFEA]">
        {/* 1.1 Header with Open Project */}
        <div className="p-2.5 px-3 border-b border-[#E6DFD5] flex items-center justify-between bg-[#F4EFEA]">
          <div className="flex items-center gap-1.5 min-w-0">
            <MessageSquare className="w-4 h-4 text-[#D96B27] flex-shrink-0" />
            <span className="font-semibold text-xs text-[#1E1C1A] tracking-wider uppercase truncate">
              项目与会话 (Sessions)
            </span>
          </div>
          <button
            onClick={handleOpenFolder}
            className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-[#FAF8F5] border border-[#E6DFD5] hover:border-[#D96B27] rounded text-[11px] font-medium text-[#3D3A36] hover:text-[#D96B27] transition-all shadow-xs"
            title="打开本地项目文件夹"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>打开项目</span>
          </button>
        </div>

        {/* 1.2 Search & Tag Filter Bar */}
        <div className="p-2 border-b border-[#E6DFD5] space-y-1.5 bg-[#FAF8F5]/50">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A847C]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索项目、会话或标签 (Ctrl+K)..."
              className="w-full pl-8 pr-2.5 py-1 bg-white border border-[#E6DFD5] focus:border-[#D96B27] rounded text-xs text-[#1E1C1A] placeholder-[#8A847C] outline-none transition-colors"
            />
          </div>

          <TagFilterBar
            tags={allTags}
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
            tagCounts={tagCounts}
          />
        </div>

        {/* 1.3 Multi-Project & Nested Sessions List (独立滚动) */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {projects.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#8A847C]">
              <p>暂无打开的项目</p>
              <button
                onClick={handleOpenFolder}
                className="mt-2 px-3 py-1 bg-[#D96B27] text-white rounded text-xs font-medium shadow-xs"
              >
                打开本地项目
              </button>
            </div>
          ) : (
            projects.map((project) => (
              <ProjectTreeItem
                key={project.id}
                project={project}
                isActiveProject={activeProjectId === project.id}
                isCollapsed={!!collapsedProjects[project.id]}
                activeSessionId={activeSessionId}
                searchQuery={searchQuery}
                selectedTag={selectedTag}
                onToggleCollapse={toggleProjectCollapse}
                onSelectProject={(pid) => {
                  setActiveProject(pid);
                  loadTree(project.path);
                }}
                onCreateSession={handleCreateSession}
                onSelectSession={handleSelectSession}
                onUpdateSessionTitle={async (sid, title) => {
                  await updateSession(sid, title);
                }}
                onTogglePinSession={async (session, e) => {
                  e.stopPropagation();
                  await updateSession(session.id, undefined, undefined, !session.is_pinned);
                }}
                onDeleteSession={async (sid, e) => {
                  e.stopPropagation();
                  if (window.confirm('确定要删除此会话及其历史对话吗？')) {
                    await deleteSession(sid);
                  }
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 栏 2 (下半部)：当前项目工作区文件树 (Files Explorer)              */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-[160px] bg-[#F4EFEA] overflow-hidden">
        <div className="p-2 px-3 border-b border-[#E6DFD5] flex items-center justify-between bg-[#F4EFEA]">
          <div className="flex items-center gap-1.5 min-w-0">
            <FolderTree className="w-3.5 h-3.5 text-[#D96B27] flex-shrink-0" />
            <span className="font-semibold text-xs text-[#1E1C1A] tracking-wider uppercase truncate">
              文件资源管理 ({activeProject ? activeProject.name : '工作区'})
            </span>
          </div>
          <button
            onClick={() => activeProject && loadTree(activeProject.path)}
            className="p-1 text-[#8A847C] hover:text-[#1E1C1A] hover:bg-[#EAE4DC] rounded transition-colors"
            title="刷新文件树"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {currentRoot ? (
            <WorkspaceTreeView rootNode={currentRoot} />
          ) : (
            <div className="p-3 text-center text-xs text-[#8A847C]">正在加载工作区文件树...</div>
          )}
        </div>
      </div>
    </aside>
  );
};
