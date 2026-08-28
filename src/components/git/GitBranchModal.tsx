import React, { useState, useEffect, useRef } from "react";
import {
  GitBranch,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Plus,
  Check,
  Search,
  Globe,
  Trash2,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Tag,
  GitMerge,
  ChevronsUpDown,
  X,
  AlertCircle
} from "lucide-react";
import { nativeService } from "../../services/nativeService";

interface GitBranchPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  projectPath?: string;
  onBranchSwitched?: (newBranch: string) => void;
}

interface TreeNode {
  id: string;
  name: string;
  fullPath: string;
  isFolder: boolean;
  children: TreeNode[];
  isCurrent?: boolean;
}

// 递归构建分支层级树 (将 a/b/c 聚类为文件夹目录)
function buildBranchTree(branches: string[], currentBranch: string): TreeNode[] {
  const root: TreeNode[] = [];

  branches.forEach((branch) => {
    const parts = branch.split("/");
    let currentLevel = root;
    let currentPath = "";

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLeaf = index === parts.length - 1;

      let existingNode = currentLevel.find((node) => node.name === part && node.isFolder === !isLeaf);

      if (!existingNode) {
        existingNode = {
          id: currentPath,
          name: part,
          fullPath: currentPath,
          isFolder: !isLeaf,
          children: [],
          isCurrent: isLeaf && currentPath === currentBranch,
        };
        currentLevel.push(existingNode);
      }

      currentLevel = existingNode.children;
    });
  });

  // 排序：文件夹排在前，文件排在后
  const sortTree = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => sortTree(n.children));
  };
  sortTree(root);

  return root;
}

