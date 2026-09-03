import React, { useEffect } from 'react'
import { Titlebar } from './app/layout/Titlebar'
import { ActivityBar } from './app/layout/ActivityBar'
import { LeftSidebar } from './app/layout/LeftSidebar'
import { ChatCockpit } from './app/chat/ChatCockpit'
import { CodeWorkspace } from './app/editor/CodeWorkspace'
import { UsageCockpit } from './app/analytics/UsageCockpit'
import { TerminalDrawer } from './app/terminal/TerminalDrawer'
import { SettingsModal } from './app/settings/SettingsModal'
import { KnowledgeGraphModal } from './app/kg/KnowledgeGraphModal'
import { GitBranchModal } from './app/git/GitBranchModal'
import { SnapshotModal } from './app/git/SnapshotModal'
import { useWorkspaceStore } from './core/store/workspaceStore'
import { useSettingsStore } from './core/store/settingsStore'

export const App: React.FC = () => {
  const { mode, activityTab, isCodeWorkspaceOpen, toggleTerminal } = useWorkspaceStore()
  const { openSettings } = useSettingsStore()

  // 绑定全局快捷键 Ctrl + ` 与 Ctrl + ,
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '`' || e.code === 'Backquote')) {
        e.preventDefault()
        toggleTerminal()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === ',' || e.code === 'Comma')) {
        e.preventDefault()
        openSettings()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleTerminal, openSettings])

  return (
    <div className="h-full w-full bg-[#FAF8F5] text-[#18181B] flex flex-col font-sans select-none overflow-hidden antialiased">
      {/* 1. 沉浸式无边框标题栏 (Titlebar) */}
      <Titlebar />

      {/* 2. 主体工作区容器 (48px 活动栏 + 260px 次级抽屉 + 主工作区) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 最左侧 48px 主导航活动栏 */}
        <ActivityBar />

        {/* 260px 次级多功能抽屉 (会话分支 / 文件资源树 / Git 源码管理 / MCP) */}
        <LeftSidebar />

        {/* 中央主工作区 */}
        {activityTab === 'usage' ? (
          <UsageCockpit />
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {/* 对话区 + 代码审查区水平分栏 */}
            <div className="flex-1 flex overflow-hidden relative">
              {/* 智能对话工作台 */}
              {(mode === 'chat' || mode === 'split') && <ChatCockpit />}

              {/* 代码与 Diff 审查工作区 */}
              {(mode === 'editor' || mode === 'split') && isCodeWorkspaceOpen && <CodeWorkspace />}
            </div>
          </div>
        )}
      </div>

      {/* 3. 底部集成受控终端抽屉 (Xterm.js) */}
      <TerminalDrawer />

      {/* 4. 全局系统设置居中模态窗 */}
      <SettingsModal />

      {/* 5. 项目知识图谱与记忆弹窗 */}
      <KnowledgeGraphModal />

      {/* 6. Git 分支管理模态窗 */}
      <GitBranchModal />

      {/* 7. 微内核影子快照与安全回退中心 */}
      <SnapshotModal />
    </div>
  )
}
