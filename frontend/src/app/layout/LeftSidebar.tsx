import React, { useState } from 'react'
import {
  FolderOpen,
  Search,
  ChevronDown,
  ChevronRight,
  Plus,
  RefreshCw,
  Check,
  RotateCcw,
  Boxes,
} from 'lucide-react'
import { useWorkspaceStore, INITIAL_SESSIONS } from '../../core/store/workspaceStore'
import { useGitStore } from '../../core/store/gitStore'
import { FileTree } from '../editor/FileTree'

export const LeftSidebar: React.FC = () => {
  const { activityTab, activeSessionId, setActiveSessionId, selectedTag, setSelectedTag } =
    useWorkspaceStore()
  const { branch, staged, working, stageFile, unstageFile, restoreFile } = useGitStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [isProj1Open, setIsProj1Open] = useState(true)
  const [isProj2Open, setIsProj2Open] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')

  // 过滤分支列表
  const filteredSessions = INITIAL_SESSIONS.filter((sess) => {
    const matchTag = selectedTag === 'all' || sess.tag === selectedTag
    const matchSearch =
      !searchQuery ||
      sess.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sess.tag.toLowerCase().includes(searchQuery.toLowerCase())
    return matchTag && matchSearch
  })

  // 如果当前是使用量大盘且无侧边栏需要，可以保持紧凑或显示
  if (activityTab === 'usage') {
    return null
  }

  return (
    <aside className="w-[260px] min-w-[220px] max-w-[380px] bg-[#F4EFEA] border-r border-black/[0.08] flex flex-col transition-all duration-200 shrink-0 select-none overflow-hidden">
      {/* 视图 1：会话分支抽屉 (Chat Sessions) */}
      {activityTab === 'chat' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 顶栏 */}
          <div className="p-3 border-b border-black/[0.06] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#18181B] tracking-tight">会话分支</span>
              <span className="text-[10px] text-[#71717A] bg-black/[0.04] px-1.5 py-0.2 rounded-full font-mono font-bold">
                {filteredSessions.length} 个场景分支
              </span>
            </div>
            <button
              title="打开新项目目录"
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[#18181B] bg-white hover:bg-black/[0.04] border border-black/[0.08] shadow-2xs transition-all cursor-pointer"
            >
              <FolderOpen size={12} className="text-[#D96B27]" />
              <span>打开项目</span>
            </button>
          </div>

          {/* 搜索与标签过滤 */}
          <div className="p-2.5 space-y-2 border-b border-black/[0.06] shrink-0">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索分支或标签..."
                className="w-full h-7 pl-7 pr-2 rounded-lg bg-white text-xs border border-black/[0.08] focus:border-[#D96B27] focus:outline-none placeholder:text-[#A1A1AA] transition-all"
              />
              <Search size={13} className="text-[#A1A1AA] absolute left-2 top-1.5" />
            </div>

            {/* 标签过滤胶囊 */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 text-[10px]">
              <button
                onClick={() => setSelectedTag('all')}
                className={`px-2 py-0.5 rounded-full font-medium transition-all cursor-pointer ${
                  selectedTag === 'all'
                    ? 'bg-[#D96B27] text-white'
                    : 'bg-white text-[#71717A] hover:text-[#18181B] border border-black/[0.06]'
                }`}
              >
                全部 ({INITIAL_SESSIONS.length})
              </button>
              {['核心架构', '单测自愈', '网关调度', '安全防护', '前端开发'].map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-2 py-0.5 rounded-full font-medium transition-all cursor-pointer whitespace-nowrap ${
                    selectedTag === tag
                      ? 'bg-[#D96B27] text-white'
                      : 'bg-white text-[#71717A] hover:text-[#18181B] border border-black/[0.06]'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          {/* 会话分支树 */}
          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            {/* 工程 1: agent-learning */}
            <div className="rounded-xl border border-black/[0.08] bg-white/70 shadow-2xs overflow-hidden">
              <div
                onClick={() => setIsProj1Open(!isProj1Open)}
                className="p-2 flex items-center justify-between hover:bg-black/[0.02] cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {isProj1Open ? (
                    <ChevronDown size={13} className="text-[#71717A]" />
                  ) : (
                    <ChevronRight size={13} className="text-[#71717A]" />
                  )}
                  <FolderOpen size={13} className="text-[#D96B27] shrink-0" />
                  <span className="text-xs font-semibold text-[#18181B] truncate">agent-learning</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                  }}
                  title="新建分支"
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black/[0.06] text-[#71717A] hover:text-[#D96B27] transition-all"
                >
                  <Plus size={12} />
                </button>
              </div>

              {isProj1Open && (
                <div className="p-1 space-y-1 border-t border-black/[0.04] bg-[#FAF8F5]">
                  {filteredSessions.map((sess) => {
                    const isActive = sess.id === activeSessionId
                    return (
                      <div
                        key={sess.id}
                        onClick={() => setActiveSessionId(sess.id)}
                        className={`p-2 rounded-lg transition-all flex flex-col gap-1 cursor-pointer ${
                          isActive
                            ? 'bg-white border border-[#D96B27]/40 shadow-xs'
                            : 'hover:bg-white/80 border border-transparent hover:border-black/[0.06]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs">{sess.icon}</span>
                            <span
                              className={`text-xs truncate ${
                                isActive
                                  ? 'font-semibold text-[#18181B]'
                                  : 'font-medium text-[#52525B]'
                              }`}
                            >
                              {sess.title}
                            </span>
                          </div>
                          <span
                            className={`text-[9px] font-mono ${
                              isActive ? 'text-[#10A37F] font-medium' : 'text-[#A1A1AA]'
                            }`}
                          >
                            {sess.timeAgo}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-[#71717A]">
                          <span className={`px-1 py-0.2 rounded font-medium ${sess.tagColor}`}>
                            #{sess.tag}
                          </span>
                          <span>· {sess.desc}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 工程 2: sub2api (已关联) */}
            <div className="rounded-xl border border-black/[0.08] bg-white/70 shadow-2xs overflow-hidden opacity-90">
              <div
                onClick={() => setIsProj2Open(!isProj2Open)}
                className="p-2 flex items-center justify-between hover:bg-black/[0.02] cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {isProj2Open ? (
                    <ChevronDown size={13} className="text-[#71717A]" />
                  ) : (
                    <ChevronRight size={13} className="text-[#71717A]" />
                  )}
                  <FolderOpen size={13} className="text-[#D96B27] shrink-0" />
                  <span className="text-xs font-medium text-[#27272A] truncate">sub2api</span>
                </div>
                <span className="text-[10px] text-[#71717A] bg-black/[0.04] px-1.5 py-0.2 rounded">
                  已关联
                </span>
              </div>
              {isProj2Open && (
                <div className="p-1 space-y-1 border-t border-black/[0.04] bg-[#FAF8F5]">
                  <div className="p-2 rounded-lg text-xs text-[#52525B] hover:bg-white/80 cursor-pointer">
                    💬 多厂商认证池调度架构
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 视图 2：工程文件资源管理器 (Files Explorer) */}
      {activityTab === 'files' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <FileTree />
        </div>
      )}

      {/* 视图 3：Git 源代码管理抽屉 (Git Control) */}
      {activityTab === 'git' && (
        <div className="flex-1 flex flex-col overflow-hidden select-none">
          {/* Git 抽屉顶栏 */}
          <div className="p-2.5 border-b border-black/[0.06] bg-[#EFEAE4] space-y-2 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#18181B] flex items-center gap-1.5">
                <span>🌿</span>
                <span>Git 源代码管理</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => useGitStore.getState().setSnapshotModalOpen(true)}
                  title="微内核影子快照与安全回退中心"
                  className="p-1 rounded text-[#71717A] hover:text-[#D96B27] hover:bg-black/[0.05] transition-all cursor-pointer"
                >
                  <span className="text-xs">🛡️</span>
                </button>
                <button
                  onClick={() => useGitStore.getState().fetchStatus()}
                  title="刷新 Git 状态"
                  className="p-1 rounded text-[#71717A] hover:text-[#18181B] hover:bg-black/[0.05] transition-all cursor-pointer"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>

            {/* 当前分支胶囊按钮 (点击弹出分支管理模态窗) */}
            <div
              onClick={() => useGitStore.getState().setBranchModalOpen(true)}
              title="切换分支或检出新分支"
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white hover:border-[#D96B27]/50 border border-black/[0.08] shadow-2xs text-xs cursor-pointer transition-all group"
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-[#D96B27]">🌿</span>
                <span className="font-mono font-semibold text-[#18181B] truncate group-hover:text-[#D96B27] transition-colors">
                  {branch}
                </span>
                <span className="text-[10px] text-[#10A37F] bg-[#10A37F]/10 px-1 py-0.2 rounded font-sans">
                  已跟踪
                </span>
              </div>
              <span className="text-[10px] text-[#71717A] group-hover:text-[#18181B]">切换 ▾</span>
            </div>
          </div>

          {/* 提交输入面板 */}
          <div className="p-2.5 border-b border-black/[0.06] bg-[#FAF8F5] space-y-2 shrink-0">
            <div className="relative">
              <textarea
                rows={2}
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="提交信息 (Ctrl+Enter 提交)..."
                className="w-full p-2 text-xs text-[#18181B] placeholder:text-[#A1A1AA] bg-white rounded-lg border border-black/[0.08] focus:outline-none focus:border-[#D96B27] resize-none leading-relaxed font-mono"
              />
              <button
                onClick={() => setCommitMessage('feat(core): align UI architecture with web_prototype')}
                title="AI 提炼代码 Diff 并生成规范说明"
                className="absolute right-2 bottom-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#FAF8F5] hover:bg-[#D96B27]/10 text-[#71717A] hover:text-[#D96B27] border border-black/[0.06] flex items-center gap-1 transition-all cursor-pointer"
              >
                <span>🪄</span>
                <span className="text-[9px]">AI 提炼</span>
              </button>
            </div>

            <button
              onClick={() => {
                if (commitMessage) {
                  alert('正在提交: ' + commitMessage)
                }
              }}
              className="w-full py-1.5 rounded-lg bg-[#18181B] hover:bg-[#D96B27] text-white text-xs font-medium flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Check size={12} strokeWidth={3} />
              <span>✓ 提交更改</span>
            </button>
          </div>

          {/* 文件变动列表：已暂存 vs 未暂存 */}
          <div className="flex-1 overflow-y-auto p-2 text-xs space-y-3">
            {/* 已暂存 (Staged) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-1 text-[11px] text-[#71717A] font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px]">▼</span>
                  <span>已暂存更改</span>
                  <span className="text-[10px] font-mono px-1 rounded-full bg-black/[0.05] text-[#52525B]">
                    {staged.length}
                  </span>
                </div>
              </div>
              {staged.length === 0 ? (
                <div className="text-[11px] text-[#A1A1AA] px-2 py-1">暂无已暂存改动</div>
              ) : (
                staged.map((f) => (
                  <div
                    key={f.path}
                    className="flex items-center justify-between p-1.5 rounded hover:bg-white bg-white/40 border border-black/[0.04] text-[11px] font-mono"
                  >
                    <span className="truncate text-[#18181B]">{f.path}</span>
                    <button
                      onClick={() => unstageFile(f.path)}
                      title="取消暂存"
                      className="p-0.5 text-[#71717A] hover:text-[#D96B27] hover:bg-black/[0.05] rounded"
                    >
                      -
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* 未暂存 (Working Changes) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-1 text-[11px] text-[#71717A] font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px]">▼</span>
                  <span>工作区更改</span>
                  <span className="text-[10px] font-mono px-1 rounded-full bg-black/[0.05] text-[#52525B]">
                    {working.length}
                  </span>
                </div>
              </div>
              {working.length === 0 ? (
                <div className="text-[11px] text-[#A1A1AA] px-2 py-1">工作区干净，无未暂存文件</div>
              ) : (
                working.map((f) => (
                  <div
                    key={f.path}
                    className="flex items-center justify-between p-1.5 rounded hover:bg-white bg-white/40 border border-black/[0.04] text-[11px] font-mono"
                  >
                    <span className="truncate text-[#18181B]">{f.path}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => restoreFile(f.path)}
                        title="放弃此更改"
                        className="p-0.5 text-[#71717A] hover:text-[#E04B4B] hover:bg-black/[0.05] rounded"
                      >
                        <RotateCcw size={11} />
                      </button>
                      <button
                        onClick={() => stageFile(f.path)}
                        title="暂存此文件"
                        className="p-0.5 text-[#71717A] hover:text-[#10A37F] hover:bg-black/[0.05] rounded"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 视图 4：MCP 协议与工具库抽屉 */}
      {activityTab === 'mcp' && (
        <div className="flex-1 flex flex-col p-3 space-y-3 overflow-y-auto text-xs">
          <div className="flex items-center justify-between border-b border-black/[0.06] pb-2">
            <span className="font-bold text-[#18181B] flex items-center gap-1.5">
              <Boxes size={14} className="text-[#D96B27]" />
              <span>MCP 服务中枢 (Model Context)</span>
            </span>
            <span className="text-[10px] bg-[#10A37F]/10 text-[#10A37F] px-1.5 py-0.5 rounded font-mono">
              3 个服务挂载
            </span>
          </div>

          <div className="space-y-2">
            <div className="p-2.5 rounded-xl bg-white border border-black/[0.08] shadow-2xs space-y-1">
              <div className="flex items-center justify-between font-semibold text-[#18181B]">
                <span>filesystem-mcp</span>
                <span className="text-[9px] text-[#10A37F]">已连接</span>
              </div>
              <p className="text-[11px] text-[#71717A]">工作区原子受控读写与快照安全拦截</p>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-black/[0.08] shadow-2xs space-y-1">
              <div className="flex items-center justify-between font-semibold text-[#18181B]">
                <span>git-control-mcp</span>
                <span className="text-[9px] text-[#10A37F]">已连接</span>
              </div>
              <p className="text-[11px] text-[#71717A]">底层 Git Plumbing 管道孤立快照与暂存</p>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-black/[0.08] shadow-2xs space-y-1">
              <div className="flex items-center justify-between font-semibold text-[#18181B]">
                <span>terminal-silent-mcp</span>
                <span className="text-[9px] text-[#10A37F]">已连接</span>
              </div>
              <p className="text-[11px] text-[#71717A]">Windows CREATE_NO_WINDOW 零弹窗 Shell 管道</p>
            </div>
          </div>
        </div>
      )}

      {/* 抽屉底栏：当前项目路径 */}
      <div className="p-2.5 border-t border-black/[0.06] bg-[#EFEAE4] flex items-center justify-between text-[11px] text-[#71717A] shrink-0">
        <div className="flex items-center gap-1.5 truncate">
          <span className="w-2 h-2 rounded-full bg-[#10A37F]" />
          <span className="truncate font-mono">agent-learning</span>
        </div>
      </div>
    </aside>
  )
}
