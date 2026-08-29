import React, { useState } from "react";
import { FileCode, Check, X, RotateCcw, Eye, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { FileChangeRecord, ParsedToolCall } from "../../types/contracts";
import { computeLineDiff } from "../../services/diffService";

/** 智能体文件修改工具标记：大模型按系统提示词在回复末尾输出该标记 + JSON */
export const TOOL_CALL_MARKER = "[[TOOL_CALL]]";

/**
 * 解析助手回复末尾的文件修改工具调用标记。
 * 解析失败时返回 null 并保留原文，让异常可见，避免静默吞掉。
 */
export function parseToolCallBlock(
  content: string
): { cleanContent: string; toolCall: ParsedToolCall } | null {
  const idx = content.lastIndexOf(TOOL_CALL_MARKER);
  if (idx < 0) return null;

  const raw = content.slice(idx + TOOL_CALL_MARKER.length).trim();
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn("[ToolCall] JSON 解析失败，标记保留在正文中:", err);
    return null;
  }

  const isValid =
    parsed &&
    parsed.type === "tool_call" &&
    typeof parsed.tool === "string" &&
    parsed.tool.trim().length > 0;

  if (!isValid) {
    console.warn("[ToolCall] 标记存在但 JSON 结构不合法，保留原文:", raw);
    return null;
  }

  const toolCall: ParsedToolCall = {
    type: "tool_call",
    tool: parsed.tool.trim(),
    ...(typeof parsed.name === "string" && parsed.name.trim() ? { name: parsed.name.trim() } : {}),
    ...(typeof parsed.path === "string" && parsed.path.trim() ? { path: parsed.path.trim() } : {}),
    ...(parsed.args && typeof parsed.args === "object" ? { args: parsed.args } : {}),
    ...(typeof parsed.content === "string" ? { content: parsed.content } : {}),
    ...(typeof parsed.description === "string" && parsed.description.trim()
      ? { description: parsed.description.trim() }
      : {}),
  };
  return { cleanContent: content.slice(0, idx).trimEnd(), toolCall };
}

interface FileChangeCardProps {
  record: FileChangeRecord;
  onApply: (id: string) => void;
  onDiscard: (id: string) => void;
  onViewFile: (record: FileChangeRecord) => void;
}

const STATUS_META: Record<
  FileChangeRecord["status"],
  { label: string; className: string }
> = {
  PENDING_APPROVAL: { label: "待审批", className: "bg-[#fffbeb] text-[#b45309] border-[#fde68a]" },
  APPLIED: { label: "已应用", className: "bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]" },
  REVERTED: { label: "已撤回", className: "bg-[#f1f5f9] text-[#64748b] border-[#e2e8f0]" },
  FAILED: { label: "失败", className: "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]" },
};

