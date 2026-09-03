import React, { useState } from 'react'
import { ChevronRight, ChevronDown, Check, AlertCircle, Wrench, FileCode, GitBranch } from 'lucide-react'

export interface ToolCallItem {
  id: string
  name: string
  args: any
  output?: string
  status: 'running' | 'success' | 'error'
}

interface ToolCardProps {
  tool: ToolCallItem
}

export const ToolCard: React.FC<ToolCardProps> = ({ tool }) => {
  const [expanded, setExpanded] = useState(false)

  // 语义化匹配图标与简述
  const getToolMeta = () => {
    if (tool.name.includes('fs')) {
      const action = tool.args?.action || 'op'
      const path = tool.args?.path || ''
      return {
        icon: <FileCode size={13} className="text-[#D96B27]" />,
        label: `文件沙箱: ${action} ${path}`,
      }
    }
    if (tool.name.includes('git')) {
      return {
        icon: <GitBranch size={13} className="text-[#D96B27]" />,
        label: 'Git 控制中枢: 状态/暂存',
      }
    }
    return {
      icon: <Wrench size={13} className="text-[#D96B27]" />,
      label: `工具调度: ${tool.name}`,
    }
  }

  const meta = getToolMeta()

  return (
    <div className="my-1.5 rounded-lg border border-[#EADFD7] bg-[#F4EFEA] overflow-hidden text-xs transition-all select-none">
      {/* 紧凑标题栏 */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between px-3 py-1.5 cursor-pointer hover:bg-[#EAE2DA] transition-colors"
      >
        <div className="flex items-center gap-2 truncate">
          {meta.icon}
          <span className="font-mono font-medium text-[#2C2825] truncate">{meta.label}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {tool.status === 'running' && (
            <span className="flex items-center gap-1 text-[11px] text-[#D96B27]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D96B27] animate-pulse" />
              <span>执行中</span>
            </span>
          )}
          {tool.status === 'success' && (
            <span className="flex items-center gap-1 text-[11px] text-[#52D17C]">
              <Check size={12} />
              <span>成功</span>
            </span>
          )}
          {tool.status === 'error' && (
            <span className="flex items-center gap-1 text-[11px] text-[#E04B4B]">
              <AlertCircle size={12} />
              <span>失败</span>
            </span>
          )}
          <button className="text-[#7A726B] hover:text-[#2C2825] p-0.5">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      </div>

      {/* 抽屉式入参与结果展开区 */}
      {expanded && (
        <div className="border-t border-[#EADFD7] p-2.5 bg-white/70 flex flex-col gap-2 font-mono text-[11px]">
          {/* 入参 */}
          <div>
            <div className="text-[10px] uppercase font-semibold text-[#7A726B] mb-1">Parameters (入参)</div>
            <pre className="p-2 rounded bg-[#1E1C1A] text-[#FAF8F5] overflow-x-auto max-h-32 text-[10px] leading-relaxed">
              {typeof tool.args === 'string' ? tool.args : JSON.stringify(tool.args, null, 2)}
            </pre>
          </div>

          {/* 输出 */}
          {tool.output && (
            <div>
              <div className="text-[10px] uppercase font-semibold text-[#7A726B] mb-1">Output (执行输出)</div>
              <pre className="p-2 rounded bg-[#FAF8F5] border border-[#EADFD7] text-[#2C2825] overflow-x-auto max-h-48 text-[10px] leading-relaxed whitespace-pre-wrap">
                {tool.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
