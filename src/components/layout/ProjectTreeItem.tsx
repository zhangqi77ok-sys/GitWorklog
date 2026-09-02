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
  onUpdateSessionTags?: (sessionId: string, tags: string[]) => Promise<void>;
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
  onUpdateSessionTags,
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
          ? 'border-black/[0.08] bg-white/80 shadow-2xs'
          : 'border-black/[0.04] bg-transparent'
      }`}
    >
      {/* Project Header */}
      <div
        onClick={() => onSelectProject(project.id)}
        className="flex items-center justify-between p-1.5 px-2 cursor-pointer hover:bg-black/[0.03] rounded-t-lg transition-colors group"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(project.id);
            }}
            className="text-[#71717A] hover:text-[#18181B] p-0.5 rounded cursor-pointer"
          >
            {isCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          <Folder
            className={`w-3.5 h-3.5 flex-shrink-0 ${
              isActiveProject ? 'text-[#D96B27]' : 'text-[#71717A]'
            }`}
          />
          <span
            className={`text-xs font-medium truncate ${
              isActiveProject ? 'text-[#18181B]' : 'text-[#52525B]'
            }`}
          >
            {project.name}
          </span>
          {isCollapsed && (
            <span className="text-[10px] text-[#71717A] bg-black/[0.04] px-1.5 py-0.2 rounded-full font-mono">
              {project.sessions.length}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => onCreateSession(project.id, e)}
            title="为该项目新建会话"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-[#18181B] bg-white hover:bg-black/[0.04] border border-black/[0.08] transition-all opacity-0 group-hover:opacity-100 shadow-2xs cursor-pointer"
          >
            <Plus className="w-2.5 h-2.5 text-[#D96B27]" />
            <span>新会话</span>
          </button>

          {onDeleteProject && (
            <button
              onClick={(e) => onDeleteProject(project.id, e)}
              title="从工作台移除该项目"
              className="p-1 rounded text-[#71717A] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Project Sessions Nested List (when expanded) */}
      {!isCollapsed && (
        <div className="p-1 pt-0 space-y-1 pl-3 border-l border-black/[0.08] ml-2.5 mb-1">
          {sortedSessions.length === 0 ? (
            <div className="py-2 text-center text-[11px] text-[#71717A]">
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
                onUpdateTags={async (newTags) => {
                  if (onUpdateSessionTags) await onUpdateSessionTags(session.id, newTags);
                }}
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
