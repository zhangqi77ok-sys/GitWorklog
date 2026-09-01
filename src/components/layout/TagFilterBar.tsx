import React from 'react';

interface TagFilterBarProps {
  tags: string[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  tagCounts?: Record<string, number>;
}

export const TagFilterBar: React.FC<TagFilterBarProps> = ({
  tags,
  selectedTag,
  onSelectTag,
  tagCounts = {},
}) => {
  if (tags.length === 0) return null;

  const getTagColorClass = (tag: string, isSelected: boolean) => {
    if (isSelected) {
      return 'bg-[#D96B27] text-white shadow-xs';
    }
    const lower = tag.toLowerCase();
    if (lower.includes('refactor') || lower.includes('重构')) {
      return 'bg-[#FBE9E7] text-[#D84315] hover:bg-[#FFCCBC] border border-[#FFAB91]';
    }
    if (lower.includes('bug') || lower.includes('修复')) {
      return 'bg-[#E3F2FD] text-[#1565C0] hover:bg-[#BBDEFB] border border-[#90CAF9]';
    }
    if (lower.includes('test') || lower.includes('单测')) {
      return 'bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#C8E6C9] border border-[#A5D6A7]';
    }
    return 'bg-[#F4EFEA] text-[#6B665F] hover:bg-[#EAE4DC] border border-[#E6DFD5]';
  };

  return (
    <div className="flex flex-wrap gap-1 items-center max-h-12 overflow-y-auto no-scrollbar py-0.5">
      <button
        onClick={() => onSelectTag(null)}
        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
          selectedTag === null
            ? 'bg-[#D96B27] text-white shadow-xs'
            : 'bg-[#F4EFEA] text-[#6B665F] hover:bg-[#EAE4DC] border border-[#E6DFD5]'
        }`}
      >
        全部 {tagCounts['all'] !== undefined ? `(${tagCounts['all']})` : ''}
      </button>

      {tags.map((tag) => {
        const isSelected = selectedTag === tag;
        const count = tagCounts[tag];
        return (
          <button
            key={tag}
            onClick={() => onSelectTag(isSelected ? null : tag)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${getTagColorClass(
              tag,
              isSelected
            )}`}
          >
            #{tag} {count !== undefined ? `(${count})` : ''}
          </button>
        );
      })}
    </div>
  );
};
