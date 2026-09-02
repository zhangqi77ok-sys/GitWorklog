import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Pin,
  X,
  Plus,
  Code2,
} from 'lucide-react';
import { useProjectSessionStore, SessionRecord } from '../../store/useProjectSessionStore';

interface SessionTabBarProps {
  isEditorOpen?: boolean;
  onToggleEditor?: () => void;
}

export const SessionTabBar: React.FC<SessionTabBarProps> = ({
  isEditorOpen,
  onToggleEditor,
}) => {
  const {
    projects,
    activeProjectId,
    activeSessionId,
    openSessionIds,
    setActiveSession,
    openSessionTab,
    closeSessionTab,
    closeOtherSessionTabs,
    closeAllSessionTabs,
    reorderSessionTabs,
    createSession,
  } = useProjectSessionStore();

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    sessionId: string;
    index: number;
  } | null>(null);

  const tabContainerRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu) setContextMenu(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [contextMenu]);

  // Find all session objects for open IDs
  const allSessionsMap = new Map<string, { session: SessionRecord; projectName: string }>();
  for (const proj of projects || []) {
    for (const s of proj.sessions || []) {
      allSessionsMap.set(s.id, { session: s, projectName: proj.name });
    }
  }

  const openSessions = openSessionIds
    .map((id) => ({ id, item: allSessionsMap.get(id) }))
    .filter((entry): entry is { id: string; item: { session: SessionRecord; projectName: string } } => !!entry.item);

  // Auto-recover session tab if empty
  useEffect(() => {
    if (openSessions.length === 0) {
      const fallbackSessId = activeSessionId || projects?.[0]?.sessions?.[0]?.id;
      if (fallbackSessId) {
        openSessionTab(fallbackSessId);
      }
    }
  }, [openSessions.length, activeSessionId, projects, openSessionTab]);

  const handleContextMenu = (e: React.MouseEvent, sessionId: string, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      sessionId,
      index,
    });
  };

  const handleCloseToTheRight = (index: number) => {
    for (let i = index + 1; i < openSessionIds.length; i++) {
      closeSessionTab(openSessionIds[i]);
    }
  };

  const handleNewSession = async () => {
    if (activeProjectId) {
      await createSession(activeProjectId);
    }
  };

  // Drag and Drop reordering
  const handleDragStart = (index: number, e: React.DragEvent) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', String(index));
    } catch (err) {}
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (targetIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      reorderSessionTabs(draggedIndex, targetIndex);
    }
    setDraggedIndex(null);
  };

  return (
    <div className="h-9 min-h-[36px] max-h-[36px] bg-[#FAF9F6] border-b border-[#E8E5DF] flex items-center justify-between px-3 select-none z-10 relative">
      {/* Left / Center: Draggable Multi-Session Tabs Scroll Area */}
      <div
        ref={tabContainerRef}
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 h-full py-1"
      >
        {openSessions.map(({ id, item }, idx) => {
          const { session, projectName } = item;
          const isActive = activeSessionId === id;

          return (
            <div
              key={id}
              draggable
              onDragStart={(e) => handleDragStart(idx, e)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(idx, e)}
              onClick={() => setActiveSession(id)}
              onContextMenu={(e) => handleContextMenu(e, id, idx)}
              className={`group flex items-center gap-1.5 px-2.5 h-6.5 rounded-lg text-xs cursor-pointer transition-all flex-shrink-0 ${
                isActive
                  ? 'bg-white text-[#18181B] font-medium shadow-2xs border border-black/[0.08]'
                  : 'bg-transparent hover:bg-black/[0.03] text-[#71717A] hover:text-[#18181B]'
              }`}
              title={`${session.title} (${projectName})\n拖动可调整标签顺序，右键查看快捷操作`}
            >
              {session.is_pinned ? (
                <Pin className="w-2.5 h-2.5 text-[#D96B27] flex-shrink-0" />
              ) : (
                <MessageSquare className="w-3 h-3 text-[#71717A] flex-shrink-0" />
              )}
              <span className="truncate max-w-[130px] font-mono text-[11px]">{session.title}</span>

              {/* Close Tab Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeSessionTab(id);
                }}
                title="关闭标签页"
                className="p-0.5 rounded text-[#71717A] hover:text-[#18181B] hover:bg-black/[0.06] transition-opacity cursor-pointer opacity-0 group-hover:opacity-100"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          );
        })}

        {/* New Session Tab Button (+) */}
        {activeProjectId && (
          <button
            type="button"
            onClick={handleNewSession}
            title="在当前项目中开启新会话分支"
            className="p-1 h-6 w-6 flex items-center justify-center rounded-lg hover:bg-black/[0.05] text-[#71717A] hover:text-[#18181B] transition-all cursor-pointer flex-shrink-0"
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Right Action Tools: Popout Code Workspace */}
      <div className="flex items-center gap-2 flex-shrink-0 pl-3">
        {onToggleEditor && (
          <button
            type="button"
            onClick={onToggleEditor}
            title={isEditorOpen ? '收起右侧代码工作区 (Alt+E)' : '弹出右侧代码工作区与 Diff 审查 (Alt+E)'}
            className={`flex items-center gap-1.5 px-3 h-6 rounded-full text-xs font-medium transition-all cursor-pointer border shadow-2xs ${
              isEditorOpen
                ? 'bg-white text-[#D96B27] border-black/[0.12] font-semibold'
                : 'bg-white/80 hover:bg-white text-[#52525B] hover:text-[#18181B] border-black/[0.08]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-[#D96B27]" />
            <span>代码工作区</span>
          </button>
        )}
      </div>

      {/* Context Menu on Tab Right-Click */}
      {contextMenu && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 min-w-[150px] bg-white border border-[#E6DFD5] rounded-lg shadow-lg py-1 text-xs text-[#1E1C1A] animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              closeSessionTab(contextMenu.sessionId);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#FAF8F5] hover:text-[#D96B27] flex items-center justify-between cursor-pointer"
          >
            <span>关闭当前会话</span>
            <span className="text-[10px] text-[#8A847C]">Close</span>
          </button>
          <button
            type="button"
            onClick={() => {
              closeOtherSessionTabs(contextMenu.sessionId);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#FAF8F5] hover:text-[#D96B27] flex items-center justify-between cursor-pointer"
          >
            <span>关闭其他会话</span>
            <span className="text-[10px] text-[#8A847C]">Close Others</span>
          </button>
          <button
            type="button"
            onClick={() => {
              handleCloseToTheRight(contextMenu.index);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#FAF8F5] hover:text-[#D96B27] flex items-center justify-between cursor-pointer"
          >
            <span>关闭右侧会话</span>
            <span className="text-[10px] text-[#8A847C]">Close Right</span>
          </button>
          <div className="h-px bg-[#E6DFD5] my-1" />
          <button
            type="button"
            onClick={() => {
              closeAllSessionTabs();
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center justify-between cursor-pointer"
          >
            <span>关闭所有会话</span>
            <span className="text-[10px] text-red-400">Close All</span>
          </button>
        </div>
      )}
    </div>
  );
};
