import React from "react";

export const GeneralPreferencesPane: React.FC = () => {
  return (
    <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4 bg-white text-xs">
      <div className="pb-3 border-b border-[#e5dfd8]">
        <h3 className="font-bold text-sm text-[#1e1b18]">
          🎨 外观与系统偏好 (General Preferences)
        </h3>
        <p className="text-xs text-[#645e57]">
          定制工作空间界面风格、主题色调与常用全局快捷键速查。
        </p>
      </div>

      {/* 主题选择 */}
      <div className="bg-[#f8fafc] border border-[#e5dfd8] rounded-xl p-4 flex flex-col gap-3">
        <span className="font-bold text-xs text-[#1e1b18]">🎨 主题风格选型</span>
        <div className="grid grid-cols-2 gap-3">
          <div className="border-2 border-[#d96b27] bg-white rounded-lg p-3 flex flex-col gap-2 cursor-pointer shadow-sm">
            <div className="h-12 rounded bg-gradient-to-br from-[#faf8f5] to-[#f4efea] border border-[#e5dfd8]"></div>
            <span className="font-semibold text-xs text-[#1e1b18]">
              Cursor 极简暖白 (Warm Off-White)
            </span>
          </div>
          <div className="border border-[#e5dfd8] bg-[#f8fafc] opacity-60 rounded-lg p-3 flex flex-col gap-2 cursor-not-allowed">
            <div className="h-12 rounded bg-gradient-to-br from-[#1e1b18] to-[#2d2823] border border-[#3e3830]"></div>
            <span className="font-semibold text-xs text-[#645e57]">
              黑曜石深色 (Dark Obsidian - 待开放)
            </span>
          </div>
        </div>
      </div>

      {/* 快捷键速查 */}
      <div className="bg-[#f8fafc] border border-[#e5dfd8] rounded-xl p-4 flex flex-col gap-2">
        <span className="font-bold text-xs text-[#1e1b18]">
          ⌨️ 常用快捷键速查表
        </span>
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex justify-between items-center py-1 border-b border-dashed border-[#e2e8f0]">
            <span className="font-mono font-semibold bg-white border border-[#cbd5e1] text-[#d96b27] px-2 py-0.5 rounded">
              Ctrl + ,
            </span>
            <span className="text-[#645e57]">打开全局 Settings 设置中枢</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-dashed border-[#e2e8f0]">
            <span className="font-mono font-semibold bg-white border border-[#cbd5e1] text-[#d96b27] px-2 py-0.5 rounded">
              Ctrl + `
            </span>
            <span className="text-[#645e57]">展开 / 折叠底部集成沙箱终端</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-dashed border-[#e2e8f0]">
            <span className="font-mono font-semibold bg-white border border-[#cbd5e1] text-[#d96b27] px-2 py-0.5 rounded">
              Ctrl + S
            </span>
            <span className="text-[#645e57]">保存当前代码文件</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="font-mono font-semibold bg-white border border-[#cbd5e1] text-[#d96b27] px-2 py-0.5 rounded">
              Esc
            </span>
            <span className="text-[#645e57]">快速关闭设置与授权弹窗</span>
          </div>
        </div>
      </div>
    </div>
  );
};
