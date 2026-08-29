import React, { useState } from "react";
import { ListChecks, ChevronDown, ChevronUp, Circle, PlayCircle, CheckCircle2, XCircle } from "lucide-react";
import { PlanTaskItem, TaskPlan } from "../../types/contracts";

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

interface TaskPlanPanelProps {
  plan: TaskPlan;
}

/** 计划任务面板：位于对话栏（输入框上方），可展开/折叠 */
export const TaskPlanPanel: React.FC<TaskPlanPanelProps> = ({ plan }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="border border-[#bfdbfe] bg-[#eff6ff] rounded-xl shadow-xs overflow-hidden animate-in fade-in slide-in-from-bottom-2">
      {/* 头部：可点击展开/折叠 */}
      <div
        className="px-3 py-2 flex items-center gap-2 cursor-pointer"
        onClick={() => setIsExpanded((prev) => !prev)}
        title={isExpanded ? "收起任务列表" : "展开任务列表"}
      >
        <div className="w-6 h-6 rounded-lg bg-[#dbeafe] text-[#2563eb] flex items-center justify-center shrink-0">
          <ListChecks size={13} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-[#1d4ed8] flex items-center gap-1.5">
            <span>计划任务</span>
            <span className="bg-[#dbeafe] text-[#1e40af] px-1.5 py-0.5 rounded text-[9px] font-semibold">
              {plan.tasks.length} 项
            </span>
          </div>
          <div className="text-[10px] text-[#64748b] truncate max-w-[280px]">{plan.title}</div>
        </div>
        {isExpanded ? (
          <ChevronUp size={13} className="text-[#93c5fd] shrink-0" />
        ) : (
          <ChevronDown size={13} className="text-[#93c5fd] shrink-0" />
        )}
      </div>

      {/* 任务列表：概要 + 状态 + 难度 */}
      {isExpanded && (
        <div className="px-2 pb-2 flex flex-col gap-1">
          {plan.tasks.map((task) => {
            const StatusIcon = STATUS_ICON[task.status];
            return (
              <div
                key={task.id}
                className="px-2 py-1.5 rounded-lg bg-white border border-[#e0f2fe] flex items-center gap-1.5 text-[11px]"
                title={task.summary}
              >
                <StatusIcon size={12} className={`${STATUS_CLASS[task.status]} shrink-0`} />
                <span className="flex-1 truncate text-[#1e40af]">{task.summary}</span>
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
