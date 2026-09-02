import React from 'react';
import { Minus, Square, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useGatewayStore } from '../../store/useGatewayStore';
import { useProjectSessionStore } from '../../store/useProjectSessionStore';

export const Titlebar: React.FC = () => {
  const { channels, activeChannelId } = useGatewayStore();
  const { projects, activeProjectId } = useProjectSessionStore();
  const activeChannel = channels.find((c) => c.id === activeChannelId) || channels[0];
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  const handleMinimize = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
        await getCurrentWindow().minimize();
        return;
      }
    } catch (e) {}
    try {
      await fetch('/api/window/minimize');
    } catch (e) {
      console.warn('Window minimize error:', e);
    }
  };

  const handleMaximize = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
        await getCurrentWindow().toggleMaximize();
        return;
      }
    } catch (e) {}
    try {
      await fetch('/api/window/maximize');
    } catch (e) {
      console.warn('Window maximize error:', e);
    }
  };

  const handleClose = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
        await getCurrentWindow().close();
        return;
      }
    } catch (e) {}
    try {
      await fetch('/api/window/close');
    } catch (e) {
      console.warn('Window close error:', e);
    }
  };

  return (
    <header
      onDoubleClick={handleMaximize}
      data-tauri-drag-region
      className="h-9 bg-[#FAF8F5] border-b border-[#E6DFD5] flex items-center justify-between px-3 select-none z-20 pywebview-drag-region cursor-default"
    >
      {/* Left: Brand Logo + Project Name + Discrete Gateway Indicator */}
      <div className="flex items-center gap-2.5">
        <div className="w-4.5 h-4.5 rounded bg-[#D96B27] flex items-center justify-center text-white font-extrabold text-[11px] shadow-xs">
          T
        </div>
        <span className="font-bold text-xs text-[#1E1C1A] tracking-tight flex items-center gap-1.5">
          Tcode Studio
          <span className="text-[11px] text-[#8A847C] font-normal">
            — {activeProject?.name || 'agent-learning'}
          </span>
        </span>
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 bg-[#E8F5E9] border border-[#A5D6A7] rounded-full text-[10px] font-medium text-[#2E7D32]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32] animate-pulse" />
          <span>{activeChannel?.name?.split(' ')[0] || 'DeepSeek'} 就绪</span>
        </div>
      </div>

      {/* Right: Clean Window Controls Only */}
      <div className="flex items-center gap-0.5 text-[#8A847C]">
        <button
          onClick={handleMinimize}
          className="w-7 h-7 flex items-center justify-center hover:bg-[#EAE4DC] active:bg-[#D5CCC0] rounded text-xs transition-colors cursor-pointer"
          title="最小化"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-7 h-7 flex items-center justify-center hover:bg-[#EAE4DC] active:bg-[#D5CCC0] rounded text-xs transition-colors cursor-pointer"
          title="最大化 / 还原"
        >
          <Square className="w-2.5 h-2.5" />
        </button>
        <button
          onClick={handleClose}
          className="w-7 h-7 flex items-center justify-center hover:bg-[#FFEBEE] hover:text-[#C62828] active:bg-[#FFCDD2] rounded text-xs transition-colors cursor-pointer"
          title="关闭"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
