import React, { useState, useEffect } from 'react'
import { X, Puzzle, FileJson, Edit3, Globe, Check } from 'lucide-react'
import { useWorkspaceStore } from '../../core/store/workspaceStore'

export const MCPImportModal: React.FC = () => {
  const { isMcpModalOpen, setMcpModalOpen } = useWorkspaceStore()
  const [activeTab, setActiveTab] = useState<'json' | 'form' | 'market'>('json')
  const [jsonText, setJsonText] = useState('')
  const [serverName, setServerName] = useState('')
  const [transport, setTransport] = useState('stdio')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMcpModalOpen) {
        setMcpModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMcpModalOpen, setMcpModalOpen])

  if (!isMcpModalOpen) return null

  const handleFillDemo = () => {
    setJsonText(
      JSON.stringify(
        {
          mcpServers: {
            filesystem: {
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem', 'D:/weihu/agent-learning'],
            },
            github: {
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-github'],
              env: { GITHUB_TOKEN: 'ghp_exampleToken' },
            },
          },
        },
        null,
        2
      )
    )
  }

  const handleSave = () => {
    alert('✓ MCP 协议服务已成功注册并完成握手探活！')
    setMcpModalOpen(false)
  }

  return (
    <div
      onClick={() => setMcpModalOpen(false)}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[620px] max-h-[85vh] bg-[#FAF8F5] rounded-xl border border-[#EADFD7] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* 顶栏 */}
        <div className="h-12 bg-[#F4EFEA] border-b border-[#EADFD7] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Puzzle size={16} className="text-[#D96B27]" />
            <span className="text-sm font-semibold text-[#2C2825]">
              添加 / 导入 MCP 工具协议服务
            </span>
          </div>
          <button
            onClick={() => setMcpModalOpen(false)}
            title="关闭 (Esc)"
            className="p-1.5 text-[#7A726B] hover:text-[#E04B4B] rounded-lg transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tab 切换条 */}
        <div className="flex items-center px-4 pt-2 border-b border-[#EADFD7] bg-[#FAF8F5] text-xs font-medium">
          <button
            onClick={() => setActiveTab('json')}
            className={`px-3 py-2 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'json'
                ? 'border-[#D96B27] text-[#D96B27] font-semibold'
                : 'border-transparent text-[#71717A] hover:text-[#18181B]'
            }`}
          >
            <FileJson size={13} />
            <span>📋 粘贴 JSON 配置</span>
          </button>

          <button
            onClick={() => setActiveTab('form')}
            className={`px-3 py-2 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'form'
                ? 'border-[#D96B27] text-[#D96B27] font-semibold'
                : 'border-transparent text-[#71717A] hover:text-[#18181B]'
            }`}
          >
            <Edit3 size={13} />
            <span>✍️ 手动表单录入</span>
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
            <span>🌐 社区官方推荐</span>
          </button>
        </div>

        {/* 内容面板 */}
        <div className="p-4 space-y-3 overflow-y-auto max-h-[55vh] text-xs">
          {activeTab === 'json' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-[#71717A]">
                <span>粘贴 Claude Desktop / Cursor 标准配置对象：</span>
                <button
                  onClick={handleFillDemo}
                  className="text-[#D96B27] font-semibold hover:underline cursor-pointer"
                >
                  填入示例
                </button>
              </div>
              <textarea
                rows={8}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='{\n  "mcpServers": {\n    "github": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-github"],\n      "env": { "GITHUB_TOKEN": "ghp_..." }\n    }\n  }\n}'
                className="w-full p-3 rounded-xl bg-white border border-black/[0.08] text-xs font-mono text-[#18181B] focus:outline-none focus:border-[#D96B27] leading-relaxed placeholder:text-[#A1A1AA]"
              />
            </div>
          )}

          {activeTab === 'form' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">服务标识符 (Identifier)</label>
                  <input
                    type="text"
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    placeholder="例如: postgresql-mcp"
                    className="w-full h-8 px-2.5 rounded-lg bg-white border border-black/[0.08] text-xs font-mono focus:outline-none focus:border-[#D96B27]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">传输通道 (Transport)</label>
                  <select
                    value={transport}
                    onChange={(e) => setTransport(e.target.value)}
                    className="w-full h-8 px-2 rounded-lg bg-white border border-black/[0.08] text-xs focus:outline-none focus:border-[#D96B27]"
                  >
                    <option value="stdio">stdio (标准子进程管道)</option>
                    <option value="sse">sse (HTTP Server-Sent Events)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#18181B] block mb-1">启动命令 (Command)</label>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="例如: npx, uvx, python, docker"
                  className="w-full h-8 px-2.5 rounded-lg bg-white border border-black/[0.08] text-xs font-mono focus:outline-none focus:border-[#D96B27]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#18181B] block mb-1">启动参数列表 (Args, 空格分隔)</label>
                <input
                  type="text"
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                  placeholder="例如: -y @modelcontextprotocol/server-postgres postgresql://localhost/db"
                  className="w-full h-8 px-2.5 rounded-lg bg-white border border-black/[0.08] text-xs font-mono focus:outline-none focus:border-[#D96B27]"
                />
              </div>
            </div>
          )}

          {activeTab === 'market' && (
            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-white border border-black/[0.08] shadow-2xs flex items-center justify-between">
                <div className="space-y-0.5 max-w-[420px]">
                  <div className="font-bold text-[#18181B] flex items-center gap-1.5">
                    <span>🐘</span>
                    <span>PostgreSQL MCP Server</span>
                    <span className="text-[9px] text-[#10A37F] bg-[#10A37F]/10 px-1 py-0.2 rounded font-mono font-bold">官方认证</span>
                  </div>
                  <p className="text-[11px] text-[#71717A]">
                    允许智能体安全探查数据表结构、运行只读 SQL 并生成分析结论。
                  </p>
                </div>
                <button
                  onClick={() => {
                    setServerName('postgres-mcp')
                    setCommand('npx')
                    setArgs('-y @modelcontextprotocol/server-postgres postgresql://localhost/db')
                    setActiveTab('form')
                  }}
                  className="px-3 py-1 rounded-lg bg-[#FAF8F5] hover:bg-[#D96B27] hover:text-white text-[#D96B27] border border-[#D96B27]/30 text-xs font-semibold transition-all cursor-pointer"
                >
                  一键载入
                </button>
              </div>

              <div className="p-3 rounded-xl bg-white border border-black/[0.08] shadow-2xs flex items-center justify-between">
                <div className="space-y-0.5 max-w-[420px]">
                  <div className="font-bold text-[#18181B] flex items-center gap-1.5">
                    <span>🐙</span>
                    <span>GitHub API MCP Server</span>
                    <span className="text-[9px] text-[#D96B27] bg-[#D96B27]/10 px-1 py-0.2 rounded font-mono font-bold">高频工具</span>
                  </div>
                  <p className="text-[11px] text-[#71717A]">
                    审查 Pull Request、检索 Issues、提交 Commit 与分支生命周期管理。
                  </p>
                </div>
                <button
                  onClick={() => {
                    setServerName('github-mcp')
                    setCommand('npx')
                    setArgs('-y @modelcontextprotocol/server-github')
                    setActiveTab('form')
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
            onClick={() => setMcpModalOpen(false)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#71717A] hover:bg-black/[0.04] transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg bg-[#D96B27] hover:bg-[#B8551B] text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Check size={13} strokeWidth={2.5} />
            <span>确认导入并启动探活</span>
          </button>
        </div>
      </div>
    </div>
  )
}
