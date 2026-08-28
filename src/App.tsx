import React, { useState, useEffect, useRef } from "react";
import { Titlebar } from "./components/layout/Titlebar";
import { ActivityBar } from "./components/layout/ActivityBar";
import { LeftPanel } from "./components/layout/LeftPanel";
import { ChatColumn } from "./components/layout/ChatColumn";
import { EditorWorkspace } from "./components/layout/EditorWorkspace";
import { SettingsModal } from "./components/settings/SettingsModal";
import { ErrorBoundary } from "./components/common/ErrorBoundary";

export function App() {
  const [activeView, setActiveView] = useState("chat");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 会话与项目状态管理
  const [activeSessionId, setActiveSessionId] = useState("sess-1");
  const [activeSessionTitle, setActiveSessionTitle] = useState("AI 编程协同初始会话");
  const [currentProjectName, setCurrentProjectName] = useState("agent-learning");

  const handleSelectSession = (sessionId: string, sessionTitle: string, projectName?: string) => {
    setActiveSessionId(sessionId);
    setActiveSessionTitle(sessionTitle);
    if (projectName) setCurrentProjectName(projectName);
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

  // 监听打开文件事件，自动展开右侧面板
  useEffect(() => {
    const handleOpenFile = () => {
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
        {/* 1. 顶部标题栏 */}
        <Titlebar onOpenSettings={() => setIsSettingsOpen(true)} />

        {/* 2. 主工作区：Activity Bar + Left Panel + Resize1 + Chat Column + (Optional: Resize2 + Editor Workspace) */}
        <div className="flex-1 flex overflow-hidden relative">
          <ActivityBar
            activeView={activeView}
            onSelectView={setActiveView}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />

          {/* 左侧工作区导航 (支持宽度伸缩) */}
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

          {/* AI 对话栏 (右侧未打开时自适应填满，右侧打开时支持宽度伸缩) */}
          <ChatColumn
            width={isRightPanelOpen ? chatWidth : undefined}
            activeSessionId={activeSessionId}
            sessionTitle={activeSessionTitle}
            projectName={currentProjectName}
            onOpenSettings={() => setIsSettingsOpen(true)}
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
              />
            </>
          )}
        </div>

        {/* 3. Settings 全局设置中枢 (含 Cockpit Tools / SKILL / MCP) */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </div>
    </ErrorBoundary>
  );
}

export default App;
