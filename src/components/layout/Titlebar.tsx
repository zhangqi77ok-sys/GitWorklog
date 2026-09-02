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

  const getHeaders = (): Record<string, string> => {
    const token = typeof window !== 'undefined' ? (window as any).__TCODE_HOST_TOKEN__ || '' : '';
    const headers: Record<string, string> = {};
    if (token) {
      headers['X-Tcode-Token'] = token;
    }
    return headers;
  };

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__?.invoke) {
        await getCurrentWindow().minimize();
        return;
      }
    } catch (e) {}
    try {
      await fetch('/api/window/minimize', { headers: getHeaders() });
    } catch (e) {
      console.warn('Window minimize error:', e);
    }
  };

  const handleMaximize = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__?.invoke) {
        await getCurrentWindow().toggleMaximize();
        return;
      }
    } catch (e) {}
    try {
      await fetch('/api/window/maximize', { headers: getHeaders() });
    } catch (e) {
      console.warn('Window maximize error:', e);
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__?.invoke) {
        await getCurrentWindow().close();
        return;
      }
    } catch (e) {}
    try {
      await fetch('/api/window/close', { headers: getHeaders() });
    } catch (e) {
      console.warn('Window close error:', e);
    }
  };

  return (
    <header
      onDoubleClick={(e) => handleMaximize(e)}
      data-tauri-drag-region
      className="h-9.5 bg-[#FAF9F6] border-b border-[#E8E5DF] flex items-center justify-between px-3 select-none z-30 relative pywebview-drag-region cursor-default"
    >
      {/* Left: Brand Logo + Project Breadcrumb Pill + Discrete Gateway Indicator */}
      <div className="flex items-center gap-2.5" data-tauri-no-drag>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-[#18181B] flex items-center justify-center text-white font-bold text-[11px] shadow-2xs">
            T
          </div>
          <span className="font-semibold text-xs text-[#18181B] tracking-tight">
            Tcode Studio
          </span>
        </div>

        {/* Project Breadcrumb Pill */}
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/[0.03] border border-black/[0.05] text-[11px] text-[#52525B] font-mono">
          <span className="opacity-50 text-[10px]">/</span>
          <span className="font-medium truncate max-w-[160px]">
            {activeProject?.name || 'agent-learning'}
          </span>
        </div>

        {/* Discrete Live Gateway Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 bg-[#10A37F]/10 border border-[#10A37F]/20 rounded-full text-[10px] font-medium text-[#10A37F]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10A37F] animate-pulse" />
          <span>{activeChannel?.name?.split(' ')[0] || 'DeepSeek'} · 就绪</span>
        </div>
      </div>

      {/* Right: Clean Window Controls Only */}
      <div className="flex items-center gap-0.5" data-tauri-no-drag>
        <button
          onClick={handleMinimize}
          className="w-7 h-7 flex items-center justify-center hover:bg-black/[0.06] active:bg-black/[0.1] rounded text-[#71717A] hover:text-[#18181B] transition-colors cursor-pointer"
          title="最小化"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-7 h-7 flex items-center justify-center hover:bg-black/[0.06] active:bg-black/[0.1] rounded text-[#71717A] hover:text-[#18181B] transition-colors cursor-pointer"
          title="最大化 / 还原"
        >
          <Square className="w-2.5 h-2.5" />
        </button>
        <button
          onClick={handleClose}
          className="w-7 h-7 flex items-center justify-center hover:bg-[#EF4444] hover:text-white active:bg-[#DC2626] rounded text-[#71717A] transition-colors cursor-pointer"
          title="关闭"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
