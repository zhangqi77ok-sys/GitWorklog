import React, { useState, useRef } from 'react';
import { Copy, Check, SplitSquareVertical, Maximize2, Minimize2, GripHorizontal } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ResizableMessageBubbleProps {
  msgId: string;
  role: 'user' | 'assistant' | 'system';
  cleanText: string;
  rawContent: string;
  onCopy: () => void;
  isCopied: boolean;
  onOpenDiff?: () => void;
}

export const ResizableMessageBubble: React.FC<ResizableMessageBubbleProps> = ({
  role,
  cleanText,
  rawContent,
  onCopy,
  isCopied,
  onOpenDiff,
}) => {
  const isAssistant = role === 'assistant';
  const lineCount = cleanText.split('\n').length;
  const isLongMessage = isAssistant && (lineCount > 12 || cleanText.length > 400);

  // Height state per message
  const [bubbleHeight, setBubbleHeight] = useState<number>(360);
  const [isExpandedFull, setIsExpandedFull] = useState(!isLongMessage);
  const [isDragging, setIsDragging] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startHeightRef = useRef(360);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startYRef.current = e.clientY;
    startHeightRef.current = bubbleHeight || 360;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startYRef.current;
      const newHeight = Math.max(120, Math.min(1200, startHeightRef.current + deltaY));
      setBubbleHeight(newHeight);
      setIsExpandedFull(false);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const toggleFullExpand = () => {
    setIsExpandedFull(!isExpandedFull);
  };

  return (
    <div
      className={`relative w-full text-xs leading-relaxed select-text transition-all duration-150 ${
        role === 'user'
          ? 'bg-[#F6EFEA] border border-[#EAE0D5] text-[#241E1A] rounded-2xl rounded-tr-xs p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]'
          : 'bg-white border border-[#E8E2D8] text-[#1E1C1A] rounded-2xl rounded-tl-xs p-4 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)]'
      }`}
    >
      {/* 1-Click Action Buttons on Bubble Top Right */}
      <div className="absolute top-3 right-3 opacity-0 group-hover/msg:opacity-100 transition-opacity select-none flex items-center gap-1.5 z-10">
        {isLongMessage && (
          <button
            type="button"
            onClick={toggleFullExpand}
            title={isExpandedFull ? '限制气泡高度' : '展开气泡全文'}
            className="p-1 rounded-md bg-white/90 hover:bg-white text-[#8A847C] hover:text-[#1E1C1A] border border-[#E6DFD5] transition-all shadow-2xs cursor-pointer"
          >
            {isExpandedFull ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        )}
        <button
          type="button"
          onClick={onCopy}
          title="复制对话内容"
          className="p-1 rounded-md bg-white/90 hover:bg-white text-[#8A847C] hover:text-[#1E1C1A] border border-[#E6DFD5] transition-all shadow-2xs cursor-pointer"
        >
          {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>

      {/* Content Container (Auto or Clamped with scroll) */}
      {role === 'user' ? (
        <div className="whitespace-pre-wrap select-text pr-6 font-normal text-[13px] leading-relaxed text-[#2C2420]">
          {cleanText}
        </div>
      ) : (
        <div
          ref={contentRef}
          style={{
            maxHeight: isExpandedFull ? 'none' : `${bubbleHeight}px`,
          }}
          className={`select-text pr-4 ${
            isExpandedFull ? 'overflow-visible' : 'overflow-y-auto scrollbar-thin'
          }`}
        >
          <MarkdownRenderer content={cleanText} />
        </div>
      )}

      {/* Diff Viewer Button for Agent Code Patches */}
      {isAssistant && rawContent.includes('```') && onOpenDiff && (
        <div className="mt-3.5 pt-2.5 border-t border-[#F0ECE4] flex items-center justify-between select-none">
          <div className="flex items-center gap-1.5 text-[11px] text-[#8A847C]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D96B27]" />
            <span>包含代码补丁变更</span>
          </div>
          <button
            type="button"
            onClick={onOpenDiff}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#FAF8F5] hover:bg-[#F4EFEA] border border-[#E6DFD5] hover:border-[#D96B27]/50 text-[#D96B27] rounded-lg text-xs font-semibold transition-all shadow-2xs cursor-pointer"
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
            <span>在右侧编辑器中审查 Diff</span>
          </button>
        </div>
      )}

      {/* Bottom Draggable Height Resize Handle for Long Message Bubbles */}
      {isLongMessage && (
        <div
          onMouseDown={handleResizeStart}
          className={`-mx-4 -mb-4 mt-3 h-3.5 cursor-row-resize flex items-center justify-center border-t border-[#F0ECE4] rounded-b-2xl transition-colors select-none group/resize ${
            isDragging ? 'bg-[#D96B27]/15' : 'bg-transparent hover:bg-[#FAF8F5]'
          }`}
          title="上下拖拽调整当前对话气泡高度 (双击可一键全展/收起)"
          onDoubleClick={toggleFullExpand}
        >
          <div className="w-8 h-1 bg-[#8A847C]/30 group-hover/resize:bg-[#D96B27] rounded-full transition-colors flex items-center justify-center" />
        </div>
      )}
    </div>
  );
};
