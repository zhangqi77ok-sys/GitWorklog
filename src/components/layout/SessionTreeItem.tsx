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
  onUpdateTags?: (newTags: string[]) => Promise<void>;
}

export const SessionTreeItem: React.FC<SessionTreeItemProps> = ({
  session,
  isActive,
  onSelect,
  onUpdateTitle,
  onTogglePin,
  onDelete,
  onUpdateTags,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [titleInput, setTitleInput] = useState(session.title);

  const [isTagEditing, setIsTagEditing] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

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

  const handleAddTag = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    const tag = newTagInput.trim().replace(/^#/, '');
    if (!tag) return;
    const currentTags = session.tags || [];
    if (!currentTags.includes(tag)) {
      const updated = [...currentTags, tag];
      if (onUpdateTags) await onUpdateTags(updated);
    }
    setNewTagInput('');
  };

  const handleRemoveTag = async (tagToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentTags = session.tags || [];
    const updated = currentTags.filter((t) => t !== tagToRemove);
    if (onUpdateTags) await onUpdateTags(updated);
  };

  const formatTimestamp = (ts?: number) => {
    if (!ts || isNaN(ts)) return '刚刚';
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return '刚刚';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;
    const date = new Date(ts);
    if (isNaN(date.getTime())) return '刚刚';
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div
      onClick={onSelect}
      className={`group relative flex flex-col gap-1 p-2 rounded-lg cursor-pointer transition-all border ${
        isActive
          ? 'bg-white border-black/[0.08] shadow-2xs'
          : 'border-transparent hover:bg-black/[0.03]'
      }`}
    >
      {/* Title & Actions Row */}
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-1 pl-0.5">
          {session.is_pinned ? (
            <Pin className="w-3.5 h-3.5 text-[#D96B27] flex-shrink-0 fill-[#D96B27]" />
          ) : (
            <MessageSquare
              className={`w-3.5 h-3.5 flex-shrink-0 ${
                isActive ? 'text-[#D96B27]' : 'text-[#71717A]'
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
                className="w-full px-1.5 py-0.5 text-xs bg-white border border-[#D96B27] rounded-md outline-none text-[#1E1C1A]"
              />
              <button
                onClick={handleSaveTitle}
                className="p-0.5 text-[#2E7D32] hover:bg-[#E8F5E9] rounded cursor-pointer"
                title="保存"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                onClick={handleCancelTitle}
                className="p-0.5 text-[#6B665F] hover:bg-[#F4EFEA] rounded cursor-pointer"
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
              className={`text-xs font-medium truncate ${
                isActive ? 'text-[#18181B]' : 'text-[#52525B] group-hover:text-[#18181B]'
              }`}
              title={`${session.title} (双击重命名)`}
            >
              {session.title || '新开发会话'}
            </span>
          )}
        </div>

        {/* Hover Action Buttons */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onTogglePin}
            className={`p-1 rounded hover:bg-black/[0.05] transition-colors cursor-pointer ${
              session.is_pinned ? 'text-[#D96B27]' : 'text-[#71717A] hover:text-[#18181B]'
            }`}
            title={session.is_pinned ? '取消置顶' : '置顶此会话'}
          >
            <Pin className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="p-1 rounded text-[#71717A] hover:text-[#18181B] hover:bg-black/[0.05] transition-colors cursor-pointer"
            title="重命名会话"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded text-[#71717A] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors cursor-pointer"
            title="删除会话"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Metadata Row: Model + Message Count + Time */}
      <div className="flex items-center justify-between text-[10px] text-[#71717A] pl-5 pr-1 font-mono">
        <span className="truncate max-w-[120px]">
          {session.model_id || 'deepseek'} · {session.messages?.length || 0} 轮
        </span>
        <span>{formatTimestamp(session.updated_at)}</span>
      </div>

      {/* Tags Row */}
      {session.tags && session.tags.length > 0 && (
        <div className="flex items-center gap-1 pl-5 overflow-x-auto pt-0.5">
          {session.tags.map((tag) => (
            <span
              key={tag}
              className="text-[9px] font-medium px-1.5 py-0.2 rounded-md bg-black/[0.03] text-[#71717A] border border-black/[0.06] flex items-center gap-1"
            >
              <span>#{tag}</span>
              {isTagEditing && (
                <button
                  onClick={(e) => handleRemoveTag(tag, e)}
                  className="hover:text-red-600 rounded-full"
                  title="删除标签"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
