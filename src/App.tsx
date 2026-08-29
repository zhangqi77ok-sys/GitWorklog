import React, { useState, useEffect, useRef } from "react";
import { Titlebar, SessionTabItem } from "./components/layout/Titlebar";
import { LeftPanel } from "./components/layout/LeftPanel";
import { ChatColumn } from "./components/layout/ChatColumn";
import { EditorWorkspace } from "./components/layout/EditorWorkspace";
import { nativeService } from "./services/nativeService";
import { FileChangeRecord, TaskPlan } from "./types/contracts";
import { TaskPopup } from "./components/chat/TaskPopup";
import { SettingsModal } from "./components/settings/SettingsModal";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { CustomContextMenu } from "./components/common/CustomContextMenu";

export function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);

  // 会话与项目状态管理
  const [activeSessionId, setActiveSessionId] = useState("sess-1");
  const [activeSessionTitle, setActiveSessionTitle] = useState("审查一下 继续，还包括oauth的实现");
  const [currentProjectName, setCurrentProjectName] = useState("agent-learning");

  // 横向会话多标签页管理 (对齐截图中的 Session Tabs)
  const [tabs, setTabs] = useState<SessionTabItem[]>([
    { id: "sess-1", title: "审查一下 继续，还包括oauth的实现", projectName: "agent-learning" },
  ]);

  const handleSelectSession = (sessionId: string, sessionTitle: string, projectName?: string) => {
    setActiveSessionId(sessionId);
    setActiveSessionTitle(sessionTitle);
    if (projectName) setCurrentProjectName(projectName);
    // 自动追加/激活标签页
    setTabs((prev) => {
      const exists = prev.find((t) => t.id === sessionId);
      if (exists) return prev;
      return [...prev, { id: sessionId, title: sessionTitle, projectName: projectName || "agent-learning" }];
    });
  };

  const handleSelectTab = (tabId: string) => {
    const target = tabs.find((t) => t.id === tabId);
    if (target) {
      setActiveSessionId(target.id);
      setActiveSessionTitle(target.title);
      if (target.projectName) setCurrentProjectName(target.projectName);
    }
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) return;
    const newTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(newTabs);
    if (activeSessionId === tabId) {
      const nextTab = newTabs[newTabs.length - 1];
      setActiveSessionId(nextTab.id);
      setActiveSessionTitle(nextTab.title);
      if (nextTab.projectName) setCurrentProjectName(nextTab.projectName);
    }
  };

  const handleNewTab = () => {
    const newId = `sess-${Date.now()}`;
    const newTitle = "新会话";
    const newTab: SessionTabItem = { id: newId, title: newTitle, projectName: currentProjectName };
    setTabs((prev) => [...prev, newTab]);
    setActiveSessionId(newId);
    setActiveSessionTitle(newTitle);
  };

  // 智能体文件修改记录：状态提升到公共父级，供左侧卡片与右侧编辑器共享
  const [fileChanges, setFileChanges] = useState<FileChangeRecord[]>([]);

  // 计划任务（Plan 模式）：由智能体生成任务列表，左栏展示 + 右下角弹窗
  const [taskPlan, setTaskPlan] = useState<TaskPlan | null>(null);
  // 弹窗独立开关：关闭弹窗不清空任务（左栏任务列表保留），新计划到来时自动重新打开
  const [taskPopupOpen, setTaskPopupOpen] = useState(true);
  const updateTaskPlan: React.Dispatch<React.SetStateAction<TaskPlan | null>> = (updater) => {
    setTaskPopupOpen(true);
    setTaskPlan(updater);
  };

  // 右侧编辑器顶部撤回：写回修改前快照（新文件无法删除，写回空内容并保留提示）
  const handleRevertFileChange = async (id: string) => {
    const record = fileChanges.find((r) => r.id === id);
    if (!record || record.status !== "APPLIED") return;
    try {
      const ok = await nativeService.writeFile(record.absolutePath, record.originalContent);
      if (!ok) throw new Error("撤回写入返回失败");
      setFileChanges((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "REVERTED" } : r))
      );
    } catch (err: any) {
      setFileChanges((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: "FAILED", errorMessage: err?.message || String(err) }
            : r
        )
      );
    }
  };

  // 1. 伸缩区块尺寸状态 (默认值与范围限制)
  const [leftWidth, setLeftWidth] = useState(240);       // 左侧栏宽度 (180px ~ 480px)
  const [chatWidth, setChatWidth] = useState(440);       // AI 对话栏宽度 (320px ~ 750px)
  const [terminalHeight, setTerminalHeight] = useState(190); // 终端高度 (80px ~ 450px)

  // 2. 拖拽状态
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingChat, setIsDraggingChat] = useState(false);
  const [isDraggingTerminal, setIsDraggingTerminal] = useState(false);

  const dragRef = useRef({
    startX: 0,
    startY: 0,
    startLeftW: 240,
    startChatW: 440,
    startTermH: 190,
  });

  // 全局拖拽事件监听
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingLeft) {
        const deltaX = e.clientX - dragRef.current.startX;
        const newWidth = Math.min(Math.max(dragRef.current.startLeftW + deltaX, 180), 480);
        setLeftWidth(newWidth);
      } else if (isDraggingChat) {
        const deltaX = e.clientX - dragRef.current.startX;
        const newWidth = Math.min(Math.max(dragRef.current.startChatW + deltaX, 320), 750);
        setChatWidth(newWidth);
      } else if (isDraggingTerminal) {
        const deltaY = dragRef.current.startY - e.clientY; // 往上拉高度变大
        const newHeight = Math.min(Math.max(dragRef.current.startTermH + deltaY, 80), 500);
        setTerminalHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingLeft(false);
      setIsDraggingChat(false);
      setIsDraggingTerminal(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    if (isDraggingLeft || isDraggingChat || isDraggingTerminal) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "none";
      if (isDraggingLeft || isDraggingChat) {
        document.body.style.cursor = "col-resize";
      } else if (isDraggingTerminal) {
        document.body.style.cursor = "row-resize";
      }
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingLeft, isDraggingChat, isDraggingTerminal]);

  const handleStartDragLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      ...dragRef.current,
      startX: e.clientX,
      startLeftW: leftWidth,
    };
    setIsDraggingLeft(true);
  };

  const handleStartDragChat = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      ...dragRef.current,
      startX: e.clientX,
      startChatW: chatWidth,
    };
    setIsDraggingChat(true);
  };

  const handleStartDragTerminal = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      ...dragRef.current,
      startY: e.clientY,
      startTermH: terminalHeight,
    };
    setIsDraggingTerminal(true);
  };

  // 右侧代码工作区默认关闭 (isRightPanelOpen: false)，触发点击对话框内容或文件时才展开
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);

  // 最近一次待打开文件（右栏挂载前的事件会先缓存，挂载后再转发，避免丢失）
  const lastOpenFileRef = useRef<{ path?: string; name?: string; content?: string } | null>(null);

  // 监听打开文件事件，自动展开右侧面板
  useEffect(() => {
    const handleOpenFile = (e: any) => {
      lastOpenFileRef.current = e.detail || null;
      setIsRightPanelOpen(true);
    };
    const handleToggle = () => {
      setIsRightPanelOpen((prev) => !prev);
    };
    window.addEventListener("open-workspace-file", handleOpenFile);
    window.addEventListener("toggle-editor-workspace", handleToggle);
    return () => {
      window.removeEventListener("open-workspace-file", handleOpenFile);
      window.removeEventListener("toggle-editor-workspace", handleToggle);
    };
  }, []);

  // 右栏 EditorWorkspace 挂载后再转发一次打开文件事件，确保自动打开阅览不丢失
  useEffect(() => {
    if (isRightPanelOpen && lastOpenFileRef.current) {
      const detail = lastOpenFileRef.current;
      lastOpenFileRef.current = null;
      window.dispatchEvent(new CustomEvent("open-workspace-file", { detail }));
    }
  }, [isRightPanelOpen]);

  // 监听 Ctrl+, 快捷键打开设置中枢，Esc 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        setIsSettingsOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <ErrorBoundary fallbackTitle="CodeMind Studio 渲染异常保护">
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#faf8f5]">
        {/* 1. 顶部横向会话多标签页栏与窗口控制中枢 (完全对齐截图) */}
        <Titlebar
          tabs={tabs}
          activeTabId={activeSessionId}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
          onNewTab={handleNewTab}
          onToggleLeftPanel={() => setIsLeftPanelOpen((prev) => !prev)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isLeftPanelOpen={isLeftPanelOpen}
        />

        {/* 2. 主工作区：Left Panel + Resize1 + Chat Column + (Optional: Resize2 + Editor Workspace) */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* 左侧工作区导航 (对齐截图，支持一键折叠与拖拽调整宽度) */}
          {isLeftPanelOpen && (
            <>
              <LeftPanel
                width={leftWidth}
                activeSessionId={activeSessionId}
                onSelectSession={handleSelectSession}
              />

              {/* 分割条 1: 左侧栏与对话栏之间 (Col Resize) */}
              <div
                onMouseDown={handleStartDragLeft}
                className={`w-1.5 h-full cursor-col-resize relative z-20 shrink-0 transition-colors ${
                  isDraggingLeft
                    ? "bg-[#d96b27]"
                    : "bg-[#e5dfd8] hover:bg-[#d96b27]"
                }`}
                title="按住鼠标拖拽调整左侧栏宽度"
              >
                <div className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize" />
              </div>
            </>
          )}

          {/* AI 对话栏 (右侧未打开时自适应填满，右侧打开时支持宽度伸缩) */}
          <ChatColumn
            width={isRightPanelOpen ? chatWidth : undefined}
            activeSessionId={activeSessionId}
            sessionTitle={activeSessionTitle}
            projectName={currentProjectName}
            onOpenSettings={() => setIsSettingsOpen(true)}
            fileChanges={fileChanges}
            setFileChanges={setFileChanges}
            taskPlan={taskPlan}
            setTaskPlan={updateTaskPlan}
          />

          {/* 右侧代码工作区：仅在触发打开时渲染 */}
          {isRightPanelOpen && (
            <>
              {/* 分割条 2: 对话栏与代码工作区之间 (Col Resize) */}
              <div
                onMouseDown={handleStartDragChat}
                className={`w-1.5 h-full cursor-col-resize relative z-20 shrink-0 transition-colors ${
                  isDraggingChat
                    ? "bg-[#d96b27]"
                    : "bg-[#e5dfd8] hover:bg-[#d96b27]"
                }`}
                title="按住鼠标拖拽调整 AI 对话栏宽度"
              >
                <div className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize" />
              </div>

              {/* 右侧代码编辑器与沙箱终端 (支持终端高度上下伸缩与关闭面板) */}
              <EditorWorkspace
                terminalHeight={terminalHeight}
                onTerminalResizeMouseDown={handleStartDragTerminal}
                isTerminalDragging={isDraggingTerminal}
                onCloseWorkspace={() => setIsRightPanelOpen(false)}
                fileChanges={fileChanges}
                onRevertChange={handleRevertFileChange}
              />
            </>
          )}
        </div>

        {/* 3. Settings 全局设置中枢 (含 Cockpit Tools / SKILL / MCP) */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />

        {/* 4. 计划任务弹窗（右下角小窗，可关闭/展开；关闭仅隐藏弹窗，左栏任务保留） */}
        {taskPlan && taskPopupOpen && (
          <TaskPopup plan={taskPlan} onClose={() => setTaskPopupOpen(false)} />
        )}

        {/* 5. 原生桌面级右键菜单 (剪切/复制/粘贴/全选/删除) */}
        <CustomContextMenu />
      </div>
    </ErrorBoundary>
  );
}

export default App;