export const GitBranchModal: React.FC<GitBranchPopoverProps> = ({
  isOpen,
  onClose,
  projectName,
  projectPath,
  onBranchSwitched,
}) => {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedbackToast, setFeedbackToast] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
  
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [newBranchInput, setNewBranchInput] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    "local-root": true,
    "remote-root": true,
    "feature": true,
    "develop": true,
    "release": true,
    "fix": true,
    "hotfix": true,
    "arm": true,
    "feat": true,
    "codex": true,
  });

  const popoverRef = useRef<HTMLDivElement>(null);

  // 动态推导工程物理根目录
  const resolvedPath =
    projectPath ||
    (projectName === "geek-boot-parent" ? "d:/weihu/geek-boot-parent" : undefined);

  const [gitData, setGitData] = useState<{
    currentBranch: string;
    isGit: boolean;
    localBranches: string[];
    remoteBranches: string[];
    tags: string[];
    uncommittedFiles: string[];
    rawStatus: string;
  }>({
    currentBranch: "main",
    isGit: true,
    localBranches: ["main"],
    remoteBranches: [],
    tags: [],
    uncommittedFiles: [],
    rawStatus: "",
  });

  const refreshGitStatus = async () => {
    setLoading(true);
    try {
      const data = await nativeService.getFullGitStatus(resolvedPath);
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
      setSelectedBranch(null);
    }
  }, [isOpen, resolvedPath, projectName]);

  // 点击外部自动收起与 Esc 键盘监听
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const showToast = (type: "success" | "error" | "info", msg: string) => {
    setFeedbackToast({ type, msg });
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  // 切换折叠状态
  const toggleFolder = (folderKey: string) => {
    setExpandedFolders((prev) => ({ ...prev, [folderKey]: !prev[folderKey] }));
  };

  // 全部展开/折叠
  const toggleExpandAll = () => {
    const hasCollapsed = Object.values(expandedFolders).some((v) => !v);
    const newStates: Record<string, boolean> = {};
    Object.keys(expandedFolders).forEach((k) => {
      newStates[k] = hasCollapsed;
    });
    setExpandedFolders(newStates);
  };

  // 检出分支 (Checkout)
  const handleCheckout = async (branch: string) => {
    if (branch === gitData.currentBranch) return;
    setActionLoading(`checkout-${branch}`);
    try {
      await nativeService.checkoutBranch(branch, resolvedPath);
      showToast("success", `已成功检出并切换至: ${branch}`);
      await refreshGitStatus();
      if (onBranchSwitched) onBranchSwitched(branch);
      setTimeout(() => onClose(), 600);
    } catch (err: any) {
      showToast("error", `检出失败: ${err.message || err}`);
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
      await nativeService.createAndCheckoutBranch(branchName, resolvedPath);
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
  const handlePull = async () => {
    setActionLoading("pull");
    try {
      const out = await nativeService.gitPull(resolvedPath);
      showToast("success", `Pull 完成: ${out.slice(0, 60)}`);
      await refreshGitStatus();
    } catch (err: any) {
      showToast("error", `Pull 失败: ${err.message || err}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Git Push
  const handlePush = async () => {
    setActionLoading("push");
    try {
      await nativeService.gitPush(resolvedPath);
      showToast("success", `Push 成功推送到远程仓库`);
      await refreshGitStatus();
    } catch (err: any) {
      showToast("error", `Push 失败: ${err.message || err}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Git Fetch
  const handleFetch = async () => {
    setActionLoading("fetch");
    try {
      await nativeService.gitFetch(resolvedPath);
      showToast("success", "Fetch 成功同步远程索引");
      await refreshGitStatus();
    } catch (err: any) {
      showToast("error", `Fetch 失败: ${err.message || err}`);
    } finally {
      setActionLoading(null);
    }
  };

  // 删除所选分支
  const handleDeleteBranch = async (branch: string) => {
    if (branch === gitData.currentBranch) {
      showToast("error", "无法删除当前正处于检出状态的分支！");
      return;
    }
    setActionLoading(`delete-${branch}`);
    try {
      await nativeService.deleteBranch(branch, true, resolvedPath);
      showToast("success", `已删除本地分支: ${branch}`);
      setSelectedBranch(null);
      await refreshGitStatus();
    } catch (err: any) {
      showToast("error", `删除失败: ${err.message || err}`);
    } finally {
      setActionLoading(null);
    }
  };

  // 合并到当前分支
  const handleMergeBranch = async (branch: string) => {
    setActionLoading(`merge-${branch}`);
    try {
      const out = await nativeService.mergeBranch(branch, resolvedPath);
      showToast("success", `合并完成: ${out.slice(0, 60)}`);
      await refreshGitStatus();
    } catch (err: any) {
      showToast("error", `合并失败: ${err.message || err}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (!isOpen) return null;

  // 过滤分支
  const filteredLocalBranches = gitData.localBranches.filter((b) =>
    b.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredRemoteBranches = gitData.remoteBranches.filter((b) =>
    b.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const localTree = buildBranchTree(filteredLocalBranches, gitData.currentBranch);
  const remoteTree = buildBranchTree(filteredRemoteBranches, "");

  // 递归渲染树节点
  const renderTreeNode = (node: TreeNode, depth = 0) => {
    const isExpanded = expandedFolders[node.id] ?? true;
    const isSelected = selectedBranch === node.fullPath;

    if (node.isFolder) {
      return (
        <div key={node.id} className="flex flex-col">
          <div
            onClick={() => toggleFolder(node.id)}
            style={{ paddingLeft: `${depth * 12 + 6}px` }}
            className="py-1 pr-2 rounded-md hover:bg-[#f4efea] flex items-center justify-between text-[#475569] hover:text-[#1e1b18] cursor-pointer transition-colors text-[11px] font-medium select-none"
          >
            <div className="flex items-center gap-1.5 truncate">
              {isExpanded ? <ChevronDown size={12} className="text-[#94a3b8]" /> : <ChevronRight size={12} className="text-[#94a3b8]" />}
              {isExpanded ? <FolderOpen size={13} className="text-[#d97706]" /> : <Folder size={13} className="text-[#d97706]" />}
              <span className="font-mono font-semibold">{node.name}</span>
            </div>
            <span className="text-[10px] text-[#94a3b8]">{node.children.length}</span>
          </div>

          {isExpanded && (
            <div className="flex flex-col">
              {node.children.map((child) => renderTreeNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // 叶子节点 (具体分支)
    const isCurrent = node.isCurrent || node.fullPath === gitData.currentBranch;

    return (
      <div
        key={node.id}
        onClick={() => setSelectedBranch(node.fullPath === selectedBranch ? null : node.fullPath)}
        style={{ paddingLeft: `${depth * 12 + 18}px` }}
        className={`group relative py-1.5 pr-2 rounded-md flex items-center justify-between cursor-pointer transition-all text-[11px] ${
          isCurrent
            ? "bg-[#fef3eb] text-[#c2410c] font-bold"
            : isSelected
            ? "bg-[#f1f5f9] text-[#0f172a] font-semibold"
            : "hover:bg-[#faf8f5] text-[#334155] hover:text-[#0f172a]"
        }`}
      >
        <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
          {isCurrent ? (
            <Tag size={12} className="text-[#d96b27] shrink-0 fill-[#fed7aa]" />
          ) : (
            <GitBranch size={12} className="text-[#94a3b8] group-hover:text-[#d96b27] shrink-0" />
          )}
          <span className="truncate font-mono">{node.name}</span>
          {isCurrent && (
            <span className="text-[9px] bg-[#ffedd5] text-[#c2410c] px-1 rounded font-sans font-normal shrink-0">
              HEAD
            </span>
          )}
        </div>

        {/* 悬浮快捷操作菜单 (Checkout / Merge / Delete) */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isCurrent && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCheckout(node.fullPath);
              }}
              title="检出此分支 (Checkout)"
              className="px-1.5 py-0.5 rounded bg-white hover:bg-[#e0f2fe] text-[#0284c7] border border-[#bae6fd] text-[10px] font-semibold cursor-pointer shadow-2xs"
            >
              检出
            </button>
          )}
          {!isCurrent && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleMergeBranch(node.fullPath);
              }}
              title={`将 ${node.name} 合并到当前分支`}
              className="p-1 hover:bg-[#e2e8f0] rounded text-[#475569] hover:text-[#1e1b18]"
            >
              <GitMerge size={11} />
            </button>
          )}
          {!isCurrent && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteBranch(node.fullPath);
              }}
              title="删除此分支"
              className="p-1 hover:bg-[#fee2e2] rounded text-[#ef4444]"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-8 left-0 z-50 w-96 bg-white border border-[#e5dfd8] rounded-2xl shadow-2xl overflow-hidden flex flex-row text-xs font-sans animate-in fade-in slide-in-from-bottom-2 duration-150 select-none"
      style={{
        boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.2), 0 8px 16px -4px rgba(0, 0, 0, 0.1)",
        height: "460px",
      }}
    >
      {/* 1. 左侧垂直快捷动作栏 (Left Icon Toolbar) */}
      <div className="w-10 bg-[#faf8f5] border-r border-[#f4efea] flex flex-col items-center py-2.5 gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setIsCreatingBranch(true)}
          title="新建分支 (New Branch)"
          className="w-7 h-7 rounded-lg hover:bg-[#f4efea] text-[#475569] hover:text-[#d96b27] flex items-center justify-center cursor-pointer transition-colors"
        >
          <Plus size={15} />
        </button>
        <button
          type="button"
          onClick={handlePull}
          disabled={actionLoading !== null}
          title="拉取当前分支 (Git Pull)"
          className="w-7 h-7 rounded-lg hover:bg-[#f0fdf4] text-[#166534] flex items-center justify-center cursor-pointer transition-colors"
        >
          <ArrowDownLeft size={15} className={actionLoading === "pull" ? "animate-spin text-[#16a34a]" : ""} />
        </button>
        <button
          type="button"
          onClick={handlePush}
          disabled={actionLoading !== null}
          title="推送当前分支 (Git Push)"
          className="w-7 h-7 rounded-lg hover:bg-[#eff6ff] text-[#1d4ed8] flex items-center justify-center cursor-pointer transition-colors"
        >
          <ArrowUpRight size={15} className={actionLoading === "push" ? "animate-spin text-[#2563eb]" : ""} />
        </button>
        <button
          type="button"
          onClick={handleFetch}
          disabled={actionLoading !== null}
          title="同步远程索引 (Git Fetch)"
          className="w-7 h-7 rounded-lg hover:bg-[#faf5ff] text-[#7e22ce] flex items-center justify-center cursor-pointer transition-colors"
        >
          <RefreshCw size={13} className={actionLoading === "fetch" || loading ? "animate-spin text-[#9333ea]" : ""} />
        </button>
        
        <div className="w-5 h-[1px] bg-[#e5dfd8] my-0.5" />

        <button
          type="button"
          onClick={toggleExpandAll}
          title="展开 / 折叠所有目录"
          className="w-7 h-7 rounded-lg hover:bg-[#f4efea] text-[#64748b] hover:text-[#1e1b18] flex items-center justify-center cursor-pointer transition-colors"
        >
          <ChevronsUpDown size={14} />
        </button>

        <div className="mt-auto flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            title="关闭浮层 (Esc)"
            className="w-7 h-7 rounded-lg hover:bg-[#fee2e2] text-[#94a3b8] hover:text-[#ef4444] flex items-center justify-center cursor-pointer transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* 2. 右侧主体内容区域 (Top Search + Branch Tree) */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* 顶部搜索框 */}
        <div className="p-2.5 border-b border-[#f4efea] bg-[#faf8f5] flex flex-col gap-2">
          <div className="relative flex items-center">
            <Search size={13} className="absolute left-2.5 text-[#94a3b8]" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="分支或标签 (Filter branches)..."
              className="w-full pl-7 pr-6 py-1 bg-white border border-[#e5dfd8] focus:border-[#d96b27] rounded-lg text-xs outline-none transition-colors font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 text-[#94a3b8] hover:text-[#1e1b18]"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* 新建分支内联表单 */}
          {isCreatingBranch && (
            <div className="p-2 rounded-xl bg-[#fef3eb] border border-[#fed7aa] flex items-center gap-1.5 animate-in fade-in">
              <input
                type="text"
                autoFocus
                value={newBranchInput}
                onChange={(e) => setNewBranchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateBranch();
                  if (e.key === "Escape") setIsCreatingBranch(false);
                }}
                placeholder="如: feature/dev-5.0.1-iot..."
                className="flex-1 px-2 py-0.5 text-xs border border-[#e5dfd8] focus:border-[#d96b27] rounded-md bg-white outline-none font-mono"
              />
              <button
                type="button"
                onClick={handleCreateBranch}
                disabled={!newBranchInput.trim()}
                className="bg-[#d96b27] hover:bg-[#b85417] text-white px-2.5 py-0.5 rounded-md text-[11px] font-bold cursor-pointer disabled:opacity-50"
              >
                创建
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingBranch(false)}
                className="text-[#94a3b8] hover:text-[#1e1b18] p-0.5"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        {/* 反馈提示横幅 */}
        {feedbackToast && (
          <div
            className={`px-3 py-1.5 text-[10px] flex items-center gap-1.5 border-b font-medium animate-in fade-in ${
              feedbackToast.type === "success"
                ? "bg-[#ecfdf5] border-[#a7f3d0] text-[#065f46]"
                : feedbackToast.type === "error"
                ? "bg-[#fef2f2] border-[#fecaca] text-[#991b1b]"
                : "bg-[#eff6ff] border-[#bfdbfe] text-[#1e40af]"
            }`}
          >
            {feedbackToast.type === "success" ? <Check size={12} /> : <AlertCircle size={12} />}
            <span className="truncate">{feedbackToast.msg}</span>
          </div>
        )}

        {/* 3. 树形分支列表区 (Scrollable Tree View) */}
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2 scrollbar-thin">
          {/* ① HEAD (当前活动分支) 置顶卡片 */}
          <div className="flex flex-col gap-1 pb-1.5 border-b border-[#f4efea]">
            <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider px-1">
              HEAD (当前分支)
            </span>
            <div className="px-2.5 py-1.5 rounded-lg bg-[#fef3eb] text-[#c2410c] border border-[#fed7aa] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag size={13} className="text-[#d96b27] fill-[#fed7aa]" />
                <span className="font-mono font-bold text-xs">{gitData.currentBranch}</span>
              </div>
              <span className="text-[10px] text-[#9a3412] font-semibold">
                {gitData.uncommittedFiles.length === 0 ? "🟢 Clean" : `🟡 ${gitData.uncommittedFiles.length} 修改`}
              </span>
            </div>
          </div>

          {/* ② 本地分支层级目录树 (Local Tree) */}
          <div className="flex flex-col gap-0.5">
            <div
              onClick={() => toggleFolder("local-root")}
              className="flex items-center justify-between text-[10px] font-bold text-[#64748b] hover:text-[#1e1b18] cursor-pointer uppercase tracking-wider px-1 py-0.5 select-none"
            >
              <div className="flex items-center gap-1">
                {expandedFolders["local-root"] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                <span>本地 (Local)</span>
              </div>
              <span className="text-[9px] font-normal text-[#94a3b8]">{filteredLocalBranches.length}</span>
            </div>

            {expandedFolders["local-root"] && (
              <div className="flex flex-col gap-0.5 pl-1">
                {localTree.length === 0 ? (
                  <span className="text-[10px] text-[#94a3b8] italic px-2 py-1">无匹配本地分支</span>
                ) : (
                  localTree.map((node) => renderTreeNode(node, 0))
                )}
              </div>
            )}
          </div>

          {/* ③ 远程跟踪分支 (Remote Tracking) */}
          {gitData.remoteBranches.length > 0 && (
            <div className="flex flex-col gap-0.5 pt-1.5 border-t border-[#f4efea]">
              <div
                onClick={() => toggleFolder("remote-root")}
                className="flex items-center justify-between text-[10px] font-bold text-[#64748b] hover:text-[#1e1b18] cursor-pointer uppercase tracking-wider px-1 py-0.5 select-none"
              >
                <div className="flex items-center gap-1">
                  {expandedFolders["remote-root"] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  <Globe size={11} className="text-[#0284c7]" />
                  <span>远程 (Remote / origin)</span>
                </div>
                <span className="text-[9px] font-normal text-[#94a3b8]">{filteredRemoteBranches.length}</span>
              </div>

              {expandedFolders["remote-root"] && (
                <div className="flex flex-col gap-0.5 pl-1">
                  {remoteTree.map((node) => {
                    const localName = node.fullPath.replace(/^origin\//, "");
                    return (
                      <div
                        key={node.id}
                        onClick={() => handleCheckout(localName)}
                        className="py-1 px-2 rounded-md hover:bg-[#faf8f5] flex items-center justify-between text-[11px] text-[#64748b] hover:text-[#0f172a] cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Globe size={11} className="text-[#94a3b8]" />
                          <span className="font-mono text-[11px] truncate">{node.fullPath}</span>
                        </div>
                        <span className="text-[10px] text-[#0284c7] opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                          检出到本地
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ④ 标签列表 (Tags) */}
          {gitData.tags.length > 0 && (
            <div className="flex flex-col gap-0.5 pt-1.5 border-t border-[#f4efea]">
              <div
                onClick={() => toggleFolder("tags-root")}
                className="flex items-center justify-between text-[10px] font-bold text-[#64748b] hover:text-[#1e1b18] cursor-pointer uppercase tracking-wider px-1 py-0.5 select-none"
              >
                <div className="flex items-center gap-1">
                  {expandedFolders["tags-root"] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  <Tag size={11} className="text-[#9333ea]" />
                  <span>标签 (Tags)</span>
                </div>
                <span className="text-[9px] font-normal text-[#94a3b8]">{gitData.tags.length}</span>
              </div>

              {expandedFolders["tags-root"] && (
                <div className="flex flex-col gap-0.5 pl-2">
                  {gitData.tags.map((t) => (
                    <div
                      key={t}
                      className="py-1 px-2 rounded-md hover:bg-[#faf8f5] flex items-center justify-between text-[11px] text-[#64748b] font-mono"
                    >
                      <div className="flex items-center gap-1.5">
                        <Tag size={11} className="text-[#9333ea]" />
                        <span>{t}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部信息条 */}
        <div className="px-3 py-1.5 bg-[#faf8f5] border-t border-[#f4efea] flex items-center justify-between text-[10px] text-[#78716c]">
          <span className="font-mono truncate">{projectName}</span>
          <span className="text-[#94a3b8]">按 Esc 快速退出</span>
        </div>
      </div>
    </div>
  );
};
