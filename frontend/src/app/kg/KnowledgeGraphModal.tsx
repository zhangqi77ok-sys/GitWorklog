import React, { useState, useEffect } from 'react'
import { X, Network, FileCode, Shield } from 'lucide-react'
import { useWorkspaceStore } from '../../core/store/workspaceStore'

interface KGEntity {
  key: string
  icon: string
  title: string
  type: string
  desc: string
  files: { name: string; role: string }[]
  rules: string[]
}

const KG_DATA: KGEntity[] = [
  {
    key: 'wails_host',
    icon: '🏛️',
    title: 'Wails / 原生宿主层',
    type: '架构核心分层 (Core Layer)',
    desc: '负责托管基于 Edge WebView2 的无边框桌面窗体，通过 Go 原生运行时 API 管理窗口阴影、缩放与生命周期。',
    files: [
      { name: 'backend/cmd/tcode-daemon/main.go', role: '绑定入口' },
      { name: 'backend/internal/transport/http/server.go', role: '微内核服务端' },
    ],
    rules: [
      '所有宿主方法通过强类型 API 暴露；',
      '高危操作系统指令必须受物理沙箱阻断。',
    ],
  },
  {
    key: 'go_engine',
    icon: '⚡',
    title: 'Go / 业务调度核心 (ReAct Engine)',
    type: '执行引擎 (Runtime Engine)',
    desc: '由 Go 强类型实现的自主 Agent 执行核心，包含 ReAct 模式多轮自愈循环、自动化构建测试调度与 Git 补丁生成器。',
    files: [
      { name: 'backend/internal/core/loop/engine.go', role: '自主执行状态机' },
      { name: 'backend/internal/core/sandbox/fs.go', role: '物理受控沙箱' },
    ],
    rules: [
      '并发调用使用 context.WithTimeout 严格约束防止挂死；',
      '限制单任务 15 步防死循环熔断。',
    ],
  },
  {
    key: 'sub2api_gw',
    icon: '🌐',
    title: '网关认证与穿透池 (Gateway Pool)',
    type: '路由与凭据中枢 (Gateway & Auth)',
    desc: '承载 Anthropic OAuth、OpenAI 兼容协议、自适应 WAF 客户端指纹穿透，实现毫秒级自动探活。',
    files: [
      { name: 'backend/plugins/provider/openai/openai_provider.go', role: '网关驱动' },
      { name: 'backend/daemon.js', role: '本地轻量网关' },
    ],
    rules: [
      '上游遇限流静默自动尝试备选模型；',
      '严格支持 AgentRouter 客户端指纹透传。',
    ],
  },
  {
    key: 'adr_git',
    icon: '📜',
    title: 'ADR-002: Git Plumbing 秒级快照机制',
    type: '架构决策记录 (ADR)',
    desc: '放弃传统 git commit 污染当前分支的做法，通过 git write-tree 与 commit-tree 在 refs/tcode/snapshots/ 命名空间毫秒级生成孤立快照。',
    files: [
      { name: 'backend/internal/core/sandbox/snapshot.go', role: '底层快照管道' },
    ],
    rules: [
      'Agent 修改文件前 5ms 自动建立安全锚点；',
      '支持单文件秒级无损回退。',
    ],
  },
]

export const KnowledgeGraphModal: React.FC = () => {
  const { isKgModalOpen, setKgModalOpen } = useWorkspaceStore()
  const [selectedKey, setSelectedKey] = useState<string>('wails_host')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isKgModalOpen) {
        setKgModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isKgModalOpen, setKgModalOpen])

  if (!isKgModalOpen) return null

  const selected: KGEntity = KG_DATA.find((k) => k.key === selectedKey) || (KG_DATA[0] as KGEntity)

  return (
    <div
      onClick={() => setKgModalOpen(false)}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[720px] max-h-[85vh] bg-[#FAF8F5] rounded-xl border border-[#EADFD7] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* 顶栏 */}
        <div className="h-12 bg-[#F4EFEA] border-b border-[#EADFD7] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Network size={16} className="text-[#D96B27]" />
            <span className="text-sm font-semibold text-[#2C2825]">项目知识图谱与架构决策 (ADR)</span>
          </div>
          <button
            onClick={() => setKgModalOpen(false)}
            title="关闭 (Esc)"
            className="p-1.5 text-[#7A726B] hover:text-[#E04B4B] rounded-lg transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* 双栏主体：左侧实体列表，右侧实体规约详情 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧实体节点卡片列表 */}
          <div className="w-[280px] border-r border-[#EADFD7] p-3 space-y-2 overflow-y-auto bg-[#F4EFEA]/60 shrink-0">
            {KG_DATA.map((item) => {
              const isSelected = item.key === selectedKey
              return (
                <div
                  key={item.key}
                  onClick={() => setSelectedKey(item.key)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white border-[#D96B27] shadow-xs ring-2 ring-[#D96B27]/20'
                      : 'bg-white/80 border-black/[0.06] hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{item.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#18181B] truncate">{item.title}</div>
                      <div className="text-[10px] text-[#71717A] truncate">{item.type}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 右侧详情展板 */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{selected.icon}</span>
                <div>
                  <h3 className="text-sm font-bold text-[#18181B]">{selected.title}</h3>
                  <span className="text-[11px] text-[#D96B27] font-medium">{selected.type}</span>
                </div>
              </div>
              <p className="text-[#52525B] leading-relaxed pt-2 text-[11px]">{selected.desc}</p>
            </div>

            {/* 关联文件 */}
            <div className="space-y-1.5">
              <div className="font-bold text-[#18181B] text-[11px] flex items-center gap-1.5">
                <FileCode size={13} className="text-[#71717A]" />
                <span>受约束的核心代码文件:</span>
              </div>
              <div className="space-y-1">
                {selected.files.map((f) => (
                  <div
                    key={f.name}
                    className="p-2 rounded-lg bg-white border border-black/[0.06] flex items-center justify-between text-[11px] font-mono"
                  >
                    <span className="text-[#18181B]">{f.name}</span>
                    <span className="text-[#D96B27] text-[10px]">{f.role}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 架构铁律与规约 */}
            <div className="space-y-1.5">
              <div className="font-bold text-[#18181B] text-[11px] flex items-center gap-1.5">
                <Shield size={13} className="text-[#10A37F]" />
                <span>架构铁律与合规要求:</span>
              </div>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-[#52525B]">
                {selected.rules.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* 底栏 */}
        <div className="h-12 bg-[#F4EFEA] border-t border-[#EADFD7] px-4 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-[#71717A]">
            已加载 4 项核心拓扑实体 · 架构约束强制生效中
          </span>
          <button
            onClick={() => setKgModalOpen(false)}
            className="px-4 py-1.5 bg-[#18181B] text-white text-xs font-semibold rounded-lg hover:bg-[#D96B27] transition-colors"
          >
            完成查阅
          </button>
        </div>
      </div>
    </div>
  )
}
