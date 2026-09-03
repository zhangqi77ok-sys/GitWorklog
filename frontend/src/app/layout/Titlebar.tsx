import React from 'react'
import { Split, Minus, Square, X, Settings } from 'lucide-react'
import { useWorkspaceStore } from '../../core/store/workspaceStore'
import { useSettingsStore } from '../../core/store/settingsStore'

export const Titlebar: React.FC = () => {
  const { mode, setMode, toggleTerminal } = useWorkspaceStore()
  const { openSettings, config } = useSettingsStore()

  return (
    <header className="h-[38px] min-h-[38px] bg-[#FAF8F5] border-b border-black/[0.08] flex items-center justify-between px-3 z-30 select-none">
      {/* 左侧：Logo、项目与分支、模型就绪状态 */}
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-md bg-[#18181B] text-white flex items-center justify-center font-bold text-xs shadow-xs">
          T
        </div>
        <span className="text-xs font-semibold tracking-tight text-[#18181B]">Tcode Studio</span>
        <span className="text-[#A1A1AA] text-xs">/</span>
        <span className="text-xs font-medium text-[#27272A] flex items-center gap-1.5">
          agent-learning
          <span className="text-[10px] text-[#71717A] bg-black/[0.04] px-1.5 py-0.2 rounded-full font-mono">
            main
          </span>
        </span>
        <div className="h-3 w-[1px] bg-black/[0.08] mx-1" />
        <div className="flex items-center gap-1.5 text-[11px] text-[#10A37F] font-medium bg-[#10A37F]/10 px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10A37F] animate-pulse" />
          <span>{config.defaultModel || 'DeepSeek-V4'} · 就绪</span>
        </div>
      </div>

      {/* 中间：单焦点工作区聚合切换胶囊 (Workspace View Switcher) */}
      <div className="flex items-center p-0.5 bg-black/[0.05] rounded-xl text-xs font-medium">
        <button
          onClick={() => setMode('chat')}
          title="切换至智能对话聚焦视图 (全宽沉浸)"
          className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
            mode === 'chat'
              ? 'bg-white text-[#D96B27] shadow-2xs font-semibold'
              : 'text-[#71717A] hover:text-[#18181B]'
          }`}
        >
          <span>💬</span>
          <span className="hidden sm:inline">智能对话</span>
        </button>

        <button
          onClick={() => setMode('split')}
          title="切换至双栏协同视图 (对话 + 代码Diff比对)"
          className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
            mode === 'split'
              ? 'bg-white text-[#D96B27] shadow-2xs font-semibold'
              : 'text-[#71717A] hover:text-[#18181B]'
          }`}
        >
          <Split size={14} />
          <span className="hidden sm:inline">双栏协同</span>
        </button>

        <button
          onClick={() => setMode('editor')}
          title="切换至代码工作区全屏视图 (Monaco沉浸编辑)"
          className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
            mode === 'editor'
              ? 'bg-white text-[#D96B27] shadow-2xs font-semibold'
              : 'text-[#71717A] hover:text-[#18181B]'
          }`}
        >
          <span>📝</span>
          <span className="hidden sm:inline">代码工作区</span>
        </button>
      </div>

      {/* 右侧：终端开关、设置中心、窗口控制 */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTerminal}
          title="唤起/收起集成终端抽屉 (Ctrl+`)"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-[#52525B] bg-white border border-black/[0.08] shadow-2xs hover:bg-black/[0.03] transition-all cursor-pointer"
        >
          <span className="font-mono text-xs font-bold text-[#18181B]">$_</span>
          <span className="hidden sm:inline">终端抽屉</span>
        </button>

        <button
          onClick={() => openSettings()}
          title="打开系统设置中枢 (Esc可关闭)"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-[#18181B] bg-white border border-black/[0.08] shadow-2xs hover:bg-black/[0.03] transition-all cursor-pointer"
        >
          <Settings size={14} className="text-[#D96B27]" />
          <span>模型与设置</span>
        </button>

        <div className="h-3 w-[1px] bg-black/[0.08]" />

        <div className="flex items-center gap-1">
          <button
            title="最小化窗口"
            className="w-6 h-6 rounded flex items-center justify-center text-[#71717A] hover:bg-black/[0.05] transition-all cursor-pointer"
          >
            <Minus size={13} />
          </button>
          <button
            title="最大化窗口"
            className="w-6 h-6 rounded flex items-center justify-center text-[#71717A] hover:bg-black/[0.05] transition-all cursor-pointer"
          >
            <Square size={11} />
          </button>
          <button
            title="关闭程序"
            className="w-6 h-6 rounded flex items-center justify-center text-[#71717A] hover:bg-red-500 hover:text-white transition-all cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </header>
  )
}
