import React from 'react';
import { ChevronDown, ChevronRight, Folder, Plus, Trash2 } from 'lucide-react';
import { ProjectRecord, SessionRecord } from '../../store/useProjectSessionStore';
import { SessionTreeItem } from './SessionTreeItem';

interface ProjectTreeItemProps {
  project: ProjectRecord;
  isActiveProject: boolean;
  isCollapsed: boolean;
  activeSessionId: string | null;
  searchQuery: string;
  selectedTag: string | null;
  onToggleCollapse: (projectId: string) => void;
  onSelectProject: (projectId: string) => void;
  onCreateSession: (projectId: string, e: React.MouseEvent) => void;
  onSelectSession: (projectId: string, session: SessionRecord) => void;
  onUpdateSessionTitle: (sessionId: string, title: string) => Promise<void>;
  onTogglePinSession: (session: SessionRecord, e: React.MouseEvent) => Promise<void>;
  onDeleteSession: (sessionId: string, e: React.MouseEvent) => void | Promise<void>;
  onDeleteProject?: (projectId: string, e: React.MouseEvent) => void;
}

export const ProjectTreeItem: React.FC<ProjectTreeItemProps> = ({
  project,
  isActiveProject,
  isCollapsed,
  activeSessionId,
  searchQuery,
  selectedTag,
  onToggleCollapse,
  onSelectProject,
  onCreateSession,
  onSelectSession,
  onUpdateSessionTitle,
  onTogglePinSession,
  onDeleteSession,
  onDeleteProject,
}) => {
  // Filter sessions by search & tags
  const filteredSessions = project.sessions.filter((s) => {
    const matchesSearch =
      !searchQuery ||
      (s.title || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      s.tags?.some((t) => (t || '').toLowerCase().includes((searchQuery || '').toLowerCase()));
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
      className={`rounded-lg border transition-all ${
        isActiveProject
          ? 'border-[#D96B27]/40 bg-white/70 shadow-xs'
          : 'border-[#E6DFD5] bg-white/30'
      }`}
    >
      {/* Project Header */}
      <div
        onClick={() => onSelectProject(project.id)}
        className="flex items-center justify-between p-2 cursor-pointer hover:bg-[#EAE4DC]/50 rounded-t-lg transition-colors group"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(project.id);
            }}
            className="text-[#8A847C] hover:text-[#1E1C1A] p-0.5 rounded cursor-pointer"
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
          <span
            className={`text-xs font-semibold truncate ${
              isActiveProject ? 'text-[#1E1C1A]' : 'text-[#6B665F]'
            }`}
          >
            {project.name}
          </span>
          {isCollapsed && (
            <span className="text-[10px] text-[#8A847C] bg-[#EAE4DC] px-1.5 py-0.2 rounded-full">
              {project.sessions.length}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => onCreateSession(project.id, e)}
            title="为该项目新建会话"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium text-[#D96B27] hover:bg-[#FAF8F5] border border-transparent hover:border-[#D96B27]/30 transition-all opacity-90 group-hover:opacity-100 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span className="text-[10px]">新建会话</span>
          </button>

          {onDeleteProject && (
            <button
              onClick={(e) => onDeleteProject(project.id, e)}
              title="从工作台移除该项目"
              className="p-1 rounded text-[#8A847C] hover:text-[#C62828] hover:bg-[#FFEBEE] transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Project Sessions Nested List (when expanded) */}
      {!isCollapsed && (
        <div className="p-1.5 pt-0 space-y-1 pl-4 border-l-2 border-[#E6DFD5]/60 ml-3 mb-1">
          {sortedSessions.length === 0 ? (
            <div className="py-2 text-center text-[11px] text-[#8A847C]">
              {searchQuery || selectedTag ? '未匹配到会话' : '暂无会话，点击新建'}
            </div>
          ) : (
            sortedSessions.map((session) => (
              <SessionTreeItem
                key={session.id}
                session={session}
                isActive={activeSessionId === session.id}
                onSelect={() => onSelectSession(project.id, session)}
                onUpdateTitle={(newTitle) => onUpdateSessionTitle(session.id, newTitle)}
                onTogglePin={(e) => onTogglePinSession(session, e)}
                onDelete={(e) => onDeleteSession(session.id, e)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};
