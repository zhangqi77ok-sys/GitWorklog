import React from 'react'
import { MessageSquare, FolderGit2, BarChart3, Terminal, Settings } from 'lucide-react'
import { useWorkspaceStore, ActivityTab } from '../../core/store/workspaceStore'
import { useSettingsStore } from '../../core/store/settingsStore'

interface NavItem {
  id: ActivityTab
  label: string
  icon: React.ElementType
}

const navItems: NavItem[] = [
  { id: 'chat', label: '智能对话 (Chat)', icon: MessageSquare },
  { id: 'git', label: 'Git 控制中心 (Source Control)', icon: FolderGit2 },
  { id: 'usage', label: '模型使用量大盘 (Analytics)', icon: BarChart3 },
]

export const ActivityBar: React.FC = () => {
  const { activityTab, setActivityTab, toggleTerminal, isTerminalOpen } = useWorkspaceStore()
  const { openSettings } = useSettingsStore()

  return (
    <aside className="w-12 bg-[#F4EFEA] border-r border-[#EADFD7] flex flex-col justify-between items-center py-3 z-30 select-none shrink-0">
      {/* 顶部主导航组 */}
      <div className="flex flex-col gap-2 w-full items-center">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activityTab === item.id

          return (
            <button
              key={item.id}
              onClick={() => setActivityTab(item.id)}
              title={item.label}
              className={`relative w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150 group ${
                isActive
                  ? 'bg-white text-[#D96B27] shadow-xs'
                  : 'text-[#7A726B] hover:text-[#2C2825] hover:bg-[#EAE2DA]'
              }`}
            >
              {/* 激活时的陶土暖橙左指示线 */}
              {isActive && (
                <span className="absolute left-[-6px] w-[3px] h-4 bg-[#D96B27] rounded-r-full" />
              )}
              <Icon size={18} strokeWidth={2} />
            </button>
          )
        })}
      </div>

      {/* 底部终端与设置快捷按钮 */}
      <div className="w-full flex flex-col gap-2 items-center">
        <button
          onClick={toggleTerminal}
          title="集成终端抽屉 (Ctrl + `)"
          className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150 ${
            isTerminalOpen
              ? 'bg-[#161412] text-[#D96B27]'
              : 'text-[#7A726B] hover:text-[#2C2825] hover:bg-[#EAE2DA]'
          }`}
        >
          <Terminal size={18} strokeWidth={2} />
        </button>

        <button
          onClick={openSettings}
          title="系统全局设置 (Ctrl + ,)"
          className="w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150 text-[#7A726B] hover:text-[#2C2825] hover:bg-[#EAE2DA]"
        >
          <Settings size={18} strokeWidth={2} />
        </button>
      </div>
    </aside>
  )
}
