import React, { useState, useEffect, useRef } from "react";
import {
  GitBranch,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Plus,
  Check,
  Search,
  Globe,
  X
} from "lucide-react";
import { nativeService } from "../../services/nativeService";

interface GitBranchPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  onBranchSwitched?: (newBranch: string) => void;
}

export const GitBranchModal: React.FC<GitBranchPopoverProps> = ({
  isOpen,
  onClose,
  projectName,
  onBranchSwitched,
}) => {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedbackToast, setFeedbackToast] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
  
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [newBranchInput, setNewBranchInput] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

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
      setIsCreatingBranch(false);
      setNewBranchInput("");
      setSearchQuery("");
    }
  }, [isOpen]);

  // 点击外部自动关闭 (IDEA 浮层行为)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const showToast = (type: "success" | "error" | "info", msg: string) => {
    setFeedbackToast({ type, msg });
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  // 切换分支 (Checkout)
  const handleCheckout = async (branch: string) => {
    if (branch === gitData.currentBranch) return;
    setActionLoading(`checkout-${branch}`);
    try {
      await nativeService.checkoutBranch(branch);
      showToast("success", `已切换到分支: ${branch}`);
      await refreshGitStatus();
      if (onBranchSwitched) onBranchSwitched(branch);
      setTimeout(() => onClose(), 600);
    } catch (err: any) {
      showToast("error", `切换分支失败: ${err.message || err}`);
    } finally {
      setActionLoading(null);
    }
  };

  // 创建新分支
  const handleCreateBranch = async () => {
    if (!newBranchInput.trim()) return;
    const branchName = newBranchInput.trim().replace(/\s+/g, "-");
    setActionLoading("create-branch");
    try {
      await nativeService.createAndCheckoutBranch(branchName);
      showToast("success", `已创建并检出分支: ${branchName}`);
      setNewBranchInput("");
      setIsCreatingBranch(false);
      await refreshGitStatus();
      if (onBranchSwitched) onBranchSwitched(branchName);
      setTimeout(() => onClose(), 600);
    } catch (err: any) {
      showToast("error", `创建分支失败: ${err.message || err}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Git Pull
  const handlePull = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading("pull");
    try {
      const out = await nativeService.gitPull();
      showToast("success", `Pull 完成: ${out.slice(0, 50)}`);
      await refreshGitStatus();
    } catch (err: any) {
      showToast("error", `Pull 失败: ${err.message || err}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Git Push
  const handlePush = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading("push");
    try {
      await nativeService.gitPush();
      showToast("success", `Push 成功推送到远程`);
      await refreshGitStatus();
    } catch (err: any) {
      showToast("error", `Push 失败: ${err.message || err}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Git Fetch
  const handleFetch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading("fetch");
    try {
      await nativeService.gitFetch();
      showToast("success", "Fetch 成功同步远程索引");
      await refreshGitStatus();
    } catch (err: any) {
      showToast("error", `Fetch 失败: ${err.message || err}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (!isOpen) return null;

  const filteredLocal = gitData.localBranches.filter((b) =>
    b.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredRemote = gitData.remoteBranches.filter((b) =>
    b.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-8 left-0 z-50 w-80 bg-white border border-[#e2e8f0] rounded-xl shadow-2xl overflow-hidden flex flex-col text-xs font-sans animate-in fade-in slide-in-from-bottom-2 duration-150 select-none"
      style={{ boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.18), 0 4px 10px -2px rgba(0, 0, 0, 0.08)" }}
    >
      {/* 1. IntelliJ IDEA 风格顶部标题栏与快捷动作按钮 */}
      <div className="px-3 py-2 bg-[#faf8f5] border-b border-[#e5dfd8] flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <GitBranch size={13} className="text-[#0284c7] shrink-0" />
          <span className="font-bold text-[#1e1b18] truncate text-[11px]">
            Git Branches: {projectName}
          </span>
        </div>

        {/* 快捷操作动作按钮图标 (Pull / Push / Fetch / Refresh) */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handlePull}
            disabled={actionLoading !== null}
            title="Update Project (Git Pull)"
            className="p-1 hover:bg-[#ebe5df] rounded text-[#475569] hover:text-[#1e1b18] cursor-pointer transition-colors"
          >
            <ArrowDownCircle size={13} className={actionLoading === "pull" ? "animate-spin text-[#16a34a]" : ""} />
          </button>
          <button
            type="button"
            onClick={handlePush}
            disabled={actionLoading !== null}
            title="Push Commits (Git Push)"
            className="p-1 hover:bg-[#ebe5df] rounded text-[#475569] hover:text-[#1e1b18] cursor-pointer transition-colors"
          >
            <ArrowUpCircle size={13} className={actionLoading === "push" ? "animate-spin text-[#2563eb]" : ""} />
          </button>
          <button
            type="button"
            onClick={handleFetch}
            disabled={actionLoading !== null}
            title="Fetch All Remotes (Git Fetch)"
            className="p-1 hover:bg-[#ebe5df] rounded text-[#475569] hover:text-[#1e1b18] cursor-pointer transition-colors"
          >
            <RefreshCw size={12} className={actionLoading === "fetch" || loading ? "animate-spin text-[#9333ea]" : ""} />
          </button>
        </div>
      </div>

      {/* 2. 搜索框与新建分支入口 (IDEA Style Search) */}
      <div className="p-2 border-b border-[#f1f5f9] flex flex-col gap-1.5 bg-white">
        <div className="relative flex items-center">
          <Search size={12} className="absolute left-2 text-[#94a3b8]" />
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索分支 (Filter branches)..."
            className="w-full pl-6.5 pr-2 py-1 bg-[#f8fafc] border border-[#e2e8f0] focus:border-[#d96b27] focus:bg-white rounded-md text-[11px] outline-none transition-colors font-mono"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-1.5 text-[#94a3b8] hover:text-[#475569]"
            >
              <X size={10} />
            </button>
          )}
        </div>

        {/* 新建分支按钮 / 内联输入 */}
        {!isCreatingBranch ? (
          <button
            type="button"
            onClick={() => setIsCreatingBranch(true)}
            className="w-full py-1 px-2 rounded-md hover:bg-[#fef3eb] text-[#d96b27] hover:text-[#b85417] text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Plus size={12} />
            <span>新建分支 (New Branch)...</span>
          </button>
        ) : (
          <div className="p-1.5 rounded-lg bg-[#faf8f5] border border-[#fed7aa] flex items-center gap-1.5 animate-in fade-in">
            <input
              type="text"
              autoFocus
              value={newBranchInput}
              onChange={(e) => setNewBranchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateBranch();
                if (e.key === "Escape") setIsCreatingBranch(false);
              }}
              placeholder="新分支名称 (如 feature/ui)..."
              className="flex-1 px-1.5 py-0.5 text-[11px] border border-[#e5dfd8] focus:border-[#d96b27] rounded bg-white outline-none font-mono"
            />
            <button
              type="button"
              onClick={handleCreateBranch}
              disabled={!newBranchInput.trim()}
              className="bg-[#d96b27] hover:bg-[#b85417] text-white px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer disabled:opacity-50"
            >
              创建
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingBranch(false)}
              className="text-[#94a3b8] hover:text-[#475569] p-0.5"
            >
              <X size={11} />
            </button>
          </div>
        )}
      </div>

      {/* 3. 反馈提示条 (Toast Banner) */}
      {feedbackToast && (
        <div
          className={`px-2.5 py-1 text-[10px] flex items-center gap-1 border-b font-medium animate-in fade-in ${
            feedbackToast.type === "success"
              ? "bg-[#ecfdf5] border-[#a7f3d0] text-[#065f46]"
              : feedbackToast.type === "error"
              ? "bg-[#fef2f2] border-[#fecaca] text-[#991b1b]"
              : "bg-[#eff6ff] border-[#bfdbfe] text-[#1e40af]"
          }`}
        >
          {feedbackToast.type === "success" ? <Check size={11} /> : <X size={11} />}
          <span className="truncate">{feedbackToast.msg}</span>
        </div>
      )}

      {/* 4. IDEA 风格分支列表树 (Scrollable Branch List) */}
      <div className="max-h-64 overflow-y-auto p-1 flex flex-col gap-1 scrollbar-thin">
        {/* 本地分支分组 */}
        <div className="flex flex-col">
          <div className="px-2 py-0.5 text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider flex items-center justify-between">
            <span>本地分支 (Local)</span>
            <span className="text-[9px] font-normal">{filteredLocal.length}</span>
          </div>

          {filteredLocal.length === 0 ? (
            <div className="px-3 py-1.5 text-[10px] text-[#94a3b8] italic">无匹配分支</div>
          ) : (
            filteredLocal.map((b) => {
              const isCurrent = b === gitData.currentBranch;
              return (
                <div
                  key={b}
                  onClick={() => handleCheckout(b)}
                  className={`group px-2 py-1.5 rounded-md flex items-center justify-between cursor-pointer transition-colors ${
                    isCurrent
                      ? "bg-[#f0f9ff] text-[#0284c7] font-bold"
                      : "hover:bg-[#f8fafc] text-[#334155] hover:text-[#0f172a]"
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {isCurrent ? (
                      <Check size={12} className="text-[#0284c7] shrink-0 font-bold" />
                    ) : (
                      <GitBranch size={11} className="text-[#94a3b8] group-hover:text-[#475569] shrink-0" />
                    )}
                    <span className="truncate font-mono text-[11px]">{b}</span>
                  </div>

                  {isCurrent ? (
                    <span className="text-[9px] bg-[#e0f2fe] text-[#0369a1] px-1.5 py-0.2 rounded font-sans font-normal shrink-0">
                      当前
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#0284c7] opacity-0 group-hover:opacity-100 transition-opacity font-sans font-medium shrink-0">
                      {actionLoading === `checkout-${b}` ? "检出中..." : "检出 (Checkout)"}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 远程分支分组 */}
        {filteredRemote.length > 0 && (
          <div className="flex flex-col pt-1 border-t border-[#f1f5f9] mt-1">
            <div className="px-2 py-0.5 text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider flex items-center justify-between">
              <span>远程跟踪分支 (Remote / origin)</span>
              <span className="text-[9px] font-normal">{filteredRemote.length}</span>
            </div>

            {filteredRemote.map((rb) => {
              const localName = rb.replace(/^origin\//, "");
              return (
                <div
                  key={rb}
                  onClick={() => handleCheckout(localName)}
                  className="group px-2 py-1.5 rounded-md flex items-center justify-between hover:bg-[#f8fafc] text-[#64748b] hover:text-[#0f172a] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Globe size={11} className="text-[#94a3b8] shrink-0" />
                    <span className="truncate font-mono text-[11px]">{rb}</span>
                  </div>
                  <span className="text-[10px] text-[#0284c7] opacity-0 group-hover:opacity-100 transition-opacity font-sans font-medium shrink-0">
                    检出到本地
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. 底部状态指示栏 (IDEA Style Footer Status) */}
      <div className="px-3 py-1.5 bg-[#faf8f5] border-t border-[#e5dfd8] flex items-center justify-between text-[10px] text-[#64748b]">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${gitData.uncommittedFiles.length === 0 ? "bg-[#10b981]" : "bg-[#f59e0b]"}`} />
          <span>
            {gitData.uncommittedFiles.length === 0
              ? "Working tree clean"
              : `${gitData.uncommittedFiles.length} files modified`}
          </span>
        </div>
        <span className="text-[#94a3b8] font-mono">Press Esc to close</span>
      </div>
    </div>
  );
};
