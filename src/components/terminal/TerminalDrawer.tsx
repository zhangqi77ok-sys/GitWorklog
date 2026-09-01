import React, { useState } from 'react';
import { Terminal, ChevronUp, ChevronDown, Trash2, Play } from 'lucide-react';
import { useProjectSessionStore } from '../../store/useProjectSessionStore';

interface TerminalDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const TerminalDrawer: React.FC<TerminalDrawerProps> = ({ isOpen, onToggle }) => {
  const { projects, activeProjectId } = useProjectSessionStore();
  const activeProject = projects.find(p => p.id === activeProjectId);

  const [logs, setLogs] = useState<string[]>([
    'Tcode Rail-Sandboxed Terminal v2.0',
    `当前工作区: ${activeProject?.path || 'D:\\weihu\\agent-learning'}`,
    '输入命令并回车即可执行...',
  ]);
  const [cmd, setCmd] = useState('');

  const handleRunCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmd.trim()) return;

    const command = cmd.trim();
    setCmd('');
    setLogs(prev => [
      ...prev,
      `PS ${activeProject?.path || 'D:\\weihu\\agent-learning'}> ${command}`,
      `[Tcode Core]: 已发送命令 "${command}" 到宿主沙箱进程。`,
    ]);
  };

  return (
    <div className="bg-[#161412] border-t border-[#2D2A26] flex flex-col transition-all">
      {/* Terminal Title Bar */}
      <div className="h-8 px-3 bg-[#1E1C1A] border-b border-[#2D2A26] flex items-center justify-between select-none">
        <div className="flex items-center gap-2 text-xs text-[#D5CEBF] font-mono">
          <Terminal className="w-3.5 h-3.5 text-[#D96B27]" />
          <span>集成终端 (PowerShell)</span>
          <span className="text-[10px] text-[#8A847C]">
            [{activeProject?.name || 'agent-learning'}]
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setLogs([])}
            className="p-1 text-[#8A847C] hover:text-[#D5CEBF] rounded transition-colors"
            title="清屏"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onToggle}
            className="p-1 text-[#8A847C] hover:text-[#D5CEBF] rounded transition-colors"
            title={isOpen ? '折叠终端' : '展开终端'}
          >
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      {isOpen && (
        <div className="h-44 flex flex-col p-2.5 font-mono text-xs text-[#D5CEBF] overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-1 select-text">
            {logs.map((log, i) => (
              <div key={i} className="leading-relaxed">
                {log}
              </div>
            ))}
          </div>

          {/* Command Input */}
          <form onSubmit={handleRunCommand} className="flex items-center gap-1 pt-1.5 border-t border-[#2D2A26]">
            <span className="text-[#D96B27] font-bold">PS &gt;</span>
            <input
              type="text"
              value={cmd}
              onChange={e => setCmd(e.target.value)}
              placeholder="输入 shell / cargo / npm 命令..."
              className="flex-1 bg-transparent text-[#FAF8F5] outline-none text-xs"
            />
            <button type="submit" className="text-[#8A847C] hover:text-[#D96B27]">
              <Play className="w-3 h-3" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
