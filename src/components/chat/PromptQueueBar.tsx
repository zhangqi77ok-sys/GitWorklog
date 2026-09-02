import React, { useState } from 'react';
import {
  ListOrdered,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  Zap,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { ExecutionMode } from '../../types';

export interface QueuedPrompt {
  id: string;
  text: string;
  createdAt: number;
  modelId?: string;
  executionMode?: ExecutionMode;
  budgetTokens?: number;
}

interface PromptQueueBarProps {
  queue: QueuedPrompt[];
  onDelete: (id: string) => void;
  onEdit: (id: string, newText: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onPreemptSend: (id: string) => void;
  onClearAll: () => void;
  isStreaming: boolean;
}

export const PromptQueueBar: React.FC<PromptQueueBarProps> = ({
  queue,
  onDelete,
  onEdit,
  onMoveUp,
  onMoveDown,
  onPreemptSend,
  onClearAll,
  isStreaming,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  if (queue.length === 0) return null;

  const startEditing = (item: QueuedPrompt) => {
    setEditingId(item.id);
    setEditText(item.text);
  };

  const saveEditing = (id: string) => {
    if (editText.trim()) {
      onEdit(id, editText.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="mb-2 bg-[#F4EFEA] border border-[#E6DFD5] rounded-xl overflow-hidden shadow-xs text-xs animate-in fade-in slide-in-from-bottom-1 duration-150">
      {/* Queue Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#EAE4DC]/70 border-b border-[#E6DFD5]">
        <div className="flex items-center gap-2">
          <ListOrdered className="w-3.5 h-3.5 text-[#D96B27]" />
          <span className="font-semibold text-[#1E1C1A] text-xs">
            待发送消息队列
          </span>
          <span className="px-1.5 py-0.2 bg-[#D96B27] text-white rounded-full text-[10px] font-bold">
            {queue.length}
          </span>
          <span className="text-[10px] text-[#8A847C] hidden sm:inline">
            {isStreaming ? '（当前生成完成后自动顺次发送）' : '（将在生成完成后依次排队执行）'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onClearAll}
            title="清空全部待发送队列"
            className="text-[10px] text-[#8A847C] hover:text-[#C62828] px-1.5 py-0.5 rounded hover:bg-white/60 transition-colors cursor-pointer"
          >
            清空队列
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? '收起队列' : '展开队列'}
            className="p-1 text-[#8A847C] hover:text-[#1E1C1A] rounded hover:bg-white/60 transition-colors cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Queue Item List */}
      {isExpanded && (
        <div className="p-1.5 space-y-1 max-h-48 overflow-y-auto">
          {queue.map((item, index) => {
            const isEditing = editingId === item.id;

            return (
              <div
                key={item.id}
                className="group flex items-center justify-between p-2 bg-white rounded-lg border border-[#E6DFD5] hover:border-[#D96B27]/50 transition-all gap-2"
              >
                {/* Left: Queue Index & Content */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="flex-shrink-0 w-5 h-5 rounded-md bg-[#FAF8F5] border border-[#E6DFD5] font-mono font-bold text-[10px] text-[#D96B27] flex items-center justify-center">
                    #{index + 1}
                  </span>

                  {isEditing ? (
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditing(item.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        className="flex-1 px-2 py-0.5 text-xs bg-[#FAF8F5] border border-[#D96B27] rounded outline-none text-[#1E1C1A]"
                      />
                      <button
                        type="button"
                        onClick={() => saveEditing(item.id)}
                        className="p-1 text-green-600 hover:bg-green-50 rounded cursor-pointer"
                        title="保存修改 (Enter)"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-1 text-[#8A847C] hover:bg-gray-100 rounded cursor-pointer"
                        title="取消修改 (Esc)"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => startEditing(item)}
                      title="点击可直接编辑修改内容"
                      className="text-xs text-[#3D3A36] truncate flex-1 cursor-text hover:text-[#1E1C1A]"
                    >
                      {item.text}
                    </div>
                  )}
                </div>

                {/* Right: Actions (Sort Up/Down, Edit, Delete, Preempt Send) */}
                {!isEditing && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Move Up */}
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => onMoveUp(index)}
                      title="向上移动队列优先级"
                      className="p-1 text-[#8A847C] hover:text-[#1E1C1A] disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>

                    {/* Move Down */}
                    <button
                      type="button"
                      disabled={index === queue.length - 1}
                      onClick={() => onMoveDown(index)}
                      title="向下移动队列优先级"
                      className="p-1 text-[#8A847C] hover:text-[#1E1C1A] disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => startEditing(item)}
                      title="编辑修改内容"
                      className="p-1 text-[#8A847C] hover:text-[#D96B27] rounded hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      title="从队列中移除"
                      className="p-1 text-[#8A847C] hover:text-[#C62828] rounded hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>

                    {/* Preempt & Send Now (Directly interrupt current stream) */}
                    <button
                      type="button"
                      onClick={() => onPreemptSend(item.id)}
                      title="立即插队发送（直接中断目前正在运行的对话并立即发送此条）"
                      className="flex items-center gap-1 px-2 py-0.5 bg-[#FAF8F5] hover:bg-[#D96B27] text-[#D96B27] hover:text-white border border-[#D96B27]/40 hover:border-[#D96B27] rounded text-[10px] font-bold transition-all shadow-2xs cursor-pointer ml-1"
                    >
                      <Zap className="w-2.5 h-2.5" />
                      <span>立即插队</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};