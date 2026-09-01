import React, { useState } from 'react';
import { Pin, MessageSquare, Edit2, Trash2, Tag, Check, X } from 'lucide-react';
import { SessionRecord } from '../../store/useProjectSessionStore';

interface SessionTreeItemProps {
  session: SessionRecord;
  isActive: boolean;
  onSelect: () => void;
  onUpdateTitle: (newTitle: string) => Promise<void>;
  onTogglePin: (e: React.MouseEvent) => Promise<void>;
  onDelete: (e: React.MouseEvent) => void | Promise<void>;
  onAddTag?: (tag: string) => Promise<void>;
}

export const SessionTreeItem: React.FC<SessionTreeItemProps> = ({
  session,
  isActive,
  onSelect,
  onUpdateTitle,
  onTogglePin,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [titleInput, setTitleInput] = useState(session.title);

  const handleSaveTitle = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (titleInput.trim() && titleInput.trim() !== session.title) {
      await onUpdateTitle(titleInput.trim());
    }
    setIsEditing(false);
  };

  const handleCancelTitle = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setTitleInput(session.title);
    setIsEditing(false);
  };

  const formatTimestamp = (ts: number) => {
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return '刚刚';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;
    const date = new Date(ts);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const getTagBadgeClass = (tag: string) => {
    const lower = (tag || '').toLowerCase();
    if (lower.includes('refactor') || lower.includes('重构')) {
      return 'bg-[#FBE9E7] text-[#D84315] border border-[#FFAB91]';
    }
    if (lower.includes('bug') || lower.includes('修复')) {
      return 'bg-[#E3F2FD] text-[#1565C0] border border-[#90CAF9]';
    }
    if (lower.includes('test') || lower.includes('单测')) {
      return 'bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]';
    }
    return 'bg-[#F4EFEA] text-[#6B665F] border border-[#E6DFD5]';
  };

  return (
    <div
      onClick={onSelect}
      className={`group relative flex flex-col gap-1 p-2 rounded-md cursor-pointer transition-all border ${
        isActive
          ? 'bg-white border-[#D96B27]/50 shadow-xs ring-1 ring-[#D96B27]/20'
          : 'bg-white/60 hover:bg-white border-transparent hover:border-[#E6DFD5]'
      }`}
    >
      {/* Title & Actions Row */}
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {session.is_pinned ? (
            <Pin className="w-3.5 h-3.5 text-[#D96B27] flex-shrink-0 fill-[#D96B27]" />
          ) : (
            <MessageSquare
              className={`w-3.5 h-3.5 flex-shrink-0 ${
                isActive ? 'text-[#D96B27]' : 'text-[#8A847C]'
              }`}
            />
          )}

          {isEditing ? (
            <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle(e);
                  if (e.key === 'Escape') handleCancelTitle(e);
                }}
                autoFocus
                className="w-full px-1.5 py-0.5 text-xs bg-white border border-[#D96B27] rounded outline-none text-[#1E1C1A]"
              />
              <button
                onClick={handleSaveTitle}
                className="p-0.5 text-[#2E7D32] hover:bg-[#E8F5E9] rounded"
                title="保存"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                onClick={handleCancelTitle}
                className="p-0.5 text-[#6B665F] hover:bg-[#F4EFEA] rounded"
                title="取消"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className={`text-xs truncate font-medium ${
                isActive ? 'text-[#1E1C1A]' : 'text-[#3D3A36]'
              }`}
              title={session.title}
            >
              {session.title}
            </span>
          )}
        </div>

        {/* Hover Action Buttons */}
        {!isEditing && (
          <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0 bg-white/90 px-1 rounded shadow-2xs">
            <button
              onClick={onTogglePin}
              title={session.is_pinned ? '取消置顶' : '置顶会话'}
              className={`p-1 rounded transition-colors ${
                session.is_pinned
                  ? 'text-[#D96B27] hover:bg-[#FAF8F5]'
                  : 'text-[#8A847C] hover:text-[#D96B27] hover:bg-[#FAF8F5]'
              }`}
            >
              <Pin className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              title="重命名"
              className="p-1 rounded text-[#8A847C] hover:text-[#1E1C1A] hover:bg-[#FAF8F5] transition-colors"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              onClick={onDelete}
              title="删除会话"
              className="p-1 rounded text-[#8A847C] hover:text-[#C62828] hover:bg-[#FFEBEE] transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Tags Row (if any) */}
      {session.tags && session.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center pl-5">
          {session.tags.map((tag) => (
            <span
              key={tag}
              className={`px-1.5 py-0.2 rounded text-[9px] font-medium ${getTagBadgeClass(tag)}`}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Subtitle / Model Info & Turn Count */}
      <div className="flex items-center justify-between text-[10px] text-[#8A847C] pl-5">
        <span className="truncate">
          {session.model_id || 'DeepSeek-V3'} · {session.messages?.length || 0} 轮对话
        </span>
        <span className="flex-shrink-0">{formatTimestamp(session.updated_at)}</span>
      </div>
    </div>
  );
};
