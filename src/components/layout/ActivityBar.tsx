import React from "react";
import {
  MessageSquare,
  Network,
  Database,
  Layers,
  Settings,
} from "lucide-react";

interface ActivityBarProps {
  activeView: string;
  onSelectView: (view: string) => void;
  onOpenSettings: () => void;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activeView,
  onSelectView,
  onOpenSettings,
}) => {
  return (
    <aside className="w-12 bg-[#f4efea] border-r border-[#e5dfd8] flex flex-col justify-between items-center py-2.5 shrink-0 select-none">
      {/* 顶部主工作区导航图标 */}
      <div className="flex flex-col gap-1.5 items-center w-full">
        <button
          onClick={() => onSelectView("chat")}
          title="AI 交互对话"
          className={`w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
            activeView === "chat"
              ? "bg-white text-[#d96b27] shadow-sm border border-[#e5dfd8]"
              : "text-[#645e57] hover:bg-[#ebe5df] hover:text-[#1e1b18]"
          }`}
        >
          <MessageSquare size={17} />
        </button>

        <button
          onClick={() => onSelectView("graph")}
          title="AST 知识图谱"
          className={`w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
            activeView === "graph"
              ? "bg-white text-[#d96b27] shadow-sm border border-[#e5dfd8]"
              : "text-[#645e57] hover:bg-[#ebe5df] hover:text-[#1e1b18]"
          }`}
        >
          <Network size={17} />
        </button>

        <button
          onClick={() => onSelectView("memory")}
          title="双层记忆系统"
          className={`w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
            activeView === "memory"
              ? "bg-white text-[#d96b27] shadow-sm border border-[#e5dfd8]"
              : "text-[#645e57] hover:bg-[#ebe5df] hover:text-[#1e1b18]"
          }`}
        >
          <Database size={17} />
        </button>

        <button
          onClick={() => onSelectView("harness")}
          title="沙箱执行与代码防护"
          className={`w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
            activeView === "harness"
              ? "bg-white text-[#d96b27] shadow-sm border border-[#e5dfd8]"
              : "text-[#645e57] hover:bg-[#ebe5df] hover:text-[#1e1b18]"
          }`}
        >
          <Layers size={17} />
        </button>
      </div>

      {/* 左下角固定：Setting 设置中枢入口 (统一收敛 LLM网关/SKILL/MCP) */}
      <div className="flex flex-col items-center w-full pt-2 border-t border-[#e5dfd8]">
        <button
          onClick={onOpenSettings}
          title="全局设置与 Cockpit 网关 (Ctrl+,)"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[#645e57] hover:text-[#d96b27] hover:bg-white hover:shadow-sm hover:border hover:border-[#e5dfd8] cursor-pointer transition-all hover:rotate-45"
        >
          <Settings size={18} />
        </button>
      </div>
    </aside>
  );
};
