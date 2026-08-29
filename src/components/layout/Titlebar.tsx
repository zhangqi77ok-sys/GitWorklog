import React from "react";
import {
  PanelLeft,
  Columns2,
  Plus,
  X,
  Minus,
  Square,
  Settings,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export interface SessionTabItem {
  id: string;
  title: string;
  projectName?: string;
}

interface TitlebarProps {
  tabs?: SessionTabItem[];
  activeTabId?: string;
  onSelectTab?: (id: string) => void;
  onCloseTab?: (id: string, e: React.MouseEvent) => void;
  onNewTab?: () => void;
  onToggleLeftPanel?: () => void;
  onOpenSettings?: () => void;
  isLeftPanelOpen?: boolean;
}

export const Titlebar: React.FC<TitlebarProps> = ({
  tabs = [],
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onToggleLeftPanel,
  onOpenSettings,
  isLeftPanelOpen = true,
}) => {
  // Tauri 原生窗口控制
  const handleMinimize = async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.minimize();
    } catch (e) {}
  };

  const handleMaximize = async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.toggleMaximize();
    } catch (e) {}
  };

  const handleClose = async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.close();
    } catch (e) {}
  };

  return (
    <header
      data-tauri-drag-region
      className="h-9 bg-[#f4efea] border-b border-[#e5dfd8] flex items-center justify-between select-none shrink-0 px-2 text-xs relative z-30"
    >
      {/* 左侧：侧边栏折叠与分栏图标 */}
      <div className="flex items-center gap-1 shrink-0 mr-2">
        <button
          type="button"
          onClick={onToggleLeftPanel}
          className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-colors ${
            isLeftPanelOpen
              ? "text-[#1e1b18] hover:bg-[#e7e0d6]"
              : "text-[#9c948a] hover:bg-[#e7e0d6]"
          }`}
          title={isLeftPanelOpen ? "折叠左侧会话栏" : "展开左侧会话栏"}
        >
          <PanelLeft size={14} />
        </button>
        <button
          type="button"
          className="w-6 h-6 rounded flex items-center justify-center text-[#78716c] hover:bg-[#e7e0d6] cursor-pointer"
          title="分栏视图"
        >
          <Columns2 size={13} />
        </button>
      </div>

      {/* 中间：横向多标签页列表 (Session Tabs) */}
      <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-none h-full pt-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab && onSelectTab(tab.id)}
              className={`group h-8 px-2.5 rounded-t-lg flex items-center gap-1.5 cursor-pointer text-xs transition-all max-w-[140px] shrink-0 border-t border-x ${
                isActive
                  ? "bg-white border-[#e5dfd8] border-b-transparent text-[#1e1b18] font-medium shadow-2xs"
                  : "bg-transparent border-transparent text-[#645e57] hover:bg-[#eae3dc]/70"
              }`}
              title={tab.title}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] shrink-0" />
              <span className="truncate text-[11px] font-normal">{tab.title}</span>
              {tabs.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => onCloseTab && onCloseTab(tab.id, e)}
                  className="w-3.5 h-3.5 rounded hover:bg-[#ded7ce] flex items-center justify-center text-[#9ca3af] hover:text-[#1e1b18] opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"
                  title="关闭标签页"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          );
        })}

        {/* 新建会话标签页按钮 */}
        <button
          type="button"
          onClick={onNewTab}
          className="w-6 h-6 rounded-md hover:bg-[#e7e0d6] flex items-center justify-center text-[#78716c] hover:text-[#1e1b18] cursor-pointer transition-colors ml-0.5 shrink-0"
          title="新建对话标签页"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* 右侧：设置与 Windows 窗口控制按钮 */}
      <div className="flex items-center gap-1 shrink-0 ml-2">
        <button
          type="button"
          onClick={onOpenSettings}
          className="w-6 h-6 rounded hover:bg-[#e7e0d6] flex items-center justify-center text-[#78716c] hover:text-[#1e1b18] cursor-pointer transition-colors"
          title="全局设置"
        >
          <Settings size={13} />
        </button>

        {/* 窗口最小化、最大化、关闭 */}
        <div className="flex items-center gap-0.5 pl-1.5 border-l border-[#e5dfd8]">
          <button
            type="button"
            onClick={handleMinimize}
            className="w-6 h-6 rounded hover:bg-[#e7e0d6] flex items-center justify-center text-[#78716c] hover:text-[#1e1b18] cursor-pointer transition-colors"
            title="最小化"
          >
            <Minus size={12} />
          </button>
          <button
            type="button"
            onClick={handleMaximize}
            className="w-6 h-6 rounded hover:bg-[#e7e0d6] flex items-center justify-center text-[#78716c] hover:text-[#1e1b18] cursor-pointer transition-colors"
            title="最大化"
          >
            <Square size={10} />
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="w-6 h-6 rounded hover:bg-[#ef4444] hover:text-white flex items-center justify-center text-[#78716c] cursor-pointer transition-colors"
            title="关闭"
          >
            <X size={12} />
          </button>
        </div>
      </div>
    </header>
  );
};
