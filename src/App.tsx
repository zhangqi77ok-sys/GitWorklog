import React, { useState } from 'react';
import { Titlebar } from './components/layout/Titlebar';
import { ActivityBar, ActiveTab } from './components/layout/ActivityBar';
import { ChatPanel } from './components/chat/ChatPanel';
import { EditorWorkspace } from './components/editor/EditorWorkspace';
import { PluginManagerModal } from './components/plugins/PluginManagerModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { useTauriAgent } from './hooks/useTauriAgent';
import { Folder, File, Cpu } from 'lucide-react';
import './styles/theme.css';

export function App() {
  const [theme, setTheme] = useState<'cream' | 'dark'>('cream');
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPluginsOpen, setIsPluginsOpen] = useState(false);

  const {
    messages,
    plugins,
    tools,
    subtasks,
    isStreaming,
    currentThinking,
    sendPrompt,
    testGateway,
  } = useTauriAgent();

  const toggleTheme = () => {
    const next = theme === 'cream' ? 'dark' : 'cream';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        background: 'var(--bg-base)',
      }}
    >
      <Titlebar
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPlugins={() => setIsPluginsOpen(true)}
        pluginCount={plugins.length}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <ActivityBar activeTab={activeTab} onSelectTab={setActiveTab} />

        {/* Column 1: Left Navigation / Explorer */}
        <div
          style={{
            width: '240px',
            background: 'var(--bg-surface)',
            borderRight: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--text-secondary)',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            工作区目录 (Workspace)
          </div>
          <div style={{ padding: '8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', borderRadius: '4px', fontSize: '12px', color: 'var(--text-primary)' }}>
              <Folder size={14} color="var(--accent)" />
              <span>src-tauri/ (Rust Core)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', borderRadius: '4px', fontSize: '12px', color: 'var(--text-primary)' }}>
              <Folder size={14} color="var(--accent)" />
              <span>src/ (React 19 UI)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', borderRadius: '4px', fontSize: '12px', color: 'var(--text-primary)', paddingLeft: '24px' }}>
              <File size={13} color="var(--text-muted)" />
              <span>App.tsx</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', borderRadius: '4px', fontSize: '12px', color: 'var(--text-primary)', paddingLeft: '24px' }}>
              <File size={13} color="var(--text-muted)" />
              <span>theme.css</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', borderRadius: '4px', fontSize: '12px', color: 'var(--text-primary)' }}>
              <Folder size={14} color="var(--accent)" />
              <span>docs/ (PRD & Specs)</span>
            </div>
          </div>
        </div>

        {/* Column 2: Center Streaming Chat */}
        <div style={{ flex: 1, minWidth: '380px', height: '100%' }}>
          <ChatPanel
            messages={messages}
            subtasks={subtasks}
            currentThinking={currentThinking}
            isStreaming={isStreaming}
            onSendMessage={sendPrompt}
          />
        </div>

        {/* Column 3: Right Editor & Inspector */}
        <div style={{ width: '450px', height: '100%', flexShrink: 0 }}>
          <EditorWorkspace activeFile="src/App.tsx" />
        </div>
      </div>

      <PluginManagerModal
        isOpen={isPluginsOpen}
        onClose={() => setIsPluginsOpen(false)}
        plugins={plugins}
        tools={tools}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onTestConnection={testGateway}
      />
    </div>
  );
}

export default App;
