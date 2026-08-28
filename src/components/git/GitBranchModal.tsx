import React, { useState, useEffect } from "react";
import {
  GitBranch,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Plus,
  Check,
  X,
  AlertCircle,
  FolderGit2,
  Globe
} from "lucide-react";
import { nativeService } from "../../services/nativeService";

interface GitBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  onBranchSwitched?: (newBranch: string) => void;
}

export const GitBranchModal: React.FC<GitBranchModalProps> = ({
  isOpen,
  onClose,
  projectName,
  onBranchSwitched,
}) => {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
  const [gitData, setGitData] = useState<{
    currentBranch: string;
    isGit: boolean;
    localBranches: string[];
    remoteBranches: string[];
    uncommittedFiles: string[];
    rawStatus: string;
  }>({
    currentBranch: "main",
    isGit: true,
    localBranches: ["main"],
    remoteBranches: [],
    uncommittedFiles: [],
    rawStatus: "",
  });

  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [newBranchInput, setNewBranchInput] = useState("");

  const refreshGitStatus = async () => {
    setLoading(true);
    try {
      const data = await nativeService.getFullGitStatus();
      setGitData(data);
    } catch (err: any) {
      console.warn("Refresh git status failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshGitStatus();
    }
  }, [isOpen]);

  const showToast = (type: "success" | "error" | "info", msg: string) => {
    setFeedbackToast({ type, msg });
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  // 1. 切换分支 (Checkout)
  const handleCheckout = async (branch: string) => {
    if (branch === gitData.currentBranch) return;
    setActionLoading(`checkout-${branch}`);
    try {
      const out = await nativeService.checkoutBranch(branch);
      showToast("success", `已成功切换到分支: ${branch}\n${out.slice(0, 80)}`);
      await refreshGitStatus();
      if (onBranchSwitched) onBranchSwitched(branch);
    } catch (err: any) {
      showToast("error", `切换分支失败: ${err.message || err}`);
    } finally {
      setActionLoading(null);
    }
  };

  // 2. 创建并切换新分支
  const handleCreateBranch = async () => {
    if (!newBranchInput.trim()) return;
    const branchName = newBranchInput.trim().replace(/\s+/g, "-");
    setActionLoading("create-branch");
    try {
      await nativeService.createAndCheckoutBranch(branchName);
      showToast("success", `已创建并切换到新分支: ${branchName}`);
      setNewBranchInput("");
      setIsCreatingBranch(false);
      await refreshGitStatus();
      if (onBranchSwitched) onBranchSwitched(branchName);
    } catch (err: any) {
      showToast("error", `创建分支失败: ${err.message || err}`);
    } finally {
      setActionLoading(null);
    }
  };

  // 3. 执行 Git Pull
  const handlePull = async () => {
    setActionLoading("pull");
    try {
      const out = await nativeService.gitPull();
      showToast("success", `Git Pull 完成: ${out.slice(0, 100)}`);
      await refreshGitStatus();
    } catch (err: any) {
      showToast("error", `Git Pull 失败: ${err.message || err}`);
    } finally {
      setActionLoading(null);
    }
  };

  // 4. 执行 Git Push
  const handlePush = async () => {
    setActionLoading("push");
    try {
      const out = await nativeService.gitPush();
      showToast("success", `Git Push 成功推送到远程仓库: ${out.slice(0, 100)}`);
      await refreshGitStatus();
    } catch (err: any) {
      showToast("error", `Git Push 失败: ${err.message || err}`);
    } finally {
      setActionLoading(null);
    }
  };

  // 5. 执行 Git Fetch
  const handleFetch = async () => {
    setActionLoading("fetch");
    try {
      await nativeService.gitFetch();
      showToast("success", "Git Fetch 成功更新远程索引！");
      await refreshGitStatus();
    } catch (err: any) {
      showToast("error", `Git Fetch 失败: ${err.message || err}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in select-none">
      <div className="bg-white border border-[#e5dfd8] rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 font-sans">
        {/* 头部条 */}
        <div className="px-5 py-3.5 border-b border-[#f4efea] flex justify-between items-center bg-[#faf8f5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#fef3eb] text-[#d96b27] flex items-center justify-center font-bold shadow-2xs">
              <FolderGit2 size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1e1b18] flex items-center gap-1.5">
                <span>Git 版本控制与分支中枢</span>
                <span className="text-[11px] font-normal text-[#78716c]">({projectName})</span>
              </h3>
              <p className="text-[10px] text-[#78716c]">
                真实探测与管理当前工程本地/远程分支与工作区状态
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-[#ebe5df] flex items-center justify-center text-[#78716c] hover:text-[#1e1b18] cursor-pointer transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* 主体内容 */}
        <div className="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
          {/* 1. 当前分支与工作区状态概览 */}
          <div className="p-3.5 rounded-xl bg-[#faf8f5] border border-[#e5dfd8] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-[#e0f2fe] text-[#0284c7] flex items-center justify-center">
                <GitBranch size={14} />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#0f172a] font-mono">
                    {gitData.currentBranch}
                  </span>
                  <span className="bg-[#dcfce7] text-[#15803d] border border-[#bbf7d0] px-1.5 py-0.2 rounded text-[10px] font-semibold">
                    当前分支
                  </span>
                </div>
                <span className="text-[10px] text-[#64748b]">
                  {gitData.uncommittedFiles.length === 0
                    ? "🟢 工作区干净 (无未提交变更)"
                    : `🟡 存在 ${gitData.uncommittedFiles.length} 个未提交变更文件`}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={refreshGitStatus}
              disabled={loading}
              className="p-1.5 rounded-lg border border-[#e5dfd8] bg-white hover:bg-[#f4efea] text-[#64748b] hover:text-[#1e1b18] cursor-pointer transition-colors flex items-center gap-1 text-[11px]"
              title="刷新 Git 状态"
            >
              <RefreshCw size={12} className={loading ? "animate-spin text-[#d96b27]" : ""} />
              <span>刷新</span>
            </button>
          </div>

          {/* 2. 核心 Git 动作快捷操作栏 */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handlePull}
              disabled={actionLoading !== null}
              className="px-3 py-2 rounded-xl bg-white hover:bg-[#f0fdf4] border border-[#e5dfd8] hover:border-[#86efac] text-[#166534] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-all"
            >
              <ArrowDownCircle size={13} className={actionLoading === "pull" ? "animate-spin text-[#16a34a]" : "text-[#16a34a]"} />
              <span>Git Pull (拉取)</span>
            </button>

            <button
              type="button"
              onClick={handlePush}
              disabled={actionLoading !== null}
              className="px-3 py-2 rounded-xl bg-white hover:bg-[#eff6ff] border border-[#e5dfd8] hover:border-[#93c5fd] text-[#1d4ed8] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-all"
            >
              <ArrowUpCircle size={13} className={actionLoading === "push" ? "animate-spin text-[#2563eb]" : "text-[#2563eb]"} />
              <span>Git Push (推送)</span>
            </button>

            <button
              type="button"
              onClick={handleFetch}
              disabled={actionLoading !== null}
              className="px-3 py-2 rounded-xl bg-white hover:bg-[#faf5ff] border border-[#e5dfd8] hover:border-[#d8b4fe] text-[#7e22ce] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-all"
            >
              <RefreshCw size={13} className={actionLoading === "fetch" ? "animate-spin text-[#9333ea]" : "text-[#9333ea]"} />
              <span>Git Fetch (索引)</span>
            </button>
          </div>

          {/* 反馈提示横幅 */}
          {feedbackToast && (
            <div
              className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 animate-in fade-in ${
                feedbackToast.type === "success"
                  ? "bg-[#ecfdf5] border-[#a7f3d0] text-[#065f46]"
                  : feedbackToast.type === "error"
                  ? "bg-[#fef2f2] border-[#fecaca] text-[#991b1b]"
                  : "bg-[#eff6ff] border-[#bfdbfe] text-[#1e40af]"
              }`}
            >
              {feedbackToast.type === "success" ? (
                <Check size={14} className="text-[#10b981] shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={14} className="text-[#ef4444] shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed whitespace-pre-wrap">{feedbackToast.msg}</span>
            </div>
          )}

          {/* 3. 本地分支管理 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#334155] flex items-center gap-1.5">
                <GitBranch size={13} className="text-[#0284c7]" /> 本地分支 (Local Branches)
              </span>
              {!isCreatingBranch ? (
                <button
                  type="button"
                  onClick={() => setIsCreatingBranch(true)}
                  className="text-[11px] font-semibold text-[#d96b27] hover:text-[#b85417] flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={12} /> 新建分支
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCreatingBranch(false)}
                  className="text-[11px] text-[#64748b] hover:text-[#1e1b18] cursor-pointer"
                >
                  取消
                </button>
              )}
            </div>

            {/* 新建分支内联表单 */}
            {isCreatingBranch && (
              <div className="p-2.5 rounded-xl bg-[#faf8f5] border border-[#fed7aa] flex items-center gap-2 animate-in fade-in">
                <input
                  type="text"
                  autoFocus
                  value={newBranchInput}
                  onChange={(e) => setNewBranchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateBranch();
                    if (e.key === "Escape") setIsCreatingBranch(false);
                  }}
                  placeholder="输入新分支名称, 如 feat/react-ui..."
                  className="flex-1 px-2.5 py-1 text-xs border border-[#e5dfd8] focus:border-[#d96b27] rounded-lg outline-none bg-white font-mono"
                />
                <button
                  type="button"
                  onClick={handleCreateBranch}
                  disabled={!newBranchInput.trim()}
                  className="bg-[#d96b27] hover:bg-[#b85417] text-white px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
                >
                  创建并切换
                </button>
              </div>
            )}

            {/* 本地分支列表 */}
            <div className="flex flex-col gap-1 border border-[#e5dfd8] rounded-xl p-1.5 bg-white">
              {gitData.localBranches.map((b) => {
                const isCurrent = b === gitData.currentBranch;
                return (
                  <div
                    key={b}
                    className={`px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${
                      isCurrent ? "bg-[#f0f9ff] text-[#0369a1] font-semibold" : "hover:bg-[#faf8f5] text-[#334155]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isCurrent ? "bg-[#0284c7]" : "bg-[#cbd5e1]"}`} />
                      <span className="text-xs font-mono">{b}</span>
                    </div>
                    {isCurrent ? (
                      <span className="text-[10px] text-[#0284c7] font-semibold bg-[#e0f2fe] px-2 py-0.5 rounded">
                        ✓ 当前分支
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleCheckout(b)}
                        disabled={actionLoading !== null}
                        className="text-[11px] font-semibold text-[#64748b] hover:text-[#d96b27] hover:bg-[#fff7ed] px-2.5 py-1 rounded border border-[#e2e8f0] cursor-pointer transition-colors"
                      >
                        {actionLoading === `checkout-${b}` ? "切换中..." : "切换到此分支"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. 远程分支管理 */}
          {gitData.remoteBranches.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-[#334155] flex items-center gap-1.5">
                <Globe size={13} className="text-[#64748b]" /> 远程跟踪分支 (Remote Tracking)
              </span>
              <div className="flex flex-col gap-1 border border-[#e5dfd8] rounded-xl p-1.5 bg-white max-h-36 overflow-y-auto">
                {gitData.remoteBranches.map((rb) => (
                  <div
                    key={rb}
                    className="px-3 py-1.5 rounded-lg flex items-center justify-between text-xs text-[#64748b] hover:bg-[#faf8f5]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#94a3b8]" />
                      <span className="font-mono text-[11px]">{rb}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const localName = rb.replace(/^origin\//, "");
                        handleCheckout(localName);
                      }}
                      className="text-[10px] font-semibold text-[#0284c7] hover:underline cursor-pointer"
                    >
                      检出到本地
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 底部条 */}
        <div className="px-5 py-3 border-t border-[#f4efea] bg-[#faf8f5] flex justify-between items-center text-xs">
          <span className="text-[11px] text-[#94a3b8]">
            已对接本地 Git CLI 与 PowerShell 原生引擎
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#334155] hover:bg-[#1e293b] text-white rounded-lg font-semibold cursor-pointer shadow-xs transition-colors"
          >
            完成并返回
          </button>
        </div>
      </div>
    </div>
  );
};
