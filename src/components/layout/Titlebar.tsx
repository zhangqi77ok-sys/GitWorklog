import React, { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";

interface TitlebarProps {
  onOpenSettings?: () => void;
}

export const Titlebar: React.FC<TitlebarProps> = () => {
  const [currentProject, setCurrentProject] = useState("agent-learning");

  useEffect(() => {
    const handleSwitch = (e: any) => {
      if (e.detail?.projectName) {
        setCurrentProject(e.detail.projectName);
      }
    };
    window.addEventListener("project-switched", handleSwitch);
    return () => window.removeEventListener("project-switched", handleSwitch);
  }, []);

  return (
    <header className="h-10 bg-[#faf8f5] border-b border-[#e5dfd8] px-3 flex justify-between items-center select-none shrink-0">
      {/* 左侧：Logo 与工程名 */}
      <div className="flex items-center gap-2 text-xs">
        <div className="w-5 h-5 rounded bg-[#d96b27] text-white flex items-center justify-center font-bold text-[11px] shadow-sm">
          C
        </div>
        <span className="font-bold text-[#1e1b18] tracking-tight">CodeMind-Hub</span>
        <ChevronRight size={12} className="text-[#9c948a]" />
        <span className="text-[#645e57] font-medium">{currentProject}</span>
      </div>

      {/* 中间：真实环境与状态胶囊 */}
      <div className="flex items-center gap-2">
        <div className="bg-white border border-[#e5dfd8] px-2.5 py-0.5 rounded-full text-[11px] text-[#645e57] flex items-center gap-1.5 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>
          <span>Tauri Native v0.10 · 生产就绪</span>
        </div>
      </div>

      {/* 右侧空白占位，保持视觉极简 */}
      <div className="w-12" />
    </header>
  );
};
