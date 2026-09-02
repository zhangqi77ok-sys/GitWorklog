import React, { useState, useEffect } from 'react';
import { Code2, X } from 'lucide-react';
import { Titlebar } from './components/layout/Titlebar';
import { ActivityBar, ActiveTab } from './components/layout/ActivityBar';
import { LeftPanel } from './components/layout/LeftPanel';
import { ChatPanel } from './components/chat/ChatPanel';
import { MonacoEditorWorkspace } from './components/editor/MonacoEditorWorkspace';
import { TerminalDrawer } from './components/terminal/TerminalDrawer';
import { SettingsModal, SettingsTab } from './components/settings/SettingsModal';
import { ToastContainer } from './components/common/Toast';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useProjectSessionStore } from './store/useProjectSessionStore';
import { useWorkspaceStore } from './store/useWorkspaceStore';
import { useGatewayStore } from './store/useGatewayStore';
import './styles/theme.css';

export function App() {
  const [theme, setTheme] = useState<'cream' | 'dark'>(() => {
    try {
      if (typeof window !== 'undefined') {
        return (localStorage.getItem('tcode_theme') as 'cream' | 'dark') || 'cream';
      }
    } catch (e) {}
    return 'cream';
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    try {
      if (typeof window !== 'undefined') {
        return (localStorage.getItem('tcode_active_tab') as ActiveTab) || 'chat';
      }
    } catch (e) {}
    return 'chat';
  });

  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('tcode_editor_open');
        return saved !== null ? saved === 'true' : false;
      }
    } catch (e) {}
    return false;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>('gateway');

  const [isTerminalOpen, setIsTerminalOpen] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('tcode_terminal_open');
        return saved !== null ? saved === 'true' : true;
      }
    } catch (e) {}
    return true;
  });

  const { loadInitialData, activeProjectId, projects } = useProjectSessionStore();
  const { loadTree, activeTabPath } = useWorkspaceStore();
  const { loadChannels } = useGatewayStore();

  // Load store data on mount
  useEffect(() => {
    loadInitialData();
    loadChannels();
  }, [loadInitialData, loadChannels]);

  // When active project changes, load its file tree
  useEffect(() => {
    const safeProjects = Array.isArray(projects) ? projects : [];
    const proj = safeProjects.find((p) => p.id === activeProjectId);
    if (proj && proj.path) {
      loadTree(proj.path);
    }
  }, [activeProjectId, projects, loadTree]);

  // When user opens a file in the tree or accepts a diff, automatically pop out the right editor workspace
  useEffect(() => {
    if (activeTabPath) {
      setIsEditorOpen(true);
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('tcode_editor_open', 'true');
        }
      } catch (e) {}
    }
  }, [activeTabPath]);

  const toggleTheme = () => {
    const next = theme === 'cream' ? 'dark' : 'cream';
    setTheme(next);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('tcode_theme', next);
      }
    } catch (e) {}
    document.documentElement.setAttribute('data-theme', next);
  };

  const toggleEditor = () => {
    setIsEditorOpen((prev) => {
      const next = !prev;
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('tcode_editor_open', String(next));
        }
      } catch (e) {}
      return next;
    });
  };

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('tcode_active_tab', tab);
      }
    } catch (e) {}

    if (tab === 'chat') {
      // Keep conversation in view
    } else if (tab === 'files') {
      toggleEditor();
    } else if (tab === 'plugins') {
      setSettingsInitialTab('skills');
      setIsSettingsOpen(true);
    } else if (tab === 'settings') {
      setSettingsInitialTab('gateway');
      setIsSettingsOpen(true);
    } else if (tab === 'terminal') {
      setIsTerminalOpen((prev) => {
        const next = !prev;
        try {
          if (typeof window !== 'undefined') localStorage.setItem('tcode_terminal_open', String(next));
        } catch (e) {}
        return next;
      });
    }
  };

  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('tcode_left_panel_width');
        return saved ? parseInt(saved, 10) : 300;
      }
    } catch (e) {}
    return 300;
  });
  const [isDraggingLeftResizer, setIsDraggingLeftResizer] = useState(false);

  const [editorPanelWidth, setEditorPanelWidth] = useState<number>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('tcode_editor_panel_width');
        return saved ? parseInt(saved, 10) : 560;
      }
    } catch (e) {}
    return 560;
  });
  const [isDraggingEditorResizer, setIsDraggingEditorResizer] = useState(false);
  const workbenchRef = React.useRef<HTMLDivElement>(null);

  const handleLeftResizerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingLeftResizer(true);
  };

  const handleEditorResizerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingEditorResizer(true);
  };

  useEffect(() => {
    if (!isDraggingLeftResizer && !isDraggingEditorResizer) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!workbenchRef.current) return;
      const rect = workbenchRef.current.getBoundingClientRect();

      if (isDraggingLeftResizer) {
        const activityBarWidth = 48;
        const newWidth = Math.max(200, Math.min(520, e.clientX - rect.left - activityBarWidth));
        setLeftPanelWidth(newWidth);
      }

      if (isDraggingEditorResizer) {
        const newWidth = Math.max(340, Math.min(rect.width * 0.7, rect.right - e.clientX));
        setEditorPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isDraggingLeftResizer) {
        setIsDraggingLeftResizer(false);
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('tcode_left_panel_width', String(leftPanelWidth));
          }
        } catch (e) {}
      }
      if (isDraggingEditorResizer) {
        setIsDraggingEditorResizer(false);
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('tcode_editor_panel_width', String(editorPanelWidth));
          }
        } catch (e) {}
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingLeftResizer, isDraggingEditorResizer, leftPanelWidth, editorPanelWidth]);

  return (
    <ErrorBoundary fallbackTitle="Tcode 工作台遇到异常，已自动保护会话状态">
      <div className="flex flex-col h-screen w-screen bg-[#FAF8F5] overflow-hidden">
        {/* 1. Global Titlebar (Clean, no buttons on the right except native window controls) */}
        <Titlebar />

        {/* 2. Main Workbench Layout (ActivityBar + Column 1 + Resizer 1 + Column 2 + Resizer 2 + Column 3) */}
        <div ref={workbenchRef} className="flex flex-1 overflow-hidden relative select-none">
          <ActivityBar activeTab={activeTab} onSelectTab={handleSelectTab} />

          {/* Column 1: Multi-Project & Session Tree + Files Explorer */}
          <div style={{ width: `${leftPanelWidth}px` }} className="h-full flex-shrink-0 flex flex-col overflow-hidden">
            <LeftPanel />
          </div>

          {/* Resizer Bar 1: Between LeftPanel and ChatPanel */}
          <div
            onMouseDown={handleLeftResizerMouseDown}
            title="左右拖动调节左侧导航栏宽度"
            className={`w-1.5 h-full cursor-col-resize flex-shrink-0 flex items-center justify-center transition-colors z-20 ${
              isDraggingLeftResizer ? 'bg-[#D96B27]' : 'bg-[#E6DFD5] hover:bg-[#D96B27]/50'
            }`}
          >
            <div className="h-8 w-0.5 bg-[#8A847C]/40 rounded-full" />
          </div>

          {/* Column 2: Middle Conversation Panel (ALWAYS VISIBLE & CENTRAL) */}
          <div className="flex-1 min-w-[380px] h-full flex flex-col overflow-hidden bg-[#FAF8F5]">
            <ChatPanel
              onOpenSettings={() => {
                setSettingsInitialTab('gateway');
                setIsSettingsOpen(true);
              }}
              isEditorOpen={isEditorOpen}
              onToggleEditor={toggleEditor}
            />
          </div>

          {/* Resizer Bar 2: Between ChatPanel and EditorPanel */}
          {isEditorOpen && (
            <div
              onMouseDown={handleEditorResizerMouseDown}
              title="左右拖动调节右侧代码工作区宽度"
              className={`w-1.5 h-full cursor-col-resize flex-shrink-0 flex items-center justify-center transition-colors z-20 ${
                isDraggingEditorResizer ? 'bg-[#D96B27]' : 'bg-[#E6DFD5] hover:bg-[#D96B27]/50'
              }`}
            >
              <div className="h-8 w-0.5 bg-[#8A847C]/40 rounded-full" />
            </div>
          )}

          {/* Column 3: Popout Right Code Workspace & Diff Review (Side-by-Side, Non-Intrusive) */}
          {isEditorOpen && (
            <div
              style={{ width: `${editorPanelWidth}px` }}
              className="h-full flex-shrink-0 flex flex-col border-l border-[#E6DFD5] bg-white animate-in slide-in-from-right-4 duration-150 shadow-sm z-10 overflow-hidden"
            >
              {/* Right Editor Header */}
              <div className="h-10 px-3 bg-[#F4EFEA] border-b border-[#E6DFD5] flex items-center justify-between select-none">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-[#D96B27]" />
                  <span className="font-semibold text-xs text-[#1E1C1A]">代码工作区 (Editor & Diff)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#8A847C] font-mono">Monaco 语法与补丁审查</span>
                  <button
                    onClick={toggleEditor}
                    title="收起代码工作区 (Alt+E)"
                    className="p-1 hover:bg-white rounded-md text-[#8A847C] hover:text-[#1E1C1A] transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Right Editor Body */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-hidden">
                  <MonacoEditorWorkspace />
                </div>
                {/* Bottom Drawer: Integrated PowerShell Terminal */}
                <TerminalDrawer
                  isOpen={isTerminalOpen}
                  onToggle={() => {
                    setIsTerminalOpen((prev) => {
                      const next = !prev;
                      try {
                        if (typeof window !== 'undefined') localStorage.setItem('tcode_terminal_open', String(next));
                      } catch (e) {}
                      return next;
                    });
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Unified Settings & Tools Cockpit Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          theme={theme}
          onToggleTheme={toggleTheme}
          initialTab={settingsInitialTab}
        />

        {/* Global Toast Notification System */}
        <ToastContainer />
      </div>
    </ErrorBoundary>
  );
}

export default App;
