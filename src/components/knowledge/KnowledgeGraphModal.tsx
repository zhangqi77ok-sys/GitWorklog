import React, { useState } from "react";
import { X, Network, Search, Layers, Box, Cpu, Server, FileCode, ArrowRight, ShieldCheck } from "lucide-react";
import { projectKnowledgeGraphService, GraphNode } from "../../services/projectKnowledgeGraphService";

interface KnowledgeGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
}

export const KnowledgeGraphModal: React.FC<KnowledgeGraphModalProps> = ({
  isOpen,
  onClose,
  projectName = "agent-learning",
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  if (!isOpen) return null;

  const graph = projectKnowledgeGraphService.getProjectGraph(projectName);

  const filteredNodes = graph.nodes.filter((n) => {
    const matchesSearch =
      !searchQuery.trim() ||
      n.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (n.path && n.path.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = filterCategory === "all" || n.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const getNodeIcon = (type: GraphNode["type"]) => {
    switch (type) {
      case "component":
        return <Box size={14} className="text-blue-500" />;
      case "service":
        return <Cpu size={14} className="text-amber-500" />;
      case "backend_rust":
        return <Server size={14} className="text-red-500" />;
      case "dependency":
        return <ShieldCheck size={14} className="text-emerald-500" />;
      default:
        return <FileCode size={14} className="text-gray-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white border border-[#e5dfd8] rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[88vh] animate-in zoom-in-95">
        {/* 头部标题与统计 */}
        <div className="px-6 py-4 border-b border-[#f4efea] flex justify-between items-center bg-[#faf8f5]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#fef3eb] text-[#d96b27] flex items-center justify-center shadow-xs">
              <Network size={19} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#1e1b18]">
                  【{projectName}】真实工程知识图谱 (Project Knowledge Graph)
                </h3>
                <span className="text-[10px] bg-[#eff6ff] text-[#2563eb] px-2 py-0.5 rounded-full font-semibold">
                  Graph-RAG 生产引擎
                </span>
              </div>
              <p className="text-[11px] text-[#78716c] mt-0.5">
                已索引 {graph.nodes.length} 个核心拓扑节点 · {graph.edges.length} 条调用与依赖拓扑边
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[#ebe5df] flex items-center justify-center text-[#78716c] hover:text-[#1e1b18] cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        {/* 搜索与分类过滤条 */}
        <div className="p-4 border-b border-[#f4efea] flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={14} className="absolute left-3 top-2.5 text-[#9ca3af]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索实体节点、模块路径或功能摘要..."
              className="w-full pl-8 pr-3 py-1.5 border border-[#e5dfd8] focus:border-[#d96b27] rounded-xl text-xs outline-none bg-[#faf8f5]"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            {["all", "frontend", "core_service", "backend"].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  filterCategory === cat
                    ? "bg-[#d96b27] text-white"
                    : "bg-[#f4efea] text-[#78716c] hover:bg-[#ebe5df]"
                }`}
              >
                {cat === "all"
                  ? "全部实体"
                  : cat === "frontend"
                  ? "前端组件"
                  : cat === "core_service"
                  ? "核心服务"
                  : "Rust原生层"}
              </button>
            ))}
          </div>
        </div>

        {/* 主体两栏：左侧节点拓扑列表，右侧实体依赖详情 */}
        <div className="flex-1 flex overflow-hidden min-h-[350px]">
          {/* 左侧实体列表 */}
          <div className="w-1/2 border-r border-[#f4efea] p-4 overflow-y-auto flex flex-col gap-2 scrollbar-thin">
            <div className="text-[11px] font-bold text-[#78716c] uppercase tracking-wider mb-1">
              工程拓扑实体 ({filteredNodes.length})
            </div>

            {filteredNodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  className={`p-3 rounded-xl cursor-pointer border transition-all flex flex-col gap-1 ${
                    isSelected
                      ? "bg-[#fef3eb] border-[#fed7aa] shadow-xs"
                      : "bg-white border-[#f1f5f9] hover:bg-[#faf8f5]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getNodeIcon(node.type)}
                      <span className="font-bold text-xs text-[#1e1b18] font-mono">
                        {node.label}
                      </span>
                    </div>
                    <span className="text-[9px] bg-[#f4efea] text-[#78716c] px-1.5 py-0.5 rounded font-mono uppercase">
                      {node.type}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#6b7280] line-clamp-2">
                    {node.summary}
                  </p>

                  {node.path && (
                    <span className="text-[10px] text-[#d96b27] font-mono truncate">
                      📁 {node.path}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* 右侧关系详情与调用拓扑 */}
          <div className="w-1/2 p-5 overflow-y-auto flex flex-col gap-4 bg-[#faf8f5] scrollbar-thin">
            {selectedNode ? (
              <div className="flex flex-col gap-4">
                <div className="bg-white p-4 rounded-xl border border-[#e5dfd8] shadow-2xs flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-[#d96b27]">
                      {selectedNode.type} 节点详情
                    </span>
                    <span className="text-[10px] bg-[#f4efea] text-[#78716c] px-2 py-0.5 rounded font-mono">
                      {selectedNode.category}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-[#1e1b18] font-mono">
                    {selectedNode.label}
                  </h4>
                  <p className="text-xs text-[#4b5563] leading-relaxed">
                    {selectedNode.summary}
                  </p>
                  {selectedNode.tech && (
                    <div className="text-xs text-[#6b7280]">
                      <b>技术栈:</b> <span className="font-mono text-[#d96b27]">{selectedNode.tech}</span>
                    </div>
                  )}
                  {selectedNode.path && (
                    <div className="text-xs text-[#6b7280]">
                      <b>文件路径:</b> <span className="font-mono text-[#2563eb]">{selectedNode.path}</span>
                    </div>
                  )}
                </div>

                {/* 关联拓扑边 */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-[#1e1b18] flex items-center gap-1">
                    <Layers size={13} className="text-[#d96b27]" /> 拓扑调用与依赖边
                  </span>
                  
                  {graph.edges
                    .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                    .map((edge) => (
                      <div
                        key={edge.id}
                        className="bg-white p-2.5 rounded-xl border border-[#e5dfd8] text-xs flex items-center justify-between"
                      >
                        <span className="font-mono font-bold text-[#1e1b18]">
                          {edge.source}
                        </span>
                        <div className="flex flex-col items-center px-2">
                          <span className="text-[9px] text-[#ea580c] font-semibold">
                            {edge.label}
                          </span>
                          <ArrowRight size={12} className="text-[#d96b27]" />
                        </div>
                        <span className="font-mono font-bold text-[#2563eb]">
                          {edge.target}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#9ca3af]">
                <Network size={36} className="text-[#d0c7bd] mb-2" />
                <span className="text-xs font-medium">请从左侧选择一个拓扑实体节点</span>
                <p className="text-[11px] mt-1 max-w-xs">
                  查看其代码依赖路径、底层架构调用链路与 Graph-RAG 提示词注入上下文
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 底部操作条 */}
        <div className="px-6 py-3 border-t border-[#f4efea] bg-[#faf8f5] flex justify-between items-center">
          <span className="text-xs text-[#6b7280]">
            💡 每次发送提问时，系统会自动提取与意图关联的子图注入 ReAct 提示词上下文
          </span>
          <button
            onClick={onClose}
            className="bg-[#d96b27] hover:bg-[#b85417] text-white px-5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shadow-sm"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
