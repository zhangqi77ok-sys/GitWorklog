import React from 'react';
import { MessageSquare, FolderTree, Cpu, Settings, Terminal, Shield, Code2 } from 'lucide-react';

export type ActiveTab = 'chat' | 'files' | 'plugins' | 'snippets' | 'terminal' | 'settings';

interface ActivityBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({ activeTab, onSelectTab }) => {
  const topItems: { id: ActiveTab; icon: React.ReactNode; label: string }[] = [
    { id: 'chat', icon: <MessageSquare size={17} strokeWidth={1.8} />, label: '智能会话' },
    { id: 'files', icon: <FolderTree size={17} strokeWidth={1.8} />, label: '工作区与文件' },
    { id: 'snippets', icon: <Code2 size={17} strokeWidth={1.8} />, label: '代码片段与知识库' },
    { id: 'plugins', icon: <Cpu size={17} strokeWidth={1.8} />, label: '能力插件与 MCP' },
    { id: 'terminal', icon: <Terminal size={17} strokeWidth={1.8} />, label: '控制台与终端' },
  ];

  return (
    <aside className="w-12 bg-[#F4F2EE] border-r border-[#E8E5DF] flex flex-col items-center py-2.5 flex-shrink-0 select-none z-10">
      {/* Top Nav Items */}
      <div className="flex flex-col items-center gap-1 w-full">
        {topItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              title={item.label}
              className={`w-8.5 h-8.5 rounded-lg flex items-center justify-center transition-all duration-150 cursor-pointer relative ${
                isActive
                  ? 'bg-white text-[#18181B] shadow-2xs'
                  : 'text-[#71717A] hover:text-[#18181B] hover:bg-black/[0.04]'
              }`}
            >
              {item.icon}
              {isActive && (
                <div className="absolute left-0 w-0.5 h-4 bg-[#D96B27] rounded-r-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Nav: Settings & Safe Rails Indicator */}
      <div className="mt-auto flex flex-col items-center gap-1.5 w-full">
        <button
          onClick={() => onSelectTab('settings')}
          title="系统设置"
          className={`w-8.5 h-8.5 rounded-lg flex items-center justify-center transition-all duration-150 cursor-pointer relative ${
            activeTab === 'settings'
              ? 'bg-white text-[#18181B] shadow-2xs'
              : 'text-[#71717A] hover:text-[#18181B] hover:bg-black/[0.04]'
          }`}
        >
          <Settings size={17} strokeWidth={1.8} />
          {activeTab === 'settings' && (
            <div className="absolute left-0 w-0.5 h-4 bg-[#D96B27] rounded-r-full" />
          )}
        </button>

        <div
          title="安全沙箱与双环铁轨运行中 (Rails Protected)"
          className="w-2 h-2 rounded-full bg-[#10A37F] mt-1 opacity-70 hover:opacity-100 transition-opacity cursor-help"
        />
      </div>
    </aside>
  );
};
