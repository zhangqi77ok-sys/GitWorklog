import React, { useState, useEffect } from 'react'
import { X, Shield, Archive, RotateCcw, FileDiff } from 'lucide-react'
import { useGitStore } from '../../core/store/gitStore'
import { useEditorStore } from '../../core/store/editorStore'
import { useWorkspaceStore } from '../../core/store/workspaceStore'

export const SnapshotModal: React.FC = () => {
  const {
    snapshots,
    stashes,
    isSnapshotModalOpen,
    setSnapshotModalOpen,
    rollbackSnapshot,
    popStash,
  } = useGitStore()

  const { openFile } = useEditorStore()
  const { setMode, setCodeWorkspaceOpen } = useWorkspaceStore()
  const [activeTab, setActiveTab] = useState<'snapshot' | 'stash'>('snapshot')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSnapshotModalOpen) {
        setSnapshotModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSnapshotModalOpen, setSnapshotModalOpen])

  if (!isSnapshotModalOpen) return null

  return (
    <div
      onClick={() => setSnapshotModalOpen(false)}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[620px] max-h-[85vh] bg-[#FAF8F5] rounded-xl border border-[#EADFD7] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* 顶栏 */}
        <div className="h-12 bg-[#F4EFEA] border-b border-[#EADFD7] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-[#D96B27]" />
            <span className="text-sm font-semibold text-[#2C2825]">
              微内核安全防护与快照恢复中心
            </span>
          </div>
          <button
            onClick={() => setSnapshotModalOpen(false)}
            title="关闭 (Esc)"
            className="p-1.5 text-[#7A726B] hover:text-[#E04B4B] rounded-lg transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tab 切换栏 */}
        <div className="flex items-center px-4 pt-2 border-b border-[#EADFD7] bg-[#FAF8F5] text-xs font-medium">
          <button
            onClick={() => setActiveTab('snapshot')}
            className={`px-3 py-2 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'snapshot'
                ? 'border-[#D96B27] text-[#D96B27] font-semibold'
                : 'border-transparent text-[#71717A] hover:text-[#18181B]'
            }`}
          >
            <Shield size={13} />
            <span>🛡️ 影子快照 (Shadow Snapshots)</span>
            <span className="text-[10px] bg-black/[0.05] px-1.5 py-0.2 rounded-full font-mono">
              {snapshots.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('stash')}
            className={`px-3 py-2 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'stash'
                ? 'border-[#D96B27] text-[#D96B27] font-semibold'
                : 'border-transparent text-[#71717A] hover:text-[#18181B]'
            }`}
          >
            <Archive size={13} />
            <span>📦 Git Stash 储藏栈</span>
            <span className="text-[10px] bg-black/[0.05] px-1.5 py-0.2 rounded-full font-mono">
              {stashes.length}
            </span>
          </button>
        </div>

        {/* 列表内容区 */}
        <div className="p-4 space-y-2.5 overflow-y-auto max-h-[55vh] text-xs">
          {activeTab === 'snapshot' && (
            <div className="space-y-2">
              <div className="p-2.5 rounded-lg bg-white border border-[#D96B27]/20 text-[11px] text-[#52525B] leading-relaxed">
                💡 <strong>微内核物理防护机制</strong>：Agent 在修改任何文件前 5ms，系统自动在本地建立轻量 Git 快照锚点。发生任何预期外修改，均可随时一键秒级无损回退。
              </div>

              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="p-3 rounded-xl bg-white border border-black/[0.08] shadow-2xs hover:border-[#D96B27]/40 flex items-center justify-between transition-all"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#18181B]">{snap.id}</span>
                      <span className="text-[10px] text-[#A1A1AA] font-mono">{snap.time}</span>
                      <span className="font-mono text-[10px] bg-black/[0.04] px-1.5 py-0.2 rounded text-[#27272A]">
                        {snap.file}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#71717A] mt-1">{snap.desc}</div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        setSnapshotModalOpen(false)
                        setMode('split')
                        setCodeWorkspaceOpen(true)
                        openFile(snap.file, true)
                      }}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium text-[#52525B] hover:text-[#18181B] bg-[#FAF8F5] hover:bg-black/[0.05] border border-black/[0.06] flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <FileDiff size={12} />
                      <span>Diff 比对</span>
                    </button>

                    <button
                      onClick={() => rollbackSnapshot(snap.id)}
                      className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-white bg-[#D96B27] hover:bg-[#B8551B] shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <RotateCcw size={11} strokeWidth={2.5} />
                      <span>一键秒级恢复</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'stash' && (
            <div className="space-y-2">
              {stashes.length === 0 ? (
                <div className="p-6 text-center text-[#A1A1AA] italic">当前 Stash 栈为空</div>
              ) : (
                stashes.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-xl bg-white border border-black/[0.08] shadow-2xs hover:border-[#D96B27]/40 flex items-center justify-between transition-all"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#18181B]">{s.id}</span>
                        <span className="text-[10px] text-[#A1A1AA] font-mono">{s.time}</span>
                        <span className="text-[10px] text-[#10A37F] bg-[#10A37F]/10 px-1.5 py-0.2 rounded font-mono">
                          {s.branch}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#71717A] mt-1">{s.desc}</div>
                    </div>

                    <button
                      onClick={() => popStash(s.id)}
                      className="px-3 py-1 rounded-md text-[11px] font-semibold text-white bg-[#18181B] hover:bg-[#D96B27] shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <span>Pop 恢复</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* 底栏 */}
        <div className="h-10 bg-[#F4EFEA] border-t border-[#EADFD7] px-4 flex items-center justify-between text-[11px] text-[#71717A] shrink-0">
          <span>Refs: .git/refs/tcode/snapshots/ 物理隔离</span>
          <span>按 Esc 键或点击外部可快速关闭</span>
        </div>
      </div>
    </div>
  )
}
