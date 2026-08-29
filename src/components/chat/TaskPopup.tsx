import React, { useState } from "react";
import { ListChecks, X, ChevronDown, ChevronUp, Circle, PlayCircle, CheckCircle2, XCircle } from "lucide-react";
import { ParsedPlan, PlanTaskItem, TaskPlan } from "../../types/contracts";

/** 智能体计划任务标记：plan 模式下大模型在回复末尾输出该标记 + JSON */
export const PLAN_MARKER = "[[PLAN]]";

/**
 * 解析助手回复末尾的计划任务标记。
 * 解析失败时返回 null 并保留原文，让异常可见。
 */
export function parsePlanBlock(
  content: string
): { cleanContent: string; plan: ParsedPlan } | null {
  const idx = content.lastIndexOf(PLAN_MARKER);
  if (idx < 0) return null;

  const raw = content.slice(idx + PLAN_MARKER.length).trim();
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn("[Plan] JSON 解析失败，标记保留在正文中:", err);
    return null;
  }

  const isValid =
    parsed &&
    parsed.type === "plan" &&
    typeof parsed.title === "string" &&
    Array.isArray(parsed.tasks) &&
    parsed.tasks.length > 0 &&
    parsed.tasks.every((t: any) => t && typeof t.id === "string" && typeof t.summary === "string");

  if (!isValid) {
    console.warn("[Plan] 标记存在但 JSON 结构不合法，保留原文:", raw);
    return null;
  }

  // 真实模型输出的状态/难度字段可能不规范，缺失或非法时降级为默认值并记录告警（不静默吞掉）
  const normalizedTasks = parsed.tasks.map((t: any) => {
    const status: PlanTaskItem["status"] = ["pending", "running", "completed", "failed"].includes(
      t.status
    )
      ? t.status
      : "pending";
    const difficulty: PlanTaskItem["difficulty"] = ["low", "medium", "high"].includes(t.difficulty)
      ? t.difficulty
      : "medium";
    if (status !== t.status || difficulty !== t.difficulty) {
      console.warn(
        `[Plan] 任务 ${t.id} 状态/难度字段不规范(status=${t.status}, difficulty=${t.difficulty})，已降级为 ${status}/${difficulty}`
      );
    }
    return { id: String(t.id), summary: t.summary, status, difficulty };
  });

  const plan: ParsedPlan = {
    type: "plan",
    title: parsed.title,
    tasks: normalizedTasks,
  };
  return { cleanContent: content.slice(0, idx).trimEnd(), plan };
}

const STATUS_ICON: Record<PlanTaskItem["status"], React.ElementType> = {
  pending: Circle,
  running: PlayCircle,
  completed: CheckCircle2,
  failed: XCircle,
};

const STATUS_CLASS: Record<PlanTaskItem["status"], string> = {
  pending: "text-[#94a3b8]",
  running: "text-[#2563eb]",
  completed: "text-[#16a34a]",
  failed: "text-[#dc2626]",
};

const DIFFICULTY_LABEL: Record<PlanTaskItem["difficulty"], string> = {
  low: "低",
  medium: "中",
  high: "高",
};

const DIFFICULTY_CLASS: Record<PlanTaskItem["difficulty"], string> = {
  low: "bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]",
  medium: "bg-[#fffbeb] text-[#b45309] border-[#fde68a]",
  high: "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]",
};

interface TaskPopupProps {
  plan: TaskPlan;
  onClose: () => void;
}

/** 计划任务弹窗：右下角小窗，可关闭，带展开/收起图标 */
export const TaskPopup: React.FC<TaskPopupProps> = ({ plan, onClose }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="fixed bottom-24 right-4 z-50 w-72 bg-white border border-[#e5dfd8] rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2">
      <div className="px-3 py-2 bg-[#faf8f5] border-b border-[#e5dfd8] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#1e1b18] min-w-0">
          <ListChecks size={13} className="text-[#d96b27] shrink-0" />
          <span className="truncate">{plan.title}</span>
          <span className="text-[10px] text-[#78716c] font-normal shrink-0">({plan.tasks.length})</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            title={isExpanded ? "收起任务列表" : "展开任务列表"}
            className="w-5 h-5 rounded hover:bg-[#f4efea] text-[#78716c] hover:text-[#1e1b18] flex items-center justify-center cursor-pointer transition-colors"
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            title="关闭任务窗口"
            className="w-5 h-5 rounded hover:bg-[#f4efea] text-[#78716c] hover:text-[#dc2626] flex items-center justify-center cursor-pointer transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="max-h-60 overflow-y-auto p-2 flex flex-col gap-1.5">
          {plan.tasks.map((task) => {
            const StatusIcon = STATUS_ICON[task.status];
            return (
              <div
                key={task.id}
                className="px-2 py-1.5 rounded-lg bg-[#faf8f5] border border-[#f4efea] flex items-center gap-1.5 text-[11px]"
                title={task.summary}
              >
                <StatusIcon size={12} className={`${STATUS_CLASS[task.status]} shrink-0`} />
                <span className="flex-1 truncate text-[#44403c]">{task.summary}</span>
                <span
                  className={`text-[9px] font-semibold px-1 py-0.5 rounded border shrink-0 ${DIFFICULTY_CLASS[task.difficulty]}`}
                >
                  {DIFFICULTY_LABEL[task.difficulty]}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
