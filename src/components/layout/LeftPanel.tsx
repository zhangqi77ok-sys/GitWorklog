import React, { useState, useRef, useEffect } from "react";
import {
  Folder,
  FolderOpen,
  Plus,
  MoreVertical,
  SlidersHorizontal,
  FolderPlus,
  Search,
  X,
  Edit3,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { nativeService } from "../../services/nativeService";
import { formatSessionTime, formatFullDateTime } from "../../utils/timeUtils";

export interface ProjectSession {
  id: string;
  title: string;
  time: string;
  updatedAt?: number;        // 会话实际最新更改时间戳 (ms)
  projectFolder?: string;
  status?: "running" | "idle" | "error";
}

export interface ProjectFolder {
  id: string;
  name: string;
  path?: string;
  isExpanded: boolean;
  sessions: ProjectSession[];
  files?: string[];
  totalSessionsCount?: number;
}

interface LeftPanelProps {
  width: number;
  activeSessionId?: string;
  onSelectSession?: (sessionId: string, sessionTitle: string, projectName?: string) => void;
}

const STORAGE_PROJECTS_KEY = "codemind_real_projects_v2";

const DEFAULT_REAL_PROJECTS: ProjectFolder[] = [
  {
    id: "proj-agent-learning",
    name: "agent-learning",
    isExpanded: true,
    files: [
      "src/App.tsx",
      "src/components/layout/ChatColumn.tsx",
      "src/components/layout/LeftPanel.tsx",
      "src/services/llmGatewayEngine.ts",
      "src-tauri/tauri.conf.json",
      "package.json",
      "README.md",
    ],
    sessions: [
      {
        id: "sess-1",
        title: "AI 编程协同初始会话",
        time: "",
        updatedAt: Date.now(),
        projectFolder: "agent-learning",
        status: "idle",
      },
    ],
  },
];

export const LeftPanel: React.FC<LeftPanelProps> = ({
  width,
  activeSessionId = "sess-1",
  onSelectSession,
}) => {
  // 从本地持久化加载真实项目列表
  const [projects, setProjects] = useState<ProjectFolder[]>(() => {
    try {
      localStorage.removeItem("codemind_real_projects_v1");
      const stored = localStorage.getItem(STORAGE_PROJECTS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const filtered = parsed.filter(
            (p) =>
              p.name &&
              !p.name.includes("brave-pasteur") &&
              !p.name.includes("F盘 geek-boot-parent")
          );
          if (filtered.length > 0) {
            // 确保所有会话都具备合法 updatedAt 时间戳
            return (filtered as ProjectFolder[]).map((p: ProjectFolder, pi: number) => ({
              ...p,
              sessions: (p.sessions || []).map((s: ProjectSession, si: number) => {
                let uAt = s.updatedAt;
                if (!uAt || typeof uAt !== "number") {
                  const match = s.id?.match(/\d{10,}/);
                  uAt = match ? Number(match[0]) : Date.now() - (pi * 3600000 + si * 600000);
                }
                return {
                  ...s,
                  updatedAt: uAt,
                };
              }),
            }));
          }
        }
      }
    } catch (e) {}
    return DEFAULT_REAL_PROJECTS;
  });

  const [currentActiveId, setCurrentActiveId] = useState<string>(activeSessionId);
  const [showAllMap, setShowAllMap] = useState<Record<string, boolean>>({});

  // 项目与会话菜单状态
  const [projectMenuOpenId, setProjectMenuOpenId] = useState<string | null>(null);
  const [sessionMenuOpenId, setSessionMenuOpenId] = useState<string | null>(null);

  // 重命名弹窗状态
  const [renameModal, setRenameModal] = useState<{
    isOpen: boolean;
    type: "project" | "session";
    targetId: string;
    targetProjId?: string;
    currentName: string;
  }>({
    isOpen: false,
    type: "project",
    targetId: "",
    currentName: "",
  });
  const [renameInput, setRenameInput] = useState("");

  // 深度同步外部 activeSessionId 属性
  useEffect(() => {
    if (activeSessionId) {
      setCurrentActiveId(activeSessionId);
    }
  }, [activeSessionId]);

  // 监听当前活跃会话状态变化 (运行中绿色转动、空闲蓝色、失败红色)
  useEffect(() => {
    const handleStatusChange = (e: any) => {
      const { sessionId, status } = e.detail || {};
      const targetId = sessionId || currentActiveId || activeSessionId;
      if (status && targetId) {
        setProjects((prev) =>
          prev.map((proj) => ({
            ...proj,
            sessions: proj.sessions.map((s) =>
              // 会话产生活动（发送/完成/失败）时刷新实际最新更改时间
              s.id === targetId ? { ...s, status, updatedAt: Date.now() } : s
            ),
          }))
        );
      }
    };
    window.addEventListener("session-status-changed", handleStatusChange);
    return () => window.removeEventListener("session-status-changed", handleStatusChange);
  }, [currentActiveId, activeSessionId]);

  // 辅助函数：渲染会话三态圆标
  const renderSessionStatusBadge = (status?: "running" | "idle" | "error") => {
    const currentStatus = status || "idle";
    if (currentStatus === "running") {
      return (
        <span className="w-3 h-3 flex items-center justify-center shrink-0" title="正在生成与推理中 (Running)...">
          <span className="w-2.5 h-2.5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin will-change-transform"></span>
        </span>
      );
    }
    if (currentStatus === "error") {
      return (
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 shadow-xs will-change-opacity animate-pulse" title="会话执行失败/异常 (Error)"></span>
      );
    }
    return (
      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 shadow-xs will-change-opacity" title="空闲就绪会话 (Idle)"></span>
    );
  };

  // 每次项目变动持久化保存到磁盘缓存
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(projects));
    } catch (e) {}
  }, [projects]);

  // 真实筛选与搜索会话浮层状态
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRange, setFilterRange] = useState<"all" | "today" | "week">("all");
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  // 隐藏的 Windows 系统文件夹选择器引用
  const folderInputRef = useRef<HTMLInputElement>(null);

  // 点击外部关闭筛选浮层
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        filterPopoverRef.current &&
        !filterPopoverRef.current.contains(e.target as Node)
      ) {
        setIsFilterOpen(false);
      }
    };
    if (isFilterOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFilterOpen]);

  // 切换折叠/展开
  const toggleFolder = (projId: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projId ? { ...p, isExpanded: !p.isExpanded } : p))
    );
  };

  // 新建会话模态弹窗状态
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [newSessionTargetProject, setNewSessionTargetProject] = useState<ProjectFolder | null>(null);
  const [newSessionTitleInput, setNewSessionTitleInput] = useState("New AI Coding Task");

  // 打开新建会话弹窗
  const handleAddSession = (e: React.MouseEvent, proj: ProjectFolder) => {
    e.stopPropagation();
    setNewSessionTargetProject(proj);
    setNewSessionTitleInput(`AI 对话任务 #${(proj.sessions?.length || 0) + 1}`);
    setIsNewSessionModalOpen(true);
  };

  // 确认创建新会话
  const handleConfirmCreateSession = () => {
    if (!newSessionTargetProject || !newSessionTitleInput.trim()) return;
    const title = newSessionTitleInput.trim();
    const proj = newSessionTargetProject;

    const newSess: ProjectSession = {
      id: `sess-${Date.now()}`,
      title,
      time: "",
      updatedAt: Date.now(),
      projectFolder: proj.name,
      status: "idle",
    };

    setProjects((prev) =>
      prev.map((p) =>
        p.id === proj.id
          ? { ...p, isExpanded: true, sessions: [newSess, ...p.sessions] }
          : p
      )
    );
    setCurrentActiveId(newSess.id);
    setIsNewSessionModalOpen(false);

    if (onSelectSession) onSelectSession(newSess.id, newSess.title, proj.name);
    const targetPath =
      proj.path ||
      (proj.name === "geek-boot-parent" ? "d:/weihu/geek-boot-parent" : "d:/weihu/agent-learning");

    window.dispatchEvent(
      new CustomEvent("project-switched", {
        detail: {
          projectName: proj.name,
          fullPath: targetPath,
          files: proj.files || [],
          sessionTitle: newSess.title,
        },
      })
    );
  };

  // 真实选择 Windows 文件夹并深度读取项目内容 (支持多次添加同名项目，每个生成独立唯一ID)
  const handleOpenWindowsFolderDialog = async () => {
    try {
      const selectedPath = await nativeService.pickFolder();
      if (selectedPath) {
        const normalized = selectedPath.replace(/\\/g, "/");
        const folderName = normalized.split("/").filter(Boolean).pop() || selectedPath;

        let realFiles: string[] = [];
        try {
          const tree = await nativeService.listDirectoryTree(selectedPath);
          const flatten = (entries: any[], prefix = ""): string[] => {
            let res: string[] = [];
            for (const e of entries) {
              const rel = prefix ? `${prefix}/${e.name}` : e.name;
              if (e.is_dir) {
                res.push(`${rel}/`);
                if (e.children) res = res.concat(flatten(e.children, rel));
              } else {
                res.push(rel);
              }
            }
            return res;
          };
          realFiles = flatten(tree);
        } catch (e) {
          realFiles = ["src/index.ts", "package.json", "README.md"];
        }

        // 使用 Date.now() + 随机数保证同一名称项目可重复独立添加
        const newProj: ProjectFolder = {
          id: `proj-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          name: folderName,
          path: selectedPath,
          isExpanded: true,
          files: realFiles,
          sessions: [
            {
              id: `sess-${Date.now()}`,
              title: `Project Initial Session (${folderName})`,
              time: "",
              updatedAt: Date.now(),
              projectFolder: folderName,
              status: "idle",
            },
          ],
        };

        setProjects((prev) => [newProj, ...prev]);
        setCurrentActiveId(newProj.sessions[0].id);
        if (onSelectSession)
          onSelectSession(newProj.sessions[0].id, newProj.sessions[0].title, folderName);

        window.dispatchEvent(
          new CustomEvent("project-switched", {
            detail: {
              projectName: folderName,
              fullPath: selectedPath,
              files: realFiles,
              sessionTitle: newProj.sessions[0].title,
            },
          })
        );
        return;
      }
    } catch (e) {
      console.warn("Native pick folder error:", e);
    }
  };

  const handleSelectSession = (sess: ProjectSession, proj: ProjectFolder) => {
    setCurrentActiveId(sess.id);
    const targetPath =
      proj.path ||
      (proj.name === "geek-boot-parent" ? "d:/weihu/geek-boot-parent" : "d:/weihu/agent-learning");

    if (onSelectSession) onSelectSession(sess.id, sess.title, proj.name);
    window.dispatchEvent(
      new CustomEvent("project-switched", {
        detail: {
          projectName: proj.name,
          fullPath: targetPath,
          files: proj.files || [],
          sessionTitle: sess.title,
        },
      })
    );
  };

  // 移除项目 (Remove Project)
  const handleRemoveProject = (projId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setProjects((prev) => {
      const remaining = prev.filter((p) => p.id !== projId);
      if (remaining.length > 0) {
        const firstProj = remaining[0];
        if (firstProj.sessions.length > 0) {
          const firstSess = firstProj.sessions[0];
          setCurrentActiveId(firstSess.id);
          if (onSelectSession) onSelectSession(firstSess.id, firstSess.title, firstProj.name);
        }
      }
      return remaining;
    });
    setProjectMenuOpenId(null);
  };

  // 移除会话 (Remove Session)
  const handleRemoveSession = (projId: string, sessId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projId) return p;
        const newSessions = p.sessions.filter((s) => s.id !== sessId);
        // 如果删光了，自动补一个初始会话
        if (newSessions.length === 0) {
          const fallbackSess: ProjectSession = {
            id: `sess-${Date.now()}`,
            title: `AI 初始对话 (${p.name})`,
            time: "",
            updatedAt: Date.now(),
            projectFolder: p.name,
            status: "idle",
          };
          if (sessId === currentActiveId) {
            setCurrentActiveId(fallbackSess.id);
            if (onSelectSession) onSelectSession(fallbackSess.id, fallbackSess.title, p.name);
          }
          return { ...p, sessions: [fallbackSess] };
        }
        if (sessId === currentActiveId) {
          const nextSess = newSessions[0];
          setCurrentActiveId(nextSess.id);
          if (onSelectSession) onSelectSession(nextSess.id, nextSess.title, p.name);
        }
        return { ...p, sessions: newSessions };
      })
    );
    setSessionMenuOpenId(null);
  };

  // 打开重命名弹窗
  const handleOpenRenameModal = (
    type: "project" | "session",
    targetId: string,
    currentName: string,
    targetProjId?: string,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    setRenameModal({
      isOpen: true,
      type,
      targetId,
      targetProjId,
      currentName,
    });
    setRenameInput(currentName);
    setProjectMenuOpenId(null);
    setSessionMenuOpenId(null);
  };

  // 确认重命名
  const handleConfirmRename = () => {
    if (!renameInput.trim()) return;
    const val = renameInput.trim();

    if (renameModal.type === "project") {
      setProjects((prev) =>
        prev.map((p) => (p.id === renameModal.targetId ? { ...p, name: val } : p))
      );
    } else {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== renameModal.targetProjId) return p;
          return {
            ...p,
            sessions: p.sessions.map((s) =>
              s.id === renameModal.targetId ? { ...s, title: val } : s
            ),
          };
        })
      );
    }
    setRenameModal((prev) => ({ ...prev, isOpen: false }));
  };

  // 重新扫描项目磁盘文件
  const handleRescanProjectDisk = async (proj: ProjectFolder, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const targetPath =
      proj.path ||
      (proj.name === "geek-boot-parent" ? "d:/weihu/geek-boot-parent" : "d:/weihu/agent-learning");
    try {
      const tree = await nativeService.listDirectoryTree(targetPath);
      const flatten = (entries: any[], prefix = ""): string[] => {
        let res: string[] = [];
        for (const entry of entries) {
          const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
          if (entry.is_dir) {
            res.push(`${rel}/`);
            if (entry.children) res = res.concat(flatten(entry.children, rel));
          } else {
            res.push(rel);
          }
        }
        return res;
      };
      const files = flatten(tree);
      setProjects((prev) =>
        prev.map((p) => (p.id === proj.id ? { ...p, files } : p))
      );
      window.dispatchEvent(
        new CustomEvent("project-switched", {
          detail: {
            projectName: proj.name,
            fullPath: targetPath,
            files,
            sessionTitle: proj.sessions[0]?.title || "",
          },
        })
      );
    } catch (err) {
      console.warn("Rescan disk failed:", err);
    }
    setProjectMenuOpenId(null);
  };

  // 聚合所有会话以供筛选
  const allSessions: ProjectSession[] = projects.flatMap((p) =>
    p.sessions.map((s) => ({ ...s, projectFolder: p.name }))
  );

  // 过滤会话
  const filteredSessions = allSessions.filter((s) => {
    const matchQuery =
      !searchQuery.trim() ||
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.projectFolder && s.projectFolder.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchQuery) return false;
    const uAt = s.updatedAt || Date.now();
    if (filterRange === "today") {
      return new Date(uAt).toDateString() === new Date().toDateString();
    }
    if (filterRange === "week") {
      return Date.now() - uAt <= 7 * 24 * 3600 * 1000;
    }
    return true;
  });

  return (
    <aside
      style={{ width: `${width}px` }}
      className="bg-[#faf8f5] border-r border-[#e5dfd8] flex flex-col justify-between shrink-0 select-none text-xs overflow-hidden relative"
    >
      {/* 顶部标题栏：图标控制与操作 */}
      <div className="px-3 pt-2.5 pb-2 flex justify-between items-center shrink-0 border-b border-[#f4efea]">
        <div className="flex items-center gap-1.5 text-[#6b7280]">
          <button
            type="button"
            className="w-6 h-6 rounded flex items-center justify-center text-[#6b7280] hover:bg-[#ebe5df] cursor-pointer"
            title="侧边栏"
          >
            <Folder size={14} />
          </button>
          <button
            type="button"
            className="w-6 h-6 rounded flex items-center justify-center text-[#6b7280] hover:bg-[#ebe5df] cursor-pointer"
            title="分栏视图"
          >
            <SlidersHorizontal size={13} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-[#6b7280]">
          {/* 筛选会话按钮 */}
          <button
            onClick={() => setIsFilterOpen((prev) => !prev)}
            className={`w-6 h-6 rounded-md flex items-center justify-center cursor-pointer transition-colors ${
              isFilterOpen
                ? "bg-[#d96b27] text-white shadow-2xs"
                : "hover:bg-[#ebe5df] text-[#6b7280]"
            }`}
            title="筛选与快速搜索会话"
          >
            <Search size={13} />
          </button>

          {/* 打开 Windows 文件夹选择器 */}
          <button
            onClick={handleOpenWindowsFolderDialog}
            className="w-6 h-6 rounded-md hover:bg-[#ebe5df] flex items-center justify-center cursor-pointer transition-colors text-[#374151]"
            title="从 Windows 系统选择并打开项目文件夹"
          >
            <FolderPlus size={14} />
          </button>

          {/* 隐藏的 Windows 系统文件夹选择原生 input */}
          <input
            type="file"
            ref={folderInputRef}
            // @ts-ignore
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
          />
        </div>
      </div>

      {/* 顶部 3 个核心快捷按钮：新建会话 / 搜索 / 自动化 */}
      <div className="px-2.5 pt-2 pb-1 flex flex-col gap-1 shrink-0 border-b border-[#f4efea]">
        <button
          type="button"
          onClick={(e) => {
            const firstProj = projects[0] || DEFAULT_REAL_PROJECTS[0];
            handleAddSession(e, firstProj);
          }}
          className="w-full py-1.5 px-2.5 bg-white hover:bg-[#f4efea] border border-[#e5dfd8] rounded-lg text-xs font-semibold text-[#1e1b18] flex items-center gap-2 cursor-pointer transition-colors shadow-2xs"
        >
          <Plus size={13} className="text-[#d96b27]" />
          <span>新建会话</span>
        </button>

        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className="py-1 px-2 hover:bg-[#ebe5df] rounded-md text-[11px] text-[#4b5563] flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Search size={11} className="text-[#78716c]" />
            <span>搜索</span>
          </button>
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className="py-1 px-2 hover:bg-[#ebe5df] rounded-md text-[11px] text-[#4b5563] flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw size={11} className="text-[#78716c]" />
            <span>自动化</span>
          </button>
        </div>
      </div>

      {/* 真实会话筛选与搜索浮层 (Session Search & Filter Popover) */}
      {isFilterOpen && (
        <div
          ref={filterPopoverRef}
          className="absolute top-11 left-2 right-2 bg-white border border-[#e5dfd8] rounded-xl shadow-2xl p-2.5 z-50 flex flex-col gap-2 animate-in fade-in zoom-in-95"
        >
          <div className="flex items-center justify-between border-b border-[#f4efea] pb-1.5">
            <span className="font-bold text-[#1e1b18] text-[11px] flex items-center gap-1">
              <Search size={11} className="text-[#d96b27]" /> 搜索与筛选历史会话
            </span>
            <button
              onClick={() => setIsFilterOpen(false)}
              className="text-[#9ca3af] hover:text-[#1e1b18] cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>

          {/* 实时搜索框 */}
          <div className="relative flex items-center">
            <Search size={12} className="absolute left-2 text-[#9ca3af]" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索会话标题或项目名称..."
              className="w-full pl-6 pr-2 py-1.5 border border-[#e5dfd8] focus:border-[#d96b27] rounded-lg text-xs outline-none bg-[#faf8f5]"
            />
          </div>

          {/* 时间范围快速切换胶囊 */}
          <div className="flex gap-1 text-[10px]">
            <button
              onClick={() => setFilterRange("all")}
              className={`px-2 py-0.5 rounded-md font-medium cursor-pointer ${
                filterRange === "all"
                  ? "bg-[#d96b27] text-white font-semibold"
                  : "bg-[#f4efea] text-[#6b7280] hover:bg-[#ebe5df]"
              }`}
            >
              全部 ({allSessions.length})
            </button>
            <button
              onClick={() => setFilterRange("today")}
              className={`px-2 py-0.5 rounded-md font-medium cursor-pointer ${
                filterRange === "today"
                  ? "bg-[#d96b27] text-white font-semibold"
                  : "bg-[#f4efea] text-[#6b7280] hover:bg-[#ebe5df]"
              }`}
            >
              今天 (24h)
            </button>
            <button
              onClick={() => setFilterRange("week")}
              className={`px-2 py-0.5 rounded-md font-medium cursor-pointer ${
                filterRange === "week"
                  ? "bg-[#d96b27] text-white font-semibold"
                  : "bg-[#f4efea] text-[#6b7280] hover:bg-[#ebe5df]"
              }`}
            >
              最近 7 天
            </button>
          </div>

          {/* 实时匹配结果列表 */}
          <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5 pt-1">
            {filteredSessions.length === 0 ? (
              <span className="text-[11px] text-[#9ca3af] text-center py-3">
                未找到匹配的会话
              </span>
            ) : (
              filteredSessions.map((sess) => (
                <div
                  key={sess.id}
                  onClick={() => {
                    const targetProj = projects.find((p) => p.name === sess.projectFolder);
                    if (targetProj) {
                      handleSelectSession(sess, targetProj);
                    } else {
                      setCurrentActiveId(sess.id);
                      if (onSelectSession) onSelectSession(sess.id, sess.title, sess.projectFolder);
                    }
                    setIsFilterOpen(false);
                  }}
                  className="p-1.5 rounded-lg hover:bg-[#fef3eb] cursor-pointer flex justify-between items-center transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    {renderSessionStatusBadge(sess.status)}
                    <div className="flex flex-col min-w-0">
                      <span className="truncate font-medium text-[#1e1b18] group-hover:text-[#d96b27]">
                        {sess.title}
                      </span>
                      <span className="text-[10px] text-[#9ca3af] truncate">
                        {sess.projectFolder}
                      </span>
                    </div>
                  </div>
                  <span
                    className="text-[10px] text-[#9ca3af] shrink-0 font-mono"
                    title={formatFullDateTime(sess.updatedAt)}
                  >
                    {formatSessionTime(sess.updatedAt, sess.time)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 项目与会话树形列表 */}
      <div className="flex-1 px-2 py-1.5 overflow-y-auto flex flex-col gap-3 scrollbar-thin">
        {projects.map((proj) => {
          const isShowAll = showAllMap[proj.id] || false;
          const displaySessions =
            proj.totalSessionsCount && !isShowAll
              ? proj.sessions.slice(0, 6)
              : proj.sessions;

          const isProjectMenuOpen = projectMenuOpenId === proj.id;

          return (
            <div key={proj.id} className="flex flex-col gap-0.5 relative">
              {/* 1. 项目文件夹行 */}
              <div
                onClick={() => toggleFolder(proj.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setProjectMenuOpenId(proj.id);
                  setSessionMenuOpenId(null);
                }}
                className="group flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[#ebe5df]/70 cursor-pointer transition-colors text-[#374151]"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[#6b7280]">
                    {proj.isExpanded ? (
                      <FolderOpen size={14} className="text-[#6b7280]" />
                    ) : (
                      <Folder size={14} className="text-[#6b7280]" />
                    )}
                  </span>
                  <span className="font-semibold text-xs truncate text-[#374151]">
                    {proj.name}
                  </span>
                </div>

                {/* 悬浮/默认操作图标: 新增/重命名/删除/更多 */}
                <div className="flex items-center gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => handleAddSession(e, proj)}
                    className="w-5 h-5 rounded hover:bg-[#ded7ce] flex items-center justify-center text-[#6b7280] hover:text-[#d96b27] cursor-pointer"
                    title="在此项目下新建会话"
                  >
                    <Plus size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleOpenRenameModal("project", proj.id, proj.name, undefined, e)}
                    className="w-5 h-5 rounded hover:bg-[#ded7ce] flex items-center justify-center text-[#6b7280] hover:text-[#2563eb] cursor-pointer"
                    title="重命名项目"
                  >
                    <Edit3 size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveProject(proj.id, e)}
                    className="w-5 h-5 rounded hover:bg-[#fee2e2] flex items-center justify-center text-[#6b7280] hover:text-[#ef4444] cursor-pointer"
                    title="移除项目"
                  >
                    <Trash2 size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setProjectMenuOpenId((prev) => (prev === proj.id ? null : proj.id));
                      setSessionMenuOpenId(null);
                    }}
                    className="w-5 h-5 rounded hover:bg-[#ded7ce] flex items-center justify-center text-[#6b7280] cursor-pointer"
                    title="更多选项"
                  >
                    <MoreVertical size={12} />
                  </button>
                </div>
              </div>

              {/* 项目级更多操作弹出菜单 (Popover) */}
              {isProjectMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={(e) => {
                      e.stopPropagation();
                      setProjectMenuOpenId(null);
                    }}
                  />
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-8 right-2 z-50 w-36 bg-white border border-[#e5dfd8] rounded-xl shadow-xl p-1 flex flex-col gap-0.5 text-xs text-[#1e1b18] animate-in fade-in zoom-in-95"
                  >
                    <button
                      onClick={(e) => handleAddSession(e, proj)}
                      className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 hover:bg-[#faf8f5] text-[#334155] cursor-pointer transition-colors"
                    >
                      <Plus size={12} className="text-[#d96b27]" />
                      <span>新建会话</span>
                    </button>
                    <button
                      onClick={(e) => handleOpenRenameModal("project", proj.id, proj.name, undefined, e)}
                      className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 hover:bg-[#faf8f5] text-[#334155] cursor-pointer transition-colors"
                    >
                      <Edit3 size={12} className="text-[#2563eb]" />
                      <span>重命名项目</span>
                    </button>
                    <button
                      onClick={(e) => handleRescanProjectDisk(proj, e)}
                      className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 hover:bg-[#faf8f5] text-[#334155] cursor-pointer transition-colors"
                    >
                      <RefreshCw size={12} className="text-[#10b981]" />
                      <span>刷新磁盘文件</span>
                    </button>
                    <div className="w-full h-[1px] bg-[#f1f5f9] my-0.5" />
                    <button
                      onClick={(e) => handleRemoveProject(proj.id, e)}
                      className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 hover:bg-[#fee2e2] text-[#ef4444] cursor-pointer transition-colors"
                    >
                      <Trash2 size={12} />
                      <span>移除该项目</span>
                    </button>
                  </div>
                </>
              )}

              {/* 2. 项目下的会话子列表 (缩进) */}
              {proj.isExpanded && (
                <div className="flex flex-col gap-0.5 pl-2 mt-0.5">
                  {displaySessions.map((sess) => {
                    const isActive = currentActiveId === sess.id;
                    const isSessionMenuOpen = sessionMenuOpenId === sess.id;

                    return (
                      <div
                        key={sess.id}
                        onClick={() => handleSelectSession(sess, proj)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSessionMenuOpenId(sess.id);
                          setProjectMenuOpenId(null);
                        }}
                        className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-all ${
                          isActive
                            ? "bg-[#e5e7eb] text-[#111827] font-medium shadow-2xs"
                            : "text-[#4b5563] hover:bg-[#ebe5df]/60 hover:text-[#111827]"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          {renderSessionStatusBadge(sess.status)}
                          <span className="truncate text-xs leading-normal">
                            {sess.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className="text-[10px] text-[#9ca3af] font-mono shrink-0 group-hover:hidden"
                            title={formatFullDateTime(sess.updatedAt)}
                          >
                            {formatSessionTime(sess.updatedAt, sess.time)}
                          </span>

                          {/* 悬浮操作按钮组 (直接可见 ✏️ 重命名 / 🗑️ 删除 / ⋮ 更多) */}
                          <div className="hidden group-hover:flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={(e) => handleOpenRenameModal("session", sess.id, sess.title, proj.id, e)}
                              className="w-5 h-5 rounded hover:bg-[#ded7ce] flex items-center justify-center text-[#6b7280] hover:text-[#2563eb] cursor-pointer"
                              title="重命名会话"
                            >
                              <Edit3 size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleRemoveSession(proj.id, sess.id, e)}
                              className="w-5 h-5 rounded hover:bg-[#fee2e2] flex items-center justify-center text-[#6b7280] hover:text-[#ef4444] cursor-pointer"
                              title="删除会话"
                            >
                              <Trash2 size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSessionMenuOpenId((prev) => (prev === sess.id ? null : sess.id));
                                setProjectMenuOpenId(null);
                              }}
                              className="w-5 h-5 rounded hover:bg-[#ded7ce] flex items-center justify-center text-[#6b7280] cursor-pointer"
                              title="会话操作"
                            >
                              <MoreVertical size={11} />
                            </button>
                          </div>
                        </div>

                        {/* 会话级操作菜单 */}
                        {isSessionMenuOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-40 bg-transparent"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSessionMenuOpenId(null);
                              }}
                            />
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute top-7 right-2 z-50 w-28 bg-white border border-[#e5dfd8] rounded-xl shadow-xl p-1 flex flex-col gap-0.5 text-xs text-[#1e1b18] animate-in fade-in zoom-in-95"
                            >
                              <button
                                onClick={(e) => handleOpenRenameModal("session", sess.id, sess.title, proj.id, e)}
                                className="w-full px-2 py-1 rounded-lg flex items-center gap-1.5 hover:bg-[#faf8f5] text-[#334155] cursor-pointer transition-colors"
                              >
                                <Edit3 size={11} className="text-[#2563eb]" />
                                <span>重命名</span>
                              </button>
                              <button
                                onClick={(e) => handleRemoveSession(proj.id, sess.id, e)}
                                className="w-full px-2 py-1 rounded-lg flex items-center gap-1.5 hover:bg-[#fee2e2] text-[#ef4444] cursor-pointer transition-colors"
                              >
                                <Trash2 size={11} />
                                <span>删除会话</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}

                  {/* See all (N) 展开链接 */}
                  {proj.totalSessionsCount && proj.totalSessionsCount > 6 && (
                    <button
                      type="button"
                      onClick={() =>
                        setShowAllMap((prev) => ({
                          ...prev,
                          [proj.id]: !prev[proj.id],
                        }))
                      }
                      className="text-left px-2.5 py-1 text-xs text-[#6b7280] hover:text-[#111827] cursor-pointer"
                    >
                      {isShowAll
                        ? "Collapse"
                        : `See all (${proj.totalSessionsCount})`}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 底部：聊天入口与会话统计/Build 状态 (对齐截图) */}
      <div className="border-t border-[#f4efea] bg-[#faf8f5] px-3 py-2 flex flex-col gap-1 shrink-0 text-xs">
        <div className="font-semibold text-[#1e1b18] text-[11px] flex items-center justify-between">
          <span>聊天</span>
        </div>
        <div className="flex justify-between items-center text-[10px] text-[#9ca3af] font-mono pt-1 border-t border-[#f4efea]">
          <span className="flex items-center gap-1">
            <span className="text-[#6b7280]">山</span> {allSessions.length} 个会话
          </span>
          <span className="text-[#9ca3af] hover:text-[#1e1b18] cursor-pointer">&gt;_ build &gt;</span>
        </div>
      </div>

      {/* 统一重命名模态弹窗 */}
      {renameModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white border border-[#e5dfd8] rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="px-4 py-3 border-b border-[#f4efea] flex justify-between items-center bg-[#faf8f5]">
              <div className="flex items-center gap-2">
                <Edit3 size={14} className="text-[#d96b27]" />
                <h3 className="text-xs font-bold text-[#1e1b18]">
                  {renameModal.type === "project" ? "重命名项目工作区" : "重命名会话标题"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRenameModal((prev) => ({ ...prev, isOpen: false }))}
                className="w-6 h-6 rounded-lg hover:bg-[#ebe5df] flex items-center justify-center text-[#78716c] hover:text-[#1e1b18] cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-2">
              <label className="text-[11px] font-semibold text-[#4b5563]">
                请输入新名称：
              </label>
              <input
                type="text"
                autoFocus
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleConfirmRename();
                  } else if (e.key === "Escape") {
                    setRenameModal((prev) => ({ ...prev, isOpen: false }));
                  }
                }}
                className="w-full px-3 py-2 border border-[#e5dfd8] focus:border-[#d96b27] rounded-xl text-xs outline-none bg-[#faf8f5] font-medium"
              />
            </div>

            <div className="px-4 py-3 border-t border-[#f4efea] bg-[#faf8f5] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-3 py-1.5 rounded-xl border border-[#e5dfd8] hover:bg-[#ebe5df] text-[#4b5563] text-xs font-medium cursor-pointer transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmRename}
                className="px-4 py-1.5 rounded-xl bg-[#d96b27] hover:bg-[#b85417] text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
              >
                保存变更
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 现代化新建会话模态弹窗 (与系统整体风格保持一致) */}
      {isNewSessionModalOpen && newSessionTargetProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white border border-[#e5dfd8] rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95">
            {/* 弹窗头部 */}
            <div className="px-4 py-3 border-b border-[#f4efea] flex justify-between items-center bg-[#faf8f5]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#fef3eb] text-[#d96b27] flex items-center justify-center font-bold text-xs">
                  <Plus size={14} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#1e1b18]">
                    新建 AI 协同会话
                  </h3>
                  <p className="text-[10px] text-[#78716c]">
                    归属于项目：{newSessionTargetProject.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewSessionModalOpen(false)}
                className="w-6 h-6 rounded-lg hover:bg-[#ebe5df] flex items-center justify-center text-[#78716c] hover:text-[#1e1b18] cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="p-4 flex flex-col gap-2">
              <label className="text-[11px] font-semibold text-[#4b5563]">
                会话名称 / 任务主题：
              </label>
              <input
                type="text"
                autoFocus
                value={newSessionTitleInput}
                onChange={(e) => setNewSessionTitleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleConfirmCreateSession();
                  } else if (e.key === "Escape") {
                    setIsNewSessionModalOpen(false);
                  }
                }}
                placeholder="例如：重构用户鉴权拦截器..."
                className="w-full px-3 py-2 border border-[#e5dfd8] focus:border-[#d96b27] rounded-xl text-xs outline-none bg-[#faf8f5]"
              />
            </div>

            {/* 弹窗底部 */}
            <div className="px-4 py-3 border-t border-[#f4efea] bg-[#faf8f5] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewSessionModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-[#e5dfd8] hover:bg-[#ebe5df] text-[#4b5563] text-xs font-medium cursor-pointer transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmCreateSession}
                className="px-4 py-1.5 rounded-xl bg-[#d96b27] hover:bg-[#b85417] text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
              >
                立即创建
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
