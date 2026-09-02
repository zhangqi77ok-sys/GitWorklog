import React, { useState, useRef } from 'react';
import { ChevronDown, ChevronRight, BrainCircuit } from 'lucide-react';

interface ThinkingBlockProps {
  thinking: string;
  defaultExpanded?: boolean;
  className?: string;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  thinking,
  defaultExpanded = false,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [height, setHeight] = useState(160);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(160);

  if (!thinking) return null;

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    startYRef.current = e.clientY;
    startHeightRef.current = height;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startYRef.current;
      const newH = Math.max(60, Math.min(600, startHeightRef.current + deltaY));
      setHeight(newH);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className={`w-full rounded-xl border border-black/[0.08] bg-black/[0.02] overflow-hidden text-xs select-none transition-all duration-150 ${className}`}>
      {/* Compact Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center justify-between px-3 py-1.5 cursor-pointer hover:bg-black/[0.03] transition-colors ${
          isExpanded ? 'border-b border-black/[0.06]' : ''
        }`}
        title={isExpanded ? '点击折叠思考过程' : '点击展开查看深度思考推理过程'}
      >
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <BrainCircuit className="w-3.5 h-3.5 text-[#D96B27]" />
          <span className="font-medium text-[#18181B]">思考与推理过程</span>
          <span className="text-[10px] text-[#71717A] bg-white/80 px-1.5 py-0.2 rounded border border-black/[0.06]">
            {isExpanded ? '已展开' : '点击展开'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[#71717A]">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#18181B]" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </div>
      </div>

      {/* Expanded Thinking Content with Draggable Resize Handle */}
      {isExpanded && (
        <>
          <div
            style={{ maxHeight: `${height}px`, height: `${height}px` }}
            className="p-3 text-[#52525B] leading-relaxed whitespace-pre-wrap font-mono text-[11px] overflow-y-auto select-text scrollbar-thin bg-white/40 transition-[height] duration-75"
          >
            {thinking}
          </div>

          {/* Bottom Draggable Resize Handle */}
          <div
            onMouseDown={handleResizeStart}
            onDoubleClick={() => setIsExpanded(false)}
            className={`h-1.5 w-full cursor-row-resize flex items-center justify-center border-t border-black/[0.06] transition-colors select-none group/thdrag ${
              isDragging ? 'bg-[#D96B27]/20' : 'bg-transparent hover:bg-black/[0.04]'
            }`}
            title="上下拖动调整思考区域高度 (双击快速收起)"
          >
            <div className="w-8 h-0.5 bg-[#71717A]/30 group-hover/thdrag:bg-[#D96B27] rounded-full transition-colors" />
          </div>
        </>
      )}
    </div>
  );
};
