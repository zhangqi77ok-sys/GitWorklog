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
  renameSession
} from './types/contracts';

export const App: React.FC = () => {
  const [activeNav, setActiveNav] = useState('sessions');
  const [currentSessionId, setCurrentSessionId] = useState('session-2');
  const [workMode, setWorkMode] = useState<WorkMode>('act');
  const [permissionPolicy, setPermissionPolicy] = useState<PermissionPolicy>('autonomous_agent');

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

  // Hierarchical Sessions with Tags
  const [sessions, setSessions] = useState<SessionItem[]>([
    {
      id: 'session-1',
      tier1: 'global',
      title: 'Python 3.12 模式匹配语法讨论',
      tags: ['docs', 'refactor'],
      messagesCount: 4,
      totalTokens: 5200,
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now() - 1800000
    },
    {
      id: 'session-2',
      tier1: 'project',
      projectId: 'proj-1',
      projectName: 'agent-learning',
      gitBranch: 'main',
      title: '重构三栏自适应流体布局',
      tags: ['feat', 'ui'],
      messagesCount: 8,
      totalTokens: 18500,
      createdAt: Date.now() - 7200000,
      updatedAt: Date.now()
    },
    {
      id: 'session-3',
      tier1: 'file',
      projectId: 'proj-1',
      projectName: 'agent-learning',
      filePath: 'src/bus/GatewayBus.ts',
      title: 'GatewayBus.ts 事件防重优化',
      tags: ['bug'],
      messagesCount: 3,
      totalTokens: 4200,
      createdAt: Date.now() - 14400000,
      updatedAt: Date.now() - 7200000
    },
    {
      id: 'session-4',
      tier1: 'project',
      projectId: 'proj-2',
      projectName: 'codemind-sdk',
      gitBranch: 'dev',
      title: 'Python AST 语法治具规范定义',
      tags: ['test'],
      messagesCount: 2,
      totalTokens: 3100,
      createdAt: Date.now() - 28800000,
      updatedAt: Date.now() - 14400000
    }
  ]);

  // Messages mock
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      role: 'user',
      content: '请帮我完成状态管理重构，并为 OptionsCard 增加自定义输入支持。',
      timestamp: Date.now() - 300000
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: '已针对项目 AST 完成扫描。检测到组件状态扩展需求，有多种架构路径可供选择：',
      timestamp: Date.now() - 240000,
      auditTag: '🤖 自动决策通过 · 已存快照',
      optionsPayload: {
        id: 'opt-1',
        question: '检测到组件状态扩展需求，请选择架构路径：',
        single_select: true,
        status: 'pending',
        allow_custom_input: true,
        options: [
          { id: 'extend', label: '扩展现有全局 Store (Recommended)', description: '单例状态源，无额外模板代码', isRecommended: true },
          { id: 'slice', label: '新建独立子模块 Slice', description: '严格模块隔离，适合大型复杂功能' }
        ]
      }
    }
  ]);

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

  const handleNewFileSession = (projectId: string, filePath: string) => {
    const proj = projects.find(p => p.id === projectId);
    const fileName = filePath.split('/').pop();
    const newSession: SessionItem = {
      id: `session-${Date.now()}`,
      tier1: 'file',
      projectId: projectId,
      projectName: proj?.name || 'agent-learning',
      filePath: filePath,
      title: `${fileName} 专属会话`,
      tags: ['refactor'],
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
      />

      {/* 2. Main Workspace Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ActivityBar (42px) */}
        <ActivityBar activeNav={activeNav} setActiveNav={setActiveNav} />

        {/* LeftPanel: Hierarchical Project & Session Tree */}
        <LeftPanel
          width={260}
          projects={projects}
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={setCurrentSessionId}
          onNewGlobalSession={handleNewGlobalSession}
          onNewProjectSession={handleNewProjectSession}
          onNewFileSession={handleNewFileSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
        />

        {/* ChatColumn (弹性 45%) */}
        <ChatColumn
          session={activeSession}
          messages={messages}
          workMode={workMode}
          setWorkMode={setWorkMode}
          permissionPolicy={permissionPolicy}
          setPermissionPolicy={setPermissionPolicy}
          onSendMessage={handleSendMessage}
          onResolveOptions={handleResolveOptions}
        />

        {/* EditorWorkspace (弹性 55%) */}
        <EditorWorkspace />
      </div>
    </div>
  );
};
export default App;
