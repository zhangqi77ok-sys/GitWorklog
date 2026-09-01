import React from 'react';
import { Cpu, ShieldCheck, Sparkles, Sun, Moon } from 'lucide-react';
import { useGatewayStore } from '../../store/useGatewayStore';

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
  const activeChannel = channels.find(c => c.id === activeChannelId) || channels[0];

  return (
    <header className="h-10 bg-[#FAF8F5] border-b border-[#E6DFD5] flex items-center justify-between px-4 select-none z-20">
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-md bg-[#D96B27] flex items-center justify-center text-white font-extrabold text-xs shadow-xs">
          T
        </div>
        <span className="font-bold text-sm text-[#1E1C1A] tracking-tight">
          Tcode <span className="text-[11px] text-[#8A847C] font-normal">Next-Gen Studio</span>
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#D96B27]/10 text-[#D96B27] rounded-full text-[10px] font-semibold">
          <ShieldCheck className="w-3 h-3" />
          Rail-Protected
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenPlugins}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#E6DFD5] bg-white hover:bg-[#FAF8F5] text-xs text-[#1E1C1A] transition-colors"
        >
          <Cpu className="w-3.5 h-3.5 text-[#D96B27]" />
          <span>能力插件 ({pluginCount})</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#E6DFD5] bg-white hover:bg-[#FAF8F5] text-xs text-[#1E1C1A] transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#D96B27]" />
          <span>模型网关 ({activeChannel?.name?.split(' ')[0] || 'DeepSeek'})</span>
          {activeChannel?.last_latency_ms && (
            <span className="text-[10px] text-[#2E7D32] font-mono">
              {activeChannel.last_latency_ms}ms
            </span>
          )}
        </button>

        <button
          onClick={onToggleTheme}
          title="切换色彩主题"
          className="w-7 h-7 rounded-md border border-[#E6DFD5] bg-white hover:bg-[#FAF8F5] text-[#6B665F] flex items-center justify-center transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>
      </div>
    </header>
  );
};
