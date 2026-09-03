import React, { useState } from 'react'
import { ChevronDown, ChevronRight, BrainCircuit } from 'lucide-react'

interface ThinkingBlockProps {
  thinking: string
  isStreaming?: boolean
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ thinking, isStreaming }) => {
  const [isExpanded, setIsExpanded] = useState(isStreaming ?? false)

  if (!thinking && !isStreaming) return null

  return (
    <div className="mb-2.5 rounded-lg border border-[#E8DFD7] bg-[#F7F3EE] overflow-hidden text-xs">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 bg-[#F2ECE5] hover:bg-[#EBE3DA] transition-colors text-[#7A726B] select-none"
      >
        <div className="flex items-center gap-1.5">
          <BrainCircuit size={13} className={isStreaming ? 'text-[#D96B27] animate-pulse' : 'text-[#7A726B]'} />
          <span className="font-medium text-[11px]">
            {isStreaming ? '正在深度思考...' : '深度思维链过程 (Thinking Process)'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px]">
          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </div>
      </button>

      {isExpanded && (
        <div className="p-3 text-[#6E665E] font-mono text-[11px] leading-relaxed whitespace-pre-wrap border-t border-[#E8DFD7] max-h-64 overflow-y-auto bg-white/40">
          {thinking || '思考中...'}
          {isStreaming && <span className="inline-block w-1.5 h-3 ml-1 bg-[#D96B27] animate-pulse" />}
        </div>
      )}
    </div>
  )
}
