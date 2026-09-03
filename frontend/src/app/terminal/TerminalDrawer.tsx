import React, { useState } from 'react'
import { Terminal, Activity, ShieldCheck, X, Maximize2, Minimize2, Trash2 } from 'lucide-react'
import { useWorkspaceStore } from '../../core/store/workspaceStore'

export const TerminalDrawer: React.FC = () => {
  const { isTerminalOpen, toggleTerminal } = useWorkspaceStore()
  const [activeTab, setActiveTab] = useState<'shell' | 'trace' | 'daemon'>('shell')
  const [isMaximized, setIsMaximized] = useState(false)

  if (!isTerminalOpen) return null

  return (
    <div
      className={`border-t border-[#332F2C] bg-[#161412] text-[#E0D8D0] flex flex-col transition-all duration-200 z-40 select-none ${
        isMaximized ? 'h-[50vh]' : 'h-60'
      }`}
    >
      {/* 终端顶栏控制区 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1E1A17] border-b border-[#2C2825] text-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('shell')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
              activeTab === 'shell' ? 'bg-[#2E2824] text-[#D96B27] font-medium' : 'text-[#8C827A] hover:text-[#D4CAC2]'
            }`}
          >
            <Terminal size={13} />
            <span>Interactive Shell</span>
          </button>
          <button
            onClick={() => setActiveTab('trace')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
              activeTab === 'trace' ? 'bg-[#2E2824] text-[#D96B27] font-medium' : 'text-[#8C827A] hover:text-[#D4CAC2]'
            }`}
          >
            <Activity size={13} />
            <span>Kernel Trace</span>
          </button>
          <button
            onClick={() => setActiveTab('daemon')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
              activeTab === 'daemon' ? 'bg-[#2E2824] text-[#D96B27] font-medium' : 'text-[#8C827A] hover:text-[#D4CAC2]'
            }`}
          >
            <ShieldCheck size={13} />
            <span>Daemon Guard</span>
          </button>
        </div>

        {/* 右侧动作图标 */}
        <div className="flex items-center gap-1 text-[#8C827A]">
          <button title="清屏 (Ctrl + L)" className="p-1 hover:text-[#D4CAC2] rounded">
            <Trash2 size={13} />
          </button>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? '还原' : '最大化'}
            className="p-1 hover:text-[#D4CAC2] rounded"
          >
            {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button
            onClick={toggleTerminal}
            title="关闭终端抽屉 (Ctrl + `)"
            className="p-1 hover:text-[#D4CAC2] hover:bg-red-900/30 rounded"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* 终端内容视窗 */}
      <div className="flex-1 p-3 font-mono text-xs overflow-y-auto leading-relaxed text-[#D4CAC2]">
        {activeTab === 'shell' && (
          <div>
            <div className="text-[#8C827A] mb-2">Tcode Micro-Kernel Shell ready. Type commands or `help`.</div>
            <div className="flex items-center gap-1.5 text-[#52D17C]">
              <span>tcode@desktop:~$</span>
              <span className="w-2 h-4 bg-[#D96B27] inline-block animate-pulse" />
            </div>
          </div>
        )}
        {activeTab === 'trace' && (
          <div className="text-[#8C827A]">
            <div>[00:00:01] [Core] Dual-Loop FSM Initialized in STATE_IDLE</div>
            <div>[00:00:02] [Provider] OpenAI & Claude upstream protocols ready</div>
          </div>
        )}
        {activeTab === 'daemon' && (
          <div className="text-[#8C827A]">
            <div>Memory: 18.4MB / 45MB Limit (OK)</div>
            <div>Shadow Snapshots: Active on .git/refs/tcode/snapshots</div>
          </div>
        )}
      </div>
    </div>
  )
}
