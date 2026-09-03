import React, { useState, useEffect } from 'react'
import { X, GitBranch, Search, Plus } from 'lucide-react'
import { useGitStore } from '../../core/store/gitStore'

export const GitBranchModal: React.FC = () => {
  const {
    branch,
    branches,
    isBranchModalOpen,
    setBranchModalOpen,
    checkoutBranch,
    createBranch,
  } = useGitStore()

  const [filterText, setFilterText] = useState('')
  const [newBranchName, setNewBranchName] = useState('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isBranchModalOpen) {
        setBranchModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isBranchModalOpen, setBranchModalOpen])

  if (!isBranchModalOpen) return null

  const filteredBranches = branches.filter((b) =>
    b.name.toLowerCase().includes(filterText.toLowerCase().trim())
  )

  const handleCreate = () => {
    const trimmed = newBranchName.trim()
    if (!trimmed) return
    createBranch(trimmed)
    setNewBranchName('')
  }

  return (
    <div
      onClick={() => setBranchModalOpen(false)}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[520px] max-h-[85vh] bg-[#FAF8F5] rounded-xl border border-[#EADFD7] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* 顶栏 */}
        <div className="h-12 bg-[#F4EFEA] border-b border-[#EADFD7] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <GitBranch size={16} className="text-[#D96B27]" />
            <span className="text-sm font-semibold text-[#2C2825]">分支管理与检出 (Git Branches)</span>
            <span className="text-[10px] text-[#10A37F] bg-[#10A37F]/10 px-2 py-0.5 rounded-full font-mono font-medium">
              当前: {branch}
            </span>
          </div>
          <button
            onClick={() => setBranchModalOpen(false)}
            title="关闭 (Esc)"
            className="p-1.5 text-[#7A726B] hover:text-[#E04B4B] rounded-lg transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* 主体内容 */}
        <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh] text-xs">
          {/* 新建分支区域 */}
          <div className="p-3 rounded-xl bg-white border border-black/[0.08] shadow-2xs space-y-2">
            <div className="font-semibold text-[#18181B] text-xs flex items-center gap-1.5">
              <Plus size={13} className="text-[#D96B27]" />
              <span>基于当前分支新建 (git checkout -b)</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="输入新分支名 (例如: feature/terminal-canvas)..."
                className="flex-1 h-8 px-2.5 rounded-lg bg-[#FAF8F5] border border-black/[0.08] text-xs font-mono text-[#18181B] focus:outline-none focus:border-[#D96B27] placeholder:text-[#A1A1AA]"
              />
              <button
                onClick={handleCreate}
                disabled={!newBranchName.trim()}
                className="px-3 h-8 bg-[#18181B] hover:bg-[#D96B27] disabled:bg-gray-300 text-white text-xs font-medium rounded-lg shadow-2xs transition-colors cursor-pointer shrink-0"
              >
                创建并检出
              </button>
            </div>
          </div>

          {/* 搜索框 */}
          <div className="relative">
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="搜索本地或远程分支..."
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-white border border-black/[0.08] text-xs font-mono text-[#18181B] focus:outline-none focus:border-[#D96B27] placeholder:text-[#A1A1AA]"
            />
            <Search size={13} className="text-[#A1A1AA] absolute left-2.5 top-2.5" />
          </div>

          {/* 分支列表 */}
          <div className="space-y-1.5 pt-1">
            {filteredBranches.length === 0 ? (
              <div className="p-4 text-center text-[#A1A1AA] italic">未匹配到任何分支</div>
            ) : (
              filteredBranches.map((b) => {
                const isCur = b.name === branch
                return (
                  <div
                    key={b.name}
                    onClick={() => !isCur && checkoutBranch(b.name)}
                    className={`p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                      isCur
                        ? 'bg-white border-[#D96B27] shadow-xs ring-2 ring-[#D96B27]/10 font-semibold'
                        : 'bg-white/80 border-black/[0.06] hover:bg-white hover:border-black/[0.15]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={isCur ? 'text-[#D96B27]' : 'text-[#71717A]'}>
                        {b.isRemote ? '🌐' : '🌿'}
                      </span>
                      <div className="truncate">
                        <div className="font-mono text-xs text-[#18181B] truncate flex items-center gap-1.5">
                          <span>{b.name}</span>
                          {isCur && (
                            <span className="text-[9px] text-[#10A37F] bg-[#10A37F]/15 px-1.5 py-0.2 rounded-full font-sans font-bold">
                              当前活跃
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#A1A1AA] truncate font-mono mt-0.5">
                          {b.hash} · {b.lastCommit}
                        </div>
                      </div>
                    </div>

                    {!isCur && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          checkoutBranch(b.name)
                        }}
                        className="text-[10px] text-[#52525B] hover:text-[#18181B] bg-[#FAF8F5] hover:bg-black/[0.05] border border-black/[0.06] px-2.5 py-1 rounded-md transition-all cursor-pointer"
                      >
                        切换
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* 底栏 */}
        <div className="h-10 bg-[#F4EFEA] border-t border-[#EADFD7] px-4 flex items-center justify-between text-[11px] text-[#71717A] shrink-0">
          <span>共 {branches.length} 个本地与远程分支</span>
          <span>按 Esc 键或点击外部可快速关闭</span>
        </div>
      </div>
    </div>
  )
}
