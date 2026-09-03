import React, { useState, useEffect } from 'react'
import { X, Network, BookOpen, Search, Layers, FileCode, CheckCircle2, AlertTriangle, ShieldCheck, Sparkles } from 'lucide-react'
import { useWorkspaceStore } from '../../core/store/workspaceStore'

interface KnowledgeDoc {
  filename: string
  title: string
  category: string
  charCount: number
  background: string
  corePrinciple: string
  solution: string
  avoidTip: string
  score?: number
}

interface TopologyNode {
  id: string
  name: string
  path: string
  type: string
  category: string
  exports: string[]
  size: number
}

interface TopologyEdge {
  source: string
  target: string
  relationship: string
}

interface TopologyData {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
  totalNodes: number
  totalEdges: number
}

export const KnowledgeGraphModal: React.FC = () => {
  const { isKgModalOpen, setKgModalOpen } = useWorkspaceStore()
  const [activeTab, setActiveTab] = useState<'knowledge' | 'topology'>('knowledge')

  // 1. 知识库 RAG 状态
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeDoc[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedDocFilename, setSelectedDocFilename] = useState<string>('')
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)

  // 2. AST 拓扑图状态
  const [topology, setTopology] = useState<TopologyData | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string>('')
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string>('all')

  // 加载知识库沉淀数据
  useEffect(() => {
    if (!isKgModalOpen) return
    setIsLoadingDocs(true)
    fetch('http://127.0.0.1:8765/api/knowledge/list')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.docs) {
          setKnowledgeList(data.docs)
          if (data.docs.length > 0) {
            setSelectedDocFilename(data.docs[0].filename)
          }
        }
      })
      .catch((err) => console.error('Failed to load knowledge vault:', err))
      .finally(() => setIsLoadingDocs(false))

    // 同步加载 AST 拓扑图
    fetch('http://127.0.0.1:8765/api/ast/topology')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.topology) {
          setTopology(data.topology)
          if (data.topology.nodes.length > 0) {
            setSelectedNodeId(data.topology.nodes[0].id)
          }
        }
      })
      .catch((err) => console.error('Failed to load AST topology:', err))
  }, [isKgModalOpen])

  // 触发 RAG 检索
  useEffect(() => {
    if (!isKgModalOpen || !searchQuery.trim()) {
      return
    }
    const timer = setTimeout(() => {
      fetch('http://127.0.0.1:8765/api/knowledge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, topK: 10 }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.results) {
            setKnowledgeList(data.results)
            if (data.results.length > 0) {
              setSelectedDocFilename(data.results[0].filename)
            }
          }
        })
        .catch((err) => console.error('Knowledge search failed:', err))
    }, 250)
    return () => clearTimeout(timer)
  }, [searchQuery, isKgModalOpen])

  // 全局 Esc 快捷键关闭
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

  // 知识库过滤
  const categories = ['all', '桌面与安装包构建', '网关与网络穿透', '安全沙箱与 Shell', '认知流与自愈循环', '状态机与持久化']
  const filteredDocs = knowledgeList.filter((doc) => {
    if (selectedCategory !== 'all' && doc.category !== selectedCategory) return false
    return true
  })
  const currentDoc = knowledgeList.find((d) => d.filename === selectedDocFilename) || filteredDocs[0]

  // AST 节点与边过滤
  const allNodes = topology?.nodes || []
  const allEdges = topology?.edges || []
  const filteredNodes = allNodes.filter((node) => {
    if (nodeTypeFilter !== 'all' && node.type !== nodeTypeFilter) return false
    return true
  })
  const currentNode = allNodes.find((n) => n.id === selectedNodeId) || filteredNodes[0]

  // 计算当前节点的上下游依赖
  const outgoingDependencies = allEdges
    .filter((e) => e.source === currentNode?.id)
    .map((e) => e.target)
  const incomingDependents = allEdges
    .filter((e) => e.target === currentNode?.id)
    .map((e) => e.source)

  return (
    <div
      onClick={() => setKgModalOpen(false)}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[900px] h-[82vh] max-h-[800px] bg-[#FAF8F5] rounded-2xl border border-black/[0.08] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* 1. 顶栏：标题与主 Tab 切换 */}
        <div className="h-12 bg-[#F4EFEA] border-b border-black/[0.06] px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Network size={17} className="text-[#D96B27]" />
              <span className="font-bold text-sm text-[#18181B]">工程架构全景与实战经验资产</span>
            </div>

            {/* 双 Tab 切换 */}
            <div className="flex items-center bg-black/[0.04] p-0.5 rounded-xl text-xs">
              <button
                onClick={() => setActiveTab('knowledge')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  activeTab === 'knowledge'
                    ? 'bg-white text-[#18181B] shadow-2xs'
                    : 'text-[#71717A] hover:text-[#18181B]'
                }`}
              >
                <BookOpen size={13} />
                <span>工程知识资产 (RAG)</span>
                <span className="text-[10px] px-1 bg-[#D96B27]/10 text-[#D96B27] rounded-full font-mono">
                  {knowledgeList.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('topology')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  activeTab === 'topology'
                    ? 'bg-white text-[#18181B] shadow-2xs'
                    : 'text-[#71717A] hover:text-[#18181B]'
                }`}
              >
                <Layers size={13} />
                <span>源码 AST 调用拓扑</span>
                <span className="text-[10px] px-1 bg-emerald-500/10 text-emerald-700 rounded-full font-mono">
                  {topology?.totalNodes || 0}
                </span>
              </button>
            </div>
          </div>

          <button
            onClick={() => setKgModalOpen(false)}
            title="关闭 (Esc)"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#71717A] hover:text-[#18181B] hover:bg-black/[0.05] transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* 2. 主体内容区 */}
        {activeTab === 'knowledge' ? (
          <div className="flex-1 flex overflow-hidden">
            {/* 左侧：搜索与四段论知识条目列表 */}
            <div className="w-[330px] border-r border-black/[0.06] bg-[#F4EFEA]/40 flex flex-col shrink-0">
              {/* 搜索框 */}
              <div className="p-3 border-b border-black/[0.06] space-y-2">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-2.5 text-[#A1A1AA]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="输入关键词检索实战经验 (RAG)..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-black/[0.08] rounded-xl text-xs text-[#18181B] focus:outline-none focus:border-[#D96B27]"
                  />
                </div>

                {/* 分类胶囊横向滑动 */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 text-[10px]">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2 py-0.5 rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-[#18181B] text-white font-medium'
                          : 'bg-black/[0.04] text-[#71717A] hover:bg-black/[0.08]'
                      }`}
                    >
                      {cat === 'all' ? '全部' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* 列表项 */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {isLoadingDocs && (
                  <div className="p-4 text-center text-[11px] text-[#A1A1AA]">
                    正在加载知识库沉淀资产...
                  </div>
                )}
                {filteredDocs.map((doc) => {
                  const isSelected = doc.filename === currentDoc?.filename
                  return (
                    <div
                      key={doc.filename}
                      onClick={() => setSelectedDocFilename(doc.filename)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white border-[#D96B27] shadow-xs ring-1 ring-[#D96B27]/30'
                          : 'bg-white/60 border-black/[0.05] hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-800 font-medium">
                          {doc.category}
                        </span>
                        {doc.score !== undefined && (
                          <span className="text-[9px] font-mono text-[#10A37F] bg-[#10A37F]/10 px-1 rounded">
                            匹配度: {doc.score}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-[#18181B] line-clamp-2 leading-snug">
                        {doc.title}
                      </div>
                      <div className="text-[10px] text-[#A1A1AA] mt-1 flex items-center justify-between font-mono">
                        <span>{doc.filename}</span>
                        <span>{Math.round(doc.charCount / 100) / 10}k 字符</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 右侧：四段论沉淀深度研读视窗 */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#FAF8F5] space-y-5 text-xs text-[#27272A] leading-relaxed">
              {currentDoc ? (
                <>
                  <div className="border-b border-black/[0.06] pb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-md bg-[#D96B27]/10 text-[#D96B27] font-semibold">
                        {currentDoc.category}
                      </span>
                      <span className="text-[11px] text-[#A1A1AA] font-mono">{currentDoc.filename}</span>
                    </div>
                    <h2 className="text-base font-bold text-[#18181B] mt-1">{currentDoc.title}</h2>
                  </div>

                  {/* ① 知识点与问题背景 */}
                  <div className="p-4 bg-white rounded-xl border border-black/[0.06] shadow-2xs space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-[#18181B]">
                      <AlertTriangle size={14} className="text-amber-600" />
                      <span>① 知识点与问题背景 (Context & Problem Statement)</span>
                    </div>
                    <div className="text-xs text-[#52525B] whitespace-pre-wrap pl-5 border-l-2 border-amber-500/40">
                      {currentDoc.background || '详见源码文档'}
                    </div>
                  </div>

                  {/* ② 核心原理与底层机制 */}
                  <div className="p-4 bg-white rounded-xl border border-black/[0.06] shadow-2xs space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-[#18181B]">
                      <Sparkles size={14} className="text-indigo-600" />
                      <span>② 核心原理与底层机制 (Root Cause & Principles)</span>
                    </div>
                    <div className="text-xs text-[#52525B] whitespace-pre-wrap pl-5 border-l-2 border-indigo-500/40">
                      {currentDoc.corePrinciple || '详见源码文档'}
                    </div>
                  </div>

                  {/* ③ 标准解决方案与实操步骤 */}
                  <div className="p-4 bg-white rounded-xl border border-black/[0.06] shadow-2xs space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-[#18181B]">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <span>③ 标准解决方案与实操步骤 (Actionable Solutions)</span>
                    </div>
                    <div className="text-xs text-[#52525B] whitespace-pre-wrap pl-5 border-l-2 border-emerald-500/40 font-mono text-[11px]">
                      {currentDoc.solution || '详见源码文档'}
                    </div>
                  </div>

                  {/* ④ 避坑指南与最佳实践 */}
                  <div className="p-4 bg-amber-500/[0.06] rounded-xl border border-amber-500/20 shadow-2xs space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900">
                      <ShieldCheck size={14} className="text-amber-700" />
                      <span>④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)</span>
                    </div>
                    <div className="text-xs text-amber-950 whitespace-pre-wrap pl-5 border-l-2 border-amber-600/50">
                      {currentDoc.avoidTip || '详见源码文档'}
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-[#A1A1AA]">
                  暂无匹配的工程知识文档
                </div>
              )}
            </div>
          </div>
        ) : (
          /* 拓扑图视窗 */
          <div className="flex-1 flex overflow-hidden">
            {/* 左侧：AST 节点列表与分类过滤 */}
            <div className="w-[330px] border-r border-black/[0.06] bg-[#F4EFEA]/40 flex flex-col shrink-0">
              <div className="p-3 border-b border-black/[0.06] flex items-center justify-between">
                <span className="text-xs font-bold text-[#18181B]">源码 AST 模块节点</span>
                <span className="text-[10px] font-mono text-[#71717A]">共 {allNodes.length} 个节点</span>
              </div>

              {/* 类型过滤 */}
              <div className="px-3 py-2 border-b border-black/[0.06] flex items-center gap-1 text-[10px]">
                {['all', 'component', 'store', 'service', 'module'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setNodeTypeFilter(t)}
                    className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                      nodeTypeFilter === t
                        ? 'bg-[#18181B] text-white font-medium'
                        : 'bg-black/[0.04] text-[#71717A] hover:bg-black/[0.08]'
                    }`}
                  >
                    {t === 'all' ? '全部' : t}
                  </button>
                ))}
              </div>

              {/* 节点列表 */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredNodes.map((node) => {
                  const isSelected = node.id === currentNode?.id
                  return (
                    <div
                      key={node.id}
                      onClick={() => setSelectedNodeId(node.id)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white border-[#D96B27] shadow-xs ring-1 ring-[#D96B27]/30'
                          : 'bg-white/60 border-black/[0.05] hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-xs text-[#18181B] truncate">{node.name}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                            node.type === 'component'
                              ? 'bg-blue-50 text-blue-700'
                              : node.type === 'store'
                              ? 'bg-purple-50 text-purple-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {node.type}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#A1A1AA] font-mono truncate">{node.path}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 右侧：当前节点的依赖与拓扑拓扑关系全景 */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#FAF8F5] space-y-5 text-xs text-[#27272A]">
              {currentNode ? (
                <>
                  <div className="border-b border-black/[0.06] pb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-md bg-[#18181B] text-white font-mono">
                        {currentNode.type}
                      </span>
                      <span className="text-xs text-[#71717A] font-mono">
                        {Math.round(currentNode.size / 100) / 10} KB
                      </span>
                    </div>
                    <h2 className="text-base font-bold font-mono text-[#18181B]">{currentNode.path}</h2>
                  </div>

                  {/* 导出的类、函数与接口 */}
                  <div className="p-4 bg-white rounded-xl border border-black/[0.06] shadow-2xs space-y-2">
                    <div className="font-bold text-xs text-[#18181B] flex items-center gap-1.5">
                      <FileCode size={14} className="text-[#D96B27]" />
                      <span>导出实体标识 (Exports AST):</span>
                    </div>
                    {currentNode.exports.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {currentNode.exports.map((exp) => (
                          <span
                            key={exp}
                            className="px-2 py-1 bg-[#FAF8F5] border border-black/[0.06] rounded-lg font-mono text-[11px] font-semibold text-[#D96B27]"
                          >
                            {exp}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#A1A1AA]">该模块为纯入口或无显式命名 Export</span>
                    )}
                  </div>

                  {/* 下游依赖：它引用了谁 (Outgoing Imports) */}
                  <div className="p-4 bg-white rounded-xl border border-black/[0.06] shadow-2xs space-y-2">
                    <div className="font-bold text-xs text-[#18181B] flex items-center justify-between">
                      <span>➡️ 下游模块依赖 (Imports {outgoingDependencies.length}):</span>
                    </div>
                    {outgoingDependencies.length > 0 ? (
                      <div className="space-y-1 max-h-40 overflow-y-auto font-mono text-[11px]">
                        {outgoingDependencies.map((dep) => (
                          <div
                            key={dep}
                            onClick={() => setSelectedNodeId(dep)}
                            className="p-1.5 bg-[#FAF8F5] rounded-lg hover:bg-[#D96B27]/10 hover:text-[#D96B27] transition-colors cursor-pointer truncate"
                          >
                            {dep}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#A1A1AA]">无下游相对依赖模块</span>
                    )}
                  </div>

                  {/* 上游被引用：谁在引用它 (Incoming Dependents) */}
                  <div className="p-4 bg-white rounded-xl border border-black/[0.06] shadow-2xs space-y-2">
                    <div className="font-bold text-xs text-[#18181B] flex items-center justify-between">
                      <span>⬅️ 被哪些模块引用 (Referenced By {incomingDependents.length}):</span>
                    </div>
                    {incomingDependents.length > 0 ? (
                      <div className="space-y-1 max-h-40 overflow-y-auto font-mono text-[11px]">
                        {incomingDependents.map((dep) => (
                          <div
                            key={dep}
                            onClick={() => setSelectedNodeId(dep)}
                            className="p-1.5 bg-[#FAF8F5] rounded-lg hover:bg-[#D96B27]/10 hover:text-[#D96B27] transition-colors cursor-pointer truncate"
                          >
                            {dep}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#A1A1AA]">当前无其他模块显式相对引用</span>
                    )}
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-[#A1A1AA]">
                  暂无选中 AST 节点
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
