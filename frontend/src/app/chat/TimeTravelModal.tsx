import React, { useState, useEffect } from 'react'
import { X, GitFork, History, Check } from 'lucide-react'
import { useChatStore } from '../../core/store/chatStore'
import { useWorkspaceStore } from '../../core/store/workspaceStore'

interface TimeTravelModalProps {
  isOpen: boolean
  mode: 'fork' | 'revert'
  targetMessageId: string
  onClose: () => void
}

export const TimeTravelModal: React.FC<TimeTravelModalProps> = ({
  isOpen,
  mode,
  targetMessageId,
  onClose,
}) => {
  const { messages, forkSessionFromMessage, revertToMessage } = useChatStore()
  const { sessions, activeSessionId } = useWorkspaceStore()
  const currentSession = sessions.find((s) => s.id === activeSessionId)

  const targetIndex = messages.findIndex((m) => m.id === targetMessageId)
  const slicedCount = targetIndex >= 0 ? targetIndex + 1 : 0

  const [branchTitle, setBranchTitle] = useState('')

  useEffect(() => {
    if (isOpen) {
      const base = currentSession?.title || '架构探索'
      setBranchTitle(`${base} (分支 #${sessions.length + 1})`)
    }
  }, [isOpen, currentSession, sessions.length])

  // 全局 Esc 快捷键退出
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleConfirm = () => {
    if (mode === 'fork') {
      forkSessionFromMessage(targetMessageId, branchTitle.trim() || undefined)
    } else {
      revertToMessage(targetMessageId)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-150">
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-[#FAF8F5] rounded-2xl border border-black/[0.08] shadow-2xl overflow-hidden flex flex-col"
      >
        {/* 标题栏 */}
        <div className="px-5 py-3.5 border-b border-black/[0.06] bg-[#F4EFEA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode === 'fork' ? (
              <GitFork size={17} className="text-[#D96B27]" />
            ) : (
              <History size={17} className="text-[#D96B27]" />
            )}
            <span className="font-bold text-sm text-[#18181B]">
              {mode === 'fork' ? '会话分支分叉 (Session Fork)' : '时光倒流回退 (Time-Travel)'}
            </span>
          </div>
          <button
            onClick={onClose}
            title="关闭 (Esc)"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#71717A] hover:text-[#18181B] hover:bg-black/[0.05] transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-5 space-y-4 text-xs text-[#52525B] leading-relaxed">
          {mode === 'fork' ? (
            <>
              <p>
                将以此消息节点为基准点，完整截取前序 <strong className="text-[#18181B]">{slicedCount} 条历史消息</strong> 作为独立初始上下文，开辟全新的平行代码探索分支。
              </p>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#18181B]">新分支名称：</label>
                <input
                  type="text"
                  value={branchTitle}
                  onChange={(e) => setBranchTitle(e.target.value)}
                  placeholder="请输入新分支会话名称..."
                  className="w-full px-3 py-2 bg-white border border-black/[0.1] rounded-xl text-xs text-[#18181B] focus:outline-none focus:border-[#D96B27] font-medium"
                />
              </div>

              <div className="p-3 bg-white/60 border border-black/[0.06] rounded-xl text-[11px] text-[#71717A] space-y-1">
                <div className="font-semibold text-[#18181B]">💡 隔离防污染说明：</div>
                <p>分叉后新旧分支完全解耦，您可随时在左侧抽屉切换，原会话历史不受任何影响。</p>
              </div>
            </>
          ) : (
            <>
              <p>
                确定要将当前会话回退至该节点吗？本轮对话之后的 <strong className="text-[#E04B4B]">{messages.length - slicedCount} 条后续探索</strong> 将被截除，避免干扰后续规划。
              </p>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-900 space-y-1">
                <div className="font-semibold flex items-center gap-1">
                  <span>⚠️</span>
                  <span>注意：</span>
                </div>
                <p>时光倒流将永久截断当前会话此节点之后的对话记录。若想保留当前方案，推荐先使用「分叉新分支」。</p>
              </div>
            </>
          )}
        </div>

        {/* 底栏操作 */}
        <div className="px-5 py-3 border-t border-black/[0.06] bg-[#F4EFEA] flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl border border-black/[0.08] hover:bg-black/[0.04] text-[#52525B] text-xs font-medium transition-colors cursor-pointer"
          >
            取消 (Esc)
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-1.5 rounded-xl bg-[#18181B] hover:bg-[#D96B27] text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
          >
            <Check size={13} strokeWidth={2.5} />
            <span>{mode === 'fork' ? '确认分叉并切换' : '确认时光倒流'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
