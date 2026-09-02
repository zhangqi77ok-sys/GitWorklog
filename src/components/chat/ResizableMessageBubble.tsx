import React, { useState, useRef } from 'react';
import { Copy, Check, SplitSquareVertical, Maximize2, Minimize2 } from 'lucide-react';
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
      className={`relative max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed select-text transition-all duration-75 ${
        role === 'user'
          ? 'bg-[#D96B27] text-white rounded-tr-xs shadow-xs'
          : 'bg-white border border-[#E6DFD5] text-[#1E1C1A] rounded-tl-xs shadow-xs'
      }`}
    >
      {/* 1-Click Action Buttons on Bubble Top Right */}
      <div className="absolute top-2.5 right-2.5 opacity-0 group-hover/msg:opacity-100 transition-opacity select-none flex items-center gap-1 z-10">
        {isLongMessage && (
          <button
            type="button"
            onClick={toggleFullExpand}
            title={isExpandedFull ? '限制气泡高度' : '展开气泡全文'}
            className="p-1 rounded-md bg-[#FAF8F5] text-[#8A847C] hover:text-[#1E1C1A] hover:bg-white border border-[#E6DFD5] transition-all shadow-2xs cursor-pointer"
          >
            {isExpandedFull ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        )}
        <button
          type="button"
          onClick={onCopy}
          title="复制对话内容"
          className={`p-1 rounded-md transition-all shadow-2xs cursor-pointer ${
            role === 'user'
              ? 'bg-[#B8551B] text-white hover:bg-[#9E4514]'
              : 'bg-[#FAF8F5] text-[#8A847C] hover:text-[#1E1C1A] hover:bg-white border border-[#E6DFD5]'
          }`}
        >
          {isCopied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>

      {/* Content Container (Auto or Clamped with scroll) */}
      {role === 'user' ? (
        <div className="whitespace-pre-wrap select-text pr-6">{cleanText}</div>
      ) : (
        <div
          ref={contentRef}
          style={{
            maxHeight: isExpandedFull ? 'none' : `${bubbleHeight}px`,
          }}
          className={`select-text pr-6 ${
            isExpandedFull ? 'overflow-visible' : 'overflow-y-auto scrollbar-thin'
          }`}
        >
          <MarkdownRenderer content={cleanText} />
        </div>
      )}

      {/* Diff Viewer Button for Agent Code Patches */}
      {isAssistant && rawContent.includes('```') && onOpenDiff && (
        <div className="mt-3 pt-2.5 border-t border-[#E6DFD5] flex items-center justify-between select-none">
          <span className="text-[10px] text-[#8A847C] font-mono">
            包含代码补丁变更
          </span>
          <button
            type="button"
            onClick={onOpenDiff}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#FAF8F5] border border-[#E6DFD5] hover:border-[#D96B27] text-[#D96B27] rounded-lg text-[11px] font-bold transition-all shadow-2xs cursor-pointer"
          >
            <SplitSquareVertical className="w-3 h-3" />
            <span>在编辑器中审查 Diff</span>
          </button>
        </div>
      )}

      {/* Bottom Draggable Height Resize Handle for Long Message Bubbles */}
      {isLongMessage && (
        <div
          onMouseDown={handleResizeStart}
          className={`-mx-3.5 -mb-3.5 mt-2.5 h-3 cursor-row-resize flex items-center justify-center border-t border-[#E6DFD5]/60 rounded-b-2xl transition-colors select-none group/resize ${
            isDragging ? 'bg-[#D96B27]' : 'bg-[#FAF8F5] hover:bg-[#D96B27]/20'
          }`}
          title="上下拖拽调整当前对话气泡高度 (双击可一键全展/收起)"
          onDoubleClick={toggleFullExpand}
        >
          <div className="w-10 h-1 bg-[#8A847C]/40 group-hover/resize:bg-[#D96B27] rounded-full transition-colors" />
        </div>
      )}
    </div>
  );
};
