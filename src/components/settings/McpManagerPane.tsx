import React, { useState } from "react";
import { McpTool } from "../../types";
import { Plus } from "lucide-react";

export const McpManagerPane: React.FC = () => {
  const [tools, setTools] = useState<McpTool[]>([
    {
      id: "mcp-fs-read",
      name: "fs_read_file",
      server: "filesystem",
      desc: "读取工程目录下的指定文件内容与元数据",
      enabled: true,
    },
    {
      id: "mcp-fs-write",
      name: "fs_write_file",
      server: "filesystem",
      desc: "向工程目录下安全写入新代码文件或覆盖已有模块",
      enabled: true,
    },
    {
      id: "mcp-shell-exec",
      name: "shell_run_cmd",
      server: "terminal",
      desc: "在隔离沙箱环境中执行 Python/Shell 终端脚本",
      enabled: true,
    },
  ]);

  const toggleTool = (id: string) => {
    setTools(
      tools.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t))
    );
  };

  return (
    <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4 bg-white">
      <div className="flex justify-between items-center pb-3 border-b border-[#e5dfd8]">
        <div>
          <h3 className="font-bold text-sm text-[#1e1b18]">
            🔌 MCP 协议服务与工具插件 (Model Context Protocol)
          </h3>
          <p className="text-xs text-[#645e57]">
            通过标准 MCP 协议扩展本地文件读写、沙箱终端执行与外部集成能力。
          </p>
        </div>
        <button
          onClick={() => alert("＋ 添加 MCP Server")}
          className="bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#cbd5e1] text-xs font-semibold px-3 py-1.5 rounded-md flex items-center gap-1 cursor-pointer"
        >
          <Plus size={12} /> 添加 MCP Server
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {tools.map((tool) => (
          <div
            key={tool.id}
            className="bg-[#f8fafc] border border-[#e5dfd8] rounded-xl p-3.5 flex justify-between items-center"
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs font-mono text-[#1e1b18]">
                  {tool.name}
                </span>
                <span className="bg-[#f1f5f9] text-[#645e57] text-[10px] px-1.5 py-0.5 rounded font-mono">
                  Server: {tool.server}
                </span>
              </div>
              <span className="text-xs text-[#645e57]">{tool.desc}</span>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={tool.enabled}
                onChange={() => toggleTool(tool.id)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-[#cbd5e1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10b981]"></div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};
