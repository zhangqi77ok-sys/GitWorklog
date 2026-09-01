import React, { useState } from 'react';
import {
  X,
  Cpu,
  Search,
  CheckCircle2,
  Folder,
  Terminal,
  Database,
  GitBranch,
  Globe,
  Plus,
  RefreshCw,
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
  plugins,
  tools,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'builtin' | 'mcp' | 'custom'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pluginStates, setPluginStates] = useState<Record<string, boolean>>({
    plugin_fs: true,
    plugin_terminal: true,
    'mcp-postgres': true,
    'mcp-github': true,
    'custom-web-search': false,
  });

  if (!isOpen) return null;

  const mockPlugins = [
    {
      id: 'plugin_fs',
      name: 'plugin_fs · Built-in File System Tool',
      description: 'Safe file read, write, list with path sandboxing',
      type: 'builtin',
      status: 'active',
      statusLabel: 'Active',
      icon: <Folder className="w-4 h-4 text-[#D96B27]" />,
    },
    {
      id: 'plugin_terminal',
      name: 'plugin_terminal · PowerShell Execution',
      description: 'Command execution with SafetyRail intercept',
      type: 'builtin',
      status: 'active',
      statusLabel: 'Active',
      icon: <Terminal className="w-4 h-4 text-[#D96B27]" />,
    },
    {
      id: 'mcp-postgres',
      name: 'mcp-postgres · PostgreSQL MCP Server',
      description: 'std/io transport · port 5432 · Schema discovery & query',
      type: 'mcp',
      status: 'connected',
      statusLabel: 'Connected (latency 12ms)',
      icon: <Database className="w-4 h-4 text-[#1565C0]" />,
    },
    {
      id: 'mcp-github',
      name: 'mcp-github · GitHub MCP Server',
      description: 'Issue tracking, PR creation, repo diff',
      type: 'mcp',
      status: 'connected',
      statusLabel: 'Connected',
      icon: <GitBranch className="w-4 h-4 text-[#1E1C1A]" />,
    },
    {
      id: 'custom-web-search',
      name: 'custom-web-search · Web Search Adapter',
      description: 'DuckDuckGo / Brave Search API adapter',
      type: 'custom',
      status: 'disabled',
      statusLabel: 'Disabled',
      icon: <Globe className="w-4 h-4 text-[#8A847C]" />,
    },
  ];

  const filteredList = mockPlugins.filter((item) => {
    const matchesFilter =
      activeFilter === 'all' ||
      (activeFilter === 'builtin' && item.type === 'builtin') ||
      (activeFilter === 'mcp' && item.type === 'mcp') ||
      (activeFilter === 'custom' && item.type === 'custom');

    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const togglePlugin = (id: string) => {
    setPluginStates((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-[#FAF8F5] border border-[#E6DFD5] rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-[#E6DFD5] bg-[#F4EFEA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🧩</span>
            <h2 className="font-bold text-sm text-[#1E1C1A]">
              能力与插件驾驶舱 (Tool & Plugin Cockpit)
            </h2>
            <span className="px-2 py-0.5 bg-[#FAF8F5] border border-[#E6DFD5] rounded-full text-[10px] font-semibold text-[#D96B27]">
              {mockPlugins.filter((p) => pluginStates[p.id]).length} 个已激活插件
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#8A847C] hover:text-[#1E1C1A] hover:bg-[#EAE4DC] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-3.5 border-b border-[#E6DFD5] bg-white flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A847C]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索能力工具、MCP Servers 或自定义插件..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#FAF8F5] border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg text-xs text-[#1E1C1A] placeholder-[#8A847C] outline-none"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#F4EFEA] p-1 rounded-lg border border-[#E6DFD5]">
            {[
              { id: 'all', label: '全部 (5)' },
              { id: 'builtin', label: '内置 (2)' },
              { id: 'mcp', label: 'MCP (2)' },
              { id: 'custom', label: '扩展 (1)' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id as any)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
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
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredList.map((item) => {
            const isEnabled = !!pluginStates[item.id];
            return (
              <div
                key={item.id}
                className="p-3 bg-white rounded-xl border border-[#E6DFD5] flex items-center justify-between gap-3 hover:border-[#D96B27]/40 transition-all shadow-xs"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#E6DFD5] flex items-center justify-center flex-shrink-0 mt-0.5">
                    {item.icon}
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-semibold text-xs text-[#1E1C1A] truncate">
                      {item.name}
                    </div>
                    <div className="text-[11px] text-[#6B665F] truncate">{item.description}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {isEnabled ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7] rounded-full text-[10px] font-medium font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32]" />
                      {item.statusLabel}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F4EFEA] text-[#8A847C] border border-[#E6DFD5] rounded-full text-[10px] font-medium font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#8A847C]" />
                      已禁用
                    </span>
                  )}

                  {/* Toggle Switch */}
                  <button
                    onClick={() => togglePlugin(item.id)}
                    className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
                      isEnabled ? 'bg-[#D96B27]' : 'bg-[#D5CCC0]'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        isEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-[#E6DFD5] bg-[#F4EFEA] flex items-center justify-between">
          <button
            onClick={() => alert('已开启 MCP / 插件配置向导')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D96B27] hover:bg-[#B8551B] text-white rounded-lg text-xs font-medium transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>添加 MCP Server / 插件</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {}}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-[#E6DFD5] hover:bg-[#FAF8F5] text-[#3D3A36] rounded-lg text-xs font-medium transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>刷新状态</span>
            </button>
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 bg-white border border-[#E6DFD5] hover:bg-[#FAF8F5] text-[#3D3A36] rounded-lg text-xs font-medium transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
