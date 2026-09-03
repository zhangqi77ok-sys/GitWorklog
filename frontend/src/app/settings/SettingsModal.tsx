import React, { useEffect } from 'react'
import { X, Sparkles, ShieldCheck, FileText, Check, AlertCircle, Loader2, Zap } from 'lucide-react'
import { useSettingsStore } from '../../core/store/settingsStore'

export const SettingsModal: React.FC = () => {
  const {
    isOpen,
    activeTab,
    config,
    pingStatus,
    pingLatency,
    pingMessage,
    closeSettings,
    setActiveTab,
    updateConfig,
    saveConfig,
    testPing,
  } = useSettingsStore()

  // 全局 Esc 快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        closeSettings()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeSettings])

  if (!isOpen) return null

  return (
    <div
      onClick={closeSettings}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
    >
      {/* 弹窗主体：严格水平垂直居中 */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[620px] max-h-[88vh] bg-[#FAF8F5] rounded-xl border border-[#EADFD7] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* 顶部标题栏 */}
        <div className="h-12 bg-[#F4EFEA] border-b border-[#EADFD7] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#2C2825]">系统全局设置 (SETTINGS)</span>
            <span className="text-[11px] text-[#7A726B] bg-[#FAF8F5] px-2 py-0.5 rounded border border-[#EADFD7]">
              跨平台安全凭据
            </span>
          </div>
          <button
            onClick={closeSettings}
            title="关闭设置 (Esc)"
            className="p-1.5 text-[#7A726B] hover:text-[#E04B4B] hover:bg-[#EADFD7] rounded-lg transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* 次级 Tab 导航 */}
        <div className="h-10 bg-[#EAE2DA] border-b border-[#EADFD7] px-3 flex items-center gap-1 shrink-0">
          <button
            onClick={() => setActiveTab('providers')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md font-medium transition-colors ${
              activeTab === 'providers'
                ? 'bg-[#FAF8F5] text-[#D96B27] shadow-2xs font-semibold'
                : 'text-[#7A726B] hover:text-[#2C2825] hover:bg-[#FAF8F5]/50'
            }`}
          >
            <Sparkles size={12} />
            <span>大模型与凭据 (Providers)</span>
          </button>
          <button
            onClick={() => setActiveTab('sandbox')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md font-medium transition-colors ${
              activeTab === 'sandbox'
                ? 'bg-[#FAF8F5] text-[#D96B27] shadow-2xs font-semibold'
                : 'text-[#7A726B] hover:text-[#2C2825] hover:bg-[#FAF8F5]/50'
            }`}
          >
            <ShieldCheck size={12} />
            <span>沙箱与安全机制</span>
          </button>
          <button
            onClick={() => setActiveTab('prompts')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md font-medium transition-colors ${
              activeTab === 'prompts'
                ? 'bg-[#FAF8F5] text-[#D96B27] shadow-2xs font-semibold'
                : 'text-[#7A726B] hover:text-[#2C2825] hover:bg-[#FAF8F5]/50'
            }`}
          >
            <FileText size={12} />
            <span>系统预设提示词</span>
          </button>
        </div>

        {/* 内容展示区 */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 text-xs text-[#2C2825]">
          {activeTab === 'providers' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-[#7A726B] mb-1">
                  网关服务地址 (BASE URL)
                </label>
                <input
                  type="text"
                  value={config.baseUrl}
                  onChange={(e) => updateConfig({ baseUrl: e.target.value })}
                  placeholder="https://agentrouter.org 或 https://api.openai.com/v1"
                  className="w-full text-xs font-mono px-3 py-2 bg-white rounded-lg border border-[#EADFD7] focus:outline-none focus:border-[#D96B27] focus:ring-1 focus:ring-[#D96B27]"
                />
                <span className="text-[10px] text-[#A89F96] mt-0.5 block">
                  支持 AgentRouter、OpenAI 官方、DeepSeek 官方或自建兼容反向代理
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#7A726B] mb-1">
                  模型调用凭据 (API KEY)
                </label>
                <input
                  type="password"
                  value={config.apiKey}
                  onChange={(e) => updateConfig({ apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full text-xs font-mono px-3 py-2 bg-white rounded-lg border border-[#EADFD7] focus:outline-none focus:border-[#D96B27] focus:ring-1 focus:ring-[#D96B27]"
                />
                <span className="text-[10px] text-[#A89F96] mt-0.5 block">
                  凭据仅持久化保存在当前桌面端运行时存储中，绝不上传任何第三方云端
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#7A726B] mb-1">
                  默认优先模型 (DEFAULT MODEL)
                </label>
                <select
                  value={config.defaultModel}
                  onChange={(e) => updateConfig({ defaultModel: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-[#EADFD7] focus:outline-none focus:border-[#D96B27]"
                >
                  <option value="deepseek-v4-flash">DeepSeek-V4 Flash (Thinking 深度思考链)</option>
                  <option value="gpt-5.6-sol">GPT-5.6 Sol (极速响应 1.1s)</option>
                  <option value="claude-opus-4-8">Claude Opus 4-8 (Anthropic 原生)</option>
                  <option value="glm-5.3">GLM-5.3 (多语言与思考)</option>
                </select>
              </div>

              <div className="pt-2 border-t border-[#EADFD7]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enableThinking}
                    onChange={(e) => updateConfig({ enableThinking: e.target.checked })}
                    className="accent-[#D96B27] rounded"
                  />
                  <span className="text-xs font-medium text-[#2C2825]">
                    启用深度思维链提取与折叠卡片 (Thinking Stream)
                  </span>
                </label>
                <span className="text-[10px] text-[#A89F96] ml-5 block mt-0.5">
                  开启后模型思考过程将以折叠卡片形式实时流式上屏，不阻塞代码阅读
                </span>
              </div>
            </div>
          )}

          {activeTab === 'sandbox' && (
            <div className="space-y-4">
              <div className="p-3 bg-[#FAF2EC] border border-[#F0D5C3] rounded-lg">
                <span className="font-semibold text-[#D96B27] text-xs block mb-1">物理沙箱与文件防护原则</span>
                <span className="text-[11px] text-[#7A726B] leading-relaxed block">
                  Tcode 严格执行工作区沙箱限制，任何由 Agent 触发的文件读写算子均无法穿越至工作区外部（如盘符根目录或系统目录）。
                </span>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.atomicWrite}
                    onChange={(e) => updateConfig({ atomicWrite: e.target.checked })}
                    className="accent-[#D96B27] rounded"
                  />
                  <span className="text-xs font-medium text-[#2C2825]">
                    启用临时文件落盘与 Atomic 原子替换（杜绝断电源文件损坏）
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.autoSnapshot}
                    onChange={(e) => updateConfig({ autoSnapshot: e.target.checked })}
                    className="accent-[#D96B27] rounded"
                  />
                  <span className="text-xs font-medium text-[#2C2825]">
                    修改代码前自动创建 Git Plumbing 秒级影子快照（&lt;5ms 锚点，0 分支污染）
                  </span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'prompts' && (
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-[#7A726B]">
                全局系统指令提示词 (SYSTEM PROMPT)
              </label>
              <textarea
                rows={7}
                value={config.systemPrompt}
                onChange={(e) => updateConfig({ systemPrompt: e.target.value })}
                className="w-full text-xs font-mono p-3 bg-white rounded-lg border border-[#EADFD7] focus:outline-none focus:border-[#D96B27] resize-none leading-relaxed"
              />
              <span className="text-[10px] text-[#A89F96] block">
                将随每次会话上下文前置注入，用于规约智能体的思考习惯与代码生成规约
              </span>
            </div>
          )}
        </div>

        {/* 底部操作工具栏 */}
        <div className="h-14 bg-[#F4EFEA] border-t border-[#EADFD7] px-4 flex items-center justify-between shrink-0">
          {/* 连通性测试按钮与反馈 */}
          <div className="flex items-center gap-2">
            <button
              onClick={testPing}
              disabled={pingStatus === 'testing'}
              title="向上游发起真实网络探针"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#FAF2EC] text-[#2C2825] border border-[#EADFD7] rounded-lg text-xs font-medium transition-colors shadow-2xs disabled:opacity-60 cursor-pointer"
            >
              {pingStatus === 'testing' ? (
                <Loader2 size={12} className="animate-spin text-[#D96B27]" />
              ) : (
                <Zap size={12} className="text-[#D96B27]" />
              )}
              <span>{pingStatus === 'testing' ? '正在打点测速...' : '测试网络连通性'}</span>
            </button>

            {pingStatus === 'success' && (
              <div className="flex items-center gap-1 text-[11px] text-[#2E7D32] font-medium bg-[#E8F5E9] px-2 py-1 rounded">
                <Check size={11} />
                <span>200 OK ({pingLatency}ms)</span>
              </div>
            )}

            {pingStatus === 'error' && (
              <div
                title={pingMessage || ''}
                className="flex items-center gap-1 text-[11px] text-[#C62828] font-medium bg-[#FFEBEE] px-2 py-1 rounded max-w-[200px] truncate"
              >
                <AlertCircle size={11} className="shrink-0" />
                <span className="truncate">{pingMessage || '连接失败'}</span>
              </div>
            )}
          </div>

          {/* 取消与保存 */}
          <div className="flex items-center gap-2">
            <button
              onClick={closeSettings}
              className="px-3 py-1.5 text-xs text-[#7A726B] hover:text-[#2C2825] hover:bg-[#EADFD7] rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={saveConfig}
              className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold text-white bg-[#D96B27] hover:bg-[#BF5B1D] rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Check size={12} />
              <span>保存并应用</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
