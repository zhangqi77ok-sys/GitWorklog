import React, { useState } from 'react';
import { Wrench, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';

export interface ToolCallItem {
  name: string;
  args: Record<string, any>;
  result?: string;
}

interface ToolCallCardProps {
  toolCalls: ToolCallItem[];
}

export const ToolCallCard: React.FC<ToolCallCardProps> = ({ toolCalls }) => {
  const [expandedIndices, setExpandedIndices] = useState<Record<number, boolean>>({});

  if (!toolCalls || toolCalls.length === 0) return null;

  const toggleExpand = (idx: number) => {
    setExpandedIndices((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="flex flex-col gap-1.5 my-1.5 max-w-[85%] w-full">
      {toolCalls.map((tool, idx) => {
        const isExpanded = Boolean(expandedIndices[idx]);
        return (
          <div
            key={idx}
            className="border border-[#E6DFD5] bg-[#FAF8F5] rounded-xl overflow-hidden text-xs shadow-2xs transition-all"
          >
            <button
              onClick={() => toggleExpand(idx)}
              className="flex items-center justify-between w-full px-3 py-2 bg-[#F4EFEA] hover:bg-[#EAE4DC] text-[#3D3A36] text-[11px] font-mono cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-[#D96B27]/10 flex items-center justify-center text-[#D96B27]">
                  <Wrench className="w-3 h-3" />
                </div>
                <span className="font-bold text-[#1E1C1A]">调用 1 个工具</span>
                <span className="text-[10px] text-[#8A847C] font-mono bg-white px-1.5 py-0.5 rounded border border-[#E6DFD5]">
                  {tool.name}
                </span>
                <CheckCircle2 className="w-3 h-3 text-[#2E7D32]" />
              </div>
              <div className="flex items-center gap-1 text-[#8A847C]">
                <span className="text-[10px]">{isExpanded ? '折叠' : '展开查看详情'}</span>
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </div>
            </button>

            {isExpanded && (
              <div className="p-3 space-y-2.5 bg-white text-[11px] font-mono border-t border-[#E6DFD5] select-text">
                <div>
                  <span className="text-[#8A847C] font-bold text-[10px] block mb-1">输入参数 (Arguments):</span>
                  <pre className="p-2 bg-[#FAF8F5] rounded-lg border border-[#E6DFD5] text-[10px] text-[#1E1C1A] whitespace-pre-wrap overflow-auto">
                    {JSON.stringify(tool.args, null, 2)}
                  </pre>
                </div>
                {tool.result && (
                  <div>
                    <span className="text-[#2E7D32] font-bold text-[10px] block mb-1">执行输出 (Output):</span>
                    <pre className="p-2 bg-[#F4EFEA]/80 rounded-lg border border-[#E6DFD5] text-[10px] text-[#3D3A36] whitespace-pre-wrap max-h-48 overflow-auto leading-relaxed">
                      {tool.result}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
