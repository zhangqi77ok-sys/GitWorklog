import { SettingsModal } from './components/SettingsModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { TokenAnalyticsModal } from './components/TokenAnalyticsModal';
import React, { useState } from 'react';
import './styles/theme.css';
import { Titlebar } from './components/Titlebar';
import { ActivityBar } from './components/ActivityBar';
import { LeftPanel } from './components/LeftPanel';
import { ChatColumn } from './components/ChatColumn';
import { EditorWorkspace } from './components/EditorWorkspace';
import {
  SessionTier1Type,
  SessionItem,
  ChatMessage,
  TokenStats,
  WorkMode,
  PermissionPolicy,
  ProjectGroup,
  addTagToSession,
  removeTagFromSession,
  renameSession,
  addProjectToWorkspace,
  removeProjectFromWorkspace,
  AIModelOption,
  AVAILABLE_MODELS,
  forkSessionFromMessage,
  clampLeftPanelWidth,
  clampWorkbenchWidth,
  clampLeftPanelWithCollapse,
  DiffNavigationTarget
} from './types/contracts';

export const App: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTokenAnalyticsOpen, setIsTokenAnalyticsOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [paletteMode, setPaletteMode] = useState<'files' | 'commands'>('files');

  // Global Keyboard Navigation (Ctrl+P, Ctrl+Shift+P, Alt+1/2/3)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setIsLeftDrawerCollapsed(prev => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'p' && !e.shiftKey) {
        e.preventDefault();
        setPaletteMode('files');
        setIsPaletteOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'P' && e.shiftKey) {
        e.preventDefault();
        setPaletteMode('commands');
        setIsPaletteOpen(true);
      } else if (e.altKey && e.key === '1') {
        e.preventDefault();
        setActiveNav('sessions');
      } else if (e.altKey && e.key === '3') {
        e.preventDefault();
        setRightWorkspaceOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const [accentHex, setAccentHex] = useState('#D96B27');

  const handleSelectAccentHex = (hex: string) => {
    setAccentHex(hex);
    document.documentElement.style.setProperty('--accent', hex);
    document.documentElement.style.setProperty('--accent-subtle', `${hex}1F`);
  };

  const [activeNav, setActiveNav] = useState('sessions');
  const [currentSessionId, setCurrentSessionId] = useState('session-2');
  const [rightWorkspaceOpen, setRightWorkspaceOpen] = useState<boolean>(false);
  const [workMode, setWorkMode] = useState<WorkMode>('act');
  const [currentModel, setCurrentModel] = useState<AIModelOption>(AVAILABLE_MODELS[0]);
  const [permissionPolicy, setPermissionPolicy] = useState<PermissionPolicy>('autonomous_agent');

  // Resizable Layout & Collapse States
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(260);
  const [isLeftDrawerCollapsed, setIsLeftDrawerCollapsed] = useState<boolean>(false);
  const [workbenchWidth, setWorkbenchWidth] = useState<number>(560);
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const [activeDiffTarget, setActiveDiffTarget] = useState<DiffNavigationTarget | null>(null);

  // Global Drag Listeners
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingLeft) {
        const snapped = clampLeftPanelWithCollapse(e.clientX - 44);
        if (snapped === 0) {
          setIsLeftDrawerCollapsed(true);
          setLeftPanelWidth(260);
        } else {
          setIsLeftDrawerCollapsed(false);
          setLeftPanelWidth(snapped);
        }
      } else if (isDraggingRight) {
        const newWbWidth = window.innerWidth - e.clientX;
        setWorkbenchWidth(clampWorkbenchWidth(newWbWidth, window.innerWidth));
      }
    };

    const handleMouseUp = () => {
      setIsDraggingLeft(false);
      setIsDraggingRight(false);
    };

    if (isDraggingLeft || isDraggingRight) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingLeft, isDraggingRight]);

  // Multi-Project Groups
  const [projects, setProjects] = useState<ProjectGroup[]>([
    {
      id: 'proj-1',
      name: 'agent-learning',
      path: 'e:/pro/agent-learning',
      gitBranch: 'main',
      isExpanded: true
    },
    {
      id: 'proj-2',
      name: 'codemind-sdk',
      path: 'e:/pro/codemind-sdk',
      gitBranch: 'dev',
      isExpanded: false
    }
  ]);

  // Token Stats
  const [tokenStats, setTokenStats] = useState<TokenStats>({
    promptTokens: 2400,
    completionTokens: 600,
    cacheHitTokens: 18000,
    cacheWriteTokens: 0,
    estimatedCostUsd: 0.038,
    contextCurrentTokens: 21000,
    contextMaxTokens: 128000
  });

  // Hierarchical Sessions (Clean initial state)
  const [sessions, setSessions] = useState<SessionItem[]>([
    {
      id: 'session-1',
      tier1: 'global',
      title: '新的自由会话',
      tags: ['new'],
      messagesCount: 0,
      totalTokens: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ]);

  // Messages (Clean empty on initial launch)
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const activeSession = sessions.find(s => s.id === currentSessionId) || sessions[0];

  // Session Tree Operations
  const handleNewGlobalSession = () => {
    const newSession: SessionItem = {
      id: `session-${Date.now()}`,
      tier1: 'global',
      title: '新的全局自由会话',
      tags: ['docs'],
      messagesCount: 0,
      totalTokens: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const handleNewProjectSession = (projectId: string) => {
    const proj = projects.find(p => p.id === projectId);
    const newSession: SessionItem = {
      id: `session-${Date.now()}`,
      tier1: 'project',
      projectId: projectId,
      projectName: proj?.name || 'agent-learning',
      gitBranch: proj?.gitBranch || 'main',
      title: `新工程会话 (${proj?.name})`,
      tags: ['feat'],
      messagesCount: 0,
      totalTokens: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };


  const handleDeleteSession = (id: string) => {
    setSessions(prev => {
      const remaining = prev.filter(s => s.id !== id);
      if (currentSessionId === id && remaining.length > 0) {
        setCurrentSessionId(remaining[0].id);
      }
      return remaining;
    });
  };

  const handleRenameSession = (id: string, newTitle: string) => {
    setSessions(prev =>
      prev.map(s => (s.id === id ? renameSession(s, newTitle) : s))
    );
  };

  const handleAddTag = (sessionId: string, tag: string) => {
    setSessions(prev =>
      prev.map(s => (s.id === sessionId ? addTagToSession(s, tag) : s))
    );
  };

  const handleRemoveTag = (sessionId: string, tag: string) => {
    setSessions(prev =>
      prev.map(s => (s.id === sessionId ? removeTagFromSession(s, tag) : s))
    );
  };


  const handleOpenDirectory = (folderPath: string) => {
    const { projects: updatedProjects, newProject } = addProjectToWorkspace(projects, folderPath, 'main');
    setProjects(updatedProjects);
    // Create an initial session under this new project
    const newSession: SessionItem = {
      id: `session-${Date.now()}`,
      tier1: 'project',
      projectId: newProject.id,
      projectName: newProject.name,
      projectPath: newProject.path,
      gitBranch: newProject.gitBranch,
      title: `项目初始化对话 (${newProject.name})`,
      tags: ['init'],
      messagesCount: 1,
      totalTokens: 1200,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const handleRemoveProject = (projectId: string) => {
    setProjects(prev => removeProjectFromWorkspace(prev, projectId));
  };

  const handleSelectModel = (model: AIModelOption) => {
    setCurrentModel(model);
    // Update Token stats context window max
    setTokenStats(prev => ({
      ...prev,
      contextMaxTokens: model.contextLimit
    }));
    // Insert system notification message in chat
    const switchMsg: ChatMessage = {
      id: `sys-${Date.now()}`,
      role: 'assistant',
      content: `✨ 模型已无缝切换至: **${model.name}** (${model.badge || model.provider}) · 上下文上限自动调整为 ${Math.round(model.contextLimit / 1000)}k tokens · 网关子线已激活`,
      timestamp: Date.now(),
      auditTag: '⚡ 模型热切完成'
    };
    setMessages(prev => [...prev, switchMsg]);
  };


  const handleForkSessionFromMessage = (fromMessageId: string) => {
    const { updatedSessions, newSession, forkedMessages } = forkSessionFromMessage(
      sessions,
      messages,
      currentSessionId,
      fromMessageId
    );
    setSessions(updatedSessions);
    setCurrentSessionId(newSession.id);
    setMessages(forkedMessages);

    // Toast notification
    const toastMsg: ChatMessage = {
      id: `toast-${Date.now()}`,
      role: 'assistant',
      content: `✨ **已成功从该历史事件节点分叉出会话分支**: [${newSession.title}]。旧分支会话已完整归档保护，您可在此分支独立开展试错与重构。`,
      timestamp: Date.now(),
      auditTag: '⑂ Harness 会话时光机分叉'
    };
    setMessages(prev => [...prev, toastMsg]);
  };

  const handleOpenFile = (filePath: string, fileName: string, line?: number) => {
    // Open right workspace if closed
    if (!rightWorkspaceOpen) {
      setRightWorkspaceOpen(true);
    }
  };

  const handleSendMessage = (text: string) => {
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, newMsg]);

    setTimeout(() => {
      const replyMsg: ChatMessage = {
        id: `reply-${Date.now()}`,
        role: 'assistant',
        content: `已为您执行落地：${text}。代码已触发 AST 语法前检并打上 [CodeMind Checkpoint] 影子快照，测试全绿通过。`,
        timestamp: Date.now(),
        auditTag: '🤖 自动决策通过 · 已存快照'
      };
      setMessages(prev => [...prev, replyMsg]);
    }, 600);
  };

  const handleResolveOptions = (messageId: string, selectedIds: string[], customInput?: string) => {
    setMessages(prev =>
      prev.map(m => {
        if (m.id === messageId && m.optionsPayload) {
          return {
            ...m,
            optionsPayload: {
              ...m.optionsPayload,
              status: 'resolved',
              resolvedSelection: selectedIds,
              customInput
            }
          };
        }
        return m;
      })
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* 1. Titlebar */}
      <Titlebar
        currentProject={activeSession.projectName || 'agent-learning'}
        gitBranch={activeSession.gitBranch || 'main'}
        sessionTitle={activeSession.title}
        tokenStats={tokenStats}
        onOpenTokenAnalytics={() => setIsTokenAnalyticsOpen(true)}
      />

      {/* 2. Main Workspace Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ActivityBar (42px) */}
        <ActivityBar
          activeNav={activeNav}
          setActiveNav={setActiveNav}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* LeftPanel: Dynamic Modules with Dynamic Resizable Width & Ctrl+B Collapse */}
        {!isLeftDrawerCollapsed && (
          <LeftPanel
            width={leftPanelWidth}
            activeNav={activeNav}
            onOpenFile={handleOpenFile}
            projects={projects}
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSelectSession={setCurrentSessionId}
            onNewGlobalSession={handleNewGlobalSession}
            onNewProjectSession={handleNewProjectSession}
            onDeleteSession={handleDeleteSession}
            onRenameSession={handleRenameSession}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            onOpenDirectory={handleOpenDirectory}
            onRemoveProject={handleRemoveProject}
          />
        )}

        {/* Left Divider (Draggable, when not collapsed) */}
        {!isLeftDrawerCollapsed && (
          <div
            onMouseDown={() => setIsDraggingLeft(true)}
            onDoubleClick={() => setIsLeftDrawerCollapsed(true)}
            title="拖拽调节宽度，双击一键折叠 (Ctrl+B)"
            style={{
              width: '4px',
              cursor: 'col-resize',
              background: isDraggingLeft ? 'var(--accent)' : 'transparent',
              zIndex: 40,
              transition: 'background 0.15s ease',
              position: 'relative'
            }}
          >
            <div style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: '1px',
              width: '1px',
              background: 'var(--border-subtle)'
            }} />
          </div>
        )}

        {/* ChatColumn (自适应宽幅: 填满剩余空间) */}
        <ChatColumn
          style={{ flex: 1, minWidth: '360px' }}
          rightWorkspaceOpen={rightWorkspaceOpen}
          onToggleWorkspace={() => setRightWorkspaceOpen(!rightWorkspaceOpen)}
          session={activeSession}
          messages={messages}
          workMode={workMode}
          setWorkMode={setWorkMode}
          currentModel={currentModel}
          onSelectModel={handleSelectModel}
          permissionPolicy={permissionPolicy}
          setPermissionPolicy={setPermissionPolicy}
          onSendMessage={handleSendMessage}
          onResolveOptions={handleResolveOptions}
          onForkMessage={handleForkSessionFromMessage}
          onNavigateDiff={(target) => {
            setRightWorkspaceOpen(true);
            setActiveDiffTarget({ ...target, highlightToken: `diff-${target.fileId}` });
          }}
        />

        {/* Right Divider (Draggable, when workbench open) */}
        {rightWorkspaceOpen && (
          <div
            onMouseDown={() => setIsDraggingRight(true)}
            onDoubleClick={() => setWorkbenchWidth(560)}
            title="双击恢复默认宽度，拖拽调节工作台宽度"
            style={{
              width: '4px',
              cursor: 'col-resize',
              background: isDraggingRight ? 'var(--accent)' : 'transparent',
              zIndex: 40,
              transition: 'background 0.15s ease',
              position: 'relative'
            }}
          >
            <div style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: '1px',
              width: '1px',
              background: 'var(--border-subtle)'
            }} />
          </div>
        )}

        {/* EditorWorkspace (Dynamic Resizable Width & Diff Navigation) */}
        {rightWorkspaceOpen && (
          <div style={{ width: `${workbenchWidth}px`, flexShrink: 0, height: '100%', display: 'flex' }}>
            <EditorWorkspace
              isOpen={rightWorkspaceOpen}
              onClose={() => setRightWorkspaceOpen(false)}
              activeDiffTarget={activeDiffTarget}
            />
          </div>
        )}
      </div>

      {/* Global Command Hub & Quick File Switcher (Ctrl+P / Ctrl+Shift+P) */}
      <CommandPaletteModal
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        mode={paletteMode}
        onOpenFile={(path) => {
          setRightWorkspaceOpen(true);
        }}
        onRunAction={(actionId) => {
          if (actionId === 'run-ci') {
            setRightWorkspaceOpen(true);
          }
        }}
      />

      {/* Token Financial & ROI Analytics Modal */}
      <TokenAnalyticsModal
        isOpen={isTokenAnalyticsOpen}
        onClose={() => setIsTokenAnalyticsOpen(false)}
        stats={tokenStats}
      />

      {/* Global Settings & Preferences Modal Dialog */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentAccentHex={accentHex}
        onSelectAccentHex={handleSelectAccentHex}
      />
    </div>
  );
};
export default App;
