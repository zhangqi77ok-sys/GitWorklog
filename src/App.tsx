import React, { useState, useEffect } from 'react';
import { Titlebar } from './components/layout/Titlebar';
import { ActivityBar, ActiveTab } from './components/layout/ActivityBar';
import { LeftPanel } from './components/layout/LeftPanel';
import { ChatPanel } from './components/chat/ChatPanel';
import { MonacoEditorWorkspace } from './components/editor/MonacoEditorWorkspace';
import { TerminalDrawer } from './components/terminal/TerminalDrawer';
import { PluginManagerModal } from './components/plugins/PluginManagerModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { useProjectSessionStore } from './store/useProjectSessionStore';
import { useWorkspaceStore } from './store/useWorkspaceStore';
import { useGatewayStore } from './store/useGatewayStore';
import { useTauriAgent } from './hooks/useTauriAgent';
import './styles/theme.css';

export function App() {
  const [theme, setTheme] = useState<'cream' | 'dark'>('cream');
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPluginsOpen, setIsPluginsOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);

  const { loadInitialData, activeProjectId, projects } = useProjectSessionStore();
  const { loadTree, openFile, currentRoot, openTabs } = useWorkspaceStore();
  const { loadChannels } = useGatewayStore();
  const { plugins, tools } = useTauriAgent();

  // Load store data on mount
  useEffect(() => {
    loadInitialData();
    loadChannels();
  }, [loadInitialData, loadChannels]);

  // When active project changes, load its file tree
  useEffect(() => {
    const proj = projects.find((p) => p.id === activeProjectId);
    if (proj && proj.path) {
      loadTree(proj.path);
    }
  }, [activeProjectId, projects, loadTree]);

  // When file tree is loaded and no tab is open, open a default text file if available
  useEffect(() => {
    if (openTabs.length === 0 && currentRoot && currentRoot.children && currentRoot.children.length > 0) {
      const readme = currentRoot.children.find((c) => c.name.toLowerCase() === 'readme.md');
      const pkg = currentRoot.children.find((c) => c.name.toLowerCase() === 'package.json');
      const target =
        readme ||
        pkg ||
        currentRoot.children.find((c) => !c.is_dir && !c.name.endsWith('.exe') && !c.name.endsWith('.dll'));
      if (target) {
        openFile(target.path);
      }
    }
  }, [currentRoot, openFile, openTabs.length]);

  const toggleTheme = () => {
    const next = theme === 'cream' ? 'dark' : 'cream';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'settings') {
      setIsSettingsOpen(true);
    } else if (tab === 'plugins') {
      setIsPluginsOpen(true);
    } else if (tab === 'terminal') {
      setIsTerminalOpen((prev) => !prev);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#FAF8F5] overflow-hidden">
      {/* 1. Global Titlebar */}
      <Titlebar
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPlugins={() => setIsPluginsOpen(true)}
        pluginCount={plugins.length || 5}
      />

      {/* 2. Main Workbench 3-Column Layout */}
      <div className="flex flex-1 overflow-hidden">
        <ActivityBar activeTab={activeTab} onSelectTab={handleSelectTab} />

        {/* Column 1: Multi-Project & Session Tree + Files Explorer */}
        <LeftPanel />

        {/* Column 2: Agent Chat & Streaming Panel */}
        <div className="flex-1 min-w-[360px] h-full border-r border-[#E6DFD5]">
          <ChatPanel />
        </div>

        {/* Column 3: Monaco Code & Diff Editor Workspace */}
        <div className="flex-1 min-w-[420px] h-full flex flex-col">
          <div className="flex-1 overflow-hidden">
            <MonacoEditorWorkspace />
          </div>

          {/* Bottom Drawer: Integrated PowerShell Terminal */}
          <TerminalDrawer
            isOpen={isTerminalOpen}
            onToggle={() => setIsTerminalOpen(!isTerminalOpen)}
          />
        </div>
      </div>

      {/* Modals */}
      <PluginManagerModal
        isOpen={isPluginsOpen}
        onClose={() => setIsPluginsOpen(false)}
        plugins={plugins}
        tools={tools}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

export default App;
