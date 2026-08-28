import React from "react";
import { Account } from "../../types";
import { Info, Tag, FileText, Play, RefreshCw, Upload, Trash2 } from "lucide-react";

interface AccountCardProps {
  account: Account;
  onRefresh: (id: string) => void;
  onWakeup: (id: string) => void;
  onDelete: (id: string) => void;
  onMemo: (id: string) => void;
  onDetail: (id: string) => void;
}

export const AccountCard: React.FC<AccountCardProps> = ({
  account,
  onRefresh,
  onWakeup,
  onDelete,
  onMemo,
  onDetail,
}) => {
  const isActive = account.status === "active";
  const claude5h = account.claude5h || "100%";
  const claudeWk = account.claudeWeekly || (isActive ? "100%" : "63%");
  const gemini5h = account.gemini5h || (isActive ? "98%" : "100%");
  const geminiWk = account.geminiWeekly || (isActive ? "69%" : "0%");
  const credits = account.credits || (isActive ? "850 pts" : "0 pts");

  return (
    <div
      className={`bg-white rounded-xl p-3.5 flex flex-col gap-2.5 transition-all duration-150 ${
        isActive
          ? "border-[1.5px] border-[#d96b27] shadow-[0_2px_10px_rgba(217,107,39,0.08)]"
          : "border border-[#e5dfd8] shadow-sm hover:border-[#d0c7bd]"
      }`}
    >
      {/* 头部：邮箱与徽章 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 font-semibold text-xs text-[#1e1b18]">
          <input
            type="checkbox"
            defaultChecked={isActive}
            className="rounded border-[#d0c7bd] text-[#d96b27] focus:ring-0 cursor-pointer"
          />
          <span>{account.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isActive && (
            <span className="bg-[#10b981] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
              当前
            </span>
          )}
          <span className="bg-[#0284c7] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            PRO
          </span>
        </div>
      </div>

      {/* 加备注按钮 */}
      <button
        onClick={() => onMemo(account.id)}
        className="w-fit text-[11px] text-[#645e57] hover:text-[#1e1b18] bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e2e8f0] px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors"
      >
        <FileText size={11} /> 加备注
      </button>

      {/* 双模型多时间窗口配额看板 (Claude & Gemini 5h / Weekly) */}
      <div className="bg-[#f8fafc] rounded-lg p-2.5 border border-[#e5dfd8] flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-3">
          {/* Claude 列 */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] font-bold text-[#1e1b18]">
              <span>Claude</span>
              <span className="text-[#10b981]">{claude5h}</span>
            </div>
            <span className="text-[10px] text-[#645e57]">5h</span>
            <div className="h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden">
              <div className="h-full bg-[#10b981] w-full"></div>
            </div>
            <span className="text-[9px] text-[#9c948a] font-mono">{account.reset_time || "4h 59m"}</span>

            <div className="flex justify-between text-[11px] font-bold text-[#1e1b18] mt-1.5">
              <span>Weekly</span>
              <span className={isActive ? "text-[#10b981]" : "text-[#f59e0b]"}>{claudeWk}</span>
            </div>
            <div className="h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden">
              <div className={`h-full ${isActive ? "bg-[#10b981] w-full" : "bg-[#f59e0b] w-[63%]"}`}></div>
            </div>
            <span className="text-[9px] text-[#9c948a] font-mono">6d 23h 59m</span>
          </div>

          {/* Gemini 列 */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] font-bold text-[#1e1b18]">
              <span>Gemini</span>
              <span className="text-[#10b981]">{gemini5h}</span>
            </div>
            <span className="text-[10px] text-[#645e57]">5h</span>
            <div className="h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden">
              <div className="h-full bg-[#10b981] w-[98%]"></div>
            </div>
            <span className="text-[9px] text-[#9c948a] font-mono">4h 10m (08/28 14:22)</span>

            <div className="flex justify-between text-[11px] font-bold text-[#1e1b18] mt-1.5">
              <span>Weekly</span>
              <span className={isActive ? "text-[#f59e0b]" : "text-[#ef4444]"}>{geminiWk}</span>
            </div>
            <div className="h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden">
              <div className={`h-full ${isActive ? "bg-[#f59e0b] w-[69%]" : "bg-[#ef4444] w-0"}`}></div>
            </div>
            <span className="text-[9px] text-[#9c948a] font-mono">6d 3h 48m</span>
          </div>
        </div>

        {/* 可用 AI 积分行 */}
        <div className="flex justify-between items-center text-[11px] text-[#645e57] pt-1.5 border-t border-dashed border-[#e2e8f0]">
          <span>可用 AI 积分:</span>
          <strong className="text-[#d96b27] font-semibold">{credits}</strong>
        </div>
      </div>

      {/* 底部：日期与 7 组微型快捷操作 */}
      <div className="flex justify-between items-center pt-2 border-t border-[#f1f5f9]">
        <span className="text-[10px] text-[#9c948a] font-mono">
          {account.created_at || "2026/08/27 10:52"}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onDetail(account.id)}
            title="账号详情"
            className="w-5 h-5 rounded bg-[#f8fafc] hover:bg-[#ebe5df] border border-[#e5dfd8] flex items-center justify-center text-[#645e57] hover:text-[#1e1b18] cursor-pointer"
          >
            <Info size={11} />
          </button>
          <button
            onClick={() => alert(`🏷️ 账号 ${account.id} 标签: #PRO #Primary`)}
            title="标签管理"
            className="w-5 h-5 rounded bg-[#f8fafc] hover:bg-[#ebe5df] border border-[#e5dfd8] flex items-center justify-center text-[#645e57] hover:text-[#1e1b18] cursor-pointer"
          >
            <Tag size={11} />
          </button>
          <button
            onClick={() => onMemo(account.id)}
            title="修改备注"
            className="w-5 h-5 rounded bg-[#f8fafc] hover:bg-[#ebe5df] border border-[#e5dfd8] flex items-center justify-center text-[#645e57] hover:text-[#1e1b18] cursor-pointer"
          >
            <FileText size={11} />
          </button>
          <button
            onClick={() => onWakeup(account.id)}
            title="单步唤醒与测速"
            className="w-5 h-5 rounded bg-[#f8fafc] hover:bg-[#ebe5df] border border-[#e5dfd8] flex items-center justify-center text-[#645e57] hover:text-[#1e1b18] cursor-pointer"
          >
            <Play size={11} />
          </button>
          <button
            onClick={() => onRefresh(account.id)}
            title="刷新配额"
            className="w-5 h-5 rounded bg-[#f8fafc] hover:bg-[#ebe5df] border border-[#e5dfd8] flex items-center justify-center text-[#645e57] hover:text-[#1e1b18] cursor-pointer"
          >
            <RefreshCw size={11} />
          </button>
          <button
            onClick={() => alert(`📤 账号凭据已导出至 JSON`)}
            title="导出凭据"
            className="w-5 h-5 rounded bg-[#f8fafc] hover:bg-[#ebe5df] border border-[#e5dfd8] flex items-center justify-center text-[#645e57] hover:text-[#1e1b18] cursor-pointer"
          >
            <Upload size={11} />
          </button>
          <button
            onClick={() => onDelete(account.id)}
            title="删除账号"
            className="w-5 h-5 rounded bg-[#f8fafc] hover:bg-[#fef2f2] border border-[#e5dfd8] hover:border-[#fecaca] flex items-center justify-center text-[#ef4444] cursor-pointer"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
};
