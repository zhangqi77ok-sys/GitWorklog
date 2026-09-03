import React, { useEffect } from 'react'
import { ActivityBar } from './app/layout/ActivityBar'
import { WorkspaceSwitcher } from './app/layout/WorkspaceSwitcher'
import { TerminalDrawer } from './app/terminal/TerminalDrawer'
import { GitPanel } from './app/git/GitPanel'
import { UsageCockpit } from './app/analytics/UsageCockpit'
import { useWorkspaceStore } from './core/store/workspaceStore'
import { Cpu, Bot, Code2, Send } from 'lucide-react'

export const App: React.FC = () => {
  const { mode, activityTab, toggleTerminal } = useWorkspaceStore()

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

        {/* 右侧探针指示 */}
        <div className="flex items-center gap-2 text-xs text-[#7A726B]">
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
                <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
                  <div className="flex items-start gap-2.5 max-w-2xl">
                    <div className="w-7 h-7 rounded-full bg-[#FAF2EC] border border-[#F0D5C3] text-[#D96B27] flex items-center justify-center shrink-0">
                      <Bot size={15} />
                    </div>
                    <div className="bg-[#FAF8F5] border border-[#EADFD7] p-3 rounded-xl text-xs text-[#2C2825] leading-relaxed shadow-2xs">
                      你好！Tcode 生产级微内核与前端基础框架已就绪。
                      已原生配置 OpenAI 与 Claude 双轨上游协议支持，支持通过按键 <kbd className="px-1 py-0.5 bg-white border border-[#D9D0C7] rounded text-[10px] font-mono">Ctrl + `</kbd> 呼出集成终端抽屉。
                    </div>
                  </div>
                </div>

                {/* 底部输入舱 */}
                <div className="p-3 border-t border-[#EADFD7] bg-[#FAF8F5]/60 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="输入指令或提问 (支持 @ 引用上下文，/ 调用算子)..."
                    className="flex-1 text-xs px-3 py-2 rounded-lg border border-[#EADFD7] bg-white focus:outline-none focus:border-[#D96B27]"
                  />
                  <button className="p-2 bg-[#D96B27] hover:bg-[#BF5B1D] text-white rounded-lg transition-colors">
                    <Send size={14} />
                  </button>
                </div>
              </section>
            )}

            {/* 代码与编辑工作区 */}
            {(mode === 'editor' || mode === 'split') && (
              <section className="flex-1 flex flex-col bg-[#FAF8F5]">
                <div className="h-8 bg-[#F4EFEA] border-b border-[#EADFD7] flex items-center px-3 text-xs text-[#7A726B] font-mono gap-2">
                  <Code2 size={13} />
                  <span>backend/pkg/plugin/v1/provider.go</span>
                </div>
                <div className="flex-1 p-4 font-mono text-xs text-[#2C2825] bg-white/70 overflow-auto">
                  <pre className="text-[#7A726B] select-text">
{`// ProviderPlugin 大模型网关驱动 SPI
type ProviderPlugin interface {
    Plugin
    StreamChat(ctx context.Context, req *ChatRequest) (<-chan StreamChunk, error)
    Ping(ctx context.Context) (time.Duration, error)
    ListModels(ctx context.Context) ([]ModelDescriptor, error)
}`}
                  </pre>
                </div>
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
