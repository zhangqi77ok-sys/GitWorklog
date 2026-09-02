import React, { useState } from 'react';
import { FolderPlus, Search, MessageSquare, FolderTree, RefreshCw, FolderOpen } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useProjectSessionStore, SessionRecord } from '../../store/useProjectSessionStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { WorkspaceTreeView } from '../workspace/WorkspaceTreeView';
import { TagFilterBar } from './TagFilterBar';
import { ProjectTreeItem } from './ProjectTreeItem';
import { ConfirmModal } from '../common/ConfirmModal';
import { toast } from '../common/Toast';

interface LeftPanelProps {
  onFileSelected?: () => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({ onFileSelected }) => {
  const {
    projects,
    activeProjectId,
    activeSessionId,
    searchQuery,
    selectedTag,
    setActiveSession,
    setActiveProject,
    addProjectFolder,
    deleteProject,
    createSession,
    updateSession,
    deleteSession,
    setSearchQuery,
    setSelectedTag,
  } = useProjectSessionStore();

  const { currentRoot, loadTree } = useWorkspaceStore();

  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('tcode_collapsed_projects_v2');
        return saved ? JSON.parse(saved) : {};
      }
    } catch (e) {}
    return {};
  });

  const toggleProjectCollapse = (projectId: string) => {
    setCollapsedProjects((prev) => {
      const next = {
        ...prev,
        [projectId]: !prev[projectId],
      };
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('tcode_collapsed_projects_v2', JSON.stringify(next));
        }
      } catch (e) {}
      return next;
    });
  };

  // Unified ConfirmModal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const safeProjects = Array.isArray(projects) ? projects : [];
  const activeProject = safeProjects.find((p) => p.id === activeProjectId) || safeProjects[0];

  // Extract all unique tags & compute tag counts safely
  const allTags = Array.from(
    new Set(safeProjects.flatMap((p) => (p.sessions || []).flatMap((s) => s.tags || [])))
  );
  const tagCounts: Record<string, number> = {
    all: safeProjects.reduce((acc, p) => acc + (p.sessions || []).length, 0),
  };
  allTags.forEach((t) => {
    tagCounts[t] = safeProjects.reduce(
      (acc, p) => acc + (p.sessions || []).filter((s) => s.tags?.includes(t)).length,
      0
    );
  });

  // 2. Select system folder natively via Rust RFD
  const handleOpenFolder = async () => {
    try {
      const selectedPath = await invoke<string | null>('select_folder_dialog');
      if (selectedPath && selectedPath.trim()) {
        const proj = await addProjectFolder(selectedPath.trim());
        if (proj) {
          loadTree(proj.path);
          toast.success(`成功挂载项目: ${proj.name}`);
        }
      }
    } catch (err: any) {
      toast.error(`打开文件夹失败: ${err}`);
    }
  };

  const handleCreateSession = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const title = `新任务分支 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    await createSession(projectId, title, ['#开发']);
    toast.success('已创建新会话分支');
  };

  const handleSelectSession = (projectId: string, session: SessionRecord) => {
    setActiveProject(projectId);
    setActiveSession(session.id);
    const targetProj = safeProjects.find((p) => p.id === projectId);
    if (targetProj?.path) {
      loadTree(targetProj.path);
    }
  };

  const handleUpdateSessionTitle = async (sessionId: string, title: string) => {
    await updateSession(sessionId, title);
  };

  const handleTogglePinSession = async (session: SessionRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    await updateSession(session.id, undefined, undefined, !session.is_pinned);
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmConfig({
      isOpen: true,
      title: '删除会话分支',
      message: '确定删除该会话分支及其历史记录吗？此操作不可撤销。',
      isDanger: true,
      onConfirm: async () => {
        await deleteSession(sessionId);
        toast.success('已删除会话分支');
      },
    });
  };

  const handleDeleteProject = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const proj = safeProjects.find((p) => p.id === projectId);
    setConfirmConfig({
      isOpen: true,
      title: '从工作台移除项目',
      message: `确定从工作台移除项目「${proj?.name || '当前项目'}」吗？本地磁盘文件将保持完整，不会被删除。`,
      isDanger: true,
      onConfirm: async () => {
        await deleteProject(projectId);
        toast.success('已从工作台移除项目');
      },
    });
  };

  const [splitRatio, setSplitRatio] = useState<number>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('tcode_left_panel_split_ratio');
        return saved ? parseFloat(saved) : 55;
      }
    } catch (e) {}
    return 55;
  });

  const [isDraggingVertical, setIsDraggingVertical] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleVerticalMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingVertical(true);
  };

  React.useEffect(() => {
    if (!isDraggingVertical) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalHeight = rect.height;
      if (totalHeight <= 0) return;
      const offsetY = e.clientY - rect.top;
      const newRatio = Math.max(20, Math.min(80, (offsetY / totalHeight) * 100));
      setSplitRatio(newRatio);
    };

    const handleMouseUp = () => {
      setIsDraggingVertical(false);
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('tcode_left_panel_split_ratio', String(splitRatio));
        }
      } catch (e) {}
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingVertical, splitRatio]);

  return (
    <aside
      ref={containerRef}
      className="w-full h-full bg-[#FAF8F5] flex flex-col select-none overflow-hidden"
    >
      {/* ──────────────────────────────────────────────────────────── */}
      {/* 栏 1 (上半部)：项目与会话管理 (Projects & Sessions)             */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div
        style={{ height: `${splitRatio}%` }}
        className="flex flex-col border-b border-[#E6DFD5] bg-[#F4EFEA] overflow-hidden"
      >
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
            className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-[#FAF8F5] border border-[#E6DFD5] hover:border-[#D96B27] rounded text-[11px] font-medium text-[#3D3A36] hover:text-[#D96B27] transition-all shadow-xs cursor-pointer"
            title="打开本地项目文件夹"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>打开项目</span>
          </button>
        </div>

        {/* 1.2 Search & Tag Filter Bar */}
        {safeProjects.length > 0 && (
          <div className="p-2 border-b border-[#E6DFD5] space-y-1.5 bg-[#FAF8F5]/50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A847C]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索项目、会话或标签..."
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
        )}

        {/* 1.3 Multi-Project & Nested Sessions List (独立滚动) */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {safeProjects.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-xs text-[#8A847C] select-none">
              <FolderOpen className="w-10 h-10 mb-2 text-[#D96B27]/40" />
              <p className="font-semibold text-[#1E1C1A] mb-1">未打开任何项目</p>
              <p className="text-[11px] text-[#8A847C] mb-3">
                点击下方按钮选择本地代码文件夹开启工作区
              </p>
              <button
                onClick={handleOpenFolder}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D96B27] hover:bg-[#B8551B] text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>打开本地项目文件夹</span>
              </button>
            </div>
          ) : (
            safeProjects.map((project) => (
              <ProjectTreeItem
                key={project.id}
                project={project}
                isActiveProject={activeProjectId === project.id}
                isCollapsed={!!collapsedProjects[project.id]}
                activeSessionId={activeSessionId}
                searchQuery={searchQuery}
                selectedTag={selectedTag}
                onToggleCollapse={toggleProjectCollapse}
                onSelectProject={(id) => {
                  setActiveProject(id);
                  const proj = safeProjects.find((p) => p.id === id);
                  if (proj?.path) {
                    loadTree(proj.path);
                  }
                }}
                onCreateSession={handleCreateSession}
                onSelectSession={handleSelectSession}
                onUpdateSessionTitle={handleUpdateSessionTitle}
                onTogglePinSession={handleTogglePinSession}
                onDeleteSession={handleDeleteSession}
                onDeleteProject={handleDeleteProject}
              />
            ))
          )}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 上下拖拽分割条 (Draggable Vertical Splitter)                  */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div
        onMouseDown={handleVerticalMouseDown}
        title="上下拖动调节项目会话与文件管理区域高度比例"
        className={`h-2 w-full cursor-row-resize flex items-center justify-center select-none transition-colors border-y border-[#E6DFD5] ${
          isDraggingVertical
            ? 'bg-[#D96B27]'
            : 'bg-[#F4EFEA] hover:bg-[#D96B27]/40'
        }`}
      >
        <div className="w-10 h-0.5 bg-[#8A847C]/40 rounded-full" />
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 栏 2 (下半部)：工作区文件系统树 (Workspace Files Tree)           */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div
        style={{ height: `${100 - splitRatio}%` }}
        className="flex flex-col bg-[#FAF8F5] overflow-hidden"
      >
        {/* 2.1 Workspace Header */}
        <div className="p-2 px-3 border-b border-[#E6DFD5] flex items-center justify-between bg-[#F4EFEA]">
          <div className="flex items-center gap-1.5 min-w-0">
            <FolderTree className="w-3.5 h-3.5 text-[#D96B27] flex-shrink-0" />
            <span className="font-semibold text-xs text-[#1E1C1A] tracking-wider uppercase truncate">
              文件资源管理 {activeProject ? `(${activeProject.name})` : ''}
            </span>
          </div>
          {activeProject && (
            <button
              onClick={() => activeProject.path && loadTree(activeProject.path)}
              className="p-1 hover:bg-white rounded text-[#8A847C] hover:text-[#1E1C1A] transition-colors cursor-pointer"
              title="刷新文件树"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 2.2 Workspace Tree Body */}
        <div className="flex-1 overflow-y-auto p-1 font-mono text-xs">
          {currentRoot ? (
            <WorkspaceTreeView rootNode={currentRoot} />
          ) : (
            <div className="p-4 text-center text-xs text-[#8A847C]">
              {activeProject ? '正在加载文件系统树...' : '请先选择一个活跃项目'}
            </div>
          )}
        </div>
      </div>

      {/* Unified Action Confirm Modal */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        isDanger={confirmConfig.isDanger}
        onConfirm={confirmConfig.onConfirm}
        onClose={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </aside>
  );
};
