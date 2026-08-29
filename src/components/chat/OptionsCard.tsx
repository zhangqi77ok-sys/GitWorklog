import React, { useState } from "react";
import { HelpCircle, Check, X } from "lucide-react";
import { AskOptionsPayload } from "../../types/contracts";

/** 智能体提问标记：大模型按系统提示词在回复末尾输出该标记 + JSON */
export const ASK_OPTIONS_MARKER = "[[ASK_OPTIONS]]";

/**
 * 解析助手回复末尾的 Ask Options 标记。
 * 解析失败时返回 null 并保留原文，让异常可见，避免静默吞掉。
 */
export function parseAskOptionsBlock(
  content: string
): { cleanContent: string; payload: AskOptionsPayload } | null {
  const idx = content.lastIndexOf(ASK_OPTIONS_MARKER);
  if (idx < 0) return null;

  const raw = content.slice(idx + ASK_OPTIONS_MARKER.length).trim();
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn("[AskOptions] JSON 解析失败，标记保留在正文中:", err);
    return null;
  }

  const isValid =
    parsed &&
    parsed.type === "ask_options" &&
    typeof parsed.question === "string" &&
    Array.isArray(parsed.options) &&
    parsed.options.length > 0 &&
    parsed.options.every(
      (o: any) => o && typeof o.id === "string" && typeof o.label === "string"
    );

  if (!isValid) {
    console.warn("[AskOptions] 标记存在但 JSON 结构不合法，保留原文:", raw);
    return null;
  }

  const payload: AskOptionsPayload = {
    type: "ask_options",
    question: parsed.question,
    options: parsed.options.map((o: any) => ({
      id: o.id,
      label: o.label,
      ...(typeof o.description === "string" ? { description: o.description } : {}),
    })),
    single_select: parsed.single_select !== false,
  };
  return { cleanContent: content.slice(0, idx).trimEnd(), payload };
}

interface OptionsCardProps {
  payload: AskOptionsPayload;
  onSubmit: (selectedIds: string[], selectedLabels: string[]) => void;
  onSkip: () => void;
}

/** 智能体提问选项卡片：渲染在输入框上方，用户选择后回填答案并自动续问 */
export const OptionsCard: React.FC<OptionsCardProps> = ({ payload, onSubmit, onSkip }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleOption = (id: string) => {
    setSelectedIds((prev) => {
      if (payload.single_select) {
        return prev.includes(id) ? [] : [id];
      }
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    });
  };

  const canSubmit = selectedIds.length > 0;
  const selectedLabels = payload.options
    .filter((o) => selectedIds.includes(o.id))
    .map((o) => o.label);

  const handleConfirm = () => {
    if (!canSubmit) return;
    onSubmit(selectedIds, selectedLabels);
  };

  return (
    <div className="border border-[#fed7aa] bg-[#fff7ed] rounded-xl p-3 flex flex-col gap-2.5 shadow-xs animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[#c2410c] font-semibold text-xs">
          <HelpCircle size={13} className="shrink-0" />
          <span>智能体需要你确认</span>
        </div>
        <button
          type="button"
          onClick={onSkip}
          title="跳过本次提问"
          className="text-[#a8a29e] hover:text-[#57534e] cursor-pointer transition-colors"
        >
          <X size={13} />
        </button>
      </div>

      <div className="text-xs text-[#1e1b18] leading-relaxed select-text">{payload.question}</div>

      <div className="flex flex-col gap-1.5">
        {payload.options.map((opt) => {
          const isSelected = selectedIds.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggleOption(opt.id)}
              className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                isSelected
                  ? "bg-[#fef3eb] border-[#d96b27] text-[#c2410c]"
                  : "bg-white border-[#e7e2d9] text-[#374151] hover:border-[#fdba74] hover:bg-[#fef3eb]/40"
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  className={`w-3.5 h-3.5 border flex items-center justify-center shrink-0 ${
                    payload.single_select ? "rounded-full" : "rounded"
                  } ${
                    isSelected
                      ? "bg-[#d96b27] border-[#d96b27] text-white"
                      : "border-[#d1d5db]"
                  }`}
                >
                  {isSelected && <Check size={10} />}
                </span>
                <span className="flex flex-col min-w-0">
                  <span className="font-medium">{opt.label}</span>
                  {opt.description && (
                    <span className="text-[10px] text-[#78716c]">{opt.description}</span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2 pt-0.5">
        <span className="text-[10px] text-[#a8a29e]">
          {payload.single_select ? "单选" : "可多选"}
        </span>
        <button
          type="button"
          onClick={onSkip}
          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#78716c] hover:bg-[#f4efea] cursor-pointer transition-colors"
        >
          跳过
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleConfirm}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-all cursor-pointer ${
            canSubmit
              ? "bg-[#d96b27] hover:bg-[#b85417] shadow-sm"
              : "bg-[#e5dfd8] cursor-not-allowed"
          }`}
        >
          确认选择
        </button>
      </div>
    </div>
  );
};
