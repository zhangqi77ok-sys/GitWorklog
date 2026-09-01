import React, { useState } from 'react';
import {
  X,
  Search,
  Box,
  Folder,
  Terminal,
  Database,
  GitBranch,
  Globe,
  Plus,
  RefreshCw,
  Cpu,
} from 'lucide-react';
import type { PluginMetadata, ToolSchema } from '../../types';

interface PluginManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  plugins: PluginMetadata[];
  tools: ToolSchema[];
}

export const PluginManagerModal: React.FC<PluginManagerModalProps> = ({
  isOpen,
  onClose,
  plugins = [],
  tools = [],
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'builtin' | 'mcp'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const getPluginIcon = (pluginName: string) => {
    const lower = pluginName.toLowerCase();
    if (lower.includes('fs') || lower.includes('file')) {
      return <Folder className="w-4 h-4 text-[#D96B27]" />;
    }
    if (lower.includes('terminal') || lower.includes('shell')) {
      return <Terminal className="w-4 h-4 text-[#D96B27]" />;
    }
    if (lower.includes('postgres') || lower.includes('db') || lower.includes('sql')) {
      return <Database className="w-4 h-4 text-[#1565C0]" />;
    }
    if (lower.includes('github') || lower.includes('git')) {
      return <GitBranch className="w-4 h-4 text-[#1E1C1A]" />;
    }
    if (lower.includes('search') || lower.includes('web')) {
      return <Globe className="w-4 h-4 text-[#8A847C]" />;
    }
    return <Cpu className="w-4 h-4 text-[#D96B27]" />;
  };

  const filteredList = plugins.filter((item) => {
    const matchesFilter =
      activeFilter === 'all' ||
      (activeFilter === 'builtin' && item.is_builtin) ||
      (activeFilter === 'mcp' && !item.is_builtin);

    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const builtinCount = plugins.filter((p) => p.is_builtin).length;
  const mcpCount = plugins.filter((p) => !p.is_builtin).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-[#FAF8F5] border border-[#E6DFD5] rounded-2xl w-[760px] max-w-[95vw] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E6DFD5] bg-[#F4EFEA] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">🧩</span>
            <h2 className="font-bold text-sm text-[#1E1C1A]">
              能力与插件驾驶舱 (Tool & Plugin Cockpit)
            </h2>
            <span className="px-2.5 py-0.5 bg-[#FAF8F5] border border-[#E6DFD5] rounded-full text-[10px] font-bold text-[#D96B27]">
              {plugins.length} 个已就绪能力
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-[#8A847C] hover:text-[#1E1C1A] hover:bg-[#EAE4DC] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-[#E6DFD5] bg-white flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A847C]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索已挂载的能力插件或 MCP Servers..."
              className="w-full pl-9 pr-3 py-2 bg-[#FAF8F5] border border-[#E6DFD5] focus:border-[#D96B27] rounded-xl text-xs text-[#1E1C1A] placeholder-[#8A847C] outline-none"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#F4EFEA] p-1 rounded-xl border border-[#E6DFD5]">
            {[
              { id: 'all', label: `全部 (${plugins.length})` },
              { id: 'builtin', label: `内置 (${builtinCount})` },
              { id: 'mcp', label: `MCP (${mcpCount})` },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeFilter === f.id
                    ? 'bg-white text-[#D96B27] shadow-xs'
                    : 'text-[#6B665F] hover:text-[#1E1C1A]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Plugin Cards List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {filteredList.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#8A847C]">
              {searchQuery ? '未找到匹配的能力插件' : '当前暂无挂载的外部 MCP 插件'}
            </div>
          ) : (
            filteredList.map((item) => (
              <div
                key={item.id}
                className="p-3.5 bg-white rounded-xl border border-[#E6DFD5] flex items-center justify-between gap-4 hover:border-[#D96B27]/40 transition-all shadow-xs"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#FAF8F5] border border-[#E6DFD5] flex items-center justify-center flex-shrink-0 mt-0.5">
                    {getPluginIcon(item.name)}
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-bold text-xs text-[#1E1C1A] flex items-center gap-2">
                      <span className="truncate">{item.name}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                          item.is_builtin
                            ? 'bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]'
                            : 'bg-[#F4EFEA] text-[#D96B27] border border-[#E6DFD5]'
                        }`}
                      >
                        {item.is_builtin ? '内置原生' : 'MCP 扩展'}
                      </span>
                      <span className="text-[10px] text-[#8A847C] font-mono">v{item.version}</span>
                    </div>
                    <div className="text-[11px] text-[#6B665F] truncate">{item.description}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7] rounded-full text-[10px] font-bold font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32]" />
                    已挂载运行
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-[#E6DFD5] bg-[#F4EFEA] flex items-center justify-between">
          <div className="text-[11px] text-[#8A847C]">
            共检测到 {tools.length} 个可用工具契约
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-[#E6DFD5] hover:bg-[#FAF8F5] text-[#3D3A36] rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
