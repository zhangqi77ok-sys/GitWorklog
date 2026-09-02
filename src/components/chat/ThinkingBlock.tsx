import React, { useState, useRef } from 'react';
import { ChevronDown, ChevronRight, BrainCircuit, Maximize2, Minimize2 } from 'lucide-react';

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
  const [height, setHeight] = useState(150);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(150);

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
    <div className={`w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] overflow-hidden text-xs select-none shadow-2xs transition-all duration-75 ${className}`}>
      {/* Compact Header Bar (Single small line) */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center justify-between px-3 py-1.5 bg-[#F4EFEA] cursor-pointer hover:bg-[#EAE4DC] transition-colors ${
          isExpanded ? 'border-b border-[#E6DFD5]' : ''
        }`}
        title={isExpanded ? '点击折叠思考过程' : '点击展开查看深度思考推理过程'}
      >
        <div className="flex items-center gap-1.5 text-[#6B665F] font-mono text-[11px]">
          <BrainCircuit className="w-3.5 h-3.5 text-[#D96B27]" />
          <span className="font-semibold text-[#1E1C1A]">深度思考推理过程</span>
          <span className="text-[10px] text-[#8A847C]">
            ({isExpanded ? '已展开' : '点击展开'})
          </span>
        </div>
        <div className="flex items-center gap-1 text-[#8A847C]">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#D96B27]" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 hover:text-[#D96B27]" />
          )}
        </div>
      </div>

      {/* Expanded Thinking Content with Draggable Resize Handle */}
      {isExpanded && (
        <>
          <div
            style={{ maxHeight: `${height}px`, height: `${height}px` }}
            className="p-3 text-[#6B665F] leading-relaxed whitespace-pre-wrap font-mono text-[11px] overflow-y-auto select-text scrollbar-thin bg-[#FAF8F5] transition-[height] duration-75"
          >
            {thinking}
          </div>

          {/* Bottom Draggable Resize Handle */}
          <div
            onMouseDown={handleResizeStart}
            onDoubleClick={() => setIsExpanded(false)}
            className={`h-2.5 w-full cursor-row-resize flex items-center justify-center border-t border-[#E6DFD5] transition-colors select-none group/thdrag ${
              isDragging ? 'bg-[#D96B27]' : 'bg-[#F4EFEA] hover:bg-[#D96B27]/30'
            }`}
            title="上下拖动调整思考区域高度 (双击可快速折叠)"
          >
            <div className="w-8 h-0.5 bg-[#8A847C]/50 group-hover/thdrag:bg-[#D96B27] rounded-full transition-colors" />
          </div>
        </>
      )}
    </div>
  );
};
