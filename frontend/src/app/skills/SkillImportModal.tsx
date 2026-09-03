import React, { useState, useEffect } from 'react'
import { X, Wrench, Upload, Edit3, Globe, Check } from 'lucide-react'
import { useWorkspaceStore } from '../../core/store/workspaceStore'

export const SkillImportModal: React.FC = () => {
  const { isSkillModalOpen, setSkillModalOpen } = useWorkspaceStore()
  const [activeTab, setActiveTab] = useState<'import' | 'create' | 'market'>('import')
  const [fileContent, setFileContent] = useState('')
  const [skillId, setSkillId] = useState('')
  const [category, setCategory] = useState('质量保证 (QA & Testing)')
  const [triggerDesc, setTriggerDesc] = useState('')
  const [workflowText, setWorkflowText] = useState('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSkillModalOpen) {
        setSkillModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSkillModalOpen, setSkillModalOpen])

  if (!isSkillModalOpen) return null

  const handleFillDemoFile = () => {
    setFileContent(
      `---\nname: rust-tokio-expert\ndescription: 负责 Rust 高并发异步服务设计、Tokio 任务编排与内存安全性审查\ntriggers:\n  - on_async_design\n  - on_memory_check\n---\n\n# Rust 异步并发与微内核工程规约 (SKILL.md)\n1. 生产环境严禁 unwrap()/expect()，错误必须统一返回强类型 Result<T, E>；\n2. Windows 外部进程调用强制注入 CREATE_NO_WINDOW (0x08000000) 杜绝黑框；\n3. 严格沙箱路径规范化，任何文件写入前自动建立轻量影子 Git 快照。`
    )
  }

  const handleFillTddTemplate = () => {
    setSkillId('tdd-self-healing-flow')
    setTriggerDesc('当用户要求运行单元测试、分析失败断言或执行 TDD 红-绿循环时触发')
    setWorkflowText(
      `## TDD 自愈工作流规约 (SKILL.md)\n1. 自动化运行本地测试: npm test 或 go test -v ./...\n2. 捕获失败断言堆栈，提取受损函数签名与行号\n3. 编写使测试转绿的最小改动并进行回归验证\n4. 消除坏味道与多余分支，保持 100% 绿灯`
    )
  }

  const handleSave = () => {
    alert('✓ 专业技能工作流已成功注册并加载至智能体上下文！')
    setSkillModalOpen(false)
  }

  return (
    <div
      onClick={() => setSkillModalOpen(false)}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[660px] max-h-[85vh] bg-[#FAF8F5] rounded-xl border border-[#EADFD7] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* 顶栏 */}
        <div className="h-12 bg-[#F4EFEA] border-b border-[#EADFD7] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Wrench size={16} className="text-[#D96B27]" />
            <span className="text-sm font-semibold text-[#2C2825]">
              Agent 技能库导入与定制中心 (Skill Hub)
            </span>
          </div>
          <button
            onClick={() => setSkillModalOpen(false)}
            title="关闭 (Esc)"
            className="p-1.5 text-[#7A726B] hover:text-[#E04B4B] rounded-lg transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tab 切换条 */}
        <div className="flex items-center px-4 pt-2 border-b border-[#EADFD7] bg-[#FAF8F5] text-xs font-medium">
          <button
            onClick={() => setActiveTab('import')}
            className={`px-3 py-2 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'import'
                ? 'border-[#D96B27] text-[#D96B27] font-semibold'
                : 'border-transparent text-[#71717A] hover:text-[#18181B]'
            }`}
          >
            <Upload size={13} />
            <span>📥 导入 SKILL.md / 目录</span>
          </button>

          <button
            onClick={() => setActiveTab('create')}
            className={`px-3 py-2 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'create'
                ? 'border-[#D96B27] text-[#D96B27] font-semibold'
                : 'border-transparent text-[#71717A] hover:text-[#18181B]'
            }`}
          >
            <Edit3 size={13} />
            <span>✍️ 自定义表单录入</span>
          </button>

          <button
            onClick={() => setActiveTab('market')}
            className={`px-3 py-2 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'market'
                ? 'border-[#D96B27] text-[#D96B27] font-semibold'
                : 'border-transparent text-[#71717A] hover:text-[#18181B]'
            }`}
          >
            <Globe size={13} />
            <span>🌐 官方推荐专家库</span>
          </button>
        </div>

        {/* 内容面板 */}
        <div className="p-4 space-y-3 overflow-y-auto max-h-[55vh] text-xs">
          {activeTab === 'import' && (
            <div className="space-y-3">
              <div className="border-2 border-dashed border-black/[0.12] hover:border-[#D96B27]/60 rounded-xl p-4 bg-white text-center transition-all">
                <div className="text-2xl mb-1.5">📂</div>
                <div className="text-xs font-semibold text-[#18181B]">拖拽 SKILL.md 文件到此处</div>
                <div className="text-[11px] text-[#71717A] mt-0.5">支持标准的 YAML Frontmatter 格式 SKILL.md 规约文件</div>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <button
                    onClick={handleFillDemoFile}
                    className="px-3 py-1.5 rounded-lg bg-white border border-[#D96B27] text-xs font-medium text-[#D96B27] transition-all cursor-pointer shadow-2xs"
                  >
                    <span>⚡ 填入标准示例规约</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-[#71717A]">
                  <span>解析规约内容预览 (Markdown / Frontmatter):</span>
                  <span className="text-[10px] text-[#10A37F] font-mono">YAML 语法合法</span>
                </div>
                <textarea
                  rows={6}
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  placeholder="---\nname: your-skill-name\ndescription: 描述该专业技能的职责与自动化行为\n---\n# 详细工作流规约..."
                  className="w-full p-2.5 rounded-xl bg-white border border-black/[0.08] text-xs font-mono text-[#18181B] leading-relaxed focus:outline-none focus:border-[#D96B27] placeholder:text-[#A1A1AA]"
                />
              </div>
            </div>
          )}

          {activeTab === 'create' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">技能标识符 (Skill ID)</label>
                  <input
                    type="text"
                    value={skillId}
                    onChange={(e) => setSkillId(e.target.value)}
                    placeholder="例如: code-reviewer-pro"
                    className="w-full h-8 px-2.5 rounded-lg bg-white border border-black/[0.08] text-xs font-mono focus:outline-none focus:border-[#D96B27]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">所属领域分类</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-8 px-2 rounded-lg bg-white border border-black/[0.08] text-xs focus:outline-none focus:border-[#D96B27]"
                  >
                    <option>质量保证 (QA & Testing)</option>
                    <option>代码重构 (Refactoring)</option>
                    <option>安全审查 (Security Audit)</option>
                    <option>DevOps & CI/CD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#18181B] block mb-1">触发场景与适用条件 (When to trigger)</label>
                <input
                  type="text"
                  value={triggerDesc}
                  onChange={(e) => setTriggerDesc(e.target.value)}
                  placeholder="例如: 当用户要求运行测试、修复单测失败或执行 TDD 流程时激活"
                  className="w-full h-8 px-2.5 rounded-lg bg-white border border-black/[0.08] text-xs focus:outline-none focus:border-[#D96B27]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1 font-semibold text-[#18181B]">
                  <span>执行工作流规约 (Markdown 格式):</span>
                  <button
                    onClick={handleFillTddTemplate}
                    className="text-[#D96B27] text-[11px] font-medium hover:underline cursor-pointer"
                  >
                    载入经典 TDD 规约模板
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={workflowText}
                  onChange={(e) => setWorkflowText(e.target.value)}
                  placeholder="## Workflow Steps:\n1. 分析错误日志堆栈\n2. 定位受影响代码行\n3. 生成局部补丁并运行验证\n4. 修复直至所有断言通过"
                  className="w-full p-2.5 rounded-xl bg-white border border-black/[0.08] text-xs font-mono text-[#18181B] leading-relaxed focus:outline-none focus:border-[#D96B27] placeholder:text-[#A1A1AA]"
                />
              </div>
            </div>
          )}

          {activeTab === 'market' && (
            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-white border border-black/[0.08] shadow-2xs flex items-center justify-between">
                <div className="space-y-0.5 max-w-[440px]">
                  <div className="font-bold text-[#18181B] flex items-center gap-1.5">
                    <span>🦀</span>
                    <span>rust-core-engineer</span>
                    <span className="text-[9px] text-[#D96B27] bg-[#D96B27]/10 px-1 py-0.2 rounded font-mono font-bold">官方核心</span>
                  </div>
                  <p className="text-[11px] text-[#71717A]">
                    Safe Rust 内存安全、零 unwrap/expect、CREATE_NO_WINDOW 进程约束与影子快照保护。
                  </p>
                </div>
                <button
                  onClick={() => {
                    handleFillDemoFile()
                    setActiveTab('import')
                  }}
                  className="px-3 py-1 rounded-lg bg-[#FAF8F5] hover:bg-[#D96B27] hover:text-white text-[#D96B27] border border-[#D96B27]/30 text-xs font-semibold transition-all cursor-pointer"
                >
                  一键载入
                </button>
              </div>

              <div className="p-3 rounded-xl bg-white border border-black/[0.08] shadow-2xs flex items-center justify-between">
                <div className="space-y-0.5 max-w-[440px]">
                  <div className="font-bold text-[#18181B] flex items-center gap-1.5">
                    <span>🎨</span>
                    <span>ui-ux-pro-max</span>
                    <span className="text-[9px] text-[#10A37F] bg-[#10A37F]/10 px-1 py-0.2 rounded font-mono font-bold">设计系统</span>
                  </div>
                  <p className="text-[11px] text-[#71717A]">
                    Warm Cream 极简设计、弹窗居中、Esc 退出响应、全圆角与 60-30-10 配色法则。
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSkillId('ui-ux-pro-max')
                    setTriggerDesc('当涉及界面原型、组件样式或弹窗交互开发时激活')
                    setWorkflowText('## UI/UX 设计先行原则\n1. 暖米白色阶规范\n2. 弹窗绝对居中与 Esc 退出\n3. 16:9 黄金比例人机工程学')
                    setActiveTab('create')
                  }}
                  className="px-3 py-1 rounded-lg bg-[#FAF8F5] hover:bg-[#D96B27] hover:text-white text-[#D96B27] border border-[#D96B27]/30 text-xs font-semibold transition-all cursor-pointer"
                >
                  一键载入
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 底栏 */}
        <div className="h-12 bg-[#F4EFEA] border-t border-[#EADFD7] px-4 flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={() => setSkillModalOpen(false)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#71717A] hover:bg-black/[0.04] transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg bg-[#D96B27] hover:bg-[#B8551B] text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Check size={13} strokeWidth={2.5} />
            <span>确认导入并激活技能</span>
          </button>
        </div>
      </div>
    </div>
  )
}
