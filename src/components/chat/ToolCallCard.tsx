import React, { useState } from "react";
import { Wrench, ChevronDown, ChevronUp, FileText, Terminal, Network, Sparkles } from "lucide-react";
import { ToolInvocation } from "../../types/contracts";

interface ToolCallCardProps {
  invocation: ToolInvocation;
}

const TOOL_ICON: Record<string, React.ElementType> = {
  skill: Sparkles,
  mcp: Network,
  read_file: FileText,
  execute_command: Terminal,
};

const TOOL_LABEL: Record<string, string> = {
  skill: "调用 Skill",
  mcp: "调用 MCP 工具",
  read_file: "读取文件",
  execute_command: "执行命令",
};

/** 智能体工具调用折叠卡片：默认折叠，点击展开查看参数与说明（skill/mcp 等仅展示，不执行） */
export const ToolCallCard: React.FC<ToolCallCardProps> = ({ invocation }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = TOOL_ICON[invocation.toolCall.tool] || Wrench;
  const label = TOOL_LABEL[invocation.toolCall.tool] || invocation.toolCall.tool;
  const title =
    invocation.toolCall.name ||
    invocation.toolCall.path ||
    (invocation.toolCall.args
      ? JSON.stringify(invocation.toolCall.args).slice(0, 40)
      : "") ||
    invocation.toolCall.tool;

  return (
    <div className="border border-[#e7e2d9] bg-white rounded-xl shadow-xs overflow-hidden animate-in fade-in slide-in-from-bottom-2">
      <div
        className="px-3 py-2 flex items-center gap-2 cursor-pointer"
        onClick={() => setIsExpanded((prev) => !prev)}
        title={isExpanded ? "收起调用详情" : "展开调用详情"}
      >
        <div className="w-6 h-6 rounded-lg bg-[#f4efea] text-[#78716c] flex items-center justify-center shrink-0">
          <Icon size={13} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-[#1e1b18] flex items-center gap-1.5 flex-wrap">
            <span>{label}</span>
            {invocation.status === "FAILED" && (
              <span className="text-[10px] bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca] px-1.5 py-0.5 rounded font-semibold">
                失败
              </span>
            )}
          </div>
          <div className="text-[10px] text-[#78716c] font-mono truncate max-w-[280px]">{title}</div>
        </div>
        {isExpanded ? (
          <ChevronUp size={13} className="text-[#a8a29e] shrink-0" />
        ) : (
          <ChevronDown size={13} className="text-[#a8a29e] shrink-0" />
        )}
      </div>

      {isExpanded && (
        <div className="px-3 pb-2.5 flex flex-col gap-1.5 text-[11px] border-t border-[#f4efea] bg-[#faf8f5]">
          {invocation.toolCall.description && (
            <div className="text-[#44403c] leading-relaxed">{invocation.toolCall.description}</div>
          )}
          {invocation.toolCall.args && Object.keys(invocation.toolCall.args).length > 0 && (
            <pre className="bg-[#f4efea] rounded-lg p-2 overflow-x-auto text-[10px] text-[#1e1b18] font-mono whitespace-pre-wrap break-all">
              {JSON.stringify(invocation.toolCall.args, null, 2)}
            </pre>
          )}
          {invocation.errorMessage && (
            <div className="text-[#b91c1c] break-all">{invocation.errorMessage}</div>
          )}
        </div>
      )}
    </div>
  );
};