/** 智能体文件修改工具卡片：默认折叠展示概要（+N/-N），展开看 diff，点击文件路径右侧打开 */
export const FileChangeCard: React.FC<FileChangeCardProps> = ({
  record,
  onApply,
  onDiscard,
  onViewFile,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const diffLines = computeLineDiff(record.originalContent, record.newContent);
  const addCount = diffLines.filter((l) => l.type === "add").length;
  const removeCount = diffLines.filter((l) => l.type === "remove").length;
  const status = STATUS_META[record.status];

  return (
    <div className="border border-[#fed7aa] bg-[#fff7ed] rounded-xl shadow-xs overflow-hidden animate-in fade-in slide-in-from-bottom-2">
      {/* 头部：工具名 + 状态 + 行数统计 + 折叠箭头；点击文件路径在右侧打开 */}
      <div className="px-3 py-2.5 border-b border-[#fed7aa]/60 bg-[#fff7ed] flex items-center gap-2">
        <div
          className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
          onClick={() => setIsExpanded((prev) => !prev)}
          title={isExpanded ? "收起变更详情" : "展开变更详情"}
        >
          <div className="w-6 h-6 rounded-lg bg-[#fef3eb] text-[#d96b27] flex items-center justify-center shrink-0">
            <FileCode size={13} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-[#1e1b18] flex items-center gap-1.5 flex-wrap">
              <span>write_file</span>
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${status.className}`}
              >
                {status.label}
              </span>
              <span className="text-[10px] font-mono font-semibold">
                <span className="text-[#16a34a]">+{addCount}</span>
                <span className="text-[#78716c] mx-0.5">/</span>
                <span className="text-[#dc2626]">-{removeCount}</span>
              </span>
            </div>
            <div
              className="text-[10px] text-[#78716c] font-mono truncate max-w-[260px] hover:text-[#d96b27] hover:underline"
              title="点击在右侧打开文件"
              onClick={(e) => {
                e.stopPropagation();
                onViewFile(record);
              }}
            >
              {record.toolCall.path}
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp size={13} className="text-[#a8a29e] shrink-0" />
          ) : (
            <ChevronDown size={13} className="text-[#a8a29e] shrink-0" />
          )}
        </div>
        {record.originalContent.length === 0 && (
          <span className="text-[10px] bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe] px-1.5 py-0.5 rounded shrink-0">
            新文件
          </span>
        )}
      </div>

      {/* 展开区：修改说明 + diff 视图 + 操作按钮 */}
      {isExpanded && (
        <>
          {record.toolCall.description && (
            <div className="px-3 py-2 text-[11px] text-[#44403c] border-b border-[#f4efea] bg-white/60">
              {record.toolCall.description}
            </div>
          )}

          <div className="max-h-72 overflow-y-auto bg-[#faf8f5] text-[11px] leading-[1.6] font-mono select-text">
            {diffLines.map((line, idx) => {
              const lineNo =
                line.type === "add"
                  ? `+${line.newLineNumber ?? ""}`
                  : line.type === "remove"
                  ? `-${line.oldLineNumber ?? ""}`
                  : `${line.oldLineNumber ?? ""}`;
              return (
                <div
                  key={idx}
                  className={`flex px-3 whitespace-pre-wrap break-all ${
                    line.type === "add"
                      ? "bg-[#f0fdf4] text-[#166534]"
                      : line.type === "remove"
                      ? "bg-[#fef2f2] text-[#991b1b]"
                      : "text-[#78716c]"
                  }`}
                >
                  <span className="w-8 shrink-0 text-right pr-2 opacity-60 select-none">{lineNo}</span>
                  <span className="w-4 shrink-0 select-none">{line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}</span>
                  <span className="flex-1">{line.text || " "}</span>
                </div>
              );
            })}
          </div>

          {/* 错误信息 */}
          {record.status === "FAILED" && record.errorMessage && (
            <div className="px-3 py-2 bg-[#fef2f2] border-t border-[#fecaca] text-[11px] text-[#b91c1c] flex items-start gap-1.5">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <span className="break-all">{record.errorMessage}</span>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="px-3 py-2 border-t border-[#f4efea] bg-white/60 flex items-center justify-end gap-2">
            {record.status === "PENDING_APPROVAL" && (
              <>
                <button
                  type="button"
                  onClick={() => onDiscard(record.id)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#78716c] hover:bg-[#f4efea] cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-1"><X size={11} /> 放弃</span>
                </button>
                <button
                  type="button"
                  onClick={() => onApply(record.id)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-[#d96b27] hover:bg-[#b85417] cursor-pointer transition-all shadow-sm"
                >
                  <span className="flex items-center gap-1"><Check size={11} /> 应用修改</span>
                </button>
              </>
            )}

            {record.status === "APPLIED" && (
              <button
                type="button"
                onClick={() => onViewFile(record)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#0369a1] bg-[#f0f9ff] border border-[#bae6fd] hover:bg-[#e0f2fe] cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-1"><Eye size={11} /> 查看文件</span>
              </button>
            )}

            {record.status === "FAILED" && (
              <button
                type="button"
                onClick={() => onApply(record.id)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-[#d96b27] hover:bg-[#b85417] cursor-pointer transition-all shadow-sm"
              >
                <span className="flex items-center gap-1"><RotateCcw size={11} /> 重试</span>
              </button>
            )}

            {record.status === "REVERTED" && (
              <span className="text-[10px] text-[#64748b]">已恢复修改前内容</span>
            )}
          </div>
        </>
      )}
    </div>
  );
};
