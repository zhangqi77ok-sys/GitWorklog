import React from 'react'
import { X, GitCompare, Code2, Save } from 'lucide-react'
import { useEditorStore } from '../../core/store/editorStore'

export const TabBar: React.FC = () => {
  const { openTabs, activeFile, isDiffMode, setActiveFile, closeTab, toggleDiffMode, saveActiveFile } = useEditorStore()

  if (openTabs.length === 0) {
    return null
  }

  return (
    <div className="h-9 bg-[#EAE2DA] border-b border-[#EADFD7] flex items-center justify-between px-2 select-none shrink-0 overflow-x-auto">
      {/* 左侧 Tab 队列 */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {openTabs.map((path) => {
          const isActive = path === activeFile
          const filename = path.split('/').pop() || path

          return (
            <div
              key={path}
              onClick={() => setActiveFile(path)}
              className={`h-7 px-2.5 flex items-center gap-2 rounded-t-md text-xs cursor-pointer transition-all ${
                isActive
                  ? 'bg-[#FAF8F5] text-[#2C2825] font-semibold border-t-2 border-[#D96B27]'
                  : 'bg-[#E4DCD3] text-[#7A726B] hover:bg-[#DDD4CA] hover:text-[#2C2825]'
              }`}
            >
              <span className="font-mono text-[11px] truncate max-w-[140px]">{filename}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(path)
                }}
                title="关闭此标签"
                className="text-[#7A726B] hover:text-[#E04B4B] p-0.5 rounded hover:bg-black/5"
              >
                <X size={11} />
              </button>
            </div>
          )
        })}
      </div>

      {/* 右侧动作按钮 */}
      <div className="flex items-center gap-1.5 shrink-0 pl-2">
        <button
          onClick={() => saveActiveFile()}
          title="保存文件 (Ctrl+S)"
          className="flex items-center gap-1 text-[11px] font-medium text-[#2C2825] hover:text-[#D96B27] bg-[#FAF8F5] px-2 py-0.5 rounded border border-[#EADFD7] shadow-2xs hover:bg-[#FAF2EC] transition-colors"
        >
          <Save size={12} />
          <span>保存</span>
        </button>

        <button
          onClick={() => toggleDiffMode()}
          title={isDiffMode ? '切回单栏代码编辑' : '切入双栏红绿 Diff 对比审查'}
          className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded border transition-colors ${
            isDiffMode
              ? 'bg-[#D96B27] text-white border-[#BF5B1D]'
              : 'bg-[#FAF8F5] text-[#D96B27] border-[#F0D5C3] hover:bg-[#FAF2EC]'
          }`}
        >
          {isDiffMode ? <Code2 size={12} /> : <GitCompare size={12} />}
          <span>{isDiffMode ? '代码模式' : 'Diff 审查'}</span>
        </button>
      </div>
    </div>
  )
}
