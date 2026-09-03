import React from 'react'
import {
  MessageSquare,
  FolderTree,
  GitBranch,
  BarChart3,
  Network,
  Boxes,
  Settings,
} from 'lucide-react'
import { useWorkspaceStore } from '../../core/store/workspaceStore'
import { useSettingsStore } from '../../core/store/settingsStore'

export const ActivityBar: React.FC = () => {
  const { activityTab, setActivityTab, toggleTerminal, isTerminalOpen, setKgModalOpen } =
    useWorkspaceStore()
  const { openSettings } = useSettingsStore()

  return (
    <aside className="w-[48px] min-w-[48px] bg-[#EFEAE4] border-r border-black/[0.08] flex flex-col justify-between items-center py-2 z-20 shrink-0 select-none">
      {/* 顶部主导航图标组 */}
      <div className="flex flex-col items-center gap-2 w-full">
        {/* 1. 会话工作台 */}
        <button
          onClick={() => setActivityTab('chat')}
          title="AI 对话工作台与分支"
          className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
            activityTab === 'chat'
              ? 'text-[#D96B27] bg-white shadow-2xs font-bold'
              : 'text-[#71717A] hover:text-[#18181B] hover:bg-white/60'
          }`}
        >
          <MessageSquare size={19} strokeWidth={2} />
          {activityTab === 'chat' && (
            <span className="absolute -left-1 top-2.5 w-1 h-5 bg-[#D96B27] rounded-r-full" />
          )}
        </button>

        {/* 2. 工程文件树 */}
        <button
          onClick={() => setActivityTab('files')}
          title="工程文件资源管理器"
          className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
            activityTab === 'files'
              ? 'text-[#D96B27] bg-white shadow-2xs font-bold'
              : 'text-[#71717A] hover:text-[#18181B] hover:bg-white/60'
          }`}
        >
          <FolderTree size={19} strokeWidth={2} />
          {activityTab === 'files' && (
            <span className="absolute -left-1 top-2.5 w-1 h-5 bg-[#D96B27] rounded-r-full" />
          )}
        </button>

        {/* 3. Git 版本控制 */}
        <button
          onClick={() => setActivityTab('git')}
          title="Git 变更与代码审查"
          className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
            activityTab === 'git'
              ? 'text-[#D96B27] bg-white shadow-2xs font-bold'
              : 'text-[#71717A] hover:text-[#18181B] hover:bg-white/60'
          }`}
        >
          <GitBranch size={19} strokeWidth={2} />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#10A37F]" />
          {activityTab === 'git' && (
            <span className="absolute -left-1 top-2.5 w-1 h-5 bg-[#D96B27] rounded-r-full" />
          )}
        </button>

        {/* 4. 模型使用情况大盘 */}
        <button
          onClick={() => setActivityTab('usage')}
          title="模型使用情况与 Token 消耗大盘"
          className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
            activityTab === 'usage'
              ? 'text-[#D96B27] bg-white shadow-2xs font-bold'
              : 'text-[#71717A] hover:text-[#18181B] hover:bg-white/60'
          }`}
        >
          <BarChart3 size={19} strokeWidth={2} />
          {activityTab === 'usage' && (
            <span className="absolute -left-1 top-2.5 w-1 h-5 bg-[#D96B27] rounded-r-full" />
          )}
        </button>

        {/* 5. 项目知识图谱与记忆 */}
        <button
          onClick={() => setKgModalOpen(true)}
          title="项目知识图谱与架构决策 (ADR)"
          className="relative w-10 h-10 rounded-xl flex items-center justify-center text-[#71717A] hover:text-[#18181B] hover:bg-white/60 transition-all cursor-pointer"
        >
          <Network size={19} strokeWidth={2} />
        </button>

        {/* 6. MCP 与工具扩展 */}
        <button
          onClick={() => setActivityTab('mcp')}
          title="MCP 协议服务与工具库"
          className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
            activityTab === 'mcp'
              ? 'text-[#D96B27] bg-white shadow-2xs font-bold'
              : 'text-[#71717A] hover:text-[#18181B] hover:bg-white/60'
          }`}
        >
          <Boxes size={19} strokeWidth={2} />
          {activityTab === 'mcp' && (
            <span className="absolute -left-1 top-2.5 w-1 h-5 bg-[#D96B27] rounded-r-full" />
          )}
        </button>

        {/* 7. 终端抽屉快捷入口 */}
        <button
          onClick={toggleTerminal}
          title="唤起/收起集成终端抽屉 (Ctrl+`)"
          className={`relative w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-xs transition-all cursor-pointer ${
            isTerminalOpen
              ? 'text-[#D96B27] bg-white shadow-2xs'
              : 'text-[#71717A] hover:text-[#18181B] hover:bg-white/60'
          }`}
        >
          <span>$_</span>
        </button>
      </div>

      {/* 底部控制图标组 */}
      <div className="flex flex-col items-center gap-2 w-full">
        {/* 用户账号 */}
        <div
          title="开发者账号: Antigravity Dev (Pro)"
          className="w-9 h-9 rounded-full bg-[#D96B27]/15 text-[#D96B27] flex items-center justify-center font-bold text-xs hover:ring-2 ring-[#D96B27] transition-all cursor-pointer"
        >
          Dev
        </div>

        {/* 系统设置 */}
        <button
          onClick={openSettings}
          title="系统全局设置 (Ctrl+,)"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[#71717A] hover:text-[#18181B] hover:bg-white/60 transition-all cursor-pointer"
        >
          <Settings size={19} strokeWidth={2} />
        </button>
      </div>
    </aside>
  )
}
