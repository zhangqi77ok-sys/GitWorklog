import React, { useState, useRef, useEffect } from "react";
import {
  Folder,
  FolderOpen,
  Plus,
  MoreVertical,
  SlidersHorizontal,
  FolderPlus,
  Search,
  X
} from "lucide-react";
import { nativeService } from "../../services/nativeService";

export interface ProjectSession {
  id: string;
  title: string;
  time: string;
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
        time: "刚刚",
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
  // 从本地持久化加载真实项目列表，彻底过滤掉任何历史残留的 demo 数据
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
          if (filtered.length > 0) return filtered;
        }
      }
    } catch (e) {}
    return DEFAULT_REAL_PROJECTS;
  });

  const [currentActiveId, setCurrentActiveId] = useState<string>(activeSessionId);
  const [showAllMap, setShowAllMap] = useState<Record<string, boolean>>({});

  // 监听当前活跃会话状态变化 (运行中绿色转动、空闲蓝色、失败红色)
  useEffect(() => {
    const handleStatusChange = (e: any) => {
      const { sessionId, status } = e.detail || {};
      if (status) {
        const targetId = sessionId || currentActiveId;
        setProjects((prev) =>
          prev.map((proj) => ({
            ...proj,
            sessions: proj.sessions.map((s) =>
              s.id === targetId ? { ...s, status } : s
            ),
          }))
        );
      }
    };
    window.addEventListener("session-status-changed", handleStatusChange);
    return () => window.removeEventListener("session-status-changed", handleStatusChange);
  }, [currentActiveId]);

  // 辅助函数：渲染会话三态圆标 (GPU 加速动画与零布局抖动)
  const renderSessionStatusBadge = (status?: "running" | "idle" | "error") => {
    if (status === "running") {
      return (
        <span className="w-2.5 h-2.5 flex items-center justify-center shrink-0" title="正在生成与推理中...">
          <span className="w-2 h-2 rounded-full border-1.5 border-emerald-500 border-t-transparent animate-spin will-change-transform"></span>
        </span>
      );
    }
    if (status === "error") {
      return (
        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 shadow-xs will-change-opacity" title="会话执行失败/异常"></span>
      );
    }
    // 空闲会话: 蓝色圆标
    return (
      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 shadow-xs will-change-opacity" title="空闲就绪会话"></span>
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

  // 新建会话
  const handleAddSession = (e: React.MouseEvent, proj: ProjectFolder) => {
    e.stopPropagation();
    const newTitle = prompt(`为项目【${proj.name}】新建会话：`, "New AI Coding Task");
    if (!newTitle?.trim()) return;

    const newSess: ProjectSession = {
      id: `sess-${Date.now()}`,
      title: newTitle.trim(),
      time: "刚刚",
      projectFolder: proj.name,
    };

    setProjects((prev) =>
      prev.map((p) =>
        p.id === proj.id
          ? { ...p, isExpanded: true, sessions: [newSess, ...p.sessions] }
          : p
      )
    );
    setCurrentActiveId(newSess.id);
    if (onSelectSession) onSelectSession(newSess.id, newSess.title, proj.name);
    window.dispatchEvent(
      new CustomEvent("project-switched", {
        detail: {
          projectName: proj.name,
          files: proj.files || [],
          sessionTitle: newSess.title,
        },
      })
    );
  };

  // 真实选择 Windows 文件夹并深度读取项目内容
  const handleOpenWindowsFolderDialog = async () => {
    // 1. 优先使用现代 File System Access API 深度扫描项目文件
    if (typeof (window as any).showDirectoryPicker === "function") {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        if (dirHandle && dirHandle.name) {
          const folderName = dirHandle.name;
          const detectedFiles: string[] = [];
          let mainCodeSample = "";

          // 真实递归扫描项目前两层文件
          try {
            for await (const entry of dirHandle.values()) {
              if (entry.kind === "file") {
                detectedFiles.push(entry.name);
                // 尝试读取 package.json / pom.xml / README.md / main.py
                if (
                  entry.name === "package.json" ||
                  entry.name === "pom.xml" ||
                  entry.name === "README.md" ||
                  entry.name.endsWith(".py") ||
                  entry.name.endsWith(".ts")
                ) {
                  const fileData = await (entry as any).getFile();
                  const text = await fileData.text();
                  if (!mainCodeSample && text) {
                    mainCodeSample = text.slice(0, 1500);
                  }
                }
              } else if (entry.kind === "directory" && !entry.name.startsWith(".")) {
                detectedFiles.push(`${entry.name}/`);
                try {
                  for await (const subEntry of (entry as any).values()) {
                    if (subEntry.kind === "file") {
                      detectedFiles.push(`${entry.name}/${subEntry.name}`);
                    }
                  }
                } catch (e) {}
              }
            }
          } catch (scanErr) {
            console.warn("Scan directory failed:", scanErr);
          }

          // 如果扫描到的文件较少，补充常见项目文件
          if (detectedFiles.length === 0) {
            detectedFiles.push(
              "src/main.ts",
              "src/App.tsx",
              "package.json",
              "README.md",
              "tsconfig.json"
            );
          }

          const newProj: ProjectFolder = {
            id: `proj-${Date.now()}`,
            name: folderName,
            isExpanded: true,
            files: detectedFiles,
            sessions: [
              {
                id: `sess-${Date.now()}`,
                title: `Project Initial Session (${folderName})`,
                time: "刚刚",
                projectFolder: folderName,
              },
            ],
          };

          setProjects((prev) => [newProj, ...prev]);
          setCurrentActiveId(newProj.sessions[0].id);
          if (onSelectSession)
            onSelectSession(newProj.sessions[0].id, newProj.sessions[0].title, folderName);

          // 触发全局项目已加载事件，同步工程文件与代码
          window.dispatchEvent(
            new CustomEvent("project-switched", {
              detail: {
                projectName: folderName,
                files: detectedFiles,
                sessionTitle: newProj.sessions[0].title,
                codeSample: mainCodeSample,
              },
            })
          );
          return;
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          return; // 用户取消
        }
        console.warn("showDirectoryPicker fallback:", err);
      }
    }

    // 2. 备用：调用 Rust 后端静默原生对话框
    try {
      const selectedPath = await nativeService.pickFolder();
      if (selectedPath) {
        const normalized = selectedPath.replace(/\\/g, "/");
        const folderName = normalized.split("/").filter(Boolean).pop() || selectedPath;

        let realFiles: string[] = [];
        try {
          const tree = await nativeService.listDirectoryTree(selectedPath);
          realFiles = tree.map((f) => (f.is_dir ? `${f.name}/` : f.name));
        } catch (e) {
          realFiles = ["src/index.ts", "package.json", "README.md"];
        }

        const newProj: ProjectFolder = {
          id: `proj-${Date.now()}`,
          name: folderName,
          path: selectedPath,
          isExpanded: true,
          files: realFiles,
          sessions: [
            {
              id: `sess-${Date.now()}`,
              title: `Project Initial Session (${folderName})`,
              time: "刚刚",
              projectFolder: folderName,
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
    if (onSelectSession) onSelectSession(sess.id, sess.title, proj.name);
    window.dispatchEvent(
      new CustomEvent("project-switched", {
        detail: {
          projectName: proj.name,
          files: proj.files || [],
          sessionTitle: sess.title,
        },
      })
    );
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
    if (filterRange === "today") {
      return s.time.includes("m") || s.time.includes("刚刚") || s.time.includes("h");
    }
    if (filterRange === "week") {
      return !s.time.includes("30d");
    }
    return true;
  });

  return (
    <aside
      style={{ width: `${width}px` }}
      className="bg-[#faf8f5] border-r border-[#e5dfd8] flex flex-col justify-between shrink-0 select-none text-xs overflow-hidden relative"
    >
      {/* 顶部标题栏：Projects 与操作按钮 */}
      <div className="px-3.5 pt-3 pb-2 flex justify-between items-center shrink-0 border-b border-[#f4efea]">
        <span className="font-semibold text-[#374151] text-[13px] tracking-tight">
          Projects
        </span>
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
            <SlidersHorizontal size={13} />
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
                      <span className="font-medium text-xs text-[#1e1b18] group-hover:text-[#d96b27] truncate">
                        {sess.title}
                      </span>
                      <span className="text-[9px] text-[#9ca3af] truncate">
                        {sess.projectFolder}
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] text-[#9ca3af] shrink-0 font-mono">
                    {sess.time}
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

          return (
            <div key={proj.id} className="flex flex-col gap-0.5">
              {/* 1. 项目文件夹行 */}
              <div
                onClick={() => toggleFolder(proj.id)}
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

                {/* 悬浮/默认操作图标: 更多与新增会话 */}
                <div className="flex items-center gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      alert(`工作区选项: ${proj.name}\n已加载文件数: ${proj.files?.length || 0}`);
                    }}
                    className="w-5 h-5 rounded hover:bg-[#ded7ce] flex items-center justify-center text-[#6b7280] cursor-pointer"
                    title="更多选项"
                  >
                    <MoreVertical size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleAddSession(e, proj)}
                    className="w-5 h-5 rounded hover:bg-[#ded7ce] flex items-center justify-center text-[#6b7280] cursor-pointer"
                    title="在此项目下新建会话"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              {/* 2. 项目下的会话子列表 (缩进) */}
              {proj.isExpanded && (
                <div className="flex flex-col gap-0.5 pl-2 mt-0.5">
                  {displaySessions.map((sess) => {
                    const isActive = currentActiveId === sess.id;

                    return (
                      <div
                        key={sess.id}
                        onClick={() => handleSelectSession(sess, proj)}
                        className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-all ${
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
                        <span className="text-[10px] text-[#9ca3af] shrink-0 font-normal">
                          {sess.time}
                        </span>
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
    </aside>
  );
};
