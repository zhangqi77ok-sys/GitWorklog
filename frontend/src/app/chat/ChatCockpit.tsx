import React, { useState, useRef } from 'react'
import {
  Code2,
  Paperclip,
  ArrowUp,
  Loader2,
  ChevronDown,
  Check,
  ChevronRight,
  Zap,
} from 'lucide-react'
import { useWorkspaceStore, INITIAL_SESSIONS } from '../../core/store/workspaceStore'
import { useChatStore } from '../../core/store/chatStore'
import { useEditorStore } from '../../core/store/editorStore'

export const ChatCockpit: React.FC = () => {
  const {
    activeSessionId,
    setActiveSessionId,
    isCodeWorkspaceOpen,
    toggleCodeWorkspace,
    isApprovalMode,
    toggleApprovalMode,
  } = useWorkspaceStore()

  const { messages, isStreaming, sendMessage, currentModel, setCurrentModel } = useChatStore()
  const { openFile } = useEditorStore()

  const [inputPrompt, setInputPrompt] = useState('')
  const [isAtPopupOpen, setIsAtPopupOpen] = useState(false)
  const [isSlashPopupOpen, setIsSlashPopupOpen] = useState(false)
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const [isThinkingOpen, setIsThinkingOpen] = useState(true)

  // 展开算子明细
  const [openTools, setOpenTools] = useState<Record<string, boolean>>({
    cmd1: true,
    subagent: true,
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const toggleTool = (id: string) => {
    setOpenTools((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleSend = () => {
    if (!inputPrompt.trim() || isStreaming) return
    sendMessage(inputPrompt)
    setInputPrompt('')
    setIsAtPopupOpen(false)
    setIsSlashPopupOpen(false)
  }

  return (
    <main className="flex-1 flex flex-col bg-[#FAF8F5] overflow-hidden relative select-none">
      {/* 1. 顶部会话分支 TabBar 导航 */}
      <nav className="h-9 min-h-[36px] bg-[#FAF8F5] border-b border-black/[0.08] flex items-center justify-between px-2 select-none shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 py-1">
          {INITIAL_SESSIONS.map((sess) => {
            const isActive = sess.id === activeSessionId
            return (
              <div
                key={sess.id}
                onClick={() => setActiveSessionId(sess.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs cursor-pointer transition-all ${
                  isActive
                    ? 'font-semibold bg-white text-[#18181B] shadow-2xs border border-black/[0.08]'
                    : 'font-medium text-[#71717A] hover:bg-black/[0.03]'
                }`}
              >
                <span className="text-xs">{sess.icon}</span>
                <span className="truncate max-w-[140px]">{sess.title}</span>
              </div>
            )
          })}
        </div>

        {/* 右侧：展开/收起右侧代码工作区按钮 */}
        <button
          onClick={toggleCodeWorkspace}
          title="展开/收起代码审查工作台"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-[#18181B] bg-white hover:bg-black/[0.03] border border-black/[0.08] shadow-2xs transition-all cursor-pointer ml-2"
        >
          <Code2 size={13} className="text-[#D96B27]" />
          <span>{isCodeWorkspaceOpen ? '收起代码' : '展开代码'}</span>
        </button>
      </nav>

      {/* 2. 消息流容器 */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* 用户提问气泡示例 */}
        <div className="flex justify-end">
          <div className="max-w-[80%] bg-[#F4EFEA] text-[#18181B] px-4 py-3 rounded-2xl rounded-tr-sm border border-black/[0.06] shadow-2xs text-xs leading-relaxed">
            1. 请按照 web_prototype 原型对齐：左侧 48px 活动栏与 260px 多功能抽屉。<br />
            2. 右侧接入 Monaco 双栏 Diff 审查，点击改动文件能直接联动预览。<br />
            3. 保留受控终端抽屉与全局设置弹窗。
          </div>
        </div>

        {/* 智能体执行流 */}
        <div className="flex flex-col items-start space-y-3 max-w-3xl">
          {/* 头部身份 */}
          <div className="flex items-center gap-2 text-xs font-semibold text-[#18181B]">
            <div className="w-4 h-4 rounded bg-[#D96B27] text-white flex items-center justify-center text-[9px] font-bold">
              T
            </div>
            <span>Tcode Agent</span>
            <span className="text-[10px] text-[#10A37F] bg-[#10A37F]/10 px-1.5 py-0.2 rounded font-mono">
              DeepSeek-V4 · Act 模式
            </span>
          </div>

          {/* 深度心智思考卡片 */}
          <div className="w-full rounded-xl border border-black/[0.08] bg-white/60 shadow-2xs overflow-hidden">
            <div
              onClick={() => setIsThinkingOpen(!isThinkingOpen)}
              className="p-2.5 flex items-center justify-between hover:bg-black/[0.02] cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">🧠</span>
                <span className="text-xs font-semibold text-[#18181B]">
                  深度心智思考：像素级对齐原型架构与交互细节
                </span>
                <span className="text-[10px] text-[#A1A1AA] bg-black/[0.04] px-1.5 py-0.2 rounded">
                  耗时 0.7s
                </span>
              </div>
              <ChevronDown
                size={14}
                className={`text-[#71717A] transition-transform ${isThinkingOpen ? 'rotate-180' : ''}`}
              />
            </div>
            {isThinkingOpen && (
              <div className="px-3 pb-3 text-xs text-[#71717A] leading-relaxed italic border-t border-black/[0.04] bg-[#FAF8F5] pt-2 space-y-1">
                <p>1. 补齐最左侧 48px 主导航栏（Activity Bar），支持在会话、文件树、Git 与设置之间秒切；</p>
                <p>2. 次级抽屉实现：会话分支抽屉（多工程折叠、标签筛选）、工程文件树与双层 Git 暂存；</p>
                <p>3. 底部输入舱完备集成：上传、@ 引用浮窗、/ 快捷指令与人工审核开关。</p>
              </div>
            )}
          </div>

          {/* Agent 算子与终端命令执行记录卡片组 */}
          <div className="w-full space-y-2">
            <div className="flex items-center justify-between text-[11px] text-[#71717A] px-1">
              <span className="font-bold flex items-center gap-1.5 text-[#18181B]">
                <span className="text-xs">⚡</span>
                <span>Agent 算子与终端命令执行流程 (3 个动作已闭环):</span>
              </span>
              <span className="font-mono">总耗时 1.4s · 退出码 0</span>
            </div>

            {/* 算子 1: run_command */}
            <div className="rounded-xl border border-black/[0.08] bg-white shadow-2xs overflow-hidden">
              <div
                onClick={() => toggleTool('cmd1')}
                className="p-2.5 flex items-center justify-between hover:bg-black/[0.02] cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-md bg-[#18181B] text-white flex items-center justify-center font-mono text-[10px] font-bold">
                    $_
                  </span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono font-bold text-[#18181B]">run_command</span>
                    <span className="text-xs font-mono text-[#52525B] bg-[#FAF8F5] border border-black/[0.06] px-2 py-0.5 rounded truncate max-w-md">
                      git status -s
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-[10px] text-[#10A37F] font-mono font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10A37F]" />
                    <span>执行成功 (210ms)</span>
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-[#71717A] transition-transform ${openTools['cmd1'] ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>
              {openTools['cmd1'] && (
                <div className="border-t border-black/[0.06] bg-[#1E1C1A] text-white p-3 font-mono text-[11px] leading-relaxed space-y-1">
                  <div className="text-white/40 pb-1 border-b border-white/[0.08] flex items-center justify-between text-[10px]">
                    <span>STDOUT / STDERR 捕获</span>
                    <span>Exit Code: 0</span>
                  </div>
                  <div className="text-emerald-400">M frontend/src/App.tsx</div>
                  <div className="text-emerald-400">M README.md</div>
                  <div className="text-white/40">Execution completed smoothly in 0.21s.</div>
                </div>
              )}
            </div>

            {/* 算子 2: sub-agent 委派 */}
            <div className="rounded-xl border border-black/[0.08] bg-white shadow-2xs overflow-hidden">
              <div
                onClick={() => toggleTool('subagent')}
                className="p-2.5 flex items-center justify-between hover:bg-black/[0.02] cursor-pointer bg-gradient-to-r from-purple-50/50 via-white to-white"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-md bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                    🤖
                  </span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono font-bold text-[#18181B]">invoke_subagent</span>
                    <span className="text-xs font-medium text-purple-900 bg-purple-100/70 border border-purple-200/60 px-2 py-0.5 rounded truncate">
                      并发委派 2 个专业子代理 (Researcher & QA)
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                    <span>协同完毕 (总耗时 1.8s)</span>
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-[#71717A] transition-transform ${openTools['subagent'] ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>
              {openTools['subagent'] && (
                <div className="border-t border-black/[0.06] bg-[#FAF8F5] p-3 space-y-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-white border border-black/[0.06] shadow-2xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#18181B]">
                        Sub-Agent #1: Codebase Researcher (代码库调研专家)
                      </span>
                      <span className="text-[10px] text-[#10A37F] font-mono">● 耗时 0.9s</span>
                    </div>
                    <p className="text-[11px] text-[#52525B]">
                      精准提取 web_prototype.html 中关于 48px 活动栏、260px 抽屉与 Monaco Diff 的 DOM 结构。
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 【核心功能】Agent 变更文件展示卡片组 */}
          <div className="w-full rounded-2xl border border-black/[0.08] bg-white shadow-xs p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#18181B]">
                <span className="text-sm">📝</span>
                <span>检测到本轮涉及 2 个代码文件改动:</span>
              </div>
              <span className="text-[10px] text-[#71717A]">点击任意文件立即在右侧预览 Diff 差异</span>
            </div>

            <div className="space-y-1.5 pt-1">
              {/* 文件改动卡片 1: main.go */}
              <div
                onClick={() => openFile('backend/cmd/tcode-daemon/main.go', true)}
                className="p-2.5 rounded-xl bg-[#FAF8F5] border border-black/[0.06] hover:border-[#D96B27] hover:bg-white shadow-2xs flex items-center justify-between cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base text-[#D96B27]">📄</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#18181B] group-hover:text-[#D96B27] transition-colors">
                        backend/cmd/tcode-daemon/main.go
                      </span>
                      <span className="text-[9px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-mono font-bold">
                        ~M (修改)
                      </span>
                    </div>
                    <div className="text-[11px] text-[#71717A] mt-0.5">
                      接入受控终端算子插件与文件沙箱
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-mono font-bold text-[#10A37F] bg-[#10A37F]/10 px-2 py-0.5 rounded-full">
                    +8 / -2 行
                  </span>
                  <div className="flex items-center gap-1 text-xs font-semibold text-[#D96B27] group-hover:translate-x-0.5 transition-transform">
                    <span>查看 Diff</span>
                    <ChevronRight size={13} strokeWidth={2.5} />
                  </div>
                </div>
              </div>

              {/* 文件改动卡片 2: README.md */}
              <div
                onClick={() => openFile('README.md', true)}
                className="p-2.5 rounded-xl bg-[#FAF8F5] border border-black/[0.06] hover:border-[#D96B27] hover:bg-white shadow-2xs flex items-center justify-between cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base text-[#10A37F]">📄</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#18181B] group-hover:text-[#D96B27] transition-colors">
                        README.md
                      </span>
                      <span className="text-[9px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-mono font-bold">
                        ~M (更新)
                      </span>
                    </div>
                    <div className="text-[11px] text-[#71717A] mt-0.5">
                      同步记录第 15 项受控终端与静默 Shell 算子
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-mono font-bold text-[#10A37F] bg-[#10A37F]/10 px-2 py-0.5 rounded-full">
                    +12 / -0 行
                  </span>
                  <div className="flex items-center gap-1 text-xs font-semibold text-[#D96B27] group-hover:translate-x-0.5 transition-transform">
                    <span>查看 Diff</span>
                    <ChevronRight size={13} strokeWidth={2.5} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 动态追加的新增消息 */}
        {messages.map((m) => {
          if (m.role === 'user') {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[80%] bg-[#F4EFEA] text-[#18181B] px-4 py-3 rounded-2xl rounded-tr-sm border border-black/[0.06] shadow-2xs text-xs leading-relaxed">
                  {m.content}
                </div>
              </div>
            )
          }

          return (
            <div key={m.id} className="flex flex-col items-start space-y-3 max-w-3xl">
              {/* 头部身份 */}
              <div className="flex items-center gap-2 text-xs font-semibold text-[#18181B]">
                <div className="w-4 h-4 rounded bg-[#D96B27] text-white flex items-center justify-center text-[9px] font-bold">
                  T
                </div>
                <span>Tcode Agent</span>
                <span className="text-[10px] text-[#10A37F] bg-[#10A37F]/10 px-1.5 py-0.2 rounded font-mono">
                  {m.model || currentModel} · Act 模式
                </span>
              </div>

              {/* 深度思考流 (若有) */}
              {m.thinking && (
                <div className="w-full rounded-xl border border-black/[0.08] bg-white/60 shadow-2xs overflow-hidden">
                  <div className="p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🧠</span>
                      <span className="text-xs font-semibold text-[#18181B]">深度心智思考</span>
                      <span className="text-[10px] text-[#10A37F] bg-[#10A37F]/10 px-1.5 py-0.2 rounded font-mono">
                        流式生成中
                      </span>
                    </div>
                  </div>
                  <div className="px-3 pb-3 text-xs text-[#71717A] leading-relaxed italic border-t border-black/[0.04] bg-[#FAF8F5] pt-2 whitespace-pre-wrap">
                    {m.thinking}
                  </div>
                </div>
              )}

              {/* 算子执行卡片组 (若有) */}
              {m.toolCalls && m.toolCalls.length > 0 && (
                <div className="w-full space-y-2">
                  {m.toolCalls.map((tc) => (
                    <div
                      key={tc.id}
                      className="rounded-xl border border-black/[0.08] bg-white shadow-2xs overflow-hidden text-xs"
                    >
                      <div className="p-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-md bg-[#18181B] text-white flex items-center justify-center font-mono text-[10px] font-bold">
                            $_
                          </span>
                          <span className="font-mono font-bold text-[#18181B]">{tc.name}</span>
                          <span className="text-[11px] font-mono text-[#71717A] truncate max-w-sm">
                            {JSON.stringify(tc.args)}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                            tc.status === 'running'
                              ? 'bg-amber-100 text-amber-800'
                              : tc.status === 'error'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {tc.status === 'running' ? '● 正在执行' : tc.status === 'error' ? '✕ 执行失败' : '✓ 执行成功'}
                        </span>
                      </div>
                      {tc.output && (
                        <div className="border-t border-black/[0.06] bg-[#1E1C1A] text-white p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                          {tc.output}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 正文回复内容 */}
              {m.content && (
                <div className="w-full bg-white text-[#18181B] px-4 py-3 rounded-2xl rounded-tl-sm border border-black/[0.08] shadow-2xs text-xs leading-relaxed whitespace-pre-wrap">
                  {m.content}
                </div>
              )}
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. 底部高级输入舱 (对齐原型) */}
      <div className="p-4 bg-gradient-to-t from-[#FAF8F5] via-[#FAF8F5]/90 to-transparent relative shrink-0">
        {/* @ 引用弹窗 */}
        {isAtPopupOpen && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[460px] bg-white rounded-2xl shadow-2xl border border-black/[0.1] p-3 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06]">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#18181B]">
                <span className="text-[#D96B27]">@</span>
                <span>引用上下文实体或技能</span>
              </div>
              <button
                onClick={() => setIsAtPopupOpen(false)}
                className="text-xs text-[#71717A] hover:text-[#18181B]"
              >
                ✕
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 text-xs py-2">
              <div
                onClick={() => {
                  setInputPrompt((p) => p + ' @session:架构重构与执行流设计 ')
                  setIsAtPopupOpen(false)
                }}
                className="p-2 rounded-xl hover:bg-[#FAF8F5] cursor-pointer flex items-center justify-between"
              >
                <span>📌 架构重构与执行流设计</span>
                <span className="text-[10px] text-[#71717A]">会话分支</span>
              </div>
              <div
                onClick={() => {
                  setInputPrompt((p) => p + ' @tdd-test-runner ')
                  setIsAtPopupOpen(false)
                }}
                className="p-2 rounded-xl hover:bg-[#FAF8F5] cursor-pointer flex items-center justify-between"
              >
                <span>🧪 @tdd-test-runner</span>
                <span className="text-[10px] text-[#10A37F]">内置技能</span>
              </div>
              <div
                onClick={() => {
                  setIsAtPopupOpen(false)
                  useWorkspaceStore.getState().setSkillModalOpen(true)
                }}
                className="p-2 rounded-xl bg-[#FAF8F5] hover:bg-[#D96B27]/10 text-[#D96B27] font-semibold cursor-pointer flex items-center justify-between border border-dashed border-[#D96B27]/40 mt-1"
              >
                <span>🛠️ 添加 / 导入自定义技能 (SKILL.md)</span>
                <span className="text-[10px]">打开向导 ▾</span>
              </div>
            </div>
          </div>
        )}

        {/* / 快捷命令弹窗 */}
        {isSlashPopupOpen && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[460px] bg-white rounded-2xl shadow-2xl border border-black/[0.1] p-3 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06]">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#18181B]">
                <span className="text-[#D96B27]">/</span>
                <span>快捷指令与工具调度</span>
              </div>
              <button
                onClick={() => setIsSlashPopupOpen(false)}
                className="text-xs text-[#71717A] hover:text-[#18181B]"
              >
                ✕
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 text-xs py-2">
              <div
                onClick={() => {
                  setInputPrompt('/test 运行全套单元测试并在失败时自我修复')
                  setIsSlashPopupOpen(false)
                }}
                className="p-2 rounded-xl hover:bg-[#FAF8F5] cursor-pointer flex items-center justify-between"
              >
                <span className="font-mono text-[#D96B27]">/test</span>
                <span className="text-[11px] text-[#71717A]">执行测试自愈循环</span>
              </div>
              <div
                onClick={() => {
                  setInputPrompt('/diff 生成当前工作区完整变更审查报告')
                  setIsSlashPopupOpen(false)
                }}
                className="p-2 rounded-xl hover:bg-[#FAF8F5] cursor-pointer flex items-center justify-between"
              >
                <span className="font-mono text-[#D96B27]">/diff</span>
                <span className="text-[11px] text-[#71717A]">审查未暂存改动</span>
              </div>
            </div>
          </div>
        )}

        {/* 输入面板外框 */}
        <div className="max-w-3xl mx-auto rounded-2xl bg-white border border-black/[0.1] shadow-lg p-2.5 space-y-2 focus-within:border-[#D96B27] focus-within:ring-2 focus-within:ring-[#D96B27]/10 transition-all">
          <textarea
            rows={2}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="输入指令 (按 Enter 发送，支持 @ 引用分支与 / 快捷指令)..."
            className="w-full text-xs text-[#18181B] placeholder:text-[#A1A1AA] bg-transparent focus:outline-none resize-none leading-relaxed px-1"
          />

          <div className="flex items-center justify-between pt-1 border-t border-black/[0.04]">
            {/* 左侧动作按钮组 */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                title="上传附件代码或图片"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-[#71717A] hover:text-[#18181B] hover:bg-black/[0.04] transition-all cursor-pointer"
              >
                <Paperclip size={13} />
                <span className="text-[11px] font-medium hidden sm:inline">上传</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAtPopupOpen(!isAtPopupOpen)}
                title="引用会话分支或内置技能 (@)"
                className="px-2 py-1 rounded-lg text-xs font-mono font-bold text-[#71717A] hover:text-[#D96B27] hover:bg-black/[0.04] transition-all cursor-pointer"
              >
                @
              </button>

              <button
                type="button"
                onClick={() => setIsSlashPopupOpen(!isSlashPopupOpen)}
                title="调用 Skill 指令或 MCP 工具 (/)"
                className="px-2 py-1 rounded-lg text-xs font-mono font-bold text-[#71717A] hover:text-[#D96B27] hover:bg-black/[0.04] transition-all cursor-pointer"
              >
                /
              </button>

              <div className="h-3 w-[1px] bg-black/[0.08] mx-0.5" />

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#D96B27]/10 text-[#D96B27] text-xs font-semibold select-none">
                <Zap size={12} />
                <span className="hidden sm:inline text-[11px]">Act 极速双环</span>
              </div>

              {/* 需人工审核开关 */}
              <button
                type="button"
                onClick={toggleApprovalMode}
                title="切换是否需要人工审核代码变更"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer bg-white text-[#52525B] border-black/[0.08] hover:border-black/[0.18] shadow-2xs"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isApprovalMode ? 'bg-amber-500' : 'bg-[#10A37F]'
                  }`}
                />
                <span className="font-medium text-[11px]">
                  {isApprovalMode ? '需人工审核' : '全自主写入'}
                </span>
              </button>
            </div>

            {/* 右侧模型切换与发送按钮 */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <div
                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F4EFEA] hover:bg-black/[0.06] text-xs font-medium text-[#18181B] transition-all cursor-pointer border border-black/[0.06]"
                >
                  <span className="w-2 h-2 rounded-full bg-[#10A37F]" />
                  <span className="text-[11px]">{currentModel}</span>
                  <ChevronDown size={11} className="text-[#71717A]" />
                </div>

                {isModelDropdownOpen && (
                  <div className="absolute bottom-full right-0 mb-2 w-48 bg-white rounded-xl shadow-xl border border-black/[0.08] p-1.5 space-y-1 z-50 text-xs">
                    {['DeepSeek-V4-Flash', 'Claude-3.7-Sonnet', 'GPT-4o'].map((m) => (
                      <div
                        key={m}
                        onClick={() => {
                          setCurrentModel(m)
                          setIsModelDropdownOpen(false)
                        }}
                        className={`p-2 rounded-lg cursor-pointer flex items-center justify-between ${
                          currentModel === m
                            ? 'bg-[#D96B27]/10 text-[#D96B27] font-semibold'
                            : 'hover:bg-black/[0.03]'
                        }`}
                      >
                        <span>{m}</span>
                        {currentModel === m && <Check size={12} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleSend}
                disabled={isStreaming || !inputPrompt.trim()}
                className="w-7 h-7 rounded-full bg-[#18181B] hover:bg-[#D96B27] disabled:bg-gray-300 text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer"
              >
                {isStreaming ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <ArrowUp size={14} strokeWidth={2.5} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
