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

const MIN_HEIGHT = 120;
const DEFAULT_HEIGHT = 400;
const MAX_HEIGHT = 1400;
const LONG_THRESHOLD_LINES = 14;
const LONG_THRESHOLD_CHARS = 500;

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
  const isLongMessage = isAssistant && (lineCount > LONG_THRESHOLD_LINES || cleanText.length > LONG_THRESHOLD_CHARS);

  const [bubbleHeight, setBubbleHeight] = useState<number>(DEFAULT_HEIGHT);
  const [isExpandedFull, setIsExpandedFull] = useState(!isLongMessage);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(DEFAULT_HEIGHT);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startYRef.current = e.clientY;
    startHeightRef.current = bubbleHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientY - startYRef.current;
      const newH = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeightRef.current + delta));
      setBubbleHeight(newH);
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

  const toggleFullExpand = () => setIsExpandedFull((v) => !v);

  // ── User bubble: compact right-aligned pill, no border, warm tint ──────────
  if (role === 'user') {
    return (
      <div className="relative group/bubble max-w-full">
        <div className="bg-[#EDE7DE] text-[#241E1A] rounded-2xl rounded-br-md px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap select-text font-normal pr-10">
          {cleanText}
        </div>
        {/* copy button appears on hover */}
        <button
          type="button"
          onClick={onCopy}
          title="复制"
          className="absolute top-2 right-2 opacity-0 group-hover/bubble:opacity-100 p-1 rounded-md text-[#8A847C] hover:text-[#1E1C1A] hover:bg-white/70 transition-all cursor-pointer"
        >
          {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
    );
  }

  // ── Assistant reply: full-width, no card border, content flows directly ─────
  return (
    <div className="relative w-full group/bubble">
      {/* Hover action row */}
      <div className="absolute -top-6 right-0 opacity-0 group-hover/bubble:opacity-100 transition-opacity flex items-center gap-1 z-10 select-none">
        {isLongMessage && (
          <button
            type="button"
            onClick={toggleFullExpand}
            title={isExpandedFull ? '限制高度' : '展开全文'}
            className="p-1 rounded-md bg-white text-[#8A847C] hover:text-[#1E1C1A] border border-[#E6DFD5] shadow-2xs transition-all cursor-pointer"
          >
            {isExpandedFull ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        )}
        <button
          type="button"
          onClick={onCopy}
          title="复制回复"
          className="p-1 rounded-md bg-white text-[#8A847C] hover:text-[#1E1C1A] border border-[#E6DFD5] shadow-2xs transition-all cursor-pointer"
        >
          {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>

      {/* Content — no card wrapper, flows directly on page background */}
      <div
        style={{ maxHeight: isExpandedFull ? 'none' : `${bubbleHeight}px` }}
        className={`select-text text-[13px] leading-[1.7] ${
          isExpandedFull ? 'overflow-visible' : 'overflow-y-auto scrollbar-thin'
        }`}
      >
        <MarkdownRenderer content={cleanText} />
      </div>

      {/* Diff button — shown when there are code patches */}
      {rawContent.includes('```') && onOpenDiff && (
        <div className="mt-4 flex items-center gap-2 select-none">
          <span className="flex items-center gap-1.5 text-[11px] text-[#8A847C]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D96B27] inline-block" />
            包含代码补丁变更
          </span>
          <button
            type="button"
            onClick={onOpenDiff}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#FAF8F5] hover:bg-[#F4EFEA] border border-[#E6DFD5] hover:border-[#D96B27]/40 text-[#D96B27] rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
          >
            <SplitSquareVertical className="w-3 h-3" />
            在右侧编辑器中审查 Diff
          </button>
        </div>
      )}

      {/* Bottom drag handle for long messages */}
      {isLongMessage && (
        <div
          onMouseDown={handleResizeStart}
          onDoubleClick={toggleFullExpand}
          className={`mt-3 h-3 w-full cursor-row-resize flex items-center justify-center rounded transition-colors select-none group/rz ${
            isDragging ? 'bg-[#D96B27]/10' : 'hover:bg-[#F4EFEA]'
          }`}
          title="拖拽调整高度，双击全展/收起"
        >
          <div className="w-10 h-0.5 bg-[#C8C0B4] group-hover/rz:bg-[#D96B27] rounded-full transition-colors" />
        </div>
      )}
    </div>
  );
};
