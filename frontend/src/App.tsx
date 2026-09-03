import React, { useEffect, useState, useRef } from 'react'
import { ActivityBar } from './app/layout/ActivityBar'
import { WorkspaceSwitcher } from './app/layout/WorkspaceSwitcher'
import { TerminalDrawer } from './app/terminal/TerminalDrawer'
import { GitPanel } from './app/git/GitPanel'
import { UsageCockpit } from './app/analytics/UsageCockpit'
import { MessageBubble } from './app/chat/MessageBubble'
import { EditorWorkspace } from './app/editor/EditorWorkspace'
import { useWorkspaceStore } from './core/store/workspaceStore'
import { useChatStore } from './core/store/chatStore'
import { Cpu, Send, Loader2, Sparkles } from 'lucide-react'

export const App: React.FC = () => {
  const { mode, activityTab, toggleTerminal } = useWorkspaceStore()
  const { messages, isStreaming, sendMessage, currentModel, setCurrentModel } = useChatStore()
  const [inputPrompt, setInputPrompt] = useState('')
  const chatBottomRef = useRef<HTMLDivElement>(null)

  // 绑定全局快捷键 Ctrl + `
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '`' || e.code === 'Backquote')) {
        e.preventDefault()
        toggleTerminal()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleTerminal])

  // 自动滚屏至底部
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!inputPrompt.trim() || isStreaming) return
    sendMessage(inputPrompt)
    setInputPrompt('')
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#FAF8F5]">
      {/* 顶栏控制中枢 */}
      <header className="h-10 bg-[#F4EFEA] border-b border-[#EADFD7] flex items-center justify-between px-3 select-none shrink-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-[#D96B27] text-white flex items-center justify-center font-bold text-xs">
            T
          </div>
          <span className="font-semibold text-xs tracking-tight text-[#2C2825]">Tcode</span>
          <span className="text-[10px] text-[#7A726B] bg-[#EADFD7] px-1.5 py-0.5 rounded font-mono">v2.0.0</span>
        </div>

        {/* 顶栏单焦点切换胶囊 */}
        <WorkspaceSwitcher />

        {/* 右侧探针指示与模型选择 */}
        <div className="flex items-center gap-2 text-xs text-[#7A726B]">
          <select
            value={currentModel}
            onChange={(e) => setCurrentModel(e.target.value)}
            className="bg-white border border-[#EADFD7] rounded text-[11px] px-2 py-0.5 text-[#2C2825] focus:outline-none focus:border-[#D96B27]"
          >
            <option value="deepseek-v4-flash">DeepSeek-V4 Flash (Thinking)</option>
            <option value="gpt-5.6-sol">GPT-5.6 Sol (Ultra-Fast)</option>
            <option value="claude-opus-4-8">Claude Opus 4.8</option>
            <option value="glm-5.3">GLM-5.3 (Thinking)</option>
            <option value="gpt-4o">GPT-4o (Omni)</option>
          </select>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#52D17C] animate-pulse" />
            <Cpu size={12} />
            <span className="text-[11px] font-mono">Micro-Kernel Ready</span>
          </span>
        </div>
      </header>

      {/* 主工作台主体：侧边栏 + 工作区 */}
      <div className="flex-1 flex overflow-hidden relative">
        <ActivityBar />

        {/* 次级抽屉展开区域 (如 Git 面板) */}
        {activityTab === 'git' && <GitPanel />}

        {/* 中央主工作区 */}
        {activityTab === 'usage' ? (
          <UsageCockpit />
        ) : (
          <main className="flex-1 flex overflow-hidden">
            {/* 对话工作区 */}
            {(mode === 'chat' || mode === 'split') && (
              <section className="flex-1 flex flex-col bg-white border-r border-[#EADFD7] relative">
                {/* 消息滚动流 */}
                <div className="flex-1 p-4 overflow-y-auto flex flex-col">
                  {messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}
                  <div ref={chatBottomRef} />
                </div>

                {/* 底部输入舱 */}
                <div className="p-3 border-t border-[#EADFD7] bg-[#FAF8F5]/60 flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={inputPrompt}
                      onChange={(e) => setInputPrompt(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      placeholder={isStreaming ? '模型正在推理流式输出中...' : '输入指令 (按 Enter 发送，支持模型思考流)...'}
                      disabled={isStreaming}
                      className="w-full text-xs pl-3 pr-8 py-2 rounded-lg border border-[#EADFD7] bg-white focus:outline-none focus:border-[#D96B27] disabled:bg-gray-50 disabled:text-gray-400"
                    />
                    <Sparkles size={13} className="absolute right-2.5 top-2.5 text-[#A39B94]" />
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={isStreaming || !inputPrompt.trim()}
                    className="p-2 bg-[#D96B27] hover:bg-[#BF5B1D] disabled:bg-gray-300 text-white rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isStreaming ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </button>
                </div>
              </section>
            )}

            {/* 代码与编辑工作区 (Monaco Editor & Diff Reviewer) */}
            {(mode === 'editor' || mode === 'split') && (
              <section className="flex-1 flex flex-col bg-[#FAF8F5] overflow-hidden">
                <EditorWorkspace />
              </section>
            )}
          </main>
        )}
      </div>

      {/* 底部集成式终端抽屉 */}
      <TerminalDrawer />
    </div>
  )
}
