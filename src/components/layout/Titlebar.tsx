import React from 'react';
import { Cpu, ShieldCheck, Sparkles, Sun, Moon, Minus, Square, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useGatewayStore } from '../../store/useGatewayStore';
import { useProjectSessionStore } from '../../store/useProjectSessionStore';

interface TitlebarProps {
  theme: string;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenPlugins: () => void;
  pluginCount: number;
}

export const Titlebar: React.FC<TitlebarProps> = ({
  theme,
  onToggleTheme,
  onOpenSettings,
  onOpenPlugins,
  pluginCount,
}) => {
  const { channels, activeChannelId } = useGatewayStore();
  const { projects, activeProjectId } = useProjectSessionStore();
  const activeChannel = channels.find((c) => c.id === activeChannelId) || channels[0];
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  const handleMinimize = async () => {
    try {
      await getCurrentWindow().minimize();
    } catch (e) {
      console.warn('Tauri window minimize error:', e);
    }
  };

  const handleMaximize = async () => {
    try {
      await getCurrentWindow().toggleMaximize();
    } catch (e) {
      console.warn('Tauri window maximize error:', e);
    }
  };

  const handleClose = async () => {
    try {
      await getCurrentWindow().close();
    } catch (e) {
      console.warn('Tauri window close error:', e);
    }
  };

  return (
    <header className="h-10 bg-[#FAF8F5] border-b border-[#E6DFD5] flex items-center justify-between px-3 select-none z-20">
      {/* Left: Brand + Active Project + Rail Protection Pill */}
      <div className="flex items-center gap-2.5">
        <div className="w-5 h-5 rounded bg-[#D96B27] flex items-center justify-center text-white font-extrabold text-xs shadow-xs">
          T
        </div>
        <span className="font-bold text-xs text-[#1E1C1A] tracking-tight flex items-center gap-1.5">
          Tcode IDE
          <span className="text-[11px] text-[#8A847C] font-normal">
            - {activeProject?.name || 'agent-learning'}
          </span>
        </span>
        <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 bg-[#E8F5E9] border border-[#A5D6A7] rounded-full text-[10px] font-medium text-[#2E7D32]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32] animate-pulse" />
          <span>Gateway Connected</span>
          {activeChannel?.last_latency_ms ? (
            <span className="font-mono text-[9px] text-[#2E7D32]/80">
              · {activeChannel.last_latency_ms}ms
            </span>
          ) : null}
        </div>
      </div>

      {/* Right: Quick Action Buttons & Window Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenPlugins}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#E6DFD5] bg-white hover:bg-[#FAF8F5] active:bg-[#F4EFEA] text-xs text-[#1E1C1A] transition-colors shadow-2xs cursor-pointer"
          title="管理能力插件与 MCP 工具"
        >
          <Cpu className="w-3.5 h-3.5 text-[#D96B27]" />
          <span>能力插件 ({pluginCount})</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#E6DFD5] bg-white hover:bg-[#FAF8F5] active:bg-[#F4EFEA] text-xs text-[#1E1C1A] transition-colors shadow-2xs cursor-pointer"
          title="配置 AI 模型网关与调度"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#D96B27]" />
          <span>模型网关 ({activeChannel?.name?.split(' ')[0] || 'DeepSeek'})</span>
        </button>

        <button
          onClick={onToggleTheme}
          title="切换色彩主题"
          className="w-7 h-7 rounded-md border border-[#E6DFD5] bg-white hover:bg-[#FAF8F5] active:bg-[#F4EFEA] text-[#6B665F] flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>

        <div className="h-4 w-px bg-[#E6DFD5] mx-0.5" />

        {/* Window Controls */}
        <div className="flex items-center gap-1 text-[#8A847C]">
          <button
            onClick={handleMinimize}
            className="w-6 h-6 flex items-center justify-center hover:bg-[#EAE4DC] active:bg-[#D5CCC0] rounded text-xs transition-colors cursor-pointer"
            title="最小化"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleMaximize}
            className="w-6 h-6 flex items-center justify-center hover:bg-[#EAE4DC] active:bg-[#D5CCC0] rounded text-xs transition-colors cursor-pointer"
            title="最大化 / 还原"
          >
            <Square className="w-2.5 h-2.5" />
          </button>
          <button
            onClick={handleClose}
            className="w-6 h-6 flex items-center justify-center hover:bg-[#FFEBEE] hover:text-[#C62828] active:bg-[#FFCDD2] rounded text-xs transition-colors cursor-pointer"
            title="关闭窗口"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
