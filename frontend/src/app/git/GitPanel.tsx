import React, { useEffect, useState } from 'react'
import { Plus, Minus, RotateCcw, Check, Sparkles, GitBranch, RefreshCw } from 'lucide-react'
import { useGitStore } from '../../core/store/gitStore'

export const GitPanel: React.FC = () => {
  const { branch, staged, working, isLoading, fetchStatus, stageFile, unstageFile, restoreFile } = useGitStore()
  const [commitMsg, setCommitMsg] = useState('')

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const totalChanges = staged.length + working.length

  return (
    <div className="w-72 bg-[#F4EFEA] border-r border-[#EADFD7] flex flex-col h-full select-none shrink-0">
      {/* 顶栏与分支 */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#EADFD7]">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2C2825]">
          <GitBranch size={14} className="text-[#D96B27]" />
          <span>{branch}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-[#7A726B] bg-[#EAE2DA] px-1.5 py-0.5 rounded font-mono">
            {totalChanges} files
          </span>
          <button
            onClick={() => fetchStatus()}
            title="刷新 Git 状态"
            className="p-1 text-[#7A726B] hover:text-[#D96B27] rounded hover:bg-[#EADFD7] transition-colors"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 提交说明输入区 */}
      <div className="p-3 border-b border-[#EADFD7] flex flex-col gap-2 bg-white/40">
        <textarea
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          placeholder="提交说明 (按 Ctrl+Enter 提交)"
          rows={2}
          className="w-full text-xs p-2 rounded border border-[#EADFD7] bg-white resize-none focus:outline-none focus:border-[#D96B27]"
        />
        <div className="flex items-center gap-1.5">
          <button
            title="通过 AI 语义化总结暂存区变更"
            className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium text-[#D96B27] bg-[#FAF2EC] hover:bg-[#F4E3D7] border border-[#F0D5C3] py-1 rounded transition-colors"
          >
            <Sparkles size={12} />
            <span>AI 提炼说明</span>
          </button>
          <button
            disabled={staged.length === 0 || !commitMsg.trim()}
            title="提交暂存的修改"
            className="flex items-center justify-center gap-1 text-[11px] font-medium text-white bg-[#D96B27] hover:bg-[#BF5B1D] disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1 rounded transition-colors"
          >
            <Check size={12} />
            <span>提交</span>
          </button>
        </div>
      </div>

      {/* 双层暂存列表 */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-3 text-xs">
        {totalChanges === 0 ? (
          <div className="flex flex-col items-center justify-center h-36 text-[#7A726B] text-[11px] gap-1">
            <span>✓ 工作区非常干净</span>
            <span className="text-[10px] text-[#A89F96]">暂无任何未提交的修改</span>
          </div>
        ) : (
          <>
            {/* 已暂存区域 */}
            {staged.length > 0 && (
              <div>
                <div className="flex items-center justify-between text-[11px] text-[#7A726B] uppercase font-semibold px-1 mb-1">
                  <span>已暂存 (Staged)</span>
                  <span className="bg-[#EADFD7] text-[#2C2825] px-1 rounded text-[10px] font-mono">
                    {staged.length}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {staged.map((f) => (
                    <div
                      key={f.path}
                      className="flex items-center justify-between p-1.5 rounded hover:bg-[#EAE2DA] text-[#2C2825] group"
                    >
                      <span className="truncate font-mono text-[11px] flex-1 mr-2" title={f.path}>
                        <span className="text-[#52D17C] mr-1 font-bold">{f.staged_code || 'M'}</span>
                        {f.path}
                      </span>
                      <button
                        onClick={() => unstageFile(f.path)}
                        title="取消暂存"
                        className="text-[#7A726B] hover:text-[#D96B27] p-0.5"
                      >
                        <Minus size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 工作区未暂存区域 */}
            {working.length > 0 && (
              <div>
                <div className="flex items-center justify-between text-[11px] text-[#7A726B] uppercase font-semibold px-1 mb-1">
                  <span>未暂存变更 (Changes)</span>
                  <span className="bg-[#EADFD7] text-[#2C2825] px-1 rounded text-[10px] font-mono">
                    {working.length}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {working.map((f) => (
                    <div
                      key={f.path}
                      className="flex items-center justify-between p-1.5 rounded hover:bg-[#EAE2DA] text-[#2C2825] group"
                    >
                      <span className="truncate font-mono text-[11px] flex-1 mr-2" title={f.path}>
                        <span className="text-[#D96B27] mr-1 font-bold">{f.work_code || 'M'}</span>
                        {f.path}
                      </span>
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <button
                          onClick={() => restoreFile(f.path)}
                          title="放弃此文件的更改"
                          className="text-[#7A726B] hover:text-[#E04B4B] p-0.5"
                        >
                          <RotateCcw size={12} />
                        </button>
                        <button
                          onClick={() => stageFile(f.path)}
                          title="暂存此文件"
                          className="text-[#7A726B] hover:text-[#D96B27] p-0.5"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
