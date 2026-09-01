import React, { useState, useEffect } from 'react';
import { MessageSquare, Code2 } from 'lucide-react';
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

  const [primaryView, setPrimaryView] = useState<'chat' | 'editor'>(() => {
    try {
      if (typeof window !== 'undefined') {
        return (localStorage.getItem('tcode_primary_view') as 'chat' | 'editor') || 'chat';
      }
    } catch (e) {}
    return 'chat';
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

  // When active tab path changes (user opens a file), automatically switch to editor view
  useEffect(() => {
    if (activeTabPath) {
      setPrimaryView('editor');
      setActiveTab('files');
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('tcode_primary_view', 'editor');
          localStorage.setItem('tcode_active_tab', 'files');
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

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('tcode_active_tab', tab);
      }
    } catch (e) {}

    if (tab === 'chat') {
      setPrimaryView('chat');
      try {
        if (typeof window !== 'undefined') localStorage.setItem('tcode_primary_view', 'chat');
      } catch (e) {}
    } else if (tab === 'files') {
      setPrimaryView('editor');
      try {
        if (typeof window !== 'undefined') localStorage.setItem('tcode_primary_view', 'editor');
      } catch (e) {}
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

  return (
    <ErrorBoundary fallbackTitle="Tcode 工作台遇到异常，已自动保护会话状态">
      <div className="flex flex-col h-screen w-screen bg-[#FAF8F5] overflow-hidden">
        {/* 1. Global Titlebar (Clean, no buttons on the right except native window controls) */}
        <Titlebar />

        {/* 2. Main Workbench Layout (Left Panel + Single Primary Focus View) */}
        <div className="flex flex-1 overflow-hidden">
          <ActivityBar activeTab={activeTab} onSelectTab={handleSelectTab} />

          {/* Column 1: Multi-Project & Session Tree + Files Explorer */}
          <LeftPanel />

          {/* Column 2: Single-Focus Primary Workspace (Chat OR Editor) */}
          <div className="flex-1 min-w-[500px] h-full flex flex-col overflow-hidden bg-[#FAF8F5]">
            {/* Top Switcher Bar: 智能对话 vs 代码工作区 */}
            <div className="h-9 px-3 bg-[#F4EFEA] border-b border-[#E6DFD5] flex items-center justify-between select-none">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setPrimaryView('chat');
                    setActiveTab('chat');
                    try {
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('tcode_primary_view', 'chat');
                        localStorage.setItem('tcode_active_tab', 'chat');
                      }
                    } catch (e) {}
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    primaryView === 'chat'
                      ? 'bg-white text-[#D96B27] shadow-xs border border-[#E6DFD5]'
                      : 'text-[#6B665F] hover:text-[#1E1C1A] hover:bg-white/50'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>智能对话 (Chat)</span>
                </button>

                <button
                  onClick={() => {
                    setPrimaryView('editor');
                    setActiveTab('files');
                    try {
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('tcode_primary_view', 'editor');
                        localStorage.setItem('tcode_active_tab', 'files');
                      }
                    } catch (e) {}
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    primaryView === 'editor'
                      ? 'bg-white text-[#D96B27] shadow-xs border border-[#E6DFD5]'
                      : 'text-[#6B665F] hover:text-[#1E1C1A] hover:bg-white/50'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>代码工作区 (Editor)</span>
                </button>
              </div>

              <div className="text-[11px] text-[#8A847C] font-mono">
                {primaryView === 'chat' ? '双环安全沙箱就绪' : 'Monaco 代码与 Diff 审查'}
              </div>
            </div>

            {/* Primary View Body */}
            <div className="flex-1 overflow-hidden relative">
              {primaryView === 'chat' ? (
                <div className="h-full w-full">
                  <ChatPanel onOpenSettings={() => {
                    setSettingsInitialTab('gateway');
                    setIsSettingsOpen(true);
                  }} />
                </div>
              ) : (
                <div className="h-full w-full flex flex-col">
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
              )}
            </div>
          </div>
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
