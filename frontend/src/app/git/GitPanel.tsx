import React from 'react'
import { Plus, RotateCcw, Check, Sparkles, GitBranch } from 'lucide-react'

export const GitPanel: React.FC = () => {
  return (
    <div className="w-72 bg-[#F4EFEA] border-r border-[#EADFD7] flex flex-col h-full select-none shrink-0">
      {/* 顶栏与分支 */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#EADFD7]">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2C2825]">
          <GitBranch size={14} className="text-[#D96B27]" />
          <span>main</span>
        </div>
        <span className="text-[11px] text-[#7A726B] bg-[#EAE2DA] px-1.5 py-0.5 rounded">2 files</span>
      </div>

      {/* 提交说明输入区 */}
      <div className="p-3 border-b border-[#EADFD7] flex flex-col gap-2 bg-white/40">
        <textarea
          placeholder="提交说明 (按 Ctrl+Enter 提交)"
          rows={2}
          className="w-full text-xs p-2 rounded border border-[#EADFD7] bg-white resize-none focus:outline-none focus:border-[#D96B27]"
        />
        <div className="flex items-center gap-1.5">
          <button
            title="通过 AI 语义化总结暂存区变更"
            className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium text-[#D96B27] bg-[#FAF2EC] hover:bg-[#F4E3D7] border border-[#F0D5C3] py-1 rounded transition-colors"
          >
            <Sparkles size={12} />
            <span>AI 提炼说明</span>
          </button>
          <button
            title="提交暂存的修改"
            className="flex items-center justify-center gap-1 text-[11px] font-medium text-white bg-[#D96B27] hover:bg-[#BF5B1D] px-3 py-1 rounded transition-colors"
          >
            <Check size={12} />
            <span>提交</span>
          </button>
        </div>
      </div>

      {/* 双层暂存列表 */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-3 text-xs">
        {/* 已暂存区域 */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-[#7A726B] uppercase font-semibold px-1 mb-1">
            <span>已暂存的更改 (Staged)</span>
            <span className="bg-[#EADFD7] text-[#2C2825] px-1 rounded text-[10px]">1</span>
          </div>
          <div className="flex items-center justify-between p-1.5 rounded hover:bg-[#EAE2DA] text-[#2C2825] group">
            <span className="truncate font-mono">backend/go.mod</span>
            <button title="取消暂存" className="text-[#7A726B] hover:text-[#D96B27]">
              <RotateCcw size={12} />
            </button>
          </div>
        </div>

        {/* 工作区更改区域 */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-[#7A726B] uppercase font-semibold px-1 mb-1">
            <span>更改 (Changes)</span>
            <span className="bg-[#EADFD7] text-[#2C2825] px-1 rounded text-[10px]">1</span>
          </div>
          <div className="flex items-center justify-between p-1.5 rounded hover:bg-[#EAE2DA] text-[#2C2825] group">
            <span className="truncate font-mono">frontend/src/App.tsx</span>
            <button title="暂存此文件" className="text-[#7A726B] hover:text-[#D96B27]">
              <Plus size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
