import React, { useState, useRef } from 'react';
import { ChevronDown, ChevronRight, BrainCircuit, Maximize2 } from 'lucide-react';

interface ThinkingBlockProps {
  thinking: string;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ thinking }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [height, setHeight] = useState(200);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(200);

  if (!thinking) return null;

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startYRef.current = e.clientY;
    startHeightRef.current = height;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startYRef.current;
      const newH = Math.max(80, Math.min(600, startHeightRef.current + deltaY));
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
    <div className="my-2 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] overflow-hidden text-xs select-none shadow-2xs">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 p-2 px-3 bg-[#F4EFEA] border-b border-[#E6DFD5] cursor-pointer hover:bg-[#EAE4DC] transition-colors"
      >
        <BrainCircuit className="w-3.5 h-3.5 text-[#D96B27]" />
        <span className="font-semibold text-[#1E1C1A] flex-1 text-[11px]">深度思考推理过程</span>
        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-[#8A847C]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#8A847C]" />}
      </div>

      {isExpanded && (
        <>
          <div
            style={{ maxHeight: `${height}px` }}
            className="p-3 text-[#6B665F] leading-relaxed whitespace-pre-wrap font-mono text-[11px] overflow-y-auto select-text transition-[max-height] duration-75"
          >
            {thinking}
          </div>

          <div
            onMouseDown={handleResizeStart}
            className={`h-2 w-full cursor-row-resize flex items-center justify-center border-t border-[#E6DFD5] transition-colors ${
              isDragging ? 'bg-[#D96B27]' : 'bg-[#F4EFEA] hover:bg-[#D96B27]/40'
            }`}
            title="上下拖动调整思考推理区域高度"
          >
            <div className="w-8 h-0.5 bg-[#8A847C]/50 rounded-full" />
          </div>
        </>
      )}
    </div>
  );
};
